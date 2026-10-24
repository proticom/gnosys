import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { transaction } from "../lib/sqliteTransaction.js";
import { GnosysDB } from "../lib/db.js";
import { supportsSqliteRuntime, sqliteRuntimeFailure, sqliteStartupMessage } from "../lib/sqliteStartup.js";
import { runAddStructuredCommand } from "../lib/addStructuredCommand.js";

let db: DatabaseSync;
let home: string;
let exitCode: typeof process.exitCode;
beforeEach(() => {
  exitCode = process.exitCode;
  home = mkdtempSync(path.join(tmpdir(), "gnosys-residuals-"));
  db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE items (value TEXT)");
});
afterEach(() => {
  process.exitCode = exitCode;
  db.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});
const rows = (connection: DatabaseSync): unknown[] => connection.prepare("SELECT value FROM items ORDER BY rowid").all().map(row => row.value);

it("rejects async callbacks synchronously and rolls back pre-await work", async () => {
  const warning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
  // @ts-expect-error Runtime defense also protects JavaScript callers.
  expect(() => transaction(db, async () => {
    db.exec("INSERT INTO items VALUES ('before')");
    await null;
    throw new Error("async failure");
  })).toThrow(new TypeError("Transaction function cannot return a promise"));
  expect(rows(db)).toEqual([]);
  expect(db.isTransaction).toBe(false);
  transaction(db, () => db.exec("INSERT INTO items VALUES ('next')"));
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(rows(db)).toEqual(["next"]);
  expect(warning).toHaveBeenCalledWith("Rejected transaction promise: async failure", "TransactionRejectionWarning");
});

it("rolls back nested async pre-await writes while the outer callback can commit", async () => {
  vi.spyOn(process, "emitWarning").mockImplementation(() => {});
  transaction(db, () => {
    db.exec("INSERT INTO items VALUES ('outer')");
    // @ts-expect-error Async transaction callbacks are invalid.
    expect(() => transaction(db, async () => {
      db.exec("INSERT INTO items VALUES ('inner')");
      await null;
      throw new Error("inner failed");
    })).toThrow("Transaction function cannot return a promise");
    expect(db.isTransaction).toBe(true);
    db.exec("INSERT INTO items VALUES ('outer-after')");
  });
  expect(rows(db)).toEqual(["outer", "outer-after"]);
  expect(db.isTransaction).toBe(false);
  await new Promise<void>(resolve => setImmediate(resolve));
});

it("rolls back the outer transaction if the nested async rejection is not caught", async () => {
  expect(() => transaction(db, () => {
    db.exec("INSERT INTO items VALUES ('outer')");
    // @ts-expect-error Async transaction callbacks are invalid.
    transaction(db, async () => {
      db.exec("INSERT INTO items VALUES ('inner')");
      await null;
    });
  })).toThrow("Transaction function cannot return a promise");
  expect(rows(db)).toEqual([]);
  expect(db.isTransaction).toBe(false);
  await new Promise<void>(resolve => setImmediate(resolve));
});

it("cannot prevent later autocommit writes after the callback has awaited", async () => {
  // @ts-expect-error This deliberately tests the JavaScript runtime boundary.
  expect(() => transaction(db, async () => {
    db.exec("INSERT INTO items VALUES ('before')");
    await null;
    // This runs after rollback, outside the synchronous transaction's lifetime.
    db.exec("INSERT INTO items VALUES ('late')");
  })).toThrow("Transaction function cannot return a promise");
  expect(rows(db)).toEqual([]);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(rows(db)).toEqual(["late"]);
});

it("sets exit code 1 when a rejected transaction promise is only warned", () => {
  const modulePath = new URL("../lib/sqliteTransaction.ts", import.meta.url);
  const child = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import { DatabaseSync } from "node:sqlite";
    import { transaction } from ${JSON.stringify(modulePath.href)};
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE t(v TEXT)");
    const ins = (v) => db.exec("INSERT INTO t VALUES ('" + v + "')");
    try {
      transaction(db, async () => { ins("top-pre"); await null; ins("top-post"); throw new Error("top boom"); });
    } catch (e) {
      console.log(e.constructor.name, e.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log(JSON.stringify(db.prepare("SELECT v FROM t").all().map((row) => row.v)));
  `], { encoding: "utf8", cwd: home, env: { ...process.env, HOME: home, GNOSYS_HOME: path.join(home, ".gnosys") } });
  expect(child.status).toBe(1);
  expect(child.stderr).toContain("TransactionRejectionWarning: Rejected transaction promise: top boom");
  expect(child.stdout).toContain("TypeError Transaction function cannot return a promise");
  expect(child.stdout).toContain('["top-post"]');
});

it("does not call then() on a non-Promise thenable", async () => {
  let called = false;
  expect(() => transaction(db, () => {
    db.exec("INSERT INTO items VALUES ('thenable-pre')");
    // biome-ignore lint/suspicious/noThenProperty: Exercise an intentional non-Promise thenable.
    return { then(resolve: (value: number) => void) { called = true; db.exec("INSERT INTO items VALUES ('thenable-then')"); resolve(1); } };
  })).toThrow(new TypeError("Transaction function cannot return a promise"));
  // Promise.resolve() runs then() as a microtask. A macrotask lets that happen
  // before the assertion, so the pre-#99 code fails here instead of passing early.
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(called).toBe(false);
  expect(rows(db)).toEqual([]);
  expect(db.isTransaction).toBe(false);
});

it("rejects non-Promise object and function thenables", () => {
  // biome-ignore lint/suspicious/noThenProperty: Exercise intentional non-Promise thenables.
  for (const thenable of [{ then() {} }, Object.assign(() => {}, { then() {} })]) {
    expect(() => transaction(db, () => {
      db.exec("INSERT INTO items VALUES ('thenable')");
      return thenable;
    })).toThrow("Transaction function cannot return a promise");
    expect(rows(db)).toEqual([]);
  }
});

it("preserves three-level rollback and sequential savepoint reuse", () => {
  transaction(db, () => {
    db.exec("INSERT INTO items VALUES ('L1')");
    expect(() => transaction(db, () => {
      db.exec("INSERT INTO items VALUES ('L2')");
      transaction(db, () => db.exec("INSERT INTO items VALUES ('L3')"));
      throw new Error("middle");
    })).toThrow("middle");
    for (const value of ["s1", "s2", "s3"]) {
      try {
        transaction(db, () => {
          db.prepare("INSERT INTO items VALUES (?)").run(value);
          if (value === "s2") throw new Error("skip");
        });
      } catch { /* The outer transaction retains its own writes. */ }
    }
  });
  expect(rows(db)).toEqual(["L1", "s1", "s3"]);
  expect(db.isTransaction).toBe(false);
});

it("carries synchronous return inference and async rejection through GnosysDB", () => {
  const central = new GnosysDB(home);
  try {
    const result: number = central.transaction(() => 42);
    expect(result).toBe(42);
    // @ts-expect-error The public wrapper must reject promise-returning callbacks too.
    expect(() => central.transaction(async () => 42)).toThrow("Transaction function cannot return a promise");
  } finally { central.close(); }
});

it.each([
  ["20.20.2", false], ["22.13.0", false], ["22.15.0", false], ["22.15.1", false],
  ["22.16.0", true], ["22.17.1", true], ["23.11.1", false], ["24.0.0", true], ["26.3.1", true],
])("checks the supported Node range for %s", (version, supported) => {
  expect(supportsSqliteRuntime(version)).toBe(supported);
});

it("reports distinct version, import, and FTS5 startup failures", async () => {
  expect(await sqliteRuntimeFailure("22.15.0")).toBe("version out of range");
  expect(await sqliteRuntimeFailure("22.17.1", async () => { throw new Error("missing"); })).toBe("node:sqlite missing");
  expect(await sqliteRuntimeFailure("22.17.1")).toBe(null);
  vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(() => { throw new Error("no such module: fts5"); });
  expect(await sqliteRuntimeFailure("22.17.1")).toBe("FTS5 missing");
  expect(sqliteStartupMessage("22.17.1", "FTS5 missing"))
    .toBe("gnosys requires Node ^22.16.0 || >=24.0.0 with FTS5; running Node 22.17.1: FTS5 missing");
});

it("guards the add-structured project path before resolving or starting a transaction", async () => {
  const central = new GnosysDB(home);
  vi.spyOn(central, "isAvailable").mockReturnValue(false);
  vi.spyOn(GnosysDB, "openCentral").mockReturnValue(central);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const resolve = vi.fn(async () => "project");
  const exitCode = process.exitCode;
  try {
    await runAddStructuredCommand({ title: "Test", category: "decisions", content: "Test", tags: "{}", relevance: "", author: "ai", authority: "declared", confidence: "0.8" }, resolve);
    expect(error).toHaveBeenCalledExactlyOnceWith(`Central DB not available (${central.getUnavailableReason()})`);
    expect(resolve).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(() => central.transaction(() => 1)).toThrow("Database not available");
  } finally { process.exitCode = exitCode; }
});

it("CLI fails with exactly one stderr line before dispatch on unsupported Node", () => {
  const cli = new URL("../../dist/cli.js", import.meta.url).pathname;
  const preload = "data:text/javascript," + encodeURIComponent("Object.defineProperty(process.versions, 'node', {value: '22.15.0'})");
  const child = spawnSync(process.execPath, ["--import", preload, cli, "init"], {
    encoding: "utf8", cwd: home, env: { ...process.env, HOME: home, GNOSYS_HOME: home },
  });
  expect(child.status).toBe(1);
  expect(child.stdout).toBe("");
  expect(child.stderr).toBe("gnosys requires Node ^22.16.0 || >=24.0.0 with FTS5; running Node 22.15.0: version out of range\n");
});

it("library import preserves the host warning function and SQLite host warnings", () => {
  const root = new URL("../../dist/index.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const before = process.emitWarning;
    await import(${JSON.stringify(root)});
    console.log(process.emitWarning === before ? 'unchanged' : 'patched');
    process.emitWarning("my app's SQLite cache layer is experimental", 'ExperimentalWarning');
    process.emitWarning(Object.assign(new Error('sqlite-ish error warning'), {name: 'ExperimentalWarning'}));
  `], { encoding: "utf8", cwd: home, env: { ...process.env, HOME: home, GNOSYS_HOME: home } });
  expect(child.status).toBe(0);
  expect(child.stdout).toBe("unchanged\n");
  expect(child.stderr).toContain("ExperimentalWarning: my app's SQLite cache layer is experimental");
  expect(child.stderr).toContain("ExperimentalWarning: sqlite-ish error warning");
});
