#!/bin/bash
# Non-interactive post-merge sync.
#
# Safety model:
#   1. PREVIEW the planned schema changes WITHOUT applying them by feeding
#      `n` (no) responses to drizzle-kit's confirmation prompts. This causes
#      drizzle-kit to print every statement it would run, then exit, leaving
#      the database untouched.
#   2. CLASSIFY destructive operations the preview reports against a known
#      baseline. If everything is in the baseline (and therefore expected),
#      soft-warn and skip the apply phase but continue with the rest of the
#      post-merge run. If anything new shows up, fail loudly.
#   3. Only when the preview is entirely clean do we apply the changes with
#      --force.
#
# Any drizzle-kit failure (other than the expected non-zero from declining
# the preview prompt) propagates and aborts the run.
set -euo pipefail

echo "[post-merge] Installing dependencies..."
npm install

echo "[post-merge] Type-checking the project against the TS error baseline..."
# Mirrors the intent of `npm run check`. The dev server (tsx) and the
# production build (esbuild) both strip types without checking them, so
# without this gate broken type contracts only surface in editors AFTER
# they've already been merged.
#
# The naive `tsc --noEmit` form is unusable here because the project
# carries ~1500 inherited TS errors (mostly from drizzle-zod 0.7.x's
# stricter mask typing on `.pick({...})` / `.omit({...})`). Paying that
# down is its own multi-day effort. Until then we use a baseline-aware
# comparator that fails only on NEW (file, error-code) regressions
# introduced by THIS merge. See scripts/check-tsc-baseline.sh.
bash scripts/check-tsc-baseline.sh

echo "[post-merge] Checking foreign-key name lengths..."
npx tsx scripts/check-fk-names.ts

echo "[post-merge] Checking for forbidden sql\`... = ANY(\${jsArray})\` patterns..."
bash scripts/check-sql-any-array.sh

echo "[post-merge] Previewing planned schema changes (no apply)..."
PLAN_TIMEOUT_S="${PLAN_TIMEOUT_S:-90}"
PLAN_OUT="$(mktemp)"
set +e
( yes n 2>/dev/null | timeout --kill-after=5s "${PLAN_TIMEOUT_S}s" \
    npx drizzle-kit push --verbose ) > "$PLAN_OUT" 2>&1
PLAN_EXIT=$?
set -e
PLAN="$(tr -d '\r' < "$PLAN_OUT")"
rm -f "$PLAN_OUT"
echo "$PLAN"

# Sanity check: drizzle-kit must have actually run, even if it later hung
# on an interactive prompt. Look for any of: introspection markers, "no
# changes" outcome, raw SQL output, or the "you're about to ..." summary
# lines that precede the destructive-confirmation prompt.
if ! grep -qiE 'Pulling schema|No changes detected|ALTER |CREATE |DROP |about to (delete|truncate|change)' <<< "$PLAN"; then
  echo "[post-merge] ERROR: schema preview did not produce recognizable output."
  echo "[post-merge] Refusing to proceed."
  exit 1
fi

# ---------------------------------------------------------------------------
# Known baseline drift.
#
# The following 18 tables exist in the production database but are NOT
# defined in shared/schema.ts. They are accessed by the application via
# raw SQL (`pool.query(...)`) rather than through Drizzle. Until they are
# either modeled in Drizzle or formally retired (covered by project task
# #45 "Retire Contract Types" and adjacent cleanup), drizzle-kit will
# always want to drop them on every push.
#
# The session table holds connect-pg-simple auth sessions; dropping it
# logs every user out. The product/master-data tables hold ~1300 rows of
# active business data referenced from server services. Treat all of
# these as "leave alone" baseline drift, not as something to apply.
# ---------------------------------------------------------------------------
KNOWN_PHANTOM_TABLES=(
  "_legacy_policy_rules_archive"
  "city_master"
  "company_master"
  "country_master"
  "ddl_audit"
  "partner_master"
  "product_attributes"
  "product_bom"
  "product_channel_matrix"
  "product_classifications"
  "product_hierarchy"
  "product_packaging_matrix"
  "product_territory_matrix"
  "products"
  "sales_channels"
  "session"
  "state_master"
  "territory_master"
)

# Tables that drizzle-kit chooses to TRUNCATE-then-recreate as part of the
# baseline column-type widening (varchar(255) -> varchar) on their PK/FK
# columns. These are real tables defined in shared/schema.ts; the truncate
# is a side-effect of the type change, not a schema rename. We allow-list
# the truncate here only because we ALSO refuse to apply (the data is
# preserved by virtue of skipping the apply phase). If task #45 lands and
# the column types are reconciled, these truncates will disappear from the
# preview entirely.
KNOWN_TRUNCATE_TABLES=(
  "integration_connections"
  "integration_endpoint_templates"
  "integration_health_events"
  "licenseiq_api_endpoints"
)

is_known_truncate_table() {
  local needle="$1"
  for t in "${KNOWN_TRUNCATE_TABLES[@]}"; do
    if [ "$t" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

# Single ALTER ... SET NOT NULL the schema wants but the DB can't currently
# apply because of a legacy NULL-value row in users.username. Tracked
# alongside task #45 as part of the broader baseline cleanup.
KNOWN_SET_NOT_NULL_OPS=(
  'ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;'
)

is_known_set_not_null() {
  local needle="$1"
  for op in "${KNOWN_SET_NOT_NULL_OPS[@]}"; do
    if [ "$op" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

# Helper: is a table name in the phantom allow-list?
is_phantom_table() {
  local needle="$1"
  for t in "${KNOWN_PHANTOM_TABLES[@]}"; do
    if [ "$t" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

# Parse drizzle-kit's interactive "you're about to ..." lines and classify
# each as either KNOWN baseline or UNKNOWN (i.e. something new this merge
# introduced).
UNKNOWN_OPS=""

while IFS= read -r line; do
  [ -z "$line" ] && continue
  tbl="$(echo "$line" | sed -nE "s/.*delete ([A-Za-z_][A-Za-z0-9_]*) table.*/\1/p")"
  if [ -z "$tbl" ]; then
    UNKNOWN_OPS+="$line"$'\n'
    continue
  fi
  if ! is_phantom_table "$tbl"; then
    UNKNOWN_OPS+="$line"$'\n'
  fi
done < <(echo "$PLAN" | grep -E "You're about to delete .+ table with" || true)

while IFS= read -r line; do
  [ -z "$line" ] && continue
  # The only "change" we treat as safe is widening varchar(255) -> varchar
  # (i.e. removing the length cap, which never truncates data).
  if ! echo "$line" | grep -qE "from varchar\(255\) to varchar with"; then
    UNKNOWN_OPS+="$line"$'\n'
  fi
done < <(echo "$PLAN" | grep -E "You're about to change " || true)

while IFS= read -r line; do
  [ -z "$line" ] && continue
  UNKNOWN_OPS+="$line"$'\n'
done < <(echo "$PLAN" | grep -E "You're about to truncate" || true)

# Raw SQL drizzle-kit prints in its preview. Some of these are part of the
# known baseline (the four integration_* truncates that come along with
# the column-type widening, plus the users.username SET NOT NULL the DB
# can't accept until the legacy NULL row is reconciled). Anything else
# raw-destructive is unknown.
while IFS= read -r line; do
  [ -z "$line" ] && continue
  tbl="$(echo "$line" | sed -nE 's/^[[:space:]]*truncate table "([^"]+)" cascade;.*/\1/p')"
  if [ -n "$tbl" ] && is_known_truncate_table "$tbl"; then
    continue
  fi
  UNKNOWN_OPS+="$line"$'\n'
done < <(echo "$PLAN" | grep -iE '^[[:space:]]*truncate[[:space:]]+table[[:space:]]+"[^"]+"' || true)

while IFS= read -r line; do
  [ -z "$line" ] && continue
  trimmed="$(echo "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  if is_known_set_not_null "$trimmed"; then
    continue
  fi
  UNKNOWN_OPS+="$line"$'\n'
done < <(echo "$PLAN" | grep -iE 'ALTER[[:space:]]+TABLE[[:space:]]+"[^"]+"[[:space:]]+ALTER[[:space:]]+COLUMN[[:space:]]+"[^"]+"[[:space:]]+SET[[:space:]]+NOT[[:space:]]+NULL' || true)

# Other raw-destructive patterns we never expect. Note we deliberately do
# NOT scan for `^TRUNCATE` here because we already classified the truncate
# table lines above; a generic TRUNCATE scan would double-count the known
# integration_* ones.
RAW_DESTRUCTIVE_PATTERNS=(
  '^[[:space:]]*DROP[[:space:]]+SCHEMA\b'
  '^[[:space:]]*DROP[[:space:]]+TYPE\b'
  '^[[:space:]]*DROP[[:space:]]+SEQUENCE\b'
  'ALTER[[:space:]]+TABLE[[:space:]]+"[^"]+"[[:space:]]+RENAME\b'
)
for pat in "${RAW_DESTRUCTIVE_PATTERNS[@]}"; do
  HITS="$(echo "$PLAN" | grep -Ei "$pat" || true)"
  if [ -n "$HITS" ]; then
    UNKNOWN_OPS+="$HITS"$'\n'
  fi
done

# Strip out the menu-prompt line drizzle-kit prints AFTER the destructive
# warning ("Yes, I want to remove N tables, truncate N tables") -- it's
# the option label of the interactive arrow-key menu, not an operation.
UNKNOWN_OPS="$(echo "$UNKNOWN_OPS" | grep -vE 'Yes, I want to remove .+ tables?, truncate .+ tables?' || true)"

# Did drizzle-kit get killed by the timeout while waiting on an arrow-key
# prompt? That on its own is not fatal -- we may have captured the full
# preview before it hung. If we have no preview content AT ALL, then the
# timeout is a real hang and we abort.
TIMED_OUT=0
if [ "$PLAN_EXIT" -eq 124 ] || [ "$PLAN_EXIT" -eq 137 ]; then
  TIMED_OUT=1
fi

# Decide what to do.
if [ -n "$UNKNOWN_OPS" ]; then
  echo ""
  echo "[post-merge] ERROR: NEW destructive schema drift detected on top of"
  echo "[post-merge] the known phantom-table baseline. Refusing to apply."
  echo "[post-merge] Review the following operations and resolve in"
  echo "[post-merge] shared/schema.ts (or apply manually with"
  echo "[post-merge] \`npx drizzle-kit push --force\` after review):"
  echo "----------------------------------------------------------------"
  echo "$UNKNOWN_OPS"
  echo "----------------------------------------------------------------"
  exit 1
fi

# Did the preview report ANY destructive ops at all (i.e. was the drift
# the known baseline rather than nothing)?
BASELINE_DELETES="$(echo "$PLAN" | grep -cE "You're about to delete .+ table with" || true)"
BASELINE_CHANGES="$(echo "$PLAN" | grep -cE "You're about to change .* from varchar\(255\) to varchar" || true)"
BASELINE_TOTAL=$(( BASELINE_DELETES + BASELINE_CHANGES ))

if [ "$BASELINE_TOTAL" -gt 0 ] || [ "$TIMED_OUT" -eq 1 ]; then
  echo ""
  echo "[post-merge] WARNING: known phantom-table baseline drift detected."
  echo "[post-merge]   ${BASELINE_DELETES} phantom-table drops (allow-listed)"
  echo "[post-merge]   ${BASELINE_CHANGES} safe varchar(255)->varchar widenings"
  echo "[post-merge] Skipping the automatic apply phase to preserve ~1300 rows"
  echo "[post-merge] of business data in tables that exist in the DB but not"
  echo "[post-merge] in shared/schema.ts. This baseline is tracked under"
  echo "[post-merge] project task #45 (Retire Contract Types)."
  echo "[post-merge]"
  echo "[post-merge] If THIS merge added new tables / columns / indexes that"
  echo "[post-merge] need to land in the DB, scan the preview output above"
  echo "[post-merge] for CREATE TABLE / ADD COLUMN / CREATE INDEX statements"
  echo "[post-merge] that are NOT already in the DB, and apply them manually"
  echo "[post-merge] (psql can run them directly). Drizzle-kit's --force will"
  echo "[post-merge] also drop the 18 phantom tables, so do NOT use it until"
  echo "[post-merge] task #45 reconciles them."
elif echo "$PLAN" | grep -qi 'No changes detected'; then
  echo "[post-merge] Schema in sync. Nothing to apply."
else
  echo "[post-merge] Preview is clean. Applying schema changes..."
  npx drizzle-kit push --force --verbose
  echo "[post-merge] Schema changes applied."
fi

echo "[post-merge] Applying additive DDL that drizzle-kit's auto-apply skipped..."
# These are idempotent (IF NOT EXISTS) and only add columns / indexes /
# constraints that shared/schema.ts already declares. They are needed
# because the preview phase above has to skip --force to protect the 18
# phantom tables from being dropped (task #45). Each script in this
# directory must be safe to re-run on every merge.
for ddl in scripts/apply-task68-ddl.ts scripts/apply-task69-ddl.ts; do
  if [ -f "$ddl" ]; then
    echo "[post-merge]   -> $ddl"
    npx tsx "$ddl"
  fi
done

echo "[post-merge] Running end-to-end template flow tests..."
bash scripts/run-template-tests.sh
echo "[post-merge] Template flow tests passed."
