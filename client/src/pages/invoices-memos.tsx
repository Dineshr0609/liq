import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { WorkspaceShell, FilterChip, QueueGroup } from "@/components/finance/workspace-shell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PartnerPicker } from "@/components/finance/partner-picker";
import { PeriodPicker } from "@/components/finance/period-currency-pickers";
import { KpiStrip } from "@/components/finance/kpi-strip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash, Pencil } from "lucide-react";

interface FinanceDoc {
  id: string; documentNumber: string; documentType: string;
  partnerName: string | null; contractName: string | null; period: string | null;
  amount: string; currency: string | null; status: string;
  oracleDocNumber: string | null; oracleStatus: string | null;
  accrualDate: string | null; createdAt: string;
}

const TABS = [
  { key: "ap_invoice", label: "AP Invoices" },
  { key: "ar_invoice", label: "AR Invoices" },
  { key: "credit_memo", label: "Credit Memos" },
  { key: "debit_memo", label: "Debit Memos" },
];

export default function InvoicesMemos() {
  const { toast } = useToast();
  const [tab, setTab] = useState("ap_invoice");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  // Use a stable key prefix so cache invalidation by ["/api/finance/documents"] hits this query.
  const docsQ = useQuery<FinanceDoc[]>({
    queryKey: ["/api/finance/documents", { type: tab }],
    queryFn: async () => (await fetch(`/api/finance/documents?type=${encodeURIComponent(tab)}`, { credentials: "include" })).json(),
  });

  // Deep-link support — `?docId=…` (and optional `?type=credit_memo`) lets
  // sister workspaces (Settlement, Claims) hop directly to a specific
  // document. We switch the tab first if the doc lives under a different
  // type than the one currently shown, then select it once the list loads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    // Accept both `?docId=` (legacy) and `?focus=` (period-close
    // Worksheet uses focus everywhere for consistency).
    const docId = url.searchParams.get("focus") || url.searchParams.get("docId");
    const type = url.searchParams.get("type");
    if (type && TABS.some((t) => t.key === type) && type !== tab) setTab(type);
    if (docId && docId !== selectedId) setSelectedId(docId);
    if (docId) {
      url.searchParams.delete("focus");
      url.searchParams.delete("docId");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      setTimeout(() => {
        const el = document.querySelector(`[data-testid="queue-item-${docId}"]`);
        if (el && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
    // We intentionally only run on mount — subsequent navigations within
    // the page should keep the user's current selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const detailQ = useQuery<any>({ queryKey: ["/api/finance/documents", selectedId], enabled: !!selectedId });
  // Fetch the linked source claim by id whenever the doc detail loads. This
  // is what powers the "Source claim" badge in the dialog and the Linked
  // Records tab — so the user can always see exactly which claim a doc
  // is mapped to (number, status, amount) without having to trust a UUID.
  const sourceClaimId: string | undefined = detailQ.data?.sourceClaimId || undefined;
  const sourceClaimQ = useQuery<any>({
    queryKey: ["/api/finance/inbound-claims", sourceClaimId],
    enabled: !!sourceClaimId,
  });

  const filteredDocs = useMemo(() => {
    const all = docsQ.data || [];
    return all.filter(d => {
      if (search && !((d.partnerName || "") + (d.documentNumber || "")).toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.includes("draft") && d.status !== "draft") return false;
      if (filters.includes("awaiting_oracle") && d.status !== "awaiting_oracle") return false;
      if (filters.includes("posted") && d.status !== "posted") return false;
      return true;
    });
  }, [docsQ.data, search, filters]);

  const groups: QueueGroup<FinanceDoc>[] = [
    { key: "draft", label: "Draft", tone: "agent", items: filteredDocs.filter(d => d.status === "draft") },
    { key: "in_flight", label: "In Flight", tone: "standard", items: filteredDocs.filter(d => d.status === "sent" || d.status === "awaiting_oracle") },
    { key: "posted", label: "Posted / Paid", tone: "standard", items: filteredDocs.filter(d => d.status === "posted" || d.status === "paid") },
    { key: "voided", label: "Voided", tone: "standard", items: filteredDocs.filter(d => d.status === "voided") },
  ];

  const filterChips: FilterChip[] = [
    { key: "draft", label: "Draft" },
    { key: "awaiting_oracle", label: "Awaiting Oracle" },
    { key: "posted", label: "Posted" },
  ];

  const transitionMut = useMutation({
    mutationFn: async (vars: { id: string; action: string }) =>
      (await apiRequest("POST", `/api/finance/documents/${vars.id}/transition`, { action: vars.action })).json(),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/documents"] });
      // The doc state machine has a side-effect on `→ posted`: it also flips
      // any fully-matched settlement attached to this doc's source claim
      // from `approved` (Pending GL Post) → `posted`. Invalidate the
      // adjacent caches so Settlement Workspace, Claims Workspace, and
      // Financial Control Center reflect the close-out without requiring
      // a manual refresh.
      if (vars.action === "mark_oracle_posted") {
        queryClient.invalidateQueries({ queryKey: ["/api/settlements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/finance/inbound-claims"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/financial-control-center"] });
        queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      }
      toast({ title: "Document updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const selected = filteredDocs.find(d => d.id === selectedId) || null;

  const oracleQ = useQuery<{ connected: boolean; lastSyncAt: string | null; lastError: string | null; awaitingOracle: number; sent: number; posted: number }>({
    queryKey: ["/api/finance/oracle-status"], refetchInterval: 15000,
  });

  // Per-tab KPIs computed from the docs query so they reflect the active
  // tab. "Overdue" is approximated as in-flight (sent / awaiting_oracle) for
  // more than 7 days — adjust once we have real due-date logic.
  const tabKpis = useMemo(() => {
    const all = docsQ.data || [];
    const open = all.filter(d => !["paid","voided"].includes(d.status));
    const draft = all.filter(d => d.status === "draft").length;
    const awaiting = all.filter(d => d.status === "awaiting_oracle" || d.status === "sent").length;
    const exposure = open.reduce((s, d) => s + Number(d.amount || 0), 0);
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const overdue = all.filter(d => (d.status === "sent" || d.status === "awaiting_oracle") && new Date(d.createdAt).getTime() < cutoff).length;
    return { openCount: open.length, draft, awaiting, exposure, overdue };
  }, [docsQ.data]);

  const oracleBadge = (() => {
    if (!oracleQ.data) return { label: "Oracle: …", tone: "neutral" as const, hint: "checking…" };
    if (oracleQ.data.lastError) return { label: "Oracle: Error", tone: "urgent" as const, hint: oracleQ.data.lastError };
    if (!oracleQ.data.connected) return { label: "Oracle: Not Connected", tone: "warning" as const, hint: "ERP integration not configured" };
    return { label: "Oracle: Live", tone: "good" as const, hint: oracleQ.data.lastSyncAt ? `last sync ${new Date(oracleQ.data.lastSyncAt).toLocaleString()}` : "no syncs yet" };
  })();

  return (
    <MainLayout title="Invoices & Memos" description="AP invoices, AR invoices, credit memos, and debit memos.">
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedId(null); }}>
        <TabsList className="mb-2">
          {TABS.map(t => <TabsTrigger key={t.key} value={t.key} data-testid={`tab-${t.key}`}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map(t => (
          <TabsContent key={t.key} value={t.key}>
            <WorkspaceShell
              kpiStrip={
                <KpiStrip
                  kpis={[
                    { key: "open", label: `Open ${t.label}`, value: tabKpis.openCount, hint: `${tabKpis.draft} draft` },
                    { key: "exposure", label: t.key === "ap_invoice" ? "Total Payable" : t.key === "ar_invoice" ? "Total Receivable" : "Total Amount", value: `$${Math.round(tabKpis.exposure).toLocaleString()}` },
                    { key: "awaiting", label: "Awaiting Oracle", value: tabKpis.awaiting, tone: tabKpis.awaiting > 0 ? "warning" : "neutral" },
                    { key: "overdue", label: "In-flight > 7 days", value: tabKpis.overdue, tone: tabKpis.overdue > 0 ? "urgent" : "neutral", hint: "stale syncs" },
                  ]}
                  trailing={
                    <div
                      data-testid="badge-oracle-status"
                      className={
                        "flex h-full flex-col justify-center rounded-lg border px-3 py-2 text-xs " +
                        (oracleBadge.tone === "good" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : oracleBadge.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-800"
                          : oracleBadge.tone === "urgent" ? "border-orange-300 bg-orange-50 text-orange-800"
                          : "border-neutral-200 bg-white text-neutral-700")
                      }
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className={"h-2 w-2 rounded-full " + (oracleBadge.tone === "good" ? "bg-emerald-500 animate-pulse" : oracleBadge.tone === "warning" ? "bg-amber-500" : oracleBadge.tone === "urgent" ? "bg-orange-600" : "bg-neutral-400")} />
                        {oracleBadge.label}
                      </div>
                      <div className="text-[10px] opacity-80">{oracleBadge.hint}</div>
                    </div>
                  }
                />
              }
              queueTitle={t.label}
              filterChips={filterChips}
              activeFilters={filters}
              onToggleFilter={(k) => setFilters(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])}
              searchValue={search}
              onSearchChange={setSearch}
              loading={docsQ.isLoading}
              groups={groups}
              renderQueueItem={(item) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-neutral-900">{item.documentNumber}</div>
                    <Badge variant="outline" className="text-[10px]">{item.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-[11px] text-neutral-600">{item.partnerName || "—"}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono">{item.period || "—"}</span>
                    <span className="font-mono text-neutral-900">${Number(item.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
              selectedId={selectedId}
              onSelectItem={(item) => setSelectedId(item.id)}
              toolbar={
                <Button
                  size="sm" variant="outline"
                  className="h-7 border-amber-300 bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100"
                  onClick={() => setCreateOpen(true)} data-testid="button-new-document"
                  title="Manually create a document. Bypasses the agent claim-validation chain — use only as an exception."
                >
                  <Plus className="mr-1 h-3 w-3" /> Manual
                </Button>
              }
              detail={selected ? (
                <DocumentDetail doc={selected} detail={detailQ.data} sourceClaim={sourceClaimQ.data} onTransition={(action) => transitionMut.mutate({ id: selected.id, action })} pending={transitionMut.isPending} />
              ) : undefined}
            />
          </TabsContent>
        ))}
      </Tabs>

      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} defaultType={tab} onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/finance/documents"] })} />
    </MainLayout>
  );
}

function DocumentDetail({ doc, detail, sourceClaim, onTransition, pending }: { doc: FinanceDoc; detail: any; sourceClaim?: any; onTransition: (a: string) => void; pending: boolean }) {
  const isTerminal = ["paid", "voided"].includes(doc.status);
  const isDraft = doc.status === "draft";
  const [editOpen, setEditOpen] = useState(false);
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">{doc.documentType.replace(/_/g, " ")}</div>
          <h3 className="text-2xl font-semibold text-neutral-900" data-testid="text-doc-number">{doc.documentNumber}</h3>
          <div className="text-sm text-neutral-600">{doc.partnerName || "—"} · {doc.contractName || "no contract"}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-neutral-900" data-testid="text-doc-amount">${Number(doc.amount).toLocaleString()}</div>
          <Badge className="mt-1 bg-orange-600 text-white">{doc.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {!isTerminal && (
        <div className="mb-4 flex flex-wrap gap-2">
          {isDraft && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => setEditOpen(true)}
              data-testid="button-edit-document"
            >
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
          )}
          {doc.status === "draft" && <Button size="sm" className="bg-orange-600 hover:bg-orange-700" disabled={pending} onClick={() => onTransition("send")} data-testid="button-send">Send</Button>}
          {(doc.status === "sent" || doc.status === "draft") && <Button size="sm" variant="outline" disabled={pending} onClick={() => onTransition("mark_oracle_pending")} data-testid="button-oracle-pending">Mark Awaiting Oracle</Button>}
          {(doc.status === "awaiting_oracle" || doc.status === "sent") && <Button size="sm" variant="outline" disabled={pending} onClick={() => onTransition("mark_oracle_posted")} data-testid="button-oracle-posted">Mark Posted</Button>}
          {(doc.status === "posted") && <Button size="sm" variant="outline" disabled={pending} onClick={() => onTransition("mark_paid")} data-testid="button-mark-paid">Mark Paid</Button>}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onTransition("void")} data-testid="button-void">Void</Button>
        </div>
      )}

      {isDraft && (
        <EditDocumentDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          doc={doc}
          detail={detail}
          sourceClaim={sourceClaim}
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lines">Line Items</TabsTrigger>
          <TabsTrigger value="oracle">Oracle Status</TabsTrigger>
          <TabsTrigger value="linked">Linked Records</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field k="Period" v={doc.period} /> <Field k="Currency" v={doc.currency || "USD"} />
            <Field k="Accrual Date" v={doc.accrualDate ? new Date(doc.accrualDate).toLocaleDateString() : "—"} />
            <Field k="Created" v={new Date(doc.createdAt).toLocaleString()} />
            <Field k="Oracle Doc #" v={doc.oracleDocNumber || "—"} />
            <Field k="Oracle Status" v={doc.oracleStatus || "—"} />
          </div>
        </TabsContent>
        <TabsContent value="lines" className="mt-3">
          {detail?.lines?.length ? (
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr><th className="px-2 py-1">Description</th><th className="px-2 py-1">SKU</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-right">Unit</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1">GL</th></tr>
              </thead>
              <tbody>{detail.lines.map((l: any) => (
                <tr key={l.id} className="border-t border-neutral-100">
                  <td className="px-2 py-1">{l.description || "—"}</td>
                  <td className="px-2 py-1 font-mono">{l.sku || "—"}</td>
                  <td className="px-2 py-1 text-right">{l.quantity}</td>
                  <td className="px-2 py-1 text-right">${Number(l.unitAmount || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">${Number(l.amount || 0).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[10px]">{l.glAccount || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="text-sm text-neutral-500">No line items.</div>}
        </TabsContent>
        <TabsContent value="oracle" className="mt-3">
          <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="mb-2 font-medium text-neutral-900">Oracle Status Tracker (placeholder)</div>
            <ol className="space-y-1 text-xs text-neutral-700">
              <li className={doc.status === "draft" ? "text-orange-700 font-medium" : ""}>1. Drafted</li>
              <li className={doc.status === "sent" ? "text-orange-700 font-medium" : ""}>2. Sent</li>
              <li className={doc.status === "awaiting_oracle" ? "text-orange-700 font-medium" : ""}>3. Awaiting Oracle</li>
              <li className={doc.status === "posted" ? "text-orange-700 font-medium" : ""}>4. Posted</li>
              <li className={doc.status === "paid" ? "text-orange-700 font-medium" : ""}>5. Paid</li>
            </ol>
          </div>
        </TabsContent>
        <TabsContent value="linked" className="mt-3 text-sm text-neutral-600">
          {detail?.sourceClaimId && (
            <div className="mb-3 rounded-md border border-neutral-200 bg-white p-3" data-testid="card-source-claim">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Source claim</div>
                <ClaimStatusBadge status={sourceClaim?.status} />
              </div>
              {sourceClaim ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900" data-testid="text-source-claim-number">
                      {sourceClaim.claimNumber || `Claim ${detail.sourceClaimId.slice(0, 8)}`}
                    </div>
                    <Link href={`/claims-workspace?claimId=${detail.sourceClaimId}`}>
                      <a className="text-xs font-medium text-blue-700 hover:underline" data-testid="link-open-source-claim">Open in Claims Workspace →</a>
                    </Link>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {sourceClaim.partnerName || "—"} · {sourceClaim.period || "—"}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
                    <div className="text-neutral-500">Claimed</div>
                    <div className="text-right font-medium text-neutral-900">${Number(sourceClaim.claimedAmount || 0).toLocaleString()}</div>
                    <div className="text-neutral-500">Approved</div>
                    <div className="text-right font-medium text-neutral-900">${Number(sourceClaim.approvedAmount || 0).toLocaleString()}</div>
                  </div>
                  <div className="pt-1 font-mono text-[10px] text-neutral-400">{detail.sourceClaimId}</div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Loading claim…</div>
              )}
            </div>
          )}
          {detail?.sourceObligationId && <div>Source obligation: <code className="font-mono text-xs">{detail.sourceObligationId}</code></div>}
          {!detail?.sourceClaimId && !detail?.sourceObligationId && "No linked records."}
        </TabsContent>
        <TabsContent value="audit" className="mt-3">
          <ol className="space-y-2 border-l-2 border-neutral-200 pl-3">
            {(detail?.events || []).map((e: any) => (
              <li key={e.id} className="text-xs">
                <div className="font-medium">{e.eventType}: {e.fromStatus || "—"} → {e.toStatus}</div>
                <div className="text-neutral-500">{new Date(e.createdAt).toLocaleString()} · {e.userName || "system"}</div>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between border-b border-neutral-100 py-1"><span className="text-neutral-500">{k}</span><span className="font-medium text-neutral-900">{v ?? "—"}</span></div>;
}

// Small status pill for an inbound claim — color-coded so the user can spot
// rejected/expired/disputed claims at a glance and confirm they're not the
// one a finance document is mirroring.
function ClaimStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">unknown</span>;
  const tone = (() => {
    switch (status) {
      case "approved":
      case "settled":
        return "border-emerald-300 bg-emerald-50 text-emerald-800";
      case "partial_approved":
        return "border-blue-300 bg-blue-50 text-blue-800";
      case "needs_review":
      case "validating":
      case "received":
      case "agent_handling":
        return "border-amber-300 bg-amber-50 text-amber-800";
      case "rejected":
      case "expired":
        return "border-rose-300 bg-rose-50 text-rose-800";
      case "disputed":
      case "escalated":
        return "border-orange-300 bg-orange-50 text-orange-800";
      default:
        return "border-neutral-200 bg-neutral-50 text-neutral-600";
    }
  })();
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
      data-testid={`badge-claim-status-${status}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

type LineDraft = { description: string; sku: string; quantity: string; unitAmount: string };

function CreateDocumentDialog({ open, onOpenChange, defaultType, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; defaultType: string; onCreated: () => void }) {
  const { toast } = useToast();
  const optsQ = useQuery<{ partners: string[]; contracts: any[] }>({
    queryKey: ["/api/finance/documents/options"],
    enabled: open,
  });
  const [type, setType] = useState(defaultType);
  const [partnerName, setPartnerName] = useState("");
  const [period, setPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", sku: "", quantity: "1", unitAmount: "" }]);

  const lineAmount = (l: LineDraft) => {
    const q = parseFloat(l.quantity || "0");
    const u = parseFloat(l.unitAmount || "0");
    return Number.isFinite(q) && Number.isFinite(u) ? q * u : 0;
  };
  const totalAmount = lines.reduce((s, l) => s + lineAmount(l), 0);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, { description: "", sku: "", quantity: "1", unitAmount: "" }]);
  const removeLine = (i: number) =>
    setLines(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setPartnerName(""); setPeriod(""); setNotes("");
    setLines([{ description: "", sku: "", quantity: "1", unitAmount: "" }]);
  };

  const createMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/finance/documents", {
      documentType: type, partnerName, period, amount: totalAmount.toFixed(2), status: "draft", notes,
      lines: lines.map(l => ({
        description: l.description || null,
        sku: l.sku || null,
        quantity: l.quantity || "0",
        unitAmount: l.unitAmount || "0",
        amount: lineAmount(l).toFixed(2),
      })),
    })).json(),
    onSuccess: () => {
      toast({ title: "Document created" }); onCreated(); onOpenChange(false); reset();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const linesValid = lines.every(l => l.description.trim() !== "" && parseFloat(l.unitAmount || "0") !== 0);
  const canSubmit = !!partnerName.trim() && lines.length > 0 && linesValid && totalAmount > 0 && !createMut.isPending;
  const missing: string[] = [];
  if (!partnerName.trim()) missing.push("Partner");
  if (lines.some(l => !l.description.trim())) missing.push("line description");
  if (lines.some(l => parseFloat(l.unitAmount || "0") === 0)) missing.push("unit amount");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-create-document">
        <DialogHeader><DialogTitle>Manual Document — Override</DialogTitle></DialogHeader>
        <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900" data-testid="warn-manual-override">
          <strong>Heads up:</strong> Most documents are auto-generated by the agent from approved claims. Manually-created documents bypass the claim-validation chain and won't link back to a source claim or obligation. Use this as an exceptional override only.
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TABS.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Partner <span className="text-red-500">*</span></label>
              <PartnerPicker value={partnerName} onChange={setPartnerName} partners={optsQ.data?.partners || []} testId="input-doc-partner" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Period</label>
            <PeriodPicker value={period} onChange={setPeriod} testId="input-doc-period" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium">Line Items</label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addLine} data-testid="button-add-line">+ Add line</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">SKU</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1" />
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2" data-testid={`row-line-${i}`}>
                  <Input className="col-span-5 h-8 text-xs" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Description" data-testid={`input-line-description-${i}`} />
                  <Input className="col-span-2 h-8 text-xs" value={l.sku} onChange={(e) => updateLine(i, { sku: e.target.value })} placeholder="SKU" data-testid={`input-line-sku-${i}`} />
                  <Input className="col-span-1 h-8 text-right text-xs" type="number" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} data-testid={`input-line-qty-${i}`} />
                  <Input className="col-span-2 h-8 text-right text-xs" type="number" value={l.unitAmount} onChange={(e) => updateLine(i, { unitAmount: e.target.value })} data-testid={`input-line-unit-${i}`} />
                  <div className="col-span-1 text-right text-xs font-medium tabular-nums" data-testid={`text-line-amount-${i}`}>
                    {lineAmount(l).toFixed(2)}
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="col-span-1 h-7 text-xs text-neutral-500 hover:text-red-600" disabled={lines.length === 1} onClick={() => removeLine(i)} data-testid={`button-remove-line-${i}`}>×</Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end border-t border-neutral-100 pt-2 text-xs">
              <span className="mr-2 text-neutral-500">Total</span>
              <span className="font-semibold tabular-nums" data-testid="text-doc-total">{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-doc-notes" />
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!canSubmit && missing.length > 0 ? (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1" data-testid="text-create-missing">
              Fill in {missing.join(", ")} to create this document.
            </div>
          ) : <div />}
          <div className="flex items-center gap-2 self-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={!canSubmit} onClick={() => createMut.mutate()} data-testid="button-confirm-create">Create</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog for documents still in `draft`. Once a document has been Sent
// or further along the lifecycle, it's locked server-side and the user must
// Void + re-issue. We mirror the Create dialog's line editor and submit a
// PATCH /api/finance/documents/:id with the updated header + lines.
// ---------------------------------------------------------------------------
type EditLine = { description: string; sku: string; quantity: string; unitAmount: string };

function EditDocumentDialog({
  open, onOpenChange, doc, detail, sourceClaim,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  doc: FinanceDoc; detail: any; sourceClaim?: any;
}) {
  const { toast } = useToast();
  const [partnerName, setPartnerName] = useState(doc.partnerName || "");
  const [period, setPeriod] = useState(doc.period || "");
  const [accrualDate, setAccrualDate] = useState<string>(
    doc.accrualDate ? new Date(doc.accrualDate).toISOString().slice(0, 10) : "",
  );
  const [currency, setCurrency] = useState(doc.currency || "USD");
  const [notes, setNotes] = useState((detail?.notes as string) || "");
  const seedLines: EditLine[] = (detail?.lines || []).length
    ? detail.lines.map((l: any) => ({
        description: l.description || "",
        sku: l.sku || "",
        quantity: String(l.quantity ?? "1"),
        unitAmount: String(l.unitAmount ?? "0"),
      }))
    : [{ description: "", sku: "", quantity: "1", unitAmount: String(doc.amount || "0") }];
  const [lines, setLines] = useState<EditLine[]>(seedLines);

  // Re-seed whenever the dialog opens or the underlying doc/detail changes
  // (e.g. the draft was just re-synced from the source claim).
  useEffect(() => {
    if (!open) return;
    setPartnerName(doc.partnerName || "");
    setPeriod(doc.period || "");
    setAccrualDate(doc.accrualDate ? new Date(doc.accrualDate).toISOString().slice(0, 10) : "");
    setCurrency(doc.currency || "USD");
    setNotes((detail?.notes as string) || "");
    setLines((detail?.lines || []).length
      ? detail.lines.map((l: any) => ({
          description: l.description || "",
          sku: l.sku || "",
          quantity: String(l.quantity ?? "1"),
          unitAmount: String(l.unitAmount ?? "0"),
        }))
      : [{ description: "", sku: "", quantity: "1", unitAmount: String(doc.amount || "0") }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc.id, doc.amount, doc.partnerName, doc.period, doc.accrualDate, doc.currency, detail?.notes, detail?.lines?.length]);

  const lineAmount = (l: EditLine) => {
    const q = parseFloat(l.quantity || "0");
    const u = parseFloat(l.unitAmount || "0");
    return Number.isFinite(q) && Number.isFinite(u) ? q * u : 0;
  };
  const totalAmount = lines.reduce((s, l) => s + lineAmount(l), 0);
  const updateLine = (i: number, patch: Partial<EditLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, { description: "", sku: "", quantity: "1", unitAmount: "" }]);
  const removeLine = (i: number) =>
    setLines(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const saveMut = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/finance/documents/${doc.id}`, {
      partnerName: partnerName || null,
      period: period || null,
      accrualDate: accrualDate || null,
      currency: currency || "USD",
      notes: notes || null,
      amount: totalAmount.toFixed(2),
      lines: lines.map(l => ({
        description: l.description || null,
        sku: l.sku || null,
        quantity: l.quantity || "0",
        unitAmount: l.unitAmount || "0",
        amount: lineAmount(l).toFixed(2),
      })),
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/documents"] });
      toast({ title: "Draft updated" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Could not save", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const linesValid = lines.every(l => l.description.trim() !== "" && parseFloat(l.unitAmount || "0") !== 0);
  const canSubmit = !!partnerName.trim() && lines.length > 0 && linesValid && totalAmount > 0 && !saveMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-edit-document">
        <DialogHeader><DialogTitle>Edit Draft — {doc.documentNumber}</DialogTitle></DialogHeader>
        {detail?.sourceClaimId && (
          <div
            className="mb-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px]"
            data-testid="banner-edit-source-claim"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wide text-neutral-500">Mirroring claim</span>
                {sourceClaim ? (
                  <>
                    <span className="font-semibold text-neutral-900" data-testid="text-edit-source-claim-number">
                      {sourceClaim.claimNumber || `Claim ${detail.sourceClaimId.slice(0, 8)}`}
                    </span>
                    <ClaimStatusBadge status={sourceClaim.status} />
                    <span className="text-neutral-600">
                      claimed ${Number(sourceClaim.claimedAmount || 0).toLocaleString()} · approved ${Number(sourceClaim.approvedAmount || 0).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-neutral-500">Loading claim…</span>
                )}
              </div>
              <Link href={`/claims-workspace?claimId=${detail.sourceClaimId}`}>
                <a className="text-blue-700 hover:underline" data-testid="link-edit-open-source-claim">Open claim →</a>
              </Link>
            </div>
          </div>
        )}
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
          Drafts are editable until they're <strong>Sent</strong>. Once sent or posted, the document
          is locked and any change requires Void + re-issue.
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Partner <span className="text-red-500">*</span></label>
              <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} data-testid="input-edit-partner" />
            </div>
            <div>
              <label className="text-xs font-medium">Currency</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} data-testid="input-edit-currency" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Period</label>
              <PeriodPicker value={period} onChange={setPeriod} testId="input-edit-period" />
            </div>
            <div>
              <label className="text-xs font-medium">Accrual Date</label>
              <Input type="date" value={accrualDate} onChange={(e) => setAccrualDate(e.target.value)} data-testid="input-edit-accrual" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium">Line Items</label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addLine} data-testid="button-edit-add-line">+ Add line</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">SKU</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1" />
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2" data-testid={`row-edit-line-${i}`}>
                  <Input className="col-span-5 h-8 text-xs" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Description" data-testid={`input-edit-line-description-${i}`} />
                  <Input className="col-span-2 h-8 text-xs" value={l.sku} onChange={(e) => updateLine(i, { sku: e.target.value })} placeholder="SKU" data-testid={`input-edit-line-sku-${i}`} />
                  <Input className="col-span-1 h-8 text-right text-xs" type="number" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} data-testid={`input-edit-line-qty-${i}`} />
                  <Input className="col-span-2 h-8 text-right text-xs" type="number" value={l.unitAmount} onChange={(e) => updateLine(i, { unitAmount: e.target.value })} data-testid={`input-edit-line-unit-${i}`} />
                  <div className="col-span-1 text-right text-xs font-medium tabular-nums" data-testid={`text-edit-line-amount-${i}`}>
                    {lineAmount(l).toFixed(2)}
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="col-span-1 h-7 text-xs text-neutral-500 hover:text-red-600" disabled={lines.length === 1} onClick={() => removeLine(i)} data-testid={`button-edit-remove-line-${i}`}>×</Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end border-t border-neutral-100 pt-2 text-xs">
              <span className="mr-2 text-neutral-500">Total</span>
              <span className="font-semibold tabular-nums" data-testid="text-edit-doc-total">{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-edit-doc-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-edit-cancel">Cancel</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!canSubmit} onClick={() => saveMut.mutate()} data-testid="button-edit-save">
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
