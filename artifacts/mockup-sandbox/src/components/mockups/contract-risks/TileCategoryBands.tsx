import { ShieldAlert, Repeat, Target, FileText, Banknote, Calendar, ClipboardCheck } from "lucide-react";
import { RISKS, SEV_DOT, type RiskCategory, type Severity } from "./_data";

const CATEGORIES: { name: RiskCategory; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Auto-renewal", icon: Repeat },
  { name: "Concentration", icon: Target },
  { name: "IP & licensing", icon: FileText },
  { name: "Payment & price", icon: Banknote },
  { name: "Term & termination", icon: Calendar },
  { name: "Audit & compliance", icon: ClipboardCheck },
];

function worstSeverity(cat: RiskCategory): Severity | "none" {
  const items = RISKS.filter((r) => r.category === cat);
  if (items.length === 0) return "none";
  if (items.some((r) => r.severity === "high")) return "high";
  if (items.some((r) => r.severity === "medium")) return "medium";
  return "low";
}

const STATUS_RING: Record<Severity | "none", string> = {
  high: "bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-900",
  medium: "bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-900",
  low: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200 dark:ring-emerald-900",
  none: "bg-slate-50 dark:bg-slate-900 ring-slate-200 dark:ring-slate-800",
};

const STATUS_TEXT: Record<Severity | "none", string> = {
  high: "text-red-700 dark:text-red-300",
  medium: "text-amber-700 dark:text-amber-300",
  low: "text-emerald-700 dark:text-emerald-300",
  none: "text-slate-500 dark:text-slate-400",
};

const STATUS_LABEL: Record<Severity | "none", string> = {
  high: "Action needed",
  medium: "Watch",
  low: "OK",
  none: "Clear",
};

export function TileCategoryBands() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6">
      <div className="w-full max-w-[640px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-50 dark:bg-red-950/60 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk by category</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{RISKS.length} flagged across {CATEGORIES.length} categories</div>
            </div>
          </div>
          <button className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">View all</button>
        </div>

        <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
          {CATEGORIES.map(({ name, icon: Icon }) => {
            const sev = worstSeverity(name);
            const count = RISKS.filter((r) => r.category === name).length;
            return (
              <div
                key={name}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ring-1 ring-inset ${STATUS_RING[sev]} cursor-pointer hover:brightness-95 dark:hover:brightness-110`}
              >
                <div className="h-7 w-7 rounded-md bg-white/60 dark:bg-slate-950/40 flex items-center justify-center flex-shrink-0">
                  <Icon className={`h-3.5 w-3.5 ${STATUS_TEXT[sev]}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{name}</div>
                  <div className={`text-[10px] font-medium ${STATUS_TEXT[sev]}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${SEV_DOT[sev === "none" ? "low" : sev]}`} style={sev === "none" ? { background: "rgb(148 163 184)" } : undefined} />
                    {STATUS_LABEL[sev]} · {count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
