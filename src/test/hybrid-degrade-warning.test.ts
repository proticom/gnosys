import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysSearch } from "../lib/search.js";
import { GnosysEmbeddings } from "../lib/embeddings.js";
import { GnosysHybridSearch } from "../lib/hybridSearch.js";
import { GnosysResolver } from "../lib/resolver.js";
import { cliInit, makeMemory } from "./_helpers.js";

vi.mock("@huggingface/transformers", () => ({
  env: {}, pipeline: vi.fn(async () => async () => ({ tolist: () => [[1, 0]] })),
}));

let project: string;
let db: GnosysDB;
let childEnv: Record<string, string>;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-hybrid-warning-"));
  cliInit(project);
  const brain = path.join(project, ".test-central");
  db = new GnosysDB(brain);
  db.insertMemory(makeMemory({ id: "hybrid-memory", title: "Zebra database", content: "Zebra database facts", scope: "user" }));
  childEnv = Object.fromEntries(Object.entries({ ...process.env, HOME: project, GNOSYS_HOME: brain, GNOSYS_CONFIG_DIR: path.join(project, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_MCP_TOOLSET: "full" }).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  vi.stubEnv("GNOSYS_CACHE_DIR", path.join(project, "cache"));
});
afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  fs.rmSync(project, { recursive: true, force: true });
});

async function tool(name: string, query: string) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/index.js")], cwd: project, env: childEnv, stderr: "pipe" });
  const client = new Client({ name: "hybrid-warning-test", version: "1" });
  try {
    await client.connect(transport);
    return await client.callTool({ name, arguments: { query, projectRoot: project } });
  } finally { await client.close(); }
}

describe("hybrid search degrade warnings (v5.12.3)", () => {
  it("gnosys_hybrid_search warns when the semantic leg can't run", async () => {
    const result = await tool("gnosys_hybrid_search", "Zebra");
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).toContain("hybrid search ran keyword-only. Run gnosys_reindex to build embeddings and enable semantic recall.");
    expect(JSON.stringify(result.content)).toContain("Zebra database");
    const empty = await tool("gnosys_hybrid_search", "unfindableword");
    expect(JSON.stringify(empty.content)).toContain("hybrid search ran keyword-only");
    expect(JSON.stringify(empty.content)).toContain('No results for \\"unfindableword\\"');
  });

  it("gnosys_semantic_search refuses loudly instead of returning generic empty", async () => {
    const result = await tool("gnosys_semantic_search", "Zebra");
    expect(result).toMatchObject({ isError: true, content: [{ type: "text", text: "⚠️ Semantic embeddings unavailable — semantic search cannot run. Run gnosys_reindex to build embeddings, then retry." }] });
  });

  it("CLI hybrid-search warns on stderr (stdout stays clean for --json)", () => {
    const result = spawnSync(process.execPath, [path.resolve("dist/cli.js"), "hybrid-search", "unfindableword", "--json"], { cwd: project, env: childEnv, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ query: "unfindableword", mode: "hybrid", results: [] });
    expect(result.stderr).toContain("Semantic embeddings unavailable — hybrid search will run keyword-only. Run 'gnosys reindex' to build embeddings.");
  });

  it("semantic search reads central database vectors", async () => {
    const store = path.join(project, ".gnosys");
    const search = new GnosysSearch(store);
    const embeddings = new GnosysEmbeddings(store);
    const resolver = await GnosysResolver.resolveForProject(project);
    try {
      const hybrid = new GnosysHybridSearch(search, embeddings, resolver, store, db);
      expect(hybrid.canRunSemantic()).toBe(false);
      db.updateEmbedding("hybrid-memory", Buffer.from(new Float32Array([1, 0]).buffer));
      expect(hybrid.canRunSemantic()).toBe(true);
      const results = await hybrid.hybridSearch("unrelatedword", 2, "semantic");
      expect(results.map(({ title, sources }) => ({ title, sources }))).toEqual([{ title: "Zebra database", sources: ["semantic"] }]);
    } finally { search.close(); embeddings.close(); }
  });
});
