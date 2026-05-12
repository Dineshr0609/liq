import { ShieldAlert, Filter, Search, FileText, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { CONTRACT_LABEL, RISKS, SEV_DOT, SEV_LABEL, SEV_RING, SEV_TEXT, type Risk } from "./_data";

function rank(r: Risk) {
  return r.severity === "high" ? 0 : r.severity === "medium" ? 1 : 2;
}

export function TabDetailCards() {
  const sorted = [...RISKS].sort((a, b) => rank(a) - rank(b));
  const high = RISKS.filter((r) => r.severity === "high").length;
  const medium = RISKS.filter((r) => r.severity === "medium").length;
  const low = RISKS.filter((r) => r.severity === "low").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1180px] mx-auto px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5" /> {CONTRACT_LABEL}
            </div>
            <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              Risks & red flags
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {RISKS.length} flagged · last analyzed today, 9:42 AM
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill color="red" count={high} label="High" />
            <Pill color="amber" count={medium} label="Medium" />
            <Pill color="emerald" count={low} label="Low" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 flex-1 max-w-md">
            <Search className="h-3.5 w-3.5" />
            <span>Search risks, clauses, suggested actions…</span>
          </div>
          <Chip active>All categories</Chip>
          <Chip>Auto-renewal</Chip>
          <Chip>Concentration</Chip>
          <Chip>IP & licensing</Chip>
          <Chip>Payment</Chip>
          <button className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 px-2 py-1 hover:text-slate-700 dark:hover:text-slate-200">
            <Filter className="h-3 w-3" /> More filters
          </button>
        </div>

        <ul className="space-y-3">
          {sorted.map((r) => <RiskCard key={r.id} risk={r} />)}
        </ul>
      </div>
    </div>
  );
}

function Pill({ color, count, label }: { color: "red" | "amber" | "emerald"; count: number; label: string }) {
  const cls = {
    red: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900",
    amber: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900",
    emerald: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900",
  }[color];
  const dot = { red: "bg-red-500", amber: "bg-amber-500", emerald: "bg-emerald-500" }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ring-1 ring-inset ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{count} {label}
    </span>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`text-xs px-2.5 py-1 rounded-md border ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <li className={`rounded-lg ring-1 ring-inset ${SEV_RING[risk.severity]} bg-white dark:bg-slate-900 overflow-hidden`}>
      <div className="grid grid-cols-12 gap-0">
        <div className={`col-span-1 flex flex-col items-center justify-start py-4`}>
          <span className={`h-3 w-3 rounded-full ${SEV_DOT[risk.severity]}`} />
          <span className={`text-[10px] uppercase tracking-wider font-semibold mt-1.5 ${SEV_TEXT[risk.severity]}`}>{SEV_LABEL[risk.severity]}</span>
        </div>

        <div className="col-span-7 py-4 pr-4 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">{risk.category}</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{risk.title}</div>
            </div>
            <button className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              <ExternalLink className="h-3 w-3" /> {risk.clauseRef}
            </button>
          </div>
          <blockquote className="mt-2 pl-3 border-l-2 border-slate-200 dark:border-slate-800 text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">
            "{risk.clauseExcerpt}"
          </blockquote>
        </div>

        <div className="col-span-4 py-4 pr-5 pl-4 bg-slate-50/60 dark:bg-slate-950/40 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
            <AlertTriangle className="h-3 w-3" /> Suggested action
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">{risk.suggestedAction}</div>
          <div className="flex items-center gap-2 mt-3">
            <button className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90">
              <CheckCircle2 className="h-3 w-3" /> Acknowledge
            </button>
            <button className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900">
              Assign
            </button>
            <button className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
