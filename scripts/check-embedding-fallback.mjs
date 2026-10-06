import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const fixture = mkdtempSync(path.join(tmpdir(), "gnosys-missing-embeddings-"));
const installed = path.join(fixture, "installed");
const brain = path.join(fixture, "brain");
const store = path.join(fixture, "store");
const env = {
  PATH: process.env.PATH,
  HOME: path.join(fixture, "user"),
  GNOSYS_HOME: brain,
  GNOSYS_CONFIG_DIR: path.join(fixture, "config"),
  GNOSYS_CACHE_DIR: path.join(fixture, "cache"),
  GNOSYS_PERSONAL: store,
  GNOSYS_MCP_TOOLSET: "full",
  VITEST: "true",
};
let server;

try {
  for (const dir of [installed, brain, store, path.join(installed, "node_modules")]) {
    mkdirSync(dir, { recursive: true });
  }
  cpSync(path.join(repo, "dist"), path.join(installed, "dist"), { recursive: true });
  cpSync(path.join(repo, "package.json"), path.join(installed, "package.json"));
  for (const name of readdirSync(path.join(repo, "node_modules"))) {
    if (name === "@huggingface" || name === ".bin") continue;
    symlinkSync(path.join(repo, "node_modules", name), path.join(installed, "node_modules", name));
  }
  writeFileSync(path.join(store, "gnosys.json"), JSON.stringify({ llm: {}, dream: { enabled: false } }));

  const { GnosysDB } = await import(new URL("../dist/lib/db.js", import.meta.url));
  const db = new GnosysDB(brain);
  const timestamp = new Date().toISOString();
  db.insertMemory({
    id: "auth-001", title: "JWT authentication", category: "general",
    content: "JWT authentication validates signed tokens.", summary: null,
    tags: "[]", relevance: "jwt authentication", author: "ai", authority: "declared",
    confidence: 0.9, reinforcement_count: 0, content_hash: "fixture-auth", status: "active",
    tier: "active", supersedes: null, superseded_by: null, last_reinforced: null,
    created: timestamp, modified: timestamp,
    embedding: Buffer.from(new Float32Array([1, 0, 0]).buffer),
    source_path: null, source_file: null, source_page: null, source_timerange: null,
    attachment_data: null, attachment_mime: null, attachment_name: null,
    project_id: null, scope: "global",
  });
  db.close();

  function cli(args) {
    const result = spawnSync(process.execPath, [path.join(installed, "dist/cli.js"), ...args], {
      cwd: fixture, env, encoding: "utf8", timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result;
  }
  const doctor = cli(["doctor"]);
  assert.match(doctor.stdout, /Local embedding runtime:\s+✗ unavailable/);
  assert.match(doctor.stdout, /npm install @huggingface\/transformers@\^4\.2\.0 --prefix/);
  for (const command of ["hybrid-search", "semantic-search"]) {
    const result = cli([command, "authentication", "--json"]);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.mode, "keyword");
    assert.equal(payload.results[0].relativePath, "auth-001");
    assert.match(payload.note, /search ran keyword-only/);
    assert.match(payload.note, /npm install @huggingface\/transformers/);
    assert.match(result.stderr, /search ran keyword-only/);
  }
  const setup = cli(["setup", "--non-interactive"]);
  assert.match(setup.stderr, /Embedding setup:.*npm install @huggingface\/transformers/);

  server = spawn(process.execPath, [path.join(installed, "dist/index.js")], {
    cwd: fixture, env, stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  let stdout = "";
  let nextId = 1;
  const pending = new Map();
  const invalidLines = [];
  server.stderr.on("data", chunk => { stderr += chunk; });
  server.stdout.on("data", chunk => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      try {
        const response = JSON.parse(line);
        pending.get(response.id)?.(response);
      } catch {
        invalidLines.push(line);
      }
    }
  });
  async function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out. ${stderr}`)), 30_000);
      pending.set(id, response => {
        clearTimeout(timer);
        pending.delete(id);
        if (response.error) reject(new Error(JSON.stringify(response.error)));
        else resolve(response.result);
      });
      server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "embedding-health-check", version: "1" } });
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  for (const name of ["gnosys_hybrid_search", "gnosys_semantic_search"]) {
    const result = await rpc("tools/call", { name, arguments: { query: "authentication" } });
    assert.notEqual(result.isError, true);
    const text = result.content.map(item => item.text ?? "").join("\n");
    assert.match(text, /JWT authentication/);
    assert.match(text, /search ran keyword-only/);
    assert.match(text, /npm install @huggingface\/transformers/);
    assert.match(text, /via: keyword/);
  }
  assert.equal((stderr.match(/Gnosys embedding warning:/g) ?? []).length, 1);
  assert.deepEqual(invalidLines, []);
  process.stdout.write("PASS: missing-package doctor, setup, CLI fallback, MCP fallback, one stderr startup warning, JSON-RPC-only stdout.\n");
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => server.once("exit", resolve));
  }
  rmSync(fixture, { recursive: true, force: true });
}
