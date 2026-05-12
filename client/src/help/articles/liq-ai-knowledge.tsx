import { H2, H3, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "liq-ai-knowledge",
  title: "liQ AI, Contract Q&A, and the Knowledge Base",
  category: "How-To Guides",
  summary:
    "How to ask liQ AI good questions, what it knows, and how the Knowledge Base + RAG pipeline keep it grounded.",
  tags: ["AI", "liQ", "Q&A", "knowledge base", "RAG", "search"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/contract-qna", "/knowledge-base", "/rag-dashboard"],
};

export const searchText = `liQ AI contract Q&A knowledge base RAG retrieval augmented generation grounding source citation embedding ask question search semantic.`;

export default function Article() {
  return (
    <div>
      <P>
        <UI>liQ AI</UI> is the in-app assistant. It answers questions about
        your specific contracts, your accrual ledger, and how the platform
        works. It's grounded in two sources: your own contract data, and the
        curated <UI>Knowledge Base</UI> of system documentation.
      </P>

      <H2>Where to find it</H2>
      <UL>
        <li><strong>Right rail on every contract page</strong> — context is the contract you're viewing.</li>
        <li><strong>Question mark icon in the top bar</strong> — ask about whatever screen you're on.</li>
        <li><strong>Dedicated page at <UI>/contract-qna</UI></strong> — full Q&amp;A history and broader queries.</li>
        <li><strong>Help search</strong> — when help search has zero results, "Ask liQ AI" lights up so the question doesn't die.</li>
      </UL>

      <H2>Asking good questions</H2>
      <P>liQ AI is best at:</P>
      <UL>
        <li><strong>Specific contract questions</strong>: "What's the variance threshold on TechSound's Q2 rebate?"</li>
        <li><strong>Cross-contract patterns</strong>: "Which OEM contracts don't have a pinned cash direction?"</li>
        <li><strong>Calculation explanation</strong>: "Why did this rule pay zero on the March accrual?"</li>
        <li><strong>How-to questions</strong>: "How do I reverse a posted accrual?" (answers from the Knowledge Base).</li>
      </UL>
      <Tip>
        Every answer cites its sources. Click a citation to jump to the exact
        contract clause, calculation row, or KB article. If there are no
        citations, treat the answer as a guess.
      </Tip>

      <H2>The Knowledge Base</H2>
      <H3>What's in it</H3>
      <UL>
        <li>System documentation (how features work, accounting flows, settlement matrix logic).</li>
        <li>Curated FAQs harvested from real user questions.</li>
        <li>Optional: your own internal SOPs you've uploaded.</li>
      </UL>
      <H3>Adding your own knowledge</H3>
      <Steps>
        <li>Open <UI>Advanced AI → Knowledge Base</UI>.</li>
        <li>Click <UI>+ New Article</UI> or upload a PDF/DOCX of your team's SOP.</li>
        <li>Tag it (e.g. "rebate-policy", "internal-only") so retrieval can scope.</li>
        <li>Save. The RAG pipeline embeds it within seconds.</li>
      </Steps>

      <H2>RAG Management</H2>
      <P>
        <UI>RAG Dashboard</UI> (admin only) is where you tune the retrieval
        pipeline:
      </P>
      <UL>
        <li>See which articles are getting cited most often.</li>
        <li>Find content gaps (high-frequency questions with no good source).</li>
        <li>Re-embed the corpus after model changes.</li>
        <li>Inspect chunk-level recall to debug bad answers.</li>
      </UL>

      <H2>Things liQ AI won't do</H2>
      <UL>
        <li>Make changes on your behalf — every action stays user-initiated.</li>
        <li>Answer questions about contracts you don't have access to.</li>
        <li>Hallucinate citations — if it doesn't know, it says so.</li>
      </UL>

      <Related
        items={[
          { id: "getting-started", title: "Welcome to LicenseIQ" },
          { id: "faq", title: "FAQ & Troubleshooting" },
          { id: "glossary", title: "Glossary" },
        ]}
      />
    </div>
  );
}
