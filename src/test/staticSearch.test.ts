/**
 * Tests for staticSearch.ts — Zero-dependency runtime search module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import {
  loadIndex,
  clearIndexCache,
  search,
  getDocument,
  listDocuments,
} from "../lib/staticSearch.js";
import type { GnosysWebIndex, DocumentManifest } from "../lib/staticSearch.js";

// ─── Helpers ─────────────────────────────────────────────────────────────

let tmpDir: string;

function makeIndex(overrides: Partial<GnosysWebIndex> = {}): GnosysWebIndex {
  return {
    version: 1,
    generated: new Date().toISOString(),
    documentCount: 0,
    documents: [],
    invertedIndex: {},
    ...overrides,
  };
}

function makeDoc(overrides: Partial<DocumentManifest> = {}): DocumentManifest {
  return {
    id: "doc-001",
    path: "general/doc.md",
    title: "Test Document",
    category: "general",
    tags: ["test"],
    relevance: "test document general",
    contentHash: "abc123",
    contentLength: 100,
    created: "2026-03-01",
    status: "active",
    ...overrides,
  };
}

function makeSampleIndex(): GnosysWebIndex {
  const docs: DocumentManifest[] = [
    makeDoc({
      id: "blog-001",
      path: "blog/ai-chatbot.md",
      title: "Building AI Chatbots",
      category: "blog",
      tags: ["ai", "chatbot"],
      relevance: "artificial intelligence chatbot conversational agent",
    }),
    makeDoc({
      id: "svc-001",
      path: "services/automation.md",
      title: "Agentic Automation",
      category: "services",
      tags: ["automation", "ai"],
      relevance: "automation agentic workflow process",
    }),
    makeDoc({
      id: "prod-001",
      path: "products/mavenn.md",
      title: "Mavenn Platform",
      category: "products",
      tags: ["product", "saas"],
      relevance: "mavenn platform saas product",
    }),
    makeDoc({
      id: "faq-001",
      path: "company/faqs.md",
      title: "Frequently Asked Questions",
      category: "company",
      tags: ["faq", "support"],
      relevance: "faq questions answers support help",
      created: new Date().toISOString(), // recent
    }),
    makeDoc({
      id: "arch-001",
      path: "blog/archived-post.md",
      title: "Old Post",
      category: "blog",
      tags: ["blog"],
      relevance: "old archived legacy",
      status: "archived",
    }),
  ];

  // Build a simple inverted index
  const invertedIndex: Record<string, Array<{ docIndex: number; score: number }>> = {};

  function addToken(token: string, docIndex: number, score: number) {
    if (!invertedIndex[token]) invertedIndex[token] = [];
    invertedIndex[token].push({ docIndex, score });
  }

  // blog-001 (index 0)
  addToken("artificial", 0, 2.1);
  addToken("intelligence", 0, 2.1);
  addToken("chatbot", 0, 3.5);
  addToken("conversational", 0, 2.1);
  addToken("agent", 0, 2.1);
  addToken("building", 0, 1.5);

  // svc-001 (index 1)
  addToken("automation", 1, 3.5);
  addToken("agentic", 1, 2.1);
  addToken("workflow", 1, 2.1);
  addToken("process", 1, 2.1);

  // prod-001 (index 2)
  addToken("mavenn", 2, 3.5);
  addToken("platform", 2, 3.5);
  addToken("saas", 2, 3.5);
  addToken("product", 2, 3.5);

  // faq-001 (index 3)
  addToken("faq", 3, 3.5);
  addToken("questions", 3, 3.5);
  addToken("answers", 3, 2.1);
  addToken("support", 3, 3.5);
  addToken("help", 3, 2.1);

  // arch-001 (index 4)
  addToken("old", 4, 2.1);
  addToken("archived", 4, 2.1);
  addToken("legacy", 4, 2.1);

  return makeIndex({
    documentCount: docs.length,
    documents: docs,
    invertedIndex,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-static-search-"));
  clearIndexCache();
});

afterEach(async () => {
  vi.useRealTimers();
  clearIndexCache();
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

// ─── loadIndex ───────────────────────────────────────────────────────────

describe("loadIndex", () => {
  it("loads from a file path", () => {
    const index = makeSampleIndex();
    const filePath = path.join(tmpDir, "gnosys-index.json");
    fs.writeFileSync(filePath, JSON.stringify(index), "utf-8");

    const loaded = loadIndex(filePath);
    expect(loaded.version).toBe(1);
    expect(loaded.documentCount).toBe(5);
    expect(search(loaded, "chatbot").map(({ document }) => document.id)).toEqual(["blog-001"]);
  });

  it("loads from a JSON string", () => {
    const index = makeSampleIndex();
    const loaded = loadIndex(JSON.stringify(index));
    expect(loaded.version).toBe(1);
    expect(loaded.documentCount).toBe(5);
    expect(search(loaded, "chatbot").map(({ document }) => document.id)).toEqual(["blog-001"]);
  });

  it("caches repeated calls with same source", () => {
    const filePath = path.join(tmpDir, "gnosys-index.json");
    fs.writeFileSync(filePath, JSON.stringify(makeSampleIndex()));
    expect(getDocument(loadIndex(filePath), "blog-001")?.title).toBe("Building AI Chatbots");
    const updated = makeSampleIndex();
    updated.documents[0].title = "Updated chatbot guide";
    fs.writeFileSync(filePath, JSON.stringify(updated));
    expect(getDocument(loadIndex(filePath), "blog-001")?.title).toBe("Building AI Chatbots");
    clearIndexCache();
    expect(getDocument(loadIndex(filePath), "blog-001")?.title).toBe("Updated chatbot guide");
  });

  it("throws on invalid JSON", () => {
    expect(() => loadIndex("{not valid json")).toThrow("Invalid JSON");
  });

  it("throws on missing version field", () => {
    expect(() => loadIndex(JSON.stringify({ documents: [] }))).toThrow("missing or invalid version");
  });

  it("throws on unsupported version", () => {
    const index = makeIndex({ version: 99 });
    expect(() => loadIndex(JSON.stringify(index))).toThrow("version 99 is not supported");
  });

  it("throws on missing file", () => {
    expect(() => loadIndex("/nonexistent/path/index.json")).toThrow("not found");
  });
});

// ─── search ──────────────────────────────────────────────────────────────

describe("search", () => {
  let index: GnosysWebIndex;

  beforeEach(() => {
    index = makeSampleIndex();
  });

  it("returns empty array for no matches", () => {
    const results = search(index, "xyznonexistent");
    expect(results).toEqual([]);
  });

  it("returns results sorted by score descending", () => {
    const results = search(index, "automation chatbot agent");
    expect(results.map(({ document, score }) => ({ id: document.id, score }))).toEqual([
      { id: "blog-001", score: 5.6 },
      { id: "svc-001", score: 3.5 },
    ]);
  });

  it("respects limit option", () => {
    expect(search(index, "automation chatbot agent", { limit: 1 }).map(({ document }) => document.id))
      .toEqual(["blog-001"]);
    expect(search(index, "automation chatbot agent", { limit: 2 }).map(({ document }) => document.id))
      .toEqual(["blog-001", "svc-001"]);
  });

  it("respects minScore threshold", () => {
    const results = search(index, "chatbot", { minScore: 100 });
    expect(results).toEqual([]);
  });

  it("filters by category", () => {
    const results = search(index, "chatbot agent automation", { category: "services" });
    expect(results.map(({ document }) => document.id)).toEqual(["svc-001"]);
  });

  it("filters by tags", () => {
    const results = search(index, "chatbot automation mavenn support", { tags: ["ai"] });
    expect(results.map(({ document }) => document.id).sort()).toEqual(["blog-001", "svc-001"]);
  });

  it("matches relevance keywords", () => {
    const results = search(index, "mavenn");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.id).toBe("prod-001");
  });

  it("handles multi-word queries", () => {
    const results = search(index, "artificial intelligence chatbot");
    expect(results.map(({ document, matchedTokens }) => ({ id: document.id, matchedTokens }))).toEqual([
      { id: "blog-001", matchedTokens: ["artificial", "intelligence", "chatbot"] },
    ]);
  });

  it("returns empty for single-character queries", () => {
    const results = search(index, "a");
    expect(results).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(search(index, "CHATBOT").map(({ document }) => document.id)).toEqual(["blog-001"]);
    expect(search(index, "chatbot").map(({ document }) => document.id)).toEqual(["blog-001"]);
  });

  it("strips punctuation from query", () => {
    expect(search(index, "chatbot!!!").map(({ document }) => document.id)).toEqual(["blog-001"]);
  });

  it("returns matchedTokens in results", () => {
    const results = search(index, "chatbot agent");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchedTokens).toContain("chatbot");
  });

  it("boosts recent documents when boostRecent is true", () => {
    const withoutBoost = search(index, "support", { boostRecent: false });
    const withBoost = search(index, "support", { boostRecent: true });
    expect(withoutBoost.map(({ document, score }) => ({ id: document.id, score })))
      .toEqual([{ id: "faq-001", score: 3.5 }]);
    expect(withBoost.map(({ document, score }) => ({ id: document.id, score })))
      .toEqual([{ id: "faq-001", score: 5.25 }]);
  });

  it("returns empty array for empty query", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "   ")).toEqual([]);
  });
});

// ─── getDocument ─────────────────────────────────────────────────────────

describe("getDocument", () => {
  let index: GnosysWebIndex;

  beforeEach(() => {
    index = makeSampleIndex();
  });

  it("returns document by ID", () => {
    const doc = getDocument(index, "blog-001");
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe("Building AI Chatbots");
  });

  it("returns document by path", () => {
    const doc = getDocument(index, "blog/ai-chatbot.md");
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe("blog-001");
  });

  it("returns null for non-existent document", () => {
    expect(getDocument(index, "nonexistent")).toBeNull();
  });
});

// ─── listDocuments ───────────────────────────────────────────────────────

describe("listDocuments", () => {
  let index: GnosysWebIndex;

  beforeEach(() => {
    index = makeSampleIndex();
  });

  it("returns all documents with no filter", () => {
    expect(listDocuments(index).map(({ id }) => id)).toEqual([
      "blog-001", "svc-001", "prod-001", "faq-001", "arch-001",
    ]);
  });

  it("filters by category", () => {
    const docs = listDocuments(index, { category: "blog" });
    expect(docs.length).toBe(2);
    for (const d of docs) expect(d.category).toBe("blog");
  });

  it("filters by tags (any match)", () => {
    const docs = listDocuments(index, { tags: ["ai"] });
    expect(docs.length).toBe(2); // blog-001, svc-001
    for (const d of docs) expect(d.tags).toContain("ai");
  });

  it("filters by status", () => {
    const docs = listDocuments(index, { status: "archived" });
    expect(docs.length).toBe(1);
    expect(docs[0].id).toBe("arch-001");
  });

  it("combines multiple filters (AND logic)", () => {
    const docs = listDocuments(index, { category: "blog", status: "active" });
    expect(docs.length).toBe(1);
    expect(docs[0].id).toBe("blog-001");
  });

  it("returns empty array when no documents match filter", () => {
    const docs = listDocuments(index, { category: "nonexistent" });
    expect(docs).toEqual([]);
  });
});
