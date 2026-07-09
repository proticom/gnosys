# gnosys web build

Run ingest and build-index in one shot.

## Usage

```bash
gnosys web build
gnosys web build --source https://example.com/sitemap.xml --prune
gnosys web build --embeddings openai
gnosys web build --dry-run --json
```

## Prerequisites

Run `gnosys web init` first so `gnosys.json` contains a `web` configuration.

## Options

| Option | Description |
|--------|-------------|
| `--source <url>` | Override sitemap URL or content directory |
| `--prune` | Remove orphaned knowledge files |
| `--no-llm` | Force structured mode (skip LLM enrichment) |
| `--concurrency <n>` | Parallel processing limit (default `3`) |
| `--dry-run` | Show ingest changes without writing files; skips index generation |
| `--embeddings <provider>` | Also build `gnosys-vectors.json` with `openai`, `voyage`, or `local` |
| `--embed-model <id>` | Override the embedding model used with `--embeddings` |
| `--no-expansions` | Skip LLM-generated concept expansions in `gnosys-index.json` |
| `--json` | Output combined ingest + index stats as JSON |

## Behavior

1. Loads config and requires `web` settings.
2. Runs `ingestSite` with config and CLI overrides (source, prune, LLM, concurrency, dry-run).
3. Unless `--dry-run`, builds index from `web.outputDir` and writes `<outputDir>/gnosys-index.json`.
4. When a structuring LLM provider resolves and LLM enrichment is enabled, adds concept expansions unless `--no-expansions` is set.
5. When `--embeddings <provider>` is set, writes `<outputDir>/gnosys-vectors.json`.
6. Prints combined human summary or JSON with ingest result plus `index` stats and optional `vectors` stats.

`--dry-run` skips both index generation and vector generation.

## Human output

```text
Web build complete (1234ms):
  Added:     5
  Updated:   2
  Unchanged: 10
  Removed:   1
  Index:     42 docs, 1200 tokens
  Vectors:   42 docs, text-embedding-3-small (1536d)
  Vector output: /path/to/knowledge/gnosys-vectors.json
  Errors:    1
    https://example.com/bad: timeout
```

## JSON output

Combined ingest result object with an `index` field:

```json
{
  "added": [],
  "updated": [],
  "unchanged": [],
  "removed": [],
  "errors": [],
  "duration": 1234,
  "index": {
    "documentCount": 42,
    "tokenCount": 1200
  },
  "vectors": {
    "model": "text-embedding-3-small",
    "dims": 1536,
    "count": 42,
    "outputPath": "/path/to/knowledge/gnosys-vectors.json"
  }
}
```

On error with `--json`:

```json
{
  "ok": false,
  "error": "No web configuration found in gnosys.json. Run 'gnosys web init' first."
}
```

## Validation

```bash
cd gnosys-public
npm run cli -- web build --help
npx vitest run src/test/web-build-command-handler.test.ts
```

## Related commands

- `gnosys web ingest` — crawl only.
- `gnosys web build-index` — index only.
- [`Web semantic search`](../web-semantic-search.md) — optional build-time vectors and runtime hybrid search.
