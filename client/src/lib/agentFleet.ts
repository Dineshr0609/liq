/**
 * Shared agent-fleet metadata (client side).
 *
 * Imported by:
 *   - client/src/pages/contracts-inbox.tsx — fleet-wide view
 *   - client/src/pages/contract-edit.tsx   — per-contract agent peek + card pills
 *
 * Kept in lock-step with server/services/agentFleet.ts so the inbox's Agent
 * Fleet strip and the contract page's agent peek can never drift apart.
 */

import {
  Inbox,
  Sparkles,
  GitMerge,
  ShieldCheck,
  Wand2,
  Activity,
  type LucideIcon,
} from "lucide-react";

export type AgentName =
  | "Intake"
  | "Extractor"
  | "Mapper"
  | "Validator"
  | "Resolver"
  | "Watchdog";

/** Per-agent state for a single contract (matches server enum). */
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

export type ContractAgentStatusMap = Record<AgentName, ContractAgentSlot>;

export interface ContractAgentStatusResponse {
  contractId: string;
  contractStatus: string | null;
  latestRun: {
    id: string;
    status: string | null;
    currentStage: string | null;
    createdAt: string | null;
    completedAt: string | null;
  } | null;
  agents: ContractAgentStatusMap;
}

export const AGENT_NAMES: AgentName[] = [
  "Intake",
  "Extractor",
  "Mapper",
  "Validator",
  "Resolver",
  "Watchdog",
];

export const agentIcon: Record<AgentName, LucideIcon> = {
  Intake: Inbox,
  Extractor: Sparkles,
  Mapper: GitMerge,
  Validator: ShieldCheck,
  Resolver: Wand2,
  Watchdog: Activity,
};

export const agentRole: Record<AgentName, string> = {
  Intake: "Routes by file type → lane",
  Extractor: "OCR + LLM on documents",
  Mapper: "Schema-map structured rows",
  Validator: "Schema + business rules",
  Resolver: "Auto-fix: re-OCR, retry, party-match",
  Watchdog: "Stuck items, drift, escalations",
};

/** Tailwind text-color class per agent. */
export const agentColor: Record<AgentName, string> = {
  Intake: "text-zinc-700",
  Extractor: "text-orange-600",
  Mapper: "text-emerald-600",
  Validator: "text-blue-600",
  Resolver: "text-purple-600",
  Watchdog: "text-rose-600",
};

/** Background tint when an agent is "active" — used by the inline peek dots. */
export const agentBg: Record<AgentName, string> = {
  Intake: "bg-zinc-100",
  Extractor: "bg-orange-100",
  Mapper: "bg-emerald-100",
  Validator: "bg-blue-100",
  Resolver: "bg-purple-100",
  Watchdog: "bg-rose-100",
};

export const agentStateLabel: Record<ContractAgentState, string> = {
  done: "Done",
  running: "Running",
  queued: "Queued",
  skipped: "Skipped",
  passive: "Idle",
};

/** Tailwind classes for the per-agent state badge. */
export const agentStateBadge: Record<ContractAgentState, string> = {
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  running: "bg-orange-100 text-orange-700 border-orange-200",
  queued: "bg-zinc-100 text-zinc-600 border-zinc-200",
  skipped: "bg-zinc-50 text-zinc-400 border-zinc-200",
  passive: "bg-zinc-50 text-zinc-500 border-zinc-200",
};
