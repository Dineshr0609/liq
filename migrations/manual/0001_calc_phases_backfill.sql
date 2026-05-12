-- ============================================================================
-- Task #5 — Calculation Phases & Rule Taxonomy (slice 1 of 3)
-- Manual migration applied 2026-04-20.
--
-- drizzle-kit push was blocked on an unrelated interactive prompt
-- (roles_role_name_unique), so the schema additions were applied with this
-- raw-SQL script. This file is checked in so the change is auditable and
-- re-runnable on any environment that hasn't picked it up yet.
--
-- Adds the columns declared in shared/schema.ts:
--   contract_rules.calc_phase           varchar default 'gross_calc'
--   contract_rules.trigger_source       varchar default 'sale'
--   contract_rules.aggregation_scope    varchar default 'per_sale'
--   calculation_rule_results.phase      varchar default 'gross_calc'
--
-- All existing rows are backfilled to 'gross_calc' so engine behaviour is
-- unchanged for legacy single-phase contracts. (Slice 1 acceptance criterion.)
-- ============================================================================

ALTER TABLE contract_rules
  ADD COLUMN IF NOT EXISTS calc_phase        varchar DEFAULT 'gross_calc',
  ADD COLUMN IF NOT EXISTS trigger_source    varchar DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS aggregation_scope varchar DEFAULT 'per_sale';

ALTER TABLE calculation_rule_results
  ADD COLUMN IF NOT EXISTS phase varchar DEFAULT 'gross_calc';

-- Backfill: stamp every pre-existing row with 'gross_calc'.
-- Idempotent — only touches rows where the column is still NULL.
UPDATE contract_rules
   SET calc_phase = 'gross_calc'
 WHERE calc_phase IS NULL;

UPDATE contract_rules
   SET trigger_source = 'sale'
 WHERE trigger_source IS NULL;

UPDATE contract_rules
   SET aggregation_scope = 'per_sale'
 WHERE aggregation_scope IS NULL;

UPDATE calculation_rule_results
   SET phase = 'gross_calc'
 WHERE phase IS NULL;
