/**
 * Tests for src/lib/embedQueue.ts (v5.13.0) — write-time embedding.
 *
 * Contract under test: a memory write never blocks on or fails because of
 * embedding; the queue is a no-op unless the MCP server enabled it; drains
 * are best-effort with a single stderr warning on failure.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import {
  enableWriteTimeEmbedding,
  disableWriteTimeEmbedding,
  isWriteTimeEmbeddingEnabled,
  queueMemoryEmbedding,
  flushWriteTimeEmbeddings,
} from "../lib/embedQueue.js";
import { syncMemoryToDb } from "../lib/dbWrite.js";
import { makeFrontmatter, createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

const { modelRun } = vi.hoisted(() => ({
  modelRun: vi.fn<(texts: string[], options?: Record<string, unknown>) => Promise<{ tolist(): number[][] }>>(),
}));

vi.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => modelRun,
}));

beforeEach(() => {
  modelRun.mockReset().mockResolvedValue({ tolist: () => [[1, 2, 3, 4]] });
  vi.stubEnv("HF_HOME", process.env.HF_HOME);
  vi.stubEnv("TRANSFORMERS_CACHE", process.env.TRANSFORMERS_CACHE);
});

let env: TestEnv | null = null;

afterEach(async () => {
  disableWriteTimeEmbedding();
  vi.unstubAllEnvs();
  if (env) {
    await cleanupTestEnv(env);
    env = null;
  }
});

describe("embedQueue", () => {
  it("is a no-op when disabled (the CLI / test default)", async () => {
    env = await createTestEnv("queue-off");
    env.db.insertMemory(makeMemory({ id: "q-off-1" }));

    expect(isWriteTimeEmbeddingEnabled()).toBe(false);
    queueMemoryEmbedding("q-off-1");
    await flushWriteTimeEmbeddings();

    expect(env.db.getEmbedding("q-off-1")).toBeNull();
  });

  it("embeds queued memories once enabled", async () => {
    env = await createTestEnv("queue-on");
    const db = env.db;
    vi.stubEnv("GNOSYS_CACHE_DIR", env.tmpDir);
    db.insertMemory(makeMemory({ id: "q-on-1", title: "First", relevance: "alpha", tags: '["one"]', content: "First body" }));
    db.insertMemory(makeMemory({ id: "q-on-2", title: "Second", relevance: "beta", tags: '["two"]', content: "Second body" }));
    modelRun.mockResolvedValueOnce({ tolist: () => [[1, 2, 3, 4]] })
      .mockResolvedValueOnce({ tolist: () => [[5, 6, 7, 8]] });

    enableWriteTimeEmbedding(() => db, new GnosysEmbeddings(env.tmpDir));
    expect(isWriteTimeEmbeddingEnabled()).toBe(true);

    queueMemoryEmbedding("q-on-1");
    queueMemoryEmbedding("q-on-2");
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-on-1")).toEqual(Buffer.from(new Float32Array([1, 2, 3, 4]).buffer));
    expect(db.getEmbedding("q-on-2")).toEqual(Buffer.from(new Float32Array([5, 6, 7, 8]).buffer));
    expect(modelRun.mock.calls).toEqual([
      [["First\nalpha\none\nFirst body"], { pooling: "mean", normalize: true }],
      [["Second\nbeta\ntwo\nSecond body"], { pooling: "mean", normalize: true }],
    ]);
  });

  it("never throws when the embedder fails — warns on stderr instead", async () => {
    env = await createTestEnv("queue-fail");
    const db = env.db;
    vi.stubEnv("GNOSYS_CACHE_DIR", env.tmpDir);
    db.insertMemory(makeMemory({ id: "q-fail-1" }));

    modelRun.mockRejectedValue(new Error("model unavailable"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      enableWriteTimeEmbedding(() => db, new GnosysEmbeddings(env.tmpDir));
      queueMemoryEmbedding("q-fail-1");
      await expect(flushWriteTimeEmbeddings()).resolves.toBeUndefined();
      expect(db.getEmbedding("q-fail-1")).toBeNull();
      expect(errSpy.mock.calls).toEqual([["Gnosys: write-time embedding failed (model unavailable). New memories will be embedded by the next gnosys_reindex or Dream run instead."]]);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("syncMemoryToDb feeds the queue — a plain DB write gets a vector", async () => {
    env = await createTestEnv("queue-sync");
    const db = env.db;
    vi.stubEnv("GNOSYS_CACHE_DIR", env.tmpDir);
    enableWriteTimeEmbedding(() => db, new GnosysEmbeddings(env.tmpDir));

    syncMemoryToDb(
      db,
      makeFrontmatter({ id: "q-sync-1", title: "Synced Memory" }),
      "Synced content body."
    );
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-sync-1")).toEqual(Buffer.from(new Float32Array([1, 2, 3, 4]).buffer));
  });

  it("disable clears pending work", async () => {
    env = await createTestEnv("queue-clear");
    const db = env.db;
    vi.stubEnv("GNOSYS_CACHE_DIR", env.tmpDir);
    db.insertMemory(makeMemory({ id: "q-clear-1" }));

    enableWriteTimeEmbedding(() => db, new GnosysEmbeddings(env.tmpDir));
    queueMemoryEmbedding("q-clear-1");
    disableWriteTimeEmbedding();
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-clear-1")).toBeNull();
  });
});
