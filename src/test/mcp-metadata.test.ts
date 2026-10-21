import { afterEach, describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerCapabilities, toolTier, type McpToolset } from "../index.js";
import { TOOL_ANNOTATIONS } from "../lib/toolAnnotations.js";
import { generateRulesBlock } from "../lib/rulesGen.js";
import { GnosysDB } from "../lib/db.js";
import { setPreference } from "../lib/preferences.js";
import { configureCursor } from "../lib/projectIdentity.js";

const CORE = [
  "gnosys_init", "gnosys_add_structured", "gnosys_read", "gnosys_update",
  "gnosys_recall", "gnosys_hybrid_search", "gnosys_reinforce", "gnosys_reflect",
  "gnosys_preference_set", "gnosys_preference_get", "gnosys_briefing",
  "gnosys_dashboard", "gnosys_traverse", "gnosys_toolset",
].sort();

const pairs: Array<{ client: Client; server: McpServer }> = [];
afterEach(async () => {
  for (const { client, server } of pairs.splice(0)) {
    await client.close();
    await server.close();
  }
});

async function listTools(tier: McpToolset) {
  const server = new McpServer({ name: "metadata", version: "1" });
  registerCapabilities(server, tier);
  const client = new Client({ name: "metadata-test", version: "1" });
  pairs.push({ client, server });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return (await client.listTools()).tools;
}

function checkRouting(text: string, allNames: string[]) {
  const heading = text.match(/^### After gnosys_toolset \{"set":"(standard|full)"\}/)?.[0];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const name of sentence.match(/gnosys_[a-z_]+/g) ?? []) {
      expect(allNames, `Unknown tool ${name}`).toContain(name);
      if (CORE.includes(name)) continue;
      const tier = toolTier(name);
      expect(heading ?? sentence, `Unmarked ${name}`).toMatch(new RegExp(`(?:requires?|[Aa]fter)[^\\n]*gnosys_toolset[^\\n]*["']set["']\\s*:\\s*["']${tier}["']`));
    }
  }
}

describe("MCP metadata contract", () => {
  it("advertises all four boolean hints for every full-tier tool", async () => {
    const tools = await listTools("full");
    expect(tools).toHaveLength(56);
    expect(tools.map(t => t.name).sort()).toEqual(Object.keys(TOOL_ANNOTATIONS).sort());
    for (const tool of tools) {
      expect(tool.annotations, tool.name).toEqual(TOOL_ANNOTATIONS[tool.name]);
      const hints: Array<"readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint"> = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
      for (const key of hints) {
        expect(typeof tool.annotations?.[key], `${tool.name}.${key}`).toBe("boolean");
      }
    }
    const byName = Object.fromEntries(tools.map(t => [t.name, t.annotations]));
    expect(byName.gnosys_hybrid_search).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
    expect(byName.gnosys_update?.destructiveHint).toBe(true);
    expect(byName.gnosys_add_structured).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
    expect(byName.gnosys_remote_push?.openWorldHint).toBe(true);
    expect(byName.gnosys_toolset?.destructiveHint).toBe(false);
    expect(byName.gnosys_get_attachment).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true });
    expect(byName.gnosys_dashboard).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    for (const name of ["gnosys_read", "gnosys_search", "gnosys_recall", "gnosys_discover", "gnosys_federated_search", "gnosys_semantic_search", "gnosys_reindex", "gnosys_reindex_graph"]) {
      expect(byName[name]?.readOnlyHint, name).toBe(true);
      expect(byName[name]?.destructiveHint, name).toBe(false);
      expect(byName[name]?.idempotentHint, name).toBe(true);
      expect(byName[name]?.openWorldHint, name).toBe(false);
    }
  });

  it("treats identical preference writes as non-idempotent because they reinforce", () => {
    const root = mkdtempSync(join(tmpdir(), "gnosys-pref-idempotence-"));
    const db = new GnosysDB(root);
    try {
      setPreference(db, "code-style", "Use named exports");
      setPreference(db, "code-style", "Use named exports");
      expect(db.getMemory("pref-code-style")?.reinforcement_count).toBe(1);
      expect(TOOL_ANNOTATIONS.gnosys_preference_set.idempotentHint).toBe(false);
    } finally {
      db.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exposes exactly 14 core tools, 33 standard tools, and the moved tiers", async () => {
    expect((await listTools("core")).map(t => t.name).sort()).toEqual(CORE);
    expect(await listTools("standard")).toHaveLength(33);
    for (const name of ["gnosys_trace", "gnosys_search", "gnosys_federated_search", "gnosys_discover"]) {
      expect(toolTier(name), name).toBe("standard");
    }
    expect(toolTier("gnosys_add")).toBe("full");
  });

  it("marks non-core routing in core descriptions and generated rules", async () => {
    const tools = await listTools("full");
    const names = tools.map(t => t.name);
    for (const tool of tools.filter(t => CORE.includes(t.name))) checkRouting(tool.description ?? "", names);
    for (const section of generateRulesBlock([], []).split(/(?=^### )/m)) checkRouting(section, names);
    const root = mkdtempSync(join(tmpdir(), "gnosys-core-rules-"));
    try {
      await configureCursor(root);
      const rules = readFileSync(join(root, ".cursor/rules/gnosys.mdc"), "utf8");
      checkRouting(rules, names);
      expect(rules).toContain("gnosys_add_structured");
      expect(rules).toContain("gnosys_hybrid_search");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists real catalog summaries for all moved tools", async () => {
    await listTools("core");
    const result = await pairs[0].client.callTool({ name: "gnosys_toolset", arguments: {} });
    const content = result.content;
    if (!Array.isArray(content)) throw new Error("Missing catalog content");
    const text = content.flatMap(block => block.type === "text" ? [block.text] : []).join("\n");
    for (const [name, summary] of Object.entries({
      gnosys_add: "freeform LLM ingestion for operator-enabled non-agent callers",
      gnosys_trace: "write procedural memories from TypeScript/JavaScript source",
      gnosys_search: "keyword search with snippets",
      gnosys_federated_search: "cross-project search with scope and recency boosts",
      gnosys_discover: "find memory metadata without loading bodies",
    })) expect(text).toContain(`- ${name} — ${summary}`);
  });
});
