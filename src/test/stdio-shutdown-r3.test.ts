import { afterEach, expect, it, vi } from "vitest";
import childProcess, { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { GnosysDB } from "../lib/db.js";

const root = path.resolve(__dirname, "../..");
const index = path.join(root, "dist/index.js");
const marker = "round-3 persisted memory";
type Fault = "cancel" | "dispatch" | "embedding" | "close" | "second-signal" | "http" | "write";
interface Running {
  home: string;
  env: Record<string, string>;
  args: string[];
  child?: ChildProcess;
  closed?: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  client?: Client;
  stdout: string;
  stderr: string;
}
let running: Running | undefined;

async function within<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${running?.stderr}`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (!running) return;
  await dispose(running);
});

async function dispose(instance: Running): Promise<void> {
  try {
    const closing = instance.client?.close();
    if (instance.child?.exitCode === null && instance.child.signalCode === null) instance.child.kill("SIGKILL");
    await instance.closed;
    await closing;
  } finally {
    rmSync(instance.home, { recursive: true, force: true });
    running = undefined;
  }
}

function fixture(fault: Fault): Running {
  const home = mkdtempSync(path.join(tmpdir(), "gnosys-job95r3-child-"));
  const env = {
    ...Object.fromEntries(Object.entries(process.env).flatMap(([key, value]) =>
      key.startsWith("GNOSYS_") || value === undefined ? [] : [[key, value]])),
    HOME: home, USERPROFILE: home, GNOSYS_HOME: path.join(home, "brain"), GNOSYS_CONFIG_DIR: path.join(home, "config"),
    GNOSYS_GLOBAL: "", GNOSYS_PERSONAL: "", GNOSYS_STORES: "", GNOSYS_CACHE_DIR: "",
    GNOSYS_LOCAL_ONLY: "1", E2E_TELEMETRY_DISABLED: "1",
  } satisfies NodeJS.ProcessEnv;
  const instance: Running = { home, env, args: [index], stdout: "", stderr: "" };
  running = instance;
  execFileSync(process.execPath, [path.join(root, "dist/cli.js"), "init"], {
    cwd: home, env, stdio: "pipe", timeout: 10_000, killSignal: "SIGKILL",
  });
  const preload = path.join(home, "fixture.mjs");
  const url = (file: string) => JSON.stringify(pathToFileURL(path.join(root, file)).href);
  writeFileSync(preload, `
import { McpServer } from ${url("node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js")};
import { GnosysDB } from ${url("dist/lib/db.js")};
import { GnosysEmbeddings } from ${url("dist/lib/embeddings.js")};
import { GnosysIngestion } from ${url("dist/lib/ingest.js")};
${fault === "dispatch" ? `
const { Protocol } = await import(${url("node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js")});
const dispatch = Protocol.prototype._onrequest;
Protocol.prototype._onrequest = function (request, ...args) {
  if (request.method === "tools/call") { console.error("r3 dispatch failed"); throw new Error("injected dispatch failure"); }
  return dispatch.call(this, request, ...args);
};` : ""}
${fault === "http" ? `
const { Server } = await import("node:http");
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  this.once("listening", () => {
    const address = this.address();
    if (address && typeof address === "object") console.error("r4 HTTP port " + address.port);
  });
  this.once("error", error => {
    if (error.code !== "EPERM") throw error;
    console.error("r3 loopback EPERM: using test listener for HTTP signal handling");
    const alive = setInterval(() => {}, 60000);
    this.close = callback => { clearInterval(alive); queueMicrotask(() => callback?.()); return this; };
    queueMicrotask(() => args[args.length - 1].call(this));
  });
  return listen.apply(this, args);
};` : ""}
let shuttingDown = false;
process.stdin.on("end", () => { shuttingDown = true; });
const on = process.on;
process.on = function (event, listener) {
  return on.call(this, event, event === "SIGINT" || event === "SIGTERM" ? function (...args) {
    shuttingDown = true; return listener.apply(this, args);
  } : listener);
};
const closeDb = GnosysDB.prototype.close;
const closed = new WeakSet();
GnosysDB.prototype.close = function () {
  if (closed.has(this)) console.error("r3 database double close");
  closed.add(this);
  closeDb.call(this);
  if (shuttingDown) console.error("r3 database closed");
};
GnosysEmbeddings.prototype.embed = async () => {
  ${fault === "embedding" ? 'console.error("r3 embed started"); await new Promise(() => {});' : 'return new Float32Array(384).fill(1);'}
};
${fault === "cancel" || fault === "second-signal" ? `
const tool = McpServer.prototype.tool;
McpServer.prototype.tool = function (name, ...args) {
  if (name === "gnosys_read") args[args.length - 1] = async () => {
    console.error("r3 handler started"); await new Promise(() => {});
  };
  return tool.call(this, name, ...args);
};` : ""}
${fault === "write" ? `
const tool = McpServer.prototype.tool;
McpServer.prototype.tool = function (name, ...args) {
  if (name === "gnosys_add_structured") {
    const add = args[args.length - 1];
    args[args.length - 1] = async (...params) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return add(...params);
    };
  }
  return tool.call(this, name, ...args);
};` : ""}
${fault === "close" ? 'McpServer.prototype.close = async () => { console.error("r3 close started"); await new Promise(resolve => setTimeout(resolve, 3000)); };' : ""}
${fault === "second-signal" ? 'process.on("SIGTERM", () => console.error("r3 first signal received"));' : ""}
void GnosysIngestion;
`);
  instance.args = ["--import", preload, index];
  return instance;
}

function observe(instance: Running, child: ChildProcess): void {
  instance.child = child;
  instance.closed = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
  child.stdout?.on("data", chunk => { instance.stdout += String(chunk); });
  child.stderr?.on("data", chunk => { instance.stderr += String(chunk); });
  child.stdin?.on("error", () => {});
  child.on("error", error => { instance.stderr += String(error); });
}

async function waitFor(instance: Running, text: string): Promise<void> {
  const stderr = instance.child?.stderr;
  let ready = () => {};
  const check = () => { if (instance.stderr.includes(text)) ready(); };
  try {
    await within(new Promise<void>(resolve => { ready = resolve; stderr?.on("data", check); check(); }));
  } finally { stderr?.off("data", check); }
}

function lines(instance: Running) {
  return instance.stdout.split("\n").slice(0, -1).filter(Boolean).map(line => JSONRPCMessageSchema.parse(JSON.parse(line)));
}

function write(instance: Running, message: unknown): void {
  instance.child?.stdin?.write(`${JSON.stringify(message)}\n`);
}

async function raw(instance: Running): Promise<void> {
  observe(instance, spawn(process.execPath, instance.args, { cwd: instance.home, env: instance.env, stdio: "pipe" }));
  write(instance, { jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "r3-raw", version: "1" },
  } });
  await within(new Promise<void>((resolve, reject) => {
    const stdout = instance.child?.stdout;
    const check = () => {
      try {
        if (lines(instance).some(message => "id" in message && message.id === 1)) { stdout?.off("data", check); resolve(); }
      } catch (error) { stdout?.off("data", check); reject(error); }
    };
    stdout?.on("data", check);
    check();
  }));
  write(instance, { jsonrpc: "2.0", method: "notifications/initialized" });
}

async function sdk(instance: Running): Promise<Client> {
  const transport = new StdioClientTransport({ command: process.execPath, args: instance.args, cwd: instance.home, env: instance.env, stderr: "pipe" });
  const client = new Client({ name: "r3-sdk", version: "1" });
  instance.client = client;
  const capture = vi.spyOn(childProcess, "spawn");
  const connecting = client.connect(transport);
  const result = capture.mock.results[0];
  capture.mockRestore();
  if (result?.type !== "return") throw new Error("SDK did not spawn a child");
  observe(instance, result.value);
  await within(connecting);
  return client;
}

async function exited(instance: Running, code: number): Promise<void> {
  if (!instance.closed) throw new Error("Missing child");
  expect(await within(instance.closed), instance.stderr).toEqual({ code, signal: null });
  expect(instance.stderr).not.toContain("r3 database double close");
}

function persisted(instance: Running): void {
  expect(instance.stderr).toContain("r3 database closed");
  const db = new GnosysDB(path.join(instance.home, "brain"));
  try {
    expect(db.getAllMemories().map(memory => memory.title)).toContain(marker);
    expect(db.getMemoriesForEmbedding("missing").map(memory => memory.title)).toContain(marker);
  } finally { db.close(); }
}

it("r3 raw cancellation drains without a suppressed response", async () => {
  const instance = fixture("cancel");
  instance.env.GNOSYS_SHUTDOWN_TIMEOUT_MS = "1000";
  await raw(instance);
  write(instance, { jsonrpc: "2.0", id: 95, method: "tools/call", params: { name: "gnosys_read", arguments: { path: "r3" } } });
  await waitFor(instance, "r3 handler started");
  const started = performance.now();
  instance.child?.stdin?.end(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 95 } })}\n`);
  await exited(instance, 0);
  expect(performance.now() - started).toBeLessThan(750);
  expect(instance.stderr).not.toContain("backstop fired");
});

it("r3 SDK AbortSignal cancellation exits before client SIGTERM", async () => {
  const instance = fixture("cancel");
  const client = await sdk(instance);
  const controller = new AbortController();
  const request = client.callTool({ name: "gnosys_read", arguments: { path: "r3" } }, undefined, { signal: controller.signal });
  const cancelled = expect(request).rejects.toThrow("r3 cancelled");
  await waitFor(instance, "r3 handler started");
  controller.abort(new Error("r3 cancelled"));
  await cancelled;
  const started = performance.now();
  await within(client.close());
  await exited(instance, 0);
  expect(performance.now() - started).toBeLessThan(1900);
});

it("r3 SDK dispatch exceptions complete requests without a response", async () => {
  const instance = fixture("dispatch");
  await raw(instance);
  write(instance, { jsonrpc: "2.0", id: 95, method: "tools/call", params: { name: "gnosys_read", arguments: { path: "r3" } } });
  await waitFor(instance, "r3 dispatch failed");
  instance.child?.stdin?.end();
  await exited(instance, 0);
  expect(instance.stderr).not.toContain("backstop fired");
});

it("r3 SDK close bounds a hung embedding flush and closes the database", async () => {
  const instance = fixture("embedding");
  const client = await sdk(instance);
  await waitFor(instance, "Gnosys MCP: heavy modules ready");
  const result = await client.callTool({ name: "gnosys_add_structured", arguments: {
    title: marker, content: marker, tags: {}, category: "decisions", projectRoot: instance.home,
  } });
  expect(result.isError).not.toBe(true);
  await waitFor(instance, "r3 embed started");
  const started = performance.now();
  await within(client.close());
  await exited(instance, 0);
  expect(performance.now() - started).toBeLessThan(1900);
  expect(instance.stderr).toContain("embedding flush timed out");
  persisted(instance);
});

it("r3 default backstop exits before the SDK signal deadline", async () => {
  const instance = fixture("close");
  const client = await sdk(instance);
  const started = performance.now();
  await within(client.close());
  await exited(instance, 1);
  expect(performance.now() - started).toBeLessThan(1900);
  expect(instance.stderr).toContain("shutdown backstop fired");
  expect(instance.stderr).toContain("r3 database closed");
});

it("r3 second signal forces synchronous resource close", async () => {
  const instance = fixture("second-signal");
  await raw(instance);
  write(instance, { jsonrpc: "2.0", id: 95, method: "tools/call", params: { name: "gnosys_read", arguments: { path: "r3" } } });
  await waitFor(instance, "r3 handler started");
  instance.child?.kill("SIGTERM");
  await waitFor(instance, "r3 first signal received");
  const started = performance.now();
  instance.child?.kill("SIGINT");
  await exited(instance, 130);
  expect(performance.now() - started).toBeLessThan(300);
  expect(instance.stderr).toContain("Gnosys MCP: forced shutdown");
  expect(instance.stderr).toContain("r3 database closed");
});

for (const { signal, code } of [{ signal: "SIGINT", code: 130 }, { signal: "SIGTERM", code: 143 }] satisfies { signal: NodeJS.Signals; code: number }[]) {
  it(`r3 HTTP ${signal} exits with code ${code} and ignores stdin EOF`, async () => {
    const instance = fixture("http");
    instance.env.GNOSYS_TRANSPORT = "http";
    instance.env.GNOSYS_HTTP_PORT = "0";
    observe(instance, spawn(process.execPath, instance.args, { cwd: instance.home, env: instance.env, stdio: "pipe" }));
    await waitFor(instance, "HTTP transport ready");
    instance.child?.stdin?.end();
    await new Promise(resolve => setTimeout(resolve, 100));
    instance.child?.kill(signal);
    await exited(instance, code);
    expect(instance.stderr).toContain("r3 database closed");
  });
}

it("r4 HTTP SIGTERM with an open SSE stream exits before the backstop", async ({ skip }) => {
  const instance = fixture("http");
  instance.env.GNOSYS_TRANSPORT = "http";
  instance.env.GNOSYS_HTTP_HOST = "127.0.0.1";
  instance.env.GNOSYS_HTTP_PORT = "0";
  observe(instance, spawn(process.execPath, instance.args, { cwd: instance.home, env: instance.env, stdio: "pipe" }));
  await waitFor(instance, "HTTP transport ready");
  if (instance.stderr.includes("r3 loopback EPERM")) skip("Sandbox denies native loopback binding; requires a real SSE socket");
  const port = /r4 HTTP port (\d+)/.exec(instance.stderr)?.[1];
  if (!port) throw new Error(`Missing native HTTP port: ${instance.stderr}`);
  const url = `http://127.0.0.1:${port}/mcp`;
  const controller = new AbortController();
  let stream: Response | undefined;
  try {
    const initialized = await within(fetch(url, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "r4-http", version: "1" },
      } }),
    }));
    expect(initialized.status).toBe(200);
    expect(await within(initialized.text())).toContain('"protocolVersion":"2024-11-05"');
    const sessionId = initialized.headers.get("mcp-session-id");
    if (!sessionId) throw new Error("HTTP initialize did not return a session id");
    const headers = {
      "content-type": "application/json", accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId, "mcp-protocol-version": "2024-11-05",
    };
    const notification = await within(fetch(url, {
      method: "POST", headers, signal: controller.signal,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }));
    expect(notification.status).toBe(202);
    await within(notification.text());
    stream = await within(fetch(url, { headers: { ...headers, accept: "text/event-stream" }, signal: controller.signal }));
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const started = performance.now();
    instance.child?.kill("SIGTERM");
    await exited(instance, 143);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(instance.stderr).not.toContain("backstop fired");
    expect(instance.stderr).toContain("r3 database closed");
  } finally {
    controller.abort();
    await stream?.body?.cancel().catch(() => {});
  }
});

function addLine(instance: Running, title: string): string {
  return `${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {
    name: "gnosys_add_structured", arguments: { title, content: title, tags: {}, category: "decisions", projectRoot: instance.home },
  } })}\n`;
}

function committed(instance: Running, title: string): void {
  const db = new GnosysDB(path.join(instance.home, "brain"));
  try { expect(db.getAllMemories().filter(memory => memory.title === title).map(memory => memory.title)).toEqual([title]); }
  finally { db.close(); }
}

for (const delay of [0, 1]) {
  it(`r4 EOF plus first SIGTERM after ${delay} ms preserves the request`, async () => {
    for (let iteration = 0; iteration < 3; iteration++) {
      const instance = fixture("write");
      await raw(instance);
      await waitFor(instance, "Gnosys MCP: heavy modules ready");
      const title = `r4 signal ${delay} ${iteration}`;
      const started = performance.now();
      instance.child?.stdin?.end(addLine(instance, title));
      if (delay !== 0) await new Promise(resolve => setTimeout(resolve, delay));
      instance.child?.kill("SIGTERM");
      await exited(instance, 143);
      const response = lines(instance).find(message => "id" in message && message.id === 7);
      if (!response || !("result" in response)) throw new Error(`Missing result for request 7: ${instance.stdout}\n${instance.stderr}`);
      expect(response.result).toMatchObject({ content: [{ type: "text", text: expect.stringContaining(`**${title}**\nID:`) }] });
      committed(instance, title);
      expect(instance.stderr).not.toContain("forced shutdown");
      expect(instance.stderr).not.toContain("backstop fired");
      expect(performance.now() - started).toBeLessThan(1000);
      await dispose(instance);
    }
  });
}

it("r4 a broken stdout during shutdown preserves the write without an uncaught EPIPE", async () => {
  const instance = fixture("write");
  await raw(instance);
  await waitFor(instance, "Gnosys MCP: heavy modules ready");
  const title = "r4 broken stdout memory";
  instance.child?.stdin?.write(addLine(instance, title));
  instance.child?.stdout?.destroy();
  instance.child?.stdin?.end();
  await exited(instance, 0);
  committed(instance, title);
  expect(instance.stderr).not.toContain("uncaught exception");
  expect(instance.stderr).not.toContain("EPIPE");
});
