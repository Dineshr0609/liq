import {
  TrendingUp,
  Filter,
  Search,
  FileText,
  ExternalLink,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import {
  CONTRACT_LABEL,
  INSIGHTS,
  TYPE_DOT,
  TYPE_LABEL,
  TYPE_RING,
  TYPE_TEXT,
  type Insight,
  type InsightType,
} from "./_data";

const TYPE_ORDER: InsightType[] = ["opportunity", "alert", "requirement", "info"];

export function TabActionableCards() {
  const sorted = [...INSIGHTS].sort((a, b) => a.priority - b.priority);
  const counts = INSIGHTS.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1180px] mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5" /> {CONTRACT_LABEL}
            </div>
            <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Business Insights
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {INSIGHTS.length} signals · last analyzed today, 9:42 AM
            </div>
          </div>
          <div className="flex items-center gap-2">
            {TYPE_ORDER.map((t) =>
              counts[t] ? (
                <Pill key={t} type={t} count={counts[t]!} label={TYPE_LABEL[t]} />
              ) : null
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 flex-1 max-w-md">
            <Search className="h-3.5 w-3.5" />
            <span>Search insights, clauses, suggested actions…</span>
          </div>
          <Chip active>All types</Chip>
          <Chip>Opportunity</Chip>
          <Chip>Alert</Chip>
          <Chip>Requirement</Chip>
          <Chip>Info</Chip>
          <button className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 px-2 py-1 hover:text-slate-700 dark:hover:text-slate-200">
            <Filter className="h-3 w-3" /> More filters
          </button>
        </div>

        {/* Cards */}
        <ul className="space-y-3">
          {sorted.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Pill({ type, count, label }: { type: InsightType; count: number; label: string }) {
  const ring = {
    opportunity:
      "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900",
    alert:
      "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900",
    requirement:
      "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-900",
    info: "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700",
  }[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ring-1 ring-inset ${ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[type]}`} />
      {count} {label}
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

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <li
      className={`rounded-lg ring-1 ring-inset ${TYPE_RING[insight.type]} bg-white dark:bg-slate-900 overflow-hidden`}
    >
      <div className="grid grid-cols-12 gap-0">
        {/* Left strip: type marker */}
        <div className="col-span-1 flex flex-col items-center justify-start py-4">
          <span className={`h-3 w-3 rounded-full ${TYPE_DOT[insight.type]}`} />
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold mt-1.5 text-center leading-tight ${TYPE_TEXT[insight.type]}`}
          >
            {TYPE_LABEL[insight.type]}
          </span>
        </div>

        {/* Middle: title + why it matters */}
        <div className="col-span-7 py-4 pr-4 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
                <span>{insight.category}</span>
                {insight.dueLabel && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 normal-case tracking-normal text-[10px] font-semibold">
                    {insight.dueLabel}
                  </span>
                )}
                {insight.impactLabel && (
                  <span
                    className={`px-1.5 py-0.5 rounded normal-case tracking-normal text-[10px] font-semibold ${TYPE_TEXT[insight.type]}`}
                  >
                    {insight.impactLabel}
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {insight.title}
              </div>
            </div>
            {insight.clauseRef && (
              <button className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex-shrink-0">
                <ExternalLink className="h-3 w-3" /> {insight.clauseRef}
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {insight.whyItMatters}
          </div>
        </div>

        {/* Right: suggested action */}
        <div className="col-span-4 py-4 pr-5 pl-4 bg-slate-50/60 dark:bg-slate-950/40 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
            <Lightbulb className="h-3 w-3" /> Suggested action
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">
            {insight.suggestedAction}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90">
              <CheckCircle2 className="h-3 w-3" /> Take action
            </button>
            <button className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900">
              Snooze
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
