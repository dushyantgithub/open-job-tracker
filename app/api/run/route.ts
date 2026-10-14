import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { json, failure, authorize, readRun } from "@/lib/server";
export async function POST(request: Request) { const denied = authorize(request); if (denied) return denied; try { const body = await request.json() as Partial<import("@/lib/tracker").Run>; const run = { ...await readRun(), ...body, lastAgentUpdate: new Date().toISOString() }; if (!Number.isInteger(run.target) || run.target < 1) return json({ error: "target must be a positive integer" }, 400); const data = JSON.stringify(run); await getDb().insert(settings).values({ id: "run", data }).onConflictDoUpdate({ target: settings.id, set: { data } }); return json({ run }); } catch(error) { return failure(error); } }
