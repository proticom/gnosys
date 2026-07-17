/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";

export function registerTrace(program: Command): void {
// ─── Phase 10: gnosys trace ─────────────────────────────────────────────

program
  .command("trace <directory>")
  .description("Trace a codebase and store procedural 'how' memories with call-chain relationships")
  .option("--max-files <n>", "Maximum number of source files to scan", "500")
  .option("--project-id <id>", "Project ID to associate memories with")
  .option("--json", "Output as JSON")
  .action(async (directory: string, opts: { maxFiles?: string; projectId?: string; json?: boolean }) => {
    const { runTraceCommand } = await import("../lib/traceCommand.js");
    await runTraceCommand(directory, opts);
  });

// ─── Phase 10: gnosys reflect ───────────────────────────────────────────

program
  .command("reflect <outcome>")
  .description("Reflect on an outcome to update memory confidence and create relationships")
  .option("--memory-ids <ids>", "Comma-separated list of memory IDs to relate to")
  .option("--failure", "Mark this as a failure (default: success)")
  .option("--notes <text>", "Additional notes about the outcome")
  .option("--confidence-delta <n>", "Custom confidence delta (e.g. 0.1 or -0.2)")
  .option("--json", "Output as JSON")
  .action(async (outcome: string, opts: { memoryIds?: string; failure?: boolean; notes?: string; confidenceDelta?: string; json?: boolean }) => {
    const { runReflectCommand } = await import("../lib/reflectCommand.js");
    await runReflectCommand(outcome, opts);
  });

// ─── Phase 10: gnosys traverse ──────────────────────────────────────────

program
  .command("traverse <memoryId>")
  .description("Traverse relationship chains starting from a memory (BFS, depth-limited)")
  .option("-d, --depth <n>", "Maximum traversal depth (default: 3, max: 10)", "3")
  .option("--rel-types <types>", "Comma-separated relationship types to follow (e.g. leads_to,requires)")
  .option("--json", "Output as JSON")
  .action(async (memoryId: string, opts: { depth?: string; relTypes?: string; json?: boolean }) => {
    const { runTraverseCommand } = await import("../lib/traverseCommand.js");
    await runTraverseCommand(memoryId, opts);
  });
}
