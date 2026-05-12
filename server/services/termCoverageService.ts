import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface TermCategory {
  key: string;
  label: string;
  description: string;
  expectedTermPatterns: string[];
  entityTypes: string[];
  priority: 'critical' | 'important' | 'optional';
}

const UNIVERSAL_CATEGORIES: TermCategory[] = [
  {
    key: 'parties',
    label: 'Parties & Counterparties',
    description: 'All parties involved in the agreement',
    expectedTermPatterns: ['licensor', 'licensee', 'vendor', 'supplier', 'distributor', 'manufacturer', 'buyer', 'seller', 'partner', 'company', 'contractor', 'client', 'reseller', 'agent', 'principal', 'publisher', 'franchis'],
    entityTypes: ['party'],
    priority: 'critical',
  },
  {
    key: 'products',
    label: 'Products & Services',
    description: 'Products, services, SKUs, or categories covered',
    expectedTermPatterns: ['product', 'item', 'sku', 'goods', 'service', 'merchandise', 'equipment', 'software', 'material', 'line', 'category', 'net sales', 'gross sales', 'unit', 'inventory'],
    entityTypes: ['product'],
    priority: 'critical',
  },
  {
    key: 'territory',
    label: 'Territory & Geography',
    description: 'Geographic scope, regions, or territories',
    expectedTermPatterns: ['territory', 'region', 'country', 'state', 'area', 'zone', 'market', 'geography', 'worldwide', 'domestic', 'international'],
    entityTypes: ['territory'],
    priority: 'important',
  },
  {
    key: 'pricing_rates',
    label: 'Pricing & Rates',
    description: 'All pricing structures, rates, fees, discounts',
    expectedTermPatterns: ['rate', 'price', 'fee', 'contract fee', 'contract fee', 'commission', 'margin', 'markup', 'discount', 'rebate', 'cost', 'charge'],
    entityTypes: ['financial_term'],
    priority: 'critical',
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    description: 'Payment schedules, methods, frequencies, net terms',
    expectedTermPatterns: ['payment', 'invoice', 'net 30', 'net 60', 'due date', 'billing', 'remittance', 'frequency', 'quarterly', 'monthly', 'annually'],
    entityTypes: ['payment_term'],
    priority: 'critical',
  },
  {
    key: 'duration_dates',
    label: 'Duration & Key Dates',
    description: 'Effective dates, expiration, term length',
    expectedTermPatterns: ['effective date', 'start date', 'end date', 'expiration', 'term', 'duration', 'period', 'commencement', 'initial term', 'year', 'month', 'annual', 'quarterly', 'agreement date'],
    entityTypes: ['date'],
    priority: 'critical',
  },
  {
    key: 'volume_tiers',
    label: 'Volume Tiers & Thresholds',
    description: 'Tiered pricing, volume brackets, thresholds',
    expectedTermPatterns: ['tier', 'threshold', 'volume', 'bracket', 'minimum', 'maximum', 'range', 'level', 'band', 'step'],
    entityTypes: ['volume_tier'],
    priority: 'important',
  },
  {
    key: 'minimums_guarantees',
    label: 'Minimums & Guarantees',
    description: 'Minimum commitments, guarantees, floors',
    expectedTermPatterns: ['minimum', 'guarantee', 'floor', 'minimum annual', 'minimum order', 'commitment', 'obligation', 'quota'],
    entityTypes: ['financial_term'],
    priority: 'important',
  },
  {
    key: 'termination',
    label: 'Termination & Exit',
    description: 'Termination conditions, notice periods, exit clauses',
    expectedTermPatterns: ['termination', 'terminate', 'cancellation', 'notice period', 'exit', 'breach', 'default', 'cure period'],
    entityTypes: ['clause'],
    priority: 'important',
  },
  {
    key: 'renewal',
    label: 'Renewal & Extension',
    description: 'Auto-renewal, extension terms, renegotiation',
    expectedTermPatterns: ['renewal', 'renew', 'extension', 'auto-renew', 'evergreen', 'renegotiation', 'option to extend'],
    entityTypes: ['clause'],
    priority: 'important',
  },
  {
    key: 'exclusivity',
    label: 'Exclusivity & Restrictions',
    description: 'Exclusive rights, non-compete, restrictions',
    expectedTermPatterns: ['exclusive', 'non-exclusive', 'non-compete', 'restriction', 'limitation', 'sole', 'prohibited'],
    entityTypes: ['clause'],
    priority: 'optional',
  },
  {
    key: 'channel_segment',
    label: 'Channel & Customer Segment',
    description: 'Sales channels, customer segments, market segments',
    expectedTermPatterns: ['channel', 'segment', 'retail', 'wholesale', 'online', 'direct', 'indirect', 'end user', 'consumer', 'enterprise', 'commercial'],
    entityTypes: ['clause', 'territory'],
    priority: 'optional',
  },
];

const CONTRACT_TYPE_REQUIRED_CATEGORIES: Record<string, string[]> = {
  direct_sales: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'territory', 'minimums_guarantees'],
  distributor_reseller: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'territory', 'volume_tiers', 'exclusivity'],
  referral: ['parties', 'pricing_rates', 'payment_terms', 'duration_dates', 'termination'],
  royalty_license: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'volume_tiers', 'minimums_guarantees', 'territory', 'renewal'],
  rebate_mdf: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'volume_tiers', 'minimums_guarantees'],
  chargebacks_claims: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'termination'],
  marketplace_platforms: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'channel_segment'],
  usage_service_based: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'volume_tiers'],
  spiff_promotional: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'channel_segment'],
  pricing_agreement: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'volume_tiers', 'territory'],
  marketing_support: ['parties', 'pricing_rates', 'payment_terms', 'duration_dates', 'territory'],
  channel_incentive: ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates', 'channel_segment', 'volume_tiers'],
};

const DEFAULT_REQUIRED = ['parties', 'products', 'pricing_rates', 'payment_terms', 'duration_dates'];

interface DefinedTerm {
  term: string;
  definition: string;
  foundInMappings: boolean;
}

interface CategoryCoverage {
  category: string;
  label: string;
  description: string;
  priority: 'critical' | 'important' | 'optional';
  expected: boolean;
  found: boolean;
  matchCount: number;
  matchedTerms: string[];
  status: 'covered' | 'missing' | 'not_required';
}

export interface TermCoverageResult {
  contractId: string;
  contractType: string | null;
  coveragePercent: number;
  totalExpected: number;
  totalFound: number;
  categoryCoverage: CategoryCoverage[];
  definedTerms: DefinedTerm[];
  suggestions: string[];
  missingCritical: string[];
}

export function extractDefinitionsSection(contractText: string): DefinedTerm[] {
  const definedTerms: DefinedTerm[] = [];
  const seen = new Set<string>();

  const sectionPatterns = [
    /(?:^|\n)\s*(?:ARTICLE\s+\w+[.:]\s*)?(?:DEFINITIONS?|DEFINED\s+TERMS|INTERPRETATION)\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION|\d+\.\s+[A-Z])|$)/i,
    /(?:^|\n)\s*\d+[\.:]\s*DEFINITIONS?\s*\n([\s\S]*?)(?=\n\s*\d+[\.:]\s*[A-Z])/i,
  ];

  let definitionsText = '';
  for (const pattern of sectionPatterns) {
    const match = contractText.match(pattern);
    if (match) {
      definitionsText = match[1] || match[0];
      break;
    }
  }

  const textToScan = definitionsText || contractText;

  const termPatterns = [
    /["""]([A-Z][a-zA-Z\s&\-/]+?)["""\s]+(?:shall\s+)?(?:mean|means|refer|refers\s+to|is\s+defined\s+as|has\s+the\s+meaning)/gi,
    /["""]([A-Z][a-zA-Z\s&\-/]+?)[""\s]+(?:shall\s+have\s+the\s+meaning)/gi,
    /(?:^|\n)\s*["""]([A-Z][a-zA-Z\s&\-/]+?)[""]\s*[–—-]\s*/gm,
    /\((?:the\s+)?["""]([A-Z][a-zA-Z\s&\-/]+?)[""]\)/g,
    /(?:hereinafter|herein)\s+(?:referred\s+to\s+as|called)\s+["""]([A-Z][a-zA-Z\s&\-/]+?)[""]/gi,
  ];

  for (const pattern of termPatterns) {
    let match;
    while ((match = pattern.exec(textToScan)) !== null) {
      const term = match[1].trim();
      if (term.length >= 2 && term.length <= 60 && !seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        const defStart = match.index + match[0].length;
        const defEnd = Math.min(defStart + 200, textToScan.length);
        const definition = textToScan.substring(defStart, defEnd).replace(/\n/g, ' ').trim().substring(0, 150);
        definedTerms.push({ term, definition, foundInMappings: false });
      }
    }
  }

  return definedTerms;
}

export function identifyContractSections(contractText: string): Array<{ name: string; text: string; category: string }> {
  const sections: Array<{ name: string; text: string; category: string }> = [];

  const sectionPatterns = [
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:DEFINITIONS?|DEFINED\s+TERMS)\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'definitions' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:PAYMENT|COMPENSATION|CONSIDERATION|LICENSE\s+FEE|ROYALT)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'payment' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:TERRITORY|GEOGRAPHIC|REGION)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'territory' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:PRODUCT|SERVICE|LICENSED\s+(?:PRODUCT|MATERIAL)|GOODS)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'products' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:TERM\s+(?:AND|&)\s+TERMINATION|DURATION|EXPIRATION|TERMINATION)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'termination' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:PRICING|RATE|FEE\s+SCHEDULE|SCHEDULE\s+A|EXHIBIT\s+A)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'pricing' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:RENEWAL|EXTENSION|AUTO.RENEW)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'renewal' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:EXCLUSIV|NON.COMPETE|RESTRICT)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'exclusivity' },
    { pattern: /(?:^|\n)\s*(?:ARTICLE|SECTION)?\s*\d*[\.:]*\s*(?:MINIMUM|GUARANTEE|COMMITMENT|OBLIGATION)\w*\s*\n([\s\S]*?)(?=\n\s*(?:ARTICLE|SECTION)\s*\d|$)/gi, category: 'minimums' },
  ];

  for (const { pattern, category } of sectionPatterns) {
    let match;
    while ((match = pattern.exec(contractText)) !== null) {
      const text = (match[1] || match[0]).trim();
      if (text.length > 20) {
        sections.push({
          name: match[0].split('\n')[0].trim().substring(0, 80),
          text: text.substring(0, 8000),
          category,
        });
      }
    }
  }

  if (sections.length === 0) {
    const chunkSize = 6000;
    for (let i = 0; i < contractText.length; i += chunkSize) {
      sections.push({
        name: `Section ${Math.floor(i / chunkSize) + 1}`,
        text: contractText.substring(i, i + chunkSize),
        category: 'general',
      });
    }
  }

  return sections;
}

export async function calculateTermCoverage(contractId: string): Promise<TermCoverageResult> {
  const contract = await storage.getContract(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  let contractTypeCode: string | null = null;
  if (contract.contractTypeId) {
    const typeResult = await db.execute(sql`
      SELECT code FROM contract_type_definitions WHERE id = ${contract.contractTypeId}
    `);
    if (typeResult.rows.length > 0) {
      contractTypeCode = (typeResult.rows[0] as any).code;
    }
  }

  const requiredCategoryKeys = contractTypeCode 
    ? CONTRACT_TYPE_REQUIRED_CATEGORIES[contractTypeCode] || DEFAULT_REQUIRED
    : DEFAULT_REQUIRED;

  const mappings = await storage.getPendingTermMappingsByContract(contractId);

  const rules = await db.execute(sql`
    SELECT rule_name, rule_type, description, source_text, 
           formula_definition, volume_tiers, base_rate, clause_category
    FROM contract_rules WHERE contract_id = ${contractId}
  `);

  const allTermTexts: string[] = [];

  // Include contract-level metadata (critical for prompt-created contracts that skip ERP extraction)
  if (contract.displayName) allTermTexts.push(contract.displayName.toLowerCase());
  if (contract.originalName) allTermTexts.push(contract.originalName.toLowerCase());
  if ((contract as any).counterpartyName) allTermTexts.push((contract as any).counterpartyName.toLowerCase());
  if (contract.summary) allTermTexts.push(contract.summary.toLowerCase());
  if (contract.keyTerms) allTermTexts.push(contract.keyTerms.toLowerCase());
  if (contract.insights) allTermTexts.push(contract.insights.toLowerCase());
  if (contract.fullText) allTermTexts.push(contract.fullText.substring(0, 20000).toLowerCase());

  // Also pull consolidated metadata from contracts table
  const masterData = await db.execute(sql`
    SELECT owning_party, counterparty_type, contract_type, contract_category,
           effective_start, effective_end, auto_renew, renewal_term_months,
           territory_scope, channel_scope, payment_frequency, display_name
    FROM contracts WHERE id = ${contractId} LIMIT 1
  `);
  if (masterData.rows.length > 0) {
    const cm = masterData.rows[0] as any;
    if (cm.owning_party) allTermTexts.push(cm.owning_party.toLowerCase());
    if (cm.counterparty_type) allTermTexts.push(cm.counterparty_type.toLowerCase());
    if (cm.display_name) allTermTexts.push(cm.display_name.toLowerCase());
    if (cm.contract_type) allTermTexts.push(cm.contract_type.toLowerCase());
    if (cm.effective_start) allTermTexts.push('effective date');
    if (cm.effective_end) allTermTexts.push('expiration date');
    if (cm.auto_renew) allTermTexts.push('renewal auto-renew');
    if (cm.renewal_term_months) allTermTexts.push('renewal term');
    if (cm.territory_scope) allTermTexts.push(cm.territory_scope.toLowerCase());
    if (cm.channel_scope) allTermTexts.push(cm.channel_scope.toLowerCase() + ' channel');
    if (cm.payment_frequency) allTermTexts.push(cm.payment_frequency.toLowerCase() + ' payment');
  }

  // Pull from contract_terms table
  const termsData = await db.execute(sql`
    SELECT term_type, term_name, notes FROM contract_terms WHERE contract_id = ${contractId}
  `);
  for (const t of termsData.rows as any[]) {
    if (t.term_type) allTermTexts.push(String(t.term_type).toLowerCase());
    if (t.term_name) allTermTexts.push(String(t.term_name).toLowerCase());
    if (t.notes) allTermTexts.push(String(t.notes).toLowerCase());
  }

  // Pull from contract_qualifiers table
  const qualData = await db.execute(sql`
    SELECT qualifier_type, qualifier_value FROM contract_qualifiers WHERE contract_id = ${contractId}
  `);
  for (const q of qualData.rows as any[]) {
    if (q.qualifier_type) allTermTexts.push(q.qualifier_type.toLowerCase());
    if (q.qualifier_value) allTermTexts.push(q.qualifier_value.toLowerCase());
  }

  // Pull from contract_partner_assignments
  const partnerData = await db.execute(sql`
    SELECT partner_role, partner_name FROM contract_partner_assignments WHERE contract_id = ${contractId}
  `);
  for (const p of partnerData.rows as any[]) {
    if (p.partner_role) allTermTexts.push(p.partner_role.toLowerCase());
    if (p.partner_name) allTermTexts.push(p.partner_name.toLowerCase());
  }

  for (const m of mappings) {
    if (m.originalTerm) allTermTexts.push(m.originalTerm.toLowerCase());
    if (m.originalValue) allTermTexts.push(m.originalValue.toLowerCase());
    if (m.erpFieldName) allTermTexts.push(m.erpFieldName.toLowerCase());
    if (m.erpEntityName) allTermTexts.push((m.erpEntityName as string).toLowerCase());
  }
  for (const r of rules.rows as any[]) {
    if (r.rule_name) allTermTexts.push(r.rule_name.toLowerCase());
    if (r.description) allTermTexts.push(r.description.toLowerCase());
    if (r.source_text) allTermTexts.push(r.source_text.toLowerCase());
    if (r.rule_type) allTermTexts.push(r.rule_type.toLowerCase());
    if (r.clause_category) allTermTexts.push(r.clause_category.toLowerCase());
    if (r.volume_tiers && Array.isArray(r.volume_tiers) && r.volume_tiers.length > 0) {
      allTermTexts.push('volume_tier');
      allTermTexts.push('tier');
    }
    if (r.base_rate) {
      allTermTexts.push('rate');
      allTermTexts.push('pricing');
    }
    // Check formula_definition for additional terms
    if (r.formula_definition) {
      const fd = typeof r.formula_definition === 'string' ? r.formula_definition : JSON.stringify(r.formula_definition);
      allTermTexts.push(fd.toLowerCase());
    }
  }

  const combinedText = allTermTexts.join(' ');

  const categoryCoverage: CategoryCoverage[] = UNIVERSAL_CATEGORIES.map(cat => {
    const isExpected = requiredCategoryKeys.includes(cat.key);
    const matchedTerms: string[] = [];

    for (const pattern of cat.expectedTermPatterns) {
      if (combinedText.includes(pattern.toLowerCase())) {
        matchedTerms.push(pattern);
      }
    }

    for (const m of mappings) {
      for (const entType of cat.entityTypes) {
        const entityName = (m.erpEntityName || '').toLowerCase();
        const fieldName = (m.erpFieldName || '').toLowerCase();
        if (entityName.includes(entType) || fieldName.includes(entType)) {
          const termLabel = m.originalTerm || fieldName;
          if (!matchedTerms.includes(termLabel)) {
            matchedTerms.push(termLabel);
          }
        }
      }
    }

    const found = matchedTerms.length > 0;

    return {
      category: cat.key,
      label: cat.label,
      description: cat.description,
      priority: cat.priority,
      expected: isExpected,
      found,
      matchCount: matchedTerms.length,
      matchedTerms: matchedTerms.slice(0, 10),
      status: isExpected ? (found ? 'covered' : 'missing') : 'not_required',
    };
  });

  let definedTerms: DefinedTerm[] = [];
  if (contract.fullText) {
    definedTerms = extractDefinitionsSection(contract.fullText);
    for (const dt of definedTerms) {
      const termLower = dt.term.toLowerCase();
      dt.foundInMappings = allTermTexts.some(t => t.includes(termLower)) ||
        mappings.some(m => (m.originalTerm || '').toLowerCase().includes(termLower));
    }
  }

  const expectedCategories = categoryCoverage.filter(c => c.expected);
  const coveredCategories = expectedCategories.filter(c => c.found);
  const coveragePercent = expectedCategories.length > 0
    ? Math.round((coveredCategories.length / expectedCategories.length) * 100)
    : 100;

  const missingCritical = categoryCoverage
    .filter(c => c.expected && !c.found && c.priority === 'critical')
    .map(c => c.label);

  const suggestions: string[] = [];
  const missingExpected = categoryCoverage.filter(c => c.expected && !c.found);
  if (missingExpected.length > 0) {
    suggestions.push(`${missingExpected.length} expected term categor${missingExpected.length === 1 ? 'y is' : 'ies are'} missing. Consider re-extracting with section-aware analysis.`);
  }
  if (missingCritical.length > 0) {
    suggestions.push(`Critical categories missing: ${missingCritical.join(', ')}. These are essential for accurate calculations.`);
  }
  const unmappedDefined = definedTerms.filter(dt => !dt.foundInMappings);
  if (unmappedDefined.length > 0) {
    suggestions.push(`${unmappedDefined.length} formally defined term${unmappedDefined.length === 1 ? '' : 's'} from the contract definitions section ${unmappedDefined.length === 1 ? 'was' : 'were'} not found in mappings.`);
  }

  return {
    contractId,
    contractType: contractTypeCode,
    coveragePercent,
    totalExpected: expectedCategories.length,
    totalFound: coveredCategories.length,
    categoryCoverage,
    definedTerms,
    suggestions,
    missingCritical,
  };
}

export async function extractMissingTerms(
  contractId: string,
  contractText: string
): Promise<{ definedTermsExtracted: number; sectionsProcessed: number; newTerms: string[] }> {
  const coverage = await calculateTermCoverage(contractId);
  const missingCategories = coverage.categoryCoverage
    .filter(c => c.expected && !c.found)
    .map(c => c.category);

  const contract = await storage.getContract(contractId);
  const companyId = contract?.companyId || null;

  let definedTermsExtracted = 0;
  const newTerms: string[] = [];

  const definedTerms = extractDefinitionsSection(contractText);
  const unmapped = definedTerms.filter(dt => !dt.foundInMappings);

  for (const dt of unmapped) {
    try {
      await storage.createPendingTermMapping({
        contractId,
        companyId,
        extractionRunId: null,
        originalTerm: dt.term,
        originalValue: dt.definition.substring(0, 200),
        sourceText: `Extracted from contract Definitions section`,
        sourceSection: 'Definitions',
        erpSystemId: null,
        erpEntityId: null,
        erpFieldId: null,
        erpFieldName: 'defined_term',
        erpEntityName: 'Contract Terms',
        erpRecordId: null,
        erpRecordValue: null,
        erpRecordTable: null,
        confidence: 0.85,
        mappingMethod: 'definitions_parser',
        alternativeMappings: null,
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null,
      });
      definedTermsExtracted++;
      newTerms.push(dt.term);
    } catch (err: any) {
      if (err.code !== '23505') {
        console.error(`[TermCoverage] Failed to save defined term ${dt.term}:`, err.message);
      }
    }
  }

  const sections = identifyContractSections(contractText);
  const sectionCategoryMap: Record<string, string[]> = {
    payment: ['pricing_rates', 'payment_terms', 'volume_tiers', 'minimums_guarantees'],
    territory: ['territory'],
    products: ['products'],
    termination: ['termination'],
    pricing: ['pricing_rates', 'volume_tiers'],
    renewal: ['renewal'],
    exclusivity: ['exclusivity'],
    minimums: ['minimums_guarantees'],
  };

  let sectionsProcessed = 0;
  for (const section of sections) {
    const sectionCategories = sectionCategoryMap[section.category] || [];
    const relevantMissing = sectionCategories.filter(c => missingCategories.includes(c));

    if (relevantMissing.length > 0 && section.text.length > 30) {
      sectionsProcessed++;
      console.log(`[TermCoverage] Section "${section.name}" covers missing categories: ${relevantMissing.join(', ')}`);

      const sectionTerms = extractTermsFromSectionText(section.text, section.category);
      for (const st of sectionTerms) {
        try {
          await storage.createPendingTermMapping({
            contractId,
            companyId,
            extractionRunId: null,
            originalTerm: st.term,
            originalValue: st.value,
            sourceText: `Section-aware extraction from "${section.name}"`,
            sourceSection: section.name,
            erpSystemId: null,
            erpEntityId: null,
            erpFieldId: null,
            erpFieldName: st.fieldHint,
            erpEntityName: st.entityHint,
            erpRecordId: null,
            erpRecordValue: null,
            erpRecordTable: null,
            confidence: 0.75,
            mappingMethod: 'section_aware_extraction',
            alternativeMappings: null,
            status: 'pending',
            confirmedBy: null,
            confirmedAt: null,
          });
          newTerms.push(st.term);
        } catch (err: any) {
          if (err.code !== '23505') {
            console.error(`[TermCoverage] Failed to save section term ${st.term}:`, err.message);
          }
        }
      }
    }
  }

  console.log(`[TermCoverage] Extraction complete: ${definedTermsExtracted} defined terms, ${sectionsProcessed} sections processed, ${newTerms.length} new terms total`);

  return { definedTermsExtracted, sectionsProcessed, newTerms };
}

interface SectionTerm {
  term: string;
  value: string | null;
  fieldHint: string;
  entityHint: string;
}

function extractTermsFromSectionText(text: string, category: string): SectionTerm[] {
  const terms: SectionTerm[] = [];
  const seen = new Set<string>();

  const addTerm = (term: string, value: string | null, fieldHint: string, entityHint: string) => {
    const key = term.toLowerCase().trim();
    if (key.length >= 3 && key.length <= 80 && !seen.has(key)) {
      seen.add(key);
      terms.push({ term: term.trim(), value, fieldHint, entityHint });
    }
  };

  if (category === 'payment' || category === 'pricing') {
    const ratePatterns = [
      /(\d+(?:\.\d+)?)\s*%/g,
      /\$\s*([\d,]+(?:\.\d{2})?)/g,
      /(net\s+\d+)/gi,
      /(quarterly|monthly|annually|semi-annually|bi-weekly|weekly)/gi,
    ];
    for (const p of ratePatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        const context = text.substring(Math.max(0, m.index - 40), m.index).trim().split(/[.;,\n]/).pop()?.trim() || '';
        if (context.length > 5) {
          addTerm(`${context} ${m[0]}`.trim(), m[0], 'rate_value', 'Financial Terms');
        }
      }
    }
  }

  if (category === 'territory') {
    const geoPatterns = [
      /(?:United\s+States|Canada|Mexico|Europe|Asia|Africa|South\s+America|North\s+America|EMEA|APAC|LATAM|AMER|UK|EU)/gi,
      /(?:worldwide|global|domestic|international|all\s+(?:countries|territories|regions))/gi,
    ];
    for (const p of geoPatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        addTerm(m[0], m[0], 'territory_name', 'Territories');
      }
    }
  }

  if (category === 'products') {
    const productPatterns = [
      /["""]([A-Z][a-zA-Z\s\-&]+?)[""]/g,
    ];
    for (const p of productPatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        if (m[1].length >= 3 && m[1].length <= 60) {
          addTerm(m[1], m[1], 'product_name', 'Products');
        }
      }
    }
  }

  if (category === 'termination') {
    const termPatterns = [
      /(\d+)\s*(?:days?|months?)\s*(?:prior\s+)?(?:written\s+)?notice/gi,
      /(for\s+cause|without\s+cause|material\s+breach|convenience)/gi,
      /cure\s+period\s+of\s+(\d+)\s*(?:days?|months?)/gi,
    ];
    for (const p of termPatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        addTerm(m[0], m[1] || m[0], 'termination_clause', 'Contract Terms');
      }
    }
  }

  if (category === 'renewal') {
    const renewalPatterns = [
      /(auto(?:matic(?:ally)?)?[\s-]*renew(?:al|ed|s)?)/gi,
      /(?:renew(?:al|ed)?)\s+(?:for|of)\s+([\w\s]+?)(?:\.|,|;)/gi,
      /(successive|additional)\s+(\d+[\s-]*(?:year|month))\s*(?:term|period)/gi,
    ];
    for (const p of renewalPatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        addTerm(m[0], m[1] || m[0], 'renewal_clause', 'Contract Terms');
      }
    }
  }

  if (category === 'minimums') {
    const minPatterns = [
      /minimum\s+(?:annual|monthly|quarterly)?\s*(?:royalty|payment|commitment|order|guarantee|purchase)\s*(?:of\s*)?\$?\s*([\d,]+(?:\.\d{2})?)/gi,
      /guarantee(?:d)?\s+(?:minimum|amount|payment)\s*(?:of\s*)?\$?\s*([\d,]+(?:\.\d{2})?)/gi,
    ];
    for (const p of minPatterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        addTerm(m[0].substring(0, 60), m[1] || m[0], 'minimum_value', 'Financial Terms');
      }
    }
  }

  const quotedTerms = /["""]([A-Z][a-zA-Z\s\-&/]+?)[""]/g;
  let qm;
  while ((qm = quotedTerms.exec(text)) !== null) {
    if (qm[1].length >= 3 && qm[1].length <= 50) {
      addTerm(qm[1], null, 'defined_term', 'Contract Terms');
    }
  }

  return terms;
}
