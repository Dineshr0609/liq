import { db } from '../db';
import { contractRules, salesData, erpMappingRuleSets, erpMappingRules, orgCalculationSettings, contracts, calculationBlueprints, blueprintDimensions, baseMetrics, contractQualifiers } from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { FormulaInterpreter } from './formulaInterpreter';
import type { FormulaDefinition } from '@shared/formula-types';
import {
  isWildcard,
  isContractLevelFixedFee as sharedIsContractLevelFixedFee,
  buildMergedFilters,
  ruleMatchesSale as sharedRuleMatchesSale,
  findBestMatchingRule as sharedFindBestMatch,
  territoryMatches as sharedTerritoryMatches,
  fuzzyContains as sharedFuzzyContains,
  type QualifierData,
  type SaleForMatching,
} from './ruleMatchingUtils';
import { loadConditionsForContract } from './qualifierSync';
import { SaleEnricher, type EnrichedSale } from './saleEnrichment';
import { evaluateAttributeConditions, isExtendedCondition } from './conditionEvaluator';
import type { Condition } from '@shared/qualifierRegistry';

const DEFAULT_BASE_METRIC_MAP: Record<string, keyof SaleItem> = {
  gross_sales: 'grossAmount',
  net_sales: 'netAmount',
  units: 'quantity',
  invoice_amount: 'grossAmount',
  margin: 'netAmount',
  subscription_revenue: 'grossAmount',
  outstanding_balance: 'grossAmount',
  other: 'grossAmount',
};

let cachedBaseMetricMap: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

async function resolveBaseMetricColumn(metricCode: string | null | undefined): Promise<keyof SaleItem> {
  if (!metricCode) return 'grossAmount';

  if (!cachedBaseMetricMap || Date.now() - cacheTimestamp > CACHE_TTL) {
    try {
      const rows = await db.select({ code: baseMetrics.code, salesColumn: baseMetrics.salesColumn }).from(baseMetrics);
      cachedBaseMetricMap = new Map(rows.map(r => [r.code, r.salesColumn || '']));
      cacheTimestamp = Date.now();
    } catch {
      cachedBaseMetricMap = null;
    }
  }

  const dbColumn = cachedBaseMetricMap?.get(metricCode);
  if (dbColumn) {
    const colMap: Record<string, keyof SaleItem> = {
      gross_amount: 'grossAmount',
      net_amount: 'netAmount',
      quantity: 'quantity',
      unit_price: 'grossAmount',
    };
    return colMap[dbColumn] || 'grossAmount';
  }

  return DEFAULT_BASE_METRIC_MAP[metricCode] || 'grossAmount';
}

function getSaleMetricValue(sale: SaleItem, field: keyof SaleItem): number {
  const val = sale[field];
  if (typeof val === 'number') return val;
  if (field === 'netAmount') return sale.netAmount ?? sale.grossAmount;
  return sale.grossAmount;
}

interface CalculationBlueprint {
  id: string;
  contractId: string;
  companyId: string;
  royaltyRuleId: string;
  name: string;
  ruleType: string;
  calculationLogic: any;
  erpFieldBindings: any;
  dualTerminologyMap: any;
  matchingCriteria: any;
  isFullyMapped: boolean;
  dimensions?: Array<{
    dimensionType: string;
    contractTerm: string;
    erpFieldName: string | null;
    matchValue: string | null;
    isMapped: boolean;
  }>;
}

interface VolumeTier {
  min: number;
  max: number | null;
  rate: number;
  unit?: string; // 'per_unit' | 'percentage' | undefined - controls calc formula
  productSize?: string; // e.g. "12oz", "1L" - used for container-size pricing
  label?: string; // human-readable tier label e.g. "Tier 1: 0-1000"
}

interface SeasonalAdjustments {
  [season: string]: number;
}

interface TerritoryPremiums {
  [territory: string]: number;
}

interface SaleItem {
  id: string;
  productName: string;
  category: string;
  territory: string;
  quantity: number;
  transactionDate: Date;
  grossAmount: number;
  netAmount?: number;
  containerSize?: string;
  customFields?: Record<string, string>;
}

interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  values: string;
  result: string;
}

interface ConditionCheck {
  condition: string;
  expected: string;
  actual: string;
  matched: boolean;
}

interface RuleDefinitionSnapshot {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  baseRate: number;
  volumeTiers?: any[];
  productCategories?: string[];
  territories?: string[];
  seasonalAdjustments?: any;
  territoryPremiums?: any;
  sourceText?: string;
  confidence?: number;
  isAiExtracted: boolean;
}

interface RoyaltyBreakdownItem {
  saleId: string;
  productName: string;
  category: string;
  territory: string;
  quantity: number;
  grossAmount: number;
  containerSize?: string;
  transactionDate: string;
  ruleApplied: string;
  baseRate: number;
  tierRate: number;
  seasonalMultiplier: number;
  territoryMultiplier: number;
  calculatedRoyalty: number;
  explanation: string;
  // Enhanced audit fields
  calculationSteps: CalculationStep[];
  conditionsChecked: ConditionCheck[];
  ruleSnapshot: RuleDefinitionSnapshot;
  calculationType: 'container_size' | 'volume_tier' | 'percentage' | 'formula' | 'flat_rate';
  volumeDiscountApplied: boolean;
  volumeThresholdMet?: number;
}

interface CalculationResult {
  totalRoyalty: number;
  breakdown: RoyaltyBreakdownItem[];
  minimumGuarantee: number | null;
  finalRoyalty: number;
  rulesApplied: string[];
}

export class DynamicRulesEngine {
  private _activeQualifierMap: Map<string, { inclusions: string[]; exclusions: string[] }> = new Map();
  private _activeRuleExtendedConds: Map<string, Condition[]> = new Map();
  private _activeEnricher: SaleEnricher | null = null;

  /**
   * Build a complete audit breakdown item with all details for auditor verification
   */
  private buildAuditBreakdown(
    sale: SaleItem,
    rule: any,
    calculation: {
      effectiveRate: number;
      baseRate: number;
      seasonalMultiplier: number;
      territoryMultiplier: number;
      calculatedRoyalty: number;
      explanation: string;
      calculationType: 'container_size' | 'volume_tier' | 'percentage' | 'formula' | 'flat_rate';
      volumeDiscountApplied: boolean;
      volumeThresholdMet?: number;
      matchedContainerSize?: string;
      matchedTier?: any;
      basisAmount?: number;
      basisLabel?: string;
    },
    conditionsChecked: ConditionCheck[]
  ): RoyaltyBreakdownItem {
    
    // Build calculation steps for audit trail
    const steps: CalculationStep[] = [];
    let stepNum = 1;
    
    if (calculation.calculationType === 'container_size') {
      steps.push({
        step: stepNum++,
        description: 'Identify container size from sale data',
        formula: 'Container Size Match',
        values: `Sale container: "${sale.containerSize || 'inferred from product'}"`,
        result: `Matched: ${calculation.matchedContainerSize || 'default'}`
      });
      
      steps.push({
        step: stepNum++,
        description: 'Look up base rate for container size',
        formula: 'Rate = lookup(containerSize)',
        values: `Container: ${calculation.matchedContainerSize}`,
        result: `Base Rate = $${calculation.baseRate.toFixed(4)}/unit`
      });
      
      if (calculation.volumeDiscountApplied) {
        steps.push({
          step: stepNum++,
          description: 'Apply volume discount (quantity >= threshold)',
          formula: `Quantity (${sale.quantity}) >= Threshold (${calculation.volumeThresholdMet})`,
          values: `${sale.quantity} >= ${calculation.volumeThresholdMet} = TRUE`,
          result: `Discounted Rate = $${calculation.effectiveRate.toFixed(4)}/unit`
        });
      }
      
      steps.push({
        step: stepNum++,
        description: 'Calculate base contract fee',
        formula: 'Rate × Quantity',
        values: `$${calculation.effectiveRate.toFixed(4)} × ${sale.quantity}`,
        result: `$${(calculation.effectiveRate * sale.quantity).toFixed(2)}`
      });
      
    } else if (calculation.calculationType === 'volume_tier') {
      const basisAmount = calculation.basisAmount ?? sale.grossAmount;
      const basisLabel = calculation.basisLabel ?? 'Gross Amount';
      steps.push({
        step: stepNum++,
        description: 'Identify quantity for tier matching',
        formula: 'Check quantity against tier thresholds',
        values: `Quantity: ${sale.quantity} units`,
        result: `Looking for matching tier...`
      });
      
      steps.push({
        step: stepNum++,
        description: 'Match quantity to volume tier',
        formula: 'min <= quantity <= max',
        values: calculation.matchedTier 
          ? `${calculation.matchedTier.min} <= ${sale.quantity} <= ${calculation.matchedTier.max || '∞'}`
          : `No tier matched, using base rate`,
        result: `Tier Rate = ${calculation.effectiveRate}%`
      });
      
      steps.push({
        step: stepNum++,
        description: `Calculate contract fee from ${basisLabel.toLowerCase()}`,
        formula: `${basisLabel} × Rate`,
        values: `$${basisAmount.toFixed(2)} × ${(calculation.effectiveRate / 100).toFixed(4)}`,
        result: `$${(basisAmount * (calculation.effectiveRate / 100)).toFixed(2)}`
      });
      
    } else if (calculation.calculationType === 'percentage') {
      const basisAmount = calculation.basisAmount ?? sale.grossAmount;
      const basisLabel = calculation.basisLabel ?? 'Gross Amount';
      steps.push({
        step: stepNum++,
        description: 'Identify applicable rate',
        formula: 'Rate = baseRate / 100',
        values: `${calculation.baseRate}% → ${(calculation.baseRate / 100).toFixed(4)}`,
        result: `Rate = ${(calculation.baseRate / 100).toFixed(4)}`
      });
      
      steps.push({
        step: stepNum++,
        description: `Calculate contract fee from ${basisLabel.toLowerCase()}`,
        formula: `${basisLabel} × Rate`,
        values: `$${basisAmount.toFixed(2)} × ${(calculation.baseRate / 100).toFixed(4)}`,
        result: `$${(basisAmount * (calculation.baseRate / 100)).toFixed(2)}`
      });
      
    } else if (calculation.calculationType === 'flat_rate') {
      steps.push({
        step: stepNum++,
        description: 'Identify flat rate per unit',
        formula: 'Rate = baseRate (per unit)',
        values: `Flat Rate = $${calculation.baseRate.toFixed(4)}/unit`,
        result: `Rate = $${calculation.baseRate.toFixed(4)}`
      });
      
      steps.push({
        step: stepNum++,
        description: 'Calculate contract fee (rate × quantity)',
        formula: 'Rate × Quantity',
        values: `$${calculation.baseRate.toFixed(4)} × ${sale.quantity}`,
        result: `$${(calculation.baseRate * sale.quantity).toFixed(2)}`
      });
    }
    
    // Add seasonal multiplier step if not 1.0
    if (calculation.seasonalMultiplier !== 1.0) {
      steps.push({
        step: stepNum++,
        description: 'Apply seasonal adjustment',
        formula: 'Subtotal × Seasonal Multiplier',
        values: `× ${calculation.seasonalMultiplier.toFixed(2)}`,
        result: `Seasonal factor applied`
      });
    }
    
    // Add territory multiplier step if not 1.0
    if (calculation.territoryMultiplier !== 1.0) {
      steps.push({
        step: stepNum++,
        description: 'Apply territory adjustment',
        formula: 'Subtotal × Territory Multiplier',
        values: `× ${calculation.territoryMultiplier.toFixed(2)} (${sale.territory})`,
        result: `Territory factor applied`
      });
    }
    
    const basisAmt = calculation.basisAmount ?? sale.grossAmount;
    steps.push({
      step: stepNum++,
      description: 'Final contract fee amount',
      formula: calculation.calculationType === 'container_size' 
        ? `$${calculation.effectiveRate}/unit × ${sale.quantity} × ${calculation.seasonalMultiplier} × ${calculation.territoryMultiplier}`
        : `$${basisAmt.toFixed(2)} × ${calculation.baseRate}% × ${calculation.seasonalMultiplier} × ${calculation.territoryMultiplier}`,
      values: 'All factors applied',
      result: `$${calculation.calculatedRoyalty.toFixed(2)}`
    });
    
    // Build rule snapshot for audit
    const ruleSnapshot: RuleDefinitionSnapshot = {
      ruleId: rule.id || 'unknown',
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      baseRate: parseFloat(rule.baseRate || '0'),
      volumeTiers: rule.volumeTiers,
      productCategories: rule.productCategories,
      territories: rule.territories,
      seasonalAdjustments: rule.seasonalAdjustments,
      territoryPremiums: rule.territoryPremiums,
      sourceText: rule.sourceText,
      confidence: rule.confidence,
      isAiExtracted: !!(rule.sourceText || rule.confidence)
    };
    
    const isUnitBasedRule = rule.ruleType === 'per_unit' || rule.ruleType === 'fixed_fee';
    return {
      saleId: sale.id,
      productName: sale.productName,
      category: sale.category,
      territory: sale.territory,
      quantity: sale.quantity,
      grossAmount: sale.grossAmount,
      containerSize: sale.containerSize,
      transactionDate: sale.transactionDate.toISOString(),
      ruleApplied: rule.ruleName,
      ruleType: rule.ruleType || 'percentage',
      baseRate: calculation.baseRate,
      tierRate: calculation.effectiveRate,
      effectiveRate: isUnitBasedRule ? calculation.effectiveRate : calculation.effectiveRate / 100,
      appliedRate: isUnitBasedRule ? calculation.effectiveRate : calculation.effectiveRate / 100,
      seasonalMultiplier: calculation.seasonalMultiplier,
      territoryMultiplier: calculation.territoryMultiplier,
      calculatedRoyalty: calculation.calculatedRoyalty,
      explanation: calculation.explanation,
      calculationSteps: steps,
      conditionsChecked,
      ruleSnapshot,
      calculationType: calculation.calculationType,
      volumeDiscountApplied: calculation.volumeDiscountApplied,
      volumeThresholdMet: calculation.volumeThresholdMet
    };
  }

  private isQuarterlyRebateRule(rule: any): boolean {
    const name = (rule.ruleName || '').toLowerCase();
    const hasQuarterlyKeyword = name.includes('quarter') || name.includes('rebate');
    
    const formulaDef = rule.formulaDefinition as any;
    const ruleCalc = formulaDef?.calculation || {};
    const tiers = ruleCalc.tiers || rule.volumeTiers || [];
    
    if (tiers.length === 0) return false;

    const hasUnitBasedTiers = tiers.every((t: any) => {
      const min = t.min || t['Unit Range'] || 0;
      const max = t.max || Infinity;
      const rate = t.rate ?? t['Rebate Percentage'] ?? undefined;
      return min <= 100000 && (rate !== undefined) && (rate < 1 || rate <= 100);
    });
    
    const maxTierMin = Math.max(...tiers.map((t: any) => t.min || t['Unit Range'] || 0));
    const looksLikeUnitTiers = maxTierMin > 0 && maxTierMin < 500000;
    
    if (hasQuarterlyKeyword && hasUnitBasedTiers) return true;
    
    if (hasQuarterlyKeyword && looksLikeUnitTiers) return true;
    
    const hasRebateAndTiers = name.includes('rebate') && tiers.length >= 2;
    if (hasRebateAndTiers) return true;
    
    return false;
  }

  private async getCalculationApproach(companyId: string): Promise<string> {
    const settings = await db
      .select()
      .from(orgCalculationSettings)
      .where(eq(orgCalculationSettings.companyId, companyId))
      .limit(1);
    
    return settings.length > 0 ? settings[0].calculationApproach : 'manual';
  }

  /**
   * Get ERP-generated mapping rules for a company
   */
  private async getErpMappingRulesForContract(contractId: string, companyId: string): Promise<any[]> {
    // Get active rule sets for this company
    const ruleSets = await db
      .select()
      .from(erpMappingRuleSets)
      .where(and(
        eq(erpMappingRuleSets.companyId, companyId),
        eq(erpMappingRuleSets.status, 'active')
      ));

    if (ruleSets.length === 0) return [];

    const ruleSetIds = ruleSets.map(rs => rs.id);
    
    // Get all active rules from these rule sets
    const rules = await db
      .select()
      .from(erpMappingRules)
      .where(and(
        inArray(erpMappingRules.ruleSetId, ruleSetIds),
        eq(erpMappingRules.isActive, true)
      ));

    return rules.map(rule => ({
      ...rule,
      isErpGenerated: true,
      dualTerminology: rule.description || `${rule.sourceField} (ERP: ${rule.targetField})`,
    }));
  }

  /**
   * Load calculation blueprints for a contract (merged manual rules + ERP mappings)
   */
  private async loadBlueprintsForContract(contractId: string): Promise<CalculationBlueprint[]> {
    try {
      // Load blueprints using raw SQL since tables were created manually
      const result = await db.execute(sql`
        SELECT cb.*, 
               json_agg(
                 json_build_object(
                   'dimensionType', bd.dimension_type,
                   'contractTerm', bd.contract_term,
                   'erpFieldName', bd.erp_field_name,
                   'matchValue', bd.match_value,
                   'isMapped', bd.is_mapped
                 )
               ) FILTER (WHERE bd.id IS NOT NULL) as dimensions
        FROM calculation_blueprints cb
        LEFT JOIN blueprint_dimensions bd ON cb.id = bd.blueprint_id
        WHERE cb.contract_id = ${contractId} AND cb.status = 'active'
        GROUP BY cb.id
        ORDER BY cb.priority ASC
      `);
      
      return (result.rows as any[]).map(row => ({
        id: row.id,
        contractId: row.contract_id,
        companyId: row.company_id,
        royaltyRuleId: row.royalty_rule_id,
        name: row.name,
        ruleType: row.rule_type,
        calculationLogic: row.calculation_logic,
        erpFieldBindings: row.erp_field_bindings,
        dualTerminologyMap: row.dual_terminology_map,
        matchingCriteria: row.matching_criteria,
        isFullyMapped: row.is_fully_mapped,
        dimensions: row.dimensions || [],
      }));
    } catch (error) {
      console.log(`⚠️ [BLUEPRINTS] Failed to load blueprints:`, error);
      return [];
    }
  }

  /**
   * Convert a blueprint back to a rule format for calculation
   */
  private blueprintToRule(blueprint: CalculationBlueprint): any {
    const calcLogic = blueprint.calculationLogic || {};
    
    return {
      id: blueprint.royaltyRuleId,
      ruleName: blueprint.name,
      ruleType: blueprint.ruleType,
      baseRate: calcLogic.baseRate || 0,
      volumeTiers: calcLogic.volumeTiers || null,
      productCategories: calcLogic.productCategories || [],
      territories: calcLogic.territories || [],
      seasonalAdjustments: calcLogic.seasonalAdjustments || null,
      territoryPremiums: calcLogic.territoryPremiums || null,
      formula: calcLogic.formula || null,
      isBlueprint: true,
      blueprintId: blueprint.id,
      erpFieldBindings: blueprint.erpFieldBindings,
      dualTerminologyMap: blueprint.dualTerminologyMap,
    };
  }

  /**
   * Match a sale item to a blueprint using ERP field bindings
   */
  private matchSaleToBlueprint(sale: SaleItem, blueprint: CalculationBlueprint): boolean {
    if (!blueprint.dimensions || blueprint.dimensions.length === 0) {
      return false; // No dimensions to match against
    }
    
    for (const dim of blueprint.dimensions) {
      if (!dim.isMapped || !dim.matchValue) continue;
      
      const matchValue = dim.matchValue.toLowerCase();
      
      switch (dim.dimensionType) {
        case 'product':
          const productMatch = 
            sale.productName?.toLowerCase().includes(matchValue) ||
            matchValue.includes(sale.productName?.toLowerCase() || '');
          if (!productMatch) return false;
          break;
          
        case 'territory':
          const territoryMatch = 
            sale.territory?.toLowerCase().includes(matchValue) ||
            matchValue.includes(sale.territory?.toLowerCase() || '');
          if (!territoryMatch) return false;
          break;
          
        case 'category':
          const categoryMatch = 
            sale.category?.toLowerCase().includes(matchValue) ||
            matchValue.includes(sale.category?.toLowerCase() || '');
          if (!categoryMatch) return false;
          break;
      }
    }
    
    return true;
  }

  private async loadQualifiersForContract(contractId: string, rules: any[]): Promise<Map<string, { inclusions: string[]; exclusions: string[] }>> {
    const ruleQualifierMap = new Map<string, { inclusions: string[]; exclusions: string[] }>();

    try {
      const qualRows = await db
        .select({
          qualifierId: contractQualifiers.qualifierId,
          termId: contractQualifiers.termId,
          qualifierType: contractQualifiers.qualifierType,
          qualifierField: contractQualifiers.qualifierField,
          operator: contractQualifiers.operator,
          qualifierValue: contractQualifiers.qualifierValue,
          contractClauseId: contractQualifiers.contractClauseId,
        })
        .from(contractQualifiers)
        .where(eq(contractQualifiers.contractId, contractId));

      if (qualRows.length === 0) {
        console.log(`📋 No contract_qualifiers found for contract ${contractId} — will fall back to product_categories`);
        return ruleQualifierMap;
      }

      const qualsByRule = new Map<string, { inclusions: string[]; exclusions: string[] }>();

      for (const qual of qualRows) {
        if (qual.qualifierField !== 'product_category') continue;

        let matchedRuleId: string | null = null;

        if (qual.contractClauseId) {
          const ruleByClause = rules.find((r: any) => r.sourceClauseId === qual.contractClauseId);
          if (ruleByClause) {
            matchedRuleId = ruleByClause.id;
          }
        }

        if (!matchedRuleId) {
          const qualValue = (qual.qualifierValue || '').toLowerCase().trim();
          if (qualValue) {
            const ruleByCategory = rules.find((r: any) => {
              const cats = (r.productCategories || []) as string[];
              return cats.some((c: string) => {
                const catClean = c.trim().startsWith('!') ? c.substring(1).toLowerCase().trim() : c.toLowerCase().trim();
                return catClean === qualValue;
              });
            });
            if (ruleByCategory) matchedRuleId = ruleByCategory.id;
          }
        }

        if (matchedRuleId) {
          if (!qualsByRule.has(matchedRuleId)) {
            qualsByRule.set(matchedRuleId, { inclusions: [], exclusions: [] });
          }
          const entry = qualsByRule.get(matchedRuleId)!;
          const value = (qual.qualifierValue || '').trim();
          if (!value) continue;

          if (qual.qualifierType === 'exclusion' || qual.operator === 'not_in') {
            entry.exclusions.push(value);
          } else if (qual.qualifierType === 'inclusion' || qual.operator === 'in') {
            entry.inclusions.push(value);
          }
        }
      }

      for (const rule of rules) {
        const ruleId = rule.id;
        if (qualsByRule.has(ruleId)) {
          ruleQualifierMap.set(ruleId, qualsByRule.get(ruleId)!);
        } else {
          const cats = (rule.productCategories || []) as string[];
          const hasGeneralOnly = cats.length > 0 && cats.some((c: string) => { const v = c.toLowerCase().trim(); return v === 'general' || v === 'all'; });
          const hasExclusionQuals = Array.from(qualsByRule.values()).some(q => q.exclusions.length > 0);

          if (hasGeneralOnly && hasExclusionQuals) {
            const allExclusions: string[] = [];
            for (const [otherRuleId, otherQuals] of qualsByRule) {
              if (otherRuleId !== ruleId) {
                for (const inc of otherQuals.inclusions) {
                  if (!allExclusions.includes(inc)) allExclusions.push(inc);
                }
              }
            }
            ruleQualifierMap.set(ruleId, { inclusions: ['General'], exclusions: allExclusions });
          }
        }
      }

      console.log(`📋 Loaded ${qualRows.length} qualifiers from contract_qualifiers for ${ruleQualifierMap.size} rules`);
      for (const [ruleId, quals] of ruleQualifierMap) {
        const rule = rules.find((r: any) => r.id === ruleId);
        console.log(`  📎 Rule "${rule?.ruleName}": inclusions=[${quals.inclusions.join(', ')}] exclusions=[${quals.exclusions.join(', ')}]`);
      }

      return ruleQualifierMap;
    } catch (error) {
      console.error('⚠️ Error loading contract_qualifiers, falling back to product_categories:', error);
      return ruleQualifierMap;
    }
  }

  async calculateRoyalty(contractId: string, salesItems: SaleItem[]): Promise<CalculationResult> {
    console.log(`🧮 Starting dynamic fee calculation for contract: ${contractId}`);
    console.log(`📊 Processing ${salesItems.length} sales items`);

    const excludedTypes = new Set(['return', 'returns', 'warranty', 'sample', 'samples', 'credit', 'adjustment']);
    const originalCount = salesItems.length;
    const eligibleSalesItems = salesItems.filter(sale => {
      const cf = sale.customFields || {};
      const txnType = (cf.transaction_type || '').toLowerCase().trim();
      if (txnType && excludedTypes.has(txnType)) return false;
      const eligible = (cf.rebate_eligible || '').toLowerCase().trim();
      if (eligible === 'false' || eligible === 'no' || eligible === '0') return false;
      return true;
    });
    if (eligibleSalesItems.length < originalCount) {
      console.log(`🚫 Excluded ${originalCount - eligibleSalesItems.length} non-eligible sales (returns/warranty/samples/ineligible)`);
    }
    salesItems = eligibleSalesItems;

    const contract = await db
      .select({ companyId: contracts.companyId })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    const companyId = contract.length > 0 ? contract[0].companyId : null;
    let calculationApproach = 'manual';
    let erpRulesInfo: any[] = [];

    let blueprints: CalculationBlueprint[] = [];
    
    if (companyId) {
      calculationApproach = await this.getCalculationApproach(companyId);
      
      if (calculationApproach === 'erp_rules' || calculationApproach === 'erp_mapping_rules' || calculationApproach === 'hybrid') {
        erpRulesInfo = await this.getErpMappingRulesForContract(contractId, companyId);
        blueprints = await this.loadBlueprintsForContract(contractId);
        console.log(`🔗 Calculation approach: ${calculationApproach}`);
        console.log(`📐 Loaded ${blueprints.length} calculation blueprints`);
        console.log(`📎 ERP field mappings available: ${erpRulesInfo.length}`);
        
        for (const bp of blueprints) {
          const dimCount = bp.dimensions?.length || 0;
          const mappedDims = bp.dimensions?.filter(d => d.isMapped).length || 0;
          console.log(`  📐 ${bp.name} [${bp.ruleType}] - ${mappedDims}/${dimCount} dimensions mapped`);
        }
      }
    }

    // Approval gate: only rules with approvalStatus='approved' participate
    // in fee calculations. 'pending' / 'rejected' rules are excluded.
    const rules = await db
      .select()
      .from(contractRules)
      .where(and(
        eq(contractRules.contractId, contractId),
        eq(contractRules.isActive, true),
        eq(contractRules.approvalStatus, 'approved')
      ))
      .orderBy(contractRules.priority);

    console.log(`📋 Loaded ${rules.length} manual rules`);

    const qualifierMap = await this.loadQualifiersForContract(contractId, rules);
    this._activeQualifierMap = qualifierMap;

    // OFOV: load extended attribute conditions per rule and build a sale enricher
    try {
      const conditionsByKey = await loadConditionsForContract(contractId);
      this._activeRuleExtendedConds = new Map();
      for (const rule of rules as any[]) {
        const fromRuleKey = conditionsByKey.get(`rule:${rule.id}`) || [];
        const fromClauseKey = rule.sourceClauseId
          ? conditionsByKey.get(`clause:${rule.sourceClauseId}`) || []
          : [];
        const extended = [...fromRuleKey, ...fromClauseKey].filter(isExtendedCondition);
        if (extended.length > 0) this._activeRuleExtendedConds.set(rule.id, extended);
      }
      const cRow = await db.select({ companyId: contracts.companyId })
        .from(contracts).where(eq(contracts.id, contractId)).limit(1);
      const companyId = cRow[0]?.companyId;
      if (companyId && this._activeRuleExtendedConds.size > 0) {
        this._activeEnricher = new SaleEnricher(contractId, companyId);
        await this._activeEnricher.init();
        console.log(`🔌 OFOV: ${this._activeRuleExtendedConds.size} rules carry extended attribute conditions`);
      } else {
        this._activeEnricher = null;
      }
    } catch (err) {
      console.error('[DynamicRulesEngine] OFOV init failed (will skip extended conditions):', err);
      this._activeRuleExtendedConds = new Map();
      this._activeEnricher = null;
    }

    for (const rule of rules) {
      if ((rule.ruleType === 'tiered') && this.isQuarterlyRebateRule(rule)) {
        console.log(`🔄 Auto-reclassifying rule "${rule.ruleName}" from '${rule.ruleType}' to 'rebate_tiered' (quarterly unit-based rebate detected)`);
        (rule as any).ruleType = 'rebate_tiered';
      }
    }

    const breakdown: RoyaltyBreakdownItem[] = [];
    let totalRoyalty = 0;
    let minimumGuarantee: number | null = null;
    const rulesApplied = new Set<string>();

    const ruleBaseMetricColumns = new Map<string, keyof SaleItem>();
    for (const rule of rules) {
      const metricCode = (rule as any).baseMetric || null;
      const col = await resolveBaseMetricColumn(metricCode);
      ruleBaseMetricColumns.set(rule.id, col);
    }

    const validRuleTypes = ['tiered', 'tiered_pricing', 'formula_based', 'percentage', 'minimum_guarantee', 
                            'cap', 'fixed_fee', 'fixed_price', 'variable_price', 'per_seat', 'per_unit', 
                            'per_time_period', 'volume_discount', 'license_scope', 'usage_based',
                            'rebate_tiered', 'promotional_rebate', 'bonus_rebate', 'milestone_tiered'];
    const tierRules = rules.filter(r => validRuleTypes.includes(r.ruleType) && r.ruleType !== 'minimum_guarantee');
    const minimumRule = rules.find(r => r.ruleType === 'minimum_guarantee');

    if (minimumRule && minimumRule.minimumGuarantee) {
      minimumGuarantee = parseFloat(minimumRule.minimumGuarantee);
    }

    // 📊 PRE-PROCESS: For rebate_tiered rules, aggregate sales by quarter first
    // Per contract: "Rebate is calculated on total Net Purchases in the applicable Quarter"
    // NOTE: This implementation supports ONE rebate_tiered rule per contract (typical for rebate agreements)
    const rebateTieredRules = tierRules.filter(r => r.ruleType === 'rebate_tiered');
    
    // Guard: If multiple rebate_tiered rules exist, log warning (unusual contract structure)
    if (rebateTieredRules.length > 1) {
      console.warn(`⚠️ Multiple rebate_tiered rules found (${rebateTieredRules.length}). Only the first rule will be processed to prevent double-counting.`);
    }
    
    // Process only the first rebate_tiered rule (if any)
    if (rebateTieredRules.length > 0) {
      const rule = rebateTieredRules[0];
      console.log(`📊 Processing rebate_tiered rule: ${rule.ruleName}`);
      
      // Get rule scoping filters
      const ruleCategories = rule.productCategories || [];
      const ruleTerritories = rule.territories || [];
      
      console.log(`   - Product Categories: ${ruleCategories.length > 0 ? ruleCategories.join(', ') : 'All'}`);
      console.log(`   - Territories: ${ruleTerritories.length > 0 ? ruleTerritories.join(', ') : 'All'}`);
      
      const saleMatchesRuleScope = (sale: SaleItem): boolean => {
        if (ruleCategories.length > 0) {
          const saleCat = (sale.category || '').toLowerCase();
          const saleProd = (sale.productName || '').toLowerCase();
          const categoryMatch = ruleCategories.some(cat => {
            const catLower = cat.toLowerCase();
            const catBase = catLower.replace(/\s*\([^)]*\)\s*$/, '').trim();
            return saleCat.includes(catLower) || catLower.includes(saleCat) ||
                   saleProd.includes(catBase) || catBase.includes(saleProd) ||
                   saleProd === catBase;
          });
          if (!categoryMatch) return false;
        }
        
        if (ruleTerritories.length > 0) {
          const saleTerritory = (sale.territory || '').toLowerCase();
          if (!saleTerritory || saleTerritory === 'primary territory' || saleTerritory === 'all') return true;
          const territoryMatch = ruleTerritories.some(terr => 
            saleTerritory.includes(terr.toLowerCase()) || terr.toLowerCase().includes(saleTerritory)
          );
          if (!territoryMatch) return false;
        }
        
        return true;
      };
      
      const quarterProductTotals = new Map<string, { 
        quarter: string; 
        year: string; 
        productName: string;
        netPurchases: number; 
        totalUnits: number;
        sales: SaleItem[] 
      }>();
      
      const quarterlyDollarTotals = new Map<string, number>();
      const quarterlyUnitTotals = new Map<string, number>();

      // Aggregation period: defaults to 'quarter' (legacy), but a rebate
      // contract that calls for an annual Measurement Period can opt into
      // 'annual' (or 'month') via formulaDefinition.aggregationPeriod. We
      // bucket sales accordingly so the tier lookup sees the correct total.
      const aggPeriodRaw = String(
        (rule.formulaDefinition as any)?.aggregationPeriod ?? 'quarter'
      ).toLowerCase().trim();
      const aggregationPeriod: 'annual' | 'quarter' | 'month' =
        aggPeriodRaw === 'annual' || aggPeriodRaw === 'year' || aggPeriodRaw === 'yearly'
          ? 'annual'
          : aggPeriodRaw === 'month' || aggPeriodRaw === 'monthly'
          ? 'month'
          : 'quarter';

      for (const sale of salesItems) {
        if (!saleMatchesRuleScope(sale)) continue;

        let quarter = sale.customFields?.quarter || (sale as any).quarter;
        let year = (sale as any).year?.toString();

        if (!quarter || !year) {
          const date = new Date(sale.transactionDate);
          const month = date.getMonth();
          quarter = `Q${Math.floor(month / 3) + 1}`;
          year = date.getFullYear().toString();
        }

        // Bucket key honors the rule's measurement period.
        let quarterKey: string;
        if (aggregationPeriod === 'annual') {
          quarterKey = `${year}`;
        } else if (aggregationPeriod === 'month') {
          const d = new Date(sale.transactionDate);
          quarterKey = `${year}-M${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
          quarterKey = `${year}-${quarter}`;
        }
        const productKey = `${quarterKey}|${sale.productName}`;
        const saleNetAmount = sale.netAmount || sale.grossAmount;
        const saleUnits = sale.quantity || 0;
        
        quarterlyDollarTotals.set(quarterKey, (quarterlyDollarTotals.get(quarterKey) || 0) + saleNetAmount);
        quarterlyUnitTotals.set(quarterKey, (quarterlyUnitTotals.get(quarterKey) || 0) + saleUnits);
        
        const existing = quarterProductTotals.get(productKey);
        if (existing) {
          existing.netPurchases += saleNetAmount;
          existing.totalUnits += saleUnits;
          existing.sales.push(sale);
        } else {
          quarterProductTotals.set(productKey, {
            quarter,
            year,
            productName: sale.productName,
            netPurchases: saleNetAmount,
            totalUnits: saleUnits,
            sales: [sale]
          });
        }
      }
      
      if (quarterlyDollarTotals.size === 0) {
        console.log(`   ⚠️ No matching sales for rule scope`);
      } else {
      const formulaDef = rule.formulaDefinition as any;
      const ruleCalc = formulaDef?.calculation || (rule as any).calculation || {};
      const rawTiers = ruleCalc.tiers || rule.volumeTiers || [];
      const normalizedTiers = rawTiers.map((t: any) => ({
        min: t.min ?? t['Unit Range'] ?? 0,
        max: t.max ?? null,
        rate: t.rate ?? t['Rebate Percentage'] ?? 0,
        description: t.description || t.size || '',
        _original: t
      }));
      const sortedTiers = [...normalizedTiers].sort((a: any, b: any) => (a.min || 0) - (b.min || 0));
      
      const maxTierMin = Math.max(...sortedTiers.map((t: any) => t.min || 0));
      // Tier basis resolution: explicit `tier_basis` column wins over the
      // formulaDefinition mirror, which wins over the legacy magnitude
      // heuristic (kept as fallback for null/'auto'/unknown values so
      // pre-existing rules keep working unchanged).
      const explicitBasisRaw = String(
        (rule as any).tierBasis ?? formulaDef?.tierBasis ?? ''
      ).toLowerCase().trim();
      const explicitBasis: 'units' | 'amount' | null =
        explicitBasisRaw === 'units' ? 'units'
        : (explicitBasisRaw === 'amount' || explicitBasisRaw === 'dollars') ? 'amount'
        : null;
      const heuristicIsUnits = maxTierMin > 0 && maxTierMin < 500000;
      const isUnitBasedTiers = explicitBasis
        ? explicitBasis === 'units'
        : heuristicIsUnits;
      const tierBasis = isUnitBasedTiers ? 'units' : 'dollars';
      const quarterlyTotals = isUnitBasedTiers ? quarterlyUnitTotals : quarterlyDollarTotals;
      console.log(`📐 Tier basis for ${rule.ruleName}: ${tierBasis} (${explicitBasis ? 'explicit' : 'auto-heuristic'})`);
      
      console.log(`📊 Quarterly ${tierBasis} totals for ${rule.ruleName}: ${Array.from(quarterlyTotals.entries()).map(([k, v]) => isUnitBasedTiers ? `${k}: ${v.toLocaleString()} units` : `${k}: $${v.toLocaleString()}`).join(', ')}`);
        
      // 🎯 Tier mode: 'whole' (default, backward compatible) or 'marginal' (stepped)
      const tierMode: 'whole' | 'marginal' = (formulaDef?.tierMode === 'marginal') ? 'marginal' : 'whole';
      if (tierMode === 'marginal') {
        console.log(`📐 Tier mode: MARGINAL/STEPPED — each tier rate applies only to its band`);
      }
      // Effective rate per quarter (used for whole mode and as a display-only blended rate for marginal)
      const quarterTierRates = new Map<string, { rate: number; tier: any; marginalAmount?: number }>();
      
      for (const [quarterKey, quarterTotal] of Array.from(quarterlyTotals.entries())) {
        let matchedTier: any = null;
        let applicableRate = 0;
        let marginalAmount = 0;
        
        if (tierMode === 'marginal') {
          // Walk tiers low→high, accumulating (eligibleAmount × tierRate) per band
          for (const tier of sortedTiers) {
            const tMin = tier.min || 0;
            const tMax = tier.max ?? Infinity;
            if (quarterTotal <= tMin) break;
            const eligibleAmount = Math.min(quarterTotal, tMax) - tMin;
            if (eligibleAmount <= 0) continue;
            const tierRateDecimal = tier.rate < 1 ? tier.rate : tier.rate / 100;
            const tierAmount = eligibleAmount * tierRateDecimal;
            marginalAmount += tierAmount;
            matchedTier = tier; // last band reached
            console.log(`   📐 [MARGINAL] ${quarterKey} band [${tMin}-${tier.max ?? '∞'}]: ${eligibleAmount.toLocaleString()} × ${(tierRateDecimal * 100).toFixed(2)}% = ${tierAmount.toFixed(2)}`);
          }
          // Display-only blended rate so per-product allocation can divide proportionally
          applicableRate = quarterTotal > 0 ? marginalAmount / quarterTotal : 0;
        } else {
          // Whole-tier (existing behavior)
          for (let i = sortedTiers.length - 1; i >= 0; i--) {
            const tier = sortedTiers[i];
            if (quarterTotal >= (tier.min || 0)) {
              matchedTier = tier;
              applicableRate = tier.rate < 1 ? tier.rate : tier.rate / 100;
              break;
            }
          }
          if (!matchedTier && sortedTiers.length > 0) {
            matchedTier = sortedTiers[0];
            applicableRate = matchedTier.rate < 1 ? matchedTier.rate : matchedTier.rate / 100;
          }
        }
        
        quarterTierRates.set(quarterKey, { rate: applicableRate, tier: matchedTier, marginalAmount: tierMode === 'marginal' ? marginalAmount : undefined });
        const totalLabel = isUnitBasedTiers 
          ? `${quarterTotal.toLocaleString()} units` 
          : `$${quarterTotal.toLocaleString()}`;
        if (tierMode === 'marginal') {
          console.log(`💰 [TIER DETERMINATION] ${quarterKey}: ${totalLabel} → MARGINAL total $${marginalAmount.toFixed(2)} (blended ${(applicableRate * 100).toFixed(2)}%)`);
        } else {
          console.log(`💰 [TIER DETERMINATION] ${quarterKey}: ${totalLabel} → Tier ${matchedTier?.min || 0}+ @ ${(applicableRate * 100).toFixed(1)}%`);
        }
      }
      
      // STEP 3: Apply tier rate to each product in each quarter
      for (const [productKey, productData] of Array.from(quarterProductTotals.entries())) {
        const quarterKey = `${productData.year}-${productData.quarter}`;
        const tierInfo = quarterTierRates.get(quarterKey);
        
        if (!tierInfo) continue;
        
        const { rate: applicableRate, tier: matchedTier } = tierInfo;
        const productRebate = productData.netPurchases * applicableRate;
        
        console.log(`💰 [PRODUCT REBATE] ${productData.productName} (${quarterKey}): $${productData.netPurchases.toLocaleString()} × ${(applicableRate * 100).toFixed(1)}% = $${productRebate.toFixed(2)}`);
        
        const lastSaleDate = productData.sales[productData.sales.length - 1]?.transactionDate;
        const summarySale: SaleItem = {
          id: `quarterly-${productKey.replace('|', '-')}`,
          productName: productData.productName,
          category: productData.sales[0]?.category || 'Unknown',
          territory: productData.sales[0]?.territory || 'All',
          transactionDate: lastSaleDate instanceof Date ? lastSaleDate : new Date(lastSaleDate || Date.now()),
          quantity: productData.sales.reduce((sum, s) => sum + s.quantity, 0),
          grossAmount: productData.netPurchases,
          netAmount: productData.netPurchases
        };
        
        const quarterTotal = quarterlyTotals.get(quarterKey) || 0;
        const quarterUnitTotal = quarterlyUnitTotals.get(quarterKey) || 0;
        const tierLabel = isUnitBasedTiers ? 'Quarterly Volume (Units) Tier' : 'Quarterly Net Purchases Tier';
        const tierExpected = isUnitBasedTiers
          ? sortedTiers.map((t: any) => `${(t.min || 0).toLocaleString()}+ units: ${((t.rate < 1 ? t.rate : t.rate / 100) * 100).toFixed(0)}%`).join(', ')
          : sortedTiers.map((t: any) => `$${(t.min || 0).toLocaleString()}+: ${((t.rate < 1 ? t.rate : t.rate / 100) * 100).toFixed(0)}%`).join(', ');
        const tierActual = isUnitBasedTiers
          ? `Quarter Total: ${quarterUnitTotal.toLocaleString()} units → ${(applicableRate * 100).toFixed(0)}% tier`
          : `Quarter Total: $${quarterTotal.toLocaleString()} → ${(applicableRate * 100).toFixed(0)}% tier`;
        
        const conditionsChecked: ConditionCheck[] = [
          {
            condition: tierLabel,
            expected: tierExpected,
            actual: tierActual,
            matched: !!matchedTier
          }
        ];
        
        const explanationTierInfo = isUnitBasedTiers
          ? `[Quarterly total: ${quarterUnitTotal.toLocaleString()} units]`
          : `[Quarterly total: $${quarterTotal.toLocaleString()}]`;
        
        breakdown.push(this.buildAuditBreakdown(summarySale, rule, {
          effectiveRate: applicableRate * 100,
          baseRate: applicableRate * 100,
          seasonalMultiplier: 1,
          territoryMultiplier: 1,
          calculatedRoyalty: productRebate,
          explanation: `${productData.quarter} ${productData.year} Rebate (${productData.productName}): $${productData.netPurchases.toLocaleString()} × ${(applicableRate * 100).toFixed(1)}% = $${productRebate.toFixed(2)} ${explanationTierInfo}`,
          calculationType: 'percentage',
          volumeDiscountApplied: false,
          matchedTier
        }, conditionsChecked));
        
        totalRoyalty += productRebate;
      }
      
      rulesApplied.add(rule.ruleName);
      } // End of else block (quarterlyTotals.size > 0)
    } // End of rebateTieredRules.length > 0 check
    
    // Process milestone_tiered rules (cumulative threshold-based tiers)
    const milestoneTieredRules = tierRules.filter(r => r.ruleType === 'milestone_tiered');
    const salesHandledByMilestone = new Set<string>();
    
    for (const rule of milestoneTieredRules) {
      const milestoneTiers = (rule as any).milestoneTiers || [];
      const milestoneConfig = (rule as any).milestoneConfig || { measurementBasis: 'cumulative_revenue', measurementPeriod: 'contract_period', retroactiveDefault: true };
      
      if (milestoneTiers.length === 0) {
        console.warn(`⚠️ milestone_tiered rule "${rule.ruleName}" has no tiers configured, skipping`);
        continue;
      }
      
      // Determine which sales match this rule's qualifiers
      const matchingSales = salesItems.filter(sale => this.findMatchingRule(sale, [rule]) !== null);
      if (matchingSales.length === 0) continue;
      
      // Calculate cumulative total based on measurement basis
      let cumulativeTotal = 0;
      for (const sale of matchingSales) {
        const metricCol = ruleBaseMetricColumns.get(rule.id) || 'grossAmount';
        const saleValue = parseFloat((sale as any)[metricCol]) || sale.grossAmount || 0;
        if (milestoneConfig.measurementBasis === 'cumulative_units') {
          cumulativeTotal += (sale.quantity || 1);
        } else if (milestoneConfig.measurementBasis === 'cumulative_count') {
          cumulativeTotal += 1;
        } else {
          cumulativeTotal += saleValue;
        }
      }
      
      console.log(`📊 Milestone rule "${rule.ruleName}": cumulative ${milestoneConfig.measurementBasis} = ${cumulativeTotal}`);
      
      // Sort tiers by fromThreshold ascending
      const sortedTiers = [...milestoneTiers].sort((a: any, b: any) => (a.fromThreshold || 0) - (b.fromThreshold || 0));
      
      // Find the matching tier based on cumulative total
      let matchedTier: any = null;
      for (const tier of sortedTiers) {
        const from = tier.fromThreshold || 0;
        const to = tier.toThreshold !== null && tier.toThreshold !== undefined ? tier.toThreshold : Infinity;
        if (cumulativeTotal >= from && cumulativeTotal < to) {
          matchedTier = tier;
          break;
        }
      }
      
      // If cumulative exceeds all tiers, use the last tier
      if (!matchedTier && sortedTiers.length > 0) {
        const lastTier = sortedTiers[sortedTiers.length - 1];
        const lastTo = lastTier.toThreshold !== null && lastTier.toThreshold !== undefined ? lastTier.toThreshold : Infinity;
        if (cumulativeTotal >= (lastTier.fromThreshold || 0)) {
          matchedTier = lastTier;
        }
      }
      
      if (!matchedTier) {
        console.warn(`⚠️ No matching milestone tier for cumulative total ${cumulativeTotal}`);
        continue;
      }
      
      const tierRate = matchedTier.rate || 0;
      const isRetroactive = matchedTier.retroactive ?? milestoneConfig.retroactiveDefault ?? true;
      const isPercentage = matchedTier.rateType === 'percentage';
      
      console.log(`✅ Matched tier: ${matchedTier.fromThreshold}-${matchedTier.toThreshold ?? '∞'}, rate=${tierRate} (${isPercentage ? '%' : '$'}), retroactive=${isRetroactive}`);
      
      if (isRetroactive) {
        // Retroactive: apply the matched tier rate to ALL cumulative volume
        let totalRevenue = 0;
        for (const sale of matchingSales) {
          const metricCol = ruleBaseMetricColumns.get(rule.id) || 'grossAmount';
          totalRevenue += parseFloat((sale as any)[metricCol]) || sale.grossAmount || 0;
        }
        
        const milestoneAmount = isPercentage ? totalRevenue * tierRate : tierRate * matchingSales.length;
        
        breakdown.push({
          productName: `Milestone Aggregate (${matchingSales.length} sales)`,
          quantity: matchingSales.reduce((sum, s) => sum + (s.quantity || 1), 0),
          grossAmount: totalRevenue,
          calculatedRoyalty: milestoneAmount,
          ruleApplied: rule.ruleName,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          baseRate: tierRate,
          tierRate: tierRate,
          appliedRate: tierRate,
          tierUsed: `Tier ${matchedTier.fromThreshold}-${matchedTier.toThreshold ?? '∞'} @ ${isPercentage ? (tierRate * 100).toFixed(2) + '%' : '$' + tierRate.toFixed(2)}`,
          explanation: `Milestone (retroactive): cumulative ${milestoneConfig.measurementBasis.replace(/_/g, ' ')} = ${cumulativeTotal.toFixed(2)} → Tier ${matchedTier.fromThreshold}-${matchedTier.toThreshold ?? '∞'} applied to all volume`
        });
        totalRoyalty += milestoneAmount;
      } else {
        // Non-retroactive: process each sale individually using the reached tier
        for (const sale of matchingSales) {
          const metricCol = ruleBaseMetricColumns.get(rule.id) || 'grossAmount';
          const saleValue = parseFloat((sale as any)[metricCol]) || sale.grossAmount || 0;
          const saleAmount = isPercentage ? saleValue * tierRate : tierRate;
          
          breakdown.push({
            saleId: sale.id,
            productName: sale.productName || 'Unknown',
            quantity: sale.quantity || 1,
            grossAmount: saleValue,
            calculatedRoyalty: saleAmount,
            ruleApplied: rule.ruleName,
            ruleId: rule.id,
            ruleType: rule.ruleType,
            baseRate: tierRate,
            tierRate: tierRate,
            appliedRate: tierRate,
            tierUsed: `Tier ${matchedTier.fromThreshold}-${matchedTier.toThreshold ?? '∞'} @ ${isPercentage ? (tierRate * 100).toFixed(2) + '%' : '$' + tierRate.toFixed(2)}`,
            explanation: `Milestone (marginal): sale processed at tier rate for cumulative ${milestoneConfig.measurementBasis.replace(/_/g, ' ')} = ${cumulativeTotal.toFixed(2)}`
          });
          totalRoyalty += saleAmount;
        }
      }
      
      matchingSales.forEach(s => salesHandledByMilestone.add(s.id));
      rulesApplied.add(rule.ruleName);
    }

    const nonRebateTieredRules = tierRules.filter(r => r.ruleType !== 'rebate_tiered' && r.ruleType !== 'milestone_tiered' && !sharedIsContractLevelFixedFee(r));

    // Track sales already handled by quarterly aggregation to skip in per-sale processing
    const salesHandledByQuarterly = new Set<string>();
    for (const item of breakdown) {
      if (item.ruleApplied && item.explanation?.includes('Rebate')) {
        for (const sale of salesItems) {
          if (sale.productName === item.productName) {
            salesHandledByQuarterly.add(sale.id);
          }
        }
      }
    }

    // Process each sale item
    for (const sale of salesItems) {
      if (salesHandledByQuarterly.has(sale.id)) continue;
      if (salesHandledByMilestone.has(sale.id)) continue;
      let matchedBlueprint: CalculationBlueprint | null = null;
      let matchingRule: any = null;
      
      // STEP 1: For ERP-based approaches, try to match using blueprints first
      if ((calculationApproach === 'erp_rules' || calculationApproach === 'erp_mapping_rules') && blueprints.length > 0) {
        matchedBlueprint = blueprints.find(bp => this.matchSaleToBlueprint(sale, bp)) || null;
        
        if (matchedBlueprint) {
          // Blueprint matched - use its embedded calculation logic
          matchingRule = this.blueprintToRule(matchedBlueprint);
          console.log(`📐 Blueprint matched: ${matchedBlueprint.name} for ${sale.productName}`);
        }
      }
      
      // STEP 2: For hybrid mode or if no blueprint matched, try manual rules
      // Use nonRebateTieredRules since rebate_tiered is handled separately with quarterly aggregation
      if (!matchingRule && (calculationApproach === 'manual' || calculationApproach === 'hybrid' || !matchedBlueprint)) {
        matchingRule = this.findMatchingRule(sale, nonRebateTieredRules);
      }
      
      if (matchingRule) {
        const metricCol = ruleBaseMetricColumns.get(matchingRule.id) || 'grossAmount';
        const calculation = this.calculateSaleRoyalty(sale, matchingRule, metricCol);
        
        if (matchedBlueprint && matchedBlueprint.dualTerminologyMap) {
          calculation.explanation += ` [ERP: ${JSON.stringify(matchedBlueprint.erpFieldBindings)}]`;
        }
        
        if (calculation.calculatedRoyalty > sale.grossAmount * 1.01) {
          const errorMsg = `FORMULA ERROR: Royalty ($${calculation.calculatedRoyalty.toFixed(2)}) exceeds sale amount ($${sale.grossAmount.toFixed(2)}) for ${sale.productName}. Rule: ${matchingRule.ruleName}. This indicates incorrect tier rates or formula structure.`;
          console.error(`🚨 ${errorMsg}`);
          throw new Error(errorMsg); // Hard error - forces user to fix formula instead of silently capping
        }
        
        breakdown.push(calculation);
        totalRoyalty += calculation.calculatedRoyalty;
        rulesApplied.add(matchingRule.ruleName + (matchedBlueprint ? ' [via Blueprint]' : ''));
      } else {
        console.warn(`⚠️ No matching rule for sale: ${sale.productName} (${sale.category})`);
      }
    }

    const contractLevelFixedFees = tierRules.filter(r => sharedIsContractLevelFixedFee(r));
    for (const rule of contractLevelFixedFees) {
      const fixedAmount = parseFloat(rule.baseRate) || 0;
      if (fixedAmount > 0) {
        breakdown.push({
          productName: rule.ruleName || 'Fixed Fee',
          saleAmount: fixedAmount,
          grossAmount: fixedAmount,
          rate: fixedAmount,
          calculatedRoyalty: fixedAmount,
          ruleApplied: rule.ruleName,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          baseRate: fixedAmount,
          tierRate: fixedAmount,
          appliedRate: fixedAmount,
          tierUsed: `Fixed fee: $${fixedAmount.toFixed(2)}`,
          explanation: `Contract-level fixed fee: $${fixedAmount.toFixed(2)} (applied once per calculation period)`,
          calculationType: 'flat_rate' as any,
        });
        totalRoyalty += fixedAmount;
        rulesApplied.add(rule.ruleName);
        console.log(`💰 Fixed fee rule "${rule.ruleName}": $${fixedAmount.toFixed(2)} (applied once)`);
      }
    }

    const milestonePaymentRules = rules.filter(r => r.ruleType === 'milestone_payment');
    for (const rule of milestonePaymentRules) {
      const milestones = rule.milestones || [];
      const executionGroup = rule.executionGroup || 'event';
      const contractVal = parseFloat(rule.baseRate) || 0;
      const calculationDate = new Date();

      if (milestones.length === 0) {
        console.warn(`⚠️ milestone_payment rule "${rule.ruleName}" has no milestones configured, skipping`);
        continue;
      }

      let qualifyingMilestones: any[] = [];

      if (executionGroup === 'event') {
        qualifyingMilestones = milestones.filter((m: any) => 
          m.status === 'completed' || m.status === 'invoiced' || m.status === 'paid'
        );
      } else if (executionGroup === 'periodic') {
        qualifyingMilestones = milestones.filter((m: any) => {
          if (!m.dueDate) return false;
          return new Date(m.dueDate) <= calculationDate;
        });
      } else if (executionGroup === 'adjustment') {
        qualifyingMilestones = milestones;
      }

      for (const ms of qualifyingMilestones) {
        const pct = parseFloat(ms.percentage);
        const amount = (pct > 0 && contractVal > 0) 
          ? (pct / 100) * contractVal 
          : (parseFloat(ms.amount) || 0);

        if (amount <= 0) continue;

        const msAppliedRate = pct > 0 ? pct / 100 : amount;
        breakdown.push({
          productName: ms.event || 'Milestone',
          saleAmount: contractVal,
          rate: msAppliedRate,
          calculatedRoyalty: amount,
          ruleApplied: rule.ruleName,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          baseRate: msAppliedRate,
          tierRate: msAppliedRate,
          appliedRate: msAppliedRate,
          tierUsed: pct > 0 ? `${pct}% of contract value` : `Fixed $${amount.toFixed(2)}`,
          explanation: `Milestone Payment (${executionGroup}): "${ms.event || 'Unnamed'}" — status: ${ms.status || 'n/a'}${ms.dueDate ? ', due: ' + ms.dueDate : ''}`
        });
        totalRoyalty += amount;
        rulesApplied.add(rule.ruleName);
      }

      const skippedCount = milestones.length - qualifyingMilestones.length;
      if (skippedCount > 0) {
        console.log(`📋 milestone_payment "${rule.ruleName}": ${qualifyingMilestones.length} qualifying, ${skippedCount} skipped (${executionGroup} mode)`);
      }
    }

    const finalRoyalty = minimumGuarantee 
      ? Math.max(totalRoyalty, minimumGuarantee)
      : totalRoyalty;

    console.log(`💰 Calculated royalty: $${totalRoyalty.toFixed(2)}`);
    if (minimumGuarantee) {
      console.log(`🔒 Minimum guarantee: $${minimumGuarantee.toFixed(2)}`);
      console.log(`✅ Final royalty (with minimum): $${finalRoyalty.toFixed(2)}`);
    }

    return {
      totalRoyalty,
      breakdown,
      minimumGuarantee,
      finalRoyalty,
      rulesApplied: Array.from(rulesApplied)
    };
  }

  /**
   * Find the BEST matching rule for a sale item.
   * 
   * CRITICAL: Prefer SPECIFIC rules over GENERIC rules using a clear precedence order:
   * 1. STRICT exact product name match (case-insensitive equality, not substring)
   * 2. Specificity score (fewer productCategories = more specific)
   * 3. Explicit priority value (lower priority number = checked first)
   * 4. Original database order (stable fallback)
   * 
   * This ensures tier-specific rules (e.g., "Tier 1 - Ornamental Trees") 
   * are applied instead of catch-all rules (e.g., "Plant Fee Rates").
   */
  private findMatchingRule(sale: SaleItem, rules: any[]): any | null {
    // Find ALL matching rules with their selection metadata
    const matchingRules: { 
      rule: any; 
      specificityScore: number; 
      hasStrictExactMatch: boolean;
      matchQuality: 'strict_exact' | 'contains' | 'category' | 'fallback';
      originalIndex: number;
    }[] = [];
    
    const saleProductLower = (sale.productName?.toLowerCase() || '').trim();
    const saleProductWords = saleProductLower.split(/\s+/).filter(w => w.length > 0);
    
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (this.ruleMatchesSale(sale, rule)) {
        const qualifiers = this._activeQualifierMap.get(rule.id);
        const matchCategories: string[] = qualifiers && qualifiers.inclusions.length > 0
          ? qualifiers.inclusions
          : (rule.productCategories || []).filter((c: string) => !c.trim().startsWith('!'));
        
        let hasStrictExactMatch = false;
        let matchQuality: 'strict_exact' | 'contains' | 'category' | 'fallback' = 'fallback';
        
        for (const cat of matchCategories) {
          const catLower = (cat as string).toLowerCase().trim();
          
          if (saleProductLower === catLower) {
            hasStrictExactMatch = true;
            matchQuality = 'strict_exact';
            break;
          }
          
          if (!hasStrictExactMatch && (saleProductLower.includes(catLower) || catLower.includes(saleProductLower))) {
            matchQuality = 'contains';
          }
        }
        
        if (matchQuality === 'fallback' && matchCategories.length > 0) {
          const isGeneralOnly = matchCategories.every((c: string) => isWildcard(c));
          if (!isGeneralOnly) {
            matchQuality = 'category';
          }
        }
        
        const specificityScore = matchCategories.length > 0 
          ? 1000 / matchCategories.length 
          : 0;
        
        matchingRules.push({ 
          rule, 
          specificityScore, 
          hasStrictExactMatch,
          matchQuality,
          originalIndex: i 
        });
      }
    }
    
    if (matchingRules.length === 0) {
      return null;
    }
    
    // Sort by: (1) strict exact match, (2) match quality, (3) specificity, (4) priority, (5) original order
    matchingRules.sort((a, b) => {
      // 1. Strict exact matches always win
      if (a.hasStrictExactMatch && !b.hasStrictExactMatch) return -1;
      if (!a.hasStrictExactMatch && b.hasStrictExactMatch) return 1;
      
      // 2. Match quality ranking: strict_exact > contains > category > fallback
      const qualityOrder = { 'strict_exact': 0, 'contains': 1, 'category': 2, 'fallback': 3 };
      const qualityDiff = qualityOrder[a.matchQuality] - qualityOrder[b.matchQuality];
      if (qualityDiff !== 0) return qualityDiff;
      
      // 3. Higher specificity (fewer categories) wins
      const specificityDiff = b.specificityScore - a.specificityScore;
      if (Math.abs(specificityDiff) > 0.001) return specificityDiff;
      
      // 4. Lower priority number wins (priority is the explicit tiebreaker)
      const priorityA = a.rule.priority ?? 50; // Default priority if not set
      const priorityB = b.rule.priority ?? 50;
      const priorityDiff = priorityA - priorityB;
      if (priorityDiff !== 0) return priorityDiff;
      
      // 5. Original order (stable sort)
      return a.originalIndex - b.originalIndex;
    });
    
    const selected = matchingRules[0];
    const selectedRule = selected.rule;
    
    // Store selection rationale for audit trail (attached to the rule object)
    selectedRule._selectionRationale = {
      matchQuality: selected.matchQuality,
      specificityScore: selected.specificityScore,
      candidatesConsidered: matchingRules.length,
      candidateNames: matchingRules.map(m => m.rule.ruleName).slice(0, 5)
    };
    
    // Log the decision for audit trail
    if (matchingRules.length > 1) {
      console.log(`🎯 Rule selection for "${sale.productName}": Selected "${selectedRule.ruleName}" (${selected.matchQuality}, specificity: ${selected.specificityScore.toFixed(1)}, priority: ${selectedRule.priority ?? 'default'}) over ${matchingRules.length - 1} other matching rule(s): ${matchingRules.slice(1).map(m => m.rule.ruleName).join(', ')}`);
    }
    
    return selectedRule;
  }

  private normalizeForMatching(s: string): string {
    return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private fuzzyContains(a: string, b: string): boolean {
    if (a.includes(b) || b.includes(a)) return true;
    const aN = this.normalizeForMatching(a);
    const bN = this.normalizeForMatching(b);
    return aN.includes(bN) || bN.includes(aN);
  }

  private ruleMatchesSale(sale: SaleItem, rule: any): boolean {
    const qualifiers = this._activeQualifierMap.get(rule.id);
    const baseMatch = sharedRuleMatchesSale(
      { productName: sale.productName || '', category: sale.category || '', territory: sale.territory || '', channel: '' },
      {
        id: rule.id,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        productCategories: rule.productCategories || [],
        territories: rule.territories || null,
        channel: null,
        priority: rule.priority,
      },
      qualifiers
    );
    if (!baseMatch) return false;

    // OFOV: any extended attribute conditions on this rule must also pass.
    const extended = this._activeRuleExtendedConds.get(rule.id);
    if (!extended || extended.length === 0 || !this._activeEnricher) return true;
    const enriched: EnrichedSale = this._activeEnricher.enrich({
      productName: sale.productName,
      productCode: (sale as any).productCode ?? null,
      category: sale.category,
      territory: sale.territory,
      channel: (sale as any).channel,
      customerCode: (sale as any).customerCode ?? null,
    });
    return evaluateAttributeConditions(extended, enriched);
  }

  /**
   * Smart category matching with word-based overlap
   * Requires meaningful category words to match, not just tier/grade labels
   * Example: "Ornamental Shrubs" matches "Ornamental Trees & Shrubs" (shared: ornamental, shrubs)
   * Example: "Tier 1 Shrubs" does NOT match "Tier 1 Trees" (different product category)
   * Example: "Tier 1 Shrubs" does NOT match "Tier 2 Shrubs" (conflicting tier)
   * Example: "Shrubs" does NOT match "Tier 2 Shrubs" (tier-specific rule requires tier match)
   */
  private categoriesMatch(saleCategory: string, ruleCategory: string): boolean {
    // Word-based matching with tier/grade awareness
    const saleWords = this.extractCategoryWords(saleCategory);
    const ruleWords = this.extractCategoryWords(ruleCategory);
    
    // If either has no meaningful words, no match
    if (saleWords.length === 0 || ruleWords.length === 0) {
      return false;
    }
    
    // CHECK TIER/GRADE CONFLICTS FIRST (before any matching logic)
    const saleNumbers = saleWords.filter(word => /^\d+$/.test(word));
    const ruleNumbers = ruleWords.filter(word => /^\d+$/.test(word));
    
    // If only ONE has numbers, it's a tier mismatch (e.g., "Shrubs" vs "Tier 2 Shrubs")
    if ((saleNumbers.length > 0) !== (ruleNumbers.length > 0)) {
      return false; // One is tiered, the other isn't
    }
    
    // If BOTH have numbers, they must all match (e.g., "Tier 1" must match "Tier 1", not "Tier 2")
    if (saleNumbers.length > 0 && ruleNumbers.length > 0) {
      const numbersMatch = saleNumbers.every(num => ruleNumbers.includes(num)) &&
                          ruleNumbers.every(num => saleNumbers.includes(num));
      if (!numbersMatch) {
        return false; // Conflicting tier/grade numbers
      }
    }
    
    // Identify generic tier/grade/level words and numbers
    const genericWords = new Set(['tier', 'grade', 'level', 'class', 'type']);
    const isGenericOrNumber = (word: string) => genericWords.has(word) || /^\d+$/.test(word);
    
    // Find shared words, separating category descriptors from tier/grade labels
    const sharedWords = saleWords.filter(word => ruleWords.includes(word));
    const sharedCategoryWords = sharedWords.filter(word => !isGenericOrNumber(word));
    
    // MUST have at least 1 shared meaningful category word (not just "tier" + number)
    if (sharedCategoryWords.length === 0) {
      return false;
    }
    
    // For single-word categories (after filtering generics), require 100% match
    const saleCategoryWords = saleWords.filter(word => !isGenericOrNumber(word));
    const ruleCategoryWords = ruleWords.filter(word => !isGenericOrNumber(word));
    
    if (saleCategoryWords.length === 1 && ruleCategoryWords.length === 1) {
      return saleCategoryWords[0] === ruleCategoryWords[0];
    }
    
    // For multi-word categories, require at least 2 shared category words OR 100% of smaller
    const minCategoryWords = Math.min(saleCategoryWords.length, ruleCategoryWords.length);
    const requiredShared = Math.min(2, minCategoryWords);
    
    if (sharedCategoryWords.length < requiredShared) {
      return false;
    }
    
    return true;
  }

  /**
   * Extract meaningful words from a category string
   * Filters out ONLY stop words, keeps all other words including numbers/grades
   */
  private extractCategoryWords(category: string): string[] {
    const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for']);
    
    return category
      .toLowerCase()
      .split(/[\s&,/\-()]+/) // Split by space, &, comma, slash, dash, parentheses
      .map(word => word.trim())
      .filter(word => word.length > 0 && !stopWords.has(word)); // Keep all non-stop words
  }

  private calculateSaleRoyalty(sale: SaleItem, rule: any, metricCol: keyof SaleItem = 'grossAmount'): RoyaltyBreakdownItem {
    const saleAmount = getSaleMetricValue(sale, metricCol);
    const metricLabel = metricCol === 'netAmount' ? 'Net Amount' : metricCol === 'quantity' ? 'Quantity' : 'Gross Amount';

    if (rule.formulaDefinition) {
      console.log(`🧮 [FORMULA CALC] Using FormulaInterpreter for rule: ${rule.ruleName} (metric: ${metricLabel})`);
      
      const season = this.determineSeason(sale.transactionDate);
      const interpreter = new FormulaInterpreter({ debug: true });
      
      const context: any = {
        units: sale.quantity,
        quantity: sale.quantity,
        season: season,
        territory: sale.territory,
        product: sale.productName,
        category: sale.category,
        salesVolume: sale.quantity.toString(),
        grossAmount: sale.grossAmount,
        netAmount: sale.netAmount ?? sale.grossAmount,
        saleAmount: saleAmount,
      };
      
      const formulaDef = rule.formulaDefinition as FormulaDefinition;
      const result = interpreter.evaluateFormula(formulaDef, context);
      
      console.log(`   ✅ Formula result: $${result.value.toFixed(2)}`);
      if (result.debugLog) {
        result.debugLog.forEach(log => console.log(`      ${log}`));
      }
      
      const conditionsChecked: ConditionCheck[] = [
        {
          condition: 'Formula Evaluation',
          expected: formulaDef.description || 'Custom formula',
          actual: 'Formula executed',
          matched: true
        }
      ];
      
      return this.buildAuditBreakdown(sale, rule, {
        effectiveRate: result.value / sale.quantity,
        baseRate: 0,
        seasonalMultiplier: 1,
        territoryMultiplier: 1,
        calculatedRoyalty: result.value,
        explanation: `Formula: ${formulaDef.description || rule.ruleName} = $${result.value.toFixed(2)}`,
        calculationType: 'formula',
        volumeDiscountApplied: false
      }, conditionsChecked);
    }
    
    // 💰 REBATE TIERED: Handle volume-based rebate tiers with clean threshold logic
    // Expected logic: if (quantity <= 1M) → 2%, else if (quantity <= 5M) → 4%, else → 6%
    if (rule.ruleType === 'rebate_tiered') {
      // Get calculation from formulaDefinition (where rebate data is stored) or fallback to rule.calculation
      const formulaDef = rule.formulaDefinition as any;
      const calculation = formulaDef?.calculation || rule.calculation || {};
      const tiers = calculation.tiers || rule.volumeTiers || [];
      const netPurchases = saleAmount;
      
      console.log(`💰 [REBATE TIERED CALC] Rule: ${rule.ruleName} (metric: ${metricLabel})`);
      console.log(`   - Net Purchases: $${netPurchases.toFixed(2)}`);
      console.log(`   - Tiers: ${JSON.stringify(tiers)}`);
      
      // Find matching tier using clean threshold logic (not overlapping ranges)
      let matchedTier: any = null;
      let applicableRate = 0;
      
      // Sort tiers by min threshold ascending
      const sortedTiers = [...tiers].sort((a: any, b: any) => (a.min || 0) - (b.min || 0));
      
      for (let i = sortedTiers.length - 1; i >= 0; i--) {
        const tier = sortedTiers[i];
        const tierMin = tier.min || 0;
        
        // Clean threshold logic: check if netPurchases exceeds this tier's minimum
        if (netPurchases >= tierMin) {
          matchedTier = tier;
          // Rate is stored as decimal (0.02 = 2%) or percentage (2 = 2%)
          applicableRate = tier.rate < 1 ? tier.rate : tier.rate / 100;
          break;
        }
      }
      
      if (!matchedTier && sortedTiers.length > 0) {
        // Default to first tier if no match
        matchedTier = sortedTiers[0];
        applicableRate = matchedTier.rate < 1 ? matchedTier.rate : matchedTier.rate / 100;
      }
      
      const calculatedRebate = netPurchases * applicableRate;
      
      console.log(`   ✓ Matched Tier: ${matchedTier ? `$${matchedTier.min || 0}+ @ ${(applicableRate * 100).toFixed(1)}%` : 'None'}`);
      console.log(`   💰 Calculation: $${netPurchases.toFixed(2)} × ${(applicableRate * 100).toFixed(1)}% = $${calculatedRebate.toFixed(2)}`);
      
      const conditionsChecked: ConditionCheck[] = [
        {
          condition: 'Net Purchases Tier',
          expected: sortedTiers.map((t: any) => `$${t.min || 0}+: ${((t.rate < 1 ? t.rate : t.rate / 100) * 100).toFixed(0)}%`).join(', '),
          actual: `$${netPurchases.toFixed(2)}`,
          matched: !!matchedTier
        }
      ];
      
      return this.buildAuditBreakdown(sale, rule, {
        effectiveRate: applicableRate * 100,
        baseRate: applicableRate * 100,
        seasonalMultiplier: 1,
        territoryMultiplier: 1,
        calculatedRoyalty: calculatedRebate,
        explanation: `Rebate Tier: $${netPurchases.toFixed(2)} × ${(applicableRate * 100).toFixed(1)}% = $${calculatedRebate.toFixed(2)}`,
        calculationType: 'percentage',
        volumeDiscountApplied: false,
        matchedTier
      }, conditionsChecked);
    }
    
    // 🚀 PROMOTIONAL REBATE: Handle product + time-limited conditions
    // Expected logic: if (product == 'Vontair Analytics Module' && quarter <= 2) rebate = netPurchases × 1%
    if (rule.ruleType === 'promotional_rebate') {
      // Get calculation from formulaDefinition (where rebate data is stored) or fallback to rule.calculation
      const formulaDef = rule.formulaDefinition as any;
      const calculation = formulaDef?.calculation || rule.calculation || {};
      const conditions = formulaDef?.conditions || rule.conditions || calculation.conditions || {};
      const productFamily = conditions.productFamily || conditions.productCategories?.[0] || (rule.productCategories?.[0] || '');
      const quarterLimit = conditions.quarterLimit || 2;
      const rate = calculation.rate || parseFloat(rule.baseRate || '0.01');
      const applicableRate = rate < 1 ? rate : rate / 100;
      
      console.log(`🚀 [PROMOTIONAL REBATE CALC] Rule: ${rule.ruleName}`);
      console.log(`   - Product Family: ${productFamily}`);
      console.log(`   - Quarter Limit: Q${quarterLimit}`);
      console.log(`   - Sale Product: ${sale.productName}`);
      console.log(`   - Sale Date: ${sale.transactionDate}`);
      
      // Check product match condition - use EXACT match for specific products
      // For launch incentives, we need exact product name match (e.g., "Vontair Analytics Module")
      const saleProductLower = (sale.productName || '').toLowerCase().trim();
      const productFamilyLower = productFamily.toLowerCase().trim();
      
      // Exact match for specific product names, or category match for broader families
      const productMatches = !productFamily || 
        saleProductLower === productFamilyLower ||
        (productFamily.includes(' ') ? false : sale.category?.toLowerCase().includes(productFamilyLower));
      
      // Check quarter condition (Q1 = Jan-Mar, Q2 = Apr-Jun, etc.)
      const transactionDate = new Date(sale.transactionDate);
      const month = transactionDate.getMonth();
      const currentQuarter = Math.floor(month / 3) + 1;
      const quarterMatches = currentQuarter <= quarterLimit;
      
      const conditionsChecked: ConditionCheck[] = [
        {
          condition: 'Product Match',
          expected: productFamily || 'Any product',
          actual: sale.productName || 'Unknown',
          matched: productMatches
        },
        {
          condition: 'Quarter Limit',
          expected: `Q1-Q${quarterLimit}`,
          actual: `Q${currentQuarter}`,
          matched: quarterMatches
        }
      ];
      
      // Only apply rebate if BOTH conditions match
      let calculatedRebate = 0;
      let explanation = '';
      
      if (productMatches && quarterMatches) {
        calculatedRebate = saleAmount * applicableRate;
        explanation = `Promotional Rebate: ${productFamily} in Q${currentQuarter} → $${saleAmount.toFixed(2)} × ${(applicableRate * 100).toFixed(1)}% = $${calculatedRebate.toFixed(2)}`;
        console.log(`   ✓ Conditions met! Rebate: $${calculatedRebate.toFixed(2)}`);
      } else {
        explanation = `Promotional Rebate: Conditions not met (Product: ${productMatches ? '✓' : '✗'}, Quarter: ${quarterMatches ? '✓' : '✗'}) → $0.00`;
        console.log(`   ✗ Conditions NOT met: Product=${productMatches}, Quarter=${quarterMatches}`);
      }
      
      return this.buildAuditBreakdown(sale, rule, {
        effectiveRate: applicableRate * 100,
        baseRate: applicableRate * 100,
        seasonalMultiplier: 1,
        territoryMultiplier: 1,
        calculatedRoyalty: calculatedRebate,
        explanation,
        calculationType: 'percentage',
        volumeDiscountApplied: false
      }, conditionsChecked);
    }
    
    // 📈 BONUS REBATE: Handle annual threshold-based bonus
    // Expected logic: if (annualNetPurchases > $12M) bonus = (annualNetPurchases - $10M) × 2%
    if (rule.ruleType === 'bonus_rebate') {
      // Get calculation from formulaDefinition (where rebate data is stored) or fallback to rule.calculation
      const formulaDef = rule.formulaDefinition as any;
      const calculation = formulaDef?.calculation || rule.calculation || {};
      const conditions = formulaDef?.conditions || rule.conditions || {};
      const qualifyingThreshold = calculation.qualifyingThreshold || conditions.minimumAnnualPurchases || 12000000;
      const appliesAbove = calculation.appliesAbove || 10000000;
      const bonusRate = calculation.bonusRate || parseFloat(rule.baseRate || '0.02');
      const applicableRate = bonusRate < 1 ? bonusRate : bonusRate / 100;
      
      // Note: For bonus rebates, we need annual totals, not per-transaction
      // In practice, this would be calculated at period end, not per sale
      // For now, treat grossAmount as the annual net purchases for demonstration
      const annualNetPurchases = sale.grossAmount;
      
      console.log(`📈 [BONUS REBATE CALC] Rule: ${rule.ruleName}`);
      console.log(`   - Qualifying Threshold: $${qualifyingThreshold.toLocaleString()}`);
      console.log(`   - Applies Above: $${appliesAbove.toLocaleString()}`);
      console.log(`   - Bonus Rate: ${(applicableRate * 100).toFixed(1)}%`);
      console.log(`   - Annual Net Purchases: $${annualNetPurchases.toLocaleString()}`);
      
      const meetsThreshold = annualNetPurchases > qualifyingThreshold;
      
      const conditionsChecked: ConditionCheck[] = [
        {
          condition: 'Annual Threshold',
          expected: `> $${qualifyingThreshold.toLocaleString()}`,
          actual: `$${annualNetPurchases.toLocaleString()}`,
          matched: meetsThreshold
        }
      ];
      
      let calculatedBonus = 0;
      let explanation = '';
      
      if (meetsThreshold) {
        // Bonus applies to amount ABOVE the appliesAbove threshold
        const bonusableAmount = annualNetPurchases - appliesAbove;
        calculatedBonus = bonusableAmount * applicableRate;
        explanation = `Growth Bonus: ($${annualNetPurchases.toLocaleString()} - $${appliesAbove.toLocaleString()}) × ${(applicableRate * 100).toFixed(1)}% = $${calculatedBonus.toFixed(2)}`;
        console.log(`   ✓ Threshold met! Bonus: $${calculatedBonus.toFixed(2)}`);
      } else {
        explanation = `Growth Bonus: Annual purchases $${annualNetPurchases.toLocaleString()} < $${qualifyingThreshold.toLocaleString()} threshold → $0.00`;
        console.log(`   ✗ Threshold NOT met: $${annualNetPurchases.toLocaleString()} <= $${qualifyingThreshold.toLocaleString()}`);
      }
      
      return this.buildAuditBreakdown(sale, rule, {
        effectiveRate: applicableRate * 100,
        baseRate: applicableRate * 100,
        seasonalMultiplier: 1,
        territoryMultiplier: 1,
        calculatedRoyalty: calculatedBonus,
        explanation,
        calculationType: 'percentage',
        volumeDiscountApplied: false
      }, conditionsChecked);
    }
    
    // 📊 LEGACY: Fall back to old calculation method
    const volumeTiers: VolumeTier[] = rule.volumeTiers || [];
    const seasonalAdj: SeasonalAdjustments = rule.seasonalAdjustments || {};
    const territoryPrem: TerritoryPremiums = rule.territoryPremiums || {};

    let tierRate = parseFloat(rule.baseRate || '0');
    
    console.log(`🔍 [LEGACY CALC] Rule: ${rule.ruleName}`);
    console.log(`   - Base Rate: ${rule.baseRate} → ${tierRate}`);
    console.log(`   - Volume Tiers: ${JSON.stringify(volumeTiers)}`);
    console.log(`   - Seasonal Adj: ${JSON.stringify(seasonalAdj)}`);
    console.log(`   - Territory Prem: ${JSON.stringify(territoryPrem)}`);
    
    let matchedVolumeTier: VolumeTier | null = null;
    if (volumeTiers.length > 0) {
      matchedVolumeTier = volumeTiers.find((tier: VolumeTier) => {
        if (tier.max === null) {
          return sale.quantity >= tier.min;
        }
        return sale.quantity >= tier.min && sale.quantity <= tier.max;
      }) || null;
      
      if (matchedVolumeTier) {
        tierRate = matchedVolumeTier.rate;
        console.log(`   ✓ Matching tier found: ${matchedVolumeTier.min}-${matchedVolumeTier.max || '∞'} @ rate ${matchedVolumeTier.rate}`);
      }
    }

    const season = this.determineSeason(sale.transactionDate);
    const seasonalMultiplier = seasonalAdj[season] || 1.0;

    let territoryMultiplier = 1.0;
    for (const [terr, premium] of Object.entries(territoryPrem)) {
      if (sale.territory?.toLowerCase().includes(terr.toLowerCase())) {
        territoryMultiplier = premium;
        break;
      }
    }

    let calculatedRoyalty: number;
    let calculationType: 'volume_tier' | 'percentage' | 'flat_rate';
    
    // 🎯 Per-unit tier detection: tier with unit:'per_unit' overrides percentage formula
    const tierIsPerUnit = matchedVolumeTier?.unit === 'per_unit';
    if (rule.ruleType === 'per_unit' || rule.ruleType === 'fixed_fee' || tierIsPerUnit) {
      calculatedRoyalty = sale.quantity * tierRate * seasonalMultiplier * territoryMultiplier;
      calculationType = rule.ruleType === 'fixed_fee' ? 'flat_rate' : 'volume_tier';
      const calcLabel = tierIsPerUnit ? `tier-per-unit` : rule.ruleType;
      console.log(`   💰 Calculation (${calcLabel}): ${sale.quantity} units × $${tierRate}/unit × ${seasonalMultiplier} seasonal × ${territoryMultiplier} territory = $${calculatedRoyalty.toFixed(2)}`);
    } else {
      const rateAsDecimal = tierRate / 100;
      calculatedRoyalty = saleAmount * rateAsDecimal * seasonalMultiplier * territoryMultiplier;
      calculationType = volumeTiers.length > 0 ? 'volume_tier' : 'percentage';
      console.log(`   💰 Calculation (percentage): $${saleAmount} (${metricLabel}) × ${tierRate}% × ${seasonalMultiplier} seasonal × ${territoryMultiplier} territory = $${calculatedRoyalty.toFixed(2)}`);
    }

    const explanation = this.buildExplanation(
      sale.quantity,
      tierRate,
      seasonalMultiplier,
      territoryMultiplier,
      season,
      sale.territory
    );
    
    // Build condition checks for audit trail
    const conditionsChecked: ConditionCheck[] = [];
    
    if (rule.productCategories?.length > 0) {
      conditionsChecked.push({
        condition: 'Product Category',
        expected: rule.productCategories.join(', '),
        actual: sale.category || sale.productName,
        matched: true
      });
    }
    
    if (rule.territories?.length > 0) {
      conditionsChecked.push({
        condition: 'Territory',
        expected: rule.territories.join(', '),
        actual: sale.territory || 'Not specified',
        matched: true
      });
    }
    
    if (volumeTiers.length > 0) {
      const matchingTier = volumeTiers.find((tier: VolumeTier) => {
        if (tier.max === null) return sale.quantity >= tier.min;
        return sale.quantity >= tier.min && sale.quantity <= tier.max;
      });
      conditionsChecked.push({
        condition: 'Volume Tier',
        expected: volumeTiers.map(t => `${t.min}-${t.max || '∞'}: ${t.rate}%`).join(', '),
        actual: `${sale.quantity} units`,
        matched: !!matchingTier
      });
    }

    const actualBaseRate = (rule.ruleType === 'per_unit') 
      ? tierRate 
      : parseFloat(rule.baseRate || '0');
    
    return this.buildAuditBreakdown(sale, rule, {
      effectiveRate: tierRate,
      baseRate: actualBaseRate,
      seasonalMultiplier,
      territoryMultiplier,
      calculatedRoyalty,
      explanation,
      calculationType,
      volumeDiscountApplied: false,
      matchedTier: matchedVolumeTier,
      basisAmount: saleAmount,
      basisLabel: metricLabel,
    }, conditionsChecked);
  }

  private determineSeason(date: Date): string {
    const month = date.getMonth();
    
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    if (month === 11 || month === 0) return 'Holiday';
    return 'Winter';
  }

  private buildExplanation(
    quantity: number,
    tierRate: number,
    seasonal: number,
    territory: number,
    season: string,
    territoryName: string
  ): string {
    // Updated to reflect percentage-based calculation (consistent with formula interpreter)
    const parts = [`${tierRate}% of gross sales`];
    
    if (seasonal !== 1.0) {
      parts.push(`× ${seasonal.toFixed(2)} (${season})`);
    }
    
    if (territory !== 1.0) {
      parts.push(`× ${territory.toFixed(2)} (${territoryName})`);
    }
    
    return parts.join(' ');
  }
}

export const dynamicRulesEngine = new DynamicRulesEngine();
