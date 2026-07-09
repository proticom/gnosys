import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { GnosysWebIndex } from "../lib/staticSearch.js";

const mocks = vi.hoisted(() => ({
  attachExpansions: vi.fn(),
  buildIndex: vi.fn(),
  buildVectors: vi.fn(),
  generateExpansions: vi.fn(),
  getLLMProvider: vi.fn(),
  ingestSite: vi.fn(),
  loadConfig: vi.fn(),
  writeIndex: vi.fn(),
  writeVectorsFile: vi.fn(),
}));

vi.mock("../lib/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../lib/llm.js", () => ({
  getLLMProvider: mocks.getLLMProvider,
}));

vi.mock("../lib/webIndex.js", () => ({
  attachExpansions: mocks.attachExpansions,
  buildIndex: mocks.buildIndex,
  generateExpansions: mocks.generateExpansions,
  writeIndex: mocks.writeIndex,
}));

vi.mock("../lib/webIngest.js", () => ({
  ingestSite: mocks.ingestSite,
}));

vi.mock("../lib/webVectors.js", () => ({
  buildVectors: mocks.buildVectors,
  writeVectorsFile: mocks.writeVectorsFile,
}));

import { runWebBuildCommand } from "../lib/webBuildCommand.js";
import { runWebBuildIndexCommand } from "../lib/webBuildIndexCommand.js";
import { runWebStatusCommand } from "../lib/webStatusCommand.js";

let baseDir: string;
let storeDir: string;
let knowledgeDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

const getWebStorePath = async () => storeDir;
const logged = () => logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
const errored = () => errSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");

function makeIndex(overrides: Partial<GnosysWebIndex> = {}): GnosysWebIndex {
  return {
    version: 1,
    generated: "2026-07-08T00:00:00.000Z",
    documentCount: 2,
    documents: [],
    invertedIndex: {
      alpha: [{ docIndex: 0, score: 1 }],
      beta: [{ docIndex: 1, score: 1 }],
    },
    ...overrides,
  };
}

function makeConfig() {
  return {
    llm: { defaultProvider: "anthropic" },
    web: {
      source: "urls",
      outputDir: knowledgeDir,
      urls: ["https://example.com/docs"],
      exclude: [],
      categories: {},
      llmEnrich: true,
      prune: false,
      concurrency: 3,
    },
  };
}

function makeVectorsFile() {
  return {
    version: 1,
    model: "custom-embedding-model",
    dims: 3,
    quantization: "int8" as const,
    generated: "2026-07-08T00:00:00.000Z",
    scale: 0.01,
    offset: 0,
    vectors: {
      doc1: [1, 2, 3],
      doc2: [4, 5, 6],
    },
  };
}

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), "gnosys-web-command-vectors-"));
  storeDir = join(baseDir, "store");
  knowledgeDir = join(baseDir, "knowledge");
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });

  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);

  mocks.loadConfig.mockResolvedValue(makeConfig());
  mocks.buildIndex.mockResolvedValue(makeIndex());
  mocks.writeIndex.mockResolvedValue(undefined);
  mocks.generateExpansions.mockResolvedValue({});
  mocks.attachExpansions.mockImplementation((index, expansions) =>
    Object.keys(expansions ?? {}).length > 0
      ? { ...index, version: 2, expansions }
      : index
  );
  mocks.getLLMProvider.mockImplementation(() => null);
  mocks.ingestSite.mockResolvedValue({
    added: [],
    updated: [],
    unchanged: [],
    removed: [],
    errors: [],
    duration: 12,
  });
  mocks.buildVectors.mockResolvedValue(makeVectorsFile());
  mocks.writeVectorsFile.mockResolvedValue(join(knowledgeDir, "gnosys-vectors.json"));
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
  vi.clearAllMocks();
  rmSync(baseDir, { recursive: true, force: true });
});

describe("runWebBuildIndexCommand semantic options", () => {
  it("builds vectors for a valid embeddings provider and reports stats in JSON", async () => {
    await runWebBuildIndexCommand(getWebStorePath, {
      stopWords: true,
      embeddings: "openai",
      embedModel: "custom-embedding-model",
      json: true,
    });

    expect(mocks.buildVectors).toHaveBeenCalledWith(knowledgeDir, {
      provider: "openai",
      model: "custom-embedding-model",
      storePath: storeDir,
    });
    expect(mocks.writeVectorsFile).toHaveBeenCalledWith(knowledgeDir, makeVectorsFile());
    const parsed = JSON.parse(logged());
    expect(parsed.vectors).toEqual({
      model: "custom-embedding-model",
      dims: 3,
      count: 2,
      outputPath: join(knowledgeDir, "gnosys-vectors.json"),
    });
  });

  it("rejects an invalid embeddings provider before writing output", async () => {
    await expect(
      runWebBuildIndexCommand(getWebStorePath, {
        stopWords: true,
        embeddings: "bad-provider",
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(errored()).toContain('Invalid embeddings provider "bad-provider"');
    expect(mocks.writeIndex).not.toHaveBeenCalled();
    expect(mocks.buildVectors).not.toHaveBeenCalled();
  });

  it("does not build vectors when --embeddings is absent", async () => {
    await runWebBuildIndexCommand(getWebStorePath, {
      stopWords: true,
      json: true,
    });

    expect(mocks.buildVectors).not.toHaveBeenCalled();
    expect(JSON.parse(logged()).vectors).toBeUndefined();
  });

  it("generates and attaches expansions by default when a provider resolves", async () => {
    const provider = { generate: vi.fn() };
    const expanded = makeIndex({ version: 2, expansions: { dessert: ["cookie"] } });
    mocks.getLLMProvider.mockReturnValue(provider);
    mocks.generateExpansions.mockResolvedValue({ dessert: ["cookie"] });
    mocks.attachExpansions.mockReturnValue(expanded);

    await runWebBuildIndexCommand(getWebStorePath, {
      stopWords: true,
    });

    expect(mocks.getLLMProvider).toHaveBeenCalledWith(makeConfig(), "structuring");
    expect(mocks.generateExpansions).toHaveBeenCalledWith(makeIndex(), provider);
    expect(mocks.writeIndex).toHaveBeenCalledWith(expanded, join(knowledgeDir, "gnosys-index.json"));
  });

  it("honors --no-expansions and writes a v1 index", async () => {
    await runWebBuildIndexCommand(getWebStorePath, {
      stopWords: true,
      expansions: false,
    });

    expect(mocks.getLLMProvider).not.toHaveBeenCalled();
    expect(mocks.generateExpansions).not.toHaveBeenCalled();
    expect(mocks.writeIndex).toHaveBeenCalledWith(makeIndex(), join(knowledgeDir, "gnosys-index.json"));
  });

  it("skips expansions without crashing when no LLM provider is resolvable", async () => {
    mocks.getLLMProvider.mockImplementation(() => {
      throw new Error("missing key");
    });

    await runWebBuildIndexCommand(getWebStorePath, {
      stopWords: true,
    });

    expect(mocks.generateExpansions).not.toHaveBeenCalled();
    expect(mocks.writeIndex).toHaveBeenCalledWith(makeIndex(), join(knowledgeDir, "gnosys-index.json"));
  });
});

describe("runWebBuildCommand semantic options", () => {
  it("threads vector options through the full build command", async () => {
    await runWebBuildCommand(getWebStorePath, {
      llm: true,
      concurrency: "3",
      embeddings: "voyage",
      embedModel: "voyage-custom",
      json: true,
    });

    expect(mocks.ingestSite).toHaveBeenCalledWith(
      expect.objectContaining({
        outputDir: knowledgeDir,
        llmEnrich: true,
      }),
      makeConfig(),
    );
    expect(mocks.buildVectors).toHaveBeenCalledWith(knowledgeDir, {
      provider: "voyage",
      model: "voyage-custom",
      storePath: storeDir,
    });
    expect(JSON.parse(logged()).vectors).toMatchObject({
      model: "custom-embedding-model",
      dims: 3,
      count: 2,
    });
  });

  it("skips index and vector generation during dry runs", async () => {
    await runWebBuildCommand(getWebStorePath, {
      llm: true,
      concurrency: "3",
      dryRun: true,
      embeddings: "openai",
      json: true,
    });

    expect(mocks.ingestSite).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
      makeConfig(),
    );
    expect(mocks.buildIndex).not.toHaveBeenCalled();
    expect(mocks.writeIndex).not.toHaveBeenCalled();
    expect(mocks.buildVectors).not.toHaveBeenCalled();
    expect(JSON.parse(logged()).vectors).toBeUndefined();
  });
});

describe("runWebStatusCommand vector reporting", () => {
  it("reports vector model, dimensions, count, and size in text and JSON output", async () => {
    writeFileSync(join(knowledgeDir, "doc.md"), "---\nid: doc\n---\nBody", "utf-8");
    writeFileSync(
      join(knowledgeDir, "gnosys-vectors.json"),
      JSON.stringify({
        model: "text-embedding-3-small",
        dims: 1536,
        generated: "2026-07-08T00:00:00.000Z",
        vectors: { doc: [1], other: [2] },
      }),
      "utf-8",
    );

    await runWebStatusCommand(getWebStorePath, {});
    expect(logged()).toContain("Vectors: 2 docs, text-embedding-3-small (1536d)");

    logSpy.mockClear();
    await runWebStatusCommand(getWebStorePath, { json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.vectors).toMatchObject({
      exists: true,
      model: "text-embedding-3-small",
      dims: 1536,
      count: 2,
      generated: "2026-07-08T00:00:00.000Z",
    });
    expect(parsed.vectors.size).toBeGreaterThan(0);
  });

  it("reports a missing vectors file with a build hint", async () => {
    await runWebStatusCommand(getWebStorePath, {});
    expect(logged()).toContain("Vectors: not built (run 'gnosys web build-index --embeddings <provider>')");

    logSpy.mockClear();
    await runWebStatusCommand(getWebStorePath, { json: true });
    expect(JSON.parse(logged()).vectors).toEqual({ exists: false });
  });

  it("reports corrupt vector JSON as present with size only", async () => {
    writeFileSync(join(knowledgeDir, "gnosys-vectors.json"), "{not-json", "utf-8");

    await runWebStatusCommand(getWebStorePath, { json: true });

    const parsed = JSON.parse(logged());
    expect(parsed.vectors.exists).toBe(true);
    expect(parsed.vectors.size).toBeGreaterThan(0);
    expect(parsed.vectors.model).toBeUndefined();
    expect(parsed.vectors.count).toBeUndefined();
  });
});

describe("web init semantic search tip", () => {
  it("keeps the init wizard non-interactive while mentioning the embeddings option", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync(join(process.cwd(), "src/lib/webInitCommand.ts"), "utf-8")
    );

    expect(source).toContain("gnosys web build --embeddings openai");
    expect(source).toContain("docs/web-semantic-search.md");
  });
});
