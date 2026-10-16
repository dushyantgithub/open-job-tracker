"use client";
import { useState } from "react";
import type { Job } from "@/lib/tracker";
export default function ApplicationReview({job,enabled,onSaved}:{job:Job;enabled:boolean;onSaved:()=>void}){
 const [receipt,setReceipt]=useState("");const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const localNow=()=>{const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);};
 const [submittedAt,setSubmittedAt]=useState(localNow);const review=job.review;if(!review)return null;
 const expired=Date.parse(review.expiresAt)<=Date.now();
 async function save(action:"record_submission"|"discard"){
  setBusy(true);setError("");
  try{const response=await fetch("/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:job.id,action,...(action==="record_submission"?{confirmation:receipt,confirmedByUser:confirmed,appliedAt:new Date(submittedAt).toISOString()}: {})})});const data=await response.json() as {error?:string;warning?:string};if(!response.ok)throw Error(data.error||"Could not save review.");if(data.warning)setError(data.warning);onSaved();}catch(e){setError(e instanceof Error?e.message:"Could not save review.");}finally{setBusy(false);}
 }
 return <section className="detail-section application-review"><h3>Review and submit yourself</h3><p>{review.summary}</p><p className="preserve-lines">{review.instructions}</p><dl><div><dt>Uploaded files</dt><dd>{review.uploadedFiles.join(", ")}</dd></div><div><dt>Review by</dt><dd>{new Date(review.expiresAt).toLocaleString()}</dd></div><div><dt>Handoff</dt><dd>{review.method.replaceAll("_"," ")}</dd></div></dl>
 {expired?<p role="status" className="detail-callout">This handoff has expired. Recheck the original form and attachments before submitting. A posting link does not restore a prepared form. You can still record a receipt if you already submitted it.</p>:review.handoffUrl?<a className="button primary" target="_blank" rel="noreferrer" href={review.handoffUrl}>Open prepared application</a>:<p className="detail-callout">Use the browser tab identified above. Its fields and uploads stay in that session; opening the job posting in another browser will not copy them.</p>}
 {!enabled&&<p>Wait for the agent to finish handing off the batch. After pausing, review or discard these drafts before releasing the stopped-agent checkpoint.</p>}
 <p>Review every answer and attachment on the employer page, then click its Submit button yourself. This dashboard does not submit the application.</p>
 <label>Submission time (your local time)<input type="datetime-local" step="1" value={submittedAt} onChange={e=>setSubmittedAt(e.target.value)}/></label>
 <label>Confirmation received<textarea rows={3} maxLength={4000} placeholder="Paste the confirmation message or receipt reference. Do not include passwords or sensitive identifiers." value={receipt} onChange={e=>setReceipt(e.target.value)}/></label>
 <label className="review-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I submitted this application myself and received this confirmation.</label>
 {error&&<p role="alert">{error}</p>}<div className="review-actions"><button className="button primary" disabled={busy||!enabled||!confirmed||!receipt.trim()||!submittedAt} onClick={()=>void save("record_submission")}>Record my submission</button><button className="button secondary" disabled={busy||!enabled} onClick={()=>void save("discard")}>Discard prepared application</button></div></section>;
}
