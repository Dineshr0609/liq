import {
  Inbox,
  Search,
  Filter,
  Bot,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Settings,
  FileText,
  FileSpreadsheet,
  FileCode2,
  Mail,
  Upload,
  Plug,
  PenLine,
  GitMerge,
  Zap,
  Pause,
  Play,
  Eye,
  RotateCw,
  ShieldCheck,
  Wand2,
  ArrowRight,
  MoreHorizontal,
  Download,
  Users,
} from "lucide-react";

type Path = "upload" | "email" | "connector" | "manual";
type Lane = "doc" | "data";
type Autonomy = "observe" | "suggest" | "approve" | "auto";

const pathMeta: Record<Path, { icon: any; tone: string; bg: string }> = {
  upload: { icon: Upload, tone: "text-orange-700", bg: "bg-orange-100" },
  email: { icon: Mail, tone: "text-blue-700", bg: "bg-blue-100" },
  connector: { icon: Plug, tone: "text-purple-700", bg: "bg-purple-100" },
  manual: { icon: PenLine, tone: "text-zinc-700", bg: "bg-zinc-200" },
};

function PathPill({ path }: { path: Path }) {
  const m = pathMeta[path];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center justify-center h-5 w-5 rounded ${m.bg} ${m.tone}`}>
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

function LaneTag({ lane }: { lane: Lane }) {
  return lane === "doc" ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded uppercase">
      <Sparkles className="h-2.5 w-2.5" />Extract
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase">
      <GitMerge className="h-2.5 w-2.5" />Map
    </span>
  );
}

function AutonomyBadge({ level }: { level: Autonomy }) {
  const map = {
    observe: { label: "Observe", chip: "bg-zinc-100 text-zinc-700 border-zinc-200" },
    suggest: { label: "Suggest", chip: "bg-blue-50 text-blue-700 border-blue-200" },
    approve: { label: "Auto · approval", chip: "bg-amber-50 text-amber-700 border-amber-200" },
    auto: { label: "Auto", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  } as const;
  const m = map[level];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${m.chip}`}>
      {m.label}
    </span>
  );
}

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: any;
  color: string;
  state: "running" | "idle" | "paused";
  current: string;
  inflight: number;
  successRate: number;
  autonomy: Autonomy;
};

const agents: Agent[] = [
  { id: "intake", name: "Intake", role: "Routes by file type → lane", icon: Inbox, color: "text-zinc-700", state: "running", current: "Sorting 4 new uploads", inflight: 4, successRate: 99.4, autonomy: "auto" },
  { id: "extractor", name: "Extractor", role: "OCR + LLM on documents", icon: Sparkles, color: "text-orange-600", state: "running", current: "Acme-MSA-2026.pdf · page 12 / 47", inflight: 3, successRate: 96.1, autonomy: "auto" },
  { id: "mapper", name: "Mapper", role: "Schema-map structured rows", icon: GitMerge, color: "text-emerald-600", state: "running", current: "Salesforce CPQ → contracts (12 rows)", inflight: 2, successRate: 98.7, autonomy: "approve" },
  { id: "validator", name: "Validator", role: "Schema + business rules", icon: ShieldCheck, color: "text-blue-600", state: "running", current: "Checking 18 contracts vs. type rules", inflight: 18, successRate: 99.9, autonomy: "auto" },
  { id: "resolver", name: "Resolver", role: "Auto-fix: re-OCR, retry, party-match", icon: Wand2, color: "text-purple-600", state: "running", current: "Re-OCR’d Vortex_Renewal_v4.pdf @ high-res", inflight: 1, successRate: 87.5, autonomy: "approve" },
  { id: "watchdog", name: "Watchdog", role: "Stuck items, drift, escalations", icon: Activity, color: "text-rose-600", state: "running", current: "Escalated SharePoint sync failure to ops", inflight: 0, successRate: 100, autonomy: "auto" },
];

export default function IngestionInbox() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans text-xs">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-0.5">
              <span>Contracts</span><ChevronRight className="h-3 w-3" /><span>Ingest</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Inbox</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900">Ingestion Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input placeholder="Search 1,247 records…" className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-72 focus:outline-none focus:border-orange-400" />
            </div>
            <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />Export</button>
            <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Agent settings</button>
          </div>
        </div>
      </div>

      {/* Agent fleet strip */}
      <div className="bg-gradient-to-b from-orange-50/60 to-white border-b border-orange-100 px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-orange-700" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-orange-800">Agent Fleet</h2>
            <span className="text-[10px] text-zinc-500">6 agents · 28 in flight · last 24h: 1,247 ingested · 89% touchless</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />All agents healthy</span>
            <button className="text-orange-700 font-semibold hover:underline inline-flex items-center gap-0.5">Pipeline diagram <ChevronRight className="h-3 w-3" /></button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {agents.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="bg-white border border-zinc-200 rounded-md p-2.5 hover:border-orange-300 hover:shadow-sm transition-all relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-7 w-7 rounded-md bg-zinc-50 flex items-center justify-center ${a.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-zinc-900 truncate flex items-center gap-1">
                      {a.name}
                      <span className={`h-1.5 w-1.5 rounded-full ${a.state === "running" ? "bg-emerald-500 animate-pulse" : a.state === "paused" ? "bg-amber-500" : "bg-zinc-300"}`} />
                    </div>
                    <div className="text-[9px] text-zinc-500 truncate">{a.role}</div>
                  </div>
                </div>
                <div className="text-[9px] text-zinc-700 bg-zinc-50 rounded px-1.5 py-1 leading-tight mb-1.5 truncate" title={a.current}>
                  <span className="text-orange-600 font-bold">▸</span> {a.current}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <AutonomyBadge level={a.autonomy} />
                  <div className="text-[9px] text-zinc-500">
                    <span className="font-bold text-zinc-700">{a.inflight}</span> · <span className="font-semibold text-emerald-700">{a.successRate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body: 2 columns (filter rail + inbox) */}
      <div className="flex">
        {/* Filter rail */}
        <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 px-3 py-3 space-y-3 text-[11px]">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Status</div>
            {[
              { l: "Inbox (all)", n: 1247, active: true },
              { l: "Needs my action", n: 47, tone: "amber" },
              { l: "Agents working on it", n: 28, tone: "blue" },
              { l: "Awaiting approval", n: 9, tone: "amber" },
              { l: "Ready to activate", n: 142, tone: "emerald" },
              { l: "Failed / stuck", n: 8, tone: "rose" },
              { l: "Archived", n: 1013 },
            ].map((f) => (
              <button key={f.l} className={`w-full flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-100 ${f.active ? "bg-orange-50 text-orange-800 font-bold" : "text-zinc-700"}`}>
                <span className="truncate">{f.l}</span>
                <span className={`text-[10px] font-semibold ${f.tone === "amber" ? "text-amber-700" : f.tone === "rose" ? "text-rose-700" : f.tone === "emerald" ? "text-emerald-700" : f.tone === "blue" ? "text-blue-700" : "text-zinc-500"}`}>{f.n}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between">
              <span>Stage</span>
              <ChevronDown className="h-3 w-3" />
            </div>
            {[
              { l: "Received", n: 12 },
              { l: "OCR", n: 4 },
              { l: "AI extracting", n: 8 },
              { l: "Field mapping", n: 6 },
              { l: "Counterparty match", n: 12 },
              { l: "Validating", n: 18 },
              { l: "Resolved by agent", n: 87 },
            ].map((f) => (
              <button key={f.l} className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700">
                <span className="truncate">{f.l}</span>
                <span className="text-[10px] text-zinc-500">{f.n}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Source</div>
            {[
              { l: "Upload", n: 412, p: "upload" as Path },
              { l: "Email", n: 187, p: "email" as Path },
              { l: "Connector", n: 614, p: "connector" as Path },
              { l: "Manual", n: 34, p: "manual" as Path },
            ].map((f) => (
              <button key={f.l} className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700">
                <span className="inline-flex items-center gap-1.5"><PathPill path={f.p} />{f.l}</span>
                <span className="text-[10px] text-zinc-500">{f.n}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Lane</div>
            <button className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700">
              <LaneTag lane="doc" /><span className="text-[10px] text-zinc-500">587</span>
            </button>
            <button className="w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 text-zinc-700">
              <LaneTag lane="data" /><span className="text-[10px] text-zinc-500">660</span>
            </button>
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Date received</div>
            {["Today", "This week", "This month", "Last quarter", "All time"].map((d, i) => (
              <button key={d} className={`w-full text-left px-2 py-0.5 rounded hover:bg-zinc-100 ${i === 4 ? "bg-zinc-100 font-semibold" : ""} text-zinc-700`}>{d}</button>
            ))}
          </div>
        </aside>

        {/* Inbox table */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-3">
            <input type="checkbox" className="rounded" />
            <span className="text-[11px] text-zinc-500"><span className="font-bold text-zinc-800">3</span> selected of 1,247</span>
            <div className="h-4 w-px bg-zinc-200" />
            <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><Wand2 className="h-3 w-3" />Run Resolver agent</button>
            <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><RotateCw className="h-3 w-3" />Retry</button>
            <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><Users className="h-3 w-3" />Reassign</button>
            <button className="text-[11px] font-semibold text-zinc-700 hover:text-rose-700 inline-flex items-center gap-1">Archive</button>
            <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
              <Filter className="h-3 w-3" />
              <span>Showing all-time · sorted by aged ↓</span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-2 w-7"><input type="checkbox" className="rounded" /></th>
                <th className="text-left font-semibold px-2 py-2">Item</th>
                <th className="text-left font-semibold px-2 py-2">Src · Lane</th>
                <th className="text-left font-semibold px-2 py-2">Stage</th>
                <th className="text-left font-semibold px-2 py-2">Status</th>
                <th className="text-left font-semibold px-2 py-2">Received</th>
                <th className="text-left font-semibold px-2 py-2">Aged</th>
                <th className="text-left font-semibold px-2 py-2">Agent on it</th>
                <th className="text-right font-semibold px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {([
                { item: "Vortex_License_Renewal_v4.pdf", cp: "Vortex Studios", src: "email", lane: "doc", stage: "OCR", status: "agent-working", received: "Mar 31", aged: "18d", agent: "Resolver", agentNote: "Re-OCR @ high-res in progress", danger: true },
                { item: "SF-OPP-7124 → Contract", cp: "Northwind Traders", src: "connector", lane: "data", stage: "Field mapping", status: "needs-approval", received: "Apr 13", aged: "5d", agent: "Mapper", agentNote: "Suggested mapping for 3 fields — review", warn: true },
                { item: "Q1_distributor_terms.xlsx", cp: '"Crestline Distrib LLC" (no match)', src: "upload", lane: "data", stage: "Counterparty match", status: "needs-approval", received: "Apr 16", aged: "2d", agent: "Resolver", agentNote: "Proposed: create new partner record" },
                { item: "Acme-MSA-2026.pdf", cp: "Acme Industries", src: "upload", lane: "doc", stage: "AI extracting", status: "agent-working", received: "Today 10:42", aged: "2m", agent: "Extractor", agentNote: "Page 12 of 47" },
                { item: "rate_card_q2_2026.xlsx", cp: "Pinnacle Retail", src: "upload", lane: "data", stage: "Validating", status: "needs-review", received: "Today 10:14", aged: "28m", agent: "Validator", agentNote: "2 rate tiers below floor — flagged", warn: true },
                { item: "TPM_promo_export_0418.xml", cp: "BrightMart Retail", src: "connector", lane: "data", stage: "Resolved by agent", status: "ready", received: "Today 06:00", aged: "4h", agent: "Mapper", agentNote: "Auto-resolved 12 rows · 1 contract created", success: true },
                { item: "DocuSign env. 4421-A", cp: "Helix Pharma", src: "connector", lane: "doc", stage: "Resolved by agent", status: "ready", received: "Yesterday", aged: "1d", agent: "Extractor", agentNote: "98% confidence — no review needed", success: true },
                { item: "Re: Renewal terms attached", cp: "(unmatched sender)", src: "email", lane: "doc", stage: "Counterparty match", status: "agent-working", received: "Yesterday", aged: "1d", agent: "Resolver", agentNote: "Searching partner master · 4 candidates" },
                { item: "Blackwood verbal deal — draft", cp: "Blackwood Studios", src: "manual", lane: "data", stage: "Validating", status: "needs-review", received: "Apr 17", aged: "1d", agent: "Validator", agentNote: "Missing: payment freq, royalty base", warn: true },
                { item: "SharePoint batch 0414 (6 files)", cp: "Multiple", src: "connector", lane: "doc", stage: "Received", status: "failed", received: "Apr 14", aged: "4d", agent: "Watchdog", agentNote: "Sync token expired — escalated to ops", danger: true },
              ] as any[]).map((r, i) => {
                const statusMap = {
                  ready: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Ready" },
                  "needs-review": { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Needs review" },
                  "needs-approval": { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", label: "Needs approval" },
                  "agent-working": { dot: "bg-blue-500 animate-pulse", text: "text-blue-700", bg: "bg-blue-50", label: "Agent working" },
                  failed: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Failed" },
                } as any;
                const s = statusMap[r.status];
                return (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-zinc-900 truncate max-w-[240px] flex items-center gap-1">
                        {r.lane === "doc" ? <FileText className="h-3 w-3 text-zinc-400 shrink-0" /> : <FileSpreadsheet className="h-3 w-3 text-zinc-400 shrink-0" />}
                        <span className="truncate">{r.item}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">{r.cp}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <PathPill path={r.src} />
                        <LaneTag lane={r.lane} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-zinc-700">{r.stage}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-zinc-500 text-[10px]">{r.received}</td>
                    <td className="px-2 py-2">
                      <span className={`text-[10px] font-bold ${r.danger ? "text-rose-700" : r.warn ? "text-amber-700" : "text-zinc-600"}`}>{r.aged}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-[10px] font-semibold text-zinc-800 inline-flex items-center gap-1">
                        <Bot className="h-2.5 w-2.5 text-orange-600" />{r.agent}
                      </div>
                      <div className={`text-[9px] truncate max-w-[180px] ${r.success ? "text-emerald-700" : r.danger ? "text-rose-700" : "text-zinc-600"}`} title={r.agentNote}>
                        {r.agentNote}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.status === "needs-approval" ? (
                        <>
                          <button className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 mr-2">Approve</button>
                          <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900">Review</button>
                        </>
                      ) : r.status === "ready" ? (
                        <button className="text-[10px] font-bold text-orange-700 hover:text-orange-800">Open contract →</button>
                      ) : r.status === "failed" ? (
                        <button className="text-[10px] font-bold text-rose-700 hover:text-rose-800">Resolve →</button>
                      ) : (
                        <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900">Watch</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="bg-white border-t border-zinc-200 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-500">
            <span>10 of 1,247 records</span>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50">Prev</button>
              <span>Page 1 of 125</span>
              <button className="px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent activity stream + autonomy controls */}
      <div className="grid grid-cols-3 gap-3 px-5 py-4 bg-zinc-100 border-t border-zinc-200">
        {/* Activity stream */}
        <div className="col-span-2 bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-orange-600" />Agent activity stream
              <span className="text-[10px] font-normal text-zinc-500">live</span>
            </h3>
            <button className="text-[10px] text-zinc-500 hover:text-orange-700">Open audit log →</button>
          </div>
          <div className="divide-y divide-zinc-100 max-h-[320px] overflow-y-auto">
            {[
              { t: "10:46:12", agent: "Resolver", icon: Wand2, color: "text-purple-600", action: "Auto-corrected", target: "Vortex_License_Renewal_v4.pdf", note: "Re-ran OCR with high-res mode after worker timeout. Recovered 47 pages.", level: "auto" as Autonomy, success: true },
              { t: "10:45:58", agent: "Mapper", icon: GitMerge, color: "text-emerald-600", action: "Suggested mapping", target: "SF-OPP-7124 → Contract", note: "rebate_tier → contracts.tier_id (94% confidence). Awaiting approval.", level: "approve" as Autonomy, warn: true },
              { t: "10:45:31", agent: "Watchdog", icon: AlertCircle, color: "text-rose-600", action: "Escalated", target: "SharePoint connector", note: "Sync token expired Apr 14. Posted ticket #INC-4421 to ops · DM’d @marcus.t.", level: "auto" as Autonomy, danger: true },
              { t: "10:44:09", agent: "Validator", icon: ShieldCheck, color: "text-blue-600", action: "Flagged", target: "rate_card_q2_2026.xlsx", note: "2 rate tiers below floor of 0.5%. Held for review (auto-resolve disabled for finance rules).", level: "suggest" as Autonomy, warn: true },
              { t: "10:43:42", agent: "Resolver", icon: Wand2, color: "text-purple-600", action: "Created", target: "Partner: Crestline Distrib LLC", note: "Fuzzy match below threshold. Created new partner from extracted address + tax ID. Linked to upload.", level: "approve" as Autonomy },
              { t: "10:42:21", agent: "Extractor", icon: Sparkles, color: "text-orange-600", action: "Completed", target: "Helix Pharma — DocuSign env. 4421-A", note: "Extracted 9 parties, 12 rules, 3 risks at 98% avg confidence. Promoted to Ready.", level: "auto" as Autonomy, success: true },
              { t: "10:41:55", agent: "Intake", icon: Inbox, color: "text-zinc-700", action: "Routed", target: "4 new uploads", note: "3 → Extract lane, 1 → Map lane (xlsx detected by content sniff, not extension).", level: "auto" as Autonomy },
            ].map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="px-3 py-2 flex items-start gap-2.5 hover:bg-zinc-50">
                  <div className={`h-6 w-6 rounded bg-zinc-50 flex items-center justify-center ${e.color} shrink-0 mt-0.5`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-400 font-mono">{e.t}</span>
                      <span className="text-[11px] font-bold text-zinc-900">{e.agent}</span>
                      <span className={`text-[11px] ${e.success ? "text-emerald-700 font-semibold" : e.danger ? "text-rose-700 font-semibold" : e.warn ? "text-amber-700 font-semibold" : "text-zinc-600"}`}>{e.action}</span>
                      <span className="text-[11px] text-zinc-700 font-medium">{e.target}</span>
                      <AutonomyBadge level={e.level} />
                    </div>
                    <div className="text-[10px] text-zinc-600 leading-snug mt-0.5">{e.note}</div>
                  </div>
                  {e.level === "approve" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded">Approve</button>
                      <button className="text-[10px] font-semibold text-zinc-600 hover:bg-zinc-100 px-1.5 py-0.5 rounded">Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Autonomy controls */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 inline-flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-zinc-500" />Autonomy policy
            </h3>
            <span className="text-[10px] text-zinc-500">Per agent</span>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="text-[10px] text-zinc-600 leading-snug bg-orange-50 border border-orange-200 rounded p-2">
              <span className="font-bold text-orange-800">How autonomy works:</span> Higher levels reduce human work but increase trust required. Agents log every action and can be rolled back.
            </div>
            {agents.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.id} className="border border-zinc-100 rounded p-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`h-3 w-3 ${a.color}`} />
                    <span className="text-[11px] font-bold text-zinc-900 flex-1">{a.name}</span>
                    <AutonomyBadge level={a.autonomy} />
                  </div>
                  <div className="grid grid-cols-4 gap-0.5 text-[8px] font-bold text-center">
                    {(["observe", "suggest", "approve", "auto"] as Autonomy[]).map((lv) => {
                      const active = a.autonomy === lv;
                      const labels = { observe: "Watch", suggest: "Suggest", approve: "Approve", auto: "Auto" };
                      return (
                        <button
                          key={lv}
                          className={`py-1 rounded uppercase tracking-wide ${active ? "bg-orange-600 text-white" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}
                        >
                          {labels[lv]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
