import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Play, CheckCircle, XCircle, Clock, AlertTriangle, FileText, Layers, GitBranch,
  ArrowLeft, Loader2, Pencil, ThumbsUp, ThumbsDown, ExternalLink, Plus,
  RotateCcw, Eye, Zap, Shield, Settings2, Upload, ShieldCheck, CircleDot, AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const APPROVAL_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  pending:  { label: 'Pending Approval',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

function ApprovalStatusBadge({ status }: { status?: string }) {
  const cfg = APPROVAL_CONFIG[status || 'pending'] || APPROVAL_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`} data-testid={`badge-approval-${status || 'pending'}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

const STAGE_CONFIG = {
  A: { label: 'Stage A', title: 'Clause Segmentation', icon: FileText, color: 'blue' },
  B: { label: 'Stage B', title: 'Rule Template Mapping', icon: Layers, color: 'orange' },
  C: { label: 'Stage C', title: 'Conflict Detection', icon: GitBranch, color: 'green' },
};

const CATEGORY_LABELS: Record<string, string> = {
  financial_calculation: 'Financial Calculation',
  qualification: 'Qualification',
  adjustment: 'Adjustment',
  event_penalty: 'Event / Penalty',
  operational: 'Operational',
  governance_risk: 'Governance / Risk',
};

const TEMPLATE_LABELS: Record<string, string> = {
  T1: 'Percentage Revenue', T2: 'Per Unit', T3: 'Tiered Rate', T4: 'Threshold Trigger',
  T5: 'Revenue Split', T6: 'Fixed Amount', T7: 'Cap', T8: 'Floor / Min Payout',
  T9: 'Min Guarantee True-Up', T10: 'Offset / Deduction', T11: 'Late Payment Interest',
  T12: 'Reporting Penalty',
};

const EXEC_GROUP_LABELS: Record<string, { label: string; color: string }> = {
  periodic: { label: 'Periodic', color: 'bg-blue-100 text-blue-800' },
  adjustment: { label: 'Adjustment', color: 'bg-amber-100 text-amber-800' },
  event: { label: 'Event', color: 'bg-purple-100 text-purple-800' },
};



const CLAUSE_CATEGORIES = [
  { value: 'financial_calculation', label: 'Financial Calculation' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'event_penalty', label: 'Event / Penalty' },
  { value: 'operational', label: 'Operational' },
  { value: 'governance_risk', label: 'Governance / Risk' },
];

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; dotColor: string }> = {
  pending: { label: 'AI Extracted', color: 'bg-red-50 text-red-700 border-red-200', icon: CircleDot, dotColor: 'bg-red-500' },
  auto_confirmed: { label: 'AI Extracted', color: 'bg-red-50 text-red-700 border-red-200', icon: CircleDot, dotColor: 'bg-red-500' },
  under_review: { label: 'Under Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: AlertCircle, dotColor: 'bg-yellow-400' },
  verified: { label: 'Verified', color: 'bg-green-50 text-green-700 border-green-200', icon: ShieldCheck, dotColor: 'bg-green-500' },
  confirmed: { label: 'Verified', color: 'bg-green-50 text-green-700 border-green-200', icon: ShieldCheck, dotColor: 'bg-green-500' },
  rejected: { label: 'Rejected', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: XCircle, dotColor: 'bg-gray-400' },
};


function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Completed' },
    processing: { icon: Loader2, color: 'bg-blue-100 text-blue-800', label: 'Processing' },
    pending: { icon: Clock, color: 'bg-gray-100 text-gray-600', label: 'Pending' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Failed' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <Badge className={`${c.color} flex items-center gap-1`} variant="secondary">
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </Badge>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const c = REVIEW_STATUS_CONFIG[status] || REVIEW_STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <Badge className={`${c.color} flex items-center gap-1.5 border`} variant="outline">
      <div className={`w-2.5 h-2.5 rounded-full ${c.dotColor}`} />
      <Icon className="h-3 w-3" /> {c.label}
    </Badge>
  );
}


function StageProgressBar({ stageA, stageB, stageC }: { stageA: string; stageB: string; stageC: string }) {
  const stages = [
    { key: 'A', status: stageA, ...STAGE_CONFIG.A },
    { key: 'B', status: stageB, ...STAGE_CONFIG.B },
    { key: 'C', status: stageC, ...STAGE_CONFIG.C },
  ];
  return (
    <div className="flex items-center gap-2" data-testid="pipeline-progress">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        const isActive = stage.status === 'processing';
        const isDone = stage.status === 'completed';
        const isFailed = stage.status === 'failed';
        return (
          <div key={stage.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
              isActive ? 'border-orange-500 bg-orange-50' : isDone ? 'border-green-500 bg-green-50' :
              isFailed ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <Icon className={`h-4 w-4 ${isActive ? 'text-orange-600 animate-pulse' : isDone ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-gray-400'}`} />
              <div className="text-sm">
                <div className="font-medium">{stage.label}</div>
                <div className="text-xs text-muted-foreground">{stage.title}</div>
              </div>
              {isDone && <CheckCircle className="h-4 w-4 text-green-600" />}
              {isFailed && <XCircle className="h-4 w-4 text-red-600" />}
              {isActive && <Loader2 className="h-4 w-4 text-orange-600 animate-spin" />}
            </div>
            {i < 2 && <div className={`w-8 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function PipelineResults() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('clauses');
  const [clauseCategoryFilter, setClauseCategoryFilter] = useState<string>('all');
  const [clauseFlowFilter, setClauseFlowFilter] = useState<string>('all');
  const [clauseAccrualFilter, setClauseAccrualFilter] = useState<string>('all');
  const [rerunConfirmStage, setRerunConfirmStage] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const contractQuery = useQuery<any>({
    queryKey: ['/api/contracts', id],
    queryFn: () => fetch(`/api/contracts/${id}`, { credentials: 'include' }).then(r => r.json()),
  });

  const resultsQuery = useQuery<any>({
    queryKey: ['/api/contracts', id, 'pipeline', 'results'],
    queryFn: () => fetch(`/api/contracts/${id}/pipeline/results`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.latestRun?.status === 'processing') return 2000;
      return false;
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: async (stage?: string) => {
      const body = stage ? { stage } : {};
      const res = await apiRequest('POST', `/api/contracts/${id}/pipeline/run`, body);
      return res.json();
    },
    onSuccess: (_data, stage) => {
      toast({ title: 'Pipeline Started', description: stage ? `Re-running Stage ${stage}...` : '3-stage extraction pipeline is running...' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Pipeline Failed', description: error.message, variant: 'destructive' });
    },
  });

  const confirmRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest('PATCH', `/api/contract-rules/${ruleId}/review-status`, { reviewStatus: 'verified' });
    },
    onSuccess: () => {
      toast({ title: 'Rule Verified', description: 'The rule has been verified and confirmed.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Verify Failed', description: error.message, variant: 'destructive' });
    },
  });

  const rejectRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest('PATCH', `/api/contract-rules/${ruleId}/review-status`, { reviewStatus: 'rejected' });
    },
    onSuccess: () => {
      toast({ title: 'Rule Rejected', description: 'The rule has been rejected.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Reject Failed', description: error.message, variant: 'destructive' });
    },
  });

  const sendToReviewMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest('PATCH', `/api/contract-rules/${ruleId}/review-status`, { reviewStatus: 'under_review' });
    },
    onSuccess: () => {
      toast({ title: 'Sent to Review', description: 'The rule has been sent for review.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async (data: { reviewStatus: string }) => {
      return apiRequest('PATCH', `/api/contracts/${id}/rules/bulk-review-status`, data);
    },
    onSuccess: (_, variables) => {
      const label = variables.reviewStatus === 'verified' ? 'verified' : variables.reviewStatus === 'under_review' ? 'sent to review' : 'updated';
      toast({ title: `All rules ${label}` });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Bulk Update Failed', description: error.message, variant: 'destructive' });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ conflictId, action }: { conflictId: string; action: 'accept' | 'override' }) => {
      const res = await apiRequest('PATCH', `/api/contracts/${id}/conflicts/${conflictId}`, { status: action === 'accept' ? 'resolved' : 'overridden' });
      return res.json();
    },
    onSuccess: (_data, { action }) => {
      toast({ title: action === 'accept' ? 'Resolution Accepted' : 'Conflict Overridden', description: 'Conflict status updated.' });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id, 'pipeline', 'results'] });
    },
    onError: (error: any) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/contracts/${id}/replace-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to upload document');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Document Uploaded", description: `${data.fileName} has been attached. You can now run the pipeline.` });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const contract = contractQuery.data;
  const hasContractDocument = !!(contract?.rawText || contract?.raw_text);
  const results = resultsQuery.data;
  const latestRun = results?.latestRun;
  const isProcessing = latestRun?.status === 'processing';

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href={contract ? `/contracts/${id}` : '/contracts'}>
            <Button variant="ghost" size="sm" data-testid="btn-back"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Contract</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">3-Stage Processing Pipeline</h1>
            <p className="text-muted-foreground" data-testid="text-contract-name">{contract?.displayName || contract?.originalName || contract?.fileName || (contractQuery.isLoading ? 'Loading...' : 'Unknown Contract')}</p>
          </div>
          <Button onClick={() => runPipelineMutation.mutate()} disabled={isProcessing || runPipelineMutation.isPending || !hasContractDocument} data-testid="btn-run-pipeline" className="bg-orange-600 hover:bg-orange-700">
            {isProcessing || runPipelineMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : <><Play className="h-4 w-4 mr-2" /> Run Pipeline</>}
          </Button>
        </div>

        {latestRun && (
          <Card data-testid="card-pipeline-status">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Pipeline Status</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge status={latestRun.status} />
                  {latestRun.status === 'completed' && (
                    <div className="flex gap-1">
                      {(['A', 'B', 'C'] as const).map((stage) => (
                        <Button key={stage} variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => setRerunConfirmStage(stage)}
                          disabled={isProcessing || runPipelineMutation.isPending}
                          data-testid={`btn-rerun-stage-${stage}`}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Re-run {stage}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StageProgressBar stageA={latestRun.stageAStatus || 'pending'} stageB={latestRun.stageBStatus || 'pending'} stageC={latestRun.stageCStatus || 'pending'} />
              {rerunConfirmStage && (
                <div className="mt-3 p-3 border rounded-lg bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">Confirm Re-run Stage {rerunConfirmStage}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    This will re-process Stage {rerunConfirmStage} ({STAGE_CONFIG[rerunConfirmStage as keyof typeof STAGE_CONFIG]?.title}). Existing results for this stage will be replaced.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setRerunConfirmStage(null)} data-testid="btn-cancel-rerun">Cancel</Button>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => { runPipelineMutation.mutate(rerunConfirmStage); setRerunConfirmStage(null); }} data-testid="btn-confirm-rerun">
                      <RotateCcw className="h-3 w-3 mr-1" /> Confirm Re-run
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {results?.summary && latestRun?.status === 'completed' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-stat-clauses" className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'clauses' ? 'ring-2 ring-blue-400' : ''}`} onClick={() => setActiveTab('clauses')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-clause-count">{results.summary.totalClauses}</p>
                      <p className="text-sm text-muted-foreground">Clauses Extracted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-rules" className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'rules' ? 'ring-2 ring-orange-400' : ''}`} onClick={() => setActiveTab('rules')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg"><Layers className="h-5 w-5 text-orange-600" /></div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-rule-count">{results.summary.totalRules}</p>
                      <p className="text-sm text-muted-foreground">Rules Mapped</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-conflicts" className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'conflicts' ? 'ring-2 ring-amber-400' : ''}`} onClick={() => setActiveTab('conflicts')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-conflict-count">{results.summary.totalConflicts}</p>
                      <p className="text-sm text-muted-foreground">Conflicts Found</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>


            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="clauses" data-testid="tab-clauses"><FileText className="h-4 w-4 mr-1" /> Clauses ({results.summary.totalClauses})</TabsTrigger>
                <TabsTrigger value="rules" data-testid="tab-rules"><Layers className="h-4 w-4 mr-1" /> Rules ({results.summary.totalRules})</TabsTrigger>
                <TabsTrigger value="conflicts" data-testid="tab-conflicts"><AlertTriangle className="h-4 w-4 mr-1" /> Conflicts ({results.summary.totalConflicts})</TabsTrigger>
              </TabsList>

              <TabsContent value="clauses" className="space-y-3">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <Select value={clauseCategoryFilter} onValueChange={(v) => setClauseCategoryFilter(v)}>
                    <SelectTrigger className="w-[200px] h-8 text-xs" data-testid="filter-clause-category"><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CLAUSE_CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={clauseFlowFilter} onValueChange={(v) => setClauseFlowFilter(v)}>
                    <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="filter-clause-flow"><SelectValue placeholder="All Flow Types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Flow Types</SelectItem>
                      {[...new Set((results.clauses || []).map((c: any) => c.flowTypeCode).filter(Boolean))].map((ft: string) => (
                        <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={clauseAccrualFilter} onValueChange={(v) => setClauseAccrualFilter(v)}>
                    <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="filter-clause-accrual"><SelectValue placeholder="Accrual Impact" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Affects Accrual</SelectItem>
                      <SelectItem value="no">No Accrual Impact</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {(results.clauses || []).filter((c: any) => {
                      if (clauseCategoryFilter !== 'all' && c.clauseCategoryCode !== clauseCategoryFilter) return false;
                      if (clauseFlowFilter !== 'all' && c.flowTypeCode !== clauseFlowFilter) return false;
                      if (clauseAccrualFilter === 'yes' && !c.affectsAccrual) return false;
                      if (clauseAccrualFilter === 'no' && c.affectsAccrual) return false;
                      return true;
                    }).length} clauses
                  </span>
                </div>
                {(() => {
                  const filtered = (results.clauses || []).filter((c: any) => {
                    if (clauseCategoryFilter !== 'all' && c.clauseCategoryCode !== clauseCategoryFilter) return false;
                    if (clauseFlowFilter !== 'all' && c.flowTypeCode !== clauseFlowFilter) return false;
                    if (clauseAccrualFilter === 'yes' && !c.affectsAccrual) return false;
                    if (clauseAccrualFilter === 'no' && c.affectsAccrual) return false;
                    return true;
                  }) || [];
                  const grouped: Record<string, any[]> = {};
                  filtered.forEach((c: any) => {
                    const cat = c.clauseCategoryCode || 'uncategorized';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(c);
                  });
                  const categories = Object.keys(grouped).sort();
                  if (categories.length === 0) return <p className="text-muted-foreground text-center py-8">No clauses extracted yet. Run the pipeline to start.</p>;
                  return categories.map(cat => (
                    <div key={cat} className="space-y-2" data-testid={`clause-group-${cat}`}>
                      <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                        <Badge className="bg-blue-100 text-blue-800" variant="secondary">{CATEGORY_LABELS[cat] || cat}</Badge>
                        <span className="text-xs text-muted-foreground">{grouped[cat].length} clauses</span>
                      </div>
                      {grouped[cat].map((clause: any) => (
                        <Card key={clause.id} data-testid={`card-clause-${clause.clauseIdentifier}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono">{clause.clauseIdentifier}</Badge>
                                  {clause.flowTypeCode && clause.flowTypeCode !== 'other' && <Badge className="bg-purple-100 text-purple-800" variant="secondary">{clause.flowTypeCode}</Badge>}
                                  {clause.affectsAccrual && <Badge className="bg-orange-100 text-orange-800" variant="secondary"><Zap className="h-3 w-3 mr-1" /> Affects Accrual</Badge>}
                                </div>
                                {clause.sectionRef && <p className="text-xs text-muted-foreground mb-1">{clause.sectionRef}</p>}
                                <div className={`text-sm ${expandedClause === clause.id ? '' : 'line-clamp-2'} cursor-pointer`} onClick={() => setExpandedClause(expandedClause === clause.id ? null : clause.id)} data-testid={`text-clause-body-${clause.clauseIdentifier}`}>{clause.text}</div>
                                {clause.text?.length > 150 && <button className="text-xs text-orange-600 mt-1" onClick={() => setExpandedClause(expandedClause === clause.id ? null : clause.id)}>{expandedClause === clause.id ? 'Show less' : 'Show more'}</button>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ));
                })()}
              </TabsContent>

              <TabsContent value="rules" className="space-y-3">
                {(() => {
                  const rulesList = results.rules || [];
                  const verifiedCount = rulesList.filter((r: any) => r.reviewStatus === 'verified' || r.reviewStatus === 'confirmed').length;
                  const underReviewCount = rulesList.filter((r: any) => r.reviewStatus === 'under_review').length;
                  const pendingCount = rulesList.filter((r: any) => !r.reviewStatus || r.reviewStatus === 'pending' || r.reviewStatus === 'auto_confirmed').length;
                  const rejectedCount = rulesList.filter((r: any) => r.reviewStatus === 'rejected').length;
                  const verificationProgress = rulesList.length > 0 ? Math.round((verifiedCount / rulesList.length) * 100) : 0;

                  return rulesList.length > 0 ? (
                    <>
                      <div className="space-y-2 p-4 bg-white dark:bg-gray-900 rounded-lg border" data-testid="pipeline-verification-progress">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Verification Progress</span>
                            <span className="text-xs text-muted-foreground">{verifiedCount} of {rulesList.length} rules verified</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/contracts/${id}/manage?tab=rules&addRule=true`}>
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-700" data-testid="button-add-rule-pipeline"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
                            </Link>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={verificationProgress} className="h-2 flex-1" />
                          <span className="text-sm font-semibold min-w-[40px] text-right">{verificationProgress}%</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span> AI Extracted: {pendingCount}</span>
                          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Under Review: {underReviewCount}</span>
                          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> Verified: {verifiedCount}</span>
                          {rejectedCount > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span> Rejected: {rejectedCount}</span>}
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}
                {(results.rules || []).map((rule: any) => {
                  const statusKey = rule.reviewStatus || 'pending';
                  const tlConfig = REVIEW_STATUS_CONFIG[statusKey] || REVIEW_STATUS_CONFIG.pending;
                  return (
                  <Card key={rule.id} data-testid={`card-rule-${rule.id}`} className={
                    `overflow-hidden ${statusKey === 'verified' || statusKey === 'confirmed' ? 'border-green-200' : statusKey === 'rejected' ? 'border-gray-200' : statusKey === 'under_review' ? 'border-yellow-200' : ''}`
                  }>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`w-3.5 h-3.5 rounded-full ${tlConfig.dotColor} shadow-sm ring-2 ring-white dark:ring-gray-800 shrink-0`} />
                                </TooltipTrigger>
                                <TooltipContent><p>{tlConfig.label}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <h3 className="font-semibold" data-testid={`text-rule-name-${rule.id}`}>{rule.ruleName}</h3>
                            {rule.templateCode && <Badge className="bg-orange-100 text-orange-800 font-mono" variant="secondary">{rule.templateCode}: {TEMPLATE_LABELS[rule.templateCode] || rule.templateCode}</Badge>}
                            {rule.executionGroup && EXEC_GROUP_LABELS[rule.executionGroup] && <Badge className={EXEC_GROUP_LABELS[rule.executionGroup].color} variant="secondary">{EXEC_GROUP_LABELS[rule.executionGroup].label}</Badge>}
                            <ReviewStatusBadge status={statusKey} />
                            <ApprovalStatusBadge status={(rule as any).approvalStatus} />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                          {(() => {
                            const fieldConf = rule.fieldConfidence || {};
                            const getFieldClass = (field: string) => {
                              const c = fieldConf[field];
                              if (c == null) return 'bg-red-50 border border-red-200 rounded px-1';
                              if (c < 0.5) return 'bg-red-50 border border-red-200 rounded px-1';
                              if (c < 0.8) return 'bg-amber-50 border border-amber-200 rounded px-1';
                              return '';
                            };
                            const fields = [
                              rule.baseRate && { key: 'baseRate', label: 'Rate', value: parseFloat(rule.baseRate) < 1 ? `${parseFloat(rule.baseRate) * 100}%` : rule.baseRate },
                              rule.baseMetric && { key: 'baseMetric', label: 'Base Metric', value: rule.baseMetric },
                              rule.minimumGuarantee && { key: 'minimumGuarantee', label: 'Min Guarantee', value: `$${parseFloat(rule.minimumGuarantee).toLocaleString()}` },
                              rule.territories?.length > 0 && { key: 'territories', label: 'Territories', value: rule.territories.join(', ') },
                              ['tiered', 'rebate_tiered', 'tiered_pricing', 'royalty', 'milestone_tiered'].includes(rule.ruleType)
                                && (rule as any).formulaDefinition?.tierMode
                                && { key: 'tierMode', label: 'Tier Mode', value: (rule as any).formulaDefinition.tierMode === 'marginal' ? 'Marginal' : 'Whole-tier' },
                            ].filter(Boolean) as { key: string; label: string; value: string }[];
                            const missingFields = ['baseRate', 'baseMetric'].filter(f => !rule[f] && !fieldConf[f]);
                            return (
                              <div className="space-y-1">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  {fields.map(f => (
                                    <div key={f.key} className={getFieldClass(f.key)} data-testid={`field-${f.key}-${rule.id}`}>
                                      <span className="text-muted-foreground">{f.label}:</span>{' '}
                                      <span className="font-medium">{f.value}</span>
                                      {fieldConf[f.key] != null && fieldConf[f.key] < 0.5 && <span className="text-red-500 ml-1 text-[10px]">low confidence</span>}
                                    </div>
                                  ))}
                                </div>
                                {missingFields.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {missingFields.map(f => (
                                      <Badge key={f} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200" data-testid={`missing-field-${f}-${rule.id}`}>
                                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {f} missing
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {rule.volumeTiers && Array.isArray(rule.volumeTiers) && rule.volumeTiers.length > 0 && (
                            <div className="mt-3 border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Tier</th>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Volume Range</th>
                                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rule.volumeTiers.map((tier: any, i: number) => (
                                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                      <td className="px-4 py-2 text-xs font-medium text-gray-700">Tier {i + 1}</td>
                                      <td className="px-4 py-2 text-xs text-gray-600">
                                        {tier.min !== undefined
                                          ? `${Number(tier.min).toLocaleString()} – ${tier.max ? Number(tier.max).toLocaleString() : '∞'} units`
                                          : 'All volumes'}
                                      </td>
                                      <td className="px-4 py-2 text-xs font-semibold text-right text-orange-700">
                                        {tier.rate ? `${(Number(tier.rate) * 100).toFixed(0)}%` : tier.percentage ? `${tier.percentage}%` : JSON.stringify(tier)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Link href={`/contracts/${id}/manage?tab=rules&editRule=${rule.id}`}>
                            <Button variant="outline" size="sm" data-testid={`btn-edit-rule-${rule.id}`}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit Rule <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                          {/* Approve / Verify actions consolidated on Manage Contract → Rules tab. Use "Edit Rule" above to navigate there. */}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                {(!results.rules || results.rules.length === 0) && (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-muted-foreground">No rules mapped yet. Run the pipeline or add rules manually.</p>
                    <Link href={`/contracts/${id}/manage?tab=rules&addRule=true`}>
                      <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-add-rule-empty"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="conflicts" className="space-y-3">
                {results.conflicts?.map((conflict: any) => (
                  <Card key={conflict.id} className="border-amber-200" data-testid={`card-conflict-${conflict.conflictIdentifier}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-amber-700 border-amber-300">{conflict.conflictIdentifier}</Badge>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            {conflict.status === 'resolved' && <Badge className="bg-green-100 text-green-800" variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>}
                            {conflict.status === 'overridden' && <Badge className="bg-blue-100 text-blue-800" variant="secondary">Overridden</Badge>}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Conflicting Rules:</p>
                              <div className="flex gap-1 flex-wrap mt-1">{(conflict.ruleIds || []).map((name: string, i: number) => <Badge key={i} variant="secondary">{name}</Badge>)}</div>
                            </div>
                            <div><p className="text-xs text-muted-foreground">Reason:</p><p className="text-sm">{conflict.reason}</p></div>
                            {conflict.resolution && <div><p className="text-xs text-muted-foreground">Suggested Resolution:</p><p className="text-sm text-green-700">{conflict.resolution}</p></div>}
                          </div>
                        </div>
                        {(!conflict.status || conflict.status === 'open') && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50 text-xs h-7"
                              data-testid={`btn-accept-resolution-${conflict.id}`}
                              disabled={resolveConflictMutation.isPending}
                              onClick={() => resolveConflictMutation.mutate({ conflictId: conflict.id, action: 'accept' })}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-50 text-xs h-7"
                              data-testid={`btn-override-conflict-${conflict.id}`}
                              disabled={resolveConflictMutation.isPending}
                              onClick={() => resolveConflictMutation.mutate({ conflictId: conflict.id, action: 'override' })}>
                              <Settings2 className="h-3 w-3 mr-1" /> Override
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!results.conflicts || results.conflicts.length === 0) && (
                  <div className="text-center py-8">
                    <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No conflicts detected. All rules are consistent.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {!latestRun && !resultsQuery.isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              {!hasContractDocument ? (
                <>
                  <AlertTriangle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Contract Document Available</h2>
                  <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
                    The 3-stage pipeline requires a contract document to analyze. This contract was created manually without uploading a document.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
                    Upload a contract document (PDF) to this contract, then run the pipeline to extract clauses and rules.
                  </p>
                  <input
                    type="file"
                    ref={uploadInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    data-testid="input-upload-document"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocumentMutation.mutate(file);
                    }}
                  />
                  <div className="flex items-center justify-center gap-3">
                    <Link href={`/contracts/${id}/manage`}>
                      <Button variant="outline" data-testid="btn-back-to-contract">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contract
                      </Button>
                    </Link>
                    <Button
                      className="bg-orange-600 hover:bg-orange-700"
                      data-testid="btn-upload-document"
                      disabled={uploadDocumentMutation.isPending}
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      {uploadDocumentMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Upload Document</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Layers className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Pipeline Results Yet</h2>
                  <p className="text-muted-foreground mb-4">Run the 3-stage pipeline to extract clauses, map rules to templates, and detect conflicts.</p>
                  <Button onClick={() => runPipelineMutation.mutate()} disabled={runPipelineMutation.isPending} data-testid="btn-run-pipeline-empty" className="bg-orange-600 hover:bg-orange-700"><Play className="h-4 w-4 mr-2" /> Run Pipeline</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {resultsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
