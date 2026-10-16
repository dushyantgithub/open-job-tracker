import { authorize, failure, json } from "@/lib/server";
import { InputError, validatePreferences } from "@/lib/onboarding-core";
import { activeRequest, appliedTotal, readSetting, setupData, writeSetting } from "@/lib/onboarding";
export async function GET(request: Request) { const denied = authorize(request); if (denied) return denied; try { return json(await setupData()); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  try {
    if (Number(request.headers.get("content-length")) > 16384) return json({ error: "Preferences are too large." }, 413);
    const input = await request.json() as Record<string, unknown> | null;
    const saved = await readSetting<{submissionMode?:"automatic"|"manual_review";searchPortals?: string[];salaryRules?:unknown;applyWithoutSalary?:boolean}>("preferences");
    const preferences = validatePreferences(input && typeof input === "object" && !Array.isArray(input) ? {...input, submissionMode:input.submissionMode===undefined?(saved?saved.submissionMode||"automatic":"manual_review"):input.submissionMode, searchPortals: input.searchPortals === undefined ? saved?.searchPortals : input.searchPortals, salaryRules: input.salaryRules === undefined ? saved?.salaryRules : input.salaryRules, applyWithoutSalary: input.applyWithoutSalary === undefined ? saved?.applyWithoutSalary : input.applyWithoutSalary} : input);
    if (await activeRequest()) return json({ error: "Pause the active run before changing preferences." }, 409);
    if (preferences.totalLimit < await appliedTotal()) return json({ error: "The total limit cannot be below the number already applied." }, 400);
    await writeSetting("preferences", preferences);
    return json(await setupData());
  } catch (error) { if (error instanceof InputError || error instanceof SyntaxError) return json({ error: error.message }, 400); return failure(error); }
}
