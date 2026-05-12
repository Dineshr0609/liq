import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DualTerminologyBadge } from "@/components/DualTerminologyBadge";
import { LinkedValueBadge } from "@/components/LinkedValueBadge";
import { lookupMapping, type MappingInfo } from "@/hooks/useErpValueMap";

interface TableData {
  columns: string[];
  rows: Array<Record<string, any>>;
}

interface FieldMappings {
  volumeField?: string;
  rateField?: string;
  minimumField?: string;
  descriptionField?: string;
}

interface DynamicTableRendererProps {
  tableData: TableData;
  ruleName?: string;
  fieldMappings?: FieldMappings;
  onFieldMappingsChange?: (mappings: FieldMappings) => void;
  showMappingUI?: boolean;
  isEditable?: boolean;
  className?: string;
  erpValueMap?: Map<string, string>;
  erpMappingInfoMap?: Map<string, MappingInfo>;
}

const CALCULATION_FIELDS = [
  { key: 'volumeField', label: 'Volume/Threshold', description: 'Sales volume, purchases, or quantity for tier matching', color: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' },
  { key: 'rateField', label: 'Rate/Percentage', description: 'The rate, percentage, or fee to apply', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { key: 'minimumField', label: 'Minimum Payment', description: 'Optional minimum payment amount', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { key: 'descriptionField', label: 'Description', description: 'Optional description or label field', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
] as const;

function autoDetectMappings(columns: string[]): FieldMappings {
  const mappings: FieldMappings = {};
  
  for (const col of columns) {
    const lowerCol = col.toLowerCase();
    
    if (!mappings.volumeField && (
      lowerCol.includes('volume') ||
      lowerCol.includes('sales') ||
      lowerCol.includes('purchases') ||
      lowerCol.includes('quantity') ||
      lowerCol.includes('threshold') ||
      lowerCol.includes('range') ||
      lowerCol.includes('tier') ||
      lowerCol.includes('net') && !lowerCol.includes('rate')
    )) {
      mappings.volumeField = col;
    }
    
    if (!mappings.rateField && (
      lowerCol.includes('rate') ||
      lowerCol.includes('percent') ||
      lowerCol.includes('%') ||
      lowerCol.includes('contract fee') ||
      lowerCol.includes('rebate') ||
      lowerCol.includes('commission') ||
      lowerCol.includes('fee') && !lowerCol.includes('minimum')
    )) {
      mappings.rateField = col;
    }
    
    if (!mappings.minimumField && (
      lowerCol.includes('minimum') ||
      lowerCol.includes('min ') ||
      lowerCol.includes('floor') ||
      lowerCol.includes('guarantee')
    )) {
      mappings.minimumField = col;
    }
    
    if (!mappings.descriptionField && (
      lowerCol.includes('description') ||
      lowerCol.includes('product') ||
      lowerCol.includes('category') ||
      lowerCol.includes('name') ||
      lowerCol.includes('type')
    )) {
      mappings.descriptionField = col;
    }
  }
  
  return mappings;
}

function getColumnMappingBadge(column: string, mappings: FieldMappings): { label: string; color: string } | null {
  for (const field of CALCULATION_FIELDS) {
    if (mappings[field.key as keyof FieldMappings] === column) {
      return { label: field.label, color: field.color };
    }
  }
  return null;
}

function getLicenseIQFieldForColumn(column: string, mappings: FieldMappings): { field: string; entity: string } | null {
  const lowerCol = column.toLowerCase();
  
  // Priority 1: Check explicit field mappings first
  if (mappings.volumeField === column) {
    return { field: 'quantity', entity: 'Sales' };
  }
  if (mappings.rateField === column) {
    return { field: 'rate_percentage', entity: 'Rules' };
  }
  
  // Priority 2: Cost/price/amount fields (check BEFORE item names to avoid "Cost per Plant" → item)
  if (lowerCol.includes('cost') || lowerCol.includes('price') || lowerCol.includes('amount') || lowerCol.includes('investment') || lowerCol.includes('total')) {
    return { field: 'net_amount', entity: 'Sales' };
  }
  
  // Priority 3: Rate/percentage fields
  if (lowerCol.includes('rate') || lowerCol.includes('percent') || lowerCol.includes('fee') || lowerCol.includes('contract fee')) {
    return { field: 'rate_percentage', entity: 'Rules' };
  }
  
  // Priority 4: Quantity/volume fields (but not if it also contains price-like words)
  if ((lowerCol.includes('quantity') || lowerCol.includes('volume') || lowerCol.includes('stock') || lowerCol.includes('units')) && 
      !lowerCol.includes('cost') && !lowerCol.includes('price')) {
    return { field: 'quantity', entity: 'Sales' };
  }
  
  // Priority 5: Category/class fields
  if (lowerCol.includes('category') || lowerCol.includes('class') || lowerCol.includes('type')) {
    return { field: 'item_class', entity: 'Items' };
  }
  
  // Priority 6: Item/product names (check LAST as many columns contain "plant" or "item" as qualifiers)
  // Only match if it's primarily an item name column (variety, product, item, sku)
  if (lowerCol.includes('variety') || lowerCol.includes('product') || 
      (lowerCol.includes('item') && !lowerCol.includes('cost') && !lowerCol.includes('price')) ||
      lowerCol === 'plant' || lowerCol === 'sku' || lowerCol === 'name') {
    return { field: 'item_name', entity: 'Items' };
  }
  
  return null;
}

function getEntityTypeForColumn(column: string): 'item' | 'vendor' | 'category' | null {
  const lowerCol = column.toLowerCase();
  
  if (lowerCol.includes('product') || lowerCol.includes('item') || lowerCol.includes('variety') || lowerCol.includes('plant') || lowerCol.includes('sku')) {
    return 'item';
  }
  if (lowerCol.includes('vendor') || lowerCol.includes('supplier') || lowerCol.includes('licensor')) {
    return 'vendor';
  }
  if (lowerCol.includes('category') || lowerCol.includes('class') || lowerCol.includes('type') || lowerCol.includes('group')) {
    return 'category';
  }
  return null;
}

function isLinkableValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return false;
  const strValue = String(value).trim();
  if (strValue === '' || strValue === '-') return false;
  if (/^\$?[\d,]+(\.\d+)?%?$/.test(strValue)) return false;
  if (/^\d+\s*(mother plants|divisions|units|pieces|each)$/i.test(strValue)) return false;
  return strValue.length > 2;
}

export function DynamicTableRenderer({
  tableData,
  ruleName,
  fieldMappings,
  onFieldMappingsChange,
  showMappingUI = false,
  isEditable = false,
  className = "",
  erpValueMap,
  erpMappingInfoMap
}: DynamicTableRendererProps) {
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [localMappings, setLocalMappings] = useState<FieldMappings>(() => 
    fieldMappings || autoDetectMappings(tableData.columns)
  );
  
  useEffect(() => {
    if (fieldMappings) {
      setLocalMappings(fieldMappings);
    }
  }, [fieldMappings]);

  if (!tableData || !tableData.columns || !tableData.rows) {
    return (
      <div className="text-muted-foreground text-sm p-4 border rounded bg-muted/30">
        No table data available
      </div>
    );
  }

  const { columns, rows } = tableData;

  const handleMappingChange = (fieldKey: string, columnName: string | null) => {
    const newMappings = { ...localMappings };
    if (columnName === null || columnName === "none") {
      delete newMappings[fieldKey as keyof FieldMappings];
    } else {
      newMappings[fieldKey as keyof FieldMappings] = columnName;
    }
    setLocalMappings(newMappings);
    onFieldMappingsChange?.(newMappings);
  };

  const handleAutoDetect = () => {
    const detected = autoDetectMappings(columns);
    setLocalMappings(detected);
    onFieldMappingsChange?.(detected);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {showMappingUI && isEditable && (
        <Collapsible open={isMappingOpen} onOpenChange={setIsMappingOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-toggle-field-mappings">
                <Settings className="h-4 w-4" />
                Field Mappings
                {isMappingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={handleAutoDetect} className="gap-1" data-testid="button-auto-detect-mappings">
              Auto-detect
            </Button>
          </div>
          <CollapsibleContent className="mt-3">
            <Card className="border-dashed">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Map Table Columns to Calculation Fields</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CALCULATION_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-sm font-medium">{field.label}</label>
                      <Select
                        value={localMappings[field.key as keyof FieldMappings] || "none"}
                        onValueChange={(value) => handleMappingChange(field.key, value)}
                      >
                        <SelectTrigger className="h-9" data-testid={`select-mapping-${field.key}`}>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Not mapped --</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="overflow-x-auto border rounded-lg" data-testid="table-dynamic-extracted">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column, idx) => {
                const mappingBadge = getColumnMappingBadge(column, localMappings);
                return (
                  <TableHead key={idx} className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{column}</span>
                      {/* Only show calculation field badges (Volume/Rate/etc) - these indicate how the column is used in calculations */}
                      {mappingBadge && (
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${mappingBadge.color}`}>
                          {mappingBadge.label}
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No data rows
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIdx) => (
                <TableRow key={rowIdx} className="hover:bg-muted/30">
                  {columns.map((column, colIdx) => {
                    const value = row[column];
                    const mappingBadge = getColumnMappingBadge(column, localMappings);
                    const entityType = getEntityTypeForColumn(column);
                    const shouldShowLink = entityType && isLinkableValue(value);
                    
                    let displayValue: string;
                    if (value === null || value === undefined) {
                      displayValue = '-';
                    } else if (typeof value === 'number') {
                      if (value >= 1000000) {
                        displayValue = `$${(value / 1000000).toFixed(1)}M`;
                      } else if (value >= 1000) {
                        displayValue = `$${value.toLocaleString()}`;
                      } else if (value < 1 && value > 0) {
                        displayValue = `${(value * 100).toFixed(1)}%`;
                      } else {
                        displayValue = value.toString();
                      }
                    } else {
                      displayValue = String(value);
                    }
                    
                    const { erpValue, mappingInfo } = erpValueMap 
                      ? lookupMapping(String(value), erpValueMap, erpMappingInfoMap, column)
                      : { erpValue: undefined, mappingInfo: undefined };
                    const hasErpMapping = erpValue && erpValue !== String(value).replace(/[™®©]/g, '').trim();
                    const hasConfirmedLink = !!mappingInfo?.erpRecordId;
                    
                    return (
                      <TableCell 
                        key={colIdx} 
                        className={`whitespace-nowrap ${mappingBadge ? 'font-medium' : ''}`}
                      >
                        {hasErpMapping ? (
                          <div className="flex flex-col">
                            <span className="font-medium inline-flex items-center gap-1">
                              {erpValue}
                              {hasConfirmedLink && (
                                <span className="text-green-600 dark:text-green-400">
                                  <svg className="h-3 w-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              (Contract: {displayValue})
                            </span>
                            {hasConfirmedLink && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                Linked to {mappingInfo?.erpEntityName || 'record'}{mappingInfo?.erpRecordValue ? `: ${mappingInfo.erpRecordValue}` : ''}
                              </span>
                            )}
                          </div>
                        ) : hasConfirmedLink ? (
                          <div className="flex flex-col">
                            <span className="font-medium inline-flex items-center gap-1">
                              {displayValue}
                              <span className="text-green-600 dark:text-green-400">
                                <svg className="h-3 w-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                              </span>
                            </span>
                            <span className="text-xs text-green-600 dark:text-green-400">
                              Linked to {mappingInfo?.erpEntityName || 'record'}{mappingInfo?.erpRecordValue ? `: ${mappingInfo.erpRecordValue}` : ''}
                            </span>
                          </div>
                        ) : shouldShowLink && entityType ? (
                          <LinkedValueBadge
                            value={displayValue}
                            entityType={entityType}
                            linkStatus="pending"
                            variant="compact"
                          />
                        ) : (
                          displayValue
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

export function extractTableDataFromRule(rule: any): TableData | null {
  if (rule.formulaDefinition?.tableData) {
    return rule.formulaDefinition.tableData;
  }
  
  if (rule.calculation?.tableData) {
    return rule.calculation.tableData;
  }
  
  if (rule.volumeTiers && Array.isArray(rule.volumeTiers) && rule.volumeTiers.length > 0) {
    const firstTier = rule.volumeTiers[0];
    const columns = Object.keys(firstTier).filter(k => 
      k !== 'id' && !k.startsWith('_')
    );
    return {
      columns,
      rows: rule.volumeTiers
    };
  }
  
  return null;
}
