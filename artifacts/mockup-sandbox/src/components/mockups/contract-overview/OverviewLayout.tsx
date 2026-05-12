import {
  FileText,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Repeat,
  Target,
  Banknote,
  Calendar,
  ClipboardCheck,
  DollarSign,
  Settings,
  Clock,
  Pencil,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  Building2,
  ArrowUpRight,
  Lock,
  Inbox,
  FileWarning,
  Wallet,
  Scale,
  AlertTriangle,
} from "lucide-react";

// ---------- Mock data --------------------------------------------------------

const CONTRACT = {
  title: "Acme Pharma — Master License Agreement (2024)",
  number: "MLA-2024-0142",
  type: "Royalty license",
  status: "Active",
  governingLaw: "Delaware, USA",
};

const SUMMARY_TEXT =
  "Master license covering compounds A, B and C in the European Economic Area. " +
  "Royalty of 12% on net sales, exclusive territory, term Jan 1 2024 → Dec 31 2026 " +
  "with a 3-year auto-renewal unless 90-day notice is given.";

const PARTIES = [
  { initials: "LC", name: "LicenseIQ Corp.", role: "Licensor", primary: true },
  { initials: "AP", name: "Acme Pharma SA", role: "Licensee", primary: true },
];
const OTHER_PARTIES_COUNT = 2;

const SECONDARY_KPIS = [
  { label: "Products", value: "3", sub: "in scope" },
  { label: "Territories", value: "27", sub: "EEA" },
  { label: "Signed clauses", value: "41", sub: "extracted" },
];

const RISK_CATEGORIES = [
  { name: "Auto-renewal", icon: Repeat, sev: "high" as const, count: 1 },
  { name: "Concentration", icon: Target, sev: "high" as const, count: 1 },
  { name: "IP & licensing", icon: FileText, sev: "high" as const, count: 2 },
  { name: "Payment & price", icon: Banknote, sev: "medium" as const, count: 3 },
  { name: "Term & termination", icon: Calendar, sev: "low" as const, count: 1 },
  { name: "Audit & compliance", icon: ClipboardCheck, sev: "medium" as const, count: 1 },
];

const TIMELINE_MARKERS = [
  { x: 0, label: "Effective start", sub: "Jan 1, 2024", muted: true },
  { x: 47, label: "Today", sub: "Apr 26, 2026", today: true },
  { x: 78, label: "Notice opens", sub: "Sep 30, 2026", warn: true },
  { x: 100, label: "Term ends", sub: "Dec 31, 2026", muted: true },
];

const PENDING_ITEMS = [
  { icon: Inbox, label: "Open claims", count: 3, sub: "received, awaiting release", tone: "amber" as const, link: "Sales Match" },
  { icon: Wallet, label: "Pending payment", count: 1, sub: "calculated · within window", tone: "info" as const, link: "Payments" },
  { icon: FileWarning, label: "Overdue invoices", count: 0, sub: "all settlements on time", tone: "ok" as const, link: "Payments" },
  { icon: Scale, label: "Variances", count: 2, sub: "calc vs paid · over $1K threshold", tone: "amber" as const, link: "Ledger" },
  { icon: AlertTriangle, label: "Disputes", count: 1, sub: "Acme · response due Apr 30", tone: "red" as const, link: "Ledger" },
];

const PERF_BARS = [
  { label: "Nov", value: 78 },
  { label: "Dec", value: 86 },
  { label: "Jan", value: 92 },
  { label: "Feb", value: 88 },
  { label: "Mar", value: 105 },
  { label: "Apr", value: 118 },
];
const PERF_MAX = 130;

// ---------- Component --------------------------------------------------------

export function OverviewLayout() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="max-w-[1180px] mx-auto px-6 py-5 space-y-4">
        <PageHeader />
        <TabBar />

        {/* Row 1: Summary (left) + Risks (right) */}
        <div className="grid grid-cols-2 gap-4">
          <ContractSummaryTile />
          <RisksTile />
        </div>

        {/* Row 2: Financial Snapshot + Configuration Policies (existing) */}
        <div className="grid grid-cols-2 gap-4">
          <FinancialSnapshotTile />
          <ConfigPoliciesTile />
        </div>

        {/* Row 3: Timeline + Pending Items */}
        <div className="grid grid-cols-2 gap-4">
          <TimelineTile />
          <PendingItemsTile />
        </div>

        {/* Row 4: Performance KPI (full-width — early + mature states) */}
        <PerformanceTile />

        {/* Comparison panel — Contract value cell across the three life-stage states */}
        <ContractValueStatesPanel />

        <FootnoteBar />
      </div>
    </div>
  );
}

// ---------- Page chrome ------------------------------------------------------

function PageHeader() {
  return (
    <header className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-md bg-orange-50 flex items-center justify-center">
        <FileText className="h-4 w-4 text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500 font-medium">
          {CONTRACT.number} · {CONTRACT.type} · {CONTRACT.governingLaw}
        </div>
        <div className="text-sm font-semibold text-zinc-900 truncate">{CONTRACT.title}</div>
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {CONTRACT.status}
      </span>
      <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-200">
        <Lock className="h-3 w-3" /> Locked
      </button>
      <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-200">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </header>
  );
}

function TabBar() {
  const tabs = [
    "Overview",
    "Parties",
    "Terms & Clauses",
    "Rules",
    "Policies",
    "Risks",
    "Sales Match",
    "Payments",
    "Ledger",
    "History",
  ];
  return (
    <div className="flex items-center gap-1 border-b border-zinc-200 -mt-1">
      {tabs.map((t, i) => (
        <button
          key={t}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
            i === 0
              ? "border-orange-600 text-orange-700"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------- Tile: Contract Summary ------------------------------------------

function ContractSummaryTile() {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Contract Summary</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
            AI · verified
          </span>
        </div>
        <button className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </header>

      {/* AI summary line */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="text-xs text-zinc-700 leading-relaxed">{SUMMARY_TEXT}</div>
      </div>

      {/* Parties strip */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium mb-2">
          Parties
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PartyChip party={PARTIES[0]} />
          <ArrowRight className="h-3.5 w-3.5 text-zinc-300" />
          <PartyChip party={PARTIES[1]} />
          <button className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 ml-auto">
            +{OTHER_PARTIES_COUNT} operational <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* KPI strip removed for now (Contract Value, Products, Territories,
          Signed Clauses). Reference design lives in the comparison panel at
          the bottom of the page until we're confident in the numbers. */}
    </section>
  );
}

function ContractValueCell({
  state,
  primary,
  secondary,
  source,
  compact,
}: {
  state: "estimate" | "realized" | "mg";
  primary: string;
  secondary?: string;
  source: string;
  compact?: boolean;
}) {
  const tone =
    state === "estimate"
      ? "text-zinc-500"
      : state === "mg"
      ? "text-zinc-700"
      : "text-emerald-700";
  return (
    <div className={compact ? "px-2 py-2" : "px-3 py-3"}>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
          Contract value
        </div>
        <button
          className="text-[9px] text-zinc-400 hover:text-orange-700 inline-flex items-center gap-0.5"
          title="Show all 3 sources"
        >
          all 3 ▾
        </button>
      </div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={`text-sm font-semibold ${tone}`}>{primary}</span>
        {secondary && (
          <>
            <span className="text-[10px] text-zinc-300">/</span>
            <span className="text-xs font-medium text-zinc-700">{secondary}</span>
          </>
        )}
      </div>
      <div className="text-[10px] text-zinc-400 truncate">{source}</div>
    </div>
  );
}

function PartyChip({ party }: { party: (typeof PARTIES)[number] }) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50">
      <div className="h-6 w-6 rounded bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center">
        {party.initials}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-medium text-zinc-900">{party.name}</div>
        <div className="text-[10px] text-zinc-500">
          {party.role}
          {party.primary && " · primary"}
        </div>
      </div>
    </div>
  );
}

// ---------- Tile: Risks (compressed, right side) ----------------------------

function RisksTile() {
  const total = RISK_CATEGORIES.reduce((s, c) => s + c.count, 0);
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-semibold text-zinc-900">Risks & red flags</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">
            {total} flagged
          </span>
        </div>
        <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
          Risks tab <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>
      <div className="p-3 grid grid-cols-2 gap-1.5 flex-1">
        {RISK_CATEGORIES.map(({ name, icon: Icon, sev, count }) => (
          <RiskCell key={name} name={name} Icon={Icon} sev={sev} count={count} />
        ))}
      </div>
    </section>
  );
}

const SEV_BG: Record<string, string> = {
  high: "bg-red-50 ring-red-200",
  medium: "bg-amber-50 ring-amber-200",
  low: "bg-emerald-50 ring-emerald-200",
};
const SEV_TEXT: Record<string, string> = {
  high: "text-red-700",
  medium: "text-amber-700",
  low: "text-emerald-700",
};
const SEV_LABEL: Record<string, string> = {
  high: "Action needed",
  medium: "Watch",
  low: "OK",
};

function RiskCell({
  name,
  Icon,
  sev,
  count,
}: {
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  sev: "high" | "medium" | "low";
  count: number;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ring-inset ${SEV_BG[sev]}`}>
      <div className="h-7 w-7 rounded-md bg-white/70 flex items-center justify-center flex-shrink-0">
        <Icon className={`h-3.5 w-3.5 ${SEV_TEXT[sev]}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-zinc-900 truncate">{name}</div>
        <div className={`text-[10px] font-medium ${SEV_TEXT[sev]}`}>
          {SEV_LABEL[sev]} · {count}
        </div>
      </div>
    </div>
  );
}

// ---------- Tile: Financial Snapshot (existing, lighter) --------------------

function FinancialSnapshotTile() {
  const cells = [
    { label: "Currency", value: "USD", verified: true },
    { label: "Flow type", value: "Royalty license", verified: true },
    { label: "Effective start", value: "Jan 1, 2024", verified: true },
    { label: "Effective end", value: "Dec 31, 2026", verified: true },
    { label: "Governing law", value: "Delaware, USA", verified: true },
    { label: "Status", value: "Active", verified: true },
  ];
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Financial Snapshot</h3>
        </div>
        <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
          Terms tab <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>
      <div className="p-3 grid grid-cols-2 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="px-2 py-1.5 rounded border border-zinc-100">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
              {c.label}
            </div>
            <div className="text-xs font-medium text-zinc-900 mt-0.5 flex items-center gap-1">
              {c.value}
              {c.verified && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Tile: Configuration Policies (existing, lighter) ----------------

function ConfigPoliciesTile() {
  const rows = [
    { label: "Accrual basis", value: "Net sales, monthly" },
    { label: "Settlement cadence", value: "Quarterly · 30 days" },
    { label: "Recoupment", value: "Advances against royalties" },
    { label: "Audit rights", value: "12 months look-back" },
  ];
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Configuration Policies</h3>
          <span className="text-[10px] text-zinc-400">read-only · v3 current</span>
        </div>
        <button className="text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
          Edit in Policies tab <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>
      <div className="p-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-zinc-100">
            <span className="text-zinc-500">{r.label}</span>
            <span className="font-medium text-zinc-900">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Tile: Timeline ---------------------------------------------------

function TimelineTile() {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Contract timeline</h3>
        </div>
        <span className="text-[10px] text-zinc-400">3-year term · auto-renews</span>
      </header>
      <div className="p-4 flex-1">
        {/* Track */}
        <div className="relative h-16">
          <div className="absolute top-7 left-0 right-0 h-1 rounded-full bg-zinc-100" />
          <div
            className="absolute top-7 left-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300"
            style={{ width: `${TIMELINE_MARKERS[1].x}%` }}
          />
          {TIMELINE_MARKERS.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${m.x}%` }}
            >
              <div className="text-[10px] font-medium text-zinc-700 whitespace-nowrap">
                {m.label}
              </div>
              <div
                className={`mt-5 h-3 w-3 rounded-full ring-2 ring-white ${
                  m.today
                    ? "bg-emerald-500"
                    : m.warn
                    ? "bg-amber-500"
                    : "bg-zinc-400"
                }`}
              />
              <div className="mt-1 text-[10px] text-zinc-500 whitespace-nowrap">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Countdown chips */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <CountdownChip label="To notice deadline" value="157 days" tone="amber" />
          <CountdownChip label="To term end" value="249 days" tone="zinc" />
          <CountdownChip label="In term" value="847 days" tone="emerald" />
        </div>
      </div>
    </section>
  );
}

function CountdownChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "zinc" | "emerald";
}) {
  const cls = {
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-100",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
  }[tone];
  return (
    <div className={`px-3 py-2 rounded-md border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide font-medium opacity-80">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

// ---------- Tile: Pending Items ---------------------------------------------

function PendingItemsTile() {
  const totalOpen = PENDING_ITEMS.reduce((s, i) => s + i.count, 0);
  const iconBg: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-600",
    info: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    muted: "bg-zinc-100 text-zinc-500",
  };
  const countCls: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Pending items</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium border border-amber-100">
            {totalOpen} open
          </span>
        </div>
        <span className="text-[10px] text-zinc-400">activity moved → History tab</span>
      </header>
      <ul className="divide-y divide-zinc-100 flex-1">
        {PENDING_ITEMS.map((p, i) => {
          const empty = p.count === 0;
          return (
            <li
              key={i}
              className={`px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-50 cursor-pointer ${
                empty ? "opacity-70" : ""
              }`}
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center ${iconBg[p.tone]}`}>
                <p.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-900">{p.label}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {empty ? "All clear" : p.sub}
                </div>
              </div>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                  empty
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : countCls[p.tone]
                }`}
              >
                {empty ? "0" : p.count}
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

// ---------- Tile: Performance KPI -------------------------------------------

function PerformanceTile() {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-900">Performance</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium border border-orange-100">
            Royalty license profile
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium border border-zinc-200">
            Trailing 6 mo
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["Monthly", "Quarterly", "YTD"] as const).map((t, i) => (
            <button
              key={t}
              className={`text-[11px] px-2 py-1 rounded-md border ${
                i === 0
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {t}
            </button>
          ))}
          <button className="ml-2 text-[11px] font-medium text-zinc-600 hover:text-orange-700 inline-flex items-center gap-0.5">
            Open in Ledger <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Two halves: mature state (left) and early state (right) */}
      <div className="grid grid-cols-2 divide-x divide-zinc-100">
        {/* Mature state */}
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold mb-2">
            Mature state · after a few periods
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="text-2xl font-semibold text-zinc-900">$1.24M</div>
              <div className="text-[11px] text-zinc-500">Trailing 12 mo accruals</div>
            </div>
            <div className="text-emerald-600 text-xs font-semibold inline-flex items-center gap-1">
              <ArrowRight className="h-3 w-3 rotate-[-45deg]" /> +18% vs prior 12 mo
            </div>
          </div>

          {/* Bar chart */}
          <div className="mt-4 flex items-end gap-3 h-28">
            {PERF_BARS.map((b, i) => (
              <div key={b.label} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
                  <div
                    className={`w-full rounded-t ${
                      i === PERF_BARS.length - 1 ? "bg-emerald-500" : "bg-emerald-200"
                    }`}
                    style={{ height: `${(b.value / PERF_MAX) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500">{b.label}</div>
                <div className="text-[10px] font-medium text-zinc-700">${b.value}K</div>
              </div>
            ))}
          </div>

          {/* Sub-KPIs */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <PerfKpi label="Avg / mo" value="$103K" />
            <PerfKpi label="vs forecast" value="+6%" tone="emerald" />
            <PerfKpi label="Top product" value="62% mix" />
            <PerfKpi label="On-time pay" value="4 / 4" tone="emerald" />
          </div>
        </div>

        {/* Early state */}
        <div className="p-4 bg-zinc-50/40">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold mb-2">
            Early state · before first calculation
          </div>
          <div className="border border-dashed border-zinc-300 rounded-md p-5 bg-white">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">
                  Awaiting first period close
                </div>
                <div className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Performance will populate once Q1 2026 sales are matched and a fee
                  calculation is run. Estimated next run: <span className="font-medium">Apr 30</span>.
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-orange-600 text-white hover:bg-orange-700">
                    Run calculation now
                  </button>
                  <button className="text-[11px] font-medium px-2 py-1 rounded-md border border-zinc-200 text-zinc-600 hover:bg-white">
                    Configure cadence
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast preview */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <PerfKpi label="Forecast Q2" value="$280K" muted />
            <PerfKpi label="Active products" value="3" muted />
            <PerfKpi label="Sales matched" value="0" muted />
          </div>
          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-zinc-600 bg-orange-50 border border-orange-100 rounded-md px-2 py-1.5">
            <Lightbulb className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
            <span>
              <span className="font-semibold">liQ AI:</span> Forecast is derived from contract
              terms only. Numbers will update as real sales arrive.
            </span>
          </div>
        </div>
      </div>

      {/* Flow-type variants footer — same tile, different KPIs by flow type */}
      <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">
          Headline + sub-KPIs swap by flow type
        </div>
        <div className="grid grid-cols-4 gap-2">
          <FlowVariant
            name="Royalty license"
            active
            headline="Trailing 12 mo accruals"
            kpis={["Avg / mo", "vs forecast", "Top product mix", "On-time pay"]}
          />
          <FlowVariant
            name="Minimum guarantee"
            headline="MG balance vs earned"
            kpis={["Recoupment %", "Periods to break-even", "Coverage gap", "Next true-up"]}
          />
          <FlowVariant
            name="Distribution"
            headline="Sales through channel"
            kpis={["GMV", "Channel split", "Returns rate", "Sell-through"]}
          />
          <FlowVariant
            name="Rebate"
            headline="Rebate accrued YTD"
            kpis={["Current tier", "To next tier", "Projected payout", "Threshold met"]}
          />
        </div>
      </div>
    </section>
  );
}

function FlowVariant({
  name,
  headline,
  kpis,
  active,
}: {
  name: string;
  headline: string;
  kpis: string[];
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-2.5 py-2 ${
        active ? "border-orange-200 bg-orange-50/40 ring-1 ring-orange-100" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className={`text-[11px] font-semibold ${active ? "text-orange-700" : "text-zinc-700"}`}>
          {name}
        </div>
        {active && <span className="text-[9px] text-orange-600 font-medium">CURRENT</span>}
      </div>
      <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{headline}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {kpis.map((k) => (
          <span
            key={k}
            className={`text-[9px] px-1 py-0.5 rounded ${
              active ? "bg-white text-zinc-700 border border-zinc-200" : "bg-zinc-50 text-zinc-500 border border-zinc-100"
            }`}
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function PerfKpi({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "emerald";
  muted?: boolean;
}) {
  return (
    <div className={`px-2.5 py-1.5 rounded border ${muted ? "border-zinc-100 bg-white" : "border-zinc-100"}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">{label}</div>
      <div
        className={`text-xs font-semibold mt-0.5 ${
          tone === "emerald" ? "text-emerald-700" : muted ? "text-zinc-400" : "text-zinc-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- Comparison: Contract value cell × 3 states ----------------------

function ContractValueStatesPanel() {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">
            Contract value cell — three life-stage states
          </h3>
          <span className="text-[10px] text-zinc-400">design reference · not part of page</span>
        </div>
        <span className="text-[10px] text-zinc-400">picked automatically by contract type + maturity</span>
      </header>
      <div className="grid grid-cols-3 divide-x divide-zinc-100">
        <ValueStateColumn
          tag="Pre-first-close · any contract"
          tagTone="zinc"
          rationale="Before any sales arrive. Pulled from contractValueEstimatedAnnual × term length, or financialAnalysis.totalValue if AI extracted a total."
        >
          <ContractValueCell
            state="estimate"
            primary="$2.4M"
            source="AI estimate · 3-yr term"
            compact
          />
        </ValueStateColumn>

        <ValueStateColumn
          tag="Mature · royalty / distribution"
          tagTone="emerald"
          rationale="Trailing 12 mo realized — SUM(contract_calculations.totalRoyalty) over the window. The truthful answer once periods have closed."
        >
          <ContractValueCell
            state="realized"
            primary="$1.24M"
            source="trailing 12 mo realized"
            compact
          />
        </ValueStateColumn>

        <ValueStateColumn
          tag="Minimum guarantee contract"
          tagTone="orange"
          rationale="Floor matters most: SUM(rules.minimumGuarantee) × term, shown alongside realized so finance can see whether MG was cleared."
        >
          <ContractValueCell
            state="mg"
            primary="$3.0M"
            secondary="$1.24M"
            source="floor / realized · MG cleared"
            compact
          />
        </ValueStateColumn>
      </div>
      <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/60 flex items-start gap-2 text-[11px] text-zinc-600">
        <Lightbulb className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
        <span>
          The "all 3 ▾" affordance opens a small popover showing all three numbers + their
          formulas. Default display can be configured under <strong>System Settings → Display</strong>{" "}
          (Estimate / Realized / Both).
        </span>
      </div>
    </section>
  );
}

function ValueStateColumn({
  tag,
  tagTone,
  rationale,
  children,
}: {
  tag: string;
  tagTone: "zinc" | "emerald" | "orange";
  rationale: string;
  children: React.ReactNode;
}) {
  const tagCls = {
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
  }[tagTone];
  return (
    <div className="p-3 flex flex-col gap-2">
      <span className={`inline-flex w-fit text-[10px] font-medium px-1.5 py-0.5 rounded border ${tagCls}`}>
        {tag}
      </span>
      <div className="border border-zinc-200 rounded-md bg-white">{children}</div>
      <div className="text-[11px] text-zinc-500 leading-relaxed">{rationale}</div>
    </div>
  );
}

// ---------- Footnote --------------------------------------------------------

function FootnoteBar() {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-md px-3 py-2 flex items-start gap-2 text-[11px] text-zinc-700">
      <Building2 className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">Layout proposal v2 —</span> Identity strip removed.
        Rows: <strong>Contract Summary + Risks</strong>, <strong>Financial + Policies (read-only,
        edit in Policies tab)</strong>, <strong>Timeline + Pending items</strong> (open claims,
        pending payment, overdue invoices, variances, disputes), <strong>Performance</strong>{" "}
        (flow-type aware, deep link → Ledger). Activity log moved to History tab.
      </div>
    </div>
  );
}
