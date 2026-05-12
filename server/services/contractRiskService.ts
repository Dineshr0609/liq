/**
 * Contract Risk Scoring — Phase D of the agent-runtime roadmap.
 *
 * Pure-function scoring service that derives a 0-100 risk score (and a
 * low/med/high level) for any contract from columns we already store.
 * No schema changes — the score is computed on-demand from the visible
 * portfolio. Cheap enough at our portfolio sizes (≤1k contracts) and
 * avoids the cache-invalidation problem of a persisted score.
 *
 * Factor catalog (weights tunable; total caps at 100):
 *   past-due ............... 40   active contracts past their end date
 *   expiring-14d ........... 30   active contracts expiring this fortnight
 *   expiring-30d ........... 25   active contracts expiring this month
 *   expiring-60d ........... 15   active contracts expiring next 60d
 *   auto-renew-no-notice ... 20   auto-renews with no notice window captured
 *   auto-renew ............. 8    auto-renew enabled (with notice captured)
 *   value-high ............. 15   ≥ $500k annual
 *   value-med .............. 10   ≥ $100k annual
 *   value-low .............. 5    ≥ $25k annual
 *   counterparty-unlinked .. 8    counterparty not verified against master
 *   no-end-date ............ 10   active with no effective_end set
 *   approval-stuck ......... 10   pending_approval > 14d
 *
 * Level cutoffs:
 *   high  ≥ 60
 *   med   30 – 59
 *   low   < 30
 */

import { storage } from "../storage";

export type RiskLevel = "low" | "med" | "high";

export type RiskFactor = {
  code: string;
  weight: number;
  detail: string;
};

export type RiskResult = {
  contractId: string;
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
};

export type RiskSummary = {
  generatedAt: string;
  summary: { high: number; med: number; low: number; total: number };
  top: Array<{
    contractId: string;
    name: string;
    score: number;
    level: RiskLevel;
    topFactor: string;
  }>;
};

const ACTIVE_RE = /^(active|executed|signed|approved|amended)$/i;
const DAY_MS = 86_400_000;

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

function getAnnualValue(c: any): number {
  const candidates = [
    c.contractValueEstimatedAnnual,
    c.totalValue,
    c.contractValue,
  ];
  for (const v of candidates) {
    if (v == null) continue;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (!isNaN(n) && n > 0) return n;
  }
  return 0;
}

function displayName(c: any): string {
  return (
    c.displayName ||
    c.originalName ||
    c.contractName ||
    c.name ||
    c.fileName ||
    "Untitled contract"
  );
}

/** Pure: compute the risk profile for a single contract row. */
export function computeRiskFor(c: any, now: Date = new Date()): RiskResult {
  const factors: RiskFactor[] = [];
  // `status` is the operational column ('active'/'analyzed'/...). The legacy
  // `contractStatus` column carries draft-stage strings like 'Draft' that
  // would shadow real status if we OR'd them — match the morning-brief
  // logic which keys off `status` only.
  const status = String(c.status || "").toLowerCase();
  const isActive = ACTIVE_RE.test(status);
  const end: Date | null = c.effectiveEnd ? new Date(c.effectiveEnd) : null;

  // 1. Past-due active contracts (billing-correctness risk).
  if (isActive && end && end < now) {
    const daysOver = daysBetween(now, end);
    factors.push({
      code: "past-due",
      weight: 40,
      detail: `Active but ended ${daysOver}d ago`,
    });
  }

  // 2. Expiring soon (only if not already past-due).
  if (isActive && end && end >= now) {
    const dleft = daysBetween(end, now);
    if (dleft <= 14) {
      factors.push({
        code: "expiring-14d",
        weight: 30,
        detail: dleft === 0 ? "Expires today" : `Expires in ${dleft}d`,
      });
    } else if (dleft <= 30) {
      factors.push({
        code: "expiring-30d",
        weight: 25,
        detail: `Expires in ${dleft}d`,
      });
    } else if (dleft <= 60) {
      factors.push({
        code: "expiring-60d",
        weight: 15,
        detail: `Expires in ${dleft}d`,
      });
    }
  }

  // 3. Auto-renew handling — distinguish "captured notice window" from "blind renew".
  if (isActive && c.autoRenew === true) {
    const noticeMissing =
      !c.renewalTerms || String(c.renewalTerms).trim().length === 0;
    if (noticeMissing) {
      factors.push({
        code: "auto-renew-no-notice",
        weight: 20,
        detail: "Auto-renews with no notice window captured",
      });
    } else {
      factors.push({
        code: "auto-renew",
        weight: 8,
        detail: "Auto-renew enabled",
      });
    }
  }

  // 4. Value tiering — bigger spend = bigger blast radius if something goes wrong.
  const annual = getAnnualValue(c);
  if (annual >= 500_000) {
    factors.push({
      code: "value-high",
      weight: 15,
      detail: `$${Math.round(annual / 1000).toLocaleString()}k annual value`,
    });
  } else if (annual >= 100_000) {
    factors.push({
      code: "value-med",
      weight: 10,
      detail: `$${Math.round(annual / 1000).toLocaleString()}k annual value`,
    });
  } else if (annual >= 25_000) {
    factors.push({
      code: "value-low",
      weight: 5,
      detail: `$${Math.round(annual / 1000).toLocaleString()}k annual value`,
    });
  }

  // 5. Counterparty hygiene.
  const linkStatus = String(c.counterpartyLinkStatus || "").toLowerCase();
  if (linkStatus === "unlinked" || linkStatus === "suggested") {
    factors.push({
      code: "counterparty-unlinked",
      weight: 8,
      detail: "Counterparty not verified against master record",
    });
  }

  // 6. Active contract with no end date — open-ended liability.
  if (isActive && !end) {
    factors.push({
      code: "no-end-date",
      weight: 10,
      detail: "Active with no end date set",
    });
  }

  // 7. Stuck in approval.
  const approvalState = String(c.approvalState || "").toLowerCase();
  if (approvalState === "pending_approval" && c.updatedAt) {
    const stuckFor = daysBetween(now, new Date(c.updatedAt));
    if (stuckFor > 14) {
      factors.push({
        code: "approval-stuck",
        weight: 10,
        detail: `Pending approval for ${stuckFor}d`,
      });
    }
  }

  const rawScore = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.min(100, rawScore);
  const level: RiskLevel = score >= 60 ? "high" : score >= 30 ? "med" : "low";

  // Sort factors heaviest-first so callers can show "top reason".
  factors.sort((a, b) => b.weight - a.weight);

  return { contractId: c.id, score, level, factors };
}

/** Aggregate risk across the visible portfolio for the KPI strip. */
export async function getRiskSummary(
  orgContext: any,
  hasAdminAccess: boolean,
  userId: string,
): Promise<RiskSummary> {
  const { contracts } = await storage.getContracts(
    hasAdminAccess ? undefined : userId,
    1000,
    0,
    orgContext,
  );

  const now = new Date();
  let high = 0;
  let med = 0;
  let low = 0;
  const top: RiskSummary["top"] = [];

  for (const c of contracts || []) {
    if ((c as any).deletedAt) continue;
    const r = computeRiskFor(c, now);
    if (r.level === "high") high++;
    else if (r.level === "med") med++;
    else low++;

    if (r.level !== "low") {
      top.push({
        contractId: r.contractId,
        name: displayName(c),
        score: r.score,
        level: r.level,
        topFactor: r.factors[0]?.detail || "",
      });
    }
  }

  // Highest-scoring first, then cap. Front-end shows ~5 in the tooltip.
  top.sort((a, b) => b.score - a.score);

  return {
    generatedAt: now.toISOString(),
    summary: { high, med, low, total: high + med + low },
    top: top.slice(0, 8),
  };
}

/** Per-contract breakdown — used by the contract detail page (and tooltip). */
export async function getRiskForContract(
  contractId: string,
): Promise<RiskResult | null> {
  const contract = await storage.getContract(contractId);
  if (!contract) return null;
  return computeRiskFor(contract);
}
