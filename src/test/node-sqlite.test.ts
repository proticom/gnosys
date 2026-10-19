import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transaction } from "../lib/sqliteTransaction.js";
import { sqliteValue } from "../lib/sqliteValue.js";
import { enableWAL } from "../lib/lock.js";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { GnosysDB } from "../lib/db.js";
import { runProjectsCommand } from "../lib/projectsCommand.js";
import { makeMemory } from "./_helpers.js";

let home: string;
let db: DatabaseSync;
beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), "gnosys-node-sqlite-"));
  db = new DatabaseSync(path.join(home, "test.db"));
  db.exec("CREATE TABLE items (value INTEGER)");
});
afterEach(() => {
  db.close();
  rmSync(home, { recursive: true, force: true });
});

it("creates an FTS5 virtual table and matches a token", () => {
  db.exec("CREATE VIRTUAL TABLE documents USING fts5(content)");
  db.prepare("INSERT INTO documents VALUES (?)").run("persistent memory");
  expect(db.prepare("SELECT content FROM documents WHERE documents MATCH ?").all("memory"))
    .toEqual([{ content: "persistent memory" }]);
});

it("preserves WAL, busy timeout, checkpoint cadence, and foreign keys", () => {
  enableWAL(db, 1234);
  expect(db.prepare("PRAGMA journal_mode").get()?.journal_mode).toBe("wal");
  expect(db.prepare("PRAGMA busy_timeout").get()?.timeout).toBe(1234);
  expect(db.prepare("PRAGMA wal_autocheckpoint").get()?.wal_autocheckpoint).toBe(1000);
  expect(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
});

describe("transaction", () => {
  it("commits and returns the callback result", () => {
    expect(transaction(db, () => {
      db.prepare("INSERT INTO items VALUES (?)").run(7);
      return "committed";
    })).toBe("committed");
    expect(db.prepare("SELECT value FROM items").all()).toEqual([{ value: 7 }]);
  });

  it("rolls back on throw and permits another transaction", () => {
    expect(() => transaction(db, () => {
      db.exec("INSERT INTO items VALUES (8)");
      throw new Error("stop");
    })).toThrow("stop");
    transaction(db, () => db.exec("INSERT INTO items VALUES (9)"), "immediate");
    expect(db.prepare("SELECT value FROM items").all()).toEqual([{ value: 9 }]);
  });

  it("rolls back only the failed savepoint when the outer callback handles the error", () => {
    transaction(db, () => {
      db.exec("INSERT INTO items VALUES (1)");
      expect(() => transaction(db, () => {
        db.exec("INSERT INTO items VALUES (2)");
        throw new Error("inner");
      })).toThrow("inner");
      expect(transaction(db, () => {
        db.exec("INSERT INTO items VALUES (3)");
        return 42;
      })).toBe(42);
    });
    expect(db.prepare("SELECT value FROM items ORDER BY value").all()).toEqual([{ value: 1 }, { value: 3 }]);
  });

  it("rolls back successful nested work if the outer callback fails", () => {
    expect(() => transaction(db, () => {
      transaction(db, () => db.exec("INSERT INTO items VALUES (4)"));
      throw new Error("outer");
    })).toThrow("outer");
    expect(db.prepare("SELECT value FROM items").all()).toEqual([]);
  });
});

it("preserves the SQLite error after an automatic transaction rollback", () => {
  db.exec("CREATE TABLE unique_items (value INTEGER UNIQUE); INSERT INTO unique_items VALUES (1)");
  expect(() => transaction(db, () => {
    db.exec("INSERT OR ROLLBACK INTO unique_items VALUES (1)");
  })).toThrow("UNIQUE constraint failed: unique_items.value");
  transaction(db, () => db.exec("INSERT INTO unique_items VALUES (2)"));
  expect(db.prepare("SELECT value FROM unique_items ORDER BY value").all()).toEqual([{ value: 1 }, { value: 2 }]);
});

it("reports missing FTS5 through the projects command", async () => {
  const exec = DatabaseSync.prototype.exec;
  vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function(this: DatabaseSync, sql: string) {
    if (sql.includes("gnosys_fts5_check")) throw new Error("no such module: fts5");
    return exec.call(this, sql);
  });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  const exitCode = process.exitCode;
  try {
    await runProjectsCommand({});
    expect(errors).toHaveBeenCalledExactlyOnceWith("Central DB not available (node:sqlite on this Node lacks FTS5; requires Node ^22.16.0 || >=24.0.0 (Node 23.x unsupported))");
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = exitCode;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
});

it("creates distinct consistent backups on consecutive calls", async () => {
  const central = new GnosysDB(home);
  try {
    central.insertMemory(makeMemory({ id: "backed-up", title: "Snapshot contents" }));
    const first = await central.backup();
    const second = await central.backup();
    expect(first).not.toBe(second);
    for (const file of [first, second]) {
      const snapshot = new DatabaseSync(file, { readOnly: true });
      try { expect(snapshot.prepare("SELECT title FROM memories").all()).toEqual([{ title: "Snapshot contents" }]); }
      finally { snapshot.close(); }
    }
  } finally { central.close(); }
});

it("binds booleans, undefined, and bigint with literal SQLite values", () => {
  const insert = db.prepare("INSERT INTO items VALUES (?)");
  for (const value of [true, false, undefined, 9007199254740993n]) insert.run(sqliteValue(value));
  const read = db.prepare("SELECT value FROM items ORDER BY rowid");
  read.setReadBigInts(true);
  expect(read.all()).toEqual([{ value: 1n }, { value: 0n }, { value: null }, { value: 9007199254740993n }]);
  expect(() => sqliteValue({ unsupported: 1 })).toThrow("Unsupported SQLite binding value");
});

it("normalizes optional caller update values at the DB boundary", () => {
  const central = new GnosysDB(home);
  try {
    central.insertMemory(makeMemory({ id: "optional", summary: "before" }));
    central.updateMemory("optional", { summary: undefined });
    expect(central.getMemory("optional")?.summary).toBe(null);
  } finally { central.close(); }
});

it("explicitly enables bare named parameters for all three prefixes", () => {
  for (const prefix of ["@", ":", "$"]) {
    const statement = db.prepare(`SELECT ${prefix}value AS value`);
    statement.setAllowBareNamedParameters(true);
    expect(statement.get({ value: 7 })).toEqual({ value: 7 });
  }
});

it("round-trips a sliced embedding through a file BLOB and reopen", () => {
  mkdirSync(path.join(home, ".config"));
  const embeddings = new GnosysEmbeddings(home);
  embeddings.storeEmbedding("memory", new Float32Array([99, 1.25, -2.5, 88]).subarray(1, 3), "hash");
  embeddings.close();
  try {
    expect(Array.from(embeddings.getEmbedding("memory") ?? [])).toEqual([1.25, -2.5]);
    expect(embeddings.getAllEmbeddings().map(row => ({ ...row, embedding: Array.from(row.embedding) })))
      .toEqual([{ filePath: "memory", contentHash: "hash", embedding: [1.25, -2.5] }]);
    expect(embeddings.getEmbedding("missing")).toBe(null);
  } finally { embeddings.close(); }
});

it("suppresses only SQLite experimental warnings before importing SQLite", () => {
  const warningModule = new URL("../../dist/lib/sqliteWarnings.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { installSqliteWarningFilter } from ${JSON.stringify(warningModule)};
    installSqliteWarningFilter();
    await import('node:sqlite');
    process.emitWarning('SQLite synthetic warning', 'ExperimentalWarning');
    process.emitWarning('SQLite options warning', { type: 'ExperimentalWarning' });
    process.emitWarning(Object.assign(new Error('SQLite error warning'), { name: 'ExperimentalWarning' }));
    process.emitWarning('Other experiment stays visible', 'ExperimentalWarning');
    process.emitWarning('SQLite ordinary warning stays visible');
    process.emitWarning('Deprecated feature stays visible', 'DeprecationWarning');
  `], { encoding: "utf8", env: { ...process.env, HOME: home, GNOSYS_HOME: home } });
  expect(child.status).toBe(0);
  expect(child.stderr).not.toContain("SQLite is an experimental feature and might change at any time");
  expect(child.stderr).toContain("ExperimentalWarning: SQLite synthetic warning");
  expect(child.stderr).toContain("ExperimentalWarning: SQLite options warning");
  expect(child.stderr).toContain("ExperimentalWarning: SQLite error warning");
  expect(child.stderr).toContain("ExperimentalWarning: Other experiment stays visible");
  expect(child.stderr).toContain("Warning: SQLite ordinary warning stays visible");
  expect(child.stderr).toContain("DeprecationWarning: Deprecated feature stays visible");
});
