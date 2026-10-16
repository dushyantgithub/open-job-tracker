import { getRawDb } from "@/db";
import { authorize, json, failure, readRun } from "@/lib/server";
import { activeRequest, appliedTotal } from "@/lib/onboarding";
import { saveJobs } from "@/lib/job-writes";
import { POST as workerPOST } from "@/app/api/worker/route";
import type { Job } from "@/lib/tracker";
export async function POST(request:Request){
 const denied=authorize(request);if(denied)return denied;
 try{
  const body=await request.json() as {id?:string;action?:string;confirmation?:string;appliedAt?:string;confirmedByUser?:boolean};
  if(typeof body.id!=="string" || !["record_submission","discard"].includes(body.action||""))return json({error:"Choose a prepared application and action."},400);
  const row=await getRawDb().prepare("SELECT data FROM jobs WHERE id=?").bind(body.id).first<{data:string}>();
  const job:Job|null=row?JSON.parse(row.data):null;
  if(!job?.review)return json({error:"This application has no prepared review."},409);
  if(job.appliedAt&&job.confirmation)return json({alreadyRecorded:true});
  const current=await activeRequest();
  if(!current||current.id!==job.review.requestId||!["acknowledged","pausing"].includes(current.status)||!["awaiting_review","paused"].includes((await readRun()).status))return json({error:"Wait for the agent to hand off this batch before recording a review. Paused drafts can still be reviewed or discarded before releasing the checkpoint."},409);
  if(job.status!=="ready_for_review")return json({error:"This application is no longer awaiting review."},409);
  let patch:Partial<Job>={id:job.id,status:"skipped",reason:"Owner discarded the prepared application without submitting."};
  if(body.action==="record_submission"){
   if(body.confirmedByUser!==true||typeof body.confirmation!=="string"||!body.confirmation.trim()||body.confirmation.length>4000||typeof body.appliedAt!=="string"||!Number.isFinite(Date.parse(body.appliedAt))||Date.parse(body.appliedAt)>Date.now()+60000||Date.parse(body.appliedAt)<Date.parse(job.review.preparedAt))return json({error:"Confirm you submitted it, and enter the actual receipt and submission time after preparation."},400);
   patch={id:job.id,status:"applied",confirmation:body.confirmation.trim(),appliedAt:new Date(body.appliedAt).toISOString(),userSubmittedAt:new Date().toISOString()};
  }
  const saved=await saveJobs(new Request(new URL("/api/jobs",request.url),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}),true);
  if(!saved.ok)return saved;
  const remaining=await getRawDb().prepare("SELECT COUNT(*) n FROM jobs WHERE status='ready_for_review' AND json_extract(data,'$.review.requestId')=?").bind(current.id).first<{n:number}>();
  const total=await appliedTotal();
  if(!remaining?.n||total>=current.target){
   const finished=await workerPOST(new Request(new URL("/api/worker",request.url),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"finish",workerId:current.worker_id,requestId:current.id,status:total>=current.target?"completed":"blocked",message:total>=current.target?"Manual review completed with owner-recorded submission receipts.":"Prepared applications reviewed. The submission target was not reached; queue another batch when ready."})}));
   if(!finished.ok)return json({saved:true,warning:"Receipt saved, but batch completion needs attention."});
  }
  return json({saved:true,remaining:remaining?.n||0,verifiedTotal:total});
 }catch(error){if(error instanceof SyntaxError)return json({error:"Invalid review details."},400);return failure(error);}
}
