/**
 * Finance Hub Phase A — Claims, Documents, Intake API, Integration Settings.
 */
import express, { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { and, asc, desc, eq, sql, or, gt, isNull } from "drizzle-orm";
import {
  inboundClaims, inboundClaimLines, inboundClaimEvents,
  financeDocuments, financeDocumentLines, financeDocumentEvents,
  agentActivity, inboundEventLog, apiKeys,
  obligations, obligationEvents,
  contracts, accruals, accrualAuditTrail, recoupmentLedgerEntries,
  settlements, settlementLineItems, periodClose, periodCloseChecklist, systemSettings, claimTypeOutcome,
  deductions, deductionEvents, deductionReasonCodes,
  approvalChains, approvalChainSteps, approvalRequests, approvalDecisions,
  type InboundClaim,
} from "@shared/schema";
import {
  requireApproval, decide as decideApproval, getRequestTimeline, pendingForUser,
  seedDefaultApprovalChains, resendCurrentStepNotification, startApprovalSweeper,
} from "./services/approvalEngine";
import { APPROVAL_DOC_TYPES, APPROVER_ROLES, isValidScope } from "./services/approvalDocTypes";
import {
  inboundEventEnvelopeSchema, processInboundEvent,
  documentTypeForClaim, seedClaimTypeOutcomes,
} from "./services/intakeAgentService";
import { transitionInboundClaim, transitionFinanceDocument, transitionOutboundObligation } from "./services/financeStateMachine";
import { nextDocumentNumber } from "./services/documentSequenceService";
import { autoAttachClaimToSettlement, backfillAutoAttachSettlements } from "./services/claimSettlementMatcher";
import {
  generateApiKey, hashSecret, verifyInboundRequest, ensureInternalAdmin,
  decryptStoredSecret,
} from "./services/apiKeyAuth";
import crypto from "crypto";
import { isAuthenticated } from "./auth";

function userFrom(req: any) {
  return {
    id: req?.user?.id || null,
    name: req?.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ""}`.trim() : (req?.user?.email || "System"),
  };
}

function uniquePartnerNames(rows: Array<{ counterpartyName?: string | null }>): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const n = (r.counterpartyName || "").trim();
    if (n) set.add(n);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function companyScope(req: any) {
  return req?.user?.activeContext?.companyId || null;
}

  // Internal helper — used by both the public endpoint and admin Simulate tool.
  // Centralises envelope validation, idempotency, per-key legal-entity scoping,
  // event log insertion and intake-agent processing.
  async function handleInboundEnvelope(args: {
    parsedJson: any;
    apiKeyId: string | null;
    keyLegalEntityId?: string | null;
    keyCompanyId?: string | null;
    signatureValid: boolean;
    isReplay?: boolean;
  }): Promise<{ status: number; body: any }> {
    const { parsedJson, apiKeyId, keyLegalEntityId, keyCompanyId, signatureValid, isReplay } = args;
    const cid = keyCompanyId ?? null;
    const parse = inboundEventEnvelopeSchema.safeParse(parsedJson);
    if (!parse.success) {
      await db.insert(inboundEventLog).values({
        apiKeyId, companyId: cid, sourceEventId: parsedJson?.source_event_id || null,
        eventType: parsedJson?.event_type || null, signatureValid,
        outcome: "rejected", errorMessage: parse.error.message, payload: parsedJson,
      }).onConflictDoNothing();
      return { status: 400, body: { error: "Envelope failed validation", details: parse.error.flatten() } };
    }
    const envelope = parse.data;
    // Per-key legal-entity scoping
    if (keyLegalEntityId && envelope.legal_entity_id && envelope.legal_entity_id !== keyLegalEntityId) {
      await db.insert(inboundEventLog).values({
        apiKeyId, companyId: cid, sourceEventId: envelope.source_event_id, eventType: envelope.event_type,
        signatureValid, outcome: "rejected", errorMessage: "legal_entity_id outside API key scope",
        payload: envelope as any,
      }).onConflictDoNothing();
      return { status: 403, body: { error: "legal_entity_id outside API key scope" } };
    }
    // Idempotency check — scoped per tenant. The DB enforces uniqueness on
    // (company_id, source_event_id), so two tenants may legitimately reuse
    // the same upstream event id without colliding, and one tenant cannot
    // observe another tenant's prior result via a duplicate response.
    const dupConds: any[] = [eq(inboundEventLog.sourceEventId, envelope.source_event_id)];
    if (cid) {
      dupConds.push(eq(inboundEventLog.companyId, cid));
    } else {
      // No tenant on the calling key — only treat as a duplicate when the
      // prior log row also has no company binding.
      dupConds.push(isNull(inboundEventLog.companyId));
    }
    const existing = await db.select().from(inboundEventLog).where(and(...dupConds)).limit(1);
    if (existing.length) {
      return { status: 200, body: { outcome: "duplicate", source_event_id: envelope.source_event_id, original: existing[0].result } };
    }
    // Force scope to key's legal entity if envelope omits it
    if (!envelope.legal_entity_id && keyLegalEntityId) envelope.legal_entity_id = keyLegalEntityId;
    try {
      const result = await processInboundEvent(envelope, { companyId: cid });
      await db.insert(inboundEventLog).values({
        apiKeyId, companyId: cid ?? (result as any)?.companyId ?? null,
        legalEntityId: envelope.legal_entity_id || keyLegalEntityId || null,
        sourceEventId: envelope.source_event_id, eventType: envelope.event_type,
        signatureValid, outcome: isReplay ? "replayed" : result.outcome,
        payload: envelope as any, result: result as any,
      });
      return { status: 200, body: result };
    } catch (e: any) {
      await db.insert(inboundEventLog).values({
        apiKeyId, companyId: cid, sourceEventId: envelope.source_event_id, eventType: envelope.event_type,
        signatureValid, outcome: "rejected", errorMessage: e.message, payload: envelope as any,
      }).onConflictDoNothing();
      return { status: 500, body: { error: e.message } };
    }
  }

export function registerFinanceHubRoutes(app: Express) {
  // Public endpoint — needs raw body for HMAC.
  app.post("/api/inbound-events", express.raw({ type: "*/*", limit: "2mb" }), async (req: Request, res: Response) => {
    const rawBody = (req.body as Buffer)?.toString("utf8") || "";
    const verify = await verifyInboundRequest(req, rawBody);
    let parsedJson: any = null;
    try { parsedJson = JSON.parse(rawBody); } catch { /* ignore */ }
    if (!verify.ok) {
      await db.insert(inboundEventLog).values({
        apiKeyId: null, sourceEventId: parsedJson?.source_event_id || null,
        eventType: parsedJson?.event_type || null, signatureValid: false,
        outcome: "rejected", errorMessage: verify.error, payload: parsedJson,
      }).onConflictDoNothing();
      return res.status(401).json({ error: verify.error });
    }
    const out = await handleInboundEnvelope({
      parsedJson,
      apiKeyId: verify.key!.id,
      keyLegalEntityId: verify.key!.legalEntityId,
      keyCompanyId: verify.key!.companyId ?? null,
      signatureValid: true,
    });
    return res.status(out.status).json(out.body);
  });

  // Envelope schema (downloadable)
  app.get("/api/inbound-events/schema", (_req, res) => {
    res.json({
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "LicenseIQ Inbound Event Envelope v1",
      type: "object",
      required: ["source_event_id", "event_type", "payload"],
      properties: {
        source_event_id: { type: "string", description: "Unique idempotency key" },
        event_type: { enum: ["claim.received", "claim.updated", "dispute.responded", "oracle.payment.applied", "oracle.document.posted"] },
        legal_entity_id: { type: ["string", "null"] },
        occurred_at: { type: "string", format: "date-time" },
        payload: { type: "object" },
      },
    });
  });

  // ----- All /api/finance/* and /api/agent-activity* routes are internal and
  // require an authenticated session. companyScope() further enforces tenant
  // isolation per handler. The only public endpoints are /api/inbound-events
  // (HMAC-signed) and /api/inbound-events/schema (read-only docs), both
  // registered above.
  app.use("/api/finance", isAuthenticated);
  app.use("/api/agent-activity", isAuthenticated);

  // Fail-closed tenant gate: every authenticated request to /api/finance/* and
  // /api/agent-activity* must carry a resolvable companyId. Without one, refuse
  // rather than letting a handler fall through to an unscoped query.
  const requireTenantMiddleware = (req: any, res: Response, next: any) => {
    if (!companyScope(req)) {
      return res.status(403).json({ error: "No active company on session" });
    }
    next();
  };
  app.use("/api/finance", requireTenantMiddleware);
  app.use("/api/agent-activity", requireTenantMiddleware);

  // ----- Unified claim list (outbound obligations + inbound claims)
  // Outbound obligations are restricted to claim-relevant kinds — i.e. those
  // with a corresponding outbound row in claim_type_outcome. This keeps the
  // Claims Workspace from surfacing unrelated obligations (advances, deferrals,
  // generic accruals, etc.).
  app.get("/api/finance/claims", async (req, res) => {
    try {
      const cid = companyScope(req);
      const claimKindRows = await db.select({ k: claimTypeOutcome.claimType })
        .from(claimTypeOutcome).where(eq(claimTypeOutcome.direction, "outbound"));
      const claimKinds = claimKindRows.map(r => r.k);
      const obKindFilter = claimKinds.length
        ? sql`${obligations.kind} IN (${sql.join(claimKinds.map(k => sql`${k}`), sql`, `)})`
        : sql`false`;
      const inbWhere = cid ? eq(inboundClaims.companyId, cid) : undefined;
      const obWhere = cid ? and(eq(obligations.companyId, cid), obKindFilter) : obKindFilter;
      const inb = inbWhere
        ? await db.select().from(inboundClaims).where(inbWhere).orderBy(desc(inboundClaims.createdAt))
        : await db.select().from(inboundClaims).orderBy(desc(inboundClaims.createdAt));
      const out = await db.select().from(obligations).where(obWhere).orderBy(desc(obligations.createdAt));
      const unified = [
        ...inb.map((c: any) => ({
          id: c.id, kind: "inbound_claim", direction: "inbound", claimType: c.claimType,
          partnerName: c.partnerName, contractId: c.contractId, contractName: c.contractName,
          period: c.period, claimedAmount: c.claimedAmount, approvedAmount: c.approvedAmount,
          currency: c.currency, status: c.status, priority: c.priority, agentHandled: c.agentHandled,
          disputeState: c.disputeState, dueAt: c.dueAt, createdAt: c.createdAt,
          sourceChannel: c.sourceChannel, raw: c,
        })),
        ...out.map((o: any) => ({
          id: o.id, kind: "outbound_obligation", direction: "outbound", claimType: o.kind,
          partnerName: o.partnerName, contractId: o.contractId, contractName: null,
          period: o.fundingPeriod, claimedAmount: o.claimedAmount || o.amount, approvedAmount: o.amount,
          currency: o.currency, status: o.status, priority: o.agentHandled ? "agent_handling" : "standard",
          agentHandled: o.agentHandled, disputeState: o.disputeState, dueAt: o.dueAt, createdAt: o.createdAt,
          sourceChannel: o.sourceChannel, raw: o,
        })),
      ];
      res.json(unified);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  const kpisHandler = async (req: any, res: any) => {
    try {
      const cid = companyScope(req);
      const inb = cid ? await db.select().from(inboundClaims).where(eq(inboundClaims.companyId, cid)) : await db.select().from(inboundClaims);
      const docs = cid ? await db.select().from(financeDocuments).where(eq(financeDocuments.companyId, cid)) : await db.select().from(financeDocuments);
      const openClaims = inb.filter(c => !["approved", "rejected", "settled"].includes(c.status || "")).length;
      const openDocs = docs.filter(d => !["paid", "voided"].includes(d.status || "")).length;
      const awaitingOracle = docs.filter(d => d.status === "awaiting_oracle" || d.oracleStatus === "pending").length;
      res.json({ openClaims, openDocuments: openDocs, awaitingOracle });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  };
  app.get("/api/finance/claims/kpis", kpisHandler);
  app.get("/api/finance/kpis", kpisHandler);

  // ----- Inbound claim list (explicit endpoint per acceptance criteria;
  // tenant-scoped by companyScope, never returns cross-tenant rows).
  app.get("/api/finance/inbound-claims", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const status = (req.query.status as string | undefined) || undefined;
      const contractId = typeof req.query.contractId === "string" ? req.query.contractId.trim() : "";
      const conds: any[] = [];
      if (cid) conds.push(eq(inboundClaims.companyId, cid));
      if (status) conds.push(eq(inboundClaims.status, status));
      if (contractId) conds.push(eq(inboundClaims.contractId, contractId));
      const where = conds.length ? and(...conds) : undefined;
      const rows = where
        ? await db.select().from(inboundClaims).where(where).orderBy(desc(inboundClaims.createdAt))
        : await db.select().from(inboundClaims).orderBy(desc(inboundClaims.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Inbound claim detail
  app.get("/api/finance/inbound-claims/:id", async (req: any, res) => {
    try {
      const [row] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const cid = companyScope(req);
      if (cid && row.companyId && row.companyId !== cid) return res.status(403).json({ error: "Out of scope" });
      const lines = await db.select().from(inboundClaimLines).where(eq(inboundClaimLines.claimId, row.id));
      const events = await db.select().from(inboundClaimEvents).where(eq(inboundClaimEvents.claimId, row.id)).orderBy(desc(inboundClaimEvents.createdAt));
      const activity = await db.select().from(agentActivity).where(eq(agentActivity.scopeId, row.id)).orderBy(desc(agentActivity.createdAt));
      res.json({ ...row, lines, events, agentActivity: activity });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Manual re-attach: useful when a claim was created before the auto-
  // attach hook existed, or after a user has fixed up the contract/period
  // on an inbound claim and wants the settlement to be re-keyed.
  app.post("/api/finance/inbound-claims/:id/auto-attach-settlement", async (req: any, res) => {
    try {
      const [claim] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, req.params.id));
      if (!claim) return res.status(404).json({ error: "Claim not found" });
      const result = await autoAttachClaimToSettlement(claim);
      if (!result) {
        return res.json({
          attached: false,
          reason: !claim.contractId
            ? "No contract resolved on claim"
            : !claim.period
            ? "No period on claim"
            : claim.status === "needs_review"
            ? "Claim is in needs_review — resolve entity first"
            : "Settlement already linked to a different claim",
        });
      }
      res.json({ attached: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // One-shot backfill: walks every eligible claim and ensures it's
  // attached to a settlement. Safe to call repeatedly (idempotent).
  app.post("/api/finance/inbound-claims/backfill-settlements", async (_req: any, res) => {
    try {
      const stats = await backfillAutoAttachSettlements();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/finance/inbound-claims/:id/decide", async (req: any, res) => {
    try {
      const { action, amount, description } = req.body;
      const u = userFrom(req);
      const updated = await transitionInboundClaim({
        claimId: req.params.id, action, amount, description,
        userId: u.id, userName: u.name, companyScopeId: companyScope(req),
      });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Out of scope" ? 403 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  app.post("/api/finance/inbound-claims/:id/dispute", async (req: any, res) => {
    try {
      const { reason } = req.body;
      const u = userFrom(req);
      const updated = await transitionInboundClaim({
        claimId: req.params.id, action: "open_dispute", description: reason,
        userId: u.id, userName: u.name, companyScopeId: companyScope(req),
      });
      // dispute_reason isn't part of the state machine; safe to set after the
      // transition (which already enforced scope + recorded the event).
      await db.update(inboundClaims)
        .set({ disputeReason: reason, disputeState: "open", updatedAt: new Date() })
        .where(eq(inboundClaims.id, req.params.id));
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Out of scope" ? 403 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  // Pick the best dollar value from a claim. Historically the fallback
  // chain was `approvedAmount || claimedAmount || 0` which silently failed
  // because a string like "0.00" is truthy in JS — so claims approved by
  // older code paths that wrote 0 to approvedAmount produced $0 documents
  // even when the claimedAmount was non-zero. Prefer the first value that
  // parses to a number greater than zero.
  function bestClaimAmount(claim: any): string {
    const candidates = [claim?.approvedAmount, claim?.claimedAmount];
    for (const v of candidates) {
      if (v == null) continue;
      const n = parseFloat(String(v));
      if (Number.isFinite(n) && n > 0) return String(v);
    }
    return "0";
  }

  // Build descriptive defaults for a finance document being generated from a
  // claim, by joining whatever the matched settlement and its line items
  // already know about the deal. This is what gives the credit memo its
  // "Notes" body and gives empty claim lines a sensible "Description"
  // fallback. We never overwrite user-edited content — see the call sites.
  async function buildSettlementContextForClaim(claimId: string): Promise<{
    notes: string | null;
    lineDescriptionFallback: string | null;
    settlementId: string | null;
  }> {
    const [settlement] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.claimId, claimId));
    if (!settlement) return { notes: null, lineDescriptionFallback: null, settlementId: null };
    const lines = await db
      .select()
      .from(settlementLineItems)
      .where(eq(settlementLineItems.settlementId, settlement.id))
      .orderBy(asc(settlementLineItems.sortOrder));
    const fmtMoney = (v: string | number | null | undefined) => {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
      return n.toLocaleString("en-US", { style: "currency", currency: settlement.flowType ? "USD" : "USD" });
    };
    const accrual = parseFloat(String(settlement.accrualAmount ?? "0"));
    const claimAmt = parseFloat(String(settlement.claimAmount ?? "0"));
    const variance = parseFloat(String(settlement.variance ?? "0"));
    const resolutionLabel: Record<string, string> = {
      accept_claim: "Accept Customer Claim",
      settle_at_accrual: "Settle at Internal Accrual",
      partial: "Partial Settlement",
    };
    const noteLines: string[] = [];
    noteLines.push(
      `Settlement summary — ${settlement.period || "(no period)"} · ${settlement.counterparty || "(unknown counterparty)"}`,
    );
    noteLines.push(`Internal accrual: ${fmtMoney(accrual)}`);
    noteLines.push(`Customer claim:   ${fmtMoney(claimAmt)}`);
    if (Math.abs(variance) >= 0.01) {
      const dir = variance > 0 ? "claim under accrual" : "claim over accrual";
      noteLines.push(`Variance:         ${fmtMoney(Math.abs(variance))} (${dir})`);
    } else {
      noteLines.push(`Variance:         exact match`);
    }
    if (settlement.resolution) {
      noteLines.push(`Resolution: ${resolutionLabel[settlement.resolution] || settlement.resolution}`);
    }
    if (settlement.disputeState && settlement.disputeState !== "none" && settlement.disputeReason) {
      noteLines.push(`Dispute (${settlement.disputeState}): ${settlement.disputeReason}`);
    }
    if (lines.length > 0) {
      noteLines.push("");
      noteLines.push("Settlement line items:");
      for (const ln of lines) {
        const lnClaim = parseFloat(String(ln.claimAmount ?? "0"));
        noteLines.push(`  • ${ln.lineName || ln.category || "Line"} — ${fmtMoney(lnClaim)}`);
      }
    }
    // Description fallback: a compact, single-line join of settlement line
    // names — used when the claim line itself has no description.
    const descSource = lines.length > 0
      ? lines.map(ln => ln.lineName || ln.category).filter(Boolean).join(" · ")
      : (settlement.contractName || null);
    return {
      notes: noteLines.join("\n"),
      lineDescriptionFallback: descSource || null,
      settlementId: settlement.id,
    };
  }

  app.post("/api/finance/inbound-claims/:id/generate-document", async (req: any, res) => {
    try {
      const [claim] = await db.select().from(inboundClaims).where(eq(inboundClaims.id, req.params.id));
      if (!claim) return res.status(404).json({ error: "Claim not found" });
      // Tenant scoping
      const cid = companyScope(req);
      if (cid && claim.companyId && claim.companyId !== cid) return res.status(403).json({ error: "Out of scope" });
      // Approval gate — claim→document conversion is only allowed once a
      // claim has reached an approved state (full or partial). This mirrors
      // the lifecycle in financeStateMachine.ts; rejected/disputed/draft
      // claims must go back through the state machine first.
      const ELIGIBLE_FOR_DOCUMENT = new Set(["approved", "partial_approved", "settled"]);
      if (!ELIGIBLE_FOR_DOCUMENT.has(claim.status || "")) {
        return res.status(409).json({
          error: `Claim status '${claim.status}' is not eligible for document generation. Approve the claim first.`,
        });
      }
      // Idempotency — if a document was already generated for this claim,
      // we need to handle two cases:
      //   1. The doc is still in `draft`: the claim may have changed since
      //      (e.g. user originally generated before fully approving, then
      //      went back and approved, raising approvedAmount). Re-sync the
      //      draft from the claim's current values + line items so the user
      //      sees the right numbers.
      //   2. The doc has moved past draft (sent/posted/paid/voided): it's
      //      locked — return as-is. Edits would require voiding + re-issue.
      if (claim.linkedDocumentId) {
        const [existing] = await db.select().from(financeDocuments).where(eq(financeDocuments.id, claim.linkedDocumentId));
        if (existing) {
          if (existing.status !== "draft") return res.json(existing);
          const refreshedAccrual = await resolveAccrualDate(claim);
          const refreshedAmount = bestClaimAmount(claim);
          // Pull settlement context every time we resync. We only overwrite
          // notes if the user hasn't typed anything custom (existing.notes
          // is null/empty); once they save their own notes, those stick.
          const ctx = await buildSettlementContextForClaim(claim.id);
          const userHasEditedNotes = !!(existing.notes && existing.notes.trim().length > 0);
          const [resynced] = await db.update(financeDocuments).set({
            amount: refreshedAmount,
            currency: claim.currency || existing.currency || "USD",
            partnerId: claim.partnerId,
            partnerName: claim.partnerName,
            contractId: claim.contractId,
            contractName: claim.contractName,
            period: claim.period,
            accrualDate: refreshedAccrual,
            ...(userHasEditedNotes ? {} : { notes: ctx.notes }),
            updatedAt: new Date(),
          } as any).where(eq(financeDocuments.id, existing.id)).returning();
          // Replace line items so any updates on the claim flow through.
          await db.delete(financeDocumentLines).where(eq(financeDocumentLines.documentId, existing.id));
          const claimLines = await db.select().from(inboundClaimLines).where(eq(inboundClaimLines.claimId, claim.id));
          if (claimLines.length > 0) {
            for (const ln of claimLines) {
              await db.insert(financeDocumentLines).values({
                documentId: existing.id,
                description: ln.description || ctx.lineDescriptionFallback,
                sku: ln.sku,
                quantity: ln.quantity, unitAmount: ln.unitAmount, amount: ln.amount, sortOrder: ln.sortOrder,
              } as any);
            }
          } else if (ctx.settlementId) {
            // Claim has no line breakdown — mirror the settlement's line items
            // so the credit memo carries the rebate structure (Hanwha tier,
            // Non-Hanwha tier, etc.) instead of a single anonymous line.
            const sLines = await db.select().from(settlementLineItems)
              .where(eq(settlementLineItems.settlementId, ctx.settlementId))
              .orderBy(asc(settlementLineItems.sortOrder));
            for (const ln of sLines) {
              await db.insert(financeDocumentLines).values({
                documentId: existing.id,
                description: ln.lineName || ln.category || "Settlement line",
                quantity: "1",
                unitAmount: ln.claimAmount || "0",
                amount: ln.claimAmount || "0",
                sortOrder: ln.sortOrder,
              } as any);
            }
          }
          await db.insert(financeDocumentEvents).values({
            documentId: existing.id, eventType: "draft_resynced", fromStatus: "draft", toStatus: "draft",
            description: `Re-synced from claim ${claim.id} (amount ${refreshedAmount})`,
            userId: userFrom(req).id, userName: userFrom(req).name,
          } as any);
          return res.json(resynced || existing);
        }
      }
      // Task 69 — pass contractId so the cascade can pick up
      // contract / flow-type / company overrides before falling back to
      // the built-in matrix.
      const docType = await documentTypeForClaim(claim.claimType, "inbound", claim.contractId, claim.companyId);
      const number = await nextDocumentNumber(docType);
      // Accrual date strictly follows contract.obligationAccrualBasis,
      // falling back to system_settings.default_obligation_accrual_basis when unset.
      const accrualDate = await resolveAccrualDate(claim);
      const u = userFrom(req);
      // Settlement context — gives us the seed text for `notes` and the
      // fallback `description` for any blank claim lines.
      const ctx = await buildSettlementContextForClaim(claim.id);
      const [doc] = await db.insert(financeDocuments).values({
        documentNumber: number, documentType: docType,
        partnerId: claim.partnerId, partnerName: claim.partnerName,
        contractId: claim.contractId, contractName: claim.contractName, period: claim.period,
        amount: bestClaimAmount(claim), currency: claim.currency || "USD",
        status: "draft", accrualDate, sourceClaimId: claim.id, legalEntityId: claim.legalEntityId,
        notes: ctx.notes,
        companyId: claim.companyId, createdBy: u.id,
      }).returning();
      // Copy line items. Same fallback rule as the resync path: if the claim
      // has no line breakdown, mirror the settlement's line items so the
      // credit memo carries the rebate structure rather than nothing.
      const lines = await db.select().from(inboundClaimLines).where(eq(inboundClaimLines.claimId, claim.id));
      if (lines.length > 0) {
        for (const ln of lines) {
          await db.insert(financeDocumentLines).values({
            documentId: doc.id,
            description: ln.description || ctx.lineDescriptionFallback,
            sku: ln.sku,
            quantity: ln.quantity, unitAmount: ln.unitAmount, amount: ln.amount, sortOrder: ln.sortOrder,
          });
        }
      } else if (ctx.settlementId) {
        const sLines = await db.select().from(settlementLineItems)
          .where(eq(settlementLineItems.settlementId, ctx.settlementId))
          .orderBy(asc(settlementLineItems.sortOrder));
        for (const ln of sLines) {
          await db.insert(financeDocumentLines).values({
            documentId: doc.id,
            description: ln.lineName || ln.category || "Settlement line",
            quantity: "1",
            unitAmount: ln.claimAmount || "0",
            amount: ln.claimAmount || "0",
            sortOrder: ln.sortOrder,
          } as any);
        }
      }
      await db.update(inboundClaims).set({ linkedDocumentId: doc.id, updatedAt: new Date() }).where(eq(inboundClaims.id, claim.id));
      await db.insert(financeDocumentEvents).values({
        documentId: doc.id, eventType: "draft_created", fromStatus: null, toStatus: "draft",
        description: `Generated from claim ${claim.id}`, userId: u.id, userName: u.name,
      });
      res.json(doc);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Outbound obligation → finance document.
  // Mirrors the inbound generate-document path: deterministic mapping via
  // claimTypeOutcome(direction="outbound"), tenant-scoped, status-gated, and
  // idempotent (a previously-generated document is returned as-is).
  app.post("/api/finance/outbound-claims/:id/generate-document", async (req: any, res) => {
    try {
      const [obl] = await db.select().from(obligations).where(eq(obligations.id, req.params.id));
      if (!obl) return res.status(404).json({ error: "Obligation not found" });
      const cid = companyScope(req);
      if (cid && obl.companyId && obl.companyId !== cid) return res.status(403).json({ error: "Out of scope" });

      // Approval gate — only approved/settled outbound obligations may
      // generate AR/debit-side documents. Draft, claim_submitted, disputed,
      // and expired must run through the state machine first.
      const ELIGIBLE = new Set(["approved", "settled"]);
      if (!ELIGIBLE.has(obl.status || "")) {
        return res.status(409).json({
          error: `Obligation status '${obl.status}' is not eligible for document generation. Approve the claim first.`,
        });
      }

      // Idempotency — return the existing document if one already exists for
      // this obligation.
      const existing = await db.select().from(financeDocuments)
        .where(eq(financeDocuments.sourceObligationId, obl.id)).limit(1);
      if (existing.length) return res.json(existing[0]);

      // Task 69 — pass contractId for cascade resolution.
      const docType = await documentTypeForClaim(obl.kind, "outbound", obl.contractId, obl.companyId);
      const number = await nextDocumentNumber(docType);
      const u = userFrom(req);
      const amount = String(obl.amount || obl.outstandingAmount || "0");
      // Accrual date strictly follows contract.obligationAccrualBasis (or
      // system_settings default), driven from the obligation's funding
      // period / accrual date — never "today".
      const accrualDate = await resolveAccrualDateFromSource({
        sourceLabel: `obligation ${obl.id}`,
        contractId: obl.contractId || null,
        period: obl.fundingPeriod || null,
        occurredAt: obl.accrualDate || null,
      });
      const [doc] = await db.insert(financeDocuments).values({
        documentNumber: number, documentType: docType,
        partnerId: obl.partnerId, partnerName: obl.partnerName,
        contractId: obl.contractId, contractName: null,
        period: obl.fundingPeriod,
        amount, currency: obl.currency || "USD",
        status: "draft",
        accrualDate,
        sourceObligationId: obl.id,
        companyId: obl.companyId,
        createdBy: u.id,
      }).returning();
      await db.insert(financeDocumentEvents).values({
        documentId: doc.id, eventType: "draft_created", fromStatus: null, toStatus: "draft",
        description: `Generated from outbound obligation ${obl.id}`, userId: u.id, userName: u.name,
      });
      res.json(doc);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Outbound obligation actions — go through centralised state machine.
  app.post("/api/finance/outbound-claims/:id/decide", async (req: any, res) => {
    try {
      const { action, amount, description } = req.body || {};
      const u = userFrom(req);
      const updated = await transitionOutboundObligation({
        obligationId: req.params.id, action, amount, description,
        userId: u.id, userName: u.name, companyScopeId: companyScope(req),
      });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Out of scope" ? 403 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  // ----- Documents
  app.get("/api/finance/documents", async (req, res) => {
    try {
      const cid = companyScope(req);
      const type = req.query.type as string | undefined;
      const contractId = typeof req.query.contractId === "string" ? req.query.contractId.trim() : "";
      const conds: any[] = [];
      if (cid) conds.push(eq(financeDocuments.companyId, cid));
      if (type) conds.push(eq(financeDocuments.documentType, type));
      if (contractId) conds.push(eq(financeDocuments.contractId, contractId));
      const where = conds.length ? and(...conds) : undefined;
      const rows = where
        ? await db.select().from(financeDocuments).where(where).orderBy(desc(financeDocuments.createdAt))
        : await db.select().from(financeDocuments).orderBy(desc(financeDocuments.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/finance/documents/:id", async (req: any, res) => {
    try {
      const [row] = await db.select().from(financeDocuments).where(eq(financeDocuments.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const cid = companyScope(req);
      if (cid && row.companyId && row.companyId !== cid) return res.status(403).json({ error: "Out of scope" });
      const lines = await db.select().from(financeDocumentLines).where(eq(financeDocumentLines.documentId, row.id));
      const events = await db.select().from(financeDocumentEvents).where(eq(financeDocumentEvents.documentId, row.id)).orderBy(desc(financeDocumentEvents.createdAt));
      res.json({ ...row, lines, events });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/finance/documents", async (req: any, res) => {
    try {
      const data = req.body || {};
      const lines = Array.isArray(data.lines) ? data.lines : [];
      delete data.lines;
      if (!data.documentNumber) data.documentNumber = await nextDocumentNumber(data.documentType);
      const u = userFrom(req);
      // Tenant enforcement: always force the session's companyScope. Any
      // caller-supplied companyId is ignored to prevent cross-tenant writes.
      const tenantId = companyScope(req);
      if (!tenantId) return res.status(403).json({ error: "No active company on session" });
      data.companyId = tenantId;
      data.createdBy = u.id;
      const [doc] = await db.insert(financeDocuments).values(data).returning();
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        await db.insert(financeDocumentLines).values({
          documentId: doc.id, description: ln.description || null, sku: ln.sku || null,
          quantity: String(ln.quantity || "0"), unitAmount: String(ln.unitAmount || "0"),
          amount: String(ln.amount || "0"), glAccount: ln.glAccount || null, sortOrder: i,
        });
      }
      await db.insert(financeDocumentEvents).values({ documentId: doc.id, eventType: "draft_created", toStatus: "draft", userId: u.id, userName: u.name });
      // Trigger approval if amount crosses any configured threshold for documents.
      const amt = Number(doc.amount || 0);
      const reqId = await requireApproval({
        scope: "document", entityId: doc.id,
        entityLabel: `${doc.documentType} ${doc.documentNumber}${doc.partnerName ? ` · ${doc.partnerName}` : ""}`,
        amount: amt, currency: doc.currency, companyId: tenantId, requestedBy: u.id,
      });
      res.json({ ...doc, approvalRequestId: reqId });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Edit a finance document while it's still in draft. Once a document
  // is sent / awaiting_oracle / posted / paid / voided, it's locked — any
  // changes after that must go through Void + re-issue. Editable fields
  // include partner labels, contract / period, amount, currency, accrual
  // and due dates, notes, and the full line-item collection (replaced
  // wholesale when supplied to keep totals consistent).
  app.patch("/api/finance/documents/:id", async (req: any, res) => {
    try {
      const [row] = await db.select().from(financeDocuments).where(eq(financeDocuments.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const cid = companyScope(req);
      if (cid && row.companyId && row.companyId !== cid) return res.status(403).json({ error: "Out of scope" });
      if (row.status !== "draft") {
        return res.status(409).json({
          error: `Document is ${row.status} — only drafts are editable. Void it first to issue a corrected version.`,
        });
      }
      const body = req.body || {};
      const updates: any = { updatedAt: new Date() };
      const ALLOWED = [
        "partnerId", "partnerName", "contractId", "contractName",
        "period", "amount", "currency", "accrualDate", "dueDate",
        "notes", "legalEntityId",
      ];
      for (const k of ALLOWED) {
        if (body[k] === undefined) continue;
        if (k === "amount") updates.amount = String(body.amount ?? "0");
        else if (k === "accrualDate" || k === "dueDate") {
          updates[k] = body[k] ? new Date(body[k]) : null;
        } else updates[k] = body[k];
      }
      const [updated] = await db.update(financeDocuments)
        .set(updates as any)
        .where(eq(financeDocuments.id, row.id))
        .returning();
      // Lines: replace wholesale when an array is provided. This keeps
      // line totals and the document amount easy to keep in sync.
      if (Array.isArray(body.lines)) {
        await db.delete(financeDocumentLines).where(eq(financeDocumentLines.documentId, row.id));
        for (let i = 0; i < body.lines.length; i++) {
          const ln = body.lines[i] || {};
          await db.insert(financeDocumentLines).values({
            documentId: row.id,
            description: ln.description || null,
            sku: ln.sku || null,
            quantity: String(ln.quantity ?? "0"),
            unitAmount: String(ln.unitAmount ?? "0"),
            amount: String(ln.amount ?? "0"),
            glAccount: ln.glAccount || null,
            sortOrder: i,
          } as any);
        }
      }
      const u = userFrom(req);
      await db.insert(financeDocumentEvents).values({
        documentId: row.id, eventType: "draft_edited", fromStatus: "draft", toStatus: "draft",
        description: `Draft edited (${Object.keys(updates).filter((k) => k !== "updatedAt").join(", ") || "lines only"})`,
        userId: u.id, userName: u.name,
      } as any);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/finance/documents/:id/transition", async (req: any, res) => {
    try {
      const u = userFrom(req);
      const updated = await transitionFinanceDocument({
        documentId: req.params.id, action: req.body.action,
        userId: u.id, userName: u.name, description: req.body.description,
        companyScopeId: companyScope(req),
      });
      res.json(updated);
    } catch (e: any) {
      const status = e.message === "Out of scope" ? 403 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  // ----- Agent activity SSE stream
  app.get("/api/agent-activity/stream", async (req: any, res) => {
    res.set({
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
      "Connection": "keep-alive", "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    const cid = companyScope(req);
    let lastSeen = new Date(Date.now() - 60_000);
    const tick = async () => {
      try {
        const conds: any[] = [gt(agentActivity.createdAt, lastSeen)];
        if (cid) conds.push(eq(agentActivity.companyId, cid));
        const rows = await db.select().from(agentActivity).where(and(...conds)).orderBy(agentActivity.createdAt);
        for (const r of rows) {
          if (r.createdAt && r.createdAt > lastSeen) lastSeen = r.createdAt as Date;
          res.write(`data: ${JSON.stringify(r)}\n\n`);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(tick, 2000);
    req.on("close", () => clearInterval(interval));
  });

  // ----- Approvals (Phase B multi-step engine)
  // List the current user's pending approvals across claims/documents/deductions.
  app.get("/api/finance/approvals/pending", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u) return res.status(401).json({ error: "Auth required" });
      const rows = await pendingForUser(u.id, u.role || "", companyScope(req), !!u.isSystemAdmin);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // All approval requests for an entity (timeline view in the detail panel).
  app.get("/api/finance/approvals/by-entity/:type/:id", async (req: any, res) => {
    try {
      const { type, id } = req.params;
      const reqs = await db.select().from(approvalRequests).where(and(
        eq(approvalRequests.entityType, type),
        eq(approvalRequests.entityId, id),
      )).orderBy(desc(approvalRequests.requestedAt));
      const enriched = await Promise.all(reqs.map(async (r) => {
        const tl = await getRequestTimeline(r.id);
        return tl ? { ...tl.request, steps: tl.steps, decisions: tl.decisions } : r;
      }));
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Decide on an approval (approve | reject + optional comment).
  app.post("/api/finance/approvals/:id/decide", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u) return res.status(401).json({ error: "Auth required" });
      const { decision, comment } = req.body || {};
      if (decision !== "approve" && decision !== "reject") {
        return res.status(400).json({ error: "decision must be approve|reject" });
      }
      const result = await decideApproval({
        requestId: req.params.id,
        approverId: u.id,
        approverName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.username || "User",
        approverRole: u.role || "",
        isSystemAdmin: !!u.isSystemAdmin,
        decision, comment,
      });
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Manually re-send the "approval needed" email for the current step.
  // Useful when an approver claims the original notification never arrived
  // or when an admin wants to nudge a stalled request.
  app.post("/api/finance/approvals/:id/resend-notification", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u) return res.status(401).json({ error: "Auth required" });
      const sent = await resendCurrentStepNotification(req.params.id);
      res.json({ ok: true, sent });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Catalog of approvable document types + approver-role options for the
  // Approval Workflows admin UI in Company Settings. Static today; if it
  // ever grows tenant-aware, switch to a DB-backed source.
  app.get("/api/finance/approval-doc-types", async (_req, res) => {
    res.json({ docTypes: APPROVAL_DOC_TYPES, roles: APPROVER_ROLES });
  });

  // Read-only: list all chains so admins can audit configuration.
  // When ?scope=... is passed, only chains for that doc type are returned.
  app.get("/api/finance/approval-chains", async (req: any, res) => {
    try {
      const scope = (req.query.scope as string) || null;
      const cid = companyScope(req);
      const conds: any[] = [];
      if (scope) conds.push(eq(approvalChains.scope, scope));
      // System-default chains (companyId IS NULL) are always visible so
      // tenant admins know what they fall back to.
      if (cid) conds.push(or(eq(approvalChains.companyId, cid), isNull(approvalChains.companyId)));
      const chains = await db.select().from(approvalChains)
        .where(conds.length ? and(...conds) : undefined as any)
        .orderBy(asc(approvalChains.scope), asc(approvalChains.minAmount));
      const steps = chains.length === 0 ? [] : await db.select().from(approvalChainSteps)
        .where(sql`${approvalChainSteps.chainId} IN (${sql.join(chains.map(c => sql`${c.id}`), sql`, `)})`)
        .orderBy(asc(approvalChainSteps.chainId), asc(approvalChainSteps.sequence));
      const stepsByChain = new Map<string, typeof steps>();
      for (const s of steps) {
        const arr = stepsByChain.get(s.chainId) || [];
        arr.push(s); stepsByChain.set(s.chainId, arr);
      }
      res.json(chains.map(c => ({ ...c, steps: stepsByChain.get(c.id) || [] })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Create a new chain. Steps can be supplied inline; the chain is rejected
  // unless it has at least one step (an approval ladder with zero steps is
  // a no-op and indistinguishable from "approvals disabled").
  app.post("/api/finance/approval-chains", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u?.isSystemAdmin) return res.status(403).json({ error: "Admin only" });
      const { name, scope, subtype, direction, description, minAmount, isActive, steps } = req.body || {};
      if (!name || !scope) return res.status(400).json({ error: "name and scope are required" });
      if (!isValidScope(scope)) return res.status(400).json({ error: `Unknown scope "${scope}"` });
      if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: "At least one approval step is required" });
      }
      const cid = companyScope(req);
      const [chain] = await db.insert(approvalChains).values({
        name, scope,
        subtype: subtype || null,
        direction: direction || null,
        description: description || null,
        minAmount: String(minAmount ?? 0),
        isActive: isActive !== false,
        companyId: cid || null,
      }).returning();
      const stepRows = steps.map((s: any, i: number) => ({
        chainId: chain.id,
        sequence: i + 1,
        approverRole: s.approverRole,
        label: s.label || null,
        requiresAll: !!s.requiresAll,
      }));
      const insertedSteps = await db.insert(approvalChainSteps).values(stepRows).returning();
      res.json({ ...chain, steps: insertedSteps });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Update a chain. Steps, when provided, replace the existing ladder
  // (atomic from the engine's perspective: pending requests already point
  // at their resolved chain row but read steps live, so reordering takes
  // effect for the *next* request, not in-flight ones).
  app.patch("/api/finance/approval-chains/:id", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u?.isSystemAdmin) return res.status(403).json({ error: "Admin only" });
      const { name, subtype, direction, description, minAmount, isActive, steps } = req.body || {};
      const patch: any = {};
      if (name !== undefined) patch.name = name;
      if (subtype !== undefined) patch.subtype = subtype || null;
      if (direction !== undefined) patch.direction = direction || null;
      if (description !== undefined) patch.description = description || null;
      if (minAmount !== undefined) patch.minAmount = String(minAmount);
      if (isActive !== undefined) patch.isActive = !!isActive;
      let chain;
      if (Object.keys(patch).length > 0) {
        [chain] = await db.update(approvalChains).set(patch).where(eq(approvalChains.id, req.params.id)).returning();
      } else {
        [chain] = await db.select().from(approvalChains).where(eq(approvalChains.id, req.params.id)).limit(1);
      }
      if (!chain) return res.status(404).json({ error: "Chain not found" });
      if (Array.isArray(steps)) {
        if (steps.length === 0) return res.status(400).json({ error: "At least one approval step is required" });
        await db.delete(approvalChainSteps).where(eq(approvalChainSteps.chainId, chain.id));
        const stepRows = steps.map((s: any, i: number) => ({
          chainId: chain.id,
          sequence: i + 1,
          approverRole: s.approverRole,
          label: s.label || null,
          requiresAll: !!s.requiresAll,
        }));
        await db.insert(approvalChainSteps).values(stepRows);
      }
      const finalSteps = await db.select().from(approvalChainSteps)
        .where(eq(approvalChainSteps.chainId, chain.id))
        .orderBy(asc(approvalChainSteps.sequence));
      res.json({ ...chain, steps: finalSteps });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Delete a chain. Pending requests already created against this chain are
  // preserved (FK is RESTRICT) — the user must finalize/cancel them first.
  app.delete("/api/finance/approval-chains/:id", async (req: any, res) => {
    try {
      const u = req.user;
      if (!u?.isSystemAdmin) return res.status(403).json({ error: "Admin only" });
      const [pending] = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(
        eq(approvalRequests.chainId, req.params.id),
        eq(approvalRequests.status, "pending"),
      )).limit(1);
      if (pending) return res.status(409).json({ error: "Cannot delete: pending requests exist on this chain" });
      await db.delete(approvalChains).where(eq(approvalChains.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/agent-activity", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 500);
      const rows = cid
        ? await db.select().from(agentActivity).where(eq(agentActivity.companyId, cid)).orderBy(desc(agentActivity.createdAt)).limit(limit)
        : await db.select().from(agentActivity).orderBy(desc(agentActivity.createdAt)).limit(limit);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- API key management — scoped by company in addition to admin role.
  app.get("/api/finance/api-keys", ensureInternalAdmin, async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const rows = cid
        ? await db.select().from(apiKeys).where(eq(apiKeys.companyId, cid)).orderBy(desc(apiKeys.createdAt))
        : await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
      res.json(rows.map(r => ({ ...r, hashedSecret: undefined, encryptedSecret: undefined })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/finance/api-keys", ensureInternalAdmin, async (req: any, res) => {
    try {
      const { label, legalEntityId } = req.body || {};
      const { keyPrefix, secret, encryptedSecret } = generateApiKey();
      const u = userFrom(req);
      const [row] = await db.insert(apiKeys).values({
        keyPrefix, hashedSecret: hashSecret(secret), encryptedSecret,
        label: label || "Untitled key", legalEntityId: legalEntityId || null,
        companyId: companyScope(req),
        createdBy: u.id, isActive: true,
      }).returning();
      res.json({ ...row, secret, hashedSecret: undefined, encryptedSecret: undefined, oneTimeReveal: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  const revokeKey = async (req: any, res: any) => {
    try {
      const cid = companyScope(req);
      const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "API key not found" });
      if (cid && existing.companyId && existing.companyId !== cid) {
        return res.status(403).json({ error: "Out of scope" });
      }
      await db.update(apiKeys).set({ isActive: false, revokedAt: new Date() }).where(eq(apiKeys.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  };
  app.delete("/api/finance/api-keys/:id", ensureInternalAdmin, revokeKey);
  app.post("/api/finance/api-keys/:id/revoke", ensureInternalAdmin, revokeKey);

  const eventLogList = async (req: any, res: any) => {
    try {
      const cid = companyScope(req);
      const keyId = req.query.apiKeyId as string | undefined;
      const conds: any[] = [];
      if (keyId) conds.push(eq(inboundEventLog.apiKeyId, keyId));
      if (cid)   conds.push(eq(inboundEventLog.companyId, cid));
      const where = conds.length ? and(...conds) : undefined;
      const rows = where
        ? await db.select().from(inboundEventLog).where(where).orderBy(desc(inboundEventLog.receivedAt)).limit(200)
        : await db.select().from(inboundEventLog).orderBy(desc(inboundEventLog.receivedAt)).limit(200);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  };
  app.get("/api/finance/inbound-event-log", ensureInternalAdmin, eventLogList);
  app.get("/api/finance/inbound-events", ensureInternalAdmin, eventLogList);

  const replayEvent = async (req: any, res: any) => {
    try {
      const [row] = await db.select().from(inboundEventLog).where(eq(inboundEventLog.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const cid = companyScope(req);
      if (cid && row.companyId && row.companyId !== cid) {
        return res.status(403).json({ error: "Out of scope" });
      }
      // Replay bypasses idempotency by using a new source_event_id; goes through the same handler.
      const envelope = { ...(row.payload as any), source_event_id: `${row.sourceEventId || row.id}__replay__${Date.now()}` };
      // Replay must keep the original tenant binding so entity resolution
      // remains hard-scoped to the company that ingested the source event.
      // Without keyCompanyId, processInboundEvent would run with companyId=null
      // and could match/create records under the wrong tenant.
      const out = await handleInboundEnvelope({
        parsedJson: envelope, apiKeyId: row.apiKeyId, keyLegalEntityId: row.legalEntityId || null,
        keyCompanyId: row.companyId || null,
        signatureValid: true, isReplay: true,
      });
      res.status(out.status).json(out.body);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  };
  app.post("/api/finance/inbound-event-log/:id/replay", ensureInternalAdmin, replayEvent);
  app.post("/api/finance/inbound-events/:id/replay", ensureInternalAdmin, replayEvent);

  // ----- Simulate Inbound (admin tool) — actually POSTs to the public
  // /api/inbound-events endpoint with a real HMAC signature, so the demo
  // exercises the exact production integration surface (auth headers, raw
  // body parser, signature verification, idempotency, intake pipeline).
  // Requires an active API key for the company.
  app.post("/api/finance/simulate-inbound", ensureInternalAdmin, async (req: any, res) => {
    try {
      const envelope = req.body;
      const cid = companyScope(req);
      const [keyRow] = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.isActive, true), cid ? eq(apiKeys.companyId, cid) : sql`true`))
        .orderBy(desc(apiKeys.createdAt)).limit(1);
      if (!keyRow || !keyRow.encryptedSecret) {
        return res.status(400).json({ error: "No active API key with stored secret available for this tenant — create one in Integration Settings first." });
      }
      const secret = decryptStoredSecret(keyRow.encryptedSecret);
      if (!secret) return res.status(500).json({ error: "Could not decrypt stored API key secret" });

      const body = JSON.stringify(envelope);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

      const port = (req.socket as any)?.localPort || process.env.PORT || 5000;
      const url = `http://127.0.0.1:${port}/api/inbound-events`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LicenseIQ-Key": keyRow.keyPrefix,
          "X-LicenseIQ-Timestamp": timestamp,
          "X-LicenseIQ-Signature": signature,
        },
        body,
      });
      const text = await r.text();
      let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      const out = r.status === 200 && envelope?.source_event_id
        ? { ...parsed, curl: buildCurlExample(envelope) }
        : parsed;
      res.status(r.status).json(out);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Manual claim entry (admin/finance) — for claims that arrive by phone,
  // email, or PDF before any partner integration is wired up. Inbound flows
  // through the same intake pipeline as automated claims (handleInboundEnvelope
  // bypasses HMAC since the request is already authenticated). Outbound writes
  // an obligations row directly with direction="outbound" so it surfaces in
  // the unified Claims queue alongside engine-generated obligations.
  app.post("/api/finance/claims/manual", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      if (!cid) return res.status(403).json({ error: "No active company" });
      const u = userFrom(req);
      const body = req.body || {};
      const direction: "inbound" | "outbound" = body.direction === "outbound" ? "outbound" : "inbound";
      const claimType = String(body.claim_type || "other");
      const partnerName = body.partner_name ? String(body.partner_name) : null;
      const contractId = body.contract_id ? String(body.contract_id) : null;
      const period = body.period ? String(body.period) : null;
      const amountNum = Number(body.amount);
      if (!Number.isFinite(amountNum) || amountNum < 0) {
        return res.status(400).json({ error: "Amount must be a non-negative number" });
      }
      const amount = String(amountNum);
      const currency = body.currency ? String(body.currency) : "USD";
      const notes = body.notes ? String(body.notes) : null;
      const lines = Array.isArray(body.lines) ? body.lines : [];

      // Verify the claim_type/direction combo is registered.
      const [outcomeRow] = await db.select().from(claimTypeOutcome)
        .where(and(eq(claimTypeOutcome.claimType, claimType), eq(claimTypeOutcome.direction, direction)))
        .limit(1);
      if (!outcomeRow) {
        return res.status(400).json({ error: `claim_type "${claimType}" not registered for ${direction}` });
      }

      if (direction === "inbound") {
        // The inbound envelope schema treats optional fields as
        // `string | undefined` (not nullable), so strip out any null/empty
        // values before submitting — otherwise the manual entry path fails
        // envelope validation when the form leaves notes/period blank.
        const payload: Record<string, any> = {
          claim_type: claimType,
          amount: amountNum,
          currency,
          entered_by: u.name,
        };
        if (partnerName) payload.partner_name = partnerName;
        if (contractId)  payload.contract_id  = contractId;
        if (period)      payload.period       = period;
        if (notes)       payload.notes        = notes;
        if (Array.isArray(lines) && lines.length) payload.lines = lines;
        const envelope = {
          source_event_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          event_type: "claim.received" as const,
          legal_entity_id: null,
          payload,
        };
        const out = await handleInboundEnvelope({
          parsedJson: envelope,
          apiKeyId: null,
          keyLegalEntityId: null,
          keyCompanyId: cid,
          signatureValid: true,
        });
        return res.status(out.status).json(out.body);
      }

      // Outbound — must reference an existing contract.
      if (!contractId) {
        return res.status(400).json({ error: "contract_id is required for outbound claims" });
      }
      const [contractRow] = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
      if (!contractRow) return res.status(404).json({ error: "Contract not found" });
      if (contractRow.companyId && contractRow.companyId !== cid) {
        return res.status(403).json({ error: "Contract belongs to another tenant" });
      }
      const [obl] = await db.insert(obligations).values({
        contractId, partnerName, kind: claimType,
        amount, outstandingAmount: amount, claimedAmount: amount,
        currency, fundingPeriod: period, status: "claim_submitted",
        direction: "outbound", sourceChannel: "manual_entry",
        notes, companyId: cid, createdBy: u.id,
      }).returning();
      await db.insert(obligationEvents).values({
        obligationId: obl.id, eventType: "claim_submitted", fromStatus: null, toStatus: "claim_submitted",
        amount, description: `Manual claim entry by ${u.name}${notes ? `: ${notes}` : ""}`,
        userId: u.id, userName: u.name,
      });
      // Outbound claim = money we owe a partner — always run through the
      // claim approval ladder (defaults to ≥ $10k threshold).
      const reqId = await requireApproval({
        scope: "claim", entityId: obl.id,
        entityLabel: `Outbound ${claimType}${partnerName ? ` · ${partnerName}` : ""}`,
        amount: amountNum, currency, companyId: cid, requestedBy: u.id,
      });
      return res.status(200).json({ outcome: "created", obligationId: obl.id, direction: "outbound", approvalRequestId: reqId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Manual claim edit & delete — only for claims a human entered through the
  // New Claim dialog (sourceChannel "manual" inbound, "manual_entry" outbound)
  // and only while the claim hasn't yet been approved or settled. Once the
  // state machine has decided the claim, downstream artifacts (documents,
  // settlements, JEs) may exist that would be silently orphaned by an edit,
  // so we lock those rows hard. Auto-ingested claims (DataIQ / Customer iPaaS
  // / accrual-promotion) are also locked — those have an upstream system of
  // record and edits should happen there.
  // ---------------------------------------------------------------------------

  // Statuses that lock an inbound claim against edit / delete. Anything that
  // has been decided (approved / partial / paid / settled) has downstream
  // financial artifacts; rejected claims stay deletable so users can clean
  // up genuine mistakes.
  const INBOUND_LOCKED_FOR_EDIT = new Set([
    "approved", "partial_approved", "settled", "paid",
  ]);

  // PATCH /api/finance/inbound-claims/:id — edit the manual-entry fields of
  // a non-locked inbound claim. Mirrors the New Claim dialog's editable
  // surface (claim_type, partner, contract, period, amount, currency, notes).
  // Lines aren't editable here — to change line items, delete the claim and
  // recreate, since lines drive downstream calc breakdowns.
  app.patch("/api/finance/inbound-claims/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      if (!cid) return res.status(403).json({ error: "No active company" });
      const u = userFrom(req);
      const body = req.body || {};

      const [existing] = await db.select().from(inboundClaims)
        .where(and(eq(inboundClaims.id, req.params.id), eq(inboundClaims.companyId, cid)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.sourceChannel !== "manual") {
        return res.status(403).json({ error: "Only manually-created claims can be edited here" });
      }
      if (INBOUND_LOCKED_FOR_EDIT.has(existing.status)) {
        return res.status(409).json({ error: `Cannot edit a claim in status "${existing.status}"` });
      }

      // Resolve contract name when contractId changes (or is being cleared).
      let contractName: string | null | undefined;
      let nextContractId: string | null | undefined;
      if (Object.prototype.hasOwnProperty.call(body, "contract_id")) {
        const v = body.contract_id;
        if (!v) {
          nextContractId = null;
          contractName = null;
        } else if (v !== existing.contractId) {
          const [c] = await db.select({
            id: contracts.id, displayName: contracts.displayName,
            contractNumber: contracts.contractNumber, counterpartyName: contracts.counterpartyName,
            companyId: contracts.companyId,
          }).from(contracts).where(eq(contracts.id, String(v))).limit(1);
          if (!c) return res.status(400).json({ error: "Contract not found" });
          if (c.companyId && c.companyId !== cid) {
            return res.status(403).json({ error: "Contract belongs to another tenant" });
          }
          nextContractId = c.id;
          contractName = c.displayName || c.contractNumber || c.counterpartyName || null;
        }
      }

      // Validate claim_type/direction combo if it's being changed. Inbound
      // claims always stay inbound (different table), so direction is fixed.
      if (body.claim_type && body.claim_type !== existing.claimType) {
        const [outcomeRow] = await db.select().from(claimTypeOutcome)
          .where(and(eq(claimTypeOutcome.claimType, String(body.claim_type)), eq(claimTypeOutcome.direction, "inbound")))
          .limit(1);
        if (!outcomeRow) {
          return res.status(400).json({ error: `claim_type "${body.claim_type}" not registered for inbound` });
        }
      }

      let claimedAmount: string | undefined;
      if (Object.prototype.hasOwnProperty.call(body, "amount")) {
        const n = Number(body.amount);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: "amount must be a non-negative number" });
        }
        claimedAmount = String(n);
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      const changes: string[] = [];
      const setIf = (cond: boolean, key: string, value: any) => {
        if (cond) { updates[key] = value; changes.push(key); }
      };
      setIf(body.claim_type !== undefined && body.claim_type !== existing.claimType, "claimType", body.claim_type);
      setIf(body.partner_name !== undefined && (body.partner_name || null) !== existing.partnerName, "partnerName", body.partner_name || null);
      setIf(nextContractId !== undefined, "contractId", nextContractId);
      setIf(contractName !== undefined, "contractName", contractName);
      setIf(body.period !== undefined && (body.period || null) !== existing.period, "period", body.period || null);
      setIf(claimedAmount !== undefined && claimedAmount !== existing.claimedAmount, "claimedAmount", claimedAmount);
      setIf(body.currency !== undefined && body.currency !== existing.currency, "currency", body.currency);

      // Notes live in metadata so we don't disturb the original rawPayload
      // (which is the canonical record of what came in at intake time).
      if (Object.prototype.hasOwnProperty.call(body, "notes")) {
        const meta = (existing.metadata as any) || {};
        const nextMeta = { ...meta, notes: body.notes || null };
        updates.metadata = nextMeta;
        changes.push("metadata.notes");
      }

      if (changes.length === 1 /* only updatedAt */) {
        return res.json(existing);
      }

      // Cast: `updates` is built dynamically from the request body so we
      // type it as `Record<string, any>`. Drizzle's strict UpdateSet type
      // doesn't accept that shape, so we widen at the call site. Each key
      // we set is a real column on the table — see setIf() above.
      const [row] = await db.update(inboundClaims).set(updates as any)
        .where(eq(inboundClaims.id, existing.id)).returning();

      await db.insert(inboundClaimEvents).values({
        claimId: existing.id, eventType: "edited",
        fromStatus: existing.status, toStatus: existing.status,
        amount: row.claimedAmount,
        description: `Manual edit by ${u.name}: ${changes.filter(c => c !== "updatedAt").join(", ")}`,
        userId: u.id, userName: u.name,
        metadata: { changes },
      } as any);

      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/finance/inbound-claims/:id — remove a manual, non-locked
  // inbound claim. Lines and events cascade-delete via FK. Auto-ingested
  // claims and decided claims are refused so the audit picture stays whole.
  app.delete("/api/finance/inbound-claims/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      if (!cid) return res.status(403).json({ error: "No active company" });

      const [existing] = await db.select().from(inboundClaims)
        .where(and(eq(inboundClaims.id, req.params.id), eq(inboundClaims.companyId, cid)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.sourceChannel !== "manual") {
        return res.status(403).json({ error: "Only manually-created claims can be deleted here" });
      }
      if (INBOUND_LOCKED_FOR_EDIT.has(existing.status)) {
        return res.status(409).json({ error: `Cannot delete a claim in status "${existing.status}"` });
      }

      await db.delete(inboundClaims).where(eq(inboundClaims.id, existing.id));
      res.status(204).end();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/finance/outbound-claims/:id — edit a manual outbound claim
  // (which is an obligation row). Locked once the approval ladder has
  // decided, since "approved" outbound obligations may already have a draft
  // document or settlement attached.
  app.patch("/api/finance/outbound-claims/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      if (!cid) return res.status(403).json({ error: "No active company" });
      const u = userFrom(req);
      const body = req.body || {};

      const [existing] = await db.select().from(obligations)
        .where(and(eq(obligations.id, req.params.id), eq(obligations.companyId, cid)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.sourceChannel !== "manual_entry") {
        return res.status(403).json({ error: "Only manually-created claims can be edited here" });
      }
      if (existing.status !== "claim_submitted") {
        return res.status(409).json({ error: `Cannot edit an outbound claim in status "${existing.status}"` });
      }

      // contract_id is required for outbound claims so we don't allow clearing.
      // (The obligations table has no `contractName` denorm — the join in the
      // unified claims list pulls the display name from the contracts table at
      // read time — so we only need to validate the FK here.)
      let nextContractId: string | undefined;
      if (Object.prototype.hasOwnProperty.call(body, "contract_id")) {
        if (!body.contract_id) {
          return res.status(400).json({ error: "contract_id is required for outbound claims" });
        }
        if (body.contract_id !== existing.contractId) {
          const [c] = await db.select({
            id: contracts.id, companyId: contracts.companyId,
          }).from(contracts).where(eq(contracts.id, String(body.contract_id))).limit(1);
          if (!c) return res.status(400).json({ error: "Contract not found" });
          if (c.companyId && c.companyId !== cid) {
            return res.status(403).json({ error: "Contract belongs to another tenant" });
          }
          nextContractId = c.id;
        }
      }

      if (body.claim_type && body.claim_type !== existing.kind) {
        const [outcomeRow] = await db.select().from(claimTypeOutcome)
          .where(and(eq(claimTypeOutcome.claimType, String(body.claim_type)), eq(claimTypeOutcome.direction, "outbound")))
          .limit(1);
        if (!outcomeRow) {
          return res.status(400).json({ error: `claim_type "${body.claim_type}" not registered for outbound` });
        }
      }

      let amount: string | undefined;
      if (Object.prototype.hasOwnProperty.call(body, "amount")) {
        const n = Number(body.amount);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: "amount must be a non-negative number" });
        }
        amount = String(n);
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      const changes: string[] = [];
      const setIf = (cond: boolean, key: string, value: any) => {
        if (cond) { updates[key] = value; changes.push(key); }
      };
      setIf(body.claim_type !== undefined && body.claim_type !== existing.kind, "kind", body.claim_type);
      setIf(body.partner_name !== undefined && (body.partner_name || null) !== existing.partnerName, "partnerName", body.partner_name || null);
      setIf(nextContractId !== undefined, "contractId", nextContractId);
      setIf(body.period !== undefined && (body.period || null) !== existing.fundingPeriod, "fundingPeriod", body.period || null);
      // Amount drives 3 columns on outbound — keep them in lockstep so the
      // settlement workspace doesn't see an inconsistent "outstanding > total".
      if (amount !== undefined && amount !== existing.amount) {
        updates.amount = amount;
        updates.outstandingAmount = amount;
        updates.claimedAmount = amount;
        changes.push("amount");
      }
      setIf(body.currency !== undefined && body.currency !== existing.currency, "currency", body.currency);
      setIf(body.notes !== undefined && (body.notes || null) !== existing.notes, "notes", body.notes || null);

      if (changes.length === 0) return res.json(existing);

      // Same dynamic-shape cast as the inbound PATCH above.
      const [row] = await db.update(obligations).set(updates as any)
        .where(eq(obligations.id, existing.id)).returning();

      await db.insert(obligationEvents).values({
        obligationId: existing.id, eventType: "edited",
        fromStatus: existing.status, toStatus: existing.status,
        amount: row.amount,
        description: `Manual edit by ${u.name}: ${changes.join(", ")}`,
        userId: u.id, userName: u.name,
      } as any);

      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/finance/outbound-claims/:id — remove a manual outbound claim
  // and cancel any pending approval request that was filed against it. If the
  // approval was already decided, refuse the delete since downstream artifacts
  // may exist.
  app.delete("/api/finance/outbound-claims/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      if (!cid) return res.status(403).json({ error: "No active company" });
      const u = userFrom(req);

      const [existing] = await db.select().from(obligations)
        .where(and(eq(obligations.id, req.params.id), eq(obligations.companyId, cid)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.sourceChannel !== "manual_entry") {
        return res.status(403).json({ error: "Only manually-created claims can be deleted here" });
      }
      if (existing.status !== "claim_submitted") {
        return res.status(409).json({ error: `Cannot delete an outbound claim in status "${existing.status}"` });
      }

      // Cancel any pending approval request still in flight. Decided
      // requests are left alone — they're history.
      // Cast: drizzle-zod's overload typing for `.set()` doesn't recognise
      // `status` here even though it's a real column on approval_requests
      // (this is part of the same baseline TS debt around drizzle 0.7.x).
      await db.update(approvalRequests)
        .set({ status: "cancelled", completedAt: new Date() } as any)
        .where(and(
          eq(approvalRequests.entityType, "claim"),
          eq(approvalRequests.entityId, existing.id),
          eq(approvalRequests.status, "pending"),
        ));

      // obligation_events cascades on FK delete.
      await db.delete(obligations).where(eq(obligations.id, existing.id));

      // Best-effort log of the delete on the agent activity stream so it
      // shows up in the workspace audit panel even after the obligation
      // row is gone.
      try {
        await db.insert(agentActivity).values({
          companyId: cid,
          activityType: "manual_action",
          scope: "obligation",
          scopeId: existing.id,
          summary: `Manual outbound claim deleted by ${u.name}`,
          payload: { kind: existing.kind, amount: existing.amount, partnerName: existing.partnerName },
        } as any);
      } catch { /* agentActivity is observability-only */ }

      res.status(204).end();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Lightweight enum/options endpoint backing the manual-claim dialog.
  app.get("/api/finance/claims/manual-options", async (req: any, res) => {
    try {
      const types = await db.select().from(claimTypeOutcome);
      const cid = companyScope(req);
      const contractRows = cid
        ? await db.select({
            id: contracts.id,
            displayName: contracts.displayName,
            contractNumber: contracts.contractNumber,
            counterpartyName: contracts.counterpartyName,
          }).from(contracts).where(eq(contracts.companyId, cid)).orderBy(desc(contracts.createdAt)).limit(500)
        : [];
      const partners = uniquePartnerNames(contractRows);
      res.json({ claimTypes: types, contracts: contractRows, partners });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Deductions Workspace (Finance Hub Phase B)
  app.get("/api/finance/deductions", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const status = req.query.status ? String(req.query.status) : null;
      const conds: any[] = [eq(deductions.companyId, cid)];
      if (status && status !== "all") conds.push(eq(deductions.status, status));
      const rows = await db.select().from(deductions).where(and(...conds)).orderBy(desc(deductions.createdAt)).limit(500);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/finance/deductions/options", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const codes = await db.select().from(deductionReasonCodes).where(eq(deductionReasonCodes.isActive, true));
      const contractRows = await db.select({
        id: contracts.id, displayName: contracts.displayName,
        contractNumber: contracts.contractNumber, counterpartyName: contracts.counterpartyName,
      }).from(contracts).where(eq(contracts.companyId, cid)).orderBy(desc(contracts.createdAt)).limit(500);
      const partners = uniquePartnerNames(contractRows);
      res.json({ reasonCodes: codes, contracts: contractRows, partners });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Lightweight Oracle ERP sync status. The real Oracle integration is not
  // wired yet, so we read whatever the system_settings has stored under
  // `erp.oracle.lastSyncAt` / `erp.oracle.connected` (set by future jobs)
  // and fall back to a "not connected" payload so the UI badge is honest.
  app.get("/api/finance/oracle-status", async (req: any, res) => {
    try {
      // The real Oracle ERP integration is not wired yet. When it is, replace
      // these defaults by reading from the future `erp_connections` table.
      const connected = false;
      const lastSyncAt: string | null = null;
      const lastError: string | null = null;
      // Counts of documents that depend on Oracle round-trips so Finance can
      // see the "in-flight" backlog at a glance.
      const cid = companyScope(req);
      const counts = await db.execute(sql`
        SELECT status, COUNT(*)::int AS n FROM finance_documents
        WHERE company_id = ${cid} AND status IN ('awaiting_oracle','sent','posted')
        GROUP BY status
      `);
      const byStatus: Record<string, number> = {};
      for (const r of (counts as any).rows || counts as any) {
        byStatus[(r as any).status] = Number((r as any).n);
      }
      res.json({
        connected, lastSyncAt, lastError,
        awaitingOracle: byStatus["awaiting_oracle"] || 0,
        sent: byStatus["sent"] || 0,
        posted: byStatus["posted"] || 0,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Aggregated counters for the Deductions KPI strip. Splits open items into
  // "expected" (reason code disposition resolves to auto_clear / match) vs
  // "unexpected" (everything else) so Finance can see the cognitive split
  // before opening individual rows. Also surfaces today's auto-clear activity.
  app.get("/api/finance/deductions/stats", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const rows = await db.select().from(deductions).where(eq(deductions.companyId, cid));
      const codes = await db.select().from(deductionReasonCodes).where(eq(deductionReasonCodes.isActive, true));
      const autoCodes = new Set(codes.filter(c => c.defaultDisposition === "auto_clear" || c.defaultDisposition === "match").map(c => c.code));
      let openCount = 0, openExposure = 0, expectedOpen = 0, unexpectedOpen = 0, needsReview = 0, disputed = 0;
      for (const d of rows) {
        const isOpen = !["written_off","recovered","matched"].includes(d.status || "");
        const amt = Number(d.deductedAmount || 0);
        if (isOpen) {
          openCount += 1;
          openExposure += amt;
          if (d.reasonCode && autoCodes.has(d.reasonCode)) expectedOpen += 1;
          else unexpectedOpen += 1;
        }
        if (d.status === "needs_review") needsReview += 1;
        if (d.status === "disputed") disputed += 1;
      }
      // Today's auto-clears: deduction_events where event_type contains
      // 'auto' or 'cleared' written today by the system.
      const today = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM deduction_events
        WHERE created_at >= date_trunc('day', now())
          AND (event_type ILIKE '%auto%' OR event_type ILIKE '%cleared%' OR event_type = 'matched')
      `);
      const autoClearedToday = Number(((today as any).rows?.[0] || (today as any)[0])?.n || 0);
      res.json({ openCount, openExposure, expectedOpen, unexpectedOpen, needsReview, disputed, autoClearedToday });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Returns fiscal periods from period_close. Falls back to a generated
  // 12-month / 4-quarter list when the table is empty so the dropdown is
  // never blank for new tenants.
  app.get("/api/finance/periods", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const rows = await db.select({
        id: periodClose.id,
        label: periodClose.periodLabel,
        status: periodClose.status,
      }).from(periodClose)
        .where(cid ? eq(periodClose.companyId, cid) : sql`true`)
        .orderBy(desc(periodClose.createdAt))
        .limit(48);
      if (rows.length > 0) {
        const seen = new Set<string>();
        const periods = rows.filter(r => {
          if (!r.label || seen.has(r.label)) return false;
          seen.add(r.label); return true;
        });
        return res.json({ periods, source: "period_close" });
      }
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const now = new Date();
      const generated: { id: null; label: string; status: string }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        generated.push({ id: null, label: `${months[d.getMonth()]} ${d.getFullYear()}`, status: "generated" });
      }
      const y = now.getFullYear();
      const q = Math.floor(now.getMonth() / 3) + 1;
      for (let i = 0; i < 4; i++) {
        let qq = q - i; let yy = y;
        while (qq <= 0) { qq += 4; yy -= 1; }
        generated.push({ id: null, label: `${yy}-Q${qq}`, status: "generated" });
      }
      generated.push({ id: null, label: `${y}`, status: "generated" });
      generated.push({ id: null, label: `${y - 1}`, status: "generated" });
      res.json({ periods: generated, source: "generated" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Lightweight options for the New Document dialog (Invoices & Memos workspace).
  app.get("/api/finance/documents/options", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const contractRows = await db.select({
        id: contracts.id, displayName: contracts.displayName,
        contractNumber: contracts.contractNumber, counterpartyName: contracts.counterpartyName,
      }).from(contracts).where(eq(contracts.companyId, cid)).orderBy(desc(contracts.createdAt)).limit(500);
      res.json({ partners: uniquePartnerNames(contractRows), contracts: contractRows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/finance/deductions/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const [row] = await db.select().from(deductions)
        .where(and(eq(deductions.id, req.params.id), eq(deductions.companyId, cid))).limit(1);
      if (!row) return res.status(404).json({ error: "Not found" });
      const events = await db.select().from(deductionEvents)
        .where(eq(deductionEvents.deductionId, row.id)).orderBy(desc(deductionEvents.createdAt));
      // Suggested matches: same partner, optional same contract, amount within ±5%
      const amt = Number(row.deductedAmount);
      const lo = String(amt * 0.95);
      const hi = String(amt * 1.05);
      const claimConds: any[] = [eq(inboundClaims.companyId, cid)];
      if (row.partnerId) claimConds.push(eq(inboundClaims.partnerId, row.partnerId));
      else if (row.partnerName) claimConds.push(eq(inboundClaims.partnerName, row.partnerName));
      claimConds.push(sql`${inboundClaims.claimedAmount} BETWEEN ${lo}::numeric AND ${hi}::numeric`);
      const claimMatches = await db.select({
        id: inboundClaims.id, claimNumber: inboundClaims.claimNumber, claimType: inboundClaims.claimType,
        amount: inboundClaims.claimedAmount, status: inboundClaims.status, period: inboundClaims.period,
      }).from(inboundClaims).where(and(...claimConds)).limit(10);
      const oblConds: any[] = [eq(obligations.companyId, cid)];
      if (row.contractId) oblConds.push(eq(obligations.contractId, row.contractId));
      oblConds.push(sql`${obligations.amount} BETWEEN ${lo}::numeric AND ${hi}::numeric`);
      const oblMatches = await db.select({
        id: obligations.id, kind: obligations.kind, amount: obligations.amount,
        status: obligations.status, fundingPeriod: obligations.fundingPeriod,
      }).from(obligations).where(and(...oblConds)).limit(10);
      res.json({ deduction: row, events, suggestedMatches: { claims: claimMatches, obligations: oblMatches } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/finance/deductions", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const u = userFrom(req);
      const body = req.body || {};
      const amountNum = Number(body.deductedAmount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "deductedAmount must be > 0" });
      }
      if (!body.partnerName) return res.status(400).json({ error: "partnerName is required" });
      // Auto-number per company. db.execute on the Neon serverless driver
      // returns `{ rows: [...] }`, so we cannot array-destructure the result
      // directly — fall through both shapes the same way the stats endpoint
      // does (line ~1349).
      const countResult = await db.execute(sql`SELECT count(*)::int AS count FROM deductions WHERE company_id = ${cid}`);
      const count = Number(((countResult as any).rows?.[0] || (countResult as any)[0])?.count || 0);
      const seq = count + 1;
      const deductionNumber = body.deductionNumber || `DED-${String(seq).padStart(6, "0")}`;
      const [row] = await db.insert(deductions).values({
        companyId: cid,
        partnerId: body.partnerId || null,
        partnerName: String(body.partnerName),
        contractId: body.contractId || null,
        contractName: body.contractName || null,
        deductionNumber,
        deductedAmount: String(amountNum),
        currency: body.currency || "USD",
        deductionDate: body.deductionDate ? new Date(body.deductionDate) : new Date(),
        originalInvoiceRef: body.originalInvoiceRef || null,
        reasonCode: body.reasonCode || null,
        reasonText: body.reasonText || null,
        status: "needs_review",
        sourceChannel: body.sourceChannel || "manual",
        notes: body.notes || null,
        createdBy: u.id,
      }).returning();
      await db.insert(deductionEvents).values({
        deductionId: row.id, eventType: "created", fromStatus: null, toStatus: "needs_review",
        amount: String(amountNum), description: `Deduction created by ${u.name}${body.notes ? `: ${body.notes}` : ""}`,
        userId: u.id, userName: u.name,
      });
      res.status(201).json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/finance/deductions/:id — edit a non-terminal deduction's metadata.
  // Status transitions are NOT handled here (use /decide and /match). Editable
  // fields cover the New Deduction form: partner, contract, amount, currency,
  // date, invoice ref, reason code/text, notes. We lock terminal-status rows
  // (written_off, recovered) to keep the audit picture immutable once closed.
  app.patch("/api/finance/deductions/:id", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const u = userFrom(req);
      const body = req.body || {};
      const [existing] = await db.select().from(deductions)
        .where(and(eq(deductions.id, req.params.id), eq(deductions.companyId, cid))).limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (["written_off", "recovered"].includes(existing.status)) {
        return res.status(409).json({ error: "Cannot edit a closed deduction (write-off/recovered)" });
      }

      // Resolve contract name when contractId changes (or is provided).
      let contractName: string | null | undefined = undefined;
      if (body.contractId === null || body.contractId === "") {
        contractName = null;
      } else if (body.contractId && body.contractId !== existing.contractId) {
        const [c] = await db.select({
          id: contracts.id, displayName: contracts.displayName,
          contractNumber: contracts.contractNumber, counterpartyName: contracts.counterpartyName,
        }).from(contracts).where(and(eq(contracts.id, body.contractId), eq(contracts.companyId, cid))).limit(1);
        if (!c) return res.status(400).json({ error: "Contract not found in this company" });
        contractName = c.displayName || c.contractNumber || c.counterpartyName || null;
      }

      const updates: any = { updatedAt: new Date() };
      const changes: string[] = [];
      const setIfPresent = (key: string, dbField: string, parser?: (v: any) => any) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const v = parser ? parser(body[key]) : body[key];
          if (v !== (existing as any)[dbField]) {
            updates[dbField] = v;
            changes.push(dbField);
          }
        }
      };

      if (Object.prototype.hasOwnProperty.call(body, "deductedAmount")) {
        const amt = Number(body.deductedAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
          return res.status(400).json({ error: "deductedAmount must be > 0" });
        }
        if (String(amt) !== String(existing.deductedAmount)) {
          updates.deductedAmount = String(amt);
          changes.push("deductedAmount");
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, "partnerName")) {
        const v = String(body.partnerName || "").trim();
        if (!v) return res.status(400).json({ error: "partnerName cannot be empty" });
        if (v !== existing.partnerName) { updates.partnerName = v; changes.push("partnerName"); }
      }
      setIfPresent("partnerId", "partnerId", (v) => v || null);
      if (contractName !== undefined) {
        // contractId cleared or explicitly changed
        if (body.contractId !== existing.contractId) {
          updates.contractId = body.contractId || null;
          updates.contractName = contractName;
          changes.push("contractId");
        }
      }
      setIfPresent("currency", "currency", (v) => v || "USD");
      if (Object.prototype.hasOwnProperty.call(body, "deductionDate")) {
        const d = body.deductionDate ? new Date(body.deductionDate) : null;
        if (d) { updates.deductionDate = d; changes.push("deductionDate"); }
      }
      setIfPresent("originalInvoiceRef", "originalInvoiceRef", (v) => v || null);
      setIfPresent("reasonCode", "reasonCode", (v) => v || null);
      setIfPresent("reasonText", "reasonText", (v) => v || null);
      setIfPresent("notes", "notes", (v) => v || null);

      if (changes.length === 0) {
        return res.json(existing);
      }

      const [updated] = await db.update(deductions).set(updates)
        .where(eq(deductions.id, existing.id)).returning();
      await db.insert(deductionEvents).values({
        deductionId: existing.id,
        eventType: "edited",
        fromStatus: existing.status,
        toStatus: existing.status,
        amount: updated.deductedAmount,
        description: `Edited by ${u.name}: ${changes.join(", ")}`,
        userId: u.id,
        userName: u.name,
        metadata: { changedFields: changes },
      } as any);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/finance/deductions/:id/decide", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const u = userFrom(req);
      const action = String(req.body?.action || "");
      const note = req.body?.note ? String(req.body.note) : null;
      const allowed: Record<string, string> = {
        match: "matched", dispute: "disputed", write_off: "written_off", recover: "recovered",
      };
      const toStatus = allowed[action];
      if (!toStatus) return res.status(400).json({ error: "Invalid action" });
      const [row] = await db.select().from(deductions)
        .where(and(eq(deductions.id, req.params.id), eq(deductions.companyId, cid))).limit(1);
      if (!row) return res.status(404).json({ error: "Not found" });
      const [updated] = await db.update(deductions)
        .set({ status: toStatus, updatedAt: new Date() })
        .where(eq(deductions.id, row.id)).returning();
      await db.insert(deductionEvents).values({
        deductionId: row.id, eventType: action, fromStatus: row.status, toStatus,
        amount: row.deductedAmount, description: note || `${action} by ${u.name}`,
        userId: u.id, userName: u.name,
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/finance/deductions/:id/match", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      const u = userFrom(req);
      const claimId = req.body?.claimId ? String(req.body.claimId) : null;
      const obligationId = req.body?.obligationId ? String(req.body.obligationId) : null;
      if (!claimId && !obligationId) return res.status(400).json({ error: "claimId or obligationId required" });
      const [row] = await db.select().from(deductions)
        .where(and(eq(deductions.id, req.params.id), eq(deductions.companyId, cid))).limit(1);
      if (!row) return res.status(404).json({ error: "Not found" });
      const [updated] = await db.update(deductions).set({
        matchedClaimId: claimId, matchedObligationId: obligationId,
        status: "matched", updatedAt: new Date(),
      }).where(eq(deductions.id, row.id)).returning();
      await db.insert(deductionEvents).values({
        deductionId: row.id, eventType: "matched", fromStatus: row.status, toStatus: "matched",
        amount: row.deductedAmount,
        description: `Matched to ${claimId ? `claim ${claimId}` : `obligation ${obligationId}`} by ${u.name}`,
        userId: u.id, userName: u.name,
        metadata: { claimId, obligationId },
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Adjustments (consolidated read-only view, tenant-scoped)
  app.get("/api/finance/adjustments", async (req: any, res) => {
    try {
      const cid = companyScope(req);
      // accrual_audit_trail joined via accruals.companyId
      const auditRows = await db
        .select({
          id: accrualAuditTrail.id, createdAt: accrualAuditTrail.createdAt,
          description: accrualAuditTrail.description, accrualId: accrualAuditTrail.accrualId,
          userName: accrualAuditTrail.userName, companyId: accruals.companyId,
        })
        .from(accrualAuditTrail)
        .leftJoin(accruals, eq(accrualAuditTrail.accrualId, accruals.id))
        .where(cid
          ? and(eq(accrualAuditTrail.eventType, "manual_adjustment"), eq(accruals.companyId, cid))
          : eq(accrualAuditTrail.eventType, "manual_adjustment"))
        .orderBy(desc(accrualAuditTrail.createdAt))
        .limit(500);
      // recoupment_ledger_entries — already has its own companyId field via contracts join
      const recoupRows = await db
        .select({ row: recoupmentLedgerEntries, companyId: contracts.companyId })
        .from(recoupmentLedgerEntries)
        .leftJoin(contracts, eq(recoupmentLedgerEntries.contractId, contracts.id))
        .where(cid
          ? and(eq(recoupmentLedgerEntries.entryType, "manual_adjustment"), eq(contracts.companyId, cid))
          : eq(recoupmentLedgerEntries.entryType, "manual_adjustment"))
        .orderBy(desc(recoupmentLedgerEntries.createdAt))
        .limit(500);
      // obligation_events — scope via obligations.companyId
      const oblEvents = await db
        .select({ row: obligationEvents, companyId: obligations.companyId })
        .from(obligationEvents)
        .leftJoin(obligations, eq(obligationEvents.obligationId, obligations.id))
        .where(cid
          ? and(or(eq(obligationEvents.eventType, "trued_up"), eq(obligationEvents.eventType, "reversed")), eq(obligations.companyId, cid))
          : or(eq(obligationEvents.eventType, "trued_up"), eq(obligationEvents.eventType, "reversed")))
        .orderBy(desc(obligationEvents.createdAt))
        .limit(500);
      const merged = [
        ...auditRows.map(a => ({ id: a.id, source: "accrual_audit", date: a.createdAt, description: a.description, amount: null, refId: a.accrualId, user: a.userName })),
        ...recoupRows.map(({ row: r }) => ({ id: r.id, source: "recoupment_ledger", date: r.createdAt, description: r.reason, amount: r.consumed, refId: r.contractId, user: r.createdBy })),
        ...oblEvents.map(({ row: o }) => ({ id: o.id, source: "obligation_event", date: o.createdAt, description: `${o.eventType}: ${o.description || ""}`, amount: o.amount, refId: o.obligationId, user: o.userName })),
      ].sort((a, b) => +new Date(b.date as any) - +new Date(a.date as any));
      res.json(merged);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ----- Settlement → generate outbound claim from variance
  app.post("/api/finance/settlements/:id/generate-claim", async (req: any, res) => {
    try {
      const [s] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
      if (!s) return res.status(404).json({ error: "Settlement not found" });
      const cid = companyScope(req);
      if (cid && s.companyId && s.companyId !== cid) {
        return res.status(403).json({ error: "Out of scope" });
      }
      const u = userFrom(req);
      const [obl] = await db.insert(obligations).values({
        contractId: s.contractId!, partnerName: s.counterparty, kind: "rebate_settlement",
        amount: String(s.variance || 0), outstandingAmount: String(s.variance || 0),
        currency: "USD", fundingPeriod: s.period, status: "claim_submitted",
        direction: "outbound", sourceChannel: "settlement_variance",
        notes: `Generated from settlement ${s.id} variance`,
        companyId: s.companyId, createdBy: u.id,
      }).returning();
      await db.insert(obligationEvents).values({
        obligationId: obl.id, eventType: "claim_submitted", fromStatus: null, toStatus: "claim_submitted",
        description: `Auto-generated from settlement ${s.id} (variance ${s.variance})`,
        userId: u.id, userName: u.name,
      });
      res.json(obl);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Bootstrap config / seed claim_type_outcome on first call.
  seedClaimTypeOutcomes().catch(() => { /* tolerated */ });
  ensurePeriodCloseExtraItems().catch(() => { /* tolerated */ });
  seedDefaultApprovalChains().catch(() => { /* tolerated */ });
  startApprovalSweeper();
}

/** Parse "YYYY-MM" or "YYYY-Qn" into a representative Date (period end). */
function parsePeriodToDate(period: string | null | undefined): Date | null {
  if (!period) return null;
  const ym = /^(\d{4})-(\d{2})$/.exec(period);
  if (ym) return new Date(Date.UTC(+ym[1], +ym[2], 0));
  const yq = /^(\d{4})-Q([1-4])$/.exec(period);
  if (yq) return new Date(Date.UTC(+yq[1], +yq[2] * 3, 0));
  const ts = Date.parse(period);
  return Number.isFinite(ts) ? new Date(ts) : null;
}

/** Strictly resolve accrual date from contract.obligationAccrualBasis,
 *  with system_settings.default_obligation_accrual_basis as the fallback.
 *
 *  The accrual date MUST reflect the contractual period attribution — never
 *  "today". Sources, in priority order:
 *    1. claim.period (parsed)              — explicit period from the event
 *    2. contract.periodEnd / periodStart   — contractual coverage window
 *    3. rawPayload.occurred_at             — counterparty's event timestamp
 *  Throws if no period source is available so the caller surfaces a clear
 *  error rather than silently posting to the current date.
 */
async function resolveAccrualDate(claim: InboundClaim): Promise<Date> {
  return resolveAccrualDateFromSource({
    sourceLabel: `claim ${claim.id}`,
    contractId: claim.contractId || null,
    period: claim.period || null,
    occurredAt: (claim.rawPayload as any)?.occurred_at || null,
  });
}

/** Generic accrual-date resolver shared by inbound claim and outbound
 *  obligation document generation. Never falls back to "today" — uses
 *  contract.obligationAccrualBasis (or system_settings default), then
 *  attributes recognition to the period sources in priority order. */
async function resolveAccrualDateFromSource(opts: {
  sourceLabel: string;
  contractId: string | null;
  period: string | null;
  occurredAt: string | Date | null;
}): Promise<Date> {
  let basis: string | null = null;
  let contractPeriodStart: Date | null = null;
  let contractPeriodEnd: Date | null = null;
  if (opts.contractId) {
    const [c] = await db.select().from(contracts).where(eq(contracts.id, opts.contractId));
    if (c) {
      basis = c.obligationAccrualBasis ?? null;
      contractPeriodStart = c.periodStart ? new Date(c.periodStart as unknown as string) : null;
      contractPeriodEnd   = c.periodEnd   ? new Date(c.periodEnd   as unknown as string) : null;
    }
  }
  if (!basis) {
    const [s] = await db.select().from(systemSettings).limit(1);
    basis = s?.defaultObligationAccrualBasis ?? "scheduled_release";
  }

  const periodEnd   = parsePeriodToDate(opts.period) || contractPeriodEnd;
  const periodStart = contractPeriodStart || periodEnd;
  const occurredAt = opts.occurredAt
    ? (opts.occurredAt instanceof Date ? opts.occurredAt : new Date(opts.occurredAt))
    : null;

  let resolved: Date | null = null;
  switch (basis) {
    case "qualifying_sale":   resolved = periodStart || occurredAt; break;
    case "scheduled_release": resolved = periodEnd   || occurredAt; break;
    default:                  resolved = periodEnd   || periodStart || occurredAt;
  }
  if (!resolved) {
    throw new Error(
      `Cannot resolve accrual date for ${opts.sourceLabel}: no period, contract period, or occurred_at available (basis=${basis}).`,
    );
  }
  return resolved;
}

function buildCurlExample(envelope: any): string {
  const body = JSON.stringify(envelope);
  // HMAC-only flow: secret is never sent on the wire. Sign timestamp + "." + body.
  return [
    `# HMAC-SHA256 signing — secret stays on the client.`,
    `BODY='${body.replace(/'/g, "'\\''")}'`,
    `TS=$(date +%s)`,
    `SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$LICENSEIQ_SECRET" -hex | awk '{print $2}')`,
    `curl -X POST $LICENSEIQ_BASE/api/inbound-events \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H "X-LicenseIQ-Key: $LICENSEIQ_KEY_PREFIX" \\`,
    `  -H "X-LicenseIQ-Timestamp: $TS" \\`,
    `  -H "X-LicenseIQ-Signature: $SIG" \\`,
    `  -d "$BODY"`,
  ].join("\n");
}

/** Append three Phase A items to every active period_close checklist (idempotent). */
async function ensurePeriodCloseExtraItems() {
  const items = [
    "All inbound claims resolved",
    "All finance documents posted",
    "No unresolved disputes",
  ];
  const periods = await db.execute(sql`SELECT id FROM period_close WHERE COALESCE(status,'open') NOT IN ('closed','locked')`);
  for (const row of periods.rows as any[]) {
    for (const itemName of items) {
      const exists = await db.select().from(periodCloseChecklist).where(and(eq(periodCloseChecklist.periodId, row.id), eq(periodCloseChecklist.itemName, itemName))).limit(1);
      if (!exists.length) {
        await db.insert(periodCloseChecklist).values({
          periodId: row.id, itemName, status: "idle",
        });
      }
    }
  }
}
