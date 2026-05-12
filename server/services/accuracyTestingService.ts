import { pool } from '../db';
import { ragExtractionService } from './ragExtractionService';
import { groqService } from './groqService';
import { CONTRACT_TEST_SUITE } from '../data/testContracts';
import { ensembleValidationService, EnsembleResult } from './ensembleValidationService';
import { layoutAwareChunkingService, LayoutChunk } from './layoutAwareChunking';

export interface GroundTruthField {
  fieldName: string;
  expectedValue: any;
  fieldType: 'string' | 'number' | 'date' | 'array' | 'object' | 'boolean';
  isRequired: boolean;
  tolerance?: number;
}

export interface TestCaseInput {
  name: string;
  contractType: string;
  contractText: string;
  groundTruth: GroundTruthField[];
  description?: string;
  source?: 'synthetic' | 'pdf_upload' | 'manual';
}

export interface FieldComparisonResult {
  fieldName: string;
  expected: any;
  extracted: any;
  match: boolean;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'missing' | 'extra';
  confidence: number;
  notes?: string;
}

export interface TestResult {
  testCaseId: number;
  testCaseName: string;
  contractType: string;
  overallAccuracy: number;
  fieldResults: FieldComparisonResult[];
  extractionTimeMs: number;
  extractedData: any;
  passed: boolean;
}

export interface AccuracyMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  overallAccuracy: number;
  byContractType: Record<string, { accuracy: number; count: number }>;
  byFieldType: Record<string, { accuracy: number; count: number }>;
  averageExtractionTimeMs: number;
}

function normalizeValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.toLowerCase().trim();
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const normalized: any = {};
    for (const key of Object.keys(value)) {
      normalized[key.toLowerCase()] = normalizeValue(value[key]);
    }
    return normalized;
  }
  return value;
}

function compareValues(expected: any, extracted: any, fieldType: string, tolerance?: number): { match: boolean; matchType: string; confidence: number } {
  const normExpected = normalizeValue(expected);
  const normExtracted = normalizeValue(extracted);

  if (normExtracted === null || normExtracted === undefined) {
    return { match: false, matchType: 'missing', confidence: 0 };
  }

  if (fieldType === 'number') {
    const expNum = typeof expected === 'number' ? expected : parseFloat(expected);
    const extNum = typeof extracted === 'number' ? extracted : parseFloat(extracted);
    
    if (isNaN(expNum) || isNaN(extNum)) {
      return { match: false, matchType: 'partial', confidence: 0 };
    }
    
    const tol = tolerance ?? 0.001;
    const diff = Math.abs(expNum - extNum);
    const relDiff = expNum !== 0 ? diff / Math.abs(expNum) : diff;
    
    if (relDiff <= tol) {
      return { match: true, matchType: 'exact', confidence: 1 - relDiff };
    }
    if (relDiff <= tol * 10) {
      return { match: false, matchType: 'partial', confidence: 0.5 };
    }
    return { match: false, matchType: 'partial', confidence: 0 };
  }

  if (fieldType === 'string') {
    if (normExpected === normExtracted) {
      return { match: true, matchType: 'exact', confidence: 1 };
    }
    
    const expStr = String(normExpected);
    const extStr = String(normExtracted);
    
    if (expStr.includes(extStr) || extStr.includes(expStr)) {
      const overlap = Math.min(expStr.length, extStr.length) / Math.max(expStr.length, extStr.length);
      return { match: overlap > 0.8, matchType: 'fuzzy', confidence: overlap };
    }
    
    const words1 = new Set(expStr.split(/\s+/));
    const words2 = new Set(extStr.split(/\s+/));
    const words1Arr = Array.from(words1);
    const intersection = words1Arr.filter(x => words2.has(x));
    const unionSize = words1.size + words2.size - intersection.length;
    const jaccard = unionSize > 0 ? intersection.length / unionSize : 0;
    
    return { 
      match: jaccard > 0.7, 
      matchType: jaccard > 0.9 ? 'fuzzy' : 'partial', 
      confidence: jaccard 
    };
  }

  if (fieldType === 'date') {
    const expDate = new Date(expected);
    const extDate = new Date(extracted);
    
    if (isNaN(expDate.getTime()) || isNaN(extDate.getTime())) {
      return { match: false, matchType: 'partial', confidence: 0 };
    }
    
    const daysDiff = Math.abs(expDate.getTime() - extDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff === 0) {
      return { match: true, matchType: 'exact', confidence: 1 };
    }
    if (daysDiff <= 1) {
      return { match: true, matchType: 'fuzzy', confidence: 0.95 };
    }
    return { match: false, matchType: 'partial', confidence: Math.max(0, 1 - daysDiff / 30) };
  }

  if (fieldType === 'array') {
    const expArr = Array.isArray(expected) ? expected : [expected];
    const extArr = Array.isArray(extracted) ? extracted : [extracted];
    
    let matchCount = 0;
    for (const exp of expArr) {
      for (const ext of extArr) {
        const { match } = compareValues(exp, ext, typeof exp === 'number' ? 'number' : 'string');
        if (match) {
          matchCount++;
          break;
        }
      }
    }
    
    const recall = matchCount / expArr.length;
    const precision = extArr.length > 0 ? matchCount / extArr.length : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    
    return { 
      match: f1 > 0.8, 
      matchType: f1 === 1 ? 'exact' : f1 > 0.5 ? 'partial' : 'missing',
      confidence: f1 
    };
  }

  if (fieldType === 'object') {
    const expObj = typeof expected === 'object' ? expected : {};
    const extObj = typeof extracted === 'object' ? extracted : {};
    
    const expKeys = Object.keys(expObj);
    const extKeys = Object.keys(extObj);
    const allKeysSet = new Set([...expKeys, ...extKeys]);
    const allKeys = Array.from(allKeysSet);
    let totalScore = 0;
    let count = 0;
    
    for (const key of allKeys) {
      if (key in expObj && key in extObj) {
        const { confidence } = compareValues(expObj[key], extObj[key], typeof expObj[key] === 'number' ? 'number' : 'string');
        totalScore += confidence;
      }
      count++;
    }
    
    const avgScore = count > 0 ? totalScore / count : 0;
    return { 
      match: avgScore > 0.8, 
      matchType: avgScore === 1 ? 'exact' : avgScore > 0.5 ? 'partial' : 'missing',
      confidence: avgScore 
    };
  }

  return { match: normExpected === normExtracted, matchType: 'exact', confidence: normExpected === normExtracted ? 1 : 0 };
}

/**
 * Transform AI extraction results to a flat structure matching ground truth field names
 * This bridges the gap between nested AI output and expected flat ground truth fields
 */
function flattenExtractionForGroundTruth(extracted: any): any {
  const flattened: any = { ...extracted };
  
  // Extract values from rules array into flat fields
  if (Array.isArray(extracted?.rules) && extracted.rules.length > 0) {
    const rules = extracted.rules;
    
    // Debug: log all rules for analysis
    console.log(`[FLATTEN-DEBUG] Processing ${rules.length} rules:`);
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      console.log(`  Rule ${i}: ${r.ruleName || 'unnamed'} | type: ${r.ruleType} | calc: ${JSON.stringify(r.calculation)}`);
    }
    
    // Look for percentage/fee rates
    for (const rule of rules) {
      const ruleType = rule.ruleType?.toLowerCase() || '';
      const ruleName = (rule.ruleName || rule.description || '').toLowerCase();
      const ruleDesc = (rule.description || '').toLowerCase();
      const fullText = `${ruleName} ${ruleDesc}`.toLowerCase();
      
      // Extract rate values (handle both decimal and percentage formats)
      if (rule.calculation?.rate !== undefined) {
        let ratePercent = rule.calculation.rate;
        // Convert decimal to percentage if needed
        if (ratePercent < 1 && ratePercent > 0) {
          ratePercent = ratePercent * 100;
        }
        
        // Map to specific ground truth field names based on rule context
        if (fullText.includes('base') && (fullText.includes('contract fee') || ruleType === 'percentage')) {
          if (!flattened.baseRoyaltyRate) flattened.baseRoyaltyRate = ratePercent;
        }
        if (!flattened.royaltyRate && (fullText.includes('contract fee') || ruleType === 'percentage')) {
          flattened.royaltyRate = ratePercent;
        }
        if (fullText.includes('referral') || fullText.includes('commission')) {
          if (!flattened.referralRate) flattened.referralRate = ratePercent;
          if (!flattened.commissionRate) flattened.commissionRate = ratePercent;
        }
        if (fullText.includes('mdf') || fullText.includes('marketing')) {
          if (!flattened.mdfRate) flattened.mdfRate = ratePercent;
          if (!flattened.marketingRoyalty) flattened.marketingRoyalty = ratePercent;
        }
        if (fullText.includes('discount')) {
          if (!flattened.distributorDiscount) flattened.distributorDiscount = ratePercent;
        }
        // Reduced rates - check for high volume, threshold, or conditional adjustments
        if (fullText.includes('reduced') || fullText.includes('high volume') || 
            fullText.includes('exceed') || fullText.includes('above')) {
          if (!flattened.reducedRate) flattened.reducedRate = ratePercent;
        }
        if (fullText.includes('exclusive') && fullText.includes('retail')) {
          if (!flattened.exclusiveRetailAddition) flattened.exclusiveRetailAddition = ratePercent;
        }
        if (fullText.includes('manufacturing') && (fullText.includes('reduction') || fullText.includes('own'))) {
          if (!flattened.manufacturingReduction) flattened.manufacturingReduction = ratePercent;
        }
        if (fullText.includes('additional') && (fullText.includes('retail') || fullText.includes('exclusive'))) {
          if (!flattened.exclusiveRetailAddition) flattened.exclusiveRetailAddition = ratePercent;
        }
      }
      
      // Extract fixed amounts and caps from multiple possible locations
      const amount = rule.calculation?.amount || rule.calculation?.cap || rule.calculation?.maxAmount || 
                     rule.calculation?.minimum || rule.calculation?.floor || rule.calculation?.ceiling;
      
      if (amount !== undefined) {
        // Minimums
        if (fullText.includes('minimum') && fullText.includes('quarterly')) {
          if (!flattened.quarterlyMinimum) flattened.quarterlyMinimum = amount;
        } else if (fullText.includes('minimum') && fullText.includes('annual')) {
          if (!flattened.annualMinimum) flattened.annualMinimum = amount;
        } else if (fullText.includes('minimum') || fullText.includes('floor')) {
          if (!flattened.minimumPayment) flattened.minimumPayment = amount;
          if (!flattened.minimumAnnualFee) flattened.minimumAnnualFee = amount;
        }
        
        if (fullText.includes('fee') || fullText.includes('license')) {
          if (!flattened.licenseFee) flattened.licenseFee = amount;
          if (!flattened.initialLicenseFee) flattened.initialLicenseFee = amount;
        }
        
        // Extract caps - more flexible matching
        if ((fullText.includes('category') || fullText.includes('product')) && 
            (fullText.includes('cap') || fullText.includes('maximum') || fullText.includes('limit'))) {
          if (!flattened.perCategoryCap) flattened.perCategoryCap = amount;
        }
        if ((fullText.includes('sku') || fullText.includes('item')) && 
            (fullText.includes('cap') || fullText.includes('maximum') || fullText.includes('limit'))) {
          if (!flattened.perSkuCap) flattened.perSkuCap = amount;
        }
        if ((fullText.includes('aggregate') || fullText.includes('annual') || fullText.includes('total')) && 
            (fullText.includes('cap') || fullText.includes('ceiling') || fullText.includes('maximum'))) {
          if (!flattened.aggregateCap) flattened.aggregateCap = amount;
        }
      }
      
      // Also look for caps in dedicated cap fields
      if (rule.calculation?.perCategoryCap) {
        if (!flattened.perCategoryCap) flattened.perCategoryCap = rule.calculation.perCategoryCap;
      }
      if (rule.calculation?.perSkuCap) {
        if (!flattened.perSkuCap) flattened.perSkuCap = rule.calculation.perSkuCap;
      }
      if (rule.calculation?.aggregateCap || rule.calculation?.annualCap) {
        if (!flattened.aggregateCap) flattened.aggregateCap = rule.calculation.aggregateCap || rule.calculation.annualCap;
      }
      
      // Extract threshold values from multiple possible locations
      const threshold = rule.conditions?.threshold || rule.conditions?.salesThreshold || 
                        rule.calculation?.threshold || rule.calculation?.salesThreshold ||
                        rule.conditions?.minimumSales || rule.conditions?.revenueThreshold;
      if (threshold !== undefined) {
        if (!flattened.salesThresholdForReduction) flattened.salesThresholdForReduction = threshold;
      }
      
      // Also check description for threshold/exceed values
      if (fullText.includes('exceed') || fullText.includes('threshold') || fullText.includes('above')) {
        // Try to extract numeric threshold from description
        const thresholdMatch = ruleDesc.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:m(?:illion)?)?/i);
        if (thresholdMatch && !flattened.salesThresholdForReduction) {
          let val = parseFloat(thresholdMatch[1].replace(/,/g, ''));
          if (ruleDesc.toLowerCase().includes('million') || ruleDesc.toLowerCase().includes(' m ')) {
            val = val * 1000000;
          }
          flattened.salesThresholdForReduction = val;
        }
      }
      
      // Extract per-unit rates
      if (rule.calculation?.perUnit !== undefined) {
        if (!flattened.perUnitRate) flattened.perUnitRate = rule.calculation.perUnit;
      }
      
      // Extract calculation base
      if (rule.calculation?.base) {
        if (!flattened.calculationBase) flattened.calculationBase = rule.calculation.base;
      }
      
      // Extract payment frequency from conditions
      if (rule.conditions?.paymentFrequency) {
        if (!flattened.paymentFrequency) flattened.paymentFrequency = rule.conditions.paymentFrequency;
      }
      
      // Extract territories
      if (rule.conditions?.territories && Array.isArray(rule.conditions.territories)) {
        if (!flattened.territories) flattened.territories = rule.conditions.territories;
      }
      
      // Also check sourceSpan for values mentioned in the contract
      if (rule.sourceSpan?.text) {
        const sourceText = rule.sourceSpan.text.toLowerCase();
        const sourceOriginal = rule.sourceSpan.text;
        
        // Extract dollar amounts from source text
        const dollarMatches = sourceOriginal.match(/\$([0-9,]+)/g) || [];
        for (const match of dollarMatches) {
          const value = parseInt(match.replace(/[$,]/g, ''));
          
          // Check context in both ruleName and sourceText
          if ((fullText.includes('quarterly') || sourceText.includes('quarterly')) && 
              (fullText.includes('minimum') || sourceText.includes('minimum'))) {
            if (!flattened.quarterlyMinimum) flattened.quarterlyMinimum = value;
          }
          if ((fullText.includes('annual') || sourceText.includes('annual')) && 
              (fullText.includes('minimum') || sourceText.includes('minimum'))) {
            if (!flattened.annualMinimum) flattened.annualMinimum = value;
          }
          // Per-category and per-SKU caps
          if ((fullText.includes('category') || sourceText.includes('category')) && 
              (fullText.includes('cap') || sourceText.includes('cap') || sourceText.includes('maximum'))) {
            if (!flattened.perCategoryCap) flattened.perCategoryCap = value;
          }
          if ((fullText.includes('sku') || sourceText.includes('sku') || sourceText.includes('item')) && 
              (fullText.includes('cap') || sourceText.includes('cap') || sourceText.includes('maximum'))) {
            if (!flattened.perSkuCap) flattened.perSkuCap = value;
          }
          // Aggregate/annual cap
          if ((fullText.includes('aggregate') || sourceText.includes('aggregate') || 
               (fullText.includes('annual') && fullText.includes('cap'))) && 
              (sourceText.includes('annually') || sourceText.includes('aggregate') || sourceText.includes('total'))) {
            if (!flattened.aggregateCap) flattened.aggregateCap = value;
          }
        }
        
        // Extract percentage from source text
        const percentMatch = sourceOriginal.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch && !flattened.royaltyRate) {
          flattened.royaltyRate = parseFloat(percentMatch[1]);
        }
      }
    }
    
    // Keep the rules array for array-type ground truth fields
    flattened.rules = rules;
  }
  
  // Extract from contract analysis
  if (extracted?.licensingTerms) {
    const terms = extracted.licensingTerms;
    if (terms.termYears && !flattened.termYears) flattened.termYears = terms.termYears;
    if (terms.paymentFrequency && !flattened.paymentFrequency) flattened.paymentFrequency = terms.paymentFrequency;
  }
  
  // Extract payment schedule info
  if (extracted?.paymentSchedule) {
    const schedule = extracted.paymentSchedule;
    if (schedule.frequency && !flattened.paymentFrequency) flattened.paymentFrequency = schedule.frequency;
    if (schedule.reportingFrequency && !flattened.reportingFrequency) flattened.reportingFrequency = schedule.reportingFrequency;
  }
  
  console.log(`[FLATTEN] Transformed extraction: ${Object.keys(flattened).length} fields`);
  console.log(`[FLATTEN] Extracted fields: ${Object.keys(flattened).filter(k => !['summary', 'keyTerms', 'riskAnalysis', 'insights', 'confidence', 'rules'].includes(k)).join(', ')}`);
  
  return flattened;
}

function extractFieldFromResult(extracted: any, fieldName: string): any {
  // First try to flatten the extraction for better matching
  const flattened = flattenExtractionForGroundTruth(extracted);
  
  // Try direct field access on flattened result first
  if (flattened[fieldName] !== undefined) {
    return flattened[fieldName];
  }
  
  // Fall back to path-based extraction
  const path = fieldName.split('.');
  let current = flattened;
  
  for (const key of path) {
    if (current === null || current === undefined) return null;
    
    const lowerKey = key.toLowerCase();
    const matchingKey = Object.keys(current).find(k => k.toLowerCase() === lowerKey);
    
    if (matchingKey) {
      current = current[matchingKey];
    } else if (Array.isArray(current)) {
      const index = parseInt(key);
      if (!isNaN(index) && index < current.length) {
        current = current[index];
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  
  return current;
}

export async function createTestCase(input: TestCaseInput): Promise<number> {
  const result = await pool.query(
    `INSERT INTO accuracy_test_cases (name, contract_type, contract_text, ground_truth, description, source, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
     RETURNING id`,
    [input.name, input.contractType, input.contractText, JSON.stringify(input.groundTruth), input.description || null, input.source || 'synthetic']
  );
  
  return result.rows[0].id;
}

export async function getTestCases(contractType?: string): Promise<any[]> {
  let query = 'SELECT * FROM accuracy_test_cases WHERE is_active = true';
  const params: any[] = [];
  
  if (contractType) {
    query += ' AND contract_type = $1';
    params.push(contractType);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getTestCaseById(testCaseId: number): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM accuracy_test_cases WHERE id = $1',
    [testCaseId]
  );
  return result.rows[0] || null;
}

export async function runSingleTest(
  testCaseId: number, 
  extractionMode: 'legacy' | 'rag' = 'rag'
): Promise<TestResult> {
  const testCaseResult = await pool.query(
    'SELECT * FROM accuracy_test_cases WHERE id = $1',
    [testCaseId]
  );
  
  if (testCaseResult.rows.length === 0) {
    throw new Error(`Test case ${testCaseId} not found`);
  }
  
  const testCase = testCaseResult.rows[0];

  const startTime = Date.now();
  
  let extracted: any;
  try {
    // Use the SAME extraction methods as production to ensure test validity
    // Generate a temporary test ID for the RAG pipeline
    const tempContractId = `test_${testCaseId}_${Date.now()}`;
    
    if (extractionMode === 'rag') {
      // Use PRODUCTION RAG extraction pipeline for accurate testing
      // This calls the same extractRulesWithRAG that production uses
      const rulesResult = await groqService.extractRulesWithRAG(
        tempContractId, 
        testCase.contract_text,
        testCase.contract_type
      );
      
      // Also get general contract analysis for metadata extraction
      const analysis = await groqService.analyzeContract(testCase.contract_text);
      
      // Combine results to match expected ground truth structure
      extracted = {
        ...analysis,
        rules: rulesResult.rules || []
      };
    } else {
      // Legacy mode - direct analysis without RAG chunking
      const legacyRules = await groqService.extractDetailedContractRules(
        testCase.contract_text,
        testCase.contract_type
      );
      const analysis = await groqService.analyzeContract(testCase.contract_text);
      
      extracted = {
        ...analysis,
        rules: legacyRules.rules || []
      };
    }
  } catch (error) {
    console.error('Extraction failed:', error);
    extracted = { error: String(error) };
  }
  
  const extractionTimeMs = Date.now() - startTime;

  const groundTruth = testCase.ground_truth as GroundTruthField[];
  const fieldResults: FieldComparisonResult[] = [];
  let matchCount = 0;
  let totalRequired = 0;

  // Debug: log the flattened extraction once
  const flattenedOnce = flattenExtractionForGroundTruth(extracted);
  console.log(`[ACCURACY-DEBUG] Testing ${groundTruth.length} ground truth fields`);
  console.log(`[ACCURACY-DEBUG] Flattened keys: ${Object.keys(flattenedOnce).filter(k => !['summary', 'keyTerms', 'riskAnalysis', 'insights', 'confidence', 'rules'].includes(k)).join(', ')}`);
  
  for (const field of groundTruth) {
    const extractedValue = extractFieldFromResult(extracted, field.fieldName);
    const comparison = compareValues(field.expectedValue, extractedValue, field.fieldType, field.tolerance);
    
    // Debug logging for each field comparison
    console.log(`[ACCURACY-DEBUG] Field: ${field.fieldName} | Expected: ${JSON.stringify(field.expectedValue)} | Extracted: ${JSON.stringify(extractedValue)} | Match: ${comparison.match}`);
    
    fieldResults.push({
      fieldName: field.fieldName,
      expected: field.expectedValue,
      extracted: extractedValue,
      match: comparison.match,
      matchType: comparison.matchType as any,
      confidence: comparison.confidence,
      notes: comparison.matchType === 'missing' ? 'Field not found in extraction' : undefined
    });

    if (field.isRequired) {
      totalRequired++;
      if (comparison.match) matchCount++;
    }
  }
  
  const overallAccuracy = totalRequired > 0 ? matchCount / totalRequired : 0;
  const passed = overallAccuracy >= 0.8;
  
  console.log(`[ACCURACY-DEBUG] Result: ${matchCount}/${totalRequired} matched = ${(overallAccuracy * 100).toFixed(1)}%`);

  return {
    testCaseId,
    testCaseName: testCase.name,
    contractType: testCase.contract_type,
    overallAccuracy,
    fieldResults,
    extractionTimeMs,
    extractedData: extracted,
    passed
  };
}

export async function runTestSuite(
  extractionMode: 'legacy' | 'rag' = 'rag',
  contractType?: string
): Promise<{ runId: number; results: TestResult[]; metrics: AccuracyMetrics }> {
  const testCases = await getTestCases(contractType);
  
  if (testCases.length === 0) {
    throw new Error('No test cases found');
  }

  const runResult = await pool.query(
    `INSERT INTO accuracy_test_runs (extraction_mode, started_at, status)
     VALUES ($1, NOW(), 'running')
     RETURNING id`,
    [extractionMode]
  );
  const runId = runResult.rows[0].id;

  const results: TestResult[] = [];
  const byContractType: Record<string, { total: number; correct: number }> = {};
  const byFieldType: Record<string, { total: number; correct: number }> = {};
  let totalExtractionTime = 0;

  for (const testCase of testCases) {
    try {
      const result = await runSingleTest(testCase.id, extractionMode);
      results.push(result);
      totalExtractionTime += result.extractionTimeMs;

      if (!byContractType[result.contractType]) {
        byContractType[result.contractType] = { total: 0, correct: 0 };
      }
      byContractType[result.contractType].total++;
      if (result.passed) byContractType[result.contractType].correct++;

      for (const fieldResult of result.fieldResults) {
        const fieldType = 'general';
        if (!byFieldType[fieldType]) {
          byFieldType[fieldType] = { total: 0, correct: 0 };
        }
        byFieldType[fieldType].total++;
        if (fieldResult.match) byFieldType[fieldType].correct++;
      }

      await pool.query(
        `INSERT INTO accuracy_test_results (run_id, test_case_id, passed, accuracy, field_results, extracted_data, extraction_time_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [runId, testCase.id, result.passed, result.overallAccuracy, JSON.stringify(result.fieldResults), JSON.stringify(result.extractedData), result.extractionTimeMs]
      );
    } catch (error) {
      console.error(`Test case ${testCase.id} failed:`, error);
      results.push({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        contractType: testCase.contract_type,
        overallAccuracy: 0,
        fieldResults: [],
        extractionTimeMs: 0,
        extractedData: { error: String(error) },
        passed: false
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const overallAccuracy = results.length > 0 
    ? results.reduce((sum, r) => sum + r.overallAccuracy, 0) / results.length 
    : 0;

  const metrics: AccuracyMetrics = {
    totalTests: results.length,
    passed,
    failed: results.length - passed,
    overallAccuracy,
    byContractType: Object.fromEntries(
      Object.entries(byContractType).map(([type, data]) => [
        type, 
        { accuracy: data.total > 0 ? data.correct / data.total : 0, count: data.total }
      ])
    ),
    byFieldType: Object.fromEntries(
      Object.entries(byFieldType).map(([type, data]) => [
        type, 
        { accuracy: data.total > 0 ? data.correct / data.total : 0, count: data.total }
      ])
    ),
    averageExtractionTimeMs: results.length > 0 ? totalExtractionTime / results.length : 0
  };

  await pool.query(
    `UPDATE accuracy_test_runs 
     SET completed_at = NOW(), status = 'completed', total_tests = $1, passed_tests = $2, failed_tests = $3, overall_accuracy = $4, metrics = $5
     WHERE id = $6`,
    [metrics.totalTests, metrics.passed, metrics.failed, metrics.overallAccuracy, JSON.stringify(metrics), runId]
  );

  return { runId, results, metrics };
}

export async function getTestRuns(limit = 10): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM accuracy_test_runs ORDER BY started_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

export async function getTestRunDetails(runId: number): Promise<any> {
  const runResult = await pool.query(
    'SELECT * FROM accuracy_test_runs WHERE id = $1',
    [runId]
  );
  
  if (runResult.rows.length === 0) return null;

  const resultsResult = await pool.query(
    'SELECT * FROM accuracy_test_results WHERE run_id = $1',
    [runId]
  );

  return { run: runResult.rows[0], results: resultsResult.rows };
}

export async function getDashboardMetrics(): Promise<any> {
  const runsResult = await pool.query(
    `SELECT * FROM accuracy_test_runs 
     WHERE status = 'completed' 
     ORDER BY completed_at DESC 
     LIMIT 10`
  );
  const runs = runsResult.rows;

  const testCasesResult = await pool.query(
    'SELECT * FROM accuracy_test_cases WHERE is_active = true'
  );
  const testCases = testCasesResult.rows;

  const latestRun = runs[0];
  const contractTypesSet = new Set(testCases.map((tc: any) => tc.contract_type));
  const accuracyTrend = runs.map((r: any) => ({
    date: r.completed_at,
    accuracy: r.overall_accuracy,
    mode: r.extraction_mode
  })).reverse();

  return {
    totalTestCases: testCases.length,
    contractTypes: Array.from(contractTypesSet),
    latestRun: latestRun ? {
      id: latestRun.id,
      date: latestRun.completed_at,
      accuracy: latestRun.overall_accuracy,
      passed: latestRun.passed_tests,
      failed: latestRun.failed_tests,
      mode: latestRun.extraction_mode
    } : null,
    accuracyTrend,
    metrics: latestRun?.metrics || null
  };
}

export async function seedSampleTestCases(): Promise<void> {
  const existingResult = await pool.query('SELECT id FROM accuracy_test_cases LIMIT 1');
  if (existingResult.rows.length > 0) {
    console.log('Test cases already exist, skipping seed');
    return;
  }

  const sampleCases: TestCaseInput[] = [
    {
      name: 'Technology License - Basic Tier Structure',
      contractType: 'technology_license',
      description: 'Tests extraction of tiered fee structure from tech license',
      contractText: `
TECHNOLOGY LICENSE AGREEMENT

This Technology License Agreement ("Agreement") is entered into as of January 15, 2024 ("Effective Date"), by and between:

LICENSOR: TechCorp Industries, Inc., a Delaware corporation with principal offices at 500 Innovation Drive, San Jose, CA 95110 ("Licensor")

LICENSEE: Manufacturing Solutions Ltd., a company organized under the laws of the United Kingdom, with principal offices at 100 Industrial Way, Manchester, UK M1 1AA ("Licensee")

ARTICLE 1 - LICENSED TECHNOLOGY
Licensor hereby grants to Licensee a non-exclusive license to use the patented manufacturing process technology as described in Patent No. US 10,123,456.

ARTICLE 2 - TERRITORY
This license is valid for the following territories: United States, United Kingdom, Germany, and France.

ARTICLE 3 - CONTRACT FEES

3.1 Fee Rates:
The Licensee shall pay royalties based on Annual Net Sales according to the following schedule:

| Annual Net Sales Range | Fee Rate | Minimum Annual Royalty |
|------------------------|--------------|------------------------|
| $0 - $5,000,000        | 6.5%         | $125,000               |
| $5,000,001 - $15,000,000 | 5.8%       | $200,000               |
| $15,000,001 - $50,000,000 | 5.2%      | $350,000               |
| Over $50,000,000       | 4.8%         | $500,000               |

ARTICLE 4 - TERM
This Agreement shall be effective for a period of ten (10) years from the Effective Date.

ARTICLE 5 - PAYMENT TERMS
All fee payments shall be made quarterly, within 30 days following the end of each calendar quarter.
      `,
      groundTruth: [
        { fieldName: 'licensorName', expectedValue: 'TechCorp Industries, Inc.', fieldType: 'string', isRequired: true },
        { fieldName: 'licenseeName', expectedValue: 'Manufacturing Solutions Ltd.', fieldType: 'string', isRequired: true },
        { fieldName: 'effectiveDate', expectedValue: '2024-01-15', fieldType: 'date', isRequired: true },
        { fieldName: 'termYears', expectedValue: 10, fieldType: 'number', isRequired: true },
        { fieldName: 'paymentFrequency', expectedValue: 'quarterly', fieldType: 'string', isRequired: true },
      ]
    },
    {
      name: 'Manufacturing Rebate - Volume Threshold',
      contractType: 'rebate',
      description: 'Tests extraction of volume-based rebate thresholds',
      contractText: `
REBATE AGREEMENT

Between: ABC Manufacturing Corp ("Supplier")
And: Regional Distributors Inc ("Distributor")
Effective: March 1, 2024

REBATE STRUCTURE:

The Supplier agrees to provide rebates to the Distributor based on annual purchase volumes:

- Purchases up to $1,000,000: 2.0% rebate
- Purchases from $1,000,001 to $2,500,000: 3.5% rebate  
- Purchases from $2,500,001 to $5,000,000: 5.0% rebate
- Purchases over $5,000,000: 6.5% rebate

Rebates will be calculated and paid annually within 60 days of year end.
      `,
      groundTruth: [
        { fieldName: 'supplierName', expectedValue: 'ABC Manufacturing Corp', fieldType: 'string', isRequired: true },
        { fieldName: 'distributorName', expectedValue: 'Regional Distributors Inc', fieldType: 'string', isRequired: true },
        { fieldName: 'effectiveDate', expectedValue: '2024-03-01', fieldType: 'date', isRequired: true },
      ]
    },
    {
      name: 'Nursery Fee - Container Pricing',
      contractType: 'contract fee',
      description: 'Tests extraction of per-container fee rates',
      contractText: `
PLANT VARIETY ROYALTY AGREEMENT

Breeder: Green Genetics LLC
Grower: Valley Nurseries Inc
Variety: Rosa 'Sunset Glory' (Plant Patent PP12345)
Date: February 20, 2024

ROYALTY SCHEDULE:

Royalties are due per container sold:
- 1 gallon container: $0.35 per unit
- 2 gallon container: $0.55 per unit
- 3 gallon container: $0.75 per unit
- 5 gallon container: $1.10 per unit

Minimum annual fee: $15,000
Territory: United States and Canada
Term: 5 years with automatic renewal
      `,
      groundTruth: [
        { fieldName: 'breederName', expectedValue: 'Green Genetics LLC', fieldType: 'string', isRequired: true },
        { fieldName: 'growerName', expectedValue: 'Valley Nurseries Inc', fieldType: 'string', isRequired: true },
        { fieldName: 'varietyName', expectedValue: "Rosa 'Sunset Glory'", fieldType: 'string', isRequired: true },
        { fieldName: 'minimumAnnualFee', expectedValue: 15000, fieldType: 'number', isRequired: true },
        { fieldName: 'termYears', expectedValue: 5, fieldType: 'number', isRequired: true },
      ]
    }
  ];

  for (const testCase of sampleCases) {
    await createTestCase(testCase);
  }

  console.log(`Seeded ${sampleCases.length} sample accuracy test cases`);
}

/**
 * Seed the comprehensive Contract Intelligence Test Suite (20+ contracts)
 */
export async function seedComprehensiveTestSuite(): Promise<{ added: number; existing: number }> {
  let added = 0;
  let existing = 0;
  
  console.log(`🧪 Seeding comprehensive test suite (${CONTRACT_TEST_SUITE.length} contracts)...`);
  
  for (const testCase of CONTRACT_TEST_SUITE) {
    // Check if test case already exists
    const existingResult = await pool.query(
      'SELECT id FROM accuracy_test_cases WHERE name = $1',
      [testCase.name]
    );
    
    if (existingResult.rows.length > 0) {
      existing++;
      continue;
    }
    
    await createTestCase(testCase);
    added++;
  }
  
  console.log(`✅ Test suite seeding complete: ${added} new, ${existing} existing`);
  return { added, existing };
}

/**
 * Run ensemble validation on a test case
 */
export async function runEnsembleTest(
  testCaseId: number,
  numPasses: number = 3
): Promise<{
  testResult: TestResult;
  ensembleResult: EnsembleResult;
  layoutAnalysis: {
    totalChunks: number;
    paymentChunks: number;
    tablesDetected: number;
    sectionsDetected: number;
  };
}> {
  // Get test case
  const testCaseResult = await pool.query(
    'SELECT * FROM accuracy_test_cases WHERE id = $1',
    [testCaseId]
  );
  
  if (testCaseResult.rows.length === 0) {
    throw new Error(`Test case ${testCaseId} not found`);
  }
  
  const testCase = testCaseResult.rows[0];
  const tempContractId = `ensemble_test_${testCaseId}_${Date.now()}`;
  
  // Run layout-aware chunking
  const layoutChunks = layoutAwareChunkingService.createLayoutAwareChunks(testCase.contract_text);
  const paymentChunks = layoutAwareChunkingService.getPaymentRelevantChunks(layoutChunks);
  const sections = layoutAwareChunkingService.parseDocumentLayout(testCase.contract_text);
  const tablesDetected = sections.filter(s => s.type === 'table').length;
  
  // Run ensemble extraction
  const ensembleResult = await ensembleValidationService.runEnsembleExtraction(
    tempContractId,
    testCase.contract_text,
    testCase.contract_type,
    numPasses
  );
  
  // Evaluate against ground truth using consensus rules
  const groundTruth = testCase.ground_truth as GroundTruthField[];
  const extracted = {
    rules: ensembleResult.consensusRules,
    ...ensembleResult.consensusMetadata
  };
  
  const fieldResults: FieldComparisonResult[] = [];
  let matchedFields = 0;
  
  for (const field of groundTruth) {
    const extractedValue = getNestedValue(extracted, field.fieldName);
    const comparison = compareValues(field.expectedValue, extractedValue, field.fieldType, field.tolerance);
    
    fieldResults.push({
      fieldName: field.fieldName,
      expected: field.expectedValue,
      extracted: extractedValue,
      match: comparison.match,
      matchType: comparison.matchType as any,
      confidence: comparison.confidence
    });
    
    if (comparison.match) matchedFields++;
  }
  
  const overallAccuracy = groundTruth.length > 0 ? matchedFields / groundTruth.length : 0;
  const passed = overallAccuracy >= 0.8;
  
  const testResult: TestResult = {
    testCaseId,
    testCaseName: testCase.name,
    contractType: testCase.contract_type,
    overallAccuracy,
    fieldResults,
    extractionTimeMs: ensembleResult.processingTimeMs,
    extractedData: extracted,
    passed
  };
  
  return {
    testResult,
    ensembleResult,
    layoutAnalysis: {
      totalChunks: layoutChunks.length,
      paymentChunks: paymentChunks.length,
      tablesDetected,
      sectionsDetected: sections.length
    }
  };
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Run all tests with ensemble validation
 */
export async function runAllEnsembleTests(): Promise<{
  totalTests: number;
  passed: number;
  failed: number;
  averageAccuracy: number;
  averageAgreementScore: number;
  testsNeedingReview: number;
  results: Array<{ testCaseId: number; name: string; accuracy: number; agreementScore: number; needsReview: boolean }>;
}> {
  const testCases = await pool.query('SELECT id, name FROM accuracy_test_cases ORDER BY id');
  
  const results: Array<{ testCaseId: number; name: string; accuracy: number; agreementScore: number; needsReview: boolean }> = [];
  let passed = 0;
  let totalAccuracy = 0;
  let totalAgreement = 0;
  let needsReviewCount = 0;
  
  console.log(`🧪 Running ${testCases.rows.length} ensemble tests...`);
  
  for (const tc of testCases.rows) {
    try {
      const result = await runEnsembleTest(tc.id, 2); // Quick 2-pass for batch testing
      
      results.push({
        testCaseId: tc.id,
        name: tc.name,
        accuracy: result.testResult.overallAccuracy,
        agreementScore: result.ensembleResult.agreementScore,
        needsReview: result.ensembleResult.needsHumanReview
      });
      
      if (result.testResult.passed) passed++;
      totalAccuracy += result.testResult.overallAccuracy;
      totalAgreement += result.ensembleResult.agreementScore;
      if (result.ensembleResult.needsHumanReview) needsReviewCount++;
      
      console.log(`   ✓ ${tc.name}: ${(result.testResult.overallAccuracy * 100).toFixed(1)}% accuracy`);
    } catch (error) {
      console.error(`   ✗ ${tc.name}: Error - ${error}`);
      results.push({
        testCaseId: tc.id,
        name: tc.name,
        accuracy: 0,
        agreementScore: 0,
        needsReview: true
      });
    }
  }
  
  const totalTests = testCases.rows.length;
  
  return {
    totalTests,
    passed,
    failed: totalTests - passed,
    averageAccuracy: totalTests > 0 ? totalAccuracy / totalTests : 0,
    averageAgreementScore: totalTests > 0 ? totalAgreement / totalTests : 0,
    testsNeedingReview: needsReviewCount,
    results
  };
}

/**
 * Get test suite statistics
 */
export async function getTestSuiteStats(): Promise<{
  totalTestCases: number;
  byContractType: Record<string, number>;
  totalGroundTruthFields: number;
  lastRunDate: string | null;
  lastPassRate: number | null;
}> {
  const countResult = await pool.query('SELECT COUNT(*) as count FROM accuracy_test_cases');
  const byTypeResult = await pool.query(`
    SELECT contract_type, COUNT(*) as count 
    FROM accuracy_test_cases 
    GROUP BY contract_type
  `);
  
  const fieldsResult = await pool.query(`
    SELECT SUM(jsonb_array_length(ground_truth)) as total_fields
    FROM accuracy_test_cases
  `);
  
  const lastRunResult = await pool.query(`
    SELECT started_at, 
           (SELECT COUNT(*) FROM accuracy_test_results WHERE run_id = r.id AND passed = true)::float / 
           NULLIF((SELECT COUNT(*) FROM accuracy_test_results WHERE run_id = r.id), 0) as pass_rate
    FROM accuracy_test_runs r
    ORDER BY started_at DESC
    LIMIT 1
  `);
  
  const byContractType: Record<string, number> = {};
  for (const row of byTypeResult.rows) {
    byContractType[row.contract_type] = parseInt(row.count);
  }
  
  return {
    totalTestCases: parseInt(countResult.rows[0]?.count || '0'),
    byContractType,
    totalGroundTruthFields: parseInt(fieldsResult.rows[0]?.total_fields || '0'),
    lastRunDate: lastRunResult.rows[0]?.started_at?.toISOString() || null,
    lastPassRate: lastRunResult.rows[0]?.pass_rate || null
  };
}
