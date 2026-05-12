-- Round 1 seed data — Phases 1 (master taxonomy + contracts) and 5b (rule_types).
-- Idempotent via ON CONFLICT.

BEGIN;

-- =========================================================================
-- 1. flow_types — wipe & reseed with the canonical 6
-- =========================================================================

-- Keep existing rows out of the way: just upsert by code, then deactivate any
-- code not in the canonical set (don't drop, per "deprecate not destroy").

INSERT INTO flow_types (code, name, description, is_active, default_extraction_prompt_key) VALUES
  ('VRP', 'Vendor Rebate Program',           'Inbound rebates from vendors / suppliers (procurement-side).',          true, 'flow.vrp.extraction'),
  ('CRP', 'Customer Rebate Program',         'Outbound rebates owed to customers / channel partners (sell-side).',   true, 'flow.crp.extraction'),
  ('RLA', 'Royalty / Licensing Agreement',   'IP licensing and royalty obligations.',                                true, 'flow.rla.extraction'),
  ('SUB', 'Subscription Agreement',          'Recurring subscription / SaaS / membership contracts.',                true, 'flow.sub.extraction'),
  ('RSM', 'Resale / Marketplace Agreement',  'Reseller, distributor, and marketplace partner agreements.',           true, 'flow.rsm.extraction'),
  ('OEM', 'OEM / White-Label Agreement',     'OEM, white-label, and private-label manufacturing agreements.',        true, 'flow.oem.extraction')
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active   = true,
      default_extraction_prompt_key = EXCLUDED.default_extraction_prompt_key,
      updated_at  = now();

-- Deactivate any other flow_type rows (don't delete — for rollback safety).
UPDATE flow_types
   SET is_active = false, updated_at = now()
 WHERE code NOT IN ('VRP','CRP','RLA','SUB','RSM','OEM');

-- =========================================================================
-- 2. subtypes — 10 rows
-- =========================================================================

INSERT INTO subtypes (code, name, description, category, default_aggregation_period, default_engine_handler, default_gl_account, default_finance_hub_tab, sort_order) VALUES
  ('RA',  'Rebate / Allowance',         'Volume / growth / mix rebates and allowances.',                  'financial',   'quarterly',  'universal', '2410-rebates-payable',         'rebates',         10),
  ('CB',  'Chargeback',                 'Customer / distributor chargebacks against accruals.',           'financial',   'per_sale',   'universal', '2420-chargebacks-payable',     'chargebacks',     20),
  ('PP',  'Price Protection',           'Price-decline protection for inventory in trade.',               'financial',   'per_sale',   'universal', '2430-price-protection',        'price-protection',30),
  ('MDF', 'Market Development Funds',   'Co-op / MDF accruals tied to sell-through or marketing spend.',  'financial',   'monthly',    'universal', '6210-mdf-expense',             'mdf',             40),
  ('ROY', 'Royalty',                    'IP / brand royalty obligations on sales or units.',              'financial',   'monthly',    'universal', '2440-royalties-payable',       'royalties',       50),
  ('RSS', 'Revenue Share / SaaS',       'Revenue share, SaaS rev-rec, and recurring revenue splits.',     'financial',   'monthly',    'universal', '4110-revenue-share',           'rev-share',       60),
  ('PTR', 'Pass-Through Recovery',      'Pass-through fees, freight, and recoveries.',                    'financial',   'per_sale',   'universal', '5210-pass-through-recovery',   'pass-through',    70),
  ('SBE', 'Service / Billing Event',    'Service-billed events (per-ticket, per-call, per-visit).',       'financial',   'per_sale',   'universal', '4210-service-billing',         'service-billing', 80),
  ('COM', 'Commission',                 'Sales commission and SPIFF programs.',                           'financial',   'monthly',    'universal', '6310-sales-commissions',       'commissions',     90),
  ('MIN', 'Minimum Guarantee',          'Periodic minimum guarantees with shortfall true-ups.',           'operational', 'annual',     'universal', '2450-minimum-guarantee',       'min-guarantee',  100)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      default_aggregation_period = EXCLUDED.default_aggregation_period,
      default_engine_handler = EXCLUDED.default_engine_handler,
      default_gl_account = EXCLUDED.default_gl_account,
      default_finance_hub_tab = EXCLUDED.default_finance_hub_tab,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now();

-- =========================================================================
-- 3. flow_subtype_validity — 24 ✓ pairs
-- =========================================================================
--
-- Matrix:
--                RA  CB  PP  MDF  ROY  RSS  PTR  SBE  COM  MIN
--   VRP  (in)    ✓                          ✓
--   CRP  (out)   ✓   ✓   ✓   ✓                              ✓
--   RLA                              ✓                       ✓
--   SUB                                    ✓
--   RSM          ✓                                       ✓   ✓
--   OEM                              ✓             ✓
--
-- Total: 7 (VRP) wait let me recount — actually listed by user: 24 cells.
-- Final pairs the user signed off on:
INSERT INTO flow_subtype_validity (flow_type_code, subtype_code, is_primary) VALUES
  -- VRP (Vendor Rebate Program) — 4
  ('VRP','RA',  true),
  ('VRP','CB',  false),
  ('VRP','PTR', false),
  ('VRP','MIN', false),
  -- CRP (Customer Rebate Program) — 6
  ('CRP','RA',  true),
  ('CRP','CB',  false),
  ('CRP','PP',  false),
  ('CRP','MDF', false),
  ('CRP','PTR', false),
  ('CRP','MIN', false),
  -- RLA (Royalty / Licensing Agreement) — 4
  ('RLA','ROY', true),
  ('RLA','MIN', false),
  ('RLA','RSS', false),
  ('RLA','SBE', false),
  -- SUB (Subscription Agreement) — 3
  ('SUB','RSS', true),
  ('SUB','SBE', false),
  ('SUB','MIN', false),
  -- RSM (Resale / Marketplace Agreement) — 4
  ('RSM','RA',  true),
  ('RSM','COM', false),
  ('RSM','MIN', false),
  ('RSM','MDF', false),
  -- OEM (OEM / White-Label Agreement) — 3
  ('OEM','ROY', true),
  ('OEM','SBE', false),
  ('OEM','MIN', false)
ON CONFLICT (flow_type_code, subtype_code) DO UPDATE
  SET is_primary = EXCLUDED.is_primary;

-- =========================================================================
-- 5b. rule_types — 6 canonical
-- =========================================================================

INSERT INTO rule_types (code, name, description, engine_handler, sort_order) VALUES
  ('percentage',         'Percentage of Basis',     'rate × basis (e.g. 5% × net sales).',                              'universal', 10),
  ('per_unit',           'Per-Unit Amount',         'amount × units (e.g. $0.50 × units shipped).',                     'universal', 20),
  ('flat_amount',        'Flat / Fixed Amount',     'A fixed amount per period or event.',                              'universal', 30),
  ('tiered_volume',      'Tiered (Marginal Volume)','Marginal-tier rate based on per-period volume.',                   'universal', 40),
  ('tiered_cumulative',  'Tiered (Cumulative)',     'Cumulative-threshold tiers with retroactive true-ups.',            'universal', 50),
  ('metered_usage',      'Metered Usage',           'Usage-metered billing (per call, per request, per minute, etc.).', 'universal', 60)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      engine_handler = EXCLUDED.engine_handler,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now();

-- =========================================================================
-- Phase 1.b — Backfill contracts.flow_type_code from legacy contract_type
-- =========================================================================
--   ib_rebate          → VRP
--   ob_rebate          → CRP
--   licensing_royalty  → RLA

UPDATE contracts
   SET flow_type_code = CASE contract_type
                          WHEN 'ib_rebate'         THEN 'VRP'
                          WHEN 'ob_rebate'         THEN 'CRP'
                          WHEN 'licensing_royalty' THEN 'RLA'
                          ELSE flow_type_code
                        END
 WHERE flow_type_code IS NULL
   AND contract_type IN ('ib_rebate','ob_rebate','licensing_royalty');

COMMIT;
