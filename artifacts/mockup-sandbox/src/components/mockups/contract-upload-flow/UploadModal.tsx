import {
  Search,
  Bell,
  Plus,
  MapPin,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Inbox,
  Flag,
  Filter,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

function StatusPill({ tone, children }: { tone: "active" | "review" | "draft" | "expiring"; children: React.ReactNode }) {
  const map = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    review: "bg-amber-50 text-amber-800 border-amber-200",
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    expiring: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${map[tone]}`}>
      {children}
    </span>
  );
}

function FlowChip({ code, name }: { code: string; name: string }) {
  const palette: Record<string, string> = {
    RLA: "bg-violet-50 text-violet-700 border-violet-200",
    CRP: "bg-orange-50 text-orange-700 border-orange-200",
    VRP: "bg-blue-50 text-blue-700 border-blue-200",
    RSM: "bg-teal-50 text-teal-700 border-teal-200",
    IB:  "bg-amber-50 text-amber-800 border-amber-200",
    CB:  "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${palette[code] || "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>
      <span className="font-mono text-[9px] opacity-60">{code}</span>
      <span>{name}</span>
    </span>
  );
}

function Row({
  num, name, cp, flowCode, flowName, status, ver, value, end, parties, rules, last, dim,
}: {
  num: string; name: string; cp: string; flowCode: string; flowName: string;
  status: "active" | "review" | "draft" | "expiring"; ver: string; value: string;
  end: string; parties: number; rules: number; last: string; dim?: boolean;
}) {
  return (
    <tr className={`border-b border-zinc-100 ${dim ? "opacity-50" : "hover:bg-orange-50/30"}`}>
      <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
      <td className="px-1 py-2 text-center"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /></td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5 max-w-[260px]">
          <span className="font-bold text-zinc-900 truncate text-[11px]">{name}</span>
        </div>
        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
          <span className="font-mono">{num}</span><span>·</span><span className="truncate">{cp}</span>
        </div>
      </td>
      <td className="px-2 py-2"><FlowChip code={flowCode} name={flowName} /></td>
      <td className="px-2 py-2">
        <StatusPill tone={status}>{status}</StatusPill>
        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{ver}</div>
      </td>
      <td className="px-2 py-2 text-right">
        <div className="font-bold text-zinc-900 text-[11px]">{value}</div>
        <div className="text-[10px] text-zinc-500">{end}</div>
      </td>
      <td className="px-2 py-2 text-center text-[10px] text-zinc-700">{parties} · {rules}</td>
      <td className="px-2 py-2 text-[10px] text-zinc-600">{last}</td>
    </tr>
  );
}

export function UploadModal() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans relative">
      {/* Top bar */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center text-white font-bold">L</div>
          <div className="text-sm font-bold text-zinc-900">License<span className="text-orange-600">IQ</span></div>
        </div>
        <div className="flex-1 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input className="w-full pl-9 pr-12 py-1.5 text-sm border border-zinc-200 rounded bg-zinc-50" placeholder="Search…" />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-mono">⌘ K</kbd>
        </div>
        <Bell className="h-4 w-4 text-zinc-500" />
        <div className="text-[11px] text-zinc-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> TechSound Audio
        </div>
      </header>

      {/* Page heading */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-zinc-900">Contracts</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">All licensing, rebate, and revenue-share agreements</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 border border-zinc-300 bg-white rounded text-zinc-700 hover:bg-zinc-50">
            <Inbox className="h-3.5 w-3.5" /> Inbox · 4
          </button>
          <button className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Upload contract
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 mb-3 flex items-center gap-2 flex-wrap">
        <button className="text-[10px] px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-700 flex items-center gap-1">
          <Filter className="h-3 w-3" /> Status: All
          <ChevronDown className="h-3 w-3" />
        </button>
        <button className="text-[10px] px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-700 flex items-center gap-1">
          Flow: All <ChevronDown className="h-3 w-3" />
        </button>
        <button className="text-[10px] px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-700 flex items-center gap-1">
          Counterparty <ChevronDown className="h-3 w-3" />
        </button>
        <div className="ml-auto text-[10px] text-zinc-500">42 contracts</div>
      </div>

      {/* Table (dimmed behind modal) */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded border border-zinc-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-2 w-7"><input type="checkbox" className="rounded" /></th>
                <th className="px-1 py-2 w-4"></th>
                <th className="text-left font-semibold px-2 py-2">Contract</th>
                <th className="text-left font-semibold px-2 py-2">Type</th>
                <th className="text-left font-semibold px-2 py-2">Status · Version</th>
                <th className="text-right font-semibold px-2 py-2">Value · End</th>
                <th className="text-center font-semibold px-2 py-2">Parties · Rules</th>
                <th className="text-left font-semibold px-2 py-2">Last event</th>
              </tr>
            </thead>
            <tbody>
              <Row dim num="CNT-2026-045" name="Northwest Distributor Q4 Rebate" cp="Northwest Distribution Co." flowCode="CRP" flowName="Customer Rebate Program" status="active" ver="v2" value="$1,240,000" end="Dec 31, 2026" parties={3} rules={9} last="Updated · 2h ago" />
              <Row dim num="CNT-2026-044" name="AudioTech MFG Royalty License" cp="AudioTech Manufacturing" flowCode="RLA" flowName="Royalty License" status="active" ver="v1" value="$500,000 (min)" end="Dec 31, 2030" parties={2} rules={12} last="Updated · 1d ago" />
              <Row dim num="CNT-2026-043" name="Northwest Mid-Year Rebate Tier" cp="Northwest Distribution Co." flowCode="CRP" flowName="Customer Rebate Program" status="review" ver="v1" value="$640,000" end="Jun 30, 2026" parties={3} rules={6} last="AI extracted · 5h ago" />
              <Row dim num="CNT-2026-040" name="Acme Vendor Rebate Tier 2" cp="Acme Industrial" flowCode="VRP" flowName="Vendor Rebate Program" status="active" ver="v1" value="$220,000" end="Dec 31, 2026" parties={2} rules={4} last="Updated · 3d ago" />
              <Row dim num="CNT-2026-038" name="Pioneer Channel Co-Marketing" cp="Pioneer Audio" flowCode="RSM" flowName="Revenue Share / MDF" status="draft" ver="v1" value="—" end="—" parties={2} rules={2} last="Created · 4d ago" />
              <Row dim num="CNT-2025-098" name="LegacyCo Distribution Agreement" cp="LegacyCo Inc." flowCode="RLA" flowName="Royalty License" status="expiring" ver="v3" value="$95,000" end="Jan 31, 2026" parties={2} rules={5} last="Renewal due" />
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal scrim */}
      <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-[1px] z-40" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
        <div className="bg-white rounded-lg shadow-2xl w-[520px] border border-zinc-200">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-orange-600" />
              <h2 className="text-sm font-bold text-zinc-900">Upload contract</h2>
            </div>
            <button className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Drop zone */}
            <div className="border-2 border-dashed border-orange-300 bg-orange-50/40 rounded-lg p-6 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Upload className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-zinc-900">Drop a file or <span className="text-orange-600 underline cursor-pointer">browse</span></div>
              <div className="text-[10px] text-zinc-500 mt-1">PDF, DOCX, PNG up to 50 MB</div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px]">
                <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-semibold">PDF</span>
                <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-semibold">DOCX</span>
                <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-semibold">PNG</span>
                <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-semibold">JPG</span>
              </div>
            </div>

            {/* Flow type */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1">
                Flow type <span className="text-red-500">*</span>
                <span className="text-[10px] font-normal text-zinc-400 ml-1">— what kind of contract is this?</span>
              </label>
              <div className="mt-1.5 relative">
                <select className="w-full text-[12px] border border-zinc-300 rounded px-2.5 py-1.5 bg-white text-zinc-900 appearance-none pr-8" defaultValue="CRP">
                  <option value="">Select flow type…</option>
                  <option value="RLA">RLA — Royalty License Agreement</option>
                  <option value="CRP">CRP — Customer Rebate Program</option>
                  <option value="VRP">VRP — Vendor Rebate Program</option>
                  <option value="RSM">RSM — Revenue Share / MDF</option>
                  <option value="IB">IB — Inbound Royalty</option>
                  <option value="CB">CB — Chargeback Agreement</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-orange-500" /> Last used: <span className="font-mono font-semibold">CRP</span>
              </div>
            </div>

            {/* More options (collapsed) */}
            <button className="w-full text-left flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700">
              <ChevronRight className="h-3 w-3" /> More options
              <span className="text-[10px] text-zinc-400 ml-1">(priority, notes, processing options)</span>
            </button>

            {/* Selected file preview */}
            <div className="border border-zinc-200 rounded bg-zinc-50/50 px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-zinc-800 truncate">Northwest_Q4_Rebate_2026.pdf</div>
                <div className="text-[10px] text-zinc-500">2.4 MB · 14 pages</div>
              </div>
              <button className="text-zinc-400 hover:text-zinc-700"><X className="h-3 w-3" /></button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between rounded-b-lg">
            <div className="text-[10px] text-zinc-500">~30 sec extract · auto-routed to AI</div>
            <div className="flex items-center gap-2">
              <button className="text-[11px] px-3 py-1.5 text-zinc-600 hover:text-zinc-900">Cancel</button>
              <button className="text-[11px] px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold flex items-center gap-1 shadow-sm">
                Upload & process <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
