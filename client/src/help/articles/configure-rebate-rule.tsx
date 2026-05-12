import { H2, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "configure-rebate-rule",
  title: "Configure a rebate rule with tiers",
  category: "How-To Guides",
  summary: "Set up a volume-tier rebate that pays differently above each threshold.",
  tags: ["rebate", "tiers", "milestone", "rules"],
  updatedAt: "2026-04-21",
};

export const searchText = `Rebate rule milestone tiered cumulative threshold marginal whole tier mode volume tiers product qualifier territory.`;

export default function Article() {
  return (
    <div>
      <P>
        Rebates typically reward a customer for hitting cumulative volume milestones —
        e.g. "1% on the first $1M, 2% above $1M, 3% above $5M." LicenseIQ models this
        as a <UI>milestone_tiered</UI> rule.
      </P>

      <H2>Step by step</H2>
      <Steps>
        <li>Open the contract → <UI>Rules</UI> tab → click <UI>Add rule</UI> (or <UI>Edit</UI> on an AI-extracted rebate).</li>
        <li>In <UI>General</UI>: name it ("Volume rebate – cumulative"), set <UI>Rule Type</UI> = <code>milestone_tiered</code>.</li>
        <li>In <UI>Calculation</UI>: pick the <UI>Base Metric</UI> (usually <code>net_sales</code>) and the <UI>Calculation Frequency</UI> (annual for most rebates).</li>
        <li>In <UI>Tiers &amp; Adjustments</UI>: add a row per tier — min, max (blank = infinity), rate.</li>
        <li>Choose <UI>Tier Mode</UI>:
          <UL>
            <li><strong>Whole</strong> — the highest tier reached pays on the full volume (retroactive).</li>
            <li><strong>Marginal/Stepped</strong> — each tier pays only on the volume inside its band.</li>
          </UL>
        </li>
        <li>In <UI>Qualifiers</UI>: scope the rule. Add a <UI>customer = X</UI> qualifier so it only fires for that customer's sales. Add a <UI>product_category in [...]</UI> qualifier if it's category-specific.</li>
        <li>In <UI>Mapping</UI>: confirm the AI-suggested master-data link for each product/territory reference. Click <UI>Auto-map all</UI> to accept all suggestions ≥ 70% confidence.</li>
        <li>Click <UI>Save</UI>, then move the status to <UI>Verified</UI>.</li>
      </Steps>

      <Tip>
        Use the <UI>Rule Evaluation Playground</UI> (Tools menu) to dry-run sample
        sales numbers against your tiers before activating. It shows which tier each
        sale falls into and the resulting fee.
      </Tip>

      <Related
        items={[
          { id: "configure-royalty-rule", title: "Configure a royalty rule" },
          { id: "verify-traffic-light", title: "Reading the verification traffic light" },
          { id: "glossary", title: "Glossary" },
        ]}
      />
    </div>
  );
}
