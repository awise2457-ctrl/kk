import { useEffect, useRef, useState } from "react";
import {
  useDB, cx, Badge, Btn, Drawer, Field, Ic, JOB_STATUS, LEAD_STATUS, PLOT_STATUS, SURVEY_STATUS,
  Stat, Tabs, inputCls, toast, EmptyState, Modal,
} from "../components/ui";
import {
  currentUser, logout, scopePlots, scopeLeads, scopeSurveys, userById, projectById, ventureById, plotLabel,
  fmtINR, fmtDate, fmtTime, relTime,
  addLeadActivity, setLeadStatus, scheduleFollowUp, createLead, assignSurveyor, setSurveyStatus,
  decideApproval, proposePriceChange, runConcurrencyTest, payBooking, cancelBooking, markPlotSold,
  attemptCrossTenantRead, setOcrOutage, saveCallingKey, OCR_PRIMARY, OCR_FALLBACK,
  type User, type Lead, type SurveyRequest, type Plot,
} from "../lib/data";
import { getAttentionDigest, copilotAsk, COPILOT_SUGGESTIONS, type CopilotReply, type Digest } from "../lib/copilot";
import { VerificationDetail } from "./verification";
import { navTo } from "../lib/nav";

/* ------------------------------- app shell -------------------------------- */
const ADMIN_TABS = [
  { id: "copilot", label: "Copilot", ic: <Ic.bot size={16} /> },
  { id: "verifications", label: "Verifications", ic: <Ic.shield size={16} /> },
  { id: "surveys", label: "Surveys", ic: <Ic.ruler size={16} /> },
  { id: "leads", label: "Leads · CRM", ic: <Ic.users size={16} /> },
  { id: "inventory", label: "Inventory", ic: <Ic.layers size={16} /> },
  { id: "bookings", label: "Bookings", ic: <Ic.wallet size={16} /> },
  { id: "ventures", label: "Ventures", ic: <Ic.building size={16} /> },
  { id: "providers", label: "Providers", ic: <Ic.db size={16} /> },
  { id: "audit", label: "Audit log", ic: <Ic.activity size={16} /> },
];
const SALES_TABS = ADMIN_TABS.filter((t) => ["copilot", "leads", "inventory", "bookings", "surveys"].includes(t.id));

export function AdminShell({ initialTab }: { initialTab?: string }) {
  const { db, session } = useDB();
  const me = currentUser()!;
  const isSales = me.role === "sales";
  const tabs = isSales ? SALES_TABS : ADMIN_TABS;
  const [tab, setTab] = useState(initialTab ?? "copilot");
  const [openJob, setOpenJob] = useState<string | null>(null);

  if (openJob) {
    return (
      <div className="min-h-screen bg-paper">
        <ShellBar tab={tab} tabs={tabs} setTab={(t) => { setTab(t); }} me={me} onHome={() => setOpenJob(null)} backLabel="Back to dashboard" />
        <VerificationDetail jobId={openJob} />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-paper">
      <ShellBar tab={tab} tabs={tabs} setTab={setTab} me={me} />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div key={tab + db.rev} className="fade-up">
          {tab === "copilot" && <CopilotTab me={me} />}
          {tab === "verifications" && <VerificationsTab onOpen={setOpenJob} />}
          {tab === "surveys" && <SurveysTab me={me} />}
          {tab === "leads" && <LeadsTab me={me} />}
          {tab === "inventory" && <InventoryTab me={me} />}
          {tab === "bookings" && <BookingsTab me={me} />}
          {tab === "ventures" && <VenturesTab me={me} />}
          {tab === "providers" && <ProvidersTab me={me} />}
          {tab === "audit" && <AuditTab />}
        </div>
      </main>
    </div>
  );
}

function ShellBar({ tab, tabs, setTab, me, onHome, backLabel }: {
  tab: string; tabs: { id: string; label: string; ic: React.ReactNode }[]; setTab: (t: string) => void;
  me: User; onHome?: () => void; backLabel?: string;
}) {
  const { db } = useDB();
  const ventureScope = me.ventureId ? ventureById(db, me.ventureId)?.name : null;
  return (
    <header className="sticky top-0 z-50 border-b border-ink-700 bg-ink-900 text-pine-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          {onHome ? (
            <button onClick={onHome} className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-ink-800 cursor-pointer"><Ic.arrowR size={13} className="rotate-180" /> {backLabel}</button>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-pine-600 text-pine-50"><Ic.logo size={17} /></span>
          )}
          <div className="leading-none">
            <div className="font-display text-[15px] font-bold">LandSafe <span className="text-marigold-500">Console</span></div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-pine-200/60">{me.title} · {ventureScope ? `scoped to ${ventureScope}` : "all tenants"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="warn">DEMO</Badge>
          <span className="hidden items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold sm:flex">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-marigold-500 font-display text-[11px] font-extrabold text-ink-900">{me.name.split(" ").map((x) => x[0]).join("")}</span>
            {me.name}
          </span>
          <button onClick={() => { logout(); navTo({ page: "home" }); }} className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-ink-800 cursor-pointer">
            <Ic.out size={13} /> Sign out
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); onHome?.(); }}
            className={cx("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer",
              tab === t.id ? "bg-marigold-500 text-ink-900" : "text-pine-100/70 hover:bg-ink-800 hover:text-pine-50")}>
            {t.ic}{t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

/* -------------------------------- copilot --------------------------------- */
interface ChatMsg { role: "user" | "bot"; text?: string; reply?: CopilotReply; }
function CopilotTab({ me }: { me: User }) {
  const { db, session } = useDB();
  const digest = getAttentionDigest(db, me, session.prevLogin);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const ask = (text: string) => {
    if (!text.trim() || typing) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = copilotAsk(db, me, text);
      setMsgs((m) => [...m, { role: "bot", reply }]);
      setTyping(false);
    }, 550 + Math.random() * 400);
  };
  const runAction = (label: string, run: (u: User) => string) => {
    const out = run(me);
    toast(out, "steel");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      {/* digest column */}
      <div className="space-y-6 xl:col-span-7">
        <div className="contour relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 p-6 text-pine-50 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-marigold-500">
                <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-pine-500" /> Copilot · proactive digest
              </div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{greeting}, {me.name.split(" ")[0]}.</h1>
              <p className="mt-1 max-w-lg text-sm text-pine-100/70">
                I scanned {scopeLeads(db, me).length} leads, {scopePlots(db, me).length} plots and {scopeSurveys(db, me).length} surveys in your scope
                {session.prevLogin ? ` since your last sign-in (${relTime(session.prevLogin)})` : ""}. Here's what needs you.
              </p>
            </div>
            <div className="rounded-xl border border-ink-700 bg-ink-800/80 px-4 py-3 text-center">
              <div className="count-pop font-display text-4xl font-extrabold text-marigold-500">{digest.attention.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-pine-200/60">need attention</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {digest.sinceLogin.map((s) => (
              <div key={s.label} className="rounded-lg border border-ink-700 bg-ink-800/70 px-3 py-2">
                <div className="count-pop font-display text-xl font-bold text-pine-50">{s.count}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-pine-200/55">{s.label} since login</div>
              </div>
            ))}
          </div>
        </div>

        {/* attention items */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Needs attention today</h2>
          {digest.attention.length === 0 ? (
            <EmptyState icon={<Ic.check size={24} />} title="All clear" body="No stale leads, overdue surveys or flagged documents in your scope right now." />
          ) : (
            <div className="space-y-2.5">
              {digest.attention.map((it) => (
                <div key={it.id} className={cx("flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3.5 transition-shadow hover:shadow-sm",
                  it.severity === "high" ? "border-clay-600/30" : it.severity === "medium" ? "border-marigold-500/35" : "border-line")}>
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    it.kind === "stale_lead" ? "bg-marigold-100 text-marigold-700" :
                    it.kind === "overdue_survey" ? "bg-clay-100 text-clay-700" :
                    it.kind === "inconsistency" ? "bg-clay-100 text-clay-700" :
                    it.kind === "hold_expiry" ? "bg-steel-100 text-steel-700" : "bg-pine-100 text-pine-700")}>
                    {it.kind === "stale_lead" ? <Ic.users size={17} /> : it.kind === "overdue_survey" ? <Ic.ruler size={17} /> :
                     it.kind === "inconsistency" ? <Ic.alert size={17} /> : it.kind === "hold_expiry" ? <Ic.clock size={17} /> : <Ic.building size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink-900">{it.title}</span>
                      <Badge tone={it.severity === "high" ? "bad" : it.severity === "medium" ? "warn" : "plain"}>{it.severity}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-moss-500">{it.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.action && (
                      <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => runAction(it.action!.label, it.action!.run)}>
                        <Ic.zap size={13} /> {it.action.label}
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* approvals — admin only decides high-risk gates */}
        <section>
          <h2 className="mb-1 font-display text-lg font-bold text-ink-900">Approval gates <span className="text-sm font-semibold text-moss-400">· high-risk operations never auto-run</span></h2>
          {me.role !== "admin" && (
            <p className="text-sm text-moss-500">Your role can view the digest but not decide high-risk operations — approvals route to the owner/admin.</p>
          )}
          {me.role === "admin" && db.approvals.filter((a) => a.status === "pending").length === 0 && (
            <p className="text-sm text-moss-500">No pending approvals.</p>
          )}
          {me.role === "admin" && db.approvals.some((a) => a.status === "pending") && (
            <div className="mt-2 space-y-2.5">
              {db.approvals.filter((a) => a.status === "pending").map((a) => (
                <div key={a.id} className="rounded-xl border border-clay-600/30 bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-ink-900"><Ic.lock size={15} className="text-clay-600" /> {a.title}</span>
                    <Badge tone="bad" dot>HIGH-RISK</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-moss-500">{a.detail}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Btn className="px-4 py-1.5 text-xs" onClick={() => { decideApproval(a.id, true, me.name); toast(`Approved: ${a.title}`, "good"); }}><Ic.check size={13} /> YES, approve</Btn>
                    <Btn variant="danger" className="px-4 py-1.5 text-xs" onClick={() => { decideApproval(a.id, false, me.name); toast(`Rejected: ${a.title}`, "warn"); }}><Ic.x size={13} /> NO, reject</Btn>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-moss-400">{relTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {digest.autoActions.length > 0 && (
            <div className="mt-4 rounded-xl border border-line bg-paper p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-moss-500">Copilot auto-actions (low-risk · always surfaced)</div>
              {digest.autoActions.map((a) => (
                <div key={a.at + a.text} className="flex items-start gap-2 py-1 text-xs text-moss-500">
                  <Ic.bot size={13} className="mt-0.5 shrink-0 text-pine-700" />
                  <span><strong className="text-ink-800">{relTime(a.at)}:</strong> {a.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* chat column */}
      <div className="xl:col-span-5">
        <div className="flex h-[680px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm xl:sticky xl:top-32">
          <div className="flex items-center gap-2.5 border-b border-line bg-pine-50/60 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-pine-700 text-pine-50"><Ic.bot size={17} /></span>
            <div>
              <div className="text-sm font-bold text-ink-900">Ask the Copilot</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-moss-400">permission-aware tools · reads only your scope</div>
            </div>
            <span className="pulse-dot ml-auto h-2 w-2 rounded-full bg-pine-500" />
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="rounded-xl border border-dashed border-line bg-paper/70 p-4 text-xs leading-relaxed text-moss-500">
                The digest on the left is me speaking first. Ask me anything about <strong className="text-ink-800">your</strong> scoped data —
                {me.role === "admin" ? " you see all tenants; venture and sales users only ever see their own." : " your workspace only. I can't read other ventures, by design."}
              </div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink-900 px-3.5 py-2 text-sm text-pine-50">{m.text}</div>
            ) : (
              <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-paper px-3.5 py-2.5">
                <p className="text-sm text-ink-900">{m.reply!.text}</p>
                {m.reply!.rows && (
                  <div className="mt-2 space-y-1">
                    {m.reply!.rows.map((r, j) => (
                      <div key={j} className="flex items-baseline justify-between gap-3 rounded-lg bg-card px-2.5 py-1.5 text-xs">
                        <span className="font-semibold text-ink-800">{r.label}</span>
                        <span className={cx("shrink-0 font-mono text-[11px]", r.tone === "good" ? "text-pine-700" : r.tone === "warn" ? "text-marigold-600" : r.tone === "bad" ? "text-clay-600" : "text-moss-500")}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.reply!.doneAction && (
                  <div className="mt-2 rounded-lg border border-pine-600/30 bg-pine-50 px-2.5 py-2 text-xs text-pine-800"><Ic.check size={12} className="mr-1 inline" />{m.reply!.doneAction}</div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md border border-line bg-paper py-3">
                {[0, 1, 2].map((i) => <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-moss-400" />)}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COPILOT_SUGGESTIONS.slice(0, 4).map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-moss-500 transition-colors hover:border-pine-500 hover:text-pine-700 cursor-pointer">{s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="“Which leads need follow-up?”" value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(input)} />
              <Btn onClick={() => ask(input)} disabled={!input.trim() || typing}><Ic.send size={15} /></Btn>
            </div>
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-moss-400">All suggestions visible in the tools panel · Section 24 tool layer</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ verifications ----------------------------- */
function VerificationsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { db } = useDB();
  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open files" value={db.jobs.filter((j) => ["processing", "extracted", "in_review"].includes(j.status)).length} tone="steel" sub="processing + review queue" />
        <Stat label="Flagged" value={db.jobs.filter((j) => j.status === "flagged").length} tone="bad" sub="inconsistencies found" />
        <Stat label="Completed" value={db.jobs.filter((j) => j.status === "completed").length} tone="good" sub="human-reviewed" />
        <Stat label="Documents extracted" value={db.documents.filter((d) => d.status === "extracted").length} tone="plain" sub="across all files" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {db.jobs.map((j) => {
          const docs = db.documents.filter((d) => d.jobId === j.id);
          return (
            <button key={j.id} onClick={() => onOpen(j.id)}
              className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-pine-50 cursor-pointer">
              <span className="w-24 font-mono text-sm font-bold text-ink-900">{j.id}</span>
              <span className="w-40 text-sm text-ink-800">{j.customerName}</span>
              <span className="hidden flex-1 truncate text-xs text-moss-500 sm:block">{db.properties.find((p) => p.id === j.propertyId)?.village}, {db.properties.find((p) => p.id === j.propertyId)?.district} · {docs.length} docs</span>
              <span className="font-mono text-xs font-bold" style={{ color: j.confidence >= 75 ? "#1e7a4f" : j.confidence >= 50 ? "#c77e12" : "#a33a2a" }}>{j.confidence}%</span>
              <Badge tone={JOB_STATUS[j.status].tone} dot>{JOB_STATUS[j.status].label}</Badge>
              <Ic.arrowR size={15} className="text-moss-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------- surveys -------------------------------- */
function SurveysTab({ me }: { me: User }) {
  const { db } = useDB();
  const surveys = scopeSurveys(db, me);
  const [open, setOpen] = useState<SurveyRequest | null>(null);
  const live = open ? db.surveys.find((s) => s.id === open.id) ?? null : null;
  const surveyors = db.users.filter((u) => u.role === "surveyor");
  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requested" value={surveys.filter((s) => s.status === "requested").length} tone="marigold" />
        <Stat label="Assigned" value={surveys.filter((s) => s.status === "assigned").length} tone="steel" />
        <Stat label="In field" value={surveys.filter((s) => s.status === "in_progress").length} tone="warn" />
        <Stat label="Completed" value={surveys.filter((s) => s.status === "completed").length} tone="good" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {surveys.map((s) => (
          <button key={s.id} onClick={() => setOpen(s)}
            className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-pine-50 cursor-pointer">
            <span className="w-24 font-mono text-sm font-bold text-ink-900">{s.id}</span>
            <span className="w-40 text-sm text-ink-800">{s.customer}</span>
            <span className="hidden flex-1 truncate text-xs text-moss-500 md:block">{s.serviceType} · {s.location}</span>
            <span className={cx("font-mono text-xs", new Date(s.preferredDate) < new Date() && !["completed", "cancelled"].includes(s.status) ? "font-bold text-clay-600" : "text-moss-500")}>{fmtDate(s.preferredDate)}</span>
            <Badge tone={SURVEY_STATUS[s.status].tone} dot>{SURVEY_STATUS[s.status].label}</Badge>
          </button>
        ))}
        {surveys.length === 0 && <div className="p-8 text-center text-sm text-moss-500">No survey requests in your scope.</div>}
      </div>
      <Drawer open={!!live} onClose={() => setOpen(null)} title={live ? `${live.id} · ${live.serviceType}` : ""}>
        {live && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-paper p-4 text-sm">
              <div className="flex justify-between py-0.5"><span className="text-moss-500">Customer</span><strong>{live.customer} · {live.phone}</strong></div>
              <div className="flex justify-between py-0.5"><span className="text-moss-500">Location</span><strong className="text-right">{live.location}</strong></div>
              <div className="flex justify-between py-0.5"><span className="text-moss-500">Preferred</span><strong>{fmtDate(live.preferredDate)}</strong></div>
              <div className="flex justify-between py-0.5"><span className="text-moss-500">Surveyor</span><strong>{live.surveyorId ? userById(db, live.surveyorId)?.name : "—"}</strong></div>
            </div>
            {me.role === "admin" && !live.surveyorId && (
              <div className="flex items-center gap-2">
                <select className={inputCls} defaultValue={surveyors[0].id} id="svpick">
                  {surveyors.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.title}</option>)}
                </select>
                <Btn onClick={() => {
                  const el = document.getElementById("svpick") as HTMLSelectElement;
                  assignSurveyor(live.id, el.value, me.name);
                  toast("Surveyor assigned.", "good");
                }}>Assign</Btn>
              </div>
            )}
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-500">Field notes ({live.notes.length}) · {live.photos} photos</div>
              {live.notes.map((n) => (
                <div key={n.at + n.by} className="mb-2 rounded-lg border border-line bg-card px-3 py-2 text-xs">
                  <strong className="text-ink-900">{n.by}</strong> <span className="text-moss-400">· {fmtTime(n.at)}</span>
                  <p className="mt-0.5 text-ink-800">{n.text}</p>
                </div>
              ))}
              {live.notes.length === 0 && <p className="text-xs text-moss-400">No notes yet.</p>}
            </div>
            {live.measurements && (
              <div className="rounded-lg border border-pine-600/30 bg-pine-50 px-3 py-2 text-xs text-pine-800">
                <strong>Measurements:</strong> {live.measurements}
              </div>
            )}
            {live.status === "completed" && live.completedAt && (
              <div className="rounded-lg bg-paper px-3 py-2 font-mono text-[11px] text-moss-500">Completion report filed {fmtTime(live.completedAt)} · shared with customer</div>
            )}
            {me.role === "admin" && live.status !== "completed" && live.status !== "cancelled" && (
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setSurveyStatus(live.id, "in_progress", me.name)}>Start field work</Btn>
                <Btn variant="danger" onClick={() => { setSurveyStatus(live.id, "cancelled", me.name); toast("Survey cancelled.", "warn"); }}>Cancel</Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </section>
  );
}

/* ---------------------------------- CRM ----------------------------------- */
function LeadsTab({ me }: { me: User }) {
  const { db } = useDB();
  const leads = scopeLeads(db, me);
  const [open, setOpen] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const live = open ? db.leads.find((l) => l.id === open) ?? null : null;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Open leads" value={leads.filter((l) => !["booked", "lost"].includes(l.status)).length} tone="steel" />
          <Stat label="New today" value={leads.filter((l) => Date.now() - +new Date(l.createdAt) < 86400_000).length} tone="marigold" />
          <Stat label="Stale (≥4d quiet)" value={leads.filter((l) => !["booked", "lost"].includes(l.status) && Date.now() - +new Date(l.lastActivityAt) > 4 * 86400_000).length} tone="bad" />
          <Stat label="Follow-ups due" value={leads.filter((l) => l.followUpDate && new Date(l.followUpDate) < new Date(Date.now() + 86400_000) && !["booked", "lost"].includes(l.status)).length} tone="warn" />
        </div>
        <Btn onClick={() => setShowNew(true)}><Ic.plus size={15} /> New lead</Btn>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left font-mono text-[10px] uppercase tracking-widest text-moss-500">
              <th className="px-4 py-2.5">Lead</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Interested in</th>
              <th className="px-4 py-2.5">Assignee</th><th className="px-4 py-2.5">Follow-up</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} onClick={() => setOpen(l.id)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-pine-50">
                <td className="px-4 py-3"><strong className="text-ink-900">{l.name}</strong><div className="font-mono text-[10px] text-moss-400">{l.id} · {l.phone}</div></td>
                <td className="px-4 py-3 text-moss-500">{l.source}</td>
                <td className="px-4 py-3 text-xs text-moss-500">{projectById(db, l.projectId)?.name ?? "—"}{l.plotId ? ` · ${db.plots.find((p) => p.id === l.plotId)?.number}` : ""}</td>
                <td className="px-4 py-3 text-xs text-ink-800">{userById(db, l.assigneeId)?.name ?? <Badge tone="warn">Unassigned</Badge>}</td>
                <td className={cx("px-4 py-3 font-mono text-xs", l.followUpDate && new Date(l.followUpDate) < new Date() ? "font-bold text-clay-600" : "text-moss-500")}>{l.followUpDate ? fmtDate(l.followUpDate) : "—"}</td>
                <td className="px-4 py-3"><Badge tone={LEAD_STATUS[l.status].tone} dot>{LEAD_STATUS[l.status].label}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-moss-500">{relTime(l.lastActivityAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={!!live} onClose={() => setOpen(null)} title={live ? `${live.name}` : ""}>
        {live && <LeadDrawer lead={live} me={me} />}
      </Drawer>
      {showNew && <NewLeadModal me={me} onClose={() => setShowNew(false)} />}
    </section>
  );
}

function LeadDrawer({ lead, me }: { lead: Lead; me: User }) {
  const { db } = useDB();
  const [note, setNote] = useState("");
  const [fuDate, setFuDate] = useState("");
  const log = (type: "call" | "whatsapp" | "email" | "sms", adapter: string, text: string) => {
    addLeadActivity(lead.id, type, text, me.name, adapter);
    toast(`Logged via ${adapter} — provider swappable from adapters config.`, "steel");
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={LEAD_STATUS[lead.status].tone} dot>{LEAD_STATUS[lead.status].label}</Badge>
        <span className="text-xs text-moss-500">{lead.source} · {lead.phone} · budget {lead.budgetLakh ? `₹${lead.budgetLakh}L` : "—"}</span>
      </div>
      <div className="rounded-xl border border-line bg-paper p-3.5 text-xs text-moss-500">
        Interested in <strong className="text-ink-900">{projectById(db, lead.projectId)?.name ?? "any project"}</strong>
        {lead.plotId && <> · plot <strong className="text-ink-900">{db.plots.find((p) => p.id === lead.plotId)?.number}</strong></>} · assigned to <strong className="text-ink-900">{userById(db, lead.assigneeId)?.name ?? "—"}</strong>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-500">Change status</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(LEAD_STATUS).map((s) => (
            <button key={s} onClick={() => { setLeadStatus(lead.id, s as Lead["status"], me.name); toast(`Status → ${LEAD_STATUS[s].label}`, "good"); }}
              className={cx("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                lead.status === s ? "border-ink-900 bg-ink-900 text-pine-50" : "border-line text-moss-500 hover:border-pine-500")}>
              {LEAD_STATUS[s].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-500">Log an interaction (adapters)</div>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="outline" className="justify-start px-3 py-2 text-xs" onClick={() => log("call", "mock-telephony", "Outbound call logged — 3m 12s, discussed pricing.")}><Ic.phone size={14} /> Log call</Btn>
          <Btn variant="outline" className="justify-start px-3 py-2 text-xs" onClick={() => log("whatsapp", "mock-whatsapp", "WhatsApp template sent: project brochure + price sheet.")}><Ic.chat size={14} /> WhatsApp</Btn>
          <Btn variant="outline" className="justify-start px-3 py-2 text-xs" onClick={() => log("email", "mock-smtp", "Email sent: site-visit invitation for Saturday 10am.")}><Ic.mail size={14} /> Email</Btn>
          <Btn variant="outline" className="justify-start px-3 py-2 text-xs" onClick={() => log("sms", "mock-sms", "SMS reminder sent for tomorrow's follow-up.")}><Ic.send size={14} /> SMS</Btn>
        </div>
      </div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Btn variant="dark" disabled={!note.trim()} onClick={() => { addLeadActivity(lead.id, "note", note, me.name); setNote(""); }}>Save</Btn>
      </div>
      <div className="flex items-center gap-2">
        <input type="date" className={inputCls} value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
        <Btn variant="outline" disabled={!fuDate} onClick={() => { scheduleFollowUp(lead.id, new Date(fuDate + "T10:00:00").toISOString(), me.name); toast("Follow-up scheduled — reminder system armed.", "good"); }}>Schedule</Btn>
      </div>
      {lead.notes && <p className="rounded-lg bg-paper px-3 py-2 text-xs text-moss-500">{lead.notes}</p>}
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-500">Activity history ({lead.activities.length})</div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {lead.activities.map((a) => (
            <div key={a.id} className="flex gap-2.5 rounded-lg border border-line bg-card px-3 py-2 text-xs">
              <span className={cx("mt-0.5 shrink-0", a.type === "call" ? "text-pine-700" : a.type === "status" ? "text-steel-600" : "text-marigold-600")}>
                {a.type === "call" ? <Ic.phone size={13} /> : a.type === "whatsapp" ? <Ic.chat size={13} /> : a.type === "email" ? <Ic.mail size={13} /> : a.type === "status" ? <Ic.refresh size={13} /> : <Ic.file size={13} />}
              </span>
              <span className="flex-1 text-ink-800">{a.text}
                <span className="mt-0.5 block font-mono text-[10px] text-moss-400">{a.by} · {fmtTime(a.at)}{a.adapter ? ` · adapter: ${a.adapter}` : ""}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewLeadModal({ me, onClose }: { me: User; onClose: () => void }) {
  const { db } = useDB();
  const [f, setF] = useState({ name: "", phone: "", source: "Website", projectId: db.projects[0].id, budgetLakh: "" });
  const save = () => {
    if (!f.name || !f.phone) { toast("Name and phone are required.", "warn"); return; }
    const l = createLead({ name: f.name, phone: f.phone, source: f.source, projectId: f.projectId, budgetLakh: +f.budgetLakh || undefined }, me.name, me.ventureId ?? "v-green");
    toast(`Lead ${l.id} captured — reminder system will nudge if it goes quiet.`, "good");
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Capture a lead">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Source">
          <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            {["Website", "99acres", "MagicBricks", "Walk-in", "Referral", "Instagram", "Facebook"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Interested project">
          <select className={inputCls} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Budget (₹ lakh)"><input type="number" className={inputCls} value={f.budgetLakh} onChange={(e) => setF({ ...f, budgetLakh: e.target.value })} /></Field>
      </div>
      <Btn className="mt-4 w-full" onClick={save}>Capture lead</Btn>
    </Modal>
  );
}

/* -------------------------------- inventory ------------------------------- */
function InventoryTab({ me }: { me: User }) {
  const { db } = useDB();
  const plots = scopePlots(db, me);
  const [proj, setProj] = useState("all");
  const [status, setStatus] = useState("all");
  const [test, setTest] = useState<null | { plot: string; a: { ok: boolean; msg: string }; b: { ok: boolean; msg: string } }>(null);
  const [busy, setBusy] = useState(false);
  const [priceFor, setPriceFor] = useState<Plot | null>(null);
  const [newPrice, setNewPrice] = useState("");

  const visible = plots.filter((p) => (proj === "all" || p.projectId === proj) && (status === "all" || p.status === status));
  const availablePlot = plots.find((p) => p.status === "available");

  const runTest = async () => {
    if (!availablePlot) { toast("No available plot to test against.", "warn"); return; }
    setBusy(true); setTest(null);
    const r = await runConcurrencyTest(availablePlot.id);
    setTest({ plot: availablePlot.number, ...r });
    setBusy(false);
    toast(r.a.ok !== r.b.ok ? "Exactly one booking won — isolation held." : "Check the results — expected exactly one winner.", r.a.ok !== r.b.ok ? "good" : "warn");
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={cx(inputCls, "w-auto")} value={proj} onChange={(e) => setProj(e.target.value)}>
          <option value="all">All projects</option>
          {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={cx(inputCls, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.keys(PLOT_STATUS).map((s) => <option key={s} value={s}>{PLOT_STATUS[s].label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="dark" disabled={busy} onClick={runTest}><Ic.zap size={15} /> {busy ? "Firing 2 requests…" : "Run booking concurrency test"}</Btn>
        </div>
      </div>

      {test && (
        <div className="mb-4 rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm text-pine-50">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-marigold-500"><Ic.zap size={13} /> Concurrency test · plot {test.plot} · two simultaneous requests, same starting version</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["Request A", test.a], ["Request B", test.b]].map(([label, r]) => {
              const res = r as { ok: boolean; msg: string };
              return (
                <div key={label as string} className={cx("rounded-lg border px-3 py-2.5", res.ok ? "border-pine-600/50 bg-pine-800/40" : "border-clay-600/50 bg-clay-700/20")}>
                  <div className={cx("flex items-center gap-1.5 font-bold", res.ok ? "text-pine-200" : "text-clay-100")}>
                    {res.ok ? <Ic.check size={14} /> : <Ic.x size={14} />} {label as string}: {res.ok ? "SUCCEEDED" : "REJECTED"}
                  </div>
                  <p className="mt-1 text-xs text-pine-100/70">{res.msg}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-pine-200/50">Optimistic version lock on the plots row — DB transaction semantics, mirrored in the demo store</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left font-mono text-[10px] uppercase tracking-widest text-moss-500">
              <th className="px-4 py-2.5">Plot</th><th className="px-4 py-2.5">Project / Venture</th><th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5">Facing</th><th className="px-4 py-2.5">Rate</th><th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Ver</th><th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 60).map((p) => (
              <tr key={p.id} className="border-b border-line transition-colors last:border-0 hover:bg-pine-50">
                <td className="px-4 py-2.5 font-display text-sm font-bold text-ink-900">{p.number}</td>
                <td className="px-4 py-2.5 text-xs text-moss-500">{projectById(db, p.projectId)?.name}<div className="font-mono text-[10px]">{ventureById(db, p.ventureId)?.name}</div></td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.sizeSqYds} yd²</td>
                <td className="px-4 py-2.5 text-xs">{p.facing}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-ink-900">{fmtINR(p.pricePerSqYd)}</td>
                <td className="px-4 py-2.5"><Badge tone={PLOT_STATUS[p.status].tone} dot>{PLOT_STATUS[p.status].label}</Badge>
                  {p.status === "held" && p.holdExpiry && <div className="font-mono text-[10px] text-moss-400">expires {relTime(p.holdExpiry)}</div>}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-moss-400">v{p.version}</td>
                <td className="px-4 py-2.5 text-right">
                  {["available", "held"].includes(p.status) && me.role === "admin" && (
                    <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setPriceFor(p); setNewPrice(String(p.pricePerSqYd)); }}><Ic.key size={12} /> Price</Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div className="p-8 text-center text-sm text-moss-500">No plots match the filter.</div>}
      </div>

      <Modal open={!!priceFor} onClose={() => setPriceFor(null)} title={`Change rate — ${priceFor?.number}`}>
        <p className="mb-3 text-xs leading-relaxed text-moss-500">
          Current rate <strong className="text-ink-900">{fmtINR(priceFor?.pricePerSqYd ?? 0)}/sq yd</strong>. Price changes are
          <strong className="text-clay-600"> HIGH-RISK</strong> — they go to the approval gate, never straight to the inventory.
        </p>
        <Field label="New rate (₹ / sq yd)"><input type="number" className={inputCls} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /></Field>
        <Btn className="mt-4 w-full" onClick={() => {
          if (!+newPrice) return;
          proposePriceChange(priceFor!.id, +newPrice, me.name);
          toast("Approval requested — decide it on the Copilot tab.", "steel");
          setPriceFor(null);
        }}><Ic.lock size={14} /> Request approval</Btn>
      </Modal>
    </section>
  );
}

/* --------------------------------- bookings ------------------------------- */
function BookingsTab({ me }: { me: User }) {
  const { db } = useDB();
  const bks = db.bookings.filter((b) => me.role === "admin" || db.plots.find((p) => p.id === b.plotId)?.ventureId === me.ventureId);
  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total bookings" value={bks.length} tone="plain" />
        <Stat label="Payment pending" value={bks.filter((b) => b.status === "payment_pending").length} tone="warn" />
        <Stat label="Confirmed" value={bks.filter((b) => b.status === "confirmed").length} tone="good" />
        <Stat label="Tokens collected" value={fmtINR(bks.filter((b) => b.status === "confirmed").reduce((s, b) => s + b.tokenAmount, 0))} tone="steel" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left font-mono text-[10px] uppercase tracking-widest text-moss-500">
              <th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Plot</th>
              <th className="px-4 py-2.5">Token</th><th className="px-4 py-2.5">Payment (Razorpay · test)</th><th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bks.map((b) => {
              const plot = db.plots.find((p) => p.id === b.plotId);
              return (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-ink-900">{b.id}<div className="text-[10px] font-normal text-moss-400">{relTime(b.createdAt)}</div></td>
                  <td className="px-4 py-3 text-ink-800">{b.customerName}</td>
                  <td className="px-4 py-3 text-xs text-moss-500">{plotLabel(db, b.plotId)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{fmtINR(b.tokenAmount)}</td>
                  <td className="px-4 py-3 text-xs">
                    <Badge tone={b.status === "confirmed" ? "good" : b.status === "cancelled" ? "bad" : "warn"} dot>
                      {b.status.replace("_", " ")}
                    </Badge>
                    <div className="mt-0.5 font-mono text-[10px] text-moss-400">{b.payment.orderId} · {b.payment.method}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {b.status === "payment_pending" && me.role === "admin" && (
                        <>
                          <Btn variant="outline" className="px-2.5 py-1 text-xs" onClick={() => { payBooking(b.id, "UPI · test capture"); toast("Payment captured (sandbox) — booking confirmed.", "good"); }}>Capture test payment</Btn>
                          <Btn variant="ghost" className="px-2.5 py-1 text-xs text-clay-600" onClick={() => { cancelBooking(b.id, me.name); toast("Booking cancelled — plot released.", "warn"); }}>Cancel</Btn>
                        </>
                      )}
                      {b.status === "confirmed" && plot?.status === "booked" && me.role === "admin" && (
                        <Btn variant="outline" className="px-2.5 py-1 text-xs" onClick={() => { markPlotSold(b.plotId, me.name); toast("Plot marked sold — registration complete.", "good"); }}>Mark sold</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bks.length === 0 && <div className="p-8 text-center text-sm text-moss-500">No bookings yet.</div>}
      </div>
    </section>
  );
}

/* --------------------------------- ventures ------------------------------- */
function VenturesTab({ me }: { me: User }) {
  const { db } = useDB();
  const [isoResult, setIsoResult] = useState<string | null>(null);
  const runIsolationTest = () => {
    const v1User = db.users.find((u) => u.id === "u-v1")!;
    const foreignPlot = db.plots.find((p) => p.ventureId !== v1User.ventureId)!;
    const r = attemptCrossTenantRead(foreignPlot.id, v1User);
    setIsoResult(`${r.denied ? "DENIED ✓" : "ALLOWED ✗"} — ${v1User.name} (tenant ${v1User.ventureId}) attempted to read ${foreignPlot.id} (tenant ${foreignPlot.ventureId}). ${r.reason}`);
    toast(r.denied ? "Cross-tenant read rejected and written to the audit log." : "Unexpected: access was allowed!", r.denied ? "good" : "bad");
  };
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-moss-500">
          Every venture gets an isolated workspace — <strong className="text-ink-900">fastapi-tenancy-style row isolation</strong> in production,
          scope guards in this demo. A venture can never read another venture's private data.
        </p>
        <Btn variant="dark" onClick={runIsolationTest}><Ic.lock size={15} /> Attempt cross-tenant read (test)</Btn>
      </div>
      {isoResult && (
        <div className={cx("mb-5 rounded-xl border px-4 py-3 font-mono text-xs", isoResult.startsWith("DENIED") ? "border-pine-600/40 bg-pine-50 text-pine-800" : "border-clay-600/40 bg-clay-100 text-clay-700")}>
          {isoResult}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {db.ventures.map((v) => {
          const plots = db.plots.filter((p) => p.ventureId === v.id);
          const leads = db.leads.filter((l) => l.ventureId === v.id);
          const bks = db.bookings.filter((b) => plots.some((p) => p.id === b.plotId));
          return (
            <div key={v.id} className="rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-marigold-600">Tenant {v.id} · {v.district}</div>
                  <h3 className="font-display text-xl font-bold text-ink-900">{v.name}</h3>
                  <p className="text-xs text-moss-500">{v.contact} · {v.phone} · RERA {v.rera}</p>
                </div>
                <Badge tone={v.status === "active" ? "good" : "plain"} dot>{v.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-dashed border-line pt-3 text-center">
                {[
                  [plots.length, "plots"],
                  [plots.filter((p) => p.status === "available").length, "available"],
                  [leads.length, "leads"],
                  [bks.length, "bookings"],
                ].map(([n, l]) => (
                  <div key={l as string}>
                    <div className="font-display text-xl font-extrabold text-ink-900">{n}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-moss-400">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-moss-400">last workspace activity {relTime(v.lastActivityAt)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------- providers ------------------------------ */
function ProvidersTab({ me }: { me: User }) {
  const { db } = useDB();
  const [key, setKey] = useState("");
  const p = db.providers;
  const ocrActive = p.ocrOutage ? OCR_FALLBACK : OCR_PRIMARY;
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {/* OCR */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"><Ic.scan size={18} className="text-pine-700" /> OCR / Document AI</h3>
          <Badge tone={p.ocrOutage ? "warn" : "good"} dot>{p.ocrOutage ? "Fallback active" : "Primary online"}</Badge>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className={cx("flex items-center justify-between rounded-lg border px-3 py-2.5", !p.ocrOutage ? "border-pine-600/40 bg-pine-50" : "border-line")}>
            <span><strong>Qwen2.5-VL 7B</strong> <span className="text-xs text-moss-500">· served via Ollama · primary</span></span>
            <span className={cx("font-mono text-[10px] font-bold uppercase", p.ocrOutage ? "text-clay-600" : "text-pine-700")}>{p.ocrOutage ? "unreachable (sim)" : "online (sim)"}</span>
          </div>
          <div className={cx("flex items-center justify-between rounded-lg border px-3 py-2.5", p.ocrOutage ? "border-marigold-500/50 bg-marigold-50" : "border-line")}>
            <span><strong>Tesseract 5</strong> <span className="text-xs text-moss-500">· CPU fallback · clean print only</span></span>
            <span className={cx("font-mono text-[10px] font-bold uppercase", p.ocrOutage ? "text-marigold-600" : "text-moss-400")}>{p.ocrOutage ? "active (sim)" : "standby"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 opacity-60">
            <span><strong>Surya</strong> <span className="text-xs text-moss-500">· optional upgrade · needs GPU infra — post-MVP</span></span>
            <span className="font-mono text-[10px] font-bold uppercase text-moss-400">not wired</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-paper px-3 py-2.5">
          <span className="text-xs font-semibold text-moss-500">Simulate Ollama outage (failover drill)</span>
          <button onClick={() => { setOcrOutage(!p.ocrOutage, me.name); toast(p.ocrOutage ? "Primary OCR restored." : "Ollama outage simulated — uploads now use Tesseract.", p.ocrOutage ? "good" : "warn"); }}
            className={cx("relative h-6 w-11 rounded-full transition-colors cursor-pointer", p.ocrOutage ? "bg-marigold-500" : "bg-moss-400/50")}>
            <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", p.ocrOutage ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-moss-400">active adapter: {ocrActive} · all callers use the OCR interface, never an engine directly</p>
      </div>

      {/* AI gateway */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"><Ic.bot size={18} className="text-pine-700" /> AI Gateway</h3>
          <Badge tone="good" dot>Ollama online (sim)</Badge>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-moss-500">
          <li className="flex justify-between"><span>Orchestration runtime</span><strong className="text-ink-900">Ollama (local)</strong></li>
          <li className="flex justify-between"><span>Cloud AI fallback adapter</span><strong className="text-moss-400">interface ready · no key set</strong></li>
          <li className="flex justify-between"><span>Copilot tool layer</span><strong className="text-ink-900">11 permission-aware tools</strong></li>
          <li className="flex justify-between"><span>Hard-coded providers</span><strong className="text-pine-700">none — everything behind adapters</strong></li>
        </ul>
      </div>

      {/* Payments */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"><Ic.wallet size={18} className="text-pine-700" /> Payments</h3>
          <Badge tone="steel" dot>Test mode</Badge>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-moss-500">
          <li className="flex justify-between"><span>Gateway</span><strong className="text-ink-900">Razorpay · razorpay-python SDK (prod)</strong></li>
          <li className="flex justify-between"><span>Key ID</span><strong className="font-mono text-xs text-ink-900">{p.payments.keyId}</strong></li>
          <li className="flex justify-between"><span>Methods</span><strong className="text-ink-900">UPI · Netbanking · Cards</strong></li>
          <li className="flex justify-between"><span>Card data</span><strong className="text-pine-700">never stored — gateway tokenises</strong></li>
        </ul>
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11px] text-moss-500">Live keys are an env-var swap away; the payment adapter interface stays identical.</p>
      </div>

      {/* Calling */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"><Ic.phone size={18} className="text-pine-700" /> Calling / Voice AI</h3>
          <Badge tone={p.calling.status === "connected_sandbox" ? "good" : "plain"} dot>
            {p.calling.status === "connected_sandbox" ? "Connected · sandbox" : "Not configured"}
          </Badge>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-moss-500">
          <li className="flex justify-between"><span>Provider</span><strong className="text-ink-900">{p.calling.provider}</strong> <span className="text-xs">(Exotel/Twilio/Knowlarity swappable)</span></li>
          <li className="flex justify-between"><span>API key</span><strong className="font-mono text-xs">{p.calling.apiKeyMasked || "—"}</strong></li>
          <li className="flex justify-between"><span>Live call flows</span><strong className="text-moss-400">post-MVP · interface only</strong></li>
        </ul>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} type="password" placeholder="Paste OmniDimension API key" value={key} onChange={(e) => setKey(e.target.value)} />
          <Btn variant="dark" onClick={() => { saveCallingKey(key, me.name); setKey(""); toast(key.trim().length >= 8 ? "Key stored encrypted — status: connected (sandbox)." : "Key too short — provider stays 'not configured' (no silent failure).", key.trim().length >= 8 ? "good" : "warn"); }}>Save</Btn>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-moss-400">stored encrypted at rest · managed from this panel, never in code or env</p>
      </div>

      {/* Gov sources */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm lg:col-span-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"><Ic.building size={18} className="text-pine-700" /> Government data sources <span className="text-sm font-semibold text-moss-400">· post-MVP adapter layer · nothing faked</span></h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {p.gov.map((g) => (
            <div key={g.name} className="rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-ink-900">{g.name}</strong>
                <Badge tone={g.status === "available_manual" ? "warn" : "bad"}>{g.status === "available_manual" ? "SOURCE AVAILABLE" : "SOURCE UNAVAILABLE"}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-moss-500">{g.note}</p>
              <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-marigold-600">manual review required</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- audit --------------------------------- */
function AuditTab() {
  const { db } = useDB();
  const [sev, setSev] = useState("all");
  const rows = db.audit.filter((a) => sev === "all" || a.severity === sev).slice(0, 80);
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <Tabs active={sev} onChange={setSev} tabs={[{ id: "all", label: "All" }, { id: "info", label: "Info" }, { id: "warn", label: "Warnings" }, { id: "denied", label: "Denied" }]} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-moss-400">{db.audit.length} entries · structured logs</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {rows.map((a) => (
          <div key={a.id} className={cx("flex flex-wrap items-center gap-x-5 gap-y-0.5 border-b border-line px-4 py-2.5 text-xs last:border-0", a.severity === "denied" && "bg-clay-100/50")}>
            <span className="w-28 shrink-0 font-mono text-[10px] text-moss-400">{fmtTime(a.at)}</span>
            <Badge tone={a.severity === "denied" ? "bad" : a.severity === "warn" ? "warn" : "steel"} className="w-36 justify-center">{a.action}</Badge>
            <span className="w-32 shrink-0 font-semibold text-ink-900">{a.actor}</span>
            <span className="flex-1 text-moss-500">{a.detail}</span>
            {a.tenantId && <span className="font-mono text-[10px] text-moss-400">tenant:{a.tenantId}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
