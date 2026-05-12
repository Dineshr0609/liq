import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import { WorkspaceShell, FilterChip, QueueGroup } from "@/components/finance/workspace-shell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PartnerPicker } from "@/components/finance/partner-picker";
import { PeriodPicker, CurrencyPicker } from "@/components/finance/period-currency-pickers";
import { KpiStrip } from "@/components/finance/kpi-strip";
import { AgentActivityBar } from "@/components/finance/agent-activity-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Bot, FileText, Sparkles, ShieldAlert, Handshake, Clock, Plus, Trash2, ArrowRight, RotateCcw, Pencil } from "lucide-react";
import { Link } from "wouter";

interface UnifiedClaim {
  id: string; kind: "inbound_claim" | "outbound_obligation"; direction: "inbound" | "outbound";
  claimType: string; partnerName: string | null; contractName: string | null;
  contractId: string | null; period: string | null;
  claimedAmount: string | null; approvedAmount: string | null; currency: string | null;
  status: string; priority: string | null; agentHandled: boolean | null;
  disputeState: string | null; createdAt: string; sourceChannel: string | null;
  raw: any;
}

const SAMPLE_ENVELOPES: Record<string, any> = {
  happy: {
    source_event_id: `sim_${Date.now()}_happy`,
    event_type: "claim.received",
    legal_entity_id: null,
    payload: { claim_type: "rebate_settlement", partner_name: "Acme Distribution", period: "Apr 2026", amount: 12500, currency: "USD", lines: [{ description: "Q1 rebate", amount: 12500 }] },
  },
  ambiguous: {
    source_event_id: `sim_${Date.now()}_amb`,
    event_type: "claim.received",
    payload: { claim_type: "price_protection", partner_name: "Unknown Partner XYZ", amount: 4321 },
  },
  large: {
    source_event_id: `sim_${Date.now()}_big`,
    event_type: "claim.received",
    payload: { claim_type: "chargeback", partner_name: "BigBox Retail", amount: 245000 },
  },
};

export default function ClaimsWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState("queue");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [simOpen, setSimOpen] = useState(false);
  const [simKind, setSimKind] = useState<keyof typeof SAMPLE_ENVELOPES>("happy");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  // Edit / delete are only enabled for manually-created claims that haven't
  // been approved or settled yet — see ClaimDetail for the gate logic.
  const [editingClaim, setEditingClaim] = useState<UnifiedClaim | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<UnifiedClaim | null>(null);

  const claimsQ = useQuery<UnifiedClaim[]>({ queryKey: ["/api/finance/claims"], refetchInterval: 5000 });

  // Deep-link support: when this page is opened with `?claimId=…` in the URL
  // (e.g. from the Settlement Workspace's "Open Claims Workspace" banner),
  // jump straight to that claim's detail panel as soon as the claim list
  // is loaded. Wait for `claimsQ.data` so the row is selectable in the
  // queue list and the detail query can resolve it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    // Accept both `?claimId=` (legacy) and `?focus=` (period-close
    // Worksheet uses focus everywhere for consistency).
    const targetId = url.searchParams.get("focus") || url.searchParams.get("claimId");
    if (!targetId) return;
    if (!claimsQ.data || claimsQ.data.length === 0) return;
    const exists = claimsQ.data.some(c => c.id === targetId);
    if (!exists) return;
    if (selectedId !== targetId) setSelectedId(targetId);
    // Strip both params and scroll to row.
    if (url.searchParams.has("focus") || url.searchParams.has("claimId")) {
      url.searchParams.delete("focus");
      url.searchParams.delete("claimId");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="queue-item-${targetId}"]`);
      if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [claimsQ.data, selectedId]);
  const settlementsQ = useQuery<any[]>({ queryKey: ["/api/settlements"], staleTime: 30000 });
  const detailQ = useQuery<any>({
    queryKey: ["/api/finance/inbound-claims", selectedId],
    enabled: !!selectedId && claimsQ.data?.find(c => c.id === selectedId)?.kind === "inbound_claim",
  });
  const activityQ = useQuery<any[]>({ queryKey: ["/api/agent-activity"], refetchInterval: 4000 });

  const filteredClaims = useMemo(() => {
    const all = claimsQ.data || [];
    return all.filter(c => {
      if (search && !((c.partnerName || "") + (c.contractName || "")).toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.includes("urgent") && c.priority !== "urgent") return false;
      if (filters.includes("inbound") && c.direction !== "inbound") return false;
      if (filters.includes("outbound") && c.direction !== "outbound") return false;
      if (filters.includes("agent") && !c.agentHandled) return false;
      if (filters.includes("disputed") && c.disputeState !== "open" && c.disputeState !== "responded") return false;
      if (filters.includes("settled") && c.status !== "settled") return false;
      if (filters.includes("needs_finance") && !["needs_review", "received", "validating", "escalated"].includes(c.status)) return false;
      return true;
    });
  }, [claimsQ.data, search, filters]);

  const groups: QueueGroup<UnifiedClaim>[] = useMemo(() => {
    if (viewMode === "period") {
      // Bucket by reporting period; missing periods grouped under "No period".
      const byPeriod = new Map<string, UnifiedClaim[]>();
      for (const c of filteredClaims) {
        const k = c.period || "—";
        if (!byPeriod.has(k)) byPeriod.set(k, []);
        byPeriod.get(k)!.push(c);
      }
      const sortedKeys = Array.from(byPeriod.keys()).sort((a, b) => {
        if (a === "—") return 1; if (b === "—") return -1; return a < b ? 1 : -1;
      });
      return sortedKeys.map(k => ({
        key: `period:${k}`,
        label: k === "—" ? "No period" : k,
        tone: "standard" as const,
        items: byPeriod.get(k)!,
      }));
    }
    if (viewMode === "contract") {
      const byContract = new Map<string, UnifiedClaim[]>();
      for (const c of filteredClaims) {
        const k = c.contractName || c.contractId || "Unassigned";
        if (!byContract.has(k)) byContract.set(k, []);
        byContract.get(k)!.push(c);
      }
      const sortedKeys = Array.from(byContract.keys()).sort();
      return sortedKeys.map(k => ({
        key: `contract:${k}`,
        label: k,
        tone: "standard" as const,
        items: byContract.get(k)!,
      }));
    }
    // Default queue view — urgency / agent buckets.
    const urgent = filteredClaims.filter(c => c.priority === "urgent" && c.status !== "settled");
    const agent = filteredClaims.filter(c => c.priority !== "urgent" && c.agentHandled && c.status !== "settled");
    const standard = filteredClaims.filter(c => !urgent.includes(c) && !agent.includes(c));
    return [
      { key: "urgent", label: "Urgent", tone: "urgent", items: urgent },
      { key: "agent", label: "Agent Handling", tone: "agent", items: agent },
      { key: "standard", label: "Standard", tone: "standard", items: standard },
    ];
  }, [filteredClaims, viewMode]);

  const filterChips: FilterChip[] = [
    { key: "urgent", label: "Urgent" },
    { key: "needs_finance", label: "Needs Finance" },
    { key: "inbound", label: "Inbound" },
    { key: "outbound", label: "Outbound" },
    { key: "agent", label: "Agent Handling" },
    { key: "disputed", label: "Disputed" },
    { key: "settled", label: "Settled" },
  ];

  const decideMut = useMutation({
    mutationFn: async (vars: { id: string; kind: string; action: string; amount?: string; description?: string }) => {
      const url = vars.kind === "inbound_claim"
        ? `/api/finance/inbound-claims/${vars.id}/decide`
        : `/api/finance/outbound-claims/${vars.id}/decide`;
      const r = await apiRequest("POST", url, { action: vars.action, amount: vars.amount, description: vars.description });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      toast({ title: "Action recorded" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const generateDocMut = useMutation({
    mutationFn: async (vars: { id: string; direction: "inbound" | "outbound" }) => {
      const base = vars.direction === "outbound" ? "outbound-claims" : "inbound-claims";
      return (await apiRequest("POST", `/api/finance/${base}/${vars.id}/generate-document`, {})).json();
    },
    onSuccess: (doc: any) => {
      toast({ title: `Document ${doc.documentNumber} drafted` });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/documents"] });
    },
    onError: (e: any) => toast({ title: "Could not generate document", description: e.message, variant: "destructive" }),
  });

  const disputeMut = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => (await apiRequest("POST", `/api/finance/inbound-claims/${vars.id}/dispute`, { reason: vars.reason })).json(),
    onSuccess: () => {
      setDisputeOpen(false); setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      toast({ title: "Dispute opened" });
    },
  });

  // Delete a manual claim. The endpoint differs by direction (inbound claims
  // live in their own table, outbound claims are obligations) so route based
  // on `kind`. After delete, the unified list refetches and the detail panel
  // empties since the selected id no longer resolves.
  const deleteMut = useMutation({
    mutationFn: async (vars: { id: string; kind: "inbound_claim" | "outbound_obligation" }) => {
      const path = vars.kind === "inbound_claim"
        ? `/api/finance/inbound-claims/${vars.id}`
        : `/api/finance/outbound-claims/${vars.id}`;
      const r = await apiRequest("DELETE", path);
      // 204 has no body — guard against parsing.
      return r.status === 204 ? null : r.json();
    },
    onSuccess: (_data, vars) => {
      toast({ title: "Claim deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      setDeletingClaim(null);
      if (selectedId === vars.id) setSelectedId(null);
    },
    onError: (e: any) => toast({
      title: "Could not delete claim", description: e.message, variant: "destructive",
    }),
  });

  const simMut = useMutation({
    mutationFn: async (envelope: any) => (await apiRequest("POST", "/api/finance/simulate-inbound", envelope)).json(),
    onSuccess: (r: any) => {
      toast({ title: `Simulate: ${r.outcome}`, description: r.curl ? "cURL example logged to console" : undefined });
      if (r.curl) console.log("[Simulate Inbound] Equivalent cURL:\n" + r.curl);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      setSimOpen(false);
    },
    onError: (e: any) => toast({ title: "Simulate failed", description: e.message, variant: "destructive" }),
  });

  const isAdmin = user?.isSystemAdmin || user?.role === "admin" || user?.role === "owner";
  const selected = filteredClaims.find(c => c.id === selectedId) || null;

  // KPI roll-ups across the unfiltered claim set so the headline numbers
  // reflect the team's true workload, not whatever filter chips happen to be on.
  const kpis = useMemo(() => {
    const all = claimsQ.data || [];
    const open = all.filter(c => !["settled","approved","rejected","paid","expired"].includes(c.status));
    const urgent = open.filter(c => c.priority === "urgent").length;
    const agentHandling = open.filter(c => c.agentHandled).length;
    const inbound = open.filter(c => c.direction === "inbound").length;
    const outbound = open.filter(c => c.direction === "outbound").length;
    const exposure = open.reduce((s, c) => s + Number(c.claimedAmount || 0), 0);
    const liveAgent = (activityQ.data || []).find(a => a.status === "running" || a.status === "in_progress");
    return { urgent, agentHandling, inbound, outbound, exposure, liveAgent };
  }, [claimsQ.data, activityQ.data]);

  // In-flight settlements may eventually generate recovery claims (outbound)
  // when the variance exceeds tolerance. Surface them so users see the full
  // pipeline, not just claims already created.
  const pendingSettlements = useMemo(() => {
    const all = settlementsQ.data || [];
    return all.filter((s: any) =>
      s.settlementStatus !== "posted" &&
      s.settlementStatus !== "rejected" &&
      (s.matchStatus === "partial" || s.matchStatus === "disputed" || s.settlementStatus === "open"),
    );
  }, [settlementsQ.data]);
  const pendingSettlementVariance = useMemo(
    () => pendingSettlements.reduce((sum, s: any) => sum + Math.abs(parseFloat(s.variance || "0")), 0),
    [pendingSettlements],
  );

  return (
    <MainLayout title="Claims Workspace" description="Validate, approve, and document inbound and outbound contract claims.">
      <div
        className="mb-2 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900"
        data-testid="banner-claims-lifecycle"
      >
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
        <div className="flex flex-wrap items-center gap-1.5 leading-snug">
          <span className="font-semibold">How claims arrive here:</span>
          <span className="rounded bg-white px-1.5 py-0.5 font-medium border border-blue-200">↓ Inbound</span>
          <span className="text-blue-700">— partner submits claim (auto-listed)</span>
          <span className="text-blue-300">·</span>
          <span className="rounded bg-white px-1.5 py-0.5 font-medium border border-blue-200">↑ Outbound</span>
          <span className="text-blue-700">— opened from Settlement variance via "Open Recovery Claim"</span>
        </div>
        {pendingSettlements.length > 0 && (
          <Link
            href="/settlement-workspace"
            className="ml-auto flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-700 hover:bg-blue-100"
            data-testid="link-pending-settlements"
          >
            <Handshake className="h-3 w-3" />
            {pendingSettlements.length} settlement{pendingSettlements.length === 1 ? "" : "s"} in flight
            {pendingSettlementVariance > 0 && (
              <span className="text-blue-500">· ${Math.round(pendingSettlementVariance).toLocaleString()} variance</span>
            )}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <WorkspaceShell
        activityBar={<AgentActivityBar scope="claim" />}
        kpiStrip={
          <KpiStrip
            kpis={[
              { key: "urgent", label: "Urgent", value: kpis.urgent, tone: kpis.urgent > 0 ? "urgent" : "neutral", hint: "needs attention now" },
              { key: "agent", label: "Agent Handling", value: kpis.agentHandling, tone: "agent", icon: <Bot className="h-3 w-3 text-orange-600" />, hint: kpis.liveAgent ? `live: ${kpis.liveAgent.step}` : "idle" },
              { key: "exposure", label: "Open Exposure", value: `$${Math.round(kpis.exposure).toLocaleString()}`, hint: `${kpis.inbound + kpis.outbound} open claims` },
              { key: "direction", label: "Inbound · Outbound", value: <span><span className="text-orange-700">↓ {kpis.inbound}</span> <span className="text-neutral-400">·</span> <span className="text-neutral-700">↑ {kpis.outbound}</span></span>, hint: "↓ partner-initiated, ↑ we owe" },
            ]}
          />
        }
        queueTitle="Claims"
        viewModes={[{ key: "queue", label: "Queue" }, { key: "period", label: "Period" }, { key: "contract", label: "Contract" }]}
        activeViewMode={viewMode}
        onViewModeChange={setViewMode}
        filterChips={filterChips}
        activeFilters={filters}
        onToggleFilter={(k) => setFilters(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])}
        searchValue={search}
        onSearchChange={setSearch}
        loading={claimsQ.isLoading}
        groups={groups}
        renderQueueItem={(item) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-neutral-900">{item.partnerName || "Unknown partner"}</div>
              <span className="text-[10px] text-neutral-500">{item.direction === "inbound" ? "↓" : "↑"}</span>
            </div>
            <div className="text-[11px] text-neutral-600">{item.claimType.replace(/_/g, " ")} · {item.period || "—"}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="font-mono text-neutral-900">${Number(item.claimedAmount || 0).toLocaleString()}</span>
              <Badge variant="outline" className="text-[10px]">{item.status.replace(/_/g, " ")}</Badge>
            </div>
            {item.disputeState && item.disputeState !== "none" && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-700"><ShieldAlert className="h-3 w-3" /> Dispute {item.disputeState}</div>
            )}
          </div>
        )}
        selectedId={selectedId}
        onSelectItem={(item) => setSelectedId(item.id)}
        toolbar={
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 bg-orange-600 text-[11px] text-white hover:bg-orange-700" onClick={() => setNewOpen(true)} data-testid="button-new-claim">
              <Plus className="mr-1 h-3 w-3" /> New Claim
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSimOpen(true)} data-testid="button-simulate-inbound">
                <Sparkles className="mr-1 h-3 w-3" /> Simulate
              </Button>
            )}
          </div>
        }
        detail={selected ? (
          <ClaimDetail
            claim={selected}
            inboundDetail={detailQ.data}
            onAction={(action, opts) => decideMut.mutate({ id: selected.id, kind: selected.kind, action, ...(opts || {}) })}
            onGenerateDocument={() => generateDocMut.mutate({ id: selected.id, direction: selected.direction === "outbound" ? "outbound" : "inbound" })}
            onOpenDispute={() => setDisputeOpen(true)}
            onEdit={() => setEditingClaim(selected)}
            onDelete={() => setDeletingClaim(selected)}
            isPending={decideMut.isPending}
          />
        ) : undefined}
        agentPanel={
          <AgentPanel
            activity={(activityQ.data || []).filter(a => !selected || a.scopeId === selected.id || a.scope === "event").slice(0, 30)}
          />
        }
      />

      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-simulate">
          <DialogHeader><DialogTitle>Simulate Inbound Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Sample envelope</label>
              <Select value={simKind} onValueChange={(v) => setSimKind(v as any)}>
                <SelectTrigger data-testid="select-sim-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">Happy path · rebate settlement</SelectItem>
                  <SelectItem value="ambiguous">Ambiguous partner (escalates)</SelectItem>
                  <SelectItem value="large">Large amount (urgent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-2 text-[10px]">{JSON.stringify(SAMPLE_ENVELOPES[simKind], null, 2)}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimOpen(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => simMut.mutate({ ...SAMPLE_ENVELOPES[simKind], source_event_id: `sim_${Date.now()}_${simKind}` })} data-testid="button-confirm-simulate">Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single dialog instance handles both create and edit. We pass
          `editing` when set; the dialog re-seeds its form whenever `open`
          flips, so toggling editingClaim is enough to switch modes. */}
      <NewClaimDialog
        open={newOpen || !!editingClaim}
        onOpenChange={(v) => {
          if (!v) { setNewOpen(false); setEditingClaim(null); }
          else setNewOpen(true);
        }}
        editing={editingClaim}
      />

      {/* Delete confirmation. Kept lightweight (no AlertDialog import) since
          the underlying Dialog primitive is already in use here. */}
      <Dialog open={!!deletingClaim} onOpenChange={(v) => { if (!v) setDeletingClaim(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-delete-claim">
          <DialogHeader><DialogTitle>Delete this claim?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-xs text-neutral-700">
            <p>
              This permanently removes the claim
              {deletingClaim?.partnerName ? <> from <span className="font-medium">{deletingClaim.partnerName}</span></> : null}
              {deletingClaim?.claimedAmount ? <> for <span className="font-medium">{`${deletingClaim.currency || "USD"} ${Number(deletingClaim.claimedAmount).toLocaleString()}`}</span></> : null}
              {", along with its line items, events, and any pending approval requests."}
            </p>
            <p className="text-amber-700">This cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingClaim(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deletingClaim || deleteMut.isPending}
              onClick={() => deletingClaim && deleteMut.mutate({ id: deletingClaim.id, kind: deletingClaim.kind })}
              data-testid="button-confirm-delete"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent data-testid="dialog-dispute">
          <DialogHeader><DialogTitle>Open Dispute</DialogTitle></DialogHeader>
          <Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Reason…" data-testid="input-dispute-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={!disputeReason.trim() || !selected} onClick={() => selected && disputeMut.mutate({ id: selected.id, reason: disputeReason })} data-testid="button-confirm-dispute">Open Dispute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function ClaimDetail({ claim, inboundDetail, onAction, onGenerateDocument, onOpenDispute, onEdit, onDelete, isPending }: {
  claim: UnifiedClaim; inboundDetail: any;
  onAction: (action: string, opts?: { amount?: string; description?: string }) => void;
  onGenerateDocument: () => void; onOpenDispute: () => void;
  onEdit: () => void; onDelete: () => void;
  isPending: boolean;
}) {
  const isInbound = claim.kind === "inbound_claim";
  const isTerminal = ["approved", "rejected", "settled", "expired", "paid"].includes(claim.status);

  // Edit / delete are only offered for *manually-entered* claims — anything
  // ingested from a vendor portal, EDI feed, accrual promotion, etc. is
  // immutable through this surface (the audit trail of the original event
  // would otherwise drift). Inbound manual rows use sourceChannel="manual";
  // outbound use "manual_entry" (set by /api/finance/claims/manual). The
  // status gates mirror the server: inbound locks once a decision is taken
  // (approved / partial_approved / settled / paid); outbound is only mutable
  // while still in "claim_submitted".
  const isManualSource = isInbound
    ? claim.sourceChannel === "manual"
    : claim.sourceChannel === "manual_entry";
  const inboundLockedStatuses = ["approved", "partial_approved", "settled", "paid"];
  const canManage = isManualSource && (
    isInbound
      ? !inboundLockedStatuses.includes(claim.status)
      : claim.status === "claim_submitted"
  );
  const lockReason = !isManualSource
    ? "Only manually-created claims can be edited or deleted."
    : isInbound
      ? "Edit/delete is locked once the claim is approved or settled."
      : "Outbound claims can only be edited before they're sent for approval.";
  // A disputed claim can't be approved or rejected directly — the state
  // machine requires `resolve_dispute` first, which moves the claim back
  // to `needs_review`. Showing approve/reject here would silently no-op
  // server-side, so we swap them for an explicit "Resolve Dispute" action.
  const isDisputed = claim.status === "disputed";
  // Status colour cue — amber for disputed (action required), orange for
  // in-progress, green for approved/settled, slate for rejected/expired.
  const statusBadgeClass = isDisputed
    ? "bg-amber-500 text-white"
    : ["approved", "partial_approved", "settled", "paid"].includes(claim.status)
      ? "bg-emerald-600 text-white"
      : ["rejected", "expired"].includes(claim.status)
        ? "bg-slate-500 text-white"
        : "bg-orange-600 text-white";
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">{claim.direction.toUpperCase()} · {claim.claimType.replace(/_/g, " ")}</div>
          <h3 className="text-2xl font-semibold text-neutral-900" data-testid="text-claim-partner">{claim.partnerName || "Unknown"}</h3>
          <div className="text-sm text-neutral-600">{claim.contractName || "(no contract)"} · {claim.period || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-neutral-900" data-testid="text-claim-amount">${Number(claim.claimedAmount || 0).toLocaleString()}</div>
          <Badge className={`mt-1 ${statusBadgeClass}`} data-testid="badge-claim-status">{claim.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {isDisputed && (
        <div
          className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
          data-testid="banner-resolve-dispute-first"
        >
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">This claim is in dispute</div>
            <div>
              Approve, partial-approve, and reject are blocked until the dispute is resolved.
              Click <span className="font-medium">Resolve Dispute</span> to send it back for review,
              then take a decision.
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {!isTerminal && !isDisputed && (
          <>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700" disabled={isPending} onClick={() => onAction("approve")} data-testid="button-approve">Approve</Button>
            {/* Partial-approve is only supported on the inbound state machine; the
                 outbound obligation lifecycle has no partial_approve action. */}
            {isInbound && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => {
                const v = prompt("Approved amount?", String(claim.claimedAmount || ""));
                if (v) onAction("partial_approve", { amount: v });
              }} data-testid="button-partial-approve">Partial Approve</Button>
            )}
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => onAction("reject")} data-testid="button-reject">Reject</Button>
            {isInbound && <Button size="sm" variant="outline" onClick={onOpenDispute} data-testid="button-open-dispute">Open Dispute</Button>}
          </>
        )}
        {isDisputed && isInbound && (
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={isPending}
            onClick={() => onAction("resolve_dispute", { description: "Dispute resolved — returning claim for review." })}
            data-testid="button-resolve-dispute"
          >
            <ShieldAlert className="mr-1 h-3 w-3" /> Resolve Dispute
          </Button>
        )}
        {/* Reopen / Correct — escape valve for a wrong approve / partial /
             reject decision. Only inbound claims (the outbound obligation
             state machine doesn't model a reversible decision yet), and
             only while the linked credit memo (if any) is still draft. The
             server enforces both, but we hide the button when it'd no-op
             so the action surface stays honest. */}
        {isInbound && ["approved", "partial_approved", "rejected"].includes(claim.status) && (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-50"
            disabled={isPending}
            onClick={() => {
              const reason = prompt(
                `Reopen this claim and send it back for review?\n\nThe current decision (${claim.status.replace(/_/g, " ")}) will be cleared. Any draft credit memo will need to be regenerated after you re-decide.\n\nEnter a short reason for the audit trail:`,
              );
              if (reason && reason.trim()) {
                onAction("reopen", { description: reason.trim() });
              }
            }}
            data-testid="button-reopen-claim"
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Reopen / Correct
          </Button>
        )}
        {((isInbound && (claim.status === "approved" || claim.status === "partial_approved" || claim.status === "settled"))
          || (!isInbound && (claim.status === "approved" || claim.status === "settled"))) && (
          <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-800" onClick={onGenerateDocument} data-testid="button-generate-document">
            <FileText className="mr-1 h-3 w-3" /> Generate Document
          </Button>
        )}

        {/* Manual claim management — Edit / Delete. Only rendered for
             manually-entered claims that haven't reached an irreversible
             state. We push them to the right with `ml-auto` so they don't
             crowd the primary workflow actions. */}
        {isManualSource && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={!canManage || isPending}
              title={canManage ? "Edit this manual claim" : lockReason}
              data-testid="button-edit-claim"
            >
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={onDelete}
              disabled={!canManage || isPending}
              title={canManage ? "Delete this manual claim" : lockReason}
              data-testid="button-delete-claim"
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calculation">Calculation</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="dispute">Dispute</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3 space-y-3">
          <DetailGrid items={[
            ["Direction", claim.direction], ["Status", claim.status],
            ["Priority", claim.priority || "standard"],
            ["Source", claim.sourceChannel || "manual"],
            ["Currency", claim.currency || "USD"],
            ["Approved Amount", `$${Number(claim.approvedAmount || 0).toLocaleString()}`],
            ["Created", new Date(claim.createdAt).toLocaleString()],
            // Task 68 — when this claim was promoted from a posted accrual
            // (sourceChannel === "accrual_promotion"), the raw obligation
            // carries the accrual_id. Surface it here so finance can pivot
            // back to the accrual that produced this claim.
            ...(claim.raw?.sourceAccrualId
              ? [["Source Accrual",
                  <a
                    key="src-accrual"
                    href={`/accrual-management?focus=${claim.raw.sourceAccrualId}`}
                    className="text-orange-700 hover:underline"
                    data-testid={`link-source-accrual-${claim.id}`}
                  >{claim.raw.sourceAccrualId}</a>] as [string, any]]
              : []),
          ]} />
          {inboundDetail?.lines?.length > 0 && <LineItemsTable lines={inboundDetail.lines} />}
        </TabsContent>
        <TabsContent value="calculation" className="mt-3">
          <CalculationView claim={claim} inboundDetail={inboundDetail} />
        </TabsContent>
        <TabsContent value="evidence" className="mt-3">
          <EvidenceView inboundDetail={inboundDetail} claim={claim} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-3">
          <Timeline events={inboundDetail?.events || []} />
        </TabsContent>
        <TabsContent value="dispute" className="mt-3">
          {claim.disputeState && claim.disputeState !== "none" ? (
            <div className="rounded border border-orange-200 bg-orange-50 p-3 text-sm">
              <div className="font-medium text-orange-900">Dispute · {claim.disputeState}</div>
              <p className="mt-1 text-neutral-700">{inboundDetail?.disputeReason || "No reason recorded."}</p>
            </div>
          ) : <div className="text-sm text-neutral-500">No active dispute.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailGrid({ items }: { items: [string, any][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-neutral-100 py-1">
          <span className="text-neutral-500">{k}</span>
          <span className="font-medium text-neutral-900">{v}</span>
        </div>
      ))}
    </div>
  );
}

function LineItemsTable({ lines }: { lines: any[] }) {
  return (
    <div className="rounded border border-neutral-200">
      <table className="w-full text-xs">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr><th className="px-2 py-1">Description</th><th className="px-2 py-1">SKU</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-right">Unit</th><th className="px-2 py-1 text-right">Amount</th></tr>
        </thead>
        <tbody>{lines.map(l => (
          <tr key={l.id} className="border-t border-neutral-100">
            <td className="px-2 py-1">{l.description || "—"}</td>
            <td className="px-2 py-1 font-mono">{l.sku || "—"}</td>
            <td className="px-2 py-1 text-right">{l.quantity}</td>
            <td className="px-2 py-1 text-right">${Number(l.unitAmount || 0).toFixed(2)}</td>
            <td className="px-2 py-1 text-right font-medium">${Number(l.amount || 0).toLocaleString()}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Timeline({ events }: { events: any[] }) {
  if (!events.length) return <div className="text-sm text-neutral-500">No events recorded.</div>;
  return (
    <ol className="space-y-2 border-l-2 border-neutral-200 pl-3">
      {events.map(e => (
        <li key={e.id} className="text-xs">
          <div className="font-medium text-neutral-900">{e.eventType}</div>
          <div className="text-neutral-500">{new Date(e.createdAt).toLocaleString()} · {e.userName || "system"}</div>
          {e.description && <div className="mt-0.5 text-neutral-700">{e.description}</div>}
        </li>
      ))}
    </ol>
  );
}

// Render the claim's quantitative details (claimed vs approved, lines,
// computed variance) as a structured presentation rather than a raw JSON
// dump. The full claim record is still available behind a "View raw"
// disclosure for power users.
function CalculationView({ claim, inboundDetail }: { claim: UnifiedClaim; inboundDetail: any }) {
  const claimed = Number(claim.claimedAmount || 0);
  const approved = Number(claim.approvedAmount || 0);
  const variance = approved - claimed;
  const variancePct = claimed > 0 ? (Math.abs(variance) / claimed) * 100 : 0;
  const currency = claim.currency || "USD";
  const fmt = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines: any[] = inboundDetail?.lines || [];
  const linesTotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0);

  return (
    <div className="space-y-3" data-testid="view-calculation">
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="Claimed Amount" value={fmt(claimed)} sub={`${currency} · ${claim.period || "—"}`} />
        <SummaryStat
          label="Approved Amount"
          value={fmt(approved)}
          sub={approved > 0 ? `Status: ${claim.status}` : "Pending review"}
          tone={approved > 0 ? "positive" : "neutral"}
        />
        <SummaryStat
          label="Variance"
          value={`${variance >= 0 ? "+" : "−"}${fmt(Math.abs(variance))}`}
          sub={claimed > 0 ? `${variancePct.toFixed(2)}% of claimed` : "—"}
          tone={Math.abs(variance) < 0.01 ? "positive" : variance < 0 ? "warning" : "neutral"}
        />
      </div>

      {lines.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Line-Item Breakdown</div>
          <LineItemsTable lines={lines} />
          <div className="flex justify-end pt-1 text-xs">
            <span className="text-neutral-500">Lines total:&nbsp;</span>
            <span className="font-mono font-semibold text-neutral-900">{fmt(linesTotal)}</span>
            {Math.abs(linesTotal - claimed) > 0.01 && claimed > 0 && (
              <span className="ml-2 text-amber-700">(differs from header by {fmt(linesTotal - claimed)})</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Claim Identifiers</div>
        <DetailGrid items={[
          ["Claim Number", claim.raw?.claimNumber || claim.id],
          ["Internal ID", <span key="id" className="font-mono text-xs">{claim.id}</span>],
          ["External Ref", claim.raw?.externalClaimId || "—"],
          ["Source Channel", claim.sourceChannel || "manual"],
          ["Partner", claim.partnerName || "—"],
          ["Contract", claim.contractName || claim.contractId || "—"],
        ]} />
      </div>

      {(claim.raw?.approvedBy || claim.raw?.approvedAt || claim.raw?.dueAt) && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Approval &amp; SLA</div>
          <DetailGrid items={[
            ["Approved By", claim.raw?.approvedBy || "—"],
            ["Approved At", claim.raw?.approvedAt ? new Date(claim.raw.approvedAt).toLocaleString() : "—"],
            ["Due At", claim.raw?.dueAt ? new Date(claim.raw.dueAt).toLocaleString() : "—"],
            ["Agent Handled", claim.agentHandled ? "Yes" : "No"],
          ]} />
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-700">View raw record</summary>
        <pre className="mt-1 max-h-72 overflow-auto rounded bg-neutral-50 p-2 text-[10px] font-mono text-neutral-700">{JSON.stringify(claim.raw, null, 2)}</pre>
      </details>
    </div>
  );
}

// Show the inbound payload (and any other supporting evidence) in a
// readable layout: a header summarizing the source, a key-value table of
// the payload, line items if present, and a collapsible raw view.
function EvidenceView({ inboundDetail, claim }: { inboundDetail: any; claim: UnifiedClaim }) {
  const envelope: any = inboundDetail?.rawPayload;
  if (!envelope) {
    return <div className="text-sm text-neutral-500">No evidence attached.</div>;
  }
  const payload: any = envelope.payload || envelope;
  // Pull a stable list of "headline" fields out of the payload so we can
  // show them as a friendly grid; everything else falls into "Other
  // payload fields".
  const HEADLINE_KEYS = ["claim_type", "partner_name", "period", "amount", "currency", "contract_id", "contract_name"];
  const headline: [string, any][] = [];
  const other: [string, any][] = [];
  for (const [k, v] of Object.entries(payload || {})) {
    if (k === "lines") continue;
    const val = v == null
      ? "—"
      : typeof v === "object"
        ? JSON.stringify(v)
        : k === "amount" && typeof v === "number"
          ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(v);
    const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    (HEADLINE_KEYS.includes(k) ? headline : other).push([label, val]);
  }
  const lines: any[] = Array.isArray(payload?.lines) ? payload.lines : [];

  return (
    <div className="space-y-3" data-testid="view-evidence">
      <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Source</div>
            <div className="mt-0.5 text-sm font-medium text-neutral-900">
              {claim.sourceChannel || "manual"}
              {envelope.event_type ? <span className="text-neutral-500"> · {envelope.event_type}</span> : null}
            </div>
          </div>
          <div className="text-right text-[11px] text-neutral-500">
            {envelope.source_event_id && (<div>Event: <span className="font-mono text-neutral-700">{envelope.source_event_id}</span></div>)}
            {envelope.legal_entity_id && (<div>Legal entity: <span className="font-mono text-neutral-700">{envelope.legal_entity_id}</span></div>)}
          </div>
        </div>
      </div>

      {headline.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reported Payload</div>
          <DetailGrid items={headline} />
        </div>
      )}

      {lines.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reported Lines</div>
          <div className="rounded border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr><th className="px-2 py-1">Description</th><th className="px-2 py-1 text-right">Amount</th></tr>
              </thead>
              <tbody>{lines.map((l, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-2 py-1">{l.description || l.sku || `Line ${i + 1}`}</td>
                  <td className="px-2 py-1 text-right font-medium">${Number(l.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Other Payload Fields</div>
          <DetailGrid items={other} />
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-700">View raw envelope</summary>
        <pre className="mt-1 max-h-72 overflow-auto rounded bg-neutral-50 p-2 text-[10px] font-mono text-neutral-700">{JSON.stringify(envelope, null, 2)}</pre>
      </details>
    </div>
  );
}

function SummaryStat({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "warning" }) {
  const toneCls = tone === "positive"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-neutral-200 bg-white";
  const valueCls = tone === "positive"
    ? "text-emerald-800"
    : tone === "warning"
      ? "text-amber-800"
      : "text-neutral-900";
  return (
    <div className={`rounded border p-3 ${toneCls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${valueCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function AgentPanel({ activity }: { activity: any[] }) {
  if (!activity.length) return (
    <div className="text-center text-xs text-neutral-500">
      <Bot className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
      <p>The agent will narrate decisions here.</p>
    </div>
  );
  return (
    <ol className="space-y-3">
      {activity.map(a => (
        <li key={a.id} className="rounded border border-neutral-200 bg-white p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-900">{a.step}</span>
            <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
          </div>
          <p className="mt-1 text-neutral-700">{a.summary}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-500">
            <Clock className="h-2.5 w-2.5" />{new Date(a.createdAt).toLocaleTimeString()}
          </div>
        </li>
      ))}
    </ol>
  );
}

function NewClaimDialog({
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // When `editing` is set, the dialog flips into edit mode: direction is
  // locked (you can't move a claim across tables), the form pre-fills from
  // the existing row, and submit hits PATCH instead of POST. Line items
  // aren't editable here — the manual-create line schema can't safely diff
  // against the persisted lines. Users wanting to change lines should
  // delete and recreate.
  editing?: UnifiedClaim | null;
}) {
  const { toast } = useToast();
  const isEdit = !!editing;
  const optsQ = useQuery<{ claimTypes: { claimType: string; direction: string }[]; contracts: { id: string; displayName: string | null; contractNumber: string | null; counterpartyName: string | null }[]; partners: string[] }>({
    queryKey: ["/api/finance/claims/manual-options"], enabled: open,
  });
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [claimType, setClaimType] = useState<string>("rebate_settlement");
  const [partnerName, setPartnerName] = useState("");
  const [contractId, setContractId] = useState<string>("");
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([]);

  // (Re)seed form whenever the dialog re-opens. In edit mode we hydrate
  // from the existing claim; in create mode we reset to defaults.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDirection(editing.direction);
      setClaimType(editing.claimType);
      setPartnerName(editing.partnerName || "");
      setContractId(editing.contractId || "");
      setPeriod(editing.period || "");
      setAmount(editing.claimedAmount ? String(Number(editing.claimedAmount)) : "");
      setCurrency(editing.currency || "USD");
      // Notes for inbound live in metadata.notes (set by our PATCH endpoint);
      // for outbound they're a real column on the obligation row. Both surface
      // under `editing.raw` from the unified list endpoint.
      const rawNotes = editing.raw?.notes
        || editing.raw?.metadata?.notes
        || "";
      setNotes(typeof rawNotes === "string" ? rawNotes : "");
      setLines([]);
    } else {
      setDirection("inbound"); setClaimType("rebate_settlement");
      setPartnerName(""); setContractId(""); setPeriod("");
      setAmount(""); setCurrency("USD"); setNotes(""); setLines([]);
    }
  }, [open, editing]);

  const availableTypes = useMemo(() => {
    const all = optsQ.data?.claimTypes || [];
    return all.filter(t => t.direction === direction).map(t => t.claimType);
  }, [optsQ.data, direction]);

  // Snap claimType to a value valid for the chosen direction (create-only —
  // edit mode keeps the original direction so the existing type stays valid).
  useEffect(() => {
    if (isEdit) return;
    if (availableTypes.length && !availableTypes.includes(claimType)) {
      setClaimType(availableTypes[0]);
    }
  }, [availableTypes, claimType, isEdit]);

  const submitMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        claim_type: claimType,
        partner_name: partnerName.trim() || null,
        contract_id: contractId || null,
        period: period.trim() || null,
        amount: Number(amount),
        currency,
        notes: notes.trim() || null,
      };
      if (isEdit && editing) {
        const path = editing.kind === "inbound_claim"
          ? `/api/finance/inbound-claims/${editing.id}`
          : `/api/finance/outbound-claims/${editing.id}`;
        const r = await apiRequest("PATCH", path, body);
        return r.json();
      }
      // Create — include direction (drives outcome routing) and lines.
      body.direction = direction;
      body.lines = lines.filter(l => l.description.trim() || l.amount).map(l => ({
        description: l.description, amount: Number(l.amount || 0),
      }));
      const r = await apiRequest("POST", "/api/finance/claims/manual", body);
      return r.json();
    },
    onSuccess: (r: any) => {
      toast({
        title: isEdit ? "Claim updated" : "Claim created",
        description: !isEdit && r.outcome ? `Outcome: ${r.outcome}` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({
      title: isEdit ? "Could not update claim" : "Could not create claim",
      description: e.message, variant: "destructive",
    }),
  });

  const amountValid = amount !== "" && Number.isFinite(Number(amount)) && Number(amount) >= 0;
  const canSubmit = amountValid && claimType && (direction === "inbound" ? !!partnerName.trim() : !!contractId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid={isEdit ? "dialog-edit-claim" : "dialog-new-claim"}>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Claim" : "New Claim"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="mb-1 block font-medium">Direction</label>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)} disabled={isEdit}>
              <SelectTrigger data-testid="select-direction"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound — partner is claiming from us</SelectItem>
                <SelectItem value="outbound">Outbound — we are claiming from partner</SelectItem>
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="mt-1 text-[10px] text-neutral-500">Direction is locked when editing.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block font-medium">Claim type</label>
            <Select value={claimType} onValueChange={setClaimType}>
              <SelectTrigger data-testid="select-claim-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableTypes.map(t => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block font-medium">Partner {direction === "inbound" ? <span className="text-red-600">*</span> : null}</label>
            <PartnerPicker value={partnerName} onChange={setPartnerName} partners={optsQ.data?.partners || []} testId="input-partner-name" />
          </div>
          <div>
            <label className="mb-1 block font-medium">Contract {direction === "outbound" ? <span className="text-red-600">*</span> : null}</label>
            <Select value={contractId || "__none"} onValueChange={(v) => setContractId(v === "__none" ? "" : v)}>
              <SelectTrigger data-testid="select-contract"><SelectValue placeholder="None / unknown" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__none">None / unknown</SelectItem>
                {(optsQ.data?.contracts || []).map(c => {
                  const label = c.displayName || c.contractNumber || c.id.slice(0, 8);
                  const sub = c.counterpartyName ? ` · ${c.counterpartyName}` : "";
                  return <SelectItem key={c.id} value={c.id}>{label}{sub}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block font-medium">Period</label>
            <PeriodPicker value={period} onChange={setPeriod} testId="input-period" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-medium">Amount <span className="text-red-600">*</span></label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="input-amount" />
            </div>
            <div>
              <label className="mb-1 block font-medium">Currency</label>
              <CurrencyPicker value={currency} onChange={setCurrency} testId="input-currency" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block font-medium">Notes</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reference number, source channel, anything finance should see…" data-testid="input-notes" />
          </div>
          {/* Line items live on the create form only — the PATCH endpoint
              doesn't accept lines so we hide the section in edit mode rather
              than show a deceptively-editable list. To change lines, delete
              the claim and recreate. */}
          {!isEdit && (
            <div className="col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="font-medium">Line items (optional)</label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setLines(l => [...l, { description: "", amount: "" }])} data-testid="button-add-line">
                  <Plus className="mr-1 h-3 w-3" /> Add line
                </Button>
              </div>
              {lines.length === 0 ? (
                <p className="rounded border border-dashed border-neutral-200 p-2 text-[11px] text-neutral-500">No lines. The total above will be used.</p>
              ) : (
                <div className="space-y-1.5">
                  {lines.map((ln, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="flex-1" placeholder="Description" value={ln.description} onChange={(e) => setLines(arr => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} data-testid={`input-line-desc-${i}`} />
                      <Input className="w-32" type="number" step="0.01" placeholder="Amount" value={ln.amount} onChange={(e) => setLines(arr => arr.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} data-testid={`input-line-amount-${i}`} />
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLines(arr => arr.filter((_, idx) => idx !== i))} data-testid={`button-remove-line-${i}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!canSubmit || submitMut.isPending}
            onClick={() => submitMut.mutate()}
            data-testid="button-submit-claim"
          >
            {submitMut.isPending
              ? (isEdit ? "Saving…" : "Creating…")
              : (isEdit ? "Save changes" : "Create claim")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
