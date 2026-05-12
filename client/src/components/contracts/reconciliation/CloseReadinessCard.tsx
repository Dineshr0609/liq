import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export interface CloseReadinessItem {
  key: string;
  label: string;
  sublabel?: string;
  status: "done" | "warning" | "pending";
}

export function CloseReadinessCard({
  items,
  etaMinutes,
}: {
  items: CloseReadinessItem[];
  etaMinutes: number;
}) {
  const totalDone = items.filter((i) => i.status === "done").length;
  return (
    <div className="bg-white border border-zinc-200 rounded-md p-3" data-testid="card-close-readiness">
      <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-zinc-400" />
        Close Readiness
      </h3>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon =
            item.status === "done"
              ? CheckCircle2
              : item.status === "warning"
              ? AlertTriangle
              : Clock;
          const tone =
            item.status === "done"
              ? "text-emerald-500"
              : item.status === "warning"
              ? "text-amber-500"
              : "text-zinc-400";
          return (
            <div
              key={item.key}
              className={`flex items-start gap-2 text-sm ${item.status === "pending" ? "opacity-70" : ""}`}
              data-testid={`close-readiness-${item.key}`}
            >
              <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 text-xs leading-tight">{item.label}</div>
                {item.sublabel && (
                  <div className="text-[10px] text-zinc-500">{item.sublabel}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-100 text-[10px] text-zinc-500 flex items-center justify-between">
        <span>
          <span className="font-semibold text-zinc-700">{totalDone}</span> / {items.length} steps done
        </span>
        <span>ETA ~ {etaMinutes} min</span>
      </div>
    </div>
  );
}
