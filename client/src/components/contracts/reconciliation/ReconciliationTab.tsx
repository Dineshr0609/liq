import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, RefreshCw, ArrowUpRight, Inbox, FileText, Wallet, Scale, Clock,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  getReconciliationKpis,
  KPI_FORMATTERS,
  type ReconciliationKpiSummary,
} from "./kpiRegistry";
import {
  SettlementVarianceTable,
  type SettlementVarianceRow,
} from "./SettlementVarianceTable";
import { VarianceInvestigationDrawer } from "./VarianceInvestigationDrawer";
import { CloseReadinessCard, type CloseReadinessItem } from "./CloseReadinessCard";

type PeriodCode = "mtd" | "qtd" | "ytd" | "trailing12" | "custom";

interface ReconciliationPayload {
  contract: {
    id: string;
    flowTypeCode: string | null;
    flowTypeName: string | null;
    cashDirection: "inbound" | "outbound" | "derived" | null;
    currency?: string | null;
    counterpartyName?: string | null;
  };
  period: { code: PeriodCode; label: string; start: string; end: string };
  kpis: ReconciliationKpiSummary & {
    lastGlSync: { at: string | null; status: string; jeId: string } | null;
  };
  settlementVarianceRows: SettlementVarianceRow[];
  accruals: Array<{
    id: string; accrualId: string; period: string; amount: number;
    status: string | null; createdAt: string | null;
  }>;
  obligations: Array<{
    id: string; kind: string; amount: number; outstandingAmount: number;
    currency: string | null; status: string; dueAt: string | null;
    agingDays: number | null; partnerName: string | null;
  }>;
  claims: Array<{
    id: string; claimNumber: string | null; claimType: string;
    partnerName: string | null; period: string | null;
    claimedAmount: number; approvedAmount: number;
    status: string; disputeState: string | null; createdAt: string | null;
  }>;
  invoices: Array<{
    id: string; documentNumber: string; documentType: string;
    period: string | null; amount: number; currency: string | null;
    status: string; createdAt: string | null;
  }>;
  journalEntries: Array<{
    id: string; jeId: string; period: string; totalAmount: number;
    jeStage: string | null; erpSyncStatus: string | null;
    updatedAt: string | null;
  }>;
  closeReadiness: CloseReadinessItem[];
  closeEtaMinutes: number;
}

const PERIOD_OPTIONS: Array<{ code: PeriodCode; label: string }> = [
  { code: "mtd", label: "MTD" },
  { code: "qtd", label: "QTD" },
  { code: "ytd", label: "YTD" },
  { code: "trailing12", label: "Trailing 12mo" },
];

const { fmtMoney } = KPI_FORMATTERS;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

const intentToValueClass = (intent: string): string => {
  if (intent === "bad") return "text-rose-600";
  if (intent === "warn") return "text-amber-600";
  if (intent === "good") return "text-emerald-700";
  return "text-zinc-900";
};

const accrualStatusDot = (status: string | null): string => {
  if (status === "approved" || status === "posted") return "bg-emerald-500";
  if (status === "review" || status === "pending" || status === "pending_review") return "bg-amber-500";
  return "bg-zinc-400";
};

const claimStatusChip = (status: string): { label: string; className: string } => {
  if (["approved", "settled", "partial_approved"].includes(status))
    return { label: "Approved", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (["received", "validating", "needs_review", "agent_handling"].includes(status))
    return { label: "Awaiting Response", className: "text-rose-700 bg-rose-100 border-rose-200" };
  if (["disputed", "escalated"].includes(status))
    return { label: status === "disputed" ? "Disputed" : "Escalated", className: "text-amber-700 bg-amber-50 border-amber-200" };
  if (status === "rejected")
    return { label: "Rejected", className: "text-zinc-700 bg-zinc-100 border-zinc-200" };
  return { label: status, className: "text-zinc-700 bg-zinc-100 border-zinc-200" };
};

const obligationAgingChip = (agingDays: number | null): { label: string; className: string } => {
  if (agingDays === null) return { label: "—", className: "bg-zinc-100 text-zinc-600" };
  if (agingDays <= 0) return { label: "Current", className: "bg-zinc-100 text-zinc-600" };
  if (agingDays <= 30) return { label: "1-30 days late", className: "bg-amber-100 text-amber-700 border border-amber-200" };
  if (agingDays <= 60) return { label: "31-60 days late", className: "bg-rose-100 text-rose-700 border border-rose-200" };
  return { label: "60+ days late", className: "bg-rose-200 text-rose-800 border border-rose-300" };
};

export function ReconciliationTab({ contractId }: { contractId: string }) {
  const [period, setPeriod] = useState<PeriodCode>("ytd");
  const [drawerRow, setDrawerRow] = useState<SettlementVarianceRow | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ReconciliationPayload>({
    queryKey: ["/api/contracts", contractId, "reconciliation", { period }],
    queryFn: async () => {
      const r = await fetch(`/api/contracts/${contractId}/reconciliation?period=${period}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      return r.json();
    },
  });

  const tiles = useMemo(() => {
    if (!data) return [];
    return getReconciliationKpis(
      { flowTypeCode: data.contract.flowTypeCode, cashDirection: data.contract.cashDirection },
      data.kpis,
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="px-6 py-12 flex items-center gap-2 text-sm text-zinc-500" data-testid="loading-reconciliation">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reconciliation…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-6 py-12 text-sm text-rose-600" data-testid="error-reconciliation">
        Failed to load reconciliation: {(error as Error)?.message || "Unknown error"}
        <button
          onClick={() => refetch()}
          className="ml-3 text-xs px-2 py-1 rounded border border-rose-300 hover:bg-rose-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const lastSync = data.kpis.lastGlSync;

  return (
    <div className="px-6 py-5 space-y-5" data-testid="container-reconciliation-tab">
      {/* Controls strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-white border border-zinc-200 rounded-md p-1" data-testid="period-selector">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => setPeriod(opt.code)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                period === opt.code ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
              }`}
              data-testid={`button-period-${opt.code}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-500 flex items-center gap-3">
          {isFetching && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
            </span>
          )}
          {lastSync ? (
            <span className="inline-flex items-center gap-1.5" data-testid="text-last-gl-sync">
              <RefreshCw className="h-3.5 w-3.5" /> Last GL sync: {fmtDateTime(lastSync.at)} ({lastSync.status})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-600" data-testid="text-no-gl-sync">
              <RefreshCw className="h-3.5 w-3.5" /> No GL sync recorded
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-6 gap-3" data-testid="kpi-strip">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.key}
              className="bg-white border border-zinc-200 rounded-md p-3 flex flex-col justify-between hover:border-orange-300 hover:shadow-sm transition-all"
              data-testid={`kpi-${tile.key}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1 flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {tile.label}
              </div>
              <div className={`text-xl font-semibold mb-1 ${intentToValueClass(tile.intent)}`}>
                {tile.value}
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight line-clamp-2">{tile.sublabel}</div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-9 flex flex-col gap-5">
          {/* Settlement variance reconciliation */}
          <div className="bg-white border border-zinc-200 rounded-md flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Settlement Variance Reconciliation</h3>
              <span className="text-[11px] text-zinc-500">
                {data.settlementVarianceRows.length} period{data.settlementVarianceRows.length === 1 ? "" : "s"}
              </span>
            </div>
            <SettlementVarianceTable
              rows={data.settlementVarianceRows}
              onInvestigate={(row) => setDrawerRow(row)}
            />
          </div>

          {/* Accruals + Obligations */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white border border-zinc-200 rounded-md p-3" data-testid="card-open-accruals">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-zinc-400" /> Open Accruals
              </h3>
              {data.accruals.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">No open accruals.</div>
              ) : (
                <div className="space-y-2">
                  {data.accruals.map((a) => (
                    <div key={a.id} className="flex flex-col gap-1 pb-2 border-b border-zinc-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900">{a.period}</span>
                        <span className="text-sm font-medium text-zinc-900">{fmtMoney(a.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Created {fmtDate(a.createdAt)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${accrualStatusDot(a.status)}`} />
                          <span className="text-zinc-600 capitalize">{(a.status || "").replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-md p-3" data-testid="card-open-obligations">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-zinc-400" /> Open Obligations
              </h3>
              {data.obligations.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">No open obligations.</div>
              ) : (
                <div className="space-y-2">
                  {data.obligations.map((o) => {
                    const aging = obligationAgingChip(o.agingDays);
                    return (
                      <div key={o.id} className="flex flex-col gap-1 pb-2 border-b border-zinc-100 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900 capitalize">
                            {(o.kind || "").replace(/_/g, " ")}
                            {o.partnerName && (
                              <span className="text-[10px] text-zinc-500 ml-2">{o.partnerName}</span>
                            )}
                          </span>
                          <span className="text-sm font-medium text-zinc-900">{fmtMoney(o.outstandingAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            {o.dueAt ? `Due ${fmtDate(o.dueAt)}` : `Status: ${o.status}`}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${aging.className}`}>
                            {aging.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Claims + Invoices */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white border border-zinc-200 rounded-md p-3" data-testid="card-inbound-claims">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5 text-zinc-400" /> Inbound Claims
                </h3>
                <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                  {data.claims.length} active
                </span>
              </div>
              {data.claims.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">No claims received.</div>
              ) : (
                <div className="space-y-3">
                  {data.claims.slice(0, 4).map((c) => {
                    const chip = claimStatusChip(c.status);
                    const variance = c.approvedAmount - c.claimedAmount;
                    const variancePct = c.claimedAmount > 0 ? (variance / c.claimedAmount) * 100 : 0;
                    const tone = Math.abs(variancePct) > 1 ? "text-rose-600" : "text-emerald-600";
                    return (
                      <div
                        key={c.id}
                        className={`p-2.5 rounded border flex flex-col gap-1.5 ${
                          chip.label === "Awaiting Response" ? "border-rose-200 bg-rose-50/30" : "border-zinc-100 bg-zinc-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-900 truncate">
                              {c.claimNumber || c.claimType}
                              {c.partnerName && <span className="text-zinc-500"> · {c.partnerName}</span>}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Recv. {fmtDate(c.createdAt)}{c.period ? ` · ${c.period}` : ""}
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip.className}`}>
                            {chip.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                          <div>
                            <div className="text-[9px] text-zinc-500 uppercase">Claimed</div>
                            <div className="font-medium">{fmtMoney(c.claimedAmount)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-zinc-500 uppercase">Approved</div>
                            <div className="font-medium">{fmtMoney(c.approvedAmount)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-zinc-500 uppercase">Variance</div>
                            <div className={`font-medium ${tone}`}>
                              {variance >= 0 ? "+" : "-"}{fmtMoney(Math.abs(variance))}
                            </div>
                          </div>
                        </div>
                        {c.status === "settled" && (
                          <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Auto-matched within tolerance
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-md p-3 flex flex-col" data-testid="card-invoices-issued">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-zinc-400" /> Invoices Issued
              </h3>
              {data.invoices.length === 0 ? (
                <div className="flex-1 py-6 text-center text-xs text-zinc-500">No invoices issued.</div>
              ) : (
                <div className="flex-1 space-y-2">
                  {data.invoices.slice(0, 5).map((inv) => (
                    <div key={inv.id} className="flex flex-col gap-1 pb-2 border-b border-zinc-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900">{inv.documentNumber}</span>
                        <span className="text-sm font-medium text-zinc-900">{fmtMoney(inv.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 capitalize">
                          {(inv.documentType || "").replace(/_/g, " ")}{inv.period ? ` · ${inv.period}` : ""}
                        </span>
                        <span className="text-zinc-600 capitalize">{inv.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Journal entries */}
          <div className="bg-white border border-zinc-200 rounded-md" data-testid="card-journal-entries">
            <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" /> Journal Entries
              </h3>
              <span className="text-[11px] text-zinc-500">
                {data.journalEntries.length} recent · {data.kpis.unpostedJEs.count} unposted
              </span>
            </header>
            {data.journalEntries.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">No journal entries posted yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">JE</th>
                    <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Period</th>
                    <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Total</th>
                    <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Stage</th>
                    <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">ERP sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.journalEntries.map((j) => (
                    <tr key={j.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 font-mono text-xs">{j.jeId}</td>
                      <td className="px-4 py-2">{j.period}</td>
                      <td className="px-4 py-2 text-right">{fmtMoney(j.totalAmount)}</td>
                      <td className="px-4 py-2 capitalize text-xs">{j.jeStage || "—"}</td>
                      <td className="px-4 py-2 text-xs">
                        {j.erpSyncStatus === "synced" || j.erpSyncStatus === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> {j.erpSyncStatus}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Clock className="h-3 w-3" /> {j.erpSyncStatus || "pending"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="col-span-3 flex flex-col gap-5">
          <CloseReadinessCard items={data.closeReadiness} etaMinutes={data.closeEtaMinutes} />

          <div className="bg-white border border-zinc-200 rounded-md p-3" data-testid="card-gl-sync">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-zinc-400" /> GL Sync
            </h3>
            {lastSync ? (
              <div className="text-xs text-zinc-700 space-y-1">
                <div>
                  <span className="text-zinc-500">Last sync:</span>{" "}
                  <span className="font-medium text-zinc-900">{fmtDateTime(lastSync.at)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Status:</span>{" "}
                  <span className="font-medium text-emerald-700 capitalize">{lastSync.status}</span>
                </div>
                <div className="font-mono text-[10px] text-zinc-500">{lastSync.jeId}</div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>No journal entry has been synced to the ERP yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <VarianceInvestigationDrawer
        row={drawerRow}
        open={!!drawerRow}
        onOpenChange={(next) => !next && setDrawerRow(null)}
      />
    </div>
  );
}

export default ReconciliationTab;
