import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GnosysArchive } from "../lib/archive.js";
import { GnosysConfigSchema } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { syncMemoryToDb } from "../lib/dbWrite.js";
import { GnosysMaintenanceEngine } from "../lib/maintenance.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore, type MemoryFrontmatter } from "../lib/store.js";

let directory: string;
let db: GnosysDB;
let store: GnosysStore;

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-maintenance-audit-"));
  vi.stubEnv("GNOSYS_HOME", path.join(directory, "home"));
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(directory, "config"));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
  store = new GnosysStore(directory);
  await store.init();
  db = new GnosysDB(directory);
});

afterEach(async () => {
  db.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await fs.rm(directory, { recursive: true, force: true });
});

describe("maintenance public success paths", () => {
  it("auto-apply persists stale confidence decay and leaves a freshly reinforced memory unchanged", async () => {
    const memories: Array<{ frontmatter: MemoryFrontmatter; filename: string; content: string }> = [
      {
        frontmatter: {
          id: "aging-001", title: "Aging protocol", category: "decisions", tags: ["protocol"],
          relevance: "aging protocol", author: "human", authority: "declared", confidence: 0.8,
          created: "2026-01-01", modified: "2026-01-01", last_reinforced: "2026-01-01", status: "active",
        },
        filename: "aging.md", content: "Retain the old protocol body.",
      },
      {
        frontmatter: {
          id: "fresh-001", title: "Fresh protocol", category: "decisions", tags: ["protocol"],
          relevance: "fresh protocol", author: "human", authority: "declared", confidence: 0.8,
          created: "2026-01-01", modified: "2026-01-01", last_reinforced: "2026-07-20", status: "active",
        },
        filename: "fresh.md", content: "Retain the freshly reinforced body.",
      },
    ];
    for (const memory of memories) {
      const relativePath = await store.writeMemory("decisions", memory.filename, memory.frontmatter, memory.content, { autoCommit: false });
      syncMemoryToDb(db, memory.frontmatter, memory.content, relativePath);
    }
    const resolver = new GnosysResolver();
    await resolver.addProjectStore(directory);
    const config = GnosysConfigSchema.parse({
      llm: { defaultProvider: "ollama" },
      archive: { maxActiveDays: 1000, minConfidence: 0.3 },
    });
    const engine = new GnosysMaintenanceEngine(resolver, config, db);

    const report = await engine.maintain({ dryRun: false, autoApply: true });

    expect(report).toMatchObject({ totalMemories: 2, decayUpdated: 1, archived: 0 });
    expect(report.staleMemories.map((memory) => ({
      id: memory.memory.frontmatter.id, days: memory.daysSinceReinforced, confidence: memory.originalConfidence,
    }))).toEqual([{ id: "aging-001", days: 200, confidence: 0.8 }]);
    expect(db.getMemory("aging-001")).toMatchObject({
      confidence: 0.29, content: "Retain the old protocol body.", status: "active", modified: "2026-07-20",
    });
    expect(db.getMemory("fresh-001")).toMatchObject({
      confidence: 0.8, content: "Retain the freshly reinforced body.", last_reinforced: "2026-07-20",
    });
  });

  it("dearchive restores exact content to active database search and removes the archived copy", async () => {
    await store.writeMemory("decisions", "recovery.md", {
      id: "archive-001", title: "Quartz recovery", category: "decisions", tags: ["recovery"],
      relevance: "quartz recovery", author: "human", authority: "declared", confidence: 0.7,
      created: "2026-01-01", modified: "2026-01-01", status: "active", reinforcement_count: 2,
    }, "Restore the quartz ledger after an outage.", { autoCommit: false });
    const memory = await store.readMemory("decisions/recovery.md");
    if (!memory) throw new Error("Missing archive input memory");
    const archive = new GnosysArchive(directory);
    try {
      expect(await archive.archiveMemory(memory)).toBe(true);
      expect(archive.getArchivedMemory("archive-001")?.content).toBe("Restore the quartz ledger after an outage.");
      expect(await store.readMemory("decisions/recovery.md")).toBeNull();
      expect(db.searchFts("ledger")).toEqual([]);

      expect(await archive.dearchiveMemory("archive-001", store, db)).toBe("decisions/recovery.md");

      expect(db.getMemory("archive-001")).toMatchObject({
        title: "Quartz recovery", content: "Restore the quartz ledger after an outage.",
        status: "active", tier: "active", confidence: 0.7, reinforcement_count: 2,
        tags: '["recovery"]', author: "human", authority: "declared", modified: "2026-07-20",
      });
      expect(db.searchFts("ledger").map((result) => ({ id: result.id, title: result.title })))
        .toEqual([{ id: "archive-001", title: "Quartz recovery" }]);
      expect(archive.getAllArchivedIds()).toEqual([]);
      expect(archive.searchArchive("quartz")).toEqual([]);
    } finally {
      archive.close();
    }
  });
});
