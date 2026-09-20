# Final context/provider QA

Application ref is `f4b9135ae350fad937a66f03a9bc3ccfbd8c6906`. Application digest is `059ec3ee279146604895d9aba2dbc56f56480450e6c52fe27a2a32db0016b412`. The five test/helper files are unchanged from the accepted prefix. No application changes or commits were retained.

## Measured result

- All26 owned cases pass; three retain expected-failure annotations. There are zero unexpected failures or skips.
- All13 source faults are killed by17 distinct ordinary passing cases. Each before/restored selection passes, and each mutated selection fails on an assertion. All source mutations are restored exactly.
- All8 promoted markers remain ordinary passes and have direct fault proof on this final digest.
- Typecheck and five-file Biome checks pass.
- The parent owns full-suite integration. This artifact claims only the owned26-case unit and selected mutation runs.

## Open defects

ADV-CTX-001 remains open. JSON config display exposes the fake stored provider key; human config display protects it.

ADV-CTX-002 remains open on both measured surfaces. Normal CLI import exits0 and reports Imported:2/Failed:0/Total:2. MCP returns isError:false with the same counters. Both reopened databases have zero memories. Later application repairs for this newly discovered defect are excluded from this ref.

Three ordinary assertions reproduce these two defects. Expected-failure annotations were restored afterwards. No remaining acceptance gap was found for committed D-CTX-001, G2-D003 or D-CTX-002.

## Reproduction

From this checkout with Node22, run `node test-audit/adversarial/context-f4b9135-ordinary.mjs`. It requires loopback access for the local HTTP fixture, writes to a fresh temporary directory, verifies the exact three failing case names and restores both test bytes and the application digest. It verifies the approved application digest and permits test-only merge commits, recording the actual checkout ref separately. It exits0 when those three expected ordinary failures are observed. Two consecutive executions with separate default output directories are recorded in `context-f4b9135-digest-rerun-check.json`.

Use `--output /tmp/context-open-defects-new.json` for a chosen new report path. Existing report files are never overwritten. Historical baseline helpers and results retain their original counts and are not the current reproduction command.

## Final artifacts

- `context-f4b9135-final.json` gives counts, checks, frozen source hashes and artifact paths.
- `context-f4b9135-actions.json` contains16 new cases and8 expected-failure-to-ordinary promotions with exact names and final mutation IDs.
- `context-f4b9135-feature-coverage.json` contains nine obligation rows with explicit limits.
- `context-f4b9135-defects.json` records current open defects and repaired variants.
- `context-f4b9135-mutations.json` contains13 exact source faults and their selections.
- `context-f4b9135-mutations.results.json` contains all before/mutated/restored results.
- `context-f4b9135-unit.json` contains all26 runtime names.
- `context-f4b9135-ordinary.json` and `context-f4b9135-ordinary-summary.json` contain the first final-ref defect reproduction.
- `context-f4b9135-digest-replay-check.json` and `context-f4b9135-digest-replay-repeat.json` prove the final reusable helper twice.
- `context-f4b9135-artifact-sha256.json` freezes final artifact hashes.

`context-prefix-tests.patch` remains the accepted test patch. No further test changes accompany this final replay.
