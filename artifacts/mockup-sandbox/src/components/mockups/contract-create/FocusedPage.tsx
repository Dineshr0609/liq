import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Circle,
  FileText,
} from "lucide-react";

const FLOW_TYPES = [
  { code: "VRP", label: "Vendor Rebate Program" },
  { code: "CRP", label: "Customer Rebate Program" },
  { code: "RLA", label: "Royalty / License Agreement" },
  { code: "SUB", label: "Subscription / SaaS" },
  { code: "RSM", label: "Reseller / Marketplace" },
  { code: "OEM", label: "OEM / White-label" },
];

const COUNTERPARTIES = [
  "Acme Distribution Inc.",
  "TechSound Audio LLC",
  "Pacific Resellers Co.",
  "Nordic Streaming AB",
  "Global Music Publishing",
];

export function FocusedPage() {
  const [name, setName] = useState("");
  const [flowType, setFlowType] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [effectiveStart, setEffectiveStart] = useState("");

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* App chrome top bar (mocked) */}
      <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">L</div>
        <div className="text-sm font-semibold text-zinc-900">LicenseIQ</div>
        <div className="ml-auto text-xs text-zinc-500">TechSound Audio Inc. [owner]</div>
      </div>

      {/* Page */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <button className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" />
          Back to Contracts
        </button>

        {/* Title block */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">New Contract</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Just the essentials. The Overview takes you the rest of the way.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Contract Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q1 2026 Distributor Rebate Program"
                className="w-full px-3 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Auto-generated contract ID: <span className="font-mono text-zinc-700">CNT-2026-049</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Flow Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={flowType}
                    onChange={(e) => setFlowType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none appearance-none bg-white pr-8"
                  >
                    <option value="">Select…</option>
                    {FLOW_TYPES.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.code} — {f.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">Subflow set in Rules.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Effective Start
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={effectiveStart}
                    onChange={(e) => setEffectiveStart(e.target.value)}
                    placeholder="MM-DD-YYYY"
                    className="w-full px-3 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
                  />
                  <Calendar className="absolute right-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">Optional.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Counterparty <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none appearance-none bg-white pr-8"
                >
                  <option value="">Select counterparty…</option>
                  {COUNTERPARTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Add more parties from the Parties tab later.
              </p>
            </div>
          </div>

          {/* Footer bar */}
          <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-orange-500" />
              Saves as <span className="font-medium text-zinc-900">Draft</span>. Activate from Overview when ready.
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs px-3 py-2 rounded text-zinc-600 hover:text-zinc-900">
                Cancel
              </button>
              <button
                disabled={!name || !flowType || !counterparty}
                className="text-xs px-4 py-2 rounded bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:bg-zinc-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Create Draft Contract
              </button>
            </div>
          </div>
        </div>

        {/* Pending items preview */}
        <div className="mt-5 bg-white border border-dashed border-zinc-300 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium mb-2">
            What you'll complete next on the Overview
          </div>
          <ul className="space-y-1.5 text-xs">
            {[
              ["Choose a subflow under Rules", false],
              ["Confirm primary owning party", false],
              ["Set effective end date", false],
              ["Add at least one calculation rule", false],
              ["Attach supporting documents (optional)", true],
            ].map(([label, done]) => (
              <li key={label as string} className="flex items-center gap-2 text-zinc-700">
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-zinc-300" />
                )}
                <span className={done ? "line-through text-zinc-400" : ""}>{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[11px] text-zinc-500">
            Activation is gated on this checklist turning green.
          </div>
        </div>
      </div>
    </div>
  );
}
