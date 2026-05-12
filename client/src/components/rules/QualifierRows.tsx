import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Check, X, Plus } from "lucide-react";
import { useState } from "react";

export interface QualifierDimension {
  entity: string;
  label: string;
  icon: string;
  badgeColor: string;
  formField: string;
  fields: Array<{
    key: string;
    label: string;
    values: () => string[];
  }>;
}

export interface QualifierRow {
  entity: string;
  entityLabel: string;
  entityIcon: string;
  field: string;
  fieldLabel: string;
  condition: string;
  value: string;
  formField: string;
  badgeColor: string;
  matchedMasterData: boolean;
}

function matchValueToDim(cleanValue: string, dims: QualifierDimension[]) {
  let bestDim = dims[0];
  let bestField = dims[0].fields[0];
  let matched = false;
  let displayValue = cleanValue;
  for (const dim of dims) {
    const mf = dim.fields.find(f => {
      const vals = f.values();
      return vals.some((mv: string) => mv.toLowerCase() === cleanValue.toLowerCase());
    });
    if (mf) {
      bestDim = dim; bestField = mf; matched = true;
      const exactVal = mf.values().find((mv: string) => mv.toLowerCase() === cleanValue.toLowerCase());
      if (exactVal) displayValue = exactVal;
      break;
    }
  }
  if (!matched) {
    for (const dim of dims) {
      const mf = dim.fields.find(f => {
        const vals = f.values();
        return vals.some((mv: string) => mv.toLowerCase().includes(cleanValue.toLowerCase()) || cleanValue.toLowerCase().includes(mv.toLowerCase()));
      });
      if (mf) {
        bestDim = dim; bestField = mf; matched = true;
        const partialVal = mf.values().find((mv: string) => cleanValue.toLowerCase().includes(mv.toLowerCase()));
        if (partialVal) displayValue = partialVal;
        break;
      }
    }
  }
  return { bestDim, bestField, matched, displayValue };
}

export function buildQualifierRows(
  editForm: Record<string, any>,
  masterEntities: QualifierDimension[]
): QualifierRow[] {
  const allRows: QualifierRow[] = [];
  const seenValues = new Set<string>();
  const formFieldGroups = new Map<string, QualifierDimension[]>();
  
  masterEntities.forEach(dim => {
    const group = formFieldGroups.get(dim.formField) || [];
    group.push(dim);
    formFieldGroups.set(dim.formField, group);
  });

  const inlineExclusions: string[] = [];
  
  formFieldGroups.forEach((dims, formField) => {
    const vals: string[] = editForm[formField] || [];
    vals.forEach((v: string) => {
      if (v === 'General') return;
      if (v.startsWith('!')) {
        if (formField === 'productCategories') inlineExclusions.push(v.substring(1));
        return;
      }
      const valKey = `${formField}:${v}`;
      if (seenValues.has(valKey)) return;
      seenValues.add(valKey);
      const { bestDim, bestField, matched, displayValue } = matchValueToDim(v, dims);
      allRows.push({
        entity: bestDim.entity,
        entityLabel: bestDim.label,
        entityIcon: bestDim.icon,
        field: bestField?.key || '',
        fieldLabel: bestField?.label || '',
        condition: 'in',
        value: displayValue,
        formField: formField,
        badgeColor: bestDim.badgeColor,
        matchedMasterData: matched,
      });
    });
  });

  const apiExclusions: string[] = editForm.exclusionCategories || [];
  const allExclusions = [...new Set([...apiExclusions, ...inlineExclusions])];
  const productDims = formFieldGroups.get('productCategories') || [masterEntities[0]];
  
  allExclusions.forEach((excVal: string) => {
    const valKey = `exclusion:${excVal}`;
    if (seenValues.has(valKey)) return;
    seenValues.add(valKey);
    const { bestDim, bestField, matched, displayValue } = matchValueToDim(excVal, productDims);
    allRows.push({
      entity: bestDim.entity,
      entityLabel: bestDim.label,
      entityIcon: bestDim.icon,
      field: bestField?.key || '',
      fieldLabel: bestField?.label || '',
      condition: 'not_in',
      value: displayValue,
      formField: 'exclusionCategories',
      badgeColor: 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      matchedMasterData: matched,
    });
  });

  return allRows;
}

interface QualifierTableProps {
  rows: QualifierRow[];
  masterEntities: QualifierDimension[];
  onRemove: (formField: string, value: string, condition?: string) => void;
  onAdd: (entity: string, field: string, value: string, condition: string) => void;
  onUpdate: (oldRow: QualifierRow, newEntity: string, newField: string, newValue: string, newCondition: string) => void;
}

export function QualifierTable({ rows, masterEntities, onRemove, onAdd, onUpdate }: QualifierTableProps) {
  const [addEntity, setAddEntity] = useState('');
  const [addField, setAddField] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addCondition, setAddCondition] = useState('in');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editEntity, setEditEntity] = useState('');
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editCondition, setEditCondition] = useState('in');

  const selectedEntity = masterEntities.find(e => e.entity === addEntity);
  const selectedFieldDef = selectedEntity?.fields.find(f => f.key === addField);
  const fieldOptions = selectedFieldDef?.values() || [];

  const editSelectedEntity = masterEntities.find(e => e.entity === editEntity);
  const editSelectedField = editSelectedEntity?.fields.find(f => f.key === editField);
  const editFieldOptions = editSelectedField?.values() || [];

  const handleAdd = () => {
    if (!selectedEntity || !addValue) return;
    onAdd(addEntity, addField, addValue, addCondition);
    setAddValue('');
  };

  const startEdit = (idx: number, row: QualifierRow) => {
    setEditIdx(idx);
    setEditEntity(row.entity);
    setEditField(row.field);
    setEditCondition(row.condition);
    setEditValue(row.value);
  };

  const saveEdit = (oldRow: QualifierRow) => {
    onUpdate(oldRow, editEntity, editField, editValue, editCondition);
    setEditIdx(null);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-44">Master Data Entity</TableHead>
            <TableHead className="w-40">Field</TableHead>
            <TableHead className="w-28">Condition</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-28">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-orange-50/30 dark:bg-orange-950/10">
            <TableCell>
              <Select value={addEntity} onValueChange={(v) => { setAddEntity(v); setAddField(''); setAddValue(''); }}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-rm-qual-entity"><SelectValue placeholder="Select entity..." /></SelectTrigger>
                <SelectContent>
                  {masterEntities.map(e => (
                    <SelectItem key={e.entity} value={e.entity}>
                      <span className="flex items-center gap-2">{e.icon} {e.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={addField} onValueChange={(v) => { setAddField(v); setAddValue(''); }} disabled={!addEntity}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-rm-qual-field"><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent>
                  {selectedEntity?.fields.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={addCondition} onValueChange={setAddCondition}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="not_in">not in</SelectItem>
                  <SelectItem value="equals">equals</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              {addField && fieldOptions.length > 0 ? (
                <Select value={addValue} onValueChange={setAddValue} disabled={!addEntity || !addField}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-rm-qual-value"><SelectValue placeholder="Select entity & field first" /></SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((opt: string) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={addValue} onChange={(e) => setAddValue(e.target.value)} placeholder="Select entity & field first" className="h-8 text-sm" disabled={!addEntity || !addField} data-testid="input-rm-qual-value" />
              )}
            </TableCell>
            <TableCell>
              <Button size="sm" className="h-7 gap-1 bg-orange-600 hover:bg-orange-700" onClick={handleAdd} disabled={!addValue} data-testid="button-add-rm-qual">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </TableCell>
          </TableRow>

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                No qualifiers defined — rule applies to all dimensions
              </TableCell>
            </TableRow>
          )}

          {rows.map((row, idx) => (
            editIdx === idx ? (
              <TableRow key={`edit-${idx}`} className="bg-orange-50/50 dark:bg-orange-950/10" data-testid={`row-rm-qual-edit-${idx}`}>
                <TableCell>
                  <Select value={editEntity} onValueChange={(v) => { setEditEntity(v); setEditField(''); setEditValue(''); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {masterEntities.map(e => (
                        <SelectItem key={e.entity} value={e.entity}>
                          <span className="flex items-center gap-2">{e.icon} {e.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={editField} onValueChange={(v) => { setEditField(v); setEditValue(''); }} disabled={!editEntity}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Field..." /></SelectTrigger>
                    <SelectContent>
                      {editSelectedEntity?.fields.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={editCondition} onValueChange={setEditCondition}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">in</SelectItem>
                      <SelectItem value="not_in">not in</SelectItem>
                      <SelectItem value="equals">equals</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {editField && editFieldOptions.length > 0 ? (
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select value..." /></SelectTrigger>
                      <SelectContent>
                        {editFieldOptions.map((opt: string) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 text-sm" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 px-2 bg-green-600 hover:bg-green-700" onClick={() => saveEdit(row)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditIdx(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={`${row.entity}-${row.field}-${row.value}-${idx}`} data-testid={`row-rm-qual-${idx}`}>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span>{row.entityIcon}</span> {row.entityLabel}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.fieldLabel}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${row.condition === 'not_in' ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400' : ''}`}>
                    {row.condition === 'not_in' ? 'not in' : row.condition}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`text-sm ${row.badgeColor}`}>{row.value}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(idx, row)} data-testid={`button-edit-rm-qual-${idx}`}>
                      <Edit className="h-3 w-3 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(row.formField, row.value, row.condition)} data-testid={`button-remove-rm-qual-${idx}`}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
