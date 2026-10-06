/**
 * Gnosys DB Write — Dual-write layer for v2.0 migration.
 *
 * When gnosys.db is available, all write operations go to BOTH:
 *   1. .md files (via GnosysStore) — safety net + Obsidian compatibility
 *   2. gnosys.db (via GnosysDB) — primary store for agent reads
 *
 * This module provides helper functions that MCP tools and maintenance
 * call after writing to the .md store. It also handles syncing writes
 * that bypass the .md layer (e.g., maintenance operations on archived
 * memories).
 *
 * Once the Obsidian Export Bridge (Phase 7e) is complete, .md writes
 * become optional — controlled by config.
 */

import type { GnosysDB, DbMemory } from "./db.js";
import type { MemoryFrontmatter, } from "./store.js";
import { fnv1a } from "./db.js";
import { queueMemoryEmbedding } from "./embedQueue.js";

/** Coerce Date objects (from gray-matter parsing) to ISO date strings. */
function toDateStr(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "string") return value;
  return null;
}

/**
 * Sync a memory write to gnosys.db after it's been written to .md.
 * Call this after GnosysStore.writeMemory() or updateMemory().
 *
 * v3.0: Accepts optional projectId and scope for centralized brain.
 */
export function syncMemoryToDb(
  db: GnosysDB,
  frontmatter: MemoryFrontmatter,
  content: string,
  sourcePath?: string,
  projectId?: string | null,
  scope?: string
): void {
  if (!db.isAvailable()) return;

  const tags = Array.isArray(frontmatter.tags)
    ? JSON.stringify(frontmatter.tags)
    : JSON.stringify(Object.values(frontmatter.tags).flat());

  db.insertMemory({
    id: frontmatter.id,
    title: frontmatter.title,
    category: frontmatter.category,
    content,
    summary: null,
    tags,
    relevance: (frontmatter.relevance as string) || "",
    author: frontmatter.author || "ai",
    authority: frontmatter.authority || "imported",
    confidence: frontmatter.confidence ?? 0.8,
    reinforcement_count: frontmatter.reinforcement_count ?? 0,
    content_hash: fnv1a(content),
    status: frontmatter.status || "active",
    tier: frontmatter.status === "archived" ? "archive" : "active",
    supersedes: frontmatter.supersedes || null,
    superseded_by: frontmatter.superseded_by || null,
    last_reinforced: toDateStr(frontmatter.last_reinforced) || null,
    created: toDateStr(frontmatter.created) || new Date().toISOString().split("T")[0],
    modified: toDateStr(frontmatter.modified) || new Date().toISOString().split("T")[0],
    source_path: sourcePath || null,
    source_file: (frontmatter as Record<string, unknown>).source_file as string || null,
    source_page: (frontmatter as Record<string, unknown>).source_page as string || null,
    source_timerange: (frontmatter as Record<string, unknown>).source_timerange as string || null,
    project_id: projectId || null,
    scope: scope || "project",
  });

  // v5.13.0: best-effort write-time embedding (no-op unless the MCP server
  // enabled the queue). Never blocks or fails the write.
  queueMemoryEmbedding(frontmatter.id);
}

/**
 * Sync a memory update to gnosys.db after it's been updated in .md.
 */
export function syncUpdateToDb(
  db: GnosysDB,
  id: string,
  updates: Partial<MemoryFrontmatter>,
  newContent?: string
): void {
  if (!db.isAvailable()) return;

  const dbUpdates: Partial<DbMemory> = {};

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
    if (updates.status === "archived") dbUpdates.tier = "archive";
  }
  if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence;
  if (updates.relevance !== undefined) dbUpdates.relevance = updates.relevance as string;
  if (updates.supersedes !== undefined) dbUpdates.supersedes = updates.supersedes || null;
  if (updates.superseded_by !== undefined) dbUpdates.superseded_by = updates.superseded_by || null;
  if (updates.reinforcement_count !== undefined) dbUpdates.reinforcement_count = updates.reinforcement_count;
  if (updates.last_reinforced !== undefined) dbUpdates.last_reinforced = updates.last_reinforced || null;
  if (updates.tags !== undefined) {
    dbUpdates.tags = Array.isArray(updates.tags)
      ? JSON.stringify(updates.tags)
      : JSON.stringify(Object.values(updates.tags).flat());
  }
  if (updates.author !== undefined) dbUpdates.author = updates.author;
  if (updates.authority !== undefined) dbUpdates.authority = updates.authority;

  // v5.0: Multimodal source fields
  const raw = updates as Record<string, unknown>;
  if (raw.source_file !== undefined) dbUpdates.source_file = (raw.source_file as string) || null;
  if (raw.source_page !== undefined) dbUpdates.source_page = (raw.source_page as string) || null;
  if (raw.source_timerange !== undefined) dbUpdates.source_timerange = (raw.source_timerange as string) || null;

  if (newContent !== undefined) {
    dbUpdates.content = newContent;
    dbUpdates.content_hash = fnv1a(newContent);
  }

  const linkFields: Array<"supersedes" | "superseded_by"> = ["supersedes", "superseded_by"];
  const changesLinks = linkFields.some((field) => updates[field] !== undefined);
  const onlyLinks = changesLinks && newContent === undefined &&
    Object.keys(updates).every((field) => field === "supersedes" || field === "superseded_by" || field === "status");
  if (!onlyLinks) dbUpdates.modified = new Date().toISOString().split("T")[0];

  db.transaction(() => {
    const current = db.getMemory(id);
    if (changesLinks && !current) throw new Error(`Memory not found: ${id}`);
    for (const field of linkFields) {
      const targetId = dbUpdates[field];
      if (!targetId) continue;
      if (!db.getMemory(targetId)) throw new Error(`Memory not found: ${targetId}`);
    }

    const clearLink = (memoryId: string, field: "supersedes" | "superseded_by") => {
      const memory = db.getMemory(memoryId);
      if (!memory) return;
      db.updateMemory(memoryId, {
        [field]: null,
        ...(field === "superseded_by" && memory.status === "superseded"
          ? { status: memory.tier === "archive" ? "archived" : "active" }
          : {}),
      });
    };

    for (const field of linkFields) {
      const targetId = dbUpdates[field];
      if (targetId === undefined) continue;
      const inverse = field === "supersedes" ? "superseded_by" : "supersedes";
      const previousId = current?.[field];
      if (previousId && previousId !== targetId && db.getMemory(previousId)?.[inverse] === id) {
        clearLink(previousId, inverse);
      }
      if (targetId) {
        const displacedId = db.getMemory(targetId)?.[inverse];
        if (displacedId && displacedId !== id && db.getMemory(displacedId)?.[field] === targetId) {
          clearLink(displacedId, field);
        }
        db.updateMemory(targetId, {
          [inverse]: id,
          ...(inverse === "superseded_by" ? { status: "superseded" } : {}),
        });
      }
    }
    if (dbUpdates.superseded_by) dbUpdates.status = "superseded";
    else if (dbUpdates.superseded_by === null && current?.status === "superseded" && updates.status === undefined) {
      dbUpdates.status = current.tier === "archive" ? "archived" : "active";
    }
    db.updateMemory(id, dbUpdates);
    if (changesLinks) {
      for (const field of linkFields) {
        const visited = new Set<string>();
        let next: string | null = id;
        while (next) {
          if (visited.has(next)) throw new Error("Supersession would create a cycle.");
          visited.add(next);
          next = db.getMemory(next)?.[field] ?? null;
        }
      }
    }
  });

  // v5.13.0: re-embed when searchable text changed (title/content/tags/
  // relevance feed the embedding recipe). No-op unless the queue is enabled.
  if (
    newContent !== undefined ||
    updates.title !== undefined ||
    updates.tags !== undefined ||
    updates.relevance !== undefined
  ) {
    queueMemoryEmbedding(id);
  }
}

/**
 * Sync an archive operation to gnosys.db.
 * Sets tier='archive' on the memory.
 */
export function syncArchiveToDb(db: GnosysDB, memoryId: string): void {
  if (!db.isAvailable()) return;
  db.updateMemory(memoryId, {
    tier: "archive",
    status: "archived",
    modified: new Date().toISOString().split("T")[0],
  });
}

/**
 * Sync a dearchive operation to gnosys.db.
 * Sets tier='active' on the memory.
 */
export function syncDearchiveToDb(db: GnosysDB, memoryId: string): void {
  if (!db.isAvailable()) return;
  db.updateMemory(memoryId, {
    tier: "active",
    status: "active",
    modified: new Date().toISOString().split("T")[0],
  });
}

/**
 * Sync a delete operation to gnosys.db.
 */
export function syncDeleteToDb(db: GnosysDB, memoryId: string): void {
  if (!db.isAvailable()) return;
  db.deleteMemory(memoryId);
}

/**
 * Sync a reinforcement to gnosys.db.
 */
export function syncReinforcementToDb(
  db: GnosysDB,
  memoryId: string,
  newCount: number
): void {
  if (!db.isAvailable()) return;
  db.updateMemory(memoryId, {
    reinforcement_count: newCount,
    last_reinforced: new Date().toISOString().split("T")[0],
    modified: new Date().toISOString().split("T")[0],
  });
}

/**
 * Sync a confidence update to gnosys.db (e.g., from decay).
 */
export function syncConfidenceToDb(
  db: GnosysDB,
  memoryId: string,
  newConfidence: number
): void {
  if (!db.isAvailable()) return;
  db.updateMemory(memoryId, {
    confidence: newConfidence,
    modified: new Date().toISOString().split("T")[0],
  });
}

/**
 * Log an audit entry to gnosys.db's audit_log table.
 * This supplements (and eventually replaces) the JSONL audit log.
 */
export function auditToDb(
  db: GnosysDB,
  operation: string,
  memoryId?: string,
  details?: Record<string, unknown>,
  durationMs?: number,
  traceId?: string
): void {
  if (!db.isAvailable()) return;
  db.logAudit({
    timestamp: new Date().toISOString(),
    operation,
    memory_id: memoryId || null,
    details: details ? JSON.stringify(details) : null,
    duration_ms: durationMs ? Math.round(durationMs) : null,
    trace_id: traceId || null,
  });
}
