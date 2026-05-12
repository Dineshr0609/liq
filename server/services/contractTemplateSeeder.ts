/**
 * Contract Template Seeder (Task #46)
 *
 * Seeds 6 system contract templates — one per flow type — with sample rules
 * and clauses derived from the flow_subtype_validity matrix. Idempotent: safe
 * to run on every startup. Existing system templates are reseeded (extra
 * sample rules/clauses added) but never overwritten in place; user-owned
 * templates (is_system = false) are completely untouched.
 *
 * Why matrix-driven? The old approach hardcoded 9 templates in TypeScript
 * (~2k LOC). With a matrix-driven seeder, admin edits to the matrix
 * automatically widen or narrow which subtypes a template covers without any
 * code changes.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { contractTemplates, templateRules, templateClauses, flowTypes, subtypes, flowSubtypeValidity } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Per-subtype sample rule / clause text. Kept short and generic so the seeded
// templates work for every flow that includes the subtype. Calculation knobs
// live on contract_rules; this just gives the user a starting payload they
// can edit immediately.
// ---------------------------------------------------------------------------

interface SubtypeBlueprint {
  ruleType: string;
  ruleNameSuffix: string;
  description: string;
  payload: Record<string, any>;
  clauseText: string;
  clauseCategory: string;
}

const SUBTYPE_BLUEPRINTS: Record<string, SubtypeBlueprint> = {
  RA: {
    ruleType: 'volume_rebate',
    ruleNameSuffix: 'Volume Rebate',
    description: 'Tiered rebate paid quarterly on qualifying net sales.',
    payload: {
      base_rate: 0.03,
      volume_tiers: [
        { min: 0, max: 100000, rate: 0.02 },
        { min: 100000, max: 500000, rate: 0.03 },
        { min: 500000, max: null, rate: 0.045 },
      ],
      product_categories: [],
      territories: [],
      priority: 10,
    },
    clauseText:
      'The Buyer shall earn a tiered volume rebate on net qualifying purchases, calculated quarterly and paid within 30 days of period close.',
    clauseCategory: 'rebate',
  },
  CB: {
    ruleType: 'chargeback',
    ruleNameSuffix: 'Distributor Chargeback',
    description: 'Chargebacks applied against the rebate accrual for returns or pricing disputes.',
    payload: {
      base_rate: null,
      chargeback_categories: ['return_damage', 'pricing_dispute'],
      offset_account: 'rebate_accrual',
      priority: 20,
    },
    clauseText:
      'Distributor chargebacks shall be netted against the standing rebate accrual and reconciled at each quarter close.',
    clauseCategory: 'chargeback',
  },
  PP: {
    ruleType: 'price_protection',
    ruleNameSuffix: 'Price Protection',
    description: 'Credit issued on inventory in the channel when list price declines.',
    payload: {
      window_days: 30,
      eligibility: 'channel_inventory',
      priority: 30,
    },
    clauseText:
      'In the event of a list price decrease, Vendor shall issue price-protection credits on eligible inventory held by Buyer for 30 days following the price change.',
    clauseCategory: 'price_protection',
  },
  MDF: {
    ruleType: 'mdf_accrual',
    ruleNameSuffix: 'Market Development Fund',
    description: 'Co-op fund accrual based on net sell-through, claimable against marketing spend.',
    payload: {
      base_rate: 0.015,
      basis: 'net_sales',
      claim_window_days: 90,
      priority: 40,
    },
    clauseText:
      'A Market Development Fund shall accrue at 1.5% of net sell-through, claimable by Buyer within 90 days of period close upon submission of qualifying marketing proof of performance.',
    clauseCategory: 'mdf',
  },
  ROY: {
    ruleType: 'royalty',
    ruleNameSuffix: 'Royalty Obligation',
    description: 'Per-unit or percent-of-net royalty owed to the licensor.',
    payload: {
      base_rate: 0.06,
      basis: 'net_revenue',
      minimum_guarantee: 50000,
      priority: 10,
    },
    clauseText:
      'Licensee shall pay Licensor a royalty equal to 6% of Net Revenue, subject to the Minimum Annual Guarantee, payable within 45 days of each quarter end.',
    clauseCategory: 'royalty',
  },
  RSS: {
    ruleType: 'revenue_share',
    ruleNameSuffix: 'Revenue Share',
    description: 'Revenue split on recurring subscription / SaaS revenue.',
    payload: {
      base_rate: 0.20,
      basis: 'recognized_revenue',
      recognition: 'monthly',
      priority: 10,
    },
    clauseText:
      'Parties shall share recognized subscription revenue at the agreed split, with statements and payments rendered monthly within 30 days of month close.',
    clauseCategory: 'revenue_share',
  },
  PTR: {
    ruleType: 'pass_through',
    ruleNameSuffix: 'Pass-Through Recovery',
    description: 'Pass-through fees, freight, and recoveries billed at cost.',
    payload: {
      basis: 'actual_cost',
      markup: 0,
      priority: 50,
    },
    clauseText:
      'Pass-through charges (including freight, duties, and third-party fees) shall be billed at actual cost without markup.',
    clauseCategory: 'pass_through',
  },
  SBE: {
    ruleType: 'service_billing_event',
    ruleNameSuffix: 'Service Billing Event',
    description: 'Per-event service fees (per-ticket, per-call, per-visit).',
    payload: {
      unit_price: 75,
      basis: 'per_event',
      priority: 30,
    },
    clauseText:
      'Service activities shall be billed on a per-event basis at the agreed unit price, invoiced monthly in arrears.',
    clauseCategory: 'service_fee',
  },
  COM: {
    ruleType: 'commission',
    ruleNameSuffix: 'Sales Commission',
    description: 'Commission paid to the reseller / agent on closed business.',
    payload: {
      base_rate: 0.10,
      basis: 'net_sales',
      payout_period: 'monthly',
      priority: 20,
    },
    clauseText:
      'Reseller shall earn a commission of 10% on net booked sales, payable monthly within 15 days of month close.',
    clauseCategory: 'commission',
  },
  MIN: {
    ruleType: 'minimum_guarantee',
    ruleNameSuffix: 'Minimum Guarantee',
    description: 'Annual minimum with shortfall true-up at period end.',
    payload: {
      annual_minimum: 100000,
      shortfall_basis: 'annual',
      priority: 5,
    },
    clauseText:
      'Licensee guarantees a minimum annual payment, with any shortfall trued up within 30 days of the annual reporting period.',
    clauseCategory: 'minimum_guarantee',
  },
};

// ---------------------------------------------------------------------------
// Per-flow defaults (party role slots + accrual policies) seeded as jsonb on
// the system template. Mirrors the Pipeline/Royalty engine expectations.
// ---------------------------------------------------------------------------

interface FlowDefaults {
  description: string;
  partyRoleSlots: Record<string, any>;
  accrualPolicies: Array<Record<string, any>>;
}

const FLOW_DEFAULTS: Record<string, FlowDefaults> = {
  VRP: {
    description: 'Vendor rebate program — buyer earns rebates on purchases from vendor.',
    partyRoleSlots: { obligor: 'Vendor', beneficiary: 'Buyer' },
    accrualPolicies: [
      { subtypeCode: 'RA', aggregationPeriod: 'quarterly', releaseTriggerType: 'period_end' },
    ],
  },
  CRP: {
    description: 'Customer rebate program — seller pays rebates to customer on sell-through.',
    partyRoleSlots: { obligor: 'Seller', beneficiary: 'Customer' },
    accrualPolicies: [
      { subtypeCode: 'RA', aggregationPeriod: 'quarterly', releaseTriggerType: 'period_end' },
    ],
  },
  RLA: {
    description: 'Royalty / licensing agreement — licensee owes royalty to licensor.',
    partyRoleSlots: { obligor: 'Licensee', beneficiary: 'Licensor' },
    accrualPolicies: [
      { subtypeCode: 'ROY', aggregationPeriod: 'quarterly', releaseTriggerType: 'period_end' },
    ],
  },
  SUB: {
    description: 'Subscription / SaaS revenue share between provider and partner.',
    partyRoleSlots: { obligor: 'Provider', beneficiary: 'Partner' },
    accrualPolicies: [
      { subtypeCode: 'RSS', aggregationPeriod: 'monthly', releaseTriggerType: 'period_end' },
    ],
  },
  RSM: {
    description: 'Resale / marketplace agreement — reseller incentives on closed business.',
    partyRoleSlots: { obligor: 'Brand', beneficiary: 'Reseller' },
    accrualPolicies: [
      { subtypeCode: 'RA', aggregationPeriod: 'monthly', releaseTriggerType: 'period_end' },
    ],
  },
  OEM: {
    description: 'OEM / white-label agreement — royalty + minimums on integrated units.',
    partyRoleSlots: { obligor: 'OEM Partner', beneficiary: 'IP Owner' },
    accrualPolicies: [
      { subtypeCode: 'ROY', aggregationPeriod: 'quarterly', releaseTriggerType: 'period_end' },
    ],
  },
};

// ---------------------------------------------------------------------------

export async function seedSystemContractTemplates(): Promise<void> {
  // Only seed templates for ACTIVE flow types — an admin who deactivates a
  // flow expects new system templates to stop being materialized for it on
  // the next boot, otherwise the seeder drifts away from the "6 active flow
  // templates" matrix-driven contract.
  const allFlows = await db.select().from(flowTypes).where(eq(flowTypes.isActive, true));
  // The matrix table has no is_active column today; if one is added later,
  // filter here too.
  const matrix = await db.select().from(flowSubtypeValidity);
  // subtypes.is_active filters out retired subtypes so we don't seed rules
  // for codes the picker has stopped showing.
  const allSubtypes = await db.select().from(subtypes).where(eq(subtypes.isActive, true));
  const subtypeByCode = new Map(allSubtypes.map((s) => [s.code, s]));

  let createdTemplates = 0;
  let createdRules = 0;
  let createdClauses = 0;

  for (const flow of allFlows) {
    const defaults = FLOW_DEFAULTS[flow.code] ?? {
      description: flow.name,
      partyRoleSlots: {},
      accrualPolicies: [],
    };

    // Find or create the system template for this flow.
    const existing = await db
      .select()
      .from(contractTemplates)
      .where(and(eq(contractTemplates.flowTypeCode, flow.code), eq(contractTemplates.isSystem, true)))
      .limit(1);

    let templateId: string;
    if (existing.length === 0) {
      const inserted = await db
        .insert(contractTemplates)
        .values({
          flowTypeCode: flow.code,
          name: flow.name,
          description: defaults.description,
          isSystem: true,
          visibility: 'public',
          snapshotScope: 'standard',
          partyRoleSlots: defaults.partyRoleSlots,
          accrualPolicies: defaults.accrualPolicies,
          isActive: true,
        })
        .returning({ id: contractTemplates.id });
      templateId = inserted[0].id;
      createdTemplates += 1;
    } else {
      templateId = existing[0].id;
    }

    // For each valid (flow, subtype) pair, ensure a sample rule + clause exists.
    const pairs = matrix.filter((m) => m.flowTypeCode === flow.code);
    for (const pair of pairs) {
      const blueprint = SUBTYPE_BLUEPRINTS[pair.subtypeCode];
      if (!blueprint) continue;
      const subtypeName = subtypeByCode.get(pair.subtypeCode)?.name ?? pair.subtypeCode;

      // Idempotent check by (template, subtype, rule_type).
      const ruleExists = await db
        .select({ id: templateRules.id })
        .from(templateRules)
        .where(
          and(
            eq(templateRules.templateId, templateId),
            eq(templateRules.subtypeCode, pair.subtypeCode),
            eq(templateRules.ruleType, blueprint.ruleType),
          ),
        )
        .limit(1);

      if (ruleExists.length === 0) {
        await db.insert(templateRules).values({
          templateId,
          subtypeCode: pair.subtypeCode,
          ruleName: `${subtypeName} — ${blueprint.ruleNameSuffix}`,
          description: blueprint.description,
          ruleType: blueprint.ruleType,
          isPrimary: pair.isPrimary,
          payload: blueprint.payload,
          sortOrder: pair.isPrimary ? 0 : 10,
        });
        createdRules += 1;
      }

      const clauseExists = await db
        .select({ id: templateClauses.id })
        .from(templateClauses)
        .where(
          and(
            eq(templateClauses.templateId, templateId),
            eq(templateClauses.subtypeCode, pair.subtypeCode),
          ),
        )
        .limit(1);

      if (clauseExists.length === 0) {
        await db.insert(templateClauses).values({
          templateId,
          subtypeCode: pair.subtypeCode,
          text: blueprint.clauseText,
          clauseCategoryCode: blueprint.clauseCategory,
          isPrimary: pair.isPrimary,
          sortOrder: pair.isPrimary ? 0 : 10,
        });
        createdClauses += 1;
      }
    }
  }

  if (createdTemplates || createdRules || createdClauses) {
    console.log(
      `📋 [TemplateSeeder] System templates synced: +${createdTemplates} templates, +${createdRules} rules, +${createdClauses} clauses`,
    );
  }
}
