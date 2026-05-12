/**
 * Policies Service — versioning + read helpers for the Round 1 Subtype
 * Instance model.
 *
 * Each Subtype Instance has exactly one CURRENT Accrual Policy and one
 * CURRENT Settlement Policy. Updates create a new version: the old row is
 * marked is_current=false, gets effective_to=now() and superseded_by=newId,
 * while a new row is inserted with version_num+1 and is_current=true. This
 * preserves history for audit/rollback.
 *
 * The five Settlement Policy children (payment_schedules, settlement_methods,
 * overpayment_handlings, dispute_handlings, fx_rules) are NOT versioned at
 * the row level — they ride the parent policy's version. When the
 * settlement policy is versioned, this service clones each existing child
 * onto the new policy so the new version starts as an exact copy that the
 * caller can then edit.
 */

import { db } from '../db';
import {
  subtypeInstances,
  subtypes,
  accrualPolicies,
  settlementPolicies,
  paymentSchedules,
  settlementMethods,
  overpaymentHandlings,
  disputeHandlings,
  fxRules,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export type PolicyChildTable =
  | 'payment_schedule'
  | 'settlement_method'
  | 'overpayment_handling'
  | 'dispute_handling'
  | 'fx_rule';

export async function listInstancesForContract(contractId: string) {
  const rows = await db
    .select({
      id: subtypeInstances.id,
      contractId: subtypeInstances.contractId,
      subtypeCode: subtypeInstances.subtypeCode,
      subtypeName: subtypes.name,
      label: subtypeInstances.label,
      status: subtypeInstances.status,
      createdAt: subtypeInstances.createdAt,
      updatedAt: subtypeInstances.updatedAt,
    })
    .from(subtypeInstances)
    .leftJoin(subtypes, eq(subtypes.code, subtypeInstances.subtypeCode))
    .where(eq(subtypeInstances.contractId, contractId))
    .orderBy(subtypeInstances.createdAt);
  return rows;
}

/**
 * Per-contract summary: one row per Subtype Instance with the CURRENT
 * accrual policy's aggregation period. Used by the Rules tab to show a
 * "from policy" vs "override" chip on each rule card without N+1 fetches.
 */
export async function listPoliciesSummaryForContract(contractId: string) {
  const rows = await db.execute(sql`
    SELECT
      si.id            AS instance_id,
      si.label         AS instance_label,
      si.subtype_code  AS subtype_code,
      ap.aggregation_period AS accrual_aggregation_period,
      ap.version_num   AS accrual_version_num
    FROM subtype_instances si
    LEFT JOIN accrual_policies ap
      ON ap.subtype_instance_id = si.id AND ap.is_current = true
    WHERE si.contract_id = ${contractId}
    ORDER BY si.created_at
  `);
  return (rows as any).rows.map((r: any) => ({
    instanceId: r.instance_id,
    instanceLabel: r.instance_label,
    subtypeCode: r.subtype_code,
    accrualAggregationPeriod: r.accrual_aggregation_period,
    accrualVersionNum: r.accrual_version_num,
  }));
}

/**
 * History — every accrual policy row for an instance, current first
 * (descending version_num).
 */
export async function listAccrualHistory(instanceId: string) {
  const rows = await db
    .select()
    .from(accrualPolicies)
    .where(eq(accrualPolicies.subtypeInstanceId, instanceId))
    .orderBy(desc(accrualPolicies.versionNum));
  return rows;
}

/**
 * History — every settlement policy row for an instance, current first.
 */
export async function listSettlementHistory(instanceId: string) {
  const rows = await db
    .select()
    .from(settlementPolicies)
    .where(eq(settlementPolicies.subtypeInstanceId, instanceId))
    .orderBy(desc(settlementPolicies.versionNum));
  return rows;
}

export async function getCurrentAccrualPolicy(instanceId: string) {
  const [row] = await db
    .select()
    .from(accrualPolicies)
    .where(and(eq(accrualPolicies.subtypeInstanceId, instanceId), eq(accrualPolicies.isCurrent, true)))
    .limit(1);
  return row ?? null;
}

export async function getCurrentSettlementPolicy(instanceId: string) {
  const [policy] = await db
    .select()
    .from(settlementPolicies)
    .where(and(eq(settlementPolicies.subtypeInstanceId, instanceId), eq(settlementPolicies.isCurrent, true)))
    .limit(1);
  if (!policy) return null;

  const [paymentSchedule] = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.settlementPolicyId, policy.id))
    .limit(1);
  const [settlementMethod] = await db
    .select()
    .from(settlementMethods)
    .where(eq(settlementMethods.settlementPolicyId, policy.id))
    .limit(1);
  const [overpaymentHandling] = await db
    .select()
    .from(overpaymentHandlings)
    .where(eq(overpaymentHandlings.settlementPolicyId, policy.id))
    .limit(1);
  const [disputeHandling] = await db
    .select()
    .from(disputeHandlings)
    .where(eq(disputeHandlings.settlementPolicyId, policy.id))
    .limit(1);
  const [fxRule] = await db
    .select()
    .from(fxRules)
    .where(eq(fxRules.settlementPolicyId, policy.id))
    .limit(1);

  return {
    policy,
    paymentSchedule: paymentSchedule ?? null,
    settlementMethod: settlementMethod ?? null,
    overpaymentHandling: overpaymentHandling ?? null,
    disputeHandling: disputeHandling ?? null,
    fxRule: fxRule ?? null,
  };
}

/**
 * Update the current accrual policy by versioning. Old row → is_current=false
 * + effective_to=now() + superseded_by=newId. New row → version_num+1,
 * is_current=true, with patch applied.
 */
export async function updateAccrualPolicyVersioned(
  instanceId: string,
  patch: Partial<typeof accrualPolicies.$inferInsert>,
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [old] = await tx
      .select()
      .from(accrualPolicies)
      .where(and(eq(accrualPolicies.subtypeInstanceId, instanceId), eq(accrualPolicies.isCurrent, true)))
      .limit(1);
    if (!old) throw new Error(`No current accrual_policy for instance ${instanceId}`);

    // Strip fields the caller must not control.
    const {
      id: _id, subtypeInstanceId: _sid, versionNum: _vn, isCurrent: _ic,
      supersededBy: _sb, effectiveFrom: _ef, effectiveTo: _et,
      createdAt: _ca, updatedAt: _ua, createdBy: _cb,
      ...safePatch
    } = patch as any;

    // The partial unique index `(subtype_instance_id) WHERE is_current=true`
    // means we MUST clear the old row's is_current before inserting the new
    // current row, otherwise the insert collides with the existing row.
    // Order within the transaction:
    //   1) old.is_current=false + effective_to=now()  (frees the partial unique slot)
    //   2) insert new row with is_current=true
    //   3) backfill old.superseded_by with the new id
    await tx
      .update(accrualPolicies)
      .set({ isCurrent: false, effectiveTo: new Date() })
      .where(eq(accrualPolicies.id, old.id));

    const [next] = await tx
      .insert(accrualPolicies)
      .values({
        // start from old row, then apply patch
        subtypeInstanceId: instanceId,
        aggregationPeriod: old.aggregationPeriod,
        obligationAccrualBasis: old.obligationAccrualBasis,
        glAccount: old.glAccount,
        financeHubTab: old.financeHubTab,
        releaseTriggerType: old.releaseTriggerType,
        notes: old.notes,
        ...safePatch,
        versionNum: (old.versionNum ?? 1) + 1,
        isCurrent: true,
        createdBy: userId,
      })
      .returning();

    await tx
      .update(accrualPolicies)
      .set({ supersededBy: next.id })
      .where(eq(accrualPolicies.id, old.id));

    return next;
  });
}

/**
 * Update the current settlement policy by versioning. Clones the 5 children
 * onto the new policy so the new version inherits the prior config; then
 * applies any caller-provided child patches on the cloned rows.
 */
export async function updateSettlementPolicyVersioned(
  instanceId: string,
  patch: {
    policy?: Partial<typeof settlementPolicies.$inferInsert>;
    paymentSchedule?: Partial<typeof paymentSchedules.$inferInsert>;
    settlementMethod?: Partial<typeof settlementMethods.$inferInsert>;
    overpaymentHandling?: Partial<typeof overpaymentHandlings.$inferInsert>;
    disputeHandling?: Partial<typeof disputeHandlings.$inferInsert>;
    fxRule?: Partial<typeof fxRules.$inferInsert>;
  },
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [oldPolicy] = await tx
      .select()
      .from(settlementPolicies)
      .where(and(eq(settlementPolicies.subtypeInstanceId, instanceId), eq(settlementPolicies.isCurrent, true)))
      .limit(1);
    if (!oldPolicy) throw new Error(`No current settlement_policy for instance ${instanceId}`);

    const policyPatch = patch.policy ?? {};
    const {
      id: _id, subtypeInstanceId: _sid, versionNum: _vn, isCurrent: _ic,
      supersededBy: _sb, effectiveFrom: _ef, effectiveTo: _et,
      createdAt: _ca, updatedAt: _ua, createdBy: _cb,
      ...safePolicyPatch
    } = policyPatch as any;

    // Same partial-unique-index dance as accrual policies: clear the old
    // row's is_current first so the insert can claim the unique slot.
    await tx
      .update(settlementPolicies)
      .set({ isCurrent: false, effectiveTo: new Date() })
      .where(eq(settlementPolicies.id, oldPolicy.id));

    const [newPolicy] = await tx
      .insert(settlementPolicies)
      .values({
        subtypeInstanceId: instanceId,
        notes: oldPolicy.notes,
        ...safePolicyPatch,
        versionNum: (oldPolicy.versionNum ?? 1) + 1,
        isCurrent: true,
        createdBy: userId,
      })
      .returning();

    // Clone the 5 children from old → new policy, applying any caller patches.
    const [oldPS] = await tx.select().from(paymentSchedules).where(eq(paymentSchedules.settlementPolicyId, oldPolicy.id)).limit(1);
    if (oldPS) {
      const { id: _, settlementPolicyId: __, createdAt: ___, updatedAt: ____, ...rest } = oldPS as any;
      await tx.insert(paymentSchedules).values({ ...rest, ...patch.paymentSchedule, settlementPolicyId: newPolicy.id });
    }

    const [oldSM] = await tx.select().from(settlementMethods).where(eq(settlementMethods.settlementPolicyId, oldPolicy.id)).limit(1);
    if (oldSM) {
      const { id: _, settlementPolicyId: __, createdAt: ___, updatedAt: ____, ...rest } = oldSM as any;
      await tx.insert(settlementMethods).values({ ...rest, ...patch.settlementMethod, settlementPolicyId: newPolicy.id });
    }

    const [oldOH] = await tx.select().from(overpaymentHandlings).where(eq(overpaymentHandlings.settlementPolicyId, oldPolicy.id)).limit(1);
    if (oldOH) {
      const { id: _, settlementPolicyId: __, createdAt: ___, updatedAt: ____, ...rest } = oldOH as any;
      await tx.insert(overpaymentHandlings).values({ ...rest, ...patch.overpaymentHandling, settlementPolicyId: newPolicy.id });
    }

    const [oldDH] = await tx.select().from(disputeHandlings).where(eq(disputeHandlings.settlementPolicyId, oldPolicy.id)).limit(1);
    if (oldDH) {
      const { id: _, settlementPolicyId: __, createdAt: ___, updatedAt: ____, ...rest } = oldDH as any;
      await tx.insert(disputeHandlings).values({ ...rest, ...patch.disputeHandling, settlementPolicyId: newPolicy.id });
    }

    const [oldFx] = await tx.select().from(fxRules).where(eq(fxRules.settlementPolicyId, oldPolicy.id)).limit(1);
    if (oldFx) {
      const { id: _, settlementPolicyId: __, createdAt: ___, updatedAt: ____, ...rest } = oldFx as any;
      await tx.insert(fxRules).values({ ...rest, ...patch.fxRule, settlementPolicyId: newPolicy.id });
    }

    await tx
      .update(settlementPolicies)
      .set({ supersededBy: newPolicy.id })
      .where(eq(settlementPolicies.id, oldPolicy.id));

    return newPolicy.id;
  });
}
