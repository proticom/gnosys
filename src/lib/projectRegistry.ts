/**
 * The file-based project registry (`~/.config/gnosys/projects.json`): a JSON
 * array of absolute project paths. Shared by `gnosys cleanup` and
 * `gnosys project relocate`.
 */

import fs from "fs/promises";
import path from "path";
import { getProjectRegistryPath } from "./paths.js";
import { atomicWriteFile } from "./atomicWrite.js";

/** Registry entries in file order. Missing or unparseable registry → []. */
export async function readRegistryEntries(): Promise<string[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(getProjectRegistryPath(), "utf-8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Write the registry, dropping later duplicates of the same resolved path. */
export async function writeRegistryEntries(entries: string[]): Promise<void> {
  const seen = new Set<string>();
  const deduped = entries.filter((e) => {
    const resolved = path.resolve(e);
    if (seen.has(resolved)) return false;
    seen.add(resolved);
    return true;
  });
  const registryPath = getProjectRegistryPath();
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await atomicWriteFile(registryPath, JSON.stringify(deduped, null, 2));
}

/** The projectId in `<dir>/.gnosys/gnosys.json`, or null. */
export async function readProjectIdAt(dir: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(path.join(dir, ".gnosys", "gnosys.json"), "utf-8"),
    ) as { projectId?: unknown };
    return typeof parsed.projectId === "string" && parsed.projectId ? parsed.projectId : null;
  } catch {
    return null;
  }
}
