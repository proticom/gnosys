/**
 * v13 client-side sync: reachability heartbeat, offline snapshot rule, pending overlay.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { GnosysDB } from "./db.js";
import { readMachineConfig, type MultiMachineRole } from "./machineConfig.js";
import { getConfiguredRemotePath } from "./remote.js";
import {
  clientSnapshotStore,
  formatSnapshotAge,
  getClientAcceptedManifest,
} from "./syncSnapshot.js";
import { countFailedStagingFiles, machineStagingDir } from "./syncStaging.js";
import { getMachineId } from "./machineConfig.js";
import {
  renderClientSyncStatusLines,
  type ClientSyncStatusInput,
} from "./setup/remoteRender.js";

const REACHABILITY_TTL_MS = 30_000;

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

export function openClientReadDb(localDb: GnosysDB, masterPath: string): GnosysDB {
  if (shouldHideSnapshotReads(masterPath)) {
    return localDb;
  }
  const store = clientSnapshotStore(masterPath);
  const snap = path.join(store, "gnosys.db");
  if (!existsSync(snap)) return localDb;
  return new GnosysDB(store);
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
