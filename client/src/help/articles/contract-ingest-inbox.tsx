import { H2, H3, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "contract-ingest-inbox",
  title: "Ingest & Inbox: the modern contract intake flow",
  category: "How-To Guides",
  summary:
    "Drop contracts into Ingest, watch them through Inbox triage, and route them into your verification queue.",
  tags: ["ingest", "inbox", "intake", "triage", "upload"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/contracts/ingest", "/contracts/inbox"],
};

export const searchText = `Ingest inbox triage contract upload PDF DOCX bulk drag drop pipeline extraction inbox queue assign archive.`;

export default function Article() {
  return (
    <div>
      <P>
        <UI>Ingest</UI> and <UI>Inbox</UI> replace the old single-purpose upload
        page. Ingest is for getting documents into the system fast (drag, drop,
        bulk); Inbox is for triaging what came in before it lands on someone's
        verification queue.
      </P>

      <H2>Ingest: getting files in</H2>
      <Steps>
        <li>Open <UI>Contract Intelligence → Ingest</UI>.</li>
        <li>Drag in PDFs, DOCX, XLSX, or CSV. Bulk drops are supported.</li>
        <li>Optional: pre-tag the batch with a contract type to tune AI prompts.</li>
        <li>Click <UI>Start Processing</UI>. Each file queues for the extraction pipeline.</li>
      </Steps>
      <Tip>
        You can also trigger an upload from anywhere in the app using the
        <UI> Upload Contract</UI> button in the top bar — it opens the same
        global modal so you don't lose your current page.
      </Tip>

      <H2>Inbox: the triage queue</H2>
      <P>
        Every ingested document lands in <UI>Inbox</UI>. The default view shows
        documents that need a human decision before they enter the verification
        flow.
      </P>
      <H3>Triage actions</H3>
      <UL>
        <li><UI>Assign</UI> — pick an owner. They'll see it in their <UI>My Contracts</UI> view.</li>
        <li><UI>Reclassify</UI> — change the contract type if AI guessed wrong. Re-runs the type-specific extraction.</li>
        <li><UI>Merge</UI> — link an amendment to its parent contract instead of creating a duplicate.</li>
        <li><UI>Archive</UI> — for non-contracts (cover letters, term sheets, junk).</li>
      </UL>

      <H2>What's happening behind the scenes</H2>
      <P>
        The pipeline has two phases:
      </P>
      <UL>
        <li><UI>Fast Path</UI> (under a minute) — pulls out the rule skeleton, parties, key dates so you can start working.</li>
        <li><UI>Deep Pass</UI> (background) — clauses, qualifiers, smart linking, master-data resolution. This is what fills out the verification details.</li>
      </UL>
      <P>
        The Inbox row's progress bar shows pipeline stages. Green = ready to
        verify. Yellow = deep pass still running but you can start.
      </P>

      <H2>Bulk operations</H2>
      <Steps>
        <li>Multi-select rows in <UI>Inbox</UI> with checkboxes.</li>
        <li>Use the bulk action bar to assign a batch to one owner, archive together, or kick off bulk reclassification.</li>
        <li>Bulk re-extraction is throttled — it'll process up to 5 in parallel.</li>
      </Steps>

      <H2>From Inbox to live contract</H2>
      <P>
        Once you've assigned and triaged, the contract moves to the assignee's
        verification queue. From there it follows the standard flow: review
        Overview / Parties / Terms / Rules → mark each rule verified → Approve
        &amp; Activate.
      </P>

      <Related
        items={[
          { id: "upload-activate-contract", title: "Upload & activate a contract" },
          { id: "verify-traffic-light", title: "Reading the verification traffic light" },
          { id: "configure-rebate-rule", title: "Configure a rebate rule" },
          { id: "configure-royalty-rule", title: "Configure a royalty rule" },
        ]}
      />
    </div>
  );
}
