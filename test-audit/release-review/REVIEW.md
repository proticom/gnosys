# Final application release QA

Application branch `fix/audit-defects` at `e9d605f66268a6599c6064d54bc4df6f4f094369` is merged into the separate `test-audit` worktree. Application code through `2606b05` is included. The original dirty checkout was not edited. No version bump, tag, push or publish was performed.

The combined suite passes all 1,746 cases with zero unexpected failures and zero skips. This includes 24 expected failures across five open defects and the deferred FNV defect. Every retained expected-failure case was reproduced as an ordinary failing test. [Full suite](full-suite.json), [ordinary failures](open-ordinary.json).

## Test changes

Only two test files changed from the previous QA result `bd9f3f4`:

- `context-adversarial.test.ts`: promoted the normal CLI and MCP import-persistence cases from `it.fails` to `it`. Assertions are unchanged. Both reopen the central database and find the two literal expected records. Removing each caller's database argument makes its test fail; restoring the argument makes it pass.
- `vscode-adversarial.test.ts`: replaced the blanket no-shell expected failure with an ordinary variable-argument transport test. The clarified ruling permits the exact constant dashboard command. The test executes that command, derives registration from the built CLI, checks exit 0, and verifies variable reinforcement arguments bypass the shell and reach the CLI shim intact without execution markers. It does not pin the incorrect path-only reinforcement contract.

The missing-executable fixture was already corrected by the earlier QA work. It supplies a readable ID-bearing document, removes the executable from PATH, and retains the exact `Reinforce failed: spawnSync npx ENOENT` error assertion. Its notification fault is killed on the final application. D-VSC-001 tests still require the selected memory's real ID and `--signal useful`.

The nine original repaired markers mentioned in [FIX_HANDOFF.md](../../FIX_HANDOFF.md) were already reconciled in the earlier QA branch, except the original compound D-VSC-003 witness now checks real selected-ID reinforcement and therefore correctly remains expected-failing under D-VSC-001. The separate passing D-VSC-003 transport case proves the shell repair without requiring incorrect memory-ID behavior.

## Current defect status

| Status | Defects | Evidence |
| --- | --- | --- |
| FIXED | D-VSC-002, D-VSC-003, D-VSC-004, D-CTX-001, D-CTX-002, G2-D001, G2-D002, G2-D003, ADV-CTX-002 | Ordinary passes plus direct fault pass/fail/pass at the accepted application digest. |
| OPEN | D-VSC-001 | 16 ordinary failures cover real IDs, unreadable IDs, nested paths and hostile filenames. |
| OPEN | DEF-G1-001 | Four ordinary failures show reset retains old task overrides. Unrelated config values and the unchanged v584 deep-merge tests remain protected. |
| OPEN | ADV-CTX-001 | `config show --json` still prints the fake stored custom-provider key. |
| OPEN | D-DASH-001 | A stored project name still injects executable JavaScript into generated dashboard click-handler text. The handler is exercised in an isolated VM, not a full browser. |
| OPEN | ADV-FTS-001 | Dropping the central FTS table preserves fallback search, but reopen recreates an empty index and loses the hit. Central `db.ts` is unchanged by the final class repairs. |
| DEFERRED | D-G3-001 | The documented FNV vector still fails. Its expected-failure marker remains. |

The final import-persistence repair is verified. The final archive and search-sidecar repairs do not resolve the distinct central-index recovery defect. No expected-failure marker was removed based on the handoff's claim alone.

There are no unexpected combined-suite failures blocking integration. The five open application defects remain release risks, not fixed behavior. The release task must carry those known defects forward rather than describe this as a defect-free release.

## Verification

The final-source replay killed 26 application faults and two CI faults. It includes all earlier provider, project-selection, FTS, setup, extension and HTTP probes plus direct faults for the two new persistence passes and variable-shell transport. [Context](release-context-mutations.results.json), [FTS](db-fts.results.json), [setup](setup.results.json), [extension/HTML](vscode.results.json), [HTTP/CI](ci-http.results.json).

Identical prior context faults retain their logical IDs in the aggregate ledger so replay does not inflate the distinct score. The full audit score is 508 killed of 511 selected faults; three historical survivors remain visible. This is targeted fault evidence, not exhaustive mutation coverage. Inverse repair unexpected passes receive no protection credit. [ID mapping](mutation-id-aliases.json).

The source/runtime/action ledger has zero missing kills, missing survival proofs, unmapped cases or acceptance issues. All ten original `KNOWN_DEFECT` rows were restated against current evidence, and the feature inventory remains 41 groups and 164 obligations. [Matrix changes](feature-restatus.json).

Typecheck, lint, Knip and both real CLI CI scenarios pass. Lint retains 23 warnings. The final report records the separate full coverage run and thresholds. The v584 tests and the 50/100 ms read assertions remain unchanged. Those wall-clock limits remain first-CI-run flake risks and were not loosened.

The default Docker runner is still capacity-limited: four fixture-directory creations report `No space left on device`. The same final packed image and unchanged six scenarios pass using temporary in-memory fixture directories, with no network or host mounts. No Docker data was deleted. [Default run](docker.json), [isolated replay](docker-tmpfs.json).

The final application diff was also read across its 25 changed files. Existing tests and the targeted replays do not independently prove every class-sweep scenario claimed by the application handoff, live provider credentials, native keychain/scheduler effects, native Windows/VS Code behavior or all remote CI matrix combinations. Those limits are recorded in the [bounded source review](db-review.json).

## Replay

Build before CLI tests. Run `node scripts/test-audit-reproduce-current.mjs --all-open` to reproduce the 24 ordinary failures with automatic marker restoration. Metadata is regenerated with `node test-audit/adversarial/reconcile.mjs test-audit/release-review/reconcile-config.json`, followed by `node test-audit/release-review/restat-matrix.mjs`, strict reconciliation, strict ledger generation, and the report generator using `test-audit/release-review/full-suite.json`.
