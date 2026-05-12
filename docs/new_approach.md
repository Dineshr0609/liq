# LicenseIQ: Universal Contract-to-Cash Architecture

## Executive Summary

This document outlines the industry-standard approach for building a contract-agnostic payment calculation system. The architecture enables LicenseIQ to process ANY contract type or format globally, without requiring code changes for new contract formats.

---

## Core Design Principles

1. **Contract Agnostic**: Works with any contract type (rebates, royalties, milestones, etc.)
2. **Format Independent**: Handles any document structure or terminology
3. **Traceable**: Every extracted rule is tied to exact source text
4. **Auditable**: Complete trail from contract → rule → calculation
5. **Scalable**: New contract types require configuration, not code

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LICENSEIQ ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   INGEST    │ → │   EXTRACT   │ → │   VALIDATE  │ → │  CALCULATE  │  │
│  │             │    │             │    │             │    │             │  │
│  │  Any PDF    │    │  AI + RAG   │    │  3-Layer    │    │  Universal  │  │
│  │  Any Format │    │  Grounded   │    │  Verify     │    │  Evaluator  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: AI Contract Type Detection

### Purpose
Automatically identify the contract type to apply the correct extraction prompts.

### The 3 Approaches

| Approach | Description | Accuracy | User Effort |
|----------|-------------|----------|-------------|
| Manual Selection | User selects type from dropdown | 100% | High |
| AI Auto-Detect | AI classifies, no user input | 85-95% | None |
| **AI Suggest + Confirm** | AI suggests, user confirms | 99%+ | Low |

### Recommended: AI Suggest + User Confirm

```
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Upload                                                        │
│  User uploads contract PDF                                             │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AI Classification                                             │
│  AI reads first few pages → Suggests contract type with confidence     │
│  "This appears to be a Distributor Rebate Agreement (89%)"             │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 3: User Confirmation                                             │
│  [✓ Distributor/Reseller]  [Change Type ▼]  [Continue]                 │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Extraction                                                    │
│  System uses confirmed contract type prompts for AI extraction         │
└────────────────────────────────────────────────────────────────────────┘
```

### AI Classification Prompt

```
"Analyze this contract and classify it into ONE of these types:

1. Direct Sales - Per-unit royalties, container sizes, volume-based pricing
2. Distributor/Reseller - Rebates, volume tiers, quarterly periods, product categories
3. Royalty/License - Percentage of revenue, territory premiums, minimum guarantees
4. Milestone - Target-based payments, achievement triggers, one-time payments
5. Rebate/MDF - Marketing funds, promotional payments, co-op advertising
6. Usage-Based - Consumption metrics, rate cards, overage charges
7. Chargebacks/Claims - Deductions, adjustments, claim processing
8. Marketplace/Platforms - Revenue sharing, transaction fees, platform percentages

Respond with JSON:
{
  "contractType": "the type name",
  "confidence": 0-100,
  "reasoning": "key terms or sections that indicate this type",
  "keyTermsFound": ["rebate", "quarterly", "tier"]
}
"
```

### Benefits

1. **Speed**: AI does initial classification in seconds
2. **Accuracy**: User confirmation catches AI mistakes
3. **Learning**: User corrections can improve AI over time
4. **Edge Cases**: Mixed contracts can be properly categorized

---

## Phase 1: Contract Ingestion

### Purpose
Accept any contract document and prepare it for AI analysis.

### Process Flow

```
PDF/Document Upload
        ↓
┌───────────────────────────────────────┐
│  DOCUMENT PROCESSOR                   │
├───────────────────────────────────────┤
│  1. Extract text from PDF             │
│  2. Identify document structure       │
│  3. Detect tables (pricing, tiers)    │
│  4. Chunk into logical sections       │
│  5. Generate embeddings per chunk     │
│  6. Store in vector database (RAG)    │
└───────────────────────────────────────┘
        ↓
Document ready for AI extraction
```

### Key Features
- **Per-Table Detection**: Identifies and processes each pricing table separately
- **Section Awareness**: Maintains document structure (sections, headers, pages)
- **Chunk Overlap**: Ensures context isn't lost at chunk boundaries

---

## Phase 2: AI Extraction (RAG-Grounded)

> **STATUS: ✅ IMPLEMENTED** (January 2026)
> - `server/services/ragExtractionService.ts` - Chunking, embedding storage, retrieval
> - `server/services/groqService.ts` - `extractRulesWithRAG()` method

### Purpose
Extract payment rules from contracts using AI, grounded in actual document text.

### What Does This Mean in Plain English?

Imagine you have a 50-page contract and need to find all the payment rules. Without RAG:
- **Old Way**: Send the entire 50 pages to AI → AI gets overwhelmed → May mix up information from different sections
- **New Way (RAG)**: Find ONLY the pages about payments → Send just those pages to AI → AI focuses on relevant content

**Think of it like a librarian**: Instead of reading an entire book to answer your question, the librarian finds just the relevant chapters and reads those.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAG-GROUNDED EXTRACTION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: RETRIEVAL                                                  │   │
│  │  Query: "Find sections about payments, rebates, royalties, tiers"   │   │
│  │  Result: Relevant chunks with page numbers and section references   │   │
│  │                                                                     │   │
│  │  📁 Implementation: ragExtractionService.retrievePaymentChunks()    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               ↓                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: CONTRACT TYPE PROMPT                                       │   │
│  │  Select appropriate prompt based on contract type:                  │   │
│  │  • Rebate contracts → Look for tiers, periods, product categories   │   │
│  │  • License contracts → Look for per-unit rates, territory premiums  │   │
│  │  • Milestone contracts → Look for targets, payment triggers         │   │
│  │                                                                     │   │
│  │  📁 Implementation: groqService.getContractTypePrompts()            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               ↓                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: AI EXTRACTION                                              │   │
│  │  AI receives: Relevant chunks + Contract-type prompt                │   │
│  │  AI outputs: FormulaDefinition + Mandatory citation                 │   │
│  │                                                                     │   │
│  │  📁 Implementation: groqService.extractRulesFromRAGContext()        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How It Works (Step by Step for Non-Technical Users)

1. **Contract Upload**: You upload a PDF contract
2. **Chunking**: System breaks the contract into ~1500-character pieces (like paragraphs)
3. **Keyword Scan**: Each piece is checked for payment-related words (royalty, fee, tier, percentage, etc.)
4. **Storage**: Pieces are saved with embeddings (mathematical representations) for searching
5. **Retrieval**: When extracting rules, only payment-related pieces are found
6. **Focused Extraction**: AI reads ONLY those pieces, not the entire contract
7. **Source Citation**: Every extracted rule includes the exact chunk it came from

**Key Benefit**: If AI extracts "5% royalty on net sales", we can trace it back to the exact paragraph on page 7 where that appears.

### Why RAG Grounding?
- AI only sees relevant sections, not entire document
- Prevents cross-section contamination (mixing Tier 1 with Tier 2)
- Every extraction is traceable to specific text chunks
- Reduces hallucination risk

### Payment Keywords (Used for Chunk Classification)

The system looks for these words to identify payment-related sections:
```
royalty, royalties, payment, fee, fees, rate, rates, percentage, percent, %,
tier, tiers, tiered, volume, threshold, minimum, maximum, cap, rebate, rebates,
discount, discounts, commission, commissions, margin, margins, price, pricing,
unit, per unit, container, gallon, pot, size, annual, quarterly, monthly, period,
gross, net, revenue, sales, license fee, milestone, target, bonus
```

### Contract Type Prompts
Configurable prompts per contract type that guide AI extraction:

| Contract Type | Prompt Focus Areas |
|---------------|-------------------|
| Direct Sales | Base rates, volume tiers, territory adjustments |
| Distributor/Reseller | Rebate tiers, quarterly periods, product categories |
| Royalty/License | Per-unit rates, container sizes, seasonal multipliers |
| Milestone | Revenue targets, payment amounts, achievement dates |
| Rebate/MDF | Percentage tiers, qualifying criteria, payment periods |
| Usage-Based | Usage metrics, rate cards, overage charges |

**Adding new contract types requires only prompt configuration, not code changes.**

### Code Example: Using RAG Extraction

```typescript
// In your contract analysis code:
import { groqService } from './services/groqService';

// Use RAG-grounded extraction
const result = await groqService.extractRulesWithRAG(
  contractId,      // Contract ID for chunk lookup
  contractText,    // Full contract text
  'royalty_license' // Contract type code
);

// Result includes:
// - rules: Extracted payment rules with source citations
// - extractionMetadata: Stats about chunks used
```

---

## Phase 3: Validation (3-Layer Verification)

### Purpose
Ensure extracted rules are accurate and grounded in actual contract text.

### The 3 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: GROUNDED EXTRACTION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  AI can ONLY use text from retrieved chunks                                 │
│  → Prevents hallucination of terms not in document                          │
│  → Each rule tied to specific chunk ID                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    +
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: MANDATORY CITATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Every extracted rule MUST include:                                         │
│  • sourceText: Exact quote from document                                    │
│  • sourceSection: Section reference (e.g., "Section 4.2")                   │
│  • sourcePage: Page number                                                  │
│  • chunkId: Reference to RAG chunk                                          │
│                                                                             │
│  → Rules without citations are rejected                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    +
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: AUTOMATED VALIDATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  System verifies extracted values exist in cited text:                      │
│                                                                             │
│  Example:                                                                   │
│  • AI extracts: rate = 5%, threshold = $100,000                             │
│  • Source text: "5% rebate on purchases exceeding $100,000"                 │
│  • Validation: ✓ "5%" found, ✓ "$100,000" found → VALID                     │
│                                                                             │
│  If validation fails:                                                       │
│  • Confidence score reduced                                                 │
│  • Rule flagged for human review                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Confidence Score Calculation

```
Final Confidence = Raw AI Confidence × Validation Multiplier

Validation Multiplier:
• All values found in source text    → 1.0x (full confidence)
• Some values not found              → 0.7x (reduced confidence)  
• Key values missing                 → 0.4x (requires review)
```

### Validated Rule Structure

```typescript
interface ValidatedRule {
  // The extracted rule
  ruleName: string;
  ruleType: string;
  formula: FormulaDefinition;
  
  // LAYER 2: Mandatory citation
  citation: {
    sourceText: string;      // "5% rebate on purchases exceeding $100,000"
    sourceSection: string;   // "Section 4.2 - Payment Terms"
    sourcePage: number;      // 3
    chunkId: string;         // "chunk_abc123"
  };
  
  // LAYER 3: Validation results
  validation: {
    valuesFound: string[];   // ["5%", "$100,000"]
    valuesMissing: string[]; // []
    isValid: boolean;        // true
  };
  
  // Confidence scores
  rawConfidence: number;      // 92 (AI's initial score)
  adjustedConfidence: number; // 92 (after validation)
  
  // Review status
  status: 'pending_review' | 'auto_confirmed' | 'confirmed' | 'rejected';
}
```

---

## Phase 4: Human-in-the-Loop Review

### Purpose
Allow human verification of low-confidence extractions while auto-confirming high-confidence rules.

### Confidence-Based Routing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONFIDENCE-BASED REVIEW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HIGH CONFIDENCE (≥85%)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Rule: "5% rebate on Q1 sales over $100K"                           │   │
│  │  Confidence: 92%                                                    │   │
│  │  Status: ✅ AUTO-CONFIRMED                                          │   │
│  │                                                                     │   │
│  │  → Proceeds directly to calculation                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LOW CONFIDENCE (<85%)                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Rule: "Payment terms unclear - possibly 3% or 5%?"                 │   │
│  │  Confidence: 68%                                                    │   │
│  │  Status: ⚠️ PENDING REVIEW                                          │   │
│  │                                                                     │   │
│  │  [View Source] [Edit] [Confirm] [Reject]                            │   │
│  │                                                                     │   │
│  │  Human reviews source text → Edits if needed → Confirms             │   │
│  │  Status: ✅ CONFIRMED (by John Smith, 2024-01-15)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rule Status Lifecycle

| Status | Meaning | Set By |
|--------|---------|--------|
| `pending_review` | Needs human verification | System (low confidence) |
| `auto_confirmed` | High confidence, no review needed | System (≥85% confidence) |
| `confirmed` | Human reviewed and approved | Human user |
| `rejected` | Human rejected as incorrect | Human user |

### Configurable Threshold
System Settings allow admins to adjust the auto-confirmation threshold:
- **Higher (90%)**: More human review, maximum accuracy
- **Lower (75%)**: Less human review, faster processing

---

## Phase 5: Universal Formula Evaluator

### Purpose
Execute ANY payment calculation using a single, universal formula engine.

### The Universal Formula Language

All payment logic is expressed using `FormulaDefinition` - a JSON-based expression tree that can represent any calculation:

```typescript
// Formula Node Types
type AnyFormulaNode = 
  | LiteralNode      // Fixed values: $1.25, 100
  | ReferenceNode    // Sales data fields: units, territory, date
  | TierNode         // Volume tier lookups
  | MultiplyNode     // Multiplication: a × b × c
  | AddNode          // Addition: a + b + c
  | SubtractNode     // Subtraction: a - b
  | MaxNode          // Maximum: max(a, b)
  | MinNode          // Minimum: min(a, b)
  | IfNode           // Conditional: if condition then X else Y
  | LookupNode       // Table lookup: territory → premium
  | PremiumNode      // Percentage adjustment: base × (1 + %)
  | RoundNode;       // Rounding: round(value, precision)
```

### Formula Examples

**Example 1: Simple Per-Unit Royalty**
```
Contract says: "$1.25 per unit sold"

Formula:
{
  type: "multiply",
  operands: [
    { type: "reference", field: "units" },
    { type: "literal", value: 1.25, unit: "dollars" }
  ]
}

Calculation: 1000 units × $1.25 = $1,250
```

**Example 2: Tiered Rebate**
```
Contract says: "5% on purchases $0-$50K, 7% on $50K-$100K, 10% on $100K+"

Formula:
{
  type: "multiply",
  operands: [
    { type: "reference", field: "netPurchases" },
    {
      type: "tier",
      reference: { type: "reference", field: "quarterlyTotal" },
      tiers: [
        { min: 0, max: 50000, rate: 0.05 },
        { min: 50001, max: 100000, rate: 0.07 },
        { min: 100001, max: null, rate: 0.10 }
      ]
    }
  ]
}
```

**Example 3: Percentage with Minimum Guarantee**
```
Contract says: "10% of sales, minimum $25,000 annually"

Formula:
{
  type: "max",
  operands: [
    {
      type: "multiply",
      operands: [
        { type: "reference", field: "annualSales" },
        { type: "literal", value: 0.10 }
      ]
    },
    { type: "literal", value: 25000, unit: "dollars" }
  ]
}
```

**Example 4: Territory Premium**
```
Contract says: "Base rate $2.00, +15% for international territories"

Formula:
{
  type: "multiply",
  operands: [
    { type: "reference", field: "units" },
    {
      type: "premium",
      mode: "additive",
      percentage: {
        type: "lookup",
        reference: { type: "reference", field: "territory" },
        table: {
          "Domestic": 0,
          "International": 0.15
        },
        default: 0
      },
      base: { type: "literal", value: 2.00 }
    }
  ]
}
```

### The Universal Evaluator

A single function that can execute any formula:

```typescript
function evaluateFormula(
  formula: AnyFormulaNode, 
  context: SaleContext
): number {
  
  switch (formula.type) {
    case 'literal':
      return formula.value;
      
    case 'reference':
      return context[formula.field];
      
    case 'multiply':
      return formula.operands.reduce(
        (acc, op) => acc * evaluateFormula(op, context), 1
      );
      
    case 'add':
      return formula.operands.reduce(
        (acc, op) => acc + evaluateFormula(op, context), 0
      );
      
    case 'tier':
      const refValue = evaluateFormula(formula.reference, context);
      const tier = findMatchingTier(formula.tiers, refValue);
      return tier.rate;
      
    case 'if':
      const conditionMet = evaluateCondition(formula.condition, context);
      return conditionMet 
        ? evaluateFormula(formula.then, context)
        : evaluateFormula(formula.else, context);
      
    case 'lookup':
      const key = evaluateFormula(formula.reference, context);
      return formula.table[key] ?? formula.default;
      
    case 'max':
      return Math.max(...formula.operands.map(op => evaluateFormula(op, context)));
      
    case 'min':
      return Math.min(...formula.operands.map(op => evaluateFormula(op, context)));
      
    case 'premium':
      const base = evaluateFormula(formula.base, context);
      if (formula.mode === 'additive') {
        return base * (1 + formula.percentage);
      }
      return base * formula.percentage;
      
    case 'round':
      const value = evaluateFormula(formula.value, context);
      const factor = Math.pow(10, formula.precision);
      return Math.round(value * factor) / factor;
  }
}
```

### Why This Works for ANY Contract

| Contract Type | Payment Terms | Formula Handles It? |
|---------------|---------------|---------------------|
| Software License | $1.25 per unit | ✅ MultiplyNode |
| Tiered Rebate | 5%/7%/10% by volume | ✅ TierNode |
| Milestone | $50K when target hit | ✅ IfNode |
| Minimum Guarantee | 10% or $25K minimum | ✅ MaxNode |
| Territory Premium | Base + 15% international | ✅ LookupNode + PremiumNode |
| Seasonal Adjustment | 1.2x in Q4 | ✅ LookupNode |
| Complex Compound | All of the above combined | ✅ Nested nodes |

**If you can describe it in words, it can be a formula.**

---

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CONTRACT UPLOAD                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  User uploads PDF → System chunks → Stores in vector DB                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AI EXTRACTION                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Retrieve relevant chunks → Apply contract-type prompt → AI extracts        │
│  Output: FormulaDefinition + Citation + Confidence                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: VALIDATION                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Check extracted values against source text                                 │
│  Adjust confidence score based on validation results                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: HUMAN REVIEW (if needed)                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│  High confidence (≥85%) → Auto-confirmed                                    │
│  Low confidence (<85%) → User reviews → Confirms/Edits/Rejects              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: SALES DATA UPLOAD                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  User uploads sales CSV → System normalizes and stores                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: CALCULATION                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Confirmed Rules + Sales Data → Universal Evaluator                         │
│  Output: Payment amounts + Detailed audit breakdown                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: REPORTING                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Multi-dimensional views: Summary, Detail, Vendor, Item, Territory, Period  │
│  PDF invoice generation with full audit trail                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Adding New Contract Types

### Process (No Code Required)

1. **Define Contract Type** in System Settings
   - Name: "Revenue Sharing Agreement"
   - Description: "Percentage of revenue with caps and floors"

2. **Configure Extraction Prompt**
   - What to look for: revenue percentages, caps, floors, payment periods
   - Expected structure: ranges, conditions, territories

3. **Done!**
   - AI uses new prompt to extract rules
   - Rules are stored as FormulaDefinitions
   - Universal Evaluator handles calculations

### Example: Adding "Revenue Share" Contract Type

```
Prompt Configuration:
─────────────────────
"Extract revenue sharing terms including:
- Revenue percentage rates
- Any caps (maximum payments)
- Any floors (minimum payments)
- Payment frequency (monthly, quarterly, annual)
- Territory or product restrictions

Express as FormulaDefinition with:
- Use 'multiply' for percentage of revenue
- Use 'max' for minimum floors
- Use 'min' for maximum caps
- Use 'if' for conditional terms"
```

---

## System Configuration

### System Settings (Super Admin)

| Setting | Description | Default |
|---------|-------------|---------|
| AI Model | Groq/LLaMA model selection | llama-3.3-70b-versatile |
| Temperature | AI creativity level | 0.1 (low for accuracy) |
| Auto-Confirm Threshold | Confidence level for auto-confirmation | 85% |
| Max Retries | API retry attempts | 3 |

### Contract Type Settings (Per Type)

| Setting | Description |
|---------|-------------|
| Extraction Prompt | What to look for in this contract type |
| Rule Extraction Prompt | How to identify payment rules |
| ERP Mapping Prompt | How to map to ERP fields |
| Sample Output | Example of expected extraction |

---

## Benefits of This Architecture

### For Business Users
- Upload ANY contract format
- See exactly where each rule came from
- Review only uncertain extractions
- Trust calculations are accurate

### For Technical Team
- No code changes for new contract types
- Single calculation engine to maintain
- Clear separation of concerns
- Easy to test and debug

### For Compliance/Audit
- Every rule traced to source text
- Validation results recorded
- Human review tracked with timestamps
- Complete calculation audit trail

---

## Industry Alignment

This architecture follows patterns used by leading contract management systems:

| System | Approach |
|--------|----------|
| **Kira Systems** | ML extraction with citation |
| **Ironclad** | Contract AI with validation |
| **DocuSign Insight** | Clause extraction with grounding |
| **Evisort** | AI extraction with human review |
| **LicenseIQ** | All of the above + Universal Formula Engine |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LICENSEIQ: UNIVERSAL CONTRACT-TO-CASH                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANY Contract Format                                                        │
│       ↓                                                                     │
│  RAG-Grounded AI Extraction (with contract-type prompts)                    │
│       ↓                                                                     │
│  3-Layer Validation (grounding + citation + value check)                    │
│       ↓                                                                     │
│  Confidence-Based Human Review                                              │
│       ↓                                                                     │
│  Universal Formula Language (FormulaDefinition)                             │
│       ↓                                                                     │
│  Universal Formula Evaluator (single engine, any formula)                   │
│       ↓                                                                     │
│  Accurate Payment Calculations with Full Audit Trail                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│  RESULT: Works for ANY contract type, globally, without code changes        │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Build Universal Formula Evaluator** - Core calculation engine
2. **Enhance Extraction with Mandatory Citations** - Track source text
3. **Add Validation Layer** - Verify values against citations
4. **Refactor Rules Engine** - Use evaluator instead of hardcoded handlers
5. **Update UI** - Show source citations and validation status

---

*Document Version: 1.0*
*Last Updated: January 2026*
