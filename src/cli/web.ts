/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import path from "path";
import { getResolver } from "./_shared.js";

export function registerWeb(program: Command): void {
// ─── gnosys web init|ingest|build-index|build|add|remove|update|status ──

async function getWebStorePath(): Promise<string> {
  const resolver = await getResolver();
  const stores = resolver.getStores();
  return stores.length > 0 ? stores[0].path : path.join(process.cwd(), ".gnosys");
}

const webCmd = program
  .command("web")
  .description("Web Knowledge Base — generate searchable knowledge from websites");

webCmd
  .command("init")
  .description("Interactive setup for web knowledge base")
  .option("--source <type>", "Source type: sitemap, directory, urls", "sitemap")
  .option("--output <dir>", "Output directory for knowledge files", "./knowledge")
  .option("--no-config", "Skip gnosys.json modification")
  .option("--non-interactive", "Skip prompts, use defaults")
  .option("--json", "Output as JSON")
  .action(async (opts: { source: string; output: string; config: boolean; nonInteractive?: boolean; json?: boolean }) => {
    const { runWebInitCommand } = await import("../lib/webInitCommand.js");
    await runWebInitCommand(getWebStorePath, opts);
  });

webCmd
  .command("ingest")
  .description("Crawl the configured source and generate knowledge markdown files")
  .option("--source <url>", "Override sitemap URL or content directory")
  .option("--prune", "Remove orphaned knowledge files")
  .option("--no-llm", "Force structured mode (no LLM)")
  .option("--concurrency <n>", "Parallel processing limit", "3")
  .option("--dry-run", "Show what would change without writing files")
  .option("--verbose", "Print per-page details")
  .option("--json", "Output results as JSON")
  .action(async (opts: { source?: string; prune?: boolean; llm: boolean; concurrency: string; dryRun?: boolean; verbose?: boolean; json?: boolean }) => {
    const { runWebIngestCommand } = await import("../lib/webIngestCommand.js");
    await runWebIngestCommand(getWebStorePath, opts);
  });

webCmd
  .command("build-index")
  .description("Generate search index JSON from the knowledge directory")
  .option("--input <dir>", "Override knowledge directory")
  .option("--output <path>", "Override output file path")
  .option("--no-stop-words", "Disable stop-word filtering")
  .option("--embeddings <provider>", "Also build gnosys-vectors.json (openai|voyage|local)")
  .option("--embed-model <id>", "Override the embedding model")
  .option("--no-expansions", "Skip LLM concept-expansion generation")
  .option("--json", "Output index stats as JSON")
  .action(async (opts: { input?: string; output?: string; stopWords: boolean; embeddings?: string; embedModel?: string; expansions: boolean; json?: boolean }) => {
    const { runWebBuildIndexCommand } = await import("../lib/webBuildIndexCommand.js");
    await runWebBuildIndexCommand(getWebStorePath, opts);
  });

webCmd
  .command("build")
  .description("Run ingest + build-index in one shot")
  .option("--source <url>", "Override sitemap URL or content directory")
  .option("--prune", "Remove orphaned knowledge files")
  .option("--no-llm", "Force structured mode (no LLM)")
  .option("--concurrency <n>", "Parallel processing limit", "3")
  .option("--dry-run", "Show what would change without writing files")
  .option("--embeddings <provider>", "Also build gnosys-vectors.json (openai|voyage|local)")
  .option("--embed-model <id>", "Override the embedding model")
  .option("--no-expansions", "Skip LLM concept-expansion generation")
  .option("--json", "Output results as JSON")
  .action(async (opts: { source?: string; prune?: boolean; llm: boolean; concurrency: string; dryRun?: boolean; embeddings?: string; embedModel?: string; expansions: boolean; json?: boolean }) => {
    const { runWebBuildCommand } = await import("../lib/webBuildCommand.js");
    await runWebBuildCommand(getWebStorePath, opts);
  });

webCmd
  .command("add <url>")
  .description("Ingest a single URL into the knowledge base")
  .option("--category <name>", "Override category inference")
  .option("--no-llm", "Force structured mode")
  .option("--no-reindex", "Skip index rebuild")
  .option("--json", "Output as JSON")
  .action(async (url: string, opts: { category?: string; llm: boolean; reindex: boolean; json?: boolean }) => {
    const { runWebAddCommand } = await import("../lib/webAddCommand.js");
    await runWebAddCommand(getWebStorePath, url, opts);
  });

webCmd
  .command("remove <filepath>")
  .description("Remove a knowledge file and rebuild the index")
  .option("--json", "Output as JSON")
  .action(async (filepath: string, opts: { json?: boolean }) => {
    const { runWebRemoveCommand } = await import("../lib/webRemoveCommand.js");
    await runWebRemoveCommand(getWebStorePath, filepath, opts);
  });

webCmd
  .command("update <urlOrPath>")
  .description("Re-ingest a URL or refresh a knowledge file, then rebuild the index")
  .option("--no-llm", "Force structured mode (no LLM)")
  .option("--category <name>", "Override category inference")
  .option("--json", "Output as JSON")
  .action(async (urlOrPath: string, opts: { llm: boolean; category?: string; json?: boolean }) => {
    const { runWebUpdateCommand } = await import("../lib/webUpdateCommand.js");
    await runWebUpdateCommand(getWebStorePath, urlOrPath, opts);
  });

webCmd
  .command("status")
  .description("Show the current state of the web knowledge base")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { runWebStatusCommand } = await import("../lib/webStatusCommand.js");
    await runWebStatusCommand(getWebStorePath, opts);
  });
}
