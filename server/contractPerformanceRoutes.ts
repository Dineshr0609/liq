/**
 * Contract Performance aggregation endpoint
 *
 * Powers the Performance tab inside the contract command center
 * (client/src/components/contracts/performance/PerformanceTab.tsx).
 *
 * One round-trip returns every slice the tab needs:
 *   - Contract metadata + cash direction (from flow_types)
 *   - KPI rollups (lifetime fees, period fees, % delta vs prior period,
 *     effective rate, average fee per calc, run success rate, last calc,
 *     active rules count)
 *   - 12-month trend (fees + sales + calc count per month)
 *   - Top rules by contribution
 *   - Recent calculation runs
 *
 * Tenant scoping: every sub-query is bounded by the contract's `companyId`.
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  contracts,
  flowTypes,
  contractCalculations,
  calculationRuns,
  calculationRuleResults,
} from "@shared/schema";
import { isAuthenticated } from "./auth";

type PeriodCode = "mtd" | "qtd" | "ytd" | "trailing12" | "custom";

interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
  priorStart: Date;
  priorEnd: Date;
}

function rangeForPeriod(period: PeriodCode, fromQ?: string, toQ?: string): PeriodRange {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  const dayStart = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));
  const shift = (s: Date, e: Date): { priorStart: Date; priorEnd: Date } => {
    const span = e.getTime() - s.getTime();
    return { priorStart: new Date(s.getTime() - span), priorEnd: new Date(s.getTime()) };
  };
  switch (period) {
    case "mtd": {
      const s = monthStart(y, m);
      const e = dayStart(y, m, d + 1);
      return { start: s, end: e, label: "MTD", ...shift(s, e) };
    }
    case "qtd": {
      const qStart = Math.floor(m / 3) * 3;
      const s = monthStart(y, qStart);
      const e = dayStart(y, m, d + 1);
      return { start: s, end: e, label: "QTD", ...shift(s, e) };
    }
    case "trailing12": {
      const s = monthStart(y - 1, m + 1);
      const e = dayStart(y, m, d + 1);
      return { start: s, end: e, label: "Trailing 12mo", ...shift(s, e) };
    }
    case "custom": {
      const s = fromQ ? new Date(fromQ) : monthStart(y, 0);
      const e = toQ ? new Date(toQ) : dayStart(y, m, d + 1);
      return { start: s, end: e, label: "Custom", ...shift(s, e) };
    }
    case "ytd":
    default: {
      const s = monthStart(y, 0);
      const e = dayStart(y, m, d + 1);
      return { start: s, end: e, label: "YTD", ...shift(s, e) };
    }
  }
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

const FINAL_CALC_STATUSES = new Set(["approved", "paid", "settled", "posted"]);
const FAILED_RUN_STATUSES = new Set(["failed", "error", "errored"]);
const SUCCESS_RUN_STATUSES = new Set(["completed", "approved", "posted", "settled", "paid", "draft"]);

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function registerContractPerformanceRoutes(app: Express) {
  app.get(
    "/api/contracts/:contractId/performance",
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

        const [allCalcs, allRuns] = await Promise.all([
          db
            .select()
            .from(contractCalculations)
            .where(eq(contractCalculations.contractId, contractId))
            .orderBy(desc(contractCalculations.createdAt)),
          db
            .select()
            .from(calculationRuns)
            .where(eq(calculationRuns.contractId, contractId))
            .orderBy(desc(calculationRuns.runDate)),
        ]);

        // Pull rule-result rows for in-period calcs only (avoids loading
        // every calc's per-rule trace when contracts have hundreds of runs).
        const periodCalcIds = allCalcs
          .filter((c) => {
            const ts = c.periodEnd || c.createdAt;
            if (!ts) return false;
            const t = new Date(ts).getTime();
            return t >= range.start.getTime() && t < range.end.getTime();
          })
          .map((c) => c.id);

        const ruleRows = periodCalcIds.length
          ? await db
              .select()
              .from(calculationRuleResults)
              .where(inArray(calculationRuleResults.calculationId, periodCalcIds))
          : [];

        const inRange = (ts: Date | null | undefined, s: Date, e: Date) => {
          if (!ts) return false;
          const t = new Date(ts).getTime();
          return t >= s.getTime() && t < e.getTime();
        };

        // ---- KPIs ----
        const lifetimeFeesTotal = allCalcs.reduce((s, c) => s + num(c.totalRoyalty), 0);
        const lifetimeCalcCount = allCalcs.length;

        const calcsInPeriod = allCalcs.filter((c) => inRange(c.periodEnd || c.createdAt, range.start, range.end));
        const periodFeesTotal = calcsInPeriod.reduce((s, c) => s + num(c.totalRoyalty), 0);
        const periodSalesTotal = calcsInPeriod.reduce((s, c) => s + num(c.totalSalesAmount), 0);
        const periodCalcCount = calcsInPeriod.length;

        const calcsInPriorPeriod = allCalcs.filter((c) =>
          inRange(c.periodEnd || c.createdAt, range.priorStart, range.priorEnd),
        );
        const priorPeriodFeesTotal = calcsInPriorPeriod.reduce((s, c) => s + num(c.totalRoyalty), 0);
        const deltaVsPriorPct =
          priorPeriodFeesTotal > 0
            ? ((periodFeesTotal - priorPeriodFeesTotal) / priorPeriodFeesTotal) * 100
            : null;

        const effectiveRatePct = periodSalesTotal > 0 ? (periodFeesTotal / periodSalesTotal) * 100 : null;
        const avgFeePerCalc = periodCalcCount > 0 ? periodFeesTotal / periodCalcCount : 0;

        const runsInPeriod = allRuns.filter((r) => inRange(r.runDate, range.start, range.end));
        const succeededRuns = runsInPeriod.filter((r) => r.status && SUCCESS_RUN_STATUSES.has(r.status)).length;
        const failedRuns = runsInPeriod.filter((r) => r.status && FAILED_RUN_STATUSES.has(r.status)).length;
        const totalRunsAccountable = succeededRuns + failedRuns;
        const runSuccessRatePct =
          totalRunsAccountable > 0 ? (succeededRuns / totalRunsAccountable) * 100 : null;

        const lastCalc = allCalcs[0] || null;
        const lastRun = allRuns[0] || null;
        const lastCalcAt = lastCalc?.createdAt || lastRun?.runDate || null;

        const activeRulesCount = new Set(
          ruleRows.map((r) => r.ruleId || r.ruleName).filter(Boolean),
        ).size;

        // ---- Trend (last 12 months from period end) ----
        const trendBuckets: Array<{
          monthKey: string;
          monthLabel: string;
          fees: number;
          sales: number;
          calcCount: number;
        }> = [];
        const trendMap = new Map<string, { fees: number; sales: number; calcCount: number }>();
        const trendEnd = new Date(Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1));
        for (let i = 11; i >= 0; i--) {
          const d = new Date(Date.UTC(trendEnd.getUTCFullYear(), trendEnd.getUTCMonth() - i, 1));
          const k = monthKey(d);
          trendBuckets.push({
            monthKey: k,
            monthLabel: monthLabel(d),
            fees: 0,
            sales: 0,
            calcCount: 0,
          });
          trendMap.set(k, { fees: 0, sales: 0, calcCount: 0 });
        }
        for (const c of allCalcs) {
          const ts = c.periodEnd || c.createdAt;
          if (!ts) continue;
          const k = monthKey(new Date(ts));
          const slot = trendMap.get(k);
          if (!slot) continue;
          slot.fees += num(c.totalRoyalty);
          slot.sales += num(c.totalSalesAmount);
          slot.calcCount += 1;
        }
        for (const b of trendBuckets) {
          const slot = trendMap.get(b.monthKey);
          if (slot) {
            b.fees = slot.fees;
            b.sales = slot.sales;
            b.calcCount = slot.calcCount;
          }
        }

        // ---- Top rules in period ----
        type RuleAgg = {
          ruleId: string | null;
          ruleName: string;
          ruleType: string;
          totalFee: number;
          totalSales: number;
          transactionCount: number;
          calcCount: number;
        };
        const ruleAgg = new Map<string, RuleAgg>();
        for (const r of ruleRows) {
          const key = r.ruleId || `name:${r.ruleName}`;
          const slot = ruleAgg.get(key) || {
            ruleId: r.ruleId || null,
            ruleName: r.ruleName,
            ruleType: r.ruleType,
            totalFee: 0,
            totalSales: 0,
            transactionCount: 0,
            calcCount: 0,
          };
          slot.totalFee += num(r.totalFee);
          slot.totalSales += num(r.totalSalesAmount);
          slot.transactionCount += r.transactionCount || 0;
          slot.calcCount += 1;
          ruleAgg.set(key, slot);
        }
        const topRules = Array.from(ruleAgg.values())
          .sort((a, b) => b.totalFee - a.totalFee)
          .slice(0, 8)
          .map((r) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            ruleType: r.ruleType,
            totalFee: r.totalFee,
            totalSales: r.totalSales,
            transactionCount: r.transactionCount,
            calcCount: r.calcCount,
            sharePct: periodFeesTotal > 0 ? (r.totalFee / periodFeesTotal) * 100 : 0,
          }));

        // ---- Recent runs (last 10, all-time) ----
        const recentRuns = allRuns.slice(0, 10).map((r) => ({
          id: r.id,
          runDate: r.runDate,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          totalAmount: num(r.totalAmount),
          status: r.status || "draft",
          evaluationMode: r.evaluationMode || null,
          approvedAt: r.approvedAt || null,
        }));

        const cashDirection: "inbound" | "outbound" | "derived" =
          (flowType?.cashDirection as any) || "derived";

        return res.json({
          contract: {
            id: contract.id,
            contractNumber: contract.contractNumber,
            displayName: contract.displayName,
            originalName: contract.originalName,
            status: contract.status,
            currency: contract.currency || "USD",
            flowTypeCode: contract.flowTypeCode || null,
            flowTypeName: flowType?.name || null,
            cashDirection,
            counterpartyName: contract.counterpartyName,
            effectiveStart: contract.effectiveStart,
            effectiveEnd: contract.effectiveEnd,
          },
          period: {
            code: period,
            label: range.label,
            start: range.start,
            end: range.end,
            priorStart: range.priorStart,
            priorEnd: range.priorEnd,
          },
          kpis: {
            lifetimeFees: { total: lifetimeFeesTotal, count: lifetimeCalcCount },
            periodFees: {
              total: periodFeesTotal,
              count: periodCalcCount,
              priorTotal: priorPeriodFeesTotal,
              deltaVsPriorPct,
            },
            effectiveRate: { pct: effectiveRatePct, salesBase: periodSalesTotal },
            avgFeePerCalc: { value: avgFeePerCalc, count: periodCalcCount },
            runHealth: {
              successPct: runSuccessRatePct,
              succeeded: succeededRuns,
              failed: failedRuns,
              total: runsInPeriod.length,
            },
            lastCalc: {
              at: lastCalcAt,
              status: lastCalc?.status || lastRun?.status || null,
              amount: lastCalc ? num(lastCalc.totalRoyalty) : lastRun ? num(lastRun.totalAmount) : 0,
            },
            activeRules: { count: activeRulesCount },
          },
          trend: trendBuckets,
          topRules,
          recentRuns,
        });
      } catch (err) {
        console.error("contract performance route error", err);
        return res.status(500).json({ error: "Failed to load contract performance" });
      }
    },
  );
}
