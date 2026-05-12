import { H2, H3, P, UL, Steps, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "settlement-workspace",
  title: "Settlement Workspace deep dive",
  category: "How-To Guides",
  summary:
    "Outbound vs inbound settlement, the VRP flow-state tile, and the In Progress bucket.",
  tags: ["settlement", "VRP", "CRP", "credit memo", "deduction", "netting"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/settlement-workspace"],
};

export const searchText = `Settlement workspace VRP CRP outbound inbound flow state decision needed awaiting vendor netted via deduction vendor confirmed on hold in progress claim variance.`;

export default function Article() {
  return (
    <div>
      <P>
        The <UI>Settlement Workspace</UI> is where outbound obligations get paid
        and inbound obligations get collected. It supports four settlement
        types — cash, credit memo, deduction, and netting — and tracks each
        through to a balanced JE.
      </P>

      <H2>Picking a settlement type</H2>
      <UL>
        <li><UI>Cash</UI> — direct payment. Generates an AP instruction (outbound) or AR receipt (inbound).</li>
        <li><UI>Credit memo</UI> — for outbound obligations: applies a credit against the customer's open AR. Standard rebate treatment.</li>
        <li><UI>Deduction allowed</UI> — outbound, customer-initiated: customer self-deducts on next remittance, you match later.</li>
        <li><UI>Netting</UI> — applies the obligation against an existing receivable/payable with the same counterparty.</li>
      </UL>
      <Tip>
        The contract's settlement matrix decides the default for each claim
        type — built-in fallback first, then company-level matrix, then
        flow-type override, then contract override (most specific wins).
      </Tip>

      <H2>VRP-specific: the inbound flow-state tile</H2>
      <P>
        Vendor Rebate Programs (VRP) have an extra stage: you have to convince
        the vendor to pay. The workspace shows a flow-state tile (replacing the
        old variance tile) so you can see at a glance where each inbound
        obligation lives:
      </P>
      <UL>
        <li><UI>Decision Needed</UI> — fresh inbound obligation, no claim filed yet. Action: file a vendor claim.</li>
        <li><UI>Awaiting Vendor</UI> — claim submitted, waiting for vendor confirmation.</li>
        <li><UI>Netted via Deduction</UI> — short-paid an invoice, deduction posted, obligation cleared.</li>
        <li><UI>Vendor Confirmed</UI> — vendor agreed to the claim; settlement is in flight.</li>
        <li><UI>On Hold</UI> — disputed or paused.</li>
      </UL>

      <H2>The "In Progress" bucket</H2>
      <P>
        The list view's <UI>In Progress</UI> bucket (formerly "Variance") groups
        every obligation that isn't terminal — anything in <em>Decision Needed</em>,{" "}
        <em>Awaiting Vendor</em>, <em>On Hold</em>, or partially netted. This is
        your daily working list for the inbound side.
      </P>

      <H2>Submitting a vendor claim from settlement</H2>
      <Steps>
        <li>Open an inbound obligation in <UI>Decision Needed</UI>.</li>
        <li>Click <UI>Submit Vendor Claim</UI>. The workspace mints a paired outbound obligation (so the JE balances), pre-fills variance to zero, and assigns the claim to the contract owner.</li>
        <li>The toast deep-links to <UI>Claims Workspace</UI> with the new claim selected — review and refine before transmitting.</li>
        <li>The original inbound obligation flips to <UI>Awaiting Vendor</UI>.</li>
      </Steps>

      <H2>Outbound (CRP) settlement walkthrough</H2>
      <Steps>
        <li>Filter to outbound + claimable, pick the obligation.</li>
        <li>Choose settlement type (cash for direct pay, credit memo for AR offset).</li>
        <li>Confirm the JE preview — debit/credit, account codes pulled from the matrix.</li>
        <li>Click <UI>Post Settlement</UI>. Obligation flips to <UI>settled</UI>, JE row written, document generated if applicable.</li>
      </Steps>

      <H3>What the matrix resolves, in priority order</H3>
      <UL>
        <li>Built-in fallback (rebate_settlement → credit_memo for outbound, etc.)</li>
        <li>Company-level matrix overrides built-in.</li>
        <li>Flow-type override beats company matrix.</li>
        <li>Contract override beats everything.</li>
        <li>Operator-tuned legacy values are honored only for unknown claim types.</li>
      </UL>

      <Related
        items={[
          { id: "claims-workspace", title: "Submitting & tracking vendor claims" },
          { id: "outstanding-obligations", title: "Working the Outstanding Obligations queue" },
          { id: "accrual-management", title: "Posting accruals & promoting obligations" },
          { id: "finance-hub-overview", title: "Finance Hub: contract-to-cash, end to end" },
        ]}
      />
    </div>
  );
}
