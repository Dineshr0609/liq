-- Round 1 — Phase 4: Settlement Policies + 5 children + migrate the 2 archived policy rules.

BEGIN;

-- =========================================================================
-- 4.1 Seed 15 settlement_policies (one per subtype_instance)
-- =========================================================================

INSERT INTO settlement_policies (subtype_instance_id, version_num, is_current, notes)
SELECT si.id, 1, true,
       'Auto-seeded with default values during Round 1 Phase 4 migration.'
  FROM subtype_instances si
 WHERE NOT EXISTS (
   SELECT 1 FROM settlement_policies sp WHERE sp.subtype_instance_id = si.id
 );

-- =========================================================================
-- 4.2 Seed default child rows for every settlement_policy that doesn't yet
--     have one. The single CRP TechSound (contract 7a8724d2-...) instance
--     gets bespoke values from the archived policy rules; everything else
--     gets pure defaults.
-- =========================================================================

-- payment_schedules — defaults: quarterly / net 30
INSERT INTO payment_schedules (settlement_policy_id, cadence, payment_terms_days)
SELECT sp.id, 'quarterly', 30
  FROM settlement_policies sp
 WHERE NOT EXISTS (SELECT 1 FROM payment_schedules ps WHERE ps.settlement_policy_id = sp.id);

-- settlement_methods — default: ACH to counterparty
INSERT INTO settlement_methods (settlement_policy_id, method, remit_to_party)
SELECT sp.id, 'ach', 'counterparty'
  FROM settlement_policies sp
 WHERE NOT EXISTS (SELECT 1 FROM settlement_methods sm WHERE sm.settlement_policy_id = sp.id);

-- overpayment_handlings — default: offset next period
INSERT INTO overpayment_handlings (settlement_policy_id, strategy, threshold_amount)
SELECT sp.id, 'offset_next', 0
  FROM settlement_policies sp
 WHERE NOT EXISTS (SELECT 1 FROM overpayment_handlings oh WHERE oh.settlement_policy_id = sp.id);

-- dispute_handlings — default: hold payment, 15-day SLA
INSERT INTO dispute_handlings (settlement_policy_id, default_strategy, response_sla_days)
SELECT sp.id, 'hold_payment', 15
  FROM settlement_policies sp
 WHERE NOT EXISTS (SELECT 1 FROM dispute_handlings dh WHERE dh.settlement_policy_id = sp.id);

-- fx_rules — default: spot at settlement, base USD
INSERT INTO fx_rules (settlement_policy_id, rate_source, base_currency)
SELECT sp.id, 'spot_at_settlement', 'USD'
  FROM settlement_policies sp
 WHERE NOT EXISTS (SELECT 1 FROM fx_rules fr WHERE fr.settlement_policy_id = sp.id);

-- =========================================================================
-- 4.3 Migrate the 2 archived policy rules into the bespoke CRP TechSound
--     settlement_policy children.
-- =========================================================================
--
-- Source rules (in _legacy_policy_rules_archive):
--   payment_schedule    "Manufacturer will calculate rebates and issue
--                        payment within 30 days after quarter end."
--   overpayment_offset  "Adjustment rule to offset any overpaid rebates
--                        (resulting from returns or credits issued after
--                        quarter close) against future rebate payments."
--
-- Target instance: contract 7a8724d2-01cf-4359-8ab1-446ab397fc5a, RA subtype.

UPDATE payment_schedules ps
   SET cadence = 'quarterly',
       payment_terms_days = 30,
       notes = 'Migrated from archived rule "Rebate Payment Terms" '
            || '(legacy id 546508ad-3177-437d-ae4e-d38796d66cf4). '
            || 'Source: "Manufacturer will calculate rebates and issue '
            || 'payment within 30 days after quarter end."',
       updated_at = now()
  FROM settlement_policies sp
  JOIN subtype_instances si ON si.id = sp.subtype_instance_id
 WHERE ps.settlement_policy_id = sp.id
   AND si.contract_id  = '7a8724d2-01cf-4359-8ab1-446ab397fc5a'
   AND si.subtype_code = 'RA';

UPDATE overpayment_handlings oh
   SET strategy = 'offset_next',
       threshold_amount = 0,
       notes = 'Migrated from archived rule "Rebate Overpayment Offset" '
            || '(legacy id 2000d2e1-d42e-48bf-a832-0256cb1f05b1). '
            || 'Source: "Offset any overpaid rebates (resulting from '
            || 'returns or credits issued after quarter close) against '
            || 'future rebate payments."',
       updated_at = now()
  FROM settlement_policies sp
  JOIN subtype_instances si ON si.id = sp.subtype_instance_id
 WHERE oh.settlement_policy_id = sp.id
   AND si.contract_id  = '7a8724d2-01cf-4359-8ab1-446ab397fc5a'
   AND si.subtype_code = 'RA';

-- Sanity counts
DO $$
DECLARE
  sp_n int; ps_n int; sm_n int; oh_n int; dh_n int; fx_n int;
BEGIN
  SELECT COUNT(*) INTO sp_n FROM settlement_policies;
  SELECT COUNT(*) INTO ps_n FROM payment_schedules;
  SELECT COUNT(*) INTO sm_n FROM settlement_methods;
  SELECT COUNT(*) INTO oh_n FROM overpayment_handlings;
  SELECT COUNT(*) INTO dh_n FROM dispute_handlings;
  SELECT COUNT(*) INTO fx_n FROM fx_rules;
  RAISE NOTICE 'settlement_policies: %, payment_schedules: %, settlement_methods: %, overpayment_handlings: %, dispute_handlings: %, fx_rules: %',
    sp_n, ps_n, sm_n, oh_n, dh_n, fx_n;
END $$;

COMMIT;
