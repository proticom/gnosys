import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GnosysDB } from "../lib/db.js";
import { GnosysSearch } from "../lib/search.js";
import { GnosysResolver } from "../lib/resolver.js";
import { makeMemory } from "./_helpers.js";

describe("embedding failures preserve keyword recall", () => {
  let directory: string;
  let db: GnosysDB;
  let keyword: GnosysSearch;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "gnosys-embedding-health-"));
    vi.stubEnv("GNOSYS_HOME", directory);
    vi.stubEnv("GNOSYS_CACHE_DIR", join(directory, "cache"));
    db = new GnosysDB(directory);
    db.insertMemory(makeMemory({
      id: "auth-001",
      title: "JWT authentication",
      content: "JWT authentication validates signed tokens.",
      relevance: "jwt authentication",
      embedding: Buffer.from(new Float32Array([1, 0, 0]).buffer),
    }));
    keyword = new GnosysSearch(directory);
  });

  afterEach(() => {
    keyword.close();
    db.close();
    vi.doUnmock("@huggingface/transformers");
    vi.resetModules();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  for (const mode of ["semantic", "hybrid"] satisfies Array<"semantic" | "hybrid">) {
    it(`${mode} returns a literal keyword hit and an install command when the runtime cannot import`, async () => {
      vi.doMock("@huggingface/transformers", () => {
        throw new Error("Cannot find package '@huggingface/transformers'");
      });
      const { GnosysEmbeddings } = await import("../lib/embeddings.js");
      const { GnosysHybridSearch } = await import("../lib/hybridSearch.js");
      const embeddings = new GnosysEmbeddings(directory);
      const search = new GnosysHybridSearch(keyword, embeddings, new GnosysResolver(), directory, db);
      const result = await search.searchWithStatus("authentication", 5, mode);
      expect(result.kind).toBe("keyword-fallback");
      expect(result.results.map(hit => ({ id: hit.relativePath, sources: hit.sources })))
        .toEqual([{ id: "auth-001", sources: ["keyword"] }]);
      if (result.kind !== "keyword-fallback") throw new Error("Expected fallback");
      expect(result.note).toContain(`${mode} search ran keyword-only`);
      expect(result.note).toContain("npm install @huggingface/transformers@^4.2.0 --prefix '");
      expect(result.note).toContain("--foreground-scripts");
      embeddings.close();
    });
  }

  it("reports native loading errors with their actual cause", async () => {
    vi.doMock("@huggingface/transformers", () => { throw new Error("dlopen: wrong architecture"); });
    const { checkEmbeddingRuntime, embeddingFailureMessage } = await import("../lib/embeddingHealth.js");
    const result = await checkEmbeddingRuntime();
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") throw new Error("Expected unavailable runtime");
    expect(embeddingFailureMessage(new Error("dlopen: wrong architecture"))).toContain("Runtime error: dlopen: wrong architecture");
    expect(result.message).toContain("Then run gnosys doctor and gnosys reindex.");
  });

  it("reports model loading failure and still returns keyword hits", async () => {
    vi.doMock("@huggingface/transformers", () => ({
      env: {},
      pipeline: async () => { throw new Error("Model download failed: offline"); },
    }));
    const { GnosysEmbeddings } = await import("../lib/embeddings.js");
    const { GnosysHybridSearch } = await import("../lib/hybridSearch.js");
    const embeddings = new GnosysEmbeddings(directory);
    const search = new GnosysHybridSearch(keyword, embeddings, new GnosysResolver(), directory, db);
    const result = await search.searchWithStatus("authentication", 5, "hybrid");
    expect(result.results.map(hit => hit.relativePath)).toEqual(["auth-001"]);
    if (result.kind !== "keyword-fallback") throw new Error("Expected fallback");
    expect(result.note).toContain("Model download failed: offline");
    embeddings.close();
  });

  it("does not load a model for keyword mode and does not misreport database failures", async () => {
    vi.doMock("@huggingface/transformers", () => { throw new Error("Must not load"); });
    const { GnosysEmbeddings } = await import("../lib/embeddings.js");
    const { GnosysHybridSearch } = await import("../lib/hybridSearch.js");
    const embeddings = new GnosysEmbeddings(directory);
    const search = new GnosysHybridSearch(keyword, embeddings, new GnosysResolver(), directory, db);
    const result = await search.searchWithStatus("authentication", 5, "keyword");
    expect(result.kind).toBe("requested");
    expect(result.results.map(hit => hit.relativePath)).toEqual(["auth-001"]);
    vi.spyOn(db, "getEmbeddingCount").mockImplementation(() => { throw new Error("Database is closed"); });
    await expect(search.searchWithStatus("authentication", 5, "hybrid")).rejects.toThrow("Database is closed");
    embeddings.close();
  });
});
