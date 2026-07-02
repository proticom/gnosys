/**
 * Regression tests for the v5.13.0 dream-state pollution bug.
 *
 * dream-resume.test.ts ran GnosysDreamEngine in-process without setting
 * GNOSYS_HOME, so every `npm test` wrote its 5-fixture watermark into the
 * developer's REAL ~/.gnosys/dream-state.json — chronically suppressing
 * scheduled Dream ("not dreamworthy yet") over the real brain. This was
 * the "Dream Mode only sees 5 memories" symptom.
 *
 * Two layers under test: (1) the global vitest setup gives every worker a
 * throwaway GNOSYS_HOME, so in-process engines can't touch the real home;
 * (2) the engine accepts an explicit stateDir (defense in depth).
 *
 * Also covers the v5.13.0 embedding-health phase's no-model guarantees:
 * with zero embeddings initialized it must skip (never auto-download the
 * 80 MB model) while still reporting the coverage gap.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";
import type { GnosysConfig } from "../lib/config.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { getDreamStatePath } from "../lib/dreamRunLog.js";
import { makeMemory } from "./_helpers.js";

vi.mock("../lib/llm.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm.js")>();
  const fakeProvider = {
    name: "ollama" as const,
    model: "stub",
    generate: vi.fn(async () => '{"action":"ok"}'),
    testConnection: async () => true,
  };
  return {
    ...actual,
    getLLMProvider: vi.fn(() => fakeProvider),
    createProvider: vi.fn(() => fakeProvider),
  };
});

function baseConfig(): GnosysConfig {
  return { llm: { defaultProvider: "anthropic" }, dream: { enabled: true } } as unknown as GnosysConfig;
}

const decayOnlyDream = {
  enabled: true,
  minMemories: 1,
  selfCritique: false,
  generateSummaries: false,
  discoverRelationships: false,
};

let tmp: string;
let db: GnosysDB;
let prevGnosysHome: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dream-iso-"));
  prevGnosysHome = process.env.GNOSYS_HOME;
  process.env.GNOSYS_HOME = tmp;
  db = new GnosysDB(tmp);
  for (let i = 1; i <= 3; i++) {
    db.insertMemory(makeMemory({ id: `iso-${i}`, title: `Iso Memory ${i}` }));
  }
});

afterEach(() => {
  db.close();
  if (prevGnosysHome === undefined) {
    delete process.env.GNOSYS_HOME;
  } else {
    process.env.GNOSYS_HOME = prevGnosysHome;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("dream-state isolation (v5.13.0)", () => {
  it("the vitest global setup provides a throwaway GNOSYS_HOME to every worker", () => {
    // prevGnosysHome is what the worker had before this test overrode it —
    // the setup file must have already pointed it away from the real home.
    expect(prevGnosysHome).toBeDefined();
    expect(prevGnosysHome).not.toBe(path.join(os.homedir(), ".gnosys"));
    expect(prevGnosysHome!.includes("gnosys-test-home-")).toBe(true);
    expect(prevGnosysHome!.endsWith(".gnosys")).toBe(true);
  });

  it("engine.dream() writes dream-state.json under GNOSYS_HOME, not the real home", async () => {
    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    await engine.dream();

    const statePath = path.join(tmp, "dream-state.json");
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    expect(state.lastMemoryCount).toBe(3);
  });

  it("an explicit stateDir overrides GNOSYS_HOME (defense in depth)", async () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dream-statedir-"));
    try {
      const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream, {
        stateDir,
      });
      await engine.dream();

      expect(fs.existsSync(path.join(stateDir, "dream-state.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmp, "dream-state.json"))).toBe(false);
    } finally {
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("getDreamStatePath accepts a baseDir override", () => {
    expect(getDreamStatePath("/explicit/dir")).toBe("/explicit/dir/dream-state.json");
    expect(getDreamStatePath()).toBe(path.join(tmp, "dream-state.json"));
  });
});

describe("embedding-health phase (v5.13.0)", () => {
  it("reports the coverage gap but never auto-downloads the model when embeddings were never initialized", async () => {
    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    const report = await engine.dream();

    expect(report.embeddingHealth).toEqual({ total: 3, missingBefore: 3, embedded: 0 });
    const phase = report.phases?.find((p) => p.name === "embedding-health");
    expect(phase?.status).toBe("skipped");
    expect(phase?.reason).toContain("run gnosys_reindex");
    // No embedding-related error — the gap is a report, not a failure.
    expect(report.errors.filter((e) => e.includes("Embedding"))).toEqual([]);
  });

  it("skips cleanly when every memory is already embedded", async () => {
    const vec = Buffer.from(new Float32Array([1, 2, 3, 4]).buffer);
    for (let i = 1; i <= 3; i++) {
      db.updateEmbedding(`iso-${i}`, vec);
    }

    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    const report = await engine.dream();

    expect(report.embeddingHealth).toEqual({ total: 3, missingBefore: 0, embedded: 0 });
    const phase = report.phases?.find((p) => p.name === "embedding-health");
    expect(phase?.status).toBe("skipped");
    expect(phase?.reason).toBe("all memories embedded");
  });
});
