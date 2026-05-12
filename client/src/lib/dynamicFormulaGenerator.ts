/**
 * Dynamic Formula Generator
 * 
 * Generates formula text dynamically based on field mappings and tableData,
 * rather than hardcoded rule type patterns. This makes the formula display
 * truly universal and works for any contract type.
 */

interface TableData {
  columns: string[];
  rows: Array<Record<string, any>>;
}

interface FieldMappings {
  volume?: string;
  rate?: string;
  minimum?: string;
  description?: string;
}

interface FormulaGeneratorOptions {
  tableData: TableData;
  fieldMappings: FieldMappings;
  ruleName?: string;
  ruleType?: string;
  baseRate?: number;
  minimumGuarantee?: number;
}

/**
 * Parse a numeric value from various formats
 */
function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') return value;
  if (!value) return null;
  
  const str = String(value);
  // Remove currency symbols, commas, and common suffixes
  const cleaned = str
    .replace(/[$€£¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/per\s*(unit|item)/gi, '')
    .replace(/\/unit/gi, '')
    .trim();
  
  // Check if it's a percentage
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
function parseVolumeRange(value: any): { min: number | null; max: number | null; display: string } {
  const display = String(value || '');
  
  if (!value) return { min: null, max: null, display };
  
  const str = String(value).toLowerCase();
  
  // Handle "X+" format (e.g., "15,001+ units")
  const plusMatch = str.match(/([\d,]+)\+/);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1].replace(/,/g, ''));
    return { min: isNaN(min) ? null : min, max: null, display };
  }
  
  // Handle "X - Y" or "X to Y" format
  const rangeMatch = str.match(/([\d,]+)\s*[-–—to]+\s*([\d,]+)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
    return { 
      min: isNaN(min) ? null : min, 
      max: isNaN(max) ? null : max, 
      display 
    };
  }
  
  // Try to parse as single number
  const singleNum = parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (!isNaN(singleNum)) {
    return { min: singleNum, max: null, display };
  }
  
  return { min: null, max: null, display };
}

/**
 * Detect if this is a tiered pricing structure
 */
function isTieredPricing(tableData: TableData, fieldMappings: FieldMappings): boolean {
  if (!fieldMappings.volume || !fieldMappings.rate) return false;
  if (tableData.rows.length < 2) return false;
  
  // Check if we have multiple rows with different volume ranges
  const volumeCol = fieldMappings.volume;
  const volumes = tableData.rows.map(row => parseVolumeRange(row[volumeCol]));
  
  // If most rows have parseable volume ranges, it's tiered
  const validVolumes = volumes.filter(v => v.min !== null);
  return validVolumes.length >= 2;
}

/**
 * Detect if this is a percentage-based structure
 */
function isPercentageBased(tableData: TableData, fieldMappings: FieldMappings): boolean {
  if (!fieldMappings.rate) return false;
  
  const rateCol = fieldMappings.rate;
  const rates = tableData.rows.map(row => String(row[rateCol] || ''));
  
  // Check if any rates contain percentage indicators
  return rates.some(r => r.includes('%') || (parseNumericValue(r) !== null && parseNumericValue(r)! < 1));
}

/**
 * Generate a dynamic formula based on field mappings and table data
 */
export function generateDynamicFormula(options: FormulaGeneratorOptions): string {
  const { tableData, fieldMappings, ruleName, ruleType, baseRate, minimumGuarantee } = options;
  
  if (!tableData || !tableData.columns || !tableData.rows || tableData.rows.length === 0) {
    // Fallback for rules without table data
    if (baseRate) {
      const isPercentage = baseRate > 0 && baseRate < 1;
      if (isPercentage) {
        return `royalty = sales × ${(baseRate * 100).toFixed(1)}%`;
      }
      return `royalty = quantity × $${baseRate.toFixed(2)}`;
    }
    if (minimumGuarantee) {
      return `royalty = max(calculated_royalty, $${minimumGuarantee.toLocaleString()})`;
    }
    return '';
  }
  
  const parts: string[] = [];
  const { columns, rows } = tableData;
  
  // Get column names from mappings
  const volumeCol = fieldMappings.volume;
  const rateCol = fieldMappings.rate;
  const minCol = fieldMappings.minimum;
  const descCol = fieldMappings.description;
  
  // Determine formula type based on data structure
  const isTiered = isTieredPricing(tableData, fieldMappings);
  const isPercentage = isPercentageBased(tableData, fieldMappings);
  
  // Add header based on detected type
  if (isTiered) {
    if (isPercentage) {
      parts.push('📊 Tiered Percentage Pricing:');
    } else {
      parts.push('📊 Tiered Per-Unit Pricing:');
    }
  } else if (isPercentage) {
    parts.push('📊 Percentage-Based Pricing:');
  } else {
    parts.push('📊 Pricing Structure:');
  }
  parts.push('');
  
  // Build table display using actual column names
  if (volumeCol || rateCol || minCol) {
    // Create header row
    const headerParts: string[] = [];
    if (volumeCol) headerParts.push(volumeCol);
    if (rateCol) headerParts.push(rateCol);
    if (minCol) headerParts.push(minCol);
    
    parts.push(headerParts.join(' | '));
    parts.push(headerParts.map(() => '----------').join(' | '));
    
    // Add data rows
    rows.forEach((row, idx) => {
      const rowParts: string[] = [];
      if (volumeCol) rowParts.push(String(row[volumeCol] || '-'));
      if (rateCol) rowParts.push(String(row[rateCol] || '-'));
      if (minCol) rowParts.push(String(row[minCol] || '-'));
      parts.push(rowParts.join(' | '));
    });
    
    parts.push('');
  }
  
  // Generate formula logic
  parts.push('Formula:');
  
  if (isTiered && volumeCol && rateCol) {
    // Tiered formula with conditions
    rows.forEach((row, idx) => {
      const volumeRange = parseVolumeRange(row[volumeCol]);
      const rate = parseNumericValue(row[rateCol]);
      const min = minCol ? parseNumericValue(row[minCol]) : null;
      
      let condition = '';
      if (volumeRange.min !== null && volumeRange.max !== null) {
        condition = `if (${volumeCol} >= ${volumeRange.min.toLocaleString()} && ${volumeCol} <= ${volumeRange.max.toLocaleString()})`;
      } else if (volumeRange.min !== null) {
        condition = `if (${volumeCol} >= ${volumeRange.min.toLocaleString()})`;
      } else {
        condition = `// Tier ${idx + 1}: ${volumeRange.display}`;
      }
      
      let formula = '';
      if (rate !== null) {
        if (isPercentage || (rate > 0 && rate < 1)) {
          formula = `  royalty = ${volumeCol} × ${(rate * 100).toFixed(1)}%`;
        } else {
          formula = `  royalty = ${volumeCol} × $${rate.toFixed(2)}`;
        }
      }
      
      if (min !== null) {
        formula += `\n  minimum = $${min.toLocaleString()}`;
      }
      
      if (idx === 0) {
        parts.push(`${condition} {`);
        parts.push(formula);
        parts.push('}');
      } else {
        parts.push(`else ${condition} {`);
        parts.push(formula);
        parts.push('}');
      }
    });
  } else if (rateCol) {
    // Simple rate-based formula
    const firstRate = parseNumericValue(rows[0]?.[rateCol]);
    if (firstRate !== null) {
      if (isPercentage || (firstRate > 0 && firstRate < 1)) {
        parts.push(`royalty = sales × ${(firstRate * 100).toFixed(1)}%`);
      } else {
        parts.push(`royalty = quantity × $${firstRate.toFixed(2)}`);
      }
    }
  } else {
    // Generic formula when mappings are incomplete
    parts.push('royalty = quantity × rate');
    parts.push('');
    parts.push('(Configure field mappings to see specific formula)');
  }
  
  // Add minimum guarantee if present
  if (minimumGuarantee) {
    parts.push('');
    parts.push(`Minimum Guarantee: $${minimumGuarantee.toLocaleString()}`);
    parts.push('final_royalty = max(royalty, minimum_guarantee)');
  }
  
  return parts.join('\n');
}

/**
 * Generate a summary of the pricing structure for display
 */
export function generatePricingSummary(options: FormulaGeneratorOptions): string {
  const { tableData, fieldMappings } = options;
  
  if (!tableData || tableData.rows.length === 0) {
    return 'No pricing data available';
  }
  
  const tierCount = tableData.rows.length;
  const rateCol = fieldMappings.rate;
  
  if (rateCol) {
    const rates = tableData.rows
      .map(row => parseNumericValue(row[rateCol]))
      .filter(r => r !== null) as number[];
    
    if (rates.length > 0) {
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      
      if (minRate < 1) {
        // Percentage rates
        return `${tierCount} tier${tierCount > 1 ? 's' : ''}: ${(minRate * 100).toFixed(1)}% - ${(maxRate * 100).toFixed(1)}%`;
      } else {
        // Dollar rates
        return `${tierCount} tier${tierCount > 1 ? 's' : ''}: $${minRate.toFixed(2)} - $${maxRate.toFixed(2)}`;
      }
    }
  }
  
  return `${tierCount} pricing tier${tierCount > 1 ? 's' : ''}`;
}

export { parseNumericValue, parseVolumeRange };
