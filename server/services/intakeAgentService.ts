/**
 * LicenseIQ Intake Agent (Phase A — in-process).
 *
 * Receives canonical inbound event envelopes and routes them to the right
 * primitive: inbound_claims (claim.received / claim.updated),
 * inboundClaimEvents (dispute.responded), financeDocumentEvents
 * (oracle.payment.applied / oracle.document.posted).
 *
 * Performs entity resolution against contracts.counterpartyName / contracts
 * (full-name fuzzy fallback) and writes agent_activity rows for every step.
 *
 * Auto-resolves when entities resolve cleanly and amounts validate; escalates
 * to needs_review otherwise.
 */
import { db } from "../db";
import { and, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import {
  inboundClaims, inboundClaimLines, inboundClaimEvents,
  financeDocuments, financeDocumentEvents,
  agentActivity, contracts, claimTypeOutcome,
  flowTypes, companySettings,
  BUILT_IN_DOCUMENT_TYPE_MATRIX, lookupDocumentTypeMatrixRow,
  type SettlementDirection,
} from "@shared/schema";
import { transitionFinanceDocument } from "./financeStateMachine";
import { nextInboundClaimNumber } from "./documentSequenceService";
import { findBestMatch as fuzzyFindBestMatch } from "./valueLinkingService";
import { autoAttachClaimToSettlement } from "./claimSettlementMatcher";

// Optional string fields accept `null` as well as `undefined` because many
// JSON producers (browsers, ETL tools) serialize empty inputs as `null`.
// Treat both as "absent" rather than rejecting the whole envelope.
const optStr = z.string().optional().nullable();
const optNum = z.union([z.string(), z.number()]).optional().nullable();

export const inboundEventEnvelopeSchema = z.object({
  source_event_id: z.string().min(1),
  event_type: z.enum(["claim.received", "claim.updated", "dispute.responded", "oracle.payment.applied", "oracle.document.posted"]),
  legal_entity_id: optStr,
  occurred_at: optStr,
  payload: z.object({
    claim_type: optStr,
    partner_name: optStr,
    partner_id: optStr,
    contract_reference: optStr,
    contract_id: optStr,
    period: optStr,
    amount: optNum,
    currency: optStr,
    document_number: optStr,
    oracle_doc_number: optStr,
    oracle_status: optStr,
    notes: optStr,
    lines: z.array(z.object({
      description: optStr,
      sku: optStr,
      quantity: optNum,
      unit_amount: optNum,
      amount: optNum,
    })).optional().nullable(),
    dispute_response: optStr,
    claim_id: optStr,
  }).default({}),
});

export type InboundEventEnvelope = z.infer<typeof inboundEventEnvelopeSchema>;

async function logStep(scope: string, scopeId: string | null, step: string, status: string, summary: string, details?: any, companyId?: string | null, legalEntityId?: string | null) {
  await db.insert(agentActivity).values({
    scope, scopeId, step, status, summary, details: details || null,
    companyId: companyId || null, legalEntityId: legalEntityId || null,
  });
}

interface ResolutionResult { contractId: string | null; contractName: string | null; partnerId: string | null; partnerName: string | null; companyId: string | null; confidence: number; method: string; }

async function resolveEntities(payload: any, legalEntityId?: string | null, scopeCompanyId?: string | null): Promise<ResolutionResult> {
  const partnerName = payload.partner_name as string | undefined;
  const contractRef = (payload.contract_reference || payload.contract_id) as string | undefined;
  let row: any = null;
  let method = "none";
  let confidence = 0;

  // Hard tenant scope: when an authenticated key carries a companyId, contract
  // lookups are restricted to that tenant. This blocks cross-tenant writes
  // through guessed/fuzzy contract references on the public intake endpoint.
  const scopeWhere = scopeCompanyId ? sql`AND ${contracts.companyId} = ${scopeCompanyId}` : sql``;

  if (contractRef) {
    const exact = await db.select().from(contracts).where(
      sql`(${contracts.contractNumber} = ${contractRef} OR ${contracts.id} = ${contractRef} OR ${contracts.displayName} = ${contractRef}) ${scopeWhere}`
    ).limit(1);
    if (exact.length) { row = exact[0]; method = "contract_exact"; confidence = 0.99; }
  }
  if (!row && partnerName) {
    // Reuse the canonical valueLinkingService fuzzy matcher so intake matching
    // shares the same scoring/normalization rules used elsewhere (ERP value
    // linking, master data linker). We hand it a list of contract candidates
    // restricted to the API key's tenant.
    const candidates = await db.select({
      id: contracts.id, displayName: contracts.displayName,
      counterpartyName: contracts.counterpartyName, contractNumber: contracts.contractNumber,
    }).from(contracts).where(
      scopeCompanyId ? eq(contracts.companyId, scopeCompanyId) : sql`true`
    ).limit(500);
    const records = candidates.map(c => ({
      id: c.id,
      recordData: {
        counterparty_name: c.counterpartyName,
        display_name: c.displayName,
        contract_number: c.contractNumber,
      },
    }));
    const match = fuzzyFindBestMatch(partnerName, records, "contracts");
    if (match) {
      const [hit] = await db.select().from(contracts).where(eq(contracts.id, match.recordId)).limit(1);
      if (hit) { row = hit; method = `value_link:${match.matchMethod}`; confidence = match.confidence; }
    }
  }

  if (!row) return { contractId: null, contractName: null, partnerId: payload.partner_id || null, partnerName: partnerName || null, companyId: null, confidence: 0, method: "unresolved" };
  return {
    contractId: row.id,
    contractName: row.displayName || row.contractNumber || row.fileName,
    partnerId: row.counterpartyPartnerId || payload.partner_id || null,
    partnerName: row.counterpartyName || partnerName || null,
    companyId: row.companyId || null,
    confidence, method,
  };
}

export interface IntakeResult {
  outcome: "accepted" | "duplicate" | "rejected" | "escalated";
  claimId?: string;
  documentId?: string;
  message?: string;
}

export async function processInboundEvent(
  envelope: InboundEventEnvelope,
  ctx: { companyId?: string | null } = {},
): Promise<IntakeResult & { companyId?: string | null }> {
  await logStep("event", envelope.source_event_id, "received", "info", `Received ${envelope.event_type}`, envelope, null, envelope.legal_entity_id);

  if (envelope.event_type === "claim.received" || envelope.event_type === "claim.updated") {
    const p = envelope.payload || {};
    const resolvedRaw = await resolveEntities(p, envelope.legal_entity_id, ctx.companyId ?? null);
    // Cross-tenant guard: if the API key carries a tenant and entity
    // resolution somehow returned a contract from a different tenant, refuse.
    if (ctx.companyId && resolvedRaw.companyId && resolvedRaw.companyId !== ctx.companyId) {
      return { outcome: "rejected", message: "Resolved entity belongs to a different tenant", companyId: ctx.companyId };
    }
    // Fall back to the API key's company scope when entity resolution can't
    // identify a tenant (so the claim isn't orphaned outside any company).
    const resolved = { ...resolvedRaw, companyId: resolvedRaw.companyId || (ctx.companyId ?? null) };
    await logStep("event", envelope.source_event_id, "entity_resolution", resolved.confidence > 0 ? "success" : "warn",
      `Resolved via ${resolved.method} @ ${(resolved.confidence * 100).toFixed(0)}%`, resolved, resolved.companyId, envelope.legal_entity_id);

    const amount = p.amount != null ? String(p.amount) : "0";
    const numericAmount = Number(amount);
    const validationOk = Number.isFinite(numericAmount) && numericAmount >= 0;
    await logStep("event", envelope.source_event_id, "validation", validationOk ? "success" : "warn",
      validationOk ? "Amount and structure valid" : "Validation flagged amount", { amount, validationOk }, resolved.companyId, envelope.legal_entity_id);

    // Correlation strategy:
    //   1. Prefer envelope.payload.claim_id matched to inbound_claims.external_claim_id
    //   2. Fall back to (partner+contract+period+claim_type) tuple
    //   3. Otherwise create a new claim
    let claim: typeof inboundClaims.$inferSelect | undefined;
    const externalClaimId = (p.claim_id as string | undefined) || undefined;
    if (externalClaimId) {
      const existing = await db.select().from(inboundClaims).where(eq(inboundClaims.externalClaimId, externalClaimId)).limit(1);
      if (existing.length) claim = existing[0];
    }
    if (!claim && envelope.event_type === "claim.updated" && resolved.contractId && p.period) {
      const tuple = await db.select().from(inboundClaims).where(and(
        eq(inboundClaims.contractId, resolved.contractId),
        eq(inboundClaims.period, p.period),
        eq(inboundClaims.claimType, p.claim_type || "other"),
      )).limit(1);
      if (tuple.length) claim = tuple[0];
    }
    if (claim) {
      await db.update(inboundClaims).set({
        claimedAmount: amount,
        externalClaimId: externalClaimId || claim.externalClaimId,
        updatedAt: new Date(),
      }).where(eq(inboundClaims.id, claim.id));
      await db.insert(inboundClaimEvents).values({
        claimId: claim.id, eventType: "intake.update", fromStatus: claim.status, toStatus: claim.status,
        amount, description: `Updated from ${envelope.event_type} (source ${envelope.source_event_id})`,
        userName: "LicenseIQ Intake Agent",
      });
    } else {
      const autoResolve = resolved.confidence >= 0.9 && validationOk;
      const status = autoResolve ? "agent_handling" : "needs_review";
      const priority = autoResolve ? "agent_handling" : (numericAmount > 100000 ? "urgent" : "standard");
      const claimNumber = await nextInboundClaimNumber();
      const [inserted] = await db.insert(inboundClaims).values({
        claimNumber,
        claimType: p.claim_type || "other",
        partnerId: resolved.partnerId, partnerName: resolved.partnerName,
        contractId: resolved.contractId, contractName: resolved.contractName,
        period: p.period || null,
        claimedAmount: amount, currency: p.currency || "USD",
        status, priority, agentHandled: autoResolve,
        sourceChannel: "dataiq", sourceEventId: envelope.source_event_id,
        externalClaimId: externalClaimId || null,
        legalEntityId: envelope.legal_entity_id || null,
        rawPayload: envelope, companyId: resolved.companyId,
      }).returning();
      claim = inserted;
      if (Array.isArray(p.lines)) {
        for (let i = 0; i < p.lines.length; i++) {
          const ln = p.lines[i];
          await db.insert(inboundClaimLines).values({
            claimId: inserted.id, description: ln.description || null, sku: ln.sku || null,
            quantity: ln.quantity != null ? String(ln.quantity) : "0",
            unitAmount: ln.unit_amount != null ? String(ln.unit_amount) : "0",
            amount: ln.amount != null ? String(ln.amount) : "0",
            sortOrder: i,
          });
        }
      }
      await db.insert(inboundClaimEvents).values({
        claimId: inserted.id, eventType: "intake", fromStatus: null, toStatus: status,
        amount, description: `Created from ${envelope.event_type}`,
        userName: "LicenseIQ Intake Agent",
      });
    }

    if (!claim) return { outcome: "rejected", message: "Failed to upsert claim" };
    await logStep("claim", claim.id, "decision", "success",
      claim.status === "agent_handling" ? "Auto-resolved by agent" : "Escalated for review",
      { status: claim.status }, resolved.companyId, envelope.legal_entity_id);

    // Auto-attach to a settlement keyed on (contract, period). Failures
    // here MUST NOT roll back the claim itself — log and move on so the
    // intake flow remains best-effort idempotent.
    //
    // Re-select the claim before passing to the matcher: in the
    // claim.updated merge path the local `claim` is the row read BEFORE
    // the amount update, so its claimedAmount would be stale.
    try {
      const [fresh] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, claim.id));
      const attach = await autoAttachClaimToSettlement(fresh ?? claim);
      if (attach) {
        await logStep("claim", claim.id, "settlement-attach", "success",
          attach.created
            ? `Created settlement ${attach.settlementId} (${attach.matchStatus})`
            : `Attached to existing settlement ${attach.settlementId} (${attach.matchStatus})`,
          attach, resolved.companyId, envelope.legal_entity_id);
        await db.insert(inboundClaimEvents).values({
          claimId: claim.id,
          eventType: "settlement.attached",
          description: attach.created
            ? `Created settlement ${attach.settlementId.slice(0, 8)} for ${claim.period}`
            : `Linked to settlement ${attach.settlementId.slice(0, 8)} (${attach.matchStatus})`,
          userName: "LicenseIQ Intake Agent",
        } as any);
      }
    } catch (err: any) {
      await logStep("claim", claim.id, "settlement-attach", "error",
        err?.message || "Settlement auto-attach failed", { error: err?.message },
        resolved.companyId, envelope.legal_entity_id);
    }

    return { outcome: claim.status === "agent_handling" ? "accepted" : "escalated", claimId: claim.id, companyId: resolved.companyId };
  }

  if (envelope.event_type === "dispute.responded") {
    const claimId = envelope.payload.claim_id;
    if (!claimId) return { outcome: "rejected", message: "claim_id required" };
    // Tenant guard: look the claim up, then verify the calling key's
    // companyId matches before mutating. Without this, a valid key from
    // tenant A could touch tenant B's claim by guessing the id.
    const [claim] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, claimId));
    if (!claim) return { outcome: "rejected", message: `Unknown claim_id ${claimId}` };
    if (ctx.companyId && claim.companyId && claim.companyId !== ctx.companyId) {
      return { outcome: "rejected", message: "claim_id outside API key scope" };
    }
    await db.insert(inboundClaimEvents).values({
      claimId, eventType: "dispute.responded", description: envelope.payload.dispute_response || null,
      userName: "Counterparty (via Intake)",
    });
    await db.update(inboundClaims).set({ disputeState: "responded", updatedAt: new Date() }).where(eq(inboundClaims.id, claimId));
    await logStep("claim", claimId, "decision", "info", "Dispute response received", envelope.payload, claim.companyId, envelope.legal_entity_id);
    return { outcome: "accepted", claimId, companyId: claim.companyId };
  }

  if (envelope.event_type === "oracle.document.posted" || envelope.event_type === "oracle.payment.applied") {
    const docNum = envelope.payload.document_number;
    if (!docNum) return { outcome: "rejected", message: "document_number required" };
    const [doc] = await db.select().from(financeDocuments).where(eq(financeDocuments.documentNumber, docNum));
    if (!doc) return { outcome: "rejected", message: `Unknown document_number ${docNum}` };
    // Tenant guard: document_number is unique globally but multi-tenant —
    // verify the document belongs to the calling key's company before any
    // state machine transition.
    if (ctx.companyId && doc.companyId && doc.companyId !== ctx.companyId) {
      return { outcome: "rejected", message: "document_number outside API key scope" };
    }
    // Status changes go through the centralised state machine so that
    // transitions and emitted events stay consistent across all entry points.
    try {
      await transitionFinanceDocument({
        documentId: doc.id,
        action: envelope.event_type === "oracle.payment.applied" ? "mark_paid" : "mark_oracle_posted",
        userName: "LicenseIQ Intake Agent",
        description: "Oracle event applied",
        companyScopeId: ctx.companyId ?? null,
      });
    } catch (e: any) {
      return { outcome: "rejected", message: e.message };
    }
    // Oracle doc number is metadata, not a status field — set after the transition.
    if (envelope.payload.oracle_doc_number && envelope.payload.oracle_doc_number !== doc.oracleDocNumber) {
      await db.update(financeDocuments)
        .set({ oracleDocNumber: envelope.payload.oracle_doc_number, updatedAt: new Date() })
        .where(eq(financeDocuments.id, doc.id));
    }
    await logStep("document", doc.id, "decision", "success", `Oracle event ${envelope.event_type} applied`, envelope.payload, doc.companyId, envelope.legal_entity_id);
    return { outcome: "accepted", documentId: doc.id };
  }

  return { outcome: "rejected", message: "Unhandled event_type" };
}

/**
 * Resolve (claim_type, direction) → document_type. Cascade order:
 *   1. contract.settlementPolicies.documentTypeMatrix
 *   2. flow_types.documentTypeOverrides (via contract.flowTypeCode)
 *   3. companySettings.settlementPolicies.documentTypeMatrix
 *   4. BUILT_IN_DOCUMENT_TYPE_MATRIX
 *   4b. legacy claim_type_outcome table (read-only, unknown claims only)
 *
 * The built-in matrix is checked before the legacy table so a stale row
 * cannot resurface the pre-fix outbound `rebate_settlement → ar_invoice`.
 *
 * @param contractId optional — enables L1 + L2.
 * @param companyId  optional — enables L3 even without a contractId.
 *                   When both are provided the contract's companyId wins.
 */
export async function documentTypeForClaim(
  claimType: string,
  direction: SettlementDirection,
  contractId?: string | null,
  companyId?: string | null,
): Promise<string> {
  type ContractCtx = {
    settlementPolicies: { documentTypeMatrix?: { rows?: unknown } } | null;
    flowTypeCode: string | null;
    companyId: string | null;
  };
  let contractRow: ContractCtx | undefined;
  if (contractId) {
    const [row] = await db
      .select({
        settlementPolicies: contracts.settlementPolicies,
        flowTypeCode: contracts.flowTypeCode,
        companyId: contracts.companyId,
      })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
    contractRow = row as ContractCtx | undefined;
  }

  if (contractRow?.settlementPolicies) {
    const hit = lookupDocumentTypeMatrixRow(
      contractRow.settlementPolicies.documentTypeMatrix?.rows,
      claimType,
      direction,
    );
    if (hit) return hit;
  }

  if (contractRow?.flowTypeCode) {
    const [ft] = await db
      .select({ overrides: flowTypes.documentTypeOverrides })
      .from(flowTypes)
      .where(eq(flowTypes.code, contractRow.flowTypeCode))
      .limit(1);
    const overrides = ft?.overrides as { rows?: unknown } | null;
    if (overrides) {
      const hit = lookupDocumentTypeMatrixRow(overrides.rows, claimType, direction);
      if (hit) return hit;
    }
  }

  // Company default applies whenever a tenant is known — even when the
  // caller has only a companyId and no contract context.
  const tenantId = contractRow?.companyId ?? companyId ?? null;
  if (tenantId) {
    const [cs] = await db
      .select({ settlementPolicies: companySettings.settlementPolicies })
      .from(companySettings)
      .where(eq(companySettings.companyId, tenantId))
      .limit(1);
    const policies = cs?.settlementPolicies as { documentTypeMatrix?: { rows?: unknown } } | null;
    if (policies) {
      const hit = lookupDocumentTypeMatrixRow(policies.documentTypeMatrix?.rows, claimType, direction);
      if (hit) return hit;
    }
  }

  const builtIn = lookupDocumentTypeMatrixRow(BUILT_IN_DOCUMENT_TYPE_MATRIX, claimType, direction);
  if (builtIn) return builtIn;

  try {
    const [row] = await db
      .select()
      .from(claimTypeOutcome)
      .where(and(eq(claimTypeOutcome.claimType, claimType), eq(claimTypeOutcome.direction, direction)))
      .limit(1);
    if (row?.documentType) return row.documentType;
  } catch (err) {
    // Postgres "undefined_table" (42P01) — environments that haven't
    // applied the legacy DDL still have a working cascade via the
    // built-in matrix. Anything else is a real failure: re-throw so it
    // is logged and surfaced rather than silently producing a default.
    const code = (err as { code?: string } | null)?.code;
    if (code !== "42P01") throw err;
  }

  return direction === "inbound" ? "ap_invoice" : "ar_invoice";
}

/**
 * Seed the legacy `claim_type_outcome` table. Task 69 retains this only
 * for back-compat with any reader that still hits the table directly;
 * the runtime resolver in `documentTypeForClaim` walks the cascade and
 * uses the built-in matrix as the authoritative fallback for known
 * claim types.
 *
 * Important behavioral guarantee (Task 69 review fix): this function
 * only seeds an EMPTY table. If any row already exists in
 * `claim_type_outcome` we treat that as operator-tuned configuration
 * and short-circuit so we never silently re-insert / re-apply the
 * built-in defaults over time. Operators who deliberately delete rows
 * from a tuned table can still be re-seeded by truncating it first.
 *
 * The seed mirrors `BUILT_IN_DOCUMENT_TYPE_MATRIX` in shared/schema.ts —
 * notably, outbound `rebate_settlement` is `credit_memo` (not `ar_invoice`
 * as the pre-Task-69 seed had it).
 */
export async function seedClaimTypeOutcomes() {
  // Short-circuit: only seed a fully empty table. This guarantees that
  // operator-tuned values (any row at all) are never overwritten or
  // augmented by the built-in defaults during boot.
  const existing = await db.select({ id: claimTypeOutcome.id }).from(claimTypeOutcome).limit(1);
  if (existing.length > 0) return;

  for (const row of BUILT_IN_DOCUMENT_TYPE_MATRIX) {
    await db.insert(claimTypeOutcome).values({
      claimType: row.claimType,
      direction: row.direction,
      documentType: row.documentType,
    }).onConflictDoNothing();
  }
}
