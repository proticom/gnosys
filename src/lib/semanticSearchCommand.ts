import { EMBEDDING_FALLBACK_NOTE } from "./embeddingHealth.js";
import { GnosysSearch } from "./search.js";
import type { GnosysResolver } from "./resolver.js";

export type SemanticSearchCommandOptions = {
  limit: string;
  json?: boolean;
};

type GetResolver = () => Promise<GnosysResolver>;

function outputResult(json: boolean, data: unknown, humanFn: () => void): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    humanFn();
  }
}

export async function runSemanticSearchCommand(
  getResolver: GetResolver,
  query: string,
  opts: SemanticSearchCommandOptions,
): Promise<void> {
      const resolver = await getResolver();
      const stores = resolver.getStores();
      if (stores.length === 0) {
        console.error("No stores found.");
        process.exit(1);
      }
  
      const storePath = stores[0].path;
      const search = new GnosysSearch(storePath);
      search.clearIndex();
      for (const s of stores) {
        await search.addStoreMemories(s.store, s.label);
      }
  
      const { GnosysEmbeddings } = await import("./embeddings.js");
      const { GnosysHybridSearch } = await import("./hybridSearch.js");
      const embeddings = new GnosysEmbeddings(storePath);
      const { resolveClientRead } = await import("./clientReadResolve.js");
      const central = resolveClientRead();
      const hybridSearch = new GnosysHybridSearch(search, embeddings, resolver, storePath, central?.db);
  
      try {
        const outcome = await hybridSearch.searchWithStatus(query, parseInt(opts.limit, 10), "semantic");
        const results = outcome.results;
        const note = outcome.kind === "keyword-fallback" ? outcome.note : undefined;
        const resultNote = note ? EMBEDDING_FALLBACK_NOTE : undefined;
        const mode = outcome.kind === "keyword-fallback" ? "keyword" : "semantic";
        if (note) console.error(note);
  
        outputResult(
          !!opts.json,
          {
            query,
            mode,
            requestedMode: "semantic",
            note: resultNote,
            count: results.length,
            results: results.map((r) => ({
              title: r.title,
              relativePath: r.relativePath,
              score: r.score,
              snippet: r.snippet,
            })),
          },
          () => {
            if (results.length === 0) {
              console.log(`No ${mode} results for "${query}". Run gnosys reindex first.`);
              return;
            }
  
            console.log(`Found ${results.length} ${mode} results for "${query}":\n`);
            for (const r of results) {
              console.log(`  ${r.title}`);
              console.log(`    Path: ${r.relativePath}`);
              console.log(`    Score: ${r.score.toFixed(4)}`);
              console.log(`    ${r.snippet.substring(0, 120)}...\n`);
            }
          },
        );
      } finally {
        search.close();
        embeddings.close();
        central?.release();
      }
}
