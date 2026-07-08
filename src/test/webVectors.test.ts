import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";

const embedBatchMock = vi.hoisted(() => vi.fn());
const localStorePaths = vi.hoisted((): string[] => []);

vi.mock("../lib/embeddings.js", () => ({
  GnosysEmbeddings: class {
    constructor(storePath: string) {
      localStorePaths.push(storePath);
    }

    embedBatch = embedBatchMock;
  },
}));

import {
  buildVectors,
  dequantizeVector,
  quantizeVector,
  writeVectorsFile,
  type WebVectorsFile,
} from "../lib/webVectors.js";

let tmpDir: string;
let envBackup: NodeJS.ProcessEnv;

function makeMd(
  filename: string,
  frontmatter: Record<string, unknown>,
  content: string,
  subdir?: string,
): void {
  const dir = subdir ? path.join(tmpDir, subdir) : tmpDir;
  fs.mkdirSync(dir, { recursive: true });

  const fmLines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      fmLines.push(`${key}:`);
      for (const item of value) fmLines.push(`  - ${item}`);
    } else {
      fmLines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  fmLines.push("---", "", content);

  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n"), "utf-8");
}

function mockFetchJson(payload: unknown, init?: { ok?: boolean; status?: number; statusText?: string }): void {
  vi.mocked(fetch).mockResolvedValue({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    text: async () => JSON.stringify(payload),
  } as Response);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-webvectors-"));
  envBackup = { ...process.env };
  vi.stubGlobal("fetch", vi.fn());
  embedBatchMock.mockReset();
  localStorePaths.length = 0;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GNOSYS_GLOBAL_OPENAI_KEY;
  delete process.env.GNOSYS_OPENAI_KEY;
  delete process.env.GNOSYS_LLM_API_KEY;
  delete process.env.VOYAGE_API_KEY;
});

afterEach(async () => {
  process.env = envBackup;
  vi.unstubAllGlobals();
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe("buildVectors API providers", () => {
  it("posts OpenAI embedding batches with configured headers and maps vectors by document id", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    makeMd("a.md", {
      id: "doc-a",
      title: "Agentic Automation",
      relevance: "automation agents",
      status: "active",
    }, "alpha beta gamma");
    makeMd("b.md", {
      id: "doc-b",
      title: "Readiness",
      relevance: "ai readiness",
      status: "active",
    }, "delta epsilon", "nested");

    mockFetchJson({
      data: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [-0.2, 0, 0.4] },
      ],
    });

    const vectors = await buildVectors(tmpDir, { provider: "openai" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer openai-test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init?.body)) as { model: string; input: string[] };
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.input).toHaveLength(2);
    expect(body.input[0]).toContain("Agentic Automation\nautomation agents\nalpha beta gamma");

    expect(vectors.version).toBe(1);
    expect(vectors.model).toBe("text-embedding-3-small");
    expect(vectors.dims).toBe(3);
    expect(vectors.quantization).toBe("int8");
    expect(vectors.scale).toBeCloseTo(0.4 / 127);
    expect(vectors.offset).toBe(0);
    expect(Object.keys(vectors.vectors).sort()).toEqual(["doc-a", "doc-b"]);
    expect(vectors.vectors["doc-a"]).toHaveLength(3);
    expect(vectors.vectors["doc-a"].every((value) => value >= -128 && value <= 127)).toBe(true);
  });

  it("posts Voyage embedding requests using VOYAGE_API_KEY only", async () => {
    process.env.VOYAGE_API_KEY = "voyage-test-key";
    makeMd("doc.md", { id: "voyage-doc", title: "Voyage Doc", relevance: "semantic", status: "active" }, "body");

    mockFetchJson({ data: [{ embedding: [1, 0, -1] }] });

    const vectors = await buildVectors(tmpDir, { provider: "voyage" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer voyage-test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "voyage-3-lite",
      input: ["Voyage Doc\nsemantic\nbody"],
    });
    expect(vectors.model).toBe("voyage-3-lite");
    expect(vectors.vectors["voyage-doc"]).toHaveLength(3);
  });

  it("throws when the OpenAI API key is missing", async () => {
    makeMd("doc.md", { id: "doc", title: "Doc", status: "active" }, "body");

    await expect(buildVectors(tmpDir, { provider: "openai" })).rejects.toThrow(/OpenAI embeddings require an API key/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws with status details when an API request fails", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    makeMd("doc.md", { id: "doc", title: "Doc", status: "active" }, "body");
    mockFetchJson({ error: { message: "bad request" } }, { ok: false, status: 500, statusText: "Server Error" });

    await expect(buildVectors(tmpDir, { provider: "openai" })).rejects.toThrow(
      /OpenAI embedding request failed \(500 Server Error\).*bad request/,
    );
  });
});

describe("buildVectors local provider", () => {
  it("reuses GnosysEmbeddings.embedBatch and quantizes local vectors", async () => {
    const storePath = path.join(tmpDir, ".gnosys");
    makeMd("a.md", { id: "local-a", title: "Local A", relevance: "alpha", status: "active" }, "body a");
    makeMd("b.md", { id: "local-b", title: "Local B", relevance: "beta", status: "active" }, "body b");
    embedBatchMock.mockResolvedValue([
      new Float32Array([0.25, 0.5]),
      new Float32Array([-0.5, 0]),
    ]);

    const vectors = await buildVectors(tmpDir, { provider: "local", storePath });

    expect(localStorePaths).toEqual([storePath]);
    expect(embedBatchMock).toHaveBeenCalledWith(["Local A\nalpha\nbody a", "Local B\nbeta\nbody b"]);
    expect(vectors.model).toBe("Xenova/all-MiniLM-L6-v2");
    expect(vectors.dims).toBe(2);
    expect(vectors.vectors["local-a"]).toEqual([64, 127]);
    expect(vectors.vectors["local-b"]).toEqual([-127, 0]);
  });
});

describe("int8 quantization", () => {
  it("round-trips vectors while preserving cosine ranking order for fixed fixtures", () => {
    const query = [0.92, 0.25, 0.12, 0.02];
    const vectors = [
      [0.95, 0.22, 0.08, 0.01],
      [0.78, 0.53, 0.18, 0.04],
      [0.38, 0.88, 0.12, 0.05],
      [-0.1, 0.96, 0.18, 0.02],
      [0.48, -0.12, 0.82, 0.24],
    ];
    const absMax = Math.max(...vectors.flat().map((value) => Math.abs(value)));
    const scale = absMax / 127;

    const floatRanking = vectors
      .map((vec, index) => ({ index, score: cosine(query, vec) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.index);
    const quantizedRanking = vectors
      .map((vec, index) => ({
        index,
        score: cosine(query, dequantizeVector(quantizeVector(vec, scale), scale)),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.index);

    expect(quantizedRanking).toEqual(floatRanking);
  });
});

describe("writeVectorsFile", () => {
  it("writes pretty JSON with the WebVectorsFile shape", async () => {
    const file: WebVectorsFile = {
      version: 1,
      model: "test-model",
      dims: 2,
      quantization: "int8",
      generated: new Date("2026-07-08T00:00:00.000Z").toISOString(),
      scale: 0.01,
      offset: 0,
      vectors: {
        a: [1, -1],
      },
    };

    const outputPath = await writeVectorsFile(tmpDir, file);
    const raw = await fsp.readFile(outputPath, "utf-8");
    const parsed = JSON.parse(raw) as WebVectorsFile;

    expect(outputPath).toBe(path.join(tmpDir, "gnosys-vectors.json"));
    expect(raw).toContain('\n  "version": 1,');
    expect(parsed).toEqual(file);
    expect(parsed.generated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.vectors.a.every((value) => Number.isInteger(value) && value >= -128 && value <= 127)).toBe(true);
  });
});
