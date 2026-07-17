/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";

export function registerSandbox(program: Command): void {
// ─── gnosys sandbox start|stop|status ─────────────────────────────────────

const sandboxCmd = program
  .command("sandbox")
  .description(
    "Manage the Gnosys sandbox — a long-lived background process that holds the SQLite handle so agents can call gnosys.add()/recall() through a tiny helper library instead of paying the MCP roundtrip on every call. Lower latency, lower context cost. Most users don't need this; it's for high-throughput agent workflows.",
  );

sandboxCmd
  .command("start")
  .description("Start the Gnosys sandbox background process")
  .option("--persistent", "Keep running across reboots (future use)")
  .option("--db-path <path>", "Custom database directory")
  .option("--json", "Output as JSON")
  .action(async (opts: { persistent?: boolean; dbPath?: string; json?: boolean }) => {
    const { runSandboxStartCommand } = await import("../lib/sandboxStartCommand.js");
    await runSandboxStartCommand(opts);
  });

sandboxCmd
  .command("stop")
  .description("Stop the Gnosys sandbox background process")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { runSandboxStopCommand } = await import("../lib/sandboxStopCommand.js");
    await runSandboxStopCommand(opts);
  });

sandboxCmd
  .command("status")
  .description("Check if the Gnosys sandbox is running")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { runSandboxStatusCommand } = await import("../lib/sandboxStatusCommand.js");
    await runSandboxStatusCommand(opts);
  });

// ─── gnosys helper generate ───────────────────────────────────────────────

const helperCmd = program
  .command("helper")
  .description(
    "Generate a tiny TypeScript helper library that agents import to talk to the gnosys sandbox directly. Pairs with `gnosys sandbox start` — agents call gnosys.add()/recall() like normal code instead of issuing MCP tool calls. Run `gnosys helper generate` in your agent's project to drop in `gnosys-helper.ts`.",
  );

helperCmd
  .command("generate")
  .description("Generate a gnosys-helper.ts file in the current directory (or specified directory)")
  .option("-d, --directory <dir>", "Target directory (default: cwd)")
  .option("--json", "Output as JSON")
  .action(async (opts: { directory?: string; json?: boolean }) => {
    const { runHelperGenerateCommand } = await import("../lib/helperGenerateCommand.js");
    await runHelperGenerateCommand(opts);
  });
}
