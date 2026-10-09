import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as llm from "../lib/llm.js";
import { GnosysMaintenanceEngine } from "../lib/maintenance.js";
import { GnosysResolver } from "../lib/resolver.js";
import { writeProjectIdentity } from "../lib/projectIdentity.js";
import { cleanupTestEnv, createTestEnv, makeMemory, makeProject, type TestEnv } from "./_helpers.js";

// Embeddings live only in memories.embedding, as on a DB-only brain. The legacy
// <store>/.config/embeddings.db index is never written.
const vec = (...values: number[]) => Buffer.from(new Float32Array(values).buffer);

let env: TestEnv;
let engine: GnosysMaintenanceEngine;
let resolver: GnosysResolver;

beforeEach(async () => {
  env = await createTestEnv("maintenance-central-embeddings");
  vi.spyOn(llm, "getLLMProvider").mockImplementation(() => {
    throw new Error("dry run must not construct an LLM");
  });
  resolver = new GnosysResolver();
  await resolver.addProjectStore(join(env.tmpDir, ".gnosys"));
  await writeProjectIdentity(env.tmpDir, {
    projectId: "project-a", projectName: "Central embeddings fixture", workingDirectory: env.tmpDir,
    user: "test", agentRulesTarget: null, obsidianVault: null,
    createdAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1,
  });
  env.db.insertProject(makeProject({ id: "project-a" }));
  engine = new GnosysMaintenanceEngine(resolver, undefined, env.db);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupTestEnv(env);
});

describe("maintenance duplicate detection reads memories.embedding", () => {
  it("flags a near-identical pair and ignores an unrelated memory", async () => {
    env.db.insertMemory(makeMemory({ id: "A", title: "Cache retention policy", category: "decisions", project_id: "project-a", embedding: vec(1, 0, 0) }));
    env.db.insertMemory(makeMemory({ id: "B", title: "Cache retention policy update", category: "decisions", project_id: "project-a", embedding: vec(1, 0, 0) }));
    env.db.insertMemory(makeMemory({ id: "C", title: "Cache retention policy notes", category: "decisions", project_id: "project-a", embedding: vec(0, 1, 0) }));

    const report = await engine.maintain({ dryRun: true });

    expect(report.totalMemories).toBe(3);
    expect(report.duplicates.map((d) => [d.memoryA.frontmatter.id, d.memoryB.frontmatter.id, d.similarity])).toEqual([["A", "B", 1]]);
    expect(report.actions).toContain(
      `[DRY RUN] Would consolidate: "Cache retention policy" + "Cache retention policy update" (similarity: 1.000)`,
    );
  });

  it("logs the reindex hint when no active memory has an embedding", async () => {
    env.db.insertMemory(makeMemory({ id: "A", title: "Cache retention policy", category: "decisions", project_id: "project-a" }));
    const logs: string[] = [];

    const report = await engine.maintain({ dryRun: true, onLog: (_level, message) => logs.push(message) });

    expect(report.duplicates).toEqual([]);
    expect(logs).toContain("  No embeddings found — skipping duplicate detection. Run gnosys reindex first.");
  });
});

describe("auto-apply consolidates each memory at most once per run", () => {
  it("merges the first pair of a three-way duplicate and skips pairs whose members were already merged", async () => {
    for (const id of ["A", "B", "C"]) {
      env.db.insertMemory(makeMemory({ id, title: "Cache retention policy", category: "decisions", project_id: "project-a", embedding: vec(1, 0, 0) }));
    }
    const generate = vi.fn(async () => "Merged retention policy.");
    vi.spyOn(llm, "getLLMProvider").mockReturnValue({ name: "ollama", model: "fixture", generate, testConnection: async () => true });
    const applying = new GnosysMaintenanceEngine(resolver, undefined, env.db);

    const report = await applying.maintain({ autoApply: true });

    expect(report.duplicates).toHaveLength(3);
    expect(report.consolidated).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(["A", "B", "C"].map((id) => env.db.getMemory(id)?.status)).toEqual(["superseded", "superseded", "active"]);
    expect(report.actions.filter((a) => a.startsWith("Skipped"))).toEqual([
      `Skipped: "Cache retention policy" + "Cache retention policy" (a member was already consolidated this run)`,
      `Skipped: "Cache retention policy" + "Cache retention policy" (a member was already consolidated this run)`,
    ]);
  });
});
