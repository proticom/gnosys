/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import path from "path";
import fs from "fs/promises";
import { GnosysResolver } from "../lib/resolver.js";
import { generateConfigTemplate } from "../lib/config.js";
import { GnosysDB } from "../lib/db.js";
import { createProjectIdentity } from "../lib/projectIdentity.js";

export function registerProject(program: Command): void {
// ─── gnosys init ─────────────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize Gnosys in the current directory (project store, identity, central DB). Wire IDE MCP servers with: gnosys setup ides")
  .option("-d, --directory <dir>", "Target directory (default: cwd)")
  .option("-n, --name <name>", "Project name (default: directory basename)")
  .action(async (opts: { directory?: string; name?: string }) => {
    const targetDir = opts.directory
      ? path.resolve(opts.directory)
      : process.cwd();
    const storePath = path.join(targetDir, ".gnosys");

    // Check if already exists — re-sync identity instead of failing
    let isResync = false;
    try {
      await fs.stat(storePath);
      isResync = true;
    } catch {
      // Good — fresh init
    }

    if (!isResync) {
      // Create directory structure (DB is sole source of truth — no category folders or changelog)
      await fs.mkdir(storePath, { recursive: true });
      await fs.mkdir(path.join(storePath, ".config"), { recursive: true });

      const defaultRegistry = {
        domain: [
          "architecture", "api", "auth", "database", "devops",
          "frontend", "backend", "testing", "security", "performance",
        ],
        type: [
          "decision", "concept", "convention", "requirement",
          "observation", "fact", "question",
        ],
        concern: ["dx", "scalability", "maintainability", "reliability"],
        status_tag: ["draft", "stable", "deprecated", "experimental"],
      };
      await fs.writeFile(
        path.join(storePath, ".config", "tags.json"),
        JSON.stringify(defaultRegistry, null, 2),
        "utf-8"
      );

      // Write default gnosys.json config (LLM settings)
      await fs.writeFile(
        path.join(storePath, ".config", "gnosys-config.json"),
        generateConfigTemplate() + "\n",
        "utf-8"
      );

      // v5.0: Create attachments directory and empty manifest
      await fs.mkdir(path.join(storePath, "attachments"), { recursive: true });
      await fs.writeFile(
        path.join(storePath, "attachments", "attachments.json"),
        JSON.stringify({ attachments: [] }, null, 2) + "\n",
        "utf-8"
      );

      // Create .gitignore inside .gnosys to exclude large binary attachments
      const storeGitignore = "# Large binary attachments (tracked via manifest, not git)\nattachments/\n";
      await fs.writeFile(
        path.join(storePath, ".gitignore"),
        storeGitignore,
        "utf-8"
      );
    }

    // v3.0: Create/update project identity and register in central DB
    let centralDb: GnosysDB | null = null;
    try {
      centralDb = GnosysDB.openCentral();
      if (!centralDb.isAvailable()) centralDb = null;
    } catch {
      centralDb = null;
    }

    const identity = await createProjectIdentity(targetDir, {
      projectName: opts.name,
      centralDb: centralDb || undefined,
    });

    // Register in file-based project registry so resolver can find it
    const tempResolver = new GnosysResolver();
    await tempResolver.registerProject(targetDir);

    // Add .gnosys/ to project's .gitignore (runs on both init and re-sync)
    try {
      const projectGitignore = path.join(targetDir, ".gitignore");
      let gitignoreContent = "";
      try {
        gitignoreContent = await fs.readFile(projectGitignore, "utf-8");
      } catch {
        // No .gitignore yet
      }
      if (!gitignoreContent.includes(".gnosys")) {
        const entry = "\n# Gnosys memory store\n.gnosys/\n";
        await fs.writeFile(projectGitignore, gitignoreContent + entry, "utf-8");
      }
    } catch {
      // Non-critical
    }

    if (centralDb) centralDb.close();

    const action = isResync ? "re-synced" : "initialized";
    console.log(`Gnosys store ${action} at ${storePath}`);
    console.log(`\nProject Identity:`);
    console.log(`  ID:        ${identity.projectId}`);
    console.log(`  Name:      ${identity.projectName}`);
    console.log(`  Directory: ${identity.workingDirectory}`);
    console.log(`  Agent:     ${identity.agentRulesTarget || "none detected"}`);
    console.log(`  Central DB: ${centralDb ? "registered ✓" : "not available"}`);

    if (!isResync) {
      console.log(`\nCreated:`);
      console.log(`  gnosys.json   (project identity)`);
      console.log(`  .config/      (internal config)`);
      console.log(`  tags.json     (tag registry)`);
    }

    // Configure IDE hooks for automatic memory recall
    const { configureIdeHooks } = await import("../lib/projectIdentity.js");
    const hookResult = await configureIdeHooks(targetDir);
    if (hookResult.configured) {
      console.log(`\nIDE hooks (${hookResult.ide}):`);
      console.log(`  ${hookResult.details}`);
      console.log(`  File: ${hookResult.filePath}`);
    } else {
      console.log(`\nIDE hooks: ${hookResult.details}`);
    }

    console.log(`\nWire IDE MCP servers: gnosys setup ides`);
    console.log(`Start adding memories with: gnosys add "your knowledge here"`);
  });

// ─── gnosys migrate ─────────────────────────────────────────────────────
program
  .command("migrate")
  .description("Interactively migrate a .gnosys/ store to a new directory. Moves files, updates project name/paths, syncs to central DB, and cleans up.")
  .option("--from <dir>", "Source directory containing .gnosys/ (skips prompt)")
  .option("--to <dir>", "Target directory to move .gnosys/ into (skips prompt)")
  .option("--name <name>", "New project name (skips prompt, default: basename of target)")
  .option("--yes", "Skip all confirmation prompts (non-interactive mode)")
  .action(async (opts: { from?: string; to?: string; name?: string; yes?: boolean }) => {
    const { runMigrateCommand } = await import("../lib/migrateCommand.js");
    await runMigrateCommand(opts);
  });
}
