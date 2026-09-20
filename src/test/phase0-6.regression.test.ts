/**
      * Phase 0–6 Regression Tests
      * Test Plan Reference: "Phase 0–6 Regression Tests (run first)"
      *
      * Validates that all foundational features still work correctly:
      *   TC-R.1: Basic CRUD (add, ask, reinforce, read)
      *   TC-R.2: Hybrid search + semantic search
      *   TC-R.3: Dream Mode config
      *   TC-R.4: Multi-project support (projectRoot parameter)
      *   TC-R.5: Obsidian export
      *   TC-R.6: Dashboard and doctor stats
      *   TC-R.7: Maintain and dearchive
      */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { GnosysSearch } from "../lib/search.js";
import {
        createTestEnv,
        cleanupTestEnv,
        makeMemory,
        makeFrontmatter,
        type TestEnv,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
        env = await createTestEnv("regression", { withStore: true });
    });

afterEach(async () => {
        await cleanupTestEnv(env);
    });

// ─── TC-R.1: Basic CRUD ────────────────────────────────────────────────

describe("Phase 0-6 Regression", () => {
        describe("TC-R.1: Basic CRUD operations", () => {
    it("inserts a memory into the database and retrieves it", () => {
      const mem = makeMemory({
        id: "crud-001",
        title: "CRUD Test Memory",
        content: "Testing basic insert and read",
        category: "decisions",
      });
      env.db.insertMemory(mem);

      const retrieved = env.db.getMemory("crud-001");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("CRUD Test Memory");
      expect(retrieved!.content).toBe("Testing basic insert and read");
      expect(retrieved!.category).toBe("decisions");
    });

    it("updates a memory's fields", () => {
      env.db.insertMemory(
        makeMemory({ id: "crud-002", title: "Original Title", confidence: 0.8 })
      );

      env.db.updateMemory("crud-002", {
        title: "Updated Title",
        confidence: 0.95,
      });

      const updated = env.db.getMemory("crud-002");
      expect(updated!.title).toBe("Updated Title");
      expect(updated!.confidence).toBe(0.95);
    });

    it("deletes a memory and its FTS entry", () => {
      env.db.insertMemory(
        makeMemory({ id: "crud-003", title: "To Be Deleted" })
      );

      env.db.deleteMemory("crud-003");

      const deleted = env.db.getMemory("crud-003");
      expect(deleted).toBeNull();

      // FTS should also be clean
      const ftsResults = env.db.searchFts("Deleted", 10);
      expect(ftsResults.find((r) => r.id === "crud-003")).toBeUndefined();
    });

    it("updates persisted reinforcement fields", () => {
      env.db.insertMemory(makeMemory({ id: "crud-004", reinforcement_count: 0 }));
      env.db.updateMemory("crud-004", { reinforcement_count: 1, last_reinforced: "2026-03-04" });
      expect(env.db.getMemory("crud-004")).toMatchObject({ reinforcement_count: 1, last_reinforced: "2026-03-04" });
    });

    it("reads memories by category", () => {
      env.db.insertMemory(makeMemory({ id: "c-001", category: "decisions" }));
      env.db.insertMemory(makeMemory({ id: "c-002", category: "decisions" }));
      env.db.insertMemory(makeMemory({ id: "c-003", category: "concepts" }));

      const decisions = env.db.getMemoriesByCategory("decisions");
      expect(decisions.length).toBe(2);
      expect(decisions.every((m) => m.category === "decisions")).toBe(true);
    });

    it("writes and reads a memory file via GnosysStore", async () => {
      const fm = makeFrontmatter({ id: "store-001", title: "Store CRUD Test" });
      const relPath = await env.store!.writeMemory(
        "decisions",
        "crud-test.md",
        fm,
        "# Store CRUD\n\nContent here."
      );

      const memory = await env.store!.readMemory(relPath);
      expect(memory).not.toBeNull();
      expect(memory!.frontmatter.id).toBe("store-001");
      expect(memory!.content).toContain("Content here.");
    });
        });

        // ─── TC-R.2: Hybrid Search + Semantic Search ──────────────────────────

        describe("TC-R.2: Search operations", () => {
    it("FTS5 search finds memories by keyword", () => {
      env.db.insertMemory(
        makeMemory({
          id: "search-001",
          title: "Authentication Architecture",
          content: "JWT tokens are used for API authentication",
          relevance: "auth JWT tokens login",
        })
      );
      env.db.insertMemory(
        makeMemory({
          id: "search-002",
          title: "Database Choice",
          content: "PostgreSQL for persistent storage",
          relevance: "database PostgreSQL storage",
        })
      );

      const results = env.db.searchFts("JWT authentication", 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("search-001");
    });

    it("discover finds memories by relevance keywords", () => {
      env.db.insertMemory(
        makeMemory({
          id: "disc-001",
          title: "OAuth Setup",
          relevance: "OAuth SSO identity login credentials auth",
        })
      );

      const results = env.db.discoverFts("OAuth login", 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("disc-001");
    });

    it("GnosysSearch indexes and searches store memories", async () => {
      await env.store!.writeMemory(
        "decisions",
        "search-a.md",
        makeFrontmatter({
          id: "sa-001",
          title: "Redis Caching Decision",
          relevance: "cache Redis in-memory TTL",
        }),
        "# Redis Caching\n\nWe use Redis for caching."
      );

      const search = new GnosysSearch(env.tmpDir);
      await search.reindex(env.store!);

      const results = search.search("Redis caching", 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe("Redis Caching Decision");
      search.close();
    });

    it("returns empty results for non-matching queries", () => {
      const results = env.db.searchFts("xyznonexistent123", 10);
      expect(results).toEqual([]);
    });
        });

        // ─── TC-R.3: Dream Mode Configuration ─────────────────────────────────

        describe("TC-R.3: Dream Mode configuration", () => {
    it("dream reports an empty database before calling a provider", async () => {
      const { GnosysDreamEngine } = await import("../lib/dream.js");
      const { DEFAULT_CONFIG } = await import("../lib/config.js");

      const engine = new GnosysDreamEngine(env.db, DEFAULT_CONFIG, { minMemories: 3 }, { stateDir: env.tmpDir });
      const result = await engine.dream();
      expect(result.errors).toEqual(["gnosys.db not available or not migrated"]);
      expect(result.totals?.llmCallsMade).toBe(0);
    });

    it("dream reports the configured minimum active-memory requirement", async () => {
      const { GnosysDreamEngine } = await import("../lib/dream.js");
      const { DEFAULT_CONFIG } = await import("../lib/config.js");
      env.db.insertMemory(makeMemory({ id: "dream-small" }));
      const engine = new GnosysDreamEngine(env.db, DEFAULT_CONFIG, { minMemories: 3 }, { stateDir: env.tmpDir });
      const result = await engine.dream();
      expect(result.errors).toEqual(["Too few memories (1 < 3)"]);
      expect(result.totals?.llmCallsMade).toBe(0);
    });
        });

        // ─── TC-R.4: Multi-Project Support ────────────────────────────────────

        describe("TC-R.4: Multi-project support", () => {
    it("stores memories with distinct project_id values", () => {
      env.db.insertMemory(
        makeMemory({
          id: "mp-001",
          title: "Project A Memory",
          project_id: "proj-alpha",
          scope: "project",
        })
      );
      env.db.insertMemory(
        makeMemory({
          id: "mp-002",
          title: "Project B Memory",
          project_id: "proj-beta",
          scope: "project",
        })
      );

      const projAMemories = env.db.getMemoriesByProject("proj-alpha");
      expect(projAMemories.length).toBe(1);
      expect(projAMemories[0].title).toBe("Project A Memory");

      const projBMemories = env.db.getMemoriesByProject("proj-beta");
      expect(projBMemories.length).toBe(1);
      expect(projBMemories[0].title).toBe("Project B Memory");
    });

    it("registers and retrieves projects", () => {
      const now = new Date().toISOString();
      env.db.insertProject({
        id: "proj-alpha",
        name: "Alpha",
        working_directory: "/tmp/alpha",
        user: "testuser",
        agent_rules_target: null,
        obsidian_vault: null,
        created: now,
        modified: now,
      });

      const project = env.db.getProject("proj-alpha");
      expect(project).not.toBeNull();
      expect(project!.name).toBe("Alpha");
      expect(project!.working_directory).toBe("/tmp/alpha");
    });

    it("separates memories by scope", () => {
      env.db.insertMemory(
        makeMemory({ id: "scope-p", scope: "project", project_id: "proj-1" })
      );
      env.db.insertMemory(
        makeMemory({ id: "scope-u", scope: "user", project_id: null })
      );
      env.db.insertMemory(
        makeMemory({ id: "scope-g", scope: "global", project_id: null })
      );

      const projectMems = env.db.getMemoriesByScope("project");
      const userMems = env.db.getMemoriesByScope("user");
      const globalMems = env.db.getMemoriesByScope("global");

      expect(projectMems.map(m => m.id)).toEqual(["scope-p"]);
      expect(userMems.map(m => m.id)).toEqual(["scope-u"]);
      expect(globalMems.map(m => m.id)).toEqual(["scope-g"]);
    });
        });

        // ─── TC-R.5: Obsidian Export ──────────────────────────────────────────

        describe("TC-R.5: Obsidian export", () => {

    it("exporter creates output directory and writes memories", async () => {
      // Insert memories into DB (GnosysExporter uses GnosysDB)
      env.db.insertMemory(
        makeMemory({
          id: "exp-001",
          title: "Export Test A",
          content: "Content for export testing.",
          category: "decisions",
        })
      );
      env.db.insertMemory(
        makeMemory({
          id: "exp-002",
          title: "Export Test B",
          content: "Another memory for export.",
          category: "concepts",
        })
      );

      const { GnosysExporter } = await import("../lib/export.js");
      const exportDir = path.join(env.tmpDir, "obsidian-export");
      const exporter = new GnosysExporter(env.db);
      const report = await exporter.export({ targetDir: exportDir });

      expect(report.memoriesExported).toBe(2);
      // Verify directory was created
      const stat = await fsp.stat(exportDir);
      expect(stat.isDirectory()).toBe(true);
      expect(await fsp.readFile(path.join(exportDir, "decisions/export-test-a.md"), "utf8")).toContain("Content for export testing.");
      expect(await fsp.readFile(path.join(exportDir, "concepts/export-test-b.md"), "utf8")).toContain("Another memory for export.");
    });
        });

        // ─── TC-R.6: Dashboard and Doctor Stats ───────────────────────────────

        describe("TC-R.6: Dashboard and doctor stats", () => {
    it("getMemoryCount returns correct totals", () => {
      env.db.insertMemory(
        makeMemory({ id: "stat-001", status: "active", tier: "active" })
      );
      env.db.insertMemory(
        makeMemory({ id: "stat-002", status: "active", tier: "active" })
      );
      env.db.insertMemory(
        makeMemory({ id: "stat-003", status: "archived", tier: "archive" })
      );

      const counts = env.db.getMemoryCount();
      expect(counts.active).toBe(2);
      expect(counts.archived).toBe(1);
      expect(counts.total).toBe(3);
    });

    it("getCategories returns distinct categories", () => {
      env.db.insertMemory(makeMemory({ id: "cat-001", category: "decisions" }));
      env.db.insertMemory(makeMemory({ id: "cat-002", category: "concepts" }));
      env.db.insertMemory(makeMemory({ id: "cat-003", category: "decisions" }));

      const cats = env.db.getCategories();
      expect(cats).toContain("decisions");
      expect(cats).toContain("concepts");
      expect(cats.length).toBe(2);
    });

    it("dashboard reports literal active and archived database counts", async () => {
      const { collectDashboardData } = await import("../lib/dashboard.js");
      const { GnosysResolver } = await import("../lib/resolver.js");
      const { DEFAULT_CONFIG } = await import("../lib/config.js");
      env.db.insertMemory(makeMemory({ id: "dashboard-active" }));
      env.db.insertMemory(makeMemory({ id: "dashboard-archived", status: "archived", tier: "archive" }));
      const data = await collectDashboardData(new GnosysResolver(), DEFAULT_CONFIG, "1.2.3", env.db);
      expect(data.gnosysDb).toMatchObject({ activeCount: 1, archivedCount: 1, totalCount: 2 });
    });
        });

        // ─── TC-R.7: Maintain and Dearchive ───────────────────────────────────

        describe("TC-R.7: Maintain and dearchive", () => {
    it("maintenance rejects a resolver with no writable store", async () => {
      const { GnosysMaintenanceEngine } = await import("../lib/maintenance.js");
      const { GnosysResolver } = await import("../lib/resolver.js");
      const engine = new GnosysMaintenanceEngine(new GnosysResolver(), undefined, env.db);
      await expect(engine.maintain()).rejects.toThrow("No writable store found. Run gnosys init first.");
    });

    it("archive module can be imported and instantiated", async () => {
      const { GnosysArchive } = await import("../lib/archive.js");
      const archiveDir = path.join(env.tmpDir, "archive-test");
      fs.mkdirSync(archiveDir, { recursive: true });
      const archive = new GnosysArchive(archiveDir);

      // Verify initial state
      const stats = archive.getStats();
      expect(stats.totalArchived).toBe(0);

      // Archive a memory (requires a Memory object with frontmatter)
      const memory = {
        frontmatter: makeFrontmatter({
          id: "arch-001",
          title: "Archived Memory",
          confidence: 0.3,
        }),
        content: "# Archived Memory\n\nThis was archived.",
        filePath: path.join(env.tmpDir, "decisions", "archived.md"),
        relativePath: "decisions/archived.md",
      };

      const success = await archive.archiveMemory(memory);
      expect(success).toBe(true);

      const postStats = archive.getStats();
      expect(postStats.totalArchived).toBe(1);
      expect(archive.getArchivedMemory("arch-001")?.content).toBe("# Archived Memory\n\nThis was archived.");

      archive.close();
    });

    it("memory tier can be changed from active to archive and back", () => {
      env.db.insertMemory(
        makeMemory({ id: "tier-001", tier: "active", status: "active" })
      );

      // Archive it
      env.db.updateMemory("tier-001", { tier: "archive", status: "archived" });
      let mem = env.db.getMemory("tier-001");
      expect(mem!.tier).toBe("archive");
      expect(mem!.status).toBe("archived");

      // Dearchive it
      env.db.updateMemory("tier-001", { tier: "active", status: "active" });
      mem = env.db.getMemory("tier-001");
      expect(mem!.tier).toBe("active");
      expect(mem!.status).toBe("active");
    });

        });
    });
