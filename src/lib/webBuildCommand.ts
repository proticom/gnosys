import path from "path";
import type { GnosysConfig } from "./config.js";
import type { GetWebStorePath } from "./webInitCommand.js";
import type { VectorProvider, WebVectorsFile } from "./webVectors.js";

export type WebBuildCommandOptions = {
  source?: string;
  prune?: boolean;
  llm: boolean;
  concurrency: string;
  dryRun?: boolean;
  embeddings?: string;
  embedModel?: string;
  expansions?: boolean;
  json?: boolean;
};

type VectorsStats = {
  model: string;
  dims: number;
  count: number;
  outputPath: string;
};

const VECTOR_PROVIDERS = new Set(["openai", "voyage", "local"]);

export async function runWebBuildCommand(
  getWebStorePath: GetWebStorePath,
  opts: WebBuildCommandOptions,
): Promise<void> {
  try {
    const { loadConfig } = await import("./config.js");
    const { ingestSite } = await import("./webIngest.js");
    const { attachExpansions, buildIndex, generateExpansions, writeIndex } = await import("./webIndex.js");

    const storePath = await getWebStorePath();
    const gnosysConfig = await loadConfig(storePath);
    const webConfig = gnosysConfig.web;
    if (!webConfig) {
      throw new Error("No web configuration found in gnosys.json. Run 'gnosys web init' first.");
    }
    const embeddingProvider = parseVectorProvider(opts.embeddings);
    const llmEnrich = opts.llm ? webConfig.llmEnrich : false;

    // Step 1: Ingest
    const ingestResult = await ingestSite({
      source: webConfig.source,
      sitemapUrl: opts.source || webConfig.sitemapUrl,
      contentDir: opts.source || webConfig.contentDir,
      urls: webConfig.urls,
      outputDir: webConfig.outputDir,
      exclude: webConfig.exclude,
      categories: webConfig.categories,
      llmEnrich,
      prune: opts.prune || webConfig.prune,
      concurrency: parseInt(opts.concurrency, 10) || webConfig.concurrency,
      crawlDelayMs: webConfig.crawlDelayMs,
      dryRun: opts.dryRun,
    }, gnosysConfig);

    // Step 2: Build index (skip if dry run)
    let indexStats = { documentCount: 0, tokenCount: 0 };
    let vectorsStats: VectorsStats | undefined;
    if (!opts.dryRun) {
      let index = await buildIndex(webConfig.outputDir);
      if (opts.expansions !== false && llmEnrich !== false) {
        const llmProvider = await resolveExpansionProvider(gnosysConfig);
        if (llmProvider) {
          const expansions = await generateExpansions(index, llmProvider);
          index = attachExpansions(index, expansions);
        }
      }
      const indexPath = path.join(webConfig.outputDir, "gnosys-index.json");
      await writeIndex(index, indexPath);
      indexStats = {
        documentCount: index.documentCount,
        tokenCount: Object.keys(index.invertedIndex).length,
      };
      if (embeddingProvider) {
        vectorsStats = await buildCommandVectors(
          webConfig.outputDir,
          storePath,
          embeddingProvider,
          opts.embedModel,
        );
      }
    }

    if (opts.json) {
      console.log(JSON.stringify({
        ...ingestResult,
        index: indexStats,
        ...(vectorsStats ? { vectors: vectorsStats } : {}),
      }));
    } else {
      console.log(`Web build complete (${ingestResult.duration}ms):`);
      console.log(`  Added:     ${ingestResult.added.length}`);
      console.log(`  Updated:   ${ingestResult.updated.length}`);
      console.log(`  Unchanged: ${ingestResult.unchanged.length}`);
      console.log(`  Removed:   ${ingestResult.removed.length}`);
      console.log(`  Index:     ${indexStats.documentCount} docs, ${indexStats.tokenCount} tokens`);
      if (vectorsStats) {
        console.log(`  Vectors:   ${vectorsStats.count} docs, ${vectorsStats.model} (${vectorsStats.dims}d)`);
        console.log(`  Vector output: ${vectorsStats.outputPath}`);
      }
      if (ingestResult.errors.length > 0) {
        console.log(`  Errors:    ${ingestResult.errors.length}`);
        for (const e of ingestResult.errors) {
          console.log(`    ${e.url}: ${e.error}`);
        }
      }
    }
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(`Web build failed: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }
}

function parseVectorProvider(provider: string | undefined): VectorProvider | undefined {
  if (!provider) return undefined;
  const normalized = provider.trim().toLowerCase();
  if (!VECTOR_PROVIDERS.has(normalized)) {
    throw new Error(`Invalid embeddings provider "${provider}". Valid providers: openai, voyage, local.`);
  }
  return normalized as VectorProvider;
}

async function resolveExpansionProvider(gnosysConfig: GnosysConfig) {
  try {
    const { getLLMProvider } = await import("./llm.js");
    return getLLMProvider(gnosysConfig, "structuring");
  } catch {
    return null;
  }
}

async function buildCommandVectors(
  knowledgeDir: string,
  storePath: string,
  provider: VectorProvider,
  model?: string,
): Promise<VectorsStats> {
  const { buildVectors, writeVectorsFile } = await import("./webVectors.js");
  const vectorsFile: WebVectorsFile = await buildVectors(knowledgeDir, {
    provider,
    model,
    storePath,
  });
  const outputPath = await writeVectorsFile(knowledgeDir, vectorsFile);
  return {
    model: vectorsFile.model,
    dims: vectorsFile.dims,
    count: Object.keys(vectorsFile.vectors).length,
    outputPath,
  };
}
