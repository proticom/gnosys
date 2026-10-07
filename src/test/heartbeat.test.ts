import { afterEach, describe, expect, it, vi } from "vitest";
import { withHeartbeat } from "../lib/heartbeat.js";

describe("withHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
  });

  it("returns the wrapped result and cleans up on success", async () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    vi.useFakeTimers();
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    const promise = withHeartbeat("Syncing", async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return 42;
    });

    await vi.advanceTimersByTimeAsync(600);
    await expect(promise).resolves.toBe(42);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes).toEqual([
      "\r⠋ Syncing (0.5s)",
      "\r⠙ Syncing (0.6s)",
      "\r\x1b[2K",
    ]);
  });

  it("cleans up and rethrows when the wrapped function fails", async () => {
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
    vi.useFakeTimers();
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    const promise = withHeartbeat("Failing", async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw new Error("boom");
    });
    const expectation = expect(promise).rejects.toThrow("boom");

    await vi.advanceTimersByTimeAsync(600);
    await expectation;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes).toEqual([
      "\r⠋ Failing (0.5s)",
      "\r⠙ Failing (0.6s)",
      "\r\x1b[2K",
    ]);
  });
});
