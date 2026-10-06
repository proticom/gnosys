# gnosys semantic-search

Search using semantic similarity. If embeddings are unavailable, return keyword results with an explicit fallback note.

## Usage

```bash
gnosys semantic-search "auth tokens"
gnosys semantic-search "auth tokens" --limit 5
gnosys semantic-search "auth tokens" --json
```

## Options

| Option | Description |
|--------|-------------|
| `-l, --limit <n>` | Max results (default `15`) |
| `--active-only` | Return only active memories; default includes history |
| `--json` | Output results as JSON |

## Behavior

1. Resolves stores via the resolver; exits if none (`No stores found.`).
2. Builds a fresh `GnosysSearch` index from all stores.
3. Loads `GnosysEmbeddings` and `GnosysHybridSearch`.
4. Searches the central DB when available. Uses semantic search, or keyword search if the embedding runtime, model, or vectors are unavailable.
5. Closes search, embeddings, and central DB handles.

## Embedding prerequisites

Run `gnosys doctor` to check the local runtime, then `gnosys reindex` to build vectors. Missing packages produce an install command targeting the Gnosys package directory. Model loading errors preserve the cause in the fallback note. The CLI also prints the note to stderr, keeping JSON stdout valid.

## Human output

On success, prints the effective search mode, title, path, score, and snippet preview for each result.

## JSON output

With `--json`:

```json
{
  "query": "...",
  "mode": "semantic",
  "requestedMode": "semantic",
  "count": 3,
  "results": [
    { "title": "...", "relativePath": "...", "score": 0.92, "snippet": "..." }
  ]
}
```

Fallback results set `mode` to `keyword` and include a `note` explaining why. Keyword scores are not semantic similarity scores.

## Validation

```bash
cd gnosys-public
npm run cli -- semantic-search --help
```

## Memory history

Active results show only the modified date, such as `[2026-10-06]`. History includes status and date, with `superseded by <id>` when set. For example, `[superseded; 2026-09-01; superseded by deci-042]`. Active replacements rank above their predecessors, including when the result limit is one. Superseded and archived memories remain visible by default. Use `--active-only` to exclude them. The MCP equivalent is `activeOnly: true` (default `false`).

## Related commands

- `gnosys hybrid-search` — keyword + semantic fusion (RRF).
- `gnosys reindex` — build/update embeddings.
