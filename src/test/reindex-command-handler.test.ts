import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys reindex command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/reindexCommand.ts"),
    "utf-8",
  );

  it("wires reindex to runReindexCommand via dynamic import", () => {
    expect(cli).toContain('.command("reindex")');
    expect(cli).toContain(
      'const { runReindexCommand } = await import("./lib/reindexCommand.js")',
    );
    expect(cli).toContain("await runReindexCommand(getResolver)");
  });

  it("exports runReindexCommand with reindex markers", () => {
    expect(handler).toContain("export async function runReindexCommand");
    expect(handler).toContain("resolver.getStores()");
    expect(handler).toContain("No stores found. Run gnosys init first.");
    expect(handler).toContain("new GnosysSearch(storePath)");
    expect(handler).toContain("search.clearIndex()");
    expect(handler).toContain("search.addStoreMemories(s.store, s.label)");
    expect(handler).toContain("new GnosysEmbeddings(storePath)");
    expect(handler).toContain("new GnosysHybridSearch");
    expect(handler).toContain("hybridSearch.reindex");
    expect(handler).toContain("process.stdout.write");
    expect(handler).toContain("Reindex complete:");
    expect(handler).toContain("Hybrid and semantic search are now available.");
    expect(handler).toContain("finally");
    expect(handler).toContain("search?.close()");
    expect(handler).toContain("embeddings?.close()");
  });
});
