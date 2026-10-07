/**
 * QA 2026-10-06 bug 3: opening a v1-shaped database that has no memories_fts
 * table migrated it to the current user_version but never indexed the
 * existing rows, so FTS search (gnosys_search's DB fast path) missed them.
 * The migration must backfill FTS for rows missing from memories_fts, and
 * running it again must not duplicate index rows.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { GnosysDB } from "../lib/db.js";

let tmp: string;
let dbFile: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-fts-backfill-"));
  dbFile = path.join(tmp, "gnosys.db");
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const V1_MEMORIES_SQL = `
  CREATE TABLE memories (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    category            TEXT NOT NULL,
    content             TEXT NOT NULL,
    summary             TEXT,
    tags                TEXT DEFAULT '',
    relevance           TEXT DEFAULT '',
    author              TEXT NOT NULL DEFAULT 'ai',
    authority           TEXT NOT NULL DEFAULT 'imported',
    confidence          REAL DEFAULT 0.8,
    reinforcement_count INTEGER DEFAULT 0,
    content_hash        TEXT NOT NULL,
    status              TEXT DEFAULT 'active',
    tier                TEXT DEFAULT 'active',
    supersedes          TEXT,
    superseded_by       TEXT,
    last_reinforced     TEXT,
    created             TEXT NOT NULL,
    modified            TEXT NOT NULL,
    embedding           BLOB,
    source_path         TEXT
  );
`;

/** A v1 DB: memories rows, user_version=1, and no memories_fts table. */
function seedV1WithoutFts(ids: string[]): void {
  const raw = new Database(dbFile);
  raw.exec(V1_MEMORIES_SQL);
  const insert = raw.prepare(`
    INSERT INTO memories (id, title, category, content, tags, relevance, content_hash, created, modified)
    VALUES (?, ?, 'decisions', ?, '[]', ?, ?, '2026-01-01', '2026-01-01')
  `);
  for (const id of ids) {
    insert.run(id, `Legacy ${id}`, `# Legacy ${id}\n\nwombatlantern body for ${id}`, `wombatlantern ${id}`, `hash-${id}`);
  }
  raw.pragma("user_version = 1");
  raw.close();
}

function ftsIds(): Array<string | null> {
  const raw = new Database(dbFile, { readonly: true });
  try {
    return (raw.prepare("SELECT id FROM memories_fts ORDER BY id").all() as Array<{ id: string | null }>).map((r) => r.id);
  } finally {
    raw.close();
  }
}

function userVersion(): number {
  const raw = new Database(dbFile, { readonly: true });
  try {
    return raw.pragma("user_version", { simple: true }) as number;
  } finally {
    raw.close();
  }
}

describe("v1 database without memories_fts", () => {
  it("indexes existing rows during migration so FTS search finds them", () => {
    seedV1WithoutFts(["deci-001", "deci-002"]);

    const db = new GnosysDB(tmp);
    try {
      const hits = db.searchFts("wombatlantern", 10).map((r) => r.id).sort();
      expect(hits).toEqual(["deci-001", "deci-002"]);
      expect(db.discoverFts("wombatlantern", 10).map((r) => r.id).sort()).toEqual(["deci-001", "deci-002"]);
    } finally {
      db.close();
    }
    expect(userVersion()).toBe(5);
    expect(ftsIds()).toEqual(["deci-001", "deci-002"]);
  });

  it("does not duplicate index rows when the database is reopened", () => {
    seedV1WithoutFts(["deci-001", "deci-002"]);
    new GnosysDB(tmp).close();
    new GnosysDB(tmp).close();
    expect(ftsIds()).toEqual(["deci-001", "deci-002"]);
  });

  it("backfills only the rows missing from a partial index", () => {
    seedV1WithoutFts(["deci-001", "deci-002", "deci-003"]);
    const raw = new Database(dbFile);
    raw.exec(`
      CREATE VIRTUAL TABLE memories_fts USING fts5(
        id, title, category, tags, relevance, content, summary,
        tokenize='porter unicode61'
      );
      INSERT INTO memories_fts(id, title, category, tags, relevance, content, summary)
        SELECT id, title, category, tags, relevance, content, summary FROM memories WHERE id = 'deci-002';
    `);
    raw.close();

    new GnosysDB(tmp).close();
    expect(ftsIds()).toEqual(["deci-001", "deci-002", "deci-003"]);
  });

  it("still backfills when the index holds a NULL id row", () => {
    seedV1WithoutFts(["deci-001", "deci-002"]);
    const raw = new Database(dbFile);
    raw.exec(`
      CREATE VIRTUAL TABLE memories_fts USING fts5(
        id, title, category, tags, relevance, content, summary,
        tokenize='porter unicode61'
      );
      INSERT INTO memories_fts(id, title, category, tags, relevance, content, summary)
        VALUES (NULL, 'orphan', 'decisions', '', '', 'orphan', NULL);
    `);
    raw.close();

    const db = new GnosysDB(tmp);
    try {
      expect(db.searchFts("wombatlantern", 10).map((row) => row.id).sort()).toEqual(["deci-001", "deci-002"]);
    } finally {
      db.close();
    }
    expect(ftsIds()).toEqual(["deci-001", "deci-002"]);
  });

  it("repairs duplicates and backfills missing rows together without duplicating on reopen", () => {
    seedV1WithoutFts(["deci-001", "deci-002"]);
    const raw = new Database(dbFile);
    raw.exec(`
      CREATE VIRTUAL TABLE memories_fts USING fts5(
        id, title, category, tags, relevance, content, summary,
        tokenize='porter unicode61'
      );
      INSERT INTO memories_fts SELECT id, title, category, tags, relevance, content, summary
        FROM memories WHERE id = 'deci-001';
      INSERT INTO memories_fts SELECT id, title, category, tags, relevance, content, summary
        FROM memories WHERE id = 'deci-001';
    `);
    raw.close();

    for (let open = 0; open < 2; open++) {
      const db = new GnosysDB(tmp);
      try {
        expect(db.searchFts("wombatlantern", 10).map((row) => row.id).sort()).toEqual(["deci-001", "deci-002"]);
        expect(db.discoverFts("wombatlantern", 10).map((row) => row.id).sort()).toEqual(["deci-001", "deci-002"]);
      } finally {
        db.close();
      }
      expect(userVersion()).toBe(5);
      expect(ftsIds()).toEqual(["deci-001", "deci-002"]);
    }
  });

  it("opens a legacy DB whose memories table lacks an FTS source column", () => {
    const raw = new Database(dbFile);
    raw.exec(V1_MEMORIES_SQL.replace("    summary             TEXT,\n", ""));
    raw.prepare(`
      INSERT INTO memories (id, title, category, content, content_hash, created, modified)
      VALUES ('deci-001', 'No summary column', 'decisions', 'body', 'h', '2026-01-01', '2026-01-01')
    `).run();
    raw.pragma("user_version = 1");
    raw.close();

    const db = new GnosysDB(tmp);
    try {
      expect(db.isAvailable()).toBe(true);
      expect(db.getMemory("deci-001")?.title).toBe("No summary column");
    } finally {
      db.close();
    }
  });
});
