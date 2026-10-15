import { authorize, json } from "@/lib/server";
import { mcpResponse } from "@/lib/mcp-protocol";
import { callMcpTool, mcpTools } from "@/lib/mcp-tools";
// Sites dispatch authenticates the caller. This endpoint MUST remain owner-private.
// It accepts only registered tools, never SQL, arbitrary URLs or arbitrary API paths.
export async function POST(request:Request) {
 const denied=authorize(request);if(denied)return denied;
 if(Number(request.headers.get("content-length")||0)>1_000_000)return json({error:"Request too large."},413);
 try {const response=await mcpResponse(await request.json(),mcpTools,(name,args)=>callMcpTool(name,args,request));return response===null?new Response(null,{status:202}):json(response);}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON."}},400);}
}
