/**
 * v13 hardened JSON staging for multi-machine sync.
 *
 * Clients write small JSON files under master-folder/.gnosys-staging/<machineId>/.
 * Master ingest walks files ordered by ledger firstSeenAt (see GnosysDB.sync_staging_ledger).
 */

import { createHash, randomBytes } from "crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "fs";
import path from "path";
import { atomicWriteFileSync } from "./atomicWrite.js";
import type { GnosysDB } from "./db.js";

/** Current staged-memory JSON schema version. */
export const STAGING_SCHEMA_VERSION = 1;

export const KNOWN_STAGING_SCHEMA_VERSIONS = new Set([STAGING_SCHEMA_VERSION]);

export const UNKNOWN_SCHEMA_MESSAGE =
  "Update your master machine to a newer version of Gnosys.";

const STAGING_DIR = ".gnosys-staging";
const FAILED_DIR = "failed";
const PRESENCE_FILE = ".presence.json";

export interface StagedMemoryPayload {
  schemaVersion: number;
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  project_id: string | null;
  scope: string;
  machineId: string;
  writtenAt: string;
  checksum: string;
}

export type StagedFileParseResult =
  | { ok: true; payload: StagedMemoryPayload; filePath: string }
  | { ok: false; filePath: string; reason: string; quarantine: boolean };

export function stagingRoot(masterPath: string): string {
  return path.join(masterPath, STAGING_DIR);
}

export function machineStagingDir(masterPath: string, machineId: string): string {
  return path.join(stagingRoot(masterPath), machineId);
}

export function clientPresencePath(masterPath: string, machineId: string): string {
  return path.join(machineStagingDir(masterPath, machineId), PRESENCE_FILE);
}

export function failedQuarantineDir(masterPath: string, machineId: string): string {
  return path.join(machineStagingDir(masterPath, machineId), FAILED_DIR);
}

export function buildStagingFileName(memoryUlid: string, unixMs: number = Date.now()): string {
  return `${unixMs}-${memoryUlid}.json`;
}

/** SHA-256 of canonical JSON body (all fields except checksum). */
export function stagingPayloadChecksum(body: Omit<StagedMemoryPayload, "checksum">): string {
  const canonical = JSON.stringify({
    schemaVersion: body.schemaVersion,
    id: body.id,
    title: body.title,
    category: body.category,
    content: body.content,
    tags: body.tags,
    project_id: body.project_id,
    scope: body.scope,
    machineId: body.machineId,
    writtenAt: body.writtenAt,
  });
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

export function buildStagedMemoryPayload(input: {
  id: string;
  title: string;
  category: string;
  content: string;
  machineId: string;
  tags?: string[];
  project_id?: string | null;
  scope?: string;
  writtenAt?: string;
  schemaVersion?: number;
}): StagedMemoryPayload {
  const bodyWithoutChecksum = {
    schemaVersion: input.schemaVersion ?? STAGING_SCHEMA_VERSION,
    id: input.id,
    title: input.title,
    category: input.category,
    content: input.content,
    tags: input.tags ?? [],
    project_id: input.project_id ?? null,
    scope: input.scope ?? "project",
    machineId: input.machineId,
    writtenAt: input.writtenAt ?? new Date().toISOString(),
  };
  return {
    ...bodyWithoutChecksum,
    checksum: stagingPayloadChecksum(bodyWithoutChecksum),
  };
}

/**
 * Atomically write a staged memory JSON file (`.tmp` in the same directory, then rename).
 * Returns the final file path relative to the machine staging dir.
 */
export function writeStagedMemoryFile(
  masterPath: string,
  machineId: string,
  payload: StagedMemoryPayload,
): string {
  const dir = machineStagingDir(masterPath, machineId);
  mkdirSync(dir, { recursive: true });
  const fileName = buildStagingFileName(payload.id);
  const dest = path.join(dir, fileName);
  const tmp = path.join(dir, `.${fileName}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
  const data = JSON.stringify(payload, null, 2) + "\n";
  try {
    atomicWriteFileSync(tmp, data);
    // read-back verify before rename (catches torn/partial writes on share)
    const roundTrip = readFileSync(tmp, "utf-8");
    const parsed = parseStagedFileContent(roundTrip, dest);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    renameSync(tmp, dest);
    return fileName;
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw err;
  }
}

function parseStagedFileContent(raw: string, filePath: string): StagedFileParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, filePath, reason: "invalid JSON", quarantine: true };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, filePath, reason: "payload is not an object", quarantine: true };
  }
  const o = json as Record<string, unknown>;
  const schemaVersion = typeof o.schemaVersion === "number" ? o.schemaVersion : -1;
  if (!KNOWN_STAGING_SCHEMA_VERSIONS.has(schemaVersion)) {
    return {
      ok: false,
      filePath,
      reason: UNKNOWN_SCHEMA_MESSAGE,
      quarantine: true,
    };
  }
  const id = typeof o.id === "string" ? o.id : "";
  const checksum = typeof o.checksum === "string" ? o.checksum : "";
  const payload: StagedMemoryPayload = {
    schemaVersion,
    id,
    title: String(o.title ?? ""),
    category: String(o.category ?? ""),
    content: String(o.content ?? ""),
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
    project_id: typeof o.project_id === "string" ? o.project_id : null,
    scope: typeof o.scope === "string" ? o.scope : "project",
    machineId: String(o.machineId ?? ""),
    writtenAt: String(o.writtenAt ?? ""),
    checksum,
  };
  const expected = stagingPayloadChecksum(payload);
  if (!checksum || expected !== checksum) {
    return { ok: false, filePath, reason: "checksum mismatch", quarantine: true };
  }
  if (!id) {
    return { ok: false, filePath, reason: "missing memory id (ULID)", quarantine: true };
  }
  return { ok: true, payload, filePath };
}

export function parseStagedFile(filePath: string): StagedFileParseResult {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return parseStagedFileContent(raw, filePath);
  } catch (err) {
    return {
      ok: false,
      filePath,
      reason: err instanceof Error ? err.message : String(err),
      quarantine: true,
    };
  }
}

/** Move a bad staging file into machineId/failed/ (does not delete). */
export function quarantineStagingFile(
  filePath: string,
  masterPath: string,
  machineId: string,
): string {
  const failedDir = failedQuarantineDir(masterPath, machineId);
  mkdirSync(failedDir, { recursive: true });
  const base = path.basename(filePath);
  const dest = path.join(failedDir, base);
  if (existsSync(dest)) {
    const stamped = `${Date.now()}-${base}`;
    renameSync(filePath, path.join(failedDir, stamped));
    return path.join(failedDir, stamped);
  }
  renameSync(filePath, dest);
  return dest;
}

/** Move stale `.tmp` files in a machine staging dir into `failed/`. */
export function quarantineStaleTmpFiles(masterPath: string, machineId: string): number {
  const dir = machineStagingDir(masterPath, machineId);
  if (!existsSync(dir)) return 0;
  let moved = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".tmp")) continue;
    quarantineStagingFile(path.join(dir, name), masterPath, machineId);
    moved++;
  }
  return moved;
}

export function countFailedStagingFiles(masterPath: string, machineId: string): number {
  const failedDir = failedQuarantineDir(masterPath, machineId);
  if (!existsSync(failedDir)) return 0;
  try {
    return readdirSync(failedDir).filter((n) => n.endsWith(".json") || n.endsWith(".tmp")).length;
  } catch {
    return 0;
  }
}

export interface StagingQueueEntry {
  filePath: string;
  fileName: string;
  memoryUlid: string;
  sortKey: string;
}

/**
 * List pending `.json` staging files for a machine (excludes failed/, tmp, presence).
 * Sort by ledger firstSeenAt when db is provided, else by filename timestamp prefix.
 */
export function listPendingStagingQueue(
  masterPath: string,
  machineId: string,
  masterDb?: GnosysDB,
): StagingQueueEntry[] {
  const dir = machineStagingDir(masterPath, machineId);
  if (!existsSync(dir)) return [];
  const entries: StagingQueueEntry[] = [];
  for (const name of readdirSync(dir)) {
    if (name === FAILED_DIR || name === PRESENCE_FILE || name.endsWith(".tmp")) continue;
    if (!name.endsWith(".json")) continue;
    const filePath = path.join(dir, name);
    const ulid = name.replace(/^\d+-/, "").replace(/\.json$/, "");
    const stagingKey = `${machineId}/${name}`;
    const firstSeen =
      masterDb?.isAvailable() ? masterDb.getStagingLedgerFirstSeenAt(stagingKey) : null;
    const sortKey = firstSeen ? `${firstSeen}\0${name}` : name;
    entries.push({ filePath, fileName: name, memoryUlid: ulid, sortKey });
  }
  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return entries;
}

/** Master read-back: memory row exists after ingest before deleting staging file. */
export function verifyMemoryExistsInDb(db: GnosysDB, memoryUlid: string): boolean {
  if (!db.isAvailable()) return false;
  return db.getMemory(memoryUlid) !== null;
}

/** Record first observation in the master ledger (idempotent upsert without clobbering status). */
export function observeStagingFile(
  masterDb: GnosysDB,
  machineId: string,
  fileName: string,
  memoryUlid: string | null,
): void {
  const stagingKey = `${machineId}/${fileName}`;
  masterDb.recordStagingLedgerEntry({
    stagingKey,
    machineId,
    memoryUlid,
    firstSeenAt: new Date().toISOString(),
  });
}
