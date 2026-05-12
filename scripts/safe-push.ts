#!/usr/bin/env tsx
/**
 * Non-interactive replacement for `drizzle-kit push`.
 *
 * Why this exists:
 *   `drizzle-kit push` is interactive — when the schema introduces a new
 *   table AND the database has tables not in the schema (legacy/orphan
 *   tables we cannot remove), drizzle-kit asks "is this a rename of …?"
 *   on /dev/tty. In a non-TTY post-merge environment the prompt blocks
 *   forever and the river kills the script with CANCEL.
 *
 * What this does:
 *   Uses drizzle-kit's programmatic `pushSchema` API to compute the diff
 *   without prompts, scans the generated SQL for destructive operations,
 *   refuses to apply if anything risky is present, otherwise calls
 *   `apply()`. Identical safety model to scripts/post-merge.sh, just
 *   without the rename-prompt deadlock.
 */
import { createRequire } from "module";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";

// drizzle-kit/api ships an ESM build that uses `require()` internally and
// crashes under tsx's ESM loader. Load it via CJS via createRequire instead.
const requireCjs = createRequire(import.meta.url);
const { pushSchema } = requireCjs("drizzle-kit/api") as {
  pushSchema: (
    imports: Record<string, unknown>,
    db: any,
  ) => Promise<{
    hasDataLoss: boolean;
    warnings: string[];
    statementsToExecute: string[];
    apply: () => Promise<void>;
  }>;
};

neonConfig.webSocketConstructor = ws;

const DESTRUCTIVE = [
  /^\s*DROP\s+TABLE\b/i,
  /^\s*DROP\s+SCHEMA\b/i,
  /^\s*DROP\s+TYPE\b/i,
  /^\s*DROP\s+SEQUENCE\b/i,
  /^\s*DROP\s+INDEX\b/i,
  /^\s*DROP\s+VIEW\b/i,
  /ALTER\s+TABLE\s+"[^"]+"\s+DROP\s+COLUMN\b/i,
  /ALTER\s+TABLE\s+"[^"]+"\s+DROP\s+CONSTRAINT\b/i,
  /ALTER\s+TABLE\s+"[^"]+"\s+ALTER\s+COLUMN\s+"[^"]+"\s+SET\s+DATA\s+TYPE\b/i,
  /ALTER\s+TABLE\s+"[^"]+"\s+RENAME\b/i,
  /ALTER\s+TABLE\s+"[^"]+"\s+ALTER\s+COLUMN\s+"[^"]+"\s+SET\s+NOT\s+NULL\b/i,
  /\bTRUNCATE\b/i,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[safe-push] DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  console.log("[safe-push] Computing schema diff...");
  const result = await pushSchema(schema as any, db as any);
  const stmts = result.statementsToExecute ?? [];

  if (stmts.length === 0) {
    console.log("[safe-push] Schema in sync. Nothing to apply.");
    await pool.end();
    return;
  }

  console.log(`[safe-push] ${stmts.length} statement(s) to apply:`);
  for (const s of stmts) console.log("  " + s.replace(/\s+/g, " ").slice(0, 200));

  const risky: string[] = [];
  for (const s of stmts) {
    for (const re of DESTRUCTIVE) {
      if (re.test(s)) {
        risky.push(s);
        break;
      }
    }
  }

  if (risky.length > 0) {
    console.error("");
    console.error("[safe-push] ERROR: destructive or risky operations detected:");
    console.error("----------------------------------------------------------------");
    for (const s of risky) console.error(s);
    console.error("----------------------------------------------------------------");
    console.error("[safe-push] Refusing to apply automatically. Review and run manually if intended.");
    await pool.end();
    process.exit(1);
  }

  if (result.warnings && result.warnings.length > 0) {
    console.warn("[safe-push] Warnings from drizzle-kit:");
    for (const w of result.warnings) console.warn("  " + w);
  }

  console.log("[safe-push] Diff is clean. Applying...");
  await result.apply();
  console.log("[safe-push] Applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("[safe-push] FAILED:", err?.message || err);
  console.error(err?.stack || "");
  process.exit(1);
});
