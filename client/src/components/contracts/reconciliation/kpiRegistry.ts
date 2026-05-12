/**
 * Flow-aware KPI registry for the contract Reconciliation tab.
 *
 * Tiles vary by the contract's flow type so vendor-rebate (VRP, inbound)
 * surfaces "vendor accruals receivable" while customer-rebate (CRP, outbound)
 * surfaces "customer rebate liability". Subtypes inside the registry could
 * further refine labels later.
 */
import type { LucideIcon } from "lucide-react";
import {
  Wallet,
  Scale,
  TrendingUp,
  Inbox,
  FileWarning,
  FileText,
  Calendar,
  AlertTriangle,
  Clock,
} from "lucide-react";

export type KpiIntent = "good" | "warn" | "bad" | "neutral";

export interface KpiTile {
  key: string;
  label: string;
  value: string;
  sublabel?: string;
  intent: KpiIntent;
  icon: LucideIcon;
}

export interface ReconciliationKpiSummary {
  openAccruals: { total: number; count: number; awaitingApproval: number };
  openObligations: { total: number; count: number; oldestAgingDays: number };
  settlementVariance: {
    variance: number;
    variancePct: number;
    closedCount: number;
    totalCount: number;
  };
  claimsPending: {
    count: number;
    latest: {
      partnerName?: string | null;
      claimedAmount?: number | null;
      approvedAmount?: number | null;
    } | null;
  };
  unpostedJEs: { count: number; total: number };
  invoicesInRange: { count: number; total: number };
}

const fmtMoney = (n: number, currency = "USD"): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs).toLocaleString()}`;
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtSignedMoney = (n: number): string => {
  if (n === 0) return "$0";
  const sign = n > 0 ? "+" : "-";
  return `${sign}${fmtMoney(Math.abs(n))}`;
};

const fmtPct = (pct: number, signed = true): string => {
  if (!Number.isFinite(pct)) return "—";
  const rounded = Math.round(pct * 100) / 100;
  const sign = signed && rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2)}%`;
};

const variancePctIntent = (pct: number): KpiIntent => {
  const abs = Math.abs(pct);
  if (abs <= 1) return "good";
  if (abs <= 3) return "warn";
  return "bad";
};

const agingIntent = (days: number): KpiIntent => {
  if (days === 0) return "neutral";
  if (days <= 30) return "good";
  if (days <= 60) return "warn";
  return "bad";
};

type FlowFamily = "VRP" | "CRP" | "RLA" | "SUB" | "RSM" | "OEM" | "GENERIC";

function familyFor(code: string | null | undefined): FlowFamily {
  if (!code) return "GENERIC";
  const c = code.toUpperCase();
  if (c === "VRP") return "VRP";
  if (c === "CRP") return "CRP";
  if (c === "RLA") return "RLA";
  if (c === "SUB") return "SUB";
  if (c === "RSM") return "RSM";
  if (c === "OEM") return "OEM";
  return "GENERIC";
}

interface LabelSet {
  openAccruals: { label: string; sub: (s: ReconciliationKpiSummary) => string };
  openObligations: { label: string; sub: (s: ReconciliationKpiSummary) => string };
  variance: { label: string; sub: (s: ReconciliationKpiSummary) => string };
  claims: { label: string; sub: (s: ReconciliationKpiSummary) => string };
  unpostedJE: { label: string; sub: (s: ReconciliationKpiSummary) => string };
  invoices: { label: string; sub: (s: ReconciliationKpiSummary) => string };
}

const BASE_LABELS: Record<FlowFamily, LabelSet> = {
  VRP: {
    openAccruals: {
      label: "Vendor accruals receivable",
      sub: (s) => `${s.openAccruals.count} accrual${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Open recoveries",
      sub: (s) => `${s.openObligations.count} obligation${s.openObligations.count === 1 ? "" : "s"}${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Variance recovery",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} settlements closed`,
    },
    claims: {
      label: "Vendor claims pending",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName} reported ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)} vs our calc ${fmtMoney(s.claimsPending.latest.approvedAmount || 0)}` : "No claims awaiting response",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} stuck` : "All entries synced",
    },
    invoices: {
      label: "Vendor invoices",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  CRP: {
    openAccruals: {
      label: "Customer rebate liability",
      sub: (s) => `${s.openAccruals.count} accrual${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Pending payouts",
      sub: (s) => `${s.openObligations.count} obligation${s.openObligations.count === 1 ? "" : "s"}${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Settlement variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} settlements closed`,
    },
    claims: {
      label: "Customer claims pending",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName} requested ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)} vs accrued ${fmtMoney(s.claimsPending.latest.approvedAmount || 0)}` : "No claims awaiting response",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} pending` : "All entries synced",
    },
    invoices: {
      label: "Credit memos issued",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  RLA: {
    openAccruals: {
      label: "Royalty obligations",
      sub: (s) => `${s.openAccruals.count} statement${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Recoupment balance",
      sub: (s) => `${s.openObligations.count} open${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Statement variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} statements reconciled`,
    },
    claims: {
      label: "Statements awaiting approval",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName}: ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)}` : "No statements pending",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} pending` : "All entries synced",
    },
    invoices: {
      label: "Royalty payments",
      sub: (s) => `${s.invoicesInRange.count} payment${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  SUB: {
    openAccruals: {
      label: "Recurring billing accruals",
      sub: (s) => `${s.openAccruals.count} period${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Renewal pipeline",
      sub: (s) => `${s.openObligations.count} obligation${s.openObligations.count === 1 ? "" : "s"}${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Billing variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} cycles closed`,
    },
    claims: {
      label: "Disputes pending",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName}: ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)}` : "No disputes open",
    },
    unpostedJE: {
      label: "Past-due invoices",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} unposted` : "All caught up",
    },
    invoices: {
      label: "Invoices issued",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  RSM: {
    openAccruals: {
      label: "Distributor settlements",
      sub: (s) => `${s.openAccruals.count} accrual${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Open chargebacks",
      sub: (s) => `${s.openObligations.count} obligation${s.openObligations.count === 1 ? "" : "s"}${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Settlement variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} settlements closed`,
    },
    claims: {
      label: "Price-protection claims",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName} reported ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)}` : "No claims awaiting response",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} stuck` : "All entries synced",
    },
    invoices: {
      label: "Credit memos",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  OEM: {
    openAccruals: {
      label: "Open accruals",
      sub: (s) => `${s.openAccruals.count} accrual${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Open obligations",
      sub: (s) => `${s.openObligations.count} obligation${s.openObligations.count === 1 ? "" : "s"}${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Settlement variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} settlements closed`,
    },
    claims: {
      label: "Claims pending",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName}: ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)}` : "No claims awaiting response",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} pending` : "All entries synced",
    },
    invoices: {
      label: "Documents issued",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
  GENERIC: {
    openAccruals: {
      label: "Open accruals",
      sub: (s) => `${s.openAccruals.count} accrual${s.openAccruals.count === 1 ? "" : "s"}, ${s.openAccruals.awaitingApproval} awaiting approval`,
    },
    openObligations: {
      label: "Open obligations",
      sub: (s) => `${s.openObligations.count} open${s.openObligations.oldestAgingDays ? `, oldest ${s.openObligations.oldestAgingDays}d` : ""}`,
    },
    variance: {
      label: "Variance",
      sub: (s) => `${s.settlementVariance.closedCount}/${s.settlementVariance.totalCount} settlements closed`,
    },
    claims: {
      label: "Claims pending",
      sub: (s) => s.claimsPending.latest?.partnerName ? `${s.claimsPending.latest.partnerName}: ${fmtMoney(s.claimsPending.latest.claimedAmount || 0)}` : "No claims awaiting response",
    },
    unpostedJE: {
      label: "Unposted JE",
      sub: (s) => s.unpostedJEs.count > 0 ? `${fmtMoney(s.unpostedJEs.total)} pending` : "All entries synced",
    },
    invoices: {
      label: "Invoices",
      sub: (s) => `${s.invoicesInRange.count} doc${s.invoicesInRange.count === 1 ? "" : "s"}, totaling ${fmtMoney(s.invoicesInRange.total)}`,
    },
  },
};

export interface FlowContext {
  flowTypeCode: string | null;
  cashDirection: "inbound" | "outbound" | "derived" | null;
}

export function getReconciliationKpis(
  flow: FlowContext,
  summary: ReconciliationKpiSummary,
): KpiTile[] {
  const family = familyFor(flow.flowTypeCode);
  const labels = BASE_LABELS[family];

  const tiles: KpiTile[] = [
    {
      key: "open-accruals",
      label: labels.openAccruals.label,
      value: fmtMoney(summary.openAccruals.total),
      sublabel: labels.openAccruals.sub(summary),
      intent: summary.openAccruals.awaitingApproval > 0 ? "warn" : "neutral",
      icon: Wallet,
    },
    {
      key: "open-obligations",
      label: labels.openObligations.label,
      value: fmtMoney(summary.openObligations.total),
      sublabel: labels.openObligations.sub(summary),
      intent: agingIntent(summary.openObligations.oldestAgingDays),
      icon: Scale,
    },
    {
      key: "settlement-variance",
      label: labels.variance.label,
      value: `${fmtSignedMoney(summary.settlementVariance.variance)} (${fmtPct(summary.settlementVariance.variancePct)})`,
      sublabel: labels.variance.sub(summary),
      intent: variancePctIntent(summary.settlementVariance.variancePct),
      icon: TrendingUp,
    },
    {
      key: "claims-pending",
      label: labels.claims.label,
      value: String(summary.claimsPending.count),
      sublabel: labels.claims.sub(summary),
      intent: summary.claimsPending.count > 0 ? "warn" : "good",
      icon: Inbox,
    },
    {
      key: "unposted-je",
      label: labels.unpostedJE.label,
      value: String(summary.unpostedJEs.count),
      sublabel: labels.unpostedJE.sub(summary),
      intent: summary.unpostedJEs.count > 0 ? "bad" : "good",
      icon: FileWarning,
    },
    {
      key: "invoices",
      label: labels.invoices.label,
      value: String(summary.invoicesInRange.count),
      sublabel: labels.invoices.sub(summary),
      intent: "neutral",
      icon: FileText,
    },
  ];
  return tiles;
}

export const KPI_FORMATTERS = { fmtMoney, fmtSignedMoney, fmtPct };

export const VARIANCE_TOLERANCE_PCT = 1;
export const VARIANCE_INVESTIGATION_PCT = 3;

export function classifySettlementStatus(
  variancePct: number,
  disputeState?: string | null,
): { label: string; tone: "good" | "warn" | "bad" } {
  if (disputeState && disputeState !== "none" && disputeState !== "resolved") {
    return { label: "Investigation", tone: "bad" };
  }
  const abs = Math.abs(variancePct);
  if (abs <= VARIANCE_TOLERANCE_PCT) return { label: "Matched", tone: "good" };
  if (abs <= VARIANCE_INVESTIGATION_PCT) return { label: "Minor variance", tone: "warn" };
  return { label: "Investigation", tone: "bad" };
}

export const FLOW_FAMILY_HELPERS = {
  familyFor,
  agingIntent,
  variancePctIntent,
};
