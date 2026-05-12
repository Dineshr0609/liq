import { useMemo, useState } from "react";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalPanel } from "@/components/finance/approval-panel";
import { ShieldCheck, Inbox, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingRow {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  amount: string | null;
  currency: string | null;
  currentStep: number;
  requestedAt: string | null;
  step?: { label: string | null; approverRole: string };
}

const entityHrefs: Record<string, (id: string) => string> = {
  claim: (id) => `/claims-workspace?focus=${id}`,
  document: (id) => `/invoices-memos?focus=${id}`,
  deduction: (id) => `/deductions-workspace?focus=${id}`,
};

export default function ApprovalsInbox() {
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery<PendingRow[]>({
    queryKey: ["/api/finance/approvals/pending"],
    refetchInterval: 15_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PendingRow[]>();
    for (const r of q.data || []) {
      const arr = map.get(r.entityType) || [];
      arr.push(r);
      map.set(r.entityType, arr);
    }
    return map;
  }, [q.data]);

  const totalCount = q.data?.length ?? 0;

  return (
    <MainLayout
      title="Approvals Inbox"
      description="Pending finance approvals across claims, memos, and deductions."
    >
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-orange-600" />
              My Pending Approvals
              <Badge variant="outline" className="ml-2">{totalCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {q.isLoading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!q.isLoading && totalCount === 0 && (
              <div className="flex flex-col items-center py-8 text-neutral-500">
                <Inbox className="mb-2 h-8 w-8 text-neutral-300" />
                <div className="text-sm">Nothing waiting on you.</div>
                <div className="text-xs text-neutral-400">New requests will appear here automatically.</div>
              </div>
            )}
            {totalCount > 0 && (
              <div className="space-y-4">
                {Array.from(grouped.entries()).map(([entityType, rows]) => (
                  <div key={entityType}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      {entityType}s · {rows.length}
                    </div>
                    <div className="space-y-2">
                      {rows.map(r => (
                        <div key={r.id} className={cn(
                          "rounded-md border border-neutral-200 bg-white",
                          openId === r.id ? "ring-1 ring-orange-300" : "",
                        )}>
                          <button
                            data-testid={`row-approval-${r.id}`}
                            onClick={() => setOpenId(openId === r.id ? null : r.id)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-neutral-900">{r.entityLabel || r.entityId}</div>
                              <div className="text-[11px] text-neutral-500">
                                Step {r.currentStep} · {r.step?.label || r.step?.approverRole || "—"}
                                {r.requestedAt && ` · requested ${new Date(r.requestedAt).toLocaleString()}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-neutral-900">
                                {r.currency || "USD"} {Number(r.amount || 0).toLocaleString()}
                              </div>
                            </div>
                            {entityHrefs[r.entityType] && (
                              <Link href={entityHrefs[r.entityType](r.entityId)}>
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={e => e.stopPropagation()}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                          </button>
                          {openId === r.id && (
                            <div className="border-t border-neutral-100 bg-neutral-50 p-3">
                              <ApprovalPanel entityType={r.entityType as any} entityId={r.entityId} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
