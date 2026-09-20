import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTestEnv, createTestEnv, type TestEnv } from "./_helpers.js";

let env: TestEnv;
let store: string;
let configFile: string;

const initial = {
  llm: { defaultProvider: "ollama", ollama: { model: "fixture-default", baseUrl: "http://127.0.0.1:11434" }, lmstudio: { model: "fixture-secondary", baseUrl: "http://127.0.0.1:1234/v1" } },
  taskModels: {
    structuring: { provider: "ollama", model: "old-structuring" },
    synthesis: { provider: "lmstudio", model: "old-synthesis" },
    vision: { provider: "ollama", model: "old-vision" },
    transcription: { provider: "lmstudio", model: "old-transcription" },
  },
  dream: {
    enabled: true, idleMinutes: 17, maxRuntimeMinutes: 19, provider: "ollama", model: "dream-stays",
    selfCritique: false, generateSummaries: true, discoverRelationships: false, minMemories: 7,
    schedule: { startHour: 4, endHour: 6 }, systemIdleMinutes: 41, minNewMemoriesToDream: 5,
    minHoursBetweenRuns: 12, maxLLMCallsPerRun: 3,
  },
  recall: { aggressive: false, maxMemories: 6, minRelevance: 0.7 },
  importConcurrency: 7,
  autoCommit: false,
  defaultAuthor: "human",
  extensionState: { punctuation: "quotes \" and \\ paths", nested: [1, false, "unchanged"] },
};

beforeEach(async () => {
  env = await createTestEnv("routing-reset-adversarial");
  store = path.join(env.tmpDir, ".gnosys");
  fs.mkdirSync(store);
  configFile = path.join(store, "gnosys.json");
  fs.writeFileSync(configFile, `${JSON.stringify(initial, null, 2)}\n`);
  vi.stubEnv("GNOSYS_HOME", path.join(env.tmpDir, "brain"));
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(env.tmpDir, "config"));
  vi.spyOn(os, "homedir").mockReturnValue(env.tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async () => new Response("unavailable", { status: 503 }));
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await cleanupTestEnv(env);
});

async function routing(answers: string[]): Promise<boolean> {
  const { runRoutingSetup } = await import("../lib/setup/sections/routing.js");
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output });
  const transcript: Array<{ prompt: string; answer: string | undefined }> = [];
  output.on("data", prompt => {
    const answer = answers.shift();
    transcript.push({ prompt: String(prompt), answer });
    if (answer === undefined) input.end();
    else setImmediate(() => input.write(`${answer}\n`));
  });
  try {
    const changed = await runRoutingSetup({ directory: env.tmpDir, rl });
    expect(answers, JSON.stringify(transcript)).toEqual([]);
    return changed;
  } finally {
    rl.close();
    input.destroy();
    output.destroy();
  }
}

function persisted(): { routing: unknown; unrelatedBytes: Buffer } {
  const parsed: Record<string, unknown> = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const { taskModels, ...unrelated } = parsed;
  return { routing: taskModels, unrelatedBytes: Buffer.from(JSON.stringify(unrelated)) };
}

describe("routing reset attacks", () => {
  it.fails("DEF-G1-001: reset clears several overrides and preserves every unrelated config value", async () => {
    const before = persisted().unrelatedBytes;
    expect(await routing(["4", "y"])).toBe(true);
    const after = persisted();
    expect(after.unrelatedBytes).toEqual(before);
    expect(after.routing, JSON.stringify(after.routing)).toEqual({});
  });

  it.fails("DEF-G1-001: reset then set one new override does not restore old routing or change unrelated config", async () => {
    const before = persisted().unrelatedBytes;
    expect(await routing(["4", "y"])).toBe(true);
    expect(await routing(["3", "1", "3", "new-structuring", "y"])).toBe(true);
    const after = persisted();
    expect(after.unrelatedBytes).toEqual(before);
    expect(after.routing, JSON.stringify(after.routing)).toEqual({ structuring: { provider: "ollama", model: "new-structuring" } });
  });
});
