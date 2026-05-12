import { useEffect, useMemo, useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import { WorkspaceShell, FilterChip, QueueGroup } from "@/components/finance/workspace-shell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartnerPicker } from "@/components/finance/partner-picker";
import { CurrencyPicker } from "@/components/finance/period-currency-pickers";
import { KpiStrip } from "@/components/finance/kpi-strip";
import { AgentActivityBar } from "@/components/finance/agent-activity-bar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Scissors, Link2, ShieldAlert, FileMinus, RotateCcw, Pencil } from "lucide-react";

type Deduction = {
  id: string;
  partnerId: string | null;
  partnerName: string | null;
  contractId: string | null;
  contractName: string | null;
  deductionNumber: string | null;
  deductedAmount: string;
  currency: string | null;
  deductionDate: string | null;
  originalInvoiceRef: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  status: string;
  validityScore: number | null;
  matchedClaimId: string | null;
  matchedObligationId: string | null;
  notes: string | null;
  createdAt: string | null;
};

type ReasonCode = { code: string; description: string; defaultDisposition: string };

const STATUS_LABELS: Record<string, string> = {
  open: "Open", needs_review: "Needs Review", matched: "Matched",
  disputed: "Disputed", written_off: "Written off", recovered: "Recovered",
};

export default function DeductionsWorkspace() {
  const { toast } = useToast();
  // Deep-link support so other workspaces (e.g. Settlement Workspace's
  // "Open in Deductions" / "Open" row buttons) can land here pre-targeted.
  // ?deductionId=  → auto-select that deduction and force viewMode="all"
  //                  so the row isn't hidden by the default unexpected/expected split.
  // ?contractId=   → restrict the queue to deductions tied to that contract.
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  // Accept both `?deductionId=` (legacy) and `?focus=` (period-close
  // Worksheet uses focus everywhere for consistency).
  const initialDeductionId = initialParams?.get("focus") || initialParams?.get("deductionId") || null;
  const initialContractFilter = initialParams?.get("contractId") || null;
  const [selectedId, setSelectedId] = useState<string | null>(initialDeductionId);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [viewMode, setViewMode] = useState(initialDeductionId ? "all" : "unexpected");
  const [contractFilter, setContractFilter] = useState<string | null>(initialContractFilter);
  // Drop the params after we've consumed them so a subsequent navigation
  // back here from elsewhere starts with a clean state.
  useEffect(() => {
    if ((initialDeductionId || initialContractFilter) && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      url.searchParams.delete("deductionId");
      url.searchParams.delete("contractId");
      window.history.replaceState({}, "", url.toString());
      if (initialDeductionId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-testid="queue-item-${initialDeductionId}"]`);
          if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      }
    }
    // Intentionally only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listQ = useQuery<Deduction[]>({ queryKey: ["/api/finance/deductions"], refetchInterval: 7000 });
  const statsQ = useQuery<{ openCount: number; openExposure: number; expectedOpen: number; unexpectedOpen: number; needsReview: number; disputed: number; autoClearedToday: number }>({
    queryKey: ["/api/finance/deductions/stats"], refetchInterval: 10000,
  });
  const codesQ = useQuery<{ reasonCodes: { code: string; defaultDisposition: string }[] }>({
    queryKey: ["/api/finance/deductions/options"],
  });
  const autoCodes = useMemo(() => new Set(
    (codesQ.data?.reasonCodes || [])
      .filter(c => c.defaultDisposition === "auto_clear" || c.defaultDisposition === "match")
      .map(c => c.code)
  ), [codesQ.data]);
  const isExpected = (d: Deduction) => !!(d.reasonCode && autoCodes.has(d.reasonCode));
  const detailQ = useQuery<any>({
    queryKey: ["/api/finance/deductions", selectedId],
    enabled: !!selectedId,
  });

  const filtered = useMemo(() => {
    const all = listQ.data || [];
    return all.filter(d => {
      // Contract scope (set via ?contractId= deep link from Settlement
      // Workspace) — narrows the queue to a single contract's deductions.
      if (contractFilter && d.contractId !== contractFilter) return false;
      if (search) {
        const hay = `${d.partnerName || ""} ${d.deductionNumber || ""} ${d.originalInvoiceRef || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      // View-mode split: Expected = reason code maps to auto_clear/match
      // (these the agent can resolve on its own); Unexpected = everything else
      // and demands human triage. "All" disables the split.
      if (viewMode === "expected" && !isExpected(d)) return false;
      if (viewMode === "unexpected" && isExpected(d)) return false;
      if (filters.length === 0) return true;
      return filters.includes(d.status);
    });
  }, [listQ.data, search, filters, viewMode, autoCodes, contractFilter]);

  const groups: QueueGroup<Deduction>[] = useMemo(() => {
    const needs = filtered.filter(d => d.status === "needs_review" || d.status === "open");
    const disp = filtered.filter(d => d.status === "disputed");
    const matched = filtered.filter(d => d.status === "matched");
    const resolved = filtered.filter(d => d.status === "written_off" || d.status === "recovered");
    return [
      { key: "needs", label: "Needs Review", tone: "urgent", items: needs },
      { key: "disputed", label: "Disputed", tone: "agent", items: disp },
      { key: "matched", label: "Matched", tone: "standard", items: matched },
      { key: "resolved", label: "Resolved", tone: "standard", items: resolved },
    ];
  }, [filtered]);

  const filterChips: FilterChip[] = [
    { key: "open", label: "Open" },
    { key: "needs_review", label: "Needs Review" },
    { key: "disputed", label: "Disputed" },
    { key: "matched", label: "Matched" },
    { key: "written_off", label: "Written off" },
    { key: "recovered", label: "Recovered" },
  ];

  const decideMut = useMutation({
    mutationFn: async (vars: { id: string; action: string; note?: string }) =>
      (await apiRequest("POST", `/api/finance/deductions/${vars.id}/decide`, { action: vars.action, note: vars.note })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions"] });
      toast({ title: "Decision recorded" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const matchMut = useMutation({
    mutationFn: async (vars: { id: string; claimId?: string; obligationId?: string }) =>
      (await apiRequest("POST", `/api/finance/deductions/${vars.id}/match`, vars)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions"] });
      toast({ title: "Linked" });
    },
    onError: (e: any) => toast({ title: "Match failed", description: e.message, variant: "destructive" }),
  });

  const selected = filtered.find(d => d.id === selectedId) || null;
  const [editTarget, setEditTarget] = useState<Deduction | null>(null);

  return (
    <MainLayout title="Deductions" description="Review customer short-pays and chargebacks; match, dispute, write off, or recover.">
      <WorkspaceShell
        activityBar={<AgentActivityBar scope="deduction" />}
        kpiStrip={
          <KpiStrip
            kpis={[
              { key: "open", label: "Open Deductions", value: statsQ.data?.openCount ?? "—", hint: `${statsQ.data?.needsReview ?? 0} need review` },
              { key: "exposure", label: "Open Exposure", value: `$${Math.round(statsQ.data?.openExposure ?? 0).toLocaleString()}`, tone: (statsQ.data?.openExposure ?? 0) > 0 ? "warning" : "neutral" },
              { key: "unexpected", label: "Unexpected", value: statsQ.data?.unexpectedOpen ?? "—", tone: (statsQ.data?.unexpectedOpen ?? 0) > 0 ? "urgent" : "neutral", hint: "need triage" },
              { key: "auto", label: "Agent Auto-Cleared Today", value: statsQ.data?.autoClearedToday ?? "—", tone: "good", hint: `${statsQ.data?.expectedOpen ?? 0} expected awaiting` },
            ]}
          />
        }
        queueTitle="Deductions"
        viewModes={[
          { key: "unexpected", label: "Unexpected" },
          { key: "expected", label: "Expected" },
          { key: "all", label: "All" },
        ]}
        activeViewMode={viewMode}
        onViewModeChange={setViewMode}
        filterChips={filterChips}
        activeFilters={filters}
        onToggleFilter={(k) => setFilters(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])}
        searchValue={search}
        onSearchChange={setSearch}
        loading={listQ.isLoading}
        groups={groups}
        renderQueueItem={(item) => (
          <div data-testid={`row-deduction-${item.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-neutral-900">{item.partnerName || "Unknown partner"}</div>
              <span className="text-[10px] text-neutral-500">{item.deductionNumber || "—"}</span>
            </div>
            <div className="text-[11px] text-neutral-600">
              {(item.reasonCode || "uncoded").replace(/_/g, " ")} · inv {item.originalInvoiceRef || "—"}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="font-mono text-neutral-900">${Number(item.deductedAmount || 0).toLocaleString()}</span>
              <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[item.status] || item.status}</Badge>
            </div>
          </div>
        )}
        selectedId={selectedId}
        onSelectItem={(item) => setSelectedId(item.id)}
        toolbar={
          <div className="flex items-center gap-2">
            <Button
              size="sm" className="h-7 bg-orange-600 text-[11px] text-white hover:bg-orange-700"
              onClick={() => setNewOpen(true)} data-testid="button-new-deduction"
            >
              <Plus className="mr-1 h-3 w-3" /> New Deduction
            </Button>
          </div>
        }
        detail={selected ? (
          <DeductionDetail
            deduction={selected}
            detail={detailQ.data}
            onEdit={() => setEditTarget(selected)}
            onAction={(action, note) => decideMut.mutate({ id: selected.id, action, note })}
            onMatch={(claimId, obligationId) => matchMut.mutate({ id: selected.id, claimId, obligationId })}
            isPending={decideMut.isPending || matchMut.isPending}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-500">
            <Scissors className="h-8 w-8" />
            <div className="text-sm">Select a deduction to review</div>
          </div>
        )}
      />

      <NewDeductionDialog open={newOpen} onOpenChange={setNewOpen} />
      {editTarget && (
        <DeductionFormDialog
          key={editTarget.id}
          open={!!editTarget}
          onOpenChange={(b) => { if (!b) setEditTarget(null); }}
          mode="edit"
          existing={editTarget}
        />
      )}
    </MainLayout>
  );
}

function DeductionDetail({ deduction, detail, onAction, onMatch, isPending, onEdit }: {
  deduction: Deduction;
  detail: any;
  onAction: (action: string, note?: string) => void;
  onMatch: (claimId?: string, obligationId?: string) => void;
  isPending: boolean;
  onEdit: () => void;
}) {
  const isTerminal = ["written_off", "recovered"].includes(deduction.status);
  const events = detail?.events || [];
  const claimMatches = detail?.suggestedMatches?.claims || [];
  const oblMatches = detail?.suggestedMatches?.obligations || [];
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Deduction · {deduction.deductionNumber || "—"}</div>
          <h3 className="text-2xl font-semibold text-neutral-900" data-testid="text-deduction-partner">{deduction.partnerName || "Unknown"}</h3>
          <div className="text-sm text-neutral-600">
            {deduction.contractName || "(no contract)"} · invoice {deduction.originalInvoiceRef || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-neutral-900" data-testid="text-deduction-amount">
            ${Number(deduction.deductedAmount || 0).toLocaleString()}
          </div>
          <Badge className="mt-1 bg-orange-600 text-white">{STATUS_LABELS[deduction.status] || deduction.status}</Badge>
          {!isTerminal && (
            <div className="mt-2">
              <Button
                size="sm" variant="outline" className="h-7 text-[11px]"
                onClick={onEdit} data-testid="button-edit-deduction"
              >
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
          <div className="uppercase tracking-wide text-neutral-500">Reason</div>
          <div className="font-medium text-neutral-900">{(deduction.reasonCode || "uncoded").replace(/_/g, " ")}</div>
          {deduction.reasonText && <div className="mt-1 text-neutral-600">{deduction.reasonText}</div>}
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
          <div className="uppercase tracking-wide text-neutral-500">Date</div>
          <div className="font-medium text-neutral-900">
            {deduction.deductionDate ? new Date(deduction.deductionDate).toLocaleDateString("en-US") : "—"}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
          <div className="uppercase tracking-wide text-neutral-500">Currency</div>
          <div className="font-medium text-neutral-900">{deduction.currency || "USD"}</div>
        </div>
      </div>

      {!isTerminal && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline" disabled={isPending}
            onClick={() => onAction("dispute", prompt("Reason for dispute?") || undefined)}
            data-testid="button-dispute"
          >
            <ShieldAlert className="mr-1 h-3 w-3" /> Dispute
          </Button>
          <Button
            size="sm" variant="outline" disabled={isPending}
            onClick={() => { if (confirm("Write off this deduction?")) onAction("write_off"); }}
            data-testid="button-write-off"
          >
            <FileMinus className="mr-1 h-3 w-3" /> Write Off
          </Button>
          <Button
            size="sm" className="bg-orange-600 hover:bg-orange-700" disabled={isPending}
            onClick={() => onAction("recover")}
            data-testid="button-recover"
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Mark Recovered
          </Button>
        </div>
      )}

      {!isTerminal && (claimMatches.length > 0 || oblMatches.length > 0) && (
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-neutral-700">Suggested matches (±5% amount)</div>
          <div className="space-y-2">
            {claimMatches.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-neutral-200 p-2 text-xs">
                <div>
                  <div className="font-medium">Claim {c.claimNumber || c.id.slice(0, 8)}</div>
                  <div className="text-neutral-600">{c.claimType?.replace(/_/g, " ")} · {c.period || "—"} · ${Number(c.amount || 0).toLocaleString()}</div>
                </div>
                <Button
                  size="sm" variant="outline" disabled={isPending}
                  onClick={() => onMatch(c.id, undefined)}
                  data-testid={`button-link-claim-${c.id}`}
                >
                  <Link2 className="mr-1 h-3 w-3" /> Link
                </Button>
              </div>
            ))}
            {oblMatches.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded border border-neutral-200 p-2 text-xs">
                <div>
                  <div className="font-medium">Obligation {o.id.slice(0, 8)}</div>
                  <div className="text-neutral-600">{o.kind?.replace(/_/g, " ")} · {o.fundingPeriod || "—"} · ${Number(o.amount || 0).toLocaleString()}</div>
                </div>
                <Button
                  size="sm" variant="outline" disabled={isPending}
                  onClick={() => onMatch(undefined, o.id)}
                  data-testid={`button-link-obligation-${o.id}`}
                >
                  <Link2 className="mr-1 h-3 w-3" /> Link
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium text-neutral-700">Timeline</div>
        <div className="space-y-1.5">
          {events.length === 0 && <div className="text-xs text-neutral-500">No events yet.</div>}
          {events.map((e: any) => (
            <div key={e.id} className="rounded border border-neutral-200 bg-white p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900">{e.eventType.replace(/_/g, " ")}</span>
                <span className="text-neutral-500">{e.createdAt ? new Date(e.createdAt).toLocaleString("en-US") : ""}</span>
              </div>
              {e.description && <div className="mt-0.5 text-neutral-600">{e.description}</div>}
              <div className="mt-0.5 text-neutral-500">
                {e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus} · by {e.userName || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewDeductionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  return <DeductionFormDialog open={open} onOpenChange={onOpenChange} mode="create" />;
}

function DeductionFormDialog({
  open,
  onOpenChange,
  mode,
  existing,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  mode: "create" | "edit";
  existing?: Deduction | null;
}) {
  const { toast } = useToast();
  const optsQ = useQuery<{ reasonCodes: ReasonCode[]; contracts: any[]; partners: string[] }>({
    queryKey: ["/api/finance/deductions/options"],
    enabled: open,
  });
  const isEdit = mode === "edit" && !!existing;
  const [partnerName, setPartnerName] = useState(isEdit ? (existing!.partnerName || "") : "");
  const [contractId, setContractId] = useState<string>(isEdit ? (existing!.contractId || "__none") : "__none");
  const [amount, setAmount] = useState(isEdit ? String(existing!.deductedAmount || "") : "");
  const [currency, setCurrency] = useState(isEdit ? (existing!.currency || "USD") : "USD");
  const [date, setDate] = useState(() =>
    isEdit && existing!.deductionDate
      ? new Date(existing!.deductionDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [reasonCode, setReasonCode] = useState<string>(isEdit ? (existing!.reasonCode || "other") : "other");
  const [reasonText, setReasonText] = useState(isEdit ? (existing!.reasonText || "") : "");
  const [invoiceRef, setInvoiceRef] = useState(isEdit ? (existing!.originalInvoiceRef || "") : "");
  const [notes, setNotes] = useState(isEdit ? (existing!.notes || "") : "");

  const submitMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        partnerName: partnerName.trim(),
        contractId: contractId === "__none" ? null : contractId,
        deductedAmount: amount,
        currency,
        deductionDate: date,
        reasonCode,
        reasonText: reasonText.trim() || null,
        originalInvoiceRef: invoiceRef.trim() || null,
        notes: notes.trim() || null,
      };
      const cn = (optsQ.data?.contracts || []).find((c: any) => c.id === body.contractId);
      if (cn) body.contractName = cn.displayName || cn.contractNumber || cn.counterpartyName || null;
      if (isEdit) {
        return (await apiRequest("PATCH", `/api/finance/deductions/${existing!.id}`, body)).json();
      }
      return (await apiRequest("POST", "/api/finance/deductions", body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions"] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ["/api/finance/deductions", existing!.id] });
      }
      toast({ title: isEdit ? "Deduction updated" : "Deduction created" });
      onOpenChange(false);
      if (!isEdit) {
        setPartnerName(""); setContractId("__none"); setAmount("");
        setReasonText(""); setInvoiceRef(""); setNotes("");
      }
    },
    onError: (e: any) => toast({
      title: isEdit ? "Could not update deduction" : "Could not create deduction",
      description: e.message, variant: "destructive",
    }),
  });

  const canSubmit = partnerName.trim().length > 0 && Number(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid={isEdit ? "dialog-edit-deduction" : "dialog-new-deduction"}>
        <DialogHeader><DialogTitle>{isEdit ? `Edit Deduction · ${existing!.deductionNumber || ""}` : "New Deduction"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2">
            <label className="mb-1 block font-medium">Partner <span className="text-red-600">*</span></label>
            <PartnerPicker
              value={partnerName}
              onChange={(v) => {
                setPartnerName(v);
                // Reset contract when partner changes so a stale selection
                // for a different partner cannot survive.
                setContractId("__none");
              }}
              partners={optsQ.data?.partners || []}
              testId="input-partner-name"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Contract</label>
            {(() => {
              const allContracts = optsQ.data?.contracts || [];
              const partnerKey = partnerName.trim().toLowerCase();
              const filteredContracts = partnerKey
                ? allContracts.filter((c: any) =>
                    (c.counterpartyName || "").trim().toLowerCase() === partnerKey
                  )
                : allContracts;
              const isEmptyForPartner = partnerKey && filteredContracts.length === 0;
              return (
                <>
                  <Select value={contractId} onValueChange={setContractId}>
                    <SelectTrigger data-testid="select-contract"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None / unknown</SelectItem>
                      {filteredContracts.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.displayName || c.contractNumber || c.counterpartyName || c.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isEmptyForPartner && (
                    <div className="mt-1 text-[10px] text-neutral-500" data-testid="text-no-contracts-for-partner">
                      No contracts found for "{partnerName}". Pick "None / unknown" or change the partner.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div>
            <label className="mb-1 block font-medium">Reason</label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger data-testid="select-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(optsQ.data?.reasonCodes || []).map(r => (
                  <SelectItem key={r.code} value={r.code}>{r.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block font-medium">Amount <span className="text-red-600">*</span></label>
            <Input
              type="number" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} data-testid="input-amount"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Currency</label>
            <CurrencyPicker value={currency} onChange={setCurrency} testId="input-currency" />
          </div>
          <div>
            <label className="mb-1 block font-medium">Deduction date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-date" />
          </div>
          <div>
            <label className="mb-1 block font-medium">Original invoice #</label>
            <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} data-testid="input-invoice-ref" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block font-medium">Reason text</label>
            <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Optional free-text from remittance" data-testid="input-reason-text" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!canSubmit || submitMut.isPending}
            onClick={() => submitMut.mutate()}
            data-testid={isEdit ? "button-save-deduction" : "button-create-deduction"}
          >
            {submitMut.isPending
              ? (isEdit ? "Saving…" : "Creating…")
              : (isEdit ? "Save changes" : "Create deduction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
