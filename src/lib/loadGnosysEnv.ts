import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

export interface LoadGnosysEnvOptions {
  /**
   * Keys that must not be copied out of the file.
   * The CLI passes the memory-delete override: a .env file can be written
   * by an agent, so that key stays human-only.
   */
  skipKeys?: readonly string[];
}

let loaded = false;

/**
 * Copy unset keys from ~/.config/gnosys/.env into process.env.
 *
 * Call this only from the CLI entry point and the MCP server entry point.
 * A library import of `gnosys` must not mutate the host process environment.
 *
 * IMPORTANT: We use dotenv.parse() instead of dotenv.config() because
 * dotenv v17+ writes injection notices to stdout, which corrupts the
 * MCP stdio JSON protocol and CLI --json / piped output.
 * parse() is a pure function with no side effects.
 *
 * Existing process.env values win. The first call in a process wins outright,
 * so a later call (for example `gnosys serve` starting the MCP server after
 * the CLI already loaded the file) cannot fill in keys the first caller skipped.
 */
export function loadGnosysEnv(options?: LoadGnosysEnvOptions): void {
  if (loaded) return;
  loaded = true;
  const skip = new Set(options?.skipKeys ?? []);
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  try {
    const envFile = readFileSync(path.join(home, ".config", "gnosys", ".env"), "utf8");
    const parsed = dotenv.parse(envFile);
    for (const [key, val] of Object.entries(parsed)) {
      if (!(key in process.env) && !skip.has(key)) process.env[key] = val;
    }
  } catch {
    // .env file not found — that's fine, env vars may be set elsewhere
  }
}
