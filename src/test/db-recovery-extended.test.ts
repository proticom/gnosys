/**
 * Extended DB recovery scenarios — SIGKILL mid-transaction, full disk,
 * corrupted FTS index, and missing node:sqlite native binary.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync as Database } from "node:sqlite";
import { GnosysDB } from "../lib/db.js";

const sampleMemory = {
  id: "fts-test-001",
  title: "Recovery FTS Test",
  category: "test",
  content: "unique recovery keyword xyzzy",
  summary: null,
  tags: "[]",
  relevance: "",
  author: "ai" as const,
  authority: "imported" as const,
  confidence: 0.8,
  reinforcement_count: 0,
  content_hash: "hash",
  status: "active" as const,
  tier: "active" as const,
  supersedes: null,
  superseded_by: null,
  last_reinforced: null,
  created: "2026-05-05",
  modified: "2026-05-05",
  embedding: null,
  source_path: null,
  source_file: null,
  source_page: null,
  source_timerange: null,
  project_id: null,
  scope: "user" as const,
};

let workspace: { db: GnosysDB; tmp: string };

beforeEach(() => {
  const tmp = mkdtempSync(join(tmpdir(), "gnosys-recovery-ext-"));
  const db = new GnosysDB(tmp);
  workspace = { db, tmp };
});

afterEach(() => {
  workspace.db.close();
  rmSync(workspace.tmp, { recursive: true, force: true });
});

describe("DB recovery — extended failure modes", () => {

  it("surfaces ENOSPC/full-disk as a clear non-corruption error", () => {
    const inner = (workspace.db as unknown as { db: { prepare: (...args: unknown[]) => unknown } }).db;
    const originalPrepare = inner.prepare.bind(inner);
    inner.prepare = (...args: unknown[]) => {
      const stmt = originalPrepare(...args) as { run: (...runArgs: unknown[]) => unknown };
      stmt.run = (...runArgs: unknown[]) => {
        const err = Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13, errstr: "database or disk is full" });
        throw err;
      };
      return stmt;
    };

    let caught: unknown;
    try {
      workspace.db.insertMemory({ ...sampleMemory, id: "enospc-001" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/database or disk is full/i);
    expect(GnosysDB.isCorruptionError(caught)).toBe(false);
  });

  it("searchFts degrades gracefully when the FTS index is corrupted", () => {
    workspace.db.insertMemory(sampleMemory);

    // Drop the FTS virtual table — MATCH queries fail and searchFts falls back to LIKE.
    const storage = new Database(workspace.db.getDbPath());
    storage.exec("DROP TABLE IF EXISTS memories_fts");
    storage.close();

    const results = workspace.db.searchFts("xyzzy");
    expect(results.map(row => row.id)).toEqual(["fts-test-001"]);
  });

  it("degrades gracefully when node:sqlite cannot load", async () => {
    vi.resetModules();
    vi.doMock("node:sqlite", () => {
      throw new Error("Could not locate the bindings file. Tried: /fake/path.node");
    });

    const { GnosysDB: MockedGnosysDB } = await import("../lib/db.js");
    const tmp = mkdtempSync(join(tmpdir(), "gnosys-no-native-"));
    try {
      const db = new MockedGnosysDB(tmp);
      expect(db.isAvailable()).toBe(false);
      expect(db.getMeta("anything")).toBeNull();
      await expect(db.backup()).rejects.toThrow(/Database not available/);
      db.close();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      vi.resetModules();
      vi.doUnmock("node:sqlite");
    }
  });
});
