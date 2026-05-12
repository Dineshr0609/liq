import { db } from './db';
import {
  contracts,
  contractRules,
  salesData,
  pendingTermMappings,
  contractAnalysis,
  contractCalculations,
  companies,
  businessUnits,
  locations,
  users,
} from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const TS_COMPANY_NAME = 'TechSound Audio Inc.';

const REBATE_CONTRACT_ID = 'mvp-rebate-dra-tsa-nd-2026';
const ROYALTY_CONTRACT_ID = 'mvp-royalty-rla-tsa-atm-2026';

export async function seedMVPDemo() {
  console.log('🌱 Seeding MVP Demo Contracts (Rebate + Royalty)...');

  try {
    const existing = await db.select().from(contracts).where(eq(contracts.id, REBATE_CONTRACT_ID)).limit(1);
    if (existing.length > 0) {
      if (!existing[0].companyId) {
        const tsCompanyFix = await db.select().from(companies).where(eq(companies.companyName, TS_COMPANY_NAME)).limit(1);
        if (tsCompanyFix.length > 0) {
          const cid = tsCompanyFix[0].id;
          const tsBUFix = await db.select().from(businessUnits).where(eq(businessUnits.companyId, cid)).limit(1);
          const tsLocFix = await db.select().from(locations).where(eq(locations.companyId, cid)).limit(1);
          await db.update(contracts)
            .set({
              companyId: cid,
              businessUnitId: tsBUFix.length > 0 ? tsBUFix[0].id : null,
              locationId: tsLocFix.length > 0 ? tsLocFix[0].id : null,
            })
            .where(sql`id IN (${REBATE_CONTRACT_ID}, ${ROYALTY_CONTRACT_ID})`);
          console.log('✓ MVP Demo contracts fixed: added company_id, business_unit_id, location_id');
        }
      } else {
        console.log('✓ MVP Demo contracts already seeded');
      }
      return;
    }

    const tsCompany = await db.select().from(companies).where(eq(companies.companyName, TS_COMPANY_NAME)).limit(1);
    if (tsCompany.length === 0) {
      console.log('⚠ TechSound Audio Inc. not found, skipping MVP demo');
      return;
    }
    const companyId = tsCompany[0].id;

    const tsBU = await db.select().from(businessUnits).where(eq(businessUnits.companyId, companyId)).limit(1);
    const tsLoc = await db.select().from(locations).where(eq(locations.companyId, companyId)).limit(1);
    const adminUser = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);

    const buId = tsBU.length > 0 ? tsBU[0].id : null;
    const locId = tsLoc.length > 0 ? tsLoc[0].id : null;
    const adminId = adminUser.length > 0 ? adminUser[0].id : null;

    await db.insert(contracts).values([
      {
        id: REBATE_CONTRACT_ID,
        fileName: 'MVP_Distributor_Rebate_Agreement_TechSound.pdf',
        originalName: 'MVP_Distributor_Rebate_Agreement_TechSound.pdf',
        displayName: 'MVP Distributor Rebate Agreement - TechSound',
        fileSize: 12000,
        fileType: 'application/pdf',
        filePath: 'attached_assets/MVP_Distributor_Rebate_Agreement_TechSound_1773260188210.pdf',
        contractType: 'channel_incentive',
        status: 'analyzed',
        uploadedBy: adminId,
        companyId,
        businessUnitId: buId,
        locationId: locId,
        contractNumber: 'DRA-TSA-ND-2026',
        effectiveStart: new Date('2026-01-01'),
        effectiveEnd: new Date('2028-12-31'),
        counterpartyName: 'National Distributor',
        organizationName: 'Tech Sound Audio',
        rawText: `National Distributor Volume Rebate Agreement

1. Parties - Tech Sound Audio ("Manufacturer") and National Distributor ("Distributor")
2. Agreement Type - Contract Type: Rebate, Contract Category: Channel Incentive
3. Effective Dates - January 1, 2026, Term: 3 years
4. Territory - United States (USD), Canada (CAD), Mexico (MXN)
5. Eligible Products - SoundPro Wireless Headphones (Black/White/Silver), PremiumSound Max (Black/White), EssentialSound Wireless (Black/White), Studio Wired Pro (Black)
6. Rebate Structure - Tier 1: 0-1000 units = 2%, Tier 2: 1001-5000 units = 5%, Tier 3: 5001+ units = 8%. Rebate percentage applies to Net Sales.
7. Calculation Period - Quarterly
8. Eligible Sales - Distributor purchases within territory. Excluded: Returns, Warranty replacements, Promotional samples.
9. Reporting - Quarterly: SKU, Units Sold, Net Sales Amount, Territory
10. Rebate Payment - Within 30 days after quarter end.
11. Adjustments - Returns/credits after quarter close adjust calculation. Overpaid rebates offset against future.
12. Termination - Earned but unpaid rebates paid within 30 days.`,
      },
      {
        id: ROYALTY_CONTRACT_ID,
        fileName: 'MVP_Royalty_License_Agreement_TechSound.pdf',
        originalName: 'MVP_Royalty_License_Agreement_TechSound.pdf',
        displayName: 'MVP Royalty License Agreement - TechSound',
        fileSize: 10000,
        fileType: 'application/pdf',
        filePath: 'attached_assets/MVP_Royalty_License_Agreement_TechSound_1773260188210.pdf',
        contractType: 'licensing_royalty',
        status: 'analyzed',
        uploadedBy: adminId,
        companyId,
        businessUnitId: buId,
        locationId: locId,
        contractNumber: 'RLA-TSA-ATM-2026',
        effectiveStart: new Date('2026-01-01'),
        effectiveEnd: new Date('2030-12-31'),
        counterpartyName: 'AudioTech Manufacturing',
        organizationName: 'Tech Sound Audio',
        rawText: `Product Technology Fee License Agreement

1. Parties - Tech Sound Audio ("Licensor") and AudioTech Manufacturing ("Licensee")
2. Agreement Type - Contract Type: Royalty, Contract Category: Licensing Agreement
3. Effective Dates - January 1, 2026, Term: 5 years
4. Licensed Technology - Audio signal processing technology
5. Licensed Products - SoundPro Wireless Headphones (Pro Series), PremiumSound Max (Premium Series), EssentialSound Wireless (Essential Series)
6. Fee Structure - 5% of Net Sales
7. Minimum Fee Guarantee - $100,000 annual minimum. If calculated royalties fall below, Licensee pays the difference.
8. Reporting - Quarterly: Product SKU, Units Sold, Net Sales Amount, Calculated Fee
9. Fee Payment - Within 30 days after each quarter end.
10. Audit Rights - Once per year.
11. Termination - All outstanding royalties paid within 30 days.`,
      },
    ]);
    console.log('  ✓ 2 MVP contracts created');

    await db.insert(contractAnalysis).values([
      {
        contractId: REBATE_CONTRACT_ID,
        summary: 'National Distributor Volume Rebate Agreement between Tech Sound Audio and National Distributor. Quarterly volume-based rebate on eligible products across US, Canada, and Mexico. Three-tier structure: 2% (0-1000 units), 5% (1001-5000 units), 8% (5001+ units) applied to Net Sales.',
        keyTerms: {
          licensor: 'Tech Sound Audio',
          licensee: 'National Distributor',
          territory: 'United States, Canada, Mexico',
          paymentTerms: 'quarterly',
          agreementType: 'Rebate',
          contractValue: '2%, 5%, 8% rebate tiers',
          effectiveDate: '2026-01-01',
        },
        riskAssessment: { overallRisk: 'low', factors: [] },
        complianceNotes: 'Standard rebate agreement with clear tier structure.',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        summary: 'Product Technology Fee License Agreement between Tech Sound Audio (Licensor) and AudioTech Manufacturing (Licensee). Flat 5% royalty on Net Sales of licensed headphone products with $100,000 annual minimum guarantee and true-up provision.',
        keyTerms: {
          licensor: 'Tech Sound Audio',
          licensee: 'AudioTech Manufacturing',
          territory: 'United States, Canada, Mexico',
          paymentTerms: 'quarterly',
          agreementType: 'Royalty License',
          contractValue: '5% of Net Sales',
          effectiveDate: '2026-01-01',
        },
        riskAssessment: { overallRisk: 'low', factors: [] },
        complianceNotes: 'Standard royalty license with annual minimum guarantee.',
      },
    ]);
    console.log('  ✓ Contract analysis records created');

    const rebateRuleValues = [
      {
        contractId: REBATE_CONTRACT_ID,
        ruleName: 'Quarterly Volume Rebate - Tiered by Units',
        ruleType: 'tiered',
        description: 'Quarterly volume rebate calculated as percentage of net sales, with tier determined by total eligible units purchased during the quarter.',
        baseRate: '0.02',
        baseMetric: 'net_sales',
        volumeTiers: [
          { min: 0, max: 1000, rate: 0.02 },
          { min: 1001, max: 5000, rate: 0.05 },
          { min: 5001, max: null, rate: 0.08 },
        ],
        territories: ['United States', 'Canada', 'Mexico'],
        productCategories: ['SoundPro Wireless Headphones', 'PremiumSound Max', 'EssentialSound Wireless', 'Studio Wired Pro'],
        priority: 10,
        isActive: true,
        confidence: '0.95',
        reviewStatus: 'confirmed',
        templateCode: 'T3',
        executionGroup: 'primary_calculation',
        clauseCategory: 'financial_calculation',
        channel: 'wholesale',
        effectiveDate: new Date('2026-01-01'),
        expiryDate: new Date('2028-12-31'),
        sourceSection: 'Section 6 - Rebate Structure',
        sourceText: 'Tier 1: 0-1,000 units → 2% rebate. Tier 2: 1,001-5,000 units → 5% rebate. Tier 3: 5,001+ units → 8% rebate. Rebate percentage applies to Net Sales for eligible products.',
        extractionOrder: 1,
      },
      {
        contractId: REBATE_CONTRACT_ID,
        ruleName: 'Sales Exclusion - Returns',
        ruleType: 'exclusion',
        description: 'Returned products are excluded from rebate-eligible sales.',
        priority: 20,
        isActive: true,
        reviewStatus: 'confirmed',
        clauseCategory: 'qualification',
        sourceSection: 'Section 8 - Eligible Sales',
        sourceText: 'The following are excluded: Returned products',
        extractionOrder: 2,
      },
      {
        contractId: REBATE_CONTRACT_ID,
        ruleName: 'Sales Exclusion - Warranty',
        ruleType: 'exclusion',
        description: 'Warranty replacement units are excluded from rebate-eligible sales.',
        priority: 20,
        isActive: true,
        reviewStatus: 'confirmed',
        clauseCategory: 'qualification',
        sourceSection: 'Section 8 - Eligible Sales',
        sourceText: 'The following are excluded: Warranty replacements',
        extractionOrder: 3,
      },
      {
        contractId: REBATE_CONTRACT_ID,
        ruleName: 'Sales Exclusion - Samples',
        ruleType: 'exclusion',
        description: 'Promotional sample units are excluded from rebate-eligible sales.',
        priority: 20,
        isActive: true,
        reviewStatus: 'confirmed',
        clauseCategory: 'qualification',
        sourceSection: 'Section 8 - Eligible Sales',
        sourceText: 'The following are excluded: Promotional sample units',
        extractionOrder: 4,
      },
      {
        contractId: REBATE_CONTRACT_ID,
        ruleName: 'Rebate Overpayment Offset',
        ruleType: 'adjustment',
        description: 'Any overpaid rebates from returns or credits issued after quarter close will be offset against future rebate payments.',
        priority: 30,
        isActive: true,
        reviewStatus: 'confirmed',
        clauseCategory: 'adjustment',
        sourceSection: 'Section 11 - Adjustments',
        sourceText: 'Returns or credits issued after quarter close may adjust the original rebate calculation. Any overpaid rebates will be offset against future rebates.',
        territories: ['United States', 'Canada', 'Mexico'],
        extractionOrder: 5,
      },
    ];

    const royaltyRuleValues = [
      {
        contractId: ROYALTY_CONTRACT_ID,
        ruleName: 'Fee Rate - 5% of Net Sales',
        ruleType: 'percentage',
        description: 'Flat 5% fee rate applied to Net Sales of all licensed products each quarter.',
        baseRate: '0.05',
        baseMetric: 'net_sales',
        territories: ['United States', 'Canada', 'Mexico'],
        productCategories: ['SoundPro Wireless Headphones', 'PremiumSound Max', 'EssentialSound Wireless'],
        priority: 10,
        isActive: true,
        confidence: '0.98',
        reviewStatus: 'confirmed',
        templateCode: 'T1',
        executionGroup: 'primary_calculation',
        clauseCategory: 'financial_calculation',
        effectiveDate: new Date('2026-01-01'),
        expiryDate: new Date('2030-12-31'),
        sourceSection: 'Section 6 - Fee Structure',
        sourceText: 'Licensee agrees to pay royalties based on Net Sales of licensed products. Fee Rate: 5% of Net Sales.',
        extractionOrder: 1,
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        ruleName: 'Annual Minimum Fee Guarantee',
        ruleType: 'minimum_guarantee',
        description: 'Annual minimum fee of $100,000. If calculated royalties fall below this amount, Licensee pays the difference as a true-up.',
        minimumGuarantee: '100000',
        priority: 5,
        isActive: true,
        confidence: '0.97',
        reviewStatus: 'confirmed',
        templateCode: 'T8',
        executionGroup: 'primary_calculation',
        clauseCategory: 'financial_calculation',
        effectiveDate: new Date('2026-01-01'),
        expiryDate: new Date('2030-12-31'),
        sourceSection: 'Section 7 - Minimum Fee Guarantee',
        sourceText: 'Licensee guarantees a minimum annual fee payment of $100,000. If calculated royalties fall below this amount, Licensee will pay the difference.',
        extractionOrder: 2,
      },
    ];

    for (const rule of [...rebateRuleValues, ...royaltyRuleValues]) {
      await db.insert(contractRules).values(rule as any);
    }
    console.log('  ✓ 7 rules created (5 rebate + 2 royalty)');

    const rebateSales = [
      { date: '2026-01-15', code: 'TS-WH-PRO-001-BLK', name: 'SoundPro Wireless Headphones - Black', qty: 300, net: 76500, territory: 'US', type: 'SALE' },
      { date: '2026-02-10', code: 'TS-WH-PRO-001-WHT', name: 'SoundPro Wireless Headphones - White', qty: 250, net: 63750, territory: 'US', type: 'SALE' },
      { date: '2026-03-05', code: 'TS-WH-ESS-003-BLK', name: 'EssentialSound Wireless - Black', qty: 400, net: 51000, territory: 'CA', type: 'SALE' },
      { date: '2026-03-18', code: 'TS-WD-STD-001-BLK', name: 'Studio Wired Pro - Black', qty: 80, net: 13600, territory: 'US', type: 'RETURN' },
      { date: '2026-03-25', code: 'TS-WH-PRO-001-SLV', name: 'SoundPro Wireless Headphones - Silver', qty: 50, net: 9000, territory: 'MX', type: 'SAMPLE' },
      { date: '2026-04-12', code: 'TS-WH-PRM-002-BLK', name: 'PremiumSound Max - Black', qty: 600, net: 180000, territory: 'US', type: 'SALE' },
      { date: '2026-05-09', code: 'TS-WH-PRM-002-WHT', name: 'PremiumSound Max - White', qty: 500, net: 150000, territory: 'CA', type: 'SALE' },
      { date: '2026-06-02', code: 'TS-WH-ESS-003-WHT', name: 'EssentialSound Wireless - White', qty: 450, net: 57375, territory: 'US', type: 'SALE' },
      { date: '2026-06-20', code: 'TS-WH-PRO-001-BLK', name: 'SoundPro Wireless Headphones - Black', qty: 75, net: 19125, territory: 'MX', type: 'WARRANTY' },
    ];

    const royaltySales = [
      { date: '2026-04-08', code: 'TS-WH-PRO-001-BLK', name: 'SoundPro Wireless Headphones - Black', qty: 800, net: 240000, territory: 'US', reportedRoyalty: 12000 },
      { date: '2026-04-08', code: 'TS-WH-PRM-002-BLK', name: 'PremiumSound Max - Black', qty: 300, net: 135000, territory: 'US', reportedRoyalty: 6750 },
      { date: '2026-07-07', code: 'TS-WH-PRO-001-WHT', name: 'SoundPro Wireless Headphones - White', qty: 900, net: 270000, territory: 'CA', reportedRoyalty: 13500 },
      { date: '2026-07-07', code: 'TS-WH-ESS-003-BLK', name: 'EssentialSound Wireless - Black', qty: 700, net: 105000, territory: 'CA', reportedRoyalty: 5250 },
      { date: '2026-10-06', code: 'TS-WH-PRM-002-WHT', name: 'PremiumSound Max - White', qty: 400, net: 180000, territory: 'US', reportedRoyalty: 9000 },
      { date: '2026-10-06', code: 'TS-WH-ESS-003-WHT', name: 'EssentialSound Wireless - White', qty: 600, net: 90000, territory: 'MX', reportedRoyalty: 4500 },
      { date: '2027-01-08', code: 'TS-WH-PRO-001-SLV', name: 'SoundPro Wireless Headphones - Silver', qty: 1000, net: 300000, territory: 'US', reportedRoyalty: 15000 },
      { date: '2027-01-08', code: 'TS-WH-ESS-003-BLK', name: 'EssentialSound Wireless - Black', qty: 600, net: 90000, territory: 'US', reportedRoyalty: 4500 },
    ];

    const rebateSalesInserts = rebateSales.map((s, i) => ({
      matchedContractId: REBATE_CONTRACT_ID,
      matchConfidence: '1.00',
      transactionDate: new Date(s.date),
      transactionId: `DRA-TSA-ND-2026-${String(i + 1).padStart(3, '0')}`,
      productCode: s.code,
      productName: s.name,
      category: s.type === 'SALE' ? 'eligible' : 'excluded',
      territory: s.territory,
      currency: 'USD',
      grossAmount: String(s.net),
      netAmount: String(s.net),
      quantity: String(s.qty),
      unitPrice: String(Math.round((s.net / s.qty) * 100) / 100),
      customFields: {
        transaction_type: s.type,
        rebate_eligible: s.type === 'SALE',
        exclusion_reason: s.type === 'RETURN' ? 'Returned products' : s.type === 'SAMPLE' ? 'Promotional sample units' : s.type === 'WARRANTY' ? 'Warranty replacements' : null,
        quarter: new Date(s.date).getMonth() < 3 ? '2026-Q1' : '2026-Q2',
        distributor_name: 'National Distributor',
      },
      companyId,
      businessUnitId: buId,
      locationId: locId,
      channel: 'wholesale',
      customerCode: 'National Distributor',
    }));

    const royaltySalesInserts = royaltySales.map((s, i) => ({
      matchedContractId: ROYALTY_CONTRACT_ID,
      matchConfidence: '1.00',
      transactionDate: new Date(s.date),
      transactionId: `RLA-TSA-ATM-2026-${String(i + 1).padStart(3, '0')}`,
      productCode: s.code,
      productName: s.name,
      category: 'licensed_product',
      territory: s.territory,
      currency: 'USD',
      grossAmount: String(s.net),
      netAmount: String(s.net),
      quantity: String(s.qty),
      unitPrice: String(Math.round((s.net / s.qty) * 100) / 100),
      customFields: {
        quarter: (() => {
          const d = new Date(s.date);
          const q = Math.ceil((d.getMonth() + 1) / 3);
          return `${d.getFullYear()}-Q${q}`;
        })(),
        licensee_name: 'AudioTech Manufacturing',
        reported_royalty_amount: s.reportedRoyalty,
      },
      companyId,
      businessUnitId: buId,
      locationId: locId,
      customerCode: 'AudioTech Manufacturing',
    }));

    for (const s of [...rebateSalesInserts, ...royaltySalesInserts]) {
      await db.insert(salesData).values(s as any);
    }
    console.log(`  ✓ ${rebateSalesInserts.length + royaltySalesInserts.length} sales transactions seeded`);

    const termMappings = [
      { contractId: REBATE_CONTRACT_ID, term: 'Net Sales Amount', value: 'net_sales_amount', erpField: 'net_amount', erpEntity: 'Sales Transactions', section: 'Section 6' },
      { contractId: REBATE_CONTRACT_ID, term: 'Product SKU', value: 'sku', erpField: 'product_code', erpEntity: 'Sales Transactions', section: 'Section 5' },
      { contractId: REBATE_CONTRACT_ID, term: 'Territory', value: 'territory_code', erpField: 'territory', erpEntity: 'Sales Transactions', section: 'Section 4' },
      { contractId: REBATE_CONTRACT_ID, term: 'Units Purchased', value: 'units', erpField: 'quantity', erpEntity: 'Sales Transactions', section: 'Section 6' },
      { contractId: REBATE_CONTRACT_ID, term: 'Transaction Type', value: 'transaction_type', erpField: 'category', erpEntity: 'Sales Transactions', section: 'Section 8' },
      { contractId: REBATE_CONTRACT_ID, term: 'Rebate Eligible', value: 'rebate_eligible', erpField: 'custom_fields.rebate_eligible', erpEntity: 'Sales Transactions', section: 'Section 8' },
      { contractId: REBATE_CONTRACT_ID, term: 'Distributor', value: 'National Distributor', erpField: 'customer_code', erpEntity: 'Business Partners', section: 'Section 1' },
      { contractId: REBATE_CONTRACT_ID, term: 'Manufacturer', value: 'Tech Sound Audio', erpField: 'vendor_name', erpEntity: 'Business Partners', section: 'Section 1' },
      { contractId: REBATE_CONTRACT_ID, term: 'Calculation Period', value: 'quarterly', erpField: 'period_type', erpEntity: 'Calculation Config', section: 'Section 7' },
      { contractId: REBATE_CONTRACT_ID, term: 'Payment Terms', value: 'Net 30 days after quarter end', erpField: 'payment_terms', erpEntity: 'AP Invoices', section: 'Section 10' },

      { contractId: ROYALTY_CONTRACT_ID, term: 'Net Sales Amount', value: 'net_sales_amount', erpField: 'net_amount', erpEntity: 'Sales Transactions', section: 'Section 6' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Product SKU', value: 'sku', erpField: 'product_code', erpEntity: 'Sales Transactions', section: 'Section 5' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Territory', value: 'territory_code', erpField: 'territory', erpEntity: 'Sales Transactions', section: 'Section 4' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Units Sold', value: 'units_sold', erpField: 'quantity', erpEntity: 'Sales Transactions', section: 'Section 8' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Reported Royalty', value: 'reported_royalty_amount', erpField: 'custom_fields.reported_royalty_amount', erpEntity: 'Sales Transactions', section: 'Section 8' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Licensor', value: 'Tech Sound Audio', erpField: 'vendor_name', erpEntity: 'Business Partners', section: 'Section 1' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Licensee', value: 'AudioTech Manufacturing', erpField: 'customer_code', erpEntity: 'Business Partners', section: 'Section 1' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Fee Rate', value: '5%', erpField: 'rate_percentage', erpEntity: 'Calculation Config', section: 'Section 6' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Minimum Guarantee', value: '$100,000 annual', erpField: 'minimum_amount', erpEntity: 'Calculation Config', section: 'Section 7' },
      { contractId: ROYALTY_CONTRACT_ID, term: 'Payment Terms', value: 'Net 30 days after quarter end', erpField: 'payment_terms', erpEntity: 'AP Invoices', section: 'Section 9' },
    ];

    for (const m of termMappings) {
      await db.insert(pendingTermMappings).values({
        contractId: m.contractId,
        originalTerm: m.term,
        originalValue: m.value,
        erpFieldName: m.erpField,
        erpEntityName: m.erpEntity,
        confidence: 0.95,
        mappingMethod: 'ai',
        status: 'confirmed',
        companyId,
        sourceSection: m.section,
      } as any);
    }
    console.log(`  ✓ ${termMappings.length} term-to-ERP mappings created`);

    const calcResults = [
      {
        contractId: REBATE_CONTRACT_ID,
        name: 'Q1 2026 Volume Rebate - National Distributor',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
        status: 'approved',
        totalSalesAmount: '191250.00',
        totalRoyalty: '3825.00',
        currency: 'USD',
        salesCount: 3,
        calculationDetails: {
          contract_id: 'DRA-TSA-ND-2026',
          quarter: '2026-Q1',
          eligible_units: 950,
          eligible_net_sales: 191250.00,
          excluded_units: 130,
          excluded_net_sales: 22600.00,
          excluded_transactions: [
            { type: 'RETURN', units: 80, amount: 13600, reason: 'Returned products' },
            { type: 'SAMPLE', units: 50, amount: 9000, reason: 'Promotional sample units' },
          ],
          applicable_tier: 'Tier 1',
          tier_details: { min: 0, max: 1000, rate: 0.02 },
          rebate_rate: '2.0%',
          rebate_amount: 3825.00,
          calculation_formula: '950 eligible units → Tier 1 (0-1,000) → 2% × $191,250 = $3,825.00',
          payment_due_date: '2026-04-30',
          notes: '950 eligible units keeps quarter in Tier 1; return and sample rows excluded.',
          audit_trail: [
            { step: 1, action: 'Filter eligible transactions', detail: 'Excluded 2 transactions (1 RETURN, 1 SAMPLE)', result: '3 eligible, 2 excluded' },
            { step: 2, action: 'Sum eligible units', detail: '300 + 250 + 400 = 950 units', result: '950 units' },
            { step: 3, action: 'Sum eligible net sales', detail: '$76,500 + $63,750 + $51,000 = $191,250', result: '$191,250.00' },
            { step: 4, action: 'Determine tier', detail: '950 units falls in Tier 1 (0-1,000)', result: 'Tier 1 @ 2%' },
            { step: 5, action: 'Calculate rebate', detail: '$191,250 × 2% = $3,825.00', result: '$3,825.00' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: REBATE_CONTRACT_ID,
        name: 'Q2 2026 Volume Rebate - National Distributor',
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-06-30'),
        status: 'approved',
        totalSalesAmount: '387375.00',
        totalRoyalty: '19368.75',
        currency: 'USD',
        salesCount: 3,
        calculationDetails: {
          contract_id: 'DRA-TSA-ND-2026',
          quarter: '2026-Q2',
          eligible_units: 1550,
          eligible_net_sales: 387375.00,
          excluded_units: 75,
          excluded_net_sales: 19125.00,
          excluded_transactions: [
            { type: 'WARRANTY', units: 75, amount: 19125, reason: 'Warranty replacements' },
          ],
          applicable_tier: 'Tier 2',
          tier_details: { min: 1001, max: 5000, rate: 0.05 },
          rebate_rate: '5.0%',
          rebate_amount: 19368.75,
          calculation_formula: '1,550 eligible units → Tier 2 (1,001-5,000) → 5% × $387,375 = $19,368.75',
          payment_due_date: '2026-07-30',
          notes: '1,550 eligible units puts quarter in Tier 2; warranty row excluded.',
          audit_trail: [
            { step: 1, action: 'Filter eligible transactions', detail: 'Excluded 1 transaction (1 WARRANTY)', result: '3 eligible, 1 excluded' },
            { step: 2, action: 'Sum eligible units', detail: '600 + 500 + 450 = 1,550 units', result: '1,550 units' },
            { step: 3, action: 'Sum eligible net sales', detail: '$180,000 + $150,000 + $57,375 = $387,375', result: '$387,375.00' },
            { step: 4, action: 'Determine tier', detail: '1,550 units falls in Tier 2 (1,001-5,000)', result: 'Tier 2 @ 5%' },
            { step: 5, action: 'Calculate rebate', detail: '$387,375 × 5% = $19,368.75', result: '$19,368.75' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        name: 'Q1 2026 Royalty - AudioTech Manufacturing',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
        status: 'approved',
        totalSalesAmount: '375000.00',
        totalRoyalty: '18750.00',
        currency: 'USD',
        salesCount: 2,
        calculationDetails: {
          contract_id: 'RLA-TSA-ATM-2026',
          quarter: '2026-Q1',
          net_sales: 375000.00,
          royalty_rate: '5.0%',
          calculated_fee: 18750.00,
          minimum_guarantee_applies: false,
          minimum_guarantee_amount: 100000.00,
          true_up_amount: 0,
          payment_due_date: '2026-04-30',
          notes: 'Quarterly fee based on reported net sales.',
          line_items: [
            { sku: 'TS-WH-PRO-001-BLK', units: 800, net_sales: 240000, fee: 12000 },
            { sku: 'TS-WH-PRM-002-BLK', units: 300, net_sales: 135000, fee: 6750 },
          ],
          audit_trail: [
            { step: 1, action: 'Sum net sales', detail: '$240,000 + $135,000 = $375,000', result: '$375,000.00' },
            { step: 2, action: 'Apply fee rate', detail: '$375,000 × 5% = $18,750', result: '$18,750.00' },
            { step: 3, action: 'Check minimum guarantee', detail: 'Q1 only - annual check at year end', result: 'Not applicable this quarter' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        name: 'Q2 2026 Royalty - AudioTech Manufacturing',
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-06-30'),
        status: 'approved',
        totalSalesAmount: '375000.00',
        totalRoyalty: '18750.00',
        currency: 'USD',
        salesCount: 2,
        calculationDetails: {
          contract_id: 'RLA-TSA-ATM-2026',
          quarter: '2026-Q2',
          net_sales: 375000.00,
          royalty_rate: '5.0%',
          calculated_fee: 18750.00,
          minimum_guarantee_applies: false,
          minimum_guarantee_amount: 100000.00,
          true_up_amount: 0,
          payment_due_date: '2026-07-30',
          line_items: [
            { sku: 'TS-WH-PRO-001-WHT', units: 900, net_sales: 270000, fee: 13500 },
            { sku: 'TS-WH-ESS-003-BLK', units: 700, net_sales: 105000, fee: 5250 },
          ],
          audit_trail: [
            { step: 1, action: 'Sum net sales', detail: '$270,000 + $105,000 = $375,000', result: '$375,000.00' },
            { step: 2, action: 'Apply fee rate', detail: '$375,000 × 5% = $18,750', result: '$18,750.00' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        name: 'Q3 2026 Royalty - AudioTech Manufacturing',
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-09-30'),
        status: 'approved',
        totalSalesAmount: '270000.00',
        totalRoyalty: '13500.00',
        currency: 'USD',
        salesCount: 2,
        calculationDetails: {
          contract_id: 'RLA-TSA-ATM-2026',
          quarter: '2026-Q3',
          net_sales: 270000.00,
          royalty_rate: '5.0%',
          calculated_fee: 13500.00,
          minimum_guarantee_applies: false,
          minimum_guarantee_amount: 100000.00,
          true_up_amount: 0,
          payment_due_date: '2026-10-30',
          line_items: [
            { sku: 'TS-WH-PRM-002-WHT', units: 400, net_sales: 180000, fee: 9000 },
            { sku: 'TS-WH-ESS-003-WHT', units: 600, net_sales: 90000, fee: 4500 },
          ],
          audit_trail: [
            { step: 1, action: 'Sum net sales', detail: '$180,000 + $90,000 = $270,000', result: '$270,000.00' },
            { step: 2, action: 'Apply fee rate', detail: '$270,000 × 5% = $13,500', result: '$13,500.00' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        name: 'Q4 2026 Royalty - AudioTech Manufacturing',
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-12-31'),
        status: 'approved',
        totalSalesAmount: '390000.00',
        totalRoyalty: '19500.00',
        currency: 'USD',
        salesCount: 2,
        calculationDetails: {
          contract_id: 'RLA-TSA-ATM-2026',
          quarter: '2026-Q4',
          net_sales: 390000.00,
          royalty_rate: '5.0%',
          calculated_fee: 19500.00,
          minimum_guarantee_applies: false,
          minimum_guarantee_amount: 100000.00,
          true_up_amount: 0,
          payment_due_date: '2027-01-30',
          line_items: [
            { sku: 'TS-WH-PRO-001-SLV', units: 1000, net_sales: 300000, fee: 15000 },
            { sku: 'TS-WH-ESS-003-BLK', units: 600, net_sales: 90000, fee: 4500 },
          ],
          audit_trail: [
            { step: 1, action: 'Sum net sales', detail: '$300,000 + $90,000 = $390,000', result: '$390,000.00' },
            { step: 2, action: 'Apply fee rate', detail: '$390,000 × 5% = $19,500', result: '$19,500.00' },
          ],
        },
        evaluationMode: 'universal',
      },
      {
        contractId: ROYALTY_CONTRACT_ID,
        name: '2026 Annual Minimum Guarantee True-Up',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        status: 'approved',
        totalSalesAmount: '1410000.00',
        totalRoyalty: '29500.00',
        currency: 'USD',
        salesCount: 8,
        calculationDetails: {
          contract_id: 'RLA-TSA-ATM-2026',
          period: '2026-Annual',
          annual_net_sales: 1410000.00,
          royalty_rate: '5.0%',
          total_calculated_fee: 70500.00,
          minimum_guarantee_amount: 100000.00,
          minimum_guarantee_applies: true,
          true_up_amount: 29500.00,
          payment_due_date: '2027-01-30',
          notes: 'Annual minimum fee guarantee true-up required because calculated royalties ($70,500) are below $100,000.',
          quarterly_breakdown: [
            { quarter: 'Q1', net_sales: 375000, fee: 18750 },
            { quarter: 'Q2', net_sales: 375000, fee: 18750 },
            { quarter: 'Q3', net_sales: 270000, fee: 13500 },
            { quarter: 'Q4', net_sales: 390000, fee: 19500 },
          ],
          audit_trail: [
            { step: 1, action: 'Sum annual royalties', detail: '$18,750 + $18,750 + $13,500 + $19,500 = $70,500', result: '$70,500.00' },
            { step: 2, action: 'Compare to minimum guarantee', detail: '$70,500 < $100,000 minimum', result: 'True-up required' },
            { step: 3, action: 'Calculate true-up', detail: '$100,000 - $70,500 = $29,500', result: '$29,500.00' },
          ],
        },
        evaluationMode: 'universal',
      },
    ];

    for (const calc of calcResults) {
      await db.insert(contractCalculations).values(calc as any);
    }
    console.log(`  ✓ ${calcResults.length} calculation results seeded`);

    console.log('✅ MVP Demo seeding complete');
    console.log('   - Rebate Contract: DRA-TSA-ND-2026 (Tiered Volume Rebate)');
    console.log('     Q1: 950 units → Tier 1 → 2% × $191,250 = $3,825');
    console.log('     Q2: 1,550 units → Tier 2 → 5% × $387,375 = $19,368.75');
    console.log('   - Royalty Contract: RLA-TSA-ATM-2026 (5% + $100K Min Guarantee)');
    console.log('     Q1-Q4: $70,500 total → True-up: $29,500');

  } catch (error: any) {
    console.error('❌ MVP Demo seeding error:', error.message);
  }
}
