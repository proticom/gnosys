import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAddStructuredCommand, type AddStructuredOptions } from "../lib/addStructuredCommand.js";
import { runUpdateCommand } from "../lib/updateCommand.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

let env: TestEnv;
const options: AddStructuredOptions = {
  title: "Corrected deployment", category: "decisions", content: "Deploy with the current approach.",
  tags: "{}", relevance: "deployment", author: "human", authority: "declared", confidence: "0.9",
};

beforeEach(async () => {
  env = await createTestEnv("supersession-cli");
  vi.stubEnv("GNOSYS_HOME", env.tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  env.db.insertMemory(makeMemory({ id: "old", title: "Old deployment", relevance: "deployment", modified: "2024-02-03" }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await cleanupTestEnv(env);
});

describe("CLI supersession writes", () => {
  it.each(["project", "user", "global"])("links structured additions in %s scope", async (scope) => {
    await runAddStructuredCommand({ ...options, user: scope === "user", global: scope === "global", supersedes: "old" }, async () => null);
    const replacement = env.db.getAllMemories().find((memory) => memory.title === "Corrected deployment");
    expect(replacement).toMatchObject({ supersedes: "old", status: "active", scope });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: replacement?.id, status: "superseded", modified: "2024-02-03" });
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

  it("links an update from the predecessor side", async () => {
    env.db.insertMemory(makeMemory({ id: "correction", title: "Correction" }));
    await runUpdateCommand(async () => { throw new Error("Unexpected legacy lookup"); }, "old", { supersededBy: "correction" });
    expect(env.db.getMemory("old")).toMatchObject({ status: "superseded", superseded_by: "correction", modified: "2024-02-03" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: "old" });
  });
});
