/* ============================================================================
   LandSafe service layer (demo build).
   Mirrors the production architecture: adapter boundaries (OCR / payments /
   calling / government sources), tenant-scoped access (fastapi-tenancy style),
   optimistic-locking booking transactions, audit logs, RBAC.
   Every function here maps 1:1 onto a future FastAPI endpoint.
   ========================================================================= */

export type Role = "admin" | "venture" | "sales" | "surveyor" | "customer";
export type PlotStatus =
  | "available" | "hold_requested" | "held" | "booking_requested" | "booked" | "sold" | "cancelled";
export type JobStatus = "processing" | "extracted" | "in_review" | "flagged" | "completed";
export type LeadStatus = "new" | "contacted" | "site_visit" | "negotiation" | "booked" | "lost";
export type SurveyStatus = "requested" | "assigned" | "in_progress" | "completed" | "cancelled";
export type CheckState = "pass" | "warn" | "fail";

export interface User { id: string; name: string; email: string; role: Role; ventureId?: string; title: string; }
export interface Venture { id: string; name: string; contact: string; phone: string; district: string; status: "active" | "dormant"; lastActivityAt: string; rera?: string; }
export interface Project { id: string; ventureId: string; name: string; village: string; mandal: string; district: string; state: string; totalPlots: number; center: [number, number]; rera: string; }
export interface Plot {
  id: string; projectId: string; ventureId: string; number: string; sizeSqYds: number;
  facing: "East" | "West" | "North" | "South"; pricePerSqYd: number; status: PlotStatus;
  holdExpiry?: string; heldBy?: string; version: number; updatedAt: string; polygon: [number, number][];
}
export interface PropertyRef { id: string; state: string; district: string; mandal: string; village: string; surveyNo: string; plotNo?: string; extentAcres: number; claimedOwner: string; }
export interface Extraction { field: string; value: string; confidence: number; }
export interface DocumentRec {
  id: string; jobId: string; name: string; docType: string; uploadedAt: string; sizeKB: number;
  status: "processing" | "extracted" | "failed"; engine: string; progress: number; extractions: Extraction[];
}
export interface Finding { id: string; check: string; state: CheckState; detail: string; source: string; at: string; }
export interface VerificationJob {
  id: string; propertyId: string; customerName: string; createdBy: string; createdAt: string;
  status: JobStatus; confidence: number; findings: Finding[]; flags: string[];
  reviewerNotes: string; reviewedBy?: string; completedAt?: string;
}
export interface SurveyRequest {
  id: string; customer: string; phone: string; location: string; preferredDate: string;
  serviceType: string; status: SurveyStatus; surveyorId?: string; notes: { at: string; by: string; text: string }[];
  measurements?: string; coords?: [number, number]; photos: number; createdAt: string; completedAt?: string;
}
export interface Activity { id: string; type: "call" | "whatsapp" | "email" | "sms" | "note" | "status"; text: string; at: string; by: string; adapter?: string; }
export interface Lead {
  id: string; name: string; phone: string; source: string; projectId?: string; plotId?: string;
  status: LeadStatus; assigneeId?: string; followUpDate?: string; notes: string;
  activities: Activity[]; createdAt: string; lastActivityAt: string; ventureId: string; budgetLakh?: number;
}
export interface Booking {
  id: string; plotId: string; customerName: string; tokenAmount: number; createdAt: string;
  status: "payment_pending" | "confirmed" | "cancelled";
  payment: { orderId: string; method: string; gateway: string; mode: string; capturedAt?: string };
}
export interface AuditEntry { id: string; at: string; actor: string; action: string; detail: string; tenantId?: string; severity: "info" | "warn" | "denied"; }
export interface ApprovalItem {
  id: string; title: string; detail: string; risk: "high"; status: "pending" | "approved" | "rejected";
  createdAt: string; effect?: string; decidedAt?: string; decidedBy?: string;
}
export interface GovSource { name: string; region: string; status: "available_manual" | "unavailable"; note: string; }
export interface Providers {
  ocrOutage: boolean;
  payments: { gateway: string; mode: string; keyId: string; status: "connected" };
  calling: { provider: string; status: "not_connected" | "connected_sandbox"; apiKeyMasked: string };
  gov: GovSource[];
}
export interface Campaign { id: string; ventureId: string; title: string; channel: string; body: string; status: "draft"; createdAt: string; }

export interface DB {
  rev: number;
  users: User[]; ventures: Venture[]; projects: Project[]; plots: Plot[];
  properties: PropertyRef[]; documents: DocumentRec[]; jobs: VerificationJob[];
  surveys: SurveyRequest[]; leads: Lead[]; bookings: Booking[];
  audit: AuditEntry[]; approvals: ApprovalItem[]; campaigns: Campaign[];
  providers: Providers;
  lastLogin: Record<string, string>;
  seededAt: string;
}

/* ------------------------------- utilities ------------------------------ */

const LS_KEY = "landsafe.db.v3";
let rngState = 42;
function rng() {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
let uidCounter = 1000;
export const uid = (p: string) => `${p}-${(++uidCounter).toString(36).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const H = 3600_000, D = 24 * H;
export const fmtINR = (n: number) => "₹" + n.toLocaleString("en-IN");
export const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtTime = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const relTime = (s: string) => {
  const diff = Date.now() - new Date(s).getTime();
  if (diff < 0) return "in " + relSpan(-diff);
  return relSpan(diff) + " ago";
};
const relSpan = (ms: number) => {
  if (ms < H) return Math.max(1, Math.round(ms / 60000)) + "m";
  if (ms < D) return Math.round(ms / H) + "h";
  return Math.round(ms / D) + "d";
};
export const daysSince = (s: string) => (Date.now() - new Date(s).getTime()) / D;
export const hoursUntil = (s: string) => (new Date(s).getTime() - Date.now()) / H;

/* --------------------------- OCR adapter (sim) --------------------------- */

export const OCR_PRIMARY = "Qwen2.5-VL 7B · Ollama";
export const OCR_FALLBACK = "Tesseract 5 · CPU";

const DOC_FIELD_TEMPLATES: Record<string, string[]> = {
  "Sale Deed": ["Parties (vendor/vendee)", "Survey No.", "Extent", "Consideration", "Registration date", "SRO / Doc No."],
  "Pattadar Passbook": ["Pattadar name", "Survey No.", "Extent", "Village / Mandal", "PPB number", "Khata No."],
  "Encumbrance Certificate": ["Owner name", "Survey No.", "Period covered", "Entries found", "Issuing SRO"],
  "Mutation / Revenue Record": ["Registered holder", "Survey No.", "Extent", "Mutation memo no.", "Revenue village"],
  "Layout Approval": ["Layout name", "LP number", "Total plots", "Open space %", "Approving authority"],
  "ID Proof": ["Full name", "Document number", "Date of birth", "Address"],
};

function baseConf(engine: string) {
  const hi = engine === OCR_PRIMARY ? 0.985 : 0.9;
  const lo = engine === OCR_PRIMARY ? 0.86 : 0.7;
  return lo + rng() * (hi - lo);
}
export function extractFields(docType: string, prop: PropertyRef, engine: string, opts?: { corruptExtent?: boolean; corruptName?: boolean }): Extraction[] {
  const fields = DOC_FIELD_TEMPLATES[docType] ?? ["Line 1", "Line 2", "Line 3"];
  const ext = opts?.corruptExtent ? (prop.extentAcres + 0.1).toFixed(2) : prop.extentAcres.toFixed(2);
  const name = opts?.corruptName ? prop.claimedOwner.replace("Sunita", "Suneeta") : prop.claimedOwner;
  const valFor = (f: string): string => {
    if (/survey/i.test(f)) return prop.surveyNo;
    if (/extent/i.test(f)) return `${ext} acres`;
    if (/name|parties|holder|pattadar/i.test(f)) return name;
    if (/village|mandal/i.test(f)) return `${prop.village} / ${prop.mandal}`;
    if (/consideration/i.test(f)) return fmtINR(Math.round(prop.extentAcres * 2_400_000));
    if (/registration|date/i.test(f)) return "14 Mar 2019";
    if (/SRO|Doc|PPB|Khata|memo|LP|number/i.test(f)) return `${prop.surveyNo.replace(/\D/g, "") || "45"}/2019/${Math.floor(1000 + rng() * 9000)}`;
    if (/period/i.test(f)) return "2009 – 2024";
    if (/entries/i.test(f)) return "Nil encumbrance";
    if (/plots/i.test(f)) return "48";
    if (/space/i.test(f)) return "10.2%";
    if (/authority/i.test(f)) return "DTCP / HMDA";
    if (/address/i.test(f)) return `${prop.village}, ${prop.district}`;
    if (/layout/i.test(f)) return "Green Meadows Phase I";
    return "—";
  };
  return fields.map((f) => ({ field: f, value: valFor(f), confidence: +baseConf(engine).toFixed(3) }));
}

/* ------------------------- consistency engine ---------------------------- */

export function computeChecks(job: VerificationJob, docs: DocumentRec[], prop: PropertyRef): { findings: Finding[]; confidence: number; flags: string[] } {
  const findings: Finding[] = [];
  const done = docs.filter((d) => d.status === "extracted");
  const push = (check: string, state: CheckState, detail: string, source: string) =>
    findings.push({ id: uid("F"), check, state, detail, source, at: new Date().toISOString() });

  if (done.length < 2) {
    push("Document coverage", "warn", `Only ${done.length} document(s) extracted — cross-document checks need at least 2. Upload a Sale Deed plus Pattadar Passbook or EC.`, "LandSafe Document AI");
  } else {
    const names = new Set(done.map((d) => d.extractions.find((e) => /name|parties|holder|pattadar/i.test(e.field))?.value ?? ""));
    names.delete("");
    if (names.size <= 1) push("Owner name consistency", "pass", "Claimed owner name matches across all extracted documents.", "Cross-document check");
    else push("Owner name consistency", "fail", `Name variants found: ${[...names].join("  ↔  ")}. Needs manual reconciliation.`, "Cross-document check");

    const surveys = new Set(done.map((d) => d.extractions.find((e) => /survey/i.test(e.field))?.value ?? ""));
    surveys.delete("");
    if (surveys.size <= 1) push("Survey number consistency", "pass", `Survey No. ${prop.surveyNo} consistent across documents.`, "Cross-document check");
    else push("Survey number consistency", "fail", `Different survey numbers extracted: ${[...surveys].join(", ")}.`, "Cross-document check");

    const extents = done.map((d) => parseFloat(d.extractions.find((e) => /extent/i.test(e.field))?.value ?? "0"));
    const spread = extents.length ? Math.max(...extents) - Math.min(...extents) : 0;
    if (spread <= prop.extentAcres * 0.02) push("Extent consistency", "pass", `Extent agrees within tolerance (±2%). Recorded: ${extents.map((e) => e.toFixed(2)).join(" / ")} acres.`, "Cross-document check");
    else push("Extent consistency", "fail", `Extent mismatch beyond ±2%: ${extents.map((e) => e.toFixed(2)).join(" vs ")} acres. Physical survey recommended.`, "Cross-document check");

    const hasEC = docs.some((d) => /encumbrance/i.test(d.docType));
    if (hasEC) push("Encumbrance coverage", "pass", "EC extracted; no adverse entries flagged in the extracted period.", "Document AI");
    else push("Encumbrance coverage", "warn", "No Encumbrance Certificate uploaded yet — lien history cannot be assessed.", "Checklist");
  }
  push("Government record check", "warn", "Dharani / MeeBhoomi live lookup is NOT integrated. Source status: UNAVAILABLE — marked MANUAL REVIEW REQUIRED.", "Gov-source adapter");
  push("Boundary / GIS check", "warn", "Plot boundary is an indicated location from the venture layout, not an authoritative cadastral boundary.", "GIS adapter");

  const confs = done.flatMap((d) => d.extractions.map((e) => e.confidence));
  const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
  const fails = findings.filter((f) => f.state === "fail").length;
  const warns = findings.filter((f) => f.state === "warn").length;
  const confidence = Math.round(Math.max(8, avg * 100 - fails * 16 - warns * 5));
  const flags: string[] = [];
  if (fails > 0) flags.push(`${fails} cross-document inconsistenc${fails > 1 ? "ies" : "y"} — human review required`);
  flags.push("Government records: manual review required (no live integration)");
  if (!docs.some((d) => /encumbrance/i.test(d.docType))) flags.push("Missing document: Encumbrance Certificate");
  return { findings, confidence, flags };
}

/* --------------------------------- seed ---------------------------------- */

function rect(cx: number, cy: number, w: number, h: number): [number, number][] {
  return [[cx, cy], [cx + w, cy], [cx + w, cy + h], [cx, cy + h], [cx, cy]];
}

function seed(): DB {
  rngState = 42;
  const now = Date.now();
  const users: User[] = [
    { id: "u-admin", name: "Ananya Rao", email: "owner@landsafe.in", role: "admin", title: "Founder · Admin" },
    { id: "u-v1", name: "Vikram Reddy", email: "vikram@greenacres.in", role: "venture", ventureId: "v-green", title: "Director, Green Acres" },
    { id: "u-v2", name: "Lakshmi Prasanna", email: "lakshmi@srisai.in", role: "venture", ventureId: "v-srisai", title: "Partner, Sri Sai Estates" },
    { id: "u-s1", name: "Arjun Varma", email: "arjun@landsafe.in", role: "sales", ventureId: "v-green", title: "Sales Executive" },
    { id: "u-s2", name: "Divya Krishna", email: "divya@landsafe.in", role: "sales", ventureId: "v-green", title: "Sales Executive" },
    { id: "u-sv1", name: "Suresh Kumar", email: "suresh@landsafe.in", role: "surveyor", title: "Licensed Surveyor · TS-114" },
    { id: "u-sv2", name: "Ravi Teja", email: "ravi@landsafe.in", role: "surveyor", title: "Licensed Surveyor · TS-207" },
    { id: "u-c1", name: "Ramesh Kumar", email: "ramesh@gmail.com", role: "customer", title: "Customer" },
    { id: "u-c2", name: "Sunita Devi", email: "sunita@gmail.com", role: "customer", title: "Customer" },
  ];
  const ventures: Venture[] = [
    { id: "v-green", name: "Green Acres Ventures", contact: "Vikram Reddy", phone: "+91 98490 12345", district: "Hyderabad", status: "active", lastActivityAt: iso(5 * H), rera: "P02400006712 (demo)" },
    { id: "v-srisai", name: "Sri Sai Estates", contact: "Lakshmi Prasanna", phone: "+91 94407 67890", district: "Vijayawada", status: "dormant", lastActivityAt: iso(21 * D), rera: "P07200001188 (demo)" },
  ];
  const projects: Project[] = [
    { id: "p-meadows", ventureId: "v-green", name: "Green Meadows · Phase I", village: "Mankhal", mandal: "Shamshabad", district: "Rangareddy", state: "Telangana", totalPlots: 48, center: [78.421, 17.249], rera: "P02400006712 (demo)" },
    { id: "p-kompally", ventureId: "v-green", name: "Kompally Heights", village: "Kompally", mandal: "Medchal", district: "Medchal–Malkajgiri", state: "Telangana", totalPlots: 12, center: [78.487, 17.532], rera: "P02200009034 (demo)" },
    { id: "p-enclave", ventureId: "v-srisai", name: "Sri Sai Enclave", village: "Poranki", mandal: "Penamaluru", district: "NTR", state: "Andhra Pradesh", totalPlots: 20, center: [80.662, 16.489], rera: "P07200001188 (demo)" },
  ];

  // --- procedural plot grid for Green Meadows (6 rows × 8 cols, road gap) ---
  const plots: Plot[] = [];
  const rows = ["A", "B", "C", "D", "E", "F"];
  const w = 0.00062, h = 0.00048, gapX = 0.00012, gapY = 0.0002, road = 0.00045;
  const totalW = 8 * w + 7 * gapX + road;
  const totalH = 6 * h + 5 * gapY;
  const [pcx, pcy] = projects[0].center;
  let k = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++, k++) {
      const x0 = pcx - totalW / 2 + c * (w + gapX) + (c >= 4 ? road : 0);
      const y0 = pcy - totalH / 2 + r * (h + gapY);
      const corner = c === 0 || c === 7;
      const size = 150 + Math.floor(rng() * 6) * 18 + (corner ? 20 : 0);
      const price = 26500 + Math.floor(rng() * 5) * 1800 + (r <= 1 ? 1500 : 0) + (corner ? 1200 : 0);
      const facings: Plot["facing"][] = ["East", "West", "North", "South"];
      const number = `${rows[r]}-${String(c + 1).padStart(2, "0")}`;
      let status: PlotStatus = "available";
      if (k % 17 === 3) status = "sold";
      else if (k % 13 === 5) status = "booked";
      else if (k % 11 === 2) status = "held";
      else if (k % 19 === 7) status = "hold_requested";
      plots.push({
        id: `plot-${number}`, projectId: "p-meadows", ventureId: "v-green", number,
        sizeSqYds: size, facing: facings[k % 4], pricePerSqYd: price, status,
        holdExpiry: status === "held" ? iso(-(30 + rng() * 60) * H) : undefined,
        heldBy: status === "held" ? "Walk-in customer" : undefined,
        version: 1, updatedAt: iso(rng() * 20 * D), polygon: rect(x0, y0, w, h),
      });
    }
  }
  // narrative overrides
  const setPlot = (id: string, patch: Partial<Plot>) => { const p = plots.find((x) => x.id === id)!; Object.assign(p, patch); };
  setPlot("plot-A-05", { status: "held", holdExpiry: iso(-18 * H), heldBy: "K. Mohan Rao" });            // expiring soon
  setPlot("plot-A-12", { status: "available", pricePerSqYd: 28000 });                                     // price-change approval target
  setPlot("plot-B-07", { status: "sold" });
  setPlot("plot-D-04", { status: "booking_requested" });
  setPlot("plot-C-01", { status: "cancelled" });
  // Kompally + Enclave (simpler strips)
  const addStrip = (proj: Project, count: number, prefix: string, ventureId: string) => {
    for (let i = 0; i < count; i++) {
      const number = `${prefix}-${String(i + 1).padStart(2, "0")}`;
      plots.push({
        id: `plot-${proj.id}-${number}`, projectId: proj.id, ventureId, number,
        sizeSqYds: 160 + (i % 5) * 20, facing: (["East", "West", "North", "South"] as const)[i % 4],
        pricePerSqYd: proj.id === "p-kompally" ? 31000 + (i % 3) * 1500 : 21500 + (i % 4) * 1200,
        status: i % 7 === 2 ? "sold" : i % 9 === 4 ? "held" : "available",
        holdExpiry: i % 9 === 4 ? iso(-50 * H) : undefined,
        version: 1, updatedAt: iso(3 * D + i * 5 * H),
        polygon: rect(proj.center[0] - 0.003 + (i % 6) * 0.00105, proj.center[1] - 0.0016 + Math.floor(i / 6) * 0.00075, 0.00085, 0.00055),
      });
    }
  };
  addStrip(projects[1], 12, "K", "v-green");
  addStrip(projects[2], 20, "S", "v-srisai");

  // --- verification jobs ---
  const properties: PropertyRef[] = [
    { id: "prop-1", state: "Telangana", district: "Medchal–Malkajgiri", mandal: "Medchal", village: "Dabilpur", surveyNo: "Sy. No. 245/B", extentAcres: 1.24, claimedOwner: "Ramesh Kumar" },
    { id: "prop-2", state: "Telangana", district: "Rangareddy", mandal: "Ibrahimpatnam", village: "Turkapalle", surveyNo: "Sy. No. 89/2", extentAcres: 2.05, claimedOwner: "Sunita Devi" },
  ];
  const e1 = OCR_PRIMARY;
  const docs: DocumentRec[] = [
    { id: "doc-1a", jobId: "VRF-117", name: "sale-deed-2019.pdf", docType: "Sale Deed", uploadedAt: iso(3 * D + 4 * H), sizeKB: 842, status: "extracted", engine: e1, progress: 100, extractions: extractFields("Sale Deed", properties[0], e1) },
    { id: "doc-1b", jobId: "VRF-117", name: "pattadar-passbook.jpg", docType: "Pattadar Passbook", uploadedAt: iso(3 * D + 3 * H), sizeKB: 511, status: "extracted", engine: e1, progress: 100, extractions: extractFields("Pattadar Passbook", properties[0], e1) },
    { id: "doc-1c", jobId: "VRF-117", name: "ec-2009-2024.pdf", docType: "Encumbrance Certificate", uploadedAt: iso(2 * D + 6 * H), sizeKB: 1290, status: "extracted", engine: e1, progress: 100, extractions: extractFields("Encumbrance Certificate", properties[0], e1) },
    { id: "doc-2a", jobId: "VRF-121", name: "sale-deed-2016.pdf", docType: "Sale Deed", uploadedAt: iso(9 * D), sizeKB: 976, status: "extracted", engine: e1, progress: 100, extractions: extractFields("Sale Deed", properties[1], e1) },
    { id: "doc-2b", jobId: "VRF-121", name: "mutation-record.pdf", docType: "Mutation / Revenue Record", uploadedAt: iso(9 * D - 2 * H), sizeKB: 344, status: "extracted", engine: OCR_FALLBACK, progress: 100, extractions: extractFields("Mutation / Revenue Record", properties[1], OCR_FALLBACK, { corruptExtent: true, corruptName: true }) },
  ];
  const jobs: VerificationJob[] = [
    { id: "VRF-117", propertyId: "prop-1", customerName: "Ramesh Kumar", createdBy: "u-c1", createdAt: iso(3 * D + 5 * H), status: "in_review", confidence: 0, findings: [], flags: [], reviewerNotes: "", },
    { id: "VRF-121", propertyId: "prop-2", customerName: "Sunita Devi", createdBy: "u-c2", createdAt: iso(9 * D), status: "flagged", confidence: 0, findings: [], flags: [], reviewerNotes: "" },
  ];
  for (const j of jobs) {
    const prop = properties.find((p) => p.id === j.propertyId)!;
    const r = computeChecks(j, docs.filter((d) => d.jobId === j.id), prop);
    j.findings = r.findings; j.confidence = r.confidence; j.flags = r.flags;
  }
  jobs[0].reviewerNotes = "Extractions look clean. Awaiting government-record manual check before final report.";

  // --- surveys ---
  const surveys: SurveyRequest[] = [
    { id: "SRV-2311", customer: "Mohd. Irfan", phone: "+91 90000 11223", location: "Sy. 310, Kollur, Sangareddy", preferredDate: iso(1 * D), serviceType: "Boundary demarcation", status: "requested", notes: [], photos: 0, createdAt: iso(4 * D) },
    { id: "SRV-2312", customer: "G. Swathi", phone: "+91 96525 44778", location: "Plot K-04, Kompally Heights", preferredDate: iso(-2 * D), serviceType: "Pre-purchase measurement", status: "assigned", surveyorId: "u-sv1", notes: [{ at: iso(1 * D), by: "Ananya Rao", text: "Assigned Suresh — customer available after 10am." }], photos: 0, createdAt: iso(3 * D) },
    { id: "SRV-2313", customer: "P. Narsimha", phone: "+91 94414 90912", location: "Sy. 89/2, Turkapalle", preferredDate: iso(-1 * D), serviceType: "Extent verification", status: "in_progress", surveyorId: "u-sv2", notes: [{ at: iso(2 * D), by: "Ravi Teja", text: "Reached site. Adjacent owner present, showing old fence line." }], photos: 4, coords: [78.631, 17.275], createdAt: iso(5 * D) },
    { id: "SRV-2309", customer: "Ramesh Kumar", phone: "+91 98480 22331", location: "Sy. 245/B, Dabilpur", preferredDate: iso(6 * D), serviceType: "Pre-purchase measurement", status: "completed", surveyorId: "u-sv1", measurements: "Chain: 1.23 ac (N) · 1.25 ac (S) · avg 1.24 ac — matches deed within tolerance.", photos: 9, coords: [78.468, 17.571], createdAt: iso(8 * D), completedAt: iso(5 * D), notes: [{ at: iso(5 * D), by: "Suresh Kumar", text: "Completed. NE corner stone intact; SW corner re-fixed with consent of neighbours." }] },
  ];

  // --- leads ---
  const mkAct = (type: Activity["type"], text: string, ago: number, by: string, adapter?: string): Activity =>
    ({ id: uid("ACT"), type, text, at: iso(ago), by, adapter });
  const leads: Lead[] = [
    { id: "L-1041", name: "K. Mohan Rao", phone: "+91 98491 33445", source: "99acres", projectId: "p-meadows", plotId: "plot-A-05", status: "negotiation", assigneeId: "u-s1", followUpDate: iso(-6 * H), notes: "Wants corner plot, budget ~₹55L. Hold placed on A-05.", budgetLakh: 55, ventureId: "v-green", createdAt: iso(6 * D), lastActivityAt: iso(22 * H), activities: [mkAct("call", "Discussed A-05 pricing; asked for 48h hold.", 22 * H, "Arjun Varma", "mock-telephony"), mkAct("status", "Moved to Negotiation", 2 * D, "Arjun Varma"), mkAct("whatsapp", "Sent layout PDF + price sheet.", 3 * D, "Arjun Varma", "mock-whatsapp")] },
    { id: "L-1042", name: "Swapna & Hari", phone: "+91 90302 77812", source: "Website", projectId: "p-meadows", status: "site_visit", assigneeId: "u-s2", followUpDate: iso(20 * H), notes: "Visited Sunday; liked row C. Comparing with one other venture.", budgetLakh: 48, ventureId: "v-green", createdAt: iso(9 * D), lastActivityAt: iso(7 * D), activities: [mkAct("note", "Site visit done — shortlisted C-03 / C-04.", 7 * D, "Divya Krishna")] },
    { id: "L-1043", name: "Dr. Farhan Ali", phone: "+91 98851 09090", source: "Referral", projectId: "p-kompally", status: "contacted", assigneeId: "u-s1", notes: "Referred by B-07 buyer. Wants north-facing ≥200 sq yd.", budgetLakh: 70, ventureId: "v-green", createdAt: iso(12 * D), lastActivityAt: iso(8 * D), activities: [mkAct("call", "Intro call; will visit next weekend.", 8 * D, "Arjun Varma", "mock-telephony")] },
    { id: "L-1044", name: "Venkata Ramana", phone: "+91 94408 12121", source: "Walk-in", projectId: "p-enclave", status: "new", assigneeId: "u-v2", notes: "Walk-in at Vijayawada office; interested in S-row plots.", budgetLakh: 35, ventureId: "v-srisai", createdAt: iso(2 * D), lastActivityAt: iso(2 * D), activities: [mkAct("note", "Collected brochure; prefers Telugu communication.", 2 * D, "Lakshmi Prasanna")] },
    { id: "L-1045", name: "Sravani P.", phone: "+91 96185 55670", source: "Instagram", projectId: "p-meadows", status: "new", ventureId: "v-green", notes: "DM enquiry — first-time buyer, home-loan needed.", budgetLakh: 40, createdAt: iso(5 * H), lastActivityAt: iso(5 * H), activities: [mkAct("note", "New web lead captured.", 5 * H, "System")] },
    { id: "L-1046", name: "N. Prakash", phone: "+91 90520 88990", source: "MagicBricks", projectId: "p-meadows", plotId: "plot-D-04", status: "booked", assigneeId: "u-s2", budgetLakh: 52, ventureId: "v-green", notes: "Token paid for D-04 via Razorpay (test).", createdAt: iso(1 * D), lastActivityAt: iso(3 * H), activities: [mkAct("status", "Booking requested for D-04", 3 * H, "System"), mkAct("email", "Sent token payment link (Razorpay test mode).", 20 * H, "Divya Krishna", "mock-smtp")] },
  ];

  // --- bookings ---
  const bookings: Booking[] = [
    { id: "BK-501", plotId: "plot-D-04", customerName: "N. Prakash", tokenAmount: 25000, createdAt: iso(3 * H), status: "payment_pending", payment: { orderId: "order_NxT7K2pQ8d (test)", method: "—", gateway: "Razorpay", mode: "test" } },
    { id: "BK-498", plotId: "plot-B-07", customerName: "G. Ramesh Chandra", tokenAmount: 25000, createdAt: iso(12 * D), status: "confirmed", payment: { orderId: "order_NmA21xzQ0b (test)", method: "UPI · GPay", gateway: "Razorpay", mode: "test", capturedAt: iso(12 * D - 2 * H) } },
  ];

  // --- approvals / audit / campaigns ---
  const approvals: ApprovalItem[] = [
    { id: "APR-11", title: "Inventory price change — plot A-12", detail: "₹28,000 → ₹30,500 / sq yd (Green Meadows Phase I). Proposed after row-A appreciation. Copilot flagged this as HIGH-RISK: price changes are never auto-applied.", risk: "high", status: "pending", createdAt: iso(7 * H), effect: "price:plot-A-12:30500" },
    { id: "APR-12", title: "Bulk WhatsApp message — 3 stale leads", detail: "Send project update to Swapna & Hari, Dr. Farhan Ali, N. Prakash. Copilot drafted the message; bulk sends require approval.", risk: "high", status: "pending", createdAt: iso(2 * H), effect: "bulkmsg:3" },
  ];
  const audit: AuditEntry[] = [
    { id: uid("AUD"), at: iso(3 * H), actor: "N. Prakash", action: "BOOKING_REQUESTED", detail: "plot-D-04 · token ₹25,000 · Razorpay test order created", tenantId: "v-green", severity: "info" },
    { id: uid("AUD"), at: iso(5 * H), actor: "System", action: "LEAD_CAPTURED", detail: "L-1045 Sravani P. via Instagram", tenantId: "v-green", severity: "info" },
    { id: uid("AUD"), at: iso(7 * H), actor: "Copilot", action: "APPROVAL_REQUESTED", detail: "APR-11 price change plot A-12 (high-risk)", severity: "warn" },
    { id: uid("AUD"), at: iso(9 * H), actor: "Copilot", action: "AUTO_ACTION", detail: "Drafted follow-up note for lead L-1042 (low-risk, surfaced)", severity: "info" },
    { id: uid("AUD"), at: iso(1 * D), actor: "u-v2 workspace", action: "TENANT_IDLE", detail: "Sri Sai Estates — no workspace activity for 21 days", tenantId: "v-srisai", severity: "warn" },
    { id: uid("AUD"), at: iso(2 * D), actor: "Ananya Rao", action: "REVIEW_NOTE", detail: "VRF-117 — awaiting government manual check", severity: "info" },
    { id: uid("AUD"), at: iso(3 * D), actor: "System", action: "OCR_EXTRACTED", detail: "doc-1c · EC 2009–2024 · Qwen2.5-VL 7B · Ollama", severity: "info" },
    { id: uid("AUD"), at: iso(9 * D), actor: "System", action: "VERIFICATION_FLAGGED", detail: "VRF-121 · name + extent inconsistency", severity: "warn" },
  ];
  const campaigns: Campaign[] = [
    { id: "CMP-1", ventureId: "v-green", title: "Monsoon offer — row E", channel: "WhatsApp", body: "Green Meadows Phase I: limited-period registration support on row-E plots this month.", status: "draft", createdAt: iso(2 * D) },
  ];

  return {
    rev: 1, users, ventures, projects, plots, properties, documents: docs, jobs,
    surveys, leads, bookings, audit, approvals, campaigns,
    providers: {
      ocrOutage: false,
      payments: { gateway: "Razorpay", mode: "test", keyId: "rzp_test_••••4F2A", status: "connected" },
      calling: { provider: "OmniDimension", status: "not_connected", apiKeyMasked: "" },
      gov: [
        { name: "Dharani (Telangana)", region: "TS", status: "unavailable", note: "No public API. Manual review workflow only." },
        { name: "MeeBhoomi (Andhra Pradesh)", region: "AP", status: "unavailable", note: "No public API. Manual review workflow only." },
        { name: "RERA Telangana — public project list", region: "TS", status: "available_manual", note: "Public list; verified manually by ops team." },
      ],
    },
    lastLogin: {}, seededAt: new Date(now).toISOString(),
  };
}

/* ------------------------------ store core ------------------------------- */

let db: DB = load() ?? seed();
type Listener = () => void;
const listeners = new Set<Listener>();
function load(): DB | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DB;
  } catch { return null; }
}
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* quota */ }
}
persist();

let session: { userId: string | null; prevLogin: string | null } = { userId: null, prevLogin: null };
let snapshot = { db, session, rev: db.rev };

export function subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getSnapshot() { return snapshot; }

function commit() {
  db.rev += 1;
  persist();
  snapshot = { db, session, rev: db.rev };
  listeners.forEach((l) => l());
}
function mutate(fn: (d: DB) => void) { fn(db); commit(); }

export function audit(actor: string, action: string, detail: string, severity: AuditEntry["severity"] = "info", tenantId?: string) {
  db.audit.unshift({ id: uid("AUD"), at: new Date().toISOString(), actor, action, detail, tenantId, severity });
  if (db.audit.length > 400) db.audit.length = 400;
}

/* --------------------------- auth & tenancy ------------------------------ */

export function login(userId: string) {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return;
  const prev = db.lastLogin[userId] ?? null;
  session = { userId, prevLogin: prev };
  db.lastLogin[userId] = new Date().toISOString();
  audit(u.name, "LOGIN", `${u.role} session started (demo SSO)`, "info", u.ventureId);
  commit();
}
export function logout() { session = { userId: null, prevLogin: null }; commit(); }
export const currentUser = (): User | null => (session.userId ? db.users.find((u) => u.id === session.userId) ?? null : null);
export const previousLogin = (): string | null => session.prevLogin;

/** Tenant scope guard — mirrors fastapi-tenancy row/schema isolation. */
export function scopePlots(d: DB, user: User | null): Plot[] {
  if (!user) return d.plots;
  if (user.role === "admin") return d.plots;
  if (user.ventureId) return d.plots.filter((p) => p.ventureId === user.ventureId);
  return d.plots; // customers see public availability only (no private fields exposed elsewhere)
}
export function scopeLeads(d: DB, user: User | null): Lead[] {
  if (!user) return [];
  if (user.role === "admin") return d.leads;
  if (user.ventureId) return d.leads.filter((l) => l.ventureId === user.ventureId);
  return [];
}
export function scopeJobs(d: DB, user: User | null): VerificationJob[] {
  if (!user) return [];
  if (user.role === "admin") return d.jobs;
  return d.jobs.filter((j) => j.createdBy === user.id || j.customerName === user.name);
}
export function scopeSurveys(d: DB, user: User | null): SurveyRequest[] {
  if (!user) return [];
  if (user.role === "admin") return d.surveys;
  if (user.role === "surveyor") return d.surveys.filter((s) => s.surveyorId === user.id);
  return d.surveys.filter((s) => s.customer === user.name);
}

/** Cross-tenant access attempt — must always be denied. Used by the isolation test. */
export function attemptCrossTenantRead(targetPlotId: string, byUser: User): { denied: boolean; reason: string } {
  const plot = db.plots.find((p) => p.id === targetPlotId);
  const denied = !plot || plot.ventureId !== byUser.ventureId;
  audit(byUser.name, denied ? "ACCESS_DENIED" : "ACCESS_GRANTED",
    `${byUser.role} attempted read of ${targetPlotId} (${plot?.ventureId ?? "?"})`, denied ? "denied" : "warn", byUser.ventureId);
  commit();
  return { denied, reason: denied ? "Tenant isolation enforced — row belongs to another venture's workspace." : "Same tenant." };
}

/* ------------------------------ workflows -------------------------------- */

export function startVerification(input: { state: string; district: string; mandal: string; village: string; surveyNo: string; extentAcres: number; owner: string }, by: User | null): VerificationJob {
  const prop: PropertyRef = { id: uid("PROP"), ...input, claimedOwner: input.owner };
  const job: VerificationJob = {
    id: `VRF-${Math.floor(130 + db.jobs.length + Math.random() * 40)}`, propertyId: prop.id,
    customerName: by?.name ?? "Guest", createdBy: by?.id ?? "guest", createdAt: new Date().toISOString(),
    status: "processing", confidence: 0, findings: [], flags: ["Awaiting documents — upload at least two for cross-checks"], reviewerNotes: "",
  };
  mutate((d) => { d.properties.push(prop); d.jobs.unshift(job); audit(by?.name ?? "Guest", "VERIFICATION_STARTED", `${job.id} · ${input.village}, ${input.district} · ${input.surveyNo}`); });
  // status settles to 'extracted-ready' once nothing is processing
  setTimeout(() => mutate((d) => { const j = d.jobs.find((x) => x.id === job.id); if (j && j.status === "processing") j.status = "in_review"; }), 1600);
  return job;
}

export function uploadDocument(jobId: string, fileName: string, docType: string, sizeKB: number, actor: string): DocumentRec {
  const engine = db.providers.ocrOutage ? OCR_FALLBACK : OCR_PRIMARY;
  const doc: DocumentRec = { id: uid("DOC"), jobId, name: fileName, docType, uploadedAt: new Date().toISOString(), sizeKB, status: "processing", engine, progress: 4, extractions: [] };
  mutate((d) => {
    d.documents.push(doc);
    const j = d.jobs.find((x) => x.id === jobId); if (j) { j.status = "processing"; }
    audit(actor, "DOC_UPLOADED", `${fileName} → ${jobId} · routed to ${engine}`, "info");
  });
  // simulated OCR pipeline with progress
  let t = 0;
  const tick = setInterval(() => {
    t += 14 + Math.random() * 16;
    const done = t >= 100;
    const d2 = db;
    const dd = d2.documents.find((x) => x.id === doc.id);
    const j = d2.jobs.find((x) => x.id === jobId);
    if (!dd || !j) { clearInterval(tick); return; }
    dd.progress = Math.min(100, Math.round(t));
    if (done) {
      clearInterval(tick);
      const prop = d2.properties.find((p) => p.id === j.propertyId)!;
      const corrupt = j.id === "VRF-121" && /mutation/i.test(docType);
      dd.status = "extracted";
      dd.extractions = extractFields(docType, prop, engine, { corruptExtent: corrupt, corruptName: corrupt });
      const r = computeChecks(j, d2.documents.filter((x) => x.jobId === jobId), prop);
      j.findings = r.findings; j.confidence = r.confidence; j.flags = r.flags;
      j.status = r.findings.some((f) => f.state === "fail") ? "flagged" : "in_review";
      audit("Document AI", "OCR_EXTRACTED", `${doc.id} · ${docType} · ${engine} · ${dd.extractions.length} fields`, "info");
    }
    commit();
  }, 320);
  return doc;
}

export function setJobStatus(jobId: string, status: JobStatus, actor: string, notes?: string) {
  mutate((d) => {
    const j = d.jobs.find((x) => x.id === jobId); if (!j) return;
    j.status = status;
    if (notes) j.reviewerNotes = notes;
    if (status === "completed") { j.completedAt = new Date().toISOString(); j.reviewedBy = actor; }
    audit(actor, "VERIFICATION_STATUS", `${jobId} → ${status.toUpperCase()}`, status === "flagged" ? "warn" : "info");
  });
}

export function createSurveyRequest(input: { customer: string; phone: string; location: string; preferredDate: string; serviceType: string }, actor: string): SurveyRequest {
  const s: SurveyRequest = { id: `SRV-${2320 + db.surveys.length}`, ...input, status: "requested", notes: [], photos: 0, createdAt: new Date().toISOString() };
  mutate((d) => { d.surveys.unshift(s); audit(actor, "SURVEY_REQUESTED", `${s.id} · ${input.serviceType} · ${input.location}`); });
  return s;
}
export function assignSurveyor(id: string, surveyorId: string, actor: string) {
  mutate((d) => {
    const s = d.surveys.find((x) => x.id === id); if (!s) return;
    s.surveyorId = surveyorId; s.status = "assigned";
    s.notes.push({ at: new Date().toISOString(), by: actor, text: `Assigned to ${d.users.find((u) => u.id === surveyorId)?.name}.` });
    audit(actor, "SURVEY_ASSIGNED", `${id} → ${surveyorId}`);
  });
}
export function surveyAddNote(id: string, text: string, by: string) {
  mutate((d) => { const s = d.surveys.find((x) => x.id === id); if (!s) return; s.notes.push({ at: new Date().toISOString(), by, text }); });
}
export function setSurveyStatus(id: string, status: SurveyStatus, by: string, measurements?: string) {
  mutate((d) => {
    const s = d.surveys.find((x) => x.id === id); if (!s) return;
    s.status = status;
    if (measurements) s.measurements = measurements;
    if (status === "completed") s.completedAt = new Date().toISOString();
    audit(by, "SURVEY_STATUS", `${id} → ${status.toUpperCase()}`);
  });
}

export function createLead(input: { name: string; phone: string; source: string; projectId?: string; budgetLakh?: number; notes?: string }, actor: string, ventureId: string): Lead {
  const l: Lead = {
    id: `L-${1050 + db.leads.length}`, ...input, notes: input.notes ?? "", status: "new",
    activities: [{ id: uid("ACT"), type: "note", text: "Lead captured.", at: new Date().toISOString(), by: actor }],
    createdAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), ventureId,
  };
  mutate((d) => { d.leads.unshift(l); audit(actor, "LEAD_CAPTURED", `${l.id} ${l.name} · ${l.source}`, "info", ventureId); });
  return l;
}
export function addLeadActivity(leadId: string, type: Activity["type"], text: string, by: string, adapter?: string) {
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId); if (!l) return;
    l.activities.unshift({ id: uid("ACT"), type, text, at: new Date().toISOString(), by, adapter });
    l.lastActivityAt = new Date().toISOString();
  });
}
export function setLeadStatus(leadId: string, status: LeadStatus, by: string) {
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId); if (!l) return;
    l.status = status; l.lastActivityAt = new Date().toISOString();
    l.activities.unshift({ id: uid("ACT"), type: "status", text: `Status → ${status.replace("_", " ")}`, at: new Date().toISOString(), by });
    audit(by, "LEAD_STATUS", `${leadId} → ${status.toUpperCase()}`, "info", l.ventureId);
  });
}
export function scheduleFollowUp(leadId: string, whenIso: string, by: string) {
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId); if (!l) return;
    l.followUpDate = whenIso; l.lastActivityAt = new Date().toISOString();
    l.activities.unshift({ id: uid("ACT"), type: "note", text: `Follow-up scheduled for ${fmtDate(whenIso)}.`, at: new Date().toISOString(), by });
  });
}

export function addPlot(projectId: string, input: { number: string; sizeSqYds: number; facing: Plot["facing"]; pricePerSqYd: number }, actor: string): Plot {
  const proj = db.projects.find((p) => p.id === projectId)!;
  const n = db.plots.filter((p) => p.projectId === projectId).length;
  const plot: Plot = {
    id: uid("PLOT"), projectId, ventureId: proj.ventureId, number: input.number, sizeSqYds: input.sizeSqYds,
    facing: input.facing, pricePerSqYd: input.pricePerSqYd, status: "available", version: 1,
    updatedAt: new Date().toISOString(),
    polygon: rect(proj.center[0] - 0.004 + (n % 8) * 0.00105, proj.center[1] + 0.0024 + Math.floor(n / 8) * 0.00075, 0.00085, 0.00055),
  };
  mutate((d) => {
    d.plots.push(plot);
    const v = d.ventures.find((x) => x.id === proj.ventureId); if (v) v.lastActivityAt = new Date().toISOString();
    audit(actor, "PLOT_ADDED", `${proj.name} · ${input.number} · ${input.sizeSqYds} sq yd · ${fmtINR(input.pricePerSqYd)}/yd`, "info", proj.ventureId);
  });
  return plot;
}

export function proposePriceChange(plotId: string, newPrice: number, by: string): ApprovalItem {
  const plot = db.plots.find((p) => p.id === plotId)!;
  const item: ApprovalItem = {
    id: `APR-${13 + db.approvals.length}`, title: `Inventory price change — plot ${plot.number}`,
    detail: `${fmtINR(plot.pricePerSqYd)} → ${fmtINR(newPrice)} / sq yd. HIGH-RISK: price changes always require explicit approval.`,
    risk: "high", status: "pending", createdAt: new Date().toISOString(), effect: `price:${plotId}:${newPrice}`,
  };
  mutate((d) => { d.approvals.unshift(item); audit(by, "APPROVAL_REQUESTED", `${item.id} price change ${plot.number}`, "warn", plot.ventureId); });
  return item;
}
export function decideApproval(id: string, approve: boolean, by: string) {
  mutate((d) => {
    const a = d.approvals.find((x) => x.id === id); if (!a || a.status !== "pending") return;
    a.status = approve ? "approved" : "rejected"; a.decidedAt = new Date().toISOString(); a.decidedBy = by;
    if (approve && a.effect?.startsWith("price:")) {
      const [, plotId, price] = a.effect.split(":");
      const p = d.plots.find((x) => x.id === plotId);
      if (p) { p.pricePerSqYd = +price; p.version += 1; p.updatedAt = new Date().toISOString(); }
    }
    audit(by, approve ? "APPROVAL_GRANTED" : "APPROVAL_DENIED", `${a.id} · ${a.title}`, approve ? "info" : "warn");
  });
}

/* ------------------- booking with optimistic locking --------------------- */

export class BookingConflict extends Error { constructor(msg: string) { super(msg); this.name = "BookingConflict"; } }

/** Transactional hold → booking. Version-checked inside the commit, so two
    concurrent requests for the same plot can never both succeed. */
export function requestHold(plotId: string, customer: string): Plot {
  let result: Plot | null = null;
  mutate((d) => {
    const p = d.plots.find((x) => x.id === plotId);
    if (!p || p.status !== "available") throw new BookingConflict(`Plot ${p?.number ?? plotId} is not available.`);
    p.status = "held"; p.heldBy = customer;
    p.holdExpiry = new Date(Date.now() + 48 * H).toISOString();
    p.version += 1; p.updatedAt = new Date().toISOString();
    audit(customer, "PLOT_HELD", `${p.number} · 48h hold (token-free)`, "info", p.ventureId);
    result = p;
  });
  return result!;
}

export async function requestBooking(plotId: string, customer: string, expectedVersion?: number): Promise<Booking> {
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120)); // network jitter
  let booking: Booking | null = null;
  mutate((d) => {
    const p = d.plots.find((x) => x.id === plotId);
    if (!p) throw new BookingConflict("Plot not found.");
    if (expectedVersion !== undefined && p.version !== expectedVersion)
      throw new BookingConflict(`Conflict: plot ${p.number} changed hands mid-request (version ${expectedVersion} → ${p.version}). Second booking rejected.`);
    if (!["available", "held"].includes(p.status))
      throw new BookingConflict(`Plot ${p.number} is ${p.status.replace("_", " ")} — cannot book.`);
    p.status = "booking_requested"; p.version += 1; p.updatedAt = new Date().toISOString();
    booking = {
      id: `BK-${510 + d.bookings.length}`, plotId, customerName: customer, tokenAmount: 25000,
      createdAt: new Date().toISOString(), status: "payment_pending",
      payment: { orderId: `order_${Math.random().toString(36).slice(2, 12)} (test)`, method: "—", gateway: "Razorpay", mode: "test" },
    };
    d.bookings.unshift(booking);
    audit(customer, "BOOKING_REQUESTED", `${p.number} · token ₹25,000 · Razorpay test order`, "info", p.ventureId);
  });
  return booking!;
}
export function payBooking(bookingId: string, method: string): Booking {
  let b: Booking | null = null;
  mutate((d) => {
    const bk = d.bookings.find((x) => x.id === bookingId);
    if (!bk || bk.status !== "payment_pending") throw new BookingConflict("Booking is not awaiting payment.");
    bk.status = "confirmed";
    bk.payment.method = method; bk.payment.capturedAt = new Date().toISOString();
    const p = d.plots.find((x) => x.id === bk.plotId);
    if (p) { p.status = "booked"; p.version += 1; p.updatedAt = new Date().toISOString(); }
    audit(bk.customerName, "PAYMENT_CAPTURED", `${bk.id} · ${fmtINR(bk.tokenAmount)} · Razorpay test · ${method} (card data never stored)`, "info", p?.ventureId);
    b = bk;
  });
  return b!;
}
export function markPlotSold(plotId: string, by: string) {
  mutate((d) => { const p = d.plots.find((x) => x.id === plotId); if (p) { p.status = "sold"; p.version += 1; audit(by, "PLOT_SOLD", p.number, "info", p.ventureId); } });
}
export function cancelBooking(bookingId: string, by: string) {
  mutate((d) => {
    const bk = d.bookings.find((x) => x.id === bookingId); if (!bk || bk.status === "cancelled") return;
    bk.status = "cancelled";
    const p = d.plots.find((x) => x.id === bk.plotId);
    if (p && p.status === "booking_requested") { p.status = "available"; p.heldBy = undefined; p.holdExpiry = undefined; p.version += 1; }
    audit(by, "BOOKING_CANCELLED", `${bk.id} · ${bk.plotId}`, "warn");
  });
}

/** Fires two simultaneous booking attempts at one plot. Exactly one must win. */
export async function runConcurrencyTest(plotId: string): Promise<{ a: { ok: boolean; msg: string }; b: { ok: boolean; msg: string } }> {
  const p = db.plots.find((x) => x.id === plotId);
  const v = p?.version ?? 0;
  const attempt = async (who: string) => {
    try { const bk = await requestBooking(plotId, who, v); return { ok: true, msg: `${bk.id} created — plot locked at version ${v + 1}.` }; }
    catch (e) { return { ok: false, msg: (e as Error).message }; }
  };
  const [a, b] = await Promise.all([attempt("Customer A (simultaneous)"), attempt("Customer B (simultaneous)")]);
  audit("QA Harness", "CONCURRENCY_TEST", `plot ${plotId}: A=${a.ok ? "WON" : "rejected"} · B=${b.ok ? "WON" : "rejected"}`, a.ok !== b.ok ? "info" : "warn");
  return { a, b };
}

/* --------------------------- provider controls --------------------------- */

export function setOcrOutage(on: boolean, by: string) {
  mutate((d) => { d.providers.ocrOutage = on; audit(by, "OCR_ADAPTER", on ? "Simulated Ollama outage — Tesseract fallback active" : "Primary OCR restored (Qwen2.5-VL · Ollama)", on ? "warn" : "info"); });
}
export function saveCallingKey(key: string, by: string) {
  mutate((d) => {
    const c = d.providers.calling;
    if (key.trim().length < 8) { c.status = "not_connected"; c.apiKeyMasked = ""; return; }
    c.status = "connected_sandbox";
    c.apiKeyMasked = key.trim().slice(0, 4) + "••••••" + key.trim().slice(-4);
    audit(by, "CALLING_PROVIDER", `OmniDimension key stored encrypted-at-rest (sandbox) · ${c.apiKeyMasked}`, "info");
  });
}
export function addCampaign(ventureId: string, input: { title: string; channel: string; body: string }, by: string) {
  mutate((d) => { d.campaigns.unshift({ id: `CMP-${2 + d.campaigns.length}`, ventureId, ...input, status: "draft", createdAt: new Date().toISOString() }); audit(by, "CAMPAIGN_DRAFT", input.title, "info", ventureId); });
}
export function resetDemo() {
  localStorage.removeItem(LS_KEY);
  db = seed();
  session = { userId: null, prevLogin: null };
  commit();
}

/* ------------------------------ selectors -------------------------------- */

export const projectById = (d: DB, id?: string) => d.projects.find((p) => p.id === id);
export const ventureById = (d: DB, id?: string) => d.ventures.find((v) => v.id === id);
export const userById = (d: DB, id?: string) => d.users.find((u) => u.id === id);
export const plotById = (d: DB, id: string) => d.plots.find((p) => p.id === id);
export const plotLabel = (d: DB, plotId: string) => {
  const p = plotById(d, plotId); if (!p) return plotId;
  const proj = projectById(d, p.projectId);
  return `${proj?.name ?? ""} · ${p.number}`;
};
