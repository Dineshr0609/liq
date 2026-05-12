import { H2, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "template-library",
  title: "Using the Template Library",
  category: "How-To Guides",
  summary:
    "Save a contract as a template, reuse it for new agreements, and download canonical sample sales/ERP files.",
  tags: ["templates", "library", "reuse", "samples", "system templates"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/templates"],
};

export const searchText = `Template library save as template system templates company templates my templates duplicate rule sample sales CSV ERP scope visibility.`;

export default function Article() {
  return (
    <div>
      <P>
        The <UI>Template Library</UI> lets you save a fully-configured contract
        (rules, clauses, qualifiers, mappings) as a reusable starting point.
        Useful for vendor portfolios where the same rebate structure repeats
        across many SKUs, or for onboarding new customers off your standard
        contract.
      </P>

      <H2>What you'll see</H2>
      <UL>
        <li><UI>System templates</UI> — six platform-wide starters (CRP rebate, royalty, OEM, distributor, etc). Read-only; clone to customize.</li>
        <li><UI>Company templates</UI> — anything saved by anyone in your organization, scoped to your active company.</li>
        <li><UI>My templates</UI> — yours only, pre-publication or private.</li>
      </UL>

      <H2>Saving a contract as a template</H2>
      <Steps>
        <li>Open the source contract, click <UI>… → Save as Template</UI>.</li>
        <li>Pick the scope: <UI>system</UI> (admin only), <UI>company</UI> (visible to your org), or <UI>mine</UI>.</li>
        <li>Pick the contract type — this becomes the template's primary subtype, used for matching.</li>
        <li>Save. The snapshot captures every rule, clause, and qualifier — but not the specific party or product mappings.</li>
      </Steps>
      <Tip>
        Your master-data mappings are deliberately stripped on save. You don't
        want every TechSound template to come pre-mapped to TechSound's
        specific products. Mappings get rebuilt per use.
      </Tip>

      <H2>Using a template for a new contract</H2>
      <Steps>
        <li>Click <UI>+ New Contract</UI> from anywhere.</li>
        <li>Choose <UI>From Template</UI> and pick the source.</li>
        <li>Enter the new contract metadata (parties, dates, governing law).</li>
        <li>Click <UI>Create</UI>. All template rules and clauses are cloned into the new contract.</li>
        <li>Map the parties and products to the new counterparty's master data, then verify and activate as usual.</li>
      </Steps>

      <H2>Duplicating individual rules within a contract</H2>
      <P>
        You don't always need a full template. From the rules list:
      </P>
      <Steps>
        <li>Open a rule, click <UI>… → Duplicate</UI>.</li>
        <li>The clone copies every column except primary key + extraction order — so it slots cleanly after the original.</li>
        <li>Edit the duplicate (e.g. change the SKU filter) and save.</li>
      </Steps>

      <H2>Sample data downloads</H2>
      <P>
        Each template can publish canonical sample files (sales CSV, ERP
        record format) so users can test the calc flow without needing real
        data. From the template detail page click <UI>Download Sample → Sales</UI>{" "}
        or <UI>Download Sample → ERP Records</UI>.
      </P>
      <P>
        The samples are small (10-20 rows), schema-correct, and tagged with the
        template's primary subtype. Use them to dry-run a calc before
        connecting your live data feeds.
      </P>

      <Related
        items={[
          { id: "upload-activate-contract", title: "Upload & activate a contract" },
          { id: "configure-rebate-rule", title: "Configure a rebate rule" },
          { id: "configure-royalty-rule", title: "Configure a royalty rule" },
          { id: "contract-ingest-inbox", title: "Ingest & Inbox: the modern contract intake flow" },
        ]}
      />
    </div>
  );
}
