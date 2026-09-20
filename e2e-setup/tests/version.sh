#!/usr/bin/env bash
set -euo pipefail
expected=$(node -p 'require(process.argv[1]).version' "$(npm root -g)/gnosys/package.json")
actual=$(gnosys --version)
printf 'Installed package %s; CLI reported %s\n' "$expected" "$actual"
[ "$actual" = "$expected" ]
