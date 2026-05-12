/**
 * Period-Close Evaluators (Slice 2)
 *
 * Stateless evaluators for the non-gross_calc phases that fire at period
 * close (rather than per-sale). Each evaluator inspects the period state —
 * sales, the running gross-calc total, and the rule's stored config — and
 * emits synthetic `calculation_rule_results` rows that are netted into the
 * period payable.
 *
 * Phases handled here, in order:
 *   returns_offset  → reverse fees on returned sales at the ORIGINAL booked
 *                     fee (looked up from the original sale's gross_calc
 *                     result row, NOT today's rate)
 *   net_adjustment  → overpayment_offset, advance_recoupment
 *   floor_minimum   → annual_minimum, quarterly_minimum, mgr
 *   cap_maximum     → period_cap, contract_cap
 *   penalty         → late_payment_penalty (from contract_obligations +
 *                     settlements), missed_milestone_fee (from
 *                     contract_obligations of type milestone/performance)
 *
 * Anything not in PERIOD_CLOSE_RULE_TYPES is ignored here — gross_calc and
 * legacy minimum_guarantee continue to flow through the per-sale path.
 *
 * Verify-then-Pay: a rule is eligible only when approvalStatus is exactly
 * 'approved'. Null / undefined / 'pending' / anything-else is treated as
 * not-yet-approved and the evaluator is skipped for that rule.
 */

import { db } from '../db';
import { and, eq, gt, gte, lte, inArray, sql } from 'drizzle-orm';
import {
  calculationRuleResults,
  contracts as contractsTbl,
  contractObligations,
  contractCalculations,
  contractRules,
  recoupmentBalances,
  salesData,
  settlements,
  systemSettings,
} from '@shared/schema';
import {
  resolveCalcPhase,
  CALC_PHASE_ORDER,
  PERIOD_CLOSE_RULE_TYPES,
  type CalcPhase,
} from '@shared/calcPhases';

export interface PCRule {
  id: string;
  ruleName: string | null;
  ruleType: string | null;
  baseRate: string | null;
  minimumGuarantee: string | null;
  formulaDefinition: any;
  aggregationScope?: string | null;
  approvalStatus?: string | null;
  calcPhase?: string | null;
  priority?: number | null;
}

export interface PCSale {
  id: string;
  transactionType?: string | null;
  originalSaleId?: string | null;
  matchedContractId?: string | null;
  grossAmount: number;
  transactionDate: Date;
}

export interface PCResultRow {
  ruleId: string | null;
  ruleName: string;
  ruleType: string;
  ruleSnapshot: any;
  qualificationSummary: any;
  adjustmentsApplied: any;
  totalFee: number;       // signed: negative reduces payable
  totalSalesAmount: number;
  transactionCount: number;
  phase: CalcPhase;
  relatedResultId: string | null;
  explanation: string;
}

export interface PCContext {
  contractId: string;
  // The in-flight calculation row id (already inserted before evaluators
  // run). Floor / cap windowed sums MUST exclude this id, otherwise the
  // current period's total gets counted twice (once in priorWindowTotal,
  // once in ctx.runningTotal).
  currentCalculationId?: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  rules: PCRule[];
  // gross_calc + per-sale totals already produced by the universal engine
  // for THIS period. The evaluators net against runningTotal and may mutate
  // it as they go (so cap evaluators see the post-floor running total).
  runningTotal: number;
  // Balance write-backs queued by net_adjustment evaluators. The orchestrator
  // does NOT apply these — routes.ts applies them to the recoupment_balances
  // ledger (and inserts a recoupment_ledger_entries row per consumption) only
  // after the period-close pass succeeds AND rule_results have been persisted.
  // This keeps cross-period balance depletion from drifting if a later step
  // fails. `balanceId` is null on the very first consumption (the ledger row
  // is upserted from `startingBalance` when applied).
  pendingBalanceUpdates?: Array<{
    ruleId: string;
    balanceId: string | null;
    balanceType: string;
    startingBalance: number;
    balanceBefore: number;
    consumed: number;
    balanceAfter: number;
  }>;
  salesItems: PCSale[];
  // Map from current-period gross_calc rule_result rows by ruleId — used by
  // evaluators that need to reference an in-period gross row.
  grossCalcResultsByRuleId: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ZERO_RESULT = (rule: PCRule, phase: CalcPhase, explanation: string): PCResultRow => ({
  ruleId: rule.id,
  ruleName: rule.ruleName || `${rule.ruleType || 'rule'}-${rule.id.slice(0, 6)}`,
  ruleType: rule.ruleType || 'unknown',
  ruleSnapshot: { id: rule.id, ruleType: rule.ruleType, formulaDefinition: rule.formulaDefinition },
  qualificationSummary: null,
  adjustmentsApplied: null,
  totalFee: 0,
  totalSalesAmount: 0,
  transactionCount: 0,
  phase,
  relatedResultId: null,
  explanation,
});

const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// returns_offset — original snapshot replay
// ---------------------------------------------------------------------------

interface OriginalSnapshot {
  // The fee booked on the original sale, taken from the original calc's
  // breakdown (per-sale grain). This is what we claw back, dollar-for-dollar.
  originalFee: number;
  originalGross: number;
  // The calculation_rule_results row id for the rule that booked the
  // original sale — used for relatedResultId linkage.
  resultRowId: string | null;
  ruleApplied: string | null;
}

/**
 * For each return sale, locate the ORIGINAL sale's booked fee by replaying
 * from the canonical calculation_rule_results snapshot:
 *   1. Load every gross_calc rule_result row for this contract joined to
 *      its parent contract_calculations row (the rule_result row IS the
 *      authoritative snapshot — id, ruleName, ruleSnapshot all live there).
 *   2. Order by rule_result.createdAt ASC so we deterministically pick the
 *      FIRST (original) booking when the same sale appears in multiple
 *      recalculations.
 *   3. Use the parent calc's breakdown only as the per-sale grain attached
 *      to that snapshot — filtered to entries whose ruleApplied matches the
 *      rule_result's ruleName, so each match is anchored to a single
 *      rule_result row that we then return as the relatedResultId.
 *
 * If no snapshot is found we return null and the evaluator emits nothing
 * for that return sale (we never silently fall back to today's rate, since
 * that would violate the snapshot-replay requirement).
 */
async function findOriginalSnapshots(
  originalSaleIds: string[],
  contractId: string,
): Promise<Map<string, OriginalSnapshot>> {
  const out = new Map<string, OriginalSnapshot>();
  if (originalSaleIds.length === 0) return out;

  // Drive the lookup from calculation_rule_results (the canonical snapshot
  // store). We only consider rows with phase='gross_calc' or NULL/legacy
  // (which is treated as gross_calc) — period-close phases never represent
  // an original booking.
  const ruleResultRows = await db.select({
    resultId: calculationRuleResults.id,
    calcId: calculationRuleResults.calculationId,
    ruleName: calculationRuleResults.ruleName,
    phase: calculationRuleResults.phase,
    createdAt: calculationRuleResults.createdAt,
    breakdown: contractCalculations.breakdown,
  }).from(calculationRuleResults)
    .innerJoin(contractCalculations, eq(contractCalculations.id, calculationRuleResults.calculationId))
    .where(eq(contractCalculations.contractId, contractId))
    .orderBy(calculationRuleResults.createdAt);

  // Cache parsed breakdown per calc id so we don't re-parse for every rule
  // result that shares the same parent calc.
  const parsedCache = new Map<string, any[]>();

  for (const row of ruleResultRows) {
    if (row.phase && row.phase !== 'gross_calc') continue;
    let parsed = parsedCache.get(row.calcId);
    if (!parsed) {
      try {
        parsed = typeof row.breakdown === 'string'
          ? JSON.parse(row.breakdown)
          : (row.breakdown as any[] | null) || [];
      } catch {
        parsed = [];
      }
      if (!Array.isArray(parsed)) parsed = [];
      parsedCache.set(row.calcId, parsed);
    }

    for (const item of parsed) {
      const sid = item?.saleId;
      if (!sid || !originalSaleIds.includes(sid)) continue;
      // First-write wins — preserves "original booking" replay semantics.
      if (out.has(sid)) continue;
      // Anchor to THIS rule_result row only when the per-sale entry was
      // booked by THIS rule (matches by ruleName). This keeps the snapshot
      // tied to the canonical calculation_rule_results record rather than
      // an unanchored breakdown entry.
      if (item.ruleApplied && item.ruleApplied !== row.ruleName) continue;

      out.set(sid, {
        originalFee: num(item.calculatedRoyalty ?? item.calculatedFee),
        originalGross: num(item.grossAmount ?? item.saleAmount),
        resultRowId: row.resultId,
        ruleApplied: row.ruleName,
      });
    }
  }
  return out;
}

async function evaluateReturnsOffset(ctx: PCContext, rule: PCRule): Promise<PCResultRow[]> {
  const returnSales = ctx.salesItems.filter(
    s => (s.transactionType || '').toLowerCase() === 'return',
  );
  if (returnSales.length === 0) {
    return [ZERO_RESULT(rule, 'returns_offset', 'No return transactions in period.')];
  }

  const originalIds = Array.from(new Set(
    returnSales.map(s => s.originalSaleId).filter((x): x is string => !!x),
  ));
  const snapshots = await findOriginalSnapshots(originalIds, ctx.contractId);

  // Emit ONE row per return sale so relatedResultId points at the specific
  // gross row each return reverses (auditability requirement).
  const rows: PCResultRow[] = [];
  let unmatched = 0;
  for (const ret of returnSales) {
    const snap = ret.originalSaleId ? snapshots.get(ret.originalSaleId) : undefined;
    if (!snap) {
      unmatched++;
      continue;
    }
    // Pro-rate the original fee by return-magnitude / original-gross when
    // the return is partial; otherwise reverse the full original fee.
    const retGross = Math.abs(ret.grossAmount);
    const portion = snap.originalGross > 0 ? Math.min(1, retGross / snap.originalGross) : 1;
    const reversedFee = -snap.originalFee * portion;

    rows.push({
      ruleId: rule.id,
      ruleName: rule.ruleName || 'Returns offset',
      ruleType: rule.ruleType || 'returns_offset',
      ruleSnapshot: {
        id: rule.id,
        ruleType: rule.ruleType,
        formulaDefinition: rule.formulaDefinition,
        replayedFromRule: snap.ruleApplied,
      },
      qualificationSummary: {
        returnSaleId: ret.id,
        originalSaleId: ret.originalSaleId,
        originalFee: snap.originalFee,
        originalGross: snap.originalGross,
        returnGross: retGross,
        portionReversed: portion,
      },
      adjustmentsApplied: { reversedFee },
      totalFee: reversedFee,
      totalSalesAmount: retGross,
      transactionCount: 1,
      phase: 'returns_offset',
      // Self-FK to the gross_calc rule_result row that originally booked
      // this sale — full audit linkage.
      relatedResultId: snap.resultRowId,
      explanation: `Reversed return ${ret.id} → original sale ${ret.originalSaleId}: clawed back $${Math.abs(reversedFee).toFixed(2)} (${(portion * 100).toFixed(1)}% of original fee $${snap.originalFee.toFixed(2)}).`,
    });
  }

  if (rows.length === 0) {
    return [ZERO_RESULT(rule, 'returns_offset',
      `Found ${returnSales.length} return(s) but no original gross_calc snapshot was located for any of them — no offset applied (snapshot replay is required, fallback to today's rate is disallowed).`)];
  }
  if (unmatched > 0) {
    rows.push({
      ...ZERO_RESULT(rule, 'returns_offset',
        `${unmatched} return(s) could not be matched to an original snapshot and were not offset.`),
      qualificationSummary: { unmatchedReturns: unmatched },
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// net_adjustment — overpayment_offset, advance_recoupment
// ---------------------------------------------------------------------------
async function evaluateNetAdjustment(ctx: PCContext, rule: PCRule): Promise<PCResultRow[]> {
  const fd = rule.formulaDefinition || {};
  const ruleType = (rule.ruleType || '').toLowerCase();

  // Authoritative remaining balance lives in the recoupment_balances ledger.
  // The rule's formulaDefinition is only consulted to seed the STARTING
  // balance the very first time the ledger row is created — after that the
  // ledger is the single source of truth so the same balance can't be
  // consumed twice across periods.
  let balanceId: string | null = null;
  let startingBalance = 0;
  let balance = 0;
  if (rule.id) {
    const [existing] = await db.select().from(recoupmentBalances)
      .where(and(eq(recoupmentBalances.contractId, ctx.contractId), eq(recoupmentBalances.ruleId, rule.id)))
      .limit(1);
    if (existing) {
      balanceId = existing.id;
      startingBalance = num(existing.startingBalance);
      balance = num(existing.remainingBalance);
    } else {
      // First-touch: seed from the rule config. Subsequent periods will
      // ignore the rule config and only read the ledger.
      startingBalance = num(fd.priorBalance ?? fd.recoupableBalance ?? fd.balance);
      balance = startingBalance;
    }
  }

  if (balance <= 0) {
    return [ZERO_RESULT(rule, 'net_adjustment',
      `${ruleType}: no remaining balance to consume (ledger remaining=$${balance.toFixed(2)}, starting=$${startingBalance.toFixed(2)}).`)];
  }
  const consumed = Math.min(balance, Math.max(0, ctx.runningTotal));
  const fee = -consumed;
  const before = ctx.runningTotal;
  ctx.runningTotal += fee;

  // Queue the depleted balance for write-back to the ledger. routes.ts
  // applies pendingBalanceUpdates only after the entire period-close pass
  // succeeds and rule_results have been persisted; that keeps cross-period
  // balance from drifting when a later evaluator or downstream persistence
  // fails (the calc is marked failed and no balance is consumed).
  const balanceAfter = +(balance - consumed).toFixed(2);
  if (consumed > 0 && rule.id) {
    if (!ctx.pendingBalanceUpdates) ctx.pendingBalanceUpdates = [];
    ctx.pendingBalanceUpdates.push({
      ruleId: rule.id,
      balanceId,
      balanceType: ruleType,
      startingBalance,
      balanceBefore: balance,
      consumed,
      balanceAfter,
    });
  }
  return [{
    ruleId: rule.id,
    ruleName: rule.ruleName || (ruleType === 'advance_recoupment' ? 'Advance recoupment' : 'Overpayment offset'),
    ruleType,
    ruleSnapshot: {
      id: rule.id,
      ruleType,
      formulaDefinition: fd,
      // Snapshot the ledger state as of this evaluation so the audit trail
      // shows where the balance came from and what was left after.
      ledger: {
        balanceId,
        startingBalance,
        balanceBefore: balance,
        balanceAfter,
      },
    },
    qualificationSummary: {
      ledgerBalanceId: balanceId,
      startingBalance,
      availableBalance: balance,
      consumed,
      remainingAfter: balanceAfter,
    },
    adjustmentsApplied: {
      runningTotalBefore: before,
      runningTotalAfter: ctx.runningTotal,
      balanceBefore: balance,
      balanceAfter,
      consumed,
    },
    totalFee: fee,
    totalSalesAmount: 0,
    transactionCount: 0,
    phase: 'net_adjustment',
    // Link to the in-period gross row this is netting against (first by
    // priority order) so the audit trail shows what was reduced.
    relatedResultId: ctx.grossCalcResultsByRuleId.values().next().value || null,
    explanation: `${ruleType}: consumed $${consumed.toFixed(2)} of $${balance.toFixed(2)} remaining (starting balance $${startingBalance.toFixed(2)}, $${balanceAfter.toFixed(2)} left after this period) against running total $${before.toFixed(2)}.`,
  }];
}

// ---------------------------------------------------------------------------
// floor_minimum
// ---------------------------------------------------------------------------
async function evaluateFloor(ctx: PCContext, rule: PCRule): Promise<PCResultRow[]> {
  const fd = rule.formulaDefinition || {};
  const floor = num(fd.minimum ?? fd.floor ?? fd.amount ?? rule.minimumGuarantee);
  if (floor <= 0) {
    return [ZERO_RESULT(rule, 'floor_minimum', `${rule.ruleType}: no floor configured.`)];
  }
  // Windowed semantics: annual_minimum / quarterly_minimum / mgr should
  // true-up against the period-to-window total (e.g. YTD or QTD), not just
  // the current period's net. The current in-progress calc contributes
  // ctx.runningTotal — prior calcs come from contract_calculations.
  const win = resolveWindow(ctx, rule);
  const priorWindowTotal = await getWindowPriorTotal(ctx.contractId, win.start, win.end, ctx.currentCalculationId);
  const windowTotalBefore = priorWindowTotal + ctx.runningTotal;
  if (windowTotalBefore >= floor) {
    return [{
      ...ZERO_RESULT(rule, 'floor_minimum', `${rule.ruleType}: ${win.label} total $${windowTotalBefore.toFixed(2)} already meets floor $${floor.toFixed(2)}.`),
      qualificationSummary: { floor, window: win.label, priorWindowTotal, windowTotal: windowTotalBefore, trueUp: 0 },
    }];
  }
  const before = ctx.runningTotal;
  const trueUp = floor - windowTotalBefore;
  ctx.runningTotal = before + trueUp;
  return [{
    ruleId: rule.id,
    ruleName: rule.ruleName || `Floor minimum (${rule.ruleType})`,
    ruleType: rule.ruleType || 'floor_minimum',
    ruleSnapshot: { id: rule.id, ruleType: rule.ruleType, formulaDefinition: fd, floor, window: win.label },
    qualificationSummary: { floor, window: win.label, priorWindowTotal, windowTotalBefore, trueUp },
    adjustmentsApplied: { runningTotalBefore: before, runningTotalAfter: ctx.runningTotal },
    totalFee: trueUp,
    totalSalesAmount: 0,
    transactionCount: 0,
    phase: 'floor_minimum',
    relatedResultId: null,
    explanation: `Floor true-up (${win.label}): brought ${win.label} total $${windowTotalBefore.toFixed(2)} up to floor $${floor.toFixed(2)} (+$${trueUp.toFixed(2)}).`,
  }];
}

// Resolve the [start, end) window for a windowed floor / cap rule. Honors
// rule.aggregationScope first, then falls back to the rule type. Anchors
// quarter / year / month windows on ctx.periodEnd (or now). Contract-scope
// uses an open-ended window so all prior calcs roll up.
function resolveWindow(
  ctx: PCContext,
  rule: PCRule,
): { start: Date; end: Date; label: string } {
  const scope = (rule.aggregationScope || '').toLowerCase();
  const ruleType = (rule.ruleType || '').toLowerCase();
  const anchor = ctx.periodEnd ? new Date(ctx.periodEnd) : new Date();
  const yr = anchor.getUTCFullYear();
  const mo = anchor.getUTCMonth();

  const isAnnual = scope === 'year' || scope === 'annual' || ruleType === 'annual_minimum' || ruleType === 'mgr';
  const isQuarter = scope === 'quarter' || scope === 'quarterly' || ruleType === 'quarterly_minimum';
  const isContract = scope === 'contract' || scope === 'lifetime' || ruleType === 'contract_cap';

  if (isAnnual) {
    return {
      start: new Date(Date.UTC(yr, 0, 1)),
      end: new Date(Date.UTC(yr + 1, 0, 1)),
      label: `${yr}`,
    };
  }
  if (isQuarter) {
    const qStart = Math.floor(mo / 3) * 3;
    return {
      start: new Date(Date.UTC(yr, qStart, 1)),
      end: new Date(Date.UTC(yr, qStart + 3, 1)),
      label: `Q${qStart / 3 + 1} ${yr}`,
    };
  }
  if (isContract) {
    return {
      start: new Date(0),
      end: new Date(Date.UTC(2999, 11, 31)),
      label: 'contract-lifetime',
    };
  }
  // Default: current period only (period_cap and unscoped floors). When we
  // have no period bounds, fall back to current month.
  const start = ctx.periodStart ? new Date(ctx.periodStart) : new Date(Date.UTC(yr, mo, 1));
  const end = ctx.periodEnd ? new Date(ctx.periodEnd) : new Date(Date.UTC(yr, mo + 1, 1));
  return { start, end, label: 'current-period' };
}

// Sum prior approved/paid contract_calculations.totalRoyalty for this
// contract whose period overlaps [windowStart, windowEnd). Excludes failed
// rows so we never window-credit invalid totals. The current in-progress
// calc is not yet finalized to a value; its contribution is ctx.runningTotal,
// added by the caller.
async function getWindowPriorTotal(
  contractId: string,
  windowStart: Date,
  windowEnd: Date,
  excludeCalculationId?: string | null,
): Promise<number> {
  const rows = await db.select({
    id: contractCalculations.id,
    totalRoyalty: contractCalculations.totalRoyalty,
    periodStart: contractCalculations.periodStart,
    periodEnd: contractCalculations.periodEnd,
    status: contractCalculations.status,
  }).from(contractCalculations)
    .where(eq(contractCalculations.contractId, contractId));
  let sum = 0;
  for (const r of rows) {
    // Exclude the in-flight calc — its contribution is in ctx.runningTotal.
    if (excludeCalculationId && r.id === excludeCalculationId) continue;
    if (r.status === 'failed' || r.status === 'rejected') continue;
    const ps = r.periodStart ? new Date(r.periodStart) : null;
    const pe = r.periodEnd ? new Date(r.periodEnd) : null;
    // Overlap test: [ps, pe) intersects [windowStart, windowEnd)
    if (ps && pe && (pe <= windowStart || ps >= windowEnd)) continue;
    sum += num(r.totalRoyalty);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// cap_maximum
// ---------------------------------------------------------------------------
async function evaluateCap(ctx: PCContext, rule: PCRule): Promise<PCResultRow[]> {
  const fd = rule.formulaDefinition || {};
  const cap = num(fd.maximum ?? fd.cap ?? fd.amount);
  if (cap <= 0) {
    return [ZERO_RESULT(rule, 'cap_maximum', `${rule.ruleType}: no cap configured.`)];
  }
  // Windowed semantics: period_cap is current-period only; contract_cap is
  // contract lifetime. The current in-progress calc contributes
  // ctx.runningTotal — prior calcs come from contract_calculations.
  const win = resolveWindow(ctx, rule);
  const priorWindowTotal = await getWindowPriorTotal(ctx.contractId, win.start, win.end, ctx.currentCalculationId);
  const windowTotalBefore = priorWindowTotal + ctx.runningTotal;
  if (windowTotalBefore <= cap) {
    return [{
      ...ZERO_RESULT(rule, 'cap_maximum', `${rule.ruleType}: ${win.label} total $${windowTotalBefore.toFixed(2)} within cap $${cap.toFixed(2)}.`),
      qualificationSummary: { cap, window: win.label, priorWindowTotal, windowTotal: windowTotalBefore, clawback: 0 },
    }];
  }
  const before = ctx.runningTotal;
  const clawback = cap - windowTotalBefore; // negative
  ctx.runningTotal = before + clawback;
  return [{
    ruleId: rule.id,
    ruleName: rule.ruleName || `Cap (${rule.ruleType})`,
    ruleType: rule.ruleType || 'cap_maximum',
    ruleSnapshot: { id: rule.id, ruleType: rule.ruleType, formulaDefinition: fd, cap, window: win.label },
    qualificationSummary: { cap, window: win.label, priorWindowTotal, windowTotalBefore, clawback },
    adjustmentsApplied: { runningTotalBefore: before, runningTotalAfter: ctx.runningTotal },
    totalFee: clawback,
    totalSalesAmount: 0,
    transactionCount: 0,
    phase: 'cap_maximum',
    relatedResultId: null,
    explanation: `Cap enforcement (${win.label}): clawed back $${Math.abs(clawback).toFixed(2)} so ${win.label} total stays at cap $${cap.toFixed(2)}.`,
  }];
}

// ---------------------------------------------------------------------------
// penalty — pulls overdue obligations from authoritative tables
// (contract_obligations + settlements), NOT from rule JSON.
// ---------------------------------------------------------------------------
async function evaluatePenalty(ctx: PCContext, rule: PCRule): Promise<PCResultRow[]> {
  const fd = rule.formulaDefinition || {};
  const ruleType = (rule.ruleType || '').toLowerCase();
  const today = ctx.periodEnd || new Date();

  if (ruleType === 'missed_milestone_fee') {
    // Authoritative source: contract_obligations rows of type milestone /
    // performance / delivery whose due_date is in the past and whose
    // status is not 'completed' or 'cancelled'.
    const obligations = await db.select().from(contractObligations)
      .where(and(
        eq(contractObligations.contractId, ctx.contractId),
        inArray(contractObligations.obligationType, ['milestone', 'performance', 'delivery']),
      ));
    const overdue = obligations.filter(o => {
      if (!o.dueDate) return false;
      if (o.status === 'completed' || o.status === 'cancelled') return false;
      return new Date(o.dueDate) < today;
    });
    if (overdue.length === 0) {
      return [ZERO_RESULT(rule, 'penalty', 'No overdue milestones in contract_obligations.')];
    }
    // Per-milestone fee schedule lives on the rule (the rule defines the
    // fee schedule; the data lives in contract_obligations). Default to a
    // flat fee per overdue obligation when no schedule is present.
    const flatFee = num(fd.fee ?? fd.amount);
    const totalFee = overdue.length * flatFee;
    return [{
      ruleId: rule.id,
      ruleName: rule.ruleName || 'Missed milestone fee',
      ruleType,
      ruleSnapshot: { id: rule.id, ruleType, formulaDefinition: fd, flatFee },
      qualificationSummary: {
        overdueCount: overdue.length,
        obligations: overdue.map(o => ({ id: o.id, type: o.obligationType, dueDate: o.dueDate, status: o.status })),
      },
      adjustmentsApplied: null,
      totalFee,
      totalSalesAmount: 0,
      transactionCount: overdue.length,
      phase: 'penalty',
      relatedResultId: null,
      explanation: `${overdue.length} contract obligation(s) past deadline → $${totalFee.toFixed(2)} fee at $${flatFee.toFixed(2)}/each.`,
    }];
  }

  // late_payment_penalty
  // Authoritative sources:
  //   contract_obligations of type 'payment' (gives us due dates)
  //   settlements (gives us paid amounts / posting dates)
  const ratePct = num(fd.rate ?? fd.penaltyRate ?? rule.baseRate);
  const graceDays = num(fd.graceDays ?? 0);
  const compound = !!fd.compound;
  if (ratePct <= 0) {
    return [ZERO_RESULT(rule, 'penalty', 'late_payment_penalty: no penalty rate configured on rule.')];
  }

  const paymentObs = await db.select().from(contractObligations)
    .where(and(
      eq(contractObligations.contractId, ctx.contractId),
      eq(contractObligations.obligationType, 'payment'),
    ));
  if (paymentObs.length === 0) {
    return [ZERO_RESULT(rule, 'penalty', 'late_payment_penalty: no payment obligations on contract.')];
  }
  // Deterministic order: oldest createdAt first, tie-break by id, so the
  // "earliest matching settlement" pick below is stable across runs and not
  // dependent on storage ordering.
  const settled = await db.select().from(settlements)
    .where(eq(settlements.contractId, ctx.contractId))
    .orderBy(settlements.createdAt, settlements.id);

  const dailyRate = (ratePct > 1 ? ratePct / 100 : ratePct) / 365;
  let totalFee = 0;
  const details: any[] = [];
  for (const ob of paymentObs) {
    if (!ob.dueDate) continue;
    if (ob.status === 'cancelled') continue;
    const due = new Date(ob.dueDate);
    // Earliest matching settlement marks the payment date. We prefer one
    // explicitly linked to this obligation (obligationId / linkedObligationId
    // / contractObligationId, whichever is present in the settlements row);
    // when no explicit link exists we fall back to the first paid/posted
    // settlement on/after the due date. If none is posted, treat the period
    // end as the open-as-of date. `settled` is ordered ASC by createdAt.
    const isPosted = (s: any) =>
      s.matchStatus === 'matched' || s.settlementStatus === 'paid' || s.settlementStatus === 'posted';
    const linkedTo = (s: any) =>
      s.obligationId === ob.id || s.linkedObligationId === ob.id || s.contractObligationId === ob.id;
    const matchedSettlement =
      settled.find(s => linkedTo(s) && isPosted(s)) ||
      settled.find(s => isPosted(s) && s.createdAt && new Date(s.createdAt) >= due);
    const settledOn = ob.completionDate
      ? new Date(ob.completionDate)
      : matchedSettlement?.createdAt
        ? new Date(matchedSettlement.createdAt)
        : today;
    const daysOverdue = Math.max(0, Math.floor((settledOn.getTime() - due.getTime()) / 86400000) - graceDays);
    if (daysOverdue <= 0) continue;
    const principal = num(matchedSettlement?.postedAmount ?? matchedSettlement?.claimAmount ?? matchedSettlement?.accrualAmount);
    if (principal <= 0) continue;
    const fee = compound
      ? principal * (Math.pow(1 + dailyRate, daysOverdue) - 1)
      : principal * dailyRate * daysOverdue;
    totalFee += fee;
    details.push({ obligationId: ob.id, dueDate: ob.dueDate, settledOn, daysOverdue, principal, fee: +fee.toFixed(2) });
  }
  if (details.length === 0) {
    return [ZERO_RESULT(rule, 'penalty', 'late_payment_penalty: no payment obligations are past due.')];
  }
  return [{
    ruleId: rule.id,
    ruleName: rule.ruleName || 'Late payment penalty',
    ruleType,
    ruleSnapshot: { id: rule.id, ruleType, formulaDefinition: fd, ratePct, graceDays, compound },
    qualificationSummary: { obligationsChecked: paymentObs.length, overdue: details.length, details },
    adjustmentsApplied: null,
    totalFee,
    totalSalesAmount: 0,
    transactionCount: details.length,
    phase: 'penalty',
    relatedResultId: null,
    explanation: `${details.length} payment obligation(s) overdue at ${ratePct}%/yr (grace ${graceDays}d, ${compound ? 'compound' : 'simple'}) → $${totalFee.toFixed(2)}.`,
  }];
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run every period-close evaluator that has a configured + APPROVED rule on
 * the contract, in phase-then-priority order. Mutates `ctx.runningTotal` so
 * later phases (cap, penalty) see the post-floor value.
 *
 * Verify-then-Pay: a rule MUST have approvalStatus === 'approved' to fire.
 * Null / undefined / 'pending' / anything-else is treated as not-yet-
 * approved and the rule is skipped (no silent default-to-approved).
 */
export async function runPeriodCloseEvaluators(ctx: PCContext): Promise<PCResultRow[]> {
  const eligible = ctx.rules
    .filter(r => PERIOD_CLOSE_RULE_TYPES.has((r.ruleType || '').toLowerCase()))
    .filter(r => r.approvalStatus === 'approved')
    .sort((a, b) => {
      const pa = CALC_PHASE_ORDER[resolveCalcPhase(a)] ?? 99;
      const pb = CALC_PHASE_ORDER[resolveCalcPhase(b)] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.priority ?? 10) - (b.priority ?? 10);
    });

  const out: PCResultRow[] = [];
  for (const rule of eligible) {
    const phase = resolveCalcPhase(rule);
    let rows: PCResultRow[] = [];
    // Fail-closed: do NOT swallow per-rule errors. If any obligation
    // evaluator throws, surface it so routes.ts can mark the calc failed
    // and skip downstream accrual / JE auto-creation. Partial totals
    // would otherwise feed payable.
    switch (phase) {
      case 'returns_offset':
        rows = await evaluateReturnsOffset(ctx, rule);
        break;
      case 'net_adjustment':
        rows = await evaluateNetAdjustment(ctx, rule);
        break;
      case 'floor_minimum':
        rows = await evaluateFloor(ctx, rule);
        break;
      case 'cap_maximum':
        rows = await evaluateCap(ctx, rule);
        break;
      case 'penalty':
        rows = await evaluatePenalty(ctx, rule);
        break;
      default:
        continue;
    }
    // returns_offset and penalty rows mutate runningTotal here — the
    // floor/cap/net evaluators already update inline so they can chain.
    for (const r of rows) {
      if (r.phase === 'returns_offset' || r.phase === 'penalty') {
        ctx.runningTotal += r.totalFee;
      }
      out.push(r);
    }
  }
  return out;
}

/**
 * Resolve effective obligation accrual basis for a contract: contract-level
 * pin, else the system default (slice 2 default = 'scheduled_release').
 */
export async function getObligationAccrualBasis(contractId: string): Promise<'qualifying_sale' | 'scheduled_release'> {
  try {
    const [c] = await db.select({ basis: contractsTbl.obligationAccrualBasis })
      .from(contractsTbl).where(eq(contractsTbl.id, contractId)).limit(1);
    if (c?.basis === 'qualifying_sale' || c?.basis === 'scheduled_release') return c.basis;
    const [s] = await db.select({ d: systemSettings.defaultObligationAccrualBasis })
      .from(systemSettings).limit(1);
    if (s?.d === 'qualifying_sale') return 'qualifying_sale';
  } catch (e) {
    console.error('[period-close-eval] getObligationAccrualBasis fallback:', e);
  }
  return 'scheduled_release';
}
