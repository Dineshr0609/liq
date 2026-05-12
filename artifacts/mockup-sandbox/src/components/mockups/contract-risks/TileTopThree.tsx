import { ShieldAlert, ArrowRight } from "lucide-react";
import { RISKS, SEV_DOT, SEV_LABEL, SEV_TEXT, type Risk } from "./_data";

function severityRank(r: Risk) {
  return r.severity === "high" ? 0 : r.severity === "medium" ? 1 : 2;
}

export function TileTopThree() {
  const top = [...RISKS].sort((a, b) => severityRank(a) - severityRank(b)).slice(0, 3);
  const high = RISKS.filter((r) => r.severity === "high").length;
  const medium = RISKS.filter((r) => r.severity === "medium").length;
  const low = RISKS.filter((r) => r.severity === "low").length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6">
      <div className="w-full max-w-[640px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-50 dark:bg-red-950/60 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risks & red flags</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{RISKS.length} flagged · sorted by severity</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{high} high
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{medium} med
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{low} low
            </span>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {top.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer">
              <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${SEV_DOT[r.severity]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{r.title}</div>
                  <div className={`text-[10px] uppercase tracking-wide font-semibold ${SEV_TEXT[r.severity]} flex-shrink-0`}>{SEV_LABEL[r.severity]}</div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{r.summary}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{r.clauseRef}</div>
              </div>
            </li>
          ))}
        </ul>

        <button className="w-full flex items-center justify-center gap-1 px-5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
          See all {RISKS.length} risks <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
