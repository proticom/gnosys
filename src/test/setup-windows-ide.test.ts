import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getClaudeDesktopConfigPath } from "../lib/platform.js";
import { isClaudeDesktopInstalled, setupIDE } from "../lib/setup.js";
import { ideTarget } from "../lib/setup/sections/ides.js";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const savedEnvironment = {
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  HOME: process.env.HOME,
  PATH: process.env.PATH,
};

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    ...originalPlatform,
    value: platform,
  });
}

describe("Windows Claude Desktop setup", () => {
  let testRoot: string;
  let appData: string;
  let localAppData: string;

  beforeEach(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-windows-setup-"));
    appData = path.join(testRoot, "Roaming");
    localAppData = path.join(testRoot, "Local");
    process.env.APPDATA = appData;
    process.env.LOCALAPPDATA = localAppData;
    process.env.HOME = testRoot;
    process.env.PATH = "";
    setPlatform("win32");
  });

  afterEach(() => {
    if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it("does not treat the config directory alone as an installed app", async () => {
    fs.mkdirSync(path.join(appData, "Claude"), { recursive: true });
    expect(await isClaudeDesktopInstalled()).toBe(false);

    fs.mkdirSync(path.join(localAppData, "AnthropicClaude"), { recursive: true });
    expect(await isClaudeDesktopInstalled()).toBe(true);
  });

  it("preserves config-directory detection on macOS", async () => {
    setPlatform("darwin");
    fs.mkdirSync(path.dirname(getClaudeDesktopConfigPath()), { recursive: true });

    expect(await isClaudeDesktopInstalled()).toBe(true);
  });

  it("uses the platform config path in the IDE table at runtime", () => {
    expect(ideTarget("claude-desktop")).toBe(getClaudeDesktopConfigPath());
  });

  it("prints the full absolute Claude Desktop file it verified", async () => {
    const result = await setupIDE("claude-desktop", testRoot);
    const expectedPath = path.resolve(getClaudeDesktopConfigPath());

    expect(result.success).toBe(true);
    expect(result.message).toContain(expectedPath);
    expect(result.message).not.toContain("~\\");
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it("returns separate truthful outcomes when Claude Code is unavailable", async () => {
    const result = await setupIDE("claude", testRoot);

    expect(result.success).toBe(false);
    expect(result.components).toEqual([
      expect.objectContaining({ ide: "claude", label: "Claude Code", success: false }),
      expect.objectContaining({
        ide: "claude-desktop",
        label: "Claude Desktop",
        success: true,
      }),
    ]);
    expect(result.components?.[0]?.message).toContain(
      'CLI binary "claude" was not found on PATH.',
    );
  });
});
