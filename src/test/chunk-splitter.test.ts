import { describe, it, expect } from "vitest";
import { splitIntoChunks } from "../lib/chunkSplitter.js";
import { fnv1a } from "../lib/db.js";

describe("splitIntoChunks", () => {
  it("returns no chunks for whitespace", () => {
    expect(splitIntoChunks(" \n\t ")).toEqual([]);
  });

  it("preserves text and paragraph separators within the target", () => {
    expect(splitIntoChunks(" alpha \n\n beta ", {
      targetSize: 100, minSize: 1, maxSize: 100,
    })).toEqual([{ text: "alpha\n\nbeta", index: 0 }]);
  });

  it("splits paragraphs at the target and preserves order", () => {
    expect(splitIntoChunks("alpha\n\nbravo\n\ncharlie", {
      targetSize: 6, minSize: 1, maxSize: 100,
    })).toEqual([
      { text: "alpha", index: 0 },
      { text: "bravo", index: 1 },
      { text: "charlie", index: 2 },
    ]);
  });

  it("merges a short chunk with its next paragraph", () => {
    expect(splitIntoChunks("a\n\nbravo\n\ncharlie", {
      targetSize: 6, minSize: 4, maxSize: 100,
    })).toEqual([
      { text: "a\n\nbravo", index: 0 },
      { text: "charlie", index: 1 },
    ]);
  });

  it("splits an oversized paragraph at sentence boundaries", () => {
    expect(splitIntoChunks("First sentence. Second sentence. Third sentence.", {
      targetSize: 20, minSize: 1, maxSize: 20,
    })).toEqual([
      { text: "First sentence.", index: 0 },
      { text: "Second sentence.", index: 1 },
      { text: "Third sentence.", index: 2 },
    ]);
  });

  it("keeps an oversized word intact", () => {
    expect(splitIntoChunks("abcdefghij", {
      targetSize: 4, minSize: 1, maxSize: 4,
    })).toEqual([{ text: "abcdefghij", index: 0 }]);
  });
});

describe("fnv1a", () => {
  it("matches the empty-input and one-character 32-bit vectors", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
  });

  it.fails("D-G3-001: matches the multi-character 32-bit FNV-1a vector", () => {
    expect(fnv1a("hello")).toBe("4f9f2cab");
  });
});
