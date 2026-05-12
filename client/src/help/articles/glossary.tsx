import { useMemo, useState } from "react";
import { H2, P } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "glossary",
  title: "Glossary",
  category: "Reference",
  summary: "Definitions for every LicenseIQ-specific term.",
  tags: ["glossary", "definitions", "terms"],
  updatedAt: "2026-04-21",
};

const TERMS: Array<{ term: string; definition: string }> = [
  { term: "Accrual", definition: "A booked liability for fees earned in a period but not yet paid out. Auto-created when a calculation completes." },
  { term: "Active", definition: "A contract status meaning it is fully verified and live in the calculation engine." },
  { term: "Approve & Activate", definition: "The single action that promotes a fully-reviewed contract to Active. Gated by a readiness checklist." },
  { term: "Base Metric", definition: "The numeric column from your sales data that a rule multiplies its rate against (net_sales, gross_sales, units_sold, etc)." },
  { term: "Base Rate", definition: "The percentage or fixed amount applied by a rule before any tier or adjustment logic." },
  { term: "Calculation Frequency", definition: "How often the rule runs — monthly, quarterly, annual." },
  { term: "Contract Fee", definition: "The generic term for any monetary obligation under a contract — royalty, rebate, commission, etc. Used everywhere in the UI." },
  { term: "Execution Group", definition: "Bundles rules that should run together (e.g. all earnings rules before any deductions)." },
  { term: "liQ AI", definition: "The RAG-powered assistant. Answers questions about a specific contract or about LicenseIQ in general." },
  { term: "Master Data Mapping", definition: "Linking a free-text reference (product name from the contract) to a structured record in your ERP master data." },
  { term: "Milestone Tiered", definition: "A rule type where rates change at cumulative thresholds. Supports retroactive (whole) or stepped (marginal) modes." },
  { term: "Qualifier", definition: "A condition on a rule — field, op, value, group. ANDed within a group, ORed across groups. Decides which sales the rule applies to." },
  { term: "Readiness Checklist", definition: "The set of gates a contract must pass to be activated — required parties, verified rules, complete snapshot." },
  { term: "Recoupment", definition: "Paying down a prior advance or minimum guarantee from earned royalties before any new payout." },
  { term: "Reprocess", definition: "Re-runs the AI extraction pipeline on the original document. Replaces previous AI output (your manual edits stay)." },
  { term: "Revise", definition: "Opens a fresh editable version of an active contract without disturbing the live one. Approve to publish the change." },
  { term: "Rule Type", definition: "The math template — percentage, fixed, tiered, milestone_tiered, etc." },
  { term: "Sale → Many Contracts", definition: "Architecture where a single sale row can generate fees on multiple contracts independently via the matches junction table." },
  { term: "Smart Linking", definition: "The AI step that matches extracted product/customer names to your master data, with a confidence score." },
  { term: "Verified", definition: "A rule status (green badge). Only verified rules participate in calculations." },
];

export const searchText = TERMS.map((t) => `${t.term} ${t.definition}`).join(" ");

export default function Article() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return TERMS;
    return TERMS.filter((t) => t.term.toLowerCase().includes(s) || t.definition.toLowerCase().includes(s));
  }, [q]);
  return (
    <div>
      <P>Quick reference for every LicenseIQ-specific term. Search to filter.</P>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter terms…"
        className="w-full text-sm px-3 py-2 rounded-md border border-zinc-200 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-200 mb-4"
        data-testid="input-glossary-filter"
      />
      <H2>Terms</H2>
      <dl className="space-y-3">
        {filtered.map((t) => (
          <div key={t.term} className="border-b border-zinc-100 pb-3">
            <dt className="font-semibold text-zinc-900 text-sm">{t.term}</dt>
            <dd className="text-sm text-zinc-700 mt-0.5">{t.definition}</dd>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-sm text-zinc-500">No matches.</div>}
      </dl>
    </div>
  );
}
