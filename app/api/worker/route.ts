import { getRawDb } from "@/db";
import { authorize, failure, json, readRun } from "@/lib/server";
import { nextScheduledAt, type Preferences } from "@/lib/onboarding-core";
import { activeRequest, appliedTotal, publicRequest, queueBatch, readSetting, settingStatement, writeSetting, type RequestRow, type ResumeData, type Schedule } from "@/lib/onboarding";
export async function POST(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  try {
    const body = await request.json() as { action?: string; workerId?: string; requestId?: string; status?: string; message?: string; };
    const db = getRawDb();
    const now = new Date().toISOString();
    if (body.action === "pause") {
      const run = { ...await readRun(), status: "paused", message: "Applications paused.", lastAgentUpdate: now, nextCheckAt: null };
      await db.batch([
        settingStatement("schedule", { enabled: false, paused: true, nextRunAt: null }),
        // Retain the worker checkpoint and allow it to save proof for a form
        // already sent. Its acknowledgement is separate from the owner's pause.
        db.prepare("UPDATE requests SET status=CASE WHEN status='queued' THEN 'cancelled' ELSE 'pausing' END, completed_at=CASE WHEN status='queued' THEN ? ELSE completed_at END WHERE status IN ('queued','acknowledged','pausing')").bind(now),
        settingStatement("run", run),
      ]);
      const settling = await activeRequest();
      return json({ paused: true, run, acknowledgementPending: settling?.status === "pausing", request: settling ? publicRequest(settling) : null });
    }
    if (body.action === "confirm_stopped") {
      if (!body.requestId) return json({ error: "Provide the paused requestId." }, 400);
      const schedule = await readSetting<Schedule>("schedule");
      const current = await activeRequest();
      if (!schedule?.paused || current?.status !== "pausing" || current.id !== body.requestId) return json({ error: "This is not the current paused request. Refresh the dashboard." }, 409);
      // This is an explicit owner acknowledgement, never inferred from a timeout
      // or stale heartbeat. Keep the original batch target and all saved evidence.
      const result = await db.prepare(`UPDATE requests SET status='cancelled', completed_at=?,
        notes=COALESCE(notes || char(10),'') || 'Owner confirmed the external agent is stopped and saved submissions have been reviewed.'
        WHERE id=? AND status='pausing' AND EXISTS (SELECT 1 FROM settings WHERE id='schedule' AND json_extract(data,'$.paused')=1)
        RETURNING *`).bind(now, body.requestId).first<RequestRow>();
      if (!result) return json({ error: "The request changed. Refresh the dashboard." }, 409);
      return json({ paused: true, request: publicRequest(result) });
    }
    if (!body.workerId || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.workerId)) return json({ error: "A valid workerId is required." }, 400);
    if (!["tick", "heartbeat", "finish"].includes(body.action || "")) return json({ error: "Unknown worker action." }, 400);
    let schedule = await readSetting<Schedule>("schedule");
    await writeSetting("worker", { workerId: body.workerId, status: schedule?.paused ? "paused" : "connected", lastSeenAt: now });
    if (body.action === "heartbeat") {
      const current = await activeRequest();
      const owns = Boolean(current && current.id === body.requestId && current.worker_id === body.workerId);
      return json({ paused: Boolean(schedule?.paused || (body.requestId && !owns)), requestStatus: owns ? current?.status : null });
    }
    if (body.action === "finish") {
      if (!body.requestId || !["completed", "blocked"].includes(body.status || "")) return json({ error: "Provide requestId and completed or blocked status." }, 400);
      const row = await db.prepare("SELECT * FROM requests WHERE id=? AND worker_id=?").bind(body.requestId, body.workerId).first<RequestRow>();
      if (!row) return json({ error: "The worker does not own this request." }, 409);
      if (!["acknowledged", "pausing"].includes(row.status)) return json({ request: publicRequest(row), alreadyFinished: true });
      const applied = await appliedTotal();
      if (body.status === "completed" && applied < row.target && row.status !== "pausing") return json({ error: `Only ${applied} applications are verified; the request target is ${row.target}.` }, 409);
      const preferences = await readSetting<Preferences>("preferences");
      const status = row.status === "pausing" ? "cancelled" : body.status!;
      const keepScheduling = status === "completed" && preferences && applied < preferences.totalLimit;
      const nextRunAt = keepScheduling ? nextScheduledAt(preferences.frequency, new Date()) : null;
      const message = (body.message || (status === "completed" ? "Application batch completed." : "Application worker needs attention.")).slice(0, 1000);
      const result = await db.batch([
        db.prepare("UPDATE requests SET status=CASE WHEN status='pausing' THEN 'cancelled' ELSE ? END,notes=?,completed_at=? WHERE id=? AND worker_id=? AND status IN ('acknowledged','pausing') RETURNING *").bind(status, message, now, row.id, body.workerId),
        db.prepare("INSERT INTO settings(id,data) SELECT 'schedule', CASE WHEN status='cancelled' THEN ? ELSE ? END FROM requests WHERE id=? ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify({enabled:false,paused:true,nextRunAt:null}), JSON.stringify({enabled:Boolean(keepScheduling),paused:status !== "completed",nextRunAt}), row.id),
        db.prepare("INSERT INTO settings(id,data) SELECT 'run', CASE WHEN status='cancelled' THEN ? ELSE ? END FROM requests WHERE id=? ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify({...await readRun(),status:"paused",message:"Applications paused.",lastAgentUpdate:now,nextCheckAt:null}), JSON.stringify({...await readRun(),status:status === "cancelled" ? "paused" : status,message,lastAgentUpdate:now,nextCheckAt:nextRunAt}), row.id),
      ]);
      return json({ request: result[0].results[0], appliedTotal: applied, nextRunAt });
    }
    const preferences = await readSetting<Preferences>("preferences");
    if (!schedule?.enabled || schedule.paused || !preferences) return json({ request: null, paused: Boolean(schedule?.paused), reason: preferences ? "No active schedule." : "Complete setup first." });
    let current = await activeRequest();
    if (!current && schedule.nextRunAt && schedule.nextRunAt <= now) {
      await queueBatch();
      current = await activeRequest();
    }
    if (!current || current.status !== "queued") return json({ request: null, reason: current ? "Another request is already active." : "Waiting for the next scheduled batch." });
    // One atomic UPDATE wins across concurrent worker processes. Never reclaim an
    // uncertain application automatically: the original worker must finish it.
    const claimed = await db.prepare("UPDATE requests SET status='acknowledged',worker_id=?,acknowledged_at=?,notes='Claimed by a connected worker.' WHERE id=? AND status='queued' RETURNING *").bind(body.workerId, now, current.id).first<RequestRow>();
    if (!claimed) return json({ request: null, reason: "The request was claimed by another worker." });
    schedule = await readSetting<Schedule>("schedule");
    if (schedule?.paused) return json({ request: publicRequest(claimed), paused: true });
    const run = { ...await readRun(), status: "preparing", target: claimed.target, message: "A worker connected and is preparing this application batch.", lastAgentUpdate: now, nextCheckAt: null };
    const ready = await db.prepare(`INSERT INTO settings(id,data) SELECT 'run', ?
      WHERE EXISTS (SELECT 1 FROM settings WHERE id='schedule' AND json_extract(data,'$.paused')=0)
      AND EXISTS (SELECT 1 FROM requests WHERE id=? AND status='acknowledged' AND worker_id=?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data RETURNING id`).bind(JSON.stringify(run), claimed.id, body.workerId).first();
    if (!ready) return json({ request: publicRequest(claimed), paused: true });
    const resume = await readSetting<ResumeData>("resume");
    const rows = await db.prepare("SELECT data FROM jobs ORDER BY updated_at DESC").all<{data: string}>();
    return json({ request: publicRequest(claimed), preferences, resume, jobs: rows.results.map(row => JSON.parse(row.data)), run });
  } catch (error) { if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400); return failure(error); }
}
