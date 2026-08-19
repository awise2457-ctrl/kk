import { useState } from "react";
import {
  useDB, cx, Badge, Btn, Field, Ic, JOB_STATUS, SURVEY_STATUS, inputCls, toast, EmptyState,
} from "../components/ui";
import { PublicNav, Footer } from "./customer";
import { navTo } from "../lib/nav";
import {
  currentUser, login, logout, resetDemo, scopeJobs, scopeSurveys, surveyAddNote, setSurveyStatus,
  fmtINR, fmtDate, relTime, plotLabel, type User,
} from "../lib/data";

/* --------------------------------- login --------------------------------- */
export function LoginScreen() {
  const { db } = useDB();
  const groups: { role: User["role"]; label: string; desc: string }[] = [
    { role: "admin", label: "Owner / Admin", desc: "All tenants, Copilot, approvals, providers" },
    { role: "venture", label: "Venture workspace", desc: "Isolated per-venture portal" },
    { role: "sales", label: "Sales team", desc: "CRM scoped to one venture" },
    { role: "surveyor", label: "Surveyor", desc: "Field assignments & reports" },
    { role: "customer", label: "Customer", desc: "Verifications, surveys, bookings" },
  ];
  return (
    <div className="min-h-screen bg-paper">
      <PublicNav />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-marigold-600">Demo sign-in · RBAC preview</div>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink-900">Pick a seat in the system</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-moss-500">
            Every login maps to a role with its own scope. Watch what changes — a venture user can never see another
            venture's data, a surveyor only sees their assignments.
          </p>
        </div>
        <div className="space-y-8">
          {groups.map((g) => {
            const users = db.users.filter((u) => u.role === g.role);
            return (
              <div key={g.role}>
                <div className="mb-2.5 flex items-baseline gap-3">
                  <h2 className="font-display text-lg font-bold text-ink-900">{g.label}</h2>
                  <span className="text-xs text-moss-400">{g.desc}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => { login(u.id); navTo({ page: "app" }); toast(`Signed in as ${u.name} · ${g.label}`, "good"); }}
                      className="group flex items-center gap-4 rounded-xl border border-line bg-card p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-pine-600 hover:shadow-md cursor-pointer">
                      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold",
                        g.role === "admin" ? "bg-ink-900 text-marigold-500" : g.role === "venture" ? "bg-marigold-500 text-ink-900" :
                        g.role === "sales" ? "bg-steel-600 text-steel-100" : g.role === "surveyor" ? "bg-pine-700 text-pine-50" : "bg-pine-100 text-pine-800")}>
                        {u.name.split(" ").map((x) => x[0]).join("")}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-ink-900">{u.name}</span>
                        <span className="block text-xs text-moss-500">{u.title}{u.ventureId ? ` · ${db.ventures.find((v) => v.id === u.ventureId)?.name}` : ""}</span>
                      </span>
                      <span className="text-moss-400 transition-all group-hover:translate-x-1 group-hover:text-pine-700"><Ic.arrowR size={17} /></span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex items-center justify-center gap-3 text-xs text-moss-400">
          <button onClick={() => { resetDemo(); toast("Demo data reseeded.", "steel"); }} className="flex items-center gap-1.5 font-semibold hover:text-ink-900 cursor-pointer">
            <Ic.refresh size={13} /> Reset demo data
          </button>
          <span>·</span><span>Passwords are simulated (SSO stub) — real hashing/JWT lives in the production backend contract.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ---------------------------- shared portal shell -------------------------- */
function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const me = currentUser()!;
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-50 border-b border-ink-700 bg-ink-900 text-pine-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-pine-600 text-pine-50"><Ic.logo size={17} /></span>
            <div className="leading-none">
              <div className="font-display text-[15px] font-bold">{title}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-pine-200/60">{subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs font-semibold sm:block">{me.name}</span>
            <button onClick={() => { logout(); navTo({ page: "home" }); }} className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-ink-800 cursor-pointer">
              <Ic.out size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

/* ----------------------------- customer portal ----------------------------- */
export function CustomerPortal() {
  const { db } = useDB();
  const me = currentUser()!;
  const [tab, setTab] = useState("verifications");
  const jobs = scopeJobs(db, me);
  const surveys = scopeSurveys(db, me);
  const myPlots = db.plots.filter((p) => p.heldBy === me.name);
  const bookings = db.bookings.filter((b) => b.customerName === me.name);
  return (
    <PortalShell title="My LandSafe" subtitle={`customer workspace · ${me.name}`}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[["verifications", "Verifications"], ["surveys", "Survey requests"], ["bookings", "Bookings & holds"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cx("rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer",
              tab === id ? "bg-ink-900 text-pine-100" : "text-moss-500 hover:text-ink-900 border border-line bg-card")}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => navTo({ page: "find" })}><Ic.pin size={13} /> Find plots</Btn>
          <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => navTo({ page: "home" })}><Ic.shield size={13} /> New verification</Btn>
        </div>
      </div>

      {tab === "verifications" && (
        <div className="space-y-3">
          {jobs.map((j) => {
            const docs = db.documents.filter((d) => d.jobId === j.id);
            const prop = db.properties.find((p) => p.id === j.propertyId);
            return (
              <button key={j.id} onClick={() => navTo({ page: "verify", jobId: j.id })}
                className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-line bg-card px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-pine-600 hover:shadow-md cursor-pointer">
                <span className="font-mono text-sm font-bold text-ink-900">{j.id}</span>
                <span className="flex-1 text-xs text-moss-500">{prop?.village}, {prop?.district} · {prop?.surveyNo} · {docs.length} document(s)</span>
                <span className="font-mono text-xs font-bold" style={{ color: j.confidence >= 75 ? "#1e7a4f" : j.confidence >= 50 ? "#c77e12" : "#a33a2a" }}>{j.confidence}%</span>
                <Badge tone={JOB_STATUS[j.status].tone} dot>{JOB_STATUS[j.status].label}</Badge>
                <Ic.arrowR size={15} className="text-moss-400" />
              </button>
            );
          })}
          {jobs.length === 0 && (
            <EmptyState icon={<Ic.shield size={22} />} title="No verification files yet"
              body="Start one from the home page with your survey number — it takes a minute."
              action={<Btn onClick={() => navTo({ page: "home" })}>Verify land</Btn>} />
          )}
        </div>
      )}

      {tab === "surveys" && (
        <div className="space-y-3">
          {surveys.map((s) => (
            <div key={s.id} className="rounded-xl border border-line bg-card px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-mono text-sm font-bold text-ink-900">{s.id}</span>
                <span className="flex-1 text-xs text-moss-500">{s.serviceType} · {s.location}</span>
                <span className="font-mono text-xs text-moss-500">preferred {fmtDate(s.preferredDate)}</span>
                <Badge tone={SURVEY_STATUS[s.status].tone} dot>{SURVEY_STATUS[s.status].label}</Badge>
              </div>
              {s.status === "completed" && s.measurements && (
                <div className="mt-2 rounded-lg border border-pine-600/30 bg-pine-50 px-3 py-2 text-xs text-pine-800">
                  <strong>Field report:</strong> {s.measurements} · {s.photos} photos on file
                </div>
              )}
              {s.surveyorId && <div className="mt-2 text-[11px] text-moss-400">Surveyor: {db.users.find((u) => u.id === s.surveyorId)?.name}</div>}
            </div>
          ))}
          {surveys.length === 0 && <EmptyState icon={<Ic.ruler size={22} />} title="No survey requests" body="Book a licensed surveyor from the home page." action={<Btn onClick={() => navTo({ page: "home" })}>Book surveyor</Btn>} />}
        </div>
      )}

      {tab === "bookings" && (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-card px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-mono text-sm font-bold text-ink-900">{b.id}</span>
                <span className="flex-1 text-xs text-moss-500">{plotLabel(db, b.plotId)} · token {fmtINR(b.tokenAmount)}</span>
                <Badge tone={b.status === "confirmed" ? "good" : b.status === "cancelled" ? "bad" : "warn"} dot>{b.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-moss-400">{b.payment.orderId} · {b.payment.gateway} {b.payment.mode}</div>
            </div>
          ))}
          {myPlots.map((p) => (
            <div key={p.id} className="rounded-xl border border-marigold-500/40 bg-marigold-50 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-mono text-sm font-bold text-ink-900">HOLD · {p.number}</span>
                <span className="flex-1 text-xs text-marigold-700">{plotLabel(db, p.id)} · 48-hour hold {p.holdExpiry ? `· expires ${relTime(p.holdExpiry)}` : ""}</span>
                <Btn variant="marigold" className="px-3 py-1.5 text-xs" onClick={() => navTo({ page: "find" })}>Convert to booking</Btn>
              </div>
            </div>
          ))}
          {bookings.length === 0 && myPlots.length === 0 && (
            <EmptyState icon={<Ic.wallet size={22} />} title="Nothing booked yet" body="Find a plot you like and place a hold or a token booking." action={<Btn onClick={() => navTo({ page: "find" })}>Find plots</Btn>} />
          )}
        </div>
      )}
    </PortalShell>
  );
}

/* ----------------------------- surveyor portal ----------------------------- */
export function SurveyorPortal() {
  const { db } = useDB();
  const me = currentUser()!;
  const surveys = scopeSurveys(db, me);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [meas, setMeas] = useState("");
  const live = open ? db.surveys.find((s) => s.id === open) : null;
  return (
    <PortalShell title="Field Desk" subtitle={`surveyor · ${me.title}`}>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatLite label="Assigned" value={surveys.filter((s) => s.status === "assigned").length} />
        <StatLite label="In field" value={surveys.filter((s) => s.status === "in_progress").length} />
        <StatLite label="Completed" value={surveys.filter((s) => s.status === "completed").length} />
        <StatLite label="This week" value={surveys.filter((s) => new Date(s.preferredDate) > new Date() && new Date(s.preferredDate) < new Date(Date.now() + 7 * 86400_000)).length} />
      </div>
      <div className="space-y-3">
        {surveys.map((s) => (
          <button key={s.id} onClick={() => { setOpen(s.id); setMeas(s.measurements ?? ""); }}
            className={cx("flex w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-card px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
              new Date(s.preferredDate) < new Date() && !["completed", "cancelled"].includes(s.status) ? "border-clay-600/40" : "border-line")}>
            <span className="font-mono text-sm font-bold text-ink-900">{s.id}</span>
            <span className="flex-1 text-xs text-moss-500">{s.serviceType} · {s.location} · {s.customer} ({s.phone})</span>
            <span className={cx("font-mono text-xs", new Date(s.preferredDate) < new Date() && s.status !== "completed" ? "font-bold text-clay-600" : "text-moss-500")}>{fmtDate(s.preferredDate)}</span>
            <Badge tone={SURVEY_STATUS[s.status].tone} dot>{SURVEY_STATUS[s.status].label}</Badge>
          </button>
        ))}
        {surveys.length === 0 && <EmptyState icon={<Ic.compass size={22} />} title="No assignments" body="New field assignments from the ops team will appear here." />}
      </div>

      {live && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(null)} />
          <div className="modal-in relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-card p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-marigold-600">{live.serviceType}</div>
                <h3 className="font-display text-xl font-bold text-ink-900">{live.id} · {live.customer}</h3>
                <p className="text-xs text-moss-500">{live.location} · {live.phone} · preferred {fmtDate(live.preferredDate)}</p>
              </div>
              <button onClick={() => setOpen(null)} className="rounded-md p-1.5 text-moss-500 hover:bg-paper cursor-pointer"><Ic.x /></button>
            </div>

            {live.coords && <div className="mt-3 font-mono text-[11px] text-moss-500">GPS: {live.coords[1].toFixed(5)}, {live.coords[0].toFixed(5)} · {live.photos} photos attached</div>}

            <div className="mt-4 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-moss-500">Field notes</div>
              {live.notes.map((n) => (
                <div key={n.at + n.by} className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-800">
                  {n.text}<span className="mt-0.5 block font-mono text-[10px] text-moss-400">{n.by} · {relTime(n.at)}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Add a field note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <Btn variant="dark" disabled={!note.trim()} onClick={() => { surveyAddNote(live.id, note, me.name); setNote(""); toast("Note added.", "steel"); }}>Add</Btn>
              </div>
            </div>

            {live.status !== "completed" && (
              <div className="mt-4 rounded-xl border border-pine-600/30 bg-pine-50 p-4">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-pine-800">Completion report</div>
                <Field label="Measurements & findings">
                  <textarea className={cx(inputCls, "min-h-20 resize-none bg-card")} value={meas} onChange={(e) => setMeas(e.target.value)}
                    placeholder="e.g. Chain measurement 1.23 ac N-S · 1.24 ac avg — matches deed within tolerance." />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  {live.status === "assigned" && (
                    <Btn variant="outline" onClick={() => { setSurveyStatus(live.id, "in_progress", me.name); toast("Marked in progress.", "steel"); }}><Ic.compass size={14} /> Arrived on site</Btn>
                  )}
                  <Btn disabled={!meas.trim()} onClick={() => {
                    setSurveyStatus(live.id, "completed", me.name, meas);
                    toast("Completion report filed — customer notified.", "good");
                    setOpen(null);
                  }}><Ic.check size={14} /> File completion report</Btn>
                </div>
              </div>
            )}
            {live.status === "completed" && (
              <div className="mt-4 rounded-xl border border-pine-600/30 bg-pine-50 px-4 py-3 text-xs text-pine-800">
                <strong>Completed {live.completedAt ? relTime(live.completedAt) : ""}.</strong> {live.measurements}
              </div>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function StatLite({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <div className="count-pop font-display text-2xl font-extrabold text-ink-900">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-moss-500">{label}</div>
    </div>
  );
}
