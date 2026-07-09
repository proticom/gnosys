#!/usr/bin/env bash
# `gnosys setup --non-interactive` must complete without prompting (no TTY
# input available here on purpose) and exit 0.
set -u
mkdir -p /home/tester/proj-ni && cd /home/tester/proj-ni
out=$(gnosys setup --non-interactive </dev/null 2>&1)
code=$?
echo "$out" | tail -5
if [ $code -ne 0 ]; then echo "exit $code"; exit 1; fi
case "$out" in
  *"at "*".js:"*) echo "stack trace detected"; exit 1 ;;
esac
exit 0
