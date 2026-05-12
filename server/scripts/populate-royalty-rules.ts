import { db } from '../db';
import { contractRules } from '@shared/schema';

const CONTRACT_ID = '9c0723eb-d7c6-4c80-9a46-d261cf39516a';

async function populateRoyaltyRules() {
  console.log('🌱 Populating fee rules for contract:', CONTRACT_ID);

  const rules = [
    {
      contractId: CONTRACT_ID,
      ruleType: 'tiered',
      ruleName: 'Tier 1 — Ornamental Trees & Shrubs',
      description: 'Base rate $1.25 per unit, sliding to $1.10 after 5,000 units per quarter',
      productCategories: ['Ornamental Trees', 'Shrubs', 'Ornamental', 'Trees'],
      territories: ['Primary Territory', 'All'],
      seasonalAdjustments: {
        Spring: 1.10,
        Summer: 1.00,
        Fall: 0.95,
        Holiday: 1.20
      },
      territoryPremiums: {
        Secondary: 1.10,
        Organic: 1.25
      },
      volumeTiers: [
        { min: 0, max: 4999, rate: 1.25 },
        { min: 5000, max: null, rate: 1.10 }
      ],
      baseRate: '1.25',
      minimumGuarantee: null,
      calculationFormula: 'quantity * tier_rate * seasonal_adjustment * territory_premium',
      priority: 1,
      isActive: true,
      confidence: '0.95',
      sourceSection: 'Section 3.1 - Fee Structure',
      sourceText: 'Tier 1 — Ornamental Trees & Shrubs: $1.25 per unit with sliding scale to $1.10 after 5,000 units'
    },
    {
      contractId: CONTRACT_ID,
      ruleType: 'tiered',
      ruleName: 'Tier 2 — Perennials',
      description: 'Base rate $1.10 per unit, sliding to $0.95 after 3,000 units per quarter',
      productCategories: ['Perennials', 'Perennial'],
      territories: ['Primary Territory', 'All'],

      seasonalAdjustments: {
        Spring: 1.10,
        Summer: 1.00,
        Fall: 0.95,
        Holiday: 1.20
      },
      territoryPremiums: {
        Secondary: 1.10,
        Organic: 1.25
      },
      volumeTiers: [
        { min: 0, max: 2999, rate: 1.10 },
        { min: 3000, max: null, rate: 0.95 }
      ],
      baseRate: '1.10',
      minimumGuarantee: null,
      calculationFormula: 'quantity * tier_rate * seasonal_adjustment * territory_premium * container_adjustment',
      priority: 2,
      isActive: true,
      confidence: '0.95',
      sourceSection: 'Section 3.1 - Fee Structure',
      sourceText: 'Tier 2 — Perennials: $1.10 per unit with sliding scale to $0.95 after 3,000 units'
    },
    {
      contractId: CONTRACT_ID,
      ruleType: 'tiered',
      ruleName: 'Tier 3 — Edibles',
      description: 'Base rate $1.50 per unit, sliding to $1.30 after 2,000 units per quarter',
      productCategories: ['Edibles', 'Edible', 'Vegetables', 'Herbs'],
      territories: ['Primary Territory', 'All'],

      seasonalAdjustments: {
        Spring: 1.10,
        Summer: 1.00,
        Fall: 0.95,
        Holiday: 1.20
      },
      territoryPremiums: {
        Secondary: 1.10,
        Organic: 1.25
      },
      volumeTiers: [
        { min: 0, max: 1999, rate: 1.50 },
        { min: 2000, max: null, rate: 1.30 }
      ],
      baseRate: '1.50',
      minimumGuarantee: null,
      calculationFormula: 'quantity * tier_rate * seasonal_adjustment * territory_premium * container_adjustment',
      priority: 3,
      isActive: true,
      confidence: '0.95',
      sourceSection: 'Section 3.1 - Fee Structure',
      sourceText: 'Tier 3 — Edibles: $1.50 per unit with sliding scale to $1.30 after 2,000 units'
    },
    {
      contractId: CONTRACT_ID,
      ruleType: 'minimum_guarantee',
      ruleName: 'Annual Minimum Guarantee',
      description: 'Minimum annual fee payment of $85,000 regardless of actual sales',
      productCategories: null,
      territories: null,

      seasonalAdjustments: null,
      territoryPremiums: null,
      volumeTiers: null,
      baseRate: null,
      minimumGuarantee: '85000.00',
      calculationFormula: 'max(calculated_royalty, 85000)',
      priority: 100,
      isActive: true,
      confidence: '1.00',
      sourceSection: 'Section 3.3 - Minimum Guarantee',
      sourceText: 'Licensee agrees to pay a minimum annual royalty of $85,000'
    }
  ];

  try {
    for (const rule of rules) {
      await db.insert(contractRules).values(rule);
      console.log(`✅ Inserted rule: ${rule.ruleName}`);
    }
    
    console.log(`\n🎉 Successfully inserted ${rules.length} fee rules!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting rules:', error);
    process.exit(1);
  }
}

populateRoyaltyRules();
