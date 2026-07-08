/**
 * Gnosys Web Vectors - build-time semantic vector generator.
 *
 * This module is intentionally build-time only. The zero-dependency
 * `gnosys/web` runtime must not import it because the local provider reaches
 * into the optional embeddings stack.
 */

import fs from "fs/promises";
import type { Dirent } from "fs";
import path from "path";
import matter from "gray-matter";
import { getOpenAIApiKey, getOpenAIBaseUrl, loadConfig } from "./config.js";
import { GnosysEmbeddings } from "./embeddings.js";

export type VectorProvider = "openai" | "voyage" | "local";

export interface WebVectorsFile {
  version: 1;
  model: string;
  dims: number;
  quantization: "int8";
  generated: string;
  scale: number;
  offset: number;
  vectors: Record<string, number[]>;
}

export interface BuildVectorsOptions {
  provider: VectorProvider;
  model?: string;
  apiKey?: string;
  storePath?: string;
}

interface KnowledgeDocForEmbedding {
  id: string;
  title: string;
  relevance: string;
  body: string;
}

const VECTOR_FILE_NAME = "gnosys-vectors.json";
const MAX_BODY_TOKENS = 512;
const API_BATCH_SIZE = 96;

const DEFAULT_OPENAI_MODEL = "text-embedding-3-small";
const DEFAULT_VOYAGE_MODEL = "voyage-3-lite";
const DEFAULT_LOCAL_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Symmetric global int8 quantization. One scale/offset pair is recorded for
 * the whole file so the runtime can dequantize without per-vector metadata.
 */
export function quantizeVector(vec: number[], scale: number): number[] {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("Cannot quantize vector with a non-positive scale");
  }

  return vec.map((value) => clampInt8(Math.round(value / scale)));
}

export function dequantizeVector(qvec: number[], scale: number): number[] {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("Cannot dequantize vector with a non-positive scale");
  }

  return qvec.map((value) => value * scale);
}

export async function buildVectors(
  knowledgeDir: string,
  options: BuildVectorsOptions,
): Promise<WebVectorsFile> {
  const docs = await readKnowledgeDocs(knowledgeDir);
  const model = modelForProvider(options);

  if (docs.length === 0) {
    return {
      version: 1,
      model,
      dims: 0,
      quantization: "int8",
      generated: new Date().toISOString(),
      scale: 1,
      offset: 0,
      vectors: {},
    };
  }

  const texts = docs.map((doc) => embeddingText(doc));
  const embeddings = await embedTexts(texts, options, model);
  const dims = validateEmbeddings(embeddings, docs.length);
  const scale = computeGlobalScale(embeddings);
  const vectors: Record<string, number[]> = {};

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (vectors[doc.id]) {
      throw new Error(`Duplicate web knowledge document id: ${doc.id}`);
    }
    vectors[doc.id] = quantizeVector(embeddings[i], scale);
  }

  return {
    version: 1,
    model,
    dims,
    quantization: "int8",
    generated: new Date().toISOString(),
    scale,
    offset: 0,
    vectors,
  };
}

export async function writeVectorsFile(
  knowledgeDir: string,
  vectorsFile: WebVectorsFile,
): Promise<string> {
  const outputPath = path.join(knowledgeDir, VECTOR_FILE_NAME);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(vectorsFile, null, 2), "utf-8");
  return outputPath;
}

async function readKnowledgeDocs(knowledgeDir: string): Promise<KnowledgeDocForEmbedding[]> {
  const resolvedDir = path.resolve(knowledgeDir);
  const files = await findMarkdownFiles(resolvedDir);
  const docs: KnowledgeDocForEmbedding[] = [];

  for (const filePath of files) {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch {
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;
    const status = typeof fm.status === "string" ? fm.status : "active";
    if (status === "archived") continue;

    docs.push({
      id: typeof fm.id === "string" ? fm.id : path.basename(filePath, ".md"),
      title: typeof fm.title === "string" ? fm.title : path.basename(filePath, ".md"),
      relevance: typeof fm.relevance === "string" ? fm.relevance : "",
      body: parsed.content.trim(),
    });
  }

  return docs;
}

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

function embeddingText(doc: KnowledgeDocForEmbedding): string {
  const cappedBody = doc.body.split(/\s+/).filter(Boolean).slice(0, MAX_BODY_TOKENS).join(" ");
  return `${doc.title}\n${doc.relevance}\n${cappedBody}`;
}

function modelForProvider(options: BuildVectorsOptions): string {
  if (options.model) return options.model;

  switch (options.provider) {
    case "openai":
      return DEFAULT_OPENAI_MODEL;
    case "voyage":
      return DEFAULT_VOYAGE_MODEL;
    case "local":
      return DEFAULT_LOCAL_MODEL;
  }
}

async function embedTexts(
  texts: string[],
  options: BuildVectorsOptions,
  model: string,
): Promise<number[][]> {
  switch (options.provider) {
    case "openai":
      return embedOpenAI(texts, options, model);
    case "voyage":
      return embedVoyage(texts, options, model);
    case "local":
      return embedLocal(texts, options);
  }
}

async function embedOpenAI(
  texts: string[],
  options: BuildVectorsOptions,
  model: string,
): Promise<number[][]> {
  const config = await loadConfig(options.storePath ?? process.cwd());
  const apiKey = options.apiKey || getOpenAIApiKey(config) || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI embeddings require an API key. Set OPENAI_API_KEY or configure an OpenAI key in Gnosys.");
  }

  const endpoint = `${getOpenAIBaseUrl(config).replace(/\/+$/, "")}/embeddings`;
  return embedApiBatches("OpenAI", endpoint, apiKey, texts, model);
}

async function embedVoyage(
  texts: string[],
  options: BuildVectorsOptions,
  model: string,
): Promise<number[][]> {
  // Voyage is not part of the Gnosys config schema yet; for now it is env-only.
  const apiKey = options.apiKey || process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Voyage embeddings require an API key. Set VOYAGE_API_KEY.");
  }

  return embedApiBatches("Voyage", "https://api.voyageai.com/v1/embeddings", apiKey, texts, model);
}

async function embedApiBatches(
  providerName: "OpenAI" | "Voyage",
  endpoint: string,
  apiKey: string,
  texts: string[],
  model: string,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += API_BATCH_SIZE) {
    const input = texts.slice(i, i + API_BATCH_SIZE);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      const detail = bodyText ? `: ${bodyText.slice(0, 500)}` : "";
      throw new Error(`${providerName} embedding request failed (${response.status} ${response.statusText})${detail}`);
    }

    embeddings.push(...parseEmbeddingResponse(providerName, bodyText));
  }

  return embeddings;
}

async function embedLocal(
  texts: string[],
  options: BuildVectorsOptions,
): Promise<number[][]> {
  const embeddings = new GnosysEmbeddings(options.storePath ?? path.resolve(process.cwd(), ".gnosys"));
  const vectors = await embeddings.embedBatch(texts);
  return vectors.map((vec) => Array.from(vec));
}

function parseEmbeddingResponse(providerName: string, bodyText: string): number[][] {
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error(`${providerName} embedding response was not valid JSON`);
  }

  if (!isEmbeddingPayload(payload)) {
    throw new Error(`${providerName} embedding response did not include data[].embedding arrays`);
  }

  return payload.data.map((entry) => entry.embedding);
}

function isEmbeddingPayload(payload: unknown): payload is { data: Array<{ embedding: number[] }> } {
  if (typeof payload !== "object" || payload === null) return false;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return false;
  return data.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const embedding = (entry as { embedding?: unknown }).embedding;
    return Array.isArray(embedding) && embedding.every((value) => typeof value === "number" && Number.isFinite(value));
  });
}

function validateEmbeddings(embeddings: number[][], expectedCount: number): number {
  if (embeddings.length !== expectedCount) {
    throw new Error(`Embedding provider returned ${embeddings.length} vectors for ${expectedCount} documents`);
  }

  const dims = embeddings[0]?.length ?? 0;
  if (dims === 0) {
    throw new Error("Embedding provider returned empty vectors");
  }

  for (const vec of embeddings) {
    if (vec.length !== dims) {
      throw new Error("Embedding provider returned vectors with inconsistent dimensions");
    }
  }

  return dims;
}

function computeGlobalScale(embeddings: number[][]): number {
  let absMax = 0;
  for (const vec of embeddings) {
    for (const value of vec) {
      absMax = Math.max(absMax, Math.abs(value));
    }
  }
  return absMax > 0 ? absMax / 127 : 1;
}

function clampInt8(value: number): number {
  return Math.max(-128, Math.min(127, value));
}
