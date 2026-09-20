# Application repair feedback at e2c08a3

Measured against committed fixes b8ac52b, 13756f2 and e2c08a3 in an isolated checkout. No uncommitted application changes were copied. Ordinary assertions pass 17 cases and fail 17 cases across the two adversarial files and the existing extension tests.

- D-VSC-002 rejection is repaired for all four lookalike directory names with both separator styles. A substring regression is killed by all eight new cases and the existing prefix case.
- D-VSC-003 reinforcement launches are shell-free. All six hostile marker commands stop executing. The existing literal argument case catches reintroduced shell interpolation. The eight combined hostile-filename/selected-ID cases still fail because D-VSC-001 is unresolved.
- D-VSC-004 now invokes a registered CLI successor and exits zero. Both old and new cases catch reintroducing the removed command.
- The dashboard still uses `terminal.sendText`, which runs through a shell. The measured unique shell-mode sets are `[[false], [true]]`, so the all-command shell-free requirement remains unmet.
- D-VSC-001 must read the actual selected memory identity and pass the useful signal. Every run generates an unrelated UUID, keeps the filename and legacy fixture ID as decoys, and verifies only the selected record changes. Missing, empty, and body-only IDs must warn without a subprocess.
- Deeply nested POSIX paths are accepted, but successful reinforcement remains blocked by D-VSC-001. Backslash paths on the POSIX test host also need correct document/cwd handling. Do not count either failure as proof that the exact-component matcher rejects valid paths.
- D-DASH-001 remains. Stored project name `QA');globalThis.dashboardInjected=true;//` executes the assignment through generated readiness-card JavaScript. The actual emitted handler was evaluated after HTML entity decoding. This is not a full-browser replay.

The CLI contract is `reinforce <memoryId> --signal <signal>`. The existing D-VSC-003 test currently asserts the legacy filename positional transport. When D-VSC-001 is repaired, that obsolete positional expectation must be replaced with exact resolved-ID and shell-safety assertions. The new adversarial cases already enforce the actual selected-ID contract.

Five direct fault replays killed 15 distinct passing test cases. Every mutated application file was restored. The launch-error test now expects the actual `npx` spawn error rather than `/bin/sh`; a fault replacing the error notification with a warning kills it.

Replay all ordinary assertions with `node test-audit/adversarial/vscode-dashboard-reproduce.mjs`. Default mode expects documented open defects, including D-DASH-001, to fail. To check repaired extension behavior alone, rebuild and run with `--repairs-only`; that mode excludes the dashboard HTML file and requires zero extension failures. Each mode preserves separate aggregate and per-defect JSON. The script temporarily removes expected-failure annotations, leaves assertions intact, and restores test files in `finally`.
