export const companyCareers: Record<string, string> = {
  "Google Careers": "https://www.google.com/about/careers/applications/jobs/results/",
  "Anthropic Careers": "https://www.anthropic.com/careers/jobs",
  "OpenAI Careers": "https://openai.com/careers/search/",
  "Meta Careers": "https://www.metacareers.com/jobs/",
  "X Careers": "https://careers.x.com/",
  "Atlassian Careers": "https://www.atlassian.com/company/careers/all-jobs",
  "Microsoft Careers": "https://careers.microsoft.com/",
  "Amazon Jobs": "https://www.amazon.jobs/en/search",
};
export type SourceStrategy = "balanced" | "best_fit";
export const searchPortalOptions = [
  "Company careers", "Y Combinator / Work at a Startup", "Greenhouse", "Ashby", "Lever",
  "SmartRecruiters", "Recruitee", "JazzHR", "Gem",
  "LinkedIn", "Naukri", "Instahyre", "Wellfound", "Cutshort", "Indeed",
  ...Object.keys(companyCareers),
] as const;
export const defaultSearchPortals: string[] = [...searchPortalOptions.slice(0, 9), ...Object.keys(companyCareers)];
export function sourceSearchInstructions(portals: readonly string[] = defaultSearchPortals, strategy: SourceStrategy = "balanced") {
  return `OFFICIAL COMPANY CAREERS
${portals.filter(p=>companyCareers[p]).map(p=>`${p}: ${companyCareers[p]}`).join("\n")}
Follow official redirects and verify the actual employer on each role. X Careers currently redirects to xAI careers; do not label unrelated employers as X. A company source does not imply salary, visa or role eligibility.
SOURCE SELECTION: ${strategy}
${strategy === "balanced" ? "Among equally suitable, eligible roles, prefer a different discovery source and application portal from the previous application. Select from the least represented eligible sources in this batch, using the saved ledger to count completed/prepared work. If only one source has strong matches, use it within its limits and record why. Never downgrade role fit or create filler applications to force diversity." : "Prioritize the strongest eligible role matches after checking each selected source."}
Source rotation broadens coverage. It is not proven ATS protection: several discovery sites may lead to the same employer or ATS. Never switch sources, accounts or networks to evade a challenge, rate limit or block.
SEARCH SOURCES AND DISCOVERY\nFor each authorized batch, check every selected search portal: ${portals.join(", ")}. Search using the latest selected roles and locations. Include a search pass across all selected portals before concentrating applications on one source. Use only the authorized agent environment and normal signed-in access. Record a factual Activity log note for each portal with request ID, portal name, check time, search URL and outcome (checked, no matching roles, or blocked with the exact reason). A login wall, CAPTCHA or unavailable tool is blocked, never checked. Do not silently omit a selected portal or claim a search that did not occur. Do not create accounts or bypass access controls.\nFor each newly discovered role save discoverySource (where you first found it), discoveryUrl (that original listing or search result URL) and discoveredAt (the actual ISO discovery time). Keep portal for the application system and jobUrl for the canonical employer posting. For example, a LinkedIn discovery may be applied through Greenhouse. Preserve the first discovery source when following links or seeing the same job elsewhere. Deduplicate by employer and posting identity across portals before applying. Historical records with no evidence stay Not recorded; never infer discovery from the application portal. Save verified submission evidence even if a discovery detail cannot be recovered; explain the missing detail truthfully.`;
}
export interface DiscoveryFields { discoverySource?: string; discoveryUrl?: string; discoveredAt?: string; }
export function validateDiscovery(job: DiscoveryFields, previous: DiscoveryFields = {}) {
  if (job.discoverySource !== undefined && (typeof job.discoverySource !== "string" || !job.discoverySource.trim() || job.discoverySource.length > 100)) throw new Error("discoverySource must be non-empty text of at most 100 characters.");
  if (job.discoveryUrl !== undefined) {
    if (typeof job.discoveryUrl !== "string" || job.discoveryUrl.length > 4000) throw new Error("Invalid discoveryUrl.");
    let url: URL;
    try { url = new URL(job.discoveryUrl); } catch { throw new Error("discoveryUrl must be an http or https URL."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("discoveryUrl must be an http or https URL without credentials.");
  }
  if (job.discoveredAt !== undefined && (typeof job.discoveredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(job.discoveredAt) || !Number.isFinite(Date.parse(job.discoveredAt)))) throw new Error("discoveredAt must be an ISO date and time.");
  for (const key of ["discoverySource", "discoveryUrl", "discoveredAt"] as const) {
    if (previous[key] && job[key] !== previous[key]) throw new Error(`Preserve the original ${key}; following an application link does not change discovery.`);
  }
}
