import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestEnv,
  cleanupTestEnv,
  makeFrontmatter,
  type TestEnv,
} from "./_helpers.js";
import {
  syncMemoryToDb,
  syncUpdateToDb,
  syncArchiveToDb,
  syncDearchiveToDb,
  syncReinforcementToDb,
  syncDeleteToDb,
} from "../lib/dbWrite.js";

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("lifecycle-inv", { withStore: true });
});

afterEach(async () => {
  await cleanupTestEnv(env);
});

describe("memory lifecycle through database reads and search", () => {
  it("preserves current content, visibility and reinforcement across lifecycle operations", () => {
    const fm = makeFrontmatter({ id: "inv-001", title: "First version", category: "decisions" });
    syncMemoryToDb(env.db, fm, "originalword", "decisions/inv.md");
    expect(env.db.getAllMemories().map(memory => memory.id)).toEqual(["inv-001"]);
    expect(env.db.searchFts("originalword").map(memory => memory.id)).toEqual(["inv-001"]);

    syncUpdateToDb(env.db, "inv-001", { title: "Second version" }, "replacementword");
    expect(env.db.getMemory("inv-001")).toMatchObject({ title: "Second version", content: "replacementword" });
    expect(env.db.searchFts("originalword")).toEqual([]);
    expect(env.db.searchFts("replacementword").map(memory => [memory.id, memory.title])).toEqual([["inv-001", "Second version"]]);

    syncArchiveToDb(env.db, "inv-001");
    expect(env.db.getActiveMemories()).toEqual([]);
    expect(env.db.getMemory("inv-001")).toMatchObject({ tier: "archive", status: "archived", content: "replacementword" });
    syncDearchiveToDb(env.db, "inv-001");
    expect(env.db.getActiveMemories().map(memory => memory.id)).toEqual(["inv-001"]);
    expect(env.db.getMemory("inv-001")).toMatchObject({ tier: "active", status: "active", content: "replacementword" });

    syncReinforcementToDb(env.db, "inv-001", 1);
    expect(env.db.getMemory("inv-001")).toMatchObject({ reinforcement_count: 1, content: "replacementword" });
    expect(env.db.searchFts("replacementword").map(memory => memory.id)).toEqual(["inv-001"]);
    syncDeleteToDb(env.db, "inv-001");
    expect(env.db.getMemory("inv-001")).toBeNull();
    expect(env.db.searchFts("replacementword")).toEqual([]);
    expect(env.db.getAllMemories()).toEqual([]);
  });
  it.fails("writing the same memory twice keeps one searchable result", () => {
    const fm = makeFrontmatter({ id: "repeat-001", title: "Repeat write" });
    syncMemoryToDb(env.db, fm, "uniqueword");
    syncMemoryToDb(env.db, fm, "uniqueword");
    expect(env.db.getAllMemories().map(memory => memory.id)).toEqual(["repeat-001"]);
    expect(env.db.searchFts("uniqueword").map(memory => memory.id)).toEqual(["repeat-001"]);
  });
});
