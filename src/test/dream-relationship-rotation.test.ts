import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { makeMemory } from "./_helpers.js";

vi.mock("../lib/llm.js", async (original) => ({
  ...await original<typeof import("../lib/llm.js")>(),
  createProvider: () => ({ name: "ollama", model: "test", generate: async () => "[]" }),
}));

let home: string;
let db: GnosysDB;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dream-rotation-"));
  vi.stubEnv("GNOSYS_HOME", home);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
  db = new GnosysDB(home);
  for (let i = 0; i < 12; i++) {
    const id = `m${String(i).padStart(2, "0")}`;
    db.insertMemory(makeMemory({ id, created: "2026-10-01T00:00:00Z" }));
  }
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

async function picked() {
  vi.advanceTimersByTime(1000);
  const report = await new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    minMemories: 3, selfCritique: false, generateSummaries: false, maxLLMCallsPerRun: 1,
  }, { stateDir: home }).dream();
  return report.llmCalls?.filter((call) => call.phase === "relationships" && call.status === "made")
    .flatMap((call) => call.memoryIds);
}

it("rotates by oldest analysis after full coverage when unrelated index content changes", async () => {
  expect(await picked()).toEqual(["m00", "m01", "m02", "m03", "m04"]);
  expect(await picked()).toEqual(["m05", "m06", "m07", "m08", "m09"]);
  expect(await picked()).toEqual(["m10", "m11"]);
  expect(await picked()).toEqual([]);
  db.updateMemory("m11", { relevance: "changed index metadata" });
  expect(await picked()).toEqual(["m00", "m01", "m02", "m03", "m04"]);
  db.updateMemory("m11", { relevance: "changed again" });
  expect(await picked()).toEqual(["m05", "m06", "m07", "m08", "m09"]);
});
