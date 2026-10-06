# gnosys search

Search memories by keyword with full-text snippets.

## Usage

```bash
gnosys search "auth tokens"
gnosys search "auth tokens" --federated
gnosys search "auth tokens" --scope project,user --directory /path/to/project
gnosys search "auth tokens" --json --id-format raw
```

## Options

| Option | Description |
|--------|-------------|
| `-n, --limit <number>` | Max results (default `20`) |
| `--active-only` | Return only active memories; default includes history |
| `--json` | Output results as JSON |
| `--federated` | Tier-boosted cross-scope search (project > user > global) |
| `--scope <scope>` | Filter scopes: `project`, `user`, `global` (comma-separated) |
| `-d, --directory <dir>` | Project directory for context detection |
| `--id-format <format>` | ID display: `short`, `long`, or `raw` (default `short`) |

## Default path (FTS)

When neither `--federated` nor `--scope` is set:

1. Opens the central DB (`~/.gnosys/gnosys.db`).
2. Runs `searchFts` against the query.
3. Formats results with project name lookup, `formatMemoryIdHyperlink`, and snippet text (FTS highlight markers `>>>` / `<<<` stripped).

If the central DB is unavailable:

```text
Central DB not available. Run 'gnosys init' first.
```

No results:

```text
No results for "<query>".
```

## Federated / scope path

When `--federated` or `--scope` is set:

1. Opens central DB; exits if unavailable (`Central DB not available. Run 'gnosys migrate --to-central' first.`).
2. Detects current project via `--directory` when provided.
3. Parses comma-separated `--scope` values.
4. Calls `federatedSearch` with limit, project ID, and scope filter.

Human output includes project context, title, category, scope, score, boosts, and a snippet preview (up to 120 chars). Empty results:

```text
No results for "<query>".
```

## JSON output

With `--json`:

- **Federated:** `{ query, projectId, count, results }`
- **Default FTS:** `{ query, count, results }` or `{ query, results: [] }` when empty

## Platform notes

- Default FTS requires an initialized central DB (`gnosys init`).
- Federated search uses tier boosting across project/user/global scopes.

## Validation

```bash
cd gnosys-public
npm run cli -- search --help
```

## Memory history

Active results show only the modified date, such as `[2026-10-06]`. History includes status and date, with `superseded by <id>` when set. For example, `[superseded; 2026-09-01; superseded by deci-042]`. Active replacements rank above their predecessors, including when the result limit is one. Superseded and archived memories remain visible by default. Use `--active-only` to exclude them. The MCP equivalent is `activeOnly: true` (default `false`).

This also applies to federated search. JSON results are ordered with replacements before their predecessors. Each result includes a 1-based `position`; use it to preserve the emitted order. `rank` and `score` retain their retrieval values and do not define the final order.

## Related commands

- `gnosys discover` — keyword discovery without full snippet search.
- `gnosys read` — read a specific memory from search results.
