import { db } from "../db";
import {
  approvalChains, approvalChainSteps, approvalRequests, approvalDecisions,
  users, agentActivity,
} from "@shared/schema";
import { and, eq, asc, desc, isNull, isNotNull, or, lte, sql } from "drizzle-orm";
import { notify } from "./approvalNotifier";

function dueAtFor(step: { slaHours: number | null } | null | undefined): Date | null {
  if (!step?.slaHours || step.slaHours <= 0) return null;
  return new Date(Date.now() + step.slaHours * 3600_000);
}

// Open string type — see server/services/approvalDocTypes.ts for the catalog
// of valid scopes. Kept as `string` so adding a new doc type only requires
// updating the catalog, not the engine.
export type ApprovalScope = string;

export interface RequireApprovalInput {
  scope: ApprovalScope;
  entityId: string;
  entityLabel?: string | null;
  amount: number;
  currency?: string | null;
  companyId?: string | null;
  requestedBy?: string | null;
  /** Optional sub-type filter (claim_type, contract_type, etc.). */
  subtype?: string | null;
  /** Optional direction filter (claims: inbound | outbound). */
  direction?: string | null;
}

/**
 * Resolve the best chain for a given scope+amount+company.
 * Falls back to a system-default chain (companyId IS NULL) when no
 * tenant-specific chain matches. Picks the chain with the highest
 * minAmount that is still ≤ amount.
 */
async function pickChain(
  scope: ApprovalScope, amount: number, companyId: string | null,
  subtype: string | null, direction: string | null,
) {
  const candidates = await db.select().from(approvalChains).where(and(
    eq(approvalChains.scope, scope),
    eq(approvalChains.isActive, true),
    or(eq(approvalChains.companyId, companyId || ""), isNull(approvalChains.companyId)),
  ));
  // A chain matches when its (optional) subtype/direction filters either
  // are unset (= wildcard) or equal the incoming entity's values.
  // Specificity wins: chains that match on more fields rank higher.
  const eligible = candidates
    .filter(c => Number(c.minAmount || 0) <= amount)
    .filter(c => !c.subtype || c.subtype === subtype)
    .filter(c => !c.direction || c.direction === direction)
    .map(c => {
      let specificity = 0;
      if (c.companyId) specificity += 4;
      if (c.subtype) specificity += 2;
      if (c.direction) specificity += 1;
      return { c, specificity };
    })
    .sort((a, b) => {
      if (a.specificity !== b.specificity) return b.specificity - a.specificity;
      return Number(b.c.minAmount || 0) - Number(a.c.minAmount || 0);
    });
  return eligible[0]?.c || null;
}

/**
 * Create an approval request for an entity, if a matching chain exists.
 * Returns the request id when one is created, otherwise null.
 * Idempotent: if a pending request already exists for the same entity it
 * is returned instead of duplicated.
 */
export async function requireApproval(input: RequireApprovalInput): Promise<string | null> {
  const { scope, entityId, entityLabel, amount, currency, companyId, requestedBy, subtype, direction } = input;
  const [existing] = await db.select().from(approvalRequests).where(and(
    eq(approvalRequests.entityType, scope),
    eq(approvalRequests.entityId, entityId),
    eq(approvalRequests.status, "pending"),
  )).limit(1);
  if (existing) return existing.id;

  const chain = await pickChain(scope, amount, companyId || null, subtype || null, direction || null);
  if (!chain) return null; // no chain configured ⇒ no approval needed

  // Look up step 1 to compute the SLA-based due date for the new request.
  const [firstStep] = await db.select().from(approvalChainSteps)
    .where(and(eq(approvalChainSteps.chainId, chain.id), eq(approvalChainSteps.sequence, 1)))
    .limit(1);

  const [req] = await db.insert(approvalRequests).values({
    chainId: chain.id, entityType: scope, entityId,
    entityLabel: entityLabel || null,
    amount: String(amount), currency: currency || "USD",
    currentStep: 1, status: "pending",
    requestedBy: requestedBy || null,
    companyId: companyId || null,
    currentStepDueAt: dueAtFor(firstStep || null),
  }).returning();

  await db.insert(agentActivity).values({
    agentName: "Approval Engine", scope, scopeId: entityId,
    step: "approval_requested", status: "info",
    summary: `Approval requested via "${chain.name}"`,
    details: { chainId: chain.id, amount, currency },
    companyId: companyId || null,
  });

  // Fire-and-forget the request email; failure is logged in the notifier.
  if (firstStep) notify(req, firstStep, "request").catch(() => {});

  return req.id;
}

export interface DecideInput {
  requestId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  /** Bypass role check — used for tenant/system administrators. */
  isSystemAdmin?: boolean;
  decision: "approve" | "reject";
  comment?: string | null;
}

export interface DecideResult {
  request: typeof approvalRequests.$inferSelect;
  finalized: boolean; // true when request reached terminal state
}

/**
 * Record a decision for the current step. If the step is satisfied
 * (single approver OR all approvers when requiresAll), advance to the
 * next step or finalize the request.
 */
export async function decide(input: DecideInput): Promise<DecideResult> {
  const { requestId, approverId, approverName, approverRole, isSystemAdmin, decision, comment } = input;
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1);
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending") throw new Error(`Request already ${req.status}`);

  const steps = await db.select().from(approvalChainSteps)
    .where(eq(approvalChainSteps.chainId, req.chainId))
    .orderBy(asc(approvalChainSteps.sequence));
  const step = steps.find(s => s.sequence === req.currentStep);
  if (!step) throw new Error("Chain misconfigured: current step missing");

  // Authorization: approver role must match step role (or be a system admin
  // who is implicitly allowed to act for any step).
  if (step.approverRole !== approverRole && approverRole !== "system_admin" && !isSystemAdmin) {
    throw new Error(`Step requires role "${step.approverRole}"`);
  }

  // Prevent the same approver from voting twice on the same step.
  const priorMine = await db.select().from(approvalDecisions).where(and(
    eq(approvalDecisions.requestId, requestId),
    eq(approvalDecisions.step, req.currentStep),
    eq(approvalDecisions.approverId, approverId),
  )).limit(1);
  if (priorMine.length > 0) throw new Error("You have already voted on this step");

  await db.insert(approvalDecisions).values({
    requestId, step: req.currentStep,
    approverId, approverName, approverRole,
    decision, comment: comment || null,
  });

  // Reject is terminal regardless of step config.
  if (decision === "reject") {
    const [updated] = await db.update(approvalRequests).set({
      status: "rejected", completedAt: new Date(),
    }).where(eq(approvalRequests.id, requestId)).returning();
    await db.insert(agentActivity).values({
      agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
      step: "approval_rejected", status: "warn",
      summary: `Rejected by ${approverName}${comment ? `: ${comment}` : ""}`,
      companyId: req.companyId,
    });
    notify(updated, step, "rejected").catch(() => {});
    return { request: updated, finalized: true };
  }

  // Approve: check if step is satisfied.
  let stepDone = true;
  if (step.requiresAll) {
    const eligible = await db.select({ id: users.id }).from(users).where(eq(users.role, step.approverRole));
    const decisionsThisStep = await db.select().from(approvalDecisions).where(and(
      eq(approvalDecisions.requestId, requestId),
      eq(approvalDecisions.step, req.currentStep),
      eq(approvalDecisions.decision, "approve"),
    ));
    const approvedIds = new Set(decisionsThisStep.map(d => d.approverId));
    stepDone = eligible.every(u => approvedIds.has(u.id));
  }

  if (!stepDone) {
    return { request: req, finalized: false };
  }

  // Advance or finalize.
  const isLast = req.currentStep >= steps.length;
  if (isLast) {
    const [updated] = await db.update(approvalRequests).set({
      status: "approved", completedAt: new Date(),
    }).where(eq(approvalRequests.id, requestId)).returning();
    await db.insert(agentActivity).values({
      agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
      step: "approval_completed", status: "success",
      summary: `Approved (final step) by ${approverName}`,
      companyId: req.companyId,
    });
    notify(updated, step, "approved").catch(() => {});
    return { request: updated, finalized: true };
  }
  const nextStep = steps.find(s => s.sequence === req.currentStep + 1) || null;
  const [updated] = await db.update(approvalRequests).set({
    currentStep: req.currentStep + 1,
    currentStepDueAt: dueAtFor(nextStep),
    lastReminderAt: null,
  }).where(eq(approvalRequests.id, requestId)).returning();
  await db.insert(agentActivity).values({
    agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
    step: "approval_advanced", status: "info",
    summary: `Step ${req.currentStep} approved by ${approverName} → step ${req.currentStep + 1}`,
    companyId: req.companyId,
  });
  if (nextStep) notify(updated, nextStep, "request").catch(() => {});
  return { request: updated, finalized: false };
}

/**
 * Re-send the "request" notification for the current step. Called from
 * the "Resend notification" button on the Approval Panel. Returns the
 * count of recipients the email actually went out to.
 */
export async function resendCurrentStepNotification(requestId: string): Promise<number> {
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1);
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending") throw new Error(`Request already ${req.status}`);
  const [step] = await db.select().from(approvalChainSteps)
    .where(and(eq(approvalChainSteps.chainId, req.chainId), eq(approvalChainSteps.sequence, req.currentStep)))
    .limit(1);
  if (!step) throw new Error("Current step missing");
  const sent = await notify(req, step, "reminder");
  await db.update(approvalRequests).set({ lastReminderAt: new Date() }).where(eq(approvalRequests.id, requestId));
  return sent;
}

/**
 * Background sweep: send overdue reminders and apply on-timeout actions.
 * Designed to be called periodically (e.g. every 5 minutes). Idempotent —
 * uses lastReminderAt + reminderHours to avoid spamming.
 */
export async function sweepRemindersAndTimeouts(): Promise<{ reminders: number; timeouts: number }> {
  const now = new Date();
  let reminders = 0; let timeouts = 0;

  // Pull all pending requests that have any due date set (no due date ⇒
  // no SLA to enforce, so we skip them entirely).
  const pending = await db.select().from(approvalRequests).where(and(
    eq(approvalRequests.status, "pending"),
    isNotNull(approvalRequests.currentStepDueAt),
  ));
  if (pending.length === 0) return { reminders: 0, timeouts: 0 };

  const chainIds = Array.from(new Set(pending.map(r => r.chainId)));
  const allSteps = await db.select().from(approvalChainSteps)
    .where(sql`${approvalChainSteps.chainId} IN (${sql.join(chainIds.map(id => sql`${id}`), sql`, `)})`);
  const stepByKey = new Map(allSteps.map(s => [`${s.chainId}:${s.sequence}`, s]));
  const stepsByChain = new Map<string, typeof allSteps>();
  for (const s of allSteps) {
    const arr = stepsByChain.get(s.chainId) || [];
    arr.push(s); stepsByChain.set(s.chainId, arr);
  }

  for (const req of pending) {
    const step = stepByKey.get(`${req.chainId}:${req.currentStep}`);
    if (!step) continue;

    const dueAt = req.currentStepDueAt!;
    if (dueAt <= now) {
      // SLA expired ⇒ apply on-timeout action.
      const action = step.onTimeoutAction || "none";
      if (action === "none") continue; // SLA configured but no auto-action; just leave it.
      timeouts++;
      if (action === "auto_approve" || action === "auto_reject") {
        const status = action === "auto_approve" ? "approved" : "rejected";
        const [updated] = await db.update(approvalRequests).set({
          status, completedAt: now,
        }).where(eq(approvalRequests.id, req.id)).returning();
        await db.insert(approvalDecisions).values({
          requestId: req.id, step: req.currentStep,
          approverId: null, approverName: "System (SLA timeout)", approverRole: "system",
          decision: action === "auto_approve" ? "approve" : "reject",
          comment: `Auto-${action === "auto_approve" ? "approved" : "rejected"} after SLA expiry`,
        });
        await db.insert(agentActivity).values({
          agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
          step: action === "auto_approve" ? "approval_auto_approved" : "approval_auto_rejected",
          status: action === "auto_approve" ? "success" : "warn",
          summary: `SLA expired — auto-${action === "auto_approve" ? "approved" : "rejected"}`,
          companyId: req.companyId,
        });
        notify(updated, step, "auto_decided").catch(() => {});
      } else if (action === "escalate") {
        const allChainSteps = stepsByChain.get(req.chainId) || [];
        const isLast = req.currentStep >= allChainSteps.length;
        if (isLast) {
          // No further step — escalation collapses to auto-approve.
          const [updated] = await db.update(approvalRequests).set({
            status: "approved", completedAt: now,
          }).where(eq(approvalRequests.id, req.id)).returning();
          await db.insert(agentActivity).values({
            agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
            step: "approval_auto_approved", status: "success",
            summary: `SLA expired on final step — auto-approved`,
            companyId: req.companyId,
          });
          notify(updated, step, "auto_decided").catch(() => {});
        } else {
          const next = allChainSteps.find(s => s.sequence === req.currentStep + 1) || null;
          const [updated] = await db.update(approvalRequests).set({
            currentStep: req.currentStep + 1,
            currentStepDueAt: dueAtFor(next),
            lastReminderAt: null,
          }).where(eq(approvalRequests.id, req.id)).returning();
          await db.insert(agentActivity).values({
            agentName: "Approval Engine", scope: req.entityType, scopeId: req.entityId,
            step: "approval_escalated", status: "warn",
            summary: `SLA expired — escalated to step ${req.currentStep + 1}`,
            companyId: req.companyId,
          });
          if (next) notify(updated, next, "request").catch(() => {});
          notify(updated, step, "escalated").catch(() => {});
        }
      }
      continue;
    }

    // Not yet expired — check whether a reminder is due.
    const remH = step.reminderHours || 0;
    if (remH <= 0) continue;
    const lastSent = req.lastReminderAt || req.requestedAt || new Date(0);
    const nextRemAt = new Date(lastSent.getTime() + remH * 3600_000);
    if (nextRemAt <= now) {
      reminders++;
      notify(req, step, "reminder").catch(() => {});
      await db.update(approvalRequests).set({ lastReminderAt: now }).where(eq(approvalRequests.id, req.id));
    }
  }

  return { reminders, timeouts };
}

let sweepHandle: NodeJS.Timeout | null = null;
const SWEEP_INTERVAL_MS = 5 * 60_000;

/** Start the periodic sweeper. Called once at server boot. */
export function startApprovalSweeper() {
  if (sweepHandle) return;
  // First run after a short delay so server boot isn't blocked on it.
  setTimeout(() => sweepRemindersAndTimeouts().catch(e => console.error("[approval-sweep] error:", e)), 30_000);
  sweepHandle = setInterval(() => {
    sweepRemindersAndTimeouts().catch(e => console.error("[approval-sweep] error:", e));
  }, SWEEP_INTERVAL_MS);
  console.log("✓ Approval reminder/timeout sweeper started (every 5min)");
}

/**
 * Returns the steps + decisions log for a single request, used by the
 * detail panel to render the approval timeline.
 */
export async function getRequestTimeline(requestId: string) {
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1);
  if (!req) return null;
  const steps = await db.select().from(approvalChainSteps)
    .where(eq(approvalChainSteps.chainId, req.chainId))
    .orderBy(asc(approvalChainSteps.sequence));
  const decisions = await db.select().from(approvalDecisions)
    .where(eq(approvalDecisions.requestId, requestId))
    .orderBy(asc(approvalDecisions.decidedAt));
  return { request: req, steps, decisions };
}

/**
 * Pending approvals visible to a given user — i.e. requests whose
 * current step's role matches the user's role (or system admin).
 */
export async function pendingForUser(
  userId: string, userRole: string, companyId: string | null,
  isSystemAdmin: boolean = false,
) {
  const conds: any[] = [eq(approvalRequests.status, "pending")];
  if (companyId) conds.push(or(eq(approvalRequests.companyId, companyId), isNull(approvalRequests.companyId)));
  const reqs = await db.select().from(approvalRequests)
    .where(and(...conds))
    .orderBy(desc(approvalRequests.requestedAt));
  if (reqs.length === 0) return [];

  const chainIds = Array.from(new Set(reqs.map(r => r.chainId)));
  const allSteps = await db.select().from(approvalChainSteps)
    .where(sql`${approvalChainSteps.chainId} IN (${sql.join(chainIds.map(id => sql`${id}`), sql`, `)})`);
  const stepByKey = new Map(allSteps.map(s => [`${s.chainId}:${s.sequence}`, s]));

  return reqs
    .map(r => ({ ...r, step: stepByKey.get(`${r.chainId}:${r.currentStep}`) || null }))
    .filter(r => r.step && (
      r.step.approverRole === userRole ||
      userRole === "system_admin" ||
      isSystemAdmin
    ));
}

/**
 * Seed sensible default chains so the engine has something to pick on a
 * fresh install. Idempotent: skips if any chain already exists.
 */
export async function seedDefaultApprovalChains() {
  const existing = await db.select().from(approvalChains).limit(1);
  if (existing.length > 0) return;

  const seed = async (name: string, scope: ApprovalScope, minAmount: string, steps: Array<{ role: string; label: string }>) => {
    const [chain] = await db.insert(approvalChains).values({
      name, scope, minAmount, isDefault: true, isActive: true, companyId: null,
    }).returning();
    for (let i = 0; i < steps.length; i++) {
      await db.insert(approvalChainSteps).values({
        chainId: chain.id, sequence: i + 1,
        approverRole: steps[i].role, label: steps[i].label, requiresAll: false,
      });
    }
  };

  // Claims: anything ≥ $10k → finance lead; ≥ $100k adds CFO step.
  await seed("Standard Claim Approval", "claim", "10000", [
    { role: "system_admin", label: "Finance Lead" },
  ]);
  await seed("Large Claim Approval", "claim", "100000", [
    { role: "system_admin", label: "Finance Lead" },
    { role: "system_admin", label: "CFO" },
  ]);
  // Memos / invoices: same ladder, scope=document.
  await seed("Standard Document Approval", "document", "10000", [
    { role: "system_admin", label: "Finance Lead" },
  ]);
  await seed("Large Document Approval", "document", "100000", [
    { role: "system_admin", label: "Finance Lead" },
    { role: "system_admin", label: "CFO" },
  ]);
  // Deduction write-offs: any size triggers a single-step approval since
  // a write-off is always money lost.
  await seed("Deduction Write-off Approval", "deduction", "0", [
    { role: "system_admin", label: "Finance Lead" },
  ]);

  console.log("✓ Seeded default approval chains");
}
