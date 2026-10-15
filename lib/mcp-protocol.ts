export type McpTool = { name: string; description: string; inputSchema: Record<string,unknown>; annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean } };
export async function mcpResponse(body: unknown, tools: McpTool[], call: (name:string,args:unknown)=>Promise<unknown>) {
  const req = body as {jsonrpc?:unknown;id?:unknown;method?:unknown;params?:{name?:unknown;arguments?:unknown}} | null;
  if (!req || Array.isArray(req) || req.jsonrpc!=="2.0" || typeof req.method!=="string" || (req.id!==undefined && req.id!==null && typeof req.id!=="string" && typeof req.id!=="number")) return {jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid JSON-RPC request."}};
  const id=req.id??null;
  if(req.method.startsWith("notifications/")) return null;
  let result:unknown;
  switch(req.method) {
    case "server/discover": result={supportedVersions:["2026-07-28"],capabilities:{tools:{}}}; break;
    case "initialize": result={protocolVersion:"2026-07-28",capabilities:{tools:{}},serverInfo:{name:"private-job-tracker",version:"1.0.0"},instructions:"Owner-private job tracker. Read get_handoff first. Process only authorized queued or due batches. Never invent confirmations or personal facts."}; break;
    case "ping": result={}; break;
    case "tools/list": result={tools}; break;
    case "tools/call": {
      const name=req.params?.name;
      if(typeof name!=="string" || !tools.some(t=>t.name===name)) return {jsonrpc:"2.0",id,error:{code:-32602,message:"Unknown tool."}};
      try {result=await call(name,req.params?.arguments??{});} catch {result={isError:true,content:[{type:"text",text:"Tool request failed. Check the input and retry; do not assume any application was submitted."}]};}
      break;
    }
    default:return {jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found."}};
  }
  return {jsonrpc:"2.0",id,result};
}
