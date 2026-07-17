/**
 * Gnosys CLI — command registrations extracted verbatim from src/cli.ts
 * (v6.2.1 cli split). Pure file reorganization; no behavior change.
 */
import { Command } from "commander";
import { getResolver, resolveProjectId } from "./_shared.js";

export function registerMemory(program: Command): void {
// ─── gnosys stale ───────────────────────────────────────────────────────
program
  .command("stale")
  .description("Find memories not modified within a given number of days")
  .option("-d, --days <number>", "Days threshold", "90")
  .option("-n, --limit <number>", "Max results", "20")
  .action(async (opts: { days: string; limit: string }) => {
    const { runStaleCommand } = await import("../lib/staleCommand.js");
    await runStaleCommand(getResolver, opts);
  });

// ─── gnosys tags ─────────────────────────────────────────────────────────
program
  .command("tags")
  .description("List all tags in the registry")
  .action(async () => {
    const { runTagsCommand } = await import("../lib/tagsCommand.js");
    await runTagsCommand(getResolver);
  });

// ─── gnosys update <path> ────────────────────────────────────────────────
program
  .command("update <memoryPath>")
  .description("Update an existing memory's frontmatter and/or content")
  .option("--title <title>", "New title")
  .option("--status <status>", "New status (active|archived|superseded)")
  .option("--confidence <n>", "New confidence (0-1)")
  .option("--relevance <keywords>", "Updated relevance keyword cloud")
  .option("--supersedes <id>", "ID of memory this supersedes")
  .option("--superseded-by <id>", "ID of memory that supersedes this one")
  .option("--content <content>", "New markdown content (replaces body)")
  .action(
    async (
      memoryPath: string,
      opts: {
        title?: string;
        status?: string;
        confidence?: string;
        relevance?: string;
        supersedes?: string;
        supersededBy?: string;
        content?: string;
      },
    ) => {
      const { runUpdateCommand } = await import("../lib/updateCommand.js");
      await runUpdateCommand(getResolver, memoryPath, opts);
    },
  );

// ─── gnosys reinforce <memoryId> ────────────────────────────────────────
program
  .command("reinforce <memoryId>")
  .description("Signal whether a memory was useful, not relevant, or outdated")
  .requiredOption(
    "--signal <signal>",
    "Reinforcement signal (useful|not_relevant|outdated)"
  )
  .option("--context <context>", "Why this signal was given")
  .action(async (memoryId: string, opts: { signal: string; context?: string }) => {
    const { runReinforceCommand } = await import("../lib/reinforceCommand.js");
    await runReinforceCommand(getResolver, memoryId, opts);
  });

// ─── gnosys add-structured ──────────────────────────────────────────────
program
  .command("add-structured")
  .description("Add a memory with structured input (no LLM needed)")
  .requiredOption("--title <title>", "Memory title")
  .requiredOption("--category <category>", "Category directory name")
  .requiredOption("--content <content>", "Memory content as markdown")
  .option("--tags <json>", "Tags as JSON object", "{}")
  .option("--relevance <keywords>", "Keyword cloud for discovery search", "")
  .option("-a, --author <author>", "Author", "human")
  .option("--authority <authority>", "Authority level", "declared")
  .option("--confidence <n>", "Confidence 0-1", "0.8")
  .option("-s, --store <store>", "Target store", undefined)
  .option("--user", "Store as user-scoped memory (scope: user)")
  .option("--global", "Store as global-scoped memory (scope: global)")
  .action(
    async (opts: {
      title: string;
      category: string;
      content: string;
      tags: string;
      relevance: string;
      author: string;
      authority: string;
      confidence: string;
      store?: string;
      user?: boolean;
      global?: boolean;
    }) => {
      const { runAddStructuredCommand } = await import("../lib/addStructuredCommand.js");
      await runAddStructuredCommand(opts, resolveProjectId);
    }
  );

// ─── gnosys ingest <file> ─────────────────────────────────────────────────
program
  .command("ingest <fileOrGlob>")
  .description("Ingest a file (PDF, DOCX, TXT, MD) into Gnosys memory. Extracts text, splits into chunks, and creates atomic memories.")
  .option("--mode <mode>", "Ingestion mode: llm or structured", "llm")
  .option("-s, --store <store>", "Target store: project, personal, global")
  .option("-a, --author <author>", "Author", "human")
  .option("--authority <authority>", "Authority level", "imported")
  .option("--dry-run", "Preview what would be created without writing")
  .option("--list-attachments", "List all stored attachments")
  .option("-d, --directory <dir>", "Project directory")
  .action(async (fileOrGlob: string, opts: {
    mode: string;
    store?: string;
    author: string;
    authority: string;
    dryRun?: boolean;
    listAttachments?: boolean;
    directory?: string;
  }) => {
    const { runIngestCommand } = await import("../lib/ingestCommand.js");
    await runIngestCommand(getResolver, fileOrGlob, opts);
  });

// ─── gnosys attach <file> --memory <id> ──────────────────────────────────
program
  .command("attach <file>")
  .description("Attach a small binary file (logo, diagram, screenshot) inline to a memory. Travels machine-to-machine over normal sync. Limit ~10MB — use 'gnosys ingest' for large media.")
  .requiredOption("--memory <id>", "Memory ID to attach the file to")
  .action(async (file: string, opts: { memory: string }) => {
    const { runAttachCommand } = await import("../lib/attachCommand.js");
    await runAttachCommand(file, opts);
  });

// ─── gnosys get-attachment <id> ───────────────────────────────────────────
program
  .command("get-attachment <memoryId>")
  .description("Retrieve the binary attachment stored on a memory. Writes to --out, or prints base64 to stdout.")
  .option("--out <path>", "Write the attachment to this file path instead of printing base64")
  .action(async (memoryId: string, opts: { out?: string }) => {
    const { runGetAttachmentCommand } = await import("../lib/attachCommand.js");
    await runGetAttachmentCommand(memoryId, opts);
  });

// ─── gnosys tags-add ────────────────────────────────────────────────────
program
  .command("tags-add")
  .description("Add a new tag to the registry")
  .requiredOption("--category <category>", "Tag category (domain, type, concern, status_tag)")
  .requiredOption("--tag <tag>", "The new tag to add")
  .action(async (opts: { category: string; tag: string }) => {
    const { runTagsAddCommand } = await import("../lib/tagsAddCommand.js");
    await runTagsAddCommand(getResolver, opts);
  });

// ─── gnosys commit-context <context> ─────────────────────────────────────
program
  .command("commit-context <context>")
  .description("Pre-compaction sweep: extract atomic memories from a context string, check novelty, commit novel ones")
  .option("--dry-run", "Show what would be committed without writing")
  .option("-s, --store <store>", "Target store (project|personal|global)", undefined)
  .action(async (context: string, opts: { dryRun?: boolean; store?: string }) => {
    const { runCommitContextCommand } = await import("../lib/commitContextCommand.js");
    await runCommitContextCommand(getResolver, resolveProjectId, context, opts);
  });

// ─── gnosys lens ────────────────────────────────────────────────────────
program
  .command("lens")
  .description("Filtered view of memories. Combine criteria to focus on what matters.")
  .option("-c, --category <category>", "Filter by category")
  .option("-t, --tag <tags...>", "Filter by tag(s)")
  .option("--match <mode>", "Tag match mode: any (default) or all", "any")
  .option("--status <statuses...>", "Filter by status (active, archived, superseded)")
  .option("--author <authors...>", "Filter by author (human, ai, human+ai)")
  .option("--authority <authorities...>", "Filter by authority (declared, observed, imported, inferred)")
  .option("--min-confidence <n>", "Minimum confidence (0-1)")
  .option("--max-confidence <n>", "Maximum confidence (0-1)")
  .option("--created-after <date>", "Created after ISO date")
  .option("--created-before <date>", "Created before ISO date")
  .option("--modified-after <date>", "Modified after ISO date")
  .option("--modified-before <date>", "Modified before ISO date")
  .option("--or", "Combine filters with OR instead of AND (default: AND)")
  .option("--json", "Output as JSON")
  .action(async (opts: {
    category?: string;
    tag?: string[];
    match: string;
    status?: string[];
    author?: string[];
    authority?: string[];
    minConfidence?: string;
    maxConfidence?: string;
    createdAfter?: string;
    createdBefore?: string;
    modifiedAfter?: string;
    modifiedBefore?: string;
    or?: boolean;
    json?: boolean;
  }) => {
    const { runLensCommand } = await import("../lib/lensCommand.js");
    await runLensCommand(getResolver, opts);
  });
}
