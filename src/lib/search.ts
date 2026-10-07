/**
 * Gnosys Search — SQLite FTS5 keyword index for fast text search.
 * FTS5-based search and discovery across all Gnosys stores.
 */

// Dynamic import — gracefully handles missing native module (dlopen failures)
let Database: any = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // better-sqlite3 native module not available — search degrades gracefully
}
import path from "path";
import type { GnosysStore } from "./store.js";
import { ftsTerms, ftsAndQuery, ftsOrQuery } from "./ftsQuery.js";
import { rankReplacements, type SearchMemoryMetadata } from "./searchStatus.js";

export interface SearchResult extends Partial<SearchMemoryMetadata> {
  relative_path: string;
  memoryId?: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface DiscoverResult extends Partial<SearchMemoryMetadata> {
  relative_path: string;
  memoryId?: string;
  title: string;
  relevance: string;
  rank: number;
}

export class GnosysSearch {
  private db: any = null;

  constructor(storePath: string) {
    if (!Database) {
      // Native module not available — search features disabled
      return;
    }
    // Try file-based DB first, fall back to in-memory.
    // We must verify writes actually work — some filesystems (e.g., mounted
    // volumes in sandboxed environments) allow file creation but block the
    // journal/WAL delete operations that SQLite requires.
    try {
      const dbPath = path.join(storePath, ".config", "search.db");
      this.db = new Database(dbPath);
      this.db.pragma("busy_timeout = 5000");
      this.initSchema();
      // Smoke-test: insert + delete to confirm journal ops work
      this.db.exec(
        "CREATE TABLE IF NOT EXISTS _write_test (v INTEGER); INSERT INTO _write_test VALUES (1); DELETE FROM _write_test; DROP TABLE _write_test;"
      );
    } catch {
      // Fallback to in-memory (works everywhere, rebuilt on each start)
      try { this.db?.close(); } catch { /* ignore */ }
      this.db = new Database(":memory:");
      this.initSchema();
    }
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_metadata (
        relative_path TEXT PRIMARY KEY, id TEXT, status TEXT, tier TEXT, modified TEXT, superseded_by TEXT
      );
      CREATE INDEX IF NOT EXISTS search_metadata_id ON search_metadata(id);
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        relative_path,
        title,
        category,
        tags,
        relevance,
        content,
        tokenize='porter unicode61'
      );
    `);
  }

  /**
   * Clear the entire search index.
   */
  clearIndex(): void {
    if (!this.db) return;
    this.db.exec("DELETE FROM memories_fts; DELETE FROM search_metadata");
  }

  /**
   * Rebuild the entire search index from a single store.
   * Clears all existing entries first.
   */
  async reindex(store: GnosysStore): Promise<number> {
    this.clearIndex();
    return this.addStoreMemories(store);
  }

  /**
   * Add memories from a store to the index WITHOUT clearing existing entries.
   * Used for multi-store indexing: clear once, then addStoreMemories for each store.
   * Optional storeLabel prefix is prepended to relative_path for disambiguation.
   */
  async addStoreMemories(store: GnosysStore, storeLabel?: string): Promise<number> {
    if (!this.db) return 0;
    const memories = await store.getAllMemories();

    const deletePath = this.db.prepare("DELETE FROM memories_fts WHERE relative_path = ?");
    const insert = this.db.prepare(
      "INSERT INTO memories_fts (relative_path, title, category, tags, relevance, content) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const tx = this.db.transaction(() => {
      for (const m of memories) {
        const tags = Array.isArray(m.frontmatter.tags)
          ? m.frontmatter.tags.join(" ")
          : Object.values(m.frontmatter.tags).flat().join(" ");

        const relevance = (m.frontmatter.relevance as string) || "";

        const indexPath = storeLabel
          ? `${storeLabel}:${m.relativePath}`
          : m.relativePath;

        this.indexMetadata(indexPath, m.frontmatter.id, {
          status: m.frontmatter.status,
          tier: m.frontmatter.status === "archived" ? "archive" : "active",
          modified: m.frontmatter.modified, superseded_by: m.frontmatter.superseded_by ?? null,
        });
        deletePath.run(indexPath);
        insert.run(
          indexPath,
          m.frontmatter.title,
          m.frontmatter.category,
          tags,
          relevance,
          m.content
        );
      }
    });

    tx();
    return memories.length;
  }

  /**
   * Add memories from DB rows to the index WITHOUT clearing existing entries.
   * DB-first alternative to addStoreMemories — no markdown reads required.
   */
  addDbMemories(memories: Array<{ id: string; title: string; category: string; tags: string; relevance: string | null; content: string } & Partial<SearchMemoryMetadata>>, storeLabel?: string): number {
    if (!this.db) return 0;

    const deletePath = this.db.prepare("DELETE FROM memories_fts WHERE relative_path = ?");
    const insert = this.db.prepare(
      "INSERT INTO memories_fts (relative_path, title, category, tags, relevance, content) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const tx = this.db.transaction(() => {
      for (const m of memories) {
        // Parse tags — could be JSON array or JSON object
        let tagsStr = m.tags || "";
        try {
          const parsed = JSON.parse(tagsStr);
          if (Array.isArray(parsed)) {
            tagsStr = parsed.join(" ");
          } else if (typeof parsed === "object") {
            tagsStr = Object.values(parsed).flat().join(" ");
          }
        } catch {
          // Already a plain string
        }

        const indexPath = storeLabel
          ? `${storeLabel}:${m.category}/${m.id}.md`
          : `${m.category}/${m.id}.md`;

        this.indexMetadata(indexPath, m.id, {
          status: m.status ?? "active", tier: m.tier ?? "active",
          modified: m.modified ?? "", superseded_by: m.superseded_by ?? null,
        });
        deletePath.run(indexPath);
        insert.run(
          indexPath,
          m.title,
          m.category,
          tagsStr,
          m.relevance || "",
          m.content
        );
      }
    });

    tx();
    return memories.length;
  }

  getMemoryPath(id: string): string | null {
    const row = this.db?.prepare("SELECT relative_path FROM search_metadata WHERE id = ? LIMIT 1").get(id) as { relative_path: string } | undefined;
    return row?.relative_path ?? null;
  }

  private indexMetadata(relativePath: string, id: string, metadata: SearchMemoryMetadata): void {
    this.db.prepare("INSERT OR REPLACE INTO search_metadata VALUES (?, ?, ?, ?, ?, ?)")
      .run(relativePath, id, metadata.status, metadata.tier, metadata.modified, metadata.superseded_by);
  }

  private rankResults<T extends SearchResult | DiscoverResult>(results: T[], limit: number, activeOnly: boolean): T[] {
    if (activeOnly) return results.slice(0, limit);
    return rankReplacements({
      results, limit, key: (result) => result.relative_path,
      replacement: (result) => {
        if (!result.superseded_by) return null;
        const next = this.db.prepare(`
          SELECT f.relative_path, m.id AS memoryId, f.title, f.relevance, substr(f.content, 1, 200) AS snippet,
                 m.status, m.tier, m.modified, m.superseded_by
          FROM memories_fts f JOIN search_metadata m ON m.relative_path = f.relative_path
          WHERE m.id = ? LIMIT 1
        `).get(result.superseded_by);
        return next ? { ...result, ...next } : null;
      },
    });
  }

  /**
   * Search memories by keyword query.
   */
  search(query: string, limit: number = 20, activeOnly: boolean = false): SearchResult[] {
    if (!this.db) return [];
    const candidateLimit = limit * 2;
    const statusFilter = activeOnly ? "AND COALESCE(m.status, 'active') = 'active' AND m.tier = 'active' AND NULLIF(m.superseded_by, '') IS NULL" : "";
    const terms = ftsTerms(query);
    if (terms.length === 0) return [];

    const stmt = this.db.prepare(`
      SELECT
        memories_fts.relative_path,
        title,
        snippet(memories_fts, 5, '>>>', '<<<', '...', 40) as snippet,
        rank, m.id AS memoryId, m.status, m.tier, m.modified, m.superseded_by
      FROM memories_fts
      LEFT JOIN search_metadata m ON m.relative_path = memories_fts.relative_path
      WHERE memories_fts MATCH ? ${statusFilter}
      ORDER BY rank
      LIMIT ?
    `);

    try {
      // v5.12.3: AND first (precision), OR retry when AND finds nothing —
      // multi-word queries previously required every term to match.
      const results = stmt.all(ftsAndQuery(terms), candidateLimit) as SearchResult[];
      if (results.length > 0 || terms.length === 1) return this.rankResults(results, limit, activeOnly);
      return this.rankResults(stmt.all(ftsOrQuery(terms), candidateLimit) as SearchResult[], limit, activeOnly);
    } catch {
      // If FTS5 query fails, fall back to simple LIKE search
      const likeStmt = this.db.prepare(`
        SELECT
          memories_fts.relative_path,
          title,
          substr(content, 1, 200) as snippet,
          0 as rank, m.id AS memoryId, m.status, m.tier, m.modified, m.superseded_by
        FROM memories_fts
        LEFT JOIN search_metadata m ON m.relative_path = memories_fts.relative_path
        WHERE (content LIKE ? OR title LIKE ? OR tags LIKE ?) ${statusFilter}
        LIMIT ?
      `);
      const pattern = `%${terms.join(" ")}%`;
      return this.rankResults(likeStmt.all(pattern, pattern, pattern, candidateLimit) as SearchResult[], limit, activeOnly);
    }
  }

  /**
   * Discover memories by searching relevance keyword clouds.
   * Returns lightweight metadata only — no file contents.
   * This is the primary discovery mechanism replacing the static manifest.
   */
  discover(query: string, limit: number = 20, activeOnly: boolean = false, options: { excludeSuperseded?: boolean } = {}): DiscoverResult[] {
    if (!this.db) return [];
    const candidateLimit = limit * 2;
    const statusFilter = activeOnly
      ? "AND COALESCE(m.status, 'active') = 'active' AND m.tier = 'active' AND NULLIF(m.superseded_by, '') IS NULL"
      : options.excludeSuperseded ? "AND COALESCE(m.status, 'active') <> 'superseded' AND NULLIF(m.superseded_by, '') IS NULL" : "";
    const terms = ftsTerms(query);
    if (terms.length === 0) return [];

    // Search primarily on relevance + title + tags (not content body)
    // FTS5 column filter: {relevance title tags}
    const stmt = this.db.prepare(`
      SELECT
        memories_fts.relative_path,
        title,
        relevance,
        rank, m.id AS memoryId, m.status, m.tier, m.modified, m.superseded_by
      FROM memories_fts
      LEFT JOIN search_metadata m ON m.relative_path = memories_fts.relative_path
      WHERE memories_fts MATCH ? ${statusFilter}
      ORDER BY ${options.excludeSuperseded ? "(m.tier = 'archive' OR COALESCE(m.status, 'active') = 'archived'), " : ""}rank
      LIMIT ?
    `);

    const tryRun = (match: string): DiscoverResult[] => {
      try {
        return this.rankResults(stmt.all(match, candidateLimit) as DiscoverResult[], limit, activeOnly || !!options.excludeSuperseded);
      } catch {
        return [];
      }
    };

    // v5.12.3: precision-to-recall ladder. AND on the metadata columns,
    // AND anywhere, then OR retries — multi-word queries previously
    // required every term to match, so long queries returned nothing.
    // Parens scope the column filter to the whole expression (a bare
    // `{cols} : a b` only filtered the first term).
    const colScoped = (expr: string) => `{relevance title tags} : (${expr})`;
    const andExpr = ftsAndQuery(terms);

    let results = tryRun(colScoped(andExpr));
    if (results.length > 0) return results;

    results = tryRun(andExpr);
    if (results.length > 0 || terms.length === 1) return results;

    const orExpr = ftsOrQuery(terms);
    results = tryRun(colScoped(orExpr));
    if (results.length > 0) return results;

    return tryRun(orExpr);
  }

  close(): void {
    this.db?.close();
  }
}
