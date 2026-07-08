/**
 * Concept expansion tests for Gnosys Web indexes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import os from "os";
import path from "path";
import {
  clearIndexCache,
  clearVectorsCache,
  loadIndex,
  search,
} from "../lib/staticSearch.js";
import type {
  DocumentManifest,
  GnosysWebIndex,
  GnosysWebVectors,
} from "../lib/staticSearch.js";
import {
  attachExpansions,
  buildIndexSync,
  generateExpansions,
} from "../lib/webIndex.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "gnosys-web-expansions-"));
  clearIndexCache();
  clearVectorsCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
  clearIndexCache();
  clearVectorsCache();
  await rm(tmpDir, { recursive: true, force: true });
});

function makeDoc(overrides: Partial<DocumentManifest> = {}): DocumentManifest {
  return {
    id: "doc",
    path: "knowledge/doc.md",
    title: "Doc",
    category: "general",
    tags: ["test"],
    relevance: "test",
    contentHash: "hash",
    contentLength: 100,
    created: "2026-01-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function makeExpansionIndex(overrides: Partial<GnosysWebIndex> = {}): GnosysWebIndex {
  const documents = [
    makeDoc({ id: "direct", path: "knowledge/direct.md", title: "Desserts" }),
    makeDoc({ id: "cookie", path: "knowledge/cookie.md", title: "Cookie" }),
    makeDoc({ id: "brownie", path: "knowledge/brownie.md", title: "Brownie" }),
    makeDoc({ id: "semantic", path: "knowledge/semantic.md", title: "Semantic" }),
  ];

  return {
    version: 1,
    generated: "2026-07-08T00:00:00.000Z",
    documentCount: documents.length,
    documents,
    invertedIndex: {
      desserts: [{ docIndex: 0, score: 4 }],
      cookie: [{ docIndex: 1, score: 4 }],
      brownie: [{ docIndex: 2, score: 3 }],
    },
    ...overrides,
  };
}

function makeVectors(): GnosysWebVectors {
  return {
    version: 1,
    model: "text-embedding-3-small",
    dims: 2,
    quantization: "int8",
    generated: "2026-07-08T00:00:00.000Z",
    scale: 1,
    offset: 0,
    vectors: {
      direct: [0, 1],
      cookie: [0, 1],
      brownie: [0, 1],
      semantic: [1, 0],
    },
  };
}

describe("generateExpansions", () => {
  it("normalizes valid provider JSON and filters self-references and stop words", async () => {
    const index = makeExpansionIndex({
      invertedIndex: {
        desserts: [
          { docIndex: 0, score: 4 },
          { docIndex: 1, score: 1 },
        ],
        fruit: [{ docIndex: 2, score: 2 }],
      },
    });
    const provider = {
      generate: vi.fn(async () =>
        JSON.stringify({
          Desserts: ["Cookie", "the", "Desserts", "ice cream", "AI", "cookie"],
          fruit: ["Apple"],
        })
      ),
    };

    const expansions = await generateExpansions(index, provider);

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(expansions).toEqual({
      desserts: ["cookie", "cream", "ice"],
      fruit: ["apple"],
    });
  });

  it("returns an empty map instead of throwing on malformed provider output", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider = {
      generate: vi.fn(async () => "not json"),
    };

    await expect(generateExpansions(makeExpansionIndex(), provider)).resolves.toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("invalid JSON"));
  });

  it("selects candidates by document frequency and respects maxTokens", async () => {
    const index = makeExpansionIndex({
      invertedIndex: {
        common: [
          { docIndex: 0, score: 1 },
          { docIndex: 1, score: 1 },
          { docIndex: 2, score: 1 },
        ],
        medium: [
          { docIndex: 0, score: 1 },
          { docIndex: 1, score: 1 },
        ],
        rare: [{ docIndex: 0, score: 1 }],
        ai: [
          { docIndex: 0, score: 1 },
          { docIndex: 1, score: 1 },
          { docIndex: 2, score: 1 },
          { docIndex: 3, score: 1 },
        ],
        the: [
          { docIndex: 0, score: 1 },
          { docIndex: 1, score: 1 },
          { docIndex: 2, score: 1 },
          { docIndex: 3, score: 1 },
        ],
      },
    });
    const provider = {
      generate: vi.fn(async (prompt: string) => {
        const candidateLine = prompt.split("Input tokens:\n")[1] ?? "";
        expect(candidateLine).toBe("common, medium");
        return JSON.stringify({
          common: ["shared"],
          medium: ["useful"],
          rare: ["ignored"],
        });
      }),
    };

    const expansions = await generateExpansions(index, provider, { maxTokens: 2 });

    expect(expansions).toEqual({
      common: ["shared"],
      medium: ["useful"],
    });
  });
});

describe("attachExpansions", () => {
  it("bumps an index to v2 when a non-empty map is attached", () => {
    const expanded = attachExpansions(makeExpansionIndex(), {
      Desserts: ["Cookie", "the", "Desserts"],
    });

    expect(expanded.version).toBe(2);
    expect(expanded.expansions).toEqual({ desserts: ["cookie"] });
  });

  it("keeps indexes at v1 when the map is empty", () => {
    const expanded = attachExpansions(makeExpansionIndex(), {});

    expect(expanded.version).toBe(1);
    expect(expanded.expansions).toBeUndefined();
  });

  it("lets buildIndexSync attach injected expansions without changing default builds", () => {
    writeFileSync(
      path.join(tmpDir, "doc.md"),
      "---\nid: doc\ntitle: Dessert Doc\ncategory: general\nstatus: active\n---\nCookie notes.",
      "utf-8"
    );

    expect(buildIndexSync(tmpDir).version).toBe(1);
    const expanded = buildIndexSync(tmpDir, { expansions: { desserts: ["cookie"] } });

    expect(expanded.version).toBe(2);
    expect(expanded.expansions).toEqual({ desserts: ["cookie"] });
  });
});

describe("loadIndex v2 compatibility", () => {
  it("accepts v1 and v2 indexes and still rejects future versions", () => {
    const v1 = makeExpansionIndex();
    const v2 = attachExpansions(v1, { desserts: ["cookie"] });

    expect(loadIndex(JSON.stringify(v1)).version).toBe(1);
    clearIndexCache();
    expect(loadIndex(JSON.stringify(v2)).version).toBe(2);
    clearIndexCache();
    expect(() => loadIndex(JSON.stringify({ ...v1, version: 3 }))).toThrow(
      "version 3 is not supported"
    );
  });
});

describe("query-time expansion", () => {
  it("returns expanded-only matches at the documented 0.5x score discount", () => {
    const index = attachExpansions(makeExpansionIndex(), { desserts: ["cookie"] });

    const results = search(index, "desserts", { limit: 10 });
    const direct = results.find((result) => result.document.id === "direct");
    const expanded = results.find((result) => result.document.id === "cookie");

    expect(direct?.score).toBe(4);
    expect(expanded?.score).toBe(2);
    expect(expanded?.matchedTokens).toEqual(["cookie"]);
  });

  it("does not double-count a token that is both direct and expanded", () => {
    const index = attachExpansions(makeExpansionIndex(), { desserts: ["cookie"] });

    const results = search(index, "desserts cookie", { limit: 10 });
    const cookie = results.find((result) => result.document.id === "cookie");

    expect(cookie?.score).toBe(4);
    expect(cookie?.matchedTokens).toEqual(["cookie"]);
  });

  it("honors expandQuery false and matches a no-expansions index", () => {
    const base = makeExpansionIndex();
    const expanded = attachExpansions(base, { desserts: ["cookie"] });

    const optedOut = search(expanded, "desserts", { limit: 10, expandQuery: false });
    const baseResults = search(base, "desserts", { limit: 10 });

    expect(optedOut).toEqual(baseResults);
    expect(optedOut.map((result) => result.document.id)).toEqual(["direct"]);
  });

  it("searches v1 indexes identically when no expansions field exists", () => {
    const index = makeExpansionIndex();

    expect(search(index, "desserts", { limit: 10 })).toEqual(
      search({ ...index, version: 1 }, "desserts", { limit: 10 })
    );
  });

  it("participates in semantic fusion on a v2 index", () => {
    const index = attachExpansions(makeExpansionIndex(), { desserts: ["cookie"] });

    const results = search(index, "desserts", {
      limit: 4,
      queryVector: [1, 0],
      vectors: makeVectors(),
      expectedModel: "text-embedding-3-small",
    });

    expect(results.map((result) => result.document.id)).toContain("cookie");
    expect(results.find((result) => result.document.id === "cookie")?.matchedTokens).toEqual([
      "cookie",
    ]);
    expect(results.find((result) => result.document.id === "semantic")?.semanticScore).toBeCloseTo(
      1,
      10
    );
  });
});
