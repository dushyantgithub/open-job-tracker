export const regionOptions = [
  { value: "EU", label: "European Union" },
  { value: "US", label: "United States" },
  { value: "IN", label: "India" },
  { value: "AU", label: "Australia" },
  { value: "CA", label: "Canada" },
  { value: "Other", label: "Other" },
] as const;
export type JobRegion = typeof regionOptions[number]["value"];
export const indiaCities = [
  { value: "Bengaluru", label: "Bangalore / Bengaluru" },
  { value: "Pune", label: "Pune" },
  { value: "Mumbai", label: "Mumbai" },
] as const;
export function getJobRegion(job: Pick<Job, "region" | "country">): JobRegion {
  if (job.region && job.region !== "Other") return job.region;
  const country = (job.country || "").trim().toLowerCase();
  return ({ india: "IN", in: "IN", australia: "AU", au: "AU", canada: "CA", ca: "CA", "united states": "US", usa: "US", us: "US" } as Record<string, JobRegion>)[country] || job.region || "Other";
}
export function matchesIndiaCity(location: string | undefined, city = "all"): boolean {
  const value = location || "";
  if (city === "all") return /\b(bangalore|bengaluru|pune|mumbai)\b/i.test(value);
  if (city === "Bengaluru") return /\b(bangalore|bengaluru)\b/i.test(value);
  return indiaCities.some(option => option.value === city) && value.toLowerCase().split(/[^a-z]+/).includes(city.toLowerCase());
}
export const statuses = ["discovered", "shortlisted", "preparing", "applied", "blocked", "skipped", "rejected", "withdrawn"] as const;
export type JobStatus = typeof statuses[number];
export interface Job {
  id: string; company: string; title: string; status: JobStatus; portal?: string; appliedAt?: string | null; resumeUsed?: string; coverLetterUsed?: string;
  salaryExpectation?: string; advertisedSalary?: string; salaryMin?: number | null; salaryMax?: number | null; currency?: string;
  country?: string; region?: JobRegion; location?: string; workMode?: string; visaRequired?: boolean; visaSupport?: "confirmed" | "not stated" | "unavailable";
  visaEvidence?: string; visaEvidenceUrl?: string; language?: string; jobUrl?: string; companyUrl?: string; companySummary?: string; notes?: string;
  reason?: string; confirmation?: string; confirmationUrl?: string; yc?: boolean; fitSummary?: string; createdAt?: string; updatedAt?: string;
}
export interface Run { target: number; status: string; message: string; lastAgentUpdate: string | null; nextCheckAt: string | null; checkIntervalMinutes: number; startedAt: string | null; }
export const defaultRun: Run = { target: 0, status: "setup_required", message: "Add your resume and preferences, then connect a worker to start.", lastAgentUpdate: null, nextCheckAt: null, checkIntervalMinutes: 0, startedAt: null };
export interface ActivityItem { id: string; type: string; message: string; jobId: string | null; createdAt: string; }
export interface MoreRequest { id: string; count: number; status: string; createdAt: string; acknowledgedAt: string | null; notes: string | null; }
export interface TrackerData { verifiedTotal?: number; jobs: Job[]; activity: ActivityItem[]; requests: MoreRequest[]; run: Run; serverTime: string; }
