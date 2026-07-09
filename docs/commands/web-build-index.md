# gnosys web build-index

Generate search index JSON from the knowledge directory.

## Usage

```bash
gnosys web build-index
gnosys web build-index --input ./knowledge --output ./public/gnosys-index.json
gnosys web build-index --embeddings openai
gnosys web build-index --no-stop-words --json
```

## Options

| Option | Description |
|--------|-------------|
| `--input <dir>` | Override knowledge directory |
| `--output <path>` | Override generated index file path |
| `--no-stop-words` | Disable stop-word filtering |
| `--embeddings <provider>` | Also build `gnosys-vectors.json` with `openai`, `voyage`, or `local` |
| `--embed-model <id>` | Override the embedding model used with `--embeddings` |
| `--no-expansions` | Skip LLM-generated concept expansions in `gnosys-index.json` |
| `--json` | Output index stats as JSON |

## Behavior

1. Loads config from the active web store path.
2. Resolves knowledge directory: `--input` → `web.outputDir` → `./knowledge`.
3. Resolves output path: `--output` → `<knowledgeDir>/gnosys-index.json`.
4. Builds index via `buildIndex` with `stopWords: opts.stopWords`.
5. When a structuring LLM provider resolves, adds concept expansions unless `--no-expansions` is set.
6. Writes index via `writeIndex`.
7. When `--embeddings <provider>` is set, writes `gnosys-vectors.json` in the knowledge directory. With the default output path this sits next to `gnosys-index.json`; if `--output` points elsewhere, the vectors file still stays in the knowledge directory.

## Human output

```text
Search index built:
  Documents: 42
  Tokens:    1200
  Output:    ./knowledge/gnosys-index.json
  Vectors:   42 docs, text-embedding-3-small (1536d)
  Vector output: ./knowledge/gnosys-vectors.json
```

## JSON output

```json
{
  "ok": true,
  "documentCount": 42,
  "tokenCount": 1200,
  "outputPath": "./knowledge/gnosys-index.json",
  "vectors": {
    "model": "text-embedding-3-small",
    "dims": 1536,
    "count": 42,
    "outputPath": "./knowledge/gnosys-vectors.json"
  }
}
```

On error with `--json`:

```json
{
  "ok": false,
  "error": "message"
}
```

Errors exit with code 1 (`Build index failed: ...` in human mode).

## Validation

```bash
cd gnosys-public
npm run cli -- web build-index --help
npx vitest run src/test/web-build-index-command-handler.test.ts
```

## Related commands

- `gnosys web ingest` — crawl source and generate knowledge markdown files.
- `gnosys web build` — run ingest + build-index in one shot.
- [`Web semantic search`](../web-semantic-search.md) — optional build-time vectors and runtime hybrid search.
