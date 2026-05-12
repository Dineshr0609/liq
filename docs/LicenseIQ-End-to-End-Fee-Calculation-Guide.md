# LicenseIQ - End-to-End License Fee Calculation Guide

This guide walks you through the complete process of calculating license fees in LicenseIQ, from uploading a contract all the way to generating a final fee report. Each step includes where to go, what to click, and what to expect.

---

## Table of Contents

1. [Overview - How It All Fits Together](#1-overview---how-it-all-fits-together)
2. [Step 1: Upload a Contract (PDF)](#step-1-upload-a-contract-pdf)
3. [Step 2: Review AI-Extracted Rules](#step-2-review-ai-extracted-rules)
4. [Step 3: Enrich Rules with AI](#step-3-enrich-rules-with-ai)
5. [Step 4: Map Contract Terms to ERP Fields](#step-4-map-contract-terms-to-erp-fields)
6. [Step 5: Upload Sales Data (CSV)](#step-5-upload-sales-data-csv)
7. [Step 6: Run the License Fee Calculation](#step-6-run-the-license-fee-calculation)
8. [Step 7: View Results and Reports](#step-7-view-results-and-reports)
9. [Rules Field Mapping Reference](#rules-field-mapping-reference)
10. [ERP Field Mapping Reference](#erp-field-mapping-reference)
11. [CSV File Format Reference](#csv-file-format-reference)
12. [Troubleshooting](#troubleshooting)

---

## 1. Overview - How It All Fits Together

LicenseIQ automates the process of calculating license fees from your contracts. Here's the big picture:

```
Upload Contract (PDF)
        |
        v
AI Reads & Extracts Rules (automatic)
        |
        v
Review & Confirm Rules
        |
        v
Map Contract Terms to Your ERP Fields (optional but recommended)
        |
        v
Upload Sales Data (CSV)
        |
        v
Run Calculation
        |
        v
View Results, Download Invoice
```

**What you need before you start:**
- A contract file (PDF format)
- A sales data file (CSV format) with transaction details
- A user account with appropriate permissions (Admin or Company Admin)

---

## Step 1: Upload a Contract (PDF)

**Where to go:** Click **"Upload Contract"** in the left sidebar menu, or navigate to the Upload page.

**What to do:**

1. On the Upload page, you'll see a file upload area
2. **Drag and drop** your contract PDF onto the upload area, or click to browse your files
3. Select the **Contract Type** from the dropdown (e.g., "Royalty License", "Rebate Agreement", "Distribution Agreement")
4. Optionally set:
   - **Priority** (Normal, High, or Urgent)
   - **Notes** about the contract
   - **Processing Options** - keep "AI Analysis" and "Extract Terms" checked (they're on by default)
5. Click **"Upload & Process"**

**What happens next:**
- The system uploads your PDF and starts reading it with AI
- AI automatically extracts the payment rules, rates, and terms from the contract
- You'll be redirected to the contract detail page once processing is complete
- Status will show as "Analyzed" when the AI is done reading

**Tip:** The AI works best with clearly structured contracts. If your contract has tables with rates and tiers, the AI will extract those as separate rules.

---

## Step 2: Review AI-Extracted Rules

**Where to go:** From the **Contracts** list in the sidebar, click on your contract, then click **"View Rules"** or navigate to the Rules tab.

**What you'll see:**

The Rules page has **4 tabs**:

| Tab | What It Shows |
|-----|---------------|
| **Rules & Formula** | The payment rules extracted by AI - rates, percentages, tier structures |
| **Contract Terms** | Key terms from the contract (dates, parties, territories, etc.) |
| **Examples & Notes** | Any example calculations or notes found in the contract |
| **Implementation & Sources** | Source references showing where in the PDF each rule came from |

**What to do:**

1. Go to the **"Rules & Formula"** tab
2. Review each rule that the AI extracted:
   - **Rule Name** - A descriptive name for the rule
   - **Rule Type** - "percentage", "fixed", "tiered", etc.
   - **Base Rate** - The percentage or amount (e.g., "5%" or "$0.50")
   - **Calculation Basis** - What the rate applies to (e.g., "Net Sales", "Gross Revenue")
   - **Product Categories** - Which products this rule covers
   - **Territories** - Which regions this rule applies to
3. Each rule shows a **confidence badge**:
   - **High confidence (green)** - AI is confident this is correct, auto-confirmed
   - **Medium confidence (yellow)** - Review recommended
   - **Low confidence (red)** - Manual review needed
4. You can **edit** any rule by clicking the edit icon
5. You can **confirm** rules you've reviewed by clicking the checkmark
6. You can also **add rules manually** if the AI missed something

**Rule Source Indicators:**
- **"AI Extracted"** badge - Rule was found by AI in the contract
- **"Manual"** badge - Rule was added by a user manually

---

## Step 3: Enrich Rules with AI

**Where to go:** Same Rules page from Step 2.

**What this does:** Enrichment adds extra detail to each rule - things like formula definitions, ERP field suggestions, and calculation logic that the system needs to actually compute fees.

**What to do:**

1. On the Rules page, click the **"Enrich All with AI"** button (it has a sparkle icon)
2. The system processes rules in batches of 5
3. A progress bar shows how many rules have been enriched
4. Wait for the "Enrichment Complete" message

**When to use enrichment:**
- After initial contract upload and rule extraction
- After manually adding or editing rules
- If rules show as "needs enrichment" (missing formula definitions)

**Tip:** Enrichment happens automatically when you switch between tabs on the rules page, so you may not always need to click the button manually.

---

## Step 4: Map Contract Terms to ERP Fields

This step connects the terms found in your contract to the fields in your business system (ERP). This is what makes the calculation engine understand which data to use.

### 4A: View Mappings on the Contract Rules Page

**Where to go:** Contract > Rules > **"Rules & Formula"** tab

Each rule shows its field mappings. For example:
- "Net Sales" (from contract) → maps to → "net_amount" (in your ERP)
- "Product Category" (from contract) → maps to → "item_category" (in your ERP)

You can click the **link icon** next to any mapping to:
- Change which ERP field it maps to
- Link it to a specific record (e.g., a specific vendor or item from your master data)

### 4B: Use the Company Mapping Library

**Where to go:** Click **"Company Mapping Library"** in the sidebar menu.

This is your central hub for all term mappings across all contracts. It shows three types of mappings:

| Mapping Type | What It Is | Example |
|-------------|------------|---------|
| **Field Mapping** | A contract term mapped to an ERP field | "Net Revenue" → "net_amount" |
| **Contract Rule** | A payment rule mapped to ERP calculation fields | "5% Base Rebate" → percentage calculation |
| **Contract Rule Tier** | A tier within a tiered rule mapped to ERP fields | "Tier 1: 0-1000 units @ 3%" → tier definition |

**The library has tabs:**
- **Pending** - Mappings that need your review and confirmation
- **Confirmed** - Mappings you've approved
- **All Mappings** - Everything in one view

**What to do for each mapping:**

1. **Review** the mapping - check that the contract term matches the right ERP field
2. **Select the ERP Entity** - Choose which business object this maps to (e.g., "Items", "Vendors", "Sales Transactions")
3. **Select the ERP Field** - Choose the specific field within that entity
4. **Link to a Record** (optional) - Connect to a specific master data record (e.g., link "Acme Corp" to the actual vendor record in your system)
5. Click **Confirm** to approve the mapping

### 4C: ERP Catalog Setup (One-Time Setup)

**Where to go:** Sidebar > **"ERP Catalog"**

Before mappings can work, your ERP system needs to be configured:

1. Select your ERP system (e.g., Oracle EBS, SAP, or any custom ERP)
2. Define the **Entities** (business objects) in your ERP - like Items, Vendors, Sales Orders
3. Define the **Fields** within each entity - like item_number, vendor_name, order_date
4. The system comes pre-loaded with common ERP configurations

### 4D: LicenseIQ Schema Catalog

**Where to go:** Sidebar > **"LicenseIQ Schema"**

This is the internal standard schema that acts as a bridge between your ERP and the contract terms. It includes standard entities like:
- Sales Transactions
- Items / Products
- Vendors / Suppliers
- License Fee Rules

**Tip:** You typically only need to set up the ERP Catalog once. After that, mappings for new contracts will suggest matches automatically based on your existing library.

---

## Step 5: Upload Sales Data (CSV)

**Where to go:** Click **"Sales Upload"** in the sidebar menu.

**What to do:**

1. **Select a Contract** from the dropdown - this tells the system which rules to apply
2. **Choose your CSV file** - Click "Browse" or drag-and-drop your sales data file
3. Click **"Upload"**

**What happens:**
- The system reads your CSV file
- Each row becomes a sales transaction linked to your contract
- A success message shows how many transactions were imported
- You can navigate to the contract to see the uploaded data

### CSV File Requirements

Your CSV file should have columns for sales transaction data. The system is flexible with column names - here are the accepted variations:

| What the System Needs | Accepted Column Names in Your CSV |
|----------------------|-----------------------------------|
| **Product Name** | product_name, productName, product, item_name, itemName, item, description |
| **Quantity** | quantity, qty, units, unit_quantity, volume |
| **Gross Amount** | gross_amount, grossAmount, gross_sales, total_amount, totalAmount, amount, revenue, sales_amount, salesAmount, sale_amount |
| **Net Amount** | net_amount, netAmount, net_sales, net_revenue, net_sales_value |
| **Territory** | territory, region, market, location, country, state, channel, partner_name |
| **Transaction Date** | date, transaction_date, transactionDate, sale_date, invoice_date, order_date |
| **Product Category** | category, product_category, productCategory, product_type |
| **Customer** | customer, customer_name, customerName, buyer, client |
| **Product Code** | sku, product_code, productCode, item_number, item_code, product_id, itemCode |
| **Unit Price** | unit_price, unitPrice, price, price_per_unit |

**Important Notes:**
- At minimum, your CSV should have: product name, quantity, and an amount (gross or net)
- If you only provide net amount, the system automatically copies it to gross amount (and vice versa)
- Dates should be in a standard format (MM/DD/YYYY, YYYY-MM-DD, etc.)
- The first row must be column headers

**Example CSV:**
```
product_name,quantity,net_amount,territory,transaction_date
Widget Pro,100,5000.00,North America,01/15/2024
Widget Basic,250,3750.00,Europe,01/20/2024
Premium Service,50,12500.00,North America,02/01/2024
```

---

## Step 6: Run the License Fee Calculation

**Where to go:** From your contract page, click the **"License Fee Dashboard"** button, or navigate to the **License Fee Calculator** from the sidebar.

**What to do:**

1. On the License Fee Dashboard, you'll see a summary of your contract and any previous calculations
2. Click the **"Run Calculation"** button
3. A form appears where you can:
   - Give the calculation a **name** (e.g., "Q4 2024 License Fee")
   - Set the **period** (start and end dates) - optional
4. Click **"Calculate"**

**What happens:**
- The system takes each sales transaction from your uploaded data
- For each transaction, it finds the matching rule based on:
  - Product category
  - Territory
  - Date range
  - Any other rule conditions
- It applies the formula (percentage, fixed fee, tiered rate, etc.)
- Results appear immediately on the dashboard

**How rules match to sales:**
- Rules with **empty product categories and territories** match ALL sales (they're universal rules)
- Rules with specific categories/territories only match sales in those categories/territories
- If multiple rules could match, the most specific one takes priority

---

## Step 7: View Results and Reports

### On the License Fee Dashboard

After calculation, the dashboard shows:

- **Total License Fee** - The grand total of all calculated fees
- **Total Sales Amount** - Sum of all sales that were included
- **Sales Count** - Number of transactions processed
- **Chart** - Visual breakdown of sales vs. license fees by product

### Line-by-Line Breakdown

Below the summary, you'll see every transaction with:
- Product name
- Quantity sold
- Sale amount
- Which rule was applied
- Calculated license fee for that transaction
- Explanation of how the fee was computed

### Download Reports

You can download two types of invoices:
- **Detailed Invoice** - Every line item with full breakdown
- **Summary Invoice** - Totals grouped by rule or category

### Calculation History

**Where to go:** Sidebar > **"Calculations"** (under License Fee Calculations)

This page shows all calculations across all contracts with:
- Calculation name and date
- Contract it belongs to
- Total sales and license fee amounts
- Status (Draft, Approved, Rejected)

Click any calculation to expand and see the full breakdown.

### Audit Trail

**Where to go:** From any calculation, click **"View Audit Trail"**

This shows a detailed log of:
- Who ran the calculation and when
- What rules were applied
- Any changes or approvals

---

## Rules Field Mapping Reference

This table shows every field in a payment rule and what it means:

| Rule Field | What It Means | Example Values |
|-----------|---------------|----------------|
| **Rule Name** | Descriptive name for the rule | "Base Retail Rebate", "Volume Discount Tier" |
| **Rule Type** | How the fee is calculated | "percentage", "fixed", "tiered", "volume_based" |
| **Base Rate** | The rate or amount | "5%", "0.05", "$1.50" |
| **Calculation Basis** | What amount the rate applies to | "Net Sales", "Gross Revenue", "Units Sold" |
| **Product Categories** | Which products this rule covers | {"Retail": true, "Wholesale": true} or {} for all |
| **Territories** | Which regions this rule applies to | {"North America": true} or {} for all |
| **Minimum Guarantee** | Minimum fee regardless of calculation | "$10,000" |
| **Effective Date** | When the rule starts applying | "01/01/2024" |
| **Expiry Date** | When the rule stops applying | "12/31/2024" |
| **Volume Tiers** | Tiered rate structure | See tiered rules section below |
| **Formula Definition** | Machine-readable calculation logic | JSON formula tree (auto-generated) |
| **Confidence** | AI's confidence in the extraction | "high", "medium", "low" |
| **Status** | Whether the rule has been reviewed | "confirmed", "pending", "rejected" |
| **Source** | Where in the contract this was found | "Page 5, Section 3.2" |

### Tiered Rule Example

For contracts with volume-based tiers:

| Tier | Range | Rate |
|------|-------|------|
| Tier 1 | 0 - 1,000 units | 3% |
| Tier 2 | 1,001 - 5,000 units | 4% |
| Tier 3 | 5,001+ units | 5% |

Each tier is stored as a separate mapping in the Company Mapping Library so you can map tier boundaries and rates to your ERP fields individually.

---

## ERP Field Mapping Reference

This table explains how contract terms connect to your ERP system:

### Common ERP Entity Mappings

| Contract Term | ERP Entity | ERP Field | Purpose |
|--------------|------------|-----------|---------|
| Vendor / Licensor | Vendors | vendor_name | Identifies who receives the fee |
| Product / Item | Items | item_number | Identifies what was sold |
| Net Sales | Sales Transactions | net_amount | The dollar amount used for calculation |
| Gross Sales | Sales Transactions | gross_amount | Total sales before deductions |
| Quantity | Sales Transactions | quantity | Units sold |
| Territory / Region | Sales Transactions | territory | Geographic region of the sale |
| Transaction Date | Sales Transactions | transaction_date | When the sale occurred |
| Product Category | Items | item_category | Product grouping for rule matching |
| Customer | Sales Transactions | customer_name | Who bought the product |

### How Mapping Works

```
Contract says:           Your ERP has:           LicenseIQ maps:
"Net Revenue"    -->     "net_amount"     -->    Used as calculation basis
"Retail Category" -->    "item_category"  -->    Used for rule matching
"North America"   -->    "territory"      -->    Used for rule filtering
```

### Mapping Status Flow

```
AI Suggests Mapping (Pending)
        |
        v
User Reviews & Confirms
        |
        v
Mapping Active (Used in Calculations)
```

### Dual Mapping (ERP + LicenseIQ Schema)

Each mapping can have two levels:
1. **ERP Mapping** - Maps to your specific ERP system (e.g., Oracle EBS "AP_INVOICES.AMOUNT")
2. **LicenseIQ Mapping** - Maps to the standard LicenseIQ schema (e.g., "Sales Transactions.net_amount")

This dual mapping ensures your data works regardless of which ERP system you use.

---

## CSV File Format Reference

### Minimum Required Columns

```csv
product_name,quantity,net_amount
Widget A,100,5000.00
Widget B,50,2500.00
```

### Recommended Full Format

```csv
product_name,product_code,category,quantity,unit_price,gross_amount,net_amount,territory,customer,transaction_date
Widget Pro,WP-001,Electronics,100,50.00,5000.00,4750.00,North America,Acme Corp,01/15/2024
Widget Basic,WB-002,Electronics,250,15.00,3750.00,3562.50,Europe,Beta Inc,01/20/2024
Premium Service,PS-003,Services,50,250.00,12500.00,12500.00,North America,Gamma LLC,02/01/2024
```

### Column Name Flexibility

The system accepts many common variations of column names. You don't need to rename your columns - just upload your file as-is and the system will match them automatically. See the full list in [Step 5](#step-5-upload-sales-data-csv).

---

## Troubleshooting

### "No rules found" when calculating
- Go to the contract's Rules page and check that rules exist
- Make sure rules are in "confirmed" status
- Try running "Enrich All with AI" to regenerate formula definitions

### "0 transactions imported" after CSV upload
- Check that your CSV has proper column headers in the first row
- Make sure column names match one of the accepted variations (see CSV Reference above)
- Verify the file is actually CSV format (comma-separated), not Excel format
- Open the file in a text editor to check for formatting issues

### Calculation shows $0 for all items
- Check that rules have a valid base rate (not empty or 0%)
- Go to Rules page and verify the formula definition exists (run enrichment if needed)
- Make sure the calculation basis field ("Net Sales" or "Gross Revenue") matches your uploaded data

### Sales data not matching any rules
- Rules with empty product categories {} match ALL sales - this is normal
- If rules have specific categories, make sure your CSV category values match
- Check territory matching - rule territories must match your CSV territory values

### ERP mappings not showing
- Make sure ERP Catalog is configured with your ERP system
- Go to Company Mapping Library and confirm pending mappings
- Check that the LicenseIQ Schema has the entities your contract references

---

## Quick Reference - Complete Workflow Checklist

- [ ] **1. Upload Contract** - Go to Upload Contract > select PDF > choose contract type > Upload & Process
- [ ] **2. Wait for AI** - Contract status changes to "Analyzed" when AI is done reading
- [ ] **3. Review Rules** - Go to Contract > Rules tab > review each extracted rule
- [ ] **4. Enrich Rules** - Click "Enrich All with AI" on the Rules page
- [ ] **5. Confirm Rules** - Review and confirm each rule (especially medium/low confidence ones)
- [ ] **6. Map to ERP** (optional) - Go to Company Mapping Library > review and confirm mappings
- [ ] **7. Upload Sales CSV** - Go to Sales Upload > select contract > upload CSV file
- [ ] **8. Calculate Fees** - Go to Contract > License Fee Dashboard > Run Calculation
- [ ] **9. Review Results** - Check the breakdown, verify amounts look correct
- [ ] **10. Download Invoice** - Click Detailed or Summary invoice download

---

*This guide covers LicenseIQ's universal contract-agnostic calculation system. The platform supports any contract type - royalty licenses, rebates, revenue sharing, distribution agreements, and more. The same workflow applies regardless of contract type.*
