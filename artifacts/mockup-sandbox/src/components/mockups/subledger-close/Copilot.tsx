import { useState } from "react";
import {
  Sparkles, Send, Lock, ShieldCheck, CheckCircle2, AlertTriangle, Clock,
  Calculator, BookOpen, Handshake, Wallet, Inbox, ArrowLeftRight, Receipt,
  FileText, Building2, ChevronRight, Eye, ArrowRight, MessageSquare, Bot,
  ThumbsUp, ThumbsDown, ListChecks, History, Zap, X, Pencil, Filter,
} from "lucide-react";

// ─── The conversation thread ─────────────────────────────────────────────────

type ChatMsg =
  | { kind: "ai-text"; t: string; ts: string; agent?: string }
  | { kind: "user-text"; t: string; ts: string; who: string }
  | { kind: "ai-card-blocker"; t: string; ts: string; data: { stage: string; title: string; detail: string; suggestion: string; net: string } }
  | { kind: "ai-card-batch"; t: string; ts: string; data: { stage: string; count: number; total: string; samples: Array<{ id: string; contract: string; amt: string }>; reasoning: string } }
  | { kind: "ai-card-summary"; t: string; ts: string; data: { kpis: Array<{ label: string; value: string; tone: string }> } }
  | { kind: "system"; t: string; ts: string; tone: "ok" | "warn" | "info" };

const THREAD: ChatMsg[] = [
  { kind: "ai-text", agent: "LedgerIQ", ts: "08:42", t: "Good morning J. I just walked the Apr 2026 subledger end-to-end. Here's where you stand." },
  { kind: "ai-card-summary", ts: "08:42", t: "summary", data: {
    kpis: [
      { label: "Obligations", value: "147", tone: "neutral" },
      { label: "Accrued",     value: "$3.92M", tone: "ok" },
      { label: "JE'd",        value: "$3.74M (94.4%)", tone: "ok" },
      { label: "Settled",     value: "$2.41M (64.5%)", tone: "neutral" },
      { label: "Open claims", value: "37 (7 disputed)", tone: "warn" },
      { label: "Variance vs Mar", value: "+5.7%", tone: "warn" },
    ],
  }},
  { kind: "ai-text", agent: "LedgerIQ", ts: "08:42", t: "Day 3 of 5. Two days until Lock target. To get there I see 3 things to decide today. Let's go through them." },
  { kind: "ai-card-blocker", ts: "08:43", t: "blocker", data: {
    stage: "JE", title: "5 unposted JEs in CRP-STACK program",
    detail: "Costco Stack rebate accruals are approved but draft JE batch was never released. This blocks 5 settlements and 3 claims downstream.",
    suggestion: "Auto-post all 5 in one batch (balanced Dr/Cr).",
    net: "Net Dr 2150 / Cr 4000 = $186,400",
  }},
  { kind: "user-text", who: "J. Chen", ts: "08:46", t: "Looks right. Post them all. But pause on Walmart MSA Q2 — I want to check the tier rate first." },
  { kind: "system", ts: "08:46", tone: "ok", t: "✓ Posted 4 JEs · 1 (Walmart MSA Q2) held for review · audit trail logged" },
  { kind: "ai-text", agent: "LedgerIQ", ts: "08:47", t: "Done. Walmart MSA Q2 is now in your hold queue. I'll bring it back when you're ready. Next: there's a variance worth a look." },
  { kind: "ai-card-batch", ts: "08:48", t: "variance", data: {
    stage: "Variance", count: 1, total: "+8.2% vs Mar (Rebates flow)",
    samples: [{ id: "OBL-2026-0413", contract: "Walmart MSA Q2 Vol", amt: "$94k driver" }],
    reasoning: "The Q1 baseline didn't anticipate the volume tier kicker on Walmart MSA Q2 — it crossed the 12% tier on April 18. That single contract explains $94k of the $214k drift.",
  }},
];

// Side panel — current subledger state (updates as conversation progresses)
const SIDE_STATE = [
  { stage: "Obligations",  count: 147, ok: 147, pct: 100, icon: FileText },
  { stage: "Accruals",     count: 147, ok: 142, pct: 96.6, icon: Calculator },
  { stage: "JEs",          count: 142, ok: 142, pct: 100, icon: BookOpen, justChanged: true },
  { stage: "Settlements",  count: 138, ok: 89,  pct: 64.5, icon: Handshake },
  { stage: "Claims",       count: 37,  ok: 23,  pct: 62,   icon: Inbox },
  { stage: "Deductions",   count: 12,  ok: 12,  pct: 100, icon: ArrowLeftRight },
  { stage: "Invoices",     count: 76,  ok: 68,  pct: 89.5, icon: Receipt },
];

const ACTION_QUEUE = [
  { id: "Q1", label: "Review Walmart MSA Q2 tier rate (you held this)", icon: Eye, urgent: true },
  { id: "Q2", label: "Bulk-approve 7 inbound claims under $25k", icon: Inbox, urgent: false },
  { id: "Q3", label: "Sign off Rebates +8.2% variance explanation", icon: AlertTriangle, urgent: true },
  { id: "Q4", label: "Confirm 2 pending obligations awaiting POS data", icon: Clock, urgent: false },
  { id: "Q5", label: "Hand off to M. Patel for Review stage", icon: ShieldCheck, urgent: false },
];

const SUGGESTED_PROMPTS = [
  "Show me all blockers grouped by partner",
  "Why is the Rebates flow up 8.2%?",
  "What changed since I left yesterday?",
  "Walk me through Walmart MSA Q2 end-to-end",
  "Bulk-approve all claims under $10k",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function Copilot() {
  const [draft, setDraft] = useState("");

  return (
    <div className="min-h-screen bg-[hsl(43,26%,95%)] text-[hsl(240,20%,5%)] p-4 font-sans">
      <div className="max-w-[1340px] mx-auto space-y-3">
        {/* Compact header */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Contract Subledger · LedgerIQ Co-Pilot
              </div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Apr 2026 Close · Conversation</h1>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-800">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Day 3/5 · on track
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-800">
              <Zap className="w-3 h-3" /> 3 decisions in queue
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="text-[11px] h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <Filter className="w-3 h-3" /> Switch to worksheet view
            </button>
            <button disabled className="text-[11px] h-8 px-3 rounded-md bg-orange-600 text-white opacity-50 cursor-not-allowed inline-flex items-center gap-1.5 font-semibold">
              <Lock className="w-3 h-3" /> Lock Period
            </button>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-12 gap-3" style={{ minHeight: 1900 }}>
          {/* LEFT — Subledger summary (live) */}
          <aside className="col-span-3 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sticky top-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Live Subledger State</div>
                <span className="text-[9px] text-gray-400 inline-flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> live
                </span>
              </div>
              <div className="space-y-1.5">
                {SIDE_STATE.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.stage}
                      className={`rounded-md border p-2 transition-all ${
                        s.justChanged ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100" : "border-gray-100 bg-gray-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-900">
                          <Icon className="w-3 h-3 text-gray-500" /> {s.stage}
                        </div>
                        {s.justChanged && (
                          <span className="text-[8px] font-bold uppercase bg-orange-200 text-orange-800 rounded-full px-1.5">just updated</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                          <div className={`h-full ${s.pct >= 95 ? "bg-green-500" : s.pct >= 80 ? "bg-yellow-500" : "bg-orange-500"}`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 w-8 text-right">{s.pct.toFixed(0)}%</span>
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{s.ok}/{s.count}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Sign-off chain</div>
                <div className="space-y-1">
                  {[
                    { l: "Prepare", who: "J. Chen", state: "done" },
                    { l: "Review",  who: "M. Patel", state: "current" },
                    { l: "Lock",    who: "S. Rivera", state: "pending" },
                  ].map((s) => (
                    <div key={s.l} className={`flex items-center gap-2 text-[10px] px-2 py-1 rounded ${
                      s.state === "done" ? "bg-green-50 text-green-800" :
                      s.state === "current" ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {s.state === "done" ? <CheckCircle2 className="w-3 h-3" /> : s.state === "current" ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span className="font-bold">{s.l}</span>
                      <span className="ml-auto">{s.who}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER — Conversation */}
          <main className="col-span-6 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">Today · Apr 28 close session</span>
                <span className="text-[10px] text-gray-400 ml-auto">started 08:42 · 6 turns</span>
              </div>

              <div className="p-4 space-y-4">
                {THREAD.map((m, i) => {
                  if (m.kind === "ai-text") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-0.5">{m.agent} · {m.ts}</div>
                          <div className="text-xs text-gray-900 leading-relaxed">{m.t}</div>
                        </div>
                      </div>
                    );
                  }
                  if (m.kind === "user-text") {
                    return (
                      <div key={i} className="flex items-start gap-2 justify-end">
                        <div className="flex-1 max-w-[80%]">
                          <div className="text-[10px] text-gray-500 mb-0.5 text-right">{m.who} · {m.ts}</div>
                          <div className="text-xs text-gray-900 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg rounded-tr-sm px-3 py-2">{m.t}</div>
                        </div>
                        <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">JC</div>
                      </div>
                    );
                  }
                  if (m.kind === "system") {
                    return (
                      <div key={i} className="flex justify-center">
                        <div className={`text-[10px] px-3 py-1 rounded-full border ${
                          m.tone === "ok" ? "bg-green-50 text-green-800 border-green-200" :
                          m.tone === "warn" ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
                          "bg-gray-50 text-gray-700 border-gray-200"
                        }`}>{m.t}</div>
                      </div>
                    );
                  }
                  if (m.kind === "ai-card-summary") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-1">attached snapshot · {m.ts}</div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-50 to-white px-3 py-1.5 border-b border-orange-100 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                              360° Snapshot · Apr 2026
                            </div>
                            <div className="grid grid-cols-3 gap-px bg-gray-100">
                              {m.data.kpis.map((k, j) => (
                                <div key={j} className="bg-white p-2.5">
                                  <div className="text-[9px] text-gray-500 uppercase tracking-wide">{k.label}</div>
                                  <div className={`text-base font-bold leading-tight ${
                                    k.tone === "ok" ? "text-green-700" :
                                    k.tone === "warn" ? "text-orange-700" :
                                    "text-gray-900"
                                  }`}>{k.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (m.kind === "ai-card-blocker") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-1">decision needed · {m.ts}</div>
                          <div className="border-2 border-red-200 bg-red-50/40 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-red-700">{m.data.stage} blocker</div>
                                <div className="text-xs font-bold text-gray-900 mt-0.5">{m.data.title}</div>
                                <div className="text-[11px] text-gray-700 mt-1">{m.data.detail}</div>
                                <div className="mt-2 rounded-md border border-orange-200 bg-orange-50/60 p-2">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-800 mb-1">
                                    <Sparkles className="w-3 h-3" /> AI Suggestion
                                  </div>
                                  <div className="text-[11px] text-gray-800">{m.data.suggestion}</div>
                                  <div className="text-[10px] font-mono text-gray-600 mt-1">{m.data.net}</div>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <button className="text-[11px] h-7 px-2.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" /> Approve all 5
                                  </button>
                                  <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> Review one-by-one
                                  </button>
                                  <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
                                    <Pencil className="w-3 h-3" /> Edit accounts
                                  </button>
                                  <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
                                    <X className="w-3 h-3" /> Skip for now
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (m.kind === "ai-card-batch") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-1">analysis · {m.ts}</div>
                          <div className="border border-yellow-200 bg-yellow-50/40 rounded-lg p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-yellow-800 mb-1">
                              {m.data.stage} · {m.data.total}
                            </div>
                            <div className="text-[11px] text-gray-800">{m.data.reasoning}</div>
                            <div className="mt-2 space-y-1">
                              {m.data.samples.map((s) => (
                                <div key={s.id} className="flex items-center gap-2 text-[10px] bg-white border border-gray-200 rounded px-2 py-1">
                                  <span className="font-mono text-gray-500">{s.id}</span>
                                  <span className="font-semibold text-gray-900">{s.contract}</span>
                                  <span className="ml-auto text-orange-700">{s.amt}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <button className="text-[11px] h-7 px-2.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-1 font-semibold">
                                <ShieldCheck className="w-3 h-3" /> Accept variance & sign-off
                              </button>
                              <button className="text-[11px] h-7 px-2.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> Drill into Walmart Q2
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* AI typing indicator */}
                <div className="flex items-center gap-2 text-[10px] text-gray-500 pl-9">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                    <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                  LedgerIQ is preparing the third decision (claims bulk-approval)…
                </div>
              </div>

              {/* Composer */}
              <div className="border-t border-gray-100 p-3 bg-gray-50/40">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
                    <button key={p} onClick={() => setDraft(p)} className="text-[10px] px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700">
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-lg p-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={1}
                    placeholder="Ask LedgerIQ anything about the Apr 2026 close…"
                    className="flex-1 text-xs bg-transparent resize-none outline-none placeholder:text-gray-400 py-1"
                  />
                  <button className="text-[11px] h-7 px-3 rounded-md bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-1 font-semibold">
                    <Send className="w-3 h-3" /> Send
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[9px] text-gray-400">
                  <span>Every action is logged to the audit trail · LedgerIQ never auto-acts without your approval</span>
                  <span className="inline-flex items-center gap-2">
                    <button className="hover:text-gray-700"><ThumbsUp className="w-2.5 h-2.5" /></button>
                    <button className="hover:text-gray-700"><ThumbsDown className="w-2.5 h-2.5" /></button>
                  </span>
                </div>
              </div>
            </div>
          </main>

          {/* RIGHT — Action queue + activity */}
          <aside className="col-span-3 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Decision Queue
                </div>
                <span className="text-[9px] text-gray-400">{ACTION_QUEUE.length} items</span>
              </div>
              <div className="space-y-1.5">
                {ACTION_QUEUE.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.id} className={`w-full text-left rounded-md border p-2 hover:bg-orange-50/30 transition-colors ${
                      a.urgent ? "border-orange-200 bg-orange-50/40" : "border-gray-200 bg-white"
                    }`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${a.urgent ? "text-orange-600" : "text-gray-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-gray-900 leading-tight">{a.label}</div>
                          {a.urgent && <div className="text-[9px] font-bold uppercase text-orange-700 mt-0.5">priority</div>}
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                <History className="w-3 h-3" /> Done in this session
              </div>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { t: "08:46", a: "Posted 4 JEs · held 1 (Walmart Q2)", tone: "green" },
                  { t: "08:43", a: "Approved JE batch CRP-STACK", tone: "green" },
                  { t: "08:42", a: "Started Apr close session", tone: "blue" },
                ].map((e, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 w-9">{e.t}</span>
                    <CheckCircle2 className={`w-3 h-3 flex-shrink-0 mt-0.5 ${e.tone === "green" ? "text-green-500" : "text-blue-500"}`} />
                    <span className="flex-1 text-gray-700">{e.a}</span>
                  </div>
                ))}
              </div>
              <button className="w-full text-[10px] text-orange-600 hover:underline mt-2 text-center">View full audit trail →</button>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100/40 border border-orange-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Time to Lock estimate
              </div>
              <div className="text-2xl font-bold text-orange-900">~ 47 min</div>
              <div className="text-[10px] text-orange-800 mt-1">
                Based on the 5 decisions remaining and your average decision time (8 min). You'd Lock at 14:21 today vs Day 4 historical avg.
              </div>
            </div>
          </aside>
        </div>

        <div className="text-[10px] text-gray-400 text-center pt-1">
          Conversation-led · LedgerIQ proposes, you decide · every approve/reject is logged
        </div>
      </div>
    </div>
  );
}
