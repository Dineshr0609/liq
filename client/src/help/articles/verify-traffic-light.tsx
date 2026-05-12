import { H2, P, UL, UI, Warning, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "verify-traffic-light",
  title: "Reading the verification traffic light",
  category: "Concepts",
  summary: "Red, yellow, green — what each badge means and when calculations run.",
  tags: ["verify", "traffic light", "rules", "validation"],
  updatedAt: "2026-04-21",
  contextRoutes: ["/contracts/", "/rules"],
};

export const searchText = `Verification traffic light red yellow green AI extracted under review verified pending only verified rules participate in payment calculations.`;

export default function Article() {
  return (
    <div>
      <P>
        Every calculation rule on a contract carries a status badge. The colour tells
        you whether the rule is trustworthy enough to actually move money.
      </P>

      <H2>The three states</H2>
      <UL>
        <li><span className="font-semibold text-rose-700">Red — AI Extracted / Pending.</span> The rule was created by the AI from the contract text but no human has confirmed it. <em>Will not run in calculations.</em></li>
        <li><span className="font-semibold text-amber-700">Yellow — Under Review.</span> A user is working on it. Maybe partly verified, maybe waiting on master-data mapping. <em>Will not run in calculations.</em></li>
        <li><span className="font-semibold text-emerald-700">Green — Verified.</span> A human has signed off. <em>Participates in payment calculations.</em></li>
      </UL>

      <H2>Why a Verify attempt can be rejected</H2>
      <P>The system blocks moving a rule to green when:</P>
      <UL>
        <li>Any product or territory reference in the rule's qualifiers is unmapped to your master data.</li>
        <li>The base rate is missing or zero on a percentage rule.</li>
        <li>Tier rows overlap or skip ranges on a tiered rule.</li>
      </UL>
      <Warning>
        The error toast names the exact gate that failed. Open the rule's side panel,
        jump to the section in question (usually <UI>Mapping</UI>), fix the issue,
        and retry.
      </Warning>

      <H2>What happens after Verify</H2>
      <P>
        Verifying a rule does not, by itself, make the contract active. The contract
        also needs all required party roles filled and the financial snapshot
        complete. Verifying every rule is one of the gates on the readiness checklist
        — when all gates are green, the <UI>Approve &amp; Activate</UI> button lights
        up.
      </P>

      <Related
        items={[
          { id: "upload-activate-contract", title: "Upload & activate a contract" },
          { id: "configure-rebate-rule", title: "Configure a rebate rule" },
          { id: "configure-royalty-rule", title: "Configure a royalty rule" },
        ]}
      />
    </div>
  );
}
