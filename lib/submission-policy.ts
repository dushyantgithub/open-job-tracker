import { takeoverInstructions } from "./takeover.ts";
export type SubmissionMode = "automatic" | "manual_review";
export interface ApplicationReview {
  requestId: string;
  preparedAt: string;
  expiresAt: string;
  method: "same_browser" | "saved_draft" | "remote_takeover";
  handoffUrl?: string;
  instructions: string;
  fieldsComplete: true;
  uploadsComplete: true;
  uploadedFiles: string[];
  summary: string;
}
export function submissionMode(preferences?: {submissionMode?:SubmissionMode}|null): SubmissionMode { return preferences?.submissionMode || "automatic"; }
export function validateReview(value: unknown, now=Date.now()): ApplicationReview {
  if(!value || typeof value!=="object" || Array.isArray(value))throw Error("A prepared application needs review handoff details.");
  const v=value as Record<string,unknown>;
  for(const key of ["requestId","preparedAt","expiresAt","instructions","summary"])if(typeof v[key]!=="string" || !(v[key] as string).trim() || (v[key] as string).length>4000)throw Error(`Review ${key} is required (maximum 4,000 characters).`);
  const prepared=Date.parse(v.preparedAt as string),expires=Date.parse(v.expiresAt as string);
  if(!Number.isFinite(prepared)||prepared>now+60000||!Number.isFinite(expires)||expires<=now||expires<=prepared)throw Error("Review needs a valid preparation time and future session expiry.");
  if(!["same_browser","saved_draft","remote_takeover"].includes(String(v.method)))throw Error("Choose a supported review handoff method.");
  if(v.fieldsComplete!==true||v.uploadsComplete!==true)throw Error("Finish all required fields and verify uploads before marking ready for review.");
  if(!Array.isArray(v.uploadedFiles)||!v.uploadedFiles.length||v.uploadedFiles.length>10||v.uploadedFiles.some(x=>typeof x!=="string"||!x.trim()||x.length>200||/[\\/]/.test(x)))throw Error("Record uploaded file names, not file contents or local paths.");
  if(v.handoffUrl!==undefined){const u=new URL(String(v.handoffUrl));if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)throw Error("Use a private HTTPS handoff URL without credentials, query parameters or fragments. Put navigation instructions in the review note.");}
  if(v.method!=="same_browser"&&!v.handoffUrl)throw Error("Saved drafts and remote takeover require a verified handoff URL.");
  return {requestId:v.requestId as string,preparedAt:v.preparedAt as string,expiresAt:v.expiresAt as string,method:v.method as ApplicationReview["method"],...(v.handoffUrl?{handoffUrl:v.handoffUrl as string}:{}),instructions:v.instructions as string,summary:v.summary as string,fieldsComplete:true,uploadsComplete:true,uploadedFiles:v.uploadedFiles as string[]};
}
export function submissionInstructions(preferences?:{submissionMode?:SubmissionMode}|null){
 return `APPLICATION SUBMISSION MODE: ${submissionMode(preferences)}
These rules override older instructions to apply until a quota is reached. Limits are ceilings, not reasons to submit weak matches. Never promise that applications cannot be flagged by an ATS.
${takeoverInstructions}
COMMON PRECAUTIONS
Use verified resume facts and consistent contact, location and work-authorization answers. Check role fit, salary rules, sponsorship and canonical posting duplicates before each application. Inspect each employer's application instructions and any stated automation policy; record the policy source and uncertainty in notes. Respect explicit restrictions and published limits. Use only normal authorized browser access or an explicitly supported application integration. No proxy rotation, identity/device spoofing, fingerprint masking, CAPTCHA bypass, fabricated human behavior, disposable identities, or attempts to circumvent blocks. Do not disable privacy/security protections. Do not share applicant accounts or browser profiles between users. Work sequentially, honor Retry-After and site limits, and stop that site's work on a security challenge, repeated errors or a block. Record the exact issue; no alternate-account or alternate-network retries. Never resubmit after a timeout until the confirmation page, saved ledger and available receipts resolve whether it was sent. A rejection alone is not evidence of an ATS fraud flag. Record actual evidence, not an invented ATS-risk score.
${submissionMode(preferences)==="manual_review"?`MANUAL REVIEW
The agent must NEVER click Submit, press a key that submits, invoke a submission endpoint, or record an applied status for a new application. Fill fields and upload the approved documents. Verify their displayed filenames and required field completion. Do not answer missing sensitive facts, accept binding terms or solve human-only challenges on the user's behalf. If those prevent completion, mark blocked, not ready_for_review.
Before filling, verify a supported handoff to the exact prepared browser session, an employer-persisted draft accessible to this owner, or a supported cloud remote-takeover interface. An ordinary posting link does not transfer fields, files or cookies. Do not copy browser credentials or promise cloud forms are accessible locally. If handoff is unavailable, record blocked with the missing capability. Never fall back to the user's computer without authorization.
Save status ready_for_review only with jobUrl, resumeUsed, fitSummary and review={requestId,preparedAt,expiresAt,method:same_browser|saved_draft|remote_takeover,handoffUrl?,instructions,fieldsComplete:true,uploadsComplete:true,uploadedFiles:[filenames],summary}. Verify the handoff and describe exactly where the owner can review and click Submit. Use only credential-free HTTPS links without query strings or fragments; never store session tokens. Set a conservative expiry supported by the session/draft evidence; if none is known, use a short review deadline and explain it, without claiming provider-guaranteed persistence. Keep the prepared tab available with the provider's supported handoff mechanism. Do not mark ready from a screenshot or an unfilled posting page. Do not save sensitive answers, government IDs or credentials in review notes.
Prepare at most request.count distinct applications, counting existing ready records and submissions in this request. Deduplicate prepared drafts as well as submissions. Then finish_batch with status awaiting_review; this stops new work and recurring batches while preserving review capacity. Fewer drafts may be handed off if sessions cannot all stay open. If none can be prepared, finish blocked. The owner reviews and submits on the employer's page, then records the actual receipt in the dashboard. Agents must never call /api/review or impersonate this owner action. Never treat opening a review link or clicking a dashboard button as employer submission.`:`FULLY AUTOMATED
After checking all common precautions, fill and submit only within the owner's scope and the platform's allowed workflow. If a site explicitly requires manual submission, record blocked and request user review; do not silently override the selected mode. Use ordinary sessions without trying to conceal automation. Record the checked facts, fit, policy source or uncertainty and any limits in notes before submitting. Cloud execution can still trigger network/device risk checks; switching browsers is not a guarantee. Stop at required human verification or approval. Record applied only after a real confirmation, with the exact documents used. Preserve truthful receipt evidence even if an earlier precaution was missed, and report that omission.`}`;
}
