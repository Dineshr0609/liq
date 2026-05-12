import { H2, P, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "configure-royalty-rule",
  title: "Configure a royalty rule on net sales",
  category: "How-To Guides",
  summary: "Standard percentage-of-net-sales contract fee, scoped to a product line.",
  tags: ["royalty", "percentage", "net sales", "rules"],
  updatedAt: "2026-04-21",
};

export const searchText = `Royalty percentage net sales rule base metric base rate qualifier product category territory minimum guarantee.`;

export default function Article() {
  return (
    <div>
      <P>
        A standard licensing royalty pays a fixed percentage of net sales of the
        licensed product. In LicenseIQ this is a <UI>percentage</UI> rule.
      </P>

      <H2>Step by step</H2>
      <Steps>
        <li>Open the contract → <UI>Rules</UI> tab → <UI>Add rule</UI> or edit the AI-extracted one.</li>
        <li><UI>General</UI>: name it ("Royalty – Brand X"), <UI>Rule Type</UI> = <code>percentage</code>.</li>
        <li><UI>Calculation</UI>: <UI>Base Metric</UI> = <code>net_sales</code>, <UI>Base Rate</UI> = the contract percentage (enter <code>5</code> for 5%).</li>
        <li><UI>Qualifiers</UI>: add a <code>product_category in [...]</code> or <code>product in [...]</code> qualifier to scope the rule. Without qualifiers it applies to every sale on the contract.</li>
        <li>If the contract has territory premiums or seasonal multipliers, add them in <UI>Tiers &amp; Adjustments</UI>.</li>
        <li>If there's a <em>minimum guarantee</em>, add a separate <UI>fixed</UI> rule with a recoupment qualifier so the royalty pays down the guarantee.</li>
        <li><UI>Mapping</UI>: link every product reference to a master-data record. <UI>Save</UI>. Mark <UI>Verified</UI>.</li>
      </Steps>

      <Tip>
        AI suggestions appear inline as you type. <em>"Royalty on net sales"</em> in
        the rule name auto-suggests <code>percentage</code> + <code>net_sales</code>.
      </Tip>

      <Related
        items={[
          { id: "configure-rebate-rule", title: "Configure a rebate rule" },
          { id: "verify-traffic-light", title: "Reading the verification traffic light" },
          { id: "upload-activate-contract", title: "Upload & activate a contract" },
        ]}
      />
    </div>
  );
}
