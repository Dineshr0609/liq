-- Round 1 — Phase 2: Subtype Instances + rule migration + policy-rule archive.

BEGIN;

-- =========================================================================
-- 2.1 Create the 15 subtype_instances
-- =========================================================================
-- Strategy:
--   * Every VRP and CRP contract → 1 instance of subtype 'RA'.
--   * The 1 RLA contract → 1 'ROY' instance (for percentage rules)
--                        + 1 'MIN' instance (for minimum_guarantee rules).
-- Auto-label format: "{counterparty_or_contract} — {subtype_name}".

WITH new_instances AS (
  -- VRP + CRP → RA (one per contract)
  SELECT c.id AS contract_id,
         'RA'::varchar AS subtype_code,
         CONCAT(
           CASE WHEN c.counterparty_name IS NULL OR c.counterparty_name ILIKE '%REDACTED%'
                THEN c.contract_number
                ELSE c.counterparty_name
           END,
           ' — Rebate / Allowance'
         ) AS label
    FROM contracts c
   WHERE c.flow_type_code IN ('VRP','CRP')

  UNION ALL

  -- RLA → ROY (one per contract that has any percentage/non-MIN rule)
  SELECT c.id, 'ROY',
         CONCAT(
           CASE WHEN c.counterparty_name IS NULL OR c.counterparty_name ILIKE '%REDACTED%'
                THEN c.contract_number
                ELSE c.counterparty_name
           END,
           ' — Royalty'
         )
    FROM contracts c
   WHERE c.flow_type_code = 'RLA'
     AND EXISTS (
       SELECT 1 FROM contract_rules cr
        WHERE cr.contract_id = c.id
          AND cr.rule_type <> 'minimum_guarantee'
     )

  UNION ALL

  -- RLA → MIN (one per contract that has any minimum_guarantee rule)
  SELECT c.id, 'MIN',
         CONCAT(
           CASE WHEN c.counterparty_name IS NULL OR c.counterparty_name ILIKE '%REDACTED%'
                THEN c.contract_number
                ELSE c.counterparty_name
           END,
           ' — Minimum Guarantee'
         )
    FROM contracts c
   WHERE c.flow_type_code = 'RLA'
     AND EXISTS (
       SELECT 1 FROM contract_rules cr
        WHERE cr.contract_id = c.id
          AND cr.rule_type = 'minimum_guarantee'
     )
)
INSERT INTO subtype_instances (contract_id, subtype_code, label, status)
SELECT contract_id, subtype_code, label, 'active'
  FROM new_instances
 WHERE NOT EXISTS (
   SELECT 1 FROM subtype_instances si
    WHERE si.contract_id  = new_instances.contract_id
      AND si.subtype_code = new_instances.subtype_code
 );

-- =========================================================================
-- 2.2 Backfill contract_rules.subtype_instance_id
-- =========================================================================
--   * VRP / CRP rule  → contract's RA instance
--   * RLA minimum_guarantee rule → contract's MIN instance
--   * RLA other rule             → contract's ROY instance

UPDATE contract_rules cr
   SET subtype_instance_id = si.id
  FROM contracts c
  JOIN subtype_instances si ON si.contract_id = c.id
 WHERE cr.contract_id = c.id
   AND cr.subtype_instance_id IS NULL
   AND c.flow_type_code IN ('VRP','CRP')
   AND si.subtype_code = 'RA'
   AND cr.rule_type NOT IN ('payment_schedule','overpayment_offset');

UPDATE contract_rules cr
   SET subtype_instance_id = si.id
  FROM contracts c
  JOIN subtype_instances si ON si.contract_id = c.id AND si.subtype_code = 'MIN'
 WHERE cr.contract_id = c.id
   AND cr.subtype_instance_id IS NULL
   AND c.flow_type_code = 'RLA'
   AND cr.rule_type = 'minimum_guarantee';

UPDATE contract_rules cr
   SET subtype_instance_id = si.id
  FROM contracts c
  JOIN subtype_instances si ON si.contract_id = c.id AND si.subtype_code = 'ROY'
 WHERE cr.contract_id = c.id
   AND cr.subtype_instance_id IS NULL
   AND c.flow_type_code = 'RLA'
   AND cr.rule_type <> 'minimum_guarantee';

-- =========================================================================
-- 2.3 Archive the 2 policy-as-rule rows, then delete them from contract_rules
-- =========================================================================

INSERT INTO _legacy_policy_rules_archive
SELECT * FROM contract_rules
 WHERE rule_type IN ('payment_schedule','overpayment_offset')
   AND id NOT IN (SELECT id FROM _legacy_policy_rules_archive);

DELETE FROM contract_rules
 WHERE rule_type IN ('payment_schedule','overpayment_offset');

-- =========================================================================
-- Verify counts
-- =========================================================================
DO $$
DECLARE
  inst_count int;
  rule_count int;
  unmapped   int;
  archived   int;
BEGIN
  SELECT COUNT(*) INTO inst_count FROM subtype_instances;
  SELECT COUNT(*) INTO rule_count FROM contract_rules;
  SELECT COUNT(*) INTO unmapped   FROM contract_rules WHERE subtype_instance_id IS NULL;
  SELECT COUNT(*) INTO archived   FROM _legacy_policy_rules_archive;
  RAISE NOTICE 'subtype_instances: %, contract_rules: %, unmapped rules: %, archived: %',
    inst_count, rule_count, unmapped, archived;
END $$;

COMMIT;
