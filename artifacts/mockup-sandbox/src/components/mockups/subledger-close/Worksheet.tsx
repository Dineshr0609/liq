import { useState } from "react";
import {
  Search, Filter, Download, Lock, Sparkles, MoreHorizontal, ChevronDown,
  CheckCircle2, AlertTriangle, Clock, Calculator, BookOpen, Handshake, Wallet,
  Inbox, ArrowLeftRight, Receipt, ShieldCheck, Eye, Building2, FileText,
  Settings2, ArrowUpDown, Check, X, Send, RefreshCw, ChevronRight,
  TrendingUp, ArrowUpRight, Pin, Bot,
} from "lucide-react";

// ─── Mock obligation rows ────────────────────────────────────────────────────

type RowStatus = "ok" | "pending" | "blocked" | "na";
const ICON: Record<RowStatus, React.ReactNode> = {
  ok:      <CheckCircle2 className="w-3 h-3 text-green-600 inline" />,
  pending: <Clock className="w-3 h-3 text-yellow-600 inline" />,
  blocked: <AlertTriangle className="w-3 h-3 text-red-600 inline" />,
  na:      <span className="inline-block w-3 h-3 text-gray-300 text-[10px]">—</span>,
};

const ROWS: Array<{
  id: string; contract: string; flow: string; subflow: string; partner: string;
  accrual: { s: RowStatus; v: number };
  je:      { s: RowStatus; v: string };
  settle:  { s: RowStatus; v: number };
  claim:   { s: RowStatus; v: string };
  dedn:    { s: RowStatus; v: string };
  invoice: { s: RowStatus; v: string };
  variance: number;
}> = [
  { id: "OBL-2026-0413", contract: "Walmart MSA Q2 Vol", flow: "Rebates", subflow: "CRP-VOL", partner: "Walmart", accrual: { s: "ok", v: 142000 }, je: { s: "ok", v: "JE-04221" }, settle: { s: "pending", v: 142000 }, claim: { s: "ok", v: "IB approved" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 8.2 },
  { id: "OBL-2026-0418", contract: "Target Annual Vol",  flow: "Rebates", subflow: "CRP-TIER", partner: "Target",  accrual: { s: "ok", v: 88500  }, je: { s: "ok", v: "JE-04222" }, settle: { s: "ok", v: 88500     }, claim: { s: "ok", v: "IB paid" },     dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" },     variance: 1.4 },
  { id: "OBL-2026-0421", contract: "Costco Stack",        flow: "Rebates", subflow: "CRP-STACK",partner: "Costco",  accrual: { s: "ok", v: 67200  }, je: { s: "blocked", v: "draft" },   settle: { s: "pending", v: 67200  }, claim: { s: "pending", v: "needs review" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 3.1 },
  { id: "OBL-2026-0438", contract: "Soundcore Q1 Vol",    flow: "Rebates", subflow: "VRP-VOL",  partner: "Soundcore", accrual: { s: "ok", v: 64000  }, je: { s: "ok", v: "JE-04230" }, settle: { s: "pending", v: 64000  }, claim: { s: "ok", v: "OB submitted" }, dedn: { s: "ok", v: "$32k" }, invoice: { s: "na", v: "—" }, variance: -2.0 },
  { id: "OBL-2026-0441", contract: "Anker Distrib.",       flow: "Rebates", subflow: "VRP-MIX",  partner: "Anker",   accrual: { s: "ok", v: 41200  }, je: { s: "ok", v: "JE-04231" }, settle: { s: "ok", v: 41200     }, claim: { s: "ok", v: "OB confirmed" }, dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" }, variance: 0.8 },
  { id: "OBL-2026-0455", contract: "Walmart MSA Q2 Tier",  flow: "Rebates", subflow: "CRP-TIER", partner: "Walmart", accrual: { s: "pending", v: 94000 }, je: { s: "na", v: "—" }, settle: { s: "na", v: 0 }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" }, variance: 0 },
  { id: "OBL-2026-0461", contract: "Target Annual Vol Q2", flow: "Rebates", subflow: "CRP-VOL",  partner: "Target",  accrual: { s: "pending", v: 78500 }, je: { s: "na", v: "—" }, settle: { s: "na", v: 0 }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" }, variance: 0 },
  { id: "OBL-2026-0472", contract: "Acme Pharma Tier R.",  flow: "Royalties", subflow: "Tier-Based", partner: "Acme Pharma", accrual: { s: "ok", v: 184000 }, je: { s: "ok", v: "JE-04241" }, settle: { s: "ok", v: 184000 }, claim: { s: "ok", v: "IB paid" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 4.1 },
  { id: "OBL-2026-0477", contract: "Pfizer License Y2",    flow: "Royalties", subflow: "Flat-Fee",   partner: "Pfizer",      accrual: { s: "ok", v: 125000 }, je: { s: "ok", v: "JE-04242" }, settle: { s: "ok", v: 125000 }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 0 },
  { id: "OBL-2026-0481", contract: "Novartis Compound C",  flow: "Royalties", subflow: "Tier-Based", partner: "Novartis",    accrual: { s: "ok", v: 92500  }, je: { s: "ok", v: "JE-04243" }, settle: { s: "pending", v: 92500 }, claim: { s: "ok", v: "IB approved" }, dedn: { s: "na", v: "—" }, invoice: { s: "pending", v: "1 ovd" }, variance: 5.4 },
  { id: "OBL-2026-0492", contract: "Channel Partner — NA", flow: "Commissions", subflow: "Channel", partner: "Insight",     accrual: { s: "ok", v: 32100  }, je: { s: "ok", v: "JE-04250" }, settle: { s: "ok", v: 32100  }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" }, variance: -2.8 },
  { id: "OBL-2026-0501", contract: "Sales Rep — Q2 SPIFF", flow: "Commissions", subflow: "Sales Rep", partner: "Internal",    accrual: { s: "ok", v: 14200  }, je: { s: "ok", v: "JE-04251" }, settle: { s: "ok", v: 14200  }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "na", v: "—" }, variance: 0 },
  { id: "OBL-2026-0512", contract: "Salesforce SaaS",      flow: "Subscriptions", subflow: "Annual SaaS", partner: "Salesforce", accrual: { s: "ok", v: 28000 }, je: { s: "ok", v: "JE-04260" }, settle: { s: "ok", v: 28000 }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 0 },
  { id: "OBL-2026-0518", contract: "Datadog Add-on",       flow: "Subscriptions", subflow: "Monthly Add-on", partner: "Datadog", accrual: { s: "ok", v: 4200 }, je: { s: "blocked", v: "draft" }, settle: { s: "pending", v: 4200 }, claim: { s: "na", v: "—" }, dedn: { s: "na", v: "—" }, invoice: { s: "ok", v: "issued" }, variance: 0 },
];

const FLOWS = ["All flows", "Rebates", "Royalties", "Commissions", "Subscriptions"];
const STATUS_FILTERS = [
  { label: "All",      n: 147 },
  { label: "Pending",  n: 5,  tone: "yellow" as const },
  { label: "Blocked",  n: 7,  tone: "red"    as const },
  { label: "Variance > 5%", n: 6, tone: "orange" as const },
  { label: "Settled",  n: 89, tone: "green"  as const },
];

const fmt = (n: number) => n === 0 ? "—" : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

// ─── Component ───────────────────────────────────────────────────────────────

export function Worksheet() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["OBL-2026-0421", "OBL-2026-0518"]));
  const [activeFlow, setActiveFlow] = useState("All flows");
  const [activeStatus, setActiveStatus] = useState("All");

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    setSelected(selected.size === ROWS.length ? new Set() : new Set(ROWS.map((r) => r.id)));
  };

  const totalAccrual = ROWS.reduce((s, r) => s + (r.accrual.v as number), 0);
  const totalSettled = ROWS.reduce((s, r) => s + (r.settle.v as number), 0);
  const selectedRows = ROWS.filter((r) => selected.has(r.id));
  const selectedAccrual = selectedRows.reduce((s, r) => s + r.accrual.v, 0);

  return (
    <div className="min-h-screen bg-[hsl(43,26%,95%)] text-[hsl(240,20%,5%)] p-4 font-sans">
      <div className="max-w-[1480px] mx-auto space-y-3">
        {/* Compact header */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Contract Subledger Worksheet
            </div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Apr 2026 · 147 obligations</h1>
          </div>
          <div className="ml-2 flex items-center gap-1.5 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-800">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> On track · Day 3/5
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search obligations, contracts, partners…" className="text-[11px] h-8 pl-7 pr-2 w-72 rounded-md border border-gray-200 bg-white" />
            </div>
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> Columns
            </button>
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-600" /> AI Check
            </button>
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Export CSV
            </button>
            <button className="text-[11px] h-8 px-3 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed inline-flex items-center gap-1.5 font-semibold">
              <Lock className="w-3 h-3" /> Lock Period
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2">Flow</span>
          {FLOWS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFlow(f)}
              className={`text-[11px] h-7 px-3 rounded-full border transition-colors ${
                activeFlow === f ? "bg-orange-100 border-orange-300 text-orange-800 font-semibold" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2">Status</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => setActiveStatus(s.label)}
              className={`text-[11px] h-7 px-3 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                activeStatus === s.label ? "bg-orange-100 border-orange-300 text-orange-800 font-semibold" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                s.tone === "yellow" ? "bg-yellow-100 text-yellow-700" :
                s.tone === "red" ? "bg-red-100 text-red-700" :
                s.tone === "orange" ? "bg-orange-100 text-orange-700" :
                s.tone === "green" ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-600"
              }`}>{s.n}</span>
            </button>
          ))}
          <button className="ml-auto text-[11px] text-gray-500 hover:text-orange-600 inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>

        {/* NEW — Insights strip: contracts by flow · period-over-period · ask AI */}
        <div className="grid grid-cols-12 gap-3">
          {/* Tile 1: Active Contracts by Flow */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Active Contracts · by flow
              </div>
              <div className="text-[10px] text-gray-500">147 · <span className="font-semibold text-gray-900">$3.92M</span></div>
            </div>
            <div className="space-y-1.5">
              {[
                { flow: "Rebates",       n: 89, amt: "$2.18M", pct: 60.5, dPct: "+5",  color: "bg-orange-500" },
                { flow: "Royalties",     n: 31, amt: "$1.21M", pct: 30.9, dPct: "+1",  color: "bg-purple-500" },
                { flow: "Commissions",   n: 18, amt: "$310k",  pct: 7.9,  dPct: "0",   color: "bg-blue-500" },
                { flow: "Subscriptions", n:  9, amt: "$220k",  pct: 5.6,  dPct: "0",   color: "bg-teal-500" },
              ].map((r) => (
                <div key={r.flow} className="text-[11px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-700 w-20 font-medium">{r.flow}</span>
                    <span className="text-gray-500 text-[10px] w-16">{r.n} contracts</span>
                    <span className="text-[9px] text-gray-400 w-6">{r.dPct !== "0" ? `${r.dPct}` : ""}</span>
                    <span className="ml-auto font-semibold text-gray-900">{r.amt}</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{r.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between">
              <span>vs Mar: <span className="text-green-700 font-semibold">+6 contracts (+4.3%)</span></span>
              <button className="text-orange-600 hover:underline">drill →</button>
            </div>
          </div>

          {/* Tile 2: Period over Period */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Accrual · Period vs Period
              </div>
              <div className="flex items-center gap-0.5">
                <button className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">YoY</button>
                <button className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">MoM</button>
                <button className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">YTD</button>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-gray-900">$3.92M</div>
              <div className="text-[10px] text-gray-500">Apr 2026</div>
            </div>
            <div className="flex items-center gap-1 text-xs mt-0.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
              <span className="text-green-700 font-bold">+14.6%</span>
              <span className="text-gray-500">vs Apr 2025 ($3.42M)</span>
            </div>
            {/* mini sparkline — last 12 months */}
            <div className="mt-3 flex items-end gap-0.5" style={{ height: 44 }}>
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
            <div className="text-[9px] text-gray-400 flex justify-between mt-0.5"><span>May'25</span><span>Apr'26</span></div>
            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-gray-500 uppercase text-[9px]">YTD 2026</div>
                <div className="font-bold text-gray-900">$14.8M</div>
              </div>
              <div>
                <div className="text-gray-500 uppercase text-[9px]">YTD 2025</div>
                <div className="text-gray-700"><span className="font-bold">$13.1M</span> <span className="text-green-600 font-semibold">+13.0%</span></div>
              </div>
            </div>
          </div>

          {/* Tile 3: Ask AI for a custom KPI */}
          <div className="col-span-4 bg-gradient-to-br from-orange-50 to-orange-100/40 border border-orange-200 rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ask LedgerIQ for a custom KPI
              </div>
              <span className="text-[9px] bg-orange-200 text-orange-800 rounded-full px-1.5 py-0.5 font-bold">AI</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-md px-2 py-1.5 mb-2">
              <Bot className="w-3 h-3 text-orange-500 flex-shrink-0" />
              <input placeholder='e.g. "concentration risk by partner"' className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-gray-400" />
              <button className="text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                <Send className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {["Days-to-settle by flow", "Top partners by $", "Variance vs forecast"].map((s) => (
                <button key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-orange-200 text-orange-700 hover:bg-orange-50">
                  {s}
                </button>
              ))}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" /> Pinned (AI-generated)
            </div>
            <div className="space-y-1.5">
              <div className="rounded-md bg-white border border-gray-200 p-2 hover:border-orange-300 cursor-pointer">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-900">
                  <AlertTriangle className="w-2.5 h-2.5 text-orange-500" /> Rebate concentration risk
                  <span className="ml-auto text-[8px] text-gray-400">2h ago</span>
                </div>
                <div className="text-[10px] text-gray-700 mt-0.5">
                  Walmart = <span className="font-bold text-orange-700">38%</span> of accrual · <span className="text-orange-700">exceeds 30% threshold</span>
                </div>
              </div>
              <div className="rounded-md bg-white border border-gray-200 p-2 hover:border-orange-300 cursor-pointer">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-900">
                  <Clock className="w-2.5 h-2.5 text-blue-500" /> Avg days-to-settle · by flow
                  <span className="ml-auto text-[8px] text-gray-400">yesterday</span>
                </div>
                <div className="text-[10px] text-gray-700 mt-0.5">
                  Rebates <span className="font-bold">14d</span> · Royalties <span className="font-bold">21d</span> · Subs <span className="font-bold">3d</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selection bar (visible when rows selected) */}
        {selected.size > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-2.5 shadow-sm flex items-center gap-3">
            <Check className="w-4 h-4 text-orange-600" />
            <div className="text-xs">
              <span className="font-bold text-orange-900">{selected.size} selected</span>
              <span className="text-orange-700 ml-2">· total accrual {fmt(selectedAccrual)}</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 inline-flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Post JEs
              </button>
              <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 inline-flex items-center gap-1">
                <Handshake className="w-3 h-3" /> Approve settlements
              </button>
              <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 inline-flex items-center gap-1">
                <Inbox className="w-3 h-3" /> Resolve claims
              </button>
              <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 inline-flex items-center gap-1">
                <Send className="w-3 h-3" /> Assign
              </button>
              <button onClick={() => setSelected(new Set())} className="text-[11px] h-7 px-2 rounded-md text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>
        )}

        {/* The worksheet */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="sticky left-0 bg-gray-50 px-2 py-2 w-8">
                    <input type="checkbox" checked={selected.size === ROWS.length} onChange={toggleAll} className="cursor-pointer" />
                  </th>
                  <th className="sticky left-8 bg-gray-50 px-2 py-2 text-left font-semibold w-44">
                    <div className="inline-flex items-center gap-1 cursor-pointer hover:text-orange-600">Obligation <ArrowUpDown className="w-2.5 h-2.5" /></div>
                  </th>
                  <th className="px-2 py-2 text-left font-semibold w-56">Contract / Partner</th>
                  <th className="px-2 py-2 text-left font-semibold w-32">Flow / Sub-flow</th>
                  <th className="px-2 py-2 text-right font-semibold w-24"><Calculator className="w-3 h-3 inline mr-1" />Accrual</th>
                  <th className="px-2 py-2 text-center font-semibold w-24"><BookOpen className="w-3 h-3 inline mr-1" />JE</th>
                  <th className="px-2 py-2 text-right font-semibold w-24"><Wallet className="w-3 h-3 inline mr-1" />Settle</th>
                  <th className="px-2 py-2 text-center font-semibold w-32"><Inbox className="w-3 h-3 inline mr-1" />Claim</th>
                  <th className="px-2 py-2 text-center font-semibold w-20"><ArrowLeftRight className="w-3 h-3 inline mr-1" />Dedn</th>
                  <th className="px-2 py-2 text-center font-semibold w-24"><Receipt className="w-3 h-3 inline mr-1" />Invoice</th>
                  <th className="px-2 py-2 text-right font-semibold w-20">vs Mar</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ROWS.map((r) => {
                  const isSel = selected.has(r.id);
                  const hasBlocker = r.je.s === "blocked" || r.claim.s === "blocked";
                  return (
                    <tr key={r.id} className={`hover:bg-orange-50/30 transition-colors ${isSel ? "bg-orange-50/60" : hasBlocker ? "bg-red-50/30" : ""}`}>
                      <td className="sticky left-0 bg-inherit px-2 py-1.5">
                        <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} className="cursor-pointer" />
                      </td>
                      <td className="sticky left-8 bg-inherit px-2 py-1.5 font-mono text-[10px] text-gray-600 whitespace-nowrap">
                        {r.id}
                        {hasBlocker && <span className="ml-1 text-red-600">●</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold text-gray-900 leading-tight">{r.contract}</div>
                        <div className="text-[10px] text-gray-500">{r.partner}</div>
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        <div className="text-gray-900">{r.flow}</div>
                        <div className="text-gray-500 font-mono">{r.subflow}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {ICON[r.accrual.s]}
                          <span className="font-semibold text-gray-900">{fmt(r.accrual.v)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {ICON[r.je.s]}
                          <span className={`text-[10px] ${r.je.s === "blocked" ? "text-red-700 font-semibold" : "text-gray-700"}`}>{r.je.v}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {ICON[r.settle.s]}
                          <span className={`${r.settle.s === "ok" ? "text-green-700 font-semibold" : "text-gray-700"}`}>{fmt(r.settle.v)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {ICON[r.claim.s]}
                          <span className="text-[10px] text-gray-700">{r.claim.v}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center text-[10px] text-gray-700">{r.dedn.v}</td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {ICON[r.invoice.s]}
                          <span className="text-[10px] text-gray-700">{r.invoice.v}</span>
                        </div>
                      </td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${
                        r.variance === 0 ? "text-gray-400" :
                        Math.abs(r.variance) > 5 ? "text-orange-600" :
                        r.variance > 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {r.variance === 0 ? "—" : `${r.variance > 0 ? "+" : ""}${r.variance.toFixed(1)}%`}
                      </td>
                      <td className="px-2 py-1.5">
                        <button className="text-gray-400 hover:text-gray-700"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-[11px]">
                  <td className="sticky left-0 bg-gray-50 px-2 py-2"></td>
                  <td className="sticky left-8 bg-gray-50 px-2 py-2 text-gray-600">14 of 147 shown</td>
                  <td className="px-2 py-2 text-gray-500 text-[10px]">+ 133 more (paginate)</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right text-gray-900">{fmt(totalAccrual)}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right text-green-700">{fmt(totalSettled)}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right text-gray-500">avg +2.4%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bottom split: blockers + readiness */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
            <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Blockers tied to visible rows
              <span className="text-[10px] font-normal text-gray-500 ml-auto">click a row above to scope</span>
            </div>
            <div className="space-y-1.5">
              {[
                { id: "OBL-2026-0421", title: "JE draft past Day 2 — controller approval needed", sev: "critical" },
                { id: "OBL-2026-0518", title: "Datadog Add-on JE in draft (low $)", sev: "medium" },
                { id: "OBL-2026-0455", title: "Walmart Q2 tier-rate awaiting controller sign-off", sev: "critical" },
              ].map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5">
                  <div className={`w-1 self-stretch rounded-full ${b.sev === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="font-mono text-[10px] text-gray-500">{b.id}</span>
                  <span className="text-gray-900">{b.title}</span>
                  <button className="ml-auto text-orange-600 hover:underline text-[10px]">Resolve →</button>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-5 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
            <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> Readiness for Lock
            </div>
            <div className="space-y-1.5 text-[11px]">
              {[
                { l: "Accruals 100% calc'd",     ok: false, sub: "142 of 147 — 5 pending" },
                { l: "All JEs posted",            ok: false, sub: "5 in draft" },
                { l: "Variances explained",       ok: false, sub: "1 explanation needed (Rebates)" },
                { l: "Critical blockers cleared", ok: false, sub: "2 critical open" },
                { l: "Reviewer signed off",       ok: false, sub: "M. Patel pending" },
                { l: "Audit trail captured",      ok: true,  sub: "auto" },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded">
                  {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Clock className="w-3.5 h-3.5 text-yellow-600" />}
                  <span className={c.ok ? "text-gray-700" : "text-gray-900 font-medium"}>{c.l}</span>
                  <span className="ml-auto text-[10px] text-gray-500">{c.sub}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">5 of 6 gates remaining</span>
                <button disabled className="text-[11px] h-7 px-3 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed inline-flex items-center gap-1.5 font-semibold">
                  <Lock className="w-3 h-3" /> Lock Period
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 text-center pt-1">
          Data-led · Excel-feeling worksheet · multi-select for batch actions · designed for accountants closing 100+ obligations
        </div>
      </div>
    </div>
  );
}
