/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";

export function registerExport(program: Command): void {
// ─── gnosys export (parent + subcommands) ────────────────────────────────
const exportCmd = program
  .command("export")
  .description("Export memory to a vault (markdown) or a project bundle (.json.gz)")
  .enablePositionalOptions();

// Bare `gnosys export` shows the canonical subcommand forms. Back-compat for
// the v5.5.x form `gnosys export --to <dir>` is handled in a pre-parse shim
// at the top of the file (rewrites argv to insert "vault" before "--to").
exportCmd.action(async () => {
  const { runExportUsageCommand } = await import("../lib/exportCommand.js");
  runExportUsageCommand();
});

// `gnosys export vault` — explicit alias for the default behavior
exportCmd
  .command("vault")
  .description("Export gnosys.db to an Obsidian-compatible vault (one-way)")
  .requiredOption("--to <dir>", "Target directory for export")
  .option("--all", "Export all memories (active + archived)")
  .option("--overwrite", "Overwrite existing files")
  .option("--no-summaries", "Skip category summaries")
  .option("--no-reviews", "Skip review suggestions")
  .option("--no-graph", "Skip relationship graph")
  .option("--json", "Output raw JSON report")
  .action(async (opts: { to: string; all?: boolean; overwrite?: boolean; summaries?: boolean; reviews?: boolean; graph?: boolean; json?: boolean }) => {
    const { runVaultExportCommand } = await import("../lib/exportCommand.js");
    await runVaultExportCommand(opts);
  });

// `gnosys export project [id]` — bundle a single project for portability
exportCmd
  .command("project [projectId]")
  .description("Export a single project to a portable .json.gz bundle (round-trips with 'gnosys import project')")
  .requiredOption("--to <file>", "Output bundle file path (e.g. ./gnosys-public.gnosys.json.gz)")
  .option("--include-archived", "Include archived and superseded memories (default: active only)")
  .option("--no-audit", "Skip the audit log")
  .option("--json", "Output the result as JSON")
  .action(async (projectIdArg: string | undefined, opts: { to: string; includeArchived?: boolean; audit?: boolean; json?: boolean }) => {
    const { runProjectExportCommand } = await import("../lib/exportCommand.js");
    await runProjectExportCommand(projectIdArg, opts);
  });
}
