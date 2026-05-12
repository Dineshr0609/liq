/**
 * Extraction Validation Service
 * 
 * Validates that AI-extracted values actually exist in the cited source text.
 * This prevents hallucination and ensures traceability of extracted rules.
 */

export interface ValidationResult {
  isValid: boolean;
  valuesFound: string[];
  valuesMissing: string[];
  confidenceAdjustment: number; // Multiplier to apply to AI confidence
  details: ValidationDetail[];
}

export interface ValidationDetail {
  field: string;
  extractedValue: string;
  foundInSource: boolean;
  sourceMatch?: string; // The matching text found in source
}

export interface RuleForValidation {
  ruleType: string;
  ruleName: string;
  calculation?: {
    rate?: number;
    baseRate?: number;
    fixedAmount?: number;
    minimumAnnual?: number;
    threshold?: number;
    amount?: number;
    escalationRate?: number;
    terminationFee?: number;
    discountPercent?: number;
    premiumMultiplier?: number;
    tiers?: Array<{
      min: number;
      max?: number;
      rate: number;
    }>;
  };
  conditions?: {
    productCategories?: string[];
    territories?: string[];
  };
  sourceSpan?: {
    page?: number;
    section?: string;
    text: string;
  };
  confidence: number;
}

/**
 * Validate an extracted rule against its source text
 * Returns validation result with confidence adjustment
 */
export function validateRuleExtraction(rule: RuleForValidation): ValidationResult {
  const details: ValidationDetail[] = [];
  const valuesFound: string[] = [];
  const valuesMissing: string[] = [];
  
  const sourceText = rule.sourceSpan?.text || '';
  const sourceTextLower = sourceText.toLowerCase();
  
  // If no source text, validation fails
  if (!sourceText || sourceText.trim().length === 0) {
    return {
      isValid: false,
      valuesFound: [],
      valuesMissing: ['source text'],
      confidenceAdjustment: 0.4,
      details: [{
        field: 'sourceSpan.text',
        extractedValue: 'empty',
        foundInSource: false
      }]
    };
  }
  
  // Validate numeric values from calculation
  if (rule.calculation) {
    // Check rate/percentage values
    if (rule.calculation.rate !== undefined) {
      const result = validateNumericValue(rule.calculation.rate, sourceText, 'rate');
      details.push(result);
      if (result.foundInSource) {
        valuesFound.push(result.extractedValue);
      } else {
        valuesMissing.push(`rate: ${result.extractedValue}`);
      }
    }
    
    if (rule.calculation.baseRate !== undefined) {
      const result = validateNumericValue(rule.calculation.baseRate, sourceText, 'baseRate');
      details.push(result);
      if (result.foundInSource) {
        valuesFound.push(result.extractedValue);
      } else {
        valuesMissing.push(`baseRate: ${result.extractedValue}`);
      }
    }
    
    if (rule.calculation.fixedAmount !== undefined) {
      const result = validateNumericValue(rule.calculation.fixedAmount, sourceText, 'fixedAmount');
      details.push(result);
      if (result.foundInSource) {
        valuesFound.push(result.extractedValue);
      } else {
        valuesMissing.push(`fixedAmount: ${result.extractedValue}`);
      }
    }
    
    if (rule.calculation.threshold !== undefined) {
      const result = validateNumericValue(rule.calculation.threshold, sourceText, 'threshold');
      details.push(result);
      if (result.foundInSource) {
        valuesFound.push(result.extractedValue);
      } else {
        valuesMissing.push(`threshold: ${result.extractedValue}`);
      }
    }
    
    if (rule.calculation.minimumAnnual !== undefined) {
      const result = validateNumericValue(rule.calculation.minimumAnnual, sourceText, 'minimumAnnual');
      details.push(result);
      if (result.foundInSource) {
        valuesFound.push(result.extractedValue);
      } else {
        valuesMissing.push(`minimumAnnual: ${result.extractedValue}`);
      }
    }
    
    // Validate tiers
    if (rule.calculation.tiers && rule.calculation.tiers.length > 0) {
      for (let i = 0; i < rule.calculation.tiers.length; i++) {
        const tier = rule.calculation.tiers[i];
        
        // Validate tier min
        const minResult = validateNumericValue(tier.min, sourceText, `tier[${i}].min`);
        details.push(minResult);
        if (minResult.foundInSource) {
          valuesFound.push(minResult.extractedValue);
        } else {
          valuesMissing.push(`tier[${i}].min: ${minResult.extractedValue}`);
        }
        
        // Validate tier rate
        const rateResult = validateNumericValue(tier.rate, sourceText, `tier[${i}].rate`);
        details.push(rateResult);
        if (rateResult.foundInSource) {
          valuesFound.push(rateResult.extractedValue);
        } else {
          valuesMissing.push(`tier[${i}].rate: ${rateResult.extractedValue}`);
        }
      }
    }
    
  }
  
  // Calculate confidence adjustment based on validation results
  const totalChecks = details.length;
  const passedChecks = details.filter(d => d.foundInSource).length;
  
  let confidenceAdjustment: number;
  if (totalChecks === 0) {
    // No numeric values to validate, slightly reduce confidence
    confidenceAdjustment = 0.9;
  } else if (passedChecks === totalChecks) {
    // All values found - full confidence
    confidenceAdjustment = 1.0;
  } else if (passedChecks >= totalChecks * 0.7) {
    // Most values found - slight reduction
    confidenceAdjustment = 0.85;
  } else if (passedChecks >= totalChecks * 0.5) {
    // Half values found - moderate reduction
    confidenceAdjustment = 0.7;
  } else {
    // Few values found - significant reduction
    confidenceAdjustment = 0.5;
  }
  
  return {
    isValid: passedChecks > 0 || totalChecks === 0,
    valuesFound,
    valuesMissing,
    confidenceAdjustment,
    details
  };
}

/**
 * Validate a numeric value exists in source text
 * Handles various formats: 5%, $100, 100000, 100,000, etc.
 */
function validateNumericValue(value: number, sourceText: string, fieldName: string): ValidationDetail {
  const extractedValue = String(value);
  
  // Generate possible representations of this number
  const representations: string[] = [];
  
  // Raw number
  representations.push(String(value));
  
  // With commas for thousands
  representations.push(value.toLocaleString('en-US'));
  
  // As percentage (if small number, might be a rate)
  if (value < 1 && value > 0) {
    representations.push(`${(value * 100).toFixed(0)}%`);
    representations.push(`${(value * 100).toFixed(1)}%`);
    representations.push(`${(value * 100).toFixed(2)}%`);
    representations.push(`${value * 100}%`);
    representations.push(`${value * 100} %`);
    representations.push(`${value * 100} percent`);
  }
  
  // If already looks like a percentage (e.g., 5 for 5%)
  if (value >= 1 && value <= 100) {
    representations.push(`${value}%`);
    representations.push(`${value} %`);
    representations.push(`${value} percent`);
    representations.push(`${value.toFixed(1)}%`);
  }
  
  // Dollar amounts
  if (value >= 1) {
    representations.push(`$${value}`);
    representations.push(`$${value.toLocaleString('en-US')}`);
    representations.push(`$${Math.round(value)}`);
    representations.push(`$${Math.round(value).toLocaleString('en-US')}`);
    
    // Handle K/M notation
    if (value >= 1000) {
      representations.push(`$${(value / 1000).toFixed(0)}K`);
      representations.push(`$${(value / 1000).toFixed(0)}k`);
      representations.push(`${(value / 1000).toFixed(0)}K`);
      representations.push(`${(value / 1000).toFixed(0)}k`);
    }
    if (value >= 1000000) {
      representations.push(`$${(value / 1000000).toFixed(0)}M`);
      representations.push(`$${(value / 1000000).toFixed(1)}M`);
      representations.push(`${(value / 1000000).toFixed(0)}M`);
    }
  }
  
  // Decimal variations
  representations.push(value.toFixed(0));
  representations.push(value.toFixed(1));
  representations.push(value.toFixed(2));
  
  // Check if any representation exists in source text
  const sourceTextLower = sourceText.toLowerCase();
  for (const repr of representations) {
    if (sourceText.includes(repr) || sourceTextLower.includes(repr.toLowerCase())) {
      return {
        field: fieldName,
        extractedValue,
        foundInSource: true,
        sourceMatch: repr
      };
    }
  }
  
  return {
    field: fieldName,
    extractedValue,
    foundInSource: false
  };
}

/**
 * Validate a text value exists in source text (case-insensitive)
 */
function validateTextValue(value: string, sourceText: string, fieldName: string): ValidationDetail {
  const valueLower = value.toLowerCase().trim();
  const sourceTextLower = sourceText.toLowerCase();
  
  if (sourceTextLower.includes(valueLower)) {
    return {
      field: fieldName,
      extractedValue: value,
      foundInSource: true,
      sourceMatch: value
    };
  }
  
  return {
    field: fieldName,
    extractedValue: value,
    foundInSource: false
  };
}

/**
 * Validate multiple rules and return adjusted confidence scores
 * Note: Confidence is expected as 0-100 scale (e.g., 85 means 85%)
 */
export function validateRulesExtraction(rules: RuleForValidation[]): {
  rules: Array<RuleForValidation & { validation: ValidationResult; adjustedConfidence: number }>;
  summary: {
    totalRules: number;
    validRules: number;
    invalidRules: number;
    avgConfidenceAdjustment: number;
  };
} {
  const validatedRules = rules.map(rule => {
    const validation = validateRuleExtraction(rule);
    // Confidence is 0-100 scale; adjustment is 0-1 multiplier
    // Result preserves decimal precision before final rounding
    const rawAdjusted = rule.confidence * validation.confidenceAdjustment;
    const adjustedConfidence = Math.round(rawAdjusted * 10) / 10; // Keep one decimal place
    
    return {
      ...rule,
      validation,
      adjustedConfidence
    };
  });
  
  const validRules = validatedRules.filter(r => r.validation.isValid).length;
  const avgAdjustment = validatedRules.length > 0
    ? validatedRules.reduce((sum, r) => sum + r.validation.confidenceAdjustment, 0) / validatedRules.length
    : 1;
  
  return {
    rules: validatedRules,
    summary: {
      totalRules: rules.length,
      validRules,
      invalidRules: rules.length - validRules,
      avgConfidenceAdjustment: avgAdjustment
    }
  };
}

/**
 * Format validation result as human-readable string
 */
export function formatValidationResult(validation: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
  lines.push(`Confidence Adjustment: ${(validation.confidenceAdjustment * 100).toFixed(0)}%`);
  
  if (validation.valuesFound.length > 0) {
    lines.push(`Values Found: ${validation.valuesFound.join(', ')}`);
  }
  
  if (validation.valuesMissing.length > 0) {
    lines.push(`Values Missing: ${validation.valuesMissing.join(', ')}`);
  }
  
  return lines.join('\n');
}
