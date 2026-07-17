/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { getResolver, pkg } from "./_shared.js";

export function registerAgent(program: Command): void {
// ─── gnosys pref ─────────────────────────────────────────────────────────
const prefCmd = program
  .command("pref")
  .description(
    "User preferences — small key-value memories scoped to you (not a project), surfaced into every agent's context. Use for cross-project conventions like 'prefer simple solutions' or 'no emoji in UI'. Subcommands: set, get, delete. Review/clean up with `gnosys setup preferences`.",
  );

prefCmd
  .command("set <key> <value>")
  .description("Set a user preference. Key should be kebab-case (e.g. 'commit-convention').")
  .option("-t, --title <title>", "Human-readable title")
  .option("--tags <tags>", "Comma-separated tags")
  .action(async (key: string, value: string, opts: { title?: string; tags?: string }) => {
    const { runPrefSetCommand } = await import("../lib/prefCommand.js");
    await runPrefSetCommand(key, value, opts);
  });

prefCmd
  .command("get [key]")
  .description("Get a preference by key, or list all preferences if no key given.")
  .option("--json", "Output as JSON")
  .action(async (key: string | undefined, opts: { json?: boolean }) => {
    const { runPrefGetCommand } = await import("../lib/prefCommand.js");
    await runPrefGetCommand(key, opts);
  });

prefCmd
  .command("delete <key>")
  .description("Delete a user preference.")
  .action(async (key: string) => {
    const { runPrefDeleteCommand } = await import("../lib/prefCommand.js");
    await runPrefDeleteCommand(key);
  });

// ─── gnosys sync ─────────────────────────────────────────────────────────
program
  .command("sync")
  .description("Regenerate agent rules files from user preferences and project conventions. Injects GNOSYS:START/GNOSYS:END block.")
  .option("-d, --directory <dir>", "Project directory (default: cwd)")
  .option("-t, --target <target>", "Target: claude, cursor, codex, all, or global (default: auto-detect)")
  .option("--global", "Sync to global ~/.claude/CLAUDE.md")
  .action(async (opts: { directory?: string; target?: string; global?: boolean }) => {
    const { runSyncCommand } = await import("../lib/syncCommand.js");
    await runSyncCommand(opts);
  });

// ─── gnosys fsearch (federated search) ───────────────────────────────────
program
  .command("fsearch <query>")
  .description("Federated search across all scopes with tier boosting (project > user > global)")
  .option("-l, --limit <n>", "Max results", "20")
  .option("-d, --directory <dir>", "Project directory for context")
  .option("--no-global", "Exclude global-scope memories")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated)")
  .option("--json", "Output as JSON")
  .action(async (query: string, opts: { limit: string; directory?: string; global: boolean; scope?: string; json: boolean }) => {
    const { runFsearchCommand } = await import("../lib/fsearchCommand.js");
    await runFsearchCommand(query, opts);
  });

// ─── gnosys ambiguity ────────────────────────────────────────────────────
program
  .command("ambiguity <query>")
  .description("Check if a query matches memories in multiple projects")
  .option("--json", "Output as JSON")
  .action(async (query: string, opts: { json: boolean }) => {
    const { runAmbiguityCommand } = await import("../lib/ambiguityCommand.js");
    await runAmbiguityCommand(query, opts);
  });

// ─── gnosys briefing ─────────────────────────────────────────────────────
program
  .command("briefing [projectNameOrId]")
  .description("Generate project briefing — memory state summary, categories, recent activity, top tags")
  .option("-p, --project <id>", "Project ID (auto-detects if omitted)")
  .option("-a, --all", "Generate briefings for all projects")
  .option("-d, --directory <dir>", "Project directory for auto-detection")
  .option("--json", "Output as JSON")
  .action(async (projectNameOrId: string | undefined, opts: { project?: string; all?: boolean; directory?: string; json: boolean }) => {
    const { runBriefingCommand } = await import("../lib/briefingCommand.js");
    await runBriefingCommand(projectNameOrId, opts);
  });

// `gnosys portfolio` was removed in v5.7.1.
// Use `gnosys status --projects` (formerly --global) for the projects
// overview, or `gnosys status --web` for the HTML dashboard, or
// `gnosys status --projects --output file.html` to write to disk.

// ─── gnosys status ──────────────────────────────────────────────────────
// v5.7.1 (#11): the catch-all status command. Section flags select what to
// show; output flags control format. Default (no flag) is the current
// project. `dashboard` and `portfolio` were removed in v5.7.1 — their
// content lives under `--system` and `--projects` respectively.
program
  .command("status")
  .description("Show status. Sections: --projects (all projects) · --remote (sync) · --system (memory/LLM health) · default: current project. Output: --web · --json. Note: 'gnosys dashboard' and 'gnosys portfolio' were removed in v5.7.1 — use 'gnosys status --system' and 'gnosys status --projects' instead.")
  .option("-d, --directory <dir>", "Project directory (auto-detects if omitted)")
  .option("-p, --project <id>", "Project ID")
  .option("-g, --global", "(deprecated alias for --projects)")
  .option("--projects", "Show all projects portfolio (replaces the old 'gnosys portfolio')")
  .option("-r, --remote", "Show remote sync status (alias for 'gnosys setup remote status')")
  .option("-w, --web", "Open the HTML dashboard in the browser")
  .option("-s, --system", "Show system health (memory count, LLM connectivity, embeddings, archive)")
  .option("--json", "Output as JSON")
  .action(async (opts: { directory?: string; project?: string; global?: boolean; projects?: boolean; remote?: boolean; web?: boolean; system?: boolean; json: boolean }) => {
    const { runStatusCommand } = await import("../lib/statusCommand.js");
    await runStatusCommand(opts, { getResolver, loadConfig, pkgVersion: pkg.version });
  });

// ─── gnosys update-status ────────────────────────────────────────────────
program
  .command("update-status")
  .description("Show the prompt to give an AI agent to update this project's status for the portfolio dashboard")
  .option("-d, --directory <dir>", "Project directory (auto-detects if omitted)")
  .option("-p, --project <id>", "Project ID")
  .action(async (opts: { directory?: string; project?: string }) => {
    const { runUpdateStatusCommand } = await import("../lib/updateStatusCommand.js");
    await runUpdateStatusCommand(opts);
  });

// ─── gnosys working-set ──────────────────────────────────────────────────
program
  .command("working-set")
  .description("Show the implicit working set — recently modified memories for the current project")
  .option("-d, --directory <dir>", "Project directory")
  .option("-w, --window <hours>", "Lookback window in hours", "24")
  .option("--json", "Output as JSON")
  .action(async (opts: { directory?: string; window: string; json: boolean }) => {
    const { runWorkingSetCommand } = await import("../lib/workingSetCommand.js");
    await runWorkingSetCommand(opts);
  });
}
