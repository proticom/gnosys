import { describe, it, expect } from "vitest";
import { groupByPeriod, computeStats } from "../lib/timeline.js";
import type { Memory, MemoryFrontmatter } from "../lib/store.js";

function makeMem(overrides: Partial<MemoryFrontmatter> = {}): Memory {
  const frontmatter: MemoryFrontmatter = {
    id: "test-001",
    title: "Test",
    category: "decisions",
    tags: { domain: ["testing"] },
    relevance: "test",
    author: "human",
    authority: "declared",
    confidence: 0.8,
    created: "2026-02-15",
    modified: "2026-02-15",
    status: "active",
    supersedes: null,
    ...overrides,
  };
  return {
    frontmatter,
    content: "# Test",
    filePath: `/tmp/${frontmatter.id}.md`,
    relativePath: `${frontmatter.category}/${frontmatter.id}.md`,
  };
}

const memories: Memory[] = [
  makeMem({ id: "d1", title: "Jan Decision", category: "decisions", created: "2026-01-10", modified: "2026-01-15", confidence: 0.9, author: "human" }),
  makeMem({ id: "d2", title: "Jan Concept", category: "concepts", created: "2026-01-20", modified: "2026-02-01", confidence: 0.7, author: "ai" }),
  makeMem({ id: "d3", title: "Feb Decision", category: "decisions", created: "2026-02-05", modified: "2026-02-05", confidence: 0.85, author: "human+ai" }),
  makeMem({ id: "d4", title: "Feb Arch", category: "architecture", created: "2026-02-15", modified: "2026-03-01", confidence: 0.6, author: "ai", status: "superseded" }),
  makeMem({ id: "d5", title: "Mar Decision", category: "decisions", created: "2026-03-01", modified: "2026-03-06", confidence: 0.95, author: "human", authority: "observed" }),
];

describe("groupByPeriod", () => {
  it("groups by month", () => {
    const result = groupByPeriod(memories, "month");
    expect(result).toHaveLength(3); // Jan, Feb, Mar

    const jan = result.find((e) => e.period === "2026-01");
    expect(jan?.created).toBe(2);

    const feb = result.find((e) => e.period === "2026-02");
    expect(feb?.created).toBe(2);

    const mar = result.find((e) => e.period === "2026-03");
    expect(mar?.created).toBe(1);
  });

  it("groups by year", () => {
    const result = groupByPeriod(memories, "year");
    expect(result).toHaveLength(1);
    expect(result[0].period).toBe("2026");
    expect(result[0].created).toBe(5);
  });

  it("groups by day", () => {
    const result = groupByPeriod(memories, "day");
    expect(result.map(({ period, created, modified }) => ({ period, created, modified }))).toEqual([
      { period: "2026-01-10", created: 1, modified: 0 },
      { period: "2026-01-15", created: 0, modified: 1 },
      { period: "2026-01-20", created: 1, modified: 0 },
      { period: "2026-02-01", created: 0, modified: 1 },
      { period: "2026-02-05", created: 1, modified: 0 },
      { period: "2026-02-15", created: 1, modified: 0 },
      { period: "2026-03-01", created: 1, modified: 1 },
      { period: "2026-03-06", created: 0, modified: 1 },
    ]);
  });

  it("groups by week", () => {
    const result = groupByPeriod(memories, "week");
    expect(result.map(({ period, created, modified }) => ({ period, created, modified }))).toEqual([
      { period: "2026-W02", created: 1, modified: 0 },
      { period: "2026-W03", created: 0, modified: 1 },
      { period: "2026-W04", created: 1, modified: 0 },
      { period: "2026-W05", created: 0, modified: 1 },
      { period: "2026-W06", created: 1, modified: 0 },
      { period: "2026-W07", created: 1, modified: 0 },
      { period: "2026-W09", created: 1, modified: 1 },
      { period: "2026-W10", created: 0, modified: 1 },
    ]);
  });

  it("returns entries sorted chronologically", () => {
    const result = groupByPeriod(memories, "month");
    expect(result.map((entry) => entry.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("tracks modified separately from created", () => {
    const result = groupByPeriod(memories, "month");
    // d2 created Jan, modified Feb → Feb should have modified count
    const feb = result.find((e) => e.period === "2026-02");
    expect(feb).toMatchObject({ period: "2026-02", created: 2, modified: 1 });
  });

  it("includes titles for created memories", () => {
    const result = groupByPeriod(memories, "month");
    const jan = result.find((e) => e.period === "2026-01");
    expect(jan?.titles).toContain("Jan Decision");
    expect(jan?.titles).toContain("Jan Concept");
  });

  it("handles empty array", () => {
    const result = groupByPeriod([], "month");
    expect(result).toHaveLength(0);
  });
});

describe("computeStats", () => {
  it("computes total count", () => {
    const stats = computeStats(memories);
    expect(stats.totalCount).toBe(5);
  });

  it("counts by category", () => {
    const stats = computeStats(memories);
    expect(stats.byCategory.decisions).toBe(3);
    expect(stats.byCategory.concepts).toBe(1);
    expect(stats.byCategory.architecture).toBe(1);
  });

  it("counts by status", () => {
    const stats = computeStats(memories);
    expect(stats.byStatus.active).toBe(4);
    expect(stats.byStatus.superseded).toBe(1);
  });

  it("counts by author", () => {
    const stats = computeStats(memories);
    expect(stats.byAuthor.human).toBe(2);
    expect(stats.byAuthor.ai).toBe(2);
    expect(stats.byAuthor["human+ai"]).toBe(1);
  });

  it("computes average confidence", () => {
    const stats = computeStats(memories);
    // (0.9 + 0.7 + 0.85 + 0.6 + 0.95) / 5 = 0.8
    expect(stats.averageConfidence).toBe(0.8);
  });

  it("finds oldest and newest dates", () => {
    const stats = computeStats(memories);
    expect(stats.oldestCreated).toBe("2026-01-10");
    expect(stats.newestCreated).toBe("2026-03-01");
    expect(stats.lastModified).toBe("2026-03-06");
  });

  it("handles empty array", () => {
    const stats = computeStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.averageConfidence).toBe(0);
    expect(stats.oldestCreated).toBeNull();
  });
});
