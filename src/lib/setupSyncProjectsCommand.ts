import path from "path";
import fs from "fs/promises";
import os from "os";
import { fileURLToPath } from "url";
import { GnosysDB } from "./db.js";
import { GnosysResolver } from "./resolver.js";
import { createProjectIdentity } from "./projectIdentity.js";

export type SetupSyncProjectsCommandOptions = {
  skipDashboard?: boolean;
  /** Remove dead/temp registry entries without prompting. */
  yes?: boolean;
  /** Print one JSON result on stdout and nothing else. */
  json?: boolean;
};

export interface SyncProjectsResult {
  ok: true;
  version: string;
  total: number;
  upgraded: string[];
  skipped: string[];
  /** Folders sharing a projectId with another folder; not synced. */
  moved: string[];
  failed: Array<{ path: string; error: string }>;
  tempPruned: number;
  globalRules: "updated" | "failed" | "unavailable";
  /** null when the registry cleanup did not run (no stale entries, or no --yes without a terminal). */
  registryCleanup: { removed: number; kept: number; wrote: boolean } | null;
  dashboard: { html: string; md: string } | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function packageVersion(): Promise<string> {
  const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  return pkg.version as string;
}

export async function runSetupSyncProjectsCommand(
  opts: SetupSyncProjectsCommandOptions,
): Promise<void> {
  const currentVersion = await packageVersion();
  // v5.9.3 Screen 10 — Header + leading spinner + hierarchical sections.
  const {
    renderSyncHeader,
    renderUpgradedSection,
    renderSkippedSection,
    renderFailedSection,
    renderMovedSection,
    renderMachinesSection,
    renderDivider,
    renderDoneLine,
    renderDashboardSummary,
  } = await import("./setup/syncProjectsRender.js");
  const { Spinner } = await import("./setup/ui/spinner.js");

  const json = Boolean(opts.json);
  const say = (line = ""): void => {
    if (!json) console.log(line);
  };
  say();
  say(renderSyncHeader(currentVersion));
  say();

  // 1. Read registered projects from file registry AND central DB
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  const { getProjectRegistryPath, isTempProjectPath } = await import("./paths.js");
  // Registry lives at ~/.config/gnosys/projects.json (or under
  // GNOSYS_HOME/GNOSYS_CONFIG_DIR when isolated) — always resolved via
  // the shared helper, never hand-rolled from HOME.
  const registryPath = getProjectRegistryPath();
  let fileProjects: string[] = [];
  try {
    fileProjects = JSON.parse(await fs.readFile(registryPath, "utf-8"));
  } catch {
    // No file registry yet
  }

  // Also check central DB for projects not in the file registry. Also
  // capture project titles so the Screen 10 row labels can use the
  // human-readable name where available.
  const dbProjects: string[] = [];
  const titleByDir = new Map<string, string>();
  try {
    const centralDb = GnosysDB.openCentral();
    if (centralDb.isAvailable()) {
      const allProjects = centralDb.getAllProjects();
      // Purge temp-dir ghosts (leaked by test runs) from the central DB
      // so they stop resurfacing in every future sync.
      for (const p of allProjects) {
        if (isTempProjectPath(p.working_directory)) {
          try {
            centralDb.deleteProject(p.id);
          } catch {
            // non-critical
          }
          continue;
        }
        dbProjects.push(p.working_directory);
        titleByDir.set(p.working_directory, p.name);
      }
      centralDb.close();
    }
  } catch {
    // non-critical
  }

  // Merge: deduplicate by resolved path. Temp-dir entries (/tmp,
  // /var/folders — leaked by old versions' test runs) are dropped here,
  // BEFORE the count and the registry write-back. Previously they were
  // only skipped inside the upgrade loop, so "syncing N registered
  // projects" reported hundreds of ghosts and the write-back on line
  // below re-persisted them forever.
  const seen = new Set<string>();
  const projects: string[] = [];
  let droppedTemp = 0;
  for (const p of [...fileProjects, ...dbProjects]) {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (isTempProjectPath(resolved)) {
      droppedTemp++;
      continue;
    }
    projects.push(resolved);
  }

  const result: SyncProjectsResult = {
    ok: true,
    version: currentVersion,
    total: projects.length,
    upgraded: [],
    skipped: [],
    moved: [],
    failed: [],
    tempPruned: droppedTemp,
    globalRules: "unavailable",
    registryCleanup: null,
    dashboard: null,
  };

  if (projects.length === 0) {
    if (json) console.log(JSON.stringify(result, null, 2));
    say(" no registered projects found");
    say(" run `gnosys init` in each project first");
    return;
  }

  // Lead-in spinner: shows we're churning through the registry. Resolves
  // to ✓ summary after the iteration loop completes (or fail on hard error).
  const syncSpinner = json ? null : Spinner(`syncing ${projects.length} registered projects…`);

  // Sync the merged list back to file registry
  try {
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, JSON.stringify(projects, null, 2), "utf-8");
  } catch {
    // non-critical
  }

  // Folders sharing a projectId with another folder are left alone:
  // syncing both flips the central DB row between them and writes agent
  // files into the stale copy. `gnosys project relocate` resolves them.
  const { classifyEntries, discoverDbProjectPaths } = await import("./cleanup.js");
  const movedSet = new Set((await classifyEntries(projects, await discoverDbProjectPaths())).moved);

  // 2. Iterate and upgrade each project that exists on this machine
  const { upgraded, skipped, moved, failed } = result;

  for (const projectDir of projects) {
    // Temp/test directories were already filtered out of `projects`.
    if (movedSet.has(projectDir)) {
      moved.push(projectDir);
      continue;
    }
    const storePath = path.join(projectDir, ".gnosys");
    try {
      await fs.stat(storePath);
    } catch {
      skipped.push(projectDir);
      continue;
    }

    try {
      // Re-create project identity (re-syncs with central DB)
      let centralDb: GnosysDB | null = null;
      try {
        centralDb = GnosysDB.openCentral();
        if (!centralDb.isAvailable()) centralDb = null;
      } catch {
        centralDb = null;
      }

      await createProjectIdentity(projectDir, { centralDb: centralDb || undefined });

      // Re-register in file-based registry (idempotent)
      const tempResolver = new GnosysResolver();
      await tempResolver.registerProject(projectDir);

      // Re-generate agent rules for all detected IDEs
      if (centralDb) {
        const { syncToTarget } = await import("./rulesGen.js");
        const { readProjectIdentity } = await import("./projectIdentity.js");
        const identity = await readProjectIdentity(projectDir);
        const projectId = identity?.projectId || null;

        try {
          await syncToTarget(centralDb, projectDir, "all", projectId);
        } catch {
          // Some projects may not have IDE configs — that's ok
        }

        centralDb.close();
      }

      // Configure IDE hooks for automatic memory recall
      const { configureIdeHooks } = await import("./projectIdentity.js");
      await configureIdeHooks(projectDir);

      upgraded.push(projectDir);
    } catch (err) {
      failed.push({ path: projectDir, error: (err as Error).message });
    }
  }

  // Stop the lead-in spinner now that the iteration is done. Resolved
  // before any per-section output so the cursor is on a fresh line.
  syncSpinner?.ok(
    `synced ${projects.length} registered projects`,
    `${upgraded.length} upgraded · ${skipped.length} skipped · ${moved.length} moved · ${failed.length} failed` +
      (droppedTemp > 0 ? ` · ${droppedTemp} temp entries pruned` : ""),
  );

  // 3. Update global agent rules
  try {
    let centralDb: GnosysDB | null = null;
    try {
      centralDb = GnosysDB.openCentral();
      if (!centralDb.isAvailable()) centralDb = null;
    } catch {
      centralDb = null;
    }
    if (centralDb) {
      const { syncToTarget } = await import("./rulesGen.js");
      await syncToTarget(centralDb, process.cwd(), "global", null);
      centralDb.close();
      result.globalRules = "updated";
      const { printStatus } = await import("./setup/ui/status.js");
      if (!json) printStatus("ok", "global agent rules updated", "~/.claude/CLAUDE.md");
    }
  } catch {
    result.globalRules = "failed";
    const { printStatus } = await import("./setup/ui/status.js");
    if (!json) printStatus("warn", "could not update global agent rules");
  }

  // 4. Stamp the central DB with current version and machine info
  try {
    const centralDb = GnosysDB.openCentral();
    if (centralDb.isAvailable()) {
      const hostname = os.hostname();
      centralDb.setMeta("app_version", currentVersion);
      centralDb.setMeta("last_upgrade", new Date().toISOString());
      centralDb.setMeta("upgraded_by", hostname);

      // Record this machine in the connected-machines registry. Keyed by
      // hostname, but we pass machineId + any previous hostnames so a renamed
      // machine prunes its own orphaned entry instead of showing up twice.
      const { ensureMachineConfig } = await import("./machineConfig.js");
      const { recordMachine } = await import("./machineRegistry.js");
      const machine = ensureMachineConfig().config;
      recordMachine(centralDb, {
        hostname,
        version: currentVersion,
        machineId: machine.machineId,
        aliases: machine.previousHostnames,
      });

      centralDb.close();
    }
  } catch {
    // non-critical
  }

  // 5. Report — v5.9.3 Screen 10 hierarchical layout. Section helpers
  // turn the raw path arrays into ProjectRow lists (title + fullPath)
  // and emit dividers between groups.
  function rowFor(p: string): { title: string; fullPath: string } {
    const title = titleByDir.get(p) ?? titleByDir.get(path.resolve(p)) ?? path.basename(p);
    return { title, fullPath: p };
  }
  const upgradedRows = upgraded.map(rowFor);
  const skippedRows = skipped.map(rowFor);
  const movedRows = moved.map(rowFor);
  const failedRows = failed.map((f) => ({
    title: titleByDir.get(f.path) ?? path.basename(f.path),
    fullPath: `${f.path} (${f.error})`,
  }));

  say();
  for (const line of renderUpgradedSection(upgradedRows)) say(line);
  if (upgradedRows.length > 0 && (skippedRows.length > 0 || movedRows.length > 0 || failedRows.length > 0)) {
    say();
  }
  for (const line of renderSkippedSection(skippedRows)) say(line);
  if (movedRows.length > 0) {
    if (skippedRows.length > 0) say();
    for (const line of renderMovedSection(movedRows)) say(line);
  }
  if (failedRows.length > 0) {
    say();
    for (const line of renderFailedSection(failedRows)) say(line);
  }

  // Connected-machines callout (separate divider per design spec).
  let machineLines: string[] = [];
  try {
    const centralDb = GnosysDB.openCentral();
    if (centralDb.isAvailable()) {
      const { readMachineRegistry } = await import("./machineRegistry.js");
      const machines = readMachineRegistry(centralDb);
      const entries = Object.entries(machines);
      if (entries.length > 0) {
        const currentHost = os.hostname();
        const machineRows = entries.map(([host, info]) => ({
          hostname: host,
          version: info.version,
          lastSeen: info.lastSeen,
          isCurrent: host === currentHost,
        }));
        machineLines = renderMachinesSection(machineRows, currentVersion);
      }
      centralDb.close();
    }
  } catch {
    // non-critical
  }

  if (machineLines.length > 0) {
    say();
    say(renderDivider());
    say();
    for (const line of machineLines) say(line);
  }

  say();
  say(renderDivider());
  say();
  say(renderDoneLine(currentVersion));

  if (skippedRows.length > 0 || movedRows.length > 0) {
    // Stale registry entries: --yes removes them (the prompt's default);
    // a terminal user gets the prompt; otherwise leave the registry alone.
    // Moved entries are always kept; the prompt lists their relocate fix.
    say();
    const { printStatus } = await import("./setup/ui/status.js");
    const canPrompt = !json && Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (opts.yes || canPrompt) {
      try {
        const { cleanupRegistry } = await import("./cleanup.js");
        const cleanup = await cleanupRegistry({ interactive: !opts.yes, yes: opts.yes, quiet: json });
        result.registryCleanup = { removed: cleanup.removed, kept: cleanup.kept, wrote: cleanup.wrote };
        if (opts.yes && !json) {
          printStatus("ok", `removed ${cleanup.removed} stale registry entries`, `${cleanup.kept} kept`);
        }
      } catch (err) {
        if (!json) printStatus("warn", "cleanup skipped", err instanceof Error ? err.message : String(err));
      }
    } else if (!json) {
      printStatus("progress", "tip", "run `gnosys cleanup` (or pass --yes) to remove stale entries");
    }
  }

  // 6. Regenerate portfolio dashboard
  if (!opts.skipDashboard) {
    try {
      const dashboardPath = path.join(home, "gnosys-dashboard.html");
      const dashboardMdPath = path.join(home, "gnosys-dashboard.md");
      const centralDb = GnosysDB.openCentral();
      if (centralDb.isAvailable()) {
        const { generatePortfolio, formatPortfolioMarkdown } = await import("./portfolio.js");
        const { generatePortfolioHtml } = await import("./portfolioHtml.js");
        const report = generatePortfolio(centralDb);
        await fs.writeFile(dashboardPath, generatePortfolioHtml(report, dashboardPath), "utf-8");
        await fs.writeFile(dashboardMdPath, formatPortfolioMarkdown(report), "utf-8");
        centralDb.close();
        result.dashboard = { html: dashboardPath, md: dashboardMdPath };
        say();
        for (const line of renderDashboardSummary(dashboardPath, dashboardMdPath)) {
          say(line);
        }
      }
    } catch {
      const { printStatus } = await import("./setup/ui/status.js");
      say();
      if (!json) printStatus("warn", "could not regenerate portfolio dashboard");
    }
  }

  if (json) console.log(JSON.stringify(result, null, 2));
}
