import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { federatedSearch, federatedDiscover } from "../lib/federated.js";
import { formatSearchStatus } from "../lib/searchStatus.js";
import { GnosysDbSearch } from "../lib/dbSearch.js";
import { recall } from "../lib/recall.js";
import { GnosysSearch } from "../lib/search.js";
import { GnosysHybridSearch } from "../lib/hybridSearch.js";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysArchive } from "../lib/archive.js";
import { z } from "zod";
import { runHybridSearchCommand } from "../lib/hybridSearchCommand.js";
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

  it("active-only modes fill top-k despite many stronger superseded matches", async () => {
    for (let index = 0; index < 30; index++) {
      env.db.insertMemory(makeMemory({ id: `historical-${index}`, title: "routing routing routing", relevance: "routing", status: "superseded", embedding: Buffer.from(new Float32Array([1, 0]).buffer) }));
    }
    const search = new GnosysDbSearch(env.db);
    for (const mode of ["keyword", "semantic", "hybrid"] as const) {
      expect((await search.hybridSearch("routing", 1, mode, async () => new Float32Array([1, 0]), true)).map((row) => row.memoryId)).toEqual(["new"]);
    }
  });

  it("treats legacy NULL status as active across retrieval paths", async () => {
    const sqlite = new Database(path.join(env.tmpDir, "gnosys.db"));
    try {
      const trigger = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'memories_fts_au'").get() as { sql: string };
      sqlite.transaction(() => {
        sqlite.exec("DROP TRIGGER memories_fts_au");
        sqlite.prepare("UPDATE memories SET status = NULL WHERE id = ?").run("new");
        sqlite.exec(trigger.sql);
      })();
    } finally {
      sqlite.close();
    }
    expect(env.db.searchFts("routing", 10, true).map((row) => row.id)).toEqual(["new"]);
    expect(env.db.discoverFts("routing", 10, true).map((row) => row.id)).toEqual(["new"]);
    expect(env.db.getActiveMemories().map((row) => row.id)).toEqual(["new"]);
    expect(env.db.getAllEmbeddings(true).map((row) => row.id)).toEqual(["new"]);
    expect(federatedSearch(env.db, "routing", { activeOnly: true }).map((row) => row.id)).toEqual(["new"]);
    expect(federatedDiscover(env.db, "routing", { activeOnly: true }).map((row) => row.id)).toEqual(["new"]);
    expect((await recall("routing", { gnosysDb: env.db, limit: 1 })).memories.map((row) => row.id)).toEqual(["new"]);
    expect(formatSearchStatus({ status: null, modified: "2026-10-06" })).toBe("[2026-10-06]");
  });

  it.each([federatedSearch, federatedDiscover])("federated activeOnly filters history before the candidate limit", (search) => {
    for (let index = 0; index < 40; index++) {
      env.db.insertMemory(makeMemory({ id: `fan-${index}`, title: "routing routing routing", relevance: "routing routing", content: "routing", status: "superseded" }));
    }
    expect(search(env.db, "routing", { limit: 1, activeOnly: true }).map((row) => row.id)).toEqual(["new"]);
  });

  it.each([federatedSearch, federatedDiscover])("federated defaults include labelled history and promote replacements after boosts", (search) => {
    env.db.updateMemory("old", { reinforcement_count: 100, modified: new Date().toISOString() });
    env.db.updateMemory("new", { confidence: 0.1 });
    const results = search(env.db, "routing");
    expect(results.map((row) => row.id)).toEqual(["new", "old", "archive"]);
    expect(results[1]).toMatchObject({ status: "superseded", superseded_by: "new" });
    expect(results[2]).toMatchObject({ status: "archived", tier: "archive" });
    expect(search(env.db, "routing", { limit: 1 }).map((row) => row.id)).toEqual(["new"]);
  });

  it.each([federatedSearch, federatedDiscover])("federated promotes linked replacements outside the query and respects scope filters", (search) => {
    env.db.updateMemory("old", { reinforcement_count: 100, modified: new Date().toISOString() });
    env.db.updateMemory("new", { title: "Correction", content: "An entirely different phrase.", relevance: "unrelated", scope: "global" });
    expect(search(env.db, "routing", { limit: 1 }).map((row) => row.id)).toEqual(["new"]);
    expect(search(env.db, "routing", { scopeFilter: ["project"] }).map((row) => row.id)).toEqual(["old", "archive"]);
  });

  it("recall includes completed and archived rows but excludes superseded rows", async () => {
    env.db.updateMemory("new", { status: "completed" });
    for (let index = 0; index < 40; index++) {
      env.db.insertMemory(makeMemory({ id: `old-archive-${index}`, title: "routing", relevance: "routing", tier: "archive", status: "superseded" }));
    }
    const result = await recall("routing", { gnosysDb: env.db, limit: 10 });
    expect(result.memories.map((row) => ({ id: row.id, fromArchive: row.fromArchive }))).toEqual([
      { id: "new", fromArchive: false },
      { id: "archive", fromArchive: true },
    ]);
  });

  it("treats archived status as fallback even when its tier is active", async () => {
    env.db.updateMemory("archive", { tier: "active" });
    const result = await recall("routing", { gnosysDb: env.db, limit: 10 });
    expect(result.memories.map((row) => ({ id: row.id, fromArchive: row.fromArchive }))).toEqual([
      { id: "new", fromArchive: false },
      { id: "archive", fromArchive: true },
    ]);
    expect((await recall("routing", { gnosysDb: env.db, limit: 1 })).memories.map((row) => row.id)).toEqual(["new"]);
  });

  it("excludes linked rows with explicit active status from activeOnly and recall", async () => {
    env.db.updateMemory("old", { status: "active" });
    expect(env.db.searchFts("routing", 10, true).map((row) => row.id)).toEqual(["new"]);
    expect(env.db.discoverFts("routing", 10, true).map((row) => row.id)).toEqual(["new"]);
    expect(env.db.getAllEmbeddings(true).map((row) => row.id)).toEqual(["new"]);
    expect((await recall("routing", { gnosysDb: env.db, limit: 10 })).memories.map((row) => row.id)).toEqual(["new", "archive"]);
    expect(formatSearchStatus({ status: "active", modified: "2026-10-06", superseded_by: "new" })).toBe("[superseded; 2026-10-06; superseded by new]");
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

  it("hybrid CLI JSON numbers the final replacement-first order", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await runHybridSearchCommand(async () => resolver, "routing", { limit: "10", mode: "keyword", json: true });
    const text = z.string().parse(output.mock.calls[0]?.[0]);
    const result = z.object({ results: z.array(z.object({ title: z.string(), position: z.number() })) }).parse(JSON.parse(text));
    expect(result.results).toEqual([
      { title: "Correction", position: 1 },
      { title: "routing routing routing", position: 2 },
      { title: "routing archive", position: 3 },
    ]);
  });

  it.each([false, true])("semantic CLI applies activeOnly=%s before limiting results", async (activeOnly) => {
    vi.spyOn(GnosysEmbeddings.prototype, "embed").mockResolvedValue(new Float32Array([1, 0]));
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await runSemanticSearchCommand(async () => resolver, "routing", { limit: "10", activeOnly });
    const lines = output.mock.calls.flat().filter((line): line is string => typeof line === "string");
    expect(lines.filter((line) => line.startsWith("  ") && !line.startsWith("    "))).toEqual(activeOnly
      ? ["  Correction [2026-10-06]"]
      : [
        "  Correction [2026-10-06]",
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

  it("legacy recall restores archive fallback without superseded candidates", async () => {
    const store = env.store!;
    const archive = new GnosysArchive(env.tmpDir);
    try {
      for (let index = 0; index < 20; index++) {
        await store.writeMemory("decisions", `expired-${index}.md`, makeFrontmatter({ id: `expired-${index}`, title: "fallback fallback", status: "superseded" }), "fallback");
        const memory = await store.readMemory(`decisions/expired-${index}.md`);
        if (!memory) throw new Error("Missing fixture");
        await archive.archiveMemory(memory);
      }
      await store.writeMemory("decisions", "decayed.md", makeFrontmatter({ id: "decayed", title: "fallback" }), "fallback still useful");
      const memory = await store.readMemory("decisions/decayed.md");
      if (!memory) throw new Error("Missing fixture");
      await archive.archiveMemory(memory);
    } finally {
      archive.close();
    }
    const result = await recall("fallback", { search, resolver, storePath: env.tmpDir, limit: 1 });
    expect(result.memories.map((row) => ({ id: row.id, fromArchive: row.fromArchive }))).toEqual([
      { id: "decayed", fromArchive: true },
    ]);
  });

  it("resolves only indexed replacement ids instead of loading every memory", async () => {
    const bulkRead = vi.spyOn(resolver, "getAllMemories");
    const hybrid = new GnosysHybridSearch(search, embeddings, resolver, env.tmpDir);
    expect((await hybrid.hybridSearch("routing", 1, "keyword")).map((row) => row.memoryId)).toEqual(["new"]);
    expect(bulkRead.mock.calls).toEqual([]);
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
