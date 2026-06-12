/**
 * v13 client-side sync: reachability heartbeat, offline snapshot rule, pending overlay.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { GnosysDB } from "./db.js";
import { readMachineConfig, type MultiMachineRole, getMachineId } from "./machineConfig.js";
import { getConfiguredRemotePath } from "./remote.js";
import {
  clientSnapshotStore,
  formatSnapshotAge,
  getClientAcceptedManifest,
} from "./syncSnapshot.js";
import { countFailedStagingFiles, machineStagingDir, stagingRoot } from "./syncStaging.js";
import {
  renderClientSyncStatusLines,
  type ClientSyncStatusInput,
} from "./setup/remoteRender.js";
import type { PendingAddRow } from "./clientReadOverlay.js";

const REACHABILITY_TTL_MS = 30_000;

export interface IngestReceipt {
  ulid: string;
  outcome: "ingested" | "deduped";
  at: string;
}

export interface ClientReadContext {
  /** The DB to query for base memories (may be master, snapshot, or local). */
  db: GnosysDB;
  /** Original local central DB — never closed by closeClientReadContext. */
  localDb: GnosysDB;
  /** Pending-adds to overlay (already filtered by receipts). */
  pendingOverlay: PendingAddRow[];
  source: "master" | "snapshot" | "pending-only";
  masterReachable: boolean;
  /** When true, closeClientReadContext must close db (not localDb). */
  ownsReadDb: boolean;
}

export interface V13SyncStatus {
  role: MultiMachineRole | null;
  masterPath: string | null;
  masterReachable: boolean;
  waitingToSync: number;
  failedToSync: number;
  pendingOfflineAdds: number;
  snapshotAge: string | null;
  lines: string[];
}

function readManifestHeartbeat(masterPath: string): string | null {
  const manifestPath = path.join(masterPath, "snapshots", "snapshot-manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as { publishedAt?: string };
    return m.publishedAt ?? null;
  } catch {
    return null;
  }
}

export function isMasterReachable(masterPath: string): boolean {
  try {
    const manifestPath = path.join(masterPath, "snapshots", "snapshot-manifest.json");
    if (existsSync(manifestPath)) {
      const mtime = statSync(manifestPath).mtimeMs;
      if (Date.now() - mtime < REACHABILITY_TTL_MS) return true;
    }
    const dbPath = path.join(masterPath, "gnosys.db");
    if (existsSync(dbPath)) {
      statSync(dbPath);
      return true;
    }
    statSync(masterPath);
    return true;
  } catch {
    return false;
  }
}

export function countClientWaitingStaging(masterPath: string, machineId: string): number {
  const dir = machineStagingDir(masterPath, machineId);
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((n) => n.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

/** Client should hide snapshot reads when master is unreachable (v13 offline rule). */
export function shouldHideSnapshotReads(masterPath: string): boolean {
  return !isMasterReachable(masterPath);
}

export function listClientReceipts(masterPath: string, machineId: string): IngestReceipt[] {
  const dir = path.join(stagingRoot(masterPath), machineId, "receipts");
  if (!existsSync(dir)) return [];
  const receipts: IngestReceipt[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      const raw = readFileSync(path.join(dir, file), "utf-8");
      receipts.push(JSON.parse(raw) as IngestReceipt);
    } catch {
      // skip malformed
    }
  }
  return receipts;
}

export function getIngestedUlids(masterPath: string, machineId: string): Set<string> {
  return new Set(listClientReceipts(masterPath, machineId).map((r) => r.ulid));
}

export function openClientReadContext(
  localDb: GnosysDB,
  masterPath: string,
  machineId: string,
): ClientReadContext {
  const mc = readMachineConfig();
  const role = mc?.remote.role;

  if (!role || role === "master") {
    return {
      db: localDb,
      localDb,
      pendingOverlay: [],
      source: "master",
      masterReachable: true,
      ownsReadDb: false,
    };
  }

  const reachable = isMasterReachable(masterPath);
  const ingestedUlids = getIngestedUlids(masterPath, machineId);
  const pendingAdds = localDb.listActivePendingAdds().filter((p) => !ingestedUlids.has(p.id));

  if (reachable) {
    const masterDb = new GnosysDB(masterPath);
    if (masterDb.isAvailable()) {
      return {
        db: masterDb,
        localDb,
        pendingOverlay: pendingAdds,
        source: "master",
        masterReachable: true,
        ownsReadDb: true,
      };
    }
    masterDb.close();
  }

  const store = clientSnapshotStore(masterPath);
  const snapPath = path.join(store, "gnosys.db");
  if (existsSync(snapPath)) {
    const snapDb = new GnosysDB(store);
    if (snapDb.isAvailable()) {
      return {
        db: snapDb,
        localDb,
        pendingOverlay: pendingAdds,
        source: "snapshot",
        masterReachable: false,
        ownsReadDb: true,
      };
    }
    snapDb.close();
  }

  return {
    db: localDb,
    localDb,
    pendingOverlay: pendingAdds,
    source: "pending-only",
    masterReachable: false,
    ownsReadDb: false,
  };
}

/** Release snapshot/master DB handles opened by openClientReadContext. */
export function closeClientReadContext(ctx: ClientReadContext): void {
  if (ctx.ownsReadDb) {
    ctx.db.close();
  }
}

export function getV13SyncStatus(localDb: GnosysDB): V13SyncStatus {
  const mc = readMachineConfig();
  const masterPath = getConfiguredRemotePath(localDb);
  const role = mc?.remote.role ?? null;
  const empty: V13SyncStatus = {
    role,
    masterPath,
    masterReachable: false,
    waitingToSync: 0,
    failedToSync: 0,
    pendingOfflineAdds: 0,
    snapshotAge: null,
    lines: [],
  };
  if (!masterPath || !role) return empty;

  const reachable = isMasterReachable(masterPath);
  const machineId = getMachineId();
  let waitingToSync = 0;
  let failedToSync = 0;
  if (role === "client") {
    waitingToSync = countClientWaitingStaging(masterPath, machineId);
    failedToSync = countFailedStagingFiles(masterPath, machineId);
  } else if (role === "master") {
    const masterDb = new GnosysDB(masterPath);
    if (masterDb.isAvailable()) {
      waitingToSync = masterDb.countPendingStagingLedger();
    }
    masterDb.close();
  }

  let pendingOfflineAdds = 0;
  if (localDb.isAvailable()) {
    pendingOfflineAdds = localDb.listActivePendingAdds().length;
  }

  let snapshotAge: string | null = null;
  const accepted = getClientAcceptedManifest(masterPath);
  if (accepted?.publishedAt) {
    snapshotAge = formatSnapshotAge(accepted.publishedAt);
  } else {
    const pub = readManifestHeartbeat(masterPath);
    if (pub) snapshotAge = formatSnapshotAge(pub);
  }

  const input: ClientSyncStatusInput = {
    masterReachable: reachable,
    waitingToSync,
    failedToSync,
    pendingOfflineAdds: reachable ? undefined : pendingOfflineAdds,
  };
  const lines = renderClientSyncStatusLines(input);
  if (snapshotAge && reachable) {
    lines.push(`Snapshot as of ${snapshotAge}`);
  }

  return {
    role,
    masterPath,
    masterReachable: reachable,
    waitingToSync,
    failedToSync,
    pendingOfflineAdds,
    snapshotAge,
    lines,
  };
}
