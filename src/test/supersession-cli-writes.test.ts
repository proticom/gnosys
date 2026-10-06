import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAddStructuredCommand, type AddStructuredOptions } from "../lib/addStructuredCommand.js";
import { memoryOverlapWarning } from "../lib/memoryOverlap.js";
import { runUpdateCommand } from "../lib/updateCommand.js";
import { cleanupTestEnv, createTestEnv, makeMemory, makeProject, type TestEnv } from "./_helpers.js";

let env: TestEnv;
const options: AddStructuredOptions = {
  title: "Corrected deployment", category: "decisions", content: "Deploy with the current approach.",
  tags: "{}", relevance: "deployment", author: "human", authority: "declared", confidence: "0.9",
};

beforeEach(async () => {
  env = await createTestEnv("supersession-cli");
  vi.stubEnv("GNOSYS_HOME", env.tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  env.db.insertMemory(makeMemory({ id: "old", title: "Old deployment", relevance: "deployment", created: "2024-02-03", modified: "2024-02-03" }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await cleanupTestEnv(env);
});

describe("CLI supersession writes", () => {
  it.each(["project", "user", "global"])("links structured additions in %s scope", async (scope) => {
    env.db.updateMemory("old", { scope });
    await runAddStructuredCommand({ ...options, user: scope === "user", global: scope === "global", supersedes: "old" }, async () => null);
    const replacement = env.db.getAllMemories().find((memory) => memory.title === "Corrected deployment");
    expect(replacement).toMatchObject({ supersedes: "old", status: "active", scope });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: replacement?.id, status: "superseded" });
    expect(env.db.getMemory("old")?.modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects missing predecessors and rolls back the addition", async () => {
    await expect(runAddStructuredCommand({ ...options, supersedes: "missing" }, async () => null)).rejects.toThrow("Memory not found: missing");
    expect(env.db.getAllMemories().map((memory) => memory.id)).toEqual(["old"]);
  });

  it("reports active overlaps after an addition", async () => {
    await runAddStructuredCommand(options, async () => null);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Old deployment (old)"));
    expect(env.db.getAllMemories().map((memory) => memory.title).sort()).toEqual(["Corrected deployment", "Old deployment"]);
  });

  it("caps overlaps at three within the writer scope and project before limiting", () => {
    env.db.insertProject(makeProject({ id: "other-project" }));
    for (let i = 0; i < 8; i++) {
      env.db.insertMemory(makeMemory({ id: `foreign-${i}`, title: `Foreign ${i}`, relevance: "deployment ".repeat(30), scope: "global" }));
      env.db.insertMemory(makeMemory({ id: `other-project-${i}`, title: `Other project ${i}`, relevance: "deployment ".repeat(30), project_id: "other-project" }));
    }
    for (const id of ["local-a", "local-b", "local-c", "local-d"]) {
      env.db.insertMemory(makeMemory({ id, title: id, relevance: "deployment" }));
    }
    const warning = memoryOverlapWarning(env.db, { id: "new", relevance: "deployment", supersedes: "old", scope: "project", projectId: null });
    expect(warning.split("\n").filter((line) => line.startsWith("  - "))).toEqual([
      "  - local-a (local-a)", "  - local-b (local-b)", "  - local-c (local-c)",
    ]);
  });

  it("links an update from the predecessor side", async () => {
    env.db.insertMemory(makeMemory({ id: "correction", title: "Correction" }));
    await runUpdateCommand(async () => { throw new Error("Unexpected legacy lookup"); }, "old", { supersededBy: "correction" });
    expect(env.db.getMemory("old")).toMatchObject({ status: "superseded", superseded_by: "correction" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: "old" });
    expect(env.db.getIdsModifiedSince("2024-02-03").map((row) => row.id).sort()).toEqual(["correction", "old"]);
  });
});

it("CLI update rejects a misspelled status without changing the memory", async () => {
  await expect(runUpdateCommand(async () => { throw new Error("Unexpected legacy lookup"); }, "old", { status: "actve" })).rejects.toThrow();
  expect(env.db.getMemory("old")).toMatchObject({ status: "active", modified: "2024-02-03" });
});

it.each(["project", "user", "global"])("CLI add can opt into cross-scope supersession from %s", async scope => {
  env.db.updateMemory("old", { scope: scope === "global" ? "project" : "global" });
  const opts = { ...options, user: scope === "user", global: scope === "global", supersedes: "old" };
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(runAddStructuredCommand(opts, async () => null)).rejects.toThrow(
    scope === "project" ? "Cannot supersede across scope or project" : 'process.exit unexpectedly called with "1"',
  );
  if (scope !== "project") expect(error).toHaveBeenCalledWith(expect.stringContaining("Cannot supersede across scope or project"));
  expect(env.db.getAllMemories().map(memory => memory.id)).toEqual(["old"]);
  await runAddStructuredCommand({ ...opts, allowCrossScope: true }, async () => null);
  const replacement = env.db.getAllMemories().find(memory => memory.id !== "old");
  expect(replacement).toMatchObject({ scope, supersedes: "old", status: "active" });
  expect(env.db.getMemory("old")).toMatchObject({ status: "superseded", superseded_by: replacement?.id });
});

it("CLI update can opt into cross-scope supersession", async () => {
  env.db.insertMemory(makeMemory({ id: "global-replacement", scope: "global" }));
  const resolver = async () => { throw new Error("Unexpected legacy lookup"); };
  await expect(runUpdateCommand(resolver, "old", { supersededBy: "global-replacement" })).rejects.toThrow("Cannot supersede across scope or project");
  expect(env.db.getMemory("old")?.superseded_by).toBe(null);
  await runUpdateCommand(resolver, "old", { supersededBy: "global-replacement", allowCrossScope: true });
  expect(env.db.getMemory("old")).toMatchObject({ status: "superseded", superseded_by: "global-replacement" });
  expect(env.db.getMemory("global-replacement")?.supersedes).toBe("old");
});
