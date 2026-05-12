import React from "react";
import {
  FileText,
  Users,
  Scale,
  Calculator,
  TrendingUp,
  Wallet,
  History,
  ShieldCheck,
  ChevronRight,
  MoreHorizontal,
  Save,
  Search,
  Bell,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Building2,
  Calendar as CalendarIcon,
  PieChart,
  LayoutDashboard,
  Settings,
  FolderOpen,
} from "lucide-react";

export function PerformanceTab() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex font-sans">
      {/* Sidebar - App Shell */}
      <div className="w-14 bg-zinc-900 flex flex-col items-center py-4 border-r border-zinc-800 shrink-0">
        <div className="h-8 w-8 rounded bg-orange-600 flex items-center justify-center text-white font-bold text-sm mb-8 shadow-sm shadow-orange-900/20">
          LQ
        </div>
        <div className="flex flex-col gap-4">
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <LayoutDashboard className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-white bg-zinc-800 shadow-inner">
            <FolderOpen className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <Calculator className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <PieChart className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <Bell className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-orange-400 to-orange-600 border-2 border-zinc-800 shadow-sm" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top App Bar */}
        <div className="bg-white border-b border-zinc-200 shrink-0">
          <div className="px-6 py-3 flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              <span className="hover:text-zinc-900 cursor-pointer transition-colors">Contracts</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-900 font-medium">
                Acme Distributors — Master License Agreement v3.2
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  placeholder="Search in contract..."
                  className="text-xs pl-7 pr-3 py-1.5 rounded-md border border-zinc-200 bg-zinc-50 w-48 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Title row */}
          <div className="px-6 pt-5 pb-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                <span className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 text-[10px] font-medium tracking-wide uppercase">
                  VRP (Volume Tiered)
                </span>
                <span className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
                  Auto-renewal enabled
                </span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 leading-tight mb-2">
                Acme Distributors — Master License Agreement v3.2
              </h1>
              <div className="flex items-center gap-4 text-xs text-zinc-600">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" /> 
                  Acme Distributors LLC (Tier 1)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" /> 
                  Jan 1, 2025 → Dec 31, 2027 <span className="text-zinc-400 ml-0.5">(16 mo in)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[8px] font-bold">SC</div>
                  Owner: Sarah Chen
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-6">
              <button className="px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm">
                <Save className="h-4 w-4" /> Save
              </button>
              <button className="p-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-sm">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 flex items-center gap-6 overflow-x-auto no-scrollbar border-t border-zinc-100">
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Overview</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Parties</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Terms</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Rules</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Policies</button>
            <button className="pb-3 pt-3 text-sm font-semibold text-orange-600 border-b-2 border-orange-600 whitespace-nowrap">Performance</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Reconciliation</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">Risks</button>
            <button className="pb-3 pt-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 border-b-2 border-transparent whitespace-nowrap">History</button>
          </div>
        </div>

        {/* Tab Body: Performance */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header + Period Selector */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Performance Tracking</h2>
                <p className="text-xs text-zinc-500">Monitor fee generation, sales flows, and forecast attainment.</p>
              </div>
              <div className="flex items-center p-1 bg-zinc-200/50 rounded-lg border border-zinc-200">
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-zinc-600 hover:text-zinc-900 transition-colors">MTD</button>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-zinc-600 hover:text-zinc-900 transition-colors">QTD</button>
                <button className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5">YTD</button>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-zinc-600 hover:text-zinc-900 transition-colors">Trailing 12mo</button>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-zinc-600 hover:text-zinc-900 transition-colors">Custom</button>
              </div>
            </div>

            {/* Top KPI Strip */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 flex justify-between items-start">
                  Calculated Fees YTD
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">$4,287,420</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ArrowUp className="h-3 w-3" /> 12.4%
                    </span>
                    <span className="text-zinc-400">vs prior YTD</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Sales Volume YTD
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">$28.49M</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ArrowUp className="h-3 w-3" /> 8.7%
                    </span>
                    <span className="text-zinc-400">vs prior YTD</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-1/4 translate-y-1/4">
                  <Calculator className="w-24 h-24" />
                </div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Effective Royalty Rate
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">15.05%</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="text-zinc-500 font-medium">Target 15.00%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Forecast Attainment
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">103.2%</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ArrowUp className="h-3 w-3" /> 3.2%
                    </span>
                    <span className="text-zinc-400">above plan</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Open Accrual Exposure
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">$487,210</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> 4 open accruals
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Sales Transactions Matched
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">98.5%</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                    14,387 of 14,612 lines
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Trailing-12 Run-rate
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">$5.14M</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                    Annualized fee projection
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all group flex flex-col justify-between h-28">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                  Data Freshness
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 tracking-tight">2 days</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Since last calculation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Chart + Insights */}
            <div className="grid grid-cols-3 gap-6">
              {/* Trend Chart */}
              <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-5 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Performance Trend (LTM + Forecast)</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Monthly sales volume vs calculated fees</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-zinc-200" /> Sales Volume (L-Axis)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-0.5 w-3 bg-orange-600 rounded-full" /> Fees (R-Axis)
                    </div>
                  </div>
                </div>
                
                {/* Custom CSS Grid Chart */}
                <div className="flex-1 relative flex items-end justify-between pt-8 pb-6 px-4">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-4 pb-6 pt-8">
                    {[0,1,2,3,4].map((i) => (
                      <div key={i} className="w-full border-t border-zinc-100 border-dashed" />
                    ))}
                  </div>
                  
                  {/* Data Points (12 actual + 3 forecast) */}
                  {[
                    { m: 'May', vol: 40, fee: 38, f: false },
                    { m: 'Jun', vol: 45, fee: 42, f: false },
                    { m: 'Jul', vol: 38, fee: 35, f: false },
                    { m: 'Aug', vol: 50, fee: 48, f: false },
                    { m: 'Sep', vol: 55, fee: 52, f: false },
                    { m: 'Oct', vol: 60, fee: 58, f: false },
                    { m: 'Nov', vol: 75, fee: 70, f: false },
                    { m: 'Dec', vol: 95, fee: 88, f: false },
                    { m: 'Jan', vol: 45, fee: 40, f: false },
                    { m: 'Feb', vol: 48, fee: 43, f: false },
                    { m: 'Mar', vol: 55, fee: 50, f: false },
                    { m: 'Apr', vol: 62, fee: 55, f: false },
                    { m: 'May', vol: 65, fee: 58, f: true },
                    { m: 'Jun', vol: 70, fee: 62, f: true },
                    { m: 'Jul', vol: 68, fee: 60, f: true },
                  ].map((d, i) => (
                    <div key={i} className="relative flex flex-col items-center h-full w-[5%] group">
                      {/* Bar (Volume) */}
                      <div className="absolute bottom-0 w-full flex items-end h-full">
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-300 ${d.f ? 'bg-zinc-100/60 border border-zinc-200 border-dashed border-b-0' : 'bg-zinc-200 group-hover:bg-zinc-300'}`}
                          style={{ height: `${d.vol}%` }}
                        />
                      </div>
                      
                      {/* Line Point (Fee) */}
                      <div 
                        className={`absolute w-2 h-2 rounded-full -translate-x-1/2 translate-y-1/2 z-10 ${d.f ? 'bg-white border-2 border-orange-400' : 'bg-orange-600 ring-2 ring-white shadow-sm'}`}
                        style={{ bottom: `${d.fee}%`, left: '50%' }}
                      />
                      
                      {/* Line Segments (SVG overlay would be better, approximating with divs for pure CSS approach) */}
                      {i < 14 && (
                        <div 
                           className={`absolute left-[50%] origin-bottom-left ${d.f ? 'border-t-2 border-dashed border-orange-400' : 'border-t-2 border-orange-600'}`}
                           style={{ 
                             bottom: `${d.fee}%`, 
                             width: '100%',
                             transform: `rotate(${Math.atan2((([38,42,35,48,52,58,70,88,40,43,50,55,58,62,60][i+1]) - d.fee), 100) * (-45)}deg)` // Very rough approximation for visual effect
                           }} 
                        />
                      )}

                      {/* Label */}
                      <div className={`absolute -bottom-6 text-[10px] font-medium whitespace-nowrap ${d.f ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {d.m}
                        {i === 11 && <div className="absolute -top-[1.2rem] left-1/2 -translate-x-1/2 w-[1px] h-full bg-zinc-300" />}
                      </div>
                      
                      {/* Tooltip Hover */}
                      <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 transition-opacity">
                        {d.f ? 'Forecast: ' : ''}{d.m} <br/>
                        Vol: ${(d.vol * 0.8).toFixed(1)}M<br/>
                        Fee: ${(d.fee * 0.12).toFixed(2)}M
                      </div>
                    </div>
                  ))}
                  
                  {/* Current period marker */}
                  <div className="absolute right-[22%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-300 to-zinc-300 border-r border-dashed border-zinc-300 pointer-events-none">
                    <div className="absolute top-2 -left-16 bg-zinc-100 text-zinc-500 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap">
                      Current Period
                    </div>
                  </div>
                </div>
              </div>

              {/* Insights Column */}
              <div className="space-y-6">
                {/* Outliers & Anomalies */}
                <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                  <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-4">
                    <Lightbulb className="h-4 w-4 text-orange-500" /> Outliers & Insights
                  </h3>
                  <div className="space-y-3 relative z-10">
                    <div className="bg-white border border-zinc-100 p-3 rounded-lg shadow-sm text-sm text-zinc-700 leading-snug hover:border-orange-200 transition-colors cursor-pointer group">
                      <span className="font-semibold text-zinc-900 group-hover:text-orange-700 transition-colors">Smart Home</span> category fees down 22% MoM — investigate underlying volume drop.
                    </div>
                    <div className="bg-white border border-zinc-100 p-3 rounded-lg shadow-sm text-sm text-zinc-700 leading-snug hover:border-emerald-200 transition-colors cursor-pointer group">
                      Acme Q1 settlement closed <span className="font-semibold text-emerald-700">4 days faster</span> than YTD average.
                    </div>
                    <div className="bg-white border border-zinc-100 p-3 rounded-lg shadow-sm text-sm text-zinc-700 leading-snug hover:border-blue-200 transition-colors cursor-pointer group">
                      Forecast tracking <span className="font-semibold text-blue-700">+3.2% above plan</span> — consider revising Q3 targets upward.
                    </div>
                  </div>
                </div>

                {/* Tier Progression */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 mb-1">Tier Progression (VRP)</h3>
                  <p className="text-xs text-zinc-500 mb-4">Year-to-date volume performance against contract tiers</p>
                  
                  <div className="relative pt-2 pb-6">
                    {/* Track */}
                    <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden flex">
                      {/* Tier 1 fill */}
                      <div className="h-full bg-zinc-300 border-r border-white/50" style={{ width: '33.3%' }} />
                      {/* Tier 2 fill */}
                      <div className="h-full bg-orange-300 border-r border-white/50" style={{ width: '50%' }} />
                      {/* Tier 3 fill (partial) */}
                      <div className="h-full bg-orange-500" style={{ width: '11.6%' }} />
                    </div>
                    
                    {/* Current Position Marker */}
                    <div className="absolute top-0 w-0.5 h-7 bg-zinc-900" style={{ left: '95%' }}>
                      <div className="absolute -top-6 -left-6 bg-zinc-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm">
                        $28.5M
                      </div>
                      <div className="absolute top-full mt-1 -translate-x-1/2 text-[10px] font-semibold text-zinc-900">
                        Current
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="absolute bottom-0 w-full flex justify-between text-[10px] font-medium text-zinc-500 px-1">
                      <span>$0</span>
                      <span className="relative left-[3.5%]">$10M <span className="block text-[9px] text-zinc-400">12%</span></span>
                      <span className="relative left-[1.5%]">$25M <span className="block text-[9px] text-zinc-400">15%</span></span>
                      <span className="text-orange-600 font-bold">Tier 3 (18%) Active</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[11px] bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-100 font-medium">
                    Next milestone: $30M = $135K additional fees if reached
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Mix & Breakdowns */}
            <div className="grid grid-cols-3 gap-6 pb-8">
              {/* Sales Mix Breakdown */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">Sales Mix by Category</h3>
                <div className="space-y-4">
                  {[
                    { name: 'Audio Devices', fee: '$1.84M', pct: 43, color: 'bg-orange-600' },
                    { name: 'Wearables', fee: '$892K', pct: 21, color: 'bg-orange-500' },
                    { name: 'Smart Home', fee: '$612K', pct: 14, color: 'bg-orange-400' },
                    { name: 'Mobile Accessories', fee: '$487K', pct: 11, color: 'bg-orange-300' },
                    { name: 'Other', fee: '$452K', pct: 11, color: 'bg-zinc-300' },
                  ].map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-zinc-700">{c.name}</span>
                        <div className="flex gap-3 text-zinc-500">
                          <span>{c.fee}</span>
                          <span className="font-semibold text-zinc-900 w-8 text-right">{c.pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Territory Breakdown */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">Fee Contribution by Territory</h3>
                <div className="space-y-4.5">
                  {[
                    { name: 'USA-West', fee: '$1.42M', pct: 33, color: 'bg-emerald-600' },
                    { name: 'USA-East', fee: '$1.29M', pct: 30, color: 'bg-emerald-500' },
                    { name: 'Canada', fee: '$834K', pct: 19, color: 'bg-emerald-400' },
                    { name: 'EMEA', fee: '$743K', pct: 17, color: 'bg-emerald-300' },
                  ].map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-zinc-700">{c.name}</span>
                        <div className="flex gap-3 text-zinc-500">
                          <span>{c.fee}</span>
                          <span className="font-semibold text-zinc-900 w-8 text-right">{c.pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 Sales Table */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Top Transactions (YTD)</h3>
                  <button className="text-[11px] font-medium text-orange-600 hover:text-orange-700">View all</button>
                </div>
                <div className="flex-1 overflow-auto -mx-2 px-2 no-scrollbar">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="pb-2 font-semibold text-zinc-500">Date</th>
                        <th className="pb-2 font-semibold text-zinc-500">Customer / Product</th>
                        <th className="pb-2 font-semibold text-zinc-500 text-right">Volume</th>
                        <th className="pb-2 font-semibold text-zinc-500 text-right">Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {[
                        { d: 'Mar 14', c: 'Best Buy', p: 'Sennheiser HD 660S', v: '$284,500', f: '$51,210' },
                        { d: 'Mar 02', c: 'Target', p: 'Momentum 4 Wireless', v: '$192,800', f: '$34,704' },
                        { d: 'Feb 18', c: 'Amazon', p: 'Ambeo Soundbar', v: '$145,200', f: '$21,780' },
                        { d: 'Jan 29', c: 'B&H Photo', p: 'IE 900 Pro', v: '$98,400', f: '$11,808' },
                        { d: 'Jan 15', c: 'Best Buy', p: 'CX Plus True Wireless', v: '$86,100', f: '$10,332' },
                      ].map((r, i) => (
                        <tr key={i} className="hover:bg-zinc-50 transition-colors group">
                          <td className="py-2.5 whitespace-nowrap text-zinc-500">{r.d}</td>
                          <td className="py-2.5">
                            <div className="font-medium text-zinc-900 group-hover:text-orange-600 transition-colors cursor-pointer">{r.c}</div>
                            <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{r.p}</div>
                          </td>
                          <td className="py-2.5 text-right font-medium">{r.v}</td>
                          <td className="py-2.5 text-right font-semibold text-zinc-900">{r.f}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
