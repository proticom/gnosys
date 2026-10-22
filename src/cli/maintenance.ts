/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import type { Command } from "commander";
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
  .option("--yes", "Remove dead and temp registry entries without prompting (same as `gnosys cleanup --yes`)")
  .option("--json", "Print one JSON result on stdout")
  .action(async (opts: { skipDashboard?: boolean; yes?: boolean; json?: boolean }) => {
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
  .option("--json", "Print one JSON result on stdout (needs --yes or --dry-run unless --rules)")
  .option(
    "--rules [dir]",
    "Remove the GNOSYS block from agent rules files (CLAUDE.md, .cursor, .codex) in the given directory (default: cwd)",
  )
  .action(async (opts: { yes?: boolean; dryRun?: boolean; json?: boolean; rules?: string | boolean }) => {
    // v5.12.1: uninstall counterpart of `gnosys setup ides` rules generation.
    if (opts.rules !== undefined) {
      const { removeRulesFromProject } = await import("../lib/rulesGen.js");
      const dir = typeof opts.rules === "string" ? path.resolve(opts.rules) : process.cwd();
      const cleaned = await removeRulesFromProject(dir);
      if (opts.json) {
        console.log(JSON.stringify({ ok: true, dir, rulesCleaned: cleaned }, null, 2));
      } else if (cleaned.length === 0) {
        console.log(`No GNOSYS rules blocks found in ${dir}`);
      } else {
        for (const rel of cleaned) console.log(`Removed GNOSYS block: ${rel}`);
      }
      return;
    }
    const interactive = !opts.yes && !opts.dryRun;
    if (interactive) {
      const { guardInteractiveStdin } = await import("../lib/interactiveGuard.js");
      if (opts.json) {
        console.error("gnosys cleanup --json cannot prompt. Pass --yes to remove or --dry-run to preview.");
        process.exit(1);
      }
      guardInteractiveStdin("cleanup", "--yes or --dry-run");
    }
    const { cleanupRegistry } = await import("../lib/cleanup.js");
    const result = await cleanupRegistry({ interactive, yes: opts.yes, quiet: opts.json });
    if (opts.json || !interactive) {
      console.log(JSON.stringify({ ok: true, dryRun: Boolean(opts.dryRun && !opts.yes), ...result }, null, 2));
    }
  });

// `gnosys upgrade` — upgrade the gnosys CLI/MCP itself, then refresh
// registered projects. Writes ~/.gnosys/last-upgrade-at so running MCP
// servers exit cleanly and the host respawns them against the new global
// binary (see src/lib/upgrade.ts and src/lib/upgradeCommand.ts).
program
  .command("upgrade")
  .description("Upgrade gnosys itself and signal running MCP servers to restart. After upgrading, suggests running 'gnosys setup sync-projects'. --yes runs it (and removes dead registry entries) without prompting.")
  .option("--yes", "Accept the defaults without prompting: upgrade, then run 'gnosys setup sync-projects --yes'")
  .option("--no-sync", "Upgrade only; skip sync-projects")
  .option("--json", "Print one JSON result on stdout (needs --yes or --no-sync)")
  .action(async (opts: { yes?: boolean; sync?: boolean; json?: boolean }) => {
    const { runUpgradeCommand } = await import("../lib/upgradeCommand.js");
    await runUpgradeCommand(pkg.version, opts);
  });

// ─── gnosys doctor ──────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Check system health: stores, LLM connectivity, embeddings, archive")
  .option("--fix", "Offer interactive cleanup of legacy artifacts (e.g. per-store gnosys.db)")
  .option("--yes", "With --fix: remove without prompting (only artifacts whose rows are all in the central DB)")
  .option("--json", "Print one JSON report on stdout")
  .action(async (opts: { fix?: boolean; yes?: boolean; json?: boolean }) => {
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
