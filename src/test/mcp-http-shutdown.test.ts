import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

beforeEach(() => {
  state.events.length = 0;
  state.closed = new Promise<void>(resolve => { state.release = resolve; });
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
    state.events.push("stop listening");
    callback?.();
    return this;
  });
  vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
});

function open() {
  return startMcpHttpServer({ host: "127.0.0.1", port: 0, makeServer: () => new McpServer({ name: "shutdown-test", version: "1" }) });
}

it("awaits SSE transport closure before releasing GET sockets and closing HTTP", async () => {
  const handle = await open();
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
    postResponse.emit("finish");
    state.events.length = 0;
    const closing = handle.close();
    await vi.waitFor(() => expect(state.events).toEqual(["stop listening", "transport closing"]));
    state.release();
    await closing;
    expect(state.events).toEqual(["stop listening", "transport closing", "transport closed", "SSE socket released", "idle connections closed"]);
    expect(handle.sessionCount()).toBe(0);
    expect(destroyPost).not.toHaveBeenCalled();
    await handle.close();
    expect(state.events.filter(event => event === "stop listening")).toEqual(["stop listening"]);
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

for (const completion of ["finish", "close"]) {
  it(`r5 drains a POST from arrival through response ${completion} and rejects later arrivals`, async () => {
    const handle = await open();
    const post = new http.IncomingMessage(new Socket());
    post.method = "POST";
    post.url = "/mcp";
    const response = new http.ServerResponse(post);
    const late = new http.IncomingMessage(new Socket());
    late.method = "POST";
    late.url = "/mcp";
    const rejected = new http.ServerResponse(late);
    const bodies: unknown[] = [];
    vi.spyOn(rejected, "end").mockImplementation(function (this: http.ServerResponse, ...args: unknown[]) {
      bodies.push(args[0]);
      return this;
    });
    try {
      handle.server.emit("request", post, response);
      let drained = false;
      const draining = handle.drain().then(() => { drained = true; });
      await Promise.resolve();
      expect(drained).toBe(false);
      expect(state.events).toEqual(["stop listening"]);
      handle.server.emit("request", late, rejected);
      expect(rejected.statusCode).toBe(503);
      expect(bodies).toEqual(['{"jsonrpc":"2.0","error":{"code":-32000,"message":"Server shutting down"},"id":null}']);
      post.push(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "shutdown-test", version: "1" },
      } }));
      post.push(null);
      await vi.waitFor(() => expect(state.events).toEqual(["stop listening", "POST handled"]));
      expect(drained).toBe(false);
      response.emit(completion);
      await draining;
      expect(drained).toBe(true);
      expect(response.listenerCount("finish")).toBe(0);
      expect(response.listenerCount("close")).toBe(0);
      expect(handle.reapIdleSessions(Number.MAX_SAFE_INTEGER)).toBe(0);
      expect(handle.sessionCount()).toBe(1);
      state.release();
      await handle.close();
      expect(state.events).toEqual(["stop listening", "POST handled", "transport closing", "transport closed", "idle connections closed"]);
    } finally {
      response.emit(completion);
      state.release();
      await handle.close();
      post.destroy(); response.destroy(); late.destroy(); rejected.destroy();
      handle.server.removeAllListeners();
    }
  });
}

it("r5 rejects an HTTP listen error through the startup promise", async () => {
  vi.spyOn(http.Server.prototype, "listen").mockImplementation(function (this: http.Server) {
    this.on("error", () => {});
    queueMicrotask(() => this.emit("error", new Error("listen EADDRINUSE")));
    return this;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await expect(Promise.race([open(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("startup did not reject")), 100);
    })])).rejects.toThrow("EADDRINUSE");
  } finally { clearTimeout(timer); }
});
