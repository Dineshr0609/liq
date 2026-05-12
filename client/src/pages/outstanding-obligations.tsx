import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, DollarSign, FileText, XCircle, AlertTriangle } from "lucide-react";

type ObligationOriginRule = {
  tier?: string | null;
  rate?: string | null;
  flowLabel?: string | null;
};

type ObligationMetadata = {
  originCalculationId?: string | null;
  originRule?: ObligationOriginRule | null;
  promotedFromAccrualId?: string | null;
  accrualBasis?: string | null;
  flowTypeCode?: string | null;
  [k: string]: unknown;
};

type Obligation = {
  id: string;
  contractId: string;
  partnerName: string | null;
  kind: string;
  amount: string;
  outstandingAmount: string;
  currency: string | null;
  fundingPeriod: string | null;
  accrualDate: string | null;
  plannedReleaseDate: string | null;
  expiryDate: string | null;
  status: string;
  claimedAmount: string | null;
  claimReference: string | null;
  rolloverPolicy: string | null;
  // Task 68 — promotion bridge fields. Present only on rows promoted
  // from a posted accrual; legacy hand-entered obligations leave these
  // null and the Origin section short-circuits.
  sourceAccrualId?: string | null;
  sourceChannel?: string | null;
  // 'inbound' (vendor rebate / vendor royalty receivable) or 'outbound'
  // (customer rebate / royalty payable). Set by the promotion service
  // from flow_types.cash_direction; legacy rows without it leave it null.
  direction?: string | null;
  metadata?: ObligationMetadata | null;
};

type ObligationEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  amount: string | null;
  description: string | null;
  userName: string | null;
  phase: string | null;
  createdAt: string;
};

type ObligationJournalEntry = {
  id: string;
  jeId: string;
  jeStage: string;
  flowType: string;
  period: string;
  totalAmount: string;
};

type TransitionPayload = {
  amount?: number;
  claimReference?: string;
  proofUrl?: string;
  trueUpAmount?: number;
};

type AgingSummary = {
  totals: Record<string, number>;
  countsByStatus: Record<string, number>;
  totalsByKind: Record<string, number>;
  totalsByPartner: Array<{ partnerName: string; total: number; count: number }>;
  totalOutstanding: number;
};

const KIND_LABELS: Record<string, string> = {
  mdf: "MDF",
  recoupable_advance: "Recoupable Advance",
  returns_reserve: "Returns Reserve",
  performance_bonus: "Performance Bonus",
  signing_bonus: "Signing Bonus",
  milestone_payment: "Milestone Payment",
  minimum_trueup: "Minimum True-up",
};

const STATUS_VARIANTS: Record<string, string> = {
  accrued: "bg-gray-100 text-gray-700",
  claimable: "bg-blue-100 text-blue-700",
  claimed: "bg-amber-100 text-amber-700",
  approved: "bg-violet-100 text-violet-700",
  paid: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  reversed: "bg-zinc-200 text-zinc-700",
};

const BUCKET_LABELS: Record<string, string> = {
  current: "Current",
  "0_30": "0-30 days",
  "31_60": "31-60 days",
  "61_90": "61-90 days",
  "90_plus": "90+ days",
};

function fmt(amount: number | string | null | undefined): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OutstandingObligationsPage() {
  const { toast } = useToast();
  const [filterKind, setFilterKind] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("accrued,claimable,claimed,approved");
  const [filterContractId, setFilterContractId] = useState<string>("");
  const [filterPartnerId, setFilterPartnerId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [location] = useLocation();
  // Task 68 — deep-link support. The Origin link from an obligation
  // (and the inverse Promoted-Obligation link from the accrual page)
  // navigates with ?focus=<id>. Pre-open the detail dialog for that
  // row on mount and strip the param so a back-nav doesn't re-open
  // the dialog after the user closes it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (focus) {
      setSelectedId(focus);
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [location]);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; obligationId: string | null }>({ open: false, action: "", obligationId: null });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [claimAmount, setClaimAmount] = useState<string>("");
  const [claimReference, setClaimReference] = useState<string>("");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [trueUpAmount, setTrueUpAmount] = useState<string>("");

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filterKind) p.set("kind", filterKind);
    if (filterStatus) p.set("status", filterStatus);
    if (filterContractId) p.set("contractId", filterContractId);
    if (filterPartnerId) p.set("partnerId", filterPartnerId);
    return p.toString();
  }, [filterKind, filterStatus, filterContractId, filterPartnerId]);

  // /api/contracts returns { contracts: [...] }, not a bare array. The
  // earlier typing assumed the bare-array shape, so the for-of below
  // crashed with "object is not iterable" once the page mounted. Type
  // the response as the wrapped object and unwrap before iterating.
  const contractsQuery = useQuery<{ contracts: Array<{ id: string; contractName: string | null; counterpartyName: string | null; counterpartyPartnerId: string | null }> }>({
    queryKey: ["/api/contracts"],
  });
  const partnerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of (contractsQuery.data?.contracts || [])) {
      if (c.counterpartyPartnerId && c.counterpartyName && !map.has(c.counterpartyPartnerId)) {
        map.set(c.counterpartyPartnerId, c.counterpartyName);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [contractsQuery.data]);

  const obligationsQuery = useQuery<{ obligations: Obligation[]; total: number }>({
    queryKey: ["/api/obligations", queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/obligations?${queryParams}` : "/api/obligations";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const agingQuery = useQuery<AgingSummary>({ queryKey: ["/api/obligations/aging"] });
  const detailQuery = useQuery<{ obligation: Obligation; events: ObligationEvent[]; journalEntries: ObligationJournalEntry[] }>({
    queryKey: ["/api/obligations/detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const r = await fetch(`/api/obligations/${selectedId}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: string; payload: TransitionPayload }) => {
      const r = await apiRequest("POST", `/api/obligations/${id}/transition`, { action, ...payload });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Transition applied", description: "Obligation updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obligations/aging"] });
      setActionDialog({ open: false, action: "", obligationId: null });
      setClaimAmount(""); setClaimReference(""); setProofUrl(""); setTrueUpAmount("");
    },
    onError: (e: unknown) => toast({ title: "Transition failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: string }) => {
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of ids) {
        try {
          const r = await apiRequest("POST", `/api/obligations/${id}/transition`, { action });
          await r.json();
          results.push({ id, ok: true });
        } catch (e: unknown) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter(r => r.ok).length;
      const fail = results.length - ok;
      toast({
        title: "Bulk action complete",
        description: `${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}.`,
        variant: fail > 0 ? "destructive" : "default",
      });
      setSelectedIds(new Set());
      setBulkAction("");
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obligations/aging"] });
    },
  });

  const expirySweepMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/obligations/expiry-sweep", {});
      return r.json();
    },
    onSuccess: (data: { expiredCount: number; expiredAmount: number }) => {
      toast({ title: "Expiry sweep complete", description: `Expired ${data.expiredCount} obligation(s) totaling ${fmt(data.expiredAmount)}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obligations/aging"] });
    },
  });

  const obligations = obligationsQuery.data?.obligations || [];
  const aging = agingQuery.data;

  const groupedByPartner = useMemo(() => {
    const map = new Map<string, Obligation[]>();
    for (const o of obligations) {
      const key = o.partnerName || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [obligations]);

  const submitTransition = () => {
    if (!actionDialog.obligationId) return;
    const payload: TransitionPayload = {};
    if (actionDialog.action === "submit_claim") {
      payload.amount = parseFloat(claimAmount || "0");
      payload.claimReference = claimReference || undefined;
      payload.proofUrl = proofUrl || undefined;
    }
    if (actionDialog.action === "true_up") {
      payload.trueUpAmount = parseFloat(trueUpAmount || "0");
    }
    if (actionDialog.action === "mark_paid") {
      payload.amount = parseFloat(claimAmount || "0") || undefined;
    }
    transitionMutation.mutate({ id: actionDialog.obligationId, action: actionDialog.action, payload });
  };

  const openAction = (id: string, action: string) => {
    const o = obligations.find(x => x.id === id);
    if (o && action === "submit_claim") setClaimAmount(o.outstandingAmount);
    if (o && action === "mark_paid") setClaimAmount(o.claimedAmount || o.outstandingAmount);
    setActionDialog({ open: true, action, obligationId: id });
  };

  return (
    <MainLayout title="Liability Aging">
      <div className="p-6 space-y-6" data-testid="page-outstanding-obligations">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">Liability Aging</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">MDF, advances, reserves, bonuses & true-ups — aging by planned release date. Validate claims in <a href="/claims-workspace" className="text-orange-700 hover:underline">Claims Workspace</a>; track payments in <a href="/invoices-memos" className="text-orange-700 hover:underline">Invoices &amp; Memos</a>.</p>
          </div>
          <Button onClick={() => expirySweepMutation.mutate()} variant="outline" data-testid="button-expiry-sweep">
            <Clock className="h-4 w-4 mr-2" /> Run Expiry Sweep
          </Button>
        </div>

        {/* Honest explainer — outstanding is a ledger value driven by the
            obligation state machine. ERP-cut payments do NOT auto-decrement
            this number; the obligation must transition to `paid` (manually
            from the Invoices & Memos page once the AP payment is confirmed,
            or programmatically when the Oracle payment webhook fires). */}
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-4 py-3 text-xs text-blue-900 dark:text-blue-200" data-testid="note-outstanding-definition">
          <span className="font-semibold">How "Outstanding" is calculated:</span> sum of <code>outstanding_amount</code> across obligations in status <code>accrued</code>, <code>claimable</code>, <code>claimed</code>, or <code>approved</code>. ERP payments do not auto-reduce this — an obligation only drops out once it is marked <code>paid</code> (from Invoices &amp; Memos when the AP payment posts) or <code>expired</code>. Aging buckets compare <code>planned_release_date</code> to today; rows with no planned release date appear under <strong>Current</strong>.
        </div>

        {/* Aging summary tiles */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {agingQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            (["current", "0_30", "31_60", "61_90", "90_plus"] as const).map(b => (
              <Card key={b} data-testid={`tile-bucket-${b}`}>
                <CardContent className="pt-6">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{BUCKET_LABELS[b]}</div>
                  <div className="text-2xl font-bold mt-2" data-testid={`text-bucket-${b}`}>{fmt(aging?.totals?.[b] || 0)}</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding by Kind</CardTitle></CardHeader>
            <CardContent>
              {Object.entries(aging?.totalsByKind || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 text-sm border-b last:border-0" data-testid={`kind-row-${k}`}>
                  <span>{KIND_LABELS[k] || k}</span><span className="font-semibold">{fmt(v)}</span>
                </div>
              ))}
              {Object.keys(aging?.totalsByKind || {}).length === 0 && <div className="text-sm text-gray-400">No outstanding obligations.</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Partners</CardTitle></CardHeader>
            <CardContent>
              {(aging?.totalsByPartner || []).slice(0, 6).map(p => (
                <div key={p.partnerName} className="flex justify-between py-1.5 text-sm border-b last:border-0" data-testid={`partner-row-${p.partnerName}`}>
                  <span>{p.partnerName} <span className="text-gray-400">({p.count})</span></span>
                  <span className="font-semibold">{fmt(p.total)}</span>
                </div>
              ))}
              {(aging?.totalsByPartner || []).length === 0 && <div className="text-sm text-gray-400">No outstanding obligations.</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              {Object.entries(aging?.countsByStatus || {}).map(([s, c]) => (
                <div key={s} className="flex justify-between py-1.5 text-sm border-b last:border-0" data-testid={`status-row-${s}`}>
                  <Badge className={STATUS_VARIANTS[s]}>{s}</Badge><span className="font-semibold">{c}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 mt-2 border-t font-bold">
                <span>Total Outstanding</span><span data-testid="text-total-outstanding">{fmt(aging?.totalOutstanding || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Kind</Label>
              <Select value={filterKind || "all"} onValueChange={v => setFilterKind(v === "all" ? "" : v)}>
                <SelectTrigger data-testid="select-filter-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All kinds</SelectItem>
                  {Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[260px]">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accrued,claimable,claimed,approved">Open (accrued/claimable/claimed/approved)</SelectItem>
                  <SelectItem value="accrued">Accrued only</SelectItem>
                  <SelectItem value="claimed">Claimed only</SelectItem>
                  <SelectItem value="approved">Approved only</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="accrued,claimable,claimed,approved,paid,expired,reversed">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Contract</Label>
              <Select value={filterContractId || "all"} onValueChange={v => setFilterContractId(v === "all" ? "" : v)}>
                <SelectTrigger data-testid="select-filter-contract"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contracts</SelectItem>
                  {(contractsQuery.data?.contracts || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractName || c.counterpartyName || c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Partner</Label>
              <Select value={filterPartnerId || "all"} onValueChange={v => setFilterPartnerId(v === "all" ? "" : v)}>
                <SelectTrigger data-testid="select-filter-partner"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All partners</SelectItem>
                  {partnerOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterKind || filterContractId || filterPartnerId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterKind(""); setFilterContractId(""); setFilterPartnerId(""); }}
                data-testid="button-filter-reset"
              >
                Reset filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/30" data-testid="bulk-action-bar">
            <CardContent className="pt-6 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium" data-testid="text-selected-count">{selectedIds.size} selected</span>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className="w-56" data-testid="select-bulk-action"><SelectValue placeholder="Bulk action..." /></SelectTrigger>
                <SelectContent>
                  {/* Approve / mark-paid have moved to Claims Workspace and
                      Invoices & Memos respectively — this page is now a
                      read-mostly aging view, so it only exposes the actions
                      that don't have a better home (submit claim, expire,
                      reverse). */}
                  <SelectItem value="expire">Expire / forfeit</SelectItem>
                  <SelectItem value="reverse">Reverse</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!bulkAction || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), action: bulkAction })}
                data-testid="button-bulk-apply"
              >
                {bulkMutation.isPending ? "Working..." : "Apply"}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedIds(new Set())} data-testid="button-bulk-clear">Clear</Button>
            </CardContent>
          </Card>
        )}

        {/* Grouped table */}
        {obligationsQuery.isLoading ? (
          <Skeleton className="h-64" />
        ) : groupedByPartner.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-500">No obligations match the current filters.</CardContent></Card>
        ) : (
          groupedByPartner.map(([partner, items]) => (
            <Card key={partner} data-testid={`group-partner-${partner}`}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{partner}</CardTitle>
                <span className="text-sm text-gray-500">{fmt(items.reduce((a, b) => a + parseFloat(b.outstandingAmount || "0"), 0))} across {items.length}</span>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Funding period</TableHead>
                      <TableHead>Planned release</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(o => (
                      <TableRow key={o.id} data-testid={`row-obligation-${o.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(o.id)}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedIds);
                              if (v) next.add(o.id); else next.delete(o.id);
                              setSelectedIds(next);
                            }}
                            data-testid={`checkbox-${o.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{KIND_LABELS[o.kind] || o.kind}</TableCell>
                        <TableCell><Badge className={STATUS_VARIANTS[o.status] || ""}>{o.status}</Badge></TableCell>
                        <TableCell className="text-sm">{o.fundingPeriod || "—"}</TableCell>
                        <TableCell className="text-sm">{fmtDate(o.plannedReleaseDate)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(o.expiryDate)}</TableCell>
                        <TableCell className="text-right">{fmt(o.amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(o.outstandingAmount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setSelectedId(o.id)} data-testid={`button-detail-${o.id}`}>Detail</Button>
                            {(o.status === "accrued" || o.status === "claimable") && (
                              <>
                                <Button size="sm" onClick={() => openAction(o.id, "submit_claim")} data-testid={`button-claim-${o.id}`}>Claim</Button>
                                <Button size="sm" variant="outline" onClick={() => openAction(o.id, "expire")} title="Forfeit / expire this obligation" data-testid={`button-expire-${o.id}`}>
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Expire
                                </Button>
                              </>
                            )}
                            {/* Approve / Mark-paid no longer live here. A
                                claimed obligation belongs to the Claims
                                Workspace; an approved one belongs to
                                Invoices & Memos (where the AP payment is
                                actually issued). Surface a deep-link
                                instead of an inline transition button. */}
                            {o.status === "claimed" && (
                              <Button asChild size="sm" variant="outline" data-testid={`link-claim-${o.id}`}>
                                <a href={`/claims-workspace`} title="Validate / approve this claim in the Claims Workspace">View claim →</a>
                              </Button>
                            )}
                            {o.status === "approved" && (
                              <Button asChild size="sm" variant="outline" data-testid={`link-pay-${o.id}`}>
                                <a href={`/invoices-memos`} title="Issue payment from Invoices & Memos">Pay in AP →</a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}

        {/* Detail dialog */}
        <Dialog open={!!selectedId} onOpenChange={o => !o && setSelectedId(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Obligation detail</DialogTitle>
              <DialogDescription>Full state-machine history and linked journal entries.</DialogDescription>
            </DialogHeader>
            {detailQuery.isLoading || !detailQuery.data ? <Skeleton className="h-64" /> : (
              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="events">Event history ({detailQuery.data.events.length})</TabsTrigger>
                  <TabsTrigger value="je">Journal entries</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="space-y-2">
                  {Object.entries({
                    Kind: KIND_LABELS[detailQuery.data.obligation.kind] || detailQuery.data.obligation.kind,
                    Status: detailQuery.data.obligation.status,
                    Direction: detailQuery.data.obligation.direction || "—",
                    Partner: detailQuery.data.obligation.partnerName || "—",
                    "Funding period": detailQuery.data.obligation.fundingPeriod || "—",
                    Amount: fmt(detailQuery.data.obligation.amount),
                    Outstanding: fmt(detailQuery.data.obligation.outstandingAmount),
                    Claimed: fmt(detailQuery.data.obligation.claimedAmount || 0),
                    "Claim reference": detailQuery.data.obligation.claimReference || "—",
                    "Accrual date": fmtDate(detailQuery.data.obligation.accrualDate),
                    "Planned release": fmtDate(detailQuery.data.obligation.plannedReleaseDate),
                    "Expiry": fmtDate(detailQuery.data.obligation.expiryDate),
                    "Rollover policy": detailQuery.data.obligation.rolloverPolicy || "—",
                  }).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 text-sm border-b last:border-0">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                  {/* Task 68 — Origin section. Only rendered when this
                      obligation was promoted from a posted accrual. The
                      link drops the operator straight back into the accrual
                      detail panel for full audit-trail context. */}
                  {detailQuery.data.obligation.sourceAccrualId && (() => {
                    const ob = detailQuery.data.obligation;
                    const meta = ob.metadata || {};
                    const calcId = meta.originCalculationId || null;
                    const rule = meta.originRule || {};
                    const ruleSummary = [
                      rule.flowLabel,
                      rule.tier ? `tier ${rule.tier}` : null,
                      rule.rate ? `@${rule.rate}` : null,
                    ].filter(Boolean).join(" · ");
                    return (
                      <div className="mt-4 pt-3 border-t" data-testid="origin-section">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Origin</div>
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-500">Promoted from accrual</span>
                          <a
                            href={`/accrual-management?focus=${ob.sourceAccrualId}`}
                            className="font-semibold text-orange-700 hover:underline"
                            data-testid="link-origin-accrual"
                          >
                            {ob.sourceAccrualId}
                          </a>
                        </div>
                        {calcId && (
                          <div className="flex justify-between py-1 text-sm">
                            <span className="text-gray-500">Calculation run</span>
                            <a
                              href={`/calculations?run=${calcId}`}
                              className="font-medium text-orange-700 hover:underline"
                              data-testid="link-origin-calc"
                            >
                              {calcId.slice(0, 8)}…
                            </a>
                          </div>
                        )}
                        {ruleSummary && (
                          <div className="flex justify-between py-1 text-sm">
                            <span className="text-gray-500">Rule</span>
                            <span className="font-medium" data-testid="text-origin-rule">{ruleSummary}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-500">Source channel</span>
                          <span className="font-medium">{ob.sourceChannel || "—"}</span>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>
                <TabsContent value="events">
                  {detailQuery.data.events.map(e => (
                    <div key={e.id} className="border-l-2 border-orange-500 pl-3 py-2 mb-2" data-testid={`event-${e.id}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{e.eventType}</Badge>
                        {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                          <span className="text-xs text-gray-500 inline-flex items-center">{e.fromStatus} <ArrowRight className="h-3 w-3 mx-1" /> {e.toStatus}</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{new Date(e.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm mt-1">{e.description}</div>
                      <div className="text-xs text-gray-400 mt-1">{e.userName} · phase: {e.phase || "—"}</div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="je">
                  {detailQuery.data.journalEntries.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4">No linked journal entries yet.</div>
                  ) : detailQuery.data.journalEntries.map((je) => (
                    <div key={je.id} className="p-3 border rounded mb-2" data-testid={`je-${je.id}`}>
                      <div className="flex justify-between"><span className="font-medium">{je.jeId}</span><Badge>{je.jeStage}</Badge></div>
                      <div className="text-sm text-gray-500 mt-1">{je.flowType} · {je.period}</div>
                      <div className="text-sm font-semibold mt-1">{fmt(je.totalAmount)}</div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedId(null)}>Close</Button>
              {detailQuery.data?.obligation && (
                <Button variant="destructive" onClick={() => openAction(detailQuery.data!.obligation.id, "reverse")} data-testid="button-reverse">
                  <XCircle className="h-4 w-4 mr-2" /> Reverse
                </Button>
              )}
              {detailQuery.data?.obligation?.status === "paid" && (
                <Button onClick={() => openAction(detailQuery.data!.obligation.id, "true_up")} data-testid="button-trueup">
                  True-up
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action dialog */}
        <Dialog open={actionDialog.open} onOpenChange={open => !open && setActionDialog({ open: false, action: "", obligationId: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionDialog.action.replace(/_/g, " ")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {(actionDialog.action === "submit_claim" || actionDialog.action === "mark_paid") && (
                <div>
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} data-testid="input-amount" />
                </div>
              )}
              {actionDialog.action === "submit_claim" && (
                <>
                  <div>
                    <Label>Claim reference</Label>
                    <Input value={claimReference} onChange={e => setClaimReference(e.target.value)} placeholder="CLM-2026-0001" data-testid="input-claim-ref" />
                  </div>
                  <div>
                    <Label>Proof artifact (upload)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fd = new FormData();
                        fd.append("file", f);
                        try {
                          const r = await fetch(`/api/obligations/${actionDialog.obligationId}/upload-proof`, { method: "POST", body: fd, credentials: "include" });
                          if (!r.ok) throw new Error(await r.text());
                          const j = await r.json();
                          setProofUrl(j.url);
                          toast({ title: "Proof uploaded", description: `${j.filename} (${Math.round(j.size / 1024)} KB)` });
                        } catch (err: unknown) {
                          toast({ title: "Upload failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
                        }
                      }}
                      data-testid="input-proof-file"
                    />
                    {proofUrl && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2" data-testid="text-proof-attached">
                        <FileText className="h-3 w-3" /> Attached: <a href={proofUrl} target="_blank" rel="noreferrer" className="underline truncate">{proofUrl}</a>
                        <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setProofUrl("")} data-testid="button-clear-proof">clear</Button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {actionDialog.action === "true_up" && (
                <div>
                  <Label>True-up delta (positive or negative)</Label>
                  <Input type="number" step="0.01" value={trueUpAmount} onChange={e => setTrueUpAmount(e.target.value)} data-testid="input-trueup-amount" />
                </div>
              )}
              {(actionDialog.action === "approve_claim" || actionDialog.action === "expire" || actionDialog.action === "reverse") && (
                <div className="text-sm text-gray-600">Confirm to {actionDialog.action.replace(/_/g, " ")} this obligation. A draft journal entry will be written.</div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog({ open: false, action: "", obligationId: null })}>Cancel</Button>
              <Button onClick={submitTransition} disabled={transitionMutation.isPending} data-testid="button-confirm-transition">
                {transitionMutation.isPending ? "Working..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
