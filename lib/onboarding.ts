import { getRawDb } from "@/db";
import { readRun } from "@/lib/server";
import { remainingBatch, type Preferences } from "@/lib/onboarding-core";
export interface ResumeData { id: string; fileName: string; mimeType: string; size: number; uploadedAt: string; textLength: number; text: string; base64: string; }
export interface Schedule { enabled: boolean; paused: boolean; nextRunAt: string | null; }
export interface RequestRow { id: string; count: number; status: string; created_at: string; acknowledged_at: string | null; notes: string | null; target: number; base_total: number; worker_id: string | null; completed_at: string | null; }
export async function readSetting<T>(id: string): Promise<T | null> {
  const row = await getRawDb().prepare("SELECT data FROM settings WHERE id = ?").bind(id).first<{data: string}>();
  return row ? JSON.parse(row.data) as T : null;
}
export function settingStatement(id: string, data: unknown) {
  return getRawDb().prepare("INSERT INTO settings(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(id, JSON.stringify(data));
}
export async function writeSetting(id: string, data: unknown) { await settingStatement(id, data).run(); }
export async function appliedTotal() {
  return (await getRawDb().prepare("SELECT COUNT(*) AS count FROM jobs WHERE json_extract(data,'$.appliedAt') IS NOT NULL AND length(COALESCE(json_extract(data,'$.confirmation'),'')) > 0").first<{count: number}>())?.count || 0;
}
export async function setupData() {
  const [resume, analysis, preferences, worker, schedule, run] = await Promise.all([
    readSetting<ResumeData>("resume"), readSetting("resume_analysis"), readSetting<Preferences>("preferences"),
    readSetting<{status: string; lastSeenAt: string | null}>("worker"), readSetting<Schedule>("schedule"), readRun(),
  ]);
  const { text: _text, base64: _base64, ...metadata } = resume || {} as ResumeData;
  const workerStale = worker?.lastSeenAt && Date.now() - Date.parse(worker.lastSeenAt) > 90_000;
  return { configured: Boolean(resume && preferences), resume: resume ? metadata : null, analysis, preferences, worker: workerStale ? { ...worker, status: "offline" } : worker || { status: "not_connected", lastSeenAt: null }, schedule, run };
}
export function publicRequest(row: RequestRow) {
  return { id: row.id, count: row.count, status: row.status, createdAt: row.created_at, acknowledgedAt: row.acknowledged_at, notes: row.notes, target: row.target, baseTotal: row.base_total, workerId: row.worker_id, completedAt: row.completed_at };
}
export async function activeRequest() {
  return getRawDb().prepare("SELECT * FROM requests WHERE status IN ('queued','acknowledged','pausing') LIMIT 1").first<RequestRow>();
}
export async function queueBatch() {
  const db = getRawDb();
  const preferences = await readSetting<Preferences>("preferences");
  const resume = await readSetting<ResumeData>("resume");
  if (!preferences || !resume) return { error: "Add a resume and save your preferences first.", status: 409 };
  const existing = await activeRequest();
  if (existing?.status === "pausing") return { error: "Wait for the worker to finish pausing before starting another run.", status: 409 };
  if (existing) return { request: publicRequest(existing), alreadyQueued: true };
  const applied = await appliedTotal();
  if (!remainingBatch(preferences, applied)) return { error: "Your total application limit has been reached. Increase it in preferences to continue.", status: 409 };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // The single-active-request index and INSERT SELECT keep concurrent starts from
  // reserving the same capacity. The cap is read in this statement, not cached.
  let row: RequestRow | null;
  try {
    row = await db.prepare(`INSERT INTO requests(id,count,status,created_at,notes,target,base_total)
      SELECT ?, MIN(json_extract(s.data,'$.batchLimit'), json_extract(s.data,'$.totalLimit') - j.n), 'queued', ?,
      'Waiting for a connected worker.', j.n + MIN(json_extract(s.data,'$.batchLimit'), json_extract(s.data,'$.totalLimit') - j.n), j.n
      FROM settings s CROSS JOIN (SELECT COUNT(*) n FROM jobs WHERE json_extract(data,'$.appliedAt') IS NOT NULL AND length(COALESCE(json_extract(data,'$.confirmation'),'')) > 0) j
      WHERE s.id='preferences' AND json_extract(s.data,'$.totalLimit') > j.n
      AND NOT EXISTS (SELECT 1 FROM requests WHERE status IN ('queued','acknowledged','pausing')) RETURNING *`).bind(id, now).first<RequestRow>();
  } catch (error) {
    const pending = await activeRequest();
    if (pending) return { request: publicRequest(pending), alreadyQueued: true };
    throw error;
  }
  if (!row) {
    const pending = await activeRequest();
    return pending ? { request: publicRequest(pending), alreadyQueued: true } : { error: "No application capacity remains.", status: 409 };
  }
  await writeSetting("run", { ...await readRun(), target: row.target, status: "awaiting_worker", message: `${row.count} applications queued. Waiting for a connected worker.`, startedAt: now, nextCheckAt: null });
  return { request: publicRequest(row), alreadyQueued: false };
}
