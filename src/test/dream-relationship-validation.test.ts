import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { readDreamState } from "../lib/dreamRunLog.js";
import { makeMemory } from "./_helpers.js";

const generate = vi.fn<(prompt: string) => Promise<string>>();
vi.mock("../lib/llm.js", async (original) => ({
  ...await original<typeof import("../lib/llm.js")>(),
  createProvider: () => ({ name: "ollama", model: "test", generate }),
}));

let home: string;
let db: GnosysDB;
function engine() {
  return new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    minMemories: 3, selfCritique: false, generateSummaries: false,
  }, { stateDir: home });
}
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dream-rel-validation-"));
  vi.stubEnv("GNOSYS_HOME", home);
  db = new GnosysDB(home);
  for (const id of ["a", "b", "c"]) db.insertMemory(makeMemory({ id, created: "2026-10-01T00:00:00.000Z" }));
  generate.mockReset();
});
afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

it.each([
  { rel_type: "causes" },
  { label: undefined },
  { confidence: "0.9" },
])("saves valid relationships beside an invalid item %j and advances success", async (invalid) => {
  const valid = { source_id: "a", target_id: "b", rel_type: "related_to", label: "shared decision", confidence: 0.9 };
  generate.mockResolvedValue(JSON.stringify([valid, { ...valid, ...invalid }]));
  const report = await engine().dream();
  expect(report.relationshipsDiscovered).toBe(1);
  expect(db.getRelationshipsFrom("a").map(({ target_id, label }) => ({ target_id, label })))
    .toEqual([{ target_id: "b", label: "shared decision" }]);
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual(["Relationship discovery: dropped 1 item(s) in batch a,b,c: 1 invalid."]);
  const state = readDreamState(home);
  expect(state.lastSuccessfulRunAt).toBe(report.finishedAt);
  expect(Object.values(state.analyzedFingerprints).filter((entry) => entry.memoryIds.length === 1).length).toBe(3);
  await engine().dream();
  expect(generate.mock.calls.length).toBe(1);
});

it.each(["No relationships found.", "None.", "[]"])("accepts %s as an analyzed empty batch", async (response) => {
  generate.mockResolvedValue(response);
  const report = await engine().dream();
  expect(report.errors).toEqual([]);
  expect(report.relationshipsDiscovered).toBe(0);
  await engine().dream();
  expect(generate.mock.calls.length).toBe(1);
});

it("stops retrying a malformed reply after three attempts even when unrelated content changes", async () => {
  generate.mockResolvedValue("I could not finish this analysis.");
  const reports = [];
  for (let attempt = 0; attempt < 4; attempt++) reports.push(await engine().dream());
  expect(reports.map((report) => report.errors.length)).toEqual([1, 1, 1, 0]);
  expect(reports[2].errors).toEqual(["Relationship discovery: Relationship response did not contain a JSON array; it will be retried."]);
  expect(reports[2].warnings).toEqual(["Relationship discovery: retry limit reached for a,b,c; marked analyzed."]);
  expect(generate.mock.calls.length).toBe(3);
  db.insertMemory(makeMemory({ id: "d" }));
  generate.mockResolvedValue("[]");
  const next = await engine().dream();
  expect(next.llmCalls?.filter((call) => call.phase === "relationships" && call.status === "made").flatMap((call) => call.memoryIds)).toEqual(["d"]);
  db.updateMemory("a", { content: "Changed source content" });
  const changed = await engine().dream();
  expect(changed.llmCalls?.filter((call) => call.phase === "relationships" && call.status === "made").flatMap((call) => call.memoryIds)).toEqual(["a", "d"]);
});

it("counts every rejected category once while saving valid edges and marking the batch analyzed", async () => {
  const valid = { source_id: "a", target_id: "b", rel_type: "related_to", label: "accepted", confidence: 0.7 };
  generate.mockResolvedValue(JSON.stringify([
    valid,
    { ...valid, rel_type: "causes" },
    { ...valid, target_id: "missing" },
    { ...valid, source_id: "missing", confidence: 0.2 },
    { ...valid, target_id: "a" },
    { ...valid, confidence: 0.69 },
  ]));
  const report = await engine().dream();
  expect(report.relationshipsDiscovered).toBe(1);
  expect(db.getRelationshipsFrom("a").map(({ target_id, label }) => ({ target_id, label })))
    .toEqual([{ target_id: "b", label: "accepted" }]);
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual([
    "Relationship discovery: dropped 5 item(s) in batch a,b,c: 1 invalid, 2 unknown id, 1 self-link, 1 below confidence.",
  ]);
  const state = readDreamState(home);
  expect(Object.values(state.analyzedFingerprints).filter((entry) => entry.memoryIds.length === 1)
    .flatMap((entry) => entry.memoryIds).sort()).toEqual(["a", "b", "c"]);
  await engine().dream();
  expect(generate.mock.calls.length).toBe(1);
});
