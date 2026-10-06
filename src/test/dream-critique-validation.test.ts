import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { makeMemory } from "./_helpers.js";

vi.mock("../lib/llm.js", async (original) => ({
  ...await original<typeof import("../lib/llm.js")>(),
  createProvider: () => ({ name: "ollama", model: "test", generate: async (prompt: string) => {
    if (prompt.includes("Title: bad-action")) return '{"action":"delete","reason":"wrong action"}';
    if (prompt.includes("Title: bad-reason")) return '{"action":"review","reason":42}';
    return '{"action":"needs-update","reason":"Check the current setting"}';
  } }),
}));

afterEach(() => vi.unstubAllEnvs());

it("persists only valid LLM critique actions and string reasons", async () => {
  const home = mkdtempSync(join(tmpdir(), "dream-critique-validation-"));
  vi.stubEnv("GNOSYS_HOME", home);
  const db = new GnosysDB(home);
  try {
    for (const id of ["bad-action", "bad-reason", "valid"]) db.insertMemory(makeMemory({
      id, title: id, confidence: 0.5, reinforcement_count: 1,
      last_reinforced: new Date().toISOString(), tags: '["config"]', relevance: "config",
      content: "This is a sufficiently detailed memory about the current setting.",
    }));
    const report = await new GnosysDreamEngine(db, DEFAULT_CONFIG, {
      minMemories: 3, generateSummaries: false, discoverRelationships: false,
    }, { stateDir: home }).dream();
    const expected = [{
      memoryId: "valid", title: "valid", reason: "Check the current setting",
      currentConfidence: 0.5, suggestedAction: "needs-update",
    }];
    expect(report.reviewSuggestions).toEqual(expected);
    const today = new Date().toISOString().split("T")[0];
    expect(JSON.parse(db.getSummary("dream", `review-${today}`)?.content ?? "null")).toEqual(expected);
  } finally {
    db.close();
    rmSync(home, { recursive: true, force: true });
  }
});
