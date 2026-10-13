/**
 * `gnosys cleanup` — remove stale entries from the project registry.
 *
 * Categories:
 *   alive — directory exists, has a `.gnosys/` subdir, and no other folder
 *           holds the same projectId
 *   moved — directory is alive, but another registered or discoverable
 *           (central DB) folder holds the same projectId. Kept, never
 *           auto-removed: the user picks the live copy with
 *           `gnosys project relocate <old> <new>`.
 *   dead  — directory missing (`missing`) or present without `.gnosys/`
 *   temp  — path under /tmp, /private/tmp, /var/folders, or os.tmpdir()
 *
 * Interactive mode (default): print the categorized list, then prompt
 * `Remove N entries? [Y/n]` before writing.
 *
 * Non-interactive mode (`--yes`): write the filtered registry directly.
 * `--dry-run` (or `interactive=false, yes=false`) just returns the diff
 * without writing.
 *
 * The registry is re-read and re-classified right before writing, and only
 * entries that were shown as stale AND are still stale get dropped, so an
 * edit made while the prompt was open is not overwritten. The central DB is
 * read (never written) to find where each project currently lives.
 */

import fsSync from "fs";
import path from "path";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { getCentralDbPath, isTempProjectPath } from "./paths.js";
import { readProjectIdAt, readRegistryEntries, writeRegistryEntries } from "./projectRegistry.js";
import { safeQuestion } from "./setup/ui/safePrompt.js";
import { nonInteractiveMessage } from "./interactiveGuard.js";
import { Header } from "./setup/ui/header.js";
import { Status } from "./setup/ui/status.js";
import { c, color, glyph } from "./setup/ui/tokens.js";

/** Folders that hold the same projectId. */
export interface MovedGroup {
  projectId: string;
  /** Registry entries first (file order), then discovered folders. */
  paths: string[];
  /** Where the central DB says this project lives, when that folder is in `paths`. */
  dbPath: string | null;
}

export interface ClassifiedRegistry {
  alive: string[];
  moved: string[];
  /** missing + present-without-.gnosys/ */
  dead: string[];
  /** Subset of `dead` whose folder does not exist at all. */
  missing: string[];
  temp: string[];
  movedGroups: MovedGroup[];
}

function isDirectory(p: string): boolean {
  try {
    return fsSync.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * projectId → this machine's path for every project in the central DB.
 * Opens the DB only when the file already exists, so classification never
 * creates a database as a side effect.
 */
export async function discoverDbProjectPaths(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (!fsSync.existsSync(getCentralDbPath())) return found;
  const { GnosysDB } = await import("./db.js");
  const { readMachineConfig } = await import("./machineConfig.js");
  const { effectiveProjectPath } = await import("./projectPaths.js");
  let db: InstanceType<typeof GnosysDB> | null = null;
  try {
    db = GnosysDB.openCentral();
    if (!db.isAvailable()) return found;
    const machine = readMachineConfig();
    for (const project of db.getAllProjects()) {
      const p = effectiveProjectPath(db, project, machine);
      if (p) found.set(project.id, path.resolve(p));
    }
  } catch {
    // Discovery is best-effort; registry-only classification still works.
  } finally {
    db?.close();
  }
  return found;
}

/** Classify an explicit list of registry entries. */
export async function classifyEntries(
  entries: string[],
  dbPaths: Map<string, string>,
): Promise<ClassifiedRegistry> {
  const result: ClassifiedRegistry = { alive: [], moved: [], dead: [], missing: [], temp: [], movedGroups: [] };
  const withStore: Array<{ entry: string; id: string | null }> = [];
  for (const e of entries) {
    if (isTempProjectPath(e)) {
      result.temp.push(e);
    } else if (!isDirectory(e)) {
      result.dead.push(e);
      result.missing.push(e);
    } else if (!isDirectory(path.join(e, ".gnosys"))) {
      result.dead.push(e);
    } else {
      withStore.push({ entry: e, id: await readProjectIdAt(e) });
    }
  }

  const pathsById = new Map<string, string[]>();
  for (const { entry, id } of withStore) {
    if (!id) continue;
    const paths = pathsById.get(id) ?? [];
    if (!paths.some((p) => path.resolve(p) === path.resolve(entry))) paths.push(entry);
    pathsById.set(id, paths);
  }
  for (const [id, paths] of pathsById) {
    const dbPath = dbPaths.get(id);
    if (!dbPath || paths.some((p) => path.resolve(p) === dbPath)) continue;
    if ((await readProjectIdAt(dbPath)) === id) paths.push(dbPath);
  }

  const movedIds = new Set<string>();
  for (const [id, paths] of pathsById) {
    if (paths.length < 2) continue;
    movedIds.add(id);
    const dbPath = dbPaths.get(id);
    result.movedGroups.push({
      projectId: id,
      paths,
      dbPath: dbPath && paths.some((p) => path.resolve(p) === dbPath) ? dbPath : null,
    });
  }
  for (const { entry, id } of withStore) {
    (id && movedIds.has(id) ? result.moved : result.alive).push(entry);
  }
  return result;
}

/**
 * Read the registry and classify each entry. Missing registry → empty
 * categories (caller can treat as nothing-to-do). `dbPaths` defaults to the
 * central DB's view of where each project lives.
 */
export async function classifyRegistryEntries(
  opts: { dbPaths?: Map<string, string> } = {},
): Promise<ClassifiedRegistry> {
  const dbPaths = opts.dbPaths ?? (await discoverDbProjectPaths());
  return classifyEntries(await readRegistryEntries(), dbPaths);
}

export interface CleanupOptions {
  /** Print the list and prompt before writing. */
  interactive: boolean;
  /** Non-interactive write (only used when `interactive === false`). */
  yes?: boolean;
  /** Suppress the dry-run listing (JSON callers print the result themselves). */
  quiet?: boolean;
  /** Optional readline (when called from inside `setup sync-projects`). */
  rl?: import("readline/promises").Interface;
}

/**
 * Registry entries by category, as reported in `gnosys cleanup --json`.
 * `moved` and `movedGroups` appear only when some folder shares a projectId
 * with another, so the JSON for a registry without moves is unchanged.
 */
export interface RegistryEntries {
  alive: string[];
  dead: string[];
  temp: string[];
  moved?: string[];
  movedGroups?: MovedGroup[];
}

export interface CleanupResult {
  /** Number of entries removed (dead + temp). */
  removed: number;
  /** Number of entries kept (alive + moved). */
  kept: number;
  /** True when the registry was actually rewritten. */
  wrote: boolean;
  /** Entries by category, before any write. */
  entries: RegistryEntries;
}

function toEntries(c: ClassifiedRegistry): RegistryEntries {
  const entries: RegistryEntries = { alive: c.alive, dead: c.dead, temp: c.temp };
  if (c.moved.length > 0) {
    entries.moved = c.moved;
    entries.movedGroups = c.movedGroups;
  }
  return entries;
}

function formatPath(p: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home && p.startsWith(home + path.sep)) {
    return `~${path.sep}${p.slice(home.length + 1)}`;
  }
  return p;
}

function printSection(title: string, note: string, paths: string[], mark: string): void {
  if (paths.length === 0) return;
  process.stdout.write(`\n ${color(c.text, title.padEnd(9))} ${color(c.textDim, `(${paths.length})${note ? ` — ${note}` : ""}`)}\n`);
  for (const p of paths) {
    process.stdout.write(`   ${mark}  ${color(c.textDim, formatPath(p))}\n`);
  }
}

function printMovedGroups(groups: MovedGroup[]): void {
  if (groups.length === 0) return;
  const count = groups.reduce((n, g) => n + g.paths.length, 0);
  process.stdout.write(`\n ${color(c.text, "moved".padEnd(9))} ${color(c.textDim, `(${groups.length} ${groups.length === 1 ? "project" : "projects"}, ${count} folders) — same projectId in more than one folder; kept`)}\n`);
  for (const g of groups) {
    process.stdout.write(`   ${color(c.warn, glyph.warn)}  ${color(c.textDim, g.projectId)}\n`);
    for (const p of g.paths) {
      const tag = p === g.dbPath ? "  (central DB location)" : "";
      process.stdout.write(`        ${color(c.textDim, formatPath(p) + tag)}\n`);
    }
    const target = g.dbPath ?? "<new>";
    const source = g.paths.find((p) => p !== g.dbPath) ?? "<old>";
    process.stdout.write(`        ${color(c.textDim, `fix: gnosys project relocate "${source}" "${target}"`)}\n`);
  }
}

function printCategorized(categorized: ClassifiedRegistry): void {
  printSection("alive", "", categorized.alive, color(c.ok, glyph.ok));
  printMovedGroups(categorized.movedGroups);
  const missing = new Set(categorized.missing);
  printSection("missing", "folder does not exist", categorized.missing, color(c.fail, glyph.fail));
  printSection("dead", "folder exists, no .gnosys/ directory", categorized.dead.filter((p) => !missing.has(p)), color(c.fail, glyph.fail));
  printSection("temp", "under /tmp or /var/folders", categorized.temp, color(c.warn, glyph.warn));
  process.stdout.write("\n");
}

/**
 * Drop the confirmed stale entries that are still stale on a fresh read.
 * Entries added, or repaired, since `confirmed` was computed survive.
 */
async function removeStillStale(
  confirmed: Set<string>,
  dbPaths: Map<string, string>,
): Promise<{ removed: number; kept: number }> {
  const entries = await readRegistryEntries();
  const fresh = await classifyEntries(entries, dbPaths);
  const stillStale = new Set([...fresh.dead, ...fresh.temp].filter((p) => confirmed.has(p)));
  const kept = entries.filter((p) => !stillStale.has(p));
  await writeRegistryEntries(kept);
  return { removed: entries.length - kept.length, kept: kept.length };
}

/**
 * Run the cleanup. Interactive mode prompts before writing; non-interactive
 * writes when `yes === true`, otherwise just returns the diff (dry run).
 */
export async function cleanupRegistry(opts: CleanupOptions): Promise<CleanupResult> {
  const dbPaths = await discoverDbProjectPaths();
  const categorized = await classifyRegistryEntries({ dbPaths });
  const stale = [...categorized.dead, ...categorized.temp];
  const toRemove = stale.length;
  const keptCount = categorized.alive.length + categorized.moved.length;
  const moved = categorized.moved.length;
  const entries = toEntries(categorized);

  if (toRemove === 0) {
    if (opts.interactive) {
      if (moved > 0) {
        process.stdout.write(`${Status("warn", `${categorized.movedGroups.length} projects registered in more than one folder`, `${keptCount} entries`)}\n`);
        printMovedGroups(categorized.movedGroups);
        process.stdout.write("\n");
      } else {
        process.stdout.write(`${Status("ok", "project registry is already clean", `${keptCount} entries`)}\n`);
      }
    } else if (moved > 0 && !opts.yes && !opts.quiet) {
      printCategorized(categorized);
    }
    return { removed: 0, kept: keptCount, wrote: false, entries };
  }

  if (opts.interactive) {
    if (!opts.rl && !stdin.isTTY) throw new Error(nonInteractiveMessage("cleanup", "--yes or --dry-run"));
    process.stdout.write("\n");
    process.stdout.write(Header(["gnosys", "cleanup"]) + "\n\n");
    process.stdout.write(`${Status("warn", `${toRemove} stale registry entries`, `${categorized.alive.length} alive · ${moved} moved`)}\n`);
    printCategorized(categorized);

    const ownsRl = !opts.rl;
    const rl = opts.rl ?? createInterface({ input: stdin, output: stdout });
    try {
      const answer = (await safeQuestion(rl, ` ${color(c.accent, glyph.prompt)} remove ${toRemove} entries? [Y/n] `))
        .trim()
        .toLowerCase();
      if (answer === "n" || answer === "no") {
        process.stdout.write(`${Status("warn", "registry left unchanged")}\n`);
        return { removed: 0, kept: keptCount, wrote: false, entries };
      }
    } finally {
      if (ownsRl) rl.close();
    }
  } else if (!opts.yes) {
    // Dry-run.
    if (!opts.quiet) printCategorized(categorized);
    return { removed: toRemove, kept: keptCount, wrote: false, entries };
  }

  const written = await removeStillStale(new Set(stale), dbPaths);
  if (opts.interactive) {
    process.stdout.write(`${Status("ok", `removed ${written.removed} entries`, `${written.kept} kept`)}\n`);
  }
  return { ...written, wrote: true, entries };
}
