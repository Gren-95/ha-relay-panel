#!/usr/bin/env bash
# Run the test suites in containers.
#
# The host toolchain is not a prerequisite for testing this project: Playwright
# needs Node >= 20 and this box ships Ubuntu's Node 18, so `npm run test:e2e`
# fails before it starts. Everything here runs in a container instead, which
# also means the tests run on the same Node the image ships (node:24-alpine).
#
#   scripts/test.sh            unit + lint + e2e
#   scripts/test.sh unit       Node's built-in runner, no node_modules needed
#   scripts/test.sh lint       eslint
#   scripts/test.sh e2e        Playwright against a running panel
#   scripts/test.sh e2e --ui   extra args are passed through to playwright
#
# BASE_URL overrides the target for e2e (default http://localhost:8090). The
# specs mock every HA-backed endpoint in the browser, so pointing this at the
# live panel does not touch Home Assistant or the database.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_IMAGE="${NODE_IMAGE:-node:24-alpine}"
BASE_URL="${BASE_URL:-http://localhost:8090}"
# Keep the browser image in step with the package, or Playwright refuses to run.
# Read the LOCKED version, not the range in package.json: `npm update` moves the
# lock without rewriting "^1.62.0", and a tag built from the range would then pull
# browsers for the wrong build. Resolved in a container so the host needs no Node.
PW_VERSION="$(docker run --rm -v "$PWD":/app -w /app "$NODE_IMAGE" \
  node -p "require('./package-lock.json').packages['node_modules/@playwright/test'].version" 2>/dev/null \
  || sed -n 's/.*"@playwright\/test"[^0-9]*\([0-9][0-9.]*\).*/\1/p' package.json)"
PW_IMAGE="${PW_IMAGE:-mcr.microsoft.com/playwright:v${PW_VERSION}-noble}"
# node_modules lives in a volume so the container never writes to (or reads) the
# host's tree - the host installs under a different Node and npm.
MODS_VOLUME="${MODS_VOLUME:-relay-panel-testmods}"

RC=0
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { RC=1; printf '\033[31mFAILED: %s\033[0m\n' "$1"; }

# npm ci wipes node_modules, so only pay for it when the volume is not populated.
INSTALL='if [ ! -x node_modules/.bin/eslint ] || [ ! -d node_modules/@playwright/test ]; then
           npm ci --no-audit --no-fund
         fi'

run_unit() {
  step "unit ($NODE_IMAGE)"
  docker run --rm -v "$PWD":/app -w /app "$NODE_IMAGE" \
    node --test "tests/unit/**/*.test.js" || fail unit
}

run_lint() {
  step "lint ($NODE_IMAGE)"
  docker run --rm -v "$PWD":/app -v "$MODS_VOLUME":/app/node_modules -w /app "$NODE_IMAGE" \
    sh -c "$INSTALL && npx eslint ." || fail lint
}

run_e2e() {
  step "e2e ($PW_IMAGE -> $BASE_URL)"
  if ! curl -fsS --max-time 10 "$BASE_URL/api/health" >/dev/null; then
    fail "e2e - nothing answering at $BASE_URL (start it: docker compose up -d)"
    return
  fi
  # --network host so the container can reach a panel published on the host.
  docker run --rm --network host \
    -v "$PWD":/app -v "$MODS_VOLUME":/app/node_modules -w /app \
    -e BASE_URL="$BASE_URL" -e CI=1 \
    "$PW_IMAGE" sh -c "$INSTALL && npx playwright test \"\$@\"" -- "$@" || fail e2e
}

case "${1:-all}" in
  unit) run_unit ;;
  lint) run_lint ;;
  e2e)  shift; run_e2e "$@" ;;
  all)  run_unit; run_lint; run_e2e ;;
  *)    echo "usage: $0 [unit|lint|e2e|all] [-- playwright args]" >&2; exit 2 ;;
esac

[ $RC -eq 0 ] && printf '\n\033[32mall green\033[0m\n' || printf '\n\033[31msome suites failed\033[0m\n'
exit $RC
