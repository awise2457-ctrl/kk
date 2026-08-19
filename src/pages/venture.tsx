import { useState } from "react";
import {
  useDB, cx, Badge, Btn, Field, Ic, LEAD_STATUS, PLOT_STATUS, Stat, Tabs, inputCls, toast, EmptyState, Modal,
} from "../components/ui";
import { PlotMap, PlotLegend } from "../components/map";
import {
  currentUser, logout, scopePlots, scopeLeads, userById, projectById, fmtINR, fmtDate, relTime,
  addPlot, addCampaign, addLeadActivity, setLeadStatus, createLead, type User, type Plot,
} from "../lib/data";
import { navTo } from "../lib/nav";

export function VenturePortal() {
  const { db } = useDB();
  const me = currentUser()!;
  const venture = db.ventures.find((v) => v.id === me.ventureId)!;
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Overview" }, { id: "inventory", label: "Inventory" },
    { id: "leads", label: "Leads" }, { id: "bookings", label: "Bookings" },
    { id: "marketing", label: "Marketing" }, { id: "profile", label: "Profile" },
  ];
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-50 border-b border-ink-700 bg-ink-900 text-pine-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marigold-500 text-ink-900"><Ic.building size={17} /></span>
            <div className="leading-none">
              <div className="font-display text-[15px] font-bold">{venture.name}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-pine-200/60">
                isolated workspace · tenant {venture.id} · {me.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="warn">DEMO</Badge>
            <Badge tone="good" dot className="hidden sm:inline-flex"><Ic.lock size={11} /> scope-guarded</Badge>
            <button onClick={() => { logout(); navTo({ page: "home" }); }} className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-ink-800 cursor-pointer">
              <Ic.out size={13} /> Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cx("shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer",
                tab === t.id ? "bg-marigold-500 text-ink-900" : "text-pine-100/70 hover:bg-ink-800 hover:text-pine-50")}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div key={tab + db.rev} className="fade-up">
          {tab === "overview" && <VOverview me={me} />}
          {tab === "inventory" && <VInventory me={me} />}
          {tab === "leads" && <VLeads me={me} />}
          {tab === "bookings" && <VBookings me={me} />}
          {tab === "marketing" && <VMarketing me={me} />}
          {tab === "profile" && <VProfile me={me} />}
        </div>
      </main>
    </div>
  );
}

function VOverview({ me }: { me: User }) {
  const { db } = useDB();
  const plots = scopePlots(db, me);
  const leads = scopeLeads(db, me);
  const bks = db.bookings.filter((b) => plots.some((p) => p.id === b.plotId));
  const projects = db.projects.filter((p) => p.ventureId === me.ventureId);
  const statusCounts = Object.keys(PLOT_STATUS).map((s) => ({ s, n: plots.filter((p) => p.status === s).length })).filter((x) => x.n > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Plots in inventory" value={plots.length} sub={`${projects.length} project(s)`} />
        <Stat label="Available now" value={plots.filter((p) => p.status === "available").length} tone="good" sub="visible to buyers" />
        <Stat label="Open leads" value={leads.filter((l) => !["booked", "lost"].includes(l.status)).length} tone="steel" sub={`${leads.filter((l) => Date.now() - +new Date(l.lastActivityAt) > 4 * 86400_000).length} going stale`} />
        <Stat label="Bookings" value={bks.length} tone="marigold" sub={fmtINR(bks.filter((b) => b.status === "confirmed").reduce((s, b) => s + b.tokenAmount, 0)) + " tokens"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-display text-lg font-bold text-ink-900">Inventory by status</h3>
          <div className="space-y-2.5">
            {statusCounts.map(({ s, n }) => (
              <div key={s}>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span className="text-ink-800">{PLOT_STATUS[s].label}</span>
                  <span className="font-mono text-moss-500">{n}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-moss-500/10">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(n / plots.length) * 100}%`, background: PLOT_STATUS[s].fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-display text-lg font-bold text-ink-900">Latest leads</h3>
          {leads.slice(0, 5).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
              <div>
                <div className="text-sm font-bold text-ink-900">{l.name}</div>
                <div className="text-[11px] text-moss-500">{l.source} · {projectById(db, l.projectId)?.name ?? "—"} · {relTime(l.lastActivityAt)}</div>
              </div>
              <Badge tone={LEAD_STATUS[l.status].tone} dot>{LEAD_STATUS[l.status].label}</Badge>
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-moss-500">No leads yet — they'll appear here the moment they're captured.</p>}
        </div>
      </div>
    </div>
  );
}

function VInventory({ me }: { me: User }) {
  const { db } = useDB();
  const projects = db.projects.filter((p) => p.ventureId === me.ventureId);
  const [projId, setProjId] = useState(projects[0].id);
  const proj = projectById(db, projId)!;
  const plots = db.plots.filter((p) => p.projectId === projId);
  const [sel, setSel] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ number: "", sizeSqYds: "200", facing: "East", pricePerSqYd: "28000" });
  const save = () => {
    if (!f.number) { toast("Plot number is required.", "warn"); return; }
    if (plots.some((p) => p.number.toLowerCase() === f.number.toLowerCase())) { toast("That plot number already exists in this project.", "bad"); return; }
    const p = addPlot(projId, { number: f.number, sizeSqYds: +f.sizeSqYds || 200, facing: f.facing as Plot["facing"], pricePerSqYd: +f.pricePerSqYd || 28000 }, me.name);
    toast(`Plot ${p.number} added to ${proj.name} — live on the buyer map immediately.`, "good");
    setShowAdd(false);
    setF({ number: "", sizeSqYds: "200", facing: "East", pricePerSqYd: "28000" });
  };
  const selPlot = sel ? plots.find((p) => p.id === sel) : null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select className={cx(inputCls, "w-auto")} value={projId} onChange={(e) => { setProjId(e.target.value); setSel(null); }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Badge tone="plain">{plots.length} plots · {plots.filter((p) => p.status === "available").length} available</Badge>
        <div className="ml-auto"><Btn onClick={() => setShowAdd(true)}><Ic.plus size={15} /> Add plot</Btn></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PlotMap plots={plots} center={proj.center} selectedId={sel} onSelect={setSel} height={460} />
          <div className="mt-3"><PlotLegend /></div>
        </div>
        <div className="lg:col-span-5">
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {plots.map((p) => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={cx("flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all cursor-pointer",
                  sel === p.id ? "border-pine-600 ring-2 ring-pine-600/15" : "border-line hover:border-pine-500")}>
                <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-ink-900 font-display text-sm font-extrabold text-marigold-500">{p.number}</span>
                <span className="flex-1 text-xs">
                  <span className="block font-bold text-ink-900">{p.sizeSqYds} sq yd · {p.facing}</span>
                  <span className="text-moss-500">{fmtINR(p.pricePerSqYd)}/yd · updated {relTime(p.updatedAt)}</span>
                </span>
                <Badge tone={PLOT_STATUS[p.status].tone} dot>{PLOT_STATUS[p.status].label}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add plot — ${proj.name}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plot number"><input className={inputCls} placeholder="G-01" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
          <Field label="Size (sq yd)"><input type="number" className={inputCls} value={f.sizeSqYds} onChange={(e) => setF({ ...f, sizeSqYds: e.target.value })} /></Field>
          <Field label="Facing">
            <select className={inputCls} value={f.facing} onChange={(e) => setF({ ...f, facing: e.target.value })}>
              {["East", "West", "North", "South"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Rate (₹/sq yd)"><input type="number" className={inputCls} value={f.pricePerSqYd} onChange={(e) => setF({ ...f, pricePerSqYd: e.target.value })} /></Field>
        </div>
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11px] text-moss-500">
          Price changes after publishing go through the admin approval gate. New plots publish to buyer discovery instantly.
        </p>
        <Btn className="mt-4 w-full" onClick={save}>Publish plot</Btn>
      </Modal>
      {selPlot && (
        <div className="rounded-xl border border-line bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="font-display text-lg">{selPlot.number}</strong>
            <Badge tone={PLOT_STATUS[selPlot.status].tone} dot>{PLOT_STATUS[selPlot.status].label}</Badge>
          </div>
          {selPlot.heldBy && <p className="mt-1 text-xs text-moss-500">Held by {selPlot.heldBy} · expires {fmtDate(selPlot.holdExpiry)}</p>}
        </div>
      )}
    </div>
  );
}

function VLeads({ me }: { me: User }) {
  const { db } = useDB();
  const leads = scopeLeads(db, me);
  const [open, setOpen] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", phone: "", source: "Walk-in", projectId: db.projects.find((p) => p.ventureId === me.ventureId)?.id ?? "" });
  const live = open ? db.leads.find((l) => l.id === open) : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-moss-500">Only <strong className="text-ink-900">{leads.length}</strong> leads belonging to your workspace — other ventures' CRM data is invisible here by design.</p>
        <Btn onClick={() => setShowNew(true)}><Ic.plus size={15} /> Capture lead</Btn>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {leads.map((l) => (
          <button key={l.id} onClick={() => setOpen(l.id)}
            className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-pine-50 cursor-pointer">
            <span className="w-36 text-sm font-bold text-ink-900">{l.name}</span>
            <span className="w-24 text-xs text-moss-500">{l.source}</span>
            <span className="hidden flex-1 truncate text-xs text-moss-500 sm:block">{projectById(db, l.projectId)?.name ?? "—"}</span>
            <span className="font-mono text-[11px] text-moss-400">{relTime(l.lastActivityAt)}</span>
            <Badge tone={LEAD_STATUS[l.status].tone} dot>{LEAD_STATUS[l.status].label}</Badge>
          </button>
        ))}
        {leads.length === 0 && <div className="p-8"><EmptyState icon={<Ic.users size={22} />} title="No leads yet" body="Leads captured from your plots page or entered manually will land here." /></div>}
      </div>

      {live && (
        <Modal open onClose={() => setOpen(null)} title={live.name}>
          <div className="space-y-3">
            <div className="text-xs text-moss-500">{live.phone} · {live.source} · assigned to {userById(db, live.assigneeId)?.name ?? "—"}</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(LEAD_STATUS).map((s) => (
                <button key={s} onClick={() => setLeadStatus(live.id, s as typeof live.status, me.name)}
                  className={cx("rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-pointer",
                    live.status === s ? "border-ink-900 bg-ink-900 text-pine-50" : "border-line text-moss-500 hover:border-pine-500")}>
                  {LEAD_STATUS[s].label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" className="text-xs" onClick={() => { addLeadActivity(live.id, "call", "Call logged from venture workspace.", me.name, "mock-telephony"); toast("Call logged.", "steel"); }}><Ic.phone size={13} /> Log call</Btn>
              <Btn variant="outline" className="text-xs" onClick={() => { addLeadActivity(live.id, "whatsapp", "WhatsApp sent from venture workspace.", me.name, "mock-whatsapp"); toast("WhatsApp logged.", "steel"); }}><Ic.chat size={13} /> WhatsApp</Btn>
            </div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {live.activities.map((a) => (
                <div key={a.id} className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-800">
                  {a.text}<span className="mt-0.5 block font-mono text-[10px] text-moss-400">{a.by} · {relTime(a.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Capture a lead">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input className={inputCls} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} /></Field>
          <Field label="Source">
            <select className={inputCls} value={nf.source} onChange={(e) => setNf({ ...nf, source: e.target.value })}>
              {["Walk-in", "Website", "99acres", "MagicBricks", "Referral", "Instagram"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select className={inputCls} value={nf.projectId} onChange={(e) => setNf({ ...nf, projectId: e.target.value })}>
              {db.projects.filter((p) => p.ventureId === me.ventureId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Btn className="mt-4 w-full" onClick={() => {
          if (!nf.name || !nf.phone) { toast("Name and phone required.", "warn"); return; }
          const l = createLead({ name: nf.name, phone: nf.phone, source: nf.source, projectId: nf.projectId }, me.name, me.ventureId!);
          toast(`Lead ${l.id} saved to your workspace.`, "good");
          setShowNew(false); setNf({ ...nf, name: "", phone: "" });
        }}>Save lead</Btn>
      </Modal>
    </div>
  );
}

function VBookings({ me }: { me: User }) {
  const { db } = useDB();
  const plots = scopePlots(db, me);
  const bks = db.bookings.filter((b) => plots.some((p) => p.id === b.plotId));
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      {bks.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-3 last:border-0">
          <span className="w-24 font-mono text-sm font-bold text-ink-900">{b.id}</span>
          <span className="w-44 text-sm text-ink-800">{b.customerName}</span>
          <span className="flex-1 text-xs text-moss-500">{db.plots.find((p) => p.id === b.plotId)?.number} · token {fmtINR(b.tokenAmount)} · {b.payment.gateway} {b.payment.mode}</span>
          <Badge tone={b.status === "confirmed" ? "good" : b.status === "cancelled" ? "bad" : "warn"} dot>{b.status.replace("_", " ")}</Badge>
        </div>
      ))}
      {bks.length === 0 && <div className="p-8"><EmptyState icon={<Ic.wallet size={22} />} title="No bookings yet" body="When a buyer books one of your plots with a token, it lands here instantly." /></div>}
    </div>
  );
}

function VMarketing({ me }: { me: User }) {
  const { db } = useDB();
  const camps = db.campaigns.filter((c) => c.ventureId === me.ventureId);
  const [f, setF] = useState({ title: "", channel: "WhatsApp", body: "" });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h3 className="font-display text-lg font-bold text-ink-900">Draft content</h3>
        <p className="mt-1 text-xs text-moss-500">Drafts stay in your workspace. Sending to customers in bulk is a HIGH-RISK action — it routes through the admin approval gate.</p>
        <div className="mt-4 grid gap-3">
          <Field label="Campaign title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Festive offer — row E" /></Field>
          <Field label="Channel">
            <select className={inputCls} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
              {["WhatsApp", "Email", "SMS", "Instagram"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Message"><textarea className={cx(inputCls, "min-h-24 resize-none")} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <Btn onClick={() => {
            if (!f.title || !f.body) { toast("Title and message required.", "warn"); return; }
            addCampaign(me.ventureId!, f, me.name);
            toast("Draft saved — publishing requires admin approval.", "steel");
            setF({ title: "", channel: "WhatsApp", body: "" });
          }}>Save draft</Btn>
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-display text-lg font-bold text-ink-900">Your drafts ({camps.length})</h3>
        <div className="space-y-2.5">
          {camps.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-ink-900">{c.title}</strong>
                <Badge tone="plain">{c.channel} · draft</Badge>
              </div>
              <p className="mt-1.5 text-xs text-moss-500">{c.body}</p>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-moss-400">created {relTime(c.createdAt)}</div>
            </div>
          ))}
          {camps.length === 0 && <EmptyState icon={<Ic.send size={22} />} title="No drafts" body="Write your first campaign message." />}
        </div>
      </div>
    </div>
  );
}

function VProfile({ me }: { me: User }) {
  const { db } = useDB();
  const v = db.ventures.find((x) => x.id === me.ventureId)!;
  return (
    <div className="max-w-2xl rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h3 className="font-display text-xl font-bold text-ink-900">Company profile</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Venture name"><input className={inputCls} defaultValue={v.name} /></Field>
        <Field label="Contact person"><input className={inputCls} defaultValue={v.contact} /></Field>
        <Field label="Phone"><input className={inputCls} defaultValue={v.phone} /></Field>
        <Field label="District"><input className={inputCls} defaultValue={v.district} /></Field>
        <div className="sm:col-span-2"><Field label="RERA registration"><input className={inputCls} defaultValue={v.rera} /></Field></div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
        <span className="text-xs font-semibold text-moss-500">Team members in this workspace</span>
        <span className="text-sm font-bold text-ink-900">{db.users.filter((u) => u.ventureId === v.id).length} user(s)</span>
      </div>
      <Btn className="mt-4" onClick={() => toast("Profile changes saved to your workspace.", "good")}>Save changes</Btn>
      <p className="mt-3 text-[11px] text-moss-400">Profile edits are workspace-local (demo). In production these persist per-tenant via the tenancy layer.</p>
    </div>
  );
}
