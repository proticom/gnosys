#!/usr/bin/env bash
set -euo pipefail
mkdir -p /home/tester/proj-ni
cd /home/tester/proj-ni
out=$(timeout 20s gnosys setup --non-interactive </dev/null 2>&1)
printf '%s\n' "$out"
for expected in \
  '  Provider:     anthropic' \
  '  Model:        claude-sonnet-4-6' \
  '  Structuring:  claude-haiku-4-5' \
  '  API key:      skipped' \
  '  IDE setup:    skipped' \
  '  Mode:         agent'; do
  if ! printf '%s\n' "$out" | grep -Fxq "$expected"; then
    printf 'Missing expected setup result: %s\n' "$expected"
    exit 1
  fi
done
