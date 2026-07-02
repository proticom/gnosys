// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runStatsCommand } from "../lib/statsCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

function seedMemory(db: GnosysDB, id: string, extra: Partial<{ scope: string; category: string }> = {}) {
  const now = new Date().toISOString();
  db.insertMemory({
    id,
    title: `Memory ${id}`,
    category: extra.category ?? "decisions",
    content: `Content for ${id}`,
    summary: null,
    tags: '["test"]',
    relevance: `${id} invoke stats alpha`,
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: `hash-${id}`,
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
    scope: extra.scope ?? "user",
  });
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-stats-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
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

describe("runStatsCommand (in-process invoke)", () => {
  it("prints 'No memories found.' on an empty central DB", async () => {
    await runStatsCommand({ all: true });
    expect(logged()).toContain("No memories found.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("emits stats JSON with seeded memories (--all --json)", async () => {
    const db = GnosysDB.openLocal();
    seedMemory(db, "deci-001");
    seedMemory(db, "arch-001", { category: "architecture" });
    db.close();

    await runStatsCommand({ all: true, json: true });
    const stats = JSON.parse(logged());
    expect(stats.totalCount).toBe(2);
    expect(stats.byCategory.decisions).toBe(1);
    expect(stats.byCategory.architecture).toBe(1);
  });

  it("renders the human table with category/status/author sections", async () => {
    await runStatsCommand({ all: true });
    const out = logged();
    expect(out).toContain("Gnosys Store Statistics:");
    expect(out).toContain("By category:");
    expect(out).toContain("By status:");
    expect(out).toContain("By author:");
  });
});
