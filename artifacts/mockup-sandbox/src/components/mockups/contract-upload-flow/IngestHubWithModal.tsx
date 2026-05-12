import {
  Search,
  Bell,
  MapPin,
  Upload,
  Mail,
  Plug,
  PenLine,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Lock,
  Inbox,
  Zap,
} from "lucide-react";

function ComingSoon() {
  return (
    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
      <Lock className="h-2.5 w-2.5" /> Coming soon
    </span>
  );
}

function MostUsed() {
  return (
    <span className="absolute top-2 right-2 text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
      Most used
    </span>
  );
}

export function IngestHubWithModal() {
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
        </div>
        <Bell className="h-4 w-4 text-zinc-500" />
        <div className="text-[11px] text-zinc-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> TechSound Audio
        </div>
      </header>

      {/* Page heading */}
      <div className="px-6 py-4 flex items-start justify-between">
        <div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1 mb-1">
            <span>Contracts</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-medium">Ingest</span>
          </div>
          <h1 className="text-[18px] font-bold text-zinc-900">Ingest a contract</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Today only the Upload lane is live — Email, Connector, and Manual stay parked here for the next phase.
          </p>
        </div>
        <button className="text-[11px] px-2.5 py-1.5 border border-zinc-300 bg-white rounded text-zinc-700 hover:bg-zinc-50 flex items-center gap-1">
          <Inbox className="h-3.5 w-3.5" /> Inbox · 4
        </button>
      </div>

      {/* 4-lane hub (dimmed because modal is over it) */}
      <div className="px-6 pb-8">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
          Choose how to bring your contract in
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* Upload — active */}
          <div className="relative bg-white border-2 border-orange-300 rounded-lg p-4 ring-4 ring-orange-50">
            <MostUsed />
            <div className="h-8 w-8 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center mb-2">
              <Upload className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Upload file</h3>
            <p className="text-[11px] text-zinc-600 leading-snug mt-1 mb-3">
              Drop a contract PDF, DOCX, or scan and we'll extract everything.
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {["PDF","DOCX","PNG","JPG"].map(f =>
                <span key={f} className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">{f}</span>
              )}
            </div>
            <button className="w-full text-[11px] px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold flex items-center justify-center gap-1">
              <Upload className="h-3 w-3" /> Open uploader
            </button>
            <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-orange-500" /> ~30 sec extract · 342 this month
            </div>
          </div>

          {/* Email — coming soon */}
          <div className="relative bg-zinc-50 border border-zinc-200 rounded-lg p-4 opacity-70">
            <ComingSoon />
            <div className="h-8 w-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
              <Mail className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-700">Forward via email</h3>
            <p className="text-[11px] text-zinc-500 leading-snug mt-1 mb-3">
              Forward any attachment to a private inbox — auto-ingested.
            </p>
            <div className="bg-white border border-zinc-200 rounded px-2 py-1.5 text-[10px] text-zinc-400 font-mono mb-3 truncate">
              acme.contracts@in.licenseiq.app
            </div>
            <button disabled className="w-full text-[11px] px-2.5 py-1.5 bg-white text-zinc-400 border border-zinc-200 rounded font-semibold cursor-not-allowed">
              Phase 2 · enable later
            </button>
          </div>

          {/* Connector — coming soon */}
          <div className="relative bg-zinc-50 border border-zinc-200 rounded-lg p-4 opacity-70">
            <ComingSoon />
            <div className="h-8 w-8 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
              <Plug className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-700">Sync from connector</h3>
            <p className="text-[11px] text-zinc-500 leading-snug mt-1 mb-3">
              Pull from CRM, TPM, CLM, or storage.
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {["NetSuite","Salesforce","SharePoint"].map(f =>
                <span key={f} className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-white text-zinc-500 border-zinc-200">{f}</span>
              )}
            </div>
            <button disabled className="w-full text-[11px] px-2.5 py-1.5 bg-white text-zinc-400 border border-zinc-200 rounded font-semibold cursor-not-allowed">
              Phase 2 · enable later
            </button>
          </div>

          {/* Manual — coming soon */}
          <div className="relative bg-zinc-50 border border-zinc-200 rounded-lg p-4 opacity-70">
            <ComingSoon />
            <div className="h-8 w-8 rounded-md bg-zinc-200 text-zinc-700 flex items-center justify-center mb-2">
              <PenLine className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-700">Create manually</h3>
            <p className="text-[11px] text-zinc-500 leading-snug mt-1 mb-3">
              Type a contract from scratch using the schema-aware editor.
            </p>
            <div className="text-[10px] text-zinc-400 italic mb-3">For edge cases the AI can't read.</div>
            <button disabled className="w-full text-[11px] px-2.5 py-1.5 bg-white text-zinc-400 border border-zinc-200 rounded font-semibold cursor-not-allowed">
              Phase 2 · enable later
            </button>
          </div>
        </div>

        {/* Recent activity (stub) */}
        <div className="mt-5 bg-white border border-zinc-200 rounded">
          <div className="px-3 py-2 border-b border-zinc-100 text-[11px] font-bold text-zinc-700 flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5 text-zinc-500" /> Recent ingestions
          </div>
          <div className="p-3 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-7 bg-zinc-50 rounded animate-pulse" />)}
          </div>
        </div>
      </div>

      {/* Modal scrim */}
      <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-[1px] z-40" />

      {/* SAME modal as Mockup 1 — proves "one upload entry point" */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
        <div className="bg-white rounded-lg shadow-2xl w-[520px] border border-zinc-200">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-orange-600" />
              <h2 className="text-sm font-bold text-zinc-900">Upload contract</h2>
              <span className="text-[10px] text-zinc-400 ml-1">opened from Ingest hub</span>
            </div>
            <button className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            <div className="border-2 border-dashed border-orange-300 bg-orange-50/40 rounded-lg p-6 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Upload className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-zinc-900">Drop a file or <span className="text-orange-600 underline cursor-pointer">browse</span></div>
              <div className="text-[10px] text-zinc-500 mt-1">PDF, DOCX, PNG up to 50 MB</div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1">
                Flow type <span className="text-red-500">*</span>
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

            <button className="w-full text-left flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700">
              <ChevronRight className="h-3 w-3" /> More options
              <span className="text-[10px] text-zinc-400 ml-1">(priority, notes, processing options)</span>
            </button>

            <div className="border border-zinc-200 rounded bg-zinc-50/50 px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-zinc-800 truncate">Northwest_Q4_Rebate_2026.pdf</div>
                <div className="text-[10px] text-zinc-500">2.4 MB · 14 pages</div>
              </div>
              <button className="text-zinc-400 hover:text-zinc-700"><X className="h-3 w-3" /></button>
            </div>
          </div>

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
