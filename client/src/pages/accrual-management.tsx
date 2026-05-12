import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { openLiqAI } from "@/components/liq-ai-panel";
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
  AlertTriangle,
  FolderOpen,
  Target,
  CheckCircle2,
  Search,
  Download,
  Play,
  Plus,
  Columns3,
  ArrowUpDown,
  Group,
  X,
  Sparkles,
  Clock,
  Loader2,
  ArrowLeft,
  Trash2,
  Calculator,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdjustmentsTab } from "@/components/finance/adjustments-tab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusConfig: Record<string, { label: string; className: string }> = {
  posted: { label: "Posted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  review: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  pending_review: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  pending: { label: "Pending", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  draft: { label: "Draft", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

const flowIcons: Record<string, string> = {
  Rebate: "💰",
  Royalty: "📜",
  Commission: "🤝",
};

function getConfColor(conf: number) {
  if (conf >= 90) return "bg-green-500";
  if (conf >= 75) return "bg-yellow-500";
  return "bg-red-500";
}

function getConfTextColor(conf: number) {
  if (conf >= 90) return "text-green-600 dark:text-green-400";
  if (conf >= 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function AccrualManagementPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flowFilter, setFlowFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Task 68 — deep-link support. The Promoted-obligation Origin link
  // navigates with ?focus=ACC-XXXX so that arriving here pre-selects
  // and opens the right accrual row in the detail panel. Strip the
  // param after consuming it so a back-nav doesn't re-trigger the
  // selection on close.
  useEffect(() => {
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (focus) {
      setSelectedId(focus);
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [location]);

  // Period selector — defaults to "all" so the page no longer pretends
  // a single hard-coded period exists. The dropdown is populated from
  // /api/accruals/periods (distinct labels in the data) and filters
  // every list/insights call server-side via `?period=`.
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const periodParam = selectedPeriod === "all" ? "" : `?period=${encodeURIComponent(selectedPeriod)}`;

  const { data: accruals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/accruals", { period: selectedPeriod }],
    queryFn: async () => {
      const r = await fetch(`/api/accruals${periodParam}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load accruals");
      return r.json();
    },
  });

  const { data: insights } = useQuery<any>({
    queryKey: ["/api/accruals/insights", { period: selectedPeriod }],
    queryFn: async () => {
      const r = await fetch(`/api/accruals/insights${periodParam}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load accrual insights");
      return r.json();
    },
  });

  const { data: periodsData } = useQuery<{ periods: string[] }>({
    queryKey: ["/api/accruals/periods"],
  });
  const availablePeriods = periodsData?.periods || [];

  const { data: selectedDetail } = useQuery<any>({
    queryKey: ["/api/accruals", selectedId],
    enabled: !!selectedId,
  });

  const runCalcMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/accruals/run-calculation"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accruals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accruals/insights"] });
      toast({ title: "Calculation complete", description: "All draft accruals have been processed" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/accruals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accruals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accruals/insights"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/accruals", selectedId] });
      toast({ title: "Status updated" });
    },
  });

  // Adjust dialog — lets finance correct the accrued amount with a
  // mandatory reason. The reason is captured into the audit trail
  // (server side) so we keep an immutable old → new + who + why
  // record. Posted accruals are blocked server-side (409); we surface
  // the reason in the toast.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const adjustMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: string; reason: string }) =>
      apiRequest("PATCH", `/api/accruals/${id}`, { amount, _adjustmentReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accruals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accruals/insights"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/accruals", selectedId] });
      setAdjustOpen(false);
      setAdjustReason("");
      toast({ title: "Accrual adjusted", description: "Audit trail updated." });
    },
    onError: async (err: any) => {
      let description = err?.message || "Could not adjust the accrual.";
      const m = description.match(/^\d+:\s*(.*)$/);
      if (m) {
        try {
          const parsed = JSON.parse(m[1]);
          description = parsed.reason || parsed.error || m[1];
        } catch {
          description = m[1];
        }
      }
      toast({ title: "Adjustment failed", description, variant: "destructive" });
    },
  });

  const deleteAccrualMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/accruals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accruals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accruals/insights"] });
      setSelectedId(null);
      toast({ title: "Accrual deleted", description: "The accrual record has been removed" });
    },
    onError: async (err: any) => {
      // Surface the server's 409 reason (e.g. attempted delete of a
      // posted accrual). apiRequest throws "<status>: <body>" — try
      // to pull the JSON reason out, otherwise show the raw message.
      let description = err?.message || "Could not delete the accrual.";
      const m = description.match(/^\d+:\s*(.*)$/);
      if (m) {
        try {
          const parsed = JSON.parse(m[1]);
          description = parsed.reason || parsed.error || m[1];
        } catch {
          description = m[1];
        }
      }
      toast({ title: "Delete blocked", description, variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/accruals"),
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accruals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accruals/insights"] });
      setSelectedId(null);
      // The server now returns { deleted, skippedPosted, message }; show
      // it verbatim so the user knows when posted rows were preserved.
      let description = "All eligible accrual records have been removed.";
      try {
        const body = await response.json();
        if (body?.message) description = body.message;
      } catch {}
      toast({ title: "Bulk delete complete", description });
    },
  });

  const postedCount = (accruals as any[]).filter(a => a.status === "posted").length;
  const deletableCount = (accruals as any[]).length - postedCount;

  const filteredAccruals = accruals.filter((a: any) => {
    // Flow filter now matches against the contract's flow type code
    // (CRP/VRP/RLA), with a fallback to the legacy free-text
    // accruals.flow_type column so unmigrated rows still respond.
    const flowMatch = flowFilter === "all"
      || a.flowTypeCode === flowFilter
      || a.flowType === flowFilter;
    const statusMatch = statusFilter === "all" || a.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const searchMatch = searchQuery === "" ||
      a.accrualId?.toLowerCase().includes(q) ||
      a.contractName?.toLowerCase().includes(q) ||
      a.contractNumber?.toLowerCase().includes(q) ||
      a.contractDisplayName?.toLowerCase().includes(q) ||
      a.counterparty?.toLowerCase().includes(q);
    return flowMatch && statusMatch && searchMatch;
  });

  // Distinct flow types present in the current accrual list, used to
  // populate the filter dropdown so it always reflects what actually
  // exists rather than a hard-coded list.
  const distinctFlowTypes = (() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const a of accruals as any[]) {
      const code = a.flowTypeCode || a.flowType;
      if (!code) continue;
      if (!seen.has(code)) seen.set(code, { code, name: a.flowTypeName || code });
    }
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  })();

  const selected = selectedDetail || accruals.find((a: any) => a.accrualId === selectedId);

  // Tile cards now reflect the actual workflow stages (Drafts /
  // Pending Review / Posted) plus a real data-quality count, instead
  // of the old AI-confidence proxies that were always 0.
  const insightCards = [
    {
      icon: FolderOpen,
      iconClass: "text-blue-500",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
      num: insights?.drafts ?? 0,
      numClass: "text-blue-600 dark:text-blue-400",
      label: "Drafts",
      sublabel: "Awaiting calculation or review",
    },
    {
      icon: Clock,
      iconClass: "text-yellow-500",
      bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
      num: insights?.pendingReview ?? 0,
      numClass: "text-yellow-600 dark:text-yellow-400",
      label: "Pending Review",
      sublabel: "Awaiting approval to post",
    },
    {
      icon: CheckCircle2,
      iconClass: "text-green-500",
      bgClass: "bg-green-100 dark:bg-green-900/30",
      num: insights?.posted ?? 0,
      numClass: "text-green-600 dark:text-green-400",
      label: "Posted",
      sublabel: "Already in the GL",
    },
    {
      icon: AlertTriangle,
      iconClass: "text-red-500",
      bgClass: "bg-red-100 dark:bg-red-900/30",
      num: insights?.dataIssues ?? 0,
      numClass: "text-red-600 dark:text-red-400",
      label: "Data Issues",
      sublabel: "Zero amount, missing net sales, or unknown rate",
    },
  ];

  // Export the current period as a real .xlsx workbook with the
  // joined contract / flow-type columns the table now shows.
  const handleExport = async () => {
    const qs = new URLSearchParams({ format: "xlsx" });
    if (selectedPeriod !== "all") qs.set("period", selectedPeriod);
    const res = await fetch(`/api/accruals/export?${qs.toString()}`, { method: "POST" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const periodSuffix = selectedPeriod === "all" ? "all-periods" : selectedPeriod.replace(/\s+/g, "-");
    a.download = `accruals-${periodSuffix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Period chip — show the current calendar month in the same
  // "MMM YYYY" form the row data uses (e.g. "Apr 2026"). Was a
  // hard-coded "Mar 2026" string before.
  const currentPeriod = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });

  return (
    <MainLayout title="Accrual Management" description="AI-native accrual tracking, review, and financial control">
      <Link href="/sales-upload?tab=accruals" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2" data-testid="link-back-accruals">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Accruals
      </Link>
      <Tabs defaultValue="accruals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accruals" data-testid="tab-accruals">Accruals</TabsTrigger>
          <TabsTrigger value="adjustments" data-testid="tab-adjustments">Adjustments</TabsTrigger>
        </TabsList>
        <TabsContent value="accruals" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs" data-testid="badge-period">
              📅 {selectedPeriod === "all" ? "All Periods" : selectedPeriod}
            </Badge>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-period">
                <SelectValue placeholder="Choose period…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
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
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-manual-accrual">
              <Plus className="w-4 h-4 mr-1" /> Manual Accrual
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-excel">
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" disabled={deletableCount === 0} data-testid="button-delete-all">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Eligible Accruals?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {deletableCount} draft / pending accrual record(s).
                    {postedCount > 0 && (
                      <> {postedCount} posted accrual(s) will be skipped — they have already produced journal entries and obligations and must be reversed instead.</>
                    )}
                    {" "}This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteAllMutation.mutate()}>
                    {deleteAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => runCalcMutation.mutate()}
              disabled={runCalcMutation.isPending}
              data-testid="button-run-calculation"
            >
              {runCalcMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              Run Calculation
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="pl-9 pr-3 py-2 text-sm border rounded-md bg-background w-56 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Search accruals, contracts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <select className="text-sm border rounded-md px-3 py-2 bg-background text-foreground" value={flowFilter} onChange={(e) => setFlowFilter(e.target.value)} data-testid="select-flow-type">
            <option value="all">All Flow Types</option>
            {distinctFlowTypes.map(ft => (
              <option key={ft.code} value={ft.code}>{ft.code} — {ft.name}</option>
            ))}
          </select>
          <select className="text-sm border rounded-md px-3 py-2 bg-background text-foreground" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-status">
            <option value="all">All Statuses</option>
            <option value="posted">Posted</option>
            <option value="review">Pending Review</option>
            <option value="draft">Draft</option>
          </select>
          <Button variant="outline" size="sm" data-testid="button-ai-filter">
            <Sparkles className="w-4 h-4 mr-1" /> AI Filter
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {insightCards.map((card, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:border-orange-400 transition-colors"
              data-testid={`card-insight-${i}`}
              title={card.sublabel}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bgClass}`}>
                  <card.icon className={`w-5 h-5 ${card.iconClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-2xl font-bold leading-none ${card.numClass}`}>{card.num}</div>
                  <div className="text-xs font-medium text-foreground mt-1">{card.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{card.sublabel}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span className="ml-2 text-sm text-muted-foreground">Loading accruals...</span>
          </div>
        ) : (
        <div className="flex gap-4 min-h-[500px]">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <span className="text-sm font-semibold text-muted-foreground">Accruals</span>
              <Badge variant="outline" className="text-xs">{filteredAccruals.length} records</Badge>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" data-testid="button-columns"><Columns3 className="w-4 h-4 mr-1" /> Columns</Button>
              <Button variant="ghost" size="sm" data-testid="button-sort"><ArrowUpDown className="w-4 h-4 mr-1" /> Sort</Button>
              <Button variant="ghost" size="sm" data-testid="button-group"><Group className="w-4 h-4 mr-1" /> Group</Button>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Accrual ID</TableHead>
                    <TableHead>Contract / Counterparty</TableHead>
                    <TableHead>Flow Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Confidence</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccruals.map((a: any) => {
                    const conf = a.aiConfidence || 0;
                    const status = statusConfig[a.status] || statusConfig.draft;
                    return (
                    <TableRow
                      key={a.accrualId}
                      className={`cursor-pointer ${selectedId === a.accrualId ? "bg-orange-50 dark:bg-orange-900/10 border-l-2 border-l-orange-500" : ""}`}
                      onClick={() => setSelectedId(a.accrualId)}
                      data-testid={`row-accrual-${a.accrualId}`}
                    >
                      <TableCell className="font-semibold text-orange-600 text-xs">{a.accrualId}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm" data-testid={`text-contract-${a.accrualId}`}>
                          {a.contractNumber || a.contractDisplayName || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.contractDisplayName && a.contractNumber
                            ? a.contractDisplayName
                            : a.counterparty}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs gap-1"
                          title={a.flowTypeName || a.flowType || ""}
                          data-testid={`badge-flow-type-${a.accrualId}`}
                        >
                          {flowIcons[a.flowTypeCode || a.flowType] || flowIcons[a.flowType] || ""}{" "}
                          {a.flowTypeCode || a.flowType || "—"}
                        </Badge>
                        {a.flowTypeName && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{a.flowTypeName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.period}</TableCell>
                      <TableCell className="text-right font-semibold">${parseFloat(a.amount || "0").toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${getConfColor(conf)}`} style={{ width: `${conf}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${getConfTextColor(conf)}`}>{conf}%</span>
                          {conf < 75 && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); openLiqAI(`Tell me about accrual ${a.accrualId} for contract "${a.contractName}" with ${a.counterparty}. Amount: $${parseFloat(a.amount || "0").toLocaleString()}, period: ${a.period}.`); }} data-testid={`button-ask-ai-${a.accrualId}`}>
                            <Sparkles className="w-3.5 h-3.5 mr-1" /> Ask AI
                          </Button>
                          {a.contractId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={(e) => { e.stopPropagation(); setLocation(`/calculations/${a.contractId}/report`); }}
                              data-testid={`button-view-calculations-${a.accrualId}`}
                              title="Drill down into the underlying calculations for this accrual's contract"
                            >
                              <Calculator className="w-3.5 h-3.5 mr-1" /> Calcs
                            </Button>
                          )}
                          {a.status === "posted" ? (
                            // Posted accruals have already produced a JE +
                            // obligation downstream — deleting silently breaks
                            // the audit trail. Show a disabled icon with a
                            // tooltip pointing at the proper unwind path.
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="text-xs text-muted-foreground/50 cursor-not-allowed"
                              onClick={(e) => e.stopPropagation()}
                              title="Posted accruals can't be deleted — they're tied to a journal entry and an obligation. Reverse the posting instead."
                              data-testid={`button-delete-disabled-${a.accrualId}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => e.stopPropagation()} data-testid={`button-delete-${a.accrualId}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Accrual {a.accrualId}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove the {a.status} accrual for {a.counterparty} ({a.contractNumber || a.contractDisplayName || a.contractName}) — ${parseFloat(a.amount || "0").toLocaleString()}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteAccrualMutation.mutate(a.accrualId)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="w-80 flex-shrink-0 flex flex-col overflow-hidden" data-testid="panel-detail">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">{selected ? selected.accrualId : "Select an accrual"}</h3>
              {selected && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} data-testid="button-close-detail">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-sm">Click any accrual to view details</div>
              </div>
            ) : (
              <>
                {/* Compact hero — every key fact at a glance, no scrolling
                    needed to see status / flow / contract / counterparty. */}
                <div className="px-4 pt-4 pb-3 border-b">
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent leading-none" data-testid="text-detail-amount">
                    ${parseFloat(selected.amount || "0").toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge className={`text-[10px] ${(statusConfig[selected.status] || statusConfig.draft).className}`} data-testid="badge-detail-status">
                      {(statusConfig[selected.status] || statusConfig.draft).label}
                    </Badge>
                    {(selected.flowTypeCode || selected.flowType) && (
                      <Badge variant="outline" className="text-[10px] gap-1" title={selected.flowTypeName || ""}>
                        {flowIcons[selected.flowTypeCode || selected.flowType] || flowIcons[selected.flowType] || ""}
                        {selected.flowTypeCode || selected.flowType}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${getConfTextColor(selected.aiConfidence || 0)}`}>
                      AI {selected.aiConfidence || 0}%
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 truncate" title={selected.contractDisplayName || selected.contractName || ""}>
                    <span className="font-semibold text-foreground">{selected.contractNumber || "—"}</span>
                    {(selected.contractDisplayName || selected.contractName) && (
                      <span> · {selected.contractDisplayName || selected.contractName}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.counterparty || "—"} · {selected.period}
                  </div>
                </div>

                {/* Tabbed body — same pattern as settlement workspace.
                    Splits the previously-stacked sections into Overview /
                    Calc / Audit / Links so the panel fits in one view. */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                  <TabsList className="grid grid-cols-4 w-full rounded-none border-b h-9 bg-transparent p-0">
                    <TabsTrigger value="overview" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="calc" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none" data-testid="tab-calc">Calc</TabsTrigger>
                    <TabsTrigger value="audit" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none" data-testid="tab-audit">Audit</TabsTrigger>
                    <TabsTrigger value="links" className="text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none" data-testid="tab-links">Links</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-2.5 mt-0">
                    <DetailRow label="Accrual ID" value={selected.accrualId} valueClass="text-orange-600 font-semibold" />
                    <DetailRow
                      label="Flow Type"
                      value={
                        <span title={selected.flowTypeName || ""}>
                          <span className="font-semibold">{selected.flowTypeCode || selected.flowType || "—"}</span>
                          {selected.flowTypeName && <span className="text-muted-foreground"> — {selected.flowTypeName}</span>}
                        </span>
                      }
                    />
                    <DetailRow label="Period" value={selected.period || "—"} />
                    <DetailRow label="Tier" value={selected.tier || "—"} />
                    <DetailRow label="Rate" value={selected.rate || "—"} />
                    <DetailRow label="Counterparty" value={selected.counterparty || "—"} />
                  </TabsContent>

                  <TabsContent value="calc" className="flex-1 overflow-auto p-4 mt-0">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Calculation Trace</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Net Sales</span><span className="font-medium">${parseFloat(selected.netSales || "0").toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Rebate Rate</span><span className="font-medium">{selected.rate || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Threshold Applied</span><span className="font-medium">{selected.tier || "—"}</span></div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Accrual Total</span>
                        <span data-testid="text-calc-total">${parseFloat(selected.amount || "0").toLocaleString()}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="audit" className="flex-1 overflow-auto p-4 mt-0">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Audit Trail</h4>
                    <div className="space-y-3">
                      {selected.auditTrail && selected.auditTrail.length > 0 ? (
                        selected.auditTrail.map((entry: any, idx: number) => (
                          <AuditEntry key={idx} color="bg-orange-500" text={entry.description} time={entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ""} />
                        ))
                      ) : (
                        <>
                          <AuditEntry color="bg-orange-500" text={`Calculation engine ran – ${selected.tier || "standard"} threshold`} time={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : ""} />
                          <AuditEntry color="bg-yellow-500" text={`AI review triggered – confidence ${selected.aiConfidence || 0}%`} time={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : ""} />
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="links" className="flex-1 overflow-auto p-4 mt-0 space-y-4">
                    {selected.contractId && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Drill Down</h4>
                        <Button
                          variant="outline"
                          className="w-full mb-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                          data-testid="button-view-calculations-detail"
                          onClick={() => setLocation(`/calculations/${selected.contractId}/report`)}
                        >
                          <Calculator className="w-3.5 h-3.5 mr-1" /> View Calculation Report
                        </Button>
                        <p className="text-[10px] text-muted-foreground">
                          Every line, rule, and per-period total that rolled up into this accrual.
                        </p>
                      </div>
                    )}

                    {/* Task 68 — cross-link to the promoted obligation/claim. */}
                    {selected.status === "posted" && (
                      <PromotedObligationLink accrualId={selected.accrualId} />
                    )}

                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Explainability</h4>
                      <Button variant="outline" className="w-full mb-2 text-xs" data-testid="button-explain"
                        onClick={() => openLiqAI(`Explain the $${parseFloat(selected.amount || "0").toLocaleString()} accrual calculation for contract "${selected.contractName}". How was this amount calculated? What rules were applied?`)}>
                        🔍 Explain ${parseFloat(selected.amount || "0").toLocaleString()} calculation
                      </Button>
                      <Button variant="ghost" className="w-full text-xs" data-testid="button-ask-ai-detail"
                        onClick={() => openLiqAI(`Tell me about accrual ${selected.accrualId} for contract "${selected.contractName}" with counterparty ${selected.counterparty}. The accrual amount is $${parseFloat(selected.amount || "0").toLocaleString()} for period ${selected.period}.`)}>
                        <Sparkles className="w-3.5 h-3.5 mr-1" /> Ask AI about this accrual
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 p-3 border-t">
                  {(selected.status === "draft" || selected.status === "review" || selected.status === "pending" || selected.status === "pending_review") && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => updateStatusMutation.mutate({ id: selected.accrualId, status: "posted" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-approve"
                      >✓ Approve & Post</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setAdjustAmount(selected.amount || "0");
                          setAdjustReason("");
                          setAdjustOpen(true);
                        }}
                        data-testid="button-adjust"
                      >✎ Adjust</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => updateStatusMutation.mutate({ id: selected.accrualId, status: "draft" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-reject"
                      >✕ Reject</Button>
                    </>
                  )}
                  {selected.status === "posted" && (
                    <div className="flex-1 text-center">
                      <Badge className="bg-green-100 text-green-700 text-xs mb-2">✓ Approved & Posted</Badge>
                      <p className="text-[10px] text-muted-foreground">Linked JE has been moved to Pending. Go to Journal Entry Hub to continue.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs w-full"
                        onClick={() => updateStatusMutation.mutate({ id: selected.accrualId, status: "draft" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-revert"
                      >↩ Revert to Draft</Button>
                    </div>
                  )}
                  {selected.status === "approved" && (
                    <div className="flex-1 text-center">
                      <Badge className="bg-blue-100 text-blue-700 text-xs mb-2">✓ Approved</Badge>
                      <Button
                        size="sm"
                        className="mt-2 text-xs w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => updateStatusMutation.mutate({ id: selected.accrualId, status: "posted" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-post"
                      >📤 Post Accrual</Button>
                    </div>
                  )}
                </div>
                <div className="px-3 pb-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" data-testid="button-delete-selected">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete This Accrual
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selected.accrualId}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the accrual for {selected.counterparty} — ${parseFloat(selected.amount || "0").toLocaleString()}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteAccrualMutation.mutate(selected.accrualId)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </Card>
        </div>
        )}
        </TabsContent>
        <TabsContent value="adjustments">
          <AdjustmentsTab />
        </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-adjust">
          <DialogHeader>
            <DialogTitle>Adjust accrual amount</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  {selected.accrualId} · {selected.contractName} · {selected.period}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Current amount</Label>
              <div className="text-lg font-semibold" data-testid="text-adjust-current">
                ${parseFloat(selected?.amount || "0").toLocaleString()}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-amount">New amount (USD)</Label>
              <Input
                id="adjust-amount"
                type="number"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                data-testid="input-adjust-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-reason">Reason for adjustment</Label>
              <Textarea
                id="adjust-reason"
                placeholder="e.g. Late return credit applied; corrected net sales per Mar reconciliation."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
                data-testid="input-adjust-reason"
              />
              <p className="text-[11px] text-muted-foreground">
                Captured in the audit trail (old → new + your name + reason).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(false)}
              disabled={adjustMutation.isPending}
              data-testid="button-adjust-cancel"
            >Cancel</Button>
            <Button
              onClick={() => {
                if (!selected) return;
                adjustMutation.mutate({
                  id: selected.accrualId,
                  amount: adjustAmount,
                  reason: adjustReason.trim(),
                });
              }}
              disabled={
                adjustMutation.isPending ||
                !adjustReason.trim() ||
                adjustAmount === "" ||
                isNaN(parseFloat(adjustAmount)) ||
                adjustAmount === (selected?.amount || "0")
              }
              data-testid="button-adjust-save"
            >
              {adjustMutation.isPending ? "Saving…" : "Save adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function DetailRow({ label, value, valueClass = "" }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * Task 68 — surface the obligation that a posted accrual was promoted to.
 * The bridge writes accrualId into obligations.sourceAccrualId, so the
 * lookup is `GET /api/obligations?sourceAccrualId=...`. We render either:
 *   - a single deep-link to /outstanding-obligations + the obligation id
 *     and direction (outbound = "Claim outbound", inbound = "Claim inbound"),
 *   - or a soft "no claim yet" hint while the promotion is in flight.
 */
function PromotedObligationLink({ accrualId }: { accrualId: string }) {
  const { data, isLoading } = useQuery<{ obligations: any[] }>({
    queryKey: ["/api/obligations", { sourceAccrualId: accrualId }],
    queryFn: async () => {
      const r = await fetch(`/api/obligations?sourceAccrualId=${encodeURIComponent(accrualId)}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`failed: ${r.status}`);
      return r.json();
    },
  });
  if (isLoading) {
    return (
      <div className="px-3 py-2 border-t text-xs text-muted-foreground" data-testid={`linked-claim-loading-${accrualId}`}>
        Looking up linked claim…
      </div>
    );
  }
  const obl = data?.obligations?.[0];
  if (!obl) {
    return (
      <div className="px-3 py-2 border-t text-xs text-muted-foreground" data-testid={`linked-claim-none-${accrualId}`}>
        No linked claim yet — promotion may still be running.
      </div>
    );
  }
  const dirLabel = obl.direction === "inbound" ? "Inbound claim" : "Outbound claim";
  return (
    <div className="px-3 py-2 border-t bg-orange-50/50" data-testid={`linked-claim-${accrualId}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Linked Claim</div>
      <Link
        href={`/outstanding-obligations?focus=${obl.id}`}
        className="text-xs font-semibold text-orange-700 hover:underline"
        data-testid={`link-claim-${accrualId}`}
      >
        {dirLabel} · {obl.kind} · {obl.status} → {obl.id.slice(0, 8)}
      </Link>
    </div>
  );
}

function AuditEntry({ color, text, time }: { color: string; text: string; time: string }) {
  return (
    <div className="flex gap-2.5">
      <div className={`w-2 h-2 rounded-full ${color} mt-1.5 flex-shrink-0`} />
      <div>
        <div className="text-xs text-foreground">{text}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> {time}
        </div>
      </div>
    </div>
  );
}
