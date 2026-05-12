import { H2, P, UL, Steps, UI, Tip, Warning, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "period-close-workspace",
  title: "Running a period close",
  category: "How-To Guides",
  summary:
    "Open a period, review phase totals, approve, and what to do when something doesn't tie.",
  tags: ["period close", "month end", "phase summary", "approve"],
  updatedAt: "2026-04-29",
  contextRoutes: ["/period-close-workspace"],
};

export const searchText = `Period close workspace open approve phase summary gross net calc settlement audit reverse reopen.`;

export default function Article() {
  return (
    <div>
      <P>
        The <UI>Period Close Workspace</UI> bundles every approved calc result
        for a period into a single, closeable unit. Closing the period freezes
        the underlying accruals and obligations so downstream reporting can rely
        on them.
      </P>

      <H2>Opening a period</H2>
      <Steps>
        <li>Click <UI>+ New Period</UI>. Pick the company, period type (month/quarter), and date range.</li>
        <li>The period is created in <UI>open</UI> status, scoped to the active company.</li>
        <li>Child bundles (one per contract) auto-attach as accruals get posted into the date range.</li>
      </Steps>

      <H2>The phase summary</H2>
      <P>
        Every approved calc result carries a <UI>phase</UI> tag. The summary
        rolls them up so you can sanity-check before approving:
      </P>
      <UL>
        <li><UI>gross_calc</UI> — base earned amount before adjustments.</li>
        <li><UI>net_calc</UI> — after qualifier filters, caps, floors, tier breakpoints.</li>
        <li><UI>settlement</UI> — the actual cash/credit-memo/deduction amount.</li>
      </UL>
      <P>
        If <UI>gross_calc</UI> ≠ sum of underlying calc rule results, something
        was excluded — usually a rule that's still pending verification.
      </P>

      <H2>Approving the period</H2>
      <Steps>
        <li>Verify the phase summary matches your expected close totals.</li>
        <li>Click <UI>Approve</UI>. Status flips to <UI>approved</UI>; an audit row is written with reviewer + timestamp.</li>
        <li>All child accruals + obligations are now frozen — no edits, no new postings into this period.</li>
      </Steps>

      <Warning>
        Once approved, you can only correct via reversal entries in a future
        open period. There's no soft-undo. Plan your close.
      </Warning>

      <H2>Common close blockers</H2>
      <UL>
        <li><strong>Rules still pending</strong> — verify and approve them, then re-run calculations into this period.</li>
        <li><strong>Accruals not yet posted</strong> — open <UI>Accrual Management</UI>, filter by period, post each one.</li>
        <li><strong>Phase totals don't tie</strong> — open the bundle, drill into the contract, look for excluded calc results (yellow badge in the breakdown).</li>
        <li><strong>OEM accruals stuck</strong> — every OEM contract in the period needs a pinned cash direction.</li>
      </UL>

      <H2>Reopening</H2>
      <P>
        <UI>Delete</UI> on an approved period removes the period and its audit
        children. This is intentional — it's your "undo" if you closed too
        early. The accruals themselves remain posted; only the bundle is gone.
      </P>
      <Tip>
        Most teams run a soft close mid-month (post accruals, don't approve)
        and then approve on day 5 of the next month after AP/AR reconciliation.
      </Tip>

      <Related
        items={[
          { id: "accrual-management", title: "Posting accruals & promoting obligations" },
          { id: "outstanding-obligations", title: "Working the Outstanding Obligations queue" },
          { id: "settlement-workspace", title: "Settlement Workspace deep dive" },
          { id: "finance-hub-overview", title: "Finance Hub: contract-to-cash, end to end" },
        ]}
      />
    </div>
  );
}
