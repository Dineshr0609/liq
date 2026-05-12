import { H2, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "getting-started",
  title: "Welcome to LicenseIQ",
  category: "Getting Started",
  summary: "What LicenseIQ does, and the 5-minute tour of the platform.",
  tags: ["intro", "tour", "overview"],
  updatedAt: "2026-04-21",
  contextRoutes: ["/", "/financial-control-center"],
};

export const searchText = `LicenseIQ is an AI-native contract intelligence platform for licensing royalty rebate price protection revenue share agreements. Upload contracts, AI extracts terms parties rules, you verify and activate, calculations run against your sales data automatically.`;

export default function Article() {
  return (
    <div>
      <P>
        LicenseIQ is an AI-native platform for managing complex commercial contracts —
        licensing, royalties, rebates, price-protection, distributor and revenue-share
        agreements. It reads your contracts, structures every term, runs the math
        against your sales data, and gives finance a clean accrual + close workflow.
      </P>

      <H2>The 5-minute tour</H2>
      <Steps>
        <li><UI>Upload</UI> a contract PDF (or enter one manually). The AI parses parties, terms, and calculation rules in seconds.</li>
        <li>Open the contract page. Review the <UI>Overview</UI>, <UI>Parties</UI>, <UI>Terms</UI>, and <UI>Rules</UI> tabs.</li>
        <li>Mark each rule <UI>Verified</UI> when it looks right. Only verified rules drive payments.</li>
        <li>Click <UI>Approve &amp; Activate</UI>. The contract is now live and will be matched against incoming sales.</li>
        <li>Watch the <UI>Payments</UI> and <UI>Ledger</UI> tabs as calculations populate.</li>
      </Steps>

      <Tip>
        Stuck on a screen? Click the <UI>?</UI> icon in the top bar to ask liQ AI a
        question about whatever you're looking at.
      </Tip>

      <H2>Where to go next</H2>
      <UL>
        <li>If this is your first contract: <em>Upload &amp; activate a contract</em>.</li>
        <li>If you're configuring a rebate: <em>Configure a rebate rule</em>.</li>
        <li>If you're confused by red/yellow/green badges: <em>Reading the verification traffic light</em>.</li>
      </UL>

      <Related
        items={[
          { id: "upload-activate-contract", title: "Upload & activate a contract" },
          { id: "verify-traffic-light", title: "Reading the verification traffic light" },
          { id: "glossary", title: "Glossary" },
        ]}
      />
    </div>
  );
}
