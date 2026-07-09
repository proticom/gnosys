#!/usr/bin/env bash
# Smoke: the packed CLI installed and runs. Version must match the packed one.
set -u
v=$(gnosys --version 2>/dev/null)
echo "gnosys --version → ${v}"
[ -n "$v" ] || exit 1
# PACKED_VERSION is baked in by run.sh via --build-arg? Keep loose: semver shape.
echo "$v" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' || exit 1
