import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { startMcpHttpServer, type McpHttpHandle } from "../lib/mcpHttp.js";

let handle: McpHttpHandle | undefined;
afterEach(async () => { await handle?.close(); });

describe("HTTP MCP malformed JSON", () => {
  it("rejects a malformed POST with HTTP 400 and keeps the server healthy", async () => {
    handle = await startMcpHttpServer({
      host: "127.0.0.1", port: 0,
      makeServer: () => new McpServer({ name: "malformed-json-probe", version: "1.0.0" }),
    });
    const address = handle.server.address();
    if (!address || typeof address === "string") throw new Error("Expected a loopback TCP listener");
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: '{"jsonrpc":"2.0","method":',
    });
    expect(response.status).toBe(400);
    const health = await fetch(`${url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok", sessions: 0 });
  });
});
