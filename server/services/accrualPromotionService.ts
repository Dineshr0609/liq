/**
 * Accrual → Obligation Promotion Service (Task #68)
 *
 * Single idempotent entry point for the Posted-Accrual → Obligation bridge.
 * Given an `accrual_id` (the human-readable string like "ACC-MOHRYC8H", not
 * the row UUID), this service:
 *
 *   1. Loads the accrual + its parent contract + the contract's flow type.
 *   2. Derives the obligation direction from `flow_types.cash_direction`:
 *        - 'outbound' → CRP / RLA / SUB / RSM (we owe partner)
 *        - 'inbound'  → VRP                   (partner owes us)
 *        - 'derived'  → OEM (refuses to guess; throws OemDirectionRequiredError)
 *   3. Picks an obligation `kind` from the accrual's flow type / rule type.
 *   4. Picks the initial obligation status from the contract's
 *      Obligation Accrual Basis (resolved via the existing
 *      getObligationAccrualBasis cascade — contract pin → system default):
 *        - 'qualifying_sale'   → 'claimable' (immediately ready to settle)
 *        - 'scheduled_release' → 'accrued'   (deferred until plannedReleaseDate)
 *   5. Upserts an `obligations` row keyed on `sourceAccrualId`. A re-post
 *      finds the existing row and refreshes mutable fields rather than
 *      inserting a duplicate. Per the task notes, the idempotency lives in
 *      code (find-then-insert) rather than a unique DB constraint, because
 *      a future workflow may legitimately want a second obligation against
 *      the same accrual (e.g. a reversal). The contract is "first
 *      promotion is idempotent", not "one obligation forever".
 *   6. Writes an `obligation_events` row tagged `accrued` (or `promoted`
 *      on re-post) so the audit trail captures the promotion.
 *
 * The service is safe to call from inside an existing transaction (pass
 * the `tx` executor) and stand-alone (omit `tx`).
 */

import { db } from '../db';
import { and, eq, isNull } from 'drizzle-orm';
import {
  accruals as accrualsTbl,
  accrualAuditTrail as accrualAuditTrailTbl,
  contracts as contractsTbl,
  flowTypes as flowTypesTbl,
  obligations as obligationsTbl,
  obligationEvents as obligationEventsTbl,
  journalEntries as journalEntriesTbl,
} from '@shared/schema';
import { OBLIGATION_KINDS, type ObligationKind } from '@shared/calcPhases';
import { getObligationAccrualBasis } from './periodCloseEvaluators';

// The promotion service must run in two contexts:
//   - stand-alone (callers pass nothing → uses module-level `db`)
//   - inside an existing transaction (PATCH route passes the tx executor)
// Drizzle's transaction callback receives a `PgTransaction` whose type is
// not a structural subtype of the top-level `db` (NeonDatabase) — they
// share CRUD methods but not the `transaction` method. To let
// `promoteAccrualToObligation` accept either the top-level db OR a tx,
// narrow `DbExecutor` to just the CRUD surface both share.
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>;

/** Thrown when an OEM (cashDirection='derived') contract tries to promote
 *  an accrual without an explicit direction pinned on the contract.
 *  Surfaces as a clean operator error rather than a guessed default. */
export class OemDirectionRequiredError extends Error {
  constructor(contractId: string, flowTypeCode: string) {
    super(
      `Contract ${contractId} (${flowTypeCode}) has cashDirection='derived' — ` +
      `set the direction explicitly on the contract before posting accruals.`,
    );
    this.name = 'OemDirectionRequiredError';
  }
}

export interface PromoteOptions {
  /** Caller identity for the obligation_events row. */
  userId?: string | null;
  userName?: string | null;
  /** Phase tag for the obligation_events row. Defaults to 'manual_post'
   *  when called from PATCH /api/accruals/:id and 'auto_accrual' when
   *  called from the period-close batch path. */
  phase?: string;
}

export interface PromoteResult {
  /** 'created' on first promotion, 'updated' on idempotent re-post,
   *  'skipped' when the accrual already has a non-'accrued' obligation
   *  whose lifecycle has advanced (we never overwrite past-accrued). */
  outcome: 'created' | 'updated' | 'skipped';
  obligationId: string;
  direction: 'outbound' | 'inbound';
  kind: ObligationKind;
  initialStatus: 'accrued' | 'claimable';
}

// ---------------------------------------------------------------------------
// Kind picker — maps flow type / accrual flow text to a canonical
// obligation kind. We keep this here (rather than in calcPhases.ts) because
// the mapping is bridge-specific: gross_calc rules use a different mapping
// (RULE_TYPE_TO_OBLIGATION_KIND) tied to rule types, whereas the bridge
// keys off the contract's flow type / accrual.flowType label.
// ---------------------------------------------------------------------------
function pickKindFromFlow(flowTypeCode: string | null, accrualFlowLabel: string | null): ObligationKind {
  const code = (flowTypeCode || '').toUpperCase();
  if (code === 'VRP' || code === 'CRP') return 'rebate';
  if (code === 'RLA') return 'royalty';
  // SUB / RSM / OEM and anything else fall back to 'rebate' if the accrual
  // looks rebate-shaped, else 'royalty'. The label cascade keeps existing
  // posted accruals (which carry a free-text flowType like "Rebate" /
  // "Royalty") promoting correctly even if the contract's flow code is
  // missing — this matches the actual data shape of ACC-MOHRYC8H.
  const label = (accrualFlowLabel || '').toLowerCase();
  if (label.includes('royalty')) return 'royalty';
  return 'rebate';
}

/**
 * Promote a single posted accrual to an obligation. Idempotent on
 * `sourceAccrualId`. Throws `OemDirectionRequiredError` for OEM contracts
 * that have not pinned a direction.
 */
export async function promoteAccrualToObligation(
  accrualIdStr: string,
  opts: PromoteOptions = {},
  tx?: DbExecutor,
): Promise<PromoteResult> {
  const exec: DbExecutor = tx ?? db;

  const [accrual] = await exec.select().from(accrualsTbl)
    .where(eq(accrualsTbl.accrualId, accrualIdStr)).limit(1);
  if (!accrual) {
    throw new Error(`Accrual ${accrualIdStr} not found`);
  }
  if (!accrual.contractId) {
    throw new Error(`Accrual ${accrualIdStr} has no contractId — cannot promote`);
  }

  const [contract] = await exec.select().from(contractsTbl)
    .where(eq(contractsTbl.id, accrual.contractId)).limit(1);
  if (!contract) {
    throw new Error(`Contract ${accrual.contractId} for accrual ${accrualIdStr} not found`);
  }

  const flowCode = contract.flowTypeCode || null;
  let cashDirection: 'outbound' | 'inbound' | 'derived' = 'derived';
  if (flowCode) {
    const [ft] = await exec.select({ d: flowTypesTbl.cashDirection })
      .from(flowTypesTbl).where(eq(flowTypesTbl.code, flowCode)).limit(1);
    if (ft?.d === 'outbound' || ft?.d === 'inbound' || ft?.d === 'derived') {
      cashDirection = ft.d as 'outbound' | 'inbound' | 'derived';
    }
  }

  if (cashDirection === 'derived') {
    // OEM-style contracts must pin direction explicitly. Refuse to guess.
    throw new OemDirectionRequiredError(contract.id, flowCode || 'UNKNOWN');
  }

  const kind = pickKindFromFlow(flowCode, accrual.flowType);
  if (!OBLIGATION_KINDS.includes(kind)) {
    // Defensive — pickKindFromFlow only ever returns rebate/royalty, both
    // added to OBLIGATION_KINDS in this task. Belt-and-suspenders so a
    // future kind-list edit can't silently break the bridge.
    throw new Error(`pickKindFromFlow returned unsupported kind '${kind}' for ${accrualIdStr}`);
  }

  // Reuse the existing accrual-basis cascade (contract pin → system default).
  // Don't replicate the cascade here — keep one source of truth.
  const basis = await getObligationAccrualBasis(contract.id);
  const initialStatus: 'accrued' | 'claimable' =
    basis === 'qualifying_sale' ? 'claimable' : 'accrued';

  const amountStr = accrual.amount ?? '0';
  const partnerName = accrual.counterparty || contract.counterpartyName || null;
  const partnerId = contract.counterpartyPartnerId || null;
  const fundingPeriod = accrual.period || null;
  // contracts.currency is not yet declared on the drizzle table but the
  // column exists in production. Read defensively via a narrow lookup
  // type rather than a blanket `as any` on the whole row.
  const currency = ((contract as { currency?: string | null }).currency) || 'USD';
  const userId = opts.userId || 'system';
  const userName = opts.userName || 'System · Promotion';
  const phase = opts.phase || 'auto_promotion';

  // Pull the originating calculation run + rule metadata so the obligation
  // Origin section can show "promoted from calculation X via rule Y" and
  // not just the source accrual. The auto-accrual path embeds the calc
  // id in the audit_trail "created" event description; that's the
  // canonical link today (accruals don't carry calculationId directly).
  let originCalculationId: string | null = null;
  try {
    const auditRows = await exec.select().from(accrualAuditTrailTbl)
      .where(and(
        eq(accrualAuditTrailTbl.accrualId, accrualIdStr),
        eq(accrualAuditTrailTbl.eventType, 'created'),
      )).limit(1);
    const desc = auditRows[0]?.description || '';
    const m = desc.match(/calculation\s+([0-9a-f-]{8,})/i);
    if (m) originCalculationId = m[1];
  } catch { /* best-effort lookup; non-fatal */ }
  const originRuleSummary = {
    tier: accrual.tier || null,
    rate: accrual.rate || null,
    flowLabel: accrual.flowType || null,
  };

  // Idempotency lookup — keyed on sourceAccrualId.
  const existing = await exec.select().from(obligationsTbl)
    .where(eq(obligationsTbl.sourceAccrualId, accrualIdStr)).limit(1);

  if (existing.length === 0) {
    // NOTE: drizzle-orm 0.39 + drizzle-zod 0.7 produces a truncated
    // inferred type on `.values()` / `.set()` for these tables (only the
    // `.notNull()` columns survive inference). The actual schema in
    // `shared/schema.ts` accepts all the fields below. We cast at the
    // call boundary only — the literals themselves are fully typed by
    // the surrounding code paths.
    const [row] = await exec.insert(obligationsTbl).values({
      contractId: contract.id,
      ruleId: null,
      partnerId,
      partnerName,
      kind,
      amount: amountStr,
      outstandingAmount: amountStr,
      currency,
      fundingPeriod,
      accrualDate: accrual.createdAt || new Date(),
      status: initialStatus,
      direction: cashDirection,
      sourceChannel: 'accrual_promotion',
      sourceAccrualId: accrualIdStr,
      companyId: contract.companyId || accrual.companyId || null,
      createdBy: userId,
      metadata: {
        promotedFromAccrualId: accrualIdStr,
        accrualBasis: basis,
        flowTypeCode: flowCode,
        accrualFlowLabel: accrual.flowType,
        promotedAt: new Date().toISOString(),
        phase,
        originCalculationId,
        originRule: originRuleSummary,
      },
    } as never).returning();

    await exec.insert(obligationEventsTbl).values({
      obligationId: row.id,
      eventType: 'accrued',
      fromStatus: null,
      toStatus: initialStatus,
      amount: amountStr,
      description:
        `Promoted from posted accrual ${accrualIdStr} (${flowCode || 'UNKNOWN'} · ${cashDirection}, basis=${basis}).`,
      userId,
      userName,
      phase,
      metadata: { sourceAccrualId: accrualIdStr, basis, cashDirection, kind, originCalculationId },
    } as never);

    return {
      outcome: 'created',
      obligationId: row.id,
      direction: cashDirection,
      kind,
      initialStatus,
    };
  }

  // Idempotent re-post path. We never silently mutate an obligation that
  // has already advanced past its initial accrued/claimable state — those
  // amounts are immutable from the bridge's POV (true-ups go through the
  // dedicated true-up flow, which writes a NEW obligation linked via
  // supersededByObligationId).
  const ob = existing[0];
  const stableStates = new Set(['accrued', 'claimable']);
  if (!stableStates.has(ob.status)) {
    return {
      outcome: 'skipped',
      obligationId: ob.id,
      direction: (ob.direction as 'outbound' | 'inbound') || cashDirection,
      kind: (ob.kind as ObligationKind) || kind,
      initialStatus,
    };
  }

  // Narrow the existing metadata blob (jsonb → unknown) to the small
  // shape we actually consult on re-promotion, so we don't have to
  // sprinkle `as any` reads through the merge.
  type ObligationMetadata = Record<string, unknown> & {
    originCalculationId?: string | null;
    originRule?: typeof originRuleSummary;
  };
  const prevMeta: ObligationMetadata = (ob.metadata as ObligationMetadata) || {};
  const amountChanged = (ob.amount || '0') !== amountStr;
  // See note above re: drizzle 0.39 truncated insert/update inference.
  await exec.update(obligationsTbl)
    .set({
      amount: amountStr,
      outstandingAmount: amountStr,
      kind,
      direction: cashDirection,
      partnerName: partnerName || ob.partnerName,
      partnerId: partnerId || ob.partnerId,
      fundingPeriod: fundingPeriod || ob.fundingPeriod,
      status: initialStatus,
      updatedAt: new Date(),
      metadata: {
        ...prevMeta,
        repromotedAt: new Date().toISOString(),
        repromotionPhase: phase,
        accrualBasis: basis,
        flowTypeCode: flowCode,
        originCalculationId: originCalculationId ?? (prevMeta.originCalculationId ?? null),
        originRule: prevMeta.originRule || originRuleSummary,
      },
    } as never)
    .where(eq(obligationsTbl.id, ob.id));

  await exec.insert(obligationEventsTbl).values({
    obligationId: ob.id,
    eventType: 'promoted',
    fromStatus: ob.status,
    toStatus: initialStatus,
    amount: amountStr,
    description: amountChanged
      ? `Re-promoted from accrual ${accrualIdStr} — amount refreshed (${ob.amount} → ${amountStr}).`
      : `Re-promoted from accrual ${accrualIdStr} — idempotent (no amount change).`,
    userId,
    userName,
    phase,
    metadata: { sourceAccrualId: accrualIdStr, basis, cashDirection, kind, amountChanged, originCalculationId },
  } as never);

  return {
    outcome: 'updated',
    obligationId: ob.id,
    direction: cashDirection,
    kind,
    initialStatus,
  };
}

/**
 * Walk every posted accrual that does NOT already have a promoted
 * obligation and call `promoteAccrualToObligation` for each. Safe to
 * re-run; rows that already promoted are skipped *up front* (LEFT JOIN
 * obligations on sourceAccrualId IS NULL) so the promotion service is
 * never re-invoked on already-bridged rows — no spurious obligation
 * events on a re-run, no risk of touching a downstream-advanced
 * obligation. OEM contracts surface their accruals in the `errors`
 * array rather than aborting the whole backfill.
 */
export async function backfillPostedAccrualObligations(
  opts: { companyId?: string | null; userId?: string; userName?: string } = {},
): Promise<{
  scanned: number;
  promoted: number;
  alreadyPromoted: number;
  errors: Array<{ accrualId: string; error: string }>;
}> {
  const userId = opts.userId || 'system';
  const userName = opts.userName || 'System · Backfill';

  // Count posted accruals (the "scanned" denominator) up front, then
  // pull only the ones that have no obligation yet via LEFT JOIN — that
  // way "already promoted" is observable without ever calling the
  // promotion service for those rows.
  const baseWhere = opts.companyId
    ? and(eq(accrualsTbl.status, 'posted'), eq(accrualsTbl.companyId, opts.companyId))
    : eq(accrualsTbl.status, 'posted');

  const scannedRows = await db.select({ id: accrualsTbl.id })
    .from(accrualsTbl).where(baseWhere);
  const scanned = scannedRows.length;

  const pendingRows = await db
    .select({
      accrualId: accrualsTbl.accrualId,
    })
    .from(accrualsTbl)
    .leftJoin(
      obligationsTbl,
      eq(obligationsTbl.sourceAccrualId, accrualsTbl.accrualId),
    )
    .where(and(baseWhere, isNull(obligationsTbl.id)));

  let promoted = 0;
  const errors: Array<{ accrualId: string; error: string }> = [];

  for (const row of pendingRows) {
    try {
      const result = await promoteAccrualToObligation(row.accrualId, {
        userId, userName, phase: 'backfill',
      });
      if (result.outcome === 'created') promoted++;
      // 'updated' / 'skipped' are not expected here — the LEFT JOIN
      // filter already excluded already-bridged rows. If they show up
      // it means a concurrent writer raced us; treat as a no-op.
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ accrualId: row.accrualId, error: msg });
    }
  }

  return {
    scanned,
    promoted,
    alreadyPromoted: scanned - pendingRows.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Atomic post-and-promote helper. Wraps the accrual status flip + JE
// pending update + obligation promotion in a single Postgres transaction
// so that an OEM throw — or any other promotion failure — rolls back the
// status flip too. Without this, a 422 response leaves the accrual
// `posted` in the DB with no obligation backing it.
//
// Returns the updated accrual row and the promotion result so callers
// can decide what to log / what to render.
// ---------------------------------------------------------------------------
export interface PostAndPromoteOptions extends PromoteOptions {
  /** Set to true to also flip linked draft journal entries to `pending`
   *  inside the same transaction (the legacy PATCH /api/accruals/:id
   *  behaviour). Default true so the helper is a drop-in. */
  flipJournalEntries?: boolean;
}

export interface PostAndPromoteResult {
  accrual: typeof accrualsTbl.$inferSelect;
  promotion: PromoteResult;
}

export async function postAndPromoteAccrual(
  accrualIdStr: string,
  opts: PostAndPromoteOptions = {},
): Promise<PostAndPromoteResult> {
  return await db.transaction(async (tx) => {
    // 1. Flip accrual to posted within the txn so a downstream throw
    //    rolls back the status. Use accrual_id (the human-readable key)
    //    not id (the row uuid) — same key the PATCH route uses.
    //    `as never` here works around the same drizzle 0.39 truncated
    //    insert/update inference noted in promoteAccrualToObligation.
    const [updated] = await tx.update(accrualsTbl)
      .set({ status: 'posted', updatedAt: new Date() } as never)
      .where(eq(accrualsTbl.accrualId, accrualIdStr))
      .returning();
    if (!updated) {
      throw new Error(`Accrual ${accrualIdStr} not found`);
    }

    // 2. Move linked draft JEs to pending review (matches the legacy
    //    PATCH behaviour). Skipped when flipJournalEntries=false.
    if (opts.flipJournalEntries !== false) {
      await tx.update(journalEntriesTbl)
        .set({ jeStage: 'pending', updatedAt: new Date() } as never)
        .where(and(
          eq(journalEntriesTbl.sourceAccrualId, accrualIdStr),
          eq(journalEntriesTbl.jeStage, 'draft'),
        ));
    }

    // 3. Promote inside the same txn. OEM throws → whole txn rolls back.
    const promotion = await promoteAccrualToObligation(accrualIdStr, opts, tx);

    // 4. Audit trail (also inside txn so it lives or dies with the post).
    await tx.insert(accrualAuditTrailTbl).values({
      accrualId: accrualIdStr,
      eventType: 'obligation_promotion',
      description:
        `Obligation ${promotion.outcome} (${promotion.direction}/${promotion.kind}, status=${promotion.initialStatus}) → ${promotion.obligationId}`,
      userName: opts.userName || 'System',
    } as never);

    return { accrual: updated, promotion };
  });
}

