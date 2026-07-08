/**
 * Gnosys Web — Zero-dependency runtime search module.
 *
 * Exported as `gnosys/web` subpath. Loads a pre-computed gnosys-index.json
 * and provides search functions for serverless chatbot integrations.
 *
 * CRITICAL: This module must have ZERO dependencies beyond Node.js built-ins.
 * No better-sqlite3, no gray-matter, no @anthropic-ai/sdk, nothing.
 */

import { readFileSync, existsSync } from "fs";

// ─── Types ───────────────────────────────────────────────────────────────

export interface GnosysWebIndex {
  version: number;
  generated: string;
  documentCount: number;
  documents: DocumentManifest[];
  invertedIndex: Record<string, IndexEntry[]>;
}

// Mirrors the gnosys-vectors.json format emitted by webVectors.ts. Keep this
// inline so the zero-dependency gnosys/web runtime never imports build-time code.
export interface GnosysWebVectors {
  version: number;
  model: string;
  dims: number;
  quantization: "int8";
  generated: string;
  scale: number;
  offset: number;
  vectors: Record<string, number[]>;
}

export interface DocumentManifest {
  id: string;
  path: string;
  title: string;
  category: string;
  tags: string[];
  relevance: string;
  contentHash: string;
  contentLength: number;
  created: string | null;
  status: string;
}

export interface IndexEntry {
  docIndex: number;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  category?: string;
  tags?: string[];
  boostRecent?: boolean;
  queryVector?: number[];
  vectors?: GnosysWebVectors;
  expectedModel?: string;
}

export interface SearchResult {
  document: DocumentManifest;
  score: number;
  matchedTokens: string[];
  semanticScore?: number;
}

// ─── Module-level cache ──────────────────────────────────────────────────

let cachedIndex: GnosysWebIndex | null = null;
let cachedSource: string | null = null;
let cachedVectors: GnosysWebVectors | null = null;
let cachedVectorsSource: string | null = null;

const RRF_K = 60;

// ─── Stop words (same list used by webIndex.ts at build time) ────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "been", "has", "had", "have", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "this", "that",
  "these", "those", "not", "no", "nor", "so", "if", "then", "than",
  "too", "very", "just", "about", "above", "after", "again", "all",
  "also", "am", "any", "because", "before", "between", "both", "each",
  "few", "he", "she", "her", "him", "his", "how", "its", "me", "more",
  "most", "my", "new", "now", "only", "other", "our", "out", "own",
  "re", "same", "some", "such", "up", "us", "we", "what", "when",
  "where", "which", "who", "whom", "why", "you", "your",
]);

// ─── Tokenization ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Load a pre-computed Gnosys web index from a file path or raw JSON string.
 * Caches the result for repeated calls with the same source.
 */
export function loadIndex(pathOrJson: string): GnosysWebIndex {
  if (cachedIndex && cachedSource === pathOrJson) {
    return cachedIndex;
  }

  let raw: string;
  if (pathOrJson.trimStart().startsWith("{")) {
    raw = pathOrJson;
  } else {
    if (!existsSync(pathOrJson)) {
      throw new Error(`Gnosys web index not found: ${pathOrJson}`);
    }
    raw = readFileSync(pathOrJson, "utf-8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in Gnosys web index");
  }

  const index = parsed as GnosysWebIndex;

  if (!index.version || typeof index.version !== "number") {
    throw new Error("Invalid Gnosys web index: missing or invalid version field");
  }

  if (index.version > 1) {
    throw new Error(
      `Gnosys web index version ${index.version} is not supported by this version of gnosys/web. ` +
        `Please update the gnosys package.`
    );
  }

  cachedIndex = index;
  cachedSource = pathOrJson;
  return index;
}

/**
 * Load pre-computed Gnosys web vectors from a file path or raw JSON string.
 * Caches the result for repeated calls with the same source.
 */
export function loadVectors(pathOrJson: string): GnosysWebVectors {
  if (cachedVectors && cachedVectorsSource === pathOrJson) {
    return cachedVectors;
  }

  let raw: string;
  if (pathOrJson.trimStart().startsWith("{")) {
    raw = pathOrJson;
  } else {
    if (!existsSync(pathOrJson)) {
      throw new Error(`Gnosys web vectors not found: ${pathOrJson}`);
    }
    raw = readFileSync(pathOrJson, "utf-8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in Gnosys web vectors");
  }

  const vectors = validateVectorsFile(parsed);

  cachedVectors = vectors;
  cachedVectorsSource = pathOrJson;
  return vectors;
}

/**
 * Clear the cached index (useful for testing).
 */
export function clearIndexCache(): void {
  cachedIndex = null;
  cachedSource = null;
}

/**
 * Clear the cached vectors file (useful for testing).
 */
export function clearVectorsCache(): void {
  cachedVectors = null;
  cachedVectorsSource = null;
}

/**
 * Cosine similarity for equal-dimension vectors. Returns 0 for zero-magnitude
 * vectors or dimension mismatches.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Search the pre-computed index and return ranked results.
 */
export function search(
  index: GnosysWebIndex,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const {
    limit = 6,
    minScore = 0.1,
    category,
    tags,
    boostRecent = false,
    queryVector,
    vectors,
    expectedModel,
  } = options;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const lexicalOptions = { limit, minScore, category, tags, boostRecent };

  if (!queryVector || !vectors) {
    return stripDocIndexes(buildLexicalResults(index, queryTokens, lexicalOptions));
  }

  if (expectedModel && expectedModel !== vectors.model) {
    console.warn(
      `[gnosys/web] embedding model mismatch: index built with ${vectors.model}; ` +
        `query uses ${expectedModel} - falling back to lexical search`
    );
    return stripDocIndexes(buildLexicalResults(index, queryTokens, lexicalOptions));
  }

  if (queryVector.length !== vectors.dims) {
    console.warn(
      `[gnosys/web] embedding dimension mismatch: index built with ${vectors.dims} dimensions; ` +
        `query has ${queryVector.length} - falling back to lexical search`
    );
    return stripDocIndexes(buildLexicalResults(index, queryTokens, lexicalOptions));
  }

  // For hybrid fusion, minScore is intentionally not applied: RRF scores are
  // rank-based and much smaller than lexical TF-IDF scores.
  const lexicalRanking = buildLexicalResults(index, queryTokens, {
    limit: Number.POSITIVE_INFINITY,
    minScore: Number.NEGATIVE_INFINITY,
    category,
    tags,
    boostRecent,
  });
  const semanticRanking = buildSemanticRanking(index, queryVector, vectors, category, tags);

  return rrfFusion(lexicalRanking, semanticRanking).slice(0, limit);
}

interface LexicalSearchOptions {
  limit: number;
  minScore: number;
  category?: string;
  tags?: string[];
  boostRecent: boolean;
}

interface LexicalSearchResult extends SearchResult {
  docIndex: number;
}

interface SemanticSearchResult {
  docIndex: number;
  document: DocumentManifest;
  semanticScore: number;
}

function buildLexicalResults(
  index: GnosysWebIndex,
  queryTokens: string[],
  options: LexicalSearchOptions
): LexicalSearchResult[] {
  const { limit, minScore, category, tags, boostRecent } = options;

  // Accumulate scores per document
  const docScores = new Map<number, { score: number; matchedTokens: string[] }>();

  for (const token of queryTokens) {
    const entries = index.invertedIndex[token];
    if (!entries) continue;

    for (const entry of entries) {
      const existing = docScores.get(entry.docIndex);
      if (existing) {
        existing.score += entry.score;
        if (!existing.matchedTokens.includes(token)) {
          existing.matchedTokens.push(token);
        }
      } else {
        docScores.set(entry.docIndex, {
          score: entry.score,
          matchedTokens: [token],
        });
      }
    }
  }

  // Build results with filters
  const results: LexicalSearchResult[] = [];

  for (const [docIndex, { score, matchedTokens }] of docScores) {
    const doc = index.documents[docIndex];
    if (!doc) continue;

    // Apply filters
    if (category && doc.category !== category) continue;
    if (tags && tags.length > 0 && !tags.some((t) => doc.tags.includes(t))) continue;

    let finalScore = score;

    // Optional recency boost
    if (boostRecent && doc.created) {
      const ageMs = Date.now() - new Date(doc.created).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      // Boost documents less than 30 days old, max 1.5x
      if (ageDays < 30) {
        finalScore *= 1 + 0.5 * (1 - ageDays / 30);
      }
    }

    if (finalScore < minScore) continue;

    results.push({ document: doc, score: finalScore, matchedTokens, docIndex });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

function buildSemanticRanking(
  index: GnosysWebIndex,
  queryVector: number[],
  vectors: GnosysWebVectors,
  category?: string,
  tags?: string[]
): SemanticSearchResult[] {
  const docIndexById = new Map<string, number>();
  for (let i = 0; i < index.documents.length; i++) {
    docIndexById.set(index.documents[i].id, i);
  }

  const results: SemanticSearchResult[] = [];

  for (const [docId, quantizedVector] of Object.entries(vectors.vectors)) {
    const docIndex = docIndexById.get(docId);
    if (docIndex === undefined) continue;
    if (!Array.isArray(quantizedVector) || quantizedVector.length !== vectors.dims) continue;

    const doc = index.documents[docIndex];
    if (!doc) continue;
    if (category && doc.category !== category) continue;
    if (tags && tags.length > 0 && !tags.some((t) => doc.tags.includes(t))) continue;

    const docVector = quantizedVector.map((value) => value * vectors.scale + vectors.offset);
    const semanticScore = cosineSimilarity(queryVector, docVector);
    if (!Number.isFinite(semanticScore)) continue;

    results.push({ docIndex, document: doc, semanticScore });
  }

  results.sort((a, b) => b.semanticScore - a.semanticScore);
  return results;
}

function rrfFusion(
  lexicalResults: LexicalSearchResult[],
  semanticResults: SemanticSearchResult[]
): SearchResult[] {
  const fused = new Map<
    number,
    {
      score: number;
      document: DocumentManifest;
      matchedTokens: string[];
      semanticScore?: number;
    }
  >();

  for (let i = 0; i < lexicalResults.length; i++) {
    const result = lexicalResults[i];
    fused.set(result.docIndex, {
      score: 1 / (RRF_K + i + 1),
      document: result.document,
      matchedTokens: result.matchedTokens,
    });
  }

  for (let i = 0; i < semanticResults.length; i++) {
    const result = semanticResults[i];
    const rrfScore = 1 / (RRF_K + i + 1);
    const existing = fused.get(result.docIndex);

    if (existing) {
      existing.score += rrfScore;
      existing.semanticScore = result.semanticScore;
    } else {
      fused.set(result.docIndex, {
        score: rrfScore,
        document: result.document,
        matchedTokens: [],
        semanticScore: result.semanticScore,
      });
    }
  }

  return Array.from(fused.values()).sort((a, b) => b.score - a.score);
}

function stripDocIndexes(results: LexicalSearchResult[]): SearchResult[] {
  return results.map((result) => ({
    document: result.document,
    score: result.score,
    matchedTokens: result.matchedTokens,
  }));
}

function validateVectorsFile(parsed: unknown): GnosysWebVectors {
  if (!isRecord(parsed)) {
    throw new Error("Invalid Gnosys web vectors: expected an object");
  }

  const version = parsed.version;
  if (typeof version !== "number") {
    throw new Error("Invalid Gnosys web vectors: missing or invalid version field");
  }

  if (version !== 1) {
    throw new Error(
      `Gnosys web vectors version ${version} is not supported by this version of gnosys/web. ` +
        `Please update the gnosys package.`
    );
  }

  if (typeof parsed.model !== "string") {
    throw new Error("Invalid Gnosys web vectors: missing or invalid model field");
  }

  if (typeof parsed.dims !== "number" || !Number.isFinite(parsed.dims) || parsed.dims < 0) {
    throw new Error("Invalid Gnosys web vectors: missing or invalid dims field");
  }

  if (parsed.quantization !== "int8") {
    throw new Error("Invalid Gnosys web vectors: quantization must be int8");
  }

  if (typeof parsed.generated !== "string") {
    throw new Error("Invalid Gnosys web vectors: missing or invalid generated field");
  }

  if (typeof parsed.scale !== "number" || !Number.isFinite(parsed.scale) || parsed.scale <= 0) {
    throw new Error("Invalid Gnosys web vectors: missing or invalid scale field");
  }

  if (typeof parsed.offset !== "number" || !Number.isFinite(parsed.offset)) {
    throw new Error("Invalid Gnosys web vectors: missing or invalid offset field");
  }

  if (!isRecord(parsed.vectors)) {
    throw new Error("Invalid Gnosys web vectors: missing or invalid vectors field");
  }

  for (const [docId, vector] of Object.entries(parsed.vectors)) {
    if (!Array.isArray(vector) || !vector.every((value) => typeof value === "number")) {
      throw new Error(`Invalid Gnosys web vectors: vector for ${docId} must be a number array`);
    }
  }

  return {
    version,
    model: parsed.model,
    dims: parsed.dims,
    quantization: parsed.quantization,
    generated: parsed.generated,
    scale: parsed.scale,
    offset: parsed.offset,
    vectors: parsed.vectors as Record<string, number[]>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Get a specific document's metadata by ID or path.
 */
export function getDocument(
  index: GnosysWebIndex,
  idOrPath: string
): DocumentManifest | null {
  return (
    index.documents.find(
      (d) => d.id === idOrPath || d.path === idOrPath
    ) ?? null
  );
}

/**
 * List all documents, optionally filtered by category, tags, or status.
 */
export function listDocuments(
  index: GnosysWebIndex,
  filter?: { category?: string; tags?: string[]; status?: string }
): DocumentManifest[] {
  if (!filter) return [...index.documents];

  return index.documents.filter((d) => {
    if (filter.category && d.category !== filter.category) return false;
    if (filter.tags && filter.tags.length > 0 && !filter.tags.some((t) => d.tags.includes(t)))
      return false;
    if (filter.status && d.status !== filter.status) return false;
    return true;
  });
}
