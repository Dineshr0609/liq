import { useMemo } from "react";
import { Calendar } from "lucide-react";

type Tone = "amber" | "zinc" | "emerald";

function CountdownChip({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: Tone;
  testId: string;
}) {
  const cls = {
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-100",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
  }[tone];
  return (
    <div className={`px-3 py-2 rounded-md border ${cls}`} data-testid={testId}>
      <div className="text-[10px] uppercase tracking-wide font-medium opacity-80">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function fmt(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function TimelineTile({ contract }: { contract: any }) {
  const startRaw = contract?.effectiveStart
    ? new Date(contract.effectiveStart)
    : null;
  const endRaw = contract?.effectiveEnd
    ? new Date(contract.effectiveEnd)
    : null;
  const start =
    startRaw && !Number.isNaN(startRaw.getTime()) ? startRaw : null;
  const end = endRaw && !Number.isNaN(endRaw.getTime()) ? endRaw : null;

  const today = useMemo(() => new Date(), []);

  // Notice period in days: prefer financialPolicies.noticePeriodDays, fall
  // back to 90 if auto-renewal is on and no explicit value is set.
  const noticeDays: number | null = useMemo(() => {
    const p =
      contract?.financialPolicies?.noticePeriodDays ??
      contract?.financialPolicies?.notice_period_days ??
      contract?.noticePeriodDays;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
    return contract?.autoRenew ? 90 : null;
  }, [contract]);

  const noticeOpens =
    end && noticeDays != null
      ? new Date(end.getTime() - noticeDays * 24 * 60 * 60 * 1000)
      : null;

  const totalDays = start && end ? Math.max(daysBetween(start, end), 1) : 0;
  const elapsedDays = start && end ? daysBetween(start, today) : 0;
  const todayPct =
    start && end ? clampPercent((elapsedDays / totalDays) * 100) : 0;
  const noticePct =
    start && end && noticeOpens
      ? clampPercent((daysBetween(start, noticeOpens) / totalDays) * 100)
      : null;

  const daysToEnd = end ? daysBetween(today, end) : null;
  const daysToNotice =
    noticeOpens && noticeOpens > today ? daysBetween(today, noticeOpens) : null;
  const daysInTerm = start && start <= today ? daysBetween(start, today) : null;

  const headerSub = (() => {
    if (!start || !end) return "";
    const months = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    );
    const years = months / 12;
    const termLabel =
      years >= 1
        ? `${Math.round(years)}-year term`
        : `${months}-month term`;
    return contract?.autoRenew ? `${termLabel} · auto-renews` : termLabel;
  })();

  const beforeStart = start ? today < start : false;
  const afterEnd = end ? today > end : false;

  if (!start && !end) {
    return (
      <section
        className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col"
        data-testid="card-timeline"
      >
        <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-zinc-900">Contract timeline</h3>
          </div>
        </header>
        <div className="p-6 text-center text-xs text-zinc-500" data-testid="text-timeline-empty">
          No effective dates yet. Add Effective start and Effective end on the
          Financial Snapshot to see the timeline.
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col"
      data-testid="card-timeline"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Contract timeline</h3>
        </div>
        {headerSub && (
          <span className="text-[10px] text-zinc-400" data-testid="text-timeline-sub">
            {headerSub}
          </span>
        )}
      </header>
      <div className="p-4 flex-1">
        {/* Track */}
        <div className="relative h-16">
          <div className="absolute top-7 left-0 right-0 h-1 rounded-full bg-zinc-100" />
          <div
            className="absolute top-7 left-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300"
            style={{ width: `${todayPct}%` }}
          />
          {/* Start */}
          <Marker x={0} label="Effective start" sub={fmt(start)} kind="muted" />
          {/* Today (only when within the term window) */}
          {!beforeStart && !afterEnd && (
            <Marker x={todayPct} label="Today" sub={fmt(today)} kind="today" />
          )}
          {/* Notice opens */}
          {noticePct != null && noticeOpens && noticeOpens > today && (
            <Marker
              x={noticePct}
              label="Notice opens"
              sub={fmt(noticeOpens)}
              kind="warn"
            />
          )}
          {/* End */}
          <Marker x={100} label="Term ends" sub={fmt(end)} kind="muted" />
        </div>

        {/* Countdown chips */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {daysToNotice != null && (
            <CountdownChip
              label="To notice deadline"
              value={`${daysToNotice} days`}
              tone="amber"
              testId="chip-notice-countdown"
            />
          )}
          {daysToEnd != null && daysToEnd >= 0 && (
            <CountdownChip
              label="To term end"
              value={`${daysToEnd} days`}
              tone="zinc"
              testId="chip-term-end-countdown"
            />
          )}
          {daysToEnd != null && daysToEnd < 0 && (
            <CountdownChip
              label="Past term end"
              value={`${Math.abs(daysToEnd)} days`}
              tone="amber"
              testId="chip-past-end"
            />
          )}
          {daysInTerm != null && (
            <CountdownChip
              label="In term"
              value={`${daysInTerm} days`}
              tone="emerald"
              testId="chip-in-term"
            />
          )}
          {beforeStart && start && (
            <CountdownChip
              label="Until start"
              value={`${daysBetween(today, start)} days`}
              tone="zinc"
              testId="chip-until-start"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Marker({
  x,
  label,
  sub,
  kind,
}: {
  x: number;
  label: string;
  sub: string;
  kind: "muted" | "today" | "warn";
}) {
  const dot =
    kind === "today"
      ? "bg-emerald-500"
      : kind === "warn"
      ? "bg-amber-500"
      : "bg-zinc-400";
  return (
    <div
      className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
      style={{ left: `${x}%` }}
    >
      <div className="text-[10px] font-medium text-zinc-700 whitespace-nowrap">
        {label}
      </div>
      <div className={`mt-5 h-3 w-3 rounded-full ring-2 ring-white ${dot}`} />
      <div className="mt-1 text-[10px] text-zinc-500 whitespace-nowrap">{sub}</div>
    </div>
  );
}
