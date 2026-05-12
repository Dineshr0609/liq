import { GroqService } from './groqService';
import { mapTermsToLicenseIQFields } from './erpVocabularyService';
import { storage } from '../storage';

/**
 * Zero-Shot Extraction Service
 * 
 * Uses LLMs to extract entities and relationships from contracts WITHOUT predefined schemas.
 * The AI determines what's important and structures the data dynamically.
 * 
 * Enhanced with ERP-aware extraction that maps contract terms to ERP fields.
 */

// Create a reusable Groq instance
const groqService = new GroqService();

// Helper function to call Groq with simple interface
async function callGroq(prompt: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const messages = [
    { role: 'system' as const, content: 'You are an expert contract analysis AI. Always respond with valid JSON.' },
    { role: 'user' as const, content: prompt }
  ];
  
  const response = await (groqService as any).makeRequest(messages, options.temperature || 0.1, options.maxTokens || 2000);
  return response;
}

export interface ExtractedEntity {
  type: string; // e.g., 'party', 'product', 'territory', 'payment_term', 'royalty_clause'
  label: string; // Human-readable name
  properties: Record<string, any>; // Flexible JSON properties
  confidence: number; // 0-1
  sourceText: string; // Original text this was extracted from
}

export interface ExtractedRelationship {
  sourceLabel: string;
  targetLabel: string;
  relationshipType: string; // e.g., 'applies_to', 'references', 'requires', 'modifies'
  properties?: Record<string, any>;
  confidence: number;
}

export interface ZeroShotExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  confidence: number; // Overall extraction confidence
  metadata: {
    contractType: string; // Detected type: 'licensing', 'saas', 'real_estate', etc.
    keyTerms: string[];
    extractionTime: number;
  };
}

/**
 * Extract entities and relationships from contract using zero-shot prompting
 */
function recoverTruncatedJson(text: string): any | null {
  try {
    let jsonText = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*)/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].replace(/```\s*$/, '');
    }
    
    const firstBrace = jsonText.indexOf('{');
    if (firstBrace === -1) return null;
    jsonText = jsonText.substring(firstBrace);
    
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;
    let lastValidPos = 0;
    
    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
      if (openBraces >= 0 && openBrackets >= 0) lastValidPos = i;
    }
    
    let truncated = jsonText.substring(0, lastValidPos + 1);
    
    if (inString) truncated += '"';
    
    const trailingComma = truncated.replace(/,\s*$/, '');
    let repaired = trailingComma;
    
    for (let i = 0; i < openBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces; i++) repaired += '}';
    
    const parsed = JSON.parse(repaired);
    if (parsed && (parsed.entities || parsed.contractType)) {
      console.log(`[ZeroShotExtraction] JSON recovery: found ${(parsed.entities || []).length} entities`);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function splitCompoundEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const result: ExtractedEntity[] = [];
  const seenLabels = new Set<string>();

  for (const entity of entities) {
    const label = entity.label?.trim() || '';

    if (label.length > 80 || (label.includes('.') && /[A-Z][a-z]+\s*\*/.test(label))) {
      const kvPairs = label.match(/([A-Za-z][A-Za-z\s\/]*)\*\s*([^.*]+)/g);
      if (kvPairs && kvPairs.length >= 2) {
        for (const pair of kvPairs) {
          const match = pair.match(/([A-Za-z][A-Za-z\s\/]*)\*\s*(.+)/);
          if (match) {
            const kvLabel = match[1].trim();
            const kvValue = match[2].trim().replace(/\.\s*$/, '');
            const key = `${kvLabel}:${kvValue}`.toLowerCase();
            if (!seenLabels.has(key)) {
              seenLabels.add(key);
              result.push({
                ...entity,
                label: kvValue,
                properties: { ...entity.properties, originalField: kvLabel },
                sourceText: `Split from: ${label.substring(0, 50)}`,
              });
            }
          }
        }
        continue;
      }
    }

    if ((entity.type === 'product' || entity.type === 'territory' || entity.type === 'party') && 
        /\band\b/i.test(label) && label.length < 80 && !/\b(terms|conditions|agreement)\b/i.test(label)) {
      const cleanLabel = label.replace(/\s*(rebate|rate|fee|pricing|discount|tier|schedule)\s*/gi, '').trim();
      const parts = cleanLabel.split(/\s+and\s+/i).map(p => p.trim()).filter(p => p.length >= 2);
      if (parts.length >= 2 && parts.every(p => p.length <= 40)) {
        for (const part of parts) {
          const key = `${entity.type}:${part}`.toLowerCase();
          if (!seenLabels.has(key)) {
            seenLabels.add(key);
            result.push({
              ...entity,
              label: part,
              sourceText: entity.sourceText || `Split from: ${label}`,
            });
          }
        }
        const origKey = `${entity.type}:${label}`.toLowerCase();
        if (!seenLabels.has(origKey)) {
          seenLabels.add(origKey);
          result.push(entity);
        }
        continue;
      }
    }

    const descriptionPattern = /^\$[\d.,]+\s+(per|for|on)\s+/i;
    if (descriptionPattern.test(label)) {
      console.log(`[ZeroShotExtraction] Skipping description-as-label: "${label.substring(0, 60)}"`);
      continue;
    }

    const key = `${entity.type}:${label}`.toLowerCase();
    if (!seenLabels.has(key)) {
      seenLabels.add(key);
      result.push(entity);
    }
  }

  return result;
}

export async function extractContractEntitiesZeroShot(
  contractText: string,
  contractId: string
): Promise<ZeroShotExtractionResult> {
  const startTime = Date.now();

  const prompt = `Analyze the following contract and extract ALL important entities and relationships as JSON.

INSTRUCTIONS:
1. Extract ALL key entities in these categories:
   - "party": ALL parties/vendors/distributors/licensors/licensees with their full names, roles, addresses
   - "product": ALL products, product lines, categories, SKUs mentioned — extract each product as its OWN entity
   - "financial_term": ALL rates, fees, royalties, rebates, discounts, volume tiers, tier thresholds, minimum guarantees
   - "territory": ALL territories, regions, countries, geographic scopes
   - "payment_term": ALL payment schedules, frequencies, methods, deadlines
   - "date": ALL effective dates, expiration dates, renewal dates, deadlines
   - "volume_tier": Each volume/pricing tier as a SEPARATE entity with min, max, rate, and basis
   - "clause": Important contractual clauses (auto-renewal, termination, exclusivity)
2. CRITICAL RULES for entity extraction:
   a. The "label" field must be the CLEAN entity name only — NEVER a sentence or description.
      WRONG: {"type": "product", "label": "Potatoes and Onions Rebate", "properties": {"value": "$0.25 per 50lb equivalent on potatoes and onions"}}
      RIGHT: {"type": "product", "label": "Potatoes"} AND {"type": "product", "label": "Onions"} (two separate entities)
   b. If a rule or clause mentions multiple products (e.g. "rebate on potatoes and onions"), extract EACH product as its own entity.
   c. If you see a metadata section like "Vendor Number* 24003. Division* All. Buyer Number* CT CRAIG TORRENS", extract EACH field as its own entity:
      * {"type": "party", "label": "24003", "properties": {"role": "vendor", "vendorNumber": "24003"}}
      * {"type": "party", "label": "CT CRAIG TORRENS", "properties": {"role": "buyer"}}
   d. NEVER bundle multiple label-value pairs into one entity. Section headers (e.g. "Agreement Metadata") are NOT entities.
   e. The "label" is always the entity NAME (a product name, a company name, a territory name) — never a rate description, rule description, or sentence.
3. Keep "sourceText" SHORT (max 50 chars) - just enough to identify the source
4. Keep "properties" concise - only include the most important 2-4 properties per entity
5. Focus on entities useful for ERP field mapping (parties, products, amounts, dates, statuses)
6. Extract up to 40 entities - include ALL parties, ALL products, ALL tiers, and key financial terms
7. Keep relationships minimal - only the 3-5 most important ones
8. For vendor/party entities, include properties: name, role, type, address (if available)
9. For volume tier entities, include properties: tierNumber, minVolume, maxVolume, rate, basis

CONTRACT TEXT:
${contractText.substring(0, 15000)} ${contractText.length > 15000 ? '...[truncated]' : ''}

Respond ONLY with valid JSON:
{
  "contractType": "detected type",
  "entities": [
    {"type": "party|product|financial_term|territory|payment_term|date|volume_tier|clause", "label": "name", "properties": {"key": "value"}, "confidence": 0.95, "sourceText": "short source ref"}
  ],
  "relationships": [
    {"sourceLabel": "label", "targetLabel": "label", "relationshipType": "type", "properties": {}, "confidence": 0.9}
  ],
  "keyTerms": ["term1", "term2"],
  "overallConfidence": 0.85
}`;

  try {
    const response = await callGroq(prompt, {
      temperature: 0.1,
      maxTokens: 8000,
    });

    let result: any;
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : response;
      result = JSON.parse(jsonText);
    } catch (parseError) {
      const recovered = recoverTruncatedJson(response);
      if (recovered) {
        console.log('[ZeroShotExtraction] Recovered truncated JSON response');
        result = recovered;
      } else {
        console.error('[ZeroShotExtraction] Failed to parse JSON response:', response.substring(0, 500));
        throw new Error('Failed to parse extraction results as JSON');
      }
    }

    const rawEntities: ExtractedEntity[] = (result.entities || []).map((e: any) => ({
      type: e.type || 'unknown',
      label: e.label || 'Unnamed Entity',
      properties: e.properties || {},
      confidence: parseFloat(e.confidence) || 0.5,
      sourceText: e.sourceText || '',
    }));

    const entities = splitCompoundEntities(rawEntities);

    const relationships: ExtractedRelationship[] = (result.relationships || []).map((r: any) => ({
      sourceLabel: r.sourceLabel,
      targetLabel: r.targetLabel,
      relationshipType: r.relationshipType || 'relates_to',
      properties: r.properties || {},
      confidence: parseFloat(r.confidence) || 0.5,
    }));

    const extractionTime = Date.now() - startTime;

    console.log(`[ZeroShotExtraction] Extracted ${rawEntities.length} raw entities, expanded to ${entities.length} after splitting`);
    console.log(`[ZeroShotExtraction] Detected contract type: ${result.contractType}`);

    return {
      entities,
      relationships,
      confidence: parseFloat(result.overallConfidence) || 0.7,
      metadata: {
        contractType: result.contractType || 'unknown',
        keyTerms: result.keyTerms || [],
        extractionTime,
      },
    };

  } catch (error) {
    console.error('[ZeroShotExtraction] Extraction failed:', error);
    throw error;
  }
}

/**
 * Validate extraction with a second LLM call (cross-validation)
 */
export async function validateExtraction(
  extraction: ZeroShotExtractionResult,
  extractedRules: any[],
  originalText: string
): Promise<{ confidence: number; issues: string[]; recommendations: string[] }> {
  const validationPrompt = `You are a contract validation expert. Review this AI-extracted data and verify its accuracy.

ORIGINAL CONTRACT (excerpt):
${originalText.substring(0, 5000)}

EXTRACTED ENTITIES:
${JSON.stringify(extraction.entities.slice(0, 10), null, 2)}

EXTRACTED RELATIONSHIPS:
${JSON.stringify(extraction.relationships.slice(0, 10), null, 2)}

EXTRACTED RULES:
${JSON.stringify(extractedRules.slice(0, 5), null, 2)}

Validate:
1. Are the entities accurate and complete?
2. Are the relationships correct?
3. Are the rules properly structured?
4. What's missing or incorrect?

Respond with JSON:
{
  "overallConfidence": 0.85,
  "issues": ["list of problems found"],
  "recommendations": ["suggested improvements"],
  "validationNotes": "brief summary"
}`;

  try {
    const response = await callGroq(validationPrompt, {
      temperature: 0.1,
      maxTokens: 1500,
    });

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.match(/```\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : response;
    const result = JSON.parse(jsonText);

    return {
      confidence: parseFloat(result.overallConfidence) || 0.7,
      issues: result.issues || [],
      recommendations: result.recommendations || [],
    };

  } catch (error) {
    console.error('[ZeroShotExtraction] Validation failed:', error);
    // Return moderate confidence if validation fails
    return {
      confidence: 0.65,
      issues: ['Validation check failed'],
      recommendations: ['Manual review recommended'],
    };
  }
}

/**
 * Extract specific entity type on-demand (for focused extraction)
 */
export async function extractSpecificEntityType(
  contractText: string,
  entityType: string,
  context?: string
): Promise<ExtractedEntity[]> {
  const prompt = `Extract all "${entityType}" entities from this contract.

${context ? `Context: ${context}\n\n` : ''}

CONTRACT:
${contractText.substring(0, 8000)}

Respond with JSON array:
[
  {
    "type": "${entityType}",
    "label": "name",
    "properties": {},
    "confidence": 0.9,
    "sourceText": "excerpt"
  }
]`;

  try {
    const response = await callGroq(prompt, { temperature: 0.1, maxTokens: 2000 });
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.match(/```\s*([\s\S]*?)\s*```/) ||
                     response.match(/\[[\s\S]*\]/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error(`[ZeroShotExtraction] Failed to extract ${entityType}:`, error);
    return [];
  }
}

/**
 * ERP-Aware Extraction Result
 * Extends the base extraction with ERP mapping information
 */
export interface ErpAwareExtractionResult extends ZeroShotExtractionResult {
  erpMappings: {
    mappingCount: number;
    pendingCount: number;
    autoConfirmedCount: number;
  };
}

/**
 * Perform extraction with ERP field mapping
 * 
 * This enhanced extraction:
 * 1. Performs standard zero-shot entity extraction
 * 2. Maps extracted terms to ERP fields using AI
 * 3. Stores mappings in pending_term_mappings table for user confirmation
 * 4. Auto-confirms high-confidence mappings based on threshold
 */
export async function extractWithErpMapping(
  contractText: string,
  contractId: string,
  erpSystemId: string,
  extractionRunId?: string,
  options?: {
    confidenceThreshold?: number;
    requireConfirmation?: boolean;
    autoConfirmHighConfidence?: boolean;
  }
): Promise<ErpAwareExtractionResult> {
  const {
    confidenceThreshold = 0.70,
    requireConfirmation = true,
    autoConfirmHighConfidence = true
  } = options || {};

  console.log(`[ErpAwareExtraction] Starting extraction for contract ${contractId} with ERP ${erpSystemId}`);
  
  // Step 1: Perform standard zero-shot extraction
  const baseExtraction = await extractContractEntitiesZeroShot(contractText, contractId);
  
  // Step 2: Convert extracted entities to terms for mapping
  const termsToMap = baseExtraction.entities.map(entity => ({
    term: entity.label,
    value: entity.properties?.value || entity.properties?.name || null,
    sourceText: entity.sourceText
  }));
  
  console.log(`[ErpAwareExtraction] Mapping ${termsToMap.length} extracted terms to LicenseIQ fields`);
  
  // Step 4: Check company library for existing confirmed mappings
  // Get companyId from contract
  const contract = await storage.getContract(contractId);
  const companyId = contract?.companyId;
  let existingMappingsMap = new Map<string, any>();
  
  if (companyId) {
    const existingMappings = await storage.getConfirmedCompanyMappings(companyId);
    // Build a lookup map: originalTerm (lowercase) -> confirmed mapping
    for (const mapping of existingMappings) {
      const key = mapping.originalTerm?.toLowerCase()?.trim();
      if (key) {
        existingMappingsMap.set(key, mapping);
      }
    }
    console.log(`[ErpAwareExtraction] Found ${existingMappingsMap.size} confirmed mappings in company library`);
  }
  
  // Step 5: Use AI to map terms to LicenseIQ fields (Vendors, Items, Locations, etc.)
  const erpMappings = await mapTermsToLicenseIQFields(termsToMap);
  
  console.log(`[ErpAwareExtraction] AI mapped ${erpMappings.length} terms to LicenseIQ fields`);
  
  // Step 6: Store mappings in pending_term_mappings table
  let pendingCount = 0;
  let autoConfirmedCount = 0;
  let autoAppliedCount = 0;
  
  for (const mapping of erpMappings) {
    if (mapping.confidence < 0.1) {
      // Skip very low confidence mappings
      continue;
    }
    
    // Check if this term already has a confirmed mapping in the company library
    const termKey = mapping.contractTerm?.toLowerCase()?.trim();
    const existingConfirmed = termKey ? existingMappingsMap.get(termKey) : null;
    
    if (existingConfirmed) {
      // Auto-apply the confirmed mapping from company library
      try {
        await storage.createPendingTermMapping({
          contractId,
          companyId: companyId || null,
          extractionRunId: extractionRunId || null,
          originalTerm: mapping.contractTerm,
          originalValue: mapping.contractValue,
          sourceText: mapping.sourceText,
          erpSystemId: existingConfirmed.erpSystemId,
          erpEntityId: existingConfirmed.erpEntityId,
          erpFieldId: existingConfirmed.erpFieldId,
          erpFieldName: existingConfirmed.erpFieldName,
          erpEntityName: existingConfirmed.erpEntityName,
          erpRecordId: existingConfirmed.erpRecordId,
          erpRecordValue: existingConfirmed.erpRecordValue,
          erpRecordTable: existingConfirmed.erpRecordTable,
          confidence: 1.0, // Full confidence for library mappings
          mappingMethod: 'company_library',
          alternativeMappings: null,
          status: 'confirmed', // Auto-confirmed from company library
          confirmedBy: existingConfirmed.confirmedBy,
          confirmedAt: new Date(),
        });
        autoAppliedCount++;
        console.log(`[ErpAwareExtraction] Auto-applied from library: ${mapping.contractTerm} → ${existingConfirmed.erpFieldName}`);
      } catch (error) {
        console.error(`[ErpAwareExtraction] Failed to auto-apply mapping for ${mapping.contractTerm}:`, error);
      }
      continue;
    }
    
    const shouldAutoConfirm = 
      !requireConfirmation || 
      (autoConfirmHighConfidence && mapping.confidence >= confidenceThreshold);
    
    try {
      const autoLinkedValue = mapping.matchedMasterDataValue || mapping.contractValue || null;
      const pendingMapping = await storage.createPendingTermMapping({
        contractId,
        companyId: companyId || null,
        extractionRunId: extractionRunId || null,
        originalTerm: mapping.contractTerm,
        originalValue: mapping.contractValue,
        sourceText: mapping.sourceText,
        erpSystemId: null,
        erpEntityId: null,
        erpFieldId: null,
        erpFieldName: mapping.licenseiqFieldName,
        erpEntityName: mapping.licenseiqEntityName,
        erpRecordId: mapping.matchedMasterDataId || null,
        erpRecordValue: autoLinkedValue,
        erpRecordTable: mapping.licenseiqEntityName?.toLowerCase() || null,
        confidence: mapping.confidence,
        mappingMethod: mapping.mappingMethod,
        alternativeMappings: mapping.alternatives as any,
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null,
      });
      
      pendingCount++;
      if (autoLinkedValue) {
        console.log(`[ErpAwareExtraction] Suggested: ${mapping.contractTerm} → ${mapping.licenseiqFieldName} (${Math.round(mapping.confidence * 100)}% confidence, auto-linked: ${autoLinkedValue})`);
      } else {
        console.log(`[ErpAwareExtraction] Suggested: ${mapping.contractTerm} → ${mapping.licenseiqFieldName} (${Math.round(mapping.confidence * 100)}% confidence)`);
      }
    } catch (error) {
      console.error(`[ErpAwareExtraction] Failed to save mapping for ${mapping.contractTerm}:`, error);
    }
  }
  
  console.log(`[ErpAwareExtraction] Saved ${erpMappings.length} mappings (${autoAppliedCount} from library, ${autoConfirmedCount} auto-confirmed, ${pendingCount} pending)`);
  
  try {
    const { autoLinkAllMappings } = await import('./valueLinkingService');
    const linkResult = await autoLinkAllMappings(contractId);
    console.log(`[ErpAwareExtraction] Auto-linked ${linkResult.linked}/${linkResult.total} mappings to master data`);
  } catch (linkErr) {
    console.warn(`[ErpAwareExtraction] Auto-link step failed (non-fatal):`, linkErr);
  }

  return {
    ...baseExtraction,
    erpMappings: {
      mappingCount: erpMappings.length,
      pendingCount,
      autoConfirmedCount,
      autoAppliedFromLibrary: autoAppliedCount
    }
  };
}

/**
 * Get pending mappings summary for a contract
 */
export async function getPendingMappingsSummary(contractId: string): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
  modified: number;
}> {
  const allMappings = await storage.getPendingTermMappingsByContract(contractId);
  
  return {
    total: allMappings.length,
    pending: allMappings.filter(m => m.status === 'pending').length,
    confirmed: allMappings.filter(m => m.status === 'confirmed').length,
    rejected: allMappings.filter(m => m.status === 'rejected').length,
    modified: allMappings.filter(m => m.status === 'modified').length,
  };
}

/**
 * Extract terms from table data and add them to pending mappings
 * 
 * This function processes tableData from extracted rules and creates
 * mapping suggestions for:
 * 1. Column headers (e.g., "Variety Name" → Items.ItemName)
 * 2. Key cell values (product names, territory names, etc.)
 */
export async function extractTableDataTerms(
  contractId: string,
  tableData: { headers: string[]; rows: any[][] } | any,
  ruleName: string,
  extractionRunId?: string,
  companyId?: string | null
): Promise<{ termsAdded: number; errors: string[] }> {
  const errors: string[] = [];
  let termsAdded = 0;
  
  if (!tableData) {
    return { termsAdded: 0, errors: ['No table data provided'] };
  }
  
  console.log(`[TableTermExtraction] Processing table data for rule: ${ruleName}`);
  console.log(`[TableTermExtraction] TableData type: ${typeof tableData}, keys: ${tableData ? Object.keys(tableData).join(', ') : 'null'}`);
  
  // Normalize tableData structure - handle multiple formats
  let headers: string[] = [];
  let rowObjects: Record<string, any>[] = [];
  
  // Format 1: { columns: [...], rows: [{...}, ...] } - most common from AI extraction
  if (Array.isArray(tableData.columns)) {
    headers = tableData.columns;
    rowObjects = tableData.rows || [];
    console.log(`[TableTermExtraction] Format: columns/rows`);
  }
  // Format 2: { headers: [...], rows: [[...], ...] } - array format
  else if (Array.isArray(tableData.headers)) {
    headers = tableData.headers;
    // Convert array rows to object rows
    const rawRows = tableData.rows || [];
    rowObjects = rawRows.map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    console.log(`[TableTermExtraction] Format: headers/rows`);
  }
  // Format 3: Direct array of objects - infer columns from first row
  else if (Array.isArray(tableData) && tableData.length > 0 && typeof tableData[0] === 'object') {
    headers = Object.keys(tableData[0]);
    rowObjects = tableData;
    console.log(`[TableTermExtraction] Format: array of objects`);
  }
  // Format 4: Object with keys as column headers
  else if (typeof tableData === 'object' && !Array.isArray(tableData)) {
    // Try to extract keys that might be columns
    const keys = Object.keys(tableData).filter(k => !['type', 'metadata', 'source'].includes(k));
    if (keys.length > 0 && Array.isArray(tableData[keys[0]])) {
      // Transpose: each key is a column, value is array of values
      headers = keys;
      const maxLen = Math.max(...keys.map(k => (tableData[k] as any[]).length));
      rowObjects = Array(maxLen).fill(null).map((_, i) => {
        const obj: Record<string, any> = {};
        keys.forEach(k => obj[k] = tableData[k]?.[i]);
        return obj;
      });
      console.log(`[TableTermExtraction] Format: object with array values`);
    }
  }
  
  if (headers.length === 0) {
    console.log(`[TableTermExtraction] No headers found in table data: ${JSON.stringify(tableData).substring(0, 200)}`);
    return { termsAdded: 0, errors: ['No headers found in table data'] };
  }
  
  console.log(`[TableTermExtraction] Found ${headers.length} columns: ${headers.join(', ')}`);
  
  // Get existing mappings to avoid duplicates
  const existingMappings = await storage.getPendingTermMappingsByContract(contractId);
  const existingTerms = new Set(existingMappings.map(m => m.originalTerm?.toLowerCase()));
  
  // Build terms list from headers and cell values
  const termsToMap: Array<{ term: string; value: string | null; sourceText: string }> = [];
  
  // 1. Add column headers as terms (for field mapping)
  for (const header of headers) {
    const normalizedHeader = header.trim();
    if (normalizedHeader && !existingTerms.has(normalizedHeader.toLowerCase())) {
      termsToMap.push({
        term: normalizedHeader,
        value: null,
        sourceText: `Column header from table "${ruleName}"`
      });
      existingTerms.add(normalizedHeader.toLowerCase());
    }
  }
  
  // 2. Extract unique cell values that look like entity names (products, territories, etc.)
  // Focus on text columns, skip numeric values
  // IMPORTANT: Preserve column context - each cell value is tagged with its column header
  // so "Product Name" and "Category" stay as separate terms, never concatenated
  const entityPatterns = /^[A-Z][a-zA-Z\s™®©\-']+$/; // Starts with capital, contains letters/spaces
  const seenValues = new Set<string>();
  
  for (const rowObj of rowObjects) {
    for (const header of headers) {
      const cellValue = rowObj[header];
      if (typeof cellValue === 'string' && cellValue.trim()) {
        const normalizedValue = cellValue.trim();
        
        // Skip if already seen, too short, or looks like a number/currency
        const dedupeKey = `${header}::${normalizedValue}`.toLowerCase();
        if (seenValues.has(dedupeKey)) continue;
        if (normalizedValue.length < 3) continue;
        if (/^\$?[\d,.]+%?$/.test(normalizedValue)) continue; // Skip numbers/currency
        if (existingTerms.has(normalizedValue.toLowerCase())) continue;
        
        // Include values that look like entity names (products, territories, companies)
        if (entityPatterns.test(normalizedValue) || normalizedValue.includes('®') || normalizedValue.includes('™')) {
          termsToMap.push({
            term: normalizedValue,
            value: normalizedValue,
            sourceText: `Value from column "${header}" in table "${ruleName}". IMPORTANT: This is ONLY the "${header}" column value - do NOT combine with other columns.`
          });
          seenValues.add(dedupeKey);
          existingTerms.add(normalizedValue.toLowerCase());
        }
      }
    }
  }
  
  console.log(`[TableTermExtraction] Prepared ${termsToMap.length} terms for mapping`);
  
  if (termsToMap.length === 0) {
    return { termsAdded: 0, errors: [] };
  }
  
  // Map terms to LicenseIQ fields
  const mappings = await mapTermsToLicenseIQFields(termsToMap);
  
  console.log(`[TableTermExtraction] AI mapped ${mappings.length} terms to LicenseIQ fields`);
  
  // Store mappings in pending_term_mappings
  for (const mapping of mappings) {
    if (mapping.confidence < 0.1) {
      continue; // Skip very low confidence
    }
    
    try {
      const tableAutoLinkedValue = mapping.matchedMasterDataValue || mapping.contractValue || null;
      await storage.createPendingTermMapping({
        contractId,
        companyId: companyId || null,
        extractionRunId: extractionRunId || null,
        originalTerm: mapping.contractTerm,
        originalValue: mapping.contractValue,
        sourceText: mapping.sourceText,
        erpSystemId: null,
        erpEntityId: null,
        erpFieldId: null,
        erpFieldName: mapping.licenseiqFieldName,
        erpEntityName: mapping.licenseiqEntityName,
        erpRecordId: mapping.matchedMasterDataId || null,
        erpRecordValue: tableAutoLinkedValue,
        erpRecordTable: mapping.licenseiqEntityName?.toLowerCase() || null,
        confidence: mapping.confidence,
        mappingMethod: `table_extraction:${mapping.mappingMethod}`,
        alternativeMappings: mapping.alternatives as any,
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null,
      });
      
      termsAdded++;
      console.log(`[TableTermExtraction] Added mapping: ${mapping.contractTerm} → ${mapping.licenseiqEntityName}.${mapping.licenseiqFieldName}`);
    } catch (error: any) {
      // Handle duplicate key errors gracefully
      if (error.code === '23505') {
        console.log(`[TableTermExtraction] Skipping duplicate: ${mapping.contractTerm}`);
      } else {
        errors.push(`Failed to save mapping for ${mapping.contractTerm}: ${error.message}`);
      }
    }
  }
  
  console.log(`[TableTermExtraction] Successfully added ${termsAdded} new mappings`);
  
  return { termsAdded, errors };
}

/**
 * Extract tier/category names from rule names and add to pending mappings
 * 
 * Universal approach that works for any contract type:
 * - Parses "Tier X - Category Name" patterns
 * - Extracts category names from parentheses (e.g., "Standard Rate (Electronics)")
 * - Identifies product category references in rule names
 */
export async function extractRuleCategoryTerms(
  contractId: string,
  rules: Array<{ ruleName: string; ruleType: string; description?: string }>,
  extractionRunId?: string,
  companyId?: string | null
): Promise<{ termsAdded: number; errors: string[] }> {
  const errors: string[] = [];
  let termsAdded = 0;
  
  if (!rules || rules.length === 0) {
    return { termsAdded: 0, errors: ['No rules provided'] };
  }
  
  console.log(`[CategoryTermExtraction] Processing ${rules.length} rules for category names`);
  
  // Get existing mappings to avoid duplicates
  const existingMappings = await storage.getPendingTermMappingsByContract(contractId);
  const existingTerms = new Set(existingMappings.map(m => m.originalTerm?.toLowerCase()));
  
  const termsToMap: Array<{ term: string; value: string | null; sourceText: string }> = [];
  const seenTerms = new Set<string>();
  
  // Patterns to extract category names - universal across contract types
  const patterns = [
    // "Tier 1 - Ornamental Trees & Shrubs" → "Ornamental Trees & Shrubs"
    /Tier\s*\d+\s*[-–—:]\s*(.+?)(?:\s+Royalty|\s+Rate|\s+Pricing|$)/i,
    // "Category: Electronics" → "Electronics"
    /Category[:\s]+(.+?)(?:\s+Royalty|\s+Rate|\s+Pricing|$)/i,
    // "Product Line - Industrial Equipment" → "Industrial Equipment"
    /Product\s*(?:Line|Category|Type)[:\s-]+(.+?)(?:\s+Royalty|\s+Rate|$)/i,
    // "Standard Rate (Automotive)" → "Automotive"
    /\(([A-Z][a-zA-Z\s&,]+)\)/,
    // "Territory: North America" → "North America"
    /Territory[:\s]+(.+?)(?:\s+Royalty|\s+Rate|$)/i,
    // "Region - EMEA" → "EMEA"
    /Region[:\s-]+(.+?)(?:\s+Royalty|\s+Rate|$)/i,
  ];
  
  for (const rule of rules) {
    const ruleName = rule.ruleName || '';
    
    for (const pattern of patterns) {
      const match = ruleName.match(pattern);
      if (match && match[1]) {
        const categoryName = match[1].trim();
        
        // Skip if too short, already seen, or already exists
        if (categoryName.length < 3) continue;
        if (seenTerms.has(categoryName.toLowerCase())) continue;
        if (existingTerms.has(categoryName.toLowerCase())) continue;
        
        // Skip generic terms
        const genericTerms = ['rates', 'pricing', 'terms', 'standard', 'default', 'general'];
        if (genericTerms.includes(categoryName.toLowerCase())) continue;
        
        termsToMap.push({
          term: categoryName,
          value: categoryName,
          sourceText: `Category/tier name from rule "${ruleName}"`
        });
        seenTerms.add(categoryName.toLowerCase());
        
        console.log(`[CategoryTermExtraction] Found category: "${categoryName}" from rule: "${ruleName}"`);
      }
    }
  }
  
  console.log(`[CategoryTermExtraction] Prepared ${termsToMap.length} category terms for mapping`);
  
  if (termsToMap.length === 0) {
    return { termsAdded: 0, errors: [] };
  }
  
  // Map terms to LicenseIQ fields
  const mappings = await mapTermsToLicenseIQFields(termsToMap);
  
  console.log(`[CategoryTermExtraction] AI mapped ${mappings.length} terms to LicenseIQ fields`);
  
  // Store mappings in pending_term_mappings
  for (const mapping of mappings) {
    if (mapping.confidence < 0.1) {
      continue;
    }
    
    try {
      const catAutoLinkedValue = mapping.matchedMasterDataValue || mapping.contractValue || null;
      await storage.createPendingTermMapping({
        contractId,
        companyId: companyId || null,
        extractionRunId: extractionRunId || null,
        originalTerm: mapping.contractTerm,
        originalValue: mapping.contractValue,
        sourceText: mapping.sourceText,
        erpSystemId: null,
        erpEntityId: null,
        erpFieldId: null,
        erpFieldName: mapping.licenseiqFieldName,
        erpEntityName: mapping.licenseiqEntityName,
        erpRecordId: mapping.matchedMasterDataId || null,
        erpRecordValue: catAutoLinkedValue,
        erpRecordTable: mapping.licenseiqEntityName?.toLowerCase() || null,
        confidence: mapping.confidence,
        mappingMethod: `category_extraction:${mapping.mappingMethod}`,
        alternativeMappings: mapping.alternatives as any,
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null,
      });
      
      termsAdded++;
      console.log(`[CategoryTermExtraction] Added mapping: ${mapping.contractTerm} → ${mapping.licenseiqEntityName}.${mapping.licenseiqFieldName}`);
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`[CategoryTermExtraction] Skipping duplicate: ${mapping.contractTerm}`);
      } else {
        errors.push(`Failed to save mapping for ${mapping.contractTerm}: ${error.message}`);
      }
    }
  }
  
  console.log(`[CategoryTermExtraction] Successfully added ${termsAdded} new category mappings`);
  
  return { termsAdded, errors };
}
