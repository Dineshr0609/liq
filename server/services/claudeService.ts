/**
 * Claude AI Service for Contract Analysis
 * 
 * Uses Anthropic Claude models via Replit AI Integrations for:
 * - Contract analysis and summarization
 * - License rule extraction with FormulaDefinition JSON
 * - ERP field mapping suggestions
 * 
 * Supported models:
 * - claude-sonnet-4-5 (default, balanced)
 * - claude-opus-4-5 (most capable)
 * - claude-haiku-4-5 (fastest)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { FormulaDefinition, FormulaNode } from '@shared/formula-types';
import { db } from '../db';
import { contractTypeDefinitions, systemSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_EXTRACTION_PROMPTS } from '../prompts/defaultContractTypePrompts';

// Initialize Anthropic client with Replit AI Integrations
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || '',
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

interface ContractTypePrompts {
  extractionPrompt: string | null;
  ruleExtractionPrompt: string | null;
  erpMappingPrompt: string | null;
  sampleExtractionOutput: string | null;
  ragExtractionPrompt: string | null;
  ragRuleExtractionPrompt: string | null;
  ragSampleExtractionOutput: string | null;
}

interface ContractAnalysisResult {
  summary: string;
  keyTerms: Array<{
    type: string;
    description: string;
    confidence: number;
    location: string;
  }>;
  riskAnalysis: Array<{
    level: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
  }>;
  confidence: number;
}

interface ContractRule {
  ruleType: string;
  ruleName: string;
  description: string;
  conditions: Record<string, any>;
  calculation: Record<string, any>;
  priority: number;
  sourceSpan: {
    page?: number;
    section?: string;
    text: string;
  };
  confidence: number;
  formulaDefinition?: FormulaDefinition;
}

interface LicenseRuleExtractionResult {
  documentType: string;
  contractCategory: string;
  licenseType: string;
  parties: {
    licensor: string;
    licensee: string;
  };
  effectiveDate?: string;
  expirationDate?: string;
  rules: ContractRule[];
  currency: string;
  paymentTerms: string;
  reportingRequirements: Array<{
    frequency: string;
    dueDate: string;
    description: string;
  }>;
  extractionMetadata: {
    totalRulesFound: number;
    avgConfidence: number;
    processingTime: number;
    ruleComplexity: 'simple' | 'moderate' | 'complex';
    hasFixedPricing: boolean;
    hasVariablePricing: boolean;
    hasTieredPricing: boolean;
    hasRenewalTerms: boolean;
    hasTerminationClauses: boolean;
  };
}

export class ClaudeService {
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private cachedModel: string | null = null;
  private modelLastFetched: number = 0;
  private readonly MODEL_CACHE_DURATION = 60 * 1000;

  constructor(model: string = 'claude-sonnet-4-5', maxTokens: number = 16384, temperature: number = 0.1) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    
    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      console.warn('⚠️ AI_INTEGRATIONS_ANTHROPIC_API_KEY not set - Claude service may not work');
    }
  }

  private async getConfiguredModel(): Promise<string> {
    const now = Date.now();
    if (this.cachedModel && (now - this.modelLastFetched) < this.MODEL_CACHE_DURATION) {
      return this.cachedModel;
    }
    try {
      const [settings] = await db.select({
        aiProvider: systemSettings.aiProvider,
        aiModel: systemSettings.aiModel,
      }).from(systemSettings).limit(1);
      if (settings?.aiProvider === 'anthropic' && settings?.aiModel) {
        this.cachedModel = settings.aiModel;
      } else {
        this.cachedModel = this.model;
      }
      this.modelLastFetched = now;
      return this.cachedModel;
    } catch {
      return this.model;
    }
  }

  // Fetch contract type-specific prompts from database
  private async getContractTypePrompts(contractTypeCode?: string): Promise<ContractTypePrompts | null> {
    if (!contractTypeCode) return null;
    
    try {
      const [contractType] = await db.select({
        extractionPrompt: contractTypeDefinitions.extractionPrompt,
        ruleExtractionPrompt: contractTypeDefinitions.ruleExtractionPrompt,
        erpMappingPrompt: contractTypeDefinitions.erpMappingPrompt,
        sampleExtractionOutput: contractTypeDefinitions.sampleExtractionOutput,
        ragExtractionPrompt: contractTypeDefinitions.ragExtractionPrompt,
        ragRuleExtractionPrompt: contractTypeDefinitions.ragRuleExtractionPrompt,
        ragSampleExtractionOutput: contractTypeDefinitions.ragSampleExtractionOutput,
      })
      .from(contractTypeDefinitions)
      .where(eq(contractTypeDefinitions.code, contractTypeCode))
      .limit(1);
      
      const defaultPrompts = DEFAULT_EXTRACTION_PROMPTS[contractTypeCode];
      
      if (contractType) {
        const hasDbPrompts = contractType.extractionPrompt || contractType.ruleExtractionPrompt || 
                            contractType.erpMappingPrompt || contractType.sampleExtractionOutput ||
                            contractType.ragExtractionPrompt || contractType.ragRuleExtractionPrompt ||
                            contractType.ragSampleExtractionOutput;
        
        if (hasDbPrompts) {
          return {
            extractionPrompt: contractType.extractionPrompt || defaultPrompts?.extractionPrompt || null,
            ruleExtractionPrompt: contractType.ruleExtractionPrompt || defaultPrompts?.ruleExtractionPrompt || null,
            erpMappingPrompt: contractType.erpMappingPrompt || defaultPrompts?.erpMappingPrompt || null,
            sampleExtractionOutput: contractType.sampleExtractionOutput || defaultPrompts?.sampleExtractionOutput || null,
            ragExtractionPrompt: contractType.ragExtractionPrompt || defaultPrompts?.ragExtractionPrompt || null,
            ragRuleExtractionPrompt: contractType.ragRuleExtractionPrompt || defaultPrompts?.ragRuleExtractionPrompt || null,
            ragSampleExtractionOutput: contractType.ragSampleExtractionOutput || defaultPrompts?.ragSampleExtractionOutput || null,
          };
        }
      }
      
      if (defaultPrompts) {
        return {
          ...defaultPrompts,
          ragExtractionPrompt: defaultPrompts.ragExtractionPrompt || null,
          ragRuleExtractionPrompt: defaultPrompts.ragRuleExtractionPrompt || null,
          ragSampleExtractionOutput: defaultPrompts.ragSampleExtractionOutput || null,
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to load prompts for contract type ${contractTypeCode}:`, error);
      return null;
    }
  }

  // Sanitize AI placeholders in JSON
  private sanitizeAIPlaceholders(jsonStr: string): string {
    let sanitized = jsonStr;
    
    // Replace literal [NA] with empty array []
    sanitized = sanitized.replace(/\[\s*NA\s*\]/gi, '[]');
    
    // Replace "NA" or 'NA' string values with null
    sanitized = sanitized.replace(/:\s*["']NA["']/gi, ': null');
    
    // Replace N/A variants
    sanitized = sanitized.replace(/:\s*["']N\/A["']/gi, ': null');
    
    // Fix trailing commas before closing brackets
    sanitized = sanitized.replace(/,(\s*[\]}])/g, '$1');
    
    return sanitized;
  }

  private extractJsonFromResponse(content: string): string {
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    return content;
  }

  // Parse JSON with error recovery
  private parseJsonSafe<T>(jsonStr: string, defaultValue: T): T {
    try {
      const sanitized = this.sanitizeAIPlaceholders(jsonStr);
      const extracted = this.extractJsonFromResponse(sanitized);
      return JSON.parse(extracted) as T;
    } catch (error) {
      console.warn('⚠️ Failed to parse JSON from Claude response:', error);
      return defaultValue;
    }
  }

  /**
   * Call Claude API with retries
   */
  private async callClaude(systemPrompt: string, userPrompt: string, retries: number = 3): Promise<string> {
    let lastError: Error | null = null;
    const activeModel = await this.getConfiguredModel();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🤖 [Claude] Calling ${activeModel} (attempt ${attempt}/${retries}, from System Settings)`);
        
        const msgParams = {
          model: activeModel,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          system: systemPrompt,
          messages: [
            { role: 'user' as const, content: userPrompt }
          ],
        };
        const stream = await anthropic.messages.stream(msgParams);
        const message = await stream.finalMessage();
        
        const textContent = message.content.find(block => block.type === 'text');
        if (textContent && textContent.type === 'text') {
          const stopReason = (message as any).stop_reason || 'unknown';
          console.log(`✅ [Claude] Response received (${textContent.text.length} chars, stop_reason: ${stopReason}, usage: ${JSON.stringify((message as any).usage || {})})`);
          if (stopReason === 'max_tokens') {
            console.warn(`⚠️ [Claude] Response was TRUNCATED (hit max_tokens=${this.maxTokens}). Output may be incomplete.`);
          }
          return textContent.text;
        }
        
        throw new Error('No text content in Claude response');
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ [Claude] Attempt ${attempt} failed:`, error.message);
        
        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Claude API call failed after all retries');
  }

  /**
   * Analyze a contract and extract key information
   */
  async analyzeContract(contractText: string): Promise<ContractAnalysisResult> {
    const startTime = Date.now();
    
    const systemPrompt = `You are an expert contract analyst specializing in commercial agreements, licensing contracts, and business documents. 
Analyze contracts thoroughly and provide structured insights about terms, risks, and key provisions.
Always respond with valid JSON only - no markdown, no explanations outside the JSON structure.`;

    const userPrompt = `Analyze the following contract and provide a comprehensive analysis in JSON format:

${contractText.substring(0, 50000)}

Respond with ONLY valid JSON in this exact format:
{
  "summary": "Brief 2-3 sentence summary of the contract",
  "keyTerms": [
    {
      "type": "Payment Terms|Licensing|Termination|Obligations|Rights|Warranty|Indemnification|Other",
      "description": "Description of the term",
      "confidence": 0.95,
      "location": "Section reference or page"
    }
  ],
  "riskAnalysis": [
    {
      "level": "high|medium|low",
      "title": "Risk title",
      "description": "Detailed risk description"
    }
  ],
  "insights": [
    {
      "type": "Opportunity|Concern|Recommendation",
      "title": "Insight title",
      "description": "Detailed insight"
    }
  ],
  "confidence": 0.90
}`;

    try {
      const response = await this.callClaude(systemPrompt, userPrompt);
      const result = this.parseJsonSafe<ContractAnalysisResult>(response, {
        summary: 'Contract analysis completed',
        keyTerms: [],
        riskAnalysis: [],
        insights: [],
        confidence: 0.5,
      });
      
      console.log(`✅ [Claude] Contract analysis completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      console.error('❌ [Claude] Contract analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract detailed license/fee rules from contract text
   */
  async extractDetailedContractRules(contractText: string, contractTypeCode?: string): Promise<LicenseRuleExtractionResult> {
    const startTime = Date.now();
    
    // Get contract type-specific prompts if available
    const customPrompts = await this.getContractTypePrompts(contractTypeCode);
    
    const systemPrompt = customPrompts?.ruleExtractionPrompt || `You are an expert contract analyst specializing in extracting payment rules, fee structures, and fee calculations from commercial agreements.

Your task is to extract ALL payment-related rules from contracts and convert them into structured JSON with FormulaDefinition trees that can be programmatically evaluated.

CRITICAL RULES:
1. Extract EVERY payment rule, fee structure, fee rate, and pricing tier you find
2. Always include the COMPLETE, UNTRUNCATED source text in sourceSpan.text — copy the FULL sentence(s) or paragraph(s) from the contract. NEVER abbreviate with "..." or cut off mid-word
3. Include page numbers and section references when available
4. For tiered pricing, extract ALL tiers with their exact thresholds and rates
5. Generate FormulaDefinition JSON trees for complex calculations
6. Confidence should reflect how clearly the rule is stated (0.0-1.0)
7. Extract rules from ALL formats — not just tables. Rules described in paragraphs, bullet points, numbered clauses, and prose text are equally important
8. A "rule" includes: rates, fees, bonuses, conditions, eligibility criteria, exclusions, qualifying thresholds, and scope definitions

SUPPORTED RULE TYPES:
- tiered: Tiered rate structures (tables or text-described)
- percentage: Single percentage rate (e.g., "5% of net sales")
- fixed_fee: Fixed amounts (e.g., "$2 per unit", "$10,000 annually")
- minimum_guarantee: Minimum payment amounts
- rebate-rate: Rebate percentage on sales
- per-unit: Per-unit pricing or fee
- bonus: Additional incentives or bonuses (e.g., "Additional 1.5% bonus on premium products")
- condition: Qualifying conditions, eligibility criteria, restrictions (e.g., "Only applies to Pro Series", "Must achieve $500K threshold")
- data-only: Reference data, definitions, or informational clauses that define scope but have no calculation

IMPORTANT: Do NOT skip rules just because they are written as sentences or paragraphs rather than in a table. If text describes a rate, fee, bonus, condition, or eligibility rule, extract it as a rule with the appropriate ruleType.

FormulaDefinition Structure:
{
  "type": "operation type",
  "left/right/value": "operands",
  "conditions": [], // for conditional logic
  "tiers": [] // for tiered pricing
}

Always respond with valid JSON only.`;

    const sampleOutput = customPrompts?.sampleExtractionOutput || `{
  "documentType": "licensing",
  "contractCategory": "revenue-generating",
  "licenseType": "Product License Agreement",
  "parties": {
    "licensor": "ABC Company",
    "licensee": "XYZ Corporation"
  },
  "effectiveDate": "2024-01-01",
  "expirationDate": "2026-12-31",
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Net Sales Fee",
      "description": "Tiered fee based on annual net sales",
      "conditions": {
        "productCategories": ["All Licensed Products"],
        "territories": ["Worldwide"],
        "currency": "USD"
      },
      "calculation": {
        "basis": "net_sales",
        "tierMethod": "marginal",
        "tiers": [
          {"min": 0, "max": 1000000, "rate": 0.05},
          {"min": 1000000, "max": 5000000, "rate": 0.04},
          {"min": 5000000, "rate": 0.03}
        ]
      },
      "priority": 1,
      "sourceSpan": {
        "page": 5,
        "section": "Article 4 - Royalties",
        "text": "Licensee shall pay royalties as follows: 5% on net sales up to $1,000,000, 4% on net sales from $1,000,000 to $5,000,000, and 3% on net sales above $5,000,000"
      },
      "confidence": 0.95,
      "formulaDefinition": {
        "type": "tiered",
        "input": {"type": "variable", "name": "netSales"},
        "tiers": [
          {"min": 0, "max": 1000000, "rate": 0.05},
          {"min": 1000000, "max": 5000000, "rate": 0.04},
          {"min": 5000000, "rate": 0.03}
        ],
        "method": "marginal"
      }
    }
  ],
  "currency": "USD",
  "paymentTerms": "Net 30",
  "reportingRequirements": [
    {
      "frequency": "Quarterly",
      "dueDate": "30 days after quarter end",
      "description": "Sales report with itemized product details"
    }
  ]
}`;

    const userPrompt = `Extract ALL payment rules, fee structures, and fee calculations from this contract.

CONTRACT TEXT:
${contractText.substring(0, 80000)}

IMPORTANT:
1. Find EVERY payment-related clause (royalties, fees, minimums, caps, tiers, penalties, bonuses, conditions, eligibility criteria)
2. Extract rules from TABLES, PARAGRAPHS, BULLET POINTS, and NUMBERED CLAUSES — not just tables
3. If text says something like "Additional 1.5% bonus on premium products" or "Only applies to Pro Series", that IS a rule — extract it with ruleType "bonus" or "condition"
4. For each rule, include the EXACT source text where you found it
5. Generate FormulaDefinition JSON trees for programmatic calculation
6. Include confidence scores based on clarity of the source text

Respond with ONLY valid JSON matching this structure:
${sampleOutput}`;

    try {
      const response = await this.callClaude(systemPrompt, userPrompt);
      const result = this.parseJsonSafe<LicenseRuleExtractionResult>(response, {
        documentType: 'other',
        contractCategory: 'other',
        licenseType: 'Unknown',
        parties: { licensor: 'Unknown', licensee: 'Unknown' },
        rules: [],
        currency: 'USD',
        paymentTerms: 'Unknown',
        reportingRequirements: [],
        extractionMetadata: {
          totalRulesFound: 0,
          avgConfidence: 0,
          processingTime: Date.now() - startTime,
          ruleComplexity: 'simple',
          hasFixedPricing: false,
          hasVariablePricing: false,
          hasTieredPricing: false,
          hasRenewalTerms: false,
          hasTerminationClauses: false,
        },
      });
      
      // Add extraction metadata if not present
      if (!result.extractionMetadata) {
        result.extractionMetadata = {
          totalRulesFound: result.rules?.length || 0,
          avgConfidence: result.rules?.reduce((sum, r) => sum + (r.confidence || 0), 0) / (result.rules?.length || 1),
          processingTime: Date.now() - startTime,
          ruleComplexity: this.determineComplexity(result.rules || []),
          hasFixedPricing: result.rules?.some(r => r.ruleType === 'fixed_fee' || r.ruleType === 'fixed_price') || false,
          hasVariablePricing: result.rules?.some(r => r.ruleType === 'percentage' || r.ruleType === 'variable_price') || false,
          hasTieredPricing: result.rules?.some(r => r.ruleType === 'tiered' || r.calculation?.tiers) || false,
          hasRenewalTerms: result.rules?.some(r => r.ruleType === 'auto_renewal') || false,
          hasTerminationClauses: result.rules?.some(r => r.ruleType === 'early_termination') || false,
        };
      }
      
      console.log(`✅ [Claude] Extracted ${result.rules?.length || 0} rules in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      console.error('❌ [Claude] Rule extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Determine rule complexity based on extracted rules
   */
  private determineComplexity(rules: ContractRule[]): 'simple' | 'moderate' | 'complex' {
    if (rules.length === 0) return 'simple';
    
    const hasTiers = rules.some(r => r.calculation?.tiers && r.calculation.tiers.length > 2);
    const hasFormulas = rules.some(r => r.formulaDefinition);
    const hasConditions = rules.some(r => Object.keys(r.conditions || {}).length > 2);
    
    if (hasTiers && hasFormulas) return 'complex';
    if (hasTiers || hasFormulas || hasConditions) return 'moderate';
    return 'simple';
  }

  async generateRichFormulaDefinitions(rules: any[], contractText: string): Promise<any[]> {
    const rulesContext = rules.map((r, i) => {
      const parts = [`Rule ${i + 1}: "${r.ruleName}" (Type: ${r.ruleType})`];
      if (r.sourceSection) parts.push(`Source: ${r.sourceSection}`);
      if (r.sourceText) parts.push(`Text: "${r.sourceText}"`);
      if (r.description) parts.push(`Description: ${r.description}`);
      if (r.minimumGuarantee) parts.push(`Minimum: $${r.minimumGuarantee}`);
      if (r.baseRate) parts.push(`Rate: ${r.baseRate}%`);
      if (r.volumeTiers) parts.push(`Volume Tiers: ${JSON.stringify(r.volumeTiers)}`);
      if (r.productCategories) parts.push(`Products: ${JSON.stringify(r.productCategories)}`);
      if (r.territories) parts.push(`Territories: ${JSON.stringify(r.territories)}`);
      return parts.join(' | ');
    }).join('\n');

    const systemPrompt = `You are an expert contract analyst. You analyze ANY type of contract (rebate, royalty, contract fee, service, distribution, referral, usage-based, marketplace, chargeback, MDF, or any other) and produce comprehensive rule documentation.

Given extracted rules and the source contract text, generate a COMPLETE rich formulaDefinition JSON object for EACH rule. You must read the contract text carefully and extract EVERY detail — do NOT hallucinate or invent information.

EVERY rule MUST have a "category" field. Derive category names from the contract content itself. Common patterns:
- "Core [Type] Rules" (e.g., "Core Rebate Rules", "Core Fee Rules", "Core Contract Fee Rules", "Core Pricing Rules")
- "Payment & Reporting Rules"
- "Data & Compliance Rules" 
- "Termination Rules"
- "Special Programs" / "Incentive Programs"
- "Obligations & Requirements"
- "Performance & SLA Rules"
- Any other category that fits the contract's structure

FIELD REFERENCE — include ALL fields that apply to each rule:

UNIVERSAL FIELDS (use for ANY rule type):
- "category": string — Section grouping (REQUIRED for every rule)
- "trigger": string — When/what activates this rule (e.g., "End of each calendar quarter", "Upon delivery", "Monthly", "On breach")
- "logic": string — IF/ELSE pseudocode or step-by-step process description using variable names from the contract
- "example": {scenario: string, calculation: string[]} — Primary worked example with real numbers from the contract
- "examples": [{scenario: string, calculation: string[]}] — Additional worked examples if contract provides multiple scenarios
- "notes": string[] — Important caveats, definitions, exclusions, edge cases from the contract text
- "type": string — Rule type identifier matching the contract terminology
- "critical": boolean — true if contract has a critical warning/penalty for this rule
- "criticalNote": string — The critical warning text

CALCULATION-SPECIFIC FIELDS (for rules involving money, rates, fees, percentages):
- "calculationBasis": string — What the calculation is based on (e.g., "Net Sales", "Gross Revenue", "Units Sold", "Monthly Active Users")
- "tiers": [{tier: number, description: string, rate: number, min?: number, max?: number}] — Rate as decimal (0.02 = 2%). Description should use contract's currency and terms
- "tierBasisLabel": string — Column header matching contract terminology (e.g., "Annual Net Sales (USD)", "Monthly Units", "Quarterly Revenue")
- "tierRateLabel": string — Column header for rate (e.g., "Royalty %", "Contract Fee %", "Rebate %", "Commission Rate")
- "fixedAmount": number — For fixed-fee rules, the amount
- "fixedAmountPeriod": string — Period for fixed amount (e.g., "per month", "per year", "one-time")
- "minimumGuarantee": number — Minimum payment amount if specified
- "maximumCap": number — Maximum/ceiling amount if specified
- "baseRate": number — Single rate as decimal when no tiers apply
- "threshold": number or string — Threshold that triggers the rule
- "bonusThreshold": number — Base amount above which bonus applies
- "bonusRate": number — Bonus rate as decimal
- "additionalRebate": number — Additional promotional rate as decimal
- "activePeriod": string — For time-limited rules
- "product": string — For product/service-specific rules
- "territory": string — For territory-specific rules
- "exclusions": string[] — What is excluded from the calculation

SCHEDULE & TIMELINE FIELDS (for reporting, payment, compliance rules):
- "timeline": string — Timeframe (e.g., "Within 30 days after quarter-end", "NET 60", "Upon invoice")
- "deadline": string — Specific deadline if different from timeline
- "frequency": string — How often (e.g., "Quarterly", "Monthly", "Annually", "Once per contract year")
- "paymentMethod": string — How payment is made (e.g., "Wire transfer", "Credit memo", "Check", "ACH")

REQUIREMENTS FIELDS (for data submission, reporting, audit rules):
- "requiredInformation": string[] — List of items that must be provided
- "dependencies": string — What must happen first
- "scope": string — What is covered
- "noticeRequired": string — Notice period required

CONTRACT LIFECYCLE FIELDS (for renewal, termination, breach rules):
- "autoRenewal": string — Auto-renewal terms
- "optOut": string — How to opt out or terminate
- "curePeriod": string — Time to remedy a breach
- "rebateTreatment": string — How accrued payments are handled on termination
- "remediation": string — What happens on violation
- "penalties": string — Penalty details for non-compliance

IMPLEMENTATION/CHECKLIST FIELDS (for operational guidance extracted from the contract):
- "implementationChecklist": {[periodLabel: string]: string[]} — Grouped task lists (e.g., {"Monthly Tasks": [...], "Quarterly Tasks": [...], "Annual Tasks": [...]})
- "keyDates": [{period: string, date: string, description: string}] — Calendar of important dates, deadlines, milestones from the contract

CRITICAL INSTRUCTIONS:
1. Read the CONTRACT TEXT carefully. Extract ACTUAL details — never invent numbers, dates, rates, or terms
2. Every CALCULATION rule MUST have: trigger + logic + at least one worked example with real numbers from the contract
3. NON-CALCULATION rules MUST have: timeline/deadline and requiredInformation where applicable  
4. Use variable names that match the contract's own terminology in logic pseudocode
5. Rates in tiers MUST be decimals (0.02 not 2%, 0.15 not 15%)
6. Include ALL tiers/levels — do not skip or summarize
7. Examples must use realistic numbers consistent with the contract's scale
8. Notes should capture definitions, exclusions, and edge cases verbatim from the contract
9. If a rule has a penalty or critical consequence, set critical=true and provide criticalNote
10. Return ONLY a valid JSON array, one object per rule, in the SAME ORDER as the input rules

Respond with ONLY the JSON array. No markdown fences, no explanation, no preamble.`;

    const userPrompt = `Here are the ${rules.length} existing extracted rules:
${rulesContext}

FULL CONTRACT TEXT (use this to find exact details, numbers, dates, and terms for each rule):
${contractText.substring(0, 60000)}

Generate a COMPLETE rich formulaDefinition for EACH of the ${rules.length} rules above. Return a JSON array with exactly ${rules.length} objects in the same order. Include ALL applicable fields - calculation rules need tiers/logic/examples, non-calculation rules need timelines/requirements/deadlines.`;

    try {
      const response = await this.callClaude(systemPrompt, userPrompt);
      console.log(`📋 [Claude] Rich formula response preview: ${response.substring(0, 200)}...`);
      
      const jsonStr = this.extractJsonFromResponse(response);
      const sanitized = this.sanitizeAIPlaceholders(jsonStr);
      
      let result: any;
      try {
        result = JSON.parse(sanitized);
      } catch (parseError) {
        console.warn('⚠️ [Claude] First parse failed, trying recovery...');
        const recovered = this.extractJsonFromResponse(sanitized);
        try {
          result = JSON.parse(recovered);
        } catch (secondError) {
          console.error('❌ [Claude] JSON parse failed after recovery:', secondError);
          console.error('❌ [Claude] Raw response length:', response.length, 'Extracted length:', jsonStr.length);
          return [];
        }
      }
      
      if (Array.isArray(result)) {
        console.log(`✅ [Claude] Parsed ${result.length} rich formula definitions`);
        return result;
      }
      if (result && result.rules && Array.isArray(result.rules)) {
        console.log(`✅ [Claude] Parsed ${result.rules.length} rules from wrapped response`);
        return result.rules;
      }
      if (result && result.formulaDefinitions && Array.isArray(result.formulaDefinitions)) {
        return result.formulaDefinitions;
      }
      console.warn('⚠️ [Claude] Response was not an array or known wrapper:', typeof result);
      return [];
    } catch (error) {
      console.error('❌ [Claude] Failed to generate rich formulas:', error);
      return [];
    }
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Set a different model
   */
  setModel(model: string): void {
    const validModels = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'];
    if (!validModels.includes(model)) {
      console.warn(`⚠️ Model ${model} may not be available. Valid models: ${validModels.join(', ')}`);
    }
    this.model = model;
    console.log(`🔄 [Claude] Model changed to: ${model}`);
  }
}

// Export singleton instance with default model
export const claudeService = new ClaudeService();
