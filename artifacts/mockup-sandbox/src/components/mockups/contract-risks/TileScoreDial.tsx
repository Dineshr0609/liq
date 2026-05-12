import { ShieldAlert, TrendingUp } from "lucide-react";
import { RISKS } from "./_data";

function computeScore() {
  const weight = { high: 18, medium: 7, low: 2 } as const;
  const raw = RISKS.reduce((acc, r) => acc + weight[r.severity], 0);
  return Math.min(100, Math.round((raw / (RISKS.length * 18)) * 100));
}

export function TileScoreDial() {
  const score = computeScore();
  const high = RISKS.filter((r) => r.severity === "high").length;
  const medium = RISKS.filter((r) => r.severity === "medium").length;
  const low = RISKS.filter((r) => r.severity === "low").length;

  const band =
    score >= 70 ? { label: "Elevated", color: "text-red-600 dark:text-red-400", ring: "stroke-red-500" } :
    score >= 40 ? { label: "Moderate", color: "text-amber-600 dark:text-amber-400", ring: "stroke-amber-500" } :
                  { label: "Low",      color: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500" };

  const C = 2 * Math.PI * 52;
  const dashoffset = C - (C * score) / 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6">
      <div className="w-full max-w-[640px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-50 dark:bg-red-950/60 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk score</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Composite of {RISKS.length} flagged items</div>
            </div>
          </div>
          <div className="text-[11px] inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <TrendingUp className="h-3 w-3" /> +6 vs prior version
          </div>
        </div>

        <div className="px-5 py-5 flex items-center gap-5">
          <div className="relative h-[132px] w-[132px] flex-shrink-0">
            <svg viewBox="0 0 120 120" className="-rotate-90 h-full w-full">
              <circle cx="60" cy="60" r="52" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" fill="none" />
              <circle
                cx="60" cy="60" r="52" strokeWidth="10" fill="none" strokeLinecap="round"
                className={band.ring}
                strokeDasharray={C}
                strokeDashoffset={dashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-3xl font-semibold tabular-nums ${band.color}`}>{score}</div>
              <div className={`text-[10px] uppercase tracking-wider font-semibold ${band.color}`}>{band.label}</div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <Row label="High" count={high} of={RISKS.length} dot="bg-red-500" bar="bg-red-500" />
            <Row label="Medium" count={medium} of={RISKS.length} dot="bg-amber-500" bar="bg-amber-500" />
            <Row label="Low" count={low} of={RISKS.length} dot="bg-emerald-500" bar="bg-emerald-500" />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              Top driver: <span className="font-medium text-slate-700 dark:text-slate-200">Auto-renewal trap (§ 12.2)</span>
            </div>
          </div>
        </div>

        <button className="w-full px-5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
          Open full risk breakdown
        </button>
      </div>
    </div>
  );
}

function Row({ label, count, of, dot, bar }: { label: string; count: number; of: number; dot: string; bar: string }) {
  const pct = Math.round((count / of) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-xs text-slate-600 dark:text-slate-300 w-14">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 w-6 text-right">{count}</span>
    </div>
  );
}
