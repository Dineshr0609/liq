/**
 * Shared agent-fleet derivation logic.
 *
 * Used by:
 *   - GET /api/ingestion/inbox          (server/ingestionRoutes.ts) — fleet-wide view
 *   - GET /api/contracts/:id/agent-status (server/routes.ts)        — per-contract view
 *
 * Single source of truth so the inbox's Agent Fleet strip and the
 * contract page's agent peek can never drift out of sync.
 */

export type InboxStatus =
  | "ready"
  | "needs-review"
  | "needs-approval"
  | "agent-working"
  | "failed";

export type InboxAgent =
  | "Intake"
  | "Extractor"
  | "Mapper"
  | "Validator"
  | "Resolver"
  | "Watchdog";

export const AGENT_NAMES: InboxAgent[] = [
  "Intake",
  "Extractor",
  "Mapper",
  "Validator",
  "Resolver",
  "Watchdog",
];

/**
 * Per-agent state for a single contract.
 * - done    — finished its part of the pipeline for this contract
 * - running — currently working on this contract
 * - queued  — will run, but blocked on an earlier agent
 * - skipped — does not apply to this contract (e.g. Mapper on a PDF doc)
 * - passive — observation-only / safety net (Watchdog), or no work yet
 */
export type ContractAgentState =
  | "done"
  | "running"
  | "queued"
  | "skipped"
  | "passive";

export interface ContractAgentSlot {
  state: ContractAgentState;
  note?: string;
  eta?: string;
}

export type ContractAgentStatusMap = Record<InboxAgent, ContractAgentSlot>;

export function deriveLane(fileType: string | null | undefined): "doc" | "data" {
  const t = (fileType || "").toLowerCase();
  if (
    t.includes("pdf") ||
    t.includes("doc") ||
    t.includes("image") ||
    t.includes("png") ||
    t.includes("jpg")
  )
    return "doc";
  if (
    t.includes("xls") ||
    t.includes("csv") ||
    t.includes("json") ||
    t.includes("xml")
  )
    return "data";
  return "doc";
}

export function deriveAgent(
  stage: string | null | undefined,
  status: string,
  lane: "doc" | "data",
): InboxAgent {
  if (status === "failed") return "Resolver";
  if (status === "completed") return lane === "data" ? "Mapper" : "Extractor";
  const s = (stage || "").toLowerCase();
  if (s.includes("ocr") || s.includes("extract") || s === "stage_a" || s === "a")
    return "Extractor";
  if (s.includes("map") || s === "stage_b" || s === "b") return "Mapper";
  if (s.includes("valid") || s === "stage_c" || s === "c") return "Validator";
  if (s.includes("review")) return "Validator";
  if (s.includes("match")) return "Resolver";
  return "Intake";
}

export function deriveStatus(runStatus: string | null | undefined): InboxStatus {
  switch (runStatus) {
    case "completed":
      return "ready";
    case "failed":
      return "failed";
    case "pending_review":
      return "needs-review";
    case "processing":
      return "agent-working";
    default:
      return "agent-working";
  }
}

export function deriveStageLabel(
  stage: string | null | undefined,
  status: string,
): string {
  if (status === "completed") return "Resolved by agent";
  if (status === "failed") return "Failed";
  if (status === "pending_review") return "Validating";
  const s = (stage || "").toLowerCase();
  if (s.includes("ocr")) return "OCR";
  if (s.includes("extract") || s === "stage_a" || s === "a") return "AI extracting";
  if (s.includes("map") || s === "stage_b" || s === "b") return "Field mapping";
  if (s.includes("valid") || s === "stage_c" || s === "c") return "Validating";
  if (s.includes("match")) return "Counterparty match";
  return stage || "Received";
}

export function normalizeConfidence(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n > 1 ? n : n * 100;
}

export function ageString(
  from: Date | null,
  to: Date,
): { aged: string; ageMs: number; severity: "ok" | "warn" | "danger" } {
  if (!from) return { aged: "-", ageMs: 0, severity: "ok" };
  const ms = to.getTime() - from.getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let aged: string;
  if (minutes < 1) aged = "just now";
  else if (minutes < 60) aged = `${minutes}m`;
  else if (hours < 24) aged = `${hours}h`;
  else aged = `${days}d`;
  const severity = days >= 7 ? "danger" : days >= 1 ? "warn" : "ok";
  return { aged, ageMs: ms, severity };
}

/**
 * Compute the per-agent state for a single contract.
 *
 * Inputs are kept minimal so this function can be called from any route
 * with whatever shape it already has loaded.
 */
export function deriveContractAgentStatus(args: {
  contractStatus: string | null | undefined;
  fileType: string | null | undefined;
  latestRun: {
    status: string | null;
    currentStage: string | null;
    confidence?: number | null;
    rulesExtracted?: number | null;
    errorLog?: string | null;
  } | null;
}): ContractAgentStatusMap {
  const { contractStatus, fileType, latestRun } = args;
  const cs = (contractStatus || "").toLowerCase();
  const lane = deriveLane(fileType);
  const stage = (latestRun?.currentStage || "").toLowerCase();
  const runStatus = latestRun?.status || null;
  const isProcessing = cs === "processing" || runStatus === "processing";
  const isCompleted =
    cs === "analyzed" ||
    cs === "completed" ||
    cs === "review" ||
    cs === "active" ||
    cs === "approved" ||
    cs === "verified" ||
    runStatus === "completed";
  const isFailed = cs === "failed" || runStatus === "failed";
  const isPendingReview = runStatus === "pending_review";

  const stageMatchesExtract =
    stage.includes("ocr") ||
    stage.includes("extract") ||
    stage === "stage_a" ||
    stage === "a";
  const stageMatchesMap =
    stage.includes("map") || stage === "stage_b" || stage === "b";
  const stageMatchesValidate =
    stage.includes("valid") || stage === "stage_c" || stage === "c";

  // -------- Intake --------
  // Done as soon as a run exists or the contract has moved past 'uploaded'.
  // Otherwise running (file just landed, parsing kicking off).
  const intake: ContractAgentSlot =
    latestRun || (cs && cs !== "uploaded")
      ? { state: "done", note: "Document received" }
      : { state: "running", note: "Receiving document" };

  // -------- Extractor --------
  let extractor: ContractAgentSlot;
  if (isCompleted) {
    const conf = normalizeConfidence(latestRun?.confidence);
    const note =
      conf !== null
        ? `${conf.toFixed(0)}% confidence · ${latestRun?.rulesExtracted ?? 0} rules extracted`
        : `${latestRun?.rulesExtracted ?? 0} rules extracted`;
    extractor = { state: "done", note };
  } else if (isProcessing && stageMatchesExtract) {
    extractor = { state: "running", note: "Reading clauses" };
  } else if (isProcessing) {
    extractor = { state: "queued", note: "Waiting for Intake" };
  } else if (isFailed) {
    extractor = { state: "queued", note: "Halted — Resolver investigating" };
  } else {
    extractor = { state: "passive", note: "Idle" };
  }

  // -------- Mapper --------
  // Mapper handles structured rows (CSV/XLSX/JSON). For PDF/doc lane it's
  // skipped entirely.
  let mapper: ContractAgentSlot;
  if (lane === "doc") {
    mapper = { state: "skipped", note: "Not needed for documents" };
  } else if (isCompleted) {
    mapper = { state: "done", note: "Fields mapped" };
  } else if (isProcessing && stageMatchesMap) {
    mapper = { state: "running", note: "Mapping fields" };
  } else if (isProcessing) {
    mapper = { state: "queued", note: "Waiting for Extractor" };
  } else {
    mapper = { state: "passive", note: "Idle" };
  }

  // -------- Validator --------
  let validator: ContractAgentSlot;
  if (cs === "active" || cs === "approved" || cs === "verified") {
    validator = { state: "done", note: "All checks passed" };
  } else if (isPendingReview) {
    validator = { state: "running", note: "Awaiting human verification" };
  } else if (isProcessing && stageMatchesValidate) {
    validator = { state: "running", note: "Cross-checking fields" };
  } else if (isCompleted) {
    validator = { state: "done", note: "Ready for review" };
  } else if (isProcessing) {
    validator = { state: "queued", note: "Waiting for upstream" };
  } else {
    validator = { state: "passive", note: "Idle" };
  }

  // -------- Resolver --------
  let resolver: ContractAgentSlot;
  if (isFailed) {
    const msg = latestRun?.errorLog
      ? latestRun.errorLog.slice(0, 80)
      : "Investigating failure";
    resolver = { state: "running", note: msg };
  } else if (isProcessing) {
    resolver = { state: "queued", note: "On standby" };
  } else {
    resolver = { state: "passive", note: "On standby" };
  }

  // -------- Watchdog --------
  // Watchdog is always passive — it observes everything in the background
  // and only surfaces when something stalls.
  const watchdog: ContractAgentSlot = {
    state: "passive",
    note: "Monitoring",
  };

  return {
    Intake: intake,
    Extractor: extractor,
    Mapper: mapper,
    Validator: validator,
    Resolver: resolver,
    Watchdog: watchdog,
  };
}
