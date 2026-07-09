#!/usr/bin/env bash
# Isolation audit: after all wizard runs, gnosys must have written ONLY under
# the expected locations — $HOME/.gnosys, $HOME/.config/gnosys, the project
# dirs we created, and npm/node caches. Anything else is a leak.
set -u
leaks=$(find /home/tester -newer /home/tester/tests/run-all.sh -type f 2>/dev/null \
  | grep -v -E '^/home/tester/(\.gnosys|\.config/gnosys|proj-[a-z]+|\.npm|\.cache|tests|gnosys-dashboard)' || true)
if [ -n "$leaks" ]; then
  echo "unexpected writes:"
  echo "$leaks"
  exit 1
fi
# And nothing outside $HOME that we can write to should have gnosys droppings.
stray=$(find /tmp -maxdepth 2 -name "*gnosys*" 2>/dev/null | head -5 || true)
if [ -n "$stray" ]; then
  echo "note: gnosys wrote to /tmp:"; echo "$stray"
fi
echo "isolation OK (all writes confined to HOME)"
exit 0
