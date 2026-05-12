import {
  Search,
  Bell,
  MapPin,
  ChevronRight,
  Eye,
  RotateCw,
  GitBranch,
  Save,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Pencil,
  Send,
  Loader2,
} from "lucide-react";

function ActionBtn({ icon, label, primary, ghost }: { icon: React.ReactNode; label: string; primary?: boolean; ghost?: boolean }) {
  if (primary) return (
    <button className="text-[11px] px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold shadow-sm flex items-center gap-1">
      {icon} {label}
    </button>
  );
  if (ghost) return (
    <button className="text-[11px] px-2.5 py-1.5 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded flex items-center gap-1">
      {icon} {label}
    </button>
  );
  return (
    <button className="text-[11px] px-2.5 py-1.5 border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 rounded flex items-center gap-1">
      {icon} {label}
    </button>
  );
}

function StepDot({ label, state }: { label: string; state: "done" | "current" | "next" }) {
  const map = {
    done:    { c: "bg-emerald-500 text-white", t: "text-emerald-700",  i: <CheckCircle2 className="h-3 w-3" /> },
    current: { c: "bg-amber-500 text-white animate-pulse", t: "text-amber-700 font-bold", i: <Loader2 className="h-3 w-3 animate-spin" /> },
    next:    { c: "bg-white text-zinc-400 border border-zinc-300", t: "text-zinc-500", i: <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> },
  } as const;
  const s = map[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-5 w-5 rounded-full flex items-center justify-center ${s.c}`}>{s.i}</span>
      <span className={`text-[11px] ${s.t}`}>{label}</span>
    </div>
  );
}

function Tab({ label, active, badge }: { label: string; active?: boolean; badge?: string }) {
  return (
    <button className={`text-[12px] px-3 py-2 border-b-2 flex items-center gap-1 ${
      active ? "border-orange-500 text-zinc-900 font-semibold" : "border-transparent text-zinc-600 hover:text-zinc-900"
    }`}>
      {label}
      {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 ml-1">{badge}</span>}
    </button>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent?: "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">{label}</div>
      <div className={`text-[12px] font-bold ${
        accent === "ok" ? "text-emerald-700" : accent === "warn" ? "text-amber-700" : "text-zinc-900"
      }`}>{value}</div>
    </div>
  );
}

export function ContractDetailUnlocked() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
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

      {/* Breadcrumb */}
      <div className="px-6 py-2 flex items-center gap-1 text-[11px] text-zinc-500">
        <span className="hover:text-zinc-700 cursor-pointer">Contract Management</span>
        <ChevronRight className="h-3 w-3" />
        <span className="hover:text-zinc-700 cursor-pointer">Active Contracts</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-zinc-700">CNT-2026-046</span>
        <span className="ml-auto text-[10px] text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Auto-saved · Up to date
        </span>
      </div>

      {/* Header — matches the real screenshot */}
      <div className="px-6 pb-2 flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-orange-100 text-orange-700 tracking-wide">
              Customer Rebate Program
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 tracking-wide flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> Needs review
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-zinc-100 text-zinc-600 tracking-wide">
              v1 · draft
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 tracking-wide flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> AI extracted · just now
            </span>
          </div>
          <h1 className="text-[18px] font-bold text-zinc-900 truncate">
            CNT-2026-046 · Northwest_Q4_Rebate_Program_2026.pdf
          </h1>
          <div className="mt-0.5 text-[11px] text-zinc-500 flex items-center gap-2">
            <span>TechSound Audio Inc.</span>
            <span>↔</span>
            <span>Northwest Distribution Co.</span>
            <span>·</span>
            <span>Jan 1, 2026 → Dec 31, 2026</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ActionBtn icon={<Eye className="h-3.5 w-3.5" />} label="View PDF" />
          <ActionBtn icon={<RotateCw className="h-3.5 w-3.5" />} label="Reprocess" />
          <ActionBtn icon={<GitBranch className="h-3.5 w-3.5" />} label="Revise" />
          <ActionBtn icon={<Save className="h-3.5 w-3.5" />} label="Save Draft" />
          <ActionBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Approve & Activate" primary />
        </div>
      </div>

      {/* 5-step strip — Verify & Edit is current */}
      <div className="px-6 pb-3">
        <div className="bg-white border border-zinc-200 rounded px-4 py-2 flex items-center gap-5">
          <StepDot label="Ingested" state="done" />
          <span className="h-px w-6 bg-emerald-200" />
          <StepDot label="Extracted" state="done" />
          <span className="h-px w-6 bg-emerald-200" />
          <StepDot label="Mapped" state="done" />
          <span className="h-px w-6 bg-amber-200" />
          <StepDot label="Verify & Edit" state="current" />
          <span className="h-px w-6 bg-zinc-200" />
          <StepDot label="Activate" state="next" />
          <div className="ml-auto text-[10px] text-zinc-500">Step 4 of 5 · ready for your review</div>
        </div>
      </div>

      {/* Tabs (now all active) */}
      <div className="px-6 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-0">
          <Tab label="Overview" active />
          <Tab label="Parties" />
          <Tab label="Terms & Clauses" />
          <Tab label="Rules" badge="4 yellow" />
          <Tab label="Policies" />
          <Tab label="Risks" />
          <Tab label="Sales Match" />
          <Tab label="Payments" />
          <Tab label="Ledger" />
          <Tab label="History" />
        </div>
        <div className="flex items-center gap-2 pr-1">
          <button className="text-[10px] text-zinc-500 hover:text-zinc-900">Field-Map Review</button>
          <span className="text-zinc-300">|</span>
          <button className="text-[10px] text-zinc-500 hover:text-zinc-900">Legacy view</button>
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className="text-[10px] pl-6 pr-2 py-1 border border-zinc-200 rounded bg-white w-44" placeholder="Find in contract…" />
          </div>
        </div>
      </div>

      {/* Banner — replaces the old "Contract is active and locked" */}
      <div className="px-6 pt-3">
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-700" />
          <div className="text-[11px] text-amber-900 flex-1">
            <span className="font-bold">AI extraction complete.</span> Review parties, terms, and rules below — fix anything yellow, then click <span className="font-semibold">Approve &amp; Activate</span> when ready.
          </div>
          <button className="text-[10px] text-amber-700 underline hover:text-amber-900">Open checklist</button>
        </div>
      </div>

      {/* Body grid — matches the real layout */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-4">
          {/* Identity */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Identity</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">Verified</span>
              </div>
              <button className="text-[10px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="p-3 grid grid-cols-4 gap-3">
              <MetaRow label="Number" value="CNT-2026-046" />
              <MetaRow label="Type" value="Customer Rebate" />
              <MetaRow label="Lane" value="—" />
              <MetaRow label="Status" value="active" accent="ok" />
            </div>
          </div>

          {/* Risks & Insights side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded">
              <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-800">Risks & Red Flags</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">Phase B</span>
              </div>
              <div className="p-3 text-center text-[11px] text-zinc-500">
                Risk scoring service ships in Phase B.
                <div className="text-[10px] text-zinc-400 mt-0.5">auto-rebate signs · concentration · revenue exposure</div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded">
              <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-800">Business Insights</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">Phase B</span>
              </div>
              <div className="p-3 text-center text-[11px] text-zinc-500">
                Annual value · royalty rate · customer health
                <div className="text-[10px] text-amber-600 mt-1 flex items-center justify-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> liQ AI insights become actionable once analysis service is live.
                </div>
              </div>
            </div>
          </div>

          {/* Financial Snapshot */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-800">$ Financial Snapshot</span>
              <span className="text-[10px] text-zinc-500">Terms tab →</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-3">
              <MetaRow label="Currency" value="USD" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Flow type</div>
                <div className="text-[12px] font-bold text-zinc-900">Customer Rebate Program</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">AI 96%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Effective Start</div>
                <div className="text-[12px] font-bold text-zinc-900">Jan 1, 2026</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">AI 95%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Effective End</div>
                <div className="text-[12px] font-bold text-zinc-900">Dec 31, 2026</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">AI 95%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Governing Law</div>
                <div className="text-[12px] font-bold text-amber-700">Missing</div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">needs review</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Status</div>
                <div className="text-[12px] font-bold text-zinc-900">draft</div>
              </div>
            </div>
          </div>

          {/* Configuration Policies */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-800">Configuration Policies</span>
              <span className="text-[10px] text-zinc-500">Cascade: Company → Type → Contract</span>
            </div>
            <div className="p-3 space-y-2">
              {[
                { k: "Cutoff",   v: "Period End" },
                { k: "Rounding", v: "Round Half Up" },
                { k: "Accrual",  v: "Automatic" },
              ].map(p => (
                <div key={p.k} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500 uppercase tracking-wide font-semibold text-[9px]">{p.k}</span>
                  <div className="border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-900 font-semibold w-48 text-right">{p.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — liQ AI panel */}
        <aside className="bg-orange-50 border border-orange-200 rounded p-3 self-start sticky top-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-4 w-4 text-orange-600" />
            <span className="text-[12px] font-bold text-zinc-900">liQ AI</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-auto">active</span>
          </div>
          <div className="text-[10px] text-zinc-600 mb-2">CNT-2026-046 · Ask anything about this contract — terms, rules, parties, risks, payments.</div>
          <div className="text-[10px] text-zinc-500 mb-1">Try asking:</div>
          <div className="space-y-1.5">
            {[
              "Summarise this contract in 3 bullets",
              "What are the payment terms?",
              "List the calculation rules",
              "Any risks or red flags?",
            ].map(q => (
              <button key={q} className="w-full text-left text-[11px] px-2 py-1.5 bg-white border border-orange-200 rounded text-zinc-800 hover:bg-orange-100">
                {q}
              </button>
            ))}
          </div>
          <div className="mt-3 relative">
            <input className="w-full text-[11px] pl-2.5 pr-8 py-1.5 border border-orange-200 rounded bg-white" placeholder="Ask liQ AI…" />
            <Send className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-orange-500" />
          </div>
        </aside>
      </div>
    </div>
  );
}
