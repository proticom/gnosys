/**
 * Regression tests for the v5.12.3 FTS implicit-AND bug.
 *
 * FTS5 treats space-separated terms as implicit AND, so the long
 * descriptive queries the tool docs encourage returned ZERO results
 * unless every term matched. The fix tries AND first (precision), then
 * retries with OR (recall, BM25-ranked) when AND finds nothing.
 *
 * Covers all four FTS surfaces: GnosysDB.searchFts / discoverFts
 * (central DB — also feeds recall + federated search), GnosysSearch
 * .search / .discover (per-store index), and GnosysArchive.searchArchive.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { GnosysSearch } from "../lib/search.js";
import { GnosysArchive } from "../lib/archive.js";
import {
  createTestEnv,
  cleanupTestEnv,
  makeMemory,
  makeFrontmatter,
  type TestEnv,
} from "./_helpers.js";

// Three memories with disjoint vocabularies so we can control which
// terms of a query hit which memory.
const SEED = [
  {
    id: "fts-auth-001",
    title: "JWT Authentication Middleware",
    relevance: "auth jwt middleware session tokens validation",
    content: "The auth middleware validates jwt session tokens on every request.",
  },
  {
    id: "fts-db-002",
    title: "Database Migration Schema",
    relevance: "database migration schema postgres versioning",
    content: "Database migrations apply schema changes with postgres versioning.",
  },
  {
    id: "fts-dep-003",
    title: "Deployment Pipeline",
    relevance: "deployment pipeline release rollout",
    content: "The deployment pipeline handles release rollout to production.",
  },
];

describe("GnosysDB FTS OR fallback (central DB)", () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv("fts-or");
    for (const m of SEED) {
      env.db.insertMemory(makeMemory({ ...m, tags: '["fts-test"]' }));
    }
  });

  afterAll(async () => {
    await cleanupTestEnv(env);
  });

  describe("discoverFts", () => {
    it("still matches when ALL terms are present (AND precision preserved)", () => {
      const results = env.db.discoverFts("auth jwt middleware");
      expect(results.map((r) => r.id)).toContain("fts-auth-001");
    });

    it("returns results for long multi-word queries where only some terms match (the v5.12.3 bug)", () => {
      // Pre-fix: implicit AND required every term → zero results.
      const results = env.db.discoverFts("auth jwt session tokens refresh oauth logout flows");
      expect(results.length).toBeGreaterThan(0);
      expect(results.map((r) => r.id)).toContain("fts-auth-001");
    });

    it("OR fallback ranks the best-covered memory first (BM25)", () => {
      // auth+jwt+middleware hit fts-auth-001 (3 terms); database hits fts-db-002 (1 term)
      const results = env.db.discoverFts("auth jwt middleware database nonexistentzzz");
      const ids = results.map((r) => r.id);
      expect(ids).toContain("fts-auth-001");
      expect(ids).toContain("fts-db-002");
      expect(ids[0]).toBe("fts-auth-001");
    });

    it("single-term queries behave as before", () => {
      const results = env.db.discoverFts("database");
      expect(results.map((r) => r.id)).toContain("fts-db-002");
    });

    it("punctuation-only and empty queries return empty, not throw", () => {
      expect(env.db.discoverFts("--- !!! ***")).toEqual([]);
      expect(env.db.discoverFts("")).toEqual([]);
      expect(env.db.discoverFts("*")).toEqual([]);
    });

    it("FTS5-hostile characters no longer cause syntax errors", () => {
      // Pre-fix these raw tokens were FTS5 syntax errors (silent empty result).
      // Quoted phrases make them safe; hyphenated tokens can now even match.
      expect(() => env.db.discoverFts("multi-word don't a:b NOT")).not.toThrow();
      const results = env.db.discoverFts("session-tokens auth");
      expect(results.map((r) => r.id)).toContain("fts-auth-001");
    });

    it("queries with zero matching terms still return empty", () => {
      expect(env.db.discoverFts("zzzqqq xxxyyy wwwvvv")).toEqual([]);
    });
  });

  describe("searchFts", () => {
    it("still matches when ALL terms are present (AND precision preserved)", () => {
      const results = env.db.searchFts("deployment pipeline");
      expect(results.map((r) => r.id)).toContain("fts-dep-003");
    });

    it("returns results for multi-word queries where only some terms match", () => {
      // Pre-fix: implicit AND → zero results.
      const results = env.db.searchFts("deployment pipeline kubernetes helm argo");
      expect(results.map((r) => r.id)).toContain("fts-dep-003");
    });

    it("single-term queries behave as before", () => {
      const results = env.db.searchFts("postgres");
      expect(results.map((r) => r.id)).toContain("fts-db-002");
    });

    it("punctuation-only queries return empty", () => {
      expect(env.db.searchFts("--- !!!")).toEqual([]);
    });
  });
});

describe("GnosysSearch FTS OR fallback (per-store index)", () => {
  let env: TestEnv;
  let search: GnosysSearch;

  beforeAll(async () => {
    env = await createTestEnv("fts-or-store");
    search = new GnosysSearch(env.tmpDir);
    search.addDbMemories(
      SEED.map((m) => ({
        id: m.id,
        title: m.title,
        category: "decisions",
        tags: '["fts-test"]',
        relevance: m.relevance,
        content: m.content,
      }))
    );
  });

  afterAll(async () => {
    search.close();
    await cleanupTestEnv(env);
  });

  it("search: multi-word query with partial term match returns results (the v5.12.3 bug)", () => {
    const results = search.search("auth jwt session tokens refresh oauth logout");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("JWT Authentication Middleware");
  });

  it("search: AND precision preserved when all terms match", () => {
    const results = search.search("database migration schema");
    expect(results.map((r) => r.title)).toContain("Database Migration Schema");
  });

  it("discover: long multi-word query returns ranked results (the v5.12.3 bug)", () => {
    const results = search.discover("deployment pipeline canary blue green rollback strategies");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Deployment Pipeline");
  });

  it("discover: AND precision preserved when all terms match", () => {
    const results = search.discover("auth jwt middleware");
    expect(results.map((r) => r.title)).toContain("JWT Authentication Middleware");
  });

  it("discover: punctuation-only query returns empty, not throw", () => {
    expect(search.discover("--- !!!")).toEqual([]);
  });
});

describe("GnosysArchive FTS OR fallback (archive tier)", () => {
  let env: TestEnv;
  let archive: GnosysArchive;

  beforeAll(async () => {
    env = await createTestEnv("fts-or-archive");
    archive = new GnosysArchive(env.tmpDir);
    for (const m of SEED) {
      await archive.archiveMemory({
        frontmatter: makeFrontmatter({ id: m.id, title: m.title, relevance: m.relevance }),
        content: m.content,
        filePath: `/tmp/${m.id}.md`,
        relativePath: `decisions/${m.id}.md`,
      });
    }
  });

  afterAll(async () => {
    archive.close();
    await cleanupTestEnv(env);
  });

  it("multi-word query with partial term match returns archived results (the v5.12.3 bug)", () => {
    const results = archive.searchArchive("auth jwt session tokens refresh oauth logout");
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.id)).toContain("fts-auth-001");
  });

  it("AND precision preserved when all terms match", () => {
    const results = archive.searchArchive("deployment pipeline");
    expect(results.map((r) => r.id)).toContain("fts-dep-003");
  });

  it("punctuation-only query returns empty", () => {
    expect(archive.searchArchive("--- !!!")).toEqual([]);
  });
});
