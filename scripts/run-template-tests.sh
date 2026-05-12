#!/bin/bash
# Runs the end-to-end template flow tests against a live backend.
#
# Behavior:
#   * If the dev server is already responding on $PORT (default 5000),
#     reuse it.
#   * Otherwise, start `tsx server/index.ts` in the background, poll
#     until the API answers, then run the test suite, and stop the
#     server we started on exit.
#
# Exits non-zero on any failure so CI / post-merge can fail the build.
set -euo pipefail

PORT="${PORT:-5000}"
BASE_URL="${TEST_BASE_URL:-http://localhost:${PORT}}"
SERVER_LOG="${SERVER_LOG:-/tmp/run-template-tests.server.log}"

started_server=0
server_pid=

cleanup() {
  if [ "$started_server" -eq 1 ] && [ -n "$server_pid" ]; then
    echo "[run-template-tests] Stopping temporary server (pid=$server_pid)..."
    kill "$server_pid" 2>/dev/null || true
    # Give it a moment, then force.
    for _ in 1 2 3 4 5; do
      kill -0 "$server_pid" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

is_up() {
  # /api/user returns 200 when authenticated, 401 when not — both prove
  # the API is mounted and responding.
  local code
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "${BASE_URL}/api/user" 2>/dev/null || true)"
  [ "$code" = "200" ] || [ "$code" = "401" ]
}

port_in_use() {
  # Returns 0 if anything is listening on $PORT — even if it isn't yet
  # answering HTTP. Used to avoid racing a parallel `Start application`
  # workflow that's still booting on the same port.
  if command -v ss >/dev/null 2>&1; then
    ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}\$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
  else
    # Last-resort: try a TCP connect.
    (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null && { exec 3<&-; exec 3>&-; return 0; } || return 1
  fi
}

wait_for_up() {
  # Poll /api/user up to $1 seconds.
  local deadline=$1 i
  for i in $(seq 1 "$deadline"); do
    if is_up; then
      echo "[run-template-tests] Server is up after ${i}s."
      return 0
    fi
    sleep 1
  done
  return 1
}

if is_up; then
  echo "[run-template-tests] Detected existing server at ${BASE_URL}; reusing it."
elif port_in_use; then
  echo "[run-template-tests] Port ${PORT} is already bound (likely the dev server is still booting)."
  echo "[run-template-tests] Waiting for it to start answering HTTP — not starting a competing server..."
  if ! wait_for_up 90; then
    echo "[run-template-tests] ERROR: ${BASE_URL} never became reachable, and port ${PORT} is held by another process."
    exit 1
  fi
else
  echo "[run-template-tests] No server detected — starting one in the background..."
  : > "$SERVER_LOG"
  NODE_ENV=development PORT="$PORT" npx tsx server/index.ts >>"$SERVER_LOG" 2>&1 &
  server_pid=$!
  started_server=1

  echo "[run-template-tests] Waiting for ${BASE_URL} to become ready (pid=$server_pid)..."
  ready=0
  for i in $(seq 1 90); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
      echo "[run-template-tests] ERROR: server process exited early. Last log lines:"
      tail -n 80 "$SERVER_LOG" || true
      exit 1
    fi
    if is_up; then
      echo "[run-template-tests] Server is up after ${i}s."
      ready=1
      break
    fi
    sleep 1
  done

  if [ "$ready" -ne 1 ]; then
    echo "[run-template-tests] ERROR: server never became reachable at ${BASE_URL}. Last log lines:"
    tail -n 80 "$SERVER_LOG" || true
    exit 1
  fi
fi

shopt -s nullglob
TEST_FILES=( tests/*.e2e.test.ts )
shopt -u nullglob

if [ "${#TEST_FILES[@]}" -eq 0 ]; then
  echo "[run-template-tests] ERROR: no end-to-end test files matched tests/*.e2e.test.ts"
  exit 1
fi

echo "[run-template-tests] Running ${#TEST_FILES[@]} end-to-end test file(s):"
for f in "${TEST_FILES[@]}"; do echo "  - $f"; done

failures=0
for f in "${TEST_FILES[@]}"; do
  echo ""
  echo "[run-template-tests] >>> $f"
  if ! TEST_BASE_URL="$BASE_URL" npx tsx "$f"; then
    failures=$((failures + 1))
    echo "[run-template-tests] FAILED: $f"
  fi
done

if [ "$failures" -gt 0 ]; then
  echo ""
  echo "[run-template-tests] ERROR: $failures test file(s) failed."
  exit 1
fi

echo ""
echo "[run-template-tests] All ${#TEST_FILES[@]} test file(s) passed."
