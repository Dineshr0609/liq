import {
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  List,
  Bot,
  Sparkles,
  Eye,
  Pencil,
  GitBranch,
  FileSignature,
  ShieldCheck,
  MoreHorizontal,
  Plus,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Users,
  FileText,
  ArrowRight,
  Send,
  History,
  Star,
  Flag,
  Circle,
  Activity,
} from "lucide-react";

type Status = "active" | "draft" | "pending-approval" | "expiring" | "expired" | "amended" | "in-revision";
type Risk = "low" | "med" | "high";

const statusMeta: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  draft: { label: "Draft", bg: "bg-zinc-100", text: "text-zinc-700", dot: "bg-zinc-400" },
  "pending-approval": { label: "Pending approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  expiring: { label: "Expiring < 60d", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  expired: { label: "Expired", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  amended: { label: "Amended", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "in-revision": { label: "In revision", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
};

function StatusPill({ status }: { status: Status }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function RiskDot({ risk }: { risk: Risk }) {
  const map = { low: "bg-emerald-500", med: "bg-amber-500", high: "bg-rose-500" };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[risk]}`} title={`Risk: ${risk}`} />;
}

const contracts = [
  { id: "C-2026-0142", name: "Acme Industries — MSA 2026", type: "Master License", cp: "Acme Industries", status: "active" as Status, value: "$2.4M", endDate: "Dec 31, 2026", risk: "low" as Risk, version: "v1", parties: 6, rules: 12, lastEvent: "Calc posted · 2h ago", flag: false },
  { id: "C-2026-0141", name: "Vortex Studios — Renewal", type: "Royalty License", cp: "Vortex Studios", status: "in-revision" as Status, value: "$840K", endDate: "Jun 30, 2026", risk: "med" as Risk, version: "v3 (draft)", parties: 4, rules: 8, lastEvent: "You revised § 4.2 · 1d ago", flag: true },
  { id: "C-2026-0138", name: "Northwind Traders — Distribution", type: "Distribution", cp: "Northwind Traders", status: "pending-approval" as Status, value: "$1.1M", endDate: "Mar 31, 2027", risk: "low" as Risk, version: "v2", parties: 5, rules: 14, lastEvent: "Awaiting CFO approval · 3d", flag: false },
  { id: "C-2026-0136", name: "Helix Pharma — Supply Agreement", type: "Supply", cp: "Helix Pharma", status: "active" as Status, value: "$3.8M", endDate: "Dec 31, 2027", risk: "high" as Risk, version: "v1", parties: 7, rules: 18, lastEvent: "Risk re-assessed · 4d ago", flag: true },
  { id: "C-2026-0134", name: "BrightMart — Promo Program Q2", type: "Rebate Program", cp: "BrightMart Retail", status: "active" as Status, value: "$420K", endDate: "Jun 30, 2026", risk: "low" as Risk, version: "v1", parties: 3, rules: 6, lastEvent: "12 sales matched · 6h ago", flag: false },
  { id: "C-2026-0129", name: "Crestline Distrib — Reseller", type: "Reseller", cp: "Crestline Distrib LLC", status: "expiring" as Status, value: "$680K", endDate: "May 14, 2026", risk: "med" as Risk, version: "v2", parties: 4, rules: 9, lastEvent: "Renewal proposed by Advisor · 1d", flag: true },
  { id: "C-2026-0118", name: "Pinnacle Retail — Rate Card", type: "Pricing", cp: "Pinnacle Retail", status: "amended" as Status, value: "$1.2M", endDate: "Dec 31, 2026", risk: "low" as Risk, version: "v2 → v3", parties: 4, rules: 11, lastEvent: "Amendment #A-04 effective · 5d", flag: false },
  { id: "C-2026-0102", name: "Blackwood Studios — Verbal Deal", type: "Royalty License", cp: "Blackwood Studios", status: "draft" as Status, value: "$280K", endDate: "TBD", risk: "high" as Risk, version: "v1 (draft)", parties: 2, rules: 0, lastEvent: "Validator: missing payment freq · 1d", flag: true },
];

function ActionButton({ icon: Icon, label, color = "zinc" }: { icon: any; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    zinc: "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
    orange: "text-orange-700 hover:text-orange-800 hover:bg-orange-50",
    blue: "text-blue-700 hover:text-blue-800 hover:bg-blue-50",
    purple: "text-purple-700 hover:text-purple-800 hover:bg-purple-50",
    amber: "text-amber-700 hover:text-amber-800 hover:bg-amber-50",
    emerald: "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50",
  };
  return (
    <button className={`inline-flex items-center justify-center h-6 w-6 rounded ${colorMap[color]}`} title={label}>
      <Icon className="h-3 w-3" />
    </button>
  );
}

export default function ContractManagement() {
  return (
    <div className="bg-zinc-50 text-zinc-900 font-sans text-xs">
      {/* Header with mode toggle */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-0.5">
              <span>Contracts</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Management</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900">Contract Management</h1>
          </div>

          {/* Dual mode toggle */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center bg-zinc-100 rounded-md p-0.5 border border-zinc-200">
              <button className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-zinc-900 bg-white rounded shadow-sm">
                <List className="h-3.5 w-3.5" />List mode
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-700">
                <Bot className="h-3.5 w-3.5" />Agent mode
              </button>
            </div>
            <div className="h-5 w-px bg-zinc-200" />
            <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />Export</button>
            <button className="text-xs px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white font-semibold inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />New contract</button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-6 gap-0 border-t border-zinc-100">
          {[
            { label: "Active", val: "418", sub: "$94.2M ACV", icon: CheckCircle2, color: "text-emerald-600" },
            { label: "Up for renewal < 90d", val: "27", sub: "$8.4M at risk", icon: Calendar, color: "text-orange-600" },
            { label: "Pending approval", val: "9", sub: "Avg 3.2d in queue", icon: Clock, color: "text-amber-600" },
            { label: "In revision", val: "12", sub: "4 awaiting party sign-off", icon: GitBranch, color: "text-purple-600" },
            { label: "At risk (high)", val: "8", sub: "3 new this week", icon: AlertTriangle, color: "text-rose-600" },
            { label: "This month posted", val: "$2.1M", sub: "112% of forecast", icon: TrendingUp, color: "text-emerald-600" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="px-4 py-2.5 border-r border-zinc-100 last:border-r-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={`h-3 w-3 ${s.color}`} />
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">{s.label}</span>
                </div>
                <div className="text-lg font-bold text-zinc-900 leading-tight">{s.val}</div>
                <div className="text-[10px] text-zinc-500">{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================ LIST MODE ============================ */}
      <div className="border-b-4 border-zinc-200">
        <div className="bg-zinc-100 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5"><List className="h-3 w-3" />List mode — power-user view</span>
          <span className="text-zinc-400 normal-case font-normal">Filters · bulk ops · 5 actions per row</span>
        </div>

        <div className="flex bg-white">
          {/* Filter rail */}
          <aside className="w-52 shrink-0 border-r border-zinc-200 px-3 py-3 space-y-3 text-[11px]">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input placeholder="Search 458 contracts…" className="text-[11px] pl-6 pr-2 py-1 rounded border border-zinc-200 w-full focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Saved views</div>
              {[
                { l: "All contracts", n: 458, active: true },
                { l: "★ My contracts", n: 47 },
                { l: "★ Up for renewal", n: 27 },
                { l: "★ Approval queue", n: 9 },
                { l: "★ High risk", n: 8 },
              ].map((f) => (
                <button key={f.l} className={`w-full flex items-center justify-between px-2 py-0.5 rounded hover:bg-zinc-100 ${f.active ? "bg-orange-50 text-orange-800 font-bold" : "text-zinc-700"}`}>
                  <span className="truncate">{f.l}</span>
                  <span className="text-[10px] text-zinc-500">{f.n}</span>
                </button>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between">
                <span>Status</span><ChevronDown className="h-3 w-3" />
              </div>
              {(["active", "in-revision", "pending-approval", "expiring", "amended", "draft", "expired"] as Status[]).map((s) => (
                <label key={s} className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-zinc-50 rounded cursor-pointer">
                  <input type="checkbox" defaultChecked={s !== "expired"} className="rounded h-3 w-3" />
                  <StatusPill status={s} />
                </label>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Contract type</div>
              {["Master License", "Royalty License", "Distribution", "Supply", "Rebate Program", "Pricing", "Reseller"].map((t) => (
                <label key={t} className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-zinc-50 rounded cursor-pointer text-[11px] text-zinc-700">
                  <input type="checkbox" defaultChecked className="rounded h-3 w-3" />
                  <span className="truncate">{t}</span>
                </label>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Risk</div>
              <div className="flex items-center gap-2 px-2">
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" defaultChecked className="rounded h-3 w-3" /><RiskDot risk="low" /></label>
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" defaultChecked className="rounded h-3 w-3" /><RiskDot risk="med" /></label>
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" defaultChecked className="rounded h-3 w-3" /><RiskDot risk="high" /></label>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Counterparty</div>
              <input placeholder="Filter by party…" className="text-[11px] px-2 py-1 rounded border border-zinc-200 w-full focus:outline-none" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Effective range</div>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="From" className="text-[10px] px-1.5 py-1 rounded border border-zinc-200 w-full" />
                <input type="text" placeholder="To" className="text-[10px] px-1.5 py-1 rounded border border-zinc-200 w-full" />
              </div>
            </div>
          </aside>

          {/* Table */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-1.5 flex items-center gap-3">
              <input type="checkbox" className="rounded" />
              <span className="text-[11px] text-zinc-500"><span className="font-bold text-zinc-800">2</span> selected of 458</span>
              <div className="h-4 w-px bg-zinc-200" />
              <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><FileSignature className="h-3 w-3" />Bulk amend</button>
              <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Bulk approve</button>
              <button className="text-[11px] font-semibold text-zinc-700 hover:text-orange-700 inline-flex items-center gap-1"><Download className="h-3 w-3" />Export selection</button>
              <div className="ml-auto text-[10px] text-zinc-500 inline-flex items-center gap-2">
                <span>Sort: <span className="font-semibold text-zinc-700">Last event ↓</span></span>
                <Settings className="h-3 w-3" />
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-[11px]">
              <thead className="bg-white text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                <tr>
                  <th className="px-3 py-2 w-7"><input type="checkbox" className="rounded" /></th>
                  <th className="px-1 py-2 w-4"></th>
                  <th className="text-left font-semibold px-2 py-2">Contract</th>
                  <th className="text-left font-semibold px-2 py-2">Type</th>
                  <th className="text-left font-semibold px-2 py-2">Status · Version</th>
                  <th className="text-right font-semibold px-2 py-2">Value · End</th>
                  <th className="text-center font-semibold px-2 py-2">Parties · Rules</th>
                  <th className="text-left font-semibold px-2 py-2">Last event</th>
                  <th className="text-right font-semibold px-3 py-2 w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-orange-50/30 group">
                    <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
                    <td className="px-1 py-2 text-center">
                      {c.flag ? <Flag className="h-3 w-3 text-orange-600 inline" /> : <RiskDot risk={c.risk} />}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-bold text-zinc-900 truncate max-w-[260px]">{c.name}</div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                        <span className="font-mono">{c.id}</span>
                        <span>·</span>
                        <span className="truncate">{c.cp}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-zinc-700 text-[10px]">{c.type}</td>
                    <td className="px-2 py-2">
                      <StatusPill status={c.status} />
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">{c.version}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="font-bold text-zinc-900">{c.value}</div>
                      <div className="text-[10px] text-zinc-500">{c.endDate}</div>
                    </td>
                    <td className="px-2 py-2 text-center text-[10px] text-zinc-600">
                      <span className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{c.parties}</span>
                      <span className="mx-1 text-zinc-300">·</span>
                      <span>{c.rules} rules</span>
                    </td>
                    <td className="px-2 py-2 text-[10px] text-zinc-600 max-w-[180px] truncate" title={c.lastEvent}>{c.lastEvent}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <ActionButton icon={Eye} label="View — read-only deep dive" color="zinc" />
                        <ActionButton icon={Pencil} label="Update — quick metadata edit (no version)" color="blue" />
                        <ActionButton icon={GitBranch} label="Revise — draft a new working version" color="purple" />
                        <ActionButton icon={FileSignature} label="Amend — formal amendment with effective date" color="orange" />
                        <ActionButton icon={ShieldCheck} label="Approve — sign off on pending changes" color="emerald" />
                        <div className="h-4 w-px bg-zinc-200 mx-0.5" />
                        <ActionButton icon={MoreHorizontal} label="More" color="zinc" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Action legend */}
            <div className="bg-zinc-50 border-t border-zinc-200 px-4 py-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">5 actions, clearly distinct</div>
              <div className="grid grid-cols-5 gap-2 text-[10px]">
                {[
                  { icon: Eye, label: "View", desc: "Read-only deep dive · no audit event", color: "zinc" },
                  { icon: Pencil, label: "Update", desc: "Quick metadata fix · no new version · audited", color: "blue" },
                  { icon: GitBranch, label: "Revise", desc: "Draft new working version · not yet effective", color: "purple" },
                  { icon: FileSignature, label: "Amend", desc: "Formal amendment · effective date · approval required", color: "orange" },
                  { icon: ShieldCheck, label: "Approve", desc: "Sign off pending changes · advances workflow", color: "emerald" },
                ].map((a) => {
                  const Icon = a.icon;
                  const colorMap: Record<string, string> = { zinc: "text-zinc-600 bg-zinc-100", blue: "text-blue-700 bg-blue-50", purple: "text-purple-700 bg-purple-50", orange: "text-orange-700 bg-orange-50", emerald: "text-emerald-700 bg-emerald-50" };
                  return (
                    <div key={a.label} className="flex items-start gap-1.5 p-1.5 bg-white rounded border border-zinc-100">
                      <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${colorMap[a.color]}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-900 text-[11px]">{a.label}</div>
                        <div className="text-[9px] text-zinc-600 leading-snug">{a.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================ AGENT MODE ============================ */}
      <div>
        <div className="bg-zinc-100 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5"><Bot className="h-3 w-3 text-orange-600" />Agent mode — conversational view (same data, ask &amp; act)</span>
          <span className="text-zinc-400 normal-case font-normal">Best for: triage, "what should I do today", complex queries across the portfolio</span>
        </div>

        <div className="bg-gradient-to-b from-orange-50/40 to-white px-5 py-4">
          {/* Briefing card from Advisor agent */}
          <div className="bg-white border-2 border-orange-200 rounded-lg p-3 mb-3 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <div className="h-7 w-7 rounded bg-orange-100 flex items-center justify-center text-orange-700 shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-bold text-zinc-900">liQ Advisor — your morning brief</span>
                  <span className="text-[10px] text-zinc-500">10:46 AM · Friday Apr 18</span>
                </div>
                <div className="text-[11px] text-zinc-700 mt-1 leading-relaxed">
                  Good morning. Out of <b>458 active contracts</b>, here's what needs you today: <b>3 high-priority items</b>. I've already auto-handled 12 routine items overnight (re-OCR'd 4 documents, matched 7 unmatched parties, flagged 1 rate drop for review).
                </div>
              </div>
            </div>

            {/* Briefing items */}
            <div className="space-y-2 ml-9">
              {[
                {
                  priority: "high",
                  title: "Vortex Studios renewal expires in 73 days — and rate negotiation hasn't started",
                  detail: "Last year's deal closed 11 days late and cost ~$40K in pro-rata fees. I drafted renewal terms based on the prior contract + current market data. Want to review?",
                  actions: ["Review draft", "Open contract", "Snooze 7d"],
                },
                {
                  priority: "high",
                  title: "Helix Pharma — risk re-assessed to HIGH (rebate exposure +$280K vs. forecast)",
                  detail: "March sales triggered tier-3 rebate that wasn't accrued. Validator caught it at 09:14. Recommendation: post catch-up accrual + amend rule § 3.2 to clarify tier triggers.",
                  actions: ["See accrual", "Amend rule", "Snooze"],
                },
                {
                  priority: "med",
                  title: "9 contracts in approval queue — 3 are blocking month-end close",
                  detail: "Northwind Distribution (3d in queue, you're the approver), BrightMart Q2 (2d), Acme Addendum #4 (1d). All amendments are minor — ready for batch approval.",
                  actions: ["Review all 3", "Batch approve", "Reassign"],
                },
              ].map((b, i) => (
                <div key={i} className={`border rounded p-2.5 ${b.priority === "high" ? "border-rose-200 bg-rose-50/30" : "border-amber-200 bg-amber-50/30"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${b.priority === "high" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>{b.priority}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-zinc-900 leading-snug">{b.title}</div>
                      <div className="text-[10px] text-zinc-700 mt-0.5 leading-relaxed">{b.detail}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {b.actions.map((a, j) => (
                          <button key={a} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${j === 0 ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"}`}>
                            {a}{j === 0 && " →"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation surface */}
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {/* Conversation history */}
            <div className="p-3 space-y-2.5 border-b border-zinc-100">
              {/* User msg */}
              <div className="flex items-start gap-2 justify-end">
                <div className="bg-zinc-100 rounded-lg rounded-tr-none px-3 py-1.5 max-w-[70%]">
                  <div className="text-[11px] text-zinc-900">Show me all distribution contracts in EU expiring in the next 6 months, sorted by value.</div>
                </div>
                <div className="h-6 w-6 rounded-full bg-zinc-300 flex items-center justify-center text-[10px] font-bold text-zinc-700 shrink-0">SR</div>
              </div>

              {/* Agent reply */}
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded bg-orange-100 flex items-center justify-center text-orange-700 shrink-0">
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-zinc-700 mb-1.5">Found <b>4 distribution contracts</b> in EU expiring before Oct 18, 2026. Total value <b>$3.2M</b>. Two are with the same counterparty (BrightMart) — you might want to renew them together.</div>

                  {/* Inline result card (smaller table) */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-white border-b border-zinc-200 text-[9px] uppercase text-zinc-500">
                        <tr>
                          <th className="text-left px-2 py-1 font-semibold">Contract</th>
                          <th className="text-left px-2 py-1 font-semibold">Counterparty</th>
                          <th className="text-left px-2 py-1 font-semibold">Region</th>
                          <th className="text-right px-2 py-1 font-semibold">Value</th>
                          <th className="text-right px-2 py-1 font-semibold">Expires</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {[
                          { id: "C-2026-0091", n: "BrightMart EU — Distribution Tier-1", cp: "BrightMart Retail", r: "EU-DE", v: "$1.4M", e: "Aug 12, 2026" },
                          { id: "C-2026-0089", n: "BrightMart EU — Distribution Tier-2", cp: "BrightMart Retail", r: "EU-FR", v: "$840K", e: "Aug 12, 2026" },
                          { id: "C-2026-0076", n: "Crestline Distrib — Reseller", cp: "Crestline Distrib LLC", r: "EU-NL", v: "$680K", e: "May 14, 2026" },
                          { id: "C-2026-0064", n: "Northwind EU — Reseller", cp: "Northwind Traders", r: "EU-PL", v: "$280K", e: "Sep 30, 2026" },
                        ].map((r) => (
                          <tr key={r.id} className="hover:bg-white">
                            <td className="px-2 py-1.5">
                              <div className="font-semibold text-zinc-900 truncate max-w-[200px]">{r.n}</div>
                              <div className="text-[9px] text-zinc-500 font-mono">{r.id}</div>
                            </td>
                            <td className="px-2 py-1.5 text-zinc-700">{r.cp}</td>
                            <td className="px-2 py-1.5"><span className="text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{r.r}</span></td>
                            <td className="px-2 py-1.5 text-right font-bold text-zinc-900">{r.v}</td>
                            <td className="px-2 py-1.5 text-right text-zinc-700">{r.e}</td>
                            <td className="px-2 py-1.5 text-right">
                              <button className="text-[9px] font-semibold text-orange-700 hover:underline">Open →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Suggested follow-ups */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wide">Suggested next:</span>
                    {[
                      "Draft renewal terms for all 4",
                      "Bundle the 2 BrightMart contracts",
                      "Show similar contracts that expired last year",
                      "Compare values vs. last renewal",
                    ].map((s) => (
                      <button key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 font-semibold">{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action ack from agent */}
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0 bg-purple-50/50 border border-purple-200 rounded px-2.5 py-1.5">
                  <div className="text-[11px] text-purple-900 font-semibold">Resolver agent: I drafted renewal terms for the 2 BrightMart contracts — bundled at <b>$2.31M</b> (3% volume discount applied). Ready for your review before sending to legal?</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button className="text-[10px] font-bold bg-orange-600 text-white px-2 py-0.5 rounded hover:bg-orange-700">Review draft →</button>
                    <button className="text-[10px] font-semibold text-zinc-700 px-2 py-0.5 rounded border border-zinc-200 hover:bg-white">Modify terms</button>
                    <button className="text-[10px] font-semibold text-zinc-500 px-2 py-0.5 hover:underline">Discard</button>
                    <span className="ml-auto text-[9px] text-zinc-400">Action will be logged · undo within 24h</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="bg-white px-3 py-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input
                    placeholder="Ask anything about your contracts… e.g. 'which contracts are exposed to FX risk above $500K'"
                    className="w-full text-[11px] px-3 py-2 rounded-md border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-orange-400 focus:bg-white"
                  />
                </div>
                <button className="text-xs px-3 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white font-semibold inline-flex items-center gap-1.5">
                  <Send className="h-3 w-3" />Ask
                </button>
              </div>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wide">Try:</span>
                {[
                  "What's at risk this quarter?",
                  "Find amendments pending > 5 days",
                  "Top 10 contracts by value",
                  "Which counterparties have us as customer AND vendor?",
                  "Summarize Helix Pharma exposure",
                ].map((s) => (
                  <button key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode philosophy footer */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-white border border-zinc-200 rounded p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1 mb-1"><List className="h-3 w-3" />When to use List mode</div>
              <ul className="text-[10px] text-zinc-700 space-y-0.5 leading-snug">
                <li>· Bulk operations (approve 12 contracts, export selection)</li>
                <li>· You know exactly which contract you want</li>
                <li>· Power-user filtering with multi-facet criteria</li>
                <li>· Reporting / audit views</li>
              </ul>
            </div>
            <div className="bg-white border border-orange-200 rounded p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 inline-flex items-center gap-1 mb-1"><Bot className="h-3 w-3" />When to use Agent mode</div>
              <ul className="text-[10px] text-zinc-700 space-y-0.5 leading-snug">
                <li>· "What should I do today?" — morning brief</li>
                <li>· Complex queries that span the portfolio</li>
                <li>· You want the agent to <i>do</i> things, not just show them</li>
                <li>· Triage / exploration / "tell me what's weird"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
