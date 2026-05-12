import { db } from '../db';
import { sql } from 'drizzle-orm';

const SAMPLE_ROYALTY_ID = 'SAMPLE-ROYALTY-2026';
const SAMPLE_REBATE_ID = 'SAMPLE-REBATE-2026';

export async function createSampleContracts(companyId: string, userId: string) {
  const results: any[] = [];

  const existingRoyalty = await db.execute(sql`SELECT id FROM contracts WHERE id = ${SAMPLE_ROYALTY_ID}`);
  if (existingRoyalty.rows.length === 0) {
    await createRoyaltyContract(companyId, userId);
    results.push({ id: SAMPLE_ROYALTY_ID, type: 'contract fee', status: 'created' });
  } else {
    results.push({ id: SAMPLE_ROYALTY_ID, type: 'contract fee', status: 'already_exists' });
  }

  const existingRebate = await db.execute(sql`SELECT id FROM contracts WHERE id = ${SAMPLE_REBATE_ID}`);
  if (existingRebate.rows.length === 0) {
    await createRebateContract(companyId, userId);
    results.push({ id: SAMPLE_REBATE_ID, type: 'rebate', status: 'created' });
  } else {
    results.push({ id: SAMPLE_REBATE_ID, type: 'rebate', status: 'already_exists' });
  }

  return results;
}

async function createRoyaltyContract(companyId: string, userId: string) {
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path, display_name, contract_number, contract_type, status, 
      organization_name, counterparty_name, effective_start, effective_end, company_id, uploaded_by, 
      raw_text, created_at, updated_at)
    VALUES (
      ${SAMPLE_ROYALTY_ID},
      'Sample_Royalty_Agreement.pdf',
      'Sample_Royalty_Agreement.pdf',
      ${ROYALTY_CONTRACT_TEXT.length},
      'application/pdf',
      'samples/Sample_Royalty_Agreement.pdf',
      'GlobalTech Software Fee Agreement 2026',
      'ROY-2026-SAMPLE',
      'royalty_agreement',
      'analyzed',
      'CimpleIT Inc.',
      'GlobalTech Software Corp.',
      '2026-01-01',
      '2028-12-31',
      ${companyId},
      ${userId},
      ${ROYALTY_CONTRACT_TEXT},
      NOW(), NOW()
    )
  `);

  await db.execute(sql`
    INSERT INTO contract_analysis (contract_id, summary, key_terms, risk_analysis, insights, confidence, created_at)
    VALUES (
      ${SAMPLE_ROYALTY_ID},
      ${'This is a 3-year software fee agreement between CimpleIT Inc. (Licensor) and GlobalTech Software Corp. (Licensee). GlobalTech is granted a non-exclusive license to distribute CimpleIT\'s software products across North America, Europe, and Asia Pacific. The agreement includes tiered fee rates based on quarterly net revenue, with rates ranging from 8% for revenue up to $500K down to 4% for revenue exceeding $2M. A quarterly minimum guarantee of $75,000 applies. International territories carry a 15% premium. The agreement includes seasonal adjustments with Q4 having a 1.5x multiplier for holiday sales.'},
      ${JSON.stringify({
        parties: ['CimpleIT Inc. (Licensor)', 'GlobalTech Software Corp. (Licensee)'],
        territory: ['North America', 'European Union', 'Asia Pacific'],
        duration: '3 years (Jan 2026 - Dec 2028)',
        paymentTerms: 'Net 45 days after quarter end',
        renewalTerms: 'Auto-renewal for 1-year periods unless 90-day notice given',
        exclusivity: 'Non-exclusive license',
        products: ['CimpleIT Enterprise Suite', 'CimpleIT Analytics Pro', 'CimpleIT Cloud Platform', 'CimpleIT Mobile SDK']
      })},
      ${JSON.stringify({
        overallRisk: 'Medium',
        riskFactors: [
          { category: 'Revenue Risk', level: 'Low', description: 'Minimum guarantee provides revenue floor' },
          { category: 'Territory Risk', level: 'Medium', description: 'Multi-region distribution with varying market conditions' },
          { category: 'Auto-Renewal Risk', level: 'Medium', description: 'Auto-renewal clause requires monitoring for timely notice' },
          { category: 'Currency Risk', level: 'High', description: 'International territories expose to FX fluctuations' }
        ]
      })},
      ${JSON.stringify({
        estimatedAnnualValue: '$2.4M - $3.6M based on projected volumes',
        keyObservations: [
          'Tiered rate structure incentivizes higher volumes',
          'Q4 seasonal premium may need monitoring for accuracy',
          'International premium of 15% adds complexity to calculations'
        ]
      })},
      0.92,
      NOW()
    )
  `);

  const contractRules = [
    {
      rule_name: 'Standard Royalty - Tier 1 (Up to $500K)',
      description: 'Base fee rate of 8% on quarterly net revenue up to $500,000',
      rule_type: 'percentage',
      template_code: 'T1',
      base_rate: 8.0,
      product_categories: ['CimpleIT Enterprise Suite', 'CimpleIT Analytics Pro', 'CimpleIT Cloud Platform', 'CimpleIT Mobile SDK'],
      territories: ['North America', 'European Union', 'Asia Pacific'],
      customer_segments: ['Enterprise', 'Mid-Market'],
      volume_tiers: JSON.stringify([{ min: 0, max: 500000, rate: 8.0 }, { min: 500001, max: 1000000, rate: 6.5 }, { min: 1000001, max: 2000000, rate: 5.0 }, { min: 2000001, max: null, rate: 4.0 }]),
      priority: 10,
      clause_category: 'pricing',
      channel: 'all',
      effective_date: '2026-01-01',
      expiry_date: '2028-12-31',
      extraction_order: 1,
      seasonal_adjustments: JSON.stringify({ Q4: 1.5 }),
      territory_premiums: JSON.stringify({ 'European Union': 1.15, 'Asia Pacific': 1.15 }),
      source_text: 'Licensee shall pay Licensor a royalty of 8% of Net Revenue for quarterly revenue up to $500,000, reducing to 6.5% for $500K-$1M, 5% for $1M-$2M, and 4% for revenue exceeding $2M.',
      confidence: 0.95,
    },
    {
      rule_name: 'Quarterly Minimum Guarantee',
      description: 'Minimum quarterly payment of $75,000 regardless of actual sales',
      rule_type: 'minimum_guarantee',
      template_code: 'T2',
      base_rate: null,
      minimum_guarantee: 75000,
      product_categories: ['all'],
      territories: ['North America', 'European Union', 'Asia Pacific'],
      volume_tiers: null,
      priority: 20,
      clause_category: 'payment',
      channel: 'all',
      effective_date: '2026-01-01',
      expiry_date: '2028-12-31',
      extraction_order: 2,
      source_text: 'Licensee guarantees a minimum quarterly payment of $75,000 to Licensor. If calculated royalties fall below this amount, Licensee shall pay the difference.',
      confidence: 0.98,
    },
    {
      rule_name: 'Annual Revenue Cap',
      description: 'Maximum annual fee payment capped at $500,000',
      rule_type: 'cap',
      template_code: 'T4',
      base_rate: 500000,
      product_categories: ['all'],
      territories: ['all'],
      volume_tiers: null,
      priority: 30,
      clause_category: 'pricing',
      channel: 'all',
      effective_date: '2026-01-01',
      expiry_date: '2028-12-31',
      extraction_order: 3,
      source_text: 'Total annual fee payments shall not exceed $500,000 per calendar year.',
      confidence: 0.90,
    },
    {
      rule_name: 'Enterprise Customer Premium',
      description: 'Additional 2% royalty surcharge on Enterprise segment deals over $50,000',
      rule_type: 'percentage',
      template_code: 'T3',
      base_rate: 2.0,
      product_categories: ['CimpleIT Enterprise Suite'],
      territories: ['North America'],
      customer_segments: ['Enterprise'],
      volume_tiers: null,
      priority: 15,
      clause_category: 'pricing',
      channel: 'Direct Sales',
      effective_date: '2026-01-01',
      expiry_date: '2028-12-31',
      extraction_order: 4,
      exceptions: JSON.stringify([{ condition: 'Deal size > $50,000', action: 'Apply 2% surcharge' }]),
      source_text: 'For Enterprise segment deals exceeding $50,000 through Direct Sales channel in North America, an additional 2% premium applies.',
      confidence: 0.88,
    },
    {
      rule_name: 'Payment Terms - Net 45',
      description: 'Royalty payments due within 45 days of quarter end',
      rule_type: 'condition',
      template_code: 'T8',
      product_categories: [],
      territories: [],
      volume_tiers: null,
      priority: 50,
      clause_category: 'payment',
      effective_date: '2026-01-01',
      expiry_date: '2028-12-31',
      extraction_order: 5,
      source_text: 'All fee payments are due within 45 days following the end of each calendar quarter. Late payments accrue interest at 1.5% per month.',
      confidence: 0.97,
    },
  ];

  for (const rule of contractRules) {
    const prodArr = `{${(rule.product_categories || []).map((s: string) => `"${s}"`).join(',')}}`;
    const terrArr = `{${(rule.territories || []).map((s: string) => `"${s}"`).join(',')}}`;
    const segArr = `{${((rule as any).customer_segments || []).map((s: string) => `"${s}"`).join(',')}}`;
    await db.execute(sql`
      INSERT INTO contract_rules (id, contract_id, rule_name, description, rule_type, template_code, 
        base_rate, product_categories, territories, customer_segments, volume_tiers, priority, 
        clause_category, channel, effective_date, expiry_date, extraction_order, 
        seasonal_adjustments, territory_premiums, exceptions, source_text, confidence,
        is_active, minimum_guarantee, created_at, updated_at)
      VALUES (
        gen_random_uuid(), ${SAMPLE_ROYALTY_ID}, ${rule.rule_name}, ${rule.description}, ${rule.rule_type},
        ${rule.template_code}, ${rule.base_rate ?? null}, ${prodArr}::text[],
        ${terrArr}::text[], ${segArr}::text[],
        ${rule.volume_tiers ?? null}::jsonb, ${rule.priority}, ${rule.clause_category ?? null}, ${rule.channel ?? null},
        ${rule.effective_date ?? null}, ${rule.expiry_date ?? null}, ${rule.extraction_order},
        ${(rule as any).seasonal_adjustments ?? null}::jsonb, ${(rule as any).territory_premiums ?? null}::jsonb,
        ${(rule as any).exceptions ?? null}::jsonb, ${rule.source_text ?? null}, ${rule.confidence ?? null},
        true, ${(rule as any).minimum_guarantee ?? null}, NOW(), NOW()
      )
    `);
  }

  const royaltyTerms = [
    { seq: 1, name: 'License Grant', type: 'data-only', notes: 'Non-exclusive worldwide license to distribute CimpleIT software products' },
    { seq: 2, name: 'Licensed Products', type: 'data-only', notes: 'CimpleIT Enterprise Suite, Analytics Pro, Cloud Platform, Mobile SDK' },
    { seq: 3, name: 'Territory Scope', type: 'data-only', notes: 'North America, European Union, Asia Pacific' },
    { seq: 4, name: 'Standard Fee Rate', type: 'license_fee', rate: 8.0, basis: 'net_revenue', notes: 'Tiered: 8% up to $500K, 6.5% $500K-$1M, 5% $1M-$2M, 4% over $2M' },
    { seq: 5, name: 'Mid-Volume Rate', type: 'license_fee', rate: 6.5, basis: 'net_revenue', min: 500001, max: 1000000 },
    { seq: 6, name: 'High-Volume Rate', type: 'license_fee', rate: 5.0, basis: 'net_revenue', min: 1000001, max: 2000000 },
    { seq: 7, name: 'Maximum Volume Rate', type: 'license_fee', rate: 4.0, basis: 'net_revenue', min: 2000001 },
    { seq: 8, name: 'Quarterly Minimum Guarantee', type: 'minimum_guarantee', rate: 75000, notes: 'Minimum $75,000 per quarter regardless of sales' },
    { seq: 9, name: 'International Premium', type: 'adjustment', rate: 1.15, notes: '15% premium on EU and APAC territories' },
    { seq: 10, name: 'Q4 Seasonal Adjustment', type: 'adjustment', rate: 1.5, notes: 'Holiday season multiplier for Q4' },
    { seq: 11, name: 'Annual Cap', type: 'condition', notes: 'Total annual royalties capped at $500,000' },
    { seq: 12, name: 'Payment Terms', type: 'condition', notes: 'Net 45 days after quarter end, 1.5% monthly late fee' },
    { seq: 13, name: 'Reporting Requirements', type: 'condition', notes: 'Quarterly sales reports due within 30 days of quarter end' },
    { seq: 14, name: 'Audit Rights', type: 'condition', notes: 'Licensor may audit Licensee records once per calendar year with 30-day notice' },
  ];

  for (const term of royaltyTerms) {
    await db.execute(sql`
      INSERT INTO contract_terms (term_id, contract_id, term_sequence, term_name, term_type, calculation_basis, 
        rate_value, tier_min, tier_max, notes)
      VALUES (gen_random_uuid(), ${SAMPLE_ROYALTY_ID}, ${term.seq}, ${term.name}, ${term.type}, ${(term as any).basis ?? null},
        ${term.rate ?? null}, ${(term as any).min ?? null}, ${(term as any).max ?? null}, ${term.notes ?? null})
    `);
  }

  const royaltyClauses = [
    { text: 'Licensor grants Licensee a non-exclusive, non-transferable license to distribute the Licensed Products in the Territory during the Term.', category: 'scope', flow: 'recognition' },
    { text: 'Licensee shall pay Licensor a royalty of 8% of Net Revenue for quarterly revenue up to $500,000, 6.5% for revenue between $500,001 and $1,000,000, 5% for revenue between $1,000,001 and $2,000,000, and 4% for revenue exceeding $2,000,000.', category: 'pricing', flow: 'calculation' },
    { text: 'Licensee guarantees a minimum quarterly payment of $75,000 to Licensor. If calculated royalties fall below this amount, Licensee shall pay the difference.', category: 'payment', flow: 'calculation' },
    { text: 'For sales in European Union and Asia Pacific territories, an additional 15% premium shall apply to the base fee rate.', category: 'pricing', flow: 'adjustment' },
    { text: 'During the fourth quarter (October-December), a seasonal adjustment multiplier of 1.5x shall apply to account for holiday season sales patterns.', category: 'pricing', flow: 'adjustment' },
    { text: 'Total annual fee payments shall not exceed $500,000 per calendar year. Any excess shall be credited to the following year.', category: 'pricing', flow: 'calculation' },
    { text: 'All fee payments are due within 45 days following the end of each calendar quarter. Late payments accrue interest at 1.5% per month.', category: 'payment', flow: 'settlement' },
    { text: 'Licensee shall provide detailed quarterly sales reports within 30 days of each quarter end, including product-level revenue, unit counts, and territory breakdowns.', category: 'reporting', flow: 'recognition' },
  ];

  for (const clause of royaltyClauses) {
    await db.execute(sql`
      INSERT INTO contract_clauses (contract_id, text, clause_category_code, flow_type_code, confidence, created_at)
      VALUES (${SAMPLE_ROYALTY_ID}, ${clause.text}, ${clause.category}, ${clause.flow}, 0.92, NOW())
    `);
  }

  await createRoyaltySalesData(SAMPLE_ROYALTY_ID, companyId);
}

async function createRebateContract(companyId: string, userId: string) {
  await db.execute(sql`
    INSERT INTO contracts (id, file_name, original_name, file_size, file_type, file_path, display_name, contract_number, contract_type, status, 
      organization_name, counterparty_name, effective_start, effective_end, company_id, uploaded_by, 
      raw_text, created_at, updated_at)
    VALUES (
      ${SAMPLE_REBATE_ID},
      'Sample_Rebate_Agreement.pdf',
      'Sample_Rebate_Agreement.pdf',
      ${REBATE_CONTRACT_TEXT.length},
      'application/pdf',
      'samples/Sample_Rebate_Agreement.pdf',
      'MegaRetail Distribution Rebate Program 2026',
      'REB-2026-SAMPLE',
      'distributor_reseller_program',
      'analyzed',
      'CimpleIT Inc.',
      'MegaRetail Distribution LLC',
      '2026-01-01',
      '2026-12-31',
      ${companyId},
      ${userId},
      ${REBATE_CONTRACT_TEXT},
      NOW(), NOW()
    )
  `);

  await db.execute(sql`
    INSERT INTO contract_analysis (contract_id, summary, key_terms, risk_analysis, insights, confidence, created_at)
    VALUES (
      ${SAMPLE_REBATE_ID},
      ${'This is a 1-year distributor rebate program between CimpleIT Inc. (Vendor) and MegaRetail Distribution LLC (Distributor). MegaRetail earns quarterly volume rebates based on total units purchased, with rates from 3% on first 1,000 units up to 8% on volumes exceeding 10,000 units. A Growth Incentive Bonus of $25,000 applies when quarterly volume exceeds the prior quarter by 20%. Marketing Development Funds of 2% of net purchases are also provided. The program includes product-specific rebate tiers for premium products at enhanced rates.'},
      ${JSON.stringify({
        parties: ['CimpleIT Inc. (Vendor)', 'MegaRetail Distribution LLC (Distributor)'],
        territory: ['United States', 'Canada'],
        duration: '1 year (Jan 2026 - Dec 2026)',
        paymentTerms: 'Net 30 days after quarter end',
        renewalTerms: 'Annual renewal subject to volume targets',
        products: ['CimpleIT Enterprise Suite', 'CimpleIT Analytics Pro', 'CimpleIT Cloud Platform', 'CimpleIT Standard Edition']
      })},
      ${JSON.stringify({
        overallRisk: 'Low',
        riskFactors: [
          { category: 'Volume Risk', level: 'Medium', description: 'Rebate tiers require careful volume tracking' },
          { category: 'Cash Flow Risk', level: 'Low', description: 'Quarterly settlement limits exposure' },
          { category: 'Compliance Risk', level: 'Low', description: 'Standard rebate structure with clear rules' }
        ]
      })},
      ${JSON.stringify({
        estimatedAnnualValue: '$180K - $320K in rebate payouts based on volume projections',
        keyObservations: [
          'Growth bonus incentivizes quarter-over-quarter improvement',
          'Marketing fund provides additional value beyond rebates',
          'Premium product tiers offer higher margins for strategic products'
        ]
      })},
      0.94,
      NOW()
    )
  `);

  const rebateRules = [
    {
      rule_name: 'Volume Rebate - Tiered by Units',
      description: 'Quarterly rebate based on total units purchased across all products',
      rule_type: 'tiered',
      template_code: 'T3',
      base_rate: null,
      product_categories: ['CimpleIT Enterprise Suite', 'CimpleIT Analytics Pro', 'CimpleIT Cloud Platform', 'CimpleIT Standard Edition'],
      territories: ['United States', 'Canada'],
      customer_segments: ['Distributor'],
      volume_tiers: JSON.stringify([
        { min: 0, max: 1000, rate: 3.0 },
        { min: 1001, max: 5000, rate: 5.0 },
        { min: 5001, max: 10000, rate: 6.5 },
        { min: 10001, max: null, rate: 8.0 }
      ]),
      priority: 10,
      clause_category: 'pricing',
      channel: 'Distributor',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 1,
      source_text: 'Distributor earns quarterly rebates: 3% on first 1,000 units, 5% on units 1,001-5,000, 6.5% on units 5,001-10,000, and 8% on units exceeding 10,000.',
      confidence: 0.96,
    },
    {
      rule_name: 'Growth Incentive Bonus',
      description: '$25,000 bonus when quarterly volume exceeds prior quarter by 20% or more',
      rule_type: 'fixed_fee',
      template_code: 'T5',
      base_rate: 25000,
      product_categories: ['all'],
      territories: ['United States', 'Canada'],
      volume_tiers: null,
      priority: 20,
      clause_category: 'pricing',
      channel: 'Distributor',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 2,
      exceptions: JSON.stringify([{ condition: 'Quarterly volume exceeds prior quarter by 20%+', action: 'Award $25,000 growth bonus' }]),
      source_text: 'If Distributor quarterly unit volume exceeds the immediately preceding quarter by 20% or more, a Growth Incentive Bonus of $25,000 shall be awarded.',
      confidence: 0.93,
    },
    {
      rule_name: 'Marketing Development Fund (MDF)',
      description: '2% of net quarterly purchases allocated for marketing activities',
      rule_type: 'percentage',
      template_code: 'T1',
      base_rate: 2.0,
      product_categories: ['all'],
      territories: ['United States', 'Canada'],
      volume_tiers: null,
      priority: 30,
      clause_category: 'marketing',
      channel: 'Distributor',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 3,
      source_text: 'Vendor shall allocate Marketing Development Funds equal to 2% of Distributor net quarterly purchases for co-marketing activities.',
      confidence: 0.91,
    },
    {
      rule_name: 'Premium Product Rebate Enhancement',
      description: 'Additional 1.5% rebate on Enterprise Suite and Analytics Pro products',
      rule_type: 'percentage',
      template_code: 'T3',
      base_rate: 1.5,
      product_categories: ['CimpleIT Enterprise Suite', 'CimpleIT Analytics Pro'],
      territories: ['United States', 'Canada'],
      customer_segments: ['Distributor'],
      volume_tiers: null,
      priority: 15,
      clause_category: 'pricing',
      channel: 'Distributor',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 4,
      source_text: 'For premium products (Enterprise Suite and Analytics Pro), an additional 1.5% rebate enhancement applies on top of the standard volume rebate.',
      confidence: 0.89,
    },
    {
      rule_name: 'Rebate Settlement Terms',
      description: 'Rebate payments issued as credit notes within 30 days of quarter end',
      rule_type: 'condition',
      template_code: 'T8',
      product_categories: [],
      territories: [],
      volume_tiers: null,
      priority: 50,
      clause_category: 'payment',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 5,
      source_text: 'Rebate payments shall be issued as credit notes within 30 days following each calendar quarter end. Credits may be applied to future purchases.',
      confidence: 0.95,
    },
    {
      rule_name: 'Returns & Deductions',
      description: 'Product returns deducted from rebate-eligible volume at original transaction value',
      rule_type: 'deduction',
      template_code: 'T10',
      base_rate: 100,
      product_categories: ['all'],
      territories: ['United States', 'Canada'],
      volume_tiers: null,
      priority: 40,
      clause_category: 'adjustment',
      channel: 'Distributor',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      extraction_order: 6,
      source_text: 'Product returns shall be deducted from rebate-eligible volume at their original transaction value. Defective product returns are excluded from deductions.',
      confidence: 0.92,
    },
  ];

  for (const rule of rebateRules) {
    const prodArr = `{${(rule.product_categories || []).map((s: string) => `"${s}"`).join(',')}}`;
    const terrArr = `{${(rule.territories || []).map((s: string) => `"${s}"`).join(',')}}`;
    const segArr = `{${((rule as any).customer_segments || []).map((s: string) => `"${s}"`).join(',')}}`;
    await db.execute(sql`
      INSERT INTO contract_rules (id, contract_id, rule_name, description, rule_type, template_code,
        base_rate, product_categories, territories, customer_segments, volume_tiers, priority,
        clause_category, channel, effective_date, expiry_date, extraction_order,
        exceptions, source_text, confidence,
        is_active, created_at, updated_at)
      VALUES (
        gen_random_uuid(), ${SAMPLE_REBATE_ID}, ${rule.rule_name}, ${rule.description}, ${rule.rule_type},
        ${rule.template_code}, ${rule.base_rate ?? null}, ${prodArr}::text[],
        ${terrArr}::text[], ${segArr}::text[],
        ${rule.volume_tiers ?? null}::jsonb, ${rule.priority}, ${rule.clause_category ?? null}, ${rule.channel ?? null},
        ${rule.effective_date ?? null}, ${rule.expiry_date ?? null}, ${rule.extraction_order},
        ${(rule as any).exceptions ?? null}::jsonb, ${rule.source_text ?? null}, ${rule.confidence ?? null},
        true, NOW(), NOW()
      )
    `);
  }

  const rebateTerms = [
    { seq: 1, name: 'Program Type', type: 'data-only', notes: 'Distributor volume rebate program with growth incentives' },
    { seq: 2, name: 'Eligible Products', type: 'data-only', notes: 'Enterprise Suite, Analytics Pro, Cloud Platform, Standard Edition' },
    { seq: 3, name: 'Territory', type: 'data-only', notes: 'United States and Canada' },
    { seq: 4, name: 'Volume Rebate Tier 1', type: 'license_fee', rate: 3.0, basis: 'units', max: 1000, notes: '3% on first 1,000 units' },
    { seq: 5, name: 'Volume Rebate Tier 2', type: 'license_fee', rate: 5.0, basis: 'units', min: 1001, max: 5000, notes: '5% on units 1,001-5,000' },
    { seq: 6, name: 'Volume Rebate Tier 3', type: 'license_fee', rate: 6.5, basis: 'units', min: 5001, max: 10000, notes: '6.5% on units 5,001-10,000' },
    { seq: 7, name: 'Volume Rebate Tier 4', type: 'license_fee', rate: 8.0, basis: 'units', min: 10001, notes: '8% on units exceeding 10,000' },
    { seq: 8, name: 'Growth Incentive Bonus', type: 'condition', notes: '$25,000 bonus when QoQ growth exceeds 20%' },
    { seq: 9, name: 'Marketing Development Fund', type: 'license_fee', rate: 2.0, basis: 'net_purchases', notes: '2% of net purchases for co-marketing' },
    { seq: 10, name: 'Premium Product Enhancement', type: 'adjustment', rate: 1.5, notes: 'Additional 1.5% on Enterprise Suite and Analytics Pro' },
    { seq: 11, name: 'Settlement Terms', type: 'condition', notes: 'Credit notes issued within 30 days of quarter end' },
    { seq: 12, name: 'Returns Policy', type: 'condition', notes: 'Returns deducted at original value; defective returns excluded' },
  ];

  for (const term of rebateTerms) {
    await db.execute(sql`
      INSERT INTO contract_terms (term_id, contract_id, term_sequence, term_name, term_type, calculation_basis,
        rate_value, tier_min, tier_max, notes)
      VALUES (gen_random_uuid(), ${SAMPLE_REBATE_ID}, ${term.seq}, ${term.name}, ${term.type}, ${(term as any).basis ?? null},
        ${term.rate ?? null}, ${(term as any).min ?? null}, ${(term as any).max ?? null}, ${term.notes ?? null})
    `);
  }

  const rebateClauses = [
    { text: 'Vendor hereby establishes a Volume Rebate Program for Distributor covering all Licensed Products sold within the Territory during the Program Year.', category: 'scope', flow: 'recognition' },
    { text: 'Distributor earns quarterly rebates based on total units purchased: 3% on first 1,000 units, 5% on units 1,001-5,000, 6.5% on units 5,001-10,000, and 8% on units exceeding 10,000.', category: 'pricing', flow: 'calculation' },
    { text: 'If Distributor quarterly unit volume exceeds the immediately preceding quarter by 20% or more, a Growth Incentive Bonus of $25,000 shall be awarded in addition to standard rebates.', category: 'pricing', flow: 'calculation' },
    { text: 'Vendor shall allocate Marketing Development Funds equal to 2% of Distributor net quarterly purchases for co-marketing activities, subject to prior approval of marketing plans.', category: 'marketing', flow: 'calculation' },
    { text: 'For premium products (Enterprise Suite and Analytics Pro), an additional 1.5% rebate enhancement applies on top of the standard volume rebate tier rates.', category: 'pricing', flow: 'adjustment' },
    { text: 'Rebate payments shall be issued as credit notes within 30 days following each calendar quarter end. Credits may be applied to future purchases or redeemed as cash at Distributor election.', category: 'payment', flow: 'settlement' },
    { text: 'Product returns shall be deducted from rebate-eligible volume at their original transaction value. Defective product returns covered under warranty are excluded from deductions.', category: 'adjustment', flow: 'adjustment' },
  ];

  for (const clause of rebateClauses) {
    await db.execute(sql`
      INSERT INTO contract_clauses (contract_id, text, clause_category_code, flow_type_code, confidence, created_at)
      VALUES (${SAMPLE_REBATE_ID}, ${clause.text}, ${clause.category}, ${clause.flow}, 0.94, NOW())
    `);
  }

  await createRebateSalesData(SAMPLE_REBATE_ID, companyId);
}

async function createRoyaltySalesData(contractId: string, companyId: string) {
  const products = [
    { code: 'CIMP-ENT', name: 'CimpleIT Enterprise Suite', category: 'Enterprise Software' },
    { code: 'CIMP-ANA', name: 'CimpleIT Analytics Pro', category: 'Analytics Software' },
    { code: 'CIMP-CLD', name: 'CimpleIT Cloud Platform', category: 'Cloud Services' },
    { code: 'CIMP-MOB', name: 'CimpleIT Mobile SDK', category: 'Developer Tools' },
  ];
  const territories = ['United States', 'Canada', 'European Union', 'Asia Pacific'];
  const channels = ['Direct Sales', 'Online', 'Distributor'];

  const salesRecords = [];
  for (let month = 1; month <= 3; month++) {
    for (let i = 0; i < 8; i++) {
      const product = products[Math.floor(i / 2) % products.length];
      const territory = territories[i % territories.length];
      const channel = channels[i % channels.length];
      const day = Math.min(1 + i * 3, 28);
      const qty = 10 + Math.floor(Math.random() * 50);
      const unitPrice = product.code === 'CIMP-ENT' ? 2500 : product.code === 'CIMP-ANA' ? 1800 : product.code === 'CIMP-CLD' ? 1200 : 800;
      const gross = qty * unitPrice;
      const net = Math.round(gross * 0.92);

      salesRecords.push({
        date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        txnId: `ROY-TXN-${month}${String(i + 1).padStart(3, '0')}`,
        product,
        territory,
        channel,
        qty,
        unitPrice,
        gross,
        net,
      });
    }
  }

  for (const sale of salesRecords) {
    await db.execute(sql`
      INSERT INTO sales_data (matched_contract_id, transaction_date, transaction_id, product_code, product_name,
        category, territory, channel, quantity, unit_price, gross_amount, net_amount, company_id, created_at)
      VALUES (${contractId}, ${sale.date}, ${sale.txnId}, ${sale.product.code}, ${sale.product.name},
        ${sale.product.category}, ${sale.territory}, ${sale.channel}, ${sale.qty}, ${sale.unitPrice},
        ${sale.gross}, ${sale.net}, ${companyId}, NOW())
    `);
  }
}

async function createRebateSalesData(contractId: string, companyId: string) {
  const products = [
    { code: 'CIMP-ENT', name: 'CimpleIT Enterprise Suite', category: 'Enterprise Software' },
    { code: 'CIMP-ANA', name: 'CimpleIT Analytics Pro', category: 'Analytics Software' },
    { code: 'CIMP-CLD', name: 'CimpleIT Cloud Platform', category: 'Cloud Services' },
    { code: 'CIMP-STD', name: 'CimpleIT Standard Edition', category: 'Standard Software' },
  ];
  const territories = ['United States', 'Canada'];
  const channel = 'Distributor';

  const salesRecords = [];
  for (let month = 1; month <= 3; month++) {
    for (let i = 0; i < 10; i++) {
      const product = products[i % products.length];
      const territory = territories[i % territories.length];
      const day = Math.min(1 + i * 2, 28);
      const qty = 50 + Math.floor(Math.random() * 200);
      const unitPrice = product.code === 'CIMP-ENT' ? 2500 : product.code === 'CIMP-ANA' ? 1800 : product.code === 'CIMP-CLD' ? 1200 : 600;
      const gross = qty * unitPrice;
      const net = Math.round(gross * 0.95);

      salesRecords.push({
        date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        txnId: `REB-TXN-${month}${String(i + 1).padStart(3, '0')}`,
        product,
        territory,
        channel,
        qty,
        unitPrice,
        gross,
        net,
        customerCode: 'MEGARETAIL-001',
      });
    }
  }

  for (const sale of salesRecords) {
    await db.execute(sql`
      INSERT INTO sales_data (matched_contract_id, transaction_date, transaction_id, product_code, product_name,
        category, territory, channel, quantity, unit_price, gross_amount, net_amount, company_id, 
        customer_code, created_at)
      VALUES (${contractId}, ${sale.date}, ${sale.txnId}, ${sale.product.code}, ${sale.product.name},
        ${sale.product.category}, ${sale.territory}, ${sale.channel}, ${sale.qty}, ${sale.unitPrice},
        ${sale.gross}, ${sale.net}, ${companyId}, ${sale.customerCode}, NOW())
    `);
  }
}

export async function deleteSampleContracts() {
  for (const contractId of [SAMPLE_ROYALTY_ID, SAMPLE_REBATE_ID]) {
    await db.execute(sql`DELETE FROM sales_data WHERE matched_contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM contract_clauses WHERE contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM contract_terms WHERE contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM contract_rules WHERE contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM contract_analysis WHERE contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM extraction_stage_results WHERE extraction_run_id IN (SELECT id FROM extraction_runs WHERE contract_id = ${contractId})`);
    await db.execute(sql`DELETE FROM extraction_runs WHERE contract_id = ${contractId}`);
    await db.execute(sql`DELETE FROM contracts WHERE id = ${contractId}`);
  }
  return { deleted: [SAMPLE_ROYALTY_ID, SAMPLE_REBATE_ID] };
}

const ROYALTY_CONTRACT_TEXT = `SOFTWARE ROYALTY AGREEMENT

This Software Fee Agreement ("Agreement") is entered into as of January 1, 2026, by and between:

LICENSOR: CimpleIT Inc., a Delaware corporation ("CimpleIT")
LICENSEE: GlobalTech Software Corp., a California corporation ("GlobalTech")

ARTICLE 1 - LICENSE GRANT
CimpleIT grants GlobalTech a non-exclusive, non-transferable license to distribute the Licensed Products (CimpleIT Enterprise Suite, CimpleIT Analytics Pro, CimpleIT Cloud Platform, and CimpleIT Mobile SDK) in the Territory (North America, European Union, and Asia Pacific) during the Term.

ARTICLE 2 - TERM
This Agreement is effective from January 1, 2026 through December 31, 2028, with automatic renewal for successive 1-year periods unless either party provides 90 days written notice.

ARTICLE 3 - ROYALTY PAYMENTS
3.1 Standard Fee Rate: Licensee shall pay Licensor a fee based on quarterly Net Revenue:
  - Up to $500,000: 8% of Net Revenue
  - $500,001 - $1,000,000: 6.5% of Net Revenue
  - $1,000,001 - $2,000,000: 5% of Net Revenue
  - Over $2,000,000: 4% of Net Revenue

3.2 Minimum Guarantee: Licensee guarantees a minimum quarterly payment of $75,000. If calculated royalties fall below this amount, Licensee shall pay the difference.

3.3 Annual Cap: Total annual fee payments shall not exceed $500,000 per calendar year.

3.4 International Premium: For sales in European Union and Asia Pacific territories, a 15% premium applies to the base fee rate.

3.5 Seasonal Adjustment: During Q4 (October-December), a 1.5x multiplier applies to fee calculations.

3.6 Enterprise Premium: For Enterprise segment deals exceeding $50,000 through Direct Sales in North America, an additional 2% premium applies.

ARTICLE 4 - PAYMENT TERMS
All fee payments are due within 45 days following the end of each calendar quarter. Late payments accrue interest at 1.5% per month.

ARTICLE 5 - REPORTING
Licensee shall provide detailed quarterly sales reports within 30 days of each quarter end.

ARTICLE 6 - AUDIT RIGHTS
Licensor may audit Licensee records once per calendar year with 30-day written notice.`;

const REBATE_CONTRACT_TEXT = `DISTRIBUTOR REBATE PROGRAM AGREEMENT

This Distributor Rebate Program Agreement ("Agreement") is entered into as of January 1, 2026, by and between:

VENDOR: CimpleIT Inc., a Delaware corporation ("CimpleIT")
DISTRIBUTOR: MegaRetail Distribution LLC, a New York limited liability company ("MegaRetail")

ARTICLE 1 - PROGRAM SCOPE
CimpleIT establishes a Volume Rebate Program for MegaRetail covering all Licensed Products (CimpleIT Enterprise Suite, CimpleIT Analytics Pro, CimpleIT Cloud Platform, CimpleIT Standard Edition) sold within the Territory (United States and Canada) during the Program Year (January 1, 2026 - December 31, 2026).

ARTICLE 2 - VOLUME REBATE TIERS
2.1 Quarterly Volume Rebates: Based on total units purchased:
  - 0 - 1,000 units: 3% rebate
  - 1,001 - 5,000 units: 5% rebate
  - 5,001 - 10,000 units: 6.5% rebate
  - Over 10,000 units: 8% rebate

2.2 Growth Incentive Bonus: If quarterly unit volume exceeds the prior quarter by 20% or more, a Growth Incentive Bonus of $25,000 shall be awarded.

ARTICLE 3 - MARKETING DEVELOPMENT FUND
Vendor allocates Marketing Development Funds equal to 2% of Distributor net quarterly purchases for co-marketing activities, subject to prior approval.

ARTICLE 4 - PREMIUM PRODUCT ENHANCEMENT
For premium products (Enterprise Suite and Analytics Pro), an additional 1.5% rebate enhancement applies on top of standard volume rebate tiers.

ARTICLE 5 - SETTLEMENT
Rebate payments shall be issued as credit notes within 30 days following each calendar quarter end.

ARTICLE 6 - RETURNS & DEDUCTIONS
Product returns are deducted from rebate-eligible volume at original transaction value. Defective returns under warranty are excluded.`;
