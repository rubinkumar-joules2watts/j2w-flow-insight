import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Check, IndianRupee, Pencil } from "lucide-react";

/** Strip to digits only (session amounts stored without ₹/commas). */
export function stripToDigitString(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/** Indian-style grouping (en-IN) for whole rupees; empty string if no digits. */
export function formatIndianGroupedFromDigits(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return digits;
  return Math.trunc(n).toLocaleString("en-IN");
}

/** Parse user-entered amounts into rupees. Supports lac/lakh, cr/crore, commas. */
export function parseRevenueInRupees(raw: string): number {
  const s = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/\s+/g, " ");
  if (!s) return 0;
  let mult = 1;
  let numPart = s;
  if (/\b(cr|crore)\b/.test(s) || s.endsWith("cr")) {
    mult = 1e7;
    numPart = s.replace(/\b(cr|crore)\b/gi, "").replace(/inr/gi, "").trim();
  } else if (/\b(lac|lakh|lk)\b/.test(s) || s.endsWith("l")) {
    mult = 1e5;
    numPart = s.replace(/\b(lac|lakh|lk)\b/gi, "").trim();
  }
  const n = parseFloat(numPart.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n * mult);
}

/** Plain rupee display: ₹ + integer rupees with Indian grouping (no Lac/Cr). */
export function formatRupeeCompact(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  const rounded = Math.round(amount);
  if (rounded === 0) return "₹ 0";
  return `₹ ${rounded.toLocaleString("en-IN")}`;
}

/** Whole rupees with Indian grouping for session-derived strings (parse still accepts commas). */
export function formatSessionAmountFromRupees(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return Math.round(amount).toLocaleString("en-IN");
}

export function formatPercentDisplay(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "—";
  const n = parseFloat(s.replace(/%/g, ""));
  if (!Number.isFinite(n)) return s;
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

/** Parse a user-entered percent (with or without % sign). Returns null if empty / invalid. */
export function parsePercentCell(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/%/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function formatPercentFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n - Math.round(n));
  const decimals = abs < 0.05 ? 0 : 1;
  return `${n.toFixed(decimals)}%`;
}

type RevenueInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
  onBlur?: () => void;
};

/** Polished amount input — session-only; not wired to any API. */
export function RevenueAmountInput({ value, onChange, placeholder = "e.g. 80,00,000", compact, onBlur }: RevenueInputProps) {
  const inputClass = compact
    ? "py-2 pl-2 pr-2 text-sm font-bold tabular-nums tracking-tight text-slate-950 placeholder:text-slate-400 placeholder:font-medium"
    : "py-2.5 pl-2.5 pr-2.5 text-base font-extrabold tabular-nums tracking-tight text-slate-950 placeholder:text-slate-400 placeholder:font-medium";
  const digits = stripToDigitString(value);
  const display = formatIndianGroupedFromDigits(digits);
  return (
    <div
      className={`group relative flex items-stretch rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-[box-shadow,border-color] duration-150 focus-within:border-indigo-300/80 focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-500/15 hover:border-slate-300/90 ${compact ? "max-w-[13rem]" : "w-full max-w-[14rem]"}`}
    >
      <span
        className={`flex shrink-0 items-center rounded-l-2xl border-r border-slate-100 bg-slate-50/95 font-bold text-slate-600 ${compact ? "px-2.5" : "px-3"}`}
      >
        <IndianRupee size={compact ? 15 : 16} className="text-indigo-600" aria-hidden />
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => onChange(stripToDigitString(e.target.value))}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`min-w-0 flex-1 rounded-r-2xl border-0 bg-transparent focus:outline-none focus:ring-0 ${inputClass}`}
        aria-label={placeholder}
      />
    </div>
  );
}

export function RevenuePercentInput({ value, onChange, placeholder = "e.g. 60", onBlur }: RevenueInputProps) {
  return (
    <div className="group relative flex max-w-[7.25rem] items-stretch rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 shadow-sm transition-all focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/15 hover:border-slate-300">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border-0 bg-transparent py-2 pl-2.5 pr-8 text-sm font-bold tabular-nums text-slate-950 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-0"
        aria-label="Value realized percent"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">%</span>
    </div>
  );
}

type StatTone = "planned" | "received" | "remaining" | "realized";

/** Underline editor accent (matches card tone). */
const toneUnderline: Record<StatTone, string> = {
  planned: "border-slate-200/90 focus-within:border-indigo-400",
  received: "border-slate-200/90 focus-within:border-emerald-400",
  remaining: "border-slate-200/90 focus-within:border-amber-400",
  realized: "border-slate-200/90 focus-within:border-violet-400",
};

const toneStyles: Record<StatTone, { border: string; bg: string; accent: string; label: string }> = {
  planned: {
    border: "border-indigo-200/80",
    bg: "from-indigo-50/90 via-white to-white",
    accent: "text-indigo-700",
    label: "text-indigo-600/90",
  },
  received: {
    border: "border-emerald-200/80",
    bg: "from-emerald-50/90 via-white to-white",
    accent: "text-emerald-800",
    label: "text-emerald-700/90",
  },
  remaining: {
    border: "border-amber-200/80",
    bg: "from-amber-50/90 via-white to-white",
    accent: "text-amber-900",
    label: "text-amber-800/90",
  },
  realized: {
    border: "border-violet-200/80",
    bg: "from-violet-50/90 via-white to-white",
    accent: "text-violet-800",
    label: "text-violet-700/90",
  },
};

export function RevenueStatCard({
  title,
  subtitle,
  tone,
  footnote,
  icon,
  amountDisplay,
  amountEdit,
  percentEdit,
}: {
  title: string;
  subtitle: string;
  tone: StatTone;
  footnote?: string;
  icon?: ReactNode;
  /** Read-only headline (when not using amountEdit / percentEdit). */
  amountDisplay?: string;
  /** Editable headline amount: read-only display + pencil/save in header; underline field while editing. */
  amountEdit?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    /** Persist when saving, blurring, or pressing Enter. */
    onBlur?: () => void;
    /** Revert local digits (e.g. Escape). */
    onCancel?: () => void;
  };
  /** Large percent field inside the card (session editing). */
  percentEdit?: { value: string; onChange: (v: string) => void; placeholder?: string; onBlur?: () => void };
}) {
  const t = toneStyles[tone];
  const [amountEditing, setAmountEditing] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const skipAmountBlurCommitRef = useRef(false);

  useEffect(() => {
    if (amountEdit && amountEditing) {
      amountInputRef.current?.focus();
    }
  }, [amountEdit, amountEditing]);

  const commitAmountEdit = () => {
    amountEdit?.onBlur?.();
    setAmountEditing(false);
  };

  const handleAmountInputBlur = () => {
    if (skipAmountBlurCommitRef.current) {
      skipAmountBlurCommitRef.current = false;
      return;
    }
    commitAmountEdit();
  };

  let main: ReactNode;
  if (percentEdit) {
    main = (
      <div className="relative mt-3 min-h-[2.85rem]">
        <input
          type="text"
          inputMode="decimal"
          value={percentEdit.value}
          onChange={(e) => percentEdit.onChange(e.target.value)}
          onBlur={percentEdit.onBlur}
          placeholder={percentEdit.placeholder ?? "60"}
          className={`w-full rounded-xl border border-slate-200/60 bg-white/70 py-2 pl-3 pr-11 font-mono text-3xl font-black tabular-nums tracking-tight leading-[1.12] shadow-inner ring-1 ring-black/[0.03] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-4xl lg:text-[2.35rem] ${t.accent}`}
          aria-label="Value realized percent"
        />
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xl font-black tabular-nums sm:text-2xl ${t.accent} opacity-80`}
        >
          %
        </span>
      </div>
    );
  } else if (amountEdit) {
    const digits = stripToDigitString(amountEdit.value);
    const displayGrouped = formatIndianGroupedFromDigits(digits);
    const rupees = parseRevenueInRupees(amountEdit.value);
    const underline = toneUnderline[tone];

    if (!amountEditing) {
      main = (
        <p
          className={`mt-3 font-mono text-[1.9rem] font-black tabular-nums tracking-tight leading-[1.1] sm:text-[2.35rem] lg:text-[2.7rem] ${t.accent}`}
        >
          {formatRupeeCompact(rupees)}
        </p>
      );
    } else {
      main = (
        <div
          className={`mt-3 flex min-h-[2.75rem] w-full min-w-0 items-baseline gap-2 border-b-2 pb-1.5 transition-colors ${underline}`}
        >
          <IndianRupee size={22} className={`shrink-0 translate-y-0.5 ${t.accent}`} aria-hidden />
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            value={displayGrouped}
            onChange={(e) => amountEdit.onChange(stripToDigitString(e.target.value))}
            onBlur={handleAmountInputBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAmountEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                skipAmountBlurCommitRef.current = true;
                amountEdit.onCancel?.();
                setAmountEditing(false);
              }
            }}
            placeholder={amountEdit.placeholder ?? "80,00,000"}
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[1.75rem] font-semibold tabular-nums tracking-tight text-slate-900 outline-none focus:ring-0 sm:text-[2.05rem] sm:font-bold lg:text-[2.35rem] leading-[1.12] placeholder:font-medium placeholder:text-slate-400/80"
            aria-label={title}
          />
        </div>
      );
    }
  } else {
    main = (
      <p
        className={`mt-3 font-mono text-[1.9rem] font-black tabular-nums tracking-tight leading-[1.1] sm:text-[2.35rem] lg:text-[2.7rem] ${t.accent}`}
      >
        {amountDisplay ?? "—"}
      </p>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-br ${t.bg} p-5 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>{title}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 leading-snug">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {icon && (
            <div className="rounded-lg bg-white/80 p-2 shadow-sm ring-1 ring-black/5" aria-hidden>
              {icon}
            </div>
          )}
          {amountEdit && (
            <button
              type="button"
              onMouseDown={(e) => {
                if (amountEditing) e.preventDefault();
              }}
              onClick={() => {
                if (amountEditing) commitAmountEdit();
                else setAmountEditing(true);
              }}
              className="rounded-lg border border-slate-200/80 bg-white/90 p-2 text-slate-600 shadow-sm ring-1 ring-black/[0.04] transition hover:border-slate-300 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              aria-label={amountEditing ? "Save amount" : "Edit amount"}
              title={amountEditing ? "Save" : "Edit"}
            >
              {amountEditing ? (
                <Check size={18} className="text-emerald-700" strokeWidth={2.25} aria-hidden />
              ) : (
                <Pencil size={17} className="text-slate-600" strokeWidth={2} aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>
      {main}
      {footnote && <p className="mt-2 text-[10px] font-medium text-slate-400">{footnote}</p>}
    </div>
  );
}

/** Minimal shapes for portfolio revenue (avoids importing app hook types). */
export type ProjectRevenueShape = {
  id: string;
  total_revenue_planned_rupees?: number | null;
};
export type MilestoneRevenueShape = {
  project_id: string | null;
  value_planned_rupees?: number | null;
  value_actual_rupees?: number | null;
};

function nonNegIntRupee(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(Number(v))) return 0;
  return Math.max(0, Math.round(Number(v)));
}

/**
 * Per-project planned/received — aligned with Projects Milestone Tracker:
 * `planned` = `total_revenue_planned_rupees` when set (> 0), else sum of milestone `value_planned_rupees`;
 * `received` = sum of milestone `value_actual_rupees`;
 * `remaining` = max(0, sum of milestone planned − sum of milestone actual) so it matches row-level pending;
 * `milestonePlannedSum` = sum of milestone planned (for portfolio % when rows exist).
 */
export function projectRevenueFromApi(
  project: ProjectRevenueShape,
  milestones: MilestoneRevenueShape[]
): { planned: number; received: number; remaining: number; milestonePlannedSum: number } {
  const ms = milestones.filter((m) => m.project_id === project.id);
  const sumPlanned = ms.reduce((acc, m) => acc + nonNegIntRupee(m.value_planned_rupees), 0);
  const sumActual = ms.reduce((acc, m) => acc + nonNegIntRupee(m.value_actual_rupees), 0);
  const top = nonNegIntRupee(project.total_revenue_planned_rupees);
  const headerSet =
    project.total_revenue_planned_rupees != null &&
    Number.isFinite(Number(project.total_revenue_planned_rupees)) &&
    Number(project.total_revenue_planned_rupees) > 0;
  const planned = headerSet ? top : sumPlanned;
  const remaining = Math.max(0, sumPlanned - sumActual);
  return { planned, received: sumActual, remaining, milestonePlannedSum: sumPlanned };
}

/** Sum revenue for a list of projects (e.g. Overview filtered rows). */
export function aggregateRevenueForProjectList(
  projects: ProjectRevenueShape[],
  milestones: MilestoneRevenueShape[]
): { planned: number; received: number; remaining: number; realizedPct: number | null; hasAmounts: boolean } {
  let planned = 0;
  let received = 0;
  let remaining = 0;
  let milestonePlannedSum = 0;
  for (const p of projects) {
    const r = projectRevenueFromApi(p, milestones);
    planned += r.planned;
    received += r.received;
    remaining += r.remaining;
    milestonePlannedSum += r.milestonePlannedSum;
  }
  const realizedPct =
    milestonePlannedSum > 0
      ? (received / milestonePlannedSum) * 100
      : planned > 0
        ? (received / planned) * 100
        : null;
  const hasAmounts = planned > 0 || received > 0;
  return { planned, received, remaining, realizedPct, hasAmounts };
}

export type FilteredRevenueTotals = {
  planned: number;
  received: number;
  fromInput: boolean;
  /** Portfolio-style value realized % (0–100+ allowed from column; capped for amount-derived). */
  realizedPct: number;
  realizedSource: "amounts" | "percent_column" | "mock";
};

/**
 * Sum planned / received from session inputs; if nothing entered, return illustrative mock totals
 * so cards always read well (demo behaviour when table cells are empty).
 * Value realized %: from actualized/planned when amounts exist; else weighted/simple average of
 * “Value realized %” cells; else same ratio as mock received/planned.
 */
export function computeFilteredRevenueTotals(
  projectIds: string[],
  valueByProject: Record<string, { totalBusinessValue: string; actualizedValue: string; valueRealizedPct?: string }>,
  statusFilter: string
): FilteredRevenueTotals {
  let plannedSum = 0;
  let receivedSum = 0;
  let pctWeighted = 0;
  let pctWeight = 0;
  const pctOrphans: number[] = [];

  for (const id of projectIds) {
    const v = valueByProject[id];
    if (!v) continue;
    const p = parseRevenueInRupees(v.totalBusinessValue);
    const r = parseRevenueInRupees(v.actualizedValue);
    plannedSum += p;
    receivedSum += r;
    const pct = parsePercentCell(v.valueRealizedPct);
    if (pct !== null) {
      if (p > 0) {
        pctWeighted += pct * p;
        pctWeight += p;
      } else {
        pctOrphans.push(pct);
      }
    }
  }

  const c = Math.max(projectIds.length, 1);
  const mult: Record<string, number> = {
    all: 1,
    Active: 1.06,
    "On Track": 1,
    "At Risk": 0.78,
    Blocked: 0.52,
    Completed: 1.12,
  };
  const recvRatio: Record<string, number> = {
    all: 0.44,
    Active: 0.5,
    "On Track": 0.47,
    "At Risk": 0.31,
    Blocked: 0.16,
    Completed: 0.76,
  };
  const m = mult[statusFilter] ?? 1;
  const rr = recvRatio[statusFilter] ?? 0.44;
  const basePlanned = 3.8e7 * m * (0.9 + Math.min(c, 12) * 0.045);

  const mockTotals = (): FilteredRevenueTotals => ({
    planned: basePlanned,
    received: basePlanned * rr,
    fromInput: false,
    realizedPct: rr * 100,
    realizedSource: "mock",
  });

  if (plannedSum > 0 || receivedSum > 0) {
    const p = Math.max(plannedSum, receivedSum);
    const r = Math.min(receivedSum, p);
    const realizedPct = p > 0 ? Math.min(100, (r / p) * 100) : receivedSum > 0 ? 100 : 0;
    return {
      planned: p,
      received: r,
      fromInput: true,
      realizedPct,
      realizedSource: "amounts",
    };
  }

  if (pctWeight > 0) {
    const t = mockTotals();
    return {
      ...t,
      realizedPct: pctWeighted / pctWeight,
      realizedSource: "percent_column",
    };
  }
  if (pctOrphans.length > 0) {
    const t = mockTotals();
    const avg = pctOrphans.reduce((a, b) => a + b, 0) / pctOrphans.length;
    return {
      ...t,
      realizedPct: avg,
      realizedSource: "percent_column",
    };
  }

  return mockTotals();
}
