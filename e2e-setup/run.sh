#!/usr/bin/env bash
# Build and run the isolated setup UI test suite.
#
#   npm run test:e2e-setup        (or: bash e2e-setup/run.sh)
#
# What it does:
#   1. npm pack the repo → e2e-setup/gnosys.tgz (the exact artifact a user installs)
#   2. docker build an image that installs it globally as a non-root user
#   3. docker run with NO network and no host mounts — full isolation
#   4. expect scripts drive the interactive wizards and assert the screens
#
# Requires Docker. Exits non-zero if any test fails.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[e2e-setup] packing CLI…"
npm run build > /dev/null
TARBALL=$(npm pack --silent)
mv "$TARBALL" e2e-setup/gnosys.tgz

echo "[e2e-setup] building image…"
docker build -q -t gnosys-e2e-setup e2e-setup/ > /dev/null

echo "[e2e-setup] running isolated suite (no network)…"
docker run --rm --network=none gnosys-e2e-setup
status=$?

rm -f e2e-setup/gnosys.tgz
exit $status
