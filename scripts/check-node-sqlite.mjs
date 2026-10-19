import { installSqliteWarningFilter } from "../dist/lib/sqliteWarnings.js";
installSqliteWarningFilter();
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const { DatabaseSync } = await import("node:sqlite");
import { transaction } from "../dist/lib/sqliteTransaction.js";
import { sqliteValue } from "../dist/lib/sqliteValue.js";
import { enableWAL } from "../dist/lib/lock.js";

// npm run build && /path/to/node scripts/check-node-sqlite.mjs
const home = mkdtempSync(join(tmpdir(), "gnosys-sqlite-check-"));
const db = new DatabaseSync(join(home, "check.db"));
try {
  enableWAL(db);
  assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
  db.exec("CREATE VIRTUAL TABLE search USING fts5(content)");
  transaction(db, () => {
    db.prepare("INSERT INTO search VALUES (?)").run("persistent memory");
    assert.throws(() => transaction(db, () => {
      db.prepare("INSERT INTO search VALUES (?)").run("rolled back");
      throw new Error("rollback");
    }), /rollback/);
  });
  assert.deepEqual(db.prepare("SELECT content FROM search WHERE search MATCH ?").all("memory").map(row => row.content), ["persistent memory"]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM search").get().n, 1);
  for (const prefix of ["@", ":", "$"]) {
    const statement = db.prepare(`SELECT ${prefix}value AS value`);
    statement.setAllowBareNamedParameters(true);
    assert.equal(statement.get({ value: 7 }).value, 7);
  }
  const bindings = db.prepare("SELECT ? AS yes, ? AS no, ? AS empty, ? AS large, ? AS bytes");
  bindings.setReadBigInts(true);
  const row = bindings.get(sqliteValue(true), sqliteValue(false), sqliteValue(undefined), 9007199254740993n, new Uint8Array([1, 2, 3]));
  assert.deepEqual({ ...row, bytes: Array.from(row.bytes) }, { yes: 1, no: 0, empty: null, large: 9007199254740993n, bytes: [1, 2, 3] });
  const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
  for (const args of [["--help"], ["projects"]]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      encoding: "utf8", cwd: home,
      env: { ...process.env, HOME: home, USERPROFILE: home, GNOSYS_HOME: join(home, "brain"),
        GNOSYS_CONFIG_DIR: join(home, "config"), GNOSYS_LOCAL_ONLY: "1" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, args[0] === "--help" ? /Usage: gnosys/ : /No projects|Projects|projects/);
  }
  console.log(`${process.version}: SQLite, transactions, bindings, FTS5, WAL, CLI help and projects passed`);
} finally {
  db.close();
  rmSync(home, { recursive: true, force: true });
}
