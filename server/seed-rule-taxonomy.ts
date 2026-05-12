/**
 * Rule Taxonomy Seeder
 *
 * Seeds the global rule-taxonomy reference tables that are required by the
 * Rule Editor, Templates, and the Reference Lookups admin UI:
 *
 *   - subtypes                  (10 rows: program codes like RA, CB, ROY, …)
 *   - flow_subtype_validity     (which subtypes are valid/primary per flow)
 *   - rule_types                (percentage / per_unit / tiered / …)
 *   - rule_field_whitelist      (system-level rule field whitelist)
 *   - deduction_reason_codes    (shortage, damaged, pricing, …)
 *
 * Idempotency
 * -----------
 * Every insert is keyed by the row's natural key (e.g. `subtypes.code`,
 * `flow_subtype_validity.(flow_type_code, subtype_code)`,
 * `rule_field_whitelist.(object_code, attribute_code)` for system rows,
 * etc.) and is skipped when a matching row already exists. Existing rows
 * are NEVER updated, so admin edits made through the Reference Lookups UI
 * survive every restart.
 *
 * Why this exists
 * ---------------
 * Historically these tables were populated manually in dev via the admin
 * UI or one-off SQL pastes. As a result, every fresh database (including
 * production deployments) booted with an empty Program picker, no rule
 * types, and templates that rendered no clauses or rules. This seeder
 * ensures the canonical taxonomy is always present on first boot.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import {
  SUBTYPES_SEED,
  FLOW_SUBTYPE_VALIDITY_SEED,
  RULE_TYPES_SEED,
  RULE_FIELD_WHITELIST_SEED,
  DEDUCTION_REASON_CODES_SEED,
} from './seed-data/rule-taxonomy-data';

export async function seedRuleTaxonomy(): Promise<void> {
  let inserted = 0;

  // --- subtypes ----------------------------------------------------------
  for (const s of SUBTYPES_SEED) {
    const r = await db.execute(sql`
      INSERT INTO subtypes (
        code, name, description, category,
        default_aggregation_period, default_engine_handler,
        default_gl_account, default_finance_hub_tab,
        is_active, sort_order
      )
      VALUES (
        ${s.code}, ${s.name}, ${s.description ?? null}, ${s.category},
        ${s.default_aggregation_period}, ${s.default_engine_handler},
        ${s.default_gl_account ?? null}, ${s.default_finance_hub_tab ?? null},
        ${s.is_active}, ${s.sort_order ?? 0}
      )
      ON CONFLICT (code) DO NOTHING
      RETURNING code;
    `);
    if ((r as any).rows?.length) inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} subtype(s)`);
  inserted = 0;

  // --- flow_subtype_validity --------------------------------------------
  for (const v of FLOW_SUBTYPE_VALIDITY_SEED) {
    const exists = await db.execute(sql`
      SELECT 1 FROM flow_subtype_validity
      WHERE flow_type_code = ${v.flow_type_code}
        AND subtype_code = ${v.subtype_code}
      LIMIT 1;
    `);
    if ((exists as any).rows?.length) continue;
    await db.execute(sql`
      INSERT INTO flow_subtype_validity (flow_type_code, subtype_code, is_primary, notes)
      VALUES (${v.flow_type_code}, ${v.subtype_code}, ${v.is_primary}, ${v.notes ?? null});
    `);
    inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} flow_subtype_validity row(s)`);
  inserted = 0;

  // --- rule_types --------------------------------------------------------
  for (const rt of RULE_TYPES_SEED) {
    const r = await db.execute(sql`
      INSERT INTO rule_types (code, name, description, engine_handler, is_active, sort_order)
      VALUES (
        ${rt.code}, ${rt.name}, ${rt.description ?? null},
        ${rt.engine_handler}, ${rt.is_active}, ${rt.sort_order ?? 0}
      )
      ON CONFLICT (code) DO NOTHING
      RETURNING code;
    `);
    if ((r as any).rows?.length) inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} rule type(s)`);
  inserted = 0;

  // --- rule_field_whitelist ---------------------------------------------
  // System rows have company_id IS NULL; uniqueness is (object_code, attribute_code)
  // for the system scope. We test existence on that pair to stay idempotent.
  for (const w of RULE_FIELD_WHITELIST_SEED) {
    const exists = await db.execute(sql`
      SELECT 1 FROM rule_field_whitelist
      WHERE object_code = ${w.object_code}
        AND attribute_code = ${w.attribute_code}
        AND company_id IS NOT DISTINCT FROM ${w.company_id ?? null}
      LIMIT 1;
    `);
    if ((exists as any).rows?.length) continue;
    await db.execute(sql`
      INSERT INTO rule_field_whitelist (
        company_id, object_code, attribute_code, label, field_type,
        master_table, is_active, is_system, is_default, sequence
      )
      VALUES (
        ${w.company_id ?? null}, ${w.object_code}, ${w.attribute_code},
        ${w.label}, ${w.field_type}, ${w.master_table ?? null},
        ${w.is_active}, ${w.is_system}, ${w.is_default}, ${w.sequence ?? 100}
      );
    `);
    inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} rule_field_whitelist row(s)`);
  inserted = 0;

  // --- deduction_reason_codes -------------------------------------------
  for (const d of DEDUCTION_REASON_CODES_SEED) {
    const r = await db.execute(sql`
      INSERT INTO deduction_reason_codes (code, description, default_disposition, is_active)
      VALUES (${d.code}, ${d.description}, ${d.default_disposition}, ${d.is_active})
      ON CONFLICT (code) DO NOTHING
      RETURNING code;
    `);
    if ((r as any).rows?.length) inserted++;
  }
  if (inserted) console.log(`✓ Seeded ${inserted} deduction reason code(s)`);
}
