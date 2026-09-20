# Adversarial repair review

Reviewed application revision `f4b9135ae350fad937a66f03a9bc3ccfbd8c6906`. The [acceptance manifest](acceptance.json) lists the nine application commits supplied by the repair agent. No later application changes are included. This QA pass changes tests, CI checks and audit records. It leaves newly found application defects unfixed.

The full suite passes 1,746 cases, including 27 expected failures, with zero unexpected failures and zero skipped cases. The current defect ledger records seven fixed, seven open and one deferred defect. Every remaining expected failure was also run as an ordinary test and failed. An inverse repair's unexpected pass receives no feature-protection credit.

## Requested attacks

| Target | Measured result | Evidence |
| --- | --- | --- |
| D-VSC-003 | Partial repair. Reinforcement uses `execFileSync` without a shell. All eight hostile filename forms leave harmless execution markers absent, but reinforcement still fails D-VSC-001. The dashboard still uses a shell through `terminal.sendText`, so the extension-wide requirement remains OPEN. | [Ordinary failures](final-open-ordinary.json), [extension tests](../../src/test/vscode-adversarial.test.ts) |
| D-VSC-002 | All four lookalike components reject under both separator styles. The substring-matching fault fails nine ordinary cases. Deep exact `.gnosys` paths reach reinforcement, whose successful completion remains blocked by D-VSC-001. | [Direct faults](vscode-final-results.json) |
| D-VSC-001 | OPEN. A fresh UUID differs from every seeded decoy. Missing, empty and body-only IDs fail the warning/no-process contract. The extension diff contains no hardcoded memory ID or test-specific signal; it still omits ID reading and `--signal useful`. | [Ordinary failures](final-open-ordinary.json), [accepted extension diff](../../extensions/vscode/extension.js) |
| D-VSC-004 | FIXED. The command is read from the extension invocation, checked against the built CLI's registered commands, then executed with exit 0. Replacing it with the removed command fails both ordinary cases. | [Direct faults](vscode-final-results.json) |
| D-CTX-001 / G2-D003 | FIXED for provider routing. Custom-provider and original Ollama boundaries pass for CLI and MCP. With no provider, all four surfaces return setup guidance. Normal import persistence exposed a separate new defect below. | [Provider faults](context-f4b9135-mutations.results.json), [full suite](repair-unit-full.json) |
| D-CTX-002 | FIXED. Different journal text saves independently in A and B; repeat B skips. Both startup-project dedup cases pass. Scoped-dedup and cross-project false-skip faults fail the corresponding tests. | [Context faults](context-f4b9135-mutations.results.json) |
| G2-D002 | FIXED. Three writes yield one result in `searchFts`, `discoverFts`, archive search and hybrid keyword mode. Raw SQLite duplicates heal on open without losing either memory; a second open causes no database write. `user_version` remains 5. Three direct faults are killed. | [FTS faults](fts-direct.f4-final.results.json), [tests](../../src/test/fts-adversarial.test.ts) |
| DEF-G1-001 | OPEN. Reset retains old overrides; reset then setting one override also retains old tasks. All four ordinary regressions fail. Serialized bytes of every unrelated JSON value, including `llm` and `dream`, stay unchanged. Whole-file whitespace is not part of that assertion. The v584 tests are unchanged and pass. | [Ordinary failures](final-open-ordinary.json), [unchanged files](unchanged-compatibility-tests.json) |
| G2-D001 | FIXED. Main setup exits 130 at the provider and later IDE prompt. Setup driven to completion exits 0. Models and ides still exit 130. Cancellation and completion faults are killed separately. | [Setup faults](setup-final-results.json), [five ordinary cases](setup-final-ordinary.json) |
| KNIP | `npm run knip` exits 0. | [Static and CI checks](final-static-ci-checks.json) |
| D-G3-001 | DEFERRED. The ordinary FNV vector still fails and its `it.fails` marker remains. | [Ordinary failures](final-open-ordinary.json) |

The CLI's public reinforcement argument is a memory ID. The filename tests require the literal selected document to supply its own ID and reinforce that memory. They do not pin the obsolete behavior of passing a filename where the CLI requires an ID. Native VS Code and native Windows were not launched; tests double the VS Code host boundary, exercise both separator styles on macOS, and execute the real built CLI.

## Gap probes and new defects

| Probe | Result |
| --- | --- |
| HTTP malformed JSON | POST returns 400, followed by health 200 with zero sessions. Returning 500 instead is killed by the test. |
| F08 explicit project | MCP starts in A. A and B have the same relative memory filename with different IDs. An explicit B update changes only B; falling back to cwd A fails the test. |
| F26 memory titles | Roadmap and open-question titles containing HTML/script text are escaped in generated HTML. Removing escaping fails both cases. |
| F03 config display | Human output hides a fake stored custom-provider key; JSON output prints it. New **ADV-CTX-001**, retained as `it.fails`. |
| Normal import | Both CLI and MCP report two successful imports, but reopening the database finds zero memories. New **ADV-CTX-002**, one `it.fails` per surface. |
| Dashboard project name | A stored project name injects JavaScript into an emitted click handler. New **D-DASH-001**, retained as `it.fails`. The actual handler is entity-decoded and executed in an isolated VM; this is not a full-browser test. |
| FTS recovery after table loss | The current connection's fallback finds the memory. After reopening, the FTS table exists but is empty, so search loses the result while the stored memory and schema version survive. New **ADV-FTS-001**, retained as `it.fails`. The predecessor finds the result after reopen. |

See [defects and reproductions](../defects.json), [HTTP fault](ci-http.results.json), [provider/project faults](context-f4b9135-mutations.results.json), [HTML faults](vscode-final-results.json), and [FTS predecessor comparison](fts-regression.compare.json). Run `node scripts/test-audit-reproduce-current.mjs <defect-id>` to reproduce a current resolution. `--all-open` runs all 27 open/deferred cases as ordinary failures. The helper restores exact source bytes and checks the application digest.

## Matrix and proof accounting

All ten rows previously marked `KNOWN_DEFECT` were restated from current observations. The [before/after receipt](feature-restatus.json) names each row and reason. The complete matrix retains 41 feature groups and 164 obligations. Successful provider routing does not count as durable import protection; successful duplicate-index healing does not conceal the new FTS-loss defect.

The follow-up replays 23 application faults and two CI faults. All are killed. Application mutation scores exclude the two CI faults and all inverse repair probes. The complete audit's targeted score is 505 kills in 508 distinct post-repair application faults (99.41%); this is selected fault coverage, not a random or exhaustive mutation score. The three surviving faults remain visible in the full report.

The strict ledger resolves 1,748 original declarations, 1,568 current declarations and 1,746 runtime cases with zero missing kills, missing survival proofs or unmapped cases. Twenty-four controlled validator checks pass, including rejection of inverse-only fix evidence, stale reports and expected failures claimed as successful protection. [Validator results](report-validation.results.json).

## CI and verification limits

The new-file coverage guard exits 2 when its base cannot resolve and exits 0 against the pinned baseline. Direct mutations prove the guard rejects invalid bases. It still omits newly added modules absent from the coverage summary; that pre-existing scope limit is not claimed fixed.

The workflow calls the renamed `local-storage-round-trip` scenario and contains no claim that it tests a network share. Both local CLI scenarios pass. No physical network share is exercised. [CI review](ci-review.json).

Flag these unchanged wall-clock assertions for the first hosted CI run:

- `src/test/phase7b.read-paths.test.ts:104`: 100-memory read must finish below 100 ms.
- `src/test/phase7b.read-paths.test.ts:124`: FTS search must finish below 50 ms.

Hosted-runner contention, scheduling and cold caches can breach those budgets. No threshold was loosened. The [byte comparison](unchanged-compatibility-tests.json) confirms both the timing test file and v584 config tests match the completed audit revision.

Full coverage passes the configured thresholds: statements 71.64%, branches 61.39%, functions 81.18%, lines 73.57%. Typecheck, lint and Knip exit 0; lint retains 23 warnings. [Coverage summary](final-coverage-summary.json), [checks](final-static-ci-checks.json).

The default Docker replay encountered a full overlay disk: four fixture directories could not be created, so that run is an infrastructure failure. Its receipt is [preserved](final-docker-setup.json). No Docker data was deleted. The unchanged six tests passed on the same image using ephemeral tmpfs fixture directories. [Replay receipt](final-docker-tmpfs.json). The normal Docker runner remains capacity-limited.

Live provider accounts, native keychains/schedulers, every remote CI matrix combination and physical network storage remain unverified. No push or PR was performed.
