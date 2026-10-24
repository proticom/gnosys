/**
 * IDE MCP install audit for stable binaries and npx-only installs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import os from "os";

const childProcessMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock("child_process", () => childProcessMocks);

import {
  normalizeIdeKey,
  isStaleGnosysMcpEntry,
  gnosysStdioMcpEntry,
  resolveGnosysStdioCommand,
  cursorMcpPaths,
  removeTomlSection,
} from "../lib/ideMcpInstall.js";
import { setupIDE } from "../lib/setup.js";
import { upsertGrokMcpBlock } from "../lib/setup.js";
import { getClaudeDesktopConfigPath } from "../lib/platform.js";

const globalCommand = "/usr/local/bin/gnosys-mcp";
const npxEntry = { command: "npx", args: ["-y", "gnosys", "serve"] };
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
let testRoot: string;

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), "gnosys-ide-mcp-env-"));
  vi.stubEnv("HOME", testRoot);
  vi.stubEnv("GNOSYS_HOME", join(testRoot, "brain"));
  vi.spyOn(os, "homedir").mockImplementation(() => process.env.HOME ?? testRoot);
  Object.defineProperty(process, "platform", { ...originalPlatform, value: "linux" });
  childProcessMocks.execSync.mockReset().mockReturnValue(globalCommand);
  childProcessMocks.execFileSync.mockReset().mockReturnValue("");
});

afterEach(() => {
  if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(testRoot, { recursive: true, force: true });
});

function assertGnosysMcp(entry: unknown): void {
  expect(entry).toEqual({ command: globalCommand, args: [] });
  expect(isStaleGnosysMcpEntry(entry)).toBe(false);
}

describe("ideMcpInstall helpers", () => {
  it("normalizeIdeKey accepts grok alias", () => {
    expect(normalizeIdeKey("grok")).toBe("grok-build");
    expect(normalizeIdeKey("cursor")).toBe("cursor");
    expect(normalizeIdeKey("nosuch")).toBeNull();
  });

  it("detects stale gnosys serve entries", () => {
    expect(isStaleGnosysMcpEntry({ command: "gnosys", args: ["serve"] })).toBe(true);
    expect(isStaleGnosysMcpEntry({ command: "/bin/gnosys-mcp", args: [] })).toBe(false);
  });

  it("keeps the global binary path and empty args", () => {
    expect(resolveGnosysStdioCommand()).toEqual({ command: globalCommand, args: [] });
    assertGnosysMcp(gnosysStdioMcpEntry());
  });

  it.each([
    "/home/user/.npm/_npx/123/node_modules/.bin/gnosys-mcp",
    "C:\\Users\\Edward\\npm-cache\\_NpX\\123\\gnosys-mcp.cmd",
    "",
  ])("uses npx serve when PATH lookup returns %j", (command) => {
    childProcessMocks.execSync.mockReturnValue(command);
    expect(resolveGnosysStdioCommand()).toEqual(npxEntry);
    expect(gnosysStdioMcpEntry()).toEqual(npxEntry);
  });

  it("uses npx serve when the PATH probe fails", () => {
    childProcessMocks.execSync.mockImplementation(() => { throw new Error("not found"); });
    expect(resolveGnosysStdioCommand()).toEqual(npxEntry);
  });

  it.each([
    "/home/user/.npm/_npx/123/node_modules/.bin/gnosys-mcp",
    "C:\\Users\\Edward\\npm-cache\\_NPX\\123\\gnosys-mcp.cmd",
  ])("marks cached command %j stale", (command) => {
    expect(isStaleGnosysMcpEntry({ command, args: [] })).toBe(true);
  });

  it("keeps the new npx entry current", () => {
    expect(isStaleGnosysMcpEntry(npxEntry)).toBe(false);
    expect(isStaleGnosysMcpEntry({ command: "C:\\npm\\npx.cmd", args: npxEntry.args })).toBe(false);
  });

  it("requires a full _npx path segment", () => {
    const command = "/opt/not_npx/_npx-tools/gnosys-mcp";
    childProcessMocks.execSync.mockReturnValue(command);
    expect(resolveGnosysStdioCommand()).toEqual({ command, args: [] });
    expect(isStaleGnosysMcpEntry({ command, args: [] })).toBe(false);
  });
});

describe("setupIDE MCP outputs", () => {
  let projectDir: string;
  let fakeHome: string;
  let savedHome: string | undefined;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "gnosys-ide-mcp-"));
    fakeHome = mkdtempSync(join(tmpdir(), "gnosys-fake-home-"));
    savedHome = process.env.HOME;
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    if (savedHome !== undefined) process.env.HOME = savedHome;
    else delete process.env.HOME;
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("cursor writes project and user mcp.json", async () => {
    const r = await setupIDE("cursor", projectDir);
    expect(r.success).toBe(true);
    const paths = cursorMcpPaths(projectDir);
    for (const p of [paths.project, paths.user]) {
      const cfg = JSON.parse(readFileSync(p, "utf-8")) as { mcpServers?: Record<string, unknown> };
      assertGnosysMcp(cfg.mcpServers?.gnosys);
    }
  });

  it("grok writes mcp_servers.gnosys in ~/.grok/config.toml", async () => {
    const r = await setupIDE("grok", projectDir);
    expect(r.success).toBe(true);
    const toml = readFileSync(join(fakeHome, ".grok", "config.toml"), "utf-8");
    expect(toml).toContain("[mcp_servers.gnosys]");
    expect(toml).not.toContain("[mcp.gnosys]");
    expect(toml).toContain(`command = "${globalCommand}"\nargs = []`);
    expect(toml).toContain("startup_timeout_sec = 90");
  });

  it("gemini-cli and antigravity write mcpServers.gnosys", async () => {
    for (const ide of ["gemini-cli", "antigravity"] as const) {
      const r = await setupIDE(ide, projectDir);
      expect(r.success).toBe(true);
    }
    const gemini = JSON.parse(
      readFileSync(join(fakeHome, ".gemini", "settings.json"), "utf-8"),
    ) as { mcpServers?: Record<string, unknown> };
    assertGnosysMcp(gemini.mcpServers?.gnosys);

    const ag = JSON.parse(
      readFileSync(join(fakeHome, ".gemini", "antigravity", "mcp_config.json"), "utf-8"),
    ) as { mcpServers?: Record<string, unknown> };
    assertGnosysMcp(ag.mcpServers?.gnosys);
  });

  it("claude-desktop writes mcpServers.gnosys", async () => {
    const r = await setupIDE("claude-desktop", projectDir);
    expect(r.success).toBe(true);
    const cfgPath = getClaudeDesktopConfigPath();
    const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    assertGnosysMcp(cfg.mcpServers?.gnosys);
  });

  it.each(["cursor", "claude-desktop", "gemini-cli", "antigravity"])(
    "%s replaces a cached entry with npx and is idempotent",
    async (ide) => {
      childProcessMocks.execSync.mockReturnValue("/tmp/_npx/123/node_modules/.bin/gnosys-mcp");
      const file = ide === "cursor" ? cursorMcpPaths(projectDir).project
        : ide === "claude-desktop" ? getClaudeDesktopConfigPath()
        : ide === "gemini-cli" ? join(fakeHome, ".gemini", "settings.json")
        : join(fakeHome, ".gemini", "antigravity", "mcp_config.json");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({
        mcpServers: {
          other: { command: "other-server", args: [] },
          gnosys: { command: "/tmp/_npx/old/gnosys-mcp", args: [] },
        },
      }));

      expect((await setupIDE(ide, projectDir)).success).toBe(true);
      const first = readFileSync(file, "utf-8");
      expect(JSON.parse(first)).toEqual({
        mcpServers: { other: { command: "other-server", args: [] }, gnosys: npxEntry },
      });
      if (ide === "cursor") {
        expect(JSON.parse(readFileSync(cursorMcpPaths(projectDir).user, "utf-8"))).toEqual({
          mcpServers: { gnosys: npxEntry },
        });
      }
      expect((await setupIDE(ide, projectDir)).success).toBe(true);
      expect(readFileSync(file, "utf-8")).toBe(first);
    },
  );

  it("grok writes npx command and args and is idempotent", async () => {
    childProcessMocks.execSync.mockReturnValue("");
    expect((await setupIDE("grok", projectDir)).success).toBe(true);
    const file = join(fakeHome, ".grok", "config.toml");
    const first = readFileSync(file, "utf-8");
    expect(first).toBe('[mcp_servers.gnosys]\ncommand = "npx"\nargs = ["-y", "gnosys", "serve"]\nstartup_timeout_sec = 90\n');
    expect((await setupIDE("grok", projectDir)).success).toBe(true);
    expect(readFileSync(file, "utf-8")).toBe(first);
  });
});

describe("removeTomlSection — Codex legacy cleanup", () => {
  it("removes [gnosys] regardless of field order", () => {
    const before = `[other]
x = 1

[gnosys]
args = ["serve"]
command = "gnosys"

[mcp.gnosys]
type = "local"
command = ["gnosys", "serve"]
`;
    let out = removeTomlSection(before, "[mcp.gnosys]");
    out = removeTomlSection(out, "[gnosys]");
    expect(out).not.toContain("[gnosys]");
    expect(out).not.toContain("[mcp.gnosys]");
    expect(out).toContain("[other]");
  });
});

describe("CLI MCP registration", () => {
  const cases = [
    { lookup: globalCommand, command: globalCommand, args: [] },
    { lookup: "/tmp/_npx/123/node_modules/.bin/gnosys-mcp", ...npxEntry },
    { lookup: "", ...npxEntry },
  ];

  it.each(cases)("Claude Code registers $command with $args", async ({ lookup, command, args }) => {
    childProcessMocks.execSync.mockReturnValue(lookup);
    const result = await setupIDE("claude", testRoot);
    expect(result.success).toBe(true);
    expect(childProcessMocks.execFileSync).toHaveBeenCalledWith(
      "claude", ["mcp", "add", "-s", "user", "gnosys", "--", command, ...args],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it.each(cases)("Codex registers $command with $args and keeps it on rerun", async ({ lookup, command, args }) => {
    childProcessMocks.execSync.mockReturnValue(lookup);
    let stored = JSON.stringify({ transport: { type: "stdio", command: "/tmp/_npx/old/gnosys-mcp", args: [] } });
    childProcessMocks.execFileSync.mockImplementation((_command: string, argv: string[]) => {
      if (argv[1] === "get") return stored;
      if (argv[1] === "remove") stored = "";
      if (argv[1] === "add") {
        stored = JSON.stringify({ transport: { type: "stdio", command: argv[4], args: argv.slice(5) } });
      }
      return "";
    });

    expect((await setupIDE("codex", testRoot)).success).toBe(true);
    expect(JSON.parse(stored)).toEqual({ transport: { type: "stdio", command, args } });
    const rerun = await setupIDE("codex", testRoot);
    expect(rerun.success).toBe(true);
    expect(rerun.message).toContain("already registered");
    expect(childProcessMocks.execFileSync.mock.calls.map(([cli, argv]) => [cli, argv])).toEqual([
      ["codex", ["mcp", "get", "gnosys", "--json"]],
      ["codex", ["mcp", "remove", "gnosys"]],
      ["codex", ["mcp", "add", "gnosys", "--", command, ...args]],
      ["codex", ["mcp", "get", "gnosys", "--json"]],
    ]);
  });

  it("Codex replaces an npx entry with different args", async () => {
    childProcessMocks.execSync.mockReturnValue("");
    childProcessMocks.execFileSync.mockReturnValue(JSON.stringify({
      transport: { type: "stdio", command: "npx", args: ["-y", "gnosys@7.0.0", "serve"] },
    }));
    expect((await setupIDE("codex", testRoot)).success).toBe(true);
    expect(childProcessMocks.execFileSync.mock.calls.map(([, argv]) => argv)).toEqual([
      ["mcp", "get", "gnosys", "--json"],
      ["mcp", "remove", "gnosys"],
      ["mcp", "add", "gnosys", "--", "npx", "-y", "gnosys", "serve"],
    ]);
  });
});

describe("setupIDE(claude) resilience", () => {
  let projectDir: string;
  let savedPath: string | undefined;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "gnosys-claude-res-"));
    savedPath = process.env.PATH;
    process.env.PATH = "/usr/empty";
  });

  afterEach(() => {
    if (savedPath !== undefined) process.env.PATH = savedPath;
    else delete process.env.PATH;
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("still writes Claude Desktop when claude CLI is unavailable", async () => {
    childProcessMocks.execSync.mockReturnValue("");
    childProcessMocks.execFileSync.mockImplementation(() => { throw new Error("spawnSync claude ENOENT"); });
    const fakeHome = mkdtempSync(join(tmpdir(), "gnosys-claude-home-"));
    const savedHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const r = await setupIDE("claude", projectDir);
      expect(r.message).toMatch(/Claude Desktop MCP config updated/);
      const cfgPath = getClaudeDesktopConfigPath();
      const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      expect(cfg.mcpServers?.gnosys).toEqual(npxEntry);
    } finally {
      process.env.HOME = savedHome;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe("upsertGrokMcpBlock", () => {
  it("uses mcp_servers header per Grok Build spec", () => {
    const out = upsertGrokMcpBlock("", "gnosys", {
      command: "/usr/local/bin/gnosys-mcp",
      args: [],
      startup_timeout_sec: 90,
    });
    expect(out).toBe('[mcp_servers.gnosys]\ncommand = "/usr/local/bin/gnosys-mcp"\nargs = []\nstartup_timeout_sec = 90\n');
  });
});
