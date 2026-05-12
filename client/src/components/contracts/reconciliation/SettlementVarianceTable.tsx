import { Fragment } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { KPI_FORMATTERS } from "./kpiRegistry";

export interface SettlementVarianceRow {
  period: string;
  accrualAmount: number;
  claimAmount: number;
  variance: number;
  variancePct: number;
  status: string;
  notes: string | null;
  settlementId: string | null;
}

const { fmtMoney, fmtSignedMoney, fmtPct } = KPI_FORMATTERS;

function rowColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs > 3) return "text-rose-600";
  if (abs >= 1) return "text-amber-600";
  return "text-emerald-600";
}

function statusChipClass(status: string): string {
  if (status === "Matched") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Investigation") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function SettlementVarianceTable({
  rows,
  onInvestigate,
}: {
  rows: SettlementVarianceRow[];
  onInvestigate: (row: SettlementVarianceRow) => void;
}) {
  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-xs text-zinc-500" data-testid="text-variance-empty">
        No settlements have been reconciled for this contract yet.
      </div>
    );
  }
  return (
    <table className="w-full text-left text-sm" data-testid="table-settlement-variance">
      <thead>
        <tr className="border-b border-zinc-100 bg-zinc-50/50">
          <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Period</th>
          <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Our Accrual</th>
          <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Their Claim</th>
          <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Variance</th>
          <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map((row, i) => {
          const showInvestigateBanner = row.status === "Investigation" && (row.notes || row.settlementId);
          return (
            <Fragment key={`${row.period}-${i}`}>
              <tr
                className={`hover:bg-zinc-50 group ${row.settlementId ? "cursor-pointer" : ""}`}
                onClick={() => row.settlementId && onInvestigate(row)}
                data-testid={`row-variance-${row.period}`}
              >
                <td className="px-4 py-2 font-medium text-zinc-900">{row.period}</td>
                <td className="px-4 py-2 text-right">{fmtMoney(row.accrualAmount)}</td>
                <td className="px-4 py-2 text-right">{fmtMoney(row.claimAmount)}</td>
                <td className={`px-4 py-2 text-right font-medium ${rowColor(row.variancePct)}`}>
                  {fmtSignedMoney(row.variance)}{" "}
                  <span className="text-xs font-normal opacity-70">({fmtPct(row.variancePct)})</span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusChipClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                    {row.settlementId && (
                      <ChevronDown className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                </td>
              </tr>
              {showInvestigateBanner && (
                <tr className="bg-orange-50/30 border-b border-zinc-100">
                  <td colSpan={5} className="px-4 py-2 text-xs text-rose-700 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                    <span>
                      <span className="font-semibold">Investigation:</span>{" "}
                      {row.notes || "Variance exceeds 3% tolerance — review settlement detail."}
                    </span>
                    {row.settlementId && (
                      <button
                        className="ml-auto text-rose-600 underline text-[10px] font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvestigate(row);
                        }}
                        data-testid={`button-investigate-${row.period}`}
                      >
                        Open investigation
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
