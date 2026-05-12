#!/bin/bash
# Refuse to land Drizzle `sql\`... = ANY(${jsArray}::text[])\`` patterns.
#
# Why:
#   The @neondatabase/serverless driver binds a JS array interpolated into a
#   Drizzle `sql` template literal as a composite `record`, which Postgres then
#   rejects with `cannot cast type record to text[]`. The whole request 500s.
#   We hit this in `listVisibleTemplates` (task #52) and want to keep the
#   anti-pattern from coming back.
#
# What to use instead:
#   - Drizzle's typed `inArray(column, jsArray)` operator (preferred).
#   - `sql.join(values.map(v => sql\`${v}\`), sql\`, \`)` for an `IN (...)` list
#     when you absolutely need a raw `sql` template.
#
# Notes:
#   - We only block the `${...}` (JS template interpolation) form. Raw
#     `pool.query` calls that bind through `$1::text[]` placeholders are fine
#     because pg sends them as native arrays.
#   - The two existing matches in `server/services/contractTemplateService.ts`
#     are documentation comments describing this anti-pattern; they are
#     allow-listed below so the guard stays useful without flagging itself.
set -euo pipefail

# Matches the broken Drizzle interpolation form regardless of whitespace
# between `=`, `ANY`, and `(`, and tolerates multiline gaps inside the
# parentheses. Examples caught:
#   sql`... = ANY(${ids}::text[])`
#   sql`...=ANY( ${ids} )`
#   sql`... = ANY  (${ids}::uuid[])`
PATTERN='=\s*ANY\s*\(\s*\$\{'

HITS="$(rg -nU --multiline --type ts "$PATTERN" server shared 2>/dev/null \
  | grep -v '// NOTE: build IN-list via sql.join' \
  | grep -v '// .*sql\\`\.\.\. = ANY' \
  || true)"

if [ -n "$HITS" ]; then
  echo "[check-sql-any-array] Found Drizzle sql\`... = ANY(\${jsArray})\` usage."
  echo "[check-sql-any-array] This pattern 500s on @neondatabase/serverless."
  echo "[check-sql-any-array] Use \`inArray(column, jsArray)\` from drizzle-orm instead."
  echo "----------------------------------------------------------------"
  echo "$HITS"
  echo "----------------------------------------------------------------"
  exit 1
fi

echo "[check-sql-any-array] No forbidden ANY(\${...}) interpolations found."
