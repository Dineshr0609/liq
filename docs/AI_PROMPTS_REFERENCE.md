# LicenseIQ AI Prompts Reference

A comprehensive reference of every AI prompt used in the LicenseIQ platform — where it lives, when it fires, and what it does.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prompt Categories](#prompt-categories)
3. [Layer 1 — Contract Analysis Prompts](#layer-1--contract-analysis-prompts)
4. [Layer 2 — Rule Extraction Prompts](#layer-2--rule-extraction-prompts)
5. [Layer 3 — Contract-Type-Specific Prompts](#layer-3--contract-type-specific-prompts)
6. [Layer 4 — Rich Formula Generation Prompts](#layer-4--rich-formula-generation-prompts)
7. [Layer 5 — On-Demand Analysis Prompts](#layer-5--on-demand-analysis-prompts)
8. [Layer 6 — Conversational AI Prompts](#layer-6--conversational-ai-prompts)
9. [Layer 7 — ERP Integration & Mapping Prompts](#layer-7--erp-integration--mapping-prompts)
10. [Layer 8 — Table & Field Detection Prompts](#layer-8--table--field-detection-prompts)
11. [Layer 9 — Validation & Reasoning Prompts](#layer-9--validation--reasoning-prompts)
12. [Layer 10 — Sanitization & Post-Processing](#layer-10--sanitization--post-processing)
13. [Prompt Configuration System](#prompt-configuration-system)
14. [AI Provider Routing](#ai-provider-routing)

---

## Architecture Overview

LicenseIQ uses a multi-layer AI prompt system where different prompts activate at different stages of contract processing. The system supports three AI providers:

| Provider | Primary Use | Models |
|----------|------------|--------|
| **Anthropic (Claude)** | Primary analysis, rich formula generation | claude-sonnet-4-5 |
| **Groq (LLaMA)** | Fast extraction, RAG answers, chatbot | llama-3.3-70b-versatile, llama-3.1-8b-instant |
| **OpenAI** | Fallback, specialized reasoning | gpt-4o |

The AI provider is configurable via **System Settings → AI Configuration** in the admin panel. All prompts route through `aiProviderService.ts` which selects the correct backend based on the `system_settings.ai_provider` database value.

---

## Prompt Categories

| Category | When It Fires | File Location |
|----------|--------------|---------------|
| Contract Analysis | Upload → "Process Contract" | `claudeService.ts`, `groqService.ts` |
| Rule Extraction | During contract processing (Fast Path) | `groqService.ts`, `claudeService.ts` |
| Contract-Type Prompts | Based on detected contract type | `defaultContractTypePrompts.ts` |
| Rich Formula Generation | After initial extraction (enrichment) | `claudeService.ts` |
| On-Demand Analysis | User clicks analysis sections | `groqService.ts` via routes |
| Conversational (liQ AI) | Chat widget, RAG Q&A | `ragService.ts`, `routes.ts` |
| ERP Mapping | Schema mapping generation | `routes.ts`, `erpVocabularyService.ts` |
| Field Detection | Table column role identification | `routes.ts` |
| Validation | Sales-contract matching | `groqValidationService.ts`, `contractReasoningService.ts` |

---

## Layer 1 — Contract Analysis Prompts

### P001: Comprehensive Contract Analysis
- **File**: `server/services/claudeService.ts` (line ~306)
- **Function**: `analyzeContract()`
- **When**: Called during initial contract processing or on-demand full analysis
- **AI Provider**: Anthropic Claude (primary)
- **Temperature**: Default (moderate)

**System Prompt:**
```
You are an expert contract analyst specializing in commercial agreements, 
licensing contracts, and business documents. Analyze contracts thoroughly 
and provide structured insights about terms, risks, and key provisions.
Always respond with valid JSON only - no markdown, no explanations outside 
the JSON structure.
```

**User Prompt (template):**
```
Analyze the following contract and provide a comprehensive analysis in JSON format:

[contract text — up to 50,000 characters]

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
}
```

**What it produces**: Summary, key terms, risk analysis, and strategic insights for the contract overview dashboard.

---

### P002: Full Contract Extraction (Single-Pass)
- **File**: `server/services/groqService.ts` (line ~1471)
- **Function**: `extractAllContractDataInOneCall()`
- **When**: Called for shorter contracts that fit in one API call
- **AI Provider**: Configured provider (defaults to Claude)

**System Prompt:**
```
You are a contract analysis expert. Extract ALL information from this 
complete contract document.
```

**Purpose**: Performs a single-pass extraction of parties, dates, territories, key terms, AND all pricing/payment rules in one call. Used when the document is small enough to process entirely at once.

---

## Layer 2 — Rule Extraction Prompts

### P003: Main Rule Extraction Prompt
- **File**: `server/services/groqService.ts` (line ~2460–2692)
- **Function**: `extractDetailedRoyaltyRules()` → builds prompt via `buildExtractionPrompt()`
- **When**: Primary extraction during contract processing (Fast Path)
- **AI Provider**: Configured provider

**System Prompt:**
```
You are a license agreement analysis expert. Analyze this document and 
extract structured, machine-readable rules. CRITICAL: For ANY table with 
3+ columns, you MUST use ruleType="table_extracted" with tableData.
Return only valid JSON.
```

**Rule Types the AI looks for:**

| Rule Type | What It Detects | Example |
|-----------|----------------|---------|
| `percentage` | Percentage-based rates | "5% of net sales" |
| `tiered` / `tiered_pricing` | Volume-based tier schedules | Rate changes at 1,000 / 5,000 / 10,000 units |
| `rebate_tiered` | Rebate programs with tiers | Quarterly volume rebate schedule |
| `minimum_guarantee` | Minimum annual payments | "$85,000 minimum annually" |
| `fixed_fee` | One-time fixed fees | "Training fee of $5,000" |
| `annual_fee` | Recurring annual fees | "Annual certification: $2,500" |
| `cap` | Maximum limits | "Maximum royalty of $500,000" |
| `late_payment_penalty` | Interest/penalty charges | "1.5% per month on overdue" |
| `payment_schedule` | Payment timing | "Net 30 days" |
| `payment_method` | Payment methods | "Wire transfer required" |
| `container_size_tiered` | Size-based pricing (plant/nursery) | Per-gallon rates |
| `net_sales_tiered` | Net sales percentage tiers | Dollar-threshold tiers |
| `category_percentage` | Category-specific rates | Industrial vs Aerospace rates |
| `milestone_payment` | Event-triggered payments | "$50K on first commercial sale" |
| `per_product_fixed` | Per-product pricing tables | Mother stock investment table |
| `condition` | Contract obligations | Audit rights, compliance rules |
| `data-only` | Informational references | Definitions, territory lists |

**JSON Template** (what the AI must output for each rule):
```json
{
  "ruleType": "one of the exact types above",
  "ruleName": "descriptive name",
  "description": "MANDATORY - clear 1-sentence description",
  "clauseCategory": "pricing|rebate|territory|product|customer_segment|compliance|payment|general",
  "channel": "retail|wholesale|online|all",
  "conditions": {
    "productCategories": ["category1"],
    "territories": ["territory1"],
    "customerSegments": ["segment1"],
    "timeperiod": "monthly|annually|etc",
    "aggregationPeriod": "quarterly|annual|monthly",
    "volumeThreshold": [1000, 5000],
    "licenseScope": {"userLimit": 100, "geographic": ["NA"], "termMonths": 12},
    "renewalTerms": {"autoRenew": true, "renewalRate": 3.0, "noticeRequiredDays": 30}
  },
  "calculation": {
    "rate": 5.0,
    "baseRate": 10.0,
    "amount": 1000.0,
    "tiers": [{"min": 0, "max": 1000, "rate": 5.0}],
    "containerSizeRates": [{"size": "1-gallon", "baseRate": 1.25, "volumeThreshold": 5000, "discountedRate": 1.10}],
    "seasonalAdjustments": {"spring": 1.15},
    "territoryPremiums": {"california": 0.50}
  },
  "priority": "1-10 (lower = more specific)",
  "sourceSpan": {
    "section": "section name",
    "text": "concise verbatim quote (max 150 chars)"
  },
  "confidence": "0.6 to 1.0"
}
```

**Anti-Hallucination Rules** (embedded in the prompt):
- Extract ONLY rules that EXPLICITLY exist in the contract text
- Each rule MUST include `sourceSpan.text` with EXACT VERBATIM quote
- Keep `sourceSpan.text` CONCISE (max 150 chars)
- NEVER include full pricing tables in sourceSpan.text
- DO NOT invent, assume, or create rules not in the text
- Set confidence 0.6–1.0 based on how explicit the rule is
- Return empty rules array if no pricing/payment terms found

**Metadata Exclusion Rules** (things that are NOT rules):
- License Agreement Number
- Effective Date, Expiration Date, Term Duration
- License Type descriptions
- Party names, addresses, contact information
- Contract title or header information
- Governing law, jurisdiction clauses

---

### P004: Chunked Rule Extraction (Large Contracts)
- **File**: `server/services/groqService.ts` (line ~3100–3400)
- **Function**: `extractLargeContractInChunks()` → `extractRulesOnly()`
- **When**: Contract text exceeds single-call token limit
- **AI Provider**: Configured provider

Uses the same rule extraction template as P003 but processes the contract in overlapping chunks, then merges and deduplicates results. Each chunk gets:

```
Extract ALL pricing/payment rules from THIS SECTION of a contract.
[Same rule type list and JSON template as P003]

Contract Section:
[chunk text]
```

---

### P005: RAG-Enhanced Rule Extraction
- **File**: `server/services/groqService.ts` via `defaultContractTypePrompts.ts`
- **Function**: `extractRulesWithRAG()`
- **When**: When extraction mode is set to "RAG" in system settings
- **AI Provider**: Configured provider

Adds mandatory source citation requirements:
```
Extract ONLY from the provided chunks - do NOT infer missing information.
Include MANDATORY source citations with exact quotes from the retrieved 
document sections.
```

---

## Layer 3 — Contract-Type-Specific Prompts

### P006: Direct Sales / Channel Reseller Prompts
- **File**: `server/prompts/defaultContractTypePrompts.ts` (line ~12–66)
- **When**: Contract type detected as `direct_sales`

**Extraction Focus:**
- Company and Channel Partner/Reseller identification
- Deal Registration process and approval criteria
- Territory assignments (North America, EMEA, APAC)
- Partner tiers and certification levels
- Performance metrics and quotas

**Rule Extraction Focus:**
- REGISTERED DEAL commissions (Year 1: 10-15%, Year 2: 6-10%, Year 3+: 3-5%)
- INFLUENCED DEAL commissions (lower than registered)
- RENEWAL commissions (Partner of Record)
- PERFORMANCE BONUSES (quarterly ARR thresholds)
- CHARGEBACK provisions
- Multi-year commission structures extracted as separate tiers

---

### P007: Distributor Agreement Prompts
- **File**: `server/prompts/defaultContractTypePrompts.ts` (line ~130+)
- **When**: Contract type detected as `distributor`

**Extraction Focus:**
- Distribution territories and exclusivity
- MAP (Minimum Advertised Price) policies
- Rebate tier schedules with volume thresholds
- Compliance terms and reporting obligations

**ERP Mapping Focus:**
```
Map Distributor Agreement terms to ERP fields.
Common mappings:
- Distributor → CUSTOMER_ID
- Territory → TERRITORY_CODE
- Volume Tier → VOLUME_BAND
- Rebate Rate → REBATE_PCT
- MAP Price → MAP_PRICE
```

---

### P008: Royalty / License Agreement Prompts
- **File**: `server/prompts/defaultContractTypePrompts.ts` (line ~350+)
- **When**: Contract type detected as `royalty_license`

**Extraction Focus:**
- Contract type sub-detection (Electronics/Component, Manufacturing/Technology, Plant/Nursery)
- Per-unit pricing vs percentage-of-sales structures
- Container size pricing tables
- Premium variety multipliers
- Seasonal adjustments

**Key Intelligence:**
```
Identify the contract type first:
1. Electronics/Component → look for "per unit" pricing, ASP percentages
2. Manufacturing/Tech → look for Net Sales %, dollar-based thresholds
3. Plant/Nursery → look for container size pricing, per-plant rates
```

---

### P009: Plant/Nursery-Specific Additions
- **File**: `server/services/groqService.ts` (line ~2498–2595)
- **When**: `contractTypeCode === 'plant_nursery'`
- **Activated**: Only when contract type is detected as plant/nursery

**Container Size Detection Logic:**
```
HOW TO DETECT container_size_tiered (vs regular tiered):
- If table first column has PHYSICAL SIZES (1-gallon, 3-gallon) → container_size_tiered
- If table first column has QUANTITY RANGES (1-2,500 units) → tiered (NOT container_size_tiered!)
- Column header "Plant Size Category" → container_size_tiered
- Column header "Sales Volume (Annual)" → tiered (volume-based)
```

**Premium Variety Extraction:**
```
Extract premium columns for each row:
- premiumMultiplier: (1.0x → 1.0, 1.2x → 1.2, 1.5x → 1.5)
- premiumDescription: text in parentheses (e.g., "premium roses")
- premiumRate: baseRate × premiumMultiplier
```

**Seasonal Adjustments:**
```
Extract as GLOBAL object (NOT per container size):
seasonalAdjustments: {"Spring": 1.15, "Fall": 0.95, "Holiday": 1.20, "Off-Season": 1.0}
- +15% premium = 1.15 multiplier
- -5% discount = 0.95 multiplier
```

---

## Layer 4 — Rich Formula Generation Prompts

### P010: Rich FormulaDefinition Generator
- **File**: `server/services/claudeService.ts` (line ~557)
- **Function**: `generateRichFormulas()`
- **When**: After initial extraction, when enrichment is triggered (deferred background task or on-demand)
- **AI Provider**: Claude (always — requires high reasoning)

**System Prompt:**
```
You are an expert contract analyst. You analyze ANY type of contract 
(rebate, royalty, license fee, service, distribution, referral, 
usage-based, marketplace, chargeback, MDF, or any other) and produce 
comprehensive rule documentation.

Given extracted rules and the source contract text, generate a COMPLETE 
rich formulaDefinition JSON object for EACH rule.

EVERY rule MUST have a "category" field.
```

**Category Assignment Logic:**
```
Derive category names from the contract content itself:
- "Core [Type] Rules" (e.g., "Core Rebate Rules", "Core Royalty Rules")
- "Payment & Reporting Rules"
- "Data & Compliance Rules"
- "Termination Rules"
- "Special Programs" / "Incentive Programs"
- "Obligations & Requirements"
- "Performance & SLA Rules"
```

**Fields Generated** (universal fields for ANY rule type):
| Field | Purpose |
|-------|---------|
| `category` | Section grouping (REQUIRED) |
| `trigger` | When/what activates this rule |
| `logic` | IF/ELSE pseudocode using contract variable names |
| `example` | Worked example with real numbers from contract |
| `examples` | Additional worked examples |
| `notes` | Caveats, definitions, exclusions |
| `type` | Rule type identifier |
| `critical` | Whether contract has critical warning for this rule |
| `criticalNote` | The critical warning text |

**Calculation-specific fields:**
| Field | Purpose |
|-------|---------|
| `calculationBasis` | What calculation is based on (Net Sales, Units Sold, etc.) |
| `tiers` | Rate tiers as decimals (0.02 = 2%) |
| `tierBasisLabel` | Column header from contract (e.g., "Annual Net Sales (USD)") |
| `tierRateLabel` | Rate column header (e.g., "Royalty %", "Rebate %") |
| `fixedAmount` | For fixed-fee rules |
| `minimumGuarantee` | Minimum payment amount |
| `maximumCap` | Ceiling amount |
| `exclusions` | What is excluded from calculation |

These categories are what create the **tab navigation** on the rules management page (the tabs like "Pricing & Rates 9", "Rebate Programs 10", etc.).

---

## Layer 5 — On-Demand Analysis Prompts

### P011: Rich Summary Generator
- **File**: `server/services/groqService.ts` (line ~4977)
- **Function**: `generateRichSummary()`
- **When**: User clicks "Summary" section in contract analysis view
- **AI Provider**: Configured provider

```
System: You are a professional contract analyst. Provide clear, concise summaries.
User: Summarize this contract with key business terms, obligations, and financial impact.
```

---

### P012: Key Terms Extractor
- **File**: `server/services/groqService.ts` (line ~5009)
- **Function**: `generateKeyTerms()`
- **When**: User clicks "Key Terms" section

```
System: You are a contract term extraction specialist. Return only valid JSON arrays.
```

---

### P013: Financial Insights Generator
- **File**: `server/services/groqService.ts` (line ~5085)
- **Function**: `generateInsights()`
- **When**: User clicks "Insights" section

```
System: You are a financial analyst specializing in contract monetization. 
Return only valid JSON.
```

---

### P014: Risk Analysis Generator
- **File**: `server/services/groqService.ts` (line ~5162)
- **Function**: `generateRiskAnalysis()` (deep mode)
- **When**: User clicks "Risk Analysis" section

```
System: You are a legal compliance specialist. Analyze contracts for 
regulatory adherence. Return only valid JSON.
```

---

### P015: Obligations Extractor
- **File**: `server/services/groqService.ts` (line ~5228)
- **Function**: `generateObligations()`
- **When**: User clicks "Obligations" section

```
System: You are a contract obligation specialist. Extract all deliverables 
and requirements. Return only valid JSON arrays.
```

---

### P016: Strategic Opportunities Analyzer
- **File**: `server/services/groqService.ts` (line ~5299)
- **Function**: `generateStrategicOpportunities()`
- **When**: User clicks "Opportunities" section

```
System: You are a strategic business analyst specializing in contract 
value optimization. Return only valid JSON.
```

---

### P017: Contract Comparison / Benchmarking
- **File**: `server/services/groqService.ts` (line ~5378)
- **Function**: `generateBenchmarks()`
- **When**: Comparative analysis requested

```
System: You are a contract comparison specialist. Identify patterns and 
anomalies across contracts. Return only valid JSON.
```

---

### P018: Performance Predictor
- **File**: `server/services/groqService.ts` (line ~5450)
- **Function**: `generatePerformancePredictions()`
- **When**: Predictive analysis requested

```
System: You are a contract performance analyst. Predict contract success 
metrics based on terms and structure. Return only valid JSON.
```

---

### P019: Comprehensive Risk Assessment
- **File**: `server/services/groqService.ts` (line ~5606)
- **Function**: `generateComprehensiveRisk()`
- **When**: Deep risk analysis requested

```
System: You are a comprehensive risk analyst. Evaluate all risk dimensions 
and provide detailed mitigation strategies. Return only valid JSON.
```

---

### P020: Industry Benchmarking
- **File**: `server/services/groqService.ts` (line ~5722)
- **Function**: `generateIndustryBenchmarks()`
- **When**: Industry comparison requested

```
System: You are a contract comparison specialist. Compare contracts against 
industry standards and best practices. Return only valid JSON.
```

---

## Layer 6 — Conversational AI Prompts

### P021: Landing Page Chatbot (liQ AI — Public)
- **File**: `server/routes.ts` (line ~256)
- **Endpoint**: `POST /api/landing-chat`
- **When**: Visitor uses the chat widget on the public landing page
- **AI Provider**: Configured provider via `groqService.makeRequest()`
- **Temperature**: 0.7 (creative/conversational)
- **Max Tokens**: 1,024

**System Prompt:**
```
You are liQ AI, the friendly AI assistant for LicenseIQ Research Platform. 
You help visitors learn about the platform and answer both general questions 
and LicenseIQ-specific questions.

IDENTITY:
- Your name is "liQ AI" — always refer to yourself as liQ AI if asked
- NEVER reveal your underlying AI model, architecture, technology stack, 
  or any technical implementation details
- If asked about your AI model, simply say: "I'm liQ AI, powered by 
  CimpleIT by LicenseIQ."

Your personality:
- Friendly, helpful, and professional
- Knowledgeable about AI, contract management, and business software
- Can answer general questions like ChatGPT (coding, writing, research)
- Expert on LicenseIQ platform features, pricing, and capabilities

[Includes full LicenseIQ knowledge base with platform features, pricing 
tiers, deployment options, and competitive positioning]

Guidelines:
1. For LicenseIQ questions: Provide accurate information from knowledge base
2. For general questions: Answer helpfully as a general AI assistant
3. If unsure about specifics, encourage them to request a demo
4. Keep responses concise but informative (2-4 paragraphs max)
5. Use bullet points or numbered lists when helpful
6. Be conversational and engaging
7. End responses with a helpful follow-up question or suggestion
```

**Conversation History**: Maintains last 10 messages for context continuity.

---

### P022: RAG-Powered Contract Q&A (liQ AI — Authenticated)
- **File**: `server/services/ragService.ts` (line ~315)
- **Function**: `generateAnswer()`
- **Endpoint**: `POST /api/rag/ask`
- **When**: Logged-in user asks a question about a specific contract
- **AI Provider**: Groq LLaMA 3.1 8B Instant (fast responses)
- **Temperature**: 0.3 (factual/precise)
- **Max Tokens**: 1,000

**System Prompt:**
```
You are liQ AI, the intelligent assistant built into the LicenseIQ platform. 
You help users understand their contracts with clear, direct, and actionable 
answers.

IDENTITY:
- Your name is "liQ AI"
- NEVER reveal your underlying AI model, architecture, technology stack
- If asked: "I'm liQ AI, powered by CimpleIT by LicenseIQ."

RESPONSE STYLE:
- Get straight to the answer - no preambles like "Based on the provided 
  sections" or "I can answer that"
- Be confident and professional like an expert consultant
- Structure information clearly using headings or bullets when helpful
- Cite specific details naturally (rates, terms, dates)
```

**Context**: Retrieves relevant document chunks via vector similarity search (pgvector + BAAI/bge-small-en-v1.5 embeddings), then passes them as context to the LLM.

---

### P023: RAG Fallback Answer (Full Contract Context)
- **File**: `server/services/ragService.ts` (line ~253)
- **Function**: `generateFallbackAnswer()`
- **When**: Vector search returns insufficient chunks; falls back to full contract analysis
- **AI Provider**: Groq LLaMA 3.1 8B Instant
- **Temperature**: 0.5

Same identity rules as P022 but with more lenient guidelines for using full contract analysis data instead of specific retrieved chunks.

---

## Layer 7 — ERP Integration & Mapping Prompts

### P024: AI Schema Mapping Generator
- **File**: `server/routes.ts` (line ~5556)
- **Endpoint**: `POST /api/mapping/generate`
- **When**: User clicks "Generate AI Mappings" in ERP Integration Hub
- **Temperature**: 0.1 (precise/deterministic)
- **Max Tokens**: 3,000

**System Prompt:**
```
You are an expert ERP integration specialist. Return only valid JSON.
```

**User Prompt:**
```
You are an expert ERP integration specialist mapping fields FROM ERP 
systems TO LicenseIQ schema.

ERP SOURCE SCHEMA ([ERP System] - [Entity Type]):
[source schema JSON]

LICENSEIQ TARGET SCHEMA:
[target schema JSON]

TASK: Map ERP source fields to LicenseIQ target fields.

CRITICAL MAPPING RULES FOR ITEMS ENTITY:
1. ERP "ItemDescription" → LicenseIQ "full_legal_product_name"
2. ERP "ItemClass" → LicenseIQ "item_category"
3. ERP "ItemType" → LicenseIQ "item_type"
4. ERP "ItemNumber" → LicenseIQ "item_number"
5. ERP "OrganizationCode" should NOT map to "vendor"

GENERAL RULES:
- Match by semantic meaning, not just field names
- A single ERP field CAN map to multiple LicenseIQ fields
- Suggest transformations when needed (date formats, case changes)

OUTPUT FORMAT (JSON array):
[
  {
    "source_field": "string or null",
    "target_field": "string",
    "transformation_rule": "direct|lowercase|date format|etc",
    "confidence": 0-100
  }
]
```

---

### P025: ERP Entity Matching
- **File**: `server/routes.ts` (line ~5679)
- **Endpoint**: `POST /api/mapping/match-entity`
- **When**: User selects an ERP entity for mapping

```
You are an expert ERP integration specialist. Analyze this ERP entity 
and find the best matching LicenseIQ entity.
```

---

### P026: ERP Field-Level Mapping
- **File**: `server/routes.ts` (line ~5762)
- **When**: After entity matching, generates field-level mappings

```
You are an expert ERP integration specialist. Create precise field 
mappings between these schemas.
```

---

### P027: ERP Vocabulary Mapping (Contract Terms → ERP Fields)
- **File**: `server/services/erpVocabularyService.ts` (line ~131)
- **When**: During contract term extraction and ERP auto-mapping

```
You are an expert at mapping contract terminology to ERP system fields.

Map each contract term to the most appropriate LicenseIQ field. Consider:
1. Semantic similarity between the term and field description
2. Data type compatibility (text→text, number→number)
3. Business context and common accounting practices

CRITICAL: You MUST use the EXACT field names from the vocabulary above.
```

---

### P028: LicenseIQ Schema Vocabulary Mapping
- **File**: `server/services/erpVocabularyService.ts` (line ~476)
- **When**: Mapping contract terms to LicenseIQ's internal schema

```
You are an expert at mapping contract terminology to LicenseIQ schema fields.
```

---

## Layer 8 — Table & Field Detection Prompts

### P029: AI Table Column Role Detection
- **File**: `server/routes.ts` (line ~879)
- **Endpoint**: `POST /api/contracts/:contractId/rules/:ruleId/ai-field-mappings`
- **When**: A rule has tabular data and the system needs to identify which column is the volume field, rate field, etc.
- **Temperature**: 0.1 (precise)
- **Max Tokens**: 512

**System Prompt:**
```
You are a contract data analysis expert. Respond with ONLY valid JSON, 
no explanation.
```

**User Prompt:**
```
You are analyzing a pricing/payment table extracted from a contract. 
Your job is to determine what calculation role each column plays.

Rule Name: "[rule name]"

Table columns: [column names]

Sample data (first N rows):
Row 1: {column: value, ...}
Row 2: {column: value, ...}

For each column, determine its calculation role:
- "volumeField": Volume ranges, quantities, thresholds
- "rateField": Rate, percentage, fee, or price
- "basisField": What the rate is applied against
- "minimumField": Minimum payment amounts
- "descriptionField": Labels, tier names, product names

Rules:
1. Each column can have at most ONE role
2. Each role can be assigned to at most ONE column
3. Not every column needs a role
4. Look at BOTH column name AND sample data values
```

---

### P030: Payment Terms Extraction
- **File**: `server/services/groqService.ts` (line ~4046)
- **Function**: `extractPaymentTerms()`
- **When**: Specialized extraction of payment-related clauses

```
You are a contract payment terms analyst. Extract ALL payment-related 
clauses from this contract.

Look for:
- Payment due dates and schedules
- Late payment penalties and interest rates
- Advance payment requirements
- Payment methods (wire, check, ACH)
- Currency and exchange rate provisions
```

---

## Layer 9 — Validation & Reasoning Prompts

### P031: Contract-Sales Matching Validation
- **File**: `server/services/contractReasoningService.ts` (line ~47)
- **Function**: `validateContractMatch()`
- **When**: Sales data is uploaded and needs to be matched against contracts

```
You are an expert contract analyst. Validate if a contract matches sales 
data by analyzing:
1. Product/service alignment — do the products match?
2. Territory compatibility — is the sale in a covered territory?
3. Date validity — is the sale within the contract term?
4. Customer segment — does the customer qualify?
```

---

### P032: Groq Validation Service
- **File**: `server/services/groqValidationService.ts` (line ~57)
- **When**: Pre-flight validation before sales data processing

Same structure as P031 but uses Groq for faster validation of large datasets.

---

### P033: Rule Synthesis (Expression Tree Generation)
- **File**: `server/services/ruleSynthesisService.ts` (line ~153)
- **When**: Converting extracted rules into executable FormulaNode expression trees

```
Convert this extracted entity into a FormulaNode expression tree.

Available types: percentage, fixed, tier, conditional, arithmetic, 
minimum, maximum.
```

---

### P034: Zero-Shot Entity Extraction
- **File**: `server/services/zeroShotExtractionService.ts` (line ~20)
- **When**: Initial contract parsing before type-specific prompts

```
System: You are an expert contract analysis AI. Always respond with valid JSON.
```

---

### P035: Extraction Validation
- **File**: `server/services/zeroShotExtractionService.ts` (line ~223)
- **When**: After extraction, validates accuracy of AI output

```
You are a contract validation expert. Review this AI-extracted data and 
verify its accuracy against the original contract text.
```

---

## Layer 10 — Sanitization & Post-Processing

### P036: sanitizeExtractedRules (Code-Based, Not a Prompt)
- **File**: `server/services/groqService.ts` (line ~2696)
- **Function**: `sanitizeExtractedRules()`
- **When**: After EVERY rule extraction call, before saving to database
- **Type**: Code-based post-processing (not an AI prompt)

**What it does:**
1. **Filters** rules missing `ruleType`
2. **Normalizes types**: `fixed_price` → `fixed_fee`
3. **Reclassifies misidentified rules**:
   - `fixed_fee` with "late payment" keywords → `late_payment_penalty`
   - `condition`/`data-only` with "payment due" keywords → `payment_schedule`
4. **Enriches empty fields**:
   - Empty `description` → populated from `sourceSpan.text` (up to 500 chars)
   - Empty `productCategories` → defaults to `["General"]`
   - `conditions.timeperiod` → mapped to standardized `aggregationPeriod`
   - Empty `clauseCategory` → defaults to `"general"`
5. **Plant/Nursery auto-detection**: Converts incorrectly formatted tiers to `container_size_tiered`
6. **Hallucination correction**: Detects and removes volume thresholds copied between rules

---

### Clause Category Assignment

When the AI assigns `clauseCategory` to each rule, these categories drive the **tab navigation** on the Rules Management page:

| Category | What Creates This Tab | Example Rules |
|----------|----------------------|---------------|
| `pricing` | Pricing sections, MAP policies, rate structures | Base royalty rate, pricing tier schedule |
| `rebate` | Volume rebate programs, tier schedules | Quarterly rebate, growth bonus |
| `territory` | Geographic definitions and restrictions | Territory-specific premiums |
| `compliance` | Reporting requirements, audit rights | Quarterly reporting obligation |
| `general` | Term duration, termination, dispute resolution | Contract term, governing law |
| `payment` | Payment terms and schedules | Net 30 terms, late payment penalty |
| `product` | Product definitions and coverage | Product category definitions |
| `customer_segment` | Distributor/reseller appointment terms | Enterprise tier pricing |

These categories populate tabs like **"Pricing & Rates 9"**, **"Rebate Programs 10"**, etc. on the rules page.

---

## Prompt Configuration System

### Database-Stored Prompts

LicenseIQ supports **editable AI prompts** stored in the database, allowing administrators to customize extraction behavior without code changes.

#### System-Level Settings
- **Table**: `system_settings`
- **Fields**: `ai_provider`, `ai_model`, `temperature`, `max_tokens`, `extraction_prompts` (JSONB)
- **UI**: Settings → AI Configuration

#### Contract-Type-Level Settings
- **Table**: `contract_type_definitions`
- **Fields**: `extraction_prompt`, `rule_extraction_prompt`, `rag_rule_extraction_prompt`
- **UI**: Settings → Contract Types → Edit Prompts

#### How Custom Prompts Override Defaults
1. System checks `contract_type_definitions` for matching contract type
2. If custom prompt exists → uses it
3. If no custom prompt → falls back to `defaultContractTypePrompts.ts`
4. The `groqService` merges custom prompts with system-level settings

```
Priority: Contract Type Custom Prompt > System Settings Prompt > Default Hardcoded Prompt
```

### Frontend Configuration
- **Page**: System Settings (`client/src/pages/system-settings.tsx`)
- **Section**: "AI Prompts" tab
- Allows editing extraction prompts, rule extraction prompts, and ERP mapping prompts per contract type
- Changes take effect immediately on the next contract processing run

---

## AI Provider Routing

### How Provider Selection Works
- **File**: `server/services/aiProviderService.ts`
- **Configuration**: `system_settings.ai_provider` in database
- **UI**: Settings → AI Configuration → Provider dropdown

| Setting | Routes To | Best For |
|---------|-----------|----------|
| `anthropic` | Claude Sonnet 4.5 | Deep analysis, rich formulas, complex reasoning |
| `groq` | LLaMA 3.3 70B | Fast extraction, high throughput |
| `openai` | GPT-4o | Fallback, specialized tasks |

### Automatic Fallback Chain
If the primary provider fails, the system automatically retries with fallback providers:
```
Anthropic Claude → Groq LLaMA → OpenAI GPT (last resort)
```

### Model Configuration
| Parameter | Default | Configurable Via |
|-----------|---------|-----------------|
| Provider | `anthropic` | System Settings UI |
| Model | `claude-sonnet-4-5` | System Settings UI |
| Temperature | `0.1` (extraction) / `0.7` (chat) | Per-call in code |
| Max Tokens | `4096` (extraction) / `1024` (chat) | System Settings UI |

---

## Summary: Complete Prompt Flow During Contract Processing

```
1. UPLOAD CONTRACT (PDF/Text)
   └─ P034: Zero-Shot Entity Extraction (initial parse)

2. FAST PATH — Rule Extraction
   ├─ P003/P004: Main Rule Extraction (single or chunked)
   ├─ P006/P007/P008: Contract-Type-Specific additions
   ├─ P009: Plant/Nursery additions (if applicable)
   └─ P036: Sanitization (code-based cleanup)

3. DEFERRED BACKGROUND TASKS
   ├─ P001: Comprehensive Contract Analysis
   ├─ P010: Rich Formula Generation
   ├─ P027: ERP Vocabulary Mapping
   └─ P030: Payment Terms Extraction

4. ON-DEMAND (User-Triggered)
   ├─ P011-P020: Analysis sections (summary, risk, insights, etc.)
   ├─ P022/P023: RAG Q&A (liQ AI)
   └─ P029: Table field detection

5. ERP INTEGRATION (User-Triggered)
   ├─ P024: Schema mapping generation
   ├─ P025: Entity matching
   └─ P026: Field-level mapping

6. VALIDATION
   ├─ P031/P032: Contract-sales matching
   ├─ P033: Rule synthesis to expression trees
   └─ P035: Extraction validation
```

---

*Last updated: March 2026*
*LicenseIQ Research Platform — by CimpleIT*
