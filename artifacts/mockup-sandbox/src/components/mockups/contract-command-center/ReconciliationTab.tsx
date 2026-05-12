import React, { useState } from "react";
import {
  FileText,
  ChevronRight,
  MoreHorizontal,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  FileWarning,
  Wallet,
  Scale,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  ChevronDown,
  Info
} from "lucide-react";

export function ReconciliationTab() {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar */}
      <div className="w-14 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-6">
        <div className="h-8 w-8 rounded bg-orange-600 flex items-center justify-center text-white font-bold text-xs">
          liQ
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-8 w-8 rounded-md flex items-center justify-center ${
                i === 2 ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb & Header Area */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-6 py-2.5 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span>Contracts</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-900 font-medium">Acme Distributors — Master License Agreement v3.2</span>
            </div>
          </div>

          <div className="px-6 py-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold tracking-wide uppercase">
                  VRP
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                </span>
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-medium">
                  Auto-renewal enabled
                </span>
              </div>
              <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                Acme Distributors — Master License Agreement v3.2
              </h1>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Acme Distributors LLC (Tier 1)
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Jan 1, 2025 — Dec 31, 2027
                </span>
                <span className="inline-flex items-center gap-1">
                  Delaware Law
                </span>
                <span className="inline-flex items-center gap-1 border-l border-zinc-200 pl-4">
                  <div className="h-4 w-4 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[9px] font-bold">
                    SC
                  </div>
                  Sarah Chen (Owner)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-6">
              <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 font-medium">
                Save
              </button>
              <button className="p-1.5 text-zinc-500 hover:text-zinc-700 rounded-md border border-zinc-300 hover:bg-zinc-50">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 flex items-center gap-6">
            {["Overview", "Parties", "Terms", "Rules", "Policies", "Performance", "Reconciliation", "Risks", "History"].map((tab) => (
              <button
                key={tab}
                className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === "Reconciliation"
                    ? "border-orange-600 text-orange-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body: Reconciliation */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-white border border-zinc-200 rounded-md p-1">
              {["MTD", "QTD", "YTD", "Trailing 12mo", "Custom"].map((period) => (
                <button
                  key={period}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    period === "YTD" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Last GL sync: 2026-04-29 06:14 (NetSuite, success)
            </div>
          </div>

          {/* Top KPI Strip */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: "Open accruals", val: "$487,210", sub: "4 accruals, 1 awaiting approval" },
              { label: "Open obligations", val: "$156,400", sub: "2 obligations, oldest 14 days" },
              { label: "Variance YTD", val: "+$28,420", sub: "+0.66%, 12 settlements closed", delta: true },
              { label: "Claims pending", val: "1", sub: "Acme reported $42.3k vs our calc $44.8k" },
              { label: "Unposted JE", val: "2", sub: "$89,310 stuck", warn: true },
              { label: "Invoices YTD", val: "4", sub: "Totaling $1,247,000" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-md p-3 flex flex-col justify-between hover:border-orange-300 hover:shadow-sm transition-all">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{kpi.label}</div>
                <div className={`text-xl font-semibold mb-1 ${kpi.delta ? "text-amber-600" : kpi.warn ? "text-rose-600" : "text-zinc-900"}`}>
                  {kpi.val}
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-9 flex flex-col gap-5">
              {/* Settlement Variance Reconciliation */}
              <div className="bg-white border border-zinc-200 rounded-md flex flex-col">
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Settlement Variance Reconciliation</h3>
                  <button className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                    Export <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                      <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Period</th>
                      <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Our Accrual</th>
                      <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Their Claim</th>
                      <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium text-right">Variance</th>
                      <th className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[
                      { p: "Apr 2026", acc: "$312,840", clm: "$312,840", var: "$0", varPct: "0.00%", st: "Matched", note: "" },
                      { p: "Mar 2026", acc: "$358,210", clm: "$354,790", var: "+$3,420", varPct: "+0.96%", st: "Matched", note: "" },
                      { p: "Feb 2026", acc: "$341,520", clm: "$329,100", var: "+$12,420", varPct: "+3.77%", st: "Investigation", note: "Reason: Smart Home category exclusion disputed" },
                      { p: "Jan 2026", acc: "$298,470", clm: "$298,470", var: "$0", varPct: "0.00%", st: "Matched", note: "" },
                      { p: "Dec 2025", acc: "$412,890", clm: "$410,200", var: "+$2,690", varPct: "+0.65%", st: "Matched", note: "" },
                      { p: "Nov 2025", acc: "$389,650", clm: "$381,200", var: "+$8,450", varPct: "+2.22%", st: "Minor variance", note: "" },
                      { p: "Oct 2025", acc: "$356,280", clm: "$356,280", var: "$0", varPct: "0.00%", st: "Matched", note: "" },
                      { p: "Sep 2025", acc: "$342,170", clm: "$343,890", var: "-$1,720", varPct: "-0.50%", st: "Matched", note: "" },
                    ].map((row, i) => {
                      const isZero = row.var === "$0";
                      const isPos = row.var.startsWith("+");
                      const pct = parseFloat(row.varPct);
                      let varColor = "text-emerald-600";
                      if (Math.abs(pct) > 3) varColor = "text-rose-600";
                      else if (Math.abs(pct) >= 1) varColor = "text-amber-600";

                      return (
                        <React.Fragment key={i}>
                          <tr className="hover:bg-zinc-50 group">
                            <td className="px-4 py-2 font-medium text-zinc-900">{row.p}</td>
                            <td className="px-4 py-2 text-right">{row.acc}</td>
                            <td className="px-4 py-2 text-right">{row.clm}</td>
                            <td className={`px-4 py-2 text-right font-medium ${varColor}`}>
                              {row.var} <span className="text-xs font-normal opacity-70">({row.varPct})</span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-between">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  row.st === "Matched" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  row.st === "Investigation" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {row.st}
                                </span>
                                {row.note && (
                                  <button className="text-zinc-400 hover:text-zinc-600 opacity-0 group-hover:opacity-100">
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {row.note && (
                            <tr className="bg-orange-50/30 border-b border-zinc-100">
                              <td colSpan={5} className="px-4 py-2 text-xs text-rose-700 flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                                <span><span className="font-semibold">Investigation:</span> {row.note.replace('Reason: ', '')}</span>
                                <button className="ml-auto text-rose-600 underline text-[10px] font-medium">View Dispute</button>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 2-Col layout for Accruals/Obligations */}
              <div className="grid grid-cols-2 gap-5">
                {/* Open accruals card */}
                <div className="bg-white border border-zinc-200 rounded-md p-3">
                  <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3">Open Accruals</h3>
                  <div className="space-y-2">
                    {[
                      { p: "Apr 2026", amt: "$312,840", d: "2026-04-30", st: "Pending Review", ap: "Sarah Chen" },
                      { p: "Mar 2026", amt: "$358,210", d: "2026-03-31", st: "Approved", ap: "System" },
                      { p: "Feb 2026", amt: "$341,520", d: "2026-02-28", st: "Approved", ap: "System" },
                      { p: "Jan 2026", amt: "$298,470", d: "2026-01-31", st: "Approved", ap: "System" }
                    ].map((row, i) => (
                      <div key={i} className="flex flex-col gap-1 pb-2 border-b border-zinc-100 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900">{row.p}</span>
                          <span className="text-sm font-medium text-zinc-900">{row.amt}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Created {row.d}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${row.st === "Approved" ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span className="text-zinc-600">{row.st} <span className="text-zinc-400">({row.ap})</span></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open obligations card */}
                <div className="bg-white border border-zinc-200 rounded-md p-3">
                  <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3">Open Obligations</h3>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1 pb-2 border-b border-zinc-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900">Royalty Payment</span>
                        <span className="text-sm font-medium text-zinc-900">$134,200</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Due 2026-05-15</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600">Current</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900">Marketing co-op recoupment</span>
                        <span className="text-sm font-medium text-zinc-900">$22,200</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Due 2026-05-01</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">1-30 days late</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Col layout for Claims / Invoices */}
              <div className="grid grid-cols-2 gap-5">
                {/* Inbound claims card */}
                <div className="bg-white border border-zinc-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">Inbound Claims</h3>
                    <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">2 active</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-2.5 rounded border border-rose-200 bg-rose-50/30 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-medium text-zinc-900">Acme Q1 royalty claim</div>
                          <div className="text-[10px] text-zinc-500">Recv. 2026-04-22</div>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">Awaiting Response</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                        <div><div className="text-[9px] text-zinc-500 uppercase">Claimed</div><div className="font-medium">$42,300</div></div>
                        <div><div className="text-[9px] text-zinc-500 uppercase">Our Calc</div><div className="font-medium">$44,890</div></div>
                        <div><div className="text-[9px] text-zinc-500 uppercase">Variance</div><div className="font-medium text-rose-600">-$2,590 (-5.8%)</div></div>
                      </div>
                      <div className="text-[10px] text-zinc-600 bg-white p-1.5 rounded border border-rose-100 mt-1 italic">
                        "Acme excluded SKU 88241 (Smart Home) from their report"
                      </div>
                    </div>

                    <div className="p-2.5 rounded border border-zinc-100 bg-zinc-50/50 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-medium text-zinc-900">Acme Q4 2025 reconciliation</div>
                          <div className="text-[10px] text-zinc-500">Recv. 2026-01-18</div>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Approved</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                        <div><div className="text-[9px] text-zinc-500 uppercase">Claimed</div><div className="font-medium">$410,200</div></div>
                        <div><div className="text-[9px] text-zinc-500 uppercase">Our Calc</div><div className="font-medium">$412,890</div></div>
                        <div><div className="text-[9px] text-zinc-500 uppercase">Variance</div><div className="font-medium text-emerald-600">+$2,690 (+0.65%)</div></div>
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Auto-matched within tolerance
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoices issued card */}
                <div className="bg-white border border-zinc-200 rounded-md p-3 flex flex-col">
                  <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3">Invoices Issued</h3>
                  <div className="flex-1 space-y-2">
                    {[
                      { n: "INV-2026-0142", p: "Q1 2026 royalty", a: "$312,840", s: "Paid 2026-04-12", ok: true },
                      { n: "INV-2025-0891", p: "Q4 2025 royalty", a: "$410,200", s: "Paid 2026-01-25", ok: true },
                      { n: "INV-2025-0554", p: "Q3 2025 royalty", a: "$356,280", s: "Paid 2025-10-18", ok: true },
                      { n: "INV-2025-0211", p: "Q2 2025 royalty", a: "$167,680", s: "Paid 2025-07-22", ok: true },
                    ].map((inv, i) => (
                      <div key={i} className="flex flex-col gap-1 pb-2 border-b border-zinc-100 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900">{inv.n}</span>
                          <span className="text-sm font-medium text-zinc-900">{inv.a}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">{inv.p}</span>
                          <span className="text-emerald-600 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {inv.s}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs font-medium text-orange-600 hover:text-orange-700 mt-3 pt-2 border-t border-zinc-100 inline-flex justify-center w-full">
                    View All Invoices
                  </button>
                </div>
              </div>
            </div>

            {/* Right Rail */}
            <div className="col-span-3 flex flex-col gap-5">
              {/* Close Readiness */}
              <div className="bg-white border border-zinc-200 rounded-md p-3">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                  Close Readiness
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-900">Sales ingested</div>
                      <div className="text-[10px] text-zinc-500">14,387 / 14,387 for Apr 2026</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-900">Accrual calculated</div>
                      <div className="text-[10px] text-zinc-500">Apr 2026 completed</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-900">Accrual pending approval</div>
                      <div className="text-[10px] text-zinc-500">Awaiting Sarah Chen</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm opacity-50">
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-300 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-900">Claim response not sent</div>
                      <div className="text-[10px] text-zinc-500">Acme Q1 claim</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm opacity-50">
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-300 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-zinc-900">Journal entries pending</div>
                      <div className="text-[10px] text-zinc-500">2 entries to sync</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Est. time to close</span>
                  <span className="font-semibold text-zinc-900">18 minutes</span>
                </div>
              </div>

              {/* Journal Entry / GL Posting Status */}
              <div className="bg-white border border-zinc-200 rounded-md p-3 flex flex-col">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-3">GL Posting Status</h3>
                <div className="space-y-1.5 flex-1 mb-4">
                  {[
                    { d: "04-29", ref: "JE-9021", a: "$312,840", s: "Unposted", c: "amber" },
                    { d: "04-28", ref: "JE-9018", a: "-$42,300", s: "Unposted", c: "amber" },
                    { d: "03-31", ref: "JE-8842", a: "$358,210", s: "Posted", c: "emerald" },
                    { d: "02-28", ref: "JE-8109", a: "$341,520", s: "Posted", c: "emerald" },
                    { d: "01-31", ref: "JE-7650", a: "$298,470", s: "Posted", c: "emerald" },
                    { d: "12-31", ref: "JE-7112", a: "$412,890", s: "Posted", c: "emerald" },
                  ].map((je, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-zinc-500">{je.d}</span>
                        <span className="font-medium text-zinc-900">{je.ref}</span>
                      </div>
                      <span className="font-medium text-zinc-900 w-16 text-right">{je.a}</span>
                      <span className={`w-14 text-right ${je.c === 'amber' ? 'text-amber-600 font-semibold' : 'text-zinc-500'}`}>
                        {je.s}
                      </span>
                    </div>
                  ))}
                </div>
                <button className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm">
                  Sync to NetSuite
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
