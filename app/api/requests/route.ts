import { getDb } from "@/db";
import { requests } from "@/db/schema";
import { desc } from "drizzle-orm";
import { json, failure, authorize } from "@/lib/server";
export async function GET(request: Request) { const denied = authorize(request); if (denied) return denied; try { return json({ requests: await getDb().select().from(requests).orderBy(desc(requests.createdAt)) }); } catch(error) { return failure(error); } }
export async function POST() { return json({ error: "Request status is managed through /api/worker so ownership and application limits can be checked." }, 409); }
