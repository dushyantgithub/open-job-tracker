import { analyzeResume, InputError } from "@/lib/onboarding-core";
import { activeRequest, settingStatement, setupData } from "@/lib/onboarding";
import { failure, json } from "@/lib/server";
import { getRawDb } from "@/db";
import { extractText, getDocumentProxy } from "unpdf";
const MAX_FILE = 1024 * 1024;
const MAX_BODY = MAX_FILE + 16384;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if ((origin && origin !== new URL(request.url).origin) || (site && !["same-origin", "none"].includes(site))) return json({ error: "Cross-site uploads are not allowed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return json({ error: "Upload a PDF, Markdown or text file." }, 415);
  try {
    if (await activeRequest()) return json({ error: "Pause the active run before replacing your resume." }, 409);
    const reader = request.body?.getReader();
    if (!reader) throw new InputError("Choose a resume file.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BODY) { await reader.cancel(); return json({ error: "The resume must be 1 MB or smaller." }, 413); } chunks.push(value); }
    const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    const form = await new Response(data, { headers: {"content-type": request.headers.get("content-type")!} }).formData();
    const file = form.get("resume");
    if (!(file instanceof File) || !file.size) throw new InputError("Choose a resume file.");
    if (file.size > MAX_FILE) return json({ error: "The resume must be 1 MB or smaller." }, 413);
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    if (!["pdf", "md", "txt"].includes(extension || "")) throw new InputError("Use a PDF, Markdown or text resume.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text: string;
    if (extension === "pdf") {
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new InputError("This file is not a valid PDF.");
      let pdf;
      try {
        pdf = await getDocumentProxy(bytes.slice(), { useSystemFonts: false });
        if (pdf.numPages > 20) throw new InputError("Use a resume with 20 pages or fewer.");
        text = (await extractText(pdf, { mergePages: true })).text;
      } catch (error) { if (error instanceof InputError) throw error; throw new InputError("This PDF could not be read. Use an unlocked text PDF or a Markdown/text copy."); }
      finally { if (pdf) await pdf.cleanup(); }
    } else {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new InputError("Save the text resume using UTF-8 encoding."); }
      if (text.includes("\0")) throw new InputError("The file contains binary data. Use a text resume.");
    }
    text = text.replace(/\r\n?/g, "\n").trim();
    if (text.length < 80) throw new InputError("The resume has too little readable text. For a scanned PDF, upload a text copy.");
    if (text.length > 100000) throw new InputError("The resume contains too much text. Use a shorter file.");
    let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const resume = { id: crypto.randomUUID(), fileName: file.name.replace(/[\u0000-\u001f/\\]/g, "_").slice(-180), mimeType: extension === "pdf" ? "application/pdf" : "text/plain", size: file.size, uploadedAt: new Date().toISOString(), textLength: text.length, text, base64: btoa(binary) };
    // Resume content never enters the public tracker payload or application log.
    await getRawDb().batch([settingStatement("resume", resume), settingStatement("resume_analysis", analyzeResume(text))]);
    return json(await setupData(), 201);
  } catch (error) { if (error instanceof InputError || error instanceof TypeError) return json({ error: error.message }, 400); return failure(error); }
}
