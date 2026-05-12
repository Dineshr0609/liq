import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Download, Sparkles, MoreHorizontal, CheckCircle2, AlertTriangle, Clock,
  Calculator, BookOpen, Handshake, Wallet, Inbox, ArrowLeftRight, Receipt,
  ShieldCheck, Building2, Settings2, ArrowUpDown, Check, X, Send, RefreshCw,
  TrendingUp, ArrowUpRight, Pin, Bot, Loader2, Lock,
} from "lucide-react";

type RowStatus = "ok" | "pending" | "blocked" | "na";

interface ObligationRow {
  id: string;
  contractId: string | null;
  partnerName: string | null;
  kind: string | null;
  amount: string | number | null;
  outstandingAmount: string | number | null;
  currency: string | null;
  status: string | null;
  contractName: string | null;
  flowTypeCode: string | null;
  flowTypeName: string | null;
  accrualStatus: string | null;
  accrualConfidence: number | null;
  jeStatus: string | null;
  jeBalanced: boolean | null;
  linkedJournalEntryId: string | null;
  linkedJeCode: string | null;
  linkedSettlementId: string | null;
  settlementStatus: string | null;
  settlementMatchStatus: string | null;
  linkedClaimId: string | null;
  claimStatus: string | null;
  claimDispute: string | null;
  linkedDeductionId: string | null;
  deductionStatus: string | null;
  linkedFinanceDocumentId: string | null;
  invoiceStatus: string | null;
  invoiceOracleStatus: string | null;
  hasBlocker: boolean;
  hasPendingDecision: boolean;
}

interface InsightsResponse {
  periodId: string;
  periodLabel: string;
  contractsByFlow: {
    rows: { flowCode: string; flowName: string; contracts: number; amount: number; pct: number }[];
    totals: { contracts: number; amount: number };
  };
  periodVsPeriod: {
    currentLabel: string;
    currentAmount: number;
    priorMonth: { label: string; amount: number; deltaPct: number | null } | null;
    yoy: { label: string; amount: number; deltaPct: number | null } | null;
    ytd: {
      current: { label: string; amount: number };
      prior: { label: string; amount: number };
      deltaPct: number | null;
    } | null;
    sparkline: { label: string; value: number }[];
  };
  pinnedKpis: any[];
}

interface AskResult {
  resultId: string;
  naturalLanguageAnswer: string;
  citedObligationIds: string[];
  suggestedChart: string | null;
  severity: "info" | "warn" | "critical" | null;
  queryPlan: any | null;
  canPin: boolean;
  pinRejectionReason: string | null;
  modelProvider: string;
  modelName: string;
  evaluatedResult: { value: number | null; dimensions?: { key: string; value: number }[] } | null;
}

const ICON: Record<RowStatus, React.ReactNode> = {
  ok:      <CheckCircle2 className="w-3 h-3 text-green-600 inline" />,
  pending: <Clock className="w-3 h-3 text-yellow-600 inline" />,
  blocked: <AlertTriangle className="w-3 h-3 text-red-600 inline" />,
  na:      <span className="inline-block w-3 h-3 text-gray-300 text-[10px]">—</span>,
};

interface FlowTypeMeta { id: string; code: string; name: string; isActive: boolean }

const STATUS_FILTERS: { label: string; codes: string[]; tone?: "yellow" | "red" | "orange" | "green" }[] = [
  { label: "All",      codes: [] },
  { label: "Pending",  codes: ["calculated", "approved"], tone: "yellow" },
  { label: "Blocked",  codes: ["disputed"], tone: "red" },
  { label: "Settled",  codes: ["paid"], tone: "green" },
  { label: "Claimable",codes: ["claimable", "claimed"], tone: "orange" },
];

const fmt = (n: number | null | undefined) => {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v === 0) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toLocaleString()}`;
};

const num = (n: any) => Number(n ?? 0) || 0;

// Map status enums coming back from the obligations endpoint into the
// 4-state visual signal the mockup designed for. This keeps the worksheet
// readable without forcing every column to know our internal vocabulary.
const accrualSignal = (r: ObligationRow): RowStatus => {
  if (r.hasBlocker) return "blocked";
  if (!r.accrualStatus || r.accrualStatus === "draft" || r.accrualStatus === "calculated") return "pending";
  return "ok";
};
const jeSignal = (r: ObligationRow): RowStatus => {
  if (!r.linkedJournalEntryId) return "na";
  if (r.jeStatus === "draft" || r.jeStatus === null) return "blocked";
  if (r.jeStatus === "posted") return "ok";
  return "pending";
};
const settleSignal = (r: ObligationRow): RowStatus => {
  if (!r.settlementStatus) return "na";
  if (r.settlementStatus === "settled" || r.settlementStatus === "matched") return "ok";
  if (r.settlementStatus === "disputed") return "blocked";
  return "pending";
};
const claimSignal = (r: ObligationRow): RowStatus => {
  if (!r.claimStatus) return "na";
  if (r.claimDispute && r.claimDispute !== "none") return "blocked";
  if (r.claimStatus === "approved" || r.claimStatus === "paid") return "ok";
  return "pending";
};
const dedSignal = (r: ObligationRow): RowStatus => {
  if (!r.deductionStatus) return "na";
  if (r.deductionStatus === "matched" || r.deductionStatus === "recovered") return "ok";
  if (r.deductionStatus === "disputed") return "blocked";
  return "pending";
};
const invoiceSignal = (r: ObligationRow): RowStatus => {
  if (!r.invoiceStatus) return "na";
  if (r.invoiceStatus === "paid" || r.invoiceStatus === "issued") return "ok";
  if (r.invoiceStatus === "overdue") return "blocked";
  return "pending";
};

const FLOW_COLOR: Record<string, string> = {
  VRP: "bg-orange-500",
  CRP: "bg-amber-500",
  RLA: "bg-purple-500",
  SUB: "bg-teal-500",
  RSM: "bg-blue-500",
  OEM: "bg-emerald-500",
};

interface WorksheetViewProps {
  periodId: string;
  periodLabel: string;
  blockers: any[];
  /** One-shot deep-link from the Co-Pilot's Live Subledger panel. Must match
   *  a label in `STATUS_FILTERS`; ignored otherwise. */
  initialStatus?: string;
  onInitialStatusConsumed?: () => void;
  onSwitchToCopilot: () => void;
}

export default function WorksheetView({
  periodId,
  periodLabel,
  blockers,
  initialStatus,
  onInitialStatusConsumed,
  onSwitchToCopilot,
}: WorksheetViewProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFlow, setActiveFlow] = useState("");
  const [activeStatus, setActiveStatus] = useState<string>(() => {
    // Adopt the deep-link hint at first mount so the grid query fires
    // already-filtered (no flicker between All → Pending).
    if (initialStatus && STATUS_FILTERS.some(s => s.label === initialStatus)) {
      return initialStatus;
    }
    return "All";
  });
  const [search, setSearch] = useState("");

  // Re-apply the hint when the user re-clicks a different stage row from
  // the Co-Pilot panel without leaving the workspace. Notify the parent
  // afterwards so it can clear the prop and stop overriding manual filter
  // chip clicks on subsequent view-toggles.
  useEffect(() => {
    if (initialStatus && STATUS_FILTERS.some(s => s.label === initialStatus)) {
      setActiveStatus(initialStatus);
    }
    if (initialStatus !== undefined) {
      onInitialStatusConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);
  const [askDraft, setAskDraft] = useState("");
  const [askResult, setAskResult] = useState<AskResult | null>(null);

  const statusCsv = useMemo(() => {
    const f = STATUS_FILTERS.find(s => s.label === activeStatus);
    return f && f.codes.length > 0 ? f.codes.join(",") : "";
  }, [activeStatus]);

  const obligationsKey = useMemo(
    () => ["/api/period-close", periodId, "obligations", { flow: activeFlow, status: statusCsv, search }],
    [periodId, activeFlow, statusCsv, search],
  );

  const { data: obligationsData, isLoading: obligationsLoading } = useQuery<{ rows: ObligationRow[]; meta: any }>({
    queryKey: obligationsKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (activeFlow) params.set("flow", activeFlow);
      if (statusCsv) params.set("status", statusCsv);
      if (search) params.set("search", search);
      const res = await fetch(`/api/period-close/${periodId}/obligations?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load obligations");
      return res.json();
    },
    enabled: !!periodId,
  });

  // Live flow-type catalog — drives the FLOW filter chips so they always match
  // what's actually in flow_types (currently CRP, VRP, RLA, SUB, RSM, OEM).
  const { data: flowTypes = [] } = useQuery<FlowTypeMeta[]>({
    queryKey: ["/api/pipeline/flow-types"],
    staleTime: 5 * 60_000,
  });
  const flowChips = useMemo(() => {
    const live = (flowTypes || [])
      .filter((f) => f?.isActive !== false)
      .map((f) => ({ label: f.name, code: String(f.code).toUpperCase() }));
    return [{ label: "All flows", code: "" }, ...live];
  }, [flowTypes]);

  const { data: insights, isLoading: insightsLoading } = useQuery<InsightsResponse>({
    queryKey: ["/api/period-close", periodId, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/period-close/${periodId}/insights`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load insights");
      return res.json();
    },
    enabled: !!periodId,
  });

  const rows = obligationsData?.rows ?? [];
  const totalRows = obligationsData?.meta?.hasNext ? `${rows.length}+` : `${rows.length}`;

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };

  const totalAccrual = rows.reduce((s, r) => s + num(r.amount), 0);
  const totalSettled = rows.reduce((s, r) => settleSignal(r) === "ok" ? s + num(r.amount) : s, 0);
  const selectedRows = rows.filter(r => selected.has(r.id));
  const selectedAccrual = selectedRows.reduce((s, r) => s + num(r.amount), 0);

  // --- Batch mutations -----------------------------------------------------
  const runBatch = async (path: string, body: any, label: string) => {
    const idemp = crypto.randomUUID();
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemp,
          "X-Initiated-Via": "worksheet",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `${label} failed`);
      const summary = data.resultSummary || {};
      const failedCount = (summary.errors || []).length;
      const succeededCount = (summary.succeeded || summary.processed || []).length;
      toast({
        title: data.replayed ? `${label} (cached)` : label,
        description: `${succeededCount} succeeded${failedCount ? ` · ${failedCount} failed` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close", periodId] });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close/latest"] });
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e.message, variant: "destructive" });
    }
  };

  const postJEsMut = useMutation({
    mutationFn: () => runBatch("/api/finance/batch/post-jes",
      { obligationIds: Array.from(selected), periodId }, "Post JEs"),
  });
  const settleMut = useMutation({
    mutationFn: () => runBatch("/api/finance/batch/settle",
      { obligationIds: Array.from(selected), periodId, settlementMethod: "wire" }, "Approve settlements"),
  });
  const resolveClaimsMut = useMutation({
    mutationFn: () => {
      // The resolve-claims endpoint takes claim IDs; we map selected
      // obligations → their backing claim IDs. Where no claim exists the
      // server reports a per-item error which we surface in the toast.
      const claimIds = selectedRows
        .filter(r => r.claimStatus)
        .map(r => r.id); // server resolves by obligation→claim join
      return runBatch("/api/finance/batch/resolve-claims",
        { claimIds, resolution: "approve", periodId }, "Resolve claims");
    },
  });

  const resolveBlockerMut = useMutation({
    mutationFn: (blockerId: string) =>
      apiRequest("PATCH", `/api/period-close/blockers/${blockerId}/resolve`),
    onSuccess: () => {
      toast({ title: "Blocker resolved" });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close/latest"] });
    },
    onError: (e: any) => toast({ title: "Resolve failed", description: e.message, variant: "destructive" }),
  });

  // --- Ask LedgerIQ --------------------------------------------------------
  const askMut = useMutation({
    mutationFn: async (prompt: string): Promise<AskResult> => {
      const res = await apiRequest("POST", "/api/finance/kpi-ask", { prompt, periodId });
      return res.json();
    },
    onSuccess: (data) => setAskResult(data),
    onError: (e: any) => toast({ title: "Ask LedgerIQ failed", description: e.message, variant: "destructive" }),
  });
  const pinMut = useMutation({
    mutationFn: async (resultId: string) => {
      const res = await apiRequest("POST", `/api/finance/kpi-ask/${resultId}/pin`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pinned to dashboard" });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close", periodId, "insights"] });
      setAskResult(null);
      setAskDraft("");
    },
    onError: (e: any) => toast({ title: "Pin failed", description: e.message, variant: "destructive" }),
  });

  const unpinMut = useMutation({
    mutationFn: async (pinId: string) => {
      const res = await apiRequest("DELETE", `/api/finance/pinned-kpis/${pinId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pin removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close", periodId, "insights"] });
    },
    onError: (e: any) => toast({ title: "Unpin failed", description: e.message, variant: "destructive" }),
  });

  // --- Readiness gates -----------------------------------------------------
  const accrualOk = rows.length > 0 && rows.every(r => accrualSignal(r) !== "pending");
  const jesOk = rows.every(r => jeSignal(r) !== "blocked");
  const blockersCleared = blockers.filter((b: any) => !b.resolved && b.severity === "critical").length === 0;
  const gates = [
    { l: "Accruals 100% calc'd", ok: accrualOk, sub: accrualOk ? "all calculated" : `${rows.filter(r => accrualSignal(r)==="pending").length} pending` },
    { l: "All JEs posted",        ok: jesOk,    sub: jesOk ? "all posted" : `${rows.filter(r => jeSignal(r)==="blocked").length} in draft` },
    { l: "Critical blockers cleared", ok: blockersCleared, sub: blockersCleared ? "0 critical open" : `${blockers.filter((b:any)=>!b.resolved && b.severity==="critical").length} critical open` },
    { l: "Audit trail captured",  ok: true,     sub: "auto" },
  ];
  const gatesPassed = gates.filter(g => g.ok).length;
  const allGatesPass = gatesPassed === gates.length;

  return (
    <div className="bg-[hsl(43,26%,95%)] dark:bg-gray-950 text-[hsl(240,20%,5%)] dark:text-gray-100 p-3 -m-4 min-h-screen font-sans">
      <div className="max-w-[1480px] mx-auto space-y-3">
        {/* Compact header — period + SLA + search + actions */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 shadow-sm flex items-center gap-3 flex-wrap" data-testid="header-worksheet">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Contract Subledger Worksheet
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight" data-testid="text-period-label">
              {periodLabel} · {totalRows} obligations
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search obligations, contracts, partners…"
                className="text-[11px] h-8 pl-7 pr-2 w-72 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                data-testid="input-search"
              />
            </div>
            <button
              onClick={onSwitchToCopilot}
              className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1"
              data-testid="button-switch-copilot"
            >
              <Bot className="w-3 h-3 text-orange-600" /> Switch to Co-Pilot
            </button>
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> Columns
            </button>
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 shadow-sm flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2">Flow</span>
          {flowChips.map((f) => (
            <button
              key={f.code || "all"}
              onClick={() => setActiveFlow(f.code)}
              className={`text-[11px] h-7 px-3 rounded-full border transition-colors ${
                activeFlow === f.code
                  ? "bg-orange-100 border-orange-300 text-orange-800 font-semibold"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              data-testid={`chip-flow-${f.code || "all"}`}
            >
              {f.label}
            </button>
          ))}
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2">Status</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => setActiveStatus(s.label)}
              className={`text-[11px] h-7 px-3 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                activeStatus === s.label
                  ? "bg-orange-100 border-orange-300 text-orange-800 font-semibold"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              data-testid={`chip-status-${s.label.toLowerCase()}`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => { setActiveFlow(""); setActiveStatus("All"); setSearch(""); }}
            className="ml-auto text-[11px] text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"
            data-testid="button-reset-filters"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>

        {/* Insights strip */}
        <div className="grid grid-cols-12 gap-3">
          {/* Tile 1: Active Contracts by Flow */}
          <div className="col-span-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="tile-contracts-by-flow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Active Contracts · by flow
              </div>
              <div className="text-[10px] text-gray-500">
                {insights?.contractsByFlow.totals.contracts ?? "…"} ·{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {fmt(insights?.contractsByFlow.totals.amount ?? 0)}
                </span>
              </div>
            </div>
            {insightsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /></div>
            ) : (
              <div className="space-y-1.5">
                {(insights?.contractsByFlow.rows ?? []).slice(0, 4).map((r) => (
                  <div key={r.flowCode} className="text-[11px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-gray-700 dark:text-gray-300 w-20 font-medium truncate">{r.flowName}</span>
                      <span className="text-gray-500 text-[10px] w-16">{r.contracts} contracts</span>
                      <span className="ml-auto font-semibold text-gray-900 dark:text-gray-100">{fmt(r.amount)}</span>
                      <span className="text-[10px] text-gray-400 w-10 text-right">{r.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${FLOW_COLOR[r.flowCode] ?? "bg-gray-400"}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tile 2: Period over Period */}
          <div className="col-span-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="tile-period-vs-period">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Accrual · Period vs Period
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {fmt(insights?.periodVsPeriod.currentAmount ?? 0)}
              </div>
              <div className="text-[10px] text-gray-500">{insights?.periodVsPeriod.currentLabel}</div>
            </div>
            {insights?.periodVsPeriod.yoy?.deltaPct != null && (
              <div className="flex items-center gap-1 text-xs mt-0.5">
                <ArrowUpRight className={`w-3.5 h-3.5 ${insights.periodVsPeriod.yoy.deltaPct >= 0 ? "text-green-600" : "text-red-600"}`} />
                <span className={`font-bold ${insights.periodVsPeriod.yoy.deltaPct >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {insights.periodVsPeriod.yoy.deltaPct > 0 ? "+" : ""}{insights.periodVsPeriod.yoy.deltaPct}%
                </span>
                <span className="text-gray-500">vs {insights.periodVsPeriod.yoy.label} ({fmt(insights.periodVsPeriod.yoy.amount)})</span>
              </div>
            )}
            {/* Sparkline */}
            {insights?.periodVsPeriod.sparkline && insights.periodVsPeriod.sparkline.length > 0 && (() => {
              const max = Math.max(...insights.periodVsPeriod.sparkline.map(b => b.value), 1);
              return (
                <>
                  <div className="mt-3 flex items-end gap-0.5" style={{ height: 44 }}>
                    {insights.periodVsPeriod.sparkline.map((b, i) => (
                      <div
                        key={i}
                        title={`${b.label}: ${fmt(b.value)}`}
                        className={`flex-1 rounded-t cursor-default ${
                          i === insights.periodVsPeriod.sparkline.length - 1
                            ? "bg-orange-500"
                            : "bg-orange-200 hover:bg-orange-300"
                        }`}
                        style={{ height: `${(b.value / max) * 100}%`, minHeight: 2 }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] text-gray-400 flex justify-between mt-0.5">
                    <span>{insights.periodVsPeriod.sparkline[0]?.label}</span>
                    <span>{insights.periodVsPeriod.sparkline[insights.periodVsPeriod.sparkline.length - 1]?.label}</span>
                  </div>
                </>
              );
            })()}
            {insights?.periodVsPeriod.ytd && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <div className="text-gray-500 uppercase text-[9px]">{insights.periodVsPeriod.ytd.current.label}</div>
                  <div className="font-bold text-gray-900 dark:text-gray-100">{fmt(insights.periodVsPeriod.ytd.current.amount)}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase text-[9px]">{insights.periodVsPeriod.ytd.prior.label}</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    <span className="font-bold">{fmt(insights.periodVsPeriod.ytd.prior.amount)}</span>
                    {insights.periodVsPeriod.ytd.deltaPct != null && (
                      <span className={`ml-1 font-semibold ${insights.periodVsPeriod.ytd.deltaPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {insights.periodVsPeriod.ytd.deltaPct > 0 ? "+" : ""}{insights.periodVsPeriod.ytd.deltaPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tile 3: Ask LedgerIQ + Pinned KPIs */}
          <div className="col-span-4 bg-gradient-to-br from-orange-50 to-orange-100/40 dark:from-orange-950/40 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg shadow-sm p-3" data-testid="tile-ask-ledgeriq">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ask LedgerIQ for a custom KPI
              </div>
              <span className="text-[9px] bg-orange-200 text-orange-800 rounded-full px-1.5 py-0.5 font-bold">AI</span>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (askDraft.trim()) askMut.mutate(askDraft.trim()); }}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-md px-2 py-1.5 mb-2"
            >
              <Bot className="w-3 h-3 text-orange-500 flex-shrink-0" />
              <input
                value={askDraft}
                onChange={(e) => setAskDraft(e.target.value)}
                placeholder='e.g. "outstanding accruals by partner"'
                className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-gray-400"
                data-testid="input-ask-ledgeriq"
              />
              <button
                type="submit"
                disabled={askMut.isPending || !askDraft.trim()}
                className="text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5"
                data-testid="button-ask-submit"
              >
                {askMut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Send className="w-2.5 h-2.5" />}
              </button>
            </form>
            {!askResult && (
              <div className="flex flex-wrap gap-1 mb-2">
                {["Sum outstanding by flow", "Top 5 partners by accrual", "Variance vs Mar"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setAskDraft(s); askMut.mutate(s); }}
                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50"
                    data-testid={`button-ask-suggestion-${s.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {askResult && (
              <div className="rounded-md bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 p-2 mb-2 text-[11px]" data-testid="card-ask-result">
                <div className="text-gray-800 dark:text-gray-200">{askResult.naturalLanguageAnswer}</div>
                {askResult.evaluatedResult?.value != null && (
                  <div className="text-base font-bold text-orange-700 dark:text-orange-300 mt-1">
                    {fmt(askResult.evaluatedResult.value)}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={() => pinMut.mutate(askResult.resultId)}
                    disabled={!askResult.canPin || pinMut.isPending}
                    className="text-[10px] h-6 px-2 rounded bg-orange-600 text-white disabled:opacity-50 hover:bg-orange-700 inline-flex items-center gap-1"
                    data-testid="button-pin-result"
                  >
                    <Pin className="w-2.5 h-2.5" /> {pinMut.isPending ? "Pinning…" : "Pin"}
                  </button>
                  <button
                    onClick={() => { setAskResult(null); setAskDraft(""); }}
                    className="text-[10px] text-gray-500 hover:text-gray-900 px-1"
                    data-testid="button-dismiss-ask"
                  >
                    Dismiss
                  </button>
                  <span className="ml-auto text-[9px] text-gray-400">via {askResult.modelProvider}</span>
                </div>
                {!askResult.canPin && askResult.pinRejectionReason && (
                  <div className="text-[10px] text-gray-500 mt-1 italic">{askResult.pinRejectionReason}</div>
                )}
              </div>
            )}
            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" /> Pinned ({insights?.pinnedKpis?.length ?? 0})
            </div>
            <div className="space-y-1.5">
              {(insights?.pinnedKpis ?? []).slice(0, 3).map((p: any) => (
                <div key={p.id} className="group relative rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2" data-testid={`pin-${p.id}`}>
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove pinned KPI "${p.label}"?`)) unpinMut.mutate(p.id);
                    }}
                    disabled={unpinMut.isPending}
                    title="Remove pin"
                    data-testid={`button-unpin-${p.id}`}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-900 dark:text-gray-100 pr-4">
                    <Sparkles className="w-2.5 h-2.5 text-orange-500" /> {p.label}
                  </div>
                  <div className="text-[10px] text-gray-700 dark:text-gray-300 mt-0.5 truncate">{p.prompt}</div>
                  {p.currentValue != null && (
                    <div className="text-[11px] font-bold text-orange-700 mt-0.5">{fmt(Number(p.currentValue))}</div>
                  )}
                </div>
              ))}
              {(!insights?.pinnedKpis || insights.pinnedKpis.length === 0) && (
                <div className="text-[10px] text-gray-500 italic py-1">No pinned KPIs yet · ask a question above and pin the answer</div>
              )}
            </div>
          </div>
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/40 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-2.5 shadow-sm flex items-center gap-3" data-testid="bar-selection">
            <Check className="w-4 h-4 text-orange-600" />
            <div className="text-xs">
              <span className="font-bold text-orange-900 dark:text-orange-100" data-testid="text-selected-count">{selected.size} selected</span>
              <span className="text-orange-700 dark:text-orange-300 ml-2">· total {fmt(selectedAccrual)}</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => postJEsMut.mutate()}
                disabled={postJEsMut.isPending}
                className="text-[11px] h-7 px-2.5 rounded-md bg-white dark:bg-gray-900 border border-orange-300 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="button-batch-post-jes"
              >
                {postJEsMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />} Post JEs
              </button>
              <button
                onClick={() => settleMut.mutate()}
                disabled={settleMut.isPending}
                className="text-[11px] h-7 px-2.5 rounded-md bg-white dark:bg-gray-900 border border-orange-300 text-orange-700 dark:text-orange-300 hover:bg-orange-100 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="button-batch-settle"
              >
                {settleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Handshake className="w-3 h-3" />} Approve settlements
              </button>
              <button
                onClick={() => resolveClaimsMut.mutate()}
                disabled={resolveClaimsMut.isPending}
                className="text-[11px] h-7 px-2.5 rounded-md bg-white dark:bg-gray-900 border border-orange-300 text-orange-700 dark:text-orange-300 hover:bg-orange-100 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="button-batch-resolve-claims"
              >
                {resolveClaimsMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Inbox className="w-3 h-3" />} Resolve claims
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[11px] h-7 px-2 rounded-md text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
                data-testid="button-clear-selection"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>
        )}

        {/* The worksheet table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden" data-testid="table-worksheet">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  <th className="sticky left-0 bg-gray-50 dark:bg-gray-800/60 px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={toggleAll}
                      className="cursor-pointer"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="sticky left-8 bg-gray-50 dark:bg-gray-800/60 px-2 py-2 text-left font-semibold w-44">
                    <div className="inline-flex items-center gap-1 cursor-pointer hover:text-orange-600">Obligation <ArrowUpDown className="w-2.5 h-2.5" /></div>
                  </th>
                  <th className="px-2 py-2 text-left font-semibold w-56">Contract / Partner</th>
                  <th className="px-2 py-2 text-left font-semibold w-32">Flow</th>
                  <th className="px-2 py-2 text-right font-semibold w-24"><Calculator className="w-3 h-3 inline mr-1" />Accrual</th>
                  <th className="px-2 py-2 text-center font-semibold w-24"><BookOpen className="w-3 h-3 inline mr-1" />JE</th>
                  <th className="px-2 py-2 text-right font-semibold w-24"><Wallet className="w-3 h-3 inline mr-1" />Settle</th>
                  <th className="px-2 py-2 text-center font-semibold w-32"><Inbox className="w-3 h-3 inline mr-1" />Claim</th>
                  <th className="px-2 py-2 text-center font-semibold w-20"><ArrowLeftRight className="w-3 h-3 inline mr-1" />Dedn</th>
                  <th className="px-2 py-2 text-center font-semibold w-24"><Receipt className="w-3 h-3 inline mr-1" />Invoice</th>
                  <th className="px-2 py-2 text-right font-semibold w-20">Status</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {obligationsLoading && (
                  <tr><td colSpan={12} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-500 inline" /></td></tr>
                )}
                {!obligationsLoading && rows.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-8 text-gray-500 text-xs">No obligations match the current filters</td></tr>
                )}
                {rows.map((r) => {
                  const isSel = selected.has(r.id);
                  const acc = accrualSignal(r), je = jeSignal(r), st = settleSignal(r), cl = claimSignal(r);
                  const dd = dedSignal(r), iv = invoiceSignal(r);
                  const blocked = je === "blocked" || cl === "blocked" || r.hasBlocker;
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-orange-50/30 dark:hover:bg-orange-950/20 transition-colors ${
                        isSel ? "bg-orange-50/60 dark:bg-orange-950/30" : blocked ? "bg-red-50/30 dark:bg-red-950/20" : ""
                      }`}
                      data-testid={`row-obligation-${r.id}`}
                    >
                      <td className="sticky left-0 bg-inherit px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(r.id)}
                          className="cursor-pointer"
                          data-testid={`checkbox-row-${r.id}`}
                        />
                      </td>
                      <td className="sticky left-8 bg-inherit px-2 py-1.5 font-mono text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        <Link
                          href={`/outstanding-obligations?focus=${r.id}`}
                          className="hover:text-orange-600 hover:underline decoration-dotted underline-offset-2"
                          title="Open obligation in Outstanding Obligations"
                          data-testid={`link-obligation-${r.id}`}
                        >
                          {r.id.slice(0, 12)}…
                        </Link>
                        {r.hasBlocker && <span className="ml-1 text-red-600">●</span>}
                        {r.hasPendingDecision && <span className="ml-1 text-orange-600" title="AI decision pending">◆</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.contractId ? (
                          <Link
                            href={`/contracts/${r.contractId}`}
                            className="block hover:text-orange-600 group"
                            title="Open contract"
                            data-testid={`link-contract-${r.id}`}
                          >
                            <div className="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate max-w-[14rem] group-hover:text-orange-600 group-hover:underline decoration-dotted underline-offset-2">{r.contractName ?? "—"}</div>
                            <div className="text-[10px] text-gray-500">{r.partnerName ?? "—"}</div>
                          </Link>
                        ) : (
                          <>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate max-w-[14rem]">{r.contractName ?? "—"}</div>
                            <div className="text-[10px] text-gray-500">{r.partnerName ?? "—"}</div>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        <div className="text-gray-900 dark:text-gray-100">{r.flowTypeName ?? r.flowTypeCode ?? "—"}</div>
                        <div className="text-gray-500 font-mono">{r.kind ?? ""}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Link
                          href={`/accrual-management?focus=${r.id}`}
                          className="inline-flex items-center gap-1 justify-end hover:text-orange-600 group"
                          title="Open in Accrual Management"
                          data-testid={`link-accrual-${r.id}`}
                        >
                          {ICON[acc]}
                          <span className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-orange-600 group-hover:underline decoration-dotted underline-offset-2">{fmt(num(r.amount))}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.linkedJournalEntryId ? (
                          <Link
                            href={r.linkedJeCode ? `/journal-entry-hub?focus=${encodeURIComponent(r.linkedJeCode)}` : "/journal-entry-hub"}
                            className="inline-flex items-center gap-1 hover:text-orange-600 group"
                            title={r.linkedJeCode ? `Open ${r.linkedJeCode} in Journal Entry Hub` : "Open Journal Entry Hub"}
                            data-testid={`link-je-${r.id}`}
                          >
                            {ICON[je]}
                            <span className={`text-[10px] group-hover:underline decoration-dotted underline-offset-2 ${je === "blocked" ? "text-red-700 font-semibold group-hover:text-red-700" : "text-gray-700 dark:text-gray-300 group-hover:text-orange-600"}`}>
                              {r.jeStatus ?? "draft"}
                            </span>
                          </Link>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {ICON[je]}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300">—</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.settlementStatus ? (
                          <Link
                            href={r.linkedSettlementId ? `/settlement-workspace?focus=${r.linkedSettlementId}` : "/settlement-workspace"}
                            className="inline-flex items-center gap-1 justify-end hover:text-orange-600 group"
                            title="Open in Settlement Workspace"
                            data-testid={`link-settle-${r.id}`}
                          >
                            {ICON[st]}
                            <span className={`group-hover:underline decoration-dotted underline-offset-2 ${st === "ok" ? "text-green-700 font-semibold group-hover:text-green-700" : "text-gray-700 dark:text-gray-300 group-hover:text-orange-600"}`}>
                              {fmt(num(r.amount))}
                            </span>
                          </Link>
                        ) : (
                          <div className="inline-flex items-center gap-1 justify-end">
                            {ICON[st]}
                            <span className="text-gray-700 dark:text-gray-300">—</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.claimStatus ? (
                          <Link
                            href={r.linkedClaimId ? `/claims-workspace?focus=${r.linkedClaimId}` : "/claims-workspace"}
                            className="inline-flex items-center gap-1 hover:text-orange-600 group"
                            title="Open in Claims Workspace"
                            data-testid={`link-claim-${r.id}`}
                          >
                            {ICON[cl]}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300 group-hover:text-orange-600 group-hover:underline decoration-dotted underline-offset-2">{r.claimStatus}</span>
                          </Link>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {ICON[cl]}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300">—</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center text-[10px] text-gray-700 dark:text-gray-300">
                        {r.deductionStatus ? (
                          <Link
                            href={r.linkedDeductionId
                              ? `/deductions-workspace?focus=${r.linkedDeductionId}`
                              : r.contractId
                                ? `/deductions-workspace?contractId=${r.contractId}`
                                : "/deductions-workspace"}
                            className="hover:text-orange-600 hover:underline decoration-dotted underline-offset-2"
                            title="Open in Deductions Workspace"
                            data-testid={`link-deduction-${r.id}`}
                          >
                            {r.deductionStatus}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.invoiceStatus ? (
                          <Link
                            href={r.linkedFinanceDocumentId ? `/invoices-memos?focus=${r.linkedFinanceDocumentId}` : "/invoices-memos"}
                            className="inline-flex items-center gap-1 hover:text-orange-600 group"
                            title="Open in Invoices & Memos"
                            data-testid={`link-invoice-${r.id}`}
                          >
                            {ICON[iv]}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300 group-hover:text-orange-600 group-hover:underline decoration-dotted underline-offset-2">{r.invoiceStatus}</span>
                          </Link>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {ICON[iv]}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300">—</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        {r.status ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <button className="text-gray-400 hover:text-gray-700"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-t-2 border-gray-200 dark:border-gray-700 font-semibold text-[11px]">
                    <td className="sticky left-0 bg-gray-50 dark:bg-gray-800/60 px-2 py-2"></td>
                    <td className="sticky left-8 bg-gray-50 dark:bg-gray-800/60 px-2 py-2 text-gray-600 dark:text-gray-300">{rows.length} shown</td>
                    <td className="px-2 py-2 text-gray-500 text-[10px]">{obligationsData?.meta?.hasNext ? "more available" : "all loaded"}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right text-gray-900 dark:text-gray-100">{fmt(totalAccrual)}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right text-green-700">{fmt(totalSettled)}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2"></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Bottom split: blockers + readiness */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="panel-blockers">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Blockers
              <span className="text-[10px] font-normal text-gray-500 ml-auto">{blockers.filter((b: any) => !b.resolved).length} unresolved</span>
            </div>
            <div className="space-y-1.5">
              {blockers.filter((b: any) => !b.resolved).slice(0, 6).map((b: any) => (
                <div key={b.id} className="flex items-center gap-2 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5" data-testid={`blocker-${b.id}`}>
                  <div className={`w-1 self-stretch rounded-full ${b.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="text-gray-900 dark:text-gray-100 flex-1">{b.title || b.description}</span>
                  <button
                    onClick={() => resolveBlockerMut.mutate(b.id)}
                    disabled={resolveBlockerMut.isPending}
                    className="text-orange-600 hover:underline text-[10px] disabled:opacity-50"
                    data-testid={`button-resolve-blocker-${b.id}`}
                  >
                    Resolve →
                  </button>
                </div>
              ))}
              {blockers.filter((b: any) => !b.resolved).length === 0 && (
                <div className="text-[11px] text-gray-500 italic py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> No active blockers
                </div>
              )}
            </div>
          </div>
          <div className="col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="panel-readiness">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> Readiness for Lock
            </div>
            <div className="space-y-1.5 text-[11px]">
              {gates.map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded" data-testid={`gate-${i}`}>
                  {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Clock className="w-3.5 h-3.5 text-yellow-600" />}
                  <span className={c.ok ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-gray-100 font-medium"}>{c.l}</span>
                  <span className="ml-auto text-[10px] text-gray-500">{c.sub}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{gates.length - gatesPassed} of {gates.length} gates remaining</span>
                <span className={`text-[11px] inline-flex items-center gap-1.5 font-semibold ${allGatesPass ? "text-green-700" : "text-gray-400"}`}>
                  <Lock className="w-3 h-3" /> {allGatesPass ? "Ready to lock" : "Not ready"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 text-center pt-1">
          Worksheet view · multi-select for batch actions · every action logged to the audit trail
        </div>
      </div>
    </div>
  );
}
