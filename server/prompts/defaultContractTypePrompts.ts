export const DEFAULT_EXTRACTION_PROMPTS: Record<string, {
  // Legacy mode prompts (full document processing)
  extractionPrompt: string;
  ruleExtractionPrompt: string;
  erpMappingPrompt: string;
  sampleExtractionOutput: string;
  // RAG mode prompts (chunk-based with mandatory citations)
  ragExtractionPrompt?: string;
  ragRuleExtractionPrompt?: string;
  ragSampleExtractionOutput?: string;
}> = {
  'direct_sales': {
    extractionPrompt: `You are a contract analysis AI specializing in Channel Reseller and Commission Agreements. Extract all parties, dates, territories, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "Effective Date:", "effective as of", "commencing on", "Term:", "Initial term"

Focus on:
- Company and Channel Partner/Reseller identification (names, addresses, EINs)
- Deal Registration process and approval criteria
- Territory assignments (North America, EMEA, APAC, etc.)
- Partner tiers and certification levels
- Performance metrics and quotas
- Term length (e.g., "two (2) years") and renewal provisions

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL commission and payment rules from this Channel Reseller/Commission Agreement.

**CRITICAL - MULTI-YEAR COMMISSION STRUCTURES**:
When you see commissions that vary by year (Year 1, Year 2, Year 3), extract each year as a separate tier.

Look for:
- REGISTERED DEAL commissions (partner-originated opportunities)
  - Year 1 Subscription Fees: typically 10-15%
  - Year 2 Subscription Fees: typically 6-10%
  - Year 3+ Subscription Fees: typically 3-5%
- INFLUENCED DEAL commissions (partner-assisted but not originated)
  - Lower rates than registered deals
- RENEWAL commissions (ongoing customer renewals)
  - Partner of Record commissions
- PERFORMANCE BONUSES
  - Quarterly ARR thresholds (e.g., $500K New ARR triggers bonus)
  - Bonus commission percentages (additional 1-3%)
- CHARGEBACK provisions
  - Customer non-payment clawbacks
  - Refund handling
- Net Subscription Fee calculations

**EXTRACT EACH COMMISSION TYPE SEPARATELY** - Registered, Influenced, and Renewal should be separate rules.

**RULE PRIORITY**: Assign lower priority numbers (1-3) to specific rules (e.g., "Registered Deal - Year 1") and higher numbers (7-10) to generic/fallback rules.

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence, priority.`,
    
    erpMappingPrompt: `Map Channel Reseller/Commission terms to ERP system fields.
Common mappings: 
- Partner → PARTNER_ID
- Deal Type → DEAL_TYPE_CODE (Registered/Influenced/Renewal)
- Subscription ARR → SUBSCRIPTION_ARR
- Commission Rate → COMMISSION_PCT
- Year → CONTRACT_YEAR
- Bonus Threshold → BONUS_THRESHOLD`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "distribution",
    "contractTitle": "Channel Reseller & Commission Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "Vontair Mobility Systems, Inc.", "role": "Company"},
      "party2": {"name": "AlphaChannel Solutions Ltd.", "role": "Partner"}
    }
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Registered Deal Commission",
      "calculation": {
        "tiers": [
          {"year": 1, "rate": 12.0},
          {"year": 2, "rate": 8.0},
          {"year": 3, "rate": 4.0}
        ]
      },
      "confidence": 0.95
    },
    {
      "ruleType": "percentage",
      "ruleName": "Performance Bonus",
      "calculation": {"rate": 2.0, "threshold": 500000},
      "conditions": {"quarterlyNewARR": ">=500000"},
      "confidence": 0.92
    }
  ]
}`,

    // RAG Mode Prompts (chunk-based with mandatory citations)
    ragExtractionPrompt: `You are extracting contract entities from DOCUMENT CHUNKS (not the full document).

CRITICAL RAG RULES:
1. Extract ONLY from the provided chunks - do NOT infer missing information
2. Include MANDATORY source citations with exact quotes (max 30 chars)
3. If information is not in these chunks, mark as null

Extract: parties, dates, territories, key terms. Include sourceSpan for each extracted value.`,

    ragRuleExtractionPrompt: `Extract ALL payment/commission rules from these CONTRACT CHUNKS.

CRITICAL RAG EXTRACTION RULES:
1. Extract ONLY values that appear in the provided text
2. MANDATORY: Include sourceSpan with exact quote (max 30 chars)
3. Extract caps, minimums, thresholds as SEPARATE rules
4. Never invent or hallucinate values

RULE TYPES:
- percentage: Commission rates (e.g., "12% for Year 1")
- tiered: Year-based or volume-based tiers
- minimum_guarantee: Minimum payment amounts
- cap: Maximum payment limits
- fixed_fee: One-time or annual fees

OUTPUT FORMAT:
{"rules":[
  {"ruleType":"percentage","ruleName":"Registered Deal Year 1","calculation":{"rate":0.12},"sourceSpan":{"text":"12% commission","page":3},"confidence":0.95}
]}`,

    ragSampleExtractionOutput: `{
  "rules": [
    {"ruleType": "percentage", "ruleName": "Registered Deal Year 1", "calculation": {"rate": 0.12}, "sourceSpan": {"text": "12% commission", "page": 3}, "confidence": 0.95},
    {"ruleType": "cap", "ruleName": "Annual Commission Cap", "calculation": {"amount": 100000}, "sourceSpan": {"text": "$100,000 cap", "page": 5}, "confidence": 0.90}
  ]
}`
  },

  'distributor': {
    extractionPrompt: `You are a contract analysis AI specializing in Distributor Agreements. Extract all parties, dates, territories, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "Effective Date:", "entered into as of", "Initial term is X years"

Focus on:
- Manufacturer and Distributor identification (company names, addresses, states)
- Exclusive vs Non-exclusive appointment
- Territory assignments with specific states/regions (e.g., "Northeast Region: MA, CT, RI, NH, VT, ME")
- Product lines and categories covered
- Price protection terms
- Sales reporting requirements (POS data)
- Audit rights and frequency
- Term length (e.g., "three years") and renewal provisions

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL pricing, discount, rebate, and payment rules from this Distributor Agreement.

**CRITICAL - VOLUME REBATE PROGRAMS**:
Extract ALL tiers from rebate tables. When you see annual sales ranges, extract each range as a tier.

Look for:
- STANDARD DISTRIBUTOR DISCOUNT off List Price (e.g., 20% off)
- PRICE FLOOR restrictions (e.g., "cannot resell below 75% of List Price")
- VOLUME REBATE TIERS based on Net Eligible Sales:
  - $0 – $999,999: X%
  - $1,000,000 – $2,499,999: X%
  - $2,500,000 – $4,999,999: X%
  - $5,000,000+: X%
- MARKET DEVELOPMENT FUNDS (MDF)
  - Percentage of annual net eligible sales (e.g., 1.5%)
  - Claim submission deadlines (e.g., 90 days)
- PRICE PROTECTION on inventory (e.g., 60 days prior to price reduction)
- CHARGEBACK formulas: (Old List Price – New List Price) × Eligible Units
- Payment terms (Net 30, Net 45, etc.)
- Territory eligibility restrictions

**EXTRACT ALL REBATE TIERS** - If there are 4 tiers, create 4 tier entries.

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence.`,
    
    erpMappingPrompt: `Map Distributor Agreement terms to ERP fields.
Common mappings: 
- Distributor → CUSTOMER_ID
- Territory → REGION_CODE
- List Price → LIST_PRICE
- Discount → DISCOUNT_PCT
- Net Eligible Sales → NET_SALES
- Rebate Tier → REBATE_TIER
- MDF Allocation → MDF_AMOUNT
- Chargeback → CHARGEBACK_AMOUNT`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "distribution",
    "contractTitle": "Sample Distributor Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "ABC Manufacturing, Inc.", "role": "Manufacturer"},
      "party2": {"name": "XYZ Distribution LLC", "role": "Distributor"}
    },
    "territory": "United States – Northeast Region (MA, CT, RI, NH, VT, ME)"
  },
  "rules": [
    {
      "ruleType": "percentage",
      "ruleName": "Standard Distributor Discount",
      "calculation": {"rate": 20.0, "basis": "list_price"},
      "confidence": 0.95
    },
    {
      "ruleType": "tiered",
      "ruleName": "Annual Volume Rebate Program",
      "calculation": {
        "tiers": [
          {"min": 0, "max": 999999, "rate": 0.0},
          {"min": 1000000, "max": 2499999, "rate": 2.0},
          {"min": 2500000, "max": 4999999, "rate": 4.0},
          {"min": 5000000, "rate": 6.0}
        ]
      },
      "confidence": 0.92
    },
    {
      "ruleType": "percentage",
      "ruleName": "Market Development Funds",
      "calculation": {"rate": 1.5, "basis": "annual_net_eligible_sales"},
      "confidence": 0.90
    }
  ]
}`,

    // RAG Mode Prompts (chunk-based with mandatory citations)
    ragExtractionPrompt: `Extract entities from these DISTRIBUTOR AGREEMENT chunks.

CRITICAL RAG RULES:
1. Extract ONLY from provided text - no inference
2. Include MANDATORY sourceSpan with exact quotes (max 30 chars)
3. Mark missing information as null

Extract: parties, territories, product categories, term dates.`,

    ragRuleExtractionPrompt: `Extract ALL distributor payment rules from these CONTRACT CHUNKS.

CRITICAL:
1. Extract ONLY values in the provided text
2. MANDATORY: Include sourceSpan with exact quote (max 30 chars)
3. For tier tables (volume bands → rate), extract as ONE "tiered" rule with ALL bands in calculation.tiers[] — do NOT create one rule per tier row
4. EVERY tier object in calculation.tiers[] MUST use exactly these keys: { "min": number, "max": number|null, "rate": number } — DO NOT use volumeThreshold, baseRate, threshold, percentage, etc. Translate the source contract's column names into these canonical keys. Use null for an unbounded top tier's max. Rates are decimals (0.05 = 5%, NOT 5).
5. Use SEPARATE rules ONLY for distinct mechanics (e.g. an MDF cap is its own "cap" rule, separate from a tiered rebate; an annual fixed fee is its own "fixed_fee" rule)
6. Never invent values

RULE TYPES:
- percentage: Discount rates, rebate rates, MDF percentages
- tiered: Volume-based rebate tiers with thresholds
- minimum_guarantee: Minimum order/payment requirements
- cap: Maximum rebate/MDF limits
- fixed_fee: Annual fees, registration fees

OUTPUT FORMAT:
{"rules":[
  {"ruleType":"tiered","ruleName":"Volume Rebate","calculation":{"tiers":[{"minValue":0,"maxValue":500000,"rate":0.02}]},"sourceSpan":{"text":"2% rebate","page":4},"confidence":0.95}
]}`,

    ragSampleExtractionOutput: `{
  "rules": [
    {"ruleType": "percentage", "ruleName": "Standard Discount", "calculation": {"rate": 0.20}, "sourceSpan": {"text": "20% discount", "page": 2}, "confidence": 0.95},
    {"ruleType": "tiered", "ruleName": "Volume Rebate", "calculation": {"tiers": [{"minValue": 0, "maxValue": 500000, "rate": 0.02}]}, "sourceSpan": {"text": "2% up to $500K", "page": 4}, "confidence": 0.90},
    {"ruleType": "cap", "ruleName": "MDF Cap", "calculation": {"amount": 25000}, "sourceSpan": {"text": "capped at $25,000", "page": 6}, "confidence": 0.88}
  ]
}`
  },

  'referral': {
    extractionPrompt: `You are a contract analysis AI specializing in Revenue Sharing and Partnership Agreements. Extract all parties, dates, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "Effective Date:", "made effective as of", "shall commence on", "Initial Term", "continue for X years"

Focus on:
- Primary company and Partner identification (names, addresses, states, EINs)
- Product/service categories covered (e.g., Analytics Module, Platform, etc.)
- Revenue categories: Contract Fees, Implementation Services, Maintenance & Support, API/Usage Fees
- Term length (e.g., "three (3) years") and auto-renewal provisions
- Minimum annual guarantees
- Reporting and audit requirements

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL revenue sharing and payment rules from this Partnership/Revenue Sharing Agreement.

**CRITICAL - MULTI-CATEGORY REVENUE SHARING**:
These agreements often have DIFFERENT revenue splits for different service categories. Extract EACH category separately.

Look for:
- CONTRACT FEE REVENUE SHARING by tier:
  - Standard tier: X% Company / Y% Partner (e.g., 60%/40%)
  - Advanced tier: X% Company / Y% Partner (e.g., 55%/45%)
  - Enterprise tier: X% Company / Y% Partner (e.g., 50%/50%)
- IMPLEMENTATION SERVICES revenue split (e.g., Partner gets 35%)
- MAINTENANCE & SUPPORT revenue split:
  - Annual billing percentage of net contract fee (e.g., 18%)
  - Revenue split (e.g., Company 70% / Partner 30%)
- API & USAGE-BASED FEES with tiered pricing:
  - Volume tiers (0-1M calls, 1M-5M calls, 5M+ calls)
  - Unit prices per API call
  - Revenue splits per tier
- MINIMUM ANNUAL GUARANTEE (e.g., Partner guaranteed $250,000/year)
- TRUE-UP provisions at year-end
- Payment terms (e.g., 45 days after quarter-end)

**EXTRACT EACH REVENUE CATEGORY AS A SEPARATE RULE**

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence.`,
    
    erpMappingPrompt: `Map Revenue Sharing/Partnership terms to ERP fields.
Common mappings: 
- Partner → PARTNER_ID
- License Tier → LICENSE_TIER
- Revenue Category → REVENUE_TYPE (License/Services/Support/Usage)
- Company Share → COMPANY_SPLIT_PCT
- Partner Share → PARTNER_SPLIT_PCT
- API Volume → API_CALL_COUNT
- Minimum Guarantee → MIN_GUARANTEE_AMT`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "service",
    "contractTitle": "Revenue Sharing & Analytics Partnership Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "Vontair Mobility Systems, Inc.", "role": "Platform Provider"},
      "party2": {"name": "PartnerCo Data Solutions LLC", "role": "Analytics Partner"}
    }
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Contract Fee Revenue Share",
      "calculation": {
        "tiers": [
          {"tier": "Standard", "annualFee": 25000, "companyShare": 60, "partnerShare": 40},
          {"tier": "Advanced", "annualFee": 40000, "companyShare": 55, "partnerShare": 45},
          {"tier": "Enterprise", "annualFee": 65000, "companyShare": 50, "partnerShare": 50}
        ]
      },
      "confidence": 0.95
    },
    {
      "ruleType": "percentage",
      "ruleName": "Implementation Services Revenue",
      "calculation": {"partnerRate": 35.0, "basis": "implementation_services_revenue"},
      "confidence": 0.92
    },
    {
      "ruleType": "usage_based",
      "ruleName": "API Usage Fees",
      "calculation": {
        "tiers": [
          {"min": 0, "max": 1000000, "unitPrice": 0.002, "companyShare": 70, "partnerShare": 30},
          {"min": 1000001, "max": 5000000, "unitPrice": 0.001, "companyShare": 65, "partnerShare": 35},
          {"min": 5000001, "unitPrice": 0.0006, "companyShare": 60, "partnerShare": 40}
        ]
      },
      "confidence": 0.90
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Minimum Annual Guarantee",
      "calculation": {"amount": 250000, "period": "annual"},
      "confidence": 0.95
    }
  ]
}`
  },

  'royalty_license': {
    extractionPrompt: `You are a contract analysis AI specializing in Royalty, License, and Patent Agreements. Extract all parties, dates, territories, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "Effective Date:", "commencing on", "License Agreement No:", header dates, "Initial term of X years"
EXAMPLE: "Effective Date: February 12, 2024" → effectiveDate: "2024-02-12"
EXAMPLE: "Initial term of eight (8) years commencing February 12, 2024" → effectiveDate: "2024-02-12", expirationDate: "2032-02-12"

Focus on:
- Licensor and Licensee identification (company names, addresses, EINs, FDA/DEA registrations if applicable)
- Licensed IP: Patents (US, EU, PCT numbers), Trade Secrets, Drug compounds, Plant varieties, Manufacturing processes
- Territory grants (exclusive/non-exclusive by region)
- Field of use restrictions (Automotive, Aerospace, Pharmaceutical, Agricultural, etc.)
- Term length (e.g., "eight (8) years", "fifteen (15) years") and renewal options
- Quality control and certification requirements
- Regulatory compliance (FDA, cGMP, ISO, etc.)

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL royalty, contract fee, and payment rules from this Licensing Agreement.

**CRITICAL - IDENTIFY CONTRACT TYPE FIRST**:
Before extracting rules, identify the contract type to determine the correct royalty basis:

1. **ELECTRONICS/COMPONENT/PATENT LICENSES** (Multiple pricing models):
   - Keywords: "component", "semiconductor", "chipset", "processor", "per unit", "ASP", "premium multiplier"
   - May have MULTIPLE tier types in same contract (per-unit, ASP-based, premium multipliers)
   - Extract EACH tier as separate rules with appropriate structure

2. **MANUFACTURING/TECHNOLOGY LICENSES** (Net Sales % basis):
   - Keywords: "Net Sales", "percentage of revenue", "Industrial", "Manufacturing", "Technology License"
   - Royalties = Net Sales × Percentage Rate (e.g., 6.5% of $10M = $650,000)
   - Extract rates as DECIMALS (6.5% = 0.065)
   - Set basis: "net_sales" in tier data
   - CRITICAL: Include Minimum Annual Fee for each tier!
   - CRITICAL: Tiers are based on DOLLAR thresholds (Net Sales $), NOT unit quantities!
   - NEVER fabricate per-unit dollar rates - use ONLY percentages from contract!

3. **PLANT/NURSERY/AGRICULTURE LICENSES** (Per-Unit $ basis):
   - Keywords: "per plant", "container size", "gallon", "liner", "plug", "variety", "premium", "patented"
   - Royalties = Units Sold × Dollar Rate
   - Extract rates as DOLLAR AMOUNTS
   - Set basis: "units" or "volume" in tier data
   - **CRITICAL: ALWAYS extract "Minimum Annual" or "Min Annual Royalty" column into minimumAnnual field for EACH tier!**
   - **CRITICAL: ALWAYS extract Premium Royalty clauses separately!**
   - Premium varieties have HIGHER rates (multiplier or fixed premium amount)
   - Look for: "Premium", "Patented", "Exclusive", "Select", "Elite" designations
   - Extract premium definition, rates, conditions, effective dates, and exceptions

**PLANT/NURSERY VOLUME TIERED WITH MINIMUM ANNUAL ROYALTY**:
Use ruleType: "tiered" for per-unit volume tiers with minimum annual payments.
Example table from contract:
  | Volume (Annual) | Fee Rate | Minimum Annual |
  | 1 - 2,500      | $2.25/unit   | $8,500         |
  | 2,501 - 7,500  | $1.95/unit   | $12,000        |
  | 7,501 - 15,000 | $1.70/unit   | $18,500        |
  | 15,001+        | $1.45/unit   | $25,000        |
Extract as:
  {
    "ruleType": "tiered",
    "ruleName": "Tier 3 - Flowering Shrubs",
    "calculation": {
      "tiers": [
        {"min": 1, "max": 2500, "rate": 2.25, "minimumAnnual": 8500, "basis": "volume"},
        {"min": 2501, "max": 7500, "rate": 1.95, "minimumAnnual": 12000, "basis": "volume"},
        {"min": 7501, "max": 15000, "rate": 1.70, "minimumAnnual": 18500, "basis": "volume"},
        {"min": 15001, "max": null, "rate": 1.45, "minimumAnnual": 25000, "basis": "volume"}
      ],
      "tierMethod": "bracket",
      "formula": "fee = MAX(units × rate, minimumAnnual)"
    }
  }
CRITICAL: Extract the "Minimum Annual" column value into minimumAnnual field for EACH tier!
CRITICAL: If table has "Minimum" or "Min Annual Royalty" column, extract those values!

**ELECTRONICS TIER 1 - COMPONENT PRICING WITH VOLUME DISCOUNTS**:
For per-unit component pricing with volume thresholds and discount rates:
- Use ruleType: "component_tiered"
- Extract BOTH baseRate AND discountedRate for each component
- Include volumeThreshold that triggers the discount
- basis: "units" (per-unit pricing)
Example from contract:
  "ARM-Compatible Processors: $3.25/unit, 1M+ units/year → $2.85"
  "Power Management ICs: $1.75/unit, 2M+ units/year → $1.45"
Extract as:
  {
    "ruleType": "component_tiered",
    "ruleName": "Tier 1 - ARM-Compatible Processors",
    "calculation": {
      "baseRate": 3.25,
      "volumeThreshold": 1000000,
      "discountedRate": 2.85,
      "basis": "units",
      "formula": "IF units >= 1,000,000 THEN units × $2.85 ELSE units × $3.25"
    }
  }
CRITICAL: Extract EXACT dollar values from contract - do NOT round or convert!

**ELECTRONICS TIER 2 - ASP-BASED PERCENTAGE RATES WITH MIN/MAX**:
For percentage-of-ASP pricing with minimum and maximum per-unit caps:
- Use ruleType: "asp_percentage"
- Extract rate as DECIMAL (2.5% = 0.025), NOT as dollar amount
- Include minPerUnit and maxPerUnit caps
- basis: "asp" (Average Selling Price)
Example from contract:
  "Tablets: 2.5% of ASP, Min $3.50, Max $15.00"
  "Laptops: 1.8% of ASP, Min $8.00, Max $35.00"
Extract as:
  {
    "ruleType": "asp_percentage",
    "ruleName": "Tier 2 - Tablets and E-Readers",
    "calculation": {
      "rate": 0.025,
      "minPerUnit": 3.50,
      "maxPerUnit": 15.00,
      "basis": "asp",
      "formula": "MIN(MAX(ASP × 2.5%, $3.50), $15.00) per unit"
    }
  }
CRITICAL: 2.5% = 0.025 (decimal), NOT $2.50 (dollar amount)!

**ELECTRONICS TIER 3 - PREMIUM MULTIPLIERS**:
For specialized applications with base rate × premium multiplier:
- Use ruleType: "premium_multiplier"
- Extract ALL THREE values: baseRate, premiumMultiplier, effectiveRate
- Show complete formula: Base × Multiplier = Effective
- basis: "net_sales" (typically percentage of revenue)
Example from contract:
  "Automotive: 2.5% base × 1.15x = 2.875%"
  "Medical: 2.5% base × 1.25x = 3.125%"
Extract as:
  {
    "ruleType": "premium_multiplier",
    "ruleName": "Tier 3 - Automotive Electronics",
    "calculation": {
      "baseRate": 0.025,
      "premiumMultiplier": 1.15,
      "effectiveRate": 0.02875,
      "basis": "net_sales",
      "formula": "Net Sales × 2.5% × 1.15 = Net Sales × 2.875%"
    }
  }
CRITICAL: Preserve FULL precision (0.02875, NOT 2.88)! Show base rate AND multiplier!

**MANUFACTURING/TECHNOLOGY TIER 1 - NET SALES PERCENTAGE WITH MINIMUM ANNUAL ROYALTY**:
Use ruleType: "net_sales_tiered"
For contracts specifying "X% of Net Sales" with Minimum Annual Fee:
- Extract ALL tiers including open-ended "above" tiers
- Tiers are based on ANNUAL NET SALES (DOLLAR thresholds), NOT unit quantities!
- Each tier MUST include: min, max (or null), rate (as decimal), minimumAnnual, basis: "net_sales"
- Final fee = MAX(calculated fee, minimum annual royalty)
Example from contract:
  "Tier 1 - Automotive Components:
   $0 - $5,000,000: 6.5% (Min $125,000)
   $5,000,001 - $15,000,000: 5.8% (Min $200,000)
   $15,000,001 - $50,000,000: 5.2% (Min $350,000)
   Above $50,000,000: 4.8% (Min $500,000)"
Extract as ONE rule with multiple tiers:
  {
    "ruleType": "net_sales_tiered",
    "ruleName": "Tier 1 - Automotive Components",
    "description": "Net Sales percentage royalty with minimum annual guarantee",
    "calculation": {
      "tiers": [
        {"min": 0, "max": 5000000, "rate": 0.065, "minimumAnnual": 125000, "basis": "net_sales"},
        {"min": 5000001, "max": 15000000, "rate": 0.058, "minimumAnnual": 200000, "basis": "net_sales"},
        {"min": 15000001, "max": 50000000, "rate": 0.052, "minimumAnnual": 350000, "basis": "net_sales"},
        {"min": 50000001, "rate": 0.048, "minimumAnnual": 500000, "basis": "net_sales"}
      ],
      "tierMethod": "bracket",
      "formula": "fee = MAX(netSales × rate, minimumAnnualRoyalty)"
    },
    "conditions": {
      "productCategories": ["Automotive Components"]
    }
  }
CRITICAL: 
- Extract MINIMUM ANNUAL ROYALTY for EACH tier!
- Thresholds are NET SALES DOLLARS ($0-$5M, $5M-$15M, etc.), NOT unit quantities!
- NEVER convert percentages to per-unit dollar amounts!
- Create ONE rule per product category tier (avoid duplicates)!

**MANUFACTURING/TECHNOLOGY TIER 2 - CATEGORY-BASED PERCENTAGES**:
Use ruleType: "category_percentage"
For contracts with CATEGORY-based royalties (NOT volume-based):
- Categories are PRODUCT TYPES (Industrial, Aerospace, Custom), NOT quantity ranges!
- Extract rate as PERCENTAGE (decimal), plus any additional fixed fees
- Include premium multiplier if specified
Example from contract:
  "Tier 2 - Industrial & Aerospace Components:
   All Industrial Applications: 7.2%
   Aerospace/High-Performance: 8.5% (1.18x Base Rate)
   Custom Engineering Projects: 9.8% plus $15,000 engineering fee"
Extract as SEPARATE rules per category:
  {
    "ruleType": "category_percentage",
    "ruleName": "Industrial Applications Royalty",
    "calculation": {
      "rate": 0.072,
      "basis": "net_sales",
      "formula": "fee = netSales × 7.2%"
    },
    "conditions": {
      "productCategories": ["Industrial Applications", "Industrial Machinery"]
    }
  },
  {
    "ruleType": "category_percentage",
    "ruleName": "Aerospace High-Performance Royalty",
    "calculation": {
      "rate": 0.085,
      "premiumMultiplier": 1.18,
      "basis": "net_sales",
      "formula": "fee = netSales × 8.5% (1.18x base rate)"
    },
    "conditions": {
      "productCategories": ["Aerospace", "High-Performance"]
    }
  },
  {
    "ruleType": "category_percentage",
    "ruleName": "Custom Engineering Projects Royalty",
    "calculation": {
      "rate": 0.098,
      "additionalFee": 15000,
      "basis": "net_sales",
      "formula": "fee = (netSales × 9.8%) + $15,000 engineering fee"
    },
    "conditions": {
      "productCategories": ["Custom Engineering Projects"]
    }
  }
CRITICAL:
- Categories are LABELS (Industrial, Aerospace, Custom), NOT numeric quantities!
- NEVER create quantity-based logic like "quantity <= Industrial"!
- Include fixed fees (e.g., $15,000 engineering fee) in additionalFee field!

**MILESTONE PAYMENTS**:
Use ruleType: "milestone_payment"
For one-time fixed payments triggered by events:
- Milestones are FIXED DOLLAR AMOUNTS, NOT per-unit rates!
- NEVER convert milestone payments to per-unit rates ($0.00/unit is WRONG)!
- Extract ALL milestone rows from the table into a SINGLE rule with milestones array!

Example from contract:
  "Milestone Payments:
   | Milestone Event | Payment Amount | Due Date |
   | First Commercial Production | $150,000 | Within 30 days of achievement |
   | $10M Cumulative Net Sales | $200,000 | Within 60 days of achievement |
   | $50M Cumulative Net Sales | $350,000 | Within 60 days of achievement |
   | Market Leadership Achievement* | $500,000 | Annual review basis |
   *Market Leadership defined as >25% market share..."

Extract as SINGLE rule with ALL milestones in array:
  {
    "ruleType": "milestone_payment",
    "ruleName": "Milestone Payments",
    "milestones": [
      { "event": "First Commercial Production", "amount": 150000, "dueDate": "Within 30 days of achievement" },
      { "event": "$10M Cumulative Net Sales", "amount": 200000, "dueDate": "Within 60 days of achievement" },
      { "event": "$50M Cumulative Net Sales", "amount": 350000, "dueDate": "Within 60 days of achievement" },
      { "event": "Market Leadership Achievement*", "amount": 500000, "dueDate": "Annual review basis" }
    ],
    "notes": "*Market Leadership defined as >25% market share in defined automotive transmission component segment",
    "calculation": {
      "basis": "milestone",
      "formula": "One-time payments upon achievement of specified milestones"
    }
  }
CRITICAL:
- Extract ALL milestone rows - count them first and ensure every row is in the milestones array!
- Milestone payments are FIXED AMOUNTS, never $0!
- NEVER calculate milestone as quantity × $0.00/unit!
- Include notes/definitions (marked with *) from below the table in the notes field!

**CATEGORY-BASED RATES** (NOT volume tiers):
Some contracts have FLAT percentage rates by product CATEGORY:
- Use productCategories condition to specify which category applies

**FIXED FEES IN ADDITION TO PERCENTAGES**:
Some categories have BOTH a percentage AND a fixed fee:
- Extract as: rate: 0.098, additionalFee: 15000
- NEVER ignore the fixed fee component

**MINIMUM ANNUAL GUARANTEES**:
Many contracts require minimum fee payments regardless of sales:
- Extract as separate rule with ruleType: "minimum_guarantee" OR
- Include minimumAnnual in each tier definition



CRITICAL FOR PLANT VARIETY TABLES:
- Extract EVERY column from the table, not just base rate!
- premiumMultiplier: The multiplier value (1.0x, 1.2x, 1.3x, 1.5x)
- premiumDescription: What qualifies for premium (e.g., "premium roses", "specimen grade")
- premiumRate: baseRate × premiumMultiplier (calculated)
- seasonalAdjustment: The percentage (+15% = 0.15, -5% = -0.05, Standard = 0)
- seasonalType: "add", "subtract", or "none"
- seasonalDescription: Full text from contract ("+15% spring season")

DO NOT create separate premium_variety rules if premium is in the container size table!
The premium multiplier is PER CONTAINER SIZE, extract it inline!

**PER-UNIT VOLUME TIERS** (Plant/Nursery contracts):
For tiered per-unit pricing based on quantity sold:
- Extract rates as DOLLAR AMOUNTS with basis: "units"
Extract as:
  tiers: [
    {"min": 0, "max": 50000, "rate": 3.50, "basis": "units"},
    {"min": 50001, "max": 150000, "rate": 3.00, "basis": "units"}
  ]

**PREMIUM ROYALTY RULES** (Plant/Nursery contracts):
**CRITICAL - PREMIUM ROYALTY EXTRACTION FOR PLANT/NURSERY CONTRACTS**:
This is MANDATORY for all plant variety contracts. Premium royalty clauses MUST be extracted as a SEPARATE rule.

**STEP 1: Identify Premium Indicators in Contract**
Look for ANY of these terms/phrases:
- "Premium", "Premium Variety", "Premium Rate", "Premium Royalty"
- "Patented", "Patented Variety", "Patent Protected"
- "Exclusive", "Select", "Elite", "Specialty"
- "Enhanced", "Improved", "New Release", "Introductory"
- "Higher royalty", "Additional royalty", "Surcharge"
- Multiplier language: "×1.25", "1.5x", "25% premium", "50% above base"
- Fixed premium: "$0.50 additional", "plus $0.75 per unit"

**STEP 2: Extract Premium Rule Details**
Use ruleType: "premium_variety"
Extract ALL of the following:

1. **Premium Definition**: What qualifies a product as premium?
   - Named varieties list (e.g., "Aurora Flame Maple, Pacific Sunset Rose")
   - Category criteria (e.g., "All patented varieties", "New releases within 3 years")
   - Any exclusions or exceptions

2. **Premium Rate Structure**: How is premium calculated?
   - premiumMultiplier: Multiplier on base rate (e.g., 1.25 for 25% premium)
   - OR premiumAdditional: Fixed dollar amount added (e.g., $0.50 per unit)
   - effectiveRate: Final rate for premium products (baseRate × multiplier OR baseRate + additional)

3. **Premium Conditions**: When does premium apply?
   - Effective dates (start/end dates for premium pricing)
   - Territory restrictions
   - Minimum quantities
   - Customer type restrictions

4. **Premium Exceptions**: When does premium NOT apply?
   - Volume discounts that reduce premium
   - Specific customer exemptions
   - Promotional periods

**STEP 3: Create Premium Variety Rule**
Extract as SEPARATE rule from base container/volume rules:
  {
    "ruleType": "premium_variety",
    "ruleName": "Premium Variety Royalty",
    "description": "Premium rate for designated premium/patented varieties",
    "calculation": {
      "baseRate": 1.25,
      "premiumMultiplier": 1.25,
      "premiumAdditional": null,
      "effectiveRate": 1.5625,
      "basis": "units",
      "formula": "IF product is Premium THEN units × baseRate × 1.25 ELSE units × baseRate"
    },
    "conditions": {
      "premiumDefinition": "Patented varieties and new releases within 3 years of introduction",
      "premiumVarieties": ["Aurora Flame Maple", "Pacific Sunset Rose", "Crimson Glory Oak"],
      "effectiveStartDate": "2024-01-01",
      "effectiveEndDate": null,
      "exceptions": "Volume discounts still apply to premium rate"
    },
    "confidence": 0.90
  }

**EXAMPLE CONTRACT TEXT AND EXTRACTION**:
Contract says:
  "Standard Fee: $1.25 per plant
   Premium Varieties (Aurora Flame, Pacific Sunset, Crimson Glory): 
   Standard Rate × 1.25 (25% premium)
   Premium designation applies to all patented varieties introduced after 2020.
   Premium rates effective January 1, 2024 through December 31, 2026."

Extract TWO rules:
1. Base container/volume rule with rate $1.25
2. Premium variety rule with:
   - baseRate: 1.25
   - premiumMultiplier: 1.25
   - effectiveRate: 1.5625 ($1.25 × 1.25)
   - premiumVarieties: ["Aurora Flame", "Pacific Sunset", "Crimson Glory"]
   - premiumDefinition: "All patented varieties introduced after 2020"
   - effectiveStartDate: "2024-01-01"
   - effectiveEndDate: "2026-12-31"

**COMMON PREMIUM EXTRACTION ERRORS TO AVOID**:
❌ WRONG: Only extracting base rate, ignoring premium clauses
❌ WRONG: Merging premium into base rule instead of separate rule
❌ WRONG: Missing premium multiplier (using 1.0 or null)
❌ WRONG: Not extracting premium variety names list
❌ WRONG: Missing effective dates for premium pricing
✅ CORRECT: Extract premium as SEPARATE "premium_variety" rule
✅ CORRECT: Include ALL premium varieties by name
✅ CORRECT: Calculate correct effectiveRate (base × multiplier)
✅ CORRECT: Include premium definition criteria
✅ CORRECT: Include effective dates and exceptions

When contract specifies "Premium" designation with a multiplier on base rate:
- Use ruleType: "premium_variety"
- Extract baseRate (standard rate), premiumMultiplier, and effectiveRate
- Include list of premium variety names in productCategories
Example from contract:
  "Premium Varieties: Aurora Flame Maple, Pacific Sunset Rose"
  "Premium Rate: Base Rate × 1.25 (25% premium)"
Extract as:
  {
    "ruleType": "premium_variety",
    "ruleName": "Premium Variety Royalty",
    "description": "25% premium on designated premium varieties",
    "calculation": {
      "baseRate": 1.25,
      "premiumMultiplier": 1.25,
      "effectiveRate": 1.5625,
      "basis": "units",
      "formula": "IF product is Premium THEN units × baseRate × 1.25 ELSE units × baseRate"
    },
    "conditions": {
      "productCategories": ["Aurora Flame Maple", "Pacific Sunset Rose"],
      "isPremium": true,
      "description": "Applies to designated premium varieties only"
    }
  }
CRITICAL: Include ALL premium variety names in productCategories!

**SEASONAL ADJUSTMENT RULES** (Plant/Nursery contracts):
CRITICAL - Extract seasonal rate adjustments!
When contract specifies seasonal pricing (Spring, Summer, Fall, Winter):
- Use ruleType: "seasonal_adjustment"
- Extract season, adjustmentType (add/subtract), adjustmentValue (percentage as decimal)
- Include dateRange if specified (e.g., March 1 - May 31)
Example from contract:
  "Spring Adjustment: Add 10% to normal fee rate"
  "Spring Season: March 1 through May 31"
Extract as:
  {
    "ruleType": "seasonal_adjustment",
    "ruleName": "Spring Season Adjustment",
    "description": "10% premium during spring growing season",
    "calculation": {
      "adjustmentType": "add",
      "adjustmentValue": 0.10,
      "basis": "percentage",
      "formula": "IF season == Spring THEN fee = baseRoyalty × 1.10"
    },
    "conditions": {
      "season": "Spring",
      "dateRange": {"start": "03-01", "end": "05-31"},
      "description": "Applies March 1 through May 31"
    }
  }
CRITICAL: Extract ALL seasonal adjustments (Spring, Summer, Fall, Winter if present)!

**MINIMUM GUARANTEE RULES** (Plant/Nursery contracts):
CRITICAL - Extract minimum guarantee amounts by tier!
When contract specifies minimum fee regardless of actual sales:
- Use ruleType: "minimum_guarantee"
- Extract tier, minimumAmount, period (annual/quarterly), and applicable products
Example from contract:
  "Tier 3 Minimum Guarantee: $5,000 per variety annually"
  "Tier 3 includes: Cascade Blue Hydrangea, Silver Mist Lavender"
Extract as:
  {
    "ruleType": "minimum_guarantee",
    "ruleName": "Tier 3 Minimum Guarantee",
    "description": "Minimum $5,000 annual royalty per Tier 3 variety",
    "calculation": {
      "minimumAmount": 5000,
      "period": "annual",
      "perProduct": true,
      "basis": "minimum",
      "formula": "MAX(calculatedRoyalty, $5,000) per variety"
    },
    "conditions": {
      "tier": 3,
      "productCategories": ["Cascade Blue Hydrangea", "Silver Mist Lavender"],
      "description": "Applies to all Tier 3 products"
    }
  }
CRITICAL: Extract minimum guarantee for EACH tier that has one! Include ALL product names!

Look for:
- COMPONENT PRICING with volume discount thresholds
- ASP-BASED PERCENTAGE with min/max per-unit caps
- PREMIUM MULTIPLIERS (base × multiplier = effective)
- PREMIUM VARIETY designations (plants with premium rate multipliers)
- SEASONAL ADJUSTMENTS (Spring/Summer/Fall/Winter rate modifications)
- MINIMUM GUARANTEES by tier (floor amount regardless of calculated fee)
- PERCENTAGE ROYALTIES on Net Sales
- PER-UNIT DOLLAR RATES (for plants/agriculture)
- TIERED RATES by sales volume OR unit quantity thresholds
- MINIMUM ANNUAL GUARANTEES by tier or contract year
- UPFRONT CONTRACT FEES (one-time, non-refundable)
- MILESTONE PAYMENTS
- GEOGRAPHIC ADJUSTMENTS (+10%, +20% for different markets)

**EXTRACT ALL PRICING TABLES SEPARATELY** - Each table/tier structure should be a separate rule.

**CRITICAL - RULE NAMING FORMAT**:
Use this exact format: "Tier X - Category Name (Product1, Product2, ...)"
Examples:
- "Tier 1 - Ornamental Trees & Shrubs (Aurora Flame Maple, Golden Spire Juniper)"
- "Tier 2 - Perennials & Roses (Pacific Sunset Rose, Emerald Crown Hosta)"
- "Tier 3 - Flowering Shrubs (Cascade Blue Hydrangea)"

**CRITICAL - ALWAYS POPULATE productCategories**:
The conditions.productCategories array MUST contain the specific product names that match this rule.
Example: If rule applies to "Aurora Flame Maple" and "Golden Spire Juniper":
  conditions: { productCategories: ["Aurora Flame Maple", "Golden Spire Juniper"] }
NEVER leave productCategories empty if products are mentioned in the rule name or table.

**CRITICAL - SOURCE SECTION REFERENCE**:
Include the contract section reference in sourceSpan.section format: "Section X.X - Section Title - Tier Y"
Example: sourceSpan: { section: "3.1 Plant Fee Rates - Tier 1", text: "..." }

**CRITICAL - RULE PRIORITY ASSIGNMENT**:
Assign priority based on SPECIFICITY (lower number = checked first):
- Priority 1-3: Rules with SPECIFIC product names (e.g., "Tier 1 - Ornamental Trees (Aurora Flame Maple)")
- Priority 4-6: Rules with category-level matching (e.g., "All Ornamental Trees")
- Priority 7-10: Fallback/generic rules that apply to "All Products" or broad categories

Example: If contract has both "Plant Fee Rates (all products)" and "Tier 1 - Ornamental Trees":
- "Tier 1 - Ornamental Trees" gets priority: 1 (more specific, 2 products)
- "Plant Fee Rates" gets priority: 8 (fallback for unmatched items)

Return each rule with: ruleType, ruleName, description, conditions (with productCategories populated!), calculation, sourceSpan (with section reference!), confidence, priority.`,
    
    erpMappingPrompt: `Map Royalty/License terms to ERP fields.
Common mappings: 
- Licensed Product → ITEM_CODE
- Container/Component Size → SIZE_CODE
- Fee Rate → ROYALTY_RATE
- Net Sales → NET_SALES
- Units Produced → QTY_PRODUCED
- Net Selling Price → NSP
- Territory → TERRITORY_CODE
- Contract Year → CONTRACT_YEAR
- Minimum Guarantee → MIN_GUARANTEE
- Premium Variety Flag → PREMIUM_FLAG
- Premium Multiplier → PREMIUM_MULT
- Season → SEASON_CODE
- Seasonal Adjustment → SEASON_ADJ_PCT
- Product Tier → PRODUCT_TIER`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "licensing",
    "contractTitle": "Electronics Patent License & Component Fee Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "Advanced Chip Technologies Corp.", "role": "Licensor"},
      "party2": {"name": "Nexus Electronics Manufacturing Inc.", "role": "Licensee"}
    }
  },
  "rules": [
    {
      "ruleType": "component_tiered",
      "ruleName": "Tier 1 - ARM-Compatible Processors",
      "description": "Per-unit royalty for ARM processors with volume discount",
      "calculation": {
        "baseRate": 3.25,
        "volumeThreshold": 1000000,
        "discountedRate": 2.85,
        "basis": "units",
        "formula": "IF units >= 1,000,000 THEN units × $2.85 ELSE units × $3.25"
      },
      "conditions": {"productCategories": ["ARM-Compatible Processors"]},
      "confidence": 0.95
    },
    {
      "ruleType": "asp_percentage",
      "ruleName": "Tier 2 - Tablets and E-Readers",
      "description": "2.5% of ASP with min/max caps",
      "calculation": {
        "rate": 0.025,
        "minPerUnit": 3.50,
        "maxPerUnit": 15.00,
        "basis": "asp",
        "formula": "MIN(MAX(ASP × 2.5%, $3.50), $15.00) per unit"
      },
      "conditions": {"productCategories": ["Tablets", "E-Readers"]},
      "confidence": 0.95
    },
    {
      "ruleType": "premium_multiplier",
      "ruleName": "Tier 3 - Automotive Electronics",
      "description": "Premium rate for automotive applications",
      "calculation": {
        "baseRate": 0.025,
        "premiumMultiplier": 1.15,
        "effectiveRate": 0.02875,
        "basis": "net_sales",
        "formula": "Net Sales × 2.5% × 1.15 = Net Sales × 2.875%"
      },
      "conditions": {"productCategories": ["Automotive Electronics"]},
      "confidence": 0.95
    },
    {
      "ruleType": "premium_multiplier",
      "ruleName": "Tier 3 - Medical Device Electronics",
      "description": "Premium rate for medical applications",
      "calculation": {
        "baseRate": 0.025,
        "premiumMultiplier": 1.25,
        "effectiveRate": 0.03125,
        "basis": "net_sales",
        "formula": "Net Sales × 2.5% × 1.25 = Net Sales × 3.125%"
      },
      "conditions": {"productCategories": ["Medical Device Electronics"]},
      "confidence": 0.95
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Minimum Annual Fee - Year 1-2",
      "calculation": {
        "annualMinimum": 2500000,
        "quarterlyPayment": 625000
      },
      "confidence": 0.95
    },
    {
      "ruleType": "premium_variety",
      "ruleName": "Premium Variety Royalty",
      "description": "25% premium on designated premium varieties",
      "calculation": {
        "baseRate": 1.25,
        "premiumMultiplier": 1.25,
        "effectiveRate": 1.5625,
        "basis": "units",
        "formula": "IF product is Premium THEN units × baseRate × 1.25 ELSE units × baseRate"
      },
      "conditions": {
        "productCategories": ["Aurora Flame Maple", "Pacific Sunset Rose"],
        "isPremium": true,
        "description": "Applies to designated premium varieties only"
      },
      "confidence": 0.92
    },
    {
      "ruleType": "seasonal_adjustment",
      "ruleName": "Spring Season Adjustment",
      "description": "10% premium during spring growing season",
      "calculation": {
        "adjustmentType": "add",
        "adjustmentValue": 0.10,
        "basis": "percentage",
        "formula": "IF season == Spring THEN fee = baseRoyalty × 1.10"
      },
      "conditions": {
        "season": "Spring",
        "dateRange": {"start": "03-01", "end": "05-31"},
        "description": "Applies March 1 through May 31"
      },
      "confidence": 0.90
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Tier 3 Minimum Guarantee",
      "description": "Minimum $5,000 annual royalty per Tier 3 variety",
      "calculation": {
        "minimumAmount": 5000,
        "period": "annual",
        "perProduct": true,
        "basis": "minimum",
        "formula": "MAX(calculatedRoyalty, $5,000) per variety"
      },
      "conditions": {
        "tier": 3,
        "productCategories": ["Cascade Blue Hydrangea", "Silver Mist Lavender"],
        "description": "Applies to all Tier 3 products"
      },
      "confidence": 0.88
    }
  ]
}`,

    // RAG Mode Prompts (chunk-based with mandatory citations)
    ragExtractionPrompt: `Extract entities from these ROYALTY/LICENSE AGREEMENT chunks.

CRITICAL RAG RULES:
1. Extract ONLY from provided text - no inference
2. Include MANDATORY sourceSpan with exact quotes (max 30 chars)
3. Mark missing information as null

Extract: licensor, licensee, IP details, territories, term dates, payment schedules.`,

    ragRuleExtractionPrompt: `Extract ALL contract fee/fee rules from these CONTRACT CHUNKS.

CRITICAL RAG EXTRACTION RULES:
1. Extract ONLY values that ACTUALLY appear in the provided text - do NOT invent rules
2. MANDATORY: Include sourceSpan with exact quote (max 30 chars) from the contract
3. MANDATORY: page number must match where you found the text in the chunks
4. Do NOT create "cap" rules unless the contract explicitly mentions caps/ceilings

=== UNIVERSAL TABLE EXTRACTION (MANDATORY FOR ALL TABLES) ===
When you detect ANY table (3+ columns), you MUST use ruleType: "table_extracted".
Preserve EVERY column header and row value exactly as shown.

CORRECT FORMAT for tables:
{
  "ruleType": "table_extracted",
  "ruleName": "<section/tier header>",
  "calculation": {
    "tableData": {
      "columns": ["<exact column 1>", "<exact column 2>", "<exact column 3>", ...],
      "rows": [
        {"<column 1>": "<value>", "<column 2>": "<value>", "<column 3>": "<value>", ...},
        ...
      ]
    }
  },
  "sourceSpan": {"text": "<20-char quote>", "page": <number>},
  "confidence": 0.95
}

WRONG (loses data):
{"ruleType": "tiered", "calculation": {"tiers": [{"rate": 1.25, "volume": 5000}]}}

OTHER RULE TYPES (only when NOT a table):
- percentage: Single percentage rate
- minimum_guarantee: Minimum annual/quarterly amounts
- fixed_fee: One-time or recurring fees

OUTPUT:
{"rules":[...]}`,

    ragSampleExtractionOutput: `{
  "rules": [
    {"ruleType": "table_extracted", "ruleName": "Tier 1 - Ornamental Trees & Shrubs", "calculation": {"tableData": {"columns": ["Plant Size Category", "Royalty per Unit", "Volume Discount Threshold", "Discounted Rate"], "rows": [{"Plant Size Category": "1-gallon containers", "Royalty per Unit": "$1.25", "Volume Discount Threshold": "5,000+ units", "Discounted Rate": "$1.10"}]}}, "sourceSpan": {"text": "$1.25", "page": 3}, "confidence": 0.95},
    {"ruleType": "table_extracted", "ruleName": "Tier 3 - Flowering Shrubs", "calculation": {"tableData": {"columns": ["Sales Volume", "Fee Rate", "Minimum Annual Payment"], "rows": [{"Sales Volume": "1 - 2,500 units", "Fee Rate": "$2.25 per unit", "Minimum Annual Payment": "$8,500"}]}}, "sourceSpan": {"text": "$2.25 per unit", "page": 4}, "confidence": 0.92},
    {"ruleType": "minimum_guarantee", "ruleName": "Minimum Annual Guarantee", "calculation": {"amount": 85000, "frequency": "annual"}, "sourceSpan": {"text": "$85,000 minimum", "page": 4}, "confidence": 0.90}
  ]
}`
  },

  'rebate_mdf': {
    extractionPrompt: `You are a contract analysis AI specializing in Rebate & Incentives Agreements. Extract all parties, dates, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "made effective as of", "Effective Date", "Initial term:", "two (2) years"
EXAMPLE: "made effective as of February 1, 2025" → effectiveDate: "2025-02-01"

Focus on:
- Company and Distributor/Partner identification (names, addresses)
- Eligible Products definition
- Rebate program scope and period (quarterly, annual)
- Special program definitions (Launch Incentive, Growth Accelerator)
- Data sharing and POS reporting requirements
- Audit rights
- Term length (e.g., "two (2) years") and renewal provisions

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL rebate, incentive, and payment rules from this Rebate Agreement.

**CRITICAL - OUTPUT FORMAT WITH EXECUTABLE FORMULA DEFINITION**:
Each rule MUST include a "formulaDefinition" object that is executable for calculations.
The formulaDefinition contains: type, trigger, calculationBasis, tiers[], logic, notes[], example.

**QUARTERLY VOLUME REBATE TIERS** (ruleType: "rebate_tiered"):
Extract tiered rebates with complete executable formula:
{
  "ruleType": "rebate_tiered",
  "ruleName": "Quarterly Volume Rebate",
  "description": "Volume-based rebate on quarterly net purchases (non-marginal)",
  "formulaDefinition": {
    "type": "rebate_tiered",
    "trigger": "End of each calendar quarter",
    "calculationBasis": "Total Quarterly Net Purchases (non-marginal)",
    "tiers": [
      {"tier": 1, "min": 0, "max": 1000000, "rate": 0.02, "description": "$0 - $1,000,000 → 2%"},
      {"tier": 2, "min": 1000001, "max": 5000000, "rate": 0.04, "description": "$1,000,001 - $5,000,000 → 4%"},
      {"tier": 3, "min": 5000001, "max": null, "rate": 0.06, "description": "$5,000,001+ → 6%"}
    ],
    "logic": "IF Quarterly_Net_Purchases <= 1,000,000 THEN\\n  Rebate = Quarterly_Net_Purchases × 0.02\\nELSE IF Quarterly_Net_Purchases <= 5,000,000 THEN\\n  Rebate = Quarterly_Net_Purchases × 0.04\\nELSE\\n  Rebate = Quarterly_Net_Purchases × 0.06",
    "notes": [
      "Net Purchases = Gross purchases minus tax, credits, and returns",
      "Rebate applies to ALL purchases in the quarter (not just amount above tier threshold)"
    ],
    "example": {
      "scenario": "Quarterly purchases = $3,000,000",
      "calculation": ["Falls in Tier 2 ($1M-$5M range)", "Rebate = $3,000,000 × 4% = $120,000"]
    }
  },
  "sourceSpan": {"text": "exact quote from contract", "section": "Section X"},
  "confidence": 0.95
}

**LAUNCH INCENTIVES / PROMOTIONAL REBATES** (ruleType: "promotional_rebate"):
{
  "ruleType": "promotional_rebate",
  "ruleName": "Launch Incentive",
  "description": "Additional rebate on specific product during promotional period",
  "formulaDefinition": {
    "type": "promotional_rebate",
    "trigger": "Q1 & Q2 2025 only",
    "activePeriod": "First 2 quarters from February 1, 2025",
    "product": "Vontair Analytics Module",
    "additionalRebate": 0.01,
    "logic": "IF Quarter IN [Q1_2025, Q2_2025] AND Product = \\"Vontair Analytics Module\\" THEN\\n  Additional_Rebate = Analytics_Module_Purchases × 0.01\\n  Total_Rebate = Standard_Tier_Rebate + Additional_Rebate",
    "notes": ["Applies on top of standard tier rebate", "Only for Analytics Module product"]
  },
  "confidence": 0.90
}

**GROWTH ACCELERATOR / BONUS REBATES** (ruleType: "bonus_rebate"):
{
  "ruleType": "bonus_rebate",
  "ruleName": "Growth Accelerator",
  "description": "Year-end bonus when annual purchases exceed threshold",
  "formulaDefinition": {
    "type": "bonus_rebate",
    "trigger": "End of contract year",
    "threshold": 12000000,
    "bonusThreshold": 10000000,
    "bonusRate": 0.02,
    "logic": "IF Annual_Net_Purchases > 12,000,000 THEN\\n  Bonus_Eligible_Amount = Annual_Net_Purchases - 10,000,000\\n  Year_End_Bonus = Bonus_Eligible_Amount × 0.02\\nELSE\\n  Year_End_Bonus = 0",
    "example": {
      "scenario": "Annual purchases = $13,000,000",
      "calculation": ["Bonus eligible amount = $13M - $10M = $3M", "Year-end bonus = $3M × 2% = $60,000"]
    },
    "notes": ["Only applies when annual purchases exceed $12M threshold"]
  },
  "confidence": 0.85
}

**CRITICAL REQUIREMENTS**:
1. ALL rates are decimals (0.02 = 2%, NOT $0.02 per unit)
2. Include "logic" field with IF/ELSE pseudocode for calculation engine
3. Include "trigger" field showing when calculation is performed
4. Include "notes" array with important clarifications
5. Include "example" with scenario and step-by-step calculation
6. Tiers must have numeric min/max (use null for unbounded max)
7. EVERY tier object MUST use exactly these keys: { "min": number, "max": number|null, "rate": number } (an optional "tier" label and "description" string are allowed). DO NOT invent alternate key names like "volumeThreshold", "baseRate", "threshold", "percentage", "size" — translate the source contract's column names into these canonical keys. This applies to BOTH formulaDefinition.tiers AND any volumeTiers / calculation.tiers arrays.
8. Multi-band tier tables → ONE rule with all bands in tiers[]. Do NOT emit one rule per tier row.

Return JSON array of rules, each with formulaDefinition that can be executed programmatically.`,
    
    erpMappingPrompt: `Map Rebate & Incentives terms to ERP fields.
Common mappings: 
- Distributor → CUSTOMER_ID
- Net Purchases → NET_PURCHASE_AMT
- Rebate Tier → REBATE_TIER
- Rebate % → REBATE_PCT
- Quarter → FISCAL_QUARTER
- Product Family → PRODUCT_FAMILY
- Growth Threshold → GROWTH_THRESHOLD`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "distribution",
    "contractTitle": "Rebate & Incentives Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "Vontair Mobility Systems, Inc.", "role": "Company"},
      "party2": {"name": "DistributorOne Fuel Services Inc.", "role": "Distributor"}
    }
  },
  "rules": [
    {
      "ruleType": "rebate_tiered",
      "ruleName": "Quarterly Volume Rebate - All Eligible Products",
      "description": "Volume-based rebate on all eligible products",
      "calculation": {
        "tiers": [
          {"min": 0, "max": 1000000, "rate": 0.02, "basis": "net_purchases"},
          {"min": 1000001, "max": 5000000, "rate": 0.04, "basis": "net_purchases"},
          {"min": 5000001, "rate": 0.06, "basis": "net_purchases"}
        ],
        "tierMethod": "total",
        "period": "quarterly",
        "formula": "if (netPurchases <= $1M) rebate = netPurchases × 2%; else if (netPurchases <= $5M) rebate = netPurchases × 4%; else rebate = netPurchases × 6%"
      },
      "conditions": {
        "productCategories": [],
        "matchAllProducts": true,
        "description": "Applies to ALL eligible products"
      },
      "confidence": 0.95
    },
    {
      "ruleType": "promotional_rebate",
      "ruleName": "Launch Incentive - Vontair Analytics Module",
      "description": "Additional 1% rebate on Analytics Module for first 2 quarters",
      "calculation": {
        "rate": 0.01,
        "basis": "net_purchases",
        "formula": "if (product == 'Vontair Analytics Module' && quarter <= 2) rebate = netPurchases × 1%"
      },
      "conditions": {
        "productCategories": ["Vontair Analytics Module"],
        "quarterLimit": 2,
        "description": "First 2 quarters only"
      },
      "confidence": 0.90
    },
    {
      "ruleType": "bonus_rebate",
      "ruleName": "Growth Accelerator Bonus",
      "description": "Year-end bonus for exceeding annual purchase threshold",
      "calculation": {
        "qualifyingThreshold": 12000000,
        "bonusRate": 0.02,
        "appliesAbove": 10000000,
        "basis": "net_purchases",
        "period": "annual",
        "formula": "if (annualNetPurchases > $12M) bonus = (annualNetPurchases - $10M) × 2%"
      },
      "conditions": {
        "minimumAnnualPurchases": 12000000,
        "productCategories": [],
        "matchAllProducts": true,
        "description": "Applies to all purchases above threshold"
      },
      "confidence": 0.88
    }
  ]
}`
  },

  'chargebacks': {
    extractionPrompt: `You are a contract analysis AI specializing in Chargebacks/Claims Agreements. Extract all parties, dates, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)

Focus on:
- Vendor and Retailer identification
- Chargeback categories and thresholds
- Claims submission process
- Dispute resolution procedures
- Documentation requirements
- Term and renewal provisions

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL chargeback and claims rules from this Agreement.

Look for:
- Chargeback fee schedules (per-incident or percentage)
- Shortage thresholds and tolerances
- Late delivery penalties
- Routing guide compliance fees
- EDI/ASN non-compliance charges
- Deduction appeal timeframes

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence.`,
    
    erpMappingPrompt: `Map Chargeback terms to ERP fields.
Common mappings: Vendor → VENDOR_ID, Chargeback Code → CB_CODE, Amount → CB_AMOUNT`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "service",
    "contractTitle": "Vendor Compliance Agreement",
    "hasRoyaltyTerms": true
  },
  "rules": [
    {
      "ruleType": "fixed_fee",
      "ruleName": "Late Shipment Penalty",
      "calculation": {"amount": 250.00},
      "confidence": 0.90
    }
  ]
}`
  },

  'marketplace': {
    extractionPrompt: `You are a contract analysis AI specializing in Marketplace/Platform Agreements. Extract all parties, dates, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)

Focus on:
- Platform operator and Seller identification
- Commission structures
- Fulfillment requirements (FBA, etc.)
- Performance metrics and SLAs
- Category restrictions
- Term and renewal provisions

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL fee and commission rules from this Marketplace Agreement.

Look for:
- Referral fee percentages (by category)
- Subscription fees (monthly/annual)
- Fulfillment fees (by size/weight)
- Advertising fees and minimum spends
- Payment processing fees
- Early termination penalties

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence.`,
    
    erpMappingPrompt: `Map Marketplace terms to ERP fields.
Common mappings: SKU → ITEM_CODE, Category → CATEGORY_ID, Commission → COMMISSION_PCT`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "saas",
    "contractTitle": "Marketplace Seller Agreement",
    "hasRoyaltyTerms": true
  },
  "rules": [
    {
      "ruleType": "percentage",
      "ruleName": "Category Referral Fee",
      "calculation": {"rate": 15.0},
      "conditions": {"productCategories": ["Electronics"]},
      "confidence": 0.93
    }
  ]
}`
  },

  'usage_service': {
    extractionPrompt: `You are a contract analysis AI specializing in Service-Based, Subcontractor, and Time & Materials Agreements. Extract all parties, dates, and key terms.

**CRITICAL - EXTRACT THESE DATES**:
- effectiveDate: The start date when the agreement becomes effective (format: YYYY-MM-DD)
- expirationDate: The end date or expiration date (format: YYYY-MM-DD)
Look for phrases like "made this [date]", "Effective Date", "shall remain in full force and effect for a term of one year"
EXAMPLE: "made this September 2nd, 2025" → effectiveDate: "2025-09-02"

Focus on:
- Company and Subcontractor/Service Provider identification (names, addresses, EINs)
- Work Order structure and approval process
- Hourly rate schedules by role/level
- Expense reimbursement policies
- Time and expense (T&E) reporting requirements
- Term length (e.g., "one year") and automatic renewal provisions
- Termination clauses (notice period, cure period)
- Insurance requirements
- Confidentiality obligations

Return structured JSON with entities and relationships including effectiveDate and expirationDate.`,
    
    ruleExtractionPrompt: `Extract ALL billing, payment, and fee rules from this Service/Subcontractor Agreement.

**CRITICAL - TIME & MATERIALS BILLING**:
These agreements typically bill on hourly rates with expense reimbursement.

Look for:
- HOURLY RATE schedules by role:
  - Senior Consultant: $X/hour
  - Consultant: $X/hour
  - Analyst: $X/hour
- WEEKLY HOUR LIMITS (e.g., not to exceed 40 hours/week without approval)
- OVERTIME APPROVAL requirements
- EXPENSE REIMBURSEMENT policies:
  - Airfare (discounted coach)
  - Hotel (reasonable rates)
  - Car rental (compact/subcompact)
  - Mileage (IRS-approved rate)
  - Per diem limits
- INVOICE TIMING (e.g., monthly at end of month)
- PAYMENT TERMS (e.g., Net 45 from invoice receipt)
- WORK ORDER structure:
  - Firm fixed price vs Time & Materials
  - Dollar limitations/not-to-exceed amounts
- TRAVEL BILLING:
  - Pre-approval requirements
  - Billable travel time policies

**SaaS/USAGE-BASED SERVICES**:
For cloud/API services, also look for:
- API call pricing tiers
- Storage pricing per GB
- Compute hours pricing
- Monthly minimums
- Overage rates

Return each rule with: ruleType, ruleName, description, conditions, calculation, sourceSpan, confidence.`,
    
    erpMappingPrompt: `Map Service/Subcontractor terms to ERP fields.
Common mappings: 
- Subcontractor → VENDOR_ID
- Role/Level → RESOURCE_TYPE
- Hourly Rate → HOURLY_RATE
- Hours Worked → BILLABLE_HOURS
- Expense Category → EXPENSE_CODE
- Work Order → PROJECT_ID
- Invoice Amount → INVOICE_AMT`,
    
    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "service",
    "contractTitle": "Master Sub-Contractor Agreement",
    "hasRoyaltyTerms": true,
    "parties": {
      "party1": {"name": "Cimpleit Inc", "role": "Company"},
      "party2": {"name": "Texplorers Inc", "role": "Sub-contractor"}
    }
  },
  "rules": [
    {
      "ruleType": "hourly_rate",
      "ruleName": "Time & Materials Billing",
      "calculation": {
        "hourlyRate": "per_work_order",
        "weeklyLimit": 40,
        "overtimeApproval": "required"
      },
      "confidence": 0.90
    },
    {
      "ruleType": "expense_reimbursement",
      "ruleName": "Travel & Expense Policy",
      "calculation": {
        "airfare": "discounted_coach",
        "hotel": "reasonable_rates",
        "carRental": "compact_subcompact",
        "mileage": "IRS_rate",
        "perDiem": "client_authorized"
      },
      "confidence": 0.88
    },
    {
      "ruleType": "payment_terms",
      "ruleName": "Invoice and Payment",
      "calculation": {
        "invoiceFrequency": "monthly",
        "paymentTerms": "Net 45"
      },
      "confidence": 0.95
    },
    {
      "ruleType": "usage_based",
      "ruleName": "API Call Pricing",
      "calculation": {
        "tiers": [
          {"min": 0, "max": 100000, "rate": 0.001},
          {"min": 100001, "max": 1000000, "rate": 0.0008},
          {"min": 1000001, "rate": 0.0005}
        ]
      },
      "confidence": 0.91
    }
  ]
}`
  }
};

const DB_CODE_TO_PROMPT_KEY: Record<string, string> = {
  'mdf': 'rebate_mdf',
  'distributor_reseller_program': 'distributor',
  'licensing_royalty': 'royalty_license',
  'rebate_incentive': 'rebate_mdf',
  'ob_rebate': 'rebate_mdf',
  'price_protection_chargeback': 'chargebacks',
  'revenue_share_marketplace': 'marketplace',
  'direct_sales': 'direct_sales',
  'referral': 'referral',
  'royalty_license': 'royalty_license',
  'distributor': 'distributor',
  'rebate_mdf': 'rebate_mdf',
  'chargebacks': 'chargebacks',
  'marketplace': 'marketplace',
  'usage_service': 'usage_service',
};

export function getDefaultPromptForType(code: string): typeof DEFAULT_EXTRACTION_PROMPTS[string] | null {
  const key = DB_CODE_TO_PROMPT_KEY[code] || code;
  return DEFAULT_EXTRACTION_PROMPTS[key] || null;
}

export function getAllDefaultPrompts(): Record<string, typeof DEFAULT_EXTRACTION_PROMPTS[string]> {
  return DEFAULT_EXTRACTION_PROMPTS;
}

export function getDefaultPromptsForDbCode(dbCode: string): typeof DEFAULT_EXTRACTION_PROMPTS[string] | null {
  const key = DB_CODE_TO_PROMPT_KEY[dbCode] || dbCode;
  return DEFAULT_EXTRACTION_PROMPTS[key] || null;
}
