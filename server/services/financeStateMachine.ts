/**
 * Finance Hub Phase A — centralised state-machine module.
 * Routes call these transition functions; never UPDATE … SET status directly.
 */
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  inboundClaims, inboundClaimEvents,
  financeDocuments, financeDocumentEvents, financeDocumentLines,
  obligations, obligationEvents,
  journalEntries, journalEntryLines,
  settlements, settlementLineItems,
} from "@shared/schema";
import { autoAttachClaimToSettlement } from "./claimSettlementMatcher";

export type ClaimAction =
  | "validate" | "agent_handle" | "approve" | "partial_approve"
  | "reject" | "open_dispute" | "respond_dispute" | "resolve_dispute"
  | "settle" | "escalate" | "reopen";

// `reopen` is the only "go-backwards" action — it lets a reviewer correct
// a wrong approve / partial_approve / reject decision by sending the claim
// back to needs_review. From every other state it's a no-op, which is
// then rejected at runtime so the UI can't fire it from where it doesn't
// make sense.
const CLAIM_TRANSITIONS: Record<string, Record<ClaimAction, string>> = {
  received: { validate: "validating", agent_handle: "agent_handling", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "received", settle: "settled", escalate: "escalated", reopen: "received" },
  validating: { validate: "validating", agent_handle: "agent_handling", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "validating", settle: "settled", escalate: "needs_review", reopen: "validating" },
  needs_review: { validate: "validating", agent_handle: "agent_handling", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "needs_review", settle: "settled", escalate: "escalated", reopen: "needs_review" },
  agent_handling: { validate: "agent_handling", agent_handle: "agent_handling", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "needs_review", settle: "settled", escalate: "needs_review", reopen: "agent_handling" },
  approved: { validate: "approved", agent_handle: "approved", approve: "approved", partial_approve: "approved", reject: "approved", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "approved", settle: "settled", escalate: "approved", reopen: "needs_review" },
  partial_approved: { validate: "partial_approved", agent_handle: "partial_approved", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "partial_approved", settle: "settled", escalate: "needs_review", reopen: "needs_review" },
  rejected: { validate: "rejected", agent_handle: "rejected", approve: "rejected", partial_approve: "rejected", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "rejected", settle: "rejected", escalate: "rejected", reopen: "needs_review" },
  disputed: { validate: "disputed", agent_handle: "disputed", approve: "disputed", partial_approve: "disputed", reject: "disputed", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "needs_review", settle: "settled", escalate: "escalated", reopen: "disputed" },
  settled: { validate: "settled", agent_handle: "settled", approve: "settled", partial_approve: "settled", reject: "settled", open_dispute: "settled", respond_dispute: "settled", resolve_dispute: "settled", settle: "settled", escalate: "settled", reopen: "settled" },
  escalated: { validate: "escalated", agent_handle: "escalated", approve: "approved", partial_approve: "partial_approved", reject: "rejected", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "needs_review", settle: "settled", escalate: "escalated", reopen: "escalated" },
};

export interface TransitionInboundClaimOpts {
  claimId: string;
  action: ClaimAction;
  userId?: string | null;
  userName?: string | null;
  amount?: string | number | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  /** Tenant guard: when set, claim.companyId must match. Skip only for trusted system flows (e.g. intake agent already resolved scope). */
  companyScopeId?: string | null;
}

export async function transitionInboundClaim(opts: TransitionInboundClaimOpts) {
  const [row] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, opts.claimId));
  if (!row) throw new Error("Claim not found");
  if (opts.companyScopeId && row.companyId && row.companyId !== opts.companyScopeId) {
    throw new Error("Out of scope");
  }
  const fromStatus = row.status || "received";
  const candidate = CLAIM_TRANSITIONS[fromStatus]?.[opts.action];
  if (!candidate) throw new Error(`Illegal claim transition: ${fromStatus} → ${opts.action}`);
  // The transition table maps "stuck" actions back to the same status as a
  // no-op (e.g. `disputed.approve = "disputed"`). Allowing those silently
  // would let the UI report "Action recorded" while the claim never moves.
  // For decision actions (approve / partial_approve / reject), the caller
  // explicitly asked to advance the lifecycle — so refuse and tell them
  // what to do first instead.
  const DECISION_ACTIONS = new Set(["approve", "partial_approve", "reject"]);
  if (candidate === fromStatus && DECISION_ACTIONS.has(opts.action)) {
    if (fromStatus === "disputed") {
      throw new Error(
        `Cannot ${opts.action} a disputed claim. Resolve the dispute first (action: resolve_dispute), then take a decision.`,
      );
    }
    throw new Error(
      `Cannot ${opts.action} a claim in '${fromStatus}' state — no lifecycle transition is available.`,
    );
  }
  // Reopen is the explicit "fix a wrong decision" lever. Only valid from
  // approved / partial_approved / rejected — anywhere else it'd be a
  // confusing no-op. We also refuse if the linked credit memo has already
  // left draft (sent / awaiting_oracle / posted / paid), since at that
  // point downstream finance has already acted and the correction needs
  // a void-and-replace, not a state rewind.
  if (opts.action === "reopen") {
    if (candidate === fromStatus) {
      throw new Error(
        `Cannot reopen a claim in '${fromStatus}' state — only approved, partial_approved, or rejected claims can be reopened.`,
      );
    }
    if (row.linkedDocumentId) {
      const [linkedDoc] = await db.select().from(financeDocuments)
        .where(eq(financeDocuments.id, row.linkedDocumentId));
      if (linkedDoc && linkedDoc.status !== "draft" && linkedDoc.status !== "voided") {
        throw new Error(
          `Cannot reopen — linked credit memo ${linkedDoc.documentNumber} is already ${linkedDoc.status}. Void it first.`,
        );
      }
    }
  }
  const updates: any = { status: candidate, updatedAt: new Date() };
  if (opts.action === "approve" || opts.action === "partial_approve") {
    updates.approvedAt = new Date();
    if (opts.userId) updates.approvedBy = opts.userId;
    if (opts.amount != null) {
      updates.approvedAmount = String(opts.amount);
    } else if (opts.action === "approve") {
      // Full approve = the reviewer accepted the claim as filed. Persist the
      // claimed amount as the approved amount so downstream artifacts
      // (credit memos, settlement gates, GL postings) have an authoritative
      // $ value to work with instead of falling back through nullable fields.
      if (row.claimedAmount != null) updates.approvedAmount = String(row.claimedAmount);
    }
  }
  if (opts.action === "reopen") {
    // Wipe the prior decision so the claim looks fresh in needs_review.
    // The audit trail (inboundClaimEvents) preserves the history for any
    // compliance review of "who approved $X then changed their mind."
    updates.approvedAt = null;
    updates.approvedBy = null;
    updates.approvedAmount = null;
  }
  if (opts.action === "reject") {
    // Rejected claims should clear their approval ghost too — otherwise
    // a claim approved at $X then later rejected via reopen→reject still
    // carries approvedAmount=$X, which downstream "is this approved?"
    // checks misinterpret. The audit log keeps the prior approval event
    // for compliance.
    updates.approvedAt = null;
    updates.approvedBy = null;
    updates.approvedAmount = null;
  }
  if (opts.action === "open_dispute") updates.disputeState = "open";
  if (opts.action === "respond_dispute") updates.disputeState = "responded";
  if (opts.action === "resolve_dispute") updates.disputeState = "resolved";
  if (opts.action === "agent_handle") { updates.agentHandled = true; updates.priority = "agent_handling"; }
  await db.update(inboundClaims).set(updates).where(eq(inboundClaims.id, opts.claimId));
  await db.insert(inboundClaimEvents).values({
    claimId: opts.claimId, eventType: opts.action, fromStatus, toStatus: candidate,
    amount: opts.amount != null ? String(opts.amount) : null,
    description: opts.description || null, userId: opts.userId || null,
    userName: opts.userName || null, metadata: opts.metadata || null,
  });
  const merged = { ...row, ...updates };

  // After approve / partial_approve, push the agreed amount onto any
  // attached settlement so the workspace reflects what finance actually
  // signed off on (not the original claimed ask). Errors are swallowed
  // — the state transition itself must still succeed even if the matcher
  // can't find a settlement to update.
  if (opts.action === "approve" || opts.action === "partial_approve") {
    try {
      const [fresh] = await db.select().from(inboundClaims)
        .where(eq(inboundClaims.id, opts.claimId));
      if (fresh) {
        await autoAttachClaimToSettlement(fresh, { useApprovedAmount: true });
      }
    } catch (err) {
      console.warn(
        `[transitionInboundClaim] settlement re-attach failed for claim ${opts.claimId}:`,
        (err as Error)?.message,
      );
    }
  }

  // After reject / reopen, any settlement that was already mirroring this
  // claim's amount is now stale and would keep showing the old number.
  // Reset it back to "awaiting claim" so the next valid claim that
  // arrives (or a corrected re-decision) can take ownership cleanly.
  if (opts.action === "reject" || opts.action === "reopen") {
    try {
      await detachClaimFromSettlements(opts.claimId);
    } catch (err) {
      console.warn(
        `[transitionInboundClaim] settlement detach failed for claim ${opts.claimId}:`,
        (err as Error)?.message,
      );
    }
  }

  return merged;
}

/**
 * Reset any settlement currently linked to this claim back to its
 * "no claim attached" state — accrual stays put, but claim_id, claim_ref,
 * claim_amount, variance and match_status are cleared / recomputed so
 * the workspace shows "Awaiting claim" again. Also wipes the per-line
 * customerClaim mirror so the line-item table doesn't keep the stale
 * dollar values.
 */
async function detachClaimFromSettlements(claimId: string) {
  const linked = await db.select().from(settlements)
    .where(eq(settlements.claimId, claimId));
  for (const s of linked) {
    const accrual = parseFloat(s.accrualAmount || "0");
    await db.update(settlements).set({
      claimId: null,
      claimRef: null,
      claimAmount: "0",
      // No claim → no comparison; variance becomes the full accrual but
      // the UI now treats claim_amount === 0 as "awaiting claim" and
      // hides the misleading red variance, so this is safe.
      variance: accrual.toFixed(2),
      matchStatus: "open",
      updatedAt: new Date(),
    } as any).where(eq(settlements.id, s.id));
    // Mirror $0 onto the line items so the comparison table also resets.
    const lines = await db.select().from(settlementLineItems)
      .where(eq(settlementLineItems.settlementId, s.id));
    for (const li of lines) {
      const lineAccrual = parseFloat(li.accrualAmount || "0");
      await db.update(settlementLineItems).set({
        claimAmount: "0",
        variance: lineAccrual.toFixed(2),
      } as any).where(eq(settlementLineItems.id, li.id));
    }
  }
}

export type DocAction = "send" | "mark_oracle_pending" | "mark_oracle_posted" | "mark_paid" | "void";
const DOC_TRANSITIONS: Record<string, Record<DocAction, string>> = {
  draft: { send: "sent", mark_oracle_pending: "awaiting_oracle", mark_oracle_posted: "posted", mark_paid: "paid", void: "voided" },
  sent: { send: "sent", mark_oracle_pending: "awaiting_oracle", mark_oracle_posted: "posted", mark_paid: "paid", void: "voided" },
  awaiting_oracle: { send: "awaiting_oracle", mark_oracle_pending: "awaiting_oracle", mark_oracle_posted: "posted", mark_paid: "paid", void: "voided" },
  posted: { send: "posted", mark_oracle_pending: "posted", mark_oracle_posted: "posted", mark_paid: "paid", void: "voided" },
  paid: { send: "paid", mark_oracle_pending: "paid", mark_oracle_posted: "paid", mark_paid: "paid", void: "voided" },
  voided: { send: "voided", mark_oracle_pending: "voided", mark_oracle_posted: "voided", mark_paid: "voided", void: "voided" },
};

export type ObligationAction = "submit" | "approve" | "reject" | "open_dispute" | "respond_dispute" | "resolve_dispute" | "settle";
const OBLIGATION_TRANSITIONS: Record<string, Record<ObligationAction, string>> = {
  draft:           { submit: "claim_submitted", approve: "approved",        reject: "expired",  open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "draft",     settle: "settled" },
  claim_submitted: { submit: "claim_submitted", approve: "approved",        reject: "expired",  open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "claim_submitted", settle: "settled" },
  approved:        { submit: "approved",        approve: "approved",        reject: "approved", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "approved", settle: "settled" },
  disputed:        { submit: "disputed",        approve: "disputed",        reject: "disputed", open_dispute: "disputed", respond_dispute: "disputed", resolve_dispute: "approved", settle: "settled" },
  expired:         { submit: "expired",         approve: "expired",         reject: "expired",  open_dispute: "expired",  respond_dispute: "expired",  resolve_dispute: "expired",  settle: "expired" },
  settled:         { submit: "settled",         approve: "settled",         reject: "settled",  open_dispute: "settled",  respond_dispute: "settled",  resolve_dispute: "settled",  settle: "settled" },
};

// Map Phase A's outbound-claim action vocabulary onto the canonical obligation
// lifecycle exposed by `obligationsService.transitionObligation`. We *delegate*
// lifecycle changes to the canonical implementation so that journal entries,
// event semantics, and validation rules stay consistent across the app.
//
// Dispute actions (open/respond/resolve) are not part of the canonical
// lifecycle — they only mutate `disputeState` without changing `status` — so
// we apply those updates here directly without going through the canonical
// state machine.
import { transitionObligation, type ObligationAction as CanonicalObligationAction } from "./obligationsService";

const PHASE_A_TO_CANONICAL: Partial<Record<ObligationAction, CanonicalObligationAction>> = {
  submit: "submit_claim",
  approve: "approve_claim",
  reject: "expire",
  settle: "mark_paid",
};

export async function transitionOutboundObligation(opts: {
  obligationId: string; action: ObligationAction;
  userId?: string | null; userName?: string | null;
  amount?: string | number | null; description?: string | null;
  companyScopeId?: string | null;
}) {
  const [row] = await db.select().from(obligations).where(eq(obligations.id, opts.obligationId));
  if (!row) throw new Error("Obligation not found");
  if (opts.companyScopeId && row.companyId && row.companyId !== opts.companyScopeId) {
    throw new Error("Out of scope");
  }

  // Dispute actions: write the event + dispute state without changing status.
  if (opts.action === "open_dispute" || opts.action === "respond_dispute" || opts.action === "resolve_dispute") {
    const fromStatus = row.status || "accrued";
    const disputeState = opts.action === "open_dispute" ? "open"
      : opts.action === "respond_dispute" ? "responded" : "resolved";
    await db.update(obligations)
      .set({ disputeState, updatedAt: new Date() })
      .where(eq(obligations.id, opts.obligationId));
    await db.insert(obligationEvents).values({
      obligationId: opts.obligationId, eventType: opts.action, fromStatus, toStatus: fromStatus,
      description: opts.description || null, userId: opts.userId || null, userName: opts.userName || null,
    });
    const [refreshed] = await db.select().from(obligations).where(eq(obligations.id, opts.obligationId));
    return refreshed;
  }

  // Lifecycle actions: delegate to the canonical obligation state machine.
  const canonical = PHASE_A_TO_CANONICAL[opts.action];
  if (!canonical) throw new Error(`Unsupported outbound obligation action: ${opts.action}`);
  const amt = opts.amount != null ? Number(opts.amount) : undefined;
  const { obligation } = await transitionObligation(opts.obligationId, canonical, {
    amount: amt,
    notes: opts.description || undefined,
    userId: opts.userId || undefined,
    userName: opts.userName || undefined,
  });
  return obligation;
}

export async function transitionFinanceDocument(opts: { documentId: string; action: DocAction; userId?: string | null; userName?: string | null; description?: string | null; companyScopeId?: string | null; }) {
  const [row] = await db.select().from(financeDocuments).where(eq(financeDocuments.id, opts.documentId));
  if (!row) throw new Error("Document not found");
  if (opts.companyScopeId && row.companyId && row.companyId !== opts.companyScopeId) {
    throw new Error("Out of scope");
  }
  const fromStatus = row.status || "draft";
  const candidate = DOC_TRANSITIONS[fromStatus]?.[opts.action];
  if (!candidate) throw new Error(`Illegal document transition: ${fromStatus} → ${opts.action}`);
  const updates: any = { status: candidate, updatedAt: new Date() };
  if (opts.action === "mark_oracle_posted") updates.oracleStatus = "accepted";
  if (opts.action === "mark_oracle_pending") updates.oracleStatus = "pending";

  // JE pipeline branching: when a finance_document transitions into `posted`
  // we emit a draft journal entry whose debit/credit shape depends on the
  // document's origin (AR invoice, AP invoice, credit memo, debit memo).
  // Memos are booked as reversals of their parent invoice flow. The JE id is
  // attached back onto the document so downstream views can deep-link.
  let createdJeId: string | null = null;
  if (candidate === "posted" && !row.jeId) {
    createdJeId = await emitFinanceDocumentJournalEntry(row);
    if (createdJeId) updates.jeId = createdJeId;
  }

  await db.update(financeDocuments).set(updates).where(eq(financeDocuments.id, opts.documentId));
  await db.insert(financeDocumentEvents).values({
    documentId: opts.documentId, eventType: opts.action, fromStatus, toStatus: candidate,
    description: opts.description || (createdJeId ? `JE ${createdJeId} drafted` : null),
    userId: opts.userId || null, userName: opts.userName || null,
  });

  // Phase A close-the-loop: when a credit memo (or any finance document
  // generated from an inbound claim) finishes its journey to `posted`,
  // we used to leave the upstream settlement stuck in "Matched — Pending
  // Approval" forever because nothing flipped its `settlementStatus`.
  // The only path that did that was `clearSettlementResidual`, which is
  // only invoked when there's a non-zero residual variance — so a fully-
  // matched ($0 variance) settlement would never close.
  //
  // Now: on transition into `posted`, look up the inbound claim that
  // generated this document (via `linked_document_id`) and the
  // settlement attached to that claim. If the settlement is
  // fully_matched and not yet posted, flip it to `posted`, set
  // postedAmount = accrualAmount, and stamp the JE id for traceability.
  // Wrapped in try/catch so a settlement-side failure can never roll
  // back the document transition itself — the side-effect is observable
  // via the logged warning.
  if (candidate === "posted") {
    try {
      const [claimRow] = await db.select()
        .from(inboundClaims)
        .where(eq(inboundClaims.linkedDocumentId, opts.documentId))
        .limit(1);
      if (claimRow) {
        const [settlementRow] = await db.select()
          .from(settlements)
          .where(eq(settlements.claimId, claimRow.id))
          .limit(1);
        if (
          settlementRow
          && settlementRow.matchStatus === "fully_matched"
          && settlementRow.settlementStatus !== "posted"
        ) {
          const accrualStr = settlementRow.accrualAmount || "0";
          await db.update(settlements).set({
            settlementStatus: "posted",
            postedAmount: accrualStr,
            jeId: settlementRow.jeId || createdJeId || null,
            updatedAt: new Date(),
          } as never).where(eq(settlements.id, settlementRow.id));
          console.log(
            `[transitionFinanceDocument] auto-posted settlement ${settlementRow.id} `
            + `(claim ${claimRow.id}, doc ${opts.documentId}, je ${createdJeId || settlementRow.jeId || 'n/a'})`
          );
        }
      }
    } catch (err) {
      console.warn(
        `[transitionFinanceDocument] settlement auto-post failed for doc ${opts.documentId}:`,
        (err as Error)?.message,
      );
    }
  }

  return { ...row, ...updates };
}

/**
 * Emit a draft journal entry for a finance_document on its first post.
 * Posting policy (kept intentionally narrow for Phase A):
 *   ar_invoice   → DR 1200 A/R         CR 4000 Revenue
 *   ap_invoice   → DR 5000 Expense     CR 2000 A/P
 *   credit_memo  → reverses the prior AR flow (DR Revenue, CR A/R)
 *   debit_memo   → reverses the prior AP flow (DR A/P, CR Expense)
 * Unknown document_type values short-circuit (no JE) — callers can extend
 * the mapping rather than silently misposting.
 */
async function emitFinanceDocumentJournalEntry(doc: any): Promise<string | null> {
  const total = Number(doc.amount || 0);
  if (!Number.isFinite(total) || total === 0) return null;

  type Side = { code: string; name: string };
  const policy: Record<string, { dr: Side; cr: Side; flow: string }> = {
    ar_invoice:  { dr: { code: "1200", name: "Accounts Receivable" }, cr: { code: "4000", name: "Revenue" },             flow: "ar_invoice" },
    ap_invoice:  { dr: { code: "5000", name: "Expense" },              cr: { code: "2000", name: "Accounts Payable" },    flow: "ap_invoice" },
    credit_memo: { dr: { code: "4000", name: "Revenue (Reversal)" },   cr: { code: "1200", name: "Accounts Receivable" }, flow: "credit_memo" },
    debit_memo:  { dr: { code: "2000", name: "Accounts Payable" },     cr: { code: "5000", name: "Expense (Reversal)" },  flow: "debit_memo" },
  };
  const p = policy[doc.documentType];
  if (!p) return null;

  const jeIdStr = `DOC-${(doc.documentType || "DOC").toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${String(doc.id).slice(0, 6)}`;
  const amt = Math.abs(total).toFixed(2);

  await db.insert(journalEntries).values({
    jeId: jeIdStr,
    contractId: doc.contractId || null,
    contractName: doc.contractName || null,
    counterparty: doc.partnerName || null,
    flowType: p.flow,
    period: doc.period || new Date().toISOString().slice(0, 7),
    totalAmount: amt,
    jeStage: "draft",
    erpSyncStatus: "na",
    balanced: true,
    companyId: doc.companyId || null,
    createdBy: doc.createdBy || null,
  });
  await db.insert(journalEntryLines).values([
    { jeId: jeIdStr, accountCode: p.dr.code, accountName: p.dr.name, debitAmount: amt, creditAmount: "0", description: `${doc.documentType} ${doc.documentNumber}` },
    { jeId: jeIdStr, accountCode: p.cr.code, accountName: p.cr.name, debitAmount: "0", creditAmount: amt, description: `${doc.documentType} ${doc.documentNumber}` },
  ]);
  return jeIdStr;
}
