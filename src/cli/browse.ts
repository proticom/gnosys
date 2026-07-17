/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { getResolver } from "./_shared.js";

export function registerBrowse(program: Command): void {
// ─── gnosys history <path> ───────────────────────────────────────────────
program
  .command("history <memoryPath>")
  .description("Show audit history for a memory")
  .option("-n, --limit <number>", "Max entries", "20")
  .option("--json", "Output as JSON")
  .action(async (memoryPath: string, opts: { limit: string; json?: boolean }) => {
    const { runHistoryCommand } = await import("../lib/historyCommand.js");
    await runHistoryCommand(memoryPath, opts);
  });

// ─── gnosys timeline ────────────────────────────────────────────────────
program
  .command("timeline")
  .description("Show when memories were created and modified over time")
  .option("-p, --period <period>", "Group by: day, week, month (default), year", "month")
  .option("--project <id>", "Filter to a specific project ID (default: all projects)")
  .option("--limit-titles <n>", "Show titles inline when an entry has <= N memories (default 5)", "5")
  .option("--json", "Output as JSON")
  .action(async (opts: { period: string; project?: string; limitTitles: string; json?: boolean }) => {
    const { runTimelineCommand } = await import("../lib/timelineCommand.js");
    await runTimelineCommand(opts);
  });

// ─── gnosys stats ───────────────────────────────────────────────────────
program
  .command("stats")
  .description("Show summary statistics for the memory store. Use --by-project for a per-project breakdown across the central DB.")
  .option("--json", "Output as JSON")
  .option("--by-project", "Show a per-project breakdown table instead of single-store stats")
  .option("--all", "Include all projects (don't filter to current project)")
  .action(async (opts: { json?: boolean; byProject?: boolean; all?: boolean }) => {
    const { runStatsCommand } = await import("../lib/statsCommand.js");
    await runStatsCommand(opts);
  });

// ─── gnosys links <path> ─────────────────────────────────────────────────
program
  .command("links <memoryPath>")
  .description("Show wikilinks for a memory — both outgoing [[links]] and backlinks from other memories")
  .option("--json", "Output as JSON")
  .action(async (memoryPath: string, opts: { json?: boolean }) => {
    const { runLinksCommand } = await import("../lib/linksCommand.js");
    await runLinksCommand(getResolver, memoryPath, opts);
  });

// ─── gnosys graph ───────────────────────────────────────────────────────
program
  .command("graph")
  .description("Show the [[wikilink]] cross-reference graph between memories. Empty until you start using [[Title]] in memory content — then this shows which memories reference each other.")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { runGraphCommand } = await import("../lib/graphCommand.js");
    await runGraphCommand(opts);
  });
}
