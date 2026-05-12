import { db } from "../db";
import { contracts, contractVersions, contractRules } from "../../shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * Pending-changes block carried inside a pending_approval version's
 * metadataSnapshot so the contract can be rolled back via "Discard pending
 * changes" if the approver decides not to accept the rule edit cycle.
 */
export interface PendingChanges {
  editedRuleIds: string[];
  // First-touch snapshot of each rule, taken before the very first edit
  // in this approval cycle. Subsequent edits in the same cycle do not
  // overwrite this — discard always restores back to the last-approved state.
  priorRuleSnapshots: Record<string, any>;
}

/**
 * Snapshot of every editable column on a contract_rules row, used as the
 * restoration point when a pending version is discarded.
 */
function snapshotRule(rule: any): any {
  if (!rule) return null;
  const clean: any = {};
  for (const [k, v] of Object.entries(rule)) {
    if (v instanceof Date) clean[k] = v.toISOString();
    else clean[k] = v;
  }
  return clean;
}

/**
 * Called BEFORE a rule edit is written. Ensures the contract has an active
 * pending_approval version that this edit can ride on.
 *
 *  - If the latest version is `approved`, mint a new vN+1 in pending_approval,
 *    supersede the prior approved version, bump the contract row, and seed the
 *    pending changes block with this rule's prior snapshot.
 *  - If the latest version is already `pending_approval`, just append the
 *    rule's prior snapshot to the existing pending changes block (only on the
 *    first time we see this ruleId in the cycle — preserves the original
 *    pre-cycle state).
 *  - If the latest version is `draft` or `rejected` (or there is none),
 *    do nothing — rule edits on those don't trigger the cycle.
 *
 * Returns whether a new version was minted, and the version number that this
 * edit is now associated with.
 */
export async function ensurePendingVersionForRuleEdit(
  contractId: string,
  ruleId: string,
  editorId: string,
  ruleName: string,
): Promise<{ minted: boolean; versionNumber: number | null }> {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  if (!contract) return { minted: false, versionNumber: null };

  const currentVersionNum = contract.currentVersion ?? 1;
  const currentState = contract.approvalState;

  // Fetch the rule snapshot up front (before the edit overwrites it).
  const [currentRule] = await db
    .select()
    .from(contractRules)
    .where(eq(contractRules.id, ruleId))
    .limit(1);
  const priorSnapshot = snapshotRule(currentRule);

  if (currentState === 'approved') {
    // Mint a new pending version that captures this rule's prior state.
    const newVersionNum = currentVersionNum + 1;

    // Supersede the prior approved/pending versions so they can no longer
    // satisfy the calculation gate.
    await db
      .update(contractVersions)
      .set({ approvalState: 'superseded' })
      .where(and(
        eq(contractVersions.contractId, contractId),
        inArray(contractVersions.approvalState, ['approved', 'pending_approval']),
      ));

    const baseSnapshot = {
      displayName: contract.displayName,
      effectiveStart: contract.effectiveStart,
      effectiveEnd: contract.effectiveEnd,
      contractType: contract.contractType,
      organizationName: contract.organizationName,
      counterpartyName: contract.counterpartyName,
      pendingChanges: {
        editedRuleIds: [ruleId],
        priorRuleSnapshots: { [ruleId]: priorSnapshot },
      } satisfies PendingChanges,
    };

    await db.insert(contractVersions).values({
      contractId,
      versionNumber: newVersionNum,
      editorId,
      changeSummary: `Rule edited: ${ruleName}`,
      metadataSnapshot: baseSnapshot,
      approvalState: 'pending_approval',
    });

    await db
      .update(contracts)
      .set({
        currentVersion: newVersionNum,
        approvalState: 'pending_approval',
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    return { minted: true, versionNumber: newVersionNum };
  }

  if (currentState === 'pending_approval') {
    // Append to the existing pending version's pendingChanges block, but only
    // capture priorSnapshot on the first time this rule is touched in the
    // cycle — preserves the true pre-cycle state for discard.
    const [pendingVersion] = await db
      .select()
      .from(contractVersions)
      .where(and(
        eq(contractVersions.contractId, contractId),
        eq(contractVersions.approvalState, 'pending_approval'),
      ))
      .orderBy(desc(contractVersions.versionNumber))
      .limit(1);

    if (pendingVersion) {
      const meta: any = pendingVersion.metadataSnapshot || {};
      const pc: PendingChanges = meta.pendingChanges || { editedRuleIds: [], priorRuleSnapshots: {} };
      const alreadyTracked = pc.editedRuleIds.includes(ruleId);
      if (!alreadyTracked) {
        pc.editedRuleIds.push(ruleId);
        pc.priorRuleSnapshots[ruleId] = priorSnapshot;
        meta.pendingChanges = pc;
        await db
          .update(contractVersions)
          .set({ metadataSnapshot: meta })
          .where(eq(contractVersions.id, pendingVersion.id));
      }
      return { minted: false, versionNumber: pendingVersion.versionNumber };
    }
  }

  return { minted: false, versionNumber: currentVersionNum };
}

/**
 * Discard a pending_approval version that was created by rule edits. Restores
 * each tracked rule to its prior snapshot, deletes the pending version row,
 * restores the most recent superseded version back to 'approved', and
 * decrements the contract's current_version.
 *
 * Returns a summary the caller can include in the response.
 */
export async function discardPendingRuleChanges(contractId: string): Promise<{
  discardedVersion: number | null;
  restoredVersion: number | null;
  restoredRuleIds: string[];
}> {
  const [pendingVersion] = await db
    .select()
    .from(contractVersions)
    .where(and(
      eq(contractVersions.contractId, contractId),
      eq(contractVersions.approvalState, 'pending_approval'),
    ))
    .orderBy(desc(contractVersions.versionNumber))
    .limit(1);

  if (!pendingVersion) {
    return { discardedVersion: null, restoredVersion: null, restoredRuleIds: [] };
  }

  const meta: any = pendingVersion.metadataSnapshot || {};
  const pc: PendingChanges = meta.pendingChanges || { editedRuleIds: [], priorRuleSnapshots: {} };

  // Restore each tracked rule from its prior snapshot.
  const restoredRuleIds: string[] = [];
  for (const ruleId of pc.editedRuleIds) {
    const snap = pc.priorRuleSnapshots[ruleId];
    if (!snap) continue;
    const restoreUpdates: any = { ...snap };
    delete restoreUpdates.id;
    delete restoreUpdates.contractId;
    delete restoreUpdates.createdAt;
    // Re-hydrate date fields from ISO strings.
    for (const f of ['effectiveDate', 'expiryDate', 'endDate', 'reviewedAt', 'approvedAt', 'updatedAt']) {
      if (restoreUpdates[f]) restoreUpdates[f] = new Date(restoreUpdates[f]);
    }
    await db.update(contractRules).set(restoreUpdates).where(eq(contractRules.id, ruleId));
    restoredRuleIds.push(ruleId);
  }

  // Find the most recent superseded version and restore it.
  const [supersededVersion] = await db
    .select()
    .from(contractVersions)
    .where(and(
      eq(contractVersions.contractId, contractId),
      eq(contractVersions.approvalState, 'superseded'),
    ))
    .orderBy(desc(contractVersions.versionNumber))
    .limit(1);

  let restoredVersionNumber: number | null = null;
  if (supersededVersion) {
    await db
      .update(contractVersions)
      .set({ approvalState: 'approved' })
      .where(eq(contractVersions.id, supersededVersion.id));
    restoredVersionNumber = supersededVersion.versionNumber;
  }

  // Delete the pending version row entirely.
  await db.delete(contractVersions).where(eq(contractVersions.id, pendingVersion.id));

  // Bring the contract row back to the restored version (or to draft if there
  // was nothing to restore to).
  await db
    .update(contracts)
    .set({
      currentVersion: restoredVersionNumber ?? Math.max(1, pendingVersion.versionNumber - 1),
      approvalState: restoredVersionNumber ? 'approved' : 'draft',
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  return {
    discardedVersion: pendingVersion.versionNumber,
    restoredVersion: restoredVersionNumber,
    restoredRuleIds,
  };
}
