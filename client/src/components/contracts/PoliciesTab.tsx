import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  ChevronDown, ChevronRight, Loader2, Save, Layers,
  Wallet, Calendar, Building2, RefreshCw, Globe, History, Lock,
} from "lucide-react";
import { ContractLevelPoliciesHeader } from "@/components/contracts/policies/ContractLevelPoliciesHeader";

type SubtypeInstance = {
  id: string;
  contractId: string;
  subtypeCode: string;
  subtypeName: string | null;
  label: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AccrualPolicy = {
  id: string;
  subtypeInstanceId: string;
  versionNum: number;
  isCurrent: boolean;
  aggregationPeriod: string;
  obligationAccrualBasis: string;
  glAccount: string | null;
  financeHubTab: string | null;
  releaseTriggerType: string;
  notes: string | null;
};

type SettlementBundle = {
  policy: { id: string; versionNum: number; isCurrent: boolean; notes: string | null };
  paymentSchedule: { cadence: string; paymentTermsDays: number; paymentDay: number | null; trueUpCadence: string | null; notes: string | null } | null;
  settlementMethod: { method: string; bankAccountRef: string | null; remitToParty: string | null; notes: string | null } | null;
  overpaymentHandling: { strategy: string; thresholdAmount: string | null; notes: string | null } | null;
  disputeHandling: { defaultStrategy: string; responseSlaDays: number | null; escalationContact: string | null; notes: string | null } | null;
  fxRule: { rateSource: string; fixedRate: string | null; baseCurrency: string | null; notes: string | null } | null;
};

const AGG_PERIOD_OPTS = ["per_sale", "monthly", "quarterly", "annual"];
const OBLIG_BASIS_OPTS = ["qualifying_sale", "scheduled_release"];
const RELEASE_TRIGGER_OPTS = ["period_end", "claim_received", "manual", "sale_event"];
const CADENCE_OPTS = ["monthly", "quarterly", "annual", "event_driven"];
const METHOD_OPTS = ["ach", "wire", "check", "credit_memo", "offset"];
const REMIT_OPTS = ["counterparty", "organization", "other"];
const OVERPAY_OPTS = ["offset_next", "refund", "write_off", "hold"];
const DISPUTE_OPTS = ["hold_payment", "partial_pay", "escalate", "auto_resolve_credit"];
const FX_SOURCE_OPTS = ["contract_rate", "period_avg", "spot_at_settlement", "fixed"];

const LOCK_TITLE = "Contract is locked — click Revise to create a change order before editing";

function VersionBadge({ v }: { v: number }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
      v{v}
    </span>
  );
}

function FieldRow({ label, children }: { label: string; children: any }) {
  return (
    <div className="grid grid-cols-12 items-start gap-3 py-1.5">
      <label className="col-span-4 text-[12px] font-medium text-zinc-600 pt-2">{label}</label>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

function HistoryDrawer({
  instanceId, kind, open, onOpenChange,
}: {
  instanceId: string;
  kind: "accrual" | "settlement";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const path = kind === "accrual" ? "accrual-policy" : "settlement-policy";
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/subtype-instances", instanceId, path, "history"],
    enabled: open,
  });
  const rows = Array.isArray(data) ? data : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid={`drawer-policy-history-${kind}-${instanceId}`}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-zinc-500" />
            {kind === "accrual" ? "Accrual" : "Settlement"} Policy — version history
          </SheetTitle>
          <SheetDescription className="text-xs">
            Every save creates a new version. The current version is at the top.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="text-sm text-zinc-500 py-4" data-testid={`text-history-empty-${kind}`}>No history yet.</div>
          )}
          {rows.map((row: any) => {
            const eff = row.effectiveFrom ? new Date(row.effectiveFrom) : null;
            const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
            return (
              <div
                key={row.id}
                className={`border rounded-md px-3 py-2.5 ${row.isCurrent ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-200 bg-white"}`}
                data-testid={`row-history-${kind}-v${row.versionNum}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-zinc-700">v{row.versionNum}</span>
                  {row.isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">CURRENT</span>
                  )}
                  {!row.isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">superseded</span>
                  )}
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-600 space-y-0.5">
                  <div>
                    <span className="font-medium text-zinc-500">Effective:</span>{" "}
                    {eff ? eff.toLocaleDateString() : "—"}
                    {to ? ` → ${to.toLocaleDateString()}` : (row.isCurrent ? " → present" : "")}
                  </div>
                  {row.createdBy && (
                    <div><span className="font-medium text-zinc-500">By:</span> {row.createdBy}</div>
                  )}
                  {kind === "accrual" && (
                    <div className="flex flex-wrap gap-x-3">
                      <span><span className="font-medium text-zinc-500">Aggregation:</span> {row.aggregationPeriod}</span>
                      <span><span className="font-medium text-zinc-500">Release:</span> {row.releaseTriggerType}</span>
                    </div>
                  )}
                  {row.notes && (
                    <div className="mt-1 italic text-zinc-500 line-clamp-3">"{row.notes}"</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AccrualPolicyEditor({ instanceId, isLocked }: { instanceId: string; isLocked: boolean }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AccrualPolicy>({
    queryKey: ["/api/subtype-instances", instanceId, "accrual-policy"],
  });

  const [draft, setDraft] = useState<Partial<AccrualPolicy>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => { if (data) setDraft({}); }, [data?.id]);

  const merged: any = { ...(data ?? {}), ...draft };
  const dirty = Object.keys(draft).length > 0;

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<AccrualPolicy>) => {
      const res = await apiRequest("PATCH", `/api/subtype-instances/${instanceId}/accrual-policy`, patch);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subtype-instances", instanceId, "accrual-policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subtype-instances", instanceId, "accrual-policy", "history"] });
      // The chip on the Rules tab depends on this summary.
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setDraft({});
      toast({ title: "Accrual policy saved", description: "A new version was created." });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-zinc-500 text-sm py-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!data) return <div className="text-sm text-zinc-500 py-3">No accrual policy yet.</div>;

  const inputsDisabled = isLocked || saveMutation.isPending;

  return (
    <div className="border border-zinc-200 rounded-lg bg-white" data-testid={`card-accrual-policy-${instanceId}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <h4 className="text-sm font-semibold text-zinc-800">Accrual Policy</h4>
          <VersionBadge v={data.versionNum} />
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200" title={LOCK_TITLE}>
              <Lock className="h-2.5 w-2.5" /> Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
            data-testid={`button-history-accrual-${instanceId}`}
          >
            <History className="h-3 w-3" /> History
          </button>
          <button
            type="button"
            disabled={!dirty || inputsDisabled}
            onClick={() => saveMutation.mutate(draft)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:bg-zinc-200 disabled:text-zinc-500"
            data-testid={`button-save-accrual-${instanceId}`}
            title={isLocked ? LOCK_TITLE : undefined}
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save as new version
          </button>
        </div>
      </div>
      <div className="px-4 py-3" title={isLocked ? LOCK_TITLE : undefined}>
        <FieldRow label="Aggregation Period">
          <Select value={merged.aggregationPeriod} onValueChange={(v) => setDraft(d => ({ ...d, aggregationPeriod: v }))} disabled={inputsDisabled}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-aggregation-period-${instanceId}`}><SelectValue /></SelectTrigger>
            <SelectContent>{AGG_PERIOD_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Obligation Accrual Basis">
          <Select value={merged.obligationAccrualBasis} onValueChange={(v) => setDraft(d => ({ ...d, obligationAccrualBasis: v }))} disabled={inputsDisabled}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-obligation-basis-${instanceId}`}><SelectValue /></SelectTrigger>
            <SelectContent>{OBLIG_BASIS_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Release Trigger">
          <Select value={merged.releaseTriggerType} onValueChange={(v) => setDraft(d => ({ ...d, releaseTriggerType: v }))} disabled={inputsDisabled}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-release-trigger-${instanceId}`}><SelectValue /></SelectTrigger>
            <SelectContent>{RELEASE_TRIGGER_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="GL Account (override)">
          <Input value={merged.glAccount ?? ""} onChange={(e) => setDraft(d => ({ ...d, glAccount: e.target.value || null as any }))} className="h-8 text-xs" placeholder="(use subtype default)" data-testid={`input-gl-account-${instanceId}`} disabled={inputsDisabled} />
        </FieldRow>
        <FieldRow label="Finance Hub Tab (override)">
          <Input value={merged.financeHubTab ?? ""} onChange={(e) => setDraft(d => ({ ...d, financeHubTab: e.target.value || null as any }))} className="h-8 text-xs" placeholder="(use subtype default)" data-testid={`input-finance-hub-tab-${instanceId}`} disabled={inputsDisabled} />
        </FieldRow>
        <FieldRow label="Notes">
          <Textarea value={merged.notes ?? ""} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value || null as any }))} rows={2} className="text-xs" data-testid={`textarea-accrual-notes-${instanceId}`} disabled={inputsDisabled} />
        </FieldRow>
      </div>
      <HistoryDrawer instanceId={instanceId} kind="accrual" open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

function SettlementPolicyEditor({ instanceId, isLocked }: { instanceId: string; isLocked: boolean }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SettlementBundle>({
    queryKey: ["/api/subtype-instances", instanceId, "settlement-policy"],
  });

  type Draft = {
    policy?: any; paymentSchedule?: any; settlementMethod?: any;
    overpaymentHandling?: any; disputeHandling?: any; fxRule?: any;
  };
  const [draft, setDraft] = useState<Draft>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => { if (data) setDraft({}); }, [data?.policy?.id]);

  const dirty = Object.keys(draft).length > 0;
  const m = (section: keyof Draft) => ({ ...((data as any)?.[section] ?? {}), ...((draft as any)[section] ?? {}) });
  const set = (section: keyof Draft, field: string, value: any) =>
    setDraft(d => ({ ...d, [section]: { ...((d as any)[section] ?? {}), [field]: value } }));

  const saveMutation = useMutation({
    mutationFn: async (patch: Draft) => {
      const res = await apiRequest("PATCH", `/api/subtype-instances/${instanceId}/settlement-policy`, patch);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subtype-instances", instanceId, "settlement-policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subtype-instances", instanceId, "settlement-policy", "history"] });
      setDraft({});
      toast({ title: "Settlement policy saved", description: "A new version was created." });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-zinc-500 text-sm py-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!data) return <div className="text-sm text-zinc-500 py-3">No settlement policy yet.</div>;

  const ps = m("paymentSchedule"); const sm = m("settlementMethod"); const oh = m("overpaymentHandling"); const dh = m("disputeHandling"); const fx = m("fxRule"); const pol = m("policy");
  const inputsDisabled = isLocked || saveMutation.isPending;

  return (
    <div className="border border-zinc-200 rounded-lg bg-white" data-testid={`card-settlement-policy-${instanceId}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-zinc-500" />
          <h4 className="text-sm font-semibold text-zinc-800">Settlement Policy</h4>
          <VersionBadge v={data.policy.versionNum} />
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200" title={LOCK_TITLE}>
              <Lock className="h-2.5 w-2.5" /> Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
            data-testid={`button-history-settlement-${instanceId}`}
          >
            <History className="h-3 w-3" /> History
          </button>
          <button
            type="button"
            disabled={!dirty || inputsDisabled}
            onClick={() => saveMutation.mutate(draft)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:bg-zinc-200 disabled:text-zinc-500"
            data-testid={`button-save-settlement-${instanceId}`}
            title={isLocked ? LOCK_TITLE : undefined}
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save as new version
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-5" title={isLocked ? LOCK_TITLE : undefined}>
        {/* Payment Schedule */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1 inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Payment Schedule</h5>
          <FieldRow label="Cadence">
            <Select value={ps.cadence} onValueChange={(v) => set("paymentSchedule", "cadence", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-cadence-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{CADENCE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Payment Terms (days)">
            <Input type="number" value={ps.paymentTermsDays ?? 0} onChange={(e) => set("paymentSchedule", "paymentTermsDays", Number(e.target.value))} className="h-8 text-xs" data-testid={`input-payment-terms-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
          <FieldRow label="Payment Day">
            <Input type="number" value={ps.paymentDay ?? ""} onChange={(e) => set("paymentSchedule", "paymentDay", e.target.value === "" ? null : Number(e.target.value))} className="h-8 text-xs" placeholder="(e.g., 15)" data-testid={`input-payment-day-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
          <FieldRow label="True-Up Cadence">
            <Input value={ps.trueUpCadence ?? ""} onChange={(e) => set("paymentSchedule", "trueUpCadence", e.target.value || null)} className="h-8 text-xs" placeholder="(optional)" data-testid={`input-true-up-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
        </section>

        {/* Settlement Method */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1 inline-flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Settlement Method</h5>
          <FieldRow label="Method">
            <Select value={sm.method} onValueChange={(v) => set("settlementMethod", "method", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-method-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{METHOD_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Bank Account Ref">
            <Input value={sm.bankAccountRef ?? ""} onChange={(e) => set("settlementMethod", "bankAccountRef", e.target.value || null)} className="h-8 text-xs" data-testid={`input-bank-account-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
          <FieldRow label="Remit To">
            <Select value={sm.remitToParty ?? "counterparty"} onValueChange={(v) => set("settlementMethod", "remitToParty", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-remit-to-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{REMIT_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
        </section>

        {/* Overpayment Handling */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1 inline-flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Overpayment Handling</h5>
          <FieldRow label="Strategy">
            <Select value={oh.strategy} onValueChange={(v) => set("overpaymentHandling", "strategy", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-overpay-strategy-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{OVERPAY_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Threshold Amount">
            <Input type="number" step="0.01" value={oh.thresholdAmount ?? ""} onChange={(e) => set("overpaymentHandling", "thresholdAmount", e.target.value)} className="h-8 text-xs" data-testid={`input-overpay-threshold-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
        </section>

        {/* Dispute Handling */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1 inline-flex items-center gap-1.5"><Layers className="h-3 w-3" /> Dispute Handling</h5>
          <FieldRow label="Default Strategy">
            <Select value={dh.defaultStrategy} onValueChange={(v) => set("disputeHandling", "defaultStrategy", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-dispute-strategy-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{DISPUTE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Response SLA (days)">
            <Input type="number" value={dh.responseSlaDays ?? ""} onChange={(e) => set("disputeHandling", "responseSlaDays", e.target.value === "" ? null : Number(e.target.value))} className="h-8 text-xs" data-testid={`input-dispute-sla-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
          <FieldRow label="Escalation Contact">
            <Input value={dh.escalationContact ?? ""} onChange={(e) => set("disputeHandling", "escalationContact", e.target.value || null)} className="h-8 text-xs" data-testid={`input-escalation-contact-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
        </section>

        {/* FX Rule */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1 inline-flex items-center gap-1.5"><Globe className="h-3 w-3" /> FX Rule</h5>
          <FieldRow label="Rate Source">
            <Select value={fx.rateSource} onValueChange={(v) => set("fxRule", "rateSource", v)} disabled={inputsDisabled}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-fx-source-${instanceId}`}><SelectValue /></SelectTrigger>
              <SelectContent>{FX_SOURCE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Fixed Rate">
            <Input type="number" step="0.000001" value={fx.fixedRate ?? ""} onChange={(e) => set("fxRule", "fixedRate", e.target.value || null)} className="h-8 text-xs" placeholder="(only when source = fixed)" data-testid={`input-fx-fixed-rate-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
          <FieldRow label="Base Currency">
            <Input value={fx.baseCurrency ?? "USD"} onChange={(e) => set("fxRule", "baseCurrency", e.target.value || null)} className="h-8 text-xs" data-testid={`input-fx-base-currency-${instanceId}`} disabled={inputsDisabled} />
          </FieldRow>
        </section>

        {/* Policy notes */}
        <section>
          <h5 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1">Policy Notes</h5>
          <Textarea value={pol.notes ?? ""} onChange={(e) => set("policy", "notes", e.target.value || null)} rows={2} className="text-xs" data-testid={`textarea-settlement-notes-${instanceId}`} disabled={inputsDisabled} />
        </section>
      </div>
      <HistoryDrawer instanceId={instanceId} kind="settlement" open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

function InstanceCard({ instance, isLocked }: { instance: SubtypeInstance; isLocked: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-zinc-200 rounded-xl bg-zinc-50/50 overflow-hidden" data-testid={`card-instance-${instance.id}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100/60"
        data-testid={`button-toggle-instance-${instance.id}`}
      >
        {open ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-zinc-900" data-testid={`text-instance-label-${instance.id}`}>{instance.label}</div>
          <div className="text-[11px] text-zinc-500">
            <span className="font-mono">{instance.subtypeCode}</span>
            {instance.subtypeName ? ` · ${instance.subtypeName}` : ""}
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">{instance.status}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <AccrualPolicyEditor instanceId={instance.id} isLocked={isLocked} />
          <SettlementPolicyEditor instanceId={instance.id} isLocked={isLocked} />
        </div>
      )}
    </div>
  );
}

export default function PoliciesTab({ contractId, isLocked = false }: { contractId: string; isLocked?: boolean }) {
  const { data, isLoading } = useQuery<SubtypeInstance[]>({
    queryKey: ["/api/contracts", contractId, "subtype-instances"],
  });

  if (isLoading) {
    return (
      <div className="px-6 py-8 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading subtype instances…
      </div>
    );
  }
  const instances = Array.isArray(data) ? data : [];

  return (
    <div className="px-6 py-5 space-y-4" data-testid="container-policies-tab">
      <ContractLevelPoliciesHeader contractId={contractId} />

      <div className="text-xs text-zinc-500">
        Each subtype instance owns one Accrual Policy and one Settlement Policy. Editing either creates a new version — prior versions are preserved.
        {isLocked && <span className="ml-1 text-amber-700 font-medium">This contract is locked — open a change order to edit policies.</span>}
      </div>
      {instances.length === 0 ? (
        <div className="text-sm text-zinc-500 px-1" data-testid="text-policies-empty">
          No subtype instances exist for this contract yet. Instances are created automatically when the contract's rules are extracted.
        </div>
      ) : (
        instances.map(inst => <InstanceCard key={inst.id} instance={inst} isLocked={isLocked} />)
      )}
    </div>
  );
}
