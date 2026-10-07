/**
 * Phase 9d Tests — Test Coverage Audit + CI Overhaul
 *
 * Adds comprehensive tests for previously uncovered v3 modules:
 *
 * TC-9d.1: GnosysDbSearch — FTS5 adapter, keyword/hybrid modes, archive tier
 * TC-9d.2: dbWrite — sync functions, tag serialization, tier transitions
 * TC-9d.3: Audit — init, log, read, filter, timeline formatting
 * TC-9d.4: Lock — acquire/release, stale detection, timeout
 * TC-9d.5: ProjectIdentity — create, read, mismatch detection, walk-up
 * TC-9d.6: Multi-project scenarios — cross-project isolation, working-set CLI
 * TC-9d.7: Helpers library — factory functions, seeding
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import {
  createTestEnv,
  cleanupTestEnv,
  type TestEnv,
  makeMemory,
  makeProject,
  makeFrontmatter,
  seedMultiProjectMemories,
  cliInit,
  cli,
  extractJson,
} from "./_helpers.js";
import { GnosysDbSearch } from "../lib/dbSearch.js";
import {
  syncMemoryToDb,
  syncUpdateToDb,
  syncArchiveToDb,
  syncDearchiveToDb,
  syncDeleteToDb,
  syncReinforcementToDb,
  syncConfidenceToDb,
  auditToDb,
} from "../lib/dbWrite.js";
import {
  initAudit,
  auditLog,
  readAuditLog,
  formatAuditTimeline,
  closeAudit,
} from "../lib/audit.js";
import { acquireWriteLock, enableWAL } from "../lib/lock.js";
import {
  createProjectIdentity,
  readProjectIdentity,
  writeProjectIdentity,
  checkDirectoryMismatch,
  findProjectIdentity,
  detectAgentRulesTarget,
} from "../lib/projectIdentity.js";
import { loadGraph, formatGraphStats, type GraphStats } from "../lib/graph.js";

// ─── TC-9d.1: GnosysDbSearch ─────────────────────────────────────────

describe("TC-9d.1: GnosysDbSearch — FTS5 adapter", () => {
  let env: TestEnv;
  let search: GnosysDbSearch;

  beforeEach(async () => {
    env = await createTestEnv("9d-dbsearch");
    search = new GnosysDbSearch(env.db);

    // Seed test data
    env.db.insertMemory(makeMemory({
      id: "search-1",
      title: "Authentication with JWT tokens",
      content: "JWT tokens provide stateless authentication for REST APIs.",
      relevance: "auth jwt tokens rest api authentication",
    }));

    env.db.insertMemory(makeMemory({
      id: "search-2",
      title: "Database schema design patterns",
      content: "Normalization vs denormalization tradeoffs in PostgreSQL.",
      relevance: "database schema design patterns postgresql",
    }));

    env.db.insertMemory(makeMemory({
      id: "search-3",
      title: "Archived deployment notes",
      content: "Legacy deployment pipeline using Jenkins.",
      relevance: "deployment jenkins pipeline legacy",
      tier: "archive",
      status: "archived",
    }));
  });

  afterEach(async () => await cleanupTestEnv(env));

  it("search() returns FTS5 results as SearchResult format", () => {
    const results = search.search("authentication", 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toHaveProperty("relative_path");
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]).toHaveProperty("rank");
    expect(results[0].relative_path).toBe("search-1");
  });

  it("discover() returns the matching memory metadata", () => {
    const results = search.discover("database", 10);
    expect(results.map(({ relative_path, title, relevance }) => ({ relative_path, title, relevance }))).toEqual([
      { relative_path: "search-2", title: "Database schema design patterns", relevance: "database schema design patterns postgresql" }
    ]);
  });

  it("hybridSearch() keyword mode returns ranked results", async () => {
    const results = await search.hybridSearch("jwt authentication", 10, "keyword");
    expect(results.map(({ relativePath, title, sources, fromArchive }) => ({ relativePath, title, sources, fromArchive }))).toEqual([
      { relativePath: "search-1", title: "Authentication with JWT tokens", sources: ["keyword"], fromArchive: false }
    ]);
    expect(results[0].score).toBeCloseTo(0.01639344262295082, 12);
  });

  it("hybridSearch() falls back to keyword when no embeddings", async () => {
    const results = await search.hybridSearch("authentication", 10, "hybrid");
    expect(results.map(({ relativePath, title, sources, fromArchive }) => ({ relativePath, title, sources, fromArchive }))).toEqual([
      { relativePath: "search-1", title: "Authentication with JWT tokens", sources: ["keyword"], fromArchive: false }
    ]);
    expect(results[0].score).toBeCloseTo(0.01639344262295082, 12);
  });

  it("hybridSearch() semantic mode returns empty when no embeddings", async () => {
    const results = await search.hybridSearch("authentication", 10, "semantic");
    expect(results).toEqual([]);
  });

  it("loadContent() fills in full content from DB", () => {
    const results = search.search("authentication", 5).map(r => ({
      relativePath: r.relative_path,
      title: r.title,
      snippet: r.snippet,
      score: 0.5,
      sources: ["keyword" as const],
      memoryId: r.relative_path,
      fromArchive: false,
    }));

    const loaded = search.loadContent(results);
    expect(loaded[0].fullContent).toContain("JWT tokens");
  });

  it("getMemory() returns a memory by ID", () => {
    const mem = search.getMemory("search-1");
    expect(mem).not.toBeNull();
    expect(mem!.title).toBe("Authentication with JWT tokens");
  });

  it("getMemory() returns null for unknown ID", () => {
    const mem = search.getMemory("nonexistent");
    expect(mem).toBeNull();
  });

  it("hasEmbeddings() returns false when no embeddings stored", () => {
    expect(search.hasEmbeddings()).toBe(false);
  });

  it("embeddingCount() returns 0 when no embeddings stored", () => {
    expect(search.embeddingCount()).toBe(0);
  });

  it("search respects limit parameter", () => {
    for (let i = 10; i < 20; i++) env.db.insertMemory(makeMemory({ id: `limit-test-${i}`, title: `Limit test memory ${i}`, content: "boundedresult", relevance: "boundedresult" }));
    expect(search.search("boundedresult", 3).map(row => row.relative_path)).toEqual(["limit-test-10", "limit-test-11", "limit-test-12"]);
  });
});

// ─── TC-9d.2: dbWrite — sync functions ───────────────────────────────

describe("TC-9d.2: dbWrite — sync functions", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await createTestEnv("9d-dbwrite");
  });

  afterEach(async () => await cleanupTestEnv(env));

  it("syncMemoryToDb inserts a memory from frontmatter", () => {
    const fm = makeFrontmatter({
      id: "sync-001",
      title: "Synced Memory",
      category: "decisions",
      tags: { domain: ["testing"], type: ["decision"] },
      relevance: "sync test write",
      confidence: 0.85,
    });

    syncMemoryToDb(env.db, fm, "This is the synced content.", "/path/to/file.md");

    const mem = env.db.getMemory("sync-001");
    expect(mem).not.toBeNull();
    expect(mem!.title).toBe("Synced Memory");
    expect(mem!.content).toBe("This is the synced content.");
    expect(mem!.confidence).toBe(0.85);
    expect(mem!.source_path).toBe("/path/to/file.md");
    expect(mem!.tier).toBe("active");
  });

  it("syncMemoryToDb handles array tags correctly", () => {
    const fm = makeFrontmatter({
      id: "sync-tags-arr",
      tags: ["tag1", "tag2", "tag3"] as any,
    });

    syncMemoryToDb(env.db, fm, "Content");
    const mem = env.db.getMemory("sync-tags-arr");
    expect(mem).not.toBeNull();
    const tags = JSON.parse(mem!.tags);
    expect(tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("syncMemoryToDb handles object tags by flattening", () => {
    const fm = makeFrontmatter({
      id: "sync-tags-obj",
      tags: { domain: ["ai", "testing"], type: ["unit-test"] },
    });

    syncMemoryToDb(env.db, fm, "Content");
    const mem = env.db.getMemory("sync-tags-obj");
    expect(mem).not.toBeNull();
    const tags = JSON.parse(mem!.tags);
    expect(tags).toContain("ai");
    expect(tags).toContain("testing");
    expect(tags).toContain("unit-test");
  });

  it("syncMemoryToDb sets tier=archive for archived status", () => {
    const fm = makeFrontmatter({
      id: "sync-archived",
      status: "archived",
    });

    syncMemoryToDb(env.db, fm, "Old content");
    const mem = env.db.getMemory("sync-archived");
    expect(mem!.tier).toBe("archive");
  });

  it("syncMemoryToDb accepts projectId and scope", () => {
    const fm = makeFrontmatter({ id: "sync-scoped" });

    syncMemoryToDb(env.db, fm, "Content", undefined, "proj-123", "user");
    const mem = env.db.getMemory("sync-scoped");
    expect(mem!.project_id).toBe("proj-123");
    expect(mem!.scope).toBe("user");
  });

  it("syncUpdateToDb updates partial fields", () => {
    env.db.insertMemory(makeMemory({
      id: "upd-001",
      title: "Original Title",
      confidence: 0.9,
    }));

    syncUpdateToDb(env.db, "upd-001", { title: "Updated Title", confidence: 0.7 });

    const mem = env.db.getMemory("upd-001");
    expect(mem!.title).toBe("Updated Title");
    expect(mem!.confidence).toBe(0.7);
  });

  it("syncUpdateToDb updates content and hash", () => {
    env.db.insertMemory(makeMemory({
      id: "upd-002",
      content: "Original content",
      content_hash: "old-hash",
    }));

    syncUpdateToDb(env.db, "upd-002", {}, "a");

    const mem = env.db.getMemory("upd-002");
    expect(mem!.content).toBe("a");
    expect(mem!.content_hash).toBe("e40c292c");
  });

  it("syncArchiveToDb sets tier and status to archive", () => {
    env.db.insertMemory(makeMemory({ id: "arch-001", tier: "active", status: "active" }));

    syncArchiveToDb(env.db, "arch-001");

    const mem = env.db.getMemory("arch-001");
    expect(mem!.tier).toBe("archive");
    expect(mem!.status).toBe("archived");
  });

  it("syncDearchiveToDb restores tier and status to active", () => {
    env.db.insertMemory(makeMemory({ id: "dearch-001", tier: "archive", status: "archived" }));

    syncDearchiveToDb(env.db, "dearch-001");

    const mem = env.db.getMemory("dearch-001");
    expect(mem!.tier).toBe("active");
    expect(mem!.status).toBe("active");
  });

  it("syncDeleteToDb removes memory from DB", () => {
    env.db.insertMemory(makeMemory({ id: "del-001" }));
    expect(env.db.getMemory("del-001")).not.toBeNull();

    syncDeleteToDb(env.db, "del-001");
    expect(env.db.getMemory("del-001")).toBeNull();
  });

  it("syncReinforcementToDb updates count and timestamp", () => {
    env.db.insertMemory(makeMemory({ id: "reinf-001", reinforcement_count: 2 }));

    syncReinforcementToDb(env.db, "reinf-001", 3);

    const mem = env.db.getMemory("reinf-001");
    expect(mem!.reinforcement_count).toBe(3);
    expect(mem!.last_reinforced).not.toBeNull();
  });

  it("syncConfidenceToDb updates confidence", () => {
    env.db.insertMemory(makeMemory({ id: "conf-001", confidence: 0.9 }));

    syncConfidenceToDb(env.db, "conf-001", 0.45);

    const mem = env.db.getMemory("conf-001");
    expect(mem!.confidence).toBe(0.45);
  });

  it("auditToDb persists operation details and rounded duration", () => {
    auditToDb(env.db, "search", "mem-123", { query: "test" }, 42.5, "trace-abc");
    expect(env.db.getAuditLog("mem-123").map(({ operation, memory_id, details, duration_ms, trace_id }) => ({ operation, memory_id, details, duration_ms, trace_id }))).toEqual([
      { operation: "search", memory_id: "mem-123", details: '{"query":"test"}', duration_ms: 43, trace_id: "trace-abc" }
    ]);
  });
});

// ─── TC-9d.3: Audit — log, read, filter, format ─────────────────────

describe("TC-9d.3: Audit — init, log, read, filter, format", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-audit-"));
    fs.mkdirSync(path.join(tmpDir, ".config"), { recursive: true });
  });

  afterEach(() => {
    closeAudit();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initAudit creates audit.jsonl and subsequent logs are readable", async () => {
    initAudit(tmpDir);

    auditLog({ operation: "search", query: "test query", resultCount: 5 });
    auditLog({ operation: "write", memoryId: "mem-001" });
    auditLog({ operation: "recall", query: "recall query", resultCount: 3, durationMs: 12.5 });

    // Wait for write stream to flush
    await new Promise(r => setTimeout(r, 100));
    closeAudit();

    const entries = readAuditLog(tmpDir);
    expect(entries.length).toBe(3);
    expect(entries[0].operation).toBe("search");
    expect(entries[0].query).toBe("test query");
    expect(entries[1].operation).toBe("write");
    expect(entries[1].memoryId).toBe("mem-001");
    expect(entries[2].durationMs).toBe(12.5);
  });

  it("readAuditLog returns empty array when no log exists", () => {
    const noLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-nolog-"));
    try {
      const entries = readAuditLog(noLogDir);
      expect(entries).toEqual([]);
    } finally {
      fs.rmSync(noLogDir, { recursive: true, force: true });
    }
  });

  it("readAuditLog filters by operation", async () => {
    initAudit(tmpDir);
    auditLog({ operation: "search", query: "q1" });
    auditLog({ operation: "write", memoryId: "m1" });
    auditLog({ operation: "search", query: "q2" });

    await new Promise(r => setTimeout(r, 100));
    closeAudit();

    const entries = readAuditLog(tmpDir, { operation: "search" });
    expect(entries.length).toBe(2);
    expect(entries.every(e => e.operation === "search")).toBe(true);
  });

  it("readAuditLog filters by limit (most recent)", async () => {
    initAudit(tmpDir);
    for (let i = 0; i < 10; i++) {
      auditLog({ operation: "search", query: `q${i}` });
    }

    await new Promise(r => setTimeout(r, 100));
    closeAudit();

    const entries = readAuditLog(tmpDir, { limit: 3 });
    expect(entries.length).toBe(3);
    // Should be the last 3
    expect(entries[0].query).toBe("q7");
    expect(entries[2].query).toBe("q9");
  });

  it("readAuditLog handles malformed lines gracefully", () => {
    const logPath = path.join(tmpDir, ".config", "audit.jsonl");
    fs.writeFileSync(logPath, [
      JSON.stringify({ timestamp: "2026-03-12T00:00:00Z", operation: "search" }),
      "INVALID JSON LINE",
      JSON.stringify({ timestamp: "2026-03-12T00:01:00Z", operation: "write" }),
    ].join("\n") + "\n");

    const entries = readAuditLog(tmpDir);
    expect(entries).toEqual([{ timestamp: "2026-03-12T00:00:00Z", operation: "search" }, { timestamp: "2026-03-12T00:01:00Z", operation: "write" }]);
  });

  it("formatAuditTimeline groups by date with summary", () => {
    const entries = [
      { timestamp: "2026-03-12T10:00:00Z", operation: "search" as const, query: "test", resultCount: 5 },
      { timestamp: "2026-03-12T10:05:00Z", operation: "write" as const, memoryId: "mem-001" },
      { timestamp: "2026-03-12T10:10:00Z", operation: "search" as const, query: "another", durationMs: 3.2 },
    ];

    const output = formatAuditTimeline(entries);
    expect(output).toContain("3 operations");
    expect(output).toContain("2026-03-12");
    expect(output).toContain("SEARCH");
    expect(output).toContain("WRITE");
    expect(output).toContain("Summary:");
    expect(output).toContain("search: 2");
    expect(output).toContain("write: 1");
  });

  it("formatAuditTimeline handles empty entries", () => {
    const output = formatAuditTimeline([]);
    expect(output).toContain("No audit entries found");
  });
});

// ─── TC-9d.4: Lock — acquire, release, stale detection ──────────────

describe("TC-9d.4: Lock — acquire/release and stale detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-lock-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("acquireWriteLock creates lock file and release removes it", async () => {
    const lockPath = path.join(tmpDir, ".config", "write.lock");
    const release = await acquireWriteLock(tmpDir, "test-op");

    expect(fs.existsSync(lockPath)).toBe(true);
    const info = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    expect(info.pid).toBe(process.pid);
    expect(info.operation).toBe("test-op");

    release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("acquireWriteLock detects stale lock from dead process", async () => {
    const configDir = path.join(tmpDir, ".config");
    fs.mkdirSync(configDir, { recursive: true });
    const lockPath = path.join(configDir, "write.lock");

    // Create a lock file with a non-existent PID
    const staleLock = {
      pid: 999999999,  // Very unlikely to be running
      timestamp: Date.now(),
      operation: "stale-op",
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleLock));

    // Should succeed — stale lock from dead PID gets cleaned up
    const release = await acquireWriteLock(tmpDir, "new-op");
    expect(fs.existsSync(lockPath)).toBe(true);

    const info = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    expect(info.pid).toBe(process.pid); // Our PID, not the stale one
    expect(info.operation).toBe("new-op");

    release();
  });

  it("acquireWriteLock detects stale lock from old timestamp", async () => {
    const configDir = path.join(tmpDir, ".config");
    fs.mkdirSync(configDir, { recursive: true });
    const lockPath = path.join(configDir, "write.lock");

    // Create a lock file with old timestamp (>2 minutes ago)
    const staleLock = {
      pid: process.pid, // Current PID but old timestamp
      timestamp: Date.now() - 200_000, // 200 seconds ago (> 120s stale threshold)
      operation: "ancient-op",
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleLock));

    // Should succeed — stale lock gets cleaned up
    const release = await acquireWriteLock(tmpDir, "fresh-op");
    const info = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    expect(info.operation).toBe("fresh-op");
    release();
  });

  it("release function is idempotent", async () => {
    const release = await acquireWriteLock(tmpDir, "test");
    release();
    release();
    expect(fs.existsSync(path.join(tmpDir, ".config", "write.lock"))).toBe(false);
    const releaseNext = await acquireWriteLock(tmpDir, "next");
    try { expect(JSON.parse(fs.readFileSync(path.join(tmpDir, ".config", "write.lock"), "utf8")).operation).toBe("next"); }
    finally { releaseNext(); }
  });

  it("creates .config directory if it doesn't exist", async () => {
    const configDir = path.join(tmpDir, ".config");
    expect(fs.existsSync(configDir)).toBe(false);

    const release = await acquireWriteLock(tmpDir, "test");
    expect(fs.existsSync(configDir)).toBe(true);
    release();
  });
});

// ─── TC-9d.5: ProjectIdentity ────────────────────────────────────────

describe("TC-9d.5: ProjectIdentity — create, read, mismatch, walk-up", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-identity-"));
    fs.mkdirSync(path.join(tmpDir, ".gnosys"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("createProjectIdentity creates identity file and returns it", async () => {
    const identity = await createProjectIdentity(tmpDir, { projectName: "TestProject" });
    expect(identity.projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, ".gnosys", "gnosys.json"), "utf8"))).toMatchObject({ projectName: "TestProject", workingDirectory: tmpDir, schemaVersion: 1 });
  });

  it("createProjectIdentity reuses existing projectId", async () => {
    const first = await createProjectIdentity(tmpDir, { projectName: "First" });
    await writeProjectIdentity(tmpDir, { ...first, projectId: "11111111-1111-4111-8111-111111111111" });
    const second = await createProjectIdentity(tmpDir, { projectName: "Renamed" });
    expect(second.projectId).toBe("11111111-1111-4111-8111-111111111111");
    expect((await readProjectIdentity(tmpDir))?.projectName).toBe("Renamed");
  });

  it("readProjectIdentity reads valid identity", async () => {
    await createProjectIdentity(tmpDir, { projectName: "Readable" });
    const identity = await readProjectIdentity(tmpDir);

    expect(identity).not.toBeNull();
    expect(identity!.projectName).toBe("Readable");
  });

  it("readProjectIdentity returns null for missing file", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-empty-"));
    try {
      const identity = await readProjectIdentity(emptyDir);
      expect(identity).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("readProjectIdentity returns null for invalid JSON", async () => {
    const identityPath = path.join(tmpDir, ".gnosys", "gnosys.json");
    fs.writeFileSync(identityPath, "{ not valid json");
    const identity = await readProjectIdentity(tmpDir);
    expect(identity).toBeNull();
  });

  it("readProjectIdentity returns null for missing required fields", async () => {
    const identityPath = path.join(tmpDir, ".gnosys", "gnosys.json");
    fs.writeFileSync(identityPath, JSON.stringify({ projectId: "123" })); // Missing projectName + workingDirectory
    const identity = await readProjectIdentity(tmpDir);
    expect(identity).toBeNull();
  });

  it("checkDirectoryMismatch detects when directory has moved", async () => {
    // Create identity with a different working directory
    const identity = await createProjectIdentity(tmpDir, { projectName: "Moved" });
    // Manually rewrite with a fake directory
    identity.workingDirectory = "/some/old/path";
    await writeProjectIdentity(tmpDir, identity);

    const result = await checkDirectoryMismatch(tmpDir);
    expect(result.mismatch).toBe(true);
    expect(result.identity).not.toBeNull();
    expect(result.currentDir).toBe(path.resolve(tmpDir));
  });

  it("checkDirectoryMismatch returns false when directory matches", async () => {
    await createProjectIdentity(tmpDir);
    const result = await checkDirectoryMismatch(tmpDir);
    expect(result.mismatch).toBe(false);
  });

  it("checkDirectoryMismatch returns false with no identity", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-noid-"));
    try {
      const result = await checkDirectoryMismatch(emptyDir);
      expect(result.mismatch).toBe(false);
      expect(result.identity).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("findProjectIdentity walks up directory tree", async () => {
    await createProjectIdentity(tmpDir, { projectName: "Root" });

    // Create nested subdirectory
    const subDir = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(subDir, { recursive: true });

    const found = await findProjectIdentity(subDir);
    expect(found).not.toBeNull();
    expect(found!.identity.projectName).toBe("Root");
    expect(found!.projectRoot).toBe(path.resolve(tmpDir));
  });

  it("findProjectIdentity returns null at filesystem root", async () => {
    expect(await findProjectIdentity(path.parse(tmpDir).root)).toBeNull();
  });

  it("detectAgentRulesTarget returns null when no IDE markers present", () => {
    const result = detectAgentRulesTarget(tmpDir);
    expect(result).toBeNull();
  });

  it("detectAgentRulesTarget detects .cursor directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".cursor"), { recursive: true });
    const result = detectAgentRulesTarget(tmpDir);
    expect(result).toBe(".cursor/rules/gnosys.mdc");
  });

  it("detectAgentRulesTarget detects CLAUDE.md file", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Claude");
    const result = detectAgentRulesTarget(tmpDir);
    expect(result).toBe("CLAUDE.md");
  });

  it("createProjectIdentity registers in central DB when provided", async () => {
    const env = await createTestEnv("9d-proj-central");
    try {
      const identity = await createProjectIdentity(tmpDir, {
        projectName: "CentralProject",
        centralDb: env.db,
      });

      const projects = env.db.getAllProjects();
      expect(projects.length).toBe(1);
      expect(projects[0].id).toBe(identity.projectId);
      expect(projects[0].name).toBe("CentralProject");
    } finally {
      await cleanupTestEnv(env);
    }
  });
});

// ─── TC-9d.6: Multi-project scenarios ────────────────────────────────

describe("TC-9d.6: Multi-project — cross-project isolation", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await createTestEnv("9d-multiproj");
  });

  afterEach(async () => await cleanupTestEnv(env));

  it("memories from different projects are isolated by project_id", () => {
    seedMultiProjectMemories(env.db, [{ id: "proj-a", name: "Alpha", dir: "/tmp/alpha" }, { id: "proj-b", name: "Beta", dir: "/tmp/beta" }], 3);
    expect(env.db.getMemoriesByProject("proj-a").map(m => m.id).sort()).toEqual(["proj-a-mem-1", "proj-a-mem-2", "proj-a-mem-3"]);
    expect(env.db.getMemoriesByProject("proj-b").map(m => m.id).sort()).toEqual(["proj-b-mem-1", "proj-b-mem-2", "proj-b-mem-3"]);
    expect(env.db.getMemoriesByScope("user").map(m => m.id)).toEqual(["user-pref-001"]);
    expect(env.db.getMemoriesByScope("global").map(m => m.id)).toEqual(["global-001"]);
  });

  it("FTS search finds memories across all projects", () => {
    seedMultiProjectMemories(env.db, [
      { id: "proj-x", name: "ProjectX", dir: "/tmp/x" },
      { id: "proj-y", name: "ProjectY", dir: "/tmp/y" },
    ], 2);

    // Search for project-specific content
    const results = env.db.searchFts("ProjectX", 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.title.includes("ProjectX"))).toBe(true);
  });

  it("projects table tracks all registered projects", () => {
    seedMultiProjectMemories(env.db, [
      { id: "proj-1", name: "One", dir: "/tmp/one" },
      { id: "proj-2", name: "Two", dir: "/tmp/two" },
      { id: "proj-3", name: "Three", dir: "/tmp/three" },
    ]);

    const projects = env.db.getAllProjects();
    expect(projects.length).toBe(3);
    expect(projects.map(p => p.name).sort()).toEqual(["One", "Three", "Two"]);
  });

  it("updating a project works correctly", () => {
    env.db.insertProject(makeProject({ id: "upd-proj", name: "Original", working_directory: "/old/path" }));

    env.db.updateProject("upd-proj", { working_directory: "/new/path" });

    const proj = env.db.getAllProjects().find(p => p.id === "upd-proj");
    expect(proj).toBeDefined();
    expect(proj!.working_directory).toBe("/new/path");
    expect(proj!.name).toBe("Original"); // Unchanged
  });

  it("projects remain in registry after insertion", () => {
    env.db.insertProject(makeProject({ id: "persist-proj", name: "Persistent" }));
    expect(env.db.getAllProjects().length).toBe(1);
    expect(env.db.getProject("persist-proj")).not.toBeNull();
    expect(env.db.getProject("persist-proj")!.name).toBe("Persistent");
  });
});

// ─── TC-9d.7: Helper library — factories and seeding ─────────────────

// ─── TC-9d.8: Graph — load and format ────────────────────────────────

describe("TC-9d.8: Graph — load and format stats", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-graph-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loadGraph returns null when no graph.json exists", async () => {
    const result = await loadGraph(tmpDir);
    expect(result).toBeNull();
  });

  it("loadGraph reads a valid graph.json", async () => {
    const graphData = {
      generated: new Date().toISOString(),
      nodes: [
        { id: "a.md", title: "A", edges: 2, outgoing: 1, incoming: 1 },
        { id: "b.md", title: "B", edges: 2, outgoing: 1, incoming: 1 },
      ],
      edges: [
        { source: "a.md", target: "b.md", label: "B" },
        { source: "b.md", target: "a.md", label: "A" },
      ],
      stats: {
        totalNodes: 2,
        totalEdges: 2,
        orphanNodes: 0,
        orphanLinks: 0,
        mostConnected: { id: "a.md", title: "A", edges: 2 },
        avgEdgesPerNode: 2.0,
      },
    };

    fs.writeFileSync(
      path.join(tmpDir, "graph.json"),
      JSON.stringify(graphData, null, 2)
    );

    const result = await loadGraph(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.nodes).toEqual([{ id: "a.md", title: "A", edges: 2, outgoing: 1, incoming: 1 }, { id: "b.md", title: "B", edges: 2, outgoing: 1, incoming: 1 }]);
    expect(result!.edges).toEqual([{ source: "a.md", target: "b.md", label: "B" }, { source: "b.md", target: "a.md", label: "A" }]);
  });

  it("formatGraphStats produces readable output", () => {
    const stats: GraphStats = {
      totalNodes: 15,
      totalEdges: 28,
      orphanNodes: 3,
      orphanLinks: 2,
      mostConnected: { id: "hub.md", title: "Hub Node", edges: 10 },
      avgEdgesPerNode: 3.73,
    };

    const output = formatGraphStats(stats);
    expect(output).toContain("Nodes: 15");
    expect(output).toContain("Edges: 28");
    expect(output).toContain("Orphan nodes (no links): 3");
    expect(output).toContain("Orphan links (unresolved): 2");
    expect(output).toContain("Hub Node");
    expect(output).toContain("10 edges");
  });

  it("formatGraphStats handles null mostConnected", () => {
    const stats: GraphStats = {
      totalNodes: 0,
      totalEdges: 0,
      orphanNodes: 0,
      orphanLinks: 0,
      mostConnected: null,
      avgEdgesPerNode: 0,
    };

    const output = formatGraphStats(stats);
    expect(output).toContain("Nodes: 0");
    expect(output).not.toContain("Most connected");
  });
});

// ─── TC-9d.9: WAL and enableWAL ─────────────────────────────────────

describe("TC-9d.9: enableWAL utility", () => {
  it("enableWAL configures a real SQLite connection", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-wal-"));
    const db = new Database(path.join(dir, "data.db"));
    try {
      db.pragma("wal_autocheckpoint = 0");
      enableWAL(db, 1234.9);
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(db.pragma("busy_timeout", { simple: true })).toBe(1234);
      expect(db.pragma("wal_autocheckpoint", { simple: true })).toBe(1000);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it("enableWAL continues after a closed handle and configures the next connection", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-wal-retry-"));
    const closed = new Database(":memory:");
    closed.close();
    const db = new Database(path.join(dir, "data.db"));
    try {
      enableWAL(closed);
      enableWAL(db, -5);
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(db.pragma("busy_timeout", { simple: true })).toBe(0);
    } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

// ─── TC-9d.10: CLI working-set commands ──────────────────────────────

describe("TC-9d.10: CLI working-set commands", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-9d-wset-"));
    cliInit(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });





  it("gnosys audit --json reports empty entries for fresh project", () => {
    const output = cli("audit --json", tmpDir);
    const parsed = JSON.parse(extractJson(output));
    expect(parsed).toEqual([]);
  });
});
