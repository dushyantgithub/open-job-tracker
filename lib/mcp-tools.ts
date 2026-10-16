import { submissionInstructions } from "@/lib/submission-policy";
import { salarySearchInstructions } from "@/lib/salary-preferences";
import { sourceSearchInstructions } from "@/lib/job-sources";
import { z } from "zod";
import { GET as dataGET } from "@/app/api/data/route";
import { POST as jobsPOST } from "@/app/api/jobs/route";
import { POST as workerPOST } from "@/app/api/worker/route";
import { POST as activityPOST } from "@/app/api/activity/route";
import { activeRequest, readSetting, setupData, writeSetting, type ResumeData } from "@/lib/onboarding";
import { agentProtocol } from "@/lib/agent-guide";
import { canonicalJobUrl } from "@/lib/onboarding-core";
import type { TrackerData } from "@/lib/tracker";
import type { McpTool } from "@/lib/mcp-protocol";
import { runnerSetupSchema, workerIdentitySchema } from "@/lib/mcp-validation";

const object=(properties:Record<string,unknown>={},required:string[]=[])=>({type:"object",properties,required,additionalProperties:false});
const string={type:"string",minLength:1,maxLength:2000};
const workerId={type:"string",pattern:"^[a-zA-Z0-9_-]{1,128}$"};
const requestId={type:"string",minLength:1,maxLength:200};
const ownership={workerId,requestId};
function tool(name:string,description:string,inputSchema:Record<string,unknown>,readOnly=true):McpTool {
 return {name,description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:false}};
}
export const mcpTools:McpTool[]=[
 tool("get_handoff","Read this copy's uploaded resume text, saved preferences, supplied applicant facts and agent protocol. No bundled applicant data, queue claim or submission.",object()),
 tool("get_tracker_state","Read verified total, queue, run state, recent activity and any recorded runner setup. Does not start work or prove browser access.",object()),
 tool("list_jobs","Read paginated application records. Check company and canonical posting URL for duplicates before submitting.",object({offset:{type:"integer",minimum:0},limit:{type:"integer",minimum:1,maximum:50},company:string,id:string,jobUrl:string})),
 tool("get_resume","Read this owner's uploaded original resume as metadata/base64 and an embedded MCP resource. Save privately with authorized file tools. Does not verify cloud file upload capability.",object()),
 tool("claim_batch","Atomically claim one authorized queued or due batch using a persistent worker ID. This mutation starts work; never call it just to test a connection. Null request means no work.",object({workerId},["workerId"]),false),
 tool("heartbeat","Check ownership and pause state during a claimed batch. If paused is true, stop submitting. Keep heartbeats about every 15 seconds while active.",object(ownership,["workerId","requestId"]),false),
 tool("finish_batch","Finish the owned batch as completed only when its verified target is met, awaiting_review for prepared manual forms, otherwise blocked with a truthful reason. Preserves pause and schedule rules.",object({...ownership,status:{type:"string",enum:["completed","blocked","awaiting_review"]},message:{type:"string",minLength:1,maxLength:1000}},["workerId","requestId","status","message"]),false),
 tool("pause_search","Pause scheduling and ask active work to stop. Does not cancel an external Dot/Claude schedule or recall already submitted forms. Only call at the owner's request.",object(),false),
 tool("record_jobs","Save reviewed roles and observed submission evidence under the active request's owning worker. Uses database deduplication, immutable proof and saved batch/total caps. Record first discoverySource, discoveryUrl and discoveredAt separately from application portal. Never submits employer forms.",object({...ownership,jobs:{type:"array",minItems:1,maxItems:25,items:{type:"object",properties:{id:{type:"string",minLength:1,maxLength:200},company:string,title:string,status:{type:"string",enum:["discovered","shortlisted","preparing","ready_for_review","applied","blocked","skipped","rejected","withdrawn"]},jobUrl:string,discoverySource:{type:"string",minLength:1,maxLength:100},discoveryUrl:{type:"string",format:"uri",maxLength:4000},discoveredAt:{type:"string",format:"date-time"},appliedAt:{type:"string"},confirmation:{type:"string"}},required:["id"],additionalProperties:true}}},["workerId","requestId","jobs"]),false),
 tool("record_activity","Write a concise factual progress or harmless connection-test note. Also log each selected portal check with request ID, portal, timestamp, search URL and outcome, including access blockers. Does not alter application counts or mark runner setup ready.",object({message:{type:"string",minLength:1,maxLength:1000}},["message"]),false),
 tool("record_runner_setup","Record the agent's assertion of verified browser/file access and, for scheduled mode, an actual saved schedule ID, timezone and next run. Does not create or independently verify a schedule or start a batch.",object({workerId,provider:{type:"string",enum:["dot","codex","claude"]},executionEnvironment:{type:"string",enum:["cloud","local"]},mode:{type:"string",enum:["manual","scheduled"]},browserVerified:{type:"boolean",const:true},resumeFileVerified:{type:"boolean",const:true},scheduleId:string,timeZone:string,nextCheckAt:{type:"string",format:"date-time"}},["workerId","provider","executionEnvironment","mode","browserVerified","resumeFileVerified"]),false),
];
const empty=z.object({}).strict();
const id=z.string().min(1).max(200);
async function state(){const r=await dataGET();if(!r.ok)throw Error("Tracker state is unavailable.");return await r.json() as TrackerData;}
async function invoke(fn:(r:Request)=>Promise<Response>,request:Request,path:string,body:unknown) {
 const r=await fn(new Request(new URL(path,request.url),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
 const value=await r.json();if(!r.ok)throw Error((value as {error?:string}).error||"Tracker rejected this operation.");return value;
}
export async function callMcpTool(name:string,raw:unknown,request:Request) {
 try {
  let value:unknown;
  switch(name) {
   case "get_handoff":{
    empty.parse(raw);const [setup,resume]=await Promise.all([setupData(),readSetting<ResumeData>("resume")]);
    value={...setup,resumeText:resume?.text??null,protocol:agentProtocol,submissionInstructions:submissionInstructions(setup.preferences),searchInstructions:sourceSearchInstructions(setup.preferences?.searchPortals),salaryInstructions:salarySearchInstructions(setup.preferences || {}),mcpInstructions:"Use claim_batch, heartbeat, record_jobs and finish_batch with the same workerId/requestId. claim_batch does not return raw resume bytes or the entire ledger: use get_resume and list_jobs. Verify tools before claiming; do not invent applicant facts or a saved schedule. No external URL fetch or SQL tool is exposed."};break;
   }
   case "get_tracker_state":{
    empty.parse(raw);const [d,runnerSetup]=await Promise.all([state(),readSetting("runner_setup")]);
    value={run:d.run,requests:d.requests,verifiedTotal:d.verifiedTotal,trackedRoles:d.jobs.length,activity:d.activity.slice(0,10),runnerSetup,serverTime:d.serverTime};break;
   }
   case "list_jobs":{
    const a=z.object({offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(25),company:z.string().min(1).max(2000).optional(),id:id.optional(),jobUrl:z.string().url().optional()}).strict().parse(raw);
    let rows=(await state()).jobs;
    if(a.company)rows=rows.filter(j=>j.company.toLowerCase().includes(a.company!.toLowerCase()));
    if(a.id)rows=rows.filter(j=>j.id===a.id);
    if(a.jobUrl)rows=rows.filter(j=>j.jobUrl&&canonicalJobUrl(j.jobUrl)===canonicalJobUrl(a.jobUrl!));
    rows.sort((a,b)=>a.id.localeCompare(b.id));value={jobs:rows.slice(a.offset,a.offset+a.limit),total:rows.length,nextOffset:a.offset+a.limit<rows.length?a.offset+a.limit:null};break;
   }
   case "get_resume":{
    empty.parse(raw);const resume=await readSetting<ResumeData>("resume");if(!resume)throw Error("Upload your own resume through the dashboard first.");
    return {content:[{type:"text",text:JSON.stringify({fileName:resume.fileName,mimeType:resume.mimeType,base64:resume.base64,byteLength:resume.size})},{type:"resource",resource:{uri:`resume://owner/${encodeURIComponent(resume.id)}`,mimeType:resume.mimeType,blob:resume.base64}}]};
   }
   case "claim_batch":{
    const a=z.object({workerId:workerIdentitySchema}).strict().parse(raw);
    const result=await invoke(workerPOST,request,"/api/worker",{action:"tick",...a}) as Record<string,unknown>;
    // Read original resume and paginated ledger explicitly; keep claim responses small.
    const {resume:_resume,jobs:_jobs,...claim}=result;value=claim;break;
   }
   case "heartbeat":{
    const a=z.object({workerId:workerIdentitySchema,requestId:id}).strict().parse(raw);value=await invoke(workerPOST,request,"/api/worker",{action:"heartbeat",...a});break;
   }
   case "finish_batch":{
    const a=z.object({workerId:workerIdentitySchema,requestId:id,status:z.enum(["completed","blocked","awaiting_review"]),message:z.string().min(1).max(1000)}).strict().parse(raw);value=await invoke(workerPOST,request,"/api/worker",{action:"finish",...a});break;
   }
   case "pause_search":empty.parse(raw);value=await invoke(workerPOST,request,"/api/worker",{action:"pause"});break;
   case "record_jobs":{
    const a=z.object({workerId:workerIdentitySchema,requestId:id,jobs:z.array(z.object({id}).passthrough()).min(1).max(25)}).strict().parse(raw);
    const current=await activeRequest();
    if(!current||current.id!==a.requestId||current.worker_id!==a.workerId||!["acknowledged","pausing"].includes(current.status))throw Error("This worker does not own the active request. Do not retry an uncertain submission automatically.");
    value=await invoke(jobsPOST,request,"/api/jobs",a.jobs);break;
   }
   case "record_activity":{
    const a=z.object({message:z.string().min(1).max(1000)}).strict().parse(raw);value=await invoke(activityPOST,request,"/api/activity",{...a,type:"info"});break;
   }
   case "record_runner_setup":{
    const a=runnerSetupSchema.parse(raw);const setup={...a,reportedAt:new Date().toISOString(),verificationSource:"agent_assertion"};
    await writeSetting("runner_setup",setup);value={runnerSetup:setup,note:"Recorded the agent's assertion only. No schedule, application request or worker process was created."};break;
   }
   default:throw Error("Unknown tool.");
  }
  return {content:[{type:"text",text:JSON.stringify(value)}]};
 } catch(error) {
  const message=error instanceof z.ZodError?"Invalid tool arguments. Follow the tool's input schema.":error instanceof Error?error.message:"Tracker request failed.";
  return {isError:true,content:[{type:"text",text:message}]};
 }
}
