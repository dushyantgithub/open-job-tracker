import { validateSalaryRules, type SalaryRules } from "./salary-preferences.ts";
import { defaultSearchPortals, searchPortalOptions } from "./job-sources.ts";
export const allowedLocations = ["EU", "US", "IN", "AU", "CA"] as const;
export const allowedIndiaCities = ["Bengaluru", "Pune", "Mumbai"] as const;
export interface Preferences {
  applicantFacts?: string;
  searchPortals?: string[];
  salaryRules?: SalaryRules;
  applyWithoutSalary?: boolean;
  selectedRoles: string[];
  locations: typeof allowedLocations[number][];
  indiaCities: typeof allowedIndiaCities[number][];
  frequency: "manual" | "daily" | "weekly";
  batchLimit: number;
  totalLimit: number;
}
export class InputError extends Error {}
export function validatePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Choose your application preferences.");
  const v = value as Record<string, unknown>;
  const strings = (key: string, max: number) => {
    const input = v[key];
    if (!Array.isArray(input) || input.length > max || input.some(x => typeof x !== "string" || !x.trim() || x.length > 100)) throw new InputError(`Invalid ${key}.`);
    return [...new Set(input.map(x => (x as string).trim()))];
  };
  if (v.applicantFacts !== undefined && (typeof v.applicantFacts !== "string" || v.applicantFacts.length > 8000)) throw new InputError("Applicant facts must be text of at most 8000 characters.");
  if (v.applyWithoutSalary !== undefined && typeof v.applyWithoutSalary !== "boolean") throw new InputError("Choose whether jobs without a salary can be considered.");
  let salaryRules: SalaryRules | undefined;
  if(v.salaryRules !== undefined) { try { salaryRules=validateSalaryRules(v.salaryRules); } catch(error) { throw new InputError(error instanceof Error?error.message:"Invalid salary preferences."); } }
  const applicantFacts = typeof v.applicantFacts === "string" ? v.applicantFacts.trim() : "";
  const searchPortals = v.searchPortals === undefined ? [...defaultSearchPortals] : strings("searchPortals", searchPortalOptions.length);
  if (!searchPortals.length || searchPortals.some(portal => !(searchPortalOptions as readonly string[]).includes(portal))) throw new InputError("Choose at least one supported search portal.");
  const roles = strings("selectedRoles", 10);
  const locations = strings("locations", 5);
  const indiaCities = strings("indiaCities", 3).map(x => x === "Bangalore" ? "Bengaluru" : x);
  if (!roles.length) throw new InputError("Choose at least one job type.");
  if (!locations.length || locations.some(x => !(allowedLocations as readonly string[]).includes(x))) throw new InputError("Choose at least one supported location.");
  if (indiaCities.some(x => !(allowedIndiaCities as readonly string[]).includes(x)) || (locations.includes("IN") && !indiaCities.length)) throw new InputError("For India, choose Bangalore, Pune or Mumbai.");
  if (!["manual", "daily", "weekly"].includes(String(v.frequency))) throw new InputError("Choose a valid application frequency.");
  if (!Number.isInteger(v.batchLimit) || Number(v.batchLimit) < 1 || Number(v.batchLimit) > 100) throw new InputError("Applications per run must be between 1 and 100.");
  if (!Number.isInteger(v.totalLimit) || Number(v.totalLimit) < 1 || Number(v.totalLimit) > 1000) throw new InputError("Total applications must be between 1 and 1000.");
  if (Number(v.batchLimit) > Number(v.totalLimit)) throw new InputError("Applications per run cannot exceed the total limit.");
  return { applicantFacts, searchPortals, ...(salaryRules ? {salaryRules} : {}), applyWithoutSalary: v.applyWithoutSalary === undefined ? true : v.applyWithoutSalary as boolean, selectedRoles: roles, locations: locations as Preferences["locations"], indiaCities: [...new Set(indiaCities)] as Preferences["indiaCities"], frequency: v.frequency as Preferences["frequency"], batchLimit: Number(v.batchLimit), totalLimit: Number(v.totalLimit) };
}
const rules: { title: string; terms: RegExp[] }[] = [
  { title: "Engineering Manager", terms: [/\bengineering manager\b/i, /\bmanaged (?:a |an )?(?:team|engineer)/i, /\bhead of engineering\b/i] },
  { title: "Backend Engineer", terms: [/\b(?:backend|back-end)\b/i, /\b(?:django|fastapi|spring boot|node\.js)\b/i, /\b(?:postgresql|redis|celery|rabbitmq)\b/i] },
  { title: "Frontend Engineer", terms: [/\b(?:frontend|front-end)\b/i, /\b(?:react|angular|vue|next\.js)\b/i, /\b(?:typescript|css|javascript)\b/i] },
  { title: "Full Stack Engineer", terms: [/\bfull[ -]?stack\b/i] },
  { title: "Mobile Engineer", terms: [/\b(?:ios|android|react native|flutter|swift|kotlin)\b/i] },
  { title: "Machine Learning Engineer", terms: [/\b(?:machine learning|deep learning|pytorch|tensorflow)\b/i] },
  { title: "Data Engineer", terms: [/\b(?:data engineer|data pipeline|etl|spark|airflow|dbt)\b/i] },
  { title: "Platform Engineer", terms: [/\b(?:platform engineer|site reliability|devops|kubernetes|terraform)\b/i] },
  { title: "Embedded Software Engineer", terms: [/\b(?:embedded|firmware|rtos|microcontroller)\b/i] },
  { title: "QA Automation Engineer", terms: [/\b(?:test automation|qa engineer|selenium|quality assurance)\b/i] },
  { title: "Security Engineer", terms: [/\b(?:security engineer|penetration testing|application security)\b/i] },
];
export function analyzeResume(text: string) {
  const suggestedRoles = rules.map(rule => ({ title: rule.title, evidence: rule.terms.map(term => text.match(term)?.[0]).filter((x): x is string => Boolean(x)) })).filter(rule => rule.evidence.length);
  if (!suggestedRoles.length) suggestedRoles.push({ title: "Software Engineer", evidence: ["General role suggestion. Review this against your experience."] });
  const skills = [...new Set((text.match(/\b(?:Python|JavaScript|TypeScript|React|Django|FastAPI|PostgreSQL|Redis|AWS|Azure|GCP|Docker|Kubernetes|Java|Kotlin|Swift|Flutter|TensorFlow|PyTorch|SQL|Rust|Go|C\+\+)\b/gi) || []).map(x => x.trim()))].slice(0, 30);
  return { method: "local_keywords" as const, suggestedRoles: suggestedRoles.slice(0, 8), skills, summary: "Suggested job types are based on words in your resume. Review them before starting. Your connected agent will assess each role against the full resume." };
}
export function nextScheduledAt(frequency: Preferences["frequency"], from: Date): string | null {
  return frequency === "manual" ? null : new Date(from.getTime() + (frequency === "daily" ? 1 : 7) * 86400000).toISOString();
}
export function remainingBatch(preferences: Preferences, applied: number): number {
  return Math.max(0, Math.min(preferences.batchLimit, preferences.totalLimit - applied));
}
export function canonicalJobUrl(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new InputError("Job URLs must use http or https.");
  url.hash = "";
  for (const name of [...url.searchParams.keys()]) if (/^(utm_|gh_src$|source$|ref$|referrer$|tracking)/i.test(name)) url.searchParams.delete(name);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}
