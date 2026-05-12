import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Kpi {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "urgent" | "agent" | "warning" | "good";
  icon?: ReactNode;
}

const toneCls: Record<NonNullable<Kpi["tone"]>, string> = {
  neutral: "border-neutral-200 bg-white",
  urgent: "border-orange-300 bg-orange-50",
  agent: "border-neutral-300 bg-neutral-50",
  warning: "border-amber-300 bg-amber-50",
  good: "border-emerald-300 bg-emerald-50",
};

const valueCls: Record<NonNullable<Kpi["tone"]>, string> = {
  neutral: "text-neutral-900",
  urgent: "text-orange-700",
  agent: "text-neutral-900",
  warning: "text-amber-800",
  good: "text-emerald-700",
};

export function KpiStrip({ kpis, trailing }: { kpis: Kpi[]; trailing?: ReactNode }) {
  return (
    <div className="mb-2 flex items-stretch gap-2">
      <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
        {kpis.map(k => (
          <div
            key={k.key}
            data-testid={`kpi-${k.key}`}
            className={cn("flex flex-col rounded-lg border px-3 py-2", toneCls[k.tone || "neutral"])}
          >
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              <span>{k.label}</span>
              {k.icon}
            </div>
            <div className={cn("mt-0.5 text-xl font-semibold leading-tight", valueCls[k.tone || "neutral"])}>{k.value}</div>
            {k.hint && <div className="mt-0.5 text-[10px] text-neutral-500">{k.hint}</div>}
          </div>
        ))}
      </div>
      {trailing && <div className="flex items-stretch">{trailing}</div>}
    </div>
  );
}
