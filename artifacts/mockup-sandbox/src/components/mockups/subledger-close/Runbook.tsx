import { useState } from "react";
import {
  CheckCircle2, Circle, Lock, Sparkles, ArrowRight, ArrowDown, AlertTriangle,
  Calculator, BookOpen, Handshake, Wallet, Inbox, ArrowLeftRight, Receipt,
  FileText, Filter, Eye, ShieldCheck, Clock, Building2, ChevronRight,
  PlayCircle, FastForward, History, Users, MessageSquare,
} from "lucide-react";

// ─── Mock data — 9-step close runbook ────────────────────────────────────────

const STEPS = [
  { n: 1, key: "obligations", label: "Confirm Contract Obligations", icon: FileText, owner: "J. Chen", done: true, completedAt: "Apr 26 · 14:02", count: 147, ok: 147, summary: "All in-scope obligations confirmed for Apr period." },
  { n: 2, key: "flow",        label: "Group by Flow",                icon: ArrowLeftRight, owner: "system",  done: true, completedAt: "Apr 26 · 14:03", count: 4,   ok: 4,   summary: "Rebates · Royalties · Commissions · Subscriptions." },
  { n: 3, key: "subflow",     label: "Group by Sub-flow / Program",  icon: Filter,         owner: "system",  done: true, completedAt: "Apr 26 · 14:03", count: 31,  ok: 31,  summary: "31 active programs across 4 flows." },
  { n: 4, key: "accrual",     label: "Calculate & Approve Accruals", icon: Calculator,     owner: "J. Chen", done: false, current: true, count: 147, ok: 142, blocked: 0, pending: 5, summary: "142 of 147 calc'd. 5 awaiting Walmart Q2 volume tier finalization." },
  { n: 5, key: "je",          label: "Post Journal Entries",         icon: BookOpen,       owner: "J. Chen", done: false, count: 142, ok: 138, blocked: 5, pending: 0, summary: "138 posted. 5 unposted in CRP-STACK — controller approval needed." },
  { n: 6, key: "settlement",  label: "Complete Settlements",         icon: Handshake,      owner: "J. Chen", done: false, count: 138, ok: 89, pending: 49, summary: "89 of 138 cash settled. 49 within payment window." },
  { n: 7, key: "claims",      label: "Reconcile Claims (IB / OB)",   icon: Inbox,          owner: "J. Chen", done: false, count: 37, ok: 23, pending: 14, blocked: 7, summary: "23 inbound · 14 outbound. 7 disputed need review." },
  { n: 8, key: "deductions",  label: "Apply Deductions",             icon: ArrowLeftRight, owner: "J. Chen", done: false, count: 12, ok: 12, summary: "$186k in deductions captured against 12 obligations." },
  { n: 9, key: "invoices",    label: "Reconcile Invoice Status",     icon: Receipt,        owner: "J. Chen", done: false, count: 76, ok: 68, pending: 8, summary: "68 of 76 paid/issued. 8 overdue need partner outreach." },
];

const SIGNOFF = ["Prepare", "Review", "Lock"];

// ─── Component ───────────────────────────────────────────────────────────────

export function Runbook() {
  const [activeStep, setActiveStep] = useState(4);
  const completed = STEPS.filter((s) => s.done).length;
  const total = STEPS.length;
  const pct = Math.round((completed / total) * 100);
  const current = STEPS.find((s) => s.n === activeStep) || STEPS[3];

  return (
    <div className="min-h-screen bg-[hsl(43,26%,95%)] text-[hsl(240,20%,5%)] p-5 font-sans">
      <div className="max-w-[1340px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Contract Subledger · Apr 2026 Runbook
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Close Runbook</h1>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                <span>LicenseIQ Corp. (Consol.)</span>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Day 3 of 5 · 2 days left</span>
                <span className="text-gray-300">·</span>
                <span>Owner J. Chen → M. Patel → S. Rivera</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-gray-500 mb-1">Step <span className="font-bold text-orange-600">{activeStep}</span> of {total}</div>
              <div className="w-72 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-gray-400 mt-1">{completed} of {total} complete · {pct}% done</div>
            </div>
          </div>

          {/* Sign-off chain */}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {SIGNOFF.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${
                  i === 0 ? "bg-green-50 border-green-200 text-green-800" :
                  i === 1 ? "bg-orange-50 border-orange-300 text-orange-800 ring-2 ring-orange-100" :
                  "bg-gray-50 border-gray-200 text-gray-400"
                }`}>
                  {i === 0 ? <CheckCircle2 className="w-3 h-3" /> : i === 1 ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span className="text-[10px] font-bold">{s}</span>
                </div>
                {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300" />}
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button className="text-[11px] h-7 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-orange-600" /> AI Close Check
              </button>
              <button disabled className="text-[11px] h-7 px-2.5 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Lock Period
              </button>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Vertical stepper */}
          <div className="col-span-4">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm sticky top-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-2">Lifecycle Steps</div>
              <ol className="relative">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = s.n === activeStep;
                  const isDone = s.done;
                  const isLast = i === STEPS.length - 1;
                  const blocked = (s.blocked || 0) > 0;
                  return (
                    <li key={s.key} className="relative pl-8 pb-3">
                      {!isLast && (
                        <div className={`absolute left-3 top-7 bottom-0 w-px ${isDone ? "bg-green-400" : "bg-gray-200"}`} />
                      )}
                      <div className="absolute left-0 top-1.5">
                        {isDone ? (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        ) : isActive ? (
                          <div className="w-6 h-6 rounded-full bg-orange-500 ring-4 ring-orange-100 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">{s.n}</span>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-gray-400">{s.n}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveStep(s.n)}
                        className={`w-full text-left rounded-md px-2 py-1.5 transition-colors ${
                          isActive ? "bg-orange-50 ring-1 ring-orange-200" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-900">
                          <Icon className="w-3 h-3 text-gray-500" />
                          {s.label}
                          {blocked && <span className="ml-auto text-[9px] font-bold bg-red-100 text-red-700 rounded-full px-1.5">{s.blocked}</span>}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {isDone
                            ? <span className="text-green-700">✓ {s.completedAt}</span>
                            : <span>{s.ok || 0}/{s.count} done {s.pending ? `· ${s.pending} pending` : ""}</span>
                          }
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Right: Active step focus */}
          <div className="col-span-8 space-y-4">
            {/* Active step card */}
            <div className="bg-white border-2 border-orange-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-white px-5 py-4 border-b border-orange-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1">
                      Step {current.n} of {total} · current
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <current.icon className="w-5 h-5 text-orange-600" />
                      {current.label}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">{current.summary}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Progress</div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(((current.ok || 0) / Math.max(current.count, 1)) * 100)}%</div>
                    <div className="text-[10px] text-gray-500">{current.ok}/{current.count}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Status breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Done</div>
                    <div className="text-2xl font-bold text-green-800 mt-0.5">{current.ok}</div>
                    <div className="text-[10px] text-green-700">142 of 147 obligations</div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-yellow-700">Pending</div>
                    <div className="text-2xl font-bold text-yellow-800 mt-0.5">{current.pending || 0}</div>
                    <div className="text-[10px] text-yellow-700">awaiting upstream data</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Blocked</div>
                    <div className="text-2xl font-bold text-red-800 mt-0.5">{current.blocked || 0}</div>
                    <div className="text-[10px] text-red-700">no critical blockers</div>
                  </div>
                </div>

                {/* What's pending */}
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-2">5 obligations pending — what's needed</div>
                  <div className="space-y-1.5">
                    {[
                      { id: "OBL-2026-0421", contract: "Costco Stack rebate", reason: "Walmart Q2 volume tier finalization", action: "Request Q2 volume confirmation" },
                      { id: "OBL-2026-0438", contract: "Soundcore Q1 vol", reason: "Mix-shift adjustment from sales ops", action: "Open variance explainer" },
                      { id: "OBL-2026-0441", contract: "Anker distrib.", reason: "Awaiting POS data refresh (cron at 23:00)", action: "Wait · auto-resolves tonight" },
                      { id: "OBL-2026-0455", contract: "Walmart MSA Q2", reason: "Tier-rate change pending controller sign-off", action: "Notify M. Patel" },
                      { id: "OBL-2026-0461", contract: "Target Annual Vol", reason: "Manual override pending", action: "Apply override or revert" },
                    ].map((o) => (
                      <div key={o.id} className="flex items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                        <Circle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        <span className="font-mono text-[10px] text-gray-500">{o.id}</span>
                        <span className="font-semibold text-gray-900">{o.contract}</span>
                        <span className="text-gray-500 truncate flex-1">— {o.reason}</span>
                        <button className="text-orange-600 hover:underline text-[10px] whitespace-nowrap">{o.action} →</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI assist */}
                <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-[11px]">
                    <div className="font-semibold text-orange-900">AI suggestion</div>
                    <div className="text-orange-800 mt-0.5">3 of 5 pending will auto-resolve when tonight's POS data refresh runs (23:00 PT). The other 2 need your action — start with Walmart MSA Q2 (largest $).</div>
                  </div>
                  <button className="text-[10px] h-7 px-2.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-1 whitespace-nowrap">
                    <PlayCircle className="w-3 h-3" /> Start with Walmart
                  </button>
                </div>

                {/* Step actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <button className="text-[11px] h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View all 147
                    </button>
                    <button className="text-[11px] h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
                      <Users className="w-3 h-3" /> Assign helper
                    </button>
                    <button className="text-[11px] h-8 px-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
                      <FastForward className="w-3 h-3" /> Skip & flag
                    </button>
                  </div>
                  <button disabled className="text-[12px] h-8 px-4 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed inline-flex items-center gap-1.5 font-semibold">
                    Complete Step 4 → Advance to Step 5 <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Up next preview */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <ArrowDown className="w-3.5 h-3.5 text-gray-400" /> Up next — preview the next 3 steps
              </div>
              <div className="grid grid-cols-3 gap-3">
                {STEPS.slice(activeStep, activeStep + 3).map((s) => {
                  const Icon = s.icon;
                  const blocked = (s.blocked || 0) > 0;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveStep(s.n)}
                      className="text-left rounded-lg border border-gray-200 bg-gray-50/40 hover:bg-orange-50/30 hover:border-orange-200 p-3 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-gray-400">STEP {s.n}</span>
                        {blocked && <span className="text-[9px] font-bold bg-red-100 text-red-700 rounded-full px-1.5 ml-auto">{s.blocked} blocker</span>}
                      </div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 mb-1">
                        <Icon className="w-3 h-3 text-gray-500" /> {s.label}
                      </div>
                      <div className="text-[10px] text-gray-500">{s.summary}</div>
                      <div className="text-[10px] text-gray-400 mt-1.5">
                        {s.ok || 0}/{s.count} ready · {s.pending ? `${s.pending} pending` : "no pending"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Already done — collapsed */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Already complete (3 steps · audit trail)
              </div>
              <div className="space-y-1.5">
                {STEPS.filter((s) => s.done).map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-[11px] text-gray-600 bg-green-50/40 border border-green-100 rounded-md px-2.5 py-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="font-bold">Step {s.n}</span>
                    <span>{s.label}</span>
                    <span className="text-gray-400">·</span>
                    <span>{s.completedAt}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-green-700">{s.ok}/{s.count} confirmed</span>
                    <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-gray-400" /> Activity in this run
              </div>
              <div className="space-y-2">
                {[
                  { t: "11:34", who: "M. Patel", a: "Bulk-resolved 4 medium blockers", tone: "green" },
                  { t: "11:08", who: "M. Patel", a: "Flagged Rebates +8.2% variance for review", tone: "yellow" },
                  { t: "10:22", who: "system",   a: "Auto-closed 6 VRP settlements (CM posted to GL)", tone: "purple" },
                  { t: "09:14", who: "J. Chen",  a: "Marked Step 1 (Confirm Obligations) complete", tone: "blue" },
                  { t: "09:01", who: "system",   a: "Promoted 14 accruals → obligations · minted 9 OB claims", tone: "orange" },
                ].map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <div className="text-gray-400 w-10 text-right">{e.t}</div>
                    <div className={`w-1 self-stretch rounded-full ${
                      e.tone === "green" ? "bg-green-400" : e.tone === "yellow" ? "bg-yellow-400" :
                      e.tone === "purple" ? "bg-purple-400" : e.tone === "blue" ? "bg-blue-400" : "bg-orange-400"
                    }`} />
                    <div className="flex-1">
                      <div className="text-gray-900">{e.a}</div>
                      <div className="text-[10px] text-gray-400">{e.who}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 text-center pt-2">
          Process-led · Each step must complete before the next unlocks · Review &amp; Lock gated by all 9 steps complete
        </div>
      </div>
    </div>
  );
}
