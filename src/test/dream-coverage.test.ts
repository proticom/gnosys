/**
 * CC.2 — coverage for dream.ts (orchestrator, phases, formatDreamReport, DreamScheduler).
 * NEW file only; does not modify existing dream*.test.ts files.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB, type DbMemory } from "../lib/db.js";
import { DEFAULT_CONFIG, type GnosysConfig } from "../lib/config.js";
import { execFile } from "child_process";
import { z } from "zod";
import {
  GnosysDreamEngine,
  DreamScheduler,
  formatDreamReport,
  type DreamReport,
} from "../lib/dream.js";
import { makeMemory } from "./_helpers.js";

const providerResponse = vi.fn<(prompt: string) => Promise<string>>();
vi.mock("child_process", async (original) => ({
  ...await original<typeof import("child_process")>(),
  execSync: vi.fn(() => { throw new Error("test keychain is empty"); }),
  execFile: vi.fn((_file, _args, _options, callback) => { callback(null); }),
}));

function baseConfig(): GnosysConfig {
  return { ...DEFAULT_CONFIG, llmRetryAttempts: 1, llm: { ...DEFAULT_CONFIG.llm, ollama: { model: "audit-model", baseUrl: "http://model.invalid" } } };
}

const decayOnlyDream = {
  enabled: true,
  minMemories: 3,
  selfCritique: false,
  generateSummaries: false,
  discoverRelationships: false,
};

function insertMemory(db: GnosysDB, overrides: Partial<DbMemory> = {}): void {
  const mem = makeMemory(overrides);
  db.insertMemory(mem);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0] + "T12:00:00.000Z";
}

let tmp: string;
let db: GnosysDB;
let prevGnosysHome: string | undefined;

beforeEach(() => {
  providerResponse.mockReset().mockResolvedValue('{"action":"ok"}');
  vi.mocked(execFile).mockClear();
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    const request = z.object({ model: z.string(), messages: z.array(z.object({ role: z.string(), content: z.string() })) }).parse(JSON.parse(String(init?.body)));
    return Response.json({ message: { content: await providerResponse(request.messages.at(-1)?.content || "") } });
  });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dream-cov-"));
  // Isolate dream-runs.jsonl / dream-state.json from the real ~/.gnosys.
  prevGnosysHome = process.env.GNOSYS_HOME;
  process.env.GNOSYS_HOME = tmp;
  vi.stubEnv("HOME", tmp);
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(tmp, "config"));
  for (const name of ["GNOSYS_GLOBAL_ANTHROPIC_KEY", "GNOSYS_ANTHROPIC_KEY", "ANTHROPIC_API_KEY", "GNOSYS_LLM_API_KEY"]) vi.stubEnv(name, "");
  db = new GnosysDB(tmp);
});

afterEach(() => {
  db.close();
  if (prevGnosysHome === undefined) {
    delete process.env.GNOSYS_HOME;
  } else {
    process.env.GNOSYS_HOME = prevGnosysHome;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GnosysDreamEngine.dream() orchestrator", () => {
  it("reports an empty database before beginning Dream", async () => {
    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    const report = await engine.dream();
    expect(report.errors).toContain("gnosys.db not available or not migrated");
    expect(report.decayUpdated).toBe(0);
  });

  it("exits early when too few memories", async () => {
    insertMemory(db);
    insertMemory(db);
    const engine = new GnosysDreamEngine(db, baseConfig(), { ...decayOnlyDream, minMemories: 10 });
    const report = await engine.dream();
    expect(report.errors).toEqual(["Too few memories (2 < 10)"]);
  });

  it("records provider-init error and increments consecutive failures", async () => {
    for (let i = 0; i < 5; i++) insertMemory(db, { id: `prov-${i}` });
    const engine = new GnosysDreamEngine(db, baseConfig(), { ...decayOnlyDream, provider: "anthropic" });
    const report = await engine.dream();
    expect(report.errors.some((e) => e.includes("Provider unavailable"))).toBe(true);
    const audit = db.queryAuditLog({ operation: "dream_provider_unreachable", limit: 1 });
    expect(audit.length).toBe(1);
    expect(audit[0].operation).toBe("dream_provider_unreachable");
    expect(db.getDreamConsecutiveFailures()).toBe(1);
  });

  it("fires desktop notification at consecutive failure threshold", async () => {
    db.setMeta("dream_consecutive_failures", "2");
    for (let i = 0; i < 5; i++) insertMemory(db, { id: `notify-${i}` });
    const engine = new GnosysDreamEngine(db, baseConfig(), { ...decayOnlyDream, provider: "anthropic" });
    await engine.dream();
    expect(db.getDreamConsecutiveFailures()).toBe(3);
    expect(execFile).toHaveBeenCalledTimes(1);
    const message = "Dream provider has failed 3 times in a row. Run 'gnosys setup dream' to reconfigure.";
    if (process.platform === "darwin") expect(vi.mocked(execFile).mock.calls[0]?.slice(0, 3)).toEqual(["osascript", ["-e", `display notification "${message}" with title "Gnosys Dream" subtitle "anthropic/default" sound name "Submarine"`], { timeout: 3000 }]);
    else expect(vi.mocked(execFile).mock.calls[0]?.slice(0, 3)).toEqual(["notify-send", ["Gnosys Dream", message], { timeout: 3000 }]);
  });

  it("runs all enabled phases through the configured provider", async () => {
    for (let i = 0; i < 6; i++) {
      insertMemory(db, {
        id: `happy-a-${i}`,
        category: "decisions",
        content: "A long enough memory body for dream coverage testing purposes here.",
        tags: '["test"]',
        relevance: "dream test",
      });
    }
    for (let i = 0; i < 6; i++) {
      insertMemory(db, {
        id: `happy-b-${i}`,
        category: "concepts",
        content: "Another long enough memory body for dream coverage testing purposes.",
        tags: '["test"]',
        relevance: "dream test",
      });
    }
    providerResponse.mockImplementation(async (prompt: string) => {
      if (prompt.includes("relationship")) {
        return JSON.stringify([
          { source_id: "happy-a-0", target_id: "happy-a-1", rel_type: "references", label: "link", confidence: 0.9 },
        ]);
      }
      if (prompt.includes("Category summary") || prompt.includes("category")) {
        return "# Category summary\nKey themes and patterns.";
      }
      return '{"action":"ok"}';
    });
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: true,
      generateSummaries: true,
      discoverRelationships: true,
    });
    const report = await engine.dream();
    expect(report.phases?.map(phase => phase.name)).toEqual(["decay", "embedding-health", "critique", "summaries", "relationships"]);
    expect(report.summariesGenerated).toBe(2);
    expect(db.getSummary("category", "decisions")?.content).toBe("# Category summary\nKey themes and patterns.");
    expect(db.getRelationshipsFrom("happy-a-0")).toMatchObject([{ target_id: "happy-a-1", rel_type: "references", label: "link", confidence: 0.9 }]);
    expect(report.errors.filter((e) => !e.includes("Provider unavailable"))).toEqual([]);
  });

  it("aborts at shouldStop checkpoint when abort requested", async () => {
    for (let i = 0; i < 5; i++) insertMemory(db, { id: `abort-${i}` });
    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    const report = await engine.dream((phase) => {
      if (phase === "decay") engine.abort();
    });
    expect(report.aborted).toBe(true);
    expect(report.abortReason).toBe("abort requested");
  });

  it("aborts when max runtime exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      insertMemory(db, {
        id: `overtime-${i}`,
        category: i % 2 === 0 ? "decisions" : "concepts",
        content: "Long content for overtime dream test with enough text for critique rules.",
        tags: '["test"]',
        relevance: "overtime",
        confidence: 0.45,
      });
    }
    providerResponse.mockResolvedValue('{"action":"review","reason":"check"}');
    let currentTime = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      maxRuntimeMinutes: 0.001,
      selfCritique: true,
      generateSummaries: false,
      discoverRelationships: false,
    });
    const report = await engine.dream((phase) => {
      if (phase === "decay") currentTime += 120;
    });
    expect(report.aborted).toBe(true);
    expect(report.abortReason).toMatch(/max runtime exceeded/);
  });

  it("resets consecutive failures when LLM work succeeded", async () => {
    db.setMeta("dream_consecutive_failures", "5");
    for (let i = 0; i < 4; i++) {
      insertMemory(db, { id: `reset-a-${i}`, category: "decisions", content: "Enough content for summary generation in dream coverage test." });
    }
    for (let i = 0; i < 4; i++) {
      insertMemory(db, { id: `reset-b-${i}`, category: "concepts", content: "Enough content for summary generation in dream coverage test." });
    }
    providerResponse.mockResolvedValue("# Summary\nCategory overview.");
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: true,
      discoverRelationships: false,
    });
    const report = await engine.dream();
    expect(report.summariesGenerated).toBeGreaterThan(0);
    expect(db.getMeta("dream_consecutive_failures")).toBe("0");
  });
});

describe("GnosysDreamEngine phase implementations", () => {
  it("decaySweep updates stale memories and skips recent ones", async () => {
    insertMemory(db, {
      id: "decay-today",
      last_reinforced: todayIso(),
      confidence: 0.9,
    });
    insertMemory(db, {
      id: "decay-5d",
      last_reinforced: daysAgoIso(5),
      confidence: 0.9,
      content: "Five day old memory with enough content for dream decay sweep testing.",
    });
    insertMemory(db, {
      id: "decay-200d",
      last_reinforced: daysAgoIso(200),
      confidence: 0.9,
      content: "Very old memory with enough content for dream decay sweep testing.",
    });
    insertMemory(db, { id: "decay-extra", last_reinforced: daysAgoIso(5), confidence: 0.9 });
    const engine = new GnosysDreamEngine(db, baseConfig(), decayOnlyDream);
    const report = await engine.dream();
    expect(report.decayUpdated).toBe(3);
    expect(["decay-today", "decay-5d", "decay-200d", "decay-extra"].map(id => db.getMemory(id)?.confidence)).toEqual([0.9, 0.88, 0.33, 0.88]);
  });

  it("critiquMemory rule arms produce review suggestions", async () => {
    insertMemory(db, { id: "crit-low", confidence: 0.2, content: "Low confidence memory with enough content length for rules." });
    insertMemory(db, {
      id: "crit-old",
      reinforcement_count: 0,
      created: daysAgoIso(60),
      content: "Never reinforced old memory with enough content for critique rules.",
    });
    insertMemory(db, { id: "crit-short", content: "short", confidence: 0.5 });
    insertMemory(db, { id: "crit-notags", tags: "[]", content: "Memory without tags but with enough content for critique.", confidence: 0.5 });
    {
      const mem = makeMemory({
        id: "crit-norelevance",
        content: "Memory without relevance keywords but enough content.",
        confidence: 0.5,
      });
      mem.relevance = "";
      db.insertMemory(mem);
    }
    insertMemory(db, { id: "crit-badtags", tags: "not-json", content: "Memory with invalid tags format and enough content.", confidence: 0.5 });
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      ...decayOnlyDream,
      selfCritique: true,
    });
    const report = await engine.dream();
    const reasons = report.reviewSuggestions.map((s) => s.reason).join(" ");
    expect(reasons).toMatch(/Very low confidence/);
    expect(reasons).toMatch(/Never reinforced/);
    expect(reasons).toMatch(/short content/);
    expect(reasons).toMatch(/No tags/);
    expect(reasons).toMatch(/No relevance/);
    expect(reasons).toMatch(/Invalid tags/);
    const lowConf = report.reviewSuggestions.find((s) => s.memoryId === "crit-low");
    expect(lowConf?.suggestedAction).toBe("consider-archive");
  });

  it("llmCritique handles ok, review, needs-update, and malformed JSON", async () => {
    insertMemory(db, {
      id: "borderline-1",
      confidence: 0.45,
      content: "Borderline memory for LLM critique path in dream coverage testing with enough text.",
      tags: '["test"]',
      relevance: "borderline",
    });
    insertMemory(db, { id: "borderline-2", confidence: 0.45, content: "Second borderline memory for LLM critique coverage.", tags: '["test"]', relevance: "x" });
    insertMemory(db, { id: "borderline-3", confidence: 0.45, content: "Third borderline memory for LLM critique coverage.", tags: '["test"]', relevance: "x" });
    insertMemory(db, { id: "borderline-4", confidence: 0.45, content: "Fourth borderline memory for LLM critique coverage.", tags: '["test"]', relevance: "x" });
    providerResponse
      .mockResolvedValueOnce('{"action":"ok"}')
      .mockResolvedValueOnce('{"action":"review","reason":"needs eyes"}')
      .mockResolvedValueOnce('{"action":"needs-update","reason":"stale info"}')
      .mockResolvedValueOnce("not json at all");
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      ...decayOnlyDream,
      selfCritique: true,
    });
    const report = await engine.dream();
    const llmReasons = report.reviewSuggestions.filter((s) => s.reason.includes("needs eyes") || s.reason.includes("stale info"));
    expect(llmReasons.map(item => ({ id: item.memoryId, reason: item.reason, action: item.suggestedAction }))).toEqual([
      { id: "borderline-2", reason: "needs eyes", action: "review" },
      { id: "borderline-3", reason: "stale info", action: "needs-update" },
    ]);
  });

  it("generateSummaries creates, skips unchanged, and updates summaries", async () => {
    for (let i = 0; i < 3; i++) {
      insertMemory(db, { id: `sum-a-${i}`, category: "decisions", content: "Decision memory content for summary generation testing in dream." });
    }
    for (let i = 0; i < 3; i++) {
      insertMemory(db, { id: `sum-b-${i}`, category: "concepts", content: "Concept memory content for summary generation testing in dream." });
    }
    providerResponse.mockResolvedValue("# Category X\nSummary text.");
    const cfg = {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: true,
      discoverRelationships: false,
    };
    const engine1 = new GnosysDreamEngine(db, baseConfig(), cfg);
    const first = await engine1.dream();
    expect(first.summariesGenerated).toBe(2);
    expect(db.getSummary("category", "decisions")?.content).toBe("# Category X\nSummary text.");
    expect(db.getSummary("category", "concepts")?.content).toBe("# Category X\nSummary text.");

    const engine2 = new GnosysDreamEngine(db, baseConfig(), cfg);
    const second = await engine2.dream();
    expect(second.summariesGenerated).toBe(0);
    expect(second.summariesUpdated).toBe(0);

    insertMemory(db, { id: "sum-a-new", category: "decisions", content: "New decision memory to trigger summary update path." });
    providerResponse.mockResolvedValue("# Updated\nNew summary.");
    const engine3 = new GnosysDreamEngine(db, baseConfig(), cfg);
    const third = await engine3.dream();
    expect(third.summariesUpdated).toBe(1);
    expect(db.getSummary("category", "decisions")?.content).toBe("# Updated\nNew summary.");
    expect(db.getSummary("category", "concepts")?.content).toBe("# Category X\nSummary text.");
  });

  it("summarizeCategory swallows provider errors without crashing", async () => {
    for (let i = 0; i < 3; i++) {
      insertMemory(db, { id: `fail-sum-${i}`, category: "decisions", content: "Memory for summarize failure path in dream coverage test." });
    }
    for (let i = 0; i < 3; i++) {
      insertMemory(db, { id: `fail-sum-b-${i}`, category: "concepts", content: "Memory for summarize failure path in dream coverage test." });
    }
    providerResponse.mockRejectedValue(new Error("fail"));
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: true,
      discoverRelationships: false,
    });
    const report = await engine.dream();
    expect(report.summariesGenerated).toBe(0);
    expect(report.summariesUpdated).toBe(0);
    expect(report.errors.filter((e) => !e.includes("Provider unavailable"))).toEqual([]);
  });

  it("discoverRelationships filters self-ref, low confidence, and deduplicates", async () => {
    for (let i = 0; i < 6; i++) {
      insertMemory(db, { id: `rel-m${i}`, content: `Relationship memory ${i} with enough content for discovery.` });
    }
    providerResponse.mockResolvedValueOnce(
      JSON.stringify([
        { source_id: "rel-m0", target_id: "rel-m1", rel_type: "references", label: "valid", confidence: 0.9 },
        { source_id: "rel-m0", target_id: "rel-m0", rel_type: "references", label: "self", confidence: 0.9 },
        { source_id: "rel-m0", target_id: "rel-m2", rel_type: "references", label: "low", confidence: 0.5 },
      ]),
    );
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: false,
      discoverRelationships: true,
    });
    const report = await engine.dream();
    expect(report.relationshipsDiscovered).toBe(1);
    expect(db.getRelationshipsFrom("rel-m0")).toMatchObject([{ target_id: "rel-m1", rel_type: "references", label: "valid", confidence: 0.9 }]);

    providerResponse.mockResolvedValueOnce(
      JSON.stringify([
        { source_id: "rel-m0", target_id: "rel-m1", rel_type: "references", label: "dup", confidence: 0.9 },
      ]),
    );
    const engine2 = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: false,
      discoverRelationships: true,
    });
    const second = await engine2.dream();
    expect(second.relationshipsDiscovered).toBe(0);
  });

  it("findRelationships returns empty array on malformed JSON", async () => {
    for (let i = 0; i < 4; i++) {
      insertMemory(db, { id: `mal-rel-${i}`, content: "Memory for malformed relationship JSON test in dream coverage." });
    }
    providerResponse.mockResolvedValueOnce("not json at all");
    const engine = new GnosysDreamEngine(db, baseConfig(), {
      minMemories: 3,
      selfCritique: false,
      generateSummaries: false,
      discoverRelationships: true,
    });
    const report = await engine.dream();
    expect(report.relationshipsDiscovered).toBe(0);
  });
});

describe("formatDreamReport", () => {
  it("formats happy path with suggestions and errors", () => {
    const report: DreamReport = {
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      durationMs: 60000,
      decayUpdated: 3,
      summariesGenerated: 2,
      summariesUpdated: 0,
      reviewSuggestions: [
        {
          memoryId: "x",
          title: "T",
          reason: "r",
          currentConfidence: 0.4,
          suggestedAction: "review",
        },
      ],
      relationshipsDiscovered: 1,
      duplicatesFound: 0,
      errors: ["e1"],
      aborted: false,
    };
    const text = formatDreamReport(report);
    expect(text).toContain("Gnosys Dream Report");
    expect(text).toContain("Confidence decay updates: 3");
    expect(text).toContain("Review Suggestions (1):");
    expect(text).toContain("[review]");
    expect(text).toContain("Errors (1):");
    expect(text).toContain("e1");
  });

  it("formats aborted report", () => {
    const report: DreamReport = {
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
      decayUpdated: 0,
      summariesGenerated: 0,
      summariesUpdated: 0,
      reviewSuggestions: [],
      relationshipsDiscovered: 0,
      duplicatesFound: 0,
      errors: [],
      aborted: true,
      abortReason: "halt",
    };
    const text = formatDreamReport(report);
    expect(text).toContain("Aborted: halt");
  });

  it("formats empty report without suggestion or error headers", () => {
    const report: DreamReport = {
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
      decayUpdated: 0,
      summariesGenerated: 0,
      summariesUpdated: 0,
      reviewSuggestions: [],
      relationshipsDiscovered: 0,
      duplicatesFound: 0,
      errors: [],
      aborted: false,
    };
    const text = formatDreamReport(report);
    expect(text).not.toContain("Review Suggestions");
    expect(text).not.toContain("Errors (");
    expect(text).toContain("Duration:");
  });
});


describe("DreamScheduler", () => {
  const schedulers: DreamScheduler[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-11T12:00:00.000Z"));
    db.setMeta("machine_id", "audit-machine");
    db.setDreamMachineId("audit-machine");
    for (let index = 0; index < 5; index++) insertMemory(db, { id: `scheduled-${index}`, confidence: 0.9, last_reinforced: "2026-01-01T12:00:00.000Z", category: "decisions" });
  });
  afterEach(() => {
    for (const scheduler of schedulers) scheduler.stop();
    schedulers.length = 0;
  });
  function makeScheduler(config?: ConstructorParameters<typeof DreamScheduler>[1], summaries = false): DreamScheduler {
    const engine = new GnosysDreamEngine(db, baseConfig(), { ...decayOnlyDream, generateSummaries: summaries });
    const scheduler = new DreamScheduler(engine, config);
    schedulers.push(scheduler);
    return scheduler;
  }
  function completed(): Array<{ aborted: boolean }> {
    return db.queryAuditLog({ operation: "dream_complete", limit: 20 }).map(row => z.object({ aborted: z.boolean() }).parse(JSON.parse(row.details || "{}")));
  }
  async function runningDream(): Promise<{ scheduler: DreamScheduler; finish: () => void }> {
    let finish = () => {};
    const response = new Promise<string>(resolve => { finish = () => resolve("# Scheduled summary\nVerified output."); });
    providerResponse.mockReturnValue(response);
    const scheduler = makeScheduler({ enabled: true, idleMinutes: 1 }, true);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    return { scheduler, finish };
  }

  it("ignores unknown options while honoring the configured idle threshold", async () => {
    const scheduler = makeScheduler({ enabled: true, idleMinutes: 2, ...JSON.parse('{"polluted":true}') });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.9);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
    expect(completed()).toEqual([{ aborted: false }]);
  });

  it("start is no-op when disabled", async () => {
    const scheduler = makeScheduler({ enabled: false, idleMinutes: 1 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.9);
    expect(completed()).toEqual([]);
    const enabled = makeScheduler({ enabled: true, idleMinutes: 1 });
    enabled.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
  });

  it("start is no-op when machine is not designated", async () => {
    db.setDreamMachineId("another-machine");
    const scheduler = makeScheduler({ enabled: true, idleMinutes: 1 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.9);
    db.setDreamMachineId("audit-machine");
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
  });

  it("start arms interval and triggers dream when designated and idle", async () => {
    const scheduler = makeScheduler({ enabled: true });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.9);
    expect(completed()).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
    expect(completed()).toEqual([{ aborted: false }]);
  });

  it("recordActivity aborts running engine", async () => {
    const { scheduler, finish } = await runningDream();
    expect(scheduler.isDreaming()).toBe(true);
    scheduler.recordActivity();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(completed()).toEqual([{ aborted: true }]);
    expect(scheduler.isDreaming()).toBe(false);
  });

  it("stop clears interval and aborts running engine", async () => {
    const { scheduler, finish } = await runningDream();
    scheduler.stop();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(completed()).toEqual([{ aborted: true }]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(completed()).toEqual([{ aborted: true }]);
  });

  it("derives and persists the hostname identity before checking designation", async () => {
    db.deleteMeta("machine_id");
    vi.stubEnv("HOSTNAME", "");
    vi.stubEnv("COMPUTERNAME", "");
    vi.spyOn(os, "hostname").mockReturnValue("audit-host");
    vi.setSystemTime(36);
    const scheduler = makeScheduler({ enabled: true, idleMinutes: 1 });
    scheduler.start();
    expect(db.getMeta("machine_id")).toBe("audit-host-10");
    db.setDreamMachineId("audit-host-10");
    vi.setSystemTime(new Date("2026-01-11T12:00:00.000Z"));
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMeta("machine_id")).toBe("audit-host-10");
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
  });

  it("isDreaming reflects an actual pending provider call and completion", async () => {
    const { scheduler, finish } = await runningDream();
    expect(scheduler.isDreaming()).toBe(true);
    expect(completed()).toEqual([]);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.isDreaming()).toBe(false);
    expect(completed()).toEqual([{ aborted: false }]);
    expect(db.getSummary("category", "decisions")?.content).toBe("# Scheduled summary\nVerified output.");
  });

  it("releases the lock after a native read failure and runs the next idle cycle", async () => {
    const scheduler = makeScheduler({ enabled: true, idleMinutes: 1 });
    scheduler.start();
    const Database = (await import("better-sqlite3")).default;
    vi.spyOn(Database.prototype, "prepare").mockImplementationOnce(() => { throw new Error("audit native read failed"); });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(scheduler.isDreaming()).toBe(false);
    expect(fs.existsSync(path.join(tmp, "dream.lock"))).toBe(false);
    expect(completed()).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
    expect(completed()).toEqual([{ aborted: false }]);
  });

  it("default scheduler remains disabled until explicitly enabled", async () => {
    const scheduler = makeScheduler();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.9);
    expect(completed()).toEqual([]);
    const enabled = makeScheduler({ enabled: true });
    enabled.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(db.getMemory("scheduled-0")?.confidence).toBe(0.86);
  });
});
