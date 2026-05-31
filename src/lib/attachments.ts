/**
 * Gnosys Attachments — File attachment management for multimodal ingestion.
 *
 * Two storage modes:
 *  - Filesystem (legacy, large media): bytes copied to .gnosys/attachments/<uuid>.<ext>
 *    with a JSON manifest. Does NOT travel between machines.
 *  - Inline DB blob (v5.12, small assets): bytes stored in the memory row's
 *    attachment_data column. Travels over the same row-copy sync rail as
 *    embeddings, so it works single-machine, multi-machine, and with a future
 *    dockerized MCP without any shared volume.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import type { GnosysDB } from "./db.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AttachmentRecord {
  uuid: string;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  createdAt: string;
  memoryIds: string[];
}

interface AttachmentManifest {
  attachments: AttachmentRecord[];
}

// ─── MIME type lookup from extension ────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  // Documents
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
  // Video
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
};

function mimeFromExtension(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
}

/** Infer a MIME type from a file path's extension. */
export function inferMimeType(filePath: string): string {
  return mimeFromExtension(path.extname(filePath).slice(1));
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getAttachmentsDir(storePath: string): string {
  return path.join(storePath, "attachments");
}

function getManifestPath(storePath: string): string {
  return path.join(getAttachmentsDir(storePath), "attachments.json");
}

async function readManifest(storePath: string): Promise<AttachmentManifest> {
  const manifestPath = getManifestPath(storePath);
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(raw) as AttachmentManifest;
  } catch {
    return { attachments: [] };
  }
}

async function writeManifest(storePath: string, manifest: AttachmentManifest): Promise<void> {
  const manifestPath = getManifestPath(storePath);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

/**
 * Compute SHA-256 hash of a file's contents.
 */
async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Initialize the attachments directory and manifest in a store.
 * Safe to call multiple times — creates only if missing.
 */
export async function initAttachments(storePath: string): Promise<void> {
  const dir = getAttachmentsDir(storePath);
  await fs.mkdir(dir, { recursive: true });

  const manifestPath = getManifestPath(storePath);
  try {
    await fs.access(manifestPath);
  } catch {
    // Manifest doesn't exist — create empty one
    await writeManifest(storePath, { attachments: [] });
  }
}

/**
 * Copy a file into .gnosys/attachments/<uuid>.<ext> and register it in the manifest.
 * Returns the attachment record with metadata.
 *
 * If a file with the same content hash already exists, returns the existing record
 * instead of creating a duplicate.
 */
export async function storeAttachment(
  storePath: string,
  filePath: string
): Promise<AttachmentRecord> {
  // Make sure attachments dir exists
  await initAttachments(storePath);

  // Get file info
  const stat = await fs.stat(filePath);
  const originalName = path.basename(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase() || "bin";
  const contentHash = await hashFile(filePath);

  // Check for duplicate by content hash
  const manifest = await readManifest(storePath);
  const existing = manifest.attachments.find((a) => a.contentHash === contentHash);
  if (existing) {
    return existing;
  }

  // Generate UUID and copy file
  const uuid = crypto.randomUUID();
  const destPath = path.join(getAttachmentsDir(storePath), `${uuid}.${ext}`);
  await fs.copyFile(filePath, destPath);

  // Create record
  const record: AttachmentRecord = {
    uuid,
    originalName,
    extension: ext,
    mimeType: mimeFromExtension(ext),
    sizeBytes: stat.size,
    contentHash,
    createdAt: new Date().toISOString(),
    memoryIds: [],
  };

  // Update manifest
  manifest.attachments.push(record);
  await writeManifest(storePath, manifest);

  return record;
}

/**
 * Read and return all attachment records from the manifest.
 */
export async function listAttachments(storePath: string): Promise<AttachmentRecord[]> {
  const manifest = await readManifest(storePath);
  return manifest.attachments;
}

/**
 * Get the full filesystem path for an attachment.
 */
export function getAttachmentPath(storePath: string, uuid: string, ext: string): string {
  return path.join(getAttachmentsDir(storePath), `${uuid}.${ext}`);
}

/**
 * Link a memory ID to an attachment. Updates the manifest so the attachment
 * tracks which memories reference it.
 */
export async function linkMemoryToAttachment(
  storePath: string,
  uuid: string,
  memoryId: string
): Promise<void> {
  const manifest = await readManifest(storePath);
  const record = manifest.attachments.find((a) => a.uuid === uuid);
  if (!record) {
    throw new Error(`Attachment not found: ${uuid}`);
  }

  if (!record.memoryIds.includes(memoryId)) {
    record.memoryIds.push(memoryId);
    await writeManifest(storePath, manifest);
  }
}

// ─── Inline DB-blob attachments (v5.12) ─────────────────────────────────
//
// Small binary assets (logos, diagrams, screenshots) are stored directly in
// the memory row's attachment_data column. Because remote sync copies whole
// rows (the same way it already moves the `embedding` blob), these attachments
// travel machine-to-machine for free and need no shared filesystem — which is
// exactly what a dockerized MCP server needs.

/**
 * Maximum size for an inline DB-blob attachment. Larger files should use the
 * filesystem path (`gnosys ingest`) so the synced central DB stays lean.
 */
export const MAX_INLINE_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export interface InlineAttachment {
  /** Raw file bytes. */
  data: Buffer;
  /** MIME type, e.g. "image/svg+xml". */
  mime: string;
  /** Original filename, e.g. "prospero-logo.svg". */
  name: string;
  /** Size in bytes. */
  sizeBytes: number;
}

export interface AttachToMemoryResult {
  memoryId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** True when the file was identical to what was already attached (no write). */
  unchanged: boolean;
}

/**
 * Read a file and store its bytes inline on a memory row (attachment_data).
 * Enforces the size cap and skips the write if the same bytes are already
 * attached (content-hash dedup). Bumps `modified` so remote sync picks it up.
 */
export async function attachFileToMemory(
  db: GnosysDB,
  memoryId: string,
  filePath: string,
): Promise<AttachToMemoryResult> {
  const mem = db.getMemory(memoryId);
  if (!mem) {
    throw new Error(`Memory not found: ${memoryId}`);
  }

  const stat = await fs.stat(filePath);
  if (stat.size > MAX_INLINE_ATTACHMENT_BYTES) {
    const limitMb = (MAX_INLINE_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File is ${sizeMb}MB, which exceeds the ${limitMb}MB inline-attachment limit. ` +
        `Use 'gnosys ingest' for large media (it stores the file on disk instead).`,
    );
  }

  const data = await fs.readFile(filePath);
  const name = path.basename(filePath);
  const mime = inferMimeType(filePath);

  // Dedup: if the same bytes are already attached, skip the write.
  if (mem.attachment_data && Buffer.from(mem.attachment_data).equals(data)) {
    return { memoryId, name, mime, sizeBytes: data.length, unchanged: true };
  }

  db.updateMemory(memoryId, {
    attachment_data: data,
    attachment_mime: mime,
    attachment_name: name,
    modified: new Date().toISOString(),
  });

  return { memoryId, name, mime, sizeBytes: data.length, unchanged: false };
}

/** Return the inline attachment stored on a memory row, or null if none. */
export function getMemoryAttachment(db: GnosysDB, memoryId: string): InlineAttachment | null {
  const mem = db.getMemory(memoryId);
  if (!mem || !mem.attachment_data) return null;
  const data = Buffer.from(mem.attachment_data);
  return {
    data,
    mime: mem.attachment_mime || "application/octet-stream",
    name: mem.attachment_name || `${memoryId}.bin`,
    sizeBytes: data.length,
  };
}

/** Remove an inline attachment from a memory row (keeps the memory itself). */
export function detachFromMemory(db: GnosysDB, memoryId: string): boolean {
  const mem = db.getMemory(memoryId);
  if (!mem || !mem.attachment_data) return false;
  db.updateMemory(memoryId, {
    attachment_data: null,
    attachment_mime: null,
    attachment_name: null,
    modified: new Date().toISOString(),
  });
  return true;
}
