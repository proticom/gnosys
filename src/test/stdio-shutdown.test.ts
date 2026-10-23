import { afterEach, expect, it, vi } from "vitest";
import { PassThrough, Writable } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStdioShutdown, trackStdioRequests } from "../lib/stdioShutdown.js";

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

for (const phase of ["drain", "flush", "close"] satisfies ("drain" | "flush" | "close")[]) {
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
