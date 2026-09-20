# Test audit

- [x] Isolate the committed baseline on test-audit.
- [x] Run baseline Vitest, Docker, and CI scenarios.
- [x] Inventory features independently and review every original test file.
- [ ] Complete all original test actions.
- [ ] Reconcile surviving faults and every changed/new test kill.
- [ ] Complete the feature protection matrix and fill unprotected feature gaps.
- [ ] Run final checks, confirm no application changes, and commit all audit work.

The baseline was green, but 672 of 1748 source test declarations failed the behavior standard in the reviewed classification ledger. Corrected tests expose 8 application defects, retained as expected failures because this audit changes no application code. The latest full suite passes 1711 runtime cases with 0 unexpected failures and 0 skipped tests. The audit remains in progress: 913 original declarations still await final action records, and the feature mapping is not complete. See [test-audit/ledger.json](test-audit/ledger.json) and [test-audit/evidence/integrated-checkpoints-full-suite.json](test-audit/evidence/integrated-checkpoints-full-suite.json).

## Counts before and after

| Classification | Before source declarations | After source declarations |
| --- | ---: | ---: |
| STRONG | 1076 | Pending |
| WEAK | 293 | Pending |
| HOLLOW | 45 | Pending |
| COUPLED | 285 | Pending |
| DEAD | 1 | Pending |
| MISLABELED | 48 | Pending |

The baseline contains 1748 source declarations in 296 TypeScript files, expanded by Vitest into 1802 runtime cases. The current inventory contains 1550 source declarations in 203 files. Deletions and many-to-one rewrites are counted separately in [test-audit/ledger.json](test-audit/ledger.json); deleted tests are not counted as DEAD tests. Eight shell/CI logical cases are reported separately below.

The baseline passed 1801 tests, with 1 skipped and zero failures, in 109.83 seconds. Docker passed six cases in 11.12 seconds. The original inline CI scenarios passed despite incomplete search assertions. The latest full suite passed 1711 tests, including 8 expected-failure regressions, with 0 unexpected failures and 0 skipped, in 82.92 seconds. See [test-audit/evidence/baseline.json](test-audit/evidence/baseline.json) and [test-audit/evidence/integrated-checkpoints-full-suite.json](test-audit/evidence/integrated-checkpoints-full-suite.json).

## Defects found

### D-G3-001: Exported fnv1a does not compute the documented 32-bit FNV-1a hash

Independently reproduced in the root audit worktree. BigInt XOR/multiply/modulo-2^32 arithmetic gives 4f9f2cab; the exported function returns a82fb4a1. Its floating-point multiplication loses low bits.

Expected: 4f9f2cab

Observed: a82fb4a1

Reproduce after building with `node scripts/test-audit-defect.mjs D-G3-001`. Confirmed. Retained as it.fails; ordinary failure and inverse repair probe recorded. Application code unchanged.

Evidence: [test-audit/evidence/group3-hash-defect.json](test-audit/evidence/group3-hash-defect.json), [test-audit/evidence/D-G3-001.reproduced.json](test-audit/evidence/D-G3-001.reproduced.json), [test-audit/mutations/hash.repair.results.json](test-audit/mutations/hash.repair.results.json).

### D-VSC-001: VS Code reinforcement omits the required signal and supplies a file path as a memory ID

The public extension command was invoked through a VS Code host boundary double and executed the local CLI. A temporary probe supplying --signal useful and the fixture memory ID makes the expected-failure test unexpectedly pass.

Expected: The selected memory receives useful reinforcement and its persisted modified date becomes today.

Observed: The real CLI rejects the command because --signal is required; the memory remains dated 2000-01-01.

Reproduce after building with `node scripts/test-audit-defect.mjs D-VSC-001`. Confirmed. Retained as it.fails; passing restoration and inverse repair probes recorded. Application code unchanged.

Evidence: [test-audit/evidence/vscode-defect-reproduction.json](test-audit/evidence/vscode-defect-reproduction.json), [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json), [test-audit/evidence/D-VSC-001.reproduced.json](test-audit/evidence/D-VSC-001.reproduced.json).

### D-VSC-002: VS Code memory-directory validation accepts names such as .gnosys-other

The selected path ends in .gnosys-other/memory.md. Requiring an exact path component makes the expected-failure test unexpectedly pass.

Expected: The outside-memory-directory warning appears and reinforcement is not invoked.

Observed: Substring validation accepts .gnosys-other and invokes the reinforcement subprocess.

Reproduce after building with `node scripts/test-audit-defect.mjs D-VSC-002`. Confirmed. Retained as it.fails; passing restoration and inverse repair probes recorded. Application code unchanged.

Evidence: [test-audit/evidence/vscode-defect-reproduction.json](test-audit/evidence/vscode-defect-reproduction.json), [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json), [test-audit/evidence/D-VSC-002.reproduced.json](test-audit/evidence/D-VSC-002.reproduced.json).

### D-VSC-003: VS Code reinforcement evaluates shell syntax in selected filenames

The real shell ran only a harmless touch command inside the temporary test project. Replacing shell interpolation with execFileSync argument passing makes the expected-failure test unexpectedly pass.

Expected: The literal argument decisions/$(touch audit-injected).md reaches the CLI without evaluating the shell expression.

Observed: The argument becomes decisions/.md and a harmless audit-injected marker is created in the isolated fixture directory.

Reproduce after building with `node scripts/test-audit-defect.mjs D-VSC-003`. Confirmed. Retained as it.fails; passing restoration and inverse repair probes recorded. Application code unchanged.

Evidence: [test-audit/evidence/vscode-defect-reproduction.json](test-audit/evidence/vscode-defect-reproduction.json), [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json), [test-audit/evidence/D-VSC-003.reproduced.json](test-audit/evidence/D-VSC-003.reproduced.json).

### D-VSC-004: VS Code dashboard action invokes a removed CLI command

The terminal host double executes the real built CLI through a local npx shim. A temporary supported status --system command makes the expected-failure test unexpectedly pass.

Expected: The terminal runs a supported CLI command and exits successfully.

Observed: npx gnosys dashboard exits 1 because dashboard is not a registered command.

Reproduce after building with `node scripts/test-audit-defect.mjs D-VSC-004`. Confirmed. Retained as it.fails; passing restoration and inverse repair probes recorded. Application code unchanged.

Evidence: [test-audit/evidence/vscode-defect-reproduction.json](test-audit/evidence/vscode-defect-reproduction.json), [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json), [test-audit/evidence/D-VSC-004.reproduced.json](test-audit/evidence/D-VSC-004.reproduced.json).

### DEF-G1-001: Task routing reset reports success but retains persisted overrides

The real summary wizard receives 2,4,y,done and its project config is reloaded. updateConfig recursively merges the empty taskModels object, retaining previous keys. A temporary clear-overrides repair makes the expected-failure test unexpectedly pass.

Expected: taskModels is empty after reset.

Observed: The structuring override remains xai/grok-4.20 despite routing reset success.

Reproduce after building with `node scripts/test-audit-defect.mjs DEF-G1-001`. Confirmed. Retained as it.fails. Application code unchanged.

Evidence: [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json), [test-audit/evidence/DEF-G1-001.reproduced.json](test-audit/evidence/DEF-G1-001.reproduced.json).

### G2-D001: Main setup cancellation returns success instead of interrupt status

A Python POSIX PTY waits for the real prompt and sends the Ctrl+C byte. The main setup close listener exits0 before safeQuestion can exit130. Models and IDE setup return130 through the same PTY.

Expected: Exit code130 after Ctrl+C at the real provider prompt.

Observed: The cancellation message appears but the process exits0.

Reproduce after building with `node scripts/test-audit-defect.mjs G2-D001`. Confirmed. Retained as it.fails. Application code unchanged.

Evidence: [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json), [test-audit/evidence/G2-D001.reproduced.json](test-audit/evidence/G2-D001.reproduced.json).

### G2-D002: Writing the same memory twice duplicates full-text search results

Two public syncMemoryToDb writes followed by getAllMemories and searchFts reproduce the mismatch. A temporary FTS-row replacement repair makes the expected-failure test unexpectedly pass.

Expected: One stored memory and one search result after repeated syncMemoryToDb writes.

Observed: One stored memory but two search results with the same ID.

Reproduce after building with `node scripts/test-audit-defect.mjs G2-D002`. Confirmed. Retained as it.fails. Application code unchanged.

Evidence: [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json), [test-audit/evidence/G2-D002.reproduced.json](test-audit/evidence/G2-D002.reproduced.json).

## Feature protection matrix

The inventory was derived from README, documentation, CLI/MCP registration, and exported modules before reading tests. Its 41 feature groups have 164 success, failure, boundary, and permission obligations. A passing expected-failure regression detects a known defect; it does not establish correct application behavior. Help contracts protect registration and documentation only. See [test-audit/features.json](test-audit/features.json) for source references.

| Feature | Path | Obligation | Protection | Strong tests | Limits |
| --- | --- | --- | --- | --- | --- |
| F01 Installation, binaries, optional dependencies | success | Installed gnosys and gnosys-mcp execute documented CLI and MCP entry points | PENDING |  |  |
| F01 Installation, binaries, optional dependencies | failure | Missing SQLite or embeddings produce actionable degradation instead of crashing unrelated commands | PENDING |  |  |
| F01 Installation, binaries, optional dependencies | boundary | Node >=20.12; package includes runnable dist and executable bins | PENDING |  |  |
| F01 Installation, binaries, optional dependencies | permissions | Postinstall and errors do not disclose keys | PENDING |  |  |
| F02 Project initialization, identity and registration | success | Init creates identity, registry and tags and selects the project for subsequent writes | PENDING |  |  |
| F02 Project initialization, identity and registration | failure | Missing/unwritable project directory reports failure | PENDING |  |  |
| F02 Project initialization, identity and registration | boundary | Repeated init preserves config and identity; duplicate paths/project IDs do not duplicate registration | PENDING |  |  |
| F02 Project initialization, identity and registration | permissions | Explicit projectRoot routes to requested project | PENDING |  |  |
| F03 Layered config and task/provider routing | success | Project overrides global then defaults; task override selects provider and model | PENDING |  |  |
| F03 Layered config and task/provider routing | failure | Invalid config or missing default provider returns actionable error | PENDING |  |  |
| F03 Layered config and task/provider routing | boundary | Partial nested configs retain inherited keys; update changes only requested keys | PENDING |  |  |
| F03 Layered config and task/provider routing | permissions | Secrets are not printed by config display | PENDING |  |  |
| F04 Interactive setup, model selection and IDE wiring | success | First-run provider/model/key/routing/IDE choices persist and installed client configuration starts MCP | PENDING |  |  |
| F04 Interactive setup, model selection and IDE wiring | failure | Invalid keys/models and unavailable local models provide recovery; cancelled prompts stop cleanly | PENDING |  |  |
| F04 Interactive setup, model selection and IDE wiring | boundary | Existing IDE entries survive merge; paths containing spaces work; non-TTY invocation is bounded | PENDING |  |  |
| F04 Interactive setup, model selection and IDE wiring | permissions | Only selected IDE configs are changed; secret destinations and permissions match selection | PENDING |  |  |
| F05 API key storage and precedence | success | Configured key then scoped/global/keychain/legacy env resolution selects expected credential | PENDING |  |  |
| F05 API key storage and precedence | failure | Missing key and inaccessible keychain surface useful failure without leaking credentials | PENDING |  |  |
| F05 API key storage and precedence | boundary | Provider-specific lookup; repeated save replaces one key; platform-specific storage works | PENDING |  |  |
| F05 API key storage and precedence | permissions | POSIX key files are private; errors and rendered config redact secrets | PENDING |  |  |
| F06 LLM generation, streaming, vision and retry contract | success | Each supported provider returns complete text and ordered stream tokens using selected task model; vision includes image | PENDING |  |  |
| F06 LLM generation, streaming, vision and retry contract | failure | Auth and malformed provider responses fail visibly; transient failures retry; timeout aborts | PENDING |  |  |
| F06 LLM generation, streaming, vision and retry contract | boundary | Default maxTokens 4096, generation 60s and probes 10s; streamed partial failures do not silently succeed | PENDING |  |  |
| F06 LLM generation, streaming, vision and retry contract | permissions | Keys remain outside generated context and diagnostic output | PENDING |  |  |
| F07 Memory creation and provenance | success | Structured creation persists literal title/category/tags/content/scope/provenance without LLM; freeform structures and persists input | PENDING |  |  |
| F07 Memory creation and provenance | failure | Invalid structured fields and unavailable write target fail without partial memory | PENDING |  |  |
| F07 Memory creation and provenance | boundary | Duplicate inputs; confidence endpoints 0 and 1; empty content; large content; scope defaults | PENDING |  |  |
| F07 Memory creation and provenance | permissions | Optional stores reject writes; global requires explicit target; MCP freeform add is rejected unless GNOSYS_ALLOW_FREEFORM_ADD=1 | PENDING |  |  |
| F08 Read, resolve and update memories | success | Read resolves IDs and layer-prefixed paths with correct content; update persists selected fields and timestamps | PENDING |  |  |
| F08 Read, resolve and update memories | failure | Unknown/ambiguous ID and read-only target report failure | PENDING |  |  |
| F08 Read, resolve and update memories | boundary | ID versus path precedence; short/long/raw IDs; field updates preserve unrelated values | PENDING |  |  |
| F08 Read, resolve and update memories | permissions | No cross-project write caused by cwd fallback when project is supplied | PENDING |  |  |
| F09 Keyword search and lightweight discovery | success | Literal title/content/tag queries rank expected memories; discover returns metadata without full content | PENDING |  |  |
| F09 Keyword search and lightweight discovery | failure | Malformed FTS input remains safe and gives defined output | PENDING |  |  |
| F09 Keyword search and lightweight discovery | boundary | Empty, punctuation, Unicode, quoted, ID and code-symbol queries; limit and ties; stale FTS after update/delete | PENDING |  |  |
| F09 Keyword search and lightweight discovery | permissions | Scope/store filters exclude disallowed results | PENDING |  |  |
| F10 Semantic embeddings, reindex and hybrid ranking | success | Reindex writes embeddings; paraphrase query finds semantic neighbor; RRF k=60 combines both rankings | PENDING |  |  |
| F10 Semantic embeddings, reindex and hybrid ranking | failure | Absent embeddings gives keyword-only hybrid and empty semantic results; provider failures are surfaced | PENDING |  |  |
| F10 Semantic embeddings, reindex and hybrid ranking | boundary | Repeat reindex replaces stale vectors; dimension mismatch, zero vector and empty index; limit enforcement | PENDING |  |  |
| F10 Semantic embeddings, reindex and hybrid ranking | permissions | Embedding generation uses configured provider and redacts credentials | PENDING |  |  |
| F11 Federated scopes, ambiguity and working set | success | Project/user/global tier boosts and score breakdown match selected project; working set selects recent changes; ambiguity identifies multiple projects | PENDING |  |  |
| F11 Federated scopes, ambiguity and working set | failure | Unknown project and invalid scope are handled explicitly | PENDING |  |  |
| F11 Federated scopes, ambiguity and working set | boundary | No-global filter, empty projects, time-window boundary, duplicate memory across sources and deterministic ties | PENDING |  |  |
| F11 Federated scopes, ambiguity and working set | permissions | Explicit project and scope filters remain effective through all retrieval modes | PENDING |  |  |
| F12 Recall and host hooks | success | Recall produces usable gnosys-recall block with matching content; wildcard chooses reinforcement/confidence/recency; hook emits host-compatible output | PENDING |  |  |
| F12 Recall and host hooks | failure | Unavailable store/provider does not corrupt hook protocol or hang host | PENDING |  |  |
| F12 Recall and host hooks | boundary | Aggressive versus threshold mode; limit, token/context budget and empty query; trace ID correlation | PENDING |  |  |
| F12 Recall and host hooks | permissions | Recall respects project scope; hook stdout contains only intended protocol payload | PENDING |  |  |
| F13 Question answering with citations | success | Question retrieves relevant memories, synthesizes answer and returns resolvable citations; streaming and JSON represent same answer | PENDING |  |  |
| F13 Question answering with citations | failure | No memories, provider failure and missing embedding fallback report useful outcomes | PENDING |  |  |
| F13 Question answering with citations | boundary | Retrieval limit; duplicate citations; long memory context | PENDING |  |  |
| F13 Question answering with citations | permissions | Stored instructions are treated as data and credentials are excluded from prompts | PENDING |  |  |
| F14 Lists, lenses, stale detection and tags | success | Category/tag/status/authority/author/confidence/date filters return exactly matching memories; tags add/list persist | PENDING |  |  |
| F14 Lists, lenses, stale detection and tags | failure | Invalid filter/date/number/category receives defined error | PENDING |  |  |
| F14 Lists, lenses, stale detection and tags | boundary | AND versus OR, any versus all tags, inclusive confidence/date cutoffs, empty results and duplicate tag addition | PENDING |  |  |
| F14 Lists, lenses, stale detection and tags | permissions | Read-only layer remains readable but tag/write operations target writable registry | PENDING |  |  |
| F15 Reinforcement and outcome reflection | success | Useful resets decay/increments reinforcement; not_relevant changes routing only; outdated flags review; reflect stores outcome and links related memories | PENDING |  |  |
| F15 Reinforcement and outcome reflection | failure | Unknown memory and invalid outcome/delta fail meaningfully | PENDING |  |  |
| F15 Reinforcement and outcome reflection | boundary | Confidence remains within 0..1; repeated outcomes and empty related list; success versus failure delta | PENDING |  |  |
| F15 Reinforcement and outcome reflection | permissions | Client add-only restrictions block unsupported update/reinforce operations | PENDING |  |  |
| F16 Wikilinks, graph and relationship traversal | success | Title and path-display links resolve outgoing/backlinks; reindex graph yields nodes/edges; BFS follows direction/type/depth | PENDING |  |  |
| F16 Wikilinks, graph and relationship traversal | failure | Unknown root and broken wikilinks produce defined results | PENDING |  |  |
| F16 Wikilinks, graph and relationship traversal | boundary | Cycles visit each memory once; root depth 0, max depth 10, empty graph, orphan targets | PENDING |  |  |
| F16 Wikilinks, graph and relationship traversal | permissions | Graph/traverse results obey intended project scope | PENDING |  |  |
| F17 Codebase tracing into procedural memories | success | Trace real source creates procedural memories and call-chain relationships with project association | PENDING |  |  |
| F17 Codebase tracing into procedural memories | failure | Missing/unreadable directory and parse failure report bounded errors | PENDING |  |  |
| F17 Codebase tracing into procedural memories | boundary | Max-files cap, unsupported file types, recursive directories, no matching functions and repeated trace | PENDING |  |  |
| F17 Codebase tracing into procedural memories | permissions | Read only requested directory; writes use requested project | PENDING |  |  |
| F18 Context sweep and deduplication | success | Sweep extracts atomic novel memories and augments changed knowledge | PENDING |  |  |
| F18 Context sweep and deduplication | failure | Malformed LLM structured output and write failure report partial/error state | PENDING |  |  |
| F18 Context sweep and deduplication | boundary | Dry-run has no writes; repeated identical context creates no duplicate | PENDING |  |  |
| F18 Context sweep and deduplication | permissions | Target store and declared/imported provenance preserved | PENDING |  |  |
| F19 Bulk bootstrap and structured data import | success | Markdown bootstrap and CSV/JSON/JSONL import persist mapped title/content/tags/category; summary counts reflect actual writes | PENDING |  |  |
| F19 Bulk bootstrap and structured data import | failure | Bad mapping, malformed source, missing file and HTTP failure report source/record error | PENDING |  |  |
| F19 Bulk bootstrap and structured data import | boundary | Dry-run, skip-existing, offset/limit, concurrency, empty input, frontmatter preservation | PENDING |  |  |
| F19 Bulk bootstrap and structured data import | permissions | URL imports enforce SSRF and redirect guards; selected scope controls writes | PENDING |  |  |
| F20 Document and multimodal ingestion | success | PDF/DOCX/TXT/MD/image/audio/video extract content into atomic linked memories; structured and LLM modes work | PENDING |  |  |
| F20 Document and multimodal ingestion | failure | Unsupported/corrupt files, missing vision/transcription provider and ffmpeg failure are useful failures | PENDING |  |  |
| F20 Document and multimodal ingestion | boundary | Chunk limits, overlap, empty extraction, non-ASCII content, glob batch, duplicate source and dry-run | PENDING |  |  |
| F20 Document and multimodal ingestion | permissions | Reads user-selected files only; credentials stay out of extracted content | PENDING |  |  |
| F21 Inline and filesystem attachments | success | Attach stores exact bytes/MIME/name; retrieve returns same bytes or writes requested file; inline blobs survive sync/export | PENDING |  |  |
| F21 Inline and filesystem attachments | failure | Missing file/memory/attachment and oversized attachment report error | PENDING |  |  |
| F21 Inline and filesystem attachments | boundary | 10 MiB accepted, one byte over rejected; identical bytes no rewrite; binary/NUL and empty file round trip | PENDING |  |  |
| F21 Inline and filesystem attachments | permissions | Output path handling and file-read scope remain deliberate | PENDING |  |  |
| F22 Maintenance, decay, consolidation and archive | success | Duplicate detection, decay and consolidation act on eligible memories; dearchive restores searchable memory | PENDING |  |  |
| F22 Maintenance, decay, consolidation and archive | failure | Missing embeddings/provider, failed write and nonexistent archived match report useful state | PENDING |  |  |
| F22 Maintenance, decay, consolidation and archive | boundary | Dry-run changes nothing; threshold/time boundaries; repeated maintenance; archived/superseded exclusions | PENDING |  |  |
| F22 Maintenance, decay, consolidation and archive | permissions | Automatic versus explicit application respects caller option; unrelated projects remain unchanged | PENDING |  |  |
| F23 Dream engine, scheduling and reports | success | Dream generates summaries/relationships/review suggestions and confidence decay; log/report show completed/skipped/failed cycles | PENDING |  |  |
| F23 Dream engine, scheduling and reports | failure | Unavailable provider and phase failure produce bounded partial report; active user aborts idle work | PENDING |  |  |
| F23 Dream engine, scheduling and reports | boundary | No deletion; max runtime, night/idle/cooldown boundaries, skipped phases, repeated/concurrent runs | PENDING |  |  |
| F23 Dream engine, scheduling and reports | permissions | Only designated node runs unless force; scheduler install writes correct user service | PENDING |  |  |
| F24 Preferences and generated agent rules | success | Set/get/list/delete user preference round trip; rules block contains preferences and project conventions | PENDING |  |  |
| F24 Preferences and generated agent rules | failure | Unknown preference deletion and absent rules target report clear status | PENDING |  |  |
| F24 Preferences and generated agent rules | boundary | Repeated injection yields one block and preserves surrounding user text; escaped text | PENDING |  |  |
| F24 Preferences and generated agent rules | permissions | MCP sync is read-only unless commit_to_disk=true; user preferences apply across projects | PENDING |  |  |
| F25 Statistics, timeline, audit and history | success | Counts/category/status/provenance/date summaries match persisted memories; audit/history show actual operations chronologically | PENDING |  |  |
| F25 Statistics, timeline, audit and history | failure | Invalid dates/unknown memory produce defined result | PENDING |  |  |
| F25 Statistics, timeline, audit and history | boundary | Empty DB, boundary timestamps, limits, archived records and trace-ID correlation | PENDING |  |  |
| F25 Statistics, timeline, audit and history | permissions | Audit does not expose secrets and respects requested filters | PENDING |  |  |
| F26 Project/system status, briefing and HTML dashboards | success | Briefings and portfolio show correct project memories/status/roadmap; system status reports DB/provider/embedding health; status template produces parseable heading format | PENDING |  |  |
| F26 Project/system status, briefing and HTML dashboards | failure | Unreachable provider/missing status memory does not invent success | PENDING |  |  |
| F26 Project/system status, briefing and HTML dashboards | boundary | Empty projects, archived/dead registry entries, HTML-sensitive memory titles and malformed status headings | PENDING |  |  |
| F26 Project/system status, briefing and HTML dashboards | permissions | Rendered HTML escapes stored content; project selection controls report scope | PENDING |  |  |
| F27 Obsidian vault export | success | Export produces valid Markdown/frontmatter/wikilinks/summaries/reviews/graph with preserved content | PENDING |  |  |
| F27 Obsidian vault export | failure | Invalid output path/write failure reports error without corrupt partial output | PENDING |  |  |
| F27 Obsidian vault export | boundary | Default active versus all; overwrite option; slug collisions; malicious titles/category; repeated export | PENDING |  |  |
| F27 Obsidian vault export | permissions | Export leaves DB unchanged and every output remains inside destination | PENDING |  |  |
| F28 Portable project export/import | success | Bundle round trip preserves memories, blobs, embeddings, relationships and optional audit; directory override applies | PENDING |  |  |
| F28 Portable project export/import | failure | Bad gzip/JSON/format/version and invalid strategy fail without destructive partial import | PENDING |  |  |
| F28 Portable project export/import | boundary | Merge skips duplicates; replace affects target; new-id remaps relationship/audit references; archived option | PENDING |  |  |
| F28 Portable project export/import | permissions | Import cannot overwrite unrelated project memory IDs through collision | PENDING |  |  |
| F29 Database durability, migration, backup and restore | success | Committed memory/FTS/relationships survive close/reopen and schema upgrade; backup/restore reproduce exact data | PENDING |  |  |
| F29 Database durability, migration, backup and restore | failure | Unavailable SQLite, invalid backup, locked/corrupt DB and failed migration report failure preserving previous state | PENDING |  |  |
| F29 Database durability, migration, backup and restore | boundary | Repeated migration no-op; crash during writes; binary fields; transaction atomicity; reopen invalidates statement cache | PENDING |  |  |
| F29 Database durability, migration, backup and restore | permissions | SQL values bound and columns allowlisted; DB and sidecars private; migrations preserve existing user DB | PENDING |  |  |
| F30 Machine identity, path mapping and project migration | success | Stable machine identity maps one project across machine-local roots; migration updates identity and DB registration | PENDING |  |  |
| F30 Machine identity, path mapping and project migration | failure | Unknown root, missing moved project and conflicting target report failure | PENDING |  |  |
| F30 Machine identity, path mapping and project migration | boundary | Hostname change regenerates ID unless GNOSYS_MACHINE_ID pinned; repeated scan/migrate deduplicates; spaces/nested roots | PENDING |  |  |
| F30 Machine identity, path mapping and project migration | permissions | Machine-local settings are not synced; paths resolve under selected root | PENDING |  |  |
| F31 Legacy push/pull synchronization and conflicts | success | Push/pull transfers new/changed memories including binaries and metadata; status reports accurate pending/conflicts | PENDING |  |  |
| F31 Legacy push/pull synchronization and conflicts | failure | Offline remote queues writes and reports reachability; failure does not acknowledge lost writes | PENDING |  |  |
| F31 Legacy push/pull synchronization and conflicts | boundary | Two-sided conflict skip-and-flag; local/remote resolution; repeated sync; deletion/tombstone and timestamp ties | PENDING |  |  |
| F31 Legacy push/pull synchronization and conflicts | permissions | Conflict choice follows explicit caller choice; local/remote paths are distinct | PENDING |  |  |
| F32 Snapshot client reads, pending overlays and offline adds | success | Client accepts verified newer snapshots; local pending adds appear once until receipt; offline adds persist | PENDING |  |  |
| F32 Snapshot client reads, pending overlays and offline adds | failure | Bad checksum/copy failure keeps prior accepted snapshot; unreachable master preserves visible pending adds | PENDING |  |  |
| F32 Snapshot client reads, pending overlays and offline adds | boundary | Snapshot epoch/version comparison; receipt dedup; source currently allows last accepted offline snapshot despite older docs | PENDING |  |  |
| F32 Snapshot client reads, pending overlays and offline adds | permissions | Connected clients stage adds and reject unsupported mutations; do not mutate published snapshots | PENDING |  |  |
| F33 Master staged ingestion, ownership and timers | success | Master ingests valid staged adds, records receipts, publishes snapshots and reports waiting/failed counts | PENDING |  |  |
| F33 Master staged ingestion, ownership and timers | failure | Malformed/checksum/schema-invalid files quarantine; wrong/stale lease aborts write; timer errors reported | PENDING |  |  |
| F33 Master staged ingestion, ownership and timers | boundary | Consecutive sweeps create no duplicate; stale temp quarantine; crash between insert/receipt; concurrent actors | PENDING |  |  |
| F33 Master staged ingestion, ownership and timers | permissions | Master DB must be local disk; machine identity and epoch fence reject non-owner writes | PENDING |  |  |
| F34 MCP stdio contract and dynamic toolset tiers | success | Real initialize/list-tools/call round trip works; core/standard/full sets match catalog; set emits list_changed | PENDING |  |  |
| F34 MCP stdio contract and dynamic toolset tiers | failure | Unknown tool, invalid schema and bad GNOSYS_MCP_TOOLSET return defined error/fallback | PENDING |  |  |
| F34 MCP stdio contract and dynamic toolset tiers | boundary | Each new session starts configured tier; shrink/expand repeatedly; stdout never contains logs | PENDING |  |  |
| F34 MCP stdio contract and dynamic toolset tiers | permissions | Tier state is isolated per HTTP session; freeform guard and projectRoot apply through MCP | PENDING |  |  |
| F35 HTTP MCP hosting, authentication and session lifecycle | success | Authenticated initialize/call/delete session work; health returns liveness and session count | PENDING |  |  |
| F35 HTTP MCP hosting, authentication and session lifecycle | failure | Unauthorized 401; forbidden Origin 403; invalid JSON 400; unknown route 404; oversized 413; stalled body 408 | PENDING |  |  |
| F35 HTTP MCP hosting, authentication and session lifecycle | boundary | 4 MiB default body limit, idle timeout/reaper, concurrent sessions, malformed IDs and server close | PENDING |  |  |
| F35 HTTP MCP hosting, authentication and session lifecycle | permissions | Non-loopback without token refuses startup; bearer exact match; default-deny Origin; health discloses no memory | PENDING |  |  |
| F36 Remote connect and centralization | success | Connect writes usable URL/bearer client config; centralize copies consistent local brain | PENDING |  |  |
| F36 Remote connect and centralization | failure | Invalid URL, unreachable host or existing target without force report error | PENDING |  |  |
| F36 Remote connect and centralization | boundary | Print mode does not write; IDE config merge preserves peers; repeated operation | PENDING |  |  |
| F36 Remote connect and centralization | permissions | Token is protected; source brain remains intact; force is required for overwrite | PENDING |  |  |
| F37 Sandbox lifecycle, socket protocol and generated helper | success | Start/status/stop operate real background process; generated helper calls add/recall/read/update successfully through socket | PENDING |  |  |
| F37 Sandbox lifecycle, socket protocol and generated helper | failure | Malformed request, unknown method, unavailable DB/socket and stale PID fail clearly | PENDING |  |  |
| F37 Sandbox lifecycle, socket protocol and generated helper | boundary | Repeated start/stop, newline framing, concurrent requests, response IDs, large/chunked payload and abrupt disconnect | PENDING |  |  |
| F37 Sandbox lifecycle, socket protocol and generated helper | permissions | Socket and PID location respect selected DB/user boundary; helper preserves project scope | PENDING |  |  |
| F38 Web knowledge ingestion and index lifecycle | success | Sitemap/directory/URL source builds knowledge Markdown and usable index; add/update/remove rebuild correct documents | PENDING |  |  |
| F38 Web knowledge ingestion and index lifecycle | failure | Bad URL/sitemap/source, provider failure and unsupported source give useful errors | PENDING |  |  |
| F38 Web knowledge ingestion and index lifecycle | boundary | Dry-run changes nothing; prune only orphaned docs; unchanged content skips; concurrency; empty sites | PENDING |  |  |
| F38 Web knowledge ingestion and index lifecycle | permissions | SSRF rejects private/loopback/metadata and rechecks redirects; output paths remain within knowledge root | PENDING |  |  |
| F39 Serverless lexical/hybrid search and vector builds | success | gnosys/web loads v1/v2 index and returns correct TF-IDF rankings; quantized vectors combine with RRF; concept expansion uses 0.5 weight | PENDING |  |  |
| F39 Serverless lexical/hybrid search and vector builds | failure | Missing/malformed index reports error; model/dimension mismatch warns then yields lexical-only result | PENDING |  |  |
| F39 Serverless lexical/hybrid search and vector builds | boundary | Absent query vector/vectors retains lexical behavior; zero vectors; quantization round trip; cache invalidation; expandQuery false | PENDING |  |  |
| F39 Serverless lexical/hybrid search and vector builds | permissions | Runtime imports zero native/embedding deps and makes no embedding API calls | PENDING |  |  |
| F40 Doctor, cleanup, upgrade and project housekeeping | success | Doctor identifies actual config/DB/provider problems; cleanup/prune remove only selected legacy artifacts; upgrade installs package then reports status | PENDING |  |  |
| F40 Doctor, cleanup, upgrade and project housekeeping | failure | Package manager/network failure and unavailable paths fail visibly | PENDING |  |  |
| F40 Doctor, cleanup, upgrade and project housekeeping | boundary | Dry-run no mutation; yes/noninteractive flows; repeated cleanup; missing already-removed artifacts | PENDING |  |  |
| F40 Doctor, cleanup, upgrade and project housekeeping | permissions | Cleanup/prune confirmation honored; upgrade uses argv-safe package manager invocation; unrelated files preserved | PENDING |  |  |
| F41 VS Code extension commands | success | Reinforce active memory produces persisted reinforcement and feedback; dashboard command launches functioning dashboard | PENDING |  |  |
| F41 VS Code extension commands | failure | No editor, outside-store file and CLI error show correct message | PENDING |  |  |
| F41 VS Code extension commands | boundary | Spaces, quotes and shell metacharacters in selected path; extension activation scope | PENDING |  |  |
| F41 VS Code extension commands | permissions | Selected file cannot inject shell commands; store detection uses actual path boundary | PENDING |  |  |

## Mutation results

Mutation reconciliation remains in progress. This is a targeted manual score, not a full-program or random mutation score. Original-test experiments and inverse repair probes for known defects are excluded. A mutation that causes only a build or harness failure does not count as killed. Repeated copies of evidence are deduplicated in [test-audit/ledger.json](test-audit/ledger.json).

The mutation runner restores exact original application bytes after each experiment, verifies the application digest, and reruns the selected tests. Every completed changed/new test has a named failing assertion in its proof record. The report distinguishes inverse repair probes: repairing a known bug temporarily must make its expected-failure test report an unexpected pass.

| Mutation | Target | Kind | Test stage | Result | Failing cases | Evidence |
| --- | --- | --- | --- | --- | ---: | --- |
| ci-multi-project-empty-search | src/lib/searchCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/ci.after.results.json](test-audit/mutations/ci.after.results.json) |
| ci-network-share-empty-search | src/lib/searchCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/ci.after.results.json](test-audit/mutations/ci.after.results.json) |
| ci-multi-project-empty-search | src/lib/searchCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/ci.before.results.json](test-audit/mutations/ci.before.results.json) |
| ci-network-share-empty-search | src/lib/searchCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/ci.before.results.json](test-audit/mutations/ci.before.results.json) |
| cli-registerCore | src/cli.ts | fault-injection | after | killed | 5 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerSetup | src/cli.ts | fault-injection | after | killed | 16 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerProject | src/cli.ts | fault-injection | after | killed | 2 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerMemory | src/cli.ts | fault-injection | after | killed | 11 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerBrowse | src/cli.ts | fault-injection | after | killed | 5 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerData | src/cli.ts | fault-injection | after | killed | 13 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerMaintenance | src/cli.ts | fault-injection | after | killed | 7 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerDream | src/cli.ts | fault-injection | after | killed | 4 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerExport | src/cli.ts | fault-injection | after | killed | 3 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerRuntime | src/cli.ts | fault-injection | after | killed | 7 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerRemote | src/cli.ts | fault-injection | after | killed | 10 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerAgent | src/cli.ts | fault-injection | after | killed | 11 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerSandbox | src/cli.ts | fault-injection | after | killed | 6 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerTrace | src/cli.ts | fault-injection | after | killed | 3 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| cli-registerWeb | src/cli.ts | fault-injection | after | killed | 9 | [test-audit/mutations/cli.after.results.json](test-audit/mutations/cli.after.results.json) |
| G1-pdf-password | src/lib/pdfExtract.ts | fault-injection | after | killed | 1 | [test-audit/mutations/encrypted-fixture.after.results.json](test-audit/mutations/encrypted-fixture.after.results.json), [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-pdf-normal | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-text-empty | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-docx-error | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-pdf-js | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-text-bom | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-special-paths | src/lib/multimodalIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-author-corrected | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-authority-corrected | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-color | src/lib/setup/ui/tokens.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-failed-rows | src/lib/setup/syncProjectsRender.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-dashboard-paths | src/lib/setup/syncProjectsRender.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-dream-disabled | src/lib/setup/dreamRender.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-structured-fields | src/lib/structuredIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-score | src/lib/structuredIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-frequency | src/lib/structuredIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-topn | src/lib/structuredIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tag-category | src/lib/tags.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tag-default | src/lib/tags.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-local-ack | src/lib/localDiskCheck.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-values | src/lib/embeddings.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-status | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-statuses | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-confidence | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-created | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-modified | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-combined | src/lib/lensing.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-paragraph | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-sentence | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-target | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-index | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-page | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-timerange | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-merge | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-empty | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-attachment-bytes | src/lib/attachments.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-multimodal-defaults | src/lib/config.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-incremental | src/lib/embedDb.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-reindex | src/lib/embedDb.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-single | src/lib/embedDb.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-day | src/lib/timeline.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-week | src/lib/timeline.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-sort | src/lib/timeline.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-modified | src/lib/timeline.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-projectless | src/lib/idFormat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-default | src/lib/idFormat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-nontty | src/lib/idFormat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-tty | src/lib/idFormat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-projectless-tty | src/lib/idFormat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-progress-noop | src/lib/progress.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-weight | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-stop | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-stop-disabled | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-archived | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-hash | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-determinism | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-async | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-write | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-overwrite | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-jsonl | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-extra | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-dryrun | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-batch | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-failure | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-duration-structured | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-duration-llm | src/lib/import.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-audit-empty | src/lib/auditCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-insert | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-audit | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-error | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-day | src/lib/timeline.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-week | src/lib/timeline.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-sort | src/lib/timeline.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-timeline-modified | src/lib/timeline.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-projectless | src/lib/idFormat.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-default | src/lib/idFormat.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-nontty | src/lib/idFormat.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-tty | src/lib/idFormat.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-id-projectless-tty | src/lib/idFormat.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-progress-noop | src/lib/progress.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-weight | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-stop | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-stop-disabled | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-archived | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-hash | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-determinism | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-async | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-write | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-web-overwrite | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-author-corrected | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-authority-corrected | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-pdf-js-execution | src/lib/pdfExtract.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-file-size-error | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-missing-file-error | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-values | src/lib/embeddings.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-jsonl | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-extra | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-dryrun | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-batch | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-import-failure | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-duration-structured | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-duration-llm | src/lib/import.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-audit-empty | src/lib/auditCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-insert | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-audit | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-recovery-error | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-pdf-normal | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-text-empty | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-docx-error | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-pdf-js | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-text-bom | src/lib/multimodalIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-special-paths | src/lib/multimodalIngest.ts | fault-injection | after | killed | 4 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-list | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-locations | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-local | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-custom | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-remove-selected | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-save-dotenv | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-reject-update | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-destinations | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-copy-cleanup | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-reject-copy | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-copy-idempotent | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-delete-dotenv | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-delete-keychain | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-key-delete-both | src/lib/setupKeys.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-status | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-statuses | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-confidence | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-created | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-modified | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-lens-combined | src/lib/lensing.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-paragraph | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-sentence | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-target | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-index | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-page | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-timerange | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-merge | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-chunk-empty | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-attachment-bytes | src/lib/attachments.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-multimodal-defaults | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-incremental | src/lib/embedDb.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-reindex | src/lib/embedDb.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-embedding-single | src/lib/embedDb.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-color | src/lib/setup/ui/tokens.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-failed-rows | src/lib/setup/syncProjectsRender.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-dashboard-paths | src/lib/setup/syncProjectsRender.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-dream-disabled | src/lib/setup/dreamRender.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-structured-fields | src/lib/structuredIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-score | src/lib/structuredIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-frequency | src/lib/structuredIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tfidf-topn | src/lib/structuredIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tag-category | src/lib/tags.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-tag-default | src/lib/tags.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-local-ack | src/lib/localDiskCheck.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint1.results.json](test-audit/mutations/group1.checkpoint1.results.json) |
| G1-dream-rerun | src/lib/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2-amendment.results.json](test-audit/mutations/group1.checkpoint2-amendment.results.json), [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-version-success | src/cli.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2-amendment.results.json](test-audit/mutations/group1.checkpoint2-amendment.results.json), [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-dream-scheduled-cli | src/cli/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2-amendment.results.json](test-audit/mutations/group1.checkpoint2-amendment.results.json) |
| G1-dream-abort-boundary | src/lib/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2-amendment.results.json](test-audit/mutations/group1.checkpoint2-amendment.results.json) |
| G1-shell-command-injection | src/lib/projectIdentity.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2-amendment.results.json](test-audit/mutations/group1.checkpoint2-amendment.results.json) |
| G1-audit-idempotent-write | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-audit-convergence | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-audit-merge | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-dream-rerun | src/lib/dream.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-full-tool-names | src/index.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-ide-args-gemini | src/lib/ideMcpInstall.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-ide-args-antigravity | src/lib/ideMcpInstall.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-rules-deterministic | src/lib/rulesGen.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-discover-scopes | src/lib/federated.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-list | src/lib/listCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-search | src/lib/searchCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-stats | src/lib/statsCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-dashboard | src/lib/dashboard.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-config-template | src/lib/config.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-web-vector-association | src/lib/webVectors.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-web-vector-int8 | src/lib/webVectors.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-tags | src/lib/tagsCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-lens | src/lib/lensCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-audit | src/lib/auditCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-tags-persist | src/lib/tagsAddCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-recall-empty | src/lib/recall.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-version-success | src/cli.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-help-success | src/cli.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-tags-persist | src/lib/tagsAddCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-recall-empty | src/lib/recall.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-help-success | src/cli.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-tags-idempotent | src/lib/tags.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-tags-sort | src/lib/tagsCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-recall-confidence | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-recall-recency | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-sync-warning | src/lib/setup/remoteRender.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-no-provider-load | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-local-vector-path | src/lib/embeddings.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-discover-scopes | src/lib/federated.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-list | src/lib/listCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-search | src/lib/searchCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-stats | src/lib/statsCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-dashboard | src/lib/dashboard.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-tags | src/lib/tagsCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-lens | src/lib/lensCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-audit | src/lib/auditCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cli-help-public | src/cli/sandbox.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-cleanup-rules-cli | src/cli/maintenance.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-dream-scheduled-cli | src/cli/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-shell-literal-copy | src/lib/projectIdentity.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-read-overlay-cli | src/lib/readCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-read-legacy | src/lib/readCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-overlay-content | src/lib/clientReadResolve.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-overlay-id | src/lib/clientReadResolve.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-web-vector-association | src/lib/webVectors.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-web-vector-int8 | src/lib/webVectors.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-summary-real-remote | src/lib/setup/summary.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-summary-na-row | src/lib/setup/summary.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-summary-fresh | src/lib/setup/summary.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-summary-xai | src/lib/setup/summary.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-summary-edited | src/lib/setup/summary.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-routing-reset-defect | src/lib/config.ts | defect-repair-probe | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-audit-idempotent-write | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-audit-convergence | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-audit-merge | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-full-tool-names | src/index.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-ide-args-gemini | src/lib/ideMcpInstall.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-ide-args-antigravity | src/lib/ideMcpInstall.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-rules-deterministic | src/lib/rulesGen.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-rules-target | src/lib/rulesGen.ts | fault-injection | after | killed | 3 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| G1-config-template | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group1.checkpoint2.results.json](test-audit/mutations/group1.checkpoint2.results.json) |
| g2-panel-width | src/lib/setup/ui/panel.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-panel-title | src/lib/setup/ui/panel.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-remove-index | src/lib/webRemoveCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-panel-width | src/lib/setup/ui/panel.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-panel-title | src/lib/setup/ui/panel.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-remove-index | src/lib/webRemoveCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-load-title | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-category | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-tags | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-list-category | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-tfidf | src/lib/structuredIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-graph-outgoing | src/lib/wikilinks.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-backlinks | src/lib/wikilinks.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-outgoing | src/lib/wikilinks.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-load-title | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-category | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-tags | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-list-category | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-tfidf | src/lib/structuredIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-graph-outgoing | src/lib/wikilinks.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-backlinks | src/lib/wikilinks.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-outgoing | src/lib/wikilinks.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-discovery | src/lib/bootstrap.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-content | src/lib/bootstrap.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-pattern | src/lib/bootstrap.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-export-bundle-content | src/lib/exportProject.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-export-vault-write | src/lib/export.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-recency | src/lib/federated.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-reinforcement | src/lib/federated.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-global | src/lib/federated.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-cross-project | src/lib/federated.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-discovery | src/lib/bootstrap.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-content | src/lib/bootstrap.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-bootstrap-pattern | src/lib/bootstrap.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-export-bundle-content | src/lib/exportProject.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-export-vault-write | src/lib/export.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-recency | src/lib/federated.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-reinforcement | src/lib/federated.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-global | src/lib/federated.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-federated-cross-project | src/lib/federated.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-centralize-force | src/lib/centralize.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-graph-nodes | src/lib/graphCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-list-tag | src/lib/listCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-timeline-period | src/lib/timelineCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-stores-output | src/lib/storesCommand.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-centralize-force | src/lib/centralize.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-graph-nodes | src/lib/graphCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-list-tag | src/lib/listCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-timeline-period | src/lib/timelineCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-stores-output | src/lib/storesCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-key-xai | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-key-mistral | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-openrouter-catalog | src/lib/openrouterTiers.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-key-xai | src/lib/config.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-key-mistral | src/lib/config.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-openrouter-catalog | src/lib/openrouterTiers.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-snapshot-read | src/lib/syncClient.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-pending-content | src/lib/syncClient.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-pending-receipt | src/lib/syncClient.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-staging-copy | src/lib/syncStaging.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-quiet-noop | src/lib/syncIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-ingest-json | src/lib/syncIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-ingest-body | src/lib/syncIngest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-snapshot-read | src/lib/syncClient.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-pending-content | src/lib/syncClient.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-pending-receipt | src/lib/syncClient.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-staging-copy | src/lib/syncStaging.ts | fault-injection | before | invalid-mutant | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-quiet-noop | src/lib/syncIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-ingest-json | src/lib/syncIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-ingest-body | src/lib/syncIngest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-docs-build-index | src/cli/web.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json), [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-docs-build | src/cli/web.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json), [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-docs-status | src/cli/web.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-http-session-isolation | src/lib/mcpHttp.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-cors-no-origin | src/lib/mcpHttp.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-cors-allowed | src/lib/mcpHttp.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-cors-no-origin | src/lib/mcpHttp.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-cors-allowed | src/lib/mcpHttp.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-staging-copy | src/lib/syncStaging.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-serve-exit | src/cli/runtime.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-serve-exit | src/cli/runtime.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-panel-clamp | src/lib/setup/ui/panel.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-panel-color | src/lib/setup/ui/panel.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-getdoc | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-determinism | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-native-isolation | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-exact-title | src/lib/wikilinks.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-wiki-id | src/lib/wikilinks.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-atomic-destination-first | src/lib/atomicWrite.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-attachment-cap | src/lib/attachments.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-freeform-gate | src/index.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-freeform-guidance | src/index.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-freeform-rules | src/lib/rulesGen.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-provider-schema | src/lib/config.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-xai-url | src/lib/llm.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-mistral-url | src/lib/llm.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-custom-url | src/lib/llm.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-custom-no-key | src/lib/llm.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-openrouter-fallback | src/lib/openrouterTiers.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-centralize-cli-force | src/cli/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-staging-checksum | src/lib/syncStaging.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-staging-quarantine | src/lib/syncStaging.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-startup-client | src/lib/syncIngestStartup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-startup-disabled | src/lib/syncIngestStartup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-deterministic-corruption | src/lib/webIndex.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-web-deterministic-corruption | src/lib/webIndex.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint1.results.json](test-audit/mutations/group2.checkpoint1.results.json) |
| g2-remote-count | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-push | src/lib/remote.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-pull | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-migrate | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-machine-identity | src/lib/remote.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-count | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-push | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-pull | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-remote-migrate | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-machine-identity | src/lib/remote.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-config-unforced-write | src/lib/configCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-config-unforced-write | src/lib/configCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-config-template | src/lib/configCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-config-template | src/lib/configCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-queue-vector | src/lib/embedDb.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-queue-vector | src/lib/embedDb.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-fts-upsert-repair-witness | src/lib/db.ts | defect-repair-probe | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-lifecycle-update-content | src/lib/dbWrite.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-toolset-dream-name | src/index.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-toolset-dream-name | src/index.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-setup-validation-success | src/lib/setup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-setup-secure-service | src/lib/setup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-setup-no-store | src/lib/setup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-setup-validation-failure | src/lib/modelValidation.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-setup-no-store | src/lib/setup.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-pty-cancel-status | src/lib/setup/ui/safePrompt.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-pty-setup-repair-witness | src/lib/setup.ts | defect-repair-probe | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-queue-warning | src/lib/embedQueue.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-store-manifest | src/lib/store.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| g2-store-category | src/lib/store.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group2.checkpoint2.results.json](test-audit/mutations/group2.checkpoint2.results.json) |
| log-invert-gate | src/lib/log.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| log-file-suppresses-stderr | src/lib/log.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| recall-empty-truncation | src/lib/recallHookCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| grok-empty-block | src/lib/setup.ts | fault-injection | after | killed | 3 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| claude-skip-install | src/lib/setup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-damage-peer | src/lib/machineRegistry.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-empty-persistence | src/lib/machineRegistry.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| links-wrong-target | src/lib/linksCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| launchd-always-absent | src/lib/dreamLaunchd.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| log-invert-gate | src/lib/log.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| log-file-suppresses-stderr | src/lib/log.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| recall-empty-truncation | src/lib/recallHookCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| grok-empty-block | src/lib/setup.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| claude-skip-install | src/lib/setup.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-damage-peer | src/lib/machineRegistry.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-empty-persistence | src/lib/machineRegistry.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| links-wrong-target | src/lib/linksCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| launchd-always-absent | src/lib/dreamLaunchd.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| chunks-empty-output | src/lib/chunkSplitter.ts | fault-injection | after | killed | 5 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| chunks-whitespace | src/lib/chunkSplitter.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| hash-length | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| chunks-empty-output | src/lib/chunkSplitter.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-list-empty | src/lib/listCommand.ts | fault-injection | after | killed | 5 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-stats-bogus | src/lib/statsCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-projects-omit-rows | src/lib/projectsCommand.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-pref-phantom | src/lib/prefCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-pref-human-empty | src/lib/prefCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-identity-invalid | src/lib/projectIdentity.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-audit-phantom | src/lib/auditCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-list-empty | src/lib/listCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-stats-bogus | src/lib/statsCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-projects-omit-rows | src/lib/projectsCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-pref-phantom | src/lib/prefCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-pref-human-empty | src/lib/prefCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-identity-invalid | src/lib/projectIdentity.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-audit-phantom | src/lib/auditCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-stats-human-output | src/lib/statsCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| cli-stats-human-output | src/lib/statsCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| export-drop-body | src/lib/export.ts | fault-injection | after | killed | 4 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| export-omit-wikilink-source | src/lib/export.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| backup-garbage | src/lib/db.ts | fault-injection | after | killed | 3 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| bundle-drop-body | src/lib/exportProject.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| merge-delete-existing | src/lib/importProject.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| export-drop-body | src/lib/export.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| export-omit-wikilink-source | src/lib/export.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| backup-garbage | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| bundle-drop-body | src/lib/exportProject.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| merge-delete-existing | src/lib/importProject.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| hash-length | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| heartbeat-cleanup | src/lib/heartbeat.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| heartbeat-cleanup | src/lib/heartbeat.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-noop | src/cli/project.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-null-tags | src/cli/project.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-invalid-identity | src/lib/projectIdentity.ts | fault-injection | after | killed | 6 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-future-schema | src/lib/projectIdentity.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-resync-noop | src/cli/project.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| preference-drop-value | src/lib/preferences.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-skip-registration | src/lib/projectIdentity.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-noop | src/cli/project.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-null-tags | src/cli/project.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-invalid-identity | src/lib/projectIdentity.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-future-schema | src/lib/projectIdentity.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| init-resync-noop | src/cli/project.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| preference-drop-value | src/lib/preferences.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| fingerprint-ignore-identity | src/lib/dreamRunLog.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| dream-cost-constant | src/lib/dreamRunLog.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| ingestion-empty-long-slug | src/lib/ingest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| docx-empty-output | src/lib/docxExtract.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| ingestion-available-always | src/lib/ingest.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| fingerprint-ignore-identity | src/lib/dreamRunLog.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| dream-cost-constant | src/lib/dreamRunLog.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| ingestion-empty-long-slug | src/lib/ingest.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| docx-empty-output | src/lib/docxExtract.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-load-empty-documents | src/lib/staticSearch.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-search-empty | src/lib/staticSearch.ts | fault-injection | after | killed | 4 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-reverse-rank | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-ignore-limit | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-wrong-document | src/lib/staticSearch.ts | fault-injection | after | killed | 2 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-repeat-documents | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-bypass-cache | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-load-empty-documents | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-search-empty | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-reverse-rank | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-ignore-limit | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-wrong-document | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| static-repeat-documents | src/lib/staticSearch.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| splash-double-v | src/lib/setup/coldStart.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| table-strip-cell-color | src/lib/setup/ui/table.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-invalid-fresh-id | src/lib/machineConfig.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-drop-existing-roots | src/lib/machineConfig.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-constant-id | src/lib/machineConfig.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| splash-double-v | src/lib/setup/coldStart.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| table-strip-cell-color | src/lib/setup/ui/table.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-invalid-fresh-id | src/lib/machineConfig.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-drop-existing-roots | src/lib/machineConfig.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| machine-constant-id | src/lib/machineConfig.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint1.results.json](test-audit/mutations/group3.checkpoint1.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| presence-wrong-filename | src/lib/syncStaging.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| config-suggestions-null | src/lib/setup/configSetRender.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| vectors-cache-clear-noop | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| standalone-search-empty | src/lib/staticSearch.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| fts-no-like-fallback | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| federated-cli-local-instead-snapshot | src/lib/clientReadResolve.ts | fault-injection | after | killed | 6 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| federated-mcp-local-instead-snapshot | src/index.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| scope-always-project | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| regression-export-drop-body | src/lib/export.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| archive-empty-content | src/lib/archive.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| schema-version-future | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| fts-wrong-row-id | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| reindex-ignore-second-call | src/lib/search.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| dream-drop-empty-error | src/lib/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| dream-drop-minimum-error | src/lib/dream.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| dashboard-wrong-active-count | src/lib/dashboard.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| maintenance-wrong-no-store-error | src/lib/maintenance.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| update-drop-reinforcement | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| migration-drop-body | src/lib/migrate.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| memory-drop-scope-project | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| project-drop-vault | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| audit-drop-details | src/lib/db.ts | fault-injection | after | killed | 1 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| scope-always-project | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| regression-export-drop-body | src/lib/export.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| archive-empty-content | src/lib/archive.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| schema-version-future | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| fts-wrong-row-id | src/lib/db.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| reindex-ignore-second-call | src/lib/search.ts | fault-injection | before | survived | 0 | [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json), [test-audit/mutations/group3.checkpoint2.results.json](test-audit/mutations/group3.checkpoint2.results.json) |
| D-G3-001-repair | src/lib/db.ts | defect-repair-probe | after | killed | 1 | [test-audit/mutations/hash.repair.results.json](test-audit/mutations/hash.repair.results.json) |
| cli-list-wrong-count | src/lib/listCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/phase8c-list.after.results.json](test-audit/mutations/phase8c-list.after.results.json) |
| cli-list-wrong-count | src/lib/listCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/phase8c-list.before.results.json](test-audit/mutations/phase8c-list.before.results.json) |
| setup-web-config | src/lib/webInitCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/setup-remainder.before.results.json](test-audit/mutations/setup-remainder.before.results.json) |
| setup-stray-write | src/lib/webInitCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/setup-remainder.before.results.json](test-audit/mutations/setup-remainder.before.results.json) |
| setup-version | src/cli.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-identity-name | src/lib/projectIdentity.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-default-model | src/lib/setup.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-web-config | src/lib/webInitCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-stray-write | src/lib/webInitCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-cancel-message | src/lib/setup/ui/safePrompt.ts | fault-injection | after | killed | 1 | [test-audit/mutations/setup.after.results.json](test-audit/mutations/setup.after.results.json) |
| setup-version | src/cli.ts | fault-injection | before | survived | 0 | [test-audit/mutations/setup.before.results.json](test-audit/mutations/setup.before.results.json) |
| setup-identity-name | src/lib/projectIdentity.ts | fault-injection | before | survived | 0 | [test-audit/mutations/setup.before.results.json](test-audit/mutations/setup.before.results.json) |
| setup-default-model | src/lib/setup.ts | fault-injection | before | survived | 0 | [test-audit/mutations/setup.before.results.json](test-audit/mutations/setup.before.results.json) |
| setup-web-config | src/lib/webInitCommand.ts | fault-injection | before | invalid-run | 0 | [test-audit/mutations/setup.before.results.json](test-audit/mutations/setup.before.results.json) |
| vscode-no-editor | extensions/vscode/extension.js | fault-injection | after | killed | 1 | [test-audit/mutations/vscode.after.results.json](test-audit/mutations/vscode.after.results.json) |
| vscode-outside-memory | extensions/vscode/extension.js | fault-injection | after | killed | 1 | [test-audit/mutations/vscode.after.results.json](test-audit/mutations/vscode.after.results.json) |
| vscode-command-error | extensions/vscode/extension.js | fault-injection | after | killed | 1 | [test-audit/mutations/vscode.after.results.json](test-audit/mutations/vscode.after.results.json) |
| repair-D-VSC-001 | extensions/vscode/extension.js | defect-repair-probe | after | killed | 1 | [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json) |
| repair-D-VSC-002 | extensions/vscode/extension.js | defect-repair-probe | after | killed | 1 | [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json) |
| repair-D-VSC-003 | extensions/vscode/extension.js | defect-repair-probe | after | killed | 1 | [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json) |
| repair-D-VSC-004 | extensions/vscode/extension.js | defect-repair-probe | after | killed | 1 | [test-audit/mutations/vscode.repairs.results.json](test-audit/mutations/vscode.repairs.results.json) |
| web-index-write | src/lib/webBuildIndexCommand.ts | fault-injection | after | killed | 5 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-index-validation | src/lib/webBuildIndexCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-build-write | src/lib/webBuildCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-dry-run | src/lib/webBuildCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-status-count | src/lib/webStatusCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-status-missing | src/lib/webStatusCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-corrupt-size | src/lib/webStatusCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| web-init-write | src/lib/webInitCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/web.after.results.json](test-audit/mutations/web.after.results.json) |
| cli-parent-path | src/cli/setup.ts | fault-injection | after | killed | 8 | [test-audit/mutations/wiring.after.results.json](test-audit/mutations/wiring.after.results.json) |
| web-index-skip-write | src/lib/webBuildIndexCommand.ts | fault-injection | after | killed | 1 | [test-audit/mutations/wiring.after.results.json](test-audit/mutations/wiring.after.results.json) |
| cli-parent-path | src/cli/setup.ts | fault-injection | before | survived | 0 | [test-audit/mutations/wiring.before.results.json](test-audit/mutations/wiring.before.results.json) |
| web-index-skip-write | src/lib/webBuildIndexCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/wiring.before.results.json](test-audit/mutations/wiring.before.results.json) |
| web-corrupt-size | src/lib/webStatusCommand.ts | fault-injection | before | survived | 0 | [test-audit/mutations/wiring.before.results.json](test-audit/mutations/wiring.before.results.json) |

## Per-file and per-test review

Every original declaration appears below, with baseline line numbers at revision 203c4e7. Expanded runtime cases follow. Pending entries are unfinished work, not accepted test protection.

| File and baseline line | Test | Before | After | Evidence | Action and mutation IDs |
| --- | --- | --- | --- | --- | --- |
| src/test/acceptance-features.test.ts:107 | lists gnosys tools and round-trips init + add + search | STRONG | Pending | Real MCP subprocess initializes a project, adds a named memory, and returns that literal title through search. | pending;  |
| src/test/acceptance-features.test.ts:161 | builds an index from docs and returns search hits | STRONG | Pending | Real file indexing and static search return a first result whose title contains Agentic for the automation query. | pending;  |
| src/test/acceptance-features.test.ts:209 | propagates a memory from machine A to machine B via remote dir | STRONG | Pending | Two real databases synchronize through a remote directory; asserts one push, one pull, no errors, and destination content. | pending;  |
| src/test/acceptance.test.ts:68 | initializes project A and B successfully | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; init-invalid-identity |
| src/test/acceptance.test.ts:84 | both projects have unique projectIds | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; init-invalid-identity |
| src/test/acceptance.test.ts:108 | adds project-scoped memories to project A | STRONG | STRONG | Real project insert/query returns exactly one memory with literal Project A Decision title. | kept;  |
| src/test/acceptance.test.ts:137 | adds user-scoped preferences | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; preference-drop-value |
| src/test/acceptance.test.ts:149 | user preferences are accessible regardless of project context | STRONG | STRONG | Real preference lookup returns the literal value and persisted user scope with null project ID. | kept;  |
| src/test/acceptance.test.ts:162 | generated rules include user preferences regardless of project | STRONG | STRONG | Rules generated from a real persisted preference contain Functional TypeScript. | kept;  |
| src/test/acceptance.test.ts:174 | federated search returns results from both projects | STRONG | STRONG | Federated search across two real projects returns exactly their two seeded memory IDs. | kept;  |
| src/test/acceptance.test.ts:227 | dream engine module loads without errors | WEAK | Deleted | Deleted module/constant-only smoke; public dream cycle failure cases cover actual startup guards. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | deleted;  |
| src/test/acceptance.test.ts:239 | exports memories to Obsidian vault | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; export-drop-body |
| src/test/acceptance.test.ts:263 | backs up the central database | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; backup-garbage |
| src/test/acceptance.test.ts:281 | separate projects have independent memory spaces | STRONG | STRONG | Project-specific reads return exactly one literal title each without the other project's memory. | kept;  |
| src/test/acceptance.test.ts:308 | user preferences span all project roots | STRONG | STRONG | Shared preference lookup returns Available everywhere and its persisted scope is user. | kept;  |
| src/test/acceptance.test.ts:320 | CLI list command works on initialized project | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-list-empty |
| src/test/acceptance.test.ts:337 | library API (GnosysDB) and CLI produce consistent results | MISLABELED | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-list-empty |
| src/test/acceptance.test.ts:358 | all major DB operations work in sequence | STRONG | STRONG | Real insert/update/search/delete sequence asserts confidence 0.8 then 0.95, reinforcement 1, one search match and deleted row absence. | kept;  |
| src/test/add-command-handler.test.ts:13 | wires add to runAddCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/add-command-handler.test.ts:29 | exports runAddCommand with correct module imports | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/add-structured-command-handler.test.ts:13 | wires add-structured to runAddStructuredCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/add-structured-command-handler.test.ts:32 | exports runAddStructuredCommand with tags JSON validation | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/ambiguity-command-handler.test.ts:13 | wires ambiguity to runAmbiguityCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/ambiguity-command-handler.test.ts:22 | exports runAmbiguityCommand with ambiguity markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/ambiguity-invoke.test.ts:41 | reports no ambiguity for a query with no cross-project hits (human) | STRONG | Pending | Real command with isolated empty DB emits the literal no-ambiguity message for zebra-unicorn-query. | pending;  |
| src/test/ambiguity-invoke.test.ts:48 | emits structured JSON with ambiguous: false | STRONG | Pending | Real command JSON contains the literal query and ambiguous false. | pending;  |
| src/test/apiKeyVault.test.ts:69 | names global and provider scoped keys | STRONG | Pending | Public key-name mapping returns literal global/provider environment names. | pending;  |
| src/test/apiKeyVault.test.ts:78 | lookup chain prefers global over provider | STRONG | Pending | Real env lookup selects global-key, then provider-key after deleting the global value. | pending;  |
| src/test/apiKeyVault.test.ts:86 | readFirstInChain falls through to legacy env | STRONG | Pending | Real lookup returns the literal legacy-key from XAI_API_KEY. | pending;  |
| src/test/apiKeyVault.test.ts:93 | readFirstInChain falls through to GNOSYS_LLM_API_KEY for any provider | STRONG | Pending | Two provider lookups return generic-key when scoped and legacy keys are absent. | pending;  |
| src/test/apiKeyVault.test.ts:102 | buildApiKeyRequirements emits one global key per cloud provider | STRONG | Pending | Parsed routing config produces exactly two literal provider/global requirements. | pending;  |
| src/test/apiKeyVault.test.ts:120 | lookup chain order is global then provider | STRONG | Pending | Public lookup-chain result equals the literal ordered Mistral key names. | pending;  |
| src/test/apiKeyVault.test.ts:127 | maskKeySnippet shows first and last characters | STRONG | Pending | Key masking returns literal sk-a…mnop, protecting visible redaction. | pending;  |
| src/test/apiKeyVault.test.ts:133 | listStoredKeySlots finds env global key | STRONG | Pending | Actual slot discovery includes the configured global OpenRouter environment service. | pending;  |
| src/test/apiKeyVault.test.ts:145 | detectKeyLocation returns the first env match with its variable name | STRONG | Pending | Location lookup returns exact env source, variable and masked final four characters. | pending;  |
| src/test/apiKeyVault.test.ts:157 | detectKeyLocation falls back to the gnosys dotenv file | STRONG | Pending | Temporary dotenv input resolves to exact dotenv source and masked suffix 3333. | pending;  |
| src/test/apiKeyVault.test.ts:168 | detectKeyLocation finds a global tier keychain key | STRONG | Pending | Real location resolver parses mocked OS keychain boundary into exact service and suffix 4444. | pending;  |
| src/test/apiKeyVault.test.ts:181 | detectKeyLocation prefers global keychain over provider env | STRONG | Pending | Real resolver chooses global keychain over provider env and returns suffix 6666. | pending;  |
| src/test/apiKeyVault.test.ts:195 | detectKeyLocation falls through to the legacy env var tier | STRONG | Pending | Legacy environment input yields exact OPENROUTER_API_KEY source and suffix 7777. | pending;  |
| src/test/apiKeyVault.test.ts:206 | detectKeyLocation falls through to the generic fallback env var | STRONG | Pending | Generic environment fallback yields exact GNOSYS_LLM_API_KEY and suffix 8888. | pending;  |
| src/test/apiKeyVault.test.ts:217 | detectKeyLocation prefers env over dotenv in the same tier | STRONG | Pending | Competing env/dotenv inputs return env source and suffix 9999. | pending;  |
| src/test/apiKeyVault.test.ts:229 | detectKeyLocation does not require keys for local providers | STRONG | Pending | Local Ollama and LM Studio produce exact no-key location objects. | pending;  |
| src/test/ask-command-handler.test.ts:13 | wires ask to runAskCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/ask-command-handler.test.ts:25 | exports runAskCommand with LLM, federated, stream, and cleanup markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/atomic-config-write.test.ts:26 | atomicWriteFile writes exact content with no leftover temp file | STRONG | STRONG | Reads actual destination bytes and parsed literal config; asserts no temporary artifacts. | kept;  |
| src/test/atomic-config-write.test.ts:37 | atomicWriteFile overwrites an existing file atomically | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-atomic-destination-first | rewritten; g2-atomic-destination-first |
| src/test/atomic-config-write.test.ts:48 | atomicWriteFileSync writes exact content with no leftover temp file | STRONG | STRONG | Sync writer destination bytes equal supplied machine JSON and leaves no temporary artifacts. | kept;  |
| src/test/attachments-inline.test.ts:45 | attaches a file and reads back identical bytes, mime, and name | STRONG | STRONG | Real DB attachment roundtrip preserves exact SVG bytes, MIME, name and size. | kept;  |
| src/test/attachments-inline.test.ts:64 | returns null when a memory has no attachment | STRONG | STRONG | A persisted memory without attachment returns null. | kept;  |
| src/test/attachments-inline.test.ts:69 | detaches an attachment but keeps the memory | STRONG | STRONG | Detach removes bytes, retains memory and returns false on the second detach. | kept;  |
| src/test/attachments-inline.test.ts:84 | rejects files larger than the size cap | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-attachment-cap | rewritten; g2-attachment-cap |
| src/test/attachments-inline.test.ts:91 | dedups identical bytes (no rewrite on re-attach) | STRONG | STRONG | Repeated real attachment returns unchanged=false then unchanged=true. | kept;  |
| src/test/attachments-inline.test.ts:102 | throws when the target memory does not exist | STRONG | STRONG | Public attach API rejects missing memory with not-found error. | kept;  |
| src/test/attachments-inline.test.ts:109 | survives the insertMemory row-copy that remote sync uses | STRONG | STRONG | Row copied into a second real DB retains exact SVG bytes, name and MIME. | kept;  |
| src/test/audit-command-handler.test.ts:13 | wires audit to runAuditCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/audit-command-handler.test.ts:25 | exports runAuditCommand with audit markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/audit-invoke.test.ts:41 | emits an empty JSON array when no audit entries exist | STRONG | Pending | Parses actual command stdout and asserts an empty array for an empty real DB. | pending;  |
| src/test/audit-invoke.test.ts:49 | renders a human-readable timeline for the empty case without erroring | WEAK | STRONG | Literal observable result now rejects replace human-readable empty audit timeline. | rewritten; G1-audit-empty |
| src/test/backup-command-handler.test.ts:13 | wires backup to runBackupCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/backup-command-handler.test.ts:24 | exports runBackupCommand with backup markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/bootstrap-command-handler.test.ts:13 | wires bootstrap to runBootstrapCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/bootstrap-command-handler.test.ts:27 | exports runBootstrapCommand with discoverFiles and bootstrap markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/bootstrap.test.ts:25 | finds markdown files | STRONG | STRONG | Real directory discovery returns exactly doc1.md/doc2.md and excludes txt. | kept;  |
| src/test/bootstrap.test.ts:36 | finds files in subdirectories | STRONG | STRONG | Nested discovery returns the literal decisions/auth.md path. | kept;  |
| src/test/bootstrap.test.ts:45 | supports custom patterns | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-bootstrap-discovery | rewritten; g2-bootstrap-discovery |
| src/test/bootstrap.test.ts:53 | returns empty for empty directory | STRONG | STRONG | Empty real directory returns zero discovered files. | kept;  |
| src/test/bootstrap.test.ts:58 | deduplicates files across patterns | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-bootstrap-discovery | rewritten; g2-bootstrap-discovery |
| src/test/bootstrap.test.ts:73 | extracts title from H1 heading | STRONG | STRONG | Public parser extracts literal My Decision from H1. | kept;  |
| src/test/bootstrap.test.ts:78 | falls back to filename for title | STRONG | STRONG | Filename fallback produces literal My Cool Doc title. | kept;  |
| src/test/bootstrap.test.ts:83 | infers category from directory structure | STRONG | STRONG | Directory inference returns literal decisions category. | kept;  |
| src/test/bootstrap.test.ts:88 | uses default category for root files | STRONG | STRONG | Root file returns literal imported category. | kept;  |
| src/test/bootstrap.test.ts:93 | preserves existing frontmatter when option is set | STRONG | STRONG | Frontmatter option preserves literal title/category/confidence/author values. | kept;  |
| src/test/bootstrap.test.ts:114 | uses defaults when not preserving frontmatter | STRONG | STRONG | Discarding source metadata yields literal imported category and authority. | kept;  |
| src/test/bootstrap.test.ts:127 | strips frontmatter from body | STRONG | STRONG | Returned body equals literal heading/body text without YAML delimiters. | kept;  |
| src/test/bootstrap.test.ts:142 | imports files into the store | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-bootstrap-content | rewritten; g2-bootstrap-content |
| src/test/bootstrap.test.ts:164 | skips existing memories when skipExisting is true | STRONG | STRONG | Mixed duplicate/new input reports one imported and literal doc1.md skipped. | kept;  |
| src/test/bootstrap.test.ts:199 | supports dry run mode | STRONG | STRONG | Dry run reports one candidate while actual store remains empty. | kept;  |
| src/test/bootstrap.test.ts:217 | handles empty source directory | STRONG | STRONG | Empty bootstrap reports zero scanned and imported. | kept;  |
| src/test/bootstrap.test.ts:226 | respects custom patterns | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-bootstrap-pattern | rewritten; g2-bootstrap-pattern |
| src/test/bootstrap.test.ts:242 | preserves category from subdirectory structure | STRONG | STRONG | Persisted imported memory retains literal architecture category. | kept;  |
| src/test/briefing-command-handler.test.ts:13 | wires briefing to runBriefingCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/briefing-command-handler.test.ts:25 | exports runBriefingCommand with briefing markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/briefing-invoke.test.ts:42 | prints 'No projects registered.' with --all on an empty DB | STRONG | Pending | Public briefing command on empty DB prints No projects registered. | pending;  |
| src/test/briefing-invoke.test.ts:48 | emits { count: 0 } JSON with --all --json on an empty DB | STRONG | Pending | Public briefing JSON on empty DB contains count 0 and an empty briefings array. | pending;  |
| src/test/briefing-invoke.test.ts:55 | includes a registered project's briefing in --all output | STRONG | Pending | Real inserted project is named briefing-test-project in public briefing output. | pending;  |
| src/test/centralize-command-handler.test.ts:13 | wires centralize to runCentralizeCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/centralize-command-handler.test.ts:24 | exports runCentralizeCommand with centralize markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/centralize-network.test.ts:13 | wires centralize --to for seeding a central brain (e.g. Docker volume or host for http serve) | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-centralize-cli-force | rewritten; g2-centralize-cli-force |
| src/test/check-command-handler.test.ts:13 | wires check to runCheckCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/check-command-handler.test.ts:22 | exports runCheckCommand with check markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/chunk-splitter.test.ts:18 | `input #${i} produces identical chunks across runs` | HOLLOW | STRONG | Exact literal text/index results cover whitespace, paragraphs, short merging, sentence splitting and oversized words. | rewritten; chunks-empty-output, chunks-whitespace |
| src/test/chunk-splitter.test.ts:25 | is stable across many repetitions | HOLLOW | Deleted | Deleted repeated self-equality duplicate; replaced by exact splitIntoChunks output cases. | deleted; chunks-empty-output, chunks-whitespace |
| src/test/chunk-splitter.test.ts:33 | fnv1a content hash is stable for identical content and differs for different content | WEAK | STRONG | Independent FNV vectors expose the production precision defect; failing hello vector retained with it.fails. | expected_failure; hash-length, D-G3-001-repair |
| src/test/cleanup-rules.test.ts:29 | strips the GNOSYS block from every known target and keeps user content | STRONG | Pending | Removes generated blocks from two real files while preserving literal user heading and notes. | pending;  |
| src/test/cleanup-rules.test.ts:49 | returns empty when no rules files or no GNOSYS blocks exist | STRONG | Pending | Asserts empty removal list and exact unchanged contents when no block exists. | pending;  |
| src/test/cleanup-rules.test.ts:57 | removeRulesBlock is safe on missing and malformed files | STRONG | Pending | Missing and unterminated marker files return the literal false result. | pending;  |
| src/test/cleanup-rules.test.ts:68 | exposes --rules on the cleanup command and routes to removeRulesFromProject | COUPLED | STRONG | Literal observable result now rejects skip cli rules removal. | rewritten; G1-cleanup-rules-cli |
| src/test/cli-command-wiring.test.ts:16 | every .command() declared in source is registered at runtime | WEAK | STRONG | Literal full paths preserve parent-child relationships. All 112 command and alias cases fail when their registration is omitted and pass after restoration. | rewritten; cli-registerCore, cli-registerSetup, cli-registerProject, cli-registerMemory, cli-registerBrowse, cli-registerData, cli-registerMaintenance, cli-registerDream, cli-registerExport, cli-registerRuntime, cli-registerRemote, cli-registerAgent, cli-registerSandbox, cli-registerTrace, cli-registerWeb, cli-parent-path |
| src/test/cli-json.test.ts:34 | gnosys list --json outputs valid JSON | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-list-empty |
| src/test/cli-json.test.ts:45 | gnosys stats --json outputs valid JSON | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-stats-bogus |
| src/test/cli-json.test.ts:54 | gnosys projects --json outputs valid JSON | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-projects-omit-rows |
| src/test/cli-json.test.ts:65 | gnosys pref get --json outputs valid JSON with no prefs | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-pref-phantom |
| src/test/cli-json.test.ts:74 | gnosys pref set + get --json round-trips | STRONG | STRONG | Real CLI set/get persists test-key with literal value test value. | kept;  |
| src/test/commit-context-command-handler.test.ts:13 | wires commit-context to runCommitContextCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/commit-context-command-handler.test.ts:25 | exports runCommitContextCommand with extraction and commit markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/config-command-handler.test.ts:13 | wires config subcommands to extracted handlers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/config-command-handler.test.ts:39 | exports named config handler functions | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/config-knob-removal.test.ts:35 | still loads a config file containing the removed keys (no throw), strips them, and warns on stderr | STRONG | Pending | Real config file strips obsolete keys and emits each literal warning once across repeated loads. | pending;  |
| src/test/config-knob-removal.test.ts:74 | removed keys are stripped by schema parse and importConcurrency default is 5 | STRONG | Pending | Public schema rejects obsolete shape by stripping keys and returns literal concurrency default five. | pending;  |
| src/test/connect-command-handler.test.ts:10 | wires connect to runConnectCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/connect-command-handler.test.ts:23 | exports runConnectCommand with connect markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/db-coverage.test.ts:42 | returns runs ordered DESC and parses details | STRONG | Pending | Real audit rows return exact descending timestamps, duration 1500 and parsed summary count 2. | pending;  |
| src/test/db-coverage.test.ts:53 | truncates results with limit | STRONG | Pending | Five real rows truncated to exact two newest dates. | pending;  |
| src/test/db-coverage.test.ts:64 | filters by sinceIso | STRONG | Pending | Since filter returns the exact three inclusive date results. | pending;  |
| src/test/db-coverage.test.ts:78 | returns details: {} when audit details is not valid JSON | STRONG | Pending | Invalid stored JSON yields the literal empty details object. | pending;  |
| src/test/db-coverage.test.ts:85 | failuresOnly filters by errors > 0 OR providerUnreachable | STRONG | Pending | Failure filter returns exactly two seeded error/unreachable timestamps. | pending;  |
| src/test/db-coverage.test.ts:100 | failuresOnly false returns all runs including successes | STRONG | Pending | Explicit failuresOnly=false returns both success and failure rows. | pending;  |
| src/test/db-coverage.test.ts:107 | uses timestamp as started fallback when startedAt is missing | STRONG | Pending | Missing startedAt returns the stored literal audit timestamp. | pending;  |
| src/test/db-coverage.test.ts:114 | returns three runs with default limit when seeded | STRONG | Pending | Default query returns three rows and exact latest timestamp/duration. | pending;  |
| src/test/db-coverage.test.ts:127 | returns null when audit_log is empty | STRONG | Pending | Empty real audit DB returns null. | pending;  |
| src/test/db-coverage.test.ts:131 | returns null when only failed runs exist | STRONG | Pending | Seeded failure-only audit returns null. | pending;  |
| src/test/db-coverage.test.ts:141 | returns the most recent successful run when mixed | STRONG | Pending | Mixed audit rows select the exact newest successful date. | pending;  |
| src/test/db-coverage.test.ts:150 | counts decay-only runs as successful | STRONG | Pending | Decay-only audit selects exact date and decay count 5. | pending;  |
| src/test/db-coverage.test.ts:162 | counts relationships-only runs as successful | STRONG | Pending | Relationship-only audit selects its literal timestamp. | pending;  |
| src/test/db-coverage.test.ts:173 | counts summaries-only runs as successful | STRONG | Pending | Summary-only audit returns literal summariesGenerated=3. | pending;  |
| src/test/db-recovery-extended.test.ts:57 | survives SIGKILL mid-transaction (WAL rollback, integrity ok) | MISLABELED | Deleted | Deleted SQLite-only SIGKILL test: it imports no application path and validates only better-sqlite3 transaction rollback. | deleted;  |
| src/test/db-recovery-extended.test.ts:105 | surfaces ENOSPC/full-disk as a clear non-corruption error | COUPLED | STRONG | Fault injection replaces actual external better-sqlite3 statement.run, not a Gnosys method; public insertMemory surfaces literal disk-full error and classifies it non-corruption. | kept;  |
| src/test/db-recovery-extended.test.ts:130 | searchFts degrades gracefully when the FTS index is corrupted | STRONG | STRONG | External SQLite connection removes FTS index; public search returns exact persisted memory ID through fallback. | rewritten; fts-no-like-fallback |
| src/test/db-recovery-extended.test.ts:142 | degrades gracefully when better-sqlite3 cannot load | STRONG | STRONG | Mocks an unavailable native dependency boundary; public DB reports unavailable, null metadata, and rejects backup with Database not available. | kept;  |
| src/test/db-recovery.test.ts:44 | getMemory() retries successfully after a corrupt-handle error | STRONG | Pending | After injected SQLite boundary corruption, public getMemory returns literal persisted title Test. | pending;  |
| src/test/db-recovery.test.ts:84 | insertMemory() retries successfully after a corrupt-handle error | WEAK | STRONG | Literal observable result now rejects lose title and content on recovered insert. | rewritten; G1-recovery-insert |
| src/test/db-recovery.test.ts:121 | logAudit() retries successfully after a corrupt-handle error | WEAK | STRONG | Literal observable result now rejects skip recovered audit write entirely. | rewritten; G1-recovery-audit |
| src/test/db-recovery.test.ts:136 | getAllProjects() retries successfully after a corrupt-handle error | STRONG | Pending | Corrupt-handle recovery returns one project with literal Project One name. | pending;  |
| src/test/db-recovery.test.ts:155 | rethrows non-corrupt errors without retry | STRONG | Pending | Non-corrupt SQLite error must throw the literal syntax error message. | pending;  |
| src/test/db-recovery.test.ts:167 | throws a clear message if reopen also fails | WEAK | STRONG | Literal observable result now rejects lose actionable reopen-failure diagnosis. | rewritten; G1-recovery-error |
| src/test/db-sync-v13.test.ts:21 | migrates to schema version 5 with sync tables | STRONG | Pending | Real DB ledger, processed ULID, pending-add clear and manifest heartbeat yield exact counts and values. | pending;  |
| src/test/dearchive-command-handler.test.ts:13 | wires dearchive to runDearchiveCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/dearchive-command-handler.test.ts:22 | exports runDearchiveCommand with dearchive markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/discover-command-handler.test.ts:13 | wires discover to runDiscoverCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/discover-command-handler.test.ts:26 | exports runDiscoverCommand with federated and default FTS markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/docs-web-flags.test.ts:32 | `${relPath} flags all exist in src/cli.ts` | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-docs-build, g2-docs-build-index, g2-docs-status | rewritten; g2-docs-build, g2-docs-build-index, g2-docs-status |
| src/test/doctor-command-handler.test.ts:13 | wires doctor to runDoctorCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/doctor-command-handler.test.ts:27 | exports runDoctorCommand handler | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/doctor-command-handler.test.ts:31 | uses correct relative imports for archive and embeddings | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/docx-bomb.test.ts:61 | rejects a zip-bomb DOCX before decompression (no OOM) | STRONG | STRONG | Real 210 MiB expanded DOCX is rejected with possible zip bomb before extraction succeeds. | kept;  |
| src/test/docx-bomb.test.ts:73 | handles billion-laughs entity definitions without exponential expansion | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; docx-empty-output |
| src/test/dream-coverage.test.ts:98 | exits early when DB is unavailable | STRONG | Pending | Unavailable DB boundary produces literal error and zero decay count. | pending;  |
| src/test/dream-coverage.test.ts:106 | exits early when too few memories | STRONG | Pending | Two stored memories below minimum ten produce Too few memories error. | pending;  |
| src/test/dream-coverage.test.ts:114 | records provider-init error and increments consecutive failures | STRONG | Pending | Provider failure produces persisted unreachable audit event and consecutive failure count one. | pending;  |
| src/test/dream-coverage.test.ts:128 | fires desktop notification at consecutive failure threshold | STRONG | Pending | Third consecutive provider failure emits a desktop notification containing failed 3 times. | pending;  |
| src/test/dream-coverage.test.ts:140 | runs all phases on happy path with stubbed LLM | WEAK | Pending | All-phases title checks only at least one generated summary and absence of errors. | pending;  |
| src/test/dream-coverage.test.ts:181 | aborts at shouldStop checkpoint when abort requested | STRONG | Pending | Abort at decay callback returns aborted=true and literal abort requested reason. | pending;  |
| src/test/dream-coverage.test.ts:191 | aborts when max runtime exceeded | STRONG | Pending | Controlled clock crossing runtime limit produces aborted=true and max runtime reason. | pending;  |
| src/test/dream-coverage.test.ts:219 | resets consecutive failures when LLM work succeeded | STRONG | Pending | Successful summary generation clears persisted failure count from five to zero. | pending;  |
| src/test/dream-coverage.test.ts:241 | decaySweep updates stale memories and skips recent ones | WEAK | Pending | Decay test checks only report.decayUpdated>=2; neither aged confidence nor recent exclusion is inspected. | pending;  |
| src/test/dream-coverage.test.ts:265 | critiquMemory rule arms produce review suggestions | STRONG | Pending | Concrete invalid memories yield all six literal review reasons and low-confidence consider-archive action. | pending;  |
| src/test/dream-coverage.test.ts:304 | llmCritique handles ok, review, needs-update, and malformed JSON | WEAK | Pending | Four LLM outcomes reduce to count>=2 matching reasons; exact memory/action and malformed outcome are unchecked. | pending;  |
| src/test/dream-coverage.test.ts:329 | generateSummaries creates, skips unchanged, and updates summaries | WEAK | Pending | Summary lifecycle checks generated/updated counts across runs but never stored summary text. | pending;  |
| src/test/dream-coverage.test.ts:359 | summarizeCategory swallows provider errors without crashing | STRONG | Pending | Rejected provider calls produce zero summary creation/update and the expected empty non-provider error list. | pending;  |
| src/test/dream-coverage.test.ts:379 | discoverRelationships filters self-ref, low confidence, and deduplicates | WEAK | Pending | Relationship filtering checks one stored row and duplicate count zero, but not retained target/type. | pending;  |
| src/test/dream-coverage.test.ts:415 | findRelationships returns empty array on malformed JSON | STRONG | Pending | Malformed provider JSON produces zero discovered relationships through public dream execution. | pending;  |
| src/test/dream-coverage.test.ts:432 | formats happy path with suggestions and errors | STRONG | Pending | Report formatting contains literal decay count three, review count/action and error e1. | pending;  |
| src/test/dream-coverage.test.ts:463 | formats aborted report | STRONG | Pending | Aborted report renders literal Aborted: halt. | pending;  |
| src/test/dream-coverage.test.ts:482 | formats empty report without suggestion or error headers | STRONG | Pending | Empty report renders duration while omitting suggestion/error section headers. | pending;  |
| src/test/dream-coverage.test.ts:509 | constructor ignores prototype pollution keys | COUPLED | Pending | Prototype-pollution check inspects private scheduler.config via cast instead of scheduler behavior. | pending;  |
| src/test/dream-coverage.test.ts:517 | start is no-op when disabled | COUPLED | Pending | Disabled scheduler only asserts private checkInterval remains null. | pending;  |
| src/test/dream-coverage.test.ts:524 | start is no-op when machine is not designated | COUPLED | Pending | Undesignated scheduler only asserts private checkInterval remains null. | pending;  |
| src/test/dream-coverage.test.ts:531 | start arms interval and triggers dream when designated and idle | COUPLED | Pending | Mutates private lastActivity and mocks engine.dream; validates internal interval and method call only. | pending;  |
| src/test/dream-coverage.test.ts:562 | recordActivity aborts running engine | COUPLED | Pending | Forces private running state and inspects private lastActivity plus abort call. | pending;  |
| src/test/dream-coverage.test.ts:573 | stop clears interval and aborts running engine | COUPLED | Pending | Forces private running state and checks private interval plus engine abort call. | pending;  |
| src/test/dream-coverage.test.ts:588 | isDesignatedMachine returns false when getDb throws | COUPLED | Pending | Invokes private isDesignatedMachine via cast with mocked app getDb method. | pending;  |
| src/test/dream-coverage.test.ts:597 | getLocalMachineId uses hostname fallback and caches meta | COUPLED | Pending | Invokes private getLocalMachineId and compares it to its own repeat result/meta value. | pending;  |
| src/test/dream-coverage.test.ts:615 | isDreaming reflects running state | COUPLED | Pending | Sets private running=true then reads corresponding public getter; never starts actual work. | pending;  |
| src/test/dream-coverage.test.ts:623 | checkIdle swallows engine rejection and resets running | COUPLED | Pending | Mocks engine.dream failure and inspects private running=false after manually setting idle state. | pending;  |
| src/test/dream-coverage.test.ts:642 | has expected defaults | COUPLED | Pending | Pins exported constant fields without constructing or executing default scheduler behavior. | pending;  |
| src/test/dream-launchctl.test.ts:12 | builds load args with -w so a previously disabled agent is re-enabled | STRONG | Pending | Exported helper returns exact launchctl load -w argument array for concrete plist path. | pending;  |
| src/test/dream-launchctl.test.ts:20 | builds unload args | STRONG | Pending | Exported unload helper returns exact command/path array. | pending;  |
| src/test/dream-launchctl.test.ts:24 | treats 'already loaded' stderr as success | STRONG | Pending | Already-loaded stderr maps to true and an already-loaded user message. | pending;  |
| src/test/dream-launchctl.test.ts:30 | treats 'Load failed: 5' as already-loaded success | STRONG | Pending | Load-failed-5 input maps to literal successful result. | pending;  |
| src/test/dream-launchctl.test.ts:34 | reports other errors as non-fatal failures mentioning next login | STRONG | Pending | Command-not-found maps to false and next-login recovery message. | pending;  |
| src/test/dream-launchctl.test.ts:40 | handles empty stderr | STRONG | Pending | Empty stderr maps to false and launchctl-load-failed message. | pending;  |
| src/test/dream-launchd-health.test.ts:45 | extracts node + cli paths from the exact template shape | STRONG | STRONG | Plist parser returns the exact node and CLI paths from the real template shape. | kept;  |
| src/test/dream-launchd-health.test.ts:51 | unescapes XML entities in paths | STRONG | STRONG | Parser decodes ampersand and quoted path XML entities to literal expected strings. | kept;  |
| src/test/dream-launchd-health.test.ts:58 | returns undefined paths for an empty or truncated body | STRONG | STRONG | Empty and truncated plist input return both paths explicitly undefined. | kept;  |
| src/test/dream-launchd-health.test.ts:71 | returns a coherent all-false shape when unavailable or not installed | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; launchd-always-absent |
| src/test/dream-lock-recovery.test.ts:44 | acquires and releases cleanly | STRONG | Pending | Real lock acquire/release permits reacquiring the same isolated filesystem lock. | pending;  |
| src/test/dream-lock-recovery.test.ts:54 | refuses while a live process holds the lock | STRONG | Pending | Second acquisition fails while the first live-process lock exists and reports this process PID. | pending;  |
| src/test/dream-lock-recovery.test.ts:63 | treats a dead-pid lock as stale and recovers | STRONG | Pending | A planted dead-PID lock is replaced by a successfully acquired live lock. | pending;  |
| src/test/dream-lock-recovery.test.ts:76 | treats a corrupt/unreadable lock as stale instead of blocking forever | STRONG | Pending | A planted truncated JSON lock is recovered instead of blocking acquisition. | pending;  |
| src/test/dream-log-command-handler.test.ts:13 | wires dream log to runDreamLogCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-log-command-handler.test.ts:26 | exports runDreamLogCommand with dream log markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-log-invoke.test.ts:41 | prints 'No dream runs recorded.' when the log is empty | STRONG | Pending | Real log command prints exact no-runs message with no error. | pending;  |
| src/test/dream-log-invoke.test.ts:48 | emits structured JSON with count 0 for --json on an empty log | STRONG | Pending | Real JSON log command emits count zero and literal empty runs array. | pending;  |
| src/test/dream-log-invoke.test.ts:55 | honours parentJson context (JSON even without --json) | STRONG | Pending | Parent JSON context alone yields parseable JSON with literal count zero. | pending;  |
| src/test/dream-report-command-handler.test.ts:13 | wires dream report to runDreamReportCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-report-command-handler.test.ts:24 | exports runDreamReportCommand with dream report markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-resume.test.ts:83 | aborts cleanly at a phase boundary with a consistent DB | STRONG | Pending | Real engine abort callback yields aborted=true, explicit reason, SQLite integrity ok and five retained memories. | pending;  |
| src/test/dream-resume.test.ts:96 | re-run after a completed cycle picks up cleanly (no corruption or dupes) | WEAK | STRONG | Literal observable result now rejects skip all confidence decay on completed cycles. | rewritten; G1-dream-rerun |
| src/test/dream-run-command-handler.test.ts:13 | wires bare dream and dream run to runDreamCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-run-command-handler.test.ts:29 | exports runDreamCommand with dream cycle markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerDream |
| src/test/dream-run-log.test.ts:108 | writes state and append-only run records | STRONG | STRONG | Writes state and two real append-only runs; reads memory ID m1 and skipped run ID two with total count 2. | kept;  |
| src/test/dream-run-log.test.ts:123 | creates stable fingerprints from memory identity and modification | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; fingerprint-ignore-identity |
| src/test/dream-run-log.test.ts:131 | checks night window and changed memory counts | STRONG | STRONG | Literal night-window inputs produce true/false including midnight crossover and exactly one changed memory. | kept;  |
| src/test/dream-run-log.test.ts:138 | estimates tokens and cost, and prevents overlapping locks | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; dream-cost-constant |
| src/test/dream-run-scheduled-flag.test.ts:21 | run action merges parent opts before calling runDreamCommand | COUPLED | STRONG | Literal observable result now rejects lose scheduled parent option. | rewritten; G1-dream-scheduled-cli |
| src/test/dream-run-scheduled-flag.test.ts:28 | commander repro: parent-declared flags land on the parent, merge recovers them | HOLLOW | Deleted | Commander-only local reproduction exercises no app; replaced by public CLI run action merges parent opts before calling runDreamCommand, verified G1-dream-scheduled-cli. Constructs a fresh Commander program entirely in the test and asserts library option behavior; never invokes the Gnosys command registration or handler. | deleted; G1-dream-scheduled-cli |
| src/test/dream-state-isolation.test.ts:81 | the vitest global setup provides a throwaway GNOSYS_HOME to every worker | COUPLED | Deleted | Harness-environment assertion has no application call; engine.dream() writes dream-state.json under GNOSYS_HOME, not the real home tests actual isolation. | deleted;  |
| src/test/dream-state-isolation.test.ts:90 | engine.dream() writes dream-state.json under GNOSYS_HOME, not the real home | STRONG | Pending | Real engine persists dream-state.json under selected home with literal memory count 3. | pending;  |
| src/test/dream-state-isolation.test.ts:100 | an explicit stateDir overrides GNOSYS_HOME (defense in depth) | STRONG | Pending | Explicit stateDir creates the state file there and excludes the ambient home path. | pending;  |
| src/test/dream-state-isolation.test.ts:115 | getDreamStatePath accepts a baseDir override | STRONG | Pending | Exported path resolver returns exact explicit and home-derived state paths. | pending;  |
| src/test/dream-state-isolation.test.ts:122 | reports the coverage gap but never auto-downloads the model when embeddings were never initialized | STRONG | Pending | Engine returns exact missing-embedding report and skipped reason with no model work reported. | pending;  |
| src/test/dream-state-isolation.test.ts:134 | skips cleanly when every memory is already embedded | STRONG | Pending | Three stored vectors yield exact zero-gap report and all-memories-embedded skip reason. | pending;  |
| src/test/embed-db.test.ts:33 | joins title, relevance, tags, content — same recipe as the file-store reindex | STRONG | Pending | embeddingText returns exact title/relevance/tags/content string. | pending;  |
| src/test/embed-db.test.ts:44 | handles object-shaped tags and plain-string tags | STRONG | Pending | Object tags and plain tags produce two literal concatenated texts. | pending;  |
| src/test/embed-db.test.ts:55 | round-trips through the Buffer shape the DB stores | STRONG | Pending | Float32 conversion round-trips four exact numbers through 16 bytes. | pending;  |
| src/test/embed-db.test.ts:78 | fills every NULL embedding in missing mode | STRONG | Pending | Backfill on five real rows reports five and persists five non-null embeddings. | pending;  |
| src/test/embed-db.test.ts:89 | missing mode is incremental — already-embedded rows are untouched | WEAK | STRONG | Literal observable result now rejects overwrite preexisting vectors while correctly counting only missing rows. | rewritten; G1-embedding-incremental |
| src/test/embed-db.test.ts:99 | all mode regenerates every row (reindex semantics) | WEAK | STRONG | Literal observable result now rejects skip writes during all-mode reindex but keep success counters. | rewritten; G1-embedding-reindex |
| src/test/embed-db.test.ts:105 | respects the limit option and reports progress | STRONG | Pending | Limit two produces two progress events, reports two and leaves three null DB embeddings. | pending;  |
| src/test/embed-db.test.ts:117 | stored vectors are readable through the DB-search path | STRONG | Pending | Public DB retrieval returns five stored vectors and concrete marker coordinate 1. | pending;  |
| src/test/embed-db.test.ts:137 | embeds a single memory | WEAK | STRONG | Literal observable result now rejects store zero bytes in place of the generated vector. | rewritten; G1-embedding-single |
| src/test/embed-db.test.ts:144 | returns false for a missing memory id | STRONG | Pending | Missing memory returns literal false. | pending;  |
| src/test/embed-queue.test.ts:52 | is a no-op when disabled (the CLI / test default) | STRONG | STRONG | Disabled public queue leaves seeded memory embedding null after flush. | kept;  |
| src/test/embed-queue.test.ts:63 | embeds queued memories once enabled | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-queue-vector | rewritten; g2-queue-vector |
| src/test/embed-queue.test.ts:80 | never throws when the embedder fails — warns on stderr instead | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-queue-warning | rewritten; g2-queue-warning |
| src/test/embed-queue.test.ts:96 | syncMemoryToDb feeds the queue — a plain DB write gets a vector | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-queue-vector | rewritten; g2-queue-vector |
| src/test/embed-queue.test.ts:111 | disable clears pending work | STRONG | STRONG | Disabling after enqueue leaves real DB embedding null after flush. | kept;  |
| src/test/embeddings-optional-dep.test.ts:21 | throws a one-line install hint when transformers is missing | STRONG | Pending | Missing external package makes actual embed reject with install hint and excludes raw module-loader code. | pending;  |
| src/test/embeddings-optional-dep.test.ts:33 | returns a 384-dim vector when transformers is available | WEAK | STRONG | Literal observable result now rejects replace actual embedding with all-zero vector. | rewritten; G1-embedding-values |
| src/test/export-archive-flag.test.ts:83 | default exportProject reports archivedExcluded and omits archived memories | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-export-bundle-content | rewritten; g2-export-bundle-content |
| src/test/export-archive-flag.test.ts:102 | includeArchived exports all with status preserved and archivedExcluded 0 | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-export-bundle-content | rewritten; g2-export-bundle-content |
| src/test/export-archive-flag.test.ts:123 | vault export activeOnly reports archivedExcluded | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-export-vault-write | rewritten; g2-export-vault-write |
| src/test/export-command-handler.test.ts:13 | wires export parent, vault, and project via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerExport |
| src/test/export-command-handler.test.ts:24 | exports export handlers with cleanup-safe markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerExport |
| src/test/export-import-project.test.ts:82 | exports a project to a .json.gz bundle | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; bundle-drop-body |
| src/test/export-import-project.test.ts:97 | readBundle round-trips the manifest, project, and memories | STRONG | STRONG | Real exported/read bundle preserves format/version, project ID/name, three memories and their title prefix. | kept;  |
| src/test/export-import-project.test.ts:111 | import strategy=merge skips existing memories | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; merge-delete-existing |
| src/test/export-import-project.test.ts:127 | import strategy=new-id remaps the project ID and memory IDs | STRONG | STRONG | New-ID import yields a separate project and three persisted memories while retaining the original three. | kept;  |
| src/test/export-import-project.test.ts:148 | import strategy=replace deletes existing project memories | STRONG | STRONG | Replace import removes the extra seeded row and leaves exactly two bundle memories. | kept;  |
| src/test/export-import-project.test.ts:196 | readBundle rejects malformed bundles | STRONG | STRONG | Actual gzip JSON with wrong shape rejects with Not a Gnosys project bundle. | kept;  |
| src/test/export-import-project.test.ts:206 | export with includeArchived=false skips archived memories | STRONG | STRONG | Real archive/status filtering yields two exported records versus four when archived inclusion is enabled. | kept;  |
| src/test/export-path-traversal.test.ts:65 | slugifies traversal category and writes inside export dir | STRONG | STRONG | Export of a traversal category writes escape/escape-attempt.md inside vault and creates no sibling escape path. | kept;  |
| src/test/export-path-traversal.test.ts:94 | assertWithin allows paths inside target and blocks outside | COUPLED | Deleted | Deleted private-method duplicate; named public export test exercises malicious category and inside-root file creation. | deleted;  |
| src/test/federated-client-read.test.ts:16 | `${file} resolves client read for federated queries` | COUPLED | STRONG | Five CLI handlers read the accepted offline snapshot ID/title; ask sends snapshot body to the configured Ollama HTTP boundary. Local decoy makes wrong-database routing observable. | rewritten; federated-cli-local-instead-snapshot |
| src/test/federated-client-read.test.ts:26 | gnosys_federated_search MCP tool uses resolveToolContext and cleanup | COUPLED | STRONG | Real stdio MCP federated search returns snapshot title/body and excludes the local decoy while master is absent. | rewritten; federated-mcp-local-instead-snapshot |
| src/test/federated.test.ts:71 | returns results scored with scope boosting | STRONG | STRONG | Real federated search returns both IDs, higher current-project score and current-project boost marker. | kept;  |
| src/test/federated.test.ts:100 | boosts recently modified memories | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-recency | rewritten; g2-federated-recency |
| src/test/federated.test.ts:127 | respects includeGlobal=false | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-global | rewritten; g2-federated-global |
| src/test/federated.test.ts:146 | returns empty array for no matches | STRONG | STRONG | Unmatched query over empty real DB yields literal empty array. | kept;  |
| src/test/federated.test.ts:151 | boosts reinforced memories | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-reinforcement | rewritten; g2-federated-reinforcement |
| src/test/federated.test.ts:179 | returns null when query matches only one project | STRONG | STRONG | Single-project query yields literal null ambiguity result. | kept;  |
| src/test/federated.test.ts:196 | returns ambiguity error when query matches multiple projects | STRONG | STRONG | Two-project query yields ambiguous_project with exact Alpha/Beta candidates. | kept;  |
| src/test/federated.test.ts:230 | generates a briefing for a project with memories | STRONG | STRONG | Briefing exposes literal project name/counts/category keys and architecture tag count two. | kept;  |
| src/test/federated.test.ts:269 | returns null for non-existent project | STRONG | STRONG | Unknown project produces literal null briefing. | kept;  |
| src/test/federated.test.ts:276 | generates briefings for all registered projects | STRONG | STRONG | All-project briefing output has exactly Alpha and Beta names. | kept;  |
| src/test/federated.test.ts:296 | returns recently modified memories for a project | STRONG | STRONG | 24-hour working set returns only literal recent-mem and excludes 48-hour record. | kept;  |
| src/test/federated.test.ts:320 | returns empty set for no recent activity | STRONG | STRONG | Only 48-hour memory yields empty 24-hour working set. | kept;  |
| src/test/federated.test.ts:335 | formats empty working set | STRONG | STRONG | Empty working-set formatter produces literal No recent activity text. | kept;  |
| src/test/federated.test.ts:340 | formats non-empty working set | STRONG | STRONG | Nonempty formatting includes literal ID, title and decisions category. | kept;  |
| src/test/file-permissions.test.ts:30 | writeApiKey creates .env with mode 0600 | STRONG | Pending | Reads actual created key-file POSIX mode and asserts literal 0600; Windows is intentionally conditional. | pending;  |
| src/test/file-permissions.test.ts:37 | GnosysDB creates gnosys.db with mode 0600 and store dir 0700 | STRONG | Pending | Opens real DB and asserts DB mode 0600 and parent mode 0700; Windows is intentionally conditional. | pending;  |
| src/test/freeform-add-gate.test.ts:26 | index.ts gates the gnosys_add handler behind GNOSYS_ALLOW_FREEFORM_ADD | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-freeform-gate | rewritten; g2-freeform-gate |
| src/test/freeform-add-gate.test.ts:36 | redirect message lists the structured fields agents must supply | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-freeform-guidance | rewritten; g2-freeform-guidance |
| src/test/freeform-add-gate.test.ts:48 | generated agent rules state the server rejects freeform gnosys_add | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-freeform-rules | rewritten; g2-freeform-rules |
| src/test/fsearch-command-handler.test.ts:13 | wires fsearch to runFsearchCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/fsearch-command-handler.test.ts:24 | exports runFsearchCommand with federated and output markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/fsearch-invoke.test.ts:82 | finds a seeded user-scope memory via federated FTS (--json) | STRONG | Pending | Real federated command JSON contains seeded literal deci-100 ID. | pending;  |
| src/test/fsearch-invoke.test.ts:93 | prints a no-results message for an unmatched query (human) | STRONG | Pending | Unmatched real query prints exact query-specific no-results message. | pending;  |
| src/test/fts-or-fallback.test.ts:63 | still matches when ALL terms are present (AND precision preserved) | STRONG | Pending | Concrete all-term discovery includes literal authentication memory ID. | pending;  |
| src/test/fts-or-fallback.test.ts:68 | returns results for long multi-word queries where only some terms match (the v5.12.3 bug) | STRONG | Pending | Query with unmatched extra terms still returns the seeded authentication ID. | pending;  |
| src/test/fts-or-fallback.test.ts:75 | OR fallback ranks the best-covered memory first (BM25) | STRONG | Pending | Mixed OR fallback includes both IDs and ranks authentication first. | pending;  |
| src/test/fts-or-fallback.test.ts:84 | single-term queries behave as before | STRONG | Pending | Single database token returns exact seeded database ID. | pending;  |
| src/test/fts-or-fallback.test.ts:89 | punctuation-only and empty queries return empty, not throw | STRONG | Pending | Punctuation, empty and wildcard discovery each return literal empty arrays. | pending;  |
| src/test/fts-or-fallback.test.ts:95 | FTS5-hostile characters no longer cause syntax errors | STRONG | Pending | Hostile token query is tolerated and hyphenated auth query returns exact auth ID. | pending;  |
| src/test/fts-or-fallback.test.ts:103 | queries with zero matching terms still return empty | STRONG | Pending | No-match terms return exact empty discovery output. | pending;  |
| src/test/fts-or-fallback.test.ts:109 | still matches when ALL terms are present (AND precision preserved) | STRONG | Pending | All-term central search includes exact deployment ID. | pending;  |
| src/test/fts-or-fallback.test.ts:114 | returns results for multi-word queries where only some terms match | STRONG | Pending | Partial-match central search includes exact deployment ID. | pending;  |
| src/test/fts-or-fallback.test.ts:120 | single-term queries behave as before | STRONG | Pending | Single postgres token returns exact database ID. | pending;  |
| src/test/fts-or-fallback.test.ts:125 | punctuation-only queries return empty | STRONG | Pending | Punctuation central search returns empty array. | pending;  |
| src/test/fts-or-fallback.test.ts:155 | search: multi-word query with partial term match returns results (the v5.12.3 bug) | STRONG | Pending | Per-store partial search returns literal authentication title first. | pending;  |
| src/test/fts-or-fallback.test.ts:161 | search: AND precision preserved when all terms match | STRONG | Pending | Per-store all-term search includes literal database title. | pending;  |
| src/test/fts-or-fallback.test.ts:166 | discover: long multi-word query returns ranked results (the v5.12.3 bug) | STRONG | Pending | Per-store partial discover returns literal deployment title first. | pending;  |
| src/test/fts-or-fallback.test.ts:172 | discover: AND precision preserved when all terms match | STRONG | Pending | Per-store all-term discovery includes literal authentication title. | pending;  |
| src/test/fts-or-fallback.test.ts:177 | discover: punctuation-only query returns empty, not throw | STRONG | Pending | Per-store punctuation discovery returns empty array. | pending;  |
| src/test/fts-or-fallback.test.ts:204 | multi-word query with partial term match returns archived results (the v5.12.3 bug) | STRONG | Pending | Archived partial query returns exact authentication memory ID. | pending;  |
| src/test/fts-or-fallback.test.ts:210 | AND precision preserved when all terms match | STRONG | Pending | Archived all-term query returns exact deployment ID. | pending;  |
| src/test/fts-or-fallback.test.ts:215 | punctuation-only query returns empty | STRONG | Pending | Archived punctuation query returns empty array. | pending;  |
| src/test/ftsQuery.test.ts:13 | splits on whitespace and trims | STRONG | Pending | Whitespace tokenization returns literal auth/jwt/middleware and trimmed leading/trailing arrays. | pending;  |
| src/test/ftsQuery.test.ts:18 | strips quote characters | STRONG | Pending | Quote stripping returns literal auth/jwt and dont tokens. | pending;  |
| src/test/ftsQuery.test.ts:23 | drops tokens with no letters or digits | STRONG | Pending | Punctuation-only tokens disappear while auth and jwt remain. | pending;  |
| src/test/ftsQuery.test.ts:29 | returns empty array for empty or whitespace-only input | STRONG | Pending | Empty and whitespace strings produce literal empty token arrays. | pending;  |
| src/test/ftsQuery.test.ts:34 | keeps unicode letters and digits | STRONG | Pending | Unicode café/münchen and numeric v2 tokens are preserved exactly. | pending;  |
| src/test/ftsQuery.test.ts:40 | quotes each term and joins with spaces (implicit AND) | STRONG | Pending | AND builder returns the exact independently written quoted two-term expression. | pending;  |
| src/test/ftsQuery.test.ts:44 | quotes terms containing FTS5-hostile characters | STRONG | Pending | Hostile hyphens/colon/NOT terms become exact quoted expressions. | pending;  |
| src/test/ftsQuery.test.ts:49 | preserves trailing * as an FTS5 prefix query | STRONG | Pending | One or repeated trailing stars become the exact single-star prefix query. | pending;  |
| src/test/ftsQuery.test.ts:56 | quotes each term and joins with OR | STRONG | Pending | OR builder returns exact quoted auth OR jwt OR session syntax. | pending;  |
| src/test/ftsQuery.test.ts:60 | single term is just the quoted phrase | STRONG | Pending | A single OR term becomes precisely the quoted auth phrase. | pending;  |
| src/test/ftsQuery.test.ts:64 | preserves prefix queries inside OR expressions | STRONG | Pending | OR prefix query preserves the auth star in the exact expected expression. | pending;  |
| src/test/graph-command-handler.test.ts:13 | wires graph to runGraphCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/graph-command-handler.test.ts:22 | exports runGraphCommand with graph markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/graph-invoke.test.ts:79 | prints 'No memories found.' on an empty central DB | STRONG | STRONG | Empty real central DB command prints literal No memories found. | kept;  |
| src/test/graph-invoke.test.ts:85 | reports wikilinks between seeded memories (--json) | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-graph-nodes | rewritten; g2-graph-nodes |
| src/test/heartbeat.test.ts:11 | returns the wrapped result and cleans up on success | WEAK | STRONG | Literal progress frames and terminal-clear sequence remains unchanged two seconds after success/rejection; omitted cleanup mutation killed. | rewritten; heartbeat-cleanup |
| src/test/heartbeat.test.ts:30 | cleans up and rethrows when the wrapped function fails | WEAK | STRONG | Literal progress frames and terminal-clear sequence remains unchanged two seconds after success/rejection; omitted cleanup mutation killed. | rewritten; heartbeat-cleanup |
| src/test/helper-command-handler.test.ts:7 | declares helper as a parent container with generate subcommand handler | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/helper-command-handler.test.ts:21 | has no parent action between helper declaration and generate subcommand | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/helper-generate-command-handler.test.ts:13 | wires helper generate to runHelperGenerateCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/helper-generate-command-handler.test.ts:24 | exports runHelperGenerateCommand with helper generate markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/history-audit-view.test.ts:78 | returns audit entries for a known memory | STRONG | Pending | Real audit query returns two literal write/reinforce operations. | pending;  |
| src/test/history-audit-view.test.ts:84 | CLI history prints audit entries for a DB memory | STRONG | Pending | Real CLI exits zero and renders seeded memory title and both operations. | pending;  |
| src/test/history-audit-view.test.ts:103 | CLI history errors for a missing memory | STRONG | Pending | Missing-memory CLI exits one and prints not-found error. | pending;  |
| src/test/history-command-handler.test.ts:13 | wires history to runHistoryCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/history-command-handler.test.ts:23 | exports runHistoryCommand with history markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/history-invoke.test.ts:78 | prints memory header and 'No audit history recorded.' for a fresh memory | STRONG | Pending | Actual history command prints seeded title and literal empty-history message. | pending;  |
| src/test/history-invoke.test.ts:86 | emits structured JSON with memoryId and empty entries (--json) | STRONG | Pending | History JSON exposes exact memoryId deci-301 and empty entries. | pending;  |
| src/test/history-invoke.test.ts:93 | exits with an error for a missing memory id | STRONG | Pending | Unknown ID exits one and prints exact Memory not found: deci-999 error. | pending;  |
| src/test/hybrid-degrade-warning.test.ts:24 | gnosys_hybrid_search warns when the semantic leg can't run | COUPLED | Pending | Searches MCP source strings for warning and interpolation instead of calling tool. | pending;  |
| src/test/hybrid-degrade-warning.test.ts:38 | gnosys_semantic_search refuses loudly instead of returning generic empty | COUPLED | Pending | Searches MCP source for a semantic-unavailable sentence without exercising its branch. | pending;  |
| src/test/hybrid-degrade-warning.test.ts:44 | CLI hybrid-search warns on stderr (stdout stays clean for --json) | COUPLED | Pending | Searches handler source for console.error and warning text, not actual stdout/stderr. | pending;  |
| src/test/hybrid-degrade-warning.test.ts:57 | canRunSemantic mirrors the DB-mode embedQuery gate (central-DB vectors) | COUPLED | Pending | Pins private predicate spelling in source instead of testing semantic fallback behavior. | pending;  |
| src/test/hybrid-search-command-handler.test.ts:13 | wires hybrid-search to runHybridSearchCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/hybrid-search-command-handler.test.ts:27 | exports runHybridSearchCommand with federated and local hybrid markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/ide-init-golden.test.ts:46 | `${ide} rules block matches golden (${TARGET_PATHS[ide]})` | MISLABELED | STRONG | Literal observable result now rejects write generated ide rules to wrong target. | rewritten; G1-rules-target |
| src/test/ide-init-golden.test.ts:59 | generateRulesBlock is deterministic with empty preferences | HOLLOW | STRONG | Literal observable result now rejects return incorrect but deterministic instructions. | rewritten; G1-rules-deterministic |
| src/test/ide-init-golden.test.ts:84 | cursor setupIDE writes mcpServers.gnosys with command and args | STRONG | Pending | Actual Cursor file contains gnosys-mcp executable and exact empty args with success=true. | pending;  |
| src/test/ide-init-golden.test.ts:97 | gemini-cli setupIDE writes mcpServers.gnosys under isolated HOME | WEAK | STRONG | Literal observable result now rejects inject invalid mcp executable arguments. | rewritten; G1-ide-args-gemini |
| src/test/ide-init-golden.test.ts:113 | antigravity setupIDE writes mcpServers.gnosys under isolated HOME | WEAK | STRONG | Literal observable result now rejects inject invalid mcp executable arguments. | rewritten; G1-ide-args-antigravity |
| src/test/ide-mcp-install.test.ts:29 | normalizeIdeKey accepts grok alias | STRONG | STRONG | IDE alias normalization returns grok-build, cursor and null for explicit inputs. | kept;  |
| src/test/ide-mcp-install.test.ts:35 | detects stale gnosys serve entries | STRONG | STRONG | Legacy gnosys serve entry is stale while gnosys-mcp with empty args is not. | kept;  |
| src/test/ide-mcp-install.test.ts:40 | gnosysStdioMcpEntry uses gnosys-mcp command | STRONG | STRONG | Public entry generator selects a gnosys-mcp executable and exact empty arguments. | kept;  |
| src/test/ide-mcp-install.test.ts:66 | cursor writes project and user mcp.json | STRONG | STRONG | Real Cursor install creates project and home JSON entries with gnosys-mcp and empty args. | kept;  |
| src/test/ide-mcp-install.test.ts:76 | grok writes mcp_servers.gnosys in ~/.grok/config.toml | STRONG | STRONG | Real Grok install writes mcp_servers.gnosys, gnosys-mcp and timeout 90, excluding legacy header. | kept;  |
| src/test/ide-mcp-install.test.ts:86 | gemini-cli and antigravity write mcpServers.gnosys | STRONG | STRONG | Real Gemini and Antigravity config files contain executable gnosys-mcp entries with empty args. | kept;  |
| src/test/ide-mcp-install.test.ts:102 | claude-desktop writes mcpServers.gnosys | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; claude-skip-install |
| src/test/ide-mcp-install.test.ts:115 | removes [gnosys] regardless of field order | STRONG | STRONG | TOML cleanup removes both legacy headers while retaining the unrelated other section. | kept;  |
| src/test/ide-mcp-install.test.ts:151 | still writes Claude Desktop when claude CLI is unavailable | STRONG | STRONG | With unavailable claude binary, real fallback config still contains a gnosys-mcp entry and reports Desktop update. | kept;  |
| src/test/ide-mcp-install.test.ts:171 | uses mcp_servers header per Grok Build spec | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; grok-empty-block |
| src/test/import-command-handler.test.ts:13 | wires parent import to runImportCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/import-command-handler.test.ts:25 | exports runImportCommand with validation and import markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/import-concurrency-wiring.test.ts:20 | importCommand.ts defaults concurrency from config.importConcurrency (CLI flag wins) | COUPLED | Pending | Asserts CLI handler source spelling of concurrency fallback rather than runtime precedence. | pending;  |
| src/test/import-concurrency-wiring.test.ts:26 | index.ts gnosys_import handler defaults from ctx.config.importConcurrency (explicit param wins) | COUPLED | Pending | Asserts MCP handler source substring rather than observed import concurrency. | pending;  |
| src/test/import-concurrency-wiring.test.ts:31 | the --concurrency CLI flag still exists so it can win over config | COUPLED | Pending | Checks --concurrency source string anywhere in concatenated CLI code. | pending;  |
| src/test/import-project-command-handler.test.ts:13 | wires import project to runImportProjectCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/import-project-command-handler.test.ts:23 | exports runImportProjectCommand with cleanup-safe import markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/import-url-ssrf.test.ts:25 | `refuses ${url}` | STRONG | Pending | Public import loader rejects each concrete loopback/private URL with unsafe URL error. | pending;  |
| src/test/import-url-ssrf.test.ts:30 | rejects redirects to loopback | STRONG | Pending | Public import loader rejects a mocked HTTP 302 redirect to loopback with unsafe URL error. | pending;  |
| src/test/import.test.ts:38 | imports a JSON array of records | STRONG | Pending | Real JSON import returns exact Apple/Carrot titles and slugified fruits category. | pending;  |
| src/test/import.test.ts:62 | handles nested JSON with common array keys | STRONG | Pending | Nested foods array import returns exact Cheese/Milk titles. | pending;  |
| src/test/import.test.ts:85 | rejects JSON without recognizable array | STRONG | Pending | Non-array JSON rejects with recognizable-array diagnostic. | pending;  |
| src/test/import.test.ts:103 | imports a CSV file | STRONG | Pending | CSV import returns exact three titles and vegetables category. | pending;  |
| src/test/import.test.ts:129 | imports JSONL (one JSON object per line) | WEAK | STRONG | Literal observable result now rejects lose jsonl record titles while keeping record count. | rewritten; G1-import-jsonl |
| src/test/import.test.ts:151 | rejects mapping without title | STRONG | Pending | Mapping without title rejects with title diagnostic. | pending;  |
| src/test/import.test.ts:166 | includes unmapped fields as extra context | MISLABELED | STRONG | Literal observable result now rejects drop unmapped fields from stored import content. | rewritten; G1-import-extra |
| src/test/import.test.ts:186 | slugifies category names | STRONG | Pending | Category mapping returns exact dairy-and-egg-products slug. | pending;  |
| src/test/import.test.ts:205 | skips records that already exist when skipExisting is true | STRONG | Pending | Seeded duplicate Apple is skipped and Banana is the sole imported title. | pending;  |
| src/test/import.test.ts:248 | respects limit | STRONG | Pending | Ten records with limit three produce exact imported and processed counts of three. | pending;  |
| src/test/import.test.ts:268 | respects offset | STRONG | Pending | Offset three returns exactly Food 3 and Food 4. | pending;  |
| src/test/import.test.ts:293 | reports what would be imported without writing | WEAK | STRONG | Literal observable result now rejects write records despite dry-run request. | rewritten; G1-import-dryrun |
| src/test/import.test.ts:320 | writes multiple records without per-record commits when batching | MISLABELED | STRONG | Literal observable result now rejects report imported batch without any memory writes. | rewritten; G1-import-batch |
| src/test/import.test.ts:347 | continues processing when individual records fail | WEAK | STRONG | Literal observable result now rejects fail every record while preserving total processed count. | rewritten; G1-import-failure |
| src/test/import.test.ts:372 | produces readable summary | STRONG | Pending | Summary renders literal imported/skipped/failed counts, 2.5s duration and error text. | pending;  |
| src/test/import.test.ts:393 | estimates structured mode as fast | WEAK | STRONG | Literal observable result now rejects ignore structured record count. | rewritten; G1-duration-structured |
| src/test/import.test.ts:397 | estimates LLM mode as slower | WEAK | STRONG | Literal observable result now rejects return wrong llm duration in valid minute-shaped format. | rewritten; G1-duration-llm |
| src/test/ingest-command-handler.test.ts:13 | wires ingest to runIngestCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/ingest-command-handler.test.ts:25 | exports runIngestCommand with list-attachments and file branches | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/ingest-fixtures.test.ts:46 | normal PDF ingests without crashing | HOLLOW | STRONG | Literal observable result now rejects reject every file before parsing or returning the required outcome. | rewritten; G1-pdf-normal |
| src/test/ingest-fixtures.test.ts:54 | 0-byte text file is handled gracefully | HOLLOW | STRONG | Literal observable result now rejects reject every file before parsing or returning the required outcome. | rewritten; G1-text-empty |
| src/test/ingest-fixtures.test.ts:64 | UTF-8 BOM text file is handled gracefully | WEAK | STRONG | Literal observable result now rejects replace decoded bom text with unrelated content. | rewritten; G1-text-bom |
| src/test/ingest-fixtures.test.ts:74 | oversized text file hits size cap (no OOM) | STRONG | STRONG | Literal observable result now rejects replace actionable size-limit error with unrelated error. | rewritten; G1-file-size-error |
| src/test/ingest-fixtures.test.ts:88 | corrupt DOCX returns a clear error | HOLLOW | STRONG | Literal observable result now rejects reject every file before parsing or returning the required outcome. | rewritten; G1-docx-error |
| src/test/ingest-fixtures.test.ts:98 | non-existent path throws a clear error | STRONG | STRONG | Literal observable result now rejects replace missing-file error with unrelated failure. | rewritten; G1-missing-file-error |
| src/test/ingest-fixtures.test.ts:104 | PDF with embedded JS is handled without executing JS | HOLLOW | STRONG | Literal observable result now rejects reject every file before parsing or returning the required outcome. | rewritten; G1-pdf-js, G1-pdf-js-execution |
| src/test/ingest-fixtures.test.ts:110 | encrypted PDF returns a clear error (TODO: add minimal encrypted sample) | DEAD | STRONG | Literal observable result now rejects swallow password rejection and report empty pdf success. | rewritten; G1-pdf-password |
| src/test/ingest-special-paths.test.ts:35 | `ingests ${JSON.stringify(name)}` | WEAK | STRONG | Literal observable result now rejects lose extracted text title for special-character file paths. | rewritten; G1-special-paths |
| src/test/ingest-structured.test.ts:73 | reports unavailable when getLLMProvider throws at construction | STRONG | Pending | Provider-construction failure yields public unavailable=false and name=none outputs. | pending;  |
| src/test/ingest-structured.test.ts:82 | reports available when a provider is resolved | STRONG | Pending | Resolved external provider yields available=true and public name anthropic. | pending;  |
| src/test/ingest-structured.test.ts:108 | anthropic — mentions ANTHROPIC_API_KEY | STRONG | Pending | Missing Anthropic provider rejects with literal ANTHROPIC_API_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:112 | openai — mentions OPENAI_API_KEY | STRONG | Pending | Missing OpenAI provider rejects with literal OPENAI_API_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:116 | groq — mentions GROQ_API_KEY | STRONG | Pending | Missing Groq provider rejects with literal GROQ_API_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:120 | xai — mentions XAI_API_KEY | STRONG | Pending | Missing xAI provider rejects with literal XAI_API_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:124 | mistral — mentions MISTRAL_API_KEY | STRONG | Pending | Missing Mistral provider rejects with literal MISTRAL_API_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:128 | custom — mentions GNOSYS_CUSTOM_KEY | STRONG | Pending | Missing custom provider rejects with literal GNOSYS_CUSTOM_KEY recovery hint. | pending;  |
| src/test/ingest-structured.test.ts:132 | ollama — mentions running locally | STRONG | Pending | Missing Ollama provider rejects with running-locally recovery instruction. | pending;  |
| src/test/ingest-structured.test.ts:136 | lmstudio — mentions running locally | STRONG | Pending | Missing LM Studio provider rejects with running-locally recovery instruction. | pending;  |
| src/test/ingest-structured.test.ts:140 | unknown provider — suggests switching default provider | STRONG | Pending | Unknown provider rejects with switch-default-provider recovery instruction. | pending;  |
| src/test/ingest-structured.test.ts:146 | parses bare JSON from the LLM response | STRONG | Pending | Bare external JSON is parsed into literal title and validated auth tag. | pending;  |
| src/test/ingest-structured.test.ts:164 | parses markdown-fenced JSON | STRONG | Pending | JSON markdown fence is removed and literal Fenced JSON title returned. | pending;  |
| src/test/ingest-structured.test.ts:180 | parses plain-fenced JSON without json language tag | STRONG | Pending | Plain markdown fence is removed and literal Plain Fence title returned. | pending;  |
| src/test/ingest-structured.test.ts:196 | parses JSON embedded in prose | STRONG | Pending | Prose-wrapped fenced JSON returns literal Mixed Prose title. | pending;  |
| src/test/ingest-structured.test.ts:214 | strips __proto__, constructor, and prototype keys from LLM JSON | MISLABELED | Pending | __proto__ object literal is not serialized as an own property; fixed output-field projection also excludes constructor/prototype without proving sanitizer works. | pending;  |
| src/test/ingest-structured.test.ts:236 | keeps registry tags and proposes unknown tags | STRONG | Pending | Known tags retained and unknown tags produce two explicit category/tag proposals. | pending;  |
| src/test/ingest-structured.test.ts:260 | includes explicit proposed_new_tags from the LLM response | STRONG | Pending | Explicit proposed_new_tags parses into literal latency proposal. | pending;  |
| src/test/ingest-structured.test.ts:277 | applies defaults when the LLM returns minimal JSON | STRONG | Pending | Minimal response yields six literal defaults including raw fallback content and confidence 0.7. | pending;  |
| src/test/ingest-structured.test.ts:291 | resolves a fresh provider from configOverride | COUPLED | Pending | Both fake providers share same generate mock; only internal factory call distinguishes override from default. | pending;  |
| src/test/ingest-structured.test.ts:319 | throws provider-missing when configOverride has no available provider | STRONG | Pending | Unavailable override provider rejects with GROQ_API_KEY rather than using available default. | pending;  |
| src/test/ingest.test.ts:46 | reports false when no API key is set | MISLABELED | STRONG | Explicit config selects absent and local Ollama providers, yielding false/none and true/ollama without network calls. | rewritten; ingestion-available-always |
| src/test/ingest.test.ts:55 | creates a structured IngestResult with all fields | STRONG | STRONG | Structured ingestion returns literal title/category/auth tags/relevance/content/confidence and auth-decision filename. | kept;  |
| src/test/ingest.test.ts:76 | generates kebab-case filename from title | STRONG | STRONG | Mixed-case spaced title becomes the literal kebab-case filename my-complex-title-with-caps. | kept;  |
| src/test/ingest.test.ts:87 | truncates filename to 60 characters | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; ingestion-empty-long-slug |
| src/test/ingest.test.ts:99 | provides defaults for optional fields | STRONG | STRONG | Minimal structured input yields exact relevance empty string and confidence 0.8 defaults. | kept;  |
| src/test/ingest.test.ts:113 | creates a valid memory file from structured input | STRONG | STRONG | Real structured result is written and reread with literal title, relevance, reviewed date and content. | kept;  |
| src/test/init-command-handler.test.ts:7 | wires init options, project registration, and IDE hooks | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerProject |
| src/test/init.test.ts:28 | creates .gnosys store directory | STRONG | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:36 | creates .gnosys/.config internal config directory | STRONG | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:44 | does NOT create a nested .gnosys/.gnosys | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:51 | places tags.json inside .gnosys/.config (internal config) | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; init-null-tags |
| src/test/init.test.ts:63 | does NOT place tags.json at .gnosys root | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:70 | does NOT create CHANGELOG.md (removed in DB-only refactor) | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:77 | does NOT initialize a git repository (removed in DB-only refactor) | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:84 | re-syncs if .gnosys already exists (no error) | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-resync-noop |
| src/test/init.test.ts:93 | outputs helpful instructions | STRONG | STRONG | Real CLI init emits Gnosys store and the concrete gnosys add next-step instruction. | kept;  |
| src/test/init.test.ts:100 | creates gnosys.json project identity file | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| src/test/init.test.ts:112 | generates stable projectId on re-init | WEAK | STRONG | Consolidated initialization assertions read exact directory entries, tag values, valid identity and matching central project record; re-sync repairs a stale directory while retaining identity. | rewritten; cli-identity-invalid, init-invalid-identity, init-resync-noop |
| src/test/install-output.test.ts:16 | suppresses the prebuild-install and boolean deprecation lines | STRONG | Pending | Literal prebuild-install and boolean deprecation messages are suppressed. | pending;  |
| src/test/install-output.test.ts:21 | does NOT suppress other deprecation warnings | STRONG | Pending | Other package deprecation warning is retained. | pending;  |
| src/test/install-output.test.ts:27 | does NOT suppress a lookalike package name (requires the @ boundary) | STRONG | Pending | Lookalike boolean-x package warning is retained. | pending;  |
| src/test/install-output.test.ts:34 | leaves normal npm output and errors untouched | STRONG | Pending | Normal output, E404 error and empty line are retained. | pending;  |
| src/test/install-output.test.ts:47 | drops suppressed lines and keeps the rest, in order | STRONG | Pending | Mixed feed emits exactly the remaining normal line in order. | pending;  |
| src/test/install-output.test.ts:57 | handles a suppressed line split across two chunks | STRONG | Pending | Split suppressed line across chunks still emits only literal kept line. | pending;  |
| src/test/install-output.test.ts:67 | flushes a trailing partial line that has no newline | STRONG | Pending | Trailing unterminated npm notice is emitted intact by end(). | pending;  |
| src/test/install-output.test.ts:75 | suppresses a trailing partial line if it matches | STRONG | Pending | Trailing suppressed partial line emits exact empty string. | pending;  |
| src/test/interactive-guard.test.ts:16 | message names the flow and explains the TTY requirement | STRONG | Pending | Public message includes concrete setup-dream flow and not-a-TTY diagnostic. | pending;  |
| src/test/interactive-guard.test.ts:22 | stdinIsInteractive reflects process.stdin.isTTY | STRONG | Pending | Public stdin predicate matches observed process boundary state. | pending;  |
| src/test/interactive-guard.test.ts:26 | exits 1 with a single friendly stderr line when stdin is not a TTY | STRONG | Pending | Non-TTY guard emits one flow-specific stderr event and exits with literal code 1. | pending;  |
| src/test/interactive-guard.test.ts:44 | is a no-op when stdin is a TTY | STRONG | Pending | TTY guard returns without invoking mocked process exit, whose invocation would throw. | pending;  |
| src/test/lens-command-handler.test.ts:13 | wires lens to runLensCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/lens-command-handler.test.ts:26 | exports runLensCommand with lens markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/lensing.test.ts:39 | filters by category | STRONG | Pending | Category filtering returns exact d1/d2 IDs. | pending;  |
| src/test/lensing.test.ts:45 | filters by status | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-status |
| src/test/lensing.test.ts:50 | filters by multiple statuses | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-statuses |
| src/test/lensing.test.ts:55 | filters by tag (any mode) | STRONG | Pending | Any-tag mode returns exactly d1/d2. | pending;  |
| src/test/lensing.test.ts:61 | filters by tag (all mode) | STRONG | Pending | All-tag mode returns sole matching literal d1. | pending;  |
| src/test/lensing.test.ts:67 | filters by confidence range | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-confidence |
| src/test/lensing.test.ts:72 | filters by author | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-author-corrected |
| src/test/lensing.test.ts:77 | filters by authority | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-authority-corrected |
| src/test/lensing.test.ts:82 | filters by created date range | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-created |
| src/test/lensing.test.ts:87 | filters by modified date range | WEAK | STRONG | Literal observable result now rejects return unrelated input records with the same number of matches. | rewritten; G1-lens-modified |
| src/test/lensing.test.ts:92 | empty filter returns all memories | STRONG | Pending | Empty filter preserves all five input rows by exact cardinality. | pending;  |
| src/test/lensing.test.ts:97 | combines multiple criteria in one filter | WEAK | STRONG | Literal observable result now rejects ignore confidence condition in compound filter. | rewritten; G1-lens-combined |
| src/test/lensing.test.ts:106 | combines criteria with OR operator | STRONG | Pending | AND yields zero and OR includes all four concrete expected IDs. | pending;  |
| src/test/lifecycle-e2e.test.ts:41 | add → read → update → archive → dearchive → reinforce×3 → maintain stays consistent | STRONG | Pending | Real lifecycle asserts exact original/updated body, active/archive state, reinforcement count 3, single retained ID and SQLite integrity. | pending;  |
| src/test/lifecycle-invariants.test.ts:57 | holds after every lifecycle op | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-lifecycle-update-content | rewritten; g2-lifecycle-update-content |
| src/test/links-command-handler.test.ts:13 | wires links to runLinksCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/links-command-handler.test.ts:22 | exports runLinksCommand with links markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/links-invoke.test.ts:84 | shows outgoing wikilinks for the source memory (human) | STRONG | STRONG | Real seeded source memory produces literal Source memory title and target wikilink in human output. | kept;  |
| src/test/links-invoke.test.ts:92 | emits structured JSON with outgoing/backlinks arrays (--json) | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; links-wrong-target |
| src/test/links-invoke.test.ts:100 | exits with an error for a missing memory path | STRONG | STRONG | Missing memory invocation exits 1 and emits Memory not found. | kept;  |
| src/test/list-command-handler.test.ts:13 | wires list to runListCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/list-command-handler.test.ts:26 | exports runListCommand with list markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/list-invoke.test.ts:78 | lists the seeded user-scope memory (--json) | STRONG | STRONG | Real list command JSON includes literal seeded deci-501 ID. | kept;  |
| src/test/list-invoke.test.ts:85 | filters by tag (--tag, --json) | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-list-tag | rewritten; g2-list-tag |
| src/test/list-invoke.test.ts:92 | returns an empty set for a category with no matches (--json) | STRONG | STRONG | Unmatched category returns count zero and literal empty memories array. | kept;  |
| src/test/list-invoke.test.ts:99 | renders human output with scope/status markers | STRONG | STRONG | Human output contains literal [user] [active] scope/status and fixture title. | kept;  |
| src/test/llm-providers.test.ts:23 | ALL_PROVIDERS includes all 9 providers | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-provider-schema | rewritten; g2-provider-schema |
| src/test/llm-providers.test.ts:38 | parses old configs without xai/mistral/custom sections (backward compat) | STRONG | STRONG | Legacy schema input retains anthropic and supplies literal xAI/Mistral defaults with no custom config. | kept;  |
| src/test/llm-providers.test.ts:55 | accepts xai as defaultProvider | STRONG | STRONG | Public schema preserves literal xai default selection. | kept;  |
| src/test/llm-providers.test.ts:61 | accepts mistral as defaultProvider | STRONG | STRONG | Public schema preserves literal mistral default selection. | kept;  |
| src/test/llm-providers.test.ts:67 | accepts custom as defaultProvider with full config | STRONG | STRONG | Public schema preserves custom provider, literal model and base URL. | kept;  |
| src/test/llm-providers.test.ts:84 | rejects invalid provider names | STRONG | STRONG | Public config boundary rejects invalid-provider input. | kept;  |
| src/test/llm-providers.test.ts:91 | returns xai model from config | STRONG | STRONG | Provider-model getter returns literal grok-3 override. | kept;  |
| src/test/llm-providers.test.ts:98 | returns mistral model from config | STRONG | STRONG | Provider-model getter returns literal mistral-small-latest override. | kept;  |
| src/test/llm-providers.test.ts:105 | returns openrouter model from config | STRONG | STRONG | Provider-model getter returns literal configured OpenRouter model ID. | kept;  |
| src/test/llm-providers.test.ts:114 | returns custom model from config | STRONG | STRONG | Provider-model getter returns literal custom my-model override. | kept;  |
| src/test/llm-providers.test.ts:123 | returns empty string for custom when not configured | STRONG | STRONG | Unconfigured custom model resolves to literal empty string. | kept;  |
| src/test/llm-providers.test.ts:143 | getXAIApiKey reads from config first | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-key-xai | rewritten; g2-key-xai |
| src/test/llm-providers.test.ts:150 | getXAIApiKey falls back to env var | STRONG | STRONG | Absent configured key falls back to literal xai-from-env. | kept;  |
| src/test/llm-providers.test.ts:156 | getMistralApiKey reads from config first | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-key-mistral | rewritten; g2-key-mistral |
| src/test/llm-providers.test.ts:163 | getMistralApiKey falls back to env var | STRONG | STRONG | Absent configured Mistral key resolves literal mis-from-env. | kept;  |
| src/test/llm-providers.test.ts:169 | getOpenRouterApiKey falls back to OPENROUTER_API_KEY | STRONG | STRONG | OpenRouter key helper reads literal or-from-env value. | kept;  |
| src/test/llm-providers.test.ts:175 | getCustomApiKey reads from config | STRONG | STRONG | Custom key helper returns literal configured custom-key. | kept;  |
| src/test/llm-providers.test.ts:182 | getCustomApiKey falls back to GNOSYS_LLM_API_KEY | STRONG | STRONG | Custom helper falls back to literal generic-key environment value. | kept;  |
| src/test/llm-providers.test.ts:190 | creates xAI provider with correct baseUrl | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-xai-url | rewritten; g2-xai-url |
| src/test/llm-providers.test.ts:199 | creates OpenRouter provider | STRONG | STRONG | Factory exposes literal OpenRouter name and configured model through public provider object. | kept;  |
| src/test/llm-providers.test.ts:217 | creates Mistral provider with correct baseUrl | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-mistral-url | rewritten; g2-mistral-url |
| src/test/llm-providers.test.ts:226 | creates custom provider with user-provided baseUrl | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-custom-url | rewritten; g2-custom-url |
| src/test/llm-providers.test.ts:241 | throws when xAI has no API key | STRONG | STRONG | Missing xAI key rejects provider construction with xAI API key error. | kept;  |
| src/test/llm-providers.test.ts:247 | throws when Mistral has no API key | STRONG | STRONG | Missing Mistral key rejects provider construction with Mistral API key error. | kept;  |
| src/test/llm-providers.test.ts:253 | throws when custom provider has no config | STRONG | STRONG | Absent custom configuration rejects construction with specific not-configured error. | kept;  |
| src/test/llm-providers.test.ts:258 | custom provider works without API key (local endpoints) | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-custom-no-key | rewritten; g2-custom-no-key |
| src/test/llm-providers.test.ts:273 | xai is unavailable without API key | STRONG | STRONG | Absent xAI key produces available=false from real availability function. | kept;  |
| src/test/llm-providers.test.ts:280 | mistral is unavailable without API key | STRONG | STRONG | Absent Mistral key produces available=false. | kept;  |
| src/test/llm-providers.test.ts:287 | custom is unavailable when not configured | STRONG | STRONG | Missing custom config produces available=false. | kept;  |
| src/test/llm-providers.test.ts:293 | custom is available when baseUrl and model are set | STRONG | STRONG | Complete custom endpoint/model config produces available=true. | kept;  |
| src/test/llm-redact.test.ts:5 | strips a literal xai key from error text | STRONG | Pending | Literal xAI secret disappears from real redaction output and replacement mask appears. | pending;  |
| src/test/llm-redact.test.ts:12 | redacts sk-ant- prefixed keys via regex | STRONG | Pending | Real regex redaction removes the Anthropic secret substring and emits a mask. | pending;  |
| src/test/llm-redact.test.ts:18 | leaves short keys unchanged when below length threshold | STRONG | Pending | Short-key input remains exactly error: short-key bad. | pending;  |
| src/test/localDiskCheck.test.ts:5 | matches LOCAL DISK ONLY phrase exactly | WEAK | STRONG | Literal observable result now rejects change accepted confirmation phrase and exported expected value together. | rewritten; G1-local-ack |
| src/test/log.test.ts:20 | writes plain text to stderr by default | STRONG | STRONG | Real logger writes boom to stderr using non-JSON plain text by default. | kept;  |
| src/test/log.test.ts:29 | writes JSON lines when GNOSYS_LOG_FORMAT=json | STRONG | STRONG | JSON logger emits literal error level, boom message, demo context and boom stack. | kept;  |
| src/test/log.test.ts:49 | appends JSON lines to GNOSYS_LOG_FILE | STRONG | STRONG | Real configured log file contains a parsed JSON error with literal file sink message and test module. | kept;  |
| src/test/log.test.ts:63 | respects GNOSYS_LOG_LEVEL gating | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; log-invert-gate |
| src/test/log.test.ts:72 | never throws on bad file paths | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; log-file-suppresses-stderr |
| src/test/machine-command-handler.test.ts:7 | declares machine as a parent container with show and migrate subcommands | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/machine-command-handler.test.ts:23 | has no parent action between machine declaration and first leaf command | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/machine-id-stability.test.ts:38 | GNOSYS_MACHINE_ID stays stable across a hostname change | STRONG | Pending | Foreign config plus override preserves literal pinned-container-id and updates actual hostname. | pending;  |
| src/test/machine-id-stability.test.ts:57 | preserves machine ID across restart when hostname is unchanged | STRONG | Pending | Second config load is neither creation nor regeneration and retains first persisted ID. | pending;  |
| src/test/machine-id-stability.test.ts:67 | regenerates a distinct ID when a foreign config is cloned without override | STRONG | Pending | Foreign hostname without override regenerates an ID distinct from literal foreign-fixed-id. | pending;  |
| src/test/machine-registry.test.ts:42 | returns {} when nothing is stored | STRONG | STRONG | Real registry reader returns literal empty object when its metadata storage is absent. | kept;  |
| src/test/machine-registry.test.ts:46 | round-trips through write/read | STRONG | STRONG | Registry serializer/reader preserves exact Box version and timestamp through the storage boundary fake. | kept;  |
| src/test/machine-registry.test.ts:52 | returns {} for malformed JSON instead of throwing | STRONG | STRONG | Malformed stored JSON produces a literal empty registry. | kept;  |
| src/test/machine-registry.test.ts:59 | adds this machine with version, lastSeen, and machineId | STRONG | STRONG | Record operation returns literal version 5.11.4, machine ID id-1 and timestamp format. | kept;  |
| src/test/machine-registry.test.ts:66 | prunes the orphaned entry left by a previous hostname (the phantom) | STRONG | STRONG | Recording renamed host removes the alias and returns exactly the single EdsMBP key. | kept;  |
| src/test/machine-registry.test.ts:84 | prunes a differently-named entry that shares this machineId | STRONG | STRONG | Matching physical machine ID prunes OldName and preserves id-1 on NewName. | kept;  |
| src/test/machine-registry.test.ts:95 | never removes a different physical machine | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; machine-damage-peer |
| src/test/machine-registry.test.ts:111 | persists the result so a re-read sees the pruned registry | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; machine-empty-persistence |
| src/test/machine-registry.test.ts:126 | removes a named entry and reports true | STRONG | STRONG | Forget returns true, removes the named old host, and retains the other host entry. | kept;  |
| src/test/machine-registry.test.ts:138 | reports false when the entry doesn't exist | STRONG | STRONG | Forgetting a missing ghost host returns literal false. | kept;  |
| src/test/machine-show-command-handler.test.ts:7 | wires machine show subcommand for local machine.json (machineId, roots, remote for network) | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/maintain-command-handler.test.ts:13 | wires maintain to runMaintainCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/maintain-command-handler.test.ts:23 | exports runMaintainCommand with maintain markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/masterLease.test.ts:16 | writes and reads epoch-fenced marker | STRONG | Pending | Two real marker writes increment epoch 1 to 2 and persisted holder becomes machine-b; fencing rejection remains a separate gap. | pending;  |
| src/test/mcp-context-release.test.ts:22 | wraps every tool handler with withContextRelease at registration | COUPLED | Pending | Asserts AsyncLocalStorage/wrapper/finally source syntax; does not acquire/release a real context. | pending;  |
| src/test/mcp-context-release.test.ts:32 | provides a last-resort error envelope for handlers without their own catch | COUPLED | Pending | Asserts logging/error formatting source substrings; no failing MCP tool is called. | pending;  |
| src/test/mcp-context-release.test.ts:40 | registers contexts from BOTH resolveToolContext return paths | COUPLED | Pending | Counts two internal source registration statements instead of behavior on both context paths. | pending;  |
| src/test/mcp-context-release.test.ts:45 | release is idempotent so per-handler finally blocks remain safe | COUPLED | Pending | Source text contains ctx.clientRead=null; release is never invoked twice. | pending;  |
| src/test/mcp-context-release.test.ts:49 | installs process-level guards in serve mode (stderr only, no stdout) | COUPLED | Pending | Reads process-handler source block and absence of stdout markers, not actual protocol output. | pending;  |
| src/test/mcp-fuzz.test.ts:73 | rejects malformed input for every tool with required fields | WEAK | Pending | Fuzz inputs and selected tools derive from the schemas under test; dropped required fields skip validation checks, and any thrown error counts as rejection. | pending;  |
| src/test/mcp-http-replay.test.ts:36 | two concurrent sessions both see the full real tool list | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-toolset-dream-name | rewritten; g2-toolset-dream-name |
| src/test/mcp-toolset-budget.test.ts:31 | core tier is ≤ 20 tools and its serialized payload ≤ 20,000 chars (~5k tokens) | STRONG | Pending | Real MCP listTools stays under stated tool/payload budget and includes seven concrete core tools. | pending;  |
| src/test/mcp-toolset-budget.test.ts:49 | standard tier sits between core and full | STRONG | Pending | Real standard list includes lens, excludes import and satisfies bounded tool count. | pending;  |
| src/test/mcp-toolset-budget.test.ts:57 | full tier registers everything, ≤ 60 tools | WEAK | STRONG | Literal observable result now rejects rename a full-tier tool while retaining full tool count. | rewritten; G1-full-tool-names |
| src/test/mcp-toolset-budget.test.ts:63 | core ⊂ standard ⊂ full by tier predicate | STRONG | Pending | Literal recall/lens/import tiers and public tier subset predicates protect catalog classification. | pending;  |
| src/test/mcp-toolset-budget.test.ts:78 | resolveToolset falls back to core (with a stderr warning) on unknown values | STRONG | Pending | Unknown/case/default/standard inputs return exact selected tiers and unknown warns. | pending;  |
| src/test/mcp-toolset-dynamic.test.ts:46 | a fresh default server starts on core: 19 tools (core 18 + gnosys_toolset) | STRONG | STRONG | Actual MCP default list has exact 19 count, core names, and excludes standard/full representatives. | kept;  |
| src/test/mcp-toolset-dynamic.test.ts:59 | gnosys_toolset without args lists standard and full additions | STRONG | STRONG | Actual toolset query reports core state and literal standard/full additions. | kept;  |
| src/test/mcp-toolset-dynamic.test.ts:72 | set:"full" expands to 56 tools and emits notifications/tools/list_changed | STRONG | STRONG | Actual switch emits list_changed notification and returns 56 listed tools with transition output. | kept;  |
| src/test/mcp-toolset-dynamic.test.ts:90 | set:"core" shrinks back down | STRONG | STRONG | Full-to-core switch changes real list from 56 to 19 and retains callable switch tool. | kept;  |
| src/test/mcp-toolset-dynamic.test.ts:103 | gnosys_toolset is present and callable in every tier | STRONG | STRONG | Every actual tier exposes/calls toolset and reports its literal tier. | kept;  |
| src/test/mcp-toolset-dynamic.test.ts:115 | GNOSYS_MCP_TOOLSET=full env override starts on the full tier | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-toolset-dream-name | rewritten; g2-toolset-dream-name |
| src/test/mcp-toolset-isolation.test.ts:23 | escalating session A to full leaves session B on core, and A can come back down | STRONG | Pending | Two real MCP sessions report counts 19/19 then 56/19 after A escalation and 19/19 after A reset. | pending;  |
| src/test/mcp-trace-tools.test.ts:104 | traces a codebase and reports created memories | WEAK | Pending | MCP trace checks reported function/memory counts but never reads created memory or edge content. | pending;  |
| src/test/mcp-trace-tools.test.ts:116 | returns a zero-count result for a directory with no source files | STRONG | Pending | Actual empty-directory MCP trace returns no error and literal zero creation count. | pending;  |
| src/test/mcp-trace-tools.test.ts:129 | walks the chain from a seeded memory | STRONG | Pending | Actual traversal response includes seeded target mem-trace-b and leads_to edge type. | pending;  |
| src/test/mcp-trace-tools.test.ts:141 | respects direction=in (no outgoing edges followed) | WEAK | Pending | Incoming traversal only excludes outgoing-target text; empty successful output would pass. | pending;  |
| src/test/mcp-trace-tools.test.ts:151 | errors on an unknown memory id | STRONG | Pending | Unknown traversal root returns isError=true and Memory not found. | pending;  |
| src/test/mcp-trace-tools.test.ts:162 | records an outcome against explicit memory ids | STRONG | Pending | Reflection through MCP reports success and real DB confidence rises from 0.7 to literal 0.75. | pending;  |
| src/test/mcp-trace-tools.test.ts:185 | rejects a call without the required outcome | WEAK | Pending | Missing-outcome call accepts any thrown error or error response without validating reason. | pending;  |
| src/test/migrate-command-handler.test.ts:13 | wires migrate to runMigrateCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerProject |
| src/test/migrate-command-handler.test.ts:25 | exports runMigrateCommand with migrate markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerProject |
| src/test/migrate-db-command-handler.test.ts:13 | wires migrate-db to runMigrateDbCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/migrate-db-command-handler.test.ts:23 | exports runMigrateDbCommand with migrate-db markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/model-validation.test.ts:9 | builds anthropic requests with the expected URL and headers | STRONG | Pending | Real request builder sends literal Anthropic URL, POST, key header and API version at mocked network boundary. | pending;  |
| src/test/model-validation.test.ts:29 | builds openai and groq requests with bearer auth | STRONG | Pending | Real builder sends literal OpenAI/Groq endpoint and matching Bearer key per call. | pending;  |
| src/test/model-validation.test.ts:48 | builds custom provider requests from baseUrl and returns unsupported errors | STRONG | Pending | Custom base URL normalizes to literal completions endpoint and unknown provider yields specific error without another network call. | pending;  |
| src/test/modelValidation.test.ts:5 | detects xAI-style HTTP 400 incorrect API key messages | STRONG | Pending | Literal xAI HTTP 400 incorrect-key response is classified as an API-key error. | pending;  |
| src/test/modelValidation.test.ts:13 | detects HTTP 401 and 403 | STRONG | Pending | HTTP 401 and 403 strings both classify as API-key failures. | pending;  |
| src/test/modelValidation.test.ts:18 | detects common invalid-key phrases | STRONG | Pending | Invalid-api-key and Authentication failed phrases classify as API-key failures. | pending;  |
| src/test/modelValidation.test.ts:23 | returns false for non-auth failures | STRONG | Pending | 404 model-not-found, timeout and undefined inputs all return false. | pending;  |
| src/test/multimodal.test.ts:55 | detectFileType returns 'pdf' for .pdf files | STRONG | Pending | PDF file yields literal pdf extension/type and application/pdf MIME. | pending;  |
| src/test/multimodal.test.ts:63 | detectFileType returns 'docx' for .docx files | STRONG | Pending | DOCX file yields literal docx extension and type. | pending;  |
| src/test/multimodal.test.ts:70 | detectFileType returns 'image' for .png files | STRONG | Pending | PNG file yields literal image type and image/png MIME. | pending;  |
| src/test/multimodal.test.ts:78 | detectFileType returns 'image' for .jpg files | STRONG | Pending | JPG file yields literal image type and image/jpeg MIME. | pending;  |
| src/test/multimodal.test.ts:86 | detectFileType returns 'image' for .gif files | STRONG | Pending | GIF file yields literal image type and gif extension. | pending;  |
| src/test/multimodal.test.ts:93 | detectFileType returns 'image' for .webp files | STRONG | Pending | WebP file yields literal image type and webp extension. | pending;  |
| src/test/multimodal.test.ts:100 | detectFileType returns 'image' for .svg files | STRONG | Pending | SVG file yields literal image type and image/svg+xml MIME. | pending;  |
| src/test/multimodal.test.ts:108 | detectFileType returns 'audio' for .mp3 files | STRONG | Pending | MP3 file yields literal audio type and audio/mpeg MIME. | pending;  |
| src/test/multimodal.test.ts:116 | detectFileType returns 'audio' for .wav files | STRONG | Pending | WAV file yields literal audio type and wav extension. | pending;  |
| src/test/multimodal.test.ts:123 | detectFileType returns 'audio' for .m4a files | STRONG | Pending | M4A file yields literal audio type and m4a extension. | pending;  |
| src/test/multimodal.test.ts:130 | detectFileType returns 'audio' for .ogg files | STRONG | Pending | OGG file yields literal audio type and ogg extension. | pending;  |
| src/test/multimodal.test.ts:137 | detectFileType returns 'audio' for .flac files | STRONG | Pending | FLAC file yields literal audio type and flac extension. | pending;  |
| src/test/multimodal.test.ts:144 | detectFileType returns 'video' for .mp4 files | STRONG | Pending | MP4 file yields literal video type and video/mp4 MIME. | pending;  |
| src/test/multimodal.test.ts:152 | detectFileType returns 'video' for .mkv files | STRONG | Pending | MKV file yields literal video type and mkv extension. | pending;  |
| src/test/multimodal.test.ts:159 | detectFileType returns 'video' for .mov files | STRONG | Pending | MOV file yields literal video type and mov extension. | pending;  |
| src/test/multimodal.test.ts:166 | detectFileType returns 'video' for .avi files | STRONG | Pending | AVI file yields literal video type and avi extension. | pending;  |
| src/test/multimodal.test.ts:173 | detectFileType returns 'text' for .txt files | STRONG | Pending | TXT file yields literal text type and text/plain MIME. | pending;  |
| src/test/multimodal.test.ts:181 | detectFileType returns 'text' for .md files | STRONG | Pending | Markdown file yields literal text type and text/markdown MIME. | pending;  |
| src/test/multimodal.test.ts:189 | detectFileType returns 'unknown' for .xyz files | STRONG | Pending | Unknown extension yields unknown type and application/octet-stream MIME. | pending;  |
| src/test/multimodal.test.ts:202 | splits text at paragraph boundaries | WEAK | STRONG | Literal observable result now rejects drop first character of each produced text chunk. | rewritten; G1-chunk-paragraph |
| src/test/multimodal.test.ts:213 | merges small paragraphs into a single chunk | STRONG | Pending | Three short paragraphs become one chunk containing all three literal texts. | pending;  |
| src/test/multimodal.test.ts:223 | splits oversized paragraphs at sentence boundaries | WEAK | STRONG | Literal observable result now rejects drop first character of each produced text chunk. | rewritten; G1-chunk-sentence |
| src/test/multimodal.test.ts:243 | respects targetSize option | WEAK | STRONG | Literal observable result now rejects drop first character of each produced text chunk. | rewritten; G1-chunk-target |
| src/test/multimodal.test.ts:256 | handles single paragraph text | STRONG | Pending | Single paragraph returns exact original text and index zero. | pending;  |
| src/test/multimodal.test.ts:264 | handles empty text | STRONG | Pending | Empty text returns literal empty array. | pending;  |
| src/test/multimodal.test.ts:269 | handles whitespace-only text | STRONG | Pending | Whitespace-only text returns literal empty array. | pending;  |
| src/test/multimodal.test.ts:274 | assigns sequential index values | HOLLOW | STRONG | Literal observable result now rejects drop every chunk before index assertions. | rewritten; G1-chunk-index |
| src/test/multimodal.test.ts:287 | preserves page metadata | HOLLOW | STRONG | Literal observable result now rejects drop every metadata-bearing chunk. | rewritten; G1-chunk-page |
| src/test/multimodal.test.ts:302 | preserves timerange metadata | HOLLOW | STRONG | Literal observable result now rejects drop every metadata-bearing chunk. | rewritten; G1-chunk-timerange |
| src/test/multimodal.test.ts:315 | merges undersized segments with same page | WEAK | STRONG | Literal observable result now rejects lose segment text while preserving chunk shape. | rewritten; G1-chunk-merge |
| src/test/multimodal.test.ts:328 | handles empty segments array | STRONG | Pending | Empty segment input returns literal empty array. | pending;  |
| src/test/multimodal.test.ts:333 | handles segments with empty text | WEAK | STRONG | Literal observable result now rejects lose segment text while preserving chunk shape. | rewritten; G1-chunk-empty |
| src/test/multimodal.test.ts:363 | initAttachments creates the directory and manifest | STRONG | Pending | Initialization creates actual directory and exact empty manifest structure. | pending;  |
| src/test/multimodal.test.ts:376 | initAttachments is idempotent (safe to call twice) | STRONG | Pending | Two initializations produce valid exact empty manifest. | pending;  |
| src/test/multimodal.test.ts:385 | storeAttachment copies file and generates UUID | WEAK | STRONG | Literal observable result now rejects write wrong attachment bytes while preserving metadata. | rewritten; G1-attachment-bytes |
| src/test/multimodal.test.ts:417 | storeAttachment detects duplicate by content hash | STRONG | Pending | Identical bytes produce same UUID/hash and one persisted manifest entry. | pending;  |
| src/test/multimodal.test.ts:439 | listAttachments returns empty array initially | STRONG | Pending | New attachment store lists exact empty array. | pending;  |
| src/test/multimodal.test.ts:445 | linkMemoryToAttachment updates the manifest | STRONG | Pending | Linking persists exact mem-001/mem-002 IDs and repeat link does not duplicate. | pending;  |
| src/test/multimodal.test.ts:472 | linkMemoryToAttachment throws for unknown UUID | STRONG | Pending | Unknown attachment UUID rejects with Attachment-not-found diagnostic. | pending;  |
| src/test/multimodal.test.ts:479 | getAttachmentPath constructs correct path | STRONG | Pending | Public path helper returns exact attachments/abc-123.pdf path. | pending;  |
| src/test/multimodal.test.ts:488 | GnosysConfigSchema includes multimodal defaults | WEAK | STRONG | Literal observable result now rejects change default chunk size while retaining schema fields. | rewritten; G1-multimodal-defaults |
| src/test/multimodal.test.ts:496 | multimodal.transcriptionProvider defaults to 'groq' | STRONG | Pending | Empty schema parse yields literal groq transcription provider. | pending;  |
| src/test/multimodal.test.ts:501 | multimodal.chunkSize defaults to 1500 | STRONG | Pending | Empty schema parse yields literal chunkSize=1500. | pending;  |
| src/test/multimodal.test.ts:506 | multimodal.maxFileSizeMb defaults to 100 | STRONG | Pending | Empty schema parse yields literal maxFileSizeMb=100. | pending;  |
| src/test/multimodal.test.ts:511 | DEFAULT_CONFIG has multimodal defaults | STRONG | Pending | Public DEFAULT_CONFIG contains exact groq/1500/100 values. | pending;  |
| src/test/multimodal.test.ts:518 | taskModels accepts 'vision' and 'transcription' tasks | STRONG | Pending | Schema preserves exact vision and transcription provider/model objects. | pending;  |
| src/test/multimodal.test.ts:536 | multimodal config allows custom values | STRONG | Pending | Schema preserves all five explicit multimodal override values. | pending;  |
| src/test/openrouterTiers.test.ts:9 | includes free models with :free suffix | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-openrouter-catalog | rewritten; g2-openrouter-catalog |
| src/test/openrouterTiers.test.ts:28 | falls back to static tiers for empty catalog | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-openrouter-fallback | rewritten; g2-openrouter-fallback |
| src/test/package-manager-detect.test.ts:9 | detects npx from install path | STRONG | Pending | Two concrete _npx install paths map to literal npx. | pending;  |
| src/test/package-manager-detect.test.ts:14 | detects pnpm from install path and PNPM_HOME | STRONG | Pending | pnpm path and PNPM_HOME examples map to literal pnpm. | pending;  |
| src/test/package-manager-detect.test.ts:23 | detects yarn from install path | STRONG | Pending | Two concrete Yarn global/bin paths map to literal yarn. | pending;  |
| src/test/package-manager-detect.test.ts:28 | detects npm from typical global path | STRONG | Pending | Typical global node_modules path maps to literal npm. | pending;  |
| src/test/package-manager-detect.test.ts:32 | falls back to npm_config_user_agent | STRONG | Pending | Unknown install paths honor explicit pnpm and Yarn user agents. | pending;  |
| src/test/package-manager-detect.test.ts:39 | maps managers to upgrade commands | STRONG | Pending | Public upgrade formatter maps each manager to literal command and npx to null. | pending;  |
| src/test/phase0-6.regression.test.ts:42 | inserts a memory into the database and retrieves it | STRONG | STRONG | Inserted row is read with literal title, content and decisions category. | kept;  |
| src/test/phase0-6.regression.test.ts:58 | updates a memory's fields | STRONG | STRONG | Public update persists literal Updated Title and confidence 0.95. | kept;  |
| src/test/phase0-6.regression.test.ts:73 | deletes a memory and its FTS entry | STRONG | STRONG | Public delete removes the memory and its corresponding search hit. | kept;  |
| src/test/phase0-6.regression.test.ts:88 | reinforces a memory by incrementing reinforcement_count | MISLABELED | STRONG | Names and asserts the actual public DB update contract, not maintenance reinforcement. | rewritten; update-drop-reinforcement |
| src/test/phase0-6.regression.test.ts:103 | reads memories by category | STRONG | STRONG | Category filtering returns exactly two rows and every category is decisions. | kept;  |
| src/test/phase0-6.regression.test.ts:113 | writes and reads a memory file via GnosysStore | STRONG | STRONG | Filesystem store round trip preserves literal ID store-001 and Content here body. | kept;  |
| src/test/phase0-6.regression.test.ts:132 | FTS5 search finds memories by keyword | STRONG | STRONG | Concrete JWT query returns seeded search-001 as first hit. | kept;  |
| src/test/phase0-6.regression.test.ts:155 | discover finds memories by relevance keywords | STRONG | STRONG | Discovery query returns the literal OAuth memory ID disc-001. | kept;  |
| src/test/phase0-6.regression.test.ts:169 | GnosysSearch indexes and searches store memories | STRONG | STRONG | Real store reindex and search return Redis Caching Decision first. | kept;  |
| src/test/phase0-6.regression.test.ts:190 | returns empty results for non-matching queries | STRONG | STRONG | Public FTS search of an empty database returns literal []. | kept;  |
| src/test/phase0-6.regression.test.ts:199 | dream module can be imported without errors | WEAK | STRONG | Public dream cycle returns literal empty-database reason and zero provider calls. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | rewritten; dream-drop-empty-error |
| src/test/phase0-6.regression.test.ts:204 | dream engine initializes with default config (disabled) | MISLABELED | STRONG | Public dream cycle on one memory returns literal configured minimum failure, replacing uninstantiated constructor claim. | rewritten; dream-drop-minimum-error |
| src/test/phase0-6.regression.test.ts:215 | stores memories with distinct project_id values | STRONG | STRONG | Project filters return one literal project-specific title for each seeded project. | kept;  |
| src/test/phase0-6.regression.test.ts:242 | registers and retrieves projects | STRONG | STRONG | Registered project reread preserves literal Alpha name and /tmp/alpha working path. | kept;  |
| src/test/phase0-6.regression.test.ts:261 | separates memories by scope | WEAK | STRONG | Asserts literal scoped IDs or persisted exported/archived body, killing the original surviving wrong-scope/dropped-body mutation. | rewritten; scope-always-project |
| src/test/phase0-6.regression.test.ts:285 | export module can be imported | WEAK | Deleted | Deleted module-only duplicate of real export-body test. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | deleted; regression-export-drop-body |
| src/test/phase0-6.regression.test.ts:290 | exporter creates output directory and writes memories | WEAK | STRONG | Asserts literal scoped IDs or persisted exported/archived body, killing the original surviving wrong-scope/dropped-body mutation. | rewritten; regression-export-drop-body |
| src/test/phase0-6.regression.test.ts:324 | getMemoryCount returns correct totals | STRONG | STRONG | Mixed active/archive fixture reports exact active 2, archived 1 and total 3. | kept;  |
| src/test/phase0-6.regression.test.ts:341 | getCategories returns distinct categories | STRONG | STRONG | Category listing contains exactly decisions and concepts despite duplicate category rows. | kept;  |
| src/test/phase0-6.regression.test.ts:352 | dashboard module can be imported | WEAK | STRONG | Calls real dashboard collector with active/archived rows and asserts literal DB summary. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | rewritten; dashboard-wrong-active-count |
| src/test/phase0-6.regression.test.ts:361 | maintenance module exports expected functions | WEAK | STRONG | Real maintenance call fails with actionable literal missing-store error. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | rewritten; maintenance-wrong-no-store-error |
| src/test/phase0-6.regression.test.ts:366 | archive module can be imported and instantiated | WEAK | STRONG | Asserts literal scoped IDs or persisted exported/archived body, killing the original surviving wrong-scope/dropped-body mutation. | rewritten; archive-empty-content |
| src/test/phase0-6.regression.test.ts:397 | memory tier can be changed from active to archive and back | STRONG | STRONG | Generic update transitions persisted tier/status to archive/archived and back to active/active. | kept;  |
| src/test/phase0-6.regression.test.ts:415 | confidence decay is computable | HOLLOW | Deleted | Deleted fixture-only Math.exp demonstration; no production import or observable app behavior. Computes Math.exp on local literals without importing or invoking application code. | deleted;  |
| src/test/phase10.reflect-trace-traverse.test.ts:65 | boosts confidence on success | STRONG | Pending | Sandbox reflection returns success, positive confidence change, reinforcement one and literal delta 0.05. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:86 | decreases confidence on failure | STRONG | Pending | Failure reflection returns failure, decreased confidence and literal delta -0.1. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:105 | creates a new reflection memory | STRONG | Pending | Reads persisted reflection category/outcome/notes and literal validates edge to seeded architecture memory. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:137 | creates corroborates links between multiple memories | STRONG | Pending | Successful multi-memory reflection persists a corroborates edge to the second seeded ID. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:158 | searches FTS to find related memories | WEAK | Pending | Auto-discovery only requires memories_updated.length>=0 and a generated ID; zero matches passes. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:176 | finds function declarations in TS files | STRONG | Pending | Real TS source trace reports exactly one file and three function declarations. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:205 | stores functions as category 'how' memories | WEAK | Pending | Created-count assertion is separate from memoryIds loop with no nonempty/length assertion. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:236 | creates call-chain relationships between functions | WEAK | Pending | Call-chain case requires any leads_to edge from step1 but never verifies step2 target/follows_from. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:275 | returns zero counts for empty directory | STRONG | Pending | Empty real directory returns literal zero files/functions/memories/relationships. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:290 | traverses chain up to specified depth | STRONG | Pending | Depth-two traversal returns A/B/C and excludes D; depth three reaches all four. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:330 | only follows specified relationship types | STRONG | Pending | Type filter includes leads_to target filter-b and excludes requires target filter-c. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:353 | returns error for non-existent memory | STRONG | Pending | Unknown traversal root returns ok=false with not-found error. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:363 | follows both outgoing and incoming edges | STRONG | Pending | Default bidirectional traversal includes both seeded incoming and outgoing neighbors and total three. | pending;  |
| src/test/phase10.reflect-trace-traverse.test.ts:388 | traces code, reflects on outcome, then traverses the chain | WEAK | Pending | End-to-end chain requires any traced memory reachable from reflection, without literal function/edge identities. | pending;  |
| src/test/phase3-hardening-pins.test.ts:21 | checkpoints fingerprints at every phase boundary | COUPLED | Pending | Inspects private checkpoint source name/regex and absent lastRunAt text; no crash is simulated. | pending;  |
| src/test/phase3-hardening-pins.test.ts:30 | scheduler acquires the cross-process dream lock before dreaming | COUPLED | Pending | Searches acquire/release strings anywhere in Dream source rather than concurrent scheduler behavior. | pending;  |
| src/test/phase3-hardening-pins.test.ts:39 | withRecovery uses the shared corruption detector (incl. SQLITE_NOTADB) | COUPLED | Pending | Pins exact corruption-detector source conditional without opening damaged DB. | pending;  |
| src/test/phase3-hardening-pins.test.ts:43 | reopen() heals FTS triggers and invalidates the statement cache | COUPLED | Pending | Slices reopen source for cache/trigger names without performing reopened read/write. | pending;  |
| src/test/phase3-hardening-pins.test.ts:49 | close() invalidates the statement cache | COUPLED | Pending | Regex asserts private cache.clear occurs in close source. | pending;  |
| src/test/phase3-hardening-pins.test.ts:57 | projectRoot-scoped contexts own and release their GnosysSearch handle | COUPLED | Pending | Checks ownsSearch source expressions rather than handle release on scoped MCP requests. | pending;  |
| src/test/phase7a.migration.test.ts:34 | migrate module can be imported | WEAK | Deleted | Deleted import-only duplicate of migration body round trip. Imports the module and checks export presence, type, or a default constant; never invokes the advertised feature, so a no-op implementation preserving exports passes these assertions. | deleted;  |
| src/test/phase7a.migration.test.ts:39 | memories written to store can be read into DB via migrate | STRONG | STRONG | Migrates two actual Markdown files and reads literal Decision Alpha and Concept Beta titles from SQLite. | kept;  |
| src/test/phase7a.migration.test.ts:74 | migration is idempotent (re-migrate skips existing) | STRONG | STRONG | Two migration runs leave exactly one persisted memory after first-run count 1. | kept;  |
| src/test/phase7a.migration.test.ts:97 | DB search works after inserting memories | STRONG | STRONG | FTS query returns concrete compat-001 memory ID after insertion. | kept;  |
| src/test/phase7a.migration.test.ts:112 | getMemoryCount returns correct totals after migration | MISLABELED | STRONG | Runs actual migration before checking literal totals and migrated content. | rewritten; migration-drop-body |
| src/test/phase7a.migration.test.ts:129 | isMigrated returns false for empty DB, true after adding data | STRONG | STRONG | Public isMigrated transitions false to true after inserting a concrete memory. | kept;  |
| src/test/phase7a.migration.test.ts:140 | getSchemaVersion returns current version | WEAK | STRONG | Literal schema version 5 / Porter-stemmed matching ID replaces open-ended bound. | rewritten; schema-version-future |
| src/test/phase7a.migration.test.ts:149 | has all 6 tables (memories, fts, relationships, summaries, audit_log, projects) | COUPLED | Deleted | Deleted private schema-table census; public CRUD/migration, stemming, project and audit cases below exercise stored behavior. | deleted; audit-drop-details, memory-drop-scope-project, project-drop-vault |
| src/test/phase7a.migration.test.ts:166 | memories table has project_id and scope columns | COUPLED | STRONG | Public memory insert/reopen/read validates stored project/scope/content fields. | rewritten; memory-drop-scope-project |
| src/test/phase7a.migration.test.ts:183 | projects table has correct columns | COUPLED | STRONG | Public project insert/reopen/read validates persisted identity fields. | rewritten; project-drop-vault |
| src/test/phase7a.migration.test.ts:199 | FTS5 virtual table is set up with porter tokenizer | WEAK | STRONG | Literal schema version 5 / Porter-stemmed matching ID replaces open-ended bound. | rewritten; fts-wrong-row-id |
| src/test/phase7a.migration.test.ts:214 | audit_log table accepts entries | COUPLED | STRONG | Public audit write/read checks literal stored payload without private SQLite handle. | rewritten; audit-drop-details |
| src/test/phase7b.read-paths.test.ts:32 | searchFts returns results from DB | STRONG | Pending | Real FTS returns exact read-001 ID and API Gateway Design title. | pending;  |
| src/test/phase7b.read-paths.test.ts:48 | discoverFts searches relevance column preferentially | MISLABELED | Pending | Single memory whose keywords occur only in relevance proves relevance search, not preferential ranking against competing content. | pending;  |
| src/test/phase7b.read-paths.test.ts:63 | getActiveMemories returns only active-tier memories | STRONG | Pending | Active-memory read returns only active-001 from mixed active/archive seeds. | pending;  |
| src/test/phase7b.read-paths.test.ts:76 | recall module can be imported and has expected exports | WEAK | Pending | Recall module case only verifies export property existence; recall is never called. | pending;  |
| src/test/phase7b.read-paths.test.ts:85 | fetches 100 memories in under 100ms | STRONG | Pending | Reads exactly 100 actual DB records within explicit 100ms budget. | pending;  |
| src/test/phase7b.read-paths.test.ts:105 | FTS5 search on 100 memories completes in under 50ms | WEAK | Pending | FTS performance check accepts any nonempty results without enforcing limit or expected IDs. | pending;  |
| src/test/phase7b.read-paths.test.ts:129 | getMemoriesByProject returns only that project's memories | STRONG | Pending | Project-specific reads return exact Alpha/Beta IDs and exclude another project/user record. | pending;  |
| src/test/phase7b.read-paths.test.ts:164 | user-scoped memories are accessible regardless of project | MISLABELED | Pending | User-scope read checks one user record without passing or switching project context. | pending;  |
| src/test/phase7c.dual-write.test.ts:36 | memory exists in both DB and filesystem after write | MISLABELED | Deleted | Deleted manually simulated dual-write/reinforcement claim; duplicate public CRUD coverage is named. | deleted;  |
| src/test/phase7c.dual-write.test.ts:71 | DB content matches store content for the same memory | HOLLOW | Deleted | Deleted manually simulated dual-write/reinforcement claim; duplicate public CRUD coverage is named. Manually writes the same fixture separately to the database and Markdown store, then compares those fixtures; never invokes automatic dual-write or synchronization behavior. | deleted;  |
| src/test/phase7c.dual-write.test.ts:100 | edited markdown file is reflected after reindex | MISLABELED | Deleted | Deleted readMemory-only duplicate mislabeled as reindex; replacement below performs both initial and edited index reads. | deleted; reindex-ignore-second-call |
| src/test/phase7c.dual-write.test.ts:121 | search index reflects manual edits after reindex | WEAK | STRONG | Distinct old/new tokens and literal result title prove edited content is indexed and stale content removed. | rewritten; reindex-ignore-second-call |
| src/test/phase7c.dual-write.test.ts:160 | updating DB memory fields reflects correct state | MISLABELED | Deleted | Deleted manually simulated dual-write/reinforcement claim; duplicate public CRUD coverage is named. | deleted;  |
| src/test/phase7c.dual-write.test.ts:183 | updating store memory updates modified date | STRONG | STRONG | Public store update returns the current modified date instead of the seeded old date. | kept;  |
| src/test/phase7d.dream.test.ts:31 | GnosysDreamEngine class is importable | WEAK | Pending | Only checks class export exists and is a function, never runs Dream. | pending;  |
| src/test/phase7d.dream.test.ts:37 | DEFAULT_DREAM_CONFIG has disabled=true by default | STRONG | Pending | Public default explicitly keeps autonomous dream disabled. | pending;  |
| src/test/phase7d.dream.test.ts:42 | DEFAULT_DREAM_CONFIG has sensible idle threshold | WEAK | Pending | Thresholds only need be positive, permitting unusable huge idle/runtime settings. | pending;  |
| src/test/phase7d.dream.test.ts:48 | dream config supports self-critique and summary generation flags | WEAK | Pending | Self-critique/summary/relationship defaults are checked as booleans only. | pending;  |
| src/test/phase7d.dream.test.ts:59 | dream config has runtime limits | MISLABELED | Pending | Resource-safety claim inspects configuration numbers without exercising idle gating or runtime abort. | pending;  |
| src/test/phase7d.dream.test.ts:71 | audit_log accepts dream-related entries | MISLABELED | Pending | Seeds audit rows directly and queries them, never invokes Dream to prove it logs activity. | pending;  |
| src/test/phase7d.dream.test.ts:111 | audit_log entries have correct schema | COUPLED | Pending | Queries private SQLite handle and asserts column presence instead of a public audit outcome. | pending;  |
| src/test/phase7e.export.test.ts:33 | exports memories into target directory | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; export-drop-body |
| src/test/phase7e.export.test.ts:66 | exported files preserve wikilinks | HOLLOW | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; export-omit-wikilink-source |
| src/test/phase7e.export.test.ts:107 | only exports active memories when activeOnly=true | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; export-drop-body |
| src/test/phase7e.export.test.ts:142 | exported memory can be read back as valid markdown | WEAK | STRONG | Checks literal public output or persisted content; concrete relevant mutations survive original assertions and fail the replacement (see mutationIds and before/after records). | rewritten; export-drop-body |
| src/test/phase8a.central-db.test.ts:39 | gnosys init creates .gnosys directory with gnosys.json | WEAK | Pending | Init identity checks key presence plus directory but accepts missing usable identity/name values. | pending;  |
| src/test/phase8a.central-db.test.ts:52 | projectId is a valid UUID-like string | STRONG | Pending | CLI-generated project ID matches the independently specified UUID hexadecimal layout. | pending;  |
| src/test/phase8a.central-db.test.ts:67 | gnosys.json includes schemaVersion | WEAK | Pending | Identity schema version is checked only to be at least 1 rather than the supported version. | pending;  |
| src/test/phase8a.central-db.test.ts:84 | project is registered in central DB after init | MISLABELED | Pending | Claims registration after init but only calls insertProject directly, never init. | pending;  |
| src/test/phase8a.central-db.test.ts:100 | multiple projects can coexist in central DB | STRONG | Pending | Two real project inserts produce exactly the literal sorted Alpha/Beta names. | pending;  |
| src/test/phase8a.central-db.test.ts:123 | getProjectByDirectory finds project by path | STRONG | Pending | Directory lookup finds literal dir-proj ID for /special/path/project. | pending;  |
| src/test/phase8a.central-db.test.ts:141 | project-scoped memories have project_id set | STRONG | Pending | Persisted project memory retains proj-x and project scope. | pending;  |
| src/test/phase8a.central-db.test.ts:155 | user-scoped memories have null project_id | STRONG | Pending | Persisted user memory retains null project ID and user scope. | pending;  |
| src/test/phase8a.central-db.test.ts:169 | global-scoped memories have null project_id | STRONG | Pending | Persisted global memory retains null project ID and global scope. | pending;  |
| src/test/phase8a.central-db.test.ts:183 | scope constraint rejects invalid values | COUPLED | Pending | Bypasses public database API through private raw SQLite INSERT and accepts any thrown error. | pending;  |
| src/test/phase8a.central-db.test.ts:209 | backup creates a copy of the database | WEAK | Pending | Backup verifies only file existence and positive size, not a readable database or records. | pending;  |
| src/test/phase8a.central-db.test.ts:225 | backup file contains the same data | MISLABELED | Pending | Name claims backup contains same data; body opens the parent directory database without reading it and only checks backup existence. | pending;  |
| src/test/phase8a.central-db.test.ts:244 | re-init preserves projectId | WEAK | Pending | Re-init checks equality of two derived IDs but permits both missing or invalid. | pending;  |
| src/test/phase8a.central-db.test.ts:267 | project can be updated with new working directory | STRONG | Pending | Public project update persists /new/path and preserves MovableProject name. | pending;  |
| src/test/phase8b.preferences.test.ts:45 | setPreference creates a user-scoped memory | STRONG | Pending | Persisted preference row has exact user scope, null project and preferences category. | pending;  |
| src/test/phase8b.preferences.test.ts:55 | getPreference retrieves the stored value | STRONG | Pending | Public getPreference returns literal editor key and VS Code with Vim mode value. | pending;  |
| src/test/phase8b.preferences.test.ts:64 | getAllPreferences returns all user preferences | STRONG | Pending | Public list returns exact formatter/lang/test-framework key set. | pending;  |
| src/test/phase8b.preferences.test.ts:78 | deletePreference removes the memory | STRONG | Pending | Delete returns true and previously existing preference becomes null. | pending;  |
| src/test/phase8b.preferences.test.ts:87 | updating a preference increments reinforcement_count | STRONG | Pending | Second preference write persists reinforcement_count=1 and v2 content. | pending;  |
| src/test/phase8b.preferences.test.ts:96 | preference tags are stored | STRONG | Pending | Preference round trip preserves exact workflow/git tag array. | pending;  |
| src/test/phase8b.preferences.test.ts:109 | injectRules creates new file with markers | STRONG | Pending | Actual generated rules file contains both markers and supplied content. | pending;  |
| src/test/phase8b.preferences.test.ts:119 | injectRules replaces existing GNOSYS block | STRONG | Pending | Existing block is replaced with new literal text and old text disappears. | pending;  |
| src/test/phase8b.preferences.test.ts:140 | syncRules generates rules from DB preferences | STRONG | Pending | DB preferences become actual rules file text, prefCount=2 and created=true. | pending;  |
| src/test/phase8b.preferences.test.ts:161 | generateRulesBlock includes preference values | STRONG | Pending | Rendered preference section includes literal title and convention content. | pending;  |
| src/test/phase8b.preferences.test.ts:180 | generateRulesBlock includes project conventions | STRONG | Pending | Rendered project section includes literal PostgreSQL convention. | pending;  |
| src/test/phase8b.preferences.test.ts:220 | generateRulesBlock always includes base tool instructions | STRONG | Pending | Empty rules render still includes concrete memory-system and discover instructions. | pending;  |
| src/test/phase8b.preferences.test.ts:230 | preserves content before GNOSYS block | STRONG | Pending | Injection preserves both literal user rules before block and writes updated content. | pending;  |
| src/test/phase8b.preferences.test.ts:250 | preserves content after GNOSYS block | STRONG | Pending | Injection preserves user text after block and writes replacement. | pending;  |
| src/test/phase8b.preferences.test.ts:268 | appends GNOSYS block to file without one | STRONG | Pending | New block append preserves existing heading and notes. | pending;  |
| src/test/phase8b.preferences.test.ts:285 | creates parent directories for rules file | STRONG | Pending | Nested Cursor rules file is created with supplied literal content. | pending;  |
| src/test/phase8c.cli-parity.test.ts:48 | gnosys list returns empty list for new store | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-list-empty |
| src/test/phase8c.cli-parity.test.ts:54 | gnosys stats returns statistics | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-stats-human-output |
| src/test/phase8c.cli-parity.test.ts:59 | gnosys projects lists registered projects | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-projects-omit-rows |
| src/test/phase8c.cli-parity.test.ts:64 | gnosys pref get returns preferences (empty for new store) | WEAK | STRONG | Seeded data and literal CLI results verify registered projects, shared/scoped list behavior, stats, preferences, audit and DB-to-CLI parity. | rewritten; cli-pref-human-empty |
| src/test/phase8c.cli-parity.test.ts:69 | gnosys pref set + get round-trips a value | STRONG | STRONG | Real CLI preference set/get returns the literal test value. | kept;  |
| src/test/phase8c.cli-parity.test.ts:78 | gnosys --help shows help text | STRONG | STRONG | Built CLI help emits Gnosys and Commands headings. | kept;  |
| src/test/phase8c.cli-parity.test.ts:87 | gnosys init --help shows init options | STRONG | STRONG | Built init help includes the directory option. | kept;  |
| src/test/phase8c.cli-parity.test.ts:99 | gnosys list --json outputs valid JSON | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-list-wrong-count |
| src/test/phase8c.cli-parity.test.ts:107 | gnosys stats --json outputs valid JSON | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-stats-bogus |
| src/test/phase8c.cli-parity.test.ts:113 | gnosys projects --json outputs valid JSON | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-projects-omit-rows |
| src/test/phase8c.cli-parity.test.ts:125 | gnosys pref get --json outputs valid JSON | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-pref-phantom |
| src/test/phase8c.cli-parity.test.ts:135 | gnosys.json exists after init | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-identity-invalid |
| src/test/phase8c.cli-parity.test.ts:140 | CLI uses GNOSYS_PROJECT env var for project context | MISLABELED | STRONG | Original claimed an obsolete GNOSYS_PROJECT contract; replacement selects cwd and verifies current/shared records while excluding the other project. | rewritten; cli-list-empty |
| src/test/phase8c.cli-parity.test.ts:149 | re-init preserves project identity | WEAK | Deleted | Deleted duplicate weak CLI/identity smoke; named replacement asserts literal results and is mutation-proven. | deleted; cli-identity-invalid |
| src/test/phase8d.federated.test.ts:41 | project-scoped results rank higher than user-scoped | STRONG | STRONG | Actual federated scores rank literal project-arch above user-arch among exactly two results. | kept;  |
| src/test/phase8d.federated.test.ts:73 | user-scoped results rank higher than global-scoped | STRONG | STRONG | Actual user-db score exceeds global-db for same thematic query. | kept;  |
| src/test/phase8d.federated.test.ts:101 | recently modified memories get a recency boost | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-recency | rewritten; g2-federated-recency |
| src/test/phase8d.federated.test.ts:136 | reinforced memories get a reinforcement boost | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-reinforcement | rewritten; g2-federated-reinforcement |
| src/test/phase8d.federated.test.ts:170 | respects includeGlobal=false | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-global | rewritten; g2-federated-global |
| src/test/phase8d.federated.test.ts:195 | returns empty array for no matches | STRONG | STRONG | Unmatched empty DB search returns literal empty array. | kept;  |
| src/test/phase8d.federated.test.ts:204 | returns null for single-project match | STRONG | STRONG | Single registered matching project produces null ambiguity. | kept;  |
| src/test/phase8d.federated.test.ts:229 | detects ambiguity across multiple projects | STRONG | STRONG | Two matching projects produce exact Alpha/Beta ambiguity candidates. | kept;  |
| src/test/phase8d.federated.test.ts:282 | generates a briefing with correct stats | STRONG | STRONG | Briefing has literal project name, count two, both categories and project summary text. | kept;  |
| src/test/phase8d.federated.test.ts:324 | returns null for non-existent project | STRONG | STRONG | Missing briefing project returns null. | kept;  |
| src/test/phase8d.federated.test.ts:329 | generateAllBriefings covers all projects | STRONG | STRONG | All-project briefing enumerates exactly AllA and AllB. | kept;  |
| src/test/phase8d.federated.test.ts:364 | federatedSearch finds memories across projects | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-federated-cross-project | rewritten; g2-federated-cross-project |
| src/test/phase8d.federated.test.ts:389 | working set returns only recent project memories | STRONG | STRONG | Working set returns exactly ws-recent and excludes old memory. | kept;  |
| src/test/phase8d.federated.test.ts:417 | formatWorkingSet handles empty set | STRONG | STRONG | Empty formatter emits No recent activity message. | kept;  |
| src/test/phase8d.federated.test.ts:422 | formatWorkingSet includes memory details | STRONG | STRONG | Nonempty formatter includes literal fmt-001 and Formatted Memory. | kept;  |
| src/test/phase9a.sandbox.test.ts:46 | ping returns ok with pid | STRONG | Pending | Real ping handler returns ok true and literal status ok. | pending;  |
| src/test/phase9a.sandbox.test.ts:53 | add creates a memory and returns id + title | WEAK | Pending | Add response has mem-prefixed ID/title but test never reads the memory it claims to create. | pending;  |
| src/test/phase9a.sandbox.test.ts:69 | add with minimal params auto-generates title | STRONG | Pending | Minimal add input produces literal auto-title Short note about testing. | pending;  |
| src/test/phase9a.sandbox.test.ts:80 | add without content returns error | STRONG | Pending | Missing add content returns ok false and content is required error. | pending;  |
| src/test/phase9a.sandbox.test.ts:90 | recall returns results for matching query | WEAK | Pending | Recall on seeded data checks only ok and array type, accepting empty/unrelated results. | pending;  |
| src/test/phase9a.sandbox.test.ts:112 | recall without query returns error | STRONG | Pending | Recall without query returns ok false and literal query is required error. | pending;  |
| src/test/phase9a.sandbox.test.ts:122 | get retrieves a specific memory | STRONG | Pending | Add then get returns literal Test memory for get content through real handler. | pending;  |
| src/test/phase9a.sandbox.test.ts:139 | get with invalid id returns error | STRONG | Pending | Unknown memory ID returns ok false and not found error. | pending;  |
| src/test/phase9a.sandbox.test.ts:149 | list returns memories | WEAK | Pending | List only asserts at least two rows, allowing duplicates and wrong contents. | pending;  |
| src/test/phase9a.sandbox.test.ts:171 | list filters by category | WEAK | Pending | Category list checks every(row.category), which vacuously passes for an empty array. | pending;  |
| src/test/phase9a.sandbox.test.ts:193 | stats returns database statistics | WEAK | Pending | Stats checks field presence and total at least 1, allowing incorrect counts/categories. | pending;  |
| src/test/phase9a.sandbox.test.ts:217 | unknown method returns error | STRONG | Pending | Unknown sandbox method returns ok false and literal Unknown method error. | pending;  |
| src/test/phase9a.sandbox.test.ts:227 | response id matches request id | STRONG | Pending | Ping response echoes literal unique-test-id-42 correlation ID. | pending;  |
| src/test/phase9a.sandbox.test.ts:279 | client can ping the server | STRONG | Pending | Real socket client/server ping returns literal status ok. | pending;  |
| src/test/phase9a.sandbox.test.ts:286 | client can add and get a memory | STRONG | Pending | Socket add/get round trip returns Client test title and literal Client round-trip test memory content. | pending;  |
| src/test/phase9a.sandbox.test.ts:300 | client can list memories | WEAK | Pending | Socket list checks only length at least 2, without identities or bodies. | pending;  |
| src/test/phase9a.sandbox.test.ts:309 | client can get stats | WEAK | Pending | Socket stats checks only total at least 1. | pending;  |
| src/test/phase9a.sandbox.test.ts:317 | client isRunning returns true for running server | STRONG | Pending | Client isRunning returns true for an actual listening socket server. | pending;  |
| src/test/phase9a.sandbox.test.ts:322 | client isRunning returns false for bad socket | STRONG | Pending | Client isRunning returns false for a nonexistent socket. | pending;  |
| src/test/phase9a.sandbox.test.ts:331 | generates gnosys-helper.ts in the target directory | WEAK | Pending | Helper generation checks returned path and file existence without loading usable generated code. | pending;  |
| src/test/phase9a.sandbox.test.ts:337 | generated file contains the gnosys export | COUPLED | Pending | Reads generated helper source for export/method spelling without invoking it. | pending;  |
| src/test/phase9a.sandbox.test.ts:349 | generated file includes socket path logic | COUPLED | Pending | Searches generated source for socket-path function/name markers. | pending;  |
| src/test/phase9a.sandbox.test.ts:356 | generated file includes auto-start logic | COUPLED | Pending | Searches generated source for auto-start strings without starting a sandbox. | pending;  |
| src/test/phase9a.sandbox.test.ts:397 | added memory can be recalled by content query | STRONG | Pending | Real socket add/recall finds a record with the literal Database choice title for PostgreSQL. | pending;  |
| src/test/phase9a.sandbox.test.ts:413 | multiple adds and recall with limit | WEAK | Pending | Recall limit asserts only at most 3 results, so empty recall always passes. | pending;  |
| src/test/phase9a.sandbox.test.ts:428 | add with project_id scopes the memory | STRONG | Pending | Socket project-scoped add/list returns exactly one row with proj-123 project ID. | pending;  |
| src/test/phase9a.sandbox.test.ts:446 | reinforce increments count and confidence | STRONG | Pending | Real reinforce response increments count to 1 and confidence from 0.8 to approximately 0.85. | pending;  |
| src/test/phase9a.sandbox.test.ts:467 | reinforce by query finds and boosts the memory | STRONG | Pending | Query-based reinforce finds seeded memory and returns count 1 and confidence 0.75. | pending;  |
| src/test/phase9a.sandbox.test.ts:485 | reinforce caps confidence at 1.0 | WEAK | Pending | Confidence cap checks only at most 1; reducing confidence to zero also passes. | pending;  |
| src/test/phase9a.sandbox.test.ts:504 | getSandboxDir returns a path under ~/.gnosys | STRONG | Pending | Sandbox directory utility creates a real directory with documented .gnosys and sandbox path components. | pending;  |
| src/test/phase9a.sandbox.test.ts:511 | getSocketPath returns platform-appropriate path | STRONG | Pending | Public socket path contains the platform-specific pipe or gnosys.sock name. | pending;  |
| src/test/phase9a.sandbox.test.ts:520 | getPidPath returns path under sandbox dir | STRONG | Pending | Public PID path contains sandbox directory and gnosys.pid filename. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:47 | DreamScheduler starts and stops without error | WEAK | Pending | Scheduler start/stop only checks idle=false before stop; a no-op scheduler passes. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:63 | DreamScheduler recordActivity resets idle timer | MISLABELED | Pending | recordActivity resets idle timer claim only checks isDreaming=false without advancing time or observing a run. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:76 | initDreamMode creates a scheduler with correct state | WEAK | Pending | Dream initialization only checks scheduler non-null and calls stop. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:84 | dream_status returns state through sandbox protocol | WEAK | Pending | Sandbox status checks property names and false isDreaming but not enabled/idle/count values. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:99 | Dream engine reports errors when conditions not met | WEAK | Pending | Minimum-memory failure test accepts any nonempty string error. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:115 | pref_set creates a preference | STRONG | Pending | Sandbox pref_set returns literal commit-convention key and conventional commits value. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:127 | pref_get retrieves a preference | STRONG | Pending | Sandbox set/get roundtrip returns literal TypeScript strict mode. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:145 | pref_get returns error for nonexistent preference | STRONG | Pending | Missing sandbox preference returns ok=false with not-found error. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:155 | pref_list returns all preferences | WEAK | Pending | Preference listing requires >=2 and pref-a only; pref-b content can be lost or duplicated. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:178 | pref_delete removes a preference | STRONG | Pending | Sandbox delete returns deleted=true and subsequent get fails. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:202 | pref_set without key returns error | STRONG | Pending | Missing pref_set key returns required-field error. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:212 | preferences are stored as user-scoped memories | STRONG | Pending | Actual DB preference is user scope and preferences category. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:230 | sync method generates rules block with preferences | STRONG | Pending | Sandbox sync returns count two and both literal preference values in generated rules. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:260 | sync method includes project conventions | WEAK | Pending | Convention sync only checks conventionCount=1, not generated text or written file. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:287 | sync without project_dir returns error | STRONG | Pending | Missing project_dir returns required-field error. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:301 | add with scope: user creates user-scoped memory | STRONG | Pending | Sandbox add with user scope persists literal user scope. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:318 | add with scope: global creates global-scoped memory | STRONG | Pending | Sandbox add with global scope persists literal global scope. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:335 | add defaults to scope: project | STRONG | Pending | Sandbox add without scope persists literal project scope. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:382 | client can check dream status | COUPLED | Pending | Calls private SandboxClient.send via any and checks only isDreaming property existence. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:390 | client can set and list preferences | COUPLED | Pending | Calls private send for preference set/list and asserts only success plus length>=1. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:410 | injectRules creates new file with GNOSYS markers | STRONG | Pending | Reads real injected file for both GNOSYS markers and literal memory-system content. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:422 | injectRules preserves content outside GNOSYS block | STRONG | Pending | Reads injected file to verify original custom heading/body preserved and GNOSYS marker added. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:436 | injectRules replaces existing GNOSYS block | STRONG | Pending | Second injection replaces first value, preserves second, and keeps exactly one start marker. | pending;  |
| src/test/phase9b.dream-prefs-sync.test.ts:462 | injectRules with preferences includes preference content | STRONG | Pending | Written rules contain literal preference section and both supplied preference values. | pending;  |
| src/test/phase9c.cli-federated.test.ts:79 | project-scoped memories rank higher than user and global | STRONG | Pending | Real DB search returns three scopes in project/user/global order and literal project ID first. | pending;  |
| src/test/phase9c.cli-federated.test.ts:95 | results include scope and boost information | STRONG | Pending | Concrete project result includes current-project boost and positive score metadata. | pending;  |
| src/test/phase9c.cli-federated.test.ts:113 | without projectId context, project memories still rank by scope boost | STRONG | Pending | Without project context, real search still orders all three scopes project/user/global. | pending;  |
| src/test/phase9c.cli-federated.test.ts:162 | scopeFilter restricts results to specified scope | STRONG | Pending | User scope yields exactly mem-u1. | pending;  |
| src/test/phase9c.cli-federated.test.ts:172 | scopeFilter with multiple scopes returns matching results | STRONG | Pending | Project/global filter returns exactly two expected scopes and excludes user. | pending;  |
| src/test/phase9c.cli-federated.test.ts:184 | scopeFilter with empty array returns all results | STRONG | Pending | Empty scope filter returns all three seeded rows. | pending;  |
| src/test/phase9c.cli-federated.test.ts:193 | includeGlobal=false excludes global when no scopeFilter | STRONG | Pending | includeGlobal=false returns two records and excludes global scope. | pending;  |
| src/test/phase9c.cli-federated.test.ts:203 | scopeFilter takes precedence over includeGlobal | STRONG | Pending | Explicit global scope overrides includeGlobal=false and returns sole global row. | pending;  |
| src/test/phase9c.cli-federated.test.ts:242 | federatedDiscover returns results with scope info | WEAK | STRONG | Literal observable result now rejects mislabel every discovered memory scope. | rewritten; G1-discover-scopes |
| src/test/phase9c.cli-federated.test.ts:252 | federatedDiscover respects scopeFilter | STRONG | Pending | User-only discovery returns one literal user-scoped result. | pending;  |
| src/test/phase9c.cli-federated.test.ts:296 | recent memories get recency boost | STRONG | Pending | Recent marker belongs to recent-mem and is absent from old-mem. | pending;  |
| src/test/phase9c.cli-federated.test.ts:328 | gnosys list --json produces valid JSON | WEAK | STRONG | Literal observable result now rejects report wrong list count. | rewritten; G1-cli-list |
| src/test/phase9c.cli-federated.test.ts:335 | gnosys search --json produces valid JSON with results array | WEAK | STRONG | Literal observable result now rejects return no matching search records. | rewritten; G1-cli-search |
| src/test/phase9c.cli-federated.test.ts:354 | gnosys stats --json produces valid JSON | WEAK | STRONG | Literal observable result now rejects report incorrect empty memory count. | rewritten; G1-cli-stats |
| src/test/phase9c.cli-federated.test.ts:360 | gnosys status --system --json produces valid JSON | WEAK | STRONG | Literal observable result now rejects replace system dashboard with empty object. | rewritten; G1-cli-dashboard |
| src/test/phase9c.cli-federated.test.ts:382 | gnosys --help lists all commands | MISLABELED | STRONG | Literal observable result now rejects remove advertised sandbox command. | rewritten; G1-cli-help-public |
| src/test/phase9c.cli-federated.test.ts:401 | gnosys search --help shows --federated and --scope flags | STRONG | Pending | Real search --help exposes literal federated and scope flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:407 | gnosys discover --help shows --federated and --scope flags | STRONG | Pending | Real discover --help exposes literal federated and scope flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:413 | gnosys recall --help shows --federated and --scope flags | STRONG | Pending | Real recall --help exposes literal federated and scope flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:419 | gnosys hybrid-search --help shows --federated, --scope, and --json flags | STRONG | Pending | Real hybrid-search --help exposes literal federated/scope/json flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:426 | gnosys ask --help shows --federated and --scope flags | STRONG | Pending | Real ask --help exposes literal federated and scope flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:432 | gnosys fsearch --help shows --scope flag | STRONG | Pending | Real fsearch --help exposes literal scope flag. | pending;  |
| src/test/phase9c.cli-federated.test.ts:437 | gnosys add-structured --help shows --user and --global flags | STRONG | Pending | Real add-structured --help exposes literal user and global flags. | pending;  |
| src/test/phase9c.cli-federated.test.ts:443 | gnosys audit --json outputs valid JSON | WEAK | STRONG | Literal observable result now rejects discard actual audit entries. | rewritten; G1-cli-audit |
| src/test/phase9c.cli-federated.test.ts:449 | gnosys tags lists the tag registry without error | WEAK | STRONG | Literal observable result now rejects omit category headings. | rewritten; G1-cli-tags |
| src/test/phase9c.cli-federated.test.ts:459 | gnosys lens runs without error | WEAK | STRONG | Literal observable result now rejects suppress empty lens result. | rewritten; G1-cli-lens |
| src/test/phase9d.coverage-overhaul.test.ts:98 | search() returns FTS5 results as SearchResult format | STRONG | Pending | Real DB search maps authentication hit to literal relative_path search-1. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:108 | discover() returns FTS5 results as DiscoverResult format | WEAK | Pending | Discover asserts nonempty rows and property presence without verifying the database hit identity or title. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:117 | hybridSearch() keyword mode returns ranked results | WEAK | Pending | Keyword hybrid search checks shape/source/archive flag but no result identity or score expectation. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:127 | hybridSearch() falls back to keyword when no embeddings | WEAK | Pending | Hybrid fallback only asserts nonempty keyword-tagged rows, not the requested matching identity. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:136 | hybridSearch() semantic mode returns empty when no embeddings | STRONG | Pending | Semantic mode with no embeddings returns literal empty result array. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:141 | loadContent() fills in full content from DB | STRONG | Pending | Content loader returns the actual seeded JWT tokens body in fullContent. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:156 | getMemory() returns a memory by ID | STRONG | Pending | ID lookup returns literal Authentication with JWT tokens title. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:162 | getMemory() returns null for unknown ID | STRONG | Pending | Unknown memory ID returns literal null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:167 | hasEmbeddings() returns false when no embeddings stored | STRONG | Pending | Database with no embedding records reports hasEmbeddings false. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:171 | embeddingCount() returns 0 when no embeddings stored | STRONG | Pending | Database with no embeddings reports exact embedding count 0. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:175 | search respects limit parameter | WEAK | Pending | Search limit only requires at most 3 hits despite many matching records, so no results pass. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:202 | syncMemoryToDb inserts a memory from frontmatter | STRONG | Pending | Frontmatter sync persists literal title, body, confidence 0.85, source path and active tier. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:223 | syncMemoryToDb handles array tags correctly | STRONG | Pending | Array tags persist as exact tag1/tag2/tag3 JSON array. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:236 | syncMemoryToDb handles object tags by flattening | STRONG | Pending | Object tag groups flatten into persisted ai, testing and unit-test tag values. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:251 | syncMemoryToDb sets tier=archive for archived status | STRONG | Pending | Archived frontmatter status produces persisted archive tier. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:262 | syncMemoryToDb accepts projectId and scope | STRONG | Pending | Sync receives explicit project/scope and persists proj-123 with user scope. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:271 | syncUpdateToDb updates partial fields | STRONG | Pending | Partial sync update persists Updated Title and confidence 0.7. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:285 | syncUpdateToDb updates content and hash | WEAK | Pending | Updated body is literal but hash check only differs from old-hash, accepting an invalid constant. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:299 | syncArchiveToDb sets tier and status to archive | STRONG | Pending | Archive sync persists both archive tier and archived status. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:309 | syncDearchiveToDb restores tier and status to active | STRONG | Pending | Dearchive sync restores both active tier and active status. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:319 | syncDeleteToDb removes memory from DB | STRONG | Pending | Delete sync removes a previously observable DB memory. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:327 | syncReinforcementToDb updates count and timestamp | STRONG | Pending | Reinforcement sync persists exact count 3 and a nonnull reinforcement timestamp. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:337 | syncConfidenceToDb updates confidence | STRONG | Pending | Confidence sync persists exact 0.45 confidence. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:346 | auditToDb logs an audit entry without throwing | WEAK | Pending | Audit sync only asserts not.toThrow; despite its comment it never reads SQL or audit entries. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:375 | initAudit creates audit.jsonl and subsequent logs are readable | STRONG | Pending | Real append/read audit preserves three ordered operations, literal query/memory ID and duration 12.5. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:395 | readAuditLog returns empty array when no log exists | STRONG | Pending | Reading an absent audit log returns literal []. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:405 | readAuditLog filters by operation | STRONG | Pending | Operation filter returns exactly two entries and every operation is search. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:419 | readAuditLog filters by limit (most recent) | STRONG | Pending | Audit limit returns exactly last three entries with literal boundary queries q7 and q9. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:435 | readAuditLog handles malformed lines gracefully | WEAK | Pending | Malformed-line test checks only two retained entries, allowing corrupted/replaced valid entries. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:447 | formatAuditTimeline groups by date with summary | STRONG | Pending | Timeline rendering includes exact operation count/date and search 2/write 1 summary. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:464 | formatAuditTimeline handles empty entries | STRONG | Pending | Empty timeline emits literal No audit entries found text. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:483 | acquireWriteLock creates lock file and release removes it | STRONG | Pending | Real lock file contains current PID/test-op and disappears after release. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:496 | acquireWriteLock detects stale lock from dead process | STRONG | Pending | Dead-PID lock is replaced with current PID and new-op metadata. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:520 | acquireWriteLock detects stale lock from old timestamp | STRONG | Pending | Old-timestamp lock is replaced with fresh-op metadata. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:540 | release function is idempotent | WEAK | Pending | Second release checks only no throw and never proves another acquisition is possible or file gone. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:547 | creates .config directory if it doesn't exist | STRONG | Pending | Acquiring a lock creates the previously absent .config directory. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:571 | createProjectIdentity creates identity file and returns it | WEAK | Pending | Identity creation asserts returned fields/ID length but never reads the file it claims to create. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:582 | createProjectIdentity reuses existing projectId | WEAK | Pending | Identity reuse compares IDs produced by the same function and only checks renamed name. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:590 | readProjectIdentity reads valid identity | STRONG | Pending | Actual created identity rereads literal Readable project name. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:598 | readProjectIdentity returns null for missing file | STRONG | Pending | Missing identity file returns literal null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:608 | readProjectIdentity returns null for invalid JSON | STRONG | Pending | Invalid identity JSON returns literal null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:615 | readProjectIdentity returns null for missing required fields | STRONG | Pending | Identity missing projectName/workingDirectory returns literal null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:622 | checkDirectoryMismatch detects when directory has moved | STRONG | Pending | Rewritten old working directory yields mismatch true and actual current absolute directory. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:635 | checkDirectoryMismatch returns false when directory matches | STRONG | Pending | Identity matching its present directory yields mismatch false. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:641 | checkDirectoryMismatch returns false with no identity | STRONG | Pending | No identity yields mismatch false and identity null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:652 | findProjectIdentity walks up directory tree | STRONG | Pending | Lookup from nested a/b/c resolves literal Root name and the correct parent root path. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:665 | findProjectIdentity returns null at filesystem root | WEAK | Pending | Filesystem-root lookup accepts either null or any object with identity, so wrong ancestors pass. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:678 | detectAgentRulesTarget returns null when no IDE markers present | STRONG | Pending | No IDE marker returns literal null target. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:683 | detectAgentRulesTarget detects .cursor directory | STRONG | Pending | A real .cursor directory selects exact .cursor/rules/gnosys.mdc target. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:689 | detectAgentRulesTarget detects CLAUDE.md file | STRONG | Pending | A real CLAUDE.md file selects exact CLAUDE.md target. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:695 | createProjectIdentity registers in central DB when provided | STRONG | Pending | Identity creation with central DB persists one project with returned ID and literal CentralProject name. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:724 | memories from different projects are isolated by project_id | MISLABELED | Pending | Claims project isolation but reads all memories then filters them inside the test; no application isolation query runs. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:745 | FTS search finds memories across all projects | STRONG | Pending | Real FTS query finds a seeded ProjectX title among cross-project data. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:757 | projects table tracks all registered projects | STRONG | Pending | Registry returns exactly three literal project names One/Three/Two. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:769 | updating a project works correctly | STRONG | Pending | Project update persists /new/path while retaining Original name. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:780 | projects remain in registry after insertion | STRONG | Pending | Project registry retains exactly one record with literal Persistent name. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:791 | makeMemory() generates unique IDs on each call | HOLLOW | Pending | Structural absence: only test fixture makeMemory IDs are compared; no production memory operation executes. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:797 | makeMemory() applies overrides correctly | HOLLOW | Pending | Structural absence: verifies overrides assigned by test fixture makeMemory without production behavior. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:813 | makeMemory() has sensible defaults | HOLLOW | Pending | Structural absence: pins literal defaults created by test fixture makeMemory. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:825 | makeProject() generates unique IDs on each call | HOLLOW | Pending | Structural absence: only test fixture makeProject IDs are compared. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:831 | makeProject() applies overrides correctly | HOLLOW | Pending | Structural absence: verifies test fixture makeProject overrides and default user. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:844 | makeFrontmatter() applies overrides correctly | HOLLOW | Pending | Structural absence: verifies test fixture makeFrontmatter values/defaults only. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:857 | createTestEnv provides working DB | WEAK | Pending | Test environment smoke only checks DB availability and temp path existence, without a stored/read value. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:868 | cleanupTestEnv removes temp directory | MISLABELED | Pending | Only verifies test cleanup helper removes its directory, not an application feature. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:875 | seedMultiProjectMemories creates expected memory layout | MISLABELED | Pending | Checks the test seed helper's manufactured record layout rather than an application seeding feature. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:909 | loadGraph returns null when no graph.json exists | STRONG | Pending | Missing graph.json returns literal null. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:914 | loadGraph reads a valid graph.json | WEAK | Pending | Graph reader checks only counts 2/2/2, allowing incorrect node identities and edge endpoints. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:947 | formatGraphStats produces readable output | STRONG | Pending | Graph stats output contains literal 15 nodes, 28 edges, 3 orphans, 2 unresolved links and Hub Node with 10 edges. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:966 | formatGraphStats handles null mostConnected | STRONG | Pending | Empty graph stats show Nodes: 0 and omit nonexistent most-connected entry. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:985 | enableWAL does not throw on mock DB | HOLLOW | Pending | No-op pragma fake plus not.toThrow cannot observe whether enableWAL issues any pragma. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:992 | enableWAL handles errors gracefully | WEAK | Pending | Failing pragma fake checks only swallowed error and no actual fallback/observable database state. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:1015 | gnosys stats --json reports memory count for initialized project | WEAK | Pending | CLI stats only checks numeric nonnegative count, accepting any positive wrong total. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:1022 | gnosys list --json reports memories array for initialized project | WEAK | Pending | CLI list compares count to its own array length and shape, with no independent expected memories. | pending;  |
| src/test/phase9d.coverage-overhaul.test.ts:1029 | gnosys audit --json reports empty entries for fresh project | WEAK | Pending | Fresh audit JSON assertion checks entries key presence only, not empty contents. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:44 | opens a DB successfully on a valid path (no retries needed) | STRONG | Pending | Actual SQLite constructor reports available on valid path. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:55 | opens a DB with explicit retry options (retries: 0) | STRONG | Pending | Constructor with retries zero reports actual available DB. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:66 | opens a DB with network-like retry options (5 retries, 100ms delay) | MISLABELED | Pending | Passing retry options to a successful first attempt does not exercise network retry behavior. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:77 | returns unavailable when Database module is absent (constructor guard) | MISLABELED | Pending | Test name claims absent Database but installed Database is used and availability true is asserted. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:96 | default retry count is 3 (no opts) | MISLABELED | Pending | Test claims default retry count three but creates successful DB and counts no retries. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:108 | creates directory recursively if needed | STRONG | Pending | Constructor creates nested directory and actual gnosys.db with available=true. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:125 | handleRequest ping works with normal DB | STRONG | Pending | Sandbox ping returns literal ok status through actual handler. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:131 | handleRequest add+recall round-trip on standard path | WEAK | Pending | Add/recall only checks ok flags; empty recall or wrong memory body passes. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:151 | db.backup creates a backup file | WEAK | Pending | Backup test only checks path and file existence, so empty invalid backup passes. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:164 | backup + restore round-trip preserves data | STRONG | Pending | After original DB deletion, restored backup returns original count and literal Round Trip Memory title. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:198 | backup supports custom destination directory | WEAK | Pending | Custom backup destination test verifies existing file/path prefix but not backup usability. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:219 | SandboxStatus type has all expected fields | HOLLOW | Pending | Asserts values of a local SandboxStatus object literal; production runtime is never called. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:235 | SandboxStatus dbPath is optional | HOLLOW | Pending | Asserts a local {running:false} object has no dbPath; only erased type is imported. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:245 | new GnosysDB sets busy_timeout to 10000 | HOLLOW | Pending | Pragma assertion is doubly conditional on DB availability/nonempty result, so unavailable DB executes none. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:267 | has required running field | HOLLOW | Pending | Asserts own local fixture has running property; no production function runs. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:272 | supports all optional fields | HOLLOW | Pending | Asserts keys of locally constructed fixture; no production function runs. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:289 | backup --json outputs valid JSON | HOLLOW | Pending | Broad catch swallows command and assertion failures, then checks error message is defined. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:316 | README.md exists and contains key content | STRONG | Pending | Public README artifact contains four literal documented feature headings. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:327 | CONTRIBUTING.md exists | WEAK | Pending | Contributor documentation test checks only file existence, permitting empty unusable content. | pending;  |
| src/test/phase9e.network-share-polish.test.ts:331 | package.json version starts with 4. | MISLABELED | Pending | Name claims version starts with 4 but assertion permits any numeric semver prefix. | pending;  |
| src/test/pref-command-handler.test.ts:13 | wires pref subcommands to handlers via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/pref-command-handler.test.ts:35 | exports pref handlers with preference markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/pref-invoke.test.ts:41 | sets a known preference key and echoes key/value | WEAK | Pending | Set command checks echoed key/value and success status but never rereads persisted preference in this declaration. | pending;  |
| src/test/pref-invoke.test.ts:50 | reads the stored preference back | STRONG | Pending | Real get command emits conventional-commits from prior suite state. | pending;  |
| src/test/pref-invoke.test.ts:56 | rejects a near-miss key with a suggestion and exitCode 1 | STRONG | Pending | Near-miss key emits did you mean and sets exit code 1. | pending;  |
| src/test/preference-key-validation.test.ts:9 | returns null for an exact known key | STRONG | Pending | Exact known preference keys code-style and commit-convention produce no suggestion. | pending;  |
| src/test/preference-key-validation.test.ts:14 | returns the closest known key for a close typo | STRONG | Pending | Concrete typos resolve to literal commit-convention and code-style suggestions. | pending;  |
| src/test/preference-key-validation.test.ts:19 | returns null for a far custom key (allowed through) | STRONG | Pending | Distant custom keys return literal null and remain allowed. | pending;  |
| src/test/preferences.test.ts:23 | sets and gets a preference | STRONG | Pending | Real preference roundtrip returns exact key/value and generated title. | pending;  |
| src/test/preferences.test.ts:32 | auto-generates title from key | STRONG | Pending | Hyphenated code-style key generates literal Code Style title. | pending;  |
| src/test/preferences.test.ts:38 | allows custom title | STRONG | Pending | Custom title persists as literal My Code Style. | pending;  |
| src/test/preferences.test.ts:44 | stores as user-scoped memory | STRONG | Pending | Persisted preference row has user scope, preferences category and null project. | pending;  |
| src/test/preferences.test.ts:53 | updates existing preference (increments reinforcement) | STRONG | Pending | Repeated set changes stored content to value2 and increments reinforcement from zero to one. | pending;  |
| src/test/preferences.test.ts:64 | lists all preferences | STRONG | Pending | Preference enumeration returns exactly a-pref/b-pref/c-pref. | pending;  |
| src/test/preferences.test.ts:74 | deletes a preference | STRONG | Pending | Delete returns true and subsequent preference lookup is null. | pending;  |
| src/test/preferences.test.ts:83 | returns false when deleting nonexistent preference | STRONG | Pending | Deleting nonexistent preference returns false. | pending;  |
| src/test/preferences.test.ts:88 | stores tags on preference | STRONG | Pending | Persisted preference tags equal literal git/workflow list. | pending;  |
| src/test/preferences.test.ts:96 | generates base instructions with no preferences | STRONG | Pending | Empty rules contain base title/discover instruction and omit preference heading. | pending;  |
| src/test/preferences.test.ts:104 | includes preferences in generated block | STRONG | Pending | Generated preference rules contain literal section/titles and conventional-commits value. | pending;  |
| src/test/preferences.test.ts:117 | includes project conventions in generated block | STRONG | Pending | Generated convention rules contain Project conventions and literal Use PostgreSQL title. | pending;  |
| src/test/preferences.test.ts:140 | creates new file with GNOSYS block | STRONG | Pending | New written rules contain both markers around literal Test content. | pending;  |
| src/test/preferences.test.ts:150 | replaces existing GNOSYS block | STRONG | Pending | Block replacement changes old to new content while retaining user text on both sides. | pending;  |
| src/test/preferences.test.ts:173 | preserves user content outside GNOSYS block | STRONG | Pending | Protected-block injection preserves both literal surrounding user instructions and inserts update. | pending;  |
| src/test/preferences.test.ts:195 | appends GNOSYS block to existing file without one | STRONG | Pending | Appending a new block preserves existing heading/text and includes literal appended content. | pending;  |
| src/test/preferences.test.ts:208 | creates parent directories for new rules file | STRONG | Pending | Nested .cursor/rules path is created and actual file includes supplied Cursor rules. | pending;  |
| src/test/preferences.test.ts:218 | generates rules from preferences in DB | STRONG | Pending | DB-to-file rules sync reports two preferences/created and file contains both literal values. | pending;  |
| src/test/preferences.test.ts:235 | returns null when no agent rules target | STRONG | Pending | No target rules file produces null result. | pending;  |
| src/test/progress.test.ts:9 | returns a no-op progress instance when verbose is false | WEAK | STRONG | Literal observable result now rejects emit unwanted stderr in quiet mode. | rewritten; G1-progress-noop |
| src/test/progress.test.ts:20 | emits header, step, and done lines when verbose is true | STRONG | Pending | Verbose reporter emits actual captured stderr with literal header, step and completion text. | pending;  |
| src/test/projects-command-handler.test.ts:13 | wires projects to runProjectsCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/projects-command-handler.test.ts:26 | exports runProjectsCommand with projects markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/provenance-trace.test.ts:69 | gnosys read surfaces source_file, source_page, and source_path | STRONG | Pending | Real CLI read exits zero and prints literal report.pdf page 3 and /tmp/report.pdf provenance. | pending;  |
| src/test/provenance-trace.test.ts:87 | ingest audit row links source_file for provenance walk | STRONG | Pending | Public audit write/read roundtrip persists source_file report.pdf and count one linked to stored memory provenance. | pending;  |
| src/test/read-command-handler.test.ts:13 | wires read to runReadCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/read-command-handler.test.ts:22 | exports runReadCommand with DB-first and resolver fallback markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/read-command-overlay.test.ts:20 | routes read-by-id through the client read overlay like its siblings | COUPLED | STRONG | Literal observable result now rejects lose pending offline content in public read response. | rewritten; G1-read-overlay-cli |
| src/test/read-command-overlay.test.ts:28 | keeps the legacy resolver fallback for markdown stores | COUPLED | STRONG | Literal observable result now rejects lose fallback markdown content. | rewritten; G1-read-legacy |
| src/test/read-command-overlay.test.ts:58 | falls back to the pending overlay when the DB misses | STRONG | STRONG | Literal observable result now rejects lose pending memory body. | rewritten; G1-overlay-content |
| src/test/read-command-overlay.test.ts:70 | returns null when neither DB nor overlay has the id | STRONG | STRONG | Literal observable result now rejects return unrelated pending memory for missing id. | rewritten; G1-overlay-id |
| src/test/read-invoke.test.ts:82 | prints the memory with frontmatter header and body (human) | STRONG | Pending | Real command reads seeded DB and emits exact ID/title/body in human output. | pending;  |
| src/test/read-invoke.test.ts:91 | emits structured JSON for the memory (--json) | STRONG | Pending | Real JSON output contains exact path/source/memory ID and seeded body. | pending;  |
| src/test/recall-command-handler.test.ts:13 | wires recall to runRecallCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/recall-command-handler.test.ts:25 | exports runRecallCommand with federated and legacy audit markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/recall-hook.test.ts:21 | extracts prompt_text from UserPromptSubmit events | STRONG | STRONG | UserPromptSubmit JSON parses to literal auth JWT tokens query. | kept;  |
| src/test/recall-hook.test.ts:27 | accepts the legacy `prompt` field name | STRONG | STRONG | Legacy prompt field parses to literal database migration query. | kept;  |
| src/test/recall-hook.test.ts:31 | SessionStart events (no prompt) become wildcard | STRONG | STRONG | SessionStart without prompt yields literal wildcard *. | kept;  |
| src/test/recall-hook.test.ts:35 | non-JSON and empty stdin become wildcard | STRONG | STRONG | Empty/malformed/whitespace prompt input all yield literal wildcard *. | kept;  |
| src/test/recall-hook.test.ts:41 | truncates very long prompts | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; recall-empty-truncation |
| src/test/recall-hook.test.ts:63 | installs SessionStart AND UserPromptSubmit hooks running gnosys recall-hook | STRONG | STRONG | Actual Claude settings contain recall-hook for both events and no prompt matcher. | kept;  |
| src/test/recall-hook.test.ts:76 | heals the broken pre-5.14 hook command in place | STRONG | STRONG | Existing broken recall options are removed and both real settings events reference recall-hook. | kept;  |
| src/test/recall-hook.test.ts:109 | is idempotent and preserves foreign hooks | STRONG | STRONG | Second install leaves identical settings, retains foreign hook/permissions, and writes exactly one gnosys prompt entry. | kept;  |
| src/test/recall-wildcard.test.ts:65 | recall("*") returns top active memories instead of nothing (the v4.0.0 bug) | STRONG | Pending | Wildcard real-DB recall returns exact three active IDs in literal order. | pending;  |
| src/test/recall-wildcard.test.ts:71 | wildcard ordering prefers reinforcement, then confidence, then recency | MISLABELED | STRONG | Literal observable result now rejects reverse confidence tie break. | rewritten; G1-recall-confidence, G1-recall-recency |
| src/test/recall-wildcard.test.ts:77 | archived and superseded memories are excluded from wildcard recall | WEAK | STRONG | Literal observable result now rejects return no active memories. | rewritten; G1-recall-empty |
| src/test/recall-wildcard.test.ts:84 | formatRecall emits a real <gnosys-recall> block, not the no-op string | STRONG | Pending | Real recall renders gnosys-recall block with literal wild-top citation and excludes no-op marker. | pending;  |
| src/test/recall-wildcard.test.ts:92 | pure-punctuation queries behave like wildcard | STRONG | Pending | Punctuation wildcard returns exact active count three. | pending;  |
| src/test/recall-wildcard.test.ts:97 | respects the limit option | STRONG | Pending | Limit two truncates five seeded records to exact two active results. | pending;  |
| src/test/recall-wildcard.test.ts:108 | non-aggressive mode keeps wildcard results (scores floored above minRelevance) | STRONG | Pending | Non-aggressive wildcard returns exact three active memories above threshold. | pending;  |
| src/test/recall-wildcard.test.ts:119 | real keyword recall is unchanged (regression guard) | STRONG | Pending | Keyword recall includes literal wild-mid ID. | pending;  |
| src/test/recall-wildcard.test.ts:130 | polluted state (count 5 vs 1200 memories, today's watermark) is dreamworthy via count delta | STRONG | Pending | Count-delta self-healing returns literal 1195 despite fresh watermark. | pending;  |
| src/test/recall-wildcard.test.ts:139 | date watermark still wins when it reports more change | STRONG | Pending | Newer modified timestamps yield literal ten changes. | pending;  |
| src/test/recall-wildcard.test.ts:148 | no stored count means no delta signal (fresh state relies on the date path) | STRONG | Pending | Fresh watermark-free state returns literal fifty changes. | pending;  |
| src/test/recall-wildcard.test.ts:155 | accurate state with no changes is not dreamworthy | STRONG | Pending | Accurate unchanged state returns literal zero. | pending;  |
| src/test/recall-wildcard.test.ts:164 | bulk deletion also counts as change | STRONG | Pending | Deleting sixty records yields literal sixty changes. | pending;  |
| src/test/reflect-command-handler.test.ts:13 | wires reflect to runReflectCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/reflect-command-handler.test.ts:26 | exports runReflectCommand with reflect markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/registry-temp-pollution.test.ts:40 | lives under $GNOSYS_HOME/config when GNOSYS_HOME is set | STRONG | Pending | Registry path with GNOSYS_HOME resolves to literal isolated config/projects.json. | pending;  |
| src/test/registry-temp-pollution.test.ts:49 | GNOSYS_CONFIG_DIR still wins over GNOSYS_HOME | STRONG | Pending | Explicit config directory wins over simultaneous GNOSYS_HOME override. | pending;  |
| src/test/registry-temp-pollution.test.ts:58 | defaults to ~/.config/gnosys without overrides | STRONG | Pending | No override resolves to literal fake HOME/.config/gnosys/projects.json. | pending;  |
| src/test/registry-temp-pollution.test.ts:70 | classifies temp locations | STRONG | Pending | Concrete Unix/macOS temp prefixes classify true while durable Users/Volumes projects classify false. | pending;  |
| src/test/registry-temp-pollution.test.ts:83 | skips temp paths when the registry is the real (non-isolated) one | STRONG | Pending | Default registry refuses temp project then persists exact durable project path. | pending;  |
| src/test/registry-temp-pollution.test.ts:105 | allows temp paths when GNOSYS_HOME isolates the registry | STRONG | Pending | Isolated registry writes exact temporary project path to its real JSON file. | pending;  |
| src/test/reindex-command-handler.test.ts:13 | wires reindex to runReindexCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/reindex-command-handler.test.ts:21 | exports runReindexCommand with reindex markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/reindex-graph-command-handler.test.ts:13 | wires reindex-graph to runReindexGraphCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/reindex-graph-command-handler.test.ts:21 | exports runReindexGraphCommand with reindex-graph markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/reindex-graph-invoke.test.ts:73 | rebuilds the graph and prints stats for a project store | WEAK | Pending | Graph rebuild case checks only nonempty stdout and no errors, with no graph artifact or literal stats. | pending;  |
| src/test/reindex-graph-invoke.test.ts:81 | is idempotent — a second run also succeeds | WEAK | Pending | Idempotency case invokes command only once in its body and checks any log call, relying on previous test state. | pending;  |
| src/test/reinforce-command-handler.test.ts:13 | wires reinforce to runReinforceCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/reinforce-command-handler.test.ts:23 | exports runReinforceCommand with reinforce markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/remote-audit-sync.test.ts:41 | push copies local audit entries to remote | STRONG | Pending | Push persists two actual remote audit rows with exact read/write operations. | pending;  |
| src/test/remote-audit-sync.test.ts:70 | pull copies remote-only audit entries to local | STRONG | Pending | Pull reports one and local DB contains literal dream_complete plus remote_pull operations. | pending;  |
| src/test/remote-audit-sync.test.ts:91 | does not double-push entries already on the remote | WEAK | STRONG | Literal observable result now rejects report audit push counts while dropping actual audit records. | rewritten; G1-audit-idempotent-write |
| src/test/remote-audit-sync.test.ts:109 | first push sends ALL local entries regardless of remote contents (full convergence) | WEAK | STRONG | Literal observable result now rejects lose audit memory ids while retaining push count. | rewritten; G1-audit-convergence |
| src/test/remote-audit-sync.test.ts:153 | full sync (push + pull) merges audit entries from both sides | WEAK | STRONG | Literal observable result now rejects lose remote audit operation while retaining row count. | rewritten; G1-audit-merge |
| src/test/remote-coverage.test.ts:94 | applies merged content to both sides | STRONG | Pending | Merge resolution persists literal Merged title in both DBs and clears conflict. | pending;  |
| src/test/remote-coverage.test.ts:107 | rejects merged without mergedMemory payload | STRONG | Pending | Missing merge payload yields ok=false and exact Invalid choice: merged. | pending;  |
| src/test/remote-coverage.test.ts:116 | rejects invalid choice strings | STRONG | Pending | Invalid choice yields ok=false and exact sideways error. | pending;  |
| src/test/remote-coverage.test.ts:125 | returns error when remote is not reachable | STRONG | Pending | Unreachable remote resolution yields literal Remote not reachable. | pending;  |
| src/test/remote-coverage.test.ts:133 | returns error when memory exists on neither side | STRONG | Pending | Missing memory on both sides yields ok=false and memory-not-found diagnostic. | pending;  |
| src/test/remote-coverage.test.ts:139 | returns insert error when localDb.insertMemory throws | STRONG | Pending | Injected insert failure propagates literal insert-fail error through resolve result. | pending;  |
| src/test/remote-coverage.test.ts:157 | copies projects and memories and sets last sync on success | WEAK | Pending | Migration success checks copied count and non-null rows but not field preservation. | pending;  |
| src/test/remote-coverage.test.ts:171 | returns error when remote is not reachable | STRONG | Pending | Unreachable migration yields ok=false, copied zero and exact reachability error. | pending;  |
| src/test/remote-coverage.test.ts:180 | continues when one project insert fails | STRONG | Pending | Failed project insert is reported by ID and unrelated memory persists. | pending;  |
| src/test/remote-coverage.test.ts:195 | continues when one memory insert fails | STRONG | Pending | Failed memory insert is reported by ID and another memory persists. | pending;  |
| src/test/remote-coverage.test.ts:211 | uses HOSTNAME env var for new ids | STRONG | Pending | HOSTNAME produces literal myhost- ID prefix. | pending;  |
| src/test/remote-coverage.test.ts:221 | falls back to COMPUTERNAME when HOSTNAME is unset | STRONG | Pending | COMPUTERNAME fallback produces literal winbox- prefix. | pending;  |
| src/test/remote-coverage.test.ts:232 | falls back to os.hostname when env vars are unset | STRONG | Pending | OS hostname fallback produces literal os-host- prefix. | pending;  |
| src/test/remote-coverage.test.ts:244 | returns unknown- prefix when os.hostname throws | STRONG | Pending | Hostname failure produces literal unknown- prefix. | pending;  |
| src/test/remote-coverage.test.ts:258 | self-heals stale unknown- id and dream_machine_id | STRONG | Pending | Stale unknown ID changes to real-host and persisted machine/dream IDs match new ID. | pending;  |
| src/test/remote-coverage.test.ts:272 | keeps stale unknown- id when hostname still cannot resolve | STRONG | Pending | Unresolved hostname preserves exact unknown-abc123 ID. | pending;  |
| src/test/remote-coverage.test.ts:287 | returns stable cached non-stale id unchanged | STRONG | Pending | Cached non-stale ID remains literal good-host-abc123. | pending;  |
| src/test/remote-coverage.test.ts:297 | does not treat host-abc123 as stale unknown id | STRONG | Pending | Ordinary host-abc123 ID remains unchanged. | pending;  |
| src/test/remote-coverage.test.ts:309 | returns friendly message on SQLITE_BUSY | STRONG | Pending | Injected SQLite busy failure produces concrete Remote DB busy status message. | pending;  |
| src/test/remote-coverage.test.ts:320 | rethrows non-busy sqlite errors | STRONG | Pending | Non-busy corruption propagates literal corrupt error. | pending;  |
| src/test/remote-coverage.test.ts:332 | formats not configured | STRONG | Pending | Unconfigured status renders explicit not-configured text. | pending;  |
| src/test/remote-coverage.test.ts:345 | formats unreachable path | STRONG | Pending | Unreachable status renders exact /x path. | pending;  |
| src/test/remote-coverage.test.ts:359 | includes conflict count | STRONG | Pending | Two conflicts render literal Conflicts: 2. | pending;  |
| src/test/remote-coverage.test.ts:376 | includes custom message line | STRONG | Pending | Custom status field renders literal Status: custom. | pending;  |
| src/test/remote-coverage.test.ts:393 | warns when directory is created | STRONG | Pending | Validating absent destination returns created-directory warning after filesystem creation. | pending;  |
| src/test/remote-coverage.test.ts:401 | warns on high sqlite probe latency | STRONG | Pending | Clock-controlled slow SQLite probe emits High latency warning. | pending;  |
| src/test/remote-coverage.test.ts:413 | reports sqlite test failure when setMeta throws | STRONG | Pending | SQLite probe write error is converted to SQLite-test-failed result. | pending;  |
| src/test/remote-coverage.test.ts:425 | clears cached remoteDb handle | COUPLED | Pending | Calls private getRemoteDb and inspects private remoteDb=null rather than observing closed/reopened behavior. | pending;  |
| src/test/remote-resume.test.ts:93 | resumes after simulated mid-push kill with no corruption or duplicates | STRONG | Pending | Real push from partially seeded remote yields all 12 exact memory bodies with unique IDs and second push count 0. | pending;  |
| src/test/remote-two-machine.test.ts:97 | A→NAS→B round-trip with conflict loses no data | STRONG | Pending | Real A/NAS/B databases retain literal version bodies through pushes/pulls and record one identified conflict while preserving both edits. | pending;  |
| src/test/remote.test.ts:88 | returns ok for a writable directory | STRONG | STRONG | Writable real directory reports all three location/SQLite checks true and no errors. | kept;  |
| src/test/remote.test.ts:102 | creates the directory if it does not exist | STRONG | STRONG | Location validation creates a previously absent real subdirectory and succeeds. | kept;  |
| src/test/remote.test.ts:114 | detects existing gnosys.db at path | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-remote-count | rewritten; g2-remote-count |
| src/test/remote.test.ts:136 | reports reachable when remote exists | STRONG | STRONG | Empty reachable remote reports configured/reachable true, zero pending work and no conflicts. | kept;  |
| src/test/remote.test.ts:145 | reports unreachable when remote path missing | STRONG | STRONG | Missing remote directory reports unreachable false with literal unreachable message. | kept;  |
| src/test/remote.test.ts:153 | counts pending push when local has new memories | STRONG | STRONG | Two local-only records produce exactly two pending push and zero pull. | kept;  |
| src/test/remote.test.ts:161 | counts pending pull when remote has new memories | STRONG | STRONG | One remote-only record produces exactly one pending pull and zero push. | kept;  |
| src/test/remote.test.ts:174 | pushes new local memories to remote | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-remote-push | rewritten; g2-remote-push |
| src/test/remote.test.ts:184 | pushes locally-modified memory when remote unchanged | STRONG | STRONG | Local modification propagates literal Updated title to real remote DB. | kept;  |
| src/test/remote.test.ts:205 | pulls new remote memories to local | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-remote-pull | rewritten; g2-remote-pull |
| src/test/remote.test.ts:214 | pulls remotely-modified memory when local unchanged | STRONG | STRONG | Remote modification propagates literal Remote Updated title into local DB. | kept;  |
| src/test/remote.test.ts:234 | flags conflict when both sides modified the same memory | STRONG | STRONG | Concurrent edits produce one identified conflict and a persisted unresolved conflict. | kept;  |
| src/test/remote.test.ts:253 | newer-wins strategy auto-resolves conflicts | STRONG | STRONG | Newer-wins synchronization clears conflict result and persists literal later Remote Edit title locally. | kept;  |
| src/test/remote.test.ts:274 | keeps local version on resolve(local) | STRONG | STRONG | Local resolution writes literal Local title to both DBs and clears unresolved conflict. | kept;  |
| src/test/remote.test.ts:287 | keeps remote version on resolve(remote) | STRONG | STRONG | Remote resolution writes literal Remote title to both actual DBs. | kept;  |
| src/test/remote.test.ts:305 | copies all local memories to a fresh remote | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-remote-migrate | rewritten; g2-remote-migrate |
| src/test/remote.test.ts:323 | two-way sync: local push and remote pull happen in one call | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-remote-push | rewritten; g2-remote-push |
| src/test/remote.test.ts:341 | generates and persists a stable machine ID | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-machine-identity | rewritten; g2-machine-identity |
| src/test/remote.test.ts:357 | formats unconfigured status | STRONG | STRONG | Unconfigured status formatter prints literal not configured state. | kept;  |
| src/test/remote.test.ts:370 | formats unreachable status | STRONG | STRONG | Unreachable status formatter prints literal unreachable state. | kept;  |
| src/test/remote.test.ts:384 | formats normal status with counts | STRONG | STRONG | Normal formatter renders literal Pending push: 3 and Pending pull: 1. | kept;  |
| src/test/remote.test.ts:422 | getConfiguredRemotePath prefers machine.json over legacy meta | STRONG | STRONG | Configured machine path wins over competing literal legacy meta path. | kept;  |
| src/test/remote.test.ts:430 | clearRemoteSyncConfig clears meta and machine.json remote | STRONG | STRONG | Clear operation removes legacy meta and actual machine JSON remote path/enabled setting. | kept;  |
| src/test/remoteWizard.test.ts:24 | matchesTypedPhrase requires exact match after trim | STRONG | STRONG | Public phrase comparator accepts exact/trimmed phrase and rejects literal wrong input. | kept;  |
| src/test/remoteWizard.test.ts:31 | detectClonedStagingPresence uses the per-client presence file | COUPLED | STRONG | Creates the documented literal staging presence path, then checks public detector false/true. | rewritten; presence-wrong-filename |
| src/test/remoteWizard.test.ts:45 | BACKUP_RISK_PHRASE is shared with remoteRender | COUPLED | Deleted | Deleted shared-constant identity duplicate; rendered prompt test asserts the literal acknowledgment phrase. | deleted;  |
| src/test/remoteWizard.test.ts:55 | renderV13ExplanationScreen includes key v13 rules | STRONG | STRONG | Public explanation renderer contains documented reachable/unreachable master rules and Tailscale guidance. | kept;  |
| src/test/remoteWizard.test.ts:64 | renderMasterBackupWarning includes daily snapshot copy | STRONG | STRONG | Public backup warning includes ONLY copy of your brain and master-folder/backups text. | kept;  |
| src/test/remoteWizard.test.ts:70 | renderBackupDeclineAckPrompt requires the v13 typed phrase | STRONG | STRONG | Public acknowledgment prompt includes the independently written full data-loss acceptance phrase. | kept;  |
| src/test/resolver-routing.test.ts:61 | resolves to cwd project even when another project is registered first | STRONG | Pending | Real cwd B wins over first registered A and selected path contains unique B basename. | pending;  |
| src/test/resolver-routing.test.ts:81 | resolves to cwd project when only a different project is registered | STRONG | Pending | Unregistered cwd store B wins over sole registered A. | pending;  |
| src/test/resolver-routing.test.ts:98 | falls back to registered project when cwd has no store | STRONG | Pending | Empty cwd falls back to literal registered project A path. | pending;  |
| src/test/resolver-routing.test.ts:124 | registerProject adds project to projects.json | STRONG | Pending | Register writes actual projects.json containing requested absolute path. | pending;  |
| src/test/resolver-routing.test.ts:139 | registerProject is idempotent | STRONG | Pending | Two registrations leave exactly one matching registry entry. | pending;  |
| src/test/resolver-tiers.test.ts:63 | loads project + personal + global tiers when scoped to a projectRoot | STRONG | Pending | Scoped resolver returns actual project, personal and global layer registrations. | pending;  |
| src/test/resolver-tiers.test.ts:71 | getWriteTarget('global') resolves under a projectRoot (the reported bug) | STRONG | Pending | Explicit global write target is writable and globally scoped. | pending;  |
| src/test/resolver-tiers.test.ts:79 | auto-creates the global store directory when it does not pre-exist | STRONG | Pending | Absent global directory becomes a real directory through scoped resolver initialization. | pending;  |
| src/test/resolver-tiers.test.ts:87 | still defaults writes to project (global is never auto-selected) | STRONG | Pending | Default write-target selection stays project in presence of all tiers. | pending;  |
| src/test/resolver-tiers.test.ts:94 | falls back to personal as the write target when no project store exists | STRONG | Pending | No project store produces personal write-target fallback. | pending;  |
| src/test/restore-command-handler.test.ts:13 | wires restore to runRestoreCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/restore-command-handler.test.ts:23 | exports runRestoreCommand with restore markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRuntime |
| src/test/retry.test.ts:5 | returns true for rate limits, timeouts, 5xx, and network errors | STRONG | Pending | Concrete 429/timeout/ECONNRESET/503/fetch errors classify transient=true. | pending;  |
| src/test/retry.test.ts:13 | returns false for ordinary errors | STRONG | Pending | Invalid API key classifies transient=false. | pending;  |
| src/test/retry.test.ts:23 | resolves after transient failures | STRONG | Pending | Retry wrapper returns literal ok after exactly three externally supplied attempts. | pending;  |
| src/test/retry.test.ts:38 | rethrows non-transient errors immediately | STRONG | Pending | Nontransient key error rejects with same message after exactly one attempt. | pending;  |
| src/test/sandbox-command-handler.test.ts:7 | declares sandbox as a parent container with leaf subcommand handlers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-command-handler.test.ts:33 | has no parent action between sandbox declaration and first leaf command | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-start-command-handler.test.ts:13 | wires sandbox start to runSandboxStartCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-start-command-handler.test.ts:25 | exports runSandboxStartCommand with sandbox start markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-status-command-handler.test.ts:13 | wires sandbox status to runSandboxStatusCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-status-command-handler.test.ts:23 | exports runSandboxStatusCommand with sandbox status markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-status-invoke.test.ts:42 | reports the sandbox as not running in a fresh GNOSYS_HOME (human) | STRONG | Pending | Real status command in fresh isolated home emits Sandbox is not running. | pending;  |
| src/test/sandbox-status-invoke.test.ts:48 | emits structured JSON with running: false (--json) | STRONG | Pending | Real status JSON in fresh isolated home reports running false. | pending;  |
| src/test/sandbox-stop-command-handler.test.ts:13 | wires sandbox stop to runSandboxStopCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/sandbox-stop-command-handler.test.ts:23 | exports runSandboxStopCommand with sandbox stop markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSandbox |
| src/test/scan-command-handler.test.ts:13 | wires scan to ensureMachineConfig, getMachineConfigPath, and scanProjects | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/scan-command-handler.test.ts:33 | exports scanProjects with project discovery markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerRemote |
| src/test/search-command-handler.test.ts:13 | wires search to runSearchCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/search-command-handler.test.ts:26 | exports runSearchCommand with federated and default FTS markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerCore |
| src/test/search-golden.test.ts:122 | `${variant} top-3 stable for "${query}"` | STRONG | Pending | Reviewed all 20 committed golden top-three ID lists against corpus; actual DB keyword/discovery/federated/hybrid/vector ranking matches literal fixtures. | pending;  |
| src/test/search-golden.test.ts:133 | corpus has ~50 memories | HOLLOW | Deleted | Static corpus-size fixture check has no application call; actual search golden top-three cases exercise this same corpus. Only asserts the static corpus fixture contains at least 50 memories; no application code is invoked. | deleted;  |
| src/test/search-invoke.test.ts:78 | finds the seeded memory via --federated --json | STRONG | Pending | Public federated JSON search returns the concrete seeded memory ID deci-701. | pending;  |
| src/test/search-invoke.test.ts:89 | prints a no-results message for an unmatched federated query | STRONG | Pending | Unmatched public federated search emits the literal query-specific no-results message. | pending;  |
| src/test/search.test.ts:48 | indexes memories and finds them by keyword | STRONG | Pending | Actual store indexing returns Authentication Decision first for JWT tokens query. | pending;  |
| src/test/search.test.ts:78 | returns empty array for no matches | STRONG | Pending | Unmatched query against an empty reindexed store returns literal []. | pending;  |
| src/test/search.test.ts:84 | handles empty query | STRONG | Pending | Empty query returns literal []. | pending;  |
| src/test/search.test.ts:91 | discovers memories via relevance keyword cloud | STRONG | Pending | Relevance-cloud discovery returns Authentication Decision with OAuth relevance text. | pending;  |
| src/test/search.test.ts:121 | falls back to full-text when column filter finds nothing | WEAK | Pending | Content-only fallback checks positive hit count but no expected identity/content. | pending;  |
| src/test/search.test.ts:142 | indexes multiple stores with label prefixes | STRONG | Pending | Two real stores produce exactly two hits carrying distinct project and personal path prefixes. | pending;  |
| src/test/search.test.ts:179 | removes all entries from the index | STRONG | Pending | Clear-index changes a previously nonempty search to exact zero results. | pending;  |
| src/test/semantic-search-command-handler.test.ts:13 | wires semantic-search to runSemanticSearchCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/semantic-search-command-handler.test.ts:25 | exports runSemanticSearchCommand with semantic-only and cleanup markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/setup-command-handler.test.ts:7 | wires bare setup to runSetup and summary wizard paths | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup, cli-registerMaintenance |
| src/test/setup-ctrlc.test.ts:75 | gnosys setup exits cleanly on SIGINT | MISLABELED | STRONG | Actual PTY Ctrl+C at the visible provider prompt returns exit0. Expected exit130 retained with it.fails; temporary close-listener repair makes the case unexpectedly pass. | expected_failure; g2-pty-setup-repair-witness |
| src/test/setup-ctrlc.test.ts:92 | gnosys setup models exits cleanly on SIGINT | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-pty-cancel-status | rewritten; g2-pty-cancel-status |
| src/test/setup-ctrlc.test.ts:107 | gnosys setup ides exits cleanly on SIGINT | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-pty-cancel-status | rewritten; g2-pty-cancel-status |
| src/test/setup-dream-command-handler.test.ts:7 | wires setup dream to runDreamSetup with the current directory | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-ides-command-handler.test.ts:7 | wires setup ides to interactive and --all IDE setup handlers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-keys-command-handler.test.ts:7 | wires setup keys to the table UI (provider table, keychain actions) | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-models-command-handler.test.ts:7 | wires setup models to runModelsSetup with provider/model/validate options | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-models-routing.test.ts:87 | lists one global requirement per distinct cloud provider | STRONG | STRONG | Two tasks using same cloud provider yield one literal OpenRouter/global key requirement. | kept;  |
| src/test/setup-models-routing.test.ts:93 | emits one requirement per distinct provider | STRONG | STRONG | Distinct cloud providers yield exactly literal OpenRouter and Anthropic global requirements. | kept;  |
| src/test/setup-models-routing.test.ts:107 | skips local providers in requirements | STRONG | STRONG | Ollama-only routing yields zero required keys. | kept;  |
| src/test/setup-models-routing.test.ts:114 | regression: vision+dream only — patch touches only those tasks | STRONG | STRONG | Accepted vision/dream selection yields exact vision-only task patch and preserves unrelated provider/model routing after merge. | kept;  |
| src/test/setup-models-routing.test.ts:164 | does not persist keys on validation failure | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-setup-validation-failure | rewritten; g2-setup-validation-failure |
| src/test/setup-models-routing.test.ts:187 | returns proceed true when validation succeeds | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-setup-validation-success | rewritten; g2-setup-validation-success |
| src/test/setup-models-routing.test.ts:209 | secure store (default choice) calls storeApiKeySecret | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-setup-secure-service | rewritten; g2-setup-secure-service |
| src/test/setup-models-routing.test.ts:226 | dotenv choice writes scoped service line | STRONG | STRONG | Dotenv choice writes exact service=dotenv-secret line into real temporary .env file. | kept;  |
| src/test/setup-models-routing.test.ts:254 | don't store prints env var names and persists nothing | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-setup-no-store | rewritten; g2-setup-no-store |
| src/test/setup-models-routing.test.ts:290 | writes global-scoped env var lines | STRONG | STRONG | Direct environment writer persists literal GNOSYS_GLOBAL_OPENROUTER_KEY=global-key line. | kept;  |
| src/test/setup-preferences-command-handler.test.ts:7 | wires setup preferences to runPreferencesReview with readline cleanup | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-providers-command-handler.test.ts:7 | wires setup providers to runProvidersSetup | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-command-handler.test.ts:13 | wires bare setup remote to runSetupRemoteCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-command-handler.test.ts:22 | exports runSetupRemoteCommand with setup-remote markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-doctor-command-handler.test.ts:10 | documents `gnosys setup remote doctor --ingest` for Windows / manual timer users | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-pull-command-handler.test.ts:13 | wires setup remote pull to runSetupRemotePullCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-pull-command-handler.test.ts:23 | exports runSetupRemotePullCommand with pull markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-push-command-handler.test.ts:13 | wires setup remote push to runSetupRemotePushCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-push-command-handler.test.ts:23 | exports runSetupRemotePushCommand with push markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-resolve-command-handler.test.ts:13 | wires setup remote resolve to runSetupRemoteResolveCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-resolve-command-handler.test.ts:22 | exports runSetupRemoteResolveCommand with resolve markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-status-command-handler.test.ts:13 | wires setup remote status to runSetupRemoteStatusCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-status-command-handler.test.ts:22 | exports runSetupRemoteStatusCommand with remote status markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-sync-command-handler.test.ts:13 | wires setup remote sync to runSetupRemoteSyncCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-sync-command-handler.test.ts:24 | exports runSetupRemoteSyncCommand with sync markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-timer-command-handler.test.ts:13 | wires setup remote timer to runSyncIngestTimerCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-remote-timer-command-handler.test.ts:25 | exports runSyncIngestTimerCommand with install/uninstall/status paths | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-routing-command-handler.test.ts:7 | wires setup routing to runRoutingSetup with readline cleanup | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerSetup |
| src/test/setup-storepath.test.ts:32 | resolveActiveStorePath returns project store when gnosys.json exists there | STRONG | Pending | Project config presence makes resolver return exact project-store path. | pending;  |
| src/test/setup-storepath.test.ts:42 | resolveActiveStorePath falls back to global home when no project config exists | STRONG | Pending | Missing project config yields exact configured global-home path. | pending;  |
| src/test/setup-storepath.test.ts:50 | resolveActiveStorePath does not create the global home if missing | STRONG | Pending | Read-only resolution returns missing-home path without creating directory. | pending;  |
| src/test/setup-storepath.test.ts:62 | ensureActiveStorePath creates the global home when no config exists | STRONG | Pending | Ensure resolver returns and actually creates selected global home. | pending;  |
| src/test/setup-storepath.test.ts:74 | ensureActiveStorePath prefers the project store over the global home | STRONG | Pending | Ensure resolver selects exact existing project-store path over home. | pending;  |
| src/test/setup-sync-projects-command-handler.test.ts:13 | wires setup sync-projects to runSetupSyncProjectsCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/setup-sync-projects-command-handler.test.ts:22 | exports runSetupSyncProjectsCommand with sync-projects operational markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/setup-ui-atoms.test.ts:26 | Header renders breadcrumb + version + rule | STRONG | Pending | Reviewed snapshot includes full breadcrumb, v5.9.3 and 80-column rule from real renderer. | pending;  |
| src/test/setup-ui-atoms.test.ts:32 | Header without version | STRONG | Pending | Reviewed snapshot has setup breadcrumb and rule with no version. | pending;  |
| src/test/setup-ui-atoms.test.ts:38 | Title with subtitle | STRONG | Pending | Reviewed two-line title snapshot contains exact title and subtitle. | pending;  |
| src/test/setup-ui-atoms.test.ts:44 | Title without subtitle | STRONG | Pending | Reviewed title-only snapshot contains exact Choose a model text. | pending;  |
| src/test/setup-ui-atoms.test.ts:50 | Menu renders numbered items with meta + tag | STRONG | Pending | Reviewed five-row menu snapshot preserves labels, costs, recommendation marker and back row. | pending;  |
| src/test/setup-ui-atoms.test.ts:62 | Menu with only labels (no meta, no tag) | STRONG | Pending | Reviewed two-item menu snapshot preserves numbered literal labels. | pending;  |
| src/test/setup-ui-atoms.test.ts:71 | Status — ok with meta | STRONG | Pending | Reviewed success snapshot renders check glyph, model-validated label and 847 ms. | pending;  |
| src/test/setup-ui-atoms.test.ts:76 | Status — warn with meta | STRONG | Pending | Reviewed warning snapshot renders warning glyph, missing-key label and found-xai meta. | pending;  |
| src/test/setup-ui-atoms.test.ts:81 | Status — fail | STRONG | Pending | Reviewed failure snapshot renders cross glyph and 401 unauthorized label. | pending;  |
| src/test/setup-ui-atoms.test.ts:86 | Status — progress | STRONG | Pending | Reviewed progress snapshot renders progress glyph and pricing text. | pending;  |
| src/test/setup-ui-atoms.test.ts:91 | Diff renders before/after rows | STRONG | Pending | Reviewed diff snapshot contains three exact before/after value pairs. | pending;  |
| src/test/setup-ui-atoms.test.ts:101 | Panel renders rounded box with title and rows | STRONG | Pending | Reviewed panel snapshot preserves title, seven settings rows and borders. | pending;  |
| src/test/setup-ui-atoms.test.ts:115 | Footer renders right-aligned hint | STRONG | Pending | Reviewed footer snapshot positions exact quit/Ctrl-C hint at right. | pending;  |
| src/test/setup-ui-atoms.test.ts:120 | stripAnsi removes ANSI escapes | STRONG | Pending | ANSI stripping returns literal bold and color text. | pending;  |
| src/test/setup-ui-atoms.test.ts:125 | tokens — color() wraps text with reset | WEAK | STRONG | Literal observable result now rejects omit requested opening color. | rewritten; G1-color |
| src/test/setup-ui-coldstart.test.ts:21 | renderColdStartSplash includes brand mark, version, and step preview | STRONG | STRONG | Reviewed compact snapshot and literals show brand/version, four setup steps and clean-exit hint. | kept;  |
| src/test/setup-ui-coldstart.test.ts:33 | renderColdStartSplash handles version with leading v | WEAK | STRONG | Exact header tokens, raw ANSI cells, serialized valid config and fixed seeded machine IDs replace substring/shape/self-equality checks. | rewritten; splash-double-v |
| src/test/setup-ui-coldstart.test.ts:39 | renderStepHeader includes step counter | STRONG | STRONG | Reviewed header snapshot and literals verify provider breadcrumb and step 1 of 4 placement. | kept;  |
| src/test/setup-ui-coldstart.test.ts:48 | renderDonePanelRows aligns labels and shows full summary | STRONG | STRONG | Reviewed five-row snapshot contains exact provider/model/key source/IDEs and disabled dream summary with aligned labels. | kept;  |
| src/test/setup-ui-coldstart.test.ts:63 | renderDonePanelRows handles no IDEs | STRONG | STRONG | No-IDE renderer explicitly includes (none) and enabled dream output. | kept;  |
| src/test/setup-ui-config-init.test.ts:40 | without --force prints deprecation warning and does NOT write template | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-config-unforced-write | rewritten; g2-config-unforced-write |
| src/test/setup-ui-config-init.test.ts:54 | with --force writes a template without defaultProvider hardcoded | STRONG | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-config-template | rewritten; g2-config-template |
| src/test/setup-ui-screen1-substeps.test.ts:25 | renders the provider sub-screen header (Screen 1.1) | STRONG | Pending | Reviewed provider-header snapshot preserves step 1 of 4, version, provider title and pricing explanation. | pending;  |
| src/test/setup-ui-screen1-substeps.test.ts:38 | renders the model sub-screen header (Screen 1.2) | STRONG | Pending | Reviewed model-header snapshot preserves step 2 of 4 and anthropic model title. | pending;  |
| src/test/setup-ui-screen1-substeps.test.ts:48 | renders the key sub-screen header (Screen 1.3) | STRONG | Pending | Reviewed key-header snapshot preserves step 3 of 4, anthropic label and validation-before-save hint. | pending;  |
| src/test/setup-ui-screen1-substeps.test.ts:57 | renderKeySourceRows tags the env-var row with `◂ found` when detected | STRONG | Pending | Reviewed source-row snapshot marks only detected environment row found and preserves all four labels. | pending;  |
| src/test/setup-ui-screen1-substeps.test.ts:73 | renderKeyStepFooter has the 1-4 hint | STRONG | Pending | Footer contains literal 1-4 pick and back navigation hints. | pending;  |
| src/test/setup-ui-screen10.test.ts:35 | renders the header with version | STRONG | Pending | Reviewed header snapshot contains actual upgrading-projects breadcrumb and version. | pending;  |
| src/test/setup-ui-screen10.test.ts:44 | collapsePath shortens long absolute paths | STRONG | Pending | Short home path becomes exact ~/proj; long path fits fifty chars and ends with ellipsis. | pending;  |
| src/test/setup-ui-screen10.test.ts:55 | renders the upgraded section with full project list | STRONG | Pending | Reviewed upgraded snapshot renders exact three project titles and collapsed/absolute paths. | pending;  |
| src/test/setup-ui-screen10.test.ts:67 | renders upgraded with overflow collapse (more than 5) | STRONG | Pending | Nine-project overflow renders seven lines and literal (4 more) marker. | pending;  |
| src/test/setup-ui-screen10.test.ts:79 | renders the skipped section with no .gnosys directory hint | STRONG | Pending | Reviewed skipped snapshot contains exact missing-gnosys hint and project path. | pending;  |
| src/test/setup-ui-screen10.test.ts:90 | renders the failed section when there are failures | WEAK | STRONG | Literal observable result now rejects drop failed project detail while keeping line count. | rewritten; G1-failed-rows |
| src/test/setup-ui-screen10.test.ts:98 | renders machines section with older-version warning | STRONG | Pending | Reviewed machine snapshot preserves exact versions/dates, current-machine label and older marker on EdsMBP. | pending;  |
| src/test/setup-ui-screen10.test.ts:114 | renders machines section returns empty when only one machine | STRONG | Pending | Single-machine renderer returns exact empty array. | pending;  |
| src/test/setup-ui-screen10.test.ts:122 | renders the done line with version | STRONG | Pending | Done line contains literal version-stamped completion message. | pending;  |
| src/test/setup-ui-screen10.test.ts:129 | renders dashboard summary with collapsed paths | WEAK | STRONG | Literal observable result now rejects render wrong dashboard html output path. | rewritten; G1-dashboard-paths |
| src/test/setup-ui-screen13.test.ts:20 | KNOWN_CONFIG_KEYS includes the documented keys | COUPLED | STRONG | Concrete misspelled user inputs produce six literal key suggestions. | rewritten; config-suggestions-null |
| src/test/setup-ui-screen13.test.ts:30 | suggestConfigKey returns null on exact match | STRONG | STRONG | Exact provider and xai-model keys return null suggestion. | kept;  |
| src/test/setup-ui-screen13.test.ts:36 | suggestConfigKey suggests close matches on typo | STRONG | STRONG | Concrete spelling errors resolve to literal provider/model/xai-model suggestions. | kept;  |
| src/test/setup-ui-screen13.test.ts:43 | suggestConfigKey returns null on wild miss | STRONG | STRONG | A distant invalid key returns null rather than an unrelated suggestion. | kept;  |
| src/test/setup-ui-screen13.test.ts:49 | classifyStore returns 'global' for ~/.gnosys | STRONG | STRONG | Home .gnosys path classifies as literal global scope. | kept;  |
| src/test/setup-ui-screen13.test.ts:54 | classifyStore returns 'project' for any other path | STRONG | STRONG | Two other store paths classify as literal project scope. | kept;  |
| src/test/setup-ui-screen13.test.ts:60 | levenshtein computes edit distance correctly | STRONG | STRONG | Edit-distance helper returns independently specified 0, 3, 2 and 0 for concrete string pairs. | kept;  |
| src/test/setup-ui-screen3.test.ts:17 | renders both rows when nothing has changed (cold start) | STRONG | Pending | Cold-start model diff returns exact provider/model rows from unset to anthropic/claude-sonnet-4-6. | pending;  |
| src/test/setup-ui-screen3.test.ts:25 | returns a single row when only the model changed | STRONG | Pending | Model-only change returns exactly one row with literal prior/new model values. | pending;  |
| src/test/setup-ui-screen3.test.ts:34 | returns both rows when the user switched providers | STRONG | Pending | Provider change returns two labeled rows and exact anthropic-to-xai provider transition. | pending;  |
| src/test/setup-ui-screen3.test.ts:43 | emits both rows as a fallback when nothing differs but config is established | STRONG | Pending | Unchanged established config returns two confirmation rows with identical anthropic endpoints. | pending;  |
| src/test/setup-ui-screen4.test.ts:20 | classifyCost: ollama and lmstudio are always free | STRONG | Pending | Both local providers classify as literal free. | pending;  |
| src/test/setup-ui-screen4.test.ts:26 | classifyCost: anthropic sonnet is mid-tier | STRONG | Pending | Anthropic Sonnet model classifies as literal $$$. | pending;  |
| src/test/setup-ui-screen4.test.ts:32 | classifyCost: groq small is cheap | STRONG | Pending | Small Groq model classifies as literal $. | pending;  |
| src/test/setup-ui-screen4.test.ts:38 | classifyCost: unknown model defaults to $$ (conservative) | STRONG | Pending | Unknown model falls back to literal $$. | pending;  |
| src/test/setup-ui-screen4.test.ts:43 | renders the routing table with the cost column | STRONG | Pending | Reviewed routing snapshot preserves all task/provider/model/cost columns and rows. | pending;  |
| src/test/setup-ui-screen4.test.ts:59 | renders the routing table with ▶ markers on changed rows | STRONG | Pending | Changed synthesis row carries marker while unchanged structuring row does not. | pending;  |
| src/test/setup-ui-screen4.test.ts:74 | renders the diff block with → for changes and (unchanged) otherwise | STRONG | Pending | Reviewed diff snapshot shows exact provider switch and unchanged dream row. | pending;  |
| src/test/setup-ui-screen4.test.ts:89 | renderRoutingDiff returns empty string when no entries | STRONG | Pending | No diff entries returns literal empty string. | pending;  |
| src/test/setup-ui-screen6.test.ts:22 | renders the reconfigure intro with `not configured` when no remote | STRONG | Pending | Reviewed intro snapshot preserves exact 120 active/5 archived counts and not-configured state. | pending;  |
| src/test/setup-ui-screen6.test.ts:34 | renderV13ExplanationScreen matches snapshot | STRONG | Pending | Reviewed explanation snapshot covers staged files and reachable/unreachable master user guidance. | pending;  |
| src/test/setup-ui-screen6.test.ts:41 | renders the intro with the remote path when configured | STRONG | Pending | Configured intro renders the literal /Volumes/NAS/gnosys remote path. | pending;  |
| src/test/setup-ui-screen6.test.ts:47 | renders validation summary with all checks ok | STRONG | Pending | Reviewed validation snapshot renders successful checks and exact 42 ms latency. | pending;  |
| src/test/setup-ui-screen6.test.ts:67 | renders validation summary with existing DB and warnings | STRONG | Pending | Existing remote summary renders 4237 memories, date 2026-05-19 and high latency warning. | pending;  |
| src/test/setup-ui-screen6.test.ts:86 | renders validation summary with failures | STRONG | Pending | Failed validation renders failure marker and literal permission denied error. | pending;  |
| src/test/setup-ui-screen6.test.ts:102 | renders the diff with previous → new | STRONG | Pending | Reviewed diff snapshot renders unset remote to NAS path and master role. | pending;  |
| src/test/setup-ui-screen6.test.ts:119 | SYNC_MODE_LABELS covers all three modes | COUPLED | Pending | Only pins text inside SYNC_MODE_LABELS constants, without rendering/choosing modes. | pending;  |
| src/test/setup-ui-screen7.test.ts:21 | builds the diff rows for a first-time enable | STRONG | Pending | Reviewed first-enable diff snapshot has exact four labels, prior dashes and new provider/machine/threshold values. | pending;  |
| src/test/setup-ui-screen7.test.ts:47 | builds the diff rows showing what changed on a re-run | STRONG | Pending | Re-run diff preserves all four exact prior values. | pending;  |
| src/test/setup-ui-screen7.test.ts:74 | renders the thresholds block with default values inside [N ] fields | STRONG | Pending | Reviewed threshold snapshot renders 10/30/10 values and all three enabled task labels. | pending;  |
| src/test/setup-ui-screen7.test.ts:88 | renders sub-tasks with ○ when disabled | HOLLOW | STRONG | Literal observable result now rejects omit disabled task rows entirely. | rewritten; G1-dream-disabled |
| src/test/setup-ui-summary.test.ts:76 | formatMultiMachineSyncSummary shows NA when remote is not configured | STRONG | Pending | Public formatter returns exact NA fallback or provided remote path. | pending;  |
| src/test/setup-ui-summary.test.ts:82 | describeMultiMachineSyncPanel shows NA with no remote meta or machine config | STRONG | STRONG | Literal observable result now rejects misrender actual persisted remote configuration. | rewritten; G1-summary-real-remote |
| src/test/setup-ui-summary.test.ts:104 | renders panel row 4 with NA when multi-machine sync is not configured | COUPLED | STRONG | Literal observable result now rejects mislabel sync panel row. | rewritten; G1-summary-na-row |
| src/test/setup-ui-summary.test.ts:130 | renders panel rows for a fresh config (no default provider) | COUPLED | STRONG | Literal observable result now rejects misrepresent unconfigured task routing. | rewritten; G1-summary-fresh |
| src/test/setup-ui-summary.test.ts:137 | renders panel rows after a switch to xai | COUPLED | STRONG | Literal observable result now rejects ignore provider loaded from actual config. | rewritten; G1-summary-xai |
| src/test/setup-ui-summary.test.ts:153 | buildTrailingMap marks edited sections with ✓ | COUPLED | STRONG | Literal observable result now rejects omit edited-section marker. | rewritten; G1-summary-edited |
| src/test/setup-ui-summary.test.ts:164 | resolveActiveStorePath prefers .gnosys/ when present | COUPLED | Deleted | Private path resolver duplicates setup-storepath.test.ts public resolveActiveStorePath project-config selection cases. | deleted;  |
| src/test/setup-ui-table.test.ts:35 | renders header + divider + rows (auto-fit widths) | STRONG | STRONG | Reviewed five-line table snapshot verifies headers/divider and literal provider/model/cost rows. | kept;  |
| src/test/setup-ui-table.test.ts:45 | omits header when showHeader is false | STRONG | STRONG | Reviewed three-line snapshot contains data rows with no header when disabled. | kept;  |
| src/test/setup-ui-table.test.ts:54 | renders header without divider when dividerAfterHeader is false | STRONG | STRONG | Reviewed snapshot contains header/data and omits divider when disabled. | kept;  |
| src/test/setup-ui-table.test.ts:63 | supports fixed column widths | STRONG | STRONG | Reviewed snapshot verifies requested fixed column spacing and right-aligned costs. | kept;  |
| src/test/setup-ui-table.test.ts:73 | supports right-aligned columns | STRONG | STRONG | Reviewed snapshot verifies right-aligned single/double dollar costs for concrete rows. | kept;  |
| src/test/setup-ui-table.test.ts:82 | handles empty row arrays (header still emitted) | STRONG | STRONG | Reviewed empty-data snapshot still emits exactly header and divider. | kept;  |
| src/test/setup-ui-table.test.ts:91 | handles empty row arrays with showHeader=false (returns no lines) | STRONG | STRONG | Empty rows with hidden header return literal []. | kept;  |
| src/test/setup-ui-table.test.ts:99 | respects custom indent + gap | STRONG | STRONG | Reviewed snapshot verifies indent 3 and gap 4 on concrete provider rows. | kept;  |
| src/test/setup-ui-table.test.ts:108 | preserves coloured cell content while padding to printable width | WEAK | STRONG | Exact header tokens, raw ANSI cells, serialized valid config and fixed seeded machine IDs replace substring/shape/self-equality checks. | rewritten; table-strip-cell-color |
| src/test/setup-ui-table.test.ts:122 | invokes rowFormatter for per-row markers | STRONG | STRONG | Reviewed snapshot shows literal > marker only on synthesis and unmarked vision row. | kept;  |
| src/test/setup-ui-table.test.ts:136 | returns [] when columns is empty | STRONG | STRONG | Empty column list yields literal []. | kept;  |
| src/test/setup.test.ts:25 | has entries for all 9 providers | COUPLED | Pending | Pins provider registry keys/count directly rather than rendered selection or accepted provider behavior. | pending;  |
| src/test/setup.test.ts:39 | each provider with tiers has exactly one recommended model | WEAK | Pending | Recommended-model loop skips empty tier arrays, allowing all provider choices to disappear. | pending;  |
| src/test/setup.test.ts:50 | custom provider has empty tiers array | COUPLED | Pending | Pins exported custom tiers constant to [] without exercising custom provider configuration. | pending;  |
| src/test/setup.test.ts:54 | all tiers have required fields | WEAK | Pending | Tier-field assertions are truthiness/types inside loops that vanish for empty registries. | pending;  |
| src/test/setup.test.ts:66 | local providers (ollama, lmstudio) have zero pricing | WEAK | Pending | Zero-pricing assertions run only over existing local tiers, so dropping local choices passes. | pending;  |
| src/test/setup.test.ts:79 | returns claude-haiku-4-5 for anthropic | STRONG | Pending | Anthropic structuring model resolves to literal claude-haiku-4-5. | pending;  |
| src/test/setup.test.ts:85 | returns gpt-5.4-nano for openai | STRONG | Pending | OpenAI structuring model resolves to literal gpt-5.4-nano. | pending;  |
| src/test/setup.test.ts:91 | returns same model for groq (already cheap) | STRONG | Pending | Groq structuring preserves literal llama-3.3-70b-versatile. | pending;  |
| src/test/setup.test.ts:97 | returns same model for ollama | STRONG | Pending | Ollama structuring preserves literal llama3.2. | pending;  |
| src/test/setup.test.ts:101 | returns same model for custom | STRONG | Pending | Custom structuring preserves literal my-model. | pending;  |
| src/test/setup.test.ts:121 | creates directory and writes key | STRONG | Pending | API-key writer creates real env file with literal GNOSYS_ANTHROPIC_KEY mapping/value. | pending;  |
| src/test/setup.test.ts:128 | maps providers to correct env var names | STRONG | Pending | OpenAI key is persisted under literal GNOSYS_OPENAI_KEY variable. | pending;  |
| src/test/setup.test.ts:135 | does not duplicate keys on second write | STRONG | Pending | Second key write leaves one provider entry with replacement value key2. | pending;  |
| src/test/setup.test.ts:145 | preserves existing keys for other providers | STRONG | Pending | Writing another provider retains both literal Anthropic and OpenAI key lines. | pending;  |
| src/test/setup.test.ts:154 | uses GNOSYS_CUSTOM_KEY for custom provider | STRONG | Pending | Custom provider key persists under literal GNOSYS_CUSTOM_KEY. | pending;  |
| src/test/setup.test.ts:173 | returns an array of strings (IDE detection depends on host environment) | WEAK | Pending | IDE detection checks array/type/allowed names with no controlled installed IDE or required result. | pending;  |
| src/test/setup.test.ts:193 | returns empty array for bare directory | HOLLOW | Pending | Filters out every supported IDE before asserting nothing remains, so arbitrary omission of real IDEs cannot fail it. | pending;  |
| src/test/setup.test.ts:212 | default Anthropic model is claude-sonnet-4-6 | STRONG | Pending | Public provider-model resolver returns documented default claude-sonnet-4-6. | pending;  |
| src/test/setup.test.ts:218 | default OpenAI model is gpt-5.4-mini | STRONG | Pending | Public provider-model resolver returns documented default gpt-5.4-mini. | pending;  |
| src/test/setup.test.ts:222 | default xAI model is grok-4.20 | STRONG | Pending | Public provider-model resolver returns documented default grok-4.20. | pending;  |
| src/test/setup.test.ts:226 | default Mistral model is mistral-small-4 | STRONG | Pending | Public provider-model resolver returns documented default mistral-small-4. | pending;  |
| src/test/setup.test.ts:232 | default Groq model is llama-3.3-70b-versatile | STRONG | Pending | Public provider-model resolver returns documented default llama-3.3-70b-versatile. | pending;  |
| src/test/setup.test.ts:240 | parses comma-separated 1-based indices | STRONG | Pending | Task selection parses literal 1,3,5 to zero-based [0,2,4]. | pending;  |
| src/test/setup.test.ts:244 | accepts all and none | STRONG | Pending | Selection parser recognizes literal all and none inputs. | pending;  |
| src/test/setup.test.ts:249 | rejects out-of-range values | STRONG | Pending | Out-of-range task index input returns literal null. | pending;  |
| src/test/setup.test.ts:255 | anthropic structuring returns claude-haiku-4-5 | STRONG | Pending | Schema-parsed Anthropic config routes structuring to claude-haiku-4-5. | pending;  |
| src/test/setup.test.ts:263 | openai structuring returns gpt-5.4-nano | STRONG | Pending | Schema-parsed OpenAI config routes structuring to gpt-5.4-nano. | pending;  |
| src/test/setup.test.ts:271 | groq structuring returns the default groq model (no override) | STRONG | Pending | Schema-parsed Groq config retains llama-3.3-70b-versatile for structuring. | pending;  |
| src/test/setup.test.ts:279 | explicit task override takes precedence | STRONG | Pending | Explicit task override returns literal ollama provider and llama3.2 model. | pending;  |
| src/test/setupKeys.test.ts:136 | lists all known providers with env, keychain, dotenv, missing, and local statuses | STRONG | STRONG | Literal observable result now rejects drop provider inventory. | rewritten; G1-key-list |
| src/test/setupKeys.test.ts:192 | detects every configured storage location for a provider independently | COUPLED | STRONG | Literal observable result now rejects hide secondary configured key locations. | rewritten; G1-key-locations |
| src/test/setupKeys.test.ts:280 | does not list key locations for local providers | COUPLED | STRONG | Literal observable result now rejects display missing api-key warning for local provider. | rewritten; G1-key-local |
| src/test/setupKeys.test.ts:287 | supports the custom provider slot | STRONG | STRONG | Literal observable result now rejects drop supported custom-provider entry. | rewritten; G1-key-custom |
| src/test/setupKeys.test.ts:306 | removes only the requested provider keys from the gnosys dotenv file | COUPLED | STRONG | Literal observable result now rejects skip selected credential deletion write. | rewritten; G1-key-remove-selected |
| src/test/setupKeys.test.ts:332 | validates an updated key before writing it to dotenv | COUPLED | STRONG | Literal observable result now rejects skip validated credential persistence. | rewritten; G1-key-save-dotenv |
| src/test/setupKeys.test.ts:351 | rejects an invalid key before choosing a storage destination | COUPLED | STRONG | Literal observable result now rejects offer storage after failed credential validation. | rewritten; G1-key-reject-update |
| src/test/setupKeys.test.ts:363 | routes destination choice to keychain, dotenv, or manual env instructions | COUPLED | STRONG | Literal observable result now rejects report secure-store success without saving key. | rewritten; G1-key-destinations |
| src/test/setupKeys.test.ts:402 | copies a dotenv-only key to keychain and removes the dotenv line | COUPLED | STRONG | Literal observable result now rejects leave plaintext source credential after secure copy. | rewritten; G1-key-copy-cleanup |
| src/test/setupKeys.test.ts:432 | does not copy to keychain or change dotenv when validation fails | COUPLED | STRONG | Literal observable result now rejects proceed to copy confirmation despite invalid key. | rewritten; G1-key-reject-copy |
| src/test/setupKeys.test.ts:455 | does not duplicate a key that is already in keychain | COUPLED | STRONG | Literal observable result now rejects validate and offer copy for already-secure credential. | rewritten; G1-key-copy-idempotent |
| src/test/setupKeys.test.ts:471 | deletes a dotenv-only key after confirmation | COUPLED | STRONG | Literal observable result now rejects keep plaintext key after user confirms deletion. | rewritten; G1-key-delete-dotenv |
| src/test/setupKeys.test.ts:489 | deletes a keychain-only key after confirmation | COUPLED | STRONG | Literal observable result now rejects claim removal without deleting secure-store secret. | rewritten; G1-key-delete-keychain |
| src/test/setupKeys.test.ts:506 | deletes all removable keychain and dotenv copies when requested | COUPLED | STRONG | Literal observable result now rejects remove secure-store key but leave plaintext duplicate. | rewritten; G1-key-delete-both |
| src/test/shell-injection-argv.test.ts:21 | migrateProject copies stores when paths contain spaces | STRONG | Pending | Real migration with space-containing paths creates target identity and preserves literal note content. | pending;  |
| src/test/shell-injection-argv.test.ts:53 | does not use shell-string cp/open patterns in source | COUPLED | STRONG | Literal observable result now rejects interpret dollar substitution syntax instead of treating it as literal path. | rewritten; G1-shell-literal-copy |
| src/test/snapshot-publish-flow.test.ts:74 | publishes a snapshot after an ingesting sweep | STRONG | Pending | Real staged ingest publishes sequence-one manifest with checksum and an existing snapshot after one accepted memory. | pending;  |
| src/test/snapshot-publish-flow.test.ts:87 | publishes a bootstrap snapshot even when nothing was staged | STRONG | Pending | Empty first sweep actually bootstraps a readable manifest while reporting zero ingested memories. | pending;  |
| src/test/snapshot-publish-flow.test.ts:93 | does not bump seq for an empty sweep when a manifest already exists | STRONG | Pending | Second no-change sweep preserves the persisted snapshot sequence. | pending;  |
| src/test/snapshot-publish-flow.test.ts:101 | client reads the published snapshot copy, not the live master DB | STRONG | Pending | Client consumes published snapshot and reads literal Snap two title with accepted sequence one. | pending;  |
| src/test/snapshot-publish-flow.test.ts:127 | client refreshes its copy when the master publishes a newer snapshot | STRONG | Pending | Later snapshot refresh advances client sequence to two and exposes literal Snap three title. | pending;  |
| src/test/stale-command-handler.test.ts:13 | wires stale to runStaleCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/stale-command-handler.test.ts:23 | exports runStaleCommand with stale markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/stale-invoke.test.ts:68 | lists memories older than the threshold | STRONG | Pending | Real stale command lists literal Ancient decision and thirty-day heading from old DB fixture without stderr errors. | pending;  |
| src/test/stale-invoke.test.ts:76 | reports no stale memories with a huge threshold | STRONG | Pending | Large age window returns literal no-memories-older message. | pending;  |
| src/test/staticSearch.test.ts:156 | loads from a file path | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-load-empty-documents |
| src/test/staticSearch.test.ts:166 | loads from a JSON string | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-load-empty-documents |
| src/test/staticSearch.test.ts:173 | caches repeated calls with same source | COUPLED | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-bypass-cache |
| src/test/staticSearch.test.ts:181 | throws on invalid JSON | STRONG | STRONG | Malformed JSON rejects with literal Invalid JSON error. | kept;  |
| src/test/staticSearch.test.ts:185 | throws on missing version field | STRONG | STRONG | Missing version rejects with missing or invalid version error. | kept;  |
| src/test/staticSearch.test.ts:189 | throws on unsupported version | STRONG | STRONG | Version 99 rejects with explicit unsupported-version message. | kept;  |
| src/test/staticSearch.test.ts:194 | throws on missing file | STRONG | STRONG | Missing index file rejects with not found error. | kept;  |
| src/test/staticSearch.test.ts:208 | returns empty array for no matches | STRONG | STRONG | Unmatched search over a populated index returns literal []. | kept;  |
| src/test/staticSearch.test.ts:213 | returns results sorted by score descending | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-reverse-rank |
| src/test/staticSearch.test.ts:221 | respects limit option | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-ignore-limit |
| src/test/staticSearch.test.ts:226 | respects minScore threshold | STRONG | STRONG | High minimum score 100 excludes the real chatbot hit. | kept;  |
| src/test/staticSearch.test.ts:231 | filters by category | HOLLOW | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-search-empty |
| src/test/staticSearch.test.ts:238 | filters by tags | HOLLOW | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-search-empty |
| src/test/staticSearch.test.ts:245 | matches relevance keywords | STRONG | STRONG | Relevance query mavenn returns literal prod-001 first. | kept;  |
| src/test/staticSearch.test.ts:251 | handles multi-word queries | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-wrong-document |
| src/test/staticSearch.test.ts:257 | returns empty for single-character queries | STRONG | STRONG | Single-character query yields literal []. | kept;  |
| src/test/staticSearch.test.ts:262 | is case-insensitive | HOLLOW | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-search-empty |
| src/test/staticSearch.test.ts:271 | strips punctuation from query | HOLLOW | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-search-empty |
| src/test/staticSearch.test.ts:277 | returns matchedTokens in results | STRONG | STRONG | Actual matchedTokens include literal chatbot for the chatbot/agent query. | kept;  |
| src/test/staticSearch.test.ts:283 | boosts recent documents when boostRecent is true | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-wrong-document |
| src/test/staticSearch.test.ts:300 | returns empty array for empty query | STRONG | STRONG | Empty and whitespace queries return literal []. | kept;  |
| src/test/staticSearch.test.ts:315 | returns document by ID | STRONG | STRONG | ID lookup returns literal Building AI Chatbots title. | kept;  |
| src/test/staticSearch.test.ts:321 | returns document by path | STRONG | STRONG | Path lookup returns literal blog-001 ID. | kept;  |
| src/test/staticSearch.test.ts:327 | returns null for non-existent document | STRONG | STRONG | Unknown document lookup returns literal null. | kept;  |
| src/test/staticSearch.test.ts:341 | returns all documents with no filter | WEAK | STRONG | Exact result IDs, ranks, tokens, recency score and cached-file refresh outcomes replace empty-loop, count-only and self-comparison assertions. | rewritten; static-repeat-documents |
| src/test/staticSearch.test.ts:346 | filters by category | STRONG | STRONG | Blog category listing returns exactly two records and both have literal blog category. | kept;  |
| src/test/staticSearch.test.ts:352 | filters by tags (any match) | STRONG | STRONG | AI tag listing returns exactly two records and both contain ai tag. | kept;  |
| src/test/staticSearch.test.ts:358 | filters by status | STRONG | STRONG | Archived status filter returns exactly arch-001. | kept;  |
| src/test/staticSearch.test.ts:364 | combines multiple filters (AND logic) | STRONG | STRONG | Combined blog/active filter returns exactly blog-001. | kept;  |
| src/test/staticSearch.test.ts:370 | returns empty array when no documents match filter | STRONG | STRONG | Unknown category filter returns literal []. | kept;  |
| src/test/staticSearchSemantic.test.ts:110 | imports only Node builtins | COUPLED | STRONG | Executes copied built JavaScript outside package/dependencies; literal lexical result IDs prove usable standalone artifact. | rewritten; standalone-search-empty |
| src/test/staticSearchSemantic.test.ts:124 | loads vectors from a raw JSON string | STRONG | STRONG | Vector JSON loader returns literal model, version 1 and lex-b vector [100,0]. | kept;  |
| src/test/staticSearchSemantic.test.ts:132 | loads vectors from a file path and caches repeated calls | COUPLED | STRONG | Changing source vector JSON remains cached, then clearing reloads the literal changed vector. | rewritten; vectors-cache-clear-noop |
| src/test/staticSearchSemantic.test.ts:143 | throws on invalid JSON | STRONG | STRONG | Invalid vector JSON rejects with Invalid JSON. | kept;  |
| src/test/staticSearchSemantic.test.ts:147 | throws on missing version | STRONG | STRONG | Missing vector version rejects with missing or invalid version. | kept;  |
| src/test/staticSearchSemantic.test.ts:154 | throws on unsupported version | STRONG | STRONG | Unsupported vector version 2 rejects with explicit version message. | kept;  |
| src/test/staticSearchSemantic.test.ts:160 | throws on wrong quantization | STRONG | STRONG | Wrong quantization float32 rejects with quantization must be int8. | kept;  |
| src/test/staticSearchSemantic.test.ts:166 | throws on missing file path | STRONG | STRONG | Missing vector file rejects with not found. | kept;  |
| src/test/staticSearchSemantic.test.ts:172 | keeps lexical search behavior unchanged when semantic inputs are absent | STRONG | STRONG | Lexical-only search returns exact lex-a/lex-b IDs, scores 10/9 and orchard tokens. | kept;  |
| src/test/staticSearchSemantic.test.ts:187 | falls back to lexical search when one semantic input is absent | STRONG | STRONG | Missing vector collection falls back to exact lexical ID order with first score 10. | kept;  |
| src/test/staticSearchSemantic.test.ts:197 | fuses lexical and semantic rankings with RRF k=60 | STRONG | STRONG | Real fusion returns lex-b/lex-a/sem-c order and independent RRF fractions plus cosine 1. | kept;  |
| src/test/staticSearchSemantic.test.ts:212 | allows semantic-only documents with empty matched tokens | STRONG | STRONG | Semantic-only query returns exact lex-b/sem-c IDs with empty lexical tokens. | kept;  |
| src/test/staticSearchSemantic.test.ts:223 | skips vector doc ids that are not in the index | STRONG | STRONG | Unknown vector ID ghost is excluded and exactly three real indexed results remain. | kept;  |
| src/test/staticSearchSemantic.test.ts:241 | falls back to lexical search and warns on model mismatch | STRONG | STRONG | Model mismatch emits literal warning and exact lexical IDs/scores. | kept;  |
| src/test/staticSearchSemantic.test.ts:256 | falls back to lexical search and warns on dimension mismatch | STRONG | STRONG | Dimension mismatch emits literal warning and exact lexical IDs/scores. | kept;  |
| src/test/staticSearchSemantic.test.ts:270 | dequantizes int8 vectors with scale and offset before cosine ranking | STRONG | STRONG | Scale/offset dequantization ranks lex-a first with semantic score 1. | kept;  |
| src/test/staticSearchSemantic.test.ts:291 | returns zero cosine for zero-magnitude vectors and dimension mismatches | STRONG | STRONG | Zero-magnitude and dimension-mismatched cosine inputs both return exact 0. | kept;  |
| src/test/stats-command-handler.test.ts:13 | wires stats to runStatsCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/stats-command-handler.test.ts:24 | exports runStatsCommand with stats markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/stats-invoke.test.ts:79 | prints 'No memories found.' on an empty central DB | STRONG | Pending | Empty actual stats command emits literal No memories found. | pending;  |
| src/test/stats-invoke.test.ts:85 | emits stats JSON with seeded memories (--all --json) | STRONG | Pending | Seeded stats JSON has exact total two and one record in each literal category. | pending;  |
| src/test/stats-invoke.test.ts:98 | renders the human table with category/status/author sections | STRONG | Pending | Human stats output renders the promised literal category/status/author section headers. | pending;  |
| src/test/status-command-handler.test.ts:10 | wires status to runStatusCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/status-command-handler.test.ts:24 | exports runStatusCommand with status markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/store.test.ts:44 | creates .config internal directory | STRONG | STRONG | Actual store initialization creates .config directory. | kept;  |
| src/test/store.test.ts:51 | writes and reads a memory with correct frontmatter | STRONG | STRONG | Public write/read roundtrip preserves literal path, ID, title, relevance, status and body. | kept;  |
| src/test/store.test.ts:67 | returns null for non-existent memory | STRONG | STRONG | Reading nonexistent memory path yields null. | kept;  |
| src/test/store.test.ts:72 | returns null for files without id frontmatter | STRONG | STRONG | Reading file without required ID yields null. | kept;  |
| src/test/store.test.ts:81 | returns all valid memories, ignores non-memory files | STRONG | STRONG | Enumeration excludes invalid markdown and returns exact Concept B/Decision A titles. | kept;  |
| src/test/store.test.ts:110 | ignores CHANGELOG.md and MANIFEST.md | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-store-manifest | rewritten; g2-store-manifest |
| src/test/store.test.ts:130 | updates frontmatter fields and preserves content | STRONG | STRONG | Update returns literal changed title/confidence/status while preserving body and setting current modified date. | kept;  |
| src/test/store.test.ts:155 | can replace content | STRONG | STRONG | Content replacement returns New content and excludes Old content. | kept;  |
| src/test/store.test.ts:174 | returns null for non-existent memory | STRONG | STRONG | Updating absent memory returns null. | kept;  |
| src/test/store.test.ts:181 | returns only directories, excludes hidden and node_modules | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-store-category | rewritten; g2-store-category |
| src/test/store.test.ts:194 | generates ULID-based IDs with category prefix (v5.4.1+) | STRONG | STRONG | Generated IDs match category/ULID syntax, differ across writes and retain monotonic ordering. | kept;  |
| src/test/store.test.ts:216 | writes and reads supersedes/superseded_by fields | STRONG | STRONG | Actual write/read preserves literal supersedes ID and null superseded_by. | kept;  |
| src/test/stores-command-handler.test.ts:7 | wires stores to runStoresCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerData |
| src/test/stores-invoke.test.ts:41 | prints the resolver summary including the project store | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-stores-output | rewritten; g2-stores-output |
| src/test/stores-invoke.test.ts:49 | still prints a summary when no project store exists | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-stores-output | rewritten; g2-stores-output |
| src/test/structuredIngest.test.ts:21 | extracts title from <h1> | STRONG | Pending | HTML H1 extraction returns literal My Great Post title. | pending;  |
| src/test/structuredIngest.test.ts:30 | extracts title from <title> when no <h1> | STRONG | Pending | HTML title fallback returns literal Page Title. | pending;  |
| src/test/structuredIngest.test.ts:39 | extracts title from markdown heading | STRONG | Pending | Markdown heading extraction returns literal Markdown Title. | pending;  |
| src/test/structuredIngest.test.ts:48 | falls back to filename-derived title | STRONG | Pending | URL slug fallback returns literal My Awesome Page. | pending;  |
| src/test/structuredIngest.test.ts:57 | maps URL to category using config patterns | STRONG | Pending | Blog path rule returns literal blog category. | pending;  |
| src/test/structuredIngest.test.ts:66 | maps /services/* to services category | STRONG | Pending | Services path rule returns literal services category. | pending;  |
| src/test/structuredIngest.test.ts:75 | maps /about* to company category | STRONG | Pending | About wildcard returns literal company category. | pending;  |
| src/test/structuredIngest.test.ts:84 | uses "general" category for unmatched URLs | STRONG | Pending | Unmatched URL returns literal general category. | pending;  |
| src/test/structuredIngest.test.ts:93 | extracts keywords from <meta> tags | STRONG | Pending | Meta keywords produce literal ai, chatbot and automation tags. | pending;  |
| src/test/structuredIngest.test.ts:104 | infers type tag from URL path | STRONG | Pending | Blog/product path inference produces literal article/product tags. | pending;  |
| src/test/structuredIngest.test.ts:120 | sets correct default field values | STRONG | Pending | Generated frontmatter has literal auto-structured/imported/0.7/active provenance fields and date syntax. | pending;  |
| src/test/structuredIngest.test.ts:133 | generates a valid id from URL and category | STRONG | Pending | Blog URL creates literal blog-my-post identifier. | pending;  |
| src/test/structuredIngest.test.ts:142 | validates against expected structure | WEAK | STRONG | Literal observable result now rejects leave required keys with unusable empty values. | rewritten; G1-structured-fields |
| src/test/structuredIngest.test.ts:166 | returns correct term scores across corpus | WEAK | STRONG | Literal observable result now rejects flatten distinct tf-idf scores to one. | rewritten; G1-tfidf-score |
| src/test/structuredIngest.test.ts:183 | handles single-document corpus | WEAK | STRONG | Literal observable result now rejects ignore repeated term frequencies. | rewritten; G1-tfidf-frequency |
| src/test/structuredIngest.test.ts:198 | filters stop words | STRONG | Pending | Stop words the/was are removed while literal quick/brown terms survive. | pending;  |
| src/test/structuredIngest.test.ts:212 | selects top N terms per document | WEAK | STRONG | Literal observable result now rejects drop every selected top term. | rewritten; G1-tfidf-topn |
| src/test/structuredIngest.test.ts:221 | returns empty map for empty input | STRONG | Pending | Empty document list returns an empty TF-IDF map. | pending;  |
| src/test/structuredIngest.test.ts:226 | assigns higher scores to distinctive terms | STRONG | Pending | Distinctive react term outranks shared kubernetes term on the concrete three-document corpus. | pending;  |
| src/test/sync-command-handler.test.ts:13 | wires sync to runSyncCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/sync-command-handler.test.ts:24 | exports runSyncCommand with sync markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/syncClientRead.test.ts:101 | applyPendingOverlay merges pending and excludes ingested ULIDs | STRONG | STRONG | Pending overlay merges exact 01BASE/01PEND IDs and excludes acknowledged 01DONE. | kept;  |
| src/test/syncClientRead.test.ts:164 | listClientReceipts and getIngestedUlids tolerate missing dir and malformed files | STRONG | STRONG | Missing receipt directory yields empty list and mixed valid/malformed files yield exact ingested-ULID set. | kept;  |
| src/test/syncClientRead.test.ts:176 | openClientReadContext uses local db for master role | STRONG | STRONG | Master-role context uses caller-owned DB, master source and empty overlay. | kept;  |
| src/test/syncClientRead.test.ts:186 | openClientReadContext opens master db when client and reachable | STRONG | STRONG | Reachable client context opens remote DB and reads literal On master memory title. | kept;  |
| src/test/syncClientRead.test.ts:196 | openClientReadContext falls back to accepted snapshot when offline | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-snapshot-read | rewritten; g2-snapshot-read |
| src/test/syncClientRead.test.ts:220 | openClientReadContext returns pending-only when offline without snapshot | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-pending-content | rewritten; g2-pending-content |
| src/test/syncClientRead.test.ts:237 | openClientReadContext filters pending overlay by ingest receipts | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-pending-receipt | rewritten; g2-pending-receipt |
| src/test/syncIngest.test.ts:29 | ingests a staged memory and removes the JSON file | STRONG | Pending | Real staged payload sweep ingests one memory with literal Staged title and removes all staged JSON files. | pending;  |
| src/test/syncIngestAutomation.test.ts:39 | quiet mode produces zero stdout | WEAK | Deleted | Duplicate removed. The strengthened ingests staged memory in quiet mode without stdout case proves both persisted content and silence; it kills the quiet no-op mutation that this original test survived. | deleted; g2-quiet-noop |
| src/test/syncIngestAutomation.test.ts:44 | json mode writes a single JSON object to stdout | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-ingest-json | rewritten; g2-ingest-json |
| src/test/syncIngestAutomation.test.ts:56 | json mode still succeeds with zero ingested | STRONG | STRONG | Empty quiet JSON sweep returns zero ingested and empty errors. | kept;  |
| src/test/syncIngestAutomation.test.ts:62 | ingests staged memory in quiet mode without stdout | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-ingest-body, g2-quiet-noop | rewritten; g2-ingest-body, g2-quiet-noop |
| src/test/syncIngestAutomation.test.ts:78 | skips when machine role is client | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-startup-client | rewritten; g2-startup-client |
| src/test/syncIngestAutomation.test.ts:101 | skips when remote sync is disabled | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-startup-disabled | rewritten; g2-startup-disabled |
| src/test/syncIngestAutomation.test.ts:121 | produces valid XML with required keys | STRONG | STRONG | Generated launchd output includes literal label, 900-second interval and ingest/quiet arguments. | kept;  |
| src/test/syncIngestAutomation.test.ts:136 | produces a valid oneshot service unit | STRONG | STRONG | Generated systemd service includes literal oneshot type and full ingest command. | kept;  |
| src/test/syncIngestAutomation.test.ts:144 | produces a timer with configurable interval | STRONG | STRONG | 20-minute systemd timer renders literal OnUnitActiveSec=1200s and timers.target. | kept;  |
| src/test/syncStaging.test.ts:31 | writes atomically and validates checksum on read | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-staging-checksum | rewritten; g2-staging-checksum |
| src/test/syncStaging.test.ts:50 | quarantines checksum mismatch and unknown schemaVersion | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-staging-quarantine | rewritten; g2-staging-quarantine |
| src/test/syncStaging.test.ts:97 | moves stale .tmp files into failed/ | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-staging-copy | rewritten; g2-staging-copy |
| src/test/syncStaging.test.ts:105 | orders queue by ledger firstSeenAt when master DB is available | STRONG | STRONG | Real ledger timestamps order first pending queue entry as literal 01EARLY despite reverse file creation. | kept;  |
| src/test/syncStatusMessages.test.ts:15 | uses design-doc master unreachable wording | COUPLED | Deleted | Imported constant pin duplicates the public renderClientSyncStatusLines shows unreachable + offline overlay case. | deleted;  |
| src/test/syncStatusMessages.test.ts:21 | formats waiting and failed counts | STRONG | Pending | Waiting/failed count formatters return literal zero, singular and plural phrases. | pending;  |
| src/test/syncStatusMessages.test.ts:28 | formats offline push starting message | STRONG | Pending | Offline push report renders literal three waiting and one failed counts. | pending;  |
| src/test/syncStatusMessages.test.ts:33 | renderClientSyncStatusLines shows unreachable + offline overlay | STRONG | STRONG | Literal observable result now rejects render misleading master connectivity message. | rewritten; G1-sync-warning |
| src/test/syncStatusMessages.test.ts:44 | renderClientSyncStatusLines shows waiting and failed when online | STRONG | Pending | Online status renders literal four waiting, one failed and sync-doctor guidance. | pending;  |
| src/test/tags-add-command-handler.test.ts:13 | wires tags-add to runTagsAddCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/tags-add-command-handler.test.ts:23 | exports runTagsAddCommand with tags-add markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/tags-command-handler.test.ts:13 | wires tags to runTagsCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/tags-command-handler.test.ts:22 | exports runTagsCommand with tags markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/tags-invoke.test.ts:49 | adds a new tag to a category | WEAK | STRONG | Literal observable result now rejects skip persisted tag addition. | rewritten; G1-tags-persist |
| src/test/tags-invoke.test.ts:55 | reports a duplicate tag without re-adding it | COUPLED | STRONG | Literal observable result now rejects duplicate persisted tag on second addition. | rewritten; G1-tags-idempotent |
| src/test/tags-invoke.test.ts:60 | lists the registry including the added tag | COUPLED | STRONG | Literal observable result now rejects print unsorted category tags. | rewritten; G1-tags-sort |
| src/test/tags.test.ts:41 | loads tags from tags.json | STRONG | Pending | Loading a real tag file preserves literal auth, decision and dx entries. | pending;  |
| src/test/tags.test.ts:50 | finds existing tags | STRONG | Pending | Existing auth and architecture tags return literal true. | pending;  |
| src/test/tags.test.ts:55 | returns false for non-existent tags | STRONG | Pending | Unknown tag returns literal false. | pending;  |
| src/test/tags.test.ts:61 | adds a new tag to an existing category | STRONG | Pending | Adding frontend returns true and persists literal frontend in reread JSON registry. | pending;  |
| src/test/tags.test.ts:75 | adds a tag to a new category | WEAK | STRONG | Literal observable result now rejects store tag under wrong category. | rewritten; G1-tag-category |
| src/test/tags.test.ts:81 | returns false if tag already exists | STRONG | Pending | Adding existing auth tag returns literal false. | pending;  |
| src/test/tags.test.ts:88 | falls back to DEFAULT_REGISTRY when tags.json is missing | WEAK | STRONG | Literal observable result now rejects replace default domain vocabulary. | rewritten; G1-tag-default |
| src/test/timeline-command-handler.test.ts:13 | wires timeline to runTimelineCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/timeline-command-handler.test.ts:25 | exports runTimelineCommand with timeline markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerBrowse |
| src/test/timeline-invoke.test.ts:47 | prints 'No memories found.' on an empty central DB | STRONG | STRONG | Empty timeline command emits literal No memories found. | kept;  |
| src/test/timeline-invoke.test.ts:53 | groups seeded memories by period (--json) | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-timeline-period | rewritten; g2-timeline-period |
| src/test/timeline-invoke.test.ts:92 | renders the human timeline header for seeded memories | STRONG | STRONG | Human timeline renders literal by-month header and one-memory count. | kept;  |
| src/test/timeline.test.ts:38 | groups by month | STRONG | Pending | Monthly timeline returns literal three periods and January/February/March creation counts two/two/one. | pending;  |
| src/test/timeline.test.ts:52 | groups by year | STRONG | Pending | Year grouping returns literal 2026 period containing five creations. | pending;  |
| src/test/timeline.test.ts:59 | groups by day | WEAK | STRONG | Literal observable result now rejects wrong calendar-day labels preserve bucket count. | rewritten; G1-timeline-day |
| src/test/timeline.test.ts:65 | groups by week | WEAK | STRONG | Literal observable result now rejects shift every week number by one. | rewritten; G1-timeline-week |
| src/test/timeline.test.ts:75 | returns entries sorted chronologically | HOLLOW | STRONG | Literal observable result now rejects drop all timeline entries. | rewritten; G1-timeline-sort |
| src/test/timeline.test.ts:82 | tracks modified separately from created | WEAK | STRONG | Literal observable result now rejects use creation count as modification count. | rewritten; G1-timeline-modified |
| src/test/timeline.test.ts:89 | includes titles for created memories | STRONG | Pending | January title list includes literal Jan Decision and Jan Concept. | pending;  |
| src/test/timeline.test.ts:96 | handles empty array | STRONG | Pending | Empty store yields literal empty timeline. | pending;  |
| src/test/timeline.test.ts:103 | computes total count | STRONG | Pending | Statistics return literal totalCount five. | pending;  |
| src/test/timeline.test.ts:108 | counts by category | STRONG | Pending | Category counts are literal decisions three, concepts one and architecture one. | pending;  |
| src/test/timeline.test.ts:115 | counts by status | STRONG | Pending | Status counts are literal active four and superseded one. | pending;  |
| src/test/timeline.test.ts:121 | counts by author | STRONG | Pending | Author counts are literal human two, ai two and human+ai one. | pending;  |
| src/test/timeline.test.ts:128 | computes average confidence | STRONG | Pending | Average confidence is literal 0.8. | pending;  |
| src/test/timeline.test.ts:134 | finds oldest and newest dates | STRONG | Pending | Oldest/newest/last-modified dates match literal January tenth, March first and March sixth fixtures. | pending;  |
| src/test/timeline.test.ts:141 | handles empty array | STRONG | Pending | Empty-store stats yield zero total/average and null oldest date. | pending;  |
| src/test/trace-command-handler.test.ts:13 | wires trace to runTraceCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/trace-command-handler.test.ts:24 | exports runTraceCommand with trace markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/traverse-command-handler.test.ts:13 | wires traverse to runTraverseCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/traverse-command-handler.test.ts:24 | exports runTraverseCommand with traverse markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerTrace |
| src/test/update-command-handler.test.ts:13 | wires update to runUpdateCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/update-command-handler.test.ts:28 | exports runUpdateCommand with update markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMemory |
| src/test/update-status-command-handler.test.ts:13 | wires update-status to runUpdateStatusCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/update-status-command-handler.test.ts:23 | exports runUpdateStatusCommand with update-status markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/upgrade-command-handler.test.ts:7 | registers upgrade options and helpers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/upgrade-command-handler.test.ts:21 | covers sync prompt and failure paths | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerMaintenance |
| src/test/v511-consumers.test.ts:37 | returns working_directory when no machine.json (legacy) | STRONG | Pending | Legacy project record resolves to its literal saved path. | pending;  |
| src/test/v511-consumers.test.ts:43 | resolves via root when machine is present | STRONG | Pending | Root-mapped project resolves to literal /Users/edward/MSDev/projects/x. | pending;  |
| src/test/v511-consumers.test.ts:49 | prefers an override over root resolution | STRONG | Pending | Explicit project location overrides root-derived path with literal override. | pending;  |
| src/test/v511-consumers.test.ts:56 | returns null when unresolvable and working_directory doesn't exist here | STRONG | Pending | Unresolvable root-mapped project returns literal null. | pending;  |
| src/test/v511-consumers.test.ts:62 | falls back to a legacy working_directory that exists on this disk | STRONG | Pending | Existing legacy directory remains the exact fallback path. | pending;  |
| src/test/v511-consumers.test.ts:71 | resolves workingDirectory via the machine root | STRONG | Pending | Briefing displays exact machine-resolved gnosys-ai directory. | pending;  |
| src/test/v511-consumers.test.ts:78 | reports '(not on this machine)' when unresolvable here | STRONG | Pending | Unresolvable project briefing displays literal (not on this machine). | pending;  |
| src/test/v511-consumers.test.ts:85 | legacy: with no machine.json, falls back to working_directory | STRONG | Pending | Null machine config preserves exact legacy project path in briefing. | pending;  |
| src/test/v511-db-schema.test.ts:42 | persists root_id/rel_path on projects | STRONG | Pending | Actual DB insert/read persists root_id dev and rel_path gnosys-ai. | pending;  |
| src/test/v511-db-schema.test.ts:54 | allows two projects to share a working_directory (UNIQUE dropped) | STRONG | Pending | Two distinct projects sharing same working directory persist as two rows. | pending;  |
| src/test/v511-db-schema.test.ts:64 | supports per-machine project_locations CRUD | STRONG | Pending | Per-machine CRUD persists literal paths, updates only one machine and removes only selected location. | pending;  |
| src/test/v511-db-schema.test.ts:88 | rebuilds the projects table, preserves rows, adds columns + project_locations | STRONG | Pending | Real v3 DB upgrade preserves legacy path and supports new root fields plus location writes. | pending;  |
| src/test/v511-machineConfig.test.ts:41 | defaultMachineConfig has a UUID, hostname, empty roots, disabled remote | STRONG | STRONG | Default machine config has UUID layout, actual hostname, literal empty roots and disabled remote. | kept;  |
| src/test/v511-machineConfig.test.ts:49 | writes machine.json under the config dir and reads it back | STRONG | STRONG | Real machine.json round trip preserves machine ID, concrete root path and enabled remote path. | kept;  |
| src/test/v511-machineConfig.test.ts:64 | readMachineConfig returns null when the file is absent | STRONG | STRONG | Absent machine config returns literal null. | kept;  |
| src/test/v511-machineConfig.test.ts:68 | normalize drops non-string roots and resolves to absolute | STRONG | STRONG | Normalization preserves /a/b root and removes numeric bad root. | kept;  |
| src/test/v511-machineConfig.test.ts:81 | creates machine.json on first run | WEAK | STRONG | Exact header tokens, raw ANSI cells, serialized valid config and fixed seeded machine IDs replace substring/shape/self-equality checks. | rewritten; machine-invalid-fresh-id |
| src/test/v511-machineConfig.test.ts:88 | returns the existing config unchanged when the hostname matches | WEAK | STRONG | Exact header tokens, raw ANSI cells, serialized valid config and fixed seeded machine IDs replace substring/shape/self-equality checks. | rewritten; machine-drop-existing-roots |
| src/test/v511-machineConfig.test.ts:96 | regenerates machineId when a foreign (synced-in) config has a different hostname | STRONG | STRONG | Foreign-host config regenerates ID/current hostname while preserving concrete root and remote paths. | kept;  |
| src/test/v511-machineConfig.test.ts:115 | getMachineId is stable across calls | HOLLOW | STRONG | Exact header tokens, raw ANSI cells, serialized valid config and fixed seeded machine IDs replace substring/shape/self-equality checks. | rewritten; machine-constant-id |
| src/test/v511-machineConfig.test.ts:121 | records the old hostname in previousHostnames on a rename | STRONG | STRONG | Rename records exact prior hostname in previousHostnames and updates current hostname. | kept;  |
| src/test/v511-machineConfig.test.ts:150 | absPathFromRoot joins root + rel, returns null when root/rel missing | STRONG | STRONG | Root-relative resolution yields exact gnosys path and null for missing root/relative inputs. | kept;  |
| src/test/v511-machineConfig.test.ts:159 | relPathUnderRoot picks the deepest matching root | STRONG | STRONG | Overlapping-root resolution returns exact dev mapping and chooses deeper docs root for guide. | kept;  |
| src/test/v511-machineConfig.test.ts:168 | relPathUnderRoot returns null for a path outside every root | STRONG | STRONG | Paths outside all configured roots return literal null. | kept;  |
| src/test/v511-machineMigrate.test.ts:48 | moves machine_id + remote_path out of synced meta into machine.json and scans | STRONG | Pending | Migration moves literal machine/path metadata into actual config, deletes old meta and records scanned project root mapping. | pending;  |
| src/test/v511-machineMigrate.test.ts:74 | regenerates a machineId when no usable meta value exists | STRONG | Pending | Absent legacy ID generates UUID-shaped new ID persisted to config. | pending;  |
| src/test/v511-machineMigrate.test.ts:81 | ignores stale 'unknown-*' meta machineIds | STRONG | Pending | Stale unknown-abc123 is not adopted and migrated ID differs. | pending;  |
| src/test/v511-machineMigrate.test.ts:90 | picks the directory that parents the most registered projects | STRONG | Pending | Registry with majority local projects and temp/outlier entries selects literal shared project root. | pending;  |
| src/test/v511-machineMigrate.test.ts:106 | returns null when the registry has no usable entries | STRONG | Pending | Registry containing only temp entries returns null common root. | pending;  |
| src/test/v511-projectPaths.test.ts:47 | resolves via root_id + rel_path against this machine's root | STRONG | Pending | Root/relative project mapping resolves exact machine-local path. | pending;  |
| src/test/v511-projectPaths.test.ts:52 | prefers a per-machine override over the root resolution | STRONG | Pending | Machine override wins over competing root-derived path. | pending;  |
| src/test/v511-projectPaths.test.ts:58 | returns null when the project's root isn't configured on this machine | STRONG | Pending | Unconfigured project root returns null path. | pending;  |
| src/test/v511-projectPaths.test.ts:63 | returns null for an unknown project | STRONG | Pending | Unknown project returns null path. | pending;  |
| src/test/v511-projectPaths.test.ts:69 | reports provenance per project | STRONG | Pending | Mixed projects expose literal root/override/none provenance and exactly one unresolved path. | pending;  |
| src/test/v511-projectPaths.test.ts:89 | stores machine-independent root_id+rel_path when path is under a root | STRONG | Pending | Recording under-root path persists exact root_id/rel_path with no redundant override. | pending;  |
| src/test/v511-projectPaths.test.ts:102 | stores a per-machine override when path is outside every root | STRONG | Pending | Outside-root recording persists literal override path and resolves it back. | pending;  |
| src/test/v511-projectPaths.test.ts:110 | clears a redundant override once a project moves under a root | STRONG | Pending | Moving project under configured root removes previously stored machine override. | pending;  |
| src/test/v511-projectScan.test.ts:47 | finds projects, including nested ones, and skips noise dirs | STRONG | Pending | Real tree scan finds exact parent/nested projects, excludes node_modules and reports exactly two directories. | pending;  |
| src/test/v511-projectScan.test.ts:70 | creates rows and records machine-portable root_id/rel_path | STRONG | Pending | Real project scan persists root dev and exact relative paths for both seeded projects. | pending;  |
| src/test/v511-projectScan.test.ts:87 | is idempotent — a second scan creates nothing new | STRONG | Pending | Second real scan yields one existing root-mode entry with created false after initial created true. | pending;  |
| src/test/v511-projectScan.test.ts:98 | simulates two machines: same project, different roots, no clobber | STRONG | Pending | Two machine roots resolve shared project to literal dev/shared location with exactly one registry row. | pending;  |
| src/test/v511-serve-handshake.test.ts:34 | connects via gnosys-mcp bin symlink (npm global layout) | WEAK | Pending | Real npm-style bin handshake succeeds, but tool contract is protected only by list length greater than 10. | pending;  |
| src/test/v511-serve-handshake.test.ts:56 | connects and lists tools via node dist/cli.js serve | WEAK | Pending | Real serve handshake succeeds, but tool list is asserted only to contain more than ten entries. | pending;  |
| src/test/v512-centralize.test.ts:37 | copies a consistent brain (with data) to the target | STRONG | STRONG | Real centralized DB copy opens and contains literal seeded project name and memory title. | kept;  |
| src/test/v512-centralize.test.ts:57 | refuses to overwrite an existing target without --force | STRONG | STRONG | Repeated target without force rejects with already-exists error. | kept;  |
| src/test/v512-centralize.test.ts:62 | overwrites with force | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-centralize-force | rewritten; g2-centralize-force |
| src/test/v512-centralize.test.ts:67 | throws when the source brain is missing | STRONG | STRONG | Missing source rejects with No local brain error. | kept;  |
| src/test/v512-http-auth-guard.test.ts:24 | recognizes loopback hosts | STRONG | Pending | Concrete IPv4 localhost variants and bracketed/unbracketed IPv6 loopback classify true. | pending;  |
| src/test/v512-http-auth-guard.test.ts:32 | rejects non-loopback hosts | STRONG | Pending | Wildcard, LAN, Tailscale and IPv6 wildcard hosts classify false. | pending;  |
| src/test/v512-http-auth-guard.test.ts:41 | refuses non-loopback bind without a token | STRONG | Pending | Actual non-loopback server starts without a token reject with Refusing to start. | pending;  |
| src/test/v512-http-auth-guard.test.ts:51 | allows loopback bind without a token | STRONG | Pending | Actual loopback listener starts without token and serves successful HTTP health response. | pending;  |
| src/test/v512-http-auth-guard.test.ts:58 | allows non-loopback bind when a token is set | STRONG | Pending | Actual wildcard listener starts with a token and serves successful HTTP health response. | pending;  |
| src/test/v512-http-bearer.test.ts:33 | missing token → 401 | STRONG | Pending | Real HTTP server rejects absent bearer header with literal status 401. | pending;  |
| src/test/v512-http-bearer.test.ts:38 | wrong token → 401 | STRONG | Pending | Real HTTP server rejects incorrect bearer token with literal status 401. | pending;  |
| src/test/v512-http-bearer.test.ts:47 | correct token → passes the auth gate (not 401) | WEAK | Pending | Correct-token test only excludes 401 and sends invalid initialize params, so 400/500 qualifies as accepted. | pending;  |
| src/test/v512-http-body-limits.test.ts:32 | oversized body → 413 | STRONG | Pending | A real loopback POST exceeds configured 1024-byte cap and receives literal HTTP 413. | pending;  |
| src/test/v512-http-body-limits.test.ts:43 | never-completing body → 408 | STRONG | Pending | An unfinished real HTTP request exceeds the 100ms body deadline and receives literal HTTP 408 before a 2s guard. | pending;  |
| src/test/v512-http-cors.test.ts:33 | disallowed Origin → 403 | STRONG | STRONG | An evil.example Origin receives literal HTTP 403 from the real HTTP server. | kept;  |
| src/test/v512-http-cors.test.ts:43 | no Origin header → not 403 | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-cors-no-origin | rewritten; g2-cors-no-origin |
| src/test/v512-http-cors.test.ts:49 | allowlisted Origin → not 403 | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-cors-allowed | rewritten; g2-cors-allowed |
| src/test/v512-http-session-isolation.test.ts:45 | two concurrent sessions get distinct ids and are independent | STRONG | Pending | Two real HTTP MCP connections get distinct nonempty session IDs/count 2; closing A leaves B able to list ping. | pending;  |
| src/test/v512-http-session-reaper.test.ts:46 | reaps sessions idle beyond sessionIdleMs | STRONG | Pending | Real MCP client creates one session; after idle threshold reaper returns one and session count becomes zero. | pending;  |
| src/test/v512-http-session-reaper.test.ts:62 | does not reap a recently active session | STRONG | Pending | Real newly connected session survives immediate reaping with literal zero removals and one remaining session. | pending;  |
| src/test/v512-mcpClientConfig.test.ts:25 | returns a url entry without a token | STRONG | Pending | Remote MCP entry returns literal URL-only configuration without token. | pending;  |
| src/test/v512-mcpClientConfig.test.ts:29 | includes a bearer header when a token is given | STRONG | Pending | Token configuration produces exact Authorization Bearer header. | pending;  |
| src/test/v512-mcpClientConfig.test.ts:38 | writes .cursor/mcp.json pointing gnosys at the URL | STRONG | Pending | Cursor config writer persists exact remote entry to expected project file. | pending;  |
| src/test/v512-mcpClientConfig.test.ts:48 | merges with an existing mcpServers map (preserves other servers) | STRONG | Pending | Config merge preserves literal unrelated command x and adds exact gnosys URL. | pending;  |
| src/test/v512-mcpClientConfig.test.ts:59 | mergeJsonMcpServer creates the file fresh when absent | STRONG | Pending | Writer creates nested missing config with literal configured URL. | pending;  |
| src/test/v512-mcpHttp.test.ts:46 | serves /health | STRONG | STRONG | The real health endpoint returns success and literal status ok. | kept;  |
| src/test/v512-mcpHttp.test.ts:53 | a client can connect and list tools over HTTP | STRONG | STRONG | An SDK client initializes through the real HTTP transport and lists the ping tool. | kept;  |
| src/test/v512-mcpHttp.test.ts:60 | tracks concurrent sessions independently | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-http-session-isolation | rewritten; g2-http-session-isolation |
| src/test/v512-mcpHttp.test.ts:68 | 404s unknown paths | STRONG | STRONG | A real request to an unknown route receives literal HTTP 404. | kept;  |
| src/test/v512-mcpHttp.test.ts:74 | returns 400 for a non-initialize POST without a session | STRONG | STRONG | A tools/list request lacking a session receives literal HTTP 400. | kept;  |
| src/test/v512-mcpHttp.test.ts:86 | rejects requests without the bearer token | STRONG | STRONG | A server configured with a bearer token rejects a real unauthenticated MCP request with HTTP 401. | kept;  |
| src/test/v512-mcpHttp.test.ts:96 | allows a client that presents the token | STRONG | STRONG | A real SDK client using the configured bearer token connects and receives the ping tool. | kept;  |
| src/test/v512-mcpHttp.test.ts:108 | health probe is reachable without auth | STRONG | STRONG | The health endpoint remains successful when bearer auth is configured and no authorization is supplied. | kept;  |
| src/test/v512-sync-audit.test.ts:82 | push emits a remote_push audit row with counts | STRONG | Pending | Real push persists remote_push audit JSON with exact pushed 1/skipped 0/conflicts 0. | pending;  |
| src/test/v512-sync-audit.test.ts:97 | pull emits a remote_pull audit row with counts | STRONG | Pending | Real pull persists remote_pull audit JSON with exact pulled 1/skipped 0/conflicts 0. | pending;  |
| src/test/v512-sync-audit.test.ts:112 | sync emits both remote_push and remote_pull audit rows | STRONG | Pending | Real bidirectional sync emits both literal remote_push and remote_pull audit operations. | pending;  |
| src/test/v580-helpers.test.ts:41 | returns the value when it's a known format | STRONG | Pending | Valid short/long/raw format strings parse to literal corresponding modes. | pending;  |
| src/test/v580-helpers.test.ts:46 | defaults to short for undefined or unknown values | STRONG | Pending | Unknown, uppercase, empty and undefined format inputs return literal short fallback. | pending;  |
| src/test/v580-helpers.test.ts:57 | raw mode returns the id verbatim, regardless of projectName | STRONG | Pending | Raw formatter preserves exact memory ID regardless of project label. | pending;  |
| src/test/v580-helpers.test.ts:62 | short mode truncates the ULID portion with an ellipsis | STRONG | Pending | Short formatter renders literal project prefix, truncated deci-01HXXJK2 and ellipsis. | pending;  |
| src/test/v580-helpers.test.ts:70 | long mode keeps the full ULID with the project prefix | STRONG | Pending | Long formatter returns exact project label and complete memory ID. | pending;  |
| src/test/v580-helpers.test.ts:74 | omits the project segment when projectName is null/undefined | STRONG | Pending | Null/undefined project labels produce exact complete ID without decoration. | pending;  |
| src/test/v580-helpers.test.ts:79 | short mode without project name still truncates | WEAK | STRONG | Literal observable result now rejects discard projectless display identifier. | rewritten; G1-id-projectless |
| src/test/v580-helpers.test.ts:85 | defaults to short when no format is passed | WEAK | STRONG | Literal observable result now rejects discard default-format display identifier. | rewritten; G1-id-default |
| src/test/v580-helpers.test.ts:90 | handles short ids that don't need truncation gracefully | STRONG | Pending | Short identifier x-1 renders literal p plus x-1 without truncation. | pending;  |
| src/test/v580-helpers.test.ts:97 | builds a gnosys://memory/<id> URI | STRONG | Pending | Memory URI formatter returns exact gnosys URI. | pending;  |
| src/test/v580-helpers.test.ts:100 | encodes characters that would break a URI | STRONG | Pending | Memory URI percent-encodes literal slash and space characters as expected. | pending;  |
| src/test/v580-helpers.test.ts:106 | wraps display text in the OSC8 escape sequence | STRONG | Pending | OSC8 wrapper contains exact escape-sequence form with supplied URI and label. | pending;  |
| src/test/v580-helpers.test.ts:115 | when tty=false, returns the same string as formatMemoryId | HOLLOW | STRONG | Literal observable result now rejects wrong formatter result is reused as expected value. | rewritten; G1-id-nontty |
| src/test/v580-helpers.test.ts:121 | when tty=true, wraps the display text in OSC8 escapes pointing at the full id | WEAK | STRONG | Literal observable result now rejects remove terminal hyperlink escape framing. | rewritten; G1-id-tty |
| src/test/v580-helpers.test.ts:130 | works without a projectName (global/personal memories) | WEAK | STRONG | Literal observable result now rejects return uri instead of projectless clickable label. | rewritten; G1-id-projectless-tty |
| src/test/v580-helpers.test.ts:153 | returns a Map of {project_id → project_name} for all rows | STRONG | Pending | Real DB project-name lookup returns literal alpha/beta names and exactly two entries. | pending;  |
| src/test/v580-helpers.test.ts:181 | returns an empty map when no projects exist | STRONG | Pending | Empty project table returns literal empty map. | pending;  |
| src/test/v580-helpers.test.ts:206 | getMarkerPath points at ~/.gnosys/last-upgrade-at under the current HOME | STRONG | Pending | Upgrade-marker path uses exact selected home and last-upgrade-at basename. | pending;  |
| src/test/v580-helpers.test.ts:211 | readUpgradeMarker returns null when the file doesn't exist | STRONG | Pending | Missing upgrade marker returns literal null. | pending;  |
| src/test/v580-helpers.test.ts:215 | writeUpgradeMarker creates the file with version + timestamp | STRONG | Pending | Written upgrade marker is reread with literal version 9.9.9 plus timestamp/actor fields. | pending;  |
| src/test/v580-helpers.test.ts:224 | readUpgradeMarker round-trips writeUpgradeMarker | STRONG | Pending | Upgrade marker roundtrip preserves literal version 5.8.1. | pending;  |
| src/test/v580-helpers.test.ts:230 | shouldRestartMcp returns false when no marker is present | STRONG | Pending | Missing marker yields literal no-restart false. | pending;  |
| src/test/v580-helpers.test.ts:234 | shouldRestartMcp returns false when marker matches the running version | STRONG | Pending | Equal marker/running versions yield literal no-restart false. | pending;  |
| src/test/v580-helpers.test.ts:239 | shouldRestartMcp returns true when marker is newer than the running version | STRONG | Pending | Newer marker version 5.9.0 against 5.8.0 yields literal restart true. | pending;  |
| src/test/v580-helpers.test.ts:244 | shouldRestartMcp returns false when marker is older than the running version | STRONG | Pending | Older marker version 5.7.0 against 5.8.0 yields literal no-restart false. | pending;  |
| src/test/v580-helpers.test.ts:249 | readUpgradeMarker swallows malformed JSON and returns null | STRONG | Pending | Malformed upgrade-marker JSON returns literal null. | pending;  |
| src/test/v584-updateConfig.test.ts:38 | writes only the keys the caller supplied + any that were already in the file (no defaults seeded) | STRONG | Pending | Real config file contains exact supplied recall values and no seeded llm/defaultProvider defaults. | pending;  |
| src/test/v584-updateConfig.test.ts:61 | preserves explicit values already in the file when adding a new section | STRONG | Pending | Adding recall preserves literal xai provider/grok-4.20 model and writes aggressive true. | pending;  |
| src/test/v584-updateConfig.test.ts:90 | deep-merges nested objects rather than replacing them outright | STRONG | Pending | Nested xAI model update preserves defaultProvider and unrelated OpenAI model while changing grok-4.3. | pending;  |
| src/test/v592-identity-preserves-config.test.ts:25 | does NOT wipe llm config or other user fields when re-writing identity | STRONG | Pending | Actual identity rewrite changes project name while preserving exact LLM/task-model/dream config in the same file. | pending;  |
| src/test/v592-serve-stdout-clean.test.ts:42 | emits zero stdout bytes even when DB app_version is older than pkg.version | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-serve-exit | rewritten; g2-serve-exit |
| src/test/v593-cleanup.test.ts:46 | alive: directory with .gnosys/ subdir | STRONG | Pending | A real registered project directory with .gnosys is present only in alive, with dead and temp empty. | pending;  |
| src/test/v593-cleanup.test.ts:66 | dead: directory exists but no .gnosys/ | STRONG | Pending | A real existing directory without .gnosys is returned in dead. | pending;  |
| src/test/v593-cleanup.test.ts:76 | dead: directory does not exist at all | STRONG | Pending | A nonexistent registered directory is returned in dead. | pending;  |
| src/test/v593-cleanup.test.ts:84 | temp: path under /tmp or /var/folders is classified as temp | STRONG | Pending | A real temporary directory from os.tmpdir is returned in temp. | pending;  |
| src/test/v593-cleanup.test.ts:98 | no registry → empty categories | STRONG | Pending | A missing registry produces three literal empty categories. | pending;  |
| src/test/v593-cleanup.test.ts:108 | with yes=true removes dead+temp and keeps alive | STRONG | Pending | Cleanup removes two stale registrations and persists exactly the single alive project path. | pending;  |
| src/test/v593-cleanup.test.ts:132 | dry-run (interactive=false, yes=false) does NOT write | STRONG | Pending | Dry-run reports one candidate removal and preserves the registry bytes exactly. | pending;  |
| src/test/v593-cleanup.test.ts:147 | no stale entries → no write, removed=0 | STRONG | Pending | An alive-only registry reports removed=0, kept=1 and wrote=false. | pending;  |
| src/test/v593-no-central-db-pollution.test.ts:23 | running gnosys --version with empty HOME does NOT create gnosys.db | WEAK | STRONG | Literal observable result now rejects fail version invocation before producing a version. | rewritten; G1-cli-version-success |
| src/test/v593-no-central-db-pollution.test.ts:51 | VITEST=true short-circuits maybePrintUpgradeNudge — no DB file at all | WEAK | STRONG | Literal observable result now rejects fail help invocation before producing help. | rewritten; G1-cli-help-success |
| src/test/v593-upgrade-nag.test.ts:112 | upgrade (patch): emits `upgraded` on stderr, NO MCP-restart block | STRONG | Pending | A child CLI against a DB stamped one patch older emits upgraded plus the literal version transition and omits restart MCP. | pending;  |
| src/test/v593-upgrade-nag.test.ts:127 | upgrade (minor): emits MCP-restart block | STRONG | Pending | A child CLI against a DB stamped one minor older emits upgraded and restart MCP. | pending;  |
| src/test/v593-upgrade-nag.test.ts:140 | downgrade: emits `reverted` and the unintentional hint | STRONG | Pending | A child CLI against a DB stamped newer emits reverted and the unintentional-downgrade hint. | pending;  |
| src/test/v593-upgrade-nag.test.ts:155 | upgrade nag never writes to stdout | STRONG | Pending | A child CLI against a stale DB emits only the actual package version on stdout. | pending;  |
| src/test/v594-dream-provider-inheritance.test.ts:33 | dream.provider inherits defaultProvider when neither dream.provider nor llm.ollama is set | STRONG | Pending | Loading a real config with xai default and no dream or Ollama override produces dream.provider=xai. | pending;  |
| src/test/v594-dream-provider-inheritance.test.ts:44 | dream.provider stays ollama when user has an llm.ollama block (explicit opt-in) | STRONG | Pending | An explicit Ollama block preserves dream.provider=ollama despite an anthropic default. | pending;  |
| src/test/v594-dream-provider-inheritance.test.ts:59 | dream.provider is left alone when user explicitly set it (even to ollama) | STRONG | Pending | An explicit dream.provider=ollama survives an xai default. | pending;  |
| src/test/v594-dream-provider-inheritance.test.ts:71 | dream.provider takes the user's explicit value over inheritance | STRONG | Pending | An explicit dream.provider=groq survives an anthropic default. | pending;  |
| src/test/v594-dream-provider-inheritance.test.ts:83 | inheritance is skipped when defaultProvider is ollama (no change needed) | STRONG | Pending | An ollama default loads with literal dream.provider=ollama. | pending;  |
| src/test/v594-dream-state.test.ts:56 | config-disabled + no machine designated → disabled | STRONG | Pending | Disabled config without designation resolves literal disabled/default/null state and description. | pending;  |
| src/test/v594-dream-state.test.ts:64 | config-disabled + local-DB designation → enabled via local-db | STRONG | Pending | Local DB designation enables Dream with literal work-a and local-db source. | pending;  |
| src/test/v594-dream-state.test.ts:73 | config-enabled + no DB designation → enabled via config | STRONG | Pending | Enabled config preserves literal anthropic/model and config source despite no DB designation. | pending;  |
| src/test/v594-dream-state.test.ts:81 | config-disabled + only remote DB has machine_id → falls through to remote-db | STRONG | Pending | Remote designation resolves literal nas-dreamer and remote-db source. | pending;  |
| src/test/v594-dream-state.test.ts:89 | local DB wins over remote when both set | STRONG | Pending | Simultaneous local/remote designations select literal local-pick. | pending;  |
| src/test/v594-dream-state.test.ts:97 | describe shows machine when designated | STRONG | Pending | Description renders literal anthropic and dreamer-1 values. | pending;  |
| src/test/v594-dream-state.test.ts:103 | missing remote DB is fine (null) | STRONG | Pending | Null remote DB still resolves enabled local solo designation. | pending;  |
| src/test/v594-grok-build-ide.test.ts:19 | appends a fresh block to empty input | STRONG | STRONG | Empty-input upsert returns exact independently written TOML with command, empty args and timeout 90. | kept;  |
| src/test/v594-grok-build-ide.test.ts:30 | appends a block to existing content separated by a blank line | WEAK | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; grok-empty-block |
| src/test/v594-grok-build-ide.test.ts:40 | replaces an existing [mcp_servers.gnosys] block instead of duplicating it | STRONG | STRONG | Replacement yields one target header, exact new fields, retained other/settings values and no old binary. | kept;  |
| src/test/v594-grok-build-ide.test.ts:67 | is idempotent — second run produces identical bytes | HOLLOW | STRONG | Concrete literal output or reopened persisted state replaces count/absence/self-equality; all original-selected mutations survived before repair. Scheduler mocks only launchctl process execution. | rewritten; grok-empty-block |
| src/test/v594-grok-build-ide.test.ts:73 | removes legacy [mcp.gnosys] and writes [mcp_servers.gnosys] | STRONG | STRONG | Legacy TOML header is replaced by mcp_servers.gnosys with literal gnosys-mcp command. | kept;  |
| src/test/v594-grok-build-ide.test.ts:84 | preserves the [mcp_servers.other] block when replacing [mcp_servers.gnosys] | STRONG | STRONG | Replacing target block preserves literal other command/args and writes timeout 90. | kept;  |
| src/test/v594-panel-edges.test.ts:27 | top and bottom borders have identical printable widths | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-panel-width | rewritten; g2-panel-width |
| src/test/v594-panel-edges.test.ts:43 | ANSI in the title does not shift the right rule | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-panel-title | rewritten; g2-panel-title |
| src/test/v594-panel-edges.test.ts:51 | very long titles fall back to a 1-char clamp instead of negative pad | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-panel-clamp | rewritten; g2-panel-clamp |
| src/test/v594-panel-edges.test.ts:63 | uses rounded glyphs + accent-dim border per design | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-panel-color | rewritten; g2-panel-color |
| src/test/v595-self-healing-machine-id.test.ts:57 | heals a stale `unknown-<rand>` cache when a real hostname is available | STRONG | Pending | Real DB unknown machine ID heals to EdsMacStudio prefix and new value is persisted. | pending;  |
| src/test/v595-self-healing-machine-id.test.ts:72 | heals a stale `dream_machine_id` pointing at the same broken cached id | STRONG | Pending | Healing replaces matching stale Dream designation with the returned new machine ID. | pending;  |
| src/test/v595-self-healing-machine-id.test.ts:87 | leaves a real cached id untouched (no churn) | STRONG | Pending | Existing real-host cached ID remains literal EdsMacStudio-abc123 in DB. | pending;  |
| src/test/v595-self-healing-machine-id.test.ts:104 | leaves an unrelated `dream_machine_id` alone when machine_id heals | STRONG | Pending | Healing leaves unrelated literal OtherMachine Dream designation intact. | pending;  |
| src/test/v5x-migration-matrix.test.ts:176 | migrates a v1 DB to current (user_version=5) | STRONG | Pending | Opening raw v1 SQLite fixture migrates to user_version five, adds expected tables/columns and preserves literal memory data. | pending;  |
| src/test/v5x-migration-matrix.test.ts:183 | migrates a v2 DB to current (user_version=5) | STRONG | Pending | Opening raw v2 fixture migrates to version five while preserving literal project name, scope and memory fields. | pending;  |
| src/test/v600-chat-config-backcompat.test.ts:32 | loads a config file containing chat and taskModels.chat keys without crashing | STRONG | Pending | Real config loader strips obsolete chat settings while preserving literal ollama provider and synthesis model configuration. | pending;  |
| src/test/v600-chat-config-backcompat.test.ts:63 | schema parse strips chat keys directly | STRONG | Pending | Public schema rejects obsolete chat fields from parsed output while retaining supported configuration. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:16 | GnosysConfigSchema.parse({}) leaves defaultProvider undefined | STRONG | Pending | Empty config schema yields absent defaultProvider rather than implicit anthropic selection. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:22 | GnosysConfigSchema.parse({ llm: {} }) leaves defaultProvider undefined | STRONG | Pending | Explicit empty llm object also preserves absent defaultProvider. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:28 | DEFAULT_CONFIG has no defaultProvider | COUPLED | STRONG | Literal observable result now rejects load implicit provider despite absent configuration. | rewritten; G1-no-provider-load |
| src/test/v600-no-anthropic-default.test.ts:32 | an explicitly set defaultProvider survives parse | STRONG | Pending | Explicit groq provider survives schema parsing unchanged. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:38 | throws the run-setup message when unset | STRONG | Pending | Missing provider produces exact setup-required error from public requireDefaultProvider helper. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:45 | returns the value when set | STRONG | Pending | Configured provider helper returns literal ollama. | pending;  |
| src/test/v600-no-anthropic-default.test.ts:51 | generateConfigTemplate() output contains no defaultProvider | WEAK | STRONG | Literal observable result now rejects return empty template. | rewritten; G1-config-template |
| src/test/web-add-command-handler.test.ts:13 | wires web add to runWebAddCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-add-command-handler.test.ts:26 | exports runWebAddCommand with web add markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-build-command-handler.test.ts:13 | wires web build to runWebBuildCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-build-command-handler.test.ts:28 | exports runWebBuildCommand with web build markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-build-index-command-handler.test.ts:13 | wires web build-index to runWebBuildIndexCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-build-index-command-handler.test.ts:26 | exports runWebBuildIndexCommand with web build-index markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-command-handler.test.ts:7 | declares web as a parent container with leaf subcommand handlers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-command-handler.test.ts:63 | has no parent action between web declaration and first leaf command | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-ingest-command-handler.test.ts:13 | wires web ingest to runWebIngestCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-ingest-command-handler.test.ts:29 | exports runWebIngestCommand with web ingest markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-init-command-handler.test.ts:13 | wires web init to runWebInitCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-init-command-handler.test.ts:27 | exports runWebInitCommand with web init markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-remove-command-handler.test.ts:13 | wires web remove to runWebRemoveCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-remove-command-handler.test.ts:23 | exports runWebRemoveCommand with web remove markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-remove-invoke.test.ts:59 | removes a knowledge file and rebuilds the index (--json) | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-remove-index | rewritten; g2-web-remove-index |
| src/test/web-remove-invoke.test.ts:68 | refuses to remove a path outside the knowledge directory | STRONG | STRONG | Traversal outside knowledge root produces exit(1) and the literal refusal message. | kept;  |
| src/test/web-remove-invoke.test.ts:77 | errors on a missing file | STRONG | STRONG | A missing file produces exit(1) and literal File not found output. | kept;  |
| src/test/web-status-command-handler.test.ts:13 | wires web status to runWebStatusCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-status-command-handler.test.ts:23 | exports runWebStatusCommand with web status markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-update-command-handler.test.ts:13 | wires web update to runWebUpdateCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/web-update-command-handler.test.ts:25 | exports runWebUpdateCommand with web update markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerWeb |
| src/test/webExpansions.test.ts:99 | normalizes valid provider JSON and filters self-references and stop words | STRONG | Pending | Real expansion normalization filters self/stopwords/duplicates and returns exact lowercase desserts/fruit maps. | pending;  |
| src/test/webExpansions.test.ts:127 | returns an empty map instead of throwing on malformed provider output | STRONG | Pending | Malformed external provider JSON yields literal empty map and invalid JSON warning. | pending;  |
| src/test/webExpansions.test.ts:137 | selects candidates by document frequency and respects maxTokens | STRONG | Pending | External provider sees literal common, medium candidate selection and returned map excludes rare expansion. | pending;  |
| src/test/webExpansions.test.ts:186 | bumps an index to v2 when a non-empty map is attached | STRONG | Pending | Attaching nonempty expansion map yields v2 with exact normalized desserts-to-cookie mapping. | pending;  |
| src/test/webExpansions.test.ts:195 | keeps indexes at v1 when the map is empty | STRONG | Pending | Empty expansion map preserves v1 and no expansions field. | pending;  |
| src/test/webExpansions.test.ts:202 | lets buildIndexSync attach injected expansions without changing default builds | STRONG | Pending | Indexing actual Markdown defaults to v1 and explicit expansions produce v2 with literal map. | pending;  |
| src/test/webExpansions.test.ts:218 | accepts v1 and v2 indexes and still rejects future versions | STRONG | Pending | Loader accepts v1/v2 and rejects future version 3 with explicit error. | pending;  |
| src/test/webExpansions.test.ts:233 | returns expanded-only matches at the documented 0.5x score discount | STRONG | Pending | Expansion search returns exact direct score 4, expanded score 2 and cookie matched token. | pending;  |
| src/test/webExpansions.test.ts:245 | does not double-count a token that is both direct and expanded | STRONG | Pending | Direct-plus-expanded cookie term scores exactly 4 once with one cookie matched token. | pending;  |
| src/test/webExpansions.test.ts:255 | honors expandQuery false and matches a no-expansions index | STRONG | Pending | Opt-out equals base results and independently returns exactly the direct document ID. | pending;  |
| src/test/webExpansions.test.ts:266 | searches v1 indexes identically when no expansions field exists | HOLLOW | Pending | Both search inputs are equivalent v1 indexes, and the only assertion compares outputs of search to itself. | pending;  |
| src/test/webExpansions.test.ts:274 | participates in semantic fusion on a v2 index | STRONG | Pending | Expanded v2 semantic fusion retains cookie token match and exact semantic document cosine 1. | pending;  |
| src/test/webIndex.test.ts:61 | returns empty index for empty directory | STRONG | Pending | Empty directory yields exact version-one manifest with zero documents and empty inverted index. | pending;  |
| src/test/webIndex.test.ts:69 | indexes a single markdown file | STRONG | Pending | Real Markdown file produces literal ID/title/category/tags/date/status fields in manifest. | pending;  |
| src/test/webIndex.test.ts:91 | indexes multiple files across subdirectories | STRONG | Pending | Recursive scan returns exactly two literal document IDs across root and subdirectory. | pending;  |
| src/test/webIndex.test.ts:100 | weights relevance keywords higher than content | WEAK | STRONG | Literal observable result now rejects omit all content-body postings. | rewritten; G1-web-weight |
| src/test/webIndex.test.ts:123 | respects stop-word filtering | WEAK | STRONG | Literal observable result now rejects keep quick token key but lose its postings. | rewritten; G1-web-stop |
| src/test/webIndex.test.ts:138 | disables stop-word filtering when option is false | WEAK | STRONG | Literal observable result now rejects keep stop-word key but lose its postings. | rewritten; G1-web-stop-disabled |
| src/test/webIndex.test.ts:152 | skips archived documents by default | STRONG | Pending | Default archive filter returns exactly one literal active document ID. | pending;  |
| src/test/webIndex.test.ts:161 | includes archived documents when includeArchived is true | WEAK | STRONG | Literal observable result now rejects duplicate active id in place of archived document. | rewritten; G1-web-archived |
| src/test/webIndex.test.ts:169 | computes correct content hashes | WEAK | STRONG | Literal observable result now rejects write constant-shaped content digest. | rewritten; G1-web-hash |
| src/test/webIndex.test.ts:176 | handles files with no frontmatter id (uses filename) | STRONG | Pending | Missing frontmatter ID falls back to literal my-file filename stem. | pending;  |
| src/test/webIndex.test.ts:189 | handles files with malformed frontmatter gracefully | STRONG | Pending | Malformed YAML is skipped while literal good document g1 remains. | pending;  |
| src/test/webIndex.test.ts:206 | produces deterministic output for same input | HOLLOW | STRONG | Literal observable result now rejects return consistently empty index for populated corpus. | rewritten; G1-web-determinism |
| src/test/webIndex.test.ts:222 | version field is set to 1 | STRONG | Pending | Default build returns literal version one as required by runtime wire format. | pending;  |
| src/test/webIndex.test.ts:227 | generated timestamp is valid ISO string | STRONG | Pending | Generated timestamp survives ISO parse/serialize exactly, rejecting malformed or noncanonical output. | pending;  |
| src/test/webIndex.test.ts:233 | handles nested tag objects | STRONG | Pending | Nested tag object flattens to literal backend/api/decision list. | pending;  |
| src/test/webIndex.test.ts:249 | returns same result as sync version | HOLLOW | STRONG | Literal observable result now rejects return empty index through sync and async paths. | rewritten; G1-web-async |
| src/test/webIndex.test.ts:261 | creates a valid JSON file | WEAK | STRONG | Literal observable result now rejects lose document/posting content during serialization. | rewritten; G1-web-write |
| src/test/webIndex.test.ts:275 | overwrites existing index file | WEAK | STRONG | Literal observable result now rejects replace old index with header-only document. | rewritten; G1-web-overwrite |
| src/test/webIngest.test.ts:76 | reads local markdown files and creates knowledge files | WEAK | Pending | Ingestion checks one added report entry and one Markdown path but never reads the generated memory body. | pending;  |
| src/test/webIngest.test.ts:89 | handles .md source files with existing frontmatter | WEAK | Pending | Frontmatter source case checks only added count/no errors, leaving title and body preservation unchecked. | pending;  |
| src/test/webIngest.test.ts:97 | handles .html source files by converting to markdown | WEAK | Pending | HTML conversion checks only output title text, so raw HTML written into Markdown passes. | pending;  |
| src/test/webIngest.test.ts:114 | strips MDX components from .mdx files | STRONG | Pending | Real MDX ingestion removes component/import syntax while preserving literal Regular markdown here body. | pending;  |
| src/test/webIngest.test.ts:131 | skips unchanged pages on re-ingest (content hash match) | WEAK | Pending | Second ingest checks only unchanged/added/updated report counts, not whether existing artifact is rewritten or damaged. | pending;  |
| src/test/webIngest.test.ts:143 | updates changed pages on re-ingest | WEAK | Pending | Changed-source reingest checks updated report count but never reads Version 2 or new body. | pending;  |
| src/test/webIngest.test.ts:157 | creates category subdirectories in output | WEAK | Pending | Category-directory case only requires any output entry, not a category directory or correct path. | pending;  |
| src/test/webIngest.test.ts:168 | handles empty content directory | STRONG | Pending | Empty content source yields literal empty added/updated/unchanged/errors arrays. | pending;  |
| src/test/webIngest.test.ts:176 | returns correct IngestResult counts | STRONG | Pending | Three concrete source files yield exact added 3 and zero updated/unchanged/errors counts. | pending;  |
| src/test/webIngest.test.ts:193 | does not write files in dry-run mode | STRONG | Pending | Dry run reports one planned addition while actual output contains zero Markdown files. | pending;  |
| src/test/webIngest.test.ts:209 | removes orphaned knowledge files when prune is enabled | WEAK | Pending | Prune checks reported orphan filename but never verifies the orphan was deleted. | pending;  |
| src/test/webIngest.test.ts:225 | preserves orphaned files when prune is disabled | STRONG | Pending | Disabled prune reports zero removals and leaves the actual orphan file present. | pending;  |
| src/test/webIngest.test.ts:243 | processes a single URL (mocked) | WEAK | Pending | Single-URL ingestion checks only one added count and no errors, not requested URL or generated content. | pending;  |
| src/test/webIngest.test.ts:263 | fetches and parses sitemap XML | WEAK | Pending | Sitemap case only asserts two added report entries; requested URLs and generated page content are unchecked. | pending;  |
| src/test/webIngest.test.ts:287 | respects exclude patterns | WEAK | Pending | Exclude case only asserts one addition, allowing the wrong URL to be ingested. | pending;  |
| src/test/webIngest.test.ts:312 | handles fetch errors gracefully | STRONG | Pending | Real sitemap processing of mocked HTTP responses reports one addition and one error associated with literal /bad URL. | pending;  |
| src/test/webIngest.test.ts:336 | handles sitemap index files | WEAK | Pending | Nested sitemap case asserts only one addition, without requested child URL or written content. | pending;  |
| src/test/webIngest.test.ts:368 | removes the knowledge directory | STRONG | Pending | Public removeKnowledge removes a real populated directory. | pending;  |
| src/test/webIngest.test.ts:377 | handles non-existent directory gracefully | WEAK | Pending | Missing-directory removal only asserts nonthrowing completion without a success value or meaningful operation. | pending;  |
| src/test/webIngest.test.ts:385 | wraps ingestSite with directory source | WEAK | Pending | Directory convenience wrapper only asserts one reported addition without written artifact or correct source configuration. | pending;  |
| src/test/webIntegration.test.ts:59 | sample-index.json is valid and loadable | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-load-title | rewritten; g2-web-load-title |
| src/test/webIntegration.test.ts:66 | sample knowledge files have valid frontmatter | HOLLOW | Deleted | The existing full pipeline builds and searches these fixtures. Reads static fixture contents or directory entries and asserts only fixture structure; never calls application code. | deleted;  |
| src/test/webIntegration.test.ts:81 | sample HTML pages exist and are valid | HOLLOW | Deleted | Structured ingest cases call the application extractor on these fixtures. Reads static fixture contents or directory entries and asserts only fixture structure; never calls application code. | deleted;  |
| src/test/webIntegration.test.ts:93 | sample MDX files exist | HOLLOW | Deleted | Removed a fixture file-count check with no application behavior. Reads static fixture contents or directory entries and asserts only fixture structure; never calls application code. | deleted;  |
| src/test/webIntegration.test.ts:103 | ingests markdown files and builds a searchable index | STRONG | STRONG | The real index build/write/load/search pipeline yields five documents and an Agentic top hit for automation agents workflow. | kept;  |
| src/test/webIntegration.test.ts:117 | search respects category filter | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-category | rewritten; g2-web-category |
| src/test/webIntegration.test.ts:129 | search respects tag filter | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-tags | rewritten; g2-web-tags |
| src/test/webIntegration.test.ts:139 | getDocument retrieves specific document from built index | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-getdoc | rewritten; g2-web-getdoc |
| src/test/webIntegration.test.ts:150 | listDocuments filters by category on built index | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-list-category | rewritten; g2-web-list-category |
| src/test/webIntegration.test.ts:166 | extracts title and category from HTML content | STRONG | STRONG | Real structured extraction of about-page HTML yields an About title and literal mapped company category. | kept;  |
| src/test/webIntegration.test.ts:179 | extracts category from URL patterns for blog posts | STRONG | STRONG | Real extraction maps a matching blog URL to literal category blog. | kept;  |
| src/test/webIntegration.test.ts:192 | falls back to general category for unmatched URLs | STRONG | STRONG | An unmatched URL maps to literal fallback category general. | kept;  |
| src/test/webIntegration.test.ts:205 | computes distinctive terms for each document | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-tfidf | rewritten; g2-web-tfidf |
| src/test/webIntegration.test.ts:222 | automation doc gets automation-related terms | STRONG | STRONG | Real TF-IDF for the automation document must include at least one literal domain term automation, agentic or workflow. | kept;  |
| src/test/webIntegration.test.ts:244 | MDX fixtures contain content that should be processable | HOLLOW | Deleted | Removed a fixture nonempty check with no application behavior. Reads static fixture contents or directory entries and asserts only fixture structure; never calls application code. | deleted;  |
| src/test/webIntegration.test.ts:255 | building index twice produces identical output | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-determinism | rewritten; g2-web-determinism, g2-web-deterministic-corruption, g2-web-deterministic-corruption |
| src/test/webIntegration.test.ts:274 | staticSearch.ts only imports from Node.js fs | COUPLED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-web-native-isolation | rewritten; g2-web-native-isolation |
| src/test/webIntegration.test.ts:292 | staticSearch.ts has no import type that would pull runtime deps | COUPLED | Deleted | Replaced by the published web entry searches without third-party runtime dependencies. | deleted;  |
| src/test/webVectors-command-handler.test.ts:148 | builds vectors for a valid embeddings provider and reports stats in JSON | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-write |
| src/test/webVectors-command-handler.test.ts:171 | rejects an invalid embeddings provider before writing output | STRONG | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-validation |
| src/test/webVectors-command-handler.test.ts:184 | does not build vectors when --embeddings is absent | WEAK | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-write, web-index-skip-write |
| src/test/webVectors-command-handler.test.ts:194 | generates and attaches expansions by default when a provider resolves | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-write |
| src/test/webVectors-command-handler.test.ts:210 | honors --no-expansions and writes a v1 index | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-write |
| src/test/webVectors-command-handler.test.ts:221 | skips expansions without crashing when no LLM provider is resolvable | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-index-write |
| src/test/webVectors-command-handler.test.ts:236 | threads vector options through the full build command | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-build-write |
| src/test/webVectors-command-handler.test.ts:264 | skips index and vector generation during dry runs | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-dry-run |
| src/test/webVectors-command-handler.test.ts:285 | reports vector model, dimensions, count, and size in text and JSON output | STRONG | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-status-count |
| src/test/webVectors-command-handler.test.ts:314 | reports a missing vectors file with a build hint | STRONG | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-status-missing |
| src/test/webVectors-command-handler.test.ts:323 | reports corrupt vector JSON as present with size only | WEAK | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-corrupt-size |
| src/test/webVectors-command-handler.test.ts:337 | keeps the init wizard non-interactive while mentioning the embeddings option | COUPLED | STRONG | Real config/filesystem/artifact or CLI output assertion; recorded mutation kills this case and restored code passes. | rewritten; web-init-write |
| src/test/webVectors.test.ts:95 | posts OpenAI embedding batches with configured headers and maps vectors by document id | WEAK | STRONG | Literal observable result now rejects reverse document-to-embedding association. | rewritten; G1-web-vector-association |
| src/test/webVectors.test.ts:142 | posts Voyage embedding requests using VOYAGE_API_KEY only | STRONG | Pending | Voyage boundary request carries literal URL/key/model/input and returned artifact records literal voyage model. | pending;  |
| src/test/webVectors.test.ts:164 | throws when the OpenAI API key is missing | STRONG | Pending | Missing OpenAI key rejects with literal require-key diagnostic and sends no request. | pending;  |
| src/test/webVectors.test.ts:171 | throws with status details when an API request fails | STRONG | Pending | Failed HTTP embedding response propagates literal 500 Server Error and bad-request detail. | pending;  |
| src/test/webVectors.test.ts:183 | reuses GnosysEmbeddings.embedBatch and quantizes local vectors | COUPLED | STRONG | Literal observable result now rejects zero actual local embedding vectors. | rewritten; G1-local-vector-path |
| src/test/webVectors.test.ts:204 | round-trips vectors while preserving cosine ranking order for fixed fixtures | WEAK | STRONG | Literal observable result now rejects return unquantized floats. | rewritten; G1-web-vector-int8 |
| src/test/webVectors.test.ts:233 | writes pretty JSON with the WebVectorsFile shape | STRONG | Pending | Real writer persists exact literal vector object with expected filename and pretty JSON formatting. | pending;  |
| src/test/webingest-ssrf.test.ts:31 | `rejects ${url}` | STRONG | Pending | Public URL validator returns false for each concrete blocked scheme/private/metadata/encoded-loopback/IPv6 URL. | pending;  |
| src/test/webingest-ssrf.test.ts:36 | allows a normal public https URL | STRONG | Pending | Normal public https://example.com/page URL validates true. | pending;  |
| src/test/webingest-ssrf.test.ts:40 | allows loopback only when explicitly opted in | STRONG | Pending | Explicit loopback opt-in returns true while the same URL without opt-in returns false. | pending;  |
| src/test/webingest-ssrf.test.ts:45 | rejects redirects to cloud metadata endpoints | STRONG | Pending | Public safeFetch follows a mocked redirect boundary and rejects cloud metadata target with unsafe URL error. | pending;  |
| src/test/wikilinks.test.ts:67 | extracts simple wikilinks | STRONG | STRONG | extractLinks returns exactly DB Choice and architecture/three-layers with a literal null display alias. | kept;  |
| src/test/wikilinks.test.ts:75 | extracts wikilinks with display text | STRONG | STRONG | An aliased wikilink yields literal target Auth Decision and display text our auth approach. | kept;  |
| src/test/wikilinks.test.ts:82 | returns empty array for content with no links | STRONG | STRONG | Link-free content produces an empty extracted-link array. | kept;  |
| src/test/wikilinks.test.ts:87 | includes source info | STRONG | STRONG | Extracted links carry literal source path decisions/auth-decision.md and source title Auth Decision. | kept;  |
| src/test/wikilinks.test.ts:95 | resolves by title (case-insensitive) | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-wiki-exact-title | rewritten; g2-wiki-exact-title |
| src/test/wikilinks.test.ts:100 | resolves by title case-insensitively | STRONG | STRONG | Lowercase db choice resolves to literal ID db-choice. | kept;  |
| src/test/wikilinks.test.ts:105 | resolves by relative path | STRONG | STRONG | The architecture/three-layers.md path resolves to literal ID three-layers. | kept;  |
| src/test/wikilinks.test.ts:110 | resolves by filename without extension | STRONG | STRONG | The extensionless filename three-layers resolves to literal ID three-layers. | kept;  |
| src/test/wikilinks.test.ts:115 | resolves by id | MISLABELED | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-wiki-id | rewritten; g2-wiki-id |
| src/test/wikilinks.test.ts:120 | returns null for non-existent target | STRONG | STRONG | An unknown target produces literal null. | kept;  |
| src/test/wikilinks.test.ts:127 | builds graph with correct link counts | STRONG | STRONG | The concrete four-memory graph reports exactly five extracted links. | kept;  |
| src/test/wikilinks.test.ts:132 | tracks outgoing links | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-wiki-graph-outgoing | rewritten; g2-wiki-graph-outgoing |
| src/test/wikilinks.test.ts:138 | tracks backlinks (incoming) | STRONG | STRONG | Auth backlinks contain exactly two links from literal DB Choice and Frontend Guide. | kept;  |
| src/test/wikilinks.test.ts:148 | identifies orphaned links | STRONG | STRONG | The graph identifies exactly one orphan with literal target Nonexistent Memory and source Frontend Guide. | kept;  |
| src/test/wikilinks.test.ts:155 | handles memories with no links | STRONG | STRONG | The concrete Three Layers memory has zero outgoing and one incoming link. | kept;  |
| src/test/wikilinks.test.ts:163 | handles empty memory list | STRONG | STRONG | An empty input produces zero total links, no orphaned links and no graph nodes. | kept;  |
| src/test/wikilinks.test.ts:172 | returns backlinks for a target | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-wiki-backlinks | rewritten; g2-wiki-backlinks |
| src/test/wikilinks.test.ts:177 | returns empty for memory with no backlinks | STRONG | STRONG | A frontend memory with no backlinks returns an empty array. | kept;  |
| src/test/wikilinks.test.ts:184 | returns outgoing links for a source | WEAK | STRONG | Now asserts observable output; relevant production mutations were killed and restored runs passed: g2-wiki-outgoing | rewritten; g2-wiki-outgoing |
| src/test/wikilinks.test.ts:189 | returns empty for memory with no outgoing links | STRONG | STRONG | A layers memory without outgoing links returns an empty array. | kept;  |
| src/test/wikilinks.test.ts:196 | produces a readable summary | STRONG | STRONG | The rendered graph summary contains literal total=5, orphaned=1, Auth Decision and Nonexistent Memory. | kept;  |
| src/test/wikilinks.test.ts:205 | handles empty graph | STRONG | STRONG | The empty graph summary includes literal zero links and No cross-references found. | kept;  |
| src/test/working-set-command-handler.test.ts:13 | wires working-set to runWorkingSetCommand via dynamic import | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/working-set-command-handler.test.ts:24 | exports runWorkingSetCommand with working-set markers | COUPLED | STRONG | Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix. | rewritten; cli-registerAgent |
| src/test/working-set-invoke.test.ts:98 | returns the recently modified project memory (--json) | STRONG | Pending | Real command JSON returns exact project ID, count one and literal recently modified memory ID. | pending;  |
| src/test/working-set-invoke.test.ts:106 | returns an empty working set for a zero-hour window (--json) | STRONG | Pending | Zero-hour window produces exact zero-count JSON for the seeded older memory. | pending;  |
| e2e-setup/tests/version.sh | cli-installs-and-reports-version | WEAK | STRONG | Only a nonempty semver prefix is required; version does not have to equal the packed package version despite the file comment. | rewritten; setup-version |
| e2e-setup/tests/init.exp | init-creates-isolated-store | WEAK | STRONG | An exit-zero init that creates only an empty .gnosys directory passes; identity contents and registry record are never checked. | rewritten; setup-identity-name |
| e2e-setup/tests/setup-wizard.exp | setup-wizard-first-screen | STRONG | STRONG | Expect drives a real PTY, requires a setup/provider/step prompt and exact cancellation-message shape, fails timeout or stack trace. The no-writes promise inside the message is not itself verified. | kept; setup-cancel-message |
| e2e-setup/tests/setup-non-interactive.sh | setup-non-interactive | WEAK | STRONG | Only exit status and absence of a JS stack are checked. An empty successful no-op passes; no required config/state is checked. | rewritten; setup-default-model |
| e2e-setup/tests/web-init.exp | web-init-wizard | WEAK | STRONG | Real prompts and success are checked, but only knowledge directory existence is asserted; no web configuration or answers are checked. | rewritten; setup-web-config |
| e2e-setup/tests/isolation.sh | isolation-no-stray-writes | MISLABELED | STRONG | Only /home/tester files newer than run-all.sh are rejected. /tmp gnosys paths only produce a note. No other writable directory outside HOME is checked, despite claiming all writes confined to HOME. Prefix allowlist also accepts sibling names such as .gnosys-unexpected. | rewritten; setup-stray-write |
| .github/workflows/ci.yml | Multi-project scenario test | WEAK | STRONG | Counts only require >=1 so returning every project is accepted; A_SEARCH and B_SEARCH are calculated and echoed, never asserted. Thus the named cross-project search isolation subcase has no assertion. | rewritten; ci-multi-project-empty-search |
| .github/workflows/ci.yml | Network share simulation (tmpfs) | MISLABELED | STRONG | Only mktemp runs; no tmpfs/network mount or latency/failure simulation exists. DB is central HOME. Search failure is converted to empty results, and both search/stats outputs are merely printed. | rewritten; ci-network-share-empty-search |
| See runtime table | Phase C — settings panel (summary) DEF-G1-001 reset routing clears persisted task overrides | Added | STRONG | Baseline expected failure; temporary corrective source change makes assertion pass and Vitest fail as an unexpected success; restored expected failure passes. | expected_failure; G1-routing-reset-defect |
| See runtime table | memory lifecycle through database reads and search writing the same memory twice keeps one searchable result | Added | STRONG | Ordinary test fails because repeated upsert duplicates the FTS hit; temporary FTS replacement repair makes it unexpectedly pass, then restored expected-failure test passes. | expected_failure; g2-fts-upsert-repair-witness |
| See runtime table | GnosysIngestion isLLMAvailable reports availability for absent and configured local providers | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; ingestion-available-always |
| See runtime table | Phase 8c: CLI Parity TC-8c.3: CLI auto-detects projectId from gnosys.json CLI scopes list to the current working directory and shared memories | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; cli-list-empty |
| See runtime table | checkDreamLaunchAgent reports missing, healthy, and broken installed agents in an isolated home | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; launchd-always-absent |
| See runtime table | fnv1a D-G3-001: matches the multi-character 32-bit FNV-1a vector | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; hash-length |
| See runtime table | fnv1a matches the empty-input and one-character 32-bit vectors | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; hash-length |
| See runtime table | gnosys init creates a usable registered store without legacy artifacts | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; cli-identity-invalid, init-invalid-identity, init-noop, init-skip-registration |
| See runtime table | gnosys init re-syncs the working directory while retaining a valid project ID | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; cli-identity-invalid, init-invalid-identity, init-resync-noop |
| See runtime table | gnosys init writes the default categorized tag registry | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; init-null-tags |
| See runtime table | splitIntoChunks keeps an oversized word intact | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| See runtime table | splitIntoChunks merges a short chunk with its next paragraph | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| See runtime table | splitIntoChunks preserves text and paragraph separators within the target | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| See runtime table | splitIntoChunks returns no chunks for whitespace | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| See runtime table | splitIntoChunks splits an oversized paragraph at sentence boundaries | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| See runtime table | splitIntoChunks splits paragraphs at the target and preserves order | Added | STRONG | Passed in full-file checkpoint run and killed the linked application mutation, except the explicitly documented expected production defect. | undefined; chunks-empty-output, chunks-whitespace |
| src/test/vscode-extension.test.ts | VS Code extension public commands warns when no editor is open | Added | STRONG | Literal editor notification changes fail under recorded application mutations; restored code passes. | added; vscode-no-editor |
| src/test/vscode-extension.test.ts | VS Code extension public commands warns when the active file is outside a memory directory | Added | STRONG | Literal editor notification changes fail under recorded application mutations; restored code passes. | added; vscode-outside-memory |
| src/test/vscode-extension.test.ts | VS Code extension public commands reports a process launch failure to the editor | Added | STRONG | Literal editor notification changes fail under recorded application mutations; restored code passes. | added; vscode-command-error |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-001: reinforcing an open memory resets its persisted decay date | Added | STRONG | Public extension command drives real local CLI; only VS Code host services are replaced. Expected-failure repair probes become unexpected passes and restored code returns to expected failure. | expected_failure; repair-D-VSC-001 |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-002: rejects a directory whose name only starts with .gnosys | Added | STRONG | Public extension command drives real local CLI; only VS Code host services are replaced. Expected-failure repair probes become unexpected passes and restored code returns to expected failure. | expected_failure; repair-D-VSC-002 |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-003: passes shell syntax in a filename as literal text | Added | STRONG | Public extension command drives real local CLI; only VS Code host services are replaced. Expected-failure repair probes become unexpected passes and restored code returns to expected failure. | expected_failure; repair-D-VSC-003 |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-004: the dashboard action opens a command supported by the installed CLI | Added | STRONG | Public extension command drives real local CLI; only VS Code host services are replaced. Expected-failure repair probes become unexpected passes and restored code returns to expected failure. | expected_failure; repair-D-VSC-004 |

### Current runtime cases

| File | Runtime name | Classification | Runner status | Proof |
| --- | --- | --- | --- | --- |
| src/test/acceptance-features.test.ts | Acceptance feature smokes MCP server lists gnosys tools and round-trips init + add + search | UNMAPPED | passed | See source review |
| src/test/acceptance-features.test.ts | Acceptance feature smokes Web Knowledge Base builds an index from docs and returns search hits | UNMAPPED | passed | See source review |
| src/test/acceptance-features.test.ts | Acceptance feature smokes Multi-machine sync propagates a memory from machine A to machine B via remote dir | UNMAPPED | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.1: gnosys init in two separate projects initializes project A and B successfully | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.1: gnosys init in two separate projects both projects have unique projectIds | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.2: Memories and preferences in project A adds project-scoped memories to project A | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.2: Memories and preferences in project A adds user-scoped preferences | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.3: Preferences visible from project B user preferences are accessible regardless of project context | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.3: Preferences visible from project B generated rules include user preferences regardless of project | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.4: Cross-project search federated search returns results from both projects | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.6: Obsidian export exports memories to Obsidian vault | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.7: Backup and restore backs up the central database | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.8: Multi-root project scenario separate projects have independent memory spaces | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.8: Multi-root project scenario user preferences span all project roots | STRONG | passed | See source review |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.9: CLI and library API both functional CLI list command works on initialized project | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.9: CLI and library API both functional library API (GnosysDB) and CLI produce consistent results | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/acceptance.test.ts | Final Acceptance Tests TC-A.9: CLI and library API both functional all major DB operations work in sequence | STRONG | passed | See source review |
| src/test/ambiguity-invoke.test.ts | runAmbiguityCommand (in-process invoke) reports no ambiguity for a query with no cross-project hits (human) | UNMAPPED | passed | See source review |
| src/test/ambiguity-invoke.test.ts | runAmbiguityCommand (in-process invoke) emits structured JSON with ambiguous: false | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault names global and provider scoped keys | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault lookup chain prefers global over provider | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault readFirstInChain falls through to legacy env | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault readFirstInChain falls through to GNOSYS_LLM_API_KEY for any provider | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault buildApiKeyRequirements emits one global key per cloud provider | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault lookup chain order is global then provider | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault maskKeySnippet shows first and last characters | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault listStoredKeySlots finds env global key | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation returns the first env match with its variable name | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation falls back to the gnosys dotenv file | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation finds a global tier keychain key | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation prefers global keychain over provider env | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation falls through to the legacy env var tier | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation falls through to the generic fallback env var | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation prefers env over dotenv in the same tier | UNMAPPED | passed | See source review |
| src/test/apiKeyVault.test.ts | apiKeyVault detectKeyLocation does not require keys for local providers | UNMAPPED | passed | See source review |
| src/test/atomic-config-write.test.ts | atomic config writes atomicWriteFile writes exact content with no leftover temp file | STRONG | passed | See source review |
| src/test/atomic-config-write.test.ts | atomic config writes atomicWriteFile preserves the previous content if replacement fails | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/atomic-config-write.test.ts | atomic config writes atomicWriteFileSync writes exact content with no leftover temp file | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — round-trip attaches a file and reads back identical bytes, mime, and name | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — round-trip returns null when a memory has no attachment | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — round-trip detaches an attachment but keeps the memory | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — guardrails rejects files larger than the size cap | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/attachments-inline.test.ts | inline attachments — guardrails dedups identical bytes (no rewrite on re-attach) | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — guardrails throws when the target memory does not exist | STRONG | passed | See source review |
| src/test/attachments-inline.test.ts | inline attachments — machine-to-machine (row copy) survives the insertMemory row-copy that remote sync uses | STRONG | passed | See source review |
| src/test/audit-invoke.test.ts | runAuditCommand (in-process invoke) emits an empty JSON array when no audit entries exist | UNMAPPED | passed | See source review |
| src/test/audit-invoke.test.ts | runAuditCommand (in-process invoke) renders a human-readable timeline for the empty case without erroring | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/bootstrap.test.ts | discoverFiles finds markdown files | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | discoverFiles finds files in subdirectories | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | discoverFiles supports custom patterns | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/bootstrap.test.ts | discoverFiles returns empty for empty directory | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | discoverFiles deduplicates files across patterns | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/bootstrap.test.ts | parseFileForImport extracts title from H1 heading | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport falls back to filename for title | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport infers category from directory structure | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport uses default category for root files | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport preserves existing frontmatter when option is set | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport uses defaults when not preserving frontmatter | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | parseFileForImport strips frontmatter from body | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | bootstrap imports files into the store | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/bootstrap.test.ts | bootstrap skips existing memories when skipExisting is true | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | bootstrap supports dry run mode | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | bootstrap handles empty source directory | STRONG | passed | See source review |
| src/test/bootstrap.test.ts | bootstrap respects custom patterns | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/bootstrap.test.ts | bootstrap preserves category from subdirectory structure | STRONG | passed | See source review |
| src/test/briefing-invoke.test.ts | runBriefingCommand (in-process invoke) prints 'No projects registered.' with --all on an empty DB | UNMAPPED | passed | See source review |
| src/test/briefing-invoke.test.ts | runBriefingCommand (in-process invoke) emits { count: 0 } JSON with --all --json on an empty DB | UNMAPPED | passed | See source review |
| src/test/briefing-invoke.test.ts | runBriefingCommand (in-process invoke) includes a registered project's briefing in --all output | UNMAPPED | passed | See source review |
| src/test/centralize-network.test.ts | gnosys centralize for network MCP seeding copies the local brain through --to and overwrites only with --force | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks returns no chunks for whitespace | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks preserves text and paragraph separators within the target | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks splits paragraphs at the target and preserves order | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks merges a short chunk with its next paragraph | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks splits an oversized paragraph at sentence boundaries | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | splitIntoChunks keeps an oversized word intact | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | fnv1a matches the empty-input and one-character 32-bit vectors | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/chunk-splitter.test.ts | fnv1a D-G3-001: matches the multi-character 32-bit FNV-1a vector | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cleanup-rules.test.ts | removeRulesFromProject strips the GNOSYS block from every known target and keeps user content | UNMAPPED | passed | See source review |
| src/test/cleanup-rules.test.ts | removeRulesFromProject returns empty when no rules files or no GNOSYS blocks exist | UNMAPPED | passed | See source review |
| src/test/cleanup-rules.test.ts | removeRulesFromProject removeRulesBlock is safe on missing and malformed files | UNMAPPED | passed | See source review |
| src/test/cleanup-rules.test.ts | gnosys cleanup --rules wiring exposes --rules on the cleanup command and routes to removeRulesFromProject | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents add | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents add-structured | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents ambiguity | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents ask | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents attach | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents audit | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents backup | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents bootstrap | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents briefing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents centralize | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents check | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents cleanup | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents commit-context | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents config | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents config init | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents config set | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents config show | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents connect | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents dearchive | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents discover | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents doctor | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents dream | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents dream log | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents dream report | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents dream run | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents export | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents export project | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents export vault | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents fsearch | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents get-attachment | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents graph | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents helper | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents helper generate | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents history | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents hybrid-search | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents import | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents import project | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents ingest | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents init | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents lens | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents links | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents list | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine forget | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine list | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine ls | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine migrate | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents machine show | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents maintain | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents migrate | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents migrate-db | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents pref | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents pref delete | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents pref get | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents pref set | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents projects | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents read | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents recall | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents recall-hook | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents reflect | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents reindex | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents reindex-graph | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents reinforce | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents restore | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents sandbox | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents sandbox start | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents sandbox status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents sandbox stop | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents scan | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents search | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents semantic-search | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents serve | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup dream | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup ides | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup keys | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup models | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup preferences | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup providers | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote doctor | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote pull | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote push | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote resolve | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote sync | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup remote timer | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup routing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents setup sync-projects | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents stale | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents stats | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents stores | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents sync | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents tags | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents tags-add | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents timeline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents trace | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents traverse | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents update | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents update-status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents upgrade | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web add | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web build | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web build-index | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web ingest | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web init | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web remove | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents web update | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-command-wiring.test.ts | CLI help contract documents working-set | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-json.test.ts | CLI --json flag gnosys list --json outputs valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-json.test.ts | CLI --json flag gnosys stats --json outputs valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-json.test.ts | CLI --json flag gnosys projects --json outputs valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-json.test.ts | CLI --json flag gnosys pref get --json outputs valid JSON with no prefs | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/cli-json.test.ts | CLI --json flag gnosys pref set + get --json round-trips | STRONG | passed | See source review |
| src/test/config-knob-removal.test.ts | v5.15 removed config knobs still loads a config file containing the removed keys (no throw), strips them, and warns on stderr | UNMAPPED | passed | See source review |
| src/test/config-knob-removal.test.ts | v5.15 removed config knobs removed keys are stripped by schema parse and importConcurrency default is 5 | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns returns runs ordered DESC and parses details | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns truncates results with limit | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns filters by sinceIso | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns returns details: {} when audit details is not valid JSON | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns failuresOnly filters by errors > 0 OR providerUnreachable | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns failuresOnly false returns all runs including successes | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns uses timestamp as started fallback when startedAt is missing | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getRecentDreamRuns returns three runs with default limit when seeded | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun returns null when audit_log is empty | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun returns null when only failed runs exist | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun returns the most recent successful run when mixed | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun counts decay-only runs as successful | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun counts relationships-only runs as successful | UNMAPPED | passed | See source review |
| src/test/db-coverage.test.ts | getLastSuccessfulDreamRun counts summaries-only runs as successful | UNMAPPED | passed | See source review |
| src/test/db-recovery-extended.test.ts | DB recovery — extended failure modes surfaces ENOSPC/full-disk as a clear non-corruption error | STRONG | passed | See source review |
| src/test/db-recovery-extended.test.ts | DB recovery — extended failure modes searchFts degrades gracefully when the FTS index is corrupted | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/db-recovery-extended.test.ts | DB recovery — extended failure modes degrades gracefully when better-sqlite3 cannot load | STRONG | passed | See source review |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT getMemory() retries successfully after a corrupt-handle error | UNMAPPED | passed | See source review |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT insertMemory() retries successfully after a corrupt-handle error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT logAudit() retries successfully after a corrupt-handle error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT getAllProjects() retries successfully after a corrupt-handle error | UNMAPPED | passed | See source review |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT rethrows non-corrupt errors without retry | UNMAPPED | passed | See source review |
| src/test/db-recovery.test.ts | DB recovery from SQLITE_CORRUPT throws a clear message if reopen also fails | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/db-sync-v13.test.ts | v13 sync DB schema migrates to schema version 5 with sync tables | UNMAPPED | passed | See source review |
| src/test/docs-web-flags.test.ts | web command docs only document shipped CLI flags docs/commands/web-build-index.md flags are accepted by the published subcommand | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/docs-web-flags.test.ts | web command docs only document shipped CLI flags docs/commands/web-build.md flags are accepted by the published subcommand | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/docs-web-flags.test.ts | web command docs only document shipped CLI flags docs/commands/web-status.md flags are accepted by the published subcommand | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/docx-bomb.test.ts | DOCX bomb resistance rejects a zip-bomb DOCX before decompression (no OOM) | STRONG | passed | See source review |
| src/test/docx-bomb.test.ts | DOCX bomb resistance handles billion-laughs entity definitions without exponential expansion | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator exits early when DB is unavailable | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator exits early when too few memories | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator records provider-init error and increments consecutive failures | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator fires desktop notification at consecutive failure threshold | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator runs all phases on happy path with stubbed LLM | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator aborts at shouldStop checkpoint when abort requested | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator aborts when max runtime exceeded | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine.dream() orchestrator resets consecutive failures when LLM work succeeded | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations decaySweep updates stale memories and skips recent ones | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations critiquMemory rule arms produce review suggestions | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations llmCritique handles ok, review, needs-update, and malformed JSON | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations generateSummaries creates, skips unchanged, and updates summaries | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations summarizeCategory swallows provider errors without crashing | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations discoverRelationships filters self-ref, low confidence, and deduplicates | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | GnosysDreamEngine phase implementations findRelationships returns empty array on malformed JSON | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | formatDreamReport formats happy path with suggestions and errors | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | formatDreamReport formats aborted report | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | formatDreamReport formats empty report without suggestion or error headers | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler constructor ignores prototype pollution keys | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler start is no-op when disabled | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler start is no-op when machine is not designated | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler start arms interval and triggers dream when designated and idle | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler recordActivity aborts running engine | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler stop clears interval and aborts running engine | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler isDesignatedMachine returns false when getDb throws | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler getLocalMachineId uses hostname fallback and caches meta | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler isDreaming reflects running state | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DreamScheduler checkIdle swallows engine rejection and resets running | UNMAPPED | passed | See source review |
| src/test/dream-coverage.test.ts | DEFAULT_DREAM_CONFIG has expected defaults | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) builds load args with -w so a previously disabled agent is re-enabled | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) builds unload args | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) treats 'already loaded' stderr as success | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) treats 'Load failed: 5' as already-loaded success | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) reports other errors as non-fatal failures mentioning next login | UNMAPPED | passed | See source review |
| src/test/dream-launchctl.test.ts | dream launchctl helpers (sprint 2026-07-02) handles empty stderr | UNMAPPED | passed | See source review |
| src/test/dream-launchd-health.test.ts | parseDreamPlistPaths extracts node + cli paths from the exact template shape | STRONG | passed | See source review |
| src/test/dream-launchd-health.test.ts | parseDreamPlistPaths unescapes XML entities in paths | STRONG | passed | See source review |
| src/test/dream-launchd-health.test.ts | parseDreamPlistPaths returns undefined paths for an empty or truncated body | STRONG | passed | See source review |
| src/test/dream-launchd-health.test.ts | checkDreamLaunchAgent reports missing, healthy, and broken installed agents in an isolated home | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-lock-recovery.test.ts | acquireDreamLock recovery acquires and releases cleanly | UNMAPPED | passed | See source review |
| src/test/dream-lock-recovery.test.ts | acquireDreamLock recovery refuses while a live process holds the lock | UNMAPPED | passed | See source review |
| src/test/dream-lock-recovery.test.ts | acquireDreamLock recovery treats a dead-pid lock as stale and recovers | UNMAPPED | passed | See source review |
| src/test/dream-lock-recovery.test.ts | acquireDreamLock recovery treats a corrupt/unreadable lock as stale instead of blocking forever | UNMAPPED | passed | See source review |
| src/test/dream-log-invoke.test.ts | runDreamLogCommand (in-process invoke) prints 'No dream runs recorded.' when the log is empty | UNMAPPED | passed | See source review |
| src/test/dream-log-invoke.test.ts | runDreamLogCommand (in-process invoke) emits structured JSON with count 0 for --json on an empty log | UNMAPPED | passed | See source review |
| src/test/dream-log-invoke.test.ts | runDreamLogCommand (in-process invoke) honours parentJson context (JSON even without --json) | UNMAPPED | passed | See source review |
| src/test/dream-resume.test.ts | Dream abort and resume aborts cleanly at a phase boundary with a consistent DB | UNMAPPED | passed | See source review |
| src/test/dream-resume.test.ts | Dream abort and resume re-run after a completed cycle picks up cleanly (no corruption or dupes) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-run-log.test.ts | dreamRunLog writes state and append-only run records | STRONG | passed | See source review |
| src/test/dream-run-log.test.ts | dreamRunLog creates stable fingerprints from memory identity and modification | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-run-log.test.ts | dreamRunLog checks night window and changed memory counts | STRONG | passed | See source review |
| src/test/dream-run-log.test.ts | dreamRunLog estimates tokens and cost, and prevents overlapping locks | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-run-scheduled-flag.test.ts | dream run --scheduled flag handling (v5.13.1) scheduled run records designation-gate skip | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/dream-state-isolation.test.ts | dream-state isolation (v5.13.0) engine.dream() writes dream-state.json under GNOSYS_HOME, not the real home | UNMAPPED | passed | See source review |
| src/test/dream-state-isolation.test.ts | dream-state isolation (v5.13.0) an explicit stateDir overrides GNOSYS_HOME (defense in depth) | UNMAPPED | passed | See source review |
| src/test/dream-state-isolation.test.ts | dream-state isolation (v5.13.0) getDreamStatePath accepts a baseDir override | UNMAPPED | passed | See source review |
| src/test/dream-state-isolation.test.ts | embedding-health phase (v5.13.0) reports the coverage gap but never auto-downloads the model when embeddings were never initialized | UNMAPPED | passed | See source review |
| src/test/dream-state-isolation.test.ts | embedding-health phase (v5.13.0) skips cleanly when every memory is already embedded | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | embeddingText joins title, relevance, tags, content — same recipe as the file-store reindex | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | embeddingText handles object-shaped tags and plain-string tags | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | float32ToBuffer round-trips through the Buffer shape the DB stores | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | backfillCentralDbEmbeddings fills every NULL embedding in missing mode | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | backfillCentralDbEmbeddings missing mode is incremental — already-embedded rows are untouched | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-db.test.ts | backfillCentralDbEmbeddings all mode regenerates every row (reindex semantics) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-db.test.ts | backfillCentralDbEmbeddings respects the limit option and reports progress | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | backfillCentralDbEmbeddings stored vectors are readable through the DB-search path | UNMAPPED | passed | See source review |
| src/test/embed-db.test.ts | embedMemoryIntoDb embeds a single memory | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-db.test.ts | embedMemoryIntoDb returns false for a missing memory id | UNMAPPED | passed | See source review |
| src/test/embed-queue.test.ts | embedQueue is a no-op when disabled (the CLI / test default) | STRONG | passed | See source review |
| src/test/embed-queue.test.ts | embedQueue embeds queued memories once enabled | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-queue.test.ts | embedQueue never throws when the embedder fails — warns on stderr instead | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-queue.test.ts | embedQueue syncMemoryToDb feeds the queue — a plain DB write gets a vector | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/embed-queue.test.ts | embedQueue disable clears pending work | STRONG | passed | See source review |
| src/test/embeddings-optional-dep.test.ts | embeddings optional dep (@huggingface/transformers) throws a one-line install hint when transformers is missing | UNMAPPED | passed | See source review |
| src/test/embeddings-optional-dep.test.ts | embeddings optional dep (@huggingface/transformers) returns a 384-dim vector when transformers is available | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-archive-flag.test.ts | export archive visibility default exportProject reports archivedExcluded and omits archived memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-archive-flag.test.ts | export archive visibility includeArchived exports all with status preserved and archivedExcluded 0 | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-archive-flag.test.ts | export archive visibility vault export activeOnly reports archivedExcluded | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-import-project.test.ts | project bundle round-trip exports a project to a .json.gz bundle | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-import-project.test.ts | project bundle round-trip readBundle round-trips the manifest, project, and memories | STRONG | passed | See source review |
| src/test/export-import-project.test.ts | project bundle round-trip import strategy=merge skips existing memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/export-import-project.test.ts | project bundle round-trip import strategy=new-id remaps the project ID and memory IDs | STRONG | passed | See source review |
| src/test/export-import-project.test.ts | project bundle round-trip import strategy=replace deletes existing project memories | STRONG | passed | See source review |
| src/test/export-import-project.test.ts | project bundle round-trip readBundle rejects malformed bundles | STRONG | passed | See source review |
| src/test/export-import-project.test.ts | project bundle round-trip export with includeArchived=false skips archived memories | STRONG | passed | See source review |
| src/test/export-path-traversal.test.ts | export path traversal slugifies traversal category and writes inside export dir | STRONG | passed | See source review |
| src/test/federated-client-read.test.ts | federated paths use client read context 'discover' reads the accepted snapshot while the master is offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context 'search' reads the accepted snapshot while the master is offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context 'recall' reads the accepted snapshot while the master is offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context 'hybrid-search' reads the accepted snapshot while the master is offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context 'fsearch' reads the accepted snapshot while the master is offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context ask sends accepted snapshot content to the configured provider while offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated-client-read.test.ts | federated paths use client read context gnosys_federated_search returns accepted snapshot content over MCP while offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated.test.ts | federatedSearch returns results scored with scope boosting | STRONG | passed | See source review |
| src/test/federated.test.ts | federatedSearch boosts recently modified memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated.test.ts | federatedSearch respects includeGlobal=false | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated.test.ts | federatedSearch returns empty array for no matches | STRONG | passed | See source review |
| src/test/federated.test.ts | federatedSearch boosts reinforced memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/federated.test.ts | detectAmbiguity returns null when query matches only one project | STRONG | passed | See source review |
| src/test/federated.test.ts | detectAmbiguity returns ambiguity error when query matches multiple projects | STRONG | passed | See source review |
| src/test/federated.test.ts | generateBriefing generates a briefing for a project with memories | STRONG | passed | See source review |
| src/test/federated.test.ts | generateBriefing returns null for non-existent project | STRONG | passed | See source review |
| src/test/federated.test.ts | generateAllBriefings generates briefings for all registered projects | STRONG | passed | See source review |
| src/test/federated.test.ts | getWorkingSet returns recently modified memories for a project | STRONG | passed | See source review |
| src/test/federated.test.ts | getWorkingSet returns empty set for no recent activity | STRONG | passed | See source review |
| src/test/federated.test.ts | formatWorkingSet formats empty working set | STRONG | passed | See source review |
| src/test/federated.test.ts | formatWorkingSet formats non-empty working set | STRONG | passed | See source review |
| src/test/file-permissions.test.ts | file permissions writeApiKey creates .env with mode 0600 | UNMAPPED | passed | See source review |
| src/test/file-permissions.test.ts | file permissions GnosysDB creates gnosys.db with mode 0600 and store dir 0700 | UNMAPPED | passed | See source review |
| src/test/freeform-add-gate.test.ts | gnosys_add freeform gate rejects freeform MCP writes by default | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/freeform-add-gate.test.ts | gnosys_add freeform gate redirect message lists the structured fields agents must supply | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/freeform-add-gate.test.ts | gnosys_add freeform gate generated agent rules state the server rejects freeform gnosys_add | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/fsearch-invoke.test.ts | runFsearchCommand (in-process invoke) finds a seeded user-scope memory via federated FTS (--json) | UNMAPPED | passed | See source review |
| src/test/fsearch-invoke.test.ts | runFsearchCommand (in-process invoke) prints a no-results message for an unmatched query (human) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts still matches when ALL terms are present (AND precision preserved) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts returns results for long multi-word queries where only some terms match (the v5.12.3 bug) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts OR fallback ranks the best-covered memory first (BM25) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts single-term queries behave as before | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts punctuation-only and empty queries return empty, not throw | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts FTS5-hostile characters no longer cause syntax errors | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) discoverFts queries with zero matching terms still return empty | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) searchFts still matches when ALL terms are present (AND precision preserved) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) searchFts returns results for multi-word queries where only some terms match | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) searchFts single-term queries behave as before | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysDB FTS OR fallback (central DB) searchFts punctuation-only queries return empty | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysSearch FTS OR fallback (per-store index) search: multi-word query with partial term match returns results (the v5.12.3 bug) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysSearch FTS OR fallback (per-store index) search: AND precision preserved when all terms match | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysSearch FTS OR fallback (per-store index) discover: long multi-word query returns ranked results (the v5.12.3 bug) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysSearch FTS OR fallback (per-store index) discover: AND precision preserved when all terms match | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysSearch FTS OR fallback (per-store index) discover: punctuation-only query returns empty, not throw | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysArchive FTS OR fallback (archive tier) multi-word query with partial term match returns archived results (the v5.12.3 bug) | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysArchive FTS OR fallback (archive tier) AND precision preserved when all terms match | UNMAPPED | passed | See source review |
| src/test/fts-or-fallback.test.ts | GnosysArchive FTS OR fallback (archive tier) punctuation-only query returns empty | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsTerms splits on whitespace and trims | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsTerms strips quote characters | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsTerms drops tokens with no letters or digits | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsTerms returns empty array for empty or whitespace-only input | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsTerms keeps unicode letters and digits | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsAndQuery quotes each term and joins with spaces (implicit AND) | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsAndQuery quotes terms containing FTS5-hostile characters | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsAndQuery preserves trailing * as an FTS5 prefix query | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsOrQuery quotes each term and joins with OR | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsOrQuery single term is just the quoted phrase | UNMAPPED | passed | See source review |
| src/test/ftsQuery.test.ts | ftsOrQuery preserves prefix queries inside OR expressions | UNMAPPED | passed | See source review |
| src/test/graph-invoke.test.ts | runGraphCommand (in-process invoke) prints 'No memories found.' on an empty central DB | STRONG | passed | See source review |
| src/test/graph-invoke.test.ts | runGraphCommand (in-process invoke) reports wikilinks between seeded memories (--json) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/heartbeat.test.ts | withHeartbeat returns the wrapped result and cleans up on success | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/heartbeat.test.ts | withHeartbeat cleans up and rethrows when the wrapped function fails | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/history-audit-view.test.ts | audit-based memory history returns audit entries for a known memory | UNMAPPED | passed | See source review |
| src/test/history-audit-view.test.ts | audit-based memory history CLI history prints audit entries for a DB memory | UNMAPPED | passed | See source review |
| src/test/history-audit-view.test.ts | audit-based memory history CLI history errors for a missing memory | UNMAPPED | passed | See source review |
| src/test/history-invoke.test.ts | runHistoryCommand (in-process invoke) prints memory header and 'No audit history recorded.' for a fresh memory | UNMAPPED | passed | See source review |
| src/test/history-invoke.test.ts | runHistoryCommand (in-process invoke) emits structured JSON with memoryId and empty entries (--json) | UNMAPPED | passed | See source review |
| src/test/history-invoke.test.ts | runHistoryCommand (in-process invoke) exits with an error for a missing memory id | UNMAPPED | passed | See source review |
| src/test/hybrid-degrade-warning.test.ts | hybrid search degrade warnings (v5.12.3) gnosys_hybrid_search warns when the semantic leg can't run | UNMAPPED | passed | See source review |
| src/test/hybrid-degrade-warning.test.ts | hybrid search degrade warnings (v5.12.3) gnosys_semantic_search refuses loudly instead of returning generic empty | UNMAPPED | passed | See source review |
| src/test/hybrid-degrade-warning.test.ts | hybrid search degrade warnings (v5.12.3) CLI hybrid-search warns on stderr (stdout stays clean for --json) | UNMAPPED | passed | See source review |
| src/test/hybrid-degrade-warning.test.ts | hybrid search degrade warnings (v5.12.3) canRunSemantic mirrors the DB-mode embedQuery gate (central-DB vectors) | UNMAPPED | passed | See source review |
| src/test/ide-init-golden.test.ts | IDE init golden fixtures claude rules block matches golden (CLAUDE.md) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-init-golden.test.ts | IDE init golden fixtures cursor rules block matches golden (.cursor/rules/gnosys.mdc) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-init-golden.test.ts | IDE init golden fixtures codex rules block matches golden (.codex/gnosys.md) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-init-golden.test.ts | IDE init golden fixtures generateRulesBlock is deterministic with empty preferences | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-init-golden.test.ts | IDE init MCP config structure cursor setupIDE writes mcpServers.gnosys with command and args | UNMAPPED | passed | See source review |
| src/test/ide-init-golden.test.ts | IDE init MCP config structure gemini-cli setupIDE writes mcpServers.gnosys under isolated HOME | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-init-golden.test.ts | IDE init MCP config structure antigravity setupIDE writes mcpServers.gnosys under isolated HOME | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-mcp-install.test.ts | ideMcpInstall helpers normalizeIdeKey accepts grok alias | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | ideMcpInstall helpers detects stale gnosys serve entries | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | ideMcpInstall helpers gnosysStdioMcpEntry uses gnosys-mcp command | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | setupIDE MCP outputs cursor writes project and user mcp.json | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | setupIDE MCP outputs grok writes mcp_servers.gnosys in ~/.grok/config.toml | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | setupIDE MCP outputs gemini-cli and antigravity write mcpServers.gnosys | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | setupIDE MCP outputs claude-desktop writes mcpServers.gnosys | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ide-mcp-install.test.ts | removeTomlSection — Codex legacy cleanup removes [gnosys] regardless of field order | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | setupIDE(claude) resilience still writes Claude Desktop when claude CLI is unavailable | STRONG | passed | See source review |
| src/test/ide-mcp-install.test.ts | upsertGrokMcpBlock uses mcp_servers header per Grok Build spec | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import-concurrency-wiring.test.ts | v5.15 importConcurrency wiring markers importCommand.ts defaults concurrency from config.importConcurrency (CLI flag wins) | UNMAPPED | passed | See source review |
| src/test/import-concurrency-wiring.test.ts | v5.15 importConcurrency wiring markers index.ts gnosys_import handler defaults from ctx.config.importConcurrency (explicit param wins) | UNMAPPED | passed | See source review |
| src/test/import-concurrency-wiring.test.ts | v5.15 importConcurrency wiring markers the --concurrency CLI flag still exists so it can win over config | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://127.0.0.1:7777/x | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://localhost/x | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://[::1]/x | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://0x7f000001/x | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://2130706433/x | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://169.254.169.254/ | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://10.0.0.1/ | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards refuses http://192.168.1.1/ | UNMAPPED | passed | See source review |
| src/test/import-url-ssrf.test.ts | import URL SSRF guards rejects redirects to loopback | UNMAPPED | passed | See source review |
| src/test/import.test.ts | JSON import imports a JSON array of records | UNMAPPED | passed | See source review |
| src/test/import.test.ts | JSON import handles nested JSON with common array keys | UNMAPPED | passed | See source review |
| src/test/import.test.ts | JSON import rejects JSON without recognizable array | UNMAPPED | passed | See source review |
| src/test/import.test.ts | CSV import imports a CSV file | UNMAPPED | passed | See source review |
| src/test/import.test.ts | JSONL import imports JSONL (one JSON object per line) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | field mapping rejects mapping without title | UNMAPPED | passed | See source review |
| src/test/import.test.ts | field mapping includes unmapped fields as extra context | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | field mapping slugifies category names | UNMAPPED | passed | See source review |
| src/test/import.test.ts | deduplication skips records that already exist when skipExisting is true | UNMAPPED | passed | See source review |
| src/test/import.test.ts | limit and offset respects limit | UNMAPPED | passed | See source review |
| src/test/import.test.ts | limit and offset respects offset | UNMAPPED | passed | See source review |
| src/test/import.test.ts | dry run reports what would be imported without writing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | batch commit persists every record of a batch in the central database | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | error handling continues processing when individual records fail | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | formatImportSummary produces readable summary | UNMAPPED | passed | See source review |
| src/test/import.test.ts | estimateDuration estimates structured mode as fast | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/import.test.ts | estimateDuration estimates LLM mode as slower | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures normal PDF ingests without crashing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures 0-byte text file is handled gracefully | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures UTF-8 BOM text file is handled gracefully | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures oversized text file hits size cap (no OOM) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures corrupt DOCX returns a clear error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures non-existent path throws a clear error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures PDF with embedded JS is handled without executing JS | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-fixtures.test.ts | ingest adversarial fixtures encrypted PDF returns a clear password error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-special-paths.test.ts | ingestion of special-character paths ingests "has spaces.txt" | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-special-paths.test.ts | ingestion of special-character paths ingests "unicodé-café.txt" | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-special-paths.test.ts | ingestion of special-character paths ingests "emoji-🎉-file.txt" | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-special-paths.test.ts | ingestion of special-character paths ingests "trailing space .txt" | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider availability getters reports unavailable when getLLMProvider throws at construction | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider availability getters reports available when a provider is resolved | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths anthropic — mentions ANTHROPIC_API_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths openai — mentions OPENAI_API_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths groq — mentions GROQ_API_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths xai — mentions XAI_API_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths mistral — mentions MISTRAL_API_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths custom — mentions GNOSYS_CUSTOM_KEY | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths ollama — mentions running locally | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths lmstudio — mentions running locally | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) provider-missing error paths unknown provider — suggests switching default provider | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) JSON parsing variants parses bare JSON from the LLM response | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) JSON parsing variants parses markdown-fenced JSON | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) JSON parsing variants parses plain-fenced JSON without json language tag | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) JSON parsing variants parses JSON embedded in prose | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) prototype-pollution sanitization strips __proto__, constructor, and prototype keys from LLM JSON | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) tag validation and proposed new tags keeps registry tags and proposes unknown tags | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) tag validation and proposed new tags includes explicit proposed_new_tags from the LLM response | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) field defaults applies defaults when the LLM returns minimal JSON | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) configOverride resolves a fresh provider from configOverride | UNMAPPED | passed | See source review |
| src/test/ingest-structured.test.ts | GnosysIngestion.ingest (LLM path) configOverride throws provider-missing when configOverride has no available provider | UNMAPPED | passed | See source review |
| src/test/ingest.test.ts | GnosysIngestion isLLMAvailable reports availability for absent and configured local providers | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest.test.ts | GnosysIngestion createStructured creates a structured IngestResult with all fields | STRONG | passed | See source review |
| src/test/ingest.test.ts | GnosysIngestion createStructured generates kebab-case filename from title | STRONG | passed | See source review |
| src/test/ingest.test.ts | GnosysIngestion createStructured truncates filename to 60 characters | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/ingest.test.ts | GnosysIngestion createStructured provides defaults for optional fields | STRONG | passed | See source review |
| src/test/ingest.test.ts | GnosysIngestion end-to-end structured write creates a valid memory file from structured input | STRONG | passed | See source review |
| src/test/init.test.ts | gnosys init creates a usable registered store without legacy artifacts | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/init.test.ts | gnosys init writes the default categorized tag registry | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/init.test.ts | gnosys init re-syncs the working directory while retaining a valid project ID | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/init.test.ts | gnosys init outputs helpful instructions | STRONG | passed | See source review |
| src/test/install-output.test.ts | isSuppressedNpmLine suppresses the prebuild-install and boolean deprecation lines | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | isSuppressedNpmLine does NOT suppress other deprecation warnings | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | isSuppressedNpmLine does NOT suppress a lookalike package name (requires the @ boundary) | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | isSuppressedNpmLine leaves normal npm output and errors untouched | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | makeNpmStderrFilter drops suppressed lines and keeps the rest, in order | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | makeNpmStderrFilter handles a suppressed line split across two chunks | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | makeNpmStderrFilter flushes a trailing partial line that has no newline | UNMAPPED | passed | See source review |
| src/test/install-output.test.ts | makeNpmStderrFilter suppresses a trailing partial line if it matches | UNMAPPED | passed | See source review |
| src/test/interactive-guard.test.ts | interactive stdin guard (sprint 2026-07-02) message names the flow and explains the TTY requirement | UNMAPPED | passed | See source review |
| src/test/interactive-guard.test.ts | interactive stdin guard (sprint 2026-07-02) stdinIsInteractive reflects process.stdin.isTTY | UNMAPPED | passed | See source review |
| src/test/interactive-guard.test.ts | interactive stdin guard (sprint 2026-07-02) exits 1 with a single friendly stderr line when stdin is not a TTY | UNMAPPED | passed | See source review |
| src/test/interactive-guard.test.ts | interactive stdin guard (sprint 2026-07-02) is a no-op when stdin is a TTY | UNMAPPED | passed | See source review |
| src/test/lensing.test.ts | applyLens — single filters filters by category | UNMAPPED | passed | See source review |
| src/test/lensing.test.ts | applyLens — single filters filters by status | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by multiple statuses | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by tag (any mode) | UNMAPPED | passed | See source review |
| src/test/lensing.test.ts | applyLens — single filters filters by tag (all mode) | UNMAPPED | passed | See source review |
| src/test/lensing.test.ts | applyLens — single filters filters by confidence range | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by author | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by authority | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by created date range | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters filters by modified date range | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters empty filter returns all memories | UNMAPPED | passed | See source review |
| src/test/lensing.test.ts | applyLens — single filters combines multiple criteria in one filter | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lensing.test.ts | applyLens — single filters combines criteria with OR operator | UNMAPPED | passed | See source review |
| src/test/lifecycle-e2e.test.ts | memory lifecycle e2e add → read → update → archive → dearchive → reinforce×3 → maintain stays consistent | UNMAPPED | passed | See source review |
| src/test/lifecycle-invariants.test.ts | memory lifecycle through database reads and search preserves current content, visibility and reinforcement across lifecycle operations | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/lifecycle-invariants.test.ts | memory lifecycle through database reads and search writing the same memory twice keeps one searchable result | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/links-invoke.test.ts | runLinksCommand (in-process invoke) shows outgoing wikilinks for the source memory (human) | STRONG | passed | See source review |
| src/test/links-invoke.test.ts | runLinksCommand (in-process invoke) emits structured JSON with outgoing/backlinks arrays (--json) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/links-invoke.test.ts | runLinksCommand (in-process invoke) exits with an error for a missing memory path | STRONG | passed | See source review |
| src/test/list-invoke.test.ts | runListCommand (in-process invoke) lists the seeded user-scope memory (--json) | STRONG | passed | See source review |
| src/test/list-invoke.test.ts | runListCommand (in-process invoke) filters by tag (--tag, --json) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/list-invoke.test.ts | runListCommand (in-process invoke) returns an empty set for a category with no matches (--json) | STRONG | passed | See source review |
| src/test/list-invoke.test.ts | runListCommand (in-process invoke) renders human output with scope/status markers | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System Provider Registry accepts all nine supported providers through config parsing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System Config Schema parses old configs without xai/mistral/custom sections (backward compat) | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System Config Schema accepts xai as defaultProvider | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System Config Schema accepts mistral as defaultProvider | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System Config Schema accepts custom as defaultProvider with full config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System Config Schema rejects invalid provider names | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System getProviderModel returns xai model from config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System getProviderModel returns mistral model from config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System getProviderModel returns openrouter model from config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System getProviderModel returns custom model from config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System getProviderModel returns empty string for custom when not configured | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getXAIApiKey reads from config first | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getXAIApiKey falls back to env var | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getMistralApiKey reads from config first | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getMistralApiKey falls back to env var | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getOpenRouterApiKey falls back to OPENROUTER_API_KEY | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getCustomApiKey reads from config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System API Key Helpers getCustomApiKey falls back to GNOSYS_LLM_API_KEY | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System createProvider creates xAI provider with correct baseUrl | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System createProvider creates OpenRouter provider | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System createProvider creates Mistral provider with correct baseUrl | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System createProvider creates custom provider with user-provided baseUrl | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System createProvider throws when xAI has no API key | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System createProvider throws when Mistral has no API key | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System createProvider throws when custom provider has no config | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System createProvider custom provider works without API key (local endpoints) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/llm-providers.test.ts | LLM Provider System isProviderAvailable xai is unavailable without API key | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System isProviderAvailable mistral is unavailable without API key | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System isProviderAvailable custom is unavailable when not configured | STRONG | passed | See source review |
| src/test/llm-providers.test.ts | LLM Provider System isProviderAvailable custom is available when baseUrl and model are set | STRONG | passed | See source review |
| src/test/llm-redact.test.ts | redactKey strips a literal xai key from error text | UNMAPPED | passed | See source review |
| src/test/llm-redact.test.ts | redactKey redacts sk-ant- prefixed keys via regex | UNMAPPED | passed | See source review |
| src/test/llm-redact.test.ts | redactKey leaves short keys unchanged when below length threshold | UNMAPPED | passed | See source review |
| src/test/localDiskCheck.test.ts | localDiskCheck matches LOCAL DISK ONLY phrase exactly | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/log.test.ts | structured logger writes plain text to stderr by default | STRONG | passed | See source review |
| src/test/log.test.ts | structured logger writes JSON lines when GNOSYS_LOG_FORMAT=json | STRONG | passed | See source review |
| src/test/log.test.ts | structured logger appends JSON lines to GNOSYS_LOG_FILE | STRONG | passed | See source review |
| src/test/log.test.ts | structured logger respects GNOSYS_LOG_LEVEL gating | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/log.test.ts | structured logger never throws on bad file paths | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/machine-id-stability.test.ts | machine ID stability GNOSYS_MACHINE_ID stays stable across a hostname change | UNMAPPED | passed | See source review |
| src/test/machine-id-stability.test.ts | machine ID stability preserves machine ID across restart when hostname is unchanged | UNMAPPED | passed | See source review |
| src/test/machine-id-stability.test.ts | machine ID stability regenerates a distinct ID when a foreign config is cloned without override | UNMAPPED | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: read/write returns {} when nothing is stored | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: read/write round-trips through write/read | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: read/write returns {} for malformed JSON instead of throwing | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: recordMachine adds this machine with version, lastSeen, and machineId | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: recordMachine prunes the orphaned entry left by a previous hostname (the phantom) | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: recordMachine prunes a differently-named entry that shares this machineId | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: recordMachine never removes a different physical machine | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/machine-registry.test.ts | machineRegistry: recordMachine persists the result so a re-read sees the pruned registry | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/machine-registry.test.ts | machineRegistry: forgetMachine removes a named entry and reports true | STRONG | passed | See source review |
| src/test/machine-registry.test.ts | machineRegistry: forgetMachine reports false when the entry doesn't exist | STRONG | passed | See source review |
| src/test/masterLease.test.ts | masterLease writes and reads epoch-fenced marker | UNMAPPED | passed | See source review |
| src/test/mcp-context-release.test.ts | MCP central ToolContext release wraps every tool handler with withContextRelease at registration | UNMAPPED | passed | See source review |
| src/test/mcp-context-release.test.ts | MCP central ToolContext release provides a last-resort error envelope for handlers without their own catch | UNMAPPED | passed | See source review |
| src/test/mcp-context-release.test.ts | MCP central ToolContext release registers contexts from BOTH resolveToolContext return paths | UNMAPPED | passed | See source review |
| src/test/mcp-context-release.test.ts | MCP central ToolContext release release is idempotent so per-handler finally blocks remain safe | UNMAPPED | passed | See source review |
| src/test/mcp-context-release.test.ts | MCP central ToolContext release installs process-level guards in serve mode (stderr only, no stdout) | UNMAPPED | passed | See source review |
| src/test/mcp-fuzz.test.ts | MCP tool input fuzzing rejects malformed input for every tool with required fields | UNMAPPED | passed | See source review |
| src/test/mcp-http-replay.test.ts | MCP HTTP registration replay two concurrent sessions both see the full real tool list | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/mcp-toolset-budget.test.ts | MCP toolset budgets core tier is ≤ 20 tools and its serialized payload ≤ 20,000 chars (~5k tokens) | UNMAPPED | passed | See source review |
| src/test/mcp-toolset-budget.test.ts | MCP toolset budgets standard tier sits between core and full | UNMAPPED | passed | See source review |
| src/test/mcp-toolset-budget.test.ts | MCP toolset budgets full tier registers everything, ≤ 60 tools | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/mcp-toolset-budget.test.ts | MCP toolset budgets core ⊂ standard ⊂ full by tier predicate | UNMAPPED | passed | See source review |
| src/test/mcp-toolset-budget.test.ts | MCP toolset budgets resolveToolset falls back to core (with a stderr warning) on unknown values | UNMAPPED | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) a fresh default server starts on core: 19 tools (core 18 + gnosys_toolset) | STRONG | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) gnosys_toolset without args lists standard and full additions | STRONG | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) set:"full" expands to 56 tools and emits notifications/tools/list_changed | STRONG | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) set:"core" shrinks back down | STRONG | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) gnosys_toolset is present and callable in every tier | STRONG | passed | See source review |
| src/test/mcp-toolset-dynamic.test.ts | MCP dynamic toolset switching (v6.2) GNOSYS_MCP_TOOLSET=full env override starts on the full tier | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/mcp-toolset-isolation.test.ts | toolset tier isolation between agent sessions escalating session A to full leaves session B on core, and A can come back down | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_trace traces a codebase and reports created memories | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_trace returns a zero-count result for a directory with no source files | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_traverse walks the chain from a seeded memory | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_traverse respects direction=in (no outgoing edges followed) | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_traverse errors on an unknown memory id | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_reflect records an outcome against explicit memory ids | UNMAPPED | passed | See source review |
| src/test/mcp-trace-tools.test.ts | gnosys_reflect rejects a call without the required outcome | UNMAPPED | passed | See source review |
| src/test/model-validation.test.ts | validateModel request builder builds anthropic requests with the expected URL and headers | UNMAPPED | passed | See source review |
| src/test/model-validation.test.ts | validateModel request builder builds openai and groq requests with bearer auth | UNMAPPED | passed | See source review |
| src/test/model-validation.test.ts | validateModel request builder builds custom provider requests from baseUrl and returns unsupported errors | UNMAPPED | passed | See source review |
| src/test/modelValidation.test.ts | isApiKeyValidationError detects xAI-style HTTP 400 incorrect API key messages | UNMAPPED | passed | See source review |
| src/test/modelValidation.test.ts | isApiKeyValidationError detects HTTP 401 and 403 | UNMAPPED | passed | See source review |
| src/test/modelValidation.test.ts | isApiKeyValidationError detects common invalid-key phrases | UNMAPPED | passed | See source review |
| src/test/modelValidation.test.ts | isApiKeyValidationError returns false for non-auth failures | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'pdf' for .pdf files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'docx' for .docx files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'image' for .png files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'image' for .jpg files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'image' for .gif files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'image' for .webp files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'image' for .svg files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'audio' for .mp3 files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'audio' for .wav files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'audio' for .m4a files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'audio' for .ogg files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'audio' for .flac files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'video' for .mp4 files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'video' for .mkv files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'video' for .mov files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'video' for .avi files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'text' for .txt files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'text' for .md files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | fileDetect detectFileType returns 'unknown' for .xyz files | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks splits text at paragraph boundaries | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks merges small paragraphs into a single chunk | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks splits oversized paragraphs at sentence boundaries | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks respects targetSize option | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks handles single paragraph text | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks handles empty text | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks handles whitespace-only text | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitIntoChunks assigns sequential index values | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitSegments preserves page metadata | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitSegments preserves timerange metadata | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitSegments merges undersized segments with same page | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | chunkSplitter splitSegments handles empty segments array | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | chunkSplitter splitSegments handles segments with empty text | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | attachments initAttachments creates the directory and manifest | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments initAttachments is idempotent (safe to call twice) | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments storeAttachment copies file and generates UUID | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | attachments storeAttachment detects duplicate by content hash | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments listAttachments returns empty array initially | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments linkMemoryToAttachment updates the manifest | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments linkMemoryToAttachment throws for unknown UUID | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | attachments getAttachmentPath constructs correct path | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema GnosysConfigSchema includes multimodal defaults | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/multimodal.test.ts | config multimodal schema multimodal.transcriptionProvider defaults to 'groq' | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema multimodal.chunkSize defaults to 1500 | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema multimodal.maxFileSizeMb defaults to 100 | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema DEFAULT_CONFIG has multimodal defaults | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema taskModels accepts 'vision' and 'transcription' tasks | UNMAPPED | passed | See source review |
| src/test/multimodal.test.ts | config multimodal schema multimodal config allows custom values | UNMAPPED | passed | See source review |
| src/test/openrouterTiers.test.ts | buildOpenRouterTiers includes free models with :free suffix | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/openrouterTiers.test.ts | buildOpenRouterTiers falls back to static tiers for empty catalog | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/package-manager-detect.test.ts | detectPackageManager detects npx from install path | UNMAPPED | passed | See source review |
| src/test/package-manager-detect.test.ts | detectPackageManager detects pnpm from install path and PNPM_HOME | UNMAPPED | passed | See source review |
| src/test/package-manager-detect.test.ts | detectPackageManager detects yarn from install path | UNMAPPED | passed | See source review |
| src/test/package-manager-detect.test.ts | detectPackageManager detects npm from typical global path | UNMAPPED | passed | See source review |
| src/test/package-manager-detect.test.ts | detectPackageManager falls back to npm_config_user_agent | UNMAPPED | passed | See source review |
| src/test/package-manager-detect.test.ts | upgradeCommand maps managers to upgrade commands | UNMAPPED | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations inserts a memory into the database and retrieves it | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations updates a memory's fields | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations deletes a memory and its FTS entry | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations updates persisted reinforcement fields | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations reads memories by category | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.1: Basic CRUD operations writes and reads a memory file via GnosysStore | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.2: Search operations FTS5 search finds memories by keyword | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.2: Search operations discover finds memories by relevance keywords | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.2: Search operations GnosysSearch indexes and searches store memories | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.2: Search operations returns empty results for non-matching queries | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.3: Dream Mode configuration dream reports an empty database before calling a provider | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.3: Dream Mode configuration dream reports the configured minimum active-memory requirement | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.4: Multi-project support stores memories with distinct project_id values | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.4: Multi-project support registers and retrieves projects | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.4: Multi-project support separates memories by scope | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.5: Obsidian export exporter creates output directory and writes memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.6: Dashboard and doctor stats getMemoryCount returns correct totals | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.6: Dashboard and doctor stats getCategories returns distinct categories | STRONG | passed | See source review |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.6: Dashboard and doctor stats dashboard reports literal active and archived database counts | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.7: Maintain and dearchive maintenance rejects a resolver with no writable store | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.7: Maintain and dearchive archive module can be imported and instantiated | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase0-6.regression.test.ts | Phase 0-6 Regression TC-R.7: Maintain and dearchive memory tier can be changed from active to archive and back | STRONG | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.1: Reflection API — success outcome updates confidence boosts confidence on success | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.2: Reflection API — failure outcome decreases confidence decreases confidence on failure | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.3: Reflection API — creates reflection memory with relationships creates a new reflection memory | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.4: Reflection API — consolidation links related memories on success creates corroborates links between multiple memories | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.5: Reflection API — auto-discovers memories when no IDs provided searches FTS to find related memories | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.6: Process Tracing — discovers functions from source files finds function declarations in TS files | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.7: Process Tracing — creates procedural 'how' memories stores functions as category 'how' memories | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.8: Process Tracing — creates leads_to and follows_from relationships creates call-chain relationships between functions | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.9: Process Tracing — handles empty directory returns zero counts for empty directory | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.10: Traversal — BFS follows relationships depth-limited traverses chain up to specified depth | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.11: Traversal — respects rel_types filter only follows specified relationship types | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.12: Traversal — handles non-existent memory returns error for non-existent memory | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.13: Traversal — follows bidirectional relationships follows both outgoing and incoming edges | UNMAPPED | passed | See source review |
| src/test/phase10.reflect-trace-traverse.test.ts | TC-10.14: End-to-end — trace → reflect → traverse chain traces code, reflects on outcome, then traverses the chain | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | dream crash-safety pins checkpoints fingerprints at every phase boundary | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | dream crash-safety pins scheduler acquires the cross-process dream lock before dreaming | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | sqlite recovery pins withRecovery uses the shared corruption detector (incl. SQLITE_NOTADB) | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | sqlite recovery pins reopen() heals FTS triggers and invalidates the statement cache | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | sqlite recovery pins close() invalidates the statement cache | UNMAPPED | passed | See source review |
| src/test/phase3-hardening-pins.test.ts | scoped search release pin projectRoot-scoped contexts own and release their GnosysSearch handle | UNMAPPED | passed | See source review |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.1: Migration of markdown memories to SQLite memories written to store can be read into DB via migrate | STRONG | passed | See source review |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.1: Migration of markdown memories to SQLite migration is idempotent (re-migrate skips existing) | STRONG | passed | See source review |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.2: Post-migration command compatibility DB search works after inserting memories | STRONG | passed | See source review |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.2: Post-migration command compatibility getMemoryCount returns correct totals after migration | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.3: Migration status detection isMigrated returns false for empty DB, true after adding data | STRONG | passed | See source review |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.3: Migration status detection getSchemaVersion returns current version | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.4: Schema validation memories retain scope and project after reopen | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.4: Schema validation projects persist identity fields | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.4: Schema validation FTS5 virtual table is set up with porter tokenizer | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7a.migration.test.ts | Phase 7a: GnosysDB + Migration TC-7a.4: Schema validation audit_log table accepts entries | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.1: Search and recall read from SQLite searchFts returns results from DB | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.1: Search and recall read from SQLite discoverFts searches relevance column preferentially | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.1: Search and recall read from SQLite getActiveMemories returns only active-tier memories | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.1: Search and recall read from SQLite recall module can be imported and has expected exports | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.2: SQLite read performance fetches 100 memories in under 100ms | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.2: SQLite read performance FTS5 search on 100 memories completes in under 50ms | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.3: Multi-project recall with projectRoot getMemoriesByProject returns only that project's memories | UNMAPPED | passed | See source review |
| src/test/phase7b.read-paths.test.ts | Phase 7b: Read Paths Rewired TC-7b.3: Multi-project recall with projectRoot user-scoped memories are accessible regardless of project | UNMAPPED | passed | See source review |
| src/test/phase7c.dual-write.test.ts | Phase 7c: Dual-Write TC-7c.2: Manual markdown edits picked up on reindex search index reflects manual edits after reindex | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7c.dual-write.test.ts | Phase 7c: Dual-Write TC-7c.3: Updates propagate to both layers updating store memory updates modified date | STRONG | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.1: Dream Mode configuration and engine GnosysDreamEngine class is importable | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.1: Dream Mode configuration and engine DEFAULT_DREAM_CONFIG has disabled=true by default | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.1: Dream Mode configuration and engine DEFAULT_DREAM_CONFIG has sensible idle threshold | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.1: Dream Mode configuration and engine dream config supports self-critique and summary generation flags | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.2: Resource safety (no CPU hog) dream config has runtime limits | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.3: Dream activity audit logging audit_log accepts dream-related entries | UNMAPPED | passed | See source review |
| src/test/phase7d.dream.test.ts | Phase 7d: Dream Mode TC-7d.3: Dream activity audit logging audit_log entries have correct schema | UNMAPPED | passed | See source review |
| src/test/phase7e.export.test.ts | Phase 7e: Obsidian Export Bridge TC-7e.1: Export creates clean Obsidian vault exports memories into target directory | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7e.export.test.ts | Phase 7e: Obsidian Export Bridge TC-7e.1: Export creates clean Obsidian vault exported files preserve wikilinks | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7e.export.test.ts | Phase 7e: Obsidian Export Bridge TC-7e.1: Export creates clean Obsidian vault only exports active memories when activeOnly=true | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase7e.export.test.ts | Phase 7e: Obsidian Export Bridge TC-7e.2: Round-trip export and re-import exported memory can be read back as valid markdown | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.1: gnosys init creates central DB + project identity gnosys init creates .gnosys directory with gnosys.json | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.1: gnosys init creates central DB + project identity projectId is a valid UUID-like string | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.1: gnosys init creates central DB + project identity gnosys.json includes schemaVersion | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.2: Project data moves to central DB correctly project is registered in central DB after init | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.2: Project data moves to central DB correctly multiple projects can coexist in central DB | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.2: Project data moves to central DB correctly getProjectByDirectory finds project by path | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.3: project_id and scope columns populated correctly project-scoped memories have project_id set | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.3: project_id and scope columns populated correctly user-scoped memories have null project_id | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.3: project_id and scope columns populated correctly global-scoped memories have null project_id | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.3: project_id and scope columns populated correctly scope constraint rejects invalid values | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.4: Backup and restore backup creates a copy of the database | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.4: Backup and restore backup file contains the same data | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.5: Project identity persists across re-init re-init preserves projectId | UNMAPPED | passed | See source review |
| src/test/phase8a.central-db.test.ts | Phase 8a: Central DB + Project Identity TC-8a.5: Project identity persists across re-init project can be updated with new working directory | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user setPreference creates a user-scoped memory | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user getPreference retrieves the stored value | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user getAllPreferences returns all user preferences | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user deletePreference removes the memory | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user updating a preference increments reinforcement_count | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.1: User preference stored with scope=user preference tags are stored | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.2: gnosys sync generates GNOSYS:START/END block injectRules creates new file with markers | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.2: gnosys sync generates GNOSYS:START/END block injectRules replaces existing GNOSYS block | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.2: gnosys sync generates GNOSYS:START/END block syncRules generates rules from DB preferences | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.3: Preferences appear in generated rules block generateRulesBlock includes preference values | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.3: Preferences appear in generated rules block generateRulesBlock includes project conventions | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.3: Preferences appear in generated rules block generateRulesBlock always includes base tool instructions | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.4: User content outside GNOSYS block is preserved preserves content before GNOSYS block | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.4: User content outside GNOSYS block is preserved preserves content after GNOSYS block | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.4: User content outside GNOSYS block is preserved appends GNOSYS block to file without one | UNMAPPED | passed | See source review |
| src/test/phase8b.preferences.test.ts | Phase 8b: Preferences + Rules Generation TC-8b.4: User content outside GNOSYS block is preserved creates parent directories for rules file | UNMAPPED | passed | See source review |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys list returns empty list for new store | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys stats returns statistics | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys projects lists registered projects | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys pref get returns preferences (empty for new store) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys pref set + get round-trips a value | STRONG | passed | See source review |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys --help shows help text | STRONG | passed | See source review |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.1: Core CLI commands functional gnosys init --help shows init options | STRONG | passed | See source review |
| src/test/phase8c.cli-parity.test.ts | Phase 8c: CLI Parity TC-8c.3: CLI auto-detects projectId from gnosys.json CLI scopes list to the current working directory and shared memories | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting project-scoped results rank higher than user-scoped | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting user-scoped results rank higher than global-scoped | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting recently modified memories get a recency boost | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting reinforced memories get a reinforcement boost | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting respects includeGlobal=false | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.1: Federated search with tier boosting returns empty array for no matches | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.2: Multi-project ambiguity detection returns null for single-project match | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.2: Multi-project ambiguity detection detects ambiguity across multiple projects | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.3: Project briefing generation generates a briefing with correct stats | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.3: Project briefing generation returns null for non-existent project | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.3: Project briefing generation generateAllBriefings covers all projects | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.4: Cross-project search federatedSearch finds memories across projects | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.4: Cross-project search working set returns only recent project memories | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.4: Cross-project search formatWorkingSet handles empty set | STRONG | passed | See source review |
| src/test/phase8d.federated.test.ts | Phase 8d: Federated Search + Ambiguity TC-8d.4: Cross-project search formatWorkingSet includes memory details | STRONG | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods ping returns ok with pid | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods add creates a memory and returns id + title | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods add with minimal params auto-generates title | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods add without content returns error | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods recall returns results for matching query | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods recall without query returns error | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods get retrieves a specific memory | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods get with invalid id returns error | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods list returns memories | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods list filters by category | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.1: Sandbox server handles all request methods stats returns database statistics | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.2: Sandbox server handles invalid requests unknown method returns error | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.2: Sandbox server handles invalid requests response id matches request id | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client can ping the server | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client can add and get a memory | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client can list memories | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client can get stats | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client isRunning returns true for running server | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.3: Sandbox client round-trip via socket client isRunning returns false for bad socket | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.4: Helper library generator creates valid file generates gnosys-helper.ts in the target directory | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.4: Helper library generator creates valid file generated file contains the gnosys export | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.4: Helper library generator creates valid file generated file includes socket path logic | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.4: Helper library generator creates valid file generated file includes auto-start logic | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.5: Add + Recall round-trip through sandbox added memory can be recalled by content query | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.5: Add + Recall round-trip through sandbox multiple adds and recall with limit | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.5: Add + Recall round-trip through sandbox add with project_id scopes the memory | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.6: Reinforce boosts confidence reinforce increments count and confidence | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.6: Reinforce boosts confidence reinforce by query finds and boosts the memory | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.6: Reinforce boosts confidence reinforce caps confidence at 1.0 | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.7: Sandbox path utilities getSandboxDir returns a path under ~/.gnosys | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.7: Sandbox path utilities getSocketPath returns platform-appropriate path | UNMAPPED | passed | See source review |
| src/test/phase9a.sandbox.test.ts | TC-9a.7: Sandbox path utilities getPidPath returns path under sandbox dir | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.1: Dream Mode idle triggering and state tracking DreamScheduler starts and stops without error | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.1: Dream Mode idle triggering and state tracking DreamScheduler recordActivity resets idle timer | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.1: Dream Mode idle triggering and state tracking initDreamMode creates a scheduler with correct state | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.1: Dream Mode idle triggering and state tracking dream_status returns state through sandbox protocol | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.1: Dream Mode idle triggering and state tracking Dream engine reports errors when conditions not met | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_set creates a preference | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_get retrieves a preference | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_get returns error for nonexistent preference | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_list returns all preferences | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_delete removes a preference | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol pref_set without key returns error | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.2: Preference CRUD through sandbox protocol preferences are stored as user-scoped memories | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.3: Sync rules generation through sandbox sync method generates rules block with preferences | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.3: Sync rules generation through sandbox sync method includes project conventions | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.3: Sync rules generation through sandbox sync without project_dir returns error | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.4: User/global scope memory creation add with scope: user creates user-scoped memory | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.4: User/global scope memory creation add with scope: global creates global-scoped memory | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.4: User/global scope memory creation add defaults to scope: project | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.5: Dream Mode integration with sandbox request handler client can check dream status | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.5: Dream Mode integration with sandbox request handler client can set and list preferences | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.6: Rules file injection with protected blocks injectRules creates new file with GNOSYS markers | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.6: Rules file injection with protected blocks injectRules preserves content outside GNOSYS block | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.6: Rules file injection with protected blocks injectRules replaces existing GNOSYS block | UNMAPPED | passed | See source review |
| src/test/phase9b.dream-prefs-sync.test.ts | TC-9b.6: Rules file injection with protected blocks injectRules with preferences includes preference content | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.1: Federated search ranking with tier boosting project-scoped memories rank higher than user and global | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.1: Federated search ranking with tier boosting results include scope and boost information | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.1: Federated search ranking with tier boosting without projectId context, project memories still rank by scope boost | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.2: Scope filtering in federated search scopeFilter restricts results to specified scope | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.2: Scope filtering in federated search scopeFilter with multiple scopes returns matching results | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.2: Scope filtering in federated search scopeFilter with empty array returns all results | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.2: Scope filtering in federated search includeGlobal=false excludes global when no scopeFilter | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.2: Scope filtering in federated search scopeFilter takes precedence over includeGlobal | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.3: Federated discover with scope filter federatedDiscover returns results with scope info | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.3: Federated discover with scope filter federatedDiscover respects scopeFilter | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.4: Recency boosting in federated search recent memories get recency boost | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.5: CLI --json output includes scope info gnosys list --json produces valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.5: CLI --json output includes scope info gnosys search --json produces valid JSON with results array | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.5: CLI --json output includes scope info gnosys stats --json produces valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.5: CLI --json output includes scope info gnosys status --system --json produces valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys --help lists public top-level commands | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys search --help shows --federated and --scope flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys discover --help shows --federated and --scope flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys recall --help shows --federated and --scope flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys hybrid-search --help shows --federated, --scope, and --json flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys ask --help shows --federated and --scope flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys fsearch --help shows --scope flag | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys add-structured --help shows --user and --global flags | UNMAPPED | passed | See source review |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys audit --json outputs valid JSON | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys tags lists the tag registry without error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9c.cli-federated.test.ts | TC-9c.6: CLI parity — all major commands functional gnosys lens runs without error | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter search() returns FTS5 results as SearchResult format | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter discover() returns FTS5 results as DiscoverResult format | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter hybridSearch() keyword mode returns ranked results | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter hybridSearch() falls back to keyword when no embeddings | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter hybridSearch() semantic mode returns empty when no embeddings | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter loadContent() fills in full content from DB | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter getMemory() returns a memory by ID | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter getMemory() returns null for unknown ID | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter hasEmbeddings() returns false when no embeddings stored | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter embeddingCount() returns 0 when no embeddings stored | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.1: GnosysDbSearch — FTS5 adapter search respects limit parameter | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncMemoryToDb inserts a memory from frontmatter | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncMemoryToDb handles array tags correctly | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncMemoryToDb handles object tags by flattening | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncMemoryToDb sets tier=archive for archived status | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncMemoryToDb accepts projectId and scope | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncUpdateToDb updates partial fields | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncUpdateToDb updates content and hash | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncArchiveToDb sets tier and status to archive | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncDearchiveToDb restores tier and status to active | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncDeleteToDb removes memory from DB | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncReinforcementToDb updates count and timestamp | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions syncConfidenceToDb updates confidence | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.2: dbWrite — sync functions auditToDb logs an audit entry without throwing | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format initAudit creates audit.jsonl and subsequent logs are readable | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format readAuditLog returns empty array when no log exists | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format readAuditLog filters by operation | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format readAuditLog filters by limit (most recent) | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format readAuditLog handles malformed lines gracefully | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format formatAuditTimeline groups by date with summary | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.3: Audit — init, log, read, filter, format formatAuditTimeline handles empty entries | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.4: Lock — acquire/release and stale detection acquireWriteLock creates lock file and release removes it | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.4: Lock — acquire/release and stale detection acquireWriteLock detects stale lock from dead process | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.4: Lock — acquire/release and stale detection acquireWriteLock detects stale lock from old timestamp | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.4: Lock — acquire/release and stale detection release function is idempotent | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.4: Lock — acquire/release and stale detection creates .config directory if it doesn't exist | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up createProjectIdentity creates identity file and returns it | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up createProjectIdentity reuses existing projectId | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up readProjectIdentity reads valid identity | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up readProjectIdentity returns null for missing file | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up readProjectIdentity returns null for invalid JSON | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up readProjectIdentity returns null for missing required fields | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up checkDirectoryMismatch detects when directory has moved | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up checkDirectoryMismatch returns false when directory matches | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up checkDirectoryMismatch returns false with no identity | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up findProjectIdentity walks up directory tree | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up findProjectIdentity returns null at filesystem root | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up detectAgentRulesTarget returns null when no IDE markers present | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up detectAgentRulesTarget detects .cursor directory | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up detectAgentRulesTarget detects CLAUDE.md file | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up createProjectIdentity registers in central DB when provided | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.6: Multi-project — cross-project isolation memories from different projects are isolated by project_id | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.6: Multi-project — cross-project isolation FTS search finds memories across all projects | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.6: Multi-project — cross-project isolation projects table tracks all registered projects | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.6: Multi-project — cross-project isolation updating a project works correctly | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.6: Multi-project — cross-project isolation projects remain in registry after insertion | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeMemory() generates unique IDs on each call | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeMemory() applies overrides correctly | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeMemory() has sensible defaults | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeProject() generates unique IDs on each call | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeProject() applies overrides correctly | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions makeFrontmatter() applies overrides correctly | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions createTestEnv provides working DB | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions cleanupTestEnv removes temp directory | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.7: Helpers library — factory functions seedMultiProjectMemories creates expected memory layout | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.8: Graph — load and format stats loadGraph returns null when no graph.json exists | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.8: Graph — load and format stats loadGraph reads a valid graph.json | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.8: Graph — load and format stats formatGraphStats produces readable output | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.8: Graph — load and format stats formatGraphStats handles null mostConnected | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.9: enableWAL utility enableWAL does not throw on mock DB | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.9: enableWAL utility enableWAL handles errors gracefully | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.10: CLI working-set commands gnosys stats --json reports memory count for initialized project | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.10: CLI working-set commands gnosys list --json reports memories array for initialized project | UNMAPPED | passed | See source review |
| src/test/phase9d.coverage-overhaul.test.ts | TC-9d.10: CLI working-set commands gnosys audit --json reports empty entries for fresh project | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.1: GnosysDB constructor retry logic opens a DB successfully on a valid path (no retries needed) | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.1: GnosysDB constructor retry logic opens a DB with explicit retry options (retries: 0) | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.1: GnosysDB constructor retry logic opens a DB with network-like retry options (5 retries, 100ms delay) | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.1: GnosysDB constructor retry logic returns unavailable when Database module is absent (constructor guard) | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.2: GnosysDB constructor with retry options default retry count is 3 (no opts) | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.2: GnosysDB constructor with retry options creates directory recursively if needed | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.3: Network path detection in sandbox handleRequest handleRequest ping works with normal DB | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.3: Network path detection in sandbox handleRequest handleRequest add+recall round-trip on standard path | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.4: Backup/restore round-trip db.backup creates a backup file | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.4: Backup/restore round-trip backup + restore round-trip preserves data | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.5: Backup with custom --to path backup supports custom destination directory | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.6: SandboxStatus interface includes dbPath SandboxStatus type has all expected fields | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.6: SandboxStatus interface includes dbPath SandboxStatus dbPath is optional | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.7: busy_timeout pragma is set new GnosysDB sets busy_timeout to 10000 | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.8: Manager SandboxStatus type shape has required running field | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.8: Manager SandboxStatus type shape supports all optional fields | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.9: CLI backup/restore --json output backup --json outputs valid JSON | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.10: Documentation files exist README.md exists and contains key content | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.10: Documentation files exist CONTRIBUTING.md exists | UNMAPPED | passed | See source review |
| src/test/phase9e.network-share-polish.test.ts | TC-9e.10: Documentation files exist package.json version starts with 4. | UNMAPPED | passed | See source review |
| src/test/pref-invoke.test.ts | pref set/get (in-process invoke) sets a known preference key and echoes key/value | UNMAPPED | passed | See source review |
| src/test/pref-invoke.test.ts | pref set/get (in-process invoke) reads the stored preference back | UNMAPPED | passed | See source review |
| src/test/pref-invoke.test.ts | pref set/get (in-process invoke) rejects a near-miss key with a suggestion and exitCode 1 | UNMAPPED | passed | See source review |
| src/test/preference-key-validation.test.ts | suggestPreferenceKey returns null for an exact known key | UNMAPPED | passed | See source review |
| src/test/preference-key-validation.test.ts | suggestPreferenceKey returns the closest known key for a close typo | UNMAPPED | passed | See source review |
| src/test/preference-key-validation.test.ts | suggestPreferenceKey returns null for a far custom key (allowed through) | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences sets and gets a preference | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences auto-generates title from key | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences allows custom title | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences stores as user-scoped memory | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences updates existing preference (increments reinforcement) | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences lists all preferences | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences deletes a preference | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences returns false when deleting nonexistent preference | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | preferences stores tags on preference | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules generation generates base instructions with no preferences | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules generation includes preferences in generated block | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules generation includes project conventions in generated block | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules injection creates new file with GNOSYS block | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules injection replaces existing GNOSYS block | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules injection preserves user content outside GNOSYS block | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules injection appends GNOSYS block to existing file without one | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | rules injection creates parent directories for new rules file | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | syncRules (end-to-end) generates rules from preferences in DB | UNMAPPED | passed | See source review |
| src/test/preferences.test.ts | syncRules (end-to-end) returns null when no agent rules target | UNMAPPED | passed | See source review |
| src/test/progress.test.ts | createProgress returns a no-op progress instance when verbose is false | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/progress.test.ts | createProgress emits header, step, and done lines when verbose is true | UNMAPPED | passed | See source review |
| src/test/provenance-trace.test.ts | memory provenance walk gnosys read surfaces source_file, source_page, and source_path | UNMAPPED | passed | See source review |
| src/test/provenance-trace.test.ts | memory provenance walk ingest audit row links source_file for provenance walk | UNMAPPED | passed | See source review |
| src/test/read-command-overlay.test.ts | gnosys read command overlay wiring routes read-by-id through the client read overlay like its siblings | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/read-command-overlay.test.ts | gnosys read command overlay wiring keeps the legacy resolver fallback for markdown stores | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/read-command-overlay.test.ts | getMemoryWithOverlay falls back to the pending overlay when the DB misses | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/read-command-overlay.test.ts | getMemoryWithOverlay returns null when neither DB nor overlay has the id | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/read-invoke.test.ts | runReadCommand (in-process invoke) prints the memory with frontmatter header and body (human) | UNMAPPED | passed | See source review |
| src/test/read-invoke.test.ts | runReadCommand (in-process invoke) emits structured JSON for the memory (--json) | UNMAPPED | passed | See source review |
| src/test/recall-hook.test.ts | hookQueryFromStdin extracts prompt_text from UserPromptSubmit events | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | hookQueryFromStdin accepts the legacy `prompt` field name | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | hookQueryFromStdin SessionStart events (no prompt) become wildcard | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | hookQueryFromStdin non-JSON and empty stdin become wildcard | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | hookQueryFromStdin truncates very long prompts | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/recall-hook.test.ts | configureClaudeCode hook installation (v5.14.0) installs SessionStart AND UserPromptSubmit hooks running gnosys recall-hook | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | configureClaudeCode hook installation (v5.14.0) heals the broken pre-5.14 hook command in place | STRONG | passed | See source review |
| src/test/recall-hook.test.ts | configureClaudeCode hook installation (v5.14.0) is idempotent and preserves foreign hooks | STRONG | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) recall("*") returns top active memories instead of nothing (the v4.0.0 bug) | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) wildcard ordering prefers reinforcement, then confidence, then recency | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) archived and superseded memories are excluded from wildcard recall | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) formatRecall emits a real <gnosys-recall> block, not the no-op string | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) pure-punctuation queries behave like wildcard | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) respects the limit option | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) non-aggressive mode keeps wildcard results (scores floored above minRelevance) | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | wildcard recall (gnosys://recall resource path) real keyword recall is unchanged (regression guard) | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | countDreamworthyChanges (v5.13.1 self-healing gate) polluted state (count 5 vs 1200 memories, today's watermark) is dreamworthy via count delta | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | countDreamworthyChanges (v5.13.1 self-healing gate) date watermark still wins when it reports more change | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | countDreamworthyChanges (v5.13.1 self-healing gate) no stored count means no delta signal (fresh state relies on the date path) | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | countDreamworthyChanges (v5.13.1 self-healing gate) accurate state with no changes is not dreamworthy | UNMAPPED | passed | See source review |
| src/test/recall-wildcard.test.ts | countDreamworthyChanges (v5.13.1 self-healing gate) bulk deletion also counts as change | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | getProjectRegistryPath isolation lives under $GNOSYS_HOME/config when GNOSYS_HOME is set | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | getProjectRegistryPath isolation GNOSYS_CONFIG_DIR still wins over GNOSYS_HOME | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | getProjectRegistryPath isolation defaults to ~/.config/gnosys without overrides | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | isTempProjectPath classifies temp locations | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | registerProject temp-path guard skips temp paths when the registry is the real (non-isolated) one | UNMAPPED | passed | See source review |
| src/test/registry-temp-pollution.test.ts | registerProject temp-path guard allows temp paths when GNOSYS_HOME isolates the registry | UNMAPPED | passed | See source review |
| src/test/reindex-graph-invoke.test.ts | runReindexGraphCommand (in-process invoke) rebuilds the graph and prints stats for a project store | UNMAPPED | passed | See source review |
| src/test/reindex-graph-invoke.test.ts | runReindexGraphCommand (in-process invoke) is idempotent — a second run also succeeds | UNMAPPED | passed | See source review |
| src/test/remote-audit-sync.test.ts | audit_log sync push copies local audit entries to remote | UNMAPPED | passed | See source review |
| src/test/remote-audit-sync.test.ts | audit_log sync pull copies remote-only audit entries to local | UNMAPPED | passed | See source review |
| src/test/remote-audit-sync.test.ts | audit_log sync does not double-push entries already on the remote | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote-audit-sync.test.ts | audit_log sync first push sends ALL local entries regardless of remote contents (full convergence) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote-audit-sync.test.ts | audit_log sync full sync (push + pull) merges audit entries from both sides | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases applies merged content to both sides | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases rejects merged without mergedMemory payload | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases rejects invalid choice strings | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases returns error when remote is not reachable | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases returns error when memory exists on neither side | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.resolve edge cases returns insert error when localDb.insertMemory throws | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.migrate partial failures copies projects and memories and sets last sync on success | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.migrate partial failures returns error when remote is not reachable | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.migrate partial failures continues when one project insert fails | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.migrate partial failures continues when one memory insert fails | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname uses HOSTNAME env var for new ids | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname falls back to COMPUTERNAME when HOSTNAME is unset | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname falls back to os.hostname when env vars are unset | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname returns unknown- prefix when os.hostname throws | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname self-heals stale unknown- id and dream_machine_id | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname keeps stale unknown- id when hostname still cannot resolve | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname returns stable cached non-stale id unchanged | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | getMachineId and resolveHostname does not treat host-abc123 as stale unknown id | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.getStatus SQLITE_BUSY returns friendly message on SQLITE_BUSY | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.getStatus SQLITE_BUSY rethrows non-busy sqlite errors | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | formatStatus branches formats not configured | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | formatStatus branches formats unreachable path | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | formatStatus branches includes conflict count | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | formatStatus branches includes custom message line | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | validateLocation extras warns when directory is created | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | validateLocation extras warns on high sqlite probe latency | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | validateLocation extras reports sqlite test failure when setMeta throws | UNMAPPED | passed | See source review |
| src/test/remote-coverage.test.ts | RemoteSync.closeRemote clears cached remoteDb handle | UNMAPPED | passed | See source review |
| src/test/remote-resume.test.ts | remote push resume after interruption resumes after simulated mid-push kill with no corruption or duplicates | UNMAPPED | passed | See source review |
| src/test/remote-two-machine.test.ts | two-machine remote sync simulation A→NAS→B round-trip with conflict loses no data | UNMAPPED | passed | See source review |
| src/test/remote.test.ts | validateLocation returns ok for a writable directory | STRONG | passed | See source review |
| src/test/remote.test.ts | validateLocation creates the directory if it does not exist | STRONG | passed | See source review |
| src/test/remote.test.ts | validateLocation detects existing gnosys.db at path | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | RemoteSync.getStatus reports reachable when remote exists | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.getStatus reports unreachable when remote path missing | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.getStatus counts pending push when local has new memories | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.getStatus counts pending pull when remote has new memories | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.push pushes new local memories to remote | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | RemoteSync.push pushes locally-modified memory when remote unchanged | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.pull pulls new remote memories to local | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | RemoteSync.pull pulls remotely-modified memory when local unchanged | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync conflict detection flags conflict when both sides modified the same memory | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync conflict detection newer-wins strategy auto-resolves conflicts | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.resolve keeps local version on resolve(local) | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.resolve keeps remote version on resolve(remote) | STRONG | passed | See source review |
| src/test/remote.test.ts | RemoteSync.migrate copies all local memories to a fresh remote | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | RemoteSync.sync (full cycle) two-way sync: local push and remote pull happen in one call | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | getMachineId generates and persists a stable machine ID | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remote.test.ts | formatStatus formats unconfigured status | STRONG | passed | See source review |
| src/test/remote.test.ts | formatStatus formats unreachable status | STRONG | passed | See source review |
| src/test/remote.test.ts | formatStatus formats normal status with counts | STRONG | passed | See source review |
| src/test/remote.test.ts | remote config helpers getConfiguredRemotePath prefers machine.json over legacy meta | STRONG | passed | See source review |
| src/test/remote.test.ts | remote config helpers clearRemoteSyncConfig clears meta and machine.json remote | STRONG | passed | See source review |
| src/test/remoteWizard.test.ts | remoteWizard v13 helpers matchesTypedPhrase requires exact match after trim | STRONG | passed | See source review |
| src/test/remoteWizard.test.ts | remoteWizard v13 helpers detectClonedStagingPresence uses the per-client presence file | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/remoteWizard.test.ts | remoteWizard v13 render screens renderV13ExplanationScreen includes key v13 rules | STRONG | passed | See source review |
| src/test/remoteWizard.test.ts | remoteWizard v13 render screens renderMasterBackupWarning includes daily snapshot copy | STRONG | passed | See source review |
| src/test/remoteWizard.test.ts | remoteWizard v13 render screens renderBackupDeclineAckPrompt requires the v13 typed phrase | STRONG | passed | See source review |
| src/test/resolver-routing.test.ts | Resolver project routing resolves to cwd project even when another project is registered first | UNMAPPED | passed | See source review |
| src/test/resolver-routing.test.ts | Resolver project routing resolves to cwd project when only a different project is registered | UNMAPPED | passed | See source review |
| src/test/resolver-routing.test.ts | Resolver project routing falls back to registered project when cwd has no store | UNMAPPED | passed | See source review |
| src/test/resolver-routing.test.ts | Resolver project routing registerProject adds project to projects.json | UNMAPPED | passed | See source review |
| src/test/resolver-routing.test.ts | Resolver project routing registerProject is idempotent | UNMAPPED | passed | See source review |
| src/test/resolver-tiers.test.ts | resolveForProject cross-project tiers loads project + personal + global tiers when scoped to a projectRoot | UNMAPPED | passed | See source review |
| src/test/resolver-tiers.test.ts | resolveForProject cross-project tiers getWriteTarget('global') resolves under a projectRoot (the reported bug) | UNMAPPED | passed | See source review |
| src/test/resolver-tiers.test.ts | resolveForProject cross-project tiers auto-creates the global store directory when it does not pre-exist | UNMAPPED | passed | See source review |
| src/test/resolver-tiers.test.ts | resolveForProject cross-project tiers still defaults writes to project (global is never auto-selected) | UNMAPPED | passed | See source review |
| src/test/resolver-tiers.test.ts | resolveForProject cross-project tiers falls back to personal as the write target when no project store exists | UNMAPPED | passed | See source review |
| src/test/retry.test.ts | isTransientError returns true for rate limits, timeouts, 5xx, and network errors | UNMAPPED | passed | See source review |
| src/test/retry.test.ts | isTransientError returns false for ordinary errors | UNMAPPED | passed | See source review |
| src/test/retry.test.ts | withRetry resolves after transient failures | UNMAPPED | passed | See source review |
| src/test/retry.test.ts | withRetry rethrows non-transient errors immediately | UNMAPPED | passed | See source review |
| src/test/sandbox-status-invoke.test.ts | runSandboxStatusCommand (in-process invoke) reports the sandbox as not running in a fresh GNOSYS_HOME (human) | UNMAPPED | passed | See source review |
| src/test/sandbox-status-invoke.test.ts | runSandboxStatusCommand (in-process invoke) emits structured JSON with running: false (--json) | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability keyword top-3 stable for "JWT OAuth login" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability keyword top-3 stable for "Redis cache invalidation" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability keyword top-3 stable for "PostgreSQL schema migration" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability keyword top-3 stable for "embeddings semantic hybrid FTS" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability discover top-3 stable for "JWT OAuth login" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability discover top-3 stable for "Redis cache invalidation" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability discover top-3 stable for "PostgreSQL schema migration" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability discover top-3 stable for "embeddings semantic hybrid FTS" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability federated top-3 stable for "JWT OAuth login" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability federated top-3 stable for "Redis cache invalidation" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability federated top-3 stable for "PostgreSQL schema migration" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability federated top-3 stable for "embeddings semantic hybrid FTS" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability hybrid top-3 stable for "JWT OAuth login" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability hybrid top-3 stable for "Redis cache invalidation" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability hybrid top-3 stable for "PostgreSQL schema migration" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability hybrid top-3 stable for "embeddings semantic hybrid FTS" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability semantic top-3 stable for "JWT OAuth login" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability semantic top-3 stable for "Redis cache invalidation" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability semantic top-3 stable for "PostgreSQL schema migration" | UNMAPPED | passed | See source review |
| src/test/search-golden.test.ts | search golden — top-3 stability semantic top-3 stable for "embeddings semantic hybrid FTS" | UNMAPPED | passed | See source review |
| src/test/search-invoke.test.ts | runSearchCommand (in-process invoke, federated path) finds the seeded memory via --federated --json | UNMAPPED | passed | See source review |
| src/test/search-invoke.test.ts | runSearchCommand (in-process invoke, federated path) prints a no-results message for an unmatched federated query | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch reindex + search indexes memories and finds them by keyword | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch reindex + search returns empty array for no matches | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch reindex + search handles empty query | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch discover discovers memories via relevance keyword cloud | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch discover falls back to full-text when column filter finds nothing | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch multi-store indexing indexes multiple stores with label prefixes | UNMAPPED | passed | See source review |
| src/test/search.test.ts | GnosysSearch clearIndex removes all entries from the index | UNMAPPED | passed | See source review |
| src/test/setup-ctrlc.test.ts | Phase B — Ctrl+C clean exit gnosys setup exits cleanly on SIGINT | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ctrlc.test.ts | Phase B — Ctrl+C clean exit gnosys setup models exits cleanly on SIGINT | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ctrlc.test.ts | Phase B — Ctrl+C clean exit gnosys setup ides exits cleanly on SIGINT | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-models-routing.test.ts | setup models task routing buildInlineKeyRequirements lists one global requirement per distinct cloud provider | STRONG | passed | See source review |
| src/test/setup-models-routing.test.ts | setup models task routing buildInlineKeyRequirements emits one requirement per distinct provider | STRONG | passed | See source review |
| src/test/setup-models-routing.test.ts | setup models task routing buildInlineKeyRequirements skips local providers in requirements | STRONG | passed | See source review |
| src/test/setup-models-routing.test.ts | setup models task routing buildTaskModelsPatchFromAccepted regression: vision+dream only — patch touches only those tasks | STRONG | passed | See source review |
| src/test/setup-models-routing.test.ts | setup models task routing validateTaskCombo does not persist keys on validation failure | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-models-routing.test.ts | setup models task routing validateTaskCombo returns proceed true when validation succeeds | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-models-routing.test.ts | setup models task routing promptKeyDestinationAndPersist secure store choice writes the scoped key through the OS boundary | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-models-routing.test.ts | setup models task routing promptKeyDestinationAndPersist dotenv choice writes scoped service line | STRONG | passed | See source review |
| src/test/setup-models-routing.test.ts | setup models task routing promptKeyDestinationAndPersist don't store prints env var names and persists nothing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-models-routing.test.ts | setup models task routing writeServiceKeyToEnv writes global-scoped env var lines | STRONG | passed | See source review |
| src/test/setup-storepath.test.ts | setup/storePath — Phase B (Bug 10) resolveActiveStorePath returns project store when gnosys.json exists there | UNMAPPED | passed | See source review |
| src/test/setup-storepath.test.ts | setup/storePath — Phase B (Bug 10) resolveActiveStorePath falls back to global home when no project config exists | UNMAPPED | passed | See source review |
| src/test/setup-storepath.test.ts | setup/storePath — Phase B (Bug 10) resolveActiveStorePath does not create the global home if missing | UNMAPPED | passed | See source review |
| src/test/setup-storepath.test.ts | setup/storePath — Phase B (Bug 10) ensureActiveStorePath creates the global home when no config exists | UNMAPPED | passed | See source review |
| src/test/setup-storepath.test.ts | setup/storePath — Phase B (Bug 10) ensureActiveStorePath prefers the project store over the global home | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Header renders breadcrumb + version + rule | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Header without version | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Title with subtitle | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Title without subtitle | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Menu renders numbered items with meta + tag | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Menu with only labels (no meta, no tag) | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Status — ok with meta | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Status — warn with meta | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Status — fail | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Status — progress | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Diff renders before/after rows | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Panel renders rounded box with title and rows | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A Footer renders right-aligned hint | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A stripAnsi removes ANSI escapes | UNMAPPED | passed | See source review |
| src/test/setup-ui-atoms.test.ts | setup/ui atoms — Phase A tokens — color() wraps text with reset | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-coldstart.test.ts | Phase D — cold-start wizard renderers renderColdStartSplash includes brand mark, version, and step preview | STRONG | passed | See source review |
| src/test/setup-ui-coldstart.test.ts | Phase D — cold-start wizard renderers renderColdStartSplash handles version with leading v | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-coldstart.test.ts | Phase D — cold-start wizard renderers renderStepHeader includes step counter | STRONG | passed | See source review |
| src/test/setup-ui-coldstart.test.ts | Phase D — cold-start wizard renderers renderDonePanelRows aligns labels and shows full summary | STRONG | passed | See source review |
| src/test/setup-ui-coldstart.test.ts | Phase D — cold-start wizard renderers renderDonePanelRows handles no IDEs | STRONG | passed | See source review |
| src/test/setup-ui-config-init.test.ts | Phase E — Screen 14 — config init without --force prints deprecation warning and does NOT write template | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-config-init.test.ts | Phase E — Screen 14 — config init with --force writes a template without defaultProvider hardcoded | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-screen1-substeps.test.ts | Screens 1.1 / 1.2 / 1.3 — cold-start sub-screen headers renders the provider sub-screen header (Screen 1.1) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen1-substeps.test.ts | Screens 1.1 / 1.2 / 1.3 — cold-start sub-screen headers renders the model sub-screen header (Screen 1.2) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen1-substeps.test.ts | Screens 1.1 / 1.2 / 1.3 — cold-start sub-screen headers renders the key sub-screen header (Screen 1.3) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen1-substeps.test.ts | Screens 1.1 / 1.2 / 1.3 — cold-start sub-screen headers renderKeySourceRows tags the env-var row with `◂ found` when detected | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen1-substeps.test.ts | Screens 1.1 / 1.2 / 1.3 — cold-start sub-screen headers renderKeyStepFooter has the 1-4 hint | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders the header with version | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render collapsePath shortens long absolute paths | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders the upgraded section with full project list | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders upgraded with overflow collapse (more than 5) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders the skipped section with no .gnosys directory hint | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders the failed section when there are failures | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders machines section with older-version warning | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders machines section returns empty when only one machine | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders the done line with version | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen10.test.ts | Screen 10 — sync-projects render renders dashboard summary with collapsed paths | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers suggests documented keys for misspelled config inputs | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers suggestConfigKey returns null on exact match | STRONG | passed | See source review |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers suggestConfigKey suggests close matches on typo | STRONG | passed | See source review |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers suggestConfigKey returns null on wild miss | STRONG | passed | See source review |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers classifyStore returns 'global' for ~/.gnosys | STRONG | passed | See source review |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers classifyStore returns 'project' for any other path | STRONG | passed | See source review |
| src/test/setup-ui-screen13.test.ts | Screen 13 — config set helpers levenshtein computes edit distance correctly | STRONG | passed | See source review |
| src/test/setup-ui-screen3.test.ts | Screen 3 — models diff rows renders both rows when nothing has changed (cold start) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen3.test.ts | Screen 3 — models diff rows returns a single row when only the model changed | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen3.test.ts | Screen 3 — models diff rows returns both rows when the user switched providers | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen3.test.ts | Screen 3 — models diff rows emits both rows as a fallback when nothing differs but config is established | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render classifyCost: ollama and lmstudio are always free | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render classifyCost: anthropic sonnet is mid-tier | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render classifyCost: groq small is cheap | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render classifyCost: unknown model defaults to $$ (conservative) | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render renders the routing table with the cost column | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render renders the routing table with ▶ markers on changed rows | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render renders the diff block with → for changes and (unchanged) otherwise | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen4.test.ts | Screen 4 — routing render renderRoutingDiff returns empty string when no entries | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders the reconfigure intro with `not configured` when no remote | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renderV13ExplanationScreen matches snapshot | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders the intro with the remote path when configured | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders validation summary with all checks ok | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders validation summary with existing DB and warnings | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders validation summary with failures | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render renders the diff with previous → new | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen6.test.ts | Screen 6 — remote render SYNC_MODE_LABELS covers all three modes | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen7.test.ts | Screen 7 — dream render builds the diff rows for a first-time enable | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen7.test.ts | Screen 7 — dream render builds the diff rows showing what changed on a re-run | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen7.test.ts | Screen 7 — dream render renders the thresholds block with default values inside [N ] fields | UNMAPPED | passed | See source review |
| src/test/setup-ui-screen7.test.ts | Screen 7 — dream render renders sub-tasks with ○ when disabled | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) formatMultiMachineSyncSummary shows NA when remote is not configured | UNMAPPED | passed | See source review |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) describeMultiMachineSyncPanel shows NA with no remote meta or machine config | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) renders panel row 4 with NA when multi-machine sync is not configured | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) renders panel rows for a fresh config (no default provider) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) renders panel rows after a switch to xai | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) marks an edited routing section after saving and reloading its config | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-summary.test.ts | Phase C — settings panel (summary) DEF-G1-001 reset routing clears persisted task overrides | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A renders header + divider + rows (auto-fit widths) | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A omits header when showHeader is false | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A renders header without divider when dividerAfterHeader is false | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A supports fixed column widths | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A supports right-aligned columns | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A handles empty row arrays (header still emitted) | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A handles empty row arrays with showHeader=false (returns no lines) | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A respects custom indent + gap | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A preserves coloured cell content while padding to printable width | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A invokes rowFormatter for per-row markers | STRONG | passed | See source review |
| src/test/setup-ui-table.test.ts | setup/ui Table atom — Phase A returns [] when columns is empty | STRONG | passed | See source review |
| src/test/setup.test.ts | Setup Wizard PROVIDER_TIERS has entries for all 9 providers | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard PROVIDER_TIERS each provider with tiers has exactly one recommended model | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard PROVIDER_TIERS custom provider has empty tiers array | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard PROVIDER_TIERS all tiers have required fields | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard PROVIDER_TIERS local providers (ollama, lmstudio) have zero pricing | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard getStructuringModel returns claude-haiku-4-5 for anthropic | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard getStructuringModel returns gpt-5.4-nano for openai | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard getStructuringModel returns same model for groq (already cheap) | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard getStructuringModel returns same model for ollama | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard getStructuringModel returns same model for custom | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard writeApiKey creates directory and writes key | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard writeApiKey maps providers to correct env var names | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard writeApiKey does not duplicate keys on second write | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard writeApiKey preserves existing keys for other providers | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard writeApiKey uses GNOSYS_CUSTOM_KEY for custom provider | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard detectIDEs returns an array of strings (IDE detection depends on host environment) | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard detectIDEs returns empty array for bare directory | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard Config defaults match current models default Anthropic model is claude-sonnet-4-6 | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard Config defaults match current models default OpenAI model is gpt-5.4-mini | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard Config defaults match current models default xAI model is grok-4.20 | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard Config defaults match current models default Mistral model is mistral-small-4 | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard Config defaults match current models default Groq model is llama-3.3-70b-versatile | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard parseCommaSeparatedTaskSelection parses comma-separated 1-based indices | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard parseCommaSeparatedTaskSelection accepts all and none | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard parseCommaSeparatedTaskSelection rejects out-of-range values | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard resolveTaskModel structuring optimization anthropic structuring returns claude-haiku-4-5 | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard resolveTaskModel structuring optimization openai structuring returns gpt-5.4-nano | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard resolveTaskModel structuring optimization groq structuring returns the default groq model (no override) | UNMAPPED | passed | See source review |
| src/test/setup.test.ts | Setup Wizard resolveTaskModel structuring optimization explicit task override takes precedence | UNMAPPED | passed | See source review |
| src/test/setupKeys.test.ts | setup keys lists all known providers with env, keychain, dotenv, missing, and local statuses | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys detects every configured storage location for a provider independently | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys does not list key locations for local providers | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys supports the custom provider slot | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys removes only the requested provider keys from the gnosys dotenv file | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys validates an updated key before writing it to dotenv | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys rejects an invalid key before choosing a storage destination | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys routes destination choice to keychain, dotenv, or manual env instructions | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys copies a dotenv-only key to keychain and removes the dotenv line | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys does not copy to keychain or change dotenv when validation fails | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys does not duplicate a key that is already in keychain | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys deletes a dotenv-only key after confirmation | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys deletes a keychain-only key after confirmation | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/setupKeys.test.ts | setup keys deletes all removable keychain and dotenv copies when requested | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/shell-injection-argv.test.ts | shell injection argv form migrateProject copies stores when paths contain spaces | UNMAPPED | passed | See source review |
| src/test/shell-injection-argv.test.ts | shell injection argv form copies literal shell syntax without executing it | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/snapshot-publish-flow.test.ts | v13 snapshot publish flow publishes a snapshot after an ingesting sweep | UNMAPPED | passed | See source review |
| src/test/snapshot-publish-flow.test.ts | v13 snapshot publish flow publishes a bootstrap snapshot even when nothing was staged | UNMAPPED | passed | See source review |
| src/test/snapshot-publish-flow.test.ts | v13 snapshot publish flow does not bump seq for an empty sweep when a manifest already exists | UNMAPPED | passed | See source review |
| src/test/snapshot-publish-flow.test.ts | v13 snapshot publish flow client reads the published snapshot copy, not the live master DB | UNMAPPED | passed | See source review |
| src/test/snapshot-publish-flow.test.ts | v13 snapshot publish flow client refreshes its copy when the master publishes a newer snapshot | UNMAPPED | passed | See source review |
| src/test/stale-invoke.test.ts | runStaleCommand (in-process invoke) lists memories older than the threshold | UNMAPPED | passed | See source review |
| src/test/stale-invoke.test.ts | runStaleCommand (in-process invoke) reports no stale memories with a huge threshold | UNMAPPED | passed | See source review |
| src/test/staticSearch.test.ts | loadIndex loads from a file path | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | loadIndex loads from a JSON string | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | loadIndex caches repeated calls with same source | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | loadIndex throws on invalid JSON | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | loadIndex throws on missing version field | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | loadIndex throws on unsupported version | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | loadIndex throws on missing file | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search returns empty array for no matches | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search returns results sorted by score descending | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search respects limit option | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search respects minScore threshold | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search filters by category | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search filters by tags | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search matches relevance keywords | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search handles multi-word queries | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search returns empty for single-character queries | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search is case-insensitive | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search strips punctuation from query | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search returns matchedTokens in results | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | search boosts recent documents when boostRecent is true | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | search returns empty array for empty query | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | getDocument returns document by ID | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | getDocument returns document by path | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | getDocument returns null for non-existent document | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | listDocuments returns all documents with no filter | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearch.test.ts | listDocuments filters by category | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | listDocuments filters by tags (any match) | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | listDocuments filters by status | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | listDocuments combines multiple filters (AND logic) | STRONG | passed | See source review |
| src/test/staticSearch.test.ts | listDocuments returns empty array when no documents match filter | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | staticSearch dependency boundary runs copied static search without installed packages | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearchSemantic.test.ts | loadVectors loads vectors from a raw JSON string | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | loadVectors retains loaded vectors until the caller clears the cache | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/staticSearchSemantic.test.ts | loadVectors throws on invalid JSON | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | loadVectors throws on missing version | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | loadVectors throws on unsupported version | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | loadVectors throws on wrong quantization | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | loadVectors throws on missing file path | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion keeps lexical search behavior unchanged when semantic inputs are absent | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion falls back to lexical search when one semantic input is absent | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion fuses lexical and semantic rankings with RRF k=60 | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion allows semantic-only documents with empty matched tokens | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion skips vector doc ids that are not in the index | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion falls back to lexical search and warns on model mismatch | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion falls back to lexical search and warns on dimension mismatch | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion dequantizes int8 vectors with scale and offset before cosine ranking | STRONG | passed | See source review |
| src/test/staticSearchSemantic.test.ts | semantic search fusion returns zero cosine for zero-magnitude vectors and dimension mismatches | STRONG | passed | See source review |
| src/test/stats-invoke.test.ts | runStatsCommand (in-process invoke) prints 'No memories found.' on an empty central DB | UNMAPPED | passed | See source review |
| src/test/stats-invoke.test.ts | runStatsCommand (in-process invoke) emits stats JSON with seeded memories (--all --json) | UNMAPPED | passed | See source review |
| src/test/stats-invoke.test.ts | runStatsCommand (in-process invoke) renders the human table with category/status/author sections | UNMAPPED | passed | See source review |
| src/test/store.test.ts | GnosysStore init creates .config internal directory | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore writeMemory + readMemory writes and reads a memory with correct frontmatter | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore writeMemory + readMemory returns null for non-existent memory | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore writeMemory + readMemory returns null for files without id frontmatter | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore getAllMemories returns all valid memories, ignores non-memory files | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore getAllMemories ignores CHANGELOG.md and MANIFEST.md | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/store.test.ts | GnosysStore updateMemory updates frontmatter fields and preserves content | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore updateMemory can replace content | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore updateMemory returns null for non-existent memory | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore getCategories returns only directories, excludes hidden and node_modules | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/store.test.ts | GnosysStore generateId generates ULID-based IDs with category prefix (v5.4.1+) | STRONG | passed | See source review |
| src/test/store.test.ts | GnosysStore supersession fields writes and reads supersedes/superseded_by fields | STRONG | passed | See source review |
| src/test/stores-invoke.test.ts | runStoresCommand (in-process invoke) prints the resolver summary including the project store | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/stores-invoke.test.ts | runStoresCommand (in-process invoke) still prints a summary when no project store exists | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter extracts title from <h1> | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter extracts title from <title> when no <h1> | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter extracts title from markdown heading | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter falls back to filename-derived title | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter maps URL to category using config patterns | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter maps /services/* to services category | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter maps /about* to company category | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter uses "general" category for unmatched URLs | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter extracts keywords from <meta> tags | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter infers type tag from URL path | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter sets correct default field values | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter generates a valid id from URL and category | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | extractStructuredFrontmatter validates against expected structure | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/structuredIngest.test.ts | computeTfIdf returns correct term scores across corpus | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/structuredIngest.test.ts | computeTfIdf handles single-document corpus | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/structuredIngest.test.ts | computeTfIdf filters stop words | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | computeTfIdf selects top N terms per document | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/structuredIngest.test.ts | computeTfIdf returns empty map for empty input | UNMAPPED | passed | See source review |
| src/test/structuredIngest.test.ts | computeTfIdf assigns higher scores to distinctive terms | UNMAPPED | passed | See source review |
| src/test/syncClientRead.test.ts | syncClientRead v13 applyPendingOverlay merges pending and excludes ingested ULIDs | STRONG | passed | See source review |
| src/test/syncClientRead.test.ts | syncClientRead v13 listClientReceipts and getIngestedUlids tolerate missing dir and malformed files | STRONG | passed | See source review |
| src/test/syncClientRead.test.ts | syncClientRead v13 openClientReadContext uses local db for master role | STRONG | passed | See source review |
| src/test/syncClientRead.test.ts | syncClientRead v13 openClientReadContext opens master db when client and reachable | STRONG | passed | See source review |
| src/test/syncClientRead.test.ts | syncClientRead v13 openClientReadContext falls back to accepted snapshot when offline | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncClientRead.test.ts | syncClientRead v13 openClientReadContext returns pending-only when offline without snapshot | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncClientRead.test.ts | syncClientRead v13 openClientReadContext filters pending overlay by ingest receipts | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncIngest.test.ts | syncIngest ingests a staged memory and removes the JSON file | UNMAPPED | passed | See source review |
| src/test/syncIngestAutomation.test.ts | syncIngest automation runMasterIngestSweep output modes json mode writes a single JSON object to stdout | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncIngestAutomation.test.ts | syncIngest automation runMasterIngestSweep output modes json mode still succeeds with zero ingested | STRONG | passed | See source review |
| src/test/syncIngestAutomation.test.ts | syncIngest automation runMasterIngestSweep output modes ingests staged memory in quiet mode without stdout | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncIngestAutomation.test.ts | syncIngest automation maybeRunStartupIngestSweep skips when machine role is client | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncIngestAutomation.test.ts | syncIngest automation maybeRunStartupIngestSweep skips when remote sync is disabled | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncIngestAutomation.test.ts | syncIngest automation launchd plist generation produces valid XML with required keys | STRONG | passed | See source review |
| src/test/syncIngestAutomation.test.ts | syncIngest automation systemd unit generation produces a valid oneshot service unit | STRONG | passed | See source review |
| src/test/syncIngestAutomation.test.ts | syncIngest automation systemd unit generation produces a timer with configurable interval | STRONG | passed | See source review |
| src/test/syncStaging.test.ts | syncStaging v13 round-trips a staged record and rejects corrupted content | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncStaging.test.ts | syncStaging v13 quarantines checksum mismatch and unknown schemaVersion | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncStaging.test.ts | syncStaging v13 moves stale .tmp files into failed/ | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncStaging.test.ts | syncStaging v13 orders queue by ledger firstSeenAt when master DB is available | STRONG | passed | See source review |
| src/test/syncStatusMessages.test.ts | v13 sync status messages formats waiting and failed counts | UNMAPPED | passed | See source review |
| src/test/syncStatusMessages.test.ts | v13 sync status messages formats offline push starting message | UNMAPPED | passed | See source review |
| src/test/syncStatusMessages.test.ts | v13 sync status messages renderClientSyncStatusLines shows unreachable + offline overlay | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/syncStatusMessages.test.ts | v13 sync status messages renderClientSyncStatusLines shows waiting and failed when online | UNMAPPED | passed | See source review |
| src/test/tags-invoke.test.ts | runTagsCommand / runTagsAddCommand (in-process invoke) adds a new tag to a category | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/tags-invoke.test.ts | runTagsCommand / runTagsAddCommand (in-process invoke) reports a duplicate tag without re-adding it | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/tags-invoke.test.ts | runTagsCommand / runTagsAddCommand (in-process invoke) lists the registry including the added tag | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/tags.test.ts | GnosysTagRegistry load + getRegistry loads tags from tags.json | UNMAPPED | passed | See source review |
| src/test/tags.test.ts | GnosysTagRegistry hasTag finds existing tags | UNMAPPED | passed | See source review |
| src/test/tags.test.ts | GnosysTagRegistry hasTag returns false for non-existent tags | UNMAPPED | passed | See source review |
| src/test/tags.test.ts | GnosysTagRegistry addTag adds a new tag to an existing category | UNMAPPED | passed | See source review |
| src/test/tags.test.ts | GnosysTagRegistry addTag adds a tag to a new category | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/tags.test.ts | GnosysTagRegistry addTag returns false if tag already exists | UNMAPPED | passed | See source review |
| src/test/tags.test.ts | GnosysTagRegistry edge cases falls back to DEFAULT_REGISTRY when tags.json is missing | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline-invoke.test.ts | runTimelineCommand (in-process invoke) prints 'No memories found.' on an empty central DB | STRONG | passed | See source review |
| src/test/timeline-invoke.test.ts | runTimelineCommand (in-process invoke) groups seeded memories by period (--json) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline-invoke.test.ts | runTimelineCommand (in-process invoke) renders the human timeline header for seeded memories | STRONG | passed | See source review |
| src/test/timeline.test.ts | groupByPeriod groups by month | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | groupByPeriod groups by year | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | groupByPeriod groups by day | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline.test.ts | groupByPeriod groups by week | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline.test.ts | groupByPeriod returns entries sorted chronologically | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline.test.ts | groupByPeriod tracks modified separately from created | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/timeline.test.ts | groupByPeriod includes titles for created memories | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | groupByPeriod handles empty array | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats computes total count | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats counts by category | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats counts by status | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats counts by author | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats computes average confidence | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats finds oldest and newest dates | UNMAPPED | passed | See source review |
| src/test/timeline.test.ts | computeStats handles empty array | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 effectiveProjectPath fallback returns working_directory when no machine.json (legacy) | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 effectiveProjectPath fallback resolves via root when machine is present | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 effectiveProjectPath fallback prefers an override over root resolution | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 effectiveProjectPath fallback returns null when unresolvable and working_directory doesn't exist here | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 effectiveProjectPath fallback falls back to a legacy working_directory that exists on this disk | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 generateBriefing uses machine-aware path resolves workingDirectory via the machine root | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 generateBriefing uses machine-aware path reports '(not on this machine)' when unresolvable here | UNMAPPED | passed | See source review |
| src/test/v511-consumers.test.ts | v5.11 generateBriefing uses machine-aware path legacy: with no machine.json, falls back to working_directory | UNMAPPED | passed | See source review |
| src/test/v511-db-schema.test.ts | v5.11 schema: fresh DB persists root_id/rel_path on projects | UNMAPPED | passed | See source review |
| src/test/v511-db-schema.test.ts | v5.11 schema: fresh DB allows two projects to share a working_directory (UNIQUE dropped) | UNMAPPED | passed | See source review |
| src/test/v511-db-schema.test.ts | v5.11 schema: fresh DB supports per-machine project_locations CRUD | UNMAPPED | passed | See source review |
| src/test/v511-db-schema.test.ts | v5.11 schema: migration from v3 rebuilds the projects table, preserves rows, adds columns + project_locations | UNMAPPED | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: shape & persistence defaultMachineConfig has a UUID, hostname, empty roots, disabled remote | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: shape & persistence writes machine.json under the config dir and reads it back | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: shape & persistence readMachineConfig returns null when the file is absent | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: shape & persistence normalize drops non-string roots and resolves to absolute | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: ensure & hostname guard creates machine.json on first run | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: ensure & hostname guard returns the existing config unchanged when the hostname matches | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: ensure & hostname guard regenerates machineId when a foreign (synced-in) config has a different hostname | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: ensure & hostname guard getMachineId is stable across calls | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: ensure & hostname guard records the old hostname in previousHostnames on a rename | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: root <-> relative path helpers absPathFromRoot joins root + rel, returns null when root/rel missing | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: root <-> relative path helpers relPathUnderRoot picks the deepest matching root | STRONG | passed | See source review |
| src/test/v511-machineConfig.test.ts | v5.11 machineConfig: root <-> relative path helpers relPathUnderRoot returns null for a path outside every root | STRONG | passed | See source review |
| src/test/v511-machineMigrate.test.ts | v5.11 migrateMachine moves machine_id + remote_path out of synced meta into machine.json and scans | UNMAPPED | passed | See source review |
| src/test/v511-machineMigrate.test.ts | v5.11 migrateMachine regenerates a machineId when no usable meta value exists | UNMAPPED | passed | See source review |
| src/test/v511-machineMigrate.test.ts | v5.11 migrateMachine ignores stale 'unknown-*' meta machineIds | UNMAPPED | passed | See source review |
| src/test/v511-machineMigrate.test.ts | v5.11 deriveCommonRoot picks the directory that parents the most registered projects | UNMAPPED | passed | See source review |
| src/test/v511-machineMigrate.test.ts | v5.11 deriveCommonRoot returns null when the registry has no usable entries | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 resolveProjectPath resolves via root_id + rel_path against this machine's root | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 resolveProjectPath prefers a per-machine override over the root resolution | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 resolveProjectPath returns null when the project's root isn't configured on this machine | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 resolveProjectPath returns null for an unknown project | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 resolveProject / resolveAllProjects reports provenance per project | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 recordLocation stores machine-independent root_id+rel_path when path is under a root | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 recordLocation stores a per-machine override when path is outside every root | UNMAPPED | passed | See source review |
| src/test/v511-projectPaths.test.ts | v5.11 recordLocation clears a redundant override once a project moves under a root | UNMAPPED | passed | See source review |
| src/test/v511-projectScan.test.ts | v5.11 findProjectDirs finds projects, including nested ones, and skips noise dirs | UNMAPPED | passed | See source review |
| src/test/v511-projectScan.test.ts | v5.11 scanProjects creates rows and records machine-portable root_id/rel_path | UNMAPPED | passed | See source review |
| src/test/v511-projectScan.test.ts | v5.11 scanProjects is idempotent — a second scan creates nothing new | UNMAPPED | passed | See source review |
| src/test/v511-projectScan.test.ts | v5.11 scanProjects simulates two machines: same project, different roots, no clobber | UNMAPPED | passed | See source review |
| src/test/v511-serve-handshake.test.ts | gnosys serve MCP handshake connects via gnosys-mcp bin symlink (npm global layout) | UNMAPPED | passed | See source review |
| src/test/v511-serve-handshake.test.ts | gnosys serve MCP handshake connects and lists tools via node dist/cli.js serve | UNMAPPED | passed | See source review |
| src/test/v512-centralize.test.ts | v5.12 centralizeDb copies a consistent brain (with data) to the target | STRONG | passed | See source review |
| src/test/v512-centralize.test.ts | v5.12 centralizeDb refuses to overwrite an existing target without --force | STRONG | passed | See source review |
| src/test/v512-centralize.test.ts | v5.12 centralizeDb overwrites with force | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v512-centralize.test.ts | v5.12 centralizeDb throws when the source brain is missing | STRONG | passed | See source review |
| src/test/v512-http-auth-guard.test.ts | isLoopbackHost recognizes loopback hosts | UNMAPPED | passed | See source review |
| src/test/v512-http-auth-guard.test.ts | isLoopbackHost rejects non-loopback hosts | UNMAPPED | passed | See source review |
| src/test/v512-http-auth-guard.test.ts | HTTP auth startup guard refuses non-loopback bind without a token | UNMAPPED | passed | See source review |
| src/test/v512-http-auth-guard.test.ts | HTTP auth startup guard allows loopback bind without a token | UNMAPPED | passed | See source review |
| src/test/v512-http-auth-guard.test.ts | HTTP auth startup guard allows non-loopback bind when a token is set | UNMAPPED | passed | See source review |
| src/test/v512-http-bearer.test.ts | v5.12 bearer token (missing / wrong / correct) missing token → 401 | UNMAPPED | passed | See source review |
| src/test/v512-http-bearer.test.ts | v5.12 bearer token (missing / wrong / correct) wrong token → 401 | UNMAPPED | passed | See source review |
| src/test/v512-http-bearer.test.ts | v5.12 bearer token (missing / wrong / correct) correct token → passes the auth gate (not 401) | UNMAPPED | passed | See source review |
| src/test/v512-http-body-limits.test.ts | v5.12 request body limits oversized body → 413 | UNMAPPED | passed | See source review |
| src/test/v512-http-body-limits.test.ts | v5.12 request body limits never-completing body → 408 | UNMAPPED | passed | See source review |
| src/test/v512-http-cors.test.ts | v5.12 Origin guard disallowed Origin → 403 | STRONG | passed | See source review |
| src/test/v512-http-cors.test.ts | v5.12 Origin guard no Origin header permits MCP initialization | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v512-http-cors.test.ts | v5.12 Origin guard allowlisted Origin permits MCP initialization | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v512-http-session-isolation.test.ts | v5.12 session isolation two concurrent sessions get distinct ids and are independent | UNMAPPED | passed | See source review |
| src/test/v512-http-session-reaper.test.ts | v5.12 idle session reaper reaps sessions idle beyond sessionIdleMs | UNMAPPED | passed | See source review |
| src/test/v512-http-session-reaper.test.ts | v5.12 idle session reaper does not reap a recently active session | UNMAPPED | passed | See source review |
| src/test/v512-mcpClientConfig.test.ts | v5.12 remoteMcpEntry returns a url entry without a token | UNMAPPED | passed | See source review |
| src/test/v512-mcpClientConfig.test.ts | v5.12 remoteMcpEntry includes a bearer header when a token is given | UNMAPPED | passed | See source review |
| src/test/v512-mcpClientConfig.test.ts | v5.12 writeCursorRemote writes .cursor/mcp.json pointing gnosys at the URL | UNMAPPED | passed | See source review |
| src/test/v512-mcpClientConfig.test.ts | v5.12 writeCursorRemote merges with an existing mcpServers map (preserves other servers) | UNMAPPED | passed | See source review |
| src/test/v512-mcpClientConfig.test.ts | v5.12 writeCursorRemote mergeJsonMcpServer creates the file fresh when absent | UNMAPPED | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP transport serves /health | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP transport a client can connect and list tools over HTTP | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP transport tracks concurrent sessions independently | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP transport 404s unknown paths | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP transport returns 400 for a non-initialize POST without a session | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP auth (Phase C) rejects requests without the bearer token | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP auth (Phase C) allows a client that presents the token | STRONG | passed | See source review |
| src/test/v512-mcpHttp.test.ts | v5.12 MCP HTTP auth (Phase C) health probe is reachable without auth | STRONG | passed | See source review |
| src/test/v512-sync-audit.test.ts | v5.12 sync audit rows push emits a remote_push audit row with counts | UNMAPPED | passed | See source review |
| src/test/v512-sync-audit.test.ts | v5.12 sync audit rows pull emits a remote_pull audit row with counts | UNMAPPED | passed | See source review |
| src/test/v512-sync-audit.test.ts | v5.12 sync audit rows sync emits both remote_push and remote_pull audit rows | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat parseIdFormat returns the value when it's a known format | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat parseIdFormat defaults to short for undefined or unknown values | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId raw mode returns the id verbatim, regardless of projectName | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId short mode truncates the ULID portion with an ellipsis | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId long mode keeps the full ULID with the project prefix | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId omits the project segment when projectName is null/undefined | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId short mode without project name still truncates | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId defaults to short when no format is passed | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v580-helpers.test.ts | idFormat formatMemoryId handles short ids that don't need truncation gracefully | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat memoryUri builds a gnosys://memory/<id> URI | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat memoryUri encodes characters that would break a URI | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat osc8Wrap wraps display text in the OSC8 escape sequence | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat formatMemoryIdHyperlink when tty=false, returns the same string as formatMemoryId | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v580-helpers.test.ts | idFormat formatMemoryIdHyperlink when tty=true, wraps the display text in OSC8 escapes pointing at the full id | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v580-helpers.test.ts | idFormat formatMemoryIdHyperlink works without a projectName (global/personal memories) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v580-helpers.test.ts | idFormat buildProjectNameLookup returns a Map of {project_id → project_name} for all rows | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | idFormat buildProjectNameLookup returns an empty map when no projects exist | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker getMarkerPath points at ~/.gnosys/last-upgrade-at under the current HOME | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker readUpgradeMarker returns null when the file doesn't exist | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker writeUpgradeMarker creates the file with version + timestamp | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker readUpgradeMarker round-trips writeUpgradeMarker | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker shouldRestartMcp returns false when no marker is present | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker shouldRestartMcp returns false when marker matches the running version | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker shouldRestartMcp returns true when marker is newer than the running version | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker shouldRestartMcp returns false when marker is older than the running version | UNMAPPED | passed | See source review |
| src/test/v580-helpers.test.ts | upgrade marker readUpgradeMarker swallows malformed JSON and returns null | UNMAPPED | passed | See source review |
| src/test/v584-updateConfig.test.ts | updateConfig — v5.8.4 anthropic-revert regression writes only the keys the caller supplied + any that were already in the file (no defaults seeded) | UNMAPPED | passed | See source review |
| src/test/v584-updateConfig.test.ts | updateConfig — v5.8.4 anthropic-revert regression preserves explicit values already in the file when adding a new section | UNMAPPED | passed | See source review |
| src/test/v584-updateConfig.test.ts | updateConfig — v5.8.4 anthropic-revert regression deep-merges nested objects rather than replacing them outright | UNMAPPED | passed | See source review |
| src/test/v592-identity-preserves-config.test.ts | v5.9.2 regression: writeProjectIdentity preserves user config does NOT wipe llm config or other user fields when re-writing identity | UNMAPPED | passed | See source review |
| src/test/v592-serve-stdout-clean.test.ts | v5.9.2 regression: gnosys serve stdout must stay clean initializes with valid JSON-RPC against an older database | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup classification alive: directory with .gnosys/ subdir | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup classification dead: directory exists but no .gnosys/ | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup classification dead: directory does not exist at all | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup classification temp: path under /tmp or /var/folders is classified as temp | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup classification no registry → empty categories | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup non-interactive write with yes=true removes dead+temp and keeps alive | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup non-interactive write dry-run (interactive=false, yes=false) does NOT write | UNMAPPED | passed | See source review |
| src/test/v593-cleanup.test.ts | Phase H — gnosys cleanup non-interactive write no stale entries → no write, removed=0 | UNMAPPED | passed | See source review |
| src/test/v593-no-central-db-pollution.test.ts | Phase F — central DB pollution regression running gnosys --version with empty HOME does NOT create gnosys.db | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v593-no-central-db-pollution.test.ts | Phase F — central DB pollution regression VITEST=true short-circuits maybePrintUpgradeNudge — no DB file at all | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v593-upgrade-nag.test.ts | Phase H — upgrade-nag consolidation upgrade (patch): emits `upgraded` on stderr, NO MCP-restart block | UNMAPPED | passed | See source review |
| src/test/v593-upgrade-nag.test.ts | Phase H — upgrade-nag consolidation upgrade (minor): emits MCP-restart block | UNMAPPED | passed | See source review |
| src/test/v593-upgrade-nag.test.ts | Phase H — upgrade-nag consolidation downgrade: emits `reverted` and the unintentional hint | UNMAPPED | passed | See source review |
| src/test/v593-upgrade-nag.test.ts | Phase H — upgrade-nag consolidation upgrade nag never writes to stdout | UNMAPPED | passed | See source review |
| src/test/v594-dream-provider-inheritance.test.ts | v5.9.4 Bug 6 — dream.provider inheritance from llm.defaultProvider dream.provider inherits defaultProvider when neither dream.provider nor llm.ollama is set | UNMAPPED | passed | See source review |
| src/test/v594-dream-provider-inheritance.test.ts | v5.9.4 Bug 6 — dream.provider inheritance from llm.defaultProvider dream.provider stays ollama when user has an llm.ollama block (explicit opt-in) | UNMAPPED | passed | See source review |
| src/test/v594-dream-provider-inheritance.test.ts | v5.9.4 Bug 6 — dream.provider inheritance from llm.defaultProvider dream.provider is left alone when user explicitly set it (even to ollama) | UNMAPPED | passed | See source review |
| src/test/v594-dream-provider-inheritance.test.ts | v5.9.4 Bug 6 — dream.provider inheritance from llm.defaultProvider dream.provider takes the user's explicit value over inheritance | UNMAPPED | passed | See source review |
| src/test/v594-dream-provider-inheritance.test.ts | v5.9.4 Bug 6 — dream.provider inheritance from llm.defaultProvider inheritance is skipped when defaultProvider is ollama (no change needed) | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) config-disabled + no machine designated → disabled | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) config-disabled + local-DB designation → enabled via local-db | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) config-enabled + no DB designation → enabled via config | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) config-disabled + only remote DB has machine_id → falls through to remote-db | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) local DB wins over remote when both set | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) describe shows machine when designated | UNMAPPED | passed | See source review |
| src/test/v594-dream-state.test.ts | v5.9.4 dream-state reconciliation (Bugs 7+8) missing remote DB is fine (null) | UNMAPPED | passed | See source review |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 appends a fresh block to empty input | STRONG | passed | See source review |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 appends a block to existing content separated by a blank line | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 replaces an existing [mcp_servers.gnosys] block instead of duplicating it | STRONG | passed | See source review |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 is idempotent — second run produces identical bytes | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 removes legacy [mcp.gnosys] and writes [mcp_servers.gnosys] | STRONG | passed | See source review |
| src/test/v594-grok-build-ide.test.ts | upsertGrokMcpBlock — v5.9.4 Bug 12 preserves the [mcp_servers.other] block when replacing [mcp_servers.gnosys] | STRONG | passed | See source review |
| src/test/v594-panel-edges.test.ts | Panel — v5.9.4 edge cases (Bugs 1+2) top and bottom borders have identical printable widths | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v594-panel-edges.test.ts | Panel — v5.9.4 edge cases (Bugs 1+2) ANSI in the title does not shift the right rule | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v594-panel-edges.test.ts | Panel — v5.9.4 edge cases (Bugs 1+2) very long titles fall back to a 1-char clamp instead of negative pad | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v594-panel-edges.test.ts | Panel — v5.9.4 edge cases (Bugs 1+2) uses rounded glyphs + accent-dim border per design | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v595-self-healing-machine-id.test.ts | v5.9.5 — self-healing machine_id heals a stale `unknown-<rand>` cache when a real hostname is available | UNMAPPED | passed | See source review |
| src/test/v595-self-healing-machine-id.test.ts | v5.9.5 — self-healing machine_id heals a stale `dream_machine_id` pointing at the same broken cached id | UNMAPPED | passed | See source review |
| src/test/v595-self-healing-machine-id.test.ts | v5.9.5 — self-healing machine_id leaves a real cached id untouched (no churn) | UNMAPPED | passed | See source review |
| src/test/v595-self-healing-machine-id.test.ts | v5.9.5 — self-healing machine_id leaves an unrelated `dream_machine_id` alone when machine_id heals | UNMAPPED | passed | See source review |
| src/test/v5x-migration-matrix.test.ts | v5.x migration matrix migrates a v1 DB to current (user_version=5) | UNMAPPED | passed | See source review |
| src/test/v5x-migration-matrix.test.ts | v5.x migration matrix migrates a v2 DB to current (user_version=5) | UNMAPPED | passed | See source review |
| src/test/v600-chat-config-backcompat.test.ts | v6.0.0 chat config backward compatibility loads a config file containing chat and taskModels.chat keys without crashing | UNMAPPED | passed | See source review |
| src/test/v600-chat-config-backcompat.test.ts | v6.0.0 chat config backward compatibility schema parse strips chat keys directly | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) GnosysConfigSchema.parse({}) leaves defaultProvider undefined | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) GnosysConfigSchema.parse({ llm: {} }) leaves defaultProvider undefined | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) loading an unconfigured store requires explicit provider setup | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) an explicitly set defaultProvider survives parse | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) requireDefaultProvider throws the run-setup message when unset | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) requireDefaultProvider returns the value when set | UNMAPPED | passed | See source review |
| src/test/v600-no-anthropic-default.test.ts | v6.0.0 — no implicit anthropic default (deci-049) generateConfigTemplate() output contains no defaultProvider | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands warns when no editor is open | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands warns when the active file is outside a memory directory | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands reports a process launch failure to the editor | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-001: reinforcing an open memory resets its persisted decay date | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-002: rejects a directory whose name only starts with .gnosys | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-003: passes shell syntax in a filename as literal text | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/vscode-extension.test.ts | VS Code extension public commands D-VSC-004: the dashboard action opens a command supported by the installed CLI | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/web-remove-invoke.test.ts | runWebRemoveCommand (in-process invoke) removes a knowledge file and rebuilds the index (--json) | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/web-remove-invoke.test.ts | runWebRemoveCommand (in-process invoke) refuses to remove a path outside the knowledge directory | STRONG | passed | See source review |
| src/test/web-remove-invoke.test.ts | runWebRemoveCommand (in-process invoke) errors on a missing file | STRONG | passed | See source review |
| src/test/webExpansions.test.ts | generateExpansions normalizes valid provider JSON and filters self-references and stop words | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | generateExpansions returns an empty map instead of throwing on malformed provider output | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | generateExpansions selects candidates by document frequency and respects maxTokens | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | attachExpansions bumps an index to v2 when a non-empty map is attached | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | attachExpansions keeps indexes at v1 when the map is empty | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | attachExpansions lets buildIndexSync attach injected expansions without changing default builds | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | loadIndex v2 compatibility accepts v1 and v2 indexes and still rejects future versions | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | query-time expansion returns expanded-only matches at the documented 0.5x score discount | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | query-time expansion does not double-count a token that is both direct and expanded | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | query-time expansion honors expandQuery false and matches a no-expansions index | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | query-time expansion searches v1 indexes identically when no expansions field exists | UNMAPPED | passed | See source review |
| src/test/webExpansions.test.ts | query-time expansion participates in semantic fusion on a v2 index | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex returns empty index for empty directory | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex indexes a single markdown file | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex indexes multiple files across subdirectories | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex weights relevance keywords higher than content | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex respects stop-word filtering | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex disables stop-word filtering when option is false | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex skips archived documents by default | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex includes archived documents when includeArchived is true | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex computes correct content hashes | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex handles files with no frontmatter id (uses filename) | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex handles files with malformed frontmatter gracefully | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex produces deterministic output for same input | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | buildIndex version field is set to 1 | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex generated timestamp is valid ISO string | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex handles nested tag objects | UNMAPPED | passed | See source review |
| src/test/webIndex.test.ts | buildIndex (async) returns same result as sync version | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | writeIndex creates a valid JSON file | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIndex.test.ts | writeIndex overwrites existing index file | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIngest.test.ts | ingestSite with directory source reads local markdown files and creates knowledge files | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source handles .md source files with existing frontmatter | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source handles .html source files by converting to markdown | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source strips MDX components from .mdx files | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source skips unchanged pages on re-ingest (content hash match) | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source updates changed pages on re-ingest | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source creates category subdirectories in output | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source handles empty content directory | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with directory source returns correct IngestResult counts | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | dry run mode does not write files in dry-run mode | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | pruning removes orphaned knowledge files when prune is enabled | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | pruning preserves orphaned files when prune is disabled | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestUrl processes a single URL (mocked) | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with sitemap fetches and parses sitemap XML | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with sitemap respects exclude patterns | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with sitemap handles fetch errors gracefully | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestSite with sitemap handles sitemap index files | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | removeKnowledge removes the knowledge directory | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | removeKnowledge handles non-existent directory gracefully | UNMAPPED | passed | See source review |
| src/test/webIngest.test.ts | ingestDirectory wraps ingestSite with directory source | UNMAPPED | passed | See source review |
| src/test/webIntegration.test.ts | Fixture validation sample-index.json is valid and loadable | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Full pipeline: directory ingest → build index → search ingests markdown files and builds a searchable index | STRONG | passed | See source review |
| src/test/webIntegration.test.ts | Full pipeline: directory ingest → build index → search search respects category filter | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Full pipeline: directory ingest → build index → search search respects tag filter | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Full pipeline: directory ingest → build index → search getDocument retrieves specific document from built index | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Full pipeline: directory ingest → build index → search listDocuments filters by category on built index | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Structured ingest: HTML → frontmatter extraction extracts title and category from HTML content | STRONG | passed | See source review |
| src/test/webIntegration.test.ts | Structured ingest: HTML → frontmatter extraction extracts category from URL patterns for blog posts | STRONG | passed | See source review |
| src/test/webIntegration.test.ts | Structured ingest: HTML → frontmatter extraction falls back to general category for unmatched URLs | STRONG | passed | See source review |
| src/test/webIntegration.test.ts | TF-IDF on fixture knowledge files computes distinctive terms for each document | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | TF-IDF on fixture knowledge files automation doc gets automation-related terms | STRONG | passed | See source review |
| src/test/webIntegration.test.ts | Index build determinism building index twice produces identical output | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webIntegration.test.ts | Bundle isolation: gnosys/web has no native deps the published web entry searches without third-party runtime dependencies | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output writes an index and quantized vectors for the requested provider and reports their location | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output rejects an invalid embeddings provider without creating an index or vectors | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output writes a searchable index when embeddings are absent | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output persists concept expansions returned by the configured LLM | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output writes a version-one index without contacting the LLM when expansions are disabled | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build-index output writes a version-one index when no LLM provider is configured | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build ingests local content and writes both search and Voyage vector artifacts | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web build reports a dry run and preserves existing index and vector bytes | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web status reports vector metadata and exact byte size in text and JSON output | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web status reports a missing vectors file with a build hint | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | web status reports corrupt vector JSON with its exact byte size and no invented metadata | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors-command-handler.test.ts | creates web configuration non-interactively and prints the semantic search instructions | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors.test.ts | buildVectors API providers posts OpenAI embedding batches with configured headers and maps vectors by document id | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors.test.ts | buildVectors API providers posts Voyage embedding requests using VOYAGE_API_KEY only | UNMAPPED | passed | See source review |
| src/test/webVectors.test.ts | buildVectors API providers throws when the OpenAI API key is missing | UNMAPPED | passed | See source review |
| src/test/webVectors.test.ts | buildVectors API providers throws with status details when an API request fails | UNMAPPED | passed | See source review |
| src/test/webVectors.test.ts | buildVectors local provider reuses GnosysEmbeddings.embedBatch and quantizes local vectors | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors.test.ts | int8 quantization round-trips vectors while preserving cosine ranking order for fixed fixtures | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/webVectors.test.ts | writeVectorsFile writes pretty JSON with the WebVectorsFile shape | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects file:///etc/passwd | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects gopher://example.com/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://127.0.0.1/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://localhost/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://169.254.169.254/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://10.0.0.1/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://192.168.1.1/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://2130706433/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://0.0.0.0/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://0x7f000001/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://0x7f.0.0.1/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://[::1]/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://[fc00::1]/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects http://[fe80::1]/ | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards allows a normal public https URL | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards allows loopback only when explicitly opted in | UNMAPPED | passed | See source review |
| src/test/webingest-ssrf.test.ts | webIngest SSRF guards rejects redirects to cloud metadata endpoints | UNMAPPED | passed | See source review |
| src/test/wikilinks.test.ts | extractLinks extracts simple wikilinks | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | extractLinks extracts wikilinks with display text | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | extractLinks returns empty array for content with no links | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | extractLinks includes source info | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | resolveLink resolves by exact title | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/wikilinks.test.ts | resolveLink resolves by title case-insensitively | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | resolveLink resolves by relative path | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | resolveLink resolves by filename without extension | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | resolveLink resolves by id | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/wikilinks.test.ts | resolveLink returns null for non-existent target | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | buildLinkGraph builds graph with correct link counts | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | buildLinkGraph tracks outgoing links | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/wikilinks.test.ts | buildLinkGraph tracks backlinks (incoming) | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | buildLinkGraph identifies orphaned links | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | buildLinkGraph handles memories with no links | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | buildLinkGraph handles empty memory list | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | getBacklinks returns backlinks for a target | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/wikilinks.test.ts | getBacklinks returns empty for memory with no backlinks | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | getOutgoingLinks returns outgoing links for a source | STRONG | passed | Killed recorded fault or inverse defect probe |
| src/test/wikilinks.test.ts | getOutgoingLinks returns empty for memory with no outgoing links | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | formatGraphSummary produces a readable summary | STRONG | passed | See source review |
| src/test/wikilinks.test.ts | formatGraphSummary handles empty graph | STRONG | passed | See source review |
| src/test/working-set-invoke.test.ts | runWorkingSetCommand (in-process invoke) returns the recently modified project memory (--json) | UNMAPPED | passed | See source review |
| src/test/working-set-invoke.test.ts | runWorkingSetCommand (in-process invoke) returns an empty working set for a zero-hour window (--json) | UNMAPPED | passed | See source review |

## Repeated patterns

- Source-string checks accepted broken command placement and skipped writes. The replacement CLI contracts check literal command paths; handler behavior is covered separately.
- Type, existence, and broad count assertions accepted wrong records, truncated artifacts, and wrong metadata. Replacements assert literal results and persisted content.
- Fixture-only tests and tests that manually performed both writes did not exercise the advertised workflow. Duplicates were deleted with named replacement coverage.
- Application mocks bypassed the logic under test. Replacements use real application modules and confine doubles to external boundaries such as network, OS commands, terminal input, and the model runtime.
- Conditional assertions and empty loops accepted missing outputs. Replacements assert the expected result set before inspecting its contents.
- The CI search-isolation results were printed without assertions. The renamed local-storage scenario never mounted a network share; its test now claims only the local behavior it exercises.

## Scope, verification, and blockers

This audit targets the committed gnosys-public package at 203c4e7e488cea66bfd9a3ad687d9d1dda309d16 (6.2.1), in an isolated test-audit worktree. The workspace root is not a repository. The original checkout has unrelated uncommitted changes and remains outside this audit. No push or PR is authorized.

Node22.17.1, Vitest4.1.9, TypeScript5.9.3, tsx4.22.4, better-sqlite3 11.10.0, and MCP SDK1.29.0 match the installed baseline dependencies. CI collects src/**/*.test.ts on Linux and macOS; runner exclusions cover dist and node_modules. Coverage exclusions are distinct from test collection and are not evidence of protection. Docker setup and the two CI scenarios run in separate jobs. The npm test, coverage, and watch commands now build before starting, so CLI subprocess tests begin with current compiled artifacts.

The sandbox initially rejected loopback listeners with EPERM. Authorized local HTTP/PTY runs pass. Docker setup tests run without networking or host mounts. Real provider credentials, operating-system integration, and physical network-share behavior are reported as unverified where boundary doubles or temporary local directories are used.


Final platform/service blocker reconciliation remains pending.
