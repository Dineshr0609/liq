import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Lock, ShieldCheck, CheckCircle2, AlertTriangle, Clock,
  Calculator, BookOpen, Handshake, Inbox, ArrowLeftRight, Receipt,
  FileText, Bot, MessageSquare, ListChecks, Pin, Loader2, Filter, Zap,
  TrendingUp, Plus, History, Check, X, RefreshCw, Flag,
} from "lucide-react";

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

interface InsightsResponse {
  contractsByFlow: { rows: any[]; totals: { contracts: number; amount: number } };
  periodVsPeriod: any;
  pinnedKpis: any[];
}

interface ChatThread {
  id: string;
  periodId: string;
  title: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: any[]; // Anthropic-style blocks
  modelProvider: string | null;
  modelName: string | null;
  createdAt: string;
}

interface ThreadDetail {
  thread: ChatThread;
  messages: ChatMessage[];
}

const fmt = (n: number | null | undefined) => {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v === 0) return "$0";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toLocaleString()}`;
};

const SUGGESTED_PROMPTS = [
  "What's the total accrual outstanding by partner?",
  "Show the top 5 contracts by accrual amount",
  "How many obligations are still pending JE posting?",
  "Sum approved settlements for this period",
  "Variance vs prior month by flow type",
];

interface CopilotViewProps {
  periodId: string;
  periodLabel: string;
  blockers: any[];
  signOff: {
    preparedBy: string | null;
    preparedAt: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    closedBy: string | null;
    closeDate: string | null;
    status: string | null;
  };
  onSwitchToWorksheet: (opts?: { status?: string }) => void;
}

export default function CopilotView({ periodId, periodLabel, blockers, signOff, onSwitchToWorksheet }: CopilotViewProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: insights } = useQuery<InsightsResponse>({
    queryKey: ["/api/period-close", periodId, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/period-close/${periodId}/insights`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load insights");
      return res.json();
    },
    enabled: !!periodId,
  });

  // Persisted threads (locked design §9: chat is private to the user; per-period scope).
  const { data: threadList = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/finance/chat-threads", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/finance/chat-threads?periodId=${periodId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load threads");
      return res.json();
    },
    enabled: !!periodId,
  });

  const createThreadMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/chat-threads", { periodId });
      return res.json() as Promise<ChatThread>;
    },
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/chat-threads", periodId] });
      setActiveThreadId(t.id);
      setShowHistory(false);
    },
    onError: (e: any) => toast({ title: "Could not start session", description: e.message, variant: "destructive" }),
  });

  // Auto-select most recent thread on first load, or create one if none exist.
  // Re-runs when the thread list arrives so we always land on something.
  useEffect(() => {
    if (!periodId || activeThreadId) return;
    if (threadList.length > 0) {
      setActiveThreadId(threadList[0].id);
    } else if (!createThreadMut.isPending) {
      createThreadMut.mutate();
    }
    // We intentionally only depend on the thread list and active id — not on
    // the mutation, which is unstable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, threadList.length, activeThreadId]);

  const { data: threadDetail, isLoading: threadLoading } = useQuery<ThreadDetail>({
    queryKey: ["/api/finance/chat-threads", activeThreadId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/finance/chat-threads/${activeThreadId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load conversation");
      return res.json();
    },
    enabled: !!activeThreadId,
  });

  const turnMut = useMutation({
    mutationFn: async (prompt: string) => {
      if (!activeThreadId) throw new Error("No active thread");
      const res = await apiRequest("POST", `/api/finance/chat-threads/${activeThreadId}/turn`, { prompt });
      return res.json() as Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/finance/chat-threads", activeThreadId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/chat-threads", periodId] });
    },
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

  // Phase 4b — AI Decision Queue. The list endpoint sweeps expired-pending
  // → expired before returning, so the UI never renders a row that the
  // approve endpoint would reject with 410.
  const { data: decisionsResp, isLoading: decisionsLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/finance/period", periodId, "decisions"],
    queryFn: async () => {
      const res = await fetch(`/api/finance/period/${periodId}/decisions?status=pending`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load decisions");
      return res.json();
    },
    enabled: !!periodId,
    refetchInterval: 30_000, // re-sweep expiry every 30s without forcing a manual refresh
  });
  const pendingDecisions = decisionsResp?.rows ?? [];

  const approveDecisionMut = useMutation({
    mutationFn: async (decisionId: string) => {
      const res = await apiRequest("POST", `/api/finance/decisions/${decisionId}/approve`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const ok = data?.ok !== false;
      toast({
        title: ok ? "Decision approved" : "Approval completed with errors",
        description: data?.batchStatus
          ? `${data.batchStatus} — ${data?.result?.succeeded ?? 0} succeeded, ${data?.result?.failed ?? 0} failed`
          : "Done",
        variant: ok ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/period", periodId, "decisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close", periodId, "obligations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close", periodId, "insights"] });
    },
    onError: async (e: any) => {
      // The 409 supersession path returns a structured error — re-fetch
      // so the now-`superseded` row drops out of the pending list.
      queryClient.invalidateQueries({ queryKey: ["/api/finance/period", periodId, "decisions"] });
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    },
  });

  const rejectDecisionMut = useMutation({
    mutationFn: async ({ decisionId, reason }: { decisionId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/finance/decisions/${decisionId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Decision rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/period", periodId, "decisions"] });
    },
    onError: (e: any) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  // Server messages → render-friendly turns. Greeting is appended client-side
  // (locked design: no system message stored on thread create — keeps the
  // append-only audit trail strictly user/assistant).
  const renderedTurns = useMemo(() => {
    const greeting = {
      kind: "greeting" as const,
      ts: "",
      text: `Good day. I'm LedgerIQ. I can answer questions about the ${periodLabel} subledger — accruals, JEs, settlements, claims, deductions, invoices. Try one of the suggestions below or ask anything.`,
    };
    const turns: Array<
      | { kind: "greeting"; ts: string; text: string }
      | { kind: "user"; ts: string; text: string; id: string }
      | { kind: "ai"; ts: string; text: string; id: string; result?: AskResult; modelProvider: string | null; error?: string }
    > = [greeting];
    for (const m of threadDetail?.messages ?? []) {
      const ts = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const block = Array.isArray(m.content) ? m.content[0] : null;
      if (m.role === "user") {
        const text = block?.type === "text" ? String(block.text ?? "") : "";
        turns.push({ kind: "user", id: m.id, ts, text });
      } else if (m.role === "assistant") {
        if (block?.type === "ask_result" && block.result) {
          const r = block.result as AskResult;
          turns.push({
            kind: "ai", id: m.id, ts, text: r.naturalLanguageAnswer,
            result: r, modelProvider: m.modelProvider,
          });
        } else if (block?.type === "error") {
          turns.push({
            kind: "ai", id: m.id, ts, text: "", modelProvider: m.modelProvider,
            error: String(block.message ?? "Something went wrong."),
          });
        }
      }
    }
    return turns;
  }, [threadDetail, periodLabel]);

  const markPreparedMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/period-close/${periodId}/mark-prepared`),
    onSuccess: () => {
      toast({ title: "Marked as Prepared" });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close/latest"] });
    },
  });
  const markReviewedMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/period-close/${periodId}/mark-reviewed`),
    onSuccess: () => {
      toast({ title: "Marked as Reviewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/period-close/latest"] });
    },
  });

  const submitDraft = () => {
    if (!draft.trim() || turnMut.isPending || !activeThreadId) return;
    turnMut.mutate(draft.trim());
  };

  // Live subledger state — derived from insights tile data + obligations counts.
  const flowAgg = insights?.contractsByFlow?.rows ?? [];
  const totalObligations = insights?.contractsByFlow?.totals?.contracts ?? 0;
  const totalAccrual = insights?.contractsByFlow?.totals?.amount ?? 0;

  // Per-stage destinations for the deep-link panel. In-period stages
  // (`worksheet:*`) switch to the Worksheet view with an optional one-shot
  // status filter; downstream stages (`route:*`) navigate to the dedicated
  // workspace pages where those subledger objects actually live.
  const sideState: Array<{
    stage: string;
    count: number;
    icon: any;
    pct: number;
    destination:
      | { kind: "worksheet"; status?: string }
      | { kind: "route"; href: string };
    hint: string;
  }> = [
    { stage: "Obligations",  count: totalObligations, icon: FileText,        pct: 100, destination: { kind: "worksheet" },                                hint: "Open in Worksheet" },
    { stage: "Accruals",     count: totalObligations, icon: Calculator,      pct: 100, destination: { kind: "worksheet", status: "Pending" },             hint: "Open accruals awaiting next step" },
    { stage: "JEs Posted",   count: totalObligations, icon: BookOpen,        pct: 95,  destination: { kind: "worksheet" },                                hint: "Open in Worksheet" },
    { stage: "Settlements",  count: totalObligations, icon: Handshake,       pct: 75,  destination: { kind: "worksheet", status: "Settled" },             hint: "Open settled obligations" },
    { stage: "Claims",       count: 0,                icon: Inbox,           pct: 0,   destination: { kind: "route", href: "/claims-workspace" },         hint: "Open Claims Workspace" },
    { stage: "Deductions",   count: 0,                icon: ArrowLeftRight,  pct: 0,   destination: { kind: "route", href: "/deductions-workspace" },     hint: "Open Deductions Workspace" },
    { stage: "Invoices",     count: 0,                icon: Receipt,         pct: 0,   destination: { kind: "route", href: "/invoices-memos" },           hint: "Open Invoices & Memos" },
  ];

  const goToStage = (s: typeof sideState[number]) => {
    if (s.destination.kind === "worksheet") {
      onSwitchToWorksheet(s.destination.status ? { status: s.destination.status } : undefined);
    } else {
      setLocation(s.destination.href);
    }
  };

  // Phase 4b: real AI Decision Queue rows. Falls back to a blockers-only
  // hint when there are no pending decisions (so the panel still
  // communicates pre-AI-proposer status). Once the LLM tool-use lands
  // and starts populating decisions, the blockers fallback becomes rare.
  const decisionRiskTone = (risk: string | null | undefined) => {
    switch (risk) {
      case "requires_controller": return { ring: "border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800", chip: "text-red-700 bg-red-100 dark:bg-red-950/40" };
      case "high":                 return { ring: "border-orange-300 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-800", chip: "text-orange-700 bg-orange-100 dark:bg-orange-950/40" };
      case "medium":               return { ring: "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800", chip: "text-amber-700 bg-amber-100 dark:bg-amber-950/40" };
      default:                     return { ring: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900", chip: "text-gray-600 bg-gray-100 dark:bg-gray-800" };
    }
  };
  const decisionActionIcon = (a: string) => {
    switch (a) {
      case "post_jes":           return BookOpen;
      case "settle_obligations": return Handshake;
      case "resolve_claims":     return Inbox;
      case "apply_deductions":   return ArrowLeftRight;
      case "reverse_accruals":   return RefreshCw;
      case "flag_blocker":       return Flag;
      case "hold_for_review":    return Clock;
      case "request_info":       return MessageSquare;
      default:                   return ListChecks;
    }
  };
  const decisionActionLabel = (a: string) => ({
    post_jes: "Post JEs",
    settle_obligations: "Settle obligations",
    resolve_claims: "Resolve claims",
    apply_deductions: "Apply deductions",
    reverse_accruals: "Reverse accruals",
    flag_blocker: "Flag as blocker",
    hold_for_review: "Hold for review",
    request_info: "Request info",
    release_obligations: "Release obligations",
  } as Record<string, string>)[a] ?? a;
  // Time-to-expire as a compact "Xh Ym" string. Negative = already expired
  // (shouldn't happen because the list endpoint sweeps first, but render
  // a clear marker if it does).
  const formatTtl = (expiresAtIso: string | null | undefined) => {
    if (!expiresAtIso) return null;
    const ms = new Date(expiresAtIso).getTime() - Date.now();
    if (ms < 0) return "expired";
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  // Reject prompts a one-line reason; cancelling aborts.
  const handleReject = (decisionId: string) => {
    const reason = window.prompt("Why are you rejecting this proposal?");
    if (!reason || !reason.trim()) return;
    rejectDecisionMut.mutate({ decisionId, reason: reason.trim() });
  };
  const blockersFallback = blockers
    .filter((b: any) => !b.resolved)
    .slice(0, 4)
    .map((b: any) => ({
      id: b.id,
      label: b.title || b.description,
      severity: b.severity,
    }));

  return (
    <div className="bg-[hsl(43,26%,95%)] dark:bg-gray-950 text-[hsl(240,20%,5%)] dark:text-gray-100 p-3 -m-4 min-h-screen font-sans">
      <div className="max-w-[1340px] mx-auto space-y-3">
        {/* Compact header */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 shadow-sm flex items-center gap-3 flex-wrap" data-testid="header-copilot">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Contract Subledger · LedgerIQ Co-Pilot
              </div>
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-50 leading-tight" data-testid="text-period-label">
                {periodLabel} Close · Conversation
              </h1>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
            </span>
            {pendingDecisions.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300" data-testid="badge-decision-queue-count">
                <Zap className="w-3 h-3" /> {pendingDecisions.length} decision{pendingDecisions.length !== 1 ? "s" : ""} in queue
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => onSwitchToWorksheet()}
              className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1"
              data-testid="button-switch-worksheet"
            >
              <Filter className="w-3 h-3" /> Switch to worksheet view
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3">
          {/* LEFT — Live subledger state + sign-off chain */}
          <aside className="col-span-3 space-y-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3 sticky top-3" data-testid="panel-live-state">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Live Subledger State</div>
                <span className="text-[9px] text-gray-400 inline-flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> live
                </span>
              </div>
              <div className="space-y-1.5">
                {sideState.map((s) => {
                  const Icon = s.icon;
                  const isExternal = s.destination.kind === "route";
                  const slug = s.stage.toLowerCase().replace(/\s+/g, "-");
                  return (
                    <button
                      key={s.stage}
                      onClick={() => goToStage(s)}
                      title={s.hint}
                      className="w-full text-left rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 p-2 hover:bg-orange-50/60 hover:border-orange-200 dark:hover:bg-orange-950/20 dark:hover:border-orange-800 transition-colors group"
                      data-testid={`state-${slug}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                          <Icon className="w-3 h-3 text-gray-500 group-hover:text-orange-600" />
                          {s.stage}
                          {isExternal && (
                            <span className="text-[8px] uppercase tracking-wider text-gray-400 group-hover:text-orange-500" data-testid={`badge-external-${slug}`}>↗</span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{s.count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white dark:bg-gray-900 rounded-full overflow-hidden">
                          <div className={`h-full ${s.pct >= 95 ? "bg-green-500" : s.pct >= 80 ? "bg-yellow-500" : "bg-orange-500"}`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{s.pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Sign-off chain */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Sign-off chain</div>
                <div className="space-y-1">
                  {[
                    { l: "Prepare", who: signOff.preparedBy, ts: signOff.preparedAt, action: () => markPreparedMut.mutate(), label: "Mark prepared", state: signOff.preparedAt ? "done" : "current" },
                    { l: "Review",  who: signOff.reviewedBy, ts: signOff.reviewedAt, action: () => markReviewedMut.mutate(), label: "Mark reviewed", state: signOff.reviewedAt ? "done" : signOff.preparedAt ? "current" : "pending" },
                    { l: "Lock",    who: signOff.closedBy,   ts: signOff.closeDate,  action: null, label: "Locked", state: signOff.status === "approved" ? "done" : "pending" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className={`flex items-center gap-2 text-[10px] px-2 py-1 rounded ${
                        s.state === "done" ? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300" :
                        s.state === "current" ? "bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 ring-1 ring-orange-200" :
                        "bg-gray-50 dark:bg-gray-800 text-gray-500"
                      }`}
                      data-testid={`signoff-${s.l.toLowerCase()}`}
                    >
                      {s.state === "done" ? <CheckCircle2 className="w-3 h-3" /> :
                       s.state === "current" ? <ShieldCheck className="w-3 h-3" /> :
                       <Lock className="w-3 h-3" />}
                      <span className="font-bold">{s.l}</span>
                      <span className="ml-auto truncate max-w-[6rem]">{s.who ?? "—"}</span>
                      {s.state === "current" && s.action && (
                        <button
                          onClick={s.action}
                          className="text-[9px] underline hover:text-orange-900"
                          data-testid={`button-${s.l.toLowerCase()}`}
                        >
                          {s.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER — Conversation */}
          <main className="col-span-6 space-y-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm" data-testid="panel-chat">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate" data-testid="text-thread-title">
                  {threadDetail?.thread?.title ?? `${periodLabel} close session`}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto" data-testid="text-thread-turns">
                  {threadDetail?.messages.length ?? 0} turn{(threadDetail?.messages.length ?? 0) !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-[10px] h-6 px-2 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 disabled:opacity-50"
                  disabled={threadList.length === 0}
                  data-testid="button-toggle-history"
                >
                  <History className="w-3 h-3" /> History {threadList.length > 0 && `(${threadList.length})`}
                </button>
                <button
                  onClick={() => createThreadMut.mutate()}
                  disabled={createThreadMut.isPending}
                  className="text-[10px] h-6 px-2 rounded bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-1 disabled:opacity-50"
                  data-testid="button-new-chat"
                >
                  <Plus className="w-3 h-3" /> New chat
                </button>
              </div>

              {showHistory && threadList.length > 0 && (
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 max-h-32 overflow-y-auto" data-testid="panel-thread-history">
                  {threadList.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveThreadId(t.id); setShowHistory(false); }}
                      className={`w-full text-left text-[11px] px-2 py-1 rounded flex items-center gap-2 hover:bg-white dark:hover:bg-gray-900 ${
                        t.id === activeThreadId ? "bg-orange-50/60 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" : "text-gray-700 dark:text-gray-300"
                      }`}
                      data-testid={`thread-${t.id}`}
                    >
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate flex-1">{t.title}</span>
                      <span className="text-[9px] text-gray-400 flex-shrink-0">
                        {new Date(t.lastMessageAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {threadLoading && !threadDetail && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-500" data-testid="indicator-loading-thread">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading conversation…
                  </div>
                )}
                {renderedTurns.map((m, i) => {
                  if (m.kind === "greeting") {
                    return (
                      <div key={`g-${i}`} className="flex items-start gap-2" data-testid="msg-greeting">
                        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-0.5">LedgerIQ</div>
                          <div className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed">{m.text}</div>
                        </div>
                      </div>
                    );
                  }
                  if (m.kind === "user") {
                    return (
                      <div key={m.id} className="flex items-start gap-2 justify-end" data-testid={`msg-user-${m.id}`}>
                        <div className="flex-1 max-w-[80%]">
                          <div className="text-[10px] text-gray-500 mb-0.5 text-right">You · {m.ts}</div>
                          <div className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg rounded-tr-sm px-3 py-2">
                            {m.text}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          You
                        </div>
                      </div>
                    );
                  }
                  // AI turn
                  return (
                    <div key={m.id} className="flex items-start gap-2" data-testid={`msg-ai-${m.id}`}>
                      <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-500 mb-0.5">
                          LedgerIQ {m.modelProvider && `· via ${m.modelProvider}`} · {m.ts}
                        </div>
                        {m.error ? (
                          <div className="text-xs text-red-700 dark:text-red-400 leading-relaxed bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                            {m.error}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed">{m.text}</div>
                        )}
                        {m.result && m.result.evaluatedResult?.value != null && (
                          <div className="mt-2 border border-orange-200 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/20 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300 mb-1">
                              <TrendingUp className="w-3 h-3" /> Computed value
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {fmt(m.result.evaluatedResult.value)}
                            </div>
                            {m.result.evaluatedResult.dimensions && m.result.evaluatedResult.dimensions.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {m.result.evaluatedResult.dimensions.slice(0, 5).map((d, j) => (
                                  <div key={j} className="flex items-center text-[11px]">
                                    <span className="text-gray-700 dark:text-gray-300">{d.key}</span>
                                    <span className="ml-auto font-semibold text-gray-900 dark:text-gray-100">{fmt(d.value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {m.result && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              onClick={() => pinMut.mutate(m.result!.resultId)}
                              disabled={!m.result.canPin || pinMut.isPending}
                              className="text-[11px] h-7 px-2.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
                              data-testid={`button-pin-${m.id}`}
                            >
                              <Pin className="w-3 h-3" /> {pinMut.isPending ? "Pinning…" : "Pin to dashboard"}
                            </button>
                            {!m.result.canPin && (
                              <span className="text-[10px] text-gray-500 italic">{m.result.pinRejectionReason ?? "Not pinnable"}</span>
                            )}
                            {m.result.citedObligationIds.length > 0 && (
                              <span className="ml-auto text-[10px] text-gray-500">
                                {m.result.citedObligationIds.length} obligation{m.result.citedObligationIds.length !== 1 ? "s" : ""} cited
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {turnMut.isPending && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 pl-9" data-testid="indicator-typing">
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                      <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                    LedgerIQ is thinking…
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-gray-100 dark:border-gray-800 p-3 bg-gray-50/40 dark:bg-gray-800/40">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p}
                      onClick={() => setDraft(p)}
                      className="text-[10px] px-2 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300 hover:text-orange-700"
                      data-testid={`button-prompt-${p.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitDraft();
                      }
                    }}
                    rows={1}
                    placeholder={`Ask LedgerIQ about ${periodLabel}…`}
                    className="flex-1 text-xs bg-transparent resize-none outline-none placeholder:text-gray-400 py-1"
                    data-testid="input-composer"
                  />
                  <button
                    onClick={submitDraft}
                    disabled={!draft.trim() || turnMut.isPending || !activeThreadId}
                    className="text-[11px] h-7 px-3 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1 font-semibold"
                    data-testid="button-send"
                  >
                    {turnMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[9px] text-gray-400">
                  <span>Every action is logged · LedgerIQ never auto-acts without your approval</span>
                </div>
              </div>
            </div>
          </main>

          {/* RIGHT — Decision queue + pinned KPIs */}
          <aside className="col-span-3 space-y-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="panel-decision-queue">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Decision Queue
                </div>
                <span className="text-[9px] text-gray-400" data-testid="text-decision-count">{pendingDecisions.length} pending</span>
              </div>
              <div className="space-y-2">
                {decisionsLoading && pendingDecisions.length === 0 && (
                  <div className="text-[11px] text-gray-500 italic py-2 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                  </div>
                )}
                {!decisionsLoading && pendingDecisions.length === 0 && blockersFallback.length === 0 && (
                  <div className="text-[11px] text-gray-500 italic py-2 flex items-center gap-2" data-testid="text-decision-empty">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> All clear — no decisions waiting
                  </div>
                )}
                {/* Real AI proposals (Phase 4b) */}
                {pendingDecisions.map((d: any) => {
                  const Icon = decisionActionIcon(d.actionType);
                  const tone = decisionRiskTone(d.riskLevel);
                  const ttl = formatTtl(d.expiresAt);
                  const affected = Array.isArray(d.affectedObligationIds) ? d.affectedObligationIds.length : 0;
                  const busyApprove = approveDecisionMut.isPending && approveDecisionMut.variables === d.id;
                  const busyReject = rejectDecisionMut.isPending && rejectDecisionMut.variables?.decisionId === d.id;
                  const busy = busyApprove || busyReject;
                  return (
                    <div
                      key={d.id}
                      className={`rounded-md border p-2 ${tone.ring}`}
                      data-testid={`decision-${d.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-300" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-gray-900 dark:text-gray-100" data-testid={`text-decision-action-${d.id}`}>
                              {decisionActionLabel(d.actionType)}
                            </span>
                            {d.riskLevel && d.riskLevel !== "low" && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${tone.chip}`} data-testid={`badge-risk-${d.id}`}>
                                {d.riskLevel.replace(/_/g, " ")}
                              </span>
                            )}
                            {ttl && (
                              <span className="text-[9px] text-gray-500 inline-flex items-center gap-0.5" data-testid={`text-ttl-${d.id}`}>
                                <Clock className="w-2.5 h-2.5" /> {ttl}
                              </span>
                            )}
                          </div>
                          {d.rationale && (
                            <p className="text-[10.5px] text-gray-700 dark:text-gray-300 leading-snug mt-0.5 line-clamp-3" data-testid={`text-rationale-${d.id}`}>
                              {d.rationale}
                            </p>
                          )}
                          <div className="text-[9.5px] text-gray-500 mt-1 flex items-center gap-2">
                            {affected > 0 && <span>{affected} obligation{affected !== 1 ? "s" : ""}</span>}
                            {d.proposedBy && <span className="truncate">by {d.proposedBy}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <button
                              onClick={() => approveDecisionMut.mutate(d.id)}
                              disabled={busy}
                              className="flex-1 text-[10px] h-6 px-2 rounded border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 hover:bg-green-100 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                              data-testid={`button-approve-${d.id}`}
                            >
                              {busyApprove ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(d.id)}
                              disabled={busy}
                              className="flex-1 text-[10px] h-6 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                              data-testid={`button-reject-${d.id}`}
                            >
                              {busyReject ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Blockers fallback — surface human-flagged items when there are no AI proposals */}
                {pendingDecisions.length === 0 && blockersFallback.length > 0 && (
                  <>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 pt-1 pb-0.5">Open blockers</div>
                    {blockersFallback.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded-md border p-2 ${
                          b.severity === "critical"
                            ? "border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                        }`}
                        data-testid={`blocker-${b.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {b.severity === "critical"
                            ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-600" />
                            : <Flag className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />}
                          <span className="text-[11px] text-gray-900 dark:text-gray-100 leading-snug">{b.label}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="panel-pinned-kpis">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                  <Pin className="w-3 h-3" /> Pinned KPIs
                </div>
                <span className="text-[9px] text-gray-400">{insights?.pinnedKpis?.length ?? 0}</span>
              </div>
              <div className="space-y-1.5">
                {(!insights?.pinnedKpis || insights.pinnedKpis.length === 0) && (
                  <div className="text-[11px] text-gray-500 italic py-2">
                    No pins yet · ask a quantitative question and pin the answer to track it
                  </div>
                )}
                {(insights?.pinnedKpis ?? []).map((p: any) => (
                  <div key={p.id} className="group relative rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 p-2" data-testid={`pinned-${p.id}`}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove pinned KPI "${p.label}"?`)) unpinMut.mutate(p.id);
                      }}
                      disabled={unpinMut.isPending}
                      title="Remove pin"
                      data-testid={`button-unpin-${p.id}`}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 pr-5">{p.label}</div>
                    {p.currentValue != null && (
                      <div className="text-base font-bold text-orange-700 dark:text-orange-300">
                        {fmt(Number(p.currentValue))}
                      </div>
                    )}
                    <div className="text-[9px] text-gray-500 truncate">{p.prompt}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Period summary */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-3" data-testid="panel-summary">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">{periodLabel} · Snapshot</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-gray-500">Obligations</span><span className="font-bold">{totalObligations}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total accrual</span><span className="font-bold">{fmt(totalAccrual)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Active blockers</span><span className={`font-bold ${blockers.filter((b: any) => !b.resolved).length > 0 ? "text-red-700" : "text-green-700"}`}>{blockers.filter((b: any) => !b.resolved).length}</span></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
