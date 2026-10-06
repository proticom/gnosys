# gnosys dream

Dream Mode — night-time memory consolidation. Manual commands run one cycle immediately; scheduled runs are launched by a single machine-level launchd agent, not by MCP connections.

## Scheduled runs

`gnosys setup dream` installs `~/Library/LaunchAgents/com.gnosys.dream.plist` on macOS, which runs `gnosys dream run --scheduled`. Scheduled runs apply four cheap gates before any LLM work — designated machine, night window (`dream.schedule`), real system idle time (`dream.systemIdleMinutes`), and dreamworthiness (`dream.minNewMemoriesToDream` + `dream.minHoursBetweenRuns`) — and write a skipped-run record explaining any skip.

## Cost controls

`dream.maxLLMCallsPerRun` is a hard ceiling. Relationship/summary/critique work skips memory batches already analyzed (fingerprints in `~/.gnosys/dream-state.json`). Every run logs LLM calls made vs skipped, estimated tokens, and estimated cost to `~/.gnosys/dream-runs.jsonl`; view it with `gnosys dream report`.

## What Dream does today

Dream works on the central SQLite brain. It never deletes or archives a memory.

| Phase | What it does | What it needs |
|---|---|---|
| Confidence decay | Lowers confidence as time passes without reinforcement. | SQLite only. |
| Embedding health | Counts missing vectors. Repairs up to 512 per run if embeddings were already initialized. | Local `@huggingface/transformers`, its ONNX runtime, and the downloaded model. Run `gnosys reindex` to initialize embeddings. |
| Self-critique | Flags low confidence, age without reinforcement, short content, missing tags, and missing relevance. Can ask the provider about up to ten borderline memories when fewer than 20 rule-based suggestions exist. | SQLite for rules; a provider for the optional critique calls. |
| Category summaries | Creates or updates category overviews from a bounded sample of memory text. Skips unchanged inputs. | A configured LLM provider. No embeddings required. |
| Relationships | Asks the provider for links between bounded groups of memories. Saves validated links with confidence of at least 0.7. | A configured LLM provider. No embeddings required. |

Summary prompts use the 20 most recently created active memories per category. Edits within that sample trigger a refresh. Older memories outside the sample are not summarized. Relationship discovery checks up to 30 source memories per run against up to 50 candidates. It tracks reviewed content so later runs can reach further memories. These are bounded samples, not an exhaustive review of every pair. Invalid relationship responses appear as errors and can be retried.

The first run after this change can spend its LLM budget refreshing summaries under the new cache keys. Later runs reuse those results. Confidence decay alone does not require another LLM call.

There is no Dream deduplication phase. Duplicate detection remains a separate maintenance feature. The legacy `duplicatesFound` report field stays zero for compatibility.

`summariesGenerated` counts new category summaries. `summariesUpdated` counts revisions to existing summaries. Zero new summaries can be correct while existing summaries are being updated. Zero new relationships can also be correct when the provider finds none, returns only existing links, or the call budget is used up. The run log records cached-input and budget skips.

Relationship links are graph metadata. A `supersedes` or `contradicts` edge does not archive a memory or change keyword/semantic search ranking.

Review suggestions are a snapshot for human review, not a job queue. `gnosys dream report` shows the top 20 items from the latest critique snapshot, with memory IDs and reasons. Older snapshots remain in the history. Dream does not act on these suggestions.

`gnosys dream log` shows new runs' error messages and summary update counts. Older audit rows contain only error counts; their messages cannot be recovered from that row. The local `dream-runs.jsonl` may still contain them.

## Local embedding repair

Transformers remains optional so keyword search and the web package can work without its native runtime. In the development install inspected for this fix, Transformers and the two ONNX runtime packages occupied about 353 MiB before the model cache. [ONNX Runtime lists supported Node platforms](https://onnxruntime.ai/docs/get-started/with-javascript/node.html); unsupported platforms can require a source build.

Run `gnosys doctor` to check the local runtime. If it is missing or broken, doctor prints an install command targeting the Gnosys package directory. Setup, upgrade, and MCP startup also report missing packages. MCP warnings go to stderr. Hybrid and semantic search return keyword results with a fallback note when local embeddings fail.

For an existing global npm install, the repair command is:

```bash
npm install --prefix "$(npm root -g)/gnosys" --no-save --package-lock=false --foreground-scripts '@huggingface/transformers@^4.2.0'
gnosys doctor
gnosys reindex
```

Restart MCP clients after repair. `gnosys reindex` downloads the local model on first use. It rebuilds derived vectors without deleting memories.

## Usage

```bash
gnosys dream
gnosys dream --max-runtime 30 --json
gnosys dream --force
gnosys dream run
gnosys dream log
```

## Options (bare `gnosys dream` and `gnosys dream run`)

| Option | Description |
|--------|-------------|
| `--max-runtime <minutes>` | Max runtime in minutes (default: 30) |
| `--no-critique` | Skip self-critique phase |
| `--no-summaries` | Skip summary generation |
| `--no-relationships` | Skip relationship discovery |
| `--force` | Run even if this machine is not the designated dream node |
| `--scheduled` | Apply the launchd scheduler gates (designated machine, night window, system idle, dreamworthiness) |
| `--json` | Output raw JSON report instead of formatted text |

## Behavior

Bare **`gnosys dream`** runs one Dream Mode cycle on the central brain (same executor as `gnosys dream run`).

1. Resolves configured stores via `GnosysResolver`.
2. Loads config from the primary store path.
3. Opens the central DB and verifies `gnosys.db` is migrated (v2.0).
4. Checks designated-machine policy against the central DB.
5. Runs `GnosysDreamEngine.dream()` with phase progress on stderr.
6. Prints `formatDreamReport(report)` to stdout, or JSON when `--json` is set.

Progress lines appear on stderr:

```text
Starting Dream Mode cycle...
  [phase-name] detail...
```

## Prerequisites

- At least one Gnosys store (run `gnosys init` first).
- Migrated `gnosys.db` (run `gnosys migrate` if needed).
- Dream Mode provider/model configured (see `gnosys setup dream`).
- LLM provider available for the dream task route.

## Designated machine

When the central DB records a designated dream machine, manual runs on other machines are blocked unless `--force` is passed:

```text
Dream is designated to machine <id>, but this is <local-id>.
Pass --force to run anyway, or run 'gnosys setup dream' to redesignate.
```

Use `--force` for testing on non-designated nodes. Use `gnosys setup dream` to change designation.

## Related subcommands

| Command | Purpose |
|---------|---------|
| `gnosys dream run` | Explicit alias for running a cycle now (same options as bare `gnosys dream`) |
| `gnosys dream log` | Show recent dream runs from the central audit log |
| `gnosys dream report` | Generate `dream-dashboard.html` from `~/.gnosys/dream-runs.jsonl` |

### `gnosys dream log` (summary)

```bash
gnosys dream log
gnosys dream log --last 10
gnosys dream log --since 2026-05-01
gnosys dream log --failures-only
gnosys dream log --json
```

Reads recent runs from the central DB audit log. Options: `--last`, `--since`, `--failures-only`, `--json`.

## Errors

No stores:

```text
No Gnosys stores found. Run 'gnosys init' first.
```

Unmigrated DB:

```text
Dream Mode requires gnosys.db (v2.0). Run 'gnosys migrate' first.
```

Designated-machine mismatch (without `--force`): exits with code 1.

## Validation

```bash
cd gnosys-public
npm run cli -- dream --help
node scripts/audit-commands.mjs --write
```

## Related commands

- `gnosys setup dream` — configure designation, provider, schedule.
- `gnosys check --task dream` — test dream LLM connectivity.
- `gnosys doctor` — broader system health check.
