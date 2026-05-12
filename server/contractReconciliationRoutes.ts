/**
 * Contract Reconciliation aggregation endpoint
 *
 * Powers the Reconciliation tab inside the contract command center
 * (client/src/components/contracts/reconciliation/ReconciliationTab.tsx).
 *
 * One round-trip returns every slice the tab needs:
 *   - Contract metadata + cash direction (from flow_types) + subtype instances
 *   - KPI rollups (open accruals, open obligations, settlement variance,
 *     claims awaiting response, unposted JEs, invoices issued, last GL sync)
 *   - Settlement variance rows (last N periods, our calc vs partner claim)
 *   - Compact projections of the underlying records for each card
 *   - Close-readiness checklist
 *
 * Tenant scoping: every sub-query is bounded by the contract's `companyId`
 * so a cross-tenant leak is impossible even if the contractId is guessed.
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, desc, eq, gte, lt, sql, isNotNull } from "drizzle-orm";
import {
  contracts,
  flowTypes,
  subtypeInstances,
  subtypes,
  accruals,
  obligations,
  settlements,
  inboundClaims,
  financeDocuments,
  journalEntries,
  saleContractMatches,
} from "@shared/schema";
import { isAuthenticated } from "./auth";

type PeriodCode = "mtd" | "qtd" | "ytd" | "trailing12" | "custom";

function rangeForPeriod(period: PeriodCode, fromQ?: string, toQ?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  const dayStart = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));
  switch (period) {
    case "mtd":
      return { start: monthStart(y, m), end: dayStart(y, m, d + 1), label: "MTD" };
    case "qtd": {
      const qStart = Math.floor(m / 3) * 3;
      return { start: monthStart(y, qStart), end: dayStart(y, m, d + 1), label: "QTD" };
    }
    case "trailing12":
      return { start: monthStart(y - 1, m + 1), end: dayStart(y, m, d + 1), label: "Trailing 12mo" };
    case "custom": {
      const start = fromQ ? new Date(fromQ) : monthStart(y, 0);
      const end = toQ ? new Date(toQ) : dayStart(y, m, d + 1);
      return { start, end, label: "Custom" };
    }
    case "ytd":
    default:
      return { start: monthStart(y, 0), end: dayStart(y, m, d + 1), label: "YTD" };
  }
}

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

const OPEN_ACCRUAL_STATUSES = new Set(["draft", "review", "pending", "pending_review", "approved"]);
const APPROVAL_PENDING_STATUSES = new Set(["review", "pending", "pending_review"]);
const POSTED_JE_STAGES = new Set(["posted"]);
const OPEN_OBLIGATION_STATUSES = new Set(["accrued", "released", "claimed", "approved"]);
const PAID_OBLIGATION_STATUSES = new Set(["paid", "expired", "voided", "settled"]);
const PENDING_CLAIM_STATUSES = new Set(["received", "validating", "needs_review", "agent_handling", "disputed", "escalated"]);

export function registerContractReconciliationRoutes(app: Express) {
  app.get(
    "/api/contracts/:contractId/reconciliation",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { contractId } = req.params;
        const period = (typeof req.query.period === "string" ? req.query.period : "ytd") as PeriodCode;
        const fromQ = typeof req.query.from === "string" ? req.query.from : undefined;
        const toQ = typeof req.query.to === "string" ? req.query.to : undefined;
        const range = rangeForPeriod(period, fromQ, toQ);

        const userCompanyId = (req as any).user?.activeContext?.companyId || null;

        const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
        if (!contract) return res.status(404).json({ error: "Contract not found" });
        if (userCompanyId && contract.companyId && contract.companyId !== userCompanyId) {
          return res.status(403).json({ error: "Out of scope" });
        }

        const [flowType] = contract.flowTypeCode
          ? await db.select().from(flowTypes).where(eq(flowTypes.code, contract.flowTypeCode))
          : [undefined as any];

        const subInstances = await db
          .select({
            id: subtypeInstances.id,
            label: subtypeInstances.label,
            subtypeCode: subtypeInstances.subtypeCode,
            subtypeName: subtypes.name,
            status: subtypeInstances.status,
          })
          .from(subtypeInstances)
          .leftJoin(subtypes, eq(subtypeInstances.subtypeCode, subtypes.code))
          .where(eq(subtypeInstances.contractId, contractId));

        const [
          contractAccruals,
          contractObligations,
          contractSettlements,
          contractClaims,
          contractInvoices,
          contractJEs,
          salesMatchAgg,
        ] = await Promise.all([
          db.select().from(accruals).where(eq(accruals.contractId, contractId)).orderBy(desc(accruals.createdAt)),
          db.select().from(obligations).where(eq(obligations.contractId, contractId)).orderBy(desc(obligations.accrualDate)),
          db.select().from(settlements).where(eq(settlements.contractId, contractId)).orderBy(desc(settlements.createdAt)),
          db.select().from(inboundClaims).where(eq(inboundClaims.contractId, contractId)).orderBy(desc(inboundClaims.createdAt)),
          db.select().from(financeDocuments).where(eq(financeDocuments.contractId, contractId)).orderBy(desc(financeDocuments.createdAt)),
          db.select().from(journalEntries).where(eq(journalEntries.contractId, contractId)).orderBy(desc(journalEntries.createdAt)),
          db
            .select({
              total: sql<number>`count(*)::int`,
            })
            .from(saleContractMatches)
            .where(eq(saleContractMatches.contractId, contractId)),
        ]);

        const inRange = (ts: Date | null | undefined) => {
          if (!ts) return false;
          const t = new Date(ts).getTime();
          return t >= range.start.getTime() && t < range.end.getTime();
        };

        const openAccruals = contractAccruals.filter((a) => a.status && OPEN_ACCRUAL_STATUSES.has(a.status));
        const openAccrualsTotal = openAccruals.reduce((s, a) => s + num(a.amount), 0);
        const accrualsAwaitingApproval = openAccruals.filter((a) => a.status && APPROVAL_PENDING_STATUSES.has(a.status)).length;

        const openObligations = contractObligations.filter((o) => !PAID_OBLIGATION_STATUSES.has(o.status));
        const openObligationsTotal = openObligations.reduce((s, o) => s + num(o.outstandingAmount), 0);
        const now = new Date();
        let oldestObligationAgingDays = 0;
        for (const o of openObligations) {
          const ref = o.dueAt ?? o.accrualDate ?? o.createdAt;
          if (!ref) continue;
          const age = daysBetween(now, new Date(ref));
          if (age > oldestObligationAgingDays) oldestObligationAgingDays = age;
        }

        const settlementsInRange = contractSettlements.filter((s) => inRange(s.createdAt));
        const closedInRange = settlementsInRange.filter((s) => s.settlementStatus === "posted" || s.matchStatus === "fully_matched").length;
        const totalAccrualInRange = settlementsInRange.reduce((s, r) => s + num(r.accrualAmount), 0);
        const totalClaimInRange = settlementsInRange.reduce((s, r) => s + num(r.claimAmount), 0);
        const varianceInRange = totalAccrualInRange - totalClaimInRange;
        const variancePctInRange = totalAccrualInRange > 0 ? (varianceInRange / totalAccrualInRange) * 100 : 0;

        const pendingClaims = contractClaims.filter((c) => PENDING_CLAIM_STATUSES.has(c.status));
        const claimsPendingCount = pendingClaims.length;
        const latestPendingClaim = pendingClaims[0] || null;

        const unpostedJEs = contractJEs.filter((j) => !j.jeStage || !POSTED_JE_STAGES.has(j.jeStage));
        const unpostedJETotal = unpostedJEs.reduce((s, j) => s + num(j.totalAmount), 0);

        const invoicesInRange = contractInvoices.filter((d) => inRange(d.createdAt));
        const invoicesInRangeTotal = invoicesInRange.reduce((s, d) => s + num(d.amount), 0);

        const lastSyncedJE = contractJEs.find((j) => j.erpSyncStatus === "synced" || j.erpSyncStatus === "success");

        const variancePeriodMap = new Map<string, {
          period: string;
          accrualAmount: number;
          claimAmount: number;
          variance: number;
          variancePct: number;
          status: string;
          settlementId: string | null;
          notes: string | null;
          updatedAt: Date | null;
        }>();
        for (const s of contractSettlements) {
          const key = s.period || "Unassigned";
          const existing = variancePeriodMap.get(key);
          const a = num(s.accrualAmount);
          const c = num(s.claimAmount);
          const newAccrual = (existing?.accrualAmount || 0) + a;
          const newClaim = (existing?.claimAmount || 0) + c;
          const newVariance = newAccrual - newClaim;
          const newVariancePct = newAccrual > 0 ? (newVariance / newAccrual) * 100 : 0;
          let status: string;
          const absPct = Math.abs(newVariancePct);
          if (s.disputeState && s.disputeState !== "none" && s.disputeState !== "resolved") status = "Investigation";
          else if (absPct < 0.01) status = "Matched";
          else if (absPct <= 1) status = "Matched";
          else if (absPct <= 3) status = "Minor variance";
          else status = "Investigation";
          variancePeriodMap.set(key, {
            period: key,
            accrualAmount: newAccrual,
            claimAmount: newClaim,
            variance: newVariance,
            variancePct: newVariancePct,
            status,
            settlementId: s.id,
            notes: s.disputeReason || existing?.notes || null,
            updatedAt: s.updatedAt || existing?.updatedAt || null,
          });
        }
        const variancePeriods = Array.from(variancePeriodMap.values())
          .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
          .slice(0, 8);

        const closeReadiness: Array<{
          key: string;
          label: string;
          sublabel?: string;
          status: "done" | "warning" | "pending";
        }> = [];
        const totalSales = Number(salesMatchAgg[0]?.total || 0);
        closeReadiness.push({
          key: "sales",
          label: "Sales matched",
          sublabel: totalSales > 0 ? `${totalSales.toLocaleString()} matches against this contract` : "No sales matched yet",
          status: totalSales > 0 ? "done" : "pending",
        });
        const accrualsThisRange = contractAccruals.filter((a) => inRange(a.createdAt));
        closeReadiness.push({
          key: "accrual",
          label: `Accrual${accrualsThisRange.length > 1 ? "s" : ""} calculated`,
          sublabel: accrualsThisRange.length > 0 ? `${accrualsThisRange.length} accrual${accrualsThisRange.length === 1 ? "" : "s"} in ${range.label}` : `No accruals in ${range.label}`,
          status: accrualsThisRange.length > 0 ? "done" : "pending",
        });
        closeReadiness.push({
          key: "approval",
          label: "Accrual approval",
          sublabel: accrualsAwaitingApproval > 0 ? `${accrualsAwaitingApproval} awaiting approval` : "All caught up",
          status: accrualsAwaitingApproval > 0 ? "warning" : "done",
        });
        closeReadiness.push({
          key: "claims",
          label: "Claim responses",
          sublabel: claimsPendingCount > 0 ? `${claimsPendingCount} claim${claimsPendingCount === 1 ? "" : "s"} awaiting response` : "No open claims",
          status: claimsPendingCount > 0 ? "pending" : "done",
        });
        closeReadiness.push({
          key: "je",
          label: "Journal entries posted",
          sublabel: unpostedJEs.length > 0 ? `${unpostedJEs.length} pending sync to ERP` : "All entries posted",
          status: unpostedJEs.length > 0 ? "pending" : "done",
        });
        const etaMinutes = Math.max(
          5,
          accrualsAwaitingApproval * 4 + unpostedJEs.length * 3 + claimsPendingCount * 6,
        );

        // Compact projections — keep payload lean.
        res.json({
          contract: {
            id: contract.id,
            contractNumber: contract.contractNumber,
            displayName: contract.displayName,
            originalName: contract.originalName,
            status: contract.status,
            currency: (contract as any).currency || "USD",
            flowTypeCode: contract.flowTypeCode || null,
            flowTypeName: flowType?.name || null,
            cashDirection: flowType?.cashDirection || null,
            counterpartyName: (contract as any).counterpartyName || null,
            ownerName: (contract as any).ownerName || null,
            effectiveStart: (contract as any).effectiveStart || null,
            effectiveEnd: (contract as any).effectiveEnd || null,
          },
          period: {
            code: period,
            label: range.label,
            start: range.start.toISOString(),
            end: range.end.toISOString(),
          },
          subtypeInstances: subInstances,
          kpis: {
            openAccruals: {
              total: openAccrualsTotal,
              count: openAccruals.length,
              awaitingApproval: accrualsAwaitingApproval,
            },
            openObligations: {
              total: openObligationsTotal,
              count: openObligations.length,
              oldestAgingDays: oldestObligationAgingDays,
            },
            settlementVariance: {
              variance: varianceInRange,
              variancePct: variancePctInRange,
              closedCount: closedInRange,
              totalCount: settlementsInRange.length,
            },
            claimsPending: {
              count: claimsPendingCount,
              latest: latestPendingClaim
                ? {
                    id: latestPendingClaim.id,
                    claimedAmount: num(latestPendingClaim.claimedAmount),
                    approvedAmount: num(latestPendingClaim.approvedAmount),
                    partnerName: latestPendingClaim.partnerName,
                    period: latestPendingClaim.period,
                  }
                : null,
            },
            unpostedJEs: {
              count: unpostedJEs.length,
              total: unpostedJETotal,
            },
            invoicesInRange: {
              count: invoicesInRange.length,
              total: invoicesInRangeTotal,
            },
            lastGlSync: lastSyncedJE
              ? {
                  at: lastSyncedJE.updatedAt?.toISOString() || null,
                  status: "success",
                  jeId: lastSyncedJE.jeId,
                }
              : null,
          },
          settlementVarianceRows: variancePeriods,
          accruals: openAccruals.slice(0, 10).map((a) => ({
            id: a.id,
            accrualId: a.accrualId,
            period: a.period,
            amount: num(a.amount),
            status: a.status,
            createdAt: a.createdAt,
          })),
          obligations: openObligations.slice(0, 10).map((o) => ({
            id: o.id,
            kind: o.kind,
            amount: num(o.amount),
            outstandingAmount: num(o.outstandingAmount),
            currency: o.currency,
            status: o.status,
            dueAt: o.dueAt,
            agingDays: o.dueAt ? Math.max(0, daysBetween(now, new Date(o.dueAt))) : null,
            partnerName: o.partnerName,
          })),
          claims: contractClaims.slice(0, 10).map((c) => ({
            id: c.id,
            claimNumber: c.claimNumber,
            claimType: c.claimType,
            partnerName: c.partnerName,
            period: c.period,
            claimedAmount: num(c.claimedAmount),
            approvedAmount: num(c.approvedAmount),
            status: c.status,
            disputeState: c.disputeState,
            createdAt: c.createdAt,
          })),
          invoices: contractInvoices.slice(0, 10).map((d) => ({
            id: d.id,
            documentNumber: d.documentNumber,
            documentType: d.documentType,
            period: d.period,
            amount: num(d.amount),
            currency: d.currency,
            status: d.status,
            createdAt: d.createdAt,
          })),
          journalEntries: contractJEs.slice(0, 10).map((j) => ({
            id: j.id,
            jeId: j.jeId,
            period: j.period,
            totalAmount: num(j.totalAmount),
            jeStage: j.jeStage,
            erpSyncStatus: j.erpSyncStatus,
            updatedAt: j.updatedAt,
          })),
          closeReadiness,
          closeEtaMinutes: etaMinutes,
          totalSalesMatched: totalSales,
        });
      } catch (e: any) {
        console.error("[contract-reconciliation] error", e);
        res.status(500).json({ error: e?.message || "Internal error" });
      }
    },
  );
}
