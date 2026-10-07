/**
      * Phase 7a: GnosysDB + Migration
      * Test Plan Reference: "Phase 7 Sub-Phase Tests — 7a"
      *
      *   TC-7a.1: gnosys migrate moves memories to gnosys.db
      *   TC-7a.2: Old commands (ask, dashboard) still work unchanged
      *   TC-7a.3: gnosys doctor shows migration status
      *   TC-7a.4: Schema is correct (6 tables, all columns present)
      */

import { GnosysDB } from "../lib/db.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
        createTestEnv,
        cleanupTestEnv,
        makeMemory,
        makeProject,
        makeFrontmatter,
        type TestEnv,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
        env = await createTestEnv("phase7a", { withStore: true });
    });

afterEach(async () => {
        await cleanupTestEnv(env);
    });

describe("Phase 7a: GnosysDB + Migration", () => {
        // ─── TC-7a.1: Migration ───────────────────────────────────────────────

        describe("TC-7a.1: Migration of markdown memories to SQLite", () => {

    it("memories written to store can be read into DB via migrate", async () => {
      // Write memories to the markdown store
      await env.store!.writeMemory(
        "decisions",
        "migrate-a.md",
        makeFrontmatter({ id: "deci-001", title: "Decision Alpha" }),
        "# Decision Alpha\n\nWe chose TypeScript."
      );
      await env.store!.writeMemory(
        "concepts",
        "migrate-b.md",
        makeFrontmatter({
          id: "conc-001",
          title: "Concept Beta",
          category: "concepts",
        }),
        "# Concept Beta\n\nExplanation of the beta concept."
      );

      const { migrate } = await import("../lib/migrate.js");
      const stats = await migrate(env.tmpDir);

      expect(stats.memoriesMigrated).toBe(2);
      expect(stats.ftsBuild).toBe(true);

      // Verify memories are in DB
      const mem1 = env.db.getMemory("deci-001");
      expect(mem1).not.toBeNull();
      expect(mem1!.title).toBe("Decision Alpha");

      const mem2 = env.db.getMemory("conc-001");
      expect(mem2).not.toBeNull();
      expect(mem2!.title).toBe("Concept Beta");
    });

    it("migration is idempotent (re-migrate skips existing)", async () => {
      await env.store!.writeMemory(
        "decisions",
        "idempotent.md",
        makeFrontmatter({ id: "deci-010", title: "Idempotent Test" }),
        "# Idempotent\n\nShould only import once."
      );

      const { migrate } = await import("../lib/migrate.js");
      const stats1 = await migrate(env.tmpDir);
      expect(stats1.memoriesMigrated).toBe(1);

      // Migrate again (result intentionally unused — only the count matters)
      await migrate(env.tmpDir);
      // Should not duplicate — either 0 or still 1 total
      const count = env.db.getMemoryCount();
      expect(count.total).toBe(1);
    });
        });

        // ─── TC-7a.2: Old commands still work ─────────────────────────────────

        describe("TC-7a.2: Post-migration command compatibility", () => {
    it("DB search works after inserting memories", () => {
      env.db.insertMemory(
        makeMemory({
          id: "compat-001",
          title: "Compat Check",
          content: "Verifying old commands work after migration",
          relevance: "compatibility migration verification",
        })
      );

      const results = env.db.searchFts("compatibility", 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("compat-001");
    });

    it("getMemoryCount returns correct totals after migration", async () => {
      await env.store!.writeMemory("decisions", "count.md", makeFrontmatter({ id: "migrated-count" }), "counted memory body");
      const { migrate } = await import("../lib/migrate.js");
      await migrate(env.tmpDir);
      expect(env.db.getMemoryCount()).toMatchObject({ total: 1, active: 1, archived: 0 });
      expect(env.db.getMemory("migrated-count")?.content).toContain("counted memory body");
    });
        });

        // ─── TC-7a.3: Doctor / migration status ───────────────────────────────

        describe("TC-7a.3: Migration status detection", () => {
    it("isMigrated returns false for empty DB, true after adding data", () => {
      // isMigrated checks for data presence (count > 0)
      expect(env.db.isMigrated()).toBe(false);

      // Add a memory, now it should be "migrated"
      env.db.insertMemory(
        makeMemory({ id: "migration-check", title: "Migration Check" })
      );
      expect(env.db.isMigrated()).toBe(true);
    });

    it("getSchemaVersion returns current version", () => {
      const version = env.db.getSchemaVersion();
      expect(version).toBe(5);
    });
        });

        // ─── TC-7a.4: Schema correctness ─────────────────────────────────────

        describe("TC-7a.4: Schema validation", () => {

    it("memories retain scope and project after reopen", () => {
      env.db.insertMemory(makeMemory({ id: "scoped-roundtrip", project_id: "alpha", scope: "user", title: "Scoped memory", content: "literal persisted body" }));
      env.db.close();
      env.db = new GnosysDB(env.tmpDir);
      expect(env.db.getMemory("scoped-roundtrip")).toMatchObject({ id: "scoped-roundtrip", project_id: "alpha", scope: "user", title: "Scoped memory", content: "literal persisted body" });
    });

    it("projects persist identity fields", () => {
      env.db.insertProject(makeProject({ id: "project-roundtrip", name: "Stored project", working_directory: "/workspace/project", user: "test-user", agent_rules_target: "CLAUDE.md", obsidian_vault: "/workspace/vault" }));
      env.db.close();
      env.db = new GnosysDB(env.tmpDir);
      expect(env.db.getProject("project-roundtrip")).toMatchObject({ id: "project-roundtrip", name: "Stored project", working_directory: "/workspace/project", user: "test-user", agent_rules_target: "CLAUDE.md", obsidian_vault: "/workspace/vault" });
    });

    it("FTS5 virtual table is set up with porter tokenizer", () => {
      // Verify FTS works by inserting and searching
      env.db.insertMemory(
        makeMemory({
          id: "fts-check",
          title: "FTS Schema Check",
          content: "Verifying FTS5 porter tokenizer works",
        })
      );

      // Porter stemming should match "verifying" with "verify"
      const results = env.db.searchFts("verify", 10);
      expect(results.map(row => row.id)).toEqual(["fts-check"]);
    });

    it("audit_log table accepts entries", () => {
      env.db.logAudit({ timestamp: "2026-06-01T00:00:00Z", operation: "test", memory_id: "audit-memory", details: '{"test":true}', duration_ms: 10, trace_id: "test-trace-001" });
      expect(env.db.getAuditLog("audit-memory").map(({ timestamp, operation, details, duration_ms, trace_id }) => ({ timestamp, operation, details, duration_ms, trace_id }))).toEqual([
      { timestamp: "2026-06-01T00:00:00Z", operation: "test", details: '{"test":true}', duration_ms: 10, trace_id: "test-trace-001" }
      ]);
    });
        });
    });
