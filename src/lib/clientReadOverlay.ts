/**
 * v13 client read overlay — merge pending-adds into read results.
 */

import type { DbMemory } from "./db.js";

export type PendingAddRow = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string;
  project_id: string | null;
  scope: string;
  created: string;
};

export interface OverlayReadResult {
  memories: DbMemory[];
  overlayCount: number;
  source: string;
}

export function pendingAddToDbMemory(p: PendingAddRow): DbMemory {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    content: p.content,
    summary: null,
    tags: p.tags,
    relevance: "",
    author: "user",
    authority: "user",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "",
    status: "active",
    tier: "active",
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: p.created,
    modified: p.created,
    embedding: null,
    source_path: null,
    source_file: null,
    source_page: null,
    source_timerange: null,
    project_id: p.project_id,
    scope: p.scope,
  };
}

export function applyPendingOverlay(
  baseMemories: DbMemory[],
  pendingAdds: PendingAddRow[],
  ingestedUlids: Set<string>,
): OverlayReadResult {
  const stillPending = pendingAdds.filter((p) => !ingestedUlids.has(p.id));
  const overlayMemories = stillPending.map(pendingAddToDbMemory);

  const seen = new Set(baseMemories.map((m) => m.id));
  const merged = [...baseMemories];
  for (const m of overlayMemories) {
    if (!seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  }

  return {
    memories: merged,
    overlayCount: overlayMemories.length,
    source: "merged",
  };
}

function pendingMatchesQuery(p: PendingAddRow, query: string): boolean {
  const q = query.replace(/['"]/g, "").trim().toLowerCase();
  if (!q) return true;
  const hay = `${p.title} ${p.content} ${p.tags} ${p.category}`.toLowerCase();
  return q.split(/\s+/).every((term) => hay.includes(term));
}

export function mergeOverlayDiscoverResults<T extends { id: string }>(
  base: T[],
  pendingAdds: PendingAddRow[],
  query: string,
  limit: number,
  toRow: (p: PendingAddRow) => T,
): T[] {
  const seen = new Set(base.map((r) => r.id));
  const merged = [...base];
  for (const p of pendingAdds) {
    if (merged.length >= limit) break;
    if (seen.has(p.id) || !pendingMatchesQuery(p, query)) continue;
    merged.push(toRow(p));
    seen.add(p.id);
  }
  return merged;
}

export function mergeOverlaySearchResults<T extends { id: string }>(
  base: T[],
  pendingAdds: PendingAddRow[],
  query: string,
  limit: number,
  toRow: (p: PendingAddRow) => T,
): T[] {
  return mergeOverlayDiscoverResults(base, pendingAdds, query, limit, toRow);
}
