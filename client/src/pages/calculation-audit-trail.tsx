import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  FileText, 
  Calculator, 
  Download,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  AlertTriangle,
  Info,
  ExternalLink,
  Link2,
  Hash,
  FileSearch,
  ClipboardCheck,
  BarChart3,
  Upload,
  Settings
} from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { generateDynamicFormula } from "@/lib/dynamicFormulaGenerator";
import { useErpValueMap, ErpValueDisplay } from "@/hooks/useErpValueMap";

interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  values: string;
  result: string;
}

interface ConditionCheck {
  condition: string;
  expected: string;
  actual: string;
  matched: boolean;
}

interface RuleSnapshot {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  baseRate: number;
  isAiExtracted: boolean;
  sourceText?: string;
  sourceSection?: string;
  confidence?: number;
}

interface QualifierEvaluated {
  field: string;
  operator: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface AdjustmentStep {
  step: string;
  value?: number;
  multiplier?: number;
  territory?: string;
  formula?: string;
  result: number;
}

interface RuleResultData {
  id: string;
  calculationId: string;
  ruleId: string | null;
  ruleName: string;
  ruleType: string;
  ruleSnapshot: any;
  qualificationSummary: QualifierEvaluated[];
  adjustmentsApplied: any[];
  totalFee: string;
  totalSalesAmount: string;
  transactionCount: number;
}

interface AuditLineItem {
  lineNumber: number;
  saleId: string;
  productName: string;
  category: string;
  territory: string;
  transactionDate?: string;
  quantity: number;
  grossAmount: number;
  ruleApplied: string;
  baseRate: number;
  effectiveRate: number;
  seasonalMultiplier: number;
  territoryMultiplier: number;
  calculatedRoyalty: number;
  explanation: string;
  calculationType: string;
  volumeDiscountApplied: boolean;
  volumeThresholdMet?: number;
  calculationSteps: CalculationStep[];
  conditionsChecked: ConditionCheck[];
  ruleSnapshot: RuleSnapshot;
  qualifiersEvaluated?: QualifierEvaluated[];
  adjustmentSteps?: AdjustmentStep[];
  formulaSource?: string;
  tierMode?: 'whole' | 'marginal';
}

const FORMULA_SOURCE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  primary_formula_node:              { label: 'Formula',        color: 'bg-green-100 text-green-800',   description: 'Executed from structured formula definition' },
  rebate_tiered_quarterly_universal: { label: 'Quarterly',      color: 'bg-blue-100 text-blue-800',     description: 'Quarterly rebate aggregation via universal engine' },
  table_data_field_mappings:         { label: 'Table',          color: 'bg-purple-100 text-purple-800', description: 'Built on-the-fly from extracted table data' },
  base_rate_percentage:              { label: 'Base Rate',      color: 'bg-orange-100 text-orange-800', description: 'AI-extracted percentage rate' },
  fixed_amount:                      { label: 'Fixed',          color: 'bg-gray-100 text-gray-700',     description: 'Fixed fee or bonus amount' },
  minimum_guarantee:                 { label: 'Min Guarantee',  color: 'bg-red-100 text-red-800',       description: 'Minimum guarantee true-up applied' },
  tiers_array:                       { label: 'Tiers',          color: 'bg-indigo-100 text-indigo-800', description: 'Built from AI-extracted tier array' },
  volume_tiers_legacy:               { label: 'Legacy Tiers',   color: 'bg-yellow-100 text-yellow-800', description: 'Built from legacy volumeTiers field' },
  direct_base_rate_final:            { label: 'Direct Rate',    color: 'bg-amber-100 text-amber-800',   description: 'Final fallback: direct baseRate from rule' },
  unknown:                           { label: 'Unknown',        color: 'bg-gray-100 text-gray-500',     description: 'Formula source could not be determined' },
};

function FormulaSourceBadge({ source }: { source?: string }) {
  const key = source && FORMULA_SOURCE_CONFIG[source] ? source : 'unknown';
  const cfg = FORMULA_SOURCE_CONFIG[key];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium cursor-help ${cfg.color}`}
            data-testid={`badge-formula-source-${key}`}
          >
            {cfg.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{cfg.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RuleDefinition {
  id: string;
  ruleName: string;
  description: string;
  ruleType: string;
  baseRate: number;
  volumeTiers?: any[];
  productCategories?: string[];
  territories?: string[];
  seasonalAdjustments?: any;
  territoryPremiums?: any;
  sourceText?: string;
  sourceSection?: string;
  sourcePage?: number;
  confidence?: number;
  isAiExtracted: boolean;
  reviewStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface AuditData {
  calculationId: string;
  calculationName: string;
  calculationDate: string;
  periodStart: string;
  periodEnd: string;
  contractId: string;
  contractName: string;
  contractType: string;
  summary: {
    totalLicenseFee: number;
    totalGrossAmount: number;
    totalQuantity: number;
    itemsProcessed: number;
    rulesUsed: number;
    effectiveRate: string;
  };
  lineItems: AuditLineItem[];
  rulesDefinitions: RuleDefinition[];
  ruleResults?: RuleResultData[];
  auditMetadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    format: string;
  };
}

function generateAuditRefId(calcId: string, lineNumber: number): string {
  const shortCalcId = calcId.substring(0, 8).toUpperCase();
  return `LF-${shortCalcId}-${String(lineNumber).padStart(4, '0')}`;
}

function generateRuleRefId(ruleId: string): string {
  const shortRuleId = ruleId.substring(0, 8).toUpperCase();
  return `RULE-${shortRuleId}`;
}

function LicenseFeeCalculatorNav({ currentPage, contractId }: { currentPage: string; contractId?: string }) {
  const [, setLocation] = useLocation();
  
  return (
    <Card className="bg-slate-50 dark:bg-slate-900/50">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Contract Fee Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={currentPage === 'calculations' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setLocation('/calculations')}
            data-testid="nav-calculations"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Calculations
          </Button>
          <Button 
            variant={currentPage === 'sales-upload' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setLocation('/sales-upload')}
            data-testid="nav-sales-upload"
          >
            <Upload className="h-4 w-4 mr-1" />
            Sales Upload
          </Button>
          {contractId && (
            <Button 
              variant={currentPage === 'rules' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setLocation(`/contracts/${contractId}/pipeline`)}
              data-testid="nav-rules"
            >
              <Settings className="h-4 w-4 mr-1" />
              Rules
            </Button>
          )}
          {contractId && (
            <Button 
              variant={currentPage === 'contract' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setLocation(`/contracts/${contractId}/manage`)}
              data-testid="nav-contract"
            >
              <FileText className="h-4 w-4 mr-1" />
              Contract
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContractSourceReference({ rule, contractId }: { rule: RuleDefinition; contractId: string }) {
  const [, setLocation] = useLocation();
  
  if (!rule.sourceText && !rule.sourceSection) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No contract source linked
      </div>
    );
  }
  
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
          <FileSearch className="h-4 w-4" />
          Contract Source Reference
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation(`/contracts/${contractId}/manage`)}
          className="text-xs h-7"
          data-testid={`btn-view-source-${rule.id}`}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View in Contract
        </Button>
      </div>
      
      {rule.sourceSection && (
        <div className="text-xs">
          <span className="text-muted-foreground">Section: </span>
          <span className="font-medium">{rule.sourceSection}</span>
        </div>
      )}
      
      {rule.sourceText && (
        <div className="bg-white dark:bg-slate-800 p-2 rounded border text-xs italic max-h-24 overflow-y-auto">
          "{rule.sourceText}"
        </div>
      )}
      
      {rule.confidence && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">AI Confidence:</span>
          <Badge 
            variant={rule.confidence >= 0.85 ? "default" : rule.confidence >= 0.6 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {(rule.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      )}
    </div>
  );
}

// Inline Formula Display - Shows generated formula without popup
function InlineFormulaDisplay({ 
  ruleSnapshot, 
  matchingRule 
}: { 
  ruleSnapshot: RuleSnapshot; 
  matchingRule?: RuleDefinition;
}) {
  // Generate formula text from rule data
  const formulaText = useMemo(() => {
    const formulaDefinition = (matchingRule as any)?.formulaDefinition || (ruleSnapshot as any)?.formulaDefinition;
    
    if (!formulaDefinition) {
      // Fallback for simple rules
      if (ruleSnapshot.ruleType === 'percentage') {
        return `Net Amount × ${ruleSnapshot.baseRate}%`;
      }
      if (ruleSnapshot.ruleType === 'per_unit') {
        return `Quantity × Rate per Unit`;
      }
      return null;
    }
    
    const tableData = formulaDefinition.tableData;
    const fieldMappings = (matchingRule as any)?.fieldMappings || {};
    
    if (tableData?.rows?.length > 0) {
      try {
        return generateDynamicFormula({
          tableData,
          fieldMappings: {
            volume: fieldMappings.volumeField,
            rate: fieldMappings.rateField,
            minimum: fieldMappings.minimumField,
            description: fieldMappings.descriptionField,
          },
          ruleName: ruleSnapshot.ruleName,
          ruleType: ruleSnapshot.ruleType,
        });
      } catch (e) {
        console.error('Failed to generate formula:', e);
      }
    }
    
    return null;
  }, [ruleSnapshot, matchingRule]);
  
  if (!formulaText) return null;
  
  return (
    <div className="bg-gradient-to-r from-purple-50 to-orange-50 dark:from-purple-900/20 dark:to-orange-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-200">
        <Calculator className="h-4 w-4" />
        Generated Formula
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded border font-mono text-sm whitespace-pre-wrap">
        {formulaText}
      </div>
    </div>
  );
}

function AuditCertificationHeader({ auditData }: { auditData: AuditData }) {
  const auditId = `AUDIT-${auditData.calculationId.substring(0, 12).toUpperCase()}`;
  
  return (
    <Card className="border-2 border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-stone-950/30 dark:to-stone-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-950 p-2 rounded-lg">
              <ClipboardCheck className="h-6 w-6 text-orange-700 dark:text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-xl">Contract Fee Calculation Audit Trail</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Hash className="h-3 w-3" />
                <span className="font-mono text-xs">{auditId}</span>
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            v{auditData.auditMetadata.version}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Calculation Name</p>
            <p className="font-medium">{auditData.calculationName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Contract</p>
            <p className="font-medium">{auditData.contractName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Period</p>
            <p className="font-medium">
              {auditData.periodStart && auditData.periodEnd 
                ? `${format(new Date(auditData.periodStart), 'MM/dd/yyyy')} - ${format(new Date(auditData.periodEnd), 'MM/dd/yyyy')}`
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Generated</p>
            <p className="font-medium">{format(new Date(auditData.auditMetadata.generatedAt), 'MM/dd/yyyy h:mm a')}</p>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold text-green-600">${auditData.summary.totalLicenseFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Total Contract Fee</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold">${auditData.summary.totalGrossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Gross Sales</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold">{auditData.summary.totalQuantity.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Units</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold">{auditData.summary.itemsProcessed}</p>
            <p className="text-xs text-muted-foreground">Line Items</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold">{auditData.summary.rulesUsed}</p>
            <p className="text-xs text-muted-foreground">Rules Applied</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
            <p className="text-2xl font-bold">{auditData.summary.effectiveRate}</p>
            <p className="text-xs text-muted-foreground">Effective Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormulaVisualization({ item, auditRefId, contractId, rulesDefinitions }: { 
  item: AuditLineItem; 
  auditRefId: string;
  contractId: string;
  rulesDefinitions: RuleDefinition[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();
  
  const ruleId = item.ruleSnapshot?.ruleId || 'unknown';
  const matchingRule = rulesDefinitions.find(r => r.id === ruleId) || rulesDefinitions.find(r => r.ruleName === item.ruleApplied);
  const ruleRefId = ruleId !== 'unknown' ? generateRuleRefId(ruleId) : 'N/A';
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start p-2 h-auto">
          {expanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
          <span className="font-mono text-xs">
            {(() => {
                  const gross = Number(item.grossAmount || 0);
                  const fee = Number(item.calculatedRoyalty || 0);
                  const rate = Number(item.effectiveRate || 0) > 0 ? Number(item.effectiveRate) : (gross > 0 ? (fee / gross) * 100 : 0);
                  const ratePercent = rate > 0 && rate < 1 ? (rate * 100) : rate;
                  return `$${gross.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} × ${ratePercent.toFixed(2)}% = $${fee.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                })()
            }
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mt-2 space-y-4">
          
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-3">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-orange-900 dark:text-orange-200 mb-2">
              <Link2 className="h-4 w-4" />
              End-to-End Reference Chain
            </h4>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="font-mono cursor-help">
                    {auditRefId}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Line Item Reference ID</TooltipContent>
              </Tooltip>
              <span className="text-muted-foreground">→</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className="font-mono cursor-pointer hover:bg-orange-100"
                    onClick={() => {
                      const ruleElement = document.getElementById(`rule-${ruleId}`);
                      if (ruleElement) {
                        ruleElement.scrollIntoView({ behavior: 'smooth' });
                        ruleElement.classList.add('ring-2', 'ring-orange-600');
                        setTimeout(() => ruleElement.classList.remove('ring-2', 'ring-orange-600'), 2000);
                      }
                    }}
                  >
                    {ruleRefId}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Click to jump to Rule Definition (ID: {ruleId.substring(0, 8)}...)</TooltipContent>
              </Tooltip>
              <span className="text-muted-foreground">→</span>
              {(matchingRule?.sourceSection || matchingRule?.sourcePage) ? (
                <>
                  {matchingRule.sourceSection && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className="font-mono cursor-pointer"
                          onClick={() => setLocation(`/contracts/${contractId}/manage`)}
                        >
                          {matchingRule.sourceSection.length > 40 
                            ? `${matchingRule.sourceSection.substring(0, 40)}...` 
                            : matchingRule.sourceSection}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Section: {matchingRule.sourceSection}</p>
                        <p className="text-xs text-muted-foreground">Click to view Contract</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {matchingRule.sourcePage && (
                    <>
                      {matchingRule.sourceSection && <span className="text-muted-foreground">→</span>}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="default" 
                            className="bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={() => setLocation(`/contracts/${contractId}/manage`)}
                          >
                            Page {matchingRule.sourcePage}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Source page in contract document</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Manual Rule
                </Badge>
              )}
            </div>
          </div>
          
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Step-by-Step Calculation
          </h4>
          
          {item.calculationSteps.length > 0 ? (
            <div className="space-y-2">
              {item.calculationSteps.map((step, stepIndex) => {
                const isFinalStep = stepIndex === item.calculationSteps.length - 1;
                const isContainerSizeCalc = 
                  (item.ruleSnapshot?.ruleType === 'per_unit');
                const formulaDisplay = isFinalStep && isContainerSizeCalc
                  ? `Quantity × Base Rate × Seasonal × Territory = ${item.quantity} × $${item.effectiveRate.toFixed(2)} × ${item.seasonalMultiplier} × ${item.territoryMultiplier}`
                  : isFinalStep && (item.calculationType === 'percentage' || item.calculationType === 'volume_tier')
                  ? `Gross Amount × Rate × Seasonal × Territory = $${item.grossAmount.toFixed(2)} × ${item.effectiveRate}% × ${item.seasonalMultiplier} × ${item.territoryMultiplier}`
                  : step.formula;
                
                return (
                  <div key={step.step} className="flex items-start gap-3 text-sm border-l-2 border-orange-300 pl-3">
                    <div className="bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.description}</p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {formulaDisplay}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Values: {step.values}
                      </p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        → {step.result}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 p-3 rounded border space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="ml-2 font-mono">{item.quantity} units</span>
                </div>
                {(() => {
                  const isContainerCalc = 
                    item.ruleSnapshot?.ruleType === 'per_unit';
                  return !isContainerCalc ? (
                    <div>
                      <span className="text-muted-foreground">Net Sales:</span>
                      <span className="ml-2 font-mono">${Number(item.grossAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : null;
                })()}
                <div>
                  <span className="text-muted-foreground">{(item.ruleSnapshot?.ruleType === 'tiered' || item.ruleSnapshot?.ruleType === 'rebate_tiered') ? 'Tier Rate:' : 'Base Rate:'}</span>
                  <span className="ml-2 font-mono">{(item.ruleSnapshot?.ruleType === 'per_unit') ? `$${item.baseRate.toFixed(2)}/unit` : `${Number(item.baseRate || 0).toFixed(2)}%`}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Rate:</span>
                  <span className="ml-2 font-mono">{(item.ruleSnapshot?.ruleType === 'per_unit') ? `$${item.effectiveRate.toFixed(2)}/unit` : `${Number(item.effectiveRate || 0).toFixed(2)}%`}</span>
                  {item.volumeDiscountApplied && (
                    <Badge variant="secondary" className="ml-2 text-xs">Volume Discount</Badge>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Seasonal:</span>
                  <span className="ml-2 font-mono">×{item.seasonalMultiplier.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Territory:</span>
                  <span className="ml-2 font-mono">×{item.territoryMultiplier.toFixed(2)}</span>
                </div>
              </div>
              <Separator />
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                {(() => {
                  const isContainerCalc = 
                    item.ruleSnapshot?.ruleType === 'per_unit';
                  return (
                    <>
                      <p className="font-mono text-sm font-medium mb-1">
                        {isContainerCalc 
                          ? 'Quantity × Base Rate × Seasonal Adjustment × Territory Multiplier'
                          : 'Net Sales × Effective Rate × Seasonal Adjustment × Territory Multiplier'
                        }
                      </p>
                      <p className="font-mono text-sm">
                        {isContainerCalc 
                          ? `= ${item.quantity} × $${Number(item.effectiveRate || 0).toFixed(2)} × ${item.seasonalMultiplier} × ${item.territoryMultiplier}`
                          : `= $${Number(item.grossAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${(Number(item.effectiveRate || 0)/100).toFixed(4)} × ${item.seasonalMultiplier} × ${item.territoryMultiplier}`
                        }
                      </p>
                    </>
                  );
                })()}
                <p className="font-bold text-lg text-green-600 dark:text-green-400">
                  = ${item.calculatedRoyalty.toFixed(2)}
                </p>
              </div>
            </div>
          )}
          
          <h4 className="font-semibold text-sm flex items-center gap-2 pt-2">
            <Info className="h-4 w-4" />
            Conditions Evaluated
          </h4>
          
          {item.conditionsChecked.length > 0 ? (
            <div className="space-y-1">
              {item.conditionsChecked.map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 p-2 rounded border">
                  {check.matched ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-medium">{check.condition}:</span>
                    <span className="ml-2 text-muted-foreground">Expected: {check.expected}</span>
                    <span className="mx-2">|</span>
                    <span className="text-muted-foreground">Actual: {check.actual}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No condition checks recorded</p>
          )}
          
          <h4 className="font-semibold text-sm flex items-center gap-2 pt-2">
            <FileText className="h-4 w-4" />
            Rule Definition Used
          </h4>
          <div className="bg-white dark:bg-slate-800 p-3 rounded border text-sm space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">{ruleRefId}</Badge>
              <span className="font-medium">{item.ruleSnapshot.ruleName}</span>
              <Badge variant={item.ruleSnapshot.isAiExtracted ? "default" : "secondary"}>
                {item.ruleSnapshot.isAiExtracted ? (
                  <><Bot className="h-3 w-3 mr-1" /> AI Extracted</>
                ) : (
                  <><User className="h-3 w-3 mr-1" /> Manual</>
                )}
              </Badge>
              {item.ruleSnapshot.confidence && (
                <Badge variant="outline">{(item.ruleSnapshot.confidence * 100).toFixed(0)}% confidence</Badge>
              )}
            </div>
            <p className="text-muted-foreground">Type: {item.ruleSnapshot.ruleType}</p>
            
            {/* Inline Generated Formula */}
            <InlineFormulaDisplay ruleSnapshot={item.ruleSnapshot} matchingRule={matchingRule} />
            
            {matchingRule && (
              <ContractSourceReference rule={matchingRule} contractId={contractId} />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FormulaSourceBreakdown({ lineItems }: { lineItems: AuditLineItem[] }) {
  const [open, setOpen] = useState(false);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of lineItems || []) {
      const key = item.formulaSource || 'unknown';
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [lineItems]);
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600"
          data-testid="button-toggle-formula-source-breakdown"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Formula Source Breakdown
          <span className="text-xs font-normal text-muted-foreground">({lineItems?.length || 0} fee items)</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-wrap gap-3 mt-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border">
          {entries.map(([source, count]) => (
            <span key={source} className="flex items-center gap-1.5" data-testid={`formula-source-count-${source}`}>
              <FormulaSourceBadge source={source} />
              <span className="text-xs text-muted-foreground">{count}</span>
            </span>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RuleSummaryPanel({ ruleResults, totalFee, onRuleClick, lineItems }: {
  ruleResults: RuleResultData[];
  totalFee: number;
  onRuleClick: (ruleName: string) => void;
  lineItems: AuditLineItem[];
}) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  
  if (!ruleResults || ruleResults.length === 0) return null;
  
  return (
    <Card className="border-2 border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Rule-Level Summary
        </CardTitle>
        <CardDescription>
          Per-rule aggregated results with frozen rule snapshots — click a rule to filter line items below
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50 dark:bg-blue-950/30">
                <TableHead className="font-semibold">Rule Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="text-right font-semibold">Transactions</TableHead>
                <TableHead className="text-right font-semibold">Sales Amount</TableHead>
                <TableHead className="text-right font-semibold">Fee Amount</TableHead>
                <TableHead className="text-right font-semibold">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruleResults.map((rr) => {
                const fee = parseFloat(rr.totalFee || '0');
                const salesAmt = parseFloat(rr.totalSalesAmount || '0');
                const pctOfTotal = totalFee > 0 ? ((fee / totalFee) * 100).toFixed(1) : '0';
                const isExpanded = expandedRule === rr.id;
                
                return (
                  <TableRow 
                    key={rr.id} 
                    className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                    onClick={() => {
                      setExpandedRule(isExpanded ? null : rr.id);
                      onRuleClick(rr.ruleName);
                    }}
                    data-testid={`rule-result-row-${rr.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium">{rr.ruleName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{rr.ruleType}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{rr.transactionCount}</TableCell>
                    <TableCell className="text-right font-mono">${salesAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-600">${fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{pctOfTotal}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <FormulaSourceBreakdown lineItems={lineItems} />

        {expandedRule && (() => {
          const rr = ruleResults.find(r => r.id === expandedRule);
          if (!rr) return null;
          const snapshot = rr.ruleSnapshot;
          const qualifiers = rr.qualificationSummary || [];
          const adjustments = rr.adjustmentsApplied || [];
          
          return (
            <div className="mt-4 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <FileSearch className="h-4 w-4" />
                Frozen Rule Snapshot (as at calculation time)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Rule Type</span>
                  <p className="font-medium">{snapshot.ruleType || rr.ruleType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Base Rate</span>
                  <p className="font-mono">{snapshot.baseRate || 'N/A'}</p>
                </div>
                {snapshot.productCategories && snapshot.productCategories.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Product Categories</span>
                    <p className="font-medium text-xs">{snapshot.productCategories.join(', ')}</p>
                  </div>
                )}
                {snapshot.territories && snapshot.territories.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Territories</span>
                    <p className="font-medium text-xs">{snapshot.territories.join(', ')}</p>
                  </div>
                )}
                {snapshot.priority !== undefined && (
                  <div>
                    <span className="text-muted-foreground text-xs">Priority</span>
                    <p className="font-mono">{snapshot.priority}</p>
                  </div>
                )}
                {snapshot.confidence && (
                  <div>
                    <span className="text-muted-foreground text-xs">AI Confidence</span>
                    <p className="font-mono">{(parseFloat(snapshot.confidence) * 100).toFixed(0)}%</p>
                  </div>
                )}
              </div>
              
              {qualifiers.length > 0 && (
                <>
                  <Separator />
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Qualification Criteria Evaluated
                  </h4>
                  <div className="space-y-1">
                    {qualifiers.map((q: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 p-2 rounded border">
                        {q.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium">{q.field}:</span>
                        <span className="text-muted-foreground">Expected: {typeof q.expected === 'object' ? JSON.stringify(q.expected) : q.expected}</span>
                        <span className="mx-1">|</span>
                        <span className="text-muted-foreground">Sample: {q.sampleActual || q.actual}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {adjustments.length > 0 && (
                <>
                  <Separator />
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Adjustments Applied
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {adjustments.map((adj: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {adj.type === 'seasonal' && `Seasonal: ×${adj.multiplier}`}
                        {adj.type === 'territory' && `Territory (${adj.territory}): ×${adj.multiplier}`}
                        {adj.type === 'volume' && `Volume Tier: ${adj.tier}`}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              
              {snapshot.sourceText && (
                <>
                  <Separator />
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                      <FileSearch className="h-4 w-4" />
                      Contract Source
                      {snapshot.sourceSection && <span className="text-xs font-normal">({snapshot.sourceSection})</span>}
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded border text-xs italic max-h-20 overflow-y-auto">
                      "{snapshot.sourceText}"
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

function AdjustmentWaterfall({ steps }: { steps: AdjustmentStep[] }) {
  if (!steps || steps.length <= 1) return null;
  
  return (
    <div className="bg-gradient-to-b from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
      <h4 className="font-semibold text-xs flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
        <BarChart3 className="h-3 w-3" />
        Fee Waterfall
      </h4>
      {steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div key={idx} className={`flex items-center gap-2 text-xs ${isLast ? 'font-bold text-green-700 dark:text-green-400' : ''}`}>
            {!isLast ? (
              <div className="w-3 h-3 border-l-2 border-b-2 border-blue-300 dark:border-blue-600 ml-1" />
            ) : (
              <span className="ml-1 text-green-600">=</span>
            )}
            <span className={isLast ? 'font-bold' : 'text-muted-foreground'}>{s.step}</span>
            {s.formula && <span className="font-mono text-muted-foreground">{s.formula}</span>}
            <span className="ml-auto font-mono">
              ${s.result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QualifierTrail({ qualifiers }: { qualifiers: QualifierEvaluated[] }) {
  if (!qualifiers || qualifiers.length === 0) return null;
  
  return (
    <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3 space-y-1">
      <h4 className="font-semibold text-xs flex items-center gap-2 text-violet-800 dark:text-violet-200 mb-2">
        <ClipboardCheck className="h-3 w-3" />
        Why This Rule Matched
      </h4>
      {qualifiers.map((q, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          {q.passed ? (
            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
          )}
          <span className="font-medium">{q.field}</span>
          <span className="text-muted-foreground">expected: {typeof q.expected === 'object' ? JSON.stringify(q.expected) : q.expected}</span>
          <span className="text-muted-foreground">| actual: {q.actual}</span>
        </div>
      ))}
    </div>
  );
}

export default function CalculationAuditTrail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const calculationId = params.id;
  
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  
  const { data: auditData, isLoading, error } = useQuery<AuditData>({
    queryKey: [`/api/calculations/${calculationId}/audit-trail`],
    enabled: !!calculationId
  });
  
  const { erpValueMap, erpMappingInfoMap } = useErpValueMap(auditData?.contractId);
  
  const filteredLineItems = useMemo(() => {
    if (!auditData) return [];
    if (!ruleFilter) return auditData.lineItems;
    return auditData.lineItems.filter(item => item.ruleApplied === ruleFilter);
  }, [auditData, ruleFilter]);
  
  const handleExportPdf = () => {
    window.open(`/api/royalty-calculations/${calculationId}/invoice/detailed`, '_blank');
  };
  
  if (isLoading) {
    return (
      <MainLayout title="Loading Audit Trail..." description="">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }
  
  if (error || !auditData) {
    return (
      <MainLayout title="Audit Trail Error" description="">
        <Card>
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Could not load audit trail</h3>
            <p className="text-muted-foreground mb-6">
              The calculation audit trail could not be loaded. Please try again.
            </p>
            <Button onClick={() => setLocation("/calculations")}>
              Back to Calculations
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout 
      title="Calculation Audit Trail"
      description="End-to-end calculation verification for auditors"
    >
      <div className="space-y-6">
        <LicenseFeeCalculatorNav currentPage="audit-trail" contractId={auditData.contractId} />
        
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/calculations")}
            data-testid="button-back-calculations"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calculations
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setLocation(`/calculations/${calculationId}/report`)}
              data-testid="button-view-report"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Report
            </Button>
            <Button onClick={handleExportPdf} data-testid="button-export-pdf">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
        
        <AuditCertificationHeader auditData={auditData} />
        
        {auditData.ruleResults && auditData.ruleResults.length > 0 && (
          <RuleSummaryPanel 
            ruleResults={auditData.ruleResults} 
            totalFee={auditData.summary.totalLicenseFee}
            onRuleClick={(ruleName) => setRuleFilter(prev => prev === ruleName ? null : ruleName)}
            lineItems={auditData.lineItems}
          />
        )}
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Line-by-Line Calculation Breakdown
                </CardTitle>
                <CardDescription>
                  Each line item includes a unique reference ID, linked rule reference, and contract source section for end-to-end verification
                </CardDescription>
              </div>
              {ruleFilter && (
                <Button variant="outline" size="sm" onClick={() => setRuleFilter(null)} data-testid="button-clear-rule-filter">
                  <XCircle className="h-4 w-4 mr-1" />
                  Clear Filter: {ruleFilter}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="font-semibold w-32">Audit Ref</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="text-right font-semibold">Qty</TableHead>
                    <TableHead className="text-right font-semibold">Gross Amount</TableHead>
                    <TableHead className="font-semibold">Rule Applied</TableHead>
                    <TableHead className="font-semibold">Formula Source</TableHead>
                    <TableHead className="text-right font-semibold">Contract Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLineItems.map((item) => {
                    const auditRefId = generateAuditRefId(auditData.calculationId, item.lineNumber);
                    const matchingRule = auditData.rulesDefinitions.find(r => r.ruleName === item.ruleApplied);
                    
                    return (
                      <TableRow key={item.lineNumber} className="group" data-testid={`audit-row-${item.lineNumber}`}>
                        <TableCell className="font-mono text-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help">
                                {auditRefId}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Line #{item.lineNumber}</p>
                              <p className="text-xs text-muted-foreground">Sale ID: {item.saleId}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            <ErpValueDisplay 
                              value={item.productName || '-'} 
                              erpValueMap={erpValueMap}
                              erpMappingInfoMap={erpMappingInfoMap}
                              columnFieldName="product_name"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">${Number(item.grossAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.ruleApplied}</span>
                            {matchingRule?.isAiExtracted && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Bot className="h-3 w-3 text-orange-600" />
                                </TooltipTrigger>
                                <TooltipContent>AI-Extracted Rule</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <FormulaSourceBadge source={item.formulaSource} />
                            {item.formulaSource === 'rebate_tiered_quarterly_universal' && item.tierMode && (
                              <span
                                className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.tierMode === 'marginal'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-gray-50 text-gray-600'
                                }`}
                                data-testid={`badge-tier-mode-${item.lineNumber}`}
                              >
                                {item.tierMode === 'marginal' ? 'Marginal' : 'Whole-tier'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-green-600">${item.calculatedRoyalty.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Detailed Calculation Steps (Click to Expand)
              </h3>
              <div className="space-y-2">
                {filteredLineItems.map((item) => {
                  const auditRefId = generateAuditRefId(auditData.calculationId, item.lineNumber);
                  return (
                    <div key={item.lineNumber} className="border rounded-lg p-2">
                      <div className="flex items-center gap-3 text-sm mb-1">
                        <Badge variant="outline" className="font-mono text-xs">{auditRefId}</Badge>
                        <span className="font-medium">
                          <ErpValueDisplay value={item.productName} erpValueMap={erpValueMap} erpMappingInfoMap={erpMappingInfoMap} columnFieldName="product_name" />
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-muted-foreground">{item.ruleApplied}</span>
                      </div>
                      <FormulaVisualization 
                        item={item} 
                        auditRefId={auditRefId}
                        contractId={auditData.contractId}
                        rulesDefinitions={auditData.rulesDefinitions}
                      />
                      {item.qualifiersEvaluated && item.qualifiersEvaluated.length > 0 && (
                        <QualifierTrail qualifiers={item.qualifiersEvaluated} />
                      )}
                      {item.adjustmentSteps && item.adjustmentSteps.length > 1 && (
                        <AdjustmentWaterfall steps={item.adjustmentSteps} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rule Definitions Reference
            </CardTitle>
            <CardDescription>
              Complete rule definitions with links to contract source sections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditData.rulesDefinitions.map((rule) => {
                const ruleRefId = generateRuleRefId(rule.id);
                const usageCount = auditData.lineItems.filter(item => item.ruleApplied === rule.ruleName).length;
                
                return (
                  <div 
                    key={rule.id} 
                    id={`rule-${rule.id}`}
                    className="border rounded-lg p-4 space-y-3 transition-all"
                    data-testid={`rule-definition-${rule.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">{ruleRefId}</Badge>
                        <span className="font-semibold">{rule.ruleName}</span>
                        <Badge variant={rule.isAiExtracted ? "default" : "secondary"}>
                          {rule.isAiExtracted ? (
                            <><Bot className="h-3 w-3 mr-1" /> AI Extracted</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" /> Manual</>
                          )}
                        </Badge>
                        {rule.reviewStatus === 'confirmed' && (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary">
                        Used {usageCount}× in this calculation
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium">{rule.ruleType}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Base Rate:</span>
                        <span className="ml-2 font-mono">{rule.baseRate}%</span>
                      </div>
                      {rule.confidence && (
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="ml-2">{(rule.confidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                      {rule.reviewedAt && (
                        <div>
                          <span className="text-muted-foreground">Reviewed:</span>
                          <span className="ml-2">{format(new Date(rule.reviewedAt), 'MM/dd/yyyy')}</span>
                        </div>
                      )}
                    </div>
                    
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                    
                    <ContractSourceReference rule={rule} contractId={auditData.contractId} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-sm">Audit Trail Certification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Generated By:</span>
                <span className="ml-2 font-medium">{auditData.auditMetadata.generatedBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Generated At:</span>
                <span className="ml-2 font-medium">{format(new Date(auditData.auditMetadata.generatedAt), 'MM/dd/yyyy HH:mm:ss')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Format Version:</span>
                <span className="ml-2 font-mono">{auditData.auditMetadata.version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Format Type:</span>
                <span className="ml-2 font-medium">{auditData.auditMetadata.format}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
