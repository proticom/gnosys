/**
 * v13 snapshot publication — immutable DB copies + manifest with epoch fencing.
 */

import { createHash } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from "fs";
import path from "path";
import { GnosysDB } from "./db.js";
import { getGnosysHome } from "./paths.js";
import { atomicWriteFileSync } from "./atomicWrite.js";
import {
  assertMasterLeaseHeld,
  readMasterMarker,
  touchMasterMarkerHeartbeat,
  validateLeaseEpochBeforeWrite,
} from "./masterLease.js";
import { ensureMachineConfig } from "./machineConfig.js";
import { acquireWriteLockSync } from "./syncLock.js";

const SNAPSHOT_RETENTION = 2;
const MANIFEST_FILENAME = "snapshot-manifest.json";

export interface SnapshotManifestFile {
  epoch: number;
  seq: number;
  snapshotFile: string;
  publishedAt: string;
  checksum: string;
  sizeBytes: number;
}

export function masterSnapshotsDir(masterPath: string): string {
  return path.join(masterPath, "snapshots");
}

export function clientSnapshotStore(masterPath: string): string {
  const key = createHash("sha256").update(path.resolve(masterPath)).digest("hex").slice(0, 16);
  return path.join(getGnosysHome(), "client-snapshots", key);
}

function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function readManifestFile(masterPath: string): SnapshotManifestFile | null {
  const p = path.join(masterSnapshotsDir(masterPath), MANIFEST_FILENAME);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as SnapshotManifestFile;
  } catch {
    return null;
  }
}

function writeManifestFile(masterPath: string, manifest: SnapshotManifestFile): void {
  const dir = masterSnapshotsDir(masterPath);
  mkdirSync(dir, { recursive: true });
  atomicWriteFileSync(path.join(dir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2) + "\n");
}

function gcOldSnapshots(masterPath: string, keepFiles: Set<string>): void {
  const dir = masterSnapshotsDir(masterPath);
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".db")) continue;
    if (keepFiles.has(name)) continue;
    try {
      unlinkSync(path.join(dir, name));
    } catch {
      // ignore
    }
  }
}

/** Publish a new immutable snapshot on the master (re-validates lease epoch first). */
export async function publishMasterSnapshot(masterPath: string): Promise<SnapshotManifestFile | null> {
  const { config: mc } = ensureMachineConfig();
  const lockPath = path.join(getGnosysHome(), "master-ingest.lock");
  const release = acquireWriteLockSync(lockPath, "snapshot-publish");
  try {
    touchMasterMarkerHeartbeat(masterPath);
    assertMasterLeaseHeld(masterPath, mc.machineId);
    const marker = readMasterMarker(masterPath);
    if (!marker) return null;
    validateLeaseEpochBeforeWrite(masterPath, marker.epoch, mc.machineId);

    const masterDb = new GnosysDB(masterPath);
    if (!masterDb.isAvailable()) {
      masterDb.close();
      return null;
    }

    const prevDb = masterDb.getSnapshotManifest();
    const prevFile = readManifestFile(masterPath);
    const prevSeq = Math.max(prevDb?.seq ?? 0, prevFile?.seq ?? 0);
    const nextSeq = prevSeq + 1;
    const snapDir = masterSnapshotsDir(masterPath);
    mkdirSync(snapDir, { recursive: true });
    const snapName = `snap-${marker.epoch}-${nextSeq}.db`;
    const finalPath = path.join(snapDir, snapName);
    const tmpPath = path.join(snapDir, `.${snapName}.tmp`);
    await masterDb.backup(path.dirname(tmpPath));
    const created = readdirSync(snapDir).find((n) => n.startsWith("gnosys-backup-") && n.endsWith(".db"));
    if (created) {
      renameSync(path.join(snapDir, created), tmpPath);
    }
    if (existsSync(tmpPath)) {
      renameSync(tmpPath, finalPath);
    }

    const checksum = sha256File(finalPath);
    const sizeBytes = statSync(finalPath).size;
    const publishedAt = new Date().toISOString();
    const fileManifest: SnapshotManifestFile = {
      epoch: marker.epoch,
      seq: nextSeq,
      snapshotFile: snapName,
      publishedAt,
      checksum,
      sizeBytes,
    };

    writeManifestFile(masterPath, fileManifest);
    masterDb.publishSnapshotManifest({
      epoch: marker.epoch,
      seq: nextSeq,
      snapshotPath: finalPath,
      publishedAt,
      checksum,
      sizeBytes,
      heartbeatAt: publishedAt,
    });

    const keep = new Set(
      readdirSync(snapDir)
        .filter((n) => n.endsWith(".db"))
        .sort()
        .slice(-SNAPSHOT_RETENTION),
    );
    gcOldSnapshots(masterPath, keep);
    masterDb.close();
    return fileManifest;
  } finally {
    release();
  }
}

export function compareSnapshotVersion(
  accepted: { epoch: number; seq: number } | null,
  incoming: { epoch: number; seq: number },
): boolean {
  if (!accepted) return true;
  if (incoming.epoch > accepted.epoch) return true;
  if (incoming.epoch === accepted.epoch && incoming.seq > accepted.seq) return true;
  return false;
}

/** Copy master snapshot to local client store atomically. */
export function acceptClientSnapshot(
  masterPath: string,
  manifest: SnapshotManifestFile,
): { ok: boolean; localPath?: string; reason?: string } {
  const src = path.join(masterSnapshotsDir(masterPath), manifest.snapshotFile);
  if (!existsSync(src)) {
    return { ok: false, reason: "snapshot file missing on master" };
  }
  const localChecksum = sha256File(src);
  if (localChecksum !== manifest.checksum) {
    return { ok: false, reason: "snapshot checksum mismatch" };
  }

  const store = clientSnapshotStore(masterPath);
  mkdirSync(store, { recursive: true });
  const tmp = path.join(store, ".gnosys.db.tmp");
  const current = path.join(store, "gnosys.db");
  copyFileSync(src, tmp);
  const roundTrip = sha256File(tmp);
  if (roundTrip !== manifest.checksum) {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
    return { ok: false, reason: "local copy verification failed" };
  }
  renameSync(tmp, current);
  const metaPath = path.join(store, "accepted-manifest.json");
  atomicWriteFileSync(metaPath, JSON.stringify(manifest, null, 2) + "\n");
  return { ok: true, localPath: current };
}

export function getClientAcceptedManifest(masterPath: string): SnapshotManifestFile | null {
  const metaPath = path.join(clientSnapshotStore(masterPath), "accepted-manifest.json");
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as SnapshotManifestFile;
  } catch {
    return null;
  }
}

export function formatSnapshotAge(publishedAt: string): string {
  const ms = Date.now() - new Date(publishedAt).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  return `${minutes} minutes ago`;
}
