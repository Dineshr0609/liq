# LicenseIQ Database Tables Reference

This document covers all tables involved in contract rule extraction, license fee calculation, and the 3-Stage Processing Pipeline.

---

## Table of Contents

1. [Contract Storage](#1-contract-storage)
2. [Rule Extraction & Storage](#2-rule-extraction--storage)
3. [Sales Data](#3-sales-data)
4. [Calculation Engine](#4-calculation-engine)
5. [3-Stage Pipeline Tables (New)](#5-3-stage-pipeline-tables-new)
6. [Pipeline Reference Data (New)](#6-pipeline-reference-data-new)
7. [Data Flow Diagram](#7-data-flow-diagram)

---

## 1. Contract Storage

### `contracts`
The primary table storing uploaded contract documents and their metadata.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID, auto-generated |
| file_name | varchar | NO | Stored filename (UUID-based) |
| original_name | varchar | NO | Original uploaded filename |
| file_size | integer | NO | File size in bytes |
| file_type | varchar | NO | MIME type (e.g., application/pdf) |
| file_path | varchar | NO | Server file path |
| contract_type | varchar | YES | Type code (e.g., royalty_license) |
| status | varchar | NO | Processing status (uploaded → processing → analyzed) |
| counterparty_name | varchar | YES | Other party in the contract |
| company_id | varchar (FK) | YES | Links to companies table |
| business_unit_id | varchar (FK) | YES | Links to business_units table |
| location_id | varchar (FK) | YES | Links to locations table |
| contract_number | varchar | YES | User-assigned contract number |
| display_name | varchar | YES | Human-readable name |
| effective_start | timestamp | YES | Contract start date |
| effective_end | timestamp | YES | Contract end date |
| approval_state | varchar | NO | draft, pending_approval, approved, rejected |
| current_version | integer | NO | Version counter (default: 1) |
| raw_text | text | YES | Full extracted text content |
| created_at | timestamp | YES | Record creation timestamp |

**Sample Data:**

| id | original_name | contract_type | status | counterparty_name |
|----|--------------|---------------|--------|-------------------|
| 303d2cc0-... | MVP_Distributor_Rebate_Agreement_TechSound.pdf | royalty_license | analyzed | Tech Sound Audio |

---

## 2. Rule Extraction & Storage

### `royalty_rules`
Stores all AI-extracted and manually created contract rules. This is the central table for the rules engine.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID, auto-generated |
| contract_id | varchar (FK) | NO | Links to contracts table |
| rule_type | varchar | NO | Type: tiered, percentage, fixed_fee, container_size_tiered, rebate_tiered, condition, data-only, payment_schedule, offset, etc. |
| rule_name | varchar | NO | Human-readable rule name |
| description | text | YES | Detailed description |
| product_categories | text[] | YES | Array of product names/categories this rule applies to |
| territories | text[] | YES | Array of territories (e.g., United States, Canada) |
| volume_tiers | jsonb | YES | Tiered pricing structure (see sample below) |
| base_rate | numeric | YES | Base percentage or per-unit rate |
| minimum_guarantee | numeric | YES | Minimum payment amount |
| calculation_formula | text | YES | Human-readable formula description |
| formula_definition | jsonb | YES | Structured formula for universal evaluator |
| priority | integer | YES | Rule priority (lower = higher priority) |
| is_active | boolean | YES | Whether rule is active for calculations |
| confidence | numeric | YES | AI extraction confidence (0-1) |
| source_section | varchar | YES | Contract section where rule was found |
| source_text | text | YES | Original contract text |
| clause_category | varchar | YES | Category code (general, pricing, payment, etc.) |
| customer_segments | text[] | YES | Array of customer segments |
| channel | varchar | YES | Sales channel filter |
| seasonal_adjustments | jsonb | YES | Season-based rate multipliers |
| territory_premiums | jsonb | YES | Territory-based rate multipliers |
| exceptions | jsonb | YES | Exception conditions |
| extraction_order | integer | YES | Order rule was extracted from document |
| template_code | varchar | YES | Pipeline rule template (T1-T12) |
| execution_group | varchar | YES | Pipeline execution group (periodic, adjustment, event) |
| base_metric | varchar | YES | Pipeline base metric (net_sales, units, etc.) |
| effective_date | timestamp | YES | Rule effective start |
| expiry_date | timestamp | YES | Rule expiry date |
| review_status | varchar | YES | pending, approved, rejected |
| field_mappings | jsonb | YES | Dynamic column name mappings |

**Sample Data — Tiered Rebate Rule:**

| rule_name | rule_type | product_categories | territories | volume_tiers |
|-----------|-----------|-------------------|-------------|--------------|
| Quarterly Volume Rebate - Tiered by Units | tiered | {SoundPro Wireless Headphones - Black (TS-WH-PRO-001-BLK), SoundPro Wireless Headphones - White (TS-WH-PRO-001-WHT), ...8 products} | {United States, Canada, Mexico} | (see below) |

**volume_tiers JSON structure:**
```json
[
  {"min": 0, "max": 1000, "rate": 0.02, "description": "Tier 1: 0-1,000 units"},
  {"min": 1001, "max": 5000, "rate": 0.05, "description": "Tier 2: 1,001-5,000 units"},
  {"min": 5001, "max": null, "rate": 0.08, "description": "Tier 3: 5,001+ units"}
]
```

**formula_definition JSON structure (AI-extracted):**
```json
{
  "type": "tiered",
  "baseRate": 0.05,
  "calculationBasis": "net_sales",
  "tiers": [
    {"min": 0, "max": 1000, "rate": 0.02},
    {"min": 1001, "max": 5000, "rate": 0.05},
    {"min": 5001, "max": null, "rate": 0.08}
  ]
}
```

**Sample Data — All Rules for TechSound Rebate Contract:**

| rule_name | rule_type | clause_category |
|-----------|-----------|----------------|
| Agreement Type | data-only | general |
| Term Duration | condition | general |
| Territory | data-only | general |
| Eligible Products List | data-only | general |
| Quarterly Volume Rebate Tiers | container_size_tiered | general |
| Rebate Application Basis | condition | general |
| Calculation Period | condition | general |
| Eligible Sales Definition | condition | general |
| Excluded Sales | condition | general |
| Reporting Requirement | condition | general |
| Rebate Payment Terms | payment_schedule | general |
| Adjustments for Returns and Credits | condition | general |
| Termination Payment Terms | condition | general |
| Quarterly Volume Rebate - Tiered by Units | tiered | general |
| Rebate Overpayment Offset | offset | general |

### `extraction_runs`
Tracks each AI extraction run against a contract, including the 3-stage pipeline runs.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| contract_id | varchar (FK) | NO | Links to contracts |
| run_type | varchar | NO | Type: zero_shot, pipeline, re_extraction |
| status | varchar | NO | pending, running, completed, failed |
| overall_confidence | numeric | YES | Average confidence score |
| nodes_extracted | integer | YES | Knowledge graph nodes created |
| edges_extracted | integer | YES | Knowledge graph edges created |
| rules_extracted | integer | YES | Number of rules extracted |
| ai_model | varchar | YES | AI model used (e.g., claude-sonnet-4-5) |
| processing_time | integer | YES | Duration in milliseconds |
| current_stage | varchar | YES | Pipeline: stage_a, stage_b, stage_c |
| stage_a_status | varchar | YES | Clause Segmentation status |
| stage_b_status | varchar | YES | Rule Template Mapping status |
| stage_c_status | varchar | YES | Conflict Detection status |
| pipeline_mode | varchar | YES | Pipeline execution mode |
| created_at | timestamp | YES | Run start time |
| completed_at | timestamp | YES | Run completion time |

---

## 3. Sales Data

### `sales_data`
Stores uploaded sales/transaction data that gets matched to contracts for fee calculation.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| matched_contract_id | varchar (FK) | YES | Contract this sale is matched to |
| match_confidence | numeric | YES | AI matching confidence |
| transaction_date | timestamp | NO | Date of the transaction |
| transaction_id | varchar | YES | External transaction reference |
| product_code | varchar | YES | SKU or product code |
| product_name | varchar | YES | Product display name |
| category | varchar | YES | Product category |
| territory | varchar | YES | Sales territory |
| currency | varchar | YES | Transaction currency |
| gross_amount | numeric | NO | Gross sale amount |
| net_amount | numeric | YES | Net amount after deductions |
| quantity | numeric | YES | Units sold |
| unit_price | numeric | YES | Price per unit |
| custom_fields | jsonb | YES | Additional fields from CSV (transaction_type, rebate_eligible, quarter, etc.) |
| import_job_id | varchar (FK) | YES | Links to data_import_jobs |
| company_id | varchar (FK) | YES | Company context |
| business_unit_id | varchar (FK) | YES | Business unit context |
| location_id | varchar (FK) | YES | Location context |

**Sample Data:**

| product_name | territory | quantity | gross_amount | transaction_date |
|-------------|-----------|----------|-------------|-----------------|
| SoundPro Wireless Headphones - Black | | 300 | $76,500.00 | 2026-01-15 |
| SoundPro Wireless Headphones - White | | 250 | $63,750.00 | 2026-02-10 |
| EssentialSound Wireless - Black | | 400 | $51,000.00 | 2026-03-05 |
| Studio Wired Pro - Black | | 80 | $13,600.00 | 2026-03-18 |
| SoundPro Wireless Headphones - Silver | | 50 | $9,000.00 | 2026-03-25 |
| PremiumSound Max - Black | | 600 | $180,000.00 | 2026-04-12 |
| PremiumSound Max - White | | 500 | $150,000.00 | 2026-05-09 |
| EssentialSound Wireless - White | | 450 | $57,375.00 | 2026-06-02 |
| SoundPro Wireless Headphones - Black | | 75 | $19,125.00 | 2026-06-20 |

---

## 4. Calculation Engine

### `contract_royalty_calculations`
Stores saved calculation results (each "Run Calculation" creates one record).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| contract_id | varchar (FK) | NO | Contract calculated against |
| name | varchar | NO | User-given calculation name |
| period_start | timestamp | YES | Calculation period start |
| period_end | timestamp | YES | Calculation period end |
| status | varchar | YES | pending, completed, approved, rejected |
| total_sales_amount | numeric | YES | Sum of all sale amounts |
| total_royalty | numeric | YES | Final calculated license fee |
| currency | varchar | YES | Calculation currency |
| sales_count | integer | YES | Number of sales processed |
| breakdown | jsonb | YES | Per-product calculation breakdown |
| chart_data | jsonb | YES | Visualization data (min guarantee, rules applied) |
| calculated_by | varchar (FK) | YES | User who ran calculation |
| approved_by | varchar (FK) | YES | Approver user |
| company_id | varchar (FK) | YES | Company context |

**breakdown JSON structure:**
```json
[
  {
    "saleId": "quarterly-2026-Q1-SoundPro...",
    "productName": "SoundPro Wireless Headphones - Black",
    "territory": "All",
    "quantity": 300,
    "saleAmount": 76500,
    "royaltyAmount": "3825.00",
    "ruleApplied": "Quarterly Volume Rebate - Tiered by Units",
    "explanation": "Q1 2026 Rebate: $76,500 x 5.0% = $3,825.00 [Quarterly total: 1,080 units]"
  }
]
```

### `calculation_line_items`
Granular line-item detail for each calculation (used by the universal formula evaluator).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| calculation_id | varchar (FK) | NO | Parent calculation |
| contract_id | varchar (FK) | NO | Contract reference |
| sales_data_id | varchar (FK) | YES | Source sale record |
| rule_id | varchar (FK) | YES | Rule that was applied |
| blueprint_id | varchar (FK) | YES | ERP blueprint used |
| transaction_date | timestamp | YES | Sale date |
| sales_amount | numeric | YES | Sale amount |
| quantity | numeric | YES | Units |
| calculated_fee | numeric | NO | Calculated license fee |
| applied_rate | numeric | YES | Rate used |
| rule_name | varchar | YES | Name of applied rule |
| rule_type | varchar | YES | Type of applied rule |
| tier_applied | varchar | YES | Which tier was matched |
| dimensions | jsonb | NO | Multi-dimensional attributes |
| vendor_name | varchar | YES | ERP vendor name |
| item_name | varchar | YES | ERP item name |
| territory | varchar | YES | Territory |
| period | varchar | YES | Calculation period |

### `calculation_blueprints`
Pre-materialized calculation templates that combine contract rules with ERP field mappings.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| contract_id | varchar (FK) | NO | Contract reference |
| company_id | varchar (FK) | NO | Company reference |
| royalty_rule_id | varchar (FK) | NO | Source rule |
| erp_rule_set_id | varchar (FK) | YES | ERP rule set |
| name | varchar | NO | Blueprint name |
| rule_type | varchar | NO | Calculation type |
| calculation_logic | jsonb | NO | Calculation formula structure |
| erp_field_bindings | jsonb | YES | ERP field mappings |
| dual_terminology_map | jsonb | YES | Contract term ↔ ERP field mapping |
| matching_criteria | jsonb | YES | Product/territory matching rules |
| priority | integer | NO | Evaluation priority |
| status | varchar | NO | active, draft, deprecated |
| is_fully_mapped | boolean | NO | All fields mapped? |

### `org_calculation_settings`
Organization-level calculation configuration.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| company_id | varchar (FK) | NO | Company reference |
| calculation_approach | varchar | NO | manual, erp_rules, erp_mapping_rules, hybrid |
| default_approach | boolean | NO | Is this the default? |
| allow_contract_override | boolean | NO | Can contracts override? |

---

## 5. 3-Stage Pipeline Tables (New)

These tables were created for the 3-Stage Contract Processing Pipeline feature.

### `contract_clauses`
**Stage A output.** Stores individual clauses segmented from a contract.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| contract_id | varchar (FK) | NO | Source contract |
| extraction_run_id | varchar (FK) | YES | Pipeline run that created this |
| clause_identifier | varchar | YES | Sequential ID (CL-01, CL-02, ...) |
| section_ref | varchar | YES | Contract section reference (e.g., "6. Rebate Tiers") |
| text | text | NO | Full clause text |
| clause_category_code | varchar (FK) | YES | Links to clause_categories (qualification, financial_calculation, etc.) |
| flow_type_code | varchar (FK) | YES | Links to flow_types (rebate, commission, etc.) |
| affects_accrual | boolean | NO | Whether this clause affects financial accruals |
| confidence | real | YES | AI classification confidence (0-1) |
| evidence | jsonb | YES | Supporting evidence for classification |
| created_at | timestamp | YES | Creation timestamp |

**Sample Data:**

| clause_identifier | section_ref | clause_category_code | flow_type_code | affects_accrual | confidence |
|------------------|-------------|---------------------|---------------|----------------|------------|
| CL-01 | 1. Parties | governance_risk | rebate | false | 1.0 |
| CL-02 | 2. Agreement Type | governance_risk | rebate | false | 1.0 |
| CL-03 | 3. Effective Dates | governance_risk | rebate | false | 1.0 |
| CL-04 | 4. Territory | qualification | rebate | true | 1.0 |
| CL-05 | 5. Eligible Products | qualification | rebate | true | 1.0 |

### `rule_conflicts`
**Stage C output.** Stores detected conflicts between extracted rules.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| contract_id | varchar (FK) | NO | Source contract |
| extraction_run_id | varchar (FK) | YES | Pipeline run |
| conflict_identifier | varchar | YES | Conflict ID (CF-01, CF-02, ...) |
| rule_ids | jsonb | YES | Array of conflicting rule IDs |
| reason | text | YES | Description of the conflict |
| resolution | text | YES | Suggested resolution |
| created_at | timestamp | YES | Detection timestamp |

### `extraction_stage_results`
Tracks the output of each pipeline stage (A, B, C) per extraction run.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar (PK) | NO | UUID |
| extraction_run_id | varchar (FK) | NO | Parent extraction run |
| stage | varchar | NO | stage_a, stage_b, stage_c |
| status | varchar | NO | pending, running, completed, failed |
| raw_output | jsonb | YES | Full AI response for this stage |
| error_message | text | YES | Error details if failed |
| started_at | timestamp | YES | Stage start time |
| completed_at | timestamp | YES | Stage completion time |

---

## 6. Pipeline Reference Data (New)

These are seeded lookup/reference tables that define the vocabulary for the 3-Stage Pipeline.

### `flow_types`
Defines the types of financial flows a contract clause can represent.

| Code | Name | Description |
|------|------|-------------|
| rebate | Rebate | Rebate payments based on volume or performance targets |
| commission | Commission | Sales commission payments based on performance |
| royalty | Royalty | Royalty payments based on licensed IP usage |
| price_protection | Price Protection | Price protection adjustments for inventory value changes |
| chargeback | Chargeback | Chargeback claims for price differences or returns |
| mdf | MDF | Market Development Fund allocations and claims |
| ship_and_debit | Ship and Debit | Ship and debit programs for competitive pricing |
| other | Other | Other financial flow types |

### `clause_execution_groups`
Defines when/how clauses are executed in the calculation engine.

| Code | Name | Description |
|------|------|-------------|
| periodic | Periodic | Clauses considered for accrual calculations on a recurring basis |
| adjustment | Adjustment | Adjustments applied on top of periodic calculations (caps, floors, true-ups) |
| event | Event | Event-based clauses not part of regular accrual cycles |

### `rule_templates`
The 12 standard rule templates (T1-T12) used in Stage B of the pipeline.

| Code | Name | Execution Group | Required Fields |
|------|------|-----------------|----------------|
| T1 | Percentage Revenue | periodic | base_metric, rate_or_amount, frequency |
| T2 | Per Unit | periodic | rate_or_amount, frequency |
| T3 | Tiered Rate | periodic | base_metric, tier_table, frequency |
| T4 | Threshold Trigger | periodic | base_metric, threshold, rate_or_amount |
| T5 | Revenue Split | periodic | base_metric, rate_or_amount, frequency |
| T6 | Fixed Amount Payment | periodic | rate_or_amount, frequency |
| T7 | Cap | adjustment | cap_or_floor |
| T8 | Floor / Minimum Payout | adjustment | cap_or_floor |
| T9 | Minimum Guarantee True-Up | adjustment | cap_or_floor, frequency |
| T10 | Offset / Deduction | adjustment | offset |
| T11 | Late Payment Interest | event | rate_or_amount, trigger_event, grace_period |
| T12 | Reporting Compliance Penalty | event | rate_or_amount, trigger_event |

### `base_metrics`
Standard metrics that rules can be calculated against.

| Code | Name | Description |
|------|------|-------------|
| gross_sales | Gross Sales | Gross sales amount before deductions |
| net_sales | Net Sales | Net sales amount after returns and allowances |
| units | Units | Quantity of units sold or shipped |
| margin | Margin | Profit margin (revenue minus cost) |
| invoice_amount | Invoice Amount | Total invoice amount billed |
| subscription_revenue | Subscription Revenue | Recurring subscription-based revenue |
| outstanding_balance | Outstanding Balance | Amount currently owed |
| other | Other | Custom base metric |

### `clause_categories`
Classification categories for contract clauses.

| Code | Name | Description |
|------|------|-------------|
| financial_calculation | Financial Calculation | Clauses defining how payments/rebates/fees are calculated |
| qualification | Qualification | Eligibility criteria, conditions, prerequisites |
| adjustment | Adjustment | Modifiers to calculated amounts (caps, floors, true-ups) |
| operational | Operational | Reporting, data submission, process obligations |
| event_penalty | Event / Penalty | Triggered by late payment, non-compliance, etc. |
| governance_risk | Governance / Risk | Governance, audit rights, compliance obligations |

---

## 7. Data Flow Diagram

```
CONTRACT UPLOAD
     │
     ▼
┌─────────────┐
│  contracts  │ ← Stores PDF, metadata, raw_text
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ extraction_runs  │ ← Tracks each AI extraction attempt
└──────┬───────────┘
       │
       ├─── Standard Extraction (zero_shot) ───────────────────────────┐
       │                                                                │
       │    ┌─────────────────┐                                        │
       │    │  royalty_rules   │ ← AI-extracted rules with             │
       │    │                 │   volume_tiers, formula_definition,     │
       │    │                 │   product_categories, territories       │
       │    └─────────────────┘                                        │
       │                                                                │
       └─── 3-Stage Pipeline (pipeline) ───────────────────────────────┤
            │                                                           │
            │  Stage A: Clause Segmentation                            │
            │  ┌──────────────────┐                                    │
            │  │ contract_clauses │ ← Segmented clauses with           │
            │  │                  │   category, flow_type, accrual     │
            │  └──────────────────┘                                    │
            │                                                           │
            │  Stage B: Rule Template Mapping                          │
            │  ┌─────────────────┐                                     │
            │  │  royalty_rules   │ ← Rules mapped to T1-T12           │
            │  │  (template_code, │   templates with execution_group,  │
            │  │   base_metric)   │   base_metric                      │
            │  └─────────────────┘                                     │
            │                                                           │
            │  Stage C: Conflict Detection                             │
            │  ┌────────────────┐                                      │
            │  │ rule_conflicts  │ ← Detected conflicts between rules │
            │  └────────────────┘                                      │
            │                                                           │
            │  ┌──────────────────────────┐                            │
            │  │ extraction_stage_results │ ← Per-stage output/status  │
            │  └──────────────────────────┘                            │
            │                                                           │
            └───────────────────────────────────────────────────────────┘

SALES DATA UPLOAD
     │
     ▼
┌─────────────┐
│ sales_data  │ ← CSV upload with product, quantity, amount, dates
└──────┬──────┘
       │
       ▼ (matched to contract)
┌──────────────────────┐
│ CALCULATION ENGINE   │
│                      │
│  Mode: universal ──► calculationService.ts
│    (detects quarterly rebate → routes to legacy)
│                      │
│  Mode: legacy ─────► dynamicRulesEngine.ts
│    (quarterly aggregation, tiered rate lookup)
│                      │
└──────────┬───────────┘
           │
           ▼
┌────────────────────────────────┐
│ contract_royalty_calculations  │ ← Saved calculation result
│   + breakdown (jsonb)         │   with per-product breakdown
└────────────────────────────────┘
           │
           ▼
┌────────────────────────┐
│ calculation_line_items │ ← Granular line-item detail
└────────────────────────┘
```

### Calculation Flow for Quarterly Rebate (TechSound Example)

```
1. Sales data (9 rows) matched to contract 303d2cc0-...

2. Rules loaded: 15 rules (2 tiered rebate rules detected)
   - "Quarterly Volume Rebate - Tiered by Units" (tiered → auto-reclassified to rebate_tiered)
   - "Quarterly Volume Rebate Tiers" (container_size_tiered → auto-reclassified to rebate_tiered)

3. Quarterly Aggregation:
   Q1 2026: 1,080 units (5 products) → Tier 2 (1,001-5,000) → 5.0%
   Q2 2026: 1,625 units (4 products) → Tier 2 (1,001-5,000) → 5.0%

4. Per-Product Rebate Calculation:
   Q1: $76,500 × 5% = $3,825.00  (SoundPro Black, 300 units)
   Q1: $63,750 × 5% = $3,187.50  (SoundPro White, 250 units)
   Q1: $51,000 × 5% = $2,550.00  (EssentialSound Black, 400 units)
   Q1: $13,600 × 5% = $680.00    (Studio Wired Pro, 80 units)
   Q1:  $9,000 × 5% = $450.00    (SoundPro Silver, 50 units)
   Q2: $180,000 × 5% = $9,000.00 (PremiumSound Black, 600 units)
   Q2: $150,000 × 5% = $7,500.00 (PremiumSound White, 500 units)
   Q2:  $57,375 × 5% = $2,868.75 (EssentialSound White, 450 units)
   Q2:  $19,125 × 5% = $956.25   (SoundPro Black, 75 units)

5. Total License Fee: $31,017.50
```
