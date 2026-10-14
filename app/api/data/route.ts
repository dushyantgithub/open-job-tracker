import { getDb } from "@/db";
import { jobs, activities, requests } from "@/db/schema";
import { desc } from "drizzle-orm";
import { json, failure, readRun } from "@/lib/server";
import { appliedTotal } from "@/lib/onboarding";
export const dynamic = "force-dynamic";
export async function GET() { try { const db = getDb(); const [jobRows, activity, queue, run] = await Promise.all([db.select().from(jobs).orderBy(desc(jobs.updatedAt)), db.select().from(activities).orderBy(desc(activities.createdAt)).limit(150), db.select().from(requests).orderBy(desc(requests.createdAt)).limit(100), readRun()]); return json({ verifiedTotal: await appliedTotal(), jobs: jobRows.map(row => ({ ...JSON.parse(row.data), id: row.id, company: row.company, title: row.title, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt })), activity, requests: queue, run, serverTime: new Date().toISOString() }); } catch (error) { return failure(error); } }
