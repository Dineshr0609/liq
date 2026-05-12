import { db } from "../db";
import { contractRules, contractVersions, contracts } from "../../shared/schema";
import { and, eq, ne } from "drizzle-orm";

export interface RuleApprovalSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  blockingRuleIds: string[];
  isFullyApproved: boolean;
}

/**
 * Look at every active rule for a contract and report the approval breakdown.
 * "Active" = isActive !== false. Inactive rules are excluded from the gate so
 * historical or archived rules never block contract approval.
 *
 * The returned `blockingRuleIds` are the rules that prevent the contract from
 * being approved (anything not 'approved').
 */
export async function getRuleApprovalSummary(contractId: string): Promise<RuleApprovalSummary> {
  const rows = await db
    .select({
      id: contractRules.id,
      approvalStatus: contractRules.approvalStatus,
      isActive: contractRules.isActive,
    })
    .from(contractRules)
    .where(eq(contractRules.contractId, contractId));

  const active = rows.filter(r => r.isActive !== false);

  const summary: RuleApprovalSummary = {
    total: active.length,
    approved: 0,
    pending: 0,
    rejected: 0,
    blockingRuleIds: [],
    isFullyApproved: false,
  };

  for (const r of active) {
    const s = (r.approvalStatus || 'pending').toLowerCase();
    if (s === 'approved') {
      summary.approved++;
    } else {
      if (s === 'rejected') summary.rejected++;
      else summary.pending++;
      summary.blockingRuleIds.push(r.id);
    }
  }

  // A contract with zero active rules cannot be considered "fully approved" —
  // there is nothing to calculate against, so the controller still has to make
  // an explicit decision before approving.
  summary.isFullyApproved = summary.total > 0 && summary.approved === summary.total;

  return summary;
}

/**
 * If any active rule on this contract is not approved, revoke any 'approved'
 * contract version snapshots back to 'pending_approval'. This is the
 * auto-revert hook that runs after rule mutations (edit, add, delete, reject,
 * bulk-review).
 *
 * Returns the number of contract versions that were demoted, so callers can
 * include the info in their response or audit log.
 */
export async function revertContractApprovalIfRulesIncomplete(
  contractId: string,
  reason: string,
): Promise<{ demotedVersions: number; summary: RuleApprovalSummary }> {
  const summary = await getRuleApprovalSummary(contractId);
  if (summary.isFullyApproved) {
    return { demotedVersions: 0, summary };
  }

  const demoted = await db
    .update(contractVersions)
    .set({ approvalState: 'pending_approval' })
    .where(and(
      eq(contractVersions.contractId, contractId),
      eq(contractVersions.approvalState, 'approved'),
    ))
    .returning({ id: contractVersions.id, versionNumber: contractVersions.versionNumber });

  // Keep the contracts.approval_state column in sync with the version row(s).
  // Without this, a contract can show "Approved" in the header chip while its
  // current version row says "pending_approval" — confusing the editor and
  // bypassing the calculation gate.
  const [contractRow] = await db
    .select({ approvalState: contracts.approvalState })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  if (contractRow && contractRow.approvalState === 'approved') {
    await db
      .update(contracts)
      .set({ approvalState: 'pending_approval', updatedAt: new Date() })
      .where(eq(contracts.id, contractId));
  }

  if (demoted.length > 0) {
    console.log(
      `[contractApprovalIntegrity] Demoted ${demoted.length} approved version(s) of contract ${contractId} back to pending_approval. Reason: ${reason}`,
    );
  }

  return { demotedVersions: demoted.length, summary };
}
