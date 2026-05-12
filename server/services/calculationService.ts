/**
 * Calculation Service - Unified Interface for Contract Fee Calculations
 * 
 * This service provides a unified interface for contract fee calculations,
 * supporting both the legacy dynamicRulesEngine and the new universalFormulaEvaluator.
 * 
 * The evaluation mode can be set per-contract or globally via system settings.
 */

import { db } from '../db';
import { storage } from '../storage';
import { contractRules, contracts, orgCalculationSettings, contractQualifiers, baseMetrics, calculationRuns, calculationAuditItems, accrualPolicies, type InsertCalculationAuditItem } from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { dynamicRulesEngine } from './dynamicRulesEngine';
import { calculationEngine } from './universalCalculationEngine';
import { evaluateFormulaDefinition, type EvaluationContext, type EvaluationResult } from './universalFormulaEvaluator';
import { validateRuleExtraction, type RuleForValidation } from './extractionValidationService';
import type { FormulaDefinition } from '@shared/formula-types';
import { buildFormulaDefinition } from '@shared/formulaDefinitionBuilder';
import { resolveCalcPhase, comparePhaseThenPriority, CALC_PHASES, CALC_PHASE_LABELS, type CalcPhase } from '@shared/calcPhases';
import {
  isWildcard,
  isContractLevelFixedFee as sharedIsContractLevelFixedFee,
  buildMergedFilters,
  ruleMatchesSale as sharedRuleMatchesSale,
  findBestMatchingRule,
  territoryMatches,
  channelMatches,
  type QualifierData,
  type RuleForMatching,
  type SaleForMatching,
} from './ruleMatchingUtils';
import { loadConditionsForContract } from './qualifierSync';
import { SaleEnricher, type EnrichedSale } from './saleEnrichment';
import { evaluateAttributeConditions, isExtendedCondition } from './conditionEvaluator';
import type { Condition } from '@shared/qualifierRegistry';

export type EvaluationMode = 'legacy' | 'universal' | 'hybrid';

// Type for field mappings from rule configuration
interface FieldMappings {
  volumeField?: string;  // Column name for volume/threshold
  rateField?: string;    // Column name for rate/percentage
  minimumField?: string; // Column name for minimum payment
  descriptionField?: string;
}

/**
 * Apply field mappings to extract standardized values from tier data
 * This allows dynamic column names to be mapped to calculation fields
 */
function applyFieldMappings(tier: any, fieldMappings?: FieldMappings): {
  min: number;
  max: number | null;
  rate: number;
  minimum?: number;
  description?: string;
} {
  if (!fieldMappings) {
    // No mappings - use standard field names
    return {
      min: tier.min || 0,
      max: tier.max || null,
      rate: tier.rate || tier.baseRate || 0,
      minimum: tier.minimumAnnual || tier.minimumPayment,
      description: tier.description
    };
  }
  
  // Extract volume/threshold from mapped column
  let min = 0, max: number | null = null;
  if (fieldMappings.volumeField && tier[fieldMappings.volumeField] !== undefined) {
    const volumeValue = tier[fieldMappings.volumeField];
    if (typeof volumeValue === 'string') {
      // Parse range like "$0 - $1,000,000" or "$1M - $3M"
      const rangeMatch = volumeValue.match(/\$?([\d,.]+[MmKk]?)\s*[-–]\s*\$?([\d,.]+[MmKk]?)/);
      const plusMatch = volumeValue.match(/\$?([\d,.]+[MmKk]?)\+/);
      if (rangeMatch) {
        min = parseMoneyValue(rangeMatch[1]);
        max = parseMoneyValue(rangeMatch[2]);
      } else if (plusMatch) {
        min = parseMoneyValue(plusMatch[1]);
        max = null;
      } else {
        min = parseMoneyValue(volumeValue);
      }
    } else if (typeof volumeValue === 'number') {
      min = volumeValue;
    }
  } else {
    min = tier.min || 0;
    max = tier.max || null;
  }
  
  // Extract rate from mapped column
  let rate = 0;
  if (fieldMappings.rateField && tier[fieldMappings.rateField] !== undefined) {
    const rateValue = tier[fieldMappings.rateField];
    if (typeof rateValue === 'string') {
      const percentMatch = rateValue.match(/(\d+(?:\.\d+)?)\s*%?/);
      if (percentMatch) {
        rate = parseFloat(percentMatch[1]) / 100;
      }
    } else if (typeof rateValue === 'number') {
      rate = rateValue > 1 ? rateValue / 100 : rateValue;
    }
  } else {
    rate = tier.rate || tier.baseRate || 0;
  }
  
  // Extract minimum from mapped column
  let minimum: number | undefined;
  if (fieldMappings.minimumField && tier[fieldMappings.minimumField] !== undefined) {
    const minValue = tier[fieldMappings.minimumField];
    minimum = parseMoneyValue(String(minValue));
  } else {
    minimum = tier.minimumAnnual || tier.minimumPayment;
  }
  
  // Extract description from mapped column
  let description: string | undefined;
  if (fieldMappings.descriptionField && tier[fieldMappings.descriptionField] !== undefined) {
    description = String(tier[fieldMappings.descriptionField]);
  } else {
    description = tier.description;
  }
  
  return { min, max, rate, minimum, description };
}

/**
 * Parse money values like "$1,000,000", "1M", "500K", etc.
 */
function parseMoneyValue(value: string): number {
  if (!value) return 0;
  
  // Remove $ and commas
  let cleanValue = value.replace(/[$,\s]/g, '');
  
  // Handle M/K suffixes
  if (/[Mm]$/.test(cleanValue)) {
    return parseFloat(cleanValue.replace(/[Mm]$/, '')) * 1000000;
  }
  if (/[Kk]$/.test(cleanValue)) {
    return parseFloat(cleanValue.replace(/[Kk]$/, '')) * 1000;
  }
  
  return parseFloat(cleanValue) || 0;
}

/**
 * Build a FormulaDefinition from volumeTiers using field mappings
 * This enables calculation for rules that have extracted table data but no formula
 */
function buildFormulaFromTiers(volumeTiers: any[], fieldMappings?: FieldMappings): FormulaDefinition | null {
  if (!volumeTiers || volumeTiers.length === 0) return null;
  
  // Convert each tier using field mappings
  const normalizedTiers = volumeTiers.map(tier => applyFieldMappings(tier, fieldMappings));
  
  // Build tier structure for formula
  const formulaTiers = normalizedTiers.map((tier, idx) => ({
    min: tier.min,
    max: tier.max ?? undefined,
    rate: tier.rate,
    label: tier.description || `Tier ${idx + 1}`
  })).filter(t => t.rate > 0); // Only include tiers with valid rates
  
  if (formulaTiers.length === 0) return null;
  
  // Create a tiered percentage formula: netAmount * tierRate
  return {
    version: '1.0',
    name: 'Dynamic Tier Formula',
    description: 'Auto-generated from extracted tier data',
    formula: {
      type: 'multiply',
      operands: [
        { type: 'reference', field: 'netAmount' },
        {
          type: 'tier',
          reference: { type: 'reference', field: 'netAmount' },
          tiers: formulaTiers
        }
      ]
    }
  };
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
  channel?: string;
  customerCode?: string;
}

interface CalculationResult {
  totalLicenseFee: number;
  minimumGuarantee?: number;
  breakdown: CalculationBreakdownItem[];
  metadata: {
    mode: EvaluationMode;
    rulesApplied: number;
    salesProcessed: number;
    auditTrail?: any[];
    /** ID of the calculation_runs row created for this calculation (5-artifact traceability chain) */
    runId?: string;
  };
}

interface CalculationBreakdownItem {
  saleId: string;
  productName: string;
  category: string;
  territory: string;
  quantity: number;
  saleAmount: number;
  calculatedFee: number;
  ruleApplied: string;
  explanation: string;
  auditTrail?: any;
  /**
   * Provenance tag for the formula path that was actually used to compute this row.
   * One of: 'primary_formula_node' | 'table_data_field_mappings' |
   * 'base_rate_percentage' | 'fixed_amount' | 'minimum_guarantee' |
   * 'tiers_array' | 'volume_tiers_legacy' | 'direct_base_rate_final' | 'unknown'.
   * Gives Finance full visibility into why a particular formula was chosen.
   */
  formulaSource?: string;
  /** Calc phase this row was produced in. See shared/calcPhases.ts. */
  phase?: string;
  /**
   * How many source sales rows were rolled up into this breakdown row.
   * 1 for per-transaction rows; N for aggregated rebate-tier rollups.
   * Persisted to calculation_line_items.transaction_count.
   */
  transactionCount?: number;
}

/**
 * Get the evaluation mode for a contract
 * Checks contract settings first, then falls back to organization settings, then system default
 */
async function getEvaluationMode(contractId: string): Promise<EvaluationMode> {
  try {
    const contract = await db.select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
    
    if (!contract.length) {
      return 'legacy'; // Default
    }
    
    // Check if contract has universal formula definitions
    const rules = await db.select()
      .from(contractRules)
      .where(and(
        eq(contractRules.contractId, contractId),
        eq(contractRules.isActive, true)
      ));
    
    const hasFormulaDefinitions = rules.some(r => r.formulaDefinition != null);
    
    // If contract has formula definitions, use universal mode
    // Otherwise, fall back to legacy
    if (hasFormulaDefinitions) {
      return 'universal';
    }
    
    return 'legacy';
  } catch (error) {
    console.error('Error getting evaluation mode:', error);
    return 'legacy';
  }
}

/**
 * Hydrate rules with defaults from their accrual_policy (the new policy table
 * introduced in the Round 1 Flow/Subtype restructure). Today the only field
 * surfaced is `aggregation_period`: when a rule is linked to a
 * subtype_instance and its formulaDefinition does not already specify
 * `aggregationPeriod`, we copy it from the instance's CURRENT accrual_policy
 * onto a clone of the formulaDefinition. The downstream engines
 * (dynamicRulesEngine + universalCalculationEngine) already read
 * `formulaDefinition.aggregationPeriod`, so this hydration is a single
 * choke-point that wires the new policy table into the existing engines
 * without invasive refactors. Rule-level overrides still win — we only fill
 * in defaults, never overwrite.
 */
async function hydrateRulesWithPolicies<T extends { id: string; formulaDefinition?: any; subtypeInstanceId?: string | null }>(
  rules: T[]
): Promise<T[]> {
  const instanceIds = Array.from(
    new Set(rules.map(r => r.subtypeInstanceId).filter((id): id is string => !!id))
  );
  if (instanceIds.length === 0) return rules;

  const policies = await db
    .select({
      subtypeInstanceId: accrualPolicies.subtypeInstanceId,
      aggregationPeriod: accrualPolicies.aggregationPeriod,
    })
    .from(accrualPolicies)
    .where(and(inArray(accrualPolicies.subtypeInstanceId, instanceIds), eq(accrualPolicies.isCurrent, true)));

  // Normalize policy values to the engines' canonical set: annual | quarter | month.
  // Policies may store 'monthly' / 'quarterly' / 'yearly' / 'per_sale' — we map
  // recognized values, drop unknowns (per_sale falls through to the engine
  // default of 'quarter'), and preserve any rule-level override.
  const policyByInstance = new Map<string, 'annual' | 'quarter' | 'month' | null>();
  for (const p of policies) {
    const raw = String(p.aggregationPeriod ?? '').toLowerCase().trim();
    let canonical: 'annual' | 'quarter' | 'month' | null = null;
    if (raw === 'annual' || raw === 'year' || raw === 'yearly') canonical = 'annual';
    else if (raw === 'quarter' || raw === 'quarterly') canonical = 'quarter';
    else if (raw === 'month' || raw === 'monthly') canonical = 'month';
    policyByInstance.set(p.subtypeInstanceId, canonical);
  }

  return rules.map(rule => {
    if (!rule.subtypeInstanceId) return rule;
    const policyAgg = policyByInstance.get(rule.subtypeInstanceId);
    if (!policyAgg) return rule;
    const fd = (rule.formulaDefinition as any) || null;
    if (fd && fd.aggregationPeriod) return rule; // rule-level override wins
    const nextFd = { ...(fd ?? {}), aggregationPeriod: policyAgg };
    return { ...rule, formulaDefinition: nextFd } as T;
  });
}

async function loadQualifierMapForContract(contractId: string, rules: any[]): Promise<Map<string, { inclusions: string[]; exclusions: string[] }>> {
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
    if (qualRows.length === 0) return ruleQualifierMap;

    const qualsByRule = new Map<string, { inclusions: string[]; exclusions: string[] }>();
    for (const qual of qualRows) {
      if (qual.qualifierField !== 'product_category') continue;
      let matchedRuleId: string | null = null;
      if (qual.contractClauseId) {
        const ruleByClause = rules.find((r: any) => r.sourceClauseId === qual.contractClauseId);
        if (ruleByClause) matchedRuleId = ruleByClause.id;
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
        if (!qualsByRule.has(matchedRuleId)) qualsByRule.set(matchedRuleId, { inclusions: [], exclusions: [] });
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
      if (qualsByRule.has(rule.id)) {
        ruleQualifierMap.set(rule.id, qualsByRule.get(rule.id)!);
      } else {
        const cats = (rule.productCategories || []) as string[];
        const hasGeneralOnly = cats.length > 0 && cats.some((c: string) => { const v = c.toLowerCase().trim(); return v === 'general' || v === 'all'; });
        if (hasGeneralOnly) {
          const allExclusions: string[] = [];
          for (const [otherRuleId, otherQuals] of qualsByRule) {
            if (otherRuleId !== rule.id) {
              for (const inc of otherQuals.inclusions) {
                if (!allExclusions.includes(inc)) allExclusions.push(inc);
              }
            }
          }
          if (allExclusions.length > 0) {
            ruleQualifierMap.set(rule.id, { inclusions: ['General'], exclusions: allExclusions });
          }
        }
      }
    }
    console.log(`[CALC] Loaded ${qualRows.length} qualifiers from contract_qualifiers for ${ruleQualifierMap.size} rules`);
    for (const [ruleId, quals] of ruleQualifierMap) {
      const ruleName = rules.find((r: any) => r.id === ruleId)?.ruleName || ruleId;
      console.log(`[CALC]   Rule "${ruleName}": inclusions=[${quals.inclusions.join(',')}] exclusions=[${quals.exclusions.join(',')}]`);
    }
    return ruleQualifierMap;
  } catch (error) {
    console.error('[CALC] Error loading contract_qualifiers:', error);
    return ruleQualifierMap;
  }
}

function ruleMatchesSaleByQualifiers(
  sale: { productName: string; category?: string; territory?: string; channel?: string },
  ruleId: string,
  qualifierMap: Map<string, { inclusions: string[]; exclusions: string[] }>,
  productCategories: string[],
  rule?: { territories?: string[] | null; customerSegments?: string[] | null; channel?: string | null }
): boolean {
  const qualifiers = qualifierMap.get(ruleId);
  return sharedRuleMatchesSale(
    { productName: sale.productName, category: sale.category, territory: sale.territory, channel: sale.channel },
    {
      id: ruleId,
      productCategories: productCategories,
      territories: rule?.territories as string[] | null,
      channel: rule?.channel,
    },
    qualifiers
  );
}

/**
 * Calculate contract fees for a contract using the appropriate evaluation mode
 */
export async function calculateLicenseFees(
  contractId: string,
  salesItems: SaleItem[],
  options?: {
    mode?: EvaluationMode;
    validateResults?: boolean;
  }
): Promise<CalculationResult> {
  const mode = options?.mode || await getEvaluationMode(contractId);
  
  if (mode === 'legacy') {
    return calculateWithLegacyEngine(contractId, salesItems);
  } else if (mode === 'universal') {
    return calculateWithUniversalEvaluator(contractId, salesItems, options?.validateResults);
  } else {
    // Hybrid mode: use universal for rules with formulaDefinition, legacy for others
    return calculateWithHybridMode(contractId, salesItems, options?.validateResults);
  }
}

// Legacy engine: hard-gated to single-phase (gross_calc) contracts. Multi-phase
// contracts must use the universal evaluator. Breakdown rows are phase-stamped
// for downstream reporting.
async function calculateWithLegacyEngine(
  contractId: string,
  salesItems: SaleItem[]
): Promise<CalculationResult> {
  const activeRulesRaw = await storage.getActiveRoyaltyRulesByContract(contractId);
  const activeRules = await hydrateRulesWithPolicies(activeRulesRaw as any[]);
  const nonGrossRules = activeRules.filter(r => resolveCalcPhase(r) !== 'gross_calc');
  if (nonGrossRules.length > 0) {
    throw new Error(
      `Legacy evaluation mode does not support multi-phase contracts. Contract ${contractId} has ${nonGrossRules.length} non-gross_calc rule(s); use universal mode.`
    );
  }
  const rulesByName = new Map(activeRules.map(r => [r.ruleName, r]));
  const result = await dynamicRulesEngine.calculateRoyalty(contractId, salesItems);

  return {
    totalLicenseFee: result.totalRoyalty,
    breakdown: result.breakdown.map(item => ({
      phase: resolveCalcPhase(rulesByName.get(item.ruleApplied) || { ruleType: 'unknown' }),
      saleId: item.saleId,
      productName: item.productName,
      category: item.category,
      territory: item.territory,
      quantity: item.quantity,
      saleAmount: item.grossAmount || 0,
      grossAmount: item.grossAmount || 0,
      calculatedFee: item.calculatedRoyalty,
      calculatedRoyalty: item.calculatedRoyalty,
      ruleApplied: item.ruleApplied,
      explanation: item.explanation,
      baseRate: item.baseRate || 0,
      tierRate: item.tierRate || 0,
      effectiveRate: item.tierRate || item.baseRate || 0,
      seasonalMultiplier: item.seasonalMultiplier || 1,
      territoryMultiplier: item.territoryMultiplier || 1,
      calculationType: item.calculationType || 'percentage',
      calculationSteps: item.calculationSteps || [],
      conditionsChecked: item.conditionsChecked || [],
      ruleSnapshot: item.ruleSnapshot || null,
      volumeDiscountApplied: item.volumeDiscountApplied || false,
      volumeThresholdMet: item.volumeThresholdMet || null,
    })),
    metadata: {
      mode: 'legacy' as EvaluationMode,
      rulesApplied: Array.isArray(result.rulesApplied) ? result.rulesApplied.length : result.breakdown.length,
      salesProcessed: salesItems.length
    }
  };
}

/**
 * Calculate using the universal formula evaluator
 */
async function calculateWithUniversalEvaluator(
  contractId: string,
  salesItems: SaleItem[],
  validateResults?: boolean
): Promise<CalculationResult> {
  // Get active + APPROVED rules with formula definitions.
  // Approval gate: only rules with approvalStatus='approved' are eligible
  // for fee calculations. 'pending' / 'rejected' rules are excluded.
  // Engine evaluates rules in fixed phase order, then by priority within a
  // phase. We pull all approved active rules, then sort in-process via the
  // shared `comparePhaseThenPriority` so phase + priority semantics live in
  // one place (shared/calcPhases.ts) and stay consistent with the UI.
  const rulesUnorderedRaw = await db.select()
    .from(contractRules)
    .where(and(
      eq(contractRules.contractId, contractId),
      eq(contractRules.isActive, true),
      eq(contractRules.approvalStatus, 'approved')
    ));
  const rulesUnordered = await hydrateRulesWithPolicies(rulesUnorderedRaw as any[]);
  const rules = [...rulesUnordered].sort(comparePhaseThenPriority);

  // Engine log: surface phase ordering so ops can verify rules executed in
  // the documented phase sequence (slice 1 verification step).
  if (rules.length > 0) {
    const phaseGroups: Record<string, string[]> = {};
    for (const r of rules) {
      const ph = resolveCalcPhase(r);
      (phaseGroups[ph] ||= []).push(`${r.ruleName} (p${r.priority ?? 10})`);
    }
    console.log(`[CALC] Phase order for ${contractId}:`);
    for (const ph of CALC_PHASES) {
      if (phaseGroups[ph]) {
        console.log(`[CALC]   ${ph}: ${phaseGroups[ph].join(', ')}`);
      }
    }
  }

  // Edge case: if no approved rules are eligible, check whether there are pending
  // rules so Finance gets a clear actionable message instead of a silent $0 result.
  if (rules.length === 0) {
    const pendingRules = await db.select()
      .from(contractRules)
      .where(and(
        eq(contractRules.contractId, contractId),
        eq(contractRules.isActive, true),
        eq(contractRules.approvalStatus, 'pending')
      ));
    if (pendingRules.length > 0) {
      return {
        totalLicenseFee: 0,
        breakdown: [],
        metadata: {
          mode: 'universal' as EvaluationMode,
          rulesApplied: 0,
          salesProcessed: salesItems.length,
          auditTrail: [{
            type: 'pending_approval_block',
            pendingApprovalCount: pendingRules.length,
            message: `${pendingRules.length} rule(s) are pending approval. Approve rules before running calculations.`,
          }],
        },
      };
    }
  }

  const qualifierMap = await loadQualifierMapForContract(contractId, rules);

  // 🔌 Phase-1 OFOV engine integration: load full Condition[] per rule and
  // build a SaleEnricher that pre-loads master rows once for the contract's
  // company. Each per-sale loop iteration enriches the sale and filters
  // candidate rules by their *extended* (non-default-attribute) conditions
  // BEFORE specificity-based selection. Rules with only legacy conditions
  // (e.g. product/category/territory string-arrays) are unaffected.
  const conditionsByKey = await loadConditionsForContract(contractId);
  const ruleExtendedConds = new Map<string, Condition[]>();
  for (const rule of rules) {
    const fromRuleKey = conditionsByKey.get(`rule:${rule.id}`) || [];
    const fromClauseKey = rule.sourceClauseId
      ? conditionsByKey.get(`clause:${rule.sourceClauseId}`) || []
      : [];
    const all = [...fromRuleKey, ...fromClauseKey];
    const extended = all.filter(isExtendedCondition);
    if (extended.length > 0) ruleExtendedConds.set(rule.id, extended);
  }
  const calcCompanyId = (await db.select({ companyId: contracts.companyId })
    .from(contracts).where(eq(contracts.id, contractId)).limit(1))[0]?.companyId;
  const enricher = new SaleEnricher(contractId, calcCompanyId || '');
  if (calcCompanyId && ruleExtendedConds.size > 0) {
    await enricher.init();
    console.log(`[CALC] OFOV: ${ruleExtendedConds.size} rules carry extended attribute conditions`);
  }

  let baseMetricLookup: Map<string, string> | null = null;
  try {
    const bmRows = await db.select({ code: baseMetrics.code, salesColumn: baseMetrics.salesColumn }).from(baseMetrics);
    baseMetricLookup = new Map(bmRows.filter(r => r.salesColumn).map(r => [r.code, r.salesColumn!]));
  } catch (e) {
    console.error('[CALC] Failed to load base metric mappings from database:', e);
  }

  const breakdown: CalculationBreakdownItem[] = [];
  let totalFee = 0;
  const allAuditTrails: any[] = [];

  // 🔗 Five-artifact traceability: open a calculation_runs row before the sales loop.
  // Each per-sale / per-rule result will be persisted as a calculation_audit_items row,
  // giving Finance a permanent, immutable record of every formula path that was applied.
  const contractRow = await db.select({ companyId: contracts.companyId })
    .from(contracts).where(eq(contracts.id, contractId)).limit(1);
  const runCompanyId = contractRow[0]?.companyId || 'unknown';
  const [runRow] = await db.insert(calculationRuns).values({
    companyId: runCompanyId,
    contractId,
    evaluationMode: 'universal',
    status: 'draft',
  }).returning({ id: calculationRuns.id });
  const runId = runRow.id;
  const auditItemsToInsert: InsertCalculationAuditItem[] = [];

  // Per-sale matcher considers only gross_calc rules; minimum_guarantee
  // is excluded explicitly so MG rows never enter the per-sale loop even
  // when their backfilled phase is gross_calc.
  const perSaleRules = rules.filter(rule => {
    const ruleTypeLower = (rule.ruleType || '').toLowerCase();
    if (ruleTypeLower === 'minimum_guarantee') return false;
    if (resolveCalcPhase(rule) !== 'gross_calc') return false;
    if (sharedIsContractLevelFixedFee(rule as any)) return false;
    return true;
  });

  // ─── STEP A: Identify rebate_tiered rules ───────────────────────────────────
  const rebateTieredRules = rules.filter(r =>
    r.ruleType === 'rebate_tiered' ||
    ((r.ruleType === 'tiered' || r.ruleType === 'tiered_pricing') &&
     (r.ruleName || '').toLowerCase().includes('rebate'))
  );

  // ─── STEP B: If any rebate_tiered rules exist, run them through the universal
  //             quarterly engine. salesHandledByQuarterly tracks which sale IDs
  //             were consumed so the per-sale loop below skips them (anti-double-count).
  const salesHandledByQuarterly = new Set<string>();

  if (rebateTieredRules.length > 0) {
    for (const rule of rebateTieredRules) {
      const rulePhase = resolveCalcPhase(rule);
      const fd = (rule.formulaDefinition as any) || {};
      const fieldMappings = rule.fieldMappings as FieldMappings | undefined;

      // Resolve amount field via baseMetric lookup (same logic as per-sale path)
      let amountField = 'netAmount';
      const bmCode = ((rule as any).baseMetric || '').toLowerCase().trim();
      if (baseMetricLookup && baseMetricLookup.has(bmCode)) {
        const dbCol = baseMetricLookup.get(bmCode)!;
        const colToField: Record<string, string> = {
          gross_amount: 'grossAmount', net_amount: 'netAmount',
          quantity: 'quantity', unit_price: 'unitPrice',
        };
        amountField = colToField[dbCol] || 'netAmount';
      } else if (fd.calculationBasis?.toLowerCase().includes('gross')) {
        amountField = 'grossAmount';
      }

      // Build the tiers array from formulaDefinition or volumeTiers (same fallback order
      // as per-sale path so behaviour is consistent)
      let tiers = fd.tiers || fd.calculation?.tiers || null;
      if (!tiers && rule.volumeTiers && Array.isArray(rule.volumeTiers)) {
        tiers = rule.volumeTiers;
      }
      if (!tiers || tiers.length === 0) {
        console.warn(`[CALC] rebate_tiered rule "${rule.ruleName}" has no tiers — skipping quarterly path`);
        continue;
      }

      // Build a minimal FormulaDefinition with the tiers array and optional tierMode
      const rebateFormula: any = {
        type: rule.ruleType || 'rebate_tiered',
        tiers,
        tierMode: fd.tierMode || 'whole',
        // Forward explicit tier basis (column wins, formulaDefinition mirror as fallback)
        // so the universal engine doesn't have to fall back to the magnitude heuristic.
        tierBasis: (rule as any).tierBasis ?? fd.tierBasis ?? null,
        // Forward the rule's measurement-period bucketing so the engine
        // sums sales over the configured window (annual/quarter/month).
        // Without this, contracts with annual rebates were silently
        // bucketed into quarters and produced multi-tier-1 totals instead
        // of one annual tier match.
        aggregationPeriod: fd.aggregationPeriod ?? null,
        notes: fd.notes || [],
      };

      // Execute quarterly aggregation through the universal engine
      const quarterlyResults = calculationEngine.executeRebateTieredRule(
        rule.ruleName || 'Rebate Tiered',
        rebateFormula,
        salesItems as any[],
        { amountField, quantityField: 'quantity', productField: 'productName', dateField: 'transactionDate' }
      );

      // Accumulate breakdown, total, and audit items
      for (const qResult of quarterlyResults) {
        const fee = qResult.calculatedAmount;
        const productLabel = (qResult as any).productName || qResult.tierDescription || rule.ruleName || '';
        const contributingSaleIds: string[] = (qResult as any).saleIds || [];
        breakdown.push({
          saleId: `quarterly-${productLabel}`,
          productName: productLabel,
          category: '',
          territory: '',
          quantity: (qResult as any).quantity ?? 0,
          saleAmount: qResult.inputValue,
          calculatedFee: fee,
          ruleApplied: rule.ruleName || 'Rebate Tiered',
          explanation: qResult.breakdown.join(' | '),
          auditTrail: qResult.conditionsChecked || [],
          formulaSource: 'rebate_tiered_quarterly_universal',
          phase: rulePhase,
          transactionCount: contributingSaleIds.length || 1,
        });
        auditItemsToInsert.push({
          runId,
          ruleId: rule.id,
          contractId,
          sourceClauseRef: (rule as any).sourceClauseId || null,
          transactionIds: [],
          inputValue: String(qResult.inputValue),
          calculatedAmount: String(fee),
          formulaSource: 'rebate_tiered_quarterly_universal',
          formulaSnapshot: rebateFormula,
          tierMode: rebateFormula.tierMode,
          breakdown: { steps: qResult.breakdown, conditions: qResult.conditionsChecked },
        });
        totalFee += fee;
      }

      // Mark all sales as handled so per-sale loop skips them
      for (const sale of salesItems) {
        salesHandledByQuarterly.add(sale.id);
      }
      console.log(`[CALC] rebate_tiered "${rule.ruleName}": ${quarterlyResults.length} quarterly results, total $${totalFee.toFixed(2)}`);
    }
  }

  for (const sale of salesItems) {
    // Skip sales already consumed by quarterly rebate aggregation
    if (salesHandledByQuarterly.has(sale.id)) continue;

    let saleProcessed = false;
    let formulaSource: string = 'unknown';
    
    const saleForMatch: SaleForMatching = {
      productName: sale.productName || '',
      category: sale.category || '',
      territory: sale.territory || '',
      channel: (sale as any).channel || '',
    };

    // OFOV: enrich once per sale and pre-filter rules whose extended
    // attribute conditions reject this sale (e.g. customer.segment != "VIP",
    // partner.partner_type != "Distributor", product_attribute.Brand="Acme").
    let candidateRules = perSaleRules;
    if (ruleExtendedConds.size > 0 && calcCompanyId) {
      const enriched: EnrichedSale = enricher.enrich({
        productName: sale.productName,
        productCode: (sale as any).productCode ?? null,
        category: sale.category,
        territory: sale.territory,
        channel: (sale as any).channel,
        customerCode: (sale as any).customerCode ?? null,
      });
      candidateRules = perSaleRules.filter(r => {
        const conds = ruleExtendedConds.get(r.id);
        if (!conds || conds.length === 0) return true;
        return evaluateAttributeConditions(conds, enriched);
      });
    }

    // Within gross_calc, selection is specificity-first with priority as
    // tiebreaker (preserved pre-slice-1 behaviour).
    const bestRule = findBestMatchingRule(
      saleForMatch,
      candidateRules.map(r => ({
        id: r.id,
        ruleName: r.ruleName || undefined,
        ruleType: r.ruleType || undefined,
        baseRate: r.baseRate,
        productCategories: (r.productCategories || []) as string[],
        territories: r.territories as string[] | null,
        channel: r.channel as string | null,
        priority: r.priority,
      })),
      qualifierMap
    );

    if (bestRule) {
      const rule = rules.find(r => r.id === bestRule.id)!;
      const rulePhase = resolveCalcPhase(rule);

      if (rule.effectiveDate && sale.transactionDate < rule.effectiveDate) continue;
      if (rule.expiryDate && sale.transactionDate > rule.expiryDate) continue;
      
      // Get field mappings for dynamic column support
      const fieldMappings = rule.fieldMappings as FieldMappings | undefined;
      
      // Build or retrieve formula from rule
      let formula: FormulaDefinition | null = null;
      
      if (rule.formulaDefinition) {
        const fd = rule.formulaDefinition as any;
        
        // Check if formulaDefinition has an executable formula node
        if (fd.formula && fd.formula.type) {
          formula = fd as FormulaDefinition;
          formulaSource = 'primary_formula_node';
        }
        // If formulaDefinition has tableData but no formula, build one on-the-fly
        if (!formula && fd.tableData && fd.tableData.rows && fd.tableData.rows.length > 0 && fieldMappings) {
          try {
            console.log(`[CALC] Building formula on-the-fly for rule: ${rule.ruleName}`);
            formula = buildFormulaDefinition({
              tableData: fd.tableData,
              fieldMappings: {
                volume: fieldMappings.volumeField,
                rate: fieldMappings.rateField,
                minimum: fieldMappings.minimumField,
                description: fieldMappings.descriptionField,
              },
              ruleName: rule.ruleName || 'Dynamic Rule',
              minimumGuarantee: rule.minimumGuarantee ? parseFloat(rule.minimumGuarantee) : undefined,
            });
            console.log(`[CALC] Built formula with type: ${formula?.formula?.type}`);
            if (formula?.formula?.type === 'literal') {
              console.log(`[CALC] Literal formula is not useful for calculation, discarding for rule: ${rule.ruleName}`);
              formula = null;
            } else if (formula) {
              formulaSource = 'table_data_field_mappings';
            }
          } catch (err) {
            console.error(`[CALC] Error building formula for rule ${rule.ruleName}:`, err);
          }
        }
        // Fallback: AI-extracted rule with baseRate - build simple percentage formula
        if (!formula && fd.baseRate && typeof fd.baseRate === 'number') {
          console.log(`[CALC] Building formula from AI-extracted baseRate for rule: ${rule.ruleName} (rate: ${fd.baseRate})`);
          let basisField = 'grossAmount';
          const bmCode = ((rule as any).baseMetric || '').toLowerCase().trim();
          if (baseMetricLookup && baseMetricLookup.has(bmCode)) {
            const dbSalesCol = baseMetricLookup.get(bmCode)!;
            const colToField: Record<string, string> = { gross_amount: 'grossAmount', net_amount: 'netAmount', quantity: 'quantity', unit_price: 'unitPrice' };
            basisField = colToField[dbSalesCol] || 'grossAmount';
          } else if (fd.calculationBasis?.toLowerCase().includes('net')) {
            basisField = 'netAmount';
          }
          const dbRuleType = rule.ruleType || '';
          const fdType = (fd.type || '').toLowerCase();
          const isPercentage = fdType === 'percentage' || dbRuleType === 'percentage' || !fd.type ||
            fdType.includes('rebate') || fdType.includes('rate');
          const isFixedFee = fdType === 'fixed_fee' || dbRuleType === 'fixed_fee';
          
          if (isFixedFee && fd.fixedAmount) {
            formula = {
              version: '1.0',
              name: rule.ruleName || 'AI-Extracted Fixed Fee Rule',
              formula: {
                type: 'multiply',
                operands: [
                  { type: 'reference', field: 'quantity' },
                  { type: 'literal', value: fd.fixedAmount }
                ]
              }
            } as unknown as FormulaDefinition;
            formulaSource = 'fixed_amount';
          } else if (isPercentage || !isFixedFee) {
            const rateDecimal = fd.baseRate / 100;
            formula = {
              version: '1.0',
              name: rule.ruleName || 'AI-Extracted Percentage Rule',
              formula: {
                type: 'multiply',
                operands: [
                  { type: 'reference', field: basisField },
                  { type: 'literal', value: rateDecimal }
                ]
              }
            } as unknown as FormulaDefinition;
            formulaSource = 'base_rate_percentage';
          }
        }
        // Fallback: fixed_fee or bonus rules with fixedAmount but no baseRate
        if (!formula && fd.fixedAmount && typeof fd.fixedAmount === 'number') {
          const fdType = (fd.type || '').toLowerCase();
          const dbRuleType = rule.ruleType || '';
          const isFixedFee = fdType === 'fixed_fee' || dbRuleType === 'fixed_fee' || 
            fdType.includes('bonus') || fdType.includes('fixed');
          if (isFixedFee) {
            const thresholdValue = fd.threshold || fd.bonusThreshold || fd.minimumGuarantee || 0;
            console.log(`[CALC] Building formula from fixedAmount for rule: ${rule.ruleName} (amount: ${fd.fixedAmount}, threshold: ${thresholdValue})`);
            if (thresholdValue > 0) {
              formula = {
                version: '1.0',
                name: rule.ruleName || 'AI-Extracted Fixed Fee Rule',
                formula: {
                  type: 'if',
                  condition: {
                    field: 'quantity',
                    operator: 'greaterThan',
                    value: thresholdValue - 1
                  },
                  then: {
                    type: 'multiply',
                    operands: [
                      { type: 'reference', field: 'quantity' },
                      { type: 'literal', value: fd.fixedAmount }
                    ]
                  },
                  else: { type: 'literal', value: 0 }
                }
              } as unknown as FormulaDefinition;
              formulaSource = 'fixed_amount';
            } else {
              formula = {
                version: '1.0',
                name: rule.ruleName || 'AI-Extracted Fixed Fee Rule',
                formula: {
                  type: 'multiply',
                  operands: [
                    { type: 'reference', field: 'quantity' },
                    { type: 'literal', value: fd.fixedAmount }
                  ]
                }
              } as unknown as FormulaDefinition;
              formulaSource = 'fixed_amount';
            }
          }
        }
        // Fallback: minimum_guarantee rules
        else if ((fd.type === 'minimum_guarantee' || rule.ruleType === 'minimum_guarantee') && fd.minimumGuarantee) {
          const fixedAmt = fd.fixedAmount || fd.bonusRate || 0;
          const threshold = fd.minimumGuarantee;
          if (fixedAmt > 0) {
            console.log(`[CALC] Building formula from minimum_guarantee for rule: ${rule.ruleName} (threshold: ${threshold}, amount: ${fixedAmt})`);
            formula = {
              version: '1.0',
              name: rule.ruleName || 'AI-Extracted Minimum Guarantee Rule',
              formula: {
                type: 'if',
                condition: {
                  field: 'quantity',
                  operator: 'greaterThan',
                  value: threshold - 1
                },
                then: {
                  type: 'multiply',
                  operands: [
                    { type: 'reference', field: 'quantity' },
                    { type: 'literal', value: fixedAmt }
                  ]
                },
                else: { type: 'literal', value: 0 }
              }
            } as unknown as FormulaDefinition;
            formulaSource = 'minimum_guarantee';
          }
        }
        // Fallback: AI-extracted tiered rule with tiers array
        if (!formula && fd.tiers && Array.isArray(fd.tiers) && fd.tiers.length > 0) {
          const tiersWithRates = fd.tiers.filter((t: any) => t.rate > 0);
          if (tiersWithRates.length > 0) {
            console.log(`[CALC] Building formula from AI-extracted tiers for rule: ${rule.ruleName}`);
            formula = buildFormulaFromTiers(tiersWithRates, fieldMappings);
            if (formula) formulaSource = 'tiers_array';
          }
        }
      }
      if (!formula && rule.volumeTiers && Array.isArray(rule.volumeTiers) && rule.volumeTiers.length > 0) {
        const vt = rule.volumeTiers as any[];
        formula = buildFormulaFromTiers(vt, fieldMappings);
        if (formula) formulaSource = 'volume_tiers_legacy';
      }
      // Final fallback: use base_rate directly from rule
      if (!formula && rule.baseRate) {
        const rate = parseFloat(rule.baseRate);
        if (rate !== 0 && !isNaN(rate)) {
          const bm = ((rule as any).baseMetric || '').toLowerCase().trim();
          const rt = (rule.ruleType || '').toLowerCase().trim();

          let referenceField = 'grossAmount';
          if (baseMetricLookup && baseMetricLookup.has(bm)) {
            const dbSalesCol = baseMetricLookup.get(bm)!;
            const colToField: Record<string, string> = {
              gross_amount: 'grossAmount',
              net_amount: 'netAmount',
              quantity: 'quantity',
              unit_price: 'unitPrice',
            };
            referenceField = colToField[dbSalesCol] || 'grossAmount';
            console.log(`[CALC] Base metric "${bm}" mapped to sales_data.${dbSalesCol} (field: ${referenceField}) via database`);
          } else {
            const isUnitBased = bm === 'units' || bm === 'quantity' || bm === 'unit' ||
              rt === 'fixed_fee' || rt === 'per_unit' || rt === 'per-unit';
            referenceField = isUnitBased ? 'quantity' : 'grossAmount';
          }

          const isPercentageType = rt === 'percentage' || rt === 'rebate' || rt === 'rebate_tiered' || 
            rt === 'milestone_tiered' || rt === '' || rt === 'royalty';
          let effectiveRate: number;
          if (isPercentageType) {
            if (rate > 0 && rate < 1) {
              effectiveRate = rate;
              console.log(`[CALC] base_rate ${rate} appears to be decimal already (< 1), using directly as rate`);
            } else {
              effectiveRate = rate / 100;
            }
          } else {
            effectiveRate = rate;
          }
          console.log(`[CALC] Final fallback for rule "${rule.ruleName}": baseRate=${rate}, effectiveRate=${effectiveRate}, baseMetric="${bm}", ruleType="${rt}", using field="${referenceField}"`);
          
          formula = {
            version: '1.0',
            name: rule.ruleName || 'Direct Rate Rule',
            formula: {
              type: 'multiply',
              operands: [
                { type: 'reference', field: referenceField },
                { type: 'literal', value: effectiveRate }
              ]
            }
          } as unknown as FormulaDefinition;
          formulaSource = 'direct_base_rate_final';
        }
      }
      
      if (!formula) {
        console.log(`[CALC] No formula available for rule: ${rule.ruleName}`);
        continue;
      }
      
      // Build evaluation context from sale item
      // Include multiple field name variants for compatibility with different formula references
      const context: EvaluationContext = {
        // Standard field names
        grossAmount: sale.grossAmount,
        netAmount: sale.netAmount || sale.grossAmount,
        quantity: sale.quantity,
        units: sale.quantity, // Alias
        productName: sale.productName,
        category: sale.category,
        territory: sale.territory,
        containerSize: sale.containerSize || '',
        transactionDate: sale.transactionDate,
        unitPrice: sale.grossAmount / (sale.quantity || 1),
        // Extended fields object for reference lookups
        fields: {
          grossAmount: sale.grossAmount,
          netAmount: sale.netAmount || sale.grossAmount,
          productName: sale.productName,
          category: sale.category,
          territory: sale.territory,
          containerSize: sale.containerSize || '',
          transactionDate: sale.transactionDate.toISOString(),
          quantity: sale.quantity,
          units: sale.quantity
        }
      };
      
      try {
        const result = evaluateFormulaDefinition(formula, context);
        
        if (result.success) {
          let finalValue = result.value;
          
          if (rule.minimumPrice) {
            const minPrice = parseFloat(rule.minimumPrice);
            if (minPrice > 0 && finalValue < minPrice) {
              result.auditTrail.push({
                step: result.auditTrail.length + 1,
                description: `Minimum price enforcement: ${finalValue.toFixed(2)} < ${minPrice.toFixed(2)}, using minimum`,
                value: minPrice
              });
              finalValue = minPrice;
            }
          }
          
          const explanation = result.auditTrail.length > 0 
            ? result.auditTrail.map(step => step.description).join(' → ')
            : `Calculated ${finalValue} using formula`;
          
          const ruleBaseRate = rule.baseRate ? parseFloat(rule.baseRate) : 0;
          const ruleTypeStr = rule.ruleType || '';
          const isPercType = ['percentage', 'rebate_percentage', 'rebate_tiered', 'milestone_tiered'].includes(ruleTypeStr);
          breakdown.push({
            saleId: sale.id,
            productName: sale.productName,
            category: sale.category,
            territory: sale.territory,
            quantity: sale.quantity,
            saleAmount: sale.grossAmount,
            calculatedFee: finalValue,
            ruleApplied: rule.ruleName,
            ruleType: ruleTypeStr,
            baseRate: ruleBaseRate,
            tierRate: ruleBaseRate,
            appliedRate: isPercType ? ruleBaseRate / 100 : ruleBaseRate,
            explanation,
            auditTrail: result.auditTrail,
            formulaSource,
            phase: rulePhase,
          });
          auditItemsToInsert.push({
            runId,
            ruleId: rule.id,
            contractId,
            sourceClauseRef: (rule as any).sourceClauseId || null,
            transactionIds: [sale.id],
            inputValue: String(sale.grossAmount ?? 0),
            calculatedAmount: String(finalValue),
            formulaSource,
            formulaSnapshot: (rule as any).formulaDefinition || null,
            tierMode: (rule as any).tierMode || null,
            breakdown: { explanation, auditTrail: result.auditTrail },
          });

          totalFee += finalValue;
          allAuditTrails.push(...result.auditTrail);
          saleProcessed = true;
        }
      } catch (error) {
        console.error(`Error evaluating formula for rule ${rule.id}:`, error);
      }
    }
    
    if (!saleProcessed) {
      breakdown.push({
        saleId: sale.id,
        productName: sale.productName,
        category: sale.category,
        territory: sale.territory,
        quantity: sale.quantity,
        saleAmount: sale.grossAmount,
        calculatedFee: 0,
        ruleApplied: 'No matching rule',
        ruleType: '',
        baseRate: 0,
        tierRate: 0,
        appliedRate: 0,
        explanation: 'No applicable rule found for this transaction',
        formulaSource: 'unknown',
        phase: 'gross_calc',
      });
    }
  }
  
  const fixedFeeRules = rules.filter(r => sharedIsContractLevelFixedFee(r as any));
  for (const rule of fixedFeeRules) {
    const rulePhase = resolveCalcPhase(rule);
    const fixedAmount = rule.baseRate ? parseFloat(rule.baseRate) : 0;
    if (fixedAmount > 0) {
      breakdown.push({
        saleId: 'contract-level',
        productName: rule.ruleName || 'Fixed Fee',
        category: '',
        territory: '',
        quantity: 1,
        saleAmount: fixedAmount,
        calculatedFee: fixedAmount,
        ruleApplied: rule.ruleName,
        explanation: `Contract-level fixed fee: $${fixedAmount.toFixed(2)} (applied once per calculation period)`,
        formulaSource: 'fixed_amount',
        phase: rulePhase,
      });
      auditItemsToInsert.push({
        runId,
        ruleId: rule.id,
        contractId,
        sourceClauseRef: (rule as any).sourceClauseId || null,
        transactionIds: [],
        inputValue: String(fixedAmount),
        calculatedAmount: String(fixedAmount),
        formulaSource: 'fixed_amount',
        formulaSnapshot: (rule as any).formulaDefinition || null,
        tierMode: (rule as any).tierMode || null,
        breakdown: { explanation: `Contract-level fixed fee applied once per period` },
      });
      totalFee += fixedAmount;
    }
  }

  const ruleMatchCounts: Record<string, number> = {};
  for (const b of breakdown) {
    const key = b.ruleApplied || 'No matching rule';
    ruleMatchCounts[key] = (ruleMatchCounts[key] || 0) + 1;
  }
  console.log(`[CALC] Calculation complete: ${salesItems.length} sales, total fee=${totalFee.toFixed(2)}`);
  for (const [ruleName, count] of Object.entries(ruleMatchCounts)) {
    console.log(`[CALC]   ${ruleName}: ${count} sales`);
  }

  // 🔒 Minimum Guarantee true-up: apply after all per-sale + fixed-fee rules
  let minimumGuaranteeValue: number | undefined;
  const guaranteeRule = rules.find(r => (r.ruleType || '').toLowerCase() === 'minimum_guarantee');
  if (guaranteeRule && guaranteeRule.minimumGuarantee) {
    const guaranteeAmount = parseFloat(guaranteeRule.minimumGuarantee);
    if (guaranteeAmount > 0) {
      minimumGuaranteeValue = guaranteeAmount;
      if (totalFee < guaranteeAmount) {
        const trueUp = guaranteeAmount - totalFee;
        console.log(`[CALC] 🔒 Minimum guarantee true-up: $${totalFee.toFixed(2)} < $${guaranteeAmount.toFixed(2)}, adding shortfall $${trueUp.toFixed(2)}`);
        breakdown.push({
          saleId: 'minimum-guarantee-trueup',
          productName: guaranteeRule.ruleName || 'Annual Minimum Royalty Guarantee',
          category: '',
          territory: '',
          quantity: 1,
          saleAmount: trueUp,
          calculatedFee: trueUp,
          ruleApplied: guaranteeRule.ruleName || 'Annual Minimum Royalty Guarantee',
          explanation: `Minimum guarantee true-up: calculated fees $${totalFee.toFixed(2)} fell short of guarantee $${guaranteeAmount.toFixed(2)}, adding shortfall $${trueUp.toFixed(2)}`,
          formulaSource: 'minimum_guarantee',
          phase: resolveCalcPhase(guaranteeRule),
        } as CalculationBreakdownItem);
        totalFee = guaranteeAmount;
      } else {
        console.log(`[CALC] 🔒 Minimum guarantee $${guaranteeAmount.toFixed(2)} met by calculated fees $${totalFee.toFixed(2)} - no true-up needed`);
      }
    }
  }

  // 🔗 Persist all audit items in one round-trip and finalize the run with totals + per-rule formula provenance
  try {
    if (auditItemsToInsert.length > 0) {
      await db.insert(calculationAuditItems).values(auditItemsToInsert);
    }
    const formulaSourceSummary: Record<string, string> = {};
    for (const b of breakdown) {
      if (b.ruleApplied && b.ruleApplied !== 'No matching rule' && !formulaSourceSummary[b.ruleApplied]) {
        formulaSourceSummary[b.ruleApplied] = b.formulaSource || 'unknown';
      }
    }
    await db.update(calculationRuns)
      .set({ totalAmount: String(totalFee), formulaSourceSummary })
      .where(eq(calculationRuns.id, runId));
  } catch (e) {
    console.error('[CALC] Failed to persist calculation_runs / calculation_audit_items:', e);
  }

  return {
    totalLicenseFee: totalFee,
    minimumGuarantee: minimumGuaranteeValue,
    breakdown,
    metadata: {
      mode: 'universal' as EvaluationMode,
      rulesApplied: new Set(breakdown.filter(b => b.calculatedFee > 0).map(b => b.ruleApplied)).size,
      salesProcessed: salesItems.length,
      auditTrail: allAuditTrails,
      runId,
    }
  };
}

/**
 * Calculate using hybrid mode - universal for rules with formulaDefinition, legacy for others
 */
async function calculateWithHybridMode(
  contractId: string,
  salesItems: SaleItem[],
  validateResults?: boolean
): Promise<CalculationResult> {
  // For now, delegate to universal if any rules have formulas, otherwise use legacy
  const rules = await db.select()
    .from(contractRules)
    .where(and(
      eq(contractRules.contractId, contractId),
      eq(contractRules.isActive, true)
    ));
  
  const hasFormulas = rules.some(r => r.formulaDefinition != null);
  
  if (hasFormulas) {
    return calculateWithUniversalEvaluator(contractId, salesItems, validateResults);
  } else {
    return calculateWithLegacyEngine(contractId, salesItems);
  }
}

/**
 * Validate rules for a contract and update their validation status
 */
export async function validateContractRules(contractId: string): Promise<{
  totalRules: number;
  validated: number;
  passed: number;
  failed: number;
}> {
  const rules = await db.select()
    .from(contractRules)
    .where(eq(contractRules.contractId, contractId));
  
  let validated = 0;
  let passed = 0;
  let failed = 0;
  
  for (const rule of rules) {
    const formulaDef = rule.formulaDefinition as FormulaDefinition | null;
    const calculation = formulaDef?.formula ? extractCalculationFromFormula(formulaDef.formula) : undefined;

    // Two validation modes:
    //   (a) Document-extracted rule (sourceText present): cross-check
    //       extracted numeric values against the source span — that's what
    //       validateRuleExtraction does. This is the AI-extraction path.
    //   (b) Template / hand-curated rule (sourceText empty): there is no
    //       source span to cross-check, so we instead verify the formula
    //       is structurally calculable. Without this branch, every
    //       template-created contract reports "0 of 0 rules" on Re-run
    //       Validation because the loop used to `continue` on missing
    //       sourceText, leaving the calc-engine readiness gate red.
    let validationStatus: 'passed' | 'failed';
    let validatedConfidence: string;
    let validationDetailsJson: string;
    let isValid: boolean;

    if (rule.sourceText && rule.sourceText.trim().length > 0) {
      const ruleForValidation: RuleForValidation = {
        ruleType: rule.ruleType,
        ruleName: rule.ruleName,
        calculation,
        sourceSpan: {
          text: rule.sourceText,
          section: rule.sourceSection || undefined,
        },
        confidence: rule.confidence ? parseFloat(rule.confidence) : 0,
      };
      const validation = validateRuleExtraction(ruleForValidation);
      isValid = validation.isValid;
      validationStatus = isValid ? 'passed' : 'failed';
      validatedConfidence = String(
        Math.round(ruleForValidation.confidence * validation.confidenceAdjustment * 10) / 10,
      );
      validationDetailsJson = JSON.stringify({
        valuesFound: validation.valuesFound,
        valuesMissing: validation.valuesMissing,
        confidenceAdjustment: validation.confidenceAdjustment,
        details: validation.details,
      });
    } else {
      const formulaCheck = isFormulaStructurallyValid(rule, formulaDef, calculation);
      isValid = formulaCheck.ok;
      validationStatus = isValid ? 'passed' : 'failed';
      const baseConf = rule.confidence ? parseFloat(rule.confidence) : 0.92;
      validatedConfidence = String(Math.round(baseConf * 10) / 10);
      validationDetailsJson = JSON.stringify({
        mode: 'structural',
        valuesFound: formulaCheck.found,
        valuesMissing: formulaCheck.missing,
        details: [{ field: formulaCheck.field, note: formulaCheck.note }],
      });
    }

    await db.execute(
      sql`UPDATE contract_rules SET
        validation_status = ${validationStatus},
        validated_confidence = ${validatedConfidence},
        validation_details = ${validationDetailsJson}::jsonb
      WHERE id = ${rule.id}`,
    );

    validated++;
    if (isValid) {
      passed++;
    } else {
      failed++;
    }
  }
  
  return {
    totalRules: rules.length,
    validated,
    passed,
    failed
  };
}

/**
 * Older / hand-curated rule rows store calculation hints directly on
 * formula_definition (baseRate, fixedAmount, tiers, minimumGuarantee) instead
 * of in the typed FormulaDefinition.formula tree. Those properties are not
 * part of the canonical FormulaDefinition interface, so we narrow safely
 * through unknown + a Record lookup rather than any-casting.
 */
function readLegacyNumeric(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function readLegacyArrayLength(source: unknown, key: string): number {
  if (!source || typeof source !== 'object') return 0;
  const value = (source as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : 0;
}

function isFormulaStructurallyValid(
  rule: typeof contractRules.$inferSelect,
  formulaDef: FormulaDefinition | null,
  calculation: RuleForValidation['calculation'] | undefined,
): { ok: boolean; field: string; note: string; found: string[]; missing: string[] } {
  if (calculation) {
    if (typeof calculation.rate === 'number' && calculation.rate > 0) {
      return { ok: true, field: 'formula.rate', note: `rate=${calculation.rate}`, found: [`rate=${calculation.rate}`], missing: [] };
    }
    if (typeof calculation.baseRate === 'number' && calculation.baseRate > 0) {
      return { ok: true, field: 'formula.baseRate', note: `baseRate=${calculation.baseRate}`, found: [`baseRate=${calculation.baseRate}`], missing: [] };
    }
    if (typeof calculation.fixedAmount === 'number' && calculation.fixedAmount > 0) {
      return { ok: true, field: 'formula.fixedAmount', note: `fixedAmount=${calculation.fixedAmount}`, found: [`fixedAmount=${calculation.fixedAmount}`], missing: [] };
    }
    if (Array.isArray(calculation.tiers) && calculation.tiers.length > 0) {
      return { ok: true, field: 'formula.tiers', note: `${calculation.tiers.length} tier(s)`, found: [`tiers=${calculation.tiers.length}`], missing: [] };
    }
  }
  const legacyBaseRate = readLegacyNumeric(formulaDef, 'baseRate');
  if (legacyBaseRate !== null) {
    return { ok: true, field: 'formulaDefinition.baseRate', note: `baseRate=${legacyBaseRate}`, found: [`baseRate=${legacyBaseRate}`], missing: [] };
  }
  const legacyFixedAmount = readLegacyNumeric(formulaDef, 'fixedAmount');
  if (legacyFixedAmount !== null) {
    return { ok: true, field: 'formulaDefinition.fixedAmount', note: `fixedAmount=${legacyFixedAmount}`, found: [`fixedAmount=${legacyFixedAmount}`], missing: [] };
  }
  const legacyTierCount = readLegacyArrayLength(formulaDef, 'tiers');
  if (legacyTierCount > 0) {
    return { ok: true, field: 'formulaDefinition.tiers', note: `${legacyTierCount} tier(s)`, found: [`tiers=${legacyTierCount}`], missing: [] };
  }
  const legacyMinGuarantee = readLegacyNumeric(formulaDef, 'minimumGuarantee');
  if (legacyMinGuarantee !== null) {
    return { ok: true, field: 'formulaDefinition.minimumGuarantee', note: `min=${legacyMinGuarantee}`, found: [`minimumGuarantee=${legacyMinGuarantee}`], missing: [] };
  }
  if (rule.baseRate && Number(rule.baseRate) > 0) {
    return { ok: true, field: 'baseRate', note: `legacy baseRate=${rule.baseRate}`, found: [`baseRate=${rule.baseRate}`], missing: [] };
  }
  const ruleVolumeTierCount = Array.isArray(rule.volumeTiers) ? (rule.volumeTiers as unknown[]).length : 0;
  if (ruleVolumeTierCount > 0) {
    return { ok: true, field: 'volumeTiers', note: `${ruleVolumeTierCount} legacy tier(s)`, found: [`tiers=${ruleVolumeTierCount}`], missing: [] };
  }
  return {
    ok: false,
    field: 'formulaDefinition',
    note: 'Rule has no source text and no calculable formula structure (rate / fixed / tiers / minimum).',
    found: [],
    missing: ['rate', 'fixedAmount', 'tiers', 'minimumGuarantee'],
  };
}

function extractCalculationFromFormula(formula: any): RuleForValidation['calculation'] {
  if (!formula) return undefined;
  
  const calculation: RuleForValidation['calculation'] = {};
  
  // Recursively extract values from formula tree
  function extractFromNode(node: any) {
    if (!node) return;
    
    switch (node.type) {
      case 'percentage':
        calculation.rate = node.percentage;
        break;
      case 'tier':
        calculation.tiers = node.tiers?.map((t: any) => ({
          min: t.min || 0,
          max: t.max,
          rate: t.rate
        }));
        break;
      case 'premium':
        calculation.premiumMultiplier = node.percentage;
        break;
      case 'min':
        if (node.values?.[0]?.type === 'constant') {
          calculation.minimumAnnual = node.values[0].value;
        }
        break;
    }
    
    // Recurse into child nodes
    if (node.operand) extractFromNode(node.operand);
    if (node.base) extractFromNode(node.base);
    if (node.condition) extractFromNode(node.condition);
    if (node.then) extractFromNode(node.then);
    if (node.else) extractFromNode(node.else);
    if (node.values) node.values.forEach(extractFromNode);
    if (node.operations) node.operations.forEach((op: any) => extractFromNode(op.operand));
  }
  
  extractFromNode(formula);
  return calculation;
}

export const calculationService = {
  calculateLicenseFees,
  validateContractRules,
  getEvaluationMode
};
