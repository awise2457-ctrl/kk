import { useSyncExternalStore, useEffect, useState, type ReactNode, type SVGProps } from "react";
import { getSnapshot, subscribe } from "../lib/data";

/* ------------------------------ store hook ------------------------------- */
export const useDB = () => useSyncExternalStore(subscribe, getSnapshot);

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* --------------------------------- icons --------------------------------- */
type P = SVGProps<SVGSVGElement> & { size?: number };
const I = ({ size = 18, children, ...rest }: P & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>{children}</svg>
);
export const Ic = {
  logo: (p: P) => <I {...p}><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9 20v-6h6v6" /><path d="M9 9.5h6" /></I>,
  shield: (p: P) => <I {...p}><path d="M12 3 5 6v5c0 4.6 3 8 7 10 4-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4.5" /></I>,
  search: (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></I>,
  file: (p: P) => <I {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></I>,
  upload: (p: P) => <I {...p}><path d="M12 16V5" /><path d="m7 10 5-5 5 5" /><path d="M4 20h16" /></I>,
  pin: (p: P) => <I {...p}><path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z" /><circle cx="12" cy="11" r="2.4" /></I>,
  users: (p: P) => <I {...p}><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.4a3.4 3.4 0 0 1 0 5.8M18.5 14.6c1.8 1 3 3 3 5.4" /></I>,
  phone: (p: P) => <I {...p}><path d="M5 4h4l1.5 4.5-2.2 1.6a12 12 0 0 0 5.6 5.6l1.6-2.2L20 15v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" /></I>,
  calendar: (p: P) => <I {...p}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></I>,
  check: (p: P) => <I {...p}><path d="m4.5 12.5 5 5L19.5 7" /></I>,
  x: (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>,
  alert: (p: P) => <I {...p}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.3" r="0.4" fill="currentColor" /></I>,
  clock: (p: P) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.4 2" /></I>,
  bot: (p: P) => <I {...p}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M8 4h8" /><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" /><path d="M9 16.5h6" /></I>,
  arrowR: (p: P) => <I {...p}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></I>,
  upRight: (p: P) => <I {...p}><path d="M7 17 17 7" /><path d="M9 7h8v8" /></I>,
  plus: (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>,
  download: (p: P) => <I {...p}><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></I>,
  eye: (p: P) => <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></I>,
  lock: (p: P) => <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></I>,
  activity: (p: P) => <I {...p}><path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" /></I>,
  layers: (p: P) => <I {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m4.5 12.8 7.5 4.2 7.5-4.2" /><path d="m4.5 16.8 7.5 4.2 7.5-4.2" /></I>,
  send: (p: P) => <I {...p}><path d="m4 11 16-7-5.5 16-2.8-6.2L4 11Z" /><path d="m11.7 13.8 4.3-4.3" /></I>,
  building: (p: P) => <I {...p}><rect x="4" y="3.5" width="12" height="17" /><path d="M16 9h4v11.5" /><path d="M8 8h2M8 12h2M8 16h2M12 8h1M12 12h1M12 16h1" /><path d="M2.5 20.5h19" /></I>,
  flag: (p: P) => <I {...p}><path d="M5 21V4" /><path d="M5 4.5C8 3 10.5 6 14 4.5S19 4 19 4v9s-1.5-.5-5 1-6-1.5-9 0" /></I>,
  refresh: (p: P) => <I {...p}><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" /><path d="M4.5 4.5V8H8M19.5 19.5V16H16" /></I>,
  out: (p: P) => <I {...p}><path d="M14 4h5v16h-5" /><path d="M4 12h11" /><path d="m11 8 4 4-4 4" /></I>,
  chevD: (p: P) => <I {...p}><path d="m6 9 6 6 6-6" /></I>,
  star: (p: P) => <I {...p}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5Z" /></I>,
  zap: (p: P) => <I {...p}><path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12l1-8Z" /></I>,
  camera: (p: P) => <I {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7 10 4h4l1.5 3" /><circle cx="12" cy="13" r="3.4" /></I>,
  ruler: (p: P) => <I {...p}><rect x="2.5" y="9" width="19" height="6" rx="1.5" /><path d="M7 9v3M11 9v2.2M15 9v3M19 9v2.2" /></I>,
  chat: (p: P) => <I {...p}><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></I>,
  mail: (p: P) => <I {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></I>,
  db: (p: P) => <I {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></I>,
  key: (p: P) => <I {...p}><circle cx="8" cy="14" r="4.5" /><path d="m11.5 10.5 8-8M17 5l2.5 2.5M14 8l2 2" /></I>,
  filter: (p: P) => <I {...p}><path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6L4 5Z" /></I>,
  doc: (p: P) => <I {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="m9.5 13 2 2 3.5-4" /></I>,
  scan: (p: P) => <I {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></I>,
  wallet: (p: P) => <I {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M15.5 14.5h2" /></I>,
  compass: (p: P) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></I>,
};

/* ----------------------------- status system ----------------------------- */
export type Tone = "good" | "warn" | "bad" | "steel" | "plain" | "marigold" | "ink";
const toneChip: Record<Tone, string> = {
  good: "bg-pine-100 text-pine-800 border-pine-200",
  warn: "bg-marigold-50 text-marigold-700 border-marigold-500/30",
  bad: "bg-clay-100 text-clay-700 border-clay-600/25",
  steel: "bg-steel-100 text-steel-700 border-steel-600/25",
  plain: "bg-moss-500/10 text-moss-500 border-moss-500/20",
  marigold: "bg-marigold-100 text-marigold-700 border-marigold-600/25",
  ink: "bg-ink-800 text-pine-100 border-ink-700",
};
const toneDot: Record<Tone, string> = {
  good: "bg-pine-600", warn: "bg-marigold-500", bad: "bg-clay-600", steel: "bg-steel-600",
  plain: "bg-moss-400", marigold: "bg-marigold-600", ink: "bg-ink-800",
};

export const PLOT_STATUS: Record<string, { label: string; tone: Tone; fill: string }> = {
  available: { label: "Available", tone: "good", fill: "#1e7a4f" },
  hold_requested: { label: "Hold requested", tone: "marigold", fill: "#e39b21" },
  held: { label: "On hold", tone: "warn", fill: "#c77e12" },
  booking_requested: { label: "Booking in progress", tone: "steel", fill: "#345995" },
  booked: { label: "Booked", tone: "steel", fill: "#2a4a7c" },
  sold: { label: "Sold", tone: "plain", fill: "#5c6b62" },
  cancelled: { label: "Cancelled", tone: "bad", fill: "#a33a2a" },
};
export const JOB_STATUS: Record<string, { label: string; tone: Tone }> = {
  processing: { label: "Processing", tone: "steel" },
  extracted: { label: "Extracted", tone: "steel" },
  in_review: { label: "In human review", tone: "warn" },
  flagged: { label: "Flagged", tone: "bad" },
  completed: { label: "Report ready", tone: "good" },
};
export const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "marigold" },
  contacted: { label: "Contacted", tone: "steel" },
  site_visit: { label: "Site visit", tone: "steel" },
  negotiation: { label: "Negotiation", tone: "warn" },
  booked: { label: "Booked", tone: "good" },
  lost: { label: "Lost", tone: "bad" },
};
export const SURVEY_STATUS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "marigold" },
  assigned: { label: "Assigned", tone: "steel" },
  in_progress: { label: "In field", tone: "warn" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

/* ------------------------------- primitives ------------------------------ */
export function Badge({ tone = "plain", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide", toneChip[tone], className)}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", toneDot[tone])} />}
      {children}
    </span>
  );
}

export function Stamp({ tone = "bad", children }: { tone?: Tone; children: ReactNode }) {
  const color = tone === "bad" ? "text-clay-600" : tone === "good" ? "text-pine-700" : "text-marigold-600";
  return <span className={cx("stamp inline-block text-xs font-semibold", color)}>{children}</span>;
}

export function Btn({ variant = "primary", className, children, ...rest }: { variant?: "primary" | "dark" | "ghost" | "outline" | "danger" | "marigold"; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    primary: "bg-pine-700 text-pine-50 hover:bg-pine-600 shadow-sm shadow-pine-800/20",
    dark: "bg-ink-900 text-pine-100 hover:bg-ink-700",
    ghost: "bg-transparent text-ink-800 hover:bg-pine-50",
    outline: "bg-card border border-line text-ink-800 hover:border-pine-500 hover:text-pine-700",
    danger: "bg-clay-600 text-clay-100 hover:bg-clay-700",
    marigold: "bg-marigold-500 text-ink-900 hover:bg-marigold-600 hover:text-pine-50",
  }[variant];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer", v, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="leader py-1.5 text-sm">
      <span className="shrink-0 text-moss-500">{k}</span>
      <span className="dots" />
      <span className={cx("shrink-0 text-right font-medium text-ink-900", mono && "font-mono text-[13px]")}>{v}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("modal-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-card shadow-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card/95 px-5 py-3.5 backdrop-blur">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-moss-500 hover:bg-paper hover:text-ink-900 cursor-pointer" aria-label="Close"><Ic.x /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-ink-950/45" onClick={onClose} />
      <div className="drawer-in absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-line bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card/95 px-5 py-3.5 backdrop-blur">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-moss-500 hover:bg-paper cursor-pointer" aria-label="Close"><Ic.x /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx("shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all cursor-pointer",
            active === t.id ? "bg-ink-900 text-pine-100 shadow" : "text-moss-500 hover:text-ink-900")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-moss-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-moss-400">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-moss-400 focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15";

export function ProgressBar({ value, tone = "good", striped }: { value: number; tone?: "good" | "steel"; striped?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-moss-500/15">
      <div className={cx("h-full rounded-full transition-all duration-300",
        tone === "good" ? "bg-pine-600" : "bg-steel-600", striped && value < 100 && "progress-stripes")}
        style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function ConfidenceDial({ value, size = 120 }: { value: number; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0.02, value / 100);
  const color = value >= 75 ? "#1e7a4f" : value >= 50 ? "#c77e12" : "#a33a2a";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d8ded6" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.3,1)" }} />
      </svg>
      <div className="absolute text-center">
        <div className="count-pop font-display text-3xl font-extrabold" style={{ color }}>{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-moss-500">confidence</div>
      </div>
    </div>
  );
}

export function Sparkline({ points, width = 120, height = 36, stroke = "#1e7a4f" }: { points: number[]; width?: number; height?: number; stroke?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - 4 - ((p - min) / (max - min || 1)) * (height - 8)}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx={width} cy={height - 4 - ((points[points.length - 1] - min) / (max - min || 1)) * (height - 8)} r="3" fill={stroke} />
    </svg>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper/60 px-6 py-14 text-center">
      <div className="mb-3 rounded-xl bg-pine-50 p-3 text-pine-700">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-moss-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHead({ eyebrow, title, right }: { eyebrow?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-marigold-600">{eyebrow}</div>}
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* --------------------------------- toasts -------------------------------- */
export interface ToastMsg { id: number; text: string; tone: "good" | "warn" | "bad" | "steel"; }
let toastPush: ((t: ToastMsg) => void) | null = null;
let tid = 0;
export function toast(text: string, tone: ToastMsg["tone"] = "good") { toastPush?.({ id: ++tid, text, tone }); }

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    toastPush = (t) => {
      setList((l) => [...l.slice(-3), t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 4200);
    };
    return () => { toastPush = null; };
  }, []);
  const toneCls = { good: "border-pine-600/40 text-pine-100", warn: "border-marigold-500/50 text-marigold-50", bad: "border-clay-600/50 text-clay-100", steel: "border-steel-600/50 text-steel-100" };
  const toneBg = { good: "bg-pine-800", warn: "bg-marigold-700", bad: "bg-clay-700", steel: "bg-steel-700" };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(92vw,360px)] flex-col gap-2">
      {list.map((t) => (
        <div key={t.id} className={cx("toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur", toneBg[t.tone], toneCls[t.tone])}>
          <span className="mt-0.5 shrink-0">{t.tone === "good" ? <Ic.check size={16} /> : t.tone === "bad" ? <Ic.alert size={16} /> : <Ic.zap size={16} />}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- stat card ------------------------------- */
export function Stat({ label, value, sub, tone = "plain", spark }: { label: string; value: ReactNode; sub?: string; tone?: Tone; spark?: number[] }) {
  const accent = { good: "text-pine-700", warn: "text-marigold-600", bad: "text-clay-600", steel: "text-steel-600", plain: "text-ink-900", marigold: "text-marigold-600", ink: "text-ink-900" }[tone];
  return (
    <div className="group rounded-xl border border-line bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-[11px] font-bold uppercase tracking-wider text-moss-500">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className={cx("count-pop font-display text-[26px] font-extrabold leading-none", accent)}>{value}</div>
        {spark && <Sparkline points={spark} width={72} height={26} stroke={accent === "text-pine-700" ? "#1e7a4f" : "#345995"} />}
      </div>
      {sub && <div className="mt-1.5 text-xs text-moss-500">{sub}</div>}
    </div>
  );
}
