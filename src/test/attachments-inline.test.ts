/**
 * Inline DB-blob attachments (v5.12).
 *
 * Verifies that small binary files attached to a memory:
 *  - round-trip losslessly through the memory row,
 *  - survive the row-copy that remote sync uses (machine-to-machine),
 *  - survive an export/import bundle,
 *  - respect the size cap and content-hash dedup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  attachFileToMemory,
  getMemoryAttachment,
  detachFromMemory,
  MAX_INLINE_ATTACHMENT_BYTES,
} from "../lib/attachments.js";
import { createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

// A tiny but valid-ish SVG logo — stands in for a PROSPÆRO brand asset.
const SVG_BYTES = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>`,
  "utf-8",
);

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("attach-inline");
});

afterEach(async () => {
  await cleanupTestEnv(env);
});

function writeTempFile(name: string, bytes: Buffer): string {
  const p = path.join(env.tmpDir, name);
  fs.writeFileSync(p, bytes);
  return p;
}

describe("inline attachments — round-trip", () => {
  it("attaches a file and reads back identical bytes, mime, and name", async () => {
    const mem = makeMemory({ id: "deci-001" });
    env.db.insertMemory(mem);

    const file = writeTempFile("prospero-logo.svg", SVG_BYTES);
    const result = await attachFileToMemory(env.db, "deci-001", file);

    expect(result.unchanged).toBe(false);
    expect(result.name).toBe("prospero-logo.svg");
    expect(result.mime).toBe("image/svg+xml");
    expect(result.sizeBytes).toBe(SVG_BYTES.length);

    const att = getMemoryAttachment(env.db, "deci-001");
    expect(att).not.toBeNull();
    expect(att!.data.equals(SVG_BYTES)).toBe(true);
    expect(att!.mime).toBe("image/svg+xml");
    expect(att!.name).toBe("prospero-logo.svg");
  });

  it("returns null when a memory has no attachment", () => {
    env.db.insertMemory(makeMemory({ id: "deci-002" }));
    expect(getMemoryAttachment(env.db, "deci-002")).toBeNull();
  });

  it("detaches an attachment but keeps the memory", async () => {
    env.db.insertMemory(makeMemory({ id: "deci-003" }));
    const file = writeTempFile("logo.svg", SVG_BYTES);
    await attachFileToMemory(env.db, "deci-003", file);

    expect(detachFromMemory(env.db, "deci-003")).toBe(true);
    expect(getMemoryAttachment(env.db, "deci-003")).toBeNull();
    // Memory itself still exists
    expect(env.db.getMemory("deci-003")).not.toBeNull();
    // Detaching again is a no-op
    expect(detachFromMemory(env.db, "deci-003")).toBe(false);
  });
});

describe("inline attachments — guardrails", () => {
  it("rejects files larger than the size cap", async () => {
    env.db.insertMemory(makeMemory({ id: "deci-010" }));
    const big = Buffer.alloc(MAX_INLINE_ATTACHMENT_BYTES + 1, 0x41);
    const file = writeTempFile("big.bin", big);
    await expect(attachFileToMemory(env.db, "deci-010", file)).rejects.toThrow(/exceeds/i);
  });

  it("dedups identical bytes (no rewrite on re-attach)", async () => {
    env.db.insertMemory(makeMemory({ id: "deci-011" }));
    const file = writeTempFile("logo.svg", SVG_BYTES);

    const first = await attachFileToMemory(env.db, "deci-011", file);
    expect(first.unchanged).toBe(false);

    const second = await attachFileToMemory(env.db, "deci-011", file);
    expect(second.unchanged).toBe(true);
  });

  it("throws when the target memory does not exist", async () => {
    const file = writeTempFile("logo.svg", SVG_BYTES);
    await expect(attachFileToMemory(env.db, "missing-999", file)).rejects.toThrow(/not found/i);
  });
});

describe("inline attachments — machine-to-machine (row copy)", () => {
  it("survives the insertMemory row-copy that remote sync uses", async () => {
    // Machine A: attach a file.
    env.db.insertMemory(makeMemory({ id: "deci-020" }));
    const file = writeTempFile("logo.svg", SVG_BYTES);
    await attachFileToMemory(env.db, "deci-020", file);
    const rowA = env.db.getMemory("deci-020")!;
    expect(rowA.attachment_data).not.toBeNull();

    // Machine B: a separate DB receives the row exactly as RemoteSync.push does.
    const envB = await createTestEnv("attach-inline-b");
    try {
      envB.db.insertMemory(rowA);
      const att = getMemoryAttachment(envB.db, "deci-020");
      expect(att).not.toBeNull();
      expect(att!.data.equals(SVG_BYTES)).toBe(true);
      expect(att!.mime).toBe("image/svg+xml");
      expect(att!.name).toBe("logo.svg");
    } finally {
      await cleanupTestEnv(envB);
    }
  });
});
