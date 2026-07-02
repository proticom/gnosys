// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runHistoryCommand } from "../lib/historyCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-history-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
  const db = GnosysDB.openLocal();
  const now = new Date().toISOString();
  db.insertMemory({
    id: "deci-301",
    title: "History invoke fixture",
    category: "decisions",
    content: "Content for history invoke test",
    summary: null,
    tags: '["test"]',
    relevance: "history invoke",
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "hash-deci-301",
    status: "active",
    tier: "active",
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: now,
    modified: now,
    embedding: null,
    source_path: null,
    source_file: null,
    source_page: null,
    source_timerange: null,
    project_id: null,
    scope: "user",
  });
  db.close();
});
afterAll(() => {
  if (origHome === undefined) delete process.env.GNOSYS_HOME;
  else process.env.GNOSYS_HOME = origHome;
  if (origLocal === undefined) delete process.env.GNOSYS_LOCAL_ONLY;
  else process.env.GNOSYS_LOCAL_ONLY = origLocal;
  rmSync(base, { recursive: true, force: true });
});
beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
});
afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
  process.exitCode = undefined;
});

describe("runHistoryCommand (in-process invoke)", () => {
  it("prints memory header and 'No audit history recorded.' for a fresh memory", async () => {
    await runHistoryCommand("deci-301", { limit: "20" });
    const out = logged();
    expect(out).toContain("History invoke fixture");
    expect(out).toContain("No audit history recorded.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("emits structured JSON with memoryId and empty entries (--json)", async () => {
    await runHistoryCommand("deci-301", { limit: "20", json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.memoryId).toBe("deci-301");
    expect(parsed.entries).toEqual([]);
  });

  it("exits with an error for a missing memory id", async () => {
    await expect(runHistoryCommand("deci-999", { limit: "20" })).rejects.toThrow(
      "process.exit(1)",
    );
    expect(errSpy.mock.calls.join("\n")).toContain("Memory not found: deci-999");
  });
});
