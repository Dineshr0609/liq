/**
 * Ensemble Validation Service
 * 
 * Runs extraction 2-3 times with different parameters,
 * compares results, and flags discrepancies for higher accuracy.
 * 
 * LAYMAN EXPLANATION:
 * Like getting multiple opinions from different doctors - we ask AI
 * to extract data multiple times (with slight variations), then
 * compare answers. If all agree, we're confident. If they differ,
 * we flag it for human review.
 */

import { groqService } from './groqService';
import { ragExtractionService } from './ragExtractionService';

export interface ExtractionPass {
  passNumber: number;
  passType: 'standard' | 'detailed' | 'conservative';
  extractedRules: any[];
  extractedMetadata: any;
  extractionTimeMs: number;
  confidence: number;
}

export interface DiscrepancyDetail {
  fieldName: string;
  values: { pass: number; value: any }[];
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface EnsembleResult {
  passes: ExtractionPass[];
  consensusRules: any[];
  consensusMetadata: any;
  discrepancies: DiscrepancyDetail[];
  overallConfidence: number;
  agreementScore: number;
  needsHumanReview: boolean;
  processingTimeMs: number;
}

interface RuleComparison {
  ruleIndex: number;
  field: string;
  values: any[];
  agreement: number;
}

/**
 * Compare two values with tolerance for numeric comparisons
 */
function valuesMatch(a: any, b: any, tolerance = 0.001): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  
  // Numeric comparison with tolerance
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= Math.abs(a) * tolerance;
  }
  
  // String comparison (case-insensitive, trimmed)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }
  
  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => valuesMatch(val, b[idx], tolerance));
  }
  
  // Object comparison
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => valuesMatch(a[key], b[key], tolerance));
  }
  
  return false;
}

/**
 * Find majority consensus value from multiple passes
 */
function findConsensus(values: any[]): { value: any; agreement: number } {
  if (values.length === 0) return { value: null, agreement: 0 };
  if (values.length === 1) return { value: values[0], agreement: 1 };
  
  // Count matching values
  const matches: { value: any; count: number }[] = [];
  
  for (const val of values) {
    const existing = matches.find(m => valuesMatch(m.value, val));
    if (existing) {
      existing.count++;
    } else {
      matches.push({ value: val, count: 1 });
    }
  }
  
  // Find majority
  const sorted = matches.sort((a, b) => b.count - a.count);
  const majority = sorted[0];
  
  return {
    value: majority.value,
    agreement: majority.count / values.length
  };
}

/**
 * Compare rules across multiple extraction passes
 */
function compareRulesAcrossPasses(passes: ExtractionPass[]): {
  consensusRules: any[];
  ruleDiscrepancies: DiscrepancyDetail[];
} {
  const consensusRules: any[] = [];
  const ruleDiscrepancies: DiscrepancyDetail[] = [];
  
  // Find maximum number of rules across all passes
  const maxRules = Math.max(...passes.map(p => (p.extractedRules || []).length));
  
  for (let ruleIdx = 0; ruleIdx < maxRules; ruleIdx++) {
    const ruleFromPasses = passes.map(p => p.extractedRules?.[ruleIdx] || null);
    const validRules = ruleFromPasses.filter(r => r !== null);
    
    if (validRules.length === 0) continue;
    
    // Build consensus rule by comparing each field
    const consensusRule: any = {};
    const allFieldsSet = new Set<string>();
    validRules.forEach(r => Object.keys(r).forEach(k => allFieldsSet.add(k)));
    const allFields = Array.from(allFieldsSet);
    
    for (const field of allFields) {
      const fieldValues = validRules.map(r => r[field]).filter(v => v !== undefined);
      const { value, agreement } = findConsensus(fieldValues);
      
      consensusRule[field] = value;
      
      // Track discrepancy if agreement is not unanimous
      if (agreement < 1 && fieldValues.length > 1) {
        const uniqueValues = fieldValues.filter((v, i, arr) => 
          arr.findIndex(x => valuesMatch(x, v)) === i
        );
        
        if (uniqueValues.length > 1) {
          ruleDiscrepancies.push({
            fieldName: `rule[${ruleIdx}].${field}`,
            values: passes.map((p, idx) => ({
              pass: idx + 1,
              value: p.extractedRules?.[ruleIdx]?.[field] ?? null
            })),
            severity: agreement < 0.5 ? 'high' : agreement < 0.75 ? 'medium' : 'low',
            recommendation: agreement < 0.5 
              ? 'Manual verification strongly recommended'
              : agreement < 0.75 
                ? 'Review suggested for accuracy'
                : 'Minor variance, consensus value likely correct'
          });
        }
      }
    }
    
    consensusRules.push(consensusRule);
  }
  
  return { consensusRules, ruleDiscrepancies };
}

/**
 * Compare metadata across passes
 */
function compareMetadataAcrossPasses(passes: ExtractionPass[]): {
  consensusMetadata: any;
  metadataDiscrepancies: DiscrepancyDetail[];
} {
  const consensusMetadata: any = {};
  const metadataDiscrepancies: DiscrepancyDetail[] = [];
  
  // Gather all metadata fields
  const allFieldsSet = new Set<string>();
  passes.forEach(p => {
    if (p.extractedMetadata) {
      Object.keys(p.extractedMetadata).forEach(k => allFieldsSet.add(k));
    }
  });
  const allMetaFields = Array.from(allFieldsSet);
  
  for (const field of allMetaFields) {
    const values = passes
      .map(p => p.extractedMetadata?.[field])
      .filter(v => v !== undefined);
    
    const { value, agreement } = findConsensus(values);
    consensusMetadata[field] = value;
    
    if (agreement < 1 && values.length > 1) {
      const uniqueValues = values.filter((v, i, arr) => 
        arr.findIndex(x => valuesMatch(x, v)) === i
      );
      
      if (uniqueValues.length > 1) {
        metadataDiscrepancies.push({
          fieldName: field,
          values: passes.map((p, idx) => ({
            pass: idx + 1,
            value: p.extractedMetadata?.[field] ?? null
          })),
          severity: agreement < 0.5 ? 'high' : agreement < 0.75 ? 'medium' : 'low',
          recommendation: agreement < 0.5 
            ? 'Significant disagreement - manual review required'
            : 'Minor discrepancy - consensus value used'
        });
      }
    }
  }
  
  return { consensusMetadata, metadataDiscrepancies };
}

/**
 * Run ensemble extraction with multiple passes
 */
export async function runEnsembleExtraction(
  contractId: string,
  contractText: string,
  contractType?: string,
  numPasses: number = 3
): Promise<EnsembleResult> {
  const startTime = Date.now();
  const passes: ExtractionPass[] = [];
  
  console.log(`🔄 [ENSEMBLE] Starting ${numPasses}-pass extraction for contract ${contractId}`);
  
  // Pass 1: Standard RAG extraction
  try {
    const pass1Start = Date.now();
    const result1 = await groqService.extractRulesWithRAG(contractId, contractText, contractType);
    passes.push({
      passNumber: 1,
      passType: 'standard',
      extractedRules: result1.rules || [],
      extractedMetadata: { contractType: contractType || 'unknown' },
      extractionTimeMs: Date.now() - pass1Start,
      confidence: result1.rules?.reduce((acc, r) => acc + (r.confidence || 0.8), 0) / Math.max(result1.rules?.length || 1, 1)
    });
    console.log(`   Pass 1 (standard): ${result1.rules?.length || 0} rules extracted`);
  } catch (error) {
    console.error('Pass 1 failed:', error);
  }
  
  // Pass 2: Legacy extraction (different approach)
  try {
    const pass2Start = Date.now();
    const result2 = await groqService.extractDetailedContractRules(contractText, contractType);
    passes.push({
      passNumber: 2,
      passType: 'detailed',
      extractedRules: result2.rules || [],
      extractedMetadata: { contractType: contractType || 'unknown' },
      extractionTimeMs: Date.now() - pass2Start,
      confidence: result2.rules?.reduce((acc, r) => acc + (r.confidence || 0.8), 0) / Math.max(result2.rules?.length || 1, 1)
    });
    console.log(`   Pass 2 (detailed): ${result2.rules?.length || 0} rules extracted`);
  } catch (error) {
    console.error('Pass 2 failed:', error);
  }
  
  // Pass 3: Conservative extraction with stricter prompting (if requested)
  if (numPasses >= 3) {
    try {
      const pass3Start = Date.now();
      // Use chunked approach for third pass
      const chunks = ragExtractionService.chunkContractText(contractText);
      const paymentChunks = chunks.filter(c => c.metadata.containsPaymentTerms);
      const context = ragExtractionService.buildExtractionContext(paymentChunks.slice(0, 5));
      const result3 = await groqService.extractDetailedContractRules(context, contractType);
      
      passes.push({
        passNumber: 3,
        passType: 'conservative',
        extractedRules: result3.rules || [],
        extractedMetadata: { contractType: contractType || 'unknown', chunkedExtraction: true },
        extractionTimeMs: Date.now() - pass3Start,
        confidence: result3.rules?.reduce((acc, r) => acc + (r.confidence || 0.7), 0) / Math.max(result3.rules?.length || 1, 1)
      });
      console.log(`   Pass 3 (conservative): ${result3.rules?.length || 0} rules extracted`);
    } catch (error) {
      console.error('Pass 3 failed:', error);
    }
  }
  
  // Compare results across passes
  const { consensusRules, ruleDiscrepancies } = compareRulesAcrossPasses(passes);
  const { consensusMetadata, metadataDiscrepancies } = compareMetadataAcrossPasses(passes);
  
  // Combine discrepancies
  const allDiscrepancies = [...ruleDiscrepancies, ...metadataDiscrepancies];
  
  // Calculate overall agreement score
  const highSeverityCount = allDiscrepancies.filter(d => d.severity === 'high').length;
  const mediumSeverityCount = allDiscrepancies.filter(d => d.severity === 'medium').length;
  
  const agreementScore = passes.length > 0
    ? Math.max(0, 1 - (highSeverityCount * 0.15) - (mediumSeverityCount * 0.05))
    : 0;
  
  // Calculate overall confidence
  const avgPassConfidence = passes.reduce((acc, p) => acc + p.confidence, 0) / Math.max(passes.length, 1);
  const overallConfidence = avgPassConfidence * agreementScore;
  
  // Determine if human review is needed
  const needsHumanReview = highSeverityCount > 0 || agreementScore < 0.7;
  
  console.log(`✅ [ENSEMBLE] Complete: ${consensusRules.length} consensus rules, ${allDiscrepancies.length} discrepancies`);
  console.log(`   Agreement score: ${(agreementScore * 100).toFixed(1)}%, Needs review: ${needsHumanReview}`);
  
  return {
    passes,
    consensusRules,
    consensusMetadata,
    discrepancies: allDiscrepancies,
    overallConfidence,
    agreementScore,
    needsHumanReview,
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * Run quick 2-pass validation (for production use)
 */
export async function runQuickEnsemble(
  contractId: string,
  contractText: string,
  contractType?: string
): Promise<EnsembleResult> {
  return runEnsembleExtraction(contractId, contractText, contractType, 2);
}

export const ensembleValidationService = {
  runEnsembleExtraction,
  runQuickEnsemble,
  valuesMatch,
  findConsensus
};
