/**
 * Obligations Service (Slice 3 — Obligations Lifecycle)
 *
 * Single source of truth for stateful obligations: MDF buckets, recoupable
 * advances, returns reserves, performance / signing bonuses, milestone
 * payments, and minimum true-ups.
 *
 * The service exposes three entry points:
 *
 *   1. `runObligationAccrual(ctx)` — invoked by routes.ts during the
 *      period-close pass. For every approved rule whose ruleType is in
 *      OBLIGATION_ACCRUAL_RULE_TYPES, upsert an obligation row scoped to
 *      (contractId, ruleId, fundingPeriod) and emit a
 *      calculation_rule_results row tagged phase='obligation_accrual'.
 *
 *   2. `transitionObligation(id, action, payload)` — state machine for
 *      claim → approve → pay (or expire / reverse). Each transition
 *      writes an obligation_events row and a draft journal_entries row.
 *
 *   3. `runObligationExpirySweep(opts)` — date-driven nightly sweep that
 *      forfeits stale obligations per their rolloverPolicy. Emits a
 *      calculation_rule_results row tagged phase='obligation_expiry'
 *      and a draft reversal JE per expired obligation.
 *
 * In addition `applyAdvanceRecoupment(opts)` is called from the slice-2
 * `advance_recoupment` evaluator to debit the matching `recoupable_advance`
 * obligation balance (recoupment netting).
 */

import { db } from '../db';
import { and, eq, gte, lte, inArray, sql, asc, desc, isNotNull, lt } from 'drizzle-orm';

/**
 * Either the root db client or an active transaction. Every public function
 * accepts an optional `tx` so the caller (e.g. period-close) can thread its
 * transaction through and keep obligation writes atomic with the rest of
 * the close pipeline.
 */
export type DbExecutor = typeof db;
import {
  obligations,
  obligationEvents,
  contracts as contractsTbl,
  contractRules as contractRulesTbl,
  journalEntries as jeTbl,
  journalEntryLines as jeLinesTbl,
  calculationRuleResults,
  contractCalculations,
} from '@shared/schema';
import {
  OBLIGATION_ACCRUAL_RULE_TYPES,
  RULE_TYPE_TO_OBLIGATION_KIND,
  resolveCalcPhase,
  type CalcPhase,
  type ObligationKind,
  type ObligationStatus,
  type PhaseSortableRule,
} from '@shared/calcPhases';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FormulaDefinition = Record<string, unknown>;
export type RuleSnapshot = Record<string, unknown>;

export interface ObligationAccrualRule {
  id: string;
  ruleName: string | null;
  ruleType: string | null;
  formulaDefinition: FormulaDefinition;
  approvalStatus?: string | null;
  priority?: number | null;
}

export interface ObligationAccrualContext {
  contractId: string;
  companyId?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  fundingPeriodLabel: string;
  /** Contract currency — flows through to obligation rows + JE context. */
  currency?: string | null;
  rules: ObligationAccrualRule[];
  // Period sales total — used by % / per-sale obligation accruals (e.g.
  // returns reserve = periodSales × rate).
  periodSalesTotal: number;
  // 'qualifying_sale' books at sale date; 'scheduled_release' books at
  // plannedReleaseDate. Resolved by routes.ts via getObligationAccrualBasis.
  accrualBasis: 'qualifying_sale' | 'scheduled_release';
  userId?: string | null;
  userName?: string | null;
}

export interface ObligationAccrualResultRow {
  ruleId: string | null;
  ruleName: string;
  ruleType: string;
  ruleSnapshot: RuleSnapshot;
  qualificationSummary: RuleSnapshot;
  adjustmentsApplied: RuleSnapshot;
  totalFee: number;
  totalSalesAmount: number;
  transactionCount: number;
  phase: CalcPhase;
  relatedResultId: string | null;
  explanation: string;
  obligationId: string;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Per rule-type accrual config — distills the rule's formulaDefinition into
// the canonical obligation row fields (amount + dates).
// ---------------------------------------------------------------------------
function deriveAccrual(
  rule: ObligationAccrualRule,
  ctx: ObligationAccrualContext,
): {
  amount: number;
  plannedReleaseDate: Date | null;
  expiryDate: Date | null;
  rolloverPolicy: string;
  explanation: string;
} {
  const fd = rule.formulaDefinition || {};
  const ruleType = (rule.ruleType || '').toLowerCase();
  const periodEnd = ctx.periodEnd || new Date();

  // Resolve amount: explicit `amount`, else `rate` × periodSalesTotal,
  // else `periodAccrualAmount`, else 0.
  let amount = num(fd.amount ?? fd.fixedAmount ?? fd.periodAccrualAmount);
  if (amount === 0) {
    const rate = num(fd.rate ?? fd.percentage ?? fd.bps);
    if (rate > 0 && ctx.periodSalesTotal > 0) {
      // bps: divide by 10000; percentage: divide by 100; rate: assume decimal
      const isBps = fd.bps !== undefined;
      const divisor = isBps ? 10000 : (rate > 1 ? 100 : 1);
      amount = +((ctx.periodSalesTotal * rate) / divisor).toFixed(2);
    }
  }

  // Planned release: explicit, else N days from period end, else period end
  // (qualifying_sale basis means it books on accrual date; scheduled_release
  // basis means the planned release date governs the GL hit).
  let plannedReleaseDate: Date | null = null;
  if (fd.plannedReleaseDate) {
    plannedReleaseDate = new Date(fd.plannedReleaseDate);
  } else if (fd.releaseAfterDays) {
    plannedReleaseDate = new Date(periodEnd);
    plannedReleaseDate.setDate(plannedReleaseDate.getDate() + Number(fd.releaseAfterDays || 0));
  } else if (ruleType === 'mdf_accrual') {
    // Default MDF = claimable for 90 days after period end.
    plannedReleaseDate = new Date(periodEnd);
  } else if (ruleType === 'minimum_trueup' || ruleType === 'returns_reserve' || ruleType === 'reserve_accrual') {
    plannedReleaseDate = new Date(periodEnd);
  }

  // Expiry: explicit, else default per kind.
  let expiryDate: Date | null = null;
  if (fd.expiryDate) {
    expiryDate = new Date(fd.expiryDate);
  } else if (fd.expiresAfterDays) {
    expiryDate = new Date(plannedReleaseDate || periodEnd);
    expiryDate.setDate(expiryDate.getDate() + Number(fd.expiresAfterDays || 0));
  } else if (ruleType === 'mdf_accrual') {
    expiryDate = new Date(periodEnd);
    expiryDate.setDate(expiryDate.getDate() + 90);
  } else if (ruleType === 'performance_bonus' || ruleType === 'signing_bonus') {
    expiryDate = new Date(periodEnd);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }

  const rolloverPolicy = String(fd.rolloverPolicy || (ruleType === 'mdf_accrual' ? 'forfeit' : 'forfeit'));

  const explanation = amount === 0
    ? `${ruleType}: rule produced zero accrual (no amount/rate or no qualifying sales).`
    : `${ruleType}: accrued $${amount.toFixed(2)} for ${ctx.fundingPeriodLabel} (basis: ${ctx.accrualBasis}).`;

  return { amount, plannedReleaseDate, expiryDate, rolloverPolicy, explanation };
}

// ---------------------------------------------------------------------------
// Accrual entry point
// ---------------------------------------------------------------------------

/**
 * Run the obligation_accrual phase for the given context. Returns one
 * synthetic calculation_rule_results row per eligible rule (for engine
 * traceability) and upserts / refreshes the corresponding obligation row
 * keyed on (contractId, ruleId, fundingPeriod).
 *
 * This intentionally does NOT mutate `ctx.runningTotal` — obligation
 * accruals do not net into the period payable; they live in their own
 * lifecycle and produce their own JEs at release/payment time.
 */
export async function runObligationAccrual(
  ctx: ObligationAccrualContext,
  tx?: DbExecutor,
): Promise<ObligationAccrualResultRow[]> {
  const exec: DbExecutor = tx ?? db;
  // Eligibility gate: rule type is in the obligation set AND its resolved
  // calcPhase is `obligation_accrual`. The phase check guarantees that a
  // legacy `milestone_payment` rule whose default phase is `gross_calc`
  // continues to flow through gross_calc unchanged — only rules explicitly
  // authored for the obligation phase (or types whose default phase is
  // obligation_accrual) accrue stateful obligations.
  const eligible = ctx.rules
    .filter(r => OBLIGATION_ACCRUAL_RULE_TYPES.has((r.ruleType || '').toLowerCase()))
    .filter(r => resolveCalcPhase(r as PhaseSortableRule) === 'obligation_accrual')
    .filter(r => r.approvalStatus === 'approved')
    .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

  const out: ObligationAccrualResultRow[] = [];
  for (const rule of eligible) {
    const ruleType = (rule.ruleType || '').toLowerCase();
    const kind = RULE_TYPE_TO_OBLIGATION_KIND[ruleType];
    if (!kind) continue;

    const accrual = deriveAccrual(rule, ctx);
    const accrualDate = ctx.accrualBasis === 'scheduled_release' && accrual.plannedReleaseDate
      ? accrual.plannedReleaseDate
      : (ctx.periodEnd || new Date());

    // Upsert: same (contract, rule, fundingPeriod) refreshes the existing
    // row to support recalculation. We never overwrite a row that has
    // already moved past 'accrued' — those are immutable.
    const existing = await exec.select()
      .from(obligations)
      .where(and(
        eq(obligations.contractId, ctx.contractId),
        eq(obligations.ruleId, rule.id),
        eq(obligations.fundingPeriod, ctx.fundingPeriodLabel),
      ))
      .limit(1);

    let obligationId: string;
    if (existing.length === 0) {
      const [row] = await exec.insert(obligations).values({
        contractId: ctx.contractId,
        ruleId: rule.id,
        partnerId: ctx.partnerId || null,
        partnerName: ctx.partnerName || null,
        kind,
        amount: accrual.amount.toFixed(2),
        outstandingAmount: accrual.amount.toFixed(2),
        currency: ctx.currency || 'USD',
        fundingPeriod: ctx.fundingPeriodLabel,
        accrualDate,
        plannedReleaseDate: accrual.plannedReleaseDate,
        expiryDate: accrual.expiryDate,
        status: 'accrued',
        rolloverPolicy: accrual.rolloverPolicy,
        companyId: ctx.companyId || null,
        createdBy: ctx.userId || 'system',
        metadata: {
          accrualBasis: ctx.accrualBasis,
          ruleType,
          ruleName: rule.ruleName,
          formulaDefinition: rule.formulaDefinition,
        },
      }).returning();
      obligationId = row.id;

      await exec.insert(obligationEvents).values({
        obligationId,
        eventType: 'accrued',
        fromStatus: null,
        toStatus: 'accrued',
        amount: accrual.amount.toFixed(2),
        description: accrual.explanation,
        userId: ctx.userId || 'system',
        userName: ctx.userName || 'System',
        phase: 'obligation_accrual',
        metadata: { accrualBasis: ctx.accrualBasis, ruleType },
      });

      // Draft JE for the accrual (debit expense / credit accrued liability
      // for payable-to-partner kinds; reserve kinds debit returns reserve
      // expense / credit allowance liability).
      await writeAccrualJournalEntry({
        obligationId,
        contractId: ctx.contractId,
        companyId: ctx.companyId || null,
        amount: accrual.amount,
        kind,
        period: ctx.fundingPeriodLabel,
        partnerName: ctx.partnerName,
        userId: ctx.userId || 'system',
      }, exec);
    } else {
      obligationId = existing[0].id;
      // Only refresh if still in 'accrued' state. Once moved past accrued
      // (claimable / claimed / approved / paid / expired / reversed) the
      // amount is immutable — recalculation should not silently mutate.
      if (existing[0].status === 'accrued') {
        const oldAmount = num(existing[0].amount);
        if (Math.abs(oldAmount - accrual.amount) > 0.005) {
          await exec.update(obligations)
            .set({
              amount: accrual.amount.toFixed(2),
              outstandingAmount: accrual.amount.toFixed(2),
              plannedReleaseDate: accrual.plannedReleaseDate,
              expiryDate: accrual.expiryDate,
              accrualDate,
              updatedAt: new Date(),
            })
            .where(eq(obligations.id, obligationId));
          await exec.insert(obligationEvents).values({
            obligationId,
            eventType: 'accrual_refreshed',
            fromStatus: 'accrued',
            toStatus: 'accrued',
            amount: accrual.amount.toFixed(2),
            description: `Accrual refreshed: $${oldAmount.toFixed(2)} → $${accrual.amount.toFixed(2)}.`,
            userId: ctx.userId || 'system',
            userName: ctx.userName || 'System',
            phase: 'obligation_accrual',
          });
        }
      }
    }

    out.push({
      ruleId: rule.id,
      ruleName: rule.ruleName || `${ruleType}-${rule.id.slice(0, 6)}`,
      ruleType,
      ruleSnapshot: { id: rule.id, ruleType, formulaDefinition: rule.formulaDefinition, kind },
      qualificationSummary: {
        kind,
        amount: accrual.amount,
        plannedReleaseDate: accrual.plannedReleaseDate,
        expiryDate: accrual.expiryDate,
        accrualBasis: ctx.accrualBasis,
        fundingPeriod: ctx.fundingPeriodLabel,
      },
      adjustmentsApplied: { obligationId },
      totalFee: 0, // never nets into period payable
      totalSalesAmount: ctx.periodSalesTotal,
      transactionCount: 0,
      phase: 'obligation_accrual',
      relatedResultId: null,
      explanation: accrual.explanation,
      obligationId,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// State machine — claim / approve / pay / expire / reverse / true-up
// ---------------------------------------------------------------------------

export type ObligationAction =
  | 'submit_claim'
  | 'approve_claim'
  | 'mark_paid'
  | 'expire'
  | 'reverse'
  | 'true_up';

const VALID_TRANSITIONS: Record<ObligationStatus, ObligationAction[]> = {
  accrued: ['submit_claim', 'expire', 'reverse'],
  claimable: ['submit_claim', 'expire', 'reverse'],
  claimed: ['approve_claim', 'reverse'],
  approved: ['mark_paid', 'reverse'],
  paid: ['true_up', 'reverse'],
  expired: ['reverse'],
  reversed: [],
};

export interface TransitionPayload {
  amount?: number;
  claimReference?: string;
  proofUrl?: string;
  notes?: string;
  trueUpAmount?: number;
  userId?: string | null;
  userName?: string | null;
}

export async function transitionObligation(
  id: string,
  action: ObligationAction,
  payload: TransitionPayload = {},
  tx?: DbExecutor,
): Promise<{
  obligation: typeof obligations.$inferSelect;
  event: typeof obligationEvents.$inferSelect;
  journalEntryId: string | null;
}> {
  const exec: DbExecutor = tx ?? db;
  const [current] = await exec.select().from(obligations).where(eq(obligations.id, id)).limit(1);
  if (!current) throw new Error(`Obligation ${id} not found`);

  const status = current.status as ObligationStatus;
  if (!VALID_TRANSITIONS[status]?.includes(action)) {
    throw new Error(`Invalid transition: cannot ${action} an obligation in status '${status}'`);
  }

  const userId = payload.userId || 'system';
  const userName = payload.userName || 'System';
  const now = new Date();
  const totalAmount = num(current.amount);
  let nextStatus: ObligationStatus = status;
  const updates: Record<string, unknown> = { updatedAt: now };
  let eventType = action;
  let description = '';
  let journalEntryId: string | null = null;
  let writeJE = false;
  let jeAmount = 0;
  let jeKind: 'claim' | 'approve' | 'pay' | 'pay_after_approve' | 'expire' | 'reverse' | 'true_up' = 'claim';

  switch (action) {
    case 'submit_claim': {
      const claimAmount = num(payload.amount ?? current.outstandingAmount);
      if (claimAmount <= 0) throw new Error('Claim amount must be > 0');
      if (claimAmount > num(current.outstandingAmount) + 0.005) {
        throw new Error(`Claim ${claimAmount} exceeds outstanding ${current.outstandingAmount}`);
      }
      nextStatus = 'claimed';
      updates.status = nextStatus;
      updates.claimedAmount = claimAmount.toFixed(2);
      updates.claimedAt = now;
      updates.claimReference = payload.claimReference || null;
      updates.proofUrl = payload.proofUrl || null;
      eventType = 'claim_submitted';
      description = `Claim submitted for $${claimAmount.toFixed(2)}` +
        (payload.claimReference ? ` (ref: ${payload.claimReference})` : '');
      // Memo JE for audit traceability — no GL impact (debit and credit
      // both hit the memo "9999" account so totals net to zero), but the
      // JE row gives finance a permanent record that the claim was
      // submitted with the claim reference and proof URL.
      writeJE = true;
      jeAmount = claimAmount;
      jeKind = 'claim';
      break;
    }
    case 'approve_claim': {
      nextStatus = 'approved';
      updates.status = nextStatus;
      updates.approvedBy = userId;
      updates.approvedAt = now;
      updates.actualReleaseDate = now;
      eventType = 'claim_approved';
      description = `Claim approved for $${num(current.claimedAmount).toFixed(2)}`;
      writeJE = true;
      jeAmount = num(current.claimedAmount);
      jeKind = 'approve';
      break;
    }
    case 'mark_paid': {
      const paidAmount = num(payload.amount ?? current.claimedAmount);
      if (paidAmount <= 0) {
        throw new Error('Payment amount must be positive');
      }
      const outstanding = num(current.outstandingAmount);
      if (paidAmount - outstanding > 0.005) {
        throw new Error(`Payment amount $${paidAmount.toFixed(2)} exceeds outstanding $${outstanding.toFixed(2)}`);
      }
      const remaining = outstanding - paidAmount;
      nextStatus = remaining <= 0.005 ? 'paid' : 'approved';
      updates.status = nextStatus;
      updates.outstandingAmount = Math.max(0, remaining).toFixed(2);
      updates.paidAt = nextStatus === 'paid' ? now : current.paidAt;
      eventType = nextStatus === 'paid' ? 'paid' : 'partial_payment';
      description = `Paid $${paidAmount.toFixed(2)}; remaining $${Math.max(0, remaining).toFixed(2)}`;
      writeJE = true;
      jeAmount = paidAmount;
      // If the obligation was approved (reclassified to Claims Payable
      // 2250), the payment must clear 2250 — NOT the original accrual
      // liability (which was already debited at approval time). If the
      // obligation was paid directly without an approval reclass, debit
      // the original accrual liability.
      jeKind = status === 'approved' ? 'pay_after_approve' : 'pay';
      break;
    }
    case 'expire': {
      nextStatus = 'expired';
      const expiredAmount = num(current.outstandingAmount);
      updates.status = nextStatus;
      updates.expiredAt = now;
      eventType = 'expired';
      description = `Forfeited $${expiredAmount.toFixed(2)} per rolloverPolicy=${current.rolloverPolicy}`;
      writeJE = true;
      jeAmount = expiredAmount;
      jeKind = 'expire';
      break;
    }
    case 'reverse': {
      nextStatus = 'reversed';
      updates.status = nextStatus;
      eventType = 'reversed';
      description = `Accrual reversed (was $${totalAmount.toFixed(2)})`;
      writeJE = true;
      jeAmount = totalAmount;
      jeKind = 'reverse';
      break;
    }
    case 'true_up': {
      const delta = num(payload.trueUpAmount);
      eventType = 'trued_up';
      description = `True-up of $${delta.toFixed(2)} applied`;
      // True-ups create a NEW related obligation row (positive or negative
      // delta). The current row stays paid.
      const [trueup] = await exec.insert(obligations).values({
        contractId: current.contractId,
        ruleId: current.ruleId,
        partnerId: current.partnerId,
        partnerName: current.partnerName,
        kind: current.kind,
        amount: delta.toFixed(2),
        outstandingAmount: delta.toFixed(2),
        currency: current.currency,
        fundingPeriod: current.fundingPeriod,
        accrualDate: now,
        status: 'accrued',
        relatedObligationId: current.id,
        companyId: current.companyId,
        createdBy: userId,
        metadata: { trueUpOf: current.id, originalAmount: totalAmount },
      }).returning();
      writeJE = true;
      jeAmount = Math.abs(delta);
      jeKind = 'true_up';
      const trueupEvent = await exec.insert(obligationEvents).values({
        obligationId: id,
        eventType,
        fromStatus: status,
        toStatus: status,
        amount: delta.toFixed(2),
        description,
        userId,
        userName,
        phase: 'obligation_release',
        metadata: { trueUpObligationId: trueup.id },
      }).returning();
      journalEntryId = await writeTransitionJournalEntry({
        exec,
        obligationId: trueup.id,
        contractId: current.contractId,
        companyId: current.companyId,
        amount: delta,
        kind: current.kind as ObligationKind,
        partnerName: current.partnerName,
        action: jeKind,
        period: current.fundingPeriod || '',
        userId,
      });
      return {
        obligation: { ...current, ...updates },
        event: trueupEvent[0],
        journalEntryId,
      };
    }
  }

  // Emit a calculation_rule_results row tagged by phase so the audit
  // pipeline reflects this transition. The CRR table requires a non-null
  // calculationId, so we tie the row to the most-recent calculation for
  // this contract. If none exists yet (e.g. transition before first
  // period close), we skip CRR emission — the obligation_events row is
  // still authoritative.
  let phaseForCRR: CalcPhase | null = null;
  if (action === 'expire') phaseForCRR = 'obligation_expiry';
  else if (action !== 'true_up') phaseForCRR = 'obligation_release';

  // Standard path (non-true-up): write event, optional JE, update row.
  if (writeJE) {
    journalEntryId = await writeTransitionJournalEntry({
      exec,
      obligationId: id,
      contractId: current.contractId,
      companyId: current.companyId,
      amount: jeAmount,
      kind: current.kind as ObligationKind,
      partnerName: current.partnerName,
      action: jeKind,
      period: current.fundingPeriod || '',
      userId,
    });
    updates.linkedJournalEntryId = journalEntryId;
  }

  await exec.update(obligations).set(updates).where(eq(obligations.id, id));

  const [event] = await exec.insert(obligationEvents).values({
    obligationId: id,
    eventType,
    fromStatus: status,
    toStatus: nextStatus,
    amount: jeAmount.toFixed(2),
    description,
    userId,
    userName,
    phase: action === 'expire' ? 'obligation_expiry' : 'obligation_release',
    linkedJournalEntryId: journalEntryId,
    metadata: { action },
  }).returning();

  if (phaseForCRR) {
    const calcId = await ensureCalculationContext(exec, current.contractId, current.fundingPeriod);
    await exec.insert(calculationRuleResults).values({
      calculationId: calcId,
      ruleId: current.ruleId,
      ruleName: `obligation:${current.kind}:${action}`,
      ruleType: `obligation_${current.kind}`,
      ruleSnapshot: { obligationId: id, action, kind: current.kind, fromStatus: status, toStatus: nextStatus },
      qualificationSummary: { description, period: current.fundingPeriod },
      adjustmentsApplied: { obligationId: id, journalEntryId },
      totalFee: jeAmount.toFixed(2),
      totalSalesAmount: '0',
      transactionCount: 0,
      phase: phaseForCRR,
      relatedResultId: null,
    });
  }

  const [refreshed] = await exec.select().from(obligations).where(eq(obligations.id, id)).limit(1);
  return { obligation: refreshed, event, journalEntryId };
}

// ---------------------------------------------------------------------------
// Recoupment netting — called by slice-2 advance_recoupment evaluator
// ---------------------------------------------------------------------------

export interface RecoupmentResult {
  consumed: number;
  obligationIds: string[];
  exhaustedObligationIds: string[];
}

/**
 * Net a slice-2 `advance_recoupment` deduction against the contract's
 * outstanding `recoupable_advance` obligations (FIFO by accrualDate).
 * Returns the total consumed and the obligations touched. Marks any
 * obligation with zero outstanding balance as `paid`.
 */
export async function applyAdvanceRecoupment(opts: {
  contractId: string;
  amount: number; // positive — the amount of recoupment to apply
  period: string;
  userId?: string | null;
  userName?: string | null;
}, tx?: DbExecutor): Promise<RecoupmentResult> {
  const exec: DbExecutor = tx ?? db;
  const remaining = { value: opts.amount };
  const out: RecoupmentResult = { consumed: 0, obligationIds: [], exhaustedObligationIds: [] };
  if (remaining.value <= 0) return out;

  const open = await exec.select()
    .from(obligations)
    .where(and(
      eq(obligations.contractId, opts.contractId),
      eq(obligations.kind, 'recoupable_advance'),
      inArray(obligations.status, ['accrued', 'claimable', 'approved']),
    ))
    .orderBy(asc(obligations.accrualDate));

  for (const ob of open) {
    if (remaining.value <= 0) break;
    const outstanding = num(ob.outstandingAmount);
    if (outstanding <= 0) continue;
    const take = Math.min(outstanding, remaining.value);
    const newOutstanding = +(outstanding - take).toFixed(2);
    const fullyConsumed = newOutstanding <= 0.005;
    await exec.update(obligations).set({
      outstandingAmount: Math.max(0, newOutstanding).toFixed(2),
      status: fullyConsumed ? 'paid' : ob.status,
      paidAt: fullyConsumed ? new Date() : ob.paidAt,
      updatedAt: new Date(),
    }).where(eq(obligations.id, ob.id));
    await exec.insert(obligationEvents).values({
      obligationId: ob.id,
      eventType: 'recouped',
      fromStatus: ob.status,
      toStatus: fullyConsumed ? 'paid' : ob.status,
      amount: take.toFixed(2),
      description: `Recouped $${take.toFixed(2)} via period payable (${opts.period}); remaining $${Math.max(0, newOutstanding).toFixed(2)}`,
      userId: opts.userId || 'system',
      userName: opts.userName || 'System',
      phase: 'net_adjustment',
      metadata: { recoupedAmount: take, period: opts.period },
    });
    out.consumed += take;
    out.obligationIds.push(ob.id);
    if (fullyConsumed) out.exhaustedObligationIds.push(ob.id);
    remaining.value -= take;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Expiry sweep
// ---------------------------------------------------------------------------

/**
 * Date-driven sweep: forfeits any obligation whose `expiryDate` has passed
 * AND whose `rolloverPolicy === 'forfeit'` AND status is still in
 * { accrued, claimable }. Emits an `obligation_expiry` calculation_rule_results
 * row per expired obligation and a draft reversal JE.
 */
export async function runObligationExpirySweep(opts: {
  asOf?: Date;
  companyId?: string | null;
  userId?: string | null;
  userName?: string | null;
} = {}, tx?: DbExecutor): Promise<{ expiredCount: number; expiredAmount: number; obligationIds: string[] }> {
  const exec: DbExecutor = tx ?? db;
  const asOf = opts.asOf || new Date();
  const where = and(
    isNotNull(obligations.expiryDate),
    lt(obligations.expiryDate, asOf),
    inArray(obligations.status, ['accrued', 'claimable']),
    eq(obligations.rolloverPolicy, 'forfeit'),
    opts.companyId ? eq(obligations.companyId, opts.companyId) : undefined,
  );

  const stale = await exec.select().from(obligations).where(where);
  let totalAmount = 0;
  const ids: string[] = [];
  for (const ob of stale) {
    try {
      // CRR emission lives inside transitionObligation for action='expire',
      // so we do NOT emit a second one here. Pass tx so the transition
      // joins the caller's transaction (period close, etc.).
      await transitionObligation(ob.id, 'expire', {
        userId: opts.userId || 'system',
        userName: opts.userName || 'Expiry Sweep',
      }, tx);
      totalAmount += num(ob.outstandingAmount);
      ids.push(ob.id);
    } catch (e) {
      console.error(`[obligation-expiry] failed to expire ${ob.id}:`, e);
    }
  }
  return { expiredCount: ids.length, expiredAmount: totalAmount, obligationIds: ids };
}

/**
 * Date-driven sweep: auto-promotes obligations whose `plannedReleaseDate`
 * has passed AND status is still `accrued` to `claimable`. This is the
 * scheduled-release trigger of the obligation lifecycle (the partner can
 * now submit a claim against the funds). Each promotion writes an
 * `obligation_release` event and a calculation_rule_results row tagged
 * `obligation_release` linked to the most recent contract calculation.
 *
 * No GL movement is made on this transition — funds were already accrued
 * to liability at accrual time; they simply become eligible for claim.
 */
export async function runObligationReleaseSweep(opts: {
  asOf?: Date;
  companyId?: string | null;
  userId?: string | null;
  userName?: string | null;
} = {}, tx?: DbExecutor): Promise<{ releasedCount: number; releasedAmount: number; obligationIds: string[] }> {
  const exec: DbExecutor = tx ?? db;
  const asOf = opts.asOf || new Date();
  const where = and(
    isNotNull(obligations.plannedReleaseDate),
    lte(obligations.plannedReleaseDate, asOf),
    eq(obligations.status, 'accrued'),
    opts.companyId ? eq(obligations.companyId, opts.companyId) : undefined,
  );

  const due = await exec.select().from(obligations).where(where);
  const ids: string[] = [];
  let totalAmount = 0;
  for (const ob of due) {
    try {
      await exec.update(obligations)
        .set({ status: 'claimable', actualReleaseDate: asOf, updatedAt: new Date() })
        .where(eq(obligations.id, ob.id));
      await exec.insert(obligationEvents).values({
        obligationId: ob.id,
        eventType: 'released',
        fromStatus: 'accrued',
        toStatus: 'claimable',
        amount: num(ob.outstandingAmount).toFixed(2),
        description: `Scheduled release reached (planned ${ob.plannedReleaseDate?.toISOString().slice(0, 10)})`,
        userId: opts.userId || 'system',
        userName: opts.userName || 'Release Sweep',
        phase: 'obligation_release',
        metadata: { trigger: 'scheduled_release' },
      });

      const releaseCalcId = await ensureCalculationContext(exec, ob.contractId, ob.fundingPeriod);
      await exec.insert(calculationRuleResults).values({
        calculationId: releaseCalcId,
        ruleId: ob.ruleId,
        ruleName: `obligation:${ob.kind}:scheduled_release`,
        ruleType: `obligation_${ob.kind}`,
        ruleSnapshot: { obligationId: ob.id, trigger: 'scheduled_release', plannedReleaseDate: ob.plannedReleaseDate },
        qualificationSummary: { period: ob.fundingPeriod, asOf: asOf.toISOString() },
        adjustmentsApplied: { obligationId: ob.id, fromStatus: 'accrued', toStatus: 'claimable' },
        totalFee: num(ob.outstandingAmount).toFixed(2),
        totalSalesAmount: '0',
        transactionCount: 0,
        phase: 'obligation_release',
        relatedResultId: null,
      });

      // Draft JE for the release transition (per task spec — release/expiry
      // both emit CRR + draft JE). Reclassifies the accrued liability into
      // a claimable position; we model this as a memo JE so the audit
      // trail is symmetric with expiry.
      const releaseJeId = await writeTransitionJournalEntry({
        exec,
        obligationId: ob.id,
        contractId: ob.contractId,
        companyId: ob.companyId,
        amount: num(ob.outstandingAmount),
        kind: ob.kind as ObligationKind,
        partnerName: ob.partnerName,
        action: 'claim',
        period: ob.fundingPeriod || '',
        userId: opts.userId || 'system',
      });
      if (releaseJeId) {
        await exec.update(obligations)
          .set({ linkedJournalEntryId: releaseJeId })
          .where(eq(obligations.id, ob.id));
      }

      totalAmount += num(ob.outstandingAmount);
      ids.push(ob.id);
    } catch (e) {
      console.error(`[obligation-release] failed to release ${ob.id}:`, e);
    }
  }
  return { releasedCount: ids.length, releasedAmount: totalAmount, obligationIds: ids };
}

// ---------------------------------------------------------------------------
// Journal entry helpers
// ---------------------------------------------------------------------------

const ACCRUAL_ACCOUNTS: Record<ObligationKind, { dr: { code: string; name: string }; cr: { code: string; name: string } }> = {
  mdf:                 { dr: { code: '6300', name: 'MDF Expense' },             cr: { code: '2210', name: 'Accrued MDF Liability' } },
  recoupable_advance:  { dr: { code: '1450', name: 'Recoupable Advances Receivable' }, cr: { code: '1010', name: 'Cash' } },
  returns_reserve:     { dr: { code: '4200', name: 'Returns & Allowances' },    cr: { code: '2220', name: 'Returns Reserve Liability' } },
  performance_bonus:   { dr: { code: '6310', name: 'Performance Bonus Expense' }, cr: { code: '2230', name: 'Accrued Bonus Liability' } },
  signing_bonus:       { dr: { code: '6311', name: 'Signing Bonus Expense' },   cr: { code: '2230', name: 'Accrued Bonus Liability' } },
  milestone_payment:   { dr: { code: '6320', name: 'Milestone Payment Expense' }, cr: { code: '2240', name: 'Accrued Milestone Payable' } },
  minimum_trueup:      { dr: { code: '6100', name: 'Contract Fee Expense' },     cr: { code: '2200', name: 'Accrued Contract Fees Payable' } },
  // Task 68 — accrual-promoted obligations carry kind=rebate or kind=royalty.
  // Use the existing contract-fee accounts as the journal default; specific
  // rebate / royalty GL coding is the responsibility of the contract's flow
  // type mapping in financeHubRoutes.ts, not this generic accrual journal.
  rebate:              { dr: { code: '6100', name: 'Contract Fee Expense' },     cr: { code: '2200', name: 'Accrued Contract Fees Payable' } },
  royalty:             { dr: { code: '6100', name: 'Contract Fee Expense' },     cr: { code: '2200', name: 'Accrued Contract Fees Payable' } },
};

// Returns the id of the latest contract_calculations row for this contract,
// or creates a synthetic placeholder so phase-tagged CRR rows can always be
// emitted (the CRR table requires a non-null calculationId).
async function ensureCalculationContext(
  exec: DbExecutor,
  contractId: string,
  fundingPeriod: string | null,
): Promise<string> {
  const [latest] = await exec.select({ id: contractCalculations.id })
    .from(contractCalculations)
    .where(eq(contractCalculations.contractId, contractId))
    .orderBy(desc(contractCalculations.createdAt))
    .limit(1);
  if (latest) return latest.id;
  const [created] = await exec.insert(contractCalculations).values({
    contractId,
    name: `Obligation lifecycle ${fundingPeriod || 'context'}`,
    status: 'pending_approval',
  }).returning({ id: contractCalculations.id });
  return created.id;
}

async function writeAccrualJournalEntry(opts: {
  obligationId: string;
  contractId: string;
  companyId: string | null;
  amount: number;
  kind: ObligationKind;
  period: string;
  partnerName?: string | null;
  userId: string;
}, exec: DbExecutor = db): Promise<string | null> {
  if (opts.amount === 0) return null;
  const accts = ACCRUAL_ACCOUNTS[opts.kind];
  const jeIdStr = `OBL-ACC-${Date.now().toString(36).toUpperCase()}-${opts.obligationId.slice(0, 6)}`;
  try {
    const [je] = await exec.insert(jeTbl).values({
      jeId: jeIdStr,
      sourceAccrualId: opts.obligationId,
      contractId: opts.contractId,
      counterparty: opts.partnerName || 'Unknown',
      flowType: `obligation_${opts.kind}`,
      period: opts.period,
      totalAmount: opts.amount.toFixed(2),
      jeStage: 'draft',
      erpSyncStatus: 'na',
      balanced: true,
      companyId: opts.companyId,
      createdBy: opts.userId,
    }).returning();
    await exec.insert(jeLinesTbl).values([
      { jeId: jeIdStr, accountCode: accts.dr.code, accountName: accts.dr.name, debitAmount: opts.amount.toFixed(2), creditAmount: '0', description: `Accrue ${opts.kind} for ${opts.partnerName || 'partner'}` },
      { jeId: jeIdStr, accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: '0', creditAmount: opts.amount.toFixed(2), description: `Accrued ${opts.kind} liability` },
    ]);
    await exec.update(obligations).set({ linkedJournalEntryId: je.id }).where(eq(obligations.id, opts.obligationId));
    return je.id;
  } catch (e) {
    console.error('[obligations] writeAccrualJournalEntry failed:', e);
    return null;
  }
}

export { writeTransitionJournalEntry as writeObligationTransitionJournalEntry };
async function writeTransitionJournalEntry(opts: {
  exec?: DbExecutor;
  obligationId: string;
  contractId: string;
  companyId: string | null;
  amount: number;
  kind: ObligationKind;
  partnerName?: string | null;
  action: 'claim' | 'approve' | 'pay' | 'pay_after_approve' | 'expire' | 'reverse' | 'true_up';
  period: string;
  userId: string;
}): Promise<string | null> {
  const exec: DbExecutor = opts.exec ?? db;
  if (opts.amount === 0 && opts.action !== 'reverse') return null;
  const accts = ACCRUAL_ACCOUNTS[opts.kind];
  const jeIdStr = `OBL-${opts.action.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${opts.obligationId.slice(0, 6)}`;
  // For pay: debit accrued liability, credit cash. For expire/reverse:
  // debit liability, credit expense (reverses original accrual). For
  // approve: no GL entry needed (still in accrued liability). For
  // true_up: debit/credit expense vs liability based on sign.
  let lines: Array<{ accountCode: string; accountName: string; debitAmount: string; creditAmount: string; description: string }> = [];
  const amt = Math.abs(opts.amount).toFixed(2);
  const cash = { code: '1010', name: 'Cash' };
  switch (opts.action) {
    case 'pay':
      // Direct payment without prior approval reclass — debit the
      // original accrual liability, credit cash.
      lines = [
        { accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: amt, creditAmount: '0', description: `Pay down ${opts.kind} liability` },
        { accountCode: cash.code, accountName: cash.name, debitAmount: '0', creditAmount: amt, description: `Cash paid to ${opts.partnerName || 'partner'}` },
      ];
      break;
    case 'pay_after_approve':
      // Approval already reclassed accrued liability into 2250 Claims
      // Payable; this payment must clear 2250 (NOT the original
      // accrued account, which is already cleared) against cash.
      lines = [
        { accountCode: '2250', accountName: 'Obligations Claims Payable', debitAmount: amt, creditAmount: '0', description: `Clear approved claim — pay down Claims Payable` },
        { accountCode: cash.code, accountName: cash.name, debitAmount: '0', creditAmount: amt, description: `Cash paid to ${opts.partnerName || 'partner'}` },
      ];
      break;
    case 'expire':
    case 'reverse':
      lines = [
        { accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: amt, creditAmount: '0', description: `Reverse ${opts.kind} accrual (${opts.action})` },
        { accountCode: accts.dr.code, accountName: accts.dr.name, debitAmount: '0', creditAmount: amt, description: `Reduce ${opts.kind} expense` },
      ];
      break;
    case 'true_up': {
      const isPositive = opts.amount >= 0;
      lines = isPositive ? [
        { accountCode: accts.dr.code, accountName: accts.dr.name, debitAmount: amt, creditAmount: '0', description: `True-up ${opts.kind} (increase)` },
        { accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: '0', creditAmount: amt, description: `True-up liability (increase)` },
      ] : [
        { accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: amt, creditAmount: '0', description: `True-up ${opts.kind} (decrease)` },
        { accountCode: accts.dr.code, accountName: accts.dr.name, debitAmount: '0', creditAmount: amt, description: `True-up expense (decrease)` },
      ];
      break;
    }
    case 'approve':
      // Reclass entry: move the approved-but-unpaid amount from the
      // generic accrual liability into a "Claims Payable" sub-liability
      // so AP can see what's queued for payment. Net liability
      // unchanged (debit accrued / credit claims payable).
      lines = [
        { accountCode: accts.cr.code, accountName: accts.cr.name, debitAmount: amt, creditAmount: '0', description: `Approve ${opts.kind} claim — reclass to Claims Payable` },
        { accountCode: '2250', accountName: 'Obligations Claims Payable', debitAmount: '0', creditAmount: amt, description: `Claim approved, queued for payment to ${opts.partnerName || 'partner'}` },
      ];
      break;
    case 'claim':
      // Memo-only entry. Both lines hit the 9999 memo account so the
      // GL impact nets to zero, but a draft JE row exists for full
      // audit traceability of the claim submission.
      lines = [
        { accountCode: '9999', accountName: 'Obligations Workflow Memo', debitAmount: amt, creditAmount: '0', description: `Memo: claim submitted for ${opts.kind}` },
        { accountCode: '9999', accountName: 'Obligations Workflow Memo', debitAmount: '0', creditAmount: amt, description: `Memo offset` },
      ];
      break;
  }

  try {
    const [je] = await exec.insert(jeTbl).values({
      jeId: jeIdStr,
      sourceAccrualId: opts.obligationId,
      contractId: opts.contractId,
      counterparty: opts.partnerName || 'Unknown',
      flowType: `obligation_${opts.action}`,
      period: opts.period,
      totalAmount: amt,
      jeStage: 'draft',
      erpSyncStatus: 'na',
      balanced: true,
      companyId: opts.companyId,
      createdBy: opts.userId,
    }).returning();
    await exec.insert(jeLinesTbl).values(lines.map(l => ({ ...l, jeId: jeIdStr })));
    return je.id;
  } catch (e) {
    console.error('[obligations] writeTransitionJournalEntry failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Aging report helpers — used by /api/obligations and the dashboard tile.
// ---------------------------------------------------------------------------

export type AgingBucket = 'current' | '0_30' | '31_60' | '61_90' | '90_plus';

export function bucketForReleaseDate(plannedReleaseDate: Date | null, asOf: Date = new Date()): AgingBucket {
  if (!plannedReleaseDate) return 'current';
  const diffDays = Math.floor((asOf.getTime() - plannedReleaseDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'current';
  if (diffDays <= 30) return '0_30';
  if (diffDays <= 60) return '31_60';
  if (diffDays <= 90) return '61_90';
  return '90_plus';
}

export interface AgingSummary {
  totals: Record<AgingBucket, number>;
  countsByStatus: Record<string, number>;
  totalsByKind: Record<string, number>;
  totalsByPartner: Array<{ partnerName: string; total: number; count: number }>;
  totalOutstanding: number;
}

export async function getObligationAgingSummary(opts: {
  companyId?: string | null;
  asOf?: Date;
} = {}, tx?: DbExecutor): Promise<AgingSummary> {
  const exec: DbExecutor = tx ?? db;
  const where = and(
    inArray(obligations.status, ['accrued', 'claimable', 'claimed', 'approved']),
    opts.companyId ? eq(obligations.companyId, opts.companyId) : undefined,
  );
  const rows = await exec.select().from(obligations).where(where);
  const asOf = opts.asOf || new Date();
  const totals: Record<AgingBucket, number> = { current: 0, '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };
  const countsByStatus: Record<string, number> = {};
  const totalsByKind: Record<string, number> = {};
  const partnerMap = new Map<string, { total: number; count: number }>();
  let totalOutstanding = 0;
  for (const r of rows) {
    const amt = num(r.outstandingAmount);
    totalOutstanding += amt;
    const bucket = bucketForReleaseDate(r.plannedReleaseDate, asOf);
    totals[bucket] += amt;
    countsByStatus[r.status] = (countsByStatus[r.status] || 0) + 1;
    totalsByKind[r.kind] = (totalsByKind[r.kind] || 0) + amt;
    const pn = r.partnerName || 'Unknown';
    const cur = partnerMap.get(pn) || { total: 0, count: 0 };
    cur.total += amt;
    cur.count += 1;
    partnerMap.set(pn, cur);
  }
  const totalsByPartner = Array.from(partnerMap.entries())
    .map(([partnerName, v]) => ({ partnerName, ...v }))
    .sort((a, b) => b.total - a.total);
  return { totals, countsByStatus, totalsByKind, totalsByPartner, totalOutstanding };
}
