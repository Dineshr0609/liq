import { db } from "../db";
import {
  settlements, settlementLineItems, accruals,
  inboundClaims, inboundClaimEvents,
} from "@shared/schema";
import { and, eq, desc, isNotNull, ne } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type InboundClaim = InferSelectModel<typeof inboundClaims>;

/**
 * Variance tolerance (percent). Mirrors the client constant in
 * `client/src/pages/settlement-workspace.tsx` (VARIANCE_TOLERANCE_PCT).
 * If the two diverge the workspace would label settlements differently
 * than the auto-matcher does — keep them in lock-step.
 */
const VARIANCE_TOLERANCE_PCT = 1;

function computeMatchStatus(accrualAmount: number, claimAmount: number): string {
  if (accrualAmount === 0 && claimAmount === 0) return "open";
  // Claim exists but we have no accrual to compare against — treat as
  // partial so it surfaces in the "needs attention" filter.
  if (accrualAmount === 0) return "partial";
  const variance = Math.abs(accrualAmount - claimAmount);
  if ((variance / accrualAmount) * 100 <= VARIANCE_TOLERANCE_PCT) return "fully_matched";
  return "partial";
}

function shortClaimRef(claim: InboundClaim): string {
  if (claim.externalClaimId) return claim.externalClaimId;
  return `CLM-${claim.id.slice(0, 8).toUpperCase()}`;
}

/**
 * Distribute the parent settlement's claim amount across its line items.
 *
 *  - Single line  → entire claim goes to that line.
 *  - Multiple lines → claim is split proportionally to each line's accrual
 *    share. If no line carries an accrual, split equally.
 *  - No lines     → no-op.
 *
 * Each line's `variance`, `status`, and `claim_amount` are updated.
 * Status mirrors the parent matchStatus rule (1% tolerance).
 */
async function distributeClaimAcrossLines(
  settlementId: string,
  totalClaim: number,
): Promise<void> {
  const lines = await db.select().from(settlementLineItems)
    .where(eq(settlementLineItems.settlementId, settlementId));
  if (!lines.length) return;

  const totalAccrual = lines.reduce((s, l) => s + parseFloat(l.accrualAmount || "0"), 0);

  for (const line of lines) {
    const lineAccrual = parseFloat(line.accrualAmount || "0");
    let lineClaim: number;
    if (lines.length === 1) {
      lineClaim = totalClaim;
    } else if (totalAccrual > 0) {
      lineClaim = totalClaim * (lineAccrual / totalAccrual);
    } else {
      lineClaim = totalClaim / lines.length;
    }
    const variance = lineAccrual - lineClaim;
    const status =
      lineAccrual === 0 && lineClaim === 0
        ? "pending"
        : lineAccrual === 0
        ? "partial"
        : (Math.abs(variance) / lineAccrual) * 100 <= VARIANCE_TOLERANCE_PCT
        ? "matched"
        : "partial";
    await db.update(settlementLineItems).set({
      claimAmount: lineClaim.toFixed(2),
      variance: variance.toFixed(2),
      status,
    } as any).where(eq(settlementLineItems.id, line.id));
  }
}

export interface AutoAttachResult {
  settlementId: string;
  created: boolean;
  matchStatus: string;
  accrualAmount: number;
  claimAmount: number;
}

export interface AutoAttachOpts {
  /**
   * When true, prefer the claim's `approvedAmount` over `claimedAmount`
   * for populating the settlement. Used after finance approves /
   * partial-approves an inbound claim — the settlement should reflect
   * what was actually agreed, not the original ask.
   *
   * Falls back to `claimedAmount` when `approvedAmount` is null/0,
   * which keeps the call safe to make defensively from anywhere.
   */
  useApprovedAmount?: boolean;
}

/**
 * After a new (or updated) inbound claim is persisted, try to attach it
 * to a settlement keyed on (contract_id, period). Creates the settlement
 * row if none exists yet, otherwise stamps the claim onto the existing
 * one and recomputes variance / matchStatus.
 *
 * Skipped when:
 *  - the claim has no contract_id or no period (cannot key a settlement)
 *  - the claim is still in `needs_review` — let a human confirm the
 *    contract/partner resolution before we mutate settlement rows
 *  - an existing settlement for that key is already linked to a *different*
 *    claim — leave the human-curated linkage alone
 *
 * Idempotent: re-running for the same claim is a no-op.
 *
 * Returns null when skipped, otherwise the settlement id and the new
 * match status.
 */
export async function autoAttachClaimToSettlement(
  claim: InboundClaim,
  opts: AutoAttachOpts = {},
): Promise<AutoAttachResult | null> {
  if (!claim.contractId || !claim.period) return null;
  if (claim.status === "needs_review") return null;

  // Prefer the approved amount once finance has acted on the claim.
  // We treat "0 / null" as "no approval yet" and fall through to the
  // original claimed amount.
  const approvedAmount = parseFloat(claim.approvedAmount || "0");
  const useApproved = !!opts.useApprovedAmount && approvedAmount > 0;
  const claimAmount = useApproved
    ? approvedAmount
    : parseFloat(claim.claimedAmount || "0");

  // Latest settlement for (contract, period) — same scope the workspace uses.
  const [existing] = await db
    .select()
    .from(settlements)
    .where(and(
      eq(settlements.contractId, claim.contractId),
      eq(settlements.period, claim.period),
    ))
    .orderBy(desc(settlements.createdAt))
    .limit(1);

  // Pull the latest accrual so we can pre-populate the "Our Accrual" side.
  // Missing accrual is OK — settlement just gets accrualAmount = 0.
  const [accrualRow] = await db
    .select()
    .from(accruals)
    .where(and(
      eq(accruals.contractId, claim.contractId),
      eq(accruals.period, claim.period),
    ))
    .orderBy(desc(accruals.createdAt))
    .limit(1);
  const accrualFromTable = accrualRow ? parseFloat(accrualRow.amount || "0") : 0;

  const claimRef = shortClaimRef(claim);

  if (existing) {
    // Don't clobber a different *real* claim that's already linked.
    // Seeded settlements often carry a synthetic claim_id placeholder
    // (e.g. "CLM-MOHRYCAG") that does not correspond to any actual
    // inbound_claims row — those should be treated as "unbound" so the
    // first real claim that arrives can take ownership. Likewise, a
    // claim that's been rejected or expired is "dead" and should not
    // hold the settlement hostage — otherwise a corrected (re-filed)
    // claim has nowhere to attach and the workspace keeps showing the
    // old rejected amount forever.
    const DEAD_CLAIM_STATUSES = new Set(["rejected", "expired"]);
    if (existing.claimId && existing.claimId !== claim.id) {
      const [linked] = await db.select({ id: inboundClaims.id, status: inboundClaims.status })
        .from(inboundClaims).where(eq(inboundClaims.id, existing.claimId)).limit(1);
      if (linked && !DEAD_CLAIM_STATUSES.has(linked.status || "")) return null;
    }

    const existingAccrual = parseFloat(existing.accrualAmount || "0");
    // Prefer the existing accrual on the settlement (someone may have
    // adjusted it manually); fall back to the freshly-pulled one.
    const finalAccrual = existingAccrual || accrualFromTable;
    const finalVariance = finalAccrual - claimAmount;
    const finalMatchStatus = computeMatchStatus(finalAccrual, claimAmount);

    // No idempotency short-circuit on the parent: even when the parent
    // numbers haven't changed, the line items may still be stale (a prior
    // version of this matcher only updated the header). Always re-run
    // both updates — the writes are cheap and the operation is fully
    // deterministic given the inputs.
    //
    // Cast to `any` to bypass Drizzle's known-broken inferred insert/update
    // types in this project (matches the pattern used in financeRoutes.ts
    // for the existing settlement endpoints).
    await db.update(settlements).set({
      claimId: claim.id,
      claimRef,
      claimAmount: claimAmount.toFixed(2),
      accrualAmount: finalAccrual.toFixed(2),
      variance: finalVariance.toFixed(2),
      matchStatus: finalMatchStatus,
      updatedAt: new Date(),
    } as any).where(eq(settlements.id, existing.id));

    // Mirror the claim onto the line-item rows so the workspace's "Line
    // Item Comparison" table doesn't keep showing $0 customer claim.
    await distributeClaimAcrossLines(existing.id, claimAmount);

    return {
      settlementId: existing.id,
      created: false,
      matchStatus: finalMatchStatus,
      accrualAmount: finalAccrual,
      claimAmount,
    };
  }

  // No settlement yet — create one keyed to this contract+period.
  const variance = accrualFromTable - claimAmount;
  const matchStatus = computeMatchStatus(accrualFromTable, claimAmount);
  const [created] = await db.insert(settlements).values({
    counterparty: claim.partnerName || "Unknown Partner",
    contractId: claim.contractId,
    contractName: claim.contractName,
    claimId: claim.id,
    claimRef,
    // Default settlement type aligned with the schema default; the
    // workspace lets users re-bucket later if needed.
    settlementType: "customer_rebates",
    period: claim.period,
    accrualAmount: accrualFromTable.toFixed(2),
    claimAmount: claimAmount.toFixed(2),
    variance: variance.toFixed(2),
    matchStatus,
    settlementStatus: "open",
    companyId: claim.companyId,
  } as any).returning();

  // Brand-new settlements rarely have line items yet, but call defensively
  // in case a downstream process pre-seeds them.
  await distributeClaimAcrossLines(created.id, claimAmount);

  return {
    settlementId: created.id,
    created: true,
    matchStatus,
    accrualAmount: accrualFromTable,
    claimAmount,
  };
}

/**
 * Backfill: attach every eligible inbound claim that doesn't already
 * have a settlement linked. Returns counts for logging.
 */
export async function backfillAutoAttachSettlements(): Promise<{
  scanned: number;
  attached: number;
  created: number;
  skipped: number;
}> {
  const eligible = await db
    .select()
    .from(inboundClaims)
    .where(and(
      isNotNull(inboundClaims.contractId),
      isNotNull(inboundClaims.period),
      ne(inboundClaims.status, "needs_review"),
    ));

  let attached = 0;
  let created = 0;
  let skipped = 0;
  for (const c of eligible) {
    try {
      const r = await autoAttachClaimToSettlement(c);
      if (!r) { skipped++; continue; }
      attached++;
      if (r.created) created++;
    } catch {
      skipped++;
    }
  }
  return { scanned: eligible.length, attached, created, skipped };
}
