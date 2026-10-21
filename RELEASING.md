# Releasing gnosys

Releases are tag-driven (see [ADR-0008](docs/adr/0008-automated-npm-publish.md)). Bump `version` in `package.json`, commit, and push a `vX.Y.Z` (or `vX.Y.Z-<prerelease>`) tag. `.github/workflows/publish.yml` then:

1. **Validates the tag** with `.github/scripts/classify-release-tag.sh`, before installing anything. The tag must be strict semver with no leading zeros and no `+build`, and it must equal `v` + the `package.json` version. Anything else fails the run, and nothing is published.
2. Installs, builds and tests.
3. **Classifies the tag again** right before publishing, against the tags on `origin` at that moment.
4. **Publishes to npm** through OIDC trusted publishing with the chosen dist-tag. It skips this step if that version is already on npm.
5. **Creates the GitHub Release** in a separate `release` job, the only job with `contents: write`. It skips this step if the release already exists.

## Dist-tags and GitHub "Latest"

| Tag | npm dist-tag | GitHub Release |
|---|---|---|
| `vX.Y.Z`, highest plain version overall | `latest` | full, marked Latest |
| `vX.Y.Z`, highest in its major but not overall (e.g. `v6.3.2` after `v7.0.0`) | `v<major>-latest` (e.g. `v6-latest`) | full, not Latest |
| `vX.Y.Z`, older than another tag in its major (e.g. `v1.9.1` after `v1.10.0`) | `backport` | full, not Latest |
| `vX.Y.Z-<prerelease>` | `next` | prerelease, not Latest |

Prerelease tags are ignored when finding the highest plain version.

Known limits of these rules:
- **`backport` is one shared dist-tag across all majors.** It points at whichever backport was published last: a `v0` backport replaces a `v1` one. Install exact versions (`gnosys@1.9.1`) rather than relying on `backport`.
- **`v<major>-latest` only exists once a release in that major loses overall Latest.** It is set when an older-major release is published, not when a major is first superseded. For example, after `v2.0.0` ships, `v1-latest` doesn't exist until another 1.x release is published. Add it by hand if needed: `npm dist-tag add gnosys@1.10.0 v1-latest`.
- **Skipping an already-published version does not re-apply its dist-tag.** If a dist-tag is wrong, fix it with `npm dist-tag add gnosys@<version> <tag>`.

## Pushing several tags close together

Publish runs share the concurrency group `publish-<repo>` with `cancel-in-progress: false`. A running publish is never cancelled, but GitHub keeps at most **one** pending run per group. If a third tag is pushed while one publish is running and another is waiting, **the waiting run is cancelled** and its version is never published.

**To recover**, re-run the cancelled run for that tag: Actions, then "Publish to npm and GitHub Release", then the cancelled run, then "Re-run all jobs". From the CLI: `gh run list --workflow publish.yml`, then `gh run rerun <run-id>`. This is safe:
- The tag is validated again.
- It is classified against the current tags, so it can't move `latest` backward to an older version.
- npm publish is skipped if the version is already on npm.
- The GitHub Release is skipped if it already exists.

Simplest prevention: push one release tag at a time and wait for its run to finish.

### Out-of-order or overlapping tags

Classification happens right before `npm publish`, against the tags that exist at that moment. Suppose `v2.0.1` is tagged while the `v2.0.0` run is still testing. Then `v2.0.0` is published as `backport` rather than `latest`, because a higher 2.x tag already exists. `latest` moves to 2.0.1 only when the `v2.0.1` run publishes. If that run fails or is cancelled, npm `latest` stays on the previous version until you re-run it (see above).

## Recovering from a failed run

- **Validation failed** (bad tag, or tag ≠ `package.json` version): nothing was published. Delete the tag, fix it, and push it again.
- **npm publish succeeded but the release job failed:** re-run the failed jobs. The publish job skips npm because the version is already there, and the release job creates the GitHub Release.
