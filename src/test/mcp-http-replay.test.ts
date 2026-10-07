import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startMcpHttpServer, type McpHttpHandle } from "../lib/mcpHttp.js";
import { registerCapabilities } from "../index.js";

let handle: McpHttpHandle | null = null;
const clients: Client[] = [];

afterEach(async () => {
  for (const c of clients) {
    try {
      await c.close();
    } catch {
      /* ignore */
    }
  }
  clients.length = 0;
  if (handle) {
    await handle.close();
    handle = null;
  }
});

async function connect(base: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"));
  const client = new Client({ name: "replay-client", version: "0.0.0" });
  await client.connect(transport);
  clients.push(client);
  return client;
}

describe("MCP HTTP registration replay", () => {
  it("two concurrent sessions both see the full real tool list", async () => {
    handle = await startMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      makeServer: () => {
        const server = new McpServer({ name: "gnosys", version: "test" });
        // v6.2.0 gnosys_toolset: default tier is now core; this test verifies
        // the FULL surface replays per-session, so pin the full tier.
        registerCapabilities(server, "full");
        return server;
      },
    });

    const base = `http://127.0.0.1:${(handle.server.address() as AddressInfo).port}`;
    const [client1, client2] = await Promise.all([connect(base), connect(base)]);
    const [list1, list2] = await Promise.all([client1.listTools(), client2.listTools()]);
    const names1 = list1.tools.map((t) => t.name).sort();
    const names2 = list2.tools.map((t) => t.name).sort();

    expect(names1).toEqual([
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
    expect(names2).toEqual(names1);
  }, 60_000);
});
