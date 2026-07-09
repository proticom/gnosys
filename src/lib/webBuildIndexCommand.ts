import path from "path";
import type { GnosysConfig } from "./config.js";
import type { GetWebStorePath } from "./webInitCommand.js";
import type { VectorProvider, WebVectorsFile } from "./webVectors.js";

export type WebBuildIndexCommandOptions = {
  input?: string;
  output?: string;
  stopWords: boolean;
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

export async function runWebBuildIndexCommand(
  getWebStorePath: GetWebStorePath,
  opts: WebBuildIndexCommandOptions,
): Promise<void> {
  try {
    const { loadConfig } = await import("./config.js");
    const { attachExpansions, buildIndex, generateExpansions, writeIndex } = await import("./webIndex.js");

    const storePath = await getWebStorePath();
    const gnosysConfig = await loadConfig(storePath);
    const knowledgeDir = opts.input || gnosysConfig.web?.outputDir || "./knowledge";
    const outputPath = opts.output || path.join(knowledgeDir, "gnosys-index.json");
    const embeddingProvider = parseVectorProvider(opts.embeddings);

    let index = await buildIndex(knowledgeDir, {
      stopWords: opts.stopWords,
    });
    if (opts.expansions !== false) {
      const llmProvider = await resolveExpansionProvider(gnosysConfig);
      if (llmProvider) {
        const expansions = await generateExpansions(index, llmProvider);
        index = attachExpansions(index, expansions);
      }
    }

    await writeIndex(index, outputPath);

    const vectors = embeddingProvider
      ? await buildCommandVectors(knowledgeDir, storePath, embeddingProvider, opts.embedModel)
      : undefined;

    if (opts.json) {
      console.log(JSON.stringify({
        ok: true,
        documentCount: index.documentCount,
        tokenCount: Object.keys(index.invertedIndex).length,
        outputPath,
        ...(vectors ? { vectors } : {}),
      }));
    } else {
      console.log(`Search index built:`);
      console.log(`  Documents: ${index.documentCount}`);
      console.log(`  Tokens:    ${Object.keys(index.invertedIndex).length}`);
      console.log(`  Output:    ${outputPath}`);
      if (vectors) {
        console.log(`  Vectors:   ${vectors.count} docs, ${vectors.model} (${vectors.dims}d)`);
        console.log(`  Vector output: ${vectors.outputPath}`);
      }
    }
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(`Build index failed: ${err instanceof Error ? err.message : err}`);
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
