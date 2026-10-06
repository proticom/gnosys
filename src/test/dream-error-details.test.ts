import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { runDreamLogCommand } from "../lib/dreamLogCommand.js";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { makeMemory } from "./_helpers.js";

vi.mock("../lib/llm.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/llm.js")>(),
  createProvider: () => ({ name: "ollama", model: "test", generate: async () => "[]" }),
}));

let home: string;
let db: GnosysDB;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "gnosys-dream-errors-"));
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

it("persists embedding errors in the audit row and prints them through dream log", async () => {
  db.insertMemory(makeMemory({ id: "embedded", embedding: Buffer.alloc(384 * 4) }));
  db.insertMemory(makeMemory({ id: "missing" }));
  vi.spyOn(GnosysEmbeddings.prototype, "embedBatch").mockRejectedValue(
    new Error("Local embeddings require @huggingface/transformers. Install it with: npm install @huggingface/transformers"),
  );
  const engine = new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    minMemories: 1,
    selfCritique: false,
    generateSummaries: false,
    discoverRelationships: false,
  });
  await engine.dream();
  const message = "Embedding health: Local embeddings require @huggingface/transformers. Install it with: npm install @huggingface/transformers";
  expect(db.getRecentDreamRuns(1)[0].details).toMatchObject({
    errors: 1,
    errorMessages: [message],
  });
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  await runDreamLogCommand({ last: "1", failuresOnly: true });
  expect(output.mock.calls.flat().join("\n")).toContain(message);
  output.mockClear();
  await runDreamLogCommand({ last: "1", json: true });
  expect(JSON.parse(output.mock.calls.flat().join("\n")).runs[0].details.errorMessages).toEqual([message]);
});

it("labels older failed rows without inventing a message", async () => {
  db.logAudit({
    timestamp: "2026-10-06T00:00:00Z",
    operation: "dream_complete",
    memory_id: null,
    details: JSON.stringify({ errors: 1 }),
    duration_ms: 10,
    trace_id: null,
  });
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  await runDreamLogCommand({ last: "1" });
  expect(output.mock.calls.flat().join("\n")).toContain("Error details were not saved by this older Dream run.");
});

it("counts summary updates as work in the audit consumer", async () => {
  db.logAudit({
    timestamp: "2026-10-06T00:00:00Z",
    operation: "dream_complete",
    memory_id: null,
    details: JSON.stringify({ summariesGenerated: 0, summariesUpdated: 4, errors: 0 }),
    duration_ms: 10,
    trace_id: null,
  });
  expect(db.getLastSuccessfulDreamRun()?.details.summariesUpdated).toBe(4);
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  await runDreamLogCommand({ last: "1" });
  const text = output.mock.calls.flat().join("\n");
  expect(text).toContain("did work");
  expect(text).toContain("summaries=0 updated=4");
});
