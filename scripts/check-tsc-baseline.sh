#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Baseline-aware TypeScript gate.
#
# Background: the project carries a substantial pre-existing TypeScript debt
# (~1500 errors, mostly around drizzle-zod 0.7.x's stricter `.pick({...})` /
# `.omit({...})` mask typing). A hard `tsc --noEmit` in post-merge would
# block every merge until that debt is paid down, which is well outside the
# scope of any single task.
#
# This script keeps the protective intent of the gate (catch *new* type
# regressions before they ship) while tolerating the inherited baseline.
#
# Mechanics:
#   1. Run tsc --noEmit, capture per-(file, error-code) counts.
#   2. Compare each pair against scripts/baseline-tsc-errors.txt (same
#      format: "<count> <file>:TS####").
#   3. Fail only if any (file, error-code) count INCREASED — i.e. a real
#      regression was introduced by THIS merge.
#   4. Print a friendly hint when the working tree has FEWER errors than
#      the baseline, so the team knows to refresh the snapshot.
#
# To refresh the baseline after legitimately reducing errors:
#   bash scripts/check-tsc-baseline.sh --update-baseline
# ---------------------------------------------------------------------------
set -euo pipefail

BASELINE_FILE="scripts/baseline-tsc-errors.txt"

if [ ! -f "$BASELINE_FILE" ]; then
  echo "[check-tsc-baseline] Missing baseline file: $BASELINE_FILE" >&2
  echo "[check-tsc-baseline] Generate it once with: bash scripts/check-tsc-baseline.sh --update-baseline" >&2
  exit 1
fi

TMP_CURRENT="$(mktemp)"
trap 'rm -f "$TMP_CURRENT"' EXIT

# tsc is allowed to exit non-zero -- we read its diagnostic stream and
# classify ourselves. The "|| true" prevents `set -e` from aborting.
( npx tsc --noEmit 2>&1 || true ) \
  | grep -E "^[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+" \
  | sed -E 's|^([^(]+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+).*|\1:\4|' \
  | sort \
  | uniq -c \
  | awk '{printf "%6d %s\n", $1, $2}' \
  | sort -k2 \
  > "$TMP_CURRENT"

if [ "${1:-}" = "--update-baseline" ]; then
  cp "$TMP_CURRENT" "$BASELINE_FILE"
  TOTAL=$(awk '{s+=$1} END{print s+0}' "$BASELINE_FILE")
  ENTRIES=$(wc -l < "$BASELINE_FILE")
  echo "[check-tsc-baseline] Baseline refreshed: ${TOTAL} errors across ${ENTRIES} (file, error-code) pairs."
  exit 0
fi

CURRENT_TOTAL=$(awk '{s+=$1} END{print s+0}' "$TMP_CURRENT")
BASELINE_TOTAL=$(awk '{s+=$1} END{print s+0}' "$BASELINE_FILE")

# Regressions: any (file, errcode) where current count > baseline count
# (including pairs that aren't in the baseline at all).
REGRESSIONS=$(awk '
  NR==FNR { base[$2]=$1; next }
  { cur=$1; key=$2; b=(key in base)?base[key]:0;
    if (cur > b) printf "  +%d %s (baseline %d, now %d)\n", cur-b, key, b, cur }
' "$BASELINE_FILE" "$TMP_CURRENT")

if [ -n "$REGRESSIONS" ]; then
  echo "[check-tsc-baseline] FAIL: TypeScript regressions detected against baseline." >&2
  echo "$REGRESSIONS" >&2
  echo "" >&2
  echo "[check-tsc-baseline] Each line is a (file, error-code) pair whose error count went UP." >&2
  echo "[check-tsc-baseline] Either fix the new errors, or — if you legitimately need to" >&2
  echo "[check-tsc-baseline] grow the baseline (e.g. landing a known-debt refactor) — refresh" >&2
  echo "[check-tsc-baseline] the snapshot with: bash scripts/check-tsc-baseline.sh --update-baseline" >&2
  exit 1
fi

# Improvements: any baseline entry whose count is now strictly lower (or zero).
IMPROVEMENTS=$(awk '
  NR==FNR { cur[$2]=$1; next }
  { b=$1; key=$2; c=(key in cur)?cur[key]:0;
    if (c < b) printf "  -%d %s (baseline %d, now %d)\n", b-c, key, b, c }
' "$TMP_CURRENT" "$BASELINE_FILE")

echo "[check-tsc-baseline] OK. ${CURRENT_TOTAL} TS errors vs ${BASELINE_TOTAL} in baseline."
if [ -n "$IMPROVEMENTS" ]; then
  echo "[check-tsc-baseline] You're below baseline on these pairs (refresh snapshot when convenient):"
  echo "$IMPROVEMENTS"
fi
