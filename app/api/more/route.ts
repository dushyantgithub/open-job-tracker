import { json, failure, authorize } from "@/lib/server";
import { queueBatch, writeSetting } from "@/lib/onboarding";
export async function POST(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  try {
    const result = await queueBatch();
    if ("error" in result) return json({ error: result.error }, result.status);
    if (!result.alreadyQueued) await writeSetting("schedule", { enabled: true, paused: false, nextRunAt: null });
    return json({ ...result, message: "Queued within your saved per-run and total limits. Waiting for a connected worker." }, result.alreadyQueued ? 200 : 201);
  } catch (error) { return failure(error); }
}
