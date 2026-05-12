/**
 * Default Policies Backfill Seeder
 *
 * Phase 1 — For every existing contract that has no subtype_instance,
 *           call ensureDefaultSubtypeInstance(contractId). That helper
 *           uses flow_subtype_validity to pick the primary subtype for the
 *           contract's flow_type_code and inserts a single instance.
 *
 * Phase 2 — For every subtype_instance that has no CURRENT settlement
 *           policy, insert a default settlement_policy plus its 5 children
 *           (payment_schedule, settlement_method, overpayment_handling,
 *           dispute_handling, fx_rule). All defaults come from the column
 *           DEFAULTs declared in the schema (per_sale, ach, USD, etc.) —
 *           the same values the original "Round 1 Phase 4 migration" used.
 *
 * Phase 3 — Same as Phase 2 but for accrual_policies (no children).
 *
 * Idempotency
 * -----------
 * Each phase tests for existing rows before inserting, so the seeder is
 * safe to run on every startup. After the first successful run on a fresh
 * production DB, subsequent runs are no-ops.
 *
 * Why this exists
 * ---------------
 * The taxonomy seeders (seed-rule-taxonomy.ts) only populate the GLOBAL
 * reference tables. The PER-CONTRACT subtype_instances and policies were
 * historically created by a one-time Round 1 Phase 4 migration script
 * that no longer ships with the codebase. Without this backfill, contracts
 * that were uploaded BEFORE the taxonomy was seeded would never get an
 * instance or a default policy, so the Settlement / Accruals workspaces
 * and the Program picker would stay empty for those contracts.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export async function seedDefaultPolicies(): Promise<void> {
  // -----------------------------------------------------------------
  // Phase 1: ensureDefaultSubtypeInstance for any contract without one
  // -----------------------------------------------------------------
  const orphanContracts = await db.execute(sql`
    SELECT c.id
    FROM contracts c
    LEFT JOIN subtype_instances si ON si.contract_id = c.id
    WHERE si.id IS NULL;
  `);

  let createdInstances = 0;
  let skippedInstances = 0;
  if (((orphanContracts as any).rows as any[]).length > 0) {
    const { ensureDefaultSubtypeInstance } = await import('./services/subtypeInstanceService');
    for (const row of (orphanContracts as any).rows as Array<{ id: string }>) {
      try {
        const id = await ensureDefaultSubtypeInstance(row.id);
        if (id) createdInstances++;
        else skippedInstances++;
      } catch (err: any) {
        skippedInstances++;
        console.warn(`[default-policies] ensureDefaultSubtypeInstance failed for ${row.id}: ${err?.message ?? err}`);
      }
    }
  }
  if (createdInstances > 0) console.log(`✓ Backfilled ${createdInstances} subtype instance(s) for legacy contracts`);
  if (skippedInstances > 0) console.log(`  (skipped ${skippedInstances} contract(s) — no resolvable primary subtype)`);

  // -----------------------------------------------------------------
  // Phase 2: default settlement_policy (+ 5 children) per instance
  // -----------------------------------------------------------------
  const instancesNeedingSettlement = await db.execute(sql`
    SELECT si.id
    FROM subtype_instances si
    LEFT JOIN settlement_policies sp
      ON sp.subtype_instance_id = si.id AND sp.is_current = true
    WHERE sp.id IS NULL;
  `);

  let createdSettlements = 0;
  for (const row of (instancesNeedingSettlement as any).rows as Array<{ id: string }>) {
    try {
      // Insert parent settlement_policy — column DEFAULTs fill version_num,
      // is_current, effective_from, etc.
      const inserted = await db.execute(sql`
        INSERT INTO settlement_policies (subtype_instance_id, notes)
        VALUES (${row.id}, ${'Auto-seeded default policy on startup backfill.'})
        RETURNING id;
      `);
      const newPolicyId = ((inserted as any).rows?.[0] as any)?.id as string | undefined;
      if (!newPolicyId) continue;

      // Insert the 5 children — each with column DEFAULTs only.
      await db.execute(sql`INSERT INTO payment_schedules (settlement_policy_id) VALUES (${newPolicyId});`);
      await db.execute(sql`INSERT INTO settlement_methods (settlement_policy_id) VALUES (${newPolicyId});`);
      await db.execute(sql`INSERT INTO overpayment_handlings (settlement_policy_id) VALUES (${newPolicyId});`);
      await db.execute(sql`INSERT INTO dispute_handlings (settlement_policy_id) VALUES (${newPolicyId});`);
      await db.execute(sql`INSERT INTO fx_rules (settlement_policy_id) VALUES (${newPolicyId});`);

      createdSettlements++;
    } catch (err: any) {
      console.warn(`[default-policies] settlement_policy backfill failed for instance ${row.id}: ${err?.message ?? err}`);
    }
  }
  if (createdSettlements > 0) console.log(`✓ Created ${createdSettlements} default settlement policy bundle(s)`);

  // -----------------------------------------------------------------
  // Phase 3: default accrual_policy per instance (no children)
  // -----------------------------------------------------------------
  const instancesNeedingAccrual = await db.execute(sql`
    SELECT si.id, s.default_aggregation_period, s.default_gl_account, s.default_finance_hub_tab
    FROM subtype_instances si
    JOIN subtypes s ON s.code = si.subtype_code
    LEFT JOIN accrual_policies ap
      ON ap.subtype_instance_id = si.id AND ap.is_current = true
    WHERE ap.id IS NULL;
  `);

  let createdAccruals = 0;
  for (const row of (instancesNeedingAccrual as any).rows as Array<{
    id: string;
    default_aggregation_period: string | null;
    default_gl_account: string | null;
    default_finance_hub_tab: string | null;
  }>) {
    try {
      // Use the subtype's own defaults for aggregation_period, gl_account
      // and finance_hub_tab so the accrual policy starts off matching the
      // taxonomy's recommendation for that program type.
      await db.execute(sql`
        INSERT INTO accrual_policies (
          subtype_instance_id,
          aggregation_period,
          gl_account,
          finance_hub_tab,
          notes
        )
        VALUES (
          ${row.id},
          ${row.default_aggregation_period ?? 'per_sale'},
          ${row.default_gl_account ?? null},
          ${row.default_finance_hub_tab ?? null},
          ${'Auto-seeded default policy on startup backfill.'}
        );
      `);
      createdAccruals++;
    } catch (err: any) {
      console.warn(`[default-policies] accrual_policy backfill failed for instance ${row.id}: ${err?.message ?? err}`);
    }
  }
  if (createdAccruals > 0) console.log(`✓ Created ${createdAccruals} default accrual policy(s)`);
}
