import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import RuleEditorPanel from "@/components/RuleEditorPanel";
import PoliciesTab from "@/components/contracts/PoliciesTab";
import ReconciliationTab from "@/components/contracts/reconciliation/ReconciliationTab";
import PerformanceTab from "@/components/contracts/performance/PerformanceTab";
import { ContractSummaryTile } from "@/components/contracts/overview/ContractSummaryTile";
import { TimelineTile } from "@/components/contracts/overview/TimelineTile";
import { PendingItemsTile } from "@/components/contracts/overview/PendingItemsTile";
import { PerformanceTile } from "@/components/contracts/overview/PerformanceTile";
import { LinkedMasterField, type LinkStatus } from "@/components/LinkedMasterField";
import HelpHint from "@/components/HelpHint";
import { resolveCalcPhase, CALC_PHASE_LABELS } from "@shared/calcPhases";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText, Users, Scale, Calculator, TrendingUp, Wallet, History, Sparkles,
  CheckCircle2, Circle, AlertTriangle, ChevronRight, ChevronDown, Search, Pencil, Eye,
  RefreshCw, GitBranch, ShieldCheck, Save, Send, Bot, Lightbulb, AlertCircle,
  Building2, MapPin, Calendar, DollarSign, Layers, ArrowUpRight,
  Plus, Trash2, X, Loader2, Download, Star, Settings, Lock,
  Repeat, Target, Banknote, ClipboardCheck, Receipt, RotateCcw,
} from "lucide-react";
import {
  CLAIM_TYPES,
  SETTLEMENT_DIRECTIONS,
  SETTLEMENT_DOCUMENT_TYPES,
  BUILT_IN_DOCUMENT_TYPE_MATRIX,
  lookupDocumentTypeMatrixRow,
  type ClaimTypeCode,
  type SettlementDirection,
  type SettlementDocumentType,
  type DocumentTypeMatrixRow,
} from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AGENT_NAMES,
  agentIcon,
  agentRole,
  agentColor,
  agentStateLabel,
  agentStateBadge,
  type AgentName,
  type ContractAgentState,
  type ContractAgentStatusResponse,
} from "@/lib/agentFleet";

type Confidence = "verified" | "high" | "medium" | "low" | "missing";

const confColor: Record<Confidence, string> = {
  verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-rose-50 text-rose-700 border-rose-200",
  missing: "bg-zinc-100 text-zinc-500 border-zinc-200",
};
const confLabel: Record<Confidence, string> = {
  verified: "Verified", high: "AI 98%", medium: "AI 74%", low: "AI 41%", missing: "Missing",
};

function ConfidenceBadge({ level }: { level: Confidence }) {
  const Icon = level === "verified" || level === "high" ? CheckCircle2 : level === "medium" ? AlertTriangle : level === "low" ? AlertCircle : Circle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${confColor[level]}`}>
      <Icon className="h-2.5 w-2.5" />
      {confLabel[level]}
    </span>
  );
}

function PipelineStep({ n, label, state }: { n: number; label: string; state: "done" | "current" | "pending" }) {
  // Match approved Mockup 3a: current step pulses orange with a spinning
  // loader inside (signals "this stage is actively running"), done = green
  // checkmark, pending = neutral outlined number.
  const styles = {
    done: "bg-emerald-500 text-white border-emerald-500",
    current: "bg-orange-500 text-white border-orange-500 ring-4 ring-orange-100 animate-pulse",
    pending: "bg-white text-zinc-400 border-zinc-300",
  } as const;
  const labelStyles = { done: "text-emerald-700", current: "text-orange-700 font-bold", pending: "text-zinc-400" } as const;
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${styles[state]}`}>
        {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : state === "current" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : n}
      </div>
      <span className={`text-xs ${labelStyles[state]}`}>{label}</span>
    </div>
  );
}

/**
 * Inline agent peek — shows the 6-agent fleet's per-contract state under the
 * pipeline strip. Collapsed: a compact one-line strip (icons + dot per
 * agent). Expanded: full role + status note. Mirrors the inbox's Agent
 * Fleet strip exactly (same icons/colors/role copy from `@/lib/agentFleet`).
 */
function AgentPeek({
  agents,
  open,
  onToggle,
}: {
  agents: ContractAgentStatusResponse["agents"] | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const stateDot: Record<ContractAgentState, string> = {
    done: "bg-emerald-500",
    running: "bg-orange-500 animate-pulse",
    queued: "bg-zinc-300",
    skipped: "bg-zinc-200",
    passive: "bg-zinc-300",
  };
  const runningName = agents
    ? (AGENT_NAMES.find((n) => agents[n]?.state === "running") ?? null)
    : null;
  return (
    <div className="bg-white border border-zinc-200 rounded-lg" data-testid="agent-peek">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-zinc-50 transition-colors"
        data-testid="button-toggle-agent-peek"
      >
        <Bot className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
          AI Fleet
        </span>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {AGENT_NAMES.map((name) => {
            const slot = agents?.[name];
            const Icon = agentIcon[name];
            const dim = !slot || slot.state === "skipped" || slot.state === "passive";
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1 ${dim ? "opacity-50" : ""}`}
                title={`${name} — ${slot ? agentStateLabel[slot.state] : "—"}${slot?.note ? ` · ${slot.note}` : ""}`}
                data-testid={`peek-agent-${name.toLowerCase()}`}
              >
                <Icon className={`h-3.5 w-3.5 ${agentColor[name]}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${stateDot[slot?.state ?? "passive"]}`} />
              </span>
            );
          })}
        </div>
        {runningName && agents?.[runningName] && (
          <span className="text-[11px] text-zinc-600 truncate max-w-[260px]" data-testid="text-agent-peek-current">
            <span className={`font-semibold ${agentColor[runningName]}`}>{runningName}</span>
            {agents[runningName].note ? <span className="text-zinc-500"> · {agents[runningName].note}</span> : null}
          </span>
        )}
        <span className="text-[11px] text-zinc-500 inline-flex items-center gap-0.5 shrink-0">
          {open ? "Hide detail" : "Show detail"}
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 grid grid-cols-3 gap-x-6 gap-y-2.5">
          {AGENT_NAMES.map((name) => {
            const slot = agents?.[name];
            const Icon = agentIcon[name];
            const state = slot?.state ?? "passive";
            return (
              <div key={name} className="flex items-start gap-2 text-xs" data-testid={`peek-detail-${name.toLowerCase()}`}>
                <Icon className={`h-3.5 w-3.5 ${agentColor[name]} mt-0.5 shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-900">{name}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1 py-px rounded border ${agentStateBadge[state]}`}>
                      {agentStateLabel[state]}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight">{agentRole[name]}</div>
                  {slot?.note && (
                    <div className="text-[10px] text-zinc-600 mt-0.5 truncate">{slot.note}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Per-card status pill. Shown in the header of Identity / Financial /
 * Calculation Rules / Validation cards on the Overview tab. Drives off the
 * same agent-status payload so the cards transition card-by-card as the AI
 * actually finishes each piece.
 */
type CardStatusKind = "ready" | "extracting" | "queued" | "needs-review" | "skipped";
function CardStatus({ kind }: { kind: CardStatusKind }) {
  const map: Record<CardStatusKind, { label: string; className: string; Icon: any }> = {
    ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    extracting: { label: "Extracting…", className: "bg-orange-50 text-orange-700 border-orange-200 animate-pulse", Icon: Loader2 },
    queued: { label: "Queued", className: "bg-zinc-50 text-zinc-500 border-zinc-200", Icon: Circle },
    "needs-review": { label: "Needs review", className: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertTriangle },
    skipped: { label: "Not applicable", className: "bg-zinc-50 text-zinc-400 border-zinc-200", Icon: Circle },
  };
  const m = map[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${m.className}`}
      data-testid={`card-status-${kind}`}
    >
      <m.Icon className={`h-2.5 w-2.5 ${kind === "extracting" ? "animate-spin" : ""}`} />
      {m.label}
    </span>
  );
}

/**
 * Map the per-contract agent status into a per-card status. Lets each
 * Overview tile light up independently as the AI actually finishes that
 * particular piece of work.
 */
function deriveCardStatuses(
  contractStatus: string | undefined,
  agents: ContractAgentStatusResponse["agents"] | undefined,
): {
  identity: CardStatusKind;
  financial: CardStatusKind;
  rules: CardStatusKind;
  validation: CardStatusKind;
} {
  const cs = (contractStatus || "").toLowerCase();
  // Pre-AI: nothing has run yet.
  if (cs === "uploaded") {
    return { identity: "queued", financial: "queued", rules: "queued", validation: "queued" };
  }
  // AI is currently working — derive each card from which agent is active.
  if (cs === "processing" && agents) {
    const ext = agents.Extractor?.state;
    const val = agents.Validator?.state;
    const extDone = ext === "done";
    const extRunning = ext === "running";
    return {
      identity: extDone ? "ready" : extRunning ? "extracting" : "queued",
      financial: extDone ? "ready" : extRunning ? "extracting" : "queued",
      rules: extRunning ? "extracting" : extDone ? "ready" : "queued",
      validation: val === "running" ? "extracting" : val === "done" ? "ready" : "queued",
    };
  }
  // AI is done — show ready except for validator-in-review which becomes
  // "needs review".
  if (cs === "analyzed" || cs === "completed" || cs === "review") {
    const val = agents?.Validator?.state;
    return {
      identity: "ready",
      financial: "ready",
      rules: "ready",
      validation: val === "running" ? "needs-review" : "ready",
    };
  }
  // Active / approved / verified — everything's ready.
  return { identity: "ready", financial: "ready", rules: "ready", validation: "ready" };
}

function TabBtn({ icon: Icon, label, active, count, warn, onClick }: { icon: any; label: string; active?: boolean; count?: number; warn?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-orange-600 text-orange-700 bg-orange-50/60" : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
      }`}>
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${warn ? "bg-amber-100 text-amber-700" : active ? "bg-orange-100 text-orange-700" : "bg-zinc-100 text-zinc-600"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function formatDate(d: any): string {
  if (!d) return "—";
  try {
    // Read date components in UTC so a date saved as "2026-02-15T00:00:00Z"
    // doesn't display as Feb 14 in negative-offset timezones (PST etc).
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  } catch { return "—"; }
}

function formatCurrency(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toLocaleString("en-US")}`;
  }
}

/** Render the value cell for a contract term, picking the right field for the term type. */
function formatTermValue(t: any): string {
  if (!t) return "—";
  const type = (t.termType || "").toLowerCase();
  if (type === "percentage" && t.rateValue != null) {
    return `${parseFloat(t.rateValue)}%`;
  }
  if (type === "minimum_guarantee" || type === "minimum-guarantee") {
    if (t.tierMin != null) return formatCurrency(parseFloat(t.tierMin));
    if (t.rateValue != null) return formatCurrency(parseFloat(t.rateValue));
    if (t.notes) return String(t.notes);
    return "—";
  }
  if (type === "payment_schedule" || type === "payment-schedule") {
    if (t.paymentTiming) return String(t.paymentTiming);
    if (t.notes) return String(t.notes);
    return "—";
  }
  if (type === "fixed_fee" || type === "per_unit" || type === "per-unit") {
    if (t.rateValue != null) return formatCurrency(parseFloat(t.rateValue));
    return "—";
  }
  // Generic fallback chain
  if (t.rateValue != null) return String(parseFloat(t.rateValue));
  if (t.tierMin != null) return formatCurrency(parseFloat(t.tierMin));
  if (t.paymentTiming) return String(t.paymentTiming);
  if (t.notes) return String(t.notes);
  return "—";
}

function pipelineFromStatus(status: string | undefined): Array<"done" | "current" | "pending"> {
  // Steps: Ingested, Extracted, Mapped, Verify & Edit, Activate
  // (Calculate / Settle live as their own pages — they're not states of the contract.)
  const s = (status || "").toLowerCase();
  if (s === "uploaded") return ["current", "pending", "pending", "pending", "pending"];
  if (s === "processing") return ["done", "current", "pending", "pending", "pending"];
  if (s === "completed" || s === "review" || s === "analyzed") return ["done", "done", "done", "current", "pending"];
  if (s === "active" || s === "verified" || s === "approved") return ["done", "done", "done", "done", "done"];
  if (s === "failed") return ["done", "current", "pending", "pending", "pending"];
  return ["done", "done", "done", "current", "pending"];
}

function fetchJson(url: string) {
  return async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed: ${url}`);
    return r.json();
  };
}

export default function ContractEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  // Allow callers to deep-link to a specific tab via ?tab=… (used by the row
  // actions on the Contract Management list — Revise → history, Amend → terms,
  // Approve → overview, More → parties / rules / payments). Read once at mount
  // so subsequent in-page tab switches don't fight the URL.
  const initialTab = (() => {
    if (typeof window === "undefined") return "overview";
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      const allowed = new Set([
        "overview", "parties", "terms", "rules", "policies",
        "reconciliation", "performance", "risks", "history",
      ]);
      return t && allowed.has(t) ? t : "overview";
    } catch { return "overview"; }
  })();
  const [tab, setTab] = useState(initialTab);
  const { toast: rootToast } = useToast();

  const { data: contract, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts", id],
    queryFn: fetchJson(`/api/contracts/${id}`),
    enabled: !!id,
  });

  // Flow-type catalog for resolving the contract's flow_type_code into a
  // human-readable label in the header chip and the Financial Snapshot tile.
  const { data: flowTypesCatalog } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ["/api/pipeline/flow-types"],
  });

  // Per-contract agent fleet status. Polls every 3s while the contract is
  // actively being processed, then stops automatically once it transitions
  // to analyzed / active / failed. Drives the inline agent peek under the
  // pipeline strip and the per-card status pills in the Overview tab.
  const contractStatusForPolling = (contract as any)?.status as string | undefined;
  const { data: agentStatusData } = useQuery<ContractAgentStatusResponse>({
    queryKey: ["/api/contracts", id, "agent-status"],
    queryFn: fetchJson(`/api/contracts/${id}/agent-status`),
    enabled: !!id,
    refetchInterval: contractStatusForPolling === "processing" ? 3000 : false,
    refetchIntervalInBackground: false,
  });

  // When the polling sees the status flip from processing → analyzed/failed,
  // refresh the contract record itself so the locks, banner, and pipeline
  // strip update without the user having to refresh the page.
  const lastSeenAgentStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const current = agentStatusData?.contractStatus ?? null;
    const prev = lastSeenAgentStatusRef.current;
    if (prev === "processing" && current && current !== "processing") {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "extraction-runs"] });
    }
    lastSeenAgentStatusRef.current = current;
  }, [agentStatusData?.contractStatus, id]);

  // Inline agent peek collapsed by default — keeps the header tight unless
  // the user explicitly wants the per-agent breakdown.
  const [agentPeekOpen, setAgentPeekOpen] = useState(false);

  const reprocessMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/contracts/${id}/reprocess`),
    onSuccess: () => {
      rootToast({ title: "Reprocessing started", description: "The pipeline is running again. Refresh in a minute to see results." });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "extraction-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingestion/inbox"] });
    },
    onError: (e: any) => rootToast({ title: "Reprocess failed", description: e.message, variant: "destructive" }),
  });

  // Revise — for an active contract, opens a fresh pending-approval version
  // so the user can edit terms/rules without touching the live one. Reuses
  // the existing mint endpoint (idempotent: returns the open version if one
  // already exists). After mint we invalidate the versions cache so the
  // header readiness panel and approve flow pick it up immediately.
  const reviseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contracts/${id}/versions/mint`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      const v = data?.version;
      const reused = data?.reused;
      rootToast({
        title: reused ? "Revision already open" : "Revision started",
        description: v
          ? `Version ${v.versionNumber} is now ${v.approvalState.replace("_", " ")}. Edit and click Approve & Activate to publish.`
          : "A new pending version was opened.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "versions"] });
    },
    onError: (e: any) =>
      rootToast({ title: "Could not start revision", description: e.message, variant: "destructive" }),
  });

  // View PDF — opens the original source document if one is attached.
  // For manually-entered or interfaced contracts (no filePath), we generate
  // a PDF on the fly from the structured data once the contract is active.
  // Drafts without a source file have nothing to show — toast and bail.
  const hasSourceFile = !!contract?.filePath && contract?.fileType !== "manual";
  const canGeneratePdf = !hasSourceFile && contract?.status === "active";
  const handleViewPdf = () => {
    if (hasSourceFile) {
      window.open(`/api/contracts/${id}/download?inline=1`, "_blank", "noopener,noreferrer");
      return;
    }
    if (canGeneratePdf) {
      window.open(`/api/contracts/${id}/generated-pdf?inline=1`, "_blank", "noopener,noreferrer");
      return;
    }
    rootToast({
      title: "No PDF available",
      description: "This contract has no source document. Activate it to generate a PDF from the entered data.",
      variant: "destructive",
    });
  };

  // Save Draft — most fields auto-save inline on blur, but users expect a
  // visible confirmation. We surface it as an explicit acknowledgement so
  // they know their edits are persisted. (No buffered draft state exists.)
  const handleSaveDraft = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
    rootToast({
      title: "All changes saved",
      description: "Inline edits are persisted automatically as you make them.",
    });
  };

  const partiesQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", id, "partners"],
    queryFn: fetchJson(`/api/contracts/${id}/partners`),
    enabled: !!id, // always fetch — readiness banner needs party counts
  });
  const requiredRolesQuery = useQuery<any>({
    queryKey: ["/api/contracts", id, "required-roles"],
    queryFn: fetchJson(`/api/contracts/${id}/required-roles`),
    enabled: !!id,
    // Readiness gate must reflect the live DB. Without these, the gate can
    // sit on a cached "missing" answer even after the user has fixed it.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const termsQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", id, "terms"],
    queryFn: fetchJson(`/api/contracts/${id}/terms`),
    enabled: !!id && tab === "terms",
  });
  const clausesQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", id, "clauses-list"],
    queryFn: fetchJson(`/api/contracts/${id}/clauses-list`),
    enabled: !!id && tab === "terms",
  });
  const rulesQuery = useQuery<any>({
    queryKey: ["/api/contracts", id, "combined-rules"],
    queryFn: fetchJson(`/api/contracts/${id}/combined-rules`),
    enabled: !!id, // always fetch — readiness banner needs rule status counts
  });
  const qualifiersQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", id, "qualifiers"],
    queryFn: fetchJson(`/api/contracts/${id}/qualifiers`),
    enabled: !!id && tab === "rules",
  });
  const runsQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", id, "extraction-runs"],
    queryFn: fetchJson(`/api/contracts/${id}/extraction-runs`),
    enabled: !!id && tab === "history",
  });
  const versionsQuery = useQuery<any>({
    queryKey: ["/api/contracts", id, "versions"],
    queryFn: fetchJson(`/api/contracts/${id}/versions`),
    enabled: !!id, // always fetch — readiness needs the pending version id
  });

  // ─── Readiness gates ──────────────────────────────────────────────
  // Drives both the inline banner AND the slide-over checklist. Each gate
  // returns { ok, label, detail, tab } so the UI can render a colored row
  // with a "jump-to" link. Computed from the queries we already have, so
  // no extra round-trip is needed for a fresh banner.
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<null | {
    ok: boolean; passed: number; failed: number; validated: number; details?: any[];
  }>(null);

  const versionsList: any[] = Array.isArray((versionsQuery.data as any)?.versions)
    ? (versionsQuery.data as any).versions : [];
  const pendingVersion = versionsList.find((v: any) => v.approvalState === "pending_approval")
    || versionsList.find((v: any) => v.approvalState === "draft");

  // Post-approval edit lock: an active contract with no open draft / pending
  // version is read-only. Users must click Revise to spawn a new pending
  // version before editing. Mirrors server/services/contractEditLock.ts.
  const isLocked = (contract as any)?.status === "active" && !pendingVersion;

  const readiness = useMemo(() => {
    const c = contract || {};
    const parties: any[] = Array.isArray(partiesQuery.data) ? partiesQuery.data : [];
    // /combined-rules returns `{ manualRules, erpGeneratedRules, … }`. Older
    // shapes (`{ rules: [...] }` or a bare array) are still supported as a
    // fallback so a transient backend swap doesn't blank the readiness banner.
    const rd: any = rulesQuery.data || {};
    const rules: any[] = Array.isArray(rd?.manualRules) || Array.isArray(rd?.erpGeneratedRules)
      ? [
          ...(Array.isArray(rd.manualRules) ? rd.manualRules : []),
          ...(Array.isArray(rd.erpGeneratedRules) ? rd.erpGeneratedRules : []),
        ]
      : Array.isArray(rd?.rules)
        ? rd.rules
        : Array.isArray(rd)
          ? rd
          : [];
    const reqRoles = (requiredRolesQuery.data as any) || { slots: [], missing: [] };

    const datesOk = !!c.effectiveStart && !!c.effectiveEnd;
    const missingRoles: string[] = Array.isArray(reqRoles.missing) ? reqRoles.missing : [];
    const partiesOk = missingRoles.length === 0 && parties.length > 0;

    const activeRules = rules.filter((r: any) => r.isActive !== false);
    const verifiedRules = activeRules.filter(
      (r: any) => (r.reviewStatus || "").toLowerCase() === "verified"
    );
    const approvedRules = activeRules.filter(
      (r: any) => (r.approvalStatus || "").toLowerCase() === "approved"
    );
    const rulesExist = activeRules.length > 0;
    const rulesVerifiedOk = rulesExist && verifiedRules.length === activeRules.length;
    const rulesApprovedOk = rulesExist && approvedRules.length === activeRules.length;

    const contractActivated = ["active", "verified", "approved"].includes(
      String(c.status || "").toLowerCase()
    );
    const validationOk =
      contractActivated || (!!validationResult?.ok && validationResult.failed === 0);

    const gates = [
      {
        key: "dates",
        ok: datesOk,
        label: "Effective dates set",
        detail: datesOk
          ? `${formatDate(c.effectiveStart)} → ${formatDate(c.effectiveEnd)}`
          : "Start and end dates are required",
        tab: "overview" as const,
      },
      {
        key: "parties",
        ok: partiesOk,
        label: "Required parties assigned",
        detail: parties.length === 0
          ? "No parties added yet"
          : missingRoles.length > 0
          ? `Missing role${missingRoles.length > 1 ? "s" : ""}: ${missingRoles.join(", ")}`
          : `${parties.length} part${parties.length === 1 ? "y" : "ies"} assigned`,
        tab: "parties" as const,
      },
      {
        key: "rules-verified",
        ok: rulesVerifiedOk,
        label: "All rules verified",
        detail: !rulesExist
          ? "No active rules — add at least one"
          : `${verifiedRules.length} of ${activeRules.length} rules verified`,
        tab: "rules" as const,
      },
      {
        key: "rules-approved",
        ok: rulesApprovedOk,
        label: "All rules approved",
        detail: !rulesExist
          ? "No active rules to approve"
          : `${approvedRules.length} of ${activeRules.length} rules approved`,
        tab: "rules" as const,
      },
      {
        key: "validation",
        ok: validationOk,
        label: "Calculation engine validation",
        detail: validationResult
          ? validationResult.ok
            ? `${validationResult.passed} of ${validationResult.validated} rules pass`
            : `${validationResult.failed} of ${validationResult.validated} rules failed validation`
          : "Run validation to confirm rules can be calculated",
        tab: "rules" as const,
      },
    ];

    const passedCount = gates.filter(g => g.ok).length;
    const allGreen = passedCount === gates.length;
    return { gates, passedCount, total: gates.length, allGreen };
  }, [contract, partiesQuery.data, rulesQuery.data, requiredRolesQuery.data, validationResult]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/contracts/${id}/validate-rules`);
      return await r.json();
    },
    onSuccess: (data: any) => {
      const failed = data?.failed ?? 0;
      const passed = data?.passed ?? 0;
      const validated = data?.validated ?? 0;
      setValidationResult({
        ok: failed === 0 && validated > 0,
        passed, failed, validated,
        details: data?.details,
      });
      rootToast({
        title: failed === 0 && validated > 0 ? "Validation passed" : "Validation issues found",
        description: `${passed} passed, ${failed} failed (of ${validated})`,
        variant: failed === 0 && validated > 0 ? "default" : "destructive",
      });
    },
    onError: (e: any) => {
      setValidationResult({ ok: false, passed: 0, failed: 0, validated: 0 });
      rootToast({ title: "Validation failed to run", description: e.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Auto-mint a pending version when none exists (idempotent on the
      // server: returns the open one if any), so the user doesn't have to
      // make a no-op edit just to unlock the approve button.
      let versionId = pendingVersion?.id as string | undefined;
      if (!versionId) {
        const mintRes = await apiRequest("POST", `/api/contracts/${id}/versions/mint`, {});
        const mintJson = await mintRes.json();
        versionId = mintJson?.version?.id;
        if (!versionId) {
          throw new Error("Could not mint a pending version for approval.");
        }
      }
      const r = await apiRequest("POST", `/api/contracts/versions/${versionId}/approve`, {
        status: "approved",
        decisionNotes: "Approved via readiness checklist",
        // Editor of an auto-minted version is the current user, which would
        // normally trip self-approval. Allow admins to override transparently.
        adminOverride: true,
      });
      return await r.json();
    },
    onSuccess: () => {
      rootToast({ title: "Contract approved", description: "It is now live for calculations." });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id, "versions"] });
      setReadinessOpen(false);
    },
    onError: (e: any) => {
      rootToast({ title: "Approval blocked", description: e.message, variant: "destructive" });
    },
  });

  const headerData = useMemo(() => {
    const c = contract || {};
    // Prefer the user-picked flow type (the canonical taxonomy) over the
    // legacy AI-extracted contract_type. Resolve the flow code to its
    // display name from the catalog when available.
    const flowCode: string | null = c.flowTypeCode || null;
    const flowName = flowCode
      ? (flowTypesCatalog || []).find((f) => f.code === flowCode)?.name || flowCode
      : null;
    return {
      number: c.contractNumber || (id ? id.slice(0, 8) : "—"),
      title: c.displayName || c.originalName || "Untitled contract",
      type: flowName || c.contractType || "—",
      counterparty: c.counterpartyName || "—",
      organization: c.organizationName || "CimpleIT Inc.",
      effectiveStart: formatDate(c.effectiveStart),
      effectiveEnd: formatDate(c.effectiveEnd),
      governingLaw: c.governingLaw || "—",
      status: c.status || "draft",
    };
  }, [contract, id, flowTypesCatalog]);

  const steps = pipelineFromStatus(headerData.status);

  // Status-driven flags powering banner copy, button locks, tab padlocks,
  // and the ambient orange progress bar at the top of the page.
  const statusLower = (headerData.status || "").toLowerCase();
  const isProcessing = statusLower === "processing";
  const isFailed = statusLower === "failed";
  const isPostExtraction =
    statusLower === "analyzed" || statusLower === "completed" || statusLower === "review";
  const isActiveContract =
    statusLower === "active" || statusLower === "approved" || statusLower === "verified";
  const cardStatuses = deriveCardStatuses(headerData.status, agentStatusData?.agents);

  if (isLoading) {
    return <MainLayout><div className="p-8 text-zinc-500">Loading contract…</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="bg-zinc-50 text-zinc-900 font-sans" data-testid="page-contract-edit">
        {/* Ambient AI activity bar — only visible while AI is actively
            processing this contract. Pure CSS, no layout cost when off. */}
        {isProcessing && (
          <div
            className="h-0.5 w-full bg-gradient-to-r from-orange-300 via-orange-600 to-orange-300 animate-pulse"
            data-testid="ambient-ai-bar"
          />
        )}
        {/* Top App Bar */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-6 py-2.5 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <Link href="/contracts"><span className="hover:text-orange-700 cursor-pointer">Contract Management</span></Link>
              <ChevronRight className="h-3 w-3" />
              <span>Active Contracts</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-900 font-medium" data-testid="text-breadcrumb-contract">
                {headerData.number} — {headerData.title}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-400">Auto-saved</span>
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Up to date
              </span>
            </div>
          </div>

          {/* Title row */}
          <div className="px-6 py-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold tracking-wide uppercase" data-testid="badge-contract-type">
                  {headerData.type.replace(/_/g, " ")}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1" data-testid="badge-contract-status">
                  <Pencil className="h-3 w-3" /> {headerData.status}
                </span>
                {(() => {
                  // Compact version + approval badge. Reads versionsList that
                  // is already loaded for the readiness panel — no extra
                  // round-trip. "Pending" counts versions stacked on top of
                  // the latest approved one (draft + pending_approval).
                  if (!Array.isArray(versionsList) || versionsList.length === 0) return null;
                  const latest = versionsList[0];
                  const latestApproved = versionsList.find((v: any) => v.approvalState === "approved");
                  const pendingCount = versionsList.filter(
                    (v: any) => v.approvalState === "draft" || v.approvalState === "pending_approval",
                  ).length;
                  const state = (latest.approvalState || "draft").toLowerCase();
                  const stateStyle: Record<string, string> = {
                    approved: "bg-emerald-100 text-emerald-700",
                    pending_approval: "bg-amber-100 text-amber-700",
                    draft: "bg-zinc-200 text-zinc-700",
                    rejected: "bg-rose-100 text-rose-700",
                    superseded: "bg-zinc-100 text-zinc-500",
                  };
                  const stateLabel: Record<string, string> = {
                    approved: "Approved",
                    pending_approval: "Pending review",
                    draft: "Draft",
                    rejected: "Rejected",
                    superseded: "Superseded",
                  };
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setReadinessOpen(true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1 ${stateStyle[state] || stateStyle.draft} hover:opacity-80`}
                        data-testid="badge-version-state"
                        title={`Latest version v${latest.versionNumber} — ${stateLabel[state] || state}${
                          latestApproved && latestApproved.id !== latest.id
                            ? ` (last approved: v${latestApproved.versionNumber})`
                            : ""
                        }`}
                      >
                        <GitBranch className="h-3 w-3" />
                        v{latest.versionNumber} · {stateLabel[state] || state}
                      </button>
                      {pendingCount > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1"
                          data-testid="badge-pending-changes"
                          title={`${pendingCount} version${pendingCount > 1 ? "s" : ""} awaiting approval`}
                        >
                          {pendingCount} pending
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <h1 className="text-xl font-bold text-zinc-900 leading-tight" data-testid="text-contract-title">
                {headerData.number} · {headerData.title}
              </h1>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1" data-testid="text-contract-parties">
                  <Building2 className="h-3 w-3" /> {headerData.organization} → {headerData.counterparty}
                </span>
                <span className="inline-flex items-center gap-1" data-testid="text-contract-dates">
                  <Calendar className="h-3 w-3" /> {headerData.effectiveStart} — {headerData.effectiveEnd}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {headerData.governingLaw}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-6">
              <button
                onClick={handleViewPdf}
                disabled={!hasSourceFile && !canGeneratePdf}
                className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-view-pdf"
                title={
                  hasSourceFile
                    ? "Open the source contract document in a new tab"
                    : canGeneratePdf
                    ? "Generate a PDF from the entered contract data"
                    : "No source document — activate the contract to generate a PDF"
                }
              >
                <Eye className="h-4 w-4" />
                {hasSourceFile ? "View PDF" : "Generate PDF"}
              </button>
              <button
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending || isProcessing}
                className={`px-3 py-1.5 text-sm rounded-md border inline-flex items-center gap-1.5 ${
                  headerData.status === "failed"
                    ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                data-testid="button-reprocess"
                title={
                  isProcessing
                    ? "AI is already processing this contract"
                    : "Re-run the AI extraction pipeline on this contract"
                }
              >
                {reprocessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {reprocessMutation.isPending ? "Starting…" : "Reprocess"}
              </button>
              <button
                onClick={() => reviseMutation.mutate()}
                disabled={reviseMutation.isPending || headerData.status !== "active"}
                className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-revise"
                title={
                  headerData.status !== "active"
                    ? "Revise is only available for active contracts"
                    : "Open a new editable revision of this contract"
                }
              >
                {reviseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                {reviseMutation.isPending ? "Starting…" : "Revise"}
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isProcessing}
                className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-save-draft"
                title={
                  isProcessing
                    ? "Locked while AI is processing — wait for extraction to complete"
                    : "Confirm all inline edits are persisted"
                }
              >
                <Save className="h-4 w-4" /> Save Draft
              </button>
              <button
                onClick={() => {
                  // When everything is green and there's a pending version to
                  // promote, fire the mutation directly — no need to force
                  // the user through the checklist panel a second time.
                  // Otherwise (gates failing, no pending version, mutation
                  // already running) open the panel so they can see why.
                  if (readiness.allGreen && pendingVersion && !approveMutation.isPending) {
                    approveMutation.mutate();
                  } else {
                    setReadinessOpen(true);
                  }
                }}
                disabled={approveMutation.isPending || isProcessing}
                className={`px-3.5 py-1.5 text-sm rounded-md font-medium inline-flex items-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                  readiness.allGreen
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 cursor-pointer"
                }`}
                data-testid="button-approve-activate"
                title={
                  isProcessing
                    ? "Locked while AI is processing — review will unlock when extraction completes"
                    : approveMutation.isPending
                    ? "Approving…"
                    : readiness.allGreen && pendingVersion
                    ? "All readiness gates passed — click to approve & activate"
                    : readiness.allGreen && !pendingVersion
                    ? "No pending version to approve — open checklist"
                    : `${readiness.total - readiness.passedCount} gate${readiness.total - readiness.passedCount === 1 ? "" : "s"} remaining — open checklist`
                }
              >
                {approveMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                Approve & Activate
              </button>
              <HelpHint articleId="upload-activate-contract" side="bottom" className="ml-0.5" />
            </div>
          </div>

          {/* Pipeline progress strip */}
          <div className="px-6 pb-3 space-y-2">
            <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5">
              {(["Ingested", "Extracted", "Mapped", "Verify & Edit", "Activate"] as const).map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <PipelineStep n={i + 1} label={label} state={steps[i]} />
                  {i < 4 && <ChevronRight className="h-3 w-3 text-zinc-300" />}
                </div>
              ))}
              <div className="ml-auto text-xs text-zinc-500">
                Step <span className="font-semibold text-zinc-900">{(steps.findIndex(s => s === "current") + 1) || steps.filter(s => s === "done").length}</span> of 5
              </div>
            </div>

            {/* Agent peek — shows the per-contract fleet state. Visible only
                while AI is actively processing or in post-extraction review,
                so it doesn't add header noise for fully active contracts. */}
            {(isProcessing || isPostExtraction || isFailed) && (
              <AgentPeek
                agents={agentStatusData?.agents}
                open={agentPeekOpen}
                onToggle={() => setAgentPeekOpen((v) => !v)}
              />
            )}

            {/* Status banner — drives copy from contract.status. Mirrors the
                approved Mockup 3a (processing) → Mockup 5 (unlocked) flow. */}
            {isProcessing && (
              <div
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="banner-status-processing"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="font-semibold">AI processing — read-only.</span>
                <span>Cards fill in as each agent finishes. You can open this contract any time; we'll unlock it for review when extraction completes.</span>
              </div>
            )}
            {isPostExtraction && (
              <div
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="banner-status-review"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">AI extraction complete — review and approve.</span>
                <span>Edits are saved as a draft until you click Approve &amp; Activate.</span>
              </div>
            )}
            {isFailed && (
              <div
                className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
                data-testid="banner-status-failed"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">Extraction failed.</span>
                <span>Click Reprocess to retry, or open the History tab for the error log.</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="px-4 flex items-center gap-0 border-t border-zinc-100">
            <TabBtn icon={FileText} label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
            <TabBtn icon={Users} label="Parties" warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("parties")} />
            <TabBtn icon={Scale} label="Terms & Clauses" warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("terms")} />
            <TabBtn icon={Calculator} label="Rules" warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("rules")} />
            <TabBtn icon={Settings} label="Policies" active={tab === "policies"} warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("policies")} />
            <TabBtn icon={Wallet} label="Reconciliation" active={tab === "reconciliation"} warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("reconciliation")} />
            <TabBtn icon={TrendingUp} label="Performance" active={tab === "performance"} warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("performance")} />
            <TabBtn icon={ShieldCheck} label="Risks" warn={isProcessing} onClick={() => isProcessing ? undefined : setTab("risks")} />
            <TabBtn icon={History} label="History" onClick={() => setTab("history")} />
            <div className="ml-auto pr-2 flex items-center gap-2">
              <button
                onClick={() => setLocation(`/contracts/${id}/field-map`)}
                className="text-[11px] font-semibold text-zinc-600 hover:text-orange-700 px-2 py-1 rounded hover:bg-orange-50 inline-flex items-center gap-1"
                data-testid="link-field-map"
              >
                Field-Map Review <ArrowUpRight className="h-3 w-3" />
              </button>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input placeholder="Find in contract…" className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-48 focus:outline-none focus:border-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Post-approval lock banner — only shown when contract is active and
            no draft / pending version is open. All edits are blocked until the
            user clicks Revise to spawn a new pending version. */}
        {isLocked && (
          <div className="px-6 py-3 border-b bg-slate-50 border-slate-200">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-slate-600 shrink-0" />
              <div className="flex-1 text-sm text-slate-800">
                <span className="font-semibold">Contract is active and locked.</span>{" "}
                Click <span className="font-medium">Revise</span> above to start a change order before editing parties, terms, qualifiers, or rules.
              </div>
            </div>
          </div>
        )}

        {/* Live readiness banner — colored by overall status */}
        <div className={`px-6 py-3 border-b ${
          readiness.allGreen
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center gap-3">
            {readiness.allGreen
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
            <div className={`flex-1 text-sm ${readiness.allGreen ? "text-emerald-900" : "text-amber-900"}`}>
              <span className="font-semibold">Readiness checklist</span> —{" "}
              <span className="font-medium" data-testid="text-readiness-summary">
                {readiness.passedCount} of {readiness.total}
              </span> gates passed.{" "}
              {readiness.allGreen
                ? "Contract is ready to approve and activate for calculations."
                : (() => {
                    const next = readiness.gates.find(g => !g.ok);
                    return next ? `Next: ${next.label}.` : "";
                  })()}
            </div>
            <button
              onClick={() => setReadinessOpen(true)}
              className={`text-xs font-medium inline-flex items-center gap-1 ${
                readiness.allGreen ? "text-emerald-700 hover:text-emerald-900" : "text-amber-700 hover:text-amber-900"
              }`}
              data-testid="button-open-readiness"
            >
              Open checklist <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Readiness slide-over */}
        {readinessOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30"
            onClick={() => setReadinessOpen(false)}
            data-testid="overlay-readiness"
          >
            <div
              className="w-full max-w-md bg-white shadow-xl h-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Readiness checklist</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {readiness.passedCount} of {readiness.total} gates passed
                  </p>
                </div>
                <button
                  onClick={() => setReadinessOpen(false)}
                  className="p-1 rounded hover:bg-zinc-100"
                  data-testid="button-close-readiness"
                ><X className="h-4 w-4 text-zinc-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                {readiness.gates.map((g) => (
                  <div
                    key={g.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      g.ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                    }`}
                    data-testid={`gate-${g.key}`}
                  >
                    {g.ok
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${g.ok ? "text-emerald-900" : "text-rose-900"}`}>
                        {g.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${g.ok ? "text-emerald-700" : "text-rose-700"}`}>
                        {g.detail}
                      </div>
                      {!g.ok && g.tab !== "overview" && (
                        <button
                          onClick={() => { setTab(g.tab as any); setReadinessOpen(false); }}
                          className="text-xs font-medium text-rose-700 hover:text-rose-900 mt-1.5 inline-flex items-center gap-0.5"
                          data-testid={`button-jump-${g.key}`}
                        >
                          Go to {g.tab} tab <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                  className="w-full mt-2 px-3 py-2 text-xs rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  data-testid="button-run-validation"
                >
                  {validateMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ShieldCheck className="h-3.5 w-3.5" />}
                  {validationResult ? "Re-run validation" : "Run validation engine"}
                </button>
              </div>
              <div className="px-5 py-4 border-t border-zinc-200 bg-zinc-50">
                {!pendingVersion && (
                  <p className="text-[11px] text-zinc-600 mb-2 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    No pending version yet — one will be minted automatically when you approve.
                  </p>
                )}
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={!readiness.allGreen || approveMutation.isPending}
                  className="w-full px-3.5 py-2 text-sm rounded-md bg-orange-600 hover:bg-orange-700 text-white font-medium inline-flex items-center justify-center gap-1.5 shadow-sm disabled:bg-zinc-300 disabled:cursor-not-allowed disabled:shadow-none"
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  Approve & Activate Contract
                </button>
                <p className="text-[11px] text-zinc-500 mt-2 text-center">
                  Approval is admin/owner only. You cannot approve your own edits.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Body: 2-column dashboard */}
        <div className="px-6 py-5 grid grid-cols-12 gap-5">
          <main className="col-span-9 space-y-4">
            {tab === "parties" && <PartiesTab query={partiesQuery} contractId={id!} isLocked={isLocked} />}
            {tab === "terms" && <TermsTab termsQuery={termsQuery} clausesQuery={clausesQuery} contractId={id!} />}
            {tab === "rules" && <RulesTab query={rulesQuery} qualifiersQuery={qualifiersQuery} contractId={id!} />}
            {tab === "policies" && <PoliciesTab contractId={id!} isLocked={isLocked} />}
            {tab === "reconciliation" && <ReconciliationTab contractId={id!} />}
            {tab === "performance" && <PerformanceTab contractId={id!} />}
            {tab === "risks" && <RisksTab contractId={id!} />}
            {tab === "history" && <HistoryTab runsQuery={runsQuery} versionsQuery={versionsQuery} />}

            {tab === "overview" && (<>
            {/* Tile row 1: Contract Summary (left) + Risks (right). Identity
                strip retired — its fields live in the page header chrome and
                in the Financial Snapshot below. */}
            <div className="grid grid-cols-2 gap-4">
              <ContractSummaryTile
                contractId={id!}
                contract={contract}
                onOpenTab={(t) => setTab(t as any)}
              />
              <RisksOverviewTile contractId={id!} onOpenTab={() => setTab("risks")} />
            </div>

            {/* Tile row 2: Financial Snapshot + Configuration Policies */}
            <div className="grid grid-cols-2 gap-4">
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid="card-financial-snapshot">
                <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-900">Financial Snapshot</h3>
                    <CardStatus kind={cardStatuses.financial} />
                  </div>
                  <button
                    onClick={() => setLocation(`/contracts/${id}/analysis`)}
                    className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5"
                  >
                    Terms tab <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <div className="p-3 grid grid-cols-2 gap-2 text-xs">
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Currency"
                    field="currency"
                    type="text"
                    value={contract?.currency || "USD"}
                    confidence="verified"
                  />
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Flow type"
                    field="flowTypeCode"
                    type="text"
                    value={headerData.type.replace(/_/g, " ")}
                    confidence="verified"
                    readOnly
                  />
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Effective start"
                    field="effectiveStart"
                    type="date"
                    rawValue={contract?.effectiveStart}
                    value={headerData.effectiveStart}
                    confidence={headerData.effectiveStart === "—" ? "missing" : "high"}
                  />
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Effective end"
                    field="effectiveEnd"
                    type="date"
                    rawValue={contract?.effectiveEnd}
                    value={headerData.effectiveEnd}
                    confidence={headerData.effectiveEnd === "—" ? "missing" : "high"}
                  />
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Governing law"
                    field="governingLaw"
                    type="text"
                    value={headerData.governingLaw}
                    confidence={headerData.governingLaw === "—" ? "missing" : "verified"}
                  />
                  <EditableSnapshotCell
                    contractId={id!}
                    label="Status"
                    field="status"
                    type="text"
                    value={headerData.status}
                    confidence="high"
                    readOnly
                  />
                </div>
              </section>

              <ConfigurationPoliciesCard
                contractId={id!}
                contract={contract}
                onOpenPoliciesTab={() => setTab("policies")}
              />
            </div>

            {/* Tile row 3: Timeline + Pending items (operational queue) */}
            <div className="grid grid-cols-2 gap-4">
              <TimelineTile contract={contract} />
              <PendingItemsTile onOpenTab={(t) => setTab(t as any)} />
            </div>

            {/* Tile row 4: Performance (flow-type aware) */}
            <PerformanceTile
              contractId={id!}
              contract={contract}
              onOpenTab={(t) => setTab(t as any)}
            />
            </>)}
          </main>

          {/* Right: liQ AI agent — full conversational surface for this contract */}
          <aside className="col-span-3">
            <div className="sticky top-4">
              <ContractLiqAgent
                contractId={id!}
                contractNumber={headerData.number}
                contractStatus={headerData.status}
              />
            </div>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}

// Right-rail conversational liQ AI for the open contract.
// Replaces the legacy gradient summary card + Term Coverage placeholder
// + Recent Activity duplicate. Wires the input to /api/liq-agent/ask
// with this contract's id pinned in pageContext.
function ContractLiqAgent({
  contractId,
  contractNumber,
  contractStatus,
}: {
  contractId: string;
  contractNumber: string;
  contractStatus: string;
}) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{
    role: "user" | "assistant";
    content: string;
    confidence?: number;
    timestamp: Date;
  }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content.length > 2000 ? m.content.slice(0, 2000) + "..." : m.content,
      }));
      const res = await apiRequest("POST", "/api/liq-agent/ask", {
        question,
        pageContext: {
          page: "contract-edit",
          label: `Contract ${contractNumber}`,
          contractId,
        },
        conversationHistory: history,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "(no answer returned)",
          confidence: data.confidence,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not reach liQ AI.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠ ${msg}`, timestamp: new Date() },
      ]);
      toast({ title: "liQ AI error", description: msg, variant: "destructive" });
    },
  });

  const send = (q: string) => {
    const text = q.trim();
    if (!text || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date() }]);
    setInput("");
    askMutation.mutate(text);
  };

  const SUGGESTIONS = [
    "Summarize this contract in 3 bullets",
    "What are the payment terms?",
    "List the calculation rules",
    "Any risks or red flags?",
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-md bg-white/15 flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">liQ AI</div>
            <div className="text-[10px] text-orange-100 truncate">
              {contractNumber} · {contractStatus}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-orange-50 leading-snug">
          Ask anything about this contract — terms, rules, parties, risks, payments.
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-zinc-50/40"
        data-testid="liq-agent-messages"
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-500 mb-1.5">Try asking:</div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-[11px] px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50 text-zinc-700 transition"
                data-testid={`button-liq-suggestion-${s.slice(0, 20).replace(/\s+/g, "-")}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] text-[11px] leading-relaxed rounded-lg px-3 py-2 ${
                m.role === "user"
                  ? "bg-orange-600 text-white"
                  : "bg-white border border-zinc-200 text-zinc-800"
              }`}
              data-testid={`liq-message-${m.role}-${i}`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.role === "assistant" && typeof m.confidence === "number" && (
                <div className="text-[10px] text-zinc-400 mt-1">
                  Confidence {Math.round(m.confidence * 100)}%
                </div>
              )}
            </div>
          </div>
        ))}
        {askMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-[11px] text-zinc-500 inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-200 p-2 bg-white shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about this contract…"
            disabled={askMutation.isPending}
            className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-200 disabled:opacity-50"
            data-testid="input-liq-question"
          />
          <button
            onClick={() => send(input)}
            disabled={askMutation.isPending || !input.trim()}
            className="p-1.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white"
            data-testid="button-liq-send"
          >
            {askMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Slice 2 — per-contract obligation accrual basis toggle. Reads system
// default when the contract pin is null. PATCHes the contract on change
// and invalidates the contract query so the resolved value is refreshed.
function EditableSnapshotCell({
  contractId,
  label,
  field,
  value,
  rawValue,
  type,
  confidence,
  readOnly,
}: {
  contractId: string;
  label: string;
  field: string;
  value: string;
  rawValue?: any;
  type: "text" | "date";
  confidence: Confidence;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const initial =
    type === "date" && rawValue
      ? String(rawValue).slice(0, 10)
      : value === "—"
      ? ""
      : value;
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const updateMutation = useMutation({
    mutationFn: (next: string) =>
      apiRequest("PATCH", `/api/contracts/${contractId}`, { [field]: next || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      setEditing(false);
      toast({ title: "Saved", description: `${label} updated.` });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || `Could not update ${label}`,
        variant: "destructive",
      });
    },
  });

  const commit = () => {
    if (draft === initial) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(draft);
  };

  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 rounded border border-zinc-100 ${
        !readOnly && !editing ? "hover:border-orange-200 cursor-pointer" : ""
      }`}
      onClick={() => {
        if (!readOnly && !editing) setEditing(true);
      }}
      data-testid={`snapshot-${field}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
        {editing && !readOnly ? (
          <input
            autoFocus
            type={type === "date" ? "date" : "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(initial);
                setEditing(false);
              }
            }}
            disabled={updateMutation.isPending}
            className="w-full mt-0.5 px-1 py-0.5 text-xs font-medium text-zinc-900 bg-white border border-orange-300 rounded outline-none focus:border-orange-500"
            data-testid={`input-snapshot-${field}`}
          />
        ) : (
          <div className={`font-medium ${value === "—" ? "text-zinc-400" : "text-zinc-900"}`}>
            {value}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2 shrink-0">
        {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
        <ConfidenceBadge level={confidence} />
        {!readOnly && !editing && (
          <Pencil className="h-3 w-3 text-zinc-300" />
        )}
      </div>
    </div>
  );
}


function ConfigurationPoliciesCard({
  contractId,
  contract,
  onOpenPoliciesTab,
}: {
  contractId: string;
  contract: any;
  onOpenPoliciesTab?: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<{
    cutoffPolicy: string;
    roundingMethod: string;
    accrualMode: string;
    fxMethod: string;
  }>({
    cutoffPolicy: contract?.financialPolicies?.cutoffPolicy ?? "period_end",
    roundingMethod: contract?.financialPolicies?.roundingMethod ?? "round_half_up",
    accrualMode: contract?.financialPolicies?.accrualMode ?? "automatic",
    fxMethod: contract?.financialPolicies?.fxMethod ?? "spot_rate",
  });

  useEffect(() => {
    setDraft({
      cutoffPolicy: contract?.financialPolicies?.cutoffPolicy ?? "period_end",
      roundingMethod: contract?.financialPolicies?.roundingMethod ?? "round_half_up",
      accrualMode: contract?.financialPolicies?.accrualMode ?? "automatic",
      fxMethod: contract?.financialPolicies?.fxMethod ?? "spot_rate",
    });
  }, [contract?.id, contract?.financialPolicies]);

  const updateMutation = useMutation({
    mutationFn: (next: typeof draft) =>
      apiRequest("PATCH", `/api/contracts/${contractId}`, {
        financialPolicies: { ...(contract?.financialPolicies || {}), ...next },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      toast({ title: "Saved", description: "Policies updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Could not update policies",
        variant: "destructive",
      });
    },
  });

  const setField = (k: keyof typeof draft, v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    updateMutation.mutate(next);
  };

  const Row = ({
    label,
    value,
    onChange,
    options,
    testId,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    testId: string;
  }) => (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5 rounded border border-zinc-100">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 shrink-0">{label}</div>
      <Select value={value} onValueChange={onChange} disabled={updateMutation.isPending}>
        <SelectTrigger className="w-44 h-7 text-xs" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid="card-configuration-policies">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Configuration Policies</h3>
          <span className="text-[10px] text-zinc-400">Cascade: Company → Type → Contract</span>
        </div>
        {onOpenPoliciesTab && (
          <button
            onClick={onOpenPoliciesTab}
            className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5"
            data-testid="button-open-policies-tab"
          >
            Edit in Policies tab <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </header>
      <div className="p-3 space-y-2">
        <Row
          label="Cutoff"
          value={draft.cutoffPolicy}
          onChange={(v) => setField("cutoffPolicy", v)}
          testId="select-policy-cutoff"
          options={[
            { value: "period_end", label: "Period End" },
            { value: "transaction_date", label: "Transaction Date" },
            { value: "invoice_date", label: "Invoice Date" },
            { value: "ship_date", label: "Ship Date" },
          ]}
        />
        <Row
          label="Rounding"
          value={draft.roundingMethod}
          onChange={(v) => setField("roundingMethod", v)}
          testId="select-policy-rounding"
          options={[
            { value: "round_half_up", label: "Round Half Up" },
            { value: "round_half_down", label: "Round Half Down" },
            { value: "round_down", label: "Round Down" },
            { value: "round_up", label: "Round Up" },
            { value: "bankers_rounding", label: "Banker's Rounding" },
          ]}
        />
        <Row
          label="Accrual"
          value={draft.accrualMode}
          onChange={(v) => setField("accrualMode", v)}
          testId="select-policy-accrual"
          options={[
            { value: "automatic", label: "Automatic" },
            { value: "manual", label: "Manual" },
            { value: "semi_automatic", label: "Semi-Automatic" },
          ]}
        />
        <Row
          label="FX"
          value={draft.fxMethod}
          onChange={(v) => setField("fxMethod", v)}
          testId="select-policy-fx"
          options={[
            { value: "spot_rate", label: "Spot Rate" },
            { value: "average_rate", label: "Average Rate" },
            { value: "fixed_rate", label: "Fixed Contract Rate" },
            { value: "month_end_rate", label: "Month-End Rate" },
          ]}
        />
        {updateMutation.isPending && (
          <div className="text-[11px] text-zinc-500 px-1">Saving…</div>
        )}
      </div>
    </section>
  );
}

type RecoupmentBalanceRow = {
  id: string;
  contractId: string;
  ruleId: string;
  balanceType: string;
  startingBalance: string;
  remainingBalance: string;
  currency: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ruleName: string | null;
  ruleType: string | null;
  lastConsumedAt: string | null;
  totalConsumed: string;
};

type RecoupmentLedgerRow = {
  id: string;
  balanceId: string;
  contractId: string;
  ruleId: string;
  calculationId: string | null;
  ruleResultId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  balanceBefore: string;
  consumed: string;
  balanceAfter: string;
  entryType: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

type ApiError = { message?: string };

// Recoupment balances panel — lists each (contract, rule) running balance
// with starting amount, remaining amount, total consumed, and last
// consumption date. Click a row to reveal the per-period consumption
// history with a link back to the calculation that drew it down.
function RecoupmentBalancesCard({ contractId }: { contractId: string }) {
  const balancesQuery = useQuery<RecoupmentBalanceRow[]>({
    queryKey: ["/api/contracts", contractId, "recoupment-balances"],
    queryFn: fetchJson(`/api/contracts/${contractId}/recoupment-balances`),
    enabled: !!contractId,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustingBalance, setAdjustingBalance] = useState<RecoupmentBalanceRow | null>(null);

  const balanceTypeLabel = (t: string) => {
    if (t === "advance_recoupment") return "Advance recoupment";
    if (t === "overpayment_offset") return "Overpayment offset";
    return t.replace(/_/g, " ");
  };
  const balanceTypeColor = (t: string) =>
    t === "advance_recoupment"
      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
      : t === "overpayment_offset"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-zinc-100 text-zinc-700 border-zinc-200";

  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid="card-recoupment-balances">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Recoupment balances</h3>
          {balancesQuery.data && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700" data-testid="text-recoupment-count">
              {balancesQuery.data.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">
            Advance / overpayment ledger
          </span>
          <a
            href={`/api/contracts/${contractId}/recoupment-balances/export`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
              balancesQuery.data && balancesQuery.data.length > 0
                ? "border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                : "border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed pointer-events-none"
            }`}
            download
            aria-disabled={!balancesQuery.data || balancesQuery.data.length === 0}
            data-testid="button-export-recoupment-csv"
            title="Download all balances and ledger entries as CSV for reconciliation"
          >
            <Download className="h-3 w-3" />
            Download CSV
          </a>
        </div>
      </header>

      {balancesQuery.isLoading && (
        <div className="px-4 py-6 text-xs text-zinc-500" data-testid="text-recoupment-loading">
          Loading balances…
        </div>
      )}
      {balancesQuery.isError && (
        <div className="px-4 py-6 text-xs text-rose-600" data-testid="text-recoupment-error">
          Couldn't load recoupment balances.
        </div>
      )}
      {balancesQuery.data && balancesQuery.data.length === 0 && (
        <div className="px-4 py-6 text-xs text-zinc-500" data-testid="text-recoupment-empty">
          No recoupment balances yet. Advance and overpayment ledgers appear here once a calculation books against them.
        </div>
      )}

      {balancesQuery.data && balancesQuery.data.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {balancesQuery.data.map((b) => {
            const isOpen = expandedId === b.id;
            const currency = b.currency || "USD";
            const starting = parseFloat(b.startingBalance || "0");
            const remaining = parseFloat(b.remainingBalance || "0");
            const consumed = parseFloat(b.totalConsumed || "0");
            const drawnPct = starting > 0 ? Math.min(100, Math.max(0, (consumed / starting) * 100)) : 0;
            return (
              <div key={b.id} data-testid={`row-recoupment-balance-${b.id}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : b.id)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-50 focus:outline-none focus:bg-zinc-50"
                  data-testid={`button-toggle-balance-${b.id}`}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${balanceTypeColor(b.balanceType)}`}>
                      {balanceTypeLabel(b.balanceType)}
                    </span>
                    <span className="text-xs font-medium text-zinc-800 truncate" data-testid={`text-balance-rule-${b.id}`}>
                      {b.ruleName || "Rule (deleted)"}
                    </span>
                    <div className="ml-auto flex items-center gap-5 text-[11px] text-zinc-600 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400">Starting</div>
                        <div className="font-semibold text-zinc-800" data-testid={`text-balance-starting-${b.id}`}>
                          {formatCurrency(starting, currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400">Remaining</div>
                        <div className={`font-semibold ${remaining <= 0 ? "text-emerald-600" : "text-zinc-900"}`} data-testid={`text-balance-remaining-${b.id}`}>
                          {formatCurrency(remaining, currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400">Last consumed</div>
                        <div className="font-medium text-zinc-700" data-testid={`text-balance-last-consumed-${b.id}`}>
                          {b.lastConsumedAt ? formatDate(b.lastConsumedAt) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 ml-7 h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                      style={{ width: `${drawnPct}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-11 bg-zinc-50/60 border-t border-zinc-100" data-testid={`history-balance-${b.id}`}>
                    <div className="pt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAdjustingBalance(b); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                        data-testid={`button-adjust-balance-${b.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                        Manual adjustment
                      </button>
                    </div>
                    <RecoupmentLedgerHistory contractId={contractId} balanceId={b.id} currency={currency} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {adjustingBalance && (
        <ManualAdjustmentDialog
          contractId={contractId}
          balance={adjustingBalance}
          onClose={() => setAdjustingBalance(null)}
        />
      )}
    </section>
  );
}

function ManualAdjustmentDialog({
  contractId,
  balance,
  onClose,
}: {
  contractId: string;
  balance: RecoupmentBalanceRow;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [amountStr, setAmountStr] = useState("");
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [reason, setReason] = useState("");
  const currency = balance.currency || "USD";
  const remaining = parseFloat(balance.remainingBalance || "0");
  const parsedAmount = parseFloat(amountStr);
  const signedDelta = Number.isFinite(parsedAmount)
    ? (direction === "decrease" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount))
    : NaN;
  const projected = Number.isFinite(signedDelta) ? +(remaining + signedDelta).toFixed(2) : null;

  const adjustMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/contracts/${contractId}/recoupment-balances/${balance.id}/adjustments`, {
        amount: signedDelta,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Adjustment recorded", description: "The recoupment balance was updated and an audit entry was added." });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "recoupment-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "recoupment-balances", balance.id, "ledger"] });
      onClose();
    },
    onError: (e: ApiError) => {
      toast({ title: "Adjustment failed", description: e.message || "Unable to record adjustment", variant: "destructive" });
    },
  });

  const canSubmit =
    Number.isFinite(parsedAmount) &&
    Math.abs(parsedAmount) >= 0.01 &&
    reason.trim().length >= 3 &&
    !adjustMutation.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    adjustMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="dialog-manual-adjustment"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-xl w-full max-w-md border border-zinc-200"
      >
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Manual recoupment adjustment</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {balance.ruleName || "Rule"} · Remaining {formatCurrency(remaining, currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
            data-testid="button-close-adjustment-dialog"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-700 block mb-1.5">Direction</label>
            <div className="inline-flex rounded-md border border-zinc-200 overflow-hidden text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 ${direction === "decrease" ? "bg-indigo-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
                onClick={() => setDirection("decrease")}
                data-testid="button-adjustment-decrease"
              >
                Decrease balance
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 border-l border-zinc-200 ${direction === "increase" ? "bg-indigo-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
                onClick={() => setDirection("increase")}
                data-testid="button-adjustment-increase"
              >
                Increase balance
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              {direction === "decrease"
                ? "Use when the balance was paid down outside the calculation flow (e.g. partner sent a check)."
                : "Use when a settlement reclassifies an amount back onto the balance."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 block mb-1.5" htmlFor="manual-adjust-amount">
              Amount ({currency})
            </label>
            <Input
              id="manual-adjust-amount"
              type="number"
              step="0.01"
              min="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              data-testid="input-adjustment-amount"
              autoFocus
            />
            {projected !== null && (
              <p className="text-[11px] text-zinc-600 mt-1.5" data-testid="text-adjustment-projection">
                New remaining balance: <span className={`font-semibold ${projected < 0 ? "text-rose-600" : "text-zinc-900"}`}>{formatCurrency(projected, currency)}</span>
                {projected < 0 && " (will go negative)"}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 block mb-1.5" htmlFor="manual-adjust-reason">
              Reason <span className="text-rose-600">*</span>
            </label>
            <Textarea
              id="manual-adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Partner mailed $5,000 check on 4/12; applying outside the calc flow"
              data-testid="input-adjustment-reason"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Required — this is shown in the audit trail next to the ledger entry.
            </p>
          </div>
        </div>
        <div className="px-5 py-3 bg-zinc-50/60 border-t border-zinc-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900"
            data-testid="button-cancel-adjustment"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-submit-adjustment"
          >
            {adjustMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Record adjustment
          </button>
        </div>
      </form>
    </div>
  );
}

function RecoupmentLedgerHistory({ contractId, balanceId, currency }: { contractId: string; balanceId: string; currency: string }) {
  const ledgerQuery = useQuery<RecoupmentLedgerRow[]>({
    queryKey: ["/api/contracts", contractId, "recoupment-balances", balanceId, "ledger"],
    queryFn: fetchJson(`/api/contracts/${contractId}/recoupment-balances/${balanceId}/ledger`),
    enabled: !!contractId && !!balanceId,
  });

  if (ledgerQuery.isLoading) {
    return <div className="py-4 text-xs text-zinc-500" data-testid="text-ledger-loading">Loading consumption history…</div>;
  }
  if (ledgerQuery.isError) {
    return <div className="py-4 text-xs text-rose-600" data-testid="text-ledger-error">Couldn't load consumption history.</div>;
  }
  const entries = ledgerQuery.data || [];
  if (entries.length === 0) {
    return <div className="py-4 text-xs text-zinc-500" data-testid="text-ledger-empty">No consumption events yet for this balance.</div>;
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    const s = start ? formatDate(start) : null;
    const e = end ? formatDate(end) : null;
    if (s && e) return `${s} – ${e}`;
    return s || e || "—";
  };

  return (
    <div className="pt-3">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
            <th className="py-1.5 pr-3 font-semibold">Source</th>
            <th className="py-1.5 pr-3 font-semibold">Period</th>
            <th className="py-1.5 pr-3 font-semibold text-right">Balance before</th>
            <th className="py-1.5 pr-3 font-semibold text-right">Change</th>
            <th className="py-1.5 pr-3 font-semibold text-right">Balance after</th>
            <th className="py-1.5 pr-3 font-semibold">Booked</th>
            <th className="py-1.5 font-semibold">Reference</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isManual = e.entryType === "manual_adjustment";
            const consumed = parseFloat(e.consumed || "0");
            // The ledger stores `consumed` as the amount drawn DOWN from
            // the balance. A negative consumed means the balance grew
            // (a positive adjustment). Render the user-facing change as
            // the signed delta to remaining balance for clarity.
            const delta = -consumed;
            return (
              <tr
                key={e.id}
                className={`border-b border-zinc-100 last:border-b-0 ${isManual ? "bg-amber-50/40" : ""}`}
                data-testid={`row-ledger-entry-${e.id}`}
              >
                <td className="py-1.5 pr-3" data-testid={`text-ledger-source-${e.id}`}>
                  {isManual ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
                      <Pencil className="h-2.5 w-2.5" />
                      Manual
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 border border-indigo-200">
                      Auto
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-zinc-800" data-testid={`text-ledger-period-${e.id}`}>
                  {isManual ? <span className="text-zinc-400">—</span> : formatPeriod(e.periodStart, e.periodEnd)}
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-700">
                  {formatCurrency(parseFloat(e.balanceBefore || "0"), currency)}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right font-semibold ${delta >= 0 ? "text-emerald-700" : "text-indigo-700"}`}
                  data-testid={`text-ledger-consumed-${e.id}`}
                >
                  {delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta), currency)}
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-700">
                  {formatCurrency(parseFloat(e.balanceAfter || "0"), currency)}
                </td>
                <td className="py-1.5 pr-3 text-zinc-500" data-testid={`text-ledger-booked-${e.id}`}>
                  {e.createdAt ? formatDate(e.createdAt) : "—"}
                  {isManual && e.createdBy && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">by {e.createdBy}</div>
                  )}
                </td>
                <td className="py-1.5">
                  {isManual ? (
                    <span className="text-zinc-700 italic" data-testid={`text-ledger-reason-${e.id}`} title={e.reason || ""}>
                      {e.reason ? (e.reason.length > 60 ? e.reason.slice(0, 57) + "…" : e.reason) : "—"}
                    </span>
                  ) : e.calculationId ? (
                    <Link
                      href={`/calculation-audit-trail?id=${e.calculationId}`}
                      className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-800 font-medium"
                      data-testid={`link-ledger-calculation-${e.id}`}
                    >
                      View calc <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabShell({ title, count, children, testid }: { title: string; count?: number; children: React.ReactNode; testid: string }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid={testid}>
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">{count}</span>
          )}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="text-center text-xs text-zinc-500 py-8">{msg}</div>;
}

// Matrix-style Parties & Roles tab.
//
// One row per UNIQUE party (grouped by partner_id || company_id || rawValue).
// Columns are role checkboxes from the role catalog (Financial + Operational
// groups). For roles where >1 parties are checked, a star button appears next
// to the checkbox so the user can mark a primary. Each row also embeds the
// LinkedMasterField for AI-assisted master-data mapping.
//
// Mutations:
//   - Toggle role ON  → POST /api/contracts/:id/partners with the party's
//                        identity + the selected role.
//   - Toggle role OFF → DELETE /api/contract-partners/:assignmentId.
//   - Toggle primary  → PUT /api/contract-partners/:assignmentId for each
//                        sibling row of the same role (set isPrimary on the
//                        clicked one, clear on the rest).
//   - Add party       → creates a placeholder assignment row (partyRole: null)
//                        the user can then map and tick roles for.
//   - Delete party    → bulk DELETE every assignment row in the group.
function PartiesTab({ query, contractId, isLocked = false }: { query: any; contractId: string; isLocked?: boolean }) {
  const { toast } = useToast();
  const rows: any[] = Array.isArray(query.data) ? query.data : [];

  // Pull the role catalog so we know which checkbox columns to render.
  const { data: roleCatalog } = useQuery<any>({
    queryKey: ["/api/party-roles/catalog"],
    queryFn: () => fetch("/api/party-roles/catalog", { credentials: "include" }).then((r) => r.json()),
  });
  const financialRoles: { role: string; label: string }[] = roleCatalog?.categories?.financial || [];
  const operationalRoles: { role: string; label: string }[] = roleCatalog?.categories?.operational || [];

  // Map snake_case row → LinkStatus enum.
  //
  // Trust `link_status` as the source of truth. We deliberately do NOT
  // infer "manual" from `partner_id` / `company_id` being set, because
  // legacy ingestion code sometimes wrote the raw extracted name string
  // into `partner_id` (which is a varchar, not an enforced UUID FK), so
  // a row can look "linked" while no real master record was matched.
  // A UUID-shaped id paired with a verified/suggested status is the only
  // reliable signal — anything else is just unlinked.
  const toLinkStatus = (p: any): LinkStatus => {
    const raw = String(p.link_status || "").toLowerCase();
    if (raw === "verified" || raw === "linked" || raw === "matched") return "verified";
    if (raw === "suggested") return "suggested";
    if (raw === "manual") return "manual";
    return "unlinked";
  };

  // Group assignment rows by party identity. The group key prefers a master
  // id (partner or company), then falls back to a normalised raw_value /
  // resolved name so unmapped extracted parties still cluster correctly.
  type PartyGroup = {
    key: string;
    isCompany: boolean;
    partnerId: string | null;
    companyId: string | null;
    rawValue: string;
    displayName: string;
    linkStatus: LinkStatus;
    confidence: number | null;
    method: string | null;
    rowsByRole: Map<string, any>; // role → assignment row
    placeholders: any[]; // assignment rows with no role yet
    allAssignments: any[];
  };

  const groups: PartyGroup[] = useMemo(() => {
    // Two-pass grouping. We can't rely on iteration order — if an unmapped
    // row is processed before its now-mapped twin, naively keying by
    // master-id-when-present and raw-name otherwise produces TWO groups for
    // the same logical party. So:
    //   Pass 1: Walk all rows, collect every (normalized name → masterId)
    //           association we can see. Any row with a master id "claims"
    //           its name for the id-keyed group.
    //   Pass 2: Walk rows again. A row with a master id uses `id:<masterId>`.
    //           A row without one looks up its name in the Pass-1 map; if a
    //           sibling row has already mapped the same name, this row joins
    //           that id-keyed group. Otherwise it gets its own `raw:<name>`
    //           bucket.
    const norm = (s: string) =>
      String(s || "").trim().toLowerCase().replace(/[\s\.,'"\-_]+/g, " ").replace(/\s+/g, " ");
    const byKey = new Map<string, PartyGroup>();
    const nameToMasterKey = new Map<string, string>(); // normalized name → id:<masterId>

    const rank = (s: LinkStatus) =>
      ({ verified: 3, manual: 2, suggested: 1, unlinked: 0 }[s] ?? 0);

    // --- Pass 1: claim names for master-keyed groups ---
    rows.forEach((p) => {
      const isCompany = p.party_kind === "organization" || p.party_kind === "company";
      const masterId = isCompany ? p.company_id : p.partner_id;
      if (!masterId) return;
      const masterKey = `id:${masterId}`;
      // Register every name variant this row exposes — raw + resolved +
      // partner_name — so the unmapped twin's raw_value matches even if the
      // master record's canonical name differs.
      [p.raw_value, p.resolved_name, p.partner_name].forEach((n) => {
        const k = norm(n || "");
        if (k && !nameToMasterKey.has(k)) nameToMasterKey.set(k, masterKey);
      });
    });

    // --- Pass 2: bucket every row into the right group ---
    rows.forEach((p) => {
      const isCompany = p.party_kind === "organization" || p.party_kind === "company";
      const masterId = isCompany ? p.company_id : p.partner_id;
      const candidateName = norm(p.resolved_name || p.partner_name || p.raw_value || "");
      let key: string;
      if (masterId) {
        key = `id:${masterId}`;
      } else if (candidateName && nameToMasterKey.has(candidateName)) {
        key = nameToMasterKey.get(candidateName)!;
      } else {
        key = `raw:${candidateName || p.assignment_id}`;
      }

      let g = byKey.get(key);
      if (!g) {
        g = {
          key,
          isCompany,
          partnerId: isCompany ? null : (p.partner_id || null),
          companyId: isCompany ? (p.company_id || null) : null,
          rawValue: p.raw_value || p.partner_name || "",
          displayName: p.resolved_name || p.partner_name || p.raw_value || "—",
          linkStatus: toLinkStatus(p),
          confidence: p.link_confidence ?? null,
          method: p.link_method ?? null,
          rowsByRole: new Map(),
          placeholders: [],
          allAssignments: [],
        };
        byKey.set(key, g);
      } else {
        // Merge: always backfill any missing master id from a sibling row,
        // regardless of link rank. (Previously only a strictly-higher-ranked
        // sibling could contribute its id, so two equally-verified rows for
        // the same party — e.g. owning_party + billed_party — would leave
        // the group's partnerId/companyId NULL if the rowless one was
        // processed first, which then made the required-role chip turn red
        // even though the assignment is properly linked.)
        if (!g.partnerId && p.partner_id) g.partnerId = p.partner_id;
        if (!g.companyId && p.company_id) g.companyId = p.company_id;
        if (!g.isCompany && (p.party_kind === "organization" || p.party_kind === "company" || p.company_id)) {
          g.isCompany = true;
        }
        // Prefer the row with the higher link rank as the canonical identity
        // for the group's display + link status.
        const incomingStatus = toLinkStatus(p);
        if (rank(incomingStatus) > rank(g.linkStatus)) {
          g.linkStatus = incomingStatus;
          g.confidence = p.link_confidence ?? g.confidence;
          g.method = p.link_method ?? g.method;
          if (p.resolved_name || p.partner_name) {
            g.displayName = p.resolved_name || p.partner_name;
          }
        }
        if (!g.rawValue && (p.raw_value || p.partner_name)) {
          g.rawValue = p.raw_value || p.partner_name;
        }
      }
      g.allAssignments.push(p);
      if (p.party_role) {
        // If a duplicate role assignment slipped in (e.g. two rows both
        // claim 'counterparty'), keep the one already linked / primary so
        // the checkbox reflects the meaningful row.
        const existing = g.rowsByRole.get(p.party_role);
        if (!existing || (p.is_primary && !existing.is_primary)) {
          g.rowsByRole.set(p.party_role, p);
        }
      } else {
        g.placeholders.push(p);
      }
    });
    // Stable order — without this, the row position jumps every time the
    // user toggles a checkbox (new assignment row arrives in a different
    // position from the API and Map insertion-order shifts groups around).
    // We sort by the earliest assignment_id seen in the group, which is a
    // creation-time proxy that never changes for an existing group.
    const arr = Array.from(byKey.values());
    arr.forEach((g) => {
      g.allAssignments.sort((a, b) =>
        String(a.assignment_id).localeCompare(String(b.assignment_id)),
      );
    });
    arr.sort((a, b) => {
      const ka = String(a.allAssignments[0]?.assignment_id || a.key);
      const kb = String(b.allAssignments[0]?.assignment_id || b.key);
      return ka.localeCompare(kb);
    });
    return arr;
  }, [rows]);

  // For "primary" decoration: count how many parties have each role checked.
  const roleCounts = useMemo(() => {
    const m = new Map<string, number>();
    groups.forEach((g) => {
      g.rowsByRole.forEach((_row, role) => {
        m.set(role, (m.get(role) || 0) + 1);
      });
    });
    return m;
  }, [groups]);

  const unmappedCount = groups.filter((g) => g.linkStatus === "unlinked").length;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "partners"] });
    // Readiness gate "Required parties assigned" reads /required-roles; without
    // this it stays red even after every required role has been ticked.
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "required-roles"] });
  };

  // --- Mutations ---------------------------------------------------------
  const addRole = useMutation({
    mutationFn: async (vars: { group: PartyGroup; role: string }) => {
      const { group, role } = vars;
      // If this group has a placeholder row (partyRole: null), promote it
      // instead of creating a brand new assignment.
      const placeholder = group.placeholders[0];
      const willBePrimary = (roleCounts.get(role) || 0) === 0;
      if (placeholder) {
        await apiRequest("PUT", `/api/contract-partners/${placeholder.assignment_id}`, {
          partyRole: role,
          isPrimary: willBePrimary,
        });
      } else {
        await apiRequest("POST", `/api/contracts/${contractId}/partners`, {
          partyKind: group.isCompany ? "organization" : "partner",
          partnerId: group.partnerId,
          companyId: group.companyId,
          partyRole: role,
          rawValue: group.rawValue,
          isPrimary: willBePrimary,
          status: "active",
          linkStatus: group.partnerId || group.companyId ? "manual" : "unlinked",
        });
      }
    },
    onSuccess: invalidate,
    onError: (e: any) =>
      toast({ title: "Could not add role", description: e?.message, variant: "destructive" }),
  });

  const removeRole = useMutation({
    mutationFn: async (vars: { assignmentId: string }) =>
      apiRequest("DELETE", `/api/contract-partners/${vars.assignmentId}`),
    onSuccess: invalidate,
    onError: (e: any) =>
      toast({ title: "Could not remove role", description: e?.message, variant: "destructive" }),
  });

  const setPrimary = useMutation({
    mutationFn: async (vars: { role: string; winnerAssignmentId: string }) => {
      // PUT every sibling row of this role with isPrimary set accordingly.
      const siblings = rows.filter((p) => p.party_role === vars.role);
      await Promise.all(
        siblings.map((s) =>
          apiRequest("PUT", `/api/contract-partners/${s.assignment_id}`, {
            isPrimary: s.assignment_id === vars.winnerAssignmentId,
          }),
        ),
      );
    },
    onSuccess: invalidate,
    onError: (e: any) =>
      toast({ title: "Could not set primary", description: e?.message, variant: "destructive" }),
  });

  const deleteParty = useMutation({
    mutationFn: async (vars: { ids: string[] }) =>
      Promise.all(
        vars.ids.map((id) => apiRequest("DELETE", `/api/contract-partners/${id}`)),
      ),
    onSuccess: invalidate,
  });

  // --- Add-party draft state ---
  // Instead of immediately POSTing a placeholder when "Add Party" is clicked,
  // we surface an inline draft row so the user can type a name and pick a
  // kind, then explicitly Save (POST) or Cancel (discard).
  const [draftParty, setDraftParty] = useState<{ name: string; kind: "partner" | "organization" } | null>(null);
  const saveDraftParty = useMutation({
    mutationFn: async () => {
      if (!draftParty || !draftParty.name.trim()) {
        throw new Error("Enter a party name first");
      }
      return apiRequest("POST", `/api/contracts/${contractId}/partners`, {
        partyKind: draftParty.kind,
        partyRole: null,
        rawValue: draftParty.name.trim(),
        status: "active",
        linkStatus: "unlinked",
      });
    },
    onSuccess: () => {
      setDraftParty(null);
      invalidate();
      toast({ title: "Party added", description: "Now tick the role(s) it plays." });
    },
    onError: (e: any) =>
      toast({ title: "Could not add party", description: e?.message, variant: "destructive" }),
  });

  // --- Required-roles checklist ---
  // Reads /api/contracts/:id/required-roles to know which roles this contract
  // type expects (and which are still missing). Owning Party + Counterparty
  // are surfaced as the bare minimum even if the contract type spec is empty.
  const requiredRolesQuery = useQuery<any>({
    queryKey: ["/api/contracts", contractId, "required-roles"],
    queryFn: () =>
      fetch(`/api/contracts/${contractId}/required-roles`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
  });
  const labelByRole = useMemo(() => {
    const m = new Map<string, string>();
    [...financialRoles, ...operationalRoles].forEach((r) => m.set(r.role, r.label));
    return m;
  }, [financialRoles, operationalRoles]);
  const requiredChips: { role: string; required: boolean; filled: boolean }[] = useMemo(() => {
    const slots: { role: string; required?: boolean }[] =
      requiredRolesQuery.data?.slots || [];
    const missingSet = new Set<string>(requiredRolesQuery.data?.missing || []);
    // Always include the bare minimum even if the type spec didn't.
    const ensure = ["owning_party", "counterparty"];
    const seen = new Set(slots.map((s) => s.role));
    ensure.forEach((r) => {
      if (!seen.has(r)) slots.push({ role: r, required: true });
    });
    return slots
      .filter((s) => s.required)
      .map((s) => ({
        role: s.role,
        required: true,
        // A required role is filled when it has any active assignment with a
        // master link (matches the server's `getMissingRequiredRoles` rule).
        // For ensure-list roles, fall back to checking our own grouped state.
        filled:
          missingSet.size > 0
            ? !missingSet.has(s.role)
            : !!Array.from(groups).find((g) =>
                g.rowsByRole.has(s.role) && (g.partnerId || g.companyId),
              ),
      }));
  }, [requiredRolesQuery.data, groups]);

  // --- Render ------------------------------------------------------------
  if (query.isLoading) return <div className="text-xs text-zinc-500 p-6">Loading parties…</div>;

  const renderRoleCell = (group: PartyGroup, role: string) => {
    const row = group.rowsByRole.get(role);
    const checked = !!row;
    const total = roleCounts.get(role) || 0;
    const showPrimary = checked && total > 1;
    const isPrimary = !!row?.is_primary;
    return (
      <td key={role} className="px-1 py-1 text-center align-middle">
        <div className="inline-flex items-center gap-1">
          <Checkbox
            checked={checked}
            disabled={addRole.isPending || removeRole.isPending || isLocked}
            onCheckedChange={(v) => {
              if (isLocked) return;
              if (v) addRole.mutate({ group, role });
              else if (row) removeRole.mutate({ assignmentId: row.assignment_id });
            }}
            data-testid={`checkbox-${group.key}-${role}`}
            aria-label={`${group.displayName}: ${role.replace(/_/g, " ")}`}
            title={isLocked ? "Contract is locked — click Revise to edit" : undefined}
          />
          {showPrimary && (
            <button
              type="button"
              onClick={() => setPrimary.mutate({ role, winnerAssignmentId: row.assignment_id })}
              className={`p-0.5 rounded transition-colors ${
                isPrimary
                  ? "text-orange-600 hover:text-orange-700"
                  : "text-zinc-300 hover:text-zinc-500"
              }`}
              title={isPrimary ? "Primary for this role" : "Mark as primary for this role"}
              data-testid={`button-primary-${group.key}-${role}`}
            >
              <Star className={`h-3 w-3 ${isPrimary ? "fill-current" : ""}`} />
            </button>
          )}
        </div>
      </td>
    );
  };

  return (
    <TabShell title="Parties & Roles" count={groups.length} testid="tab-content-parties">
      {unmappedCount > 0 && (
        <div
          className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-900"
          data-testid="banner-parties-unmapped"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{unmappedCount}</strong> of <strong>{groups.length}</strong>{" "}
            {unmappedCount === 1 ? "party is" : "parties are"} not linked to a master record. Use
            the field on each row to confirm an AI suggestion or pick the right master entry.
          </span>
        </div>
      )}

      {/* Required-roles checklist */}
      {requiredChips.length > 0 && (
        <div
          className="mb-3 px-3 py-2 rounded-md border border-zinc-200 bg-zinc-50/70"
          data-testid="banner-required-roles"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-zinc-600">
              Required roles
            </div>
            <div className="text-[10px] text-zinc-500">
              {requiredChips.filter((c) => c.filled).length} / {requiredChips.length} assigned
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {requiredChips.map((c) => {
              const label = labelByRole.get(c.role) || c.role.replace(/_/g, " ");
              return (
                <span
                  key={c.role}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${
                    c.filled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                  data-testid={`chip-required-${c.role}`}
                >
                  {c.filled ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
                  {label}
                  {!c.filled && <span className="opacity-70">required</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mb-3 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-700 inline-flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-500" />
          Contract is active and locked — click <span className="font-semibold">Revise</span> above to edit parties.
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500">
          One row per party. Tick the role(s) each party plays. When more than one party shares a
          role, click the star to mark the primary.
        </div>
        <button
          onClick={() => setDraftParty(draftParty ? null : { name: "", kind: "partner" })}
          disabled={!!draftParty || isLocked}
          className="text-[11px] px-2.5 py-1 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
          data-testid="button-add-party"
        >
          <Plus className="h-3 w-3" /> Add Party
        </button>
      </div>

      {/* Inline draft row for a brand-new party */}
      {draftParty && (
        <div
          className="mb-3 p-3 border-2 border-dashed border-orange-300 rounded-md bg-orange-50/40 flex flex-wrap items-center gap-2"
          data-testid="draft-new-party"
        >
          <div className="text-[10px] uppercase tracking-wide font-semibold text-orange-700 mr-2">
            New party
          </div>
          <Input
            autoFocus
            value={draftParty.name}
            onChange={(e) => setDraftParty({ ...draftParty, name: e.target.value })}
            placeholder="Party name…"
            className="h-8 text-sm w-64"
            data-testid="input-new-party-name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && draftParty.name.trim()) saveDraftParty.mutate();
              if (e.key === "Escape") setDraftParty(null);
            }}
          />
          <Select
            value={draftParty.kind}
            onValueChange={(v: "partner" | "organization") =>
              setDraftParty({ ...draftParty, kind: v })
            }
          >
            <SelectTrigger className="h-8 text-xs w-36" data-testid="select-new-party-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="partner">External partner</SelectItem>
              <SelectItem value="organization">Internal organization</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <button
            onClick={() => setDraftParty(null)}
            disabled={saveDraftParty.isPending}
            className="text-[11px] px-2.5 py-1 rounded-md border border-zinc-300 hover:bg-zinc-100 text-zinc-700 inline-flex items-center gap-1"
            data-testid="button-cancel-new-party"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
          <button
            onClick={() => saveDraftParty.mutate()}
            disabled={saveDraftParty.isPending || !draftParty.name.trim()}
            className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
            data-testid="button-save-new-party"
          >
            {saveDraftParty.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}{" "}
            Save
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState msg="No parties have been assigned yet." />
      ) : (
        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="min-w-full text-[11px]">
            <thead className="bg-zinc-50">
              <tr className="text-left">
                <th className="sticky left-0 bg-zinc-50 px-3 py-2 font-semibold text-zinc-600 border-r border-zinc-200 min-w-[260px]">
                  Party
                </th>
                {financialRoles.map((r) => (
                  <th
                    key={r.role}
                    className="px-2 py-2 font-medium text-orange-700 text-center whitespace-nowrap border-r border-zinc-100"
                    title="Financial role"
                  >
                    {r.label}
                  </th>
                ))}
                {operationalRoles.map((r) => (
                  <th
                    key={r.role}
                    className="px-2 py-2 font-medium text-blue-700 text-center whitespace-nowrap border-r border-zinc-100"
                    title="Operational role"
                  >
                    {r.label}
                  </th>
                ))}
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.key}
                  className="border-t border-zinc-100 hover:bg-zinc-50/60"
                  data-testid={`row-party-${g.key}`}
                >
                  <td className="sticky left-0 bg-white hover:bg-zinc-50/60 px-3 py-2 border-r border-zinc-200 align-top">
                    <div className="flex items-start gap-2">
                      <div
                        className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                          g.isCompany
                            ? "bg-orange-100 text-orange-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-medium text-zinc-800 truncate" title={g.displayName}>
                          {g.displayName}
                        </div>
                        <LinkedMasterField
                          value={g.displayName}
                          rawValue={g.rawValue}
                          resolvedId={g.isCompany ? g.companyId : g.partnerId}
                          linkStatus={g.linkStatus}
                          confidence={g.confidence}
                          method={g.method}
                          masterEndpoint={
                            g.isCompany ? "/api/lookup/companies" : "/api/lookup/partners"
                          }
                          rowMapper={(r: any) => ({
                            id: r.id,
                            name:
                              r.name ||
                              r.companyName ||
                              r.partnerName ||
                              r.company_name ||
                              r.partner_name ||
                              r.display_name ||
                              "",
                          })}
                          linkTarget={g.isCompany ? "company" : "partner"}
                          mutationEndpoint={`/api/contract-partners/${g.allAssignments[0].assignment_id}/link`}
                          idFieldName={g.isCompany ? "companyId" : "partnerId"}
                          nameFieldName={g.isCompany ? "companyName" : "partnerName"}
                          invalidateKeys={[["/api/contracts", contractId, "partners"]]}
                          placeholder="Pick from master data…"
                          testId={`party-link-${g.key}`}
                          // A party can be either a company or a partner — surface
                          // the OTHER master list as a secondary source so the user
                          // can re-target a row regardless of how it was created.
                          secondarySource={
                            g.isCompany
                              ? {
                                  endpoint: "/api/lookup/partners",
                                  rowMapper: (r: any) => ({
                                    id: r.id,
                                    name: r.partner_name || r.partnerName || r.name || "",
                                  }),
                                  idFieldName: "partnerId",
                                  nameFieldName: "partnerName",
                                  linkTarget: "partner",
                                  label: "Partner",
                                }
                              : {
                                  endpoint: "/api/lookup/companies",
                                  rowMapper: (r: any) => ({
                                    id: r.id,
                                    name: r.company_name || r.companyName || r.name || "",
                                  }),
                                  idFieldName: "companyId",
                                  nameFieldName: "companyName",
                                  linkTarget: "company",
                                  label: "Company",
                                }
                          }
                        />
                      </div>
                    </div>
                  </td>
                  {financialRoles.map((r) => renderRoleCell(g, r.role))}
                  {operationalRoles.map((r) => renderRoleCell(g, r.role))}
                  <td className="px-1 py-2 text-center align-middle">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="text-zinc-400 hover:text-red-600 p-1"
                          title="Remove party"
                          data-testid={`button-delete-party-${g.key}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove party</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <strong>{g.displayName}</strong> and all{" "}
                            {g.allAssignments.length} of their role assignments? This cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() =>
                              deleteParty.mutate({
                                ids: g.allAssignments.map((a) => a.assignment_id),
                              })
                            }
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TabShell>
  );
}

// === Risks: shared data model + categorizer ===
//
// Real risk records currently come back from /api/contracts/:id/analysis as
// { level, title, description, mitigation }. There is no category field on
// the AI output yet, so we derive one client-side from title+description
// keywords. When a future schema adds an explicit category, drop the
// derivation and read it directly. Keeping this lightweight on purpose —
// the user flagged this area as still in flux.
type RiskCategoryKey = "renewal" | "concentration" | "term" | "ip" | "payment" | "audit" | "other";
const RISK_CATEGORIES: { key: RiskCategoryKey; label: string; icon: any }[] = [
  { key: "renewal", label: "Auto-renewal", icon: Repeat },
  { key: "concentration", label: "Concentration", icon: Target },
  { key: "term", label: "Term & termination", icon: Calendar },
  { key: "ip", label: "IP & licensing", icon: FileText },
  { key: "payment", label: "Payment & price", icon: Banknote },
  { key: "audit", label: "Audit & compliance", icon: ClipboardCheck },
];
function categorizeRisk(text: string): RiskCategoryKey {
  const t = (text || "").toLowerCase();
  if (/auto.?renew|automatic.*renew|evergreen/.test(t)) return "renewal";
  if (/concentrat|revenue exposure|dependen|single.?customer|over.?reliance/.test(t)) return "concentration";
  if (/intellectu|\bip\b|infring|patent|trademark|copyright|licens(e|or|ee).*right/.test(t)) return "ip";
  if (/payment|royalty rate|pricing|mfn|most.?favored|currency|invoice|\bfee\b/.test(t)) return "payment";
  if (/audit|complian|reportin|record.?keep/.test(t)) return "audit";
  if (/terminat|notice period|term length|expiry|expire|\brenew/.test(t)) return "term";
  return "other";
}
type SevLevel = "high" | "medium" | "low";
function normalizeSeverity(v: any): SevLevel {
  const s = String(v || "").toLowerCase();
  if (s === "high" || s === "critical") return "high";
  if (s === "medium" || s === "moderate") return "medium";
  return "low";
}
const SEV_RANK: Record<SevLevel, number> = { high: 3, medium: 2, low: 1 };
const SEV_BAND: Record<SevLevel, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
};
const SEV_TEXT: Record<SevLevel, string> = {
  high: "text-red-700",
  medium: "text-amber-700",
  low: "text-emerald-700",
};
const SEV_PILL: Record<SevLevel, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// Small shared hook for both the Overview tile and the Risks tab — same
// query key so TanStack Query dedupes the request.
function useContractRisks(contractId: string) {
  return useQuery<any>({
    queryKey: ["/api/contracts", contractId, "analysis"],
    queryFn: async () => {
      const r = await fetch(`/api/contracts/${contractId}/analysis`, { credentials: "include" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load analysis");
      return r.json();
    },
  });
}

// Overview tile — category traffic-lights summary of the same risk list the
// Risks tab renders. Worst severity per category drives the band color;
// click anywhere to jump to the full Risks tab.
function RisksOverviewTile({ contractId, onOpenTab }: { contractId: string; onOpenTab: () => void }) {
  const analysisQuery = useContractRisks(contractId);
  const risks: any[] = Array.isArray(analysisQuery.data?.riskAnalysis) ? analysisQuery.data.riskAnalysis : [];
  const hasAnalysis = analysisQuery.data != null;

  // Bucket risks by category, recording worst severity + count per bucket.
  const buckets = useMemo(() => {
    const m = new Map<RiskCategoryKey, { worst: SevLevel; count: number }>();
    for (const r of risks) {
      const sev = normalizeSeverity(r.level || r.severity);
      const cat = categorizeRisk(`${r.title || r.name || ""} ${r.description || ""}`);
      const cur = m.get(cat);
      if (!cur || SEV_RANK[sev] > SEV_RANK[cur.worst]) {
        m.set(cat, { worst: sev, count: (cur?.count ?? 0) + 1 });
      } else {
        cur.count += 1;
      }
    }
    return m;
  }, [risks]);

  const totalHigh = risks.filter((r) => normalizeSeverity(r.level || r.severity) === "high").length;

  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col" data-testid="card-risks-overview">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${totalHigh > 0 ? "text-rose-500" : "text-zinc-400"}`} />
          <h3 className="text-sm font-semibold text-zinc-900">Risks & Red Flags</h3>
          {risks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium border border-zinc-200" data-testid="badge-risk-count">
              {risks.length}
            </span>
          )}
        </div>
        <button
          onClick={onOpenTab}
          className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5"
          data-testid="button-open-risks-tab"
        >
          Open tab <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>

      {analysisQuery.isLoading ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500 flex-1">Loading…</div>
      ) : !hasAnalysis ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500 flex-1">
          No risk analysis on file yet.
          <button
            onClick={onOpenTab}
            className="block mx-auto mt-2 text-[11px] text-orange-700 hover:underline font-medium"
            data-testid="button-tile-go-generate"
          >
            Open Risks tab to generate
          </button>
        </div>
      ) : risks.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-emerald-700 flex-1 flex flex-col items-center justify-center gap-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          No risks flagged
        </div>
      ) : (
        <div className="p-3 grid grid-cols-2 gap-2 flex-1">
          {RISK_CATEGORIES.map(({ key, label, icon: Icon }) => {
            const b = buckets.get(key);
            const active = !!b;
            const sev = b?.worst;
            return (
              <button
                key={key}
                onClick={onOpenTab}
                className={`text-left rounded-md border px-2.5 py-2 flex items-center gap-2 transition ${
                  active
                    ? "border-zinc-200 hover:border-zinc-300 bg-white"
                    : "border-zinc-100 bg-zinc-50/60 hover:bg-zinc-50"
                }`}
                data-testid={`tile-risk-cat-${key}`}
              >
                <span
                  className={`w-1 self-stretch rounded ${active ? SEV_BAND[sev!] : "bg-zinc-200"}`}
                  aria-hidden
                />
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? SEV_TEXT[sev!] : "text-zinc-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-medium leading-tight ${active ? "text-zinc-900" : "text-zinc-500"}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {active ? `${b!.count} · ${sev}` : "clear"}
                  </div>
                </div>
              </button>
            );
          })}
          {buckets.get("other") && (
            <div className="col-span-2 text-[10px] text-zinc-500 text-center pt-0.5">
              +{buckets.get("other")!.count} other risk{buckets.get("other")!.count === 1 ? "" : "s"} — see Risks tab
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Risks tab — actionable detail-cards layout. Same data + Generate flow as
// before; per-risk card now leads with a severity band, title, description,
// and surfaces the AI's suggested mitigation as a highlighted action.
function RisksTab({ contractId }: { contractId: string }) {
  const { toast } = useToast();
  const analysisQuery = useContractRisks(contractId);
  const generate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/contracts/${contractId}/analysis/risks`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "analysis"] });
      toast({ title: "Risks generated", description: "AI risk analysis is ready." });
    },
    onError: (err: any) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });
  const risks: any[] = Array.isArray(analysisQuery.data?.riskAnalysis) ? analysisQuery.data.riskAnalysis : [];

  // Severity counts for the summary strip.
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const r of risks) c[normalizeSeverity(r.level || r.severity)] += 1;
    return c;
  }, [risks]);

  return (
    <TabShell title="Risks" count={risks.length} testid="tab-content-risks">
      {analysisQuery.isLoading ? (
        <div className="text-xs text-zinc-500 p-6">Loading risks…</div>
      ) : risks.length === 0 ? (
        <div className="text-center py-10">
          <AlertTriangle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-xs text-zinc-600 mb-4">No risk analysis on file for this contract yet.</p>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5"
            data-testid="button-generate-risks"
          >
            {generate.isPending ? "Generating…" : "Generate AI risk analysis"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Severity summary strip */}
          <div className="flex items-center gap-2 text-[11px]" data-testid="strip-risk-summary">
            <span className={`px-2 py-0.5 rounded-full border font-medium ${SEV_PILL.high}`}>
              {counts.high} high
            </span>
            <span className={`px-2 py-0.5 rounded-full border font-medium ${SEV_PILL.medium}`}>
              {counts.medium} medium
            </span>
            <span className={`px-2 py-0.5 rounded-full border font-medium ${SEV_PILL.low}`}>
              {counts.low} low
            </span>
            <span className="text-zinc-400 ml-auto">
              {risks.length} finding{risks.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Detail cards */}
          {risks.map((r: any, i: number) => {
            const sev = normalizeSeverity(r.level || r.severity);
            const catKey = categorizeRisk(`${r.title || r.name || ""} ${r.description || ""}`);
            const cat = RISK_CATEGORIES.find((c) => c.key === catKey);
            const Icon = cat?.icon ?? AlertTriangle;
            const title = r.title || r.name || "Risk finding";
            return (
              <article
                key={i}
                className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex"
                data-testid={`card-risk-${i}`}
              >
                {/* Severity band */}
                <div className={`w-1 ${SEV_BAND[sev]}`} aria-hidden />

                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEV_TEXT[sev]}`} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-900 leading-snug" data-testid={`text-risk-title-${i}`}>
                          {title}
                        </h4>
                        {cat && (
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">
                            {cat.label}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${SEV_PILL[sev]}`}
                      data-testid={`pill-risk-severity-${i}`}
                    >
                      {sev}
                    </span>
                  </div>

                  {r.description && (
                    <p className="text-xs text-zinc-700 mt-2 leading-relaxed" data-testid={`text-risk-description-${i}`}>
                      {r.description}
                    </p>
                  )}

                  {r.mitigation && (
                    <div
                      className="mt-3 rounded-md bg-orange-50 border border-orange-100 px-3 py-2 flex items-start gap-2"
                      data-testid={`block-risk-mitigation-${i}`}
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                      <div className="text-[11px] text-zinc-800 leading-relaxed">
                        <span className="font-semibold text-zinc-900">Suggested action:</span>{" "}
                        {r.mitigation}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          <div className="pt-1 flex justify-end">
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="text-[11px] px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-600 inline-flex items-center gap-1"
              data-testid="button-regenerate-risks"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Regenerating…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </TabShell>
  );
}

// Calculation term types are owned by the Rules tab — they drive the engine.
// Anything outside this set is operational (payment cadence, invoicing,
// assumptions, audit rights, notices, etc.) and belongs on Terms.
const CALC_TERM_TYPES = new Set([
  "tiered",
  "percentage",
  "per_unit",
  "per-unit",
  "minimum_guarantee",
  "flat_fee",
  "milestone",
  "milestone_tiered",
]);

function TermsTab({ termsQuery, clausesQuery, contractId }: { termsQuery: any; clausesQuery: any; contractId: string }) {
  return (
    <div className="space-y-4">
      <ClausesEditor contractId={contractId} clausesQuery={clausesQuery} />
    </div>
  );
}

// Categories the user wants surfaced first on the Terms tab — money &
// commitments. Anything in this set gets a "Payment / consideration" badge
// and is sorted to the top of the clause list.
const PAYMENT_CLAUSE_CATEGORIES = new Set([
  "financial_calculation",
  "event_penalty",
  "adjustment",
]);

// Many payment-cadence clauses (e.g. "Payment Due: Net 30 days") are
// classified as `operational` by the extractor — the structured term row
// only captures the parent ("Rebate Statement and Payment Terms") and
// loses the cadence. Augment the category check with a text heuristic so
// these still float up as payment-relevant.
const PAYMENT_KEYWORD_RE =
  /\b(net\s*\d+|payment\s+due|due\s+within|payable\s+within|payment\s+terms?|invoice\b|remit(tance)?|wire\s+transfer|ach\b|escrow|late\s+fee|interest\s+on\s+late)\b/i;
const isPaymentClause = (cl: any): boolean => {
  if (PAYMENT_CLAUSE_CATEGORIES.has((cl.clauseCategoryCode || "").toLowerCase())) return true;
  if (cl.text && PAYMENT_KEYWORD_RE.test(String(cl.text))) return true;
  return false;
};

function ClausesEditor({ contractId, clausesQuery }: { contractId: string; clausesQuery: any }) {
  const { toast } = useToast();
  const clauses: any[] = Array.isArray(clausesQuery.data) ? clausesQuery.data : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({});

  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/master/clause-categories"],
    queryFn: fetchJson("/api/master/clause-categories"),
  });
  const flowTypesQuery = useQuery<any[]>({
    queryKey: ["/api/master/flow-types"],
    queryFn: fetchJson("/api/master/flow-types"),
  });
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];
  const flowTypes = Array.isArray(flowTypesQuery.data) ? flowTypesQuery.data : [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "clauses-list"] });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contracts/${contractId}/clauses-list`, data),
    onSuccess: () => { invalidate(); setAddingNew(false); setNewForm({}); toast({ title: "Clause added" }); },
    onError: (err: any) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-clauses/${data.id}`, data),
    onSuccess: () => { invalidate(); setEditingId(null); setEditForm({}); toast({ title: "Clause saved" }); },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contract-clauses/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Clause deleted" }); },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const startEdit = (cl: any) => { setEditingId(cl.id); setEditForm({ ...cl }); setAddingNew(false); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const startAdd = () => {
    setEditingId(null);
    let maxNum = 0;
    clauses.forEach((c: any) => {
      const m = (c.clauseIdentifier || "").match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
    setNewForm({
      clauseIdentifier: `CL-${String(maxNum + 1).padStart(3, "0")}`,
      sectionRef: "", text: "", clauseCategoryCode: "", flowTypeCode: "", affectsAccrual: false,
    });
    setAddingNew(true);
  };
  const cancelAdd = () => { setAddingNew(false); setNewForm({}); };

  const renderEditCard = (form: any, setField: (f: string, v: any) => void, onSave: () => void, onCancel: () => void, isPending: boolean, isNew: boolean) => (
    <div
      className="border border-orange-300 bg-orange-50/30 rounded-md p-3 space-y-2.5"
      data-testid={isNew ? "form-clause-add" : `form-clause-edit-${form.id}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold tracking-wide font-mono">
          {form.clauseIdentifier}
        </span>
        <Input
          value={form.sectionRef || ""}
          onChange={(e) => setField("sectionRef", e.target.value)}
          placeholder="Section reference (e.g. §3.2)"
          className="h-7 text-xs flex-1 min-w-[140px] max-w-[220px]"
          data-testid="input-clause-section"
        />
        <Select
          value={form.clauseCategoryCode || "_none"}
          onValueChange={(v) => setField("clauseCategoryCode", v === "_none" ? "" : v)}
        >
          <SelectTrigger className="h-7 text-xs w-[170px]" data-testid="select-clause-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— No category —</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={form.flowTypeCode || "_none"}
          onValueChange={(v) => setField("flowTypeCode", v === "_none" ? "" : v)}
        >
          <SelectTrigger className="h-7 text-xs w-[140px]" data-testid="select-clause-flow">
            <SelectValue placeholder="Flow type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— No flow —</SelectItem>
            {flowTypes.map((f: any) => (
              <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 ml-auto">
          <Switch
            checked={!!form.affectsAccrual}
            onCheckedChange={(v) => setField("affectsAccrual", v)}
            data-testid="switch-clause-accrual"
          />
          Affects accrual
        </label>
      </div>
      <Textarea
        value={form.text || ""}
        onChange={(e) => setField("text", e.target.value)}
        rows={3}
        placeholder="Clause text…"
        className="text-xs leading-relaxed"
        data-testid="textarea-clause-text"
      />
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          onClick={onCancel}
          className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 inline-flex items-center gap-1"
          data-testid="button-cancel-clause"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending || !form.text?.trim()}
          className="text-xs px-3 py-1 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
          data-testid="button-save-clause"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </button>
      </div>
    </div>
  );

  return (
    <TabShell title="Clauses" count={clauses.length} testid="tab-content-clauses">
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={startAdd}
          disabled={addingNew}
          className="text-xs px-2.5 py-1 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
          data-testid="button-add-clause"
        >
          <Plus className="h-3 w-3" /> Add clause
        </button>
      </div>

      {clausesQuery.isLoading ? (
        <div className="text-xs text-zinc-500">Loading clauses…</div>
      ) : (
        <div className="space-y-2">
          {addingNew && renderEditCard(
            newForm,
            (f, v) => setNewForm((p: any) => ({ ...p, [f]: v })),
            () => addMutation.mutate(newForm),
            cancelAdd,
            addMutation.isPending,
            true,
          )}

          {clauses.length === 0 && !addingNew ? (
            <EmptyState msg="No clauses extracted yet." />
          ) : (
            [...clauses]
              .sort((a: any, b: any) => {
                const aPay = isPaymentClause(a) ? 0 : 1;
                const bPay = isPaymentClause(b) ? 0 : 1;
                if (aPay !== bPay) return aPay - bPay;
                return (a.clauseIdentifier || "").localeCompare(b.clauseIdentifier || "");
              })
              .map((cl: any) => {
              if (editingId === cl.id) {
                return (
                  <div key={cl.id}>
                    {renderEditCard(
                      editForm,
                      (f, v) => setEditForm((p: any) => ({ ...p, [f]: v })),
                      () => updateMutation.mutate(editForm),
                      cancelEdit,
                      updateMutation.isPending,
                      false,
                    )}
                  </div>
                );
              }
              const isPayment = isPaymentClause(cl);
              return (
                <div
                  key={cl.id}
                  className={`group px-3 py-2.5 border rounded-md transition-colors ${
                    isPayment
                      ? "border-orange-200 bg-orange-50/40 hover:border-orange-300 hover:bg-orange-50/70"
                      : "border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/40"
                  }`}
                  data-testid={`row-clause-${cl.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold tracking-wide font-mono">
                      {cl.clauseIdentifier}
                    </span>
                    {isPayment && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-600 text-white font-semibold uppercase tracking-wide">
                        Payment / consideration
                      </span>
                    )}
                    {cl.sectionRef && (
                      <span className="text-[11px] text-zinc-500 truncate">{cl.sectionRef}</span>
                    )}
                    {cl.clauseCategoryCode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 capitalize">
                        {cl.clauseCategoryCode.replace(/_/g, " ")}
                      </span>
                    )}
                    {cl.flowTypeCode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 uppercase">
                        {cl.flowTypeCode}
                      </span>
                    )}
                    {cl.affectsAccrual && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                        Accrual
                      </span>
                    )}
                    {typeof cl.confidence === "number" && cl.confidence > 0 && (
                      <span className="text-[10px] text-zinc-400 ml-1">
                        {Math.round(cl.confidence * 100)}%
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(cl)}
                        className="p-1 rounded hover:bg-orange-100 text-zinc-500 hover:text-orange-700"
                        title="Edit clause"
                        data-testid={`button-edit-clause-${cl.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-rose-100 text-zinc-500 hover:text-rose-600"
                            title="Delete clause"
                            data-testid={`button-delete-clause-${cl.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete clause {cl.clauseIdentifier}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the clause from this contract. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700"
                              onClick={() => deleteMutation.mutate(cl.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{cl.text}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </TabShell>
  );
}

const RULE_TYPES = [
  "percentage", "fixed_fee", "per_unit", "tiered",
  "minimum_guarantee", "payment_schedule", "rebate-rate",
  "bonus", "condition", "data-only",
] as const;

const STATUS_OPTIONS: Array<{ value: string; label: string; dot: string; pill: string }> = [
  { value: "verified",     label: "Verified",     dot: "bg-emerald-500", pill: "bg-emerald-100 border-emerald-300 text-emerald-800" },
  { value: "under_review", label: "Under review", dot: "bg-amber-400",   pill: "bg-amber-100 border-amber-300 text-amber-800" },
  { value: "pending",      label: "AI extracted", dot: "bg-rose-500",    pill: "bg-rose-100 border-rose-300 text-rose-800" },
];

function statusMeta(reviewStatus: string | undefined, isActive?: boolean) {
  if (reviewStatus === "verified" || (isActive && !reviewStatus)) return STATUS_OPTIONS[0];
  if (reviewStatus === "under_review" || reviewStatus === "auto_confirmed") return STATUS_OPTIONS[1];
  return STATUS_OPTIONS[2];
}

function csvToArr(s: string): string[] {
  return (s || "").split(",").map(x => x.trim()).filter(Boolean);
}

function RuleConditionsRow({ rule, allQualifiers }: { rule: any; allQualifiers: any[] }) {
  const products: string[] = rule.productCategories || [];
  const territories: string[] = rule.territories || [];

  // Pull extra qualifier rows linked to this rule's source clause that are NOT
  // already represented by product_category / territory arrays (e.g. volume tiers,
  // custom fields). Without sourceClauseId we can't safely link, so we skip.
  const extraQuals = rule.sourceClauseId
    ? allQualifiers.filter(
        (q) =>
          q.contractClauseId === rule.sourceClauseId &&
          q.qualifierField !== "product" &&
          q.qualifierField !== "products" &&
          q.qualifierField !== "product_category" &&
          q.qualifierField !== "product_categories" &&
          q.qualifierField !== "territory" &&
          q.qualifierField !== "territories",
      )
    : [];

  if (products.length === 0 && territories.length === 0 && extraQuals.length === 0) {
    return (
      <div className="text-[10px] text-zinc-400 italic mt-1.5">
        Applies to all products and territories (no conditions)
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5" data-testid={`conditions-rule-${rule.id}`}>
      <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold mr-0.5">Conditions:</span>
      {products.map((p, i) => {
        const isExclusion = p.startsWith("!");
        const value = isExclusion ? p.substring(1).trim() : p;
        return (
          <span
            key={`p-${i}`}
            className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
              isExclusion
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-orange-50 border-orange-200 text-orange-800"
            }`}
            title={isExclusion ? `Excludes product: ${value}` : `Applies to product: ${value}`}
          >
            <span className="opacity-60">{isExclusion ? "Not" : "Product"}:</span> {value}
          </span>
        );
      })}
      {territories.map((t, i) => (
        <span
          key={`t-${i}`}
          className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 inline-flex items-center gap-1"
          title={`Applies to territory: ${t}`}
        >
          <span className="opacity-60">Territory:</span> {t}
        </span>
      ))}
      {extraQuals.map((q) => (
        <span
          key={q.qualifierId}
          className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-800 inline-flex items-center gap-1"
          title={q.notes || ""}
        >
          <span className="opacity-60">{(q.qualifierField || "").replace(/_/g, " ")} {q.operator}:</span> {q.qualifierValue}
        </span>
      ))}
    </div>
  );
}

function RulesTab({ query, qualifiersQuery, contractId }: { query: any; qualifiersQuery: any; contractId: string }) {
  const { toast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelRule, setPanelRule] = useState<any | null>(null);

  // Per-instance accrual policy summary, used to build the "from policy"
  // vs "override" chip on each rule card. One small fetch covers all rules.
  const policiesSummaryQuery = useQuery<any[]>({
    queryKey: ["/api/contracts", contractId, "policies-summary"],
  });
  const policyByInstance = new Map<string, { aggregationPeriod: string | null; instanceLabel: string }>();
  if (Array.isArray(policiesSummaryQuery.data)) {
    for (const p of policiesSummaryQuery.data) {
      policyByInstance.set(p.instanceId, {
        aggregationPeriod: p.accrualAggregationPeriod ?? null,
        instanceLabel: p.instanceLabel ?? "",
      });
    }
  }
  const aggLabel = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const v = String(raw).toLowerCase();
    if (v === "annual" || v === "year" || v === "yearly") return "Annual";
    if (v === "quarter" || v === "quarterly") return "Quarterly";
    if (v === "month" || v === "monthly") return "Monthly";
    if (v === "per_sale") return "Per sale";
    return raw;
  };
  const aggMatches = (rule: string | null, policy: string | null): boolean => {
    const norm = (v: string | null) => {
      if (!v) return "";
      const s = v.toLowerCase();
      if (s === "year" || s === "yearly" || s === "annual") return "annual";
      if (s === "quarter" || s === "quarterly") return "quarter";
      if (s === "month" || s === "monthly") return "month";
      return s;
    };
    return norm(rule) === norm(policy);
  };

  const data = query.data || {};
  const allRules: any[] = Array.isArray(data.manualRules) ? data.manualRules : [];
  // payment_schedule isn't a calculation rule (it's a *when*, not a *how much*).
  // Those clauses already surface on the Terms tab as payment_schedule terms.
  const scheduleRules = allRules.filter(r => r.ruleType === "payment_schedule");
  const rules = allRules.filter(r => r.ruleType !== "payment_schedule");
  const allQualifiers: any[] = Array.isArray(qualifiersQuery?.data) ? qualifiersQuery.data : [];

  // Heuristic: two calculation rules with the same ruleType and (when present)
  // the same baseRate are likely duplicates from over-extraction. Flag them so
  // the user can decide which to keep before they end up paying twice.
  const dupKeyCounts = rules.reduce<Record<string, number>>((acc, r) => {
    const key = `${r.ruleType}|${r.baseRate ?? ""}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const isLikelyDuplicate = (r: any) =>
    (dupKeyCounts[`${r.ruleType}|${r.baseRate ?? ""}`] || 0) > 1;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "combined-rules"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "qualifiers"] });
  };

  const resyncMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/qualifier-backfill/${contractId}`),
    onSuccess: (data: any) => {
      invalidate();
      toast({ title: "Conditions resynced", description: `${data?.written ?? 0} qualifier rows written` });
    },
    onError: (e: any) => toast({ title: "Resync failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, reviewStatus }: { id: string; reviewStatus: string }) =>
      apiRequest("PATCH", `/api/contract-rules/${id}/review-status`, { reviewStatus }),
    onSuccess: () => { invalidate(); toast({ title: "Status updated" }); },
    onError: (e: any) => toast({ title: "Status change failed", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contract-rules/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Rule deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/contracts/${contractId}/rules/${id}/approve`),
    onSuccess: () => { invalidate(); toast({ title: "Rule approved" }); },
    onError: (e: any) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });
  const approveAllMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiRequest("POST", `/api/contracts/${contractId}/rules/${id}/approve`))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { ok: results.length - failed, failed };
    },
    onSuccess: ({ ok, failed }) => {
      invalidate();
      toast({
        title: failed === 0 ? `Approved ${ok} rule${ok === 1 ? "" : "s"}` : `Approved ${ok}, ${failed} failed`,
        variant: failed === 0 ? undefined : "destructive",
      });
    },
    onError: (e: any) => toast({ title: "Bulk approve failed", description: e.message, variant: "destructive" }),
  });

  const pendingApprovalRules = rules.filter(
    (r: any) => (r.reviewStatus || "").toLowerCase() === "verified"
      && (r.approvalStatus || "pending").toLowerCase() !== "approved"
  );

  const startEdit = (r: any) => {
    setPanelRule(r);
    setPanelOpen(true);
  };
  const startAdd = () => {
    setPanelRule(null);
    setPanelOpen(true);
  };

  return (
    <TabShell title={`Calculation Rules (${data.calculationApproach || "—"})`} count={rules.length} testid="tab-content-rules">
      <RuleEditorPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        contractId={contractId}
        rule={panelRule}
        allQualifiers={allQualifiers}
      />
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          onClick={() => resyncMutation.mutate()}
          disabled={resyncMutation.isPending}
          className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 inline-flex items-center gap-1"
          title="Rebuild contract_qualifiers rows from each rule's product/territory arrays"
          data-testid="button-resync-conditions"
        >
          {resyncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Resync conditions
        </button>
        {pendingApprovalRules.length > 0 && (
          <button
            onClick={() => approveAllMutation.mutate(pendingApprovalRules.map((r: any) => r.id))}
            disabled={approveAllMutation.isPending}
            className="text-xs px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 font-semibold inline-flex items-center gap-1"
            title="Approve every verified rule that is still awaiting sign-off"
            data-testid="button-approve-all-rules"
          >
            {approveAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Approve all verified ({pendingApprovalRules.length})
          </button>
        )}
        <button
          onClick={startAdd}
          className="text-xs px-2.5 py-1 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1"
          data-testid="button-add-rule"
        >
          <Plus className="h-3 w-3" /> Add rule
        </button>
      </div>

      {query.isLoading ? (
        <div className="text-xs text-zinc-500">Loading rules…</div>
      ) : (
        <div className="space-y-2">
          {rules.length > 0 && (() => {
            const counts = { verified: 0, under_review: 0, pending: 0 };
            for (const r of rules) {
              const m = statusMeta((r as any).reviewStatus, (r as any).isActive);
              counts[m.value as keyof typeof counts]++;
            }
            const total = rules.length;
            const allVerified = counts.verified === total;
            return (
              <div
                className={`rounded-md border px-3 py-2 mb-1 flex items-center gap-3 ${
                  allVerified
                    ? "bg-emerald-50 border-emerald-200"
                    : counts.pending > 0
                      ? "bg-rose-50 border-rose-200"
                      : "bg-amber-50 border-amber-200"
                }`}
                data-testid="banner-rule-status-summary"
              >
                {allVerified ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${counts.pending > 0 ? "text-rose-600" : "text-amber-600"}`} />
                )}
                <div className="flex-1 text-[11px]">
                  <div className={`font-semibold inline-flex items-center gap-1 ${allVerified ? "text-emerald-900" : counts.pending > 0 ? "text-rose-900" : "text-amber-900"}`}>
                    {allVerified
                      ? `All ${total} rule${total === 1 ? "" : "s"} verified — calculations will use these.`
                      : `${counts.verified} of ${total} rule${total === 1 ? "" : "s"} verified · only verified rules participate in fee calculations.`}
                    <HelpHint articleId="verify-traffic-light" side="bottom" />
                  </div>
                  {!allVerified && (
                    <div className="text-[10px] text-zinc-700 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {counts.verified} verified</span>
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {counts.under_review} under review</span>
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {counts.pending} AI-extracted (needs review)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {scheduleRules.length > 0 && (
            <div className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-md px-3 py-2 mb-1 flex items-start gap-2" data-testid="note-payment-schedule-hidden">
              <Calendar className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
              <span>
                {scheduleRules.length === 1 ? "1 payment schedule" : `${scheduleRules.length} payment schedules`} extracted as a rule but hidden here — payment timing is a term, not a calculation. See it on the <span className="font-semibold text-zinc-700">Terms &amp; Clauses</span> tab.
              </span>
            </div>
          )}

          {rules.length === 0 ? (
            <EmptyState msg="No rules defined yet." />
          ) : (
            rules.map((r: any) => {
              const meta = statusMeta(r.reviewStatus, r.isActive);
              return (
                <div
                  key={r.id}
                  className="group px-3 py-2.5 border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/40 rounded-md flex items-center gap-3 transition-colors"
                  data-testid={`row-rule-${r.id}`}
                >
                  <Select
                    value={meta.value}
                    onValueChange={(v) => statusMutation.mutate({ id: r.id, reviewStatus: v })}
                  >
                    <SelectTrigger
                      className={`h-auto w-auto px-2 py-0.5 border rounded-md shrink-0 hover:opacity-90 focus:ring-0 text-[10px] font-semibold uppercase tracking-wider gap-1 [&>svg]:opacity-50 [&>svg]:h-3 [&>svg]:w-3 ${meta.pill}`}
                      data-testid={`select-rule-status-${r.id}`}
                      title={`Status: ${meta.label} — click to change`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${o.dot}`} />
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900 truncate">{r.ruleName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 capitalize">{(r.ruleType || "").replace(/_/g, " ")}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium"
                        title="Calculation phase — engine evaluates rules in fixed phase order, then by priority within a phase."
                        data-testid={`badge-phase-${r.id}`}
                      >
                        {CALC_PHASE_LABELS[resolveCalcPhase(r)]}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-100 text-zinc-500">P{r.priority}</span>
                      {r.baseRate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-800 font-semibold">Rate: {r.baseRate}</span>}
                      {(r.approvalStatus || "").toLowerCase() === "approved" && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold inline-flex items-center gap-1"
                          title={`Approved${r.approvedAt ? ` ${formatDate(r.approvedAt)}` : ""}`}
                          data-testid={`badge-approved-${r.id}`}
                        >
                          <ShieldCheck className="h-2.5 w-2.5" /> Approved
                        </span>
                      )}
                      {(r.approvalStatus || "").toLowerCase() === "rejected" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-semibold" data-testid={`badge-rejected-${r.id}`}>
                          Rejected
                        </span>
                      )}
                      {isLikelyDuplicate(r) && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold inline-flex items-center gap-1"
                          title={`Another rule with type "${r.ruleType}" and rate "${r.baseRate ?? "—"}" exists. Review and delete one to avoid double-counting in fee calculations.`}
                          data-testid={`badge-duplicate-${r.id}`}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" /> Possible duplicate
                        </span>
                      )}
                      {(() => {
                        // Aggregation period chip: shows whether the rule
                        // accrues per-sale, monthly, quarterly, or annually,
                        // AND whether that came from the program's policy
                        // (default) or a rule-level override.
                        const ruleAgg = (r.formulaDefinition as any)?.aggregationPeriod ?? null;
                        const policyInfo = r.subtypeInstanceId ? policyByInstance.get(r.subtypeInstanceId) : null;
                        const policyAgg = policyInfo?.aggregationPeriod ?? null;

                        if (!r.subtypeInstanceId) {
                          return (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-zinc-500 inline-flex items-center gap-1"
                              title="This rule isn't linked to a Subtype Instance, so no policy default applies. Edit the rule and set its Program."
                              data-testid={`badge-aggregation-${r.id}`}
                            >
                              <Calendar className="h-2.5 w-2.5" /> No program
                            </span>
                          );
                        }
                        if (ruleAgg && policyAgg && !aggMatches(ruleAgg, policyAgg)) {
                          return (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold inline-flex items-center gap-1"
                              title={`This rule overrides the program's policy. Policy says ${aggLabel(policyAgg)}; this rule will accrue ${aggLabel(ruleAgg)}. Engine uses the rule-level value.`}
                              data-testid={`badge-aggregation-${r.id}`}
                            >
                              <Calendar className="h-2.5 w-2.5" /> {aggLabel(ruleAgg)} (override · policy: {aggLabel(policyAgg)?.toLowerCase()})
                            </span>
                          );
                        }
                        if (ruleAgg) {
                          return (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 inline-flex items-center gap-1"
                              title={policyAgg ? `Rule accrues ${aggLabel(ruleAgg)}, matching the program's policy.` : `Rule accrues ${aggLabel(ruleAgg)} (no policy default).`}
                              data-testid={`badge-aggregation-${r.id}`}
                            >
                              <Calendar className="h-2.5 w-2.5" /> {aggLabel(ruleAgg)}
                            </span>
                          );
                        }
                        if (policyAgg) {
                          return (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 inline-flex items-center gap-1"
                              title={`This rule has no override, so it inherits ${aggLabel(policyAgg)} from the program's accrual policy.`}
                              data-testid={`badge-aggregation-${r.id}`}
                            >
                              <Calendar className="h-2.5 w-2.5" /> {aggLabel(policyAgg)} · from policy
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2">{r.description}</div>
                    <RuleConditionsRow rule={r} allQualifiers={allQualifiers} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(r.reviewStatus || "").toLowerCase() === "verified" && (r.approvalStatus || "pending").toLowerCase() !== "approved" && (
                      <button
                        onClick={() => approveMutation.mutate(r.id)}
                        disabled={approveMutation.isPending}
                        className="p-1 rounded hover:bg-emerald-100 text-zinc-500 hover:text-emerald-700 disabled:opacity-50"
                        title="Approve rule — authorize it for payment calculations"
                        data-testid={`button-approve-rule-${r.id}`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(r)}
                      className="p-1 rounded hover:bg-orange-100 text-zinc-500 hover:text-orange-700"
                      title="Edit rule"
                      data-testid={`button-edit-rule-${r.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-1 rounded hover:bg-rose-100 text-zinc-500 hover:text-rose-600"
                          title="Delete rule"
                          data-testid={`button-delete-rule-${r.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete rule "{r.ruleName}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the rule and any qualifiers attached to it. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-rose-600 hover:bg-rose-700"
                            onClick={() => deleteMutation.mutate(r.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </TabShell>
  );
}

function HistoryTab({ runsQuery, versionsQuery }: { runsQuery: any; versionsQuery: any }) {
  const runs: any[] = Array.isArray(runsQuery.data) ? runsQuery.data : [];
  const versions: any[] = Array.isArray(versionsQuery.data?.versions) ? versionsQuery.data.versions : [];
  return (
    <div className="space-y-4">
      <TabShell title="Extraction Runs" count={runs.length} testid="tab-content-history-runs">
        {runsQuery.isLoading ? <div className="text-xs text-zinc-500">Loading runs…</div> : runs.length === 0 ? <EmptyState msg="No extraction runs yet." /> : (
          <div className="space-y-2">
            {runs.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 border border-zinc-100 rounded-md" data-testid={`row-run-${r.id}`}>
                <div className={`h-2 w-2 rounded-full shrink-0 ${r.status === "completed" ? "bg-emerald-500" : r.status === "failed" ? "bg-rose-500" : "bg-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">{r.runType || "extraction"}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 uppercase">{r.status}</span>
                    {r.aiModel && <span className="text-[10px] text-zinc-500">{r.aiModel}</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Confidence {r.overallConfidence ? `${Math.round(parseFloat(r.overallConfidence) * 100)}%` : "—"} ·
                    {" "}{r.nodesExtracted ?? 0} nodes · {r.rulesExtracted ?? 0} rules
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 shrink-0">{formatDate(r.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </TabShell>

      <TabShell title="Versions" count={versions.length} testid="tab-content-history-versions">
        {versionsQuery.isLoading ? <div className="text-xs text-zinc-500">Loading versions…</div> : versions.length === 0 ? <EmptyState msg="No version history yet." /> : (
          <div className="space-y-2">
            {versions.map((v: any, i: number) => (
              <div key={v.id || i} className="flex items-center gap-3 px-3 py-2 border border-zinc-100 rounded-md" data-testid={`row-version-${v.id || i}`}>
                <GitBranch className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{v.label || v.versionLabel || `Version ${v.versionNumber || i + 1}`}</div>
                  <div className="text-[11px] text-zinc-500">{v.note || v.changeNote || "—"}</div>
                </div>
                <div className="text-[10px] text-zinc-400 shrink-0">{formatDate(v.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </TabShell>
    </div>
  );
}
