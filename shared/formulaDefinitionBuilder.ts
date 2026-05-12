/**
 * Formula Definition Builder
 * 
 * Industry-standard approach: Converts edited table data + field mappings
 * into an executable FormulaDefinition JSON tree that the universalFormulaEvaluator can run.
 * 
 * This creates a bridge between:
 * - Layer 1 (Display): Human-readable formula text (dynamicFormulaGenerator.ts)
 * - Layer 2 (Calculation): Machine-executable FormulaDefinition (universalFormulaEvaluator.ts)
 */

import {
  FormulaDefinition,
  AnyFormulaNode,
  TierNode,
  ReferenceNode,
  LiteralNode,
  MultiplyNode,
  MaxNode,
  AddNode
} from './formula-types';

export interface TableData {
  columns: string[];
  rows: Array<Record<string, any>>;
}

export interface FieldMappings {
  volume?: string;
  rate?: string;
  basis?: string;
  minimum?: string;
  description?: string;
}

export interface FormulaBuilderOptions {
  tableData: TableData;
  fieldMappings: FieldMappings;
  ruleName: string;
  ruleType?: string;
  minimumGuarantee?: number;
  productFilters?: string[];
  territoryFilters?: string[];
}

/**
 * Parse a numeric value from various formats (currency, percentage, etc.)
 */
function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') return value;
  if (!value) return null;
  
  const str = String(value);
  const cleaned = str
    .replace(/[$€£¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/per\s*(unit|item)/gi, '')
    .replace(/\/unit/gi, '')
    .trim();
  
  if (cleaned.includes('%')) {
    const pct = parseFloat(cleaned.replace('%', ''));
    if (!isNaN(pct)) return pct / 100;
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a volume range like "1 - 2,500 units" into { min, max }
 */
function parseVolumeRange(value: any): { min: number | null; max: number | null } {
  if (!value) return { min: null, max: null };
  
  const str = String(value).toLowerCase();
  
  const plusMatch = str.match(/([\d,]+)\+/);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1].replace(/,/g, ''));
    return { min: isNaN(min) ? null : min, max: null };
  }
  
  const rangeMatch = str.match(/([\d,]+)\s*[-–—to]+\s*([\d,]+)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
    return { 
      min: isNaN(min) ? null : min, 
      max: isNaN(max) ? null : max
    };
  }
  
  const singleNum = parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (!isNaN(singleNum)) {
    return { min: singleNum, max: null };
  }
  
  return { min: null, max: null };
}

/**
 * Detect if rates are percentages (applied to sales) vs per-unit fees
 */
function detectRateType(tableData: TableData, fieldMappings: FieldMappings): 'percentage' | 'per_unit' | 'unknown' {
  if (!fieldMappings.rate) return 'unknown';
  
  const rateCol = fieldMappings.rate;
  const rates = tableData.rows
    .map(row => String(row[rateCol] || ''))
    .filter(r => r);
  
  const hasPercentSigns = rates.some(r => r.includes('%'));
  if (hasPercentSigns) return 'percentage';
  
  const parsedRates = rates.map(r => parseNumericValue(r)).filter(r => r !== null) as number[];
  const allSmall = parsedRates.every(r => r > 0 && r < 1);
  if (allSmall && parsedRates.length > 0) return 'percentage';
  
  return 'per_unit';
}

/**
 * Build tiered pricing node from table data
 */
function buildTieredFormula(
  tableData: TableData, 
  fieldMappings: FieldMappings,
  rateType: 'percentage' | 'per_unit'
): TierNode {
  const volumeCol = fieldMappings.volume!;
  const rateCol = fieldMappings.rate!;
  
  const tiers = tableData.rows.map((row, idx) => {
    const volumeRange = parseVolumeRange(row[volumeCol]);
    const rate = parseNumericValue(row[rateCol]) || 0;
    const descCol = fieldMappings.description;
    const label = descCol ? String(row[descCol] || `Tier ${idx + 1}`) : `Tier ${idx + 1}`;
    
    return {
      min: volumeRange.min ?? 0,
      max: volumeRange.max,
      rate,
      label
    };
  }).filter(tier => tier.rate > 0);
  
  if (tiers.length === 0) {
    tiers.push({ min: 0, max: null, rate: 0, label: 'Default' });
  }
  
  return {
    type: 'tier',
    reference: { type: 'reference', field: 'units' } as ReferenceNode,
    tiers,
    description: `Tiered ${rateType === 'percentage' ? 'percentage' : 'per-unit'} pricing`
  } as TierNode;
}

/**
 * Build simple flat rate formula (single rate, no tiers)
 */
function buildFlatRateFormula(
  tableData: TableData,
  fieldMappings: FieldMappings,
  rateType: 'percentage' | 'per_unit'
): LiteralNode {
  const rateCol = fieldMappings.rate!;
  const rate = parseNumericValue(tableData.rows[0]?.[rateCol]) || 0;
  
  return {
    type: 'literal',
    value: rate,
    unit: rateType === 'percentage' ? 'percent' : 'dollars',
    description: `${rateType === 'percentage' ? 'Percentage' : 'Per-unit'} rate`
  } as LiteralNode;
}

/**
 * Determine the basis reference field based on field mappings and rate type.
 * Maps basis column values (like "Net Sales", "Gross Revenue") to formula reference fields.
 */
function determineBasisField(
  tableData: TableData,
  fieldMappings: FieldMappings,
  rateType: 'percentage' | 'per_unit'
): string {
  if (fieldMappings.basis) {
    const basisValues = tableData.rows
      .map(row => String(row[fieldMappings.basis!] || '').toLowerCase().trim())
      .filter(v => v);
    
    const firstBasis = basisValues[0] || '';
    
    if (firstBasis.includes('gross')) return 'grossAmount';
    if (firstBasis.includes('net')) return 'netAmount';
    if (firstBasis.includes('unit') || firstBasis.includes('quantity')) return 'units';
    if (firstBasis.includes('revenue')) return 'netAmount';
    if (firstBasis.includes('sales')) return 'netAmount';
  }
  
  return rateType === 'percentage' ? 'netAmount' : 'units';
}

/**
 * Main entry point: Build a complete FormulaDefinition from table data
 */
export function buildFormulaDefinition(options: FormulaBuilderOptions): FormulaDefinition {
  const { 
    tableData, 
    fieldMappings, 
    ruleName, 
    ruleType,
    minimumGuarantee,
    productFilters,
    territoryFilters
  } = options;
  
  const rawRateType = detectRateType(tableData, fieldMappings);
  const rateType: 'percentage' | 'per_unit' = rawRateType === 'unknown' ? 'per_unit' : rawRateType;
  const hasTiers = fieldMappings.volume && tableData.rows.length >= 2;
  const hasMinimum = minimumGuarantee !== undefined && minimumGuarantee > 0;
  
  let baseFormula: AnyFormulaNode;
  
  const basisReferenceField = determineBasisField(tableData, fieldMappings, rateType);
  
  if (hasTiers && fieldMappings.volume && fieldMappings.rate) {
    const tierNode = buildTieredFormula(tableData, fieldMappings, rateType);
    
    baseFormula = {
      type: 'multiply',
      operands: [
        { type: 'reference', field: basisReferenceField } as ReferenceNode,
        tierNode
      ]
    } as MultiplyNode;
  } else if (fieldMappings.rate) {
    const rateNode = buildFlatRateFormula(tableData, fieldMappings, rateType);
    
    baseFormula = {
      type: 'multiply',
      operands: [
        { type: 'reference', field: basisReferenceField } as ReferenceNode,
        rateNode
      ]
    } as MultiplyNode;
  } else {
    baseFormula = { type: 'literal', value: 0 } as LiteralNode;
  }
  
  let finalFormula: AnyFormulaNode = baseFormula;
  if (hasMinimum) {
    finalFormula = {
      type: 'max',
      operands: [
        baseFormula,
        { 
          type: 'literal', 
          value: minimumGuarantee, 
          unit: 'dollars',
          description: 'Minimum guarantee'
        } as LiteralNode
      ]
    } as MaxNode;
  }
  
  const formulaDefinition: FormulaDefinition = {
    version: '1.0',
    name: ruleName,
    description: `Auto-generated from ${hasTiers ? 'tiered' : 'flat'} ${rateType} pricing`,
    formula: finalFormula,
    createdAt: new Date().toISOString()
  };
  
  if ((productFilters && productFilters.length > 0) || (territoryFilters && territoryFilters.length > 0)) {
    formulaDefinition.filters = {};
    if (productFilters && productFilters.length > 0) {
      formulaDefinition.filters.products = productFilters;
    }
    if (territoryFilters && territoryFilters.length > 0) {
      formulaDefinition.filters.territories = territoryFilters;
    }
  }
  
  return formulaDefinition;
}

/**
 * Extract tiers from existing FormulaDefinition for display/editing
 */
export function extractTiersFromFormula(formulaDef: FormulaDefinition): TableData | null {
  if (!formulaDef || !formulaDef.formula) return null;
  
  const tierNode = findTierNode(formulaDef.formula);
  if (!tierNode) return null;
  
  const columns = ['Volume Range', 'Rate', 'Label'];
  const rows = tierNode.tiers.map(tier => ({
    'Volume Range': tier.max ? `${tier.min.toLocaleString()} - ${tier.max.toLocaleString()}` : `${tier.min.toLocaleString()}+`,
    'Rate': tier.rate < 1 ? `${(tier.rate * 100).toFixed(1)}%` : `$${tier.rate.toFixed(2)}`,
    'Label': tier.label || ''
  }));
  
  return { columns, rows };
}

function findTierNode(node: AnyFormulaNode): TierNode | null {
  if (node.type === 'tier') return node as TierNode;
  
  if ('operands' in node && Array.isArray((node as any).operands)) {
    for (const operand of (node as any).operands) {
      const found = findTierNode(operand);
      if (found) return found;
    }
  }
  
  if ('then' in node) {
    const found = findTierNode((node as any).then);
    if (found) return found;
  }
  
  if ('else' in node && (node as any).else) {
    const found = findTierNode((node as any).else);
    if (found) return found;
  }
  
  return null;
}

/**
 * Validate that a FormulaDefinition is well-formed and executable
 */
export function validateFormulaDefinition(formulaDef: FormulaDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!formulaDef.version) errors.push('Missing version');
  if (!formulaDef.name) errors.push('Missing name');
  if (!formulaDef.formula) errors.push('Missing formula');
  
  if (formulaDef.formula) {
    validateNode(formulaDef.formula, errors, 'root');
  }
  
  return { valid: errors.length === 0, errors };
}

function validateNode(node: AnyFormulaNode, errors: string[], path: string): void {
  if (!node.type) {
    errors.push(`${path}: Missing type`);
    return;
  }
  
  switch (node.type) {
    case 'tier':
      const tierNode = node as TierNode;
      if (!tierNode.tiers || tierNode.tiers.length === 0) {
        errors.push(`${path}: Tier node must have at least one tier`);
      }
      break;
    case 'multiply':
    case 'add':
      const opNode = node as MultiplyNode | AddNode;
      if (!opNode.operands || opNode.operands.length < 2) {
        errors.push(`${path}: ${node.type} must have at least 2 operands`);
      }
      break;
    case 'reference':
      const refNode = node as ReferenceNode;
      if (!refNode.field) {
        errors.push(`${path}: Reference node must have a field`);
      }
      break;
  }
}
