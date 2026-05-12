import {
  Inbox,
  Wallet,
  FileWarning,
  Scale,
  AlertTriangle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type Tone = "ok" | "info" | "amber" | "red" | "muted";

type PendingRow = {
  key: string;
  icon: LucideIcon;
  label: string;
  sub: string;
  tone: Tone;
  link: string;
  targetTab: string;
};

const ROWS: PendingRow[] = [
  {
    key: "claims",
    icon: Inbox,
    label: "Open claims",
    sub: "received, awaiting release",
    tone: "muted",
    link: "Sales Match",
    targetTab: "sales",
  },
  {
    key: "payments",
    icon: Wallet,
    label: "Pending payment",
    sub: "calculated · within window",
    tone: "muted",
    link: "Payments",
    targetTab: "payments",
  },
  {
    key: "overdue",
    icon: FileWarning,
    label: "Overdue invoices",
    sub: "all settlements on time",
    tone: "muted",
    link: "Payments",
    targetTab: "payments",
  },
  {
    key: "variances",
    icon: Scale,
    label: "Variances",
    sub: "calc vs paid · over $1K threshold",
    tone: "muted",
    link: "Ledger",
    targetTab: "ledger",
  },
  {
    key: "disputes",
    icon: AlertTriangle,
    label: "Disputes",
    sub: "open response loops",
    tone: "muted",
    link: "Ledger",
    targetTab: "ledger",
  },
];

const ICON_BG: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-600",
  info: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  muted: "bg-zinc-100 text-zinc-500",
};

export function PendingItemsTile({
  onOpenTab,
}: {
  onOpenTab?: (tab: string) => void;
}) {
  return (
    <section
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col"
      data-testid="card-pending-items"
    >
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Pending items</h3>
        </div>
        <span className="text-[10px] text-zinc-400" data-testid="text-pending-coming-soon">
          Live counts coming soon
        </span>
      </header>
      <ul className="divide-y divide-zinc-100 flex-1">
        {ROWS.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.key}
              onClick={() => onOpenTab?.(p.targetTab)}
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-50 cursor-pointer opacity-90"
              data-testid={`row-pending-${p.key}`}
            >
              <div
                className={`h-7 w-7 rounded-md flex items-center justify-center ${ICON_BG[p.tone]}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-900">{p.label}</div>
                <div className="text-[10px] text-zinc-500 truncate">{p.sub}</div>
              </div>
              <span
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded border bg-zinc-50 text-zinc-500 border-zinc-100"
                data-testid={`count-pending-${p.key}`}
              >
                —
              </span>
              <span className="text-[10px] text-zinc-400 inline-flex items-center gap-0.5 w-20 justify-end">
                {p.link} <ArrowUpRight className="h-3 w-3" />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
