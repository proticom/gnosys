import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDbSearch } from "../lib/dbSearch.js";
import { recall } from "../lib/recall.js";
import { GnosysSearch } from "../lib/search.js";
import { GnosysHybridSearch } from "../lib/hybridSearch.js";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysArchive } from "../lib/archive.js";
import { runSemanticSearchCommand } from "../lib/semanticSearchCommand.js";
import { createTestEnv, cleanupTestEnv, makeMemory, makeFrontmatter, type TestEnv } from "./_helpers.js";

describe("history-visible search", () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv("superseded-search");
    env.db.insertMemory(makeMemory({
      id: "old", title: "routing routing routing", relevance: "routing routing routing",
      content: "routing ".repeat(30), status: "superseded", superseded_by: "new",
      modified: "2025-01-01", embedding: Buffer.from(new Float32Array([1, 0]).buffer),
    }));
    env.db.insertMemory(makeMemory({
      id: "new", title: "Correction", relevance: "routing", content: "Use the corrected routing rule.",
      supersedes: "old", modified: "2026-10-06", embedding: Buffer.from(new Float32Array([0.8, 0.2]).buffer),
    }));
    env.db.insertMemory(makeMemory({ id: "archive", title: "routing archive", tier: "archive", status: "archived", embedding: Buffer.from(new Float32Array([0.5, 0.5]).buffer) }));
  });
  afterEach(async () => cleanupTestEnv(env));

  for (const method of ["searchFts", "discoverFts"] as const) {
    it(`${method} promotes the correction and retains labelled history`, () => {
      const results = env.db[method]("routing", 10);
      expect(results.slice(0, 2).map((row) => row.id)).toEqual(["new", "old"]);
      expect(results.find((row) => row.id === "old")).toMatchObject({ status: "superseded", modified: "2025-01-01", superseded_by: "new" });
      expect(results.find((row) => row.id === "archive")).toMatchObject({ status: "archived", tier: "archive" });
      expect(env.db[method]("routing", 1).map((row) => row.id)).toEqual(["new"]);
      expect(env.db[method]("routing", 10, true).map((row) => row.id)).toEqual(["new"]);
    });
  }

  for (const mode of ["keyword", "semantic", "hybrid"] as const) {
    it(`${mode} ranks replacements before history and filters before top-k`, async () => {
      const search = new GnosysDbSearch(env.db);
      const embed = async () => new Float32Array([1, 0]);
      expect((await search.hybridSearch("routing", 10, mode, embed)).slice(0, 2).map((row) => row.memoryId)).toEqual(["new", "old"]);
      expect((await search.hybridSearch("routing", 1, mode, embed)).map((row) => row.memoryId)).toEqual(["new"]);
      expect((await search.hybridSearch("routing", 10, mode, embed, true)).map((row) => row.memoryId)).toEqual(["new"]);
    });
  }

  it("current-only modes fill top-k despite many stronger superseded matches", async () => {
    for (let index = 0; index < 30; index++) {
      env.db.insertMemory(makeMemory({ id: `historical-${index}`, title: "routing routing routing", relevance: "routing", status: "superseded", embedding: Buffer.from(new Float32Array([1, 0]).buffer) }));
    }
    const search = new GnosysDbSearch(env.db);
    for (const mode of ["keyword", "semantic", "hybrid"] as const) {
      expect((await search.hybridSearch("routing", 1, mode, async () => new Float32Array([1, 0]), true)).map((row) => row.memoryId)).toEqual(["new"]);
    }
  });

  it("retrieves a linked replacement outside the keyword candidate window", () => {
    env.db.updateMemory("new", { title: "Correction", content: "An entirely different phrase.", relevance: "unrelated" });
    expect(env.db.searchFts("routing", 1).map((row) => row.id)).toEqual(["new"]);
    expect(env.db.discoverFts("routing", 1).map((row) => row.id)).toEqual(["new"]);
  });

  it("recall filters old rows before they can consume its candidate window", async () => {
    for (let index = 0; index < 40; index++) {
      env.db.insertMemory(makeMemory({ id: `old-${index}`, title: "routing routing", relevance: "routing routing", content: "routing", status: "superseded" }));
    }
    const search = new GnosysSearch(env.tmpDir);
    try {
      const result = await recall("routing", { gnosysDb: env.db, search, resolver: new GnosysResolver(), storePath: env.tmpDir, limit: 1 });
      expect(result.memories.map((row) => row.id)).toEqual(["new"]);
    } finally {
      search.close();
    }
  });
});


describe("legacy search metadata", () => {
  let env: TestEnv;
  let search: GnosysSearch;
  let resolver: GnosysResolver;
  let embeddings: GnosysEmbeddings;
  beforeEach(async () => {
    env = await createTestEnv("superseded-legacy", { withStore: true });
    const store = env.store!;
    await store.writeMemory("decisions", "old.md", makeFrontmatter({ id: "old", title: "routing routing routing", relevance: "routing routing", status: "superseded", superseded_by: "new", modified: "2025-01-01" }), "routing ".repeat(30));
    await store.writeMemory("decisions", "new.md", makeFrontmatter({ id: "new", title: "Correction", relevance: "routing", supersedes: "old", modified: "2026-10-06" }), "Corrected routing rule.");
    await store.writeMemory("decisions", "archive.md", makeFrontmatter({ id: "archive", title: "routing archive", status: "archived", modified: "2025-01-01" }), "routing archive");
    search = new GnosysSearch(env.tmpDir);
    await search.reindex(store);
    resolver = new GnosysResolver();
    await resolver.addProjectStore(env.tmpDir);
    class QueryEmbeddings extends GnosysEmbeddings {
      override async embed(): Promise<Float32Array> { return new Float32Array([1, 0]); }
    }
    embeddings = new QueryEmbeddings(env.tmpDir);
    embeddings.storeEmbedding("decisions/old.md", new Float32Array([1, 0]), "old");
    embeddings.storeEmbedding("decisions/new.md", new Float32Array([0.8, 0.2]), "new");
    embeddings.storeEmbedding("decisions/archive.md", new Float32Array([0.5, 0.5]), "archive");
  });
  afterEach(async () => { vi.restoreAllMocks(); search.close(); embeddings.close(); await cleanupTestEnv(env); });

  it.each([false, true])("semantic CLI applies currentOnly=%s before limiting results", async (currentOnly) => {
    vi.spyOn(GnosysEmbeddings.prototype, "embed").mockResolvedValue(new Float32Array([1, 0]));
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await runSemanticSearchCommand(async () => resolver, "routing", { limit: "10", currentOnly });
    const lines = output.mock.calls.flat().filter((line): line is string => typeof line === "string");
    expect(lines.filter((line) => line.startsWith("  ") && !line.startsWith("    "))).toEqual(currentOnly
      ? ["  Correction [active; 2026-10-06]"]
      : [
        "  Correction [active; 2026-10-06]",
        "  routing routing routing [superseded; 2025-01-01; superseded by new]",
        "  routing archive [archived; 2025-01-01]",
      ]);
  });

  it("loads archive history with its original date and current replacement", async () => {
    const store = env.store!;
    await store.writeMemory("decisions", "old.md", makeFrontmatter({
      id: "old", title: "Ancestral policy", status: "superseded",
      superseded_by: "new", modified: "2025-01-01",
    }), "ancestral policy");
    const memory = await store.readMemory("decisions/old.md");
    if (!memory) throw new Error("Missing archive fixture");
    const archive = new GnosysArchive(env.tmpDir);
    try {
      await archive.archiveMemory(memory);
    } finally {
      archive.close();
    }
    await search.reindex(store);
    const hybrid = new GnosysHybridSearch(search, embeddings, resolver, env.tmpDir);
    const results = await hybrid.hybridSearch("ancestral", 10, "keyword");
    expect(results.map((row) => row.memoryId)).toEqual(["new", "old"]);
    expect(results[0]).toMatchObject({ status: "active", fromArchive: false });
    expect(results[1]).toMatchObject({ status: "archived", modified: "2025-01-01", superseded_by: "new" });
  });

  for (const method of ["search", "discover"] as const) {
    it(`${method} carries status and prioritizes linked history`, () => {
      expect(search[method]("routing", 10).slice(0, 2).map((row) => row.memoryId)).toEqual(["new", "old"]);
      expect(search[method]("routing", 1).map((row) => row.memoryId)).toEqual(["new"]);
      expect(search[method]("routing", 10, true).map((row) => row.memoryId)).toEqual(["new"]);
      expect(search[method]("routing", 10).find((row) => row.memoryId === "old")).toMatchObject({ status: "superseded", modified: "2025-01-01", superseded_by: "new" });
    });
  }
  for (const mode of ["keyword", "semantic", "hybrid"] as const) {
    it(`${mode} returns each replacement once and filters current rows`, async () => {
      const hybrid = new GnosysHybridSearch(search, embeddings, resolver, env.tmpDir);
      expect((await hybrid.hybridSearch("routing", 10, mode)).map((row) => row.memoryId)).toEqual(["new", "old", "archive"]);
      expect((await hybrid.hybridSearch("routing", 1, mode)).map((row) => row.memoryId)).toEqual(["new"]);
      expect((await hybrid.hybridSearch("routing", 10, mode, true)).map((row) => row.memoryId)).toEqual(["new"]);
    });
  }
});
