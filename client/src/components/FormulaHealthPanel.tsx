import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertTriangle, XCircle, FlaskConical, Activity, Loader2, ChevronDown, ChevronUp, Edit3, X, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface FormulaAssessment {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  isActive: boolean;
  status: 'healthy' | 'warning' | 'error';
  formulaType: string;
  message: string;
}

interface FormulaHealthData {
  contractId: string;
  totalRules: number;
  healthy: number;
  warnings: number;
  errors: number;
  overallStatus: 'healthy' | 'warning' | 'error';
  assessments: FormulaAssessment[];
}

interface TestResult {
  success: boolean;
  ruleName: string;
  ruleType: string;
  inputData: {
    grossAmount: number;
    netAmount: number;
    quantity: number;
    category: string;
    territory: string;
  };
  calculatedFee: number;
  auditTrail: Array<{ step: string; description: string; value?: number }>;
  error: string | null;
}

interface RuleDetail {
  id: string;
  ruleName: string;
  ruleType: string;
  baseRate: string | null;
  minimumGuarantee: string | null;
  formulaDefinition: any;
  fieldMappings: any;
  description: string | null;
  volumeTiers: any;
}

const statusConfig = {
  healthy: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-200 dark:border-emerald-800', label: 'Ready' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800', label: 'Needs Attention' },
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', label: 'Not Calculable' },
};

export function FormulaHealthBadge({ contractId }: { contractId: string }) {
  const { data } = useQuery<FormulaHealthData>({
    queryKey: ['/api/contracts', contractId, 'formula-health'],
    queryFn: () => fetch(`/api/contracts/${contractId}/formula-health`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 30000,
  });

  if (!data || data.totalRules === 0) return null;

  const config = statusConfig[data.overallStatus];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`flex items-center gap-1.5 ${config.bg} ${config.color} ${config.border}`} data-testid="badge-formula-health">
            <Icon className="h-3.5 w-3.5" />
            {data.healthy}/{data.totalRules} Rules Ready
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm font-medium">Formula Health Check</p>
          <div className="text-xs mt-1 space-y-0.5">
            {data.healthy > 0 && <p className="text-emerald-600">{data.healthy} ready for calculation</p>}
            {data.warnings > 0 && <p className="text-amber-600">{data.warnings} need attention</p>}
            {data.errors > 0 && <p className="text-red-600">{data.errors} missing formulas</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatFormulaForDisplay(rule: RuleDetail): string {
  if (!rule) return 'No formula available';
  
  const fd = rule.formulaDefinition;
  if (!fd) {
    if (rule.baseRate) {
      const rate = parseFloat(rule.baseRate);
      if (rate < 1) {
        return `fee = grossAmount × ${(rate * 100).toFixed(1)}%`;
      }
      return `fee = quantity × $${rate.toFixed(2)}`;
    }
    return 'No formula defined';
  }

  const parts: string[] = [];
  
  if (fd.trigger) parts.push(`Trigger: ${fd.trigger}`);
  if (fd.activePeriod) parts.push(`Active Period: ${fd.activePeriod}`);
  if (fd.product) parts.push(`Product: ${fd.product}`);
  if (fd.calculationBasis) parts.push(`Calculation Basis: ${fd.calculationBasis}`);
  
  if (fd.tiers && Array.isArray(fd.tiers) && fd.tiers.length > 0) {
    parts.push('');
    parts.push('Tier Structure:');
    fd.tiers.forEach((tier: any) => {
      if (tier.description) {
        parts.push(`  Tier ${tier.tier || ''}: ${tier.description}`);
      } else if (tier.min !== undefined) {
        const maxStr = tier.max ? `$${tier.max.toLocaleString()}` : '+';
        const rate = tier.rate || 0;
        parts.push(`  Tier ${tier.tier || ''}: $${tier.min.toLocaleString()} - ${maxStr} → ${(rate * 100).toFixed(1)}%`);
      }
    });
  }
  
  if (fd.logic) {
    parts.push('');
    parts.push('Calculation Logic:');
    fd.logic.split('\n').forEach((line: string) => parts.push(line));
  }
  
  if (fd.baseRate !== undefined && !fd.tiers) {
    const rate = fd.baseRate;
    const basis = fd.calculationBasis || 'grossAmount';
    if (typeof rate === 'number') {
      if (rate < 1) {
        parts.push(`fee = ${basis} × ${(rate * 100).toFixed(1)}%`);
      } else {
        parts.push(`fee = quantity × $${rate.toFixed(2)}`);
      }
    }
  }
  
  if (fd.fixedAmount) {
    parts.push(`Fixed Amount: $${fd.fixedAmount.toLocaleString()}`);
  }
  
  if (fd.formula && fd.formula.type) {
    parts.push(`Formula Type: ${fd.formula.type}`);
    if (fd.formula.operands) {
      const desc = fd.formula.operands.map((op: any) => {
        if (op.type === 'reference') return op.field;
        if (op.type === 'literal') return op.value;
        return JSON.stringify(op);
      }).join(' × ');
      parts.push(`Expression: ${desc}`);
    }
  }

  if (fd.tableData?.rows?.length > 0 && rule.fieldMappings) {
    const fm = rule.fieldMappings;
    parts.push('');
    parts.push('Table-based formula:');
    parts.push(`  Volume field: ${fm.volumeField || 'not set'}`);
    parts.push(`  Rate field: ${fm.rateField || 'not set'}`);
    if (fm.minimumField) parts.push(`  Minimum field: ${fm.minimumField}`);
    parts.push(`  Rows: ${fd.tableData.rows.length}`);
  }

  if (fd.threshold) parts.push(`Qualifying Threshold: $${fd.threshold.toLocaleString()}`);
  if (fd.minimumGuarantee || rule.minimumGuarantee) {
    const mg = fd.minimumGuarantee || parseFloat(rule.minimumGuarantee || '0');
    if (mg) parts.push(`Minimum Guarantee: $${mg.toLocaleString()}`);
  }

  if (fd.example) {
    parts.push('');
    parts.push('Example:');
    parts.push(`  Scenario: ${fd.example.scenario}`);
    if (fd.example.calculation) {
      fd.example.calculation.forEach((line: string) => parts.push(`  ${line}`));
    }
  }
  
  if (fd.notes) {
    parts.push('');
    parts.push(`Notes: ${fd.notes}`);
  }

  return parts.filter(p => p !== undefined).join('\n') || 'No formula details available';
}

function RuleTestInlinePanel({ ruleId, ruleName, contractId, onClose }: { ruleId: string; ruleName: string; contractId: string; onClose: () => void }) {
  const [grossAmount, setGrossAmount] = useState("1000");
  const [quantity, setQuantity] = useState("10");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isEditingFormula, setIsEditingFormula] = useState(false);
  const [editedFormula, setEditedFormula] = useState<string>("");

  const { data: ruleData, isLoading: ruleLoading } = useQuery<any>({
    queryKey: ['/api/contracts', contractId, 'rules', ruleId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/rules`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.rules?.find((r: any) => r.id === ruleId) || null;
    },
  });

  const formulaDisplay = ruleData ? formatFormulaForDisplay(ruleData) : 'Loading...';

  const testMutation = useMutation({
    mutationFn: async (params: { grossAmount: number; quantity: number }) => {
      const res = await apiRequest('POST', `/api/rules/${ruleId}/test`, params);
      return res.json();
    },
    onSuccess: (data) => setTestResult(data),
  });

  const saveFormulaMutation = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(editedFormula);
      const res = await apiRequest('PATCH', `/api/contracts/${contractId}/rules/${ruleId}`, {
        formulaDefinition: parsed,
      });
      return res.json();
    },
    onSuccess: () => {
      setIsEditingFormula(false);
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId, 'formula-health'] });
    },
  });

  const runTest = () => {
    testMutation.mutate({
      grossAmount: parseFloat(grossAmount) || 1000,
      quantity: parseInt(quantity) || 1,
    });
  };

  const startEditing = useCallback(() => {
    if (ruleData?.formulaDefinition) {
      setEditedFormula(JSON.stringify(ruleData.formulaDefinition, null, 2));
    } else {
      setEditedFormula('{}');
    }
    setIsEditingFormula(true);
  }, [ruleData]);

  return (
    <div className="mt-3 border border-violet-200 dark:border-violet-800 rounded-lg bg-violet-50/50 dark:bg-violet-950/30 overflow-hidden" data-testid={`inline-test-panel-${ruleId}`}>
      <div className="flex items-center justify-between p-3 bg-violet-100/50 dark:bg-violet-900/30 border-b border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-semibold text-violet-800 dark:text-violet-200">Test: {ruleName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" data-testid="btn-close-test-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Formula Definition</Label>
            {!isEditingFormula ? (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-violet-600" onClick={startEditing} data-testid="btn-edit-formula">
                <Edit3 className="h-3 w-3" />
                Edit Formula
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingFormula(false)} data-testid="btn-cancel-edit-formula">
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="h-6 text-xs gap-1 bg-violet-600 hover:bg-violet-700"
                  onClick={() => saveFormulaMutation.mutate()} 
                  disabled={saveFormulaMutation.isPending}
                  data-testid="btn-save-formula"
                >
                  {saveFormulaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            )}
          </div>
          {isEditingFormula ? (
            <Textarea
              value={editedFormula}
              onChange={(e) => setEditedFormula(e.target.value)}
              className="font-mono text-xs min-h-[200px] bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-700"
              data-testid="textarea-edit-formula"
            />
          ) : (
            <pre className="text-xs bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-700 rounded-md p-3 whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300 max-h-[250px] overflow-y-auto" data-testid="text-formula-display">
              {ruleLoading ? 'Loading formula...' : formulaDisplay}
            </pre>
          )}
        </div>

        <Separator className="bg-violet-200 dark:bg-violet-800" />

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Test Inputs</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`test-gross-${ruleId}`} className="text-xs text-muted-foreground">Gross Sales Amount ($)</Label>
              <Input
                id={`test-gross-${ruleId}`}
                type="number"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="1000"
                className="h-8 text-sm"
                data-testid="input-test-gross"
              />
            </div>
            <div>
              <Label htmlFor={`test-qty-${ruleId}`} className="text-xs text-muted-foreground">Quantity / Units</Label>
              <Input
                id={`test-qty-${ruleId}`}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="h-8 text-sm"
                data-testid="input-test-quantity"
              />
            </div>
          </div>
        </div>

        <Button onClick={runTest} disabled={testMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="btn-run-test">
          {testMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
          ) : (
            <><FlaskConical className="h-4 w-4 mr-2" /> Run Test</>
          )}
        </Button>

        {testResult && (
          <div className={`rounded-lg p-4 border ${testResult.success ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`} data-testid="test-result">
            {testResult.success ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Calculated Contract Fee</span>
                  <span className="text-2xl font-bold text-emerald-800 dark:text-emerald-200" data-testid="text-test-result-amount">
                    ${testResult.calculatedFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {testResult.auditTrail && testResult.auditTrail.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Calculation Steps:</p>
                    <div className="space-y-1">
                      {testResult.auditTrail.map((step, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-emerald-600 dark:text-emerald-400 shrink-0">{idx + 1}.</span>
                          <span>{step.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">{testResult.error || 'Formula evaluation failed'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormulaHealthPanel({ contractId }: { contractId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FormulaHealthData>({
    queryKey: ['/api/contracts', contractId, 'formula-health'],
    queryFn: () => fetch(`/api/contracts/${contractId}/formula-health`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 30000,
  });

  if (isLoading || !data || data.totalRules === 0) return null;

  const config = statusConfig[data.overallStatus];
  const Icon = config.icon;

  return (
    <Card className={`${config.border} border`} data-testid="panel-formula-health">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Activity className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-base">Formula Health</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Pre-flight check for calculation readiness</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {data.healthy > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" data-testid="badge-healthy-count">
                  <CheckCircle className="h-3 w-3 mr-1" /> {data.healthy}
                </Badge>
              )}
              {data.warnings > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" data-testid="badge-warning-count">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {data.warnings}
                </Badge>
              )}
              {data.errors > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" data-testid="badge-error-count">
                  <XCircle className="h-3 w-3 mr-1" /> {data.errors}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} data-testid="btn-toggle-health-details">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-3" />
          <div className="space-y-2">
            {data.assessments.map((assessment) => {
              const aConfig = statusConfig[assessment.status];
              const AIcon = aConfig.icon;
              const isTestOpen = testingRuleId === assessment.ruleId;
              return (
                <div key={assessment.ruleId}>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg ${aConfig.bg} ${aConfig.border} border`} data-testid={`health-row-${assessment.ruleId}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <AIcon className={`h-4 w-4 shrink-0 ${aConfig.color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{assessment.ruleName}</p>
                        <p className="text-xs text-muted-foreground">{assessment.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-xs">{assessment.formulaType}</Badge>
                      {assessment.status === 'healthy' && assessment.isActive && (
                        <Button 
                          variant={isTestOpen ? "default" : "outline"} 
                          size="sm" 
                          className={`h-7 text-xs gap-1 ${isTestOpen ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                          onClick={() => setTestingRuleId(isTestOpen ? null : assessment.ruleId)}
                          data-testid={`btn-test-rule-${assessment.ruleId}`}
                        >
                          <FlaskConical className="h-3 w-3" />
                          {isTestOpen ? 'Close' : 'Test'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isTestOpen && (
                    <RuleTestInlinePanel
                      ruleId={assessment.ruleId}
                      ruleName={assessment.ruleName}
                      contractId={contractId}
                      onClose={() => setTestingRuleId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function RuleHealthBadge({ ruleId, contractId }: { ruleId: string; contractId: string }) {
  const { data } = useQuery<FormulaHealthData>({
    queryKey: ['/api/contracts', contractId, 'formula-health'],
    queryFn: () => fetch(`/api/contracts/${contractId}/formula-health`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 30000,
  });

  if (!data) return null;

  const assessment = data.assessments.find(a => a.ruleId === ruleId);
  if (!assessment) return null;

  const config = statusConfig[assessment.status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`flex items-center gap-1 ${config.bg} ${config.color} ${config.border}`} data-testid={`badge-health-${ruleId}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{assessment.message}</p>
          <p className="text-xs text-muted-foreground">Type: {assessment.formulaType}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
