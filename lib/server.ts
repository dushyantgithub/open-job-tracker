import { getDb } from "@/db";
import { activities, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { defaultRun, type Run } from "@/lib/tracker";
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
// Single-user app: bind to loopback locally, or put every route behind an owner-private
// authentication gateway when hosted. Same-origin checks below prevent browser CSRF;
// they are NOT authentication and must not be treated as a public deployment gate.
export function authorize(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== new URL(request.url).origin) || (fetchSite && !["same-origin", "none"].includes(fetchSite))) return json({ error: "Cross-site requests are not allowed." }, 403);
  if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) return json({ error: "Content-Type must be application/json." }, 415);
  return null;
}
export function failure(error: unknown) { console.error("Tracker request failed", error); return json({ error: "The tracker could not complete this request. Please retry shortly." }, 500); }
export async function readRun(): Promise<Run> { const rows = await getDb().select().from(settings).where(eq(settings.id, "run")); return rows[0] ? { ...defaultRun, ...JSON.parse(rows[0].data) } : defaultRun; }
export async function logActivity(message: string, type = "info", jobId: string | null = null) { const item = { id: crypto.randomUUID(), message, type, jobId, createdAt: new Date().toISOString() }; await getDb().insert(activities).values(item); return item; }
