/**
 * v6.1.0 — MCP toolset tier budget guard (context-bloat reduction).
 * Builds the actual tools/list payload per tier and asserts size budgets
 * so future tool/description growth cannot silently re-bloat agent context.
 */
import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  registerCapabilities,
  resolveToolset,
  toolInToolset,
  toolTier,
  type McpToolset,
} from "../index.js";

async function listTools(toolset: McpToolset) {
  const server = new McpServer({ name: "budget", version: "0.0.0" });
  registerCapabilities(server, toolset);
  const client = new Client({ name: "budget-client", version: "0.0.0" });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  const { tools } = await client.listTools();
  await client.close();
  await server.close();
  return tools;
}

describe("MCP toolset budgets", () => {
  it("core tier is ≤ 20 tools and its serialized payload ≤ 20,000 chars (~5k tokens)", async () => {
    const tools = await listTools("core");
    expect(tools.length).toBeLessThanOrEqual(20);
    expect(JSON.stringify(tools).length).toBeLessThanOrEqual(20_000);
    const names = tools.map((t) => t.name);
    for (const expected of [
      "gnosys_toolset", // v6.2.0 gnosys_toolset — always-on tier switcher joins the core tier
      "gnosys_add_structured",
      "gnosys_recall",
      "gnosys_hybrid_search",
      "gnosys_trace",
      "gnosys_reflect",
      "gnosys_traverse",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("standard tier sits between core and full", async () => {
    const tools = await listTools("standard");
    expect(tools.length).toBeGreaterThan(20);
    expect(tools.length).toBeLessThanOrEqual(40);
    expect(tools.map((t) => t.name)).toContain("gnosys_lens");
    expect(tools.map((t) => t.name)).not.toContain("gnosys_import");
  });

  it("full tier registers everything, ≤ 60 tools", async () => {
    const tools = await listTools("full");
    expect(tools.map((tool) => tool.name).sort()).toEqual([
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
    expect(tools.length).toBeLessThanOrEqual(60);
  });

  it("core ⊂ standard ⊂ full by tier predicate", async () => {
    const full = await listTools("full");
    for (const t of full) {
      if (toolInToolset(t.name, "core")) {
        expect(toolInToolset(t.name, "standard")).toBe(true);
      }
      if (toolInToolset(t.name, "standard")) {
        expect(toolInToolset(t.name, "full")).toBe(true);
      }
    }
    expect(toolTier("gnosys_recall")).toBe("core");
    expect(toolTier("gnosys_lens")).toBe("standard");
    expect(toolTier("gnosys_import")).toBe("full");
  });

  it("resolveToolset falls back to core (with a stderr warning) on unknown values", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveToolset("bogus")).toBe("core"); // v6.2.0 gnosys_toolset: default/fallback flipped full → core
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    expect(resolveToolset(undefined)).toBe("core"); // v6.2.0 gnosys_toolset: default flipped full → core
    expect(resolveToolset("CORE")).toBe("core");
    expect(resolveToolset("standard")).toBe("standard");
  });
});
