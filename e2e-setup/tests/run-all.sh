#!/usr/bin/env bash
# Runs every setup UI test inside the container and reports TAP-style results.
# Exit code 0 only when every test passes.
set -u
cd /home/tester

PASS=0
FAIL=0
declare -a FAILED_NAMES=()

run_test() {
  local name="$1"; shift
  echo "── ${name} ──────────────────────────────────────"
  if "$@"; then
    echo "ok - ${name}"
    PASS=$((PASS + 1))
  else
    echo "not ok - ${name}"
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("${name}")
  fi
  echo ""
}

run_test "cli-installs-and-reports-version" bash tests/version.sh
run_test "init-creates-isolated-store"      expect tests/init.exp
run_test "setup-wizard-first-screen"        expect tests/setup-wizard.exp
run_test "setup-non-interactive"            bash tests/setup-non-interactive.sh
run_test "web-init-wizard"                  expect tests/web-init.exp
run_test "isolation-no-stray-writes"        bash tests/isolation.sh

echo "══════════════════════════════════════════════════"
echo "setup UI tests: ${PASS} passed, ${FAIL} failed"
if [ "${FAIL}" -gt 0 ]; then
  printf 'failed: %s\n' "${FAILED_NAMES[@]}"
  exit 1
fi
exit 0
