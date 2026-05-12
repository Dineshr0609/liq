/**
 * Backfill Script: Lift canonical obligation fields on existing rules
 *
 * The AI extractor now writes canonical obligation fields (amount / rate /
 * percentage / bps / plannedReleaseDate / releaseAfterDays / expiryDate /
 * expiresAfterDays / rolloverPolicy) at the top level of `formulaDefinition`
 * for new extractions. Rules extracted before that change still have those
 * values nested only under `formulaDefinition.calculation` — the editor's
 * read-time fallback covers display, but `obligationsService.deriveAccrual`
 * only reads top-level keys, so historical rules may not accrue correctly
 * until they're re-saved.
 *
 * This script walks every `contract_rules` row whose `ruleType` is in
 * `OBLIGATION_ACCRUAL_RULE_TYPES` and lifts the same canonical fields the
 * extractor would have written, using the shared
 * `liftObligationCanonicalFields` helper. It is idempotent — fields that
 * already exist at the top level are never overwritten — and prints a
 * summary of how many rules were inspected, mutated, and skipped.
 *
 * Usage:
 *   tsx server/scripts/backfill-obligation-canonical-fields.ts [--dry-run]
 */

import { db } from '../db';
import { contractRules } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { OBLIGATION_ACCRUAL_RULE_TYPES } from '../../shared/calcPhases';
import { liftObligationCanonicalFields } from '../services/obligationCanonicalFields';

async function backfillObligationCanonicalFields() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🚀 Backfilling obligation canonical fields${dryRun ? ' (dry run)' : ''}...\n`);

  const allRules = await db
    .select({
      id: contractRules.id,
      ruleType: contractRules.ruleType,
      formulaDefinition: contractRules.formulaDefinition,
    })
    .from(contractRules);
  const obligationRules = allRules.filter(r =>
    OBLIGATION_ACCRUAL_RULE_TYPES.has(String(r.ruleType || '').toLowerCase())
  );

  console.log(`   Scanned ${allRules.length} contract_rules rows`);
  console.log(`   ${obligationRules.length} match OBLIGATION_ACCRUAL_RULE_TYPES\n`);

  let updated = 0;
  let alreadyCanonical = 0;
  let skippedNoFormula = 0;
  let skippedNoNested = 0;
  const mutatedIds: string[] = [];

  for (const rule of obligationRules) {
    const fd = rule.formulaDefinition as any;
    if (!fd || typeof fd !== 'object') {
      skippedNoFormula++;
      continue;
    }

    const calculation = fd.calculation ?? null;
    const conditions = fd.conditions ?? null;

    if (!calculation && !conditions) {
      skippedNoNested++;
      continue;
    }

    // Clone so we can detect mutations without aliasing the live row.
    const next = JSON.parse(JSON.stringify(fd));
    const mutated = liftObligationCanonicalFields(next, calculation, conditions);

    if (!mutated) {
      alreadyCanonical++;
      continue;
    }

    mutatedIds.push(rule.id);
    updated++;

    if (!dryRun) {
      await db
        .update(contractRules)
        .set({ formulaDefinition: next })
        .where(eq(contractRules.id, rule.id));
    }

    if (updated % 25 === 0) {
      console.log(`   ✓ ${updated} rules ${dryRun ? 'would be ' : ''}updated so far...`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📝 BACKFILL SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Obligation rules scanned:        ${obligationRules.length}`);
  console.log(`Rules ${dryRun ? 'would be ' : ''}updated:           ${updated}`);
  console.log(`Already had canonical fields:    ${alreadyCanonical}`);
  console.log(`Skipped (no formulaDefinition):  ${skippedNoFormula}`);
  console.log(`Skipped (no nested data):        ${skippedNoNested}`);
  console.log('═══════════════════════════════════════');

  if (mutatedIds.length > 0 && mutatedIds.length <= 50) {
    console.log('\nMutated rule IDs:');
    mutatedIds.forEach(id => console.log(`   - ${id}`));
  } else if (mutatedIds.length > 50) {
    console.log(`\nMutated ${mutatedIds.length} rules (list suppressed).`);
  }

  console.log(`\n✅ Backfill ${dryRun ? '(dry run) ' : ''}completed.`);
}

backfillObligationCanonicalFields()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Backfill failed:', err);
    process.exit(1);
  });
