import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { H2, P, UI } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "faq",
  title: "FAQ & Troubleshooting",
  category: "FAQ & Troubleshooting",
  summary: "Common questions and the fixes for things that look stuck.",
  tags: ["faq", "troubleshooting", "errors", "help"],
  updatedAt: "2026-04-21",
};

const ITEMS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Why isn't my rule firing on incoming sales?",
    a: <P>Three usual culprits: (1) the rule isn't <UI>Verified</UI> — only green rules calculate. (2) The contract isn't <UI>Active</UI> yet. (3) The rule's qualifiers don't match the sale rows — open the rule, check the product/territory/customer qualifiers, and dry-run in the Rule Evaluation Playground.</P>,
  },
  {
    q: "My PDF won't extract — the rules tab is empty.",
    a: <P>The text extractor has a 4-tier fallback (native text → pdf.js → tesseract OCR → vision). For scanned or hand-signed PDFs, tier 3 or 4 kicks in and quality drops. Click <UI>Reprocess</UI> in the header to retry; if it's still empty, the PDF may be image-only with poor scan quality. Workaround: enter the rules manually, or upload a clearer scan.</P>,
  },
  {
    q: "What's the difference between Reprocess and Revise?",
    a: <P><UI>Reprocess</UI> re-runs the AI extraction pipeline against the original document — useful when AI parsed it wrong. <UI>Revise</UI> creates a new pending version of an already-active contract so you can edit terms without disturbing the live one. Reprocess replaces AI output; your manual edits are preserved. Revise is a versioned change.</P>,
  },
  {
    q: "Verify is greyed out / rejected with 'unmapped references'.",
    a: <P>Open the rule, scroll to the <UI>Mapping</UI> section. Every product or territory referenced by the qualifiers must be linked to a master-data record. Click <UI>Auto-map all</UI> to accept AI suggestions over 70% confidence, or pick manually for ambiguous matches. Then retry Verify.</P>,
  },
  {
    q: "Approve & Activate is greyed out.",
    a: <P>Click the readiness checklist in the page header to see which gate is failing. Common gates: required party roles missing, no verified rules, missing currency or effective dates. Fix the red item, the gate flips green, and the button lights up.</P>,
  },
  {
    q: "How does liQ AI know about my contract?",
    a: <P>When you ask a question on the contract page, we pass the contract id as page context. liQ AI fetches the structured contract data (parties, terms, rules, qualifiers) plus the original text chunks and answers from that. It will not invent terms that aren't in the contract.</P>,
  },
  {
    q: "Can I generate a PDF for a contract I entered manually?",
    a: <P>Yes — once the contract is <UI>Active</UI>, the <UI>View PDF</UI> button changes to <UI>Generate PDF</UI>. It builds a clean LicenseIQ-branded summary from the structured data.</P>,
  },
  {
    q: "A sale matched the wrong contract.",
    a: <P>The Smart Sales-to-Contract Matcher prefers the most specific match. Open the sale on the <UI>Sales Match</UI> tab — you'll see the rules that matched and the specificity score. If the wrong contract won, tighten its qualifiers (or loosen the right one's). The next match cycle will reroute.</P>,
  },
];

export const searchText = ITEMS.map((i) => i.q).join(" ");

export default function Article() {
  return (
    <div>
      <P>Common questions. If yours isn't here, ask liQ AI from the top bar.</P>
      <H2>Questions</H2>
      <div className="space-y-2">
        {ITEMS.map((it, i) => (
          <FaqRow key={i} q={it.q} a={it.a} />
        ))}
      </div>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-200 rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-zinc-50"
        data-testid={`button-faq-toggle-${q.slice(0, 20).replace(/\s+/g, "-")}`}
      >
        {open ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
        <span className="text-sm font-medium text-zinc-900">{q}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-zinc-100">{a}</div>}
    </div>
  );
}
