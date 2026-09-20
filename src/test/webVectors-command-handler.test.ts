import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWebBuildCommand } from "../lib/webBuildCommand.js";
import { runWebBuildIndexCommand } from "../lib/webBuildIndexCommand.js";
import { runWebInitCommand } from "../lib/webInitCommand.js";
import { runWebStatusCommand } from "../lib/webStatusCommand.js";

let baseDir: string;
let storeDir: string;
let knowledgeDir: string;
let contentDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const getWebStorePath = async () => storeDir;
const logged = () => logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
const errored = () => errSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const indexFile = () => join(knowledgeDir, "gnosys-index.json");
const vectorsFile = () => join(knowledgeDir, "gnosys-vectors.json");

function configure(provider = false): void {
  writeFileSync(join(storeDir, "gnosys.json"), JSON.stringify({
    llm: provider ? { defaultProvider: "openai", openai: { model: "audit-model" } } : {},
    web: { source: "directory", contentDir, outputDir: knowledgeDir, llmEnrich: false },
  }));
}

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), "gnosys-web-command-audit-"));
  storeDir = join(baseDir, "store");
  knowledgeDir = join(baseDir, "knowledge");
  contentDir = join(baseDir, "content");
  for (const directory of [storeDir, knowledgeDir, contentDir]) mkdirSync(directory);
  writeFileSync(join(knowledgeDir, "doc.md"), "---\nid: doc\ntitle: Cookie guide\ncategory: concepts\nrelevance: cookie baking\n---\nBake a cookie.");
  writeFileSync(join(contentDir, "article.html"), "<html><head><title>Oven guide</title></head><body><h1>Oven guide</h1><p>Heat an oven before baking.</p></body></html>");
  configure();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(process, "exit").mockImplementation((code) => { throw new Error(`process.exit(${code})`); });
  for (const key of ["OPENAI_API_KEY", "GNOSYS_OPENAI_KEY", "GNOSYS_GLOBAL_OPENAI_KEY", "VOYAGE_API_KEY"]) vi.stubEnv(key, "audit-dummy-key");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Unexpected network request"); }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(baseDir, { recursive: true, force: true });
});

describe("web build-index output", () => {
  it("writes an index and quantized vectors for the requested provider and reports their location", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ embedding: [1, 0, -1] }] })));
    await runWebBuildIndexCommand(getWebStorePath, { stopWords: true, embeddings: "openai", embedModel: "audit-embedding", json: true });
    expect(readJson(indexFile())).toMatchObject({ documentCount: 1, documents: [{ id: "doc", title: "Cookie guide" }] });
    expect(readJson(vectorsFile())).toMatchObject({ model: "audit-embedding", dims: 3, vectors: { doc: [127, 0, -127] } });
    expect(JSON.parse(logged())).toMatchObject({ ok: true, documentCount: 1, vectors: { model: "audit-embedding", dims: 3, count: 1, outputPath: vectorsFile() } });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/embeddings");
  });

  it("rejects an invalid embeddings provider without creating an index or vectors", async () => {
    await expect(runWebBuildIndexCommand(getWebStorePath, { stopWords: true, embeddings: "bad-provider" })).rejects.toThrow("process.exit(1)");
    expect(errored()).toContain('Invalid embeddings provider "bad-provider". Valid providers: openai, voyage, local.');
    expect(readdirSync(knowledgeDir)).toEqual(["doc.md"]);
  });

  it("writes a searchable index when embeddings are absent", async () => {
    await runWebBuildIndexCommand(getWebStorePath, { stopWords: true, json: true });
    expect(readJson(indexFile())).toMatchObject({ version: 1, documentCount: 1, documents: [{ id: "doc", title: "Cookie guide" }], invertedIndex: { cookie: [{ docIndex: 0 }] } });
    expect(JSON.parse(logged())).toMatchObject({ ok: true, documentCount: 1, outputPath: indexFile() });
    expect(readdirSync(knowledgeDir).sort()).toEqual(["doc.md", "gnosys-index.json"]);
  });

  it("persists concept expansions returned by the configured LLM", async () => {
    configure(true);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: '{"cookie":["dessert"]}' } }] })));
    await runWebBuildIndexCommand(getWebStorePath, { stopWords: true });
    expect(readJson(indexFile())).toMatchObject({ version: 2, documentCount: 1, expansions: { cookie: ["dessert"] } });
  });

  it("writes a version-one index without contacting the LLM when expansions are disabled", async () => {
    configure(true);
    await runWebBuildIndexCommand(getWebStorePath, { stopWords: true, expansions: false });
    expect(readJson(indexFile())).toMatchObject({ version: 1, documentCount: 1, documents: [{ id: "doc" }] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("writes a version-one index when no LLM provider is configured", async () => {
    await runWebBuildIndexCommand(getWebStorePath, { stopWords: true });
    expect(readJson(indexFile())).toMatchObject({ version: 1, documentCount: 1, documents: [{ id: "doc" }] });
  });
});

describe("web build", () => {
  it("ingests local content and writes both search and Voyage vector artifacts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ embedding: [1, 0, -1] }, { embedding: [0, 1, -1] }] })));
    await runWebBuildCommand(getWebStorePath, { llm: false, concurrency: "1", embeddings: "voyage", embedModel: "voyage-audit", json: true });
    expect(readJson(indexFile())).toMatchObject({ documentCount: 2 });
    expect(readJson(indexFile())).toEqual(expect.objectContaining({ documents: expect.arrayContaining([expect.objectContaining({ title: "Oven guide" })]) }));
    expect(readJson(vectorsFile())).toMatchObject({ model: "voyage-audit", dims: 3, vectors: { doc: [127, 0, -127] } });
    expect(JSON.parse(logged())).toMatchObject({ errors: [], index: { documentCount: 2 }, vectors: { model: "voyage-audit", count: 2, dims: 3, outputPath: vectorsFile() } });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("https://api.voyageai.com/v1/embeddings");
  });

  it("reports a dry run and preserves existing index and vector bytes", async () => {
    writeFileSync(indexFile(), "existing index");
    writeFileSync(vectorsFile(), "existing vectors");
    await runWebBuildCommand(getWebStorePath, { llm: false, concurrency: "1", dryRun: true, embeddings: "openai", json: true });
    expect(JSON.parse(logged())).toMatchObject({ errors: [], updated: [], removed: [], index: { documentCount: 0, tokenCount: 0 } });
    expect(readFileSync(indexFile(), "utf8")).toBe("existing index");
    expect(readFileSync(vectorsFile(), "utf8")).toBe("existing vectors");
    expect(readdirSync(knowledgeDir).sort()).toEqual(["doc.md", "gnosys-index.json", "gnosys-vectors.json"]);
  });
});

describe("web status", () => {
  it("reports vector metadata and exact byte size in text and JSON output", async () => {
    const content = '{"model":"audit-vector","dims":3,"generated":"2026-07-08T00:00:00.000Z","vectors":{"doc":[1,2,3]}}';
    writeFileSync(vectorsFile(), content);
    await runWebStatusCommand(getWebStorePath, {});
    expect(logged()).toContain("Vectors: 1 docs, audit-vector (3d)");
    logSpy.mockClear();
    await runWebStatusCommand(getWebStorePath, { json: true });
    expect(JSON.parse(logged())).toMatchObject({ ok: true, totalFiles: 1, vectors: { exists: true, model: "audit-vector", dims: 3, count: 1, generated: "2026-07-08T00:00:00.000Z", size: 98 } });
  });

  it("reports a missing vectors file with a build hint", async () => {
    await runWebStatusCommand(getWebStorePath, {});
    expect(logged()).toContain("Vectors: not built (run 'gnosys web build-index --embeddings <provider>')");
    logSpy.mockClear();
    await runWebStatusCommand(getWebStorePath, { json: true });
    expect(JSON.parse(logged())).toMatchObject({ ok: true, totalFiles: 1, vectors: { exists: false } });
  });

  it("reports corrupt vector JSON with its exact byte size and no invented metadata", async () => {
    writeFileSync(vectorsFile(), "{not-json");
    await runWebStatusCommand(getWebStorePath, { json: true });
    expect(JSON.parse(logged())).toMatchObject({ ok: true, totalFiles: 1, vectors: { exists: true, size: 9 } });
    expect(JSON.parse(logged()).vectors).toEqual({ exists: true, size: 9 });
  });
});

it("creates web configuration non-interactively and prints the semantic search instructions", async () => {
  writeFileSync(join(storeDir, "gnosys.json"), "{}");
  const output = join(baseDir, "new-knowledge");
  await runWebInitCommand(getWebStorePath, { source: "directory", output, config: true, nonInteractive: true });
  expect(existsSync(output)).toBe(true);
  expect(readJson(join(storeDir, "gnosys.json"))).toMatchObject({ web: { source: "directory", outputDir: output } });
  expect(logged()).toContain("gnosys web build --embeddings openai");
  expect(logged()).toContain("docs/web-semantic-search.md");
});
