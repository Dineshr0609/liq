import { H2, P, UL, Steps, UI, Tip, Warning, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "claims-workspace",
  title: "Submitting & tracking vendor claims",
  category: "How-To Guides",
  summary:
    "VRP claim submission flow, what gets minted, and how to chase a vendor through to confirmation.",
  tags: ["claims", "VRP", "vendor", "deep link", "obligation", "variance"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/claims-workspace"],
};

export const searchText = `Claims workspace vendor claim submission VRP outbound obligation variance decision needed awaiting vendor confirmed transmit chase aging.`;

export default function Article() {
  return (
    <div>
      <P>
        The <UI>Claims Workspace</UI> manages vendor claim submission for VRP
        contracts: you've earned a rebate from a vendor and now need to file the
        claim, transmit it, and follow up until they pay. The workspace keeps
        the obligation, the claim packet, and the chase log together.
      </P>

      <H2>What happens when you submit a claim</H2>
      <P>
        Submitting a vendor claim runs an atomic flow:
      </P>
      <UL>
        <li>The original <UI>inbound</UI> obligation flips to <UI>Awaiting Vendor</UI>.</li>
        <li>A paired <UI>outbound</UI> obligation is minted (so the JE always balances).</li>
        <li>The new outbound obligation has a hard FK to the JE row's id.</li>
        <li>Variance is pre-filled to <UI>0.00</UI> until the vendor remits a different amount.</li>
        <li>The claim packet is created with the contract terms, period, and supporting calc breakdown.</li>
      </UL>
      <Tip>
        After submitting, the success toast deep-links you to{" "}
        <UI>/claims-workspace?claimId=…</UI> with the new claim selected. Use it
        to jump straight from settlement into review.
      </Tip>

      <H2>Filing a claim from scratch</H2>
      <Steps>
        <li>Open <UI>Claims Workspace</UI>. Filter by vendor or contract.</li>
        <li>Click <UI>+ New Claim</UI>, pick the inbound obligation to claim against.</li>
        <li>Review the auto-filled packet: period, accrual breakdown, supporting sales records, contract reference.</li>
        <li>Attach any vendor-required forms (signed claim form, proof of sales).</li>
        <li>Click <UI>Submit</UI>. Status flips to <UI>Awaiting Vendor</UI>.</li>
      </Steps>

      <H2>Tracking through to confirmation</H2>
      <P>The claim moves through four states:</P>
      <UL>
        <li><UI>Decision Needed</UI> — drafted, not yet transmitted.</li>
        <li><UI>Awaiting Vendor</UI> — transmitted, no response yet. Aging clock starts.</li>
        <li><UI>Vendor Confirmed</UI> — vendor accepted (in full or with variance). Settlement can post.</li>
        <li><UI>On Hold</UI> — vendor disputed or you paused for review.</li>
      </UL>

      <H2>When the vendor pays a different amount</H2>
      <Steps>
        <li>Open the claim, click <UI>Record Vendor Response</UI>.</li>
        <li>Enter the amount they confirmed. The variance recalculates automatically.</li>
        <li>If variance is acceptable, click <UI>Confirm</UI>. Settlement posts at the confirmed amount; the variance writes as a P&amp;L adjustment.</li>
        <li>If variance is unacceptable, click <UI>Dispute</UI> and add notes. Status flips to <UI>On Hold</UI>.</li>
      </Steps>
      <Warning>
        Confirming a claim with variance writes a JE adjustment to the variance
        account from your matrix. Make sure the variance account is mapped
        correctly in <UI>Enterprise Configuration</UI> before approving large
        variances.
      </Warning>

      <H2>The chase loop</H2>
      <P>
        Use the aging filter (30/60/90 days) on <UI>Awaiting Vendor</UI> claims
        to drive your weekly follow-up list. Each claim has a chase log — every
        email, call, and forwarded reminder lands there.
      </P>

      <Related
        items={[
          { id: "settlement-workspace", title: "Settlement Workspace deep dive" },
          { id: "outstanding-obligations", title: "Working the Outstanding Obligations queue" },
          { id: "accrual-management", title: "Posting accruals & promoting obligations" },
          { id: "finance-hub-overview", title: "Finance Hub: contract-to-cash, end to end" },
        ]}
      />
    </div>
  );
}
