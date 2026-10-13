/**
 * Point an IDE at a REMOTE gnosys server (v5.12 Phase B).
 *
 * In the central-server topology, a client machine doesn't spawn a local
 * `gnosys serve` — its IDE connects to the host's URL. This writes the URL-based
 * MCP entry into the IDE config (instead of the `{ command, args }` stdio form
 * the local setup writes).
 */

import fs from "fs/promises";
import path from "path";
import { isDeepStrictEqual } from "util";
import { getClaudeDesktopConfigPath } from "./platform.js";

export interface RemoteOpts {
  url: string;
  token?: string;
}

/** The MCP server entry for a remote (HTTP/URL) gnosys server. */
export function remoteMcpEntry(opts: RemoteOpts): Record<string, unknown> {
  return {
    url: opts.url,
    ...(opts.token ? { headers: { Authorization: `Bearer ${opts.token}` } } : {}),
  };
}

function parseMcpConfig(file: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in MCP config at "${file}": ${detail}`, { cause: error });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid MCP config at "${file}": expected a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

/** Merge a `gnosys` entry into a JSON file's `mcpServers` map (create if absent). */
export async function mergeJsonMcpServer(file: string, entry: Record<string, unknown>): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    config = parseMcpConfig(file, await fs.readFile(file, "utf-8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const existingServers = config.mcpServers;
  if (
    existingServers !== undefined &&
    (existingServers === null || typeof existingServers !== "object" || Array.isArray(existingServers))
  ) {
    throw new Error(`Invalid MCP config at "${file}": "mcpServers" must be a JSON object`);
  }

  const servers = (existingServers ?? {}) as Record<string, unknown>;
  servers.gnosys = entry;
  config.mcpServers = servers;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + "\n", "utf-8");

  let written: Record<string, unknown>;
  try {
    written = parseMcpConfig(file, await fs.readFile(file, "utf-8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not verify MCP config at "${file}" after writing: ${detail}`, {
      cause: error,
    });
  }
  const writtenServers = written.mcpServers;
  const writtenEntry =
    writtenServers !== null && typeof writtenServers === "object" && !Array.isArray(writtenServers)
      ? (writtenServers as Record<string, unknown>).gnosys
      : undefined;
  if (!isDeepStrictEqual(writtenEntry, entry)) {
    throw new Error(
      `Could not verify MCP config at "${file}" after writing: mcpServers.gnosys does not match the requested entry`,
    );
  }
}

/** Write the remote entry into a project's `.cursor/mcp.json`. Returns the path. */
export async function writeCursorRemote(projectDir: string, opts: RemoteOpts): Promise<string> {
  const file = path.join(projectDir, ".cursor", "mcp.json");
  await mergeJsonMcpServer(file, remoteMcpEntry(opts));
  return file;
}

/** Write the remote entry into the Claude Desktop config. Returns the path. */
async function writeClaudeDesktopRemote(opts: RemoteOpts): Promise<string> {
  const file = getClaudeDesktopConfigPath();
  await mergeJsonMcpServer(file, remoteMcpEntry(opts));
  return file;
}

export type RemoteIde = "cursor" | "claude-desktop";

export async function writeRemoteClientConfig(
  ide: RemoteIde,
  projectDir: string,
  opts: RemoteOpts,
): Promise<string> {
  return ide === "claude-desktop"
    ? writeClaudeDesktopRemote(opts)
    : writeCursorRemote(projectDir, opts);
}
