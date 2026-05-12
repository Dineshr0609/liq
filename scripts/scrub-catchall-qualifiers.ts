/**
 * scrub-catchall-qualifiers.ts
 *
 * One-time cleanup for stale `["General", "!ProductX", ...]` qualifier sets
 * left over on non-product rule types (minimum_guarantee, payment_schedule,
 * fixed_fee, cap, mdf_accrual, etc.) that were extracted BEFORE the
 * NON_PRODUCT_RULE_TYPES allowlist landed in pipelineService + groqService.
 *
 * For each rule whose ruleType is in the non-product allowlist:
 *   1. Set product_categories = [] and territories = [] on the rule
 *   2. Delete contract_qualifiers rows for that rule whose qualifier_value
 *      is "General" or starts with "!"
 *
 * Dry-run by default. Pass `--apply` to actually mutate the database.
 *
 * Usage:
 *   npx tsx scripts/scrub-catchall-qualifiers.ts            # dry-run
 *   npx tsx scripts/scrub-catchall-qualifiers.ts --apply    # apply changes
 *   npx tsx scripts/scrub-catchall-qualifiers.ts --contract <id> [--apply]
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

// Keep this list in sync with pipelineService.ts / groqService.ts /
// rulesRoutes.ts. (See replit.md: there's a follow-up to promote this
// to a single shared constant.)
const NON_PRODUCT_RULE_TYPES = [
  "minimum_guarantee",
  "payment_schedule",
  "fixed_fee",
  "annual_fee",
  "milestone_payment",
  "late_payment_penalty",
  "cap",
  "period_cap",
  "contract_cap",
  "mdf_accrual",
  "recoupable_advance",
  "advance_payment",
  "signing_bonus",
];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const contractIdx = args.indexOf("--contract");
const CONTRACT_FILTER: string | null = contractIdx >= 0 ? args[contractIdx + 1] ?? null : null;

async function main() {
  console.log(`[scrub-catchall-qualifiers] mode=${APPLY ? "APPLY" : "DRY-RUN"}` + (CONTRACT_FILTER ? ` contract=${CONTRACT_FILTER}` : ""));

  // 1. Find candidate rules.
  //    Inline the rule-type list as quoted SQL literals — drizzle's sql
  //    template can't bind a JS array to PG's ANY() without an explicit
  //    array cast, and IN-list with sql.join is cleanest here.
  const typeList = sql.join(NON_PRODUCT_RULE_TYPES.map((t) => sql`${t}`), sql`, `);
  const ruleResult = await db.execute(sql`
    SELECT id, contract_id, rule_name, rule_type, source_clause_id,
           product_categories, territories
    FROM contract_rules
    WHERE rule_type IN (${typeList})
      AND (
        (product_categories IS NOT NULL AND array_length(product_categories, 1) > 0)
        OR (territories IS NOT NULL AND array_length(territories, 1) > 0)
      )
      ${CONTRACT_FILTER ? sql`AND contract_id = ${CONTRACT_FILTER}` : sql``}
  `);
  const rules = (ruleResult as any).rows as Array<{
    id: string;
    contract_id: string;
    rule_name: string | null;
    rule_type: string;
    source_clause_id: string | null;
    product_categories: string[] | null;
    territories: string[] | null;
  }>;

  if (rules.length === 0) {
    console.log("[scrub-catchall-qualifiers] No rules need scrubbing. Done.");
    return;
  }

  console.log(`[scrub-catchall-qualifiers] Found ${rules.length} rule(s) to scrub:\n`);

  let arraysCleared = 0;
  let qualifiersToDelete = 0;

  for (const r of rules) {
    const cats = r.product_categories ?? [];
    const terrs = r.territories ?? [];

    // Identify which qualifier rows would be deleted (General / !-prefixed only).
    const staleProducts = cats.filter((v) => v === "General" || v.startsWith("!"));
    const staleTerritories = terrs.filter((v) => v === "General" || v.startsWith("!"));
    const stale = [...staleProducts, ...staleTerritories];

    console.log(
      `  · rule ${r.id.substring(0, 8)} (${r.rule_type})  "${r.rule_name ?? ""}"\n` +
      `      contract=${r.contract_id.substring(0, 8)}  products=${JSON.stringify(cats)}  territories=${JSON.stringify(terrs)}\n` +
      `      stale-product-qualifier-values=${JSON.stringify(stale)}`,
    );

    if (APPLY) {
      // (a) Clear arrays on the rule
      await db.execute(sql`
        UPDATE contract_rules
        SET product_categories = ARRAY[]::text[],
            territories = ARRAY[]::text[]
        WHERE id = ${r.id}
      `);

      // (b) Delete stale qualifier rows scoped to this rule's clause
      // (or rule:<id> termId for clauseless). Only deletes rows whose
      // qualifier_value is "General" OR starts with "!" — never deletes
      // legitimate per-product rows.
      const delResult = await db.execute(sql`
        DELETE FROM contract_qualifiers
        WHERE contract_id = ${r.contract_id}
          AND qualifier_field IN ('product', 'product_category')
          AND (qualifier_value = 'General' OR qualifier_value LIKE '!%')
          AND (
            ${r.source_clause_id ? sql`contract_clause_id = ${r.source_clause_id}` : sql`term_id = ${`rule:${r.id}`}`}
          )
      `);
      const deleted = (delResult as any).rowCount ?? 0;
      qualifiersToDelete += deleted;
      console.log(`      → cleared arrays, deleted ${deleted} qualifier row(s)`);
    } else {
      qualifiersToDelete += stale.length;
    }

    arraysCleared += 1;
  }

  console.log(`\n[scrub-catchall-qualifiers] ${APPLY ? "APPLIED" : "WOULD APPLY"}:`);
  console.log(`  · ${arraysCleared} rule array(s) cleared`);
  console.log(`  · ${qualifiersToDelete} stale qualifier row(s) ${APPLY ? "deleted" : "to delete"}`);
  if (!APPLY) {
    console.log(`\nRe-run with --apply to commit the changes.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[scrub-catchall-qualifiers] FAILED:", err);
    process.exit(1);
  });
