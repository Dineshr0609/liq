import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings, 
  Bot, 
  Shield, 
  Zap, 
  FileText, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  Info,
  Lock,
  FileCode,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Database,
  Mail,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  ClipboardList,
  Clock,
  RotateCcw,
  Search,
  RotateCw,
  Code2,
  ListChecks,
  Target,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IntegrationsPanel } from "@/components/finance/integrations-panel";

type SystemSettings = {
  id: string;
  aiProvider: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  aiRetryAttempts: number;
  autoConfirmThreshold: number;
  lowConfidenceThreshold: number;
  defaultExtractionMode: string;
  defaultEvaluationMode: string;
  analysisMode: string;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  require2FA: boolean;
  enableAuditLogging: boolean;
  enableBetaFeatures: boolean;
  enableEmailNotifications: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  fileRetentionDays: number;
  apiRateLimitPerMinute: number;
  extractionPrompts: any;
  featureFlagAiExtraction: boolean;
  featureFlagRagQa: boolean;
  featureFlagErpIntegration: boolean;
  featureFlagMultiLocation: boolean;
  featureFlagErpMatching: boolean;
  extractionPromptTemplate: string;
  mappingPromptTemplate: string;
  riskAssessmentPromptTemplate: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpPasswordSet: boolean;
  smtpPasswordSource: string;
  smtpFromName: string;
  smtpFromEmail: string;
  obligationExpirySweepEnabled: boolean;
  obligationExpirySweepHourUtc: number;
  obligationExpirySweepLastRunAt: string | null;
  obligationExpirySweepLastError: string | null;
  obligationExpirySweepLastResult: {
    startedAt?: string;
    finishedAt?: string;
    totalExpiredCount?: number;
    totalExpiredAmount?: number;
    companies?: Array<{
      companyId: string;
      companyName: string;
      expiredCount?: number;
      expiredAmount?: number;
      error?: string;
    }>;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type ContractTypeWithPrompts = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystemType: boolean;
  isActive: boolean;
  // Legacy mode prompts
  extractionPrompt: string | null;
  ruleExtractionPrompt: string | null;
  erpMappingPrompt: string | null;
  sampleExtractionOutput: string | null;
  // RAG mode prompts (chunk-based with citations)
  ragExtractionPrompt: string | null;
  ragRuleExtractionPrompt: string | null;
  ragSampleExtractionOutput: string | null;
};

type CalculationFieldTypeData = {
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const FIELD_CATEGORIES = ['basis', 'rate', 'threshold', 'modifier', 'constraint'];
const DATA_TYPES = ['number', 'percentage', 'currency', 'text', 'date'];
const CATEGORY_COLORS: Record<string, string> = {
  basis: 'bg-orange-100 text-orange-900 dark:bg-orange-950/30 dark:text-orange-300',
  rate: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  threshold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  modifier: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  constraint: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const LAYER_COLORS: Record<number, string> = {
  1: 'border-l-blue-500',
  2: 'border-l-orange-500',
  3: 'border-l-purple-500',
  4: 'border-l-green-500',
  5: 'border-l-amber-500',
  6: 'border-l-pink-500',
  7: 'border-l-cyan-500',
  8: 'border-l-indigo-500',
  9: 'border-l-red-500',
  10: 'border-l-orange-500',
};

const LAYER_BADGES: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  2: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  3: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  4: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  5: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  6: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  7: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  8: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  9: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  10: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

type RegistryPrompt = {
  id: string;
  name: string;
  layer: string;
  layerNumber: number;
  description: string;
  trigger: string;
  provider: string;
  sourceFile: string;
  category: string;
  editable: boolean;
  defaultPrompt: string;
  placeholders?: string[];
  outputFormat?: string;
  customPrompt: string | null;
  isCustomized: boolean;
};

type ScreenGroup = {
  key: string;
  label: string;
  route: string;
  component: string;
  icon: string;
  promptIds: string[];
  kind?: 'registry' | 'flow' | 'subtype';
};

const SCREEN_GROUPS: ScreenGroup[] = [
  { key: 'pipeline', label: '3-Stage Pipeline', route: '/contracts/:id/manage', component: 'ContractManagement', icon: 'pipeline', promptIds: ['P036', 'P037', 'P038'] },
  { key: 'upload', label: 'Upload & Process', route: '/upload-and-process', component: 'UploadAndProcess', icon: 'upload', promptIds: ['P001', 'P002', 'P032'] },
  { key: 'rules', label: 'Rule Extraction', route: '/contracts/:id/manage', component: 'pipelineService.ts', icon: 'rules', promptIds: ['P003', 'P004', 'P005', 'P006', 'P009'] },
  { key: 'contract-types', label: 'Contract Type Prompts', route: '/system-settings', component: 'contractTypePrompts.ts', icon: 'types', promptIds: ['P007', 'P008', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044'] },
  { key: 'flow-type-prompts', label: 'Flow Type Prompts', route: '/system-settings', component: 'flow_type_prompts (DB)', icon: 'flow', promptIds: [], kind: 'flow' },
  { key: 'subtype-prompts', label: 'Subtype / Program Prompts', route: '/system-settings', component: 'subtype_prompts (DB)', icon: 'subtype', promptIds: [], kind: 'subtype' },
  { key: 'formulas', label: 'Formula Enrichment', route: '/contracts/:id/manage', component: 'formulaGenerator.ts', icon: 'formula', promptIds: ['P010'] },
  { key: 'detail', label: 'Contract Detail View', route: '/contracts/:id', component: 'ContractDetail', icon: 'detail', promptIds: ['P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P034', 'P035'] },
  { key: 'liq-ai', label: 'liQ AI Chat', route: 'Global Panel', component: 'LiqAIPanel', icon: 'chat', promptIds: ['P021', 'P022', 'P023', 'P024'] },
  { key: 'erp', label: 'ERP Mapping', route: '/data-ingestion', component: 'erpMappingService.ts', icon: 'erp', promptIds: ['P025', 'P026'] },
  { key: 'detection', label: 'Table & Field Detection', route: '/contracts/:id/manage', component: 'tableDetection.ts', icon: 'detection', promptIds: ['P027', 'P028'] },
  { key: 'validation', label: 'Validation & Reasoning', route: '/sales-upload', component: 'validationService.ts', icon: 'validation', promptIds: ['P029', 'P030', 'P031', 'P033'] },
];

const SCREEN_ICONS: Record<string, typeof Layers> = {
  pipeline: Target,
  upload: FileText,
  rules: Zap,
  types: Layers,
  flow: ListChecks,
  subtype: ClipboardList,
  formula: Code2,
  detail: Eye,
  chat: Bot,
  erp: Database,
  detection: Search,
  validation: CheckCircle,
};

const PROMPT_FIELD_DEFS: { key: string; label: string; description: string }[] = [
  { key: 'extractionPrompt', label: 'Extraction Prompt (Legacy)', description: 'Used by the standard non-RAG entity extraction path.' },
  { key: 'ruleExtractionPrompt', label: 'Rule Extraction Prompt (Legacy)', description: 'Used by the standard non-RAG rule extraction path.' },
  { key: 'erpMappingPrompt', label: 'ERP Mapping Prompt', description: 'Guides AI when mapping ERP catalog values for this contract group.' },
  { key: 'sampleExtractionOutput', label: 'Sample Extraction Output (Legacy)', description: 'Few-shot example shown to the model during legacy extraction.' },
  { key: 'ragExtractionPrompt', label: 'RAG Extraction Prompt', description: 'Used by the RAG entity extraction path (preferred when populated).' },
  { key: 'ragRuleExtractionPrompt', label: 'RAG Rule Extraction Prompt', description: 'Used by the RAG rule extraction path (preferred when populated).' },
  { key: 'ragSampleExtractionOutput', label: 'RAG Sample Extraction Output', description: 'Few-shot example shown to the model during RAG extraction.' },
];

function AIPromptRegistryTab() {
  const { toast } = useToast();
  const [activeScreen, setActiveScreen] = useState('pipeline');
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const registryQuery = useQuery<{ prompts: RegistryPrompt[]; layers: any[]; totalCount: number }>({
    queryKey: ['/api/settings/ai-prompt-registry'],
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ promptId, customPrompt }: { promptId: string; customPrompt: string }) => {
      const res = await apiRequest('PUT', `/api/settings/ai-prompt-registry/${promptId}`, { customPrompt });
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: 'Prompt Updated', description: `${vars.promptId} saved successfully.` });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/ai-prompt-registry'] });
      setEditingPrompt(null);
      setEditValue('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const resetPromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const res = await apiRequest('POST', `/api/settings/ai-prompt-registry/${promptId}/reset`);
      return res.json();
    },
    onSuccess: (_, promptId) => {
      toast({ title: 'Prompt Reset', description: `${promptId} reset to default.` });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/ai-prompt-registry'] });
      setEditingPrompt(null);
      setEditValue('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const prompts = registryQuery.data?.prompts || [];
  const totalCount = registryQuery.data?.totalCount || 0;
  const customizedCount = prompts.filter(p => p.isCustomized).length;
  const promptMap = new Map(prompts.map(p => [p.id, p]));

  const activeGroup = SCREEN_GROUPS.find(g => g.key === activeScreen) || SCREEN_GROUPS[0];
  const screenPrompts = activeGroup.promptIds.map(id => promptMap.get(id)).filter(Boolean) as RegistryPrompt[];

  const toggleExpanded = (id: string) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startEdit = (p: RegistryPrompt) => {
    setEditingPrompt(p.id);
    setEditValue(p.customPrompt || p.defaultPrompt);
  };

  if (registryQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading AI Prompt Registry...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          AI Prompt Registry
        </CardTitle>
        <CardDescription>
          {totalCount} prompts across the platform. Select a screen to view and customize its prompts.
        </CardDescription>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <Badge variant="secondary">{totalCount} Total</Badge>
          <Badge variant="outline" className="border-orange-300 text-orange-600 dark:text-orange-400">{customizedCount} Customized</Badge>
          <Badge variant="outline">{totalCount - customizedCount} Using Defaults</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 min-h-[500px]">
          <div className="w-56 shrink-0 border-r pr-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Screens</p>
            <div className="space-y-0.5">
              {SCREEN_GROUPS.map(group => {
                const Icon = SCREEN_ICONS[group.icon] || Layers;
                const groupPrompts = group.promptIds.map(id => promptMap.get(id)).filter(Boolean);
                const hasCustom = groupPrompts.some(p => p?.isCustomized);
                const isActive = activeScreen === group.key;
                return (
                  <button
                    key={group.key}
                    onClick={() => { setActiveScreen(group.key); setEditingPrompt(null); setEditValue(''); }}
                    className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium'
                        : 'hover:bg-muted/50 text-muted-foreground'
                    }`}
                    data-testid={`screen-nav-${group.key}`}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{group.label}</span>
                        <span className={`text-[10px] shrink-0 ${isActive ? 'text-orange-600' : ''}`}>{group.promptIds.length}</span>
                        {hasCustom && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{group.route}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 text-[10px] text-muted-foreground">
              <p className="font-semibold mb-1">Priority Order</p>
              <p>1. Custom Override</p>
              <p>2. Subtype Prompt</p>
              <p>3. Flow Type Prompt</p>
              <p>4. Contract Type Prompt</p>
              <p>5. Built-in Default</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                {(() => { const Icon = SCREEN_ICONS[activeGroup.icon] || Layers; return <Icon className="w-5 h-5 text-orange-600" />; })()}
                <h3 className="text-lg font-semibold">{activeGroup.label}</h3>
                {!activeGroup.kind && (
                  <Badge variant="secondary" className="ml-auto">{screenPrompts.length} prompt{screenPrompts.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{activeGroup.route}</span>
                <span className="font-mono">{activeGroup.component}</span>
              </div>
            </div>

            {activeGroup.kind === 'flow' && <DBPromptPanel kind="flow" />}
            {activeGroup.kind === 'subtype' && <DBPromptPanel kind="subtype" />}
            {!activeGroup.kind && (
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-3">
                {screenPrompts.map((p) => {
                  const isExpanded = expandedPrompts.has(p.id);
                  const isEditing = editingPrompt === p.id;
                  return (
                    <div key={p.id} className={`border rounded-lg overflow-hidden ${p.isCustomized ? 'border-orange-300 dark:border-orange-700' : ''}`} data-testid={`prompt-card-${p.id}`}>
                      <div
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        onClick={() => toggleExpanded(p.id)}
                        data-testid={`prompt-toggle-${p.id}`}
                      >
                        <Badge variant="outline" className="shrink-0 font-mono text-xs mt-0.5">{p.id}</Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-tight">{p.name}</p>
                            {p.isCustomized && <Badge className="bg-orange-600 text-white text-[10px] h-4">Customized</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Trigger: {p.trigger}</span>
                            <span className="text-[10px] text-muted-foreground">|</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{p.sourceFile}</span>
                            <span className="text-[10px] text-orange-600 dark:text-orange-400">{p.provider}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          {p.outputFormat && (
                            <Badge variant="outline" className="text-[10px] h-5 hidden sm:inline-flex">
                              <Code2 className="w-3 h-3 mr-0.5" />
                              {p.outputFormat.length > 20 ? p.outputFormat.substring(0, 20) + '...' : p.outputFormat}
                            </Badge>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t p-3 bg-slate-50/50 dark:bg-slate-950/50">
                          {p.placeholders && p.placeholders.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">Placeholders:</span>
                              {p.placeholders.map((ph) => (
                                <Badge key={ph} variant="outline" className="font-mono text-[10px] h-5">{ph}</Badge>
                              ))}
                            </div>
                          )}
                          {p.outputFormat && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground">Output:</span>
                              <span className="text-xs">{p.outputFormat}</span>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="space-y-2 mt-2">
                              <Label className="text-xs font-semibold">Edit Prompt</Label>
                              <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="min-h-[200px] font-mono text-xs"
                                data-testid={`textarea-edit-${p.id}`}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updatePromptMutation.mutate({ promptId: p.id, customPrompt: editValue })}
                                  disabled={updatePromptMutation.isPending}
                                  data-testid={`btn-save-${p.id}`}
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  Save Custom Override
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingPrompt(null); setEditValue(''); }}
                                  data-testid={`btn-cancel-${p.id}`}
                                >
                                  Cancel
                                </Button>
                                {p.isCustomized && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => resetPromptMutation.mutate(p.id)}
                                    disabled={resetPromptMutation.isPending}
                                    data-testid={`btn-reset-${p.id}`}
                                  >
                                    <RotateCw className="w-3 h-3 mr-1" />
                                    Reset to Default
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold">
                                  {p.isCustomized ? 'Custom Override (Active)' : 'Default Prompt (Active)'}
                                </Label>
                                <div className="flex items-center gap-1">
                                  {p.editable && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                                      data-testid={`btn-edit-${p.id}`}
                                    >
                                      <Pencil className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                  )}
                                  {p.isCustomized && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-red-600"
                                      onClick={(e) => { e.stopPropagation(); resetPromptMutation.mutate(p.id); }}
                                      data-testid={`btn-reset-inline-${p.id}`}
                                    >
                                      <RotateCw className="w-3 h-3 mr-1" />
                                      Reset
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-slate-900 border rounded p-3 max-h-[300px] overflow-auto" data-testid={`prompt-text-${p.id}`}>
                                {p.isCustomized ? p.customPrompt : p.defaultPrompt}
                              </pre>
                              {p.isCustomized && (
                                <Collapsible className="mt-2">
                                  <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> View Original Default
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-100 dark:bg-slate-800 border rounded p-3 max-h-[200px] overflow-auto mt-1 opacity-70">
                                      {p.defaultPrompt}
                                    </pre>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {screenPrompts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No prompts registered for this screen yet.
                  </div>
                )}
              </div>
            </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type DBPromptEntry = {
  flowTypeCode?: string;
  subtypeCode?: string;
  flowTypeName?: string;
  subtypeName?: string;
  subtypeCategory?: string | null;
  description?: string | null;
  hasDefaults: boolean;
  isCustomized: boolean;
  prompts: Record<string, any> | null;
};

function DBPromptPanel({ kind }: { kind: 'flow' | 'subtype' }) {
  const { toast } = useToast();
  const endpoint = kind === 'flow' ? '/api/settings/flow-type-prompts' : '/api/settings/subtype-prompts';
  const codeKey = kind === 'flow' ? 'flowTypeCode' : 'subtypeCode';
  const nameKey = kind === 'flow' ? 'flowTypeName' : 'subtypeName';

  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const { data, isLoading } = useQuery<{ entries: DBPromptEntry[] }>({
    queryKey: [endpoint],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ code, body }: { code: string; body: Record<string, any> }) => {
      const res = await apiRequest('PUT', `${endpoint}/${encodeURIComponent(code)}`, body);
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: 'Prompts Saved', description: `${vars.code} updated.` });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setDrafts(prev => { const n = { ...prev }; delete n[vars.code]; return n; });
    },
    onError: (err: any) => toast({ title: 'Save Failed', description: err.message, variant: 'destructive' }),
  });

  const resetMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', `${endpoint}/${encodeURIComponent(code)}/reset`);
      return res.json();
    },
    onSuccess: (_, code) => {
      toast({ title: 'Reset to Defaults', description: `${code} restored to seeded defaults.` });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setDrafts(prev => { const n = { ...prev }; delete n[code]; return n; });
    },
    onError: (err: any) => toast({ title: 'Reset Failed', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading {kind === 'flow' ? 'flow type' : 'subtype'} prompts...
      </div>
    );
  }

  const entries = data?.entries || [];

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No {kind === 'flow' ? 'flow types' : 'subtypes'} configured yet.
      </div>
    );
  }

  const currentCode = activeCode && entries.some(e => (e as any)[codeKey] === activeCode)
    ? activeCode
    : (entries[0] as any)[codeKey] as string;
  const currentEntry = entries.find(e => (e as any)[codeKey] === currentCode)!;
  const currentName = (currentEntry as any)[nameKey] as string;
  const isDirty = !!drafts[currentCode] && Object.keys(drafts[currentCode]).length > 0;

  const fieldValue = (code: string, field: string, base: string) =>
    drafts[code]?.[field] ?? base;
  const setFieldValue = (code: string, field: string, value: string) =>
    setDrafts(prev => ({ ...prev, [code]: { ...(prev[code] || {}), [field]: value } }));

  return (
    <div data-testid={`db-prompt-tabs-${kind}`}>
      {/* Horizontal tab strip — one tab per code, wraps on small widths */}
      <div className="border-b border-border mb-4">
        <div className="flex flex-wrap gap-1" role="tablist">
          {entries.map((entry) => {
            const code = (entry as any)[codeKey] as string;
            const name = (entry as any)[nameKey] as string;
            const isActive = code === currentCode;
            const tabIsDirty = !!drafts[code] && Object.keys(drafts[code]).length > 0;
            return (
              <button
                key={code}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCode(code)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'border-orange-500 text-orange-700 dark:text-orange-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
                data-testid={`db-prompt-tab-${code}`}
              >
                <span className="font-mono">{code}</span>
                <span className="hidden md:inline">— {name}</span>
                {entry.isCustomized && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                {tabIsDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div className="mb-3 flex items-start gap-2 flex-wrap">
        <Badge variant="outline" className="font-mono text-xs">{currentCode}</Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{currentName}</p>
          {currentEntry.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{currentEntry.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {currentEntry.isCustomized && <Badge className="bg-orange-600 text-white text-[10px] h-5">Customized</Badge>}
          {!currentEntry.hasDefaults && <Badge variant="outline" className="text-[10px] h-5">No Defaults</Badge>}
          {currentEntry.subtypeCategory && (
            <Badge variant="secondary" className="text-[10px] h-5 capitalize">{currentEntry.subtypeCategory}</Badge>
          )}
          {isDirty && <Badge variant="outline" className="text-[10px] h-5 border-amber-500 text-amber-700 dark:text-amber-300">Unsaved</Badge>}
        </div>
      </div>

      <ScrollArea className="h-[440px] pr-2">
        <div className="space-y-4 pb-2">
          {PROMPT_FIELD_DEFS.map((field) => {
            const base = currentEntry.prompts?.[field.key] ?? '';
            const value = fieldValue(currentCode, field.key, typeof base === 'string' ? base : '');
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-semibold">{field.label}</Label>
                <p className="text-[11px] text-muted-foreground">{field.description}</p>
                <Textarea
                  value={value}
                  onChange={(e) => setFieldValue(currentCode, field.key, e.target.value)}
                  className="min-h-[120px] font-mono text-xs"
                  placeholder={`No ${field.label.toLowerCase()} configured. Saved value falls through to next layer in the cascade.`}
                  data-testid={`textarea-${kind}-${currentCode}-${field.key}`}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1 sticky bottom-0 bg-background/95 backdrop-blur-sm py-2 -mx-2 px-2 border-t">
            <Button
              size="sm"
              onClick={() => {
                const body: Record<string, any> = {};
                for (const f of PROMPT_FIELD_DEFS) {
                  const base = currentEntry.prompts?.[f.key] ?? '';
                  body[f.key] = fieldValue(currentCode, f.key, typeof base === 'string' ? base : '');
                }
                saveMutation.mutate({ code: currentCode, body });
              }}
              disabled={!isDirty || saveMutation.isPending}
              data-testid={`btn-save-${kind}-${currentCode}`}
            >
              <Save className="w-3 h-3 mr-1" />
              Save All Prompts
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDrafts(prev => { const n = { ...prev }; delete n[currentCode]; return n; })}
              disabled={!isDirty}
              data-testid={`btn-discard-${kind}-${currentCode}`}
            >
              Discard Changes
            </Button>
            {currentEntry.hasDefaults && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => resetMutation.mutate(currentCode)}
                disabled={resetMutation.isPending}
                data-testid={`btn-reset-${kind}-${currentCode}`}
              >
                <RotateCw className="w-3 h-3 mr-1" />
                Reset to Defaults
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function RefDataTable({ title, endpoint, columns, emptyText }: {
  title: string; endpoint: string; columns: { key: string; label: string; editable?: boolean; options?: { value: string; label: string }[] }[];
  emptyText: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [addValues, setAddValues] = useState<Record<string, string>>({});

  const query = useQuery<any[]>({
    queryKey: [endpoint],
    queryFn: () => fetch(endpoint, { credentials: 'include' }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest('POST', endpoint, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Created', description: `${title} record created.` });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setAdding(false);
      setAddValues({});
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      const res = await apiRequest('PUT', `${endpoint}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: `${title} record updated.` });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setEditing(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `${endpoint}/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: `${title} record deleted.` });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const items = query.data || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{items.length}</Badge>
            <Button variant="outline" size="sm" onClick={() => { setAdding(true); setAddValues({}); }} data-testid={`btn-add-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex justify-center py-4"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {adding && (
              <div className="border rounded-lg p-3 bg-orange-50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {columns.filter(c => c.editable !== false).map(col => (
                    <div key={col.key}>
                      <Label className="text-xs">{col.label}</Label>
                      {col.options ? (
                        <Select value={addValues[col.key] || ''} onValueChange={v => setAddValues(prev => ({ ...prev, [col.key]: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid={`select-add-${col.key}`}><SelectValue placeholder={`Select ${col.label}`} /></SelectTrigger>
                          <SelectContent>
                            {col.options.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input className="mt-1 h-8 text-sm" value={addValues[col.key] || ''} onChange={e => setAddValues(prev => ({ ...prev, [col.key]: e.target.value }))} data-testid={`input-add-${col.key}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => createMutation.mutate(addValues)} disabled={createMutation.isPending}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            )}
            {items.map((item: any) => (
              <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between gap-4">
                {editing === item.id ? (
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {columns.filter(c => c.editable !== false).map(col => (
                        <div key={col.key}>
                          <Label className="text-xs">{col.label}</Label>
                          {col.options ? (
                            <Select value={editValues[col.key] || ''} onValueChange={v => setEditValues(prev => ({ ...prev, [col.key]: v }))}>
                              <SelectTrigger className="mt-1 h-8 text-sm" data-testid={`select-edit-${col.key}`}><SelectValue placeholder={`Select ${col.label}`} /></SelectTrigger>
                              <SelectContent>
                                {col.options.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input className="mt-1 h-8 text-sm" value={editValues[col.key] || ''} onChange={e => setEditValues(prev => ({ ...prev, [col.key]: e.target.value }))} data-testid={`input-edit-${col.key}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => updateMutation.mutate({ id: item.id, data: editValues })} disabled={updateMutation.isPending}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {columns.map(col => {
                          const displayVal = col.options
                            ? col.options.find(o => o.value === item[col.key])?.label || item[col.key]
                            : item[col.key];
                          return (
                            <span key={col.key} className="text-sm">
                              <span className="text-muted-foreground text-xs">{col.label}:</span>{' '}
                              <span className="font-medium">{displayVal || '—'}</span>
                              {col !== columns[columns.length - 1] && <span className="text-muted-foreground mx-2">|</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(item.id); const vals: Record<string, string> = {}; columns.forEach(c => { vals[c.key] = item[c.key] || ''; }); setEditValues(vals); }} data-testid={`btn-edit-ref-${item.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete this ${title} record?`)) deleteMutation.mutate(item.id); }} data-testid={`btn-delete-ref-${item.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {items.length === 0 && !adding && (
              <div className="text-center text-muted-foreground py-6 text-sm">{emptyText}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SmtpSettingsPanel({ settings, getValue, handleChange, onSave, isSaving, toast }: {
  settings: SystemSettings | undefined;
  getValue: (key: keyof SystemSettings, defaultValue?: any) => any;
  handleChange: (key: string, value: any) => void;
  onSave: () => void;
  isSaving: boolean;
  toast: any;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const smtpHost = getValue('smtpHost', 'smtppro.zoho.com');
  const smtpPort = getValue('smtpPort', 465);
  const smtpSecure = getValue('smtpSecure', true);
  const smtpUser = getValue('smtpUser', 'info@licenseiq.ai');
  const smtpPassword = getValue('smtpPassword', '');
  const smtpFromName = getValue('smtpFromName', 'LicenseIQ');
  const smtpFromEmail = getValue('smtpFromEmail', 'info@licenseiq.ai');
  const passwordSource = settings?.smtpPasswordSource || 'none';

  const getSmtpPayload = () => ({
    smtpHost, smtpPort: Number(smtpPort), smtpSecure,
    smtpUser, smtpPassword, smtpFromName, smtpFromEmail,
  });

  const handleTestConnection = async () => {
    if (!smtpPassword && !passwordIsSet) {
      toast({ title: "Password required", description: "Enter the SMTP password before testing.", variant: "destructive" });
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const resp = await fetch('/api/settings/smtp/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getSmtpPayload()),
        credentials: 'include',
      });
      const result = await resp.json();
      setConnectionStatus(result);
      toast({ title: result.success ? "Connection Successful" : "Connection Failed", description: result.message, variant: result.success ? "default" : "destructive" });
    } catch {
      setConnectionStatus({ success: false, message: 'Network error' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient) {
      toast({ title: "Recipient required", description: "Enter an email address to send the test to.", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    try {
      const resp = await fetch('/api/settings/smtp/test-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getSmtpPayload(), testRecipient }),
        credentials: 'include',
      });
      const result = await resp.json();
      toast({ title: result.success ? "Test Email Sent" : "Send Failed", description: result.message, variant: result.success ? "default" : "destructive" });
    } catch {
      toast({ title: "Error", description: "Network error sending test email.", variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure outgoing email settings for notifications, early access signups, and demo requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="smtpHost" data-testid="label-smtp-host">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={smtpHost}
                onChange={e => handleChange('smtpHost', e.target.value)}
                placeholder="smtppro.zoho.com"
                data-testid="input-smtp-host"
              />
              <p className="text-xs text-muted-foreground">e.g. smtppro.zoho.com, smtp.gmail.com, smtp.office365.com</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpPort" data-testid="label-smtp-port">Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpPort}
                  onChange={e => handleChange('smtpPort', parseInt(e.target.value) || 465)}
                  data-testid="input-smtp-port"
                />
              </div>
              <div className="space-y-2">
                <Label data-testid="label-smtp-secure">SSL / TLS</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={smtpSecure}
                    onCheckedChange={v => handleChange('smtpSecure', v)}
                    data-testid="switch-smtp-secure"
                  />
                  <span className="text-sm text-muted-foreground">{smtpSecure ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="smtpUser" data-testid="label-smtp-user">Username / Email</Label>
              <Input
                id="smtpUser"
                value={smtpUser}
                onChange={e => handleChange('smtpUser', e.target.value)}
                placeholder="info@licenseiq.ai"
                data-testid="input-smtp-user"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword" data-testid="label-smtp-password">
                Password
                {passwordSource === 'database' && <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">From Database</Badge>}
                {passwordSource === 'environment' && <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">From Env Variable</Badge>}
                {passwordSource === 'none' && <Badge variant="outline" className="ml-2 text-xs bg-red-50 text-red-700 border-red-200">Not Set</Badge>}
              </Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={e => handleChange('smtpPassword', e.target.value)}
                  placeholder="Enter SMTP password"
                  data-testid="input-smtp-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {passwordSource === 'environment' && (
                <p className="text-xs text-blue-600">Currently using the ZOHO_PASSWORD environment variable. Save a new password here to switch to database storage.</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="smtpFromName" data-testid="label-smtp-from-name">From Name</Label>
              <Input
                id="smtpFromName"
                value={smtpFromName}
                onChange={e => handleChange('smtpFromName', e.target.value)}
                placeholder="LicenseIQ"
                data-testid="input-smtp-from-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpFromEmail" data-testid="label-smtp-from-email">From Email</Label>
              <Input
                id="smtpFromEmail"
                value={smtpFromEmail}
                onChange={e => handleChange('smtpFromEmail', e.target.value)}
                placeholder="info@licenseiq.ai"
                data-testid="input-smtp-from-email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Test</CardTitle>
          <CardDescription>Verify your SMTP settings before saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection}
              variant="outline"
              data-testid="button-test-smtp-connection"
            >
              {testingConnection ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            {connectionStatus && (
              <div className={`flex items-center gap-2 text-sm ${connectionStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {connectionStatus.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {connectionStatus.message}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="testRecipient" data-testid="label-test-recipient">Send Test Email</Label>
            <div className="flex items-center gap-3">
              <Input
                id="testRecipient"
                type="email"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                placeholder="your-email@example.com"
                className="max-w-sm"
                data-testid="input-test-recipient"
              />
              <Button
                onClick={handleSendTestEmail}
                disabled={sendingTest || !testRecipient}
                variant="outline"
                data-testid="button-send-test-email"
              >
                {sendingTest ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700"
          data-testid="button-save-smtp-settings"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save SMTP Settings
        </Button>
      </div>
    </div>
  );
}

function RuleTemplatesPanel() {
  const { toast } = useToast();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<{ typeCode: string; slotIndex: number } | null>(null);
  const [addingSlot, setAddingSlot] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState({
    slotId: '',
    slotName: '',
    required: false,
    repeatable: false,
    ruleType: 'percentage',
    defaultPriority: 1,
    description: '',
    extractionHint: '',
    qualifiers: 'none' as 'none' | 'product' | 'territory',
  });

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ['/api/settings/rule-templates'],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ contractTypeCode, template }: { contractTypeCode: string; template: any }) => {
      await apiRequest('PUT', `/api/settings/rule-templates/${contractTypeCode}`, { template });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/rule-templates'] });
      toast({ title: 'Template saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save template', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (contractTypeCode: string) => {
      await apiRequest('POST', `/api/settings/rule-templates/${contractTypeCode}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/rule-templates'] });
      toast({ title: 'Template reset to default' });
    },
  });

  const handleDeleteSlot = (typeCode: string, template: any, slotIndex: number) => {
    const updatedSlots = [...template.ruleSlots];
    updatedSlots.splice(slotIndex, 1);
    saveMutation.mutate({
      contractTypeCode: typeCode,
      template: { ...template, contractTypeCode: typeCode, ruleSlots: updatedSlots, validationRules: template.validationRules || [] },
    });
  };

  const handleAddSlot = (typeCode: string, template: any) => {
    const qualifiersValue = newSlot.qualifiers === 'none' 
      ? 'none'
      : { required: [newSlot.qualifiers], lookupEntity: newSlot.qualifiers === 'product' ? 'products OR product_hierarchy' : 'territory_master', matchAgainst: newSlot.qualifiers === 'product' ? 'product_name, hierarchy_value' : 'territory_name' };

    const slotData = {
      slotId: newSlot.slotId || newSlot.slotName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      slotName: newSlot.slotName,
      required: newSlot.required,
      repeatable: newSlot.repeatable,
      ruleType: newSlot.ruleType,
      defaultPriority: newSlot.defaultPriority,
      description: newSlot.description,
      extractionHint: newSlot.extractionHint,
      expectedFields: { base_rate: { type: 'decimal', required: true } },
      qualifiers: qualifiersValue,
    };

    const existingSlots = template?.ruleSlots || [];
    saveMutation.mutate({
      contractTypeCode: typeCode,
      template: { 
        contractTypeCode: typeCode, 
        ruleSlots: [...existingSlots, slotData], 
        validationRules: template?.validationRules || [] 
      },
    });
    setAddingSlot(null);
    setNewSlot({ slotId: '', slotName: '', required: false, repeatable: false, ruleType: 'percentage', defaultPriority: 1, description: '', extractionHint: '', qualifiers: 'none' });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Rule Extraction Templates
          </CardTitle>
          <CardDescription>
            Define expected rule slots per contract type to guide AI extraction. Templates tell the AI what rules to look for and how to structure them — improving extraction accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates?.map((item: any) => (
            <Collapsible
              key={item.contractTypeCode}
              open={expandedType === item.contractTypeCode}
              onOpenChange={(open) => setExpandedType(open ? item.contractTypeCode : null)}
            >
              <CollapsibleTrigger className="w-full" data-testid={`rule-template-trigger-${item.contractTypeCode}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{item.contractTypeName}</span>
                    <Badge variant={item.hasTemplate ? "default" : "outline"} className={item.hasTemplate ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}>
                      {item.hasTemplate ? `${item.slotCount} slots` : 'No template'}
                    </Badge>
                    {item.isCustomized && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Customized</Badge>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedType === item.contractTypeCode ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 ml-4 p-4 border rounded-lg bg-card space-y-4">
                  {item.template?.ruleSlots?.map((slot: any, idx: number) => (
                    <div key={slot.slotId || idx} className="p-3 border rounded-md space-y-2 bg-background" data-testid={`rule-slot-${item.contractTypeCode}-${idx}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{slot.slotName}</span>
                          <Badge variant={slot.required ? "default" : "outline"} className="text-xs">
                            {slot.required ? 'Required' : 'Optional'}
                          </Badge>
                          {slot.repeatable && (
                            <Badge variant="outline" className="text-xs">Repeatable</Badge>
                          )}
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Priority {slot.defaultPriority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSlot(item.contractTypeCode, item.template, idx)} data-testid={`delete-slot-${item.contractTypeCode}-${idx}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{slot.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Rule Type:</span>{' '}
                          <span className="font-mono">{Array.isArray(slot.ruleType) ? slot.ruleType.join(', ') : slot.ruleType}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Qualifiers:</span>{' '}
                          <span className={slot.qualifiers === 'none' ? 'text-green-600' : 'text-orange-600'}>
                            {slot.qualifiers === 'none' ? 'None (catch-all)' : `Required: ${slot.qualifiers.required?.join(', ')}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Extraction Hint:</span>{' '}
                        <span className="italic">{slot.extractionHint}</span>
                      </div>
                    </div>
                  ))}

                  {!item.template?.ruleSlots?.length && (
                    <div className="text-center text-muted-foreground py-4">No rule slots defined for this contract type</div>
                  )}

                  {addingSlot === item.contractTypeCode ? (
                    <div className="p-3 border-2 border-dashed rounded-md space-y-3 bg-accent/30">
                      <div className="font-medium text-sm">Add Rule Slot</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Slot Name *</Label>
                          <Input 
                            value={newSlot.slotName} 
                            onChange={e => setNewSlot({ ...newSlot, slotName: e.target.value })} 
                            placeholder="e.g., General Rebate Rate"
                            data-testid="input-slot-name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rule Type</Label>
                          <Select value={newSlot.ruleType} onValueChange={v => setNewSlot({ ...newSlot, ruleType: v })}>
                            <SelectTrigger data-testid="select-slot-rule-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="per_unit">Per Unit</SelectItem>
                              <SelectItem value="tiered">Tiered</SelectItem>
                              <SelectItem value="fixed_price">Fixed Price</SelectItem>
                              <SelectItem value="minimum_guarantee">Minimum Guarantee</SelectItem>
                              <SelectItem value="cap">Cap / Ceiling</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Priority (1 = lowest)</Label>
                          <Input 
                            type="number" 
                            value={newSlot.defaultPriority} 
                            onChange={e => setNewSlot({ ...newSlot, defaultPriority: parseInt(e.target.value) || 1 })}
                            data-testid="input-slot-priority"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Qualifiers</Label>
                          <Select value={newSlot.qualifiers} onValueChange={(v: any) => setNewSlot({ ...newSlot, qualifiers: v })}>
                            <SelectTrigger data-testid="select-slot-qualifiers"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (catch-all)</SelectItem>
                              <SelectItem value="product">Product required</SelectItem>
                              <SelectItem value="territory">Territory required</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input 
                          value={newSlot.description} 
                          onChange={e => setNewSlot({ ...newSlot, description: e.target.value })} 
                          placeholder="What this rule slot represents"
                          data-testid="input-slot-description"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Extraction Hint (tells AI what to look for)</Label>
                        <Textarea 
                          value={newSlot.extractionHint} 
                          onChange={e => setNewSlot({ ...newSlot, extractionHint: e.target.value })} 
                          placeholder="What phrases or terms should the AI look for in the contract?"
                          rows={2}
                          data-testid="input-slot-extraction-hint"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={newSlot.required} onChange={e => setNewSlot({ ...newSlot, required: e.target.checked })} />
                          Required
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={newSlot.repeatable} onChange={e => setNewSlot({ ...newSlot, repeatable: e.target.checked })} />
                          Repeatable (multiple rules)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleAddSlot(item.contractTypeCode, item.template)} disabled={!newSlot.slotName} data-testid="btn-save-slot">
                          <Save className="w-3 h-3 mr-1" /> Save Slot
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingSlot(null)} data-testid="btn-cancel-slot">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAddingSlot(item.contractTypeCode)} data-testid={`btn-add-slot-${item.contractTypeCode}`}>
                        <Plus className="w-3 h-3 mr-1" /> Add Slot
                      </Button>
                      {item.isCustomized && (
                        <Button size="sm" variant="outline" onClick={() => resetMutation.mutate(item.contractTypeCode)} data-testid={`btn-reset-template-${item.contractTypeCode}`}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Reset to Default
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {(!templates || templates.length === 0) && (
            <div className="text-center text-muted-foreground py-8">No contract types found. Add contract types first.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceHubPanel() {
  const { toast } = useToast();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodLabel, setNewPeriodLabel] = useState("");
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [editPeriodLabel, setEditPeriodLabel] = useState("");

  const { data: periods = [], isLoading: periodsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/periods"],
  });

  const { data: checklist = [], isLoading: checklistLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/periods", selectedPeriodId, "checklist"],
    enabled: !!selectedPeriodId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/periods/${selectedPeriodId}/checklist`);
      if (!res.ok) throw new Error("Failed to fetch checklist");
      return res.json();
    },
  });

  const { data: auditTrail = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/period-audit-trail"],
  });

  const createPeriodMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/admin/periods", { periodLabel: label });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods"] });
      setShowAddPeriod(false);
      setNewPeriodLabel("");
      toast({ title: "Period created" });
    },
  });

  const updatePeriodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/periods/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods"] });
      setEditingPeriod(null);
      toast({ title: "Period updated" });
    },
  });

  const deletePeriodMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/periods/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods"] });
      if (selectedPeriodId) setSelectedPeriodId(null);
      toast({ title: "Period deleted" });
    },
  });

  const addChecklistMutation = useMutation({
    mutationFn: async ({ periodId, itemName }: { periodId: string; itemName: string }) => {
      const res = await apiRequest("POST", `/api/admin/periods/${periodId}/checklist`, { itemName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods", selectedPeriodId, "checklist"] });
      setShowAddChecklist(false);
      setNewChecklistItem("");
      toast({ title: "Checklist item added" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/checklist/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods", selectedPeriodId, "checklist"] });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/checklist/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods", selectedPeriodId, "checklist"] });
      toast({ title: "Checklist item removed" });
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const res = await apiRequest("POST", `/api/admin/periods/${periodId}/auto-populate`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close"] });
      toast({ title: "Period populated", description: `${data.accrualsMapped} contracts mapped, readiness: ${data.readinessScore}%` });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Finance Hub Configuration</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Manage period definitions and close checklists. Accruals and journal entries are automatically generated when contract fee calculations are completed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Period Definitions
          </CardTitle>
          <CardDescription>Define fiscal periods for close tracking and reporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            {showAddPeriod ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g., Mar 2026"
                  value={newPeriodLabel}
                  onChange={(e) => setNewPeriodLabel(e.target.value)}
                  className="w-48"
                  data-testid="input-new-period"
                />
                <Button size="sm" onClick={() => createPeriodMutation.mutate(newPeriodLabel)} disabled={!newPeriodLabel || createPeriodMutation.isPending} data-testid="button-save-period">
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPeriod(false)} data-testid="button-cancel-period">
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowAddPeriod(true)} data-testid="button-add-period">
                <Plus className="w-4 h-4 mr-1" /> Add Period
              </Button>
            )}
          </div>

          {periodsLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading periods...</div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No periods defined. Add your first fiscal period above.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-4 py-2 text-left font-medium">Period</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Readiness</th>
                    <th className="px-4 py-2 text-left font-medium">Created</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p: any) => (
                    <tr key={p.id} className={`border-b hover:bg-muted/30 cursor-pointer ${selectedPeriodId === p.id ? "bg-orange-50 dark:bg-orange-900/20" : ""}`} onClick={() => setSelectedPeriodId(p.id === selectedPeriodId ? null : p.id)} data-testid={`row-period-${p.id}`}>
                      <td className="px-4 py-2 font-medium">
                        {editingPeriod === p.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Input value={editPeriodLabel} onChange={(e) => setEditPeriodLabel(e.target.value)} className="w-36 h-7 text-sm" data-testid="input-edit-period" />
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updatePeriodMutation.mutate({ id: p.id, data: { periodLabel: editPeriodLabel } })} data-testid="button-save-edit-period">
                              <Save className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : p.periodLabel}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={p.status === "approved" ? "default" : p.status === "open" ? "outline" : "secondary"} className={p.status === "approved" ? "bg-green-600" : p.status === "open" ? "border-orange-500 text-orange-600" : ""}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div className="h-2 rounded-full bg-orange-500" style={{ width: `${p.readinessScore || 0}%` }} />
                          </div>
                          <span className="text-xs">{p.readinessScore || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}</td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Auto-populate from calculations" onClick={() => autoPopulateMutation.mutate(p.id)} disabled={autoPopulateMutation.isPending} data-testid={`button-populate-${p.id}`}>
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingPeriod(p.id); setEditPeriodLabel(p.periodLabel); }} data-testid={`button-edit-period-${p.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => deletePeriodMutation.mutate(p.id)} disabled={p.status === "approved"} data-testid={`button-delete-period-${p.id}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPeriodId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Period Close Checklist
            </CardTitle>
            <CardDescription>Define the checklist items required to close the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              {showAddChecklist ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., Verify all accruals posted"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    className="w-72"
                    data-testid="input-new-checklist"
                  />
                  <Button size="sm" onClick={() => addChecklistMutation.mutate({ periodId: selectedPeriodId, itemName: newChecklistItem })} disabled={!newChecklistItem || addChecklistMutation.isPending} data-testid="button-save-checklist">
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddChecklist(false)} data-testid="button-cancel-checklist">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowAddChecklist(true)} data-testid="button-add-checklist">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              )}
            </div>

            {checklistLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading checklist...</div>
            ) : checklist.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No checklist items defined for this period.</div>
            ) : (
              <div className="space-y-2">
                {checklist.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/30" data-testid={`checklist-item-${item.id}`}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateChecklistMutation.mutate({ id: item.id, data: { status: item.status === "completed" ? "idle" : "completed" } })}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.status === "completed" ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}
                        data-testid={`toggle-checklist-${item.id}`}
                      >
                        {item.status === "completed" && <CheckCircle className="w-3 h-3" />}
                      </button>
                      <span className={item.status === "completed" ? "line-through text-muted-foreground" : ""}>{item.itemName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "completed" && item.completedAt && (
                        <span className="text-xs text-muted-foreground">{new Date(item.completedAt).toLocaleDateString()}</span>
                      )}
                      <Badge variant={item.status === "completed" ? "default" : item.status === "in_progress" ? "secondary" : "outline"} className={item.status === "completed" ? "bg-green-600" : ""}>
                        {item.status}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => deleteChecklistMutation.mutate(item.id)} data-testid={`delete-checklist-${item.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Period Close Audit Trail
          </CardTitle>
          <CardDescription>View-only log of all period close activities</CardDescription>
        </CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit trail entries yet.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {auditTrail.slice(0, 50).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 border-l-2 pl-4 py-1" style={{ borderColor: entry.iconColor === "green" ? "#22c55e" : entry.iconColor === "orange" ? "#f97316" : entry.iconColor === "red" ? "#ef4444" : "#9ca3af" }} data-testid={`audit-entry-${entry.id}`}>
                  <div className="flex-1">
                    <p className="text-sm">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{entry.userName || "System"}</span>
                      {entry.userRole && <Badge variant="outline" className="text-xs">{entry.userRole}</Badge>}
                      <span className="text-xs text-muted-foreground">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReferenceDataPanel() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Pipeline Reference Data — moved</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Flow types, program subtypes, the flow × subtype validity matrix, and all other contract
          reference lookups now live in a single place: <strong>Contract Reference Lookups</strong>.
        </p>
      </div>
      <Card>
        <CardContent className="p-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium">Open the new home for reference data</p>
            <p className="text-sm text-muted-foreground">Manage Flow Types, Program Subtypes, the Flow × Subtype matrix, Execution Groups, Rule Templates, Base Metrics, Clause Categories, Customer Segments, Sales Channels, Territories and more.</p>
          </div>
          <Button onClick={() => setLocation('/licenseiq-schema')} className="bg-orange-600 hover:bg-orange-700 text-white shrink-0" data-testid="button-goto-reference-lookups">
            Go to Contract Reference Lookups
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedContractType, setExpandedContractType] = useState<string | null>(null);
  const [contractTypePrompts, setContractTypePrompts] = useState<Record<string, Partial<ContractTypeWithPrompts>>>({});
  const [editingCtId, setEditingCtId] = useState<string | null>(null);
  const [addingCt, setAddingCt] = useState(false);
  const [ctForm, setCtForm] = useState<{ code: string; name: string; description: string; icon: string; color: string; partyRoleSlots: Array<{ role: string; required: boolean; allowMultiple?: boolean }> }>({ code: '', name: '', description: '', icon: '', color: '', partyRoleSlots: [] });
  const [editingCftId, setEditingCftId] = useState<string | null>(null);
  const [addingCft, setAddingCft] = useState(false);
  const [cftFilter, setCftFilter] = useState<string>('');
  const [cftForm, setCftForm] = useState({ contractTypeCode: '', fieldCode: '', fieldName: '', fieldCategory: 'basis', description: '', isRequired: false, sortOrder: 0, defaultColumnPatterns: '', dataType: 'number' });
  
  const isSystemAdmin = user?.isSystemAdmin === true;
  
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/system'],
  });

  const { data: contractTypes, isLoading: typesLoading } = useQuery<ContractTypeWithPrompts[]>({
    queryKey: ['/api/contract-types'],
  });

  const { data: partyRoleCatalog } = useQuery<{ all: Array<{ role: string; label: string; category: 'financial' | 'operational' }> }>({
    queryKey: ['/api/party-roles/catalog'],
  });

  const { data: defaultPrompts } = useQuery<Record<string, any>>({
    queryKey: ['/api/contract-types/default-prompts'],
    enabled: isSystemAdmin,
  });

  const { data: calcFieldTypes, isLoading: cftLoading } = useQuery<CalculationFieldTypeData[]>({
    queryKey: ['/api/calculation-field-types'],
  });

  const [formData, setFormData] = useState<Partial<SystemSettings>>({});

  const createContractTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/contract-types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      setAddingCt(false);
      setCtForm({ code: '', name: '', description: '', icon: '', color: '', partyRoleSlots: [] });
      toast({ title: "Success", description: "Contract type created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create contract type", variant: "destructive" });
    },
  });

  const deleteContractTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contract-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      toast({ title: "Deleted", description: "Contract type removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const createCftMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/calculation-field-types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calculation-field-types'] });
      setAddingCft(false);
      setCftForm({ contractTypeCode: '', fieldCode: '', fieldName: '', fieldCategory: 'basis', description: '', isRequired: false, sortOrder: 0, defaultColumnPatterns: '', dataType: 'number' });
      toast({ title: "Success", description: "Calculation field type created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create field type", variant: "destructive" });
    },
  });

  const updateCftMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await apiRequest('PUT', `/api/calculation-field-types/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calculation-field-types'] });
      setEditingCftId(null);
      setCftForm({ contractTypeCode: '', fieldCode: '', fieldName: '', fieldCategory: 'basis', description: '', isRequired: false, sortOrder: 0, defaultColumnPatterns: '', dataType: 'number' });
      toast({ title: "Updated", description: "Calculation field type updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update field type", variant: "destructive" });
    },
  });

  const deleteCftMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/calculation-field-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calculation-field-types'] });
      toast({ title: "Deleted", description: "Calculation field type removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete field type", variant: "destructive" });
    },
  });

  const startEditCt = (ct: ContractTypeWithPrompts) => {
    setEditingCtId(ct.id);
    setAddingCt(false);
    setCtForm({
      code: ct.code,
      name: ct.name,
      description: ct.description || '',
      icon: ct.icon || '',
      color: ct.color || '',
      partyRoleSlots: Array.isArray((ct as any).partyRoleSlots) ? (ct as any).partyRoleSlots : [],
    });
  };

  const startAddCt = () => {
    setAddingCt(true);
    setEditingCtId(null);
    setCtForm({ code: '', name: '', description: '', icon: '', color: '', partyRoleSlots: [] });
  };

  const cancelCtEdit = () => {
    setEditingCtId(null);
    setAddingCt(false);
    setCtForm({ code: '', name: '', description: '', icon: '', color: '', partyRoleSlots: [] });
  };

  const handleCtSave = () => {
    if (editingCtId) {
      updateContractTypeMutation.mutate({ id: editingCtId, updates: ctForm });
    } else {
      createContractTypeMutation.mutate(ctForm);
    }
  };

  const startEditCft = (cft: CalculationFieldTypeData) => {
    setEditingCftId(cft.id);
    setAddingCft(false);
    setCftForm({
      contractTypeCode: cft.contractTypeCode,
      fieldCode: cft.fieldCode,
      fieldName: cft.fieldName,
      fieldCategory: cft.fieldCategory,
      description: cft.description || '',
      isRequired: cft.isRequired,
      sortOrder: cft.sortOrder || 0,
      defaultColumnPatterns: (cft.defaultColumnPatterns || []).join(', '),
      dataType: cft.dataType,
    });
  };

  const startAddCft = () => {
    setAddingCft(true);
    setEditingCftId(null);
    const defaultCode = (cftFilter && cftFilter !== 'all') ? cftFilter : (contractTypes?.[0]?.code || '');
    setCftForm({ contractTypeCode: defaultCode, fieldCode: '', fieldName: '', fieldCategory: 'basis', description: '', isRequired: false, sortOrder: 0, defaultColumnPatterns: '', dataType: 'number' });
  };

  const cancelCftEdit = () => {
    setEditingCftId(null);
    setAddingCft(false);
    setCftForm({ contractTypeCode: '', fieldCode: '', fieldName: '', fieldCategory: 'basis', description: '', isRequired: false, sortOrder: 0, defaultColumnPatterns: '', dataType: 'number' });
  };

  const handleCftSave = () => {
    const payload = {
      ...cftForm,
      defaultColumnPatterns: cftForm.defaultColumnPatterns ? cftForm.defaultColumnPatterns.split(',').map(s => s.trim()).filter(Boolean) : [],
      sortOrder: Number(cftForm.sortOrder) || 0,
    };
    if (editingCftId) {
      updateCftMutation.mutate({ id: editingCftId, updates: payload });
    } else {
      createCftMutation.mutate(payload);
    }
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SystemSettings>) => {
      return await apiRequest('PUT', '/api/settings/system', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/system'] });
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully",
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

  const updateContractTypeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContractTypeWithPrompts> }) => {
      return await apiRequest('PUT', `/api/contract-types/${id}`, updates);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-types'] });
      setContractTypePrompts(prev => {
        const updated = { ...prev };
        delete updated[variables.id];
        return updated;
      });
      setEditingCtId(null);
      setAddingCt(false);
      setCtForm({ code: '', name: '', description: '', icon: '', color: '', partyRoleSlots: [] });
      toast({
        title: "Saved",
        description: "Contract type updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save contract type",
        variant: "destructive",
      });
    },
  });

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleContractTypePromptChange = (typeId: string, field: string, value: string) => {
    setContractTypePrompts(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [field]: value
      }
    }));
  };

  const saveContractTypePrompts = (typeId: string) => {
    const updates = contractTypePrompts[typeId];
    if (updates) {
      updateContractTypeMutation.mutate({ id: typeId, updates });
    }
  };

  const promptFieldToDefaultKey: Record<string, string> = {
    extractionPrompt: 'extractionPrompt',
    ruleExtractionPrompt: 'ruleExtractionPrompt',
    erpMappingPrompt: 'erpMappingPrompt',
    sampleExtractionOutput: 'sampleExtractionOutput',
    ragExtractionPrompt: 'ragExtractionPrompt',
    ragRuleExtractionPrompt: 'ragRuleExtractionPrompt',
    ragSampleExtractionOutput: 'ragSampleExtractionOutput',
  };

  const getContractTypePromptValue = (type: ContractTypeWithPrompts, field: keyof ContractTypeWithPrompts) => {
    const localEdit = contractTypePrompts[type.id]?.[field];
    if (localEdit !== undefined) return localEdit;
    if (type[field]) return type[field];
    const defaultKey = promptFieldToDefaultKey[field as string];
    if (defaultKey && defaultPrompts?.[type.code]) {
      return defaultPrompts[type.code][defaultKey] || '';
    }
    return '';
  };

  const hasDefaultPrompts = (code: string) => {
    return defaultPrompts?.[code] != null;
  };

  const hasCustomPrompts = (type: ContractTypeWithPrompts) => {
    return !!(type.extractionPrompt || type.ruleExtractionPrompt || type.ragExtractionPrompt || type.ragRuleExtractionPrompt);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  const getValue = (key: keyof SystemSettings, defaultValue: any = '') => {
    return formData[key] ?? settings?.[key] ?? defaultValue;
  };

  if (!isSystemAdmin) {
    return (
      <MainLayout title="System Settings">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="w-96">
            <CardContent className="pt-6 text-center">
              <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                System settings are only accessible to System Administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="System Settings">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-system-settings">
              <Settings className="w-8 h-8" />
              System Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure platform-wide settings (Super Admin only)
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
              data-testid="button-save-settings"
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
          <Tabs defaultValue="ai" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai-config">
                <Bot className="w-4 h-4" />
                AI Config
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2" data-testid="tab-security">
                <Shield className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-2" data-testid="tab-features">
                <Zap className="w-4 h-4" />
                Features
              </TabsTrigger>
              <TabsTrigger value="prompts" className="flex items-center gap-2" data-testid="tab-prompts">
                <FileText className="w-4 h-4" />
                AI Prompts
              </TabsTrigger>
              <TabsTrigger value="email-smtp" className="flex items-center gap-2" data-testid="tab-email-smtp">
                <Mail className="w-4 h-4" />
                Email / SMTP
              </TabsTrigger>
              <TabsTrigger value="finance-hub" className="flex items-center gap-2" data-testid="tab-finance-hub">
                <DollarSign className="w-4 h-4" />
                Finance Hub
              </TabsTrigger>
              <TabsTrigger value="rule-templates" className="flex items-center gap-2" data-testid="tab-rule-templates">
                <ListChecks className="w-4 h-4" />
                Rule Templates
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2" data-testid="tab-integrations">
                <Bot className="w-4 h-4" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="rule-catalog" className="flex items-center gap-2" data-testid="tab-rule-catalog">
                <Database className="w-4 h-4" />
                Rule Catalog
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI Model Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the AI model settings used for contract analysis and extraction
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="aiProvider">AI Provider</Label>
                      <Select 
                        value={getValue('aiProvider', 'anthropic')}
                        onValueChange={(v) => {
                          handleChange('aiProvider', v);
                          // Auto-select default model for provider
                          if (v === 'anthropic') handleChange('aiModel', 'claude-sonnet-4-5');
                          else if (v === 'groq') handleChange('aiModel', 'llama-3.3-70b-versatile');
                          else if (v === 'openai') handleChange('aiModel', 'gpt-4o');
                        }}
                      >
                        <SelectTrigger id="aiProvider" data-testid="select-ai-provider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic Claude (Recommended)</SelectItem>
                          <SelectItem value="groq">Groq (LLaMA)</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select the AI provider for contract analysis
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aiModel">AI Model</Label>
                      <Select 
                        value={getValue('aiModel', 'claude-sonnet-4-5')}
                        onValueChange={(v) => handleChange('aiModel', v)}
                      >
                        <SelectTrigger id="aiModel" data-testid="select-ai-model">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {getValue('aiProvider', 'anthropic') === 'anthropic' && (
                            <>
                              <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</SelectItem>
                              <SelectItem value="claude-opus-4-5">Claude Opus 4.5 (Most Capable)</SelectItem>
                              <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5 (Fastest)</SelectItem>
                            </>
                          )}
                          {getValue('aiProvider', 'anthropic') === 'groq' && (
                            <>
                              <SelectItem value="llama-3.3-70b-versatile">LLaMA 3.3 70B (Default)</SelectItem>
                              <SelectItem value="llama-3.1-8b-instant">LLaMA 3.1 8B (Fast)</SelectItem>
                              <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                              <SelectItem value="gemma2-9b-it">Gemma 2 9B</SelectItem>
                            </>
                          )}
                          {getValue('aiProvider', 'anthropic') === 'openai' && (
                            <>
                              <SelectItem value="gpt-4o">GPT-4o (Latest)</SelectItem>
                              <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select the AI model for contract operations
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Temperature: {getValue('aiTemperature', 0.3)}</Label>
                        <Badge variant="outline">{getValue('aiTemperature', 0.3)}</Badge>
                      </div>
                      <Slider
                        value={[getValue('aiTemperature', 0.3)]}
                        onValueChange={(v) => handleChange('aiTemperature', v[0])}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                        data-testid="slider-temperature"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower values produce more consistent results, higher values are more creative
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aiMaxTokens">Max Tokens</Label>
                      <Input
                        id="aiMaxTokens"
                        type="number"
                        value={getValue('aiMaxTokens', 4096)}
                        onChange={(e) => handleChange('aiMaxTokens', parseInt(e.target.value))}
                        min={256}
                        max={32768}
                        data-testid="input-max-tokens"
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum tokens for AI response generation
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aiRetryAttempts">Max Retries</Label>
                      <Input
                        id="aiRetryAttempts"
                        type="number"
                        value={getValue('aiRetryAttempts', 3)}
                        onChange={(e) => handleChange('aiRetryAttempts', parseInt(e.target.value))}
                        min={1}
                        max={10}
                        data-testid="input-max-retries"
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of retry attempts for failed AI calls
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Confidence Thresholds</h3>
                    <p className="text-sm text-muted-foreground">
                      Define confidence levels for human-in-the-loop review decisions
                    </p>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>High Confidence (Auto-confirm): {(getValue('autoConfirmThreshold', 0.85) * 100).toFixed(0)}%</Label>
                          <Badge className="bg-green-100 text-green-800">{(getValue('autoConfirmThreshold', 0.85) * 100).toFixed(0)}%</Badge>
                        </div>
                        <Slider
                          value={[getValue('autoConfirmThreshold', 0.85)]}
                          onValueChange={(v) => handleChange('autoConfirmThreshold', v[0])}
                          min={0.5}
                          max={1}
                          step={0.05}
                          className="w-full"
                          data-testid="slider-confidence-high"
                        />
                        <p className="text-xs text-muted-foreground">
                          Extractions above this threshold are auto-confirmed
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Medium Confidence (Review): {(getValue('lowConfidenceThreshold', 0.6) * 100).toFixed(0)}%</Label>
                          <Badge className="bg-yellow-100 text-yellow-800">{(getValue('lowConfidenceThreshold', 0.6) * 100).toFixed(0)}%</Badge>
                        </div>
                        <Slider
                          value={[getValue('lowConfidenceThreshold', 0.6)]}
                          onValueChange={(v) => handleChange('lowConfidenceThreshold', v[0])}
                          min={0.3}
                          max={0.9}
                          step={0.05}
                          className="w-full"
                          data-testid="slider-confidence-medium"
                        />
                        <p className="text-xs text-muted-foreground">
                          Extractions below this threshold require human review
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Extraction Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure how payment rules are extracted from contracts
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="defaultExtractionMode">Default Extraction Mode</Label>
                      <Select
                        value={getValue('defaultExtractionMode', 'rag')}
                        onValueChange={(v) => handleChange('defaultExtractionMode', v)}
                      >
                        <SelectTrigger id="defaultExtractionMode" data-testid="select-extraction-mode">
                          <SelectValue placeholder="Select extraction mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rag">RAG-Grounded (Recommended)</SelectItem>
                          <SelectItem value="legacy">Legacy</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        <strong>RAG-Grounded:</strong> Chunks contract into sections, finds payment-related parts using AI search, then extracts rules from focused context. Reduces hallucination and improves accuracy.
                        <br />
                        <strong>Legacy:</strong> Sends full contract text to AI for extraction. May mix information from different sections.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Analysis Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Controls when AI analysis sections (Risk Analysis, Insights, Key Terms) are generated after contract upload
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="analysisMode">AI Analysis Generation</Label>
                      <Select
                        value={getValue('analysisMode', 'on_demand')}
                        onValueChange={(v) => handleChange('analysisMode', v)}
                      >
                        <SelectTrigger id="analysisMode" data-testid="select-analysis-mode">
                          <SelectValue placeholder="Select analysis mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on_demand">On-Demand (Recommended)</SelectItem>
                          <SelectItem value="auto_complete">Auto-Complete</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        <strong>On-Demand:</strong> Only the AI Summary is generated during upload. Risk Analysis, Insights, and Key Terms are generated when you click their tabs. Faster uploads and lower AI costs.
                        <br />
                        <strong>Auto-Complete:</strong> All analysis sections are generated automatically in the background after upload. Slower upload but all data is ready when you view the contract.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Calculation Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure the default calculation engine for contract fee computations
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="defaultEvaluationMode">Default Evaluation Mode</Label>
                      <Select
                        value={getValue('defaultEvaluationMode', 'universal')}
                        onValueChange={(v) => handleChange('defaultEvaluationMode', v)}
                      >
                        <SelectTrigger id="defaultEvaluationMode" data-testid="select-evaluation-mode">
                          <SelectValue placeholder="Select evaluation mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="universal">Universal (Recommended)</SelectItem>
                          <SelectItem value="legacy">Legacy</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        <strong>Universal:</strong> Uses the new formula evaluator with source citation validation for maximum accuracy.
                        <br />
                        <strong>Legacy:</strong> Uses the original dynamic rules engine.
                        <br />
                        <strong>Hybrid:</strong> Auto-selects based on rule configuration.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Nightly Obligation Expiry Sweep</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically forfeits stale MDF / bonus obligations whose expiry date has passed and whose rollover policy is "forfeit". Runs once per company per UTC day.
                    </p>

                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="obligationExpirySweepEnabled">Enable nightly sweep</Label>
                        <p className="text-xs text-muted-foreground">
                          When off, no automatic expiry runs — only the manual "Run Expiry Sweep" action will forfeit obligations.
                        </p>
                      </div>
                      <Switch
                        id="obligationExpirySweepEnabled"
                        checked={getValue('obligationExpirySweepEnabled', true)}
                        onCheckedChange={(v) => handleChange('obligationExpirySweepEnabled', v)}
                        data-testid="switch-obligation-expiry-enabled"
                      />
                    </div>

                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="obligationExpirySweepHourUtc">Run hour (UTC, 0–23)</Label>
                      <Input
                        id="obligationExpirySweepHourUtc"
                        type="number"
                        min={0}
                        max={23}
                        step={1}
                        value={getValue('obligationExpirySweepHourUtc', 2)}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (Number.isFinite(n)) handleChange('obligationExpirySweepHourUtc', Math.max(0, Math.min(23, n)));
                        }}
                        data-testid="input-obligation-expiry-hour"
                      />
                      <p className="text-xs text-muted-foreground">
                        The sweep fires on or after this UTC hour each day. The scheduler ticks every 5 minutes.
                      </p>
                    </div>

                    <div className="rounded-md border p-3 bg-muted/30 space-y-2" data-testid="status-obligation-expiry-sweep">
                      <div className="text-sm font-medium">Last run status</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Last run:</span>{' '}
                        <span data-testid="text-obligation-expiry-last-run">
                          {settings?.obligationExpirySweepLastRunAt
                            ? new Date(settings.obligationExpirySweepLastRunAt).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                      {settings?.obligationExpirySweepLastResult?.totalExpiredCount !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Last result:</span>{' '}
                          <span data-testid="text-obligation-expiry-last-result">
                            {settings.obligationExpirySweepLastResult.totalExpiredCount} obligation(s) expired across{' '}
                            {settings.obligationExpirySweepLastResult.companies?.length ?? 0} compan(ies)
                            {' · $'}
                            {(settings.obligationExpirySweepLastResult.totalExpiredAmount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {settings?.obligationExpirySweepLastError ? (
                        <div className="text-xs text-destructive" data-testid="text-obligation-expiry-last-error">
                          <span className="font-medium">Last error:</span> {settings.obligationExpirySweepLastError}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No errors on the most recent run.</div>
                      )}
                      {settings?.obligationExpirySweepLastResult?.companies && settings.obligationExpirySweepLastResult.companies.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground" data-testid="toggle-obligation-expiry-breakdown">
                            Per-company breakdown
                          </summary>
                          <ul className="mt-2 space-y-1 pl-4">
                            {settings.obligationExpirySweepLastResult.companies.map((c) => (
                              <li key={c.companyId} data-testid={`row-obligation-expiry-company-${c.companyId}`}>
                                <span className="font-medium">{c.companyName}:</span>{' '}
                                {c.error ? (
                                  <span className="text-destructive">error — {c.error}</span>
                                ) : (
                                  <span>
                                    {c.expiredCount ?? 0} expired · ${(c.expiredAmount ?? 0).toFixed(2)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Configure authentication and security policies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={getValue('sessionTimeoutMinutes', 60)}
                        onChange={(e) => handleChange('sessionTimeoutMinutes', parseInt(e.target.value))}
                        min={5}
                        max={480}
                        data-testid="input-session-timeout"
                      />
                      <p className="text-xs text-muted-foreground">
                        Automatic logout after inactivity period
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                      <Input
                        id="maxLoginAttempts"
                        type="number"
                        value={getValue('maxLoginAttempts', 5)}
                        onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value))}
                        min={3}
                        max={10}
                        data-testid="input-max-login-attempts"
                      />
                      <p className="text-xs text-muted-foreground">
                        Account lockout after failed attempts
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
                      <Input
                        id="passwordMinLength"
                        type="number"
                        value={getValue('passwordMinLength', 8)}
                        onChange={(e) => handleChange('passwordMinLength', parseInt(e.target.value))}
                        min={6}
                        max={32}
                        data-testid="input-password-min-length"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum characters required for passwords
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="text-base">Require Multi-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                          Enforce MFA for all users
                        </p>
                      </div>
                      <Switch
                        checked={getValue('require2FA', false)}
                        onCheckedChange={(v) => handleChange('require2FA', v)}
                        data-testid="switch-require-mfa"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="text-base">Enable Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">
                          Track all user actions for compliance
                        </p>
                      </div>
                      <Switch
                        checked={getValue('enableAuditLogging', true)}
                        onCheckedChange={(v) => handleChange('enableAuditLogging', v)}
                        data-testid="switch-audit-log"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Feature Flags
                  </CardTitle>
                  <CardDescription>
                    Enable or disable platform features globally
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Bot className="w-5 h-5 text-orange-600" />
                      <div>
                        <Label className="text-base">AI Contract Extraction</Label>
                        <p className="text-sm text-muted-foreground">
                          Automated extraction of contract terms using AI
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={getValue('featureFlagAiExtraction', true)}
                      onCheckedChange={(v) => handleChange('featureFlagAiExtraction', v)}
                      data-testid="switch-feature-extraction"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-500" />
                      <div>
                        <Label className="text-base">liQ AI (RAG Q&A)</Label>
                        <p className="text-sm text-muted-foreground">
                          AI-native document Q&A with source citations
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={getValue('featureFlagRagQa', true)}
                      onCheckedChange={(v) => handleChange('featureFlagRagQa', v)}
                      data-testid="switch-feature-rag"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-green-500" />
                      <div>
                        <Label className="text-base">ERP Integration Hub</Label>
                        <p className="text-sm text-muted-foreground">
                          Connect to external ERP systems for data sync
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={getValue('featureFlagErpIntegration', true)}
                      onCheckedChange={(v) => handleChange('featureFlagErpIntegration', v)}
                      data-testid="switch-feature-erp"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-orange-500" />
                      <div>
                        <Label className="text-base">Multi-Location Context</Label>
                        <p className="text-sm text-muted-foreground">
                          Hierarchical organization access control
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={getValue('featureFlagMultiLocation', true)}
                      onCheckedChange={(v) => handleChange('featureFlagMultiLocation', v)}
                      data-testid="switch-feature-multilocation"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-purple-500" />
                      <div>
                        <Label className="text-base">ERP Semantic Matching</Label>
                        <p className="text-sm text-muted-foreground">
                          Use AI-native semantic matching against imported ERP records for sales data
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={getValue('featureFlagErpMatching', false)}
                      onCheckedChange={(v) => handleChange('featureFlagErpMatching', v)}
                      data-testid="switch-feature-erp-matching"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts" className="space-y-6">
              <AIPromptRegistryTab />
            </TabsContent>

            <TabsContent value="contract-prompts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCode className="w-5 h-5" />
                    Contract Type-Specific Prompts
                  </CardTitle>
                  <CardDescription>
                    Configure AI extraction prompts for each contract type. Different contract formats (Manufacturing, Plant Variety, etc.) require different extraction strategies.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {typesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {contractTypes?.map((type) => (
                          <Collapsible
                            key={type.id}
                            open={expandedContractType === type.id}
                            onOpenChange={(open) => setExpandedContractType(open ? type.id : null)}
                          >
                            <Card className="border">
                              <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                          {type.name}
                                          {type.isSystemType && (
                                            <Badge variant="secondary" className="text-xs">System</Badge>
                                          )}
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                          {type.description || `Code: ${type.code}`}
                                        </CardDescription>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {hasCustomPrompts(type) ? (
                                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                          Customized
                                        </Badge>
                                      ) : hasDefaultPrompts(type.code) ? (
                                        <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                                          Using Default
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                                          Not Configured
                                        </Badge>
                                      )}
                                      {expandedContractType === type.id ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0 space-y-4">
                                  <Separator />
                                  
                                  <div className="space-y-2">
                                    <Label>Entity Extraction Prompt</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'extractionPrompt') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'extractionPrompt', e.target.value)}
                                      placeholder={`Enter the prompt for extracting entities from ${type.name} contracts...

Example: You are analyzing a ${type.name} contract. Extract all parties, dates, territories, and key terms. Return as JSON.`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-extraction-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Main prompt for extracting contract entities and metadata
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Rule Extraction Prompt</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'ruleExtractionPrompt') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'ruleExtractionPrompt', e.target.value)}
                                      placeholder={`Enter the prompt for extracting payment/fee rules from ${type.name} contracts...

Example: Extract all pricing tiers, rates, minimums, and fee structures. For tiered pricing, extract EVERY tier separately.`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-rules-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Prompt specifically for extracting payment rules, fee structures, and pricing tiers
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>ERP Mapping Prompt</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'erpMappingPrompt') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'erpMappingPrompt', e.target.value)}
                                      placeholder={`Enter the prompt for mapping ${type.name} contract terms to ERP fields...`}
                                      className="min-h-[100px] font-mono text-sm"
                                      data-testid={`textarea-erp-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Prompt for mapping extracted terms to ERP system fields
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Sample Output Format (JSON)</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'sampleExtractionOutput') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'sampleExtractionOutput', e.target.value)}
                                      placeholder={`Provide a sample JSON output format for the AI to follow...

{
  "parties": [...],
  "rules": [
    { "tier": 1, "rate": "6.5%", "minimum": 125000 }
  ]
}`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-sample-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Example output format to guide AI responses for consistency
                                    </p>
                                  </div>

                                  {/* RAG Mode Prompts Section */}
                                  <Separator className="my-4" />
                                  <div className="space-y-1 mb-4">
                                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-500 flex items-center gap-2">
                                      <span className="inline-block w-2 h-2 bg-orange-600 rounded-full"></span>
                                      RAG Mode Prompts (Chunk-Based Extraction)
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      These prompts are used when RAG extraction mode is enabled. They are optimized for processing document chunks with mandatory source citations.
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>RAG Entity Extraction Prompt</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'ragExtractionPrompt') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'ragExtractionPrompt', e.target.value)}
                                      placeholder={`Enter the RAG prompt for extracting entities from ${type.name} contract chunks...

Example: You are analyzing contract CHUNKS (not the full document). Extract entities with MANDATORY source citations including exact quotes.`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-rag-extraction-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      RAG prompt for extracting entities from document chunks with source citations
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>RAG Rule Extraction Prompt</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'ragRuleExtractionPrompt') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'ragRuleExtractionPrompt', e.target.value)}
                                      placeholder={`Enter the RAG prompt for extracting payment rules from ${type.name} contract chunks...

Example: Extract payment rules from these chunks. Include caps, minimums, thresholds as SEPARATE rules. MANDATORY: Include sourceSpan with exact quote.`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-rag-rules-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      RAG prompt for extracting payment rules with source citations and separate cap/minimum rules
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>RAG Sample Output Format (JSON)</Label>
                                    <Textarea
                                      value={getContractTypePromptValue(type, 'ragSampleExtractionOutput') as string}
                                      onChange={(e) => handleContractTypePromptChange(type.id, 'ragSampleExtractionOutput', e.target.value)}
                                      placeholder={`Provide a sample JSON output format for RAG extraction...

{
  "rules": [
    { "ruleType": "percentage", "rate": 0.05, "sourceSpan": { "text": "5% fee", "page": 3 } },
    { "ruleType": "cap", "amount": 50000, "sourceSpan": { "text": "$50,000 cap", "page": 4 } }
  ]
}`}
                                      className="min-h-[120px] font-mono text-sm"
                                      data-testid={`textarea-rag-sample-${type.code}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Example RAG output format showing required source citations
                                    </p>
                                  </div>

                                  <div className="flex justify-end pt-2">
                                    <Button
                                      onClick={() => saveContractTypePrompts(type.id)}
                                      disabled={!contractTypePrompts[type.id] || updateContractTypeMutation.isPending}
                                      size="sm"
                                      data-testid={`button-save-${type.code}`}
                                    >
                                      {updateContractTypeMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                      )}
                                      Save Prompts for {type.name}
                                    </Button>
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contract Types Management Tab */}
            <TabsContent value="contract-types" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5" />
                        Contract Type Definitions
                      </CardTitle>
                      <CardDescription>
                        Manage contract types used across the platform. System types cannot be deleted.
                      </CardDescription>
                    </div>
                    {isSystemAdmin && !addingCt && (
                      <Button onClick={startAddCt} size="sm" data-testid="btn-add-contract-type">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Type
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {typesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {addingCt && (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="ct-inline-add">
                          <div className="text-sm font-medium text-muted-foreground">New Contract Type</div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input value={ctForm.code} onChange={e => setCtForm(p => ({ ...p, code: e.target.value }))} placeholder="Code (e.g. franchise_license)" className="text-sm" data-testid="input-ct-code" />
                            <Input value={ctForm.name} onChange={e => setCtForm(p => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. Franchise License)" className="text-sm" data-testid="input-ct-name" />
                          </div>
                          <Input value={ctForm.description} onChange={e => setCtForm(p => ({ ...p, description: e.target.value }))} placeholder="Description..." className="text-sm" data-testid="input-ct-description" />
                          <PartyRoleSlotsEditor
                            slots={ctForm.partyRoleSlots}
                            catalog={partyRoleCatalog?.all || []}
                            onChange={(next) => setCtForm(p => ({ ...p, partyRoleSlots: next }))}
                          />
                          <div className="grid grid-cols-4 gap-3 items-end">
                            <Input value={ctForm.icon} onChange={e => setCtForm(p => ({ ...p, icon: e.target.value }))} placeholder="Icon name" className="text-sm" data-testid="input-ct-icon" />
                            <div className="flex items-center gap-2">
                              <Input value={ctForm.color} onChange={e => setCtForm(p => ({ ...p, color: e.target.value }))} type="color" className="w-10 h-9 p-1 cursor-pointer" data-testid="input-ct-color" />
                              <span className="text-xs text-muted-foreground">Color</span>
                            </div>
                            <Button size="sm" onClick={handleCtSave} disabled={!ctForm.code || !ctForm.name || createContractTypeMutation.isPending} data-testid="btn-save-ct">
                              {createContractTypeMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelCtEdit} data-testid="btn-cancel-ct">Cancel</Button>
                          </div>
                        </div>
                      )}
                      {contractTypes?.map((ct: any) => (
                        editingCtId === ct.id ? (
                          <div key={ct.id} className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid={`ct-inline-edit-${ct.code}`}>
                            <div className="text-sm font-medium text-muted-foreground">Editing: <span className="font-mono">{ct.code}</span></div>
                            <div className="grid grid-cols-2 gap-3">
                              <Input value={ctForm.code} disabled className="text-sm bg-muted" data-testid="input-ct-code" />
                              <Input value={ctForm.name} onChange={e => setCtForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="text-sm" data-testid="input-ct-name" />
                            </div>
                            <Input value={ctForm.description} onChange={e => setCtForm(p => ({ ...p, description: e.target.value }))} placeholder="Description..." className="text-sm" data-testid="input-ct-description" />
                            <PartyRoleSlotsEditor
                              slots={ctForm.partyRoleSlots}
                              catalog={partyRoleCatalog?.all || []}
                              onChange={(next) => setCtForm(p => ({ ...p, partyRoleSlots: next }))}
                            />
                            <div className="grid grid-cols-4 gap-3 items-end">
                              <Input value={ctForm.icon} onChange={e => setCtForm(p => ({ ...p, icon: e.target.value }))} placeholder="Icon name" className="text-sm" data-testid="input-ct-icon" />
                              <div className="flex items-center gap-2">
                                <Input value={ctForm.color} onChange={e => setCtForm(p => ({ ...p, color: e.target.value }))} type="color" className="w-10 h-9 p-1 cursor-pointer" data-testid="input-ct-color" />
                                <span className="text-xs text-muted-foreground">Color</span>
                              </div>
                              <Button size="sm" onClick={handleCtSave} disabled={!ctForm.name || updateContractTypeMutation.isPending} data-testid="btn-save-ct">
                                {updateContractTypeMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelCtEdit} data-testid="btn-cancel-ct">Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div key={ct.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50" data-testid={`contract-type-row-${ct.code}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ct.color || '#6b7280' }} />
                              <div>
                                <div className="font-medium text-sm">{ct.name}</div>
                                <div className="text-xs text-muted-foreground">{ct.code}</div>
                              </div>
                              {ct.isSystemType && (
                                <Badge variant="secondary" className="text-xs">System</Badge>
                              )}
                              {!ct.isActive && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground mr-2">{ct.description?.substring(0, 60)}{ct.description?.length > 60 ? '...' : ''}</div>
                              {isSystemAdmin && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => startEditCt(ct)} data-testid={`btn-edit-ct-${ct.code}`}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  {!ct.isSystemType && (
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      if (confirm(`Delete contract type "${ct.name}"?`)) {
                                        deleteContractTypeMutation.mutate(ct.id);
                                      }
                                    }} className="text-destructive hover:text-destructive" data-testid={`btn-delete-ct-${ct.code}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                      {(!contractTypes || contractTypes.length === 0) && !addingCt && (
                        <div className="text-center text-muted-foreground py-8">No contract types found</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calculation Field Types Management Tab */}
            <TabsContent value="calc-fields" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Calculation Field Types
                      </CardTitle>
                      <CardDescription>
                        Define the engine fields available for each contract type. These fields power auto-detection and formula evaluation.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={cftFilter} onValueChange={setCftFilter}>
                        <SelectTrigger className="w-[200px]" data-testid="select-cft-filter">
                          <SelectValue placeholder="All Contract Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Contract Types</SelectItem>
                          {contractTypes?.map((ct: any) => (
                            <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isSystemAdmin && !addingCft && (
                        <Button onClick={startAddCft} size="sm" data-testid="btn-add-calc-field">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Field
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {cftLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {addingCft && (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="cft-inline-add">
                          <div className="text-sm font-medium text-muted-foreground">New Calculation Field</div>
                          <div className="grid grid-cols-3 gap-3">
                            <Select value={cftForm.contractTypeCode} onValueChange={v => setCftForm(p => ({ ...p, contractTypeCode: v }))}>
                              <SelectTrigger className="text-sm" data-testid="input-cft-contract-type">
                                <SelectValue placeholder="Contract Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {contractTypes?.map((ct: any) => (
                                  <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input value={cftForm.fieldCode} onChange={e => setCftForm(p => ({ ...p, fieldCode: e.target.value }))} placeholder="Field code" className="text-sm" data-testid="input-cft-field-code" />
                            <Input value={cftForm.fieldName} onChange={e => setCftForm(p => ({ ...p, fieldName: e.target.value }))} placeholder="Field name" className="text-sm" data-testid="input-cft-field-name" />
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <Select value={cftForm.fieldCategory} onValueChange={v => setCftForm(p => ({ ...p, fieldCategory: v }))}>
                              <SelectTrigger className="text-sm" data-testid="input-cft-category">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_CATEGORIES.map(c => (
                                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={cftForm.dataType} onValueChange={v => setCftForm(p => ({ ...p, dataType: v }))}>
                              <SelectTrigger className="text-sm" data-testid="input-cft-data-type">
                                <SelectValue placeholder="Data type" />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPES.map(d => (
                                  <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input value={cftForm.defaultColumnPatterns} onChange={e => setCftForm(p => ({ ...p, defaultColumnPatterns: e.target.value }))} placeholder="Patterns (comma-sep)" className="text-sm" data-testid="input-cft-patterns" />
                            <div className="flex items-center gap-2">
                              <Switch checked={cftForm.isRequired} onCheckedChange={v => setCftForm(p => ({ ...p, isRequired: v }))} data-testid="switch-cft-required" />
                              <span className="text-xs text-muted-foreground">Req</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3 items-end">
                            <Input value={cftForm.description} onChange={e => setCftForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" className="text-sm col-span-2" data-testid="input-cft-description" />
                            <Button size="sm" onClick={handleCftSave} disabled={!cftForm.contractTypeCode || !cftForm.fieldCode || !cftForm.fieldName || createCftMutation.isPending} data-testid="btn-save-cft">
                              {createCftMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelCftEdit} data-testid="btn-cancel-cft">Cancel</Button>
                          </div>
                        </div>
                      )}
                      {(() => {
                        const filtered = (calcFieldTypes || []).filter((f: any) => !cftFilter || cftFilter === 'all' || f.contractTypeCode === cftFilter);
                        const grouped: Record<string, CalculationFieldTypeData[]> = {};
                        filtered.forEach((f: any) => {
                          if (!grouped[f.contractTypeCode]) grouped[f.contractTypeCode] = [];
                          grouped[f.contractTypeCode].push(f);
                        });
                        return Object.entries(grouped).map(([code, fields]) => {
                          const ctName = contractTypes?.find((ct: any) => ct.code === code)?.name || code;
                          return (
                            <div key={code} className="border rounded-lg">
                              <div className="px-4 py-2 bg-muted/50 font-medium text-sm flex items-center justify-between rounded-t-lg">
                                <span>{ctName} <span className="text-muted-foreground">({code})</span></span>
                                <Badge variant="outline">{fields.length} fields</Badge>
                              </div>
                              <div className="divide-y">
                                {fields.map((f) => (
                                  editingCftId === f.id ? (
                                    <div key={f.id} className="px-4 py-3 bg-muted/30 space-y-3" data-testid={`cft-inline-edit-${f.fieldCode}`}>
                                      <div className="text-xs font-medium text-muted-foreground">Editing: <span className="font-mono">{f.fieldCode}</span></div>
                                      <div className="grid grid-cols-3 gap-3">
                                        <Select value={cftForm.contractTypeCode} onValueChange={v => setCftForm(p => ({ ...p, contractTypeCode: v }))}>
                                          <SelectTrigger className="text-sm" data-testid="input-cft-contract-type">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {contractTypes?.map((ct: any) => (
                                              <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input value={cftForm.fieldCode} onChange={e => setCftForm(p => ({ ...p, fieldCode: e.target.value }))} placeholder="Field code" className="text-sm" data-testid="input-cft-field-code" />
                                        <Input value={cftForm.fieldName} onChange={e => setCftForm(p => ({ ...p, fieldName: e.target.value }))} placeholder="Field name" className="text-sm" data-testid="input-cft-field-name" />
                                      </div>
                                      <div className="grid grid-cols-4 gap-3">
                                        <Select value={cftForm.fieldCategory} onValueChange={v => setCftForm(p => ({ ...p, fieldCategory: v }))}>
                                          <SelectTrigger className="text-sm" data-testid="input-cft-category">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FIELD_CATEGORIES.map(c => (
                                              <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select value={cftForm.dataType} onValueChange={v => setCftForm(p => ({ ...p, dataType: v }))}>
                                          <SelectTrigger className="text-sm" data-testid="input-cft-data-type">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {DATA_TYPES.map(d => (
                                              <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input value={cftForm.defaultColumnPatterns} onChange={e => setCftForm(p => ({ ...p, defaultColumnPatterns: e.target.value }))} placeholder="Patterns (comma-sep)" className="text-sm" data-testid="input-cft-patterns" />
                                        <div className="flex items-center gap-2">
                                          <Switch checked={cftForm.isRequired} onCheckedChange={v => setCftForm(p => ({ ...p, isRequired: v }))} data-testid="switch-cft-required" />
                                          <span className="text-xs text-muted-foreground">Req</span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-4 gap-3 items-end">
                                        <Input value={cftForm.description} onChange={e => setCftForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" className="text-sm col-span-2" data-testid="input-cft-description" />
                                        <Button size="sm" onClick={handleCftSave} disabled={!cftForm.contractTypeCode || !cftForm.fieldCode || !cftForm.fieldName || updateCftMutation.isPending} data-testid="btn-save-cft">
                                          {updateCftMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                          Save
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={cancelCftEdit} data-testid="btn-cancel-cft">Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div key={f.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30" data-testid={`cft-row-${f.fieldCode}`}>
                                      <div className="flex items-center gap-3">
                                        <div>
                                          <div className="font-medium text-sm">{f.fieldName}</div>
                                          <div className="text-xs text-muted-foreground font-mono">{f.fieldCode}</div>
                                        </div>
                                        <Badge className={`text-xs ${CATEGORY_COLORS[f.fieldCategory] || ''}`}>{f.fieldCategory}</Badge>
                                        <Badge variant="outline" className="text-xs">{f.dataType}</Badge>
                                        {f.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {f.defaultColumnPatterns && f.defaultColumnPatterns.length > 0 && (
                                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={f.defaultColumnPatterns.join(', ')}>
                                            Patterns: {f.defaultColumnPatterns.join(', ')}
                                          </div>
                                        )}
                                        {isSystemAdmin && (
                                          <>
                                            <Button variant="ghost" size="sm" onClick={() => startEditCft(f)} data-testid={`btn-edit-cft-${f.fieldCode}`}>
                                              <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                              if (confirm(`Delete field "${f.fieldName}"?`)) {
                                                deleteCftMutation.mutate(f.id);
                                              }
                                            }} className="text-destructive hover:text-destructive" data-testid={`btn-delete-cft-${f.fieldCode}`}>
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {(!calcFieldTypes || calcFieldTypes.length === 0) && !addingCft && (
                        <div className="text-center text-muted-foreground py-8">No calculation field types found</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reference-data" className="space-y-6">
              <ReferenceDataPanel />
            </TabsContent>

            <TabsContent value="email-smtp" className="space-y-6">
              <SmtpSettingsPanel settings={settings} getValue={getValue} handleChange={handleChange} onSave={handleSave} isSaving={updateSettingsMutation.isPending} toast={toast} />
            </TabsContent>

            <TabsContent value="finance-hub" className="space-y-6">
              <FinanceHubPanel />
            </TabsContent>

            <TabsContent value="rule-templates" className="space-y-6">
              <RuleTemplatesPanel />
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <IntegrationsPanel />
            </TabsContent>

            <TabsContent value="rule-catalog" className="space-y-6">
              <RuleFieldWhitelistPanel canEdit={isSystemAdmin || user?.role === 'admin' || user?.role === 'owner'} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

// ====================================================================
// Party Role Slots Editor — used inside the Contract Type editor
// ====================================================================
function PartyRoleSlotsEditor({
  slots,
  catalog,
  onChange,
}: {
  slots: Array<{ role: string; required: boolean; allowMultiple?: boolean }>;
  catalog: Array<{ role: string; label: string; category: 'financial' | 'operational' }>;
  onChange: (next: Array<{ role: string; required: boolean; allowMultiple?: boolean }>) => void;
}) {
  const byRole = new Map(catalog.map(c => [c.role, c]));
  const enabledRoles = new Set(slots.map(s => s.role));
  const financial = catalog.filter(c => c.category === 'financial');
  const operational = catalog.filter(c => c.category === 'operational');

  const toggleRole = (role: string) => {
    if (enabledRoles.has(role)) {
      onChange(slots.filter(s => s.role !== role));
    } else {
      onChange([...slots, { role, required: false, allowMultiple: false }]);
    }
  };

  const updateSlot = (role: string, patch: Partial<{ required: boolean; allowMultiple: boolean }>) => {
    onChange(slots.map(s => (s.role === role ? { ...s, ...patch } : s)));
  };

  const renderColumn = (title: string, color: string, items: typeof catalog) => (
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>{title}</div>
      <div className="space-y-1.5">
        {items.map(item => {
          const enabled = enabledRoles.has(item.role);
          const slot = slots.find(s => s.role === item.role);
          return (
            <div key={item.role} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`slot-${item.role}`}
                checked={enabled}
                onCheckedChange={() => toggleRole(item.role)}
                data-testid={`checkbox-slot-${item.role}`}
              />
              <label htmlFor={`slot-${item.role}`} className="flex-1 cursor-pointer truncate">{item.label}</label>
              {enabled && slot && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      checked={!!slot.required}
                      onCheckedChange={(v) => updateSlot(item.role, { required: !!v })}
                      data-testid={`checkbox-slot-required-${item.role}`}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      checked={!!slot.allowMultiple}
                      onCheckedChange={(v) => updateSlot(item.role, { allowMultiple: !!v })}
                      data-testid={`checkbox-slot-multi-${item.role}`}
                    />
                    Multi
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const requiredCount = slots.filter(s => s.required).length;

  return (
    <div className="border rounded-md p-3 bg-background space-y-3" data-testid="party-role-slots-editor">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Party Role Checklist</div>
          <div className="text-xs text-muted-foreground">
            Select roles required when activating contracts of this type. Falls back to platform defaults when empty.
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">{slots.length} roles · {requiredCount} required</Badge>
      </div>
      {catalog.length === 0 ? (
        <div className="text-xs text-muted-foreground">Loading role catalog…</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {renderColumn('Financial', 'text-blue-700 dark:text-blue-400', financial)}
          {renderColumn('Operational', 'text-purple-700 dark:text-purple-400', operational)}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Rule Field Whitelist Admin Panel
// Manages the catalog of (object, attribute) pairs available in rule
// conditions. System rows (company_id NULL) are read-only and must be
// overridden into a company-scoped editable copy before changes.
// ====================================================================
type WhitelistRow = {
  id: string;
  company_id: string | null;
  object_code: string;
  attribute_code: string;
  label: string;
  field_type: string;
  master_table: string | null;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
  sequence: number;
};

const FIELD_TYPE_OPTIONS = ['text', 'number', 'lookup', 'date', 'boolean'];

function RuleFieldWhitelistPanel({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WhitelistRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery<{ rows: WhitelistRow[]; activeCompanyId: string | null }>({
    queryKey: ['/api/rule-field-whitelist'],
  });

  const toggleActive = useMutation({
    mutationFn: async (row: WhitelistRow) => {
      await apiRequest('PATCH', `/api/rule-field-whitelist/${row.id}`, { isActive: !row.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rule-field-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rule-condition-catalog'] });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e?.message || 'Could not update', variant: 'destructive' }),
  });

  const overrideRow = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/rule-field-whitelist/${id}/override`, {});
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rule-field-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rule-condition-catalog'] });
      toast({ title: 'Override created', description: 'Editable company-scoped copy created.' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e?.message || 'Could not override', variant: 'destructive' }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/rule-field-whitelist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rule-field-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rule-condition-catalog'] });
      toast({ title: 'Deleted', description: 'Whitelist entry removed.' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e?.message || 'Could not delete', variant: 'destructive' }),
  });

  const rows = (data?.rows || []).filter(r => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.object_code.toLowerCase().includes(s) ||
      r.attribute_code.toLowerCase().includes(s) ||
      r.label.toLowerCase().includes(s) ||
      (r.master_table || '').toLowerCase().includes(s)
    );
  });

  // Group by object_code for readability
  const grouped = rows.reduce<Record<string, WhitelistRow[]>>((acc, r) => {
    (acc[r.object_code] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Rule Condition Catalog
            </CardTitle>
            <CardDescription>
              Curate which Object · Attribute pairs appear in the rule condition editor. System defaults are read-only — override to create a company-scoped editable copy.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setCreating(true)} data-testid="button-add-whitelist-entry">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          )}
        </div>
        <div className="mt-4">
          <Input
            placeholder="Search by object, attribute, label, or master table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-whitelist"
            className="max-w-md"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No entries match your search.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([objectCode, items]) => (
              <div key={objectCode}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {objectCode}
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Attribute</th>
                        <th className="px-3 py-2 font-medium">Label</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Master Table</th>
                        <th className="px-3 py-2 font-medium w-20 text-center">Seq</th>
                        <th className="px-3 py-2 font-medium w-24 text-center">Scope</th>
                        <th className="px-3 py-2 font-medium w-20 text-center">Active</th>
                        <th className="px-3 py-2 font-medium w-32 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const isSystem = !row.company_id;
                        return (
                          <tr key={row.id} className="border-t" data-testid={`row-whitelist-${row.id}`}>
                            <td className="px-3 py-2 font-mono text-xs">{row.attribute_code}</td>
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-xs">{row.field_type}</Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {row.master_table || '—'}
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.sequence}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={isSystem ? 'secondary' : 'default'} className="text-xs">
                                {isSystem ? 'System' : 'Company'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Switch
                                checked={row.is_active}
                                disabled={!canEdit || isSystem}
                                onCheckedChange={() => toggleActive.mutate(row)}
                                data-testid={`switch-active-${row.id}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {canEdit && isSystem && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => overrideRow.mutate(row.id)}
                                    title="Create editable company-scoped copy"
                                    data-testid={`button-override-${row.id}`}
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {canEdit && !isSystem && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditing(row)}
                                      data-testid={`button-edit-${row.id}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (confirm(`Delete "${row.label}" (${row.object_code}.${row.attribute_code})?`)) {
                                          deleteRow.mutate(row.id);
                                        }
                                      }}
                                      data-testid={`button-delete-${row.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editing || creating) && (
          <WhitelistEntryDialog
            row={editing}
            isCreate={creating}
            onClose={() => { setEditing(null); setCreating(false); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function WhitelistEntryDialog({
  row,
  isCreate,
  onClose,
}: {
  row: WhitelistRow | null;
  isCreate: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    objectCode: row?.object_code || '',
    attributeCode: row?.attribute_code || '',
    label: row?.label || '',
    fieldType: row?.field_type || 'text',
    masterTable: row?.master_table || '',
    isActive: row?.is_active ?? true,
    isDefault: row?.is_default ?? false,
    sequence: row?.sequence ?? 100,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        objectCode: form.objectCode.trim(),
        attributeCode: form.attributeCode.trim(),
        label: form.label.trim(),
        fieldType: form.fieldType,
        masterTable: form.masterTable.trim() || null,
        isActive: form.isActive,
        isDefault: form.isDefault,
        sequence: Number(form.sequence) || 100,
      };
      if (isCreate) {
        await apiRequest('POST', '/api/rule-field-whitelist', payload);
      } else if (row) {
        await apiRequest('PATCH', `/api/rule-field-whitelist/${row.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rule-field-whitelist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rule-condition-catalog'] });
      toast({ title: isCreate ? 'Entry created' : 'Entry updated' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e?.message || 'Could not save', variant: 'destructive' }),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add Whitelist Entry' : 'Edit Whitelist Entry'}</DialogTitle>
          <DialogDescription>
            Define an Object · Attribute pair available in the rule condition editor. Object and Attribute codes must be lowercase snake_case.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wl-object">Object Code</Label>
              <Input
                id="wl-object"
                value={form.objectCode}
                onChange={(e) => setForm({ ...form, objectCode: e.target.value })}
                placeholder="e.g. product"
                disabled={!isCreate}
                data-testid="input-wl-object"
              />
            </div>
            <div>
              <Label htmlFor="wl-attribute">Attribute Code</Label>
              <Input
                id="wl-attribute"
                value={form.attributeCode}
                onChange={(e) => setForm({ ...form, attributeCode: e.target.value })}
                placeholder="e.g. brand_id"
                data-testid="input-wl-attribute"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wl-label">Display Label</Label>
            <Input
              id="wl-label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Brand"
              data-testid="input-wl-label"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wl-type">Field Type</Label>
              <Select value={form.fieldType} onValueChange={(v) => setForm({ ...form, fieldType: v })}>
                <SelectTrigger id="wl-type" data-testid="select-wl-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wl-table">Master Table</Label>
              <Input
                id="wl-table"
                value={form.masterTable}
                onChange={(e) => setForm({ ...form, masterTable: e.target.value })}
                placeholder="e.g. products"
                data-testid="input-wl-table"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <Label htmlFor="wl-seq">Sequence</Label>
              <Input
                id="wl-seq"
                type="number"
                value={form.sequence}
                onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })}
                data-testid="input-wl-seq"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: !!v })}
                data-testid="checkbox-wl-active"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: !!v })}
                data-testid="checkbox-wl-default"
              />
              Default
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-wl-cancel">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-wl-save">
            {save.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
