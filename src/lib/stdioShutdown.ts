import type { Writable } from "node:stream";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { isJSONRPCRequest, isJSONRPCResultResponse, isJSONRPCErrorResponse, type RequestId } from "@modelcontextprotocol/sdk/types.js";

interface ShutdownSteps {
  drain: () => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  exit: (code: number) => void;
  log: (message: string, error?: unknown) => void;
  timeoutMs: number;
}

export function createStdioShutdown(steps: ShutdownSteps): (code?: 0 | 130 | 143) => Promise<void> {
  let closing: Promise<void> | undefined;
  let exited = false;
  const run = async (code: 0 | 130 | 143) => {
    // Awaited promises and the embedding queue's unref'd timer cannot keep Node alive.
    const lifetime = setInterval(() => {}, 60_000);
    const finish = (exitCode: number) => {
      if (exited) return;
      exited = true;
      clearTimeout(backstop);
      clearInterval(lifetime);
      steps.exit(exitCode);
    };
    // Timers cannot preempt synchronous blocking on the event loop.
    const backstop = setTimeout(() => {
      steps.log("Gnosys MCP: shutdown backstop fired");
      finish(1);
    }, steps.timeoutMs);
    backstop.unref();
    try {
      await steps.drain();
      if (exited) return;
      await steps.flush();
      if (exited) return;
      await steps.close();
      finish(code);
    } catch (error) {
      steps.log("Gnosys MCP: shutdown failed:", error);
      finish(1);
    }
  };
  return (code = 0) => {
    closing ??= run(code);
    return closing;
  };
}

export function trackStdioRequests({ transport, stdout }: { transport: Transport; stdout: Writable }): () => Promise<void> {
  const pending = new Set<RequestId>();
  const waiters = new Set<() => void>();
  const onmessage = transport.onmessage;
  transport.onmessage = (message, extra) => {
    if (isJSONRPCRequest(message)) pending.add(message.id);
    onmessage?.(message, extra);
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
        pending.delete(message.id);
        if (pending.size === 0) {
          for (const resolve of waiters) resolve();
          waiters.clear();
        }
      }
    }
  };
  return () => pending.size === 0 ? Promise.resolve() : new Promise(resolve => waiters.add(resolve));
}
