/**
 * Shared client read-path resolution for MCP tools and CLI commands.
 */

import { GnosysDB } from "./db.js";
import { readMachineConfig } from "./machineConfig.js";
import { getConfiguredRemotePath } from "./remote.js";
import {
  closeClientReadContext,
  openClientReadContext,
  type ClientReadContext,
} from "./syncClient.js";
import type { PendingAddRow } from "./clientReadOverlay.js";
import {
  applyPendingOverlay,
  mergeOverlayDiscoverResults,
  mergeOverlaySearchResults,
  pendingAddToDbMemory,
} from "./clientReadOverlay.js";
import type { DbMemory } from "./db.js";

export interface ResolvedClientRead {
  db: GnosysDB;
  localDb: GnosysDB;
  pendingOverlay: PendingAddRow[];
  clientRead: ClientReadContext | null;
  release: () => void;
}

/** Open central DB and apply v13 client read context when role is client. */
export function resolveClientRead(): ResolvedClientRead | null {
  const localDb = GnosysDB.openCentral();
  if (!localDb.isAvailable()) {
    localDb.close();
    return null;
  }

  const mc = readMachineConfig();
  if (!mc?.remote.enabled || mc.remote.role !== "client") {
    return {
      db: localDb,
      localDb,
      pendingOverlay: [],
      clientRead: null,
      release: () => localDb.close(),
    };
  }

  const masterPath = getConfiguredRemotePath(localDb);
  if (!masterPath) {
    return {
      db: localDb,
      localDb,
      pendingOverlay: [],
      clientRead: null,
      release: () => localDb.close(),
    };
  }

  const clientRead = openClientReadContext(localDb, masterPath, mc.machineId);
  return {
    db: clientRead.db,
    localDb,
    pendingOverlay: clientRead.pendingOverlay,
    clientRead,
    release: () => {
      closeClientReadContext(clientRead);
      localDb.close();
    },
  };
}

export function listMemoriesWithOverlay(
  resolved: ResolvedClientRead,
  fetch: (db: GnosysDB) => DbMemory[],
): DbMemory[] {
  const base = fetch(resolved.db);
  if (resolved.pendingOverlay.length === 0) return base;
  return applyPendingOverlay(base, resolved.pendingOverlay, new Set()).memories;
}

export function getMemoryWithOverlay(resolved: ResolvedClientRead, id: string): DbMemory | null {
  const fromDb = resolved.db.getMemory(id);
  if (fromDb) return fromDb;
  const pending = resolved.pendingOverlay.find((p) => p.id === id);
  return pending ? pendingAddToDbMemory(pending) : null;
}

export function discoverWithOverlay(
  resolved: ResolvedClientRead,
  query: string,
  limit: number,
): Array<{ id: string; title: string; relevance: string; rank: number; project_id: string | null }> {
  const base = resolved.db.discoverFts(query, limit);
  if (resolved.pendingOverlay.length === 0) return base;
  return mergeOverlayDiscoverResults(
    base,
    resolved.pendingOverlay,
    query,
    limit,
    (p) => ({
      id: p.id,
      title: p.title,
      relevance: "",
      rank: 0,
      project_id: p.project_id,
    }),
  );
}

export function searchWithOverlay(
  resolved: ResolvedClientRead,
  query: string,
  limit: number,
): Array<{ id: string; title: string; snippet: string; rank: number; project_id: string | null }> {
  const base = resolved.db.searchFts(query, limit);
  if (resolved.pendingOverlay.length === 0) return base;
  return mergeOverlaySearchResults(
    base,
    resolved.pendingOverlay,
    query,
    limit,
    (p) => ({
      id: p.id,
      title: p.title,
      snippet: p.content.substring(0, 200),
      rank: 0,
      project_id: p.project_id,
    }),
  );
}
