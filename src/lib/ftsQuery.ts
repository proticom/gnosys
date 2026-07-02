/**
 * FTS5 MATCH query construction — shared by the central-DB search (db.ts),
 * the per-store search index (search.ts), and archive search (archive.ts).
 *
 * FTS5 treats space-separated bare terms as implicit AND, so the long
 * descriptive queries the tool docs encourage ("auth JWT session tokens
 * refresh") return zero results unless EVERY term matches. Callers use
 * these helpers to try AND first (precision), then retry with OR
 * (recall) when AND finds nothing — BM25 still ranks the best-covered
 * memories first in the OR pass.
 *
 * Every term is emitted as a quoted phrase, which also makes previously
 * syntax-error-prone input (hyphens, colons, FTS5 keywords like NOT)
 * safe. A trailing `*` is preserved as an FTS5 prefix query (`"term"*`).
 */

/**
 * Split a raw query into sanitized terms. Drops quote characters and any
 * token with no letters or digits (pure punctuation can't match anything
 * under the unicode61 tokenizer).
 */
export function ftsTerms(query: string): string[] {
  return query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t));
}

/** Render one term as a safe FTS5 phrase, preserving trailing-`*` prefix queries. */
function ftsPhrase(term: string): string {
  const prefixMatch = term.match(/^(.*?)\*+$/);
  if (prefixMatch && /[\p{L}\p{N}]/u.test(prefixMatch[1])) {
    return `"${prefixMatch[1]}"*`;
  }
  return `"${term}"`;
}

/** Implicit-AND MATCH expression: all terms must match. */
export function ftsAndQuery(terms: string[]): string {
  return terms.map(ftsPhrase).join(" ");
}

/** OR MATCH expression: any term may match; BM25 ranks fuller matches higher. */
export function ftsOrQuery(terms: string[]): string {
  return terms.map(ftsPhrase).join(" OR ");
}
