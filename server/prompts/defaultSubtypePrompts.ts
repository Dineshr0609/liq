// =============================================================================
// Default Subtype / Program Prompts (Pass 1 of the AI Prompt Registry rework)
//
// Starting prompt content for each program subtype (RA / ROY / RSS / PP / MDF /
// CB / MIN / PTR / COM / SBE). These are the most-specific layer in the
// extraction prompt resolution chain — they only fire when a contract has a
// subtype instance whose code matches.
//
// Most subtype prompts are SHORTER than flow-type prompts because they focus
// on the program-specific math (tier shapes, cap behaviour, accrual cadence)
// rather than the broader contract anatomy (parties, dates, IP grant), which
// the flow-type layer already handles.
// =============================================================================

export interface SubtypePromptDefaults {
  extractionPrompt: string;
  ruleExtractionPrompt: string;
  erpMappingPrompt: string;
  sampleExtractionOutput: string;
  ragExtractionPrompt?: string;
  ragRuleExtractionPrompt?: string;
  ragSampleExtractionOutput?: string;
}

const RAG_HEADER = `CRITICAL RAG RULES:
1. Extract ONLY information present in the provided document chunks.
2. MANDATORY: include sourceSpan with verbatim quote (max 60 chars) + chunkIndex.
3. If a value isn't in the chunks, return null. Never invent values.`;

export const DEFAULT_SUBTYPE_PROMPTS: Record<string, SubtypePromptDefaults> = {
  // ===========================================================================
  // RA — Rebate / Allowance
  // Outbound rebate to customer, or inbound rebate from supplier. Tier ladders,
  // accumulation periods, settlement cadence.
  // ===========================================================================
  RA: {
    extractionPrompt: `You are extracting Rebate / Allowance program terms.
Focus on: tier ladders, accumulation period, eligible-sales scope, exclusions,
settlement cadence, true-up logic, claim window, audit rights.`,
    ruleExtractionPrompt: `Extract rebate / allowance rules. EACH TIER ROW = ONE RULE.

Capture per rule:
- ruleType: tiered | milestone_tiered | percentage | fixed | minimum_guarantee
- baseRate as a whole number ("3%" → 3, NOT 0.03)
- aggregationPeriod: per_sale | monthly | quarterly | annual | program_to_date
- volumeTiers / milestoneTiers (cumulative vs. period-bounded)
- productCategories, territories, channel
- isRetroactive (does hitting a higher tier re-apply to earlier sales in the period?)
- payoutTrigger: at_period_end | on_threshold | on_invoice
- sourceText, confidence, priority

Capture exclusions ("returns, samples, internal transfers") as a SEPARATE
condition rule with conditionType="exclusion" so the engine filters cleanly.`,
    erpMappingPrompt: `Map Rebate / Allowance terms:
- Eligible Sales → NET_SALES (with returns/credits/samples deducted)
- Rebate Rate → REBATE_PCT
- Tier Threshold → VOLUME_THRESHOLD / REVENUE_THRESHOLD
- Accrual Period → ACCRUAL_PERIOD
- Settlement → PAYMENT_DATE / CREDIT_MEMO
- GL → REBATE_LIABILITY / REBATE_EXPENSE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "milestone_tiered",
      "ruleName": "Cumulative Annual Rebate (Retroactive)",
      "aggregationPeriod": "annual",
      "isRetroactive": true,
      "milestoneTiers": [
        {"thresholdRevenue": 1000000,  "rate": 2.0},
        {"thresholdRevenue": 5000000,  "rate": 4.0},
        {"thresholdRevenue": 10000000, "rate": 6.0}
      ],
      "payoutTrigger": "at_period_end",
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Rebate / Allowance program terms from CHUNKS. Cite separately for each
threshold, rate, exclusion, and settlement clause.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract rebate rules with one rule per tier row. Capture isRetroactive explicitly
based on contract language ("retroactive to dollar one", "applied to all sales in
period", etc.).`,
    ragSampleExtractionOutput: `Same as legacy with sourceSpan per rule.`,
  },

  // ===========================================================================
  // ROY — Royalty (per-unit or % of revenue)
  // ===========================================================================
  ROY: {
    extractionPrompt: `You are extracting Royalty program terms.
Focus on: royalty basis (Net Sales / Gross / Per Unit / Per Subscriber), rate
schedule, advance payments, recoupment, minimum guarantees, audit rights,
reporting cadence.`,
    ruleExtractionPrompt: `Extract royalty rules.

Capture per rule:
- ruleType: percentage | per_unit | tiered | minimum_guarantee | advance | fixed
- royaltyBasis: net_sales | gross_sales | per_unit | per_subscriber | other
- baseRate (whole-number for %, exact $ for per_unit)
- aggregationPeriod: per_sale | monthly | quarterly | annual
- volumeTiers (escalation OR de-escalation)
- minimumGuarantee, advanceAmount
- recoupmentTerms (does this advance recoup against royalties?)
- territories, productCategories
- sourceText, confidence, priority

CRITICAL: For Net Sales basis, ALSO emit a data-only rule containing the allowed
deductions list ("returns, freight, taxes, …") so the calc engine can mirror it.`,
    erpMappingPrompt: `Map Royalty terms:
- Net Sales → NET_REVENUE
- Royalty Rate → ROYALTY_PCT or ROYALTY_PER_UNIT
- Advance → ADVANCE_BALANCE
- Minimum Guarantee → MIN_ROYALTY_AMT
- Statement Period → REPORTING_PERIOD
- GL → ROYALTY_LIABILITY / ROYALTY_EXPENSE / ADVANCE_RECEIVABLE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Net Sales Royalty - Tiered",
      "royaltyBasis": "net_sales",
      "aggregationPeriod": "quarterly",
      "volumeTiers": [
        {"min": 0,        "max": 5000000,  "rate": 8.0},
        {"min": 5000000,  "max": 25000000, "rate": 6.0},
        {"min": 25000000, "max": null,     "rate": 4.0}
      ],
      "priority": 1
    },
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Quarterly Minimum",
      "minimumGuarantee": 100000,
      "aggregationPeriod": "quarterly",
      "priority": 2
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Royalty program terms from CHUNKS. Cite chunks for basis, every rate,
every minimum, every advance.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract royalty rules. Capture royalty basis explicitly. Net-Sales deduction list
becomes a data-only rule with citations.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // RSS — Revenue Share / SaaS
  // Recurring revenue split between provider and partner, often with MRR/ARR
  // commitments and tiered shares.
  // ===========================================================================
  RSS: {
    extractionPrompt: `You are extracting Revenue Share / SaaS program terms.
Focus on: revenue split %, recognition method (ratable vs upfront vs usage-based),
plan tiers, included quotas, overage rates, commitment minimums, churn / refund
handling.`,
    ruleExtractionPrompt: `Extract revenue-share & subscription billing rules.

Capture per rule:
- ruleType: percentage | fixed | per_unit | tiered | usage_overage | minimum_guarantee
- baseRate (whole-number for %, exact $ for fixed/per_unit)
- aggregationPeriod: monthly | quarterly | annual | per_sale
- revenueRecognitionMethod: ratable | upfront | usage_based
- includedQuota & meterUnit (for metered overages)
- commitmentMinimum (annual / quarterly minimum spend)
- productCategories (= plan name when applicable)
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Revenue Share / SaaS terms:
- MRR / ARR → MRR / ARR_AMT
- Plan → PRODUCT_CODE
- Revenue Share → PARTNER_SHARE_PCT
- Usage → USAGE_QTY
- Overage Rate → OVERAGE_RATE
- GL → SUBSCRIPTION_REVENUE / DEFERRED_REVENUE / PARTNER_PAYABLE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "percentage",
      "ruleName": "Partner Revenue Share",
      "baseRate": 30.0,
      "aggregationPeriod": "monthly",
      "formulaDefinition": {"revenueRecognitionMethod": "ratable"},
      "priority": 1
    },
    {
      "ruleType": "usage_overage",
      "ruleName": "API Call Overage",
      "baseRate": 0.001,
      "formulaDefinition": {"includedQuota": 1000000, "meterUnit": "api_calls"},
      "priority": 2
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting SaaS / Revenue Share terms from CHUNKS. Cite for plan pricing,
included quota, overage rate, revenue split, commitment minimum.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract revenue-share rules. Capture recognition method (ratable / upfront /
usage-based) explicitly per rule.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // PP — Price Protection
  // Reimbursement when published price drops, protecting partner inventory value.
  // ===========================================================================
  PP: {
    extractionPrompt: `You are extracting Price Protection program terms.
Focus on: trigger event (list-price decrease, MAP change), protection window
(days before & after the change), eligible inventory definition, claim filing
window, calculation basis (price-delta × on-hand units), exclusions.`,
    ruleExtractionPrompt: `Extract price-protection rules.

Capture per rule:
- ruleType: price_protection (or fixed / percentage if simpler)
- triggerEvent: list_price_decrease | map_change | promotional_price
- protectionWindowDaysBefore, protectionWindowDaysAfter
- eligibleInventoryBasis: on_hand_units | in_transit | both
- calculationFormula: priceDelta * eligibleUnits
- claimFilingWindowDays
- exclusions (clearance, EOL, special-order)
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Price Protection terms:
- On-Hand Inventory → INVENTORY_QTY_ONHAND
- Old Price → PRICE_PRIOR
- New Price → PRICE_CURRENT
- Price Delta → PRICE_DELTA
- Protection Window → PROTECTION_DAYS
- GL → PRICE_PROTECTION_LIABILITY / PRICE_PROTECTION_EXPENSE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "price_protection",
      "ruleName": "Standard Price Protection",
      "formulaDefinition": {
        "triggerEvent": "list_price_decrease",
        "protectionWindowDaysBefore": 30,
        "protectionWindowDaysAfter": 0,
        "eligibleInventoryBasis": "on_hand_units",
        "calculationFormula": "priceDelta * eligibleUnits"
      },
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Price Protection terms from CHUNKS. Cite for trigger, window length,
eligible-inventory definition, calculation formula, claim deadline.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract price-protection rules with explicit trigger and window citations.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // MDF — Market Development Funds
  // Co-op marketing / promo accruals, often a fixed % of purchases or fixed $$.
  // ===========================================================================
  MDF: {
    extractionPrompt: `You are extracting Market Development Funds (MDF) program terms.
Focus on: accrual basis (% of purchases / fixed quarterly / sales-driven),
allowed-use list (advertising, trade shows, training, demos), pre-approval
workflow, claim documentation requirements, expiration / use-it-or-lose-it.`,
    ruleExtractionPrompt: `Extract MDF accrual & utilization rules.

Capture per rule:
- ruleType: percentage | fixed
- baseRate
- aggregationPeriod: monthly | quarterly | annual
- allowedUses (array of approved categories)
- requiresPreApproval (boolean)
- claimDocumentationRequired (proof of performance, invoices)
- expirationPolicy: rollover | use_or_lose | extended_window
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map MDF terms:
- MDF Accrual → MDF_ACCRUAL_AMT
- Eligible Purchases → PURCHASES_NET
- Approved Spend → MDF_CLAIMED_AMT
- Available Balance → MDF_BALANCE
- GL → COOP_FUND_LIABILITY / MARKETING_EXPENSE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "percentage",
      "ruleName": "MDF Accrual on Net Purchases",
      "baseRate": 2.0,
      "aggregationPeriod": "quarterly",
      "formulaDefinition": {
        "allowedUses": ["advertising", "trade_shows", "training", "demo_units"],
        "requiresPreApproval": true,
        "expirationPolicy": "use_or_lose"
      },
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting MDF program terms from CHUNKS. Cite for accrual rate / amount, allowed
uses list, approval workflow, expiration policy.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract MDF rules. Allowed-use list and expiration policy live inside
formulaDefinition with citations.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // CB — Chargeback (claim-based recovery, common in pharma / electronics)
  // ===========================================================================
  CB: {
    extractionPrompt: `You are extracting Chargeback program terms.
Focus on: claim trigger (downstream sale to a contract-priced customer), claim
amount basis (contract-price minus invoice-price), eligible customer list,
filing window, supporting-document requirements, dispute resolution.`,
    ruleExtractionPrompt: `Extract chargeback claim rules.

Capture per rule:
- ruleType: chargeback (or fixed / percentage)
- claimAmountFormula: invoice_price - contract_price
- eligibleCustomerListSource: tier_program | direct_contract | gpo_membership
- filingWindowDays
- requiredDocumentation (line-level invoice, end-customer ID, etc.)
- exclusions
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Chargeback terms:
- Invoice Price → INVOICE_UNIT_PRICE
- Contract Price → CONTRACT_UNIT_PRICE
- Chargeback Amount → CB_AMT
- End Customer → END_CUSTOMER_ID
- GL → CHARGEBACK_LIABILITY / GROSS_TO_NET`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "chargeback",
      "ruleName": "Wholesaler Chargeback",
      "formulaDefinition": {
        "claimAmountFormula": "invoicePrice - contractPrice",
        "eligibleCustomerListSource": "direct_contract",
        "filingWindowDays": 90
      },
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Chargeback program terms from CHUNKS. Cite for claim formula, eligible-
customer scope, filing window, documentation list.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract chargeback rules with explicit citations on claim formula.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // MIN — Minimum Guarantee (floor / shortfall settlement)
  // ===========================================================================
  MIN: {
    extractionPrompt: `You are extracting Minimum Guarantee program terms.
Focus on: minimum amount, measurement period, what counts toward the minimum
(earned royalties, net sales, units), shortfall trigger & remedy (cash payment,
credit, recoupment), carry-forward rules, termination conditions.`,
    ruleExtractionPrompt: `Extract minimum-guarantee rules.

Capture per rule:
- ruleType: minimum_guarantee
- minimumGuarantee (the floor $)
- aggregationPeriod: monthly | quarterly | annual | contract_total
- minimumBasis: earned_royalty | net_sales | units
- shortfallRemedy: cash_payment | credit_to_advance | rolling_recoupment
- carryForwardAllowed (boolean) — does over-performance in one period offset
  shortfall in another?
- terminationOnShortfall (boolean) — does missing the minimum trigger termination?
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Minimum Guarantee terms:
- Minimum Floor → MIN_GUARANTEE_AMT
- Earned Amount → EARNED_AMT
- Shortfall → SHORTFALL_AMT
- Period → MEASUREMENT_PERIOD
- GL → MIN_GUARANTEE_LIABILITY`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "minimum_guarantee",
      "ruleName": "Quarterly Minimum Royalty",
      "minimumGuarantee": 100000,
      "aggregationPeriod": "quarterly",
      "formulaDefinition": {
        "minimumBasis": "earned_royalty",
        "shortfallRemedy": "cash_payment",
        "carryForwardAllowed": false
      },
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Minimum Guarantee terms from CHUNKS. Cite for floor amount, period,
basis, shortfall remedy, carry-forward language.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract minimum-guarantee rules with explicit shortfall remedy citation.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // PTR — Pass-Through Recovery (cost-pass-through arrangements)
  // ===========================================================================
  PTR: {
    extractionPrompt: `You are extracting Pass-Through Recovery program terms.
A cost incurred by one party is recovered from another at-cost or cost-plus.
Examples: shipping fees, regulatory pass-through, third-party fees, currency
hedging costs.`,
    ruleExtractionPrompt: `Extract pass-through recovery rules.

Capture per rule:
- ruleType: pass_through (or fixed / percentage)
- costBasis: actual_cost | standard_cost | invoice_amount
- markup (% or $ added on top — 0 for at-cost)
- recoveryFrequency: monthly | quarterly | annual | per_sale
- documentationRequired (third-party invoices, etc.)
- exclusions (mark-up restrictions, capped amounts)
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Pass-Through Recovery terms:
- Cost Incurred → COST_AMT
- Markup → MARKUP_PCT
- Recovery Amount → RECOVERY_AMT
- GL → PASS_THROUGH_RECEIVABLE / COST_RECOVERY`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "pass_through",
      "ruleName": "Freight Pass-Through at Cost",
      "formulaDefinition": {
        "costBasis": "actual_cost",
        "markup": 0,
        "recoveryFrequency": "monthly"
      },
      "priority": 1
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Pass-Through Recovery terms from CHUNKS. Cite for cost basis, markup,
recovery cadence, documentation requirements.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract pass-through rules with explicit citations on cost basis & markup.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // COM — Commission (sales commission, partner SPIFFs, broker fees)
  // ===========================================================================
  COM: {
    extractionPrompt: `You are extracting Commission program terms.
Focus on: commission basis (revenue / margin / units / deal count), rate
schedule (often deal-type specific), draw / advance, clawback on cancellation,
quota / accelerator structure, payment timing.`,
    ruleExtractionPrompt: `Extract commission rules. Multi-year or multi-tier ladders = ONE rule per row.

Capture per rule:
- ruleType: percentage | tiered | fixed | milestone_tiered
- commissionBasis: revenue | margin | units | deal_count
- baseRate (whole-number for %)
- dealType: registered | influenced | renewal | new_business
- aggregationPeriod: per_sale | monthly | quarterly | annual
- volumeTiers / milestoneTiers (quotas, accelerators)
- clawbackTrigger: customer_cancellation | non_payment | refund
- paymentTiming: on_invoice | on_payment_received | quarterly_settlement
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Commission terms:
- Sales Rep / Partner → REP_ID / PARTNER_ID
- Commission Basis → COMMISSION_BASIS_AMT
- Commission Rate → COMMISSION_PCT
- Quota → QUOTA_AMT
- Accelerator → ACCELERATOR_PCT
- Clawback → CLAWBACK_AMT
- GL → COMMISSION_PAYABLE / COMMISSION_EXPENSE`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "tiered",
      "ruleName": "Sales Commission - Quota-Based",
      "commissionBasis": "revenue",
      "milestoneTiers": [
        {"thresholdRevenue": 0,       "rate": 6.0},
        {"thresholdRevenue": 500000,  "rate": 9.0},
        {"thresholdRevenue": 1000000, "rate": 12.0}
      ],
      "aggregationPeriod": "annual",
      "priority": 1
    },
    {
      "ruleType": "percentage",
      "ruleName": "Renewal Commission",
      "baseRate": 4.0,
      "formulaDefinition": {"dealType": "renewal"},
      "priority": 2
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Commission program terms from CHUNKS. Cite for basis, every rate,
quota threshold, accelerator, clawback trigger, payment timing.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract commission rules. Multi-tier quotas → one rule per band, with citations.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },

  // ===========================================================================
  // SBE — Service / Billing Event (per-event service fees, professional services)
  // ===========================================================================
  SBE: {
    extractionPrompt: `You are extracting Service / Billing Event program terms.
Focus on: billable event types (consultations, deployments, support tickets,
implementation milestones), per-event price, included quotas (covered under
subscription), overage rates, T&M vs. fixed-fee structure, milestone payments.`,
    ruleExtractionPrompt: `Extract service / billing-event rules.

Capture per rule:
- ruleType: per_unit | fixed | percentage | tiered
- billableEvent: consultation | deployment | support_ticket | milestone | hourly_tnm
- baseRate (price per event / hour / milestone)
- aggregationPeriod: per_sale | monthly | quarterly
- includedQuota (events covered under base subscription)
- overageRate (when present)
- milestoneSchedule (for milestone-based billing)
- sourceText, confidence, priority`,
    erpMappingPrompt: `Map Service / Billing Event terms:
- Service Type → SERVICE_CODE
- Quantity → SERVICE_QTY
- Per-Event Rate → SERVICE_RATE
- Milestone → MILESTONE_ID
- GL → SERVICES_REVENUE / SERVICES_DEFERRED`,
    sampleExtractionOutput: `{
  "rules": [
    {
      "ruleType": "per_unit",
      "ruleName": "Professional Services - T&M",
      "baseRate": 250,
      "formulaDefinition": {"billableEvent": "hourly_tnm", "meterUnit": "hour"},
      "priority": 1
    },
    {
      "ruleType": "fixed",
      "ruleName": "Implementation Milestone - Phase 1",
      "baseRate": 50000,
      "formulaDefinition": {"milestoneTrigger": "go_live_signoff"},
      "priority": 2
    }
  ]
}`,
    ragExtractionPrompt: `${RAG_HEADER}

Extracting Service / Billing Event terms from CHUNKS. Cite for event type, rate,
included quota, overage rate, milestone schedule.`,
    ragRuleExtractionPrompt: `${RAG_HEADER}

Extract service / billing-event rules with explicit billable-event citations.`,
    ragSampleExtractionOutput: `Same with sourceSpan per rule.`,
  },
};

export function getDefaultSubtypePrompt(code: string): SubtypePromptDefaults | null {
  return DEFAULT_SUBTYPE_PROMPTS[code] || null;
}

export function getAllDefaultSubtypePrompts(): Record<string, SubtypePromptDefaults> {
  return DEFAULT_SUBTYPE_PROMPTS;
}
