/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { getResolver, resolveProjectId } from "./_shared.js";

export function registerCore(program: Command): void {
// ─── gnosys read <path> ──────────────────────────────────────────────────
program
  .command("read <memoryPath>")
  .description(
    "Read a specific memory. Supports layer prefix (e.g., project:decisions/auth.md)"
  )
  .option("--json", "Output as JSON")
  .action(async (memoryPath: string, opts: { json?: boolean }) => {
    const { runReadCommand } = await import("../lib/readCommand.js");
    await runReadCommand(getResolver, memoryPath, opts);
  });

// ─── gnosys discover <query> ─────────────────────────────────────────────
program
  .command("discover <query>")
  .description("Discover relevant memories by keyword. Use --federated for tier-boosted cross-scope discovery.")
  .option("-n, --limit <number>", "Max results", "20")
  .option("--json", "Output as JSON")
  .option("--federated", "Use federated discovery with tier boosting (project > user > global)")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated for multiple)")
  .option("-d, --directory <dir>", "Project directory for context")
  .option("--id-format <format>", "ID display format: short | long | raw (default: short)", "short")
  .action(async (query: string, opts: { limit: string; json?: boolean; federated?: boolean; scope?: string; directory?: string; idFormat?: string }) => {
    const { runDiscoverCommand } = await import("../lib/discoverCommand.js");
    await runDiscoverCommand(query, opts);
  });

// ─── gnosys search <query> ───────────────────────────────────────────────
program
  .command("search <query>")
  .description("Search memories by keyword. Use --federated for tier-boosted cross-scope search.")
  .option("-n, --limit <number>", "Max results", "20")
  .option("--json", "Output as JSON")
  .option("--federated", "Use federated search with tier boosting (project > user > global)")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated for multiple)")
  .option("-d, --directory <dir>", "Project directory for context")
  .option("--id-format <format>", "ID display format: short | long | raw (default: short)", "short")
  .action(async (query: string, opts: { limit: string; json?: boolean; federated?: boolean; scope?: string; directory?: string; idFormat?: string }) => {
    const { runSearchCommand } = await import("../lib/searchCommand.js");
    await runSearchCommand(query, opts);
  });

// ─── gnosys list ─────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all memories across all stores")
  .option("-c, --category <category>", "Filter by category")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("-s, --store <store>", "Filter by store layer (project|user|global)")
  .option("--json", "Output as JSON")
  .option("--id-format <format>", "ID display format: short | long | raw (default: short)", "short")
  .action(async (opts: { category?: string; tag?: string; store?: string; json?: boolean; idFormat?: string }) => {
    const { runListCommand } = await import("../lib/listCommand.js");
    await runListCommand(opts);
  });

// ─── gnosys add <input> ──────────────────────────────────────────────────
program
  .command("add <input>")
  .description("Add a new memory (uses LLM to structure raw input)")
  .option(
    "-a, --author <author>",
    "Author (human|ai|human+ai)",
    "human"
  )
  .option(
    "--authority <authority>",
    "Authority level (declared|observed|imported|inferred)",
    "declared"
  )
  .option(
    "-s, --store <store>",
    "Target store (project|personal|global)",
    undefined
  )
  .action(
    async (
      input: string,
      opts: { author: string; authority: string; store?: string }
    ) => {
      const { runAddCommand } = await import("../lib/addCommand.js");
      await runAddCommand(getResolver, input, opts, resolveProjectId);
    }
  );
}
