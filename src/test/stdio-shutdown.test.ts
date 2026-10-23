import { afterEach, expect, it, vi } from "vitest";
import { PassThrough, Writable } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStdioShutdown, trackStdioRequests } from "../lib/stdioShutdown.js";
import * as shutdownModule from "../lib/stdioShutdown.js";

afterEach(() => vi.useRealTimers());

function gate() {
  let release = () => {};
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

it("drains requests, flushes embeddings, and then closes resources exactly once", async () => {
  const requests = gate();
  const embeddings = gate();
  const events: string[] = [];
  const shutdown = createStdioShutdown({
    drain: async () => { events.push("drain"); await requests.promise; },
    flush: async () => { events.push("flush embeddings"); await embeddings.promise; },
    close: async () => { events.push("disable embeddings", "close resources"); },
    exit: code => { events.push(`exit ${code}`); },
    log: message => { events.push(message); },
    timeoutMs: 5000,
  });
  const closing = shutdown(143);
  void shutdown();
  await Promise.resolve();
  expect(events).toEqual(["drain"]);
  requests.release();
  await Promise.resolve();
  await Promise.resolve();
  expect(events).toEqual(["drain", "flush embeddings"]);
  embeddings.release();
  await closing;
  expect(events).toEqual(["drain", "flush embeddings", "disable embeddings", "close resources", "exit 143"]);
});

for (const phase of ["drain", "close"] satisfies ("drain" | "close")[]) {
  it(`reports a backstop and exits 1 if ${phase} hangs`, async () => {
    vi.useFakeTimers();
    const hung = gate();
    const exits: number[] = [];
    const logs: string[] = [];
    const steps = {
      drain: async () => {}, flush: async () => {}, close: async () => {},
      [phase]: () => hung.promise,
    };
    const shutdown = createStdioShutdown({
      ...steps, timeoutMs: 300,
      exit: code => { exits.push(code); }, log: message => { logs.push(message); },
    });
    const closing = shutdown();
    await vi.advanceTimersByTimeAsync(299);
    expect(exits).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(exits).toEqual([1]);
    expect(logs).toEqual(["Gnosys MCP: shutdown backstop fired"]);
    hung.release();
    await closing;
    expect(exits).toEqual([1]);
  });

  it(`exits 1 if ${phase} throws`, async () => {
    const exits: number[] = [];
    const errors: unknown[] = [];
    const failure = new Error("injected cleanup failure");
    const steps = {
      drain: async () => {}, flush: async () => {}, close: async () => {},
      [phase]: async () => { throw failure; },
    };
    await createStdioShutdown({
      ...steps, timeoutMs: 300,
      exit: code => { exits.push(code); }, log: (_message, error) => { errors.push(error); },
    })();
    expect(exits).toEqual([1]);
    expect(errors).toEqual([failure]);
  });
}

it("keeps a request pending until its response has flushed to stdout", async () => {
  const input = new PassThrough();
  let flushed = () => {};
  const chunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) { chunks.push(chunk.toString()); flushed = callback; },
  });
  const transport = new StdioServerTransport(input, stdout);
  const drain = trackStdioRequests({ transport, stdout });
  let drained = false;
  try {
    transport.onmessage?.({ jsonrpc: "2.0", id: 95, method: "tools/call", params: {} });
    const pending = drain().then(() => { drained = true; });
    const sent = transport.send({ jsonrpc: "2.0", id: 95, result: { saved: true } });
    await Promise.resolve();
    expect(drained).toBe(false);
    flushed();
    await sent;
    await pending;
    expect(drained).toBe(true);
    expect(chunks).toEqual(['{"jsonrpc":"2.0","id":95,"result":{"saved":true}}\n']);
  } finally {
    input.destroy();
    stdout.destroy();
  }
});

it("finishes the request drain when stdout closes during a response", async () => {
  const input = new PassThrough();
  const stdout = new Writable({ write() {} });
  const transport = new StdioServerTransport(input, stdout);
  const drain = trackStdioRequests({ transport, stdout });
  try {
    transport.onmessage?.({ jsonrpc: "2.0", id: 95, method: "tools/call", params: {} });
    const sent = transport.send({ jsonrpc: "2.0", id: 95, result: { saved: true } });
    const failed = expect(sent).rejects.toThrow("stdout closed");
    stdout.destroy();
    await failed;
    const events: string[] = [];
    await drain().then(() => { events.push("drained after stdout closed"); });
    expect(events).toEqual(["drained after stdout closed"]);
  } finally {
    input.destroy();
    stdout.destroy();
  }
}, 1000);

it("removes response listeners when the write callback reports an error", async () => {
  const input = new PassThrough();
  const failure = new Error("injected write callback failure");
  class CallbackErrorStream extends Writable {
    override write(
      _chunk: unknown,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean {
      if (typeof encodingOrCallback === "function") encodingOrCallback(failure);
      else callback?.(failure);
      return false;
    }
  }
  const stdout = new CallbackErrorStream();
  const transport = new StdioServerTransport(input, stdout);
  const drain = trackStdioRequests({ transport, stdout });
  try {
    transport.onmessage?.({ jsonrpc: "2.0", id: 95, method: "tools/call", params: {} });
    await expect(transport.send({ jsonrpc: "2.0", id: 95, result: {} })).rejects.toThrow("injected write callback failure");
    const events: string[] = [];
    await drain().then(() => { events.push("drained after write failure"); });
    expect(events).toEqual(["drained after write failure"]);
    expect(stdout.listenerCount("close")).toBe(0);
    expect(stdout.listenerCount("error")).toBe(0);
  } finally {
    input.destroy();
    stdout.destroy();
  }
});

async function drainWithin(pending: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("request drain stuck")), 100);
    })]);
  } finally { clearTimeout(timer); }
}

for (const completion of ["cancelled", "dispatch error", "transport closed"]) {
  it(`r3 completes a request after ${completion} without a response`, async () => {
    const input = new PassThrough();
    const stdout = new PassThrough();
    const transport = new StdioServerTransport(input, stdout);
    if (completion === "dispatch error") transport.onmessage = () => { throw new Error("dispatch failed"); };
    const drain = trackStdioRequests({ transport, stdout });
    try {
      const receive = () => transport.onmessage?.({ jsonrpc: "2.0", id: 95, method: "tools/call" });
      if (completion === "dispatch error") expect(receive).toThrow("dispatch failed");
      else receive();
      if (completion === "cancelled") transport.onmessage?.({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 95 } });
      if (completion === "transport closed") await transport.close();
      const events: string[] = [];
      await drainWithin(drain().then(() => { events.push("drained"); }));
      expect(events).toEqual(["drained"]);
    } finally { input.destroy(); stdout.destroy(); }
  });
}

it("r3 closes resources after the embedding flush budget expires", async () => {
  vi.useFakeTimers();
  const hung = gate();
  const events: string[] = [];
  const closing = createStdioShutdown({
    drain: async () => {}, flush: () => hung.promise, close: async () => { events.push("close"); },
    exit: code => { events.push(`exit ${code}`); }, log: message => { events.push(message); }, timeoutMs: 1500,
  })();
  try {
    await vi.advanceTimersByTimeAsync(501);
    expect(events).toEqual([
      "Gnosys MCP: embedding flush timed out; pending memories will be embedded by the next reindex/dream",
      "close", "exit 0",
    ]);
  } finally { hung.release(); await closing; }
});

it("r3 closes resources even when the embedding flush rejects", async () => {
  const events: string[] = [];
  await createStdioShutdown({
    drain: async () => {}, flush: async () => { throw new Error("flush failed"); },
    close: async () => { events.push("close"); }, exit: code => { events.push(`exit ${code}`); },
    log: () => {}, timeoutMs: 1500,
  })();
  expect(events).toEqual(["close", "exit 1"]);
});

it("r3 backstop synchronously closes resources before exit", async () => {
  vi.useFakeTimers();
  const hung = gate();
  const events: string[] = [];
  const closing = createStdioShutdown({
    drain: () => hung.promise, flush: async () => {}, close: async () => {},
    closeSync: () => { events.push("database closed"); },
    exit: code => { events.push(`exit ${code}`); }, log: () => {}, timeoutMs: 300,
  })();
  try {
    await vi.advanceTimersByTimeAsync(300);
    expect(events).toEqual(["database closed", "exit 1"]);
  } finally { hung.release(); await closing; }
});

for (const { raw, expected, warns } of [
  { raw: "0", expected: 100, warns: true }, { raw: "-5", expected: 100, warns: true },
  { raw: "abc", expected: 1500, warns: true }, { raw: "", expected: 1500, warns: true },
  { raw: "999999", expected: 60000, warns: true }, { raw: "450", expected: 450, warns: false },
  { raw: undefined, expected: 1500, warns: false },
]) {
  it(`r3 parses shutdown timeout ${JSON.stringify(raw)}`, () => {
    const warnings: string[] = [];
    expect(shutdownModule.parseShutdownTimeout(raw, message => { warnings.push(message); })).toBe(expected);
    if (warns) {
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain(JSON.stringify(raw));
      expect(warnings[0]).toContain(`${expected} ms`);
    } else expect(warnings).toEqual([]);
  });
}
