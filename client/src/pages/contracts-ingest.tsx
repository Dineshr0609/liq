import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useUploadModal } from "@/contexts/upload-modal-context";
import MainLayout from "@/components/layout/main-layout";
import { NewContractSlideOver } from "@/components/contracts/NewContractSlideOver";
import {
  Upload, Mail, Plug, PenLine, ArrowRight, ChevronRight, Search, Filter,
  Inbox, Activity, Zap, ShieldCheck, Sparkles, GitMerge, FileText, FileCode2, Copy,
  Clock, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";

type Path = "upload" | "email" | "connector" | "manual";

interface InboxRow {
  id: string;
  contractId: string;
  item: string;
  counterparty: string;
  source: string;
  lane: "doc" | "data";
  stage: string;
  status: "ready" | "needs-review" | "needs-approval" | "agent-working" | "failed";
  received: string;
  aged: string;
  agedSeverity: "ok" | "warn" | "alert";
  agent: string;
  agentNote: string;
  contractType?: string;
}

interface InboxResponse {
  rows: InboxRow[];
  counts: {
    total: number; needsAction: number; agentsWorking: number; awaitingApproval: number;
    ready: number; failed: number; stuck24h: number; drift: number; unmatched: number;
    bySource: Record<Path, number>; byLane: { doc: number; data: number };
  };
}

function StatusPill({ status }: { status: InboxRow["status"] }) {
  const map: Record<InboxRow["status"], { label: string; cls: string; Icon: any }> = {
    ready: { label: "Ready", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    "needs-review": { label: "Needs review", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertCircle },
    "needs-approval": { label: "Needs approval", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertCircle },
    "agent-working": { label: "Working", cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Loader2 },
    failed: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200", Icon: AlertCircle },
  };
  const m = map[status];
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${m.cls}`}><m.Icon className={`h-2.5 w-2.5 ${status === "agent-working" ? "animate-spin" : ""}`} /> {m.label}</span>;
}

function FormatChip({ label, lane }: { label: string; lane: "doc" | "data" }) {
  const tone = lane === "doc" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${tone}`}>{label}</span>;
}

function LaneBadge({ lane }: { lane: "extract" | "map" | "both" }) {
  if (lane === "extract") return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded"><Sparkles className="h-2.5 w-2.5" /> AI extract lane</span>;
  if (lane === "map") return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"><GitMerge className="h-2.5 w-2.5" /> Field-map lane</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">Both lanes (auto-routed)</span>;
}

export default function ContractsIngest() {
  const { data } = useQuery<InboxResponse>({ queryKey: ["/api/ingestion/inbox"] });
  const counts = data?.counts;
  const { open: openUploadModal } = useUploadModal();
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <MainLayout>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans" data-testid="page-contracts-ingest">
        {/* Header */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-1">
                <span>Contracts</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Ingest</span>
              </div>
              <h1 className="text-xl font-bold text-zinc-900" data-testid="text-page-title">Ingest a contract</h1>
              <p className="text-xs text-zinc-500 mt-0.5">All four paths produce the same result — a fully extracted contract on the unified Edit screen, ready for review.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input data-testid="input-search-inbox" placeholder="Search inbox & queue…" className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-64 focus:outline-none focus:border-orange-400" />
              </div>
              <Link href="/contracts/inbox" data-testid="link-open-inbox">
                <a className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" /> Open Inbox</a>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Choose a path */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Choose a path</h2>
              <span className="text-[10px] text-zinc-400">Pick the one that fits your source — switch any time</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {/* Upload — real */}
              <button
                type="button"
                onClick={() => openUploadModal()}
                data-testid="card-path-upload"
                className="text-left block bg-white border-2 border-orange-300 rounded-lg p-4 ring-4 ring-orange-50 relative hover:ring-orange-100 transition-all"
              >
                <span className="absolute top-2 right-2 text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded uppercase">Most used</span>
                <div className="h-8 w-8 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center mb-2.5"><Upload className="h-4 w-4" /></div>
                <h3 className="text-sm font-bold text-zinc-900">Upload file</h3>
                <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">Drop a contract document, sales export, or rate sheet — we route by file type.</p>
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  <FormatChip label="PDF" lane="doc" /><FormatChip label="DOCX" lane="doc" /><FormatChip label="Scan" lane="doc" />
                  <FormatChip label="XLSX" lane="data" /><FormatChip label="CSV" lane="data" />
                </div>
                <div className="mb-2"><LaneBadge lane="both" /></div>
                <div className="border-2 border-dashed border-orange-200 rounded-md p-3 text-center bg-orange-50/40 mb-3">
                  <Upload className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                  <div className="text-[11px] text-zinc-700 font-medium">Drop file or <span className="text-orange-700 underline">browse</span></div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">PDF, DOCX, PNG up to 50MB</div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-orange-500" /> ~30 sec extract</span>
                  <span data-testid="text-upload-count">{counts?.bySource?.upload ?? 0} so far</span>
                </div>
              </button>

              {/* Email — stubbed */}
              <div className="bg-white border border-zinc-200 rounded-lg p-4 relative opacity-90" data-testid="card-path-email">
                <span className="absolute top-2 right-2 text-[9px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">Coming soon</span>
                <div className="h-8 w-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5"><Mail className="h-4 w-4" /></div>
                <h3 className="text-sm font-bold text-zinc-900">Forward via email</h3>
                <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">Forward any attachment to your private inbox — auto-ingested. Mostly documents.</p>
                <div className="flex flex-wrap items-center gap-1 mb-2"><FormatChip label="PDF" lane="doc" /><FormatChip label="DOCX" lane="doc" /><FormatChip label="XLSX" lane="data" /></div>
                <div className="mb-2"><LaneBadge lane="extract" /></div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2.5 py-2 mb-3">
                  <div className="text-[10px] text-zinc-500 mb-0.5">Your inbox address (when enabled)</div>
                  <div className="flex items-center justify-between gap-1.5">
                    <code className="text-[11px] font-mono text-zinc-500 truncate">your-tenant.contracts@in.licenseiq.app</code>
                    <Copy className="h-3 w-3 text-zinc-300 shrink-0" />
                  </div>
                </div>
                <button disabled className="w-full text-[11px] font-semibold text-blue-700 hover:underline disabled:text-zinc-400 disabled:hover:no-underline">Join the waitlist →</button>
              </div>

              {/* Connector — stubbed */}
              <div className="bg-white border border-zinc-200 rounded-lg p-4 relative opacity-90" data-testid="card-path-connector">
                <span className="absolute top-2 right-2 text-[9px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">Coming soon</span>
                <div className="h-8 w-8 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center mb-2.5"><Plug className="h-4 w-4" /></div>
                <h3 className="text-sm font-bold text-zinc-900">Sync from connector</h3>
                <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">Structured data flows in from CRM/TPM. Documents flow in from CLM/storage. We route each correctly.</p>
                <div className="flex flex-wrap items-center gap-1 mb-2"><FormatChip label="JSON" lane="data" /><FormatChip label="XML" lane="data" /><FormatChip label="CSV" lane="data" /><FormatChip label="PDF" lane="doc" /></div>
                <div className="mb-2"><LaneBadge lane="both" /></div>
                <div className="space-y-1 mb-3">
                  {["Salesforce CPQ", "TPM Pro", "DocuSign CLM", "Ironclad", "SharePoint"].map((c, i) => {
                    const isData = i < 2;
                    const tone = isData ? "text-emerald-600" : "text-orange-600";
                    const Icon = isData ? FileCode2 : FileText;
                    return (
                      <div key={c} className="flex items-center justify-between px-2 py-1 rounded border border-zinc-100 bg-zinc-50/50">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-500"><Icon className={`h-2.5 w-2.5 ${tone}`} /> {c}</span>
                        <span className="text-[9px] font-semibold text-zinc-400">Not connected</span>
                      </div>
                    );
                  })}
                </div>
                <button disabled className="w-full text-[11px] font-semibold text-purple-700 disabled:text-zinc-400">Configure connectors →</button>
              </div>

              {/* Manual — opens the minimal slide-over create panel */}
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                data-testid="card-path-manual"
                className="block w-full text-left bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 hover:shadow-sm transition-all relative"
              >
                <span className="absolute top-2 right-2 text-[9px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">Blank or template</span>
                <div className="h-8 w-8 rounded-md bg-zinc-200 text-zinc-700 flex items-center justify-center mb-2.5"><PenLine className="h-4 w-4" /></div>
                <h3 className="text-sm font-bold text-zinc-900">Create manually</h3>
                <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">Start from a blank record with the bare minimum — name, flow type, counterparty. Refine the rest on the contract overview.</p>
                <div className="flex flex-wrap items-center gap-1 mb-2"><FormatChip label="Form" lane="data" /></div>
                <div className="mb-2"><LaneBadge lane="map" /></div>
                <div className="space-y-1 mb-3">
                  {["Royalty License", "Distribution Agreement", "Rebate Program", "Blank contract"].map((t) => (
                    <div key={t} className="w-full text-left flex items-center justify-between px-2 py-1 rounded border border-zinc-100 hover:bg-zinc-50">
                      <span className="text-[10px] font-medium text-zinc-800">{t}</span><ChevronRight className="h-3 w-3 text-zinc-400" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-zinc-500" /> Templates</span>
                  <span className="text-zinc-700 font-semibold">New →</span>
                </div>
              </button>
            </div>
          </section>

          {/* Convergence */}
          <section className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Where every path lands</h2>
              <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-orange-500" /> AI normalizes to a single shape</span>
            </div>
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-2 space-y-1.5">
                {(["upload", "email", "connector", "manual"] as Path[]).map((p) => {
                  const meta = { upload: { i: Upload, t: "text-orange-700", b: "bg-orange-50", l: "Upload" }, email: { i: Mail, t: "text-blue-700", b: "bg-blue-50", l: "Email" }, connector: { i: Plug, t: "text-purple-700", b: "bg-purple-50", l: "Connector" }, manual: { i: PenLine, t: "text-zinc-700", b: "bg-zinc-100", l: "Manual" } }[p];
                  const Icon = meta.i;
                  return (
                    <div key={p} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md ${meta.b} ${meta.t}`}>
                      <Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold flex-1">{meta.l}</span>
                    </div>
                  );
                })}
              </div>
              <div className="col-span-4 space-y-2">
                <div className="bg-orange-50 border border-orange-200 rounded-md p-2.5">
                  <div className="flex items-center gap-1.5 mb-1"><Sparkles className="h-3 w-3 text-orange-600" /><span className="text-[10px] font-bold uppercase tracking-wide text-orange-700">AI Extract lane</span></div>
                  <div className="text-[10px] text-zinc-600 leading-snug mb-1.5">Documents → OCR → LLM extraction → confidence scoring</div>
                  <div className="flex flex-wrap gap-1"><FormatChip label="PDF" lane="doc" /><FormatChip label="DOCX" lane="doc" /><FormatChip label="Scan" lane="doc" /></div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                  <div className="flex items-center gap-1.5 mb-1"><GitMerge className="h-3 w-3 text-emerald-600" /><span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Field-map lane</span></div>
                  <div className="text-[10px] text-zinc-600 leading-snug mb-1.5">Structured rows → schema mapper → validation → preview</div>
                  <div className="flex flex-wrap gap-1"><FormatChip label="CSV" lane="data" /><FormatChip label="XLSX" lane="data" /><FormatChip label="JSON" lane="data" /><FormatChip label="XML" lane="data" /></div>
                </div>
              </div>
              <div className="col-span-1 flex flex-col items-center text-zinc-400">
                <ArrowRight className="h-5 w-5 text-orange-500" />
                <div className="text-[9px] font-bold uppercase tracking-wider mt-1 text-zinc-500">Merge</div>
              </div>
              <div className="col-span-5">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg p-4 relative">
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-white px-1.5 py-0.5 rounded shadow-sm"><ShieldCheck className="h-2.5 w-2.5" /> Single source of truth</div>
                  <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-orange-700" /><span className="text-sm font-bold text-zinc-900">Unified Edit Contract</span></div>
                  <p className="text-[11px] text-zinc-600 mb-2.5 leading-snug">One screen, one workflow — regardless of source. Verification banner shows exactly what needs review before activation.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Identity", "Parties & Roles", "Terms", "Rules", "Risks", "Insights", "Activation Readiness"].map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-800 font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pipeline health (live data) */}
          <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 inline-flex items-center gap-2"><Activity className="h-4 w-4 text-orange-600" /> Pipeline health & reconciliation</h2>
                <p className="text-[10px] text-zinc-500">Catches stuck items, failed retries, and unmatched counterparties — including things stranded weeks ago.</p>
              </div>
              <Link href="/contracts/inbox"><a className="text-[10px] text-orange-700 font-semibold hover:underline">Open Inbox →</a></Link>
            </div>
            <div className="grid grid-cols-4 divide-x divide-zinc-100">
              {[
                { label: "Stuck > 24h", value: counts?.stuck24h ?? 0, detail: "In-flight aged > 1 day", tone: "amber" },
                { label: "Failed (retry needed)", value: counts?.failed ?? 0, detail: "Errors during extraction", tone: "rose" },
                { label: "Connector drift", value: counts?.drift ?? 0, detail: "Tracking begins Phase B", tone: "amber" },
                { label: "Unmatched counterparty", value: counts?.unmatched ?? 0, detail: "Awaiting party assignment", tone: "blue" },
              ].map((h) => {
                const toneMap: Record<string, { num: string; dot: string }> = {
                  amber: { num: "text-amber-700", dot: "bg-amber-500" },
                  rose: { num: "text-rose-700", dot: "bg-rose-500" },
                  blue: { num: "text-blue-700", dot: "bg-blue-500" },
                };
                const t = toneMap[h.tone];
                return (
                  <Link key={h.label} href="/contracts/inbox" data-testid={`tile-health-${h.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <a className="block p-3 text-left hover:bg-zinc-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{h.label}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                      </div>
                      <div className={`text-2xl font-bold ${t.num}`}>{h.value}</div>
                      <div className="text-[10px] text-zinc-500 leading-tight">{h.detail}</div>
                    </a>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recent contracts (live) */}
          <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-orange-600" /> Recent contracts</h2>
                <p className="text-[10px] text-zinc-500">Last 10 ingested — across all paths. Click any row to jump straight to its workspace.</p>
              </div>
              <Link href="/contracts/inbox"><a className="text-[10px] text-orange-700 font-semibold hover:underline">See all in Inbox →</a></Link>
            </div>
            {(!data?.rows || data.rows.length === 0) ? (
              <div className="px-4 py-10 text-center text-xs text-zinc-500">
                <Inbox className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
                Nothing ingested yet. Upload a file above to see it appear here.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {data.rows.slice(0, 10).map((r) => (
                  <Link key={r.id} href={`/contracts/${r.contractId}`} data-testid={`row-recent-${r.id}`}>
                    <a className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-zinc-50">
                      <div className="col-span-5 min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 truncate">{r.item}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{r.counterparty}</div>
                      </div>
                      <div className="col-span-2 text-[10px] text-zinc-600">
                        <FormatChip label={r.lane === "data" ? "DATA" : "DOC"} lane={r.lane} />
                        <div className="mt-0.5 text-zinc-400 capitalize">{r.source}</div>
                      </div>
                      <div className="col-span-2"><StatusPill status={r.status} /></div>
                      <div className="col-span-2 text-[10px] text-zinc-600">
                        <div className="font-medium text-zinc-700">{r.agent}</div>
                        <div className="text-zinc-500 truncate">{r.agentNote}</div>
                      </div>
                      <div className="col-span-1 text-[10px] text-zinc-500 text-right">{r.aged}</div>
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <NewContractSlideOver
        open={manualOpen}
        onOpenChange={setManualOpen}
      />
    </MainLayout>
  );
}
