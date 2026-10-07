/**
      * Phase 7c: Dual-Write (SQLite + Markdown)
      * Test Plan Reference: "Phase 7 Sub-Phase Tests — 7c"
      *
      *   TC-7c.1: gnosys add writes to both SQLite and Markdown
      *   TC-7c.2: Manual edit of .md file is picked up on next reindex
      *   TC-7c.3: Maintain and reinforce update both layers
      */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fsp from "fs/promises";
import path from "path";
import { GnosysSearch } from "../lib/search.js";
import {
        createTestEnv,
        cleanupTestEnv,
        makeFrontmatter,
        type TestEnv,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
        env = await createTestEnv("phase7c", { withStore: true });
    });

afterEach(async () => {
        await cleanupTestEnv(env);
    });

describe("Phase 7c: Dual-Write", () => {
        // ─── TC-7c.1: Write to both layers ───────────────────────────────────

        // ─── TC-7c.2: Manual .md edit reindexing ─────────────────────────────

        describe("TC-7c.2: Manual markdown edits picked up on reindex", () => {

    it("search index reflects manual edits after reindex", async () => {
      await env.store!.writeMemory("decisions", "search-edit.md", makeFrontmatter({ id: "se-001", title: "Searchable Edit", relevance: "quartzalpha" }), "quartzalpha body");
      const search = new GnosysSearch(env.tmpDir);
      try {
        await search.reindex(env.store!);
        expect(search.search("quartzalpha").map(row => row.title)).toEqual(["Searchable Edit"]);
        const file = path.join(env.tmpDir, "decisions/search-edit.md");
        await fsp.writeFile(file, (await fsp.readFile(file, "utf8")).replaceAll("quartzalpha", "zirconbeta"));
        await search.reindex(env.store!);
        expect(search.search("zirconbeta").map(row => row.title)).toEqual(["Searchable Edit"]);
        expect(search.search("quartzalpha")).toEqual([]);
      } finally { search.close(); }
    });
        });

        // ─── TC-7c.3: Maintain and reinforce update both layers ──────────────

        describe("TC-7c.3: Updates propagate to both layers", () => {

    it("updating store memory updates modified date", async () => {
      await env.store!.writeMemory(
        "decisions",
        "update-date.md",
        makeFrontmatter({
          id: "upd-001",
          modified: "2026-01-01",
        }),
        "# Update Date Test\n\nContent."
      );

      const updated = await env.store!.updateMemory(
        "decisions/update-date.md",
        { confidence: 0.95 }
      );

      expect(updated).not.toBeNull();
      // Modified date should be today, not the original
      const today = new Date().toISOString().split("T")[0];
      expect(updated!.frontmatter.modified).toBe(today);
    });
        });
    });
