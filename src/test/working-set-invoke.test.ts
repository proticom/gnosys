// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runWorkingSetCommand } from "../lib/workingSetCommand.js";

let base: string;
let projectDir: string;
const projectId = "22222222-2222-4222-8222-222222222222";
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-working-set-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";

  // Project identity file so detectCurrentProject(directory) resolves.
  projectDir = join(base, "project");
  mkdirSync(join(projectDir, ".gnosys"), { recursive: true });
  writeFileSync(
    join(projectDir, ".gnosys", "gnosys.json"),
    JSON.stringify({
      projectId,
      projectName: "working-set-invoke",
      workingDirectory: projectDir,
      user: "tester",
      agentRulesTarget: null,
      obsidianVault: null,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    }),
  );

  const db = GnosysDB.openLocal();
  const now = new Date().toISOString();
  db.insertMemory({
    id: "deci-951",
    title: "Working set fixture",
    category: "decisions",
    content: "Recently modified project memory",
    summary: null,
    tags: '["test"]',
    relevance: "working set invoke",
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "hash-deci-951",
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
    project_id: projectId,
    scope: "project",
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

describe("runWorkingSetCommand (in-process invoke)", () => {
  it("returns the recently modified project memory (--json)", async () => {
    await runWorkingSetCommand({ directory: projectDir, window: "24", json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.projectId).toBe(projectId);
    expect(parsed.count).toBe(1);
    expect(parsed.memories[0].id).toBe("deci-951");
  });

  it("returns an empty working set for a zero-hour window (--json)", async () => {
    await runWorkingSetCommand({ directory: projectDir, window: "0", json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(0);
  });
});
