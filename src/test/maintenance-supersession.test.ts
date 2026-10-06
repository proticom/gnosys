import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import * as llm from "../lib/llm.js";
import { GnosysMaintenanceEngine } from "../lib/maintenance.js";
import { GnosysResolver } from "../lib/resolver.js";
import { cleanupTestEnv, createTestEnv, makeFrontmatter, makeMemory, makeProject, type TestEnv } from "./_helpers.js";

let env: TestEnv;
let engine: GnosysMaintenanceEngine;
const generate = vi.fn(async () => "Keep both the first and second retention constraints.");

beforeEach(async () => {
  generate.mockClear();
  env = await createTestEnv("maintenance-supersession", { withStore: true });
  vi.spyOn(llm, "getLLMProvider").mockReturnValue({
    name: "ollama",
    model: "fixture",
    generate,
    testConnection: async () => true,
  });
  const resolver = new GnosysResolver();
  await resolver.addProjectStore(env.tmpDir);
  const store = resolver.getWriteTarget()?.store;
  if (!store) throw new Error("Missing fixture store");
  env.db.insertProject(makeProject({ id: "project-a" }));
  env.db.insertProject(makeProject({ id: "project-b" }));
  const embeddings = new GnosysEmbeddings(env.tmpDir);
  const today = new Date().toISOString().split("T")[0];
  for (const id of ["A", "B"]) {
    const title = `Cache retention policy ${id}`;
    await store.writeMemory("decisions", `${id}.md`, makeFrontmatter({
      id, title, created: today, modified: today,
    }), `Retention constraint ${id}`, { autoCommit: false });
    env.db.insertMemory(makeMemory({ id, title, category: "decisions", project_id: "project-a" }));
    embeddings.storeEmbedding(`decisions/${id}.md`, new Float32Array([1, 0]), id);
  }
  embeddings.close();
  engine = new GnosysMaintenanceEngine(resolver, undefined, env.db);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupTestEnv(env);
});

describe("maintenance supersession", () => {
  it("consolidates both predecessors and preserves their project", async () => {
    const report = await engine.maintain({ autoApply: true });
    expect(report.consolidated).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    const merged = env.db.getAllMemories().find(memory => memory.id !== "A" && memory.id !== "B");
    expect(merged).toMatchObject({
      status: "active", supersedes: "A, B", scope: "project", project_id: "project-a",
      content: "Keep both the first and second retention constraints.",
    });
    expect([env.db.getMemory("A")?.status, env.db.getMemory("B")?.status]).toEqual(["superseded", "superseded"]);
    expect(env.db.getMemory("A")?.superseded_by).toBe(merged?.id);
    expect(env.db.getMemory("B")?.superseded_by).toBe(merged?.id);
  });

  it.each([
    { scope: "global", project_id: null },
    { scope: "project", project_id: "project-b" },
  ])("rejects cross-boundary consolidation atomically: $scope/$project_id", async updates => {
    env.db.updateMemory("B", updates);
    const before = env.db.getAllMemories();
    const report = await engine.maintain({ autoApply: true });
    expect(report.consolidated).toBe(0);
    expect(report.actions).toEqual([
      expect.stringContaining("Cannot supersede across scope or project:"),
    ]);
    expect(env.db.getAllMemories()).toEqual(before);
    expect(generate).toHaveBeenCalledTimes(0);
  });

  it("rolls back the replacement and first link when the second link fails", async () => {
    const db = new Database(join(env.tmpDir, "gnosys.db"));
    db.exec(`CREATE TRIGGER reject_second_link BEFORE UPDATE OF superseded_by ON memories
      WHEN NEW.id = 'B' AND NEW.superseded_by IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'second link failed'); END`);
    db.close();
    const before = env.db.getAllMemories();
    const report = await engine.maintain({ autoApply: true });
    expect(report.consolidated).toBe(0);
    expect(report.actions).toEqual([expect.stringContaining("second link failed")]);
    expect(env.db.getAllMemories()).toEqual(before);
  });
});
