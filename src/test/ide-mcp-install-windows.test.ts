import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock("child_process", () => childProcessMocks);

import { resolveGnosysMcpCommand, runCli } from "../lib/ideMcpInstall.js";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const originalComSpec = process.env.ComSpec;
const originalUpperComSpec = process.env.COMSPEC;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    ...originalPlatform,
    value: platform,
  });
}

describe("ideMcpInstall Windows command handling", () => {
  beforeEach(() => {
    childProcessMocks.execFileSync.mockReset();
    childProcessMocks.execSync.mockReset();
    setPlatform("win32");
    // Windows env keys are case-insensitive: deleting COMSPEC after setting
    // ComSpec would delete the value just set.
    delete process.env.COMSPEC;
    process.env.ComSpec = "C:\\Windows\\System32\\cmd.exe";
  });

  afterEach(() => {
    if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    if (originalComSpec === undefined) delete process.env.ComSpec;
    else process.env.ComSpec = originalComSpec;
    if (originalUpperComSpec === undefined) delete process.env.COMSPEC;
    else process.env.COMSPEC = originalUpperComSpec;
  });

  it("uses the first non-empty where.exe result and suppresses probe stderr", () => {
    childProcessMocks.execFileSync.mockReturnValueOnce(
      "\r\nC:\\Users\\Edward\\AppData\\Roaming\\npm\\gnosys-mcp.cmd\r\nC:\\fallback\\gnosys-mcp.cmd\r\n",
    );

    expect(resolveGnosysMcpCommand()).toBe(
      "C:\\Users\\Edward\\AppData\\Roaming\\npm\\gnosys-mcp.cmd",
    );
    expect(childProcessMocks.execFileSync).toHaveBeenCalledWith(
      "where.exe",
      ["gnosys-mcp"],
      expect.objectContaining({
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }),
    );
  });

  it("runs an npm .cmd shim through ComSpec with space-safe arguments", () => {
    childProcessMocks.execFileSync
      .mockReturnValueOnce("C:\\Users\\Edward\\AppData\\Roaming\\npm\\claude.cmd\r\n")
      .mockReturnValueOnce("registered");

    const mcpCommand = "C:\\Program Files\\gnosys\\gnosys-mcp.cmd";
    expect(runCli("claude", ["mcp", "add", "gnosys", "--", mcpCommand])).toBe("registered");

    const invocation = childProcessMocks.execFileSync.mock.calls[1];
    expect(invocation?.[0]).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(invocation?.[1]).toEqual([
      "/d",
      "/s",
      "/c",
      '""C:\\Users\\Edward\\AppData\\Roaming\\npm\\claude.cmd" "mcp" "add" "gnosys" "--" "C:\\Program Files\\gnosys\\gnosys-mcp.cmd""',
    ]);
    expect(invocation?.[2]).toEqual(expect.objectContaining({
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsVerbatimArguments: true,
    }));
  });

  it("also runs an explicit .bat path through ComSpec without a PATH probe", () => {
    childProcessMocks.execFileSync.mockReturnValueOnce("ok");

    expect(runCli("C:\\Program Files\\Tools\\codex.bat", ["mcp", "list"])).toBe("ok");
    expect(childProcessMocks.execFileSync).toHaveBeenCalledTimes(1);
    expect(childProcessMocks.execFileSync.mock.calls[0]?.[0]).toBe(
      "C:\\Windows\\System32\\cmd.exe",
    );
    expect(childProcessMocks.execFileSync.mock.calls[0]?.[1]).toEqual([
      "/d",
      "/s",
      "/c",
      '""C:\\Program Files\\Tools\\codex.bat" "mcp" "list""',
    ]);
  });

  it("runs an npm PowerShell shim through powershell.exe", () => {
    const shim = "C:\\Users\\Edward\\AppData\\Roaming\\npm\\claude.ps1";
    childProcessMocks.execFileSync
      .mockReturnValueOnce(`${shim}\r\n`)
      .mockReturnValueOnce("registered");

    expect(runCli("claude", ["mcp", "list"])).toBe("registered");
    expect(childProcessMocks.execFileSync.mock.calls[1]?.[0]).toBe("powershell.exe");
    expect(childProcessMocks.execFileSync.mock.calls[1]?.[1]).toEqual([
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      shim,
      "mcp",
      "list",
    ]);
  });

  it("reports a missing Windows CLI without leaking where.exe shell noise", () => {
    const probeError = Object.assign(
      new Error("INFO: Could not find files for the given pattern(s)."),
      { code: "ENOENT", stderr: "'claude' is not recognized as a command" },
    );
    childProcessMocks.execFileSync.mockImplementation(() => {
      throw probeError;
    });

    expect(() => runCli("claude", ["mcp", "list"])).toThrow(
      'CLI binary "claude" was not found on PATH.',
    );
    expect(childProcessMocks.execFileSync).toHaveBeenCalledWith(
      "where.exe",
      ["claude"],
      expect.objectContaining({ stdio: ["pipe", "pipe", "ignore"] }),
    );
  });

  it("keeps non-Windows CLI execution on the direct execFileSync path", () => {
    setPlatform("linux");
    childProcessMocks.execFileSync.mockReturnValueOnce("ok");

    expect(runCli("claude", ["mcp", "list"])).toBe("ok");
    expect(childProcessMocks.execFileSync).toHaveBeenCalledWith(
      "claude",
      ["mcp", "list"],
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("keeps the original non-Windows missing-binary error", () => {
    setPlatform("darwin");
    const originalError = Object.assign(new Error("spawnSync claude ENOENT"), { code: "ENOENT" });
    childProcessMocks.execFileSync.mockImplementationOnce(() => {
      throw originalError;
    });

    let received: unknown;
    try {
      runCli("claude", ["mcp", "list"]);
    } catch (error) {
      received = error;
    }
    expect(received).toBe(originalError);
  });
});
