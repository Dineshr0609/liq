/**
 * Approval email notifier.
 *
 * Resolves the recipient pool for a given approval step (all users with the
 * step's role within the request's company), renders a branded email, sends
 * via the existing Zoho/SMTP path, and records every attempt in
 * `approval_notifications` for audit + dedupe.
 *
 * Sending failures are *logged* (success=false) but never thrown — a flaky
 * SMTP must not block an approval lifecycle. Admins can re-send manually
 * via POST /api/finance/approvals/:id/resend-notification.
 */
import { db } from "../db";
import {
  approvalRequests, approvalChainSteps, approvalNotifications, users, type ApprovalRequest,
  type ApprovalChainStep,
} from "@shared/schema";
import { and, eq, or, isNull } from "drizzle-orm";
import { sendZohoEmail } from "../zoho-mail";

export type NotifyKind =
  | "request"      // "Please approve…" sent to the step's approver pool
  | "reminder"     // periodic nudge while still pending
  | "approved"     // sent to the requester when the request is fully approved
  | "rejected"     // sent to the requester when rejected
  | "escalated"    // SLA expired, escalated to next step
  | "auto_decided"; // SLA expired, auto-approved or auto-rejected

const APP_URL = process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:5000";

function inboxLink() { return `${APP_URL}/approvals-inbox`; }

/**
 * Resolve the email recipients for a given step.
 * Pool = active users in the request's company whose role matches the step's
 * approverRole. System admins are *also* notified for "system_admin" steps.
 * If the step's role is "system_admin" we additionally include all
 * `isSystemAdmin=true` users so seeded-default chains still reach a human.
 */
async function resolveStepRecipients(
  req: ApprovalRequest, step: ApprovalChainStep,
): Promise<{ id: string; email: string; name: string }[]> {
  const conds: any[] = [eq(users.isActive, true)];
  if (req.companyId) {
    // Company users + system admins (system admins are not bound to a single
    // company and should still see escalations across tenants).
    conds.push(or(eq(users.companyId, req.companyId), eq(users.isSystemAdmin, true)));
  }
  const candidates = await db.select({
    id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
    role: users.role, isSystemAdmin: users.isSystemAdmin,
  }).from(users).where(and(...conds));

  const matches = candidates.filter(u =>
    u.email && (
      u.role === step.approverRole ||
      (step.approverRole === "system_admin" && u.isSystemAdmin)
    )
  );
  return matches.map(u => ({
    id: u.id,
    email: u.email!,
    name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email!,
  }));
}

function renderEmail(req: ApprovalRequest, step: ApprovalChainStep | null, kind: NotifyKind): { subject: string; html: string } {
  const amount = req.amount ? `${req.currency || "USD"} ${Number(req.amount).toLocaleString()}` : "—";
  const stepLabel = step?.label || step?.approverRole || "Approval";
  const link = inboxLink();
  const banner = ({
    request:     { color: "#ea580c", title: "Approval needed" },
    reminder:    { color: "#d97706", title: "Reminder: approval still pending" },
    approved:    { color: "#16a34a", title: "Request approved" },
    rejected:    { color: "#dc2626", title: "Request rejected" },
    escalated:   { color: "#2563eb", title: "Approval escalated" },
    auto_decided:{ color: "#6b7280", title: "Approval auto-decided" },
  } as const)[kind];

  const subject = `[LicenseIQ] ${banner.title}: ${req.entityLabel || req.entityType}`;

  const html = `
<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f8f9fb;padding:24px;color:#111">
  <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:${banner.color};color:#fff;padding:16px 24px;font-weight:600;font-size:16px">${banner.title}</div>
    <div style="padding:24px">
      <p style="margin:0 0 12px 0;font-size:14px;color:#4b5563">${({
        request: `You have an approval waiting at the <b>${stepLabel}</b> step.`,
        reminder: `This approval is still pending at the <b>${stepLabel}</b> step.`,
        approved: `Your request has been fully approved.`,
        rejected: `Your request has been rejected.`,
        escalated: `The approval SLA expired and the request advanced to the next step.`,
        auto_decided: `The approval SLA expired and the request was auto-decided.`,
      } as const)[kind]}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">Entity</td><td style="padding:6px 0">${req.entityType}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Description</td><td style="padding:6px 0">${req.entityLabel || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Amount</td><td style="padding:6px 0">${amount}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Step</td><td style="padding:6px 0">${stepLabel}</td></tr>
      </table>
      <a href="${link}" style="display:inline-block;background:${banner.color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;margin-top:8px">Open Approvals Inbox</a>
      <p style="margin:24px 0 0 0;font-size:11px;color:#9ca3af">Sent by LicenseIQ Approval Engine</p>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

/**
 * Send a notification of `kind` for the request at its current step.
 * For "approved" / "rejected" the recipient is the requester; for everything
 * else it's the current step's approver pool. Returns the number of emails
 * actually sent (0 when no recipients resolved or SMTP is unconfigured).
 */
export async function notify(req: ApprovalRequest, step: ApprovalChainStep | null, kind: NotifyKind): Promise<number> {
  let recipients: { id: string; email: string; name: string }[] = [];
  if (kind === "approved" || kind === "rejected") {
    if (req.requestedBy) {
      const [u] = await db.select({
        id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
      }).from(users).where(eq(users.id, req.requestedBy)).limit(1);
      if (u?.email) recipients = [{ id: u.id, email: u.email, name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email }];
    }
  } else if (step) {
    recipients = await resolveStepRecipients(req, step);
  }
  if (recipients.length === 0) return 0;

  const { subject, html } = renderEmail(req, step, kind);
  let sent = 0;
  for (const r of recipients) {
    let success = true; let errMsg: string | null = null;
    try {
      await sendZohoEmail({ to: r.email, subject, html });
      sent++;
    } catch (e: any) {
      success = false;
      errMsg = e?.message || String(e);
      console.error(`[approval-notifier] failed to email ${r.email}:`, errMsg);
    }
    await db.insert(approvalNotifications).values({
      requestId: req.id,
      step: req.currentStep,
      kind,
      recipientEmail: r.email,
      recipientUserId: r.id,
      success,
      errorMessage: errMsg,
    });
  }
  return sent;
}
