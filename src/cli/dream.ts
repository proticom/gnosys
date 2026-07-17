/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";

export function registerDream(program: Command): void {
// ─── gnosys dream (parent command) ───────────────────────────────────────
const dreamCmd = program
  .command("dream")
  .description("Dream Mode — idle-time consolidation (run a cycle, view log)");

// Shared options type for bare `gnosys dream` and `gnosys dream run`.
type DreamRunOpts = {
  maxRuntime?: string;
  critique?: boolean;
  summaries?: boolean;
  relationships?: boolean;
  json?: boolean;
  force?: boolean;
  scheduled?: boolean;
};

// Bare `gnosys dream` runs a cycle (preserves v5.4.1 behavior).
dreamCmd
  .option("--max-runtime <minutes>", "Max runtime in minutes (default: 30)")
  .option("--no-critique", "Skip self-critique phase")
  .option("--no-summaries", "Skip summary generation")
  .option("--no-relationships", "Skip relationship discovery")
  .option("--force", "Run even if this machine is not the designated dream node")
  .option("--scheduled", "Run as the machine-level scheduler (applies night/idle/cooldown gates)")
  .option("--json", "Output raw JSON report")
  .action(async (opts: DreamRunOpts) => {
    const { runDreamCommand } = await import("../lib/dreamCommand.js");
    await runDreamCommand(opts);
  });

// `gnosys dream run` — explicit alias matching the `gnosys dream log|run`
// pattern. Same options + behavior as the bare command.
dreamCmd
  .command("run")
  .description("Force a dream cycle now (manual trigger)")
  .option("--max-runtime <minutes>", "Max runtime in minutes (default: 30)")
  .option("--no-critique", "Skip self-critique phase")
  .option("--no-summaries", "Skip summary generation")
  .option("--no-relationships", "Skip relationship discovery")
  .option("--force", "Run even if this machine is not the designated dream node")
  .option("--scheduled", "Run as the machine-level scheduler (applies night/idle/cooldown gates)")
  .option("--json", "Output raw JSON report")
  .action(async function (this: import("commander").Command, opts: DreamRunOpts) {
    // v5.13.1: the bare `gnosys dream` parent declares the same flags, and
    // commander resolves parent-declared options onto the PARENT during
    // `dream run --scheduled` — so run's opts arrived empty and every
    // scheduled invocation (the launchd agent's exact command line) ran as
    // a MANUAL dream, bypassing the night/idle/dreamworthiness gates.
    // Merge parent opts (same pattern as `dream log` below).
    const merged = { ...(this.parent?.opts() ?? {}), ...opts } as DreamRunOpts;
    const { runDreamCommand } = await import("../lib/dreamCommand.js");
    await runDreamCommand(merged);
  });

// `gnosys dream log` — view recent dream runs from audit_log
dreamCmd
  .command("log")
  .description("Show recent dream runs from the audit log (default: last 20)")
  .option("--last <N>", "Number of most recent runs to show", "20")
  .option("--since <YYYY-MM-DD>", "Only runs since this date")
  .option("--failures-only", "Only runs with errors or unreachable provider")
  .option("--json", "Output raw audit rows as JSON")
  .action(async function (this: import("commander").Command, opts: { last: string; since?: string; failuresOnly?: boolean; json?: boolean }) {
    const { runDreamLogCommand } = await import("../lib/dreamLogCommand.js");
    await runDreamLogCommand(opts, { parentJson: !!this.parent?.opts().json });
  });

// `gnosys dream report` — render JSONL run history as a self-contained HTML dashboard
dreamCmd
  .command("report")
  .description("Generate an HTML dashboard from ~/.gnosys/dream-runs.jsonl")
  .option("--output <file>", "Output HTML file", "dream-dashboard.html")
  .option("--last <N>", "Number of most recent runs to include")
  .action(async (opts: { output?: string; last?: string }) => {
    const { runDreamReportCommand } = await import("../lib/dreamReport.js");
    await runDreamReportCommand(opts);
  });
}
