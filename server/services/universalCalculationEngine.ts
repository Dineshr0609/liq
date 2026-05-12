/**
 * Universal Calculation Engine
 * 
 * Executes ANY formula type dynamically without hardcoding field names.
 * Works with sales data uploaded in CSV format and applies contract rules.
 * 
 * Supports:
 * - Tiered rebates (rebate_tiered)
 * - Promotional rebates (promotional_rebate)
 * - Bonus rebates (bonus_rebate)
 * - Percentage-based (percentage)
 * - Fixed fees (fixed_fee)
 * - Royalty calculations (royalty)
 * - Commission calculations (commission)
 * - Any custom formula type with tiers
 */

interface FormulaDefinition {
  type: string;
  trigger?: string;
  calculationBasis?: string;
  tiers?: TierDefinition[];
  tierMode?: 'whole' | 'marginal'; // default: 'whole' (backward compatible)
  logic?: string;
  notes?: string[];
  example?: {
    scenario: string;
    calculation: string[];
  };
  // Tiered rebate fields
  threshold?: number;
  bonusThreshold?: number;
  bonusRate?: number;
  // Promotional rebate fields
  activePeriod?: string;
  product?: string;
  additionalRebate?: number;
  // General fields
  rate?: number;
  fixedAmount?: number;
  tableData?: {
    columns: string[];
    rows: Record<string, string>[];
  };
}

interface TierDefinition {
  tier?: number;
  min: number;
  max: number | null;
  rate: number;
  description?: string;
  basis?: string;
}

interface SalesRecord {
  [key: string]: any;
}

interface CalculationContext {
  period?: string;           // e.g., "Q1_2025", "2025-Q1"
  quarter?: number;          // 1, 2, 3, 4
  year?: number;             // 2025
  product?: string;          // Product name/family
  territory?: string;        // Territory name
  isAnnual?: boolean;        // Whether this is annual aggregation
  startDate?: Date;
  endDate?: Date;
  customFields?: Record<string, any>;
}

interface CalculationResult {
  ruleName: string;
  ruleType: string;
  inputValue: number;
  calculatedAmount: number;
  tierApplied?: number;
  tierDescription?: string;
  formula: string;
  breakdown: string[];
  notes: string[];
  conditionsMet?: boolean;
  conditionsChecked?: string[];
  quantity?: number;
  productName?: string;
  saleIds?: string[];
}

interface CalculationSummary {
  contractId: string;
  calculationDate: string;
  totalRecords: number;
  results: CalculationResult[];
  grandTotal: number;
  byRule: Record<string, number>;
}

/**
 * Aggregate of all sales within a single quarter, with per-product breakdown.
 * Used by rebate_tiered evaluation on the universal path.
 */
interface QuarterlyAggregate {
  quarterKey: string;     // e.g. '2026-Q1'
  quarterTotal: number;   // sum of all sale amounts in quarter (for $-based tier lookup)
  unitTotal: number;      // sum of all units in quarter (for unit-based tier lookup)
  products: Map<string, {
    netPurchases: number;
    totalUnits: number;
    saleIds: string[];
  }>;
}

export class UniversalCalculationEngine {
  /**
   * Find the matching tier for a given value
   */
  private findMatchingTier(value: number, tiers: TierDefinition[]): TierDefinition | null {
    // Sort tiers by min value ascending
    const sortedTiers = [...tiers].sort((a, b) => a.min - b.min);
    
    for (const tier of sortedTiers) {
      const max = tier.max ?? Infinity;
      if (value >= tier.min && value <= max) {
        return tier;
      }
    }
    
    // If value exceeds all tiers, use the last tier
    if (sortedTiers.length > 0 && value > (sortedTiers[sortedTiers.length - 1].max ?? 0)) {
      return sortedTiers[sortedTiers.length - 1];
    }
    
    return null;
  }

  /**
   * Calculate tiered rebate
   * Default mode 'whole': matched tier's rate applies to entire value (backward compatible)
   * Mode 'marginal': each tier's rate applies only to the portion of value within that tier band
   */
  private calculateTieredRebate(value: number, formula: FormulaDefinition): CalculationResult {
    const tierMode = formula.tierMode || 'whole';
    if (tierMode === 'marginal') {
      return this.calculateMarginalTieredRebate(value, formula);
    }
    const tiers = formula.tiers || [];
    const matchingTier = this.findMatchingTier(value, tiers);
    
    if (!matchingTier) {
      return {
        ruleName: 'Tiered Rebate',
        ruleType: formula.type,
        inputValue: value,
        calculatedAmount: 0,
        formula: 'No matching tier found',
        breakdown: ['Value did not match any tier'],
        notes: formula.notes || []
      };
    }

    const rate = matchingTier.rate;
    const calculatedAmount = value * rate;
    
    return {
      ruleName: 'Tiered Rebate',
      ruleType: formula.type,
      inputValue: value,
      calculatedAmount,
      tierApplied: matchingTier.tier,
      tierDescription: matchingTier.description,
      formula: `${this.formatCurrency(value)} × ${(rate * 100).toFixed(1)}%`,
      breakdown: [
        `Input: ${this.formatCurrency(value)}`,
        `Tier: ${matchingTier.description || `Tier ${matchingTier.tier}`}`,
        `Rate: ${(rate * 100).toFixed(1)}%`,
        `Calculation: ${this.formatCurrency(value)} × ${rate} = ${this.formatCurrency(calculatedAmount)}`
      ],
      notes: formula.notes || []
    };
  }

  /**
   * Calculate marginal/stepped tiered rebate
   * Each tier's rate applies only to the portion of value within that tier band
   * Example: tiers [0-1000 @ 2%, 1000-5000 @ 4%, 5000+ @ 6%], value=7000:
   *   - Tier 1: 1000 × 2% = 20
   *   - Tier 2: 4000 × 4% = 160
   *   - Tier 3: 2000 × 6% = 120
   *   - Total: 300
   */
  private calculateMarginalTieredRebate(value: number, formula: FormulaDefinition): CalculationResult {
    const tiers = [...(formula.tiers || [])].sort((a, b) => a.min - b.min);
    let totalAmount = 0;
    const breakdown: string[] = [`Input: ${this.formatCurrency(value)}`, `Mode: marginal/stepped`];
    const tiersApplied: number[] = [];

    for (const tier of tiers) {
      const tierMax = tier.max ?? Infinity;
      if (value <= tier.min) break; // value doesn't reach this tier
      const eligibleAmount = Math.min(value, tierMax) - tier.min;
      if (eligibleAmount <= 0) continue;
      const tierAmount = eligibleAmount * tier.rate;
      totalAmount += tierAmount;
      if (tier.tier !== undefined) tiersApplied.push(tier.tier);
      const bandLabel = tier.max !== null && tier.max !== undefined
        ? `${this.formatCurrency(tier.min)}-${this.formatCurrency(tier.max)}`
        : `${this.formatCurrency(tier.min)}+`;
      breakdown.push(
        `Tier ${tier.tier ?? '?'} [${bandLabel}]: ${this.formatCurrency(eligibleAmount)} × ${(tier.rate * 100).toFixed(2)}% = ${this.formatCurrency(tierAmount)}`
      );
    }

    breakdown.push(`Marginal total: ${this.formatCurrency(totalAmount)}`);

    return {
      ruleName: 'Tiered Rebate (Marginal)',
      ruleType: formula.type,
      inputValue: value,
      calculatedAmount: totalAmount,
      tierApplied: tiersApplied[tiersApplied.length - 1],
      tierDescription: `Marginal across ${tiersApplied.length} tier(s)`,
      formula: `Marginal sum across ${tiers.length} tier band(s)`,
      breakdown,
      notes: formula.notes || []
    };
  }

  /**
   * Aggregate sales by (year + quarter), with per-product breakdown.
   * Ports the quarterly aggregation math from dynamicRulesEngine.ts so
   * rebate_tiered rules can be evaluated on the universal path with full
   * traceability. Math is preserved exactly: amounts are summed per
   * quarter for tier lookup, units are summed per quarter for unit-based
   * tier lookup, and per-product totals are kept for downstream allocation.
   */
  aggregateSalesByQuarter(
    salesData: SalesRecord[],
    amountField: string = 'netAmount',     // e.g. 'netAmount' or 'grossAmount'
    quantityField: string = 'quantity',    // e.g. 'quantity'
    productField: string = 'productName',  // e.g. 'productName'
    dateField: string = 'transactionDate', // e.g. 'transactionDate'
    aggregationPeriod: 'annual' | 'quarter' | 'month' = 'quarter',
  ): Map<string, QuarterlyAggregate> {
    const aggregates = new Map<string, QuarterlyAggregate>();

    for (const sale of salesData) {
      // Resolve quarter/year — prefer explicit fields, fall back to date parse
      let quarter: string | undefined = sale.quarter || sale.customFields?.quarter;
      let year: string | undefined = sale.year?.toString();

      if (!quarter || !year) {
        const rawDate = sale[dateField];
        const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
        if (isNaN(date.getTime())) continue; // skip rows we can't date
        const month = date.getMonth();
        quarter = `Q${Math.floor(month / 3) + 1}`;
        year = date.getFullYear().toString();
      }

      // Bucket key honors the rule's stated measurement period: annual contracts
      // (e.g. yearly volume rebates) must accumulate the whole year before
      // matching a tier; legacy default 'quarter' preserves prior behavior.
      let quarterKey: string;
      if (aggregationPeriod === 'annual') {
        quarterKey = `${year}`;
      } else if (aggregationPeriod === 'month') {
        const rawDate = sale[dateField];
        const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
        const m = isNaN(date.getTime()) ? 1 : date.getMonth() + 1;
        quarterKey = `${year}-M${String(m).padStart(2, '0')}`;
      } else {
        quarterKey = `${year}-${quarter}`;
      }
      const amount = parseFloat(sale[amountField] ?? sale.grossAmount ?? 0) || 0;
      const units = parseFloat(sale[quantityField] ?? 0) || 0;
      const productName = String(sale[productField] ?? sale.productName ?? 'Unknown');
      const saleId = String(sale.id ?? sale.transactionId ?? '');

      let agg = aggregates.get(quarterKey);
      if (!agg) {
        agg = {
          quarterKey,
          quarterTotal: 0,
          unitTotal: 0,
          products: new Map(),
        };
        aggregates.set(quarterKey, agg);
      }

      agg.quarterTotal += amount;
      agg.unitTotal += units;

      const prod = agg.products.get(productName);
      if (prod) {
        prod.netPurchases += amount;
        prod.totalUnits += units;
        if (saleId) prod.saleIds.push(saleId);
      } else {
        agg.products.set(productName, {
          netPurchases: amount,
          totalUnits: units,
          saleIds: saleId ? [saleId] : [],
        });
      }
    }

    return aggregates;
  }

  /**
   * Execute a rebate_tiered rule across all sales using quarterly aggregation.
   *
   * Math preserved from dynamicRulesEngine.ts:
   *  - Auto-detect tier basis: units when max(tier.min) < 500_000, else dollars
   *  - Whole-tier (default): pick highest tier whose min ≤ quarter total; one rate
   *  - Marginal (formula.tierMode === 'marginal'): walk bands, sum
   *    (min(total, tier.max) - tier.min) × tier.rate per band
   *  - Per-product allocation: productRebate = productNet × effectiveRate, where
   *    effectiveRate = matched-tier rate (whole) or marginalAmount/quarterTotal
   *  - Tier rates stored as <1 are treated as decimals (0.04), ≥1 as percent (4 → 0.04)
   *
   * Returns ONE CalculationResult per (quarter × product) for full traceability —
   * the rebate_tiered flow currently has zero traceability on the universal path.
   */
  executeRebateTieredRule(
    ruleName: string,
    formula: FormulaDefinition,
    salesData: SalesRecord[],
    options?: {
      amountField?: string;
      quantityField?: string;
      productField?: string;
      dateField?: string;
    }
  ): CalculationResult[] {
    const results: CalculationResult[] = [];
    const tiers = formula.tiers || [];

    if (tiers.length === 0) {
      return [{
        ruleName,
        ruleType: formula.type,
        inputValue: 0,
        calculatedAmount: 0,
        formula: 'No tiers configured',
        breakdown: [`Rule "${ruleName}" has no tiers - skipping`],
        notes: ['rebate_tiered rule requires at least one tier'],
      }];
    }

    const aggPeriodRaw = String((formula as any).aggregationPeriod ?? 'quarter').toLowerCase().trim();
    const aggregationPeriod: 'annual' | 'quarter' | 'month' =
      aggPeriodRaw === 'annual' || aggPeriodRaw === 'year' || aggPeriodRaw === 'yearly'
        ? 'annual'
        : aggPeriodRaw === 'month' || aggPeriodRaw === 'monthly'
        ? 'month'
        : 'quarter';

    const aggregates = this.aggregateSalesByQuarter(
      salesData,
      options?.amountField ?? 'netAmount',
      options?.quantityField ?? 'quantity',
      options?.productField ?? 'productName',
      options?.dateField ?? 'transactionDate',
      aggregationPeriod,
    );

    if (aggregates.size === 0) {
      return [{
        ruleName,
        ruleType: formula.type,
        inputValue: 0,
        calculatedAmount: 0,
        formula: 'No sales matched',
        breakdown: ['No sales found in any quarter'],
        notes: [],
      }];
    }

    // Tier basis resolution: explicit `tierBasis` on the formula wins over the
    // legacy magnitude heuristic (kept as fallback for null/'auto'/unknown).
    const sortedTiers = [...tiers].sort((a, b) => (a.min || 0) - (b.min || 0));
    const maxTierMin = Math.max(...sortedTiers.map(t => t.min || 0));
    const explicitBasisRaw = String((formula as any).tierBasis ?? '').toLowerCase().trim();
    const explicitBasis: 'units' | 'amount' | null =
      explicitBasisRaw === 'units' ? 'units'
      : (explicitBasisRaw === 'amount' || explicitBasisRaw === 'dollars') ? 'amount'
      : null;
    const heuristicIsUnits = maxTierMin > 0 && maxTierMin < 500000;
    const isUnitBasedTiers = explicitBasis ? explicitBasis === 'units' : heuristicIsUnits;
    const tierBasisLabel = isUnitBasedTiers ? 'units' : 'dollars';

    const tierMode: 'whole' | 'marginal' = formula.tierMode === 'marginal' ? 'marginal' : 'whole';

    // Per quarter: find tier (whole) OR compute marginal sum, then allocate per product
    for (const agg of Array.from(aggregates.values())) {
      const quarterTotalForTier = isUnitBasedTiers ? agg.unitTotal : agg.quarterTotal;
      let matchedTier: TierDefinition | null = null;
      let effectiveRate = 0;
      let marginalAmount = 0;
      const tierBreakdown: string[] = [];

      if (tierMode === 'marginal') {
        for (const tier of sortedTiers) {
          const tMin = tier.min || 0;
          const tMax = tier.max ?? Infinity;
          if (quarterTotalForTier <= tMin) break;
          const eligibleAmount = Math.min(quarterTotalForTier, tMax) - tMin;
          if (eligibleAmount <= 0) continue;
          const tierRateDecimal = tier.rate < 1 ? tier.rate : tier.rate / 100;
          const bandAmount = eligibleAmount * tierRateDecimal;
          marginalAmount += bandAmount;
          matchedTier = tier;
          tierBreakdown.push(
            `Band [${tMin}-${tier.max ?? '∞'}]: ${eligibleAmount.toLocaleString()} × ${(tierRateDecimal * 100).toFixed(2)}% = ${this.formatCurrency(bandAmount)}`
          );
        }
        effectiveRate = quarterTotalForTier > 0 ? marginalAmount / quarterTotalForTier : 0;
      } else {
        // Whole-tier: highest tier whose min ≤ total
        for (let i = sortedTiers.length - 1; i >= 0; i--) {
          const tier = sortedTiers[i];
          if (quarterTotalForTier >= (tier.min || 0)) {
            matchedTier = tier;
            effectiveRate = tier.rate < 1 ? tier.rate : tier.rate / 100;
            break;
          }
        }
        if (!matchedTier && sortedTiers.length > 0) {
          matchedTier = sortedTiers[0];
          effectiveRate = matchedTier.rate < 1 ? matchedTier.rate : matchedTier.rate / 100;
        }
      }

      const totalLabel = isUnitBasedTiers
        ? `${quarterTotalForTier.toLocaleString()} units`
        : this.formatCurrency(quarterTotalForTier);
      const tierExpectations = isUnitBasedTiers
        ? sortedTiers.map(t => `${(t.min || 0).toLocaleString()}+ units: ${((t.rate < 1 ? t.rate : t.rate / 100) * 100).toFixed(2)}%`).join(', ')
        : sortedTiers.map(t => `${this.formatCurrency(t.min || 0)}+: ${((t.rate < 1 ? t.rate : t.rate / 100) * 100).toFixed(2)}%`).join(', ');

      // Per-product allocation
      for (const [productName, productData] of Array.from(agg.products.entries())) {
        const productRebate = productData.netPurchases * effectiveRate;
        const productBreakdown: string[] = [
          `Quarter: ${agg.quarterKey}`,
          `Quarter total (${tierBasisLabel}): ${totalLabel}`,
          `Tier table: ${tierExpectations}`,
          `Tier mode: ${tierMode}`,
        ];

        if (tierMode === 'marginal') {
          productBreakdown.push(...tierBreakdown);
          productBreakdown.push(
            `Quarter marginal total: ${this.formatCurrency(marginalAmount)} (blended ${(effectiveRate * 100).toFixed(4)}%)`
          );
        } else if (matchedTier) {
          productBreakdown.push(
            `Matched tier: ${matchedTier.min}+ @ ${(effectiveRate * 100).toFixed(2)}%`
          );
        }

        productBreakdown.push(
          `Product "${productName}": ${this.formatCurrency(productData.netPurchases)} × ${(effectiveRate * 100).toFixed(4)}% = ${this.formatCurrency(productRebate)}`,
          `Sales contributing: ${productData.saleIds.length}`
        );

        results.push({
          ruleName,
          ruleType: formula.type,
          inputValue: productData.netPurchases,
          calculatedAmount: productRebate,
          tierApplied: matchedTier?.tier,
          tierDescription: matchedTier?.description || `${agg.quarterKey} - ${productName}`,
          formula: tierMode === 'marginal'
            ? `Marginal sum × proportional allocation`
            : `${this.formatCurrency(productData.netPurchases)} × ${(effectiveRate * 100).toFixed(2)}%`,
          breakdown: productBreakdown,
          notes: formula.notes || [],
          conditionsMet: !!matchedTier,
          conditionsChecked: [
            `Quarter ${agg.quarterKey} ${tierBasisLabel} total ${totalLabel} → ${tierMode === 'marginal' ? 'marginal blended' : 'whole tier'} rate ${(effectiveRate * 100).toFixed(4)}%`
          ],
          quantity: productData.totalUnits,
          productName,
          saleIds: productData.saleIds,
        });
      }
    }

    return results;
  }

  /**
   * Check if a period matches the active period condition
   */
  private checkPeriodCondition(context: CalculationContext, activePeriod?: string): { met: boolean; reason: string } {
    if (!activePeriod) return { met: true, reason: 'No period restriction' };
    
    const period = activePeriod.toLowerCase();
    const currentQuarter = context.quarter;
    const currentYear = context.year;
    
    // Check for quarter-based conditions like "Q1 & Q2 2025 only"
    if (period.includes('q1') && period.includes('q2') && period.includes('2025')) {
      if (currentYear === 2025 && (currentQuarter === 1 || currentQuarter === 2)) {
        return { met: true, reason: `Quarter ${currentQuarter} 2025 is within active period` };
      }
      return { met: false, reason: `Current period (Q${currentQuarter} ${currentYear}) is outside Q1-Q2 2025` };
    }
    
    // Check for "first X quarters" type conditions
    const firstQuartersMatch = period.match(/first\s*(\d+)\s*quarters?/i);
    if (firstQuartersMatch && currentQuarter) {
      const limitQuarters = parseInt(firstQuartersMatch[1]);
      if (currentQuarter <= limitQuarters) {
        return { met: true, reason: `Quarter ${currentQuarter} is within first ${limitQuarters} quarters` };
      }
      return { met: false, reason: `Quarter ${currentQuarter} exceeds first ${limitQuarters} quarters` };
    }
    
    // Default: assume condition is met for now
    return { met: true, reason: 'Period condition format not recognized, assuming met' };
  }

  /**
   * Check if product matches the product condition
   */
  private checkProductCondition(context: CalculationContext, productFilter?: string): { met: boolean; reason: string } {
    if (!productFilter) return { met: true, reason: 'No product restriction' };
    if (!context.product) return { met: true, reason: 'No product in context, assuming match' };
    
    const productLower = context.product.toLowerCase();
    const filterLower = productFilter.toLowerCase();
    
    if (productLower.includes(filterLower) || filterLower.includes(productLower)) {
      return { met: true, reason: `Product "${context.product}" matches filter "${productFilter}"` };
    }
    
    return { met: false, reason: `Product "${context.product}" does not match "${productFilter}"` };
  }

  /**
   * Calculate promotional rebate (time/product limited) with condition evaluation
   */
  private calculatePromotionalRebate(value: number, formula: FormulaDefinition, context: CalculationContext = {}): CalculationResult {
    const rate = formula.additionalRebate || formula.rate || 0;
    const conditionsChecked: string[] = [];
    
    // Check period condition
    const periodCheck = this.checkPeriodCondition(context, formula.activePeriod);
    conditionsChecked.push(`Period: ${periodCheck.reason}`);
    
    // Check product condition
    const productCheck = this.checkProductCondition(context, formula.product);
    conditionsChecked.push(`Product: ${productCheck.reason}`);
    
    const allConditionsMet = periodCheck.met && productCheck.met;
    const calculatedAmount = allConditionsMet ? value * rate : 0;
    
    return {
      ruleName: 'Promotional Rebate',
      ruleType: formula.type,
      inputValue: value,
      calculatedAmount,
      conditionsMet: allConditionsMet,
      conditionsChecked,
      formula: allConditionsMet 
        ? `${this.formatCurrency(value)} × ${(rate * 100).toFixed(1)}%`
        : 'Conditions not met - no rebate applied',
      breakdown: [
        `Input: ${this.formatCurrency(value)}`,
        `Promotional Rate: ${(rate * 100).toFixed(1)}%`,
        `Active Period: ${formula.activePeriod || 'N/A'}`,
        `Product Filter: ${formula.product || 'All'}`,
        ...conditionsChecked.map(c => `✓ ${c}`),
        allConditionsMet 
          ? `Calculation: ${this.formatCurrency(calculatedAmount)}`
          : `Calculation: $0.00 (conditions not met)`
      ],
      notes: formula.notes || []
    };
  }

  /**
   * Calculate bonus rebate (threshold-based) with period check for annual bonuses
   */
  private calculateBonusRebate(value: number, formula: FormulaDefinition, context: CalculationContext = {}): CalculationResult {
    const qualifyingThreshold = formula.threshold || 0;
    const bonusThreshold = formula.bonusThreshold || 0;
    const bonusRate = formula.bonusRate || 0;
    const conditionsChecked: string[] = [];
    
    // Check if this is annual-only and context indicates it's not annual
    const trigger = (formula.trigger || '').toLowerCase();
    if (trigger.includes('annual') || trigger.includes('year')) {
      if (context.isAnnual === false) {
        conditionsChecked.push(`Period: Bonus requires annual data, but current calculation is not annual`);
        return {
          ruleName: 'Bonus Rebate',
          ruleType: formula.type,
          inputValue: value,
          calculatedAmount: 0,
          conditionsMet: false,
          conditionsChecked,
          formula: 'Annual trigger not met',
          breakdown: [
            `Input: ${this.formatCurrency(value)}`,
            `Trigger: ${formula.trigger}`,
            `Status: Skipped (not annual calculation)`
          ],
          notes: formula.notes || []
        };
      }
      conditionsChecked.push(`Period: Annual calculation ${context.isAnnual ? '✓' : '(assuming annual)'}`);
    }
    
    // Check if value exceeds qualifying threshold
    if (value <= qualifyingThreshold) {
      conditionsChecked.push(`Threshold: ${this.formatCurrency(value)} ≤ ${this.formatCurrency(qualifyingThreshold)} - not qualified`);
      return {
        ruleName: 'Bonus Rebate',
        ruleType: formula.type,
        inputValue: value,
        calculatedAmount: 0,
        conditionsMet: false,
        conditionsChecked,
        formula: 'Threshold not met',
        breakdown: [
          `Input: ${this.formatCurrency(value)}`,
          `Required Threshold: ${this.formatCurrency(qualifyingThreshold)}`,
          `Status: Did not qualify (need ${this.formatCurrency(qualifyingThreshold - value)} more)`,
          ...conditionsChecked
        ],
        notes: formula.notes || []
      };
    }

    // Calculate bonus on amount above bonusThreshold
    const eligibleAmount = value - bonusThreshold;
    const calculatedAmount = eligibleAmount * bonusRate;
    
    return {
      ruleName: 'Bonus Rebate',
      ruleType: formula.type,
      inputValue: value,
      calculatedAmount,
      formula: `(${this.formatCurrency(value)} - ${this.formatCurrency(bonusThreshold)}) × ${(bonusRate * 100).toFixed(1)}%`,
      breakdown: [
        `Total Value: ${this.formatCurrency(value)}`,
        `Qualifying Threshold: ${this.formatCurrency(qualifyingThreshold)} ✓`,
        `Bonus Applies Above: ${this.formatCurrency(bonusThreshold)}`,
        `Eligible Amount: ${this.formatCurrency(eligibleAmount)}`,
        `Bonus Rate: ${(bonusRate * 100).toFixed(1)}%`,
        `Bonus: ${this.formatCurrency(calculatedAmount)}`
      ],
      notes: formula.notes || []
    };
  }

  /**
   * Calculate simple percentage
   */
  private calculatePercentage(value: number, formula: FormulaDefinition): CalculationResult {
    const rate = formula.rate || 0;
    const calculatedAmount = value * rate;
    
    return {
      ruleName: 'Percentage',
      ruleType: formula.type,
      inputValue: value,
      calculatedAmount,
      formula: `${this.formatCurrency(value)} × ${(rate * 100).toFixed(2)}%`,
      breakdown: [
        `Input: ${this.formatCurrency(value)}`,
        `Rate: ${(rate * 100).toFixed(2)}%`,
        `Result: ${this.formatCurrency(calculatedAmount)}`
      ],
      notes: formula.notes || []
    };
  }

  /**
   * Calculate fixed fee
   */
  private calculateFixedFee(formula: FormulaDefinition): CalculationResult {
    const amount = formula.fixedAmount || formula.threshold || 0;
    
    return {
      ruleName: 'Fixed Fee',
      ruleType: formula.type,
      inputValue: 0,
      calculatedAmount: amount,
      formula: `Fixed: ${this.formatCurrency(amount)}`,
      breakdown: [`Fixed Amount: ${this.formatCurrency(amount)}`],
      notes: formula.notes || []
    };
  }

  /**
   * Format currency for display
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Execute a single rule on a value with full context evaluation
   */
  executeRule(
    ruleName: string,
    formula: FormulaDefinition,
    value: number,
    context: CalculationContext = {}
  ): CalculationResult {
    const type = formula.type?.toLowerCase() || '';
    
    let result: CalculationResult;
    
    // Route to appropriate calculation method based on formula type
    if (type.includes('tiered') || (formula.tiers && formula.tiers.length > 0)) {
      result = this.calculateTieredRebate(value, formula);
    } else if (type.includes('promotional') || formula.additionalRebate) {
      result = this.calculatePromotionalRebate(value, formula, context);
    } else if (type.includes('bonus') || formula.bonusRate) {
      result = this.calculateBonusRebate(value, formula, context);
    } else if (type.includes('percentage') || type.includes('contract fee') || type.includes('commission') || formula.rate) {
      result = this.calculatePercentage(value, formula);
    } else if (type.includes('fixed') || formula.fixedAmount) {
      result = this.calculateFixedFee(formula);
    } else {
      // Fallback: try to detect from formula structure
      if (formula.tiers) {
        result = this.calculateTieredRebate(value, formula);
      } else if (formula.rate) {
        result = this.calculatePercentage(value, formula);
      } else {
        result = {
          ruleName,
          ruleType: type,
          inputValue: value,
          calculatedAmount: 0,
          formula: 'Unknown formula type',
          breakdown: ['Could not determine calculation method'],
          notes: [`Formula type "${type}" not recognized - ensure formulaDefinition has type, tiers, or rate fields`]
        };
      }
    }
    
    result.ruleName = ruleName;
    return result;
  }

  /**
   * Execute all rules for a contract on aggregated sales data with full context
   */
  executeAllRules(
    rules: Array<{ ruleName: string; formulaDefinition: FormulaDefinition }>,
    aggregatedValue: number,
    context: CalculationContext = {}
  ): CalculationSummary {
    const results: CalculationResult[] = [];
    const byRule: Record<string, number> = {};
    let grandTotal = 0;

    for (const rule of rules) {
      if (!rule.formulaDefinition) continue;
      
      const result = this.executeRule(
        rule.ruleName,
        rule.formulaDefinition,
        aggregatedValue,
        context
      );
      
      results.push(result);
      byRule[rule.ruleName] = result.calculatedAmount;
      grandTotal += result.calculatedAmount;
    }

    return {
      contractId: '',
      calculationDate: new Date().toISOString(),
      totalRecords: 1,
      results,
      grandTotal,
      byRule
    };
  }

  /**
   * Aggregate sales data by a grouping field (e.g., quarter, period)
   */
  aggregateSalesData(
    salesData: SalesRecord[],
    valueField: string,
    groupByField?: string
  ): Map<string, number> {
    const aggregated = new Map<string, number>();
    
    for (const record of salesData) {
      const key = groupByField ? String(record[groupByField] || 'total') : 'total';
      const value = parseFloat(record[valueField]) || 0;
      
      aggregated.set(key, (aggregated.get(key) || 0) + value);
    }
    
    return aggregated;
  }

  /**
   * Parse period string to extract quarter/year context
   */
  private parsePeriodContext(period?: string): Partial<CalculationContext> {
    if (!period) return {};
    
    const context: Partial<CalculationContext> = { period };
    
    // Try to parse "Q1_2025", "2025-Q1", "Q1 2025" formats
    const quarterMatch = period.match(/Q(\d)[_\s-]?(\d{4})|(\d{4})[_\s-]?Q(\d)/i);
    if (quarterMatch) {
      context.quarter = parseInt(quarterMatch[1] || quarterMatch[4]);
      context.year = parseInt(quarterMatch[2] || quarterMatch[3]);
    }
    
    // Check for annual indicators
    if (period.toLowerCase().includes('annual') || period.toLowerCase().includes('year')) {
      context.isAnnual = true;
    }
    
    return context;
  }

  /**
   * Process uploaded sales CSV and calculate rebates with full context
   */
  processUploadedSales(
    salesData: SalesRecord[],
    rules: Array<{ ruleName: string; formulaDefinition: FormulaDefinition }>,
    options: {
      valueField: string;
      groupByField?: string;
      period?: string;
      quarter?: number;
      year?: number;
      isAnnual?: boolean;
      product?: string;
    }
  ): CalculationSummary {
    // Aggregate sales data
    const aggregated = this.aggregateSalesData(
      salesData,
      options.valueField,
      options.groupByField
    );
    
    // Get total value (or use grouping if specified)
    let totalValue = 0;
    aggregated.forEach((value) => {
      totalValue += value;
    });

    // Build context from options and period parsing
    const periodContext = this.parsePeriodContext(options.period);
    const context: CalculationContext = {
      ...periodContext,
      quarter: options.quarter ?? periodContext.quarter,
      year: options.year ?? periodContext.year,
      isAnnual: options.isAnnual ?? periodContext.isAnnual,
      product: options.product,
      period: options.period
    };

    // Execute rules on aggregated value with context
    const summary = this.executeAllRules(rules, totalValue, context);
    summary.totalRecords = salesData.length;
    
    return summary;
  }
}

export const calculationEngine = new UniversalCalculationEngine();
