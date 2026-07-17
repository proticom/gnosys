/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { getResolver } from "./_shared.js";

export function registerRuntime(program: Command): void {
// ─── gnosys serve ────────────────────────────────────────────────────────
program
  .command("serve")
  .description(
    "Start the MCP server (stdio mode). Used by IDE integrations — Claude Code/Desktop, Cursor, Codex, etc. spawn this command in the background to talk to gnosys via the Model Context Protocol. You don't normally invoke this yourself; `gnosys setup ides` wires gnosys-mcp into your IDE configs.",
  )
  .option("--with-maintenance", "Run maintenance every 6 hours in background")
  .option("--transport <mode>", "Transport: 'stdio' (default) or 'http' (central-server topology)", "stdio")
  .option("--host <addr>", "HTTP bind address — http transport (default 127.0.0.1; use a tailnet addr to share)", "127.0.0.1")
  .option("--port <n>", "HTTP port — http transport", "7777")
  .option("--token <token>", "Require 'Authorization: Bearer <token>' — http transport")
  .action(async (opts: { withMaintenance?: boolean; transport?: string; host?: string; port?: string; token?: string }) => {
    if (opts.transport === "http") {
      process.env.GNOSYS_TRANSPORT = "http";
      process.env.GNOSYS_HTTP_HOST = opts.host || "127.0.0.1";
      process.env.GNOSYS_HTTP_PORT = String(opts.port || "7777");
      if (opts.token) process.env.GNOSYS_SERVE_TOKEN = opts.token;
    }
    if (opts.withMaintenance) {
      // Start background maintenance loop
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const runMaintenance = async () => {
        try {
          const { GnosysMaintenanceEngine } = await import("../lib/maintenance.js");
          const resolver = new (await import("../lib/resolver.js")).GnosysResolver();
          await resolver.resolve();
          const stores = resolver.getStores();
          if (stores.length > 0) {
            const cfg = await loadConfig(stores[0].path);
            const engine = new GnosysMaintenanceEngine(resolver, cfg);
            const report = await engine.maintain({ autoApply: true });
            console.error(`[maintenance] Completed: ${report.actions.length} action(s), ${report.duplicates.length} duplicate(s), ${report.staleMemories.length} stale`);
          }
        } catch (err) {
          console.error(`[maintenance] Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      // Run immediately on start, then every 6 hours
      setTimeout(runMaintenance, 30000); // 30s after server start
      setInterval(runMaintenance, SIX_HOURS);
      console.error("[maintenance] Background maintenance enabled (every 6 hours)");
    }

    const { startMcpServer } = await import("../index.js");
    await startMcpServer();
  });

// ─── gnosys recall ───────────────────────────────────────────────────────
program
  .command("recall <query>")
  .description("Always-on memory recall — injects most relevant memories as context. Use --federated for cross-scope.")
  .option("--limit <n>", "Max memories to return (default from config)")
  .option("--aggressive", "Force aggressive mode (inject even medium-relevance memories)")
  .option("--no-aggressive", "Force filtered mode (hard cutoff at minRelevance)")
  .option("--trace-id <id>", "Trace ID for audit correlation")
  .option("--json", "Output raw JSON instead of formatted text")
  .option("--host", "Output in host-friendly <gnosys-recall> format (default for MCP)")
  .option("--federated", "Use federated search with tier boosting (project > user > global)")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated)")
  .option("-d, --directory <dir>", "Project directory for context")
  .action(async (query: string, opts: { limit?: string; aggressive?: boolean; traceId?: string; json?: boolean; host?: boolean; federated?: boolean; scope?: string; directory?: string }) => {
    const { runRecallCommand } = await import("../lib/recallCommand.js");
    await runRecallCommand(query, opts);
  });

// ─── gnosys recall-hook ──────────────────────────────────────────────────
program
  .command("recall-hook")
  .description("Claude Code hook entry — reads the hook event JSON from stdin and prints a <gnosys-recall> context block. Wired automatically by gnosys init into UserPromptSubmit + SessionStart.")
  .option("--limit <n>", "Max memories to inject (default from config)")
  .action(async (opts: { limit?: string }) => {
    const { runRecallHookCommand } = await import("../lib/recallHookCommand.js");
    await runRecallHookCommand(opts);
  });

// ─── gnosys audit ────────────────────────────────────────────────────────
program
  .command("audit")
  .description("View the structured audit trail of memory operations from the central DB")
  .option("--days <n>", "Show entries from the last N days", "7")
  .option("--operation <op>", "Filter by operation type (read, write, recall, dream_*, etc.)")
  .option("--limit <n>", "Max entries to show")
  .option("--json", "Output raw JSON instead of formatted timeline")
  .action(async (opts: { days: string; operation?: string; limit?: string; json?: boolean }) => {
    const { runAuditCommand } = await import("../lib/auditCommand.js");
    await runAuditCommand(opts);
  });

// ─── gnosys backup ──────────────────────────────────────────────────────
program
  .command("backup")
  .description("Create a backup of the central Gnosys database and config")
  .option("-o, --output <dir>", "Backup output directory (default: ~/.gnosys/)")
  .option("--to <dir>", "Alias for --output")
  .option("--json", "Output as JSON")
  .action(async (opts: { output?: string; to?: string; json?: boolean }) => {
    const { runBackupCommand } = await import("../lib/backupCommand.js");
    await runBackupCommand(opts);
  });

// ─── gnosys restore ─────────────────────────────────────────────────────
program
  .command("restore <backupFile>")
  .description("Restore the central Gnosys database from a backup")
  .option("--from <file>", "Alias: backup file to restore from")
  .option("--json", "Output as JSON")
  .action(async (backupFile: string, opts: { from?: string; json?: boolean }) => {
    const { runRestoreCommand } = await import("../lib/restoreCommand.js");
    await runRestoreCommand(backupFile, opts);
  });

// ─── gnosys migrate-db ──────────────────────────────────────────────────
program
  .command("migrate-db")
  .description("Legacy data migration. Use --to-central to move per-project stores into the central DB.")
  .option("--to-central", "Migrate all discovered per-project stores into ~/.gnosys/gnosys.db")
  .option("-v, --verbose", "Verbose output")
  .action(async (opts: { toCentral?: boolean; verbose?: boolean }) => {
    const { runMigrateDbCommand } = await import("../lib/migrateDbCommand.js");
    await runMigrateDbCommand(opts, { getResolver });
  });
}
