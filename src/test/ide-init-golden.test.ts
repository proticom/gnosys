/**
 * IDE init golden tests — per-IDE rules block matches fixtures; MCP configs structurally validated.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateRulesBlock, syncToTarget } from "../lib/rulesGen.js";
import { GnosysDB } from "../lib/db.js";
import os from "node:os";
import { setupIDE } from "../lib/setup.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "fixtures", "ide-init");

const MARKER_START = "<!-- GNOSYS:START -->";
const MARKER_END = "<!-- GNOSYS:END -->";

function wrapRulesBlock(block: string): string {
  return `${MARKER_START}\n${block}\n${MARKER_END}`;
}

const IDE_FIXTURES: Array<[string, string]> = [
  ["claude", "claude.md"],
  ["cursor", "cursor.mdc"],
  ["codex", "codex.md"],
];

const TARGET_PATHS: Record<string, string> = {
  claude: "CLAUDE.md",
  cursor: ".cursor/rules/gnosys.mdc",
  codex: ".codex/gnosys.md",
};

function assertMcpServerEntry(server: unknown): void {
  expect(server).toBeTruthy();
  const command = (server as { command?: unknown }).command;
  expect(typeof command).toBe("string");
  expect(String(command)).toMatch(/gnosys-mcp/);
  const args = (server as { args?: unknown }).args;
  expect(Array.isArray(args)).toBe(true);
}

describe("IDE init golden fixtures", () => {
  for (const [ide, fixtureFile] of IDE_FIXTURES) {
    it(`${ide} rules block matches golden (${TARGET_PATHS[ide]})`, async () => {
      const project = mkdtempSync(join(tmpdir(), "gnosys-ide-rules-"));
      const db = new GnosysDB(join(project, "db"));
      try {
        const results = await syncToTarget(db, project, ide, null);
        expect(results.map((result) => result.filePath)).toEqual([join(project, TARGET_PATHS[ide])]);
        expect(readFileSync(join(project, TARGET_PATHS[ide]), "utf8").trim()).toBe(readFileSync(join(FIXTURE_DIR, fixtureFile), "utf8").trim());
      } finally {
        db.close();
        rmSync(project, { recursive: true, force: true });
      }
    });
  }

  it("generateRulesBlock is deterministic with empty preferences", () => {
    const a = wrapRulesBlock(generateRulesBlock([], []));
    const b = wrapRulesBlock(generateRulesBlock([], []));
    expect(a).toBe(b);
    expect(a.trim()).toBe(readFileSync(join(FIXTURE_DIR, "claude.md"), "utf8").trim());
  });
});

describe("IDE init MCP config structure", () => {
  let projectDir: string;
  let savedHome: string | undefined;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "gnosys-ide-init-mcp-"));
    savedHome = process.env.HOME;
    process.env.HOME = projectDir;
    vi.spyOn(os, "homedir").mockImplementation(() => process.env.HOME || projectDir);
  });

  afterEach(() => {
    if (savedHome !== undefined) {
      process.env.HOME = savedHome;
    } else {
      delete process.env.HOME;
    }
    vi.restoreAllMocks();
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("cursor setupIDE writes mcpServers.gnosys with command and args", async () => {
    const result = await setupIDE("cursor", projectDir);
    expect(result.success).toBe(true);

    const mcpPath = join(projectDir, ".cursor", "mcp.json");
    const config = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    assertMcpServerEntry(config.mcpServers?.gnosys);
    expect(config.mcpServers?.gnosys).toMatchObject({ args: [] });
    expect((config.mcpServers!.gnosys as { command: string }).command).toMatch(/gnosys-mcp$/);
    expect((config.mcpServers!.gnosys as { args: string[] }).args).toEqual([]);
  });

  it("gemini-cli setupIDE writes mcpServers.gnosys under isolated HOME", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "gnosys-fake-home-gemini-"));
    process.env.HOME = fakeHome;

    const result = await setupIDE("gemini-cli", projectDir);
    expect(result.success).toBe(true);

    const settingsPath = join(fakeHome, ".gemini", "settings.json");
    const config = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    assertMcpServerEntry(config.mcpServers?.gnosys);
    expect(config.mcpServers?.gnosys).toMatchObject({ args: [] });

    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("antigravity setupIDE writes mcpServers.gnosys under isolated HOME", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "gnosys-fake-home-antigravity-"));
    process.env.HOME = fakeHome;

    const result = await setupIDE("antigravity", projectDir);
    expect(result.success).toBe(true);

    const configPath = join(fakeHome, ".gemini", "antigravity", "mcp_config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    assertMcpServerEntry(config.mcpServers?.gnosys);
    expect(config.mcpServers?.gnosys).toMatchObject({ args: [] });

    rmSync(fakeHome, { recursive: true, force: true });
  });
});
