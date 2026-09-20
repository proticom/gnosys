/**
 * Phase 9e: Network Share + Final Polish
 * Test Plan Reference: "Phase 9e — Network Share + Final Polish"
 *
 *   TC-9e.1: GnosysDB constructor retry logic
 *   TC-9e.2: GnosysDB constructor with retry options
 *   TC-9e.3: Network path detection in sandbox server
 *   TC-9e.4: Backup/restore round-trip
 *   TC-9e.5: Backup with --to path option
 *   TC-9e.6: SandboxStatus includes dbPath field
 *   TC-9e.7: busy_timeout pragma is set
 *   TC-9e.8: Manager SandboxStatus type shape
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import Database from "better-sqlite3";
import { GnosysDB } from "../lib/db.js";
import { handleRequest, } from "../sandbox/server.js";
import {
  createTestEnv,
  cleanupTestEnv,
  type TestEnv,
  makeMemory,
  cli,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("phase9e");
});

afterEach(async () => {
  vi.doUnmock("better-sqlite3");
  vi.resetModules();
  vi.restoreAllMocks();
  await cleanupTestEnv(env);
});

// ─── TC-9e.1: GnosysDB constructor retry logic ─────────────────────────

describe("TC-9e.1: GnosysDB constructor retry logic", () => {
  it("opens a DB successfully on a valid path (no retries needed)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-retry-"));
    try {
      const db = new GnosysDB(tmpDir);
      expect(db.isAvailable()).toBe(true);
      db.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("opens a DB with explicit retry options (retries: 0)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-retry0-"));
    try {
      const db = new GnosysDB(tmpDir, { retries: 0, retryDelayMs: 100 });
      expect(db.isAvailable()).toBe(true);
      db.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("retries transient native open failures before persisting data", async () => {
    let attempts = 0;
    vi.doMock("better-sqlite3", () => ({ default: function(file: string) {
      if (++attempts <= 4) throw new Error("share temporarily unavailable");
      return new Database(file);
    } }));
    vi.resetModules();
    const { GnosysDB: RetryingDB } = await import("../lib/db.js");
    const db = new RetryingDB(path.join(env.tmpDir, "retry"), { retries: 5, retryDelayMs: 0 });
    try {
      db.insertMemory(makeMemory({ id: "retried", title: "Recovered network open" }));
      expect(db.getMemory("retried")?.title).toBe("Recovered network open");
      expect(attempts).toBe(5);
    } finally { db.close(); }
  });

  it("returns unavailable when Database module is absent (constructor guard)", async () => {
    vi.doMock("better-sqlite3", () => { throw new Error("Native SQLite module missing"); });
    vi.resetModules();
    const { GnosysDB: MissingDB } = await import("../lib/db.js");
    const db = new MissingDB(path.join(env.tmpDir, "missing-native"));
    expect(db.isAvailable()).toBe(false);
    expect(fs.existsSync(path.join(env.tmpDir, "missing-native", "gnosys.db"))).toBe(false);
    db.close();
  });
});

// ─── TC-9e.2: GnosysDB constructor with retry options ──────────────────

describe("TC-9e.2: GnosysDB constructor with retry options", () => {
  it("default retry count is 3 (no opts)", async () => {
    let attempts = 0;
    vi.doMock("better-sqlite3", () => ({ default: function() {
      attempts++;
      throw new Error("share offline");
    } }));
    vi.resetModules();
    const { GnosysDB: OfflineDB } = await import("../lib/db.js");
    const db = new OfflineDB(path.join(env.tmpDir, "offline"), { retryDelayMs: 0 });
    expect(db.isAvailable()).toBe(false);
    expect(attempts).toBe(4);
    db.close();
  });

  it("creates directory recursively if needed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-nested-"));
    const nestedPath = path.join(tmpDir, "deep", "nested", "path");
    try {
      const db = new GnosysDB(nestedPath, { retries: 1, retryDelayMs: 50 });
      expect(db.isAvailable()).toBe(true);
      expect(fs.existsSync(path.join(nestedPath, "gnosys.db"))).toBe(true);
      db.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── TC-9e.3: Network path detection in sandbox server ─────────────────

describe("TC-9e.3: Network path detection in sandbox handleRequest", () => {
  it("handleRequest ping works with normal DB", () => {
    const res = handleRequest(env.db, { id: "1", method: "ping", params: {} });
    expect(res.ok).toBe(true);
    expect(res.result).toHaveProperty("status", "ok");
  });

  it("handleRequest add+recall round-trip on standard path", () => {
    const addRes = handleRequest(env.db, {
      id: "2",
      method: "add",
      params: { content: "Network test memory", title: "Network Test", project_id: "test-proj" },
    });
    expect(addRes.ok).toBe(true);

    const recallRes = handleRequest(env.db, {
      id: "3",
      method: "recall",
      params: { query: "network test", project_id: "test-proj" },
    });
    expect(recallRes.ok).toBe(true);
    expect(recallRes.result).toEqual([expect.objectContaining({ title: "Network Test", content: "Network test memory", category: "decisions", confidence: 0.9 })]);
  });
});

// ─── TC-9e.4: Backup/restore round-trip ────────────────────────────────

describe("TC-9e.4: Backup/restore round-trip", () => {
  it("db.backup creates a backup file", async () => {
    // Insert some data
    env.db.insertMemory(
      makeMemory({ id: "backup-001", title: "Backup Test", content: "Data to backup" })
    );

    const backupPath = await env.db.backup(env.tmpDir);
    expect(backupPath).toBeTruthy();
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain("gnosys-backup-");
    expect(backupPath).toMatch(/\.db$/);
    fs.mkdirSync(path.join(env.tmpDir, "restored"));
    const restored = GnosysDB.restore(backupPath, path.join(env.tmpDir, "restored"));
    try { expect(restored.getMemory("backup-001")).toMatchObject({ title: "Backup Test", content: "Data to backup" }); } finally { restored.close(); }
  });

  it("backup + restore round-trip preserves data", async () => {
    // Insert data
    env.db.insertMemory(
      makeMemory({ id: "rt-001", title: "Round Trip Memory", content: "Important data" })
    );
    const countBefore = env.db.getAllMemories().length;

    // Backup
    const backupPath = await env.db.backup(env.tmpDir);
    expect(fs.existsSync(backupPath)).toBe(true);

    // Close and destroy original
    env.db.close();
    const dbFile = path.join(env.tmpDir, "gnosys.db");
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    const walFile = path.join(env.tmpDir, "gnosys.db-wal");
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    const shmFile = path.join(env.tmpDir, "gnosys.db-shm");
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

    // Restore
    const db2 = GnosysDB.restore(backupPath, env.tmpDir);
    expect(db2.isAvailable()).toBe(true);
    expect(db2.getAllMemories().length).toBe(countBefore);
    const mem = db2.getMemory("rt-001");
    expect(mem).toBeTruthy();
    expect(mem!.title).toBe("Round Trip Memory");
    db2.close();
  });
});

// ─── TC-9e.5: Backup with custom path ──────────────────────────────────

describe("TC-9e.5: Backup with custom --to path", () => {
  it("backup supports custom destination directory", async () => {
    env.db.insertMemory(
      makeMemory({ id: "custom-001", title: "Custom Path Test" })
    );

    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-backup-dest-"));
    try {
      // Backup directly to the custom dir
      const backupPath = await env.db.backup(customDir);
      expect(backupPath).toBeTruthy();
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(backupPath.startsWith(customDir)).toBe(true);
      fs.mkdirSync(path.join(customDir, "restored"));
      const restored = GnosysDB.restore(backupPath, path.join(customDir, "restored"));
      try { expect(restored.getMemory("custom-001")).toMatchObject({ title: "Custom Path Test" }); } finally { restored.close(); }
    } finally {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
  });
});

// ─── TC-9e.6: SandboxStatus includes dbPath ────────────────────────────



// ─── TC-9e.7: busy_timeout pragma ──────────────────────────────────────

describe("TC-9e.7: busy_timeout pragma is set", () => {
  it("new GnosysDB sets busy_timeout to 10000", () => {
    const pragma = vi.spyOn(Database.prototype, "pragma");
    const db = new GnosysDB(path.join(env.tmpDir, "pragma"));
    try {
      expect(db.isAvailable()).toBe(true);
      expect(pragma).toHaveBeenCalledWith("busy_timeout = 10000");
      db.insertMemory(makeMemory({ id: "timeout-data", title: "Busy timeout configured" }));
      expect(db.getMemory("timeout-data")?.title).toBe("Busy timeout configured");
    } finally { db.close(); }
  });
});

// ─── TC-9e.8: Manager SandboxStatus type shape ─────────────────────────



// ─── TC-9e.9: CLI backup/restore commands ──────────────────────────────

describe("TC-9e.9: CLI backup/restore --json output", () => {
  it("backup --json outputs valid JSON", () => {
    env.db.insertMemory(makeMemory({ id: "cli-backup", title: "CLI backup payload", content: "Data must survive backup" }));
    const output = cli("backup --json", env.tmpDir, { centralDir: env.tmpDir });
    const result = JSON.parse(output);
    expect(result).toMatchObject({ ok: true, memories: 1, active: 1, archived: 0 });
    fs.mkdirSync(path.join(env.tmpDir, "cli-restored"));
    const restored = GnosysDB.restore(result.backupPath, path.join(env.tmpDir, "cli-restored"));
    try { expect(restored.getMemory("cli-backup")).toMatchObject({ title: "CLI backup payload", content: "Data must survive backup" }); } finally { restored.close(); }
  });
});
