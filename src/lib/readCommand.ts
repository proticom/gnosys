import fs from "fs/promises";
import type { GnosysResolver } from "./resolver.js";

export type ReadCommandOptions = {
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

export async function runReadCommand(
  getResolver: GetResolver,
  memoryPath: string,
  opts: ReadCommandOptions,
): Promise<void> {
  // v13 client read path: master/snapshot routing + pending-offline-adds overlay,
  // so `gnosys read <id>` sees the same memories as list/discover/search.
  const { resolveClientRead, getMemoryWithOverlay } = await import("./clientReadResolve.js");
  const resolved = resolveClientRead();
  if (resolved) {
    try {
      const dbMem = getMemoryWithOverlay(resolved, memoryPath);
      if (dbMem) {
        const tags = dbMem.tags || "[]";
        const headerLines = [
          `---`,
          `id: ${dbMem.id}`,
          `title: '${dbMem.title}'`,
          `category: ${dbMem.category}`,
          `tags: ${tags}`,
          `relevance: ${dbMem.relevance}`,
          `author: ${dbMem.author}`,
          `authority: ${dbMem.authority}`,
          `confidence: ${dbMem.confidence}`,
          `status: ${dbMem.status}`,
          `tier: ${dbMem.tier}`,
          `created: '${dbMem.created}'`,
          `modified: '${dbMem.modified}'`,
        ];
        if (dbMem.source_file) {
          headerLines.push(
            `source_file: ${dbMem.source_file}${dbMem.source_page != null ? ` (page ${Number(dbMem.source_page)})` : ""}`,
          );
        }
        if (dbMem.source_path) headerLines.push(`source_path: ${dbMem.source_path}`);
        headerLines.push(`---`);
        const raw = `[Source: gnosys.db]\n\n${headerLines.join("\n")}\n\n${dbMem.content}`;
        outputResult(!!opts.json, { path: memoryPath, source: "gnosys.db", content: raw, memory: dbMem }, () => {
          console.log(raw);
        });
        return;
      }
    } finally {
      resolved.release();
    }
  }

  const resolver = await getResolver();
  const memory = await resolver.readMemory(memoryPath);
  if (!memory) {
    console.error(`Memory not found: ${memoryPath}`);
    process.exit(1);
  }
  const raw = await fs.readFile(memory.filePath, "utf-8");
  outputResult(!!opts.json, { path: memoryPath, source: memory.sourceLabel, content: raw }, () => {
    console.log(`[Source: ${memory.sourceLabel}]\n`);
    console.log(raw);
  });
}
