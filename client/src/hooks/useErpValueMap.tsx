import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface TermMapping {
  originalTerm: string;
  originalValue: string | null;
  erpRecordValue: string | null;
  erpRecordId: string | null;
  erpFieldName: string | null;
  erpEntityName: string | null;
  erpRecordTable: string | null;
  status: string;
}

interface TermMappingsResponse {
  mappings: TermMapping[];
  companyId?: string;
}

export interface MappingInfo {
  erpRecordValue: string;
  erpRecordId?: string | null;
  erpEntityName?: string | null;
  erpFieldName?: string | null;
  erpRecordTable?: string | null;
}

const normalizeKey = (value: string) => value.replace(/[™®©]/g, '').replace(/[\u2013\u2014\u2015\u2212]/g, '-').trim().toLowerCase();

function addMappingToMap(
  valueMap: Map<string, string>,
  infoMap: Map<string, MappingInfo>,
  mapping: TermMapping
) {
  if (mapping.status !== 'confirmed' && mapping.status !== 'modified') return;

  const displayValue = mapping.erpRecordValue || mapping.originalTerm || '';
  if (!displayValue) return;

  const info: MappingInfo = {
    erpRecordValue: mapping.erpRecordValue || displayValue,
    erpRecordId: mapping.erpRecordId,
    erpEntityName: mapping.erpEntityName,
    erpFieldName: mapping.erpFieldName,
    erpRecordTable: mapping.erpRecordTable,
  };

  const fieldPrefix = mapping.erpFieldName ? `${normalizeFieldName(mapping.erpFieldName)}::` : '';

  if (mapping.originalTerm) {
    const normalized = normalizeKey(mapping.originalTerm);
    const fieldKey = fieldPrefix ? `${fieldPrefix}${normalized}` : null;
    if (fieldKey && !valueMap.has(fieldKey)) {
      valueMap.set(fieldKey, displayValue);
    }
    if (fieldKey && !infoMap.has(fieldKey)) {
      infoMap.set(fieldKey, info);
    }
    if (!valueMap.has(normalized)) {
      valueMap.set(normalized, displayValue);
    }
    if (!infoMap.has(normalized)) {
      infoMap.set(normalized, info);
    }
  }
  if (mapping.originalValue) {
    const normalizedVal = normalizeKey(mapping.originalValue);
    const fieldKey = fieldPrefix ? `${fieldPrefix}${normalizedVal}` : null;
    if (fieldKey && !valueMap.has(fieldKey)) {
      valueMap.set(fieldKey, displayValue);
    }
    if (fieldKey && !infoMap.has(fieldKey)) {
      infoMap.set(fieldKey, info);
    }
    if (!valueMap.has(normalizedVal)) {
      valueMap.set(normalizedVal, displayValue);
    }
    if (!infoMap.has(normalizedVal)) {
      infoMap.set(normalizedVal, info);
    }
  }
}

export function useErpValueMap(contractId: string | undefined) {
  const { data: termMappingsData } = useQuery<TermMappingsResponse>({
    queryKey: [`/api/contracts/${contractId}/pending-mappings?status=confirmed`],
    enabled: !!contractId,
  });

  const { data: companyMappingsData } = useQuery<TermMappingsResponse>({
    queryKey: ['/api/company-mappings', 'confirmed'],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'confirmed' });
      const res = await fetch(`/api/company-mappings?${params.toString()}`);
      if (!res.ok) return { mappings: [] };
      return res.json();
    },
  });

  const { erpValueMap, erpMappingInfoMap } = useMemo(() => {
    const valueMap = new Map<string, string>();
    const infoMap = new Map<string, MappingInfo>();
    
    if (termMappingsData?.mappings) {
      for (const mapping of termMappingsData.mappings) {
        addMappingToMap(valueMap, infoMap, mapping);
      }
    }

    if (companyMappingsData?.mappings) {
      for (const mapping of companyMappingsData.mappings) {
        addMappingToMap(valueMap, infoMap, mapping);
      }
    }
    
    return { erpValueMap: valueMap, erpMappingInfoMap: infoMap };
  }, [termMappingsData?.mappings, companyMappingsData?.mappings]);

  const getErpDisplayValue = useCallback((contractValue: string): { erpValue: string | null; contractTerm: string; mappingInfo: MappingInfo | null } => {
    if (!contractValue) return { erpValue: null, contractTerm: contractValue, mappingInfo: null };
    const key = normalizeKey(contractValue);
    const erpValue = erpValueMap.get(key);
    const mappingInfo = erpMappingInfoMap.get(key) || null;
    return { erpValue: erpValue || null, contractTerm: contractValue, mappingInfo };
  }, [erpValueMap, erpMappingInfoMap]);

  return { erpValueMap, erpMappingInfoMap, getErpDisplayValue, termMappingsData };
}

const normalizeForLookup = (val: any) => String(val ?? '').replace(/[™®©]/g, '').replace(/[\u2013\u2014\u2015\u2212]/g, '-').trim().toLowerCase();

const normalizeFieldName = (col: string) => col.replace(/\s+/g, '_').toLowerCase();

const FIELD_GROUPS: Record<string, string[]> = {
  name: ['product_name', 'item_name', 'name', 'product', 'item', 'partner', 'vendor', 'partner_name', 'vendor_name'],
  category: ['category', 'product_category', 'item_class', 'classification', 'subcategory'],
  family: ['product_family', 'family', 'series', 'product_line', 'line'],
  status: ['status', 'product_status', 'item_status', 'vendor_status'],
  territory: ['territory', 'territory_name', 'region', 'country', 'country_name', 'state'],
};

function getFieldGroup(fieldName: string): string | null {
  const norm = normalizeFieldName(fieldName);
  for (const [group, members] of Object.entries(FIELD_GROUPS)) {
    if (members.includes(norm)) return group;
  }
  return null;
}

export function lookupMapping(
  value: string,
  erpValueMap: Map<string, string>,
  erpMappingInfoMap?: Map<string, MappingInfo>,
  columnFieldName?: string
): { erpValue: string | undefined; mappingInfo: MappingInfo | undefined } {
  const normalized = normalizeForLookup(value);
  
  const fieldKey = columnFieldName ? `${normalizeFieldName(columnFieldName)}::${normalized}` : null;
  if (fieldKey) {
    const ev = erpValueMap.get(fieldKey);
    const mi = erpMappingInfoMap?.get(fieldKey);
    if (ev || mi) {
      return { erpValue: ev, mappingInfo: mi };
    }
  }
  
  const genericErpValue = erpValueMap.get(normalized);
  const genericInfo = erpMappingInfoMap?.get(normalized);
  
  if (columnFieldName && genericInfo?.erpFieldName && !genericInfo?.erpRecordId) {
    const colGroup = getFieldGroup(columnFieldName);
    const mappingGroup = getFieldGroup(genericInfo.erpFieldName);
    if (colGroup && mappingGroup && colGroup !== mappingGroup) {
      return { erpValue: undefined, mappingInfo: undefined };
    }
  }
  
  return { erpValue: genericErpValue, mappingInfo: genericInfo };
}

export function ErpValueDisplay({ 
  value, 
  erpValueMap,
  erpMappingInfoMap,
  columnFieldName
}: { 
  value: string; 
  erpValueMap: Map<string, string>;
  erpMappingInfoMap?: Map<string, MappingInfo>;
  columnFieldName?: string;
}) {
  if (!value) return <span>-</span>;
  
  const { erpValue, mappingInfo } = lookupMapping(value, erpValueMap, erpMappingInfoMap, columnFieldName);
  const normalized = normalizeForLookup(value);
  const hasErpMapping = erpValue && erpValue !== normalized;
  const hasConfirmedLink = !!mappingInfo?.erpRecordId;
  const hasFieldMapping = !!mappingInfo?.erpFieldName;
  
  if (hasErpMapping) {
    return (
      <div className="flex flex-col">
        <span className="font-medium inline-flex items-center gap-1">
          {erpValue}
          {hasConfirmedLink && (
            <span className="inline-flex items-center text-green-600 dark:text-green-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          (Contract: {value})
        </span>
        {hasConfirmedLink && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Linked to {mappingInfo?.erpEntityName || 'record'}{mappingInfo?.erpRecordValue ? `: ${mappingInfo.erpRecordValue}` : ''}
          </span>
        )}
      </div>
    );
  }
  
  if (hasConfirmedLink) {
    return (
      <div className="flex flex-col">
        <span className="font-medium inline-flex items-center gap-1">
          {value}
          <span className="inline-flex items-center text-green-600 dark:text-green-400">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          </span>
        </span>
        <span className="text-xs text-green-600 dark:text-green-400">
          Linked to {mappingInfo?.erpEntityName || 'record'}{mappingInfo?.erpRecordValue ? `: ${mappingInfo.erpRecordValue}` : ''}
        </span>
      </div>
    );
  }

  if (hasFieldMapping) {
    return (
      <div className="flex flex-col">
        <span className="font-medium inline-flex items-center gap-1">
          {value}
          <span className="inline-flex items-center text-orange-700 dark:text-orange-500">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          </span>
        </span>
        <span className="text-xs text-orange-700 dark:text-orange-500">
          Mapped to {mappingInfo?.erpEntityName ? `${mappingInfo.erpEntityName} → ` : ''}{mappingInfo.erpFieldName}
        </span>
      </div>
    );
  }
  
  return <span>{value}</span>;
}
