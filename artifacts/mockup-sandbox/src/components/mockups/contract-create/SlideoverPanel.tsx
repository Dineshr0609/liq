import { useState } from "react";
import { X, FileText, Calendar, ChevronDown, Sparkles } from "lucide-react";

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

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "INR"];

export function SlideoverPanel() {
  const [name, setName] = useState("");
  const [flowType, setFlowType] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveStart, setEffectiveStart] = useState("");
  const [effectiveEnd, setEffectiveEnd] = useState("");
  const [description, setDescription] = useState("");

  const descMax = 280;

  return (
    <div className="min-h-screen bg-zinc-100/60">
      {/* Page behind the panel — dimmed, suggests Contracts list */}
      <div className="absolute inset-0 bg-zinc-100">
        <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-3">
          <div className="text-sm font-semibold text-zinc-900">Contracts</div>
          <span className="text-xs text-zinc-400">›</span>
          <div className="text-xs text-zinc-500">156 contracts</div>
          <button className="ml-auto text-xs px-3 py-1.5 rounded bg-orange-500 text-white font-medium">
            + New Contract
          </button>
        </div>
        <div className="p-6 space-y-2 opacity-40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-white border border-zinc-200" />
          ))}
        </div>
      </div>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" />

      {/* Slide-over */}
      <aside className="fixed right-0 top-0 bottom-0 w-[460px] bg-white border-l border-zinc-200 shadow-2xl flex flex-col">
        {/* Header */}
        <header className="px-5 py-4 border-b border-zinc-200 flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-zinc-900">New Contract</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Captures the basics. You'll fill the rest on the Overview.
            </div>
          </div>
          <button className="text-zinc-400 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Contract Name */}
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
          </div>

          {/* Flow Type */}
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
                <option value="">Select a flow type…</option>
                {FLOW_TYPES.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} — {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Subflow is set later from the Rules tab.
            </p>
          </div>

          {/* Counterparty */}
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
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              You can add more parties from the Parties tab later.
            </p>
          </div>

          {/* Currency + Start + End — three-up row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Currency <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none appearance-none bg-white pr-7"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Start
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={effectiveStart}
                  onChange={(e) => setEffectiveStart(e.target.value)}
                  placeholder="MM-DD-YYYY"
                  className="w-full px-2.5 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none pr-7"
                />
                <Calendar className="absolute right-1.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                End
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={effectiveEnd}
                  onChange={(e) => setEffectiveEnd(e.target.value)}
                  placeholder="MM-DD-YYYY"
                  className="w-full px-2.5 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none pr-7"
                />
                <Calendar className="absolute right-1.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 -mt-3">
            Dates optional — set or change later on the Overview.
          </p>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <span className="text-[10px] text-zinc-400">
                {description.length}/{descMax}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, descMax))}
              rows={3}
              placeholder="One or two lines about what this contract covers…"
              className="w-full px-3 py-2 text-sm rounded border border-zinc-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none resize-none"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Shown as the Contract Summary on the Overview when there's no AI summary yet.
            </p>
          </div>

          {/* What happens next */}
          <div className="mt-2 p-3 rounded-md border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 mb-2">
              <Sparkles className="h-3 w-3 text-orange-500" />
              What happens next
            </div>
            <ol className="space-y-1.5 text-[11px] text-zinc-600 list-decimal list-inside">
              <li>Contract is saved as <span className="font-medium text-zinc-900">Draft</span>.</li>
              <li>You land on the Contract Overview.</li>
              <li>The <span className="font-medium text-zinc-900">Pending Items</span> checklist guides you through the rest.</li>
              <li>Once green, you can move it from Draft → Active.</li>
            </ol>
          </div>
        </div>

        {/* Sticky footer */}
        <footer className="px-5 py-3 border-t border-zinc-200 bg-white flex items-center justify-end gap-2">
          <button className="text-xs px-3 py-2 rounded text-zinc-600 hover:text-zinc-900">
            Cancel
          </button>
          <button
            disabled={!name || !flowType || !counterparty || !currency}
            className="text-xs px-4 py-2 rounded bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:bg-zinc-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Create Draft Contract
          </button>
        </footer>
      </aside>
    </div>
  );
}
