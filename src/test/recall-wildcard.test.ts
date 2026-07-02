/**
 * Regression tests for the v5.13.1 wildcard-recall fix.
 *
 * The gnosys://recall MCP resource — automatic memory injection — calls
 * recall("*"). "*" was never a valid FTS5 match-all (it's a syntax
 * error), so the resource returned "<gnosys: no-strong-recall-needed>"
 * on every read since it shipped in v4.0.0. Wildcard (or term-less)
 * queries now serve top active memories by reinforcement, confidence,
 * and recency.
 *
 * Also covers the v5.13.1 dreamworthiness count-delta signal
 * (countDreamworthyChanges), which lets machines with stale/polluted
 * dream-state files self-heal without manual file deletion.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { recall, formatRecall } from "../lib/recall.js";
import { countDreamworthyChanges } from "../lib/dreamRunLog.js";
import type { DbMemory } from "../lib/db.js";
import { GnosysSearch } from "../lib/search.js";
import { GnosysResolver } from "../lib/resolver.js";
import { createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

describe("wildcard recall (gnosys://recall resource path)", () => {
  let env: TestEnv;
  let search: GnosysSearch;
  let resolver: GnosysResolver;

  beforeAll(async () => {
    env = await createTestEnv("recall-wild");
    // Distinct reinforcement/recency so ordering is observable.
    env.db.insertMemory(
      makeMemory({ id: "wild-top", title: "Most Reinforced", reinforcement_count: 9, confidence: 0.9, modified: "2026-06-01" })
    );
    env.db.insertMemory(
      makeMemory({ id: "wild-mid", title: "Mid Memory", reinforcement_count: 3, confidence: 0.9, modified: "2026-06-15" })
    );
    env.db.insertMemory(
      makeMemory({ id: "wild-low", title: "Low Memory", reinforcement_count: 0, confidence: 0.8, modified: "2026-06-30" })
    );
    env.db.insertMemory(
      makeMemory({ id: "wild-archived", title: "Archived Memory", tier: "archive", status: "archived", reinforcement_count: 50 })
    );
    env.db.insertMemory(
      makeMemory({ id: "wild-superseded", title: "Superseded Memory", status: "superseded", reinforcement_count: 50 })
    );
    search = new GnosysSearch(env.tmpDir);
    resolver = new GnosysResolver();
  });

  afterAll(async () => {
    search.close();
    await cleanupTestEnv(env);
  });

  function doRecall(query: string) {
    return recall(query, {
      search,
      resolver,
      storePath: env.tmpDir,
      gnosysDb: env.db,
    });
  }

  it('recall("*") returns top active memories instead of nothing (the v4.0.0 bug)', async () => {
    const result = await doRecall("*");
    expect(result.memories.length).toBe(3);
    expect(result.memories.map((m) => m.id)).toEqual(["wild-top", "wild-mid", "wild-low"]);
  });

  it("wildcard ordering prefers reinforcement, then confidence, then recency", async () => {
    const result = await doRecall("*");
    expect(result.memories[0].id).toBe("wild-top");
    expect(result.memories[0].relevanceScore).toBeGreaterThan(result.memories[2].relevanceScore);
  });

  it("archived and superseded memories are excluded from wildcard recall", async () => {
    const result = await doRecall("*");
    const ids = result.memories.map((m) => m.id);
    expect(ids).not.toContain("wild-archived");
    expect(ids).not.toContain("wild-superseded");
  });

  it("formatRecall emits a real <gnosys-recall> block, not the no-op string", async () => {
    const result = await doRecall("*");
    const text = formatRecall(result);
    expect(text).toContain("<gnosys-recall>");
    expect(text).not.toContain("no-strong-recall-needed");
    expect(text).toContain("[[wild-top]]");
  });

  it("pure-punctuation queries behave like wildcard", async () => {
    const result = await doRecall("--- !!!");
    expect(result.memories.length).toBe(3);
  });

  it("respects the limit option", async () => {
    const result = await recall("*", {
      limit: 2,
      search,
      resolver,
      storePath: env.tmpDir,
      gnosysDb: env.db,
    });
    expect(result.memories.length).toBe(2);
  });

  it("non-aggressive mode keeps wildcard results (scores floored above minRelevance)", async () => {
    const result = await recall("*", {
      search,
      resolver,
      storePath: env.tmpDir,
      gnosysDb: env.db,
      recallConfig: { aggressive: false, maxMemories: 8, minRelevance: 0.4 },
    });
    expect(result.memories.length).toBe(3);
  });

  it("real keyword recall is unchanged (regression guard)", async () => {
    const result = await doRecall("Mid Memory");
    expect(result.memories.map((m) => m.id)).toContain("wild-mid");
  });
});

describe("countDreamworthyChanges (v5.13.1 self-healing gate)", () => {
  function mems(n: number, modified = "2026-01-01"): DbMemory[] {
    return Array.from({ length: n }, (_, i) => makeMemory({ id: `g-${i}`, modified }));
  }

  it("polluted state (count 5 vs 1200 memories, today's watermark) is dreamworthy via count delta", () => {
    const changed = countDreamworthyChanges(mems(1200), {
      analyzedFingerprints: {},
      lastMemoryCount: 5,
      lastMemoryMaxModified: new Date().toISOString(),
    });
    expect(changed).toBe(1195);
  });

  it("date watermark still wins when it reports more change", () => {
    const changed = countDreamworthyChanges(mems(10, "2026-06-30"), {
      analyzedFingerprints: {},
      lastMemoryCount: 10,
      lastMemoryMaxModified: "2026-01-01",
    });
    expect(changed).toBe(10);
  });

  it("no stored count means no delta signal (fresh state relies on the date path)", () => {
    const changed = countDreamworthyChanges(mems(50), {
      analyzedFingerprints: {},
    });
    expect(changed).toBe(50); // no watermark → everything counts as changed
  });

  it("accurate state with no changes is not dreamworthy", () => {
    const changed = countDreamworthyChanges(mems(100, "2026-01-01"), {
      analyzedFingerprints: {},
      lastMemoryCount: 100,
      lastMemoryMaxModified: "2026-06-01",
    });
    expect(changed).toBe(0);
  });

  it("bulk deletion also counts as change", () => {
    const changed = countDreamworthyChanges(mems(40, "2026-01-01"), {
      analyzedFingerprints: {},
      lastMemoryCount: 100,
      lastMemoryMaxModified: "2026-06-01",
    });
    expect(changed).toBe(60);
  });
});
