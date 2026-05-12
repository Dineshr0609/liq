import { H2, H3, P, UL, UI, Tip, Related } from "./_shared";
import type { HelpArticleMeta } from "../registry";

export const meta: HelpArticleMeta = {
  id: "finance-hub-overview",
  title: "Finance Hub: contract-to-cash, end to end",
  category: "Concepts",
  summary:
    "How accruals, obligations, period close, settlement, claims, deductions, and invoices fit together.",
  tags: ["finance", "accruals", "obligations", "settlement", "close", "overview"],
  updatedAt: "2026-04-29",
  contextRoutes: [
    "/accrual-management",
    "/outstanding-obligations",
    "/journal-entry-hub",
    "/period-close-workspace",
    "/settlement-workspace",
    "/claims-workspace",
    "/invoices-memos",
    "/deductions-workspace",
  ],
};

export const searchText = `Finance hub accrual obligation period close settlement claims invoices memos deductions journal entry workflow CRP VRP rebate royalty.`;

export default function Article() {
  return (
    <div>
      <P>
        The <UI>Finance Hub</UI> is where calculated contract activity becomes
        accounting truth. It mirrors the standard contract-to-cash flow: accrue
        liability or receivable as transactions land, post the journal entry,
        close the period, settle with the counterparty, and book any claims or
        deductions that arise.
      </P>

      <H2>The eight workspaces, in order of use</H2>
      <H3>1. Accrual Management</H3>
      <P>
        Where calculated fees become posted accruals. Each row is a contract +
        period bundle (e.g. <em>Q1 royalty owed on Title X</em>). Posting an
        accrual <strong>also mints a corresponding obligation</strong> — outbound
        for CRP (Customer Rebate Program), inbound for VRP (Vendor Rebate
        Program). That promotion is idempotent, so re-posting is safe.
      </P>

      <H3>2. Outstanding Obligations</H3>
      <P>
        The single source of truth for "what we owe / what we're owed." Every
        unsettled accrual lands here with a status (claimable, accrued, on hold,
        settled). Filter by counterparty, contract, or aging bucket.
      </P>

      <H3>3. Journal Entry Hub</H3>
      <P>
        The accounting layer. Each accrual + settlement event writes a JE row
        with debit/credit, account codes from your matrix, and a hard FK back to
        the source obligation. JEs are immutable once posted; corrections happen
        via reversal entries.
      </P>

      <H3>4. Period Close Workspace</H3>
      <P>
        Bundles every approved calc result for a period into a closeable unit.
        The phase summary aggregates by <UI>gross_calc</UI> /{" "}
        <UI>net_calc</UI> / <UI>settlement</UI> so you can sanity-check totals
        before flipping the period to <UI>approved</UI>.
      </P>

      <H3>5. Settlement Workspace</H3>
      <P>
        Where outbound obligations get paid (CRP) and inbound get collected
        (VRP). Pick a settlement type (cash, credit memo, deduction, netting),
        and the workspace produces the right downstream artifacts. See{" "}
        <em>Settlement Workspace deep dive</em> for the VRP flow-state tile.
      </P>

      <H3>6. Claims Workspace</H3>
      <P>
        Manages vendor claim submission for VRP contracts. Submitting a claim
        mints an outbound obligation (so the JE balances), pre-fills variance to
        zero, and tracks the claim through{" "}
        <em>Decision Needed → Awaiting Vendor → Vendor Confirmed</em>.
      </P>

      <H3>7. Invoices &amp; Memos</H3>
      <P>
        Generated documents (debit memos, credit memos, invoices) tied to
        settlement events. Each one references the underlying obligation and JE
        row.
      </P>

      <H3>8. Deductions Workspace</H3>
      <P>
        For deduction-based settlement: a vendor short-pays an invoice and you
        net the obligation against the receivable. Match deductions to inbound
        obligations one-to-many.
      </P>

      <Tip>
        Every screen in the Finance Hub respects company scoping. If you're
        switched to "TechSound Audio" you only see TechSound's accruals,
        obligations, and JEs — even as an admin. Switch context from the
        avatar menu.
      </Tip>

      <H2>The numbers that have to tie</H2>
      <UL>
        <li>Sum of posted accruals (period) = sum of obligations (period).</li>
        <li>Sum of obligations cleared = sum of settlement events.</li>
        <li>Every JE row has a non-null <UI>obligation_id</UI> FK.</li>
        <li>Period close phase summary = filterable accrual total for that period.</li>
      </UL>

      <Related
        items={[
          { id: "accrual-management", title: "Posting accruals & promoting obligations" },
          { id: "outstanding-obligations", title: "Working the Outstanding Obligations queue" },
          { id: "period-close-workspace", title: "Running a period close" },
          { id: "settlement-workspace", title: "Settlement Workspace deep dive" },
          { id: "claims-workspace", title: "Submitting & tracking vendor claims" },
        ]}
      />
    </div>
  );
}
