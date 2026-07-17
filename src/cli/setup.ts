/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import path from "path";
import os from "os";
import { existsSync } from "fs";

export function registerSetup(program: Command): void {
// ─── gnosys setup (parent command) ──────────────────────────────────────
const setupCmd = program
  .command("setup")
  .description("Configure Gnosys — provider keys, models, remote sync, and IDE integration");

// Bare `gnosys setup` — when config exists, opens the summary-first menu
// so the user can edit one section without re-running the whole wizard.
// First-time setup or `--full` runs the linear 5-step flow.
setupCmd
  .option("--non-interactive", "Skip prompts, use defaults (for CI/scripting)")
  .option("--full", "Run the linear 5-step wizard even when a config exists")
  .action(async (opts: { nonInteractive?: boolean; full?: boolean }) => {
    const { runSetup } = await import("../lib/setup.js");
    const projectDir = process.cwd();

    // Detect existing config — if present and the user didn't pass --full,
    // route to the summary-first menu.
    const configPath = path.join(os.homedir(), ".gnosys", "gnosys.json");
    const hasConfig = existsSync(configPath);

    if (hasConfig && !opts.full && !opts.nonInteractive) {
      const { runSummaryWizard } = await import("../lib/setup/summary.js");
      await runSummaryWizard({ directory: projectDir });
      return;
    }

    await runSetup({
      directory: projectDir,
      nonInteractive: opts.nonInteractive,
    });
  });

// `gnosys setup providers` — API keys per provider (Keychain / env)
setupCmd
  .command("providers")
  .description("Manage LLM provider API keys (view, rotate, delete)")
  .action(async () => {
    const readline = await import("readline/promises");
    const { runProvidersSetup } = await import("../lib/setup/sections/providers.js");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runProvidersSetup({ rl, directory: process.cwd() });
    } finally {
      rl.close();
    }
  });

// `gnosys setup keys` — provider API key table
setupCmd
  .command("keys")
  .description("Manage provider API keys in a table view")
  .action(async () => {
    const { runSetup } = await import("../lib/setup.js");
    await runSetup({ section: "keys" });
  });

// `gnosys setup models` — just configure LLM provider/model/key
setupCmd
  .command("models")
  .description("Update LLM provider and model configuration")
  .option("-p, --provider <name>", "Set provider directly (anthropic, openai, xai, groq, mistral, ollama, lmstudio, custom)")
  .option("-m, --model <name>", "Set model name directly")
  .option("--no-validate", "Skip the test API call")
  .action(async (opts: { provider?: string; model?: string; validate?: boolean }) => {
    const { runModelsSetup } = await import("../lib/setup.js");
    await runModelsSetup({
      directory: process.cwd(),
      provider: opts.provider,
      model: opts.model,
      validate: opts.validate,
    });
  });

// ─── gnosys setup remote (parent + subcommands) ────────────────────────
// v5.7.0: the standalone `gnosys remote` parent was dropped; everything
// (configure, status, push, pull, sync, resolve) lives here now.
const setupRemoteCmd = setupCmd
  .command("remote")
  .description("Multi-machine sync — configure, sync, and resolve conflicts");

// Bare `gnosys setup remote` — configure wizard (back-compat with v5.6.x)
setupRemoteCmd
  .option("--path <path>", "Set remote path directly (non-interactive)")
  .action(async (opts: { path?: string }) => {
    const { runSetupRemoteCommand } = await import("../lib/setupRemoteCommand.js");
    await runSetupRemoteCommand(opts);
  });

setupRemoteCmd
  .command("status")
  .description("Show remote sync status: pending changes, conflicts, last sync")
  .option("--json", "Output as JSON")
  .action(async (opts: { json: boolean }) => {
    const { runSetupRemoteStatusCommand } = await import("../lib/setupRemoteStatusCommand.js");
    await runSetupRemoteStatusCommand(opts);
  });

setupRemoteCmd
  .command("push")
  .description("Push local changes to remote")
  .option("--newer-wins", "Auto-resolve conflicts by taking the newer version")
  .option("--verbose", "Stream per-memory progress to stderr")
  .action(async (opts: { newerWins?: boolean; verbose?: boolean }) => {
    const { runSetupRemotePushCommand } = await import("../lib/setupRemotePushCommand.js");
    await runSetupRemotePushCommand(opts);
  });

setupRemoteCmd
  .command("pull")
  .description("Pull remote changes to local")
  .option("--newer-wins", "Auto-resolve conflicts by taking the newer version")
  .option("--verbose", "Stream per-memory progress to stderr")
  .action(async (opts: { newerWins?: boolean; verbose?: boolean }) => {
    const { runSetupRemotePullCommand } = await import("../lib/setupRemotePullCommand.js");
    await runSetupRemotePullCommand(opts);
  });

setupRemoteCmd
  .command("sync")
  .description("Two-way sync: push local changes then pull remote changes")
  .option("--auto", "Run silently for cron/LaunchAgent (skip-and-flag for conflicts)")
  .option("--newer-wins", "Auto-resolve conflicts by taking the newer version")
  .option("--verbose", "Stream per-memory progress to stderr")
  .action(async (opts: { auto?: boolean; newerWins?: boolean; verbose?: boolean }) => {
    const { runSetupRemoteSyncCommand } = await import("../lib/setupRemoteSyncCommand.js");
    await runSetupRemoteSyncCommand(opts);
  });

setupRemoteCmd
  .command("resolve <memoryId>")
  .description("Resolve a sync conflict by choosing local, remote, or merged content")
  .option("--keep <choice>", "Choice: local | remote", "local")
  .action(async (memoryId: string, opts: { keep: string }) => {
    const { runSetupRemoteResolveCommand } = await import("../lib/setupRemoteResolveCommand.js");
    await runSetupRemoteResolveCommand(memoryId, opts);
  });

setupRemoteCmd
  .command("doctor")
  .description("Diagnose v13 multi-machine sync (reachability, staging, failed count)")
  .option("--json", "Output as JSON")
  .option("--ingest", "Run master ingest sweep (master role only)")
  .option("--quiet", "Suppress human-readable output (for timer/cron)")
  .action(async (opts: { json?: boolean; ingest?: boolean; quiet?: boolean }) => {
    const { runSyncDoctorCommand } = await import("../lib/syncDoctorCommand.js");
    await runSyncDoctorCommand(opts);
  });

setupRemoteCmd
  .command("timer")
  .description("Install/uninstall the OS-level ingest timer (macOS/Linux)")
  .option("--install", "Install the timer")
  .option("--uninstall", "Uninstall the timer")
  .option("--status", "Check timer status")
  .option("--interval <minutes>", "Interval in minutes (default 15)", "15")
  .option("--json", "Output as JSON")
  .action(async (opts: {
    install?: boolean;
    uninstall?: boolean;
    status?: boolean;
    interval?: string;
    json?: boolean;
  }) => {
    const { runSyncIngestTimerCommand } = await import("../lib/syncIngestTimerCommand.js");
    await runSyncIngestTimerCommand(opts);
  });

// `gnosys setup dream` — configure dream mode (designation, provider, schedule)
setupCmd
  .command("dream")
  .description("Configure Dream Mode — designate this machine, pick provider/model, set schedule")
  .action(async () => {
    const { runDreamSetup } = await import("../lib/setup.js");
    await runDreamSetup({ directory: process.cwd() });
  });

// `gnosys setup ides` — configure IDE / MCP integrations standalone
setupCmd
  .command("ides")
  .description("Configure IDE MCP integrations (Claude Code/Desktop, Cursor, Codex, Grok Build, Gemini CLI, Antigravity)")
  .option("--all", "Configure MCP for all supported IDEs (non-interactive)")
  .action(async (opts: { all?: boolean }) => {
    if (opts.all) {
      const { runIdesSetupAll } = await import("../lib/setup/sections/ides.js");
      const { configured, errors } = await runIdesSetupAll(process.cwd());
      console.log(`\n${configured} ides configured · ${errors} errors`);
      return;
    }
    const readline = await import("readline/promises");
    const { runIdesSetup } = await import("../lib/setup/sections/ides.js");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runIdesSetup({ rl, directory: process.cwd() });
    } finally {
      rl.close();
    }
  });

// `gnosys setup routing` — task-routing wizard standalone
setupCmd
  .command("routing")
  .description("Configure per-task LLM routing (structuring, synthesis, vision, transcription, dream)")
  .action(async () => {
    const readline = await import("readline/promises");
    const { runRoutingSetup } = await import("../lib/setup/sections/routing.js");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runRoutingSetup({ rl, directory: process.cwd() });
    } finally {
      rl.close();
    }
  });

// `gnosys setup preferences` — review user-scope preferences
setupCmd
  .command("preferences")
  .description("Review and clean up user-scope preferences (incl. legacy imports)")
  .action(async () => {
    const readline = await import("readline/promises");
    const { runPreferencesReview } = await import("../lib/setup/sections/preferences.js");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runPreferencesReview(rl);
    } finally {
      rl.close();
    }
  });

// v5.4.2 removal: `gnosys models` (top-level shortcut) was removed in favor
// of the canonical `gnosys setup models` form. The unwired implementation
// (runModelsCommand in setup.ts) was deleted in v5.12.1 after eight minor
// versions without revival — recover from git history if ever needed.
}
