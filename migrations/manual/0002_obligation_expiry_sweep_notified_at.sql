-- ============================================================================
-- Task #18 — Email admins when the nightly obligation sweep fails
-- Manual migration applied 2026-04-20.
--
-- drizzle-kit push was blocked on an unrelated interactive prompt
-- (obligation_events rename/create disambiguation), so the single new
-- column was applied with this raw-SQL script. This file is checked in
-- so the change is auditable and re-runnable on any environment that
-- hasn't picked it up yet.
--
-- Adds the columns declared in shared/schema.ts:
--   system_settings.obligation_expiry_sweep_last_notified_at       timestamp (nullable)
--   system_settings.obligation_expiry_sweep_last_crash_started_at  timestamp (nullable)
--
-- Used by server/services/obligationExpiryScheduler.ts to dedupe admin
-- failure emails so we never send more than one alert per failed sweep
-- run (per-company failures keyed to last_run_at; crashes keyed to the
-- 1-hour CRASH_RETRY_MS back-off window).
-- ============================================================================

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS obligation_expiry_sweep_last_notified_at      timestamp,
  ADD COLUMN IF NOT EXISTS obligation_expiry_sweep_last_crash_started_at timestamp;
