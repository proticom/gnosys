// v5.14.x overnight sprint — priority 4 (non-TTY guards for interactive
// setup flows). Guards prevent ERR_USE_AFTER_CLOSE stack traces when e.g.
// `gnosys setup dream` runs with stdin closed.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  guardInteractiveStdin,
  nonInteractiveMessage,
  stdinIsInteractive,
} from "../lib/interactiveGuard.js";

describe("interactive stdin guard (sprint 2026-07-02)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("message names the flow and explains the TTY requirement", () => {
    const msg = nonInteractiveMessage("setup dream");
    expect(msg).toContain("gnosys setup dream");
    expect(msg).toMatch(/not a TTY/);
  });

  it("stdinIsInteractive reflects process.stdin.isTTY", () => {
    expect(stdinIsInteractive()).toBe(Boolean(process.stdin.isTTY));
  });

  it("exits 1 with a single friendly stderr line when stdin is not a TTY", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
    try {
      expect(() => guardInteractiveStdin("setup dream")).toThrow("exit:1");
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(String(errSpy.mock.calls[0][0])).toContain("setup dream");
    } finally {
      if (original) Object.defineProperty(process.stdin, "isTTY", original);
      else Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
      exitSpy.mockRestore();
    }
  });

  it("is a no-op when stdin is a TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    try {
      expect(() => guardInteractiveStdin("setup")).not.toThrow();
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
      exitSpy.mockRestore();
    }
  });
});
