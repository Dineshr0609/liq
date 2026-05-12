import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  PlayCircle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  FileText,
  Loader2,
  Database,
  Layers,
  Eye,
  GitCompare,
  Table2,
  ChevronDown,
  ChevronRight,
  Upload,
  Plus,
  Trash2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TestCase {
  id: number;
  name: string;
  contract_type: string;
  description: string;
  source?: string;
  created_at: string;
}

interface TestRun {
  id: number;
  extraction_mode: string;
  started_at: string;
  completed_at: string;
  status: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  overall_accuracy: number;
}

interface DashboardMetrics {
  totalTestCases: number;
  contractTypes: string[];
  latestRun: {
    id: number;
    date: string;
    accuracy: number;
    passed: number;
    failed: number;
    mode: string;
  } | null;
  accuracyTrend: Array<{
    date: string;
    accuracy: number;
    mode: string;
  }>;
  metrics: any;
}

interface TestSuiteStats {
  totalTestCases: number;
  byContractType: Record<string, number>;
  totalGroundTruthFields: number;
  lastRunDate: string | null;
  lastPassRate: number | null;
}

interface GroundTruthField {
  fieldName: string;
  expectedValue: string;
  fieldType: 'string' | 'number' | 'date' | 'boolean';
  isRequired: boolean;
}

interface NewTestCaseForm {
  name: string;
  contractType: string;
  description: string;
  contractText: string;
  source: 'pdf_upload' | 'manual';
  groundTruth: GroundTruthField[];
}

const initialFormState: NewTestCaseForm = {
  name: '',
  contractType: 'royalty_license',
  description: '',
  contractText: '',
  source: 'manual',
  groundTruth: []
};

export default function AccuracyDashboard() {
  const { toast } = useToast();
  const [extractionMode, setExtractionMode] = useState<'rag' | 'legacy'>('rag');
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [layoutAnalysis, setLayoutAnalysis] = useState<any>(null);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState<number | null>(null);
  const [expandedTestCaseData, setExpandedTestCaseData] = useState<any>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newTestCase, setNewTestCase] = useState<NewTestCaseForm>(initialFormState);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/accuracy/dashboard']
  });

  const { data: testCases, isLoading: testCasesLoading } = useQuery<TestCase[]>({
    queryKey: ['/api/accuracy/test-cases']
  });

  const toggleTestCaseExpansion = async (id: number) => {
    if (expandedTestCaseId === id) {
      setExpandedTestCaseId(null);
      setExpandedTestCaseData(null);
      return;
    }
    
    try {
      const response = await fetch(`/api/accuracy/test-cases/${id}`);
      if (!response.ok) throw new Error('Failed to fetch test case');
      const data = await response.json();
      setExpandedTestCaseId(id);
      setExpandedTestCaseData(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const { data: testRuns, isLoading: runsLoading } = useQuery<TestRun[]>({
    queryKey: ['/api/accuracy/runs']
  });

  const { data: runDetails } = useQuery({
    queryKey: ['/api/accuracy/runs', selectedRunId],
    enabled: !!selectedRunId
  });

  const { data: testSuiteStats } = useQuery<TestSuiteStats>({
    queryKey: ['/api/accuracy/test-suite-stats']
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/accuracy/seed');
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Sample test cases seeded successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const runSuiteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/accuracy/run-suite', { mode: extractionMode });
      return response.json();
    },
    onSuccess: (data: any) => {
      const accuracy = data?.metrics?.overallAccuracy ?? 0;
      const passed = data?.metrics?.passed ?? 0;
      const total = data?.metrics?.totalTests ?? 0;
      toast({ 
        title: 'Test Suite Complete', 
        description: `Accuracy: ${(accuracy * 100).toFixed(1)}% (${passed}/${total} passed)`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const runSingleMutation = useMutation({
    mutationFn: async (testCaseId: number) => {
      const response = await apiRequest('POST', `/api/accuracy/test-cases/${testCaseId}/run`, { mode: extractionMode });
      return response.json();
    },
    onSuccess: (data: any) => {
      const passed = data?.passed ?? false;
      const accuracy = data?.overallAccuracy ?? 0;
      const status = passed ? 'passed' : 'failed';
      toast({ 
        title: `Test ${status}`, 
        description: `Accuracy: ${(accuracy * 100).toFixed(1)}%`,
        variant: passed ? 'default' : 'destructive'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const seedComprehensiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/accuracy/seed-test-suite');
      return response.json();
    },
    onSuccess: (data: any) => {
      const added = data?.added ?? 0;
      const existing = data?.existing ?? 0;
      toast({ 
        title: 'Test Suite Loaded', 
        description: `${added} new contracts added, ${existing} already existed`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const runEnsembleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/accuracy/run-ensemble-tests');
      return response.json();
    },
    onSuccess: (data: any) => {
      const avgAccuracy = data?.averageAccuracy ?? 0;
      const avgAgreement = data?.averageAgreementScore ?? 0;
      toast({ 
        title: 'Ensemble Tests Complete', 
        description: `Avg Accuracy: ${(avgAccuracy * 100).toFixed(1)}%, Agreement: ${(avgAgreement * 100).toFixed(1)}%`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const runSingleEnsembleMutation = useMutation({
    mutationFn: async (testCaseId: number) => {
      const response = await apiRequest('POST', `/api/accuracy/test-cases/${testCaseId}/ensemble`, { numPasses: 3 });
      return response.json();
    },
    onSuccess: (data: any) => {
      const passed = data?.testResult?.passed ?? false;
      const accuracy = data?.testResult?.overallAccuracy ?? 0;
      const agreement = data?.ensembleResult?.agreementScore ?? 0;
      const needsReview = data?.ensembleResult?.needsHumanReview ?? false;
      const status = passed ? 'passed' : 'failed';
      toast({ 
        title: `Ensemble Test ${status}`, 
        description: `Accuracy: ${(accuracy * 100).toFixed(1)}%, Agreement: ${(agreement * 100).toFixed(1)}%${needsReview ? ' - Needs Review' : ''}`,
        variant: passed ? 'default' : 'destructive'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const createTestCaseMutation = useMutation({
    mutationFn: async (data: NewTestCaseForm) => {
      const payload = {
        ...data,
        groundTruth: data.groundTruth.map(f => ({
          ...f,
          expectedValue: f.fieldType === 'number' ? parseFloat(f.expectedValue) : 
                         f.fieldType === 'boolean' ? f.expectedValue === 'true' : f.expectedValue,
          isRequired: f.isRequired
        }))
      };
      return apiRequest('POST', '/api/accuracy/test-cases', payload);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Test case created successfully!' });
      setShowUploadDialog(false);
      setNewTestCase(initialFormState);
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/test-cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accuracy/dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const addGroundTruthField = () => {
    setNewTestCase(prev => ({
      ...prev,
      groundTruth: [...prev.groundTruth, { fieldName: '', expectedValue: '', fieldType: 'number', isRequired: true }]
    }));
  };

  const updateGroundTruthField = (index: number, field: Partial<GroundTruthField>) => {
    setNewTestCase(prev => ({
      ...prev,
      groundTruth: prev.groundTruth.map((f, i) => i === index ? { ...f, ...field } : f)
    }));
  };

  const removeGroundTruthField = (index: number) => {
    setNewTestCase(prev => ({
      ...prev,
      groundTruth: prev.groundTruth.filter((_, i) => i !== index)
    }));
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'pdf_upload':
        return <Badge variant="default" className="bg-orange-700 text-xs">PDF</Badge>;
      case 'manual':
        return <Badge variant="secondary" className="text-xs">Manual</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Synthetic</Badge>;
    }
  };

  const filteredTestCases = testCases?.filter(tc => 
    sourceFilter === 'all' || (tc.source || 'synthetic') === sourceFilter
  ) || [];

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return 'text-green-600';
    if (accuracy >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 0.9) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (accuracy >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800">Needs Improvement</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Accuracy Testing Dashboard</h1>
          <p className="text-muted-foreground">Monitor and validate extraction accuracy with ground truth testing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={extractionMode} onValueChange={(v) => setExtractionMode(v as 'rag' | 'legacy')}>
            <SelectTrigger className="w-40" data-testid="select-extraction-mode">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rag">RAG Mode</SelectItem>
              <SelectItem value="legacy">Legacy Mode</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={() => seedComprehensiveMutation.mutate()} 
            disabled={seedComprehensiveMutation.isPending}
            data-testid="button-seed-suite"
          >
            {seedComprehensiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Load 20+ Test Contracts
          </Button>
          <Button 
            onClick={() => runSuiteMutation.mutate()} 
            disabled={runSuiteMutation.isPending || !testCases?.length}
            data-testid="button-run-suite"
          >
            {runSuiteMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Run Suite
          </Button>
          <Button 
            variant="secondary"
            onClick={() => runEnsembleMutation.mutate()} 
            disabled={runEnsembleMutation.isPending || !testCases?.length}
            data-testid="button-run-ensemble"
          >
            {runEnsembleMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GitCompare className="h-4 w-4 mr-2" />
            )}
            Ensemble Validation
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <span className="text-2xl font-bold" data-testid="text-test-case-count">
                {dashboardLoading ? '...' : dashboard?.totalTestCases || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard?.contractTypes?.length || 0} contract types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Latest Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${dashboard?.latestRun ? getAccuracyColor(dashboard.latestRun.accuracy) : 'text-gray-400'}`} />
              <span className={`text-2xl font-bold ${dashboard?.latestRun ? getAccuracyColor(dashboard.latestRun.accuracy) : ''}`} data-testid="text-latest-accuracy">
                {dashboard?.latestRun ? `${(dashboard.latestRun.accuracy * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            {dashboard?.latestRun && (
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard.latestRun.passed}/{dashboard.latestRun.passed + dashboard.latestRun.failed} passed
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold" data-testid="text-pass-rate">
                {dashboard?.latestRun 
                  ? `${dashboard.latestRun.passed}/${dashboard.latestRun.passed + dashboard.latestRun.failed}`
                  : 'N/A'
                }
              </span>
            </div>
            {dashboard?.latestRun && (
              <Progress 
                value={(dashboard.latestRun.passed / (dashboard.latestRun.passed + dashboard.latestRun.failed)) * 100} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium" data-testid="text-last-run">
                {dashboard?.latestRun?.date 
                  ? new Date(dashboard.latestRun.date).toLocaleDateString()
                  : 'Never'
                }
              </span>
            </div>
            {dashboard?.latestRun && (
              <Badge variant="outline" className="mt-2">
                {dashboard.latestRun.mode.toUpperCase()} mode
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="test-cases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test-cases" data-testid="tab-test-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">Test Runs</TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Detailed Metrics</TabsTrigger>
          <TabsTrigger value="suite-stats" data-testid="tab-suite-stats">Suite Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="test-cases" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ground Truth Test Cases</CardTitle>
                <CardDescription>Contracts with verified correct extractions for accuracy measurement</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-32" data-testid="select-source-filter">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="synthetic">Synthetic</SelectItem>
                    <SelectItem value="pdf_upload">PDF Upload</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="default" 
                  onClick={() => setShowUploadDialog(true)}
                  data-testid="button-add-test-case"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Test Case
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  data-testid="button-seed-test-cases"
                >
                  {seedMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Seed Sample
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {testCasesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !filteredTestCases?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No test cases found. Click "Seed Sample" to add initial test data or "Add Test Case" to create one.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Contract Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTestCases.map((tc) => (
                      <>
                        <TableRow 
                          key={tc.id} 
                          data-testid={`row-test-case-${tc.id}`}
                          className={expandedTestCaseId === tc.id ? 'bg-muted/50' : ''}
                        >
                          <TableCell className="font-medium">
                            <button 
                              onClick={() => toggleTestCaseExpansion(tc.id)}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              {expandedTestCaseId === tc.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {tc.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            {getSourceBadge(tc.source)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{tc.contract_type}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {tc.description}
                          </TableCell>
                          <TableCell>{new Date(tc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => runSingleMutation.mutate(tc.id)}
                                disabled={runSingleMutation.isPending}
                                data-testid={`button-run-test-${tc.id}`}
                                title="Run single test"
                              >
                                {runSingleMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <PlayCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => runSingleEnsembleMutation.mutate(tc.id)}
                                disabled={runSingleEnsembleMutation.isPending}
                                data-testid={`button-ensemble-test-${tc.id}`}
                                title="Run ensemble validation (3 passes)"
                              >
                                {runSingleEnsembleMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <GitCompare className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Inline Expansion */}
                        {expandedTestCaseId === tc.id && expandedTestCaseData && (
                          <TableRow key={`${tc.id}-expanded`}>
                            <TableCell colSpan={6} className="bg-muted/30 p-4">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                                    <FileText className="h-4 w-4" />
                                    Contract Text
                                  </h4>
                                  <pre className="bg-background border p-4 rounded-lg text-xs whitespace-pre-wrap font-mono max-h-60 overflow-auto">
                                    {expandedTestCaseData.contract_text}
                                  </pre>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Ground Truth (Expected Values)
                                  </h4>
                                  <div className="bg-background border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Field Name</TableHead>
                                          <TableHead className="text-xs">Expected Value</TableHead>
                                          <TableHead className="text-xs">Type</TableHead>
                                          <TableHead className="text-xs">Required</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(Array.isArray(expandedTestCaseData.ground_truth) ? expandedTestCaseData.ground_truth : []).map((field: any, idx: number) => (
                                          <TableRow key={idx}>
                                            <TableCell className="font-mono text-xs py-2">{field.fieldName}</TableCell>
                                            <TableCell className="font-mono text-xs py-2 max-w-xs">
                                              <pre className="whitespace-pre-wrap text-xs">
                                                {typeof field.expectedValue === 'object' 
                                                  ? JSON.stringify(field.expectedValue, null, 2)
                                                  : String(field.expectedValue)}
                                              </pre>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              <Badge variant="secondary" className="text-xs">{field.fieldType}</Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {field.isRequired ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Run History</CardTitle>
              <CardDescription>Historical accuracy test results</CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !testRuns?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No test runs yet. Run the test suite to see results here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tests</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testRuns.map((run) => (
                      <TableRow key={run.id} data-testid={`row-test-run-${run.id}`}>
                        <TableCell className="font-mono">#{run.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{run.extraction_mode?.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          {run.status === 'completed' ? (
                            <Badge className="bg-green-100 text-green-800">Completed</Badge>
                          ) : run.status === 'running' ? (
                            <Badge className="bg-orange-100 text-orange-900">Running</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">{run.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{run.total_tests}</TableCell>
                        <TableCell>
                          <span className="text-green-600">{run.passed_tests}</span>
                          {' / '}
                          <span className="text-red-600">{run.failed_tests}</span>
                        </TableCell>
                        <TableCell>
                          <span className={getAccuracyColor(run.overall_accuracy || 0)}>
                            {run.overall_accuracy ? `${(run.overall_accuracy * 100).toFixed(1)}%` : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedRunId(run.id)}
                            data-testid={`button-view-run-${run.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Accuracy by Contract Type</CardTitle>
                <CardDescription>Performance breakdown by contract category</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.metrics?.byContractType ? (
                  <div className="space-y-4">
                    {Object.entries(dashboard.metrics.byContractType).map(([type, data]: [string, any]) => (
                      <div key={type} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                          <span className={getAccuracyColor(data.accuracy)}>
                            {(data.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={data.accuracy * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground">{data.count} test(s)</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Run the test suite to see metrics
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accuracy Trend</CardTitle>
                <CardDescription>Historical accuracy over recent runs</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.accuracyTrend?.length ? (
                  <div className="space-y-2">
                    {dashboard.accuracyTrend.slice(-5).map((point, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm text-muted-foreground">
                          {point.date ? new Date(point.date).toLocaleDateString() : 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{point.mode}</Badge>
                          <span className={`font-bold ${getAccuracyColor(point.accuracy)}`}>
                            {(point.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No historical data available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmarks</CardTitle>
              <CardDescription>How LicenseIQ compares to industry standards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Target Accuracy</p>
                  <p className="text-3xl font-bold text-violet-600">94%+</p>
                  <p className="text-xs text-muted-foreground mt-1">Industry Standard</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Current Accuracy</p>
                  <p className={`text-3xl font-bold ${dashboard?.latestRun ? getAccuracyColor(dashboard.latestRun.accuracy) : 'text-gray-400'}`}>
                    {dashboard?.latestRun ? `${(dashboard.latestRun.accuracy * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Latest Run</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Status</p>
                  <div className="mt-2">
                    {dashboard?.latestRun ? getAccuracyBadge(dashboard.latestRun.accuracy) : <Badge variant="outline">No Data</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {dashboard?.latestRun && dashboard.latestRun.accuracy >= 0.94 
                      ? 'Meeting industry standard!' 
                      : 'Improvement needed'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suite-stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Test Suite Overview
                </CardTitle>
                <CardDescription>Contract Intelligence Test Suite statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm font-medium">Total Test Contracts</span>
                    <span className="text-2xl font-bold text-orange-700" data-testid="text-total-contracts">
                      {testSuiteStats?.totalTestCases || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm font-medium">Ground Truth Fields</span>
                    <span className="text-2xl font-bold text-violet-600" data-testid="text-ground-truth-fields">
                      {testSuiteStats?.totalGroundTruthFields || 0}
                    </span>
                  </div>
                  {testSuiteStats?.lastRunDate && (
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Last Test Run</span>
                      <div className="text-right">
                        <span className="text-sm">{new Date(testSuiteStats.lastRunDate).toLocaleDateString()}</span>
                        {testSuiteStats.lastPassRate !== null && (
                          <Badge className="ml-2" variant={testSuiteStats.lastPassRate >= 0.8 ? "default" : "destructive"}>
                            {(testSuiteStats.lastPassRate * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Contract Types Coverage
                </CardTitle>
                <CardDescription>Distribution of test contracts by type</CardDescription>
              </CardHeader>
              <CardContent>
                {testSuiteStats?.byContractType && Object.keys(testSuiteStats.byContractType).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(testSuiteStats.byContractType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 border rounded">
                        <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No test cases loaded. Click "Load 20+ Test Contracts" to populate.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                Layout Detection Capabilities
              </CardTitle>
              <CardDescription>Document structure analysis features for better extraction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
                  <Table2 className="h-8 w-8 mx-auto mb-2 text-orange-700" />
                  <p className="font-semibold">Table Detection</p>
                  <p className="text-xs text-muted-foreground mt-1">Markdown and ASCII tables</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-violet-50 dark:bg-violet-950">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-violet-600" />
                  <p className="font-semibold">Section Headers</p>
                  <p className="text-xs text-muted-foreground mt-1">Articles, schedules, exhibits</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">Smart Chunking</p>
                  <p className="text-xs text-muted-foreground mt-1">Preserves table integrity</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
                  <GitCompare className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <p className="font-semibold">Ensemble Validation</p>
                  <p className="text-xs text-muted-foreground mt-1">Multi-pass consensus</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>How it works:</strong> The layout-aware chunking service analyzes contract documents to detect 
                  tables, headers, and section boundaries. This ensures that pricing tables are never split across chunks, 
                  improving AI extraction accuracy. The ensemble validation runs 2-3 extraction passes and compares 
                  results to identify discrepancies that need human review.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showUploadDialog && (
        <Card className="mt-4 border-2 border-orange-300/50 bg-orange-50/50 dark:bg-orange-950/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Add New Test Case
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowUploadDialog(false)} data-testid="button-close-upload">✕</Button>
            </div>
            <CardDescription>
              Create a test case with contract text and expected values for accuracy testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Test Case Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Manufacturing Fee Agreement"
                    value={newTestCase.name}
                    onChange={(e) => setNewTestCase(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-test-case-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractType">Contract Type</Label>
                  <Select 
                    value={newTestCase.contractType} 
                    onValueChange={(v) => setNewTestCase(prev => ({ ...prev, contractType: v }))}
                  >
                    <SelectTrigger data-testid="select-contract-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="royalty_license">Royalty/License</SelectItem>
                      <SelectItem value="distributor_reseller">Distributor/Reseller</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="rebate_mdf">Rebate/MDF</SelectItem>
                      <SelectItem value="revenue_share">Revenue Share</SelectItem>
                      <SelectItem value="usage_based">Usage Based</SelectItem>
                      <SelectItem value="chargebacks">Chargebacks</SelectItem>
                      <SelectItem value="marketplace">Marketplace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select 
                    value={newTestCase.source} 
                    onValueChange={(v: 'pdf_upload' | 'manual') => setNewTestCase(prev => ({ ...prev, source: v }))}
                  >
                    <SelectTrigger data-testid="select-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf_upload">PDF Upload</SelectItem>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the test case"
                    value={newTestCase.description}
                    onChange={(e) => setNewTestCase(prev => ({ ...prev, description: e.target.value }))}
                    data-testid="input-description"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractText">Contract Text</Label>
                <Textarea
                  id="contractText"
                  placeholder="Paste or type the contract text here..."
                  className="min-h-[200px] font-mono text-sm"
                  value={newTestCase.contractText}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, contractText: e.target.value }))}
                  data-testid="textarea-contract-text"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Ground Truth Fields (Expected Values)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addGroundTruthField} data-testid="button-add-field">
                    <Plus className="h-4 w-4 mr-1" /> Add Field
                  </Button>
                </div>
                
                {newTestCase.groundTruth.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="text-sm">No ground truth fields defined yet.</p>
                    <p className="text-xs">Click "Add Field" to define expected extraction values.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newTestCase.groundTruth.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                        <Input
                          placeholder="Field name (e.g., royaltyRate)"
                          value={field.fieldName}
                          onChange={(e) => updateGroundTruthField(idx, { fieldName: e.target.value })}
                          className="flex-1"
                          data-testid={`input-field-name-${idx}`}
                        />
                        <Input
                          placeholder="Expected value"
                          value={field.expectedValue}
                          onChange={(e) => updateGroundTruthField(idx, { expectedValue: e.target.value })}
                          className="flex-1"
                          data-testid={`input-expected-value-${idx}`}
                        />
                        <Select 
                          value={field.fieldType} 
                          onValueChange={(v: any) => updateGroundTruthField(idx, { fieldType: v })}
                        >
                          <SelectTrigger className="w-28" data-testid={`select-field-type-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGroundTruthField(idx)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-remove-field-${idx}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  onClick={() => createTestCaseMutation.mutate(newTestCase)}
                  disabled={
                    !newTestCase.name.trim() || 
                    !newTestCase.contractText.trim() || 
                    newTestCase.groundTruth.length === 0 || 
                    newTestCase.groundTruth.some(f => !f.fieldName.trim() || !f.expectedValue.trim()) ||
                    createTestCaseMutation.isPending
                  }
                  data-testid="button-save-test-case"
                >
                  {createTestCaseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Test Case
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
