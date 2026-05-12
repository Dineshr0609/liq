import {
  Upload,
  Mail,
  Plug,
  PenLine,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Sparkles,
  ChevronRight,
  Search,
  Filter,
  Inbox,
  Activity,
  Zap,
  ShieldCheck,
  MoreHorizontal,
  Copy,
  FileSpreadsheet,
  FileCode2,
  GitMerge,
} from "lucide-react";

type Lane = "extract" | "map" | "both";

function FormatChip({ label, lane }: { label: string; lane: "doc" | "data" }) {
  const map = {
    doc: "bg-orange-50 text-orange-700 border-orange-200",
    data: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${map[lane]}`}>
      {label}
    </span>
  );
}

function LaneBadge({ lane }: { lane: Lane }) {
  if (lane === "extract") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
        <Sparkles className="h-2.5 w-2.5" /> AI extract lane
      </span>
    );
  }
  if (lane === "map") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
        <GitMerge className="h-2.5 w-2.5" /> Field-map lane
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
      Both lanes (auto-routed)
    </span>
  );
}

type Path = "upload" | "email" | "connector" | "manual";

const pathMeta: Record<
  Path,
  { icon: any; label: string; tone: string; bg: string; ring: string }
> = {
  upload: {
    icon: Upload,
    label: "Upload",
    tone: "text-orange-700",
    bg: "bg-orange-50",
    ring: "ring-orange-200",
  },
  email: {
    icon: Mail,
    label: "Email",
    tone: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
  },
  connector: {
    icon: Plug,
    label: "Connector",
    tone: "text-purple-700",
    bg: "bg-purple-50",
    ring: "ring-purple-200",
  },
  manual: {
    icon: PenLine,
    label: "Manual",
    tone: "text-zinc-700",
    bg: "bg-zinc-100",
    ring: "ring-zinc-200",
  },
};

function PathPill({ path }: { path: Path }) {
  const m = pathMeta[path];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.bg} ${m.tone}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  );
}

function StatusChip({
  status,
}: {
  status: "ready" | "processing" | "needs-review" | "failed";
}) {
  const map = {
    ready: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Ready to review" },
    processing: { dot: "bg-blue-500 animate-pulse", text: "text-blue-700", bg: "bg-blue-50", label: "AI extracting…" },
    "needs-review": { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Needs review" },
    failed: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Failed" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function IngestionEntry() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-1">
              <span>Contracts</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-700 font-medium">Ingest</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Ingest a contract</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              All four paths produce the same result — a fully extracted contract on the unified Edit screen, ready for review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                placeholder="Search inbox & queue…"
                className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-64 focus:outline-none focus:border-orange-400"
              />
            </div>
            <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Section 1: Choose a path */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Choose a path
            </h2>
            <span className="text-[10px] text-zinc-400">
              Pick the one that fits your source — switch any time
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {/* Path 1: Upload */}
            <div className="bg-white border-2 border-orange-300 rounded-lg p-4 ring-4 ring-orange-50 relative">
              <span className="absolute top-2 right-2 text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded uppercase">
                Most used
              </span>
              <div className="h-8 w-8 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center mb-2.5">
                <Upload className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Upload file</h3>
              <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">
                Drop a contract document, sales export, or rate sheet — we route by file type.
              </p>
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <FormatChip label="PDF" lane="doc" />
                <FormatChip label="DOCX" lane="doc" />
                <FormatChip label="Scan" lane="doc" />
                <FormatChip label="XLSX" lane="data" />
                <FormatChip label="CSV" lane="data" />
              </div>
              <div className="mb-2"><LaneBadge lane="both" /></div>
              <div className="border-2 border-dashed border-orange-200 rounded-md p-3 text-center bg-orange-50/40 mb-3">
                <Upload className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                <div className="text-[11px] text-zinc-700 font-medium">
                  Drop file or <span className="text-orange-700 underline">browse</span>
                </div>
                <div className="text-[9px] text-zinc-500 mt-0.5">PDF, DOCX, PNG up to 50MB</div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-orange-500" /> ~30 sec extract</span>
                <span>342 this month</span>
              </div>
            </div>

            {/* Path 2: Email */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all relative">
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
              </span>
              <div className="h-8 w-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5">
                <Mail className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Forward via email</h3>
              <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">
                Forward any attachment to your private inbox — auto-ingested. Mostly documents.
              </p>
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <FormatChip label="PDF" lane="doc" />
                <FormatChip label="DOCX" lane="doc" />
                <FormatChip label="XLSX" lane="data" />
              </div>
              <div className="mb-2"><LaneBadge lane="extract" /></div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-md px-2.5 py-2 mb-3">
                <div className="text-[10px] text-zinc-500 mb-0.5">Your inbox address</div>
                <div className="flex items-center justify-between gap-1.5">
                  <code className="text-[11px] font-mono text-zinc-800 truncate">acme.contracts@in.licenseiq.app</code>
                  <button className="shrink-0 text-zinc-400 hover:text-blue-600">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><Inbox className="h-3 w-3 text-blue-500" /> 7 awaiting</span>
                <button className="text-blue-700 font-semibold hover:underline">Open inbox →</button>
              </div>
            </div>

            {/* Path 3: Connector */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-sm transition-all relative">
              <span className="absolute top-2 right-2 text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                3 connected
              </span>
              <div className="h-8 w-8 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center mb-2.5">
                <Plug className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Sync from connector</h3>
              <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">
                Structured data flows in from CRM/TPM. Documents flow in from CLM/storage. We route each correctly.
              </p>
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <FormatChip label="JSON" lane="data" />
                <FormatChip label="XML" lane="data" />
                <FormatChip label="CSV" lane="data" />
                <FormatChip label="PDF" lane="doc" />
              </div>
              <div className="mb-2"><LaneBadge lane="both" /></div>
              <div className="space-y-1 mb-3">
                {[
                  { name: "Salesforce CPQ", icon: FileCode2, kind: "data", count: "12 new" },
                  { name: "TPM Pro", icon: FileCode2, kind: "data", count: "4 new" },
                  { name: "DocuSign CLM", icon: FileText, kind: "doc", count: "3 new" },
                  { name: "Ironclad", icon: FileText, kind: "doc", count: "1 new" },
                  { name: "SharePoint", icon: FileText, kind: "doc", count: "Idle" },
                ].map((c) => {
                  const Icon = c.icon;
                  const tone = c.kind === "data" ? "text-emerald-600" : "text-orange-600";
                  return (
                    <div key={c.name} className="flex items-center justify-between px-2 py-1 rounded border border-zinc-100 bg-zinc-50/50">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-800">
                        <Icon className={`h-2.5 w-2.5 ${tone}`} /> {c.name}
                      </span>
                      <span className={`text-[9px] font-semibold ${c.count.includes("new") ? "text-emerald-700" : "text-zinc-500"}`}>{c.count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3 text-purple-500" /> Auto · hourly</span>
                <button className="text-purple-700 font-semibold hover:underline">Manage →</button>
              </div>
            </div>

            {/* Path 4: Manual */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 hover:shadow-sm transition-all relative">
              <span className="absolute top-2 right-2 text-[9px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                Blank or template
              </span>
              <div className="h-8 w-8 rounded-md bg-zinc-200 text-zinc-700 flex items-center justify-center mb-2.5">
                <PenLine className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Create manually</h3>
              <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-2">
                Start from a contract-type template or a blank record. Useful for verbal deals or pre-drafts.
              </p>
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <FormatChip label="Form" lane="data" />
              </div>
              <div className="mb-2"><LaneBadge lane="map" /></div>
              <div className="space-y-1 mb-3">
                {[
                  "Royalty License",
                  "Distribution Agreement",
                  "Rebate Program",
                  "Blank contract",
                ].map((t, i) => (
                  <button
                    key={t}
                    className="w-full text-left flex items-center justify-between px-2 py-1 rounded border border-zinc-100 hover:bg-zinc-50 hover:border-zinc-300"
                  >
                    <span className="text-[10px] font-medium text-zinc-800">{t}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-zinc-500" /> 9 templates</span>
                <button className="text-zinc-700 font-semibold hover:underline">New →</button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Convergence visualization */}
        <section className="bg-white border border-zinc-200 rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Where every path lands
            </h2>
            <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-orange-500" /> AI normalizes to a single shape
            </span>
          </div>
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Source pills */}
            <div className="col-span-2 space-y-1.5">
              {(["upload", "email", "connector", "manual"] as Path[]).map((p) => {
                const m = pathMeta[p];
                const Icon = m.icon;
                return (
                  <div
                    key={p}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md ${m.bg} ${m.tone}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold flex-1">{m.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Two-lane fork */}
            <div className="col-span-4 space-y-2">
              <div className="bg-orange-50 border border-orange-200 rounded-md p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3 w-3 text-orange-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-orange-700">AI Extract lane</span>
                </div>
                <div className="text-[10px] text-zinc-600 leading-snug mb-1.5">
                  Documents → OCR → LLM extraction → confidence scoring
                </div>
                <div className="flex flex-wrap gap-1">
                  <FormatChip label="PDF" lane="doc" />
                  <FormatChip label="DOCX" lane="doc" />
                  <FormatChip label="Scan" lane="doc" />
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <GitMerge className="h-3 w-3 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Field-map lane</span>
                </div>
                <div className="text-[10px] text-zinc-600 leading-snug mb-1.5">
                  Structured rows → schema mapper → validation → preview
                </div>
                <div className="flex flex-wrap gap-1">
                  <FormatChip label="CSV" lane="data" />
                  <FormatChip label="XLSX" lane="data" />
                  <FormatChip label="JSON" lane="data" />
                  <FormatChip label="XML" lane="data" />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="col-span-1 flex flex-col items-center text-zinc-400">
              <ArrowRight className="h-5 w-5 text-orange-500" />
              <div className="text-[9px] font-bold uppercase tracking-wider mt-1 text-zinc-500">Merge</div>
            </div>

            {/* Target */}
            <div className="col-span-5">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg p-4 relative">
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-white px-1.5 py-0.5 rounded shadow-sm">
                  <ShieldCheck className="h-2.5 w-2.5" /> Single source of truth
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-orange-700" />
                  <span className="text-sm font-bold text-zinc-900">Unified Edit Contract</span>
                </div>
                <p className="text-[11px] text-zinc-600 mb-2.5 leading-snug">
                  One screen, one workflow — regardless of source. Verification banner shows exactly what needs review before activation.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Identity", "Parties & Roles", "Terms", "Rules", "Risks", "Insights", "Activation Readiness"].map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-800 font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Pipeline Health & Reconciliation */}
        <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 inline-flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-600" /> Pipeline health & reconciliation
              </h2>
              <p className="text-[10px] text-zinc-500">
                Catches stuck items, failed retries, and connector drift — including things stranded weeks ago.
              </p>
            </div>
            <span className="text-[10px] text-zinc-500">All-time view · Last reconciled 4 min ago</span>
          </div>

          {/* Health tiles */}
          <div className="grid grid-cols-4 divide-x divide-zinc-100 border-b border-zinc-100">
            {[
              {
                label: "Stuck > 24h",
                value: "3",
                detail: "Oldest: 18 days in OCR",
                tone: "amber",
                filter: "stuck-24h",
              },
              {
                label: "Failed (retry needed)",
                value: "5",
                detail: "2 from Mar 12 · 3 this week",
                tone: "rose",
                filter: "failed",
              },
              {
                label: "Connector drift",
                value: "8",
                detail: "Expected vs received gap",
                tone: "amber",
                filter: "drift",
              },
              {
                label: "Unmatched counterparty",
                value: "12",
                detail: "Awaiting party assignment",
                tone: "blue",
                filter: "unmatched",
              },
            ].map((h) => {
              const toneMap: Record<string, { num: string; chip: string; dot: string }> = {
                amber: { num: "text-amber-700", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
                rose: { num: "text-rose-700", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
                blue: { num: "text-blue-700", chip: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
              };
              const t = toneMap[h.tone];
              return (
                <button key={h.label} className="p-3 text-left hover:bg-zinc-50 group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {h.label}
                    </span>
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${t.num}`}>{h.value}</span>
                    <span className="text-[10px] text-orange-600 opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5">
                      Open <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight">{h.detail}</div>
                </button>
              );
            })}
          </div>

          {/* Drill-down preview — shows that tiles open into actual records */}
          <div className="bg-zinc-50 border-b border-zinc-100">
            <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Drill-down preview
              </span>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              {[
                { label: "Stuck > 24h", count: 3, active: true },
                { label: "Failed", count: 5 },
                { label: "Drift", count: 8 },
                { label: "Unmatched", count: 12 },
              ].map((t) => (
                <button
                  key={t.label}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    t.active
                      ? "bg-orange-100 text-orange-800 border-orange-300"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {t.label} <span className="font-bold">{t.count}</span>
                </button>
              ))}
              <span className="ml-auto text-[10px] text-zinc-500">
                Showing 3 of 3 stuck records
              </span>
            </div>
            <div className="px-3 pb-3">
              <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="text-left font-semibold px-3 py-1.5">Item</th>
                      <th className="text-left font-semibold px-2 py-1.5">Source</th>
                      <th className="text-left font-semibold px-2 py-1.5">Stuck at stage</th>
                      <th className="text-left font-semibold px-2 py-1.5">Stuck for</th>
                      <th className="text-left font-semibold px-2 py-1.5">Last log</th>
                      <th className="text-left font-semibold px-2 py-1.5">Owner</th>
                      <th className="text-right font-semibold px-3 py-1.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[
                      {
                        item: "Vortex_License_Renewal_v4.pdf",
                        src: "email" as Path,
                        stage: "OCR",
                        for: "18 days",
                        log: "OCR worker timeout — page 12 image too large",
                        owner: "Unassigned",
                        suggestion: "Re-OCR with high-res mode",
                      },
                      {
                        item: "SF-OPP-7124 → Contract",
                        src: "connector" as Path,
                        stage: "Field mapping",
                        for: "5 days",
                        log: "3 unmapped fields: rebate_tier, ship_terms, parent_acct",
                        owner: "Priya N. (CRM Ops)",
                        suggestion: "Open mapping wizard",
                      },
                      {
                        item: "Q1_distributor_terms.xlsx",
                        src: "upload" as Path,
                        stage: "Counterparty match",
                        for: "2 days",
                        log: 'No master record matches "Crestline Distrib LLC"',
                        owner: "Marcus T.",
                        suggestion: "Create new partner",
                      },
                    ].map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-900 truncate max-w-[180px]">{r.item}</div>
                          <div className="text-[9px] text-orange-700 mt-0.5 inline-flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" /> liQ AI: {r.suggestion}
                          </div>
                        </td>
                        <td className="px-2 py-2"><PathPill path={r.src} /></td>
                        <td className="px-2 py-2">
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {r.stage}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                            <Clock className="h-3 w-3" /> {r.for}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-[10px] text-zinc-600 max-w-[200px] truncate" title={r.log}>
                          {r.log}
                        </td>
                        <td className="px-2 py-2 text-[10px] text-zinc-700">{r.owner}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 mr-2">
                            Logs
                          </button>
                          <button className="text-[10px] font-semibold text-orange-700 hover:text-orange-800">
                            Resolve →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Bulk: <button className="text-orange-700 font-semibold hover:underline">Retry all 3</button> · <button className="text-orange-700 font-semibold hover:underline">Reassign owner</button> · <button className="text-rose-600 font-semibold hover:underline">Discard</button></span>
                  <button className="text-orange-700 font-semibold hover:underline">Open as full inbox view →</button>
                </div>
              </div>
            </div>
          </div>

          {/* Per-connector reconciliation */}
          <div className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              Connector reconciliation — today
            </div>
            <div className="space-y-1.5">
              {[
                { name: "Salesforce CPQ", expected: 47, received: 47, missing: 0, lastSync: "8 min ago" },
                { name: "TPM Pro", expected: 12, received: 12, missing: 0, lastSync: "14 min ago" },
                { name: "DocuSign CLM", expected: 12, received: 9, missing: 3, lastSync: "22 min ago" },
                { name: "Ironclad", expected: 4, received: 4, missing: 0, lastSync: "1h ago" },
                { name: "SharePoint", expected: 6, received: 4, missing: 2, lastSync: "Failed at 09:14" },
              ].map((c) => {
                const pct = c.expected ? (c.received / c.expected) * 100 : 0;
                const ok = c.missing === 0 && !c.lastSync.startsWith("Failed");
                const failed = c.lastSync.startsWith("Failed");
                return (
                  <div key={c.name} className="flex items-center gap-3 px-2 py-1.5 rounded border border-zinc-100 hover:bg-zinc-50">
                    <div className="w-32 shrink-0">
                      <div className="text-[11px] font-medium text-zinc-800">{c.name}</div>
                      <div className={`text-[9px] ${failed ? "text-rose-600 font-semibold" : "text-zinc-500"}`}>
                        {c.lastSync}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${ok ? "bg-emerald-500" : failed ? "bg-rose-500" : "bg-amber-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-600 w-28 text-right shrink-0">
                      <span className="font-semibold">{c.received}</span>
                      <span className="text-zinc-400"> / {c.expected} expected</span>
                    </div>
                    <div className="w-20 text-right shrink-0">
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> In sync
                        </span>
                      ) : failed ? (
                        <button className="text-[10px] font-bold text-rose-700 hover:underline">
                          Retry sync
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                          <AlertCircle className="h-3 w-3" /> {c.missing} missing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Smart filter shortcuts into the full inbox */}
          <div className="px-3 pb-3 pt-1 border-t border-zinc-100 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mr-1">
              Jump into full inbox:
            </span>
            {[
              { label: "Older than 7 days · not Ready", count: 8, tone: "amber" },
              { label: "Failed", count: 5, tone: "rose" },
              { label: "Stuck in extraction", count: 3, tone: "amber" },
              { label: "Unmatched counterparty", count: 12, tone: "blue" },
              { label: "Salesforce CPQ · last 30 days", count: 1247, tone: "zinc" },
            ].map((f) => {
              const map: Record<string, string> = {
                amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
                rose: "border-rose-200 text-rose-800 hover:bg-rose-50",
                blue: "border-blue-200 text-blue-800 hover:bg-blue-50",
                zinc: "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
              };
              return (
                <button
                  key={f.label}
                  className={`text-[10px] font-medium px-2 py-1 rounded-full border bg-white ${map[f.tone]} inline-flex items-center gap-1.5`}
                >
                  {f.label}
                  <span className="font-bold">{f.count}</span>
                </button>
              );
            })}
            <button className="ml-auto text-[11px] font-semibold text-orange-700 hover:text-orange-800 inline-flex items-center gap-0.5">
              Open full inbox <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Section 4: Recent activity table */}
        <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Recent ingestion <span className="text-[10px] font-normal text-zinc-500">(latest 7)</span></h2>
              <p className="text-[10px] text-zinc-500">Last 24 hours · 23 contracts ingested · For everything else, use the full inbox above</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 14 ready</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 7 needs review</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> 2 processing</span>
              <button className="text-orange-700 font-semibold hover:underline">View all →</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Source</th>
                <th className="text-left font-semibold px-2 py-2">Format · Lane</th>
                <th className="text-left font-semibold px-2 py-2">Item</th>
                <th className="text-left font-semibold px-2 py-2">Counterparty</th>
                <th className="text-left font-semibold px-2 py-2">Type</th>
                <th className="text-left font-semibold px-2 py-2">Status</th>
                <th className="text-left font-semibold px-2 py-2">When</th>
                <th className="text-right font-semibold px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                { src: "upload" as Path, fmt: "PDF", lane: "doc" as const, doc: "Acme-MSA-2026.pdf", cp: "Acme Industries", type: "Royalty License", status: "ready" as const, when: "2 min ago" },
                { src: "connector" as Path, fmt: "JSON", lane: "data" as const, doc: "SF-OPP-8821 → Contract", cp: "Northwind Traders", type: "Royalty License", status: "processing" as const, when: "14 min ago" },
                { src: "email" as Path, fmt: "DOCX", lane: "doc" as const, doc: "GlobalTech_Distribution_v3.docx", cp: "GlobalTech Corp", type: "Distribution", status: "needs-review" as const, when: "11 min ago" },
                { src: "upload" as Path, fmt: "XLSX", lane: "data" as const, doc: "rate_card_q2_2026.xlsx", cp: "Pinnacle Retail", type: "Rebate Program", status: "needs-review" as const, when: "28 min ago" },
                { src: "connector" as Path, fmt: "PDF", lane: "doc" as const, doc: "DocuSign env. 4421-A", cp: "Helix Pharma", type: "License Agreement", status: "ready" as const, when: "3h ago" },
                { src: "connector" as Path, fmt: "XML", lane: "data" as const, doc: "TPM_promo_export_0418.xml", cp: "BrightMart Retail", type: "Trade Promo", status: "ready" as const, when: "4h ago" },
                { src: "manual" as Path, fmt: "Form", lane: "data" as const, doc: "Blackwood verbal deal — draft", cp: "Blackwood Studios", type: "Royalty License", status: "needs-review" as const, when: "2h ago" },
              ].map((row, i) => {
                const laneTone = row.lane === "doc" ? "text-orange-700 bg-orange-50 border-orange-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
                const laneLabel = row.lane === "doc" ? "Extract" : "Map";
                const laneIcon = row.lane === "doc" ? <Sparkles className="h-2.5 w-2.5" /> : <GitMerge className="h-2.5 w-2.5" />;
                return (
                <tr key={i} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5"><PathPill path={row.src} /></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <FormatChip label={row.fmt} lane={row.lane} />
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${laneTone}`}>
                        {laneIcon}{laneLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                      {row.lane === "doc" ? <FileText className="h-3 w-3 text-zinc-400" /> : <FileSpreadsheet className="h-3 w-3 text-zinc-400" />}
                      <span className="truncate max-w-[180px]">{row.doc}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-zinc-700">{row.cp}</td>
                  <td className="px-2 py-2.5 text-zinc-600">{row.type}</td>
                  <td className="px-2 py-2.5"><StatusChip status={row.status} /></td>
                  <td className="px-2 py-2.5 text-zinc-500 text-[11px]">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {row.when}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status === "ready" || row.status === "needs-review" ? (
                      <button className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 inline-flex items-center gap-0.5">
                        Open <ChevronRight className="h-3 w-3" />
                      </button>
                    ) : row.status === "processing" ? (
                      <span className="text-[11px] text-zinc-400">—</span>
                    ) : (
                      <button className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-0.5">
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
