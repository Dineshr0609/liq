import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Circle,
  FileText,
  Check,
} from "lucide-react";

const FLOW_TYPES = [
  { code: "VRP", label: "Vendor Rebate Program", desc: "Rebates earned from vendors based on purchase volume." },
  { code: "CRP", label: "Customer Rebate Program", desc: "Rebates owed to customers based on sales." },
  { code: "RLA", label: "Royalty / License Agreement", desc: "Royalty fees on licensed IP, content, or product." },
  { code: "SUB", label: "Subscription / SaaS", desc: "Recurring subscription fees with optional usage tiers." },
  { code: "RSM", label: "Reseller / Marketplace", desc: "Commission and fee splits with resellers and platforms." },
  { code: "OEM", label: "OEM / White-label", desc: "OEM, white-label, or component supply arrangements." },
];

const COUNTERPARTIES = [
  "Acme Distribution Inc.",
  "TechSound Audio LLC",
  "Pacific Resellers Co.",
  "Nordic Streaming AB",
  "Global Music Publishing",
];

export function MiniWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [flowType, setFlowType] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [effectiveStart, setEffectiveStart] = useState("");

  const canNext1 = !!name && !!flowType;
  const canNext2 = !!counterparty;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">L</div>
        <div className="text-sm font-semibold text-zinc-900">LicenseIQ</div>
        <div className="ml-auto text-xs text-zinc-500">TechSound Audio Inc. [owner]</div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <button className="text-[11px] text-zinc-500 hover:text-orange-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" />
          Back to Contracts
        </button>

        <h1 className="text-2xl font-semibold text-zinc-900">New Contract</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6">
          Two quick steps. The rest happens on the Overview.
        </p>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Identity" },
            { n: 2, label: "Counterparty" },
            { n: 3, label: "Review" },
          ].map((s, idx) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : s.n}
                </div>
                <div
                  className={`text-xs font-medium ${
                    active ? "text-zinc-900" : done ? "text-emerald-700" : "text-zinc-400"
                  }`}
                >
                  {s.label}
                </div>
                {idx < 2 && <div className="w-8 h-px bg-zinc-200 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {/* Step 1 — Identity */}
          {step === 1 && (
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
                  Auto-generated ID: <span className="font-mono text-zinc-700">CNT-2026-049</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">
                  Flow Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FLOW_TYPES.map((f) => {
                    const selected = flowType === f.code;
                    return (
                      <button
                        key={f.code}
                        onClick={() => setFlowType(f.code)}
                        className={`text-left px-3 py-2.5 rounded border transition ${
                          selected
                            ? "border-orange-500 bg-orange-50"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="text-xs font-semibold text-zinc-900">
                          {f.code} <span className="font-normal text-zinc-600">— {f.label}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                          {f.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Subflow comes later, in the Rules tab.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 — Counterparty */}
          {step === 2 && (
            <div className="px-6 py-5 space-y-5">
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
                  You can add more parties from the Parties tab later.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Effective Start
                </label>
                <div className="relative max-w-xs">
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
          )}

          {/* Step 3 — Review + Pending Items preview */}
          {step === 3 && (
            <div className="px-6 py-5">
              <div className="text-xs font-semibold text-zinc-700 mb-3 inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" /> Review
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <div>
                  <dt className="text-zinc-500">Contract Name</dt>
                  <dd className="text-zinc-900 font-medium">{name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Flow Type</dt>
                  <dd className="text-zinc-900 font-medium">{flowType || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Counterparty</dt>
                  <dd className="text-zinc-900 font-medium">{counterparty || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Effective Start</dt>
                  <dd className="text-zinc-900 font-medium">{effectiveStart || "Not set"}</dd>
                </div>
              </dl>

              <div className="mt-5 p-3 rounded-md border border-zinc-200 bg-zinc-50">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium mb-2">
                  Pending after creation
                </div>
                <ul className="space-y-1.5 text-[11px]">
                  {[
                    "Choose a subflow under Rules",
                    "Confirm primary owning party",
                    "Set effective end date",
                    "Add at least one calculation rule",
                    "Attach supporting documents (optional)",
                  ].map((label) => (
                    <li key={label} className="flex items-center gap-2 text-zinc-700">
                      <Circle className="h-3 w-3 text-zinc-300" />
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 text-[11px] text-zinc-500">
                  Activation (Draft → Active) is gated on this checklist.
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <button
              disabled={step === 1}
              onClick={() => setStep((s) => (s === 2 ? 1 : s === 3 ? 2 : s))}
              className="text-xs px-3 py-2 rounded text-zinc-600 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>

            {step < 3 ? (
              <button
                disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="text-xs px-4 py-2 rounded bg-zinc-900 text-white font-medium hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                Next <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <button className="text-xs px-4 py-2 rounded bg-orange-500 text-white font-medium hover:bg-orange-600 inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Create Draft Contract
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
