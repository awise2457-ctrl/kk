/* ============================================================================
   LandSafe Copilot — "AI co-founder", not a chatbot.
   A proactive digest engine + a permission-aware tool layer. The proactive
   digest and conversational answers both draw from the same tools, so a
   venture user's digest can only ever surface their own tenant's data.
   ========================================================================= */

import {
  type DB, type User, type Lead, type Plot, type VerificationJob, type SurveyRequest,
  scopePlots, scopeLeads, scopeJobs, scopeSurveys,
  daysSince, hoursUntil, relTime, fmtINR, fmtDate,
  addLeadActivity, scheduleFollowUp, plotLabel, projectById, ventureById,
} from "./data";

export interface DigestItem {
  id: string;
  kind: "stale_lead" | "overdue_survey" | "doc_review" | "hold_expiry" | "inconsistency" | "idle_venture" | "new_activity";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  age: string;
  link?: { page: string; id: string };
  action?: { label: string; lowRisk: boolean; run: (user: User) => string };
}
export interface Digest {
  attention: DigestItem[];
  sinceLogin: { label: string; count: number }[];
  autoActions: { at: string; text: string }[];
}

const staleLeadDays = 4;

export function getAttentionDigest(d: DB, user: User, prevLogin: string | null): Digest {
  const items: DigestItem[] = [];
  const leads = scopeLeads(d, user);
  const plots = scopePlots(d, user);
  const jobs = scopeJobs(d, user);
  const surveys = scopeSurveys(d, user);
  const isAdmin = user.role === "admin";

  // stale leads
  for (const l of leads) {
    if (["booked", "lost"].includes(l.status)) continue;
    const days = daysSince(l.lastActivityAt);
    if (days >= staleLeadDays) {
      items.push({
        id: `stale-${l.id}`, kind: "stale_lead", severity: days > 7 ? "high" : "medium",
        title: `Lead ${l.name} went quiet`,
        detail: `${l.id} · ${l.status.replace("_", " ")} · last activity ${Math.round(days)}d ago (${l.source}). ${l.followUpDate && new Date(l.followUpDate) < new Date() ? "Follow-up date already passed." : ""}`,
        age: relTime(l.lastActivityAt),
        link: { page: "leads", id: l.id },
        action: {
          label: "Draft follow-up note", lowRisk: true,
          run: (u) => {
            addLeadActivity(l.id, "note", `Copilot drafted: "Reconnect — share ${projectById(d, l.projectId)?.name ?? "project"} price sheet and this week's site-visit slots."`, u.name);
            scheduleFollowUp(l.id, new Date(Date.now() + 24 * 3600_000).toISOString(), u.name);
            return `Drafted a follow-up for ${l.name} and scheduled it tomorrow (low-risk — no message sent).`;
          },
        },
      });
    }
  }

  // overdue / due surveys
  for (const s of surveys) {
    const overdue = new Date(s.preferredDate) < new Date() && ["requested", "assigned"].includes(s.status);
    const stuck = s.status === "in_progress" && daysSince(s.createdAt) > 6;
    if (overdue || stuck) {
      items.push({
        id: `srv-${s.id}`, kind: "overdue_survey", severity: overdue ? "high" : "medium",
        title: overdue ? `Survey ${s.id} is past its preferred date` : `Survey ${s.id} has been in the field for ${Math.round(daysSince(s.createdAt))} days`,
        detail: `${s.serviceType} · ${s.location} · customer ${s.customer}${s.surveyorId ? ` · ${d.users.find((u) => u.id === s.surveyorId)?.name}` : " · unassigned"}.`,
        age: relTime(s.preferredDate),
        link: { page: "surveys", id: s.id },
        action: !s.surveyorId && isAdmin
          ? { label: "Assign Suresh Kumar", lowRisk: false, run: () => "Opening the assign dialog — assignment touches the field team's schedule, so it's a one-tap manual step." }
          : undefined,
      });
    }
  }

  // verification review queue
  for (const j of jobs) {
    if (["in_review", "flagged"].includes(j.status) && daysSince(j.createdAt) > 1.5) {
      const fails = j.findings.filter((f) => f.state === "fail").length;
      items.push({
        id: `job-${j.id}`, kind: fails ? "inconsistency" : "doc_review", severity: fails ? "high" : "medium",
        title: fails ? `${j.id} has ${fails} inconsistency flag${fails > 1 ? "s" : ""}` : `${j.id} waiting in review queue`,
        detail: `${j.customerName} · confidence ${j.confidence}% · ${j.flags[0] ?? ""}`,
        age: relTime(j.createdAt),
        link: { page: "verifications", id: j.id },
      });
    }
  }

  // holds about to expire
  for (const p of plots) {
    if (p.status === "held" && p.holdExpiry) {
      const hrs = hoursUntil(p.holdExpiry);
      if (hrs < 24) {
        items.push({
          id: `hold-${p.id}`, kind: "hold_expiry", severity: hrs < 6 ? "high" : "medium",
          title: `Hold on ${p.number} ${hrs < 0 ? "expired" : `expires in ${Math.max(1, Math.round(hrs))}h`}`,
          detail: `${plotLabel(d, p.id)} · held by ${p.heldBy ?? "customer"} · ${fmtINR(p.pricePerSqYd)}/sq yd. ${hrs < 0 ? "Plot is past its hold window." : "Nudge the customer or release the plot."}`,
          age: p.holdExpiry ? relTime(p.holdExpiry) : "",
          link: { page: "inventory", id: p.id },
        });
      }
    }
  }

  // idle ventures (admin only)
  if (isAdmin) {
    for (const v of d.ventures) {
      if (daysSince(v.lastActivityAt) > 14) {
        items.push({
          id: `idle-${v.id}`, kind: "idle_venture", severity: "low",
          title: `${v.name} workspace has been quiet`,
          detail: `No venture activity for ${Math.round(daysSince(v.lastActivityAt))} days. A check-in call might re-engage them.`,
          age: relTime(v.lastActivityAt),
          link: { page: "ventures", id: v.id },
        });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  items.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // new activity since last login
  const since = prevLogin ? new Date(prevLogin).getTime() : Date.now() - 24 * 3600_000;
  const countSince = (arr: { createdAt?: string; at?: string }[]) =>
    arr.filter((x) => new Date((x.createdAt ?? x.at)!).getTime() > since).length;
  const sinceLogin = [
    { label: "New leads", count: countSince(scopeLeads(d, user)) },
    { label: "Booking requests", count: countSince(d.bookings.filter((b) => !user.ventureId || plotVenture(d, b.plotId) === user.ventureId || isAdmin)) },
    { label: "Document uploads", count: countSince(d.documents.filter((doc) => jobs.some((j) => j.id === doc.jobId)).map((doc) => ({ createdAt: doc.uploadedAt }))) },
    { label: "Survey completions", count: surveys.filter((s) => s.completedAt && new Date(s.completedAt).getTime() > since).length },
  ];

  const autoActions = d.audit
    .filter((a) => a.action === "AUTO_ACTION" || a.action === "APPROVAL_REQUESTED")
    .slice(0, 4)
    .map((a) => ({ at: a.at, text: a.detail }));

  return { attention: items.slice(0, 8), sinceLogin, autoActions };
}
const plotVenture = (d: DB, plotId: string) => d.plots.find((p) => p.id === plotId)?.ventureId;

/* ------------------------- conversational tools -------------------------- */

export interface CopilotReply {
  text: string;
  rows?: { label: string; value: string; tone?: "good" | "warn" | "bad" | "plain" }[];
  doneAction?: string;
}

export function copilotAsk(d: DB, user: User, raw: string): CopilotReply {
  const q = raw.toLowerCase();
  const leads = scopeLeads(d, user);
  const plots = scopePlots(d, user);
  const jobs = scopeJobs(d, user);
  const surveys = scopeSurveys(d, user);
  const scopeNote = user.role === "venture" || user.role === "sales"
    ? ` (scoped to ${ventureById(d, user.ventureId)?.name ?? "your"} workspace)`
    : user.role === "surveyor" ? " (your assignments only)" : user.role === "customer" ? " (your records only)" : "";

  const intent = (re: RegExp) => re.test(q);

  if (intent(/attention|today|digest|priorit/)) {
    const dig = getAttentionDigest(d, user, null);
    return {
      text: `${dig.attention.length} thing${dig.attention.length === 1 ? "" : "s"} need attention${scopeNote}. Top items:`,
      rows: dig.attention.slice(0, 5).map((i) => ({ label: i.title, value: i.age, tone: i.severity === "high" ? "bad" : i.severity === "medium" ? "warn" : "plain" })),
    };
  }
  if (intent(/new lead|recent lead|show.*lead/)) {
    const recent = [...leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);
    return {
      text: recent.length ? `Latest leads${scopeNote}:` : `No leads in your scope yet${scopeNote}.`,
      rows: recent.map((l) => ({ label: `${l.id} · ${l.name} (${l.source})`, value: `${l.status.replace("_", " ")} · ${relTime(l.createdAt)}`, tone: l.status === "new" ? "warn" : "plain" })),
    };
  }
  if (intent(/follow.?up/)) {
    const due = leads.filter((l) => l.followUpDate && !["booked", "lost"].includes(l.status))
      .sort((a, b) => +new Date(a.followUpDate!) - +new Date(b.followUpDate!));
    return {
      text: due.length ? `Leads with follow-ups${scopeNote}:` : "No open follow-ups in your scope.",
      rows: due.map((l) => ({
        label: `${l.name} · ${l.id}`,
        value: `${fmtDate(l.followUpDate)} ${new Date(l.followUpDate!) < new Date() ? "· OVERDUE" : ""}`,
        tone: new Date(l.followUpDate!) < new Date() ? "bad" : "warn",
      })),
    };
  }
  if (intent(/available|which plot|plot.*free|inventory/)) {
    const avail = plots.filter((p) => p.status === "available");
    const byProj = new Map<string, Plot[]>();
    avail.forEach((p) => byProj.set(p.projectId, [...(byProj.get(p.projectId) ?? []), p]));
    return {
      text: `${avail.length} plots available${scopeNote} across ${byProj.size} project(s):`,
      rows: [...byProj.entries()].map(([pid, ps]) => ({
        label: projectById(d, pid)?.name ?? pid,
        value: `${ps.length} available · from ${fmtINR(Math.min(...ps.map((p) => p.pricePerSqYd)))}/yd`,
        tone: "good",
      })),
    };
  }
  if (intent(/verif|inconsisten|discrepan|flagged document|document.*review/)) {
    const flagged = jobs.filter((j) => j.findings.some((f) => f.state === "fail"));
    const review = jobs.filter((j) => ["in_review", "flagged"].includes(j.status));
    if (intent(/inconsisten|discrepan/)) {
      return {
        text: flagged.length ? `Documents with inconsistency flags${scopeNote}:` : "No inconsistency flags right now — all cross-document checks agree.",
        rows: flagged.map((j) => ({
          label: `${j.id} · ${j.customerName}`,
          value: j.findings.filter((f) => f.state === "fail").map((f) => f.check).join(" · "),
          tone: "bad",
        })),
      };
    }
    return {
      text: `${review.length} verification(s) need review${scopeNote}:`,
      rows: review.map((j) => ({ label: `${j.id} · ${j.customerName}`, value: `${j.status.replace("_", " ")} · confidence ${j.confidence}%`, tone: j.status === "flagged" ? "bad" : "warn" })),
    };
  }
  if (intent(/booking/)) {
    const bks = d.bookings.filter((b) => {
      if (isAdmin(d, user)) return true;
      if (user.role === "customer") return b.customerName === user.name;
      if (user.ventureId) return plotVenture(d, b.plotId) === user.ventureId;
      return false;
    });
    const today = bks.filter((b) => daysSince(b.createdAt) < 1);
    const value = bks.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.tokenAmount, 0);
    return {
      text: `Booking summary${scopeNote}: ${bks.length} total · ${today.length} in the last 24h · ${fmtINR(value)} in tokens.`,
      rows: bks.slice(0, 5).map((b) => ({
        label: `${b.id} · ${b.customerName} · ${plotLabel(d, b.plotId)}`,
        value: `${b.status.replace("_", " ")} · ${fmtINR(b.tokenAmount)}`,
        tone: b.status === "confirmed" ? "good" : b.status === "cancelled" ? "bad" : "warn",
      })),
    };
  }
  if (intent(/sales report|summar.*business|report/)) {
    const pipeline = leads.filter((l) => !["lost", "booked"].includes(l.status)).reduce((s, l) => s + (l.budgetLakh ?? 0), 0);
    const won = leads.filter((l) => l.status === "booked").length;
    const avail = plots.filter((p) => p.status === "available").length;
    return {
      text: `Business snapshot${scopeNote}:`,
      rows: [
        { label: "Open pipeline", value: `₹${pipeline} L estimated across ${leads.filter((l) => !["lost", "booked"].includes(l.status)).length} leads`, tone: "plain" },
        { label: "Won this period", value: `${won} booking(s) confirmed`, tone: "good" },
        { label: "Sellable inventory", value: `${avail} plots available`, tone: "good" },
        { label: "Verification queue", value: `${jobs.filter((j) => ["in_review", "flagged"].includes(j.status)).length} awaiting review`, tone: "warn" },
      ],
    };
  }
  if (intent(/overdue.*survey|survey.*overdue|pending survey/)) {
    const od = surveys.filter((s) => new Date(s.preferredDate) < new Date() && !["completed", "cancelled"].includes(s.status));
    return {
      text: od.length ? `Overdue survey requests${scopeNote}:` : "No overdue surveys in your scope.",
      rows: od.map((s) => ({ label: `${s.id} · ${s.customer}`, value: `${s.serviceType} · preferred ${fmtDate(s.preferredDate)}`, tone: "bad" })),
    };
  }
  if (intent(/create.*follow|add.*task|schedule/)) {
    const lead = leads.find((l) => q.includes(l.name.toLowerCase().split(" ")[0]) || q.includes(l.id.toLowerCase()));
    if (lead) {
      addLeadActivity(lead.id, "note", `Copilot: follow-up task created from chat by ${user.name}.`, user.name);
      scheduleFollowUp(lead.id, new Date(Date.now() + 24 * 3600_000).toISOString(), user.name);
      return { text: `Done — low-risk write executed and logged.`, doneAction: `Follow-up task created for ${lead.name} (${lead.id}), scheduled tomorrow. You'll see it in the activity feed; nothing was sent to the customer.` };
    }
    return { text: "I can create a follow-up task. Which lead? Mention a name or lead ID (e.g. “create follow-up for L-1042”)." };
  }
  if (intent(/stale/)) {
    const stale = leads.filter((l) => !["booked", "lost"].includes(l.status) && daysSince(l.lastActivityAt) >= staleLeadDays);
    return {
      text: stale.length ? `Stale leads (no activity ≥ ${staleLeadDays} days)${scopeNote}:` : "No stale leads — pipeline is warm.",
      rows: stale.map((l) => ({ label: `${l.name} · ${l.source}`, value: `quiet ${Math.round(daysSince(l.lastActivityAt))}d`, tone: "bad" })),
    };
  }
  if (intent(/help|what can/)) {
    return {
      text: "I run on a permission-aware tool layer — I only ever see your scoped data. Try:",
      rows: [
        { label: "“What needs attention today?”", value: "proactive digest" },
        { label: "“Show new leads” / “Which leads need follow-up?”", value: "search_leads" },
        { label: "“Which plots are available?”", value: "search_inventory" },
        { label: "“Find documents with inconsistencies”", value: "search_verifications" },
        { label: "“Summarize today's bookings” / “Prepare a sales report”", value: "summarize_business" },
        { label: "“Create a follow-up for L-1042”", value: "create_followup (low-risk, logged)" },
      ],
    };
  }
  return {
    text: "I couldn't map that to one of my tools. I handle leads, inventory, verifications, surveys, bookings and reports — and I proactively flag what needs attention. Try one of:",
    rows: [
      { label: "“What needs attention today?”", value: "" },
      { label: "“Which plots are available?”", value: "" },
      { label: "“Show overdue survey requests”", value: "" },
    ],
  };
}
const isAdmin = (_d: DB, u: User) => u.role === "admin";

export const COPILOT_SUGGESTIONS = [
  "What needs attention today?",
  "Show new leads",
  "Which plots are available?",
  "Which leads need follow-up?",
  "Find documents with inconsistencies",
  "Summarize today's bookings",
  "Prepare a sales report",
  "Show overdue survey requests",
  "Create a follow-up for L-1042",
];
