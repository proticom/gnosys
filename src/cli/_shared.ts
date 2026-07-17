/**
 * Gnosys CLI — shared helpers extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { GnosysResolver } from "../lib/resolver.js";
import { findProjectIdentity } from "../lib/projectIdentity.js";

// Read version from package.json at build time
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
export const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

export async function getResolver(): Promise<GnosysResolver> {
  const resolver = new GnosysResolver();
  await resolver.resolve();
  return resolver;
}

/**
 * v3.0: Resolve projectId from nearest .gnosys/gnosys.json.
 * Used by CLI write commands to tag memories with the correct project.
 */
export async function resolveProjectId(dir?: string): Promise<string | null> {
  const result = await findProjectIdentity(dir || process.cwd());
  return result?.identity.projectId || null;
}

/**
 * Output helper: if --json flag is set, output JSON; otherwise call the
 * human-readable formatter function.
 */
export function outputResult(json: boolean, data: unknown, humanFn: () => void): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    humanFn();
  }
}
