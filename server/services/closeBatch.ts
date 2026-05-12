// server/services/closeBatch.ts
//
// Phase 1c — idempotent batch operations + audit trail helpers for the
// Period Close subledger workspace.
//
// All five Worksheet bulk actions (post-jes / settle / resolve-claims /
// apply-deductions / reverse-accruals) and every AI `executeDecision`
// dispatch funnel through `runIdempotentBatch` so a network retry,
// double-click, or replayed AI decision can never write twice.
//
// Spec: docs/period-close-data-model.md §2.6 + §5.2
//
// Idempotency contract (matches HTTP `Idempotency-Key` semantics):
//   - Key is `(companyId, operationType, idempotencyKey)` — the unique
//     index `close_batch_ops_idem_uq` enforces this at the DB level.
//   - First request with a given key creates a row with status='running',
//     executes, then stamps the result and `completedAt`.
//   - Subsequent requests with the same key short-circuit: they return
//     the prior row's `{ batchOperationId, status, resultSummary }` with
//     `replayed: true`. They never execute the action again.
//   - A request that arrives while the first is still 'running' also
//     returns the in-flight row (with empty resultSummary). Callers can
//     poll the row id to wait for completion in pathological cases.
//
// Audit trail: every batch op writes one `period_close_audit_trail` row
// on success/partial/failure stamped with the batch op id so SOX
// evidence pulls can join the two tables.

import { db } from "../db";
import { closeBatchOperations, periodCloseAuditTrail } from "@shared/schema";
import { and, eq, isNull } from "drizzle-orm";

export type BatchOpType =
  | "post_jes"
  | "settle_obligations"
  | "resolve_claims"
  | "apply_deductions"
  | "reverse_accruals"
  | "release_obligations";

export type BatchInitiatedVia = "worksheet" | "copilot" | "api";

export interface BatchResultSummary {
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
  // Operation-specific extras (e.g. dryRun preview rows) live alongside
  // the standard counts under arbitrary keys.
  [k: string]: any;
}

export interface RunBatchOpts<TPayload> {
  operationType: BatchOpType;
  // Required header value. Reject the request at the route layer if missing.
  idempotencyKey: string;
  periodId: string;
  initiatedBy?: string | null;
  initiatedVia?: BatchInitiatedVia;
  companyId?: string | null;
  payload: TPayload;
  // The actual work. Should NOT throw for per-item failures — push them
  // into `errors`. Throw only for catastrophic failures (DB down, etc.)
  // which mark the whole batch `failed`.
  exec: () => Promise<BatchResultSummary>;
  // Optional human-readable summary for the audit trail row description.
  describe?: (result: BatchResultSummary) => string;
}

export interface RunBatchResult {
  batchOperationId: string;
  status: "running" | "succeeded" | "partial" | "failed";
  resultSummary: BatchResultSummary | null;
  replayed: boolean;
}

const OP_TYPE_LABELS: Record<BatchOpType, string> = {
  post_jes: "Post journal entries",
  settle_obligations: "Settle obligations",
  resolve_claims: "Resolve claims",
  apply_deductions: "Apply deductions",
  reverse_accruals: "Reverse accruals",
  release_obligations: "Release obligations",
};

export async function runIdempotentBatch<TPayload>(
  opts: RunBatchOpts<TPayload>,
): Promise<RunBatchResult> {
  // 1. Look for an existing row with this idempotency key.
  //    The unique index covers (companyId, operationType, idempotencyKey).
  //    When companyId is null we MUST match with `IS NULL` — `eq(col, null)`
  //    emits `col = NULL` which is never true in SQL, so without isNull()
  //    the replay lookup would silently miss and we'd insert duplicates.
  const whereExisting = and(
    eq(closeBatchOperations.operationType, opts.operationType),
    eq(closeBatchOperations.idempotencyKey, opts.idempotencyKey),
    opts.companyId
      ? eq(closeBatchOperations.companyId, opts.companyId)
      : isNull(closeBatchOperations.companyId),
  );

  const existingRows = await db
    .select()
    .from(closeBatchOperations)
    .where(whereExisting);

  if (existingRows.length > 0) {
    const row = existingRows[0];
    return {
      batchOperationId: row.id,
      status: (row.status as RunBatchResult["status"]) || "running",
      resultSummary: (row.resultSummary as BatchResultSummary) || null,
      replayed: true,
    };
  }

  // 2. Insert the running row. The unique index protects us from a race
  //    where two requests arrive within the lookup window — the loser
  //    will throw a unique-constraint error which we re-read into a
  //    replay response.
  let inserted: typeof closeBatchOperations.$inferSelect;
  try {
    const result = await db
      .insert(closeBatchOperations)
      .values({
        idempotencyKey: opts.idempotencyKey,
        operationType: opts.operationType,
        periodId: opts.periodId,
        initiatedBy: opts.initiatedBy ?? null,
        initiatedVia: opts.initiatedVia ?? "worksheet",
        companyId: opts.companyId ?? null,
        payload: opts.payload as any,
        status: "running",
        startedAt: new Date(),
      })
      .returning();
    inserted = result[0];
  } catch (e: any) {
    // Race-loser path — re-read the winner and replay.
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      const racedRows = await db
        .select()
        .from(closeBatchOperations)
        .where(whereExisting);
      if (racedRows.length > 0) {
        const row = racedRows[0];
        return {
          batchOperationId: row.id,
          status: (row.status as RunBatchResult["status"]) || "running",
          resultSummary: (row.resultSummary as BatchResultSummary) || null,
          replayed: true,
        };
      }
    }
    throw e;
  }

  // 3. Execute. Catastrophic exception → mark batch `failed` and rethrow
  //    after the bookkeeping update so the audit trail captures it.
  let resultSummary: BatchResultSummary;
  let finalStatus: RunBatchResult["status"];
  try {
    resultSummary = await opts.exec();
    finalStatus =
      resultSummary.failed === 0
        ? "succeeded"
        : resultSummary.succeeded === 0
          ? "failed"
          : "partial";
  } catch (e: any) {
    resultSummary = {
      succeeded: 0,
      failed: 0,
      errors: [{ id: "_batch", message: e?.message || String(e) }],
    };
    finalStatus = "failed";
    await db
      .update(closeBatchOperations)
      .set({
        status: finalStatus,
        resultSummary: resultSummary as any,
        completedAt: new Date(),
      })
      .where(eq(closeBatchOperations.id, inserted.id));
    await writeBatchAuditRow(opts, inserted.id, finalStatus, resultSummary);
    throw e;
  }

  await db
    .update(closeBatchOperations)
    .set({
      status: finalStatus,
      resultSummary: resultSummary as any,
      completedAt: new Date(),
    })
    .where(eq(closeBatchOperations.id, inserted.id));

  await writeBatchAuditRow(opts, inserted.id, finalStatus, resultSummary);

  return {
    batchOperationId: inserted.id,
    status: finalStatus,
    resultSummary,
    replayed: false,
  };
}

async function writeBatchAuditRow<TPayload>(
  opts: RunBatchOpts<TPayload>,
  batchId: string,
  status: RunBatchResult["status"],
  summary: BatchResultSummary,
) {
  const label = OP_TYPE_LABELS[opts.operationType] ?? opts.operationType;
  const description = opts.describe
    ? opts.describe(summary)
    : `${label}: ${summary.succeeded} succeeded, ${summary.failed} failed${
        status === "succeeded" ? "" : ` (status=${status})`
      }`;
  try {
    await db.insert(periodCloseAuditTrail).values({
      periodId: opts.periodId,
      eventType: `batch_${opts.operationType}`,
      description,
      userId: opts.initiatedBy ?? null,
      actorType: opts.initiatedVia === "copilot" ? "ai" : "user",
      sourceBatchOperationId: batchId,
      iconColor:
        status === "succeeded" ? "green" : status === "partial" ? "amber" : "red",
      metadata: {
        operationType: opts.operationType,
        initiatedVia: opts.initiatedVia ?? "worksheet",
        succeeded: summary.succeeded,
        failed: summary.failed,
        errors: summary.errors,
      } as any,
    });
  } catch {
    // Audit write failure shouldn't propagate — the batch already succeeded
    // and the row id is in the response. Swallow silently.
  }
}
