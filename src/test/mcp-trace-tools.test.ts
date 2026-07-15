/**
 * v6.1.0 — MCP gnosys_trace / gnosys_reflect / gnosys_traverse tools.
 * Exercises the registered handlers in-process (InMemoryTransport), happy
 * path + error path, against an isolated GNOSYS_HOME central DB.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCapabilities } from "../index.js";
import { GnosysDB } from "../lib/db.js";

let base: string;
let client: Client;
let server: McpServer;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

const NOW = new Date().toISOString();
function mem(id: string, title: string) {
  return {
    id,
    title,
    category: "concepts",
    content: `# ${title}\n\nseed`,
    summary: null,
    tags: JSON.stringify(["seed"]),
    relevance: `seed ${title}`,
    author: "ai" as const,
    authority: "observed" as const,
    confidence: 0.7,
    reinforcement_count: 0,
    content_hash: "",
    status: "active" as const,
    tier: "active" as const,
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: NOW,
    modified: NOW,
    embedding: null,
    source_path: null,
    project_id: null,
    scope: "user" as const,
  };
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const c = result.content as Array<{ type: string; text?: string }>;
  return c.map((b) => b.text ?? "").join("\n");
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "gnosys-mcp-trace-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";

  // Seed two related memories for traverse/reflect
  const db = new GnosysDB(home);
  expect(db.isAvailable()).toBe(true);
  db.insertMemory(mem("mem-trace-a", "Trace seed A"));
  db.insertMemory(mem("mem-trace-b", "Trace seed B"));
  db.insertRelationship({
    source_id: "mem-trace-a",
    target_id: "mem-trace-b",
    rel_type: "leads_to",
    label: "seeded",
    confidence: 0.9,
    created: NOW,
  });
  db.close();

  // A tiny codebase for gnosys_trace
  const srcDir = join(base, "codebase");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(srcDir, "app.ts"),
    "export function alpha() { return beta(); }\nexport function beta() { return 42; }\n",
  );

  server = new McpServer({ name: "trace-test", version: "0.0.0" });
  registerCapabilities(server);
  client = new Client({ name: "trace-test-client", version: "0.0.0" });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (origHome === undefined) delete process.env.GNOSYS_HOME;
  else process.env.GNOSYS_HOME = origHome;
  if (origLocal === undefined) delete process.env.GNOSYS_LOCAL_ONLY;
  else process.env.GNOSYS_LOCAL_ONLY = origLocal;
  rmSync(base, { recursive: true, force: true });
});

describe("gnosys_trace", () => {
  it("traces a codebase and reports created memories", async () => {
    const res = await client.callTool({
      name: "gnosys_trace",
      arguments: { directory: join(base, "codebase") },
    });
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out).toContain("Trace complete");
    expect(out).toMatch(/Functions found:\s+2/);
    expect(out).toMatch(/Memories created:\s+[1-9]/);
  });

  it("returns a zero-count result for a directory with no source files", async () => {
    const empty = join(base, "empty-dir");
    mkdirSync(empty, { recursive: true });
    const res = await client.callTool({
      name: "gnosys_trace",
      arguments: { directory: empty },
    });
    expect(res.isError).toBeFalsy();
    expect(text(res)).toMatch(/Memories created:\s+0/);
  });
});

describe("gnosys_traverse", () => {
  it("walks the chain from a seeded memory", async () => {
    const res = await client.callTool({
      name: "gnosys_traverse",
      arguments: { memoryId: "mem-trace-a", depth: 3 },
    });
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out).toContain("Traversal from mem-trace-a");
    expect(out).toContain("mem-trace-b");
    expect(out).toContain("[leads_to]");
  });

  it("respects direction=in (no outgoing edges followed)", async () => {
    const res = await client.callTool({
      name: "gnosys_traverse",
      arguments: { memoryId: "mem-trace-a", direction: "in" },
    });
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out).not.toContain("mem-trace-b — ");
  });

  it("errors on an unknown memory id", async () => {
    const res = await client.callTool({
      name: "gnosys_traverse",
      arguments: { memoryId: "mem-does-not-exist" },
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("Memory not found");
  });
});

describe("gnosys_reflect", () => {
  it("records an outcome against explicit memory ids", async () => {
    const res = await client.callTool({
      name: "gnosys_reflect",
      arguments: {
        outcome: "The seeded approach worked in production",
        memoryIds: ["mem-trace-a"],
        success: true,
        notes: "verified by test",
      },
    });
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out).toContain("Reflection recorded");
    expect(out).toContain("(success)");
    expect(out).toContain("mem-trace-a");

    // Confidence was actually adjusted (+0.05 from 0.7)
    const db = new GnosysDB(join(base, ".gnosys"));
    const updated = db.getMemory("mem-trace-a");
    db.close();
    expect(updated?.confidence).toBeCloseTo(0.75, 5);
  });

  it("rejects a call without the required outcome", async () => {
    let rejected = false;
    try {
      const res = await client.callTool({ name: "gnosys_reflect", arguments: {} });
      rejected = res.isError === true;
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
