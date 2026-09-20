# Audit repair handoff

## Release follow-up after QA reconciled the test contracts

The original handoff below records the first application pass. QA subsequently
corrected the conflicting test contracts, allowing these two requested repairs:

- `5834a4b` fixes D-VSC-001. The extension reads the selected document's frontmatter
  ID and passes it with `--signal useful` through `execFileSync`. Missing or
  unreadable IDs produce a warning without launching a subprocess. Nested paths
  and Windows separators retain the project root. All 16 expected-failure cases
  now pass their assertions; the other 15 extension cases still pass. The real CLI
  checks confirm only the selected database memory's date changes.
- `518785a` fixes DEF-G1-001. Routing reset clears the raw local `taskModels`
  object through the existing explicit-clear helper, without changing
  `updateConfig` deep-merge semantics or unrelated raw values. Inherited global
  overrides remain in effect and produce a warning. All four expected-failure
  cases now pass their assertions; the eight other targeted setup/config cases
  still pass. Reset followed by a new override does not restore the old entries.

QA owns marker promotion and independent fault replay. Its release review records
the final verification. No data migration is needed for these two repairs.

Release CI also exposed the upstream Node native-addon cleanup regression
[nodejs/node#65446](https://github.com/nodejs/node/issues/65446). QA pinned existing
Node 24 jobs to 24.18.1 in `8914299`, preserving all coverage conditions and Node
20/22 jobs. Node 24.20.0 and 24.21.0 reproduced the native abort; 24.18.1 completed
every case. Initial diagnostic logging contaminated three clean-stderr assertions,
so final full-suite and coverage verification must run without that preload.
Dependencies, schema version and minimum supported Node version are unchanged.

The failed public v6.2.2 tag remains unchanged. The corrected release is 6.2.3;
publication is complete only after the OIDC workflow and registry checks succeed.

## Starting working-tree state

Audit worktree started on `test-audit` at `ec1955434bbd43136d8bbf3b92ef8d696aa78a38` with:

```text
?? node_modules
```

The original checkout was left untouched. Its starting pending files were:

```text
 M README.md
 M SECURITY.md
 M docs/cli.md
 M docs/configuration.md
 M docs/mcp-tools.md
 M docs/multi-machine-sync-v13.md
 M docs/network-mcp.md
 M docs/setup-walkthrough.md
 M knip.json
 M package-lock.json
 M package.json
 M scripts/gen-cli-docs.mjs
 M src/cli.ts
 M src/cli/maintenance.ts
 M src/cli/runtime.ts
 M src/cli/setup.ts
 M src/index.ts
 M src/lib/audit.ts
 M src/lib/embeddings.ts
 M src/lib/mcpHttp.ts
 M src/lib/multimodalIngest.ts
 M src/lib/projectIdentity.ts
 M src/lib/resolver.ts
 M src/lib/search.ts
 M src/lib/tags.ts
 M src/postinstall.ts
 M src/test/acceptance-features.test.ts
 M src/test/mcp-context-release.test.ts
 M src/test/phase3-hardening-pins.test.ts
 M src/test/phase9e.network-share-polish.test.ts
?? docs/local-runtime.md
?? docs/marketing-site-parity.md
?? src/entry.ts
?? src/lib/localRuntime.ts
?? src/lib/mcpLauncher.ts
?? src/lib/mcpSessionContext.ts
?? src/lib/runtimeService.ts
?? src/lib/runtimeSetup.ts
?? src/lib/stdioProxy.ts
?? src/mcp.ts
?? src/runtimeDaemon.ts
?? src/test/configure-cursor-rules.test.ts
?? src/test/embeddings-concurrent-init.test.ts
?? src/test/gen-cli-docs.test.ts
?? src/test/local-runtime-discovery.test.ts
?? src/test/mcp-resource-lifetime.test.ts
?? src/test/mcp-server-version.test.ts
?? src/test/mcp-session-context.test.ts
?? src/test/multimodal-routing.test.ts
?? src/test/runtime-service.test.ts
?? src/test/runtime-setup.test.ts
?? src/test/shared-runtime.test.ts
?? src/test/stdio-proxy.test.ts
```

## Status

Repairs are committed on `fix/audit-defects`, based only on the audit worktree. Eight named defects and the requested Knip cleanup are fixed, with class-sweep repairs detailed below. D-VSC-001 and DEF-G1-001 remain NOT FIXED because of the immutable test conflicts; D-G3-001 remains DEFERRED as requested. Tests and audit artifacts remain read-only. The original 53 dirty files and all 470 protected tracked files match their starting SHA-256 snapshots.

## Immutable test conflicts

Two repairs cannot satisfy both the behavior ruling and the existing ordinary tests. They remain unmodified under the instruction to explain and continue when tests require incorrect behavior.

- **D-VSC-001: NOT FIXED.** The command still sends a path instead of a real memory ID and omits `--signal`. A correct repair would parse the current document ID and warn without launching on missing/unreadable IDs. The ordinary test `reports a process launch failure to the editor` supplies a nonexistent file and explicitly requires no warning plus a subprocess error. The D-VSC-003 witness also supplies a nonexistent file and pins a path-only argv without `--signal`. The fixture supplies only `document.uri.fsPath`, with no document text API. A missing-ID warning would create an ordinary failure beyond the narrow shell-to-argv exception. No fallback to a fabricated ID, filename, or misleading warning was introduced. QA should expose document text, provide a valid ID for the injection case, assert `["gnosys", "reinforce", realId, "--signal", "useful"]`, and require warning/no launch for missing IDs. The genuine reinforcement path remains broken until those contracts are reconciled.
- **DEF-G1-001: NOT FIXED.** `updateConfig({taskModels:{}})` deep-merges and retains overrides. The ordinary test `marks an edited routing section after saving and reloading its config` and the defect test run the same seeded config and `["2","4","y","done"]` inputs. The ordinary test requires the final row to stay `mixed (xai, ollama) ✓`, while the defect requires empty task overrides. Correct clearing would display `all ollama`, creating a forbidden ordinary failure. QA should correct that final summary expectation; then the reset should use explicit raw-config clearing without changing `updateConfig` deep-merge semantics. No display was falsified to satisfy both.

Consequently the requested exact eleven unexpected passes is incompatible with the immutable tests. The final run confirms nine repaired expected-failure cases. The FNV case and these two deferred cases must remain expected failures.

## Named repairs

| Defect | Status / commit | Application files | Root cause and observable change |
| --- | --- | --- | --- |
| D-VSC-003 | FIXED, `b8ac52b` | `extensions/vscode/extension.js` | Shell interpolation interpreted filename syntax. `execFileSync("npx", argv)` now passes literal bytes. Its defect witness unexpectedly passes; hostile filenames create no marker. The ordinary launch-error test now gets `spawnSync npx ENOENT` instead of `spawnSync /bin/sh ENOENT`, the sole pre-authorized ordinary difference. |
| D-VSC-002 | FIXED, `13756f2` | `extensions/vscode/extension.js` | Substring detection accepted `.gnosys-other`. Exact path-component matching now handles `/` and `\`, and keeps nested real `.gnosys` paths. The defect witness flips; a disposable VM check verified six accepted/rejected POSIX/Windows cases. |
| D-VSC-004 | FIXED, `e2c08a3` | `extensions/vscode/extension.js` | The terminal invoked removed `dashboard`. It now invokes constant `npx gnosys status --system`. CHANGELOG v5.7.0, removal history, commit `dcc8cb66`, and `src/cli/maintenance.ts` establish this as the actual system-dashboard successor. The real CLI terminal witness exits 0. No variable is interpolated. |
| D-CTX-001 | FIXED, `636e032` | `src/lib/commitContextCommand.ts` | Ingestion was constructed without the loaded provider config and defaulted to no provider. Config is loaded first and reused by ingestion/extraction. The real CLI/local-provider test saves both requested memories; no-provider exits 1 with `Run 'gnosys setup'` and no stack trace. |
| G2-D003 | FIXED, `3021bf5` | `src/lib/importCommand.ts` | The same omitted-config constructor rejected configured LLM imports. Ingestion and concurrency now share the loaded config. Both real-provider CLI cases flip, with configured concurrency 2 and explicit override 1. No-provider returns the existing setup-or-structured-mode guidance. |

Each repaired entry point preserves its existing caller response format except the actionable no-provider text and the permitted subprocess error. There are no web UI consumers of these CLI/extension responses. Tests were not rewritten or toggled. The audit reproduction runner was not invoked because it rewrites protected tests and evidence; existing immutable tests and disposable external scripts were used instead.

## Further named results

- **D-CTX-002 FIXED, `a420e3b`.** `src/index.ts` now queries the central database for novelty. `src/lib/db.ts` accepts an optional exact project/scope filter applied before LIMIT in all four FTS retry paths. Unfiltered discovery/search callers keep their previous scope. The immutable repeat-context witness flips. Real MCP checks verified A add/repeat, B add/repeat, five higher-ranking A hits not hiding a B match, metadata/body OR retries, explicit null project/user/global distinctions, and dry-run extraction without writes.
- **G2-D002 FIXED, `29a59b0`.** `src/lib/db.ts` retains replacement write semantics, but its INSERT trigger removes any old FTS rows by ID first. UPDATE/DELETE triggers use ordinary deletes appropriate to the standalone FTS table. The manual, non-atomic repair paths were removed. Their race was reproduced using two database handles, which left both stale and current text searchable. A raw metadata transaction repairs duplicate/stale/orphan rows once on open using `memories_fts_unique_id_v1`. It rechecks under the writer lock and writes the marker last. `user_version` remains 5. Recovery restores missing triggers and heals a restored old database lacking the marker. Tests preserved every base column/blob/timestamp, verified failed-marker rollback/retry, preprepared legacy REPLACE writers with recursive triggers on/off, replacement/update/delete/embedding, zero changes on a repeat open, and exactly one heal across two concurrent 10,000-row openers. That fixture took approximately 123 ms on this machine. Restart old processes after deploying; the new INSERT trigger protects their REPLACE calls, but cannot make their already-loaded manual UPDATE sequence atomic.
- **G2-D001 FIXED, `6a69746`.** `src/lib/setup.ts` now returns 130 when readline closes before setup completes. The completed flag preserves exit 0. Real PTYs verified first-prompt and later IDE-prompt cancellation plus normal completion. The bare-setup witness flips; ordinary models/ides cancellation tests remain green.
- **KNIP FIXED, `f4b9135`.** Removed only the three requested unused export objects in `remoteWizard.ts`, `setup/summary.ts`, and `setupKeys.ts`. Repository-wide symbol search found no imports or uses beyond those declarations. Knip exits 0 and the complete immutable suite retained the expected result.

## Config-constructor sweep

Measured before repair: real CLI `commit-context`, LLM-mode `import --dry-run`, and raw-text `add` each exited 1 for every supported configured provider: Anthropic, Ollama, Groq, OpenAI, LM Studio, xAI, Mistral, OpenRouter, and custom. All 27 calls failed before any provider request. Three no-provider controls also exited 1. The omitted config caused ingestion to use DEFAULT_CONFIG, whose provider is unset. History commit `c2f77d08ddf3ededd9ce648429db055b1f4d18ea`, included in v6.0.0, removed the implicit provider while these omissions already existed. This confirms the all-provider regression since that change, rather than a problem with particular API keys.

Every production GnosysIngestion constructor was checked:

| Caller | Result |
| --- | --- |
| CLI commit-context | Fixed by D-CTX-001. |
| CLI import | Fixed by G2-D003; config also supplies concurrency. |
| CLI raw-text add | Sibling fixed in `49d7a31`; now loads/passes config and gives no-provider setup guidance. Actual CLI/local-responder check saved Basalt ledgers. |
| MCP init and migrate reinitialization | Sibling fixed in `526e2a9`; both pass the write target's loaded config. |
| MCP background startup | Already passed config. |
| Multimodal ingestion | Already passed config for both CLI and MCP file paths. |
| MCP import call | Sibling fixed in `3817d8f`; creates ingestion for the target store/tags and `ctx.config`, rather than reusing the boot provider. Providerless boot plus configured target now makes the expected local-provider request. |

MCP add/commit already supplied per-call config overrides. Other optional config consumers were examined: Ask constructors receive config; all maintenance constructors receive config; all nine LLM provider factory cases pass config; Dream scheduling defaults are intentional. The separate gnosys_ask issue is that it ignores projectRoot and reuses the boot engine, not that its constructor omits config. The same providerless-boot/configured-target reproduction still returns a no-provider error for Ask; this broader scoped-engine repair is reported below.

Suggested QA cases include every configured provider's selection, no-provider setup errors, init/migrate followed by import, two projects with different models, actual persisted imports, and dry-run previews without a writable database.

## Complete MCP routing census at the audit baseline

55 `regTool` registrations counted in `src/index.ts`. The `gnosys_recall` MCP resource at line2874 is additional and is not a duplicate tool.

Definitions: C = central DB resolved by `GnosysDB.openCentral` (remote-first where configured); CR = per-call central view after client read overlay; M = requested project's Markdown store plus configured personal/global/optional Markdown tiers; S = per-store `.config/search.db`; B = module boot resolver/config/search; L = explicitly local central DB. Most CR read paths require isAvailable/isMigrated before Markdown fallback. An explicit `projectRoot` selects config/store identity, but many read tools intentionally remain global. This is not an authorization boundary.

| Tool (index.ts baseline line) | Reads | Writes / scope observations |
| --- | --- | --- |
| gnosys_discover 478 | CR FTS globally, pending overlay; S fallback | None. projectRoot does not restrict global discovery. |
| gnosys_read 567 | CR by ID, pending overlay; M fallback | None. IDs remain globally readable. |
| gnosys_search 646 | CR FTS globally, pending overlay; S fallback | None. projectRoot does not restrict global search. |
| gnosys_list 731 | CR + overlay, filters current project plus nonproject scopes unless store filter; M fallback | None. Correct central visibility demonstrated. |
| gnosys_add 845 | scoped config, M write-target availability, S for related suggestions | CR project/specified scope; audit CR; reindexes B. Related suggestions still read stale S. |
| gnosys_add_structured 1012 | M write-target availability | CR project/specified scope; audit CR; reindexes B. |
| gnosys_tags 1115 | B tag registry | None. Explicitly ignores projectRoot. |
| gnosys_tags_add 1138 | B tag registry | B registry file. Explicitly ignores projectRoot. |
| gnosys_reinforce 1164 | M for useful target/count | CR only if Markdown target found; scoped reinforcement.log. Measured false success for central-only memory. |
| gnosys_init 1229 | directory argument, existing config | Requested directory config, registry, C project row; mutates B. projectRoot explicitly ignored. |
| gnosys_migrate 1324 | explicit sourcePath Markdown/config | targetPath config/Markdown, C project row and optional sync memories; registry/B. No projectRoot parameter. |
| gnosys_update 1418 | CR by ID, M fallback path resolution | CR memory + supersession + audit; reindexes B. |
| gnosys_stale 1528 | M | None. Measured central-only memory invisibility. |
| gnosys_commit_context 1592 | scoped config, S novelty lookup | CR project; audit CR; reindexes B. D-CTX-002. |
| gnosys_history 1790 | CR memory + audit | None. |
| gnosys_lens 1831 | M | None. Measured central-only memory invisibility. |
| gnosys_timeline 1888 | M | None. Measured central-only memory invisibility. |
| gnosys_stats 1919 | M | None. Measured central-only memory invisibility. |
| gnosys_links 1966 | CR memory + relationships; M fallback | None. |
| gnosys_graph 2044 | M | None. Measured central-only memory invisibility. |
| gnosys_bootstrap 2066 | source files; target Markdown titles for skipExisting | Target Markdown through bootstrap.ts:224. No central DB write; legacy path internally consistent but not central-first. |
| gnosys_import 2138 | data + M title dedup, B ingestion/provider | Calls performImport without DB/project/scope; reports imported but writes nothing. audit B gnosysDb; reindexes B. Measured. |
| gnosys_hybrid_search 2252 | B hybrid engine (C DB adapter in migrated mode, B Markdown/index otherwise) | best-effort reinforcement passes B store without DB and cannot persist central reinforcement; projectRoot ignored. |
| gnosys_semantic_search 2329 | B hybrid engine / central embeddings | None. projectRoot ignored. |
| gnosys_reindex 2387 | C active memories and B Markdown | B search/embedding indexes plus C embedding column. Explicit all-store semantics. |
| gnosys_ask 2434 | B ask/hybrid engine; C in DB mode | best-effort B reinforcement without DB as above. projectRoot ignored. |
| gnosys_maintain 2504 | M via maintenance engine | Engine receives no DB, so DB-only confidence/consolidation writes cannot persist; legacy archive/file effects possible. CR audit only. Dry-run measured scans0 despite central row. |
| gnosys_dearchive 2548 | requested store archive.db | Calls dearchiveBatch without centralDb; archive helper deletes archive row without restoring content centrally, then outer code updates tier of any existing central row. Missing-store-data loss was subsequently reproduced; see the sibling repair table. |
| gnosys_reindex_graph 2615 | M | requested first store graph.json. Measured nodes0 despite central row. |
| gnosys_dream 2637 | CR full brain + scoped dream config | CR memories/relationships/summaries, dream state/log. projectRoot selects config, not DB row filter. |
| gnosys_export 2723 | CR full brain | output vault files; explicitly no DB memory changes. |
| gnosys_dashboard 2776 | CR brain/projects plus M config/sidecars/legacy fallback | May create/update temporary store search index during diagnostics (dashboard.ts:283); no intended memory write. |
| gnosys_stores 2798 | B resolver/registry | None. No projectRoot parameter. |
| gnosys_recall 2929 | CR + overlay, or S + M legacy fallback | audit side effects; globally scoped DB recall; scoped config. |
| gnosys_audit 2983 | requested store `.config/audit.jsonl` | None. Central audit table is ignored even though writes use auditToDb. Measured empty despite write audit. |
| gnosys_preference_set 3015 | C user preference | C scope=user. projectRoot accepted but irrelevant. |
| gnosys_preference_get 3072 | C scope=user | None. projectRoot accepted but irrelevant. |
| gnosys_preference_delete 3124 | C user preference | C scope=user delete. projectRoot irrelevant. |
| gnosys_sync 3169 | C preferences/project conventions, requested project identity/config | requested project IDE rules, optionally files according to commit_to_disk; no intended memory mutations. |
| gnosys_federated_search 3276 | CR cross-project with detected project boost | None; global/user inclusion explicit. |
| gnosys_detect_ambiguity 3323 | C cross-project | None. No projectRoot parameter. |
| gnosys_briefing 3355 | C detected/explicit project or all projects | None. |
| gnosys_portfolio 3424 | C all projects | None. No projectRoot parameter. |
| gnosys_remote_status 3450 | L and configured remote; machine config | sync status metadata, explicit sync scope; no projectRoot parameter. |
| gnosys_remote_push 3492 | L, remote | remote memories plus local sync/conflict metadata. No projectRoot parameter. |
| gnosys_remote_pull 3521 | L, remote | L memories plus sync/conflict metadata. No projectRoot parameter. |
| gnosys_remote_resolve 3550 | L, remote | local/remote chosen row + conflict metadata. No projectRoot parameter. |
| gnosys_attach 3582 | CR memory + input file | CR attachment blob/name/mime/modified + audit. |
| gnosys_get_attachment 3628 | CR attachment | optional outputPath file only. |
| gnosys_update_status 3695 | C detected project | None; returns status-writing prompt/template. |
| gnosys_working_set 3723 | C detected project | None. |
| gnosys_ingest_file 3750 | input file, scoped config/store path | opens C per chunk and writes project scope (multimodalIngest.ts:431-455/575-610); attachment files/manifests scoped store. store argument is accepted but actual writes hardcode project. Report as separate scope-routing risk. |
| gnosys_trace 3847 | source directory, scoped project identity | explicitly local central path via new GnosysDB(getCentralDbDir), project memories + relationships. Bypasses remote-first C routing. |
| gnosys_reflect 3888 | explicitly local central path | local central confidence/relationship/reflection writes. projectRoot is accepted but ignored. |
| gnosys_traverse 3938 | explicitly local central path | None. projectRoot accepted but ignored. |

`resolveWriteScope` returns personal as personal (index.ts:449-475), but DB CHECK permits user/project/global (db.ts:169). This is another separate scope-contract risk, not the dedup-store defect. Do not silently widen a project dedup query to work around missing identities.


The table records the baseline census. The sibling repair table in this handoff records the final changes to those paths. Remaining boot-engine, scope-contract, or explicit local/remote routing differences are report-only; globally scoped discovery/read/search are intentionally unchanged.

## D-G3-001 hash compatibility (report only)

No hash fixes made. `fnv1a` at db.ts:389-396 uses JS float multiplication before unsigned truncation, which is not exact 32-bit FNV-1a for many multi-character inputs. `GnosysEmbeddings.contentHash` at embeddings.ts:245-252 repeats the algorithm independently and renders base36 rather than hex.

| Area | Compute | Store / compare |
| --- | --- | --- |
| Memory writes | dbWrite.ts:61 body-only; dbWrite.ts:123 recompute on content update | memories.content_hash TEXT, indexed at db.ts:177. No unique constraint and no direct content-hash dedup query found. |
| Preferences | preferences.ts:93 hash preference value | same central column via insertMemory. |
| Legacy migration | migrate.ts:89 Markdown content; :143 archived content | same central column; changing future algorithm does not rewrite existing rows automatically. |
| Staged sync ingestion | syncIngest.ts:45 hashes title + newline + body | central content_hash; inconsistent recipe with dbWrite already exists. Staging duplicate suppression at144 is processed ULID, not FNV. |
| Embedding sidecar | hybridSearch.ts:292 hashes title/relevance/tags/content using independent embedding FNV | embeddings.content_hash stored153-158, compared by isUpToDate194-199. No first-party caller of isUpToDate found. reindex clears whole sidecar at hybridSearch.ts:269 before recomputing. |
| Dream | dreamRunLog.ts:255 SHA256 of sorted id:modified:content_hash, first24hex prefixed kind | compared dream.ts:288, pending cache319, persisted analyzedFingerprints226-238, invoked critique895/summary1060/relationship1176. Existing changed hashes invalidate suppression and can cause repeat paid analysis. |
| Legacy remote sync | no FNV comparison | remote.ts:289-301/507/529-545/645-676 compares modified timestamps and IDs, transfers existing rows (including hash) as data. A hash-only migration without modified change will not reliably propagate via timestamp sync. A migration touching modified creates ordinary pushes/pulls/conflicts. |
| Staging integrity/snapshots | SHA256 syncStaging.ts:85 canonical payload; syncSnapshot.ts:46 key /52 file checksum | independent of FNV. |
| Web index | SHA256 full raw Markdown webIndex.ts:157 | document manifest contentHash172 / staticSearch.ts:44 shape. No first-party equality check of this manifest hash found. Independent of FNV. |
| Web import | SHA256 converted Markdown webIngest.ts:587 | frontmatter contentHash617, loaded448, compared596 for skip. Independent of FNV. |
| Attachment/import dedup | SHA256 bytes attachments.ts:101-104 | manifest147 equality. Bulk import.ts:261 and bootstrap use case-normalized titles, not FNV. Independent of FNV. |
| Placeholder writers | addCommand105, addStructuredCommand49/107, commitContextCommand144, clientReadOverlay37, trace311, sandbox/server162/479 | Write empty content_hash in synthetic or direct rows; correcting fnv1a cannot repair these values. |

Impact inference: changing only exported fnv1a gives old and new hashes side by side in existing DBs until rewrite; unchanged reads do not recompute them. Mixed-version machines may write different hash strings for identical content, and differing recipes already produce this. Timestamp-driven sync does not suddenly reject or corrupt rows, but last-modified winners can move differing hashes between machines and change Dream fingerprints. Fixing the exported helper does not fix the independent embedding helper. A future coordinated migration must specify input recipe, encoding/version, backfill semantics, whether modified timestamps change, and Dream/embedding cache invalidation. No migration is appropriate in this audit task.

## Update-config caller census

All 13 production callers were checked. Main setup's changed-task patch, models' global-default update, the advanced routing editor, and summary provider suggestion write ordinary nonempty patches. Dream disable writes false; Dream model removal via undefined actually removes the serialized scalar. Credential clearing uses an empty string and works. Web init writes a nonempty section. No updateConfig deep-merge behavior was changed.

The three empty-object clear attempts are the blocked DEF-G1-001 reset menu, routing's single-model choice, and providers' default-for-everything choice. The latter two are independent siblings; their repair and validation are recorded below. A project-local empty taskModels does not erase inherited global routing. Global inheritance remains intact and must not be changed silently.

## Report-only findings

- The extension's normal input premise is obsolete for central-only memories. Routine writes create no memory Markdown. Export produces ID-bearing Markdown in an arbitrary vault, and legacy Markdown may remain, but the required .gnosys path restriction excludes ordinary exports elsewhere. D-VSC-001 also remains blocked as described above.
- The extension still runs unpinned `npx gnosys`. Depending on package resolution it can select a project-local/cached/downloaded version rather than the global or running MCP version. Package selection was not changed.
- `scripts/check-new-file-coverage.mjs` exits 0 if its comparison ref is missing. Measured with `COVERAGE_BASE_REF=gnosys-audit-does-not-exist`: ambiguous-revision output, exit 0, no coverage-summary inspection. The read-only script remains unchanged.
- Scoped Ask, hybrid/semantic search engines and tags still use boot state; the routing census records their exact surfaces. Ask's configured-target/providerless-boot failure was reproduced. Repairing engine ownership/config/retrieval together is separate from these omitted-config and central-versus-Markdown lookups.
- `resolveWriteScope` elsewhere still returns personal while the database scope is user. The repaired import callers map this correctly without changing all write-tool contracts. File ingestion's store argument and trace/reflect/traverse remote routing remain separate scope issues.
- Bootstrap still writes legacy Markdown and performs title dedup there. Its read/write targets are internally consistent, but it does not implement the central-only architecture.
- Invalid-config errors are caught and replaced by defaults in Ask CLI, multimodal ingestion and resolveToolContext. This masks errors but is separate from valid-config constructor omissions.
- The legacy optional no-DB `performImport` helper still reports computed imports without persisting them. Immutable ordinary import tests explicitly require that behavior. Both production callers now provide the central DB for actual writes; the helper contract needs a QA-owned correction before it can reject omitted storage. Do not use that legacy mode as proof of a persisted import.
- Maintenance still detects duplicates from per-store embeddings, while normal DB indexing uses central embeddings. Its lock release is not protected by a comprehensive finally, and failed acquisition logs then proceeds. Missing-provider consolidation can be counted despite no write. Existing confidence calculations treat zero as 0.8 and may compound decay. These are distinct engine defects, outside the scoped persistence repair.
- Legacy archive sidecars lack attachment blobs. The dearchive repair preserves any existing central blobs; it cannot reconstruct blobs that were never stored in the sidecar.
- macOS local-disk detection still uses `df -T`, whose platform semantics can make detection return unknown. The shell fix preserves the existing detection behavior.
- The 24 uncovered obligations, FNV algorithm, version, CHANGELOG, CI and audit evidence remain outside this repair.

## Central-storage siblings fixed

| Commit and files | Before reproduction | After / legitimate path / callers |
| --- | --- | --- |
| `4907fc3`, commitContextCommand.ts | CLI context submitted A/A/B/B creates four rows because novelty scans empty Markdown. | Same actual CLI/local-provider sequence creates two rows, one per project; repeats each skip one. Uses the same project/scope FTS filter as the MCP repair. No per-store search handle remains. |
| `9a98800`, index.ts, importCommand.ts, import.ts | MCP structured import reports Imported 1 but creates no central row. Both production callers omit the helper's DB arguments. With a DB explicitly supplied, skipExisting still reads Markdown: A/A/B imports three rows. | CLI and MCP persist their records, skip a same-project repeat, and preserve B's new copy. Dedup reads exact target project/scope titles. Actual writes require storage and project identity; previews still work without either. Both callers retain the existing summary/error envelope. No-db helper behavior pinned by ordinary tests is reported separately. |
| `a3f0c61`, index.ts, graph.ts | Central-only records are absent from stale/lens/timeline/stats/graph; reindex_graph persists zero nodes. | Six MCP paths share a central-memory reader with current-project plus user/global visibility, pending overlay, and unavailable-DB Markdown fallback. Existing filenames from source_path remain usable in wikilinks. Actual checks verified age/limit, archived/tag/provenance filters, dates/counts, project isolation, pending rows, a persisted filename-based graph edge, repeat graph rebuild, and real legacy fallback. CLI graph's existing optional input contract remains compatible. |
| `8db9dd8`, index.ts | useful reinforcement reports success but central count stays 0 because lookup reads Markdown. | Actual MCP increments count to 1 and writes its audit event in one transaction. not_relevant leaves every central field unchanged; missing IDs return isError and add no row/audit. Injected audit failure rolls back the count. Tool schema and normal response remain unchanged. |
| `d5a7aa9`, index.ts | audit reads empty audit.jsonl despite real central WRITE/REINFORCE events. | Existing readAuditFromDb adapter supplies the same timeline format; exact operation and date filters work. WRITE/REINFORCE were generated by actual MCP calls; READ filter checks used seeded database audit rows. This does not add automatic read-event logging. |
| `0e381a2`, archive.ts, dearchiveCommand.ts, ask.ts, index.ts | Archive contains restore-witness and central DB is empty. dearchive returns a path, deletes the archive row, and leaves central DB/Markdown empty. | Explicit available DB is required; successful restoration precedes archive removal. Failure/no DB retains the source. CLI/MCP/Ask callers supply DB handles and close owned handles. Existing central content/project/embedding/attachment survives reactivation; archive-only rows infer identity from their actual store. Real CLI/MCP restore checks pass. |
| `f661675`, maintenance.ts, archive.ts, maintainCommand.ts, index.ts, cli/runtime.ts, dashboard.ts | Maintenance reports scanned 0 despite a central project row. Its DB writes are also disconnected. | Engine reads the selected write store's exact project/scope and writes that same DB. CLI/MCP/background/dashboard pass it. Dry run preserves rows; actual auto-apply changes the target project while B remains unchanged. Consolidation preserves project/scope and supersession atomically. DB archival marks the central row archived and does not unlink Memory.filePath. Categorized tags survive archive conversion. |

QA should promote each before/after reproduction to an immutable behavioral test: repeat context across projects, persisted CLI/MCP import with preview controls, the six central read/graph paths with shared scopes and pending overlays, transactional reinforcement with missing IDs, central audit filters, dearchive failure retention and blob preservation, and project-isolated maintenance dry-run/auto-apply. The disposable scripts used actual compiled entry points and SQLite; they were not committed.

## Remaining class repairs

### C. Explicit local routing clears

**FIXED siblings, `1384029`.** Files: `src/lib/config.ts`, `src/lib/setup/sections/routing.ts`, `src/lib/setup/sections/providers.ts`.

Both default-selection actions passed an empty object through the intentional deep merge. Selecting the same model skipped clearing entirely. A narrow helper now atomically merges the selected provider/model into the raw local config, explicitly clears its taskModels, and validates the effective inherited configuration. It preserves unrelated raw fields and does not copy inherited defaults into the local file. Generic updateConfig and the blocked reset-menu action remain unchanged.

Measured public-wizard reproduction: seed Ollama/local-old with an xAI structuring override. In routing choose the single-model action, then local-new or the already-selected local-old. Before, structuring remains xAI; after, it resolves to the selected Ollama model. In provider management select custom, choose its default-provider action, enter a new, unchanged, or blank model, then exit. Before, overrides survive; after, local overrides clear. A blank model retains the old model but records and reports the provider change.

The actual wizard/readline/persisted-config checks passed 43/43 with no network requests. Controls verified an invalid combined update leaves bytes unchanged, global config stays byte-identical, inherited global task overrides still apply and produce a visible warning, inherited custom-provider URLs are not copied locally, and Dream settings survive. The unchanged v584 deep-merge tests remain green. QA should cover these cases, plus cancellation while choosing a model before any provider change is saved. No migration is required.

### D. Literal subprocess input

Each row is a separately committed sibling. Verification used harmless PATH stubs for OS tools, temporary homes, and real shell parsing. No real keychain or launchd state was modified. Linux branches were exercised via a platform override on macOS, not a Linux host.

| Commit / file | Baseline reproduction | Repair, legitimate path, caller checks |
| --- | --- | --- |
| `0cc5707`, apiKeyVault.ts | Exported secure-store read/detect/delete/write functions receive a service, key, or label containing command substitution; a temporary marker is created and the value changes. | Quote all shell-significant bytes. Read/detect/delete/write preserve ordinary successful results and exact service, label and secret values. Existing setup keys, provider management, and other vault consumers retain their return/error contract. |
| `38e2ee8`, setup.ts | Its duplicate private key writers execute substitutions in user-entered keys; source detection and reread use the same shell boundary. | Apply the same literal quoting to these four paths. Private writer bodies were extracted using the TypeScript AST for function-level checks; this part was not a full interactive key-entry run. Ordinary wizard tests remain green. |
| `9c31773`, localDiskCheck.ts | A folder path containing shell substitution creates a marker before df runs. | execFileSync passes the exact resolved path as an argument. A normal APFS response still reports local disk. Callers receive the same verdict/message shape. |
| `f66643f`, syncIngestLaunchd.ts | Install/uninstall with a temporary HOME containing substitution creates a marker from the interpolated plist path. | launchctl receives argument arrays. The intended plist is created/removed and its exact path is returned; no real supervisor action was used. |
| `69777d7`, sandbox/helper-template.ts | Force npx failure with gnosys in a path containing spaces or substitution. Before, the intended binary is not called; substitution also creates a marker. | The generated fallback uses execFileSync with the located executable and argv. The correct binary is called in ordinary, spaced, and substitution paths. The deliberately failing stub still exits 1, with no marker. |

Measured matrix: before, 19/76 values stayed literal; after, 76/76 stayed literal and zero markers appeared. Inputs covered dollars, backticks, quotes, backslashes, newlines and spaces. Generated-helper checks covered three executable paths. QA should add behavioral tests at those boundaries and retain missing-tool/key failure controls.

The extension uses no shell for its variable arguments. The key helpers retain safely quoted execSync because immutable ordinary tests mock/pin that boundary; switching those helpers to argv would create prohibited ordinary failures and, in some mocked tests, leave a real keychain call. The user's no-shell ruling applies specifically to the extension. These fixes use general quoting rules, with no fixture-value branches or fake calls.

The remaining shell-string census found only fixed or constrained commands: validated Dream provider environment names in index.ts; the hardcoded Tailscale guide URL in remoteWizard; fixed systemd service names; upgrade commands selected from a closed package-manager switch; fixed postinstall setup/upgrade calls; fixed tool-detection strings in setup/IDE/helper/maintenance. Existing store, project identity, ffmpeg, Dream launchd, status-open, notification, ioreg, IDE installation and sandbox-manager launches already use argv. No additional input-bearing shell case was left without a repair or explanation.

### E. Archive and per-store FTS writers

**Archive FIXED, `0f66898`, src/lib/archive.ts.** Replacing archived memory X updated the base row but skipped an existing FTS row. Reproduce by archiving X with Saffron text, then with Cinnabar text: before, old-token search finds X and current-token search misses it; after, old-token search is empty and current-token search returns exactly X. A second ID with the same title still produces a separate result. Delete and insert now occur inside the base-write transaction.

Existing archive databases heal on open using additive archive_meta and marker fts_consistency_v1. An IMMEDIATE transaction rechecks the marker, rebuilds FTS from authoritative rows, and sets the marker last. Fixtures proved stale/duplicate/orphan removal, unchanged base data, unchanged user_version, no repeat rebuild, rollback on marker-insert failure, successful retry, and exactly one heal across four concurrent openers. Failed initialization closes its DB handle and retains the unavailable result contract. Archive/dearchive/maintenance/Ask callers retain their API shapes.

**Search FIXED, `b867c33`, src/lib/search.ts.** Both additive APIs inserted the same labeled relative path repeatedly. Before, adding the same path twice returned duplicate hits. Both addStoreMemories and addDbMemories now replace that exact path inside their existing transaction. A different store label remains distinct; updated tokens replace stale text; rewriting a legacy duplicated path removes all its duplicates. An invalid binding midway through a batch rolls the entire replacement back. Return values still count processed inputs. Scoped MCP context setup and CLI/MCP reindex callers retain their API contracts.

The real SQLite sibling checks passed 40/40. QA should cover the replacement, equal-title/different-ID, marker gating, concurrent open, heal retry, exact-label and failed-batch cases above. The central memories writer is covered under G2-D002. The census found no other FTS-backed upsert requiring this repair.

### F. Wizard cancellation

**Web init FIXED, `ad874e2`, src/lib/webInitCommand.ts.** Raw readline questions and a swallowed prompt error let Ctrl+C continue into mkdir/config writes and exit 0. All four prompts now use the existing safeQuestion helper, and finally closes the interface without swallowing errors.

Real compiled CLI/Python PTY checks measured the following. Each web cancellation also left config bytes unchanged and created no output directory; all four baseline cancellations had created output and changed config.

| Surface | Before | After |
| --- | --- | --- |
| Main setup first prompt | 0 | 130 |
| Main setup later IDE prompt | 0 (same close handler, source-confirmed) | 130, measured |
| setup remote | 130 | 130 |
| setup dream | 130 | 130 |
| setup keys | 130 | 130 |
| web init sitemap / enrichment / key variable / output directory | 0 at each | 130 at each |
| Main setup normal completion | 0 | 0 |
| web init normal completion | 0 | 0, output and config created |

The models/ides cancellation cases remain green in the immutable suite. Main setup is the only explicit readline close listener found; the other wizards use safeQuestion and finally. Web init's CLI error/output envelope and noninteractive contract remain intact. QA should add cancellation checks at each prompt, preserving normal and noninteractive completion controls.

### B. Automatic reinforcement callers

**FIXED, `2606b05`.** Files: src/lib/maintenance.ts, src/index.ts, src/lib/ask.ts, src/lib/askCommand.ts, src/lib/hybridSearchCommand.ts.

With an explicit central DB and a central-only memory, the old static helpers read missing Markdown and left count 0; batch returned 0. They now resolve an exact ID, stored source path, or category/id.md representation within the caller's project plus user/global scopes. Known labels narrow the scope. Ambiguous paths do not update either row. The transaction increments the current DB value, so a stale Markdown count cannot reset it. Omitting storage returns 0 without opening a database or claiming success.

Existing CLI Ask/hybrid and MCP Ask/hybrid callers now supply the central DB. MCP mutations use requested projectRoot and complete before context release. CLI open/update/close and MCP context acquisition remain best-effort, so optional reinforcement cannot discard a successful result. Ask's auto-dearchive reinforces before closing the already-owned DB handle. Maintenance also maps the legacy authority value user to declared, consistent with central read conversion.

Eleven functional checks passed: exact ID/path/synthetic reference; cross-project exclusion; shared-scope labels; ambiguous-path rejection; stale Markdown counts; omitted DB; actual CLI hybrid and Ask handlers; forced CLI DB-open failure preserving results and emitting the existing useful diagnostic; real MCP hybrid with cwd A and requested project B; and Ask restore/reinforce before DB close. Provider output was stubbed locally; SQLite and MCP were real. Existing direct static-helper tests use a temporary DB and remain green. QA should retain those cases and add concurrent increments and malformed references. The federated CLI hybrid branch still has no automatic reinforcement call. Retrieval engine scope remains the separately reported issue.

## Final verification

Final application commit: `2606b05`. All commands used Node 22.17.1 on the host. Test and audit sources were never edited. Builds and subprocess tests ran sequentially against stable dist; an earlier run that overlapped a rebuild was discarded and is not evidence for this handoff.

| Check | Result |
| --- | --- |
| npm run build | Exit 0; also rebuilt by the final npm test and Docker packing command. |
| npm test -- --reporter=json --outputFile=/private/tmp/gnosys-audit-fixes/final-suite.json | 1,693 total, 1,683 passed, 10 red, exit 1. Exactly nine repaired it.fails unexpected passes plus the one permitted ordinary VS Code error difference. No other ordinary failures. |
| npm run typecheck | Exit 0. |
| npm run lint | Exit 0, zero errors, 23 warnings. A disposable audit-baseline checkout produced the identical 23 diagnostics, including file and location. No new warning. No unrelated lint cleanup performed. |
| npm run knip | Exit 0, no findings. |
| node scripts/test-ci-scenarios.mjs multi-project | Exit 0; project identities, scoped lists/stats and persisted search verified. |
| node scripts/test-ci-scenarios.mjs local-storage | Exit 0; reopened storage verified. |
| npm run test:e2e-setup | Exit 0; Docker 29.4.3, six tests passed. Final source copied to /private/tmp/gnosys-final-docker-d94hoxiu; unchanged runner built and packed it, installed the tarball in the container, and ran with no network or host mounts. This avoided writing the runner's temporary tarball into the protected worktree e2e-setup directory. |
| Protected files and original checkout | SHA-256 checks confirm all 470 protected files and all 53 original dirty files unchanged; original git status exactly matches its starting inventory. Diff against the audit commit has no protected paths. |
| Commits | One defect or related sibling per commit. No hook bypass; no configured active hooks were present. No push, PR, release, version/CHANGELOG edit or local installation. |

The nine unexpected passes are:

1. D-VSC-002 exact directory component.
2. D-VSC-003 literal shell-syntax filename.
3. D-VSC-004 supported dashboard successor.
4. D-CTX-001 configured CLI provider and saved context.
5. D-CTX-002 repeated scoped MCP context.
6. G2-D003 configured CLI concurrency.
7. G2-D003 explicit concurrency override.
8. G2-D002 one FTS result after repeated memory write.
9. G2-D001 bare setup Ctrl+C.

The sole ordinary failure is src/test/vscode-extension.test.ts:69, `VS Code extension public commands > reports a process launch failure to the editor`. The expected message contains `Reinforce failed: spawnSync /bin/sh ENOENT`; the received message contains `Reinforce failed: spawnSync npx ENOENT`. This is the authorized consequence of using execFileSync without a shell. D-VSC-001, DEF-G1-001 and D-G3-001 remain expected failures, which Vitest reports as passed tests. No it.fails markers were removed.

Disposable scripts and raw logs remain under /private/tmp/gnosys-audit-fixes for local inspection and are not committed. They are supporting checks, not additions to QA-owned evidence. The final suite JSON, final Docker log, lint comparison JSON, and per-repair before/after files contain actual results. The recommended QA cases are specified per repair above so they can be recreated independently.

## Applying the changes

No new user configuration is required. This task did not install, deploy or publish the audit branch.

After the reviewed code is installed, opening the central DB automatically runs the marker-gated memories FTS heal; opening an archive automatically runs its archive FTS heal. Both markers are written after a successful atomic rebuild, so failure can retry. The central schema user_version stays 5. There is no manual SQL step and no install-time rebuild prerequisite. Existing base memory content, project identity, metadata and blobs are preserved. Search sidecar paths repair when rewritten; a normal reindex clears other stale cached paths.

Restart long-lived CLI/MCP processes when applying the eventual update. Old processes retain their loaded manual update/archive writer code; an on-open marker does not continually repair damage created afterward by an old writer. No process restart or user-database migration was performed by this audit task.

The original checkout contains separate shared-runtime work. This branch must be reconciled with that work before release; the handoff makes no claim that those unrelated changes have been tested together. QA must resolve the two immutable-test conflicts before implementing the remaining extension-ID and reset-menu fixes and before removing repaired it.fails markers.

## Manual checks for QA

1. In a disposable configured project, commit context twice, then repeat it in a different project. Confirm one copy per project and actionable setup guidance in an unconfigured project.
2. Import a structured record through CLI and MCP. Confirm real central persistence and same-project skipExisting; preview without storage must remain a preview.
3. With only central rows, inspect scoped lists/views/graphs, reinforce a real ID, read its audit event, run maintenance in dry-run and apply modes, then archive/restore. Confirm another project's rows and stored attachments remain intact.
4. In setup, choose a different model and the current model through the single-default action. Confirm local task overrides clear, unrelated/global settings survive, and inherited routing is disclosed. The separate reset action remains the documented defect.
5. Cancel each main/web setup prompt and check status 130. Complete normally and check status 0 plus the expected saved config.
6. Exercise filenames and paths containing spaces and shell syntax using harmless stubs. The extension dashboard must open system status. Extension reinforcement still awaits D-VSC-001.
7. Open copies of old central/archive databases containing stale or duplicate FTS rows twice. Confirm first-open repair and second-open stability before testing normal replacements and rollback.

The decisions that constrained these repairs were DB-first persistence, atomic base/index updates, explicit project selection, and preserving tested public contracts. The read-only-test rule overrode adding regression tests or making two incompatible witnesses appear green. General quoting and exact-path replacement address input classes; no fixture literals or query-time duplicate suppression were introduced.
