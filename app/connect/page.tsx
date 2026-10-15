"use client";
import { useEffect, useState } from "react";
import { agentPrompt, type AgentProvider } from "@/lib/agent-guide";
const providers: Record<AgentProvider, { name: string; description: string; guide: string }> = {
  dot: { name: "ChatGPT Dot", description: "Your Dot works in its own cloud browser. Requires an owner-private hosted copy and its connected dashboard plugin. Availability and permissions depend on your account.", guide: "DOTS-WORKFLOW.md" },
  codex: { name: "ChatGPT / Codex", description: "Use the included Codex CLI worker or a capable agent session. The local worker uses the computer where you start it.", guide: "GPT-WORKFLOW.md" },
  claude: { name: "Claude", description: "Use Claude Code with authorized browser tools and the shared queue protocol. This is a guided integration, not a bundled Claude daemon.", guide: "CLAUDE-WORKFLOW.md" },
};
export default function Connect() {
  const [provider,setProvider] = useState<AgentProvider>("dot");
  const [origin,setOrigin] = useState("");
  const [copied,setCopied] = useState(false);
  const [copyError,setCopyError] = useState("");
  useEffect(()=>setOrigin(window.location.origin),[]);
  let prompt="", error="";
  if(origin) { try { prompt=agentPrompt(provider,origin); } catch(e) { error=e instanceof Error?e.message:"Check your private deployment URL."; } }
  async function copy() { try { await navigator.clipboard.writeText(prompt); setCopied(true); setCopyError(""); } catch { setCopyError("Select and copy the message below."); } }
  return <main className="setup-shell"><header className="setup-header"><a href="/">← Dashboard and resume setup</a><span className="setup-private">Your own private copy</span></header>
    <section className="setup-card" style={{maxWidth:840,margin:"32px auto"}}>
      <h1>Connect your agent</h1><p>Choose how your applications run. These instructions do not install tools, start applications or create a schedule.</p>
      <label htmlFor="agent-provider">Your agent</label><select id="agent-provider" value={provider} onChange={e=>{setProvider(e.target.value as AgentProvider);setCopied(false);setCopyError("");}} style={{display:"block",width:"100%",margin:"12px 0",padding:12}}>{Object.entries(providers).map(([key,value])=><option key={key} value={key}>{value.name}</option>)}</select>
      <p>{providers[provider].description}</p><p><a href="https://github.com/dushyantgithub/open-job-tracker/blob/main/docs/MCP-INTEGRATION.md" target="_blank" rel="noreferrer">MCP connection and troubleshooting guide</a>. Each deployed copy creates its own personal plugin. Use the one belonging to your private dashboard.</p>
      <ol style={{paddingLeft:24,margin:"20px 0",lineHeight:1.8}}><li>Install your own copy and finish the resume and search setup.</li><li>On Sites, install this copy’s dashboard plugin under Plugins → Personal → Created by you. Read the provider guide and verify its browser and private access requirements.</li><li>Send the message below to your agent. Have it verify its tools before claiming a queued run.</li><li>Review confirmation evidence in the dashboard. Pause before switching agents.</li></ol>
      <p><a href={`https://github.com/dushyantgithub/open-job-tracker/blob/main/docs/${providers[provider].guide}`} target="_blank" rel="noreferrer">Step-by-step provider guide</a> · <a href="/api/agent-guide">Instructions for your agent</a></p>
      {error?<p role="status" className="notice">{error}</p>:<><button className="button primary" onClick={copy} disabled={!prompt}>{copied?"Message copied":"Copy setup message"}</button><label htmlFor="agent-message" style={{display:"block",marginTop:20}}>Message for your agent</label><textarea id="agent-message" readOnly value={prompt} style={{width:"100%",minHeight:340,padding:16,marginTop:8,font:"inherit",border:"1px solid #cbd5e1",borderRadius:12}}/></>}
      {copyError&&<p role="status">{copyError}</p>}
      <p style={{marginTop:20}}>The dashboard's worker status reports API heartbeats, not verified browser access. Hosted copies must protect every page and API with owner-only authentication. Provider usage limits still apply.</p>
    </section></main>;
}
