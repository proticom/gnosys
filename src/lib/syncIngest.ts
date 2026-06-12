/**
 * v13 master ingest sweep — process staged JSON into gnosys.db.
 */

import { existsSync, readdirSync, unlinkSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { GnosysDB, fnv1a } from "./db.js";
import { getGnosysHome } from "./paths.js";
import { ensureMachineConfig } from "./machineConfig.js";
import {
  listPendingStagingQueue,
  observeStagingFile,
  parseStagedFile,
  quarantineStagingFile,
  quarantineStaleTmpFiles,
  stagingRoot,
  verifyMemoryExistsInDb,
  type StagedMemoryPayload,
} from "./syncStaging.js";
import {
  assertMasterLeaseHeld,
  readMasterMarker,
  touchMasterMarkerHeartbeat,
  validateLeaseEpochBeforeWrite,
} from "./masterLease.js";
import { acquireWriteLockSync, } from "./syncLock.js";

const INGEST_LOCK_NAME = "master-ingest.lock";

export interface IngestSweepResult {
  ingested: number;
  skipped: number;
  quarantined: number;
  errors: string[];
}

export interface IngestSweepOptions {
  /** Suppress stdout (for timer / background contexts). */
  quiet?: boolean;
  /** Write a single JSON object to stdout with the sweep result. */
  json?: boolean;
}

function payloadToMemory(p: StagedMemoryPayload, now: string) {
  const contentHash = fnv1a(`${p.title}\n${p.content}`);
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    content: p.content,
    summary: null as string | null,
    tags: JSON.stringify(p.tags),
    relevance: "",
    author: "user",
    authority: "user",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: contentHash,
    status: "active",
    tier: "active",
    supersedes: null as string | null,
    superseded_by: null as string | null,
    last_reinforced: null as string | null,
    created: p.writtenAt || now,
    modified: now,
    source_path: null as string | null,
    project_id: p.project_id,
    scope: p.scope || "project",
  };
}

function writeIngestReceipt(
  masterPath: string,
  machineId: string,
  ulid: string,
  outcome: "ingested" | "deduped",
): void {
  const dir = path.join(stagingRoot(masterPath), machineId, "receipts");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${ulid}.json`),
    JSON.stringify({ ulid, outcome, at: new Date().toISOString() }, null, 2) + "\n",
  );
}

function listMachineIds(masterPath: string): string[] {
  const root = stagingRoot(masterPath);
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((name) => {
    if (name.startsWith(".")) return false;
    try {
      return existsSync(path.join(root, name));
    } catch {
      return false;
    }
  });
}

/**
 * Always-on cheap ingest sweep (agent start + timer). Single-writer lock on local disk.
 */
export function runMasterIngestSweep(
  masterPath: string,
  opts?: IngestSweepOptions,
): IngestSweepResult {
  const result: IngestSweepResult = { ingested: 0, skipped: 0, quarantined: 0, errors: [] };
  const { config: mc } = ensureMachineConfig();
  const lockPath = path.join(getGnosysHome(), INGEST_LOCK_NAME);
  let release: (() => void) | null = null;
  try {
    release = acquireWriteLockSync(lockPath, "master-ingest");
    touchMasterMarkerHeartbeat(masterPath);
    assertMasterLeaseHeld(masterPath, mc.machineId);
    const marker = readMasterMarker(masterPath);
    if (!marker) {
      result.errors.push("master.json missing");
      return result;
    }

    const masterDb = new GnosysDB(masterPath);
    if (!masterDb.isAvailable()) {
      result.errors.push("master database unavailable");
      masterDb.close();
      return result;
    }

    try {
      for (const machineId of listMachineIds(masterPath)) {
        quarantineStaleTmpFiles(masterPath, machineId);
        const queue = listPendingStagingQueue(masterPath, machineId, masterDb);
        for (const entry of queue) {
          observeStagingFile(masterDb, machineId, entry.fileName, entry.memoryUlid);
          const parsed = parseStagedFile(entry.filePath);
          if (!parsed.ok) {
            if (parsed.quarantine) {
              quarantineStagingFile(entry.filePath, masterPath, machineId);
              result.quarantined++;
            } else {
              result.errors.push(parsed.reason);
            }
            continue;
          }
          if (masterDb.isUlidProcessed(parsed.payload.id)) {
            try {
              unlinkSync(entry.filePath);
            } catch {
              // ignore
            }
            writeIngestReceipt(masterPath, machineId, parsed.payload.id, "deduped");
            result.skipped++;
            continue;
          }
          try {
            validateLeaseEpochBeforeWrite(masterPath, marker.epoch, mc.machineId);
            const now = new Date().toISOString();
            masterDb.insertMemory(payloadToMemory(parsed.payload, now));
            if (!verifyMemoryExistsInDb(masterDb, parsed.payload.id)) {
              result.errors.push(`read-back failed for ${parsed.payload.id}`);
              continue;
            }
            masterDb.markUlidProcessed(parsed.payload.id, marker.epoch);
            masterDb.recordStagingLedgerEntry({
              stagingKey: `${machineId}/${entry.fileName}`,
              machineId,
              memoryUlid: parsed.payload.id,
              firstSeenAt: masterDb.getStagingLedgerFirstSeenAt(`${machineId}/${entry.fileName}`) ?? now,
              ingestEpoch: marker.epoch,
              status: "ingested",
            });
            unlinkSync(entry.filePath);
            writeIngestReceipt(masterPath, machineId, parsed.payload.id, "ingested");
            result.ingested++;
          } catch (err) {
            result.errors.push(err instanceof Error ? err.message : String(err));
          }
        }
      }
    } finally {
      masterDb.close();
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    release?.();
  }

  if (opts?.json) {
    console.log(JSON.stringify(result));
  }

  return result;
}

/**
 * v13 completion (5.12.x): sweep, then publish a fresh immutable snapshot
 * when the sweep changed the DB (or none has ever been published). Clients
 * read the published snapshot via a verified local copy instead of opening
 * the live gnosys.db over the network — the hazard the design forbids.
 *
 * Kept separate from runMasterIngestSweep: publishMasterSnapshot acquires
 * the same master-ingest lock, so it must run after the sweep releases it,
 * and the sweep itself stays synchronous for existing callers.
 */
export async function runMasterIngestSweepAndPublish(
  masterPath: string,
  opts?: IngestSweepOptions,
): Promise<IngestSweepResult> {
  const result = runMasterIngestSweep(masterPath, opts);
  try {
    const { getMasterManifest, publishMasterSnapshot } = await import("./syncSnapshot.js");
    if (result.ingested > 0 || !getMasterManifest(masterPath)) {
      await publishMasterSnapshot(masterPath);
    }
  } catch (err) {
    result.errors.push(`snapshot publish: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}
