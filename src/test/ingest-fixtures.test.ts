import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestFile } from "../lib/multimodalIngest.js";
import { GnosysStore } from "../lib/store.js";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures", "ingest");
let workDir: string;
let storePath: string;

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), "gnosys-ingest-fix-"));
  storePath = join(workDir, ".gnosys");
  mkdirSync(storePath, { recursive: true });
  await new GnosysStore(storePath).init();
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(workDir, { recursive: true, force: true });
});
const ingest = (filePath: string) => ingestFile({ filePath, storePath, mode: "structured", dryRun: true });

describe("ingest adversarial fixtures", () => {
  it("normal PDF ingests without crashing", async () => {
    expect(await ingest(join(FIXTURES, "normal.pdf"))).toMatchObject({
      fileType: "pdf", errors: [],
      memories: [{ id: "dry-run-0", title: "Hello PDF", path: "imported/hello-pdf.md", page: "1" }],
    });
  });

  it("0-byte text file is handled gracefully", async () => {
    const filePath = join(workDir, "empty.txt");
    writeFileSync(filePath, "");
    expect(await ingest(filePath)).toMatchObject({
      fileType: "text", memories: [],
      errors: [{ chunk: 0, error: "No text content could be extracted from the file." }],
    });
  });

  it("UTF-8 BOM text file is handled gracefully", async () => {
    const filePath = join(workDir, "bom.txt");
    writeFileSync(filePath, "\uFEFFHello with BOM", "utf-8");
    expect(await ingest(filePath)).toMatchObject({
      fileType: "text", errors: [],
      memories: [{ id: "dry-run-0", title: "Hello with BOM", path: "imported/hello-with-bom.md" }],
    });
  });

  it("oversized text file hits size cap (no OOM)", async () => {
    const filePath = join(workDir, "huge.txt");
    const fd = openSync(filePath, "w");
    try { writeFileSync(fd, Buffer.alloc(100 * 1024 * 1024 + 1, 97)); }
    finally { closeSync(fd); }
    await expect(ingest(filePath)).rejects.toThrow("exceeds the 100MB limit");
  }, 60_000);

  it("corrupt DOCX returns a clear error", async () => {
    const filePath = join(workDir, "bad.docx");
    writeFileSync(filePath, "PK\x03\x04this is not a real docx file");
    await expect(ingest(filePath)).rejects.toThrow("Corrupted zip: can't find end of central directory");
  });

  it("non-existent path throws a clear error", async () => {
    await expect(ingest(join(workDir, "does-not-exist.txt"))).rejects.toThrow(/ENOENT|no such file/i);
  });

  it("PDF with embedded JS is handled without executing JS", async () => {
    const alert = vi.fn();
    vi.stubGlobal("app", { alert });
    expect(await ingest(join(FIXTURES, "js-embedded.pdf"))).toMatchObject({
      fileType: "pdf", errors: [],
      memories: [{ id: "dry-run-0", title: "JS PDF", path: "imported/js-pdf.md", page: "1" }],
    });
    expect(alert).not.toHaveBeenCalled();
  });

  it("encrypted PDF returns a clear password error", async () => {
    await expect(ingest(join(FIXTURES, "encrypted.pdf"))).rejects.toThrow(/password/i);
  });
});
