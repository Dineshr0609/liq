import {
  Search, Bell, MapPin, ChevronRight, Eye, RotateCw, GitBranch, Save, ShieldCheck,
  CheckCircle2, Loader2, Sparkles, AlertCircle, Pencil, Send, Lock,
  Inbox, GitMerge, Wand2, Activity, MinusCircle,
} from "lucide-react";

type AgentName = "Intake" | "Extractor" | "Mapper" | "Validator" | "Resolver" | "Watchdog";
type AgentState = "done" | "running" | "queued" | "skipped" | "passive";

const AGENT_META: Record<AgentName, { icon: any; role: string; color: string }> = {
  Intake:    { icon: Inbox,       role: "Routed PDF → doc lane",       color: "text-zinc-700"    },
  Extractor: { icon: Sparkles,    role: "OCR + LLM on documents",      color: "text-orange-600"  },
  Mapper:    { icon: GitMerge,    role: "Schema-map structured rows",  color: "text-emerald-600" },
  Validator: { icon: ShieldCheck, role: "Schema + business rules",     color: "text-blue-600"    },
  Resolver:  { icon: Wand2,       role: "Auto-fix: re-OCR, party match", color: "text-purple-600" },
  Watchdog:  { icon: Activity,    role: "Stuck items, drift, escalate", color: "text-rose-600"   },
};

function AgentPeek({ name, state, eta }: { name: AgentName; state: AgentState; eta?: string }) {
  const m = AGENT_META[name];
  const Icon = m.icon;
  const status = {
    done:    { icon: <CheckCircle2 className="h-3 w-3 text-emerald-600" />, label: "done",       tone: "text-zinc-700" },
    running: { icon: <Loader2 className="h-3 w-3 text-orange-600 animate-spin" />, label: "running…", tone: "text-zinc-900 font-semibold" },
    queued:  { icon: <span className="h-2.5 w-2.5 rounded-full border border-zinc-300" />,    label: "queued",     tone: "text-zinc-400" },
    skipped: { icon: <MinusCircle className="h-3 w-3 text-zinc-400" />,    label: "skipped",    tone: "text-zinc-400 line-through" },
    passive: { icon: <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />, label: "watching",   tone: "text-zinc-600" },
  }[state];
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="shrink-0 w-3">{status.icon}</div>
      <Icon className={`h-3 w-3 shrink-0 ${m.color}`} />
      <div className={`text-[10px] truncate ${status.tone}`}>{name}</div>
      <div className="text-[9px] text-zinc-400 truncate hidden xl:block">· {m.role}</div>
      <div className="ml-auto text-[9px] font-mono text-zinc-400 shrink-0">{eta ?? status.label}</div>
    </div>
  );
}

function StepDot({ label, state }: { label: string; state: "done" | "current" | "next" }) {
  const map = {
    done:    { c: "bg-emerald-500 text-white",                         t: "text-emerald-700",                  i: <CheckCircle2 className="h-3 w-3" /> },
    current: { c: "bg-orange-500 text-white animate-pulse",            t: "text-orange-700 font-bold",         i: <Loader2 className="h-3 w-3 animate-spin" /> },
    next:    { c: "bg-white text-zinc-400 border border-zinc-300",     t: "text-zinc-500",                     i: <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> },
  } as const;
  const s = map[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-5 w-5 rounded-full flex items-center justify-center ${s.c}`}>{s.i}</span>
      <span className={`text-[11px] ${s.t}`}>{label}</span>
    </div>
  );
}

function ActionBtn({ icon, label, primary, locked }: { icon: React.ReactNode; label: string; primary?: boolean; locked?: boolean }) {
  if (locked) return (
    <button disabled title="Available once AI processing finishes" className={`text-[11px] px-2.5 py-1.5 rounded cursor-not-allowed border flex items-center gap-1 ${
      primary ? "border-orange-200 bg-orange-100/60 text-orange-300" : "border-zinc-200 bg-zinc-50 text-zinc-400"
    }`}>{icon} {label}<Lock className="h-3 w-3 ml-1" /></button>
  );
  return (
    <button className={`text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1 ${
      primary ? "bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm" : "border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
    }`}>{icon} {label}</button>
  );
}

function CardStatus({ state }: { state: "ready" | "extracting" | "queued" | "review" }) {
  const map = {
    ready:      { c: "bg-emerald-50 text-emerald-700 border-emerald-200", t: "Ready",            i: <CheckCircle2 className="h-2.5 w-2.5" /> },
    extracting: { c: "bg-orange-50 text-orange-700 border-orange-200",    t: "Extracting…",      i: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    queued:     { c: "bg-zinc-100 text-zinc-500 border-zinc-200",          t: "Queued",           i: <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> },
    review:     { c: "bg-amber-50 text-amber-800 border-amber-200",       t: "Needs review",     i: <AlertCircle className="h-2.5 w-2.5" /> },
  } as const;
  const m = map[state];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${m.c}`}>
      {m.i} {m.t}
    </span>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent?: "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">{label}</div>
      <div className={`text-[12px] font-bold ${accent === "ok" ? "text-emerald-700" : accent === "warn" ? "text-amber-700" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

export function ContractDetailInline() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Top ambient progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-orange-100 z-50">
        <div className="h-full bg-orange-500 animate-pulse" style={{ width: "38%" }} />
      </div>

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
        <div className="text-[11px] text-zinc-600 flex items-center gap-1"><MapPin className="h-3 w-3" /> TechSound Audio</div>
      </header>

      {/* Breadcrumb + auto-save */}
      <div className="px-6 py-2 flex items-center gap-1 text-[11px] text-zinc-500">
        <span>Contract Management</span><ChevronRight className="h-3 w-3" />
        <span>Active Contracts</span><ChevronRight className="h-3 w-3" />
        <span className="font-mono text-zinc-700">CNT-2026-046</span>
        <span className="ml-auto text-[10px] text-orange-600 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> AI is filling in the page · ~1 min 40 s
        </span>
      </div>

      {/* Header — same as before */}
      <div className="px-6 pb-2 flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-orange-100 text-orange-700 tracking-wide">Customer Rebate Program</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 tracking-wide flex items-center gap-1 animate-pulse">
              <Sparkles className="h-2.5 w-2.5" /> AI processing
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-zinc-100 text-zinc-600 tracking-wide">v1 · draft</span>
          </div>
          <h1 className="text-[18px] font-bold text-zinc-900 truncate">CNT-2026-046 · Northwest_Q4_Rebate_Program_2026.pdf</h1>
          <div className="mt-0.5 text-[11px] text-zinc-500 flex items-center gap-2">
            <span>TechSound Audio Inc.</span><span>↔</span><span>Northwest Distribution Co.</span>
            <span>·</span><span>Jan 1, 2026 → Dec 31, 2026</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ActionBtn icon={<Eye className="h-3.5 w-3.5" />} label="View PDF" />
          <ActionBtn icon={<RotateCw className="h-3.5 w-3.5" />} label="Reprocess" locked />
          <ActionBtn icon={<GitBranch className="h-3.5 w-3.5" />} label="Revise" locked />
          <ActionBtn icon={<Save className="h-3.5 w-3.5" />} label="Save Draft" locked />
          <ActionBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Approve & Activate" primary locked />
        </div>
      </div>

      {/* 5-step strip — Extracted is current, with inline agent peek */}
      <div className="px-6 pb-3">
        <div className="bg-white border border-zinc-200 rounded">
          <div className="px-4 py-2 flex items-center gap-5 border-b border-zinc-100">
            <StepDot label="Ingested" state="done" />
            <span className="h-px w-6 bg-emerald-200" />
            <StepDot label="Extracted" state="current" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Mapped" state="next" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Verify & Edit" state="next" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Activate" state="next" />
            <div className="ml-auto text-[10px] text-zinc-500 flex items-center gap-1">
              <button className="text-orange-600 hover:text-orange-800 underline">Hide detail</button>
            </div>
          </div>
          {/* Inline agent breakdown — same 6 agents as the Inbox Agent Fleet */}
          <div className="px-4 py-2 bg-orange-50/40 grid grid-cols-3 gap-x-5 gap-y-1.5">
            <AgentPeek name="Intake"    state="done"    eta="0:02" />
            <AgentPeek name="Extractor" state="running" eta="~30 s" />
            <AgentPeek name="Mapper"    state="skipped" />
            <AgentPeek name="Validator" state="queued" />
            <AgentPeek name="Resolver"  state="queued" />
            <AgentPeek name="Watchdog"  state="passive" />
          </div>
          <div className="px-4 py-1.5 bg-orange-50/40 border-t border-orange-100 text-[10px] text-zinc-600 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-orange-600" />
            <span>Same Agent Fleet as your <span className="font-semibold text-orange-700 underline cursor-pointer">Inbox</span> · Mapper is skipped because this is the document lane (Mapper handles structured rows)</span>
          </div>
        </div>
      </div>

      {/* Tabs (Overview only enabled) */}
      <div className="px-6 border-b border-zinc-200">
        <div className="flex items-center gap-0">
          <button className="text-[12px] px-3 py-2 border-b-2 border-orange-500 text-zinc-900 font-semibold">Overview</button>
          {["Parties","Terms & Clauses","Rules","Policies","Risks","Sales Match","Payments","Ledger","History"].map(t =>
            <button key={t} className="text-[12px] px-3 py-2 border-b-2 border-transparent text-zinc-400 cursor-not-allowed flex items-center gap-1">
              {t} <Lock className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body — real data immediately, per-card status */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Identity — already known from preview pass */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Identity</span>
                <CardStatus state="ready" />
              </div>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-orange-600" /> Extractor · preview pass
              </span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-3">
              <MetaRow label="Number" value="CNT-2026-046" />
              <MetaRow label="Type" value="Customer Rebate" />
              <MetaRow label="Lane" value="—" />
              <MetaRow label="Status" value="draft" />
            </div>
          </div>

          {/* Financial Snapshot — also from preview */}
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-800">$ Financial Snapshot</span>
              <CardStatus state="ready" />
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
            </div>
          </div>

          {/* Rules — currently extracting */}
          <div className="bg-white border border-orange-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Calculation Rules</span>
                <CardStatus state="extracting" />
              </div>
              <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Extractor · 4 of ~12…
              </span>
            </div>
            <div className="divide-y divide-zinc-100">
              {/* Already-extracted rules appear */}
              <div className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-mono text-zinc-500">R1</span>
                <span className="font-semibold text-zinc-900">Tier 1 — 3% on $0–250K</span>
                <span className="ml-auto text-[10px] text-zinc-400">just extracted</span>
              </div>
              <div className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-mono text-zinc-500">R2</span>
                <span className="font-semibold text-zinc-900">Tier 2 — 5% on $250K–500K</span>
                <span className="ml-auto text-[10px] text-zinc-400">just extracted</span>
              </div>
              <div className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-mono text-zinc-500">R3</span>
                <span className="font-semibold text-zinc-900">Tier 3 — 7% on $500K+</span>
                <span className="ml-auto text-[10px] text-zinc-400">just extracted</span>
              </div>
              <div className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-mono text-zinc-500">R4</span>
                <span className="font-semibold text-zinc-900">Minimum threshold $200K</span>
                <span className="ml-auto text-[10px] text-zinc-400">just extracted</span>
              </div>
              {/* Skeleton placeholder for rules still being built */}
              {[1,2,3].map(i => (
                <div key={i} className="px-3 py-2 flex items-center gap-2 text-[11px] opacity-60">
                  <Loader2 className="h-3 w-3 text-orange-500 animate-spin" />
                  <div className="h-3 bg-orange-50 rounded w-1/3 animate-pulse" />
                  <div className="h-3 bg-orange-50 rounded w-1/4 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="px-3 py-2 bg-orange-50/40 text-[10px] text-orange-700 border-t border-orange-100">
              You can already see what's been found · the rest will appear as <span className="font-semibold">Extractor</span> finishes the remaining clauses.
            </div>
          </div>

          {/* Master Data Match — queued */}
          <div className="bg-white border border-zinc-200 rounded opacity-80">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Validation &amp; Master Data</span>
              <CardStatus state="queued" />
              <span className="ml-auto text-[10px] text-zinc-400 flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-blue-600" /> Validator
                <Wand2 className="h-2.5 w-2.5 text-purple-600 ml-1" /> Resolver
              </span>
            </div>
            <div className="p-3 text-[11px] text-zinc-400 italic">Validator runs schema + business rule checks once Extractor finishes; Resolver auto-fixes anything it can (party match, retries).</div>
          </div>
        </div>

        {/* Right column — Parties (ready) + liQ AI */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Parties</span>
                <CardStatus state="ready" />
              </div>
              <button className="text-[10px] text-zinc-400"><Pencil className="h-3 w-3" /></button>
            </div>
            <div className="p-3 space-y-2">
              <div className="text-[11px]"><span className="text-zinc-500">Licensor · </span><span className="font-bold text-zinc-900">TechSound Audio Inc.</span></div>
              <div className="text-[11px]"><span className="text-zinc-500">Licensee · </span><span className="font-bold text-zinc-900">Northwest Distribution Co.</span></div>
            </div>
          </div>

          <aside className="bg-orange-50 border border-orange-200 rounded p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-4 w-4 text-orange-600" />
              <span className="text-[12px] font-bold text-zinc-900">liQ AI</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-auto">active</span>
            </div>
            <div className="text-[10px] text-zinc-600 mb-2">Ask anything that's already been extracted — I'll answer for the parts AI is still working on as soon as they finish.</div>
            <div className="space-y-1.5">
              {["Summarise this contract","Show the rebate tiers","Who are the parties?"].map(q =>
                <button key={q} className="w-full text-left text-[11px] px-2 py-1.5 bg-white border border-orange-200 rounded text-zinc-800 hover:bg-orange-100">{q}</button>
              )}
            </div>
            <div className="mt-3 relative">
              <input className="w-full text-[11px] pl-2.5 pr-8 py-1.5 border border-orange-200 rounded bg-white" placeholder="Ask liQ AI…" />
              <Send className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-orange-500" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
