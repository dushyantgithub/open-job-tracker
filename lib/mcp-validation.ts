import { z } from "zod";
export const workerIdentitySchema=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const runnerSetupSchema=z.object({
 workerId:workerIdentitySchema,
 provider:z.enum(["dot","codex","claude"]),
 executionEnvironment:z.enum(["cloud","local"]),
 mode:z.enum(["manual","scheduled"]),
 browserVerified:z.literal(true),
 resumeFileVerified:z.literal(true),
 scheduleId:z.string().min(1).max(2000).optional(),
 timeZone:z.string().min(1).max(200).optional(),
 nextCheckAt:z.string().datetime().optional(),
}).strict().superRefine((v,ctx)=>{
 if(v.provider==="dot"&&v.executionEnvironment!=="cloud")ctx.addIssue({code:z.ZodIssueCode.custom,message:"A Dot integration must use its cloud environment."});
 if(v.mode==="scheduled"&&(!v.scheduleId||!v.timeZone||!v.nextCheckAt))ctx.addIssue({code:z.ZodIssueCode.custom,message:"A saved schedule ID, timezone and next time are required."});
 if(v.mode==="manual"&&(v.scheduleId||v.timeZone||v.nextCheckAt))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Manual mode must not claim a saved schedule."});
 if(v.nextCheckAt&&Date.parse(v.nextCheckAt)<=Date.now())ctx.addIssue({code:z.ZodIssueCode.custom,message:"Next scheduled check must be in the future."});
 if(v.timeZone){try{new Intl.DateTimeFormat("en",{timeZone:v.timeZone});}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:"Use a valid IANA timezone."});}}
});
