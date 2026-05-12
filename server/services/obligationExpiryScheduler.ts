/**
 * Obligation Expiry Scheduler
 *
 * In-process scheduler that runs the nightly obligation expiry sweep
 * once per active company per day. Driven entirely by `system_settings`:
 *
 *   - obligationExpirySweepEnabled    — master on/off toggle (admin UI)
 *   - obligationExpirySweepHourUtc    — hour of day (0–23, UTC) to fire
 *   - obligationExpirySweepLastRunAt  — surfaced to admins; also used to
 *                                        guarantee a single run per UTC day
 *   - obligationExpirySweepLastError  — last error message, if any
 *   - obligationExpirySweepLastResult — per-company { expiredCount, expiredAmount }
 *
 * The scheduler ticks every 5 minutes. On each tick it checks the toggle,
 * the configured hour, and the last-run timestamp. When all three line up
 * (enabled, hour reached today, no run yet today) it iterates active
 * companies and invokes `runObligationExpirySweep` for each. Per-company
 * failures are caught, logged, and recorded in the result blob so one
 * bad company can't block the rest.
 */

import { db } from '../db';
import { companies, systemSettings, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { runObligationExpirySweep } from './obligationsService';
import { sendZohoEmail } from '../zoho-mail';

const TICK_MS = 5 * 60 * 1000; // 5 minutes
const CRASH_RETRY_MS = 60 * 60 * 1000; // 1 hour back-off after a top-level crash
let timer: NodeJS.Timeout | null = null;
let running = false;
// In-memory back-off when the sweep itself crashes (not per-company errors).
// Per-company failures are part of a "successful" sweep — the day is done
// and admins see them on the result blob. A top-level crash, by contrast,
// must be retryable, so we deliberately do NOT advance lastRunAt; the
// back-off prevents tick-storm retries while waiting for the underlying
// fix.
let nextRetryAfter: number | null = null;

function sameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export interface ExpirySweepRunSummary {
  startedAt: string;
  finishedAt: string;
  companies: Array<{
    companyId: string;
    companyName: string;
    expiredCount?: number;
    expiredAmount?: number;
    obligationIds?: string[];
    error?: string;
  }>;
  totalExpiredCount: number;
  totalExpiredAmount: number;
}

export async function runDailyExpirySweepForAllCompanies(): Promise<ExpirySweepRunSummary> {
  const startedAt = new Date();
  const summary: ExpirySweepRunSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    companies: [],
    totalExpiredCount: 0,
    totalExpiredAmount: 0,
  };

  const active = await db.select().from(companies).where(eq(companies.status, 'A'));
  console.log(`[obligation-expiry-scheduler] starting nightly sweep for ${active.length} active companies`);

  for (const c of active) {
    try {
      const result = await runObligationExpirySweep({
        companyId: c.id,
        userId: 'system',
        userName: 'Nightly Expiry Sweep',
      });
      summary.companies.push({
        companyId: c.id,
        companyName: c.companyName,
        expiredCount: result.expiredCount,
        expiredAmount: result.expiredAmount,
        obligationIds: result.obligationIds,
      });
      summary.totalExpiredCount += result.expiredCount;
      summary.totalExpiredAmount += result.expiredAmount;
      if (result.expiredCount > 0) {
        console.log(`[obligation-expiry-scheduler] ${c.companyName} (${c.id}): expired ${result.expiredCount} obligation(s), $${result.expiredAmount.toFixed(2)}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[obligation-expiry-scheduler] ${c.companyName} (${c.id}) FAILED:`, msg);
      summary.companies.push({
        companyId: c.id,
        companyName: c.companyName,
        error: msg,
      });
    }
  }

  summary.finishedAt = new Date().toISOString();
  console.log(`[obligation-expiry-scheduler] sweep complete: ${summary.totalExpiredCount} obligation(s) expired across ${active.length} compan(ies), $${summary.totalExpiredAmount.toFixed(2)}`);
  return summary;
}

async function getSystemAdminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.isSystemAdmin, true), eq(users.isActive, true)));
  return rows
    .map(r => r.email)
    .filter((e): e is string => !!e && e.includes('@'));
}

function buildFailureEmailHtml(args: {
  startedAt: string;
  finishedAt?: string;
  crashError?: string | null;
  perCompanyErrors?: Array<{ companyName: string; error: string }>;
  totalCompanies?: number;
}): string {
  const { startedAt, finishedAt, crashError, perCompanyErrors, totalCompanies } = args;
  const rows = (perCompanyErrors ?? [])
    .map(e => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${escapeHtml(e.companyName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-family:Menlo,monospace;font-size:12px;">${escapeHtml(e.error)}</td>
      </tr>`)
    .join('');

  const summary = crashError
    ? `<p style="margin:0 0 16px;color:#111827;">The nightly obligation expiry sweep <strong>crashed</strong> before completing. The system will retry automatically within the next hour.</p>
       <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:0 0 16px;">
         <p style="margin:0;font-family:Menlo,monospace;font-size:12px;color:#991b1b;white-space:pre-wrap;">${escapeHtml(crashError)}</p>
       </div>`
    : `<p style="margin:0 0 16px;color:#111827;">The nightly obligation expiry sweep completed but <strong>${perCompanyErrors!.length}</strong> of <strong>${totalCompanies}</strong> compan${totalCompanies === 1 ? 'y' : 'ies'} failed. Other companies were processed successfully.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;border-spacing:0;margin:0 0 16px;">
         <thead><tr style="background:#f9fafb;">
           <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Company</th>
           <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Error</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:#dc2626;padding:16px 24px;color:#ffffff;">
      <h1 style="margin:0;font-size:18px;">LicenseIQ — Obligation Expiry Sweep Failed</h1>
    </td></tr>
    <tr><td style="padding:24px;">
      ${summary}
      <p style="margin:0;font-size:12px;color:#6b7280;">
        Started: ${escapeHtml(startedAt)}${finishedAt ? ` &middot; Finished: ${escapeHtml(finishedAt)}` : ''}<br/>
        Review details in <strong>System Settings → Obligation Expiry Sweep</strong>.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function notifyAdminsOfSweepFailure(args: {
  enableEmailNotifications: boolean;
  startedAt: Date;
  finishedAt?: Date;
  crashError?: string | null;
  perCompanyErrors?: Array<{ companyName: string; error: string }>;
  totalCompanies?: number;
}): Promise<boolean> {
  if (!args.enableEmailNotifications) {
    console.log('[obligation-expiry-scheduler] email notifications disabled — skipping admin alert');
    return false;
  }
  let recipients: string[];
  try {
    recipients = await getSystemAdminEmails();
  } catch (e: any) {
    console.error('[obligation-expiry-scheduler] failed to look up system admin emails:', e?.message || e);
    return false;
  }
  if (recipients.length === 0) {
    console.warn('[obligation-expiry-scheduler] no active system admins with email — skipping admin alert');
    return false;
  }

  const subject = args.crashError
    ? '[LicenseIQ] Nightly obligation expiry sweep CRASHED'
    : `[LicenseIQ] Nightly obligation expiry sweep had ${args.perCompanyErrors!.length} compan${args.perCompanyErrors!.length === 1 ? 'y' : 'ies'} fail`;

  const html = buildFailureEmailHtml({
    startedAt: args.startedAt.toISOString(),
    finishedAt: args.finishedAt?.toISOString(),
    crashError: args.crashError,
    perCompanyErrors: args.perCompanyErrors,
    totalCompanies: args.totalCompanies,
  });

  try {
    await sendZohoEmail({ to: recipients, subject, html });
    console.log(`[obligation-expiry-scheduler] sweep-failure alert sent to ${recipients.length} admin(s)`);
    return true;
  } catch (e: any) {
    console.error('[obligation-expiry-scheduler] failed to send admin failure email:', e?.message || e);
    return false;
  }
}

async function tick(): Promise<void> {
  if (running) return;
  if (nextRetryAfter && Date.now() < nextRetryAfter) return;
  running = true;
  try {
    const [settings] = await db.select().from(systemSettings).limit(1);
    if (!settings) return;
    if (!settings.obligationExpirySweepEnabled) return;

    const hour = settings.obligationExpirySweepHourUtc ?? 2;
    const now = new Date();
    if (now.getUTCHours() < hour) return;

    const last = settings.obligationExpirySweepLastRunAt;
    if (last && sameUtcDay(new Date(last), now)) return;

    let summary: ExpirySweepRunSummary | null = null;
    let crashError: string | null = null;
    try {
      summary = await runDailyExpirySweepForAllCompanies();
    } catch (e: any) {
      crashError = e?.message || String(e);
      console.error('[obligation-expiry-scheduler] sweep crashed:', e);
    }

    if (crashError) {
      // Top-level crash — DO NOT advance lastRunAt so the next tick can
      // retry once the back-off elapses. Surface the error to admins.
      nextRetryAfter = Date.now() + CRASH_RETRY_MS;
      // Each crash is its own "failed run" identified by a fresh
      // crashStartedAt. Persist the marker atomically and only emit the
      // email if this run's marker hasn't already been recorded as
      // notified (guards against e.g. a single tick's writeback running
      // twice). Because `running` + `nextRetryAfter` already serialize
      // tick entry, in practice the !alreadyNotified branch always fires
      // on each new crash attempt.
      const crashStartedAt = new Date();
      const alreadyNotifiedThisRun =
        settings.obligationExpirySweepLastCrashStartedAt
        && settings.obligationExpirySweepLastNotifiedAt
        && settings.obligationExpirySweepLastCrashStartedAt.getTime() === crashStartedAt.getTime()
        && settings.obligationExpirySweepLastNotifiedAt.getTime() >= crashStartedAt.getTime();
      let notifiedAt: Date | undefined;
      if (!alreadyNotifiedThisRun) {
        const sent = await notifyAdminsOfSweepFailure({
          enableEmailNotifications: settings.enableEmailNotifications,
          startedAt: crashStartedAt,
          crashError,
        });
        if (sent) notifiedAt = new Date();
      }
      await db.update(systemSettings)
        .set({
          obligationExpirySweepLastError: crashError,
          obligationExpirySweepLastCrashStartedAt: crashStartedAt,
          ...(notifiedAt ? { obligationExpirySweepLastNotifiedAt: notifiedAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, settings.id));
      return;
    }

    // Successful sweep (per-company errors are recorded but the day is
    // considered done — admins see them on the result blob).
    nextRetryAfter = null;
    const perCompanyErrors = summary!.companies.filter(c => c.error) as Array<{ companyName: string; error: string }>;
    const aggregateError = perCompanyErrors.length === 0
      ? null
      : perCompanyErrors.map(c => `${c.companyName}: ${c.error}`).join('; ');

    // jsonb column stores an arbitrary JSON-serializable shape; the typed
    // ExpirySweepRunSummary above is the canonical structure persisted here.
    const lastResult: ExpirySweepRunSummary = summary!;
    const newLastRunAt = new Date();

    // Email admins about per-company failures. The current run's unique
    // marker is `newLastRunAt` (generated in this tick). We only skip if
    // lastNotifiedAt is already >= newLastRunAt, which in practice can
    // only happen if this tick's writeback is somehow replayed. The
    // normal `sameUtcDay(lastRunAt, now)` guard at the top of tick()
    // already ensures one sweep per UTC day, so the next failed run
    // (next day) always has a strictly greater newLastRunAt and is
    // correctly notified.
    let notifiedAt: Date | undefined;
    if (perCompanyErrors.length > 0) {
      const alreadyNotifiedThisRun = settings.obligationExpirySweepLastNotifiedAt
        && settings.obligationExpirySweepLastNotifiedAt.getTime() >= newLastRunAt.getTime();
      if (!alreadyNotifiedThisRun) {
        const sent = await notifyAdminsOfSweepFailure({
          enableEmailNotifications: settings.enableEmailNotifications,
          startedAt: new Date(summary!.startedAt),
          finishedAt: new Date(summary!.finishedAt),
          perCompanyErrors,
          totalCompanies: summary!.companies.length,
        });
        if (sent) notifiedAt = newLastRunAt;
      }
    }

    await db.update(systemSettings)
      .set({
        obligationExpirySweepLastRunAt: newLastRunAt,
        obligationExpirySweepLastError: aggregateError,
        obligationExpirySweepLastResult: lastResult,
        ...(notifiedAt ? { obligationExpirySweepLastNotifiedAt: notifiedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, settings.id));
  } catch (e) {
    console.error('[obligation-expiry-scheduler] tick error:', e);
  } finally {
    running = false;
  }
}

export function startObligationExpiryScheduler(): void {
  if (timer) return;
  console.log('[obligation-expiry-scheduler] started (tick every 5 min)');
  // Fire one tick shortly after boot so a long-overdue sweep runs without
  // waiting up to 5 minutes.
  setTimeout(() => { void tick(); }, 30 * 1000);
  timer = setInterval(() => { void tick(); }, TICK_MS);
}

export function stopObligationExpiryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
