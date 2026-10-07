/**
 * CC.3 — coverage for remote.ts (resolve/migrate edge cases, getMachineId, getStatus busy, formatStatus).
 * NEW file only; does not modify existing remote*.test.ts files.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB, type DbMemory, type DbProject } from "../lib/db.js";
import {
  RemoteSync,
  validateLocation,
  getMachineId,
  formatStatus,
} from "../lib/remote.js";

import Database from "better-sqlite3";

function rejectInsert(dir: string, table: string, condition: string, message: string): void {
  const connection = new Database(path.join(dir, "gnosys.db"));
  try { connection.exec(`CREATE TRIGGER reject_test_insert BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, '${message}'); END`); }
  finally { connection.close(); }
}

function failRemoteQuery(code: string, message: string): void {
  const prepare = Database.prototype.prepare;
  vi.spyOn(Database.prototype, "prepare").mockImplementation(function(this: Database.Database, sql: string) {
    if (this.name === path.join(remotePath, "gnosys.db") && sql.startsWith("SELECT id, modified FROM memories")) {
      throw Object.assign(new Error(message), { code });
    }
    return prepare.call(this, sql);
  });
}

function makeMemory(id: string, overrides: Partial<DbMemory> = {}): DbMemory {
  const now = new Date().toISOString();
  return {
    id,
    title: `Memory ${id}`,
    category: "decisions",
    content: `Content of ${id}`,
    summary: null,
    tags: '["test"]',
    relevance: "test memory",
    author: "human+ai",
    authority: "declared",
    confidence: 0.9,
    reinforcement_count: 0,
    content_hash: `h-${id}`,
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
    scope: "project",
    ...overrides,
  } as DbMemory;
}

function makeProject(id: string): DbProject {
  const now = new Date().toISOString();
  return {
    id,
    name: id,
    working_directory: `/tmp/${id}`,
    user: "testuser",
    agent_rules_target: null,
    obsidian_vault: null,
    created: now,
    modified: now,
  };
}

let previousEnv: NodeJS.ProcessEnv;
let localPath: string;
let remotePath: string;
let localDb: GnosysDB;
let remoteDb: GnosysDB;
let sync: RemoteSync;

beforeEach(() => {
  previousEnv = { ...process.env };
  localPath = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-loc-"));
  remotePath = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-rem-"));
  process.env.GNOSYS_CONFIG_DIR = path.join(localPath, "config");
  localDb = new GnosysDB(localPath);
  remoteDb = new GnosysDB(remotePath);
  sync = new RemoteSync(localDb, remotePath);
});

afterEach(() => {
  sync.closeRemote();
  localDb.close();
  remoteDb.close();
  fs.rmSync(localPath, { recursive: true, force: true });
  fs.rmSync(remotePath, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.env = previousEnv;
});

describe("RemoteSync.resolve edge cases", () => {
  it("applies merged content to both sides", async () => {
    const initial = makeMemory("mem-001", { modified: "2026-01-01T00:00:00Z" });
    localDb.insertMemory({ ...initial, title: "Local", modified: "2026-01-03T00:00:00Z" });
    remoteDb.insertMemory({ ...initial, title: "Remote", modified: "2026-01-03T01:00:00Z" });
    localDb.recordConflict("mem-001", "2026-01-03T00:00:00Z", "2026-01-03T01:00:00Z");

    const result = await sync.resolve("mem-001", "merged", { title: "Merged", content: "merged body" });
    expect(result.ok).toBe(true);
    expect(localDb.getMemory("mem-001")?.title).toBe("Merged");
    expect(remoteDb.getMemory("mem-001")?.title).toBe("Merged");
    expect(localDb.getUnresolvedConflicts().length).toBe(0);
  });

  it("rejects merged without mergedMemory payload", async () => {
    const initial = makeMemory("mem-002");
    localDb.insertMemory(initial);
    remoteDb.insertMemory(initial);
    const result = await sync.resolve("mem-002", "merged");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid choice: merged");
  });

  it("rejects invalid choice strings", async () => {
    const initial = makeMemory("mem-003");
    localDb.insertMemory(initial);
    remoteDb.insertMemory(initial);
    const result = await sync.resolve("mem-003", "sideways" as "local");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid choice: sideways");
  });

  it("returns error when remote is not reachable", async () => {
    const badSync = new RemoteSync(localDb, path.join(os.tmpdir(), `missing-${Date.now()}`));
    const result = await badSync.resolve("x", "local");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Remote not reachable");
    badSync.closeRemote();
  });

  it("returns error when memory exists on neither side", async () => {
    const result = await sync.resolve("missing-id", "local");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Memory not found/);
  });

  it("reports native SQLite rejection during conflict resolution", async () => {
    const initial = makeMemory("mem-fail");
    localDb.insertMemory({ ...initial, title: "Local" });
    remoteDb.insertMemory({ ...initial, title: "Remote" });
    rejectInsert(localPath, "memories", "NEW.id = 'mem-fail'", "insert fail");
    const result = await sync.resolve("mem-fail", "local");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("insert fail");
  });
});

describe("RemoteSync.migrate partial failures", () => {
  it("copies projects and memories and sets last sync on success", async () => {
    localDb.insertProject(makeProject("proj-a"));
    localDb.insertMemory(makeMemory("m-001"));
    localDb.insertMemory(makeMemory("m-002"));
    localDb.insertMemory(makeMemory("m-003"));
    const result = await sync.migrate();
    expect(result.ok).toBe(true);
    expect(result.copied).toBe(4);
    expect(remoteDb.getProject("proj-a")).toMatchObject({ id: "proj-a", name: "proj-a", working_directory: "/tmp/proj-a" });
    expect(remoteDb.getAllMemories().map(({ id, title, content }) => ({ id, title, content })).sort((a,b)=>a.id.localeCompare(b.id))).toEqual([
      { id: "m-001", title: "Memory m-001", content: "Content of m-001" },
      { id: "m-002", title: "Memory m-002", content: "Content of m-002" },
      { id: "m-003", title: "Memory m-003", content: "Content of m-003" },
    ]);
    expect(localDb.getMeta("remote_last_synced_at")).not.toBeNull();
  });

  it("returns error when remote is not reachable", async () => {
    const badSync = new RemoteSync(localDb, path.join(os.tmpdir(), `missing-migrate-${Date.now()}`));
    const result = await badSync.migrate();
    expect(result.ok).toBe(false);
    expect(result.copied).toBe(0);
    expect(result.errors[0]).toBe("Remote not reachable");
    badSync.closeRemote();
  });

  it("continues when one project insert fails", async () => {
    localDb.insertProject(makeProject("proj-ok"));
    localDb.insertProject(makeProject("proj-bad"));
    localDb.insertMemory(makeMemory("m-010"));
    rejectInsert(remotePath, "projects", "NEW.id = 'proj-bad'", "project fail");
    const result = await sync.migrate();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Failed to copy project proj-bad"))).toBe(true);
    expect(remoteDb.getProject("proj-ok")?.name).toBe("proj-ok");
    expect(remoteDb.getProject("proj-bad")).toBeNull();
    expect(remoteDb.getMemory("m-010")?.content).toBe("Content of m-010");
  });

  it("continues when one memory insert fails", async () => {
    localDb.insertMemory(makeMemory("m-ok"));
    localDb.insertMemory(makeMemory("m-bad"));
    rejectInsert(remotePath, "memories", "NEW.id = 'm-bad'", "mem fail");
    const result = await sync.migrate();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Failed to copy m-bad"))).toBe(true);
    expect(remoteDb.getMemory("m-ok")?.content).toBe("Content of m-ok");
    expect(remoteDb.getMemory("m-bad")).toBeNull();
  });
});

describe("getMachineId and resolveHostname", () => {
  it("uses HOSTNAME env var for new ids", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    process.env.HOSTNAME = "myhost";
    const id = getMachineId(db);
    expect(id).toMatch(/^myhost-/);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("falls back to COMPUTERNAME when HOSTNAME is unset", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    delete process.env.HOSTNAME;
    process.env.COMPUTERNAME = "winbox";
    const id = getMachineId(db);
    expect(id).toMatch(/^winbox-/);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("falls back to os.hostname when env vars are unset", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    delete process.env.HOSTNAME;
    delete process.env.COMPUTERNAME;
    vi.spyOn(os, "hostname").mockReturnValue("os-host");
    const id = getMachineId(db);
    expect(id).toMatch(/^os-host-/);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns unknown- prefix when os.hostname throws", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    delete process.env.HOSTNAME;
    delete process.env.COMPUTERNAME;
    vi.spyOn(os, "hostname").mockImplementation(() => {
      throw new Error("no hostname");
    });
    const id = getMachineId(db);
    expect(id).toMatch(/^unknown-/);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("self-heals stale unknown- id and dream_machine_id", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    db.setMeta("machine_id", "unknown-abc123");
    db.setDreamMachineId("unknown-abc123");
    process.env.HOSTNAME = "real-host";
    const id = getMachineId(db);
    expect(id).toMatch(/^real-host-/);
    expect(db.getMeta("machine_id")).toBe(id);
    expect(db.getDreamMachineId()).toBe(id);
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("keeps stale unknown- id when hostname still cannot resolve", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    db.setMeta("machine_id", "unknown-abc123");
    delete process.env.HOSTNAME;
    delete process.env.COMPUTERNAME;
    vi.spyOn(os, "hostname").mockImplementation(() => {
      throw new Error("no hostname");
    });
    const id = getMachineId(db);
    expect(id).toBe("unknown-abc123");
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns stable cached non-stale id unchanged", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    db.setMeta("machine_id", "good-host-abc123");
    const id = getMachineId(db);
    expect(id).toBe("good-host-abc123");
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does not treat host-abc123 as stale unknown id", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-mid-"));
    const db = new GnosysDB(tmp);
    db.setMeta("machine_id", "host-abc123");
    const id = getMachineId(db);
    expect(id).toBe("host-abc123");
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("RemoteSync.getStatus SQLITE_BUSY", () => {
  it("returns friendly message on SQLITE_BUSY", async () => {
    failRemoteQuery("SQLITE_BUSY", "busy");
    const status = await sync.getStatus();
    expect(status.message).toMatch(/Remote DB busy/);
  });

  it("rethrows non-busy sqlite errors", async () => {
    failRemoteQuery("SQLITE_IOERR", "disk read failed");
    await expect(sync.getStatus()).rejects.toThrow("disk read failed");
  });
});

describe("formatStatus branches", () => {
  it("formats not configured", () => {
    const text = formatStatus({
      configured: false,
      reachable: false,
      lastSync: null,
      pendingPush: 0,
      pendingPull: 0,
      queuedWrites: 0,
      conflicts: [],
    });
    expect(text).toMatch(/not configured/);
  });

  it("formats unreachable path", () => {
    const text = formatStatus({
      configured: true,
      reachable: false,
      remotePath: "/x",
      lastSync: null,
      pendingPush: 0,
      pendingPull: 0,
      queuedWrites: 0,
      conflicts: [],
    });
    expect(text).toMatch(/unreachable at \/x/);
  });

  it("includes conflict count", () => {
    const text = formatStatus({
      configured: true,
      reachable: true,
      remotePath: "/remote",
      lastSync: null,
      pendingPush: 0,
      pendingPull: 0,
      queuedWrites: 0,
      conflicts: [
        { memoryId: "a", title: "A", localModified: "1", remoteModified: "2" },
        { memoryId: "b", title: "B", localModified: "1", remoteModified: "2" },
      ],
    });
    expect(text).toContain("Conflicts: 2");
  });

  it("includes custom message line", () => {
    const text = formatStatus({
      configured: true,
      reachable: true,
      remotePath: "/remote",
      lastSync: null,
      pendingPush: 0,
      pendingPull: 0,
      queuedWrites: 0,
      conflicts: [],
      message: "custom",
    });
    expect(text).toContain("Status: custom");
  });
});

describe("validateLocation extras", () => {
  it("warns when directory is created", async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-val-"));
    const newPath = path.join(parent, "new-subdir");
    const result = await validateLocation(newPath);
    expect(result.warnings.some((w) => w.includes("Created directory"))).toBe(true);
    fs.rmSync(parent, { recursive: true, force: true });
  });

  it("warns on high sqlite probe latency", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-val-"));
    let t = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      t += 600;
      return t;
    });
    const result = await validateLocation(tmp);
    expect(result.warnings.some((w) => /High latency/.test(w))).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports an unsuccessful SQLite write probe", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cc3-val-"));
    new GnosysDB(tmp).close();
    rejectInsert(tmp, "gnosys_meta", "NEW.key = '__sqlite_test__'", "sqlite-fail");
    const result = await validateLocation(tmp);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["SQLite read/write probe failed — locking may be unreliable on this filesystem"]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("RemoteSync.closeRemote", () => {
  it("closes the native connection and can reconnect", async () => {
    remoteDb.insertMemory(makeMemory("remote-first"));
    expect((await sync.getStatus()).pendingPull).toBe(1);
    const close = vi.spyOn(Database.prototype, "close");
    sync.closeRemote();
    expect(close).toHaveBeenCalledTimes(1);
    remoteDb.insertMemory(makeMemory("remote-second"));
    expect((await sync.getStatus()).pendingPull).toBe(2);
  });
});
