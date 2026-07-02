// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runListCommand } from "../lib/listCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-list-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
  const db = GnosysDB.openLocal();
  const now = new Date().toISOString();
  db.insertMemory({
    id: "deci-501",
    title: "List invoke fixture",
    category: "decisions",
    content: "List content",
    summary: null,
    tags: '["list-invoke-tag"]',
    relevance: "list invoke",
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "hash-deci-501",
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

describe("runListCommand (in-process invoke)", () => {
  it("lists the seeded user-scope memory (--json)", async () => {
    await runListCommand({ json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.memories.some((m: { id: string }) => m.id === "deci-501")).toBe(true);
  });

  it("filters by tag (--tag, --json)", async () => {
    await runListCommand({ json: true, tag: "list-invoke-tag" });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(1);
    expect(parsed.memories[0].id).toBe("deci-501");
  });

  it("returns an empty set for a category with no matches (--json)", async () => {
    await runListCommand({ json: true, category: "no-such-category" });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(0);
    expect(parsed.memories).toEqual([]);
  });

  it("renders human output with scope/status markers", async () => {
    await runListCommand({});
    const out = logged();
    expect(out).toContain("[user] [active] List invoke fixture");
  });
});
