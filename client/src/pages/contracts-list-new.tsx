import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { NewContractSlideOver } from "@/components/contracts/NewContractSlideOver";
import { FormattedAnswer } from "@/components/ui/formatted-answer";
import {
  Search, ChevronRight, ChevronDown, List, Bot, Sparkles, Eye, Pencil, GitBranch,
  FileSignature, ShieldCheck, MoreHorizontal, Plus, Download, Settings,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Calendar, Users, ArrowRight,
  Send, Flag, Star, Trash2, Loader2,
} from "lucide-react";

type Status = "active" | "draft" | "pending-approval" | "expiring" | "expired" | "amended" | "in-revision";
type Risk = "low" | "med" | "high";

const statusMeta: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  draft: { label: "Draft", bg: "bg-zinc-100", text: "text-zinc-700", dot: "bg-zinc-400" },
  "pending-approval": { label: "Pending approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  expiring: { label: "Expiring < 60d", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  expired: { label: "Expired", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  amended: { label: "Amended", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "in-revision": { label: "In revision", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
};

function StatusPill({ status }: { status: Status }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

type IngestionStage = "uploaded" | "processing" | "analyzed" | "failed" | "unknown";
const ingestionMeta: Record<IngestionStage, { label: string; bg: string; text: string; dot: string }> = {
  uploaded:   { label: "Uploaded",   bg: "bg-zinc-100",   text: "text-zinc-600",    dot: "bg-zinc-400" },
  processing: { label: "Processing", bg: "bg-sky-50",     text: "text-sky-700",     dot: "bg-sky-500" },
  analyzed:   { label: "Analyzed",   bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  failed:     { label: "Failed",     bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-500" },
  unknown:    { label: "—",          bg: "bg-zinc-50",    text: "text-zinc-400",    dot: "bg-zinc-300" },
};
function mapIngestion(s: string | null | undefined): IngestionStage {
  const v = (s || "").toLowerCase();
  if (v === "uploaded") return "uploaded";
  if (v === "processing") return "processing";
  if (v === "analyzed") return "analyzed";
  if (v === "failed") return "failed";
  return "unknown";
}
function IngestionPill({ stage }: { stage: IngestionStage }) {
  const m = ingestionMeta[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-medium px-1 py-0.5 rounded ${m.bg} ${m.text}`}
      title={`Ingestion: ${m.label}`}
    >
      <span className={`h-1 w-1 rounded-full ${m.dot} ${stage === "processing" ? "animate-pulse" : ""}`} />
      {m.label}
    </span>
  );
}
function NewBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-800 uppercase tracking-wide"
      title="AI-processed but not yet reviewed by a human"
      data-testid="badge-new-contract"
    >
      <Sparkles className="h-2 w-2" />New
    </span>
  );
}

function RiskDot({ risk }: { risk: Risk }) {
  const map = { low: "bg-emerald-500", med: "bg-amber-500", high: "bg-rose-500" };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[risk]}`} title={`Risk: ${risk}`} />;
}

function ActionButton({ icon: Icon, label, color = "zinc", onClick, testId }: { icon: any; label: string; color?: string; onClick?: (e: React.MouseEvent) => void; testId?: string }) {
  const colorMap: Record<string, string> = {
    zinc: "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
    orange: "text-orange-700 hover:text-orange-800 hover:bg-orange-50",
    blue: "text-blue-700 hover:text-blue-800 hover:bg-blue-50",
    purple: "text-purple-700 hover:text-purple-800 hover:bg-purple-50",
    emerald: "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50",
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className={`inline-flex items-center justify-center h-6 w-6 rounded ${colorMap[color]}`}
      title={label}
      data-testid={testId}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

// Small checkbox that supports the HTML `indeterminate` state (used by the
// master select-all when only some rows are selected). Pure presentation —
// caller owns the checked / onChange handlers.
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  testId,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  testId?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="rounded cursor-pointer"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      data-testid={testId}
      aria-label={ariaLabel}
    />
  );
}

// Map real DB status → mockup status pill
function mapStatus(s: string | null | undefined): Status {
  const v = (s || "").toLowerCase();
  if (v === "active" || v === "verified" || v === "completed") return "active";
  if (v === "draft" || v === "uploaded") return "draft";
  if (v === "pending_approval" || v === "pending-approval" || v === "review") return "pending-approval";
  if (v === "expiring") return "expiring";
  if (v === "expired") return "expired";
  if (v === "amended") return "amended";
  if (v === "in_revision" || v === "in-revision" || v === "processing") return "in-revision";
  return "draft";
}

function formatMoney(n: any): string {
  const v = Number(n);
  if (!v || isNaN(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(d: any): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

export default function ContractsListNew() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "agent">("list");
  const [newContractOpen, setNewContractOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string; status: Status; isProtected: boolean } | null>(null);
  const [deleteAck, setDeleteAck] = useState("");
  // Saved-view selector ("all" shows everything; the rest narrow by status).
  const [savedView, setSavedView] = useState<"all" | "active" | "pending-approval" | "in-revision">("all");
  // Status checkbox set — controls which status rows survive the filter.
  // Initialized to all visible statuses so the default UX matches the old
  // unfiltered view; toggling a checkbox immediately removes those rows.
  const ALL_STATUSES: Status[] = ["active", "in-revision", "pending-approval", "expiring", "amended", "draft", "expired"];
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(ALL_STATUSES));
  const toggleStatus = (s: Status) => setStatusFilter((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  // Per-row selection (drives the select-all + per-row checkboxes and the
  // bulk-actions bar that appears when at least one row is checked).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  // Per-row "More" overflow menu — tracks which row's popover is open (if any).
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // Close the More menu on outside click.
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // ────────── Agent mode chat (Phase E — persistent threads).
  // Backed by /api/contracts/chat-threads + /turn. The page picks up the
  // user's most recent active thread on mount (or lazily creates a new one
  // on first send), so refreshes / navigation no longer drop the convo.
  type AgentMsg = {
    role: "user" | "assistant" | "error";
    content: string;
    sources?: Array<{ contractName?: string; relevantText?: string; similarity?: number }>;
    confidence?: number;
    toolsUsed?: string[];
    timestamp: number;
  };
  type ChatThreadSummary = {
    id: string;
    title: string;
    lastMessageAt: string;
    createdAt: string;
    status: string;
  };
  type ChatThreadDetail = {
    thread: ChatThreadSummary;
    messages: Array<{
      id: string;
      role: "user" | "assistant" | "error";
      content: { text: string; sources?: any[]; confidence?: number; toolsUsed?: string[] };
      createdAt: string;
    }>;
  };

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [agentInput, setAgentInput] = useState("");
  // Optimistic user-side echo while the server round-trip is pending. Cleared
  // as soon as the turn mutation invalidates and the persisted message comes
  // back in the next thread fetch.
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const agentEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch the user's thread list (only in agent mode — no point paying
  //    the cost on the list view).
  const { data: threadsData } = useQuery<{ threads: ChatThreadSummary[] }>({
    queryKey: ["/api/contracts/chat-threads"],
    enabled: mode === "agent",
    staleTime: 30 * 1000,
  });

  // 2. As soon as we know the most-recent thread, adopt it as the current
  //    one. If the user has zero threads we leave currentThreadId null —
  //    a thread will be lazily created on first send.
  useEffect(() => {
    if (mode !== "agent") return;
    if (currentThreadId) return;
    const newest = threadsData?.threads?.[0];
    if (newest) setCurrentThreadId(newest.id);
  }, [mode, threadsData, currentThreadId]);

  // 3. Fetch the active thread + full message history.
  const { data: threadDetail } = useQuery<ChatThreadDetail>({
    queryKey: ["/api/contracts/chat-threads", currentThreadId],
    enabled: mode === "agent" && !!currentThreadId,
    staleTime: 0, // freshness > caching here so post-turn renders are instant
  });

  // Map persisted rows into the existing display shape.
  const agentMessages: AgentMsg[] = useMemo(() => {
    const persisted = (threadDetail?.messages || []).map((m) => ({
      role: m.role,
      content: m.content?.text ?? "",
      sources: m.content?.sources,
      confidence: m.content?.confidence,
      toolsUsed: m.content?.toolsUsed,
      timestamp: new Date(m.createdAt).getTime(),
    }));
    if (pendingUserMsg) {
      persisted.push({
        role: "user",
        content: pendingUserMsg,
        sources: undefined,
        confidence: undefined,
        toolsUsed: undefined,
        timestamp: Date.now(),
      });
    }
    return persisted;
  }, [threadDetail, pendingUserMsg]);

  useEffect(() => {
    if (mode === "agent") agentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentMessages, mode]);

  // Lazy-create a thread when the user sends their first message.
  const ensureThread = async (): Promise<string> => {
    if (currentThreadId) return currentThreadId;
    const res = await apiRequest("POST", "/api/contracts/chat-threads", {});
    const data = await res.json();
    const id = data?.thread?.id as string;
    setCurrentThreadId(id);
    return id;
  };

  const turnMut = useMutation({
    mutationFn: async (q: string) => {
      const tid = await ensureThread();
      const res = await apiRequest("POST", `/api/contracts/chat-threads/${tid}/turn`, {
        question: q,
        pageContext: { page: "contracts", label: "Contract Search" },
      });
      return res.json();
    },
    onSuccess: () => {
      setPendingUserMsg(null);
      // Pull the now-persisted user + assistant rows.
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/chat-threads", currentThreadId] });
      // Bump the threads list (lastMessageAt + auto-title may have changed).
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/chat-threads"] });
    },
    onError: () => {
      setPendingUserMsg(null);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/chat-threads", currentThreadId] });
    },
  });

  // Compatibility alias so the JSX below (built in Phase A) keeps working
  // unchanged. `agentMut.isPending` drove the spinner / disabled states.
  const agentMut = turnMut;

  const askAgent = (q: string) => {
    const text = q.trim();
    if (!text || turnMut.isPending) return;
    setPendingUserMsg(text);
    setAgentInput("");
    turnMut.mutate(text);
  };

  // "Clear conversation" → archive the current thread and start fresh on the
  // next send. We don't optimistically create the new thread here so the
  // suggested-prompts block can render immediately on an empty canvas.
  const clearConversation = async () => {
    const tid = currentThreadId;
    setCurrentThreadId(null);
    setPendingUserMsg(null);
    if (tid) {
      try {
        await apiRequest("PATCH", `/api/contracts/chat-threads/${tid}`, { status: "archived" });
      } catch {
        // Best-effort — even if the archive fails the user still sees an
        // empty canvas locally; the old thread stays in the history list.
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/chat-threads"] });
    }
  };

  // ────────── Morning brief (Phase B) — live portfolio digest from
  // /api/contracts/morning-brief. Only fetched when the user is on the Agent
  // tab so we don't pay the cost on every list-mode load.
  type BriefPriority = {
    type: "expired-active" | "expiring" | "missing-rules" | "pending-review";
    urgency: "high" | "med" | "low";
    contractId: string;
    name: string;
    detail: string;
  };
  type BriefData = {
    generatedAt: string;
    headline: string;
    summary: {
      total: number;
      active: number;
      expiringSoon: number;
      expiredActive: number;
      missingRules: number;
      pendingReview: number;
      totalAnnualValue: number;
    };
    priorities: BriefPriority[];
  };
  const { data: brief, isLoading: briefLoading } = useQuery<BriefData>({
    queryKey: ["/api/contracts/morning-brief"],
    enabled: mode === "agent",
    staleTime: 5 * 60 * 1000,
  });

  // ────────── Decision proposer queue (Phase C) — pending actions the agent
  // wants the user to accept or dismiss. Backed by the `contract_decisions`
  // table; the GET endpoint refreshes from current portfolio state on every
  // call. Accept can perform a real mutation (mark-expired) so we invalidate
  // the contracts cache and the brief on success.
  type DecisionRow = {
    id: string;
    contractId: string;
    proposalType: "expired-active" | "expiring" | "missing-rules" | "pending-review";
    urgency: "high" | "med" | "low";
    summary: string;
    actionType: "mark-expired" | "acknowledge";
    proposedAt: string;
  };
  const { data: decisionsData, isLoading: decisionsLoading } = useQuery<{ decisions: DecisionRow[] }>({
    queryKey: ["/api/contracts/decisions"],
    enabled: mode === "agent",
    staleTime: 60 * 1000,
  });
  const pendingDecisions = decisionsData?.decisions ?? [];

  // ────────── Risk summary (Phase D) — derived in the backend by
  // contractRiskService. Always queried (not gated on agent mode) because
  // the "At risk (high)" KPI lives in the global stats strip that's visible
  // in both List and Agent modes. 2-min stale window keeps it fresh
  // without hammering the endpoint when users navigate quickly.
  type RiskSummary = {
    summary: { high: number; med: number; low: number; total: number };
    top: Array<{ contractId: string; name: string; score: number; level: "low" | "med" | "high"; topFactor: string }>;
  };
  const { data: riskData, isLoading: riskLoading } = useQuery<RiskSummary>({
    queryKey: ["/api/contracts/risk-summary"],
    staleTime: 2 * 60 * 1000,
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "dismiss" }) => {
      const res = await apiRequest("POST", `/api/contracts/decisions/${id}/${action}`, {});
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/decisions"] });
      // Accept can change contract status (mark-expired), so the list and the
      // brief both need to refresh.
      if (vars.action === "accept") {
        queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contracts/morning-brief"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contracts/risk-summary"] });
      }
      toast({
        title: vars.action === "accept" ? "Action accepted" : "Proposal dismissed",
        description: vars.action === "accept"
          ? "The agent applied the change and recorded the decision."
          : "Removed from the queue. The agent won't propose this again for 30 days.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't decide", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  // Admins/owners can delete *any* contract (testing-phase cleanup); everyone
  // else is still restricted to draft / uploaded / processing / failed rows.
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "owner";

  const { data: contractsRaw, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts"],
  });

  // Flow types catalog → friendly name lookup ("CRP" → "Customer Rebate
  // Program"). The TYPE column shows the flow type (the user-picked
  // classifier at upload), not the legacy contract_type, so a contract
  // can never look like a "Royalty" when it's actually a rebate.
  const { data: flowTypes } = useQuery<any[]>({
    queryKey: ["/api/pipeline/flow-types"],
  });
  const flowTypeNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    (flowTypes || []).forEach((ft: any) => {
      if (ft?.code) m.set(String(ft.code).toUpperCase(), ft.name || ft.code);
    });
    return m;
  }, [flowTypes]);

  // Last-resort label for contracts whose flow_type_code is missing — turn
  // the legacy contract_type enum (`licensing_royalty`, `ob_rebate`, …) into
  // a Title-Case label so the column never shows raw snake_case.
  const titleCaseFromSnake = (s: string) =>
    s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contracts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Contract deleted",
        description: "The contract and all related rules, sales, calculations, accruals and journal entries have been permanently removed.",
      });
      setConfirmDelete(null);
    },
    onError: (err: any) => {
      toast({ title: "Couldn't delete", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const rows = useMemo(() => {
    // /api/contracts returns { contracts: [...] }; defend against either shape
    const list: any[] = Array.isArray(contractsRaw)
      ? contractsRaw
      : Array.isArray(contractsRaw?.contracts)
        ? contractsRaw.contracts
        : [];
    const q = search.toLowerCase().trim();
    return list
      .filter(c => !q ||
        (c.displayName || "").toLowerCase().includes(q) ||
        (c.contractNumber || "").toLowerCase().includes(q) ||
        (c.counterpartyName || "").toLowerCase().includes(q))
      // Saved view: narrows by mapped status before status-checkbox filter.
      .filter(c => {
        if (savedView === "all") return true;
        return mapStatus(c.status) === savedView;
      })
      // Status checkboxes: only keep rows whose mapped status is enabled.
      .filter(c => statusFilter.has(mapStatus(c.status)))
      .map(c => {
        // Resolve TYPE column display from flow type first (the user's
        // matrix-driven classifier), then legacy contract_type as fallback.
        // A CRP rebate contract used to render as "licensing_royalty" because
        // contract_type defaulted there during ingestion — flow type is the
        // source of truth now.
        const flowCode = c.flowTypeCode ? String(c.flowTypeCode).toUpperCase() : "";
        const flowName = flowCode
          ? flowTypeNameByCode.get(flowCode) || flowCode
          : "";
        const typeLabel =
          flowName ||
          (c.contractType ? titleCaseFromSnake(String(c.contractType)) : "—");
        return {
        id: c.id,
        contractNumber: c.contractNumber || c.id?.slice(0, 8),
        name: c.displayName || c.originalName || "Untitled contract",
        type: typeLabel,
        typeFlowCode: flowCode || null,
        cp: c.counterpartyName || "—",
        status: mapStatus(c.status),
        value: formatMoney(c.totalValue || c.contractValue),
        endDate: formatDate(c.effectiveEnd),
        risk: "low" as Risk, // TODO: Phase B — derive from risk scoring service
        version: c.version ? `v${c.version}` : "v1",
        parties: Number(c.partiesCount ?? 0),
        rules: Number(c.rulesCount ?? 0),
        lastEvent: c.updatedAt ? `Updated · ${formatDate(c.updatedAt)}` : "—",
        flag: false,
        rawStatus: (c.status || "").toLowerCase(),
        ingestion: mapIngestion(c.status),
        // "New / untouched" = AI has finished extracting but a human hasn't
        // moved it forward yet (still in draft approvalState).
        isNew:
          ((c.status || "").toLowerCase() === "analyzed") &&
          ((c.approvalState || "draft").toLowerCase() === "draft"),
        };
      });
  }, [contractsRaw, search, savedView, statusFilter, flowTypeNameByCode]);

  const counts = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.status === "active").length;
    const pending = rows.filter(r => r.status === "pending-approval").length;
    const revision = rows.filter(r => r.status === "in-revision").length;
    const expiring = rows.filter(r => r.status === "expiring").length;
    return { total, active, pending, revision, expiring };
  }, [rows]);

  return (
    <MainLayout>
      <div className="bg-zinc-50 text-zinc-900 font-sans text-xs min-h-screen" data-testid="page-contracts-list">
        {/* Header with mode toggle */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-0.5">
                <span>Contracts</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Management</span>
              </div>
              <h1 className="text-lg font-bold text-zinc-900">Contract Management</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center bg-zinc-100 rounded-md p-0.5 border border-zinc-200">
                <button
                  onClick={() => setMode("list")}
                  data-testid="button-mode-list"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded ${mode === "list" ? "text-zinc-900 bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                  <List className="h-3.5 w-3.5" />List mode
                </button>
                <button
                  onClick={() => setMode("agent")}
                  data-testid="button-mode-agent"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded ${mode === "agent" ? "text-zinc-900 bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                  <Bot className="h-3.5 w-3.5" />Agent mode
                </button>
              </div>
              <div className="h-5 w-px bg-zinc-200" />
              <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />Export</button>
              <button
                onClick={() => setNewContractOpen(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white font-semibold inline-flex items-center gap-1.5"
                data-testid="button-new-contract"
              ><Plus className="h-3.5 w-3.5" />New contract</button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-6 gap-0 border-t border-zinc-100">
            {[
              { label: "Total contracts", val: String(counts.total), sub: "all statuses", icon: CheckCircle2, color: "text-zinc-700" },
              { label: "Active", val: String(counts.active), sub: "in production", icon: CheckCircle2, color: "text-emerald-600" },
              { label: "Pending approval", val: String(counts.pending), sub: "awaiting sign-off", icon: Clock, color: "text-amber-600" },
              { label: "In revision", val: String(counts.revision), sub: "draft updates", icon: GitBranch, color: "text-purple-600" },
              { label: "Expiring < 60d", val: String(counts.expiring), sub: "renewal window", icon: Calendar, color: "text-orange-600" },
              {
                label: "At risk (high)",
                val: riskLoading ? "…" : String(riskData?.summary?.high ?? 0),
                sub: riskLoading
                  ? "scoring portfolio…"
                  : (riskData?.summary?.med ?? 0) > 0
                    ? `${riskData?.summary?.med} med · ${riskData?.summary?.total} scored`
                    : `${riskData?.summary?.total ?? 0} scored`,
                icon: AlertTriangle,
                color: (riskData?.summary?.high ?? 0) > 0
                  ? "text-rose-600"
                  : (riskData?.summary?.med ?? 0) > 0
                    ? "text-amber-600"
                    : "text-emerald-600",
                // Native tooltip with the top scored contracts so a hover
                // gives the user the "why" without needing a modal.
                tooltip: (riskData?.top?.length ?? 0) > 0
                  ? "Top risks:\n" + (riskData!.top.slice(0, 5)
                      .map(t => `• [${t.level.toUpperCase()} ${t.score}] ${t.name} — ${t.topFactor}`)
                      .join("\n"))
                  : undefined,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="px-4 py-2.5 border-r border-zinc-100 last:border-r-0"
                  title={(s as any).tooltip}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className={`h-3 w-3 ${s.color}`} />
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">{s.label}</span>
                  </div>
                  <div className="text-lg font-bold text-zinc-900 leading-tight" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.val}</div>
                  <div className="text-[10px] text-zinc-500">{s.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {mode === "list" ? (
          <div className="border-b-4 border-zinc-200">
            <div className="bg-zinc-100 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5"><List className="h-3 w-3" />List mode — power-user view</span>
              <span className="text-zinc-400 normal-case font-normal">Filters · bulk ops · 5 actions per row</span>
            </div>

            <div className="flex bg-white">
              {/* Filter rail (UI-only — Phase B for active filtering) */}
              <aside className="w-52 shrink-0 border-r border-zinc-200 px-3 py-3 space-y-3 text-[11px]">
                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${counts.total} contracts…`}
                    data-testid="input-search-contracts"
                    className="text-[11px] pl-6 pr-2 py-1 rounded border border-zinc-200 w-full focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Saved views</div>
                  {([
                    { key: "all", l: "All contracts", n: counts.total },
                    { key: "active", l: "★ Active", n: counts.active },
                    { key: "pending-approval", l: "★ Pending approval", n: counts.pending },
                    { key: "in-revision", l: "★ In revision", n: counts.revision },
                  ] as const).map((f) => {
                    const active = savedView === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setSavedView(f.key)}
                        data-testid={`button-saved-view-${f.key}`}
                        className={`w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 ${active ? "bg-orange-50 text-orange-800 font-bold" : "text-zinc-700"}`}
                      >
                        <span className="truncate">{f.l}</span>
                        <span className="text-[10px] text-zinc-500">{f.n}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between">
                    <span>Status</span><ChevronDown className="h-3 w-3" />
                  </div>
                  {ALL_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-zinc-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.has(s)}
                        onChange={() => toggleStatus(s)}
                        data-testid={`checkbox-status-${s}`}
                        className="rounded h-3 w-3"
                      />
                      <StatusPill status={s} />
                    </label>
                  ))}
                </div>
              </aside>

              {/* Table */}
              <div className="flex-1 min-w-0">
                {(() => {
                  // Master select-all spans every row currently visible. Honors
                  // the active filters/search — selecting "all" only checks the
                  // rows the user can actually see.
                  const visibleIds = rows.map((r) => r.id);
                  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id));
                  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
                  const someSelected = selectedVisible.length > 0 && !allSelected;
                  const toggleAll = (next: boolean) => setSelectedIds((prev) => {
                    const out = new Set(prev);
                    if (next) visibleIds.forEach((id) => out.add(id));
                    else visibleIds.forEach((id) => out.delete(id));
                    return out;
                  });
                  return (
                    <>
                      {/* Header bar — flips into a bulk-actions bar when at
                          least one row is selected. */}
                      {selectedIds.size === 0 ? (
                        <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-1.5 flex items-center gap-3">
                          <TriCheckbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={toggleAll}
                            testId="checkbox-select-all-header"
                            ariaLabel="Select all visible contracts"
                          />
                          <span className="text-[11px] text-zinc-500"><span className="font-bold text-zinc-800">{rows.length}</span> contracts</span>
                          <div className="ml-auto text-[10px] text-zinc-500 inline-flex items-center gap-2">
                            <span>Sort: <span className="font-semibold text-zinc-700">Last event ↓</span></span>
                            <Settings className="h-3 w-3" />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-orange-50 border-b border-orange-200 px-4 py-1.5 flex items-center gap-3" data-testid="bulk-actions-bar">
                          <TriCheckbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={toggleAll}
                            testId="checkbox-select-all-header"
                            ariaLabel="Select all visible contracts"
                          />
                          <span className="text-[11px] text-orange-900 font-semibold" data-testid="text-selection-count">
                            {selectedIds.size} selected
                          </span>
                          <button
                            onClick={clearSelection}
                            className="text-[10px] text-orange-700 hover:text-orange-900 underline underline-offset-2"
                            data-testid="button-clear-selection"
                          >
                            Clear
                          </button>
                          <div className="ml-auto text-[10px] text-orange-700 inline-flex items-center gap-2">
                            Bulk operations coming soon
                          </div>
                        </div>
                      )}

                      <table className="w-full text-[11px]">
                        <thead className="bg-white text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                          <tr>
                            <th className="px-3 py-2 w-7">
                              <TriCheckbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onChange={toggleAll}
                                testId="checkbox-select-all-thead"
                                ariaLabel="Select all visible contracts"
                              />
                            </th>
                      <th className="px-1 py-2 w-4"></th>
                      <th className="text-left font-semibold px-2 py-2">Contract</th>
                      <th className="text-left font-semibold px-2 py-2">Type</th>
                      <th className="text-left font-semibold px-2 py-2">Status · Version</th>
                      <th className="text-right font-semibold px-2 py-2">Value · End</th>
                      <th className="text-center font-semibold px-2 py-2">Parties · Rules</th>
                      <th className="text-left font-semibold px-2 py-2">Last event</th>
                      <th className="text-right font-semibold px-3 py-2 w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {isLoading && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">Loading contracts…</td></tr>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                        No contracts yet.{" "}
                        <button onClick={() => setLocation("/contracts/ingest")} className="text-orange-700 font-semibold hover:underline cursor-pointer bg-transparent">Ingest your first contract →</button>
                      </td></tr>
                    )}
                    {rows.map((c) => (
                      <tr key={c.id} className={`group cursor-pointer ${selectedIds.has(c.id) ? "bg-orange-50/60 hover:bg-orange-50" : "hover:bg-orange-50/30"}`} data-testid={`row-contract-${c.id}`} onClick={() => setLocation(`/contracts/${c.id}`)}>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <TriCheckbox
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleRow(c.id)}
                            testId={`checkbox-row-${c.id}`}
                            ariaLabel={`Select contract ${c.name}`}
                          />
                        </td>
                        <td className="px-1 py-2 text-center">
                          {c.flag ? <Flag className="h-3 w-3 text-orange-600 inline" /> : <RiskDot risk={c.risk} />}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5 max-w-[260px]">
                            <span className="font-bold text-zinc-900 truncate">{c.name}</span>
                            {c.isNew && <NewBadge />}
                          </div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                            <span className="font-mono">{c.contractNumber}</span>
                            <span>·</span>
                            <span className="truncate">{c.cp}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-zinc-700 text-[10px]">{c.type}</td>
                        <td className="px-2 py-2">
                          <StatusPill status={c.status} />
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <IngestionPill stage={c.ingestion} />
                            <span className="text-[10px] text-zinc-500 font-mono">{c.version}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="font-bold text-zinc-900">{c.value}</div>
                          <div className="text-[10px] text-zinc-500">{c.endDate}</div>
                        </td>
                        <td className="px-2 py-2 text-center text-[10px] text-zinc-600">
                          <span className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{c.parties || "—"}</span>
                          <span className="mx-1 text-zinc-300">·</span>
                          <span>{c.rules || "—"} rules</span>
                        </td>
                        <td className="px-2 py-2 text-[10px] text-zinc-600 max-w-[180px] truncate" title={c.lastEvent}>{c.lastEvent}</td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <ActionButton icon={Eye} label="View" color="zinc" onClick={() => setLocation(`/contracts/${c.id}`)} testId={`action-view-${c.id}`} />
                            <ActionButton icon={Pencil} label="Update metadata" color="blue" onClick={() => setLocation(`/contracts/${c.id}`)} testId={`action-update-${c.id}`} />
                            <ActionButton
                              icon={GitBranch}
                              label="Revise — open version history"
                              color="purple"
                              onClick={() => setLocation(`/contracts/${c.id}?tab=history`)}
                              testId={`action-revise-${c.id}`}
                            />
                            <ActionButton
                              icon={FileSignature}
                              label="Amend — open terms & clauses"
                              color="orange"
                              onClick={() => setLocation(`/contracts/${c.id}?tab=terms`)}
                              testId={`action-amend-${c.id}`}
                            />
                            <ActionButton
                              icon={ShieldCheck}
                              label="Approve — open readiness checklist"
                              color="emerald"
                              onClick={() => setLocation(`/contracts/${c.id}?tab=overview`)}
                              testId={`action-approve-${c.id}`}
                            />
                            <div className="h-4 w-px bg-zinc-200 mx-0.5" />
                            {/* Delete is exposed for Draft / Uploaded / Processing / Failed
                                rows for everyone. Admins and owners additionally see it on
                                ANY status (testing-phase cleanup), but with a stronger
                                confirmation that lists the cascade and requires typing the
                                contract name. */}
                            {(() => {
                              const isDraftish =
                                c.status === "draft" ||
                                c.rawStatus === "uploaded" ||
                                c.rawStatus === "processing" ||
                                c.rawStatus === "failed";
                              const canShow = isDraftish || isAdmin;
                              if (!canShow) return null;
                              const isProtected = !isDraftish; // active / pending / expiring / amended / expired
                              return (
                                <button
                                  onClick={() => {
                                    setDeleteAck("");
                                    setConfirmDelete({ id: c.id, name: c.name, status: c.status, isProtected });
                                  }}
                                  title={isProtected ? "Admin: delete contract and ALL related data" : "Delete draft contract"}
                                  data-testid={`action-delete-${c.id}`}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              );
                            })()}
                            <div className="relative">
                              <ActionButton
                                icon={MoreHorizontal}
                                label="More"
                                color="zinc"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === c.id ? null : c.id);
                                }}
                                testId={`action-more-${c.id}`}
                              />
                              {openMenuId === c.id && (
                                <div
                                  className="absolute right-0 top-7 z-20 w-48 bg-white border border-zinc-200 rounded shadow-lg py-1"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`menu-more-${c.id}`}
                                >
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setLocation(`/contracts/${c.id}?tab=parties`);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                    data-testid={`menu-parties-${c.id}`}
                                  >
                                    Open Parties
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setLocation(`/contracts/${c.id}?tab=rules`);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                    data-testid={`menu-rules-${c.id}`}
                                  >
                                    Open Rules
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setLocation(`/contracts/${c.id}?tab=payments`);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                    data-testid={`menu-payments-${c.id}`}
                                  >
                                    Open Payments
                                  </button>
                                  <div className="border-t border-zinc-100 my-1" />
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      navigator.clipboard?.writeText(c.contractNumber || c.id).then(
                                        () => toast({ title: "Copied", description: c.contractNumber || c.id }),
                                        () => toast({ title: "Copy failed", variant: "destructive" }),
                                      );
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                    data-testid={`menu-copy-number-${c.id}`}
                                  >
                                    Copy contract number
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      window.open(`/contracts/${c.id}`, "_blank", "noopener");
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                    data-testid={`menu-open-new-tab-${c.id}`}
                                  >
                                    Open in new tab
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                    </>
                  );
                })()}

                <div className="bg-zinc-50 border-t border-zinc-200 px-4 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">5 actions, clearly distinct</div>
                  <div className="grid grid-cols-5 gap-2 text-[10px]">
                    {[
                      { icon: Eye, label: "View", desc: "Read-only deep dive · no audit event", color: "zinc" },
                      { icon: Pencil, label: "Update", desc: "Quick metadata fix · no new version · audited", color: "blue" },
                      { icon: GitBranch, label: "Revise", desc: "Draft new working version · not yet effective", color: "purple" },
                      { icon: FileSignature, label: "Amend", desc: "Formal amendment · effective date · approval required", color: "orange" },
                      { icon: ShieldCheck, label: "Approve", desc: "Sign off pending changes · advances workflow", color: "emerald" },
                    ].map((a) => {
                      const Icon = a.icon;
                      const colorMap: Record<string, string> = { zinc: "text-zinc-600 bg-zinc-100", blue: "text-blue-700 bg-blue-50", purple: "text-purple-700 bg-purple-50", orange: "text-orange-700 bg-orange-50", emerald: "text-emerald-700 bg-emerald-50" };
                      return (
                        <div key={a.label} className="flex items-start gap-1.5 p-1.5 bg-white rounded border border-zinc-100">
                          <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${colorMap[a.color]}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 text-[11px]">{a.label}</div>
                            <div className="text-[9px] text-zinc-600 leading-snug">{a.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ============================ AGENT MODE (live conversational view) ============================
          <div>
            <div className="bg-zinc-100 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5"><Bot className="h-3 w-3 text-orange-600" />Agent mode — conversational view</span>
              <span className="text-zinc-400 normal-case font-normal">Powered by liQ Agent · 10 portfolio tools</span>
            </div>

            <div className="bg-gradient-to-b from-orange-50/40 to-white px-5 py-4 space-y-3">
              {/* Live morning brief — pulled from /api/contracts/morning-brief
                  (Phase B). Headline + 4 summary chips + ranked priority list
                  with per-row navigation to the contract detail page. */}
              <div className="bg-white border-2 border-orange-200 rounded-lg p-3 shadow-sm" data-testid="agent-morning-brief">
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 rounded bg-orange-100 flex items-center justify-center text-orange-700 shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] font-bold text-zinc-900">liQ Advisor — your morning brief</span>
                      {brief?.generatedAt && (
                        <span className="text-[10px] text-zinc-500" data-testid="text-brief-generated">
                          generated {new Date(brief.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-800 mt-1 leading-relaxed font-medium" data-testid="text-brief-headline">
                      {briefLoading ? (
                        <span className="inline-flex items-center gap-1.5 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" />Building brief…</span>
                      ) : brief?.headline ? (
                        brief.headline
                      ) : (
                        "Brief unavailable."
                      )}
                    </div>

                    {/* Summary chips */}
                    {brief && (
                      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="brief-summary-chips">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                          <b>{brief.summary.total}</b> total
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <b>{brief.summary.active}</b> active
                        </span>
                        {brief.summary.expiredActive > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            <b>{brief.summary.expiredActive}</b> past end date
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${brief.summary.expiringSoon > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                          <b>{brief.summary.expiringSoon}</b> expiring &lt; 60d
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${brief.summary.missingRules > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                          <b>{brief.summary.missingRules}</b> missing rules
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${brief.summary.pendingReview > 0 ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                          <b>{brief.summary.pendingReview}</b> pending review
                        </span>
                        {brief.summary.totalAnnualValue > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {formatMoney(brief.summary.totalAnnualValue)} <span className="text-indigo-500">annual</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Priorities list */}
                    {brief && brief.priorities.length > 0 && (
                      <div className="mt-3 border-t border-orange-100 pt-2" data-testid="brief-priorities">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5 inline-flex items-center gap-1">
                          <Flag className="h-3 w-3" />Top priorities
                        </div>
                        <ul className="space-y-1">
                          {brief.priorities.map((p) => {
                            const dotColor =
                              p.urgency === "high" ? "bg-rose-500"
                              : p.urgency === "med" ? "bg-amber-500"
                              : "bg-zinc-400";
                            const typeLabel =
                              p.type === "expired-active" ? "Past due"
                              : p.type === "expiring" ? "Expiring"
                              : p.type === "missing-rules" ? "Missing rules"
                              : "Pending";
                            return (
                              <li key={`${p.type}-${p.contractId}`}>
                                <Link
                                  href={`/contracts/${p.contractId}`}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-orange-50 group"
                                  data-testid={`link-priority-${p.contractId}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                                  <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0 w-20">{typeLabel}</span>
                                  <span className="text-[11px] text-zinc-900 font-medium truncate flex-1">{p.name}</span>
                                  <span className="text-[10px] text-zinc-500 shrink-0">{p.detail}</span>
                                  <ChevronRight className="h-3 w-3 text-zinc-300 group-hover:text-orange-500 shrink-0" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Proposed actions queue (Phase C) — agent-derived decisions
                  the user can accept (executes the action) or dismiss. Only
                  shown when there's something pending so a calm portfolio
                  doesn't add visual noise. */}
              {(decisionsLoading || pendingDecisions.length > 0) && (
                <div className="bg-white border border-orange-200 rounded-lg p-3 shadow-sm" data-testid="agent-decisions-panel">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Proposed actions
                      {pendingDecisions.length > 0 && (
                        <span className="ml-1 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[9px]">{pendingDecisions.length}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500">accept to apply · dismiss to suppress 30d</span>
                  </div>
                  {decisionsLoading ? (
                    <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Building queue…</div>
                  ) : (
                    <ul className="space-y-1.5" data-testid="decisions-list">
                      {pendingDecisions.map((d) => {
                        const dotColor =
                          d.urgency === "high" ? "bg-rose-500"
                          : d.urgency === "med" ? "bg-amber-500"
                          : "bg-zinc-400";
                        const typeLabel =
                          d.proposalType === "expired-active" ? "Past due"
                          : d.proposalType === "expiring" ? "Expiring"
                          : d.proposalType === "missing-rules" ? "Missing rules"
                          : "Pending";
                        const acceptLabel =
                          d.actionType === "mark-expired" ? "Mark expired"
                          : "Acknowledge";
                        const isBusy = decideMut.isPending && decideMut.variables?.id === d.id;
                        return (
                          <li key={d.id} className="flex items-start gap-2 px-2 py-2 rounded border border-zinc-100 hover:border-orange-200 hover:bg-orange-50/30" data-testid={`decision-row-${d.id}`}>
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-[10px] uppercase tracking-wide text-zinc-500">{typeLabel}</span>
                                <Link
                                  href={`/contracts/${d.contractId}`}
                                  className="text-[10px] text-orange-600 hover:text-orange-700 hover:underline"
                                  data-testid={`link-decision-contract-${d.id}`}
                                >
                                  open contract →
                                </Link>
                              </div>
                              <div className="text-[12px] text-zinc-800 leading-snug">{d.summary}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => decideMut.mutate({ id: d.id, action: "accept" })}
                                disabled={decideMut.isPending}
                                data-testid={`button-accept-${d.id}`}
                                className="text-[11px] px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-300 text-white font-semibold inline-flex items-center gap-1"
                              >
                                {isBusy && decideMut.variables?.action === "accept" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                {acceptLabel}
                              </button>
                              <button
                                onClick={() => decideMut.mutate({ id: d.id, action: "dismiss" })}
                                disabled={decideMut.isPending}
                                data-testid={`button-dismiss-${d.id}`}
                                className="text-[11px] px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                title="Suppress this proposal for 30 days"
                              >
                                {isBusy && decideMut.variables?.action === "dismiss" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Dismiss"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Thread history switcher (Phase E) — only shows when the user
                  has more than one persisted thread. Lets them jump back to a
                  past conversation without losing the current one. */}
              {(threadsData?.threads?.length ?? 0) > 1 && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-600 px-1" data-testid="thread-switcher">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Conversation:</span>
                  <select
                    value={currentThreadId ?? ""}
                    onChange={(e) => setCurrentThreadId(e.target.value || null)}
                    className="flex-1 max-w-md border border-zinc-200 rounded px-2 py-1 text-[11px] bg-white hover:border-orange-300 focus:border-orange-400 focus:outline-none"
                    data-testid="select-thread"
                  >
                    {threadsData!.threads.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {new Date(t.lastMessageAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-400">{threadsData!.threads.length} saved</span>
                </div>
              )}

              {/* Chat thread (only renders once the user has asked something) */}
              {agentMessages.length > 0 && (
                <div
                  className="bg-white border border-zinc-200 rounded-lg p-3 space-y-3 max-h-[480px] overflow-y-auto"
                  data-testid="agent-thread"
                >
                  {agentMessages.map((m, i) => (
                    <div key={i} className="flex gap-2" data-testid={`agent-msg-${i}`}>
                      {m.role === "user" ? (
                        <>
                          <div className="h-6 w-6 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold flex items-center justify-center shrink-0">YOU</div>
                          <div className="flex-1 text-[12px] text-zinc-900 bg-zinc-50 rounded px-2.5 py-1.5">{m.content}</div>
                        </>
                      ) : m.role === "assistant" ? (
                        <>
                          <div className="h-6 w-6 rounded bg-gradient-to-br from-orange-500 to-orange-700 text-white flex items-center justify-center shrink-0">
                            <Bot className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-zinc-800 leading-relaxed">
                              <FormattedAnswer content={m.content} />
                            </div>
                            {(m.toolsUsed?.length ?? 0) > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {m.toolsUsed!.map((t) => (
                                  <span key={t} className="text-[9px] uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                                    {t.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(m.sources?.length ?? 0) > 0 && (
                              <div className="mt-1.5 text-[10px] text-zinc-500 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                                {m.sources!.length} source{m.sources!.length === 1 ? "" : "s"}
                                {typeof m.confidence === "number" && (
                                  <span className="ml-1">· confidence {Math.round(m.confidence * 100)}%</span>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-6 w-6 rounded bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                          </div>
                          <div className="flex-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5">{m.content}</div>
                        </>
                      )}
                    </div>
                  ))}
                  {agentMut.isPending && (
                    <div className="flex gap-2 items-center text-[11px] text-zinc-500" data-testid="agent-loading">
                      <div className="h-6 w-6 rounded bg-orange-100 text-orange-700 flex items-center justify-center"><Loader2 className="h-3 w-3 animate-spin" /></div>
                      liQ is thinking…
                    </div>
                  )}
                  <div ref={agentEndRef} />
                </div>
              )}

              {/* Composer */}
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="flex items-end gap-2">
                  <input
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAgent(agentInput); } }}
                    placeholder="Ask anything about your contracts…"
                    data-testid="input-agent-question"
                    disabled={agentMut.isPending}
                    className="flex-1 text-[12px] px-3 py-2 rounded-md border border-zinc-200 focus:outline-none focus:border-orange-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                  <button
                    onClick={() => askAgent(agentInput)}
                    disabled={agentMut.isPending || !agentInput.trim()}
                    data-testid="button-agent-ask"
                    className="text-xs px-3 py-2 rounded-md bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-semibold inline-flex items-center gap-1.5"
                  >
                    {agentMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Ask
                  </button>
                </div>

                {/* Suggested prompts — only when the thread is empty */}
                {agentMessages.length === 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {[
                      "How many active contracts do I have?",
                      "Which contracts expire in the next 60 days?",
                      "Show contracts with the highest fee rates",
                      "List contracts that are missing rules",
                      "Summarize accrual exposure this period",
                      "What is blocking the current period close?",
                    ].map((p) => (
                      <button
                        key={p}
                        onClick={() => askAgent(p)}
                        disabled={agentMut.isPending}
                        data-testid={`button-suggest-${p.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                        className="text-left text-[11px] px-2.5 py-1.5 rounded border border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50 text-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {agentMessages.length > 0 && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => clearConversation()}
                      className="text-[10px] text-zinc-500 hover:text-orange-600 inline-flex items-center gap-1"
                      data-testid="button-agent-clear"
                      title="Archives this conversation and starts a new one. The history will still appear in your thread list."
                    >
                      <Trash2 className="h-3 w-3" /> Clear conversation
                    </button>
                  </div>
                )}
              </div>

              {/* When-to-use pedagogy — kept underneath the composer for new users */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-zinc-200 rounded p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1 mb-1"><List className="h-3 w-3" />When to use List mode</div>
                  <ul className="text-[10px] text-zinc-700 space-y-0.5 leading-snug">
                    <li>· Bulk operations</li>
                    <li>· You know exactly which contract you want</li>
                    <li>· Power-user filtering</li>
                    <li>· Reporting / audit views</li>
                  </ul>
                </div>
                <div className="bg-white border border-orange-200 rounded p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 inline-flex items-center gap-1 mb-1"><Bot className="h-3 w-3" />When to use Agent mode</div>
                  <ul className="text-[10px] text-zinc-700 space-y-0.5 leading-snug">
                    <li>· "What should I do today?"</li>
                    <li>· Complex queries spanning the portfolio</li>
                    <li>· Quick portfolio-wide lookups</li>
                    <li>· Triage / exploration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4"
          onClick={() => !deleteMutation.isPending && setConfirmDelete(null)}
          data-testid="modal-confirm-delete"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-lg shadow-xl border w-[520px] max-w-full p-5 ${confirmDelete.isProtected ? "border-rose-300" : "border-zinc-200"}`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${confirmDelete.isProtected ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-600"}`}>
                {confirmDelete.isProtected ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-900">
                  {confirmDelete.isProtected ? "Permanently delete this contract?" : "Delete this draft?"}
                </div>
                <div className="text-[12px] text-zinc-600 mt-0.5">
                  <span className="font-semibold text-zinc-800">{confirmDelete.name}</span>
                  {confirmDelete.isProtected && (
                    <> is currently <span className="font-semibold text-zinc-800">{statusMeta[confirmDelete.status]?.label || confirmDelete.status}</span>.</>
                  )}
                </div>
              </div>
            </div>

            {confirmDelete.isProtected ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 mb-3">
                <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wide mb-1.5">
                  This will permanently delete, in one transaction:
                </div>
                <ul className="text-[11.5px] text-rose-900 space-y-0.5 list-disc list-inside leading-snug">
                  <li>The contract record + uploaded PDF file</li>
                  <li>All rules, qualifiers, terms, clauses and rule conflicts</li>
                  <li>All partner / party assignments</li>
                  <li>All sales matched to this contract</li>
                  <li>All calculations, calculation runs, line items and rule results</li>
                  <li>All accruals, accrual audit trails and calculation traces</li>
                  <li>All journal entries, JE lines, ERP sync logs and reconciliation</li>
                  <li>All settlements and settlement line items</li>
                  <li>Period-close status, checklists, audit trail, blockers, variance</li>
                  <li>Extraction runs / stage results, embeddings, analysis, versions</li>
                  <li>liQ AI chat sessions and pending term mappings</li>
                </ul>
                <div className="text-[11px] text-rose-700 mt-2 font-semibold">
                  This cannot be undone. Type the contract name to confirm:
                </div>
                <input
                  type="text"
                  value={deleteAck}
                  onChange={(e) => setDeleteAck(e.target.value)}
                  placeholder={confirmDelete.name}
                  className="mt-1.5 w-full text-xs px-2 py-1.5 rounded border border-rose-300 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  data-testid="input-delete-ack"
                  autoFocus
                />
              </div>
            ) : (
              <div className="text-[12px] text-zinc-600 mb-3 pl-12">
                Its extracted clauses, rules, qualifiers and mappings will be permanently
                removed. This can't be undone.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
                className="text-xs px-3 py-1.5 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                data-testid="button-cancel-delete"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={
                  deleteMutation.isPending ||
                  (confirmDelete.isProtected && deleteAck.trim() !== confirmDelete.name.trim())
                }
                className="text-xs px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Deleting…</>
                ) : confirmDelete.isProtected ? (
                  <><Trash2 className="h-3 w-3" /> Permanently delete</>
                ) : (
                  <><Trash2 className="h-3 w-3" /> Delete draft</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <NewContractSlideOver
        open={newContractOpen}
        onOpenChange={setNewContractOpen}
      />
    </MainLayout>
  );
}
