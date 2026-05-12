# LicenseIQ Calculation Engine — Full Technical Reference

## System Architecture & Component Map

| Component | File Path | Responsibility |
|---|---|---|
| `CalculationService` | `server/services/calculationService.ts` | Main orchestrator — decides which engine to use, loads qualifier maps, iterates sales against rules |
| `DynamicRulesEngine` | `server/services/dynamicRulesEngine.ts` | Legacy engine — handles complex quarterly rebates, specificity-based matching, ERP blueprint logic |
| `UniversalFormulaEvaluator` | `server/services/universalFormulaEvaluator.ts` | Core recursive evaluator — walks formula expression trees (multiply, add, tier, if/else) |
| `SalesContractMatcher` | `server/services/salesContractMatcher.ts` | Smart sales-to-contract matching — auto-assigns `matched_contract_id` based on contract rules, qualifiers, and specificity scoring |
| `SalesDataParser` | `server/services/salesDataParser.ts` | CSV/Excel parser — normalizes field names, validates data types, maps to sales_data table |
| `Calculate Routes` | `server/routes.ts` | API endpoint `POST /api/contracts/:id/calculate-fees` — orchestrates full flow |
| `Finance Routes` | `server/financeRoutes.ts` | Accrual processing, journal entry management, period close APIs |

---

## End-to-End Pipeline Flow

```
CSV Upload → Parse & Normalize → Store in sales_data → Smart Match to Contracts
    → Load Contract Rules → Build Qualifier Map
    → Match Sales ↔ Rules → Compute Amounts → Store Results
    → Auto-Accruals → Journal Entries → Period Close
```

---

## The 4 Core Tables Used in Calculation

### Table 1: `sales_data` — The Raw Sales Records

| Column | Type | Role in Calculation |
|---|---|---|
| `id` | varchar (UUID) | Unique sale identifier, tracked in the audit trail |
| `matched_contract_id` | varchar | **The most critical column** — only sales where this equals the target contract ID are loaded. If NULL, the sale is completely ignored |
| `product_name` | varchar | Matched against rule's product conditions (e.g., "CimpleIT Industrial Controller") |
| `category` | varchar | Secondary product matching (e.g., "Industrial Hardware") |
| `territory` | varchar | **Territory filter** — matched against `contract_rules.territories[]` during multi-dimensional qualifier enforcement |
| `channel` | varchar | **Channel filter** — matched against `contract_rules.channel` during multi-dimensional qualifier enforcement |
| `customer_code` | varchar | Passed to the engine but not actively filtered yet (reserved for future customer segment matching) |
| `gross_amount` | decimal(15,2) | **Primary calculation basis** — the dollar value the rate gets applied to for percentage rules |
| `net_amount` | decimal(15,2) | Used instead of gross_amount when the rule specifies "net_sales" as the calculation basis |
| `quantity` | decimal(12,4) | Used as the basis for per-unit or fixed-fee rules |
| `transaction_date` | timestamp | Must fall within the rule's effective/expiry date range |
| `product_code` | varchar | SKU identifier — checked against product exclusions (e.g., "4350-20") |
| `company_id` | varchar | Used for organizational access filtering |
| `business_unit_id` | varchar | Used for organizational access filtering |
| `location_id` | varchar | Used for organizational access filtering |

---

### Table 2: `contract_rules` — The Rules That Define How to Calculate

#### Matching Columns (decide IF a rule applies to a sale)

| Column | Type | How It Filters |
|---|---|---|
| `product_categories` | text[] | Array like `{"CimpleIT Industrial Controller","CimpleIT Sensor Module"}`. Sale's product_name or category must match one of these. If set to `{all}` or `{General}`, it matches everything. Prefix `!` = exclusion (e.g., `!Potatoes`) |
| `territories` | text[] | Array like `{"United States","Canada","Mexico"}`. Sale's territory must match. If `{all}` or empty, skipped |
| `channel` | varchar | String like `"Manufacturing"`. Sale's channel must match (case-insensitive). If empty/null, skipped |
| `customer_segments` | text[] | Array like `{Manufacturing}`. Reserved — sales_data doesn't have a segment column yet |
| `effective_date` | date | Sale's transaction_date must be on or after this |
| `expiry_date` | date | Sale's transaction_date must be on or before this |
| `priority` | integer | When multiple rules match the same sale, higher priority (lower number) wins |

#### Calculation Columns (the math)

| Column | Type | Role |
|---|---|---|
| `rule_type` | varchar | Determines the calculation method: `percentage`, `fixed_fee`, `flat_rate`, `rebate_tiered`, `milestone_tiered`, etc. |
| `base_rate` | decimal | The rate — stored as a percentage value (3.50 means 3.50%). For percentage rules, **always divided by 100** before multiplying. For fixed_fee rules, used as-is (dollar amount) |
| `base_metric` | varchar | Determines which sales_data column to read: `gross_sales` → `gross_amount`, `units` → `quantity`, `net_sales` → `net_amount` |
| `volume_tiers` | jsonb | JSON array of tier objects for tiered rules. Each tier has `min`, `max`, and `rate` |
| `milestone_tiers` | jsonb | JSON array for milestone-tiered rules: `[{fromThreshold, toThreshold, rate, rateType, retroactive}]` |
| `milestone_config` | jsonb | JSON config for milestone measurement: `{measurementBasis, measurementPeriod, retroactiveDefault}` |
| `milestones` | jsonb | JSON array for milestone payment events: `[{event, percentage, amount, dueDate, status}]` |
| `formula_definition` | jsonb | JSON formula tree — if present, overrides the simple base_rate calculation entirely |
| `field_mappings` | jsonb | Maps dynamic column names to standard calculation fields |
| `minimum_guarantee` | decimal | Floor amount — result cannot be less than this value |
| `source_clause_id` | varchar | Links rule to its originating clause — primary qualifier linkage path |
| `is_active` | boolean | Only `true` rules participate in calculations |
| `review_status` | varchar | Only `verified` / `confirmed` rules participate in calculations |
| `execution_group` | varchar | Groups rules by execution phase (event, periodic, adjustment) |

---

### Table 3: `contract_qualifiers` — Additional Qualifier Conditions

This is a **separate table** from the rule's built-in fields. It was the original way to store product inclusion/exclusion filters.

| Column | Type | Role |
|---|---|---|
| `qualifier_id` | varchar (PK) | Unique ID |
| `term_id` | varchar | Links to a specific rule (matched via `contract_clause_id`) |
| `contract_id` | varchar | Links to the contract |
| `contract_clause_id` | varchar | FK to contract_clauses — **primary linkage** to rules via `source_clause_id` |
| `qualifier_type` | varchar | Either `"inclusion"` or `"exclusion"` |
| `qualifier_field` | varchar | Currently only `"product_category"` is checked |
| `operator` | varchar | `"in"` or `"not_in"` |
| `qualifier_value` | varchar | The value to match (e.g., a product name) |

**How it works:** If a rule has qualifiers in this table with `exclusion`/`not_in`, any sale matching that product is immediately rejected. If it has `inclusion`/`in` qualifiers, the sale's product must match at least one inclusion value.

**Important:** For many contracts, this table has **zero rows**. The conditions you see in the UI (Product Hierarchy, Territory, Customer Segment, Sales Channel) are stored on the `contract_rules` table itself (in the `product_categories`, `territories`, `customer_segments`, and `channel` columns), NOT in this table. The UI Qualifier Condition Groups save to these flat fields via `groupsToFlatArrays()` in `contract-management.tsx`.

---

### Table 4: `contracts` — The Parent Contract

| Column | Type | Role |
|---|---|---|
| `id` | varchar (UUID) | The contract ID that `matched_contract_id` in sales_data points to |
| `company_id` | varchar | Must match the sales data's company_id for the matcher |
| `effective_start` | timestamp | Used by the sales matcher for date range validation |
| `effective_end` | timestamp | Used by the sales matcher for date range validation |
| `status` | varchar | Must be `"analyzed"` or `"active"` for rules to be processed |

---

## The Complete Filtering Pipeline — 7 Steps

Only sales that pass **every single step** get a fee calculated. If a sale fails at any step, it's skipped with zero calculation.

```
Step 1:  sales_data.matched_contract_id = contract ID
         → Only explicitly matched sales are loaded

Step 2:  contract_qualifiers (if any rows exist)
         → Exclusions reject matching products
         → Inclusions require product match

Step 3:  contract_rules.product_categories
         → Sale product_name/category must match rule's product list

Step 4:  contract_rules.territories
         → Sale territory must match rule's territory list

Step 5:  contract_rules.channel
         → Sale channel must match rule's channel

Step 6:  contract_rules.effective_date / expiry_date
         → Sale transaction_date must fall within range

Step 7:  CALCULATION
         → gross_amount × (base_rate / 100) for percentage rules
         → quantity × base_rate for per-unit rules
         → formula_definition tree evaluation if present
```

### Multi-Dimensional Qualifier Enforcement Table

| Dimension | Sale Field (sales_data) | Rule Field (contract_rules) | Match Type | Status |
|---|---|---|---|---|
| **Product** | `product_name`, `category` | `product_categories[]` | Fuzzy substring (bidirectional `includes()`) | Active |
| **Territory** | `territory` | `territories[]` | Exact match (case-insensitive) | Active |
| **Channel** | `channel` | `channel` | Exact match (case-insensitive) | Active |
| **Customer Segment** | *(no column yet)* | `customer_segments[]` | — | Reserved |
| **Date Range** | `transaction_date` | `effective_date`, `expiry_date` | Range check (on or after / on or before) | Active |

### Where Are Qualifier Conditions Actually Stored?

There are **two possible locations** for qualifier conditions:

| Location | Table | Columns | When Used |
|---|---|---|---|
| **Option A** | `contract_qualifiers` | `qualifier_type`, `qualifier_value`, `operator` | AI-extracted qualifiers linked to clauses. Often **EMPTY** for many contracts. |
| **Option B** | `contract_rules` | `product_categories`, `territories`, `channel`, `customer_segments` | Flat fields on the rule itself. The UI Qualifier Condition Groups save here via `groupsToFlatArrays()`. This is the **primary source** for most contracts. |

The calculation engine checks **both** locations: first `contract_qualifiers` (if any rows exist), then the flat fields on `contract_rules`.

---

## base_rate Storage Convention

The `base_rate` column stores percentage values as **human-readable numbers**: 3.50 means 3.50%, NOT 350%. The calculation engine **always divides by 100** for percentage-type rules before multiplying against the sale amount. For fixed_fee/per_unit rules, `base_rate` is used as-is (dollar amount per unit).

- **Percentage rule:** `gross_amount × (3.50 / 100) = gross_amount × 0.035`
- **Fixed fee rule:** `quantity × 0.25 = $0.25 per unit`

---

## Step-by-Step Calculation Flow

### Step 1: Trigger — API Entry Point

**File:** `server/routes.ts` — `POST /api/contracts/:id/calculate-fees`

Each calculation runs for a **single contract**. Parameters:

| Parameter | Source | Example | Purpose |
|---|---|---|---|
| `contractId` | URL path | `4add9cae-572d-...` | Identifies the single contract being calculated |
| `periodStart` | Request body | `2026-01-01` | Start of calculation period |
| `periodEnd` | Request body | `2026-12-31` | End of calculation period |

### Step 2: Find Sales Data

**File:** `server/storage.ts` — `getSalesDataByContract()`

**Strict Contract-Level Matching (No Fallback):**

Only sales with `sales_data.matched_contract_id = contractId` are loaded. The previous company-wide fallback has been permanently removed to prevent cross-contract contamination.

Sales must have `matched_contract_id` set via:
- **Upload with contract selected:** `matched_contract_id` is set automatically
- **Smart Match (automatic):** `SalesContractMatcher` runs after company-wide uploads
- **Smart Match (manual):** "Smart Match" button on Data Ingestion or Calculate tabs

### Step 3: Load Contract Rules

**File:** `server/services/calculationService.ts`

```sql
SELECT * FROM contract_rules
WHERE contract_id = $contractId
  AND is_active = true
ORDER BY priority ASC;
```

Only **active** rules for the contract are loaded, ordered by priority.

### Step 4: Build the Qualifier Map

**File:** `server/services/calculationService.ts` — `loadQualifierMapForContract()`

The system builds a map: for each rule, what products are included and what are excluded.

**2-Layer Qualifier → Rule Linkage Strategy:**

| Layer | How It Works | Strength |
|---|---|---|
| 1. Clause Match | `qualifier.contract_clause_id` = `rule.source_clause_id` | Strongest — direct link through the originating contract clause |
| 2. Product Category Match | `qualifier.qualifier_value` compared against `rule.product_categories[]` | Good — direct value-to-category comparison |

**General Rules — Auto-Exclusion:** Rules whose `product_categories` contains "General" but have no explicit qualifier linkage automatically receive exclusion qualifiers built from the inclusion values of all other rules.

### Step 5: Match Each Sale to a Rule (Multi-Dimensional Qualifier Enforcement)

**File:** `server/services/calculationService.ts` — `ruleMatchesSaleByQualifiers()`

For each sale, the system applies multi-dimensional filtering. A sale must pass ALL qualifier dimensions:

1. **Product exclusions (contract_qualifiers table):** If sale's `product_name` or `category` matches any exclusion value → skip this rule
2. **Product inclusions (contract_qualifiers table):** If the rule has specific inclusions, the sale must match at least one
3. **Product categories (contract_rules.product_categories):** Fallback product matching with `!` prefix for exclusions. `["General"]` = wildcard
4. **Territory filter (contract_rules.territories):** If non-empty and not `["all"]`, sale's `territory` must match (case-insensitive)
5. **Channel filter (contract_rules.channel):** If non-empty, sale's `channel` must match (case-insensitive)
6. **Customer segment (contract_rules.customer_segments):** Reserved for future use
7. **Date range (contract_rules.effective_date / expiry_date):** Sale's `transaction_date` must fall within range
8. **First match wins:** Once a sale matches a rule, processing stops for that sale

**Fuzzy Matching:** All product matching uses `fuzzyContains()` — direct substring match first, then normalized matching where dashes (`-`) and underscores (`_`) are replaced with spaces.

### Step 6: Calculate the Fee

**Formulas by Rule Type:**

| Rule Type | Formula | Sales Column Used | Example |
|---|---|---|---|
| `percentage` | `gross_amount × (base_rate / 100)` | `gross_amount` | $2,520 × (4 / 100) = $100.80 |
| `fixed_fee` | `quantity × base_rate` | `quantity` | 120 × $0.25 = $30.00 |
| `per_unit` | `quantity × base_rate` | `quantity` | 85 × $0.25 = $21.25 |
| `tiered` | Lookup tier bracket → apply tier rate | Depends on tier config | Volume 5000 in tier "1001+" at $0.20 = $1,000 |
| `rebate_tiered` | Aggregate by quarter → find tier → `quarterTotal × tier.rate` | Aggregate | Quarterly volume tiers |
| `milestone_tiered` | Cumulative total → find tier → apply rate | Aggregate | Cumulative threshold-based tiers |
| `milestone_payment` | For each qualifying milestone: `(pct / 100) × base_rate` or fixed amount | N/A (non-sales) | 50% of $100,000 = $50,000 |

**Formula Resolution Priority:**
1. `formula_definition` with formula node → Universal Formula Evaluator
2. `formula_definition` with tableData + fieldMappings → Build formula on-the-fly
3. `formula_definition` with baseRate → Simple formula
4. `formula_definition` with fixedAmount → `quantity × fixedAmount`
5. `volume_tiers` array → Tiered lookup formula
6. Final fallback — `base_rate` column: Uses `base_metric` to determine the correct sale column

**Post-Calculation Checks:**
- If `minimum_guarantee` is set and result is less → use the minimum guarantee
- If `minimum_price` is set and result is less → use the minimum price

### Step 7: Store Results

**File:** `server/routes.ts`

**Table: `contract_calculations` — Calculation Header**

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar (UUID) | Unique calculation ID |
| `contract_id` | varchar | Which contract this is for |
| `period_start` / `period_end` | timestamp | The date range calculated |
| `total_sales_amount` | decimal(15,2) | Sum of all matched sales gross amounts |
| `total_royalty` | decimal(15,2) | Total calculated fee across all rules |
| `sales_count` | integer | Number of sales processed |
| `breakdown` | jsonb | Per-sale detail array |
| `status` | varchar | Starts as `pending_approval` |
| `calculated_by` | varchar | User who triggered the calculation |

**Table: `calculation_rule_results` — Per-Rule Traceability**

| Column | Type | Purpose |
|---|---|---|
| `calculation_id` | varchar | FK to `contract_calculations.id` |
| `rule_id` | varchar | Original rule ID |
| `rule_name` | varchar | Snapshot of rule name at calculation time |
| `rule_type` | varchar | Snapshot of rule type |
| `rule_snapshot` | jsonb | Frozen copy of ALL rule parameters |
| `total_fee` | decimal(15,2) | Total fee this rule generated |
| `total_sales_amount` | decimal(15,2) | Total sales matched to this rule |
| `transaction_count` | integer | How many sales this rule processed |

### Step 8: Auto-Create Financial Records

Immediately after storing calculation results, the system automatically creates accrual and journal entry records.

**Accrual:** `accrual_id` (e.g., "ACC-MNHZ1KNI"), `contract_id`, `amount` = total calculated fee, `status` = `draft`

**Journal Entry:** `je_id` (e.g., "JE-MNHZ1KNI"), `source_accrual_id`, `total_amount` = same as accrual, `je_stage` = `draft`

---

## Smart Sales-to-Contract Matching

**File:** `server/services/salesContractMatcher.ts`

When sales are uploaded company-wide (without selecting a specific contract), the Smart Matcher automatically assigns each sale to the correct contract.

### When It Runs

| Trigger | Description |
|---|---|
| Auto (Post-Upload) | Runs automatically after a company-wide sales CSV/Excel upload |
| Manual (Button Click) | "Smart Match" button in the Data Ingestion tab or Calculate tab |
| API | `POST /api/sales/auto-match` with `{ companyId }` |

### Algorithm (3 Phases)

**Phase 1: Load All Data Into Memory**
1. Load all UNMATCHED sales for the company (`matched_contract_id IS NULL`)
2. Load ALL contract rules for the company (joins with contracts, only active status)
3. Load ALL qualifiers for the company's contracts
4. Organize qualifiers by rule_id into inclusion/exclusion map
5. Group rules by contractId

**Phase 2: Main Matching Loop (Sale × Contract × Rule)**
- Triple-nested loop: for each sale, try every contract, within each contract try every rule
- Track the best match with highest specificity score across ALL contracts
- Date range gate: skip entire contract if sale date is outside contract's effective range
- Territory filtering: the matcher also enforces `contract_rules.territories` via `checkTerritory()`

**Phase 3: Batch Update Database**
- Write matched results in batches of 100 using `CASE...WHEN` SQL

### Specificity Scoring

| Match Source | Score Formula | Score | Example |
|---|---|---|---|
| Qualifier inclusion (1 value) | `1000 / 1` | **1000** | Rule for only "Potatoes" |
| Qualifier inclusion (2 values) | `1000 / 2` | **500** | Rule for "Potatoes" + "Onions" |
| Product category (8 values) | `1000 / 8` | **125** | Rule listing 8 specific SKUs |
| General / catch-all | hardcoded | **1** | Rule with `["General"]` |
| No match | — | **0** | Sale doesn't match any rule |

**Key Insight:** The outer loop tracks `bestMatch` and `bestSpecificity` across ALL contracts, not just within one. The sale is assigned to the contract whose rule is the most specific match.

---

## Engine Selection & Mode Routing

**File:** `server/services/calculationService.ts`

| Condition | Engine Used |
|---|---|
| Rule has `formula_definition` | Universal (`UniversalFormulaEvaluator`) |
| Quarterly rebate detected | Legacy (`DynamicRulesEngine`) |
| Has ERP blueprints | Legacy (`DynamicRulesEngine`) |
| Simple percentage or fixed fee | Universal (direct `base_rate` calculation) |

---

## Milestone Tiered Calculation Logic

**File:** `server/services/dynamicRulesEngine.ts`

```
Load matching sales → Aggregate by measurementBasis → Find matching tier → Apply rate
```

### measurementBasis Options

| Value | Aggregation Logic | Sales Column |
|---|---|---|
| `cumulative_revenue` | Sum of sale amounts | `sale[base_metric_col]` or `gross_amount` |
| `cumulative_units` | Sum of `quantity` | `quantity` |
| `cumulative_count` | Count of matching sales | N/A (count) |

### Retroactive vs Non-Retroactive

- **Retroactive (default):** When cumulative total reaches a higher tier, the new tier rate is applied to ALL prior volume
- **Non-Retroactive (Marginal):** Each sale is processed individually at the tier rate for its cumulative position

---

## Milestone Payment Calculation Logic

**File:** `server/services/dynamicRulesEngine.ts`

Milestone payment rules do NOT iterate over sales data. They read from the `milestones` JSON array on the rule.

### Execution Group Modes

| execution_group | Which Milestones Qualify | Trigger |
|---|---|---|
| `event` | Only milestones with `status` = `completed`, `invoiced`, or `paid` | Manual — user marks milestone done |
| `periodic` | Only milestones where `dueDate ≤ calculationDate` | Automatic — date has passed |
| `adjustment` | All milestones, regardless of status or date | Immediate — always included |

### Amount Calculation

```
For each qualifying milestone:
  if percentage > 0 AND contractValue > 0:
    amount = (percentage / 100) × contractValue
  else:
    amount = fixed amount from milestone
  totalRoyalty += amount
```

---

## Data Ingestion — CSV/Excel Upload

**Endpoint:** `POST /api/sales/upload`

**Auto-Match After Company-Wide Upload:** When sales are uploaded without selecting a specific contract, the system automatically runs Smart Match after upload completes.

### Field Normalization Map

| CSV Header Variations | Internal Field | sales_data Column |
|---|---|---|
| "SKU", "Item Code", "Product ID" | `productCode` | `product_code` |
| "Product", "Item Name", "Description" | `productName` | `product_name` |
| "Category", "Type", "Family" | `category` | `category` |
| "Units", "Qty", "Quantity", "Volume" | `quantity` | `quantity` |
| "Sales Amount", "Total", "Revenue" | `grossAmount` | `gross_amount` |
| "Net Amount", "Net Sales" | `netAmount` | `net_amount` |
| "Region", "Country", "Territory" | `territory` | `territory` |
| "Date", "Transaction Date" | `transactionDate` | `transaction_date` |
| (any unrecognized) | — | `custom_fields` (JSONB) |

---

## Data Safety & Cleanup

### Duplicate Prevention on Upload

The upload endpoint automatically deletes existing sales data for the same scope before inserting new rows:

| Upload Mode | Pre-Insert Cleanup |
|---|---|
| Company-Wide | `DELETE FROM sales_data WHERE company_id = $1` |
| Contract-Specific | `DELETE FROM sales_data WHERE matched_contract_id = $1` |

### Dataset Delete Cascade

When a user deletes an uploaded dataset record, the system cascades to remove associated sales data:

| Dataset Type | Cascade Action |
|---|---|
| Company-Wide (`company_wide = true`) | Delete all sales for that company |
| Contract-Specific (`contract_id` set) | Delete sales matched to that contract |

### Calculation Run Delete

Cascade order:
1. Delete from `calculation_rule_results` where `calculation_id = :id`
2. Delete from `contract_calculations` where `id = :id`

### Journal Entry Delete

Cascade order:
1. Delete from `journal_entry_lines` where `je_id = :id`
2. Delete from `je_erp_sync_log` where `je_id = :id`
3. Delete from `je_reconciliation` where `je_id = :id`
4. Delete from `journal_entries` where `je_id = :id`

---

## Auto-Accrual Pipeline

After calculation results are stored, the system automatically creates accrual records in `draft` status.

**Accrual Status Workflow:** Draft → Review → Approved

**Supporting Tables:**
- `accrual_audit_trail` — tracks every status change
- `accrual_calculation_trace` — stores detailed calculation steps

---

## Journal Entry Generation

**Lifecycle:** Draft → Pending → Approved → Synced to ERP → Posted

---

## Period Close Workflow

### Readiness Checklist

| # | Check Item | Required Status |
|---|---|---|
| 1 | All contract calculations completed | status = "completed" |
| 2 | All accruals approved | status = "approved" |
| 3 | All journal entries posted | je_stage = "posted" |
| 4 | ERP reconciliation complete | erp_sync_status = "synced" |
| 5 | No unresolved blockers | blockers resolved = true |

**Period Close Workflow:** Open → In Review → Approved (Locked)

---

## All Tables Summary

| Table | Purpose | Key Relationships |
|---|---|---|
| `sales_data` | Ingested sales transactions | `matched_contract_id` → contracts.id, `company_id` → companies.id |
| `contracts` | Contract definitions | Parent of contract_rules, contract_clauses |
| `contract_rules` | Calculation rules | `contract_id` → contracts.id, `source_clause_id` → contract_clauses.id |
| `contract_qualifiers` | Rule matching conditions | `contract_clause_id` → contract_clauses.id (primary linkage) |
| `contract_clauses` | Extracted clause text | `contract_id` → contracts.id |
| `products` | Product master data | Referenced for dynamic category resolution |
| `product_hierarchy` | Product category hierarchy | Referenced by qualifier_groups |
| `contract_calculations` | Calculation run headers | `contract_id` → contracts.id |
| `calculation_rule_results` | Per-rule result snapshots | `calculation_id` → contract_calculations.id |
| `accruals` | Accrual records | `contract_id` → contracts.id |
| `accrual_audit_trail` | Accrual status history | `accrual_id` → accruals |
| `accrual_calculation_trace` | Detailed calculation steps | `accrual_id` → accruals |
| `journal_entries` | Journal entries | `source_accrual_id` → accruals |
| `period_close` | Period close management | `company_id` → companies.id |

---

## API Endpoints Reference

### Data Ingestion & Matching

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sales/upload` | Upload sales CSV/Excel — auto-runs Smart Match for company-wide uploads |
| GET | `/api/sales/data` | List ingested sales data |
| POST | `/api/sales/auto-match` | Manually trigger Smart Match. Body: `{ companyId }` |
| POST | `/api/sales/clear-matches` | Clear all `matched_contract_id` for a company. Body: `{ companyId }` |
| DELETE | `/api/uploaded-datasets/:id` | Delete dataset and associated sales_data rows |

### Calculation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/contracts/:id/calculate-fees` | Run full calculation for a contract |
| POST | `/api/evaluate` | Test rule evaluation against a single transaction |
| POST | `/api/rebate/calculate` | Rebate-specific calculation endpoint |
| DELETE | `/api/royalty-calculations/:id` | Delete calculation run and per-rule results |

### Accruals

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/accruals/run-calculation` | Process draft accruals to review |
| GET | `/api/accruals` | List all accruals |
| PATCH | `/api/accruals/:id/status` | Update accrual status |

### Journal Entries

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/journal-entries` | List all journal entries |
| POST | `/api/journal-entries/bulk-approve` | Bulk approve pending JEs |
| POST | `/api/journal-entries/:id/erp-sync` | Sync JE to ERP system |
| DELETE | `/api/journal-entries/:id` | Delete JE and cascade to lines, sync logs, reconciliation |

### Period Close

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/period-close` | List period close records |
| POST | `/api/admin/periods/:id/auto-populate` | Auto-populate period close checklist |
| POST | `/api/period-close/:id/approve` | Approve and lock period |
| PATCH | `/api/period-close/blockers/:id/resolve` | Resolve a period close blocker |

---

## SQL Reference Queries

### Full Pipeline Join: Contract → Calculation → Accrual → Journal Entry

```sql
SELECT
  c.id AS contract_id,
  c.name AS contract_name,
  c.counterparty,
  cc.id AS calculation_id,
  cc.name AS calculation_name,
  cc.period_start,
  cc.period_end,
  cc.total_royalty AS total_fee,
  cc.sales_count,
  cc.status AS calc_status,
  a.accrual_id,
  a.amount AS accrual_amount,
  a.status AS accrual_status,
  je.je_id,
  je.total_amount AS je_amount,
  je.je_stage,
  je.erp_sync_status
FROM contracts c
JOIN contract_calculations cc ON cc.contract_id = c.id
LEFT JOIN accruals a ON a.contract_id = c.id AND a.period = cc.name
LEFT JOIN journal_entries je ON je.source_accrual_id = a.accrual_id
ORDER BY cc.created_at DESC;
```

### Contract → Rules → Qualifiers (Linkage View)

```sql
SELECT
  c.name AS contract_name,
  cr.name AS rule_name,
  cr.rule_type,
  cr.product_categories,
  cr.territories,
  cr.channel,
  cr.customer_segments,
  cr.source_clause_id,
  cq.qualifier_type,
  cq.qualifier_field,
  cq.operator,
  cq.qualifier_value,
  cq.contract_clause_id
FROM contracts c
JOIN contract_rules cr ON cr.contract_id = c.id
LEFT JOIN contract_qualifiers cq ON cq.contract_clause_id = cr.source_clause_id
WHERE cr.is_active = true
ORDER BY c.name, cr.priority;
```

### Sales Data with Contract Match Status

```sql
SELECT id, company_id, matched_contract_id, product_name, product_code,
       category, quantity, gross_amount, net_amount,
       territory, channel, customer_code, transaction_date
FROM sales_data
ORDER BY transaction_date DESC
LIMIT 100;
```

### Unmatched Sales (pending Smart Match)

```sql
SELECT COUNT(*) AS unmatched_count, company_id
FROM sales_data
WHERE matched_contract_id IS NULL
GROUP BY company_id;
```

---

*LicenseIQ — AI-native Contract Intelligence Platform*
*Document generated from codebase analysis. All code references are from the live application source.*
