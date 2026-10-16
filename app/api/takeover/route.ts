import { getRawDb } from "@/db";
import { activeRequest, readSetting } from "@/lib/onboarding";
import { authorize, failure, json, logActivity, readRun } from "@/lib/server";
import { validateTakeover, type Takeover } from "@/lib/takeover";
export async function GET(request:Request){const denied=authorize(request);if(denied)return denied;try{return json({takeover:await readSetting<Takeover>("takeover")});}catch(e){return failure(e);}}
export async function POST(request:Request){
 const denied=authorize(request);if(denied)return denied;
 try{
  const body=await request.json() as Record<string,unknown>;if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid takeover request."},400);const db=getRawDb(),current=await activeRequest(),run=await readRun(),now=new Date().toISOString();
  if(!current)return json({error:"No active batch is available for takeover."},409);
  if(body.action==="request"){
   if(body.workerId!==current.worker_id||body.requestId!==current.id||current.status!=="acknowledged")return json({error:"Only the owning worker can hand off its active batch."},409);
   const existing=await readSetting<Takeover>("takeover");
   if(existing?.requestId===current.id&&existing.status!=="resumed")return json({takeover:existing,alreadyWaiting:true});
   let details;try{details=validateTakeover(body);}catch(e){return json({error:e instanceof Error?e.message:"Invalid takeover details."},400);}
   const job=await db.prepare("SELECT id FROM jobs WHERE id=? AND status='blocked'").bind(details.jobId).first();
   if(!job)return json({error:"Save the affected job as blocked before requesting help."},409);
   const review=await db.prepare("SELECT id FROM jobs WHERE status='ready_for_review' LIMIT 1").first();
   if(review)return json({error:"Hand off prepared forms for manual review before requesting a separate takeover."},409);
   const takeover:Takeover={...details,id:crypto.randomUUID(),requestId:current.id,workerId:current.worker_id!,createdAt:now,status:"waiting"};
   const result=await db.batch([
    db.prepare("INSERT INTO settings(id,data) SELECT 'takeover',? WHERE EXISTS(SELECT 1 FROM requests WHERE id=? AND worker_id=? AND status='acknowledged') AND EXISTS(SELECT 1 FROM settings WHERE id='schedule' AND json_extract(data,'$.paused')=0) AND COALESCE((SELECT json_extract(data,'$.status') FROM settings WHERE id='run'),'') NOT IN ('awaiting_user','resume_pending','awaiting_review') ON CONFLICT(id) DO UPDATE SET data=excluded.data RETURNING id").bind(JSON.stringify(takeover),current.id,current.worker_id),
    db.prepare("INSERT INTO settings(id,data) SELECT 'run',? WHERE EXISTS(SELECT 1 FROM settings WHERE id='takeover' AND json_extract(data,'$.id')=?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify({...run,status:"awaiting_user",message:"Human help needed. Open the takeover panel, resolve the blocker, then request a resume.",lastAgentUpdate:now,nextCheckAt:null}),takeover.id),
    db.prepare("INSERT INTO settings(id,data) SELECT 'schedule',? WHERE EXISTS(SELECT 1 FROM settings WHERE id='takeover' AND json_extract(data,'$.id')=?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify({enabled:false,paused:false,nextRunAt:null}),takeover.id)
   ]);
   if(!result[0].results.length)return json({error:"The batch changed or was paused before takeover."},409);
   await logActivity("Human help requested: "+details.reason,"warning",details.jobId);
   return json({takeover,paused:true});
  }
  if(body.action!=="resume"||!["not_submitted","check_receipt"].includes(String(body.resolution))||body.confirmedByUser!==true)return json({error:"Confirm what happened in the employer form before requesting a resume."},400);
  const saved=await readSetting<Takeover>("takeover");
  if(!saved||saved.id!==body.id||saved.requestId!==current.id)return json({error:"This takeover is no longer current. Refresh the dashboard."},409);
  if(saved.status==="resume_pending"&&run.status==="resume_pending")return json({queued:true,alreadyQueued:true});
  if(saved.status!=="waiting"||run.status!=="awaiting_user"||current.status!=="acknowledged")return json({error:"This batch is paused or already resumed. Refresh the dashboard."},409);
  const resumed={...saved,status:"resume_pending",resolution:body.resolution,resolvedAt:now};
  const result=await db.batch([
   db.prepare("UPDATE settings SET data=? WHERE id='takeover' AND json_extract(data,'$.id')=? AND json_extract(data,'$.status')='waiting' AND EXISTS(SELECT 1 FROM requests WHERE id=? AND status='acknowledged') AND EXISTS(SELECT 1 FROM settings WHERE id='run' AND json_extract(data,'$.status')='awaiting_user') AND EXISTS(SELECT 1 FROM settings WHERE id='schedule' AND json_extract(data,'$.paused')=0) RETURNING id").bind(JSON.stringify(resumed),saved.id,current.id),
   db.prepare("UPDATE settings SET data=? WHERE id='run' AND json_extract(data,'$.status')='awaiting_user' AND EXISTS(SELECT 1 FROM settings WHERE id='takeover' AND json_extract(data,'$.id')=? AND json_extract(data,'$.status')='resume_pending')").bind(JSON.stringify({...run,status:"resume_pending",message:"Resume requested. Waiting for the original worker to recheck this checkpoint and any submission receipts.",lastAgentUpdate:now}),saved.id),
   db.prepare("UPDATE settings SET data=? WHERE id='schedule' AND json_extract(data,'$.paused')=0 AND EXISTS(SELECT 1 FROM settings WHERE id='run' AND json_extract(data,'$.status')='resume_pending')").bind(JSON.stringify({enabled:true,paused:false,nextRunAt:null}))
  ]);
  if(!result[0].results.length)return json({error:"The search changed or was paused. Resume was not queued."},409);
  await logActivity("Owner requested resume of the same application batch. Receipt checks required before retrying.","info",saved.jobId);
  return json({queued:true,requestId:current.id,target:current.target});
 }catch(e){if(e instanceof SyntaxError)return json({error:"Invalid takeover request."},400);return failure(e);}
}
