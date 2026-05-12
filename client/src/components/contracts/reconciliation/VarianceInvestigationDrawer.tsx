import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import type { SettlementVarianceRow } from "./SettlementVarianceTable";
import { KPI_FORMATTERS } from "./kpiRegistry";

const { fmtMoney, fmtSignedMoney, fmtPct } = KPI_FORMATTERS;

interface SettlementDetail {
  id: string;
  period: string | null;
  counterparty: string | null;
  accrualAmount: string | number | null;
  claimAmount: string | number | null;
  variance: string | number | null;
  matchStatus: string | null;
  settlementStatus: string | null;
  disputeState: string | null;
  disputeReason: string | null;
  resolution: string | null;
  aiAnalysis: string | null;
  lineItems?: Array<{
    id: string;
    category: string | null;
    lineName: string | null;
    accrualAmount: string | number | null;
    claimAmount: string | number | null;
    variance: string | number | null;
    status: string | null;
  }>;
}

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export function VarianceInvestigationDrawer({
  row,
  open,
  onOpenChange,
}: {
  row: SettlementVarianceRow | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const settlementId = row?.settlementId;
  const { data: detail, isLoading } = useQuery<SettlementDetail>({
    queryKey: ["/api/settlements", settlementId],
    enabled: !!settlementId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[640px] !max-w-[640px] overflow-y-auto"
        data-testid="drawer-variance-investigation"
      >
        <SheetHeader className="pb-4 border-b border-zinc-200">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Variance investigation — {row?.period || "—"}
          </SheetTitle>
          <SheetDescription>
            Side-by-side breakdown of our calculation vs the partner's claim
            for this settlement period.
          </SheetDescription>
        </SheetHeader>

        {!settlementId && (
          <div className="py-8 text-sm text-zinc-500 text-center" data-testid="text-no-settlement">
            No settlement record is linked to this period yet.
          </div>
        )}

        {isLoading && settlementId && (
          <div className="py-8 flex items-center gap-2 text-sm text-zinc-500 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settlement…
          </div>
        )}

        {detail && (
          <div className="py-4 space-y-4">
            {/* Summary numbers */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-zinc-200 rounded-md p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Our accrual</div>
                <div className="text-lg font-semibold text-zinc-900">{fmtMoney(num(detail.accrualAmount))}</div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-md p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Their claim</div>
                <div className="text-lg font-semibold text-zinc-900">{fmtMoney(num(detail.claimAmount))}</div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-md p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Variance</div>
                <div className={`text-lg font-semibold ${row && Math.abs(row.variancePct) > 1 ? "text-rose-600" : "text-emerald-600"}`}>
                  {fmtSignedMoney(num(detail.variance))}
                  {row && (
                    <span className="text-xs font-normal text-zinc-500 ml-1">({fmtPct(row.variancePct)})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status / dispute */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Match status</span>
                <span className="font-medium text-zinc-900">{detail.matchStatus || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Settlement status</span>
                <span className="font-medium text-zinc-900">{detail.settlementStatus || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Dispute state</span>
                <span className="font-medium text-zinc-900">{detail.disputeState || "none"}</span>
              </div>
            </div>

            {detail.disputeReason && (
              <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800">
                <div className="font-semibold uppercase tracking-wide text-[10px] mb-1">Dispute reason</div>
                {detail.disputeReason}
              </div>
            )}

            {detail.aiAnalysis && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-xs text-orange-900">
                <div className="font-semibold uppercase tracking-wide text-[10px] mb-1">AI analysis</div>
                {detail.aiAnalysis}
              </div>
            )}

            {detail.resolution && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold uppercase tracking-wide text-[10px] mb-1">Resolution</div>
                  {detail.resolution}
                </div>
              </div>
            )}

            {/* Line item breakdown */}
            <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
              <header className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Line items</h4>
              </header>
              {detail.lineItems && detail.lineItems.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50/60 border-b border-zinc-100">
                      <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Line</th>
                      <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Our calc</th>
                      <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Their claim</th>
                      <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.lineItems.map((li) => {
                      const v = num(li.variance);
                      const tone = Math.abs(v) > 0 ? (v > 0 ? "text-amber-600" : "text-rose-600") : "text-zinc-700";
                      return (
                        <tr key={li.id}>
                          <td className="px-3 py-1.5 text-zinc-900">
                            <div className="font-medium">{li.lineName || "(unlabeled)"}</div>
                            {li.category && <div className="text-[10px] text-zinc-500">{li.category}</div>}
                          </td>
                          <td className="px-3 py-1.5 text-right">{fmtMoney(num(li.accrualAmount))}</td>
                          <td className="px-3 py-1.5 text-right">{fmtMoney(num(li.claimAmount))}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${tone}`}>{fmtSignedMoney(v)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-zinc-500">
                  No line item breakdown captured for this settlement.
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
