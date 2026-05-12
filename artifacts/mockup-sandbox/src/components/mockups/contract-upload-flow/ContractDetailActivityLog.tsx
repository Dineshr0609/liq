import {
  Search, Bell, MapPin, ChevronRight, Eye, RotateCw, GitBranch, Save, ShieldCheck,
  CheckCircle2, Loader2, Sparkles, Pencil, Send, Lock, AlertCircle, Activity,
} from "lucide-react";

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
    <button disabled title="Available once AI finishes" className={`text-[11px] px-2.5 py-1.5 rounded cursor-not-allowed border flex items-center gap-1 ${
      primary ? "border-orange-200 bg-orange-100/60 text-orange-300" : "border-zinc-200 bg-zinc-50 text-zinc-400"
    }`}>{icon} {label}<Lock className="h-3 w-3 ml-1" /></button>
  );
  return (
    <button className={`text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1 ${
      primary ? "bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm" : "border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
    }`}>{icon} {label}</button>
  );
}

function CardStatus({ state }: { state: "ready" | "extracting" | "queued" }) {
  const map = {
    ready:      { c: "bg-emerald-50 text-emerald-700 border-emerald-200", t: "Ready",       i: <CheckCircle2 className="h-2.5 w-2.5" /> },
    extracting: { c: "bg-orange-50 text-orange-700 border-orange-200",    t: "Extracting…", i: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    queued:     { c: "bg-zinc-100 text-zinc-500 border-zinc-200",          t: "Queued",      i: <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> },
  } as const;
  const m = map[state];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${m.c}`}>
      {m.i} {m.t}
    </span>
  );
}

type Ev = { t: string; ago: string; kind: "ok" | "info" | "warn" | "run" | "queue"; detail?: string };

const EVENTS: Ev[] = [
  { t: "Approve & Activate unlocks once Verify finishes", ago: "—",   kind: "queue" },
  { t: "Verify & seal",                                   ago: "—",   kind: "queue" },
  { t: "Smart qualifiers · link to master data",          ago: "—",   kind: "queue" },
  { t: "Match master data · 39 products, 30 territories", ago: "—",   kind: "queue" },
  { t: "Building rule R5 from §4.2…",                     ago: "now", kind: "run",  detail: "Anthropic Claude · ~30 s" },
  { t: "Found rule R4 — Minimum threshold $200K",         ago: "5s",  kind: "ok" },
  { t: "Found rule R3 — Tier 3 (7% on $500K+)",           ago: "9s",  kind: "ok" },
  { t: "Found rule R2 — Tier 2 (5% on $250K–500K)",       ago: "12s", kind: "ok" },
  { t: "Found rule R1 — Tier 1 (3% on $0–250K)",          ago: "15s", kind: "ok" },
  { t: "Extract terms · 32 terms across 6 sections",      ago: "42s", kind: "ok" },
  { t: "Identified parties · TechSound Audio, Northwest", ago: "55s", kind: "ok" },
  { t: "Parsed PDF · 14 pages · 1,431 chars",             ago: "1m",  kind: "ok" },
  { t: "Contract created from upload",                    ago: "1m",  kind: "info" },
];

function EventRow({ ev }: { ev: Ev }) {
  const dot = {
    ok:    <CheckCircle2 className="h-3 w-3 text-emerald-600" />,
    info:  <span className="h-2 w-2 rounded-full bg-zinc-300" />,
    warn:  <AlertCircle className="h-3 w-3 text-amber-600" />,
    run:   <Loader2 className="h-3 w-3 text-orange-600 animate-spin" />,
    queue: <span className="h-2 w-2 rounded-full border border-zinc-300" />,
  }[ev.kind];
  const tone = ev.kind === "queue" ? "text-zinc-400" : ev.kind === "run" ? "text-zinc-900 font-semibold" : "text-zinc-700";
  return (
    <div className="flex items-start gap-2 py-1.5 text-[11px]">
      <div className="mt-0.5 w-3">{dot}</div>
      <div className="flex-1 min-w-0">
        <div className={tone}>{ev.t}</div>
        {ev.detail && <div className="text-[10px] text-zinc-500">{ev.detail}</div>}
      </div>
      <div className="text-[10px] text-zinc-400 font-mono shrink-0">{ev.ago}</div>
    </div>
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

export function ContractDetailActivityLog() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
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

      {/* Breadcrumb */}
      <div className="px-6 py-2 flex items-center gap-1 text-[11px] text-zinc-500">
        <span>Contract Management</span><ChevronRight className="h-3 w-3" />
        <span>Active Contracts</span><ChevronRight className="h-3 w-3" />
        <span className="font-mono text-zinc-700">CNT-2026-046</span>
      </div>

      {/* Header */}
      <div className="px-6 pb-2 flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-orange-100 text-orange-700 tracking-wide">Customer Rebate Program</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 tracking-wide flex items-center gap-1 animate-pulse">
              <Sparkles className="h-2.5 w-2.5" /> AI processing · 38%
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

      {/* Compact 5-step strip with thin progress bar */}
      <div className="px-6 pb-3">
        <div className="bg-white border border-zinc-200 rounded">
          <div className="h-1 bg-zinc-100 rounded-t overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: "38%" }} />
          </div>
          <div className="px-4 py-2 flex items-center gap-5">
            <StepDot label="Ingested" state="done" />
            <span className="h-px w-6 bg-emerald-200" />
            <StepDot label="Extracted" state="current" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Mapped" state="next" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Verify & Edit" state="next" />
            <span className="h-px w-6 bg-zinc-200" />
            <StepDot label="Activate" state="next" />
            <div className="ml-auto text-[10px] text-zinc-500">~ 1 min 40 s remaining</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Body — split: contract data left, live AI activity log right */}
      <div className="px-6 py-4 grid gap-4" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Left: real cards filling in */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Identity</span>
              <CardStatus state="ready" />
              <span className="ml-auto text-[10px] text-zinc-400">from preview pass</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-3">
              <MetaRow label="Number" value="CNT-2026-046" />
              <MetaRow label="Type" value="Customer Rebate" />
              <MetaRow label="Lane" value="—" />
              <MetaRow label="Status" value="draft" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-800">Parties &amp; Term</span>
              <CardStatus state="ready" />
            </div>
            <div className="p-3 grid grid-cols-4 gap-3">
              <MetaRow label="Licensor" value="TechSound Audio" />
              <MetaRow label="Licensee" value="Northwest Distribution" />
              <MetaRow label="Effective" value="Jan 1, 2026" />
              <MetaRow label="Expires" value="Dec 31, 2026" />
            </div>
          </div>

          <div className="bg-white border border-orange-200 rounded">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Calculation Rules</span>
              <CardStatus state="extracting" />
              <span className="ml-auto text-[10px] text-orange-600 font-semibold">4 of ~12 found · live</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {[
                { id: "R1", t: "Tier 1 — 3% on $0–250K" },
                { id: "R2", t: "Tier 2 — 5% on $250K–500K" },
                { id: "R3", t: "Tier 3 — 7% on $500K+" },
                { id: "R4", t: "Minimum threshold $200K" },
              ].map(r => (
                <div key={r.id} className="px-3 py-2 flex items-center gap-2 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span className="font-mono text-zinc-500">{r.id}</span>
                  <span className="font-semibold text-zinc-900">{r.t}</span>
                </div>
              ))}
              {[1,2,3].map(i => (
                <div key={i} className="px-3 py-2 flex items-center gap-2 text-[11px] opacity-60">
                  <Loader2 className="h-3 w-3 text-orange-500 animate-spin" />
                  <div className="h-3 bg-orange-50 rounded w-1/3 animate-pulse" />
                  <div className="h-3 bg-orange-50 rounded w-1/4 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded opacity-80">
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Master Data Matches</span>
              <CardStatus state="queued" />
            </div>
            <div className="p-3 text-[11px] text-zinc-400 italic">Will run after Build Rules finishes.</div>
          </div>
        </div>

        {/* Right: live AI activity log */}
        <aside className="bg-white border border-zinc-200 rounded flex flex-col self-start sticky top-2" style={{ maxHeight: "780px" }}>
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-orange-600" />
            <span className="text-[11px] font-bold text-zinc-800">AI Activity</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-auto flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" /> live
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-1 divide-y divide-zinc-100">
            {EVENTS.map((ev, i) => <EventRow key={i} ev={ev} />)}
          </div>
          <div className="px-3 py-2 border-t border-zinc-100 bg-zinc-50/50 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Step 2 of 5 · Build rules</span>
            <button className="text-orange-600 hover:text-orange-800 font-semibold">Notify when done</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
