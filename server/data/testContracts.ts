/**
 * Contract Intelligence Test Suite
 * 20+ diverse test contracts with ground truth answers for accuracy validation
 * 
 * Each test case includes:
 * - Contract text (realistic snippets)
 * - Ground truth values (manually verified)
 * - Contract type classification
 * - Complexity rating
 */

import { GroundTruthField, TestCaseInput } from '../services/accuracyTestingService';

export const CONTRACT_TEST_SUITE: TestCaseInput[] = [
  // ===== ROYALTY/LICENSE CONTRACTS =====
  {
    name: 'Simple Flat Royalty',
    contractType: 'royalty_license',
    description: 'Basic flat percentage fee agreement',
    contractText: `
LICENSE AGREEMENT

Between: ABC Corporation ("Licensor")
And: XYZ Inc. ("Licensee")
Effective Date: January 1, 2024
Term: 3 years

ARTICLE 5 - ROYALTY PAYMENTS

5.1 Fee Rate: Licensee shall pay to Licensor a fee of five percent (5%) of Net Sales.

5.2 Definition of Net Sales: "Net Sales" means the gross invoice price charged for Products sold, less:
(a) trade discounts actually allowed and taken;
(b) credits or allowances for returns;
(c) freight, shipping, and insurance costs.

5.3 Payment Schedule: Royalties are payable quarterly, within 30 days of each calendar quarter end.

5.4 Minimum Fee: A minimum annual royalty of $50,000 USD shall be paid regardless of sales volume.
    `,
    groundTruth: [
      { fieldName: 'royaltyRate', expectedValue: 5, fieldType: 'number', isRequired: true },
      { fieldName: 'calculationBase', expectedValue: 'net sales', fieldType: 'string', isRequired: true },
      { fieldName: 'paymentFrequency', expectedValue: 'quarterly', fieldType: 'string', isRequired: true },
      { fieldName: 'minimumPayment', expectedValue: 50000, fieldType: 'number', isRequired: true },
      { fieldName: 'termYears', expectedValue: 3, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Tiered Volume Royalty',
    contractType: 'royalty_license',
    description: 'Multi-tier fee based on sales volume',
    contractText: `
MASTER LICENSE AGREEMENT

Section 4: Contract Fees

4.1 Tiered Fee Structure:
The fee rate shall be calculated based on cumulative annual Net Revenue as follows:

| Annual Net Revenue Tier | Fee Rate |
|------------------------|--------------|
| $0 - $500,000 | 8% |
| $500,001 - $2,000,000 | 6% |
| $2,000,001 - $5,000,000 | 4% |
| Over $5,000,000 | 3% |

4.2 Calculation Method: Each tier applies only to revenue within that tier (incremental method).

4.3 Revenue Recognition: Revenue is recognized upon shipment of product to customer.

4.4 Quarterly True-Up: At each quarter end, cumulative revenue is calculated and excess or shortfall from prior payments is adjusted.
    `,
    groundTruth: [
      { fieldName: 'rules', expectedValue: [
        { tier: 1, minValue: 0, maxValue: 500000, rate: 8 },
        { tier: 2, minValue: 500001, maxValue: 2000000, rate: 6 },
        { tier: 3, minValue: 2000001, maxValue: 5000000, rate: 4 },
        { tier: 4, minValue: 5000001, maxValue: null, rate: 3 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'calculationMethod', expectedValue: 'incremental', fieldType: 'string', isRequired: true },
      { fieldName: 'calculationBase', expectedValue: 'net revenue', fieldType: 'string', isRequired: true }
    ]
  },

  {
    name: 'Per-Unit Container Fee',
    contractType: 'royalty_license',
    description: 'Plant nursery per-container royalty with size tiers',
    contractText: `
PLANT VARIETY LICENSE AGREEMENT

Licensed Variety: Rosa 'Sunset Dream'
Licensor: Flower Genetics LLC
Licensee: Garden Center Wholesale

SCHEDULE A - ROYALTY RATES

Per container fee rates based on container size:

Container Size | Royalty per Unit
--------------|------------------
1 gallon      | $0.25
2 gallon      | $0.35
3 gallon      | $0.45
5 gallon      | $0.65
7 gallon      | $0.85
15 gallon     | $1.50

ADDITIONAL TERMS:
- All royalties are per finished plant sold
- Reports due within 15 days of month end
- Payment due within 30 days of month end
- Quarterly minimum of 1,000 plants per size category applies
    `,
    groundTruth: [
      { fieldName: 'ruleType', expectedValue: 'per_unit', fieldType: 'string', isRequired: true },
      { fieldName: 'rules', expectedValue: [
        { containerSize: '1 gallon', rate: 0.25 },
        { containerSize: '2 gallon', rate: 0.35 },
        { containerSize: '3 gallon', rate: 0.45 },
        { containerSize: '5 gallon', rate: 0.65 },
        { containerSize: '7 gallon', rate: 0.85 },
        { containerSize: '15 gallon', rate: 1.50 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'reportingFrequency', expectedValue: 'monthly', fieldType: 'string', isRequired: true }
    ]
  },

  // ===== DISTRIBUTOR/RESELLER CONTRACTS =====
  {
    name: 'Distributor Margin Agreement',
    contractType: 'distributor_reseller',
    description: 'Distributor agreement with margin-based commission',
    contractText: `
DISTRIBUTION AGREEMENT

Between: TechPro Manufacturing ("Supplier")
And: Regional Distributors Inc. ("Distributor")

SECTION 6 - PRICING AND MARGINS

6.1 Distributor Discount: Distributor shall receive a discount of thirty-five percent (35%) off the published Manufacturer's Suggested Retail Price (MSRP) for all Products.

6.2 Volume Incentives:
- Annual purchases exceeding $1,000,000: Additional 2% discount
- Annual purchases exceeding $2,500,000: Additional 5% discount

6.3 Marketing Development Funds (MDF):
Supplier shall provide MDF equal to 3% of net purchases, to be used for approved marketing activities.

6.4 Payment Terms: Net 45 days from invoice date.

6.5 Territory: Exclusive distribution rights for California, Nevada, and Arizona.
    `,
    groundTruth: [
      { fieldName: 'distributorDiscount', expectedValue: 35, fieldType: 'number', isRequired: true },
      { fieldName: 'volumeIncentives', expectedValue: [
        { threshold: 1000000, additionalDiscount: 2 },
        { threshold: 2500000, additionalDiscount: 5 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'mdfRate', expectedValue: 3, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentTerms', expectedValue: 45, fieldType: 'number', isRequired: true },
      { fieldName: 'territories', expectedValue: ['California', 'Nevada', 'Arizona'], fieldType: 'array', isRequired: true }
    ]
  },

  {
    name: 'Reseller Commission Structure',
    contractType: 'distributor_reseller',
    description: 'Software reseller with tiered commissions',
    contractText: `
AUTHORIZED RESELLER AGREEMENT

Partner Program Terms

SECTION 3: COMMISSION SCHEDULE

3.1 Base Commission Rates:
Partner Level | Commission Rate
--------------|-----------------
Silver        | 15% of net license revenue
Gold          | 20% of net license revenue
Platinum      | 25% of net license revenue

3.2 Service Add-On Commission:
- Implementation services: 10% of billed amount
- Annual maintenance: 5% of renewal value
- Training services: 12% of billed amount

3.3 New Customer Bonus: 
First sale to new customer receives additional 5% bonus commission.

3.4 Payment: Commissions paid monthly, 45 days after invoice payment received from end customer.
    `,
    groundTruth: [
      { fieldName: 'commissionStructure', expectedValue: [
        { level: 'Silver', rate: 15 },
        { level: 'Gold', rate: 20 },
        { level: 'Platinum', rate: 25 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'serviceCommissions', expectedValue: [
        { service: 'implementation', rate: 10 },
        { service: 'maintenance', rate: 5 },
        { service: 'training', rate: 12 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'newCustomerBonus', expectedValue: 5, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== REBATE/MDF CONTRACTS =====
  {
    name: 'Quarterly Rebate Program',
    contractType: 'rebate_mdf',
    description: 'Volume-based quarterly rebate structure',
    contractText: `
CHANNEL PARTNER REBATE PROGRAM 2024

REBATE SCHEDULE

Quarterly Purchase Volume | Rebate Percentage
--------------------------|-------------------
$0 - $100,000            | 0%
$100,001 - $250,000      | 2%
$250,001 - $500,000      | 3.5%
$500,001 - $1,000,000    | 5%
Over $1,000,000          | 7%

PROGRAM TERMS:
- Rebates calculated on net purchases after returns
- Rebate payments issued within 60 days of quarter end
- Rebates paid as credit memo or check at partner's election
- Program runs January 1 through December 31, 2024
- Rebates are non-cumulative (each quarter calculated independently)
    `,
    groundTruth: [
      { fieldName: 'rebateTiers', expectedValue: [
        { minValue: 0, maxValue: 100000, rate: 0 },
        { minValue: 100001, maxValue: 250000, rate: 2 },
        { minValue: 250001, maxValue: 500000, rate: 3.5 },
        { minValue: 500001, maxValue: 1000000, rate: 5 },
        { minValue: 1000001, maxValue: null, rate: 7 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'calculationPeriod', expectedValue: 'quarterly', fieldType: 'string', isRequired: true },
      { fieldName: 'paymentTiming', expectedValue: 60, fieldType: 'number', isRequired: true },
      { fieldName: 'isCumulative', expectedValue: false, fieldType: 'boolean', isRequired: true }
    ]
  },

  {
    name: 'Marketing Development Fund',
    contractType: 'rebate_mdf',
    description: 'MDF allocation and claim process',
    contractText: `
MARKETING DEVELOPMENT FUND AGREEMENT

1. MDF ALLOCATION
1.1 Quarterly Accrual: Partner earns MDF at rate of 4% of net purchases.
1.2 Maximum Annual Accrual: $200,000 USD
1.3 Carryover: Unused funds carry over for one quarter only.

2. ELIGIBLE ACTIVITIES
- Trade shows and events: up to 50% of event costs
- Digital marketing: 100% of approved costs
- Print advertising: 75% of media costs
- Training events: 100% of venue and materials

3. CLAIM PROCESS
- Pre-approval required for activities over $5,000
- Claims must be submitted within 45 days of activity
- Payment within 30 days of approved claim
- Minimum claim amount: $500
    `,
    groundTruth: [
      { fieldName: 'mdfAccrualRate', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'maxAnnualAccrual', expectedValue: 200000, fieldType: 'number', isRequired: true },
      { fieldName: 'claimDeadlineDays', expectedValue: 45, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentDays', expectedValue: 30, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumClaim', expectedValue: 500, fieldType: 'number', isRequired: true },
      { fieldName: 'preApprovalThreshold', expectedValue: 5000, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== REFERRAL CONTRACTS =====
  {
    name: 'Simple Referral Commission',
    contractType: 'referral',
    description: 'One-time referral fee structure',
    contractText: `
REFERRAL PARTNER AGREEMENT

SECTION 2: REFERRAL FEES

2.1 Referral Commission: Partner shall receive a one-time referral fee of 10% of the first-year contract value for each qualified referral that results in a closed sale.

2.2 Qualified Referral: A referral is "qualified" when:
(a) Customer has not contacted Company in prior 12 months
(b) Partner introduces customer via referral registration form
(c) Customer signs contract within 90 days of referral

2.3 Payment Timing: Commission paid within 30 days of customer's first payment.

2.4 Multi-Year Deals: For contracts exceeding 12 months, commission is based on first-year value only.
    `,
    groundTruth: [
      { fieldName: 'referralRate', expectedValue: 10, fieldType: 'number', isRequired: true },
      { fieldName: 'calculationBase', expectedValue: 'first-year contract value', fieldType: 'string', isRequired: true },
      { fieldName: 'qualificationPeriod', expectedValue: 90, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentTiming', expectedValue: 30, fieldType: 'number', isRequired: true },
      { fieldName: 'isRecurring', expectedValue: false, fieldType: 'boolean', isRequired: true }
    ]
  },

  {
    name: 'Recurring Referral Revenue Share',
    contractType: 'referral',
    description: 'Ongoing revenue share for referrals',
    contractText: `
STRATEGIC REFERRAL PARTNERSHIP

REVENUE SHARING TERMS

1. INITIAL COMMISSION
First-year referral fee: 15% of annual contract value

2. ONGOING REVENUE SHARE
- Year 2: 8% of renewal value
- Year 3: 5% of renewal value  
- Year 4+: 3% of renewal value (perpetual)

3. ACCELERATOR BONUSES
- 5+ qualified referrals per quarter: +2% on all referrals
- 10+ qualified referrals per quarter: +5% on all referrals

4. CONDITIONS
- Revenue share paid only while customer remains active
- Partner must remain in good standing
- Non-payment if customer cancels within 90 days (clawback)
    `,
    groundTruth: [
      { fieldName: 'initialCommission', expectedValue: 15, fieldType: 'number', isRequired: true },
      { fieldName: 'recurringCommissions', expectedValue: [
        { year: 2, rate: 8 },
        { year: 3, rate: 5 },
        { year: 4, rate: 3 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'accelerators', expectedValue: [
        { threshold: 5, bonus: 2 },
        { threshold: 10, bonus: 5 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'clawbackPeriod', expectedValue: 90, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== DIRECT SALES CONTRACTS =====
  {
    name: 'Direct Sales Commission Plan',
    contractType: 'direct_sales',
    description: 'Sales rep commission with quota and accelerators',
    contractText: `
SALES COMPENSATION PLAN

Employee: [Sales Representative]
Territory: Northeast Region
Quota: $2,000,000 annual

COMMISSION STRUCTURE

Base Rate: 6% of net sales

ACCELERATORS (Applied to all sales in period):
- 100-125% of quota: 8% commission rate
- 125-150% of quota: 10% commission rate
- Over 150% of quota: 12% commission rate

SPIFFS:
- New logo (first sale to new customer): $1,500 bonus
- Multi-year deal (3+ years): $2,500 bonus
- Strategic product sale: Additional 2% on that sale

DRAW: $5,000 monthly recoverable draw against commissions

PAYMENT: Monthly, paid 15th of following month
    `,
    groundTruth: [
      { fieldName: 'baseCommissionRate', expectedValue: 6, fieldType: 'number', isRequired: true },
      { fieldName: 'quota', expectedValue: 2000000, fieldType: 'number', isRequired: true },
      { fieldName: 'accelerators', expectedValue: [
        { minPercent: 100, maxPercent: 125, rate: 8 },
        { minPercent: 125, maxPercent: 150, rate: 10 },
        { minPercent: 150, maxPercent: null, rate: 12 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'spiffs', expectedValue: [
        { type: 'new_logo', amount: 1500 },
        { type: 'multi_year', amount: 2500 },
        { type: 'strategic_product', rate: 2 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'draw', expectedValue: 5000, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== MARKETPLACE/PLATFORM CONTRACTS =====
  {
    name: 'Marketplace Seller Agreement',
    contractType: 'marketplace_platform',
    description: 'E-commerce marketplace fee structure',
    contractText: `
MARKETPLACE SELLER TERMS

SECTION 5: FEES AND CHARGES

5.1 Commission Rate by Category:
- Electronics: 8%
- Clothing & Apparel: 15%
- Home & Garden: 12%
- Books & Media: 15%
- Toys & Games: 15%
- Jewelry: 20%
- All Other: 15%

5.2 Additional Fees:
- Payment processing: 2.9% + $0.30 per transaction
- Monthly subscription: $39.99 (Professional plan)
- Fulfillment (optional): $2.50 per unit + weight-based shipping

5.3 Promotional Credits:
- New seller bonus: $100 advertising credit
- Volume threshold ($10,000/month): 1% fee reduction

5.4 Payment Schedule: Disbursements every 14 days
    `,
    groundTruth: [
      { fieldName: 'categoryCommissions', expectedValue: [
        { category: 'Electronics', rate: 8 },
        { category: 'Clothing & Apparel', rate: 15 },
        { category: 'Home & Garden', rate: 12 },
        { category: 'Books & Media', rate: 15 },
        { category: 'Toys & Games', rate: 15 },
        { category: 'Jewelry', rate: 20 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'defaultCommission', expectedValue: 15, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentProcessingRate', expectedValue: 2.9, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentProcessingFlat', expectedValue: 0.30, fieldType: 'number', isRequired: true },
      { fieldName: 'monthlySubscription', expectedValue: 39.99, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentFrequencyDays', expectedValue: 14, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'SaaS Platform Revenue Share',
    contractType: 'marketplace_platform',
    description: 'App store developer revenue share',
    contractText: `
DEVELOPER PLATFORM AGREEMENT

Revenue Share Terms

1. STANDARD REVENUE SHARE
Platform retains 30% of all sales through the platform.
Developer receives 70% of net revenue.

2. SMALL DEVELOPER PROGRAM
Developers earning less than $1,000,000 annually:
- Platform retains only 15%
- Developer receives 85%

3. SUBSCRIPTION REVENUE
For subscription products:
- First year: Standard 70/30 split
- Year 2+: Developer receives 85% (loyalty bonus)

4. IN-APP PURCHASES
Same rates as standard revenue share.

5. PAYMENT
Monthly payments, Net 45 after month end.
Minimum payout threshold: $100
    `,
    groundTruth: [
      { fieldName: 'standardDeveloperShare', expectedValue: 70, fieldType: 'number', isRequired: true },
      { fieldName: 'platformFee', expectedValue: 30, fieldType: 'number', isRequired: true },
      { fieldName: 'smallDeveloperThreshold', expectedValue: 1000000, fieldType: 'number', isRequired: true },
      { fieldName: 'smallDeveloperShare', expectedValue: 85, fieldType: 'number', isRequired: true },
      { fieldName: 'subscriptionYear2Share', expectedValue: 85, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentTerms', expectedValue: 45, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumPayout', expectedValue: 100, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== USAGE/SERVICE-BASED CONTRACTS =====
  {
    name: 'API Usage Pricing',
    contractType: 'usage_service',
    description: 'Tiered API call pricing',
    contractText: `
API SERVICE AGREEMENT

PRICING SCHEDULE

Monthly API Call Volume | Price per 1,000 Calls
------------------------|----------------------
0 - 100,000            | $2.00
100,001 - 500,000      | $1.50
500,001 - 2,000,000    | $1.00
2,000,001 - 10,000,000 | $0.50
Over 10,000,000        | $0.25

ADDITIONAL CHARGES:
- Premium endpoints: 2x standard rate
- Real-time streaming: $500/month base + $0.001 per event
- Data storage: $0.10 per GB per month
- Support SLA (99.9%): $2,000/month

FREE TIER: First 10,000 calls per month at no charge

BILLING: Monthly, charged on 1st of following month
    `,
    groundTruth: [
      { fieldName: 'pricingTiers', expectedValue: [
        { minCalls: 0, maxCalls: 100000, pricePerThousand: 2.00 },
        { minCalls: 100001, maxCalls: 500000, pricePerThousand: 1.50 },
        { minCalls: 500001, maxCalls: 2000000, pricePerThousand: 1.00 },
        { minCalls: 2000001, maxCalls: 10000000, pricePerThousand: 0.50 },
        { minCalls: 10000001, maxCalls: null, pricePerThousand: 0.25 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'freeTierCalls', expectedValue: 10000, fieldType: 'number', isRequired: true },
      { fieldName: 'premiumMultiplier', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'storagePerGbMonth', expectedValue: 0.10, fieldType: 'number', isRequired: true },
      { fieldName: 'supportSlaFee', expectedValue: 2000, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Cloud Storage Service',
    contractType: 'usage_service',
    description: 'Storage and bandwidth pricing',
    contractText: `
CLOUD STORAGE SERVICE AGREEMENT

PRICING

1. STORAGE COSTS (per GB per month)
- Standard storage: $0.023
- Infrequent access: $0.0125
- Archive storage: $0.004

2. DATA TRANSFER
- Inbound: Free
- Outbound to Internet:
  - First 10 GB/month: Free
  - 10 GB - 10 TB: $0.09 per GB
  - 10 TB - 50 TB: $0.085 per GB
  - 50 TB - 150 TB: $0.07 per GB
  - Over 150 TB: $0.05 per GB

3. OPERATIONS (per 10,000 requests)
- PUT, COPY, POST, LIST: $0.05
- GET, SELECT: $0.004
- DELETE: Free

4. MINIMUM MONTHLY CHARGE: $5.00
    `,
    groundTruth: [
      { fieldName: 'storagePricing', expectedValue: [
        { type: 'standard', pricePerGb: 0.023 },
        { type: 'infrequent', pricePerGb: 0.0125 },
        { type: 'archive', pricePerGb: 0.004 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'transferTiers', expectedValue: [
        { minGb: 0, maxGb: 10, price: 0 },
        { minGb: 10, maxGb: 10000, price: 0.09 },
        { minGb: 10000, maxGb: 50000, price: 0.085 },
        { minGb: 50000, maxGb: 150000, price: 0.07 },
        { minGb: 150000, maxGb: null, price: 0.05 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'minimumMonthlyCharge', expectedValue: 5.00, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== CHARGEBACKS/CLAIMS CONTRACTS =====
  {
    name: 'Vendor Chargeback Schedule',
    contractType: 'chargebacks_claims',
    description: 'Retail vendor compliance chargebacks',
    contractText: `
VENDOR COMPLIANCE MANUAL - CHARGEBACK SCHEDULE

SHIPPING VIOLATIONS:
- Late shipment (per day late): $100 + 1% of PO value
- Early shipment (without approval): $50 per carton
- Incorrect ship-to location: $500 per incident

PACKAGING VIOLATIONS:
- Incorrect UPC/barcode: $25 per unit
- Missing or incorrect label: $15 per carton
- Non-compliant packaging: $100 per carton

DOCUMENTATION VIOLATIONS:
- Missing packing list: $100 per shipment
- Missing or incorrect ASN: $200 per shipment
- Invoice discrepancy: $50 minimum + correction costs

QUALITY VIOLATIONS:
- Defective product: 100% of product cost + $200 handling
- Wrong product shipped: Full credit + 15% restocking fee
- Quantity variance (over 2%): Full adjustment + $75 admin fee

APPEAL PROCESS:
- Must submit within 30 days of chargeback notification
- Supporting documentation required
- Resolution within 15 business days
    `,
    groundTruth: [
      { fieldName: 'lateShipmentDaily', expectedValue: 100, fieldType: 'number', isRequired: true },
      { fieldName: 'lateShipmentPercent', expectedValue: 1, fieldType: 'number', isRequired: true },
      { fieldName: 'incorrectUpcPerUnit', expectedValue: 25, fieldType: 'number', isRequired: true },
      { fieldName: 'missingAsnCharge', expectedValue: 200, fieldType: 'number', isRequired: true },
      { fieldName: 'defectiveHandlingFee', expectedValue: 200, fieldType: 'number', isRequired: true },
      { fieldName: 'restockingFeePercent', expectedValue: 15, fieldType: 'number', isRequired: true },
      { fieldName: 'appealDeadlineDays', expectedValue: 30, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== COMPLEX MULTI-RULE CONTRACTS =====
  {
    name: 'Complex Hybrid Agreement',
    contractType: 'royalty_license',
    description: 'Multiple product lines with different rules',
    contractText: `
COMPREHENSIVE LICENSE AGREEMENT

SCHEDULE B: ROYALTY STRUCTURE

1. PRODUCT LINE A - Consumer Electronics
Base royalty: 4% of Net Sales
Minimum quarterly royalty: $25,000
Volume discount: Net Sales over $5M annually reduces rate to 3%

2. PRODUCT LINE B - Professional Equipment
Tiered structure:
- $0 - $1,000,000: 6%
- $1,000,001 - $3,000,000: 5%
- Over $3,000,000: 4%

3. PRODUCT LINE C - Accessories
Per-unit royalty:
- Small accessories (under $10 MSRP): $0.50 per unit
- Medium accessories ($10-$50 MSRP): $1.00 per unit
- Large accessories (over $50 MSRP): $2.00 per unit

4. COMBINED MINIMUM
Aggregate minimum annual royalty across all product lines: $200,000

5. PAYMENT TERMS
- Quarterly payments due within 30 days of quarter end
- Late payment interest: 1.5% per month
- Currency: USD
    `,
    groundTruth: [
      { fieldName: 'productLineA', expectedValue: { baseRate: 4, minimumQuarterly: 25000, volumeThreshold: 5000000, volumeRate: 3 }, fieldType: 'object', isRequired: true },
      { fieldName: 'productLineBTiers', expectedValue: [
        { minValue: 0, maxValue: 1000000, rate: 6 },
        { minValue: 1000001, maxValue: 3000000, rate: 5 },
        { minValue: 3000001, maxValue: null, rate: 4 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'productLineCPerUnit', expectedValue: [
        { category: 'small', maxMsrp: 10, perUnit: 0.50 },
        { category: 'medium', minMsrp: 10, maxMsrp: 50, perUnit: 1.00 },
        { category: 'large', minMsrp: 50, perUnit: 2.00 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'aggregateMinimumAnnual', expectedValue: 200000, fieldType: 'number', isRequired: true },
      { fieldName: 'latePaymentInterest', expectedValue: 1.5, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'International Multi-Territory License',
    contractType: 'royalty_license',
    description: 'Different rates by geographic region',
    contractText: `
INTERNATIONAL LICENSE AGREEMENT

EXHIBIT A: TERRITORY-SPECIFIC ROYALTIES

REGION 1 - North America (USA, Canada, Mexico)
Fee Rate: 5% of Net Sales
Minimum Annual: $100,000

REGION 2 - Europe (EU Countries, UK, Switzerland, Norway)
Fee Rate: 4% of Net Sales
Minimum Annual: EUR 75,000

REGION 3 - Asia Pacific (Japan, Australia, South Korea, Singapore)
Fee Rate: 4.5% of Net Sales
Minimum Annual: $60,000

REGION 4 - Rest of World
Fee Rate: 3% of Net Sales
No minimum fee

CURRENCY AND PAYMENT:
- All amounts to be paid in USD
- FX conversion at spot rate on payment due date
- Quarterly payments, 45 days after quarter end
    `,
    groundTruth: [
      { fieldName: 'territoryRates', expectedValue: [
        { region: 'North America', rate: 5, minimumAnnual: 100000, currency: 'USD' },
        { region: 'Europe', rate: 4, minimumAnnual: 75000, currency: 'EUR' },
        { region: 'Asia Pacific', rate: 4.5, minimumAnnual: 60000, currency: 'USD' },
        { region: 'Rest of World', rate: 3, minimumAnnual: null, currency: 'USD' }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'paymentCurrency', expectedValue: 'USD', fieldType: 'string', isRequired: true },
      { fieldName: 'paymentDays', expectedValue: 45, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Time-Based Declining Royalty',
    contractType: 'royalty_license',
    description: 'Royalty rate decreases over contract term',
    contractText: `
TECHNOLOGY LICENSE AGREEMENT

SECTION 7: ROYALTY SCHEDULE

7.1 Initial Term Royalties
The fee rate shall decrease over the term of this Agreement as follows:

Contract Year | Fee Rate
--------------|-------------
Year 1        | 8%
Year 2        | 7%
Year 3        | 6%
Year 4        | 5%
Year 5+       | 4%

7.2 Base for Calculation
Royalties are calculated on Net Sales, defined as gross sales less:
- Returns and allowances
- Freight and insurance
- Taxes (sales, VAT, customs)

7.3 Upfront Payment
Licensee shall pay a non-refundable upfront fee of $500,000 upon execution.

7.4 Milestone Payments
- First Commercial Sale: $100,000
- Annual Sales Exceed $10M: $250,000 (one-time)
- Annual Sales Exceed $25M: $500,000 (one-time)
    `,
    groundTruth: [
      { fieldName: 'yearlyRates', expectedValue: [
        { year: 1, rate: 8 },
        { year: 2, rate: 7 },
        { year: 3, rate: 6 },
        { year: 4, rate: 5 },
        { year: 5, rate: 4 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'upfrontFee', expectedValue: 500000, fieldType: 'number', isRequired: true },
      { fieldName: 'milestones', expectedValue: [
        { trigger: 'first_commercial_sale', amount: 100000 },
        { trigger: '10M_annual_sales', amount: 250000 },
        { trigger: '25M_annual_sales', amount: 500000 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'calculationBase', expectedValue: 'net sales', fieldType: 'string', isRequired: true }
    ]
  },

  // ===== EDGE CASES AND CHALLENGING CONTRACTS =====
  {
    name: 'Ambiguous Language Contract',
    contractType: 'royalty_license',
    description: 'Tests handling of unclear payment terms',
    contractText: `
PRODUCT DISTRIBUTION AGREEMENT

PAYMENT TERMS

The Distributor agrees to pay a reasonable fee based on the market conditions and 
product performance. Generally, similar arrangements in the industry range from 
five to eight percent of wholesale revenue.

Payments will be made periodically, typically on a quarterly basis, though more 
frequent arrangements may be considered upon request.

The parties agree to negotiate in good faith regarding any minimum guarantees 
that may be appropriate given the market conditions at the time.

Additional fees may apply for premium services, expedited shipping, or 
special handling requirements.
    `,
    groundTruth: [
      { fieldName: 'royaltyRangeMin', expectedValue: 5, fieldType: 'number', isRequired: false },
      { fieldName: 'royaltyRangeMax', expectedValue: 8, fieldType: 'number', isRequired: false },
      { fieldName: 'paymentFrequency', expectedValue: 'quarterly', fieldType: 'string', isRequired: false },
      { fieldName: 'hasAmbiguousTerms', expectedValue: true, fieldType: 'boolean', isRequired: true }
    ]
  },

  {
    name: 'Mixed Currency Contract',
    contractType: 'distributor_reseller',
    description: 'Multiple currencies with conversion rules',
    contractText: `
INTERNATIONAL DISTRIBUTION AGREEMENT

PRICING AND PAYMENT

1. Base Product Prices: Denominated in USD
2. European Shipments: Invoiced in EUR at ECB rate + 2% margin
3. UK Shipments: Invoiced in GBP at BoE rate + 2% margin
4. Japan Shipments: Invoiced in JPY at BoJ rate + 3% margin

COMMISSION CALCULATION:
- North America: 20% margin on USD list price
- Europe: 18% margin on EUR invoice amount
- UK: 18% margin on GBP invoice amount
- Japan: 15% margin on JPY invoice amount

PAYMENT TERMS:
- USD: Net 30
- EUR/GBP: Net 45
- JPY: Net 60

HEDGING: Distributor bears FX risk. Payments must be in invoiced currency.
    `,
    groundTruth: [
      { fieldName: 'currencies', expectedValue: ['USD', 'EUR', 'GBP', 'JPY'], fieldType: 'array', isRequired: true },
      { fieldName: 'margins', expectedValue: [
        { region: 'North America', currency: 'USD', margin: 20 },
        { region: 'Europe', currency: 'EUR', margin: 18 },
        { region: 'UK', currency: 'GBP', margin: 18 },
        { region: 'Japan', currency: 'JPY', margin: 15 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'fxMargins', expectedValue: [
        { currency: 'EUR', margin: 2 },
        { currency: 'GBP', margin: 2 },
        { currency: 'JPY', margin: 3 }
      ], fieldType: 'array', isRequired: true },
      { fieldName: 'paymentTerms', expectedValue: [
        { currency: 'USD', days: 30 },
        { currency: 'EUR', days: 45 },
        { currency: 'GBP', days: 45 },
        { currency: 'JPY', days: 60 }
      ], fieldType: 'array', isRequired: true }
    ]
  },

  {
    name: 'Conditional Royalty with Caps',
    contractType: 'royalty_license',
    description: 'Royalties with maximum caps and conditions',
    contractText: `
BRAND LICENSE AGREEMENT

ROYALTY PROVISIONS

1. BASE ROYALTY: 6% of Net Sales

2. ROYALTY CAPS:
   - Per Product Category: Maximum $500,000 annually
   - Per SKU: Maximum $50,000 annually
   - Aggregate Cap: $2,000,000 annually

3. CONDITIONAL ADJUSTMENTS:
   - If Net Sales exceed $20M: Rate reduces to 5%
   - If using Licensee's own manufacturing: Rate reduces by 1%
   - If exclusive retail partnership: Additional 0.5% applies

4. MARKETING ROYALTY:
   Separate 2% royalty on Net Sales allocated to joint marketing fund

5. FLOORS:
   - Quarterly minimum: $50,000
   - Annual minimum: $300,000 (supersedes quarterly if higher)
    `,
    groundTruth: [
      { fieldName: 'baseRoyaltyRate', expectedValue: 6, fieldType: 'number', isRequired: true },
      { fieldName: 'perCategoryCap', expectedValue: 500000, fieldType: 'number', isRequired: true },
      { fieldName: 'perSkuCap', expectedValue: 50000, fieldType: 'number', isRequired: true },
      { fieldName: 'aggregateCap', expectedValue: 2000000, fieldType: 'number', isRequired: true },
      { fieldName: 'salesThresholdForReduction', expectedValue: 20000000, fieldType: 'number', isRequired: true },
      { fieldName: 'reducedRate', expectedValue: 5, fieldType: 'number', isRequired: true },
      { fieldName: 'manufacturingReduction', expectedValue: 1, fieldType: 'number', isRequired: true },
      { fieldName: 'exclusiveRetailAddition', expectedValue: 0.5, fieldType: 'number', isRequired: true },
      { fieldName: 'marketingRoyalty', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'quarterlyMinimum', expectedValue: 50000, fieldType: 'number', isRequired: true },
      { fieldName: 'annualMinimum', expectedValue: 300000, fieldType: 'number', isRequired: true }
    ]
  },

  // ===== PDF-BASED TEST CONTRACTS =====
  
  {
    name: 'Manufacturing Technology License (VonMech)',
    contractType: 'royalty_license',
    description: 'Complex manufacturing royalty with tiered rates, performance components, and quality adjustments',
    source: 'pdf_upload' as const,
    contractText: `
MANUFACTURING TECHNOLOGY LICENSE AND ROYALTY AGREEMENT

Agreement Number: MTL-2024-VM-085
Effective Date: January 1, 2024
Agreement Term: Seven (7) Years

PARTIES
LICENSOR: Precision Manufacturing Technologies LLC
LICENSEE: VonMech Industries, Inc.

ARTICLE 3: FORMULA-BASED ROYALTY CALCULATIONS

3.1 PRIMARY ROYALTY FORMULA - STANDARD LICENSED PRODUCTS

3.1.1 Base Component Calculation
Base Component = ∑(NSP × Base Rate × Units Sold)

Where Base Rate varies by Production Tier:

Annual Production Volume    Base Rate
0 - 50,000 units           3.5%
50,001 - 150,000 units     3.0%
150,001 - 300,000 units    2.5%
300,001 - 500,000 units    2.25%
Over 500,000 units         2.0%

Tier Calculation Method: Marginal (each tier calculated separately)

3.1.2 Volume Component Calculation
Volume Component = Units Produced × Per-Unit Rate

Per-Unit Rate Schedule:
Quarterly Production Volume    Per-Unit Rate
0 - 15,000 units              $2.50
15,001 - 40,000 units         $2.25
40,001 - 80,000 units         $2.00
80,001 - 125,000 units        $1.75
Over 125,000 units            $1.50

3.1.3 Performance Component Calculation
Performance Component = (Cost Savings × Efficiency Rate) × Units Produced
Where Efficiency Rate = 25% (if Cost Savings achieved)

3.2 PREMIUM PRODUCT FORMULA
Premium Rate: 5.5%
Technology Fee: $8.00 per unit
Minimum Premium Royalty: $12.00 per unit sold

3.5 MINIMUM QUARTERLY ROYALTY OBLIGATIONS

Contract Year    Q1 Min      Q2 Min      Q3 Min      Q4 Min      Annual Total
Year 1 (2024)    $75,000     $75,000     $85,000     $100,000    $335,000
Year 2 (2025)    $100,000    $100,000    $115,000    $135,000    $450,000
Year 3 (2026)    $125,000    $125,000    $145,000    $170,000    $565,000

3.7 QUALITY PERFORMANCE ADJUSTMENT FORMULA
Defect Rate (per 10,000 units)    Quality Factor
0 - 10 defects                    +2.5% Royalty credit
11 - 25 defects                   0% No adjustment
26 - 50 defects                   +1.5% Royalty increase
51 - 100 defects                  +3.0% Royalty increase
Over 100 defects                  +5.0% Royalty increase
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 7, fieldType: 'number', isRequired: true },
      { fieldName: 'tier1Rate', expectedValue: 3.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier2Rate', expectedValue: 3.0, fieldType: 'number', isRequired: true },
      { fieldName: 'tier3Rate', expectedValue: 2.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier4Rate', expectedValue: 2.25, fieldType: 'number', isRequired: true },
      { fieldName: 'tier5Rate', expectedValue: 2.0, fieldType: 'number', isRequired: true },
      { fieldName: 'premiumRate', expectedValue: 5.5, fieldType: 'number', isRequired: true },
      { fieldName: 'technologyFee', expectedValue: 8.00, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumPremiumRoyalty', expectedValue: 12.00, fieldType: 'number', isRequired: true },
      { fieldName: 'efficiencyRate', expectedValue: 25, fieldType: 'number', isRequired: true },
      { fieldName: 'year1AnnualMinimum', expectedValue: 335000, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Distributor Agreement (ABC-XYZ)',
    contractType: 'distributor_reseller',
    description: 'Standard distributor with volume rebates, MDF, and price protection',
    source: 'pdf_upload' as const,
    contractText: `
SAMPLE DISTRIBUTOR AGREEMENT
Effective Date: January 1, 2025

PARTIES:
Manufacturer: ABC Manufacturing, Inc.
Distributor: XYZ Distribution LLC

1. APPOINTMENT & TERRITORY
Manufacturer appoints Distributor as a non-exclusive distributor.
Territory: United States – Northeast Region (MA, CT, RI, NH, VT, ME).

2. PRICING & DISCOUNTS
Products shall be sold at Manufacturer's published list price ("List Price").
Distributor shall receive a standard distributor discount of 20% off List Price.
Distributor shall not resell Products below 75% of List Price without written approval.

3. VOLUME REBATE PROGRAM
Annual rebates are based on net eligible sales:
$0 – $999,999: 0%
$1,000,000 – $2,499,999: 2%
$2,500,000 – $4,999,999: 4%
$5,000,000+: 6%

Rebates are accrued quarterly and paid annually within 60 days of year-end.

4. MARKET DEVELOPMENT FUNDS (MDF)
Manufacturer shall allocate MDF equal to 1.5% of annual net eligible sales.
MDF may be used only for approved marketing activities.
Claims must be submitted within 90 days with documentation.

5. PRICE PROTECTION & CHARGEBACKS
Distributor is eligible for price protection on inventory purchased within 60 days prior to a price reduction.
Chargeback equals (Old List Price – New List Price) × Eligible Units.

8. PAYMENT TERMS
Invoices are due Net 30.

9. TERM & TERMINATION
Initial term is three years with annual renewal.
    `,
    groundTruth: [
      { fieldName: 'distributorDiscount', expectedValue: 20, fieldType: 'number', isRequired: true },
      { fieldName: 'priceFloor', expectedValue: 75, fieldType: 'number', isRequired: true },
      { fieldName: 'rebateTier1Rate', expectedValue: 0, fieldType: 'number', isRequired: true },
      { fieldName: 'rebateTier2Rate', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'rebateTier3Rate', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'rebateTier4Rate', expectedValue: 6, fieldType: 'number', isRequired: true },
      { fieldName: 'mdfRate', expectedValue: 1.5, fieldType: 'number', isRequired: true },
      { fieldName: 'priceProtectionDays', expectedValue: 60, fieldType: 'number', isRequired: true },
      { fieldName: 'paymentTerms', expectedValue: 30, fieldType: 'number', isRequired: true },
      { fieldName: 'termYears', expectedValue: 3, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Revenue Sharing Analytics Partnership (Vontair-PartnerCo)',
    contractType: 'royalty_license',
    description: 'Revenue sharing model with contract fees, implementation, maintenance, and API usage tiers',
    source: 'pdf_upload' as const,
    contractText: `
REVENUE SHARING & ANALYTICS PARTNERSHIP AGREEMENT
Effective Date: January 1, 2025

PARTIES:
Vontair Mobility Systems, Inc.
PartnerCo Data Solutions LLC

2. TERM
Initial Term: Three (3) years
Renewal: Automatic for successive one (1) year periods

4. REVENUE SHARING MODEL

4.1 Contract Fees

Tier                    Annual Contract Fee (per customer)    Vontair Share    PartnerCo Share
Standard Analytics      USD $25,000                          60%              40%
Advanced Analytics      USD $40,000                          55%              45%
Enterprise Analytics    USD $65,000                          50%              50%

4.2 Implementation Services
PartnerCo receives thirty-five percent (35%) of recognized Implementation Services revenue.
Payments to PartnerCo are due within thirty (30) days.

4.3 Maintenance & Support
Annual Maintenance & Support is billed at eighteen percent (18%) of the net Contract Fee.
Revenue split: Vontair 70% / PartnerCo 30%.

4.4 API & Usage-Based Fees

Monthly API Volume           Unit Price (per API call)    Vontair Share    PartnerCo Share
0 – 1,000,000 calls         USD $0.002                    70%              30%
1,000,001 – 5,000,000       USD $0.001                    65%              35%
5,000,001+                  USD $0.0006                   60%              40%

5. MINIMUM ANNUAL GUARANTEE
PartnerCo shall receive not less than USD $250,000 per Contract Year as its total revenue share.
True-Up: Within forty-five (45) days after each Contract Year end.
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 3, fieldType: 'number', isRequired: true },
      { fieldName: 'standardLicenseFee', expectedValue: 25000, fieldType: 'number', isRequired: true },
      { fieldName: 'advancedLicenseFee', expectedValue: 40000, fieldType: 'number', isRequired: true },
      { fieldName: 'enterpriseLicenseFee', expectedValue: 65000, fieldType: 'number', isRequired: true },
      { fieldName: 'implementationShare', expectedValue: 35, fieldType: 'number', isRequired: true },
      { fieldName: 'maintenanceRate', expectedValue: 18, fieldType: 'number', isRequired: true },
      { fieldName: 'maintenancePartnerShare', expectedValue: 30, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumAnnualGuarantee', expectedValue: 250000, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Rebate & Incentives Agreement (Vontair-DistributorOne)',
    contractType: 'rebate_mdf',
    description: 'Volume-based rebate program with special launch incentives and growth accelerator',
    source: 'pdf_upload' as const,
    contractText: `
REBATE & INCENTIVES AGREEMENT
Effective Date: February 1, 2025

PARTIES:
Vontair Mobility Systems, Inc.
DistributorOne Fuel Services Inc.

2. REBATE TIERS

2.1 Quarterly Net Purchases (ex-tax, net of credits and returns):

Tier    Quarterly Net Purchases         Rebate % on All Eligible Products
1       USD $0 – $1,000,000            2%
2       USD $1,000,001 – $5,000,000    4%
3       USD $5,000,001+                6%

2.2 Rebate is calculated on total Net Purchases in the applicable Quarter (not marginal).

3. QUARTERLY TRUE-UP
Rebates will be paid as a credit memo or wire transfer within forty-five (45) days after the end of each quarter.

4. SPECIAL PROGRAMS

4.1 Launch Incentive
For the first two (2) quarters following Effective Date, Distributor will receive an additional 1% promotional rebate on Net Purchases of the Vontair Analytics Module.

4.2 Growth Accelerator
If Distributor's annual Net Purchases exceed USD $12,000,000, Vontair will apply an additional 2% year-end bonus rebate on all Net Purchases above USD $10,000,000.

7. TERM AND TERMINATION
Initial term: two (2) years
Auto-renewal for 1-year periods unless written non-renewal notice is given 60 days prior.
    `,
    groundTruth: [
      { fieldName: 'tier1Threshold', expectedValue: 1000000, fieldType: 'number', isRequired: true },
      { fieldName: 'tier1Rate', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'tier2Rate', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'tier3Rate', expectedValue: 6, fieldType: 'number', isRequired: true },
      { fieldName: 'launchIncentive', expectedValue: 1, fieldType: 'number', isRequired: true },
      { fieldName: 'growthAcceleratorThreshold', expectedValue: 12000000, fieldType: 'number', isRequired: true },
      { fieldName: 'growthAcceleratorBonus', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'growthAcceleratorFloor', expectedValue: 10000000, fieldType: 'number', isRequired: true },
      { fieldName: 'termYears', expectedValue: 2, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Channel Reseller Commission Agreement (Vontair-AlphaChannel)',
    contractType: 'referral',
    description: 'Multi-year declining commission structure for registered and influenced deals',
    source: 'pdf_upload' as const,
    contractText: `
CHANNEL RESELLER & COMMISSION AGREEMENT
Effective Date: March 15, 2025

PARTIES:
Vontair Mobility Systems, Inc.
AlphaChannel Solutions Ltd.

1. APPOINTMENT
Vontair appoints Partner as a non-exclusive channel partner.
Territory: North America

3. COMMISSION STRUCTURE

3.1 Registered Deals
For new subscription contracts sold to a partner-registered customer:
Year 1 Subscription Fees: 12% commission
Year 2 Subscription Fees: 8% commission
Year 3 Subscription Fees: 4% commission

3.2 Influenced Deals
If Vontair identifies the opportunity but Partner materially supports the sales cycle:
Year 1 Subscription Fees: 6% commission
Year 2 Subscription Fees: 4% commission

3.3 Renewals (non-registered)
For renewals where Partner is listed as Partner of Record but did not originate the initial sale:
All Renewal Years: 4% commission on Renewal Subscription Fees.

4. PERFORMANCE BONUS
If Partner's cumulative New Subscription ARR attributed to Registered Deals exceeds USD $500,000 in any calendar quarter:
Partner earns an additional 2% bonus commission on that quarter's New ARR.

7. TERM AND TERMINATION
Initial term: two (2) years, auto-renewal for 1-year periods.
    `,
    groundTruth: [
      { fieldName: 'registeredYear1Commission', expectedValue: 12, fieldType: 'number', isRequired: true },
      { fieldName: 'registeredYear2Commission', expectedValue: 8, fieldType: 'number', isRequired: true },
      { fieldName: 'registeredYear3Commission', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'influencedYear1Commission', expectedValue: 6, fieldType: 'number', isRequired: true },
      { fieldName: 'influencedYear2Commission', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'renewalCommission', expectedValue: 4, fieldType: 'number', isRequired: true },
      { fieldName: 'bonusThreshold', expectedValue: 500000, fieldType: 'number', isRequired: true },
      { fieldName: 'bonusRate', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'termYears', expectedValue: 2, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Pharmaceutical Patent License (BioPharma-GHM)',
    contractType: 'royalty_license',
    description: 'Drug fee agreement with tiered net sales rates and development stage adjustments',
    source: 'pdf_upload' as const,
    contractText: `
PHARMACEUTICAL PATENT LICENSE & DRUG ROYALTY AGREEMENT
License Agreement No: PHARM-2024-DRG-7394
Effective Date: April 15, 2024

PARTIES:
LICENSOR: BioPharma Research Institute LLC
LICENSEE: Global Healthcare Manufacturing Corp.

2.3 License Term and Renewal:
Initial Term: Fifteen (15) years from April 15, 2024
Extension Options: Two successive five (5) year renewal periods

3. ROYALTY STRUCTURE AND PRICING TERMS

3.1 Net Sales-Based Fee Structure:

Tier 1 - Approved Prescription Drugs (CardioCure-XR, DiabetesShield-24):

Annual Net Sales Range      Fee Rate    Minimum Annual Payment    Launch Year Adjustment
$0 - $50 million           8.5%            $2,500,000                -2% first 18 months
$50M - $200 million        12.5%           $5,000,000                Standard rate
$200M - $500 million       15.0%           $12,500,000               Standard rate
Above $500 million         18.5%           $25,000,000               +1% blockbuster bonus

Tier 2 - Phase III and Late-Stage Pipeline (NeuroRestore-Plus):

Development Stage              Base Fee Rate    Risk Adjustment       Effective Rate
Phase III Clinical Trials      15.0%                -5% risk discount     10.0%
FDA Review (Post-NDA)          15.0%                -2.5% risk discount   12.5%
FDA Approval + Launch          15.0%                Standard rate         15.0%
Post-Marketing Surveillance    15.0%                +2% success bonus     17.0%
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 15, fieldType: 'number', isRequired: true },
      { fieldName: 'tier1BaseRate', expectedValue: 8.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier2Rate', expectedValue: 12.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier3Rate', expectedValue: 15.0, fieldType: 'number', isRequired: true },
      { fieldName: 'tier4Rate', expectedValue: 18.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier1Minimum', expectedValue: 2500000, fieldType: 'number', isRequired: true },
      { fieldName: 'launchDiscountRate', expectedValue: 2, fieldType: 'number', isRequired: true },
      { fieldName: 'blockbusterBonus', expectedValue: 1, fieldType: 'number', isRequired: true },
      { fieldName: 'phaseIIIEffectiveRate', expectedValue: 10.0, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Electronics Patent License (Advanced Chip-Nexus)',
    contractType: 'royalty_license',
    description: 'Component-based royalty with per-unit rates and application sector premiums',
    source: 'pdf_upload' as const,
    contractText: `
ELECTRONICS PATENT LICENSE & ROYALTY AGREEMENT
License Agreement No: ELC-2024-SEMI-3947
Effective Date: March 22, 2024

PARTIES:
LICENSOR: Advanced Chip Technologies Corp.
LICENSEE: Nexus Electronics Manufacturing Inc.

2.4 License Term: Initial term of seven (7) years with automatic renewal for successive three (3) year periods.

3. ROYALTY STRUCTURE AND PAYMENT TERMS

3.1 Component-Based Fee Structure:

Tier 1 - Smartphone and Mobile Device Components:

Component Type              Royalty per Unit    Volume Threshold      Discount Rate
ARM-Compatible Processors   $3.25               1M+ units/year        $2.85
Power Management ICs        $1.75               2M+ units/year        $1.45
Memory Controllers          $2.15               1.5M+ units/year      $1.85
Wireless Chipsets           $4.50               500K+ units/year      $3.95
AI Acceleration Units       $6.75               250K+ units/year      $5.95

Tier 2 - Consumer Electronics and Computing:

Product Category              Fee Rate (% of ASP)    Minimum per Unit    Maximum per Unit
Tablets and E-Readers         2.5%                       $3.50               $15.00
Laptops and Ultrabooks        1.8%                       $8.00               $35.00
Smart Home Devices            3.2%                       $1.25               $8.50
Wearable Electronics          4.1%                       $2.75               $12.00

Tier 3 - Specialized Applications (Premium Markets):

Application Sector           Base Fee Rate    Premium Multiplier    Effective Rate
Automotive Electronics       2.5%                 1.15x                 2.875%
Medical Device Electronics   2.5%                 1.25x                 3.125%
Industrial Automation        2.5%                 1.10x                 2.75%
Server and Data Center       1.5%                 1.30x                 1.95%

3.3 Minimum Annual Guarantees:

Contract Year    Minimum Annual Fee    Quarterly Payment
Year 1-2         $2,500,000                $625,000
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 7, fieldType: 'number', isRequired: true },
      { fieldName: 'processorRoyalty', expectedValue: 3.25, fieldType: 'number', isRequired: true },
      { fieldName: 'pmicRoyalty', expectedValue: 1.75, fieldType: 'number', isRequired: true },
      { fieldName: 'wirelessRoyalty', expectedValue: 4.50, fieldType: 'number', isRequired: true },
      { fieldName: 'aiUnitRoyalty', expectedValue: 6.75, fieldType: 'number', isRequired: true },
      { fieldName: 'tabletRate', expectedValue: 2.5, fieldType: 'number', isRequired: true },
      { fieldName: 'automotivePremium', expectedValue: 1.15, fieldType: 'number', isRequired: true },
      { fieldName: 'medicalPremium', expectedValue: 1.25, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumAnnualFee', expectedValue: 2500000, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Plant Variety License (Green Innovation-Heritage Gardens)',
    contractType: 'royalty_license',
    description: 'Plant nursery per-container royalty with seasonal adjustments and volume discounts',
    source: 'pdf_upload' as const,
    contractText: `
PLANT VARIETY LICENSE & ROYALTY AGREEMENT
License Agreement No: PVP-2024-NUR-1205
Effective Date: February 12, 2024

PARTIES:
LICENSOR: Green Innovation Genetics LLC
LICENSEE: Heritage Gardens Nursery & Landscaping

2.3 License Term: Initial term of eight (8) years with automatic renewal for successive four (4) year periods.

3. ROYALTY STRUCTURE AND PAYMENT TERMS

3.1 Plant Fee Rates:

Tier 1 - Ornamental Trees & Shrubs (Aurora Flame Maple, Golden Spire Juniper):

Plant Size Category      Royalty per Unit    Volume Discount Threshold    Discounted Rate
1-gallon containers      $1.25               5,000+ units annually        $1.10
3-gallon containers      $2.85               2,000+ units annually        $2.50
5-gallon containers      $4.50               1,000+ units annually        $3.95
15-gallon+ specimens     $12.75              200+ units annually          $11.25

Tier 2 - Perennials & Roses (Pacific Sunset Rose, Emerald Crown Hosta):

Container Size       Base Fee Rate    Premium Variety Multiplier    Seasonal Adjustment
4-inch pots          $0.75                1.0x (standard)               +15% spring season
6-inch pots          $1.15                1.2x (premium roses)          +10% spring season
1-gallon containers  $1.85                1.3x (specimen grade)         Standard rate
2-gallon+ containers $3.25                1.5x (mature plants)          -5% fall clearance

Tier 3 - Flowering Shrubs (Cascade Blue Hydrangea):

Sales Volume (Annual)    Fee Rate      Minimum Annual Payment
1 - 2,500 units          $2.25 per unit    $8,500
2,501 - 7,500 units      $1.95 per unit    $12,000
7,501 - 15,000 units     $1.70 per unit    $18,500
15,001+ units            $1.45 per unit    $25,000

3.2 Seasonal Royalty Adjustments:
Spring Season (March-May): +10-15% premium for peak demand varieties
Fall Season (September-November): -5% discount for clearance sales
Holiday Seasons: +20% premium for gift-appropriate varieties during December

3.3 Minimum Annual Guarantees: $85,000 regardless of actual sales volume, payable in quarterly installments of $21,250.

4. CONTRACT FEES AND STARTUP COSTS

4.1 Initial Contract Fee: $125,000 within 30 days of Agreement execution.
4.2 Total Mother Stock Investment: $38,875
4.3 Technology Transfer and Training: $35,000
4.4 Annual Certification Fee: $12,500
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 8, fieldType: 'number', isRequired: true },
      { fieldName: 'oneGallonRoyalty', expectedValue: 1.25, fieldType: 'number', isRequired: true },
      { fieldName: 'threeGallonRoyalty', expectedValue: 2.85, fieldType: 'number', isRequired: true },
      { fieldName: 'fiveGallonRoyalty', expectedValue: 4.50, fieldType: 'number', isRequired: true },
      { fieldName: 'fifteenGallonRoyalty', expectedValue: 12.75, fieldType: 'number', isRequired: true },
      { fieldName: 'springSeasonPremium', expectedValue: 15, fieldType: 'number', isRequired: true },
      { fieldName: 'holidayPremium', expectedValue: 20, fieldType: 'number', isRequired: true },
      { fieldName: 'fallDiscount', expectedValue: 5, fieldType: 'number', isRequired: true },
      { fieldName: 'minimumAnnualGuarantee', expectedValue: 85000, fieldType: 'number', isRequired: true },
      { fieldName: 'initialLicenseFee', expectedValue: 125000, fieldType: 'number', isRequired: true },
      { fieldName: 'annualCertificationFee', expectedValue: 12500, fieldType: 'number', isRequired: true }
    ]
  },

  {
    name: 'Technology Manufacturing License (Advanced Materials-Precision Industrial)',
    contractType: 'royalty_license',
    description: 'Manufacturing technology license with tiered royalties, milestone payments, and production commitments',
    source: 'pdf_upload' as const,
    contractText: `
TECHNOLOGY LICENSE AND ROYALTY AGREEMENT
Agreement No: TLA-2024-MFG-0847
Effective Date: January 8, 2024

PARTIES:
LICENSOR: Advanced Materials Technology Corp.
LICENSEE: Precision Industrial Solutions Inc.

2.4 Term: This Agreement shall commence on January 8, 2024, and continue for an initial term of ten (10) years, with automatic renewal for successive five (5) year periods.

3. ROYALTY STRUCTURE AND PAYMENT TERMS

3.1 Fee Rate Structure:

Tier 1 - Automotive Components:

Annual Net Sales Volume        Fee Rate    Minimum Annual Fee
$0 - $5,000,000               6.5%            $125,000
$5,000,001 - $15,000,000      5.8%            $200,000
$15,000,001 - $50,000,000     5.2%            $350,000
Above $50,000,000             4.8%            $500,000

Tier 2 - Industrial & Aerospace Components:

Annual Net Sales Volume              Fee Rate    Premium Multiplier
All Industrial Applications          7.2%            Standard Rate
Aerospace/High-Performance           8.5%            1.18x Base Rate
Custom Engineering Projects          9.8%            Plus $15K engineering fee

3.2 Net Sales Definition: "Net Sales" means gross invoice price less:
(d) trade discounts not exceeding 8%
(e) distributor commissions not exceeding 12%

4. UPFRONT FEES AND MILESTONE PAYMENTS

4.1 Contract Fee: $850,000 within 30 days of Agreement execution
4.2 Technology Transfer Fee: $275,000

4.3 Milestone Payments:

Milestone Event                    Payment Amount    Due Date
First Commercial Production        $150,000          Within 30 days of achievement
$10M Cumulative Net Sales          $200,000          Within 60 days of achievement
$50M Cumulative Net Sales          $350,000          Within 60 days of achievement
Market Leadership Achievement*     $500,000          Annual review basis

*Market Leadership defined as >25% market share

5.2 Production Volume Commitments:
Year 1-2: Minimum 50,000 units annually
Year 3-5: Minimum 125,000 units annually with 15% year-over-year growth
Year 6+: Minimum 200,000 units annually

5.3 Capital Investment Requirements: Minimum $2.5 million in specialized manufacturing equipment within 18 months.
    `,
    groundTruth: [
      { fieldName: 'termYears', expectedValue: 10, fieldType: 'number', isRequired: true },
      { fieldName: 'tier1Rate', expectedValue: 6.5, fieldType: 'number', isRequired: true },
      { fieldName: 'tier2Rate', expectedValue: 5.8, fieldType: 'number', isRequired: true },
      { fieldName: 'tier3Rate', expectedValue: 5.2, fieldType: 'number', isRequired: true },
      { fieldName: 'tier4Rate', expectedValue: 4.8, fieldType: 'number', isRequired: true },
      { fieldName: 'industrialRate', expectedValue: 7.2, fieldType: 'number', isRequired: true },
      { fieldName: 'aerospaceRate', expectedValue: 8.5, fieldType: 'number', isRequired: true },
      { fieldName: 'customEngineeringRate', expectedValue: 9.8, fieldType: 'number', isRequired: true },
      { fieldName: 'licenseFee', expectedValue: 850000, fieldType: 'number', isRequired: true },
      { fieldName: 'technologyTransferFee', expectedValue: 275000, fieldType: 'number', isRequired: true },
      { fieldName: 'firstProductionMilestone', expectedValue: 150000, fieldType: 'number', isRequired: true },
      { fieldName: 'capitalInvestmentRequirement', expectedValue: 2500000, fieldType: 'number', isRequired: true }
    ]
  }
];

export default CONTRACT_TEST_SUITE;
