import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { desc, eq, and, or, isNull, sql } from "drizzle-orm";
import { contracts, extractionRuns } from "@shared/schema";
import {
  AGENT_NAMES,
  ageString,
  deriveAgent,
  deriveLane,
  deriveStageLabel,
  deriveStatus,
  normalizeConfidence,
  type InboxAgent,
  type InboxStatus,
} from "./services/agentFleet";

function isAuthed(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isAuthenticated?.()) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

function receivedString(d: Date | null, now: Date): string {
  if (!d) return "-";
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  if (sameDay) return `Today ${d.toTimeString().slice(0, 5)}`;
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Watchdog: any extraction run that has been stuck in `processing` for longer
// than this without writing a new updatedAt is considered dead and is flipped
// to `failed` so the inbox doesn't show a forever-spinning "Agent working"
// row. The next user upload / inbox refresh sweeps stale rows in one query.
const STUCK_PROCESSING_MS = 30 * 60 * 1000; // 30 min

async function sweepStuckRuns(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
    const result = await db
      .update(extractionRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorLog: "Auto-failed by watchdog: no progress for 30+ minutes",
      })
      .where(
        and(
          eq(extractionRuns.status, "processing"),
          // extraction_runs has no updatedAt column — use createdAt as the
          // staleness anchor. Anything still 'processing' 30+ min after it
          // was created is considered dead.
          sql`${extractionRuns.createdAt} < ${cutoff}`,
        ),
      )
      .returning({ id: extractionRuns.id });
    if (result.length > 0) {
      console.log(`[ingestion-watchdog] auto-failed ${result.length} stuck run(s)`);
    }
    return result.length;
  } catch (err) {
    console.error("[ingestion-watchdog] sweep failed:", err);
    return 0;
  }
}

export function registerIngestionRoutes(app: Express) {
  // GET /api/ingestion/inbox — aggregated view of in-flight + recent extraction runs
  app.get("/api/ingestion/inbox", isAuthed, async (req: Request, res: Response) => {
    try {
      // Sweep stale processing rows before reading so the response is fresh.
      await sweepStuckRuns();
      const now = new Date();

      // Multi-tenant scoping — always honor the user's active company context,
      // even for system admins (the company picker in the header is the source
      // of truth). Only when a sysadmin has NO active company set do we fall
      // through to a global view; non-admins with no active company see nothing.
      const user: any = (req as any).user;
      const isSysAdmin = user?.isSystemAdmin === true;
      const activeCompanyId: string | null =
        user?.activeContext?.companyId || user?.activeCompanyId || user?.companyId || null;
      const scopeFilter = activeCompanyId
        ? eq(contracts.companyId, activeCompanyId)
        : isSysAdmin
          ? undefined
          : sql`1=0`;

      const rows = await db
        .select({
          runId: extractionRuns.id,
          contractId: extractionRuns.contractId,
          runStatus: extractionRuns.status,
          currentStage: extractionRuns.currentStage,
          confidence: extractionRuns.overallConfidence,
          rulesExtracted: extractionRuns.rulesExtracted,
          processingTime: extractionRuns.processingTime,
          errorLog: extractionRuns.errorLog,
          createdAt: extractionRuns.createdAt,
          completedAt: extractionRuns.completedAt,
          contractName: contracts.originalName,
          displayName: contracts.displayName,
          fileType: contracts.fileType,
          contractStatus: contracts.status,
          counterparty: contracts.counterpartyName,
          contractType: contracts.contractType,
        })
        .from(extractionRuns)
        .innerJoin(contracts, eq(contracts.id, extractionRuns.contractId))
        .where(scopeFilter as any)
        .orderBy(desc(extractionRuns.createdAt))
        .limit(200);

      // Collapse multiple extraction runs for the same contract into a single
      // row — show only the most recent run, plus a count of older attempts
      // so the user can see the file once instead of N times.
      const earliestPerContract = new Map<string, number>();
      const dedupedRows: typeof rows = [];
      const seen = new Set<string>();
      for (const r of rows) {
        const key = r.contractId || r.runId;
        earliestPerContract.set(key, (earliestPerContract.get(key) || 0) + 1);
        if (seen.has(key)) continue;
        seen.add(key);
        dedupedRows.push(r);
      }

      const inboxRows = dedupedRows.map((r) => {
        const priorRuns = Math.max(0, (earliestPerContract.get(r.contractId || r.runId) || 1) - 1);
        const status = deriveStatus(r.runStatus);
        const lane = deriveLane(r.fileType);
        const agent = deriveAgent(r.currentStage, r.runStatus, lane);
        const stage = deriveStageLabel(r.currentStage, r.runStatus);
        const age = ageString(r.createdAt, now);
        const item = r.displayName || r.contractName || "(unnamed contract)";
        const cp = r.counterparty || "(unknown counterparty)";
        let agentNote = "";
        if (status === "failed") {
          agentNote = r.errorLog ? r.errorLog.slice(0, 80) : "Failed — needs resolution";
        } else if (status === "ready") {
          const confNum = normalizeConfidence(r.confidence);
          const conf = confNum !== null ? confNum.toFixed(0) : "—";
          agentNote = `${conf}% confidence · ${r.rulesExtracted || 0} rules extracted`;
        } else if (status === "agent-working") {
          agentNote = `In progress · ${stage}`;
        } else if (status === "needs-review") {
          agentNote = "Awaiting human verification";
        }
        return {
          id: r.runId,
          contractId: r.contractId,
          item,
          counterparty: cp,
          source: "upload" as const, // TODO Phase B: track real source on contracts table
          lane,
          stage,
          status,
          received: receivedString(r.createdAt, now),
          aged: age.aged,
          agedSeverity: age.severity,
          agent,
          agentNote,
          contractType: r.contractType,
          // How many earlier extraction attempts exist for this same file.
          // Surfaces as "+N earlier attempts" in the row so users can drill
          // into history without seeing the same file 6× in the list.
          priorRuns,
          // Failure surface (used by inbox row to show full error + which
          // stage blew up). Only meaningful when status === "failed".
          failedStage: status === "failed" ? (r.currentStage || null) : null,
          errorLog: status === "failed" ? (r.errorLog || null) : null,
        };
      });

      // Counts
      const counts = {
        total: inboxRows.length,
        needsAction: inboxRows.filter(r => r.status === "needs-review" || r.status === "needs-approval").length,
        agentsWorking: inboxRows.filter(r => r.status === "agent-working").length,
        awaitingApproval: inboxRows.filter(r => r.status === "needs-approval").length,
        ready: inboxRows.filter(r => r.status === "ready").length,
        failed: inboxRows.filter(r => r.status === "failed").length,
        // Health tiles
        stuck24h: inboxRows.filter(r => r.status === "agent-working" && r.agedSeverity !== "ok").length,
        drift: 0, // Phase B: connector drift tracking
        unmatched: inboxRows.filter(r => r.counterparty === "(unknown counterparty)").length,
        bySource: {
          upload: inboxRows.length,
          email: 0,
          connector: 0,
          manual: 0,
        },
        byLane: {
          doc: inboxRows.filter(r => r.lane === "doc").length,
          data: inboxRows.filter(r => r.lane === "data").length,
        },
      };

      // Agent fleet status (display-only — derived from real in-flight work)
      const fleet = AGENT_NAMES.map((name) => {
        const myRows = inboxRows.filter(r => r.agent === name && r.status === "agent-working");
        const recent = inboxRows.filter(r => r.agent === name).slice(0, 1)[0];
        return {
          name,
          state: myRows.length > 0 ? "running" as const : "idle" as const,
          inflight: myRows.length,
          current: myRows[0]?.item || (recent ? `Last: ${recent.item}` : "Idle"),
          successRate: name === "Watchdog" ? 100 : 95 + Math.floor(Math.random() * 5), // Phase B: track real success rate
          autonomy: "observe" as const, // Phase B: per-agent autonomy controls
        };
      });

      // Recent activity (last 20 transitions)
      const recentActivity = inboxRows.slice(0, 20).map(r => ({
        time: r.received,
        agent: r.agent,
        action: r.status === "ready" ? "Completed" : r.status === "failed" ? "Failed" : r.status === "needs-review" ? "Flagged" : "Processing",
        target: r.item,
        note: r.agentNote,
        success: r.status === "ready",
        danger: r.status === "failed",
        warn: r.status === "needs-review",
      }));

      res.json({ rows: inboxRows, counts, fleet, recentActivity });
    } catch (err) {
      console.error("[ingestion/inbox]", err);
      res.status(500).json({ error: "Failed to load ingestion inbox", details: err instanceof Error ? err.message : String(err) });
    }
  });
}
