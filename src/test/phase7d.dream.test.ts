/**
 * Phase 7d: Dream Mode
 * Test Plan Reference: "Phase 7 Sub-Phase Tests — 7d"
 *
 *   TC-7d.1: Dream Mode config + consolidation engine
 *   TC-7d.2: No CPU hog — runs only when idle
 *   TC-7d.3: Dream notes appear in audit_log
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createTestEnv,
  cleanupTestEnv,
  type TestEnv,
  makeMemory,
} from "./_helpers.js";

import { GnosysConfigSchema } from "../lib/config.js";
import { GnosysDreamEngine } from "../lib/dream.js";

let env: TestEnv;
function engine(): GnosysDreamEngine {
  return new GnosysDreamEngine(env.db, GnosysConfigSchema.parse({}), {
    minMemories: 1, selfCritique: false, generateSummaries: false, discoverRelationships: false,
  }, { stateDir: env.tmpDir });
}
function seed(): void {
  env.db.insertMemory(makeMemory({ id: "dream-effect", title: "Dream effect", confidence: 0.9, modified: "2026-01-01T00:00:00.000Z" }));
}


beforeEach(async () => {
  env = await createTestEnv("phase7d");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-11T00:00:00.000Z"));
});

afterEach(async () => {
  vi.useRealTimers();
  await cleanupTestEnv(env);
});

describe("Phase 7d: Dream Mode", () => {
  // ─── TC-7d.1: Dream engine and config ────────────────────────────────

  describe("TC-7d.1: Dream Mode configuration and engine", () => {
    it("Dream diagnoses an empty unmigrated store", async () => {
      const report = await engine().dream();
      expect(report.errors).toEqual(["gnosys.db not available or not migrated"]);
      expect(report.decayUpdated).toBe(0);
      expect(env.db.queryAuditLog({ limit: 10 })).toEqual([]);
    });





    it("Dream runs all optional phases by default", async () => {
      seed();
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ response: "[]", done: true }), { status: 200 })));
      try {
        const actual = new GnosysDreamEngine(env.db, GnosysConfigSchema.parse({}), { minMemories: 1 }, { stateDir: env.tmpDir });
        const report = await actual.dream();
        expect(report.errors).toEqual([]);
        expect(report.phases?.map(phase => phase.name)).toEqual(["decay", "embedding-health", "critique", "summaries", "relationships"]);
        expect(env.db.getMemory("dream-effect")?.confidence).toBe(0.86);
      } finally { vi.unstubAllGlobals(); }
    });
  });

  // ─── TC-7d.2: Resource safety ────────────────────────────────────────

  describe("TC-7d.2: Resource safety (no CPU hog)", () => {
    it("Dream aborts at a phase boundary after its default runtime limit", async () => {
      seed();
      const report = await engine().dream((phase) => {
        if (phase === "decay") vi.setSystemTime(new Date("2026-01-11T00:31:00.000Z"));
      });
      expect(report).toMatchObject({ aborted: true, abortReason: "max runtime exceeded (30min)", decayUpdated: 1 });
      expect(report.phases?.map(phase => phase.name)).toEqual(["decay"]);
      expect(env.db.getMemory("dream-effect")?.confidence).toBe(0.86);
    });
  });

  // ─── TC-7d.3: Dream notes in audit_log ───────────────────────────────

  describe("TC-7d.3: Dream activity audit logging", () => {
    it("Dream writes completion audit details for its persisted decay", async () => {
      seed();
      const report = await engine().dream();
      expect(report).toMatchObject({ errors: [], decayUpdated: 1, aborted: false });
      const entries = env.db.queryAuditLog({ operation: "dream_complete" });
      expect(entries).toHaveLength(1);
      expect(JSON.parse(entries[0].details || "null")).toMatchObject({ decayUpdated: 1, llmCallsMade: 0, errors: 0, aborted: false });
      expect(env.db.getMemory("dream-effect")?.confidence).toBe(0.86);
    });

    it("Dream start audit records the actual run configuration and memory count", async () => {
      seed();
      await engine().dream();
      const entries = env.db.queryAuditLog({ operation: "dream_start" });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ operation: "dream_start", timestamp: "2026-01-11T00:00:00.000Z", memory_id: null });
      expect(JSON.parse(entries[0].details || "null")).toEqual({ startedAt: "2026-01-11T00:00:00.000Z", config: { maxRuntime: 30, selfCritique: false, generateSummaries: false, discoverRelationships: false, provider: "ollama", model: null }, memoryCount: 1 });
    });
  });
});
