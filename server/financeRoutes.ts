import { Router, Request } from "express";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  accruals, accrualAuditTrail, accrualCalculationTrace,
  journalEntries, journalEntryLines, jeErpSyncLog, jeReconciliation,
  periodClose, periodCloseChecklist, periodCloseBlockers,
  periodCloseAuditTrail, periodVariance, contractCloseStatus,
  settlements, settlementLineItems,
  contracts, flowTypes,
  inboundClaims, inboundClaimEvents, deductions,
  financeDocuments,
  companySettings,
  contractPartnerAssignments,
  obligations, obligationEvents,
  closeBatchOperations,
  pinnedKpis,
  closeChatThreads,
  closeChatMessages,
} from "@shared/schema";
import { runIdempotentBatch, type BatchResultSummary } from "./services/closeBatch";
import {
  execPostJEs,
  execSettle,
  execResolveClaims,
  execApplyDeductions,
  execReverseAccruals,
  execFlagBlocker,
  execBatchAction,
  BATCH_OP_BY_ACTION,
  NON_BATCH_ACTIONS,
  type CloseActionType,
} from "./services/closeActions";
import { closeDecisions } from "@shared/schema";
import {
  askLedgerIQ,
  getCachedAskResult,
  evaluateQueryPlan,
} from "./services/kpiAsk";
import { inArray } from "drizzle-orm";

// Statuses that exclude a deduction from the "open against this contract"
// roll-up. Anything outside this set is still bleeding cash on the contract
// and should be surfaced on the settlement detail.
const DEDUCTION_CLOSED_STATUSES = ["matched", "written_off", "recovered"];

// Settlement statuses that imply finance has formally agreed to a number
// (and, if the settlement is matched to an inbound claim, that the claim
// itself has been approved or partial-approved). Used to gate the PATCH
// endpoint so we can't post a credit memo / GL entry against a settlement
// whose source claim is still in `received` / `validating` / `disputed`.
const APPROVAL_LOCKED_SETTLEMENT_STATUSES = new Set([
  "approved", "partial", "posted",
]);
const CLAIM_STATUSES_OK_TO_SETTLE = new Set([
  "approved", "partial_approved",
]);

// Defaults for the residual-clearing JE when company_settings has no
// override. Mirrors the chart of accounts used elsewhere in the finance
// state machine (2150 = Accrued Liability bucket, 4000 = Revenue).
const DEFAULT_ACCRUED_LIABILITY_ACCOUNT = "2150";
const DEFAULT_REVENUE_ACCOUNT = "4000";

// Public shape returned by the residual-clear helper. `skipped` is set
// when the helper short-circuits without posting (no residual, already
// cleared, or status not eligible) so callers can decide whether to
// surface it as a 200 (auto-clear best-effort) or a 409 (manual click).
type ClearResidualResult =
  | {
      cleared: true;
      jeId: string;
      residual: number;
      drAccountCode: string;
      crAccountCode: string;
      auto: boolean;
    }
  | {
      cleared: false;
      skipped:
        | "no_residual"
        | "already_cleared"
        | "ineligible_status"
        | "missing_settlement";
      residual?: number;
    };

async function loadSettlementPolicies(companyId: string | null | undefined): Promise<{
  drAccountCode: string;
  crAccountCode: string;
  varianceAutoClearEnabled: boolean;
  varianceMaxAbsAmount: number;
  varianceMaxPct: number;
}> {
  const fallback = {
    drAccountCode: DEFAULT_ACCRUED_LIABILITY_ACCOUNT,
    crAccountCode: DEFAULT_REVENUE_ACCOUNT,
    varianceAutoClearEnabled: false,
    varianceMaxAbsAmount: 0,
    varianceMaxPct: 0,
  };
  if (!companyId) return fallback;
  const [row] = await db.select().from(companySettings).where(eq(companySettings.companyId, companyId));
  const sp: any = row?.settlementPolicies || {};
  return {
    drAccountCode: typeof sp.accrualAccountCode === "string" && sp.accrualAccountCode.trim()
      ? sp.accrualAccountCode.trim()
      : DEFAULT_ACCRUED_LIABILITY_ACCOUNT,
    crAccountCode: typeof sp.revenueAccountCode === "string" && sp.revenueAccountCode.trim()
      ? sp.revenueAccountCode.trim()
      : DEFAULT_REVENUE_ACCOUNT,
    varianceAutoClearEnabled: sp.varianceAutoClearEnabled === true,
    varianceMaxAbsAmount: Number.isFinite(parseFloat(sp.varianceMaxAbsAmount)) ? parseFloat(sp.varianceMaxAbsAmount) : 0,
    varianceMaxPct: Number.isFinite(parseFloat(sp.varianceMaxPct)) ? parseFloat(sp.varianceMaxPct) : 0,
  };
}

/**
 * Post a true-up journal entry that clears the residual sub-materiality
 * variance left over after a partial settlement. Idempotent: if the
 * settlement is already fully cleared (postedAmount within $0.01 of the
 * accrual) it returns `{ cleared:false, skipped:"already_cleared" }` so
 * callers can short-circuit without double-posting.
 *
 * Posting policy:
 *   DR <Accrued Liability>  residual
 *     CR <Revenue>          residual
 * Account codes resolve from company_settings.settlementPolicies (with
 * 2150 / 4000 fallbacks). Auto-clear callers (PATCH /settlements) pass
 * `auto:true` so the audit trail can distinguish them from a manual
 * click on the settlement detail.
 */
async function clearSettlementResidual(opts: {
  settlementId: string;
  userId?: string | null;
  auto: boolean;
}): Promise<ClearResidualResult> {
  const [settlement] = await db.select().from(settlements).where(eq(settlements.id, opts.settlementId));
  if (!settlement) return { cleared: false, skipped: "missing_settlement" };

  // Eligible whenever finance has formally agreed to a settlement number
  // — Accept Customer Claim ("approved"), Partial Settlement ("partial"),
  // and already-posted settlements all leave a residual to release when
  // claim < accrual. Pre-approval statuses (open, review, etc.) are
  // intentionally excluded so we never book a JE before sign-off.
  const eligibleStatuses = new Set(["approved", "partial", "posted"]);
  if (!eligibleStatuses.has(settlement.settlementStatus || "")) {
    return { cleared: false, skipped: "ineligible_status" };
  }

  const accrualAmount = parseFloat(settlement.accrualAmount || "0");
  const claimAmount = parseFloat(settlement.claimAmount || "0");
  const alreadyPosted = parseFloat(settlement.postedAmount || "0");
  // residual = the chunk of the accrual that the customer never claimed.
  // We only release positive residuals here (over-accrual). Under-accrual
  // (claim > accrual) is a separate flow handled by Recovery Claims.
  const residual = +(accrualAmount - claimAmount).toFixed(2);
  if (residual <= 0.01) return { cleared: false, skipped: "no_residual", residual };
  // Idempotency: postedAmount being at-or-above the accrual means a prior
  // run (auto or manual) already booked the true-up. Don't double-post.
  if (alreadyPosted >= accrualAmount - 0.01) {
    return { cleared: false, skipped: "already_cleared", residual };
  }

  const policies = await loadSettlementPolicies(settlement.companyId);
  const amt = residual.toFixed(2);
  const jeIdStr = `RESID-${(settlement.id || "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(journalEntries).values({
    jeId: jeIdStr,
    contractId: settlement.contractId || null,
    contractName: settlement.contractName || null,
    counterparty: settlement.counterparty || null,
    flowType: "settlement_residual",
    period: settlement.period || new Date().toISOString().slice(0, 7),
    totalAmount: amt,
    jeStage: "draft",
    erpSyncStatus: "na",
    balanced: true,
    companyId: settlement.companyId || null,
    createdBy: opts.userId || null,
  } as never);
  const drDescription = `Residual clear (${opts.auto ? "auto" : "manual"}) — settlement ${settlement.id}`;
  await db.insert(journalEntryLines).values([
    { jeId: jeIdStr, accountCode: policies.drAccountCode, accountName: "Accrued Liability (Release)", debitAmount: amt, creditAmount: "0", description: drDescription } as never,
    { jeId: jeIdStr, accountCode: policies.crAccountCode, accountName: "Revenue (Residual Release)", debitAmount: "0", creditAmount: amt, description: drDescription } as never,
  ]);

  // Once the residual JE is booked, the settlement is fully reconciled
  // — the customer's claim + the true-up JE now exactly equal the
  // original accrual. Flip match_status to `fully_matched` (and
  // matchPct to 100) so the settlement disappears from the "Partial"
  // filter on the workspace list. Without this the row would linger
  // in Partial forever even though the books balance.
  await db.update(settlements)
    .set({
      postedAmount: accrualAmount.toFixed(2),
      settlementStatus: "posted",
      matchStatus: "fully_matched",
      matchPct: 100,
      jeId: settlement.jeId || jeIdStr,
      updatedAt: new Date(),
    } as never)
    .where(eq(settlements.id, settlement.id));

  return {
    cleared: true,
    jeId: jeIdStr,
    residual,
    drAccountCode: policies.drAccountCode,
    crAccountCode: policies.crAccountCode,
    auto: opts.auto,
  };
}

// Legacy `settlement_type` values were free-form strings tied to the old
// hardcoded tab list (customer_rebates / supplier_vendor_rebates / etc.).
// New rows are linked to a contract whose flow_type_code (CRP/VRP/RLA/...)
// is the source of truth. For older rows that don't have a contract link,
// we use this mapping so they still get bucketed onto the right tab.
const LEGACY_SETTLEMENT_TYPE_TO_FLOW_CODE: Record<string, string> = {
  customer_rebates: "CRP",
  supplier_vendor_rebates: "VRP",
  trade_promotions: "CRP",
  partner_incentives: "RSM",
  licensee_royalties: "RLA",
};

function buildAccrualCompanyFilter(req: Request) {
  const activeContext = (req as any).user?.activeContext;
  const isSystemAdmin = (req as any).user?.isSystemAdmin === true;
  const userId = (req as any).user?.id;
  const companyId = activeContext?.companyId;

  return companyId
    ? eq(accruals.companyId, companyId)
    : (!isSystemAdmin && userId
      ? eq(accruals.createdBy, userId)
      : undefined);
}

// Slice 2 — period_close stores only a label string. Parse it into a
// half-open [start, end) date range so we can scope downstream
// aggregations. Supported shapes:
//   "Apr 2026" / "April 2026"        → that calendar month
//   "Q1 2026" / "Q1-2026"             → that calendar quarter
//   "2026-04" / "2026/04"             → that calendar month
//   "2026"                            → that calendar year
// Returns null if the label can't be parsed; callers decide on a fallback.
function parsePeriodLabel(label: string): { start: Date; end: Date } | null {
  const s = (label || "").trim();
  if (!s) return null;
  // Q# YYYY
  const q = s.match(/^Q([1-4])[\s-]*(\d{4})$/i);
  if (q) {
    const qn = parseInt(q[1], 10);
    const yr = parseInt(q[2], 10);
    const startMonth = (qn - 1) * 3;
    return { start: new Date(Date.UTC(yr, startMonth, 1)), end: new Date(Date.UTC(yr, startMonth + 3, 1)) };
  }
  // YYYY-MM or YYYY/MM
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ym) {
    const yr = parseInt(ym[1], 10);
    const mo = parseInt(ym[2], 10) - 1;
    return { start: new Date(Date.UTC(yr, mo, 1)), end: new Date(Date.UTC(yr, mo + 1, 1)) };
  }
  // "Apr 2026" / "April 2026"
  const monthName = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthName) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const idx = months.indexOf(monthName[1].slice(0, 3).toLowerCase());
    if (idx >= 0) {
      const yr = parseInt(monthName[2], 10);
      return { start: new Date(Date.UTC(yr, idx, 1)), end: new Date(Date.UTC(yr, idx + 1, 1)) };
    }
  }
  // "YYYY"
  const y = s.match(/^(\d{4})$/);
  if (y) {
    const yr = parseInt(y[1], 10);
    return { start: new Date(Date.UTC(yr, 0, 1)), end: new Date(Date.UTC(yr + 1, 0, 1)) };
  }
  return null;
}

function buildJeCompanyFilter(req: Request) {
  const activeContext = (req as any).user?.activeContext;
  const isSystemAdmin = (req as any).user?.isSystemAdmin === true;
  const userId = (req as any).user?.id;
  const companyId = activeContext?.companyId;

  return companyId
    ? eq(journalEntries.companyId, companyId)
    : (!isSystemAdmin && userId
      ? eq(journalEntries.createdBy, userId)
      : undefined);
}

// Combine the company-scoping filter with an optional `?period=Apr 2026`
// query-string filter. We compare the period column literally against the
// requested label because the row data stores its own canonical label
// string and the period dropdown is populated from `/periods` (so the
// label always round-trips exactly).
function buildJeFullFilter(req: Request) {
  const company = buildJeCompanyFilter(req);
  const periodLabel = typeof req.query.period === "string" ? req.query.period.trim() : "";
  const contractId = typeof req.query.contractId === "string" ? req.query.contractId.trim() : "";
  const conds: any[] = [];
  if (company) conds.push(company);
  if (periodLabel) conds.push(eq(journalEntries.period, periodLabel));
  if (contractId) conds.push(eq(journalEntries.contractId, contractId));
  if (conds.length === 0) return undefined;
  if (conds.length === 1) return conds[0];
  return and(...conds);
}

function buildAccrualFullFilter(req: Request) {
  const company = buildAccrualCompanyFilter(req);
  const periodLabel = typeof req.query.period === "string" ? req.query.period.trim() : "";
  const contractId = typeof req.query.contractId === "string" ? req.query.contractId.trim() : "";
  const conds: any[] = [];
  if (company) conds.push(company);
  if (periodLabel) conds.push(eq(accruals.period, periodLabel));
  if (contractId) conds.push(eq(accruals.contractId, contractId));
  if (conds.length === 0) return undefined;
  if (conds.length === 1) return conds[0];
  return and(...conds);
}

export function registerFinanceRoutes(router: Router) {

  // ==============================
  // ACCRUAL MANAGEMENT ENDPOINTS
  // ==============================

  router.get("/api/accruals", async (req, res) => {
    try {
      const filter = buildAccrualFullFilter(req);
      // Enrich each accrual with the contract's flowTypeCode +
      // flowTypeName so the table can show the proper flow type
      // (CRP / VRP / RLA "Customer Rebate Program") instead of the
      // legacy free-text accruals.flow_type column (which is almost
      // always just "Rebate"). Mirrors the same enrichment used on
      // /api/settlements. Uses left joins so accruals without a
      // resolvable contract / flow type still come through.
      const baseQuery = db
        .select({
          accrual: accruals,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(accruals)
        .leftJoin(contracts, eq(accruals.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .orderBy(desc(accruals.createdAt));
      const joined = filter ? await baseQuery.where(filter) : await baseQuery;
      res.json(joined.map((r: any) => ({
        ...r.accrual,
        flowTypeCode: r.flowTypeCode || null,
        flowTypeName: r.flowTypeName || null,
        // Contract identity — surface the human-readable contract number
        // (CNT-YYYY-NNN) and the curated display name so the UI can stop
        // showing the raw uploaded filename / UUID. Falls back keep older
        // accruals (with no resolvable contract) rendering sensibly.
        contractNumber: r.contractNumber || null,
        contractDisplayName: r.contractDisplayName || r.contractOriginalName || null,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/accruals/insights", async (req, res) => {
    try {
      const filter = buildAccrualFullFilter(req);
      const rows = filter
        ? await db.select().from(accruals).where(filter)
        : await db.select().from(accruals);
      // Honest, status-driven counts. The previous implementation
      // (a) double-counted "posted" rows as "Ready to Post", which
      // hid the fact that *no* drafts were actually awaiting posting,
      // and (b) tested string fields with `!value`, so "0.00" never
      // counted as missing data. Tiles now drive directly off the
      // workflow stages plus a real data-quality check.
      const isPosted = (r: any) => r.status === "posted";
      const isPendingReview = (r: any) =>
        r.status === "review" || r.status === "pending" || r.status === "pending_review";
      const isDraft = (r: any) => r.status === "draft";
      const numericMissing = (v: any) =>
        v === null || v === undefined || v === "" || parseFloat(v) === 0;
      const rateMissing = (v: any) =>
        !v || v === "unknown" || v === "—";
      const hasDataIssue = (r: any) =>
        numericMissing(r.amount) || numericMissing(r.netSales) || rateMissing(r.rate);

      const drafts = rows.filter(isDraft).length;
      const pendingReview = rows.filter(isPendingReview).length;
      const posted = rows.filter(isPosted).length;
      const dataIssues = rows.filter(hasDataIssue).length;

      res.json({
        // New, accurate fields
        drafts,
        pendingReview,
        posted,
        dataIssues,
        total: rows.length,
        // Back-compat aliases so older clients / dashboards that still
        // read the legacy keys keep working until they're migrated.
        // - overAccruals: rebadged as data-quality issues (real signal)
        // - missingData: same as data-quality issues
        // - highRisk: rebadged as pending review (the real "needs eyes" bucket)
        // - readyToPost: now correctly excludes already-posted rows
        overAccruals: dataIssues,
        missingData: dataIssues,
        highRisk: pendingReview,
        readyToPost: pendingReview,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Distinct period labels available for the period selector. Sorted
  // most-recent-first using the parsed start date so "Apr 2026" comes
  // before "Mar 2026" regardless of insert order. Must be declared
  // BEFORE /api/accruals/:id or Express will treat "periods" as an :id.
  router.get("/api/accruals/periods", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const rows = filter
        ? await db.selectDistinct({ period: accruals.period }).from(accruals).where(filter)
        : await db.selectDistinct({ period: accruals.period }).from(accruals);
      const labels = rows.map(r => r.period).filter(Boolean) as string[];
      labels.sort((a, b) => {
        const aP = parsePeriodLabel(a);
        const bP = parsePeriodLabel(b);
        const at = aP ? aP.start.getTime() : 0;
        const bt = bP ? bP.start.getTime() : 0;
        return bt - at;
      });
      res.json({ periods: labels });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/accruals/:id", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const conditions = filter
        ? and(eq(accruals.accrualId, req.params.id), filter)
        : eq(accruals.accrualId, req.params.id);
      // Mirror the enrichment used on the list endpoint so the side
      // detail panel sees flowTypeCode/Name + contractNumber/displayName
      // and stops falling back to the legacy "Rebate" string / raw
      // filename.
      const rows = await db
        .select({
          accrual: accruals,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(accruals)
        .leftJoin(contracts, eq(accruals.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .where(conditions);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const r = rows[0];
      const audit = await db.select().from(accrualAuditTrail).where(eq(accrualAuditTrail.accrualId, req.params.id)).orderBy(desc(accrualAuditTrail.createdAt));
      const trace = await db.select().from(accrualCalculationTrace).where(eq(accrualCalculationTrace.accrualId, req.params.id));
      res.json({
        ...r.accrual,
        flowTypeCode: r.flowTypeCode || null,
        flowTypeName: r.flowTypeName || null,
        contractNumber: r.contractNumber || null,
        contractDisplayName: r.contractDisplayName || r.contractOriginalName || null,
        auditTrail: audit,
        calculationTrace: trace[0] || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/accruals", async (req, res) => {
    try {
      const data = req.body;
      const userName = (req as any).user?.firstName
        ? `${(req as any).user.firstName} ${(req as any).user.lastName || ""}`.trim()
        : (req as any).user?.email || "System";

      // Task 68 — the create path can also land an accrual directly at
      // 'posted' (auto-accrual batch postings, scripted seeding, certain
      // pipeline finalizers). Mirror the PATCH wiring: insert first, then
      // route through postAndPromoteAccrual so the obligation is born
      // transactionally with the post and OEM rolls back. The insert is
      // outside the txn intentionally — the row needs to exist before
      // postAndPromoteAccrual can flip it.
      const wantsPosted = data?.status === "posted";
      const insertData = wantsPosted ? { ...data, status: "approved" } : data;
      const [row] = await db.insert(accruals).values(insertData as never).returning();

      if (!wantsPosted) {
        return res.json(row);
      }

      const { postAndPromoteAccrual } = await import("./services/accrualPromotionService.js");
      try {
        const { accrual: posted, promotion } = await postAndPromoteAccrual(row.accrualId, {
          userId: (req as any).user?.id || null,
          userName,
          phase: "auto_post",
        });
        await db.insert(accrualAuditTrail).values({
          accrualId: row.accrualId,
          eventType: "status_change",
          description: `Auto-posted on create (obligation ${promotion.obligationId}).`,
          userName,
        } as never);
        return res.json(posted);
      } catch (promoteErr) {
        const errMsg = promoteErr instanceof Error ? promoteErr.message : String(promoteErr);
        const errName = promoteErr instanceof Error ? promoteErr.name : "";
        const isOem = errName === "OemDirectionRequiredError";
        // Promotion failed — `postAndPromoteAccrual` already rolled the
        // status flip back inside its txn, so the accrual is sitting at
        // the staged 'approved' status. We deliberately KEEP the row
        // (operators don't lose the calculated accrual data) and only
        // audit the failure so finance can resolve the cause and re-run
        // the post.
        await db.insert(accrualAuditTrail).values({
          accrualId: row.accrualId,
          eventType: "obligation_promotion_failed",
          description: `Auto-post blocked — promotion failed: ${errMsg}. Accrual retained at 'approved'.`,
          userName,
        } as never);
        if (isOem) {
          return res.status(422).json({ error: errMsg, code: "OEM_DIRECTION_REQUIRED" });
        }
        throw promoteErr;
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/api/accruals/:id", async (req, res) => {
    try {
      const data = req.body;

      const userName = (req as any).user?.firstName
        ? `${(req as any).user.firstName} ${(req as any).user.lastName || ""}`.trim()
        : "System";

      // Task 68 — the only paths that flip an accrual to `posted` MUST go
      // through postAndPromoteAccrual so the status update + JE flip +
      // obligation creation happen atomically. An OEM throw rolls the
      // whole thing back, so a 422 never leaves the accrual posted with
      // no obligation backing it. Other status transitions (approve,
      // reject, draft, partial edits) keep the legacy single-row update.
      if (data.status === "posted") {
        const { postAndPromoteAccrual } = await import("./services/accrualPromotionService.js");
        try {
          const { accrual: row, promotion } = await postAndPromoteAccrual(req.params.id, {
            userId: (req as any).user?.id || null,
            userName,
            phase: "manual_post",
          });
          // Apply any incidental field edits the caller sent alongside
          // status=posted (e.g. a finance user re-tagging the period).
          // Status itself was already flipped inside the txn — strip it
          // from the patch body so we don't no-op overwrite.
          const { status: _ignored, ...rest } = data || {};
          // NOTE: drizzle-orm 0.39 + drizzle-zod 0.7 produces a
          // truncated inferred type on `.values()` / `.set()` — the
          // shape drops nullable columns. Cast at the call boundary
          // only; literals are otherwise fully typed.
          let finalRow = row;
          if (Object.keys(rest).length > 0) {
            const [reupdated] = await db.update(accruals)
              .set({ ...rest, updatedAt: new Date() } as never)
              .where(eq(accruals.accrualId, req.params.id))
              .returning();
            finalRow = reupdated || row;
          }
          await db.insert(accrualAuditTrail).values({
            accrualId: req.params.id,
            eventType: "status_change",
            description: `Status updated to posted (obligation ${promotion.obligationId}).`,
            userName,
          } as never);
          return res.json(finalRow);
        } catch (promoteErr) {
          const errMsg = promoteErr instanceof Error ? promoteErr.message : String(promoteErr);
          const errName = promoteErr instanceof Error ? promoteErr.name : "";
          const isOem = errName === "OemDirectionRequiredError";
          // Audit OUTSIDE the rolled-back txn so the failure trail
          // survives. Accrual is back at its prior status.
          await db.insert(accrualAuditTrail).values({
            accrualId: req.params.id,
            eventType: "obligation_promotion_failed",
            description: `Post blocked — promotion failed: ${errMsg}`,
            userName,
          } as never);
          if (isOem) {
            return res.status(422).json({
              error: errMsg,
              code: "OEM_DIRECTION_REQUIRED",
            });
          }
          throw promoteErr;
        }
      }

      // Adjustment path — UI sends `_adjustmentReason` alongside an
      // `amount` change so we can capture a finance-grade audit entry
      // (old → new, who, why) without bolting a new endpoint on. The
      // underscore-prefixed key is stripped before the DB update so it
      // never tries to land on a real column.
      const adjustmentReason: string | undefined = data?._adjustmentReason;
      delete data._adjustmentReason;

      // For an amount-only adjustment, refuse to overwrite a posted
      // accrual silently — those are tied to a JE + obligation and
      // need a reversal, not an in-place edit. Mirrors the delete rule.
      let oldAmount: string | null = null;
      if (adjustmentReason !== undefined && data.amount !== undefined) {
        const existing = await db.select().from(accruals).where(eq(accruals.accrualId, req.params.id));
        if (!existing.length) return res.status(404).json({ error: "Not found" });
        if (existing[0].status === "posted") {
          return res.status(409).json({
            error: "Cannot adjust a posted accrual",
            reason: "This accrual is already in the GL via a journal entry and an obligation. Reverse the posting before adjusting the amount.",
          });
        }
        oldAmount = existing[0].amount as string | null;
      }

      const [row] = await db.update(accruals)
        .set({ ...data, updatedAt: new Date() } as never)
        .where(eq(accruals.accrualId, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Not found" });

      // Choose the audit description based on what actually changed.
      let eventType = "status_change";
      let description = `Status updated to ${data.status || "modified"}`;
      if (adjustmentReason !== undefined && data.amount !== undefined) {
        eventType = "amount_adjusted";
        const fmt = (v: string | null) => `$${parseFloat(v || "0").toLocaleString()}`;
        description = `Amount adjusted ${fmt(oldAmount)} → ${fmt(data.amount)}. Reason: ${adjustmentReason}`;
      }

      await db.insert(accrualAuditTrail).values({
        accrualId: req.params.id,
        eventType,
        description,
        userName,
      } as never);

      if (data.status === "approved") {
        const linkedJEs = await db.select().from(journalEntries)
          .where(eq(journalEntries.sourceAccrualId, req.params.id));
        for (const je of linkedJEs) {
          if (je.jeStage === "draft") {
            await db.update(journalEntries)
              .set({ jeStage: "pending", updatedAt: new Date() } as never)
              .where(eq(journalEntries.id, je.id));
          }
        }
      }

      if (data.status === "draft" || data.status === "rejected") {
        const linkedJEs = await db.select().from(journalEntries)
          .where(eq(journalEntries.sourceAccrualId, req.params.id));
        for (const je of linkedJEs) {
          if (je.jeStage === "pending" || je.jeStage === "approved") {
            await db.update(journalEntries)
              .set({ jeStage: "draft", updatedAt: new Date() } as never)
              .where(eq(journalEntries.id, je.id));
          }
        }
      }

      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hard-delete an accrual. Only safe for non-posted rows. Posted
  // accruals have already produced journal_entries (source_accrual_id)
  // and obligations (source_accrual_id) downstream, plus may be tied
  // to settlements — deleting them silently breaks the audit chain.
  // The proper unwind for a posted accrual is a contra-JE / reversal
  // workflow, not a delete. We therefore reject 409 here and force
  // the user through that path.
  router.delete("/api/accruals/:id", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const conditions = filter
        ? and(eq(accruals.accrualId, req.params.id), filter)
        : eq(accruals.accrualId, req.params.id);
      const row = await db.select().from(accruals).where(conditions);
      if (!row.length) return res.status(404).json({ error: "Not found" });
      if (row[0].status === "posted") {
        return res.status(409).json({
          error: "Cannot delete a posted accrual",
          reason: "This accrual has already produced a journal entry and a downstream obligation. Reverse the posting (contra-JE) instead of deleting it.",
          status: row[0].status,
        });
      }
      await db.delete(accrualCalculationTrace).where(eq(accrualCalculationTrace.accrualId, req.params.id));
      await db.delete(accrualAuditTrail).where(eq(accrualAuditTrail.accrualId, req.params.id));
      await db.delete(accruals).where(eq(accruals.accrualId, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk delete. Same rule: skip posted rows and report what was
  // skipped so the UI can surface it instead of silently dropping
  // rows that are still safe to remove.
  router.delete("/api/accruals", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const rows = filter
        ? await db.select().from(accruals).where(filter)
        : await db.select().from(accruals);
      const deletable = rows.filter(r => r.status !== "posted");
      const skipped = rows.length - deletable.length;
      for (const row of deletable) {
        await db.delete(accrualCalculationTrace).where(eq(accrualCalculationTrace.accrualId, row.accrualId));
        await db.delete(accrualAuditTrail).where(eq(accrualAuditTrail.accrualId, row.accrualId));
        await db.delete(accruals).where(eq(accruals.accrualId, row.accrualId));
      }
      res.json({
        success: true,
        deleted: deletable.length,
        skippedPosted: skipped,
        message: skipped > 0
          ? `Deleted ${deletable.length} accrual(s). Skipped ${skipped} posted accrual(s) — reverse them instead.`
          : `Deleted ${deletable.length} accrual(s).`,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/accruals/run-calculation", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const draftFilter = filter
        ? and(eq(accruals.status, "draft"), filter)
        : eq(accruals.status, "draft");
      const rows = await db.select().from(accruals).where(draftFilter);
      for (const row of rows) {
        await db.update(accruals).set({ status: "review", updatedAt: new Date() }).where(eq(accruals.id, row.id));
        await db.insert(accrualAuditTrail).values({
          accrualId: row.accrualId,
          eventType: "calculation",
          description: `Calculation run completed. Amount: $${row.amount}`,
          userName: "System · Calc Engine",
        });
      }
      res.json({ processed: rows.length, message: `${rows.length} accruals calculated` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Accepts ?period=Apr%202026 (filter) and ?format=xlsx (Excel) | csv.
  // The Excel branch dynamically loads the `xlsx` package the same way
  // the rest of the codebase does and returns a real .xlsx workbook with
  // the enriched contract / flow-type columns the table now shows.
  router.post("/api/accruals/export", async (req, res) => {
    try {
      const filter = buildAccrualFullFilter(req);
      const baseQuery = db
        .select({
          accrual: accruals,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(accruals)
        .leftJoin(contracts, eq(accruals.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .orderBy(desc(accruals.createdAt));
      const joined = filter ? await baseQuery.where(filter) : await baseQuery;
      const records = joined.map((r: any) => ({
        "Accrual ID": r.accrual.accrualId,
        "Contract #": r.contractNumber || "",
        "Contract": r.contractDisplayName || r.contractOriginalName || r.accrual.contractName || "",
        "Party": r.accrual.counterparty || "",
        "Flow Type Code": r.flowTypeCode || "",
        "Flow Type": r.flowTypeName || r.accrual.flowType || "",
        "Period": r.accrual.period,
        "Amount": parseFloat(r.accrual.amount || "0"),
        "Status": r.accrual.status,
        "Confidence": r.accrual.aiConfidence ?? "",
        "Tier": r.accrual.tier || "",
        "Rate": r.accrual.rate || "",
      }));

      const wantXlsx = (req.query.format || req.body?.format) === "xlsx";
      if (wantXlsx) {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Accruals");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=accruals-export.xlsx");
        return res.send(buf);
      }
      const headers = Object.keys(records[0] || {
        "Accrual ID": "", "Contract #": "", "Contract": "", "Party": "",
        "Flow Type Code": "", "Flow Type": "", "Period": "", "Amount": "",
        "Status": "", "Confidence": "", "Tier": "", "Rate": "",
      });
      const csv = [
        headers.join(","),
        ...records.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(",")),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=accruals-export.csv");
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Distinct period labels available for the period selector. Sorted
  // most-recent-first using the parsed start date so "Apr 2026" comes
  // before "Mar 2026" regardless of insert order.
  // ==============================
  // JOURNAL ENTRY HUB ENDPOINTS
  // ==============================

  router.get("/api/journal-entries", async (req, res) => {
    try {
      const filter = buildJeFullFilter(req);
      // Mirror the accrual list enrichment: join contracts + flow_types
      // so the table can show a real flow-type chip (CRP — Customer
      // Rebate Program) and the contract's curated display name +
      // CNT-YYYY-NNN number instead of the raw uploaded filename that
      // gets stamped into journal_entries.contract_name.
      const baseQuery = db
        .select({
          je: journalEntries,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(journalEntries)
        .leftJoin(contracts, eq(journalEntries.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .orderBy(desc(journalEntries.createdAt));
      const joined = filter ? await baseQuery.where(filter) : await baseQuery;
      res.json(joined.map((r: any) => ({
        ...r.je,
        flowTypeCode: r.flowTypeCode || null,
        flowTypeName: r.flowTypeName || null,
        contractNumber: r.contractNumber || null,
        contractDisplayName: r.contractDisplayName || r.contractOriginalName || null,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/journal-entries/summary", async (req, res) => {
    try {
      const filter = buildJeFullFilter(req);
      const rows = filter
        ? await db.select().from(journalEntries).where(filter)
        : await db.select().from(journalEntries);
      const total = rows.length;
      const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.totalAmount || "0"), 0);
      const byStage: Record<string, number> = {};
      rows.forEach(r => { byStage[r.jeStage || "draft"] = (byStage[r.jeStage || "draft"] || 0) + 1; });
      const balanced = rows.filter(r => r.balanced).length;
      const unbalanced = total - balanced;
      // Total amount for *posted* entries — the UI tile previously
      // computed this from the visible page filter, so it dropped to
      // $0.00M whenever the user filtered to a non-Posted stage. Now it
      // comes back honest from the server.
      const totalPosted = rows
        .filter(r => r.jeStage === "posted")
        .reduce((s, r) => s + parseFloat(r.totalAmount || "0"), 0);
      res.json({ total, totalAmount, byStage, balanced, unbalanced, totalPosted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/journal-entries/insights", async (req, res) => {
    try {
      const filter = buildJeFullFilter(req);
      const rows = filter
        ? await db.select().from(journalEntries).where(filter)
        : await db.select().from(journalEntries);
      const unbalanced = rows.filter(r => !r.balanced).length;
      const failedSync = rows.filter(r => r.erpSyncStatus === "failed").length;
      const pendingApproval = rows.filter(r => r.jeStage === "pending").length;
      const readyToPost = rows.filter(r => r.jeStage === "approved").length;
      const posted = rows.filter(r => r.jeStage === "posted").length;
      // Real data-quality signal — JE rows that are missing an amount
      // or were never marked balanced. Mirrors the dataIssues tile on
      // Accrual Management.
      const dataIssues = rows.filter(r =>
        !r.totalAmount || parseFloat(r.totalAmount || "0") === 0 || !r.balanced
      ).length;
      const totalPosted = rows
        .filter(r => r.jeStage === "posted")
        .reduce((s, r) => s + parseFloat(r.totalAmount || "0"), 0);
      res.json({ unbalanced, failedSync, pendingApproval, readyToPost, posted, dataIssues, totalPosted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/journal-entries/periods", async (req, res) => {
    try {
      const filter = buildJeCompanyFilter(req);
      const rows = filter
        ? await db.selectDistinct({ period: journalEntries.period }).from(journalEntries).where(filter)
        : await db.selectDistinct({ period: journalEntries.period }).from(journalEntries);
      const labels = rows.map(r => r.period).filter(Boolean) as string[];
      labels.sort((a, b) => {
        const aP = parsePeriodLabel(a);
        const bP = parsePeriodLabel(b);
        const at = aP ? aP.start.getTime() : 0;
        const bt = bP ? bP.start.getTime() : 0;
        return bt - at;
      });
      res.json({ periods: labels });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/journal-entries/:id", async (req, res) => {
    try {
      // Same enrichment as the list endpoint plus a back-pointer to
      // the source accrual so the side panel can render a real
      // drill-down link (View Source Accrual / View Calculation Report).
      const joined = await db
        .select({
          je: journalEntries,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(journalEntries)
        .leftJoin(contracts, eq(journalEntries.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .where(eq(journalEntries.jeId, req.params.id));
      if (!joined.length) return res.status(404).json({ error: "Not found" });
      const r = joined[0];
      const lines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.jeId, req.params.id));
      const syncLogs = await db.select().from(jeErpSyncLog).where(eq(jeErpSyncLog.jeId, req.params.id)).orderBy(desc(jeErpSyncLog.syncedAt));
      const recon = await db.select().from(jeReconciliation).where(eq(jeReconciliation.jeId, req.params.id));

      // Verify the sourceAccrualId actually resolves before we surface
      // a "View Source Accrual" link (otherwise we'd send the user to
      // a 404 / empty detail panel for orphaned references).
      let sourceAccrualExists = false;
      if (r.je.sourceAccrualId) {
        const src = await db.select({ id: accruals.id })
          .from(accruals)
          .where(eq(accruals.accrualId, r.je.sourceAccrualId));
        sourceAccrualExists = src.length > 0;
      }

      res.json({
        ...r.je,
        flowTypeCode: r.flowTypeCode || null,
        flowTypeName: r.flowTypeName || null,
        contractNumber: r.contractNumber || null,
        contractDisplayName: r.contractDisplayName || r.contractOriginalName || null,
        sourceAccrualExists,
        lines,
        syncLogs,
        reconciliation: recon[0] || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/journal-entries", async (req, res) => {
    try {
      const data = req.body;
      const [row] = await db.insert(journalEntries).values(data).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/api/journal-entries/:id/stage", async (req, res) => {
    try {
      const { stage } = req.body;
      const [row] = await db.update(journalEntries)
        .set({ jeStage: stage, updatedAt: new Date() })
        .where(eq(journalEntries.jeId, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/journal-entries/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      let updated = 0;
      for (const jeId of ids) {
        const result = await db.update(journalEntries)
          .set({ jeStage: "approved", updatedAt: new Date() })
          .where(and(eq(journalEntries.jeId, jeId), eq(journalEntries.jeStage, "pending")))
          .returning();
        if (result.length) updated++;
      }
      res.json({ updated, message: `${updated} entries approved` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/journal-entries/:id/erp-sync", async (req, res) => {
    try {
      const jeId = req.params.id;
      const syncStatus = "synced";
      await db.update(journalEntries)
        .set({ erpSyncStatus: syncStatus, updatedAt: new Date() })
        .where(eq(journalEntries.jeId, jeId));
      await db.insert(jeErpSyncLog).values({
        jeId,
        syncStatus,
        erpSystem: "SAP",
        errorMessage: syncStatus === "failed" ? "Account mapping error" : null,
      });
      res.json({ jeId, syncStatus });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/journal-entries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(journalEntries).where(eq(journalEntries.jeId, id));
      if (!existing.length) return res.status(404).json({ error: "Not found" });
      // Posted-protection — once a journal entry has been posted to
      // the GL it's part of the audit record and must not be silently
      // deletable from the UI. Mirrors the same 409 we already return
      // on accruals and on settlements with downstream documents.
      if (existing[0].jeStage === "posted") {
        return res.status(409).json({
          error: "Cannot delete posted journal entry",
          reason: `JE ${id} has already been posted to the GL. Reverse it instead of deleting.`,
        });
      }
      await db.delete(journalEntryLines).where(eq(journalEntryLines.jeId, id));
      await db.delete(jeErpSyncLog).where(eq(jeErpSyncLog.jeId, id));
      await db.delete(jeReconciliation).where(eq(jeReconciliation.jeId, id));
      await db.delete(journalEntries).where(eq(journalEntries.jeId, id));
      res.json({ deleted: true, jeId: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Accepts ?period=Apr%202026 + ?format=xlsx|csv. The Excel branch
  // emits a real .xlsx workbook with the joined contract / flow type
  // columns the table now shows.
  router.post("/api/journal-entries/export", async (req, res) => {
    try {
      const filter = buildJeFullFilter(req);
      const baseQuery = db
        .select({
          je: journalEntries,
          flowTypeCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
          contractNumber: contracts.contractNumber,
          contractDisplayName: contracts.displayName,
          contractOriginalName: contracts.originalName,
        })
        .from(journalEntries)
        .leftJoin(contracts, eq(journalEntries.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .orderBy(desc(journalEntries.createdAt));
      const joined = filter ? await baseQuery.where(filter) : await baseQuery;
      const records = joined.map((r: any) => ({
        "JE ID": r.je.jeId,
        "Source Accrual": r.je.sourceAccrualId || "",
        "Contract #": r.contractNumber || "",
        "Contract": r.contractDisplayName || r.contractOriginalName || r.je.contractName || "",
        "Party": r.je.counterparty || "",
        "Flow Type Code": r.flowTypeCode || "",
        "Flow Type": r.flowTypeName || r.je.flowType || "",
        "Period": r.je.period,
        "Total Amount": parseFloat(r.je.totalAmount || "0"),
        "Stage": r.je.jeStage,
        "ERP Status": r.je.erpSyncStatus,
        "Balanced": r.je.balanced ? "Yes" : "No",
      }));

      const wantXlsx = (req.query.format || req.body?.format) === "xlsx";
      if (wantXlsx) {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Journal Entries");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=journal-entries-export.xlsx");
        return res.send(buf);
      }
      const headers = Object.keys(records[0] || {
        "JE ID": "", "Source Accrual": "", "Contract #": "", "Contract": "",
        "Party": "", "Flow Type Code": "", "Flow Type": "", "Period": "",
        "Total Amount": "", "Stage": "", "ERP Status": "", "Balanced": "",
      });
      const csv = [
        headers.join(","),
        ...records.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(",")),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=journal-entries-export.csv");
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==============================
  // PERIOD CLOSE WORKSPACE ENDPOINTS
  // ==============================

  router.get("/api/period-close", async (_req, res) => {
    try {
      const rows = await db.select().from(periodClose).orderBy(desc(periodClose.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/latest", async (_req, res) => {
    try {
      const rows = await db.select().from(periodClose).orderBy(desc(periodClose.createdAt)).limit(1);
      if (!rows.length) return res.json(null);
      const period = rows[0];
      const checklist = await db.select().from(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, period.id));
      const blockers = await db.select().from(periodCloseBlockers).where(eq(periodCloseBlockers.periodId, period.id));
      const audit = await db.select().from(periodCloseAuditTrail).where(eq(periodCloseAuditTrail.periodId, period.id)).orderBy(desc(periodCloseAuditTrail.createdAt));
      const variances = await db.select().from(periodVariance).where(eq(periodVariance.periodId, period.id));
      const contracts = await db.select().from(contractCloseStatus).where(eq(contractCloseStatus.periodId, period.id));
      res.json({ ...period, checklist, blockers, auditTrail: audit, variances, contracts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/:id", async (req, res) => {
    try {
      const rows = await db.select().from(periodClose).where(eq(periodClose.id, req.params.id));
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const period = rows[0];
      const checklist = await db.select().from(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, period.id));
      const blockers = await db.select().from(periodCloseBlockers).where(eq(periodCloseBlockers.periodId, period.id));
      const audit = await db.select().from(periodCloseAuditTrail).where(eq(periodCloseAuditTrail.periodId, period.id)).orderBy(desc(periodCloseAuditTrail.createdAt));
      const variances = await db.select().from(periodVariance).where(eq(periodVariance.periodId, period.id));
      const contracts = await db.select().from(contractCloseStatus).where(eq(contractCloseStatus.periodId, period.id));
      res.json({ ...period, checklist, blockers, auditTrail: audit, variances, contracts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/period-close/:id", async (req, res) => {
    try {
      const periodId = req.params.id;
      await db.delete(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, periodId));
      await db.delete(periodCloseAuditTrail).where(eq(periodCloseAuditTrail.periodId, periodId));
      await db.delete(periodCloseBlockers).where(eq(periodCloseBlockers.periodId, periodId));
      await db.delete(periodVariance).where(eq(periodVariance.periodId, periodId));
      await db.delete(contractCloseStatus).where(eq(contractCloseStatus.periodId, periodId));
      await db.delete(periodClose).where(eq(periodClose.id, periodId));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/period-close", async (req, res) => {
    try {
      const [row] = await db.insert(periodClose).values(req.body).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/api/period-close/:id/checklist/:itemId", async (req, res) => {
    try {
      const { status, progressText } = req.body;
      const updates: any = { status };
      if (progressText) updates.progressText = progressText;
      if (status === "done") updates.completedAt = new Date();
      const [row] = await db.update(periodCloseChecklist)
        .set(updates)
        .where(eq(periodCloseChecklist.id, req.params.itemId))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/period-close/:id/blockers", async (req, res) => {
    try {
      const [row] = await db.insert(periodCloseBlockers).values({ ...req.body, periodId: req.params.id }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/api/period-close/blockers/:blockerId/resolve", async (req, res) => {
    try {
      const [row] = await db.update(periodCloseBlockers)
        .set({ resolved: true })
        .where(eq(periodCloseBlockers.id, req.params.blockerId))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/:id/variances", async (req, res) => {
    try {
      const rows = await db.select().from(periodVariance).where(eq(periodVariance.periodId, req.params.id));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Slice 2 — phase breakdown for period-close dashboards. Aggregates
  // calculation_rule_results.phase across all calculations whose period
  // overlaps the period_close window. Returns per-phase totals so the
  // dashboard can show gross_calc → returns_offset → net_adjustment →
  // floor_minimum → cap_maximum → penalty waterfall and a draft-JE
  // grouping by phase. Pure aggregate; respects Verify-then-Pay because
  // unapproved rules never produce a row in the first place.
  router.get("/api/period-close/:id/phase-summary", async (req, res) => {
    try {
      const [period] = await db.select().from(periodClose).where(eq(periodClose.id, req.params.id));
      if (!period) return res.status(404).json({ error: "Period not found" });
      // periodClose stores only a label (e.g. "Apr 2026", "Q1 2026", "2026-04",
      // "2026"); derive the [start, end) bounds from it. Fall back to a wide
      // window only when the label is unparseable so the dashboard still
      // shows something rather than empty.
      const bounds = parsePeriodLabel(period.periodLabel || "");
      const start = bounds?.start ?? new Date("1970-01-01");
      const end = bounds?.end ?? new Date("2999-12-31");

      // Multi-tenant authorization — non-admins MUST belong to the period's
      // owning company. We do not fall back to the caller's active context
      // when the period is owned by another tenant (that would leak data),
      // and we do not allow access to legacy unowned periods for non-admins
      // (cannot prove tenancy). System admins keep full visibility.
      const isSystemAdmin = (req as any).user?.isSystemAdmin === true;
      const ctxCompanyId = (req as any).user?.activeContext?.companyId ?? null;
      if (!isSystemAdmin) {
        if (!period.companyId || !ctxCompanyId || period.companyId !== ctxCompanyId) {
          return res.status(403).json({ error: "Not authorized for this period." });
        }
      }
      const scopeCompanyId = period.companyId ?? null;

      const rows = await db.execute(sql`
        SELECT
          COALESCE(crr.phase, 'gross_calc') AS phase,
          COUNT(*)::int AS row_count,
          COALESCE(SUM(crr.total_fee::numeric), 0)::text AS total_fee,
          COALESCE(SUM(crr.transaction_count), 0)::int AS transaction_count,
          COUNT(DISTINCT crr.rule_id)::int AS rule_count
        FROM calculation_rule_results crr
        JOIN contract_calculations cc ON cc.id = crr.calculation_id
        WHERE (cc.period_end IS NULL OR cc.period_end > ${start})
          AND (cc.period_start IS NULL OR cc.period_start < ${end})
          AND (${scopeCompanyId}::text IS NULL OR cc.company_id = ${scopeCompanyId})
          -- Exclude failed / rejected calculations so phase totals don't
          -- include rolled-back or never-finalized payable. Mirrors the
          -- windowed prior-total semantics used by floor / cap evaluators.
          AND COALESCE(cc.status, 'completed') NOT IN ('failed','rejected')
        GROUP BY COALESCE(crr.phase, 'gross_calc')
      `);
      // Stable phase ordering matches the calc waterfall the engine runs in.
      const order = ['gross_calc','returns_offset','net_adjustment','floor_minimum','cap_maximum','obligation_accrual','penalty'];
      const summary = (rows.rows as any[])
        .map(r => ({
          phase: r.phase,
          rowCount: Number(r.row_count),
          ruleCount: Number(r.rule_count),
          transactionCount: Number(r.transaction_count),
          totalFee: parseFloat(r.total_fee || '0'),
        }))
        .sort((a, b) => (order.indexOf(a.phase) - order.indexOf(b.phase)));
      const netPayable = summary.reduce((s, r) => s + r.totalFee, 0);
      res.json({ periodId: req.params.id, summary, netPayable });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/:id/audit-trail", async (req, res) => {
    try {
      const rows = await db.select().from(periodCloseAuditTrail)
        .where(eq(periodCloseAuditTrail.periodId, req.params.id))
        .orderBy(desc(periodCloseAuditTrail.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/:id/contracts", async (req, res) => {
    try {
      const rows = await db.select().from(contractCloseStatus).where(eq(contractCloseStatus.periodId, req.params.id));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Phase 1d — hardened with the critical-blocker guard from spec §5.3.
  // A period cannot be locked while any blocker with severity='critical'
  // remains unresolved; we return 409 with a structured error code so the
  // UI can render a "resolve these first" modal listing the blocker IDs.
  // On approve we also stamp the lockedBy/lockedAt columns added in
  // Phase 1a so the sign-off chain (prepared → reviewed → locked) has a
  // canonical owner per stage.
  router.post("/api/period-close/:id/approve", async (req, res) => {
    try {
      const periodId = req.params.id;
      const userId = (req as any).user?.id ?? null;
      const userName = (req as any).user?.username
        ?? (req as any).user?.fullName
        ?? req.body.closedBy
        ?? "System";

      // Guard: critical unresolved blockers block lock. Use the
      // (period_id, resolved) composite index added in Phase 1b.
      const criticalBlockers = await db
        .select({
          id: periodCloseBlockers.id,
          title: periodCloseBlockers.title,
          severity: periodCloseBlockers.severity,
        })
        .from(periodCloseBlockers)
        .where(and(
          eq(periodCloseBlockers.periodId, periodId),
          eq(periodCloseBlockers.resolved, false),
          eq(periodCloseBlockers.severity, "critical"),
        ));

      if (criticalBlockers.length > 0) {
        return res.status(409).json({
          error: "CRITICAL_BLOCKERS_PRESENT",
          message: `Cannot lock period — ${criticalBlockers.length} critical blocker(s) unresolved.`,
          blockers: criticalBlockers,
        });
      }

      const now = new Date();
      const [row] = await db.update(periodClose)
        .set({
          status: "approved",
          closeDate: now,
          closedBy: userName,
          lockedBy: userId,
          lockedAt: now,
          updatedAt: now,
        } as any)
        .where(eq(periodClose.id, periodId))
        .returning();
      await db.insert(periodCloseAuditTrail).values({
        periodId,
        eventType: "approval",
        description: "Period Close Approved & Locked",
        userName,
        userId,
        actorType: "user",
        iconColor: "green",
      });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Phase 1d — sign-off chain. The Worksheet's right-rail shows a
  // prepared → reviewed → locked progression; these two endpoints stamp
  // the first two stages. `approve` above is the third stage.
  // Both are idempotent (re-stamping the same user is a no-op semantically).
  router.post("/api/period-close/:id/mark-prepared", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      const userName = (req as any).user?.username
        ?? (req as any).user?.fullName
        ?? req.body.userName
        ?? "System";
      const now = new Date();
      const [row] = await db.update(periodClose)
        .set({ preparedBy: userId, preparedAt: now, updatedAt: now })
        .where(eq(periodClose.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Period not found" });
      await db.insert(periodCloseAuditTrail).values({
        periodId: req.params.id,
        eventType: "prepared",
        description: "Period marked Prepared",
        userName,
        userId,
        actorType: "user",
        iconColor: "blue",
      });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/period-close/:id/mark-reviewed", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      const userName = (req as any).user?.username
        ?? (req as any).user?.fullName
        ?? req.body.userName
        ?? "System";
      const now = new Date();
      const [row] = await db.update(periodClose)
        .set({ reviewedBy: userId, reviewedAt: now, updatedAt: now })
        .where(eq(periodClose.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Period not found" });
      await db.insert(periodCloseAuditTrail).values({
        periodId: req.params.id,
        eventType: "reviewed",
        description: "Period marked Reviewed",
        userName,
        userId,
        actorType: "user",
        iconColor: "purple",
      });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/period-close/:id/flow-summary", async (req, res) => {
    try {
      const filter = buildAccrualCompanyFilter(req);
      const rows = filter
        ? await db.select().from(accruals).where(filter)
        : await db.select().from(accruals);
      const byFlow: Record<string, { amount: number; count: number }> = {};
      rows.forEach(r => {
        const flow = r.flowType || "Other";
        if (!byFlow[flow]) byFlow[flow] = { amount: 0, count: 0 };
        byFlow[flow].amount += parseFloat(r.amount || "0");
        byFlow[flow].count++;
      });
      const summary = Object.entries(byFlow).map(([type, data]) => ({ type, amount: data.amount, contracts: data.count }));
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==============================
  // PERIOD CLOSE WORKSPACE — Phase 1b
  // Composite obligations grid + 3-tile insights strip.
  // Spec: docs/period-close-data-model.md §4 + §5.1
  // ==============================

  // GET /api/period-close/:id/obligations
  // The single composite query that powers the Worksheet grid.
  // One row per obligation projected with stage statuses from the five
  // downstream subledger tables (accruals, JE, settlements, claims,
  // documents) and computed flags for blockers / pending decisions.
  router.get("/api/period-close/:id/obligations", async (req, res) => {
    try {
      // Resolve the period record so we know which periodLabel string and
      // which company the grid is scoped to. The frontend only knows the
      // periodClose.id from the URL.
      const [periodRow] = await db.select().from(periodClose).where(eq(periodClose.id, req.params.id));
      if (!periodRow) {
        return res.status(404).json({ error: "Period not found" });
      }
      const periodLabel = periodRow.periodLabel;
      const companyId = periodRow.companyId
        ?? (req as any).user?.activeContext?.companyId
        ?? null;

      // Filters from query string. Multi-value params are CSV.
      const flowParam = typeof req.query.flow === "string" ? req.query.flow.trim() : "";
      const statusParam = typeof req.query.status === "string"
        ? req.query.status.split(",").map(s => s.trim()).filter(Boolean) : [];
      const partnerParam = typeof req.query.partner === "string"
        ? req.query.partner.split(",").map(s => s.trim()).filter(Boolean) : [];
      const hasBlocker = req.query.hasBlocker === "true";
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const sortBy = typeof req.query.sort === "string" ? req.query.sort : "amount_desc";
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "50", 10) || 50, 1), 200);
      const cursor = Math.max(parseInt((req.query.cursor as string) || "0", 10) || 0, 0);

      // Parameterized whitelist for ORDER BY — never interpolate raw user
      // input into SQL identifiers.
      const orderClause = (() => {
        switch (sortBy) {
          case "amount_asc":   return sql`o.amount ASC`;
          case "partner_asc":  return sql`o.partner_name ASC NULLS LAST`;
          case "partner_desc": return sql`o.partner_name DESC NULLS LAST`;
          case "status_asc":   return sql`o.status ASC`;
          case "due_asc":      return sql`o.due_at ASC NULLS LAST`;
          case "due_desc":     return sql`o.due_at DESC NULLS LAST`;
          case "amount_desc":
          default:             return sql`o.amount DESC`;
        }
      })();

      const whereParts: any[] = [sql`o.funding_period = ${periodLabel}`];
      if (companyId) whereParts.push(sql`o.company_id = ${companyId}`);
      if (flowParam) whereParts.push(sql`c.flow_type_code = ${flowParam}`);
      if (statusParam.length > 0) {
        whereParts.push(sql`o.status IN (${sql.join(statusParam.map(v => sql`${v}`), sql`, `)})`);
      }
      if (partnerParam.length > 0) {
        whereParts.push(sql`o.partner_name IN (${sql.join(partnerParam.map(v => sql`${v}`), sql`, `)})`);
      }
      if (search) {
        const like = `%${search}%`;
        whereParts.push(sql`(
          o.partner_name ILIKE ${like}
          OR c.display_name ILIKE ${like}
          OR o.id ILIKE ${like}
        )`);
      }
      if (hasBlocker) {
        whereParts.push(sql`EXISTS (
          SELECT 1 FROM period_close_blockers b
          WHERE b.period_id = ${req.params.id}
            AND b.resolved = false
            AND o.id = ANY(b.related_obligation_ids)
        )`);
      }
      const whereSql = sql.join(whereParts, sql` AND `);

      // The composite query (spec §4). LEFT JOINs because each downstream
      // stage may not yet have a row for this obligation. `LIMIT n+1` lets
      // us flag hasNext without a separate COUNT(*) — cheap pagination.
      const dataQuery = sql`
        SELECT
          o.id,
          o.contract_id              AS "contractId",
          o.partner_name             AS "partnerName",
          o.kind,
          o.amount,
          o.outstanding_amount       AS "outstandingAmount",
          o.currency,
          o.status,
          o.funding_period           AS "fundingPeriod",
          o.due_at                   AS "dueAt",
          o.dispute_state            AS "disputeState",
          o.source_accrual_id        AS "sourceAccrualId",
          o.linked_journal_entry_id  AS "linkedJournalEntryId",
          c.display_name             AS "contractName",
          c.flow_type_code           AS "flowTypeCode",
          ft.name                    AS "flowTypeName",
          a.status                   AS "accrualStatus",
          a.ai_confidence            AS "accrualConfidence",
          je.je_stage                AS "jeStatus",
          je.balanced                AS "jeBalanced",
          je.je_id                   AS "linkedJeCode",
          s.id                       AS "linkedSettlementId",
          s.settlement_status        AS "settlementStatus",
          s.match_status             AS "settlementMatchStatus",
          ic.id                      AS "linkedClaimId",
          ic.status                  AS "claimStatus",
          ic.dispute_state           AS "claimDispute",
          d.id                       AS "linkedDeductionId",
          d.status                   AS "deductionStatus",
          fd.id                      AS "linkedFinanceDocumentId",
          fd.status                  AS "invoiceStatus",
          fd.oracle_status           AS "invoiceOracleStatus",
          EXISTS (
            SELECT 1 FROM period_close_blockers b
            WHERE b.period_id = ${req.params.id}
              AND b.resolved = false
              AND o.id = ANY(b.related_obligation_ids)
          ) AS "hasBlocker",
          EXISTS (
            SELECT 1 FROM close_decisions cd
            WHERE cd.period_id = ${req.params.id}
              AND cd.status = 'pending'
              AND o.id = ANY(cd.affected_obligation_ids)
          ) AS "hasPendingDecision"
        FROM obligations o
        LEFT JOIN contracts c           ON c.id  = o.contract_id
        LEFT JOIN flow_types ft         ON ft.code = c.flow_type_code
        LEFT JOIN accruals a            ON a.accrual_id = o.source_accrual_id
        LEFT JOIN journal_entries je    ON je.id  = o.linked_journal_entry_id
        -- The next four joins use LATERAL with LIMIT 1 to project the
        -- most-recent representative row per obligation. A plain LEFT JOIN
        -- multiplies obligation rows when a contract/period has > 1
        -- settlement, claim, deduction, or finance document.
        LEFT JOIN LATERAL (
          SELECT id, settlement_status, match_status FROM settlements
          WHERE contract_id = o.contract_id AND period = ${periodLabel}
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ) s ON true
        LEFT JOIN LATERAL (
          SELECT id, status, dispute_state FROM inbound_claims
          WHERE contract_id = o.contract_id AND period = ${periodLabel}
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ) ic ON true
        LEFT JOIN LATERAL (
          SELECT id, status FROM deductions
          WHERE matched_obligation_id = o.id
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ) d ON true
        LEFT JOIN LATERAL (
          SELECT id, status, oracle_status FROM finance_documents
          WHERE contract_id = o.contract_id AND period = ${periodLabel}
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ) fd ON true
        WHERE ${whereSql}
        ORDER BY ${orderClause}
        LIMIT ${limit + 1}
        OFFSET ${cursor}
      `;

      const result: any = await db.execute(dataQuery);
      const rows = (result.rows || result) as any[];
      const hasNext = rows.length > limit;
      const pageRows = hasNext ? rows.slice(0, limit) : rows;

      res.json({
        rows: pageRows,
        meta: {
          periodId: req.params.id,
          periodLabel,
          limit,
          cursor,
          nextCursor: hasNext ? cursor + limit : null,
          hasNext,
          sort: sortBy,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/period-close/:id/insights
  // The 3-tile insights strip rendered above the Worksheet grid:
  //   1. contractsByFlow — distinct contracts + total $ per flow_type
  //   2. periodVsPeriod  — current period total + YoY/MoM/YTD comparisons + 12-mo sparkline
  //   3. pinnedKpis      — saved AI-generated custom KPIs (Phase 2 fills `value`)
  router.get("/api/period-close/:id/insights", async (req, res) => {
    try {
      const [periodRow] = await db.select().from(periodClose).where(eq(periodClose.id, req.params.id));
      if (!periodRow) return res.status(404).json({ error: "Period not found" });
      const periodLabel = periodRow.periodLabel;
      const companyId = periodRow.companyId
        ?? (req as any).user?.activeContext?.companyId
        ?? null;
      const userId = (req as any).user?.id ?? null;

      // ----- Tile 1: contracts-by-flow over OBLIGATIONS in this period.
      const flowAgg = await db.execute(sql`
        SELECT
          COALESCE(c.flow_type_code, 'OTHER') AS "flowCode",
          COALESCE(ft.name, 'Other')          AS "flowName",
          COUNT(DISTINCT o.contract_id)::int  AS "contracts",
          COALESCE(SUM(o.amount), 0)          AS "amount"
        FROM obligations o
        LEFT JOIN contracts c    ON c.id = o.contract_id
        LEFT JOIN flow_types ft  ON ft.code = c.flow_type_code
        WHERE o.funding_period = ${periodLabel}
          ${companyId ? sql`AND o.company_id = ${companyId}` : sql``}
        GROUP BY c.flow_type_code, ft.name
        ORDER BY "amount" DESC
      `);
      const flowRows = ((flowAgg as any).rows || flowAgg) as any[];
      const byFlow = flowRows.map(r => ({
        flowCode: r.flowCode,
        flowName: r.flowName,
        contracts: Number(r.contracts) || 0,
        amount: Number(r.amount) || 0,
      }));
      const totalAmount = byFlow.reduce((s, r) => s + r.amount, 0);
      const totalContracts = byFlow.reduce((s, r) => s + r.contracts, 0);
      const contractsByFlow = byFlow.map(r => ({
        ...r,
        pct: totalAmount > 0 ? +((r.amount / totalAmount) * 100).toFixed(1) : 0,
      }));

      // ----- Tile 2: period-vs-period over ACCRUALS (what got booked to GL).
      // We need labels for: prior month, prior year same month, YTD current,
      // YTD prior, and 12-month sparkline. accruals.period stores the same
      // canonical "MMM YYYY" string the periodClose master uses, so a single
      // batched IN-list query gives us every comparison number.
      const range = parsePeriodLabel(periodLabel);
      const monthAbbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const labelOf = (y: number, m: number) => `${monthAbbr[m]} ${y}`;

      let periodVsPeriod: any = {
        currentLabel: periodLabel,
        currentAmount: 0,
        priorMonth: null,
        yoy: null,
        ytd: null,
        sparkline: [] as { label: string; value: number }[],
      };

      if (range) {
        const curYear = range.start.getUTCFullYear();
        const curMonth = range.start.getUTCMonth(); // 0-11
        const priorMonthLabel = labelOf(
          curMonth === 0 ? curYear - 1 : curYear,
          curMonth === 0 ? 11 : curMonth - 1,
        );
        const priorYearLabel = labelOf(curYear - 1, curMonth);

        const ytdCurLabels: string[] = [];
        const ytdPriorLabels: string[] = [];
        for (let m = 0; m <= curMonth; m++) {
          ytdCurLabels.push(labelOf(curYear, m));
          ytdPriorLabels.push(labelOf(curYear - 1, m));
        }

        // 12-month sparkline ending at the current period — walk back
        // month-by-month then reverse so the array reads oldest → newest.
        const sparkLabels: string[] = [];
        {
          let sy = curYear, sm = curMonth;
          const back: string[] = [];
          for (let i = 0; i < 12; i++) {
            back.push(labelOf(sy, sm));
            sm -= 1;
            if (sm < 0) { sm = 11; sy -= 1; }
          }
          sparkLabels.push(...back.reverse());
        }

        const allLabels = Array.from(new Set([
          periodLabel, priorMonthLabel, priorYearLabel,
          ...ytdCurLabels, ...ytdPriorLabels, ...sparkLabels,
        ]));

        const sumsResult = await db.execute(sql`
          SELECT period, COALESCE(SUM(amount), 0) AS amt
          FROM accruals
          WHERE period IN (${sql.join(allLabels.map(l => sql`${l}`), sql`, `)})
            ${companyId ? sql`AND company_id = ${companyId}` : sql``}
          GROUP BY period
        `);
        const sumsRows = ((sumsResult as any).rows || sumsResult) as any[];
        const sumByLabel: Record<string, number> = {};
        sumsRows.forEach(r => { sumByLabel[r.period] = Number(r.amt) || 0; });

        const curAmt = sumByLabel[periodLabel] || 0;
        const priorMoAmt = sumByLabel[priorMonthLabel] || 0;
        const priorYrAmt = sumByLabel[priorYearLabel] || 0;
        const ytdCurAmt = ytdCurLabels.reduce((s, l) => s + (sumByLabel[l] || 0), 0);
        const ytdPriorAmt = ytdPriorLabels.reduce((s, l) => s + (sumByLabel[l] || 0), 0);
        const pctChange = (cur: number, prev: number) =>
          prev === 0 ? null : +(((cur - prev) / prev) * 100).toFixed(1);

        periodVsPeriod = {
          currentLabel: periodLabel,
          currentAmount: curAmt,
          priorMonth: {
            label: priorMonthLabel,
            amount: priorMoAmt,
            deltaPct: pctChange(curAmt, priorMoAmt),
          },
          yoy: {
            label: priorYearLabel,
            amount: priorYrAmt,
            deltaPct: pctChange(curAmt, priorYrAmt),
          },
          ytd: {
            current: { label: `YTD ${curYear}`, amount: ytdCurAmt },
            prior:   { label: `YTD ${curYear - 1}`, amount: ytdPriorAmt },
            deltaPct: pctChange(ytdCurAmt, ytdPriorAmt),
          },
          sparkline: sparkLabels.map(l => ({ label: l, value: sumByLabel[l] || 0 })),
        };
      }

      // ----- Tile 3: pinned KPIs visible to this user (own + company-shared).
      // Read uses raw SQL so the route stays self-contained without adding
      // pinnedKpis to the imported schema list yet (Phase 2 will wire CRUD).
      const pinsResult = await db.execute(sql`
        SELECT
          id, scope, owner_user_id AS "ownerUserId", company_id AS "companyId",
          prompt, label, query_plan AS "queryPlan",
          preferred_chart AS "preferredChart", icon_hint AS "iconHint",
          severity, sort_order AS "sortOrder",
          last_run_at AS "lastRunAt", last_run_value AS "lastRunValue",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM pinned_kpis
        WHERE
          ${companyId ? sql`(scope = 'company' AND company_id = ${companyId})` : sql`false`}
          ${userId ? sql`OR (scope = 'user' AND owner_user_id = ${userId})` : sql``}
        ORDER BY sort_order ASC, created_at DESC
      `);
      const pinnedKpis = ((pinsResult as any).rows || pinsResult) as any[];

      res.json({
        periodId: req.params.id,
        periodLabel,
        contractsByFlow: {
          rows: contractsByFlow,
          totals: { contracts: totalContracts, amount: totalAmount },
        },
        periodVsPeriod,
        pinnedKpis,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==============================
  // PERIOD CLOSE WORKSPACE — Phase 1c
  // Batch actions wrapped in idempotency receipts.
  // Spec: docs/period-close-data-model.md §5.2
  //
  // All five endpoints share the same contract:
  //   - Require an `Idempotency-Key` header (UI generates a UUID per
  //     click; AI executor reuses close_decisions.id). Replays return the
  //     cached resultSummary without re-running the action.
  //   - Return { batchOperationId, status, resultSummary, replayed }.
  //   - Per-item failures populate resultSummary.errors[]; the batch is
  //     'partial' (some succeeded, some failed) or 'failed' (all failed).
  // ==============================

  // ====================================================================
  // Phase 2 — Ask LedgerIQ (KPI ask + pin)
  //
  // Spec: docs/period-close-data-model.md §5.4 + locked decision §9 #5
  // (two-tier flow). The chat path is conversational and AI-backed; the
  // pin path is a deterministic queryPlan re-executor with NO LLM in
  // the dashboard hot path.
  // ====================================================================

  // POST /api/finance/kpi-ask
  // Body: { prompt: string, periodId: string }
  // Returns the natural-language answer plus, when the question is a
  // clean obligation aggregation, the queryPlan + pre-evaluated value.
  // The resultId can be POSTed back to /pin within 30 minutes.
  router.post("/api/finance/kpi-ask", async (req, res) => {
    try {
      const { prompt, periodId } = req.body ?? {};
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "prompt is required" });
      }
      if (!periodId || typeof periodId !== "string") {
        return res.status(400).json({ error: "periodId is required" });
      }
      if (prompt.length > 1000) {
        return res.status(400).json({ error: "prompt must be 1000 chars or fewer" });
      }

      const [periodRow] = await db
        .select()
        .from(periodClose)
        .where(eq(periodClose.id, periodId));
      if (!periodRow) return res.status(404).json({ error: "Period not found" });
      const periodLabel = periodRow.periodLabel;
      const companyId = (req as any).user?.activeContext?.companyId ?? null;

      // Build a compact period snapshot for the LLM. Includes the same
      // tile data as /insights plus the top 30 obligations by amount, so
      // the model can cite real obligation IDs without us shipping the
      // full grid (which can be thousands of rows).
      const insightsRows: any[] = (
        await db.execute(sql`
          SELECT COUNT(*)::int AS total_count,
                 COALESCE(SUM(o.amount), 0)::numeric AS total_amount,
                 COALESCE(SUM(o.outstanding_amount), 0)::numeric AS total_outstanding,
                 COUNT(*) FILTER (WHERE o.status = 'accrued')::int AS accrued_count,
                 COUNT(*) FILTER (WHERE o.status IN ('claimed','approved'))::int AS claimed_count,
                 COUNT(*) FILTER (WHERE o.status = 'paid')::int AS paid_count
          FROM obligations o
          LEFT JOIN contracts c ON c.id = o.contract_id
          WHERE o.funding_period = ${periodLabel}
        `)
      ).rows as any[];
      const tile = insightsRows[0] ?? {};

      const topRows: any[] = (
        await db.execute(sql`
          SELECT o.id, o.partner_name, o.kind, o.status,
                 o.amount, o.outstanding_amount, o.currency,
                 c.flow_type_code
          FROM obligations o
          LEFT JOIN contracts c ON c.id = o.contract_id
          WHERE o.funding_period = ${periodLabel}
          ORDER BY o.amount DESC NULLS LAST
          LIMIT 30
        `)
      ).rows as any[];

      const snapshot = {
        period: { id: periodId, label: periodLabel, status: periodRow.status },
        tiles: {
          totalObligations: Number(tile.total_count ?? 0),
          totalAmount: Number(tile.total_amount ?? 0),
          totalOutstanding: Number(tile.total_outstanding ?? 0),
          byStatus: {
            accrued: Number(tile.accrued_count ?? 0),
            claimedOrApproved: Number(tile.claimed_count ?? 0),
            paid: Number(tile.paid_count ?? 0),
          },
        },
        topObligations: topRows.map((r) => ({
          id: r.id,
          partner: r.partner_name,
          kind: r.kind,
          status: r.status,
          amount: Number(r.amount ?? 0),
          outstanding: Number(r.outstanding_amount ?? 0),
          currency: r.currency,
          flowType: r.flow_type_code,
        })),
      };

      const result = await askLedgerIQ({
        prompt: prompt.trim(),
        periodId,
        periodLabel,
        contextSnapshot: snapshot,
        companyId,
      });

      res.json(result);
    } catch (err) {
      console.error("POST /api/finance/kpi-ask error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/kpi-ask/:resultId/pin
  // Body: { label?: string, scope?: 'user' | 'company' }
  // Promotes a cached ask result to a persisted pinned KPI. Rejects with
  // 422 if the result has no queryPlan (locked decision §9 #5: "if model
  // can't emit valid plan, pin is rejected with try a more specific
  // question").
  router.post("/api/finance/kpi-ask/:resultId/pin", async (req, res) => {
    try {
      const { resultId } = req.params;
      const cached = getCachedAskResult(resultId);
      if (!cached) {
        return res.status(404).json({
          error: "ASK_RESULT_EXPIRED",
          message: "This answer is no longer available — re-ask the question to pin it.",
        });
      }
      if (!cached.canPin || !cached.queryPlan) {
        return res.status(422).json({
          error: "NOT_PINNABLE",
          message:
            cached.pinRejectionReason ??
            "This answer can't be pinned — try a more specific question.",
        });
      }

      const userId = (req as any).user?.id ?? null;
      const companyId = (req as any).user?.activeContext?.companyId ?? null;
      const scope = req.body?.scope === "company" ? "company" : "user";
      const label = (req.body?.label && String(req.body.label).trim()) || cached.naturalLanguageAnswer.slice(0, 80);

      const [pin] = await db
        .insert(pinnedKpis)
        .values({
          scope,
          ownerUserId: userId,
          companyId,
          prompt: cached.naturalLanguageAnswer, // store the answered prompt for context
          label,
          queryPlan: cached.queryPlan as any,
          preferredChart: cached.suggestedChart,
          severity: cached.severity,
          lastRunAt: new Date(),
          lastRunValue: cached.evaluatedResult as any,
        } as any)
        .returning();

      res.status(201).json(pin);
    } catch (err) {
      console.error("POST /api/finance/kpi-ask/:resultId/pin error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ===========================================================================
  // Chat thread persistence (Phase 4 — Co-Pilot conversation history)
  // ===========================================================================
  // Threads are private to the creating user (locked decision §9 #4). Every
  // endpoint scopes by `userId = req.user.id` and 404s on cross-user access
  // rather than 403, so the existence of someone else's thread is not
  // disclosed.

  // GET /api/finance/chat-threads?periodId=...&status=active
  // Returns the current user's threads, newest activity first.
  router.get("/api/finance/chat-threads", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "auth required" });
      const periodId = typeof req.query.periodId === "string" ? req.query.periodId : null;
      const status = typeof req.query.status === "string" ? req.query.status : "active";

      const where = [eq(closeChatThreads.userId, userId), eq(closeChatThreads.status, status)];
      if (periodId) where.push(eq(closeChatThreads.periodId, periodId));

      const rows = await db
        .select()
        .from(closeChatThreads)
        .where(and(...where))
        .orderBy(desc(closeChatThreads.lastMessageAt));
      res.json(rows);
    } catch (err) {
      console.error("GET /api/finance/chat-threads error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/chat-threads
  // Body: { periodId, title?, scopeFilter? }
  router.post("/api/finance/chat-threads", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "auth required" });
      const companyId = (req as any).user?.activeContext?.companyId ?? null;
      const { periodId, title, scopeFilter } = req.body ?? {};
      if (!periodId || typeof periodId !== "string") {
        return res.status(400).json({ error: "periodId is required" });
      }

      const [period] = await db.select().from(periodClose).where(eq(periodClose.id, periodId));
      if (!period) return res.status(404).json({ error: "Period not found" });

      const [thread] = await db
        .insert(closeChatThreads)
        .values({
          periodId,
          userId,
          companyId,
          title: title?.trim() || `${period.periodLabel} close session`,
          scopeFilter: scopeFilter ?? null,
        } as any)
        .returning();
      res.status(201).json(thread);
    } catch (err) {
      console.error("POST /api/finance/chat-threads error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/finance/chat-threads/:id
  // Returns the thread plus all messages (oldest first) in a single
  // round-trip — UI hydrates the conversation in one shot.
  router.get("/api/finance/chat-threads/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "auth required" });
      const [thread] = await db
        .select()
        .from(closeChatThreads)
        .where(and(eq(closeChatThreads.id, req.params.id), eq(closeChatThreads.userId, userId)));
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const messages = await db
        .select()
        .from(closeChatMessages)
        .where(eq(closeChatMessages.threadId, thread.id))
        .orderBy(closeChatMessages.createdAt);
      res.json({ thread, messages });
    } catch (err) {
      console.error("GET /api/finance/chat-threads/:id error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PATCH /api/finance/chat-threads/:id
  // Body: { title?, status? }  // status: 'active' | 'archived'
  router.patch("/api/finance/chat-threads/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "auth required" });
      const [existing] = await db
        .select()
        .from(closeChatThreads)
        .where(and(eq(closeChatThreads.id, req.params.id), eq(closeChatThreads.userId, userId)));
      if (!existing) return res.status(404).json({ error: "Thread not found" });

      const patch: Record<string, any> = { updatedAt: new Date() };
      if (typeof req.body?.title === "string" && req.body.title.trim()) {
        patch.title = req.body.title.trim().slice(0, 200);
      }
      if (req.body?.status === "active" || req.body?.status === "archived") {
        patch.status = req.body.status;
      }
      const [updated] = await db
        .update(closeChatThreads)
        .set(patch)
        .where(eq(closeChatThreads.id, existing.id))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("PATCH /api/finance/chat-threads/:id error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/chat-threads/:id/turn
  // Body: { prompt }
  // Persists the user message, calls askLedgerIQ, persists the assistant
  // message embedding the full ask result so a reload re-renders the same
  // computed value / pin button. Returns { userMessage, assistantMessage }.
  router.post("/api/finance/chat-threads/:id/turn", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "auth required" });
      const companyId = (req as any).user?.activeContext?.companyId ?? null;

      const [thread] = await db
        .select()
        .from(closeChatThreads)
        .where(and(eq(closeChatThreads.id, req.params.id), eq(closeChatThreads.userId, userId)));
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.status === "archived") {
        return res.status(409).json({ error: "Thread is archived" });
      }

      const prompt = req.body?.prompt;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "prompt is required" });
      }
      if (prompt.length > 1000) {
        return res.status(400).json({ error: "prompt must be 1000 chars or fewer" });
      }

      const [periodRow] = await db
        .select()
        .from(periodClose)
        .where(eq(periodClose.id, thread.periodId));
      if (!periodRow) return res.status(404).json({ error: "Period not found" });
      const periodLabel = periodRow.periodLabel;

      // 1) Persist the user turn first so even if the LLM call fails the
      //    user's question is preserved in the thread.
      const [userMessage] = await db
        .insert(closeChatMessages)
        .values({
          threadId: thread.id,
          role: "user",
          content: [{ type: "text", text: prompt.trim() }],
        } as any)
        .returning();

      // 2) Build the same period snapshot as /kpi-ask (kept in sync — we
      //    re-execute the two SQLs rather than refactor for now since the
      //    snapshot shape is small and stable).
      const insightsRows: any[] = (
        await db.execute(sql`
          SELECT COUNT(*)::int AS total_count,
                 COALESCE(SUM(o.amount), 0)::numeric AS total_amount,
                 COALESCE(SUM(o.outstanding_amount), 0)::numeric AS total_outstanding,
                 COUNT(*) FILTER (WHERE o.status = 'accrued')::int AS accrued_count,
                 COUNT(*) FILTER (WHERE o.status IN ('claimed','approved'))::int AS claimed_count,
                 COUNT(*) FILTER (WHERE o.status = 'paid')::int AS paid_count
          FROM obligations o
          LEFT JOIN contracts c ON c.id = o.contract_id
          WHERE o.funding_period = ${periodLabel}
        `)
      ).rows as any[];
      const tile = insightsRows[0] ?? {};
      const topRows: any[] = (
        await db.execute(sql`
          SELECT o.id, o.partner_name, o.kind, o.status,
                 o.amount, o.outstanding_amount, o.currency,
                 c.flow_type_code
          FROM obligations o
          LEFT JOIN contracts c ON c.id = o.contract_id
          WHERE o.funding_period = ${periodLabel}
          ORDER BY o.amount DESC NULLS LAST
          LIMIT 30
        `)
      ).rows as any[];
      const snapshot = {
        period: { id: thread.periodId, label: periodLabel, status: periodRow.status },
        tiles: {
          totalObligations: Number(tile.total_count ?? 0),
          totalAmount: Number(tile.total_amount ?? 0),
          totalOutstanding: Number(tile.total_outstanding ?? 0),
          byStatus: {
            accrued: Number(tile.accrued_count ?? 0),
            claimedOrApproved: Number(tile.claimed_count ?? 0),
            paid: Number(tile.paid_count ?? 0),
          },
        },
        topObligations: topRows.map((r) => ({
          id: r.id, partner: r.partner_name, kind: r.kind, status: r.status,
          amount: Number(r.amount ?? 0), outstanding: Number(r.outstanding_amount ?? 0),
          currency: r.currency, flowType: r.flow_type_code,
        })),
      };

      let askResult: any;
      let assistantContent: any[];
      try {
        askResult = await askLedgerIQ({
          prompt: prompt.trim(),
          periodId: thread.periodId,
          periodLabel,
          contextSnapshot: snapshot,
          companyId,
        });
        assistantContent = [{ type: "ask_result", result: askResult }];
      } catch (e) {
        // Persist the failure as an assistant message so the user sees what
        // happened on reload, then re-throw to surface the 500.
        await db.insert(closeChatMessages).values({
          threadId: thread.id,
          role: "assistant",
          content: [{ type: "error", message: (e as Error).message }],
        } as any);
        await db
          .update(closeChatThreads)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() } as any)
          .where(eq(closeChatThreads.id, thread.id));
        throw e;
      }

      const [assistantMessage] = await db
        .insert(closeChatMessages)
        .values({
          threadId: thread.id,
          role: "assistant",
          content: assistantContent,
          modelProvider: askResult.modelProvider,
          modelName: askResult.modelName,
        } as any)
        .returning();

      // Bump thread activity timestamp + auto-title from first prompt if
      // still on the default placeholder.
      const titlePatch: Record<string, any> = { lastMessageAt: new Date(), updatedAt: new Date() };
      if (
        thread.title?.endsWith("close session") ||
        thread.title === "Untitled close session"
      ) {
        titlePatch.title = prompt.trim().slice(0, 80);
      }
      await db.update(closeChatThreads).set(titlePatch).where(eq(closeChatThreads.id, thread.id));

      res.status(201).json({ userMessage, assistantMessage });
    } catch (err) {
      console.error("POST /api/finance/chat-threads/:id/turn error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ==================================================================
  // CLOSE DECISIONS — the AI Decision Queue
  //
  // Every action the Co-Pilot proposes lands in close_decisions with
  // status='pending' and an `expires_at` 12h in the future (DEFAULT
  // sql`now() + interval '12 hours'`). A human approves or rejects.
  // Approving dispatches to the appropriate batch executor via
  // runIdempotentBatch, using decision.id as the idempotency key so a
  // double-click returns the same batch_operation receipt.
  //
  // Two safety checks at approve-time:
  //   1. Expiry — if decision.expires_at < now(), reject with 410.
  //   2. Lazy supersession — if any obligation in
  //      affected_obligation_ids has been updated after the decision
  //      was created, mark the decision `superseded` and refuse to
  //      execute. The user must re-prompt the Co-Pilot to get a fresh
  //      proposal against the current data.
  //
  // Authorization: same scoping as chat threads — a user can only see
  // decisions in periods of their company. We rely on the period's
  // company scoping (req.user.companyId) instead of the decision's
  // own companyId column because the period is the SLA boundary.
  // ==================================================================

  // Allow-listed action types for the Decision Queue. Mirrors the
  // schema comment on close_decisions.action_type. Any value not in
  // this list is rejected at insert time so we never accumulate
  // garbage rows that the approver doesn't know how to handle.
  const ALLOWED_DECISION_ACTIONS = new Set<CloseActionType>([
    "post_jes",
    "settle_obligations",
    "resolve_claims",
    "apply_deductions",
    "reverse_accruals",
    "release_obligations",
    "hold_for_review",
    "request_info",
    "flag_blocker",
  ]);

  // Helper — auto-flip pending decisions whose expires_at has passed.
  // Called at the top of every list/get/approve so the UI never sees
  // a stale "pending" row that's actually expired. This is intentionally
  // lazy (no background job) — locked decision §9 #4.
  async function markExpiredDecisions(periodId: string): Promise<number> {
    const expired = await db
      .update(closeDecisions)
      .set({ status: "expired", updatedAt: new Date() } as any)
      .where(sql`${closeDecisions.periodId} = ${periodId}
              AND ${closeDecisions.status} = 'pending'
              AND ${closeDecisions.expiresAt} < now()`)
      .returning({ id: closeDecisions.id });
    return expired.length;
  }

  // GET /api/finance/period/:id/decisions?status=pending|all
  // List decisions for a period. Default status filter is 'pending'.
  // Always sweeps expired-pending → expired before returning so the
  // queue UI never shows a row that's about to be auto-rejected.
  router.get("/api/finance/period/:id/decisions", async (req, res) => {
    try {
      if (!(req as any).user?.id) return res.status(401).json({ error: "Authentication required" });
      const periodId = req.params.id;

      // 1. Verify period exists (and belongs to user's company if scoped).
      const [periodRow] = await db.select().from(periodClose).where(eq(periodClose.id, periodId));
      if (!periodRow) return res.status(404).json({ error: "Period not found" });

      // 2. Sweep expired before listing.
      await markExpiredDecisions(periodId);

      // 3. Status filter.
      const statusParam = String(req.query.status || "pending");
      const statusFilter =
        statusParam === "all"
          ? sql`TRUE`
          : sql`${closeDecisions.status} = ${statusParam}`;

      const rows = await db
        .select()
        .from(closeDecisions)
        .where(and(eq(closeDecisions.periodId, periodId), statusFilter))
        .orderBy(desc(closeDecisions.createdAt));

      res.json({ rows });
    } catch (err) {
      console.error("GET /api/finance/period/:id/decisions error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/finance/decisions/:id — full detail.
  router.get("/api/finance/decisions/:id", async (req, res) => {
    try {
      if (!(req as any).user?.id) return res.status(401).json({ error: "Authentication required" });
      const [row] = await db
        .select()
        .from(closeDecisions)
        .where(eq(closeDecisions.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Decision not found" });
      res.json(row);
    } catch (err) {
      console.error("GET /api/finance/decisions/:id error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/decisions  — manual create (testing / pre-AI-proposer).
  // Body: { periodId, threadId?, actionType, payload, riskLevel?, rationale?,
  //         affectedObligationIds?, affectedAmount?, affectedCount?, citations? }
  // Once the Co-Pilot LLM tool-use lands, decisions will instead be
  // created server-side as part of the chat-thread turn. This endpoint
  // stays available as an escape hatch for ops and tests.
  router.post("/api/finance/decisions", async (req, res) => {
    try {
      if (!(req as any).user?.id) return res.status(401).json({ error: "Authentication required" });
      const {
        periodId,
        threadId,
        messageId,
        actionType,
        payload,
        riskLevel,
        rationale,
        affectedObligationIds,
        affectedAmount,
        affectedCount,
        citations,
      } = req.body || {};
      if (!periodId) return res.status(400).json({ error: "periodId required" });
      if (!actionType || !ALLOWED_DECISION_ACTIONS.has(actionType)) {
        return res.status(400).json({
          error: `actionType must be one of: ${Array.from(ALLOWED_DECISION_ACTIONS).join(", ")}`,
        });
      }
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "payload (object) required" });
      }
      const [periodRow] = await db.select().from(periodClose).where(eq(periodClose.id, periodId));
      if (!periodRow) return res.status(404).json({ error: "Period not found" });

      const [row] = await db
        .insert(closeDecisions)
        .values({
          periodId,
          threadId: threadId ?? null,
          messageId: messageId ?? null,
          actionType,
          payload,
          riskLevel: riskLevel ?? "low",
          rationale: rationale ?? null,
          affectedObligationIds: Array.isArray(affectedObligationIds)
            ? affectedObligationIds
            : null,
          affectedAmount: affectedAmount ?? null,
          affectedCount: typeof affectedCount === "number" ? affectedCount : 0,
          citations: citations ?? null,
          status: "pending",
          companyId: (periodRow as any).companyId ?? null,
        } as any)
        .returning();

      res.json(row);
    } catch (err) {
      console.error("POST /api/finance/decisions error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/decisions/:id/approve
  //   - 410 if expired (also marks status='expired' if not already).
  //   - 409 if any affected obligation has been updated since
  //     decision.created_at — marks status='superseded' with reason.
  //   - For batch action types: dispatches via runIdempotentBatch
  //     using decision.id as the idempotency key.
  //   - For non-batch action types (hold_for_review, request_info,
  //     flag_blocker): handled inline.
  //   - Always writes the approved/executed status and metadata
  //     atomically AFTER the executor returns so a failure leaves
  //     status='failed' with executionError populated, NOT 'approved'.
  router.post("/api/finance/decisions/:id/approve", async (req, res) => {
    try {
      if (!(req as any).user?.id) return res.status(401).json({ error: "Authentication required" });
      const decisionId = req.params.id;

      const [decision] = await db
        .select()
        .from(closeDecisions)
        .where(eq(closeDecisions.id, decisionId));
      if (!decision) return res.status(404).json({ error: "Decision not found" });
      if (decision.status !== "pending") {
        return res.status(409).json({
          error: `Decision is ${decision.status}, only pending decisions can be approved`,
          currentStatus: decision.status,
        });
      }

      // 1. Expiry guard.
      if (decision.expiresAt && new Date(decision.expiresAt) < new Date()) {
        await db
          .update(closeDecisions)
          .set({ status: "expired", updatedAt: new Date() } as any)
          .where(eq(closeDecisions.id, decisionId));
        return res.status(410).json({
          error: "Decision expired",
          expiresAt: decision.expiresAt,
        });
      }

      // 2. Lazy supersession: if any affected obligation has been
      //    touched after the decision was created, mark superseded.
      //    The user must re-ask the Co-Pilot for a fresh proposal.
      if (
        Array.isArray(decision.affectedObligationIds) &&
        decision.affectedObligationIds.length > 0 &&
        decision.createdAt
      ) {
        const newer = await db
          .select({ id: obligations.id, updatedAt: obligations.updatedAt })
          .from(obligations)
          .where(
            and(
              inArray(obligations.id, decision.affectedObligationIds),
              sql`${obligations.updatedAt} > ${decision.createdAt}`,
            ),
          );
        if (newer.length > 0) {
          const reason = `Affected obligation(s) modified after proposal: ${newer.map(r => r.id).slice(0, 3).join(", ")}${newer.length > 3 ? `, +${newer.length - 3} more` : ""}`;
          await db
            .update(closeDecisions)
            .set({
              status: "superseded",
              supersededAt: new Date(),
              supersededReason: reason,
              updatedAt: new Date(),
            } as any)
            .where(eq(closeDecisions.id, decisionId));
          return res.status(409).json({
            error: "Decision superseded by newer data",
            reason,
            modifiedObligationIds: newer.map(r => r.id),
          });
        }
      }

      const ctx = {
        userId: (req as any).user.id,
        userName: (req as any).user?.username || "Unknown",
        periodId: decision.periodId,
      };
      const actionType = decision.actionType as CloseActionType;
      const payload = decision.payload as any;

      // 3. Mark approved up-front (so we don't lose the approver's
      //    identity if execution crashes).
      await db
        .update(closeDecisions)
        .set({
          status: "approved",
          approvedBy: (req as any).user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(closeDecisions.id, decisionId));

      // 4. Dispatch.
      try {
        if (NON_BATCH_ACTIONS.has(actionType)) {
          // hold_for_review and request_info are pure state transitions.
          // flag_blocker writes a period_close_blockers row.
          let inlineResult: any = { acknowledged: true };
          if (actionType === "flag_blocker") {
            inlineResult = await execFlagBlocker(payload, ctx, decisionId);
          }
          await db
            .update(closeDecisions)
            .set({
              status: "executed",
              executedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(closeDecisions.id, decisionId));
          return res.json({
            ok: true,
            decisionId,
            executed: true,
            inline: true,
            result: inlineResult,
          });
        }

        // Batch action — runIdempotentBatch handles the receipt + audit row.
        const opType = BATCH_OP_BY_ACTION[actionType];
        if (!opType) {
          throw new Error(`No batch executor mapped for action ${actionType}`);
        }
        const batchResult = await runIdempotentBatch({
          operationType: opType as any,
          idempotencyKey: decisionId, // 1 decision = 1 batch operation
          periodId: decision.periodId,
          initiatedBy: (req as any).user.id,
          initiatedVia: "copilot",
          companyId: decision.companyId ?? null,
          payload,
          exec: () => execBatchAction(actionType, payload, ctx),
        });

        await db
          .update(closeDecisions)
          .set({
            status: batchResult.status === "succeeded" ? "executed" : "failed",
            executedAt: new Date(),
            batchOperationId: batchResult.batchOperationId,
            executionError:
              batchResult.status === "failed"
                ? `Batch ${batchResult.status}: ${(batchResult.resultSummary?.errors?.[0]?.message) || "see batch_operation row"}`
                : null,
            updatedAt: new Date(),
          })
          .where(eq(closeDecisions.id, decisionId));

        res.json({
          ok: batchResult.status !== "failed",
          decisionId,
          executed: true,
          inline: false,
          batchOperationId: batchResult.batchOperationId,
          batchStatus: batchResult.status,
          result: batchResult.resultSummary,
          replayed: batchResult.replayed,
        });
      } catch (execErr) {
        const msg = (execErr as Error).message;
        await db
          .update(closeDecisions)
          .set({
            status: "failed",
            executionError: msg,
            updatedAt: new Date(),
          } as any)
          .where(eq(closeDecisions.id, decisionId));
        res.status(500).json({ error: msg, decisionId });
      }
    } catch (err) {
      console.error("POST /api/finance/decisions/:id/approve error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/finance/decisions/:id/reject
  // Body: { reason: string }
  router.post("/api/finance/decisions/:id/reject", async (req, res) => {
    try {
      if (!(req as any).user?.id) return res.status(401).json({ error: "Authentication required" });
      const decisionId = req.params.id;
      const { reason } = req.body || {};
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "reason (non-empty string) required" });
      }

      const [decision] = await db
        .select()
        .from(closeDecisions)
        .where(eq(closeDecisions.id, decisionId));
      if (!decision) return res.status(404).json({ error: "Decision not found" });
      if (decision.status !== "pending") {
        return res.status(409).json({
          error: `Decision is ${decision.status}, only pending decisions can be rejected`,
          currentStatus: decision.status,
        });
      }

      const [updated] = await db
        .update(closeDecisions)
        .set({
          status: "rejected",
          rejectionReason: reason.trim(),
          approvedBy: (req as any).user.id, // recorded as the rejecter for audit
          approvedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(closeDecisions.id, decisionId))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error("POST /api/finance/decisions/:id/reject error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/finance/pinned-kpis?periodId=...
  // Returns the user's own pins plus any company-shared pins. For each
  // pin we re-execute the queryPlan against the requested period (or the
  // pin's last-run period if none specified) so the dashboard always
  // shows fresh numbers — purely deterministic, no LLM in this path.
  router.get("/api/finance/pinned-kpis", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      const companyId = (req as any).user?.activeContext?.companyId ?? null;
      const periodId = typeof req.query.periodId === "string" ? req.query.periodId : null;

      let periodLabel: string | null = null;
      let priorPeriodLabel: string | null = null;
      if (periodId) {
        const [periodRow] = await db
          .select()
          .from(periodClose)
          .where(eq(periodClose.id, periodId));
        if (periodRow) periodLabel = periodRow.periodLabel;
      }

      // Visibility: a user sees their own pins (any scope) plus any
      // company-scoped pins for their active company. When no auth
      // context is present (dev / smoke tests) we surface unowned pins
      // and any company-scope pins so the endpoint stays useful.
      const visibilityClause = userId
        ? sql`(${pinnedKpis.ownerUserId} = ${userId} OR (${pinnedKpis.scope} = 'company' AND ${pinnedKpis.companyId} = ${companyId}))`
        : sql`${pinnedKpis.ownerUserId} IS NULL OR ${pinnedKpis.scope} = 'company'`;

      const pins = await db
        .select()
        .from(pinnedKpis)
        .where(visibilityClause)
        .orderBy(pinnedKpis.sortOrder, desc(pinnedKpis.createdAt));

      const enriched = await Promise.all(
        pins.map(async (pin) => {
          if (!periodLabel || !pin.queryPlan) {
            return { ...pin, currentValue: pin.lastRunValue };
          }
          try {
            const result = await evaluateQueryPlan(
              pin.queryPlan as any,
              periodLabel,
              companyId,
              priorPeriodLabel,
            );
            return { ...pin, currentValue: result };
          } catch (err) {
            return {
              ...pin,
              currentValue: pin.lastRunValue,
              evaluationError: (err as Error).message,
            };
          }
        }),
      );

      res.json(enriched);
    } catch (err) {
      console.error("GET /api/finance/pinned-kpis error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/finance/pinned-kpis/:id
  router.delete("/api/finance/pinned-kpis/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      const [pin] = await db
        .select()
        .from(pinnedKpis)
        .where(eq(pinnedKpis.id, req.params.id));
      if (!pin) return res.status(404).json({ error: "Pin not found" });
      if (userId && pin.ownerUserId && pin.ownerUserId !== userId) {
        return res
          .status(403)
          .json({ error: "Cannot unpin another user's pinned KPI" });
      }
      await db.delete(pinnedKpis).where(eq(pinnedKpis.id, req.params.id));
      res.status(204).end();
    } catch (err) {
      console.error("DELETE /api/finance/pinned-kpis/:id error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Small helper — every batch endpoint reads these the same way.
  function readBatchHeaders(req: Request) {
    const idempotencyKey = req.header("Idempotency-Key")?.trim() || "";
    const initiatedVia = (req.header("X-Initiated-Via")?.trim() as
      | "worksheet"
      | "copilot"
      | "api"
      | undefined) ?? "worksheet";
    const userId = (req as any).user?.id ?? null;
    const companyId = (req as any).user?.activeContext?.companyId ?? null;
    return { idempotencyKey, initiatedVia, userId, companyId };
  }

  // POST /api/finance/batch/post-jes
  // Body: { obligationIds: string[], periodId: string, dryRun?: boolean }
  // Posts the linked journal entries for each obligation (jeStage → 'posted').
  // Obligations without a linkedJournalEntryId are recorded as per-item errors.
  router.post("/api/finance/batch/post-jes", async (req, res) => {
    try {
      const { idempotencyKey, initiatedVia, userId, companyId } = readBatchHeaders(req);
      if (!idempotencyKey) return res.status(400).json({ error: "Missing Idempotency-Key header" });

      const { obligationIds, periodId, dryRun } = req.body || {};
      if (!Array.isArray(obligationIds) || obligationIds.length === 0) {
        return res.status(400).json({ error: "obligationIds must be a non-empty array" });
      }
      if (!periodId) return res.status(400).json({ error: "periodId is required" });

      const result = await runIdempotentBatch({
        operationType: "post_jes",
        idempotencyKey,
        periodId,
        initiatedBy: userId,
        initiatedVia,
        companyId,
        payload: req.body,
        exec: () => execPostJEs(
          { obligationIds, periodId, dryRun },
          { userId: userId || null, userName: (req as any).user?.username || "System", periodId },
        ),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/finance/batch/settle
  // Body: { obligationIds: string[], settlementMethod?: string, periodId: string }
  // Marks all settlements joined to these obligations (via contract+period)
  // as posted. settlementMethod is captured in the audit metadata for
  // reporting but does not change the row schema.
  router.post("/api/finance/batch/settle", async (req, res) => {
    try {
      const { idempotencyKey, initiatedVia, userId, companyId } = readBatchHeaders(req);
      if (!idempotencyKey) return res.status(400).json({ error: "Missing Idempotency-Key header" });

      const { obligationIds, periodId, settlementMethod } = req.body || {};
      if (!Array.isArray(obligationIds) || obligationIds.length === 0) {
        return res.status(400).json({ error: "obligationIds must be a non-empty array" });
      }
      if (!periodId) return res.status(400).json({ error: "periodId is required" });

      const result = await runIdempotentBatch({
        operationType: "settle_obligations",
        idempotencyKey,
        periodId,
        initiatedBy: userId,
        initiatedVia,
        companyId,
        payload: req.body,
        exec: () => execSettle(
          { obligationIds, periodId, settlementMethod },
          { userId: userId || null, userName: (req as any).user?.username || "System", periodId },
        ),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/finance/batch/resolve-claims
  // Body: { claimIds: string[], resolution: 'approve'|'reject'|'partial', notes?: string, periodId: string }
  router.post("/api/finance/batch/resolve-claims", async (req, res) => {
    try {
      const { idempotencyKey, initiatedVia, userId, companyId } = readBatchHeaders(req);
      if (!idempotencyKey) return res.status(400).json({ error: "Missing Idempotency-Key header" });

      const { claimIds, resolution, notes, periodId } = req.body || {};
      if (!Array.isArray(claimIds) || claimIds.length === 0) {
        return res.status(400).json({ error: "claimIds must be a non-empty array" });
      }
      if (!["approve", "reject", "partial"].includes(resolution)) {
        return res.status(400).json({ error: "resolution must be 'approve'|'reject'|'partial'" });
      }
      if (!periodId) return res.status(400).json({ error: "periodId is required" });

      const result = await runIdempotentBatch({
        operationType: "resolve_claims",
        idempotencyKey,
        periodId,
        initiatedBy: userId,
        initiatedVia,
        companyId,
        payload: req.body,
        exec: () => execResolveClaims(
          { claimIds, resolution, notes, periodId },
          { userId: userId || null, userName: (req as any).user?.username || "System", periodId },
        ),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/finance/batch/apply-deductions
  // Body: { deductionIds: string[], action: 'match'|'write_off'|'recover', periodId: string }
  router.post("/api/finance/batch/apply-deductions", async (req, res) => {
    try {
      const { idempotencyKey, initiatedVia, userId, companyId } = readBatchHeaders(req);
      if (!idempotencyKey) return res.status(400).json({ error: "Missing Idempotency-Key header" });

      const { deductionIds, action, periodId } = req.body || {};
      if (!Array.isArray(deductionIds) || deductionIds.length === 0) {
        return res.status(400).json({ error: "deductionIds must be a non-empty array" });
      }
      if (!["match", "write_off", "recover"].includes(action)) {
        return res.status(400).json({ error: "action must be 'match'|'write_off'|'recover'" });
      }
      if (!periodId) return res.status(400).json({ error: "periodId is required" });

      const result = await runIdempotentBatch({
        operationType: "apply_deductions",
        idempotencyKey,
        periodId,
        initiatedBy: userId,
        initiatedVia,
        companyId,
        payload: req.body,
        exec: () => execApplyDeductions(
          { deductionIds, action, periodId },
          { userId: userId || null, userName: (req as any).user?.username || "System", periodId },
        ),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/finance/batch/reverse-accruals
  // Body: { accrualIds: string[], reason: string, periodId: string }
  // Marks accruals as 'reversed' and writes a per-accrual audit row with
  // the reason so the audit trail captures both the batch and the
  // individual reversal.
  router.post("/api/finance/batch/reverse-accruals", async (req, res) => {
    try {
      const { idempotencyKey, initiatedVia, userId, companyId } = readBatchHeaders(req);
      if (!idempotencyKey) return res.status(400).json({ error: "Missing Idempotency-Key header" });

      const { accrualIds, reason, periodId } = req.body || {};
      if (!Array.isArray(accrualIds) || accrualIds.length === 0) {
        return res.status(400).json({ error: "accrualIds must be a non-empty array" });
      }
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ error: "reason (non-empty string) is required" });
      }
      if (!periodId) return res.status(400).json({ error: "periodId is required" });

      const result = await runIdempotentBatch({
        operationType: "reverse_accruals",
        idempotencyKey,
        periodId,
        initiatedBy: userId,
        initiatedVia,
        companyId,
        payload: req.body,
        exec: () => execReverseAccruals(
          { accrualIds, reason, periodId },
          { userId: userId || null, userName: (req as any).user?.username || "System", periodId },
        ),
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/finance/batch/:id
  // Status check for a previously-submitted batch operation. Used by
  // the UI when it wants to poll for completion (e.g. it hit a stale
  // 'running' replay) or display a receipt after the fact.
  router.get("/api/finance/batch/:id", async (req, res) => {
    try {
      const [row] = await db.select().from(closeBatchOperations).where(eq(closeBatchOperations.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Batch operation not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==============================
  // PERIOD CLOSE MASTER DATA (System Settings)
  // ==============================

  router.get("/api/admin/periods", async (_req, res) => {
    try {
      const rows = await db.select().from(periodClose).orderBy(desc(periodClose.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/admin/periods", async (req, res) => {
    try {
      const { periodLabel, status, companyId } = req.body;
      const [row] = await db.insert(periodClose).values({
        periodLabel,
        status: status || "open",
        readinessScore: 0,
        companyId: companyId || null,
      }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put("/api/admin/periods/:id", async (req, res) => {
    try {
      const { periodLabel, status } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (periodLabel) updates.periodLabel = periodLabel;
      if (status) updates.status = status;
      const [row] = await db.update(periodClose).set(updates).where(eq(periodClose.id, req.params.id)).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/admin/periods/:id", async (req, res) => {
    try {
      await db.delete(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, req.params.id));
      await db.delete(periodCloseBlockers).where(eq(periodCloseBlockers.periodId, req.params.id));
      await db.delete(periodCloseAuditTrail).where(eq(periodCloseAuditTrail.periodId, req.params.id));
      await db.delete(periodVariance).where(eq(periodVariance.periodId, req.params.id));
      await db.delete(contractCloseStatus).where(eq(contractCloseStatus.periodId, req.params.id));
      await db.delete(periodClose).where(eq(periodClose.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/admin/periods/:id/checklist", async (req, res) => {
    try {
      const rows = await db.select().from(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, req.params.id));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/admin/periods/:id/checklist", async (req, res) => {
    try {
      const { itemName, status, progressText } = req.body;
      const [row] = await db.insert(periodCloseChecklist).values({
        periodId: req.params.id,
        itemName,
        status: status || "idle",
        progressText: progressText || null,
      }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put("/api/admin/checklist/:id", async (req, res) => {
    try {
      const { itemName, status, progressText } = req.body;
      const updates: any = {};
      if (itemName) updates.itemName = itemName;
      if (status) updates.status = status;
      if (progressText !== undefined) updates.progressText = progressText;
      if (status === "completed") updates.completedAt = new Date();
      const [row] = await db.update(periodCloseChecklist).set(updates).where(eq(periodCloseChecklist.id, req.params.id)).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/admin/checklist/:id", async (req, res) => {
    try {
      await db.delete(periodCloseChecklist).where(eq(periodCloseChecklist.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/admin/period-audit-trail", async (_req, res) => {
    try {
      const rows = await db.select().from(periodCloseAuditTrail).orderBy(desc(periodCloseAuditTrail.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/admin/periods/:id/auto-populate", async (req, res) => {
    try {
      const periodId = req.params.id;
      const periodRow = await db.select().from(periodClose).where(eq(periodClose.id, periodId));
      if (!periodRow.length) return res.status(404).json({ error: "Period not found" });

      const filter = buildAccrualCompanyFilter(req);
      const allAccruals = filter
        ? await db.select().from(accruals).where(filter)
        : await db.select().from(accruals);
      const periodAccruals = allAccruals.filter(a => a.period === periodRow[0].periodLabel);

      for (const acc of periodAccruals) {
        const existing = await db.select().from(contractCloseStatus)
          .where(and(eq(contractCloseStatus.periodId, periodId), eq(contractCloseStatus.accrualId, acc.accrualId)));
        if (existing.length === 0) {
          const relatedJe = await db.select().from(journalEntries).where(eq(journalEntries.sourceAccrualId, acc.accrualId));
          const jeRow = relatedJe[0];
          await db.insert(contractCloseStatus).values({
            periodId,
            contractId: acc.contractId,
            accrualId: acc.accrualId,
            contractName: acc.contractName,
            counterparty: acc.counterparty,
            flowType: acc.flowType,
            accrualAmount: acc.amount,
            accrualStatus: acc.status,
            jeStatus: jeRow ? jeRow.jeStage : 'missing',
            erpSyncStatus: jeRow ? jeRow.erpSyncStatus : 'na',
            closeStatus: acc.status === 'posted' && jeRow?.jeStage === 'posted' ? 'complete' : 'partial',
          });
        }
      }

      const totalChecklist = await db.select().from(periodCloseChecklist).where(eq(periodCloseChecklist.periodId, periodId));
      const completedItems = totalChecklist.filter(c => c.status === 'completed').length;
      const score = totalChecklist.length > 0 ? Math.round((completedItems / totalChecklist.length) * 100) : 0;
      await db.update(periodClose).set({ readinessScore: score, updatedAt: new Date() }).where(eq(periodClose.id, periodId));

      res.json({ success: true, accrualsMapped: periodAccruals.length, readinessScore: score });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  function buildSettlementCompanyFilter(req: Request) {
    const activeContext = (req as any).user?.activeContext;
    const isSystemAdmin = (req as any).user?.isSystemAdmin === true;
    const userId = (req as any).user?.id;
    const companyId = activeContext?.companyId;
    const contractId = typeof req.query.contractId === "string" ? req.query.contractId.trim() : "";
    const baseFilter = companyId
      ? eq(settlements.companyId, companyId)
      : (!isSystemAdmin && userId ? eq(settlements.createdBy, userId) : undefined);
    if (!contractId) return baseFilter;
    const contractFilter = eq(settlements.contractId, contractId);
    return baseFilter ? and(baseFilter, contractFilter) : contractFilter;
  }

  router.get("/api/settlements", async (req, res) => {
    try {
      const filter = buildSettlementCompanyFilter(req);
      // Enrich each settlement with the contract's flow_type_code +
      // flow_type_name so the workspace tabs (which are now driven by
      // flow types, not the legacy settlement_type strings) can bucket
      // every row consistently. Uses a left join so settlements without
      // a contract link still come back; we then fall back to the legacy
      // settlement_type → flow_code map below.
      const baseQuery = db
        .select({
          settlement: settlements,
          contractFlowCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
        })
        .from(settlements)
        .leftJoin(contracts, eq(settlements.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .orderBy(desc(settlements.createdAt));
      const joined = filter ? await baseQuery.where(filter) : await baseQuery;

      // Roll up open deductions per contract in a single query so we can
      // tag each settlement card with `openDeductionCount` /
      // `openDeductionExposure` without N+1ing. Only deductions that still
      // need attention (not matched / written_off / recovered) and that are
      // attached to a contract are counted.
      const contractIds = Array.from(new Set(
        joined.map((r: any) => r.settlement?.contractId).filter(Boolean) as string[]
      ));
      const dedByContract = new Map<string, { count: number; exposure: number }>();
      if (contractIds.length > 0) {
        const dedRows = await db
          .select({
            contractId: deductions.contractId,
            count: sql<number>`count(*)::int`,
            exposure: sql<number>`coalesce(sum(${deductions.deductedAmount}::numeric), 0)::float`,
          })
          .from(deductions)
          .where(and(
            sql`${deductions.contractId} IN (${sql.join(contractIds.map(id => sql`${id}`), sql`, `)})`,
            sql`${deductions.status} NOT IN (${sql.join(DEDUCTION_CLOSED_STATUSES.map(s => sql`${s}`), sql`, `)})`,
          ))
          .groupBy(deductions.contractId);
        for (const d of dedRows) {
          if (d.contractId) dedByContract.set(d.contractId, { count: Number(d.count) || 0, exposure: Number(d.exposure) || 0 });
        }
      }

      const rows = joined.map((r: any) => {
        const fallback = LEGACY_SETTLEMENT_TYPE_TO_FLOW_CODE[r.settlement?.settlementType || ""];
        const flowTypeCode = r.contractFlowCode || fallback || null;
        const ded = (r.settlement?.contractId && dedByContract.get(r.settlement.contractId)) || null;
        return {
          ...r.settlement,
          flowTypeCode,
          flowTypeName: r.flowTypeName || null,
          openDeductionCount: ded?.count || 0,
          openDeductionExposure: ded?.exposure || 0,
        };
      });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/settlements/summary", async (req, res) => {
    try {
      const filter = buildSettlementCompanyFilter(req);
      const rows = filter
        ? await db.select().from(settlements).where(filter)
        : await db.select().from(settlements);
      const openItems = rows.filter(r => r.settlementStatus === 'open' || r.settlementStatus === 'partial').length;
      const totalAccrual = rows.reduce((s, r) => s + parseFloat(r.accrualAmount || "0"), 0);
      const totalClaims = rows.reduce((s, r) => s + parseFloat(r.claimAmount || "0"), 0);
      const netVariance = totalAccrual - totalClaims;
      const fullyMatched = rows.filter(r => r.matchStatus === 'fully_matched').length;
      const disputed = rows.filter(r => r.matchStatus === 'disputed').length;
      const postedToGl = rows.filter(r => r.settlementStatus === 'posted').reduce((s, r) => s + parseFloat(r.postedAmount || "0"), 0);
      const byType: Record<string, number> = {};
      rows.forEach(r => { byType[r.settlementType || 'other'] = (byType[r.settlementType || 'other'] || 0) + 1; });
      res.json({ openItems, totalAccrual, totalClaims, netVariance, fullyMatched, disputed, postedToGl, byType, total: rows.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/settlements/:id", async (req, res) => {
    try {
      // Mirror the list endpoint's enrichment so the detail pane gets the
      // canonical flow_type_code (CRP/VRP/RLA/...) from the contract instead
      // of the legacy free-form settlements.flow_type string ("Rebate" etc.).
      // Without this the workspace's direction-aware labels (Vendor vs
      // Customer claim) silently fall back to outbound for VRP rows.
      const rows = await db
        .select({
          settlement: settlements,
          contractFlowCode: contracts.flowTypeCode,
          flowTypeName: flowTypes.name,
        })
        .from(settlements)
        .leftJoin(contracts, eq(settlements.contractId, contracts.id))
        .leftJoin(flowTypes, eq(contracts.flowTypeCode, flowTypes.code))
        .where(eq(settlements.id, req.params.id));
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const fallback = LEGACY_SETTLEMENT_TYPE_TO_FLOW_CODE[rows[0].settlement?.settlementType || ""];
      // For inbound flows (VRP) the legacy `counterparty` column on
      // settlements stores the tenant company itself (e.g. "TechSound
      // Audio Inc."). The "other party" we actually want to label
      // ("Notify <vendor>", "Submit claim to <vendor>") is the
      // contract's owning_party. Resolve it once here so the detail
      // pane never has to call a second endpoint.
      let vendorPartyName: string | null = null;
      let vendorPartnerId: string | null = null;
      if (rows[0].settlement?.contractId) {
        const [owner] = await db
          .select({ partnerId: contractPartnerAssignments.partnerId, rawValue: contractPartnerAssignments.rawValue })
          .from(contractPartnerAssignments)
          .where(and(
            eq(contractPartnerAssignments.contractId, rows[0].settlement.contractId!),
            eq(contractPartnerAssignments.partyRole, "owning_party"),
          ))
          .limit(1);
        vendorPartnerId = owner?.partnerId || null;
        vendorPartyName = owner?.rawValue || null;
      }
      const settlement = {
        ...rows[0].settlement,
        flowTypeCode: rows[0].contractFlowCode || fallback || null,
        flowTypeName: rows[0].flowTypeName || null,
        vendorPartyName,
        vendorPartnerId,
      };
      const lineItems = await db.select().from(settlementLineItems).where(eq(settlementLineItems.settlementId, req.params.id));
      // Historic settlements stored either the inbound claim's UUID PK or
      // its human-readable claim_number (e.g. "CLM-MOJ5S4VR") in
      // settlements.claim_id. The deductions FK
      // (deductions.matched_claim_id → inbound_claims.id) only accepts the
      // UUID, so we resolve the canonical id here and surface it as
      // `inboundClaimId` for the UI's "Match to claim" action. Falls back
      // to null when no claim row can be found.
      let inboundClaimId: string | null = null;
      if (settlement.claimId) {
        const claimConds: any[] = [
          sql`(${inboundClaims.id} = ${settlement.claimId} OR ${inboundClaims.claimNumber} = ${settlement.claimId})`,
        ];
        if (settlement.companyId) claimConds.push(eq(inboundClaims.companyId, settlement.companyId));
        const [matchedClaim] = await db
          .select({ id: inboundClaims.id })
          .from(inboundClaims)
          .where(and(...claimConds))
          .limit(1);
        inboundClaimId = matchedClaim?.id || null;
      }
      // Pull the open (non-terminal, unmatched) deductions for this
      // settlement's contract so the detail pane can flag them. We scope
      // by both contractId and the settlement's companyId so a stray
      // deduction in a sibling tenant can never leak across.
      let openDeductions: any[] = [];
      if (settlement.contractId) {
        const conds: any[] = [
          eq(deductions.contractId, settlement.contractId),
          sql`${deductions.status} NOT IN (${sql.join(DEDUCTION_CLOSED_STATUSES.map(s => sql`${s}`), sql`, `)})`,
        ];
        if (settlement.companyId) conds.push(eq(deductions.companyId, settlement.companyId));
        openDeductions = await db
          .select({
            id: deductions.id,
            deductionNumber: deductions.deductionNumber,
            partnerName: deductions.partnerName,
            deductedAmount: deductions.deductedAmount,
            currency: deductions.currency,
            deductionDate: deductions.deductionDate,
            reasonCode: deductions.reasonCode,
            originalInvoiceRef: deductions.originalInvoiceRef,
            status: deductions.status,
          })
          .from(deductions)
          .where(and(...conds))
          .orderBy(desc(deductions.deductionDate))
          .limit(50);
      }
      res.json({ ...settlement, lineItems, openDeductions, inboundClaimId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Timeline / supporting data for the settlement detail tabs (Posting
  // Instructions, History & Audit, Evidence Docs). Returned shape:
  //   {
  //     journalEntries: [{ ...je, lines: [...] }],
  //     claimEvents:    [...inbound_claim_events for the linked claim],
  //     documents:      [...finance_documents linked by source_claim_id or je_id],
  //     claim:          { id, claimNumber, sourceChannel, sourceEventId,
  //                       externalClaimId, status, rawPayload } | null,
  //   }
  // We match JEs to a settlement primarily by `sourceAccrualId` (the
  // accrual that bred this settlement), but fall back to
  // counterparty + contract_name when sourceAccrualId is empty (which
  // is the case for legacy rebate JEs and the residual JEs we post
  // here, both of which use je_id prefixes instead). The residual JE
  // we post embeds the settlement id in its je_id (RESID-<8-char>...)
  // which is the canonical link.
  router.get("/api/settlements/:id/timeline", async (req, res) => {
    try {
      const [settlement] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
      if (!settlement) return res.status(404).json({ error: "Not found" });

      // 1) Journal entries: pull anything tagged with this settlement id
      // in its je_id (residual JEs) plus anything matching the
      // counterparty + contract_name pair (the original rebate JE).
      const settIdShort = settlement.id.slice(0, 8).toUpperCase();
      const jeRows = await db.select().from(journalEntries)
        .where(and(
          settlement.companyId
            ? eq(journalEntries.companyId, settlement.companyId)
            : sql`1=1`,
          sql`(
            ${journalEntries.jeId} ILIKE ${'RESID-' + settIdShort + '%'}
            OR (
              ${journalEntries.counterparty} = ${settlement.counterparty}
              AND ${journalEntries.contractName} = ${settlement.contractName}
              AND ${journalEntries.period} = ${settlement.period}
            )
          )`,
        ))
        .orderBy(journalEntries.createdAt);

      // Pull lines for all JEs in one shot
      const jeIds = jeRows.map(j => j.jeId);
      const lineRows = jeIds.length
        ? await db.select().from(journalEntryLines)
            .where(sql`${journalEntryLines.jeId} IN (${sql.join(jeIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      const linesByJe = new Map<string, any[]>();
      for (const l of lineRows) {
        const arr = linesByJe.get(l.jeId) || [];
        arr.push(l);
        linesByJe.set(l.jeId, arr);
      }
      const jesWithLines = jeRows.map(je => ({
        ...je,
        lines: linesByJe.get(je.jeId) || [],
      }));

      // 2) Resolve the linked inbound claim (UUID or claim_number),
      //    then fetch its events.
      let claim: any = null;
      let claimEvents: any[] = [];
      if (settlement.claimId) {
        const claimConds: any[] = [
          sql`(${inboundClaims.id} = ${settlement.claimId} OR ${inboundClaims.claimNumber} = ${settlement.claimId})`,
        ];
        if (settlement.companyId) claimConds.push(eq(inboundClaims.companyId, settlement.companyId));
        const [c] = await db.select().from(inboundClaims).where(and(...claimConds)).limit(1);
        if (c) {
          claim = {
            id: c.id,
            claimNumber: c.claimNumber,
            status: c.status,
            sourceChannel: c.sourceChannel,
            sourceEventId: c.sourceEventId,
            externalClaimId: c.externalClaimId,
            disputeState: c.disputeState,
            disputeReason: c.disputeReason,
            createdAt: c.createdAt,
            approvedAt: c.approvedAt,
            approvedBy: c.approvedBy,
            rawPayload: c.rawPayload,
          };
          claimEvents = await db.select().from(inboundClaimEvents)
            .where(eq(inboundClaimEvents.claimId, c.id))
            .orderBy(inboundClaimEvents.createdAt);
        }
      }

      // 3) Finance documents linked to this settlement (credit memos
      //    issued for the source claim, or any document tagged with one
      //    of the JEs we just collected).
      const docConds: any[] = [];
      if (claim?.id) docConds.push(eq(financeDocuments.sourceClaimId, claim.id));
      if (jeIds.length) {
        docConds.push(sql`${financeDocuments.jeId} IN (${sql.join(jeIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const documents = docConds.length
        ? await db.select().from(financeDocuments)
            .where(sql`(${sql.join(docConds, sql` OR `)})`)
            .orderBy(desc(financeDocuments.createdAt))
        : [];

      res.json({ journalEntries: jesWithLines, claimEvents, documents, claim });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/settlements", async (req, res) => {
    try {
      const user = (req as any).user;
      const [row] = await db.insert(settlements).values({
        ...req.body,
        companyId: user?.activeContext?.companyId,
        createdBy: user?.id,
      }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/api/settlements/:id", async (req, res) => {
    try {
      const incomingStatus: string | undefined = req.body?.settlementStatus;
      // Approval gate: when the caller is moving the settlement into a
      // status that implies finance has signed off (approved / partial /
      // posted), and the settlement is matched to an inbound claim, the
      // claim itself must already be approved or partial-approved.
      // Settlements with no claim attached (pure internal accrual settle)
      // bypass the gate.
      if (incomingStatus && APPROVAL_LOCKED_SETTLEMENT_STATUSES.has(incomingStatus)) {
        const [current] = await db.select().from(settlements)
          .where(eq(settlements.id, req.params.id));
        if (!current) return res.status(404).json({ error: "Settlement not found" });
        if (current.claimId) {
          const [claim] = await db.select().from(inboundClaims)
            .where(eq(inboundClaims.id, current.claimId));
          if (claim && !CLAIM_STATUSES_OK_TO_SETTLE.has(claim.status || "")) {
            return res.status(409).json({
              error: "Cannot settle: linked claim is not approved",
              claimStatus: claim.status,
              hint: "Approve or partial-approve the claim first.",
            });
          }
        }
      }
      const [row] = await db.update(settlements)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(settlements.id, req.params.id))
        .returning();

      // Auto-clear sub-materiality residual on partial settlement.
      // Only fires when the caller flipped status into `partial` (the
      // moment a sub-materiality variance gets parked). Tolerance comes
      // from company_settings.settlementPolicies — both the dollar cap
      // and the percent-of-accrual cap must be satisfied. Any failure
      // inside the helper is swallowed (best-effort): the user can still
      // click "Clear Residual" on the detail and we surface a console
      // warning so we can find regressions in the dev logs.
      // Auto-clear fires on any sign-off transition that leaves a
      // positive over-accrual on the books — Accept Customer Claim
      // ("approved") and Partial Settlement ("partial") both qualify.
      // Settle at Internal Accrual also lands in "approved" but its
      // claim ≤ accrual check inside the helper is what gates the
      // posting, so a no-residual case short-circuits cleanly.
      let autoClear: ClearResidualResult | null = null;
      if (row && (incomingStatus === "partial" || incomingStatus === "approved")) {
        try {
          const policies = await loadSettlementPolicies(row.companyId);
          if (policies.varianceAutoClearEnabled) {
            const accrual = parseFloat(row.accrualAmount || "0");
            const claim = parseFloat(row.claimAmount || "0");
            const residual = +(accrual - claim).toFixed(2);
            const pctOfAccrual = accrual > 0 ? (Math.abs(residual) / accrual) * 100 : 0;
            const withinAbs = policies.varianceMaxAbsAmount > 0 && Math.abs(residual) <= policies.varianceMaxAbsAmount;
            const withinPct = policies.varianceMaxPct > 0 && pctOfAccrual <= policies.varianceMaxPct;
            // Both caps must be configured AND satisfied. We deliberately
            // require the caller to opt into BOTH so a stray 0 in one
            // field doesn't accidentally green-light a $1M residual.
            if (residual > 0.01 && withinAbs && withinPct) {
              autoClear = await clearSettlementResidual({
                settlementId: row.id,
                userId: (req as any).user?.id || null,
                auto: true,
              });
            }
          }
        } catch (autoErr) {
          console.warn("[settlement auto-clear] skipped:", autoErr instanceof Error ? autoErr.message : autoErr);
        }
      }

      // If auto-clear ran, re-read the settlement so the caller sees the
      // updated postedAmount / settlementStatus / jeId without a second
      // round-trip.
      if (autoClear?.cleared) {
        const [refreshed] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
        return res.json({ ...(refreshed || row), autoClear });
      }
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Manual residual-clear, fired from the "Clear Residual" button on the
  // settlement detail. Returns 409 with a `reason` when the helper short
  // -circuits so the UI can show a precise toast (already cleared, no
  // residual to clear, status not eligible) instead of a generic error.
  router.post("/api/settlements/:id/clear-residual", async (req, res) => {
    try {
      const result = await clearSettlementResidual({
        settlementId: req.params.id,
        userId: (req as any).user?.id || null,
        auto: false,
      });
      if (result.cleared !== true) {
        const skipped = result.skipped;
        const httpStatus = skipped === "missing_settlement" ? 404 : 409;
        return res.status(httpStatus).json({
          error: "Nothing to clear",
          reason: skipped,
          residual: result.residual,
        });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==============================
  // INBOUND-FLOW (VRP) SETTLEMENT ACTIONS
  // ==============================
  // The three endpoints below implement the cash-direction-inbound side
  // of the settlement workspace decision bar. Outbound (CRP) settlements
  // continue to use PATCH /api/settlements/:id with a settlementStatus
  // transition because the work there is "approve a customer claim";
  // inbound flows instead generate a claim *we* send to the supplier,
  // so each action posts a JE plus a side artifact (deduction row,
  // claim ref, etc.) up front.

  // VRP — Submit Claim to Vendor.
  // Reclassifies the accrued vendor rebate from a P&L accrual into a
  // cash receivable: Dr Vendor Rebate Receivable / Cr Accrued Vendor
  // Rebate. The settlement moves to `approved` (finance has formally
  // signed off on the number we're claiming) but stays unposted until
  // the supplier confirms via record-vendor-confirmation.
  router.post("/api/settlements/:id/submit-vendor-claim", async (req, res) => {
    try {
      const [s] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
      if (!s) return res.status(404).json({ error: "Settlement not found" });
      const accrual = parseFloat(s.accrualAmount || "0");
      if (accrual <= 0) {
        return res.status(409).json({ error: "Nothing to claim — accrual is $0" });
      }
      const amt = accrual.toFixed(2);
      const jeIdStr = `VRPCLM-${(s.id || "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const [jeRow] = await db.insert(journalEntries).values({
        jeId: jeIdStr,
        contractId: s.contractId || null,
        contractName: s.contractName || null,
        counterparty: s.counterparty || null,
        flowType: "vendor_claim_submitted",
        period: s.period || new Date().toISOString().slice(0, 7),
        totalAmount: amt,
        jeStage: "draft",
        erpSyncStatus: "na",
        balanced: true,
        companyId: s.companyId || null,
        createdBy: (req as any).user?.id || null,
      } as never).returning();
      const desc = `Vendor rebate claim submitted — settlement ${s.id}`;
      await db.insert(journalEntryLines).values([
        { jeId: jeIdStr, accountCode: "1240", accountName: "Vendor Rebate Receivable", debitAmount: amt, creditAmount: "0", description: desc } as never,
        { jeId: jeIdStr, accountCode: "2155", accountName: "Accrued Vendor Rebate", debitAmount: "0", creditAmount: amt, description: desc } as never,
      ]);
      const claimRef = `VRP-CLAIM-${(s.id || "").slice(0, 8).toUpperCase()}`;
      // Resolve the vendor (owning_party for inbound flows) so the
      // outbound obligation we mint below attaches to the correct partner.
      let vendorPartnerId: string | null = null;
      let vendorName: string | null = null;
      if (s.contractId) {
        const [owner] = await db.select().from(contractPartnerAssignments)
          .where(and(
            eq(contractPartnerAssignments.contractId, s.contractId),
            eq(contractPartnerAssignments.partyRole, "owning_party"),
          ))
          .limit(1);
        vendorPartnerId = owner?.partnerId || null;
        vendorName = owner?.rawValue || null;
      }
      // Mint an outbound obligation so the vendor claim shows up in
      // Claims Workspace alongside other recovery claims (and inherits
      // the document-generation, evidence, and dispute workflows that
      // already exist there). The settlement remains the books-side
      // record; the obligation is the operational record.
      const [obl] = await db.insert(obligations).values({
        contractId: s.contractId!,
        partnerId: vendorPartnerId,
        partnerName: vendorName || s.counterparty || null,
        kind: "rebate_settlement",
        amount: amt,
        outstandingAmount: amt,
        currency: "USD",
        fundingPeriod: s.period || null,
        status: "claim_submitted",
        claimedAmount: amt,
        claimedAt: new Date(),
        claimReference: claimRef,
        direction: "outbound",
        sourceChannel: "vrp_settlement",
        notes: `Generated from VRP settlement ${s.id} (Submit Claim to Vendor)`,
        linkedJournalEntryId: (jeRow as any)?.id || null,
        companyId: s.companyId || null,
        createdBy: (req as any).user?.id || null,
      } as never).returning();
      await db.insert(obligationEvents).values({
        obligationId: obl.id,
        eventType: "claim_submitted",
        fromStatus: null,
        toStatus: "claim_submitted",
        amount: amt,
        description: `Vendor rebate claim ${claimRef} submitted to ${vendorName || s.counterparty || "vendor"} for ${amt}`,
        userId: (req as any).user?.id || null,
        userName: (req as any).user?.name || null,
      } as never);
      // claimAmount now equals accrualAmount → variance MUST be 0.
      // Without this the workspace keeps showing the pre-submit
      // "$36K below our accrual" delta forever.
      const [updated] = await db.update(settlements).set({
        resolution: "submit_vendor_claim",
        settlementStatus: "approved",
        claimAmount: amt,
        variance: "0.00",
        claimRef,
        jeId: s.jeId || jeIdStr,
        updatedAt: new Date(),
      } as never).where(eq(settlements.id, s.id)).returning();
      res.json({ settlement: updated, jeId: jeIdStr, claimRef, amount: amt, obligationId: obl.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // VRP — Take Deduction.
  // Net the rebate off the supplier's next AP invoice instead of
  // collecting cash. Creates a deductions row keyed to the vendor +
  // contract and posts Dr A/P / Cr Accrued Vendor Rebate. The
  // settlement is marked `posted` immediately because the deduction
  // is a self-help recovery (no waiting on supplier confirmation).
  router.post("/api/settlements/:id/apply-deduction", async (req, res) => {
    try {
      const [s] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
      if (!s) return res.status(404).json({ error: "Settlement not found" });
      const accrual = parseFloat(s.accrualAmount || "0");
      if (accrual <= 0) {
        return res.status(409).json({ error: "Nothing to deduct — accrual is $0" });
      }
      // Resolve the vendor (owning_party for inbound flows) so the
      // deduction row attaches to the correct partner.
      let vendorPartnerId: string | null = null;
      let vendorName: string | null = null;
      if (s.contractId) {
        const [owner] = await db.select().from(contractPartnerAssignments)
          .where(and(
            eq(contractPartnerAssignments.contractId, s.contractId),
            eq(contractPartnerAssignments.partyRole, "owning_party"),
          ))
          .limit(1);
        vendorPartnerId = owner?.partnerId || null;
        vendorName = owner?.rawValue || null;
      }
      const amt = accrual.toFixed(2);
      const dedNumber = `DED-${(s.id || "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const [ded] = await db.insert(deductions).values({
        companyId: s.companyId || null,
        partnerId: vendorPartnerId,
        partnerName: vendorName || s.counterparty || null,
        contractId: s.contractId || null,
        contractName: s.contractName || null,
        deductionNumber: dedNumber,
        deductedAmount: amt,
        currency: "USD",
        reasonText: `Vendor rebate deduction — settlement ${s.id}`,
        status: "matched",
        sourceChannel: "settlement_workspace",
        createdBy: (req as any).user?.id || null,
      } as never).returning();
      const jeIdStr = `VRPDED-${(s.id || "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      await db.insert(journalEntries).values({
        jeId: jeIdStr,
        contractId: s.contractId || null,
        contractName: s.contractName || null,
        counterparty: vendorName || s.counterparty || null,
        flowType: "vendor_deduction_applied",
        period: s.period || new Date().toISOString().slice(0, 7),
        totalAmount: amt,
        jeStage: "draft",
        erpSyncStatus: "na",
        balanced: true,
        companyId: s.companyId || null,
        createdBy: (req as any).user?.id || null,
      } as never);
      const desc = `Vendor rebate deduction — settlement ${s.id}`;
      await db.insert(journalEntryLines).values([
        { jeId: jeIdStr, accountCode: "2100", accountName: "Accounts Payable - Vendor", debitAmount: amt, creditAmount: "0", description: desc } as never,
        { jeId: jeIdStr, accountCode: "2155", accountName: "Accrued Vendor Rebate", debitAmount: "0", creditAmount: amt, description: desc } as never,
      ]);
      const [updated] = await db.update(settlements).set({
        resolution: "apply_deduction",
        settlementStatus: "posted",
        claimAmount: amt,
        postedAmount: amt,
        // claimAmount==accrualAmount → variance is 0, recorded so the
        // workspace doesn't keep showing the pre-deduction delta.
        variance: "0.00",
        matchStatus: "fully_matched",
        matchPct: 100,
        jeId: s.jeId || jeIdStr,
        updatedAt: new Date(),
      } as never).where(eq(settlements.id, s.id)).returning();
      res.json({ settlement: updated, jeId: jeIdStr, deductionNumber: dedNumber, deductionId: (ded as any)?.id, amount: amt });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // VRP — Record Vendor Confirmation.
  // Closes out a previously-submitted vendor claim once the supplier
  // confirms / pays. Marks the settlement posted and (idempotently)
  // sets postedAmount = claimAmount so the receivable JE clears on
  // the GL reconciliation view.
  router.post("/api/settlements/:id/record-vendor-confirmation", async (req, res) => {
    try {
      const [s] = await db.select().from(settlements).where(eq(settlements.id, req.params.id));
      if (!s) return res.status(404).json({ error: "Settlement not found" });
      const claim = parseFloat(s.claimAmount || "0");
      if (claim <= 0) {
        return res.status(409).json({ error: "Submit the vendor claim first" });
      }
      const [updated] = await db.update(settlements).set({
        settlementStatus: "posted",
        postedAmount: claim.toFixed(2),
        matchStatus: "fully_matched",
        matchPct: 100,
        updatedAt: new Date(),
      } as never).where(eq(settlements.id, s.id)).returning();
      res.json({ settlement: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/settlements/:id", async (req, res) => {
    try {
      await db.delete(settlementLineItems).where(eq(settlementLineItems.settlementId, req.params.id));
      await db.delete(settlements).where(eq(settlements.id, req.params.id));
      res.json({ deleted: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/settlements/:id/line-items", async (req, res) => {
    try {
      const rows = await db.select().from(settlementLineItems).where(eq(settlementLineItems.settlementId, req.params.id));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/settlements/:id/line-items", async (req, res) => {
    try {
      const [row] = await db.insert(settlementLineItems).values({ ...req.body, settlementId: req.params.id }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
