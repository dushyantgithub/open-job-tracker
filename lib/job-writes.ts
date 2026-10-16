import { activeRequest, readSetting } from "@/lib/onboarding";
import { submissionMode, validateReview } from "@/lib/submission-policy";
import type { Preferences } from "@/lib/onboarding-core";
import { validateDiscovery } from "@/lib/job-sources";
import { getDb, getRawDb } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { json, failure, authorize, logActivity, readRun } from "@/lib/server";
import { canonicalJobUrl, InputError } from "@/lib/onboarding-core";
import { statuses, type Job } from "@/lib/tracker";
export async function saveJobs(request: Request, ownerReview = false) {
  const denied = authorize(request); if (denied) return denied;
  try {
    const body = await request.json() as Partial<Job> & {jobs?: Partial<Job>[]};
    const items: Partial<Job>[] = Array.isArray(body) ? body : body.jobs || [body];
    if (!items.length || items.length > 200) throw new InputError("Send between 1 and 200 jobs.");
    const db = getDb(); const raw = getRawDb(); const prepared = [];
    const preferences=await readSetting<Preferences>("preferences"); const current=await activeRequest();
    for (const input of items) {
      if (!input.id || typeof input.id !== "string" || input.id.length > 200) throw new InputError("Each job needs a stable id of at most 200 characters.");
      const [existing] = await db.select().from(jobs).where(eq(jobs.id, input.id));
      const previous = existing ? JSON.parse(existing.data) : {};
      if(!ownerReview && previous.status==="ready_for_review" && (await readRun()).status==="awaiting_review")throw new InputError("The owner is reviewing this draft. Do not mutate it or submit it.");
      const job = { ...previous, ...input };
      try { validateDiscovery(job, previous); } catch (error) { throw new InputError(error instanceof Error ? error.message : "Invalid discovery fields."); }
      const wasVerified = Boolean(previous.appliedAt && previous.confirmation);
      if (!ownerReview && input.userSubmittedAt !== undefined) throw new InputError("Only the owner review action may attest a manual submission.");
      if(previous.userSubmittedAt)job.userSubmittedAt=previous.userSubmittedAt;
      if(!wasVerified && job.status==="applied" && (submissionMode(preferences)==="manual_review" || previous.review) && !ownerReview)throw new InputError("Manual-review applications must be submitted by the owner and recorded through the review panel.");
      if(job.status==="ready_for_review"){
        if(submissionMode(preferences)!=="manual_review"||!current||current.status!=="acknowledged")throw new InputError("A manual-review worker must own an active request.");
        try{job.review=validateReview(job.review);}catch(error){throw new InputError(error instanceof Error?error.message:"Invalid handoff.");}
        if(job.review.requestId!==current.id)throw new InputError("Review belongs to a different request.");
        if(!job.jobUrl||!job.resumeUsed||!job.fitSummary)throw new InputError("Record the posting, resume used and role fit before review.");
        const canonical=canonicalJobUrl(job.jobUrl);job.reviewPostingKey=canonical;
        const all=await raw.prepare("SELECT id,data FROM jobs").all<{id:string;data:string}>();
        const peers=[...all.results.map(row=>({...JSON.parse(row.data),id:row.id})),...prepared.map(p=>p.job)];
        if(peers.some(p=>p.id!==job.id&&p.jobUrl&&canonicalJobUrl(p.jobUrl)===canonical&&(p.status==="ready_for_review"||p.appliedAt)))throw new InputError("This posting already has a prepared or submitted application.");
        const reserved=new Set(peers.filter(p=>p.id!==job.id&&p.status==="ready_for_review"&&p.review?.requestId===current.id).map(p=>p.id)).size;
        const submitted=(await raw.prepare("SELECT COUNT(*) n FROM jobs WHERE json_extract(data,'$.appliedAt') IS NOT NULL AND length(COALESCE(json_extract(data,'$.confirmation'),''))>0").first<{n:number}>())?.n||0;
        if(reserved+submitted>=Math.min(current.target,preferences!.totalLimit))throw new InputError("The batch has no capacity for another prepared application.");
      }
      if (wasVerified) {
        // A later rejection/withdrawal does not undo a real submission or its cap.
        job.appliedAt = previous.appliedAt;
        job.confirmation = previous.confirmation;
        if (input.jobUrl && canonicalJobUrl(input.jobUrl) !== canonicalJobUrl(previous.jobUrl)) throw new InputError("A verified application must retain its original job URL.");
        job.jobUrl = previous.jobUrl;
      } else if (job.status !== "applied" && (job.appliedAt || job.confirmation)) {
        throw new InputError("Only a verified applied record can add submission evidence.");
      }
      if (typeof job.company !== "string" || !job.company.trim() || typeof job.title !== "string" || !job.title.trim()) throw new InputError("Company and title are required for new jobs.");
      job.status ||= "discovered";
      if (!statuses.includes(job.status)) throw new InputError("Invalid job status.");
      if (job.status === "applied" && (typeof job.appliedAt !== "string" || typeof job.confirmation !== "string" || !job.confirmation.trim() || typeof job.jobUrl !== "string" || !job.jobUrl || Number.isNaN(Date.parse(job.appliedAt)))) throw new InputError("Applied jobs require a job URL, valid appliedAt date and confirmation evidence.");
      for (const key of ["jobUrl", "companyUrl", "visaEvidenceUrl", "confirmationUrl"]) if (job[key] && !/^https?:\/\//i.test(job[key])) throw new InputError(`${key} must be an http or https URL.`);
      if (JSON.stringify(job).length > 64000) throw new InputError("A job record is too large.");
      prepared.push({ job, existing });
    }
    const result = [];
    for (const {job, existing} of prepared) {
      const now = new Date().toISOString(); const data = JSON.stringify(job);
      const values = { id: job.id, company: job.company, title: job.title, status: job.status, data, createdAt: existing?.createdAt || now, updatedAt: now };
      if(job.status==="ready_for_review"){
        const inserted=await raw.prepare(`INSERT INTO jobs(id,company,title,status,data,created_at,updated_at)
          SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM requests WHERE id=? AND status='acknowledged')
          AND COALESCE((SELECT json_extract(data,'$.paused') FROM settings WHERE id='schedule'),1)=0
          AND COALESCE((SELECT json_extract(data,'$.status') FROM settings WHERE id='run'),'')!='awaiting_review'
          AND (SELECT COUNT(*) FROM jobs WHERE id!=? AND (json_extract(data,'$.appliedAt') IS NOT NULL OR (status='ready_for_review' AND json_extract(data,'$.review.requestId')=?))) < ?
          AND NOT EXISTS(SELECT 1 FROM jobs WHERE id!=? AND status='ready_for_review' AND json_extract(data,'$.reviewPostingKey')=?)
          AND NOT EXISTS(SELECT 1 FROM submission_keys WHERE canonical_url=? AND job_id!=?)
          ON CONFLICT(id) DO UPDATE SET company=excluded.company,title=excluded.title,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at RETURNING id`).bind(job.id,job.company,job.title,job.status,data,values.createdAt,now,job.review.requestId,job.id,job.review.requestId,Math.min(current!.target,preferences!.totalLimit),job.id,job.reviewPostingKey,job.reviewPostingKey,job.id).first();
        if(!inserted)return json({error:"Review capacity is reserved, the posting is already prepared, or the worker must stop."},409);
      } else if (job.status === "applied") {
        const canonical = canonicalJobUrl(job.jobUrl);
        const saved = await raw.batch([
          raw.prepare("INSERT INTO submission_keys(canonical_url,job_id) VALUES (?,?) ON CONFLICT(canonical_url) DO NOTHING").bind(canonical, job.id),
          raw.prepare(`INSERT INTO jobs(id,company,title,status,data,created_at,updated_at)
            SELECT ?,?,?,?, ?,?,? WHERE EXISTS (SELECT 1 FROM submission_keys WHERE canonical_url=? AND job_id=?)
            AND (EXISTS (SELECT 1 FROM jobs WHERE id=? AND json_extract(data,'$.appliedAt') IS NOT NULL AND length(COALESCE(json_extract(data,'$.confirmation'),'')) > 0) OR (
              EXISTS (SELECT 1 FROM requests WHERE status IN ('acknowledged','pausing')) AND
              (SELECT COUNT(*) FROM jobs WHERE json_extract(data,'$.appliedAt') IS NOT NULL AND length(COALESCE(json_extract(data,'$.confirmation'),'')) > 0) < MIN(
                COALESCE((SELECT json_extract(data,'$.totalLimit') FROM settings WHERE id='preferences'),0),
                COALESCE((SELECT target FROM requests WHERE status IN ('acknowledged','pausing') LIMIT 1),0)
              )))
            ON CONFLICT(id) DO UPDATE SET company=excluded.company,title=excluded.title,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at RETURNING id`).bind(job.id, job.company, job.title, job.status, data, values.createdAt, now, canonical, job.id, job.id),
        ]);
        if (!saved[1].results.length) return json({ error: "Application was not recorded: this posting is already recorded under another id, no worker owns a run, or the application limit was reached.", saved: result.length, jobs: result }, 409);
      } else {
        await db.insert(jobs).values(values).onConflictDoUpdate({ target: jobs.id, set: { company: values.company, title: values.title, status: values.status, data: values.data, updatedAt: now } });
      }
      if (existing?.status !== job.status) await logActivity(`${job.company}: ${job.title} · ${job.status}`, job.status === "applied" ? "success" : job.status === "blocked" ? "warning" : "info", job.id);
      result.push({ id: job.id, status: job.status });
    }
    return json({ saved: result.length, jobs: result });
  } catch (error) { if (error instanceof InputError || error instanceof SyntaxError || error instanceof TypeError) return json({ error: error.message }, 400); return failure(error); }
}
