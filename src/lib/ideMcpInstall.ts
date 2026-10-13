/**
 * Shared stdio MCP install helpers for IDE setup (`gnosys setup ides`).
 */

import { execFileSync, execSync } from "child_process";
import path from "path";
import os from "os";
import { mergeJsonMcpServer } from "./mcpClientConfig.js";

const WINDOWS_BATCH_EXTENSION = /\.(?:cmd|bat)$/i;
const WINDOWS_POWERSHELL_EXTENSION = /\.ps1$/i;
const WINDOWS_PATH_SEPARATOR = /[\\/]/;

/** IDE keys handled by `setupIDE()`. */
export const SUPPORTED_IDE_KEYS = [
  "claude",
  "claude-desktop",
  "cursor",
  "codex",
  "gemini-cli",
  "antigravity",
  "grok-build",
] as const;

export type SupportedIde = (typeof SUPPORTED_IDE_KEYS)[number];

/** User-facing aliases → canonical IDE key. */
export const IDE_ALIASES: Record<string, SupportedIde> = {
  grok: "grok-build",
  "grok-build": "grok-build",
};

export function normalizeIdeKey(ide: string): SupportedIde | null {
  const key = ide.toLowerCase();
  if ((SUPPORTED_IDE_KEYS as readonly string[]).includes(key)) {
    return key as SupportedIde;
  }
  return IDE_ALIASES[key] ?? null;
}

/** Absolute path to `gnosys-mcp` when on PATH, else bare name. */
export function resolveGnosysMcpCommand(): string {
  if (process.platform === "win32") {
    return resolveWindowsPathCommand("gnosys-mcp") ?? "gnosys-mcp";
  }

  try {
    const p = execSync("command -v gnosys-mcp", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (p) return p;
  } catch {
    // Fall back to bare name on PATH.
  }
  return "gnosys-mcp";
}

export function gnosysStdioMcpEntry(): { command: string; args: string[] } {
  return { command: resolveGnosysMcpCommand(), args: [] };
}

/** True when an existing JSON MCP entry still points at broken `gnosys serve`. */
export function isStaleGnosysMcpEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as { command?: unknown; args?: unknown };
  const cmd = String(e.command ?? "");
  const args = Array.isArray(e.args) ? e.args.map(String) : [];
  if (cmd.includes("gnosys-mcp")) return false;
  if (cmd.endsWith("/gnosys") || cmd === "gnosys") {
    return args.includes("serve") || args.length === 0;
  }
  return false;
}

/** Merge (or replace) the gnosys stdio entry in a JSON MCP config file. */
export async function installStdioMcpJson(file: string): Promise<void> {
  await mergeJsonMcpServer(file, gnosysStdioMcpEntry());
}

/** Project + user-global Cursor MCP paths. */
export function cursorMcpPaths(projectDir: string): { project: string; user: string } {
  return {
    project: path.join(projectDir, ".cursor", "mcp.json"),
    user: path.join(os.homedir(), ".cursor", "mcp.json"),
  };
}

/** Run a CLI with argv (safe for paths containing spaces). */
export function runCli(
  command: string,
  args: string[],
  opts?: { allowFailure?: boolean },
): string {
  let invokedCommand = command;
  let invokedArgs = args;
  let windowsVerbatimArguments = false;

  try {
    if (process.platform === "win32") {
      const resolvedCommand = WINDOWS_PATH_SEPARATOR.test(command)
        ? command
        : resolveWindowsPathCommand(command);
      if (!resolvedCommand) {
        throw cliBinaryNotFound(command);
      }

      if (WINDOWS_BATCH_EXTENSION.test(resolvedCommand)) {
        invokedCommand = process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe";
        invokedArgs = windowsBatchArguments(resolvedCommand, args);
        windowsVerbatimArguments = true;
      } else if (WINDOWS_POWERSHELL_EXTENSION.test(resolvedCommand)) {
        invokedCommand = "powershell.exe";
        invokedArgs = [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          resolvedCommand,
          ...args,
        ];
      } else {
        invokedCommand = resolvedCommand;
      }
    }

    return execFileSync(invokedCommand, invokedArgs, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...(windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
    });
  } catch (err) {
    if (opts?.allowFailure) {
      return err instanceof Error && "stdout" in err ? String((err as { stdout?: string }).stdout ?? "") : "";
    }
    if (process.platform === "win32" && isMissingBinaryError(err)) {
      throw cliBinaryNotFound(command);
    }
    throw err;
  }
}

/** Resolve the first non-empty `where.exe` match without leaking probe errors. */
function resolveWindowsPathCommand(command: string): string | null {
  try {
    const output = execFileSync("where.exe", [command], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null;
  } catch {
    return null;
  }
}

/**
 * Build one quoted `cmd.exe /c` command string for an npm batch shim. Quoting
 * every token keeps paths containing spaces intact; the additional outer pair
 * is required by cmd.exe when the command itself begins with a quoted path.
 */
function windowsBatchArguments(command: string, args: string[]): string[] {
  const commandLine = [command, ...args]
    .map((value) => `"${value.replaceAll('"', '""')}"`)
    .join(" ");
  return ["/d", "/s", "/c", `"${commandLine}"`];
}

function isMissingBinaryError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function cliBinaryNotFound(command: string): Error {
  return new Error(`CLI binary "${command}" was not found on PATH.`);
}

/** Remove a `[section]` block from hand-rolled TOML text. */
export function removeTomlSection(existing: string, sectionHeader: string): string {
  const lines = existing.split("\n");
  const headerIdx = lines.findIndex((line) => line.trim() === sectionHeader);
  if (headerIdx === -1) return existing;

  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const before = lines.slice(0, headerIdx).join("\n");
  const after = lines.slice(endIdx).join("\n");
  const merged = [before, after].filter((s) => s.length > 0).join("\n");
  return merged.length > 0 ? `${merged.replace(/\n{3,}/g, "\n\n")}\n` : "";
}
