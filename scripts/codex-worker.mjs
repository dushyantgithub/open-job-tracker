#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { trackerOrigin, safeResumeName, validateUpdate, completeLines, buildPrompt } from './worker-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = trackerOrigin(process.env.TRACKER_URL);
const binary = process.env.CODEX_BIN || 'codex';
const privateRoot = path.join(root, '.private');
let workerId = `${os.hostname().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,60)}-${randomUUID()}`;
const headers = { 'Content-Type': 'application/json', Origin: origin };
if (process.env.TRACKER_ACCESS_TOKEN) headers['OAI-Sites-Authorization'] = `Bearer ${process.env.TRACKER_ACCESS_TOKEN}`;
let stopping = false;
let child;
let haveLock = false;

async function api(route, body) {
  const response = await fetch(origin + route, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(30000) });
  let data;
  try { data = await response.json(); } catch { throw new Error(`Tracker returned a non-JSON response (${response.status}). Check the URL and private access.`); }
  if (!response.ok) throw new Error(data.error || `Tracker request failed (${response.status}).`);
  return data;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function stopChild() { if (child && child.exitCode === null) child.kill('SIGTERM'); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; stopChild(); });

async function preflight() {
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (version.error || version.status !== 0) throw new Error('Codex CLI was not found. Install the official Codex CLI or set CODEX_BIN.');
  const login = spawnSync(binary, ['login', 'status'], { encoding: 'utf8', timeout: 15000 });
  if (login.error || login.status !== 0) throw new Error('Sign in with your own account using codex login, then restart the worker.');
  await api('/api/onboarding');
  console.log('Codex is installed and signed in. Tracker is reachable. Browser capabilities are checked by Codex when a run starts.');
}

async function acquireLock() {
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const lockPath = path.join(privateRoot, 'worker.lock');
  try { await fs.writeFile(lockPath, JSON.stringify({ pid: process.pid, workerId }), { flag: 'wx', mode: 0o600 }); haveLock = true; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let previous;
    try { previous = JSON.parse(await fs.readFile(lockPath, 'utf8')); } catch { throw new Error('Worker lock is unreadable. Inspect .private/worker.lock before restarting.'); }
    try { process.kill(previous.pid, 0); } catch (signalError) {
      if (signalError.code === 'ESRCH') { await fs.unlink(lockPath); return acquireLock(); }
      throw signalError;
    }
    throw new Error('A worker is already running for this copy.');
  }
}

async function recoverUnfinished() {
  const recoveryPath = path.join(privateRoot, 'active-request.json');
  let saved;
  try { saved = JSON.parse(await fs.readFile(recoveryPath, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const handoff = (await api('/api/takeover')).takeover;
  const state = await api('/api/data');
  if(handoff?.requestId===saved.requestId && handoff.workerId===saved.workerId && ['awaiting_user','resume_pending'].includes(state.run.status)) {
    workerId=saved.workerId;
    console.log('Preserved the original worker identity for the pending human takeover. Waiting for the owner to resume.');
    return;
  }
  if (!process.argv.includes('--recover')) throw new Error('A previous batch ended without closing its request. Inspect its private proofs and run npm run worker -- --recover to import saved updates and stop that batch for review.');
  const runsRoot = path.join(privateRoot, 'runs') + path.sep;
  if (!path.resolve(saved.runDir).startsWith(runsRoot)) throw new Error('Invalid private recovery path.');
  let content = '';
  try { content = await fs.readFile(path.join(saved.runDir, 'application-updates.jsonl'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const line of completeLines(content, 0, true).lines) await api('/api/jobs', validateUpdate(JSON.parse(line)));
  await api('/api/worker', { action: 'finish', workerId: saved.workerId, requestId: saved.requestId, status: 'blocked', message: 'Recovered saved updates from an interrupted worker. Review any submission with no confirmation before starting another batch.' });
  await fs.unlink(recoveryPath);
  console.log('Interrupted batch closed for review. Resume explicitly from the dashboard when ready.');
}

async function processBatch(payload) {
  const { request, preferences, resume, jobs } = payload;
  const runDir = path.join(privateRoot, 'runs', randomUUID());
  await fs.writeFile(path.join(privateRoot, 'active-request.json'), JSON.stringify({ requestId: request.id, workerId, runDir }), { mode: 0o600 });
  await fs.mkdir(path.join(runDir, 'proofs'), { recursive: true, mode: 0o700 });
  const write = (name, data) => fs.writeFile(path.join(runDir, name), data, { mode: 0o600 });
  await write('candidate-resume.txt', resume.text);
  await write(`original-${safeResumeName(resume.fileName)}`, Buffer.from(resume.base64, 'base64'));
  await write('search-plan.json', JSON.stringify(preferences, null, 2));
  await write('existing-jobs.json', JSON.stringify(jobs, null, 2));
  await write('application-updates.jsonl', '');
  await write('resume-checkpoint.json', JSON.stringify(payload.resumeContext || null, null, 2));
  await write('search-instructions.txt', payload.searchInstructions || 'Read the current source-search instructions from the dashboard.');
  await write('submission-instructions.txt', payload.submissionInstructions || 'Read the current dashboard handoff submissionInstructions before continuing. Do not assume automated submission is allowed.');
  await write('result-schema.json', JSON.stringify({ type: 'object', properties: { status: { type: 'string', enum: ['completed', 'awaiting_review', 'awaiting_user', 'partial', 'blocked'] }, message: { type: 'string' } }, required: ['status', 'message'], additionalProperties: false }));
  const log = await fs.open(path.join(runDir, 'codex-events.jsonl'), 'a', 0o600);
  const resultPath = path.join(runDir, 'result.json');
  const agentEnv = { ...process.env };
  delete agentEnv.TRACKER_ACCESS_TOKEN;
  let offset = 0;
  let syncError;
  let paused = false;
  let takeoverRequested = false;
  let exited = false;
  let exitCode = null;
  const updatesPath = path.join(runDir, 'application-updates.jsonl');
  async function sync(final = false) {
    const content = await fs.readFile(updatesPath, 'utf8');
    const chunk = completeLines(content, offset, final);
    for (const line of chunk.lines) await api('/api/jobs', validateUpdate(JSON.parse(line)));
    offset = chunk.nextOffset;
  }
  console.log(`Starting a batch of at most ${request.count} applications. Private progress: .private/runs/${path.basename(runDir)}`);
  child = spawn(binary, ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--json', '-C', runDir, '--output-schema', path.join(runDir, 'result-schema.json'), '--output-last-message', resultPath, '-'], { stdio: ['pipe', log.fd, log.fd], env: agentEnv });
  child.on('error', error => { syncError = new Error(`Codex could not start: ${error.message}`); exited = true; });
  child.on('close', code => { exitCode = code; exited = true; });
  child.stdin.on('error', () => {});
  child.stdin.end(buildPrompt(request));
  let nextHeartbeat = 0;
  while (!exited) {
    try {
      await sync();
      if(!takeoverRequested){
        let handoff;
        try { handoff=JSON.parse(await fs.readFile(path.join(runDir,'handoff-request.json'),'utf8')); } catch(error) { if(error.code!=='ENOENT')throw error; }
        if(handoff){await api('/api/takeover',{...handoff,action:'request',workerId,requestId:request.id});takeoverRequested=true;paused=true;stopChild();}
      }
      if (Date.now() >= nextHeartbeat) {
        const heartbeat = await api('/api/worker', { action: 'heartbeat', workerId, requestId: request.id });
        nextHeartbeat = Date.now() + 15000;
        if (heartbeat.run?.status === 'paused' || heartbeat.paused === true) { paused = true; stopChild(); }
      }
    } catch (error) { syncError = error; stopChild(); }
    if (stopping || syncError || paused) {
      stopChild();
      await delay(3000);
      if (!exited) child.kill('SIGKILL');
    }
    if (!exited) await delay(2000);
  }
  await log.close();
  child = undefined;
  try { await sync(true); } catch (error) { syncError = error; }
  let result = { status: 'blocked', message: 'Codex ended without a valid result. Inspect the private run log before retrying.' };
  try { result = JSON.parse(await fs.readFile(resultPath, 'utf8')); } catch {}
  const current = await api('/api/data');
  if(['awaiting_user','resume_pending'].includes(current.run?.status)){
    console.log('Human help requested. Saved the checkpoint and stopped browser actions. Waiting for the owner to resume.');
    return;
  }
  const verified = current.verifiedTotal ?? current.jobs.filter(job => job.appliedAt && job.confirmation).length;
  const status = !syncError && !paused && !stopping && verified >= request.target ? 'completed' : !syncError && !paused && !stopping && exitCode === 0 && payload.preferences.submissionMode === 'manual_review' && result.status === 'awaiting_review' ? 'awaiting_review' : 'blocked';
  const message = syncError ? `Progress sync failed: ${syncError.message}. Review this run before resuming.` : paused ? 'Paused by the user. Review any in-progress submission before resuming.' : stopping ? 'Worker stopped. Review any in-progress submission before resuming.' : exitCode !== 0 ? `Codex stopped before completing the batch. ${result.message}` : result.message;
  await api('/api/worker', { action: 'finish', workerId, requestId: request.id, status, message });
  await fs.unlink(path.join(privateRoot, 'active-request.json')).catch(() => {});
  console.log(status === 'completed' ? 'Batch completed with verified submissions.' : 'Batch needs attention. Check the dashboard and private run log.');
}

try {
  await preflight();
  if (!process.argv.includes('--check')) {
    await acquireLock();
    await recoverUnfinished();
    console.log('Worker connected. Keep this process running for scheduled applications. Press Ctrl+C to stop.');
    do {
      const payload = await api('/api/worker', { action: 'tick', workerId });
      if (payload.request && payload.paused) await api('/api/worker', { action: 'finish', workerId, requestId: payload.request.id, status: 'blocked', message: 'Paused before the worker started any applications.' });
      else if (payload.request) await processBatch(payload);
      if (process.argv.includes('--once')) break;
      if (!stopping) await delay(10000);
    } while (!stopping);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { stopChild(); if (haveLock) await fs.unlink(path.join(privateRoot, 'worker.lock')).catch(() => {}); }
