import { useState } from "react";
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  FileText,
  BookOpen,
  Receipt,
  Handshake,
  Wallet,
  Scale,
  Inbox,
  Send,
  Building2,
  Calculator,
  ArrowLeftRight,
  Filter,
  Download,
  ChevronsUpDown,
  Activity,
  CircleCheck,
  CircleAlert,
  CircleDashed,
  CircleDot,
  ShieldCheck,
  Eye,
  History,
  ArrowUpRight,
  Pin,
  Bot,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — shaped after the LicenseIQ subledger
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD = {
  label: "Apr 2026",
  entity: "LicenseIQ Corp. (Consol.)",
  closeDay: 3,
  closeTarget: 5,
  cutoff: "May 5, 2026 17:00 PT",
};

const SIGNOFF = {
  prepare: { who: "J. Chen", role: "Staff Accountant", at: "Apr 28 09:14", done: true },
  review: { who: "M. Patel", role: "Controller", at: null, done: false, current: true },
  lock: { who: "S. Rivera", role: "VP Finance", at: null, done: false },
};

const KPIS = [
  { label: "Contract Obligations", value: "147", sub: "$4.18M exposure", delta: "+6", deltaTone: "neutral" as const, icon: FileText },
  { label: "Accrued (this period)", value: "$3.92M", sub: "142 of 147 calc'd", delta: "+8.4%", deltaTone: "up" as const, icon: Calculator },
  { label: "JE'd to GL", value: "$3.74M", sub: "Dr/Cr balanced · 5 unposted", delta: "94.4%", deltaTone: "neutral" as const, icon: BookOpen },
  { label: "Cash Settled", value: "$2.41M", sub: "89 of 138 settlements", delta: "64.5%", deltaTone: "neutral" as const, icon: Wallet },
  { label: "Open Claims", value: "37", sub: "23 inbound · 14 outbound", delta: "7 disputed", deltaTone: "warn" as const, icon: Inbox },
  { label: "Variance vs Mar", value: "+5.7%", sub: "$214k drift", delta: "1 AI flag", deltaTone: "warn" as const, icon: Scale },
];

// Stage funnel — matches the user's progressive drill-down
const STAGES = [
  { key: "obligations", label: "Obligations", icon: FileText, count: 147, value: "$4.18M", complete: 147, pct: 100 },
  { key: "flow", label: "By Flow", icon: ArrowLeftRight, count: 4, value: "4 flows", complete: 4, pct: 100 },
  { key: "subflow", label: "Sub-flow / Program", icon: Filter, count: 31, value: "31 programs", complete: 28, pct: 90 },
  { key: "accrual", label: "Accruals Calc'd", icon: Calculator, count: 142, value: "$3.92M", complete: 142, pct: 96.6 },
  { key: "je", label: "JEs Posted", icon: BookOpen, count: 138, value: "$3.74M", complete: 138, pct: 93.9 },
  { key: "settlement", label: "Settlements", icon: Handshake, count: 138, value: "89/138", complete: 89, pct: 64.5, split: { done: 89, pending: 49 } },
  { key: "claims", label: "Claims (IB/OB)", icon: Inbox, count: 37, value: "23 IB · 14 OB", complete: 23, pct: 62 },
  { key: "deductions", label: "Deductions", icon: ArrowLeftRight, count: 12, value: "$186k", complete: 12, pct: 100 },
  { key: "invoices", label: "Invoice Status", icon: Receipt, count: 76, value: "8 overdue", complete: 68, pct: 89.5 },
];

// Drill-down: Flow → Sub-flow → Obligation
const FLOWS = [
  {
    key: "rebates",
    name: "Rebates",
    icon: "💰",
    count: 62,
    accrued: 1840000,
    settled: 1080000,
    open: 760000,
    trend: 8.2,
    blockers: 2,
    subflows: [
      {
        name: "CRP — Customer Rebate Program",
        count: 28, accrued: 940000, je: "✓", settled: 540000, claims: { ib: 9, ob: 0 }, deductions: 4, invoices: "32/4 ovd",
        obligations: [
          { id: "OBL-2026-0413", contract: "Walmart MSA Q2", flow: "CRP-VOL", accrual: 142000, je: "posted", settle: "pending", claim: "IB approved", dedn: "—", inv: "issued" },
          { id: "OBL-2026-0418", contract: "Target Annual Vol", flow: "CRP-TIER", accrual: 88500, je: "posted", settle: "settled", claim: "IB paid", dedn: "—", inv: "—" },
          { id: "OBL-2026-0421", contract: "Costco Stack", flow: "CRP-STACK", accrual: 67200, je: "draft", settle: "pending", claim: "IB needs review", dedn: "—", inv: "issued" },
        ],
      },
      {
        name: "VRP — Vendor Rebate Program",
        count: 18, accrued: 520000, je: "✓", settled: 280000, claims: { ib: 0, ob: 14 }, deductions: 6, invoices: "—",
        obligations: [
          { id: "OBL-2026-0438", contract: "Soundcore Q1 Vol", flow: "VRP-VOL", accrual: 64000, je: "posted", settle: "pending", claim: "OB submitted", dedn: "applied $32k", inv: "—" },
          { id: "OBL-2026-0441", contract: "Anker Distrib.", flow: "VRP-MIX", accrual: 41200, je: "posted", settle: "settled", claim: "OB confirmed", dedn: "—", inv: "—" },
        ],
      },
      {
        name: "RSM — Reseller Marketing",
        count: 9, accrued: 180000, je: "△ 2 unposted", settled: 110000, claims: { ib: 5, ob: 0 }, deductions: 1, invoices: "9/1 ovd",
        obligations: [],
      },
      {
        name: "RLA — Retailer Listing Allowance",
        count: 7, accrued: 200000, je: "✓", settled: 150000, claims: { ib: 7, ob: 0 }, deductions: 1, invoices: "7/0 ovd",
        obligations: [],
      },
    ],
  },
  {
    key: "royalties",
    name: "Royalties",
    icon: "📜",
    count: 38,
    accrued: 1420000,
    settled: 880000,
    open: 540000,
    trend: 4.1,
    blockers: 1,
    subflows: [
      { name: "Tier-Based Royalty", count: 22, accrued: 920000, je: "✓", settled: 580000, claims: { ib: 3, ob: 0 }, deductions: 0, invoices: "22/2 ovd", obligations: [] },
      { name: "Flat-Fee License", count: 16, accrued: 500000, je: "✓", settled: 300000, claims: { ib: 1, ob: 0 }, deductions: 0, invoices: "16/1 ovd", obligations: [] },
    ],
  },
  {
    key: "commissions",
    name: "Commissions",
    icon: "🤝",
    count: 31,
    accrued: 480000,
    settled: 310000,
    open: 170000,
    trend: -2.8,
    blockers: 0,
    subflows: [
      { name: "Channel Partner Comm.", count: 19, accrued: 320000, je: "✓", settled: 220000, claims: { ib: 0, ob: 0 }, deductions: 0, invoices: "—", obligations: [] },
      { name: "Sales Rep Comm.", count: 12, accrued: 160000, je: "✓", settled: 90000, claims: { ib: 0, ob: 0 }, deductions: 0, invoices: "—", obligations: [] },
    ],
  },
  {
    key: "subs",
    name: "Subscriptions",
    icon: "🔁",
    count: 16,
    accrued: 180000,
    settled: 140000,
    open: 40000,
    trend: 1.4,
    blockers: 0,
    subflows: [
      { name: "Annual SaaS", count: 11, accrued: 130000, je: "✓", settled: 110000, claims: { ib: 0, ob: 0 }, deductions: 0, invoices: "11/0 ovd", obligations: [] },
      { name: "Monthly Add-on", count: 5, accrued: 50000, je: "△ 3 draft", settled: 30000, claims: { ib: 0, ob: 0 }, deductions: 0, invoices: "5/0 ovd", obligations: [] },
    ],
  },
];

const BLOCKERS = [
  {
    id: "B-1",
    severity: "critical" as const,
    stage: "JE",
    title: "5 JEs unposted in CRP-STACK program",
    detail: "Costco Stack rebate accruals approved but draft JE never released. Holds settlement & invoice cycle.",
    owner: "J. Chen",
    age: "3h",
    ai: "Auto-post via 'Post Approved JEs'? Net Dr 2150 / Cr 4000 = $186,400.",
  },
  {
    id: "B-2",
    severity: "critical" as const,
    stage: "Variance",
    title: "Rebates flow +8.2% vs Mar — exceeds 5% controller threshold",
    detail: "Walmart MSA Q2 alone moved $94k. Q1 baseline didn't anticipate the volume tier kicker.",
    owner: "M. Patel",
    age: "1d",
    ai: "Open variance explainer · review tier-rate change in calculation engine.",
  },
  {
    id: "B-3",
    severity: "medium" as const,
    stage: "Claims",
    title: "7 inbound claims still 'needs review' past Day 3",
    detail: "All under $25k, mostly Walmart store-level deductions. Bulk-approve recommended.",
    owner: "J. Chen",
    age: "2d",
    ai: "Bulk-approve via Claims Workspace · all are within 0.5% of accrued amount.",
  },
  {
    id: "B-4",
    severity: "medium" as const,
    stage: "Settlement",
    title: "1 settlement awaiting CM auto-close confirmation",
    detail: "Soundcore VRP CM-2026-039 posted to GL Apr 27 but settlement still 'approved'. Likely cron lag.",
    owner: "system",
    age: "12h",
    ai: "Verify settlement watcher on flow_types.cash_direction='outbound'.",
  },
];

const VARIANCE_BY_STAGE = [
  { stage: "Accrual", curr: 3920000, prev: 3712000, prior: 3528000 },
  { stage: "JE", curr: 3740000, prev: 3640000, prior: 3450000 },
  { stage: "Settlement", curr: 2410000, prev: 2880000, prior: 2710000 },
  { stage: "Claims open", curr: 770000, prev: 540000, prior: 480000 },
  { stage: "Deductions", curr: 186000, prev: 142000, prior: 110000 },
];

const PRIOR_PERIODS = [
  { label: "Mar 2026", obligations: 141, accrued: 3712000, settled: 2880000, blockers: 0, closedDay: 4, status: "closed" },
  { label: "Feb 2026", obligations: 138, accrued: 3528000, settled: 2710000, blockers: 0, closedDay: 5, status: "closed" },
  { label: "Jan 2026", obligations: 132, accrued: 3344000, settled: 2540000, blockers: 0, closedDay: 6, status: "closed" },
];

const CHANGES = [
  { time: "08:42", actor: "J. Chen", action: "Approved 14 accruals (CRP-VOL batch)", icon: CheckCircle2, tone: "green" as const },
  { time: "09:01", actor: "system", action: "Promoted 14 accruals → obligations · minted 9 outbound claims", icon: Sparkles, tone: "orange" as const },
  { time: "09:14", actor: "J. Chen", action: "Marked Prepare stage complete", icon: ShieldCheck, tone: "blue" as const },
  { time: "10:22", actor: "system", action: "Auto-closed 6 VRP settlements (CM posted to GL)", icon: Lock, tone: "purple" as const },
  { time: "11:08", actor: "M. Patel", action: "Flagged Rebates +8.2% variance for review", icon: AlertTriangle, tone: "yellow" as const },
  { time: "11:34", actor: "M. Patel", action: "Bulk-resolved 4 medium blockers (sub-$25k claims)", icon: CheckCircle2, tone: "green" as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
};

const stageStatusIcon = (status: string) => {
  switch (status) {
    case "posted":
    case "settled":
    case "issued":
    case "IB paid":
    case "IB approved":
    case "OB confirmed":
      return <CircleCheck className="w-3.5 h-3.5 text-green-600" />;
    case "draft":
    case "pending":
    case "OB submitted":
    case "IB needs review":
      return <CircleDashed className="w-3.5 h-3.5 text-yellow-600" />;
    case "—":
      return <CircleDot className="w-3.5 h-3.5 text-gray-300" />;
    default:
      return <CircleAlert className="w-3.5 h-3.5 text-orange-600" />;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Cockpit() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [openFlow, setOpenFlow] = useState<string | null>("rebates");
  const [openSubflow, setOpenSubflow] = useState<string | null>("CRP — Customer Rebate Program");

  const totalBlockers = BLOCKERS.length;
  const criticalBlockers = BLOCKERS.filter((b) => b.severity === "critical").length;
  const readiness = Math.round(
    (STAGES.reduce((s, st) => s + st.pct, 0) / STAGES.length) * 0.85
  );

  return (
    <div className="min-h-screen bg-[hsl(43,26%,95%)] text-[hsl(240,20%,5%)] p-6 font-sans">
      <div className="max-w-[1380px] mx-auto space-y-4">
        {/* ─────────── Header ─────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-orange-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                  Contract Subledger · Period Close
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {PERIOD.label} Subledger Close
              </h1>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {PERIOD.entity}</span>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cutoff {PERIOD.cutoff}</span>
              </div>
            </div>

            {/* SLA pill */}
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-green-700">On Track</div>
                <div className="text-xs text-gray-700">
                  Day <span className="font-bold">{PERIOD.closeDay}</span> of {PERIOD.closeTarget} · 2 days remaining
                </div>
              </div>
            </div>

            {/* Sign-off chain */}
            <div className="flex items-center gap-1.5 text-xs">
              {([SIGNOFF.prepare, SIGNOFF.review, SIGNOFF.lock] as Array<typeof SIGNOFF.prepare & { current?: boolean }>).map((s, i) => {
                const labels = ["Prepare", "Review", "Lock"];
                const icons = [Eye, ShieldCheck, Lock];
                const Icon = icons[i];
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                        s.done
                          ? "bg-green-50 border-green-200 text-green-800"
                          : (s as { current?: boolean }).current
                          ? "bg-orange-50 border-orange-300 text-orange-800 ring-2 ring-orange-200"
                          : "bg-gray-50 border-gray-200 text-gray-400"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <div className="leading-tight">
                        <div className="text-[10px] font-bold">{labels[i]}</div>
                        <div className="text-[9px]">{s.who} · {s.role}</div>
                      </div>
                      {s.done && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" /> AI Close Check
              </button>
              <button className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50">
                <Download className="w-3.5 h-3.5" /> Export Subledger
              </button>
              <button
                disabled
                className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" /> Lock Period
              </button>
            </div>
          </div>
        </div>

        {/* ─────────── 360° KPI strip ─────────── */}
        <div className="grid grid-cols-6 gap-3">
          {KPIS.map((k, i) => {
            const Icon = k.icon;
            const tone =
              k.deltaTone === "up" ? "text-green-600" :
              k.deltaTone === "down" ? "text-red-600" :
              k.deltaTone === "warn" ? "text-orange-600" :
              "text-gray-500";
            return (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className={`text-[10px] font-semibold ${tone}`}>{k.delta}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide leading-tight mb-0.5">
                  {k.label}
                </div>
                <div className="text-xl font-bold text-gray-900 leading-tight">{k.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* ─────────── Insights Strip: contracts by flow · YoY P/P · Ask AI ─────────── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Tile 1: Active Contracts by Flow */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-500" /> Active Contracts · by flow
              </div>
              <div className="text-[11px] text-gray-500">
                <span className="font-bold text-gray-900">147</span> · <span className="font-semibold text-gray-900">$3.92M</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { flow: "Rebates",       n: 89, amt: "$2.18M", pct: 60.5, dPct: "+5",  color: "bg-orange-500" },
                { flow: "Royalties",     n: 31, amt: "$1.21M", pct: 30.9, dPct: "+1",  color: "bg-purple-500" },
                { flow: "Commissions",   n: 18, amt: "$310k",  pct: 7.9,  dPct: "0",   color: "bg-blue-500" },
                { flow: "Subscriptions", n:  9, amt: "$220k",  pct: 5.6,  dPct: "0",   color: "bg-teal-500" },
              ].map((r) => (
                <div key={r.flow} className="text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-700 w-20 font-medium">{r.flow}</span>
                    <span className="text-gray-500 text-[10px] w-16">{r.n} contracts</span>
                    <span className="text-[10px] text-green-700 font-semibold w-8">{r.dPct !== "0" ? r.dPct : ""}</span>
                    <span className="ml-auto font-semibold text-gray-900">{r.amt}</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{r.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
              <span>vs Mar: <span className="text-green-700 font-semibold">+6 contracts (+4.3%)</span></span>
              <button className="text-orange-600 hover:underline">drill →</button>
            </div>
          </div>

          {/* Tile 2: Period over Period (YoY) */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gray-500" /> Accrual · Period vs Period
              </div>
              <div className="flex items-center gap-0.5">
                <button className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">YoY</button>
                <button className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">MoM</button>
                <button className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">YTD</button>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-gray-900">$3.92M</div>
              <div className="text-[11px] text-gray-500">Apr 2026</div>
            </div>
            <div className="flex items-center gap-1 text-xs mt-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
              <span className="text-green-700 font-bold">+14.6%</span>
              <span className="text-gray-500">vs Apr 2025 ($3.42M)</span>
            </div>
            {/* mini sparkline — last 12 months */}
            <div className="mt-3 flex items-end gap-0.5" style={{ height: 48 }}>
              {[
                { m: "May", v: 2.80 }, { m: "Jun", v: 2.92 }, { m: "Jul", v: 3.10 },
                { m: "Aug", v: 2.95 }, { m: "Sep", v: 3.20 }, { m: "Oct", v: 3.42 },
                { m: "Nov", v: 3.31 }, { m: "Dec", v: 3.55 }, { m: "Jan", v: 3.62 },
                { m: "Feb", v: 3.71 }, { m: "Mar", v: 3.80 }, { m: "Apr", v: 3.92 },
              ].map((b, i) => (
                <div
                  key={i}
                  title={`${b.m}: $${b.v}M`}
                  className={`flex-1 rounded-t cursor-default ${i === 11 ? "bg-orange-500" : "bg-orange-200 hover:bg-orange-300"}`}
                  style={{ height: `${(b.v / 4.2) * 100}%` }}
                />
              ))}
            </div>
            <div className="text-[10px] text-gray-400 flex justify-between mt-0.5"><span>May'25</span><span>Apr'26</span></div>
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-gray-500 uppercase text-[9px] tracking-wide">YTD 2026</div>
                <div className="font-bold text-gray-900">$14.8M</div>
              </div>
              <div>
                <div className="text-gray-500 uppercase text-[9px] tracking-wide">YTD 2025</div>
                <div className="text-gray-700"><span className="font-bold">$13.1M</span> <span className="text-green-600 font-semibold">+13.0%</span></div>
              </div>
            </div>
          </div>

          {/* Tile 3: Ask AI for a custom KPI */}
          <div className="col-span-4 bg-gradient-to-br from-orange-50 to-orange-100/40 border border-orange-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" /> Ask LedgerIQ for a custom KPI
              </div>
              <span className="text-[10px] bg-orange-200 text-orange-800 rounded-full px-1.5 py-0.5 font-bold">AI</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-md px-2 py-1.5 mb-2">
              <Bot className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <input placeholder='e.g. "concentration risk by partner"' className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-gray-400" />
              <button className="text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded px-2 py-1 inline-flex items-center gap-0.5">
                <Send className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {["Days-to-settle by flow", "Top partners by $", "Variance vs forecast"].map((s) => (
                <button key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-orange-200 text-orange-700 hover:bg-orange-50">
                  {s}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1">
              <Pin className="w-3 h-3" /> Pinned (AI-generated)
            </div>
            <div className="space-y-1.5">
              <div className="rounded-md bg-white border border-gray-200 p-2 hover:border-orange-300 cursor-pointer">
                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900">
                  <AlertTriangle className="w-3 h-3 text-orange-500" /> Rebate concentration risk
                  <span className="ml-auto text-[9px] text-gray-400">2h ago</span>
                </div>
                <div className="text-[10px] text-gray-700 mt-0.5">
                  Walmart = <span className="font-bold text-orange-700">38%</span> of accrual · <span className="text-orange-700">exceeds 30% threshold</span>
                </div>
              </div>
              <div className="rounded-md bg-white border border-gray-200 p-2 hover:border-orange-300 cursor-pointer">
                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900">
                  <Clock className="w-3 h-3 text-blue-500" /> Avg days-to-settle · by flow
                  <span className="ml-auto text-[9px] text-gray-400">yesterday</span>
                </div>
                <div className="text-[10px] text-gray-700 mt-0.5">
                  Rebates <span className="font-bold">14d</span> · Royalties <span className="font-bold">21d</span> · Subs <span className="font-bold">3d</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────── Pipeline Stage Strip (the drill-down funnel) ─────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-600" /> Subledger Pipeline · {PERIOD.label}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Lifecycle of every obligation — from contract through invoice. Click a stage to scope the table below.
              </p>
            </div>
            <div className="text-[11px] text-gray-500">
              Readiness <span className="font-bold text-orange-600">{readiness}%</span>
            </div>
          </div>

          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const active = activeStage === stage.key;
              const tone =
                stage.pct >= 95 ? "border-green-200 bg-green-50" :
                stage.pct >= 80 ? "border-yellow-200 bg-yellow-50" :
                "border-orange-200 bg-orange-50";
              return (
                <div key={stage.key} className="flex items-stretch gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setActiveStage(active ? null : stage.key)}
                    className={`flex flex-col items-start text-left rounded-lg border-2 px-3 py-2.5 min-w-[125px] hover:shadow-sm transition-all ${
                      active ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100" : tone
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-gray-700" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-700">
                        {idx + 1}. {stage.label}
                      </span>
                    </div>
                    <div className="text-base font-bold text-gray-900">{stage.count}</div>
                    <div className="text-[10px] text-gray-600">{stage.value}</div>
                    {/* progress bar */}
                    <div className="mt-1.5 w-full h-1 bg-white rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          stage.pct >= 95 ? "bg-green-500" : stage.pct >= 80 ? "bg-yellow-500" : "bg-orange-500"
                        }`}
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{stage.pct.toFixed(0)}% complete</div>
                    {stage.split && (
                      <div className="mt-1 flex items-center gap-1 text-[9px]">
                        <span className="text-green-700 font-semibold">{stage.split.done} done</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-orange-700 font-semibold">{stage.split.pending} pending</span>
                      </div>
                    )}
                  </button>
                  {idx < STAGES.length - 1 && (
                    <div className="flex items-center">
                      <ChevronRight className="w-3 h-3 text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─────────── Two-column body ─────────── */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT: Drill-down by Flow → Sub-flow → Obligation */}
          <div className="col-span-8 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-orange-600" /> Drill-down · Flow → Sub-flow → Obligation
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Every obligation, end-to-end. Expand a flow to see programs and per-obligation pipeline status.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <CircleCheck className="w-3 h-3 text-green-600" /> done
                  </span>
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <CircleDashed className="w-3 h-3 text-yellow-600" /> pending
                  </span>
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <CircleAlert className="w-3 h-3 text-orange-600" /> attention
                  </span>
                </div>
              </div>

              {/* Flow rows */}
              <div className="divide-y divide-gray-100">
                {FLOWS.map((flow) => {
                  const isOpen = openFlow === flow.key;
                  return (
                    <div key={flow.key}>
                      <button
                        onClick={() => setOpenFlow(isOpen ? null : flow.key)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-50/30 transition-colors"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="text-xl">{flow.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {flow.name}
                            {flow.blockers > 0 && (
                              <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-semibold">
                                {flow.blockers} blocker{flow.blockers > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {flow.count} obligations · {flow.subflows.length} programs
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-right text-xs">
                          <div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-400">Accrued</div>
                            <div className="font-bold text-gray-900">{fmtMoney(flow.accrued)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-400">Settled</div>
                            <div className="font-bold text-green-700">{fmtMoney(flow.settled)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-400">Open</div>
                            <div className="font-bold text-orange-700">{fmtMoney(flow.open)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-400">vs Prior</div>
                            <div className={`font-bold flex items-center justify-end gap-0.5 ${flow.trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {flow.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {flow.trend > 0 ? "+" : ""}{flow.trend.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="bg-gray-50/60 border-t border-gray-100 px-4 py-3">
                          {/* Sub-flow rows */}
                          <div className="space-y-2">
                            {flow.subflows.map((sub) => {
                              const subOpen = openSubflow === sub.name;
                              return (
                                <div key={sub.name} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setOpenSubflow(subOpen ? null : sub.name)}
                                    className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                                  >
                                    {subOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                    <div className="flex-1 text-left">
                                      <div className="text-xs font-semibold text-gray-900">{sub.name}</div>
                                      <div className="text-[10px] text-gray-500">{sub.count} obligations · {fmtMoney(sub.accrued)} accrued</div>
                                    </div>
                                    {/* per-stage compact pipeline */}
                                    <div className="hidden lg:flex items-center gap-2 text-[10px]">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                        <Calculator className="w-2.5 h-2.5" /> Acc {fmtMoney(sub.accrued)}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${sub.je === "✓" ? "bg-green-50 text-green-700 border-green-100" : "bg-yellow-50 text-yellow-700 border-yellow-100"}`}>
                                        <BookOpen className="w-2.5 h-2.5" /> JE {sub.je}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        <Wallet className="w-2.5 h-2.5" /> Stl {fmtMoney(sub.settled)}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">
                                        <Inbox className="w-2.5 h-2.5" /> IB {sub.claims.ib} · OB {sub.claims.ob}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
                                        <ArrowLeftRight className="w-2.5 h-2.5" /> Ded {sub.deductions}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-100">
                                        <Receipt className="w-2.5 h-2.5" /> Inv {sub.invoices}
                                      </span>
                                    </div>
                                  </button>

                                  {subOpen && sub.obligations.length > 0 && (
                                    <div className="border-t border-gray-100 overflow-x-auto">
                                      <table className="w-full text-[11px]">
                                        <thead className="bg-gray-50">
                                          <tr className="text-left text-gray-500">
                                            <th className="px-3 py-1.5 font-semibold">Obligation</th>
                                            <th className="px-3 py-1.5 font-semibold">Contract / Program</th>
                                            <th className="px-3 py-1.5 font-semibold text-right">Accrual</th>
                                            <th className="px-3 py-1.5 font-semibold text-center">JE</th>
                                            <th className="px-3 py-1.5 font-semibold text-center">Settle</th>
                                            <th className="px-3 py-1.5 font-semibold text-center">Claim</th>
                                            <th className="px-3 py-1.5 font-semibold text-center">Dedn</th>
                                            <th className="px-3 py-1.5 font-semibold text-center">Invoice</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sub.obligations.map((o) => (
                                            <tr key={o.id} className="border-t border-gray-100 hover:bg-orange-50/30">
                                              <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600">{o.id}</td>
                                              <td className="px-3 py-1.5">
                                                <div className="font-medium text-gray-900">{o.contract}</div>
                                                <div className="text-[9px] text-gray-400">{o.flow}</div>
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-semibold text-gray-900">${o.accrual.toLocaleString()}</td>
                                              <td className="px-3 py-1.5 text-center"><div className="inline-flex items-center gap-1">{stageStatusIcon(o.je)}<span className="text-[10px] text-gray-600">{o.je}</span></div></td>
                                              <td className="px-3 py-1.5 text-center"><div className="inline-flex items-center gap-1">{stageStatusIcon(o.settle)}<span className="text-[10px] text-gray-600">{o.settle}</span></div></td>
                                              <td className="px-3 py-1.5 text-center"><div className="inline-flex items-center gap-1">{stageStatusIcon(o.claim)}<span className="text-[10px] text-gray-600">{o.claim}</span></div></td>
                                              <td className="px-3 py-1.5 text-center text-[10px] text-gray-600">{o.dedn}</td>
                                              <td className="px-3 py-1.5 text-center"><div className="inline-flex items-center gap-1">{stageStatusIcon(o.inv)}<span className="text-[10px] text-gray-600">{o.inv}</span></div></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Variance vs Prior — by stage */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-orange-600" /> Variance vs Prior — by Pipeline Stage
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Where in the lifecycle the {PERIOD.label} numbers diverge. Controller signs off variances &gt; 5%.
                  </p>
                </div>
                <button className="text-[11px] text-orange-600 hover:underline inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Explain with AI
                </button>
              </div>
              <div className="space-y-2">
                {VARIANCE_BY_STAGE.map((v, i) => {
                  const delta = v.curr - v.prev;
                  const pct = v.prev > 0 ? (delta / v.prev) * 100 : 0;
                  const isUp = delta >= 0;
                  const max = Math.max(...VARIANCE_BY_STAGE.map((x) => Math.abs(x.curr - x.prev)), 1);
                  const w = Math.round((Math.abs(delta) / max) * 100);
                  const flagged = Math.abs(pct) > 5;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <div className="w-28 font-medium text-gray-900">{v.stage}</div>
                      <div className="w-20 text-right text-gray-500">{fmtMoney(v.prev)}</div>
                      <div className="w-20 text-right font-semibold text-gray-900">{fmtMoney(v.curr)}</div>
                      <div className="flex-1">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${isUp ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${w}%` }} />
                        </div>
                      </div>
                      <div className={`w-16 text-right font-bold ${isUp ? "text-green-600" : "text-red-600"}`}>
                        {isUp ? "+" : ""}{pct.toFixed(1)}%
                      </div>
                      {flagged && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 whitespace-nowrap">
                          ⚠ &gt; 5%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Blockers + P/P comparison + What changed */}
          <div className="col-span-4 space-y-4">
            {/* Blockers */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Close Blockers
                  </div>
                  <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                    {criticalBlockers} critical · {totalBlockers - criticalBlockers} medium
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {BLOCKERS.map((b) => (
                  <div key={b.id} className="p-3 hover:bg-orange-50/30">
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-1.5 self-stretch rounded-full ${
                          b.severity === "critical" ? "bg-red-500" : "bg-yellow-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
                            {b.stage}
                          </span>
                          <span className="text-[9px] text-gray-400">·</span>
                          <span className="text-[9px] text-gray-500">{b.owner} · {b.age}</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-900 leading-tight">{b.title}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{b.detail}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button className="text-[10px] inline-flex items-center gap-1 text-orange-600 hover:underline">
                            <Sparkles className="w-3 h-3" /> {b.ai}
                          </button>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button className="text-[10px] px-2 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Resolve
                          </button>
                          <button className="text-[10px] px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1">
                            <Send className="w-2.5 h-2.5" /> Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Period over period */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ChevronsUpDown className="w-4 h-4 text-orange-600" /> Period over Period
                </div>
                <span className="text-[10px] text-gray-400">last 3 closed</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">Period</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Obl.</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Accrued</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Settled</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-orange-50/40 border-t border-gray-100">
                      <td className="px-2 py-1.5 font-bold text-orange-700">{PERIOD.label} (open)</td>
                      <td className="px-2 py-1.5 text-right font-bold">147</td>
                      <td className="px-2 py-1.5 text-right font-bold">{fmtMoney(3920000)}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{fmtMoney(2410000)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">Day {PERIOD.closeDay}</td>
                    </tr>
                    {PRIOR_PERIODS.map((p) => (
                      <tr key={p.label} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-medium text-gray-700">{p.label}</td>
                        <td className="px-2 py-1.5 text-right">{p.obligations}</td>
                        <td className="px-2 py-1.5 text-right">{fmtMoney(p.accrued)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtMoney(p.settled)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-500">Day {p.closedDay} ✓</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* What changed */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-orange-600" /> What's Changed Today
                </div>
                <button className="text-[10px] text-gray-500 hover:text-orange-600">View all</button>
              </div>
              <div className="space-y-2.5">
                {CHANGES.map((c, i) => {
                  const Icon = c.icon;
                  const toneMap: Record<string, string> = {
                    green: "text-green-600 bg-green-50",
                    blue: "text-blue-600 bg-blue-50",
                    purple: "text-purple-600 bg-purple-50",
                    yellow: "text-yellow-600 bg-yellow-50",
                    orange: "text-orange-600 bg-orange-50",
                  };
                  return (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${toneMap[c.tone]}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 leading-tight">{c.action}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{c.time} · {c.actor}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-[10px] text-gray-400 text-center pt-2">
          Contract Subledger · ledger-of-record for {KPIS[0].value} obligations · syncs to GL via JE Hub · last refresh 11:34 PT
        </div>
      </div>
    </div>
  );
}
