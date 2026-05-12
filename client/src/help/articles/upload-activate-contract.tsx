import { H2, H3, P, UL, Steps, UI, Tip, Warning, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "upload-activate-contract",
  title: "Upload & activate a contract",
  category: "How-To Guides",
  summary: "End-to-end: from PDF upload to a live, payment-generating contract.",
  tags: ["upload", "activate", "ingestion", "workflow"],
  updatedAt: "2026-04-21",
  contextRoutes: ["/contracts/ingest", "/contracts/inbox", "/contracts"],
};

export const searchText = `Upload PDF DOCX contract ingestion inbox AI extraction parties terms rules verify approve activate.`;

export default function Article() {
  return (
    <div>
      <P>
        This walks you through the full lifecycle of a contract — from drag-and-drop
        upload to an <em>active</em>, calculation-ready agreement. Plan ~10 minutes
        for your first contract; later ones are faster.
      </P>

      <H2>1. Upload</H2>
      <Steps>
        <li>Open <UI>Contract Intelligence → Ingest</UI> in the sidebar (or click <UI>Upload Contract</UI> in the top bar — it opens a global modal so you don't lose your current page).</li>
        <li>Drag in a PDF, DOCX, XLSX, or CSV. Multiple files are supported.</li>
        <li>Pick the contract type (Royalty/License, Rebate, Distributor, etc). This tunes the AI prompts.</li>
        <li>Click <UI>Start Processing</UI>.</li>
      </Steps>
      <Tip>
        If your contract is a scanned PDF, upload it anyway — the system has a 4-tier
        OCR fallback. Quality drops for handwriting; expect to verify more fields.
      </Tip>

      <H2>2. Wait for AI extraction</H2>
      <P>
        The pipeline runs in two phases. The <em>Fast Path</em> finishes in under a
        minute and pulls out the rule skeleton so you can start working. Deeper
        analysis (clauses, qualifiers, smart linking) keeps running in the background.
      </P>
      <P>
        Watch progress in <UI>Contract Intelligence → Inbox</UI>. When the row
        turns green, click into the contract.
      </P>

      <H2>3. Review the contract page</H2>
      <H3>Overview tab</H3>
      <UL>
        <li>Check the <UI>Financial Snapshot</UI> — currency, effective dates, governing law. Click any cell to edit.</li>
        <li>The right rail has <UI>liQ AI</UI>. Ask it: <em>"Summarize this contract in 3 bullets"</em>.</li>
      </UL>
      <H3>Parties tab</H3>
      <UL>
        <li>Confirm every required party role is filled (Licensor, Licensee, Payer, etc).</li>
        <li>Roles flagged red are mandatory for this contract type. Add the missing party from your master data.</li>
      </UL>
      <H3>Terms tab</H3>
      <P>Scan the clauses. Payment-related clauses are sorted to the top and badged orange.</P>
      <H3>Rules tab</H3>
      <UL>
        <li>This is where the money is. Each rule has a <UI>traffic-light</UI> badge: red (AI-extracted), yellow (under review), green (verified).</li>
        <li>Click <UI>Edit</UI> on any rule to open the side panel. Confirm rate, base metric, qualifiers, tier breakpoints.</li>
        <li>Map every product/territory reference to your master data. Unmapped references block verification.</li>
      </UL>

      <H2>4. Verify each rule</H2>
      <Steps>
        <li>Open a rule, work through General → Calculation → Tiers → Qualifiers → Mapping.</li>
        <li>Click <UI>Save</UI> at the bottom of the panel.</li>
        <li>Use the rule's status dropdown to mark it <UI>Verified</UI> (green).</li>
      </Steps>
      <Warning>
        If <UI>Verified</UI> is rejected with "unmapped references," open the
        <UI> Mapping</UI> section and accept (or manually pick) a master-data record
        for every red row. Then retry.
      </Warning>

      <H2>5. Approve &amp; Activate</H2>
      <Steps>
        <li>Look at the readiness checklist in the page header. All gates must be green.</li>
        <li>Click <UI>Approve &amp; Activate</UI>.</li>
        <li>The contract status flips to <UI>Active</UI>. Sales matching, accruals, and the calculation engine are all live now.</li>
      </Steps>

      <Tip>
        After activation you can still edit safely — click <UI>Revise</UI> in the
        header to spin a new pending version without disturbing the live one.
      </Tip>

      <Related
        items={[
          { id: "contract-ingest-inbox", title: "Ingest & Inbox: the modern contract intake flow" },
          { id: "verify-traffic-light", title: "Reading the verification traffic light" },
          { id: "configure-rebate-rule", title: "Configure a rebate rule" },
          { id: "configure-royalty-rule", title: "Configure a royalty rule" },
          { id: "template-library", title: "Using the Template Library" },
          { id: "faq", title: "FAQ & Troubleshooting" },
        ]}
      />
    </div>
  );
}
