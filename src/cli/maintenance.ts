/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import path from "path";
import { getResolver, pkg } from "./_shared.js";

export function registerMaintenance(program: Command): void {
// `gnosys dashboard` was removed in v5.7.1.
// Use `gnosys status --system` instead. Hard removal — commander will emit
// the standard "unknown command" error.

// ─── gnosys maintain ─────────────────────────────────────────────────────
program
  .command("maintain")
  .description("Run vault maintenance: detect duplicates, apply confidence decay, consolidate similar memories")
  .option("--dry-run", "Show what would change without modifying anything")
  .option("--auto-apply", "Automatically apply all changes (no prompts)")
  .action(async (opts: { dryRun?: boolean; autoApply?: boolean }) => {
    const { runMaintainCommand } = await import("../lib/maintainCommand.js");
    await runMaintainCommand(getResolver, opts);
  });

// ─── gnosys dearchive ───────────────────────────────────────────────────
program
  .command("dearchive <query>")
  .description("Force-dearchive memories matching a query from archive.db back to active")
  .option("--limit <n>", "Max memories to dearchive", "5")
  .action(async (query: string, opts: { limit: string }) => {
    const { runDearchiveCommand } = await import("../lib/dearchiveCommand.js");
    await runDearchiveCommand(getResolver, query, opts);
  });

// NOTE: gnosys migrate is defined below (near the end) with --to-central support

// v6.2.1 cli split: `setup sync-projects` registers on the setup
// parent (created in setup.ts); looked up here by name to preserve the
// original registration and docs ordering exactly.
const setupCmd = program.commands.find((c) => c.name() === "setup");
if (!setupCmd) {
  throw new Error("registerMaintenance: 'setup' must be registered first (sync-projects attaches to it)");
}

// ─── gnosys upgrade  +  gnosys setup sync-projects ──────────────────────
//
// v5.7.1 (#15) split this command:
//
//   gnosys upgrade            — upgrade the gnosys CLI/MCP itself
//                               (npm install + restart signal to MCPs)
//   gnosys setup sync-projects — what the old `gnosys upgrade` used to do
//                               (re-init project identities, agent rules,
//                                central DB stamp, portfolio dashboard)
//
// The legacy sync-projects body lives in ./lib/setupSyncProjectsCommand.ts as
// `runSetupSyncProjectsCommand`, called from `setup sync-projects`.

// `gnosys setup sync-projects` — re-init project identities + agent rules.
// (This is what `gnosys upgrade` used to do; renamed in v5.7.1.)
setupCmd
  .command("sync-projects")
  .description("Re-initialize all registered projects after upgrading gnosys: refresh agent rules, project registry, central DB stamp, and portfolio dashboard.")
  .option("--skip-dashboard", "Skip regenerating the portfolio dashboard")
  .action(async (opts: { skipDashboard?: boolean }) => {
    const { runSetupSyncProjectsCommand } = await import("../lib/setupSyncProjectsCommand.js");
    await runSetupSyncProjectsCommand(opts);
  });

// `gnosys cleanup` — prune dead/temp entries from the project registry.
// Standalone top-level command per Phase H. Also reusable from inside
// `setup sync-projects` when the skipped list is non-empty (see
// road-015).
program
  .command("cleanup")
  .description("Remove dead and temp-dir entries from the project registry")
  .option("--yes", "Non-interactive, remove without prompting")
  .option("--dry-run", "Show what would be removed without writing")
  .option(
    "--rules [dir]",
    "Remove the GNOSYS block from agent rules files (CLAUDE.md, .cursor, .codex) in the given directory (default: cwd)",
  )
  .action(async (opts: { yes?: boolean; dryRun?: boolean; rules?: string | boolean }) => {
    // v5.12.1: uninstall counterpart of `gnosys setup ides` rules generation.
    if (opts.rules !== undefined) {
      const { removeRulesFromProject } = await import("../lib/rulesGen.js");
      const dir = typeof opts.rules === "string" ? path.resolve(opts.rules) : process.cwd();
      const cleaned = await removeRulesFromProject(dir);
      if (cleaned.length === 0) {
        console.log(`No GNOSYS rules blocks found in ${dir}`);
      } else {
        for (const rel of cleaned) console.log(`Removed GNOSYS block: ${rel}`);
      }
      return;
    }
    const { cleanupRegistry } = await import("../lib/cleanup.js");
    const result = await cleanupRegistry({
      interactive: !opts.yes && !opts.dryRun,
      yes: opts.yes,
    });
    if (opts.yes || opts.dryRun) {
      console.log(JSON.stringify(result, null, 2));
    }
  });

// `gnosys upgrade` — upgrade the gnosys CLI/MCP itself, then prompt the
// user to run sync-projects. Writes ~/.gnosys/last-upgrade-at so running
// MCP servers exit cleanly and the host respawns them against the new
// global binary (see src/lib/upgrade.ts).
program
  .command("upgrade")
  .description("Upgrade gnosys itself and signal running MCP servers to restart. After upgrading, suggests running 'gnosys setup sync-projects'.")
  .option("--yes", "Skip the post-upgrade sync-projects prompt and exit")
  .option("--no-sync", "Don't suggest running sync-projects afterward")
  .action(async (opts: { yes?: boolean; sync?: boolean }) => {
    const currentVersion = pkg.version;
    console.log(`Gnosys CLI: currently v${currentVersion}`);

    const { detectPackageManager, upgradeCommand } = await import("../lib/packageManager.js");
    const pm = detectPackageManager();
    const cmd = upgradeCommand(pm);
    if (!cmd) {
      console.log(
        "Running under npx — there's no global install to upgrade. Use `npx gnosys@latest` to run the latest.",
      );
      return;
    }

    console.log(`Running: ${cmd} ...`);

    const { execSync, spawn } = await import("child_process");
    const { makeNpmStderrFilter } = await import("../lib/installOutput.js");
    try {
      // Stream the install live, but filter out the two unfixable, harmless
      // deprecation warnings (prebuild-install, boolean — see installOutput.ts).
      // stdout is inherited; stderr is piped so we can drop those lines.
      await new Promise<void>((resolve, reject) => {
        const child = spawn(cmd, { shell: true, stdio: ["inherit", "inherit", "pipe"] });
        const filter = makeNpmStderrFilter((text) => process.stderr.write(text));
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => filter.feed(chunk));
        child.on("error", reject);
        child.on("close", (code) => {
          filter.end();
          if (code === 0) resolve();
          else reject(new Error(`${cmd} exited with code ${code}`));
        });
      });
    } catch (err) {
      console.error(`\nUpgrade failed: ${err instanceof Error ? err.message : err}`);
      console.error(`Try running '${cmd}' manually.`);
      process.exit(1);
    }

    // Read the newly-installed version (best-effort — we may still be the
    // old binary in-process; this is purely informational).
    let newVersion = "(see npm output)";
    try {
      const out = execSync("npm ls -g gnosys --depth=0 --json", { encoding: "utf8" });
      const parsed = JSON.parse(out);
      newVersion = parsed?.dependencies?.gnosys?.version || newVersion;
    } catch {
      // Best-effort lookup only.
    }

    // v5.8.5: surface the version transition so it's obvious the upgrade
    // worked, even though this process is still on the old binary in-memory.
    if (newVersion !== "(see npm output)" && newVersion !== currentVersion) {
      console.log(`\n✓ Installed gnosys v${newVersion} (was v${currentVersion})`);
    } else if (newVersion === currentVersion) {
      console.log(`\n✓ Already on latest: v${currentVersion}`);
    }

    // UPG polish (from command-coverage-plan UPG track): the makeNpmStderrFilter
    // (see installOutput.ts) already drops the two known-benign deprecations
    // (prebuild-install from better-sqlite3, boolean from onnxruntime). This keeps
    // `gnosys upgrade` and `npm install -g` output clean for users.
    console.log("  (known-benign deprecation warnings from optional native deps were suppressed)");

    // Write the marker so any running MCP servers exit and respawn.
    const { writeUpgradeMarker } = await import("../lib/upgrade.js");
    try {
      writeUpgradeMarker(typeof newVersion === "string" && newVersion !== "(see npm output)"
        ? newVersion
        : currentVersion);
      console.log(`\n✓ Upgrade marker written: ~/.gnosys/last-upgrade-at`);
      console.log(`  Any running MCP servers will detect this within 10s and restart cleanly.`);
      console.log(`  (Your MCP client — Claude Code, Cursor, VS Code — will auto-respawn.)`);
    } catch (err) {
      console.error(`\nCould not write upgrade marker: ${err instanceof Error ? err.message : err}`);
      console.error(`Running MCP servers will need to be restarted manually.`);
    }

    // v5.15: a Node upgrade moves the node path hardcoded in the dream
    // LaunchAgent plist, silently killing the scheduler. Repair it here.
    const { repairDreamLaunchAgentAfterUpgrade } = await import("../lib/dreamLaunchd.js");
    const dreamRepairLine = await repairDreamLaunchAgentAfterUpgrade();
    if (dreamRepairLine) console.log(`\n${dreamRepairLine}`);

    if (opts.sync === false || opts.yes) {
      console.log(`\nDone. Run 'gnosys setup sync-projects' when you're ready to refresh registered projects.`);
      return;
    }

    // Prompt for sync-projects.
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) =>
      rl.question(`\nRun 'gnosys setup sync-projects' now to refresh registered projects? [Y/n] `, resolve),
    );
    rl.close();

    if (answer.trim().toLowerCase() === "n" || answer.trim().toLowerCase() === "no") {
      console.log(`Done. You can run 'gnosys setup sync-projects' later.`);
      return;
    }

    console.log(``);
    // v5.8.5: shell out to the freshly-installed binary instead of running
    // syncProjectsAction in-process. The in-process call reuses pkg.version
    // captured at startup (the OLD version), so the banner said "Gnosys
    // v5.8.3 — upgrading registered projects" right after installing 5.8.4.
    // execSync spawns a new process that resolves `gnosys` on PATH to the
    // upgraded global binary, so the right version banner shows.
    try {
      execSync("gnosys setup sync-projects", { stdio: "inherit" });
    } catch (err) {
      console.error(`\nSync-projects failed: ${err instanceof Error ? err.message : err}`);
      console.error(`Run 'gnosys setup sync-projects' manually.`);
      process.exit(1);
    }
  });

// ─── gnosys doctor ──────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Check system health: stores, LLM connectivity, embeddings, archive")
  .option("--fix", "Offer interactive cleanup of legacy artifacts (e.g. per-store gnosys.db)")
  .action(async (opts: { fix?: boolean }) => {
    const { runDoctorCommand } = await import("../lib/doctorCommand.js");
    await runDoctorCommand(getResolver, opts);
  });

// ─── gnosys check ─────────────────────────────────────────────────────────
program
  .command("check")
  .description("Test LLM connectivity for each configured task (structuring, synthesis, vision, transcription, dream)")
  .option("-t, --task <name>", "Test only one task (structuring | synthesis | vision | transcription | dream)")
  .action(async (opts: { task?: string }) => {
    const { runCheckCommand } = await import("../lib/checkCommand.js");
    await runCheckCommand(opts);
  });
}
