import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Settings, Plus, Trash2, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TableData {
  columns: string[];
  rows: Array<Record<string, any>>;
}

interface FieldMappings {
  [key: string]: string | undefined;
}

interface CalculationFieldType {
  id: string;
  contractTypeCode: string;
  fieldCode: string;
  fieldName: string;
  fieldCategory: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number | null;
  defaultColumnPatterns: string[] | null;
  dataType: string;
}

interface EditableTableRendererProps {
  tableData: TableData;
  ruleName?: string;
  fieldMappings?: FieldMappings;
  contractType?: string;
  contractId?: string;
  ruleId?: string;
  onTableDataChange?: (tableData: TableData) => void;
  onFieldMappingsChange?: (mappings: FieldMappings) => void;
  showMappingUI?: boolean;
  className?: string;
}

const FALLBACK_CALCULATION_FIELDS = [
  { fieldCode: 'volume', fieldName: 'Volume/Threshold', description: 'Column containing volume ranges or thresholds', defaultColumnPatterns: ['volume', 'sales', 'units', 'threshold', 'tier', 'quantity'], fieldCategory: 'threshold', isRequired: false },
  { fieldCode: 'rate', fieldName: 'Rate/Fee', description: 'Column containing rates, fees, or percentages', defaultColumnPatterns: ['rate', 'contract fee', 'fee', 'price', 'percent', '%'], fieldCategory: 'rate', isRequired: true },
  { fieldCode: 'basis', fieldName: 'Calculation Basis', description: 'What the rate applies against (e.g. Net Sales, Gross Revenue)', defaultColumnPatterns: ['basis', 'applied', 'calculation', 'net sales', 'gross'], fieldCategory: 'basis', isRequired: false },
  { fieldCode: 'minimum', fieldName: 'Minimum Payment', description: 'Column containing minimum payment amounts', defaultColumnPatterns: ['minimum', 'min', 'guarantee', 'floor'], fieldCategory: 'constraint', isRequired: false },
  { fieldCode: 'description', fieldName: 'Description/Label', description: 'Column containing tier descriptions or labels', defaultColumnPatterns: ['description', 'name', 'category', 'product', 'label', 'tier'], fieldCategory: 'modifier', isRequired: false },
];

function autoDetectMappings(columns: string[], fieldTypes: Array<{ fieldCode: string; defaultColumnPatterns: string[] | null }>): FieldMappings {
  const mappings: FieldMappings = {};
  const lowerColumns = columns.map(c => c.toLowerCase());
  
  fieldTypes.forEach(field => {
    const patterns = field.defaultColumnPatterns || [];
    columns.forEach((col, idx) => {
      const lower = lowerColumns[idx];
      if (!mappings[field.fieldCode] && patterns.some(pattern => lower.includes(pattern.toLowerCase()))) {
        mappings[field.fieldCode] = col;
      }
    });
  });
  
  return mappings;
}

const CATEGORY_COLORS: Record<string, string> = {
  basis: 'bg-green-500',
  rate: 'bg-orange-600',
  threshold: 'bg-amber-500',
  modifier: 'bg-purple-500',
  constraint: 'bg-orange-500',
  description: 'bg-purple-500',
};

function getColumnMappingBadge(column: string, mappings: FieldMappings, fieldTypes: Array<{ fieldCode: string; fieldName: string; fieldCategory: string }>): { label: string; color: string } | null {
  for (const field of fieldTypes) {
    if (mappings[field.fieldCode] === column) {
      const color = CATEGORY_COLORS[field.fieldCategory] || 'bg-gray-500';
      const shortLabel = field.fieldName.split('/')[0].split(' ')[0];
      return { label: shortLabel, color };
    }
  }
  return null;
}

export function EditableTableRenderer({
  tableData,
  ruleName,
  fieldMappings,
  contractType = 'royalty_license',
  contractId,
  ruleId,
  onTableDataChange,
  onFieldMappingsChange,
  showMappingUI = true,
  className = ""
}: EditableTableRendererProps) {
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [localTableData, setLocalTableData] = useState<TableData>(tableData);
  const [isAIDetecting, setIsAIDetecting] = useState(false);
  const [aiDetectSource, setAiDetectSource] = useState<'ai' | 'fallback' | 'pattern' | null>(null);
  
  const { data: fieldTypesData, isLoading: fieldTypesLoading } = useQuery<CalculationFieldType[]>({
    queryKey: [`/api/calculation-field-types/${contractType}`],
    enabled: !!contractType,
  });
  
  const calculationFields = fieldTypesData?.length ? fieldTypesData : FALLBACK_CALCULATION_FIELDS as any[];
  
  const [localMappings, setLocalMappings] = useState<FieldMappings>(() => 
    fieldMappings || autoDetectMappings(tableData.columns, calculationFields)
  );
  
  useEffect(() => {
    if (fieldMappings) {
      setLocalMappings(fieldMappings);
    } else if (fieldTypesData?.length) {
      setLocalMappings(autoDetectMappings(tableData.columns, fieldTypesData));
    }
  }, [fieldMappings, fieldTypesData, tableData.columns]);
  
  useEffect(() => {
    setLocalTableData(tableData);
  }, [tableData]);

  if (!localTableData || !localTableData.columns || !localTableData.rows) {
    return (
      <div className="text-muted-foreground text-sm p-4 border rounded bg-muted/30" data-testid="editable-table-empty">
        No table data available for editing.
      </div>
    );
  }

  const { columns, rows } = localTableData;

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

  const handleAutoDetect = async () => {
    if (contractId && ruleId) {
      setIsAIDetecting(true);
      setAiDetectSource(null);
      try {
        const response = await fetch(`/api/contracts/${contractId}/rules/${ruleId}/ai-field-mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            columns,
            sampleRows: localTableData.rows.slice(0, 3),
            ruleName: ruleName || '',
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.mappings && Object.keys(data.mappings).length > 0) {
            const normalizedMappings: FieldMappings = {};
            for (const [key, val] of Object.entries(data.mappings)) {
              const normalizedKey = key.replace('Field', '');
              const fieldCode = calculationFields.find((f: any) => f.fieldCode === normalizedKey || key === `${f.fieldCode}Field`)?.fieldCode || normalizedKey;
              normalizedMappings[fieldCode] = val as string;
            }
            setLocalMappings(normalizedMappings);
            onFieldMappingsChange?.(normalizedMappings);
            setAiDetectSource(data.source || 'ai');
            setIsAIDetecting(false);
            return;
          }
        }
      } catch (err) {
        console.error('AI field mapping detection failed, using pattern matching:', err);
      }
      setIsAIDetecting(false);
    }
    const detected = autoDetectMappings(columns, calculationFields);
    setLocalMappings(detected);
    onFieldMappingsChange?.(detected);
    setAiDetectSource('pattern');
  };

  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    const newRows = [...localTableData.rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [column]: value };
    const newTableData = { ...localTableData, rows: newRows };
    setLocalTableData(newTableData);
    // IMMEDIATE SYNC: Push changes to parent without requiring explicit save
    onTableDataChange?.(newTableData);
  };

  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => { newRow[col] = ''; });
    const newTableData = { 
      ...localTableData, 
      rows: [...localTableData.rows, newRow] 
    };
    setLocalTableData(newTableData);
    // IMMEDIATE SYNC: Push changes to parent
    onTableDataChange?.(newTableData);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const newRows = localTableData.rows.filter((_, idx) => idx !== rowIndex);
    const newTableData = { ...localTableData, rows: newRows };
    setLocalTableData(newTableData);
    // IMMEDIATE SYNC: Push changes to parent
    onTableDataChange?.(newTableData);
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="editable-table-container">
      {showMappingUI && (
        <Collapsible open={isMappingOpen} onOpenChange={setIsMappingOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-toggle-edit-mappings">
                <Settings className="h-4 w-4" />
                Field Mappings
                {isMappingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {aiDetectSource && (
                <Badge variant="outline" className={`text-xs ${aiDetectSource === 'ai' ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300' : 'bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {aiDetectSource === 'ai' ? '✨ AI Mapped' : 'Pattern Matched'}
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleAutoDetect} 
                className="gap-1" 
                disabled={isAIDetecting}
                data-testid="button-auto-detect-edit"
              >
                {isAIDetecting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI Analyzing...
                  </>
                ) : (
                  <>Auto-detect</>
                )}
              </Button>
            </div>
          </div>
          <CollapsibleContent className="mt-3">
            <Card className="border-dashed">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Map Table Columns to Calculation Fields</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {fieldTypesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading field types...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {calculationFields.map((field) => (
                      <div key={field.fieldCode} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">{field.fieldName}</label>
                          <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[field.fieldCategory] || 'bg-gray-500'} text-white`}>
                            {field.fieldCategory}
                          </Badge>
                          {field.isRequired && <span className="text-red-500 text-xs">*</span>}
                        </div>
                        <Select
                          value={localMappings[field.fieldCode] || "none"}
                          onValueChange={(value) => handleMappingChange(field.fieldCode, value)}
                        >
                          <SelectTrigger className="h-9" data-testid={`select-edit-mapping-${field.fieldCode}`}>
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
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="overflow-x-auto border rounded-lg" data-testid="editable-table-grid">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column, idx) => {
                const mappingBadge = getColumnMappingBadge(column, localMappings, calculationFields);
                return (
                  <TableHead key={idx} className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{column}</span>
                      {mappingBadge && (
                        <Badge className={`${mappingBadge.color} text-white text-xs px-1 py-0`}>
                          {mappingBadge.label}
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-muted/30">
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex} className="p-1">
                    <Input
                      value={row[column] ?? ''}
                      onChange={(e) => handleCellChange(rowIndex, column, e.target.value)}
                      className="h-8 text-sm"
                      data-testid={`input-cell-${rowIndex}-${colIndex}`}
                    />
                  </TableCell>
                ))}
                <TableCell className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-delete-row-${rowIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddRow}
        className="gap-1"
        data-testid="button-add-row"
      >
        <Plus className="h-4 w-4" />
        Add Row
      </Button>

    </div>
  );
}

export { autoDetectMappings, getColumnMappingBadge };
export type { TableData, FieldMappings };
