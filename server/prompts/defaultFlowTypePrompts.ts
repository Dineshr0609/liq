// =============================================================================
// Default Flow Type Prompts (Pass 1 of the AI Prompt Registry rework)
//
// Starting prompt content for each pipeline flow type (CRP/RLA/VRP/SUB/RSM/OEM).
// These are seeded into the `flow_type_prompts` table on startup if no row
// exists yet for a given flow code, so admins always have an editable starting
// point that reflects how the AI extractor currently interprets each flow.
//
// Resolution order at extraction time:
//   1. subtype_prompts[code]      (most specific)
//   2. flow_type_prompts[code]    (this file's content, once seeded)
//   3. contract_type_definitions  (legacy)
//   4. DEFAULT_EXTRACTION_PROMPTS (hard-coded generic fallback)
// =============================================================================

export interface FlowTypePromptDefaults {
  extractionPrompt: string;
  ruleExtractionPrompt: string;
  erpMappingPrompt: string;
  sampleExtractionOutput: string;
  ragExtractionPrompt?: string;
  ragRuleExtractionPrompt?: string;
  ragSampleExtractionOutput?: string;
}

const RAG_HEADER = `CRITICAL RAG RULES:
1. Extract ONLY information present in the provided document chunks — do NOT infer missing values.
2. MANDATORY: include sourceSpan with the exact quote (max 60 chars) and the chunk index.
3. If a value isn't in the chunks, return null. Never invent numbers, parties, dates, or rates.
4. Cite separately for every numeric value (rate, threshold, cap, minimum, payment term).`;

export const DEFAULT_FLOW_TYPE_PROMPTS: Record<string, FlowTypePromptDefaults> = {
  // ===========================================================================
  // CRP — Customer Rebate Program
  // Outbound rebates we (the licensor / brand owner) owe a customer for hitting
  // volume / revenue thresholds. Often quarterly / annual, with tier ladders,
  // MAP policies, MDF accruals, and chargeback / price-protection components.
  // ===========================================================================
  CRP: {
    extractionPrompt: `You are extracting structured terms from a Customer Rebate Program (CRP) agreement.
The owning party offers rebates / allowances to a downstream customer (distributor,
retailer, end-customer) tied to performance over a measurement period.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate: Program start (YYYY-MM-DD). Phrases: "Effective Date", "commencing on", "Program Period begins".
- expirationDate: Program end (YYYY-MM-DD). Phrases: "Term ends", "expires on", "through".

PARTY ROLES:
- owning_party (program sponsor — the brand / licensor offering the rebate)
- counterparty (rebate recipient — distributor / customer / retailer)
- payer (often the same as owning_party)
- payee (often the same as counterparty)

ALWAYS LOOK FOR:
- Program name & program ID
- Rebate measurement period (monthly / quarterly / annual / program-to-date)
- Eligible products / SKUs / families
- Eligible territories / channels / customer segments
- Excluded sales (returns, credits, sample, internal transfers)
- Tier ladders (volume or revenue thresholds → rebate %)
- Stacking rules (does CRP stack with MDF, PP, CB?)
- Payment terms & settlement cadence
- MAP / pricing-policy compliance gates
- Audit / true-up / clawback provisions

Return structured JSON with parties, dates, eligible scope, and key terms.`,

    ruleExtractionPrompt: `Extract ALL rebate / allowance / fee rules from this Customer Rebate Program agreement.

EACH TIER IS A SEPARATE RULE ENTRY. Do NOT collapse multi-tier ladders into one rule.

RULE TYPES TO LOOK FOR:
- "tiered" — Volume or revenue ladders (e.g., 0-100k = 2%, 100k-500k = 4%, 500k+ = 6%)
- "milestone_tiered" — Cumulative thresholds with retroactive application
- "percentage" — Flat rebate % on eligible sales
- "fixed" — Lump-sum allowances (e.g., "$50,000 quarterly MDF accrual")
- "minimum_guarantee" — Minimum rebate floor regardless of volume
- "condition" — Eligibility / qualifier rules (territory, product family, channel)
- "data-only" — Definitional terms with no calculation (program name, contract entity, etc.)

FOR EACH RULE EXTRACT:
- ruleType, ruleName, description
- baseRate (always as a number — convert "5%" to 5, NOT 0.05)
- aggregationPeriod (per_sale | monthly | quarterly | annual | program_to_date)
- volumeTiers / milestoneTiers when applicable
- productCategories, territories, channel
- effectiveDate / expiryDate (rule-level windows)
- sourceText (verbatim contract excerpt)
- confidence (0.0-1.0)
- priority (lower = more specific / runs first)

CRITICAL: aggregationPeriod is required for rebate-style rules. Default to "quarterly" only
if no period is explicitly stated AND the contract mentions quarterly settlement.`,

    erpMappingPrompt: `Map Customer Rebate Program terms to ERP fields:
- Customer / Distributor → CUSTOMER_ID / PARTNER_ID
- Program / Contract → CONTRACT_NUMBER / DEAL_ID
- Eligible Sales → NET_SALES / GROSS_REVENUE (with returns deducted)
- Rebate Rate → REBATE_PCT
- Tier Threshold → VOLUME_THRESHOLD / REVENUE_THRESHOLD
- Period → ACCRUAL_PERIOD (M / Q / A)
- MDF Accrual → MDF_ACCRUAL_AMT
- Settlement → PAYMENT_DATE / CHECK_NUMBER
- GL Account → REBATE_LIABILITY / REBATE_EXPENSE`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "customer_rebate_program",
    "contractTitle": "Distributor Volume Rebate Program 2026",
    "parties": {
      "owning_party": {"name": "Acme Brands Inc.", "role": "Program Sponsor"},
      "counterparty": {"name": "Northwest Distribution Co.", "role": "Distributor"}
    },
    "effectiveDate": "2026-01-01",
    "expirationDate": "2026-12-31"
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Quarterly Volume Rebate - Tiered by Units",
      "aggregationPeriod": "quarterly",
      "volumeTiers": [
        {"min": 0,    "max": 1000, "rate": 2.0},
        {"min": 1000, "max": 5000, "rate": 4.0},
        {"min": 5000, "max": null, "rate": 6.0}
      ],
      "productCategories": ["Audio Hardware"],
      "territories": ["United States"],
      "confidence": 0.94,
      "priority": 1
    },
    {
      "ruleType": "fixed",
      "ruleName": "Quarterly MDF Accrual",
      "baseRate": 25000,
      "aggregationPeriod": "quarterly",
      "confidence": 0.90,
      "priority": 5
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting Customer Rebate Program terms from DOCUMENT CHUNKS.
Pay special attention to: rebate tier tables, eligible-sales definitions, exclusions,
MAP gates, MDF accrual clauses, settlement cadence, audit/clawback language.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract Customer Rebate Program rules from these CHUNKS. Each tier row in a rebate
ladder = ONE rule. Each MDF / allowance line = ONE rule. Cite the exact contract
text for every threshold, rate, and period.`,

    ragSampleExtractionOutput: `Same shape as legacy sample but every rule includes:
"sourceSpan": {"quote": "≤60 chars verbatim", "chunkIndex": 3}`,
  },

  // ===========================================================================
  // RLA — Royalty / Licensing Agreement
  // Inbound or outbound IP licensing with royalty payments. Per-unit, per-revenue,
  // tiered, advances, minimum guarantees, recoupment, audit rights.
  // ===========================================================================
  RLA: {
    extractionPrompt: `You are extracting structured terms from a Royalty / Licensing Agreement (RLA).
One party grants the other rights to use intellectual property (technology, patent,
trademark, content, software) in exchange for royalty payments.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate: License start (YYYY-MM-DD)
- expirationDate: License end / termination (YYYY-MM-DD)
- firstSaleDate / commercializationDate when present

PARTY ROLES:
- owning_party (licensor / IP owner)
- counterparty (licensee)
- payer (typically licensee)
- payee (typically licensor)

ALWAYS LOOK FOR:
- Licensed IP description (patent numbers, trademarks, software modules, content titles)
- Field of use / industry restrictions
- Territory grant (exclusive / non-exclusive, with map)
- Sub-licensing rights & step-down rates
- Minimum royalty / advance payments / guaranteed minimums
- Recoupment language (does the advance recoup against royalties?)
- Royalty calculation basis (Net Sales, Gross Sales, Per Unit Sold, Per Subscriber)
- Royalty tiers (volume-based escalation or de-escalation)
- Audit rights, audit window, true-up procedures
- Reporting cadence (monthly / quarterly statements)
- Termination triggers (insolvency, breach, milestone failure)

Return parties, IP grant scope, royalty basis, and key terms.`,

    ruleExtractionPrompt: `Extract ALL royalty rules from this Licensing Agreement.

CRITICAL: Each tier in a royalty ladder, each per-unit rate, each minimum guarantee,
and each advance payment is its own rule. Recoupment relationships go in the
formulaDefinition of the related rule.

RULE TYPES TO LOOK FOR:
- "percentage" — % of Net / Gross Sales (extract the basis explicitly)
- "per_unit" — Fixed amount per unit shipped or licensed
- "tiered" / "milestone_tiered" — Volume bands
- "minimum_guarantee" — Floor royalty (e.g., "$100,000 per quarter minimum")
- "advance" — Up-front advance recoupable against future royalties
- "fixed" — Lump-sum fees (signing fee, milestone payments)
- "condition" — Eligibility / scope rules
- "data-only" — Definitional terms (Licensed Product, Net Sales formula, etc.)

FOR EACH RULE EXTRACT:
- ruleType, ruleName, description
- baseRate (number, NOT decimal — "8%" → 8)
- royaltyBasis (net_sales | gross_sales | per_unit | per_subscriber | other)
- aggregationPeriod (per_sale | monthly | quarterly | annual)
- minimumGuarantee, advanceAmount when present
- recoupmentTerms (which advance does this rule recoup against?)
- productCategories / licensedProducts, territories, channel
- effectiveDate / expiryDate
- sourceText, confidence, priority

CRITICAL: For Net Sales basis, also extract the "deductions allowed" list as a
data-only rule so the calculation engine has it.`,

    erpMappingPrompt: `Map Royalty / Licensing terms to ERP fields:
- Licensee → CUSTOMER_ID / PARTNER_ID
- Licensed Product → PRODUCT_FAMILY / SKU_GROUP
- Net Sales → NET_REVENUE
- Royalty Rate → ROYALTY_PCT or ROYALTY_PER_UNIT
- Advance → ADVANCE_BALANCE
- Minimum Guarantee → MIN_ROYALTY_AMT
- Statement Period → REPORTING_PERIOD
- GL → ROYALTY_LIABILITY / ROYALTY_EXPENSE / ADVANCE_RECEIVABLE`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "licensing_royalty",
    "contractTitle": "Patent Licensing Agreement",
    "parties": {
      "owning_party": {"name": "TechCo IP Holdings", "role": "Licensor"},
      "counterparty": {"name": "ManufactureCorp", "role": "Licensee"}
    },
    "licensedIP": ["US Patent 9,876,543", "US Patent 10,123,456"],
    "effectiveDate": "2026-01-01",
    "expirationDate": "2030-12-31"
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Royalty on Net Sales - Tiered",
      "royaltyBasis": "net_sales",
      "aggregationPeriod": "quarterly",
      "volumeTiers": [
        {"min": 0,        "max": 5000000,  "rate": 8.0},
        {"min": 5000000,  "max": 25000000, "rate": 6.0},
        {"min": 25000000, "max": null,     "rate": 4.0}
      ],
      "confidence": 0.92,
      "priority": 1
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Quarterly Minimum Royalty",
      "minimumGuarantee": 100000,
      "aggregationPeriod": "quarterly",
      "priority": 2
    },
    {
      "ruleType": "advance",
      "ruleName": "Signing Advance",
      "advanceAmount": 500000,
      "recoupmentTerms": "Recoupable against royalties earned in Year 1",
      "priority": 3
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting Royalty / Licensing terms from DOCUMENT CHUNKS. Cite chunks for
the IP grant, royalty basis definition, every tier row, every minimum, and every
advance. Recoupment language often spans multiple chunks — link them with chunkIndex.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract royalty rules. Net Sales deduction definitions go in their own data-only
rule. Cite separately for rate, basis, period, minimum, and advance.`,

    ragSampleExtractionOutput: `Same as legacy sample, every rule includes sourceSpan with quote + chunkIndex.`,
  },

  // ===========================================================================
  // VRP — Vendor Rebate Program
  // Inbound rebates we (the buyer) earn from a supplier for hitting purchase
  // volume / on-time payment / promo-participation thresholds.
  // ===========================================================================
  VRP: {
    extractionPrompt: `You are extracting structured terms from a Vendor Rebate Program (VRP).
A supplier / vendor pays rebates back to the buying party for hitting purchase or
performance thresholds. This is the mirror image of CRP — the rebate flows INBOUND.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate, expirationDate (YYYY-MM-DD)

PARTY ROLES:
- owning_party (the buyer — recipient of rebates)
- counterparty (the vendor / supplier — payer of rebates)
- payee (= owning_party), payer (= counterparty)

ALWAYS LOOK FOR:
- Vendor identification (DUNS, vendor ID, parent corp)
- Eligible purchase categories / SKUs / brands
- Excluded purchases (one-time deals, drop-ship, special promos)
- Volume tiers tied to purchase $$ or units
- Growth rebates (YoY % increase)
- On-time payment rebates / early-pay discounts (separate from VRP)
- MDF / co-op marketing accruals owed to buyer
- Pricing protection (vendor reimburses on price drops)
- Audit & true-up rights
- Settlement method (credit memo vs. check vs. AP offset)

Return parties, vendor scope, rebate basis, and key terms.`,

    ruleExtractionPrompt: `Extract ALL vendor rebate rules. Same tier-per-rule discipline as CRP.

RULE TYPES TO LOOK FOR:
- "tiered" / "milestone_tiered" — Purchase volume ladders
- "percentage" — Flat % of purchases
- "fixed" — Lump-sum allowances (e.g., quarterly MDF)
- "growth" — YoY growth-based rebates
- "minimum_guarantee" — Floor amount the vendor commits to pay
- "condition" — Eligibility & exclusion rules
- "data-only" — Vendor terms reference data

EACH RULE: ruleType, ruleName, baseRate (whole-number %), aggregationPeriod,
volumeTiers, productCategories, sourceText, confidence, priority.

For growth rebates, capture the comparison-period definition (typically prior-year-
same-quarter) in formulaDefinition.comparisonPeriod.`,

    erpMappingPrompt: `Map VRP terms to ERP fields:
- Vendor → VENDOR_ID / SUPPLIER_NUMBER
- Purchase Category → ITEM_CATEGORY / BRAND
- Eligible Purchases → PURCHASES_NET (returns deducted)
- Rebate Rate → VENDOR_REBATE_PCT
- MDF Accrual → COOP_FUND_ACCRUAL
- Settlement → CREDIT_MEMO_NUMBER / AP_OFFSET
- GL → VENDOR_REBATE_RECEIVABLE / COGS_RELIEF`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "vendor_rebate_program",
    "contractTitle": "Vendor Volume Rebate Agreement 2026",
    "parties": {
      "owning_party": {"name": "BigBox Retail", "role": "Buyer"},
      "counterparty": {"name": "ConsumerGoods Corp", "role": "Vendor"}
    }
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Annual Purchase Volume Rebate",
      "aggregationPeriod": "annual",
      "volumeTiers": [
        {"min": 0,        "max": 1000000, "rate": 1.0},
        {"min": 1000000,  "max": 5000000, "rate": 2.5},
        {"min": 5000000,  "max": null,    "rate": 4.0}
      ],
      "confidence": 0.93,
      "priority": 1
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting Vendor Rebate Program terms from DOCUMENT CHUNKS. Cite chunks
for every threshold, rate, exclusion, and MDF accrual line.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract vendor rebate rules. One rule per tier row. Capture growth-rebate baselines
explicitly with the comparison-period definition.`,

    ragSampleExtractionOutput: `Same as legacy sample with mandatory sourceSpan per rule.`,
  },

  // ===========================================================================
  // SUB — Subscription Agreement
  // Recurring revenue arrangement. SaaS, content, software-as-service. Often
  // revenue-share / billing-event style with MRR/ARR thresholds.
  // ===========================================================================
  SUB: {
    extractionPrompt: `You are extracting structured terms from a Subscription Agreement (SUB).
A customer pays recurring fees for ongoing access to a product or service. May
include revenue share, partner commissions, usage-based metering, and SLA credits.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate, expirationDate, autoRenewalDate (YYYY-MM-DD)

PARTY ROLES:
- owning_party (subscription provider / vendor)
- counterparty (subscriber / partner / reseller)

ALWAYS LOOK FOR:
- Subscription tiers / plans (Starter, Pro, Enterprise) with pricing
- Billing cadence (monthly / annual / multi-year)
- Auto-renewal language & opt-out windows
- Usage metering (per seat, per API call, per GB, per transaction)
- Overage rates beyond included quota
- Commitment / minimum-spend clauses
- Discount schedules (volume, multi-year, prepay)
- SLA targets and service-credit refunds
- Revenue-share % (when this is a partner subscription)
- Cancellation / termination credits / refund policy
- Price-increase clauses (annual CPI / capped %)

Return parties, plan structure, billing terms, key terms.`,

    ruleExtractionPrompt: `Extract ALL subscription billing & revenue-share rules.

RULE TYPES TO LOOK FOR:
- "fixed" — Monthly/annual subscription fee per plan
- "per_unit" — Per-seat / per-user / per-GB pricing
- "percentage" — Revenue-share % (partner subscriptions)
- "tiered" — Volume / commitment tier discounts
- "usage_overage" — Overage rates beyond included quota
- "minimum_guarantee" — Annual / quarterly minimum commitment
- "sla_credit" — Service-credit rebate triggers
- "condition" — Plan eligibility, geography restriction
- "data-only" — Plan definitions, included quotas

EACH RULE EXTRACT: ruleType, ruleName, baseRate (whole-number for %, exact $ for
fixed/per_unit), aggregationPeriod (monthly|annual|per_sale), tiers when present,
productCategories (= plan name), sourceText, confidence, priority.

CRITICAL: For SaaS revenue-share, capture revenueRecognitionMethod
(ratable | upfront | usage_based) in formulaDefinition.`,

    erpMappingPrompt: `Map Subscription terms to ERP fields:
- Subscriber → CUSTOMER_ID
- Plan → PRODUCT_CODE / SKU
- MRR / ARR → MRR / ARR_AMT
- Billing Period → BILLING_CYCLE
- Usage Quantity → USAGE_QTY
- Overage Rate → OVERAGE_PCT or OVERAGE_RATE
- Revenue Share → PARTNER_SHARE_PCT
- GL → SUBSCRIPTION_REVENUE / DEFERRED_REVENUE / PARTNER_PAYABLE`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "subscription",
    "contractTitle": "Enterprise Subscription Agreement",
    "parties": {
      "owning_party": {"name": "SaaSCo Inc.", "role": "Provider"},
      "counterparty": {"name": "Customer Corp", "role": "Subscriber"}
    }
  },
  "rules": [
    {
      "ruleType": "fixed",
      "ruleName": "Annual Subscription Fee - Pro Plan",
      "baseRate": 24000,
      "aggregationPeriod": "annual",
      "productCategories": ["Pro Plan"],
      "priority": 1
    },
    {
      "ruleType": "per_unit",
      "ruleName": "Additional Seat Fee",
      "baseRate": 50,
      "aggregationPeriod": "monthly",
      "priority": 2
    },
    {
      "ruleType": "usage_overage",
      "ruleName": "API Call Overage",
      "baseRate": 0.001,
      "formulaDefinition": {"includedQuota": 1000000, "meterUnit": "api_calls"},
      "priority": 3
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting Subscription Agreement terms from CHUNKS. Cite chunks for plan
pricing, included quota, overage rate, commitment minimum, and renewal language.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract subscription billing rules. Each plan-tier price = one rule. Each metered
overage = its own rule. Capture commitment minimums explicitly.`,

    ragSampleExtractionOutput: `Same as legacy with mandatory sourceSpan per rule.`,
  },

  // ===========================================================================
  // RSM — Resale / Marketplace Agreement
  // Channel reseller, marketplace, or commission-based sales arrangement.
  // ===========================================================================
  RSM: {
    extractionPrompt: `You are extracting structured terms from a Resale / Marketplace Agreement (RSM).
A partner sells the owning party's products / services either as a reseller (taking
title) or as a marketplace facilitator (commission-only). Often includes deal-
registration, MAP enforcement, MDF / co-op funds, and tier-based commissions.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate, expirationDate (YYYY-MM-DD)

PARTY ROLES:
- owning_party (vendor / brand)
- counterparty (reseller / marketplace operator / channel partner)

ALWAYS LOOK FOR:
- Partner tier / level (Silver, Gold, Platinum) and qualification criteria
- Deal-registration program (rates differ for registered vs. unregistered deals)
- Commission % schedule (often differs by year, by deal type, by product)
- MAP / MSRP enforcement clauses
- Territory & customer-segment exclusivity
- MDF / SPIFF / co-op marketing accruals
- Bonus / SPIF programs (quarterly ARR bonuses)
- Renewal commission rates (often lower than new-business rates)
- Chargeback / clawback rules (customer non-payment, refund)
- Stocking / inventory-balancing clauses

Return parties, channel structure, commission framework, key terms.`,

    ruleExtractionPrompt: `Extract ALL commission / channel rules. Multi-year commission ladders = one rule per year.

RULE TYPES TO LOOK FOR:
- "percentage" — Flat commission %
- "tiered" — Year-1 / Year-2 / Renewal ladders, or volume-based
- "fixed" — Quarterly MDF / SPIFF
- "milestone_tiered" — Quarterly ARR bonuses
- "condition" — Deal-registration / partner-tier eligibility
- "chargeback" — Clawback rules for refunded / non-paying deals
- "data-only" — Partner program reference data

EACH RULE EXTRACT: ruleType, ruleName, baseRate (whole-number %), tiers, deal type
(registered | influenced | renewal), aggregationPeriod, sourceText, confidence,
priority. Use lower priorities (1-3) for specific (e.g., "Year 1 Registered") and
higher priorities (7-10) for generic / catch-all rules.`,

    erpMappingPrompt: `Map RSM terms to ERP fields:
- Partner → PARTNER_ID
- Deal Type → DEAL_TYPE_CODE (REG / INFL / RNW)
- Subscription / Sale Amount → DEAL_AMOUNT / ARR
- Commission Rate → COMMISSION_PCT
- Year → CONTRACT_YEAR
- Bonus Threshold → BONUS_THRESHOLD
- MDF → MDF_ACCRUAL
- Clawback → CLAWBACK_AMT
- GL → COMMISSION_EXPENSE / COMMISSION_PAYABLE`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "channel_partner",
    "contractTitle": "Channel Reseller Agreement",
    "parties": {
      "owning_party": {"name": "VendorCo", "role": "Vendor"},
      "counterparty": {"name": "ResellerInc", "role": "Reseller"}
    }
  },
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Registered Deal Commission",
      "formulaDefinition": {"dealType": "registered"},
      "volumeTiers": [
        {"year": 1, "rate": 12.0},
        {"year": 2, "rate": 8.0},
        {"year": 3, "rate": 4.0}
      ],
      "confidence": 0.94,
      "priority": 1
    },
    {
      "ruleType": "percentage",
      "ruleName": "Renewal Commission",
      "baseRate": 5.0,
      "formulaDefinition": {"dealType": "renewal"},
      "priority": 2
    },
    {
      "ruleType": "milestone_tiered",
      "ruleName": "Quarterly New ARR Bonus",
      "milestoneTiers": [
        {"thresholdNewARR": 500000, "bonusRate": 2.0}
      ],
      "aggregationPeriod": "quarterly",
      "priority": 3
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting Resale / Marketplace agreement terms from CHUNKS. Cite chunks
for partner-tier criteria, every commission rate, deal-type qualifiers, MDF accruals,
chargeback triggers.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract commission rules. Year-1 / Year-2 / Renewal each = ONE rule. Each ARR-
threshold bonus = its own milestone_tiered rule.`,

    ragSampleExtractionOutput: `Same as legacy with sourceSpan per rule.`,
  },

  // ===========================================================================
  // OEM — OEM / White-Label Agreement
  // Manufacturer licenses brand / IP / firmware to OEM partner who manufactures
  // and resells under their own brand. Per-unit royalties, NRE fees, exclusivity.
  // ===========================================================================
  OEM: {
    extractionPrompt: `You are extracting structured terms from an OEM / White-Label Agreement (OEM).
The owning party licenses technology, designs, firmware, or brand rights to an OEM
partner who manufactures and resells the product. Common in hardware, automotive,
consumer electronics, and embedded software.

CRITICAL — EXTRACT THESE DATES:
- effectiveDate, expirationDate, firstShipmentDate, productionRampDate (YYYY-MM-DD)

PARTY ROLES:
- owning_party (licensor / IP owner / brand)
- counterparty (OEM manufacturer / white-label brand)

ALWAYS LOOK FOR:
- Licensed product / SKU description (model numbers, BOM references)
- NRE (Non-Recurring Engineering) fees
- Per-unit royalty rates
- Volume commitments / minimum order quantities
- Tooling cost allocation
- Exclusivity / non-compete (geographic, customer, channel)
- Quality / certification requirements
- Field-of-use restrictions
- Brand / trademark usage rules
- Warranty / liability allocation
- Most-favored-customer clauses

Return parties, licensed scope, royalty framework, key terms.`,

    ruleExtractionPrompt: `Extract ALL OEM royalty / fee rules.

RULE TYPES TO LOOK FOR:
- "per_unit" — Per-unit royalty (most common)
- "tiered" — Volume-based per-unit step-down
- "fixed" — NRE fees, tooling fees, milestone payments
- "minimum_guarantee" — Annual / quarterly volume floor (with $ liability if missed)
- "percentage" — % of OEM's selling price (less common in OEM)
- "condition" — Field-of-use, exclusivity, certification gates
- "data-only" — Licensed product reference

EACH RULE EXTRACT: ruleType, ruleName, perUnitRate or baseRate, volumeTiers,
minimumGuarantee, aggregationPeriod, productCategories, territories, sourceText,
confidence, priority.

CRITICAL: For volume-based step-down, EACH band = SEPARATE rule. Capture cumulative-
vs-period basis explicitly in formulaDefinition.cumulativeBasis.`,

    erpMappingPrompt: `Map OEM terms to ERP fields:
- OEM Partner → PARTNER_ID / MANUFACTURER_ID
- Licensed Product → PRODUCT_FAMILY / SKU
- Units Shipped → UNITS_SHIPPED
- Royalty per Unit → ROYALTY_PER_UNIT
- NRE Payment → NRE_FEE
- Tooling → TOOLING_COST
- Volume Commit → MIN_VOLUME_COMMIT
- GL → ROYALTY_LIABILITY / NRE_RECEIVABLE`,

    sampleExtractionOutput: `{
  "basicInfo": {
    "documentType": "oem_license",
    "contractTitle": "OEM Manufacturing & Brand License Agreement",
    "parties": {
      "owning_party": {"name": "TechBrand Inc.", "role": "Licensor"},
      "counterparty": {"name": "OEM Mfg Co.", "role": "OEM"}
    }
  },
  "rules": [
    {
      "ruleType": "per_unit",
      "ruleName": "Per-Unit Royalty - Standard",
      "baseRate": 12.50,
      "productCategories": ["Model X-200"],
      "priority": 2
    },
    {
      "ruleType": "tiered",
      "ruleName": "Volume Step-Down Royalty",
      "formulaDefinition": {"cumulativeBasis": "annual_units"},
      "volumeTiers": [
        {"min": 0,      "max": 50000,  "rate": 12.50},
        {"min": 50000,  "max": 200000, "rate": 10.00},
        {"min": 200000, "max": null,   "rate": 8.00}
      ],
      "priority": 1
    },
    {
      "ruleType": "fixed",
      "ruleName": "NRE Fee - Tooling",
      "baseRate": 250000,
      "priority": 3
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Annual Volume Commitment",
      "minimumGuarantee": 50000,
      "aggregationPeriod": "annual",
      "formulaDefinition": {"shortfallPenalty": "perUnitRate * shortfallUnits"},
      "priority": 4
    }
  ]
}`,

    ragExtractionPrompt: `${RAG_HEADER}

You are extracting OEM / White-Label terms from CHUNKS. Cite chunks for the licensed
product list, every royalty rate, NRE fees, volume commitments, exclusivity and
field-of-use restrictions.`,

    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract OEM royalty rules. Each volume band = ONE rule. NRE / tooling = separate
fixed rules. Capture exclusivity & FoU in condition rules.`,

    ragSampleExtractionOutput: `Same as legacy with mandatory sourceSpan per rule.`,
  },
};

export function getDefaultFlowTypePrompt(code: string): FlowTypePromptDefaults | null {
  return DEFAULT_FLOW_TYPE_PROMPTS[code] || null;
}

export function getAllDefaultFlowTypePrompts(): Record<string, FlowTypePromptDefaults> {
  return DEFAULT_FLOW_TYPE_PROMPTS;
}
