import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface AdjustmentRow {
  id: string; source: "accrual_audit" | "recoupment_ledger" | "obligation_event";
  date: string; description: string | null; amount: string | null; refId: string | null; user: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  accrual_audit: "Accrual Audit",
  recoupment_ledger: "Recoupment",
  obligation_event: "Obligation",
};

export function AdjustmentsTab() {
  const { data, isLoading } = useQuery<AdjustmentRow[]>({ queryKey: ["/api/finance/adjustments"] });
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const filtered = useMemo(() => (data || []).filter(r => {
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    if (search && !((r.description || "") + (r.refId || "")).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [data, search, sourceFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search adjustments…" className="w-64 pl-9" data-testid="input-adjustments-search" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48" data-testid="select-adjustments-source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="accrual_audit">Accrual Audit</SelectItem>
            <SelectItem value="recoupment_ledger">Recoupment</SelectItem>
            <SelectItem value="obligation_event">Obligation</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">No adjustments recorded.</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-neutral-100" data-testid={`row-adjustment-${r.id}`}>
                  <td className="px-3 py-2 text-xs">{new Date(r.date).toLocaleString()}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[r.source] || r.source}</Badge></td>
                  <td className="px-3 py-2">{r.description || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.refId || "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.amount ? `$${Number(r.amount).toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{r.user || "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
