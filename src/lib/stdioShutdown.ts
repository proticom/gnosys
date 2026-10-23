import type { Writable } from "node:stream";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { isJSONRPCRequest, isJSONRPCResultResponse, isJSONRPCErrorResponse, type RequestId } from "@modelcontextprotocol/sdk/types.js";

interface ShutdownSteps {
  drain: () => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  closeSync?: () => void;
  exit: (code: number) => void;
  log: (message: string, error?: unknown) => void;
  timeoutMs: number;
}

export function parseShutdownTimeout(raw: string | undefined, warn: (message: string) => void): number {
  const fallback = 1500;
  if (raw === undefined) return fallback;
  if (raw !== raw.trim() || !/^[+-]?(?:\d+|Infinity)$/.test(raw)) {
    warn(`Gnosys MCP: invalid GNOSYS_SHUTDOWN_TIMEOUT_MS=${JSON.stringify(raw)}; using ${fallback} ms`);
    return fallback;
  }
  const value = Number(raw);
  const timeout = Math.min(60_000, Math.max(100, value));
  if (timeout !== value) {
    warn(`Gnosys MCP: out of range GNOSYS_SHUTDOWN_TIMEOUT_MS=${JSON.stringify(raw)}; using ${timeout} ms`);
  }
  return timeout;
}

export function createStdioShutdown(steps: ShutdownSteps): (code?: 0 | 130 | 143) => Promise<void> {
  let closing: Promise<void> | undefined;
  let signalCode: 130 | 143 | undefined;
  let exited = false;
  let lifetime: ReturnType<typeof setInterval> | undefined;
  let backstop: ReturnType<typeof setTimeout> | undefined;
  const finish = (code: number, emergency = false) => {
    if (exited) return;
    exited = true;
    clearTimeout(backstop);
    clearInterval(lifetime);
    if (emergency) {
      try { steps.closeSync?.(); }
      catch (error) { steps.log("Gnosys MCP: resource cleanup failed:", error); }
    }
    steps.exit(code);
  };
  const run = async () => {
    // Awaited promises and the embedding queue's unref'd timer cannot keep Node alive.
    lifetime = setInterval(() => {}, 60_000);
    // Synchronous event-loop blocking defeats this backstop; there is no watchdog process by design.
    backstop = setTimeout(() => {
      steps.log("Gnosys MCP: shutdown backstop fired");
      finish(1, true);
    }, steps.timeoutMs);
    backstop.unref();
    let failed = false;
    try {
      await steps.drain();
      if (exited) return;
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Missing vectors remain in SQLite for reindex or an embedding-enabled Dream run.
        const flushed = await Promise.race([
          steps.flush().then(() => true),
          new Promise<false>(resolve => { flushTimer = setTimeout(() => resolve(false), Math.min(500, steps.timeoutMs / 3)); }),
        ]);
        if (!flushed) steps.log("Gnosys MCP: embedding flush timed out; pending memories will be embedded by the next reindex/dream");
      } finally { clearTimeout(flushTimer); }
    } catch (error) {
      failed = true;
      steps.log("Gnosys MCP: shutdown failed:", error);
    }
    if (exited) return;
    try { await steps.close(); }
    catch (error) { failed = true; steps.log("Gnosys MCP: shutdown failed:", error); }
    finish(failed ? 1 : signalCode ?? 0, failed);
  };
  return (code = 0) => {
    if (code !== 0 && !exited) {
      if (signalCode !== undefined) {
        steps.log("Gnosys MCP: forced shutdown");
        finish(code, true);
      }
      signalCode = code;
    }
    closing ??= run();
    return closing;
  };
}

export function trackStdioRequests({ transport, stdout }: { transport: Transport; stdout: Writable }): () => Promise<void> {
  const pending = new Set<RequestId>();
  const waiters = new Set<() => void>();
  const complete = (id?: RequestId) => {
    if (id === undefined) pending.clear();
    else pending.delete(id);
    if (pending.size === 0) {
      for (const resolve of waiters) resolve();
      waiters.clear();
    }
  };
  const onmessage = transport.onmessage;
  const onclose = transport.onclose;
  transport.onclose = () => { complete(); onclose?.(); };
  transport.onmessage = (message, extra) => {
    if (isJSONRPCRequest(message)) pending.add(message.id);
    if ("method" in message && message.method === "notifications/cancelled") {
      const id = message.params?.requestId;
      if (typeof id === "string" || typeof id === "number") complete(id);
    }
    try { onmessage?.(message, extra); }
    catch (error) {
      if (isJSONRPCRequest(message)) complete(message.id);
      throw error;
    }
  };
  transport.send = async (message) => {
    try {
      // The SDK waits only for 'drain' and does not await the write callback.
      await new Promise<void>((resolve, reject) => {
        const closed = () => { cleanup(); reject(new Error("stdout closed")); };
        const failed = (error: Error) => { cleanup(); reject(error); };
        const cleanup = () => {
          stdout.off("close", closed);
          stdout.off("error", failed);
        };
        if (stdout.destroyed || stdout.writableEnded || !stdout.writable) {
          closed();
          return;
        }
        stdout.once("close", closed);
        stdout.once("error", failed);
        stdout.write(serializeMessage(message), (error) => {
          cleanup();
          if (error) reject(error);
          else resolve();
        });
      });
    } finally {
      if ((isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) && message.id !== undefined) {
        complete(message.id);
      }
    }
  };
  return () => pending.size === 0 ? Promise.resolve() : new Promise(resolve => waiters.add(resolve));
}
