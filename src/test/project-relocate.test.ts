/**
 * Moved project trees (found 2026-10-13): `gnosys project relocate`,
 * `gnosys project merge`, the "moved" cleanup category, the split
 * missing / no-.gnosys labels, sync-projects skipping moved folders, and the
 * interactive cleanup re-reading the registry before it writes.
 *
 * Fixtures live under the worktree, not os.tmpdir(): cleanup classifies any
 * temp path as "temp" before it looks at the folder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync as Database, type SQLInputValue } from "node:sqlite";
import { GnosysDB } from "../lib/db.js";
import { makeMemory, makeProject, extractJson } from "./_helpers.js";

const CLI_PATH = path.resolve("dist/cli.js");
const FIXTURE_BASE = path.resolve(".test-project-relocate");

let root: string;
let home: string;
let configDir: string;

beforeEach(() => {
  fs.mkdirSync(FIXTURE_BASE, { recursive: true });
  root = fs.mkdtempSync(path.join(FIXTURE_BASE, "case-"));
  home = path.join(root, "home", ".gnosys");
  configDir = path.join(root, "config");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "machine.json"),
    JSON.stringify({ machineId: "machine-test", hostname: os.hostname(), roots: {}, remote: { enabled: false }, schemaVersion: 1 }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
  if (fs.existsSync(FIXTURE_BASE) && fs.readdirSync(FIXTURE_BASE).length === 0) fs.rmdirSync(FIXTURE_BASE);
});

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      encoding: "utf-8",
      env: { ...process.env, HOME: path.join(root, "home"), GNOSYS_HOME: home, GNOSYS_CONFIG_DIR: configDir },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
    return { stdout: stripAnsi(stdout), status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: stripAnsi(e.stdout ?? ""), status: e.status ?? 1 };
  }
}

function runJson(args: string[]): { json: Record<string, unknown>; status: number } {
  const { stdout, status } = run(args);
  return { json: JSON.parse(extractJson(stdout)) as Record<string, unknown>, status };
}

/** A real project folder with .gnosys/gnosys.json naming `projectId`. */
function makeProjectDir(name: string, projectId: string, workingDirectory?: string): string {
  const dir = path.join(root, "projects", name);
  fs.mkdirSync(path.join(dir, ".gnosys"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".gnosys", "gnosys.json"),
    JSON.stringify({ projectId, projectName: name, workingDirectory: workingDirectory ?? dir, user: "t", agentRulesTarget: null, obsidianVault: null, createdAt: "2026-05-01T00:00:00.000Z", schemaVersion: 1 }),
  );
  return dir;
}

const registryPath = (): string => path.join(configDir, "projects.json");
const writeRegistry = (entries: string[]): void => fs.writeFileSync(registryPath(), JSON.stringify(entries));
const readRegistry = (): unknown => JSON.parse(fs.readFileSync(registryPath(), "utf-8"));

function seedDb(fn: (db: GnosysDB) => void): void {
  const db = new GnosysDB(home);
  try {
    fn(db);
  } finally {
    db.close();
  }
}

function query<T>(sql: string, ...params: SQLInputValue[]): T[] {
  const db = new Database(path.join(home, "gnosys.db"), { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

describe("gnosys project relocate", () => {
  let oldDir: string;
  let newDir: string;
  let otherDir: string;

  beforeEach(() => {
    oldDir = makeProjectDir("old-tree", "proj-p", undefined);
    newDir = makeProjectDir("new-tree", "proj-p", oldDir);
    otherDir = makeProjectDir("other", "proj-other");
    writeRegistry([oldDir, otherDir]);
    seedDb((db) => {
      db.insertProject(makeProject({ id: "proj-p", name: "p", working_directory: oldDir }));
      db.insertProject(makeProject({ id: "proj-other", name: "other", working_directory: otherDir }));
      db.setProjectLocation({ project_id: "proj-p", machine_id: "machine-test", abs_path: oldDir, modified: "2026-05-01T00:00:00.000Z" });
    });
  });

  it("dry run reports the three changes and writes nothing", () => {
    const registryBefore = fs.readFileSync(registryPath(), "utf-8");
    const { json, status } = runJson(["project", "relocate", oldDir, newDir, "--json"]);

    expect(status).toBe(0);
    expect(json.applied).toBe(false);
    expect(json.backupPath).toBeNull();
    expect(json.changes).toEqual([
      { kind: "registry", before: [oldDir, otherDir], after: [newDir, otherDir] },
      { kind: "location", from: oldDir, to: newDir },
      { kind: "identity_file", from: oldDir, to: newDir },
    ]);
    expect(fs.readFileSync(registryPath(), "utf-8")).toBe(registryBefore);
    expect(query("SELECT working_directory FROM projects WHERE id = 'proj-p'")).toEqual([{ working_directory: oldDir }]);
    expect(fs.existsSync(path.join(home, "backups"))).toBe(false);
  });

  it("--yes backs up, then updates registry, DB row, this machine's location and gnosys.json", () => {
    const { json, status } = runJson(["project", "relocate", oldDir, newDir, "--yes", "--json"]);

    expect(status).toBe(0);
    expect(json.applied).toBe(true);
    expect(readRegistry()).toEqual([newDir, otherDir]);
    expect(query("SELECT id, working_directory FROM projects ORDER BY id")).toEqual([
      { id: "proj-other", working_directory: otherDir },
      { id: "proj-p", working_directory: newDir },
    ]);
    expect(query("SELECT project_id, machine_id, abs_path FROM project_locations")).toEqual([
      { project_id: "proj-p", machine_id: "machine-test", abs_path: newDir },
    ]);
    const identity = JSON.parse(fs.readFileSync(path.join(newDir, ".gnosys", "gnosys.json"), "utf-8"));
    expect(identity.workingDirectory).toBe(newDir);
    expect(identity.projectId).toBe("proj-p");

    const backupPath = json.backupPath as string;
    expect(path.dirname(backupPath)).toBe(path.join(home, "backups"));
    const backup = new Database(backupPath, { readOnly: true });
    try {
      expect(backup.prepare("SELECT working_directory FROM projects WHERE id = 'proj-p'").get()).toEqual({ working_directory: oldDir });
    } finally {
      backup.close();
    }
  });

  it("is rerunnable: a second --yes changes nothing and takes no backup", () => {
    run(["project", "relocate", oldDir, newDir, "--yes", "--json"]);
    const registryAfterFirst = fs.readFileSync(registryPath(), "utf-8");
    const backupsAfterFirst = fs.readdirSync(path.join(home, "backups"));

    const { json, status } = runJson(["project", "relocate", oldDir, newDir, "--yes", "--json"]);

    expect(status).toBe(0);
    expect(json.changes).toEqual([]);
    expect(json.backupPath).toBeNull();
    expect(fs.readFileSync(registryPath(), "utf-8")).toBe(registryAfterFirst);
    expect(fs.readdirSync(path.join(home, "backups"))).toEqual(backupsAfterFirst);
  });

  it("resolves the old projectId from the central DB when the old folder is gone", () => {
    fs.rmSync(oldDir, { recursive: true, force: true });
    const { json, status } = runJson(["project", "relocate", oldDir, newDir, "--yes", "--json"]);

    expect(status).toBe(0);
    expect(json.projectId).toBe("proj-p");
    expect(readRegistry()).toEqual([newDir, otherDir]);
    expect(query("SELECT working_directory FROM projects WHERE id = 'proj-p'")).toEqual([{ working_directory: newDir }]);
  });

  it("refuses when the projectIds differ and leaves everything unchanged", () => {
    const registryBefore = fs.readFileSync(registryPath(), "utf-8");
    const { json, status } = runJson(["project", "relocate", otherDir, newDir, "--yes", "--json"]);

    expect(status).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.error).toBe(
      `projectIds differ: ${otherDir} is proj-other, ${newDir} is proj-p. To fold one project into the other use "gnosys project merge proj-other proj-p".`,
    );
    expect(fs.readFileSync(registryPath(), "utf-8")).toBe(registryBefore);
    expect(fs.existsSync(path.join(home, "backups"))).toBe(false);
  });

  it("dedupes the registry by path when the new path is already registered", () => {
    writeRegistry([oldDir, newDir, otherDir, newDir]);
    run(["project", "relocate", oldDir, newDir, "--yes"]);
    expect(readRegistry()).toEqual([newDir, otherDir]);
  });
});

describe("gnosys project merge", () => {
  beforeEach(() => {
    seedDb((db) => {
      db.insertProject(makeProject({ id: "proj-dup", name: "proticom.ai", working_directory: "/old/proticom.ai" }));
      db.insertProject(makeProject({ id: "proj-keep", name: "proticom.ai", working_directory: "/new/proticom.ai" }));
      db.insertMemory(makeMemory({ id: "mem-a", project_id: "proj-dup" }));
      db.insertMemory(makeMemory({ id: "mem-b", project_id: "proj-dup" }));
      db.insertMemory(makeMemory({ id: "mem-c", project_id: "proj-keep" }));
      db.insertMemory(makeMemory({ id: "mem-u", project_id: null, scope: "user" }));
      db.insertPendingAdd({ id: "pend-1", title: "t", category: "decisions", content: "c", project_id: "proj-dup", created: "2026-10-13T00:00:00.000Z" });
      db.setProjectLocation({ project_id: "proj-dup", machine_id: "machine-test", abs_path: "/old/proticom.ai", modified: "2026-10-13T00:00:00.000Z" });
    });
  });

  it("dry run reports counts and writes nothing", () => {
    const { json, status } = runJson(["project", "merge", "proj-dup", "proj-keep", "--json"]);

    expect(status).toBe(0);
    expect(json).toMatchObject({ applied: false, memories: 2, pendingAdds: 1, locations: 1, dropsProjectRow: true });
    expect(query("SELECT id FROM projects ORDER BY id")).toEqual([{ id: "proj-dup" }, { id: "proj-keep" }]);
  });

  it("--yes moves memories and pending adds, drops the emptied row, and reruns as a no-op", () => {
    const { json, status } = runJson(["project", "merge", "proj-dup", "proj-keep", "--yes", "--json"]);

    expect(status).toBe(0);
    expect(json.applied).toBe(true);
    expect(fs.existsSync(json.backupPath as string)).toBe(true);
    expect(query("SELECT id, project_id FROM memories ORDER BY id")).toEqual([
      { id: "mem-a", project_id: "proj-keep" },
      { id: "mem-b", project_id: "proj-keep" },
      { id: "mem-c", project_id: "proj-keep" },
      { id: "mem-u", project_id: null },
    ]);
    expect(query("SELECT id, project_id FROM sync_pending_adds")).toEqual([{ id: "pend-1", project_id: "proj-keep" }]);
    expect(query("SELECT id FROM projects")).toEqual([{ id: "proj-keep" }]);
    expect(query("SELECT * FROM project_locations")).toEqual([]);

    const again = runJson(["project", "merge", "proj-dup", "proj-keep", "--yes", "--json"]);
    expect(again.status).toBe(0);
    expect(again.json).toMatchObject({ memories: 0, pendingAdds: 0, locations: 0, dropsProjectRow: false, backupPath: null });
  });

  it("refuses when the target row does not exist", () => {
    const { json, status } = runJson(["project", "merge", "proj-dup", "proj-missing", "--yes", "--json"]);

    expect(status).toBe(1);
    expect(json.error).toBe("target project proj-missing does not exist in the central DB.");
    expect(query("SELECT id, project_id FROM memories WHERE id IN ('mem-a','mem-b') ORDER BY id")).toEqual([
      { id: "mem-a", project_id: "proj-dup" },
      { id: "mem-b", project_id: "proj-dup" },
    ]);
  });
});

describe("gnosys cleanup: moved, missing and no-.gnosys entries", () => {
  it("keeps moved entries, removes missing and no-.gnosys entries, and labels each", () => {
    const oldDir = makeProjectDir("old-tree", "proj-p");
    const newDir = makeProjectDir("new-tree", "proj-p");
    const missing = path.join(root, "projects", "gone");
    const noStore = path.join(root, "projects", "plain");
    fs.mkdirSync(noStore, { recursive: true });
    writeRegistry([oldDir, newDir, missing, noStore]);

    const dry = run(["cleanup", "--dry-run"]);
    expect(dry.stdout).toContain("moved     (1 project, 2 folders) — same projectId in more than one folder; kept");
    expect(dry.stdout).toContain("missing   (1) — folder does not exist");
    expect(dry.stdout).toContain("dead      (1) — folder exists, no .gnosys/ directory");
    expect(dry.stdout).not.toContain("alive     (");

    const { json } = runJson(["cleanup", "--yes", "--json"]);
    expect(json).toEqual({
      ok: true,
      dryRun: false,
      removed: 2,
      kept: 2,
      wrote: true,
      entries: {
        alive: [],
        dead: [missing, noStore],
        temp: [],
        moved: [oldDir, newDir],
        movedGroups: [{ projectId: "proj-p", paths: [oldDir, newDir], dbPath: null }],
      },
    });
    expect(readRegistry()).toEqual([oldDir, newDir]);
  });

  it("flags a lone registry entry as moved when the central DB points at another folder with the same projectId", () => {
    const oldDir = makeProjectDir("old-tree", "proj-p");
    const newDir = makeProjectDir("new-tree", "proj-p");
    writeRegistry([oldDir]);
    seedDb((db) => db.insertProject(makeProject({ id: "proj-p", working_directory: newDir })));

    const dry = run(["cleanup", "--dry-run"]);
    expect(dry.stdout).toContain(`${newDir}  (central DB location)`);
    expect(dry.stdout).toContain(`fix: gnosys project relocate "${oldDir}" "${newDir}"`);
    const { json } = runJson(["cleanup", "--yes", "--json"]);
    expect(json).toEqual({
      ok: true,
      dryRun: false,
      removed: 0,
      kept: 1,
      wrote: false,
      entries: {
        alive: [],
        dead: [],
        temp: [],
        moved: [oldDir],
        movedGroups: [{ projectId: "proj-p", paths: [oldDir, newDir], dbPath: newDir }],
      },
    });
  });
});

describe("gnosys setup sync-projects skips moved folders", () => {
  it("does not touch either copy of a moved project but still syncs the others", () => {
    const oldDir = makeProjectDir("old-tree", "proj-p");
    const newDir = makeProjectDir("new-tree", "proj-p");
    const solo = makeProjectDir("solo", "proj-solo");
    writeRegistry([oldDir, newDir, solo]);
    const identityText = (d: string): string => fs.readFileSync(path.join(d, ".gnosys", "gnosys.json"), "utf-8");
    const oldBefore = identityText(oldDir);
    const newBefore = identityText(newDir);
    const soloBefore = identityText(solo);

    const { stdout, status } = run(["setup", "sync-projects", "--skip-dashboard"]);

    expect(status).toBe(0);
    expect(stdout).toContain("moved      2 folders");
    expect(identityText(oldDir)).toBe(oldBefore);
    expect(identityText(newDir)).toBe(newBefore);
    expect(identityText(solo)).not.toBe(soloBefore);
    expect(query("SELECT id FROM projects")).toEqual([{ id: "proj-solo" }]);

    const { json } = runJson(["setup", "sync-projects", "--json", "--skip-dashboard"]);
    expect(json).toMatchObject({ upgraded: [solo], moved: [oldDir, newDir], skipped: [], failed: [] });
  });
});

describe("interactive cleanup re-reads the registry before writing", () => {
  it("keeps entries added, or repaired, while the prompt was open", async () => {
    vi.stubEnv("GNOSYS_HOME", home);
    vi.stubEnv("GNOSYS_CONFIG_DIR", configDir);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const alive = makeProjectDir("alive", "proj-a");
    const gone = path.join(root, "projects", "gone");
    const repaired = path.join(root, "projects", "repaired");
    const added = makeProjectDir("added", "proj-added");
    writeRegistry([alive, gone, repaired]);

    const rl = {
      question: async () => {
        writeRegistry([alive, gone, repaired, added]);
        fs.mkdirSync(path.join(repaired, ".gnosys"), { recursive: true });
        return "y";
      },
      on: () => rl,
      close: () => undefined,
    };
    const { cleanupRegistry } = await import("../lib/cleanup.js");
    const result = await cleanupRegistry({ interactive: true, rl: rl as unknown as import("readline/promises").Interface });

    expect(result).toEqual({ removed: 1, kept: 3, wrote: true, entries: { alive: [alive], dead: [gone, repaired], temp: [] } });
    expect(readRegistry()).toEqual([alive, repaired, added]);
  });
});
