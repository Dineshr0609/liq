import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  Activity,
  AlertTriangle,
  Inbox,
  Layers,
  CheckCircle2,
} from "lucide-react";
import {
  getPerformanceKpis,
  PERF_FORMATTERS,
  type PerformanceKpiSummary,
  type PerformanceKpiTile,
} from "./performanceKpiRegistry";

type PeriodCode = "mtd" | "qtd" | "ytd" | "trailing12" | "custom";

interface TrendBucket {
  monthKey: string;
  monthLabel: string;
  fees: number;
  sales: number;
  calcCount: number;
}

interface TopRule {
  ruleId: string | null;
  ruleName: string;
  ruleType: string;
  totalFee: number;
  totalSales: number;
  transactionCount: number;
  calcCount: number;
  sharePct: number;
}

interface RecentRun {
  id: string;
  runDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmount: number;
  status: string;
  evaluationMode: string | null;
  approvedAt: string | null;
}

interface PerformancePayload {
  contract: {
    id: string;
    contractNumber: string | null;
    displayName: string | null;
    originalName: string | null;
    status: string | null;
    currency: string;
    flowTypeCode: string | null;
    flowTypeName: string | null;
    cashDirection: "inbound" | "outbound" | "derived";
    counterpartyName: string | null;
  };
  period: { code: PeriodCode; label: string; start: string; end: string };
  kpis: PerformanceKpiSummary;
  trend: TrendBucket[];
  topRules: TopRule[];
  recentRuns: RecentRun[];
}

const PERIOD_OPTIONS: Array<{ code: PeriodCode; label: string }> = [
  { code: "mtd", label: "MTD" },
  { code: "qtd", label: "QTD" },
  { code: "ytd", label: "YTD" },
  { code: "trailing12", label: "Trailing 12mo" },
];

const { fmtMoney, fmtPct } = PERF_FORMATTERS;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function statusTone(status: string): { bg: string; text: string; ring: string } {
  const s = (status || "").toLowerCase();
  if (["approved", "completed", "paid", "settled", "posted"].includes(s))
    return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (["failed", "error", "errored", "rejected"].includes(s))
    return { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" };
  if (["draft", "pending_approval", "pending"].includes(s))
    return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
  return { bg: "bg-zinc-100", text: "text-zinc-700", ring: "ring-zinc-200" };
}

interface PerformanceTabProps {
  contractId: string;
}

export default function PerformanceTab({ contractId }: PerformanceTabProps) {
  const [period, setPeriod] = useState<PeriodCode>("ytd");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<PerformancePayload>({
    queryKey: ["/api/contracts", contractId, "performance", period],
  });

  const kpis: PerformanceKpiTile[] = useMemo(() => {
    if (!data) return [];
    return getPerformanceKpis(data.contract.flowTypeCode, data.kpis, data.contract.currency);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="tab-content-performance-loading">
        <Loader2 className="h-6 w-6 text-orange-600 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800"
        data-testid="tab-content-performance-error"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">Performance load failed</span>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs px-3 py-1.5 rounded border border-rose-300 hover:bg-rose-100 inline-flex items-center gap-1"
          data-testid="button-performance-retry"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  const currency = data.contract.currency;

  return (
    <div className="space-y-4" data-testid="tab-content-performance">
      {/* Header / period selector */}
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold text-zinc-900">Performance</h2>
          <span className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">
            {data.contract.flowTypeName || data.contract.flowTypeCode || "—"} · {data.contract.cashDirection}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-white border border-zinc-200 rounded-md overflow-hidden text-[11px]">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => setPeriod(opt.code)}
                className={`px-3 py-1.5 font-semibold border-r border-zinc-200 last:border-r-0 ${
                  period === opt.code
                    ? "bg-orange-600 text-white"
                    : "text-zinc-700 hover:bg-orange-50 hover:text-orange-700"
                }`}
                data-testid={`button-period-${opt.code}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="text-[11px] px-2 py-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1 text-zinc-600"
            data-testid="button-performance-refresh"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <section
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
        data-testid="kpi-strip-performance"
      >
        {kpis.map((tile) => {
          const Icon = tile.icon;
          const intentRing =
            tile.intent === "good"
              ? "ring-emerald-100"
              : tile.intent === "warn"
                ? "ring-amber-100"
                : tile.intent === "bad"
                  ? "ring-rose-100"
                  : "ring-zinc-100";
          const intentIcon =
            tile.intent === "good"
              ? "text-emerald-600"
              : tile.intent === "warn"
                ? "text-amber-600"
                : tile.intent === "bad"
                  ? "text-rose-600"
                  : "text-zinc-400";
          const deltaTone =
            tile.deltaTone === "good"
              ? "text-emerald-700"
              : tile.deltaTone === "bad"
                ? "text-rose-700"
                : "text-zinc-500";
          return (
            <div
              key={tile.key}
              className={`bg-white rounded-lg border border-zinc-200 ring-1 ${intentRing} p-3 flex flex-col gap-1`}
              data-testid={`kpi-tile-${tile.key}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">
                  {tile.label}
                </span>
                <Icon className={`h-3.5 w-3.5 ${intentIcon}`} />
              </div>
              <div className="text-lg font-bold text-zinc-900 leading-tight" data-testid={`kpi-value-${tile.key}`}>
                {tile.value}
              </div>
              {tile.sublabel && (
                <div className="text-[11px] text-zinc-500">{tile.sublabel}</div>
              )}
              {tile.deltaLabel && (
                <div className={`text-[11px] font-semibold ${deltaTone}`}>
                  {tile.deltaLabel}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Trend chart */}
      <TrendChart trend={data.trend} currency={currency} />

      {/* Top rules + Recent runs side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopRulesCard rules={data.topRules} currency={currency} />
        <RecentRunsCard runs={data.recentRuns} currency={currency} />
      </div>
    </div>
  );
}

// ---------------- Trend chart ----------------

function TrendChart({ trend, currency }: { trend: TrendBucket[]; currency: string }) {
  const maxFees = Math.max(1, ...trend.map((t) => t.fees));
  const totalFees = trend.reduce((s, t) => s + t.fees, 0);
  const totalCalcs = trend.reduce((s, t) => s + t.calcCount, 0);

  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
      data-testid="card-trend-chart"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">12-month trend</h3>
        </div>
        <div className="text-[11px] text-zinc-500">
          {fmtMoney(totalFees, currency)} across {totalCalcs} {totalCalcs === 1 ? "calc" : "calcs"}
        </div>
      </header>
      {totalCalcs === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500">
          No closed periods in the last 12 months.
        </div>
      ) : (
        <div className="p-4">
          <div
            className="grid items-end gap-2 h-40"
            style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}
          >
            {trend.map((b) => {
              const heightPct = b.fees > 0 ? Math.max(4, (b.fees / maxFees) * 100) : 0;
              return (
                <div
                  key={b.monthKey}
                  className="flex flex-col justify-end h-full group relative"
                  data-testid={`trend-bar-${b.monthKey}`}
                >
                  <div
                    className={`w-full rounded-sm transition-all ${
                      b.fees > 0
                        ? "bg-orange-500 group-hover:bg-orange-600"
                        : "bg-zinc-100"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: b.fees > 0 ? "4px" : "0" }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap z-10">
                    <div className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-lg">
                      <div className="font-semibold">{b.monthLabel}</div>
                      <div>{fmtMoney(b.fees, currency)}</div>
                      <div className="text-zinc-300">
                        {b.calcCount} {b.calcCount === 1 ? "calc" : "calcs"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="grid gap-2 mt-2"
            style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}
          >
            {trend.map((b) => (
              <div
                key={`label-${b.monthKey}`}
                className="text-[9px] text-zinc-400 text-center font-medium"
              >
                {b.monthLabel.split(" ")[0]}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------- Top rules ----------------

function TopRulesCard({ rules, currency }: { rules: TopRule[]; currency: string }) {
  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
      data-testid="card-top-rules"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Top contributing rules</h3>
        </div>
        <span className="text-[11px] text-zinc-500">In selected period</span>
      </header>
      {rules.length === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
          <Inbox className="h-6 w-6 text-zinc-300" />
          No rule contributions in this period.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {rules.map((r) => (
            <div
              key={r.ruleId || r.ruleName}
              className="px-4 py-2.5 flex items-center gap-3"
              data-testid={`row-rule-${r.ruleId || r.ruleName}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-900 truncate" title={r.ruleName}>
                  {r.ruleName}
                </div>
                <div className="text-[10px] text-zinc-500">
                  <span className="uppercase tracking-wide font-semibold mr-2">{r.ruleType}</span>
                  {r.transactionCount.toLocaleString()} tx · {r.calcCount}{" "}
                  {r.calcCount === 1 ? "calc" : "calcs"}
                </div>
                <div className="mt-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500"
                    style={{ width: `${Math.min(100, Math.max(2, r.sharePct))}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-zinc-900 tabular-nums">
                  {fmtMoney(r.totalFee, currency)}
                </div>
                <div className="text-[10px] text-zinc-500">{fmtPct(r.sharePct, 1)} share</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------- Recent runs ----------------

function RecentRunsCard({ runs, currency }: { runs: RecentRun[]; currency: string }) {
  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
      data-testid="card-recent-runs"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Recent calculation runs</h3>
        </div>
        <span className="text-[11px] text-zinc-500">Last {runs.length}</span>
      </header>
      {runs.length === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
          <Inbox className="h-6 w-6 text-zinc-300" />
          No calculation runs yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Run date</th>
                <th className="text-left px-4 py-2 font-semibold">Period</th>
                <th className="text-right px-4 py-2 font-semibold">Amount</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {runs.map((r) => {
                const tone = statusTone(r.status);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-zinc-50"
                    data-testid={`row-run-${r.id}`}
                  >
                    <td className="px-4 py-2 text-zinc-700 tabular-nums whitespace-nowrap">
                      {fmtDate(r.runDate)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 whitespace-nowrap">
                      {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-zinc-900">
                      {fmtMoney(r.totalAmount, currency)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tone.bg} ${tone.text} ring-1 ${tone.ring}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
