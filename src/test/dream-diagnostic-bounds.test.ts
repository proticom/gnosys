import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { runDreamLogCommand } from "../lib/dreamLogCommand.js";
import { makeMemory } from "./_helpers.js";

vi.mock("../lib/llm.js", async (original) => ({
  ...await original<typeof import("../lib/llm.js")>(),
  createProvider: () => ({ name: "ollama", model: "test", generate: async () => "[]" }),
}));
let home: string;
let db: GnosysDB;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dream-diagnostic-bounds-"));
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  db = GnosysDB.openCentral();
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

it("saves one compact Zod error line in audit rows", async () => {
  db.insertMemory(makeMemory({ id: "a" }));
  const invalid = z.object({ label: z.string() }).safeParse({ label: 3 });
  if (invalid.success) throw new Error("Expected invalid fixture");
  vi.spyOn(db, "countMemoriesMissingEmbedding").mockImplementation(() => { throw invalid.error; });
  const report = await new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    minMemories: 1, selfCritique: false, generateSummaries: false, discoverRelationships: false,
  }, { stateDir: home }).dream();
  const expected = "Embedding health: label: Invalid input: expected string, received number";
  expect(report.errors).toEqual([expected]);
  expect(db.getRecentDreamRuns(1)[0].details.errorMessages).toEqual([expected]);
});

it("bounds stored errors to 300 characters", async () => {
  db.insertMemory(makeMemory({ id: "a" }));
  vi.spyOn(db, "countMemoriesMissingEmbedding").mockImplementation(() => { throw new Error(`bad\n${"x".repeat(500)}`); });
  const report = await new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    minMemories: 1, selfCritique: false, generateSummaries: false, discoverRelationships: false,
  }, { stateDir: home }).dream();
  expect(report.errors).toEqual([`Embedding health: bad ${"x".repeat(275)}...`]);
  expect(db.getRecentDreamRuns(1)[0].details.errorMessages).toEqual(report.errors);
});

it("prints at most 20 one-line truncated errors from older audit rows", async () => {
  db.logAudit({
    timestamp: "2026-10-06T00:00:00Z", operation: "dream_complete", memory_id: null,
    details: JSON.stringify({ errors: 25, errorMessages: Array.from({ length: 25 }, () => `bad\n${"x".repeat(400)}`) }),
    duration_ms: 10, trace_id: null,
  });
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  await runDreamLogCommand({ last: "1" });
  const lines = output.mock.calls.flat().map(String).filter((line) => line.includes("bad"));
  expect(lines).toEqual(Array.from({ length: 20 }, () => `    \x1b[31mbad ${"x".repeat(293)}...\x1b[0m`));
});
