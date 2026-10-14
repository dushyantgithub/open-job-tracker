import { authorize, failure, json } from "@/lib/server";
import { InputError, validatePreferences } from "@/lib/onboarding-core";
import { activeRequest, appliedTotal, setupData, writeSetting } from "@/lib/onboarding";
export async function GET(request: Request) { const denied = authorize(request); if (denied) return denied; try { return json(await setupData()); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  try {
    if (Number(request.headers.get("content-length")) > 16384) return json({ error: "Preferences are too large." }, 413);
    const preferences = validatePreferences(await request.json());
    if (await activeRequest()) return json({ error: "Pause the active run before changing preferences." }, 409);
    if (preferences.totalLimit < await appliedTotal()) return json({ error: "The total limit cannot be below the number already applied." }, 400);
    await writeSetting("preferences", preferences);
    return json(await setupData());
  } catch (error) { if (error instanceof InputError || error instanceof SyntaxError) return json({ error: error.message }, 400); return failure(error); }
}
