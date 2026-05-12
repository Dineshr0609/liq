import { db } from '../db';
import { contractTypeDefinitions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface RuleSlot {
  slotId: string;
  slotName: string;
  required: boolean;
  repeatable?: boolean;
  ruleType: string | string[];
  defaultPriority: number;
  description: string;
  extractionHint: string;
  expectedFields: Record<string, {
    type: string;
    required: boolean;
    hint?: string;
    fixedValue?: any;
    requiredIf?: string;
  }>;
  qualifiers: 'none' | {
    required: string[];
    lookupEntity: string;
    matchAgainst: string;
  };
  qualifierNote?: string;
}

export interface RuleSlotValidation {
  check: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface ContractTypeRuleTemplate {
  contractTypeCode: string;
  ruleSlots: RuleSlot[];
  validationRules: RuleSlotValidation[];
}

const DEFAULT_RULE_TEMPLATES: Record<string, ContractTypeRuleTemplate> = {
  distributor_reseller_program: {
    contractTypeCode: 'distributor_reseller_program',
    ruleSlots: [
      {
        slotId: 'general_rebate',
        slotName: 'General Rebate Rate',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Default rebate rate applying to all purchases unless overridden by a more specific rule',
        extractionHint: 'What is the general/default rebate percentage that applies to all purchases? Look for the base or standard rate.',
        expectedFields: {
          base_rate: { type: 'decimal', required: true, hint: 'e.g., 0.04 for 4%' },
          base_metric: { type: 'enum', required: false, hint: 'Usually gross_sales' },
        },
        qualifiers: 'none',
        qualifierNote: 'This is the catch-all rule. No product/territory filters. Specific overrides use higher-priority rules.',
      },
      {
        slotId: 'product_specific_override',
        slotName: 'Product-Specific Rate Override',
        required: false,
        repeatable: true,
        ruleType: ['percentage', 'per_unit'],
        defaultPriority: 2,
        description: 'Different rate or calculation method for specific products or product categories',
        extractionHint: 'Are there products with a different rebate rate or per-unit amount? List each product and its specific rate. IMPORTANT: Put the product name in productCategories array, e.g. productCategories: ["Potatoes"] — do NOT use ["General"].',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          unit_type: { type: 'string', required: false, requiredIf: 'ruleType == per_unit', hint: 'e.g., per case, per pound, per 50lb equivalent' },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'product_hierarchy OR products',
          matchAgainst: 'hierarchy_value, product_name',
        },
      },
      {
        slotId: 'product_exclusion',
        slotName: 'Product Exclusion (No Rebate)',
        required: false,
        repeatable: true,
        ruleType: 'percentage',
        defaultPriority: 3,
        description: 'Products explicitly excluded from any rebate — zero rate override',
        extractionHint: 'Are any products explicitly excluded from rebate? Look for "no rebate on", "excluded", "does not apply to".',
        expectedFields: {
          base_rate: { type: 'decimal', required: true, fixedValue: 0.00, hint: 'Always 0 for exclusions' },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'products',
          matchAgainst: 'product_name, sku',
        },
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Volume-Based Tier Structure',
        required: false,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Rebate rate changes based on purchase volume thresholds',
        extractionHint: 'Does the rebate rate change based on volume? Look for tier tables, graduated scales, or "if purchases exceed $X".',
        expectedFields: {
          tiers: { type: 'array', required: true, hint: 'Array of {min, max, rate} objects' },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'minimum_guarantee',
        slotName: 'Minimum Guarantee / Annual Minimum',
        required: false,
        ruleType: 'minimum_guarantee',
        defaultPriority: 4,
        description: 'Minimum annual or periodic payment guarantee',
        extractionHint: 'Is there a minimum annual payment or guaranteed minimum? Look for "minimum annual", "guaranteed minimum".',
        expectedFields: {
          amount: { type: 'decimal', required: true, hint: 'Dollar amount of minimum guarantee' },
          frequency: { type: 'string', required: false, hint: 'annual, quarterly, monthly' },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'general_rule_no_qualifiers', description: 'General rebate rule must have no product qualifiers (catch-all)', severity: 'error' },
      { check: 'exclusion_for_no_rebate', description: 'Every product mentioned with "no rebate" or "excluded" must have a corresponding exclusion rule', severity: 'error' },
      { check: 'override_needs_qualifiers', description: 'Product-specific overrides must have product qualifiers', severity: 'error' },
      { check: 'priorities_correct', description: 'General rate at lowest priority, exclusions at highest', severity: 'warning' },
      { check: 'no_duplicate_qualifiers', description: 'No two rules should have identical product qualifiers', severity: 'warning' },
    ],
  },

  ib_rebate: {
    contractTypeCode: 'ib_rebate',
    ruleSlots: [
      {
        slotId: 'base_rebate',
        slotName: 'Base Inbound Rebate Rate',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Standard inbound rebate percentage on purchases from supplier/vendor',
        extractionHint: 'What is the base inbound rebate percentage on purchases? Look for supplier rebate rate.',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          base_metric: { type: 'enum', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Volume-Based Tiers',
        required: false,
        repeatable: true,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Tiered rebate rates based on purchase volume',
        extractionHint: 'Are there volume-based tier thresholds that change the rebate rate?',
        expectedFields: {
          tiers: { type: 'array', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'growth_incentive',
        slotName: 'Growth Incentive / Bonus',
        required: false,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 3,
        description: 'Additional rebate for exceeding growth targets',
        extractionHint: 'Is there an additional bonus or incentive for growth? Look for "growth bonus", "performance incentive".',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'quarterly_bonus',
        slotName: 'Quarterly / Periodic Bonus',
        required: false,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 3,
        description: 'Additional periodic bonus payments',
        extractionHint: 'Are there quarterly or periodic bonus payments?',
        expectedFields: {
          amount: { type: 'decimal', required: false },
          frequency: { type: 'string', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'cap_ceiling',
        slotName: 'Cap / Ceiling',
        required: false,
        ruleType: 'cap',
        defaultPriority: 5,
        description: 'Maximum rebate cap per period',
        extractionHint: 'Is there a maximum cap or ceiling on the rebate amount?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have at least one base rebate rate', severity: 'error' },
      { check: 'tiers_sequential', description: 'Volume tiers must have sequential non-overlapping ranges', severity: 'error' },
      { check: 'cap_higher_than_base', description: 'Cap amount should be higher than expected base rebate', severity: 'warning' },
    ],
  },

  ob_rebate: {
    contractTypeCode: 'ob_rebate',
    ruleSlots: [
      {
        slotId: 'base_rebate',
        slotName: 'Base Outbound Rebate Rate',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Standard outbound rebate percentage on sales to customers/distributors',
        extractionHint: 'What is the base outbound rebate percentage? Look for customer rebate rate.',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          base_metric: { type: 'enum', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'product_specific_override',
        slotName: 'Product-Specific Rate Override',
        required: false,
        repeatable: true,
        ruleType: ['percentage', 'per_unit'],
        defaultPriority: 2,
        description: 'Different rebate rate for specific products or categories',
        extractionHint: 'Are there products with a different rebate rate or per-unit amount?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          unit_type: { type: 'string', required: false, requiredIf: 'ruleType == per_unit' },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'product_hierarchy OR products',
          matchAgainst: 'hierarchy_value, product_name',
        },
      },
      {
        slotId: 'product_exclusion',
        slotName: 'Product Exclusion (No Rebate)',
        required: false,
        repeatable: true,
        ruleType: 'percentage',
        defaultPriority: 3,
        description: 'Products explicitly excluded from rebate — zero rate',
        extractionHint: 'Are any products excluded from the rebate? Look for "no rebate on", "excluded".',
        expectedFields: {
          base_rate: { type: 'decimal', required: true, fixedValue: 0.00 },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'products',
          matchAgainst: 'product_name, sku',
        },
      },
      {
        slotId: 'growth_incentive',
        slotName: 'Growth Incentive',
        required: false,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 3,
        description: 'Additional rebate for exceeding growth targets',
        extractionHint: 'Is there a growth incentive or performance bonus?',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Volume-Based Tiers',
        required: false,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Tiered rebate rates based on sales volume',
        extractionHint: 'Does the rebate change at different sales volume levels?',
        expectedFields: {
          tiers: { type: 'array', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'minimum_guarantee',
        slotName: 'Minimum Guarantee',
        required: false,
        ruleType: 'minimum_guarantee',
        defaultPriority: 4,
        description: 'Minimum rebate payment guarantee',
        extractionHint: 'Is there a minimum guaranteed rebate amount?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have at least one base rebate rate', severity: 'error' },
      { check: 'exclusion_for_no_rebate', description: 'Excluded products need zero-rate rules', severity: 'error' },
      { check: 'override_needs_qualifiers', description: 'Product-specific overrides must have product qualifiers', severity: 'error' },
      { check: 'priorities_correct', description: 'General rate at lowest priority, exclusions at highest', severity: 'warning' },
    ],
  },

  licensing_royalty: {
    contractTypeCode: 'licensing_royalty',
    ruleSlots: [
      {
        slotId: 'base_royalty',
        slotName: 'Base Royalty Rate',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Standard royalty percentage on net sales or revenue',
        extractionHint: 'What is the base royalty rate? Look for "X% of net sales" or "royalty rate".',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          base_metric: { type: 'enum', required: false, hint: 'Usually net_sales' },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'territory_rate',
        slotName: 'Territory-Specific Rate',
        required: false,
        repeatable: true,
        ruleType: 'percentage',
        defaultPriority: 2,
        description: 'Different royalty rates for specific territories or regions',
        extractionHint: 'Are there different royalty rates for specific territories or countries?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
        },
        qualifiers: {
          required: ['territory'],
          lookupEntity: 'territory_master',
          matchAgainst: 'territory_name, region, country',
        },
      },
      {
        slotId: 'category_rate',
        slotName: 'Product Category Rate',
        required: false,
        repeatable: true,
        ruleType: ['percentage', 'per_unit'],
        defaultPriority: 2,
        description: 'Different royalty rates for specific product categories',
        extractionHint: 'Are there different rates for specific product categories?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'product_hierarchy',
          matchAgainst: 'hierarchy_value, product_name',
        },
      },
      {
        slotId: 'minimum_royalty',
        slotName: 'Minimum Royalty / Annual Minimum',
        required: false,
        ruleType: 'minimum_guarantee',
        defaultPriority: 4,
        description: 'Minimum royalty payment regardless of sales',
        extractionHint: 'Is there a minimum annual royalty or guaranteed minimum payment?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
          frequency: { type: 'string', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'advance_payment',
        slotName: 'Advance / Upfront Payment',
        required: false,
        ruleType: 'fixed_price',
        defaultPriority: 5,
        description: 'Upfront advance payment against future royalties',
        extractionHint: 'Is there an advance payment or upfront fee? Look for "advance against royalties", "signing fee".',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Volume-Based Tier Structure',
        required: false,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Royalty rate changes based on sales volume thresholds',
        extractionHint: 'Does the royalty rate change based on volume? Look for graduated scales.',
        expectedFields: {
          tiers: { type: 'array', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have at least one base royalty rate', severity: 'error' },
      { check: 'minimum_vs_advance', description: 'If both minimum and advance exist, advance should be credited against minimum', severity: 'warning' },
      { check: 'territory_coverage', description: 'All territories mentioned in the contract should have a corresponding rule', severity: 'warning' },
    ],
  },

  price_protection_chargeback: {
    contractTypeCode: 'price_protection_chargeback',
    ruleSlots: [
      {
        slotId: 'price_protection_rate',
        slotName: 'Price Protection Rate',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Percentage of price reduction covered by protection',
        extractionHint: 'What percentage of price drops is protected? Or what is the chargeback rate?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'chargeback_window',
        slotName: 'Chargeback Window',
        required: false,
        ruleType: 'fixed_price',
        defaultPriority: 2,
        description: 'Time window for chargeback claims',
        extractionHint: 'What is the chargeback or claim window (e.g., 30 days, 60 days)?',
        expectedFields: {
          amount: { type: 'number', required: false, hint: 'Days in the window' },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'eligible_products',
        slotName: 'Eligible Product Filter',
        required: false,
        repeatable: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Products eligible for price protection',
        extractionHint: 'Which products are eligible for price protection?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'products',
          matchAgainst: 'product_name',
        },
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have a price protection rate', severity: 'error' },
    ],
  },

  revenue_share_marketplace: {
    contractTypeCode: 'revenue_share_marketplace',
    ruleSlots: [
      {
        slotId: 'revenue_split',
        slotName: 'Revenue Split Percentage',
        required: true,
        ruleType: 'percentage',
        defaultPriority: 1,
        description: 'Primary revenue sharing percentage',
        extractionHint: 'What is the revenue split percentage? Look for "X% revenue share".',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
          base_metric: { type: 'enum', required: false, hint: 'gross_sales or net_sales' },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'platform_fee',
        slotName: 'Platform / Service Fee',
        required: false,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 2,
        description: 'Platform or service fees deducted before split',
        extractionHint: 'Is there a platform fee or service charge deducted?',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'minimum_share',
        slotName: 'Minimum Share / Guarantee',
        required: false,
        ruleType: 'minimum_guarantee',
        defaultPriority: 3,
        description: 'Minimum guaranteed revenue share amount',
        extractionHint: 'Is there a minimum guaranteed share or floor amount?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Revenue Tier Structure',
        required: false,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Revenue share changes at different volume levels',
        extractionHint: 'Does the share percentage change at different revenue levels?',
        expectedFields: {
          tiers: { type: 'array', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have a revenue split percentage', severity: 'error' },
      { check: 'split_under_100', description: 'Revenue split should be under 100%', severity: 'error' },
    ],
  },

  mdf: {
    contractTypeCode: 'mdf',
    ruleSlots: [
      {
        slotId: 'fund_allocation',
        slotName: 'Fund Allocation Rate',
        required: true,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 1,
        description: 'MDF allocation as percentage of sales or fixed amount',
        extractionHint: 'What is the MDF allocation rate or amount? Look for "X% of sales for marketing".',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'coop_rate',
        slotName: 'Co-op Advertising Rate',
        required: false,
        ruleType: 'percentage',
        defaultPriority: 2,
        description: 'Co-op advertising reimbursement rate',
        extractionHint: 'Is there a co-op advertising rate? What percentage of ad spend is reimbursed?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'eligible_activities',
        slotName: 'Eligible Activity Filter',
        required: false,
        repeatable: true,
        ruleType: ['percentage', 'fixed_price'],
        defaultPriority: 2,
        description: 'Specific activities eligible for MDF funding',
        extractionHint: 'Which activities are eligible for MDF? Look for trade shows, advertising, demos.',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'cap_ceiling',
        slotName: 'Maximum Fund Cap',
        required: false,
        ruleType: 'cap',
        defaultPriority: 4,
        description: 'Maximum MDF amount per period',
        extractionHint: 'Is there a cap or maximum on MDF funds?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have a fund allocation rate or amount', severity: 'error' },
    ],
  },

  mixed_commercial_agreement: {
    contractTypeCode: 'mixed_commercial_agreement',
    ruleSlots: [
      {
        slotId: 'primary_fee',
        slotName: 'Primary Fee / Rate',
        required: true,
        ruleType: ['percentage', 'fixed_price', 'per_unit'],
        defaultPriority: 1,
        description: 'The primary fee or rate from the agreement',
        extractionHint: 'What is the main fee or rate? This could be a percentage, fixed fee, or per-unit charge.',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'secondary_fee',
        slotName: 'Secondary Fee / Override',
        required: false,
        repeatable: true,
        ruleType: ['percentage', 'fixed_price', 'per_unit'],
        defaultPriority: 2,
        description: 'Additional fees for specific products, territories, or conditions',
        extractionHint: 'Are there additional fees for specific products or conditions?',
        expectedFields: {
          base_rate: { type: 'decimal', required: false },
          amount: { type: 'decimal', required: false },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'products OR product_hierarchy',
          matchAgainst: 'product_name, hierarchy_value',
        },
      },
      {
        slotId: 'exclusion',
        slotName: 'Exclusion (No Fee)',
        required: false,
        repeatable: true,
        ruleType: 'percentage',
        defaultPriority: 3,
        description: 'Products or services explicitly excluded from fees',
        extractionHint: 'Are any products or services excluded from fees?',
        expectedFields: {
          base_rate: { type: 'decimal', required: true, fixedValue: 0.00 },
        },
        qualifiers: {
          required: ['product'],
          lookupEntity: 'products',
          matchAgainst: 'product_name',
        },
      },
      {
        slotId: 'volume_tiers',
        slotName: 'Volume/Revenue Tier Structure',
        required: false,
        ruleType: 'tiered',
        defaultPriority: 2,
        description: 'Fee rates that change at different volume levels',
        extractionHint: 'Do fees change at different volume levels?',
        expectedFields: {
          tiers: { type: 'array', required: true },
        },
        qualifiers: 'none',
      },
      {
        slotId: 'minimum_guarantee',
        slotName: 'Minimum Guarantee',
        required: false,
        ruleType: 'minimum_guarantee',
        defaultPriority: 4,
        description: 'Minimum payment guarantee',
        extractionHint: 'Is there a minimum payment or guaranteed amount?',
        expectedFields: {
          amount: { type: 'decimal', required: true },
        },
        qualifiers: 'none',
      },
    ],
    validationRules: [
      { check: 'base_rate_exists', description: 'Must have at least one primary fee or rate', severity: 'error' },
      { check: 'exclusion_for_no_rebate', description: 'Excluded items need zero-rate rules', severity: 'error' },
    ],
  },

};

export interface ValidationResult {
  contractTypeCode: string;
  templateName: string;
  totalSlots: number;
  filledSlots: number;
  missingRequired: string[];
  missingOptional: string[];
  issues: Array<{
    severity: 'error' | 'warning';
    check: string;
    description: string;
    details?: string;
  }>;
  isValid: boolean;
  score: number;
}

const CODE_ALIASES: Record<string, string> = {
  'distributor_reseller': 'distributor_reseller_program',
  'distribution': 'distributor_reseller_program',
  'rebates': 'ob_rebate',
  'rebate': 'ob_rebate',
  'rebate_incentive': 'ib_rebate',
  'royalty_license': 'licensing_royalty',
  'licensing': 'licensing_royalty',
  'royalty': 'licensing_royalty',
  'price_protection': 'price_protection_chargeback',
  'chargeback': 'price_protection_chargeback',
  'revenue_share': 'revenue_share_marketplace',
  'marketplace': 'revenue_share_marketplace',
  'mixed_commercial': 'mixed_commercial_agreement',
  'direct_sales': 'mixed_commercial_agreement',
  'plant_nursery': 'licensing_royalty',
};

export class RuleTemplateService {

  private resolveCode(contractTypeCode: string): string {
    return CODE_ALIASES[contractTypeCode] || contractTypeCode;
  }

  getDefaultTemplate(contractTypeCode: string): ContractTypeRuleTemplate | null {
    const resolved = this.resolveCode(contractTypeCode);
    return DEFAULT_RULE_TEMPLATES[resolved] || null;
  }

  getAllDefaultTemplates(): Record<string, ContractTypeRuleTemplate> {
    return DEFAULT_RULE_TEMPLATES;
  }

  async getTemplateForContractType(contractTypeCode: string): Promise<ContractTypeRuleTemplate | null> {
    const resolved = this.resolveCode(contractTypeCode);
    try {
      const [typeDef] = await db.select()
        .from(contractTypeDefinitions)
        .where(eq(contractTypeDefinitions.code, resolved))
        .limit(1);

      if (typeDef?.ruleSlots) {
        const customSlots = typeDef.ruleSlots as any;
        if (customSlots.ruleSlots && Array.isArray(customSlots.ruleSlots)) {
          return customSlots as ContractTypeRuleTemplate;
        }
      }
    } catch (e) {
      console.log(`No custom rule template for ${contractTypeCode}, using default`);
    }

    return this.getDefaultTemplate(contractTypeCode);
  }

  async saveTemplateForContractType(contractTypeCode: string, template: ContractTypeRuleTemplate): Promise<void> {
    await db.update(contractTypeDefinitions)
      .set({ 
        ruleSlots: template as any,
        updatedAt: new Date(),
      })
      .where(eq(contractTypeDefinitions.code, contractTypeCode));
  }

  buildSlotFillingPrompt(template: ContractTypeRuleTemplate): string {
    const slotDescriptions = template.ruleSlots.map((slot, i) => {
      const ruleTypes = Array.isArray(slot.ruleType) ? slot.ruleType.join(' or ') : slot.ruleType;
      const qualDesc = slot.qualifiers === 'none' 
        ? 'NO product/territory qualifiers — use productCategories: ["General"]'
        : `MUST have specific ${slot.qualifiers.required.join(', ')} in productCategories — use EXACT product names from the contract`;
      
      const fixedValueNote = slot.expectedFields?.base_rate?.fixedValue !== undefined
        ? `\n  - FIXED VALUE: baseRate MUST be ${slot.expectedFields.base_rate.fixedValue} (this is a zero-rate / exclusion rule)`
        : '';
      
      return `SLOT ${i + 1}: "${slot.slotName}" [${slot.required ? 'REQUIRED' : 'OPTIONAL'}${slot.repeatable ? ', can have multiple instances' : ''}]
  - Rule type: ${ruleTypes}
  - Default priority: ${slot.defaultPriority}
  - What to look for: ${slot.extractionHint}
  - Product qualifiers: ${qualDesc}${fixedValueNote}
  ${slot.qualifierNote ? `- Note: ${slot.qualifierNote}` : ''}`;
    }).join('\n\n');

    const hasExclusionSlot = template.ruleSlots.some(s => s.slotId.includes('exclusion'));
    const exclusionExample = hasExclusionSlot ? `

**EXCLUSION RULES ARE MANDATORY**: If the contract says "no rebate on X", "excluded from", or "does not apply to" ANY product:
  - Create a SEPARATE rule with ruleType "percentage", baseRate 0.00, priority 10 (highest)
  - productCategories MUST list the EXACT excluded product name/SKU (e.g., ["4350-20 box"])
  - ruleName should be "Product Exclusion - [product name]"
  - This is NOT a condition — it is an active financial rule with rate = 0` : '';

    return `**TEMPLATE-DRIVEN RULE EXTRACTION — ONLY extract rules that match these slots:**

IMPORTANT: Extract ONLY rules that fit these defined slots. Do NOT create "condition", "data-only", or informational rules.
The ONLY rules in your output should be calculable financial rules with a ruleType and rate/amount.

${slotDescriptions}
${exclusionExample}

**CRITICAL SLOT-FILLING RULES:**
1. Fill REQUIRED slots first — these must have a corresponding rule if the contract mentions them.
2. OPTIONAL slots should only be filled if the contract explicitly mentions them.
3. PRODUCT QUALIFIERS ARE CRITICAL:
   - "NO qualifiers" = general catch-all rule, use productCategories: ["General"]
   - "MUST have product qualifiers" = list INDIVIDUAL product names, one per array element
   - CORRECT: productCategories: ["Potatoes", "Onions"]
   - WRONG:  productCategories: ["Potatoes and Onions"]
   - WRONG:  productCategories: ["general purchases (excluding potatoes, onions, and item 4350-20 box)"]
   - For exclusions, list EACH excluded product/SKU as a SEPARATE array element: ["4350-20 box"] not ["all items except..."]
   - NEVER combine multiple products into one string — split them into separate array elements
4. Use the default priority values: general rules get lowest priority (1), specific overrides get (2-3), exclusions get highest (10).
5. Each slot's extractionHint tells you what phrases to look for in the contract text.
6. For REPEATABLE slots, create one rule per distinct product/territory mentioned.
7. Every rule MUST be a calculable financial rule — no conditions, no data-only, no metadata.
8. Every rule MUST have: ruleType, ruleName, baseRate or amount, priority, productCategories.`;
  }

  validateExtractedRules(
    rules: Array<{
      ruleName: string;
      ruleType: string;
      baseRate?: number;
      qualifiers?: any[];
      priority?: number;
      description?: string;
    }>,
    template: ContractTypeRuleTemplate
  ): ValidationResult {
    const issues: ValidationResult['issues'] = [];
    const filledSlotIds: string[] = [];
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    for (const slot of template.ruleSlots) {
      const ruleTypes = Array.isArray(slot.ruleType) ? slot.ruleType : [slot.ruleType];
      
      const matchingRules = rules.filter(r => {
        if (slot.qualifiers === 'none') {
          const hasQualifiers = r.qualifiers && Array.isArray(r.qualifiers) && r.qualifiers.length > 0;
          if (slot.slotId.includes('general') || slot.slotId.includes('base') || slot.slotId.includes('commission') || slot.slotId.includes('primary') || slot.slotId.includes('revenue_split') || slot.slotId.includes('fund_allocation') || slot.slotId.includes('price_protection')) {
            return !hasQualifiers && ruleTypes.some(t => r.ruleType?.includes(t) || t.includes(r.ruleType || ''));
          }
        }
        if (slot.slotId.includes('exclusion') && (r.baseRate === 0 || r.baseRate === 0.00)) {
          return true;
        }
        if (slot.slotId.includes('volume_tiers') && r.ruleType === 'tiered') {
          return true;
        }
        if (slot.slotId.includes('minimum') && (r.ruleType === 'minimum_guarantee' || r.ruleName?.toLowerCase().includes('minimum'))) {
          return true;
        }
        return false;
      });

      if (matchingRules.length > 0) {
        filledSlotIds.push(slot.slotId);
      } else if (slot.required) {
        missingRequired.push(slot.slotName);
      } else {
        missingOptional.push(slot.slotName);
      }
    }

    for (const vr of template.validationRules) {
      switch (vr.check) {
        case 'general_rule_no_qualifiers': {
          const generalRules = rules.filter(r => 
            r.ruleName?.toLowerCase().includes('general') || 
            (!r.qualifiers || (Array.isArray(r.qualifiers) && r.qualifiers.length === 0))
          );
          for (const gr of generalRules) {
            if (gr.qualifiers && Array.isArray(gr.qualifiers) && gr.qualifiers.length > 0) {
              issues.push({
                severity: vr.severity,
                check: vr.check,
                description: vr.description,
                details: `Rule "${gr.ruleName}" is a general/catch-all rule but has product qualifiers. Remove qualifiers to make it apply to all products.`,
              });
            }
          }
          break;
        }
        case 'override_needs_qualifiers': {
          for (const r of rules) {
            if (r.priority && r.priority > 1 && r.baseRate && r.baseRate > 0) {
              const hasQualifiers = r.qualifiers && Array.isArray(r.qualifiers) && r.qualifiers.length > 0;
              if (!hasQualifiers && !r.ruleName?.toLowerCase().includes('general') && !r.ruleName?.toLowerCase().includes('minimum') && r.ruleType !== 'minimum_guarantee' && r.ruleType !== 'tiered') {
                issues.push({
                  severity: vr.severity,
                  check: vr.check,
                  description: vr.description,
                  details: `Rule "${r.ruleName}" has priority ${r.priority} (override) but no product qualifiers. Override rules should specify which products they apply to.`,
                });
              }
            }
          }
          break;
        }
        case 'priorities_correct': {
          const generalRule = rules.find(r => !r.qualifiers || (Array.isArray(r.qualifiers) && r.qualifiers.length === 0));
          const exclusionRule = rules.find(r => r.baseRate === 0 || r.baseRate === 0.00);
          if (generalRule && exclusionRule) {
            if ((generalRule.priority || 1) >= (exclusionRule.priority || 3)) {
              issues.push({
                severity: vr.severity,
                check: vr.check,
                description: vr.description,
                details: `General rule priority (${generalRule.priority}) should be lower than exclusion rule priority (${exclusionRule.priority}).`,
              });
            }
          }
          break;
        }
        case 'base_rate_exists': {
          const hasBaseRate = rules.some(r => r.baseRate && r.baseRate > 0);
          if (!hasBaseRate) {
            issues.push({
              severity: vr.severity,
              check: vr.check,
              description: vr.description,
              details: 'No rule with a base rate > 0 was found.',
            });
          }
          break;
        }
        case 'exclusion_for_no_rebate': {
          break;
        }
        case 'no_duplicate_qualifiers': {
          const qualifierSets = rules
            .filter(r => r.qualifiers && Array.isArray(r.qualifiers) && r.qualifiers.length > 0)
            .map(r => ({
              name: r.ruleName,
              key: JSON.stringify(r.qualifiers?.map((q: any) => q.value).sort()),
            }));
          const seen = new Map<string, string>();
          for (const qs of qualifierSets) {
            if (seen.has(qs.key)) {
              issues.push({
                severity: 'warning',
                check: vr.check,
                description: vr.description,
                details: `Rules "${seen.get(qs.key)}" and "${qs.name}" have identical product qualifiers.`,
              });
            }
            seen.set(qs.key, qs.name || 'Unknown');
          }
          break;
        }
      }
    }

    const totalSlots = template.ruleSlots.length;
    const filled = filledSlotIds.length;
    const score = Math.round((filled / totalSlots) * 100);

    return {
      contractTypeCode: template.contractTypeCode,
      templateName: template.ruleSlots[0]?.slotName ? `${template.contractTypeCode} template` : 'Unknown',
      totalSlots,
      filledSlots: filled,
      missingRequired,
      missingOptional,
      issues,
      isValid: missingRequired.length === 0 && issues.filter(i => i.severity === 'error').length === 0,
      score,
    };
  }
}

export const ruleTemplateService = new RuleTemplateService();
