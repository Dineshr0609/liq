import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { ApprovalWorkflowsConfig } from "@/components/finance/approval-workflows-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Building2, 
  Globe, 
  FileText, 
  Workflow, 
  Palette, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Check,
  X,
  DollarSign,
  Calendar,
  Database,
  CreditCard,
  Info,
  ArrowDown,
  Layers,
  Receipt,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  CLAIM_TYPES,
  SETTLEMENT_DIRECTIONS,
  SETTLEMENT_DOCUMENT_TYPES,
  BUILT_IN_DOCUMENT_TYPE_MATRIX,
  lookupDocumentTypeMatrixRow,
  type ClaimTypeCode,
  type SettlementDirection,
  type SettlementDocumentType,
  type DocumentTypeMatrix,
  type DocumentTypeMatrixRow,
} from "@shared/schema";

type FinancialPolicies = {
  cutoffPolicy?: string;
  roundingPrecision?: number;
  roundingMethod?: string;
  materialityThreshold?: number;
  fxMethod?: string;
  accrualMode?: string;
  paymentMode?: string;
  revenueRecognition?: string;
};

type PeriodPolicies = {
  fiscalYearStartMonth?: number;
  periodFrequency?: string;
  periodNaming?: string;
  allowBackdating?: boolean;
  lockAfterDays?: number;
  requireApprovalToReopen?: boolean;
};

type DatasetPolicies = {
  completenessThreshold?: number;
  requireCertification?: boolean;
  certificationRoles?: string[];
  allowPartialSubmission?: boolean;
  dataRetentionMonths?: number;
  auditTrailEnabled?: boolean;
};

type SettlementPolicies = {
  defaultPaymentFrequency?: string;
  paymentTermsDays?: number;
  settlementMethod?: string;
  autoSettleEnabled?: boolean;
  autoSettleThreshold?: number;
  glAccountCode?: string;
  apAccountCode?: string;
  arAccountCode?: string;
  accrualAccountCode?: string;
  revenueAccountCode?: string;
  varianceAutoClearEnabled?: boolean;
  varianceMaxAbsAmount?: number;
  varianceMaxPct?: number;
};

type CompanySettings = {
  id: string;
  companyId: string;
  dateFormat: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  fiscalYearStart: number;
  enabledContractTypes: string[];
  allowedRegions: string[];
  requireApprovalWorkflow: boolean;
  approvalLevels: number;
  defaultExtractionApprover: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandLogoUrl: string | null;
  defaultErpSystemId: string | null;
  defaultCalculationApproach: string;
  financialPolicies: FinancialPolicies;
  periodPolicies: PeriodPolicies;
  datasetPolicies: DatasetPolicies;
  settlementPolicies: SettlementPolicies;
  createdAt: string;
  updatedAt: string;
};

type ContractType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystemType: boolean;
  isActive: boolean;
  sortOrder: number;
  financialPolicies: FinancialPolicies | null;
  periodPolicies: PeriodPolicies | null;
  datasetPolicies: DatasetPolicies | null;
  settlementPolicies: SettlementPolicies | null;
  createdAt: string;
};

function TypePolicyField({ label, policyKey, field, companyValue, isOverridden, onClear, children }: {
  label: string;
  policyKey: string;
  field: string;
  companyValue: any;
  isOverridden: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5" data-testid={`type-policy-${policyKey}-${field}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-2">
          {isOverridden ? (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1.5 py-0">
                Overridden
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClear}>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">Revert to company default</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Inherited from Company: <strong>{String(companyValue)}</strong></span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// Task 69 — Document Type Matrix editor.
// Renders the 12 (claim_type, direction) combinations as a grid. The
// "value" prop is the sparse override list (rows that diverge from the
// upstream matrix). The "fallback" prop is the parent matrix (built-in,
// company, or flow-type) used to render the inherited value when a row
// is unset. onChange returns the new sparse rows array — empty rows are
// treated as "inherit upstream" and pruned from the output.
//
// Used at three levels: company default (fallback = built-in), per-flow-type
// override (fallback = company-or-built-in), and per-contract override
// (fallback = flow-type-or-company-or-built-in). Per-flow-type CRUD is
// scoped to inbound + outbound rows that diverge from upstream.
function DocumentTypeMatrixEditor({
  value,
  fallback,
  onChange,
  testIdPrefix,
  readOnly,
}: {
  value: DocumentTypeMatrixRow[];
  fallback: DocumentTypeMatrixRow[];
  onChange: (rows: DocumentTypeMatrixRow[]) => void;
  testIdPrefix: string;
  readOnly?: boolean;
}) {
  const overrideMap = new Map<string, SettlementDocumentType>();
  for (const r of value) overrideMap.set(`${r.claimType}|${r.direction}`, r.documentType);

  const sortRows = (rows: DocumentTypeMatrixRow[]) =>
    [...rows].sort((a, b) =>
      a.claimType === b.claimType ? a.direction.localeCompare(b.direction) : a.claimType.localeCompare(b.claimType));
  const setCell = (claimType: ClaimTypeCode, direction: SettlementDirection, docType: SettlementDocumentType) => {
    const existing = value.find(r => r.claimType === claimType && r.direction === direction);
    const next = value.filter(r => !(r.claimType === claimType && r.direction === direction));
    next.push({ claimType, direction, documentType: docType, notes: existing?.notes ?? null });
    onChange(sortRows(next));
  };
  const setCellNotes = (claimType: ClaimTypeCode, direction: SettlementDirection, notes: string) => {
    const existing = value.find(r => r.claimType === claimType && r.direction === direction);
    if (!existing) return;
    const next = value.filter(r => !(r.claimType === claimType && r.direction === direction));
    next.push({ ...existing, notes: notes.trim() ? notes : null });
    onChange(sortRows(next));
  };
  const clearCell = (claimType: ClaimTypeCode, direction: SettlementDirection) => {
    onChange(value.filter(r => !(r.claimType === claimType && r.direction === direction)));
  };

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`${testIdPrefix}-matrix`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Claim Type</TableHead>
            {SETTLEMENT_DIRECTIONS.map(dir => (
              <TableHead key={dir} className="capitalize">{dir}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {CLAIM_TYPES.map(claimType => (
            <TableRow key={claimType}>
              <TableCell className="font-medium text-sm capitalize">
                {claimType.replace(/_/g, ' ')}
              </TableCell>
              {SETTLEMENT_DIRECTIONS.map(direction => {
                const overrideRow = value.find(r => r.claimType === claimType && r.direction === direction);
                const overrideVal = overrideRow?.documentType;
                const inheritedVal = lookupDocumentTypeMatrixRow(fallback, claimType, direction);
                const effective = overrideVal ?? inheritedVal ?? '';
                const isOverridden = overrideVal !== undefined;
                return (
                  <TableCell key={direction} className="align-top">
                    <div className="space-y-1">
                      <Select
                        value={effective || undefined}
                        onValueChange={(v) => setCell(claimType, direction, v as SettlementDocumentType)}
                        disabled={readOnly}
                      >
                        <SelectTrigger
                          className="h-8 text-xs"
                          data-testid={`${testIdPrefix}-select-${claimType}-${direction}`}
                        >
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {SETTLEMENT_DOCUMENT_TYPES.map(d => (
                            <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        {isOverridden ? (
                          <>
                            <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1.5 py-0">Override</Badge>
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-[10px]"
                                onClick={() => clearCell(claimType, direction)}
                                data-testid={`${testIdPrefix}-reset-${claimType}-${direction}`}
                              >
                                <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Reset
                              </Button>
                            )}
                          </>
                        ) : (
                          <span>Inherited: <strong>{(inheritedVal || '—').replace(/_/g, ' ')}</strong></span>
                        )}
                      </div>
                      {isOverridden && (
                        <Input
                          type="text"
                          value={overrideRow?.notes ?? ''}
                          onChange={(e) => setCellNotes(claimType, direction, e.target.value)}
                          placeholder="Notes (optional)"
                          disabled={readOnly}
                          className="h-7 text-[11px]"
                          data-testid={`${testIdPrefix}-notes-${claimType}-${direction}`}
                        />
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Task 69 — Company-level Document Type Matrix card. Edits the
// `settlementPolicies.documentTypeMatrix.rows` array on companySettings.
// Persisted via the existing PUT /api/settings/company/:companyId path
// when the user clicks the page-level Save button (the page collects
// hasChanges and posts the merged formData).
function DocumentTypeMatrixCompanyCard({
  companyMatrixRows,
  onChangeCompanyMatrix,
}: {
  companyMatrixRows: DocumentTypeMatrixRow[];
  onChangeCompanyMatrix: (rows: DocumentTypeMatrixRow[]) => void;
}) {
  return (
    <Card data-testid="card-document-type-matrix-company">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Settlement Document Type Matrix
        </CardTitle>
        <CardDescription>
          Maps each (claim type, direction) combination to the finance document
          we generate when the claim is approved. Cells you do not override
          inherit from the built-in default matrix. Per-flow-type and
          per-contract overrides cascade on top of these company defaults.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DocumentTypeMatrixEditor
          value={companyMatrixRows}
          fallback={BUILT_IN_DOCUMENT_TYPE_MATRIX}
          onChange={onChangeCompanyMatrix}
          testIdPrefix="company-doctype"
        />
      </CardContent>
    </Card>
  );
}

// Task 69 — Per-flow-type Document Type Matrix override card. Lets admins
// override the (claim_type, direction) → document_type mapping for a
// specific flow type (CRP, VRP, RLA, …). Persisted via the existing PUT
// /api/pipeline/flow-types/:id endpoint, which the route now accepts a
// `documentTypeOverrides` field on.
type FlowTypeRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  documentTypeOverrides: { rows: DocumentTypeMatrixRow[] } | null;
};
function DocumentTypeMatrixFlowTypesCard({
  companyMatrixRows,
}: {
  companyMatrixRows: DocumentTypeMatrixRow[];
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Per-flow-type local edits keyed by flowType.id; only flushed to the
  // server when the user clicks Save on that flow's card.
  const [edits, setEdits] = useState<Record<string, DocumentTypeMatrixRow[]>>({});

  const { data: flowTypesData } = useQuery<FlowTypeRow[]>({
    queryKey: ['/api/pipeline/flow-types'],
  });

  const updateFlowTypeMutation = useMutation({
    mutationFn: async ({ id, documentTypeOverrides }: { id: string; documentTypeOverrides: { rows: DocumentTypeMatrixRow[] } | null }) => {
      const ft = (flowTypesData || []).find(f => f.id === id);
      // PUT replaces the row, so resend the existing fields untouched.
      return await apiRequest('PUT', `/api/pipeline/flow-types/${id}`, {
        code: ft?.code,
        name: ft?.name,
        description: undefined,
        isActive: ft?.isActive,
        documentTypeOverrides,
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/flow-types'] });
      setEdits(prev => {
        const { [vars.id]: _, ...rest } = prev;
        return rest;
      });
      toast({ title: 'Flow Type Saved', description: 'Document type overrides updated.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'Failed to save flow-type override', variant: 'destructive' });
    },
  });

  const flowTypes = (flowTypesData || []).filter(f => f.isActive !== false).sort((a, b) => a.code.localeCompare(b.code));

  // Resolve the upstream "fallback" for a per-flow-type editor — fall back
  // to the company matrix first, then the built-in matrix when the company
  // hasn't overridden a row either.
  const upstreamFallback: DocumentTypeMatrixRow[] = (() => {
    const merged = new Map<string, DocumentTypeMatrixRow>();
    for (const r of BUILT_IN_DOCUMENT_TYPE_MATRIX) merged.set(`${r.claimType}|${r.direction}`, r);
    for (const r of companyMatrixRows) merged.set(`${r.claimType}|${r.direction}`, r);
    return Array.from(merged.values());
  })();

  return (
    <Card data-testid="card-document-type-matrix-flow-types">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="w-5 h-5" />
          Per Flow Type Overrides
        </CardTitle>
        <CardDescription>
          Override the company default matrix for individual flow types
          (CRP, VRP, RLA, etc.). Only diverging rows need to be set —
          unchanged cells continue to inherit from the company matrix above.
          Saved per flow type, immediately when you click Save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {flowTypes.length === 0 && (
          <div className="text-xs text-muted-foreground py-4 text-center">No flow types configured yet.</div>
        )}
        {flowTypes.map(ft => {
          const isOpen = !!expanded[ft.id];
          const persistedRows: DocumentTypeMatrixRow[] = ft.documentTypeOverrides?.rows || [];
          const editedRows = edits[ft.id];
          const currentRows = editedRows ?? persistedRows;
          const hasLocalChanges = editedRows !== undefined;
          const overrideCount = currentRows.length;
          return (
            <div key={ft.id} className="border rounded-lg" data-testid={`flow-type-doctype-${ft.code}`}>
              <button
                type="button"
                onClick={() => setExpanded(prev => ({ ...prev, [ft.id]: !prev[ft.id] }))}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-muted/50"
                data-testid={`button-toggle-flow-doctype-${ft.code}`}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{ft.code}</span>
                  <span className="text-sm">{ft.name}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {overrideCount === 0 ? 'No overrides' : `${overrideCount} override${overrideCount === 1 ? '' : 's'}`}
                </Badge>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t">
                  <DocumentTypeMatrixEditor
                    value={currentRows}
                    fallback={upstreamFallback}
                    onChange={(rows) => setEdits(prev => ({ ...prev, [ft.id]: rows }))}
                    testIdPrefix={`flow-doctype-${ft.code}`}
                  />
                  <div className="flex justify-end gap-2">
                    {hasLocalChanges && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEdits(prev => {
                          const { [ft.id]: _, ...rest } = prev;
                          return rest;
                        })}
                        data-testid={`button-discard-flow-doctype-${ft.code}`}
                      >
                        Discard changes
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={!hasLocalChanges || updateFlowTypeMutation.isPending}
                      onClick={() => updateFlowTypeMutation.mutate({
                        id: ft.id,
                        documentTypeOverrides: currentRows.length === 0 ? null : { rows: currentRows },
                      })}
                      data-testid={`button-save-flow-doctype-${ft.code}`}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {updateFlowTypeMutation.isPending ? 'Saving…' : 'Save flow type'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InheritanceBanner({ level }: { level: 'company' | 'contract_type' | 'contract' }) {
  const levelColors: Record<string, string> = {
    company: 'border-orange-500/30 bg-orange-50 dark:bg-orange-950/20',
    contract_type: 'border-blue-500/30 bg-blue-50 dark:bg-blue-950/20',
    contract: 'border-green-500/30 bg-green-50 dark:bg-green-950/20',
  };
  const levelLabels: Record<string, string> = {
    company: 'Company Level (Global Default)',
    contract_type: 'Contract Type Level (Overrides Company)',
    contract: 'Contract Level (Overrides All)',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${levelColors[level]}`} data-testid={`banner-inheritance-${level}`}>
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-orange-600" />
        <span className="text-sm font-medium">{levelLabels[level]}</span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">
              <strong>3-Tier Inheritance:</strong> Settings cascade downward. Company → Contract Type → Contract. Lower levels inherit values from above unless explicitly overridden.
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center gap-1">
                <ArrowDown className="w-3 h-3" />
                <span><strong>Company</strong> — global defaults</span>
              </div>
              <div className="flex items-center gap-1 pl-3">
                <ArrowDown className="w-3 h-3" />
                <span><strong>Contract Type</strong> — type-specific overrides</span>
              </div>
              <div className="flex items-center gap-1 pl-6">
                <ArrowDown className="w-3 h-3" />
                <span><strong>Contract</strong> — individual overrides</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function CompanySettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState('localization');
  const [isAddingContractType, setIsAddingContractType] = useState(false);
  const [newContractType, setNewContractType] = useState({ name: '', code: '', description: '' });
  const [selectedMasterTypeId, setSelectedMasterTypeId] = useState('');
  const [selectedContractType, setSelectedContractType] = useState<ContractType | null>(null);
  const [typePolicyForm, setTypePolicyForm] = useState<Record<string, any>>({});
  const [typePolicyTab, setTypePolicyTab] = useState('financial-policies');
  
  const { data: activeContextData } = useQuery<{ activeContext: any }>({
    queryKey: ['/api/user/active-context'],
    retry: false,
  });
  
  const isCompanyAdmin = user?.isSystemAdmin === true || 
    ['admin', 'owner'].includes(activeContextData?.activeContext?.role || '');
  
  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['/api/settings/company'],
  });

  const { data: contractTypesData, isLoading: typesLoading } = useQuery<ContractType[]>({
    queryKey: ['/api/contract-types'],
  });

  const [formData, setFormData] = useState<Partial<CompanySettings>>({});

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      const companyId = settings?.companyId;
      if (!companyId) throw new Error('No company context');
      return await apiRequest('PUT', `/api/settings/company/${companyId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/company'] });
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Company settings have been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const createContractTypeMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; description: string }) => {
      return await apiRequest('POST', '/api/contract-types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      setIsAddingContractType(false);
      setSelectedMasterTypeId('');
      setNewContractType({ name: '', code: '', description: '' });
      toast({
        title: "Contract Type Added",
        description: "Contract type has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contract type",
        variant: "destructive",
      });
    },
  });

  const updateContractTypeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      return await apiRequest('PUT', `/api/contract-types/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      setSelectedContractType(null);
      setTypePolicyForm({});
      toast({
        title: "Contract Type Updated",
        description: "Contract type policies have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contract type",
        variant: "destructive",
      });
    },
  });

  const deleteContractTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contract-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      toast({
        title: "Contract Type Deleted",
        description: "Contract type has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Cannot delete system contract types",
        variant: "destructive",
      });
    },
  });

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  const getValue = (key: keyof CompanySettings, defaultValue: any = '') => {
    return formData[key] ?? settings?.[key] ?? defaultValue;
  };

  const getPolicyValue = (policyKey: 'financialPolicies' | 'periodPolicies' | 'datasetPolicies' | 'settlementPolicies', field: string, defaultValue: any) => {
    const formPolicy = (formData as any)?.[policyKey];
    if (formPolicy && field in formPolicy) return formPolicy[field];
    const settingsPolicy = (settings as any)?.[policyKey];
    if (settingsPolicy && field in settingsPolicy) return settingsPolicy[field];
    return defaultValue;
  };

  const handlePolicyChange = (policyKey: 'financialPolicies' | 'periodPolicies' | 'datasetPolicies' | 'settlementPolicies', field: string, value: any) => {
    const currentPolicy = (formData as any)?.[policyKey] || (settings as any)?.[policyKey] || {};
    setFormData(prev => ({ ...prev, [policyKey]: { ...currentPolicy, [field]: value } }));
    setHasChanges(true);
  };

  const getTypePolicyValue = (policyKey: string, field: string, defaultValue: any) => {
    const formPolicy = typePolicyForm?.[policyKey];
    if (formPolicy && field in formPolicy) return formPolicy[field];
    const typePolicy = (selectedContractType as any)?.[policyKey];
    if (typePolicy && field in typePolicy) return typePolicy[field];
    return undefined;
  };

  const getEffectiveTypePolicyValue = (policyKey: string, field: string, defaultValue: any) => {
    const typeVal = getTypePolicyValue(policyKey, field, undefined);
    if (typeVal !== undefined) return typeVal;
    return getPolicyValue(policyKey as any, field, defaultValue);
  };

  const isTypeOverridden = (policyKey: string, field: string) => {
    const formPolicy = typePolicyForm?.[policyKey];
    if (formPolicy && field in formPolicy) return true;
    const typePolicy = (selectedContractType as any)?.[policyKey];
    return typePolicy && field in typePolicy;
  };

  const handleTypePolicyChange = (policyKey: string, field: string, value: any) => {
    const currentPolicy = typePolicyForm?.[policyKey] || (selectedContractType as any)?.[policyKey] || {};
    setTypePolicyForm(prev => ({ ...prev, [policyKey]: { ...currentPolicy, [field]: value } }));
  };

  const clearTypeOverride = (policyKey: string, field: string) => {
    const currentPolicy = { ...(typePolicyForm?.[policyKey] || (selectedContractType as any)?.[policyKey] || {}) };
    delete currentPolicy[field];
    setTypePolicyForm(prev => ({ ...prev, [policyKey]: currentPolicy }));
  };

  const handleSaveTypePolicies = () => {
    if (!selectedContractType) return;
    updateContractTypeMutation.mutate({ id: selectedContractType.id, updates: typePolicyForm });
  };

  if (!isCompanyAdmin) {
    return (
      <MainLayout title="Company Settings">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="w-96">
            <CardContent className="pt-6 text-center">
              <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                Company settings are only accessible to Company Administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const contractTypes = contractTypesData || [];

  return (
    <MainLayout title="Company Settings">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-company-settings">
              <Building2 className="w-8 h-8" />
              Company Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure company-specific settings and preferences
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || updateSettingsMutation.isPending}
              data-testid="button-save-company-settings"
            >
              {updateSettingsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="w-56 shrink-0">
              <nav className="space-y-1 sticky top-4" data-testid="settings-sidebar">
                {[
                  { key: 'localization', label: 'Localization', icon: Globe, group: 'general' },
                  { key: 'contract-types', label: 'Contract Types', icon: FileText, group: 'general' },
                  { key: 'workflows', label: 'Workflows', icon: Workflow, group: 'general' },
                  { key: 'branding', label: 'Branding', icon: Palette, group: 'general' },
                  { key: 'defaults', label: 'Defaults', icon: Building2, group: 'general' },
                  { key: 'financial-policies', label: 'Financial Policies', icon: DollarSign, group: 'policies' },
                  { key: 'period-management', label: 'Period Management', icon: Calendar, group: 'policies' },
                  { key: 'dataset-control', label: 'Dataset Control', icon: Database, group: 'policies' },
                  { key: 'settlement-payment', label: 'Settlement & Payment', icon: CreditCard, group: 'policies' },
                ].reduce<{ items: typeof Array.prototype; lastGroup: string }>((acc, item, idx, arr) => {
                  if (idx > 0 && item.group !== arr[idx - 1].group) {
                    acc.items.push(
                      <div key={`sep-${idx}`} className="pt-2 pb-1 px-3">
                        <div className="border-t border-border" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 block">Configuration Policies</span>
                      </div>
                    );
                  }
                  const Icon = item.icon;
                  acc.items.push(
                    <button
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                        activeSection === item.key
                          ? 'bg-orange-50 text-orange-700 font-medium border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      data-testid={`tab-${item.key}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                  acc.lastGroup = item.group;
                  return acc;
                }, { items: [] as any[], lastGroup: '' }).items}
              </nav>
            </div>

            <div className="flex-1 min-w-0 space-y-6">

            {activeSection === 'localization' && (<div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Localization Settings
                  </CardTitle>
                  <CardDescription>
                    Configure date, currency, and regional preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="dateFormat">Date Format</Label>
                      <Select 
                        value={getValue('dateFormat', 'MM/DD/YYYY')}
                        onValueChange={(v) => handleChange('dateFormat', v)}
                      >
                        <SelectTrigger id="dateFormat" data-testid="select-date-format">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                          <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select 
                        value={getValue('timezone', 'America/New_York')}
                        onValueChange={(v) => handleChange('timezone', v)}
                      >
                        <SelectTrigger id="timezone" data-testid="select-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="Europe/London">London (GMT)</SelectItem>
                          <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currencyCode">Currency Code</Label>
                      <Select 
                        value={getValue('currencyCode', 'USD')}
                        onValueChange={(v) => handleChange('currencyCode', v)}
                      >
                        <SelectTrigger id="currencyCode" data-testid="select-currency-code">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                          <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currencySymbol">Currency Symbol</Label>
                      <Input
                        id="currencySymbol"
                        value={getValue('currencySymbol', '$')}
                        onChange={(e) => handleChange('currencySymbol', e.target.value)}
                        placeholder="$"
                        maxLength={3}
                        data-testid="input-currency-symbol"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fiscalYearStart">Fiscal Year Start Month</Label>
                      <Select 
                        value={String(getValue('fiscalYearStart', 1))}
                        onValueChange={(v) => handleChange('fiscalYearStart', parseInt(v))}
                      >
                        <SelectTrigger id="fiscalYearStart" data-testid="select-fiscal-year">
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">January</SelectItem>
                          <SelectItem value="2">February</SelectItem>
                          <SelectItem value="3">March</SelectItem>
                          <SelectItem value="4">April</SelectItem>
                          <SelectItem value="5">May</SelectItem>
                          <SelectItem value="6">June</SelectItem>
                          <SelectItem value="7">July</SelectItem>
                          <SelectItem value="8">August</SelectItem>
                          <SelectItem value="9">September</SelectItem>
                          <SelectItem value="10">October</SelectItem>
                          <SelectItem value="11">November</SelectItem>
                          <SelectItem value="12">December</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'contract-types' && (<div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Contract Types
                      </CardTitle>
                      <CardDescription>
                        Manage available contract types for your organization. Click a type to configure its policy overrides.
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={() => setIsAddingContractType(true)}
                      disabled={isAddingContractType}
                      data-testid="button-add-contract-type"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Type
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Policies</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isAddingContractType && (() => {
                          const existingCodes = contractTypes.map((t) => t.code);
                          const availableTypes = (contractTypesData || []).filter(
                            (t) => !existingCodes.includes(t.code) && t.isActive !== false
                          );
                          const selectedType = (contractTypesData || []).find(t => t.id === selectedMasterTypeId);
                          const isDuplicate = selectedType && existingCodes.includes(selectedType.code);

                          return (
                          <TableRow className="bg-orange-50/30 dark:bg-orange-950/10">
                            <TableCell colSpan={3}>
                              {availableTypes.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-2">
                                  All available contract types have already been added.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Select value={selectedMasterTypeId} onValueChange={(val) => {
                                    setSelectedMasterTypeId(val);
                                    const t = (contractTypesData || []).find(x => x.id === val);
                                    if (t) {
                                      setNewContractType({ name: t.name, code: t.code, description: t.description || '' });
                                    }
                                  }}>
                                    <SelectTrigger data-testid="select-master-type">
                                      <SelectValue placeholder="Select a contract type from master list..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableTypes.map((t) => (
                                        <SelectItem key={t.id} value={t.id} data-testid={`option-type-${t.code}`}>
                                          <span className="font-medium">{t.name}</span>
                                          <span className="text-muted-foreground ml-2 text-xs">({t.code})</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {selectedType && (
                                    <div className="text-xs text-muted-foreground">
                                      {selectedType.description || 'No description available'}
                                    </div>
                                  )}
                                  {isDuplicate && (
                                    <div className="text-xs text-red-600 font-medium">
                                      This contract type has already been added.
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {selectedType && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Adding</Badge>}
                            </TableCell>
                            <TableCell />
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => createContractTypeMutation.mutate(newContractType)}
                                  disabled={!selectedMasterTypeId || isDuplicate || availableTypes.length === 0}
                                  data-testid="button-save-new-type"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setIsAddingContractType(false);
                                    setSelectedMasterTypeId('');
                                    setNewContractType({ name: '', code: '', description: '' });
                                  }}
                                  data-testid="button-cancel-new-type"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })()}
                        {contractTypes.map((type) => {
                          const hasPolicies = type.financialPolicies || type.periodPolicies || type.datasetPolicies || type.settlementPolicies;
                          const policyCount = [type.financialPolicies, type.periodPolicies, type.datasetPolicies, type.settlementPolicies].filter(Boolean).length;
                          return (
                          <TableRow 
                            key={type.id} 
                            className={`cursor-pointer hover:bg-muted/50 ${selectedContractType?.id === type.id ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}
                            onClick={() => {
                              setSelectedContractType(type);
                              setTypePolicyForm({
                                financialPolicies: type.financialPolicies || {},
                                periodPolicies: type.periodPolicies || {},
                                datasetPolicies: type.datasetPolicies || {},
                                settlementPolicies: type.settlementPolicies || {},
                              });
                            }}
                            data-testid={`row-contract-type-${type.id}`}
                          >
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{type.code}</code>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{type.description || '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {type.isSystemType && (
                                  <Badge variant="secondary">System</Badge>
                                )}
                                {type.isActive ? (
                                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                                ) : (
                                  <Badge variant="outline">Inactive</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasPolicies ? (
                                <Badge variant="outline" className="text-blue-600 border-blue-300">
                                  {policyCount} override{policyCount > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Inherited</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!type.isSystemType && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); deleteContractTypeMutation.mutate(type.id); }}
                                  data-testid={`button-delete-type-${type.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {selectedContractType && (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Edit2 className="w-5 h-5" />
                          Policy Overrides: {selectedContractType.name}
                        </CardTitle>
                        <CardDescription>
                          Override company-level policies for this contract type. Unset fields inherit from Company Settings.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedContractType(null); setTypePolicyForm({}); }} data-testid="button-close-type-policies">
                          <X className="w-4 h-4 mr-1" />
                          Close
                        </Button>
                        <Button size="sm" onClick={handleSaveTypePolicies} disabled={updateContractTypeMutation.isPending} data-testid="button-save-type-policies">
                          {updateContractTypeMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                          Save Overrides
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <InheritanceBanner level="contract_type" />

                    <div className="flex gap-4 mt-4">
                      <div className="w-44 shrink-0 space-y-1">
                        {[
                          { key: 'financial-policies', label: 'Financial', icon: DollarSign },
                          { key: 'period-management', label: 'Periods', icon: Calendar },
                          { key: 'dataset-control', label: 'Dataset', icon: Database },
                          { key: 'settlement-payment', label: 'Settlement', icon: CreditCard },
                        ].map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.key}
                              onClick={() => setTypePolicyTab(item.key)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition-colors ${
                                typePolicyTab === item.key
                                  ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-950/30 dark:text-blue-400'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                              data-testid={`type-policy-tab-${item.key}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex-1 min-w-0">
                        {typePolicyTab === 'financial-policies' && (
                          <div className="space-y-4">
                            <TypePolicyField
                              label="Cutoff Policy"
                              policyKey="financialPolicies"
                              field="cutoffPolicy"
                              companyValue={getPolicyValue('financialPolicies', 'cutoffPolicy', 'period_end')}
                              isOverridden={isTypeOverridden('financialPolicies', 'cutoffPolicy')}
                              onClear={() => clearTypeOverride('financialPolicies', 'cutoffPolicy')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('financialPolicies', 'cutoffPolicy', 'period_end')}
                                onValueChange={(v) => handleTypePolicyChange('financialPolicies', 'cutoffPolicy', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="period_end">Period End</SelectItem>
                                  <SelectItem value="transaction_date">Transaction Date</SelectItem>
                                  <SelectItem value="invoice_date">Invoice Date</SelectItem>
                                  <SelectItem value="ship_date">Ship Date</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="Rounding Method"
                              policyKey="financialPolicies"
                              field="roundingMethod"
                              companyValue={getPolicyValue('financialPolicies', 'roundingMethod', 'round_half_up')}
                              isOverridden={isTypeOverridden('financialPolicies', 'roundingMethod')}
                              onClear={() => clearTypeOverride('financialPolicies', 'roundingMethod')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('financialPolicies', 'roundingMethod', 'round_half_up')}
                                onValueChange={(v) => handleTypePolicyChange('financialPolicies', 'roundingMethod', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="round_half_up">Round Half Up</SelectItem>
                                  <SelectItem value="round_half_down">Round Half Down</SelectItem>
                                  <SelectItem value="round_down">Round Down</SelectItem>
                                  <SelectItem value="round_up">Round Up</SelectItem>
                                  <SelectItem value="bankers_rounding">Banker's Rounding</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="Accrual Mode"
                              policyKey="financialPolicies"
                              field="accrualMode"
                              companyValue={getPolicyValue('financialPolicies', 'accrualMode', 'automatic')}
                              isOverridden={isTypeOverridden('financialPolicies', 'accrualMode')}
                              onClear={() => clearTypeOverride('financialPolicies', 'accrualMode')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('financialPolicies', 'accrualMode', 'automatic')}
                                onValueChange={(v) => handleTypePolicyChange('financialPolicies', 'accrualMode', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="automatic">Automatic</SelectItem>
                                  <SelectItem value="manual">Manual</SelectItem>
                                  <SelectItem value="semi_automatic">Semi-Automatic</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="Payment Mode"
                              policyKey="financialPolicies"
                              field="paymentMode"
                              companyValue={getPolicyValue('financialPolicies', 'paymentMode', 'net')}
                              isOverridden={isTypeOverridden('financialPolicies', 'paymentMode')}
                              onClear={() => clearTypeOverride('financialPolicies', 'paymentMode')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('financialPolicies', 'paymentMode', 'net')}
                                onValueChange={(v) => handleTypePolicyChange('financialPolicies', 'paymentMode', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="net">Net Settlement</SelectItem>
                                  <SelectItem value="gross">Gross Payment</SelectItem>
                                  <SelectItem value="credit_memo">Credit Memo</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="FX Method"
                              policyKey="financialPolicies"
                              field="fxMethod"
                              companyValue={getPolicyValue('financialPolicies', 'fxMethod', 'spot_rate')}
                              isOverridden={isTypeOverridden('financialPolicies', 'fxMethod')}
                              onClear={() => clearTypeOverride('financialPolicies', 'fxMethod')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('financialPolicies', 'fxMethod', 'spot_rate')}
                                onValueChange={(v) => handleTypePolicyChange('financialPolicies', 'fxMethod', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="spot_rate">Spot Rate</SelectItem>
                                  <SelectItem value="average_rate">Average Rate</SelectItem>
                                  <SelectItem value="fixed_rate">Fixed Contract Rate</SelectItem>
                                  <SelectItem value="month_end_rate">Month-End Rate</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                          </div>
                        )}

                        {typePolicyTab === 'period-management' && (
                          <div className="space-y-4">
                            <TypePolicyField
                              label="Period Frequency"
                              policyKey="periodPolicies"
                              field="periodFrequency"
                              companyValue={getPolicyValue('periodPolicies', 'periodFrequency', 'monthly')}
                              isOverridden={isTypeOverridden('periodPolicies', 'periodFrequency')}
                              onClear={() => clearTypeOverride('periodPolicies', 'periodFrequency')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('periodPolicies', 'periodFrequency', 'monthly')}
                                onValueChange={(v) => handleTypePolicyChange('periodPolicies', 'periodFrequency', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                                  <SelectItem value="annual">Annual</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="Period Naming"
                              policyKey="periodPolicies"
                              field="periodNaming"
                              companyValue={getPolicyValue('periodPolicies', 'periodNaming', 'calendar')}
                              isOverridden={isTypeOverridden('periodPolicies', 'periodNaming')}
                              onClear={() => clearTypeOverride('periodPolicies', 'periodNaming')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('periodPolicies', 'periodNaming', 'calendar')}
                                onValueChange={(v) => handleTypePolicyChange('periodPolicies', 'periodNaming', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="calendar">Calendar (Jan, Feb, ...)</SelectItem>
                                  <SelectItem value="fiscal">Fiscal (P1, P2, ...)</SelectItem>
                                  <SelectItem value="quarter">Quarter (Q1, Q2, ...)</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                          </div>
                        )}

                        {typePolicyTab === 'dataset-control' && (
                          <div className="space-y-4">
                            <TypePolicyField
                              label="Completeness Threshold (%)"
                              policyKey="datasetPolicies"
                              field="completenessThreshold"
                              companyValue={getPolicyValue('datasetPolicies', 'completenessThreshold', 95)}
                              isOverridden={isTypeOverridden('datasetPolicies', 'completenessThreshold')}
                              onClear={() => clearTypeOverride('datasetPolicies', 'completenessThreshold')}
                            >
                              <Input
                                type="number"
                                min={0} max={100}
                                value={getEffectiveTypePolicyValue('datasetPolicies', 'completenessThreshold', 95)}
                                onChange={(e) => handleTypePolicyChange('datasetPolicies', 'completenessThreshold', parseInt(e.target.value) || 95)}
                              />
                            </TypePolicyField>
                          </div>
                        )}

                        {typePolicyTab === 'settlement-payment' && (
                          <div className="space-y-4">
                            <TypePolicyField
                              label="Payment Frequency"
                              policyKey="settlementPolicies"
                              field="defaultPaymentFrequency"
                              companyValue={getPolicyValue('settlementPolicies', 'defaultPaymentFrequency', 'monthly')}
                              isOverridden={isTypeOverridden('settlementPolicies', 'defaultPaymentFrequency')}
                              onClear={() => clearTypeOverride('settlementPolicies', 'defaultPaymentFrequency')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('settlementPolicies', 'defaultPaymentFrequency', 'monthly')}
                                onValueChange={(v) => handleTypePolicyChange('settlementPolicies', 'defaultPaymentFrequency', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                                  <SelectItem value="annual">Annual</SelectItem>
                                  <SelectItem value="on_demand">On Demand</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                            <TypePolicyField
                              label="Settlement Method"
                              policyKey="settlementPolicies"
                              field="settlementMethod"
                              companyValue={getPolicyValue('settlementPolicies', 'settlementMethod', 'check')}
                              isOverridden={isTypeOverridden('settlementPolicies', 'settlementMethod')}
                              onClear={() => clearTypeOverride('settlementPolicies', 'settlementMethod')}
                            >
                              <Select
                                value={getEffectiveTypePolicyValue('settlementPolicies', 'settlementMethod', 'check')}
                                onValueChange={(v) => handleTypePolicyChange('settlementPolicies', 'settlementMethod', v)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="check">Check</SelectItem>
                                  <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
                                  <SelectItem value="wire">Wire Transfer</SelectItem>
                                  <SelectItem value="credit_memo">Credit Memo / Offset</SelectItem>
                                  <SelectItem value="eft">EFT</SelectItem>
                                </SelectContent>
                              </Select>
                            </TypePolicyField>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>)}

            {activeSection === 'workflows' && (<div className="space-y-6">
              <ApprovalWorkflowsConfig />
            </div>)}

            {activeSection === 'branding' && (<div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Branding
                  </CardTitle>
                  <CardDescription>
                    Customize the appearance of your company's interface
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="brandPrimaryColor">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="brandPrimaryColor"
                          type="color"
                          value={getValue('brandPrimaryColor', '#3B82F6')}
                          onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                          data-testid="input-primary-color"
                        />
                        <Input
                          value={getValue('brandPrimaryColor', '#3B82F6')}
                          onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brandSecondaryColor">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="brandSecondaryColor"
                          type="color"
                          value={getValue('brandSecondaryColor', '#10B981')}
                          onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                          data-testid="input-secondary-color"
                        />
                        <Input
                          value={getValue('brandSecondaryColor', '#10B981')}
                          onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
                          placeholder="#10B981"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="brandLogoUrl">Logo URL</Label>
                    <Input
                      id="brandLogoUrl"
                      value={getValue('brandLogoUrl', '') || ''}
                      onChange={(e) => handleChange('brandLogoUrl', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      data-testid="input-logo-url"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL to your company logo (recommended size: 200x50px)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'defaults' && (<div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Default Settings
                  </CardTitle>
                  <CardDescription>
                    Set default values for new contracts and calculations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="defaultCalculationApproach">Default Calculation Approach</Label>
                    <Select 
                      value={getValue('defaultCalculationApproach', 'manual')}
                      onValueChange={(v) => handleChange('defaultCalculationApproach', v)}
                    >
                      <SelectTrigger id="defaultCalculationApproach" data-testid="select-calc-approach">
                        <SelectValue placeholder="Select approach" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Rules Only</SelectItem>
                        <SelectItem value="erp_rules">ERP Mapping Rules Only</SelectItem>
                        <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Default approach for new contract fee calculations
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'financial-policies' && (<div className="space-y-6">
              <InheritanceBanner level="company" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Financial Policies
                  </CardTitle>
                  <CardDescription>
                    Company-level defaults for cutoff, rounding, materiality, FX, and accrual/payment modes. These cascade to Contract Type and Contract levels unless overridden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Cutoff Policy</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'cutoffPolicy', 'period_end')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'cutoffPolicy', v)}
                      >
                        <SelectTrigger data-testid="select-cutoff-policy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="period_end">Period End</SelectItem>
                          <SelectItem value="transaction_date">Transaction Date</SelectItem>
                          <SelectItem value="invoice_date">Invoice Date</SelectItem>
                          <SelectItem value="ship_date">Ship Date</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">When to recognize revenue/costs in a period</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Rounding Method</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'roundingMethod', 'round_half_up')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'roundingMethod', v)}
                      >
                        <SelectTrigger data-testid="select-rounding-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round_half_up">Round Half Up</SelectItem>
                          <SelectItem value="round_half_down">Round Half Down</SelectItem>
                          <SelectItem value="round_down">Round Down (Truncate)</SelectItem>
                          <SelectItem value="round_up">Round Up (Ceiling)</SelectItem>
                          <SelectItem value="bankers_rounding">Banker's Rounding</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Rounding Precision (Decimal Places)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={6}
                        value={getPolicyValue('financialPolicies', 'roundingPrecision', 2)}
                        onChange={(e) => handlePolicyChange('financialPolicies', 'roundingPrecision', parseInt(e.target.value) || 2)}
                        data-testid="input-rounding-precision"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Materiality Threshold</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={getPolicyValue('financialPolicies', 'materialityThreshold', 0)}
                        onChange={(e) => handlePolicyChange('financialPolicies', 'materialityThreshold', parseFloat(e.target.value) || 0)}
                        data-testid="input-materiality-threshold"
                      />
                      <p className="text-xs text-muted-foreground">Amounts below this are considered immaterial</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/10 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold">Settlement Variance Auto-Clear</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          When a partial settlement is recorded and the residual variance falls within these limits,
                          automatically post a true-up journal entry (DR Accrued Liability / CR Revenue) to clear the leftover accrual.
                          Variances above the limit must be cleared manually from the settlement detail.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Label htmlFor="switch-variance-auto-clear" className="text-xs text-muted-foreground">
                          {getPolicyValue('settlementPolicies', 'varianceAutoClearEnabled', false) ? 'Enabled' : 'Disabled'}
                        </Label>
                        <input
                          id="switch-variance-auto-clear"
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-orange-600"
                          checked={!!getPolicyValue('settlementPolicies', 'varianceAutoClearEnabled', false)}
                          onChange={(e) => handlePolicyChange('settlementPolicies', 'varianceAutoClearEnabled', e.target.checked)}
                          data-testid="switch-variance-auto-clear"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Max Absolute Residual ($)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={getPolicyValue('settlementPolicies', 'varianceMaxAbsAmount', 500)}
                          onChange={(e) => handlePolicyChange('settlementPolicies', 'varianceMaxAbsAmount', parseFloat(e.target.value) || 0)}
                          data-testid="input-variance-max-abs"
                        />
                        <p className="text-xs text-muted-foreground">Auto-clear only if |residual| ≤ this dollar amount</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Residual % of Accrual</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={getPolicyValue('settlementPolicies', 'varianceMaxPct', 1)}
                          onChange={(e) => handlePolicyChange('settlementPolicies', 'varianceMaxPct', parseFloat(e.target.value) || 0)}
                          data-testid="input-variance-max-pct"
                        />
                        <p className="text-xs text-muted-foreground">Auto-clear only if |residual / accrual| ≤ this percent</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Accrued Liability Account (DR)</Label>
                        <Input
                          type="text"
                          value={getPolicyValue('settlementPolicies', 'accrualAccountCode', '2150')}
                          onChange={(e) => handlePolicyChange('settlementPolicies', 'accrualAccountCode', e.target.value)}
                          data-testid="input-accrual-account-code"
                        />
                        <p className="text-xs text-muted-foreground">GL account debited when residual is cleared</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue Account (CR)</Label>
                        <Input
                          type="text"
                          value={getPolicyValue('settlementPolicies', 'revenueAccountCode', '4000')}
                          onChange={(e) => handlePolicyChange('settlementPolicies', 'revenueAccountCode', e.target.value)}
                          data-testid="input-revenue-account-code"
                        />
                        <p className="text-xs text-muted-foreground">GL account credited (revenue reversal/release) when residual is cleared</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>FX Conversion Method</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'fxMethod', 'spot_rate')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'fxMethod', v)}
                      >
                        <SelectTrigger data-testid="select-fx-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spot_rate">Spot Rate</SelectItem>
                          <SelectItem value="average_rate">Average Rate</SelectItem>
                          <SelectItem value="fixed_rate">Fixed Contract Rate</SelectItem>
                          <SelectItem value="month_end_rate">Month-End Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Revenue Recognition</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'revenueRecognition', 'accrual')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'revenueRecognition', v)}
                      >
                        <SelectTrigger data-testid="select-revenue-recognition">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accrual">Accrual Basis</SelectItem>
                          <SelectItem value="cash">Cash Basis</SelectItem>
                          <SelectItem value="modified_accrual">Modified Accrual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Accrual Mode</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'accrualMode', 'automatic')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'accrualMode', v)}
                      >
                        <SelectTrigger data-testid="select-accrual-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatic">Automatic</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="semi_automatic">Semi-Automatic (Review Required)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select
                        value={getPolicyValue('financialPolicies', 'paymentMode', 'net')}
                        onValueChange={(v) => handlePolicyChange('financialPolicies', 'paymentMode', v)}
                      >
                        <SelectTrigger data-testid="select-payment-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="net">Net Settlement</SelectItem>
                          <SelectItem value="gross">Gross Payment</SelectItem>
                          <SelectItem value="credit_memo">Credit Memo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'period-management' && (<div className="space-y-6">
              <InheritanceBanner level="company" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Period Management
                  </CardTitle>
                  <CardDescription>
                    Fiscal period definitions, frequency, and lock policies. These defaults apply across all contract types unless overridden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Fiscal Year Start Month</Label>
                      <Select
                        value={String(getPolicyValue('periodPolicies', 'fiscalYearStartMonth', 1))}
                        onValueChange={(v) => handlePolicyChange('periodPolicies', 'fiscalYearStartMonth', parseInt(v))}
                      >
                        <SelectTrigger data-testid="select-fiscal-year-start">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                            <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Period Frequency</Label>
                      <Select
                        value={getPolicyValue('periodPolicies', 'periodFrequency', 'monthly')}
                        onValueChange={(v) => handlePolicyChange('periodPolicies', 'periodFrequency', v)}
                      >
                        <SelectTrigger data-testid="select-period-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Period Naming Convention</Label>
                      <Select
                        value={getPolicyValue('periodPolicies', 'periodNaming', 'calendar')}
                        onValueChange={(v) => handlePolicyChange('periodPolicies', 'periodNaming', v)}
                      >
                        <SelectTrigger data-testid="select-period-naming">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="calendar">Calendar (Jan, Feb, ...)</SelectItem>
                          <SelectItem value="fiscal">Fiscal (P1, P2, ...)</SelectItem>
                          <SelectItem value="quarter">Quarter (Q1, Q2, ...)</SelectItem>
                          <SelectItem value="custom">Custom Labels</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Auto-Lock After (Days)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        value={getPolicyValue('periodPolicies', 'lockAfterDays', 0)}
                        onChange={(e) => handlePolicyChange('periodPolicies', 'lockAfterDays', parseInt(e.target.value) || 0)}
                        data-testid="input-lock-after-days"
                      />
                      <p className="text-xs text-muted-foreground">Periods auto-lock this many days after close. 0 = manual lock only.</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Allow Backdating</Label>
                        <p className="text-xs text-muted-foreground mt-1">Allow entries in past open periods</p>
                      </div>
                      <Switch
                        checked={getPolicyValue('periodPolicies', 'allowBackdating', false)}
                        onCheckedChange={(v) => handlePolicyChange('periodPolicies', 'allowBackdating', v)}
                        data-testid="switch-allow-backdating"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Require Approval to Reopen</Label>
                        <p className="text-xs text-muted-foreground mt-1">Locked periods need admin approval to reopen</p>
                      </div>
                      <Switch
                        checked={getPolicyValue('periodPolicies', 'requireApprovalToReopen', true)}
                        onCheckedChange={(v) => handlePolicyChange('periodPolicies', 'requireApprovalToReopen', v)}
                        data-testid="switch-require-approval-reopen"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'dataset-control' && (<div className="space-y-6">
              <InheritanceBanner level="company" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Dataset Control
                  </CardTitle>
                  <CardDescription>
                    Data completeness rules, certification requirements, and retention policies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Completeness Threshold (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={getPolicyValue('datasetPolicies', 'completenessThreshold', 95)}
                        onChange={(e) => handlePolicyChange('datasetPolicies', 'completenessThreshold', parseInt(e.target.value) || 95)}
                        data-testid="input-completeness-threshold"
                      />
                      <p className="text-xs text-muted-foreground">Minimum % of expected data that must be present before calculations</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Retention (Months)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={getPolicyValue('datasetPolicies', 'dataRetentionMonths', 84)}
                        onChange={(e) => handlePolicyChange('datasetPolicies', 'dataRetentionMonths', parseInt(e.target.value) || 84)}
                        data-testid="input-data-retention"
                      />
                      <p className="text-xs text-muted-foreground">How long to retain historical calculation data</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Require Certification</Label>
                        <p className="text-xs text-muted-foreground mt-1">Data must be certified before period close</p>
                      </div>
                      <Switch
                        checked={getPolicyValue('datasetPolicies', 'requireCertification', false)}
                        onCheckedChange={(v) => handlePolicyChange('datasetPolicies', 'requireCertification', v)}
                        data-testid="switch-require-certification"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Allow Partial Submission</Label>
                        <p className="text-xs text-muted-foreground mt-1">Allow calculations with incomplete data</p>
                      </div>
                      <Switch
                        checked={getPolicyValue('datasetPolicies', 'allowPartialSubmission', true)}
                        onCheckedChange={(v) => handlePolicyChange('datasetPolicies', 'allowPartialSubmission', v)}
                        data-testid="switch-allow-partial"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Audit Trail</Label>
                        <p className="text-xs text-muted-foreground mt-1">Track all data changes</p>
                      </div>
                      <Switch
                        checked={getPolicyValue('datasetPolicies', 'auditTrailEnabled', true)}
                        onCheckedChange={(v) => handlePolicyChange('datasetPolicies', 'auditTrailEnabled', v)}
                        data-testid="switch-audit-trail"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>)}

            {activeSection === 'settlement-payment' && (<div className="space-y-6">
              <InheritanceBanner level="company" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Settlement & Payment
                  </CardTitle>
                  <CardDescription>
                    Payment frequency, terms, settlement methods, and accounting codes that apply as defaults across all contracts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Payment Frequency</Label>
                      <Select
                        value={getPolicyValue('settlementPolicies', 'defaultPaymentFrequency', 'monthly')}
                        onValueChange={(v) => handlePolicyChange('settlementPolicies', 'defaultPaymentFrequency', v)}
                      >
                        <SelectTrigger data-testid="select-payment-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="on_demand">On Demand</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Terms (Days)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={getPolicyValue('settlementPolicies', 'paymentTermsDays', 30)}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'paymentTermsDays', parseInt(e.target.value) || 30)}
                        data-testid="input-payment-terms-days"
                      />
                      <p className="text-xs text-muted-foreground">Net payment terms from invoice date</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Settlement Method</Label>
                      <Select
                        value={getPolicyValue('settlementPolicies', 'settlementMethod', 'check')}
                        onValueChange={(v) => handlePolicyChange('settlementPolicies', 'settlementMethod', v)}
                      >
                        <SelectTrigger data-testid="select-settlement-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
                          <SelectItem value="wire">Wire Transfer</SelectItem>
                          <SelectItem value="credit_memo">Credit Memo / Offset</SelectItem>
                          <SelectItem value="eft">EFT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Auto-Settle Threshold</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={getPolicyValue('settlementPolicies', 'autoSettleThreshold', 0)}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'autoSettleThreshold', parseFloat(e.target.value) || 0)}
                        data-testid="input-auto-settle-threshold"
                      />
                      <p className="text-xs text-muted-foreground">Auto-settle amounts below this value. 0 = disabled.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Enable Auto-Settlement</Label>
                      <p className="text-xs text-muted-foreground mt-1">Automatically process settlements below threshold</p>
                    </div>
                    <Switch
                      checked={getPolicyValue('settlementPolicies', 'autoSettleEnabled', false)}
                      onCheckedChange={(v) => handlePolicyChange('settlementPolicies', 'autoSettleEnabled', v)}
                      data-testid="switch-auto-settle"
                    />
                  </div>

                  <Separator />

                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Accounting Codes
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>GL Account Code</Label>
                      <Input
                        value={getPolicyValue('settlementPolicies', 'glAccountCode', '')}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'glAccountCode', e.target.value)}
                        placeholder="e.g. 4100-000"
                        data-testid="input-gl-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AP Account Code</Label>
                      <Input
                        value={getPolicyValue('settlementPolicies', 'apAccountCode', '')}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'apAccountCode', e.target.value)}
                        placeholder="e.g. 2100-000"
                        data-testid="input-ap-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AR Account Code</Label>
                      <Input
                        value={getPolicyValue('settlementPolicies', 'arAccountCode', '')}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'arAccountCode', e.target.value)}
                        placeholder="e.g. 1200-000"
                        data-testid="input-ar-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Accrual Account Code</Label>
                      <Input
                        value={getPolicyValue('settlementPolicies', 'accrualAccountCode', '')}
                        onChange={(e) => handlePolicyChange('settlementPolicies', 'accrualAccountCode', e.target.value)}
                        placeholder="e.g. 2300-000"
                        data-testid="input-accrual-account"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DocumentTypeMatrixCompanyCard
                companyMatrixRows={(getPolicyValue('settlementPolicies', 'documentTypeMatrix', { rows: [] })?.rows || []) as DocumentTypeMatrixRow[]}
                onChangeCompanyMatrix={(rows) =>
                  handlePolicyChange('settlementPolicies', 'documentTypeMatrix', { rows })
                }
              />

              <DocumentTypeMatrixFlowTypesCard
                companyMatrixRows={(getPolicyValue('settlementPolicies', 'documentTypeMatrix', { rows: [] })?.rows || []) as DocumentTypeMatrixRow[]}
              />
            </div>)}

            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
