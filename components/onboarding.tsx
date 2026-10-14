"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Globe2, Loader2, Plus, ShieldCheck, Upload } from "lucide-react";
import { profile } from "@/lib/profile";

export type SearchPreferences = {
  selectedRoles: string[];
  locations: ("EU" | "US" | "IN" | "AU" | "CA")[];
  indiaCities: ("Bengaluru" | "Pune" | "Mumbai")[];
  frequency: "manual" | "daily" | "weekly";
  batchLimit: number;
  totalLimit: number;
  applicantFacts?: string;
};
export type SetupState = {
  configured: boolean;
  resume: { id: string; fileName: string; size: number; uploadedAt: string; textLength: number } | null;
  analysis: { method: "local_keywords"; suggestedRoles: { title: string; evidence: string[] }[]; skills: string[]; summary: string } | null;
  preferences: SearchPreferences | null;
  worker: { status: string; lastSeenAt: string | null };
};
const emptyPreferences: SearchPreferences = { selectedRoles: [], locations: [], indiaCities: [], frequency: "manual", batchLimit: 10, totalLimit: 25, applicantFacts: "" };
export const locationLabels: Record<string, string> = { EU: "European Union", US: "United States", IN: "India", AU: "Australia", CA: "Canada" };
const steps = ["Your resume", "Suitable roles", "Where to apply", "Schedule & limits"];
async function readResponse<T = { message?: string }>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: unknown };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request could not be completed.");
  return data;
}
export default function Onboarding({ onComplete, onCancel }: { onComplete: (message: string) => void; onCancel?: () => void }) {
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [preferences, setPreferences] = useState<SearchPreferences>(emptyPreferences);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [queuedMessage, setQueuedMessage] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await readResponse<SetupState>(await fetch("/api/onboarding", { cache: "no-store" })) as SetupState;
      setSetup(result);
      setPreferences(result.preferences || { ...emptyPreferences, selectedRoles: result.analysis?.suggestedRoles.map(role => role.title) || [] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your setup."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 1024 * 1024) { setError("Choose a resume no larger than 1 MiB."); return; }
    if (!/\.(pdf|md|txt)$/i.test(file.name)) { setError("Choose a PDF, Markdown, or text resume."); return; }
    setBusy("upload"); setError("");
    try {
      const body = new FormData(); body.append("resume", file);
      const result = await readResponse<SetupState>(await fetch("/api/onboarding/resume", { method: "POST", body })) as SetupState;
      setSetup(result);
      setPreferences(previous => ({ ...previous, selectedRoles: result.analysis?.suggestedRoles.map(role => role.title) || [] }));
      setStep(1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read this resume."); }
    finally { setBusy(""); }
  }
  function toggleRole(role: string) {
    setPreferences(previous => ({ ...previous, selectedRoles: previous.selectedRoles.includes(role) ? previous.selectedRoles.filter(value => value !== role) : [...previous.selectedRoles, role] }));
  }
  function addRole() {
    const value = customRole.trim();
    if (!value) return;
    if (!preferences.selectedRoles.some(role => role.toLowerCase() === value.toLowerCase())) setPreferences(previous => ({ ...previous, selectedRoles: [...previous.selectedRoles, value] }));
    setCustomRole("");
  }
  const valid = [Boolean(setup?.resume), preferences.selectedRoles.length > 0, preferences.locations.length > 0 && (!preferences.locations.includes("IN") || preferences.indiaCities.length > 0), Number.isInteger(preferences.batchLimit) && preferences.batchLimit >= 1 && preferences.batchLimit <= 100 && Number.isInteger(preferences.totalLimit) && preferences.totalLimit >= preferences.batchLimit && preferences.totalLimit <= 1000];
  async function saveAndStart() {
    if (!valid.every(Boolean)) { setError("Complete each step and keep the total limit at least as large as the per-run limit."); return; }
    setBusy("save"); setError("");
    try {
      const result = await readResponse<SetupState>(await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) })) as SetupState;
      setSetup(result);
      const started = await readResponse(await fetch("/api/onboarding/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      setQueuedMessage(started.message || "Your search is saved and queued for a connected worker.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your search."); }
    finally { setBusy(""); }
  }
  const roleOptions = [...new Set([...(setup?.analysis?.suggestedRoles.map(role => role.title) || []), ...preferences.selectedRoles])];
  return <main className="setup-shell"><header className="setup-header"><a href="/" className="brand"><span className="brand-mark">j<span/></span><span>{profile.brandName}<span className="brand-label">YOUR PRIVATE CAREER WORKSPACE</span></span></a><span className="setup-private"><ShieldCheck size={15}/> Your own copy</span></header>
    <section className="setup-intro"><div className="eyebrow">SET YOUR DIRECTION</div><h1>A search that starts with you.</h1><p>Add your resume, review suggested roles, then choose where and how often to apply.</p></section>
    {loading ? <div className="setup-loading"><Loader2 className="spin" size={24}/><p>Loading your private setup...</p></div> : queuedMessage ? <section className="setup-success"><CheckCircle2 size={34}/><h2>Your search is queued.</h2><p>{queuedMessage}</p><p>Submission results will appear only when your configured worker records a confirmation. You can review its progress in Activity log.</p><button className="button primary" onClick={() => onComplete(queuedMessage)}>Open dashboard <ArrowRight size={16}/></button></section> : <div className="setup-layout"><nav className="setup-steps" aria-label="Setup steps">{steps.map((label,index) => <button key={label} className={step === index ? "current" : ""} onClick={() => { setStep(index); setError(""); }} aria-current={step === index ? "step" : undefined}><span>{valid[index] ? <Check size={14}/> : index + 1}</span>{label}</button>)}<p>Resume suggestions use local text matching. Review them before starting. No applicant facts are invented.</p></nav><section className="setup-card">
      {error && <div className="notice error-notice" role="alert"><span>{error}</span>{!setup && <button onClick={() => void load()}>Retry</button>}</div>}
      {step === 0 && <><div className="setup-section-icon"><FileText size={23}/></div><h2>Start with your resume</h2><p className="setup-description">Upload a text-based PDF, Markdown, or TXT file. The text is stored in this private copy and used to suggest suitable role types.</p><label className={`resume-drop ${busy ? "disabled" : ""}`}><Upload size={25}/><strong>{busy === "upload" ? "Reading your resume..." : setup?.resume ? "Replace your resume" : "Choose your resume"}</strong><span>PDF, MD or TXT · Up to 1 MiB</span><input type="file" accept=".pdf,.md,.txt" disabled={Boolean(busy)} onChange={event => void upload(event.target.files?.[0])}/></label>{setup?.resume && <div className="resume-status"><CheckCircle2 size={17}/><div><strong>{setup.resume.fileName}</strong><span>{setup.resume.textLength.toLocaleString()} characters extracted</span></div></div>}<p className="setup-hint">Scanned PDFs may need a text version. Keep your resume out of a public repository. This step does not send applications.</p></>}
      {step === 1 && <><div className="setup-section-icon"><FileText size={23}/></div><h2>Review suitable roles</h2><p className="setup-description">Suggestions come from the experience and skills found in your resume. Keep the roles that fit, remove others, or add your own.</p>{setup?.analysis?.summary && <p className="analysis-summary">{setup.analysis.summary}</p>}<div className="role-options">{roleOptions.map(role => <label className={`role-option ${preferences.selectedRoles.includes(role) ? "checked" : ""}`} key={role}><input type="checkbox" checked={preferences.selectedRoles.includes(role)} onChange={() => toggleRole(role)}/><span><strong>{role}</strong>{setup?.analysis?.suggestedRoles.find(item => item.title === role)?.evidence.map(evidence => <small key={evidence}>{evidence}</small>)}</span></label>)}</div>{!roleOptions.length && <p className="setup-hint">No role types were suggested yet. Upload a resume or enter a role below.</p>}<div className="custom-role"><input aria-label="Add role type" placeholder="Add a role type..." value={customRole} maxLength={120} onChange={event => setCustomRole(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addRole(); } }}/><button className="button secondary" onClick={addRole} disabled={!customRole.trim()}><Plus size={15}/> Add</button></div>{Boolean(setup?.analysis?.skills.length) && <p className="setup-hint">Skills found: {setup?.analysis?.skills.join(", ")}</p>}</>}
      {step === 2 && <><div className="setup-section-icon"><Globe2 size={23}/></div><h2>Where would you like to work?</h2><p className="setup-description">Choose one or more locations. Your worker must separately verify work authorization, sponsorship and any language requirements.</p><div className="location-options">{Object.entries(locationLabels).map(([value,label]) => <label key={value} className={`location-option ${preferences.locations.includes(value as SearchPreferences["locations"][number]) ? "checked" : ""}`}><input type="checkbox" checked={preferences.locations.includes(value as SearchPreferences["locations"][number])} onChange={() => setPreferences(previous => ({ ...previous, locations: previous.locations.includes(value as SearchPreferences["locations"][number]) ? previous.locations.filter(item => item !== value) : [...previous.locations, value as SearchPreferences["locations"][number]] }))}/><span>{label}</span></label>)}</div>{preferences.locations.includes("IN") && <fieldset className="india-city-options"><legend>Choose cities in India</legend><p>This version supports these three India city selections.</p>{([['Bengaluru','Bangalore / Bengaluru'],['Pune','Pune'],['Mumbai','Mumbai']] as const).map(([value,label]) => <label key={value}><input type="checkbox" checked={preferences.indiaCities.includes(value)} onChange={() => setPreferences(previous => ({ ...previous, indiaCities: previous.indiaCities.includes(value) ? previous.indiaCities.filter(city => city !== value) : [...previous.indiaCities,value] }))}/>{label}</label>)}</fieldset>}<p className="setup-hint">Selecting a location does not assert that you can legally work there. Supply those facts to your worker before any application is submitted.</p></>}
      {step === 3 && <><div className="setup-section-icon"><Globe2 size={23}/></div><h2>Set a pace and a clear limit</h2><p className="setup-description">These settings guide your configured worker. The dashboard records the queue and progress; a worker is required to research and submit applications.</p><div className="schedule-options">{([['manual','Manual','Only when you queue a run'],['daily','Daily','Ask the worker to check each day'],['weekly','Weekly','Ask the worker to check each week']] as const).map(([value,label,hint]) => <label className={preferences.frequency === value ? "checked" : ""} key={value}><input type="radio" name="frequency" checked={preferences.frequency === value} onChange={() => setPreferences(previous => ({ ...previous, frequency: value }))}/><span><strong>{label}</strong><small>{hint}</small></span></label>)}</div><div className="limit-grid"><label>Applications per run<input type="number" min={1} max={100} value={preferences.batchLimit} onChange={event => setPreferences(previous => ({ ...previous, batchLimit: Number(event.target.value) }))}/><span>Between 1 and 100</span></label><label>Total application cap<input type="number" min={preferences.batchLimit} max={1000} value={preferences.totalLimit} onChange={event => setPreferences(previous => ({ ...previous, totalLimit: Number(event.target.value) }))}/><span>Across this saved search, up to 1,000</span></label></div><label className="applicant-facts">Application facts <span className="optional-label">Optional</span><textarea value={preferences.applicantFacts || ""} maxLength={8000} rows={6} onChange={event => setPreferences(previous => ({ ...previous, applicantFacts: event.target.value }))} placeholder="Add only verified facts the worker may use in applications."/><span>Work authorization, sponsorship needs, languages, notice period and salary preferences. Only include facts you know.</span><small>{(preferences.applicantFacts || "").length.toLocaleString()} / 8,000 characters. Saved with this private search and passed to the worker. It cannot see your other Codex chats.</small></label><div className="worker-note"><ShieldCheck size={18}/><div><strong>Worker: {(setup?.worker.status || "not connected").replaceAll("_", " ")}</strong><p>{setup?.worker.lastSeenAt ? `Last seen ${new Date(setup.worker.lastSeenAt).toLocaleString()}. ` : "No worker heartbeat received. "}Save and start queues a run. Applications begin when an authorized worker picks it up.</p></div></div><p className="setup-hint">Use your own resume facts and instructions. A worker should stop at unknown required facts, login barriers, or actions that need your confirmation.</p></>}
      <div className="setup-actions"><div>{step > 0 ? <button className="button secondary" onClick={() => setStep(previous => previous - 1)} disabled={Boolean(busy)}><ArrowLeft size={15}/> Back</button> : onCancel ? <button className="button secondary" onClick={onCancel}>Cancel</button> : null}</div>{step < 3 ? <button className="button primary" onClick={() => { setStep(previous => previous + 1); setError(""); }} disabled={!valid[step] || Boolean(busy)}>Continue <ArrowRight size={15}/></button> : <button className="button primary" onClick={() => void saveAndStart()} disabled={!valid.every(Boolean) || Boolean(busy)}>{busy === "save" ? <Loader2 size={16} className="spin"/> : <Check size={16}/>} Save and start</button>}</div>
    </section></div>}
    <footer className="setup-footer"><ShieldCheck size={13}/> Keep this copy local or behind a single-owner authentication gate.</footer>
  </main>;
}
