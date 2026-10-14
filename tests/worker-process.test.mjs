import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('worker claims a batch, mirrors evidence and completes through a simulated Codex process', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'job-worker-test-'));
  await fs.mkdir(path.join(root, 'scripts'));
  for (const name of ['worker-core.mjs','codex-worker.mjs']) await fs.copyFile(path.join(source, 'scripts', name), path.join(root, 'scripts', name));
  const fakeCli = path.join(root, 'fake-codex');
  await fs.writeFile(fakeCli, `#!/usr/bin/env node\nconst fs=require('node:fs');const path=require('node:path');const a=process.argv.slice(2);if(a[0]==='--version'||a[0]==='login'){console.log('test stub');process.exit(0)};let prompt='';process.stdin.on('data',d=>prompt+=d);process.stdin.on('end',()=>{const cwd=a[a.indexOf('-C')+1];if(!prompt.includes('no more than 1 additional applications'))process.exit(2);if(process.env.TRACKER_ACCESS_TOKEN)process.exit(3);fs.appendFileSync(path.join(cwd,'application-updates.jsonl'),JSON.stringify({id:'fixture-job',company:'Test fixture',title:'Test engineer',jobUrl:'https://example.invalid/test-only',status:'applied',appliedAt:new Date().toISOString(),confirmation:'Synthetic test evidence; no external submission'})+'\\n');fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({status:'completed',message:'Test completed'}));});\n`, {mode:0o700});
  const jobs=[];let finish;
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):null;
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/onboarding')return res.end('{}');
    if(req.url==='/api/jobs'){jobs.push(body);return res.end('{"saved":1}');}
    if(req.url==='/api/data')return res.end(JSON.stringify({jobs}));
    if(body?.action==='tick')return res.end(JSON.stringify({request:{id:'fixture-request',count:1,baseTotal:0,target:1},preferences:{selectedRoles:['Test engineer']},resume:{fileName:'fixture.txt',text:'Synthetic test resume',base64:Buffer.from('Synthetic test resume').toString('base64')},jobs:[]}));
    if(body?.action==='finish'){finish=body;return res.end('{}');}
    return res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const child=spawn(process.execPath,[path.join(root,'scripts/codex-worker.mjs'),'--once'],{env:{...process.env,CODEX_BIN:fakeCli,TRACKER_URL:`http://127.0.0.1:${server.address().port}`,TRACKER_ACCESS_TOKEN:'synthetic-test-token'},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
    const code=await new Promise((resolve,reject)=>{child.on('close',resolve);child.on('error',reject);});
    assert.equal(code,0,output);assert.equal(jobs.length,1);assert.equal(finish?.status,'completed');assert.equal(finish?.requestId,'fixture-request');
    await assert.rejects(fs.stat(path.join(root,'.private','worker.lock')));
    assert.doesNotMatch(output,/synthetic-test-token/);
  } finally {await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
});
