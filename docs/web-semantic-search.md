# Web semantic search

`gnosys web` can add optional semantic search to the zero-dependency `gnosys/web` runtime. The default index still works as lexical TF-IDF search. Semantic search starts only when you build vectors and pass a query vector at runtime.

## Build-time vectors

Build vectors with either full ingest + index:

```bash
gnosys web build --embeddings openai
```

Or from an existing knowledge directory:

```bash
gnosys web build-index --embeddings openai
```

Supported providers:

| Provider | Default model | Key source |
|----------|---------------|------------|
| `openai` | `text-embedding-3-small` | Gnosys OpenAI config or `OPENAI_API_KEY` |
| `voyage` | `voyage-3-lite` | `VOYAGE_API_KEY` only |
| `local` | `Xenova/all-MiniLM-L6-v2` | Local `@huggingface/transformers` through the existing Gnosys embeddings stack |

Use `--embed-model <id>` to override the provider default.
OpenAI builds also honor the configured OpenAI base URL.

The `local` provider is useful for fully local builds, but a runtime route that embeds queries locally also needs `@huggingface/transformers`. That is not edge-safe and is not the default for serverless chatbot routes.

## Vector file format

Vector builds write `gnosys-vectors.json` in the knowledge directory:

```json
{
  "version": 1,
  "model": "text-embedding-3-small",
  "dims": 1536,
  "quantization": "int8",
  "generated": "2026-07-08T00:00:00.000Z",
  "scale": 0.00042,
  "offset": 0,
  "vectors": {
    "doc-id": [12, -4, 8]
  }
}
```

Vectors are int8-quantized with one global symmetric `scale` and `offset` for the file; `vectors` maps document IDs to int8 arrays. The `model` field is the build/runtime contract: embed the query with the same model you used to build the file.

## Runtime API

The `gnosys/web` subpath stays dependency-free. It loads JSON and computes hybrid ranking without importing the build-time embedding stack:

```ts
import { loadIndex, loadVectors, search } from "gnosys/web";

const index = loadIndex("./knowledge/gnosys-index.json");
const vectors = loadVectors("./knowledge/gnosys-vectors.json");

const results = search(index, query, {
  queryVector,
  vectors,
  expectedModel: "text-embedding-3-small",
});
```

When both `queryVector` and `vectors` are present, `search()` dequantizes document vectors, computes cosine similarity, then fuses semantic ranking with the existing TF-IDF ranking using Reciprocal Rank Fusion with `k=60`.

Model mismatches and dimension mismatches fail safe: `search()` prints a `console.warn` and returns lexical-only results. When vectors or `queryVector` are absent, behavior is the same lexical search path as before.

## Caller embeds the query

`gnosys/web` does not call an embedding API. Your route embeds the query with the same model used at build time, then passes the vector into `search()`:

```ts
async function embedQuery(query: string): Promise<number[] | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: query }),
  });
  if (!res.ok) return undefined;
  const json = await res.json();
  return json.data?.[0]?.embedding;
}

const queryVector = await embedQuery(query);
const results = search(index, query, {
  queryVector,
  vectors,
  expectedModel: "text-embedding-3-small",
});
```

Wrap `loadVectors()` and the embedding call in your route's normal fallback handling. Missing keys, missing vectors, embedding API errors, or model mismatches should fall back to lexical search.

## Concept expansion

When a structuring LLM provider resolves during build, Gnosys can add an `expansions` map to `gnosys-index.json`. That turns the index into version 2. Builds without expansions stay version 1, and `loadIndex()` accepts both versions.

Expanded tokens are generated at build time, so query-time search needs no LLM key. At runtime, direct query tokens keep full lexical weight and expanded tokens score at a documented `0.5x` discount.

Opt out at build time:

```bash
gnosys web build --no-expansions
gnosys web build-index --no-expansions
```

Opt out for one runtime search:

```ts
const results = search(index, query, { expandQuery: false });
```

There is no positive `--expansions` flag. Expansion generation happens only when the build can resolve a structuring LLM provider.

## Compatibility

- Existing version 1 indexes keep working.
- `search(index, query, options)` remains backward compatible.
- Without vectors and a query vector, runtime results stay lexical-only.
- The `gnosys/web` runtime keeps its zero native/runtime dependency constraint.
