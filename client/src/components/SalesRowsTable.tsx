import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Canonical row shape used wherever we render raw sales transactions for a
// contract (drill-down dialog today, /sales-upload row inspector tomorrow).
// Fields mirror the columns of the `sales_data` table (shared/schema.ts).
export type SalesRowRecord = {
  id: string;
  transactionDate: string;
  transactionId?: string | null;
  transactionType?: string | null;
  productCode?: string | null;
  productName?: string | null;
  category?: string | null;
  channel?: string | null;
  territory?: string | null;
  grossAmount?: string | number | null;
  quantity?: string | number | null;
  currency?: string | null;
};

export type SalesRowsTableProps = {
  rows: SalesRowRecord[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  /** When true (default), returns are visually distinguished from sales. */
  highlightReturns?: boolean;
  /** Optional cap; when reached, shows a truncation footer. */
  maxRows?: number;
  testId?: string;
};

const isReturnRow = (r: SalesRowRecord) =>
  String(r.transactionType || "").toLowerCase() === "return";

export const formatSalesMoney = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
};

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
};

/**
 * Tally a list of sales rows into sale vs. return buckets. Returns reflect
 * the absolute magnitude regardless of whether the source data stored them
 * as negative grossAmounts or positive values flagged as transactionType =
 * "return". Mirrors how the obligation-period breakdown excludes returns
 * from its slice total.
 */
export function tallySalesRows(rows: SalesRowRecord[]) {
  return rows.reduce(
    (acc, r) => {
      const amt = Math.abs(Number(r.grossAmount || 0));
      if (isReturnRow(r)) {
        acc.returnsCount += 1;
        acc.returnsAmount += amt;
      } else {
        acc.salesCount += 1;
        acc.salesAmount += amt;
      }
      return acc;
    },
    { salesCount: 0, salesAmount: 0, returnsCount: 0, returnsAmount: 0 },
  );
}

/**
 * Reusable, presentational sales-data table. The same table is intended for
 * any surface that needs to render raw transactions for a contract — today
 * the obligation-preview drill-down dialog, eventually the sales-upload page
 * row inspector. Renders sales and returns together, with returns visibly
 * distinguished (rose tint, "Return" badge, signed amount).
 */
export default function SalesRowsTable({
  rows,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyMessage = "No sales rows found.",
  onRetry,
  highlightReturns = true,
  maxRows,
  testId = "sales-rows-table",
}: SalesRowsTableProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-12"
        data-testid={`${testId}-loading`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sales rows…
      </div>
    );
  }
  if (isError) {
    return (
      <div
        className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded m-4 p-3"
        data-testid={`${testId}-error`}
      >
        {errorMessage || "Failed to load sales rows."}{" "}
        {onRetry && (
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        )}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div
        className="text-xs text-zinc-500 py-12 text-center"
        data-testid={`${testId}-empty`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <Table data-testid={testId}>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] uppercase tracking-wide w-24">Date</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Type</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Product</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Category</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Channel</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Territory</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide text-right">Qty</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const ret = isReturnRow(r);
            // Use absolute magnitude so callers that store returns as
            // negative grossAmount don't render as `--$X` (double-negative).
            const amt = Math.abs(Number(r.grossAmount || 0));
            const display = `${ret ? "-" : ""}${formatSalesMoney(amt, r.currency || "USD")}`;
            return (
              <TableRow
                key={r.id}
                className={ret && highlightReturns ? "bg-rose-50/60 hover:bg-rose-50" : ""}
                data-testid={`row-sale-${r.id}`}
                data-row-type={ret ? "return" : "sale"}
              >
                <TableCell className="text-xs tabular-nums">
                  {formatDate(r.transactionDate)}
                </TableCell>
                <TableCell className="text-xs">
                  {ret ? (
                    <Badge
                      variant="outline"
                      className="border-rose-300 bg-rose-100 text-rose-800 text-[10px] py-0 px-1.5"
                      data-testid={`badge-return-${r.id}`}
                    >
                      Return
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-zinc-200 bg-white text-zinc-700 text-[10px] py-0 px-1.5"
                    >
                      Sale
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium text-zinc-900 truncate max-w-[180px]">
                    {r.productName || "—"}
                  </div>
                  {r.productCode && (
                    <div className="text-[10px] text-zinc-500 truncate">{r.productCode}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-zinc-700">
                  {r.category || <span className="text-zinc-400">—</span>}
                </TableCell>
                <TableCell className="text-xs text-zinc-700">
                  {r.channel || <span className="text-zinc-400">—</span>}
                </TableCell>
                <TableCell className="text-xs text-zinc-700">
                  {r.territory || <span className="text-zinc-400">—</span>}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums text-zinc-700">
                  {r.quantity != null ? Number(r.quantity).toLocaleString() : "—"}
                </TableCell>
                <TableCell
                  className={`text-xs text-right tabular-nums font-medium ${ret ? "text-rose-700" : "text-zinc-900"}`}
                >
                  {display}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {typeof maxRows === "number" && rows.length >= maxRows && (
        <div
          className="px-5 py-2 border-t text-[11px] text-amber-800 bg-amber-50"
          data-testid={`${testId}-truncated`}
        >
          Showing the most recent {maxRows} rows. Refine your filters to see more.
        </div>
      )}
    </>
  );
}
