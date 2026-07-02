/**
 * Tests for src/lib/embedDb.ts (v5.13.0) — the central-DB embedding column.
 *
 * Before v5.13.0 nothing ever wrote memories.embedding (reindex only fed
 * the store-local embeddings.db), so DB-mode semantic search could never
 * activate. These tests use a deterministic fake embedder — no model
 * download, no @huggingface/transformers.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { GnosysEmbeddings } from "../lib/embeddings.js";
import {
  embeddingText,
  float32ToBuffer,
  backfillCentralDbEmbeddings,
  embedMemoryIntoDb,
} from "../lib/embedDb.js";
import { createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

function vecFor(text: string): Float32Array {
  const v = new Float32Array(4);
  v[0] = text.length;
  v[1] = 1;
  return v;
}

const fakeEmbedder = {
  embed: async (text: string) => vecFor(text),
  embedBatch: async (texts: string[]) => texts.map(vecFor),
} as unknown as GnosysEmbeddings;

describe("embeddingText", () => {
  it("joins title, relevance, tags, content — same recipe as the file-store reindex", () => {
    const text = embeddingText({
      id: "m1",
      title: "My Title",
      relevance: "keyword cloud",
      tags: '["alpha","beta"]',
      content: "Body text.",
    });
    expect(text).toBe("My Title\nkeyword cloud\nalpha beta\nBody text.");
  });

  it("handles object-shaped tags and plain-string tags", () => {
    expect(
      embeddingText({ id: "m", title: "T", relevance: null, tags: '{"domain":["x"],"type":["y"]}', content: "C" })
    ).toBe("T\n\nx y\nC");
    expect(
      embeddingText({ id: "m", title: "T", relevance: "r", tags: "plain tags", content: "C" })
    ).toBe("T\nr\nplain tags\nC");
  });
});

describe("float32ToBuffer", () => {
  it("round-trips through the Buffer shape the DB stores", () => {
    const vec = new Float32Array([1.5, -2.25, 0, 42]);
    const buf = float32ToBuffer(vec);
    expect(buf.byteLength).toBe(16);
    const back = new Float32Array(buf.buffer, buf.byteOffset, 4);
    expect(Array.from(back)).toEqual([1.5, -2.25, 0, 42]);
  });
});

describe("backfillCentralDbEmbeddings", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await createTestEnv("embed-db");
    for (let i = 1; i <= 5; i++) {
      env.db.insertMemory(makeMemory({ id: `emb-${i}`, title: `Memory ${i}`, content: `Content ${i}` }));
    }
  });

  afterEach(async () => {
    await cleanupTestEnv(env);
  });

  it("fills every NULL embedding in missing mode", async () => {
    expect(env.db.getEmbeddingCount()).toBe(0);
    expect(env.db.countMemoriesMissingEmbedding()).toBe(5);

    const result = await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "missing" });

    expect(result).toEqual({ embedded: 5, total: 5 });
    expect(env.db.getEmbeddingCount()).toBe(5);
    expect(env.db.countMemoriesMissingEmbedding()).toBe(0);
  });

  it("missing mode is incremental — already-embedded rows are untouched", async () => {
    await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "missing" });
    env.db.insertMemory(makeMemory({ id: "emb-new", title: "Newcomer", content: "New content" }));

    const result = await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "missing" });

    expect(result).toEqual({ embedded: 1, total: 1 });
    expect(env.db.getEmbeddingCount()).toBe(6);
  });

  it("all mode regenerates every row (reindex semantics)", async () => {
    await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "missing" });
    const result = await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "all" });
    expect(result).toEqual({ embedded: 5, total: 5 });
  });

  it("respects the limit option and reports progress", async () => {
    const seen: string[] = [];
    const result = await backfillCentralDbEmbeddings(env.db, fakeEmbedder, {
      mode: "missing",
      limit: 2,
      onProgress: (_c, _t, id) => seen.push(id),
    });
    expect(result).toEqual({ embedded: 2, total: 2 });
    expect(seen).toHaveLength(2);
    expect(env.db.countMemoriesMissingEmbedding()).toBe(3);
  });

  it("stored vectors are readable through the DB-search path", async () => {
    await backfillCentralDbEmbeddings(env.db, fakeEmbedder, { mode: "missing" });
    const all = env.db.getAllEmbeddings();
    expect(all).toHaveLength(5);
    const first = new Float32Array(all[0].embedding.buffer, all[0].embedding.byteOffset, 4);
    expect(first[1]).toBe(1); // fake embedder marker
  });
});

describe("embedMemoryIntoDb", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await createTestEnv("embed-one");
  });

  afterEach(async () => {
    await cleanupTestEnv(env);
  });

  it("embeds a single memory", async () => {
    env.db.insertMemory(makeMemory({ id: "single-1", title: "Solo", content: "Solo content" }));
    const ok = await embedMemoryIntoDb(env.db, fakeEmbedder, "single-1");
    expect(ok).toBe(true);
    expect(env.db.getEmbedding("single-1")).not.toBeNull();
  });

  it("returns false for a missing memory id", async () => {
    const ok = await embedMemoryIntoDb(env.db, fakeEmbedder, "does-not-exist");
    expect(ok).toBe(false);
  });
});
