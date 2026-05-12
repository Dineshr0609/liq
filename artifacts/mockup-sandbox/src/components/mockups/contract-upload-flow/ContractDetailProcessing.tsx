import {
  Search,
  Bell,
  MapPin,
  ArrowLeft,
  FileText,
  Lock,
  Sparkles,
  CheckCircle2,
  Loader2,
  RotateCw,
  GitBranch,
  Save,
  ShieldCheck,
  ChevronRight,
  Inbox,
  AlertCircle,
  Eye,
} from "lucide-react";

type AgentState = "done" | "running" | "queued" | "failed";

const AGENT_COLORS: Record<AgentState, string> = {
  done:    "stroke-emerald-500",
  running: "stroke-orange-500",
  queued:  "stroke-zinc-200",
  failed:  "stroke-red-500",
};

function PizzaRing({
  agents,
  size = 200,
  thickness = 22,
}: {
  agents: { name: string; state: AgentState }[];
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const slice = (2 * Math.PI) / agents.length;
  const gap = 0.04; // radians of spacing between slices
  const doneCount = agents.filter(a => a.state === "done").length;
  const runningIdx = agents.findIndex(a => a.state === "running");
  const pct = Math.round(((doneCount + (runningIdx >= 0 ? 0.4 : 0)) / agents.length) * 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {agents.map((a, i) => {
          const startAngle = slice * i + gap / 2;
          const endAngle   = slice * (i + 1) - gap / 2;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              strokeWidth={thickness}
              strokeLinecap="round"
              className={`${AGENT_COLORS[a.state]} ${a.state === "running" ? "animate-pulse" : ""}`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">AI processing</div>
        <div className="text-[36px] font-bold text-zinc-900 leading-none mt-1">{pct}<span className="text-[18px] text-zinc-400">%</span></div>
        <div className="text-[10px] text-zinc-500 mt-1">{doneCount} of {agents.length} agents done</div>
      </div>
    </div>
  );
}

function AgentRow({ name, state, detail, eta }: { name: string; state: AgentState; detail?: string; eta?: string }) {
  const icon =
    state === "done"   ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
    state === "running"? <Loader2 className="h-3.5 w-3.5 text-orange-600 animate-spin" /> :
    state === "failed" ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> :
                         <span className="h-3.5 w-3.5 rounded-full border border-zinc-300" />;
  const tone =
    state === "done"   ? "text-zinc-700" :
    state === "running"? "text-zinc-900 font-semibold" :
    state === "failed" ? "text-red-700 font-semibold" :
                         "text-zinc-400";
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] ${tone}`}>{name}</div>
        {detail && <div className="text-[10px] text-zinc-500 truncate">{detail}</div>}
      </div>
      {eta && <div className="text-[10px] text-zinc-400 font-mono">{eta}</div>}
    </div>
  );
}

function LockedBtn({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      disabled
      title="Available once AI processing finishes"
      className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded cursor-not-allowed border ${
        primary
          ? "border-orange-200 bg-orange-100/60 text-orange-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      {icon} {label}
      <Lock className="h-3 w-3 ml-1" />
    </button>
  );
}

function StepPill({ label, state }: { label: string; state: "done" | "current" | "next" | "queued" }) {
  const map = {
    done:    { dot: "bg-emerald-500",  text: "text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    current: { dot: "bg-orange-500 animate-pulse", text: "text-orange-700 font-bold", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    next:    { dot: "bg-zinc-300",     text: "text-zinc-500",    icon: <span className="h-3 w-3 rounded-full border border-zinc-300 inline-block" /> },
    queued:  { dot: "bg-zinc-200",     text: "text-zinc-400",    icon: <span className="h-3 w-3 rounded-full border border-zinc-200 inline-block" /> },
  } as const;
  const s = map[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className={s.text}>{s.icon}</span>
      <span className={`text-[11px] ${s.text}`}>{label}</span>
    </div>
  );
}

export function ContractDetailProcessing() {
  const agents: { name: string; state: AgentState; detail?: string; eta?: string }[] = [
    { name: "Parse document",     state: "done",    detail: "14 pages · 1,431 chars",         eta: "0:18" },
    { name: "Extract terms",      state: "done",    detail: "32 terms found · 6 sections",    eta: "0:42" },
    { name: "Build rules",        state: "running", detail: "Generating tier rules from §4…", eta: "~30 s" },
    { name: "Match master data",  state: "queued",  detail: "Products, customers, territories" },
    { name: "Smart qualifiers",   state: "queued",  detail: "Link rule scopes to your catalog" },
    { name: "Verify & seal",      state: "queued",  detail: "Lock as Verified once approved" },
  ];

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
      <div className="px-6 py-3 flex items-center gap-1 text-[11px] text-zinc-500">
        <ArrowLeft className="h-3 w-3" />
        <span className="hover:text-zinc-700 cursor-pointer">Contracts</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono">CNT-2026-046</span>
      </div>

      {/* Header — matches real contract page */}
      <div className="px-6 pb-2 flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-orange-100 text-orange-700 tracking-wide">
              Customer Rebate Program
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 tracking-wide animate-pulse">
              <Sparkles className="h-2.5 w-2.5" /> AI processing
            </span>
            <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-zinc-100 text-zinc-600 tracking-wide">
              v1 — draft
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
          <button className="text-[11px] px-2.5 py-1.5 border border-zinc-300 bg-white rounded text-zinc-700 hover:bg-zinc-50 flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> View PDF
          </button>
          <LockedBtn icon={<RotateCw className="h-3.5 w-3.5" />} label="Reprocess" />
          <LockedBtn icon={<GitBranch className="h-3.5 w-3.5" />} label="Revise" />
          <LockedBtn icon={<Save className="h-3.5 w-3.5" />} label="Save Draft" />
          <LockedBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Approve & Activate" primary />
        </div>
      </div>

      {/* Real 5-step journey strip — current = Extracted */}
      <div className="px-6 pb-3">
        <div className="bg-white border border-zinc-200 rounded px-4 py-2 flex items-center gap-5">
          <StepPill label="Ingested" state="done" />
          <span className="h-px w-6 bg-zinc-200" />
          <StepPill label="Extracted" state="current" />
          <span className="h-px w-6 bg-zinc-200" />
          <StepPill label="Mapped" state="next" />
          <span className="h-px w-6 bg-zinc-200" />
          <StepPill label="Verify & Edit" state="queued" />
          <span className="h-px w-6 bg-zinc-200" />
          <StepPill label="Activate" state="queued" />
          <div className="ml-auto text-[10px] text-zinc-500">Step 2 of 5</div>
        </div>
      </div>

      {/* Pizza progress banner */}
      <div className="px-6 pb-4">
        <div className="bg-white border border-orange-200 rounded-lg p-5 flex items-center gap-6 shadow-sm">
          <PizzaRing agents={agents} />

          {/* Agent list */}
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
            {agents.map((a, i) => (
              <AgentRow key={i} name={a.name} state={a.state} detail={a.detail} eta={a.eta} />
            ))}
          </div>

          {/* Side actions */}
          <div className="w-44 border-l border-zinc-100 pl-5 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Estimated time</div>
            <div className="text-[20px] font-bold text-zinc-900 leading-none">~ 1 min 40 s</div>
            <div className="text-[10px] text-zinc-500">Editing unlocks automatically when AI finishes.</div>
            <button className="w-full mt-3 text-[11px] px-2.5 py-1.5 border border-zinc-300 bg-white rounded text-zinc-700 hover:bg-zinc-50 flex items-center justify-center gap-1">
              <Eye className="h-3.5 w-3.5" /> Watch live log
            </button>
          </div>
        </div>
      </div>

      {/* Tabs (locked) */}
      <div className="px-6 border-b border-zinc-200">
        <div className="flex items-center gap-1">
          {["Overview", "Rules", "Parties", "Documents", "History", "liQ AI"].map((t, i) => (
            <button key={t}
              className={`text-[12px] px-3 py-2 border-b-2 ${i === 0 ? "border-orange-500 text-zinc-900 font-semibold" : "border-transparent text-zinc-400 cursor-not-allowed"} flex items-center gap-1`}>
              {t} {i !== 0 && <Lock className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton content (read-only preview) */}
      <div className="px-6 py-5 grid grid-cols-3 gap-4">
        {/* Left: extracted preview */}
        <div className="col-span-2 bg-white border border-zinc-200 rounded p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <FileText className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Extracted preview</span>
            <span className="text-[10px] text-zinc-400 ml-auto">populating as agents finish</span>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-zinc-100 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded w-5/6 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded w-2/3 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded w-3/5 animate-pulse" />
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-3 gap-3 text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">Parties</div>
              <div className="font-semibold text-zinc-900">2 detected</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">Effective</div>
              <div className="font-semibold text-zinc-900">2026-01-01 → 2026-12-31</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">Estimated value</div>
              <div className="font-semibold text-orange-700">$640K</div>
            </div>
          </div>
        </div>

        {/* Right: what happens after */}
        <div className="bg-orange-50/60 border border-orange-200 rounded p-4">
          <div className="text-[11px] font-bold text-orange-900 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Why everything is locked
          </div>
          <ul className="text-[11px] text-orange-900 space-y-1.5 list-disc list-inside">
            <li>Editing rules while AI is still extracting them creates duplicates.</li>
            <li>Tabs unlock as the matching agent finishes — Rules unlocks at step 3.</li>
            <li>If something fails, the slice turns red with a Retry button.</li>
            <li>You can leave this page — we’ll notify you when it’s ready.</li>
          </ul>
          <button className="w-full mt-3 text-[11px] px-2.5 py-1.5 border border-orange-300 bg-white rounded text-orange-700 hover:bg-orange-100 font-semibold">
            Notify me when done
          </button>
        </div>
      </div>
    </div>
  );
}
