/**
 * Web Knowledge Base Integration Tests
 *
 * End-to-end tests that exercise the full pipeline:
 * ingest (directory source) → build index → search via staticSearch.
 * Uses fixture files from src/test/fixtures/web/.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { buildIndexSync, writeIndex } from "../lib/webIndex.js";
import {
  loadIndex,
  clearIndexCache,
  search,
  getDocument,
  listDocuments,
} from "../lib/staticSearch.js";
import { extractStructuredFrontmatter, computeTfIdf } from "../lib/structuredIngest.js";

// ─── Helpers ─────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(__dirname, "fixtures/web");
let tmpDir: string;
let outputDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-web-int-"));
  outputDir = path.join(tmpDir, "knowledge");
  fs.mkdirSync(outputDir, { recursive: true });
  clearIndexCache();
});

afterEach(async () => {
  clearIndexCache();
  vi.useRealTimers();
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

/** Copy fixture knowledge files to output dir and build + write index. */
async function setupPipeline(): Promise<string> {
  const srcDir = path.join(FIXTURES, "sample-knowledge");
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(outputDir, file));
  }
  const index = buildIndexSync(outputDir);
  const indexPath = path.join(outputDir, "gnosys-index.json");
  await writeIndex(index, indexPath);
  return indexPath;
}

// ─── Fixture loading ────────────────────────────────────────────────────

describe("Fixture validation", () => {
  it("sample-index.json is valid and loadable", () => {
    const idx = loadIndex(path.join(FIXTURES, "sample-index.json"));
    expect(idx.version).toBe(1);
    expect(idx.documents.length).toBeGreaterThan(0);
    expect(idx.documentCount).toBe(5);
    expect(idx.documents.map(doc => [doc.id, doc.title])).toEqual([
      ["web-001", "Building in Public: Why Transparency Wins"],
      ["web-002", "AI Readiness Assessment"],
      ["web-003", "Agentic Automation Services"],
      ["web-004", "Mavenn Platform"],
      ["web-005", "About Example Co"],
    ]);
  });

});

// ─── Directory ingest → index → search pipeline ────────────────────────

describe("Full pipeline: directory ingest → build index → search", () => {
  it("ingests markdown files and builds a searchable index", async () => {
    const indexPath = await setupPipeline();
    expect(fs.existsSync(indexPath)).toBe(true);

    const loaded = loadIndex(indexPath);
    expect(loaded.version).toBe(1);
    expect(loaded.documents.length).toBe(5);
    expect(Object.keys(loaded.invertedIndex).length).toBeGreaterThan(0);

    const results = search(loaded, "automation agents workflow");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.title).toContain("Agentic");
  });

  it("search respects category filter", async () => {
    const indexPath = await setupPipeline();
    const loaded = loadIndex(indexPath);

    const allResults = search(loaded, "knowledge team");
    const landscapeOnly = search(loaded, "knowledge team", { category: "landscape" });
    expect(allResults.map(r => r.document.id).sort()).toEqual(["web-003", "web-004", "web-005"]);
    expect(landscapeOnly.map(r => r.document.id)).toEqual(["web-005"]);
    for (const r of landscapeOnly) {
      expect(r.document.category).toBe("landscape");
    }
  });

  it("search respects tag filter", async () => {
    const indexPath = await setupPipeline();
    const loaded = loadIndex(indexPath);

    const tagResults = search(loaded, "company team mission", { tags: ["domain:company"] });
    expect(tagResults.map(r => r.document.id)).toEqual(["web-005"]);
    for (const r of tagResults) {
      expect(r.document.tags.some((t: string) => t === "domain:company")).toBe(true);
    }
  });

  it("getDocument retrieves specific document from built index", async () => {
    const indexPath = await setupPipeline();
    const loaded = loadIndex(indexPath);

    const fetched = getDocument(loaded, "web-005");
    expect(fetched).toMatchObject({ id: "web-005", title: "About Example Co", path: "web-about.md", category: "landscape" });
  });

  it("listDocuments filters by category on built index", async () => {
    const indexPath = await setupPipeline();
    const loaded = loadIndex(indexPath);

    const all = listDocuments(loaded);
    const concepts = listDocuments(loaded, { category: "concepts" });
    expect(all).toHaveLength(5);
    expect(concepts.map(doc => doc.id).sort()).toEqual(["web-001", "web-002"]);
    for (const doc of concepts) {
      expect(doc.category).toBe("concepts");
    }
  });
});

// ─── Structured ingest pipeline ─────────────────────────────────────────

describe("Structured ingest: HTML → frontmatter extraction", () => {
  it("extracts title and category from HTML content", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES, "sample-pages/about-page.html"),
      "utf-8"
    );
    const result = extractStructuredFrontmatter(html, "https://example.com/about", {
      "/about*": "company",
      "/blog/*": "blog",
    });
    expect(result.title).toContain("About");
    expect(result.category).toBe("company");
  });

  it("extracts category from URL patterns for blog posts", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES, "sample-pages/blog-post.html"),
      "utf-8"
    );
    const result = extractStructuredFrontmatter(
      html,
      "https://example.com/blog/building-in-public",
      { "/blog/*": "blog", "/services/*": "services" }
    );
    expect(result.category).toBe("blog");
  });

  it("falls back to general category for unmatched URLs", () => {
    const result = extractStructuredFrontmatter(
      "<html><body><h1>Random</h1></body></html>",
      "https://example.com/random/page",
      { "/blog/*": "blog" }
    );
    expect(result.category).toBe("general");
  });
});

// ─── TF-IDF across fixture corpus ───────────────────────────────────────

describe("TF-IDF on fixture knowledge files", () => {
  it("computes distinctive terms for each document", () => {
    const terms = computeTfIdf([
      { id: "a", content: "orange orange apple" },
      { id: "b", content: "pear pear apple" },
    ], 2);
    expect([...terms]).toEqual([
      ["a", [{ term: "orange", score: 1.0986 }, { term: "apple", score: 0.3466 }]],
      ["b", [{ term: "pear", score: 1.0986 }, { term: "apple", score: 0.3466 }]],
    ]);
  });

  it("automation doc gets automation-related terms", () => {
    const knowledgeDir = path.join(FIXTURES, "sample-knowledge");
    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".md"));
    const docs = files.map(f => ({
      id: f.replace(".md", ""),
      content: fs.readFileSync(path.join(knowledgeDir, f), "utf-8"),
    }));

    const tfidf = computeTfIdf(docs, 15);
    const automationTerms = tfidf.get("web-agentic-automation") || [];
    const allTerms = automationTerms.map(t => t.term).join(" ").toLowerCase();
    expect(
      allTerms.includes("automation") ||
      allTerms.includes("agentic") ||
      allTerms.includes("workflow")
    ).toBe(true);
  });
});

// ─── MDX handling ───────────────────────────────────────────────────────

// ─── Index determinism ──────────────────────────────────────────────────

describe("Index build determinism", () => {
  it("building index twice produces identical output", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
    const srcDir = path.join(FIXTURES, "sample-knowledge");
    for (const file of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, file), path.join(outputDir, file));
    }

    const index1 = buildIndexSync(outputDir);
    const index2 = buildIndexSync(outputDir);

    expect(index1).toEqual(index2);
    expect(index1.documentCount).toBe(5);
    expect(index1.generated).toBe("2026-03-22T12:00:00.000Z");
    expect(index1.documents.map(doc => doc.id)).toEqual(["web-005", "web-003", "web-002", "web-001", "web-004"]);
    expect(index1.invertedIndex.transparency).toEqual([{ docIndex: 3, score: 12.5423 }]);
  });
});

// ─── Bundle isolation ───────────────────────────────────────────────────

describe("Bundle isolation: gnosys/web has no native deps", () => {
  it("the published web entry searches without third-party runtime dependencies", () => {
    const loader = path.join(tmpDir, "builtins-only.mjs");
    fs.writeFileSync(loader, `import { isBuiltin } from "node:module";
export async function resolve(specifier, context, next) {
  if (!isBuiltin(specifier) && specifier !== "gnosys/web" && !specifier.startsWith("file:") && !specifier.startsWith(".")) {
    throw new Error("Third-party dependency: " + specifier);
  }
  return next(specifier, context);
}`);
    const child = spawnSync(process.execPath, ["--loader", loader, "--input-type=module", "-e", `
      import { loadIndex, search } from "gnosys/web";
      const index = loadIndex(${JSON.stringify(path.join(FIXTURES, "sample-index.json"))});
      process.stdout.write(JSON.stringify(search(index, "automation").map(result => result.document.id)));
    `], { cwd: path.resolve(__dirname, "../.."), encoding: "utf-8", timeout: 10000 });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual(["web-003", "web-002"]);
  });

});
