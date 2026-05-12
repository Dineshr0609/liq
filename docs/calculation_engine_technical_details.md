# LicenseIQ Calculation Engine — Technical Documentation

## Overview

The LicenseIQ calculation engine processes sales transaction data against configured contract rules to compute rebate amounts. The pipeline flows through: **Data Ingestion → Rule Matching → Calculation → Accruals → Journal Entries → Period Close**.

---

## 1. Data Ingestion

### Entry Point
- **API:** `POST /api/sales/upload`
- **Service:** `server/services/salesDataParser.ts`
- **Accepts:** CSV or Excel files

### Storage Table: `sales_data`
| Column | Description |
|--------|-------------|
| `id` | Primary key (UUID) |
| `matched_contract_id` | Linked contract (nullable) |
| `transaction_date` | Date of the sale |
| `transaction_id` | Invoice/transaction number |
| `product_code` | SKU or product code (e.g., "POT-50-RUS", "4350-20") |
| `product_name` | Product description |
| `category` | Product category/hierarchy (e.g., "Potatoes", "Onions", "General") |
| `territory` | Sales territory |
| `gross_amount` | Total sale amount |
| `net_amount` | Net sale amount (after discounts) |
| `quantity` | Units/cases sold |
| `unit_price` | Price per unit |
| `channel` | Sales channel |
| `customer_code` | Customer identifier |
| `custom_fields` | JSONB — stores any non-standard CSV columns |

### Field Normalization
The parser normalizes common CSV headers to internal field names:
- "SKU" → `productCode`
- "Units", "Qty", "Volume" → `quantity`
- "Sales Amount", "Total" → `grossAmount`
- "Region", "Country" → `territory`
- "Type", "Family" → `category`

---

## 2. Contract Rules Storage

### Table: `contract_rules`
Rules are stored in the `contract_rules` table with 50 columns. The key fields used during calculation:

| Column | Description | Example Values |
|--------|-------------|----------------|
| `rule_name` | Human-readable name | "General Purchases Rebate - 4%" |
| `rule_type` | Type of calculation | `percentage`, `fixed_fee`, `per_unit`, `tiered` |
| `base_rate` | The rate or fixed amount | `0.04` (4%) or `0.25` ($0.25) |
| `base_metric` | What to calculate against | `gross_sales` (dollar amount) or `units` (quantity) |
| `product_categories` | Product hierarchy filter | `{General,!Potatoes,!Onions}` |
| `territories` | Territory filter | `{General}` |
| `qualifier_groups` | JSONB — complex condition logic | See below |
| `priority` | Rule priority (1 = highest) | `1`, `2`, `3` |
| `clause_category` | Rule purpose | `Financial Calculation`, `Qualification` |
| `execution_group` | When rule executes | `Periodic`, `One-Time` |
| `effective_date` | Rule start date | `2016-01-07` |
| `expiry_date` | Rule end date (nullable) | `null` = no end |
| `minimum_price` | Minimum price floor | `0.00` |
| `review_status` | Verification status | `pending`, `under_review`, `verified` |
| `volume_tiers` | Tiered rate brackets | JSONB array |
| `exceptions` | Excluded items | JSONB array |

### Qualifier Groups Structure (JSONB)
The `qualifier_groups` column stores complex AND/OR condition logic:

```json
[
  {
    "id": "A",
    "conditions": [
      {
        "entity": "product_hierarchy",
        "field": "hierarchy_value",
        "operator": "in",
        "values": ["General"]
      },
      {
        "entity": "product_hierarchy",
        "field": "hierarchy_value",
        "operator": "not_in",
        "values": ["Potatoes", "Onions"]
      },
      {
        "entity": "territory",
        "field": "territory_name",
        "operator": "in",
        "values": ["General"]
      }
    ]
  }
]
```

- **Groups are OR'd together** — if ANY group matches, the rule applies
- **Conditions within a group are AND'd** — ALL conditions must be true
- **Supported operators:** `in`, `not_in`

---

## 3. Calculation Engine

### Key Files
| File | Role |
|------|------|
| `server/services/calculationService.ts` | Main orchestrator — decides which engine to use |
| `server/services/dynamicRulesEngine.ts` | Legacy engine — handles complex quarterly rebates |
| `server/services/universalCalculationEngine.ts` | Modern engine — executes formula-based rules |
| `server/evaluateRoutes.ts` | Test endpoints for rule evaluation |

### Engine Selection Logic
The `CalculationService` chooses the engine based on rule configuration:
1. If a rule has a `formulaDefinition` → **Universal Engine**
2. If quarterly rebate patterns detected (keywords like "quarter", volume tiers) → **Legacy Engine** (`DynamicRulesEngine`)
3. Otherwise → **Standard calculation** with specificity matching

### Step-by-Step Calculation Process

#### Step 3a: Load Rules
```
1. Fetch all active contract_rules for the contract_id
2. Filter by is_active = true
3. Sort by priority (1 = highest)
4. Group by clause_category (Financial Calculation, Qualification, etc.)
```

#### Step 3b: Match Sales Data to Rules (Specificity-First)
For each sales transaction, the engine finds the best matching rule:

```
1. STRICT EXACT MATCH — Check if product_name matches exactly
2. QUALIFIER GROUPS — Evaluate all conditions:
   a. For each group (OR logic):
      - For each condition within the group (AND logic):
        - "in" operator: Check if transaction's category/territory IS IN the values list
        - "not_in" operator: Check if transaction's category/territory IS NOT IN the values list
      - If ALL conditions pass → group matches
   b. If ANY group matches → rule applies
3. SPECIFICITY SCORING — Rules with fewer product_categories are more specific
   - "Potatoes, Onions" (2 items) is more specific than "General" (catch-all)
   - More specific rules take priority over general ones
4. PRIORITY TIE-BREAKER — If specificity is equal, use the priority field
```

#### Step 3c: Compute Rebate Amount
The computation depends on `rule_type` and `base_metric`:

| Rule Type | Base Metric | Formula | Example |
|-----------|-------------|---------|---------|
| `percentage` | `gross_sales` | `base_rate × gross_amount` | 0.04 × $2,220 = $88.80 |
| `percentage` | `units` | `base_rate × quantity` | 0.04 × 120 = 4.80 |
| `fixed_fee` / `per_unit` | `units` | `base_rate × quantity` | 0.25 × 120 = $30.00 |
| `tiered` | varies | Lookup tier bracket, apply tier rate | Volume 500+ → 5% |

**For tiered rules:**
- Per-transaction: Find matching tier for single sale's volume
- Quarterly aggregation: Sum all sales for the quarter, determine tier, apply rate back to each product

**Minimum guarantees:** After all rules are calculated, compare total against `minimum_guarantee` and take the higher value.

---

## 4. Rule Examples (CNT-2026-011)

### Rule: "General Purchases Rebate - 4%"
| Field | Value |
|-------|-------|
| Rule Type | Percentage |
| Base Rate | 0.04 (4%) |
| Base Metric | Gross Sales |
| Qualifier Group A | Product Hierarchy IN (General) AND Product Hierarchy NOT IN (Potatoes, Onions) AND Territory IN (General) |
| Calculation | For each matching sale: `0.04 × gross_amount` |

**Logic:** This rule applies to all product categories EXCEPT Potatoes and Onions. Territory "General" means all territories.

### Rule: "Potatoes and Onions Per-Unit Rebate"
| Field | Value |
|-------|-------|
| Rule Type | Fixed Fee (One-Time) |
| Base Rate | 0.25 ($0.25) |
| Base Metric | Units |
| Qualifier Group A | Product Hierarchy IN (Potatoes, Onions) AND Territory IN (General) AND Product NOT IN (4350 20) |
| Calculation | For each matching sale: `0.25 × quantity` |

**Logic:** This rule applies ONLY to Potatoes and Onions categories, but EXCLUDES the specific product code "4350-20". So a sale of "Russet Potatoes 50lb" (POT-50-RUS) gets $0.25/unit, but "4350-20 Box Potatoes" gets NO rebate from this rule.

---

## 5. Results Storage

### Table: `calculation_rule_results`
Stores per-rule frozen snapshots of each calculation:

| Column | Description |
|--------|-------------|
| `contract_id` | Which contract |
| `rule_id` | Which rule was applied |
| `calculated_amount` | The rebate amount |
| `matching_transactions` | Count of matched sales rows |
| `calculation_details` | JSONB — full trace of how amount was derived |

---

## 6. Auto-Accrual Pipeline

After calculation completes, the system automatically creates:

### Accruals (`accruals` table)
| Column | Description |
|--------|-------------|
| `contract_id` | Source contract |
| `period` | Fiscal period (e.g., "2026-Q1") |
| `accrual_amount` | Calculated rebate amount |
| `status` | `draft` → `review` → `approved` |
| `calculation_trace_id` | Link to detailed calculation steps |

### Accrual Audit Trail (`accrual_audit_trail` table)
- Records who created/modified the accrual and when
- Tracks status transitions

### Accrual Calculation Trace (`accrual_calculation_trace` table)
- Stores net sales, rates, thresholds applied
- Provides full transparency into how the number was derived

---

## 7. Journal Entry Generation

### Table: `journal_entries`
| Column | Description |
|--------|-------------|
| `source_accrual_id` | Link to the accrual |
| `je_number` | Journal entry number |
| `je_date` | Entry date |
| `total_debit` | Debit amount |
| `total_credit` | Credit amount |
| `status` | `draft` → `pending` → `approved` → `synced` → `posted` |
| `erp_sync_status` | Sync status with ERP system |

### Workflow
```
draft → pending → approved → synced (to ERP) → posted
```

Bulk operations supported: `POST /api/journal-entries/bulk-approve`
ERP sync: `POST /api/journal-entries/:id/erp-sync`

---

## 8. Period Close Workflow

### Table: `period_close`
| Column | Description |
|--------|-------------|
| `period_id` | Fiscal period reference |
| `status` | `open` → `in_review` → `approved` |
| `readiness_score` | Auto-calculated percentage |
| `close_date` | When period was closed |

### Checklist Items
The system checks:
1. All calculations have been run
2. All accruals are approved
3. All journal entries are posted
4. ERP reconciliation is complete

### Blockers
- Unbalanced journal entries
- Failed ERP syncs
- Unapproved accruals
- Must be resolved before period can be closed

### Final Approval
`POST /api/period-close/:id/approve` → Sets status to `approved`, records `close_date`, and locks the period.

---

## 9. End-to-End Data Flow Diagram

```
CSV Upload → sales_data table
                ↓
    Load contract_rules for contract
                ↓
    For each sale: Match to best rule
    (qualifier_groups AND/OR logic, specificity scoring)
                ↓
    Compute rebate: base_rate × (gross_amount OR quantity)
                ↓
    Store in calculation_rule_results
                ↓
    Auto-create accruals (draft)
                ↓
    Generate journal_entries (draft)
                ↓
    Review & Approve accruals
                ↓
    Approve & Post journal entries
                ↓
    ERP Sync (optional)
                ↓
    Period Close (readiness check → approve → lock)
```

---

## 10. Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sales/upload` | POST | Upload sales CSV/Excel |
| `/api/contracts/:id/calculate-fees` | POST | Run calculation for a contract |
| `/api/evaluate` | POST | Test rule evaluation |
| `/api/accruals/run-calculation` | POST | Process draft accruals |
| `/api/journal-entries/bulk-approve` | POST | Bulk approve JEs |
| `/api/journal-entries/:id/erp-sync` | POST | Sync JE to ERP |
| `/api/period-close/:id/approve` | POST | Approve and close period |
| `/api/admin/periods/:id/auto-populate` | POST | Auto-populate period close checklist |
