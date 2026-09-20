import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { GnosysDbSearch } from "../lib/dbSearch.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => { env = await createTestEnv("fts-adversarial"); });
afterEach(async () => { await cleanupTestEnv(env); });

describe("FTS duplicate attacks", () => {
  it("G2-D002: three writes yield one hit in FTS, discover, archive and hybrid keyword search", async () => {
    const memory = makeMemory({ id: "fts-repeat", title: "Cobalt lantern", content: "cobalt lantern evidence", relevance: "cobalt lantern", tier: "archive", status: "archived" });
    for (let attempt = 0; attempt < 3; attempt++) env.db.insertMemory(memory);
    env.db.insertMemory(makeMemory({ id: "semantic-anchor", content: "unrelated active record", embedding: Buffer.from(new Float32Array([1, 0]).buffer) }));
    const search = new GnosysDbSearch(env.db);
    const observed = {
      stored: env.db.getAllMemories().map(row => [row.id, row.content]).sort(),
      fts: env.db.searchFts("cobalt").map(row => row.id),
      discover: env.db.discoverFts("cobalt").map(row => row.id),
      archive: (await search.hybridSearch("cobalt", 20, "semantic", async () => new Float32Array([1, 0]))).filter(row => row.fromArchive).map(row => row.memoryId),
      hybrid: (await search.hybridSearch("cobalt", 20, "keyword")).map(row => row.memoryId),
    };
    expect(observed, JSON.stringify(observed)).toEqual({
      stored: [["fts-repeat", "cobalt lantern evidence"], ["semantic-anchor", "unrelated active record"]],
      fts: ["fts-repeat"],
      discover: ["fts-repeat"],
      archive: ["fts-repeat"],
      hybrid: ["fts-repeat"],
    });
  });

  it("G2-D002: opening a populated v5 database heals duplicate FTS rows once without losing memories", () => {
    env.db.close();
    const file = path.join(env.tmpDir, "gnosys.db");
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
    const witness = new Database(file);
    try {
      witness.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA user_version = 5;
        CREATE TABLE memories (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
          content TEXT NOT NULL, summary TEXT, tags TEXT, relevance TEXT,
          author TEXT, authority TEXT, confidence REAL, reinforcement_count INTEGER,
          content_hash TEXT, status TEXT, tier TEXT, supersedes TEXT, superseded_by TEXT,
          last_reinforced TEXT, created TEXT, modified TEXT, embedding BLOB,
          source_path TEXT, source_file TEXT, source_page TEXT, source_timerange TEXT,
          attachment_data BLOB, attachment_mime TEXT, attachment_name TEXT,
          project_id TEXT, scope TEXT
        );
        CREATE VIRTUAL TABLE memories_fts USING fts5(
          id, title, category, tags, relevance, content, summary,
          tokenize='porter unicode61'
        );
      `);
      for (const memory of [
        makeMemory({ id: "legacy-cobalt", title: "Cobalt lantern", content: "cobalt legacy evidence" }),
        makeMemory({ id: "legacy-quartz", title: "Quartz ledger", content: "quartz untouched evidence" }),
      ]) {
        const fields = Object.keys(memory);
        witness.prepare(`INSERT INTO memories (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...Object.values(memory));
      }
      const copyFts = witness.prepare("INSERT INTO memories_fts(id,title,category,tags,relevance,content,summary) SELECT id,title,category,tags,relevance,content,summary FROM memories WHERE id = ?");
      for (let attempt = 0; attempt < 3; attempt++) copyFts.run("legacy-cobalt");
      copyFts.run("legacy-quartz");
      expect(witness.prepare("SELECT id, count(*) AS hits FROM memories_fts GROUP BY id ORDER BY id").all()).toEqual([
        { id: "legacy-cobalt", hits: 3 }, { id: "legacy-quartz", hits: 1 },
      ]);

      env.db = new GnosysDB(env.tmpDir);
      const healed = {
        indexRows: witness.prepare("SELECT id, count(*) AS hits FROM memories_fts GROUP BY id ORDER BY id").all(),
        cobalt: env.db.searchFts("cobalt").map(row => row.id),
        quartz: env.db.searchFts("quartz").map(row => row.id),
        contents: env.db.getAllMemories().map(row => [row.id, row.content]).sort(),
        version: witness.pragma("user_version", { simple: true }),
        marker: witness.prepare("SELECT value FROM gnosys_meta WHERE key = 'memories_fts_unique_id_v1'").get(),
      };
      expect(healed, JSON.stringify(healed)).toEqual({
        indexRows: [{ id: "legacy-cobalt", hits: 1 }, { id: "legacy-quartz", hits: 1 }],
        cobalt: ["legacy-cobalt"], quartz: ["legacy-quartz"],
        contents: [["legacy-cobalt", "cobalt legacy evidence"], ["legacy-quartz", "quartz untouched evidence"]],
        version: 5,
        marker: { value: "1" },
      });
      env.db.close();
      const versionAfterHealing = witness.pragma("data_version", { simple: true });
      env.db = new GnosysDB(env.tmpDir);
      expect({
        dataVersion: witness.pragma("data_version", { simple: true }),
        schemaVersion: witness.pragma("user_version", { simple: true }),
        cobalt: env.db.searchFts("cobalt").map(row => row.id),
        quartz: env.db.searchFts("quartz").map(row => row.id),
      }).toEqual({ dataVersion: versionAfterHealing, schemaVersion: 5, cobalt: ["legacy-cobalt"], quartz: ["legacy-quartz"] });
    } finally {
      witness.close();
    }
  });

  it.fails("ADV-FTS-001: reopening after external FTS loss keeps the existing memory searchable", () => {
    env.db.insertMemory(makeMemory({ id: "fts-recovery", title: "Saffron restoration", content: "saffron survives index loss" }));
    const witness = new Database(path.join(env.tmpDir, "gnosys.db"));
    try {
      expect(env.db.searchFts("saffron").map(row => row.id)).toEqual(["fts-recovery"]);
      witness.exec("DROP TABLE memories_fts");
      expect(env.db.searchFts("saffron").map(row => row.id)).toEqual(["fts-recovery"]);
      env.db.reopen();
      const observed = {
        memory: env.db.getMemory("fts-recovery")?.content,
        search: env.db.searchFts("saffron").map(row => row.id),
        version: witness.pragma("user_version", { simple: true }),
      };
      expect(observed, JSON.stringify(observed)).toEqual({ memory: "saffron survives index loss", search: ["fts-recovery"], version: 5 });
    } finally { witness.close(); }
  });
});
