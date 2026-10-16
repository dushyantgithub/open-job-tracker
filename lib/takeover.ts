export interface Takeover {
 id:string; requestId:string; workerId:string; jobId:string;
 reason:string; checkpoint:string; instructions:string;
 method:"same_browser"|"saved_draft"|"remote_takeover"|"unavailable";
 handoffUrl?:string; expiresAt?:string; createdAt:string;
 status:"waiting"|"resume_pending"|"resumed";
 resolution?:"not_submitted"|"check_receipt"; resolvedAt?:string;
}
export function validateTakeover(input:unknown, now=Date.now()) {
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Provide takeover details.");
 const v=input as Record<string,unknown>;
 for(const key of ["jobId","reason","checkpoint","instructions"])if(typeof v[key]!=="string"||!v[key].trim()||v[key].length>2000)throw Error(`Takeover ${key} is required (maximum 2,000 characters).`);
 if(!["same_browser","saved_draft","remote_takeover","unavailable"].includes(String(v.method)))throw Error("Choose a supported takeover method, or unavailable.");
 if(v.handoffUrl!==undefined){const u=new URL(String(v.handoffUrl));if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)throw Error("Use a credential-free HTTPS handoff URL without query parameters or fragments.");}
 if(["saved_draft","remote_takeover"].includes(String(v.method))&&!v.handoffUrl)throw Error("This takeover method requires a verified private handoff link.");
 if(v.method==="unavailable"&&v.handoffUrl)throw Error("Do not offer a link as a working handoff when takeover is unavailable.");
 if(v.method!=="unavailable"&&(typeof v.expiresAt!=="string"||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=now))throw Error("Provide a future handoff expiry or mark handoff unavailable.");
 if(v.stopped!==true)throw Error("Stop all browser actions before handing control to the owner.");
 return {jobId:v.jobId as string,reason:v.reason as string,checkpoint:v.checkpoint as string,instructions:v.instructions as string,method:v.method as Takeover["method"],...(v.handoffUrl?{handoffUrl:v.handoffUrl as string}:{}),...(v.expiresAt?{expiresAt:v.expiresAt as string}:{})};
}
export const takeoverInstructions=`HUMAN TAKEOVER AND RESUME
At a CAPTCHA, login barrier, missing required answer or other human-only step, stop browser actions and save the affected job as blocked with the exact reason. Call request_takeover with workerId, requestId, jobId, reason, checkpoint (last verified step and whether Submit was attempted), instructions, method (same_browser, saved_draft, remote_takeover, or unavailable), a verified credential-free HTTPS handoffUrl where supported, expiresAt and stopped:true. Never put credentials, tokens, OTPs or sensitive answers in the tracker. Do not solve CAPTCHAs. Verify that this owner can access the exact session or persisted draft; a job posting link does not transfer a form. If the provider cannot offer this, use unavailable and explain the missing capability. No fallback to the owner's computer without authorization.
request_takeover pauses the whole batch atomically and preserves its worker, ID and target. Do not call finish_batch or continue browsing after it succeeds. Tell the owner to use the dashboard's Human help needed panel, then return there and choose Resume. Agents must never invoke the owner /api/takeover resume action. Continue only when claim_batch with the SAME persistent workerId returns the original request and resumeContext. The owner click queues a resume, it does not launch a stopped cloud agent: the configured worker must wake or be continued by the owner.
On resume, read the latest ledger and resumeContext first. Verify the actual browser session, expiry, cleared blocker, all fields and uploads. Check confirmation pages and receipts before retrying any submission, especially resolution=check_receipt; uncertainty must block a retry. Respect the saved submission mode. If the session expired or cannot be recovered, report that truthfully and request help again; do not fabricate a restored form. Preserve observed submission proof, even during a pause.`;
