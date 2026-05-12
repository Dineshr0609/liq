import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  FileText,
  X,
  ChevronRight,
  Download,
  Filter,
  Columns,
  ArrowUpDown,
  Layers,
  Check,
  XCircle,
  Minus,
  Loader2,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const stageConfig: Record<string, { label: string; variant: string; classes: string }> = {
  draft: { label: "Draft", variant: "outline", classes: "bg-muted text-muted-foreground border-muted" },
  pending: { label: "Pending Approval", variant: "outline", classes: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" },
  approved: { label: "Approved", variant: "outline", classes: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  synced: { label: "ERP Synced", variant: "outline", classes: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  posted: { label: "Posted", variant: "outline", classes: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" },
  failed: { label: "Failed", variant: "outline", classes: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
};

const erpConfig: Record<string, { label: string; icon: typeof Check; classes: string }> = {
  synced: { label: "Synced", icon: CheckCircle2, classes: "text-green-600 dark:text-green-400" },
  pending: { label: "Pending", icon: Clock, classes: "text-yellow-600 dark:text-yellow-400" },
  failed: { label: "Failed", icon: XCircle, classes: "text-red-600 dark:text-red-400" },
  na: { label: "N/A", icon: Minus, classes: "text-muted-foreground" },
};

const flowIcons: Record<string, string> = {
  Rebate: "💰",
  Royalty: "📜",
  Commission: "🤝",
  "Accrual Rev": "↩",
  "True-up": "⚖️",
  // Flow-type-code variants too, so the joined enrichment renders an
  // icon even when only the code (CRP / VRP / RLA / RBT) is present.
  CRP: "💰", VRP: "💰", RBT: "💰",
  RLA: "📜", ROY: "📜",
  COM: "🤝", CMS: "🤝",
};

// Resolve the human-friendly flow-type label (and optional code chip)
// from the joined `/api/journal-entries` row. Prefers the contract +
// flow-type join (`flowTypeCode` + `flowTypeName`) and only falls back
// to the legacy free-text `flow_type` column when the contract has no
// resolvable flow type.
function resolveFlow(row: any): { code: string | null; label: string; icon: string } {
  const code = row?.flowTypeCode || null;
  const label = row?.flowTypeName || row?.flowType || (code ?? "—");
  const icon = flowIcons[code || ""] || flowIcons[label] || flowIcons[row?.flowType || ""] || "📋";
  return { code, label, icon };
}

// Best contract identity for display: contract number + curated display
// name (or original filename) from the join, falling back to whatever
// got stamped onto journal_entries.contract_name at draft time.
function resolveContract(row: any): { number: string | null; name: string } {
  return {
    number: row?.contractNumber || null,
    name: row?.contractDisplayName || row?.contractName || "—",
  };
}

// Stable utility to extract a server error reason from apiRequest's
// thrown "<status>: <body>" string. Used by mutations to surface 409
// posted-protection messages instead of raw JSON.
function extractServerReason(err: any, fallback: string): string {
  let description = err?.message || fallback;
  const m = description.match(/^\d+:\s*(.*)$/);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      description = parsed.reason || parsed.error || m[1];
    } catch {
      description = m[1];
    }
  }
  return description;
}

export default function JournalEntryHub() {
  const [selectedJE, setSelectedJE] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState("all");
  const [detailTab, setDetailTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState("all");
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  // Period selector — "all" means "show every period". Defaults to
  // "all" so the page no longer pretends only one period exists; the
  // period chip / dropdown lets finance pivot back and forth between
  // periods to review, e.g., last month's posted batch.
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const { toast } = useToast();

  // Period filter is applied server-side via `?period=`. We pass it as
  // a stable query-key segment so React Query caches per period and
  // re-fetches automatically when the user pivots periods.
  const periodParam = selectedPeriod === "all" ? "" : `?period=${encodeURIComponent(selectedPeriod)}`;

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/journal-entries", { period: selectedPeriod }],
    queryFn: async () => {
      const r = await fetch(`/api/journal-entries${periodParam}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load journal entries");
      return r.json();
    },
    staleTime: 0,
  });

  // Deep-link support — period-close Worksheet (and other surfaces)
  // navigate here with `?focus=<jeId>` (the human-readable JE-XXXX
  // code, not the UUID, since that's what list rows are keyed by).
  // Pre-select the entry, scroll it into view, then strip the param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (!focus || !entries || entries.length === 0) return;
    const exists = entries.some((je: any) => je.jeId === focus);
    if (!exists) return;
    setSelectedJE(focus);
    setDetailTab("overview");
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="row-je-${focus}"]`);
      if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [entries]);

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/journal-entries/summary", { period: selectedPeriod }],
    queryFn: async () => {
      const r = await fetch(`/api/journal-entries/summary${periodParam}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load summary");
      return r.json();
    },
  });

  const { data: insightsData } = useQuery<any>({
    queryKey: ["/api/journal-entries/insights", { period: selectedPeriod }],
    queryFn: async () => {
      const r = await fetch(`/api/journal-entries/insights${periodParam}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load insights");
      return r.json();
    },
  });

  // Distinct periods that exist in the data. Sorted recent-first by
  // the server. Used to populate the period dropdown next to the chip.
  const { data: periodsData } = useQuery<{ periods: string[] }>({
    queryKey: ["/api/journal-entries/periods"],
  });
  const availablePeriods = periodsData?.periods || [];

  const { data: selectedDetail } = useQuery<any>({
    queryKey: ["/api/journal-entries", selectedJE],
    enabled: !!selectedJE,
  });

  // Invalidate every period bucket of a base key — needed because each
  // period now lives in its own React Query cache entry.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal-entries/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal-entries/insights"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal-entries/periods"] });
  };

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      apiRequest("PATCH", `/api/journal-entries/${id}/stage`, { stage }),
    onSuccess: () => {
      invalidateAll();
      if (selectedJE) queryClient.invalidateQueries({ queryKey: ["/api/journal-entries", selectedJE] });
      toast({ title: "Stage updated" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/journal-entries/${id}/erp-sync`),
    onSuccess: () => {
      invalidateAll();
      if (selectedJE) queryClient.invalidateQueries({ queryKey: ["/api/journal-entries", selectedJE] });
      toast({ title: "ERP sync completed" });
    },
  });

  // "Bulk Approve Pending" — only pending JEs in the *currently visible*
  // (period-filtered) list. Disable when there are none so the button
  // honestly reflects scope. Server returns the count of rows it
  // actually flipped to "approved", which we surface in the toast.
  const pendingInView = entries.filter((e: any) => e.jeStage === "pending");
  const bulkApproveMutation = useMutation({
    mutationFn: () => {
      const pendingIds = pendingInView.map((e: any) => e.jeId);
      return apiRequest("POST", "/api/journal-entries/bulk-approve", { ids: pendingIds });
    },
    onSuccess: async (res: any) => {
      let updated = pendingInView.length;
      try {
        const body = await res.json();
        if (typeof body?.updated === "number") updated = body.updated;
      } catch {}
      invalidateAll();
      toast({
        title: "Bulk approval complete",
        description: `${updated} pending journal entr${updated === 1 ? "y" : "ies"} approved.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/journal-entries/${id}`),
    onSuccess: (_data, deletedId) => {
      invalidateAll();
      if (selectedJE === deletedId) setSelectedJE(null);
      toast({ title: "Journal entry deleted" });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: extractServerReason(err, "Could not delete the journal entry."),
        variant: "destructive",
      });
    },
  });

  // Distinct flow types present in the loaded entries — used to drive
  // the dropdown so it always reflects what the data actually contains
  // (CRP, VRP, RLA, …) rather than the hard-coded "Rebate / Royalty /
  // Commission" labels that no longer match the new flowTypeCode field.
  const distinctFlowTypes = (() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const je of entries as any[]) {
      const code = je.flowTypeCode || je.flowType;
      if (!code) continue;
      if (!seen.has(code)) seen.set(code, { code, name: je.flowTypeName || code });
    }
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  })();

  const filteredEntries = entries.filter((je: any) => {
    const stageMatch = activeStage === "all" || je.jeStage === activeStage;
    const stageFilterMatch = stageFilter === "all" || je.jeStage === stageFilter;
    // Match against the new code-based field first (CRP/VRP/RLA…) and
    // fall back to the legacy free-text flowType so older rows keep
    // working until they're resaved.
    const flowMatch =
      flowFilter === "all" ||
      je.flowTypeCode === flowFilter ||
      je.flowType === flowFilter;
    const searchMatch =
      searchQuery === "" ||
      je.jeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      je.contractName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      je.contractDisplayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      je.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      je.sourceAccrualId?.toLowerCase().includes(searchQuery.toLowerCase());
    return stageMatch && stageFilterMatch && flowMatch && searchMatch;
  });

  const selectedEntry = selectedDetail || entries.find((je: any) => je.jeId === selectedJE);

  const byStage = summary?.byStage || {};
  // Period chip — show the current calendar month in the same
  // "MMM YYYY" form the row data uses (e.g. "Apr 2026"). Was a
  // hard-coded "Mar 2026" string before.
  const currentPeriod = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
  const pipelineStages = [
    { key: "all", label: "Total JEs", count: summary?.total || entries.length, subtitle: selectedPeriod === "all" ? "All periods" : selectedPeriod, color: "text-foreground" },
    { key: "draft", label: "Draft", count: byStage.draft || 0, subtitle: "Incomplete", color: "text-muted-foreground" },
    { key: "pending", label: "Pending", count: byStage.pending || 0, subtitle: "Needs approval", color: "text-yellow-600 dark:text-yellow-400" },
    { key: "approved", label: "Approved", count: byStage.approved || 0, subtitle: "Ready to sync", color: "text-blue-600 dark:text-blue-400" },
    { key: "synced", label: "ERP Synced", count: byStage.synced || 0, subtitle: "Awaiting post", color: "text-purple-600 dark:text-purple-400" },
    { key: "posted", label: "Posted", count: byStage.posted || 0, subtitle: "Reconciled", color: "text-green-600 dark:text-green-400" },
  ];

  // Honest, status-driven insight tiles — replaces the older deck whose
  // labels ("Approval Overdue", "Accruals → JE Ready") didn't actually
  // describe the underlying counts and whose Total Posted figure came
  // from the visible page filter (it dropped to $0.00M whenever the
  // user pivoted to a non-Posted stage). All counts now come from the
  // server and respect the period filter.
  const totalPostedAmt = insightsData?.totalPosted ?? 0;
  const insightCards = [
    {
      num: String(insightsData?.pendingApproval ?? 0),
      label: "Pending Approval",
      sub: "Awaiting approver action",
      icon: Clock, iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      numColor: "text-yellow-600 dark:text-yellow-400",
    },
    {
      num: String(insightsData?.readyToPost ?? 0),
      label: "Ready to Post",
      sub: "Approved · awaiting GL post",
      icon: RefreshCw, iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      numColor: "text-purple-600 dark:text-purple-400",
    },
    {
      num: String(insightsData?.posted ?? 0),
      label: "Posted",
      sub: `$${(totalPostedAmt / 1_000_000).toFixed(2)}M in GL`,
      icon: CheckCircle2, iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      numColor: "text-green-600 dark:text-green-400",
    },
    {
      num: String(insightsData?.unbalanced ?? 0),
      label: "Unbalanced JEs",
      sub: "DR ≠ CR — needs review",
      icon: AlertTriangle, iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      numColor: "text-red-600 dark:text-red-400",
    },
    {
      num: String(insightsData?.failedSync ?? 0),
      label: "ERP Sync Failed",
      sub: "Retry from row or detail",
      icon: XCircle, iconBg: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      numColor: "text-orange-600 dark:text-orange-400",
    },
    {
      num: String(insightsData?.dataIssues ?? 0),
      label: "Data Issues",
      sub: "Zero amount or unbalanced",
      icon: AlertTriangle, iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      numColor: "text-red-600 dark:text-red-400",
    },
  ];

  // Export the *currently selected period* as a real .xlsx workbook.
  // The xlsx branch on the server returns a binary buffer with the
  // joined contract / flow-type columns the table now shows.
  const handleExport = async () => {
    const qs = new URLSearchParams({ format: "xlsx" });
    if (selectedPeriod !== "all") qs.set("period", selectedPeriod);
    const res = await fetch(`/api/journal-entries/export?${qs.toString()}`, { method: "POST" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const periodSuffix = selectedPeriod === "all" ? "all-periods" : selectedPeriod.replace(/\s+/g, "-");
    a.download = `journal-entries-${periodSuffix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout
      title="Journal Entry Hub"
      description="Draft · Approve · Sync to ERP · Reconcile – AI-native journal workflow"
    >
      <Link href="/sales-upload?tab=je" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2" data-testid="link-back-je-hub">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to JE Hub
      </Link>
      <div className="space-y-4" data-testid="journal-entry-hub">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period chip + selector. The chip shows the current scope
              ("All Periods" or e.g. "Apr 2026") and the dropdown lets
              finance pivot back into a previous period to review. */}
          <Badge variant="outline" className="text-xs" data-testid="badge-period">
            📅 {selectedPeriod === "all" ? "All Periods" : selectedPeriod}
          </Badge>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-period">
              <SelectValue placeholder="Choose period…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {/* Show the current calendar month even if it has no rows
                  yet so the user can pre-scope a brand new period. */}
              {!availablePeriods.includes(currentPeriod) && (
                <SelectItem value={currentPeriod}>{currentPeriod} (current)</SelectItem>
              )}
              {availablePeriods.map((p) => (
                <SelectItem key={p} value={p} data-testid={`select-period-option-${p}`}>
                  {p}{p === currentPeriod ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setDraftModalOpen(true)} data-testid="button-draft-je">
            <FileText className="w-4 h-4 mr-1" /> Draft JE
          </Button>
          <Button variant="outline" size="sm" data-testid="button-sync-erp">
            <RefreshCw className="w-4 h-4 mr-1" /> Sync to ERP
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-1" /> Export to Excel
          </Button>
          <Button
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => bulkApproveMutation.mutate()}
            disabled={bulkApproveMutation.isPending || pendingInView.length === 0}
            data-testid="button-bulk-approve"
            title={
              pendingInView.length === 0
                ? "No pending journal entries in the current view"
                : `Approve ${pendingInView.length} pending journal entr${pendingInView.length === 1 ? "y" : "ies"} in this view`
            }
          >
            {bulkApproveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Bulk Approve Pending {pendingInView.length > 0 ? `(${pendingInView.length})` : ""}
          </Button>
        </div>

        <Card data-testid="pipeline-bar">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {pipelineStages.map((stage, i) => (
                <div key={stage.key} className="flex items-center">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />}
                  <button
                    onClick={() => setActiveStage(stage.key)}
                    className={`flex flex-col items-center px-4 py-2 rounded-lg transition-colors min-w-[100px] ${
                      activeStage === stage.key
                        ? "bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800"
                        : "hover:bg-muted"
                    }`}
                    data-testid={`stage-${stage.key}`}
                  >
                    <span className={`text-xl font-bold ${stage.color}`}>{stage.count}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{stage.subtitle}</span>
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="insight-cards">
          {insightCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i} className="cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 transition-colors" data-testid={`insight-card-${i}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                    <Icon className={`w-[18px] h-[18px] ${card.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xl font-bold leading-none ${card.numColor}`}>{card.num}</div>
                    <div className="text-[11px] font-semibold text-foreground mt-1">{card.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{card.sub}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search JE ID, accrual, contract…"
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm" data-testid="select-stage-filter">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="synced">ERP Synced</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={flowFilter} onValueChange={setFlowFilter}>
            <SelectTrigger className="w-[220px] h-9 text-sm" data-testid="select-flow-filter">
              <SelectValue placeholder="All Flow Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flow Types</SelectItem>
              {distinctFlowTypes.map((ft) => (
                <SelectItem key={ft.code} value={ft.code} data-testid={`select-flow-option-${ft.code}`}>
                  {ft.code} — {ft.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="button-ai-filter">
            <Filter className="w-3.5 h-3.5 mr-1" /> AI Filter
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span className="ml-2 text-sm text-muted-foreground">Loading journal entries...</span>
          </div>
        ) : (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                  <span className="text-xs font-semibold text-muted-foreground">Journal Entries</span>
                  <Badge variant="outline" className="text-[11px]" data-testid="badge-count">
                    {filteredEntries.length} records
                  </Badge>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <Columns className="w-3.5 h-3.5 mr-1" /> Columns
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Sort
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <Layers className="w-3.5 h-3.5 mr-1" /> Group by Flow
                  </Button>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><input type="checkbox" className="rounded" data-testid="checkbox-select-all" /></TableHead>
                        <TableHead className="text-xs">JE ID</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs">Contract / Counterparty</TableHead>
                        <TableHead className="text-xs">Flow Type</TableHead>
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs">Total Amount</TableHead>
                        <TableHead className="text-xs">JE Stage</TableHead>
                        <TableHead className="text-xs">ERP Sync</TableHead>
                        <TableHead className="text-xs">Balanced</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((je: any) => {
                        const stage = stageConfig[je.jeStage] || stageConfig.draft;
                        const erp = erpConfig[je.erpSyncStatus] || erpConfig.na;
                        const ErpIcon = erp.icon;
                        const flow = resolveFlow(je);
                        const contract = resolveContract(je);
                        return (
                          <TableRow
                            key={je.jeId}
                            className={`cursor-pointer ${selectedJE === je.jeId ? "bg-orange-50/50 dark:bg-orange-900/10 border-l-2 border-l-orange-500" : ""}`}
                            onClick={() => { setSelectedJE(je.jeId); setDetailTab("overview"); }}
                            data-testid={`row-je-${je.jeId}`}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="rounded" data-testid={`checkbox-je-${je.jeId}`} />
                            </TableCell>
                            <TableCell className="font-semibold text-orange-600 dark:text-orange-400 text-xs" data-testid={`text-je-id-${je.jeId}`}>
                              {je.jeId}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {je.sourceAccrualId ? (
                                // Drill-down — clicking the source chip
                                // takes the user straight to the original
                                // accrual with its detail panel pre-opened
                                // (Accrual Mgmt consumes ?focus=ACC-XXXX).
                                <Link
                                  href={`/accrual-management?focus=${encodeURIComponent(je.sourceAccrualId)}`}
                                  data-testid={`link-source-${je.jeId}`}
                                >
                                  <Badge variant="outline" className="text-xs font-normal cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-300 dark:hover:border-orange-700">
                                    {je.sourceAccrualId}
                                  </Badge>
                                </Link>
                              ) : (
                                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Manual</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm" data-testid={`text-contract-${je.jeId}`}>
                                {contract.number ? <span className="text-muted-foreground font-normal mr-1">{contract.number}</span> : null}
                                {contract.name}
                              </div>
                              <div className="text-xs text-muted-foreground">{je.counterparty || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-normal" data-testid={`badge-flow-${je.jeId}`}>
                                {flow.icon} {flow.code ? <span className="font-semibold mr-1">{flow.code}</span> : null}{flow.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{je.period}</TableCell>
                            <TableCell className="font-semibold text-sm" data-testid={`text-amount-${je.jeId}`}>
                              ${parseFloat(je.totalAmount || "0").toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${stage.classes}`}>
                                {stage.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 text-xs ${erp.classes}`}>
                                <ErpIcon className="w-3.5 h-3.5" /> {erp.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              {je.balanced ? (
                                <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Balanced
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400 text-xs flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Unbalanced
                                </span>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                {je.jeStage === "draft" && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[11px] text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
                                    onClick={() => stageMutation.mutate({ id: je.jeId, stage: "pending" })}
                                    data-testid={`button-submit-${je.jeId}`}
                                  >
                                    <Check className="w-3 h-3 mr-0.5" /> Submit
                                  </Button>
                                )}
                                {je.jeStage === "pending" && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[11px] text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                                    onClick={() => stageMutation.mutate({ id: je.jeId, stage: "approved" })}
                                    data-testid={`button-approve-${je.jeId}`}
                                  >
                                    <Check className="w-3 h-3 mr-0.5" /> Approve
                                  </Button>
                                )}
                                {je.jeStage === "approved" && je.erpSyncStatus !== "synced" && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[11px] text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/20"
                                    onClick={() => syncMutation.mutate(je.jeId)}
                                    data-testid={`button-sync-${je.jeId}`}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-0.5" /> Sync
                                  </Button>
                                )}
                                {je.jeStage === "approved" && je.erpSyncStatus === "synced" && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[11px] text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                                    onClick={() => stageMutation.mutate({ id: je.jeId, stage: "posted" })}
                                    data-testid={`button-post-${je.jeId}`}
                                  >
                                    <Check className="w-3 h-3 mr-0.5" /> Post
                                  </Button>
                                )}
                                {je.erpSyncStatus === "failed" && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[11px] text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
                                    onClick={() => syncMutation.mutate(je.jeId)}
                                    data-testid={`button-fix-${je.jeId}`}
                                  >
                                    <AlertTriangle className="w-3 h-3 mr-0.5" /> Fix
                                  </Button>
                                )}
                                {/* Posted JEs are part of the GL audit
                                    record — the server returns 409 on
                                    delete, so we hide the trash here too
                                    and surface a "Posted · locked" hint
                                    instead of a button that always fails. */}
                                {je.jeStage === "posted" ? (
                                  <span
                                    className="text-[10px] text-muted-foreground italic"
                                    data-testid={`text-locked-${je.jeId}`}
                                    title="Posted journal entries cannot be deleted — reverse them instead."
                                  >
                                    Posted · locked
                                  </span>
                                ) : (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                    onClick={() => {
                                      if (confirm(`Delete journal entry ${je.jeId}?`)) {
                                        deleteMutation.mutate(je.jeId);
                                      }
                                    }}
                                    data-testid={`button-delete-je-${je.jeId}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedEntry && (
            <div className="w-[340px] flex-shrink-0" data-testid="detail-panel">
              <Card className="h-full">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="flex items-center gap-2 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold flex-1" data-testid="text-detail-title">{selectedEntry.jeId}</h3>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedJE(null)} data-testid="button-close-detail">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex border-b">
                    {["overview", "lines", "erp", "recon"].map((tab) => (
                      <button
                        key={tab}
                        className={`flex-1 py-2 text-center text-[11px] font-medium border-b-2 transition-colors ${
                          detailTab === tab
                            ? "text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400"
                            : "text-muted-foreground border-transparent hover:text-foreground"
                        }`}
                        onClick={() => setDetailTab(tab)}
                        data-testid={`tab-${tab}`}
                      >
                        {tab === "overview" ? "Overview" : tab === "lines" ? "JE Lines" : tab === "erp" ? "ERP Sync" : "Reconciliation"}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {detailTab === "overview" && <DetailOverview entry={selectedEntry} />}
                    {detailTab === "lines" && <DetailLines entry={selectedEntry} />}
                    {detailTab === "erp" && <DetailERP entry={selectedEntry} />}
                    {detailTab === "recon" && <DetailRecon entry={selectedEntry} />}
                  </div>
                  <div className="border-t p-3 flex flex-col gap-1.5">
                    {selectedEntry.jeStage === "draft" && (
                      <Button
                        size="sm" className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs"
                        onClick={() => stageMutation.mutate({ id: selectedEntry.jeId, stage: "pending" })}
                        data-testid="button-detail-submit"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Submit for Approval
                      </Button>
                    )}
                    {selectedEntry.jeStage === "pending" && (
                      <Button
                        size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => stageMutation.mutate({ id: selectedEntry.jeId, stage: "approved" })}
                        data-testid="button-detail-approve"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve Journal Entry
                      </Button>
                    )}
                    {selectedEntry.jeStage === "approved" && selectedEntry.erpSyncStatus !== "synced" && (
                      <Button
                        size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                        onClick={() => syncMutation.mutate(selectedEntry.jeId)}
                        data-testid="button-detail-sync"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync to ERP
                      </Button>
                    )}
                    {selectedEntry.jeStage === "approved" && selectedEntry.erpSyncStatus === "synced" && (
                      <Button
                        size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => stageMutation.mutate({ id: selectedEntry.jeId, stage: "posted" })}
                        data-testid="button-detail-post"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Post to GL
                      </Button>
                    )}
                    {selectedEntry.jeStage === "posted" && (
                      <div className="text-center">
                        <Badge className="bg-green-100 text-green-700 text-xs">✓ Posted to GL</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">Journal entry is finalized and posted.</p>
                      </div>
                    )}
                    {selectedEntry.erpSyncStatus === "failed" && (
                      <Button
                        size="sm" variant="outline" className="w-full text-orange-600 border-orange-200 text-xs"
                        onClick={() => syncMutation.mutate(selectedEntry.jeId)}
                        data-testid="button-detail-retry"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry ERP Sync
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        )}
      </div>

      <Dialog open={draftModalOpen} onOpenChange={setDraftModalOpen}>
        <DialogContent className="max-w-xl" data-testid="dialog-draft-je">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Draft Journal Entry
              <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20 uppercase tracking-wider ml-1">
                AI Assisted
              </Badge>
            </DialogTitle>
            <DialogDescription>Create a new journal entry from accrual source or manually</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source Accrual</label>
                <Select>
                  <SelectTrigger className="text-sm" data-testid="select-source-accrual">
                    <SelectValue placeholder="Select accrual source…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual (no source accrual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period</label>
                <Input defaultValue={currentPeriod} className="text-sm" data-testid="input-period" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flow Type</label>
                <Select>
                  <SelectTrigger className="text-sm" data-testid="select-flow-type">
                    <SelectValue placeholder="Rebate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rebate">Rebate</SelectItem>
                    <SelectItem value="royalty">Royalty</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="accrual-reversal">Accrual Reversal</SelectItem>
                    <SelectItem value="true-up">True-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Amount</label>
                <Input type="number" placeholder="0.00" className="text-sm" data-testid="input-amount" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftModalOpen(false)} data-testid="button-cancel-draft">Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" data-testid="button-create-je">Create JE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function DetailOverview({ entry }: { entry: any }) {
  const stage = stageConfig[entry.jeStage] || stageConfig.draft;
  const erp = erpConfig[entry.erpSyncStatus] || erpConfig.na;
  const flow = resolveFlow(entry);
  const contract = resolveContract(entry);
  return (
    <div className="space-y-4">
      {/* Compact hero — large amount, instantly-readable status chips
          (balanced, flow, stage, ERP) and a one-liner contract identity.
          Replaces the previous flat list of key-value rows. */}
      <div className="pb-4 border-b">
        <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent text-center" data-testid="text-detail-amount">
          ${parseFloat(entry.totalAmount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-muted-foreground text-center mt-1">
          <span className="font-semibold text-orange-600 dark:text-orange-400">{entry.jeId}</span> · {entry.period}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
          <Badge variant="outline" className="text-[10px] font-normal">
            {flow.icon} {flow.code ? <span className="font-semibold mr-0.5">{flow.code}</span> : null}{flow.label}
          </Badge>
          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${stage.classes}`}>
            {stage.label}
          </span>
          {entry.balanced ? (
            <Badge variant="outline" className="text-[10px] font-normal text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
              <Check className="w-3 h-3 mr-0.5" /> Balanced
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-normal text-red-700 border-red-300 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              <AlertTriangle className="w-3 h-3 mr-0.5" /> Unbalanced
            </Badge>
          )}
        </div>
      </div>

      {/* Contract identity — number on top, curated display name and
          counterparty underneath. Mirrors the table cell. */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Contract</div>
        {contract.number && (
          <div className="text-[11px] text-muted-foreground font-mono">{contract.number}</div>
        )}
        <div className="text-sm font-medium" data-testid="text-detail-contract">{contract.name}</div>
        <div className="text-xs text-muted-foreground">{entry.counterparty || "—"}</div>
      </div>

      {/* Drill-down links — let finance jump from the JE detail back
          to the source accrual / its calculation report. The "Posted"
          row also shows a hint that the entry is locked in the GL. */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Drill-down</div>
        {entry.sourceAccrualId && entry.sourceAccrualExists ? (
          <>
            <Link
              href={`/accrual-management?focus=${encodeURIComponent(entry.sourceAccrualId)}`}
              data-testid="link-detail-source-accrual"
            >
              <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> View Source Accrual</span>
                <span className="text-muted-foreground">{entry.sourceAccrualId}</span>
              </Button>
            </Link>
            {/* Calculation Report — same target the Accrual Management
                detail panel uses (`/calculations/{contractId}/report`),
                which renders CalculationReportView for the most recent
                calculation on that contract. The accrual detour was
                wrong; it just sent the user back to the same page. */}
            {entry.contractId && (
              <Link
                href={`/calculations/${entry.contractId}/report`}
                data-testid="link-detail-calc-report"
              >
                <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Calculation Report</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </Link>
            )}
          </>
        ) : entry.sourceAccrualId ? (
          <div className="text-[11px] text-muted-foreground italic px-2 py-1.5 border rounded-md bg-muted/30">
            Source accrual <span className="font-mono">{entry.sourceAccrualId}</span> is no longer available.
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground italic px-2 py-1.5 border rounded-md bg-muted/30">
            Manual journal entry · no source accrual.
          </div>
        )}
      </div>

      {/* ERP target / status row — kept compact; full sync history
          lives on the ERP tab. */}
      <div className="flex justify-between items-center text-xs pt-1 border-t">
        <span className="text-muted-foreground">ERP target</span>
        <span className={`flex items-center gap-1 ${erp.classes}`}>
          <span>SAP</span><span>·</span><span>{erp.label}</span>
        </span>
      </div>
    </div>
  );
}

function DetailLines({ entry }: { entry: any }) {
  const lines = entry.lines || [];
  const totalDr = lines.reduce((s: number, l: any) => s + parseFloat(l.debitAmount || "0"), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + parseFloat(l.creditAmount || "0"), 0);
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DR / CR Line Items</div>
      {lines.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">No line items recorded</div>
      ) : (
        <div className="space-y-2">
          {lines.map((line: any, idx: number) => {
            const isDr = parseFloat(line.debitAmount || "0") > 0;
            return (
              <div key={idx} className={`flex items-center justify-between p-2.5 rounded-md border text-xs ${isDr ? "border-l-2 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "border-l-2 border-l-green-500 bg-green-50/50 dark:bg-green-900/10"}`} data-testid={`je-line-${idx}`}>
                <div>
                  <div className="font-semibold">{line.accountName}</div>
                  <div className="text-muted-foreground">{line.accountCode}</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={`text-[10px] font-bold ${isDr ? "text-blue-700 border-blue-300" : "text-green-700 border-green-300"}`}>
                    {isDr ? "DR" : "CR"}
                  </Badge>
                  <div className="font-bold mt-0.5">${parseFloat(isDr ? line.debitAmount : line.creditAmount).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
          <div className="border-t pt-2 flex justify-between text-xs font-bold">
            <span>Total DR: ${totalDr.toLocaleString()}</span>
            <span>Total CR: ${totalCr.toLocaleString()}</span>
          </div>
          {Math.abs(totalDr - totalCr) > 0.01 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Imbalance: ${Math.abs(totalDr - totalCr).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailERP({ entry }: { entry: any }) {
  const syncLogs = entry.syncLogs || [];
  const erp = erpConfig[entry.erpSyncStatus] || erpConfig.na;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ERP Sync Status</div>
      <div className={`p-3 rounded-md border ${entry.erpSyncStatus === "synced" ? "bg-green-50 dark:bg-green-900/10 border-green-200" : entry.erpSyncStatus === "failed" ? "bg-red-50 dark:bg-red-900/10 border-red-200" : "bg-muted/50"}`}>
        <div className={`text-sm font-semibold ${erp.classes}`}>{erp.label}</div>
        <div className="text-xs text-muted-foreground mt-1">Target: SAP</div>
      </div>
      {syncLogs.length > 0 && (
        <>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Sync History</div>
          {syncLogs.map((log: any, idx: number) => (
            <div key={idx} className="text-xs p-2 border rounded-md">
              <div className="flex justify-between">
                <span className={log.syncStatus === "synced" ? "text-green-600" : "text-red-600"}>{log.syncStatus}</span>
                <span className="text-muted-foreground">{log.syncedAt ? new Date(log.syncedAt).toLocaleString() : ""}</span>
              </div>
              {log.errorMessage && <div className="text-red-500 mt-1">{log.errorMessage}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DetailRecon({ entry }: { entry: any }) {
  const recon = entry.reconciliation;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reconciliation</div>
      {!recon ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <div className="text-2xl mb-2">📊</div>
          No reconciliation data available yet
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">LiQ Amount</span><span className="font-medium">${parseFloat(recon.liqAmount || "0").toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">ERP Posted</span><span className="font-medium">${parseFloat(recon.erpPostedAmount || "0").toLocaleString()}</span></div>
          <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Variance</span><span className="font-bold">${parseFloat(recon.variance || "0").toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reconciled</span><span>{recon.reconciled ? "✓ Yes" : "✗ No"}</span></div>
        </div>
      )}
    </div>
  );
}
