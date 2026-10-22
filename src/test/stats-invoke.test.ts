// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runStatsCommand } from "../lib/statsCommand.js";
import { makeMemory, makeProject } from "./_helpers.js";

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

  it("reports lexical lastTouch for project, user, and global rows", async () => {
    const db = GnosysDB.openLocal();
    db.insertProject(makeProject({ id: "project-last-touch", name: "Last Touch Project" }));
    db.insertProject(makeProject({ id: "project-empty", name: "Empty Project" }));
    db.insertMemory(makeMemory({ id: "proj-old", project_id: "project-last-touch", scope: "project", modified: "2026-03-01T09:00:00Z" }));
    db.insertMemory(makeMemory({ id: "proj-new", project_id: "project-last-touch", scope: "project", modified: "2026-03-01T10:00:00Z" }));
    db.insertMemory(makeMemory({ id: "user-last", project_id: null, scope: "user", modified: "2099-03-02T10:00:00Z" }));
    db.insertMemory(makeMemory({ id: "global-last", project_id: null, scope: "global", modified: "2099-03-03T10:00:00Z" }));
    db.close();

    await runStatsCommand({ byProject: true, json: true });
    const rows = JSON.parse(logged()).rows as Array<{ name: string; lastTouch: string }>;
    expect(rows.find((row) => row.name === "Last Touch Project")?.lastTouch).toBe("2026-03-01T10:00:00Z");
    expect(rows.find((row) => row.name === "(user)")?.lastTouch).toBe("2099-03-02T10:00:00Z");
    expect(rows.find((row) => row.name === "(global)")?.lastTouch).toBe("2099-03-03T10:00:00Z");
    expect(rows.find((row) => row.name === "Empty Project")?.lastTouch).toBe("0");
  });

  it("documents current lexical lastTouch behavior instead of chronological order", async () => {
    const db = GnosysDB.openLocal();
    db.insertProject(makeProject({ id: "project-lexical", name: "Lexical Project" }));
    db.insertMemory(makeMemory({ id: "fractional", project_id: "project-lexical", scope: "project", modified: "2026-03-01T10:00:00.500Z" }));
    db.insertMemory(makeMemory({ id: "whole-second", project_id: "project-lexical", scope: "project", modified: "2026-03-01T10:00:00Z" }));
    db.close();

    await runStatsCommand({ byProject: true, json: true });
    const rows = JSON.parse(logged()).rows as Array<{ name: string; lastTouch: string }>;
    expect(rows.find((row) => row.name === "Lexical Project")?.lastTouch).toBe("2026-03-01T10:00:00Z");
  });
});
