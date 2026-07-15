/**
 * v6.2.0 — toolset tier state is PER AGENT SESSION, never shared.
 * Two concurrently connected clients (as in HTTP mode's per-session
 * McpServer instances, or two separate stdio processes) must be able to
 * hold different tiers, and switching one must not affect the other.
 */
import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCapabilities } from "../index.js";

async function session() {
  const server = new McpServer({ name: "iso", version: "0.0.0" });
  registerCapabilities(server); // default tier (core)
  const client = new Client({ name: "iso-client", version: "0.0.0" });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { server, client };
}

describe("toolset tier isolation between agent sessions", () => {
  it("escalating session A to full leaves session B on core, and A can come back down", async () => {
    const a = await session();
    const b = await session();

    // Both start on core.
    expect((await a.client.listTools()).tools.length).toBe(19);
    expect((await b.client.listTools()).tools.length).toBe(19);

    // A escalates to full.
    await a.client.callTool({ name: "gnosys_toolset", arguments: { set: "full" } });
    expect((await a.client.listTools()).tools.length).toBe(56);

    // B is untouched.
    expect((await b.client.listTools()).tools.length).toBe(19);

    // A shrinks back down; B still untouched.
    await a.client.callTool({ name: "gnosys_toolset", arguments: { set: "core" } });
    expect((await a.client.listTools()).tools.length).toBe(19);
    expect((await b.client.listTools()).tools.length).toBe(19);

    await Promise.all([a.client.close(), b.client.close(), a.server.close(), b.server.close()]);
  });
});
