export function formatSearchStatus(memory: {
  status?: string;
  tier?: string;
  modified?: string;
  superseded_by?: string | null;
}): string {
  const status = memory.status === "active" && memory.tier === "archive"
    ? "archived"
    : memory.status || "active";
  const date = memory.modified?.slice(0, 10) || "unknown date";
  const replacement = memory.superseded_by ? `; superseded by ${memory.superseded_by}` : "";
  return `[${status}; ${date}${replacement}]`;
}

export interface SearchMemoryMetadata {
  status: string;
  tier: string;
  modified: string;
  superseded_by: string | null;
}

/** Linked replacements must enter the candidate set before the final limit. */
export function rankReplacements<T>({
  results, limit, key, replacement,
}: {
  results: T[];
  limit: number;
  key: (result: T) => string;
  replacement: (result: T) => T | null;
}): T[] {
  const candidates = new Map(results.map((result) => [key(result), result]));
  const visited = new Set<string>();
  const ranked: T[] = [];
  const visit = (result: T): void => {
    const id = key(result);
    if (visited.has(id)) return;
    visited.add(id);
    const next = replacement(result);
    if (next) visit(candidates.get(key(next)) ?? next);
    ranked.push(result);
  };
  for (const result of results) visit(result);
  return ranked.slice(0, limit);
}
