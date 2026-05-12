import { db } from './db';
import {
  flowTypes,
  clauseExecutionGroups,
  ruleTemplates,
  baseMetrics,
  clauseCategories,
} from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function seedPipelineReferenceData() {
  console.log('🌱 Seeding Contract Processing Pipeline Reference Data...');

  try {
    // Canonical flow types (6 codes). Legacy lowercase codes (rebate,
    // royalty, chargeback, mdf, commission, price_protection, revenue_share,
    // contract fee, other) were retired in favor of the uppercase taxonomy
    // below. The seeder also PURGES any legacy lowercase rows it finds, so
    // they cannot creep back in via stale data.
    // Task 68 — `cashDirection` makes flow direction first-class so the
    // Posted-Accrual → Obligation promotion service stops reading direction
    // from prompt text or hardcoded `direction='outbound'` constants. OEM
    // is intentionally 'derived' — those contracts can pay either way and
    // the contract author MUST pin direction explicitly; the promotion
    // service refuses to guess.
    const flowTypesData = [
      { code: 'VRP', name: 'Vendor Rebate Program',         description: 'Inbound rebates received from vendors / suppliers',          cashDirection: 'inbound'  },
      { code: 'CRP', name: 'Customer Rebate Program',       description: 'Outbound rebates paid to customers / channel partners',     cashDirection: 'outbound' },
      { code: 'RLA', name: 'Royalty / Licensing Agreement', description: 'Royalty and intellectual-property licensing payments',      cashDirection: 'outbound' },
      { code: 'SUB', name: 'Subscription Agreement',        description: 'Recurring subscription / SaaS contracts',                   cashDirection: 'outbound' },
      { code: 'RSM', name: 'Resale / Marketplace Agreement', description: 'Distributor, reseller and marketplace agreements',          cashDirection: 'outbound' },
      { code: 'OEM', name: 'OEM / White-Label Agreement',   description: 'OEM, white-label and embedded-component agreements',        cashDirection: 'derived'  },
    ];

    const LEGACY_FLOW_CODES = [
      'rebate', 'royalty', 'contract fee', 'chargeback', 'mdf',
      'commission', 'price_protection', 'revenue_share', 'other',
    ];
    for (const legacy of LEGACY_FLOW_CODES) {
      try { await db.delete(flowTypes).where(eq(flowTypes.code, legacy)); } catch { /* ignore */ }
    }

    let newFlowTypes = 0;
    for (const ft of flowTypesData) {
      const existing = await db.select().from(flowTypes).where(eq(flowTypes.code, ft.code)).limit(1);
      if (existing.length === 0) {
        // `as never` works around drizzle 0.39 truncated insert/update
        // type inference (the inferred shape drops nullable columns).
        await db.insert(flowTypes).values({ ...ft, isActive: true } as never);
        newFlowTypes++;
      } else if (existing[0].cashDirection !== ft.cashDirection) {
        // Existing rows from before Task 68 default to 'derived' — backfill
        // the canonical direction so the promotion service can run without
        // re-seeding from scratch.
        await db.update(flowTypes)
          .set({ cashDirection: ft.cashDirection, updatedAt: new Date() } as never)
          .where(eq(flowTypes.code, ft.code));
      }
    }
    const existingFlowTypes = flowTypesData.length - newFlowTypes;
    console.log(`  ✓ Flow Types: ${newFlowTypes} new, ${existingFlowTypes} existing (legacy lowercase purged)`);

    const executionGroupsData = [
      { code: 'periodic', name: 'Periodic', description: 'Clauses that need to be considered for accrual calculations on a recurring basis' },
      { code: 'adjustment', name: 'Adjustment', description: 'Adjustments applied on top of periodic calculations (caps, floors, true-ups)' },
      { code: 'event', name: 'Event', description: 'Event-based clauses that need calculations but are not part of regular accrual cycles' },
    ];

    let newExecGroups = 0;
    for (const eg of executionGroupsData) {
      const existing = await db.select().from(clauseExecutionGroups).where(eq(clauseExecutionGroups.code, eg.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(clauseExecutionGroups).values(eg);
        newExecGroups++;
      }
    }
    const existingExecGroups = executionGroupsData.length - newExecGroups;
    console.log(`  ✓ Execution Groups: ${newExecGroups} new, ${existingExecGroups} existing`);

    const ruleTemplatesData = [
      {
        templateCode: 'T1',
        name: 'Percentage Revenue',
        executionGroupCode: 'periodic',
        description: 'Percentage-based calculation on a revenue metric (e.g., 5% of net sales)',
        requiredFields: ['base_metric', 'rate_or_amount', 'frequency'],
      },
      {
        templateCode: 'T2',
        name: 'Per Unit',
        executionGroupCode: 'periodic',
        description: 'Fixed amount per unit sold or shipped (e.g., $1.25 per unit)',
        requiredFields: ['rate_or_amount', 'frequency'],
      },
      {
        templateCode: 'T3',
        name: 'Tiered Rate',
        executionGroupCode: 'periodic',
        description: 'Rate varies by volume or revenue tiers (e.g., 3% up to $1M, 5% above)',
        requiredFields: ['base_metric', 'tier_table', 'frequency'],
      },
      {
        templateCode: 'T4',
        name: 'Threshold Trigger',
        executionGroupCode: 'periodic',
        description: 'Payment triggered when a metric crosses a threshold (e.g., bonus at $5M sales)',
        requiredFields: ['base_metric', 'threshold', 'rate_or_amount'],
      },
      {
        templateCode: 'T5',
        name: 'Revenue Split',
        executionGroupCode: 'periodic',
        description: 'Revenue split between parties based on agreed percentages',
        requiredFields: ['base_metric', 'rate_or_amount', 'frequency'],
      },
      {
        templateCode: 'T6',
        name: 'Fixed Amount Payment',
        executionGroupCode: 'periodic',
        description: 'Fixed payment amount on a recurring schedule (e.g., $10,000 monthly)',
        requiredFields: ['rate_or_amount', 'frequency'],
      },
      {
        templateCode: 'T7',
        name: 'Cap',
        executionGroupCode: 'adjustment',
        description: 'Maximum limit on a calculated amount (e.g., rebate capped at $500K annually)',
        requiredFields: ['cap_or_floor'],
      },
      {
        templateCode: 'T8',
        name: 'Floor / Minimum Payout',
        executionGroupCode: 'adjustment',
        description: 'Minimum guaranteed payout regardless of calculated amount',
        requiredFields: ['cap_or_floor'],
      },
      {
        templateCode: 'T9',
        name: 'Minimum Guarantee True-Up',
        executionGroupCode: 'adjustment',
        description: 'True-up calculation to ensure minimum guarantee is met at period end',
        requiredFields: ['cap_or_floor', 'frequency'],
      },
      {
        templateCode: 'T10',
        name: 'Offset / Deduction',
        executionGroupCode: 'adjustment',
        description: 'Offset or deduction applied against calculated amounts (e.g., advance recoupment)',
        requiredFields: ['offset'],
      },
      {
        templateCode: 'T11',
        name: 'Late Payment Interest',
        executionGroupCode: 'event',
        description: 'Interest charged on overdue payments (e.g., 1.5% monthly on outstanding balance)',
        requiredFields: ['rate_or_amount', 'trigger_event', 'grace_period'],
      },
      {
        templateCode: 'T12',
        name: 'Reporting Compliance Penalty',
        executionGroupCode: 'event',
        description: 'Penalty for failure to submit required reports on time',
        requiredFields: ['rate_or_amount', 'trigger_event'],
      },
    ];

    let newTemplates = 0;
    for (const rt of ruleTemplatesData) {
      const existing = await db.select().from(ruleTemplates).where(eq(ruleTemplates.templateCode, rt.templateCode)).limit(1);
      if (existing.length === 0) {
        await db.insert(ruleTemplates).values({
          ...rt,
          requiredFields: rt.requiredFields,
        } as never);
        newTemplates++;
      }
    }
    const existingTemplates = ruleTemplatesData.length - newTemplates;
    console.log(`  ✓ Rule Templates: ${newTemplates} new, ${existingTemplates} existing`);

    const baseMetricsData = [
      { code: 'net_sales', name: 'Net Sales', description: 'Net sales amount after returns and allowances' },
      { code: 'gross_sales', name: 'Gross Sales', description: 'Gross sales amount before deductions' },
      { code: 'margin', name: 'Margin', description: 'Profit margin (revenue minus cost)' },
      { code: 'invoice_amount', name: 'Invoice Amount', description: 'Total invoice amount billed' },
      { code: 'units', name: 'Units', description: 'Quantity of units sold or shipped' },
      { code: 'subscription_revenue', name: 'Subscription Revenue', description: 'Recurring subscription-based revenue' },
      { code: 'outstanding_balance', name: 'Outstanding Balance', description: 'Amount currently owed or outstanding' },
      { code: 'other', name: 'Other', description: 'Other base metric not covered by standard categories' },
    ];

    let newMetrics = 0;
    for (const bm of baseMetricsData) {
      const existing = await db.select().from(baseMetrics).where(eq(baseMetrics.code, bm.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(baseMetrics).values(bm);
        newMetrics++;
      }
    }
    const existingMetrics = baseMetricsData.length - newMetrics;
    console.log(`  ✓ Base Metrics: ${newMetrics} new, ${existingMetrics} existing`);

    const clauseCategoriesData = [
      { code: 'financial_calculation', name: 'Financial Calculation', description: 'Clauses that define how payments, rebates, royalties, or fees are calculated' },
      { code: 'qualification', name: 'Qualification', description: 'Clauses that define eligibility criteria, conditions, or prerequisites for financial terms' },
      { code: 'adjustment', name: 'Adjustment', description: 'Clauses that modify calculated amounts (caps, floors, true-ups, offsets)' },
      { code: 'event_penalty', name: 'Event / Penalty', description: 'Clauses triggered by specific events like late payment, non-compliance, or reporting failures' },
      { code: 'operational', name: 'Operational', description: 'Clauses related to operational requirements like reporting, data submission, or process obligations' },
      { code: 'governance_risk', name: 'Governance / Risk', description: 'Clauses related to governance, risk management, audit rights, and compliance obligations' },
    ];

    let newCategories = 0;
    for (const cc of clauseCategoriesData) {
      const existing = await db.select().from(clauseCategories).where(eq(clauseCategories.code, cc.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(clauseCategories).values(cc);
        newCategories++;
      }
    }
    const existingCategories = clauseCategoriesData.length - newCategories;
    console.log(`  ✓ Clause Categories: ${newCategories} new, ${existingCategories} existing`);

    console.log('✅ Pipeline Reference Data seeding complete');

  } catch (error: any) {
    console.error('⚠ Pipeline Reference Data seeding warning:', error.message);
  }
}
