/**
 * Contract decision proposer (Phase C of agent runtime).
 *
 * Responsibilities:
 *   - Scan a tenant's contract portfolio and derive the actions the agent
 *     thinks the user should take (the same buckets the morning brief surfaces:
 *     expired-active, expiring-soon, missing-rules, pending-review).
 *   - Persist each derived action as a `contract_decisions` row in `pending`
 *     status — but never duplicate an existing pending row for the same
 *     (contract, proposalType) pair.
 *   - Dispatch accept actions: today the only real mutation is
 *     `mark-expired`. Other proposal types accept "acknowledge" (records a
 *     decision but does nothing else) so a user can clear them when they
 *     want to handle the underlying issue manually.
 *
 * This service is intentionally pure-data + thin: it doesn't know about
 * Express, auth, or transport. The route layer in server/routes.ts handles
 * those concerns.
 */
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { contractDecisions, contracts, type ContractDecision } from "@shared/schema";
import { storage } from "../storage";
import type { OrgAccessContext } from "../storage";

const DAY = 24 * 60 * 60 * 1000;

const isActiveStatus = (s: string) =>
  /^(active|executed|signed|approved|amended)$/i.test(s || "");
const isPendingStatus = (s: string) =>
  /^(pending|pending_approval|in_revision|draft)$/i.test(s || "");

type ProposalDraft = {
  proposalType: "expired-active" | "expiring" | "missing-rules" | "pending-review";
  urgency: "high" | "med" | "low";
  contractId: string;
  summary: string;
  actionType: "mark-expired" | "acknowledge";
  actionParams?: Record<string, unknown>;
};

/**
 * Walk the visible portfolio and emit the proposals the agent thinks should
 * be in the queue right now. Same logic as the morning brief, but with the
 * concrete actionType dialed in for each bucket.
 */
async function deriveProposalsForPortfolio(
  orgContext: OrgAccessContext,
  hasAdminAccess: boolean,
  userId: string,
): Promise<ProposalDraft[]> {
  const { contracts: rows } = await storage.getContracts(
    hasAdminAccess ? undefined : userId,
    1000,
    0,
    orgContext,
  );

  const now = Date.now();
  const drafts: ProposalDraft[] = [];

  for (const c of rows || []) {
    const status = (c as any).status || "";
    const end = (c as any).effectiveEnd ? new Date((c as any).effectiveEnd).getTime() : null;
    const daysToEnd = end ? Math.round((end - now) / DAY) : null;
    const rulesCount = Number((c as any).rulesCount ?? 0);
    const annualValue = Number(
      (c as any).contractValueEstimatedAnnual ?? (c as any).totalValue ?? (c as any).contractValue ?? 0,
    ) || 0;

    // Bucket 0: still-active but past end date — high urgency + real action.
    if (isActiveStatus(status) && daysToEnd != null && daysToEnd < 0) {
      drafts.push({
        proposalType: "expired-active",
        urgency: "high",
        contractId: (c as any).id,
        summary: `Mark "${(c as any).displayName || (c as any).originalName || "Untitled"}" as expired (${Math.abs(daysToEnd)}d past end date)`,
        actionType: "mark-expired",
      });
      continue;
    }
    // Bucket 1: expiring within 60 days — informational, accept = acknowledge.
    if (daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 60) {
      drafts.push({
        proposalType: "expiring",
        urgency: daysToEnd <= 30 ? "high" : "med",
        contractId: (c as any).id,
        summary: `Renewal review needed for "${(c as any).displayName || "Untitled"}" — expires in ${daysToEnd}d`,
        actionType: "acknowledge",
      });
      continue;
    }
    // Bucket 2: active with no rules — informational + ack.
    if (isActiveStatus(status) && rulesCount === 0) {
      drafts.push({
        proposalType: "missing-rules",
        urgency: annualValue > 100_000 ? "high" : "med",
        contractId: (c as any).id,
        summary: `Configure payment rules for "${(c as any).displayName || "Untitled"}" — currently active with none`,
        actionType: "acknowledge",
      });
      continue;
    }
    // Bucket 3: pending review — informational + ack.
    if (isPendingStatus(status)) {
      drafts.push({
        proposalType: "pending-review",
        urgency: "low",
        contractId: (c as any).id,
        summary: `Review and decide on "${(c as any).displayName || "Untitled"}" — currently ${status.toLowerCase()}`,
        actionType: "acknowledge",
      });
    }
  }

  return drafts;
}

/**
 * Run the proposer: derive proposals from current portfolio, insert any that
 * aren't already pending. Returns the count of new rows inserted.
 *
 * Idempotency: we look up existing `pending` rows for each (contract,
 * proposalType) and skip the insert if one exists. We do NOT auto-resurrect
 * dismissed proposals — once a user dismisses something, it stays dismissed
 * until the underlying state changes enough that the next proposer pass
 * generates a *different* proposalType row.
 */
export async function refreshProposals(
  orgContext: OrgAccessContext,
  hasAdminAccess: boolean,
  userId: string,
  companyId: string | undefined,
): Promise<{ inserted: number; skipped: number }> {
  const drafts = await deriveProposalsForPortfolio(orgContext, hasAdminAccess, userId);

  let inserted = 0;
  let skipped = 0;

  // Suppress proposals we already have pending OR that the user has
  // dismissed in the last 30 days — otherwise the queue would just refill
  // itself the moment someone clears it. Re-proposal will resume after the
  // suppression window if the underlying condition still holds.
  const SUPPRESS_DAYS = 30;
  const suppressCutoff = new Date(Date.now() - SUPPRESS_DAYS * DAY);

  for (const d of drafts) {
    const existing = await db
      .select({ id: contractDecisions.id, status: contractDecisions.status })
      .from(contractDecisions)
      .where(
        and(
          eq(contractDecisions.contractId, d.contractId),
          eq(contractDecisions.proposalType, d.proposalType),
          or(
            eq(contractDecisions.status, "pending"),
            and(
              inArray(contractDecisions.status, ["dismissed", "accepted"]),
              gt(contractDecisions.decidedAt, suppressCutoff),
            ),
          ),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(contractDecisions).values({
      companyId: companyId || null,
      contractId: d.contractId,
      proposalType: d.proposalType,
      urgency: d.urgency,
      summary: d.summary,
      actionType: d.actionType,
      actionParams: d.actionParams ?? null,
    } as any);
    inserted++;
  }

  return { inserted, skipped };
}

/**
 * List pending decisions, scoped to the visible portfolio. We filter via the
 * companyId on the row when present (proposer always sets it for context-
 * scoped tenants). For system admins / no-context users, we return all rows.
 */
export async function listPendingDecisions(
  companyId: string | undefined,
): Promise<ContractDecision[]> {
  const baseWhere = companyId
    ? and(eq(contractDecisions.status, "pending"), eq(contractDecisions.companyId, companyId))
    : eq(contractDecisions.status, "pending");

  const rows = await db
    .select()
    .from(contractDecisions)
    .where(baseWhere)
    .orderBy(desc(contractDecisions.proposedAt));

  return rows;
}

/**
 * Accept a decision: dispatch the actionType (performing real DB mutations
 * for `mark-expired`), then mark the row as accepted. Throws if the
 * decision isn't pending or the actionType is unrecognized.
 */
export async function acceptDecision(
  decisionId: string,
  userId: string,
  note?: string,
): Promise<{ decision: ContractDecision; effect: string }> {
  const [row] = await db
    .select()
    .from(contractDecisions)
    .where(eq(contractDecisions.id, decisionId))
    .limit(1);
  if (!row) throw new Error("Decision not found");
  if (row.status !== "pending") throw new Error(`Decision is already ${row.status}`);

  let effect = "no-op";

  switch (row.actionType) {
    case "mark-expired": {
      // Real mutation: flip the contract status to 'expired'. We do this
      // via raw SQL so we don't have to re-resolve the org context here —
      // the proposer already validated visibility when it created the row.
      await db
        .update(contracts)
        .set({ status: "expired" } as any)
        .where(eq(contracts.id, row.contractId));
      effect = "contract.status = 'expired'";
      break;
    }
    case "acknowledge": {
      // Pure dismissal-with-positive-affirmation. Useful for the buckets
      // where the agent can't safely automate the fix (rules editing,
      // approval ladder routing, etc.) but the user has handled it.
      effect = "acknowledged";
      break;
    }
    default:
      throw new Error(`Unsupported actionType: ${row.actionType}`);
  }

  const [updated] = await db
    .update(contractDecisions)
    .set({
      status: "accepted",
      decidedAt: sql`now()`,
      decidedBy: userId,
      decisionNote: note || null,
    } as any)
    .where(eq(contractDecisions.id, decisionId))
    .returning();

  return { decision: updated, effect };
}

/**
 * Dismiss a decision without performing any action. The row stays in the
 * table for audit but stops appearing in the pending queue.
 */
export async function dismissDecision(
  decisionId: string,
  userId: string,
  note?: string,
): Promise<ContractDecision> {
  const [row] = await db
    .select()
    .from(contractDecisions)
    .where(eq(contractDecisions.id, decisionId))
    .limit(1);
  if (!row) throw new Error("Decision not found");
  if (row.status !== "pending") throw new Error(`Decision is already ${row.status}`);

  const [updated] = await db
    .update(contractDecisions)
    .set({
      status: "dismissed",
      decidedAt: sql`now()`,
      decidedBy: userId,
      decisionNote: note || null,
    } as any)
    .where(eq(contractDecisions.id, decisionId))
    .returning();

  return updated;
}
