/**
 * CLI handlers for inline DB-blob attachments (v5.12).
 *
 *   gnosys attach <file> --memory <id>      store bytes inline on a memory
 *   gnosys get-attachment <id> [--out path] retrieve the stored bytes
 *
 * Inline attachments live in the memory row, so they ride the normal sync
 * rail to other machines and a remote/dockerized server.
 */

import { GnosysDB } from "./db.js";

export interface AttachCommandOptions {
  memory: string;
}

export async function runAttachCommand(filePath: string, opts: AttachCommandOptions): Promise<void> {
  const db = GnosysDB.openCentral();
  try {
    if (!db.isAvailable()) {
      console.error("Database not available.");
      process.exitCode = 1;
      return;
    }
    const { attachFileToMemory } = await import("./attachments.js");
    const result = await attachFileToMemory(db, opts.memory, filePath);
    const sizeKb = (result.sizeBytes / 1024).toFixed(1);
    const verb = result.unchanged ? "Already attached (no change)" : "Attached";
    console.log(`${verb}: ${result.name} (${result.mime}, ${sizeKb} KB) → ${opts.memory}`);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

export interface GetAttachmentCommandOptions {
  out?: string;
}

export async function runGetAttachmentCommand(
  memoryId: string,
  opts: GetAttachmentCommandOptions,
): Promise<void> {
  const db = GnosysDB.openCentral();
  try {
    if (!db.isAvailable()) {
      console.error("Database not available.");
      process.exitCode = 1;
      return;
    }
    const { getMemoryAttachment } = await import("./attachments.js");
    const att = getMemoryAttachment(db, memoryId);
    if (!att) {
      console.error(`No attachment found on memory: ${memoryId}`);
      process.exitCode = 1;
      return;
    }

    if (opts.out) {
      const { writeFile } = await import("fs/promises");
      await writeFile(opts.out, att.data);
      console.log(`Wrote ${att.name} (${att.mime}, ${att.data.length} bytes) to ${opts.out}`);
    } else {
      // No output path: print metadata + base64 so it can be piped/redirected.
      console.error(`${att.name} (${att.mime}, ${att.data.length} bytes)`);
      console.log(att.data.toString("base64"));
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
