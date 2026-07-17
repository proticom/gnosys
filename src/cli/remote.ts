/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { GnosysDB } from "../lib/db.js";
import { outputResult } from "./_shared.js";

export function registerRemote(program: Command): void {
program
  .command("connect")
  .description("Point an IDE at a remote gnosys server (central-server topology) instead of spawning a local one")
  .requiredOption("--url <url>", "Remote MCP URL, e.g. http://studio.tailnet.ts.net:7777/mcp")
  .option("--token <token>", "Bearer token if the server requires auth")
  .option("--ide <ide>", "IDE config to write: cursor | claude-desktop", "cursor")
  .option("--dir <dir>", "Project dir for cursor config (default: cwd)")
  .option("--print", "Print the config snippet instead of writing files")
  .action(async (opts: { url: string; token?: string; ide?: string; dir?: string; print?: boolean }) => {
    const { runConnectCommand } = await import("../lib/connectCommand.js");
    await runConnectCommand(opts);
  });

program
  .command("centralize")
  .description("Copy this machine's local brain (~/.gnosys/gnosys.db) to seed a central server — a Docker volume or another host")
  .requiredOption("--to <dir>", "Target directory to write gnosys.db into (e.g. a mounted volume)")
  .option("--from-local", "Source is this machine's local brain (default)")
  .option("--force", "Overwrite an existing gnosys.db at the target")
  .action(async (opts: { to: string; force?: boolean }) => {
    const { runCentralizeCommand } = await import("../lib/centralizeCommand.js");
    await runCentralizeCommand(opts);
  });

const machineCmd = program
  .command("machine")
  .description("Manage this machine's local config (machine.json: machineId, roots, remote)");

machineCmd
  .command("show")
  .description("Show this machine's machine.json")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { readMachineConfig } = await import("../lib/machineConfig.js");
    const { getMachineConfigPath } = await import("../lib/paths.js");
    const cfg = readMachineConfig();
    if (!cfg) {
      console.log(`No machine.json yet (${getMachineConfigPath()}).`);
      console.log("Run 'gnosys machine migrate' (existing setup) or 'gnosys scan' to create it.");
      return;
    }
    outputResult(!!opts.json, cfg, () => {
      console.log(`machine.json: ${getMachineConfigPath()}`);
      console.log(`  machineId: ${cfg.machineId}`);
      console.log(`  hostname:  ${cfg.hostname}`);
      console.log(`  roots:     ${JSON.stringify(cfg.roots)}`);
      console.log(`  remote:    ${cfg.remote.enabled ? (cfg.remote.path ?? "(enabled, no path)") : "(disabled)"}`);
    });
  });

machineCmd
  .command("migrate")
  .description("Move machine-local config (machineId, remote) out of the synced DB into machine.json, set roots, and scan")
  .option("--root <dir>", "Set the 'dev' root for this machine (default: derived from the registry)")
  .option("--no-scan", "Skip the project scan after migrating")
  .action(async (opts: { root?: string; scan?: boolean }) => {
    const { migrateMachine } = await import("../lib/machineMigrate.js");
    const { getMachineConfigPath } = await import("../lib/paths.js");
    const db = GnosysDB.openLocal();
    if (!db.isAvailable()) {
      console.error("Central DB not available (better-sqlite3 missing).");
      process.exit(1);
    }
    const res = await migrateMachine(db, { root: opts.root, scan: opts.scan });
    db.close();

    console.log(`✓ machine.json written: ${getMachineConfigPath()}`);
    const idNote = res.adoptedMachineId
      ? " (adopted from synced meta)"
      : res.regeneratedMachineId ? " (regenerated)" : "";
    console.log(`  machineId: ${res.machineId}${idNote}`);
    if (res.adoptedRemotePath) {
      console.log("  remote: adopted remote_path from synced meta (removed from shared DB)");
    }
    console.log(`  roots: ${JSON.stringify(res.rootsConfigured)}`);
    if (res.scan) {
      console.log(`  scanned ${res.scan.entries.length} project(s):`);
      for (const e of res.scan.entries) console.log(`    ${e.name}  [${e.mode}]  ${e.absPath}`);
    } else {
      console.log("  (scan skipped — set a root in machine.json, then run 'gnosys scan')");
    }
  });

machineCmd
  .command("list")
  .alias("ls")
  .description("List machines in the connected-machines registry (shared brain)")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const os = await import("os");
    const { readMachineRegistry } = await import("../lib/machineRegistry.js");
    const db = GnosysDB.openCentral();
    if (!db.isAvailable()) {
      console.error("Central DB not available (better-sqlite3 missing).");
      process.exit(1);
    }
    const registry = readMachineRegistry(db);
    db.close();
    const currentHost = os.hostname();
    const entries = Object.entries(registry);
    outputResult(!!opts.json, registry, () => {
      if (entries.length === 0) {
        console.log("No machines recorded yet.");
        return;
      }
      console.log("Connected machines:");
      for (const [host, info] of entries) {
        const here = host === currentHost ? "  ← this machine" : "";
        const seen = info.lastSeen ? info.lastSeen.split("T")[0] : "unknown";
        console.log(`  ${host}  v${info.version}  last seen ${seen}${here}`);
      }
    });
  });

machineCmd
  .command("forget <hostname>")
  .description("Remove a machine from the connected-machines registry (e.g. a phantom left by a rename)")
  .action(async (hostname: string) => {
    const os = await import("os");
    const { forgetMachine } = await import("../lib/machineRegistry.js");
    if (hostname === os.hostname()) {
      console.error(`Refusing to forget '${hostname}' — that's this machine.`);
      console.error("It would just re-register on the next 'gnosys setup sync-projects'.");
      process.exit(1);
    }
    const db = GnosysDB.openCentral();
    if (!db.isAvailable()) {
      console.error("Central DB not available (better-sqlite3 missing).");
      process.exit(1);
    }
    const removed = forgetMachine(db, hostname);
    db.close();
    if (removed) {
      console.log(`✓ Removed '${hostname}' from the connected-machines registry.`);
    } else {
      console.log(`No machine named '${hostname}' in the registry. Nothing to do.`);
      console.log("Run 'gnosys machine list' to see registered machines.");
    }
  });

program
  .command("scan")
  .description("Discover projects under this machine's roots (machine.json) and record their machine-portable locations")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { ensureMachineConfig } = await import("../lib/machineConfig.js");
    const { getMachineConfigPath } = await import("../lib/paths.js");
    const { scanProjects } = await import("../lib/projectScan.js");

    const ens = ensureMachineConfig();
    const machine = ens.config;
    if (Object.keys(machine.roots).length === 0) {
      console.error("No project roots configured for this machine.");
      console.error(`Add roots to ${getMachineConfigPath()}, e.g.`);
      console.error('  { "roots": { "dev": "/Users/edward/MSDev/projects" } }');
      process.exit(1);
    }

    const db = GnosysDB.openCentral();
    if (!db.isAvailable()) {
      console.error("Central DB not available (better-sqlite3 missing).");
      process.exit(1);
    }
    const result = await scanProjects(db, machine);
    db.close();

    outputResult(!!opts.json, {
      machineId: machine.machineId,
      roots: result.roots,
      count: result.entries.length,
      entries: result.entries,
    }, () => {
      if (ens.regenerated) {
        console.log("⚠ machine.json hostname mismatch — regenerated machineId for this machine.\n");
      }
      console.log(`Scanned ${result.roots.length} root(s); registered ${result.entries.length} project(s):`);
      for (const e of result.entries) {
        console.log(`  ${e.name}  [${e.mode}]  ${e.absPath}`);
      }
    });
  });

// ─── gnosys projects ────────────────────────────────────────────────────
program
  .command("projects")
  .description("List registered projects from the central DB")
  .option("--json", "Output as JSON")
  .option("--all", "Include dead projects (deleted directories)")
  .option("--prune", "Delete registry entries whose directory no longer exists (interactive by default)")
  .option("--dry-run", "With --prune: list what would be deleted, don't actually delete")
  .option("--yes", "With --prune: skip the confirmation prompt (scripting/automation)")
  .action(async (opts: { json?: boolean; all?: boolean; prune?: boolean; dryRun?: boolean; yes?: boolean }) => {
    const { runProjectsCommand } = await import("../lib/projectsCommand.js");
    await runProjectsCommand(opts);
  });
}
