import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";

register();

const { values } = parseArgs({ options: {
  db: { type: "string" },
  state: { type: "string" },
  "source-root": { type: "string", default: process.cwd() },
  mode: { type: "string", default: "badtype" },
  runs: { type: "string", default: "2" },
  cap: { type: "string", default: "100" },
} });
if (!["badtype", "valid", "none", "cover", "static"].includes(values.mode)) {
  throw new Error("Usage: node scripts/check-dream-review.mjs [--db COPY.db] [--state dream-state.json] [--source-root PATH] [--mode badtype|valid|none|cover|static] [--runs 2] [--cap 100]");
}
const runs = Number(values.runs);
const cap = Number(values.cap);
assert(Number.isInteger(runs) && runs > 0);
assert(Number.isInteger(cap) && cap > 0);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dream-review-"));
const store = path.join(scratch, "store");
const stateDir = path.join(scratch, "state");
fs.mkdirSync(store);
fs.mkdirSync(stateDir);
const copiedDb = path.join(store, "gnosys.db");
if (values.db) {
  fs.copyFileSync(values.db, copiedDb);
  if (fs.existsSync(`${values.db}-wal`)) fs.copyFileSync(`${values.db}-wal`, `${copiedDb}-wal`);
}
const stateFile = path.join(stateDir, "dream-state.json");
if (values.state) fs.copyFileSync(values.state, stateFile);
else fs.writeFileSync(stateFile, JSON.stringify({ analyzedFingerprints: {} }));
process.env.GNOSYS_HOME = stateDir;
process.env.GNOSYS_CONFIG_DIR = path.join(scratch, "config");
process.env.GNOSYS_LOCAL_ONLY = "1";
process.env.HF_HOME = path.join(scratch, "cache");
process.env.TRANSFORMERS_CACHE = path.join(scratch, "cache");

const sourceModule = (name) => import(pathToFileURL(path.join(values["source-root"], "src/lib", `${name}.ts`)).href);
const [{ GnosysDB }, { GnosysDreamEngine, DEFAULT_DREAM_CONFIG }, { DEFAULT_CONFIG }] = await Promise.all([
  sourceModule("db"), sourceModule("dream"), sourceModule("config"),
]);
const db = new GnosysDB(store);
assert.equal(db.isAvailable(), true);
if (!values.db) {
  const timestamp = new Date().toISOString();
  for (let index = 0; index < 60; index++) {
    const id = `fixture-${String(index).padStart(3, "0")}`;
    db.insertMemory({
      id, title: `Review fixture ${index}`, category: "general",
      content: `Review fixture ${index} records a distinct decision.`, summary: null,
      tags: "[]", relevance: "review fixture", author: "ai", authority: "declared",
      confidence: 0.9, reinforcement_count: 0, content_hash: id, status: "active",
      tier: "active", supersedes: null, superseded_by: null, last_reinforced: null,
      created: timestamp, modified: timestamp, embedding: null,
      source_path: null, source_file: null, source_page: null, source_timerange: null,
      attachment_data: null, attachment_mime: null, attachment_name: null,
      project_id: null, scope: "global",
    });
  }
}
db.countMemoriesMissingEmbedding = () => 0;
const before = db.getActiveMemories();
const protectedContentDigest = (memories) => crypto.createHash("sha256")
  .update(JSON.stringify(memories.map(({ id, title, content }) => ({ id, title, content })).sort((a, b) => a.id.localeCompare(b.id))))
  .digest("hex");
const protectedBefore = protectedContentDigest(before);
const coverageMode = values.mode === "cover" || values.mode === "static";
if (coverageMode) {
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const lastAnalyzedAt = new Date(Date.now() - 86_400_000).toISOString();
  const sourceText = (memory) => `[${memory.id}] "${memory.title}" — ${memory.content.substring(0, 200)}`;
  const corpusText = [...before].sort((a, b) => a.id.localeCompare(b.id)).map((memory) =>
    `[${memory.id}] ${memory.title} (${memory.category}) — ${(memory.relevance || "").substring(0, 80)} — ${memory.content.substring(0, 80)}\n${sourceText(memory)}`
  ).join("\n");
  const corpusHash = values.mode === "static" ? crypto.createHash("sha256").update(corpusText).digest("hex").slice(0, 24) : "old";
  for (const key of Object.keys(state.analyzedFingerprints)) {
    if (key.startsWith("relationship")) delete state.analyzedFingerprints[key];
  }
  for (const memory of before) {
    const hash = crypto.createHash("sha256").update(sourceText(memory)).digest("hex").slice(0, 24);
    state.analyzedFingerprints[`relationship-source:${hash}:corpus:${corpusHash}`] = {
      kind: "relationship", lastAnalyzedAt, memoryIds: [memory.id],
    };
  }
  fs.writeFileSync(stateFile, JSON.stringify(state));
}
const output = [];
let previousPicked = [];
try {
  for (let run = 1; run <= runs; run++) {
    if (values.mode === "cover" && run > 1) {
      const unrelated = [...before].sort((a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id))
        .find((memory) => !previousPicked.includes(memory.id));
      assert(unrelated);
      db.updateMemory(unrelated.id, { relevance: `Simulation corpus change ${run}` });
    }
    const calls = {};
    const engine = new GnosysDreamEngine(db, DEFAULT_CONFIG, {
      ...DEFAULT_DREAM_CONFIG, enabled: true, provider: "ollama", maxLLMCallsPerRun: cap,
      ...(coverageMode ? { selfCritique: false, generateSummaries: false } : {}),
    }, { stateDir });
    engine.provider = {
      name: "ollama", model: "simulation",
      async generate(prompt) {
        const kind = prompt.startsWith("You are a knowledge graph") ? "relationships" : prompt.includes("Category summary:") ? "summaries" : "critique";
        calls[kind] = (calls[kind] || 0) + 1;
        if (kind === "summaries") return "Simulation summary";
        if (kind === "critique") return '{"action":"ok"}';
        if (coverageMode) return "[]";
        if (values.mode === "none") return "No relationships found.";
        const [sourceText, indexText] = prompt.split("Full memory index:");
        const ids = (text) => [...text.matchAll(/^\[([^\]]+)\]/gm)].map((match) => match[1]);
        const candidates = ids(indexText);
        const relationships = ids(sourceText).map((id) => ({
          source_id: id, target_id: candidates.find((candidate) => candidate !== id),
          rel_type: "related_to", label: "simulation", confidence: 0.8,
        }));
        if (values.mode === "badtype") relationships[0].rel_type = "causes";
        return JSON.stringify(relationships);
      },
    };
    const stateBytesBefore = fs.statSync(stateFile).size;
    const report = await engine.dream();
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const picked = report.llmCalls.filter((call) => call.phase === "relationships" && call.status === "made").flatMap((call) => call.memoryIds);
    const newest = db.getActiveMemories().sort((a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id)).slice(0, 30).map((memory) => memory.id);
    output.push({
      run, calls, relationshipsSaved: report.relationshipsDiscovered,
      errors: report.errors.map((error) => error.replace(/\s+/g, " ").slice(0, 300)),
      errorLengths: report.errors.map((error) => error.length), warnings: report.warnings ?? [],
      sourcesPicked: picked.length, picked, overlapPrevious: picked.filter((id) => previousPicked.includes(id)).length,
      pickedEqualsNewest30: picked.length === 30 && picked.every((id) => newest.includes(id)),
      stateBytes: [stateBytesBefore, fs.statSync(stateFile).size],
      sourceFingerprints: Object.keys(state.analyzedFingerprints).filter((key) => key.startsWith("relationship-source:")).length,
      lastSuccessfulRunAt: state.lastSuccessfulRunAt ?? null,
    });
    assert.equal(protectedContentDigest(db.getActiveMemories()), protectedBefore, "Memory IDs, titles, or content changed");
    if (!values.db && values.mode === "badtype" && cap >= 100 && run <= 2) {
      assert.equal(report.relationshipsDiscovered, 24);
      assert.deepEqual(report.errors, []);
      assert.equal(report.warnings.length, 6);
      for (const warning of report.warnings) assert.match(warning, /dropped 1 item\(s\) in batch .*: 1 invalid\.$/);
      assert.equal(picked.length, 30);
      assert.equal(picked.filter((id) => previousPicked.includes(id)).length, 0);
    }
    previousPicked = picked;
  }
  assert.deepEqual(db.db.pragma("integrity_check"), [{ integrity_check: "ok" }]);
} finally {
  db.close();
}
process.stdout.write(`${JSON.stringify({ mode: values.mode, scratch, activeMemories: before.length, contentPreserved: true, integrityCheck: "ok", runs: output }, null, 2)}\n`);
