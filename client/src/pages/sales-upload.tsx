import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, CheckCircle2, Download, Calculator,
  Network, Building2, FileText, BarChart3, Store, Paperclip, Scale,
  X, ChevronRight, Eye, Plus, Loader2, Play, Clock, Sparkles, Trash2,
  FileDown, Search, BookOpen, Calendar, ArrowRight, ThumbsUp, ThumbsDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Papa from "papaparse";

type ActiveTab = "ingest" | "calculate" | "log" | "explain" | "accruals" | "je" | "period-close";
type DatasetType = "sales" | "pos" | "royalty_report" | "adjustment" | "external_feed";

interface UploadedDataset {
  id: string;
  name: string;
  source: string;
  records: number;
  status: "validated" | "partial" | "pending" | "error" | "calculated" | "approved" | "rejected";
  type: DatasetType;
  uploadedAt: string;
  validRows?: number;
  errorRows?: number;
  totalRows?: number;
  matchedContracts?: number;
  erpMatchingEnabled?: boolean;
  matchedRecords?: number;
  unmatchedRecords?: number;
  avgConfidence?: string;
  companyWide?: boolean;
  rejectionReason?: string;
  previewHeaders?: string[];
  previewRows?: string[][];
}

const UPLOAD_CARDS = [
  { type: "sales" as DatasetType, icon: BarChart3, label: "Sales Data", color: "text-orange-600" },
  { type: "pos" as DatasetType, icon: Store, label: "POS Data", color: "text-orange-600" },
  { type: "royalty_report" as DatasetType, icon: Paperclip, label: "Contract Fee Report", color: "text-gray-500" },
  { type: "adjustment" as DatasetType, icon: Scale, label: "Adjustment File", color: "text-gray-500" },
];

const CSV_TO_DB_COLUMN: Record<string, string> = {
  'date': 'transaction_date', 'transaction date': 'transaction_date', 'transactiondate': 'transaction_date', 'transaction_date': 'transaction_date', 'sale date': 'transaction_date', 'sale_date': 'transaction_date', 'invoice date': 'transaction_date', 'invoice_date': 'transaction_date',
  'transaction id': 'transaction_id', 'transactionid': 'transaction_id', 'transaction_id': 'transaction_id', 'id': 'transaction_id', 'sale id': 'transaction_id',
  'product code': 'product_code', 'productcode': 'product_code', 'product_code': 'product_code', 'product_id': 'product_code', 'productid': 'product_code', 'product id': 'product_code', 'sku': 'product_code', 'item code': 'product_code', 'item_code': 'product_code',
  'product name': 'product_name', 'productname': 'product_name', 'product_name': 'product_name', 'product': 'product_name', 'item name': 'product_name', 'item': 'product_name',
  'category': 'category', 'product category': 'category', 'productcategory': 'category', 'product_category': 'category', 'component type': 'category', 'componenttype': 'category', 'product_family': 'category', 'product family': 'category', 'productfamily': 'category', 'type': 'category',
  'territory': 'territory', 'region': 'territory', 'country': 'territory',
  'currency': 'currency',
  'sales amount': 'gross_amount', 'salesamount': 'gross_amount', 'gross amount': 'gross_amount', 'grossamount': 'gross_amount', 'gross_amount': 'gross_amount', 'gross sales': 'gross_amount', 'gross_sales': 'gross_amount', 'amount': 'gross_amount', 'total amount': 'gross_amount', 'revenue': 'gross_amount', 'sales': 'gross_amount',
  'net amount': 'net_amount', 'netamount': 'net_amount', 'net_amount': 'net_amount', 'net': 'net_amount', 'net sales value': 'net_amount', 'net_sales_value': 'net_amount', 'net sales': 'net_amount', 'net_sales': 'net_amount', 'net_sales_amount': 'net_amount', 'net sales amount': 'net_amount',
  'quantity': 'quantity', 'qty': 'quantity', 'units': 'quantity', 'units sold': 'quantity', 'unitssold': 'quantity', 'volume': 'quantity',
  'unit price': 'unit_price', 'unitprice': 'unit_price', 'unit_price': 'unit_price', 'price': 'unit_price', 'price per unit': 'unit_price',
  'partner_name': 'custom_fields', 'partner name': 'custom_fields', 'vendor_name': 'custom_fields', 'vendor name': 'custom_fields', 'supplier': 'custom_fields', 'vendor': 'custom_fields', 'partner': 'custom_fields', 'licensee': 'custom_fields', 'distributor': 'custom_fields',
  'channel': 'custom_fields', 'sales_channel': 'custom_fields', 'sales channel': 'custom_fields', 'distribution_channel': 'custom_fields', 'distribution channel': 'custom_fields',
  'transaction_type': 'custom_fields', 'transaction type': 'custom_fields', 'sale_type': 'custom_fields', 'sale type': 'custom_fields',
  'rebate_eligible': 'custom_fields', 'rebate eligible': 'custom_fields', 'eligible': 'custom_fields',
  'exclusion_reason': 'custom_fields', 'exclusion reason': 'custom_fields',
  'quarter': 'custom_fields', 'fiscal_quarter': 'custom_fields', 'fiscal quarter': 'custom_fields',
  'distributor_name': 'custom_fields', 'distributor name': 'custom_fields',
  'licensee_name': 'custom_fields', 'licensee name': 'custom_fields',
  'reported_royalty_amount': 'custom_fields', 'reported fee amount': 'custom_fields', 'reported_rebate_amount': 'custom_fields',
  'report_date': 'custom_fields', 'report date': 'custom_fields',
};

function getDbColumn(csvHeader: string): string {
  const key = csvHeader.toLowerCase().trim();
  return CSV_TO_DB_COLUMN[key] || 'custom_fields';
}

const LIVE_INTERFACES = [
  { name: "ERP Feed", detail: "SAP S/4HANA", status: "live" as const },
  { name: "Distributor POS", detail: "SFTP", status: "partial" as const },
  { name: "Partner Portal", detail: "OAuth", status: "pending" as const },
];

const TAB_META: Record<ActiveTab, { title: string; sub: string }> = {
  ingest: { title: "Data Ingestion", sub: "Load sales, POS, and external feed data for the calculation period" },
  calculate: { title: "Calculate", sub: "Configure and run contract fee calculations across all active contracts" },
  log: { title: "Execution Log", sub: "Immutable audit trail of all calculation runs and their outputs" },
  explain: { title: "Explain", sub: "AI-native breakdown of calculation results — rules, drivers, variances" },
  accruals: { title: "Accruals", sub: "Review accrual records generated from contract fee calculations" },
  je: { title: "JE Hub", sub: "Journal entries created from accrual records for financial control" },
  "period-close": { title: "Period Close", sub: "Fiscal period readiness and close workflow management" },
};

export default function SalesUpload() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const validTabs: ActiveTab[] = ["ingest", "calculate", "log", "explain", "accruals", "je", "period-close"];
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab") as ActiveTab;
    if (validTabs.includes(tab)) return tab;
    return "ingest";
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab") as ActiveTab;
    if (validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchString]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [selectedDatasetType, setSelectedDatasetType] = useState<DatasetType>("sales");
  const [localDatasetOverrides, setLocalDatasetOverrides] = useState<Record<string, Partial<UploadedDataset>>>({});
  const { data: datasetsData, refetch: refetchDatasets } = useQuery<{ datasets: any[] }>({
    queryKey: ['/api/uploaded-datasets'],
  });
  const datasets: UploadedDataset[] = (datasetsData?.datasets || []).map((d: any) => {
    const base: UploadedDataset = {
      id: d.id,
      name: d.name,
      source: d.source || 'Manual Upload',
      records: d.records || 0,
      status: d.status || 'validated',
      type: d.type || 'sales',
      uploadedAt: d.uploaded_at || d.uploadedAt,
      validRows: d.valid_rows ?? d.validRows,
      errorRows: d.error_rows ?? d.errorRows,
      totalRows: d.total_rows ?? d.totalRows,
      matchedContracts: d.matched_contracts ?? d.matchedContracts,
      matchedRecords: d.matched_records ?? d.matchedRecords,
      unmatchedRecords: d.unmatched_records ?? d.unmatchedRecords,
      avgConfidence: d.avg_confidence ?? d.avgConfidence,
      companyWide: d.company_wide ?? d.companyWide,
    };
    const overrides = localDatasetOverrides[d.id];
    return overrides ? { ...base, ...overrides } : base;
  });
  const [reviewingDataset, setReviewingDataset] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [previewDatasetId, setPreviewDatasetId] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [autoMatchRunning, setAutoMatchRunning] = useState(false);
  const parsedPreviewRef = useRef<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCalcRun, setSelectedCalcRun] = useState<string | null>(null);
  const [calcRunType, setCalcRunType] = useState<"preview" | "final" | "adjustment">("preview");
  const [calcScope, setCalcScope] = useState<"all" | "selected">("all");
  const [calcContractId, setCalcContractId] = useState<string>("");
  const [calcPeriodStart, setCalcPeriodStart] = useState<string>("");
  const [calcPeriodEnd, setCalcPeriodEnd] = useState<string>("");
  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [calcRunning, setCalcRunning] = useState(false);
  const [calcProgress, setCalcProgress] = useState<{ current: number; total: number; contractName: string }>({ current: 0, total: 0, contractName: '' });
  const [selectedLogEntry, setSelectedLogEntry] = useState<string | null>(null);
  const [selectedExplainRun, setSelectedExplainRun] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: contractsData } = useQuery<{ contracts: any[] }>({
    queryKey: ['/api/contracts'],
  });
  const contracts = contractsData?.contracts || [];
  const selectedContract = contracts.find((c: any) => c.id === selectedContractId);
  const isCompanyWide = selectedContractId === "" || selectedContractId === "__company_wide__";

  const { data: erpMatchingSetting } = useQuery<{ erpMatchingEnabled: boolean }>({
    queryKey: ["/api/settings/erp-matching"],
  });
  const isErpMatchingEnabled = erpMatchingSetting?.erpMatchingEnabled || false;

  const { data: calculationsData } = useQuery<any>({
    queryKey: ['/api/calculations/all'],
  });
  const allCalculations = calculationsData?.calculations || [];

  useEffect(() => {
    if (activeTab === "explain" && !selectedExplainRun && allCalculations.length > 0) {
      setSelectedExplainRun(allCalculations[0].id);
    }
  }, [activeTab, allCalculations, selectedExplainRun]);

  const { data: fccData } = useQuery<any>({
    queryKey: ['/api/analytics/financial-control-center'],
  });

  const { data: accrualsList = [] } = useQuery<any[]>({
    queryKey: ['/api/accruals'],
    enabled: activeTab === "accruals",
  });

  const { data: jeList = [] } = useQuery<any[]>({
    queryKey: ['/api/journal-entries'],
    enabled: activeTab === "je",
  });

  const { data: jeSummary } = useQuery<any>({
    queryKey: ['/api/journal-entries/summary'],
    enabled: activeTab === "je",
  });

  const { data: periodCloseList = [] } = useQuery<any[]>({
    queryKey: ['/api/period-close'],
    enabled: activeTab === "period-close",
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (periodId: string) => apiRequest("DELETE", `/api/period-close/${periodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/period-close'] });
      queryClient.invalidateQueries({ queryKey: ['/api/period-close/latest'] });
      toast({ title: "Period deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete period", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      if (selectedFile.name.toLowerCase().endsWith('.csv')) {
        try {
          const text = await selectedFile.text();
          const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
          const allRows = parsed.data as string[][];
          if (allRows.length > 0) {
            parsedPreviewRef.current = {
              headers: allRows[0],
              rows: allRows.slice(1, 201),
            };
          }
        } catch {}
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedContractId && selectedContractId !== "__company_wide__") {
        formData.append("contractId", selectedContractId);
      }
      const response = await apiRequest("POST", "/api/sales/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
      const datasetId = data.datasetId || data.id;
      if (datasetId) {
        setLocalDatasetOverrides(prev => ({
          ...prev,
          [datasetId]: {
            status: "pending" as const,
            previewHeaders: parsedPreviewRef.current.headers.length > 0 ? parsedPreviewRef.current.headers : undefined,
            previewRows: parsedPreviewRef.current.rows.length > 0 ? parsedPreviewRef.current.rows : undefined,
          }
        }));
        setReviewingDataset(datasetId);
      }
      toast({
        title: "Upload Successful",
        description: "Click Approve to enable for calculations",
      });
      setSelectedFile(null);
      setShowUploadPanel(false);
      if (selectedContractId && selectedContractId !== "__company_wide__") {
        queryClient.invalidateQueries({ queryKey: [`/api/contracts/${selectedContractId}/sales`] });
        queryClient.invalidateQueries({ queryKey: [`/api/contracts/${selectedContractId}/formula-preview`] });
        queryClient.invalidateQueries({ queryKey: [`/api/contracts/${selectedContractId}/royalty-calculations`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validTypes.includes(fileExt)) {
        toast({ title: "Invalid File Type", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select a CSV or Excel file to upload.", variant: "destructive" });
      return;
    }
    uploadMutation.mutate();
  };

  const handleDownloadSample = async () => {
    try {
      const response = await fetch('/api/sales/sample-data', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to download sample data');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_sales_data.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Sample Data Downloaded", description: "You can now upload this file to test the system." });
    } catch {
      toast({ title: "Download Failed", description: "Failed to download sample data", variant: "destructive" });
    }
  };

  const handleAutoMatch = async () => {
    const companyId = contracts[0]?.companyId;
    if (!companyId) {
      toast({ title: "No Company Found", description: "No contracts found to determine company context.", variant: "destructive" });
      return;
    }
    setAutoMatchRunning(true);
    try {
      const response = await apiRequest('POST', '/api/sales/auto-match', { companyId });
      const data = await response.json();
      if (data.success) {
        const summaryText = Object.entries(data.summary || {}).map(([cn, count]) => `${cn}: ${count}`).join(', ');
        toast({ title: "Sales Matched", description: `${data.matched} sales matched to contracts${summaryText ? ` (${summaryText})` : ''}. ${data.unmatched} remain unmatched.` });
        queryClient.invalidateQueries({ queryKey: ['/api/calculations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      }
    } catch (err: any) {
      toast({ title: "Match Failed", description: err.message || "Failed to auto-match sales", variant: "destructive" });
    } finally {
      setAutoMatchRunning(false);
    }
  };

  const openUploadPanel = (type: DatasetType) => {
    setSelectedDatasetType(type);
    setShowUploadPanel(true);
    setSelectedFile(null);
    setUploadResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validTypes.includes(fileExt)) {
        toast({ title: "Invalid File Type", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const runCalculations = async () => {
    const targetContracts = calcScope === "selected" && calcContractId
      ? contracts.filter((c: any) => c.id === calcContractId)
      : contracts;

    if (targetContracts.length === 0) {
      toast({ title: "No Contracts", description: "No contracts available to run calculations on.", variant: "destructive" });
      return;
    }

    setCalcRunning(true);
    setCalcResults([]);
    const results: any[] = [];

    for (let i = 0; i < targetContracts.length; i++) {
      const contract = targetContracts[i];
      const name = contract.displayName || contract.originalName || contract.name || `Contract ${contract.id}`;
      setCalcProgress({ current: i + 1, total: targetContracts.length, contractName: name });

      try {
        const body: any = { name: `${name} — ${calcRunType}` };
        if (calcPeriodStart) body.periodStart = calcPeriodStart;
        if (calcPeriodEnd) body.periodEnd = calcPeriodEnd;

        const response = await apiRequest("POST", `/api/contracts/${contract.id}/calculate-fees`, body);
        const data = await response.json();

        const pendingBlock = data.calculation?.metadata?.auditTrail?.find?.(
          (t: any) => t?.type === 'pending_approval_block'
        ) || data.metadata?.auditTrail?.find?.(
          (t: any) => t?.type === 'pending_approval_block'
        );

        results.push({
          contractId: contract.id,
          contractName: name,
          success: true,
          totalFee: data.calculation?.totalRoyalty || data.calculation?.calculatedRoyalty || 0,
          totalSales: data.calculation?.totalSalesAmount || 0,
          transactionCount: data.message?.match(/\d+/)?.[0] || 0,
          calculationId: data.calculation?.id,
          breakdown: data.calculation?.breakdown,
          pendingBlock,
        });
      } catch (err: any) {
        results.push({
          contractId: contract.id,
          contractName: name,
          success: false,
          error: err.message || "Calculation failed",
        });
      }
    }

    setCalcResults(results);
    setCalcRunning(false);
    queryClient.invalidateQueries({ queryKey: ['/api/calculations/all'] });
    queryClient.invalidateQueries({ queryKey: ['/api/analytics/financial-control-center'] });

    const successCount = results.filter(r => r.success).length;

    if (successCount > 0 && datasets.length > 0) {
      for (const ds of datasets) {
        if (ds.status !== 'calculated' && ds.status !== 'error') {
          try {
            await apiRequest("PATCH", `/api/uploaded-datasets/${ds.id}/status`, { status: "calculated" });
          } catch {}
        }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
    }
    const totalFee = results.reduce((sum, r) => sum + (r.success ? Number(r.totalFee) : 0), 0);
    toast({
      title: "Calculations Complete",
      description: `${successCount}/${results.length} contracts processed. Total fee: $${totalFee.toLocaleString()}`,
    });
  };

  const deleteCalcRun = async (calcId: string | number) => {
    try {
      await apiRequest("DELETE", `/api/royalty-calculations/${calcId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/calculations/all'] });
      if (selectedCalcRun === calcId) setSelectedCalcRun(null);
      if (selectedLogEntry === calcId) setSelectedLogEntry(null);
      toast({ title: "Run deleted", description: "Calculation run has been removed." });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message || "Could not delete this run.", variant: "destructive" });
    }
  };

  const updateCalcStatus = async (calcId: string | number, status: 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      await apiRequest("PATCH", `/api/royalty-calculations/${calcId}/status`, { status, rejectionReason });
      queryClient.invalidateQueries({ queryKey: ['/api/calculations/all'] });
      toast({ title: status === 'approved' ? "Calculation Approved" : "Calculation Rejected", description: status === 'approved' ? "The calculation has been approved and is ready for processing." : "The calculation has been rejected." });
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const getUploadCardForType = (type: DatasetType) => datasets.filter(d => d.type === type);

  const statusBadge = (status: string) => {
    switch (status) {
      case "validated": return <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">Validated</Badge>;
      case "approved": return <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">Approved</Badge>;
      case "pending": return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">Pending</Badge>;
      case "rejected": return <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">Rejected</Badge>;
      case "calculated": return <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">Calculated</Badge>;
      case "partial": return <Badge className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">Partial</Badge>;
      case "error": return <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">Error</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ifaceStatus = (status: string) => {
    switch (status) {
      case "live": return { dot: "bg-green-500", badge: <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Live</Badge> };
      case "partial": return { dot: "bg-orange-500", badge: <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">Partial</Badge> };
      default: return { dot: "bg-gray-400", badge: <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-[10px] px-1.5 py-0">Pending</Badge> };
    }
  };

  const dataTypeLabels: Record<DatasetType, string> = {
    sales: "Sales", pos: "POS", royalty_report: "Contract Fee Report",
    adjustment: "Adjustment", external_feed: "External Feed",
  };

  const accrualTotal = fccData?.snapshot?.totalAccruals || 0;
  const jeCount = fccData?.snapshot?.totalJournalEntries || 0;
  const periodReadiness = fccData?.periodClose?.readinessScore || 0;

  const currentMeta = TAB_META[activeTab];

  return (
    <MainLayout title={currentMeta.title} description={currentMeta.sub}>
      <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden" data-testid="contract-execution-page">

        {/* PIPELINE STRIP */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-5 py-1.5 flex-shrink-0">
          <button
            onClick={() => setActiveTab("ingest")}
            className={`flex flex-col items-center gap-0.5 flex-1 min-w-[80px] px-2 py-1 rounded transition-colors ${activeTab === "ingest" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}
            data-testid="pipe-step-ingest"
          >
            <div className={`w-2 h-2 rounded-full ${datasets.length > 0 ? "bg-green-500" : activeTab === "ingest" ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,.4)]" : "bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500"}`} />
            <div className={`text-[10px] font-medium ${activeTab === "ingest" ? "text-orange-600" : "text-gray-500 dark:text-gray-400"}`}>Ingest</div>
            <div className="text-[9px] text-gray-400">{datasets.length} datasets</div>
          </button>
          <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 flex-shrink-0 mx-0.5" />
          <button
            onClick={() => setActiveTab("calculate")}
            className={`flex flex-col items-center gap-0.5 flex-1 min-w-[80px] px-2 py-1 rounded transition-colors ${activeTab === "calculate" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}
            data-testid="pipe-step-calculate"
          >
            <div className={`w-2 h-2 rounded-full ${allCalculations.length > 0 ? "bg-green-500" : activeTab === "calculate" ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,.4)]" : "bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500"}`} />
            <div className={`text-[10px] font-medium ${activeTab === "calculate" ? "text-orange-600" : "text-gray-500 dark:text-gray-400"}`}>Calculate</div>
            <div className="text-[9px] text-gray-400">{allCalculations.length > 0 ? `${allCalculations.length} runs` : "Ready"}</div>
          </button>
          <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 flex-shrink-0 mx-0.5" />
          <button
            onClick={() => setActiveTab("accruals")}
            className={`flex flex-col items-center gap-0.5 flex-1 min-w-[80px] px-2 py-1 rounded transition-colors ${activeTab === "accruals" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}
            data-testid="pipe-step-accruals"
          >
            <div className={`w-2 h-2 rounded-full ${accrualTotal > 0 ? "bg-green-500" : activeTab === "accruals" ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,.4)]" : "bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500"}`} />
            <div className={`text-[10px] font-medium ${activeTab === "accruals" ? "text-orange-600" : "text-gray-500 dark:text-gray-400"}`}>Accruals</div>
            <div className="text-[9px] text-gray-400">{accrualTotal > 0 ? `$${(accrualTotal / 1000).toFixed(0)}K` : "—"}</div>
          </button>
          <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 flex-shrink-0 mx-0.5" />
          <button
            onClick={() => setActiveTab("je")}
            className={`flex flex-col items-center gap-0.5 flex-1 min-w-[80px] px-2 py-1 rounded transition-colors ${activeTab === "je" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}
            data-testid="pipe-step-je"
          >
            <div className={`w-2 h-2 rounded-full ${jeCount > 0 ? "bg-green-500" : activeTab === "je" ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,.4)]" : "bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500"}`} />
            <div className={`text-[10px] font-medium ${activeTab === "je" ? "text-orange-600" : "text-gray-500 dark:text-gray-400"}`}>JE Hub</div>
            <div className="text-[9px] text-gray-400">{jeCount > 0 ? `${jeCount} JEs` : "—"}</div>
          </button>
          <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 flex-shrink-0 mx-0.5" />
          <button
            onClick={() => setActiveTab("period-close")}
            className={`flex flex-col items-center gap-0.5 flex-1 min-w-[80px] px-2 py-1 rounded transition-colors ${activeTab === "period-close" ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}
            data-testid="pipe-step-period-close"
          >
            <div className={`w-2 h-2 rounded-full ${periodReadiness > 50 ? "bg-orange-500" : activeTab === "period-close" ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,.4)]" : "bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500"}`} />
            <div className={`text-[10px] font-medium ${activeTab === "period-close" ? "text-orange-600" : "text-gray-500 dark:text-gray-400"}`}>Period Close</div>
            <div className="text-[9px] text-gray-400">{periodReadiness > 0 ? `${periodReadiness}% ready` : "—"}</div>
          </button>
        </div>

        {/* MAIN TABS */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-5 flex-shrink-0">
          {([
            { key: "ingest" as ActiveTab, icon: Download, label: "Data Ingestion" },
            { key: "calculate" as ActiveTab, icon: Play, label: "Calculate" },
            { key: "log" as ActiveTab, icon: Clock, label: "Execution Log" },
            { key: "explain" as ActiveTab, icon: Sparkles, label: "Explain" },
            { key: "accruals" as ActiveTab, icon: BarChart3, label: "Accruals" },
            { key: "je" as ActiveTab, icon: BookOpen, label: "JE Hub" },
            { key: "period-close" as ActiveTab, icon: Calendar, label: "Period Close" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors
                ${activeTab === tab.key
                  ? "text-orange-600 border-orange-600"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-hidden">

          {/* ═══ INGEST TAB ═══ */}
          {activeTab === "ingest" && (
            <div className="flex h-full overflow-hidden">
              {/* Left sidebar */}
              <div className="w-[260px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto p-3.5">
                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Upload Files</div>
                {UPLOAD_CARDS.map(card => {
                  const loaded = getUploadCardForType(card.type);
                  const hasData = loaded.length > 0;
                  return (
                    <div
                      key={card.type}
                      onClick={() => openUploadPanel(card.type)}
                      className={`rounded-lg p-3 mb-1.5 cursor-pointer text-center transition-all border-2 border-dashed
                        ${hasData
                          ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30'
                          : 'border-gray-200 bg-gray-50/50 hover:border-orange-400 hover:bg-orange-50/30 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-orange-600 dark:hover:bg-orange-950/20'
                        }`}
                      data-testid={`upload-card-${card.type}`}
                    >
                      <card.icon className={`h-5 w-5 mx-auto mb-1.5 ${hasData ? 'text-green-600 dark:text-green-400' : card.color}`} />
                      <div className={`text-xs font-semibold ${hasData ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-gray-100'}`}>{card.label}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {hasData ? `${loaded[0].name} · ${loaded[0].records.toLocaleString()} rows` : 'Drop or click to upload'}
                      </div>
                    </div>
                  );
                })}
                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-4 mb-2">Live Interfaces</div>
                {LIVE_INTERFACES.map(iface => {
                  const st = ifaceStatus(iface.status);
                  return (
                    <div key={iface.name} className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                      <div className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{iface.name}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">{iface.detail}</div>
                      </div>
                      {st.badge}
                    </div>
                  );
                })}
              </div>

              {/* Main ingest content */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {showUploadPanel && (
                  <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4" data-testid="inline-upload-panel">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Upload Dataset</h3>
                      <button onClick={() => { setShowUploadPanel(false); setSelectedFile(null); setUploadResult(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-testid="button-close-upload"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex gap-4">
                      <div
                        className={`flex-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                          ${isDragging ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : selectedFile ? 'border-green-400 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20' : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30 dark:border-gray-600 dark:hover:border-orange-600 dark:hover:bg-orange-950/20'}`}
                        onClick={() => fileInputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} data-testid="drop-zone"
                      >
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" disabled={uploadMutation.isPending} data-testid="input-sales-file" />
                        {selectedFile ? (
                          <>
                            <FileSpreadsheet className="h-7 w-7 mx-auto mb-2 text-green-600 dark:text-green-400" />
                            <div className="text-sm font-semibold text-green-700 dark:text-green-300">{selectedFile.name}</div>
                            <div className="text-[11px] text-gray-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB — Click to change</div>
                          </>
                        ) : (
                          <>
                            <Paperclip className="h-7 w-7 mx-auto mb-2 text-gray-400" />
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Drop file here or click to browse</div>
                            <div className="text-[11px] text-gray-400 mt-1">CSV, XLSX — Sales, POS, Contract Fee Reports, Adjustments, External Feeds</div>
                          </>
                        )}
                      </div>
                      <div className="w-[280px] flex-shrink-0 space-y-3">
                        <div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1.5">Data Type</div>
                          <div className="flex flex-wrap gap-2">
                            {(["sales", "pos", "royalty_report", "adjustment", "external_feed"] as DatasetType[]).map(dt => (
                              <label key={dt} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded-md transition-colors ${selectedDatasetType === dt ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`} data-testid={`radio-type-${dt}`}>
                                <input type="radio" name="datasetType" value={dt} checked={selectedDatasetType === dt} onChange={() => setSelectedDatasetType(dt)} className="accent-orange-600" />
                                {dataTypeLabels[dt]}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1.5">Contract</div>
                          <Select value={selectedContractId || "__company_wide__"} onValueChange={(val) => setSelectedContractId(val === "__company_wide__" ? "" : val)}>
                            <SelectTrigger className="h-8 text-xs" data-testid="select-contract"><SelectValue placeholder="All Contracts (Company-wide)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__company_wide__"><span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />All Contracts (Company-wide)</span></SelectItem>
                              {contracts.map((contract: any) => (
                                <SelectItem key={contract.id} value={contract.id}><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{contract.displayName || contract.originalName || contract.name}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setShowUploadPanel(false); setSelectedFile(null); setUploadResult(null); }} data-testid="button-cancel-upload">Cancel</Button>
                          <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={handleUpload} disabled={!selectedFile || uploadMutation.isPending} data-testid="button-upload-sales">
                            {uploadMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing...</> : <><Upload className="h-3 w-3 mr-1" /> Upload & Validate</>}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {uploadResult && (
                      <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900" data-testid="upload-result">
                        <div className="flex items-center gap-2 mb-2">
                          {uploadResult.errors > 0 ? <AlertCircle className="h-4 w-4 text-orange-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import Results</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-orange-50 dark:bg-orange-950/50 p-2.5 rounded text-center"><div className="text-[10px] text-gray-500">Total Rows</div><div className="text-lg font-bold text-gray-900 dark:text-gray-100">{uploadResult.totalRows || 0}</div></div>
                          <div className="bg-green-50 dark:bg-green-950/50 p-2.5 rounded text-center"><div className="text-[10px] text-gray-500">Valid</div><div className="text-lg font-bold text-green-700 dark:text-green-400">{uploadResult.validRows || 0}</div></div>
                          <div className="bg-red-50 dark:bg-red-950/50 p-2.5 rounded text-center"><div className="text-[10px] text-gray-500">Errors</div><div className="text-lg font-bold text-red-600 dark:text-red-400">{uploadResult.errors || 0}</div></div>
                        </div>
                        {uploadResult.erpMatchingEnabled && (
                          <div className="mt-2 p-2 bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded text-xs">
                            <div className="flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200 mb-1"><Network className="h-3 w-3" /> ERP Semantic Matching</div>
                            <div className="flex gap-4 text-gray-600 dark:text-gray-400">
                              <span>Matched: <strong className="text-green-700">{uploadResult.matchedRecords || 0}</strong></span>
                              <span>Unmatched: <strong className="text-orange-700">{uploadResult.unmatchedRecords || 0}</strong></span>
                              <span>Confidence: <strong>{uploadResult.avgConfidence ? `${(parseFloat(uploadResult.avgConfidence) * 100).toFixed(0)}%` : '0%'}</strong></span>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          {selectedContractId && selectedContractId !== "__company_wide__" ? (
                            <>
                              <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setLocation(`/contracts/${selectedContractId}/manage?tab=calculate`)} data-testid="button-view-dashboard"><Calculator className="h-3 w-3 mr-1" /> View Dashboard</Button>
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation(`/contracts/${selectedContractId}/pipeline`)} data-testid="button-manage-rules"><FileSpreadsheet className="h-3 w-3 mr-1" /> Manage Rules</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setLocation('/contracts')} data-testid="button-view-contracts"><FileText className="h-3 w-3 mr-1" /> View Contracts</Button>
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setUploadResult(null); }} data-testid="button-upload-more"><Upload className="h-3 w-3 mr-1" /> Upload More</Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Loaded Datasets</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" onClick={handleAutoMatch} disabled={autoMatchRunning} data-testid="button-auto-match-sales">
                        {autoMatchRunning ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Matching...</> : <><Sparkles className="h-3 w-3 mr-1" /> Smart Match</>}
                      </Button>
                      <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" onClick={handleDownloadSample} data-testid="button-download-sample"><Download className="h-3 w-3 mr-1" /> Sample Data</Button>
                      <Button size="sm" className="text-[11px] h-7 px-2 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => openUploadPanel("sales")} data-testid="button-add-dataset"><Plus className="h-3 w-3 mr-1" /> Add Dataset</Button>
                    </div>
                  </div>
                  {datasets.length === 0 && !showUploadPanel ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4"><Upload className="h-7 w-7 text-orange-400" /></div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No datasets loaded yet</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">Upload sales, POS, or external feed data for the calculation period.</p>
                      <Button className="bg-orange-600 hover:bg-orange-700 text-white text-xs" onClick={() => openUploadPanel("sales")} data-testid="button-start-upload"><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Your First Dataset</Button>
                    </div>
                  ) : datasets.length > 0 ? (
                    <>
                      <table className="w-full text-xs" data-testid="datasets-table">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-800">
                            <th className="text-left py-2.5 px-3 text-[11px] text-gray-500 font-semibold">Dataset</th>
                            <th className="text-left py-2.5 px-3 text-[11px] text-gray-500 font-semibold">Source</th>
                            <th className="text-left py-2.5 px-3 text-[11px] text-gray-500 font-semibold">Records</th>
                            <th className="text-left py-2.5 px-3 text-[11px] text-gray-500 font-semibold">Uploaded</th>
                            <th className="text-left py-2.5 px-3 text-[11px] text-gray-500 font-semibold">Status</th>
                            <th className="py-2.5 px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {datasets.map((ds) => (
                            <tr key={ds.id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors ${ds.status === 'calculated' ? 'opacity-60' : ''}`} data-testid={`row-dataset-${ds.id}`}>
                              <td className="py-2.5 px-3"><div className="font-medium text-gray-900 dark:text-gray-100">{ds.name}</div><div className="text-[10px] text-gray-400">{dataTypeLabels[ds.type]}</div></td>
                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{ds.source}</td>
                              <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 font-mono">{ds.records.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-gray-500">{ds.uploadedAt ? new Date(ds.uploadedAt).toLocaleDateString() : '—'}</td>
                              <td className="py-2.5 px-3">{statusBadge(ds.status)}</td>
                              <td className="py-2.5 px-3 flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-gray-500 hover:text-orange-600" onClick={() => setReviewingDataset(reviewingDataset === ds.id ? null : ds.id)} data-testid={`button-review-${ds.id}`}><Eye className="h-3 w-3 mr-1" /> Review</Button>
                                <Button variant="ghost" size="sm" className="text-[11px] h-6 px-1.5 text-gray-400 hover:text-red-600" onClick={async () => {
                                  try {
                                    try { await apiRequest('DELETE', '/api/sales/company-wide'); } catch {}
                                    await apiRequest('DELETE', `/api/uploaded-datasets/${ds.id}`);
                                    toast({ title: "Dataset Deleted", description: "Dataset record removed successfully" });
                                    queryClient.invalidateQueries({ queryKey: ['/api/calculations'] });
                                    queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
                                  } catch (e: any) {
                                    toast({ title: "Delete Failed", description: e.message || "Failed to delete dataset", variant: "destructive" });
                                  }
                                  if (reviewingDataset === ds.id) setReviewingDataset(null);
                                }} data-testid={`button-remove-dataset-${ds.id}`}><Trash2 className="h-3 w-3" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reviewingDataset && (() => {
                        const ds = datasets.find(d => d.id === reviewingDataset);
                        if (!ds) return null;
                        const PREVIEW_PAGE_SIZE = 25;
                        const previewHeaders = ds.previewHeaders || [];
                        const previewRows = ds.previewRows || [];
                        const previewTotalPages = Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE));
                        const pagedRows = previewRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);
                        return (
                          <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3.5 bg-white dark:bg-gray-900" data-testid="review-panel">
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{ds.name} — Validation</div>
                              <button onClick={() => { setReviewingDataset(null); setShowRejectForm(false); setRejectReason(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="grid grid-cols-4 gap-3 mb-3">
                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-center"><div className="text-[10px] text-gray-500">Total Rows</div><div className="text-sm font-bold text-gray-900 dark:text-gray-100">{(ds.totalRows || ds.records).toLocaleString()}</div></div>
                              <div className="bg-green-50 dark:bg-green-950/50 rounded p-2 text-center"><div className="text-[10px] text-gray-500">Valid</div><div className="text-sm font-bold text-green-700 dark:text-green-400">{(ds.validRows || ds.records).toLocaleString()}</div></div>
                              <div className="bg-red-50 dark:bg-red-950/50 rounded p-2 text-center"><div className="text-[10px] text-gray-500">Errors</div><div className="text-sm font-bold text-red-600 dark:text-red-400">{(ds.errorRows || 0).toLocaleString()}</div></div>
                              <div className="bg-orange-50 dark:bg-orange-950/50 rounded p-2 text-center"><div className="text-[10px] text-gray-500">Contracts</div><div className="text-sm font-bold text-orange-700 dark:text-orange-400">{ds.matchedContracts || '—'}</div></div>
                            </div>

                            {ds.status === 'calculated' ? (
                              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 font-medium"><CheckCircle2 className="h-4 w-4" /> Dataset has been processed in a calculation run</div>
                            ) : ds.status === 'approved' ? (
                              <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 font-medium"><CheckCircle className="h-4 w-4" /> Dataset approved and ready for calculation</div>
                            ) : ds.status === 'rejected' ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 font-medium"><AlertCircle className="h-4 w-4" /> Dataset rejected{ds.rejectionReason ? `: ${ds.rejectionReason}` : ''}</div>
                                <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                                  try {
                                    await apiRequest('PATCH', `/api/uploaded-datasets/${ds.id}/status`, { status: 'validated' });
                                    setLocalDatasetOverrides(prev => { const next = { ...prev }; delete next[ds.id]; return next; });
                                    queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
                                    toast({ title: "Dataset Re-opened", description: `${ds.name} moved back to validated.` });
                                  } catch {}
                                }} data-testid="button-reopen-dataset">Re-open for Review</Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {showRejectForm ? (
                                  <div className="space-y-2 border border-red-200 dark:border-red-800 rounded p-2.5 bg-red-50/50 dark:bg-red-950/30">
                                    <div className="text-xs font-medium text-red-700 dark:text-red-400">Rejection Reason</div>
                                    <textarea className="w-full text-xs border rounded p-2 bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" rows={2} placeholder="Enter reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} data-testid="input-reject-reason" />
                                    <div className="flex gap-2">
                                      <Button size="sm" className="text-xs bg-red-600 hover:bg-red-700 text-white" disabled={!rejectReason.trim()} onClick={async () => {
                                        try {
                                          await apiRequest('PATCH', `/api/uploaded-datasets/${ds.id}/status`, { status: 'rejected' });
                                          setLocalDatasetOverrides(prev => ({ ...prev, [ds.id]: { ...prev[ds.id], status: 'rejected', rejectionReason: rejectReason.trim() } }));
                                          queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
                                          toast({ title: "Dataset Rejected", description: ds.name });
                                          setShowRejectForm(false); setRejectReason("");
                                        } catch {}
                                      }} data-testid="button-confirm-reject"><ThumbsDown className="h-3 w-3 mr-1" /> Confirm Reject</Button>
                                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setShowRejectForm(false); setRejectReason(""); }}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 text-white" onClick={async () => {
                                      try {
                                        await apiRequest('PATCH', `/api/uploaded-datasets/${ds.id}/status`, { status: 'approved' });
                                        setLocalDatasetOverrides(prev => ({ ...prev, [ds.id]: { ...prev[ds.id], status: 'approved' } }));
                                        queryClient.invalidateQueries({ queryKey: ['/api/uploaded-datasets'] });
                                        toast({ title: "Dataset Approved", description: `${ds.name} is now eligible for calculations.` });
                                      } catch {}
                                    }} data-testid="button-approve-dataset"><ThumbsUp className="h-3 w-3 mr-1" /> Approve</Button>
                                    <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30" onClick={() => setShowRejectForm(true)} data-testid="button-reject-dataset"><ThumbsDown className="h-3 w-3 mr-1" /> Reject</Button>
                                    <Button size="sm" variant="outline" className="text-xs" data-testid="button-fix-mappings">Fix Mappings</Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {previewHeaders.length > 0 && (
                              <div className="mt-3">
                                <button className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400" onClick={() => setPreviewDatasetId(previewDatasetId === ds.id ? null : ds.id)} data-testid="button-toggle-preview">
                                  <ChevronRight className={`h-3 w-3 transition-transform ${previewDatasetId === ds.id ? 'rotate-90' : ''}`} />
                                  CSV Preview ({previewRows.length} rows)
                                </button>
                                {previewDatasetId === ds.id && (
                                  <div className="mt-2 overflow-x-auto border rounded border-gray-200 dark:border-gray-700">
                                    <table className="min-w-full text-[10px]">
                                      <thead className="bg-gray-100 dark:bg-gray-800">
                                        <tr>{previewHeaders.map((h, i) => <th key={i} className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{h}</th>)}</tr>
                                        <tr className="bg-orange-50 dark:bg-orange-950/30 border-t border-orange-200 dark:border-orange-900">
                                          {previewHeaders.map((h, i) => {
                                            const dbCol = getDbColumn(h);
                                            const isMapped = dbCol !== 'custom_fields';
                                            return (
                                              <th key={i} className="px-2 py-0.5 text-left whitespace-nowrap">
                                                <span className={`text-[9px] font-medium ${isMapped ? 'text-orange-700 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                                                  {isMapped ? `→ ${dbCol}` : '→ custom_fields'}
                                                </span>
                                              </th>
                                            );
                                          })}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {pagedRows.map((row, ri) => (
                                          <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                                            {row.map((cell, ci) => <td key={ci} className="px-2 py-0.5 text-gray-600 dark:text-gray-400 whitespace-nowrap max-w-[200px] truncate">{cell}</td>)}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {previewTotalPages > 1 && (
                                      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-500">
                                        <span>Page {previewPage + 1} of {previewTotalPages}</span>
                                        <div className="flex gap-1">
                                          <button disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)} className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border disabled:opacity-40">Prev</button>
                                          <button disabled={previewPage >= previewTotalPages - 1} onClick={() => setPreviewPage(p => p + 1)} className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border disabled:opacity-40">Next</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ═══ CALCULATE TAB ═══ */}
          {activeTab === "calculate" && (
            <div className="flex h-full overflow-hidden">
              {/* Run Setup Sidebar */}
              <div className="w-[300px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col overflow-hidden">
                <div className="p-3.5 pb-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full text-xs py-2"
                    onClick={handleAutoMatch}
                    disabled={autoMatchRunning}
                    data-testid="button-calc-auto-match"
                  >
                    {autoMatchRunning ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Matching Sales...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Smart Match Sales to Contracts</>}
                  </Button>
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs py-2.5"
                    onClick={runCalculations}
                    disabled={calcRunning || (calcScope === "selected" && !calcContractId)}
                    data-testid="button-run-calculations"
                  >
                    {calcRunning ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running {calcProgress.current}/{calcProgress.total}...</>
                    ) : (
                      <><Play className="h-3.5 w-3.5 mr-1.5" /> Run Calculations</>
                    )}
                  </Button>
                  {calcRunning && (
                    <div className="text-[10px] text-center text-gray-500 truncate">{calcProgress.contractName}</div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3.5">
                  <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Run Setup</div>

                  <div className="mb-3">
                    <div className="text-[11px] text-gray-500 font-medium mb-1.5">Period</div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="text-[10px] text-gray-400 mb-0.5">Start</div>
                        <input type="date" value={calcPeriodStart} onChange={(e) => setCalcPeriodStart(e.target.value)} className="w-full h-8 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none focus:border-orange-400 text-gray-900 dark:text-gray-100" data-testid="input-period-start" />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-0.5">End</div>
                        <input type="date" value={calcPeriodEnd} onChange={(e) => setCalcPeriodEnd(e.target.value)} className="w-full h-8 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none focus:border-orange-400 text-gray-900 dark:text-gray-100" data-testid="input-period-end" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-[11px] text-gray-500 font-medium mb-1.5">Datasets</div>
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-2 space-y-1">
                      {(() => {
                        const activeDs = datasets.filter(ds => ds.status === 'approved' || ds.status === 'validated');
                        const calculatedDs = datasets.filter(ds => ds.status === 'calculated');
                        if (activeDs.length === 0 && calculatedDs.length === 0) {
                          return <div className="text-xs text-gray-400 py-2 text-center">No datasets loaded yet — calculations will run against all uploaded sales data.</div>;
                        }
                        return (
                          <>
                            {activeDs.map(ds => (
                              <label key={ds.id} className="flex items-center gap-2 text-xs cursor-pointer py-1" data-testid={`dataset-active-${ds.id}`}>
                                <input type="checkbox" defaultChecked className="accent-orange-600" />
                                <span className="text-gray-900 dark:text-gray-100 truncate">{ds.name}</span>
                                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{ds.records.toLocaleString()} rows</span>
                              </label>
                            ))}
                            {activeDs.length === 0 && calculatedDs.length > 0 && (
                              <div className="text-xs text-gray-400 py-1 text-center">All datasets have been processed.</div>
                            )}
                            {calculatedDs.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                  Processed ({calculatedDs.length})
                                </div>
                                {calculatedDs.map(ds => (
                                  <div key={ds.id} className="flex items-center gap-2 text-xs py-0.5 opacity-50" data-testid={`dataset-calculated-${ds.id}`}>
                                    <CheckCircle2 className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                    <span className="text-gray-500 dark:text-gray-500 truncate">{ds.name}</span>
                                    <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{ds.records.toLocaleString()} rows</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-[11px] text-gray-500 font-medium mb-1.5">Contract Scope</div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-1"><input type="radio" name="calcScope" checked={calcScope === "all"} onChange={() => setCalcScope("all")} className="accent-orange-600" /> All active ({contracts.length} contracts)</label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-1"><input type="radio" name="calcScope" checked={calcScope === "selected"} onChange={() => setCalcScope("selected")} className="accent-orange-600" /> Selected contracts</label>
                    {calcScope === "selected" && (
                      <Select value={calcContractId || "__none__"} onValueChange={(val) => setCalcContractId(val === "__none__" ? "" : val)}>
                        <SelectTrigger className="h-8 text-xs mt-1.5" data-testid="select-calc-contract"><SelectValue placeholder="Choose a contract..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose a contract...</SelectItem>
                          {contracts.map((contract: any) => (
                            <SelectItem key={contract.id} value={contract.id}><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{contract.displayName || contract.originalName || contract.name}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="text-[11px] text-gray-500 font-medium mb-1.5">Run Type</div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-1"><input type="radio" name="calcRunType" checked={calcRunType === "preview"} onChange={() => setCalcRunType("preview")} className="accent-orange-600" /> Preview (no write)</label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-1"><input type="radio" name="calcRunType" checked={calcRunType === "final"} onChange={() => setCalcRunType("final")} className="accent-orange-600" /> Final</label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer py-1"><input type="radio" name="calcRunType" checked={calcRunType === "adjustment"} onChange={() => setCalcRunType("adjustment")} className="accent-orange-600" /> Adjustment</label>
                  </div>
                </div>
              </div>

              {/* Recent Runs + Results */}
              <div className="flex-1 overflow-y-auto p-4 min-w-0">
                {/* Inline Results from current run */}
                {calcResults.length > 0 && (
                  <div className="mb-5" data-testid="calc-results">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Latest Run Results</div>
                      <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" onClick={() => setCalcResults([])} data-testid="button-clear-results"><X className="h-3 w-3 mr-1" /> Clear</Button>
                    </div>

                    {calcResults.filter(r => r.pendingBlock).map((r, idx) => (
                      <div
                        key={`pending-${idx}`}
                        className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-4 flex items-start gap-3"
                        data-testid={`banner-pending-approval-${idx}`}
                      >
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                            {r.contractName}: {r.pendingBlock.pendingApprovalCount || 0} rule{(r.pendingBlock.pendingApprovalCount || 0) !== 1 ? 's' : ''} pending approval
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Fee calculations cannot run until rules are approved by an authorized Finance user.
                            Go to <strong>Rules Management</strong> to review and approve pending rules.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 text-xs h-7 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                            data-testid={`button-go-to-rules-${idx}`}
                            onClick={() => setLocation(`/contracts/${r.contractId}/manage?tab=rules`)}
                          >
                            Go to Rules Management
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-gray-500">Total Fee</div>
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">${calcResults.reduce((s, r) => s + (r.success ? Number(r.totalFee) : 0), 0).toLocaleString()}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-gray-500">Contracts</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{calcResults.filter(r => r.success).length}/{calcResults.length}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-gray-500">Transactions</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{calcResults.reduce((s, r) => s + (r.success ? Number(r.transactionCount || 0) : 0), 0)}</div>
                      </div>
                    </div>

                    <table className="w-full text-xs" data-testid="calc-results-table">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800">
                          <th className="text-left py-2 px-3 text-[11px] text-gray-500 font-semibold">Contract</th>
                          <th className="text-left py-2 px-3 text-[11px] text-gray-500 font-semibold">Sales</th>
                          <th className="text-left py-2 px-3 text-[11px] text-gray-500 font-semibold">Fee</th>
                          <th className="text-left py-2 px-3 text-[11px] text-gray-500 font-semibold">Txns</th>
                          <th className="text-left py-2 px-3 text-[11px] text-gray-500 font-semibold">Status</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcResults.map((r, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-800" data-testid={`calc-result-${idx}`}>
                            <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">{r.contractName}</td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{r.success ? `$${Number(r.totalSales).toLocaleString()}` : '—'}</td>
                            <td className="py-2.5 px-3 font-bold text-green-700 dark:text-green-400">{r.success ? `$${Number(r.totalFee).toLocaleString()}` : '—'}</td>
                            <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100">{r.success ? r.transactionCount : '—'}</td>
                            <td className="py-2.5 px-3">
                              {r.success ? (
                                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Complete</Badge>
                              ) : (
                                <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Failed</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.success && r.calculationId && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5" onClick={() => setLocation(`/calculations/${r.calculationId}/report`)} data-testid={`button-report-${idx}`}><Eye className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5" onClick={() => setLocation(`/contracts/${r.contractId}/manage?tab=calculate`)} data-testid={`button-dashboard-${idx}`}><BarChart3 className="h-3 w-3" /></Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setActiveTab("accruals")} data-testid="button-results-accruals"><ArrowRight className="h-3 w-3 mr-1" /> View Accruals</Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation('/calculations')} data-testid="button-open-calc-engine"><Calculator className="h-3 w-3 mr-1" /> Calculation Engine</Button>
                    </div>
                  </div>
                )}

                {/* Recent Runs */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Runs</div>
                  <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" onClick={() => setActiveTab("log")} data-testid="button-full-log">Full Log <ArrowRight className="h-3 w-3 ml-1" /></Button>
                </div>

                {allCalculations.length === 0 && calcResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4"><Calculator className="h-7 w-7 text-orange-400" /></div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No calculations yet</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">Configure your run on the left, then click "Run Calculations" to process uploaded sales data against contract rules.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allCalculations.slice(0, 10).map((calc: any, idx: number) => {
                      const runId = `RUN-${String(allCalculations.length - idx).padStart(3, '0')}`;
                      const isSelected = selectedCalcRun === calc.id;
                      return (
                        <div key={calc.id}>
                          <div
                            onClick={() => setSelectedCalcRun(isSelected ? null : calc.id)}
                            className={`border rounded-lg p-3 cursor-pointer transition-all
                              ${isSelected ? 'border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                            data-testid={`run-card-${calc.id}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold font-mono text-gray-900 dark:text-gray-100">{runId}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">{calc.status || "Preview"}</Badge>
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${runId}? This cannot be undone.`)) deleteCalcRun(calc.id); }}
                                  className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Delete this run"
                                  data-testid={`button-delete-run-${calc.id}`}
                                ><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400">{new Date(calc.calculationDate || calc.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}, {new Date(calc.calculationDate || calc.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · {calc.contractName || 'Multiple contracts'}</div>
                            <div className="text-xs font-bold text-green-700 dark:text-green-400 mt-1">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</div>
                          </div>

                          {isSelected && (
                            <div className="mt-1 border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-900" data-testid="run-detail">
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Period</span><span className="font-medium text-gray-900 dark:text-gray-100">{calc.periodLabel || 'Q1 2026'}</span></div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Run Type</span><span className="font-medium text-gray-900 dark:text-gray-100">{calc.status || 'Preview'}</span></div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Triggered By</span><span className="font-medium text-gray-900 dark:text-gray-100">{calc.triggeredBy || 'liQ Agent'}</span></div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Contracts</span><span className="font-medium text-gray-900 dark:text-gray-100">{calc.contractCount || contracts.length}</span></div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Total Fee</span><span className="font-bold text-green-700 dark:text-green-400">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between py-1"><span className="text-gray-500">Status</span><span className="font-medium text-gray-900 dark:text-gray-100">{calc.status || 'Complete'}</span></div>
                              </div>
                              {(calc.status === 'pending_approval' || calc.status === 'pending') && (
                                <div className="flex gap-2 mt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                                  <Button size="sm" className="text-[10px] h-7 px-3 bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); updateCalcStatus(calc.id, 'approved'); }} data-testid={`button-approve-${calc.id}`}><ThumbsUp className="h-3 w-3 mr-1" /> Approve</Button>
                                  <Button size="sm" variant="outline" className="text-[10px] h-7 px-3 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30" onClick={(e) => { e.stopPropagation(); updateCalcStatus(calc.id, 'rejected', 'Rejected from Calculate tab'); }} data-testid={`button-reject-${calc.id}`}><ThumbsDown className="h-3 w-3 mr-1" /> Reject</Button>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Button size="sm" className="text-[10px] h-6 px-2 bg-orange-600 hover:bg-orange-700 text-white" onClick={(e) => { e.stopPropagation(); setActiveTab("accruals"); }} data-testid="button-goto-accruals"><ArrowRight className="h-3 w-3 mr-0.5" /> Accruals</Button>
                                <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={(e) => { e.stopPropagation(); setLocation(`/calculations/${calc.id}/report`); }} data-testid="button-view-report"><Eye className="h-3 w-3 mr-0.5" /> Report</Button>
                                <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={(e) => { e.stopPropagation(); setSelectedExplainRun(calc.id); setActiveTab("explain"); }} data-testid="button-explain-run"><Sparkles className="h-3 w-3 mr-0.5" /> Explain</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ EXECUTION LOG TAB ═══ */}
          {activeTab === "log" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <div className="relative flex-1 max-w-[220px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-gray-100 outline-none focus:border-orange-400" placeholder="Search runs..." data-testid="input-log-search" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="h-7 text-xs w-[120px]" data-testid="select-log-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" data-testid="button-export-csv"><FileDown className="h-3 w-3 mr-1" /> Export CSV</Button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Run ID</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Triggered By</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Period</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Type</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Contracts</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Accrual Value</th>
                        <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Status</th>
                        <th className="py-2.5 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCalculations.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-12 text-gray-400">No execution logs yet. Run a calculation first.</td></tr>
                      ) : allCalculations.map((calc: any, idx: number) => {
                        const runId = `RUN-${String(allCalculations.length - idx).padStart(3, '0')}`;
                        const isSelected = selectedLogEntry === calc.id;
                        return (
                          <tr
                            key={calc.id}
                            onClick={() => setSelectedLogEntry(isSelected ? null : calc.id)}
                            className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-orange-50/50 dark:bg-orange-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}
                            data-testid={`log-row-${calc.id}`}
                          >
                            <td className="py-2.5 px-4 font-mono font-bold text-gray-900 dark:text-gray-100">{runId}</td>
                            <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{calc.triggeredBy || 'System'}</td>
                            <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{calc.periodLabel || 'Q1 2026'}</td>
                            <td className="py-2.5 px-4"><Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">{calc.status || 'Preview'}</Badge></td>
                            <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100">{calc.contractCount || contracts.length}</td>
                            <td className="py-2.5 px-4 font-bold text-green-700 dark:text-green-400">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</td>
                            <td className="py-2.5 px-4"><Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Complete</Badge></td>
                            <td className="py-2.5 px-4">
                              <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5" onClick={(e) => { e.stopPropagation(); setLocation(`/calculations/${calc.id}/report`); }} data-testid={`button-view-report-${calc.id}`}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedLogEntry && (() => {
                  const calc = allCalculations.find((c: any) => c.id === selectedLogEntry);
                  if (!calc) return null;
                  const idx = allCalculations.indexOf(calc);
                  return (
                    <div className="w-[320px] flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto p-3.5" data-testid="log-detail-panel">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">RUN-{String(allCalculations.length - idx).padStart(3, '0')}</div>
                        <button
                          onClick={() => { if (confirm(`Delete RUN-${String(allCalculations.length - idx).padStart(3, '0')}? This cannot be undone.`)) deleteCalcRun(calc.id); }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete this run"
                          data-testid={`button-log-delete-${calc.id}`}
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Date</span><span className="text-gray-900 dark:text-gray-100">{new Date(calc.calculationDate || calc.createdAt).toLocaleDateString()}</span></div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Contract</span><span className="text-gray-900 dark:text-gray-100">{calc.contractName || '—'}</span></div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Total Fee</span><span className="font-bold text-green-700 dark:text-green-400">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800"><span className="text-gray-500">Sales Amount</span><span className="text-gray-900 dark:text-gray-100">${Number(calc.totalSalesAmount || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between py-1.5"><span className="text-gray-500">Lines</span><span className="text-gray-900 dark:text-gray-100">{calc.lineItemCount || '—'}</span></div>
                      </div>
                      {(calc.status === 'pending_approval' || calc.status === 'pending') && (
                        <div className="flex gap-2 mt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                          <Button size="sm" className="text-[10px] h-7 px-3 bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); updateCalcStatus(calc.id, 'approved'); }} data-testid={`button-log-approve-${calc.id}`}><ThumbsUp className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 px-3 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30" onClick={(e) => { e.stopPropagation(); updateCalcStatus(calc.id, 'rejected', 'Rejected from Execution Log'); }} data-testid={`button-log-reject-${calc.id}`}><ThumbsDown className="h-3 w-3 mr-1" /> Reject</Button>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" className="text-[10px] h-6 px-2 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setLocation(`/calculations/${calc.id}/report`)} data-testid="button-full-report"><FileText className="h-3 w-3 mr-0.5" /> Report</Button>
                        <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => setLocation(`/calculations/${calc.id}/audit-trail`)} data-testid="button-audit-trail"><BookOpen className="h-3 w-3 mr-0.5" /> Audit</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ═══ EXPLAIN TAB ═══ */}
          {activeTab === "explain" && (
            <div className="flex h-full overflow-hidden">
              {/* Run Selector */}
              <div className="w-[260px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto p-3.5">
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Select a Run</div>
                {allCalculations.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">No runs to explain. Complete a calculation first.</div>
                ) : allCalculations.slice(0, 10).map((calc: any, idx: number) => {
                  const runId = `RUN-${String(allCalculations.length - idx).padStart(3, '0')}`;
                  const isSelected = selectedExplainRun === calc.id;
                  return (
                    <div
                      key={calc.id}
                      onClick={() => setSelectedExplainRun(calc.id)}
                      className={`border rounded-lg p-2.5 mb-1.5 cursor-pointer transition-all
                        ${isSelected ? 'border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                      data-testid={`explain-run-${calc.id}`}
                    >
                      <div className="text-xs font-bold font-mono text-gray-900 dark:text-gray-100">{runId}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{calc.contractName || 'Multiple contracts'}</div>
                      <div className="text-[10px] font-bold text-green-700 dark:text-green-400 mt-0.5">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Explanation Content */}
              <div className="flex-1 overflow-y-auto p-5 min-w-0">
                {!selectedExplainRun ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <Sparkles className="h-8 w-8 mb-3 text-orange-300" />
                    <div className="text-sm">Select a run to explain</div>
                    <div className="text-xs mt-1">AI-native breakdown of calculation results</div>
                  </div>
                ) : (() => {
                  const calc = allCalculations.find((c: any) => c.id === selectedExplainRun);
                  if (!calc) return null;
                  const idx = allCalculations.indexOf(calc);
                  return (
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">RUN-{String(allCalculations.length - idx).padStart(3, '0')} — Explanation</h2>

                      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3.5 mb-3 bg-white dark:bg-gray-900">
                        <div className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-orange-600" /> Calculation Summary</div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2.5 text-center"><div className="text-[10px] text-gray-500 mb-1">Total Fee</div><div className="text-sm font-bold text-green-700 dark:text-green-400">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</div></div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2.5 text-center"><div className="text-[10px] text-gray-500 mb-1">Sales Volume</div><div className="text-sm font-bold text-gray-900 dark:text-gray-100">${Number(calc.totalSalesAmount || 0).toLocaleString()}</div></div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2.5 text-center overflow-hidden"><div className="text-[10px] text-gray-500 mb-1">Contract</div><div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate" title={calc.contractName || '—'}>{calc.contractName || '—'}</div></div>
                        </div>
                      </div>

                      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3.5 mb-3 bg-white dark:bg-gray-900">
                        <div className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-orange-600" /> AI-Native Analysis</div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          This calculation applied the contract's fee rules to the uploaded sales data. The total fee of <strong className="text-green-700 dark:text-green-400">${Number(calc.totalRoyalty || calc.totalFee || 0).toLocaleString()}</strong> was computed based on {calc.lineItemCount || 'the'} line items against the configured rule set. Use the liQ AI panel to ask specific questions about rule applications, fee breakdowns, or variance analysis.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setLocation(`/calculations/${calc.id}/report`)} data-testid="button-detailed-report"><FileText className="h-3 w-3 mr-1" /> Detailed Report</Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation(`/calculations/${calc.id}/audit-trail`)} data-testid="button-explain-audit"><BookOpen className="h-3 w-3 mr-1" /> Audit Trail</Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveTab("accruals")} data-testid="button-explain-accruals"><ArrowRight className="h-3 w-3 mr-1" /> View Accruals</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ═══ ACCRUALS TAB ═══ */}
          {activeTab === "accruals" && (
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Accruals</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-accruals-total">{accrualsList.length}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Value</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-accruals-value">${accrualsList.reduce((s: number, a: any) => s + parseFloat(a.amount || "0"), 0).toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Draft</div>
                  <div className="text-lg font-bold text-orange-600" data-testid="text-accruals-draft">{accrualsList.filter((a: any) => a.status === "draft").length}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Posted</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-accruals-posted">{accrualsList.filter((a: any) => a.status === "posted").length}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Accrual ID</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Contract</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Counterparty</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Period</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Amount</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accrualsList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-400">No accruals yet. Run a calculation to generate accruals.</td></tr>
                    ) : accrualsList.slice(0, 20).map((a: any) => (
                      <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`accrual-row-${a.accrualId}`}>
                        <td className="py-2.5 px-4 font-mono text-gray-900 dark:text-gray-100">{a.accrualId}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{a.contractName || '—'}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{a.counterparty || '—'}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{a.period}</td>
                        <td className="py-2.5 px-4 font-bold text-green-700 dark:text-green-400">${Number(a.amount || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-4"><Badge className={`text-[10px] px-1.5 py-0 ${a.status === 'posted' ? 'bg-green-50 text-green-700 border-green-200' : a.status === 'review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{a.status || 'draft'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation('/accrual-management')} data-testid="button-accruals-full-view"><ArrowRight className="h-3 w-3 mr-1" /> Full View</Button>
              </div>
            </div>
          )}

          {/* ═══ JE HUB TAB ═══ */}
          {activeTab === "je" && (
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Entries</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-je-total">{jeSummary?.total || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Amount</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-je-amount">${Number(jeSummary?.totalAmount || 0).toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pending</div>
                  <div className="text-lg font-bold text-orange-600" data-testid="text-je-pending">{jeSummary?.byStage?.pending || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Posted</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-je-posted">{jeSummary?.byStage?.posted || 0}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">JE ID</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Contract</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Counterparty</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Period</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Amount</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jeList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-400">No journal entries yet.</td></tr>
                    ) : jeList.slice(0, 20).map((je: any) => (
                      <tr key={je.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`je-row-${je.jeId}`}>
                        <td className="py-2.5 px-4 font-mono text-gray-900 dark:text-gray-100">{je.jeId}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{je.contractName || '—'}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{je.counterparty || '—'}</td>
                        <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{je.period}</td>
                        <td className="py-2.5 px-4 font-bold text-green-700 dark:text-green-400">${Number(je.totalAmount || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-4"><Badge className={`text-[10px] px-1.5 py-0 ${je.jeStage === 'posted' ? 'bg-green-50 text-green-700 border-green-200' : je.jeStage === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : je.jeStage === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{je.jeStage || 'draft'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation('/journal-entry-hub')} data-testid="button-je-full-view"><ArrowRight className="h-3 w-3 mr-1" /> Full View</Button>
              </div>
            </div>
          )}

          {/* ═══ PERIOD CLOSE TAB ═══ */}
          {activeTab === "period-close" && (
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Periods</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-periods-total">{periodCloseList.length}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Open</div>
                  <div className="text-lg font-bold text-orange-600" data-testid="text-periods-open">{periodCloseList.filter((p: any) => p.status === 'open' || p.status === 'in_progress').length}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Closed</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-periods-closed">{periodCloseList.filter((p: any) => p.status === 'closed').length}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Period</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Status</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Readiness</th>
                      <th className="text-left py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Created</th>
                      <th className="text-right py-2.5 px-4 text-[11px] text-gray-500 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodCloseList.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-400">No fiscal periods configured yet.</td></tr>
                    ) : periodCloseList.slice(0, 20).map((p: any) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`period-row-${p.id}`}>
                        <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100">{p.periodLabel || '—'}</td>
                        <td className="py-2.5 px-4"><Badge className={`text-[10px] px-1.5 py-0 ${p.status === 'closed' ? 'bg-green-50 text-green-700 border-green-200' : p.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{p.status || 'open'}</Badge></td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.readinessScore || 0}%` }} /></div>
                            <span className="text-[10px] text-gray-500 w-8 text-right">{p.readinessScore || 0}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-gray-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Delete period "${p.periodLabel}"? This will remove all checklist items, audit trail, and related data.`)) {
                                deletePeriodMutation.mutate(p.id);
                              }
                            }}
                            disabled={deletePeriodMutation.isPending}
                            data-testid={`button-delete-period-${p.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation('/period-close-workspace')} data-testid="button-period-close-full-view"><ArrowRight className="h-3 w-3 mr-1" /> Full View</Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
