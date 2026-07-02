import { GnosysSearch } from "./search.js";
import type { GnosysResolver } from "./resolver.js";
import type { GnosysEmbeddings } from "./embeddings.js";

type GetResolver = () => Promise<GnosysResolver>;

export async function runReindexCommand(
  getResolver: GetResolver,
): Promise<void> {
  let search: GnosysSearch | undefined;
  let embeddings: GnosysEmbeddings | undefined;

  try {
    const resolver = await getResolver();
    const stores = resolver.getStores();
    if (stores.length === 0) {
      console.error("No stores found. Run gnosys init first.");
      process.exitCode = 1;
      return;
    }

    const storePath = stores[0].path;
    search = new GnosysSearch(storePath);
    search.clearIndex();
    for (const s of stores) {
      await search.addStoreMemories(s.store, s.label);
    }

    const { GnosysEmbeddings } = await import("./embeddings.js");
    const { GnosysHybridSearch } = await import("./hybridSearch.js");
    embeddings = new GnosysEmbeddings(storePath);
    const hybridSearch = new GnosysHybridSearch(search, embeddings, resolver, storePath);

    console.log("Building semantic embeddings (downloading model on first run)...");
    const count = await hybridSearch.reindex((current, total, filePath) => {
      process.stdout.write(`\r  Indexing: ${current}/${total} — ${filePath.substring(0, 60)}`);
    });

    // v5.13.0: also (re)build the central-DB embedding column — the vectors
    // DB-mode hybrid/semantic search actually reads. Own handle: the
    // resolver-based hybridSearch above only covers file stores.
    let dbEmbedded = 0;
    let dbTotal = 0;
    const { GnosysDB } = await import("./db.js");
    const centralDb = GnosysDB.openCentral();
    try {
      if (centralDb.isAvailable() && centralDb.isMigrated()) {
        const { backfillCentralDbEmbeddings } = await import("./embedDb.js");
        const result = await backfillCentralDbEmbeddings(centralDb, embeddings, {
          mode: "all",
          onProgress: (current, total, id) => {
            process.stdout.write(`\r  Central DB: ${current}/${total} — ${id.substring(0, 40)}          `);
          },
        });
        dbEmbedded = result.embedded;
        dbTotal = result.total;
      }
    } finally {
      centralDb.close();
    }

    console.log(`\n\nReindex complete: ${count} memories embedded.`);
    if (dbTotal > 0) {
      console.log(`Central DB: ${dbEmbedded}/${dbTotal} memories embedded.`);
    }
    console.log("Hybrid and semantic search are now available.");
  } finally {
    search?.close();
    embeddings?.close();
  }
}
