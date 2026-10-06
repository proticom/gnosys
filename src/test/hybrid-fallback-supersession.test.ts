import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { GnosysHybridSearch } from "../lib/hybridSearch.js";
import { formatMcpSearchResults } from "../lib/mcpSearchResults.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysSearch } from "../lib/search.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

class QueryEmbeddings extends GnosysEmbeddings {
  override async embed(): Promise<Float32Array> {
    return new Float32Array([1, 0]);
  }
}

describe("hybrid health and supersession together", () => {
  let env: TestEnv;
  let keyword: GnosysSearch;
  let embeddings: GnosysEmbeddings;
  let search: GnosysHybridSearch;

  beforeEach(async () => {
    env = await createTestEnv("hybrid-fallback-supersession");
    env.db.insertMemory(makeMemory({
      id: "old", title: "Routing legacy", relevance: "routing routing routing",
      content: "routing ".repeat(30), status: "superseded", superseded_by: "new",
      modified: "2025-01-01",
    }));
    env.db.insertMemory(makeMemory({
      id: "new", title: "Correction", relevance: "routing", content: "Corrected routing rule.",
      supersedes: "old", modified: "2026-10-06",
    }));
    env.db.insertMemory(makeMemory({
      id: "archive", title: "Routing archive", relevance: "routing", content: "routing experiment",
      status: "archived", tier: "archive", modified: "2024-02-03",
    }));
    keyword = new GnosysSearch(env.tmpDir);
    embeddings = new QueryEmbeddings(env.tmpDir);
    search = new GnosysHybridSearch(keyword, embeddings, new GnosysResolver(), env.tmpDir, env.db);
  });

  afterEach(async () => {
    keyword.close();
    embeddings.close();
    await cleanupTestEnv(env);
  });

  it("shows status and score/via together when hybrid embeddings work", async () => {
    for (const [id, vector] of Object.entries({ old: [1, 0], new: [0.8, 0.2], archive: [0.5, 0.5] })) {
      env.db.updateEmbedding(id, Buffer.from(new Float32Array(vector).buffer));
    }
    const outcome = await search.searchWithStatus("routing", 10, "hybrid");
    expect(outcome.kind).toBe("requested");
    expect(outcome.results.map(hit => hit.memoryId)).toEqual(["new", "old", "archive"]);
    const text = formatMcpSearchResults({
      query: "routing", results: outcome.results, search: { kind: "hybrid", embeddingCount: search.embeddingCount() },
    });
    expect(text).toContain('Found 3 results for "routing" (3 embeddings indexed):');
    expect(text.split("\n").filter(line => line.startsWith("**"))).toEqual([
      "**Correction** (score: 0.0325, via: keyword+semantic) [2026-10-06]",
      "**Routing legacy** (score: 0.0325, via: keyword+semantic) [superseded; 2025-01-01; superseded by new]",
      "**Routing archive** (score: 0.0317, via: keyword+semantic) [archived; 2024-02-03]",
    ]);
  });

  it.each(["hybrid", "semantic"] satisfies Array<"hybrid" | "semantic">)(
    "%s keyword fallback preserves replacement order, labels, limits and activeOnly",
    async mode => {
      const outcome = await search.searchWithStatus("routing", 10, mode);
      expect(outcome.kind).toBe("keyword-fallback");
      expect(outcome.results.map(hit => hit.memoryId)).toEqual(["new", "old", "archive"]);
      const text = formatMcpSearchResults({
        query: "routing", results: outcome.results, search: { kind: "keyword-fallback", requested: mode },
      });
      expect(text.split("\n\n")[0]).toBe("Semantic embeddings unavailable. Keyword-only results. Run `gnosys doctor` for the fix.");
      expect(text.split("\n").filter(line => line.startsWith("**"))).toEqual([
        "**Correction** (score: 0.0164, via: keyword) [2026-10-06]",
        "**Routing legacy** (score: 0.0161, via: keyword) [superseded; 2025-01-01; superseded by new]",
        "**Routing archive** (score: 0.0159, via: keyword) [archived; 2024-02-03]",
      ]);
      expect(text).not.toContain("embeddings indexed");
      expect(text).not.toContain("npm install");
      expect(text).not.toContain(env.tmpDir);
      expect((await search.searchWithStatus("routing", 1, mode)).results.map(hit => hit.memoryId)).toEqual(["new"]);
      expect((await search.searchWithStatus("routing", 10, mode, true)).results.map(hit => hit.memoryId)).toEqual(["new"]);
    },
  );
});
