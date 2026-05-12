#!/usr/bin/env tsx
/**
 * Task #68 — Backfill: promote every existing posted accrual to an obligation.
 *
 * Run with:
 *   npx tsx scripts/backfill-posted-accrual-obligations.ts
 *
 * Optional flags:
 *   --company <companyId>   Restrict the walk to one tenant.
 *   --dry-run               Print what would happen; do not write.
 *
 * The script delegates to backfillPostedAccrualObligations() in
 * server/services/accrualPromotionService.ts. That function is the same
 * code path the live PATCH /api/accruals/:id endpoint uses, so a successful
 * backfill is the strongest possible smoke test for the promotion bridge.
 *
 * The promotion service is idempotent on `sourceAccrualId`, so running this
 * twice is safe — the second run reports `alreadyPromoted` for the
 * same rows. Re-runs are the supported recovery for partial failures
 * (e.g. an OEM contract that fails until its direction is pinned).
 *
 * Specifically calls out the originally-reported row ACC-MOHRYC8H ($14,054.65)
 * in the summary so the task's verification target is unambiguous.
 */

import { backfillPostedAccrualObligations, promoteAccrualToObligation }
  from '../server/services/accrualPromotionService';
import { db } from '../server/db';
import { accruals as accrualsTbl, obligations as obligationsTbl } from '../shared/schema';
import { eq } from 'drizzle-orm';

const TARGET_ACCRUAL = 'ACC-MOHRYC8H';

async function main() {
  const args = process.argv.slice(2);
  const companyArgIdx = args.indexOf('--company');
  const companyId = companyArgIdx >= 0 ? args[companyArgIdx + 1] : null;
  const dryRun = args.includes('--dry-run');

  console.log('=== Task 68 backfill — posted accruals → obligations ===');
  console.log(`  Tenant filter : ${companyId || '(all)'}`);
  console.log(`  Dry-run       : ${dryRun ? 'yes' : 'no'}`);

  if (dryRun) {
    // Dry-run: list candidates without invoking the promotion service.
    const where = companyId
      ? eq(accrualsTbl.companyId, companyId)
      : undefined;
    const rows = (await (where ? db.select().from(accrualsTbl).where(where) : db.select().from(accrualsTbl)))
      .filter((r: any) => r.status === 'posted');
    console.log(`  Candidates    : ${rows.length} posted accruals`);
    for (const r of rows) {
      const [existing] = await db.select().from(obligationsTbl)
        .where(eq(obligationsTbl.sourceAccrualId, r.accrualId)).limit(1);
      const tag = existing ? `already promoted → ${existing.id} (${existing.status})` : 'NEW';
      console.log(`    ${r.accrualId.padEnd(16)} $${r.amount}  [${r.flowType || '-'}]  ${tag}`);
    }
    return;
  }

  const result = await backfillPostedAccrualObligations({
    companyId,
    userId: 'system',
    userName: 'System · Backfill (Task 68)',
  });

  console.log('--- Backfill summary ---');
  console.log(`  Scanned          : ${result.scanned}`);
  console.log(`  Promoted         : ${result.promoted}  (newly created)`);
  console.log(`  Already promoted : ${result.alreadyPromoted}  (left untouched — pre-skipped via LEFT JOIN)`);
  console.log(`  Errors           : ${result.errors.length}`);
  for (const e of result.errors) {
    console.log(`    ✗ ${e.accrualId}: ${e.error}`);
  }

  // Explicit confirmation for the row called out in the task description.
  const [target] = await db.select().from(obligationsTbl)
    .where(eq(obligationsTbl.sourceAccrualId, TARGET_ACCRUAL)).limit(1);
  if (target) {
    console.log(`\n  ✓ ${TARGET_ACCRUAL} → obligation ${target.id}`);
    console.log(`      direction=${target.direction}  kind=${target.kind}  status=${target.status}`);
    console.log(`      amount=${target.amount} ${target.currency}`);
  } else {
    // Try a one-off promotion in case the accrual exists but wasn't picked
    // up by the batch walk (e.g. wrong tenant filter). Surfaces a clear
    // error if the accrual itself is missing.
    try {
      const r = await promoteAccrualToObligation(TARGET_ACCRUAL, {
        userId: 'system', userName: 'System · Backfill (Task 68 target)',
        phase: 'backfill_target',
      });
      console.log(`\n  ✓ ${TARGET_ACCRUAL} → obligation ${r.obligationId} (${r.outcome})`);
    } catch (e: any) {
      console.log(`\n  ⚠ ${TARGET_ACCRUAL} not promoted: ${e.message}`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
