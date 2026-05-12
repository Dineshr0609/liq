import {
  Search,
  Bell,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  Tag,
  Pencil,
  CheckCircle2,
  ArrowLeft,
  MapPin,
  Eye,
} from "lucide-react";

function FlowChip({ code, name }: { code: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">
      <span className="font-mono text-[9px] opacity-70">{code}</span>
      <span>{name}</span>
    </span>
  );
}

function MetaRow({ icon, label, value, edit }: { icon: React.ReactNode; label: string; value: string; edit?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-zinc-100 last:border-0">
      <div className="text-zinc-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{label}</div>
        <div className="text-[12px] text-zinc-900 font-semibold mt-0.5">{value}</div>
      </div>
      {edit && <Pencil className="h-3 w-3 text-zinc-300 hover:text-zinc-700 cursor-pointer" />}
    </div>
  );
}

export function ReviewSheet() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans relative">
      {/* Top bar (same as modal page) */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center text-white font-bold">L</div>
          <div className="text-sm font-bold text-zinc-900">License<span className="text-orange-600">IQ</span></div>
        </div>
        <div className="flex-1 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input className="w-full pl-9 pr-12 py-1.5 text-sm border border-zinc-200 rounded bg-zinc-50" placeholder="Search…" />
        </div>
        <Bell className="h-4 w-4 text-zinc-500" />
        <div className="text-[11px] text-zinc-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> TechSound Audio
        </div>
      </header>

      {/* Dim background list (suggested as the in-progress page) */}
      <div className="px-6 py-4 opacity-40 pointer-events-none select-none">
        <div className="bg-white rounded border border-zinc-200 h-[300px]">
          <div className="px-3 py-2 border-b border-zinc-100 text-[11px] font-bold text-zinc-700">Contracts</div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Right slide-over sheet */}
      <div className="fixed inset-0 bg-zinc-900/30 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[640px] bg-white shadow-2xl z-50 border-l border-zinc-200 flex flex-col">
        {/* Sheet header */}
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <button className="text-zinc-400 hover:text-zinc-700"><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Review before creating</h2>
              <div className="text-[10px] text-zinc-500">Verify what the AI extracted, then confirm to create the contract</div>
            </div>
          </div>
          <button className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>

        {/* Stepper inline */}
        <div className="px-5 py-2 border-b border-zinc-100 flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Upload
          </div>
          <div className="h-px w-6 bg-zinc-200" />
          <div className="flex items-center gap-1.5 text-orange-700 font-bold">
            <span className="h-4 w-4 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center">2</span>
            Review & approve
          </div>
          <div className="h-px w-6 bg-zinc-200" />
          <div className="flex items-center gap-1.5 text-zinc-400 font-semibold">
            <span className="h-4 w-4 rounded-full border border-zinc-300 text-[9px] flex items-center justify-center">3</span>
            AI processing
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded p-3 flex items-center gap-3">
            <div className="h-10 w-8 rounded bg-orange-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-zinc-900 truncate">Northwest_Q4_Rebate_2026.pdf</div>
              <div className="text-[10px] text-zinc-500">2.4 MB · 14 pages · 1,431 chars extracted</div>
            </div>
            <button className="text-[10px] flex items-center gap-1 text-zinc-600 hover:text-zinc-900 px-2 py-1 border border-zinc-200 rounded bg-white">
              <Eye className="h-3 w-3" /> Preview
            </button>
          </div>

          {/* AI Summary */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-bold text-zinc-800">AI summary</span>
              <span className="text-[9px] text-zinc-400 ml-auto">Generated in 28 s</span>
            </div>
            <div className="p-3 text-[12px] text-zinc-700 leading-relaxed">
              A Q4 2026 customer rebate program between TechSound Audio and Northwest Distribution Co.,
              granting tiered rebates of <span className="font-semibold">3% / 5% / 7%</span> on quarterly net sales of headphone products.
              <span className="font-semibold"> Minimum threshold $200K</span>, paid quarterly, term Jan 1 — Dec 31 2026.
            </div>
          </div>

          {/* AI-detected key fields */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-[11px] font-bold text-zinc-800">AI-detected details</span>
              </div>
              <span className="text-[9px] text-zinc-500">click any field to edit</span>
            </div>
            <div className="p-3">
              <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Contract name" value="Northwest Q4 Rebate Program 2026" edit />
              <MetaRow icon={<Sparkles className="h-3.5 w-3.5" />} label="Flow type" value="CRP — Customer Rebate Program" edit />
              <MetaRow icon={<Users className="h-3.5 w-3.5" />} label="Parties" value="TechSound Audio  ·  Northwest Distribution Co." edit />
              <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Effective" value="Jan 1, 2026 → Dec 31, 2026" edit />
              <MetaRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Estimated value" value="$640K (over 12 months)" edit />
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-orange-50/60 border border-orange-200 rounded p-3">
            <div className="text-[11px] font-bold text-orange-900 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> What happens after you confirm
            </div>
            <ol className="text-[11px] text-orange-900 space-y-1 list-decimal list-inside">
              <li>The contract is created and the page opens immediately.</li>
              <li>5 AI agents run in the background — terms, rules, master-data, qualifiers, verification.</li>
              <li>The page is read-only while AI works (~2 min). Editing unlocks when done.</li>
            </ol>
          </div>
        </div>

        {/* Sheet footer */}
        <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
          <button className="text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
            <ChevronDown className="h-3 w-3" /> Save as draft instead
          </button>
          <div className="flex items-center gap-2">
            <button className="text-[11px] px-3 py-1.5 text-zinc-700 border border-zinc-300 rounded bg-white hover:bg-zinc-50">
              Re-upload
            </button>
            <button className="text-[11px] px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold shadow-sm flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm & create contract
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
