import { authorize, json } from "@/lib/server";
import { agentProtocol } from "@/lib/agent-guide";
export async function GET(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  return json({ version: 1, protocol: agentProtocol, setupPath: "/api/onboarding", ledgerPath: "/api/data", workerPath: "/api/worker", startsWork: false });
}
