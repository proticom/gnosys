// v5.14.x overnight sprint — priority 5 (setup dream launchctl load).
// Tests the pure helpers only; the execFileSync paths are best-effort
// side effects exercised manually on macOS.
import { describe, expect, it } from "vitest";
import {
  interpretLaunchctlLoadError,
  launchctlLoadArgs,
  launchctlUnloadArgs,
} from "../lib/dreamLaunchd.js";

describe("dream launchctl helpers (sprint 2026-07-02)", () => {
  it("builds load args with -w so a previously disabled agent is re-enabled", () => {
    expect(launchctlLoadArgs("/Users/x/Library/LaunchAgents/com.gnosys.dream.plist")).toEqual([
      "load",
      "-w",
      "/Users/x/Library/LaunchAgents/com.gnosys.dream.plist",
    ]);
  });

  it("builds unload args", () => {
    expect(launchctlUnloadArgs("/tmp/a.plist")).toEqual(["unload", "/tmp/a.plist"]);
  });

  it("treats 'already loaded' stderr as success", () => {
    const r = interpretLaunchctlLoadError("com.gnosys.dream: service already loaded");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/already loaded/i);
  });

  it("treats 'Load failed: 5' as already-loaded success", () => {
    expect(interpretLaunchctlLoadError("Load failed: 5: Input/output error").ok).toBe(true);
  });

  it("reports other errors as non-fatal failures mentioning next login", () => {
    const r = interpretLaunchctlLoadError("launchctl: command not found");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/next login/);
  });

  it("handles empty stderr", () => {
    const r = interpretLaunchctlLoadError("");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/launchctl load failed/);
  });
});
