/**
 * Universal Formula Evaluator
 * 
 * Executes any FormulaDefinition against sales data context.
 * This is the core calculation engine that works for ANY contract type.
 * 
 * Design Principles:
 * 1. Single entry point: evaluateFormula()
 * 2. Recursive evaluation of expression trees
 * 3. Context-aware field references
 * 4. Comprehensive audit trail
 */

import {
  AnyFormulaNode,
  FormulaDefinition,
  LiteralNode,
  ReferenceNode,
  TierNode,
  MultiplyNode,
  AddNode,
  SubtractNode,
  MaxNode,
  MinNode,
  IfNode,
  LookupNode,
  PremiumNode,
  RoundNode
} from '../../shared/formula-types';

/**
 * Context object containing all data available for formula evaluation
 */
export interface EvaluationContext {
  // Core sales data
  units?: number;
  quantity?: number;
  grossAmount?: number;
  netAmount?: number;
  netPurchases?: number;
  
  // Aggregated values (for tiered calculations)
  quarterlyTotal?: number;
  annualTotal?: number;
  monthlyTotal?: number;
  
  // Categorization
  productName?: string;
  category?: string;
  territory?: string;
  region?: string;
  containerSize?: string;
  
  // Time-based
  transactionDate?: Date | string;
  season?: string;
  quarter?: string;
  month?: string;
  year?: number;
  
  // Custom fields (extensible)
  [key: string]: any;
}

/**
 * Result of formula evaluation with audit trail
 */
export interface EvaluationResult {
  value: number;
  success: boolean;
  error?: string;
  auditTrail: AuditStep[];
}

/**
 * Single step in the audit trail
 */
export interface AuditStep {
  nodeType: string;
  description: string;
  inputValues: Record<string, any>;
  outputValue: number;
  timestamp: Date;
}

/**
 * Internal evaluation state for tracking audit
 */
interface EvalState {
  auditTrail: AuditStep[];
  depth: number;
}

/**
 * Main entry point: Evaluate a complete FormulaDefinition
 */
export function evaluateFormulaDefinition(
  formulaDef: FormulaDefinition,
  context: EvaluationContext
): EvaluationResult {
  const state: EvalState = {
    auditTrail: [],
    depth: 0
  };

  try {
    // Check filters first
    if (formulaDef.filters) {
      const filterResult = checkFilters(formulaDef.filters, context);
      if (!filterResult.passed) {
        return {
          value: 0,
          success: true,
          auditTrail: [{
            nodeType: 'filter',
            description: `Formula skipped: ${filterResult.reason}`,
            inputValues: { filters: formulaDef.filters },
            outputValue: 0,
            timestamp: new Date()
          }]
        };
      }
    }

    const value = evaluateNode(formulaDef.formula, context, state);
    
    return {
      value,
      success: true,
      auditTrail: state.auditTrail
    };
  } catch (error) {
    return {
      value: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown evaluation error',
      auditTrail: state.auditTrail
    };
  }
}

/**
 * Evaluate a single formula node (recursive)
 */
export function evaluateNode(
  node: AnyFormulaNode,
  context: EvaluationContext,
  state: EvalState
): number {
  state.depth++;
  
  let result: number;
  let description: string;
  let inputValues: Record<string, any> = {};

  switch (node.type) {
    case 'literal':
      result = evaluateLiteral(node as LiteralNode);
      description = `Literal value: ${result}`;
      inputValues = { value: (node as LiteralNode).value };
      break;

    case 'reference':
      const refNode = node as ReferenceNode;
      result = evaluateReference(refNode, context);
      description = `Reference ${refNode.field}: ${result}`;
      inputValues = { field: refNode.field, contextValue: result };
      break;

    case 'tier':
      const tierNode = node as TierNode;
      const tierResult = evaluateTier(tierNode, context, state);
      result = tierResult.rate;
      description = `Tier lookup: value ${tierResult.refValue} → ${tierResult.tierLabel} @ ${(result * 100).toFixed(1)}%`;
      inputValues = { refValue: tierResult.refValue, matchedTier: tierResult.tierLabel };
      break;

    case 'multiply':
      const multiplyNode = node as MultiplyNode;
      const multiplyOperands = multiplyNode.operands.map(op => evaluateNode(op, context, state));
      result = multiplyOperands.reduce((acc, val) => acc * val, 1);
      description = `Multiply: ${multiplyOperands.join(' × ')} = ${result}`;
      inputValues = { operands: multiplyOperands };
      break;

    case 'add':
      const addNode = node as AddNode;
      const addOperands = addNode.operands.map(op => evaluateNode(op, context, state));
      result = addOperands.reduce((acc, val) => acc + val, 0);
      description = `Add: ${addOperands.join(' + ')} = ${result}`;
      inputValues = { operands: addOperands };
      break;

    case 'subtract':
      const subNode = node as SubtractNode;
      const left = evaluateNode(subNode.operands[0], context, state);
      const right = evaluateNode(subNode.operands[1], context, state);
      result = left - right;
      description = `Subtract: ${left} - ${right} = ${result}`;
      inputValues = { left, right };
      break;

    case 'max':
      const maxNode = node as MaxNode;
      const maxOperands = maxNode.operands.map(op => evaluateNode(op, context, state));
      result = Math.max(...maxOperands);
      description = `Max: max(${maxOperands.join(', ')}) = ${result}`;
      inputValues = { operands: maxOperands };
      break;

    case 'min':
      const minNode = node as MinNode;
      const minOperands = minNode.operands.map(op => evaluateNode(op, context, state));
      result = Math.min(...minOperands);
      description = `Min: min(${minOperands.join(', ')}) = ${result}`;
      inputValues = { operands: minOperands };
      break;

    case 'if':
      const ifNode = node as IfNode;
      const conditionMet = evaluateCondition(ifNode.condition, context);
      if (conditionMet) {
        result = evaluateNode(ifNode.then, context, state);
        description = `If: condition met → ${result}`;
      } else if (ifNode.else) {
        result = evaluateNode(ifNode.else, context, state);
        description = `If: condition not met → ${result}`;
      } else {
        result = 0;
        description = `If: condition not met, no else → 0`;
      }
      inputValues = { condition: ifNode.condition, conditionMet };
      break;

    case 'lookup':
      const lookupNode = node as LookupNode;
      const lookupResult = evaluateLookup(lookupNode, context, state);
      result = lookupResult.value;
      description = `Lookup: ${lookupResult.key} → ${result}`;
      inputValues = { key: lookupResult.key, table: lookupNode.table };
      break;

    case 'premium':
      const premiumNode = node as PremiumNode;
      const baseValue = evaluateNode(premiumNode.base, context, state);
      const percentage = premiumNode.percentage;
      if (premiumNode.mode === 'additive') {
        result = baseValue * (1 + percentage);
        description = `Premium (additive): ${baseValue} × (1 + ${(percentage * 100).toFixed(1)}%) = ${result}`;
      } else {
        result = baseValue * percentage;
        description = `Premium (multiplicative): ${baseValue} × ${(percentage * 100).toFixed(1)}% = ${result}`;
      }
      inputValues = { baseValue, percentage, mode: premiumNode.mode };
      break;

    case 'round':
      const roundNode = node as RoundNode;
      const valueToRound = evaluateNode(roundNode.value, context, state);
      const precision = roundNode.precision;
      const mode = roundNode.mode || 'round';
      const factor = Math.pow(10, precision);
      
      switch (mode) {
        case 'floor':
          result = Math.floor(valueToRound * factor) / factor;
          break;
        case 'ceil':
          result = Math.ceil(valueToRound * factor) / factor;
          break;
        default:
          result = Math.round(valueToRound * factor) / factor;
      }
      description = `Round (${mode}): ${valueToRound} → ${result} (${precision} decimals)`;
      inputValues = { valueToRound, precision, mode };
      break;

    default:
      throw new Error(`Unknown node type: ${(node as any).type}`);
  }

  // Add to audit trail
  state.auditTrail.push({
    nodeType: node.type,
    description,
    inputValues,
    outputValue: result,
    timestamp: new Date()
  });

  state.depth--;
  return result;
}

/**
 * Evaluate a literal value node
 */
function evaluateLiteral(node: LiteralNode): number {
  if (typeof node.value === 'number') {
    return node.value;
  }
  // Handle string numbers
  const parsed = parseFloat(node.value as string);
  if (isNaN(parsed)) {
    throw new Error(`Cannot convert literal "${node.value}" to number`);
  }
  return parsed;
}

/**
 * Evaluate a reference to context data
 */
function evaluateReference(node: ReferenceNode, context: EvaluationContext): number {
  const value = context[node.field];
  
  if (value === undefined || value === null) {
    console.warn(`Reference field "${node.field}" not found in context, defaulting to 0`);
    return 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  // Try to parse string as number
  const parsed = parseFloat(value);
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  throw new Error(`Reference field "${node.field}" value "${value}" cannot be converted to number`);
}

/**
 * Evaluate a tier lookup
 * Deterministic tier matching: finds the highest tier where refValue >= min
 * Max bounds are checked but gaps in tier ranges result in using the lower tier
 */
function evaluateTier(
  node: TierNode,
  context: EvaluationContext,
  state: EvalState
): { rate: number; refValue: number; tierLabel: string } {
  const refValue = evaluateNode(node.reference, context, state);
  
  // Sort tiers by min value (descending) to find highest matching tier first
  const sortedTiers = [...node.tiers].sort((a, b) => (b.min || 0) - (a.min || 0));
  
  // Find the highest tier where refValue >= min AND (no max OR refValue <= max)
  let matchedTier = node.tiers[0]; // Default to first defined tier
  
  for (const tier of sortedTiers) {
    const min = tier.min || 0;
    const max = tier.max;
    
    if (refValue >= min) {
      // Check max bound if defined
      if (max === null || max === undefined || refValue <= max) {
        matchedTier = tier;
        break; // Found the highest matching tier
      }
      // If refValue exceeds max, continue to check lower tiers
    }
  }
  
  // Normalize rate (handle both 0.05 and 5 formats)
  let rate = matchedTier.rate;
  if (rate > 1) {
    rate = rate / 100; // Convert percentage to decimal
  }
  
  return {
    rate,
    refValue,
    tierLabel: matchedTier.label || `${matchedTier.min}+`
  };
}

/**
 * Evaluate a condition for if/then/else
 */
function evaluateCondition(
  condition: IfNode['condition'],
  context: EvaluationContext
): boolean {
  const fieldValue = context[condition.field];
  const compareValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(compareValue).toLowerCase();
    
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
    
    case 'greaterThan':
      return Number(fieldValue) > Number(compareValue);
    
    case 'lessThan':
      return Number(fieldValue) < Number(compareValue);
    
    case 'in':
      if (Array.isArray(compareValue)) {
        return compareValue.some(v => 
          String(fieldValue).toLowerCase() === String(v).toLowerCase()
        );
      }
      return false;
    
    default:
      throw new Error(`Unknown condition operator: ${condition.operator}`);
  }
}

/**
 * Evaluate a lookup table
 */
function evaluateLookup(
  node: LookupNode,
  context: EvaluationContext,
  state: EvalState
): { value: number; key: string } {
  // Get the key to look up
  let key: string;
  
  if (node.reference.type === 'reference') {
    const refNode = node.reference as ReferenceNode;
    key = String(context[refNode.field] || '');
  } else {
    // Evaluate the reference node to get the key
    const refValue = evaluateNode(node.reference, context, state);
    key = String(refValue);
  }
  
  // Look up in table (case-insensitive)
  const normalizedKey = key.toLowerCase();
  let value = node.default ?? 0;
  
  for (const [tableKey, tableValue] of Object.entries(node.table)) {
    if (tableKey.toLowerCase() === normalizedKey) {
      value = tableValue;
      break;
    }
  }
  
  return { value, key };
}

/**
 * Check if formula filters match the context
 * Uses EXACT equality matching (case-insensitive) to prevent cross-contamination
 */
function checkFilters(
  filters: FormulaDefinition['filters'],
  context: EvaluationContext
): { passed: boolean; reason?: string } {
  if (!filters) {
    return { passed: true };
  }
  
  // Check product filter - EXACT match (case-insensitive)
  if (filters.products && filters.products.length > 0) {
    const productName = (context.productName || '').toLowerCase().trim();
    const matches = filters.products.some(p => 
      productName === p.toLowerCase().trim()
    );
    if (!matches) {
      return { passed: false, reason: `Product "${context.productName}" not in filter list` };
    }
  }
  
  // Check territory filter - EXACT match (case-insensitive)
  if (filters.territories && filters.territories.length > 0) {
    const territory = (context.territory || '').toLowerCase().trim();
    const matches = filters.territories.some(t => 
      territory === t.toLowerCase().trim()
    );
    if (!matches) {
      return { passed: false, reason: `Territory "${context.territory}" not in filter list` };
    }
  }
  
  // Check date range filter - use context's transaction date, not current date
  if (filters.dateRange) {
    const transactionDate = context.transactionDate 
      ? new Date(context.transactionDate) 
      : new Date();
    
    if (filters.dateRange.start) {
      const start = new Date(filters.dateRange.start);
      if (transactionDate < start) {
        return { passed: false, reason: `Transaction date before filter start date` };
      }
    }
    if (filters.dateRange.end) {
      const end = new Date(filters.dateRange.end);
      if (transactionDate > end) {
        return { passed: false, reason: `Transaction date after filter end date` };
      }
    }
  }
  
  return { passed: true };
}

/**
 * Convenience function: Evaluate formula with just the node (no full definition)
 */
export function evaluateFormula(
  formula: AnyFormulaNode,
  context: EvaluationContext
): EvaluationResult {
  const state: EvalState = {
    auditTrail: [],
    depth: 0
  };

  try {
    const value = evaluateNode(formula, context, state);
    return {
      value,
      success: true,
      auditTrail: state.auditTrail
    };
  } catch (error) {
    return {
      value: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown evaluation error',
      auditTrail: state.auditTrail
    };
  }
}

/**
 * Format audit trail as human-readable explanation
 */
export function formatAuditTrail(auditTrail: AuditStep[]): string {
  return auditTrail
    .map((step, index) => `${index + 1}. ${step.description}`)
    .join('\n');
}
