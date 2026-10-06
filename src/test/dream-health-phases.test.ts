import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine } from "../lib/dream.js";
import { generateDreamDashboardHtml, runDreamReportCommand } from "../lib/dreamReport.js";
import { appendDreamRun, type DreamRunRecord } from "../lib/dreamRunLog.js";
import { makeMemory } from "./_helpers.js";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../lib/llm.js", () => ({
  createProvider: () => ({ name: "ollama", model: "test", generate }),
}));

let home: string;
let db: GnosysDB;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "dream-health-phases-"));
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  db = new GnosysDB(home);
  generate.mockReset();
});
afterEach(() => {
  db.close();
  fs.rmSync(home, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function seed(count: number): void {
  for (let i = 0; i < count; i++) {
    db.insertMemory(makeMemory({
      id: `memory-${i.toString().padStart(2, "0")}`,
      category: "decisions",
      content: `Decision ${i}: use the shared database for all durable writes.`,
      created: "2026-10-01T00:00:00.000Z",
      modified: "2026-10-01T00:00:00.000Z",
      embedding: Buffer.from(new Float32Array([1, 0]).buffer),
    }));
  }
}

function engine(summaries = false): GnosysDreamEngine {
  return new GnosysDreamEngine(db, DEFAULT_CONFIG, {
    provider: "ollama", minMemories: 3, selfCritique: false,
    generateSummaries: summaries, discoverRelationships: !summaries,
  }, { stateDir: home });
}

describe("Dream phase health", () => {
  it("updates an existing summary after an edit with unchanged IDs, then skips the same content", async () => {
    seed(3);
    generate.mockResolvedValue("Original category summary.");
    expect((await engine(true).dream()).summariesGenerated).toBe(1);
    db.updateMemory("memory-00", {
      content: "Changed decision: use the replicated database for durable writes.",
      content_hash: "changed-content", modified: "2026-10-06T00:00:00.000Z",
    });
    generate.mockResolvedValue("Updated category summary.");
    db.setMeta("dream_consecutive_failures", "2");
    const updated = await engine(true).dream();
    expect(updated.summariesUpdated).toBe(1);
    expect(db.getDreamConsecutiveFailures()).toBe(0);
    expect(db.queryAuditLog({ operation: "dream_complete" }).map((entry) => JSON.parse(entry.details || "{}").summariesUpdated)).toContain(1);
    expect(db.getSummary("category", "decisions")?.content).toBe("Updated category summary.");
    const repeated = await engine(true).dream();
    expect(repeated.summariesUpdated).toBe(0);
    expect(repeated.totals?.llmCallsSkipped).toBe(1);
    expect(repeated.llmCalls?.[0]?.reason).toBe("already analyzed fingerprint");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it.each(["The JSON output was truncated [", ""])("reports invalid relationship output %j and retries it on the next run", async (response) => {
    seed(3);
    generate.mockResolvedValueOnce(response);
    const failed = await engine().dream();
    expect(failed.relationshipsDiscovered).toBe(0);
    expect(failed.errors).toEqual(["Relationship discovery: Relationship response did not contain a JSON array; it will be retried."]);
    generate.mockResolvedValueOnce(JSON.stringify([
      { source_id: "memory-00", target_id: "memory-01", rel_type: "references", label: "shared decision", confidence: 0.9 },
    ]));
    const retried = await engine().dream();
    expect(retried.relationshipsDiscovered).toBe(1);
    expect(db.getRelationshipsFrom("memory-00").map((row) => [row.target_id, row.rel_type])).toEqual([["memory-01", "references"]]);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("keeps successful relationship counts when a later batch fails", async () => {
    seed(8);
    generate.mockResolvedValueOnce(JSON.stringify([
      { source_id: "memory-00", target_id: "memory-01", rel_type: "references", label: "shared decision", confidence: 0.9 },
    ])).mockResolvedValueOnce("truncated response [");
    const report = await engine().dream();
    expect(report.relationshipsDiscovered).toBe(1);
    expect(report.phases?.find((phase) => phase.name === "relationships")?.memoryIdsTouched).toEqual(["memory-00", "memory-01"]);
    expect(report.errors).toEqual(["Relationship discovery: Relationship response did not contain a JSON array; it will be retried."]);
  });

  it("includes a newly created memory beyond the original first 50 in bounded relationship discovery", async () => {
    seed(60);
    db.updateMemory("memory-59", { created: "2026-10-06T01:00:00.000Z" });
    generate.mockImplementation(async (prompt: string) => {
      const sourceText = prompt.split("Full memory index:")[0];
      if (!sourceText.includes('[memory-59] "')) return "[]";
      return JSON.stringify([
        { source_id: "memory-59", target_id: "memory-00", rel_type: "extends", label: "new decision", confidence: 0.8 },
        { source_id: "memory-59", target_id: "missing-id", rel_type: "extends", label: "invalid", confidence: 0.8 },
      ]);
    });
    const report = await engine().dream();
    expect(report.relationshipsDiscovered).toBe(1);
    expect(db.getRelationshipsFrom("memory-59").map((row) => row.target_id)).toEqual(["memory-00"]);
    expect(generate).toHaveBeenCalledTimes(6);
  });

  it("does not repeat summary or relationship calls when decay changes only confidence and modified", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"));
    seed(25);
    for (let i = 0; i < 25; i++) {
      db.updateMemory(`memory-${i.toString().padStart(2, "0")}`, {
        last_reinforced: "2026-10-06T12:00:00.000Z",
        modified: `2026-10-${(i % 5 + 1).toString().padStart(2, "0")}T00:00:00.000Z`,
      });
    }
    generate.mockImplementation(async (prompt: string) => prompt.includes("Category summary:") ? "Stable sampled summary." : "[]");
    const run = () => new GnosysDreamEngine(db, DEFAULT_CONFIG, {
      provider: "ollama", minMemories: 3, selfCritique: false,
    }, { stateDir: home }).dream();
    const first = await run();
    expect(first.decayUpdated).toBe(0);
    expect(first.summariesGenerated).toBe(1);
    expect(generate).toHaveBeenCalledTimes(6);
    vi.setSystemTime(new Date("2026-11-06T12:00:00.000Z"));
    generate.mockClear();
    const second = await run();
    expect(second.decayUpdated).toBe(25);
    expect(second.summariesUpdated).toBe(0);
    expect(second.totals?.llmCallsMade).toBe(0);
    expect(db.getSummary("category", "decisions")?.content).toBe("Stable sampled summary.");
    expect(db.getMemory("memory-00")?.confidence).toBe(0.77);
    expect(generate).toHaveBeenCalledTimes(0);
  });

  it("progresses through 65 source memories across bounded runs, then makes no more calls", async () => {
    seed(65);
    generate.mockResolvedValue("[]");
    const first = await engine().dream();
    const second = await engine().dream();
    const third = await engine().dream();
    const sourceIds = [first, second, third].flatMap((report) =>
      (report.llmCalls ?? []).filter((call) => call.status === "made").flatMap((call) => call.memoryIds)
    );
    expect([first.totals?.llmCallsMade, second.totals?.llmCallsMade, third.totals?.llmCallsMade]).toEqual([6, 6, 1]);
    expect(sourceIds).toEqual(Array.from({ length: 65 }, (_, i) => `memory-${i.toString().padStart(2, "0")}`));
    const promptSourceIds = generate.mock.calls.flatMap(([prompt]) => {
      const sourceText = String(prompt).split("Source memories:\n")[1].split("Full memory index:")[0];
      return [...sourceText.matchAll(/^\[(memory-\d+)\] "/gm)].map((match) => match[1]);
    });
    expect(promptSourceIds).toEqual(Array.from({ length: 65 }, (_, i) => `memory-${i.toString().padStart(2, "0")}`));
    generate.mockClear();
    expect((await engine().dream()).totals?.llmCallsMade).toBe(0);
    expect(generate).toHaveBeenCalledTimes(0);
  });

  it("invalidates a source batch when a candidate target changes", async () => {
    seed(8);
    generate.mockResolvedValue("[]");
    await engine().dream();
    generate.mockClear();
    db.updateMemory("memory-07", { content_hash: "target-change", content: "Changed target relationship context." });
    await engine().dream();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

function record(id: string, startedAt: string): DreamRunRecord {
  return {
    id, startedAt, finishedAt: startedAt, durationMs: 0, trigger: "manual", status: "completed",
    machine: { hostname: "test" }, provider: "ollama", gates: [], llmCalls: [],
    phases: [{ name: "critique", status: "ran", durationMs: 0, memoryIdsTouched: [], llmCallsMade: 0, llmCallsSkipped: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedCostUsd: 0 }],
    totals: { llmCallsMade: 0, llmCallsSkipped: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedCostUsd: 0 },
    effectiveness: { usefulOutputScore: 0, costPerUsefulOutput: null, decaysApplied: 0, summariesGenerated: 0, summariesUpdated: 0, reviewSuggestions: 0, relationshipsDiscovered: 0 },
    errors: [],
  };
}

describe("Dream report review suggestions", () => {
  it("renders the latest critique snapshot, capped at 20 with escaped actionable details", async () => {
    const latest = record("latest", "2026-10-06T01:00:00Z");
    latest.reviewSuggestions = Array.from({ length: 25 }, (_, i) => ({
      memoryId: `review-${i}`, title: `<script>${i}</script>`, reason: `Reason ${i}`,
      currentConfidence: i / 100, suggestedAction: "review",
    }));
    const skipped = { ...record("skipped", "2026-10-06T02:00:00Z"), phases: [], reviewSuggestions: [] };
    appendDreamRun(latest);
    appendDreamRun(skipped);
    const output = path.join(home, "report.html");
    await runDreamReportCommand({ output });
    const html = fs.readFileSync(output, "utf8");
    expect(html).toContain("Showing 20 of 25 suggestions");
    expect(html).toContain("&lt;script&gt;0&lt;/script&gt;");
    expect(html).toContain("Reason 19");
    expect(html).not.toContain("Reason 20");
    expect(html).toContain("gnosys read &lt;memory-id&gt;");
    const empty = { ...record("empty", "2026-10-07T01:00:00Z"), reviewSuggestions: [] };
    expect(generateDreamDashboardHtml([latest, empty])).toContain("No review suggestions in the latest snapshot.");
  });
});
