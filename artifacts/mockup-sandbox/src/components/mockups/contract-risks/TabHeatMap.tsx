import { ShieldAlert, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";
import { CONTRACT_LABEL, RISKS, SEV_DOT, SEV_LABEL, SEV_TEXT, SEV_RING } from "./_data";

const COLS = 5; // likelihood
const ROWS = 5; // impact

function cellTone(impact: number, likelihood: number) {
  const score = impact * likelihood;
  if (score >= 16) return "bg-red-100/70 dark:bg-red-950/40";
  if (score >= 9)  return "bg-amber-100/70 dark:bg-amber-950/40";
  if (score >= 4)  return "bg-yellow-50 dark:bg-yellow-950/30";
  return "bg-emerald-50/70 dark:bg-emerald-950/30";
}

export function TabHeatMap() {
  const [selectedId, setSelectedId] = useState<string>(RISKS[0].id);
  const selected = RISKS.find((r) => r.id === selectedId)!;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1180px] mx-auto px-6 py-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5" /> {CONTRACT_LABEL}
            </div>
            <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              Risks — likelihood × impact
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {RISKS.length} flagged · click any dot to inspect
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-red-100 dark:bg-red-950/60" />Critical</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-amber-100 dark:bg-amber-950/60" />High</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-yellow-50 dark:bg-yellow-950/40" />Moderate</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-emerald-50 dark:bg-emerald-950/60" />Low</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="grid" style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}>
              <div></div>
              {Array.from({ length: COLS }, (_, i) => (
                <div key={i} className="text-[10px] uppercase tracking-wider font-medium text-slate-400 text-center pb-1.5">
                  {["Rare", "Unlikely", "Possible", "Likely", "Certain"][i]}
                </div>
              ))}

              {Array.from({ length: ROWS }, (_, rowIdx) => {
                const impactValue = ROWS - rowIdx; // 5 at top
                return (
                  <div key={rowIdx} className="contents">
                    <div className="text-[10px] uppercase tracking-wider font-medium text-slate-400 flex items-center justify-end pr-2">
                      {["Severe", "Major", "Moderate", "Minor", "Trivial"][rowIdx]}
                    </div>
                    {Array.from({ length: COLS }, (_, colIdx) => {
                      const likelihoodValue = colIdx + 1;
                      const inCell = RISKS.filter((r) => r.likelihood === likelihoodValue && r.impact === impactValue);
                      return (
                        <div
                          key={colIdx}
                          className={`relative h-[88px] ${cellTone(impactValue, likelihoodValue)} border border-white dark:border-slate-900 rounded-sm flex items-center justify-center`}
                        >
                          <div className="flex flex-wrap gap-1 p-1.5">
                            {inCell.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => setSelectedId(r.id)}
                                title={r.title}
                                className={`h-6 w-6 rounded-full ${SEV_DOT[r.severity]} text-[10px] font-bold text-white shadow-sm ring-2 ${
                                  r.id === selectedId ? "ring-slate-900 dark:ring-white scale-110" : "ring-white dark:ring-slate-900"
                                } transition-transform hover:scale-110 flex items-center justify-center`}
                              >
                                {r.id.replace("r", "")}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="text-[10px] uppercase tracking-wider font-medium text-slate-400">↑ Impact</div>
              <div className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Likelihood →</div>
            </div>
          </div>

          <div className="col-span-4 space-y-3">
            <div className={`rounded-lg ring-1 ring-inset ${SEV_RING[selected.severity]} bg-white dark:bg-slate-900 p-4`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${SEV_TEXT[selected.severity]}`}>
                  {SEV_LABEL[selected.severity]} severity
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Risk #{selected.id.replace("r", "")}</span>
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-2 font-medium">{selected.category}</div>
              <h3 className="text-sm font-semibold mt-1">{selected.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{selected.summary}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md border border-slate-200 dark:border-slate-800 py-2">
                  <div className="text-lg font-semibold tabular-nums">{selected.likelihood}/5</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Likelihood</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-slate-800 py-2">
                  <div className="text-lg font-semibold tabular-nums">{selected.impact}/5</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Impact</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 dark:text-slate-400">Clause</div>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5 hover:underline">
                  {selected.clauseRef} <ExternalLink className="h-3 w-3" />
                </button>
                <blockquote className="text-[11px] italic text-slate-600 dark:text-slate-400 mt-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-800">
                  "{selected.clauseExcerpt}"
                </blockquote>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 dark:text-slate-400">Suggested action</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">{selected.suggestedAction}</div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button className="text-[11px] font-medium px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90">Acknowledge</button>
                <button className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Assign</button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 dark:text-slate-400 mb-1.5">All risks</div>
              <ul className="space-y-1">
                {RISKS.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs ${
                        r.id === selectedId ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${SEV_DOT[r.severity]} flex-shrink-0`} />
                      <span className="font-mono text-[10px] text-slate-400 w-4">{r.id.replace("r", "")}</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
