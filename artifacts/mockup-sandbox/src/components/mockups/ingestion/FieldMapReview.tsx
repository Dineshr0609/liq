import {
  ChevronRight,
  ChevronDown,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Bot,
  Wand2,
  ArrowRight,
  Plus,
  Settings,
  Save,
  Eye,
  EyeOff,
  Database,
  FileSpreadsheet,
  Plug,
  Filter,
  Search,
  X,
  Lightbulb,
  RefreshCw,
  Lock,
  Star,
  Code2,
  Calendar,
  Hash,
  Type as TypeIcon,
  ToggleLeft,
  Link as LinkIcon,
  AlertOctagon,
  History,
} from "lucide-react";

type Confidence = "auto" | "suggested" | "needs-you" | "blocked" | "ignored";

const confMeta: Record<Confidence, { label: string; bg: string; text: string; border: string; dot: string }> = {
  auto: { label: "Auto-accepted", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  suggested: { label: "Suggested", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  "needs-you": { label: "Needs you", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500" },
  blocked: { label: "Blocked", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
  ignored: { label: "Ignored", bg: "bg-zinc-100", text: "text-zinc-500", border: "border-zinc-200", dot: "bg-zinc-400" },
};

function ConfPill({ c, score }: { c: Confidence; score?: number }) {
  const m = confMeta[c];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
      {score !== undefined && <span className="font-bold ml-0.5">{score}%</span>}
    </span>
  );
}

function TypeIconFor({ t }: { t: string }) {
  const map: Record<string, any> = {
    string: TypeIcon,
    number: Hash,
    decimal: Hash,
    date: Calendar,
    boolean: ToggleLeft,
    fk: LinkIcon,
    enum: Code2,
  };
  const Icon = map[t] || TypeIcon;
  return <Icon className="h-2.5 w-2.5" />;
}

function TypeChip({ t }: { t: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
      <TypeIconFor t={t} />
      {t}
    </span>
  );
}

type Mapping = {
  id: string;
  src: string;
  srcType: string;
  samples: string[];
  dest: string | null;
  destType: string;
  destDesc?: string;
  confidence: Confidence;
  score?: number;
  transform?: string;
  note?: string;
  alts?: { dest: string; score: number }[];
};

const mappings: Mapping[] = [
  { id: "m01", src: "OpportunityId", srcType: "string", samples: ["006Hp00001AbCdE", "006Hp00001FgHiJ"], dest: "contracts.external_id", destType: "string", destDesc: "External system reference", confidence: "auto", score: 100, transform: "Direct copy", note: "Exact match — used as primary key from Salesforce" },
  { id: "m02", src: "AccountName", srcType: "string", samples: ["Acme Industries", "Northwind Traders"], dest: "contracts.counterparty_name", destType: "string", destDesc: "Counterparty (legal name)", confidence: "auto", score: 98, transform: "Direct copy + party-master lookup", note: "Auto-linked to partner master · 4/4 matched" },
  { id: "m03", src: "Amount", srcType: "decimal", samples: ["2400000.00", "1100000.00"], dest: "contracts.contract_value", destType: "decimal", destDesc: "Total contract value (TCV)", confidence: "auto", score: 99, transform: "Direct copy · USD assumed" },
  { id: "m04", src: "CloseDate", srcType: "date", samples: ["2026-04-12", "2026-03-31"], dest: "contracts.effective_start", destType: "date", destDesc: "Contract effective start date", confidence: "auto", score: 95, transform: "ISO-8601 → date", note: "Format normalized" },
  { id: "m05", src: "ContractEndDate__c", srcType: "date", samples: ["2026-12-31", "2027-03-31"], dest: "contracts.effective_end", destType: "date", destDesc: "Contract effective end date", confidence: "auto", score: 98, transform: "ISO-8601 → date" },
  { id: "m06", src: "rebate_tier", srcType: "string", samples: ["Tier-2", "Tier-1", "Tier-3"], dest: "contracts.tier_id", destType: "fk", destDesc: "FK → rebate_tiers.code", confidence: "suggested", score: 94, transform: "Strip 'Tier-' prefix → lookup", note: "Mapper inferred from value pattern. Lookup table has tiers 1-3.", alts: [{ dest: "contracts.custom_tier_label", score: 71 }, { dest: "rules.tier_code", score: 64 }] },
  { id: "m07", src: "ship_terms", srcType: "string", samples: ["FOB Origin", "Net 30", "DAP Buyer"], dest: null, destType: "—", confidence: "needs-you", note: "No clear destination. Mixed concepts (Incoterms + payment terms). Recommend splitting into shipping_terms + payment_terms.", alts: [{ dest: "contracts.payment_terms", score: 62 }, { dest: "contracts.shipping_terms (new field)", score: 58 }, { dest: "Ignore", score: 0 }] },
  { id: "m08", src: "parent_acct", srcType: "string", samples: ["001Hp00002XyZaB", "001Hp00002LmNoP"], dest: null, destType: "—", confidence: "needs-you", note: "Looks like a Salesforce Account ID. May represent ultimate parent (group company). Currently no field for this in LicenseIQ.", alts: [{ dest: "contracts.group_parent_id (new field)", score: 88 }, { dest: "Ignore", score: 0 }] },
  { id: "m09", src: "BillingCountry", srcType: "string", samples: ["United States", "Germany", "Brazil"], dest: "contracts.billing_country", destType: "string", destDesc: "Billing country (ISO-3166)", confidence: "suggested", score: 91, transform: "Country name → ISO-3166 alpha-2 (US, DE, BR)", note: "Will normalize to ISO codes. Brazil flagged for currency rule (BRL)." },
  { id: "m10", src: "PriceBookEntry.UnitPrice", srcType: "decimal", samples: ["1499.00", "899.50"], dest: "rules.unit_price", destType: "decimal", destDesc: "Unit price in pricing rule", confidence: "auto", score: 96, transform: "Direct copy" },
  { id: "m11", src: "Discount__c", srcType: "decimal", samples: ["0.15", "0.20", "0.05"], dest: "rules.discount_rate", destType: "decimal", destDesc: "Discount rate (0-1)", confidence: "auto", score: 97, transform: "Direct copy · interpreted as fraction (15% = 0.15)" },
  { id: "m12", src: "Owner.Name", srcType: "string", samples: ["Sarah Reynolds", "Marcus Tan"], dest: "contracts.execution_owner", destType: "fk", destDesc: "FK → users (party role: execution_owner)", confidence: "suggested", score: 86, transform: "Name → user-master lookup", note: "Will match by full name; 1 row failed (Marcus Tan → ambiguous, 2 users)" },
  { id: "m13", src: "Probability", srcType: "decimal", samples: ["100", "90", "75"], dest: null, destType: "—", confidence: "ignored", note: "Sales-pipeline metric · not relevant to executed contracts. Excluded by default." },
  { id: "m14", src: "Description", srcType: "string", samples: ["3-yr renewal · auto-renews · ...", "Net new · 2-yr term · ..."], dest: "contracts.notes", destType: "string", destDesc: "Free-form notes", confidence: "auto", score: 92, transform: "Direct copy" },
  { id: "m15", src: "CreatedDate", srcType: "date", samples: ["2026-04-10T14:22:00Z", "2026-03-15T09:15:00Z"], dest: null, destType: "—", confidence: "ignored", note: "System timestamp · LicenseIQ stamps its own ingestion time. Excluded." },
  { id: "m16", src: "Currency_ISO__c", srcType: "string", samples: ["USD", "EUR", "BRL"], dest: "contracts.currency_code", destType: "string", destDesc: "ISO-4217 currency", confidence: "auto", score: 100 },
  { id: "m17", src: "renewal_terms", srcType: "string", samples: ["auto-renew · 12mo notice", "manual"], dest: null, destType: "—", confidence: "blocked", note: "Type mismatch: source is unstructured text. Validator rejects free-text into a boolean target. Suggest creating renewal_clause_text + auto_renew (boolean) — extract from text.", alts: [{ dest: "Run AI extractor on this column", score: 0 }] },
  { id: "m18", src: "regional_split", srcType: "string", samples: ['{"US":0.6,"EU":0.4}', '{"US":1.0}'], dest: null, destType: "—", confidence: "needs-you", note: "JSON in a string column. Should expand into multiple rows per region or stay as JSONB. Affects calculation engine.", alts: [{ dest: "contracts.regional_allocations (jsonb)", score: 79 }, { dest: "Expand to 1 row per region", score: 73 }] },
];

export default function FieldMapReview() {
  return (
    <div className="bg-zinc-50 text-zinc-900 font-sans text-xs">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-1">
            <span>Contracts</span><ChevronRight className="h-3 w-3" /><span>Ingest</span><ChevronRight className="h-3 w-3" /><span>Inbox</span><ChevronRight className="h-3 w-3" /><span className="text-zinc-700 font-medium">Field-Map Review</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <GitMerge className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  Salesforce CPQ → LicenseIQ Contracts
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wide">Field-Map lane</span>
                </h1>
                <div className="text-[11px] text-zinc-500 inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><Plug className="h-3 w-3" />Connector · sync_id <span className="font-mono">SF-2026-0418-1042</span></span>
                  <span>·</span>
                  <span><b className="text-zinc-700">12</b> records · <b className="text-zinc-700">22</b> source fields · pulled <b className="text-zinc-700">4 min ago</b></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Mapping history</button>
              <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" />Save as template</button>
              <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Connector settings</button>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-7 border-t border-zinc-100">
          {[
            { label: "Source fields", val: "22", sub: "from connector" },
            { label: "Mapped", val: "18 / 22", sub: "82% coverage" },
            { label: "Auto-accepted", val: "11", sub: "≥95% confidence", color: "text-emerald-700" },
            { label: "Suggested", val: "3", sub: "75–94% — quick review", color: "text-blue-700" },
            { label: "Needs you", val: "3", sub: "low confidence / ambiguous", color: "text-amber-700" },
            { label: "Blocked", val: "1", sub: "type mismatch", color: "text-rose-700" },
            { label: "Ignored", val: "2", sub: "excluded by rule", color: "text-zinc-500" },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 border-r border-zinc-100 last:border-r-0">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">{s.label}</div>
              <div className={`text-base font-bold leading-tight ${s.color || "text-zinc-900"}`}>{s.val}</div>
              <div className="text-[10px] text-zinc-500">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Mapper agent banner */}
        <div className="bg-gradient-to-r from-orange-50 via-orange-50 to-emerald-50/40 border-t border-orange-100 px-5 py-2.5 flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-zinc-900">
              <span className="text-orange-700">Mapper agent:</span> I've auto-mapped 11 fields, suggested 3 with high confidence, and need your help on 4 (3 ambiguous + 1 blocked). I also recognized this Salesforce CPQ schema — applied your <button className="text-orange-700 underline font-bold">"SF-CPQ Standard v2"</button> template as the starting point.
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              Estimated time to complete review: <b>3–5 min</b> · Mapping will become a template for future SF-CPQ imports.
            </div>
          </div>
          <button className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 inline-flex items-center gap-1 shrink-0">
            <Wand2 className="h-3 w-3" />Re-run with different template
          </button>
        </div>
      </div>

      {/* Quick-filter chip bar */}
      <div className="bg-white border-b border-zinc-200 px-5 py-2 flex items-center gap-2">
        <Filter className="h-3 w-3 text-zinc-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Filter:</span>
        {[
          { l: "All", n: 22, active: true },
          { l: "Needs my action", n: 4, color: "amber" },
          { l: "Suggested only", n: 3, color: "blue" },
          { l: "Auto-accepted", n: 11, color: "emerald" },
          { l: "Blocked", n: 1, color: "rose" },
          { l: "Ignored", n: 2 },
        ].map((c) => {
          const colorMap: Record<string, string> = { amber: "bg-amber-100 text-amber-800 border-amber-300", blue: "bg-blue-100 text-blue-800 border-blue-300", emerald: "bg-emerald-100 text-emerald-800 border-emerald-300", rose: "bg-rose-100 text-rose-800 border-rose-300" };
          return (
            <button key={c.l} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.active ? "bg-orange-100 text-orange-800 border-orange-300" : c.color ? colorMap[c.color] : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
              {c.l} <span className="font-bold">{c.n}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input placeholder="Find field…" className="text-[11px] pl-6 pr-2 py-1 rounded border border-zinc-200 w-48 focus:outline-none focus:border-emerald-400" />
          </div>
          <label className="text-[10px] text-zinc-600 inline-flex items-center gap-1 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded h-3 w-3" />Show samples
          </label>
        </div>
      </div>

      {/* Main: 2 columns (mapping table + side panel) */}
      <div className="flex">
        {/* Mapping table */}
        <div className="flex-1 min-w-0 bg-white">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200 sticky top-0">
              <tr>
                <th className="text-left font-semibold px-3 py-2 w-[260px]">Source field</th>
                <th className="text-left font-semibold px-2 py-2 w-[180px]">Sample values</th>
                <th className="text-center font-semibold px-2 py-2 w-8"></th>
                <th className="text-left font-semibold px-2 py-2">Destination (LicenseIQ)</th>
                <th className="text-left font-semibold px-2 py-2 w-[140px]">Status</th>
                <th className="text-right font-semibold px-3 py-2 w-[120px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {mappings.map((m) => {
                const cm = confMeta[m.confidence];
                const isAttention = m.confidence === "needs-you" || m.confidence === "blocked";
                return (
                  <>
                    <tr key={m.id} className={`group ${isAttention ? "bg-amber-50/30" : "hover:bg-zinc-50"}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-mono text-[11px] font-semibold text-zinc-900 break-all">{m.src}</div>
                        <div className="mt-0.5"><TypeChip t={m.srcType} /></div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[10px] text-zinc-600 font-mono leading-tight space-y-0.5">
                          {m.samples.slice(0, 2).map((s, i) => (
                            <div key={i} className="truncate" title={s}>· {s}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-1 py-2 align-top text-center">
                        <ArrowRight className={`h-3.5 w-3.5 inline ${m.dest ? "text-zinc-400" : "text-rose-400"}`} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        {m.dest ? (
                          <>
                            <div className="font-mono text-[11px] font-semibold text-emerald-800 inline-flex items-center gap-1">
                              {m.dest}
                              <TypeChip t={m.destType} />
                            </div>
                            {m.destDesc && <div className="text-[10px] text-zinc-500 mt-0.5">{m.destDesc}</div>}
                            {m.transform && (
                              <div className="text-[10px] text-zinc-600 mt-0.5 inline-flex items-center gap-1">
                                <RefreshCw className="h-2.5 w-2.5 text-purple-600" />
                                <span className="text-purple-700 font-semibold">Transform:</span> {m.transform}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="italic text-[11px] text-amber-700 font-semibold inline-flex items-center gap-1">
                            <AlertOctagon className="h-3 w-3" />
                            {m.confidence === "ignored" ? "Excluded" : "No mapping yet"}
                          </div>
                        )}
                        {m.note && (
                          <div className={`text-[10px] mt-1 px-1.5 py-1 rounded inline-flex items-start gap-1 max-w-[420px] ${m.confidence === "blocked" ? "bg-rose-50 text-rose-800 border border-rose-200" : isAttention ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-zinc-50 text-zinc-600 border border-zinc-100"}`}>
                            <Lightbulb className="h-2.5 w-2.5 mt-0.5 shrink-0 text-orange-500" />
                            <span className="leading-snug">{m.note}</span>
                          </div>
                        )}
                        {m.alts && m.alts.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] uppercase tracking-wide text-zinc-400 font-semibold">Alternatives:</span>
                            {m.alts.map((a) => (
                              <button key={a.dest} className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 hover:border-blue-400 hover:bg-blue-100 px-1.5 py-0.5 rounded">
                                {a.dest} {a.score > 0 && <span className="font-bold">{a.score}%</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <ConfPill c={m.confidence} score={m.score} />
                      </td>
                      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                        {m.confidence === "auto" && <span className="text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Locked in</span>}
                        {m.confidence === "suggested" && (
                          <>
                            <button className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 mr-2">Accept</button>
                            <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900">Edit</button>
                          </>
                        )}
                        {m.confidence === "needs-you" && (
                          <>
                            <button className="text-[10px] font-bold text-orange-700 hover:text-orange-800 mr-2">Map →</button>
                            <button className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700">Skip</button>
                          </>
                        )}
                        {m.confidence === "blocked" && (
                          <button className="text-[10px] font-bold text-rose-700 hover:text-rose-800">Resolve →</button>
                        )}
                        {m.confidence === "ignored" && (
                          <button className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700">Include</button>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })}
              {/* Add row */}
              <tr className="bg-zinc-50 hover:bg-zinc-100">
                <td colSpan={6} className="px-3 py-2 text-center">
                  <button className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" />Add mapping for an unmapped field…
                  </button>
                  <span className="ml-2 text-[10px] text-zinc-500">(0 unmapped source fields remain — every field has been triaged)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Side panel */}
        <aside className="w-72 shrink-0 border-l border-zinc-200 bg-zinc-50">
          {/* Side panel: schema target overview */}
          <div className="p-3 border-b border-zinc-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
              <Database className="h-3 w-3" />Destination schema
            </div>
            <div className="space-y-1.5">
              {[
                { table: "contracts", req: 8, mapped: 8, opt: 4, mapped_opt: 3, color: "emerald" },
                { table: "rules", req: 3, mapped: 3, opt: 2, mapped_opt: 2, color: "emerald" },
                { table: "contract_partners", req: 2, mapped: 2, opt: 1, mapped_opt: 0, color: "amber" },
                { table: "rebate_tiers (lookup)", req: 0, mapped: 0, opt: 1, mapped_opt: 1, color: "emerald" },
              ].map((t) => {
                const reqDone = t.mapped === t.req;
                return (
                  <div key={t.table} className="bg-white border border-zinc-200 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-zinc-900 font-mono truncate">{t.table}</span>
                      <CheckCircle2 className={`h-3 w-3 ${reqDone ? "text-emerald-500" : "text-amber-500"}`} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`font-bold ${reqDone ? "text-emerald-700" : "text-amber-700"}`}>
                        {t.mapped}/{t.req} required
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-600">{t.mapped_opt}/{t.opt} optional</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side panel: validation preview */}
          <div className="p-3 border-b border-zinc-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />Validation preview
            </div>
            <div className="bg-white border border-zinc-200 rounded p-2 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-700">Will create contracts</span>
                <span className="font-bold text-emerald-700">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-700">Will update existing</span>
                <span className="font-bold text-blue-700">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-700">Will create new parties</span>
                <span className="font-bold text-purple-700">2</span>
              </div>
              <div className="border-t border-zinc-100 my-1.5"></div>
              <div className="flex items-center justify-between">
                <span className="text-amber-700 font-semibold">Rows with warnings</span>
                <span className="font-bold text-amber-700">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-700 font-semibold">Rows blocked</span>
                <span className="font-bold text-rose-700">1</span>
              </div>
            </div>
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 text-[10px] text-amber-900 leading-snug">
              <div className="font-bold mb-0.5 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />1 row will be held back</div>
              "Helix Pharma — APAC Supply" has <code className="bg-white/60 px-0.5 rounded">renewal_terms</code> mapping blocked. Resolve before applying or this row is skipped.
            </div>
          </div>

          {/* Side panel: template management */}
          <div className="p-3 border-b border-zinc-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
              <Star className="h-3 w-3" />Mapping template
            </div>
            <div className="bg-white border border-zinc-200 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-zinc-900">SF-CPQ Standard v2</span>
                <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">In use</span>
              </div>
              <div className="text-[10px] text-zinc-500 mb-2">19 of 22 fields covered · last updated by you 12 days ago</div>
              <div className="text-[10px] text-zinc-700 mb-1">If you save this session:</div>
              <ul className="text-[10px] text-zinc-700 space-y-0.5 leading-snug ml-3 list-disc">
                <li><b>+3 new mappings</b> will be added to the template</li>
                <li><b>1 existing mapping changed</b> (parent_acct → group_parent_id)</li>
                <li>Future SF-CPQ imports will auto-apply this</li>
              </ul>
              <button className="w-full mt-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded inline-flex items-center justify-center gap-1">
                <Save className="h-3 w-3" />Save updated template
              </button>
              <button className="w-full mt-1 text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 py-1 inline-flex items-center justify-center gap-1">
                <Plus className="h-3 w-3" />Save as new template…
              </button>
            </div>
          </div>

          {/* Side panel: agent assist */}
          <div className="p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
              <Bot className="h-3 w-3 text-orange-600" />Mapper agent assist
            </div>
            <div className="space-y-1.5">
              <button className="w-full text-left bg-white hover:bg-orange-50 border border-zinc-200 hover:border-orange-300 rounded p-2 text-[10px]">
                <div className="font-bold text-zinc-900 inline-flex items-center gap-1"><Wand2 className="h-3 w-3 text-purple-600" />Auto-fix all suggested (3)</div>
                <div className="text-zinc-600 mt-0.5">Accept all 75–94% confidence mappings at once.</div>
              </button>
              <button className="w-full text-left bg-white hover:bg-orange-50 border border-zinc-200 hover:border-orange-300 rounded p-2 text-[10px]">
                <div className="font-bold text-zinc-900 inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-orange-600" />Run AI extractor on blocked field</div>
                <div className="text-zinc-600 mt-0.5">Parse renewal_terms text into auto_renew + notice_period.</div>
              </button>
              <button className="w-full text-left bg-white hover:bg-orange-50 border border-zinc-200 hover:border-orange-300 rounded p-2 text-[10px]">
                <div className="font-bold text-zinc-900 inline-flex items-center gap-1"><Plus className="h-3 w-3 text-emerald-600" />Propose schema additions</div>
                <div className="text-zinc-600 mt-0.5">2 source fields have no destination. Add to LicenseIQ schema?</div>
              </button>
              <button className="w-full text-left bg-white hover:bg-orange-50 border border-zinc-200 hover:border-orange-300 rounded p-2 text-[10px]">
                <div className="font-bold text-zinc-900 inline-flex items-center gap-1"><Eye className="h-3 w-3 text-blue-600" />Show me what changes vs. last sync</div>
                <div className="text-zinc-600 mt-0.5">2 fields drifted since last template apply.</div>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom: record preview before apply */}
      <div className="border-t border-zinc-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-zinc-900 inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />Preview: first 4 records that will be created
            <span className="text-[10px] font-normal text-zinc-500">({mappings.filter(m => m.dest && m.confidence !== "blocked").length} fields applied per row)</span>
          </h3>
          <div className="flex items-center gap-1.5">
            <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900">View all 12 →</button>
            <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 inline-flex items-center gap-0.5">
              <Code2 className="h-2.5 w-2.5" />Show as JSON
            </button>
          </div>
        </div>
        <div className="border border-zinc-200 rounded overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold">external_id</th>
                <th className="text-left px-2 py-1.5 font-semibold">counterparty_name</th>
                <th className="text-right px-2 py-1.5 font-semibold">contract_value</th>
                <th className="text-left px-2 py-1.5 font-semibold">currency</th>
                <th className="text-left px-2 py-1.5 font-semibold">effective_start → end</th>
                <th className="text-left px-2 py-1.5 font-semibold">tier_id</th>
                <th className="text-left px-2 py-1.5 font-semibold">billing_country</th>
                <th className="text-center px-2 py-1.5 font-semibold">Will create</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                { id: "006Hp00001AbCdE", cp: "Acme Industries", v: "$2,400,000", cur: "USD", dates: "Apr 12, 2026 → Dec 31, 2026", tier: "tier-2", country: "US", ok: "ok" },
                { id: "006Hp00001FgHiJ", cp: "Northwind Traders", v: "$1,100,000", cur: "USD", dates: "Mar 31, 2026 → Mar 31, 2027", tier: "tier-1", country: "US", ok: "ok" },
                { id: "006Hp00001KlMnO", cp: "BrightMart Retail", v: "€840,000", cur: "EUR", dates: "Apr 1, 2026 → Mar 31, 2027", tier: "tier-3", country: "DE", ok: "ok" },
                { id: "006Hp00001PqRsT", cp: "Helix Pharma APAC", v: "$3,800,000", cur: "USD", dates: "Apr 15, 2026 → Apr 14, 2029", tier: "—", country: "BR", ok: "blocked" },
              ].map((r, i) => (
                <tr key={i} className={r.ok === "blocked" ? "bg-rose-50/40" : "hover:bg-zinc-50"}>
                  <td className="px-2 py-1.5 font-mono text-zinc-700">{r.id}</td>
                  <td className="px-2 py-1.5 font-semibold text-zinc-900">{r.cp}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-zinc-900">{r.v}</td>
                  <td className="px-2 py-1.5 text-zinc-700">{r.cur}</td>
                  <td className="px-2 py-1.5 text-zinc-700">{r.dates}</td>
                  <td className="px-2 py-1.5 font-mono text-zinc-700">{r.tier}</td>
                  <td className="px-2 py-1.5"><span className="text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1 py-0.5 rounded">{r.country}</span></td>
                  <td className="px-2 py-1.5 text-center">
                    {r.ok === "ok" ? (
                      <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />Yes</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 inline-flex items-center gap-0.5"><AlertOctagon className="h-2.5 w-2.5" />Held</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="bg-white border-t-2 border-emerald-200 px-5 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-zinc-700">
            <span className="font-bold text-zinc-900">Ready to apply:</span> 11 contracts will be created · 1 will be held until <code className="bg-zinc-100 px-1 rounded font-mono text-[10px]">renewal_terms</code> is resolved.
          </div>
          <span className="text-[10px] text-zinc-400">·</span>
          <div className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
            <Lock className="h-3 w-3" />Action will be logged · undo within 24h
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-3 py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5" />Discard sync
          </button>
          <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold inline-flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />Save draft & resume later
          </button>
          <button className="text-xs px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />Apply mapping → ingest 11 records
          </button>
        </div>
      </div>
    </div>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
