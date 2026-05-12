import { H2, H3, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "outstanding-obligations",
  title: "Working the Outstanding Obligations queue",
  category: "How-To Guides",
  summary:
    "What the obligation lifecycle looks like, how to filter the queue, and how to clear an obligation.",
  tags: ["obligations", "outbound", "inbound", "claimable", "settlement"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/outstanding-obligations"],
};

export const searchText = `Outstanding obligations queue claimable accrued settled void inbound outbound aging counterparty contract clear settle.`;

export default function Article() {
  return (
    <div>
      <P>
        Every posted accrual produces an obligation. <UI>Outstanding Obligations</UI>{" "}
        is the queue of everything that's been recognized but not yet cleared —
        the working list for your AP/AR team.
      </P>

      <H2>Direction &amp; status</H2>
      <UL>
        <li><UI>Outbound</UI>: we owe the counterparty (CRP, royalties, customer rebates).</li>
        <li><UI>Inbound</UI>: the counterparty owes us (VRP, vendor rebates, cost recovery).</li>
      </UL>
      <UL>
        <li><UI>claimable</UI> — ready to be settled / claimed.</li>
        <li><UI>accrued</UI> — recognized but not yet claimable (e.g. deferred / scheduled release).</li>
        <li><UI>on_hold</UI> — disputed or under review.</li>
        <li><UI>settled</UI> — cleared, JE balanced, terminal state.</li>
        <li><UI>void</UI> — reversed via the source accrual.</li>
      </UL>

      <H2>Filters that earn their keep</H2>
      <Steps>
        <li><UI>Counterparty</UI> — narrow to one vendor / customer.</li>
        <li><UI>Aging bucket</UI> — 0-30, 31-60, 61-90, 90+. Anything 60+ usually needs escalation.</li>
        <li><UI>Direction + status</UI> — e.g. inbound + claimable = "vendor claims to file."</li>
        <li><UI>Contract</UI> — drill into a single agreement's open balance.</li>
      </Steps>
      <Tip>
        Save your common filter combos as views. The aging-by-counterparty view
        is the standard month-end review starting point.
      </Tip>

      <H2>Clearing an obligation</H2>
      <P>The path depends on direction:</P>
      <H3>Outbound (we pay)</H3>
      <UL>
        <li><UI>Cash</UI> — open <UI>Settlement Workspace</UI>, pick the obligation, settle as cash. AP system gets a payment instruction.</li>
        <li><UI>Credit memo</UI> — generates a credit memo in <UI>Invoices &amp; Memos</UI>, applies it against the customer's open AR.</li>
        <li><UI>Deduction allowed</UI> — the customer self-deducts on their next remittance. Match in <UI>Deductions Workspace</UI> when it lands.</li>
      </UL>
      <H3>Inbound (we collect)</H3>
      <UL>
        <li><UI>Submit vendor claim</UI> from <UI>Claims Workspace</UI>. This mints the outbound countersig obligation and starts the <em>Awaiting Vendor</em> flow state.</li>
        <li><UI>Net via deduction</UI> — short-pay an upcoming vendor invoice and post a deduction.</li>
      </UL>

      <H2>What never appears here</H2>
      <UL>
        <li>Draft accruals (status hasn't crossed <UI>posted</UI>).</li>
        <li>Reversed accruals (their obligation is <UI>void</UI>; toggle "Show void" to see them for audit).</li>
        <li>Calculation results that haven't been wrapped into an accrual yet.</li>
      </UL>

      <Related
        items={[
          { id: "accrual-management", title: "Posting accruals & promoting obligations" },
          { id: "settlement-workspace", title: "Settlement Workspace deep dive" },
          { id: "claims-workspace", title: "Submitting & tracking vendor claims" },
          { id: "finance-hub-overview", title: "Finance Hub: contract-to-cash, end to end" },
        ]}
      />
    </div>
  );
}
