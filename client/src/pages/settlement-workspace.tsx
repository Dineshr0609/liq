import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  FileText,
  Sparkles,
  ChevronRight,
  Download,
  Loader2,
  ArrowLeft,
  Send,
  Eye,
  Plus,
  DollarSign,
  ArrowUpDown,
  Clock,
  XCircle,
  Scale,
  Handshake,
  Filter,
  Receipt,
  History,
  Paperclip,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { openLiqAI } from "@/components/liq-ai-panel";

// AP/AR badge per flow type. AP = the counterparty lives in the Accounts
// Payable sub-ledger (vendors / licensees / channel partners we pay);
// AR = the counterparty lives in the Accounts Receivable sub-ledger
// (customers we bill). Used only as a small visual cue on the tab pill.
const FLOW_LEDGER_BADGE: Record<string, "AP" | "AR" | "—"> = {
  VRP: "AP",
  CRP: "AR",
  RLA: "AP",
  RSM: "AP",
  SUB: "AR",
  OEM: "—",
};

type FlowType = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  cashDirection?: string | null;
};

const MATCH_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  fully_matched: { label: "Fully Matched", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  partial: { label: "Partial Match", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  open: { label: "Open", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  under_review: { label: "Under Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  posted: { label: "Posted", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const LINE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  variance: { label: "Variance", className: "bg-orange-100 text-orange-700" },
  matched: { label: "Matched", className: "bg-green-100 text-green-700" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600" },
  partial: { label: "Partial Match", className: "bg-yellow-100 text-yellow-700" },
};

function MatchBar({ pct }: { pct: number }) {
  const color = pct >= 95 ? "bg-green-500" : pct >= 60 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function SettlementWorkspace() {
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<"all" | "open" | "partial" | "disputed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("match");
  const [liqInput, setLiqInput] = useState("");

  const { data: allSettlements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/settlements"],
    staleTime: 0,
  });

  // Tabs are driven by the company's configured flow types (CRP, VRP, RLA,
  // ...) rather than the legacy hardcoded settlement_type list. Falls back
  // to an empty list while loading; the active tab auto-resolves to the
  // first flow type below once the list arrives.
  const { data: flowTypeList = [] } = useQuery<FlowType[]>({
    queryKey: ["/api/pipeline/flow-types"],
    staleTime: 60_000,
  });
  const flowTypeTabs = flowTypeList
    .filter(ft => ft.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Default the active tab to the first available flow type once they load.
  useEffect(() => {
    if (activeType === null && flowTypeTabs.length > 0) {
      setActiveType(flowTypeTabs[0].code);
    }
  }, [activeType, flowTypeTabs]);

  // Deep-link support — period-close Worksheet (and any other surface)
  // can navigate here with `?focus=<settlementId>`. Switch to the
  // settlement's own flow-type tab, select it, then strip the param so
  // a back-nav doesn't keep re-selecting it after the user clicks
  // away.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (!focus || !allSettlements || allSettlements.length === 0) return;
    const target = allSettlements.find((s: any) => s.id === focus);
    if (!target) return;
    if (target.flowType) setActiveType(target.flowType);
    setSelectedId(focus);
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    // Defer scroll until DOM has rendered the matching row.
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="settlement-item-${focus}"]`);
      if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [allSettlements]);

  // Tile stats are computed client-side from `typeSettlements` (see below)
  // so the previous `/api/settlements/summary` query was removed — its
  // company-wide totals didn't match the active settlement-type tab.

  const { data: selectedDetail } = useQuery<any>({
    queryKey: ["/api/settlements", selectedId],
    enabled: !!selectedId,
  });

  // Pull the attached inbound claim so we can show its status in the
  // decision card and gate the "settle" buttons on its approval state.
  const linkedClaimId: string | undefined = selectedDetail?.claimId || undefined;
  const { data: linkedClaim } = useQuery<any>({
    queryKey: ["/api/finance/inbound-claims", linkedClaimId],
    enabled: !!linkedClaimId,
  });

  // Supporting data for the Posting Instructions, History & Audit, and
  // Evidence Docs tabs. Returned by GET /api/settlements/:id/timeline.
  // Shape: { journalEntries, claimEvents, documents, claim }.
  const { data: timeline } = useQuery<{
    journalEntries: Array<any & { lines: any[] }>;
    claimEvents: any[];
    documents: any[];
    claim: any;
  }>({
    queryKey: ["/api/settlements", selectedId, "timeline"],
    enabled: !!selectedId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const r = await apiRequest("PATCH", `/api/settlements/${id}`, body);
      // PATCH returns the updated row; if the auto-clear hook fired,
      // it'll be on `autoClear`. Surface it in onSuccess so the user
      // sees a discrete toast for the implicit JE rather than a silent
      // GL post.
      try { return await r.json(); } catch { return null; }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      toast({ title: "Settlement updated" });
      const ac = result?.autoClear;
      if (ac?.cleared) {
        toast({
          title: "Residual auto-cleared",
          description: `Sub-materiality variance of $${(ac.residual || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cleared via JE ${ac.jeId} (DR ${ac.drAccountCode} / CR ${ac.crAccountCode}).`,
        });
      }
    },
    onError: (e: any) =>
      toast({ title: "Settlement update failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  // Drive the inbound-claim state machine from the settlement screen so
  // the Claims Workspace and the Settlement Workspace share the same
  // audit trail (inbound_claim_events). Used by the chained settle
  // handlers below — never call PATCH /settlements directly anymore for
  // settlements that are matched to a claim.
  const decideClaimMutation = useMutation({
    mutationFn: ({ claimId, action, amount, description }: {
      claimId: string;
      action: "approve" | "partial_approve";
      amount?: number;
      description?: string;
    }) => apiRequest("POST", `/api/finance/inbound-claims/${claimId}/decide`, { action, amount, description }),
  });

  const disputeClaimMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      apiRequest("POST", `/api/finance/inbound-claims/${claimId}/dispute`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      toast({ title: "Dispute opened", description: "The variance has been escalated for review." });
    },
    onError: (e: any) =>
      toast({ title: "Could not open dispute", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const [, navigate] = useLocation();

  // Phase A: post a credit memo to GL by generating the finance document
  // straight from the settlement workspace. Server-side this:
  //   1. Validates the linked claim is approved / partial_approved / settled.
  //   2. Mints a draft credit memo (or returns the existing one if already
  //      generated — endpoint is idempotent on linkedDocumentId).
  //   3. Copies line items from the inbound claim.
  // After success we route the user straight to the new draft on
  // /invoices-memos so they can finish the GL post (Send → Awaiting Oracle
  // → Posted → Paid).
  const postCreditMemoMutation = useMutation({
    mutationFn: ({ claimId }: { claimId: string }) =>
      apiRequest("POST", `/api/finance/inbound-claims/${claimId}/generate-document`, {}).then((r) => r.json()),
    onSuccess: (doc: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      toast({
        title: "Credit memo drafted",
        description: `Document ${doc?.documentNumber || ""} created. Opening Invoices & Memos…`,
      });
      navigate("/invoices-memos");
    },
    onError: (e: any) =>
      toast({
        title: "Could not post credit memo",
        description: e?.message || "Approve the linked claim first, then try again.",
        variant: "destructive",
      }),
  });

  // Clear sub-materiality residual on a partially-settled accrual.
  // Backend posts a true-up JE (DR Accrued Liability / CR Revenue) and
  // flips settlementStatus → "posted". 409s with `reason` for the
  // already-cleared / no-residual / ineligible-status short-circuits so
  // we can show a precise toast rather than a generic failure.
  const clearResidualMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiRequest("POST", `/api/settlements/${settlementId}/clear-residual`, {}).then((r) => r.json()),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      toast({
        title: "Residual cleared",
        description: `Posted true-up JE ${result?.jeId || ""} for $${(result?.residual || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (DR ${result?.drAccountCode} / CR ${result?.crAccountCode}).`,
      });
    },
    onError: (e: any) => {
      const reason: string | undefined = e?.body?.reason || e?.reason;
      const description =
        reason === "already_cleared"
          ? "This settlement's residual has already been cleared."
          : reason === "no_residual"
            ? "No residual amount remains to clear."
            : reason === "ineligible_status"
              ? "Settlement must be partial or posted before clearing residual."
              : e?.message || "Unknown error";
      toast({ title: "Could not clear residual", description, variant: "destructive" });
    },
  });

  // VRP — Submit Claim to Vendor (inbound flows only).
  // Posts Dr Vendor Rebate Receivable / Cr Accrued Vendor Rebate and
  // moves the settlement to `approved` with a new claimRef. The
  // settlement stays unposted until the supplier confirms.
  const submitVendorClaimMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiRequest("POST", `/api/settlements/${settlementId}/submit-vendor-claim`, {}).then((r) => r.json()),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/journal-entries"] });
      // Submit-vendor-claim now also mints an outbound obligation
      // (the operational record). Refresh the unified claim list so
      // the vendor claim appears in Claims Workspace immediately.
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      toast({
        title: "Vendor claim submitted",
        description: `Reference ${result?.claimRef}${result?.amount ? ` for $${result.amount}` : ""}. JE ${result?.jeId} drafted (Dr 1240 / Cr 2155). Track delivery, attach evidence, and generate the debit memo from Claims Workspace.`,
        action: result?.obligationId ? (
          <ToastAction
            altText="Open in Claims Workspace"
            onClick={() => navigate(`/claims-workspace?claimId=${result.obligationId}`)}
          >
            Open Claim
          </ToastAction>
        ) : undefined,
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not submit vendor claim", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  // VRP — Take Deduction (inbound flows only). Creates a deductions
  // row + posts Dr A/P / Cr Accrued Vendor Rebate. Marks settlement
  // posted because the deduction is self-help (no supplier wait).
  const applyDeductionMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiRequest("POST", `/api/settlements/${settlementId}/apply-deduction`, {}).then((r) => r.json()),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/journal-entries"] });
      toast({
        title: "Deduction applied",
        description: `Deduction ${result?.deductionNumber} created and JE ${result?.jeId} posted (Dr 2100 A/P – Vendor / Cr 2155 Accrued Vendor Rebate, ${result?.amount ? `$${result.amount}` : ""}).`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not apply deduction", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  // VRP — Hold for Review (inbound flows only). No JE; just flips
  // resolution + status so the row leaves the "needs decision" filter.
  const holdForReviewMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiRequest("PATCH", `/api/settlements/${settlementId}`, {
        resolution: "hold_for_review",
        settlementStatus: "review",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      toast({ title: "Held for review", description: "No claim or deduction posted. Pick this back up when you're ready to act." });
    },
    onError: (e: any) =>
      toast({ title: "Could not hold for review", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  // Phase A: open a recovery claim (outbound obligation) from settlement variance.
  const generateClaimMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiRequest("POST", `/api/finance/settlements/${settlementId}/generate-claim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims/kpis"] });
      toast({ title: "Recovery claim opened", description: "Variance posted to Claims Workspace." });
    },
    onError: (e: any) =>
      toast({ title: "Could not open recovery claim", description: e?.message || "Out of scope or invalid", variant: "destructive" }),
  });

  // Composite handler used by the three settle decision buttons.
  // The linked inbound claim must already be in approved / partial_approved
  // state (driven by an explicit human review in the Claims Workspace) — the
  // server enforces the same gate. We deliberately do NOT auto-approve the
  // claim here; bypassing the human review step silently was masking an
  // approval-control gap. When no claim is attached (pure internal accrual
  // settle), the settle PATCH proceeds directly.
  const CLAIM_STATUSES_OK_TO_SETTLE = ["approved", "partial_approved"];
  async function settleWithClaimGate(opts: {
    settlementId: string;
    resolution: string;
    settlementStatus: string;
    claim?: { id: string; status: string | null | undefined };
    openDispute?: { reason: string };
    successMessage?: string;
  }) {
    try {
      if (opts.claim?.id && !CLAIM_STATUSES_OK_TO_SETTLE.includes(opts.claim.status || "")) {
        toast({
          title: "Claim approval required",
          description: "Approve the linked customer claim in the Claims Workspace before settling.",
          variant: "destructive",
        });
        return;
      }
      if (opts.claim?.id && opts.openDispute) {
        await disputeClaimMutation.mutateAsync({
          claimId: opts.claim.id,
          reason: opts.openDispute.reason,
        });
      }
      await updateMutation.mutateAsync({
        id: opts.settlementId,
        resolution: opts.resolution,
        settlementStatus: opts.settlementStatus,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      if (opts.successMessage) toast({ title: opts.successMessage });
    } catch (e: any) {
      toast({
        title: "Settlement decision failed",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    }
  }
  const settleInProgress =
    updateMutation.isPending || decideClaimMutation.isPending || disputeClaimMutation.isPending;

  // Variance tolerance threshold — keep aligned with backend default (1%).
  const VARIANCE_TOLERANCE_PCT = 1;
  const exceedsTolerance = (s: any) => {
    const accrual = parseFloat(s?.accrualAmount || "0");
    const variance = Math.abs(parseFloat(s?.variance || "0"));
    if (!accrual) return variance > 0;
    return (variance / accrual) * 100 > VARIANCE_TOLERANCE_PCT;
  };

  const isDisputed = (s: any) =>
    (s.disputeState && s.disputeState !== "none") || s.matchStatus === "disputed";

  // Settlements are bucketed onto tabs by their derived flow_type_code
  // (added by the API via a join to contracts → flow_types, with a
  // legacy settlement_type fallback for older rows).
  const typeSettlements = activeType
    ? allSettlements.filter((s: any) => s.flowTypeCode === activeType)
    : [];
  const filtered = typeSettlements.filter((s: any) => {
    if (listFilter === "open") return s.settlementStatus === "open";
    if (listFilter === "partial") return s.matchStatus === "partial";
    // Dispute filter is driven by dispute_state semantics (open/responded/
    // resolved) so a settlement that's been disputed and a downstream match
    // restored both still surface here until the dispute is resolved.
    if (listFilter === "disputed") return isDisputed(s);
    return true;
  }).filter((s: any) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (s.counterparty || "").toLowerCase().includes(q) ||
           (s.contractName || "").toLowerCase().includes(q) ||
           (s.claimRef || "").toLowerCase().includes(q);
  });

  const needsAttention = filtered.filter((s: any) => s.matchStatus === "partial" || isDisputed(s) || s.settlementStatus === "open");
  // "In Progress" — anything past the open/needs-attention stage but
  // not yet posted to GL. Covers two cases:
  //   • Outbound (CRP/RLA/...): matchStatus="fully_matched" with the
  //     linked credit memo working through Send → Awaiting Oracle →
  //     Posted on Invoices & Memos.
  //   • Inbound (VRP): settlementStatus="approved" after the user
  //     submits a vendor claim, awaiting supplier confirmation; or
  //     "review" after Hold for Review.
  // Without this broader predicate, an "approved" VRP row with
  // matchStatus="open" silently disappears from the workspace because
  // it doesn't fit the old needsAttention OR fully_matched buckets.
  const pendingGlPost = filtered.filter((s: any) =>
    s.settlementStatus !== "open" &&
    s.settlementStatus !== "posted" &&
    s.matchStatus !== "partial" &&
    !isDisputed(s)
  );
  const postedItems = filtered.filter((s: any) => s.settlementStatus === "posted");

  const selected = selectedDetail || allSettlements.find((s: any) => s.id === selectedId);
  const lineItems = selectedDetail?.lineItems || [];

  const typeCounts = flowTypeTabs.reduce((acc, t) => {
    acc[t.code] = allSettlements.filter((s: any) => s.flowTypeCode === t.code).length;
    return acc;
  }, {} as Record<string, number>);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  // Tiles reflect the *active settlement type tab* — not company-wide totals.
  // The summary endpoint sums across every settlement_type, which produced
  // misleading numbers when a user was scoped into one tab. Recomputing
  // from the already-loaded `typeSettlements` list keeps the tiles
  // consistent with the list and the active filter.
  const tabAccrual = typeSettlements.reduce((s, x: any) => s + parseFloat(x.accrualAmount || "0"), 0);
  const tabClaims = typeSettlements.reduce((s, x: any) => s + parseFloat(x.claimAmount || "0"), 0);
  const tabNetVariance = tabAccrual - tabClaims;
  const tabOpenItems = typeSettlements.filter((s: any) => s.settlementStatus === "open" || s.settlementStatus === "partial").length;
  const tabFullyMatched = typeSettlements.filter((s: any) => s.matchStatus === "fully_matched").length;
  const tabDisputed = typeSettlements.filter(isDisputed).length;
  const tabPostedToGl = typeSettlements
    .filter((s: any) => s.settlementStatus === "posted")
    .reduce((s, x: any) => s + parseFloat(x.postedAmount || "0"), 0);

  const activeTypeLabel = flowTypeTabs.find(t => t.code === activeType)?.name ?? "Settlements";

  const stats = [
    { label: "Open Items", value: tabOpenItems, sub: `In ${activeTypeLabel}`, color: "text-orange-600", icon: Clock },
    { label: "Total Accrual", value: fmt(tabAccrual), sub: "Our accrual", color: "text-gray-900 dark:text-gray-100", icon: DollarSign },
    { label: "Customer Claims", value: fmt(tabClaims), sub: "Customer claims", color: "text-gray-900 dark:text-gray-100", icon: FileText },
    { label: "Net Variance", value: fmt(tabNetVariance), sub: `${tabAccrual ? ((Math.abs(tabNetVariance) / tabAccrual) * 100).toFixed(1) : 0}% gap`, color: tabNetVariance >= 0 ? "text-green-600" : "text-red-600", icon: ArrowUpDown },
    { label: "Fully Matched", value: tabFullyMatched, sub: "Ready to post", color: "text-green-600", icon: CheckCircle2 },
    { label: "Disputed", value: tabDisputed, sub: "Escalated to Sales", color: "text-red-600", icon: AlertTriangle },
    { label: "Posted to GL", value: fmt(tabPostedToGl), sub: "Posted this period", color: "text-blue-600", icon: Scale },
  ];

  return (
    <MainLayout title="Settlement Workspace" description="Match, reconcile & post settlements across all contract flow types">
      <div className="flex items-center flex-wrap gap-2 mb-4" data-testid="flow-type-tabs">
        {flowTypeTabs.length === 0 && (
          <span className="text-xs text-gray-500" data-testid="text-no-flow-types">
            No flow types configured. Add one in Pipeline Settings.
          </span>
        )}
        {flowTypeTabs.map(t => {
          const badge = FLOW_LEDGER_BADGE[t.code] ?? "—";
          const isActive = activeType === t.code;
          return (
            <button
              key={t.code}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${isActive ? "bg-orange-600 text-white border-orange-600" : "bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-orange-300"}`}
              onClick={() => { setActiveType(t.code); setSelectedId(null); }}
              data-testid={`tab-flow-${t.code}`}
              title={t.description || t.name}
            >
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${isActive ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>{badge}</span>
              {t.name}
              {typeCounts[t.code] > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-orange-100 text-orange-600"}`}>{typeCounts[t.code]}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-3 mb-4" data-testid="stats-row">
        {stats.map((s, idx) => (
          <Card key={idx} className="border-gray-200 dark:border-gray-700" data-testid={`stat-${idx}`}>
            <CardContent className="p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1">{s.label}</div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-400">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[500px]">
        <div className="w-[320px] flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 flex flex-col overflow-hidden" data-testid="settlement-list">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input placeholder="Filter..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-xs" data-testid="input-filter-settlements" />
            </div>
            <div className="flex gap-1">
              {(["all", "open", "partial", "disputed"] as const).map(f => (
                <button key={f}
                  className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${listFilter === f ? "bg-orange-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"}`}
                  onClick={() => setListFilter(f)}
                  data-testid={`filter-${f}`}
                >
                  {f === "all" ? `All (${typeSettlements.length})` : f === "open" ? `Open (${typeSettlements.filter(s => s.settlementStatus === 'open').length})` : f === "partial" ? `Partial (${typeSettlements.filter(s => s.matchStatus === 'partial').length})` : `Disputed (${typeSettlements.filter(isDisputed).length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">No settlements found</div>
            ) : (
              <>
                {needsAttention.length > 0 && (
                  <div className="px-3 pt-3">
                    <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Needs Attention</div>
                    {needsAttention.map(s => (
                      <SettlementListItem key={s.id} s={s} selected={selectedId === s.id} onClick={() => setSelectedId(s.id)} />
                    ))}
                  </div>
                )}
                {pendingGlPost.length > 0 && (
                  <div className="px-3 pt-3">
                    <div
                      className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1.5 flex items-center gap-1"
                      title="In flight: outbound credit memo working through Send → Awaiting Oracle → Posted on Invoices & Memos, or inbound vendor claim awaiting supplier confirmation."
                    >
                      <CheckCircle2 className="w-3 h-3" /> In Progress
                    </div>
                    {pendingGlPost.map(s => (
                      <SettlementListItem key={s.id} s={s} selected={selectedId === s.id} onClick={() => setSelectedId(s.id)} />
                    ))}
                  </div>
                )}
                {postedItems.length > 0 && (
                  <div className="px-3 pt-3">
                    <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Scale className="w-3 h-3" /> Posted to GL</div>
                    {postedItems.map(s => (
                      <SettlementListItem key={s.id} s={s} selected={selectedId === s.id} onClick={() => setSelectedId(s.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Handshake className="w-10 h-10 text-gray-300" />
              <div className="text-sm">Select a settlement to view details</div>
              <div className="text-[11px]">Or create a new settlement with the button above</div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-base font-bold text-gray-900 dark:text-gray-100">{selected.counterparty} — {selected.contractName || "Settlement"}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                      <MatchBadge status={selected.matchStatus} />
                      <span>{selected.flowTypeName || selected.flowTypeCode || selected.flowType || "—"} · {selected.period || "Current"} · Claim {selected.claimRef || selected.claimId || "—"}</span>
                      {selected.disputeState && selected.disputeState !== "none" && (
                        <Badge variant="outline" className="text-[9px] border-orange-300 bg-orange-50 text-orange-700" data-testid="badge-dispute-state">
                          Dispute: {selected.disputeState}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {linkedClaimId && (
                      <Link href={`/claims-workspace?claimId=${linkedClaimId}`}>
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" data-testid="button-open-linked-claim">
                          <FileText className="w-3.5 h-3.5" /> Open Claim
                        </Button>
                      </Link>
                    )}
                    {linkedClaim?.linkedDocumentId && (
                      <Link href={`/invoices-memos?docId=${linkedClaim.linkedDocumentId}&type=credit_memo`}>
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" data-testid="button-open-linked-document">
                          <FileText className="w-3.5 h-3.5" /> Open Credit Memo
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" data-testid="button-view-contract"><Eye className="w-3.5 h-3.5" /> View Contract</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" data-testid="button-audit-trail"><FileText className="w-3.5 h-3.5" /> Audit Trail</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" data-testid="button-export"><Download className="w-3.5 h-3.5" /> Export</Button>
                  </div>
                </div>

                {Array.isArray(selectedDetail?.openDeductions) && selectedDetail.openDeductions.length > 0 && (
                  <OpenDeductionsPanel
                    deductions={selectedDetail.openDeductions}
                    contractId={selected.contractId}
                    // Use the server-resolved canonical inbound_claims.id —
                    // the deductions FK requires the UUID PK, not the
                    // human-readable claim_number that some legacy
                    // settlements still carry in claim_id.
                    settlementClaimId={selectedDetail?.inboundClaimId || null}
                  />
                )}

                {isDisputed(selected) && (
                  <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 p-3" data-testid="panel-dispute-thread">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-orange-800">
                        Dispute thread · {selected.disputeState || "open"}
                      </div>
                      {selected.disputeOpenedAt && (
                        <div className="text-[10px] text-orange-700">
                          Opened {new Date(selected.disputeOpenedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 text-[11px] text-orange-900">
                      {selected.disputeReason ? (
                        <div className="rounded bg-white/60 p-2 leading-snug" data-testid="text-dispute-reason">
                          <span className="font-medium">Reason:</span> {selected.disputeReason}
                        </div>
                      ) : (
                        <div className="italic text-orange-700">No reason captured.</div>
                      )}
                      {Array.isArray(selected.disputeMessages) && selected.disputeMessages.length > 0 ? (
                        selected.disputeMessages.map((m: any, i: number) => (
                          <div key={i} className="rounded bg-white/60 p-2 leading-snug" data-testid={`text-dispute-msg-${i}`}>
                            <span className="font-medium">{m.author || "Counterparty"}:</span> {m.body}
                            {m.createdAt && <span className="ml-1 text-orange-600">({new Date(m.createdAt).toLocaleString()})</span>}
                          </div>
                        ))
                      ) : null}
                      {selected.disputeState === "responded" && (
                        <div className="text-[10px] text-orange-700">Counterparty responded — awaiting Finance review.</div>
                      )}
                      {selected.disputeState === "resolved" && (
                        <div className="text-[10px] text-green-700">Resolved.</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-1">
                  {["match", "posting", "history", "evidence"].map(tab => (
                    <button key={tab}
                      className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${activeDetailTab === tab ? "text-orange-600 border-b-2 border-orange-600" : "text-gray-500 hover:text-gray-700"}`}
                      onClick={() => setActiveDetailTab(tab)}
                      data-testid={`tab-detail-${tab}`}
                    >
                      {tab === "match" ? "Match & Reconcile" : tab === "posting" ? "Posting Instructions" : tab === "history" ? "History & Audit" : "Evidence Docs"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activeDetailTab === "match" && (() => {
                  // Direction-aware labels for the entire match tab.
                  // For INBOUND flows (VRP) the "claim" is something WE submit
                  // to a supplier, so call it a Vendor Rebate Claim. For
                  // OUTBOUND flows (CRP, RLA, RSM, SUB) the partner submits a
                  // claim TO us, so call it a Customer Rebate Claim. Direction
                  // comes from the contract's flow type cash_direction.
                  const flowMeta = flowTypeList.find(
                    (ft) => ft.code === (selected.flowTypeCode || selected.flowType)
                  );
                  const direction = (flowMeta?.cashDirection || "outbound").toLowerCase();
                  const isInbound = direction === "inbound";
                  const claimCardLabel = isInbound
                    ? "Vendor Rebate Claim"
                    : "Customer Rebate Claim";
                  // INBOUND (VRP): we initiate the claim against the supplier.
                  //   - Primary: Submit Claim to Vendor (push our accrual to the supplier as a debit memo / claim packet)
                  //   - Secondary: Take Deduction (net off the supplier's next AP invoice)
                  //   - Tertiary: Hold for Review
                  // OUTBOUND (CRP/RLA/RSM/SUB): the partner submits a claim TO us; we accept / counter / split.
                  const primaryActionLabel = isInbound ? "Submit Claim to Vendor" : "Accept Customer Claim";
                  const primaryActionSub = isInbound
                    ? `Submit ${fmt(parseFloat(selected.accrualAmount || "0"))} debit memo. Awaiting vendor confirmation.`
                    : `Settle at ${fmt(parseFloat(selected.claimAmount || "0"))}. Write off variance.`;
                  const secondaryActionLabel = isInbound ? "Take Deduction" : "Settle at Internal Accrual";
                  const secondaryActionSub = isInbound
                    ? `Net off ${fmt(parseFloat(selected.accrualAmount || "0"))} against next vendor payment.`
                    : `Settle at ${fmt(parseFloat(selected.accrualAmount || "0"))}. Raise dispute for variance.`;
                  const tertiaryActionLabel = isInbound ? "Hold for Review" : "Partial Settlement";
                  const tertiaryActionSub = isInbound
                    ? "Park this rebate. No claim or deduction yet."
                    : "Settle matched items now. Park variance for review.";
                  // Counterparty label for the status / notify buttons.
                  // For INBOUND (VRP) the legacy `counterparty` column on
                  // the settlement row stores the tenant company itself
                  // (e.g. "TechSound Audio Inc."). The real "other party"
                  // is the contract's owning_party which the detail
                  // endpoint surfaces as `vendorPartyName`. Fall back to
                  // the generic word "vendor" only if the join missed.
                  const otherPartyLabel = isInbound
                    ? (selected.vendorPartyName || "vendor")
                    : (selected.counterparty || "partner");
                  const draftMemoLabel = isInbound ? "Draft Debit Memo" : "Draft Credit Memo";
                  return (
                  <div className="space-y-4">
                    {(() => {
                      const accrualAmt = parseFloat(selected.accrualAmount || "0");
                      const claimAmt = parseFloat(selected.claimAmount || "0");
                      const varianceAmt = parseFloat(selected.variance || "0");
                      const postedAmt = parseFloat(selected.postedAmount || "0");
                      const claimSubmittedSub = (() => {
                        if (claimAmt > 0) {
                          const dt = selected.createdAt
                            ? new Date(selected.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "";
                          return isInbound
                            ? `Claim submitted to supplier ${dt}`
                            : `Claim submitted ${dt}`;
                        }
                        return isInbound
                          ? "Awaiting supplier confirmation"
                          : "Not yet submitted by partner";
                      })();
                      // Mirror the list-item logic: until the partner has
                      // actually submitted a claim, the "variance" is the
                      // entire accrual and is misleading. Switch the
                      // Variance and Customer Rebate Claim cards into a
                      // neutral "Awaiting claim" presentation.
                      const awaitingClaim = claimAmt <= 0;
                      // Once postedAmount has absorbed the residual, the
                      // variance card should switch from "red unresolved
                      // delta" to "green cleared via JE" so the page tells
                      // the same story as the books.
                      const residualCleared = !awaitingClaim && Math.abs(varianceAmt) > 0.01 && postedAmt >= accrualAmt - 0.01;
                      const residualJe = (timeline?.journalEntries || []).find((j: any) => j.flowType === "settlement_residual");
                      const variancePctLabel = accrualAmt > 0
                        ? `${((Math.abs(varianceAmt) / accrualAmt) * 100).toFixed(1)}% below our accrual`
                        : "0% below our accrual";
                      // Inbound (VRP): "variance" against a partner claim
                      // doesn't apply — WE submit the claim, so the only
                      // meaningful unknown is the supplier's confirmation.
                      // Replace the tile with a flow-state card that tracks
                      // the claim's lifecycle instead of an arithmetic delta.
                      const renderInboundStatusTile = () => {
                        const status = selected.settlementStatus;
                        const resolution = selected.resolution;
                        if (status === "open") {
                          return (
                            <CompareCard
                              label="Decision Needed"
                              amount={accrualAmt}
                              color="text-amber-700 dark:text-amber-400"
                              bgColor="bg-amber-50 dark:bg-amber-950/30"
                              sub="Submit claim, deduct, or hold"
                            />
                          );
                        }
                        if (resolution === "submit_vendor_claim" && status !== "posted") {
                          return (
                            <CompareCard
                              label="Awaiting Vendor"
                              amount={claimAmt}
                              color="text-blue-700 dark:text-blue-400"
                              bgColor="bg-blue-50 dark:bg-blue-950/30"
                              sub="Claim submitted — pending supplier confirmation"
                            />
                          );
                        }
                        if (resolution === "apply_deduction" && status === "posted") {
                          return (
                            <CompareCard
                              label="Netted via Deduction"
                              amount={postedAmt || claimAmt}
                              color="text-emerald-700 dark:text-emerald-400"
                              bgColor="bg-emerald-50 dark:bg-emerald-950/30"
                              sub="A/P offset booked"
                            />
                          );
                        }
                        if (status === "posted") {
                          return (
                            <CompareCard
                              label="Vendor Confirmed"
                              amount={postedAmt || claimAmt}
                              color="text-emerald-700 dark:text-emerald-400"
                              bgColor="bg-emerald-50 dark:bg-emerald-950/30"
                              sub={residualJe ? `Booked via ${residualJe.jeId}` : "Receivable cleared"}
                            />
                          );
                        }
                        if (status === "review") {
                          return (
                            <CompareCard
                              label="On Hold"
                              amount={accrualAmt}
                              color="text-gray-700 dark:text-gray-300"
                              bgColor="bg-gray-50 dark:bg-gray-900"
                              sub="Parked — no claim or deduction yet"
                            />
                          );
                        }
                        return (
                          <CompareCard
                            label="Status"
                            amount={accrualAmt}
                            color="text-gray-500"
                            bgColor="bg-gray-50 dark:bg-gray-900"
                            sub={status || ""}
                          />
                        );
                      };
                      return (
                        <div className="grid grid-cols-4 gap-3">
                          <CompareCard label="Our Accrual" amount={accrualAmt} color="text-gray-900 dark:text-gray-100" bgColor="bg-gray-50 dark:bg-gray-900" />
                          {isInbound ? (
                            renderInboundStatusTile()
                          ) : awaitingClaim ? (
                            <CompareCard label="Variance" amount={0} color="text-gray-500" bgColor="bg-gray-50 dark:bg-gray-900" sub="Awaiting claim — not yet comparable" />
                          ) : residualCleared ? (
                            <CompareCard
                              label="Variance Cleared"
                              amount={varianceAmt}
                              color="text-emerald-700 dark:text-emerald-400"
                              bgColor="bg-emerald-50 dark:bg-emerald-950/30"
                              sub={residualJe ? `Booked via ${residualJe.jeId}` : "Residual posted to GL"}
                            />
                          ) : (
                            <CompareCard label="Variance" amount={varianceAmt} color={varianceAmt < 0 ? "text-red-600" : "text-green-600"} bgColor="bg-red-50 dark:bg-red-950/30" sub={variancePctLabel} />
                          )}
                          <CompareCard
                            label={claimCardLabel}
                            amount={claimAmt}
                            color="text-gray-900 dark:text-gray-100"
                            bgColor="bg-gray-50 dark:bg-gray-900"
                            sub={claimSubmittedSub}
                          />
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-center">
                            <MatchBadge status={selected.matchStatus} large />
                          </div>
                        </div>
                      );
                    })()}

                    {selected.aiAnalysis && (
                      <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-orange-600" /> AI Variance Analysis</div>
                            <Badge variant="outline" className="text-[9px] bg-orange-100 text-orange-600 border-orange-200">Auto-detected</Badge>
                          </div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{selected.aiAnalysis}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openLiqAI(`Review the contract clause for settlement ${selected.counterparty}`)}>View Contract Clause</Button>
                            <Button size="sm" className="text-xs h-7 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => openLiqAI(`Accept AI analysis for settlement with ${selected.counterparty}`)}>Accept AI Analysis</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {lineItems.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-2">Line Item Comparison</div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                              <tr>
                                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Category / Line</th>
                                <th className="text-right py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Accrual</th>
                                <th className="text-right py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">{isInbound ? "Vendor Claim" : "Customer Claim"}</th>
                                <th className="text-right py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Variance</th>
                                <th className="text-center py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-center py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((li: any, idx: number) => {
                                const v = parseFloat(li.variance || "0");
                                const st = LINE_STATUS_CONFIG[li.status] || LINE_STATUS_CONFIG.pending;
                                return (
                                  <tr key={li.id || idx} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50" data-testid={`line-item-${idx}`}>
                                    <td className="py-2.5 px-3 flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v !== 0 ? "bg-orange-500" : "bg-green-500"}`} />
                                      <span className="text-gray-900 dark:text-gray-100">{li.category || li.lineName}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100 font-medium">${parseFloat(li.accrualAmount || "0").toLocaleString()}</td>
                                    <td className="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100">${parseFloat(li.claimAmount || "0").toLocaleString()}</td>
                                    <td className={`py-2.5 px-3 text-right font-semibold ${v < 0 ? "text-red-600" : v > 0 ? "text-green-600" : "text-gray-500"}`}>{v < 0 ? "-" : ""}${Math.abs(v).toLocaleString()}</td>
                                    <td className="py-2.5 px-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.className}`}>{st.label}</span></td>
                                    <td className="py-2.5 px-3 text-center">
                                      <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-gray-500 hover:text-orange-600">Review</Button>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-semibold">
                                <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100">Total</td>
                                <td className="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100">${lineItems.reduce((s: number, li: any) => s + parseFloat(li.accrualAmount || "0"), 0).toLocaleString()}</td>
                                <td className="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100">${lineItems.reduce((s: number, li: any) => s + parseFloat(li.claimAmount || "0"), 0).toLocaleString()}</td>
                                <td className={`py-2.5 px-3 text-right ${parseFloat(selected.variance || "0") < 0 ? "text-red-600" : "text-green-600"}`}>${Math.abs(lineItems.reduce((s: number, li: any) => s + parseFloat(li.variance || "0"), 0)).toLocaleString()}</td>
                                <td className="py-2.5 px-3 text-center"><MatchBadge status={selected.matchStatus} /></td>
                                <td className="py-2.5 px-3"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-200" data-testid="lifecycle-explainer">
                      <div className="font-semibold mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Settlement lifecycle
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] leading-relaxed">
                        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 font-medium">1. Obligation accrued</span>
                        <ChevronRight className="w-3 h-3 text-blue-400" />
                        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 font-medium">2. Match vs partner claim</span>
                        <ChevronRight className="w-3 h-3 text-blue-400" />
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 font-semibold">3. Decision (you are here)</span>
                        <ChevronRight className="w-3 h-3 text-blue-400" />
                        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 font-medium">4a. Post Credit Memo → GL</span>
                        <span className="text-blue-400">or</span>
                        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 font-medium">4b. Open Recovery Claim → Claims Workspace</span>
                      </div>
                    </div>

                    {(() => {
                      // Gate the decision/transact buttons whenever the linked
                      // inbound claim hasn't been explicitly approved or
                      // partial-approved by a human reviewer in the Claims
                      // Workspace. This mirrors the server-side gate on
                      // PATCH /api/settlements/:id and prevents the UI from
                      // silently bypassing the approval workflow.
                      // The "linked claim must be approved first" gate only
                      // applies to OUTBOUND flows (CRP/RLA/...), where the
                      // partner submits a claim TO us and finance has to
                      // sign off before we settle. For INBOUND (VRP) we
                      // generate the claim ourselves, so there's nothing
                      // to wait on.
                      const claimAwaitingApproval =
                        !isInbound &&
                        !!linkedClaim &&
                        !CLAIM_STATUSES_OK_TO_SETTLE.includes(linkedClaim.status || "");
                      // Once the settlement has been posted (GL written) the
                      // decision is final — nobody should be able to flip the
                      // resolution after the journal entries are out the door.
                      // We also treat the linked claim being `settled` as a
                      // belt-and-braces lock signal in case the settlement
                      // status hasn't caught up yet.
                      const isPosted =
                        selected.settlementStatus === "posted" ||
                        linkedClaim?.status === "settled";
                      const inboundInProgress =
                        submitVendorClaimMutation.isPending ||
                        applyDeductionMutation.isPending ||
                        holdForReviewMutation.isPending;
                      const settleDisabled = settleInProgress || inboundInProgress || claimAwaitingApproval || isPosted;
                      // The selected resolution drives which card lights up.
                      // null/undefined means no decision recorded yet —
                      // everything renders neutral.
                      const currentResolution: string | null = selected.resolution || null;
                      const lockTooltip = isPosted
                        ? "Settlement is already posted to the GL — the decision can no longer be changed."
                        : claimAwaitingApproval
                          ? "Approve the linked claim in Claims Workspace first"
                          : undefined;
                      return (
                    <div>
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Settlement Decision</div>
                        <div className="flex items-center gap-2">
                          {isPosted && (
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                              data-testid="badge-settlement-locked"
                              title="Settlement is posted — decision locked"
                            >
                              Posted · Locked
                            </span>
                          )}
                          {linkedClaim && (
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                claimAwaitingApproval
                                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                              }`}
                              data-testid="badge-linked-claim-status"
                              title="Status of the inbound claim attached to this settlement"
                            >
                              Claim: {linkedClaim.status?.replace(/_/g, " ") || "—"}
                            </span>
                          )}
                        </div>
                      </div>
                      {claimAwaitingApproval && !isInbound && (
                        <div
                          className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200"
                          data-testid="banner-claim-approval-required"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-semibold">Claim approval required before settling</div>
                            <div className="text-amber-800 dark:text-amber-300">
                              The linked customer claim is currently in
                              <span className="font-medium"> "{linkedClaim?.status?.replace(/_/g, " ") || "—"}"</span>.
                              Approve or partial-approve it in the Claims Workspace, then return here to post the settlement.
                            </div>
                          </div>
                          <Link href={`/claims-workspace?claimId=${linkedClaim?.id}`}>
                            <a
                              className="text-[10.5px] font-semibold px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
                              data-testid="link-open-claims-workspace"
                            >
                              Open Claims Workspace
                            </a>
                          </Link>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          className={`relative border-2 rounded-lg p-3 text-left transition-all group disabled:cursor-not-allowed ${
                            currentResolution === "accept_claim"
                              ? "border-green-500 bg-green-50 dark:bg-green-950/40 ring-2 ring-green-300 dark:ring-green-700 shadow-sm"
                              : currentResolution
                                ? "border-green-100 dark:border-green-900 opacity-50 hover:opacity-100 hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/20"
                                : "border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400"
                          } ${settleDisabled ? "disabled:opacity-50" : ""}`}
                          disabled={settleDisabled}
                          title={lockTooltip}
                          onClick={() => {
                            if (isInbound) {
                              submitVendorClaimMutation.mutate(selected.id);
                            } else {
                              settleWithClaimGate({
                                settlementId: selected.id,
                                resolution: "accept_claim",
                                settlementStatus: "approved",
                                claim: linkedClaim ? { id: linkedClaim.id, status: linkedClaim.status } : undefined,
                                successMessage: "Settled at customer claim amount",
                              });
                            }
                          }}
                          data-testid={isInbound ? "button-submit-vendor-claim" : "button-accept-claim"}
                        >
                          {currentResolution === "accept_claim" && (
                            <span
                              className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-green-600 text-white flex items-center gap-0.5"
                              data-testid="badge-selected-accept-claim"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs font-bold text-green-700 dark:text-green-400">{primaryActionLabel}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">{primaryActionSub}</div>
                        </button>
                        <button
                          className={`relative border-2 rounded-lg p-3 text-left transition-all group disabled:cursor-not-allowed ${
                            currentResolution === "settle_at_accrual"
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 ring-2 ring-orange-300 dark:ring-orange-700 shadow-sm"
                              : currentResolution
                                ? "border-orange-100 dark:border-orange-900 opacity-50 hover:opacity-100 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                                : "border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-400"
                          } ${settleDisabled ? "disabled:opacity-50" : ""}`}
                          disabled={settleDisabled}
                          title={lockTooltip}
                          onClick={() => {
                            if (isInbound) {
                              applyDeductionMutation.mutate(selected.id);
                              return;
                            }
                            const accrualAmount = parseFloat(selected.accrualAmount || "0");
                            const claimAmount = parseFloat(selected.claimAmount || "0");
                            const variance = accrualAmount - claimAmount;
                            // Only attach a dispute when the partner's claim
                            // actually deviates from our accrual and the
                            // claim isn't already in dispute.
                            const shouldDispute =
                              !!linkedClaim &&
                              linkedClaim.disputeState !== "open" &&
                              linkedClaim.disputeState !== "responded" &&
                              Math.abs(variance) >= 0.01;
                            settleWithClaimGate({
                              settlementId: selected.id,
                              resolution: "settle_at_accrual",
                              settlementStatus: "approved",
                              claim: linkedClaim ? { id: linkedClaim.id, status: linkedClaim.status } : undefined,
                              openDispute: shouldDispute
                                ? { reason: `Settled at internal accrual ${fmt(accrualAmount)}; partner claimed ${fmt(claimAmount)}. Variance disputed.` }
                                : undefined,
                              successMessage: "Settled at internal accrual",
                            });
                          }}
                          data-testid={isInbound ? "button-take-deduction" : "button-settle-accrual"}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Scale className="w-3.5 h-3.5 text-orange-600" />
                            <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{secondaryActionLabel}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">{secondaryActionSub}</div>
                        </button>
                        <button
                          className={`relative border-2 rounded-lg p-3 text-left transition-all group disabled:cursor-not-allowed ${
                            currentResolution === "partial"
                              ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/40 ring-2 ring-yellow-300 dark:ring-yellow-700 shadow-sm"
                              : currentResolution
                                ? "border-yellow-100 dark:border-yellow-900 opacity-50 hover:opacity-100 hover:border-yellow-300 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/20"
                                : "border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 hover:border-yellow-400"
                          } ${settleDisabled ? "disabled:opacity-50" : ""}`}
                          disabled={settleDisabled}
                          title={lockTooltip}
                          onClick={() => {
                            if (isInbound) {
                              holdForReviewMutation.mutate(selected.id);
                            } else {
                              settleWithClaimGate({
                                settlementId: selected.id,
                                resolution: "partial",
                                settlementStatus: "partial",
                                claim: linkedClaim ? { id: linkedClaim.id, status: linkedClaim.status } : undefined,
                                successMessage: "Partial settlement recorded",
                              });
                            }
                          }}
                          data-testid={isInbound ? "button-hold-for-review" : "button-partial-settlement"}
                        >
                          {currentResolution === "partial" && (
                            <span
                              className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-yellow-600 text-white flex items-center gap-0.5"
                              data-testid="badge-selected-partial"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 mb-1">
                            <ArrowUpDown className="w-3.5 h-3.5 text-yellow-600" />
                            <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{tertiaryActionLabel}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">{tertiaryActionSub}</div>
                        </button>
                      </div>
                    </div>
                      );
                    })()}

                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg text-[11px] border ${
                        selected.settlementStatus === "posted"
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {(() => {
                        // Lifecycle-aware status line. Three states:
                        //
                        //   1. settlementStatus === 'posted' → settlement is
                        //      closed. Show "Settlement completed — posted to
                        //      GL" with the JE id (when known) so the user
                        //      knows the auto-close fired and there's
                        //      nothing else to do here.
                        //
                        //   2. fully_matched but not posted → credit memo
                        //      is in flight. Show that the GL post is
                        //      pending so the user knows to finish on
                        //      Invoices & Memos.
                        //
                        //   3. otherwise → describe the variance vs. our
                        //      accrual (the original behavior).
                        if (selected.settlementStatus === "posted") {
                          const postedAmt = parseFloat(selected.postedAmount || selected.accrualAmount || "0");
                          const postedAmtStr = postedAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          const jeId = selected.jeId || selectedDetail?.jeId;
                          return (
                            <span data-testid="text-settlement-status" className="flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Settlement completed — ${postedAmtStr} posted to GL{jeId ? ` via JE ${jeId}` : ""}.
                            </span>
                          );
                        }
                        if (
                          selected.matchStatus === "fully_matched"
                          && linkedClaim?.linkedDocumentId
                        ) {
                          return (
                            <span data-testid="text-settlement-status">
                              Status: matched — credit memo drafted, awaiting GL post in Invoices &amp; Memos.
                            </span>
                          );
                        }
                        // variance = accrual - claim, so:
                        //   variance > 0 → claim came in UNDER our accrual
                        //   variance < 0 → claim came in OVER our accrual
                        //   variance = 0 → exact match
                        const v = parseFloat(selected.variance || "0");
                        const abs = Math.abs(v).toLocaleString();
                        const accrualStr = parseFloat(selected.accrualAmount || "0").toLocaleString();
                        if (isInbound) {
                          // For VRP we are the claimant; the variance card
                          // here means the supplier hasn't yet confirmed
                          // our $X claim. Use language that matches the
                          // direction of the cash.
                          if (Math.abs(v) < 0.01 && parseFloat(selected.claimAmount || "0") > 0.01) {
                            return <span data-testid="text-settlement-status">Status: vendor confirmed our claim of ${accrualStr}.</span>;
                          }
                          return <span data-testid="text-settlement-status">Status: claiming ${accrualStr} from {otherPartyLabel} — awaiting confirmation.</span>;
                        }
                        let phrase: string;
                        if (Math.abs(v) < 0.01) {
                          phrase = "matches our accrual exactly";
                        } else if (v < 0) {
                          phrase = `over our accrual by $${abs}`;
                        } else {
                          phrase = `under our accrual by $${abs}`;
                        }
                        return <span data-testid="text-settlement-status">Status: {selected.counterparty} claim {phrase}</span>;
                      })()}
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => openLiqAI(`Notify ${otherPartyLabel} about settlement`)}>
                        <Send className="w-3 h-3" /> Notify {otherPartyLabel}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => openLiqAI(`Review contract clause for ${selected.counterparty} settlement`)}>
                        <Eye className="w-3 h-3" /> Review Clause
                      </Button>
                      {/* Hide the orange "Post Credit Memo" generate button
                          once a credit memo already exists for this claim
                          (linked_document_id is set). The header toolbar
                          above already exposes "Open Credit Memo" → which
                          deep-links to /invoices-memos to finish the GL
                          post. Leaving this button enabled was confusing —
                          clicking it again just re-routed to the same
                          existing draft (the endpoint is idempotent on
                          linked_document_id), so users thought it had
                          re-posted. Once the doc transitions to `posted`
                          on Invoices & Memos, the server-side state
                          machine now auto-flips the settlement to
                          `posted` (see transitionFinanceDocument). */}
                      {!linkedClaim?.linkedDocumentId && (
                        <Button
                          size="sm"
                          className="text-[10px] h-6 gap-1 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            !linkedClaim ||
                            !CLAIM_STATUSES_OK_TO_SETTLE.includes(linkedClaim.status || "") ||
                            postCreditMemoMutation.isPending
                          }
                          onClick={() => {
                            if (!linkedClaim?.id) return;
                            postCreditMemoMutation.mutate({ claimId: linkedClaim.id });
                          }}
                          data-testid="button-post-credit-memo"
                          title={
                            !linkedClaim
                              ? "No linked customer claim — nothing to credit"
                              : !CLAIM_STATUSES_OK_TO_SETTLE.includes(linkedClaim.status || "")
                                ? "Approve the linked claim in Claims Workspace before posting a credit memo"
                                : "Generate a draft credit memo and open Invoices & Memos to finish the GL post"
                          }
                        >
                          <FileText className="w-3 h-3" />
                          {postCreditMemoMutation.isPending ? "Drafting…" : draftMemoLabel}
                        </Button>
                      )}
                      {linkedClaim?.linkedDocumentId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 gap-1 border-orange-500 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                          title="Credit memo already drafted — finish the Send → Awaiting Oracle → Posted lifecycle in Invoices & Memos to close this settlement"
                          data-testid="button-finish-gl-post"
                          onClick={() => {
                            // Use programmatic navigation (matching the
                            // postCreditMemoMutation success path above)
                            // instead of a wouter <Link> wrapping a
                            // <button>. The nested-anchor pattern was
                            // mis-routing inside this action bar — the
                            // outer settlement card has its own click
                            // handlers that intercept bubbled events.
                            navigate(
                              `/invoices-memos?docId=${linkedClaim.linkedDocumentId}&type=credit_memo`,
                            );
                          }}
                        >
                          <FileText className="w-3 h-3" />
                          Finish GL Post →
                        </Button>
                      )}
                      {(() => {
                        // Clear-residual is only meaningful when the
                        // settlement has a positive over-accrual that
                        // hasn't yet been booked. Hide entirely otherwise
                        // so the bar doesn't get cluttered with disabled
                        // controls. Eligibility mirrors the server-side
                        // helper: status in [partial, posted] AND
                        // accrual − claim > $0.01 AND postedAmount has
                        // not already absorbed the residual.
                        const accrual = parseFloat(selected.accrualAmount || "0");
                        const claim = parseFloat(selected.claimAmount || "0");
                        const posted = parseFloat(selected.postedAmount || "0");
                        const residual = +(accrual - claim).toFixed(2);
                        // Eligible whenever finance has formally agreed
                        // to a settlement amount (Accept Customer Claim
                        // → "approved", Partial Settlement → "partial",
                        // already-posted → "posted"). Mirrors the
                        // server-side gate in clearSettlementResidual.
                        const eligibleStatus = ["approved", "partial", "posted"].includes(selected.settlementStatus || "");
                        const alreadyCleared = posted >= accrual - 0.01;
                        const hasResidual = residual > 0.01;
                        if (!eligibleStatus || !hasResidual || alreadyCleared) return null;
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50"
                            disabled={clearResidualMutation.isPending}
                            onClick={() => clearResidualMutation.mutate(selected.id)}
                            data-testid="button-clear-residual"
                            title={`Post a true-up JE (DR Accrued Liability / CR Revenue) for $${residual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to clear the leftover accrual`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {clearResidualMutation.isPending
                              ? "Clearing…"
                              : `Clear Residual ($${residual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                          </Button>
                        );
                      })()}
                      {linkedClaim &&
                       linkedClaim.disputeState !== "open" &&
                       linkedClaim.disputeState !== "responded" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 gap-1 border-red-400 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          disabled={disputeClaimMutation.isPending}
                          onClick={() => {
                            const accrualAmount = parseFloat(selected.accrualAmount || "0");
                            const claimAmount = parseFloat(selected.claimAmount || "0");
                            const variance = accrualAmount - claimAmount;
                            const reason = Math.abs(variance) >= 0.01
                              ? `Variance: partner claimed ${fmt(claimAmount)} vs internal accrual ${fmt(accrualAmount)} (delta ${fmt(Math.abs(variance))}).`
                              : `Disputing settlement for ${selected.counterparty}.`;
                            disputeClaimMutation.mutate({ claimId: linkedClaim.id, reason });
                          }}
                          data-testid="button-open-dispute"
                          title="Open a formal dispute on the linked inbound claim"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {disputeClaimMutation.isPending ? "Opening…" : "Open Dispute"}
                        </Button>
                      )}
                      {exceedsTolerance(selected) && parseFloat(selected.variance || "0") < 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 gap-1 border-orange-400 text-orange-700 hover:bg-orange-50"
                          disabled={generateClaimMutation.isPending}
                          onClick={() => generateClaimMutation.mutate(selected.id)}
                          data-testid="button-generate-claim-from-variance"
                          title={`Partner over-claimed beyond ${VARIANCE_TOLERANCE_PCT}% tolerance — open a recovery claim in the Claims Workspace`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {generateClaimMutation.isPending ? "Opening…" : "Open Recovery Claim"}
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })()}

                {activeDetailTab === "posting" && (() => {
                  const jes = timeline?.journalEntries || [];
                  if (!timeline) {
                    return <div className="text-center py-10 text-sm text-gray-400">Loading posting instructions…</div>;
                  }
                  if (jes.length === 0) {
                    return <div className="text-center py-10 text-sm text-gray-400">No journal entries posted for this settlement yet. Use the action bar above to post a credit memo or clear the residual.</div>;
                  }
                  // Group: rebate JE first, residual JEs after.
                  const sorted = [...jes].sort((a, b) => {
                    const aResid = a.flowType === "settlement_residual" ? 1 : 0;
                    const bResid = b.flowType === "settlement_residual" ? 1 : 0;
                    if (aResid !== bResid) return aResid - bResid;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                  });
                  return (
                    <div className="space-y-3" data-testid="tab-posting-instructions">
                      {sorted.map((je: any) => {
                        const isResidual = je.flowType === "settlement_residual";
                        const totalDr = (je.lines || []).reduce((s: number, l: any) => s + parseFloat(l.debitAmount || "0"), 0);
                        const totalCr = (je.lines || []).reduce((s: number, l: any) => s + parseFloat(l.creditAmount || "0"), 0);
                        return (
                          <Card key={je.jeId} className={`border ${isResidual ? "border-emerald-200 dark:border-emerald-900" : "border-gray-200 dark:border-gray-700"}`} data-testid={`card-je-${je.jeId}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Receipt className={`w-4 h-4 ${isResidual ? "text-emerald-600" : "text-gray-500"}`} />
                                  <div>
                                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100" data-testid={`text-je-id-${je.jeId}`}>{je.jeId}</div>
                                    <div className="text-[10px] text-gray-500">
                                      {isResidual ? "Residual true-up" : (je.flowType || "Rebate")} · {je.period} · {je.createdAt ? new Date(je.createdAt).toLocaleString() : ""}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[9px] ${je.jeStage === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : je.jeStage === "draft" ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                    {je.jeStage || "draft"}
                                  </Badge>
                                  <span className="text-xs font-mono font-bold text-gray-900 dark:text-gray-100">{fmt(parseFloat(je.totalAmount || "0"))}</span>
                                </div>
                              </div>
                              <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-[10px]">
                                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500">
                                    <tr>
                                      <th className="text-left px-2 py-1 font-medium">Account</th>
                                      <th className="text-left px-2 py-1 font-medium">Description</th>
                                      <th className="text-right px-2 py-1 font-medium">Debit</th>
                                      <th className="text-right px-2 py-1 font-medium">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(je.lines || []).map((line: any, idx: number) => (
                                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1.5 font-mono text-gray-700 dark:text-gray-300">{line.accountCode} <span className="text-gray-400">·</span> <span className="text-gray-500">{line.accountName}</span></td>
                                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{line.description}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-gray-900 dark:text-gray-100">{parseFloat(line.debitAmount || "0") > 0 ? fmt(parseFloat(line.debitAmount)) : "—"}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-gray-900 dark:text-gray-100">{parseFloat(line.creditAmount || "0") > 0 ? fmt(parseFloat(line.creditAmount)) : "—"}</td>
                                      </tr>
                                    ))}
                                    <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                      <td colSpan={2} className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-300">Totals</td>
                                      <td className="px-2 py-1.5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">{fmt(totalDr)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">{fmt(totalCr)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}

                {activeDetailTab === "history" && (() => {
                  if (!timeline) {
                    return <div className="text-center py-10 text-sm text-gray-400">Loading history…</div>;
                  }
                  // Build a unified timeline from claim events, JE postings,
                  // settlement creation, and (if posted) the posting itself.
                  type Event = { ts: string; icon: any; iconColor: string; title: string; subtitle?: string; meta?: string };
                  const events: Event[] = [];
                  if (selected?.createdAt) {
                    events.push({
                      ts: selected.createdAt,
                      icon: Plus,
                      iconColor: "text-gray-500",
                      title: "Settlement created",
                      subtitle: `Accrual ${fmt(parseFloat(selected.accrualAmount || "0"))} · ${selected.period}`,
                    });
                  }
                  for (const ev of timeline.claimEvents || []) {
                    events.push({
                      ts: ev.createdAt,
                      icon: ev.eventType === "approve" ? CheckCircle2 : ev.eventType === "intake" ? Send : ev.eventType === "dispute" ? XCircle : FileText,
                      iconColor: ev.eventType === "approve" ? "text-emerald-600" : ev.eventType === "dispute" ? "text-red-600" : "text-blue-600",
                      title: `Claim ${ev.eventType}${ev.toStatus ? ` → ${ev.toStatus}` : ""}`,
                      subtitle: ev.description || (ev.fromStatus ? `From ${ev.fromStatus}` : undefined),
                      meta: ev.userName ? `by ${ev.userName}` : undefined,
                    });
                  }
                  for (const je of timeline.journalEntries || []) {
                    const isResid = je.flowType === "settlement_residual";
                    events.push({
                      ts: je.createdAt,
                      icon: Receipt,
                      iconColor: isResid ? "text-emerald-600" : "text-gray-700",
                      title: isResid ? `Residual cleared · ${je.jeId}` : `Journal entry posted · ${je.jeId}`,
                      subtitle: `${fmt(parseFloat(je.totalAmount || "0"))} · ${je.period} · stage: ${je.jeStage || "draft"}`,
                    });
                  }
                  for (const doc of timeline.documents || []) {
                    events.push({
                      ts: doc.createdAt,
                      icon: FileText,
                      iconColor: "text-blue-600",
                      title: `${doc.documentType === "credit_memo" ? "Credit memo" : doc.documentType} issued · ${doc.documentNumber}`,
                      subtitle: `${fmt(parseFloat(doc.amount || "0"))} ${doc.currency || ""} · status: ${doc.status}`,
                    });
                  }
                  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
                  if (events.length === 0) {
                    return <div className="text-center py-10 text-sm text-gray-400">No history yet for this settlement.</div>;
                  }
                  return (
                    <div className="space-y-2" data-testid="tab-history-audit">
                      {events.map((e, i) => {
                        const Icon = e.icon;
                        return (
                          <div key={i} className="flex gap-3 items-start" data-testid={`event-history-${i}`}>
                            <div className="flex flex-col items-center pt-1">
                              <div className={`w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center ${e.iconColor}`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              {i < events.length - 1 && <div className="w-px flex-1 min-h-[12px] bg-gray-200 dark:bg-gray-700 mt-1" />}
                            </div>
                            <div className="flex-1 pb-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{e.title}</div>
                                <div className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</div>
                              </div>
                              {e.subtitle && <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{e.subtitle}</div>}
                              {e.meta && <div className="text-[10px] text-gray-400 mt-0.5">{e.meta}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {activeDetailTab === "evidence" && (() => {
                  if (!timeline) {
                    return <div className="text-center py-10 text-sm text-gray-400">Loading evidence…</div>;
                  }
                  const docs = timeline.documents || [];
                  const claim = timeline.claim;
                  const hasContract = !!selected?.contractId;
                  const hasAny = docs.length > 0 || !!claim || hasContract;
                  if (!hasAny) {
                    return <div className="text-center py-10 text-sm text-gray-400">No supporting documents linked to this settlement yet.</div>;
                  }
                  return (
                    <div className="space-y-3" data-testid="tab-evidence-docs">
                      {hasContract && (
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Source contract</div>
                                <div className="text-[10px] text-gray-500 truncate max-w-[420px]">{selected.contractName || selected.contractId}</div>
                              </div>
                            </div>
                            <Link href={`/contracts/${selected.contractId}`}>
                              <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" data-testid="link-evidence-contract">
                                <ExternalLink className="w-3 h-3" /> Open
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      )}
                      {claim && (
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-blue-600" />
                                <div>
                                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Customer claim · {claim.claimNumber}</div>
                                  <div className="text-[10px] text-gray-500">
                                    Source: <span className="font-mono">{claim.sourceChannel || "manual"}</span>
                                    {claim.externalClaimId ? <> · Ref: <span className="font-mono">{claim.externalClaimId}</span></> : null}
                                    {claim.sourceEventId ? <> · Event: <span className="font-mono">{claim.sourceEventId}</span></> : null}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[9px]">{claim.status}</Badge>
                            </div>
                            {claim.rawPayload && (
                              <details className="mt-2">
                                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700">View raw payload</summary>
                                <pre className="text-[9px] mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-auto max-h-48 font-mono text-gray-700 dark:text-gray-300">{JSON.stringify(claim.rawPayload, null, 2)}</pre>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                      )}
                      {docs.map((doc: any) => (
                        <Card key={doc.id} className="border-gray-200 dark:border-gray-700" data-testid={`card-document-${doc.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-gray-500" />
                                <div>
                                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                    {doc.documentType === "credit_memo" ? "Credit Memo" : doc.documentType} · {doc.documentNumber}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {fmt(parseFloat(doc.amount || "0"))} {doc.currency || ""} · {doc.period}
                                    {doc.oracleDocNumber ? <> · Oracle: <span className="font-mono">{doc.oracleDocNumber}</span></> : null}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[9px] ${doc.status === "sent" || doc.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                {doc.status}
                              </Badge>
                            </div>
                            {doc.notes && (
                              <pre className="mt-2 text-[10px] p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">{doc.notes}</pre>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        <div className="w-[260px] flex-shrink-0 hidden xl:block" data-testid="section-settlement-ai">
          <Card className="border-gray-200 dark:border-gray-700 sticky top-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100">Settlement AI</div>
                    <div className="text-[10px] text-gray-400">{selected ? `${selected.counterparty}` : "Select a settlement"}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] text-green-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
                </span>
              </div>

              {selected ? (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-3 text-[11px] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 space-y-1.5">
                  <div className="font-medium text-orange-600 text-[10px]">LICENSEIQ AI</div>
                  <div>{selected.counterparty}'s claim of {fmt(parseFloat(selected.claimAmount || "0"))} is ${Math.abs(parseFloat(selected.variance || "0")).toLocaleString()} {parseFloat(selected.variance || "0") < 0 ? "below" : "above"} our accrual.</div>
                  {selected.aiAnalysis && <div className="mt-1">{selected.aiAnalysis}</div>}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-3 text-[11px] text-gray-500 border border-gray-200 dark:border-gray-700 text-center">
                  Select a settlement to get AI insights
                </div>
              )}

              <div className="mb-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Actions</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Is gross or net volume specified?", q: "Is gross or net volume specified in the contract?" },
                    { label: "Calculate correct tier", q: selected ? `Calculate the correct rebate tier for ${selected.counterparty}` : "Calculate the correct rebate tier" },
                    { label: "Gross shipped volume", q: selected ? `What is ${selected.counterparty}'s gross shipped volume?` : "What is the gross shipped volume?" },
                    { label: "Draft credit memo", q: selected ? `Draft credit memo instructions for ${selected.counterparty} at ${fmt(parseFloat(selected.claimAmount || "0"))}` : "Draft credit memo instructions" },
                    { label: "Talk about this settlement", q: selected ? `Explain the settlement analysis for ${selected.counterparty}` : "Explain the settlement analysis" },
                  ].map((qa, idx) => (
                    <button key={idx}
                      className="text-[10px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-600 dark:hover:border-orange-700 dark:hover:text-orange-400 transition-colors text-left"
                      onClick={() => openLiqAI(qa.q)}
                      data-testid={`button-quick-${idx}`}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Input
                  placeholder="Ask about this settlement..."
                  value={liqInput}
                  onChange={e => setLiqInput(e.target.value)}
                  className="text-[11px] h-8 pr-8"
                  onKeyDown={e => {
                    if (e.key === "Enter" && liqInput.trim()) {
                      openLiqAI(liqInput.trim());
                      setLiqInput("");
                    }
                  }}
                  data-testid="input-liq-settlement"
                />
                <button
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 transition-colors"
                  onClick={() => { if (liqInput.trim()) { openLiqAI(liqInput.trim()); setLiqInput(""); } }}
                  data-testid="button-send-liq"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function SettlementListItem({ s, selected, onClick }: { s: any; selected: boolean; onClick: () => void }) {
  const accrual = parseFloat(s.accrualAmount || "0");
  const claim = parseFloat(s.claimAmount || "0");
  const variance = parseFloat(s.variance || "0");
  // A settlement only has a meaningful variance once the partner has
  // actually submitted a claim. When claim_amount is 0 we have an accrual
  // sitting open but nothing to compare against — showing the full
  // accrual as a red "-$X" makes it look like a loss when in reality
  // nothing has been claimed yet. Surface the accrual as a neutral
  // "Awaiting claim" indicator instead.
  const awaitingClaim = claim <= 0;
  return (
    <div
      className={`mb-1.5 p-2.5 rounded-lg border cursor-pointer transition-all ${selected ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-700" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-950"}`}
      onClick={onClick}
      data-testid={`settlement-item-${s.id}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate flex-1">{s.counterparty} — {s.contractName || "Settlement"}</div>
        {awaitingClaim ? (
          <span className="text-xs font-bold ml-2 text-gray-500" data-testid={`settlement-amount-${s.id}`}>
            ${accrual.toLocaleString()}
          </span>
        ) : (
          <span className={`text-xs font-bold ml-2 ${variance < 0 ? "text-red-600" : variance > 0 ? "text-green-600" : "text-gray-500"}`} data-testid={`settlement-amount-${s.id}`}>
            {variance < 0 ? "-" : variance > 0 ? "+" : ""}${Math.abs(variance).toLocaleString()}
          </span>
        )}
      </div>
      {awaitingClaim && (
        <div className="text-[10px] text-gray-400 mb-0.5" data-testid={`settlement-awaiting-${s.id}`}>Accrued · Awaiting claim</div>
      )}
      <div className="text-[10px] text-gray-500 truncate mb-1.5">
        Contract: {s.contractName || "—"} · Claim #{s.claimRef || s.claimId || "—"}
      </div>
      <div className="flex items-center gap-2">
        <MatchBadge status={s.matchStatus} />
        <span className="text-[10px] text-gray-400" data-testid={`text-flow-${s.id}`}>
          {s.flowTypeCode || s.flowType || "—"}
        </span>
        <MatchBar pct={s.matchPct || 0} />
      </div>
      {(s.openDeductionCount || 0) > 0 && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
          data-testid={`badge-open-deductions-${s.id}`}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {s.openDeductionCount} open deduction{s.openDeductionCount === 1 ? "" : "s"} · ${Math.round(s.openDeductionExposure || 0).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function OpenDeductionsPanel({
  deductions,
  contractId,
  settlementClaimId,
}: {
  deductions: any[];
  contractId?: string | null;
  settlementClaimId?: string | null;
}) {
  const { toast } = useToast();
  // Inline "Match to claim" wires the existing
  // POST /api/finance/deductions/:id/match endpoint, passing the linked
  // claim from this settlement so the close team can resolve a deduction
  // without bouncing into the Deductions Workspace.
  const matchToClaimMut = useMutation({
    mutationFn: async (deductionId: string) =>
      (await apiRequest("POST", `/api/finance/deductions/${deductionId}/match`, { claimId: settlementClaimId })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions"] });
      toast({ title: "Linked deduction to this settlement's claim" });
    },
    onError: (e: any) => toast({ title: "Match failed", description: e.message, variant: "destructive" }),
  });
  const total = deductions.reduce((sum, d) => sum + parseFloat(d.deductedAmount || "0"), 0);
  // Deep-link into the deductions workspace pre-filtered to this contract
  // so close teams can triage in one click. The workspace already supports
  // ?contractId= and ?deductionId= via URL params.
  const contractFilterHref = contractId
    ? `/deductions-workspace?contractId=${contractId}`
    : `/deductions-workspace`;
  return (
    <div
      className="mb-3 rounded-md border border-orange-200 bg-orange-50/70 p-3 dark:border-orange-900/50 dark:bg-orange-950/20"
      data-testid="panel-open-deductions"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-700 dark:text-orange-400" />
          <span className="text-[11px] font-semibold text-orange-900 dark:text-orange-300" data-testid="text-open-deductions-title">
            {deductions.length} open deduction{deductions.length === 1 ? "" : "s"} on this contract
          </span>
          <span className="text-[11px] text-orange-700 dark:text-orange-400" data-testid="text-open-deductions-total">
            · ${Math.round(total).toLocaleString()} exposure
          </span>
        </div>
        <Link href={contractFilterHref}>
          <Button variant="outline" size="sm" className="h-6 gap-1 border-orange-300 text-[10px] text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300" data-testid="button-open-all-deductions">
            <FileText className="h-3 w-3" /> Open in Deductions
          </Button>
        </Link>
      </div>
      <div className="space-y-1.5">
        {deductions.slice(0, 5).map((d: any) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-2 rounded bg-white/80 px-2 py-1.5 text-[11px] dark:bg-gray-900/40"
            data-testid={`row-open-deduction-${d.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900 dark:text-gray-100" data-testid={`text-deduction-number-${d.id}`}>
                  {d.deductionNumber || d.id.slice(0, 8)}
                </span>
                <span className="text-gray-500">·</span>
                <span className="truncate text-gray-700 dark:text-gray-300">{d.partnerName || "—"}</span>
                {d.reasonCode && (
                  <Badge variant="outline" className="h-4 border-gray-300 px-1 text-[9px] text-gray-600 dark:border-gray-700 dark:text-gray-400">
                    {d.reasonCode}
                  </Badge>
                )}
                <Badge variant="outline" className="h-4 border-orange-300 bg-orange-50 px-1 text-[9px] text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
                  {d.status}
                </Badge>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                {d.deductionDate ? new Date(d.deductionDate).toLocaleDateString() : "—"}
                {d.originalInvoiceRef ? ` · Inv ${d.originalInvoiceRef}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-red-600" data-testid={`text-deduction-amount-${d.id}`}>
                -${Math.abs(parseFloat(d.deductedAmount || "0")).toLocaleString()}
              </span>
              {settlementClaimId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 border-orange-300 px-2 text-[10px] text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300"
                  disabled={matchToClaimMut.isPending}
                  onClick={() => matchToClaimMut.mutate(d.id)}
                  data-testid={`button-match-deduction-${d.id}`}
                >
                  Match to claim
                </Button>
              )}
              <Link href={`/deductions-workspace?deductionId=${d.id}`}>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" data-testid={`button-open-deduction-${d.id}`}>
                  Open
                </Button>
              </Link>
            </div>
          </div>
        ))}
        {deductions.length > 5 && (
          <div className="text-[10px] text-orange-700 dark:text-orange-400" data-testid="text-open-deductions-more">
            +{deductions.length - 5} more — open the deductions workspace to see all.
          </div>
        )}
      </div>
    </div>
  );
}

function MatchBadge({ status, large }: { status: string; large?: boolean }) {
  const cfg = MATCH_STATUS_CONFIG[status] || MATCH_STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1 ${large ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"} rounded-full font-medium ${cfg.className}`} data-testid={`match-badge-${status}`}>
      {cfg.label}
    </span>
  );
}

function CompareCard({ label, amount, color, bgColor, sub }: { label: string; amount: number; color: string; bgColor: string; sub?: string }) {
  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${bgColor}`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>${Math.abs(amount).toLocaleString()}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
