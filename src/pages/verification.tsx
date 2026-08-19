import { useRef, useState } from "react";
import {
  useDB, cx, Badge, Btn, ConfidenceDial, Field, Ic, JOB_STATUS, KV, ProgressBar, Stamp, ToastMsg, toast, inputCls,
} from "../components/ui";
import {
  currentUser, uploadDocument, setJobStatus, fmtDate, fmtTime, relTime,
  type VerificationJob, type CheckState,
} from "../lib/data";

const DOC_TYPES = ["Sale Deed", "Pattadar Passbook", "Encumbrance Certificate", "Mutation / Revenue Record", "Layout Approval", "ID Proof"];

export function VerificationDetail({ jobId }: { jobId: string }) {
  const { db } = useDB();
  const me = currentUser();
  const job = db.jobs.find((j) => j.id === jobId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [notes, setNotes] = useState(job?.reviewerNotes ?? "");

  if (!job) {
    return (
      <div className="p-10 text-center text-moss-500">Verification file not found. <Btn variant="outline" className="ml-3" onClick={() => history.back()}>Go back</Btn></div>
    );
  }
  const prop = db.properties.find((p) => p.id === job.propertyId)!;
  const docs = db.documents.filter((d) => d.jobId === job.id);
  const isAdmin = me?.role === "admin";
  const canUpload = !me || me.role === "customer" || isAdmin;
  const meta = JOB_STATUS[job.status];
  const fails = job.findings.filter((f) => f.state === "fail");
  const warns = job.findings.filter((f) => f.state === "warn");
  const passes = job.findings.filter((f) => f.state === "pass");

  const onFile = (file: File | null) => {
    if (!file) return;
    const okType = /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!okType) { toast("Only PDF, PNG or JPG documents are accepted.", "bad"); return; }
    if (file.size > 10 * 1024 * 1024) { toast("File exceeds the 10 MB limit.", "bad"); return; }
    uploadDocument(job.id, file.name, docType, Math.max(1, Math.round(file.size / 1024)), me?.name ?? "Guest");
    toast(`Uploaded — routed to ${db.providers.ocrOutage ? "Tesseract fallback" : "Qwen2.5-VL · Ollama"} for extraction.`, "steel");
  };

  const downloadReport = () => {
    const html = reportHtml(job.id, prop, docs, job);
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LandSafe-Report-${job.id}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Report downloaded — share it with your lawyer for professional review.", "good");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* header */}
      <div className="fade-up flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-marigold-600">Verification file · opened {fmtDate(job.createdAt)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{job.id}</h1>
            <Badge tone={meta.tone} dot className="text-xs">{meta.label}</Badge>
            {job.status === "flagged" && <Stamp tone="bad">Needs review</Stamp>}
            {job.status === "completed" && <Stamp tone="good">Reviewed</Stamp>}
          </div>
          <p className="mt-1 text-sm text-moss-500">Requested by <strong className="text-ink-900">{job.customerName}</strong> · {prop.village}, {prop.mandal}, {prop.district} · {prop.state}</p>
        </div>
        <div className="flex items-center gap-4">
          <ConfidenceDial value={job.confidence} />
          <div className="hidden flex-col gap-2 sm:flex">
            <Btn variant="dark" onClick={downloadReport}><Ic.download size={15} /> Download report</Btn>
            {isAdmin && job.status !== "completed" && (
              <Btn variant="outline" onClick={() => { setJobStatus(job.id, "completed", me!.name, notes || job.reviewerNotes); toast("Marked reviewed — report is now final.", "good"); }}>
                <Ic.check size={15} /> Mark reviewed
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* flags banner */}
      {job.flags.length > 0 && (
        <div className="fade-up-1 mt-6 rounded-xl border border-marigold-500/40 bg-marigold-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-marigold-700"><Ic.alert size={16} /> Standing warnings</div>
          <ul className="grid gap-1.5 text-[13px] text-marigold-700/90 sm:grid-cols-2">
            {job.flags.map((f) => <li key={f} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-marigold-600" />{f}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* left: property + checks */}
        <div className="space-y-8 lg:col-span-5">
          <section className="fade-up-1 rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-900">Property record (as declared)</h2>
              <Ic.pin size={17} className="text-pine-700" />
            </div>
            <KV k="State" v={prop.state} mono={false} />
            <KV k="District" v={prop.district} mono={false} />
            <KV k="Mandal" v={prop.mandal || "—"} mono={false} />
            <KV k="Village" v={prop.village} mono={false} />
            <KV k="Survey number" v={prop.surveyNo} />
            <KV k="Extent" v={`${prop.extentAcres.toFixed(2)} acres`} />
            <KV k="Claimed owner" v={prop.claimedOwner} mono={false} />
            <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11px] leading-relaxed text-moss-400">
              Declared by the requester. Government-record verification is pending manual review — Dharani/MeeBhoomi have no live integration.
            </p>
          </section>

          <section className="fade-up-2 rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-bold text-ink-900">Cross-document checks</h2>
            {job.findings.length === 0 ? (
              <p className="text-sm text-moss-500">Upload at least one document to begin automated checks.</p>
            ) : (
              <div className="space-y-2.5">
                {job.findings.map((f) => <CheckRow key={f.id} state={f.state} check={f.check} detail={f.detail} source={f.source} at={f.at} />)}
              </div>
            )}
            <div className="mt-4 flex items-center gap-4 border-t border-dashed border-line pt-3 text-[11px] font-semibold text-moss-400">
              <span className="flex items-center gap-1 text-pine-700"><Ic.check size={13} /> {passes.length} pass</span>
              <span className="flex items-center gap-1 text-marigold-600"><Ic.alert size={13} /> {warns.length} warn</span>
              <span className="flex items-center gap-1 text-clay-600"><Ic.x size={13} /> {fails.length} fail</span>
              <span className="ml-auto font-mono">checks re-run on every upload</span>
            </div>
          </section>

          {isAdmin && (
            <section className="rounded-2xl border border-steel-600/30 bg-steel-100/50 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-steel-700"><Ic.users size={17} /> Human review desk</h2>
              <Field label="Reviewer notes">
                <textarea className={cx(inputCls, "min-h-20 resize-none bg-card")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did the manual check find?" />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn variant="outline" onClick={() => { setJobStatus(job.id, "in_review", me!.name, notes); toast("Saved to review queue.", "steel"); }}>Save note</Btn>
                <Btn variant="danger" onClick={() => { setJobStatus(job.id, "flagged", me!.name, notes); toast("Flagged for inconsistency review.", "warn"); }}><Ic.flag size={14} /> Flag file</Btn>
              </div>
              {job.reviewedBy && <p className="mt-2 text-[11px] text-steel-700">Reviewed by {job.reviewedBy} · {fmtTime(job.completedAt!)}</p>}
            </section>
          )}
        </div>

        {/* right: documents */}
        <div className="lg:col-span-7">
          <section className="fade-up-2 rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink-900">Documents ({docs.length})</h2>
              <Badge tone={db.providers.ocrOutage ? "warn" : "good"} dot>
                OCR: {db.providers.ocrOutage ? "Tesseract fallback (Ollama outage sim)" : "Qwen2.5-VL 7B · Ollama"}
              </Badge>
            </div>

            {canUpload && job.status !== "completed" && (
              <div className="mb-5 rounded-xl border-2 border-dashed border-line bg-paper p-4 transition-colors hover:border-pine-500">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Document type">
                    <select className={cx(inputCls, "w-52")} value={docType} onChange={(e) => setDocType(e.target.value)}>
                      {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                  <Btn variant="marigold" onClick={() => fileRef.current?.click()}><Ic.upload size={15} /> Upload document</Btn>
                  <span className="text-[11px] text-moss-400">PDF / JPG / PNG · max 10 MB · stored via storage adapter, never in Git</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {docs.length === 0 && (
                <div className="rounded-xl border border-dashed border-line bg-paper/60 px-5 py-10 text-center">
                  <Ic.scan size={28} className="mx-auto text-moss-400" />
                  <p className="mt-2 text-sm font-semibold text-ink-800">No documents yet</p>
                  <p className="text-xs text-moss-500">Upload a Sale Deed plus one more record to unlock cross-checks.</p>
                </div>
              )}
              {docs.map((d) => (
                <div key={d.id} className="rounded-xl border border-line bg-paper/50 p-4 transition-shadow hover:shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className={cx("grid h-10 w-10 place-items-center rounded-lg", d.status === "extracted" ? "bg-pine-100 text-pine-700" : "bg-steel-100 text-steel-700")}>
                        {d.status === "processing" ? <Ic.scan size={19} /> : <Ic.doc size={19} />}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-ink-900">{d.docType}</div>
                        <div className="font-mono text-[11px] text-moss-500">{d.name} · {d.sizeKB} KB · {relTime(d.uploadedAt)}</div>
                      </div>
                    </div>
                    <Badge tone={d.status === "extracted" ? "good" : "steel"} dot>{d.status === "extracted" ? "Extracted" : "Reading…"}</Badge>
                  </div>
                  {d.status === "processing" ? (
                    <div className="mt-3">
                      <ProgressBar value={d.progress} tone="steel" striped />
                      <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-moss-400">
                        <span>{d.engine}</span><span>{d.progress}%</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                        {d.extractions.map((e) => (
                          <div key={e.field} className="leader py-1 text-[13px]">
                            <span className="shrink-0 text-moss-500">{e.field}</span>
                            <span className="dots" />
                            <span className="shrink-0 text-right font-mono text-xs font-semibold text-ink-900">{e.value}
                              <span className={cx("ml-1.5 text-[10px]", e.confidence > 0.9 ? "text-pine-600" : "text-marigold-600")}>{Math.round(e.confidence * 100)}%</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2 border-t border-dashed border-line pt-2 font-mono text-[10px] uppercase tracking-wider text-moss-400">
                        <Ic.bot size={12} /> {d.engine} · {d.extractions.length} fields · per-field confidence shown
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ state, check, detail, source, at }: { state: CheckState; check: string; detail: string; source: string; at: string }) {
  const [open, setOpen] = useState(false);
  const icon = state === "pass" ? <Ic.check size={15} /> : state === "warn" ? <Ic.alert size={15} /> : <Ic.x size={15} />;
  const cls = state === "pass" ? "border-pine-600/30 bg-pine-50" : state === "warn" ? "border-marigold-500/40 bg-marigold-50" : "border-clay-600/30 bg-clay-100/60";
  const txt = state === "pass" ? "text-pine-700" : state === "warn" ? "text-marigold-700" : "text-clay-700";
  return (
    <button onClick={() => setOpen(!open)} className={cx("block w-full rounded-lg border px-3.5 py-2.5 text-left transition-all cursor-pointer", cls)}>
      <div className={cx("flex items-center justify-between gap-2 text-sm font-bold", txt)}>
        <span className="flex items-center gap-2">{icon}{check}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">{state}</span>
      </div>
      {open && (
        <div className="mt-1.5 border-t border-dashed border-current/20 pt-2 text-xs leading-relaxed text-ink-800">
          {detail}
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-moss-400">source: {source} · {fmtTime(at)}</div>
        </div>
      )}
    </button>
  );
}

/* ----------------------------- report builder ---------------------------- */
function reportHtml(jobId: string, prop: { state: string; district: string; mandal: string; village: string; surveyNo: string; extentAcres: number; claimedOwner: string }, docs: { docType: string; name: string; uploadedAt: string; engine: string; extractions: { field: string; value: string; confidence: number }[] }[], job: VerificationJob): string {
  const esc = (s: string) => s.replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>LandSafe Report ${jobId}</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;color:#111;padding:0 20px}h1{font-size:26px}h2{font-size:16px;margin-top:28px;border-bottom:2px solid #1b5e43;padding-bottom:4px;color:#1b5e43}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#eef6f0}
.pass{color:#1e7a4f;font-weight:bold}.warn{color:#c77e12;font-weight:bold}.fail{color:#a33a2a;font-weight:bold}
.disclaimer{margin-top:32px;padding:14px;background:#fdf5e4;border:1px solid #e39b21;font-size:12px}</style></head><body>
<h1>LandSafe Verification Report — ${esc(jobId)}</h1>
<p>Generated ${new Date().toLocaleString("en-IN")} · Confidence score: <strong>${job.confidence}/100</strong> · Status: ${esc(job.status)}</p>
<h2>1 · Property details (as declared)</h2>
<table><tr><td>State / District</td><td>${esc(prop.state)} / ${esc(prop.district)}</td></tr>
<tr><td>Mandal / Village</td><td>${esc(prop.mandal)} / ${esc(prop.village)}</td></tr>
<tr><td>Survey No.</td><td>${esc(prop.surveyNo)}</td></tr>
<tr><td>Extent</td><td>${prop.extentAcres.toFixed(2)} acres</td></tr>
<tr><td>Claimed owner</td><td>${esc(prop.claimedOwner)}</td></tr></table>
<h2>2 · Documents received</h2>
<table><tr><th>Document</th><th>File</th><th>Uploaded</th><th>Engine</th></tr>
${docs.map((d) => `<tr><td>${esc(d.docType)}</td><td>${esc(d.name)}</td><td>${new Date(d.uploadedAt).toLocaleString("en-IN")}</td><td>${esc(d.engine)}</td></tr>`).join("")}</table>
<h2>3 · Extracted information (with confidence)</h2>
${docs.map((d) => `<h3 style="font-size:14px">${esc(d.docType)}</h3><table><tr><th>Field</th><th>Value</th><th>Confidence</th></tr>${d.extractions.map((e) => `<tr><td>${esc(e.field)}</td><td>${esc(e.value)}</td><td>${Math.round(e.confidence * 100)}%</td></tr>`).join("")}</table>`).join("")}
<h2>4 · Cross-document checks</h2>
<table><tr><th>Check</th><th>Result</th><th>Detail</th><th>Source</th><th>At</th></tr>
${job.findings.map((f) => `<tr><td>${esc(f.check)}</td><td class="${f.state}">${f.state.toUpperCase()}</td><td>${esc(f.detail)}</td><td>${esc(f.source)}</td><td>${new Date(f.at).toLocaleString("en-IN")}</td></tr>`).join("")}</table>
<h2>5 · Warnings &amp; missing information</h2>
<ul>${job.flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<h2>6 · External source checks</h2>
<p>Dharani (TS): <strong>SOURCE UNAVAILABLE</strong> — manual review required. MeeBhoomi (AP): <strong>SOURCE UNAVAILABLE</strong> — manual review required. GIS boundary: indicated layout position, not a cadastral survey.</p>
<h2>7 · Reviewer notes</h2>
<p>${esc(job.reviewerNotes || "—")} ${job.reviewedBy ? `(reviewed by ${esc(job.reviewedBy)})` : "(review pending)"}</p>
<div class="disclaimer"><strong>Disclaimer.</strong> This report summarises information extracted from documents supplied by the requester and automated cross-checks between them. It is not a legal opinion on title, does not certify that the land is free of encumbrances or disputes, and must not be treated as government record. Complete it with independent legal counsel and a licensed surveyor before any transaction.</div>
</body></html>`;
}
