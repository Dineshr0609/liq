/**
 * Flow-aware KPI registry for the contract Performance tab.
 *
 * Same idea as the reconciliation kpiRegistry: the same six tiles render
 * for every contract, but their labels and sublabels adapt to the flow
 * type so VRP/CRP/RLA/SUB/RSM/OEM each speak the correct language
 * (e.g. "Vendor receivables earned" vs "Customer rebate paid out" vs
 * "Royalty calculated").
 */
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Percent,
  Activity,
  Clock,
  Layers,
  CheckCircle2,
  Sigma,
} from "lucide-react";

export type KpiIntent = "good" | "warn" | "bad" | "neutral";

export interface PerformanceKpiTile {
  key: string;
  label: string;
  value: string;
  sublabel?: string;
  deltaLabel?: string;
  deltaTone?: "good" | "bad" | "neutral";
  intent: KpiIntent;
  icon: LucideIcon;
}

export interface PerformanceKpiSummary {
  lifetimeFees: { total: number; count: number };
  periodFees: {
    total: number;
    count: number;
    priorTotal: number;
    deltaVsPriorPct: number | null;
  };
  effectiveRate: { pct: number | null; salesBase: number };
  avgFeePerCalc: { value: number; count: number };
  runHealth: {
    successPct: number | null;
    succeeded: number;
    failed: number;
    total: number;
  };
  lastCalc: { at: string | Date | null; status: string | null; amount: number };
  activeRules: { count: number };
}

const fmtMoney = (n: number, currency = "USD"): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs).toLocaleString()}`;
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtPct = (n: number | null, digits = 1): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
};

const fmtSignedPct = (n: number | null, digits = 1): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
};

const fmtRelative = (ts: string | Date | null): string => {
  if (!ts) return "Never";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

interface FlowLabelSet {
  feesNoun: string; // "Royalty", "Rebate", "Fee", etc.
  feesEarnedTitle: string; // headline noun for KPI tiles ("Vendor receivables earned")
  periodTotalLabel: string; // KPI #1 label
  effectiveRateLabel: string; // KPI #3 label
  avgFeeLabel: string; // KPI #4 label
  perCalcLabel: string; // sublabel ("per close")
}

function labelsForFlow(flowTypeCode?: string | null): FlowLabelSet {
  const code = (flowTypeCode || "").toUpperCase();
  switch (code) {
    case "VRP":
      return {
        feesNoun: "Receivable",
        feesEarnedTitle: "Vendor receivables earned",
        periodTotalLabel: "Receivables earned",
        effectiveRateLabel: "Effective rebate rate",
        avgFeeLabel: "Avg per claim",
        perCalcLabel: "per claim",
      };
    case "CRP":
      return {
        feesNoun: "Rebate",
        feesEarnedTitle: "Customer rebate paid",
        periodTotalLabel: "Rebate accrued",
        effectiveRateLabel: "Effective rebate rate",
        avgFeeLabel: "Avg per period",
        perCalcLabel: "per period",
      };
    case "RLA":
      return {
        feesNoun: "Royalty",
        feesEarnedTitle: "Royalty calculated",
        periodTotalLabel: "Royalty earned",
        effectiveRateLabel: "Effective royalty rate",
        avgFeeLabel: "Avg per statement",
        perCalcLabel: "per statement",
      };
    case "SUB":
      return {
        feesNoun: "Revenue",
        feesEarnedTitle: "Recurring revenue",
        periodTotalLabel: "Revenue billed",
        effectiveRateLabel: "Avg subscription rate",
        avgFeeLabel: "Avg per invoice",
        perCalcLabel: "per invoice",
      };
    case "RSM":
      return {
        feesNoun: "Settlement",
        feesEarnedTitle: "Distributor settlements",
        periodTotalLabel: "Settled in period",
        effectiveRateLabel: "Effective margin rate",
        avgFeeLabel: "Avg per settlement",
        perCalcLabel: "per settlement",
      };
    case "OEM":
      return {
        feesNoun: "OEM fee",
        feesEarnedTitle: "OEM fees calculated",
        periodTotalLabel: "Fees in period",
        effectiveRateLabel: "Effective fee rate",
        avgFeeLabel: "Avg per close",
        perCalcLabel: "per close",
      };
    default:
      return {
        feesNoun: "Fee",
        feesEarnedTitle: "Fees calculated",
        periodTotalLabel: "Fees in period",
        effectiveRateLabel: "Effective fee rate",
        avgFeeLabel: "Avg per calc",
        perCalcLabel: "per calc",
      };
  }
}

export function getPerformanceKpis(
  flowTypeCode: string | null | undefined,
  summary: PerformanceKpiSummary,
  currency = "USD",
): PerformanceKpiTile[] {
  const L = labelsForFlow(flowTypeCode);
  const tiles: PerformanceKpiTile[] = [];

  // 1. Period fees with delta-vs-prior
  const delta = summary.periodFees.deltaVsPriorPct;
  tiles.push({
    key: "periodFees",
    label: L.periodTotalLabel,
    value: fmtMoney(summary.periodFees.total, currency),
    sublabel: `${summary.periodFees.count} ${summary.periodFees.count === 1 ? "calc" : "calcs"}`,
    deltaLabel: delta === null ? "no prior period" : `${fmtSignedPct(delta)} vs prior`,
    deltaTone: delta === null ? "neutral" : delta >= 0 ? "good" : "bad",
    intent: "neutral",
    icon: Banknote,
  });

  // 2. Lifetime fees
  tiles.push({
    key: "lifetimeFees",
    label: `Lifetime ${L.feesNoun.toLowerCase()}s`,
    value: fmtMoney(summary.lifetimeFees.total, currency),
    sublabel: `${summary.lifetimeFees.count} total ${summary.lifetimeFees.count === 1 ? "calc" : "calcs"}`,
    intent: "neutral",
    icon: Sigma,
  });

  // 3. Effective rate
  tiles.push({
    key: "effectiveRate",
    label: L.effectiveRateLabel,
    value: fmtPct(summary.effectiveRate.pct, 2),
    sublabel: `on ${fmtMoney(summary.effectiveRate.salesBase, currency)} sales`,
    intent: "neutral",
    icon: Percent,
  });

  // 4. Avg per calc
  tiles.push({
    key: "avgFeePerCalc",
    label: L.avgFeeLabel,
    value: fmtMoney(summary.avgFeePerCalc.value, currency),
    sublabel: L.perCalcLabel,
    intent: "neutral",
    icon: Layers,
  });

  // 5. Run health
  const runPct = summary.runHealth.successPct;
  const runIntent: KpiIntent =
    runPct === null ? "neutral" : runPct >= 95 ? "good" : runPct >= 80 ? "warn" : "bad";
  tiles.push({
    key: "runHealth",
    label: "Run success rate",
    value: runPct === null ? "—" : `${Math.round(runPct)}%`,
    sublabel:
      summary.runHealth.total === 0
        ? "no runs in period"
        : `${summary.runHealth.succeeded} ok / ${summary.runHealth.failed} failed`,
    intent: runIntent,
    icon: runIntent === "good" ? CheckCircle2 : Activity,
  });

  // 6. Last calc relative
  const lastTone: KpiIntent = !summary.lastCalc.at
    ? "warn"
    : Date.now() - new Date(summary.lastCalc.at).getTime() > 1000 * 60 * 60 * 24 * 60
      ? "warn"
      : "neutral";
  tiles.push({
    key: "lastCalc",
    label: "Last calculation",
    value: fmtRelative(summary.lastCalc.at),
    sublabel:
      summary.lastCalc.amount > 0
        ? `${fmtMoney(summary.lastCalc.amount, currency)} · ${summary.lastCalc.status || "—"}`
        : summary.lastCalc.status || "no runs yet",
    intent: lastTone,
    icon: Clock,
  });

  return tiles;
}

export const PERF_FORMATTERS = {
  fmtMoney,
  fmtPct,
  fmtSignedPct,
  fmtRelative,
};
