import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || '',
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const FAST_MODEL = 'claude-3-5-haiku-20241022';

interface MasterDataCatalog {
  territories: string[];
  productCategories: string[];
  ruleTemplates: { code: string; description: string }[];
  clauseCategories: { code: string; name: string }[];
  executionGroups: { code: string; name: string }[];
  baseMetrics: { code: string; name: string }[];
  flowTypes: { code: string; name: string }[];
  channels: string[];
  segments: string[];
  partners: { name: string; type: string }[];
}

async function fetchMasterDataCatalog(): Promise<MasterDataCatalog> {
  const [ter, prod, tmpl, cc, eg, bm, ft, ch, seg, pm] = await Promise.all([
    db.execute(sql`SELECT territory_name FROM territory_master ORDER BY territory_name`),
    db.execute(sql`SELECT DISTINCT product_category FROM products ORDER BY product_category`),
    db.execute(sql`SELECT template_code, description FROM rule_templates ORDER BY template_code`),
    db.execute(sql`SELECT code, name FROM clause_categories ORDER BY code`),
    db.execute(sql`SELECT code, name FROM clause_execution_groups ORDER BY code`),
    db.execute(sql`SELECT code, name FROM base_metrics ORDER BY code`),
    db.execute(sql`SELECT code, name FROM flow_types ORDER BY code`),
    db.execute(sql`SELECT channel_name FROM sales_channels ORDER BY channel_name`),
    db.execute(sql`SELECT segment_name FROM customer_segments ORDER BY segment_name`),
    db.execute(sql`SELECT DISTINCT partner_name, partner_type FROM partner_master ORDER BY partner_name`),
  ]);

  return {
    territories: (ter.rows || []).map((r: any) => r.territory_name),
    productCategories: (prod.rows || []).map((r: any) => r.product_category),
    ruleTemplates: (tmpl.rows || []).map((r: any) => ({ code: r.template_code, description: r.description })),
    clauseCategories: (cc.rows || []).map((r: any) => ({ code: r.code, name: r.name })),
    executionGroups: (eg.rows || []).map((r: any) => ({ code: r.code, name: r.name })),
    baseMetrics: (bm.rows || []).map((r: any) => ({ code: r.code, name: r.name })),
    flowTypes: (ft.rows || []).map((r: any) => ({ code: r.code, name: r.name })),
    channels: (ch.rows || []).map((r: any) => r.channel_name),
    segments: (seg.rows || []).map((r: any) => r.segment_name),
    partners: (pm.rows || []).map((r: any) => ({ name: r.partner_name, type: r.partner_type })),
  };
}

interface ContractContext {
  contractName: string;
  contractType: string;
  contractSubtype: string;
  organization: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  territoryScope: string;
  channelScope: string;
  currency: string;
}

export async function generateContextualRules(ctx: ContractContext, catalog: MasterDataCatalog | null = null): Promise<any[]> {
  if (!catalog) catalog = await fetchMasterDataCatalog();

  const prompt = `You are a contract analysis expert. Given this contract context, select the most relevant items from the master data catalog and generate realistic contract rules.

CONTRACT CONTEXT:
- Name: ${ctx.contractName}
- Type: ${ctx.contractType}
- Subtype: ${ctx.contractSubtype}
- Parties: ${ctx.organization} (Owner) / ${ctx.counterparty} (Counterparty)
- Period: ${ctx.startDate} to ${ctx.endDate}
- Territory Scope: ${ctx.territoryScope}
- Channel Scope: ${ctx.channelScope}
- Currency: ${ctx.currency}

AVAILABLE MASTER DATA (you MUST only use values from these lists):

Rule Templates: ${JSON.stringify(catalog.ruleTemplates)}
Territories: ${JSON.stringify(catalog.territories)}
Product Categories: ${JSON.stringify(catalog.productCategories)}
Clause Categories: ${JSON.stringify(catalog.clauseCategories)}
Execution Groups: ${JSON.stringify(catalog.executionGroups)}
Base Metrics: ${JSON.stringify(catalog.baseMetrics)}

Generate exactly 3-4 rules that are contextually appropriate for a "${ctx.contractType}" contract with subtype "${ctx.contractSubtype}". Each rule should use ONLY values from the master data above.

Return a JSON array where each rule has:
{
  "ruleName": "descriptive name relevant to contract type",
  "ruleType": "percentage|tiered|cap|flat|threshold",
  "description": "clear description of what this rule does",
  "baseRate": "numeric string e.g. 0.065",
  "minimumGuarantee": "numeric string or null",
  "volumeTiers": [{"min": number, "max": number|null, "rate": number}] or null,
  "productCategories": ["from catalog"],
  "territories": ["from catalog"],
  "priority": number (10, 20, 30...),
  "templateCode": "from catalog templates",
  "clauseCategory": "code from catalog",
  "executionGroup": "code from catalog",
  "baseMetric": "code from catalog",
  "sourceText": "realistic contract clause text mentioning the parties"
}

Return ONLY the JSON array, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const rules = JSON.parse(jsonMatch[0]);
      return validateAgainstCatalog(rules, catalog, 'rules');
    }
  } catch (err: any) {
    console.error('AI rule generation failed, using smart fallback:', err.message);
  }

  return smartFallbackRules(ctx, catalog);
}

export async function generateContextualClauses(ctx: ContractContext, catalog: MasterDataCatalog | null = null): Promise<any[]> {
  if (!catalog) catalog = await fetchMasterDataCatalog();

  const prompt = `You are a contract drafting expert. Given this contract context, generate realistic contract clauses.

CONTRACT CONTEXT:
- Name: ${ctx.contractName}
- Type: ${ctx.contractType}
- Subtype: ${ctx.contractSubtype}
- Parties: ${ctx.organization} (Owner) / ${ctx.counterparty} (Counterparty)
- Period: ${ctx.startDate} to ${ctx.endDate}

AVAILABLE MASTER DATA (you MUST only use values from these lists):

Clause Categories: ${JSON.stringify(catalog.clauseCategories)}
Flow Types: ${JSON.stringify(catalog.flowTypes)}

Generate exactly 5-6 clauses that are contextually appropriate for a "${ctx.contractType}" contract with subtype "${ctx.contractSubtype}".

Return a JSON array where each clause has:
{
  "sectionRef": "Section X.Y",
  "clauseCategoryCode": "code from clause categories",
  "flowTypeCode": "code from flow types",
  "text": "realistic contract clause text using actual party names",
  "confidence": number between 85 and 99
}

Return ONLY the JSON array, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const clauses = JSON.parse(jsonMatch[0]);
      return validateAgainstCatalog(clauses, catalog, 'clauses');
    }
  } catch (err: any) {
    console.error('AI clause generation failed, using smart fallback:', err.message);
  }

  return smartFallbackClauses(ctx, catalog);
}

export async function generateContextualAnalysis(ctx: ContractContext, catalog: MasterDataCatalog | null = null): Promise<any> {
  if (!catalog) catalog = await fetchMasterDataCatalog();

  const prompt = `You are a contract analysis expert. Generate a comprehensive analysis for this contract.

CONTRACT CONTEXT:
- Name: ${ctx.contractName}
- Type: ${ctx.contractType}
- Subtype: ${ctx.contractSubtype}
- Parties: ${ctx.organization} (Owner) / ${ctx.counterparty} (Counterparty)
- Period: ${ctx.startDate} to ${ctx.endDate}
- Territory Scope: ${ctx.territoryScope}
- Channel Scope: ${ctx.channelScope}
- Currency: ${ctx.currency}

Generate a realistic contract analysis. Return a JSON object with:
{
  "summary": "2-3 sentence summary of the contract specific to its type and subtype",
  "keyTerms": {
    "Contract Type": "...",
    "Parties": "...",
    "Effective Period": "...",
    "Payment Frequency": "...",
    ... 4-6 more key terms relevant to this contract type
  },
  "riskAnalysis": {
    "Overall Risk Score": number between 0.1 and 0.8,
    "Risk Level": "Low|Medium-Low|Medium|Medium-High|High",
    "Key Risks": ["3-4 risks specific to this contract type"],
    "Mitigating Factors": ["3-4 mitigating factors"]
  },
  "insights": {
    "Financial Impact": "estimated financial impact statement",
    "Key Obligations": ["3-4 obligations specific to this contract type"],
    "Optimization Opportunities": ["3-4 opportunities"]
  }
}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err: any) {
    console.error('AI analysis generation failed, using smart fallback:', err.message);
  }

  return smartFallbackAnalysis(ctx);
}

export async function generateContextualQualifiers(ctx: ContractContext, catalog: MasterDataCatalog | null = null): Promise<any[]> {
  if (!catalog) catalog = await fetchMasterDataCatalog();

  const prompt = `You are a contract configuration expert. Generate qualifiers (filters/conditions) for contract terms.

CONTRACT CONTEXT:
- Name: ${ctx.contractName}
- Type: ${ctx.contractType}
- Subtype: ${ctx.contractSubtype}
- Territory Scope: ${ctx.territoryScope}
- Channel Scope: ${ctx.channelScope}

AVAILABLE MASTER DATA (you MUST only use values from these lists):

Territories: ${JSON.stringify(catalog.territories)}
Channels: ${JSON.stringify(catalog.channels)}
Product Categories: ${JSON.stringify(catalog.productCategories)}
Customer Segments: ${JSON.stringify(catalog.segments)}

Generate exactly 5-6 qualifiers that are contextually appropriate for a "${ctx.contractType}" contract with subtype "${ctx.contractSubtype}".

Return a JSON array where each qualifier has:
{
  "qualifierType": "territory|product_category|channel|customer_segment",
  "qualifierField": "territory|product_category|channel|segment",
  "qualifierValue": "exact value from the master data lists above",
  "operator": "IN|=|>=|<=",
  "notes": "brief explanation of why this qualifier applies"
}

Return ONLY the JSON array, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const qualifiers = JSON.parse(jsonMatch[0]);
      return validateAgainstCatalog(qualifiers, catalog, 'qualifiers');
    }
  } catch (err: any) {
    console.error('AI qualifier generation failed, using smart fallback:', err.message);
  }

  return smartFallbackQualifiers(ctx, catalog);
}

export async function selectContextualPartners(ctx: ContractContext, catalog: MasterDataCatalog | null = null): Promise<{ name: string; type: string; assignmentType: string }[]> {
  if (!catalog) catalog = await fetchMasterDataCatalog();

  const prompt = `You are a contract configuration expert. Select the most appropriate business partners for this contract from the available partner list.

CONTRACT CONTEXT:
- Name: ${ctx.contractName}
- Type: ${ctx.contractType}
- Subtype: ${ctx.contractSubtype}
- Parties: ${ctx.organization} (Owner) / ${ctx.counterparty} (Counterparty)

AVAILABLE PARTNERS:
${catalog.partners.map(p => `- ${p.name} (${p.type})`).join('\n')}

Select 2-3 partners that would be most relevant for a "${ctx.contractType}" contract with subtype "${ctx.contractSubtype}". For each, assign an appropriate role.

Return a JSON array where each entry has:
{
  "name": "exact partner name from the list above",
  "type": "the partner's type from the list",
  "assignmentType": "Primary Distributor|Secondary Distributor|Licensee|Licensor|Reseller|Sub-distributor|Affiliate|OEM Partner|Technology Provider"
}

Return ONLY the JSON array, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const partners = JSON.parse(jsonMatch[0]);
      const validNames = new Set(catalog.partners.map(p => p.name));
      const seen = new Set<string>();
      return partners.filter((p: any) => {
        if (!validNames.has(p.name) || seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
    }
  } catch (err: any) {
    console.error('AI partner selection failed, using smart fallback:', err.message);
  }

  return smartFallbackPartners(ctx, catalog);
}

function validateAgainstCatalog(items: any[], catalog: MasterDataCatalog, type: string): any[] {
  const validTerritories = new Set(catalog.territories);
  const validProducts = new Set(catalog.productCategories);
  const validTemplates = new Set(catalog.ruleTemplates.map(t => t.code));
  const validClauseCats = new Set(catalog.clauseCategories.map(c => c.code));
  const validExecGroups = new Set(catalog.executionGroups.map(e => e.code));
  const validMetrics = new Set(catalog.baseMetrics.map(m => m.code));
  const validFlowTypes = new Set(catalog.flowTypes.map(f => f.code));
  const validChannels = new Set(catalog.channels);
  const validSegments = new Set(catalog.segments);

  if (type === 'rules') {
    return items.map(rule => ({
      ...rule,
      territories: (rule.territories || []).filter((t: string) => validTerritories.has(t)),
      productCategories: (rule.productCategories || []).filter((p: string) => validProducts.has(p)),
      templateCode: validTemplates.has(rule.templateCode) ? rule.templateCode : catalog.ruleTemplates[0]?.code || 'T1',
      clauseCategory: validClauseCats.has(rule.clauseCategory) ? rule.clauseCategory : catalog.clauseCategories[0]?.code || 'financial_calculation',
      executionGroup: validExecGroups.has(rule.executionGroup) ? rule.executionGroup : catalog.executionGroups[0]?.code || 'periodic',
      baseMetric: validMetrics.has(rule.baseMetric) ? rule.baseMetric : catalog.baseMetrics[0]?.code || 'net_sales',
    }));
  }

  if (type === 'clauses') {
    return items.map(clause => ({
      ...clause,
      clauseCategoryCode: validClauseCats.has(clause.clauseCategoryCode) ? clause.clauseCategoryCode : catalog.clauseCategories[0]?.code || 'financial_calculation',
      flowTypeCode: validFlowTypes.has(clause.flowTypeCode) ? clause.flowTypeCode : catalog.flowTypes[0]?.code || 'contract fee',
    }));
  }

  if (type === 'qualifiers') {
    return items.filter(q => {
      if (q.qualifierType === 'territory') return validTerritories.has(q.qualifierValue);
      if (q.qualifierType === 'product_category') return validProducts.has(q.qualifierValue);
      if (q.qualifierType === 'channel') return validChannels.has(q.qualifierValue);
      if (q.qualifierType === 'customer_segment') return validSegments.has(q.qualifierValue);
      return true;
    });
  }

  return items;
}

function smartFallbackRules(ctx: ContractContext, catalog: MasterDataCatalog): any[] {
  const typeMap: Record<string, { templates: string[]; metrics: string[]; ruleTypes: string[] }> = {
    'rebate_incentive': { templates: ['T3', 'T4', 'T7'], metrics: ['net_sales', 'units'], ruleTypes: ['tiered', 'threshold', 'cap'] },
    'royalty_license': { templates: ['T1', 'T8', 'T7'], metrics: ['net_sales', 'gross_sales'], ruleTypes: ['percentage', 'flat', 'cap'] },
    'oem_license': { templates: ['T2', 'T3', 'T7'], metrics: ['units', 'net_sales'], ruleTypes: ['flat', 'tiered', 'cap'] },
    'manufacturing_license': { templates: ['T1', 'T6', 'T9'], metrics: ['units', 'net_sales'], ruleTypes: ['percentage', 'flat', 'cap'] },
    'distribution': { templates: ['T5', 'T3', 'T7'], metrics: ['net_sales', 'margin'], ruleTypes: ['percentage', 'tiered', 'cap'] },
    'franchise': { templates: ['T1', 'T6', 'T8'], metrics: ['gross_sales', 'net_sales'], ruleTypes: ['percentage', 'flat', 'cap'] },
    'service_agreement': { templates: ['T6', 'T4', 'T11'], metrics: ['invoice_amount', 'subscription_revenue'], ruleTypes: ['flat', 'threshold', 'percentage'] },
  };

  const config = typeMap[ctx.contractType] || typeMap['royalty_license']!;
  const territories = catalog.territories.sort(() => Math.random() - 0.5).slice(0, 3);
  const products = catalog.productCategories.sort(() => Math.random() - 0.5).slice(0, 2);
  const typeLabel = ctx.contractType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return config.templates.map((tmplCode, i) => {
    const tmpl = catalog.ruleTemplates.find(t => t.code === tmplCode) || catalog.ruleTemplates[0];
    const metric = catalog.baseMetrics.find(m => m.code === config.metrics[i % config.metrics.length]) || catalog.baseMetrics[0];
    return {
      ruleName: i === 0 ? `Base ${typeLabel} Fee` : i === 1 ? `${typeLabel} Adjustment` : `Annual Cap`,
      ruleType: config.ruleTypes[i],
      description: tmpl?.description || 'Contract calculation rule',
      baseRate: i === 0 ? '0.065' : i === 1 ? '0.015' : '500000',
      minimumGuarantee: i === 0 ? '50000' : null,
      volumeTiers: config.ruleTypes[i] === 'tiered' ? [
        { min: 0, max: 500000, rate: 0.08 },
        { min: 500001, max: 1000000, rate: 0.065 },
        { min: 1000001, max: null, rate: 0.05 },
      ] : null,
      productCategories: products.slice(0, i === 2 ? products.length : 1),
      territories: territories.slice(i, i + 2),
      priority: (i + 1) * 10,
      isActive: true,
      templateCode: tmplCode,
      clauseCategory: catalog.clauseCategories[i % catalog.clauseCategories.length]?.code || 'financial_calculation',
      executionGroup: catalog.executionGroups[i % catalog.executionGroups.length]?.code || 'periodic',
      baseMetric: metric?.code || 'net_sales',
      sourceText: `${ctx.counterparty} shall pay ${ctx.organization} as per ${tmpl?.description?.toLowerCase() || 'the agreed calculation method'}.`,
    };
  });
}

function smartFallbackClauses(ctx: ContractContext, catalog: MasterDataCatalog): any[] {
  const typeLabel = ctx.contractType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return [
    { sectionRef: 'Section 1.1', clauseCategoryCode: catalog.clauseCategories[0]?.code || 'financial_calculation', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `${ctx.organization} grants ${ctx.counterparty} rights under this ${typeLabel} agreement for the term specified herein.`, confidence: 95 },
    { sectionRef: 'Section 3.1', clauseCategoryCode: catalog.clauseCategories[0]?.code || 'financial_calculation', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `${ctx.counterparty} shall pay ${ctx.organization} fees as calculated per the rate schedule in Exhibit A.`, confidence: 92 },
    { sectionRef: 'Section 3.3', clauseCategoryCode: catalog.clauseCategories[4]?.code || 'operational', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `All payments are due within 45 days following each reporting period end. Late payments accrue interest at 1.5% per month.`, confidence: 90 },
    { sectionRef: 'Section 4.1', clauseCategoryCode: catalog.clauseCategories[4]?.code || 'operational', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `${ctx.counterparty} shall maintain accurate records and provide ${ctx.organization} with detailed reports within 30 days of each period end.`, confidence: 88 },
    { sectionRef: 'Section 5.1', clauseCategoryCode: catalog.clauseCategories[3]?.code || 'governance_risk', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `${ctx.organization} reserves the right to audit ${ctx.counterparty}'s records once per calendar year with 60 days written notice.`, confidence: 87 },
    { sectionRef: 'Section 7.1', clauseCategoryCode: catalog.clauseCategories[3]?.code || 'governance_risk', flowTypeCode: catalog.flowTypes[0]?.code || 'contract fee', text: `This Agreement auto-renews for successive one-year terms unless either party provides 90 days written notice.`, confidence: 85 },
  ];
}

function smartFallbackAnalysis(ctx: ContractContext): any {
  const typeLabel = ctx.contractType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    summary: `This ${typeLabel} agreement between ${ctx.organization} and ${ctx.counterparty} establishes terms for the period ${ctx.startDate} to ${ctx.endDate}. The contract covers ${ctx.contractSubtype || typeLabel} operations across specified territories and channels.`,
    keyTerms: {
      "Contract Type": typeLabel,
      "Subtype": ctx.contractSubtype || 'Standard',
      "Parties": `${ctx.organization} / ${ctx.counterparty}`,
      "Effective Period": `${ctx.startDate} to ${ctx.endDate}`,
      "Territory": ctx.territoryScope || 'As specified',
      "Channels": ctx.channelScope || 'As specified',
      "Currency": ctx.currency,
    },
    riskAnalysis: {
      "Overall Risk Score": 0.35,
      "Risk Level": "Medium-Low",
      "Key Risks": [
        `Payment obligations under ${typeLabel} terms`,
        "Territory scope limitations",
        "Auto-renewal management required",
      ],
      "Mitigating Factors": [
        "Structured rate schedules reduce uncertainty",
        "Clear reporting and audit provisions",
        "Defined termination conditions",
      ],
    },
    insights: {
      "Financial Impact": `Contract fees estimated based on ${typeLabel} structure`,
      "Key Obligations": [
        "Periodic reporting requirements",
        "Audit compliance",
        "Minimum performance thresholds",
      ],
      "Optimization Opportunities": [
        "Volume-based rate negotiation",
        "Territory expansion potential",
        "Channel diversification",
      ],
    },
  };
}

function smartFallbackQualifiers(ctx: ContractContext, catalog: MasterDataCatalog): any[] {
  const territories = catalog.territories.sort(() => Math.random() - 0.5).slice(0, 2);
  const channels = catalog.channels.sort(() => Math.random() - 0.5).slice(0, 2);
  const products = catalog.productCategories.sort(() => Math.random() - 0.5).slice(0, 1);
  const segments = catalog.segments.sort(() => Math.random() - 0.5).slice(0, 1);

  return [
    { qualifierType: 'territory', qualifierField: 'territory', qualifierValue: territories[0] || 'Global', operator: 'IN', notes: `Applies to ${territories[0]} territory` },
    { qualifierType: 'territory', qualifierField: 'territory', qualifierValue: territories[1] || territories[0] || 'Global', operator: 'IN', notes: `Applies to ${territories[1]} territory` },
    { qualifierType: 'product_category', qualifierField: 'product_category', qualifierValue: products[0] || 'All Products', operator: '=', notes: `Applies to ${products[0]} products` },
    { qualifierType: 'channel', qualifierField: 'channel', qualifierValue: channels[0] || 'Direct Sales', operator: 'IN', notes: `Applies to ${channels[0]} channel` },
    { qualifierType: 'channel', qualifierField: 'channel', qualifierValue: channels[1] || channels[0] || 'All Channels', operator: 'IN', notes: `Applies to ${channels[1]} channels` },
    { qualifierType: 'customer_segment', qualifierField: 'segment', qualifierValue: segments[0] || 'Enterprise', operator: '=', notes: `Applies to ${segments[0]} customers` },
  ];
}

function smartFallbackPartners(ctx: ContractContext, catalog: MasterDataCatalog): { name: string; type: string; assignmentType: string }[] {
  const typePartnerMap: Record<string, string[]> = {
    'rebate_incentive': ['Distributor', 'Retailer'],
    'royalty_license': ['Technology Licensee', 'Component Manufacturer'],
    'oem_license': ['Technology Licensee - OEM', 'Component Manufacturer'],
    'manufacturing_license': ['Technology Licensee', 'Joint Development Partner'],
    'distribution': ['Distributor', 'Retailer'],
    'franchise': ['Retailer', 'Distributor'],
    'service_agreement': ['Implementation Partner', 'Reseller'],
  };

  const preferredTypes = typePartnerMap[ctx.contractType] || ['Distributor', 'Reseller'];
  const selected: { name: string; type: string; assignmentType: string }[] = [];

  for (const prefType of preferredTypes) {
    const match = catalog.partners.find(p =>
      p.type?.toLowerCase().includes(prefType.toLowerCase()) &&
      !selected.some(s => s.name === p.name)
    );
    if (match) {
      selected.push({
        name: match.name,
        type: match.type,
        assignmentType: selected.length === 0 ? 'Primary Distributor' : 'Secondary Distributor',
      });
    }
    if (selected.length >= 3) break;
  }

  if (selected.length < 2) {
    const remaining = catalog.partners.filter(p => !selected.some(s => s.name === p.name));
    const shuffled = remaining.sort(() => Math.random() - 0.5).slice(0, 3 - selected.length);
    for (const p of shuffled) {
      selected.push({ name: p.name, type: p.type, assignmentType: 'Reseller' });
    }
  }

  return selected;
}

export { fetchMasterDataCatalog, MasterDataCatalog, ContractContext };
