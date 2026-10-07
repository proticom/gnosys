// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: Rounded index scores are literal public-output expectations.
/**
 * Tests for webIndex.ts — Build-time search index generator.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { buildIndex, buildIndexSync, writeIndex } from "../lib/webIndex.js";
import type { GnosysWebIndex } from "../lib/staticSearch.js";

// ─── Helpers ─────────────────────────────────────────────────────────────

let tmpDir: string;

function makeMd(
  filename: string,
  frontmatter: Record<string, unknown>,
  content: string,
  subdir?: string
): void {
  const dir = subdir ? path.join(tmpDir, subdir) : tmpDir;
  fs.mkdirSync(dir, { recursive: true });

  const fmLines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      fmLines.push(`${key}:`);
      for (const v of value) fmLines.push(`  - ${v}`);
    } else if (typeof value === "object" && value !== null) {
      fmLines.push(`${key}:`);
      for (const [k, vals] of Object.entries(value as Record<string, string[]>)) {
        fmLines.push(`  ${k}:`);
        if (Array.isArray(vals)) {
          for (const v of vals) fmLines.push(`    - ${v}`);
        }
      }
    } else {
      fmLines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  fmLines.push("---");
  fmLines.push("");
  fmLines.push(content);

  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n"), "utf-8");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-webindex-"));
});

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe("buildIndex", () => {
  it("returns empty index for empty directory", () => {
    const index = buildIndexSync(tmpDir);
    expect(index.version).toBe(1);
    expect(index.documentCount).toBe(0);
    expect(index.documents).toEqual([]);
    expect(index.invertedIndex).toEqual({});
  });

  it("indexes a single markdown file", () => {
    makeMd("test.md", {
      id: "test-001",
      title: "Test Document",
      category: "decisions",
      tags: ["testing", "vitest"],
      relevance: "testing vitest unit",
      status: "active",
      created: "2026-03-01",
    }, "This is test content about unit testing.");

    const index = buildIndexSync(tmpDir);
    expect(index.documentCount).toBe(1);
    expect(index.documents[0].id).toBe("test-001");
    expect(index.documents[0].title).toBe("Test Document");
    expect(index.documents[0].category).toBe("decisions");
    expect(index.documents[0].tags).toEqual(["testing", "vitest"]);
    expect(index.documents[0].contentLength).toBeGreaterThan(0);
    expect(index.documents[0].created).toBe("2026-03-01");
    expect(index.documents[0].status).toBe("active");
  });

  it("indexes multiple files across subdirectories", () => {
    makeMd("doc1.md", { id: "d1", title: "Doc One", category: "blog", tags: ["a"], relevance: "alpha", status: "active" }, "Alpha content.");
    makeMd("doc2.md", { id: "d2", title: "Doc Two", category: "services", tags: ["b"], relevance: "beta", status: "active" }, "Beta content.", "services");

    const index = buildIndexSync(tmpDir);
    expect(index.documentCount).toBe(2);
    expect(index.documents.map((d) => d.id).sort()).toEqual(["d1", "d2"]);
  });

  it("weights relevance keywords higher than content", () => {
    makeMd("doc.md", {
      id: "d1",
      title: "Generic",
      category: "general",
      tags: [],
      relevance: "postgresql database",
      status: "active",
    }, "This document discusses various random topics and nothing about databases.");

    const index = buildIndexSync(tmpDir);
    const postgresqlEntries = index.invertedIndex["postgresql"];
    const randomEntries = index.invertedIndex["random"];

    expect(postgresqlEntries).toEqual([{ docIndex: 0, score: 2.0794 }]);
    expect(randomEntries).toEqual([{ docIndex: 0, score: 0.6931 }]);
  });

  it("respects stop-word filtering", () => {
    makeMd("doc.md", {
      id: "d1",
      title: "The Test",
      category: "general",
      tags: [],
      relevance: "important keyword",
      status: "active",
    }, "The quick brown fox.");

    const index = buildIndexSync(tmpDir, { stopWords: true });
    expect(index.invertedIndex["the"]).toBeUndefined();
    expect(index.invertedIndex["quick"]).toEqual([{ docIndex: 0, score: 0.6931 }]);
  });

  it("disables stop-word filtering when option is false", () => {
    makeMd("doc.md", {
      id: "d1",
      title: "The Test",
      category: "general",
      tags: [],
      relevance: "",
      status: "active",
    }, "The fox and the hound.");

    const index = buildIndexSync(tmpDir, { stopWords: false });
    expect(index.invertedIndex["the"]).toEqual([{ docIndex: 0, score: 2.7726 }]);
  });

  it("skips archived documents by default", () => {
    makeMd("active.md", { id: "a1", title: "Active", category: "general", tags: [], relevance: "", status: "active" }, "Active doc.");
    makeMd("archived.md", { id: "a2", title: "Archived", category: "general", tags: [], relevance: "", status: "archived" }, "Archived doc.");

    const index = buildIndexSync(tmpDir);
    expect(index.documentCount).toBe(1);
    expect(index.documents[0].id).toBe("a1");
  });

  it("includes archived documents when includeArchived is true", () => {
    makeMd("active.md", { id: "a1", title: "Active", category: "general", tags: [], relevance: "", status: "active" }, "Active doc.");
    makeMd("archived.md", { id: "a2", title: "Archived", category: "general", tags: [], relevance: "", status: "archived" }, "Archived doc.");

    const index = buildIndexSync(tmpDir, { includeArchived: true });
    expect(index.documentCount).toBe(2);
    expect(index.documents.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "a1", status: "active" },
      { id: "a2", status: "archived" },
    ]);
  });

  it("computes correct content hashes", () => {
    makeMd("doc.md", { id: "d1", title: "Doc", category: "general", tags: [], relevance: "", status: "active" }, "Some content.");

    const index = buildIndexSync(tmpDir);
    expect(index.documents[0].contentHash).toBe("3dc0dc503444016e6cd0e0668c82d7d46092775b49d4200bc576eccd2c0df1de");
  });

  it("handles files with no frontmatter id (uses filename)", () => {
    // Write a file with frontmatter but no id field
    fs.writeFileSync(
      path.join(tmpDir, "my-file.md"),
      "---\ntitle: 'No ID'\ncategory: general\nstatus: active\n---\nContent here.",
      "utf-8"
    );

    const index = buildIndexSync(tmpDir);
    expect(index.documentCount).toBe(1);
    expect(index.documents[0].id).toBe("my-file");
  });

  it("handles files with malformed frontmatter gracefully", () => {
    // Valid file
    makeMd("good.md", { id: "g1", title: "Good", category: "general", tags: [], relevance: "", status: "active" }, "Good content.");

    // Malformed file (bad YAML)
    fs.writeFileSync(
      path.join(tmpDir, "bad.md"),
      "---\ntitle: [invalid yaml\n---\nContent.",
      "utf-8"
    );

    const index = buildIndexSync(tmpDir);
    // Should include the good file and skip the bad one
    expect(index.documentCount).toBe(1);
    expect(index.documents[0].id).toBe("g1");
  });

  it("produces deterministic output for same input", () => {
    makeMd("a.md", { id: "a", title: "Alpha", category: "general", tags: ["x"], relevance: "alpha", status: "active" }, "First document about alpha.");
    makeMd("b.md", { id: "b", title: "Beta", category: "general", tags: ["y"], relevance: "beta", status: "active" }, "Second document about beta.");

    const index1 = buildIndexSync(tmpDir);
    const index2 = buildIndexSync(tmpDir);

    // Remove generated timestamps for comparison
    const normalize = (idx: GnosysWebIndex) => ({ ...idx, generated: "" });
    expect(normalize(index1)).toEqual(normalize(index2));
    expect(index1.documents.map((doc) => doc.id)).toEqual(["a", "b"]);
    expect(index1.invertedIndex).toEqual({
      alpha: [{ docIndex: 0, score: 6.5917 }],
      beta: [{ docIndex: 1, score: 6.5917 }],
      document: [{ docIndex: 0, score: 0.6931 }, { docIndex: 1, score: 0.6931 }],
      first: [{ docIndex: 0, score: 1.0986 }],
      second: [{ docIndex: 1, score: 1.0986 }],
    });
    expect(Object.keys(index1.invertedIndex)).toEqual(["alpha", "beta", "document", "first", "second"]);
  });

  it("version field is set to 1", () => {
    const index = buildIndexSync(tmpDir);
    expect(index.version).toBe(1);
  });

  it("generated timestamp is valid ISO string", () => {
    const index = buildIndexSync(tmpDir);
    expect(() => new Date(index.generated)).not.toThrow();
    expect(new Date(index.generated).toISOString()).toBe(index.generated);
  });

  it("handles nested tag objects", () => {
    makeMd("doc.md", {
      id: "d1",
      title: "Tagged Doc",
      category: "general",
      tags: { domain: ["backend", "api"], type: ["decision"] },
      relevance: "",
      status: "active",
    }, "Content.");

    const index = buildIndexSync(tmpDir);
    expect(index.documents[0].tags).toEqual(["backend", "api", "decision"]);
  });
});

describe("buildIndex (async)", () => {
  it("returns same result as sync version", async () => {
    makeMd("doc.md", { id: "d1", title: "Async Test", category: "general", tags: [], relevance: "async", status: "active" }, "Testing async.");

    const syncResult = buildIndexSync(tmpDir);
    const asyncResult = await buildIndex(tmpDir);

    const normalize = (idx: GnosysWebIndex) => ({ ...idx, generated: "" });
    expect(normalize(asyncResult)).toEqual(normalize(syncResult));
    expect(asyncResult.documents.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: "d1", title: "Async Test" },
    ]);
    expect(asyncResult.invertedIndex.async).toEqual([{ docIndex: 0, score: 4.1589 }]);
  });
});

describe("writeIndex", () => {
  it("creates a valid JSON file", async () => {
    makeMd("doc.md", { id: "d1", title: "Write Test", category: "general", tags: [], relevance: "", status: "active" }, "Content.");

    const index = buildIndexSync(tmpDir);
    const outputPath = path.join(tmpDir, "output", "gnosys-index.json");

    await writeIndex(index, outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    expect(parsed.version).toBe(1);
    expect(parsed.documentCount).toBe(1);
    expect(parsed.documents).toEqual([expect.objectContaining({ id: "d1", title: "Write Test", contentLength: 8 })]);
    expect(parsed.invertedIndex.content).toEqual([{ docIndex: 0, score: 0.6931 }]);
  });

  it("overwrites existing index file", async () => {
    const outputPath = path.join(tmpDir, "gnosys-index.json");
    fs.writeFileSync(outputPath, '{"old": true}', "utf-8");

    makeMd("doc.md", { id: "d1", title: "Overwrite", category: "general", tags: [], relevance: "", status: "active" }, "Content.");
    const index = buildIndexSync(tmpDir);

    await writeIndex(index, outputPath);

    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    expect(parsed.version).toBe(1);
    expect((parsed as Record<string, unknown>).old).toBeUndefined();
    expect(parsed.documents).toEqual([expect.objectContaining({ id: "d1", title: "Overwrite" })]);
    expect(parsed.invertedIndex.content).toEqual([{ docIndex: 0, score: 0.6931 }]);
  });
});
