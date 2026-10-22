#!/usr/bin/env bash
# Validate and classify the pushed release tag for publish.yml.
#
# Inputs:  GITHUB_REF_NAME (the tag), ./package.json, git remote "origin".
# Outputs: npm_tag, gh_prerelease, gh_latest, version (appended to
#          $GITHUB_OUTPUT when set, and always printed).
#
# Fails (non-zero) unless the tag is strict semver vMAJOR.MINOR.PATCH[-PRERELEASE]
# (no leading zeros, no +build) and equals "v" + package.json version, or if the
# remote tag list cannot be read or does not contain the tag itself.
#
# Classification:
#   vX.Y.Z-<pre>                           -> npm next,           GitHub prerelease, not Latest
#   vX.Y.Z, highest plain tag overall      -> npm latest,         GitHub Latest
#   vX.Y.Z, highest plain tag in its major -> npm v<major>-latest, not Latest
#   vX.Y.Z, older within its major         -> npm backport,       not Latest
# Prerelease tags are ignored when finding the highest plain tags.
set -euo pipefail

tag="${GITHUB_REF_NAME:?GITHUB_REF_NAME is not set}"
num='(0|[1-9][0-9]*)'
plain_re="^v${num}\\.${num}\\.${num}\$"
# Prerelease identifiers: numeric without leading zeros, or alphanumeric/hyphen.
pre_id='(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
release_re="^v${num}\\.${num}\\.${num}(-${pre_id}(\\.${pre_id})*)?\$"

if [[ ! "$tag" =~ $release_re ]]; then
  echo "::error::Tag '$tag' is not strict semver vMAJOR.MINOR.PATCH[-PRERELEASE] (no leading zeros, no +build). Refusing to publish."
  exit 1
fi

pkg_version=$(node -p "require('./package.json').version")
if [[ "$tag" != "v$pkg_version" ]]; then
  echo "::error::Tag '$tag' does not match package.json version '$pkg_version' (expected 'v$pkg_version'). Refusing to publish."
  exit 1
fi
version="${tag#v}"

if [[ "$tag" =~ $plain_re ]]; then
  # Any git failure here fails the step (set -e / pipefail); never assume a first release.
  remote_tags=$(git ls-remote --tags --refs origin 'refs/tags/v*')
  plain_versions=$(printf '%s\n' "$remote_tags" \
    | sed -n 's|^[0-9a-f]*[[:space:]]*refs/tags/||p' \
    | { grep -E "$plain_re" || true; } \
    | sed 's/^v//' \
    | sort -t. -k1,1n -k2,2n -k3,3n)
  if ! printf '%s\n' "$plain_versions" | grep -qxF "$version"; then
    echo "::error::Tag '$tag' was not found in the remote tag list; cannot classify safely."
    exit 1
  fi
  major="${version%%.*}"
  highest=$(printf '%s\n' "$plain_versions" | tail -n 1)
  highest_in_major=$(printf '%s\n' "$plain_versions" | { grep -E "^${major}\\." || true; } | tail -n 1)
  gh_prerelease=false
  if [[ "$version" == "$highest" ]]; then
    npm_tag=latest; gh_latest=true
  elif [[ "$version" == "$highest_in_major" ]]; then
    npm_tag="v${major}-latest"; gh_latest=false
    echo "$tag is the highest v${major}.x tag but not the highest overall (v$highest): npm dist-tag $npm_tag, not GitHub Latest"
  else
    npm_tag=backport; gh_latest=false
    echo "$tag is older than the highest v${major}.x tag (v$highest_in_major): npm dist-tag backport, not GitHub Latest"
  fi
else
  npm_tag=next; gh_prerelease=true; gh_latest=false
fi

echo "tag=$tag version=$version npm_tag=$npm_tag gh_prerelease=$gh_prerelease gh_latest=$gh_latest"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "version=$version"
    echo "npm_tag=$npm_tag"
    echo "gh_prerelease=$gh_prerelease"
    echo "gh_latest=$gh_latest"
  } >> "$GITHUB_OUTPUT"
fi
