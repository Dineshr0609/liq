import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";

type Calculation = {
  id: string;
  totalRoyalty?: string | number | null;
  totalSalesAmount?: string | number | null;
  currency?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

type CalcsResponse = {
  calculations: Calculation[];
  total: number;
};

const MONTHS_BACK = 6;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function flowTypeLabel(code?: string | null): string {
  if (!code) return "Unset profile";
  return code
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ") + " profile";
}

export function PerformanceTile({
  contractId,
  contract,
  onOpenTab,
}: {
  contractId: string;
  contract: any;
  onOpenTab?: (tab: string) => void;
}) {
  const calcsQuery = useQuery<CalcsResponse>({
    queryKey: ["/api/contracts", contractId, "royalty-calculations"],
    queryFn: async () => {
      const r = await fetch(`/api/contracts/${contractId}/royalty-calculations`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load calculations");
      return r.json();
    },
  });

  const currency = contract?.currency || "USD";

  const { bars, trailingTotal, trailingCount } = useMemo(() => {
    const calcs = calcsQuery.data?.calculations ?? [];
    // Bucket by period_end month for the last MONTHS_BACK months ending today.
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: monthLabel(d), total: 0 });
    }
    const earliest = buckets[0]
      ? new Date(buckets[0].key + "-01")
      : null;
    let trailingTotal = 0;
    let trailingCount = 0;
    for (const c of calcs) {
      const ref = c.periodEnd || c.createdAt;
      if (!ref) continue;
      const d = new Date(ref);
      if (Number.isNaN(d.getTime())) continue;
      if (earliest && d < earliest) continue;
      const k = monthKey(d);
      const amt = Number(c.totalRoyalty ?? 0);
      const target = buckets.find((b) => b.key === k);
      if (target) target.total += amt;
      trailingTotal += amt;
      trailingCount += 1;
    }
    const max = Math.max(1, ...buckets.map((b) => b.total));
    const bars = buckets.map((b) => ({
      ...b,
      heightPct: Math.round((b.total / max) * 100),
    }));
    return { bars, trailingTotal, trailingCount };
  }, [calcsQuery.data]);

  const hasAny = (calcsQuery.data?.calculations?.length ?? 0) > 0;

  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden"
      data-testid="card-performance"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-900">Performance</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium border border-orange-100">
            {flowTypeLabel(contract?.flowTypeCode)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium border border-zinc-200">
            Trailing 6 mo
          </span>
        </div>
        <button
          onClick={() => onOpenTab?.("ledger")}
          className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5"
          data-testid="button-open-ledger"
        >
          Open in Ledger <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>

      {calcsQuery.isLoading ? (
        <div className="p-8 flex items-center justify-center text-xs text-zinc-500" data-testid="text-performance-loading">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading performance…
        </div>
      ) : !hasAny ? (
        <div className="p-8 text-center" data-testid="text-performance-empty">
          <div className="text-sm font-medium text-zinc-700">
            Awaiting first period close
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Once calculations land, trailing fees and a 6-month bar chart will
            appear here.
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-12 gap-4">
          {/* Headline numbers */}
          <div className="col-span-4 flex flex-col justify-center" data-testid="block-performance-summary">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
              Trailing 6 mo total
            </div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1" data-testid="text-trailing-total">
              {formatMoney(trailingTotal, currency)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              across {trailingCount} {trailingCount === 1 ? "calculation" : "calculations"}
            </div>
          </div>

          {/* Mini bar chart */}
          <div className="col-span-8" data-testid="block-performance-bars">
            <div className="flex items-end gap-2 h-28">
              {bars.map((b) => (
                <div key={b.key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-24 flex items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300"
                      style={{ height: `${Math.max(2, b.heightPct)}%` }}
                      title={formatMoney(b.total, currency)}
                      data-testid={`bar-${b.key}`}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
