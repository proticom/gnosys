// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runSearchCommand } from "../lib/searchCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-search-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
  const db = GnosysDB.openLocal();
  const now = new Date().toISOString();
  db.insertMemory({
    id: "deci-701",
    title: "Search invoke fixture",
    category: "decisions",
    content: "phlogiston bicycle content for federated search invoke",
    summary: null,
    tags: '["test"]',
    relevance: "phlogiston bicycle search invoke",
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "hash-deci-701",
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

describe("runSearchCommand (in-process invoke, federated path)", () => {
  it("finds the seeded memory via --federated --json", async () => {
    await runSearchCommand("phlogiston bicycle", {
      limit: "10",
      federated: true,
      json: true,
    });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.results.some((r: { id: string }) => r.id === "deci-701")).toBe(true);
  });

  it("prints a no-results message for an unmatched federated query", async () => {
    await runSearchCommand("unmatchabletokenqqq", { limit: "10", federated: true });
    expect(logged()).toContain('No results for "unmatchabletokenqqq"');
    expect(errSpy).not.toHaveBeenCalled();
  });
});
