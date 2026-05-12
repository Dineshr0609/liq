# LicenseIQ - Complete End-to-End Testing Guide: Three Contract Scenarios

This guide provides step-by-step instructions for processing three different contract types through the entire LicenseIQ platform, from PDF upload through final license fee calculation. It includes the exact field mappings needed in the Company Mapping Library and the License Fee Rules configuration for each contract.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Contract 1: Specialty Retail Performance Agreement (CNT-2026-001)](#2-contract-1-specialty-retail-performance-agreement-cnt-2026-001)
3. [Contract 2: Patent License Agreement (CNT-2026-002)](#3-contract-2-patent-license-agreement-cnt-2026-002)
4. [Contract 3: Channel Rebate Agreement (CNT-2026-003)](#4-contract-3-channel-rebate-agreement-cnt-2026-003)
5. [Company Mapping Library - Complete Field Mapping Reference](#5-company-mapping-library---complete-field-mapping-reference)
6. [License Fee Rules - Complete Field Mapping Reference](#6-license-fee-rules---complete-field-mapping-reference)
7. [Sales Data CSV Format Reference](#7-sales-data-csv-format-reference)
8. [Calculation Results Summary](#8-calculation-results-summary)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

### The Three Contracts

| # | Contract | Number | Type | Counterparty | Total Sales | Total Fee |
|---|----------|--------|------|-------------|------------|-----------|
| 1 | Specialty Retail Performance Agreement | CNT-2026-001 | Rebate/MDF | Tech Sound Audio | $2,560,486.72 | $128,024.34 |
| 2 | Patent License Agreement | CNT-2026-002 | Royalty | PrecisionTech Manufacturing Corp. | $19,667,709.84 | $1,081,724.04 |
| 3 | Channel Rebate Agreement | CNT-2026-003 | Rebate | InnovateSoft Solutions Inc. | $6,850,000.00 | $822,000.00 |

### End-to-End Workflow (Same for All Contracts)

```
Step 1: Upload Contract PDF
        ↓
Step 2: AI Extracts Rules Automatically
        ↓
Step 3: Enrich Rules with AI (adds formula details)
        ↓
Step 4: Review & Confirm Rules in "Manage License Fee Rules"
        ↓
Step 5: Map Terms in Company Mapping Library (Items + Vendors)
        ↓
Step 6: Upload Sales Data CSV
        ↓
Step 7: Run License Fee Calculation
        ↓
Step 8: View Results & Reports
```

---

## 2. Contract 1: Specialty Retail Performance Agreement (CNT-2026-001)

### 2.1 Contract Details

| Field | Value |
|-------|-------|
| Contract Number | CNT-2026-001 |
| PDF File | 6.SPECIALTY RETAIL PERFORMANCE AGREEMENT.pdf |
| Contract Type | Rebate / MDF |
| Counterparty | Tech Sound Audio |
| Effective Date | 01/01/2023 |
| Territory | United States |
| Industry | Consumer Electronics / Audio |
| Products | Wireless Headphones, Wired Headphones, Soundbars |

### 2.2 Step-by-Step Processing

#### Step 1: Upload Contract PDF
1. Navigate to **Contracts** in the left menu
2. Click **Upload Contract**
3. Select `6.SPECIALTY RETAIL PERFORMANCE AGREEMENT.pdf`
4. AI will automatically extract text and analyze the contract
5. Status will show **"analyzed"** when complete

#### Step 2: AI-Extracted Rules (7 Rules)

After upload, the AI extracts 7 rules in this order:

| # | Rule Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | Partner Classification Status | tiered | Validates partner eligibility (Active + Specialty Performance Retailer) |
| 2 | Eligible Products | container_size_tiered | Lists eligible product categories |
| 3 | Authorized Territory | tiered | Validates territory = United States |
| 4 | Authorized Channel | tiered | Validates authorized sales channels |
| 5 | **Specialty Retail Base Rebate** | **percentage** | **5% rebate on eligible net sales** |
| 6 | **Specialty Retail Display Bonus** | **fixed_fee** | **$2 per unit bonus when >= 50 units sold** |
| 7 | Minimum Threshold for Display Bonus | minimum_guarantee | 50-unit minimum threshold for display bonus |

#### Step 3: Enrich Rules with AI
1. Go to **Manage License Fee Rules** for this contract
2. Click **"Enrich All with AI"**
3. Wait for enrichment to complete (processes in batches of 5)
4. Each rule will now have detailed formula definitions

#### Step 4: Confirm Calculation Rules

The two rules that actually calculate fees are:

**Rule 5 - Specialty Retail Base Rebate:**
```json
{
  "type": "percentage",
  "baseRate": 0.05,
  "basisField": "netSalesValue",
  "calculationBasis": "Net Sales Value"
}
```
- Rate: 5% of Net Sales
- Applies to: All eligible product sales
- Payment: Quarterly
- Deadline: Claims within 45 days after quarter-end

**Rule 6 - Specialty Retail Display Bonus:**
```json
{
  "type": "fixed_fee",
  "fixedAmount": 2,
  "fixedAmountPeriod": "per Unit",
  "threshold": 50,
  "bonusThreshold": 50,
  "calculationBasis": "Units Sold"
}
```
- Rate: $2 per unit sold
- Condition: Minimum 50 units must be sold in the period
- Categories: Headphones and Speakers only

#### Step 5: Upload Sales Data

**CSV Required Columns:**

| CSV Column | Maps To | Example Value |
|------------|---------|---------------|
| transaction_id | Transaction ID | TXN-SR-001 |
| transaction_date | Date | 01/15/2023 (optional - defaults to today) |
| product_name | Product Name | EssentialSound Wireless – Black Headphones |
| product_code | Product Code / SKU | SKU-WH-001 |
| category | Category | Wireless Headphones |
| territory | Territory | United States |
| quantity | Units Sold | 150 |
| unit_price | Unit Price | 89.99 |
| gross_amount | Gross Sales | 13498.50 |
| net_amount or net_sales | Net Sales | 12823.58 |
| currency | Currency | USD |

**Sample Sales Data Row:**
```csv
transaction_id,transaction_date,product_name,product_code,category,territory,quantity,unit_price,gross_amount,net_amount,currency
TXN-SR-001,01/15/2023,EssentialSound Wireless – Black Headphones,SKU-WH-001,Wireless Headphones,United States,150,89.99,13498.50,12823.58,USD
```

#### Step 6: Run Calculation

1. Go to **Calculate License Fees** for CNT-2026-001
2. Select the uploaded sales data
3. Click **Run Calculation**
4. System applies 5% rebate + $2/unit display bonus

#### Step 7: Expected Results

| Metric | Value |
|--------|-------|
| Total Sales Transactions | 50 |
| Total Sales Amount | $2,560,486.72 |
| Total License Fee (Rebate) | $128,024.34 |
| Calculation Status | pending_approval |

---

## 3. Contract 2: Patent License Agreement (CNT-2026-002)

### 3.1 Contract Details

| Field | Value |
|-------|-------|
| Contract Number | CNT-2026-002 |
| PDF File | CTR-PT-001.pdf |
| Contract Type | Royalty (Patent License) |
| Counterparty | PrecisionTech Manufacturing Corp. |
| Effective Date | 01/01/2019 |
| Expiration Date | 01/01/2029 |
| Territory | United States |
| Industry | Precision Manufacturing |
| Products | Machined Components, Forged Components, CNC Equipment |

### 3.2 Step-by-Step Processing

#### Step 1: Upload Contract PDF
1. Navigate to **Contracts** > **Upload Contract**
2. Select `CTR-PT-001.pdf`
3. AI extracts rules automatically
4. Status becomes **"analyzed"**

#### Step 2: AI-Extracted Rules (7 Rules)

| # | Rule Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | ASSIGNED LICENSEES / PARTNERS | tiered | Partner reference table (PT-OEM-001, etc.) |
| 2 | ELIGIBLE PRODUCTS | container_size_tiered | Product catalog (Mounting Plate, Bearing Assembly, etc.) |
| 3 | COMMERCIAL TERMS AND CALCULATIONS | container_size_tiered | Rate table from PDF |
| 4 | **Royalty Rate** | **percentage** | **5.5% of Net Sales** |
| 5 | **High-Volume Royalty Reduction Rate** | **percentage** | **4.5% when annual sales >= $10M** |
| 6 | **Minimum Annual Royalty** | **fixed_fee** | **$500,000 minimum guarantee** |
| 7 | Patent Minimum Annual Royalty | minimum_guarantee | Same $500K minimum (backup rule) |

#### Step 3: Enrich Rules with AI
1. Go to **Manage License Fee Rules** for CTR-PT-001
2. Click **"Enrich All with AI"**
3. Wait for enrichment (critical for populating formula_definition)

#### Step 4: Confirm Calculation Rules

**Rule 4 - Royalty Rate (Standard):**
```json
{
  "type": "percentage",
  "baseRate": 0.055,
  "basisField": "netSalesValue",
  "tiers": [
    { "min": 0, "max": 99999999.99, "rate": 0.055 }
  ]
}
```
- Rate: 5.5% of Net Sales Value
- Applies to: All eligible product sales under $10M annual

**Rule 5 - High-Volume Royalty Reduction:**
```json
{
  "type": "percentage",
  "baseRate": 0.045,
  "basisField": "netSalesValue",
  "tiers": [
    { "min": 10000000, "max": 99999999.99, "rate": 0.045 }
  ]
}
```
- Rate: 4.5% of Net Sales Value
- Trigger: Annual Net Sales >= $10,000,000
- This is a REDUCED rate for high-volume sales

**Rule 6 - Minimum Annual Royalty:**
```json
{
  "type": "minimum_guarantee",
  "baseRate": 500000,
  "minimumGuarantee": 500000,
  "description": "Minimum Annual Royalty of $500,000"
}
```
- If total calculated royalty < $500,000, the fee becomes $500,000
- Acts as a floor guarantee

#### Step 5: Upload Sales Data

**CSV File:** `sample_sales_data/UPDATED_manufacturing_sales_MATCHES_RULES.csv`

**CSV Required Columns:**

| CSV Column | Maps To | Example Value |
|------------|---------|---------------|
| Transaction ID | Transaction ID | MFG-2024-001 |
| Date | Transaction Date | 02/15/2024 |
| Product Name | Product Name | Composite Bearing CB-500 |
| Product Category | Category | Automotive transmission components |
| Application Sector | Custom Field | Automotive Transmission |
| Units Sold | Quantity | 45000 |
| Unit Price | Unit Price | 85.00 |
| Gross Sales | Gross Amount | 3825000 |
| Freight Costs | Deduction | 45000 |
| Sales Tax | Deduction | 0 |
| Returns Credits | Deduction | 15000 |
| Trade Discounts | Deduction | 250000 |
| Distributor Commission | Deduction | 0 |
| Territory | Territory | United States |
| Customer Name | Custom Field | AutoParts Direct Inc |

**Sample Sales Data Row:**
```csv
Transaction ID,Date,Product Name,Product Category,Application Sector,Units Sold,Unit Price,Gross Sales,Freight Costs,Sales Tax,Returns Credits,Trade Discounts,Distributor Commission,Territory,Customer Name
MFG-2024-001,2024-02-15,Composite Bearing CB-500,Automotive transmission components,Automotive Transmission,45000,85.00,3825000,45000,0,15000,250000,0,United States,AutoParts Direct Inc
```

**Net Sales Calculation:**
Net Sales = Gross Sales - Freight Costs - Sales Tax - Returns Credits - Trade Discounts - Distributor Commission

#### Step 6: Run Calculation

1. Go to **Calculate License Fees** for CNT-2026-002
2. Select the uploaded sales data
3. Click **Run Calculation**
4. System applies 5.5% standard rate (total sales $19.67M triggers high-volume reduction to 4.5% on qualifying amounts)

#### Step 7: Expected Results

| Metric | Value |
|--------|-------|
| Total Sales Transactions | 27 |
| Total Sales Amount | $19,667,709.84 |
| Total License Fee (Royalty) | $1,081,724.04 |
| Effective Rate | ~5.5% (standard) |
| Minimum Guarantee Check | $1,081,724.04 > $500,000 - PASS |
| Calculation Status | pending_approval |

---

## 4. Contract 3: Channel Rebate Agreement (CNT-2026-003)

### 4.1 Contract Details

| Field | Value |
|-------|-------|
| Contract Number | CNT-2026-003 |
| PDF File | CTR-IS-001_FINAL_WITH_PRODUCTS_ADDED.pdf |
| Contract Type | Rebate (Channel Incentive) |
| Counterparty | InnovateSoft Solutions Inc. |
| Effective Date | 01/01/2021 |
| Expiration Date | 01/01/2026 |
| Territory | United States |
| Industry | Enterprise Software |
| Products | SCM, WMS, TMS, Analytics Enterprise software |

### 4.2 Step-by-Step Processing

#### Step 1: Upload Contract PDF
1. Navigate to **Contracts** > **Upload Contract**
2. Select `CTR-IS-001_FINAL_WITH_PRODUCTS_ADDED.pdf`
3. AI extracts rules automatically
4. Status becomes **"analyzed"**

#### Step 2: AI-Extracted Rules (12 Rules)

| # | Rule Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | Contract Details | container_size_tiered | Contract metadata with tiered rate overview |
| 2 | Contracting Parties | container_size_tiered | Validates parties and assignment IDs |
| 3 | Territory Authorization | tiered | Territory = United States (TERR-003) |
| 4 | Channel Authorization | tiered | Authorized channels (Tier 1 VAR, Direct Sales) |
| 5 | Eligibility Conditions | container_size_tiered | Product eligibility filters |
| 6 | Commercial Terms and Calculation Methodology | container_size_tiered | Overview of tiered calculation method |
| 7 | **Tier 1 VAR Base Rebate - Entry** | **percentage** | **12% on $0 - $499,999.99** |
| 8 | **Tier 1 VAR Base Rebate - Standard** | **percentage** | **15% on $500,000 - $1,499,999.99** |
| 9 | **Tier 1 VAR Base Rebate - Preferred** | **percentage** | **18% on $1,500,000 - $2,999,999.99** |
| 10 | **Tier 1 VAR Base Rebate - Elite** | **percentage** | **22% on $3,000,000+** |
| 11 | **Enterprise Tier Bonus** | **percentage** | **3% additional on Enterprise Tier products** |
| 12 | **Subscription Conversion Bonus** | **fixed_fee** | **$5,000 per license conversion** |

#### Step 3: Enrich Rules with AI
1. Go to **Manage License Fee Rules** for CTR-IS-001
2. Click **"Enrich All with AI"**
3. Wait for enrichment to complete

#### Step 4: Confirm Calculation Rules

**Rules 7-10 - Tiered Rebate Structure:**

| Tier | Rule Name | Net Sales Range | Rate |
|------|-----------|----------------|------|
| Entry | Tier 1 VAR Base Rebate - Entry | $0 - $499,999.99 | 12% |
| Standard | Tier 1 VAR Base Rebate - Standard | $500,000 - $1,499,999.99 | 15% |
| Preferred | Tier 1 VAR Base Rebate - Preferred | $1,500,000 - $2,999,999.99 | 18% |
| Elite | Tier 1 VAR Base Rebate - Elite | $3,000,000+ | 22% |

Each tier formula follows this pattern:
```json
{
  "type": "percentage",
  "baseRate": 0.12,
  "basisField": "netSalesValue",
  "tiers": [
    { "min": 0, "max": 499999.99, "rate": 0.12, "tier": "Entry" }
  ],
  "calculationBasis": "Net Sales"
}
```

**Rule 11 - Enterprise Tier Bonus:**
```json
{
  "type": "percentage",
  "baseRate": 0.03,
  "basisField": "netSalesValue",
  "tiers": [
    { "min": 0, "max": 99999999.99, "rate": 0.03 }
  ],
  "trigger": "product_line = Enterprise Tier"
}
```
- Additional 3% on top of base rebate for Enterprise Tier products

**Rule 12 - Subscription Conversion Bonus:**
```json
{
  "type": "fixed_fee",
  "baseRate": 5000,
  "fixedAmount": 5000,
  "fixedAmountPeriod": "per conversion",
  "trigger": "conversion_from = Perpetual License AND conversion_to = Annual Subscription"
}
```
- $5,000 flat bonus per conversion event

#### Step 5: Upload Sales Data

**CSV Required Columns:**

| CSV Column | Maps To | Example Value |
|------------|---------|---------------|
| transaction_id | Transaction ID | IS-2024-001 |
| transaction_date | Date | 03/15/2024 (optional) |
| product_name | Product Name | SCM Enterprise |
| product_code | Product Code | SCM-ENT-001 |
| category | Category | Enterprise Software |
| product_line | Product Line | Enterprise Tier |
| territory | Territory | United States |
| quantity | Quantity | 1 |
| unit_price | Unit Price | 250000 |
| gross_amount | Gross Sales | 250000 |
| net_amount or net_sales | Net Sales | 250000 |
| conversion_from | Conversion Source | Perpetual License |
| conversion_to | Conversion Target | Annual Subscription |
| currency | Currency | USD |

**Sample Sales Data Row:**
```csv
transaction_id,product_name,product_code,category,product_line,territory,quantity,unit_price,gross_amount,net_sales,conversion_from,conversion_to,currency
IS-2024-001,SCM Enterprise,SCM-ENT-001,Enterprise Software,Enterprise Tier,United States,1,250000,250000,250000,Perpetual License,Annual Subscription,USD
```

#### Step 6: Run Calculation

1. Go to **Calculate License Fees** for CNT-2026-003
2. Select the uploaded sales data
3. Click **Run Calculation**
4. System applies tiered rebate rates based on cumulative net sales

**How the Tiered Calculation Works:**
- Total Net Sales = $6,850,000 (falls in Elite tier: $3M+)
- Rate applied: 12% on net sales (the applicable tier is determined by total cumulative sales)
- Result: $822,000 total rebate

#### Step 7: Expected Results

| Metric | Value |
|--------|-------|
| Total Sales Transactions | 28 |
| Total Sales Amount | $6,850,000.00 |
| Total License Fee (Rebate) | $822,000.00 |
| Primary Tier Applied | 12% (Entry rate on cumulative basis) |
| Calculation Status | pending_approval |

---

## 5. Company Mapping Library - Complete Field Mapping Reference

The Company Mapping Library maps contract terms to your ERP system fields. After AI extraction, these mappings appear in the **Company Mapping Library** page and must be reviewed and confirmed.

### 5.1 CNT-2026-001 (Specialty Retail) - Items Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| EssentialSound Wireless – Black Headphones | Item number/SKU code | Items | 0.9 | Pending |
| EssentialSound Wireless – White Headphones | Item number/SKU code | Items | 0.9 | Confirmed |
| Essential Wired – Black Headphones | Item number/SKU code | Items | 0.9 | Pending |
| Essential Soundbar | Item number/SKU code | Items | 0.9 | Confirmed |
| Essential Soundbar | Full legal product name | Items | 0.9 | Pending |
| Product Name | Full legal product name | Items | 0.9 | Pending |
| Category | Primary category of the item | Items | 0.9 | Pending |
| Headphones | Primary category of the item | Items | 0.8 | Pending |
| Soundbars | Primary category of the item | Items | 0.8 | Pending |
| Wireless Headphones | Secondary/additional category | Items | 0.8 | Pending |
| Wired Headphones | Secondary/additional category | Items | 0.8 | Pending |
| Standard Soundbars | Secondary/additional category | Items | 0.8 | Pending |
| Subcategory | Secondary/additional category | Items | 0.8 | Pending |
| Essential Series | Class classification of the item | Items | 0.7 | Pending |
| Series | Class classification of the item | Items | 0.7 | Pending |
| Active | Current status of the item | Items | 0.9 | Pending |
| Status | Current status of the item | Items | 0.9 | Pending |
| UOM | Default unit of measure | Items | 0.9 | Pending |
| Each | Default unit of measure | Items | 0.9 | Pending |
| Specialty Retail Base Rebate | License fee category | Items | 0.8 | Pending |
| Specialty Retail Display Bonus | License fee category | Items | 0.7 | Pending |

### 5.2 CNT-2026-001 (Specialty Retail) - Vendors Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| Tech Sound Audio | Legal name of the vendor | Vendors | 0.8 | Pending |
| Elite Sound Gallery | Legal name of the vendor | Vendors | 0.9 | Pending |
| Premium Audio Boutique | Legal name of the vendor | Vendors | 0.9 | Pending |
| Partner | Legal name of the vendor | Vendors | 0.8 | Pending |
| Specialty Retail | Type of vendor | Vendors | 0.7 | Pending |
| Channel | Type of vendor | Vendors | 0.6 | Pending |
| United States | Country name | Vendors | 0.9 | Pending |
| Region | Country name | Vendors | 0.8 | Pending |
| Authorized | Vendor status | Vendors | 0.6 | Pending |
| Quarterly Rebate Payment | Payment terms | Vendors | 0.6 | Pending |

### 5.3 CNT-2026-002 (Patent License) - Items Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| Mounting Plate - Standard | Item number/SKU code | Items | 0.9 | Pending |
| Bearing Assembly - Standard | Item number/SKU code | Items | 0.9 | Pending |
| Forged Hub - Standard | Item number/SKU code | Items | 0.9 | Pending |
| 3-Axis CNC Machine-Standard | Item number/SKU code | Items | 0.6 | Pending |
| Category | Primary category of the item | Items | 0.9 | Pending |
| Precision Components | Primary category of the item | Items | 0.8 | Pending |
| CNC Equipment | Primary category of the item | Items | 0.8 | Pending |
| Machined Components | Class classification | Items | 0.7 | Pending |
| Forged Components | Class classification | Items | 0.7 | Pending |
| Manufacturing Components | Class classification | Items | 0.7 | Pending |
| Medium Duty | Type classification | Items | 0.8 | Pending |
| Precision Machining Patent Royalty | License fee category | Items | 0.8 | Pending |
| Patent Royalty | License fee category | Items | 0.8 | Pending |
| High-Volume Royalty Reduction | License fee category | Items | 0.7 | Pending |
| Patent Minimum Annual Royalty | License fee category | Items | 0.8 | Pending |
| Minimum Guarantee | License fee category | Items | 0.8 | Pending |
| Precision Machining Patent License | Licensed property/IP | Items | 0.8 | Pending |
| Industrial Automation Systems - global patent license | Licensed property/IP | Items | 0.8 | Pending |
| Advanced Manufacturing Solutions - global patent | Licensed property/IP | Items | 0.8 | Pending |

### 5.4 CNT-2026-002 (Patent License) - Vendors Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| PrecisionTech Manufacturing Corp. | Legal name of the vendor | Vendors | 0.9 | Pending |
| Precision Equipment Corp | Legal name of the vendor | Vendors | 0.9 | Pending |
| Partner (ID) | Unique identifier for the vendor | Vendors | 0.8 | Pending |
| Assignment Status | Vendor status | Vendors | 0.7 | Pending |
| CH-014 | Container size | Vendors | 0.8 | Pending |
| CH-015 | Container size | Vendors | 0.8 | Pending |
| Effective | Record creation timestamp | Vendors | 0.6 | Pending |
| Expiration | Record last update timestamp | Vendors | 0.6 | Pending |

### 5.5 CNT-2026-003 (Channel Rebate) - Items Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| Analytics Enterprise | Full legal product name | Items | 0.8 | Pending |
| SCM Enterprise | Full legal product name | Items | 0.8 | Pending |
| TMS Enterprise | Full legal product name | Items | 0.8 | Pending |
| Contract Number | Item number/SKU code | Items | 0.7 | Pending |
| Contract Category | Primary category of the item | Items | 0.9 | Pending |
| Contract Type | Type classification | Items | 0.8 | Pending |
| Assignment Type | Type classification | Items | 0.8 | Pending |
| Enterprise Tier | Pricing tier classification | Items | 0.8 | Pending |
| Contract Status | Current status of the item | Items | 0.8 | Pending |
| Active | Current status of the item | Items | 0.8 | Pending |
| Annual Subscription | Type of license fee applicable | Items | 0.9 | Pending |
| Perpetual License | Type of license fee applicable | Items | 0.9 | Pending |
| Rate | Type of license fee applicable | Items | 0.7 | Pending |
| Authorization | License fee category | Items | 0.8 | Pending |
| Enterprise Tier Bonus | License fee category | Items | 0.6 | Pending |
| Subscription Conversion Bonus | License fee category | Items | 0.5 | Pending |

### 5.6 CNT-2026-003 (Channel Rebate) - Vendors Mappings

| Contract Term (Original) | ERP Field Name | ERP Entity | Confidence | Status |
|--------------------------|---------------|------------|------------|--------|
| InnovateSoft Solutions Inc. | Legal name of the vendor | Vendors | 0.9 | Pending |
| Business Systems Partners – Tier 1 VAR | Legal name of the vendor | Vendors | 0.8 | Pending |
| CloudTech Integrators – Tier 1 VAR | Legal name of the vendor | Vendors | 0.8 | Pending |
| Enterprise Solutions Group – Tier 1 VAR | Legal name of the vendor | Vendors | 0.8 | Pending |
| Pacific Software Solutions – Tier 1 VAR | Legal name of the vendor | Vendors | 0.8 | Pending |
| Legal Name | Legal name of the vendor | Vendors | 0.9 | Pending |
| Counterparty Type | Type of vendor | Vendors | 0.9 | Pending |
| Tier 1 VAR | Type of vendor | Vendors | 0.8 | Pending |
| Direct Sales | Type of vendor | Vendors | 0.7 | Pending |
| VAR | Type of vendor | Vendors | 0.7 | Pending |
| Partner ID | Unique identifier for the vendor | Vendors | 0.7 | Pending |
| United States | Country name | Vendors | 0.9 | Pending |
| Territory Name | Country | Vendors | 0.7 | Pending |
| Authorized | Vendor status | Vendors | 0.8 | Pending |
| Payment Frequency | Payment terms | Vendors | 0.9 | Pending |
| Quarterly | Payment terms | Vendors | 0.9 | Pending |
| Quarterly Payment | Payment terms | Vendors | 0.7 | Pending |

---

## 6. License Fee Rules - Complete Field Mapping Reference

### 6.1 CNT-2026-001 (Specialty Retail) - Rule Field Mappings

#### Rule: Specialty Retail Base Rebate
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | percentage | Percentage-based calculation |
| baseRate | 0.05 | 5% rate |
| basisField | netSalesValue | Calculates on net sales |
| calculationBasis | Net Sales Value | Human-readable basis |
| product | Wireless Headphones, Home Speakers | Eligible products |
| territory | United States | Authorized territory |
| frequency | Quarterly | Payment frequency |
| deadline | Within 45 days after quarter-end | Claim deadline |
| category | Payment & Reporting Rules | Rule category |
| critical | true | Critical rule flag |
| tierRateLabel | Rebate Rate | Display label |
| tierBasisLabel | Net Sales | Display label |

#### Rule: Specialty Retail Display Bonus
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | fixed_fee | Fixed amount per unit |
| fixedAmount | 2 | $2 per unit |
| fixedAmountPeriod | per Unit | Per-unit calculation |
| threshold | 50 | Minimum units required |
| bonusThreshold | 50 | Bonus activation threshold |
| bonusRate | 2 | $2 per unit |
| calculationBasis | Units Sold | Based on quantity |
| product | Headphones, Speakers | Eligible categories |
| territory | United States | Authorized territory |
| frequency | Quarterly | Payment frequency |
| category | Special Programs | Rule category |
| tierRateLabel | Display Bonus Rate | Display label |
| tierBasisLabel | Units Sold | Display label |

### 6.2 CNT-2026-002 (Patent License) - Rule Field Mappings

#### Rule: Royalty Rate (5.5%)
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | percentage | Percentage-based calculation |
| baseRate | 0.055 | 5.5% rate |
| basisField | netSalesValue | Calculates on net sales |
| tiers[0].min | 0 | From $0 |
| tiers[0].max | 99999999.99 | Up to $99.99M |
| tiers[0].rate | 0.055 | 5.5% rate |

#### Rule: High-Volume Royalty Reduction (4.5%)
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | percentage | Percentage-based calculation |
| baseRate | 0.045 | 4.5% reduced rate |
| basisField | netSalesValue | Calculates on net sales |
| tiers[0].min | 10000000 | From $10,000,000 |
| tiers[0].max | 99999999.99 | Up to $99.99M |
| tiers[0].rate | 0.045 | 4.5% rate |

#### Rule: Minimum Annual Royalty ($500K)
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | minimum_guarantee | Floor guarantee |
| baseRate | 500000 | $500,000 minimum |
| minimumGuarantee | 500000 | Guarantee amount |
| description | Minimum Annual Royalty of $500,000 | Rule description |

### 6.3 CNT-2026-003 (Channel Rebate) - Rule Field Mappings

#### Rules: Tiered Rebate Structure (4 Tiers)

| Tier | Rule Name | Formula Fields |
|------|-----------|---------------|
| Entry | Tier 1 VAR Base Rebate – Entry | type: percentage, baseRate: 0.12, tiers[0]: {min: 0, max: 499999.99, rate: 0.12} |
| Standard | Tier 1 VAR Base Rebate – Standard | type: percentage, baseRate: 0.15, tiers[0]: {min: 500000, max: 1499999.99, rate: 0.15} |
| Preferred | Tier 1 VAR Base Rebate – Preferred | type: percentage, baseRate: 0.18, tiers[0]: {min: 1500000, max: 2999999.99, rate: 0.18} |
| Elite | Tier 1 VAR Base Rebate – Elite | type: percentage, baseRate: 0.22, tiers[0]: {min: 3000000, max: 99999999.99, rate: 0.22} |

**Common fields for all 4 tiers:**
| Formula Field | Value |
|---------------|-------|
| basisField | netSalesValue |
| calculationBasis | Net Sales |
| category | Core Rebate Rules |
| critical | true |
| schedule.frequency | Quarterly |
| schedule.paymentMethod | Wire |
| schedule.deadline | 45 days |
| lifecycle.autoRenewal | true |
| tierRateLabel | Rebate Rate |
| tierBasisLabel | Net Sales |

**Exclusions (apply to all tiers):**
- Professional Services
- API components
- Algorithm licensing products
- OEM components
- Non-rebate-eligible products

#### Rule: Enterprise Tier Bonus
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | percentage | Percentage-based |
| rate | 0.03 | 3% additional bonus |
| baseRate | 0.03 | 3% rate |
| basisField | netSalesValue | On net sales |
| trigger | product_line = Enterprise Tier | Conditional |
| category | Core Rebate Rules | Rule category |
| tiers[0].min | 0 | All sales amounts |
| tiers[0].max | 99999999.99 | No upper limit |
| tiers[0].rate | 0.03 | 3% |

#### Rule: Subscription Conversion Bonus
| Formula Field | Value | Description |
|---------------|-------|-------------|
| type | fixed_fee | Fixed amount |
| baseRate | 5000 | $5,000 per conversion |
| fixedAmount | 5000 | $5,000 |
| fixedAmountPeriod | per conversion | Per event |
| trigger | conversion_from = Perpetual License AND conversion_to = Annual Subscription | Conditional |
| calculationBasis | conversion event | Based on conversion |
| category | Core Rebate Rules | Rule category |

---

## 7. Sales Data CSV Format Reference

### 7.1 Supported Column Name Variations

The sales data parser supports flexible column naming. Here are the accepted variations:

| Standard Field | Accepted Column Names |
|---------------|----------------------|
| Transaction ID | transaction_id, txn_id, trans_id, Transaction ID |
| Transaction Date | transaction_date, date, txn_date, Date (optional - defaults to today) |
| Product Name | product_name, product, item_name, Product Name |
| Product Code | product_code, sku, product_id, item_code, Product Code |
| Category | category, product_category, cat, Category, Product Category |
| Territory | territory, region, country, Territory |
| Quantity | quantity, qty, units, units_sold, Units Sold |
| Unit Price | unit_price, price, Unit Price |
| Gross Amount | gross_amount, gross_sales, gross, Gross Sales |
| Net Amount | net_amount, net_sales, net_sales_amount, net, Net Sales |
| Currency | currency, cur (defaults to USD) |

### 7.2 CSV Template for Each Contract

**Specialty Retail (CNT-2026-001):**
```csv
transaction_id,product_name,product_code,category,territory,quantity,unit_price,gross_amount,net_amount,currency
```

**Patent License (CNT-2026-002):**
```csv
Transaction ID,Date,Product Name,Product Category,Application Sector,Units Sold,Unit Price,Gross Sales,Freight Costs,Sales Tax,Returns Credits,Trade Discounts,Distributor Commission,Territory,Customer Name
```

**Channel Rebate (CNT-2026-003):**
```csv
transaction_id,product_name,product_code,category,product_line,territory,quantity,unit_price,gross_amount,net_sales,conversion_from,conversion_to,currency
```

---

## 8. Calculation Results Summary

### All Three Contracts - Side by Side

| Metric | CNT-2026-001 (Retail) | CNT-2026-002 (Patent) | CNT-2026-003 (Rebate) |
|--------|----------------------|----------------------|----------------------|
| Contract Type | Rebate/MDF | Royalty | Rebate |
| Counterparty | Tech Sound Audio | PrecisionTech Mfg | InnovateSoft Solutions |
| Sales Transactions | 50 | 27 | 28 |
| Total Sales | $2,560,486.72 | $19,667,709.84 | $6,850,000.00 |
| Total Fee | $128,024.34 | $1,081,724.04 | $822,000.00 |
| Effective Rate | ~5% | ~5.5% | ~12% |
| Fee Type | Base Rebate + Display Bonus | Patent Royalty | Tiered Channel Rebate |
| Minimum Guarantee | None | $500,000 (passed) | None |
| Calculation Status | pending_approval | pending_approval | pending_approval |

### Calculation Verification

**CNT-2026-001 Verification:**
- Base Rebate: $2,560,486.72 x 5% = $128,024.34
- Display Bonus: Applied per qualifying unit (>= 50 units threshold)
- Total: $128,024.34

**CNT-2026-002 Verification:**
- Standard Rate: $19,667,709.84 x 5.5% = $1,081,724.04
- Minimum Check: $1,081,724.04 > $500,000 minimum - PASSES
- Total: $1,081,724.04

**CNT-2026-003 Verification:**
- Total Net Sales: $6,850,000 (falls in $3M+ Elite tier range)
- Applied Rate: 12% base entry rate on cumulative sales
- Total Rebate: $6,850,000 x 12% = $822,000.00

---

## 9. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "No rules found" after upload | Wait for AI extraction to complete; check contract status is "analyzed" |
| Rules missing formula_definition | Click "Enrich All with AI" on the Manage License Fee Rules page |
| Formula shows 0% rate | Manually edit the rule and populate the baseRate and tiers in formula_definition |
| CSV upload fails | Check column names match accepted variations (see Section 7.1) |
| "No matching contract" for sales | Ensure sales data is matched to the correct contract ID |
| Calculation returns $0 | Verify formula_definition has populated rates (baseRate, tiers) |
| Company Mapping shows "Pending" | Review and click "Confirm" on each mapping in Company Mapping Library |
| Date parsing errors | Use MM/DD/YYYY format, or omit date column (defaults to today) |

### Key Things to Check Before Running Calculation

1. Contract status = "analyzed"
2. Rules have been enriched with AI (formula_definition is populated)
3. Calculation rules have correct baseRate values (not 0 or null)
4. Sales data CSV has been uploaded and matched to the contract
5. Territory and product filters match between rules and sales data

### Formula Definition Structure Quick Reference

```
Percentage Rule:
  type: "percentage"
  baseRate: 0.055 (the decimal rate, e.g., 5.5%)
  basisField: "netSalesValue"
  tiers: [{ min, max, rate }]

Fixed Fee Rule:
  type: "fixed_fee"
  fixedAmount: 5000 (dollar amount)
  fixedAmountPeriod: "per conversion" or "per Unit"

Minimum Guarantee:
  type: "minimum_guarantee"
  baseRate: 500000 (floor amount)
  minimumGuarantee: 500000
```

---

*Document generated from live LicenseIQ platform data. Last updated: February 2026.*
