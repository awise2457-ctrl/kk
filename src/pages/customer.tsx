import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import {
  useDB, cx, Badge, Btn, Field, inputCls, Ic, JOB_STATUS, PLOT_STATUS, SectionHead, toast, Modal, KV,
} from "../components/ui";
import { PlotMap, PlotLegend } from "../components/map";
import { navTo, navAnchor } from "../lib/nav";
import {
  currentUser, startVerification, createSurveyRequest, requestHold, requestBooking, payBooking,
  fmtINR, fmtDate, projectById, scopePlots, BookingConflict, type Plot,
} from "../lib/data";

/* ------------------------------ public chrome ---------------------------- */
export function PublicNav() {
  const { db, session } = useDB();
  const user = currentUser();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-700 bg-ink-900/95 text-pine-100 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button onClick={() => navTo({ page: "home" })} className="flex items-center gap-2.5 cursor-pointer">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine-600 text-pine-50"><Ic.logo size={20} /></span>
          <span className="text-left leading-none">
            <span className="font-display text-lg font-extrabold tracking-tight">LandSafe</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-pine-200/70">TS · AP land platform</span>
          </span>
        </button>
        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {[["Find plots", () => navTo({ page: "find" })], ["Verify land", () => { navTo({ page: "home" }); setTimeout(() => navAnchor("verify"), 60); }], ["Surveyor", () => { navTo({ page: "home" }); setTimeout(() => navAnchor("surveyor"), 60); }], ["How it works", () => { navTo({ page: "home" }); setTimeout(() => navAnchor("how"), 60); }]].map(([label, fn]) => (
            <button key={label as string} onClick={fn as () => void} className="rounded-lg px-3 py-2 text-pine-100/80 transition-colors hover:bg-ink-800 hover:text-pine-50 cursor-pointer">{label as string}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Badge tone="warn" className="hidden sm:inline-flex">DEMO MODE</Badge>
          {user ? (
            <Btn variant="marigold" className="px-3.5 py-1.5" onClick={() => navTo({ page: "app" })}>
              My workspace <Ic.arrowR size={15} />
            </Btn>
          ) : (
            <Btn variant="marigold" className="px-3.5 py-1.5" onClick={() => navTo({ page: "login" })}>Sign in</Btn>
          )}
        </div>
      </div>
      <div className="border-t border-ink-700/60 bg-ink-950/60 px-4 py-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-marigold-500">
        {db.ventures.length} partner ventures · {db.plots.filter((p) => p.status === "available").length} plots live · sandbox data
      </div>
    </header>
  );
}

/* --------------------------------- home ---------------------------------- */
export function Home() {
  const { db } = useDB();
  const meadows = db.projects[0];
  const meadowPlots = db.plots.filter((p) => p.projectId === meadows.id);
  const avail = meadowPlots.filter((p) => p.status === "available").length;
  const [selected, setSelected] = useState<string | null>(null);

  const stats = [
    { k: "Plots available now", v: db.plots.filter((p) => p.status === "available").length },
    { k: "Documents processed", v: db.documents.filter((d) => d.status === "extracted").length },
    { k: "Partner ventures", v: db.ventures.length },
    { k: "Districts covered", v: new Set(db.projects.map((p) => p.district)).size },
  ];

  return (
    <div className="bg-paper">
      {/* ---------- record-console hero ---------- */}
      <section id="verify" className="contour grain relative overflow-hidden bg-ink-900 text-pine-50">
        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-6">
            <div className="fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-pine-600/40 bg-pine-800/30 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-pine-200">
              <Ic.shield size={13} /> Telangana · Andhra Pradesh
            </div>
            <h1 className="fade-up font-display text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Know the ground<br />
              <span className="text-marigold-500">before you buy it.</span>
            </h1>
            <p className="fade-up-1 mt-5 max-w-xl text-[15px] leading-relaxed text-pine-100/75">
              Start a land verification with the record details you have. We extract what your documents say,
              cross-check them against each other, flag mismatches, and tell you exactly what still needs a
              professional's eyes — nothing invented, nothing over-promised.
            </p>
            <VerifyForm />
          </div>
          <div className="fade-up-2 lg:col-span-6">
            <div className="rounded-2xl border border-ink-700 bg-ink-800/70 p-4 shadow-2xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-pine-200/70">Live venture inventory</div>
                  <div className="font-display text-lg font-bold">{meadows.name}</div>
                </div>
                <Badge tone="good" dot>{avail} available</Badge>
              </div>
              <PlotMap plots={meadowPlots} center={meadows.center} selectedId={selected} onSelect={setSelected} height={340} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <PlotLegend />
              </div>
              <button onClick={() => navTo({ page: "find" })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-pine-600/50 bg-pine-800/40 py-2.5 text-sm font-semibold text-pine-100 transition-colors hover:bg-pine-700 cursor-pointer">
                Browse all plots <Ic.arrowR size={15} />
              </button>
            </div>
          </div>
        </div>
        {/* stats band */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 shadow-xl lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.k} className="bg-ink-800/90 px-5 py-4">
                <div className="count-pop font-display text-3xl font-extrabold text-marigold-500">{s.v}</div>
                <div className="mt-0.5 text-xs font-medium text-pine-100/60">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- action index ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHead eyebrow="One counter, five services" title={<>Everything a land buyer needs, <span className="text-pine-700">in one safe place</span></>} />
        <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-sm">
          {[
            { n: "01", t: "Verify land", d: "Give us the survey number and record details. We open a verification file and checklist for your property.", fn: () => navAnchor("verify"), ic: <Ic.shield size={22} /> },
            { n: "02", t: "Upload documents", d: "Sale deed, pattadar passbook, EC — read automatically, key fields extracted, checked against each other.", fn: () => navTo({ page: "login" }), ic: <Ic.scan size={22} /> },
            { n: "03", t: "Book a surveyor", d: "Licensed surveyors for measurement, boundary demarcation and extent checks — with a written field report.", fn: () => navAnchor("surveyor"), ic: <Ic.ruler size={22} /> },
            { n: "04", t: "Find plots", d: "Verified venture inventory with live availability, prices and map view across Telangana and AP.", fn: () => navTo({ page: "find" }), ic: <Ic.pin size={22} /> },
            { n: "05", t: "Talk to us", d: "A human answers. Telugu, Hindi or English — whichever is easiest.", fn: () => navAnchor("contact"), ic: <Ic.phone size={22} /> },
          ].map((a, i) => (
            <button key={a.n} onClick={a.fn}
              className={cx("group flex w-full items-center gap-5 px-5 py-6 text-left transition-all duration-200 hover:bg-pine-50 sm:gap-8 sm:px-8 cursor-pointer", i % 2 === 1 && "sm:flex-row-reverse sm:text-right")}>
              <span className="font-display text-4xl font-extrabold text-line transition-colors group-hover:text-marigold-500 sm:text-5xl">{a.n}</span>
              <span className="flex-1">
                <span className="flex items-center gap-3 font-display text-xl font-bold text-ink-900 sm:text-2xl">
                  <span className="text-pine-700">{a.ic}</span>{a.t}
                </span>
                <span className="mt-1 block max-w-xl text-sm text-moss-500">{a.d}</span>
              </span>
              <span className="hidden text-moss-400 transition-all duration-200 group-hover:translate-x-1.5 group-hover:text-pine-700 sm:block"><Ic.arrowR size={22} /></span>
            </button>
          ))}
        </div>
      </section>

      <FeaturedProjects />
      <HowItWorks />
      <SurveyorBooking />
      <ContactBlock />
      <Footer />
    </div>
  );
}

function VerifyForm() {
  const { db } = useDB();
  const me = currentUser();
  const [f, setF] = useState({ state: "Telangana", district: "", mandal: "", village: "", surveyNo: "", extentAcres: "", owner: "" });
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    if (!f.district || !f.village || !f.surveyNo || !f.owner) { setErr("District, village, survey number and owner name are required."); return; }
    const job = startVerification({ ...f, extentAcres: parseFloat(f.extentAcres) || 1 }, currentUser());
    toast(`Verification file ${job.id} opened — upload documents to begin checks.`, "steel");
    navTo({ page: "verify", jobId: job.id });
  };
  return (
    <div className="fade-up-1 mt-7 rounded-2xl border border-ink-700 bg-card p-5 text-ink-900 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-base font-bold"><Ic.shield size={18} className="text-pine-700" /> Start a verification</div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-moss-400">Record extract</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State">
          <select className={inputCls} value={f.state} onChange={(e) => set("state", e.target.value)}>
            <option>Telangana</option><option>Andhra Pradesh</option>
          </select>
        </Field>
        <Field label="District"><input className={inputCls} placeholder="e.g. Rangareddy" value={f.district} onChange={(e) => set("district", e.target.value)} /></Field>
        <Field label="Mandal"><input className={inputCls} placeholder="e.g. Shamshabad" value={f.mandal} onChange={(e) => set("mandal", e.target.value)} /></Field>
        <Field label="Village"><input className={inputCls} placeholder="e.g. Mankhal" value={f.village} onChange={(e) => set("village", e.target.value)} /></Field>
        <Field label="Survey number"><input className={inputCls} placeholder="Sy. No. 245/B" value={f.surveyNo} onChange={(e) => set("surveyNo", e.target.value)} /></Field>
        <Field label="Extent (acres)"><input className={inputCls} type="number" step="0.01" placeholder="1.24" value={f.extentAcres} onChange={(e) => set("extentAcres", e.target.value)} /></Field>
        <div className="col-span-2">
          <Field label="Owner name as per documents"><input className={inputCls} placeholder="Full name" value={f.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
        </div>
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-clay-600">{err}</p>}
      <Btn className="mt-4 w-full" onClick={submit}>Open verification file <Ic.arrowR size={15} /></Btn>
      {db.jobs.some((j) => j.createdBy === (me?.id ?? "guest")) && (
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-400">Your recent files</div>
          {db.jobs.filter((j) => j.createdBy === (me?.id ?? "guest")).slice(0, 3).map((j) => (
            <button key={j.id} onClick={() => navTo({ page: "verify", jobId: j.id })} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-pine-50 cursor-pointer">
              <span className="font-mono text-xs font-semibold text-ink-800">{j.id} <span className="ml-2 font-body font-normal text-moss-500">{j.customerName}</span></span>
              <Badge tone={JOB_STATUS[j.status].tone} dot>{JOB_STATUS[j.status].label}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedProjects() {
  const { db } = useDB();
  const [main, ...rest] = db.projects;
  const statsFor = (pid: string) => {
    const ps = db.plots.filter((p) => p.projectId === pid);
    const av = ps.filter((p) => p.status === "available");
    return { total: ps.length, avail: av.length, from: av.length ? Math.min(...av.map((p) => p.pricePerSqYd)) : 0 };
  };
  const card = (pid: string, big: boolean) => {
    const p = db.projects.find((x) => x.id === pid)!;
    const s = statsFor(pid);
    const plots = db.plots.filter((x) => x.projectId === pid);
    return (
      <div key={pid} className={cx("group flex flex-col rounded-2xl border border-line bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg", big && "lg:row-span-2")}>
        <div className="relative m-3 mb-0 overflow-hidden rounded-xl">
          <PlotMap plots={plots} center={p.center} zoom={big ? 15.2 : 14.8} height={big ? 300 : 170} interactive={false} />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-marigold-600">{p.district} · {p.state}</div>
              <h3 className="font-display text-xl font-bold text-ink-900">{p.name}</h3>
            </div>
            <Badge tone="good" dot>{s.avail} available</Badge>
          </div>
          <p className="mt-1.5 text-sm text-moss-500">{p.village}, {p.mandal} · {s.total} plots · RERA {p.rera}</p>
          <div className="mt-3 flex items-end justify-between border-t border-dashed border-line pt-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-moss-500">From</div>
              <div className="font-display text-xl font-extrabold text-pine-700">{s.from ? `${fmtINR(s.from)}/yd` : "Sold out"}</div>
            </div>
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => navTo({ page: "find", findProject: pid })}>View plots <Ic.upRight size={13} /></Btn>
          </div>
        </div>
      </div>
    );
  };
  return (
    <section className="border-y border-line bg-pine-50/60 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead eyebrow="Verified venture inventory" title={<>Open layouts, honest prices</>}
          right={<Btn variant="dark" onClick={() => navTo({ page: "find" })}>All plots <Ic.arrowR size={15} /></Btn>} />
        <div className="grid gap-5 lg:grid-cols-2">
          {card(main.id, true)}
          <div className="grid gap-5">{rest.map((p) => card(p.id, false))}</div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { t: "Upload", d: "Deed, passbook, EC — photo or PDF.", ic: <Ic.upload size={18} /> },
    { t: "Read", d: "Key fields extracted automatically.", ic: <Ic.scan size={18} /> },
    { t: "Cross-check", d: "Name, survey no. and extent compared across papers.", ic: <Ic.doc size={18} /> },
    { t: "Human review", d: "A reviewer checks what the flags point at.", ic: <Ic.users size={18} /> },
    { t: "Report", d: "Confidence score, sources, warnings — downloadable.", ic: <Ic.file size={18} /> },
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionHead eyebrow="The verification pipeline" title={<>Five steps. Zero guesswork.</>} />
          <div className="relative">
            <div className="absolute left-[17px] top-4 h-[calc(100%-2rem)] w-px bg-line" />
            {steps.map((s, i) => (
              <div key={s.t} className="relative flex gap-5 pb-7 last:pb-0">
                <span className={cx("z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 font-mono text-xs font-bold",
                  i < 2 ? "border-pine-600 bg-pine-600 text-pine-50" : "border-line bg-card text-moss-500")}>{i + 1}</span>
                <div className="pt-1">
                  <div className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">{s.ic}{s.t}</div>
                  <p className="mt-0.5 text-sm text-moss-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="sticky top-28 rounded-2xl border border-ink-700 bg-ink-900 p-6 text-pine-50 shadow-xl contour">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-marigold-500">What we never claim</div>
            <ul className="space-y-4 text-sm leading-relaxed text-pine-100/85">
              {[
                ["No “title is clear” verdicts", "Not without verified evidence and a professional's review. Our report says what checks passed and what still needs human eyes."],
                ["No invented government data", "If a record can't be checked against an authoritative source, we mark it MANUAL REVIEW REQUIRED — never a green tick."],
                ["Every fact carries a source", "Each extracted number has the document it came from, a timestamp, and a confidence score."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-marigold-500"><Ic.shield size={18} /></span>
                  <span><strong className="block font-semibold text-pine-50">{t}</strong>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function SurveyorBooking() {
  const [f, setF] = useState({ customer: "", phone: "", location: "", preferredDate: "", serviceType: "Pre-purchase measurement" });
  const [done, setDone] = useState<string | null>(null);
  const services = [
    ["Pre-purchase measurement", "₹2,500", "Chain + total-station measurement before you pay a rupee."],
    ["Boundary demarcation", "₹3,500", "Corner stones located and marked with neighbours present."],
    ["Extent verification", "₹2,000", "Does the ground match the deed? Tolerance-based answer."],
    ["Subdivision guidance", "₹1,800", "Feasibility walk-through for splitting a parcel."],
  ] as const;
  const submit = () => {
    if (!f.customer || !f.phone || !f.location || !f.preferredDate) { toast("Please fill all surveyor booking fields.", "warn"); return; }
    const s = createSurveyRequest({ ...f, preferredDate: new Date(f.preferredDate).toISOString() }, currentUser()?.name ?? f.customer);
    setDone(s.id);
    toast(`Survey request ${s.id} received — we'll confirm within 4 working hours.`, "good");
  };
  return (
    <section id="surveyor" className="border-y border-line bg-card py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="Field team" title={<>Book a licensed surveyor</>} />
          <p className="-mt-1 max-w-lg text-sm leading-relaxed text-moss-500">
            Paper checks can't measure the ground. Our surveyors carry calibrated equipment,
            photograph every corner, and file a report you can hold a seller to.
          </p>
          <div className="mt-6 space-y-3">
            {services.map(([t, price, d]) => (
              <div key={t} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3 transition-all hover:border-pine-500">
                <div>
                  <div className="font-display text-[15px] font-bold text-ink-900">{t}</div>
                  <div className="text-xs text-moss-500">{d}</div>
                </div>
                <div className="shrink-0 font-mono text-sm font-semibold text-pine-700">{price}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
          {done ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-pine-100 text-pine-700"><Ic.check size={26} /></span>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink-900">Request {done} received</h3>
              <p className="mt-2 max-w-xs text-sm text-moss-500">Our ops team assigns a surveyor and confirms on call within 4 working hours. Track it from your workspace.</p>
              <Btn variant="outline" className="mt-5" onClick={() => navTo({ page: "login" })}>Track my request</Btn>
            </div>
          ) : (
            <>
              <h3 className="font-display text-xl font-bold text-ink-900">Request a visit</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Your name"><input className={inputCls} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="Full name" /></Field>
                <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 …" /></Field>
                <div className="sm:col-span-2"><Field label="Property location"><input className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Survey no., village, district" /></Field></div>
                <Field label="Preferred date"><input type="date" className={inputCls} value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
                <Field label="Service">
                  <select className={inputCls} value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value })}>
                    {services.map(([t]) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <Btn className="mt-5 w-full" onClick={submit}><Ic.ruler size={16} /> Book surveyor</Btn>
              <p className="mt-2 text-center text-[11px] text-moss-400">No advance payment — pay after the field report.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactBlock() {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHead eyebrow="Contact us" title={<>A human answers. Promise.</>} />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { ic: <Ic.phone size={18} />, t: "Call / WhatsApp", d: "+91 90000 44455 · 9am–8pm, all week", },
              { ic: <Ic.mail size={18} />, t: "Email", d: "help@landsafe.in · replies within a day" },
              { ic: <Ic.pin size={18} />, t: "Hyderabad office", d: "Plot 12, Road 3, Banjara Hills" },
              { ic: <Ic.building size={18} />, t: "Vijayawada office", d: "3rd floor, MG Road, Patamata" },
            ].map((c) => (
              <div key={c.t} className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3.5">
                <span className="mt-0.5 text-pine-700">{c.ic}</span>
                <span><strong className="block text-sm font-bold text-ink-900">{c.t}</strong><span className="text-xs text-moss-500">{c.d}</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6">
          <h3 className="font-display text-lg font-bold">Send a message</h3>
          <div className="mt-3 grid gap-3">
            <input className={inputCls} placeholder="Your name" />
            <input className={inputCls} placeholder="Phone or email" />
            <textarea className={cx(inputCls, "min-h-24 resize-none")} placeholder="How can we help?" />
            <Btn onClick={() => toast("Message logged — our team will reach out shortly.", "good")}><Ic.send size={15} /> Send</Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="contour border-t border-ink-700 bg-ink-900 py-10 text-pine-100/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-pine-600 text-pine-50"><Ic.logo size={17} /></span>
            <span className="font-display text-lg font-bold text-pine-50">LandSafe</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <button className="hover:text-pine-50 cursor-pointer" onClick={() => navTo({ page: "find" })}>Find plots</button>
            <button className="hover:text-pine-50 cursor-pointer" onClick={() => navAnchor("surveyor")}>Surveyor</button>
            <button className="hover:text-pine-50 cursor-pointer" onClick={() => navTo({ page: "login" })}>Venture login</button>
            <button className="hover:text-pine-50 cursor-pointer" onClick={() => navAnchor("contact")}>Contact</button>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-pine-100/45">
          LandSafe is a private assistance platform. We are not a government body and do not issue legal opinions on title.
          Verification reports summarise extracted documents and cross-document checks; they must be supplemented by
          independent legal and survey professional review before any purchase decision. Government-record checks are
          marked MANUAL REVIEW REQUIRED until authoritative integrations are live and tested. This build runs in
          <strong className="text-marigold-500"> DEMO MODE</strong> with simulated data, OCR and payment adapters (Razorpay test).
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------- find plots ------------------------------ */
export function FindPlots({ initialProject }: { initialProject?: string }) {
  const { db } = useDB();
  const [proj, setProj] = useState<string>(initialProject ?? "p-meadows");
  useEffect(() => { if (initialProject) setProj(initialProject); }, [initialProject]);
  const [facing, setFacing] = useState("All");
  const [maxPrice, setMaxPrice] = useState(40000);
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const project = projectById(db, proj) ?? db.projects[0];
  const plots = db.plots.filter((p) => p.projectId === project.id);
  const visible = plots.filter((p) =>
    (showAll || p.status === "available") &&
    (facing === "All" || p.facing === facing) &&
    p.pricePerSqYd <= maxPrice,
  );
  const selPlot = sel ? plots.find((p) => p.id === sel) ?? null : null;

  return (
    <div className="min-h-screen bg-paper">
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SectionHead eyebrow="Plot discovery" title={<>Find your plot</>}
          right={<Badge tone="good" dot>{plots.filter((p) => p.status === "available").length} available in {project.name}</Badge>} />
        {/* filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-3">
          <select className={cx(inputCls, "w-auto")} value={proj} onChange={(e) => { setProj(e.target.value); setSel(null); }}>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className={cx(inputCls, "w-auto")} value={facing} onChange={(e) => setFacing(e.target.value)}>
            {["All", "East", "West", "North", "South"].map((f) => <option key={f}>{f}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-moss-500">
            ≤ {fmtINR(maxPrice)}/yd
            <input type="range" min={20000} max={40000} step={500} value={maxPrice}
              onChange={(e) => setMaxPrice(+e.target.value)} className="accent-pine-700" />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-moss-500 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-pine-700" />
            Show booked / sold
          </label>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-5">
            <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
              {visible.length === 0 && (
                <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-sm text-moss-500">
                  No plots match these filters. Loosen the price cap or facing filter.
                </div>
              )}
              {visible.map((p) => (
                <button key={p.id} onClick={() => setSel(p.id)}
                  className={cx("group flex w-full items-center gap-4 rounded-xl border bg-card p-3.5 text-left transition-all duration-150 cursor-pointer",
                    sel === p.id ? "border-pine-600 ring-2 ring-pine-600/15 shadow-md" : "border-line hover:border-pine-500 hover:shadow-sm")}>
                  <span className="grid h-12 w-14 shrink-0 place-items-center rounded-lg bg-ink-900 font-display text-base font-extrabold text-marigold-500">{p.number}</span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-ink-900">{p.sizeSqYds} sq yd · {p.facing} facing</span>
                    <span className="mt-0.5 block text-xs text-moss-500">{fmtINR(p.pricePerSqYd)}/yd · total {fmtINR(p.sizeSqYds * p.pricePerSqYd)}</span>
                  </span>
                  <Badge tone={PLOT_STATUS[p.status].tone} dot>{PLOT_STATUS[p.status].label}</Badge>
                </button>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-7">
            <div className="lg:sticky lg:top-32">
              <PlotMap plots={plots} center={project.center} selectedId={sel} onSelect={setSel} height={480} />
              <div className="mt-3"><PlotLegend /></div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {selPlot && <PlotDetailModal plot={selPlot} onClose={() => setSel(null)} />}
    </div>
  );
}

function PlotDetailModal({ plot, onClose }: { plot: Plot; onClose: () => void }) {
  const { db } = useDB();
  const me = currentUser();
  const [stage, setStage] = useState<"details" | "pay" | "done">("details");
  const [method, setMethod] = useState("UPI · GPay");
  const [bookingId, setBookingId] = useState("");
  const [busy, setBusy] = useState(false);
  const total = plot.sizeSqYds * plot.pricePerSqYd;
  const canBuy = plot.status === "available" || plot.status === "held";

  const hold = () => {
    if (!me || me.role === "customer") {
      try {
        requestHold(plot.id, me?.name ?? "Guest customer");
        toast(`48-hour hold placed on ${plot.number}.`, "good");
        onClose();
      } catch (e) { toast((e as BookingConflict).message, "bad"); }
    } else { toast("Staff accounts can't hold plots — switch to a customer login.", "warn"); }
  };
  const book = async () => {
    if (!me) { toast("Sign in as a customer to book.", "warn"); navTo({ page: "login" }); return; }
    setBusy(true);
    try {
      const bk = await requestBooking(plot.id, me.name);
      setBookingId(bk.id);
      setStage("pay");
    } catch (e) { toast((e as Error).message, "bad"); }
    finally { setBusy(false); }
  };
  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      payBooking(bookingId, method);
      confetti({ particleCount: 130, spread: 75, origin: { y: 0.7 }, colors: ["#1e7a4f", "#e39b21", "#345995"] });
      setStage("done");
      setBusy(false);
    }, 900);
  };

  return (
    <Modal open onClose={onClose} title={stage === "done" ? "Booking confirmed" : `Plot ${plot.number}`}>
      {stage === "details" && (
        <div>
          <div className="grid grid-cols-2 gap-x-6">
            <KV k="Project" v={projectById(db, plot.projectId)?.name ?? "—"} mono={false} />
            <KV k="Extent" v={`${plot.sizeSqYds} sq yd`} />
            <KV k="Facing" v={plot.facing} mono={false} />
            <KV k="Rate" v={`${fmtINR(plot.pricePerSqYd)}/yd`} />
            <KV k="Plot value" v={fmtINR(total)} />
            <KV k="Status" v={PLOT_STATUS[plot.status].label} mono={false} />
          </div>
          {plot.status === "held" && plot.holdExpiry && (
            <div className="mt-3 rounded-lg border border-marigold-500/40 bg-marigold-50 px-3 py-2 text-xs font-semibold text-marigold-700">
              On hold for another buyer. You can still request a booking — if the hold lapses, first confirmed payment wins.
            </div>
          )}
          <div className="mt-4 rounded-xl border border-line bg-paper p-3.5 text-xs leading-relaxed text-moss-500">
            Booking token <strong className="text-ink-900">₹25,000</strong> via Razorpay (test mode — no real money moves, card details never touch our servers).
            Token is adjustable against registration; refundable per the venture's policy.
          </div>
          <div className="mt-4 flex gap-2.5">
            {plot.status === "available" && <Btn variant="outline" className="flex-1" onClick={hold}><Ic.clock size={15} /> Hold 48h</Btn>}
            {canBuy ? (
              <Btn className="flex-1" disabled={busy} onClick={book}>{busy ? "Locking plot…" : <>Book now <Ic.arrowR size={15} /></>}</Btn>
            ) : (
              <Badge tone={PLOT_STATUS[plot.status].tone} className="flex-1 justify-center py-2">{PLOT_STATUS[plot.status].label}</Badge>
            )}
          </div>
        </div>
      )}
      {stage === "pay" && (
        <div>
          <div className="rounded-xl border border-steel-600/30 bg-steel-100/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-steel-700">Razorpay · TEST MODE</span>
              <Ic.wallet size={18} className="text-steel-700" />
            </div>
            <div className="mt-2 font-display text-3xl font-extrabold text-ink-900">₹25,000</div>
            <div className="text-xs text-moss-500">Booking token · {bookingId} · plot {plot.number} is now lock-held for you</div>
          </div>
          <div className="mt-4 space-y-2">
            {["UPI · GPay", "UPI · PhonePe", "Netbanking", "Card (test)"].map((m) => (
              <label key={m} className={cx("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors",
                method === m ? "border-pine-600 bg-pine-50 text-pine-800" : "border-line text-ink-800 hover:border-pine-500")}>
                <input type="radio" name="pm" checked={method === m} onChange={() => setMethod(m)} className="accent-pine-700" />{m}
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-moss-400">Sandbox only. No card numbers are stored by LandSafe — tokenisation is handled by the gateway.</p>
          <Btn className="mt-3 w-full" disabled={busy} onClick={pay}>{busy ? "Processing payment…" : "Pay ₹25,000 token"}</Btn>
        </div>
      )}
      {stage === "done" && (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pine-100 text-pine-700"><Ic.check size={30} /></span>
          <h3 className="mt-4 font-display text-2xl font-extrabold text-ink-900">Plot {plot.number} is yours (pending registration)</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-moss-500">
            Booking <strong className="font-mono">{bookingId}</strong> confirmed via Razorpay test. The venture's sales team calls you within 24h for the agreement steps.
          </p>
          <div className="mt-5 flex justify-center gap-2.5">
            <Btn variant="outline" onClick={onClose}>Keep browsing</Btn>
            <Btn onClick={() => navTo({ page: me ? "app" : "login" })}>Track booking</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
