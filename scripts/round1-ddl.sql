-- Round 1 — Phases 1, 2, 3, 4, 5, 5b — DDL only.
-- Idempotent (uses IF NOT EXISTS / DO blocks). Safe to re-run.
-- Companion to schema additions in shared/schema.ts.

BEGIN;

-- =========================================================================
-- Phase 1 — Master taxonomy tables
-- =========================================================================

-- Add column to flow_types
ALTER TABLE flow_types
  ADD COLUMN IF NOT EXISTS default_extraction_prompt_key varchar;

CREATE TABLE IF NOT EXISTS subtypes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  description text,
  category varchar NOT NULL,
  default_aggregation_period varchar NOT NULL DEFAULT 'per_sale',
  default_engine_handler varchar NOT NULL DEFAULT 'universal',
  default_gl_account varchar,
  default_finance_hub_tab varchar,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_subtype_validity (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type_code varchar NOT NULL REFERENCES flow_types(code) ON DELETE CASCADE,
  subtype_code   varchar NOT NULL REFERENCES subtypes(code)   ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS flow_subtype_validity_pair_idx
  ON flow_subtype_validity(flow_type_code, subtype_code);

-- Add flow_type_code on contracts
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS flow_type_code varchar;

-- =========================================================================
-- Phase 2 — Subtype Instances
-- =========================================================================

CREATE TABLE IF NOT EXISTS subtype_instances (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id varchar NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  subtype_code varchar NOT NULL REFERENCES subtypes(code),
  label varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subtype_instances_contract_idx ON subtype_instances(contract_id);
CREATE INDEX IF NOT EXISTS subtype_instances_subtype_idx  ON subtype_instances(subtype_code);

-- Add subtype_instance_id on contract_rules
ALTER TABLE contract_rules
  ADD COLUMN IF NOT EXISTS subtype_instance_id varchar;

-- Archive table for the 2 policy-as-rule rows
CREATE TABLE IF NOT EXISTS _legacy_policy_rules_archive (
  LIKE contract_rules INCLUDING ALL
);

-- =========================================================================
-- Phase 3 — Accrual Policies (versioned)
-- =========================================================================

CREATE TABLE IF NOT EXISTS accrual_policies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype_instance_id varchar NOT NULL REFERENCES subtype_instances(id) ON DELETE CASCADE,
  version_num integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  aggregation_period varchar NOT NULL DEFAULT 'per_sale',
  obligation_accrual_basis varchar NOT NULL DEFAULT 'qualifying_sale',
  gl_account varchar,
  finance_hub_tab varchar,
  release_trigger_type varchar NOT NULL DEFAULT 'period_end',
  notes text,
  effective_from timestamp DEFAULT now(),
  effective_to timestamp,
  superseded_by varchar,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accrual_policies_instance_idx ON accrual_policies(subtype_instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS accrual_policies_current_idx
  ON accrual_policies(subtype_instance_id) WHERE is_current = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accrual_policies_superseded_by_fk') THEN
    ALTER TABLE accrual_policies
      ADD CONSTRAINT accrual_policies_superseded_by_fk
      FOREIGN KEY (superseded_by) REFERENCES accrual_policies(id);
  END IF;
END $$;

-- =========================================================================
-- Phase 4 — Settlement Policies + 5 child tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS settlement_policies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype_instance_id varchar NOT NULL REFERENCES subtype_instances(id) ON DELETE CASCADE,
  version_num integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  notes text,
  effective_from timestamp DEFAULT now(),
  effective_to timestamp,
  superseded_by varchar,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlement_policies_instance_idx ON settlement_policies(subtype_instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS settlement_policies_current_idx
  ON settlement_policies(subtype_instance_id) WHERE is_current = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settlement_policies_superseded_by_fk') THEN
    ALTER TABLE settlement_policies
      ADD CONSTRAINT settlement_policies_superseded_by_fk
      FOREIGN KEY (superseded_by) REFERENCES settlement_policies(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_schedules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_policy_id varchar NOT NULL,
  cadence varchar NOT NULL DEFAULT 'quarterly',
  payment_terms_days integer NOT NULL DEFAULT 30,
  payment_day integer,
  true_up_cadence varchar,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_schedules_policy_idx ON payment_schedules(settlement_policy_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pmt_sched_set_pol_fk') THEN
    ALTER TABLE payment_schedules ADD CONSTRAINT pmt_sched_set_pol_fk
      FOREIGN KEY (settlement_policy_id) REFERENCES settlement_policies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS settlement_methods (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_policy_id varchar NOT NULL,
  method varchar NOT NULL DEFAULT 'ach',
  bank_account_ref varchar,
  remit_to_party varchar DEFAULT 'counterparty',
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlement_methods_policy_idx ON settlement_methods(settlement_policy_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'set_meth_set_pol_fk') THEN
    ALTER TABLE settlement_methods ADD CONSTRAINT set_meth_set_pol_fk
      FOREIGN KEY (settlement_policy_id) REFERENCES settlement_policies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS overpayment_handlings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_policy_id varchar NOT NULL,
  strategy varchar NOT NULL DEFAULT 'offset_next',
  threshold_amount decimal(15,2) DEFAULT 0,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS overpayment_handlings_policy_idx ON overpayment_handlings(settlement_policy_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'over_hand_set_pol_fk') THEN
    ALTER TABLE overpayment_handlings ADD CONSTRAINT over_hand_set_pol_fk
      FOREIGN KEY (settlement_policy_id) REFERENCES settlement_policies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS dispute_handlings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_policy_id varchar NOT NULL,
  default_strategy varchar NOT NULL DEFAULT 'hold_payment',
  response_sla_days integer DEFAULT 15,
  escalation_contact varchar,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_handlings_policy_idx ON dispute_handlings(settlement_policy_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disp_hand_set_pol_fk') THEN
    ALTER TABLE dispute_handlings ADD CONSTRAINT disp_hand_set_pol_fk
      FOREIGN KEY (settlement_policy_id) REFERENCES settlement_policies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fx_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_policy_id varchar NOT NULL REFERENCES settlement_policies(id) ON DELETE CASCADE,
  rate_source varchar NOT NULL DEFAULT 'spot_at_settlement',
  fixed_rate decimal(15,6),
  base_currency varchar DEFAULT 'USD',
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fx_rules_policy_idx ON fx_rules(settlement_policy_id);

-- =========================================================================
-- Phase 5 — Add subtype_instance_id to finance tables
-- =========================================================================

ALTER TABLE accruals          ADD COLUMN IF NOT EXISTS subtype_instance_id varchar;
ALTER TABLE journal_entries   ADD COLUMN IF NOT EXISTS subtype_instance_id varchar;
ALTER TABLE settlements       ADD COLUMN IF NOT EXISTS subtype_instance_id varchar;

-- =========================================================================
-- Phase 5b — Rule Types master
-- =========================================================================

CREATE TABLE IF NOT EXISTS rule_types (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  description text,
  engine_handler varchar NOT NULL DEFAULT 'universal',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMIT;
