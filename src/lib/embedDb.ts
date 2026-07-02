/**
 * Central-DB embedding utilities (v5.13.0).
 *
 * GnosysDbSearch reads vectors from the memories.embedding column of
 * gnosys.db, but before v5.13.0 nothing ever wrote that column: the
 * reindex flow embedded file-store memories into the store-local
 * embeddings.db, so DB-mode hybrid search could never run its semantic
 * leg. This module owns the column — full backfill for reindex,
 * missing-only backfill for Dream/maintenance, and single-memory
 * embedding for the write-time queue.
 *
 * Embeddings are derived, rebuildable data: regenerating them is always
 * safe, and a sync snapshot refresh replacing them is not a loss.
 */

import type { GnosysDB } from "./db.js";
import type { GnosysEmbeddings } from "./embeddings.js";

/** Row fields needed to build embedding text. */
export interface EmbeddableMemoryRow {
  id: string;
  title: string;
  relevance: string | null;
  tags: string;
  content: string;
}

/**
 * The text recipe — identical to the file-store reindex in hybridSearch.ts
 * (title, relevance keywords, tags, content) so query-vs-document
 * similarity behaves the same in both modes.
 */
export function embeddingText(m: EmbeddableMemoryRow): string {
  let tags = m.tags || "";
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      tags = parsed.join(" ");
    } else if (parsed && typeof parsed === "object") {
      tags = Object.values(parsed).flat().join(" ");
    }
  } catch {
    // already a plain string
  }
  return `${m.title}\n${m.relevance || ""}\n${tags}\n${m.content}`;
}

/** View a Float32Array as the Buffer shape memories.embedding stores. */
export function float32ToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/**
 * (Re)build the memories.embedding column.
 *
 * mode "all" regenerates every memory (reindex semantics); "missing" only
 * fills NULL rows (write-gap backfill for Dream/maintenance, newest first).
 * Batched through embedBatch for model efficiency.
 */
export async function backfillCentralDbEmbeddings(
  db: GnosysDB,
  embeddings: GnosysEmbeddings,
  opts: {
    mode?: "missing" | "all";
    batchSize?: number;
    limit?: number;
    onProgress?: (current: number, total: number, id: string) => void;
  } = {}
): Promise<{ embedded: number; total: number }> {
  if (!db.isAvailable() || !db.isMigrated()) return { embedded: 0, total: 0 };

  const rows = db.getMemoriesForEmbedding(opts.mode || "missing", opts.limit);
  const total = rows.length;
  if (total === 0) return { embedded: 0, total: 0 };

  const batchSize = opts.batchSize || 32;
  let embedded = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const vectors = await embeddings.embedBatch(batch.map(embeddingText));
    for (let j = 0; j < batch.length; j++) {
      db.updateEmbedding(batch[j].id, float32ToBuffer(vectors[j]));
      embedded++;
      opts.onProgress?.(embedded, total, batch[j].id);
    }
  }

  return { embedded, total };
}

/**
 * Embed one memory and store its vector. Returns false if the memory
 * doesn't exist; throws on embedder failure — callers decide how loud.
 */
export async function embedMemoryIntoDb(
  db: GnosysDB,
  embeddings: GnosysEmbeddings,
  id: string
): Promise<boolean> {
  const mem = db.getMemory(id);
  if (!mem) return false;
  const vec = await embeddings.embed(
    embeddingText({
      id: mem.id,
      title: mem.title,
      relevance: mem.relevance,
      tags: mem.tags,
      content: mem.content,
    })
  );
  db.updateEmbedding(id, float32ToBuffer(vec));
  return true;
}
