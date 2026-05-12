import { db } from '../db';
import { licenseiqEntities, licenseiqEntityRecords, pendingTermMappings } from '../../shared/schema';
import { eq, and, sql, ilike } from 'drizzle-orm';

interface ValueMatch {
  recordId: string;
  recordValue: string;
  recordTable: string;
  confidence: number;
  matchMethod: 'exact' | 'normalized' | 'fuzzy' | 'ai_semantic';
  matchedField: string;
}

interface LinkingResult {
  mappingId: string;
  linked: boolean;
  match?: ValueMatch;
  error?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

const ENTITY_SEARCH_FIELDS: Record<string, string[]> = {
  'products': ['product_name', 'product_display_name', 'sku', 'product_category', 'product_code'],
  'customers': ['customer_name', 'customer_code', 'account_name', 'customer_display_name'],
  'partner_master': ['partner_name', 'partner_id', 'partner_display_name', 'partner_code', 'primary_contact_name', 'legal_entity_name', 'company_name', 'hq_country', 'authorized_channels', 'partner_tier_classification', 'payment_terms', 'partner_onboarding_date'],
  'territory_master': ['territory_name', 'territory_code', 'region', 'country'],
  'sales_channels': ['channel_name', 'channel_code', 'channel_type'],
  'company_master': ['company_name', 'company_code', 'company_display_name'],
  'invoices': ['invoice_number'],
  'product_hierarchy': ['hierarchy_value', 'level_name', 'hierarchy_code', 'product_name', 'product_category', 'category_name', 'description'],
  'product_classifications': ['classification_value', 'classification_dimension', 'classification_code', 'product_name'],
  'product_attributes': ['attribute_name', 'attribute_value', 'product_name'],
  'product_bom': ['component_name', 'product_name', 'bom_name'],
  'product_channel_matrix': ['product_name', 'channel_name'],
  'product_territory_matrix': ['product_name', 'territory_name'],
  'product_packaging_matrix': ['product_name', 'packaging_type', 'packaging_name'],
  'partner_contract_associations': ['partner_name', 'role', 'partner_id'],
  'customer_segments': ['segment_name', 'segment_code'],
  'sales_transactions': ['transaction_id', 'invoice_number', 'product_name', 'customer_name'],
};

const RELATED_ENTITIES: Record<string, string[]> = {
  'products': ['product_hierarchy', 'product_classifications', 'product_attributes', 'product_bom'],
  'product_hierarchy': ['products', 'product_classifications'],
  'product_classifications': ['products', 'product_hierarchy'],
  'product_attributes': ['products'],
  'partner_master': ['partner_contract_associations', 'company_master'],
  'company_master': ['partner_master'],
  'territory_master': ['product_territory_matrix'],
  'sales_channels': ['product_channel_matrix'],
  'customers': ['customer_segments'],
  'customer_segments': ['customers'],
};

const RAW_TABLE_CONFIG: Record<string, { tableName: string; fields: string[] }> = {
  'products': { tableName: 'products', fields: ['product_name', 'sku', 'product_category', 'product_code'] },
  'partner_master': { tableName: 'partner_master', fields: ['partner_name', 'partner_id', 'partner_code', 'primary_contact_name', 'legal_entity_name', 'hq_country', 'authorized_channels', 'partner_tier_classification'] },
  'territory_master': { tableName: 'territory_master', fields: ['territory_name', 'territory_code', 'region', 'country'] },
  'sales_channels': { tableName: 'sales_channels', fields: ['channel_name', 'channel_code', 'channel_type'] },
  'product_hierarchy': { tableName: 'product_hierarchy', fields: ['hierarchy_value', 'level_name', 'hierarchy_code'] },
  'customer_segments': { tableName: 'customer_segments', fields: ['segment_name', 'segment_code'] },
};

async function getRawTableRecords(entityTechnicalName: string, companyId?: string | null): Promise<Array<{ id: string; recordData: any }>> {
  const config = RAW_TABLE_CONFIG[entityTechnicalName];
  if (!config) return [];

  try {
    const hasCompanyId = await db.execute(
      sql`SELECT 1 FROM information_schema.columns WHERE table_name = ${config.tableName} AND column_name = 'company_id' LIMIT 1`
    );
    const supportsCompany = Array.isArray(hasCompanyId) ? hasCompanyId.length > 0 : ((hasCompanyId as any)?.rows?.length > 0);

    let result: any;
    if (companyId && supportsCompany) {
      result = await db.execute(sql`SELECT * FROM ${sql.identifier(config.tableName)} WHERE company_id = ${companyId} LIMIT 500`);
    } else {
      result = await db.execute(sql`SELECT * FROM ${sql.identifier(config.tableName)} LIMIT 500`);
    }
    const rows = Array.isArray(result) ? result : (result?.rows || []);
    if (!rows || rows.length === 0) return [];

    return rows.map((row: any, idx: number) => {
      const id = row.id || row[`${entityTechnicalName.replace('_master', '')}_id`] || row.hierarchy_id || `raw-${idx}`;
      return { id: String(id), recordData: row };
    });
  } catch (e: any) {
    console.log(`[ValueLinking] Raw table query failed for ${config.tableName}: ${e.message}`);
    return [];
  }
}

export async function getEntityRecords(entityTechnicalName: string, companyId?: string | null): Promise<Array<{ id: string; recordData: any }>> {
  if (companyId && RAW_TABLE_CONFIG[entityTechnicalName]) {
    const rawRecords = await getRawTableRecords(entityTechnicalName, companyId);
    if (rawRecords.length > 0) {
      console.log(`[ValueLinking] Using ${rawRecords.length} company-filtered raw records for ${entityTechnicalName}`);
      return rawRecords;
    }
  }

  const entity = await db.select().from(licenseiqEntities)
    .where(eq(licenseiqEntities.technicalName, entityTechnicalName))
    .limit(1);

  let entityRecords: Array<{ id: string; recordData: any }> = [];
  if (entity.length > 0) {
    entityRecords = await db.select({
      id: licenseiqEntityRecords.id,
      recordData: licenseiqEntityRecords.recordData,
    }).from(licenseiqEntityRecords)
      .where(eq(licenseiqEntityRecords.entityId, entity[0].id));
  }

  if (entityRecords.length === 0) {
    const rawRecords = await getRawTableRecords(entityTechnicalName);
    if (rawRecords.length > 0) {
      console.log(`[ValueLinking] Entity records empty for ${entityTechnicalName}, using ${rawRecords.length} raw table records (no company filter)`);
      return rawRecords;
    }
  }

  return entityRecords;
}

export function findBestMatch(
  searchTerm: string,
  records: Array<{ id: string; recordData: any }>,
  entityType: string
): ValueMatch | null {
  if (!searchTerm || records.length === 0) return null;

  const predefinedFields = ENTITY_SEARCH_FIELDS[entityType] || [];
  const normalizedSearch = normalize(searchTerm);
  const searchLower = searchTerm.toLowerCase().trim();
  const searchTokens = tokenize(searchTerm);

  let bestMatch: ValueMatch | null = null;
  let bestScore = 0;

  for (const record of records) {
    const data = record.recordData as Record<string, any>;
    if (!data) continue;

    const allStringFields = Object.keys(data).filter(k => typeof data[k] === 'string' && data[k]);
    const searchFields = predefinedFields.length > 0
      ? [...new Set([...predefinedFields, ...allStringFields])]
      : allStringFields;

    for (const field of searchFields) {
      const fieldValue = data[field];
      if (!fieldValue || typeof fieldValue !== 'string') continue;

      const normalizedField = normalize(fieldValue);
      const fieldLower = fieldValue.toLowerCase().trim();

      let score = 0;
      let method: ValueMatch['matchMethod'] = 'fuzzy';

      if (normalizedSearch === normalizedField) {
        score = 1.0;
        method = 'exact';
      } else if (searchLower === fieldLower) {
        score = 1.0;
        method = 'exact';
      } else if (normalizedField.includes(normalizedSearch) || normalizedSearch.includes(normalizedField)) {
        const ratio = Math.min(normalizedSearch.length, normalizedField.length) / Math.max(normalizedSearch.length, normalizedField.length);
        score = 0.7 + (ratio * 0.25);
        method = 'normalized';
      } else if (fieldLower.length >= 3) {
        const wordBoundaryPattern = new RegExp(`(^|[\\s,;.!?()\\[\\]{}"\\'\\-\\/])${escapeRegex(fieldLower)}($|[\\s,;.!?()\\[\\]{}"\\'\\-\\/])`, 'i');
        if (wordBoundaryPattern.test(searchLower)) {
          const ratio = fieldLower.length / searchLower.length;
          score = 0.75 + (ratio * 0.2);
          method = 'normalized';
        } else if (searchLower.includes(fieldLower)) {
          const ratio = fieldLower.length / searchLower.length;
          score = 0.6 + (ratio * 0.2);
          method = 'normalized';
        }
      }

      if (score < 0.5) {
        const fieldTokens = tokenize(fieldValue);
        const jaccard = jaccardSimilarity(searchTokens, fieldTokens);
        const levenshtein = levenshteinSimilarity(normalizedSearch, normalizedField);
        const fuzzyScore = Math.max(jaccard * 0.9, levenshtein * 0.85);
        if (fuzzyScore > score) {
          score = fuzzyScore;
          method = 'fuzzy';
        }
      }

      const isPredefined = predefinedFields.includes(field);
      const adjustedScore = isPredefined ? score : score * 0.95;

      if (adjustedScore > bestScore && adjustedScore >= 0.4) {
        bestScore = adjustedScore;
        const displayField = predefinedFields[0] || field;
        const displayValue = data[displayField] || fieldValue;
        bestMatch = {
          recordId: record.id,
          recordValue: displayValue,
          recordTable: entityType,
          confidence: Math.round(adjustedScore * 100) / 100,
          matchMethod: method,
          matchedField: field,
        };
      }
    }
  }

  return bestMatch;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveEntityTechnicalName(erpEntityName: string): string | null {
  const name = erpEntityName?.toLowerCase()?.trim();
  if (!name) return null;

  const mapping: Record<string, string> = {
    'products': 'products',
    'product': 'products',
    'customers': 'customers',
    'customer': 'customers',
    'partner master': 'partner_master',
    'partner_master': 'partner_master',
    'partners': 'partner_master',
    'partner': 'partner_master',
    'territory master': 'territory_master',
    'territory_master': 'territory_master',
    'territories': 'territory_master',
    'territory': 'territory_master',
    'sales channels': 'sales_channels',
    'sales_channels': 'sales_channels',
    'channels': 'sales_channels',
    'channel': 'sales_channels',
    'sales channel': 'sales_channels',
    'company master': 'company_master',
    'company_master': 'company_master',
    'companies': 'company_master',
    'company': 'company_master',
    'invoices': 'invoices',
    'ap invoices': 'invoices',
    'invoice': 'invoices',
    'product hierarchy': 'product_hierarchy',
    'product_hierarchy': 'product_hierarchy',
    'hierarchy': 'product_hierarchy',
    'product classifications': 'product_classifications',
    'product_classifications': 'product_classifications',
    'classifications': 'product_classifications',
    'product attributes': 'product_attributes',
    'product_attributes': 'product_attributes',
    'product bom': 'product_bom',
    'product_bom': 'product_bom',
    'bom': 'product_bom',
    'product channel matrix': 'product_channel_matrix',
    'product_channel_matrix': 'product_channel_matrix',
    'product territory matrix': 'product_territory_matrix',
    'product_territory_matrix': 'product_territory_matrix',
    'product packaging matrix': 'product_packaging_matrix',
    'product_packaging_matrix': 'product_packaging_matrix',
    'partner contract associations': 'partner_contract_associations',
    'partner_contract_associations': 'partner_contract_associations',
    'customer segments': 'customer_segments',
    'customer_segments': 'customer_segments',
    'segments': 'customer_segments',
    'sales transactions': 'sales_transactions',
    'sales_transactions': 'sales_transactions',
    'transactions': 'sales_transactions',
  };

  return mapping[name] || name.replace(/\s+/g, '_');
}

async function getAllEntityNames(): Promise<string[]> {
  const entities = await db.select({ technicalName: licenseiqEntities.technicalName }).from(licenseiqEntities);
  return entities.map(e => e.technicalName).filter(Boolean) as string[];
}

async function crossEntitySearch(
  searchTerm: string,
  primaryEntity: string,
  companyId?: string | null
): Promise<ValueMatch | null> {
  const relatedEntities = RELATED_ENTITIES[primaryEntity] || [];
  for (const relatedEntity of relatedEntities) {
    const records = await getEntityRecords(relatedEntity, companyId);
    if (records.length === 0) continue;
    const match = findBestMatch(searchTerm, records, relatedEntity);
    if (match && match.confidence >= 0.7) {
      console.log(`[ValueLinking] Cross-entity match: "${searchTerm}" found in ${relatedEntity} (was mapped to ${primaryEntity}), confidence: ${match.confidence}`);
      return match;
    }
  }

  const allEntities = await getAllEntityNames();
  const searched = new Set([primaryEntity, ...relatedEntities]);
  for (const entity of allEntities) {
    if (searched.has(entity)) continue;
    const records = await getEntityRecords(entity, companyId);
    if (records.length === 0) continue;
    const match = findBestMatch(searchTerm, records, entity);
    if (match && match.confidence >= 0.7) {
      console.log(`[ValueLinking] Global fallback match: "${searchTerm}" found in ${entity} (was mapped to ${primaryEntity}), confidence: ${match.confidence}`);
      return match;
    }
  }

  return null;
}

function extractCleanValues(rawValue: string, termLabel: string): string[] {
  const candidates: string[] = [rawValue];

  if (termLabel && rawValue.toLowerCase() !== termLabel.toLowerCase()) {
    const labelPatterns = [
      termLabel,
      termLabel.replace(/\s+/g, '\\s*[\\*\\-:;,\\.]*\\s*'),
    ];
    for (const pattern of labelPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        const cleaned = rawValue.replace(regex, '').replace(/^[\s\*\-:;,\.]+|[\s\*\-:;,\.]+$/g, '').trim();
        if (cleaned && cleaned.length >= 1 && cleaned !== rawValue) {
          candidates.push(cleaned);
        }
      } catch {}
    }

    const lowerRaw = rawValue.toLowerCase();
    const lowerLabel = termLabel.toLowerCase();
    if (lowerRaw.startsWith(lowerLabel)) {
      const after = rawValue.substring(termLabel.length).replace(/^[\s\*\-:;,\.]+/, '').trim();
      if (after && after.length >= 1) candidates.push(after);
    }
    if (lowerRaw.endsWith(lowerLabel)) {
      const before = rawValue.substring(0, rawValue.length - termLabel.length).replace(/[\s\*\-:;,\.]+$/, '').trim();
      if (before && before.length >= 1) candidates.push(before);
    }
  }

  const separators = /[\-–—:;|\/\\,]\s*/;
  if (separators.test(rawValue)) {
    const parts = rawValue.split(separators).map(p => p.trim()).filter(p => p.length >= 1);
    for (const part of parts) {
      if (part.toLowerCase() !== termLabel.toLowerCase() && !candidates.includes(part)) {
        candidates.push(part);
      }
    }
  }

  const quoted = rawValue.match(/["'""''`]([^"'""''`]+)["'""''`]/);
  if (quoted && quoted[1]) candidates.push(quoted[1].trim());

  const kvPattern = /([A-Za-z][A-Za-z\s\/]*)\*\s*([^.*]+)/g;
  let kvMatch;
  const kvPairs: Array<{ label: string; value: string }> = [];
  while ((kvMatch = kvPattern.exec(rawValue)) !== null) {
    const kvLabel = kvMatch[1].trim();
    const kvValue = kvMatch[2].trim().replace(/\.\s*$/, '');
    if (kvValue && kvValue.length >= 1) {
      kvPairs.push({ label: kvLabel, value: kvValue });
      if (!candidates.includes(kvValue)) candidates.push(kvValue);
    }
  }

  if (kvPairs.length >= 2) {
    for (const kv of kvPairs) {
      if (!candidates.includes(kv.value)) candidates.push(kv.value);
    }
  }

  const sentenceParts = rawValue.split(/\.\s+/).map(p => p.trim()).filter(p => p.length >= 2);
  if (sentenceParts.length >= 2) {
    for (const part of sentenceParts) {
      const innerKv = part.match(/^([A-Za-z][A-Za-z\s\/]*)\*\s*(.+)$/);
      if (innerKv && innerKv[2]) {
        const val = innerKv[2].trim();
        if (val && !candidates.includes(val)) candidates.push(val);
      } else if (!candidates.includes(part)) {
        candidates.push(part);
      }
    }
  }

  const unique = [...new Set(candidates)];
  return unique;
}

export async function autoLinkMappingValue(
  mapping: {
    id: string;
    originalTerm: string;
    originalValue?: string | null;
    erpEntityName?: string | null;
    erpFieldName?: string | null;
    companyId?: string | null;
  }
): Promise<LinkingResult> {
  try {
    if (!mapping.erpEntityName) {
      return { mappingId: mapping.id, linked: false, error: 'No entity name' };
    }

    const entityTechnicalName = resolveEntityTechnicalName(mapping.erpEntityName);
    if (!entityTechnicalName) {
      return { mappingId: mapping.id, linked: false, error: 'Unknown entity type' };
    }

    const rawSearchTerm = mapping.originalValue || mapping.originalTerm;
    if (!rawSearchTerm || rawSearchTerm.length < 2) {
      return { mappingId: mapping.id, linked: false, error: 'No searchable term' };
    }

    const searchTerms = extractCleanValues(rawSearchTerm, mapping.originalTerm);

    const records = await getEntityRecords(entityTechnicalName, mapping.companyId);
    let match: ValueMatch | null = null;

    for (const searchTerm of searchTerms) {
      if (records.length > 0) {
        const m = findBestMatch(searchTerm, records, entityTechnicalName);
        if (m && (!match || m.confidence > match.confidence)) match = m;
      }

      if (!match || match.confidence < 0.5) {
        const crossMatch = await crossEntitySearch(searchTerm, entityTechnicalName, mapping.companyId);
        if (crossMatch && (!match || crossMatch.confidence > match.confidence)) {
          match = crossMatch;
        }
      }
      if (match && match.confidence >= 0.8) break;
    }

    if (!match) {
      return { mappingId: mapping.id, linked: false, error: 'No match found in any entity' };
    }

    if (match.confidence >= 0.7) {
      const entityDisplayMap: Record<string, string> = {
        'products': 'Products',
        'product_hierarchy': 'Product Hierarchy',
        'product_classifications': 'Product Classifications',
        'product_attributes': 'Product Attributes',
        'product_bom': 'Product BOM',
        'product_channel_matrix': 'Product-Channel Matrix',
        'product_territory_matrix': 'Product-Territory Matrix',
        'product_packaging_matrix': 'Product Packaging Matrix',
        'partner_master': 'Partner Master',
        'partner_contract_associations': 'Partner-Contract Associations',
        'territory_master': 'Territory Master',
        'sales_channels': 'Sales Channels',
        'company_master': 'Company Master',
        'customers': 'Customers',
        'customer_segments': 'Customer Segments',
        'sales_transactions': 'Sales Transactions',
      };

      const fieldDisplayMap: Record<string, string> = {
        'product_name': 'Product name',
        'product_display_name': 'Product display name',
        'product_code': 'Product code',
        'product_category': 'Product category',
        'sku': 'Stock Keeping Unit code',
        'hierarchy_value': 'Hierarchy value',
        'level_name': 'Level name',
        'hierarchy_code': 'Hierarchy code',
        'partner_name': 'Partner display name',
        'partner_id': 'Unique partner identifier',
        'partner_code': 'Partner code',
        'primary_contact_name': 'Primary contact name',
        'legal_entity_name': 'Legal entity name',
        'territory_name': 'Territory name',
        'territory_code': 'Territory code',
        'region': 'Region',
        'country': 'Country',
        'channel_name': 'Channel name',
        'channel_code': 'Channel code',
        'channel_type': 'Channel type',
        'customer_name': 'Customer name',
        'customer_code': 'Customer code',
        'segment_name': 'Segment name',
        'segment_code': 'Segment code',
        'company_name': 'Company name',
        'classification_value': 'Classification value',
        'attribute_name': 'Attribute name',
        'attribute_value': 'Attribute value',
      };

      const updateData: any = {
        erpRecordId: match.recordId,
        erpRecordValue: match.recordValue,
        erpRecordTable: match.recordTable,
      };

      if (match.recordTable !== entityTechnicalName) {
        updateData.erpEntityName = entityDisplayMap[match.recordTable] || match.recordTable;
        console.log(`[ValueLinking] Entity corrected: "${mapping.erpEntityName}" → "${updateData.erpEntityName}" for term "${mapping.originalTerm}"`);
      }

      if (match.matchedField) {
        const fieldDisplay = fieldDisplayMap[match.matchedField] || match.matchedField.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        updateData.erpFieldName = fieldDisplay;
        console.log(`[ValueLinking] Field corrected: "${mapping.erpFieldName}" → "${fieldDisplay}" for term "${mapping.originalTerm}" (matched on ${match.matchedField})`);
      }

      await db.update(pendingTermMappings)
        .set(updateData)
        .where(eq(pendingTermMappings.id, mapping.id));

      return { mappingId: mapping.id, linked: true, match };
    }

    return { mappingId: mapping.id, linked: false, match, error: 'Match confidence too low' };
  } catch (error: any) {
    return { mappingId: mapping.id, linked: false, error: error.message };
  }
}

export async function autoLinkAllMappings(
  contractId?: string,
  companyId?: string
): Promise<{ total: number; linked: number; skipped: number; errors: number; results: LinkingResult[] }> {
  const conditions: any[] = [];

  if (contractId) conditions.push(eq(pendingTermMappings.contractId, contractId));
  if (companyId) conditions.push(eq(pendingTermMappings.companyId, companyId));

  conditions.push(sql`(${pendingTermMappings.erpRecordId} IS NULL OR ${pendingTermMappings.erpRecordId} = '')`);
  conditions.push(sql`${pendingTermMappings.erpEntityName} IS NOT NULL`);

  const mappings = await db.select().from(pendingTermMappings)
    .where(and(...conditions));

  const results: LinkingResult[] = [];
  let linked = 0;
  let skipped = 0;
  let errors = 0;

  for (const mapping of mappings) {
    const result = await autoLinkMappingValue({
      id: mapping.id,
      originalTerm: mapping.originalTerm || '',
      originalValue: mapping.originalValue,
      erpEntityName: mapping.erpEntityName,
      erpFieldName: mapping.erpFieldName,
      companyId: mapping.companyId,
    });

    results.push(result);
    if (result.linked) linked++;
    else if (result.error) errors++;
    else skipped++;
  }

  console.log(`[ValueLinking] Processed ${mappings.length} mappings: ${linked} linked, ${skipped} skipped, ${errors} errors`);
  return { total: mappings.length, linked, skipped, errors, results };
}

export async function autoLinkNewMapping(mappingId: string): Promise<LinkingResult> {
  const [mapping] = await db.select().from(pendingTermMappings)
    .where(eq(pendingTermMappings.id, mappingId))
    .limit(1);

  if (!mapping) {
    return { mappingId, linked: false, error: 'Mapping not found' };
  }

  if (mapping.erpRecordId) {
    return { mappingId, linked: true, match: {
      recordId: mapping.erpRecordId,
      recordValue: mapping.erpRecordValue || '',
      recordTable: mapping.erpRecordTable || '',
      confidence: 1.0,
      matchMethod: 'exact',
      matchedField: 'existing',
    }};
  }

  return autoLinkMappingValue({
    id: mapping.id,
    originalTerm: mapping.originalTerm || '',
    originalValue: mapping.originalValue,
    erpEntityName: mapping.erpEntityName,
    erpFieldName: mapping.erpFieldName,
    companyId: mapping.companyId,
  });
}
