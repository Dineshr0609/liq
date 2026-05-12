import {
  FileText,
  Users,
  Scale,
  Calculator,
  TrendingUp,
  Wallet,
  History,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Eye,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  Save,
  Send,
  X,
  Bot,
  Lightbulb,
  AlertCircle,
  Link2,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  Percent,
  Layers,
  ArrowUpRight,
} from "lucide-react";

type Confidence = "verified" | "high" | "medium" | "low" | "missing";

const confColor: Record<Confidence, string> = {
  verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-rose-50 text-rose-700 border-rose-200",
  missing: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const confLabel: Record<Confidence, string> = {
  verified: "Verified",
  high: "AI 98%",
  medium: "AI 74%",
  low: "AI 41%",
  missing: "Missing",
};

function ConfidenceBadge({ level }: { level: Confidence }) {
  const Icon =
    level === "verified" || level === "high"
      ? CheckCircle2
      : level === "medium"
        ? AlertTriangle
        : level === "low"
          ? AlertCircle
          : Circle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${confColor[level]}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {confLabel[level]}
    </span>
  );
}

function Field({
  label,
  value,
  conf,
  source,
  hint,
}: {
  label: string;
  value: string;
  conf: Confidence;
  source?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 hover:border-orange-300 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </label>
        <ConfidenceBadge level={conf} />
      </div>
      <div className="text-sm text-zinc-900 font-medium">{value || "—"}</div>
      {source && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-400">
          <FileText className="h-2.5 w-2.5" />
          <span>{source}</span>
        </div>
      )}
      {hint && (
        <div className="mt-1 text-[10px] text-orange-600 italic">{hint}</div>
      )}
    </div>
  );
}

function PipelineStep({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: "done" | "current" | "pending";
}) {
  const styles = {
    done: "bg-emerald-500 text-white border-emerald-500",
    current: "bg-orange-600 text-white border-orange-600 ring-4 ring-orange-100",
    pending: "bg-white text-zinc-400 border-zinc-300",
  } as const;
  const labelStyles = {
    done: "text-emerald-700",
    current: "text-orange-700 font-semibold",
    pending: "text-zinc-400",
  } as const;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${styles[state]}`}
      >
        {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span className={`text-xs ${labelStyles[state]}`}>{label}</span>
    </div>
  );
}

function TabBtn({
  icon: Icon,
  label,
  active,
  count,
  warn,
}: {
  icon: any;
  label: string;
  active?: boolean;
  count?: number;
  warn?: boolean;
}) {
  return (
    <button
      className={`group relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-orange-600 text-orange-700 bg-orange-50/60"
          : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            warn
              ? "bg-amber-100 text-amber-700"
              : active
                ? "bg-orange-100 text-orange-700"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function EditContract() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Top App Bar */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-6 py-2.5 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span>Contract Management</span>
            <ChevronRight className="h-3 w-3" />
            <span>Active Contracts</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-900 font-medium">
              MSA-2026-0418 — Acme Corp Master Services
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Last saved 2m ago</span>
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Auto-saved
            </span>
          </div>
        </div>

        {/* Title row */}
        <div className="px-6 py-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold tracking-wide uppercase">
                Royalty License
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Draft — Under Review
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-medium">
                v3 · Amended
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 leading-tight">
              MSA-2026-0418 · Acme Corp Master Services Agreement
            </h1>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> CimpleIT Inc. → Acme Corp
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Jan 1, 2026 — Dec 31, 2028
              </span>
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Est. $2.4M / yr
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> NA, EMEA
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-6">
            <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> View PDF
            </button>
            <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" /> Revise
            </button>
            <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Draft
            </button>
            <button className="px-3.5 py-1.5 text-sm rounded-md bg-orange-600 hover:bg-orange-700 text-white font-medium inline-flex items-center gap-1.5 shadow-sm">
              <Send className="h-4 w-4" /> Approve & Activate
            </button>
          </div>
        </div>

        {/* Pipeline progress strip */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5">
            <PipelineStep n={1} label="Ingested" state="done" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={2} label="Extracted" state="done" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={3} label="Mapped" state="done" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={4} label="Verify & Edit" state="current" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={5} label="Activate" state="pending" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={6} label="Calculate" state="pending" />
            <ChevronRight className="h-3 w-3 text-zinc-300" />
            <PipelineStep n={7} label="Settle" state="pending" />
            <div className="ml-auto text-xs text-zinc-500">
              Step <span className="font-semibold text-zinc-900">4 of 7</span> ·
              You're here
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 flex items-center gap-0 border-t border-zinc-100">
          <TabBtn icon={FileText} label="Overview" active count={12} />
          <TabBtn icon={Users} label="Parties" count={6} warn />
          <TabBtn icon={Scale} label="Terms & Clauses" count={28} />
          <TabBtn icon={Calculator} label="Rules" count={9} warn />
          <TabBtn icon={ShieldCheck} label="Risks" count={4} warn />
          <TabBtn icon={TrendingUp} label="Sales Match" count={1247} />
          <TabBtn icon={Wallet} label="Payments" count={3} />
          <TabBtn icon={History} label="History" />
          <div className="ml-auto pr-2 flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                placeholder="Find in contract…"
                className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-white w-48 focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Verification banner */}
      <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm text-amber-900">
            <span className="font-semibold">5 items need your review</span>{" "}
            before this contract can be activated — 2 low-confidence party
            mappings, 2 unverified rules, 1 missing required role.
          </div>
          <button className="text-xs font-medium text-amber-700 hover:text-amber-900 inline-flex items-center gap-1">
            Jump to next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body: 2-column dashboard (Overview tab) */}
        <div className="px-6 py-5 grid grid-cols-12 gap-5">
          <main className="col-span-9 space-y-4">
            {/* Identity strip — single row */}
            <section className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Identity
                </span>
                <ConfidenceBadge level="verified" />
              </div>
              <div className="h-6 w-px bg-zinc-200" />
              <div className="flex items-center gap-5 text-xs text-zinc-700 flex-1 min-w-0 truncate">
                <span><span className="text-zinc-400">No.</span> <span className="font-medium">MSA-2026-0418</span></span>
                <span><span className="text-zinc-400">Type</span> <span className="font-medium">Royalty License</span></span>
                <span><span className="text-zinc-400">Law</span> <span className="font-medium">Delaware, USA</span></span>
                <span><span className="text-zinc-400">Source</span> <span className="font-medium">§1.2 · §14.3</span></span>
              </div>
              <button className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 shrink-0">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </section>

            {/* Tile row 1: Risks + Insights */}
            <div className="grid grid-cols-2 gap-4">
              {/* Risks tile */}
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
                <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-rose-500" />
                    <h3 className="text-sm font-semibold text-zinc-900">Risks & Red Flags</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium border border-rose-200">4</span>
                  </div>
                  <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
                    Open tab <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <div className="px-4 py-2 border-b border-zinc-100 flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /><span className="font-semibold">1</span><span className="text-zinc-500">High</span></span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="font-semibold">2</span><span className="text-zinc-500">Med</span></span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-400" /><span className="font-semibold">1</span><span className="text-zinc-500">Low</span></span>
                  <span className="ml-auto text-[10px] text-zinc-400 inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-orange-500" />AI · 12 patterns</span>
                </div>
                <div className="divide-y divide-zinc-100 flex-1">
                  {[
                    { sev: "high", title: "Auto-renewal — 90-day notice trap", impact: "$7.2M committed", source: "§9.2" },
                    { sev: "medium", title: "No minimum guarantee specified", impact: "Revenue exposure ~30%", source: "§5" },
                  ].map((r) => {
                    const bar = r.sev === "high" ? "bg-rose-500" : "bg-amber-500";
                    const chip = r.sev === "high" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";
                    return (
                      <div key={r.title} className="px-4 py-2 flex items-start gap-2.5 hover:bg-zinc-50 cursor-pointer">
                        <div className={`mt-0.5 h-7 w-1 rounded-full shrink-0 ${bar}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5"><span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${chip}`}>{r.sev}</span><span className="text-[10px] text-zinc-400">{r.source}</span></div>
                          <div className="text-xs font-medium text-zinc-900 leading-snug mt-0.5">{r.title}</div>
                          <div className="text-[10px] text-rose-600 font-medium">{r.impact}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="px-4 py-2 border-t border-zinc-100 text-[11px] font-semibold text-orange-600 hover:bg-orange-50 inline-flex items-center justify-center gap-1">
                  View all 4 risks <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </section>

              {/* Insights tile */}
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
                <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-zinc-900">Business Insights</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">6</span>
                  </div>
                  <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
                    Open tab <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100">
                  {[
                    { label: "Annual Value", value: "$2.4M", delta: "+18%" },
                    { label: "Royalty Rate", value: "8.5%", delta: "+1.2pp" },
                    { label: "Cust. Health", value: "92", delta: "Strong" },
                  ].map((k) => (
                    <div key={k.label} className="px-3 py-2.5">
                      <div className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">{k.label}</div>
                      <div className="text-base font-bold text-zinc-900 leading-tight">{k.value}</div>
                      <div className="text-[10px] font-bold text-emerald-600">↑ {k.delta}</div>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 space-y-1 flex-1">
                  {[
                    { label: "Tier bonus likelihood", value: "23%", sub: "Hit 3 of 8 yrs", tone: "neutral" },
                    { label: "Concentration", value: "14%", sub: "3rd largest", tone: "warn" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-50">
                      <div>
                        <div className="text-[11px] font-medium text-zinc-700">{m.label}</div>
                        <div className="text-[10px] text-zinc-500">{m.sub}</div>
                      </div>
                      <span className={`text-sm font-bold ${m.tone === "warn" ? "text-amber-600" : "text-zinc-700"}`}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-orange-50 border-t border-orange-100 text-[10px] text-zinc-700 leading-snug flex items-start gap-1.5">
                  <Lightbulb className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                  <span><span className="font-semibold">liQ AI:</span> Rate 1.2pp above market — leverage for renewal.</span>
                </div>
              </section>
            </div>

            {/* Tile row 2: Financial Snapshot + Activation Readiness */}
            <div className="grid grid-cols-2 gap-4">
              {/* Financial Snapshot */}
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-900">Financial Snapshot</h3>
                    <span className="text-[10px] text-zinc-400">8 fields</span>
                  </div>
                  <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
                    Terms tab <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <div className="p-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Currency", "USD", "verified"],
                    ["Payment Freq.", "Quarterly", "high"],
                    ["Annual Est.", "$2,400,000", "high"],
                    ["Territory", "NA, EMEA", "verified"],
                    ["Channel", "Direct, Reseller", "high"],
                    ["Royalty Base", "Net Sales", "verified"],
                    ["Standard Rate", "8.5%", "verified"],
                    ["Min Guarantee", "—", "missing"],
                  ].map(([k, v, c]) => (
                    <div key={k as string} className="flex items-center justify-between px-2 py-1.5 rounded border border-zinc-100">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
                        <div className={`font-medium ${v === "—" ? "text-zinc-400" : "text-zinc-900"}`}>{v}</div>
                      </div>
                      <ConfidenceBadge level={c as Confidence} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Activation Readiness */}
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-orange-600" />
                    <h3 className="text-sm font-semibold text-zinc-900">Activation Readiness</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">5 to fix</span>
                  </div>
                  <span className="text-xs font-bold text-orange-600">68%</span>
                </header>
                <div className="px-4 pt-3">
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-emerald-500" style={{ width: "68%" }} />
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  {[
                    { label: "Identity verified", state: "done" },
                    { label: "All required parties assigned", state: "warn", detail: "Remit-To, Notice Recipient missing", tab: "Parties" },
                    { label: "All rules verified", state: "warn", detail: "2 rules pending review", tab: "Rules" },
                    { label: "Territory & channel set", state: "done" },
                    { label: "Financial terms complete", state: "warn", detail: "Min Guarantee missing", tab: "Terms" },
                    { label: "No blocking risks", state: "warn", detail: "1 high-severity flag open", tab: "Risks" },
                    { label: "Approver assigned", state: "done" },
                  ].map((c) => (
                    <div key={c.label} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-zinc-50">
                      {c.state === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-800">{c.label}</div>
                        {c.detail && <div className="text-[10px] text-zinc-500">{c.detail}</div>}
                      </div>
                      {c.tab && (
                        <button className="text-[10px] text-orange-600 font-semibold hover:text-orange-700 shrink-0">
                          {c.tab} →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

          </main>

          {/* Right: AI panel */}
        <aside className="col-span-3 space-y-4">
          <div className="sticky top-4 space-y-4">
            {/* Agent panel */}
            <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-md bg-white/15 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">liQ AI</div>
                  <div className="text-[10px] text-orange-100">
                    Working on this contract
                  </div>
                </div>
              </div>
              <div className="text-xs leading-relaxed text-orange-50">
                I extracted{" "}
                <span className="font-semibold text-white">9 rules</span> and{" "}
                <span className="font-semibold text-white">6 parties</span> from
                this contract. 5 items need your review before activation. Ask
                me anything about the contract.
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  placeholder="Ask about this contract…"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-md bg-white/15 border border-white/20 placeholder:text-orange-100 text-white focus:outline-none focus:bg-white/20"
                />
                <button className="p-1.5 rounded-md bg-white text-orange-700 hover:bg-orange-50">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Coverage */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Term Coverage
                  </h4>
                </div>
                <span className="text-xs font-bold text-emerald-600">87%</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-500"
                  style={{ width: "87%" }}
                />
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "Identity", pct: 100 },
                  { label: "Parties", pct: 92 },
                  { label: "Financial", pct: 89 },
                  { label: "Rules", pct: 78, warn: true },
                  { label: "Renewal", pct: 60, warn: true },
                  { label: "Notices", pct: 45, warn: true },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-zinc-600">{c.label}</span>
                    <span
                      className={`font-medium ${
                        c.warn ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {c.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  AI Suggestions
                </h4>
                <span className="ml-auto text-[10px] text-zinc-400">3</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {[
                  {
                    title: "Link 'Acme Holdings' to existing customer",
                    body: "Strong match found in master data (74% confidence). Linking will reuse payment terms.",
                    action: "Review match",
                  },
                  {
                    title: "Missing Remit-To party",
                    body: "Royalty License contracts typically need a Remit-To. Use Payee as fallback?",
                    action: "Apply default",
                  },
                  {
                    title: "Tier rule looks like a milestone",
                    body: "§5.4 mentions cumulative thresholds — switch from flat tier to milestone_tiered?",
                    action: "Open rule",
                  },
                ].map((s) => (
                  <div
                    key={s.title}
                    className="p-3 hover:bg-zinc-50 cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-zinc-900 mb-0.5">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug mb-1.5">
                      {s.body}
                    </div>
                    <button className="text-[10px] font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5">
                      {s.action} <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <RefreshCw className="h-4 w-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Recent Activity
                </h4>
              </div>
              <div className="space-y-2.5 text-[11px]">
                {[
                  ["liQ AI", "Re-extracted §5 after edit", "2m"],
                  ["You", "Linked 'CimpleIT Inc.' to Owning Party", "8m"],
                  ["liQ AI", "Auto-extracted 9 calculation rules", "12m"],
                  ["liQ AI", "Identified 6 parties + 4 roles", "12m"],
                  ["System", "Contract uploaded (12.4 MB PDF)", "13m"],
                ].map(([who, what, when]) => (
                  <div key={what} className="flex items-start gap-2">
                    <div
                      className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                        who === "liQ AI"
                          ? "bg-orange-500"
                          : who === "You"
                            ? "bg-blue-500"
                            : "bg-zinc-400"
                      }`}
                    />
                    <div className="flex-1 leading-tight">
                      <span className="font-semibold text-zinc-700">
                        {who}
                      </span>{" "}
                      <span className="text-zinc-600">{what}</span>
                      <div className="text-zinc-400">{when} ago</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
        </div>
  
    </div>
  );
}
