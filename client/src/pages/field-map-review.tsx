import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import {
  ChevronRight, GitMerge, CheckCircle2, AlertTriangle, Sparkles, Bot, Wand2,
  ArrowRight, Plus, Settings, Save, Eye, Database, Plug, Filter, Search, X,
  Lightbulb, RefreshCw, Lock, Star, Code2, Calendar, Hash, Type as TypeIcon,
  ToggleLeft, Link as LinkIcon, AlertOctagon, History, ShieldCheck,
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
  const map: Record<string, any> = { string: TypeIcon, number: Hash, decimal: Hash, date: Calendar, boolean: ToggleLeft, fk: LinkIcon, enum: Code2 };
  const Icon = map[t] || TypeIcon;
  return <Icon className="h-2.5 w-2.5" />;
}

function TypeChip({ t }: { t: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
      <TypeIconFor t={t} />{t}
    </span>
  );
}

type Mapping = {
  id: string; src: string; srcType: string; samples: string[];
  dest: string | null; destType: string; destDesc?: string;
  confidence: Confidence; score?: number; transform?: string; note?: string;
  alts?: { dest: string; score: number }[];
};

// Phase B: replace with real mapping data from server/services/fieldMappingService.ts
// once the connector ingestion lane is live. For now, this page is a preview of the
// design with realistic sample data illustrating each mapping state.
const sampleMappings: Mapping[] = [
  { id: "m01", src: "OpportunityId", srcType: "string", samples: ["006Hp00001AbCdE", "006Hp00001FgHiJ"], dest: "contracts.external_id", destType: "string", destDesc: "External system reference", confidence: "auto", score: 100, transform: "Direct copy", note: "Exact match — used as primary key from Salesforce" },
  { id: "m02", src: "AccountName", srcType: "string", samples: ["Acme Industries", "Northwind Traders"], dest: "contracts.counterparty_name", destType: "string", destDesc: "Counterparty (legal name)", confidence: "auto", score: 98, transform: "Direct copy + party-master lookup", note: "Auto-linked to partner master" },
  { id: "m03", src: "Amount", srcType: "decimal", samples: ["2400000.00", "1100000.00"], dest: "contracts.contract_value", destType: "decimal", destDesc: "Total contract value (TCV)", confidence: "auto", score: 99, transform: "Direct copy · USD assumed" },
  { id: "m04", src: "CloseDate", srcType: "date", samples: ["2026-04-12", "2026-03-31"], dest: "contracts.effective_start", destType: "date", destDesc: "Contract effective start date", confidence: "auto", score: 95, transform: "ISO-8601 → date" },
  { id: "m05", src: "ContractEndDate__c", srcType: "date", samples: ["2026-12-31", "2027-03-31"], dest: "contracts.effective_end", destType: "date", destDesc: "Contract effective end date", confidence: "auto", score: 98 },
  { id: "m06", src: "rebate_tier", srcType: "string", samples: ["Tier-2", "Tier-1"], dest: "contracts.tier_id", destType: "fk", destDesc: "FK → rebate_tiers.code", confidence: "suggested", score: 94, transform: "Strip 'Tier-' prefix → lookup", note: "Mapper inferred from value pattern.", alts: [{ dest: "contracts.custom_tier_label", score: 71 }] },
  { id: "m07", src: "ship_terms", srcType: "string", samples: ["FOB Origin", "Net 30"], dest: null, destType: "—", confidence: "needs-you", note: "No clear destination. Mixed concepts (Incoterms + payment terms).", alts: [{ dest: "contracts.payment_terms", score: 62 }, { dest: "Ignore", score: 0 }] },
  { id: "m08", src: "Probability", srcType: "decimal", samples: ["100", "90"], dest: null, destType: "—", confidence: "ignored", note: "Sales-pipeline metric · not relevant to executed contracts." },
  { id: "m09", src: "renewal_terms", srcType: "string", samples: ["auto-renew · 12mo notice"], dest: null, destType: "—", confidence: "blocked", note: "Type mismatch: source is unstructured text. Validator rejects free-text into a boolean target.", alts: [{ dest: "Run AI extractor on this column", score: 0 }] },
];

export default function FieldMapReview() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: contract } = useQuery<any>({
    queryKey: ["/api/contracts", id],
    queryFn: async () => {
      const r = await fetch(`/api/contracts/${id}`);
      if (!r.ok) throw new Error("Failed to load contract");
      return r.json();
    },
    enabled: !!id,
  });

  const sourceLabel = contract?.originalName || "Connector source";
  const counts = {
    total: sampleMappings.length,
    mapped: sampleMappings.filter(m => m.dest).length,
    auto: sampleMappings.filter(m => m.confidence === "auto").length,
    suggested: sampleMappings.filter(m => m.confidence === "suggested").length,
    needs: sampleMappings.filter(m => m.confidence === "needs-you").length,
    blocked: sampleMappings.filter(m => m.confidence === "blocked").length,
    ignored: sampleMappings.filter(m => m.confidence === "ignored").length,
  };

  return (
    <MainLayout>
      <div className="bg-zinc-50 text-zinc-900 font-sans text-xs" data-testid="page-field-map-review">
        {/* Header */}
        <div className="bg-white border-b border-zinc-200">
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-1">
              <Link href="/contracts"><span className="hover:text-orange-700 cursor-pointer">Contracts</span></Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/contracts/ingest"><span className="hover:text-orange-700 cursor-pointer">Ingest</span></Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/contracts/inbox"><span className="hover:text-orange-700 cursor-pointer">Inbox</span></Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-700 font-medium">Field-Map Review</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <GitMerge className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2" data-testid="text-fm-title">
                    {sourceLabel} → LicenseIQ Contracts
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">Phase B preview</span>
                  </h1>
                  <div className="text-[11px] text-zinc-500 inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><Plug className="h-3 w-3" />Contract <span className="font-mono">{id?.slice(0, 8) || "—"}</span></span>
                    <span>·</span>
                    <span><b className="text-zinc-700">{counts.total}</b> source fields</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLocation(`/contracts/${id}`)}
                  className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"
                ><X className="h-3.5 w-3.5" />Back to contract</button>
                <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Mapping history</button>
                <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" />Save as template</button>
                <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Connector settings</button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-7 border-t border-zinc-100">
            {[
              { label: "Source fields", val: String(counts.total), sub: "from connector" },
              { label: "Mapped", val: `${counts.mapped} / ${counts.total}`, sub: `${Math.round(counts.mapped / Math.max(counts.total, 1) * 100)}% coverage` },
              { label: "Auto-accepted", val: String(counts.auto), sub: "≥95% confidence", color: "text-emerald-700" },
              { label: "Suggested", val: String(counts.suggested), sub: "75–94% — quick review", color: "text-blue-700" },
              { label: "Needs you", val: String(counts.needs), sub: "low confidence / ambiguous", color: "text-amber-700" },
              { label: "Blocked", val: String(counts.blocked), sub: "type mismatch", color: "text-rose-700" },
              { label: "Ignored", val: String(counts.ignored), sub: "excluded by rule", color: "text-zinc-500" },
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
                <span className="text-orange-700">Mapper agent:</span> Field-mapping engine ships in Phase B. This page previews the design with sample Salesforce CPQ mappings so you can see the workflow before the connector lane is live.
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                Connector ingestion (CSV, Salesforce, NetSuite, custom REST) is on the Phase B roadmap.
              </div>
            </div>
            <button disabled className="text-[11px] font-semibold text-zinc-400 cursor-not-allowed inline-flex items-center gap-1 shrink-0">
              <Wand2 className="h-3 w-3" />Re-run with template
            </button>
          </div>
        </div>

        {/* Quick-filter chip bar */}
        <div className="bg-white border-b border-zinc-200 px-5 py-2 flex items-center gap-2">
          <Filter className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Filter:</span>
          {[
            { l: "All", n: counts.total, active: true },
            { l: "Needs my action", n: counts.needs + counts.blocked, color: "amber" },
            { l: "Suggested only", n: counts.suggested, color: "blue" },
            { l: "Auto-accepted", n: counts.auto, color: "emerald" },
            { l: "Blocked", n: counts.blocked, color: "rose" },
            { l: "Ignored", n: counts.ignored },
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
          </div>
        </div>

        {/* Main: 2 columns */}
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
                {sampleMappings.map((m) => {
                  const isAttention = m.confidence === "needs-you" || m.confidence === "blocked";
                  return (
                    <tr key={m.id} className={`group ${isAttention ? "bg-amber-50/30" : "hover:bg-zinc-50"}`} data-testid={`row-mapping-${m.id}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-mono text-[11px] font-semibold text-zinc-900 break-all">{m.src}</div>
                        <div className="mt-0.5"><TypeChip t={m.srcType} /></div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[10px] text-zinc-600 font-mono leading-tight space-y-0.5">
                          {m.samples.slice(0, 2).map((s, i) => (<div key={i} className="truncate" title={s}>· {s}</div>))}
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
                        {m.confidence === "suggested" && (<>
                          <button className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 mr-2">Accept</button>
                          <button className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-900">Edit</button>
                        </>)}
                        {m.confidence === "needs-you" && (<>
                          <button className="text-[10px] font-bold text-orange-700 hover:text-orange-800 mr-2">Map →</button>
                          <button className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700">Skip</button>
                        </>)}
                        {m.confidence === "blocked" && (<button className="text-[10px] font-bold text-rose-700 hover:text-rose-800">Resolve →</button>)}
                        {m.confidence === "ignored" && (<button className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700">Include</button>)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-zinc-50 hover:bg-zinc-100">
                  <td colSpan={6} className="px-3 py-2 text-center">
                    <button className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
                      <Plus className="h-3 w-3" />Add mapping for an unmapped field…
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Side panel */}
          <aside className="w-72 shrink-0 border-l border-zinc-200 bg-zinc-50">
            <div className="p-3 border-b border-zinc-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
                <Database className="h-3 w-3" />Destination schema
              </div>
              <div className="space-y-1.5">
                {[
                  { table: "contracts", req: 8, mapped: 5, opt: 4, mapped_opt: 1, color: "amber" },
                  { table: "rules", req: 3, mapped: 0, opt: 2, mapped_opt: 0, color: "amber" },
                  { table: "contract_partners", req: 2, mapped: 1, opt: 1, mapped_opt: 0, color: "amber" },
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

            <div className="p-3 border-b border-zinc-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />Validation preview
              </div>
              <div className="bg-white border border-zinc-200 rounded p-2 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between"><span className="text-zinc-700">Will create contracts</span><span className="font-bold text-emerald-700">—</span></div>
                <div className="flex items-center justify-between"><span className="text-zinc-700">Will update existing</span><span className="font-bold text-blue-700">—</span></div>
                <div className="border-t border-zinc-100 my-1.5"></div>
                <div className="flex items-center justify-between"><span className="text-amber-700 font-semibold">Rows with warnings</span><span className="font-bold text-amber-700">—</span></div>
                <div className="flex items-center justify-between"><span className="text-rose-700 font-semibold">Rows blocked</span><span className="font-bold text-rose-700">—</span></div>
              </div>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 text-[10px] text-amber-900 leading-snug">
                <div className="font-bold mb-0.5 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Phase B</div>
                Validation engine and apply-pipeline ship alongside the connector lane.
              </div>
            </div>

            <div className="p-3 border-b border-zinc-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
                <Star className="h-3 w-3" />Mapping template
              </div>
              <div className="bg-white border border-zinc-200 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-zinc-900">No template</span>
                  <span className="text-[9px] font-semibold bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">Phase B</span>
                </div>
                <div className="text-[10px] text-zinc-500 mb-2">Save mapping decisions to reuse on future imports from the same source.</div>
                <button disabled className="w-full mt-2 text-[11px] font-bold bg-zinc-300 text-white py-1.5 rounded inline-flex items-center justify-center gap-1 cursor-not-allowed">
                  <Save className="h-3 w-3" />Save template
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 inline-flex items-center gap-1">
                <Bot className="h-3 w-3 text-orange-600" />Mapper agent assist
              </div>
              <div className="space-y-1.5">
                {[
                  { i: Wand2, t: "Auto-fix all suggested", d: "Accept all 75–94% confidence mappings at once.", c: "text-purple-600" },
                  { i: Sparkles, t: "Run AI extractor on blocked", d: "Parse free-text columns into structured fields.", c: "text-orange-600" },
                  { i: Plus, t: "Propose schema additions", d: "Source fields with no destination — add to schema?", c: "text-emerald-600" },
                  { i: Eye, t: "Diff vs. last sync", d: "Show fields that drifted since last template apply.", c: "text-blue-600" },
                ].map((a) => {
                  const Icon = a.i;
                  return (
                    <button key={a.t} disabled className="w-full text-left bg-white border border-zinc-200 rounded p-2 text-[10px] opacity-60 cursor-not-allowed">
                      <div className="font-bold text-zinc-900 inline-flex items-center gap-1"><Icon className={`h-3 w-3 ${a.c}`} />{a.t}</div>
                      <div className="text-zinc-600 mt-0.5">{a.d}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky bottom action bar */}
        <div className="bg-white border-t-2 border-amber-200 px-5 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-zinc-700">
              <span className="font-bold text-zinc-900">Phase B preview:</span> Mapping decisions and apply-pipeline are not yet live.
            </div>
            <span className="text-[10px] text-zinc-400">·</span>
            <div className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />When live, all actions will be logged · undo within 24h
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation(`/contracts/${id}`)}
              className="text-xs px-3 py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 inline-flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />Back to contract
            </button>
            <button disabled className="text-xs px-4 py-1.5 rounded-md bg-zinc-300 text-white font-bold inline-flex items-center gap-1.5 shadow-sm cursor-not-allowed">
              <CheckCircle2 className="h-3.5 w-3.5" />Apply mapping (Phase B)
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
