import type { HybridSearchResult } from "./searchTypes.js";
import { formatSearchStatus } from "./searchStatus.js";
import { EMBEDDING_FALLBACK_NOTE } from "./embeddingHealth.js";

type SearchPresentation =
  | { kind: "hybrid"; embeddingCount: number }
  | { kind: "semantic" }
  | { kind: "keyword-fallback"; requested: "hybrid" | "semantic" };

export function formatMcpSearchResults({ query, results, search }: {
  query: string;
  results: HybridSearchResult[];
  search: SearchPresentation;
}): string {
  const warning = search.kind === "keyword-fallback"
    ? `${EMBEDDING_FALLBACK_NOTE}\n\n`
    : "";
  const semantic = search.kind === "semantic" || (search.kind === "keyword-fallback" && search.requested === "semantic");
  const resultKind = semantic ? `${search.kind === "keyword-fallback" ? "keyword" : "semantic"} results` : "results";
  if (results.length === 0) {
    return `${warning}No ${resultKind} for "${query}". ${semantic ? "Try a broader query." : "Try different keywords."}`;
  }
  const indexed = search.kind === "hybrid" ? ` (${search.embeddingCount} embeddings indexed)` : "";
  const formatted = results.map((result) => {
    const status = result.modified !== undefined || result.status !== undefined || result.tier !== undefined || result.superseded_by !== undefined
      ? ` ${formatSearchStatus(result)}` : "";
    return `**${result.title}** (score: ${result.score.toFixed(4)}, via: ${result.sources.join("+")})${status}\n  Path: ${result.relativePath}\n  ${result.snippet.substring(0, 150)}...`;
  }).join("\n\n");
  return `${warning}Found ${results.length} ${resultKind} for "${query}"${indexed}:\n\n${formatted}`;
}
