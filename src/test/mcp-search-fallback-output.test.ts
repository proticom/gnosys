import { describe, expect, it } from "vitest";
import { formatMcpSearchResults } from "../lib/mcpSearchResults.js";

describe("MCP search output", () => {
  const keywordHit = { title: "JWT authentication", relativePath: "auth-001", score: 0.5, snippet: "Validate tokens", sources: ["keyword"] satisfies Array<"keyword"> };

  it("keeps the hybrid fallback note short and omits the embedding count", () => {
    expect(formatMcpSearchResults({
      query: "authentication", results: [keywordHit], search: { kind: "keyword-fallback", requested: "hybrid" },
    })).toBe('Semantic embeddings unavailable. Keyword-only results. Run `gnosys doctor` for the fix.\n\nFound 1 results for "authentication":\n\n**JWT authentication** (score: 0.5000, via: keyword)\n  Path: auth-001\n  Validate tokens...');
  });

  it("labels semantic fallback hits as keyword results", () => {
    expect(formatMcpSearchResults({
      query: "authentication", results: [keywordHit], search: { kind: "keyword-fallback", requested: "semantic" },
    })).toBe('Semantic embeddings unavailable. Keyword-only results. Run `gnosys doctor` for the fix.\n\nFound 1 keyword results for "authentication":\n\n**JWT authentication** (score: 0.5000, via: keyword)\n  Path: auth-001\n  Validate tokens...');
  });

  it("retains the embedding count for hybrid search without fallback", () => {
    expect(formatMcpSearchResults({
      query: "authentication", results: [keywordHit], search: { kind: "hybrid", embeddingCount: 7 },
    })).toBe('Found 1 results for "authentication" (7 embeddings indexed):\n\n**JWT authentication** (score: 0.5000, via: keyword)\n  Path: auth-001\n  Validate tokens...');
  });

  it("retains semantic hit labels when embeddings work", () => {
    expect(formatMcpSearchResults({
      query: "authentication",
      results: [{ ...keywordHit, sources: ["semantic"] }],
      search: { kind: "semantic" },
    })).toBe('Found 1 semantic results for "authentication":\n\n**JWT authentication** (score: 0.5000, via: semantic)\n  Path: auth-001\n  Validate tokens...');
  });

  it("retains the empty hybrid search response", () => {
    expect(formatMcpSearchResults({
      query: "unknown", results: [], search: { kind: "hybrid", embeddingCount: 7 },
    })).toBe('No results for "unknown". Try different keywords.');
  });

  it("renders an empty semantic fallback without an install path", () => {
    expect(formatMcpSearchResults({
      query: "unknown", results: [], search: { kind: "keyword-fallback", requested: "semantic" },
    })).toBe('Semantic embeddings unavailable. Keyword-only results. Run `gnosys doctor` for the fix.\n\nNo keyword results for "unknown". Try a broader query.');
  });
});
