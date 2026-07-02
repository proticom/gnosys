/**
 * Tests for src/lib/embedQueue.ts (v5.13.0) — write-time embedding.
 *
 * Contract under test: a memory write never blocks on or fails because of
 * embedding; the queue is a no-op unless the MCP server enabled it; drains
 * are best-effort with a single stderr warning on failure.
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import type { GnosysEmbeddings } from "../lib/embeddings.js";
import {
  enableWriteTimeEmbedding,
  disableWriteTimeEmbedding,
  isWriteTimeEmbeddingEnabled,
  queueMemoryEmbedding,
  flushWriteTimeEmbeddings,
} from "../lib/embedQueue.js";
import { syncMemoryToDb } from "../lib/dbWrite.js";
import { makeFrontmatter, createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

function vecFor(text: string): Float32Array {
  const v = new Float32Array(4);
  v[0] = text.length;
  return v;
}

const fakeEmbedder = {
  embed: async (text: string) => vecFor(text),
  embedBatch: async (texts: string[]) => texts.map(vecFor),
} as unknown as GnosysEmbeddings;

const throwingEmbedder = {
  embed: async () => {
    throw new Error("model unavailable");
  },
  embedBatch: async () => {
    throw new Error("model unavailable");
  },
} as unknown as GnosysEmbeddings;

let env: TestEnv | null = null;

afterEach(async () => {
  disableWriteTimeEmbedding();
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
    db.insertMemory(makeMemory({ id: "q-on-1" }));
    db.insertMemory(makeMemory({ id: "q-on-2" }));

    enableWriteTimeEmbedding(() => db, fakeEmbedder);
    expect(isWriteTimeEmbeddingEnabled()).toBe(true);

    queueMemoryEmbedding("q-on-1");
    queueMemoryEmbedding("q-on-2");
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-on-1")).not.toBeNull();
    expect(db.getEmbedding("q-on-2")).not.toBeNull();
  });

  it("never throws when the embedder fails — warns on stderr instead", async () => {
    env = await createTestEnv("queue-fail");
    const db = env.db;
    db.insertMemory(makeMemory({ id: "q-fail-1" }));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      enableWriteTimeEmbedding(() => db, throwingEmbedder);
      queueMemoryEmbedding("q-fail-1");
      await expect(flushWriteTimeEmbeddings()).resolves.toBeUndefined();
      expect(db.getEmbedding("q-fail-1")).toBeNull();
    } finally {
      errSpy.mockRestore();
    }
  });

  it("syncMemoryToDb feeds the queue — a plain DB write gets a vector", async () => {
    env = await createTestEnv("queue-sync");
    const db = env.db;
    enableWriteTimeEmbedding(() => db, fakeEmbedder);

    syncMemoryToDb(
      db,
      makeFrontmatter({ id: "q-sync-1", title: "Synced Memory" }),
      "Synced content body."
    );
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-sync-1")).not.toBeNull();
  });

  it("disable clears pending work", async () => {
    env = await createTestEnv("queue-clear");
    const db = env.db;
    db.insertMemory(makeMemory({ id: "q-clear-1" }));

    enableWriteTimeEmbedding(() => db, fakeEmbedder);
    queueMemoryEmbedding("q-clear-1");
    disableWriteTimeEmbedding();
    await flushWriteTimeEmbeddings();

    expect(db.getEmbedding("q-clear-1")).toBeNull();
  });
});
