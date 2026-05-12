// Reusable per-action exec functions for the Close batch operations.
//
// These are the underlying "do the work" callbacks shared between:
//
//  1. The user-facing batch endpoints (POST /api/finance/batch/post-jes,
//     /settle, /resolve-claims, /apply-deductions, /reverse-accruals).
//
//  2. The Co-Pilot decision approval flow
//     (POST /api/finance/decisions/:id/approve), which dispatches to the
//     same execs after a human approves a pending close_decisions row.
//
// Both consumers wrap the exec in `runIdempotentBatch` so the work is
// recorded as a `close_batch_operations` row and replays return the
// original receipt instead of re-executing. The decision approver uses
// `decision.id` as the idempotency key so a double-click on Approve
// short-circuits to the first batch's receipt.
//
// NOTE: action_type "release_obligations" is in the schema allowlist
// but has no batch endpoint yet. The dispatcher rejects it explicitly
// so a stray AI proposal can't silently no-op.

import { db } from "../db";
import {
  obligations,
  journalEntries,
  settlements,
  inboundClaims,
  inboundClaimEvents,
  deductions,
  accruals,
  accrualAuditTrail,
  periodClose,
  periodCloseBlockers,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchResultSummary } from "./closeBatch";

export type CloseActionType =
  | "post_jes"
  | "settle_obligations"
  | "resolve_claims"
  | "apply_deductions"
  | "reverse_accruals"
  | "release_obligations"
  | "hold_for_review"
  | "request_info"
  | "flag_blocker";

export interface ActionExecCtx {
  userId: string | null;
  userName: string;
  periodId: string;
}

// ---- per-action execs --------------------------------------------------

export interface PostJEsPayload {
  obligationIds: string[];
  periodId: string;
  dryRun?: boolean;
}

export async function execPostJEs(
  payload: PostJEsPayload,
  _ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  const { obligationIds, dryRun } = payload;
  const summary: BatchResultSummary = {
    succeeded: 0,
    failed: 0,
    errors: [],
    dryRun: !!dryRun,
    posted: [] as string[],
  };
  const obs = await db
    .select({ id: obligations.id, jeId: obligations.linkedJournalEntryId })
    .from(obligations)
    .where(inArray(obligations.id, obligationIds));
  const obById = new Map(obs.map((o) => [o.id, o]));
  for (const oid of obligationIds) {
    const ob = obById.get(oid);
    if (!ob) {
      summary.failed++;
      summary.errors.push({ id: oid, message: "Obligation not found" });
      continue;
    }
    if (!ob.jeId) {
      summary.failed++;
      summary.errors.push({ id: oid, message: "No linked journal entry" });
      continue;
    }
    if (dryRun) {
      summary.succeeded++;
      (summary.posted as string[]).push(ob.jeId);
      continue;
    }
    try {
      await db
        .update(journalEntries)
        .set({ jeStage: "posted", updatedAt: new Date() } as any)
        .where(eq(journalEntries.id, ob.jeId));
      summary.succeeded++;
      (summary.posted as string[]).push(ob.jeId);
    } catch (e: any) {
      summary.failed++;
      summary.errors.push({ id: oid, message: e.message });
    }
  }
  return summary;
}

export interface SettlePayload {
  obligationIds: string[];
  periodId: string;
  settlementMethod?: string;
}

export async function execSettle(
  payload: SettlePayload,
  ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  const { obligationIds, settlementMethod } = payload;
  const summary: BatchResultSummary = {
    succeeded: 0,
    failed: 0,
    errors: [],
    settlementMethod: settlementMethod || null,
  };
  const [periodRow] = await db
    .select()
    .from(periodClose)
    .where(eq(periodClose.id, ctx.periodId));
  if (!periodRow) {
    summary.failed = obligationIds.length;
    summary.errors.push({ id: "_period", message: "Period not found" });
    return summary;
  }
  const obs = await db
    .select({ id: obligations.id, contractId: obligations.contractId })
    .from(obligations)
    .where(inArray(obligations.id, obligationIds));
  const contractIds = Array.from(
    new Set(obs.map((o) => o.contractId).filter(Boolean) as string[]),
  );
  if (contractIds.length === 0) {
    summary.failed = obligationIds.length;
    summary.errors.push({
      id: "_contracts",
      message: "No contracts resolved from obligations",
    });
    return summary;
  }
  try {
    const updated = await db
      .update(settlements)
      .set({ settlementStatus: "posted", updatedAt: new Date() } as any)
      .where(
        and(
          inArray(settlements.contractId, contractIds),
          eq(settlements.period, periodRow.periodLabel),
        ),
      )
      .returning({ id: settlements.id });
    summary.succeeded = updated.length;
    (summary as any).noSettlementForContract =
      obligationIds.length - summary.succeeded;
  } catch (e: any) {
    summary.failed = obligationIds.length;
    summary.errors.push({ id: "_batch", message: e.message });
  }
  return summary;
}

export interface ResolveClaimsPayload {
  claimIds: string[];
  resolution: "approve" | "reject" | "partial";
  notes?: string;
  periodId: string;
}

export async function execResolveClaims(
  payload: ResolveClaimsPayload,
  ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  const { claimIds, resolution, notes } = payload;
  const newStatus =
    resolution === "approve"
      ? "approved"
      : resolution === "reject"
      ? "rejected"
      : "partial_approved";
  const summary: BatchResultSummary = {
    succeeded: 0,
    failed: 0,
    errors: [],
    resolution,
  };
  for (const cid of claimIds) {
    try {
      const updated = await db
        .update(inboundClaims)
        .set({ status: newStatus, updatedAt: new Date() } as any)
        .where(eq(inboundClaims.id, cid))
        .returning({ id: inboundClaims.id });
      if (updated.length === 0) {
        summary.failed++;
        summary.errors.push({ id: cid, message: "Claim not found" });
        continue;
      }
      await db
        .insert(inboundClaimEvents)
        .values({
          claimId: cid,
          eventType: `batch_${resolution}`,
          description: notes || `Batch ${resolution} via Worksheet`,
          userId: ctx.userId ?? undefined,
        } as any)
        .catch(() => {});
      summary.succeeded++;
    } catch (e: any) {
      summary.failed++;
      summary.errors.push({ id: cid, message: e.message });
    }
  }
  return summary;
}

export interface ApplyDeductionsPayload {
  deductionIds: string[];
  action: "match" | "write_off" | "recover";
  periodId: string;
}

export async function execApplyDeductions(
  payload: ApplyDeductionsPayload,
  _ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  const { deductionIds, action } = payload;
  const newStatus =
    action === "match"
      ? "matched"
      : action === "write_off"
      ? "written_off"
      : "recovered";
  const summary: BatchResultSummary = {
    succeeded: 0,
    failed: 0,
    errors: [],
    action,
  };
  try {
    const updated = await db
      .update(deductions)
      .set({ status: newStatus, updatedAt: new Date() } as any)
      .where(inArray(deductions.id, deductionIds))
      .returning({ id: deductions.id });
    summary.succeeded = updated.length;
    const updatedSet = new Set(updated.map((u) => u.id));
    for (const did of deductionIds) {
      if (!updatedSet.has(did)) {
        summary.failed++;
        summary.errors.push({ id: did, message: "Deduction not found" });
      }
    }
  } catch (e: any) {
    summary.failed = deductionIds.length;
    summary.errors.push({ id: "_batch", message: e.message });
  }
  return summary;
}

export interface ReverseAccrualsPayload {
  accrualIds: string[];
  reason: string;
  periodId: string;
}

export async function execReverseAccruals(
  payload: ReverseAccrualsPayload,
  ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  const { accrualIds, reason } = payload;
  const summary: BatchResultSummary = {
    succeeded: 0,
    failed: 0,
    errors: [],
    reason,
  };
  for (const aid of accrualIds) {
    try {
      const updated = await db
        .update(accruals)
        .set({ status: "reversed", updatedAt: new Date() } as any)
        .where(eq(accruals.accrualId, aid))
        .returning({ id: accruals.accrualId });
      if (updated.length === 0) {
        summary.failed++;
        summary.errors.push({ id: aid, message: "Accrual not found" });
        continue;
      }
      await db
        .insert(accrualAuditTrail)
        .values({
          accrualId: aid,
          eventType: "reversed",
          description: reason,
          userName: ctx.userName,
          userId: ctx.userId ?? undefined,
        } as any)
        .catch(() => {});
      summary.succeeded++;
    } catch (e: any) {
      summary.failed++;
      summary.errors.push({ id: aid, message: e.message });
    }
  }
  return summary;
}

// ---- non-batch action execs (handled directly by approve, no batch op) -

export interface FlagBlockerPayload {
  title: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  aiSuggestion?: string;
  relatedObligationIds?: string[];
}

export async function execFlagBlocker(
  payload: FlagBlockerPayload,
  ctx: ActionExecCtx,
  decisionId: string,
): Promise<{ blockerId: string }> {
  const [row] = await db
    .insert(periodCloseBlockers)
    .values({
      periodId: ctx.periodId,
      title: payload.title,
      description: payload.description ?? null,
      severity: payload.severity ?? "medium",
      aiSuggestion: payload.aiSuggestion ?? null,
      proposedByAi: true,
      proposedDecisionId: decisionId,
      relatedObligationIds: payload.relatedObligationIds ?? null,
    } as any)
    .returning({ id: periodCloseBlockers.id });
  return { blockerId: row.id };
}

// ---- dispatcher --------------------------------------------------------

// Maps a CloseActionType to the BatchOpType that runIdempotentBatch
// should record. Only the action types that mutate ledger state appear
// here. hold_for_review / request_info / flag_blocker are intentionally
// excluded — those are handled inline in the decision approver and do
// NOT go through runIdempotentBatch.
export const BATCH_OP_BY_ACTION: Record<string, string> = {
  post_jes: "post_jes",
  settle_obligations: "settle_obligations",
  resolve_claims: "resolve_claims",
  apply_deductions: "apply_deductions",
  reverse_accruals: "reverse_accruals",
};

// Action types that don't go through runIdempotentBatch.
export const NON_BATCH_ACTIONS = new Set<string>([
  "hold_for_review",
  "request_info",
  "flag_blocker",
]);

export async function execBatchAction(
  actionType: CloseActionType,
  payload: any,
  ctx: ActionExecCtx,
): Promise<BatchResultSummary> {
  switch (actionType) {
    case "post_jes":
      return execPostJEs(payload as PostJEsPayload, ctx);
    case "settle_obligations":
      return execSettle(payload as SettlePayload, ctx);
    case "resolve_claims":
      return execResolveClaims(payload as ResolveClaimsPayload, ctx);
    case "apply_deductions":
      return execApplyDeductions(payload as ApplyDeductionsPayload, ctx);
    case "reverse_accruals":
      return execReverseAccruals(payload as ReverseAccrualsPayload, ctx);
    case "release_obligations":
      throw new Error(
        "Action 'release_obligations' is reserved but has no executor yet",
      );
    default:
      throw new Error(
        `Action '${actionType}' is not a batch action — use the inline approver`,
      );
  }
}
