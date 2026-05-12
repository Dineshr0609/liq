# LicenseIQ Calculation Engine Guide

## Overview

The LicenseIQ Calculation Engine is the system that automatically calculates license fees (royalties) by applying contract rules to your uploaded sales data. This guide explains how every piece connects together.

---

## The Three Data Sources

The calculation engine brings together data from three places:

### 1. Sales Data (Your CSV Upload)
When you upload a sales CSV file, each row becomes a sales transaction with fields like:

| Sales Field | Description |
|---|---|
| `grossAmount` | Total sales amount |
| `netAmount` | Net sales amount |
| `quantity` / `units` | Number of units sold |
| `productName` | Name of the product |
| `category` | Product category |
| `territory` | Geographic region |
| `containerSize` | Size variant (if applicable) |
| `transactionDate` | Date of the sale |

### 2. Rules (AI-Extracted from Your Contract PDF)
When a contract is uploaded and analyzed, the AI reads the document and extracts rules. Each rule is stored in the `royalty_rules` database table and includes:

| Rule Field | Description |
|---|---|
| `ruleName` | Name of the rule (e.g., "Tier 1 - Ornamental Trees") |
| `formulaDefinition` | The complete calculation logic as JSON (includes pricing tables, IF/ELSE logic, tiers, notes) |
| `fieldMappings` | Maps contract table columns to engine fields (see below) |
| `volumeTiers` | Volume-based tier breakpoints |
| `baseRate` | Simple flat rate (if applicable) |
| `minimumGuarantee` | Minimum payment amount |
| `productCategories` | Which products this rule applies to |
| `territories` | Which territories this rule covers |

### 3. Calculation Field Types (Engine Field Definitions)
Stored in the `calculation_field_types` database table. These define what standard fields the engine understands for each contract type. They are NOT hardcoded - they are database-driven and configurable.

**Example for `royalty_license` contract type:**

| Engine Field Code | Display Name | Category | What It Means |
|---|---|---|---|
| `net_revenue` | Net Revenue | basis | Sales amount to calculate fees on |
| `royalty_rate` | Royalty Rate | rate | The percentage to apply |
| `units_sold` | Units Sold | basis | Quantity/volume of units |
| `per_unit_rate` | Per-Unit Rate | rate | Fixed fee per item sold |
| `volume_tier` | Volume Tier | threshold | Volume threshold for tier matching |
| `minimum_royalty` | Minimum Royalty | constraint | Minimum guaranteed payment |
| `product_category` | Product Category | modifier | Product type grouping |
| `seasonal_adjustment` | Seasonal Adjustment | modifier | Season-based rate modifier |

Each contract type (direct_sales, distributor_reseller, marketplace_platforms, etc.) has its own set of engine fields defined in this table.

---

## The Field Mapping Bridge

This is the most important concept to understand. The engine needs a **translator** between contract language and engine language.

### Why Field Mappings Exist

Your contract PDF might have a pricing table like this:

| Size | Base Rate | Discounted Rate |
|---|---|---|
| 1-gallon | $1.25 | $1.10 |
| 3-gallon | $2.85 | $2.50 |

The AI extracts this table and saves the column names as-is: `size`, `baseRate`, `discountedRate`. These are stored in `formulaDefinition.tableData.columns`.

But the calculation engine doesn't know what "size" or "baseRate" means. It only understands its standard fields: `volume`, `rate`, `minimum`, `description`.

**Field mappings tell the engine:**
- `size` column = `volume` (the quantity/threshold field)
- `baseRate` column = `rate` (the fee/price field)
- `discountedRate` column = (not mapped, or mapped to another field)

### Where Field Mappings Are Stored

In the `royalty_rules` table, each rule has a `field_mappings` JSONB column:

```json
{
  "volumeField": "size",
  "rateField": "baseRate",
  "minimumField": null,
  "descriptionField": null
}
```

### How Field Mappings Are Set

1. **Automatically at extraction time**: When AI extracts rules, the system auto-detects mappings by matching table column names against the `defaultColumnPatterns` in `calculation_field_types`. For example, if a column is named "units", it matches the pattern for `units_sold` and gets mapped to `volumeField`.

2. **Manually by the user**: On the Rules page, click Edit on any rule, then expand "Field Mappings" above the pricing table. You'll see dropdown selects for each engine field where you can choose which table column maps to it.

3. **Auto-detect button**: Click "Auto-detect" to re-run the pattern matching algorithm.

### Auto-Detection Logic

The system uses two layers of pattern matching:

**Layer 1 - Database patterns** (from `calculation_field_types.default_column_patterns`):
- `units_sold` matches: units, quantity, volume, sold
- `royalty_rate` matches: royalty, rate, percentage, %
- `minimum_royalty` matches: minimum, min, guaranteed, annual minimum
- etc.

**Layer 2 - Fallback patterns** (hardcoded backup):
- `volumeField` matches: volume, sales, units, threshold, tier, quantity, size, container
- `rateField` matches: rate, royalty, fee, price, percent, %, base
- `minimumField` matches: minimum, min, guarantee, floor
- `descriptionField` matches: description, name, category, product, label, variety

---

## Calculation Flow (Step by Step)

Here's exactly what happens when you click "Run Calculation":

### Step 1: Load Data
- All **sales transactions** for the contract are loaded
- All **active rules** for the contract are loaded (sorted by priority)

### Step 2: Determine Calculation Mode
The system checks which mode to use:
- **Universal mode**: Uses the formula evaluator with JSON expression trees (preferred)
- **Legacy mode**: Uses the older dynamic rules engine
- **Hybrid mode**: Tries universal first, falls back to legacy

### Step 3: For Each Sale, Find a Matching Rule
The engine loops through each sales transaction. For each sale:

1. It goes through rules in priority order (lower number = higher priority)
2. For each rule, it tries to build an executable formula:
   - If `formulaDefinition` has a `formula` node (JSON expression tree), use it directly
   - If `formulaDefinition` has `tableData` + `fieldMappings`, build a formula on-the-fly from the pricing table
   - If legacy `volumeTiers` exist, build a formula from those
3. The first rule that produces a valid result is used (one rule per sale)

### Step 4: Build Evaluation Context
For each sale, the engine creates a "context" object:

```
{
  grossAmount: 5000,        // from sales CSV
  netAmount: 4500,          // from sales CSV
  quantity: 100,            // from sales CSV
  units: 100,               // alias for quantity
  productName: "Widget A",  // from sales CSV
  category: "Electronics",  // from sales CSV
  territory: "US-West",     // from sales CSV
  containerSize: "1-gallon", // from sales CSV
  unitPrice: 50             // calculated: grossAmount / quantity
}
```

### Step 5: Evaluate the Formula
The formula evaluator processes the expression tree against the context:

- **Tier lookups**: "If quantity >= 5000, use rate $1.10; otherwise use $1.25"
- **Multiplications**: "netAmount x rate = fee"
- **Conditionals**: "IF territory = 'US' THEN rate = 5% ELSE rate = 3%"
- **Min/Max**: "MAX(calculated fee, minimum guarantee)"

Each step is recorded in an **audit trail** for transparency.

### Step 6: Aggregate Results
- Each sale gets a calculated fee amount
- All fees are summed to get the total
- Minimum guarantees and caps are applied
- A detailed breakdown is generated showing which rule was applied to each sale

---

## Dual Display: Contract Terms vs Engine Field Mapping

On the Rules page, each rule shows calculation logic in two views:

### Contract Terms Tab (Display Only)
Shows the original language from your contract:
```
IF container_size = '1-gallon' THEN
  IF annual_units >= 5000 THEN royalty_per_unit = 1.10
  ELSE royalty_per_unit = 1.25
```

### Engine Field Mapping Tab (Used for Calculation)
Shows the same logic translated to engine fields:
```
IF [volume] = '1-gallon' THEN
  IF annual_units >= 5000 THEN [rate] = 1.10
  ELSE [rate] = 1.25
```

The translation uses the field mappings to replace contract-specific terms with engine field names (`[volume]`, `[rate]`, `[minimum]`).

---

## On-the-Fly Formula Building

When a rule has `tableData` (a pricing table from the contract) and `fieldMappings`, but no pre-built formula tree, the engine builds one automatically:

1. Reads the pricing table rows
2. Uses `volumeField` mapping to find the threshold column
3. Uses `rateField` mapping to find the rate column
4. Creates a tiered formula: `netAmount x tierRate` where tierRate is looked up based on volume
5. Applies `minimumField` as a floor if mapped

This is why field mappings are essential - without them, the engine can't build formulas from pricing tables.

---

## Key Database Tables

| Table | Purpose |
|---|---|
| `royalty_rules` | Stores extracted rules, formulas, field mappings |
| `calculation_field_types` | Defines available engine fields per contract type |
| `royalty_calculations` | Stores calculation run results |
| `sales_data` | Stores uploaded sales CSV data |
| `contracts` | Contract metadata including type |

---

## Adding New Engine Fields

To add a new engine field for a contract type:

1. Go to Settings > Calculation Field Types (or add directly to the `calculation_field_types` table)
2. Specify:
   - `contract_type_code`: Which contract type this field applies to
   - `field_code`: Internal identifier (e.g., `territory_premium`)
   - `field_name`: Display name (e.g., "Territory Premium")
   - `field_category`: One of: `basis`, `rate`, `threshold`, `modifier`, `constraint`
   - `default_column_patterns`: Array of strings for auto-detection (e.g., `["territory", "region", "zone"]`)
   - `data_type`: One of: `number`, `percentage`, `currency`, `text`, `date`

The new field will automatically appear in the Field Mappings dropdown for rules of that contract type.

---

## Supported Contract Types

Each contract type has its own set of engine fields:

| Contract Type | # Fields | Key Fields |
|---|---|---|
| `royalty_license` | 8 | net_revenue, royalty_rate, units_sold, per_unit_rate, volume_tier, minimum_royalty |
| `direct_sales` | 5 | revenue, rate_percentage, volume_threshold, minimum_payment, maximum_cap |
| `distributor_reseller` | 5 | net_purchases, rebate_percentage, purchase_tier, minimum_purchase, territory |
| `marketplace_platforms` | 6 | gmv, platform_fee, transaction_fee, category, seller_tier |
| `usage_service_based` | 7 | usage_units, per_unit_rate, usage_tier, base_fee, overage_rate |
| `rebate_mdf` | 6 | qualifying_purchases, rebate_rate, purchase_tier, mdf_allocation |
| `referral` | 5 | referred_revenue, referral_fee, flat_fee, lead_status |
| `chargebacks_claims` | 5 | claim_amount, approved_percentage, processing_fee, claim_type |
