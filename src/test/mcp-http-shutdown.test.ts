import { afterEach, expect, it, vi } from "vitest";
import http from "node:http";
import { Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startMcpHttpServer } from "../lib/mcpHttp.js";

const state = vi.hoisted(() => {
  const events: string[] = [];
  let release = () => {};
  const closed = new Promise<void>(resolve => { release = resolve; });
  return { events, closed, release };
});

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class {
    sessionId = "test-session";
    onclose?: () => void;
    constructor(private options: { onsessioninitialized: (sid: string) => void }) {}
    async handleRequest(req: { method: string }) {
      if (req.method === "POST") this.options.onsessioninitialized(this.sessionId);
      state.events.push(`${req.method} handled`);
    }
    async close() {
      state.events.push("transport closing");
      await state.closed;
      state.events.push("transport closed");
      this.onclose?.();
    }
  },
}));

let home: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (home) rmSync(home, { recursive: true, force: true });
});

it("awaits SSE transport closure before releasing GET sockets and closing HTTP", async () => {
  home = mkdtempSync(path.join(tmpdir(), "gnosys-http-shutdown-"));
  for (const [key, value] of Object.entries({
    HOME: home, GNOSYS_HOME: path.join(home, "brain"), GNOSYS_CONFIG_DIR: path.join(home, "config"),
    GNOSYS_GLOBAL: "", GNOSYS_PERSONAL: "", GNOSYS_STORES: "", GNOSYS_CACHE_DIR: "",
  })) vi.stubEnv(key, value);
  vi.spyOn(http.Server.prototype, "listen").mockImplementation(function (this: http.Server, ...args: unknown[]) {
    const listener = args.at(-1);
    if (typeof listener !== "function") throw new Error("Missing listen callback");
    queueMicrotask(() => listener());
    return this;
  });
  vi.spyOn(http.Server.prototype, "closeIdleConnections").mockImplementation(() => { state.events.push("idle connections closed"); });
  vi.spyOn(http.Server.prototype, "close").mockImplementation(function (this: http.Server, callback?: (error?: Error) => void) {
    state.events.push("server closed");
    callback?.();
    return this;
  });
  vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
  const handle = await startMcpHttpServer({ host: "127.0.0.1", port: 0, makeServer: () => new McpServer({ name: "shutdown-test", version: "1" }) });
  const post = new http.IncomingMessage(new Socket());
  post.method = "POST";
  post.url = "/mcp";
  const postResponse = new http.ServerResponse(post);
  const destroyPost = vi.spyOn(postResponse, "destroy");
  const get = new http.IncomingMessage(new Socket());
  get.method = "GET";
  get.url = "/mcp";
  get.headers["mcp-session-id"] = "test-session";
  const getResponse = new http.ServerResponse(get);
  vi.spyOn(getResponse, "destroy").mockImplementation(function (this: http.ServerResponse) {
    state.events.push("SSE socket released");
    return this;
  });
  try {
    handle.server.emit("request", post, postResponse);
    post.push(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
      protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "shutdown-test", version: "1" },
    } }));
    post.push(null);
    await vi.waitFor(() => expect(handle.sessionCount()).toBe(1));
    handle.server.emit("request", get, getResponse);
    await vi.waitFor(() => expect(state.events).toEqual(["POST handled", "GET handled"]));
    state.events.length = 0;
    const closing = handle.close();
    expect(state.events).toEqual(["transport closing"]);
    state.release();
    await closing;
    expect(state.events).toEqual(["transport closing", "transport closed", "SSE socket released", "idle connections closed", "server closed"]);
    expect(handle.sessionCount()).toBe(0);
    expect(destroyPost).not.toHaveBeenCalled();
    await handle.close();
    expect(state.events.filter(event => event === "server closed")).toEqual(["server closed"]);
  } finally {
    state.release();
    await handle.close();
    post.destroy();
    get.destroy();
    postResponse.destroy();
    getResponse.destroy();
    handle.server.removeAllListeners();
  }
});
