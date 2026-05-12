import { ShieldAlert, FileText, Calendar, ExternalLink, Clock } from "lucide-react";
import { CONTRACT_LABEL, RISKS, SEV_DOT, SEV_LABEL, SEV_TEXT, type Risk } from "./_data";

type TimelineEvent = {
  id: string;
  label: string;
  date: string;
  daysFromNow: number;
  kind: "milestone" | "risk";
  risk?: Risk;
};

const MILESTONES: TimelineEvent[] = [
  { id: "today",  label: "Today",                    date: "Apr 26, 2026", daysFromNow: 0,    kind: "milestone" },
  { id: "q3",     label: "Q3 close",                 date: "Sep 30, 2026", daysFromNow: 157,  kind: "milestone" },
  { id: "renew",  label: "Renewal notice deadline",  date: "Dec 31, 2026", daysFromNow: 249,  kind: "milestone" },
  { id: "term",   label: "Current term ends",        date: "Mar 31, 2027", daysFromNow: 339,  kind: "milestone" },
  { id: "audit",  label: "Audit window closes",      date: "Apr 26, 2027", daysFromNow: 365,  kind: "milestone" },
];

const TRIGGERED_RISKS: TimelineEvent[] = RISKS
  .filter((r) => typeof r.triggersOnDays === "number")
  .map((r) => ({
    id: `risk-${r.id}`,
    label: r.title,
    date: `${r.triggersOnLabel ?? "Triggers in"} · ~${r.triggersOnDays} days`,
    daysFromNow: r.triggersOnDays!,
    kind: "risk",
    risk: r,
  }));

const STANDING_RISKS = RISKS.filter((r) => typeof r.triggersOnDays !== "number");

function rank(r: Risk) {
  return r.severity === "high" ? 0 : r.severity === "medium" ? 1 : 2;
}

const MAX_DAYS = 400;

export function TabTimeline() {
  const events: TimelineEvent[] = [...MILESTONES, ...TRIGGERED_RISKS].sort((a, b) => a.daysFromNow - b.daysFromNow);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1180px] mx-auto px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5" /> {CONTRACT_LABEL}
            </div>
            <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              Risks across the contract lifecycle
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              When each risk bites · {RISKS.length} flagged
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Showing next 12 months
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 mb-5">
          <div className="relative">
            <div className="absolute left-0 right-0 top-9 h-1 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-300 dark:from-emerald-900 dark:via-amber-900 dark:to-red-900" />

            <div className="relative flex justify-between mb-2 text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              <span>Now</span>
              <span>+3 mo</span>
              <span>+6 mo</span>
              <span>+9 mo</span>
              <span>+12 mo</span>
            </div>

            <div className="relative h-[280px]">
              {events.map((evt, idx) => {
                const xPct = Math.min(100, (evt.daysFromNow / MAX_DAYS) * 100);
                const isMilestone = evt.kind === "milestone";
                const above = idx % 2 === 0;
                const yOffset = above ? -110 : 40;

                return (
                  <div
                    key={evt.id}
                    className="absolute"
                    style={{ left: `calc(${xPct}% - 8px)`, top: 14 }}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                        isMilestone
                          ? "bg-slate-700 dark:bg-slate-200"
                          : SEV_DOT[evt.risk!.severity]
                      } shadow`}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[180px]"
                      style={{ top: yOffset }}
                    >
                      {above && <div className="mx-auto h-[60px] w-px bg-slate-200 dark:bg-slate-800" />}
                      <div
                        className={`rounded-md border ${
                          isMilestone
                            ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        } px-2.5 py-1.5 shadow-sm`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider font-bold ${
                          isMilestone ? "text-slate-500 dark:text-slate-400" : SEV_TEXT[evt.risk!.severity]
                        }`}>
                          {isMilestone ? "Milestone" : `${SEV_LABEL[evt.risk!.severity]} risk`}
                        </div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight mt-0.5 line-clamp-2">{evt.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 inline-flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />{evt.date}
                        </div>
                      </div>
                      {!above && <div className="mx-auto h-[60px] w-px bg-slate-200 dark:bg-slate-800" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold">Standing risks (no fixed date)</h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">— present for the life of the contract</span>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {[...STANDING_RISKS].sort((a, b) => rank(a) - rank(b)).map((r) => (
              <li key={r.id} className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 flex items-start gap-2.5">
                <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${SEV_DOT[r.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{r.title}</div>
                    <button className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-0.5 flex-shrink-0">
                      {r.clauseRef} <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{r.summary}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
