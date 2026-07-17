/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { getResolver } from "./_shared.js";

export function registerData(program: Command): void {
// ─── gnosys bootstrap <sourceDir> ────────────────────────────────────────
program
  .command("bootstrap <sourceDir>")
  .description("Batch-import existing documents into the memory store")
  .option("-p, --pattern <patterns...>", "File patterns to match (default: **/*.md)")
  .option("--skip-existing", "Skip files whose titles already exist in the store")
  .option("-c, --category <category>", "Default category (default: imported)", "imported")
  .option("-a, --author <author>", "Default author", "human")
  .option("--authority <authority>", "Default authority", "imported")
  .option("--confidence <n>", "Default confidence (0-1)", "0.7")
  .option("--preserve-frontmatter", "Preserve existing YAML frontmatter if present")
  .option("--dry-run", "Show what would be imported without writing")
  .option("-s, --store <store>", "Target store (project|personal|global)", undefined)
  .action(
    async (
      sourceDir: string,
      opts: {
        pattern?: string[];
        skipExisting?: boolean;
        category: string;
        author: string;
        authority: string;
        confidence: string;
        preserveFrontmatter?: boolean;
        dryRun?: boolean;
        store?: string;
      }
    ) => {
      const { runBootstrapCommand } = await import("../lib/bootstrapCommand.js");
      await runBootstrapCommand(getResolver, sourceDir, opts);
    }
  );

// ─── gnosys import (parent + subcommands) ───────────────────────────────
const importCmd = program
  .command("import [fileOrUrl]")
  .enablePositionalOptions()
  .description(
    "Import data into Gnosys (bulk CSV/JSON/JSONL — see also: 'gnosys import project <bundle>')"
  )
  .option(
    "--format <format>",
    "Data format: csv, json, jsonl (required for bulk import)"
  )
  .option(
    "--mapping <json>",
    'Field mapping as JSON: \'{"source_field":"gnosys_field"}\'. Valid targets: title, category, content, tags, relevance'
  )
  .option("--mode <mode>", "Processing mode: llm or structured", "structured")
  .option("--limit <n>", "Max records to import", parseInt)
  .option("--offset <n>", "Skip first N records", parseInt)
  .option("--skip-existing", "Skip records whose titles already exist")
  .option("--batch-commit", "Single git commit for all imports (default)", true)
  .option("--no-batch-commit", "Commit each record individually")
  .option("--concurrency <n>", "Parallel LLM calls (default: 5)", parseInt)
  .option("--dry-run", "Preview without writing")
  .option(
    "--store <store>",
    "Target store: project, personal, global",
    "project"
  )
  .action(
    async (
      fileOrUrl: string | undefined,
      opts: {
        format?: string;
        mapping?: string;
        mode: string;
        limit?: number;
        offset?: number;
        skipExisting?: boolean;
        batchCommit: boolean;
        concurrency?: number;
        dryRun?: boolean;
        store: string;
      }
    ) => {
      const { runImportCommand } = await import("../lib/importCommand.js");
      await runImportCommand(getResolver, fileOrUrl, opts);
    }
  );

// `gnosys import project <bundle>` — restore a portable .json.gz bundle
importCmd
  .command("project <bundlePath>")
  .description("Import a project bundle (.json.gz) created by 'gnosys export project'")
  .option("--strategy <strategy>", "Conflict handling: merge (default), replace, new-id", "merge")
  .option("--working-directory <dir>", "Override the bundle's working_directory (e.g. when restoring on a different machine)")
  .option("--json", "Output the result as JSON")
  .action(async (bundlePath: string, opts: { strategy: string; workingDirectory?: string; json?: boolean }) => {
    const { runImportProjectCommand } = await import("../lib/importProjectCommand.js");
    await runImportProjectCommand(bundlePath, opts);
  });

// ─── gnosys reindex ──────────────────────────────────────────────────────
program
  .command("reindex")
  .description(
    "Rebuild semantic embeddings for every memory in the central DB. Run after bulk imports, schema changes, or if hybrid search starts returning poor matches. Downloads the all-MiniLM-L6-v2 model (~80 MB) on first run.",
  )
  .action(async () => {
    const { runReindexCommand } = await import("../lib/reindexCommand.js");
    await runReindexCommand(getResolver);
  });

// ─── gnosys hybrid-search <query> ───────────────────────────────────────
program
  .command("hybrid-search <query>")
  .description("Search using hybrid keyword + semantic fusion (RRF). Use --federated for cross-scope.")
  .option("-l, --limit <n>", "Max results", "15")
  .option("-m, --mode <mode>", "Search mode: keyword | semantic | hybrid", "hybrid")
  .option("--json", "Output as JSON")
  .option("--federated", "Use federated search with tier boosting (project > user > global)")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated)")
  .option("-d, --directory <dir>", "Project directory for context")
  .action(async (query: string, opts: { limit: string; mode: string; json?: boolean; federated?: boolean; scope?: string; directory?: string }) => {
    const { runHybridSearchCommand } = await import("../lib/hybridSearchCommand.js");
    await runHybridSearchCommand(getResolver, query, opts);
  });

// ─── gnosys semantic-search <query> ─────────────────────────────────────
program
  .command("semantic-search <query>")
  .description("Search using semantic similarity only (requires embeddings)")
  .option("-l, --limit <n>", "Max results", "15")
  .option("--json", "Output as JSON")
  .action(async (query: string, opts: { limit: string; json?: boolean }) => {
    const { runSemanticSearchCommand } = await import("../lib/semanticSearchCommand.js");
    await runSemanticSearchCommand(getResolver, query, opts);
  });

// ─── gnosys ask <question> ──────────────────────────────────────────────
program
  .command("ask <question>")
  .description(
    "Ask a natural-language question and get a synthesized answer with citations. Use --federated for cross-scope."
  )
  .option("-l, --limit <n>", "Max memories to retrieve", "15")
  .option("-m, --mode <mode>", "Search mode: keyword | semantic | hybrid", "hybrid")
  .option("--no-stream", "Disable streaming output")
  .option("--federated", "Use federated search with tier boosting (project > user > global)")
  .option("--scope <scope>", "Filter by scope: project, user, global (comma-separated)")
  .option("-d, --directory <dir>", "Project directory for context")
  .option("--json", "Output as JSON")
  .action(async (question: string, opts: { limit: string; mode: string; stream: boolean; federated?: boolean; scope?: string; directory?: string; json?: boolean }) => {
    const { runAskCommand } = await import("../lib/askCommand.js");
    await runAskCommand(getResolver, question, opts);
  });

// ─── gnosys stores ───────────────────────────────────────────────────────
program
  .command("stores")
  .description("Show all active stores, their layers, paths, and permissions")
  .action(async () => {
    const { runStoresCommand } = await import("../lib/storesCommand.js");
    await runStoresCommand(getResolver);
  });

// ─── gnosys config ──────────────────────────────────────────────────────
const configCmd = program
  .command("config")
  .description("View and manage LLM provider configuration");

configCmd
  .command("show")
  .description("Show current LLM configuration")
  .option("--json", "Dump the raw effective config as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { runConfigShowCommand } = await import("../lib/configCommand.js");
    await runConfigShowCommand(getResolver, opts);
  });

configCmd
  .command("set <key> <value> [extra...]")
  .description("Set a config value. Keys: provider, model, ollama-url, groq-model, openai-model, lmstudio-url, task <task> <provider> <model>")
  .action(async (key: string, value: string, extra: string[]) => {
    const { runConfigSetCommand } = await import("../lib/configCommand.js");
    await runConfigSetCommand(getResolver, key, value, extra);
  });

configCmd
  .command("init")
  .description("Generate a blank gnosys.json template (deprecated — prefer `gnosys setup`)")
  .option("--force", "Skip the deprecation warning and write the template")
  .action(async (opts: { force?: boolean }) => {
    const { runConfigInitCommand } = await import("../lib/configCommand.js");
    await runConfigInitCommand(getResolver, opts);
  });

// ─── gnosys reindex-graph ───────────────────────────────────────────────
program
  .command("reindex-graph")
  .description("Build or rebuild the wikilink graph (.gnosys/graph.json)")
  .action(async () => {
    const { runReindexGraphCommand } = await import("../lib/reindexGraphCommand.js");
    await runReindexGraphCommand(getResolver);
  });
}
