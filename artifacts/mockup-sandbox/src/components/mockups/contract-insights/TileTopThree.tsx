import { TrendingUp, ArrowRight, ChevronRight } from "lucide-react";
import {
  INSIGHTS,
  TYPE_DOT,
  TYPE_LABEL,
  TYPE_TEXT,
  TYPE_BG,
  type InsightType,
} from "./_data";

const TYPE_ORDER: InsightType[] = ["opportunity", "alert", "requirement", "info"];

export function TileTopThree() {
  const top = [...INSIGHTS].sort((a, b) => a.priority - b.priority).slice(0, 3);
  const counts = INSIGHTS.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6">
      <div className="w-full max-w-[640px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Business Insights</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {INSIGHTS.length} signals · top 3 by priority
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium">
            {TYPE_ORDER.map((t) =>
              counts[t] ? (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${TYPE_BG[t]} ${TYPE_TEXT[t]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[t]}`} />
                  {counts[t]}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Top 3 rows */}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {top.map((i) => (
            <li
              key={i.id}
              className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer"
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${TYPE_DOT[i.type]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {i.title}
                  </div>
                  <div
                    className={`text-[10px] uppercase tracking-wide font-semibold ${TYPE_TEXT[i.type]} flex-shrink-0`}
                  >
                    {TYPE_LABEL[i.type]}
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {i.description}
                </div>
                {i.impactLabel && (
                  <div className={`text-[11px] font-medium ${TYPE_TEXT[i.type]} mt-0.5`}>
                    {i.impactLabel}
                  </div>
                )}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 mt-1 flex-shrink-0" />
            </li>
          ))}
        </ul>

        {/* Footer */}
        <button className="w-full flex items-center justify-center gap-1 px-5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
          See all {INSIGHTS.length} insights <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
