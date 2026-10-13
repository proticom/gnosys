/**
 * In-process tests for src/lib/projectRelocate.ts. project-relocate.test.ts
 * drives the same code through `node dist/cli.js`, which V8 coverage cannot
 * see; these call plan/apply directly against a seeded central DB.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";
import {
  ProjectRepairError,
  applyMerge,
  applyRelocate,
  mergeHasChanges,
  planMerge,
  planRelocate,
} from "../lib/projectRelocate.js";
import { makeMemory, makeProject } from "./_helpers.js";

let root: string;
let home: string;
let configDir: string;
let db: GnosysDB;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-relocate-lib-"));
  home = path.join(root, ".gnosys");
  configDir = path.join(root, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "machine.json"),
    JSON.stringify({ machineId: "machine-test", hostname: os.hostname(), roots: {}, remote: { enabled: false }, schemaVersion: 1 }),
  );
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_CONFIG_DIR", configDir);
  db = new GnosysDB(home);
});

afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

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
const readRegistry = (): unknown => JSON.parse(fs.readFileSync(registryPath(), "utf-8"));

describe("planRelocate / applyRelocate", () => {
  let oldDir: string;
  let newDir: string;

  beforeEach(() => {
    oldDir = makeProjectDir("old", "proj-p");
    newDir = makeProjectDir("new", "proj-p", oldDir);
    fs.writeFileSync(registryPath(), JSON.stringify([oldDir]));
    db.insertProject(makeProject({ id: "proj-p", working_directory: oldDir }));
    db.setProjectLocation({ project_id: "proj-p", machine_id: "machine-test", abs_path: oldDir, modified: "2026-05-01T00:00:00.000Z" });
  });

  it("plans registry, location and identity changes, then applies them after a backup", async () => {
    const plan = await planRelocate(db, oldDir, newDir);
    expect(plan.changes).toEqual([
      { kind: "registry", before: [oldDir], after: [newDir] },
      { kind: "location", from: oldDir, to: newDir },
      { kind: "identity_file", from: oldDir, to: newDir },
    ]);

    const { backupPath } = await applyRelocate(db, plan);

    expect(path.dirname(backupPath as string)).toBe(path.join(home, "backups"));
    expect(readRegistry()).toEqual([newDir]);
    expect(db.getProject("proj-p")?.working_directory).toBe(newDir);
    expect(db.getProjectLocation("proj-p", "machine-test")?.abs_path).toBe(newDir);
    expect(JSON.parse(fs.readFileSync(path.join(newDir, ".gnosys", "gnosys.json"), "utf-8")).workingDirectory).toBe(newDir);

    const again = await planRelocate(db, oldDir, newDir);
    expect(again.changes).toEqual([]);
    expect(await applyRelocate(db, again)).toEqual({ backupPath: null });
  });

  it("updates working_directory without machine.json", async () => {
    fs.rmSync(path.join(configDir, "machine.json"));
    const plan = await planRelocate(db, oldDir, newDir);
    await applyRelocate(db, plan);
    expect(db.getProject("proj-p")?.working_directory).toBe(newDir);
  });

  it("falls back to the central DB when the old folder is gone", async () => {
    fs.rmSync(oldDir, { recursive: true, force: true });
    const plan = await planRelocate(db, oldDir, newDir);
    expect(plan.projectId).toBe("proj-p");
  });

  it("refuses same paths, missing new identity, unknown old path, ambiguous old path and a missing DB row", async () => {
    await expect(planRelocate(db, newDir, newDir)).rejects.toThrow("old and new paths are the same.");

    const bare = path.join(root, "projects", "bare");
    fs.mkdirSync(bare, { recursive: true });
    await expect(planRelocate(db, oldDir, bare)).rejects.toThrow(`${bare} has no .gnosys/gnosys.json with a projectId.`);

    const nowhere = path.join(root, "projects", "nowhere");
    await expect(planRelocate(db, nowhere, newDir)).rejects.toThrow(
      `cannot tell which project ${nowhere} was: no .gnosys/gnosys.json there and no central DB row points at it.`,
    );

    const shared = path.join(root, "projects", "shared");
    db.insertProject(makeProject({ id: "proj-x", working_directory: shared }));
    db.insertProject(makeProject({ id: "proj-y", working_directory: shared }));
    await expect(planRelocate(db, shared, newDir)).rejects.toBeInstanceOf(ProjectRepairError);

    const orphan = makeProjectDir("orphan-new", "proj-orphan");
    const orphanOld = makeProjectDir("orphan-old", "proj-orphan");
    await expect(planRelocate(db, orphanOld, orphan)).rejects.toThrow(
      `project proj-orphan is not in the central DB; run "gnosys init --directory ${orphan}" first.`,
    );
  });
});

describe("planMerge / applyMerge", () => {
  beforeEach(() => {
    db.insertProject(makeProject({ id: "proj-dup", working_directory: "/old/x" }));
    db.insertProject(makeProject({ id: "proj-keep", working_directory: "/new/x" }));
    db.insertMemory(makeMemory({ id: "mem-1", project_id: "proj-dup" }));
    db.insertMemory(makeMemory({ id: "mem-2", project_id: "proj-keep" }));
    db.insertPendingAdd({ id: "pend-1", title: "t", category: "decisions", content: "c", project_id: "proj-dup", created: "2026-10-13T00:00:00.000Z" });
  });

  it("moves memories and pending adds, drops the row, and lists folders that still name the source", async () => {
    const stale = makeProjectDir("still-dup", "proj-dup");
    fs.writeFileSync(registryPath(), JSON.stringify([stale]));

    const plan = await planMerge(db, "proj-dup", "proj-keep");
    expect(plan).toEqual({
      fromId: "proj-dup",
      intoId: "proj-keep",
      memories: 1,
      pendingAdds: 1,
      locations: 0,
      dropsProjectRow: true,
      foldersStillUsingFromId: [stale],
    });
    expect(mergeHasChanges(plan)).toBe(true);

    const { backupPath } = await applyMerge(db, plan);

    expect(fs.existsSync(backupPath as string)).toBe(true);
    expect(db.getMemory("mem-1")?.project_id).toBe("proj-keep");
    expect(db.getProject("proj-dup")).toBeNull();
    expect(db.countProjectReferences("proj-dup")).toEqual({ memories: 0, pendingAdds: 0, locations: 0 });

    const again = await planMerge(db, "proj-dup", "proj-keep");
    expect(mergeHasChanges(again)).toBe(false);
    expect(await applyMerge(db, again)).toEqual({ backupPath: null });
  });

  it("refuses the same id and a missing target", async () => {
    await expect(planMerge(db, "proj-keep", "proj-keep")).rejects.toThrow("source and target projectIds are the same.");
    await expect(planMerge(db, "proj-dup", "proj-none")).rejects.toThrow("target project proj-none does not exist in the central DB.");
  });
});
