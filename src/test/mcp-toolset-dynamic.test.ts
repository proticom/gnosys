/**
 * v6.2.0 — dynamic MCP toolset switching (gnosys_toolset).
 * Every server registers ALL tools; tiers are runtime enable/disable state.
 * Agents start on core and self-promote/demote via the always-on
 * gnosys_toolset tool, which triggers notifications/tools/list_changed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { registerCapabilities, toolInToolset, type McpToolset } from "../index.js";

async function makePair(toolset?: McpToolset) {
  const server = new McpServer(
    { name: "dyn", version: "0.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  if (toolset === undefined) registerCapabilities(server);
  else registerCapabilities(server, toolset);
  const client = new Client({ name: "dyn-client", version: "0.0.0" });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { server, client };
}

async function toolNames(client: Client): Promise<string[]> {
  const { tools } = await client.listTools();
  return tools.map((t) => t.name);
}

function callToolset(client: Client, set?: McpToolset) {
  return client.callTool({ name: "gnosys_toolset", arguments: set ? { set } : {} });
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? "").join("\n");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MCP dynamic toolset switching (v6.2)", () => {
  it("a fresh default server starts on core: 19 tools (core 18 + gnosys_toolset)", async () => {
    vi.stubEnv("GNOSYS_MCP_TOOLSET", "");
    const { server, client } = await makePair();
    const names = await toolNames(client);
    expect(names).toHaveLength(19);
    expect(names).toContain("gnosys_toolset");
    expect(names).toContain("gnosys_recall");
    expect(names).not.toContain("gnosys_lens"); // standard tier
    expect(names).not.toContain("gnosys_import"); // full tier
    await client.close();
    await server.close();
  });

  it("gnosys_toolset without args lists standard and full additions", async () => {
    const { server, client } = await makePair("core");
    const out = text(await callToolset(client));
    expect(out).toContain("Active toolset: core");
    expect(out).toContain("Tools added by `standard`");
    expect(out).toContain("Tools added by `full`");
    expect(out).toContain("gnosys_lens");
    expect(out).toContain("gnosys_import");
    expect(out).toContain("gnosys_dream");
    await client.close();
    await server.close();
  });

  it('set:"full" expands to 56 tools and emits notifications/tools/list_changed', async () => {
    const { server, client } = await makePair("core");
    let listChanged = 0;
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      listChanged++;
    });
    const out = text(await callToolset(client, "full"));
    expect(out).toContain("core → full");
    expect(out).toContain("gnosys_import");
    // let the in-memory transport flush the notification
    await new Promise((r) => setTimeout(r, 20));
    expect(listChanged).toBeGreaterThan(0);
    const names = await toolNames(client);
    expect(names).toHaveLength(56);
    await client.close();
    await server.close();
  });

  it('set:"core" shrinks back down', async () => {
    const { server, client } = await makePair("full");
    expect(await toolNames(client)).toHaveLength(56);
    const out = text(await callToolset(client, "core"));
    expect(out).toContain("full → core");
    expect(out).toContain("Removed:");
    const names = await toolNames(client);
    expect(names).toHaveLength(19);
    expect(names).toContain("gnosys_toolset");
    await client.close();
    await server.close();
  });

  it("gnosys_toolset is present and callable in every tier", async () => {
    for (const tier of ["core", "standard", "full"] as const) {
      expect(toolInToolset("gnosys_toolset", tier)).toBe(true);
      const { server, client } = await makePair(tier);
      const names = await toolNames(client);
      expect(names).toContain("gnosys_toolset");
      expect(text(await callToolset(client))).toContain(`Active toolset: ${tier}`);
      await client.close();
      await server.close();
    }
  });

  it("GNOSYS_MCP_TOOLSET=full env override starts on the full tier", async () => {
    vi.stubEnv("GNOSYS_MCP_TOOLSET", "full");
    const { server, client } = await makePair();
    expect((await toolNames(client)).sort()).toEqual([
      "gnosys_add",
      "gnosys_add_structured",
      "gnosys_ask",
      "gnosys_attach",
      "gnosys_audit",
      "gnosys_bootstrap",
      "gnosys_briefing",
      "gnosys_commit_context",
      "gnosys_dashboard",
      "gnosys_dearchive",
      "gnosys_detect_ambiguity",
      "gnosys_discover",
      "gnosys_dream",
      "gnosys_export",
      "gnosys_federated_search",
      "gnosys_get_attachment",
      "gnosys_graph",
      "gnosys_history",
      "gnosys_hybrid_search",
      "gnosys_import",
      "gnosys_ingest_file",
      "gnosys_init",
      "gnosys_lens",
      "gnosys_links",
      "gnosys_list",
      "gnosys_maintain",
      "gnosys_migrate",
      "gnosys_portfolio",
      "gnosys_preference_delete",
      "gnosys_preference_get",
      "gnosys_preference_set",
      "gnosys_read",
      "gnosys_recall",
      "gnosys_reflect",
      "gnosys_reindex",
      "gnosys_reindex_graph",
      "gnosys_reinforce",
      "gnosys_remote_pull",
      "gnosys_remote_push",
      "gnosys_remote_resolve",
      "gnosys_remote_status",
      "gnosys_search",
      "gnosys_semantic_search",
      "gnosys_stale",
      "gnosys_stats",
      "gnosys_stores",
      "gnosys_sync",
      "gnosys_tags",
      "gnosys_tags_add",
      "gnosys_timeline",
      "gnosys_toolset",
      "gnosys_trace",
      "gnosys_traverse",
      "gnosys_update",
      "gnosys_update_status",
      "gnosys_working_set",
    ]);
    await client.close();
    await server.close();
  });
});
