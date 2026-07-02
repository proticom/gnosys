/**
 * Write-time embedding queue (v5.13.0).
 *
 * Keeps memories.embedding fresh as memories are written, so semantic
 * search doesn't drift stale between reindexes. Disabled by default —
 * the MCP server enables it once its long-lived central-DB handle and
 * embeddings instance exist. CLI one-shot processes stay disabled (they
 * exit before the model could load) and rely on reindex / Dream backfill.
 *
 * Contract: a memory write must NEVER block on or fail because of
 * embedding. queueMemoryEmbedding returns immediately; the drain runs on
 * an unref'd timer, lazily imports the embedder path, logs at most one
 * stderr warning per process on failure, and drops rather than retries.
 */

import type { GnosysDB } from "./db.js";
import type { GnosysEmbeddings } from "./embeddings.js";

let getDb: (() => GnosysDB | null) | null = null;
let embedder: GnosysEmbeddings | null = null;
const pending = new Set<string>();
let drainPromise: Promise<void> | null = null;
let warnedOnce = false;

/** Turn on write-time embedding (serve mode). Getter is called at drain time. */
export function enableWriteTimeEmbedding(
  dbGetter: () => GnosysDB | null,
  embeddings: GnosysEmbeddings
): void {
  getDb = dbGetter;
  embedder = embeddings;
}

/** Turn off and clear the queue (tests, shutdown). */
export function disableWriteTimeEmbedding(): void {
  getDb = null;
  embedder = null;
  pending.clear();
}

export function isWriteTimeEmbeddingEnabled(): boolean {
  return getDb !== null && embedder !== null;
}

/**
 * Queue a memory for embedding. No-op unless enabled. Never throws,
 * never blocks — safe to call from any write path.
 */
export function queueMemoryEmbedding(id: string): void {
  if (!getDb || !embedder || !id) return;
  pending.add(id);
  if (!drainPromise) {
    drainPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        drain().finally(() => {
          drainPromise = null;
          resolve();
        });
      }, 25);
      timer.unref?.();
    });
  }
}

/** Await in-flight embedding work. Used by tests and graceful shutdown. */
export async function flushWriteTimeEmbeddings(): Promise<void> {
  while (drainPromise) {
    await drainPromise;
  }
}

async function drain(): Promise<void> {
  while (pending.size > 0) {
    const id = pending.values().next().value as string;
    pending.delete(id);
    const db = getDb?.();
    if (!db || !embedder) return;
    try {
      const { embedMemoryIntoDb } = await import("./embedDb.js");
      await embedMemoryIntoDb(db, embedder, id);
    } catch (err) {
      if (!warnedOnce) {
        warnedOnce = true;
        console.error(
          `Gnosys: write-time embedding failed (${err instanceof Error ? err.message : err}). ` +
            `New memories will be embedded by the next gnosys_reindex or Dream run instead.`
        );
      }
      return; // drop this round; anything still pending waits for the next queue call
    }
  }
}
