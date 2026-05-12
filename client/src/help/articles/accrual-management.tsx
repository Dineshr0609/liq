import { H2, H3, P, UL, Steps, UI, Tip, Warning, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "accrual-management",
  title: "Posting accruals & promoting obligations",
  category: "How-To Guides",
  summary:
    "Post a calculated accrual, watch it auto-promote to an obligation, and recover from common errors.",
  tags: ["accrual", "obligation", "CRP", "VRP", "post"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/accrual-management"],
};

export const searchText = `Accrual management post accrual obligation promotion CRP VRP rebate royalty credit memo deduction scheduled release deferred batch.`;

export default function Article() {
  return (
    <div>
      <P>
        An accrual is a calculated, period-scoped liability or receivable that
        hasn't been settled yet. Posting an accrual is what transforms a
        "calculation result" into something accounting cares about. This article
        covers the post + auto-promote flow and the errors you'll bump into.
      </P>

      <H2>Posting an accrual</H2>
      <Steps>
        <li>Open <UI>Finance Hub → Accrual Management</UI>.</li>
        <li>Filter by company / contract / period to find the row.</li>
        <li>Click the row, scroll to the calculation breakdown, and verify the rate, base, and qualifier filters.</li>
        <li>Click <UI>Post</UI>. Status flips from <UI>draft</UI> to <UI>posted</UI>.</li>
      </Steps>

      <H2>What happens at the moment of posting</H2>
      <P>
        Posting runs the <UI>postAndPromoteAccrual</UI> path atomically:
      </P>
      <UL>
        <li>The accrual row's status becomes <UI>posted</UI> with a posting timestamp.</li>
        <li>An obligation row is minted in the same transaction.</li>
        <li>For CRP contracts → <UI>outbound</UI> obligation, status <UI>claimable</UI>.</li>
        <li>For VRP contracts → <UI>inbound</UI> obligation (you'll go submit a vendor claim later).</li>
        <li>A JE row is written with the right account codes and a hard FK back to the obligation.</li>
      </UL>
      <Tip>
        Promotion is idempotent: re-posting the same <UI>accrual_id</UI> won't
        create a duplicate obligation. Safe to retry if the UI hangs.
      </Tip>

      <H2>Variants you'll encounter</H2>
      <H3>Scheduled release (deferred)</H3>
      <P>
        Contracts that release liability over time (e.g. price-protection
        accruals) get a <UI>basis: scheduled_release</UI>. The obligation is
        minted as <UI>accrued</UI> (not yet claimable) and only flips to
        claimable when the release schedule fires.
      </P>
      <H3>OEM contracts (cash direction derived)</H3>
      <P>
        OEM contracts can flow either way depending on the underlying claim
        type. If cashDirection isn't pre-set, posting throws{" "}
        <UI>OemDirectionRequiredError</UI>. Resolve it by going to the
        contract's settings and pinning <UI>Cash Direction = Outbound</UI> or{" "}
        <UI>Inbound</UI>.
      </P>
      <H3>Auto-batch posting</H3>
      <P>
        Posting via the API with <UI>status=posted</UI> on creation triggers the
        same promotion path — useful for nightly batch jobs. The same
        idempotency guarantees apply.
      </P>

      <H2>Common errors</H2>
      <Warning>
        <strong>"OEM direction required"</strong> — your OEM contract has no
        pinned cash direction. Open the contract → Settings → Cash Direction.
      </Warning>
      <Warning>
        <strong>"Calculation has no approved rule"</strong> — the underlying calc
        result references a rule that's still pending. Verify and approve the
        rule, then recalculate before posting.
      </Warning>
      <Warning>
        <strong>"Period is closed"</strong> — the accrual's period is already in
        an <UI>approved</UI> close. Either reverse the close or re-date the
        accrual into an open period.
      </Warning>

      <H2>Reversing an accrual</H2>
      <P>
        Use <UI>Reverse</UI> on a posted accrual to write a balancing JE and
        flip the obligation to <UI>void</UI>. The original row stays for audit.
        Never delete a posted accrual.
      </P>

      <Related
        items={[
          { id: "outstanding-obligations", title: "Working the Outstanding Obligations queue" },
          { id: "period-close-workspace", title: "Running a period close" },
          { id: "settlement-workspace", title: "Settlement Workspace deep dive" },
          { id: "finance-hub-overview", title: "Finance Hub: contract-to-cash, end to end" },
        ]}
      />
    </div>
  );
}
