/**
 * Semantic fusion tests for staticSearch.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import os from "os";
import path from "path";
import {
  clearVectorsCache,
  cosineSimilarity,
  loadVectors,
  search,
} from "../lib/staticSearch.js";
import type {
  DocumentManifest,
  GnosysWebIndex,
  GnosysWebVectors,
} from "../lib/staticSearch.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "gnosys-static-semantic-"));
  clearVectorsCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
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

function makeSemanticIndex(): GnosysWebIndex {
  const documents = [
    makeDoc({
      id: "lex-a",
      path: "knowledge/lex-a.md",
      title: "Lexical A",
      category: "lexical",
      tags: ["fruit"],
    }),
    makeDoc({
      id: "lex-b",
      path: "knowledge/lex-b.md",
      title: "Lexical B",
      category: "lexical",
      tags: ["fruit", "semantic"],
    }),
    makeDoc({
      id: "sem-c",
      path: "knowledge/sem-c.md",
      title: "Semantic C",
      category: "semantic",
      tags: ["semantic"],
    }),
  ];

  return {
    version: 1,
    generated: "2026-07-08T00:00:00.000Z",
    documentCount: documents.length,
    documents,
    invertedIndex: {
      orchard: [
        { docIndex: 0, score: 10 },
        { docIndex: 1, score: 9 },
      ],
      apple: [{ docIndex: 0, score: 2 }],
    },
  };
}

function makeVectors(overrides: Partial<GnosysWebVectors> = {}): GnosysWebVectors {
  return {
    version: 1,
    model: "text-embedding-3-small",
    dims: 2,
    quantization: "int8",
    generated: "2026-07-08T00:00:00.000Z",
    scale: 0.01,
    offset: 0,
    vectors: {
      "lex-a": [0, 100],
      "lex-b": [100, 0],
      "sem-c": [80, 10],
    },
    ...overrides,
  };
}

describe("staticSearch dependency boundary", () => {
  it("imports only Node builtins", () => {
    const source = readFileSync(new URL("../lib/staticSearch.ts", import.meta.url), "utf-8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

    for (const specifier of specifiers) {
      expect(
        specifier === "fs" || specifier === "path" || specifier.startsWith("node:"),
        `staticSearch.ts imports "${specifier}" which is not a Node.js builtin`
      ).toBe(true);
    }
  });
});

describe("loadVectors", () => {
  it("loads vectors from a raw JSON string", () => {
    const loaded = loadVectors(JSON.stringify(makeVectors()));

    expect(loaded.version).toBe(1);
    expect(loaded.model).toBe("text-embedding-3-small");
    expect(loaded.vectors["lex-b"]).toEqual([100, 0]);
  });

  it("loads vectors from a file path and caches repeated calls", () => {
    const filePath = path.join(tmpDir, "gnosys-vectors.json");
    writeFileSync(filePath, JSON.stringify(makeVectors()), "utf-8");

    const first = loadVectors(filePath);
    const second = loadVectors(filePath);

    expect(first).toBe(second);
    expect(first.dims).toBe(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => loadVectors("{not valid json")).toThrow("Invalid JSON");
  });

  it("throws on missing version", () => {
    const vectors = { ...makeVectors() } as Record<string, unknown>;
    delete vectors.version;

    expect(() => loadVectors(JSON.stringify(vectors))).toThrow("missing or invalid version");
  });

  it("throws on unsupported version", () => {
    expect(() => loadVectors(JSON.stringify({ ...makeVectors(), version: 2 }))).toThrow(
      "version 2 is not supported"
    );
  });

  it("throws on wrong quantization", () => {
    expect(() =>
      loadVectors(JSON.stringify({ ...makeVectors(), quantization: "float32" }))
    ).toThrow("quantization must be int8");
  });

  it("throws on missing file path", () => {
    expect(() => loadVectors(path.join(tmpDir, "missing-vectors.json"))).toThrow("not found");
  });
});

describe("semantic search fusion", () => {
  it("keeps lexical search behavior unchanged when semantic inputs are absent", () => {
    const results = search(makeSemanticIndex(), "orchard", { limit: 10 });

    expect(
      results.map((result) => ({
        id: result.document.id,
        score: result.score,
        matchedTokens: result.matchedTokens,
      }))
    ).toEqual([
      { id: "lex-a", score: 10, matchedTokens: ["orchard"] },
      { id: "lex-b", score: 9, matchedTokens: ["orchard"] },
    ]);
  });

  it("falls back to lexical search when one semantic input is absent", () => {
    const results = search(makeSemanticIndex(), "orchard", {
      limit: 10,
      queryVector: [1, 0],
    });

    expect(results.map((result) => result.document.id)).toEqual(["lex-a", "lex-b"]);
    expect(results[0].score).toBe(10);
  });

  it("fuses lexical and semantic rankings with RRF k=60", () => {
    const results = search(makeSemanticIndex(), "orchard", {
      limit: 3,
      queryVector: [1, 0],
      vectors: makeVectors(),
      expectedModel: "text-embedding-3-small",
    });

    expect(results.map((result) => result.document.id)).toEqual(["lex-b", "lex-a", "sem-c"]);
    expect(results[0].score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(results[1].score).toBeCloseTo(1 / 61 + 1 / 63, 10);
    expect(results[2].score).toBeCloseTo(1 / 62, 10);
    expect(results[0].semanticScore).toBeCloseTo(1, 10);
  });

  it("allows semantic-only documents with empty matched tokens", () => {
    const results = search(makeSemanticIndex(), "banana", {
      limit: 2,
      queryVector: [1, 0],
      vectors: makeVectors(),
    });

    expect(results.map((result) => result.document.id)).toEqual(["lex-b", "sem-c"]);
    expect(results.every((result) => result.matchedTokens.length === 0)).toBe(true);
  });

  it("skips vector doc ids that are not in the index", () => {
    const vectors = makeVectors({
      vectors: {
        ...makeVectors().vectors,
        ghost: [100, 0],
      },
    });

    const results = search(makeSemanticIndex(), "orchard", {
      limit: 10,
      queryVector: [1, 0],
      vectors,
    });

    expect(results.map((result) => result.document.id)).not.toContain("ghost");
    expect(results).toHaveLength(3);
  });

  it("falls back to lexical search and warns on model mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const results = search(makeSemanticIndex(), "orchard", {
      limit: 10,
      queryVector: [1, 0],
      vectors: makeVectors(),
      expectedModel: "voyage-3-lite",
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("embedding model mismatch"));
    expect(results.map((result) => result.document.id)).toEqual(["lex-a", "lex-b"]);
    expect(results[0].score).toBe(10);
  });

  it("falls back to lexical search and warns on dimension mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const results = search(makeSemanticIndex(), "orchard", {
      limit: 10,
      queryVector: [1, 0, 0],
      vectors: makeVectors(),
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("embedding dimension mismatch"));
    expect(results.map((result) => result.document.id)).toEqual(["lex-a", "lex-b"]);
    expect(results[0].score).toBe(10);
  });

  it("dequantizes int8 vectors with scale and offset before cosine ranking", () => {
    const vectors = makeVectors({
      scale: 0.01,
      offset: 0.5,
      vectors: {
        "lex-a": [50, -50],
        "lex-b": [0, 0],
        "sem-c": [0, 0],
      },
    });

    const results = search(makeSemanticIndex(), "banana", {
      limit: 1,
      queryVector: [1, 0],
      vectors,
    });

    expect(results[0].document.id).toBe("lex-a");
    expect(results[0].semanticScore).toBeCloseTo(1, 10);
  });

  it("returns zero cosine for zero-magnitude vectors and dimension mismatches", () => {
    expect(cosineSimilarity([1, 0], [0, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
  });
});
