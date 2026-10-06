/**
 * Regression tests for the v5.12.3 silent hybrid-degrade bug.
 *
 * Embeddings are only built by gnosys_reindex; until then hybrid search
 * silently downgraded to keyword-only and semantic search returned a
 * generic "no results" — users had no signal that semantic recall was
 * off. The fix surfaces a loud warning in the MCP tool output and on
 * stderr for the CLI (stdout stays clean for --json / MCP serve mode).
 *
 * Wiring-marker style follows hybrid-search-command-handler.test.ts.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("hybrid search degrade warnings (v5.12.3)", () => {
  const index = readFileSync(join(process.cwd(), "src/index.ts"), "utf-8");
  const handler = readFileSync(
    join(process.cwd(), "src/lib/hybridSearchCommand.ts"),
    "utf-8",
  );

  it("gnosys_semantic_search announces keyword fallback", () => {
    expect(index).toContain(
      "Falls back to keyword search with an explicit note when embeddings are unavailable",
    );
  });

  it("CLI hybrid-search warns on stderr (stdout stays clean for --json)", () => {
    expect(handler).toContain(
      `if (note) console.error(note);`,
    );
    expect(handler).toContain("console.error(");
    expect(handler).toContain('outcome.kind === "keyword-fallback"');
    expect(handler).toContain("outcome.note");
  });

  // v5.13.0: assertion updated alongside the gate redesign — in DB mode the
  // semantic leg is now gated on stored central-DB vectors alone (the query
  // embedder loads the local model on demand), so canRunSemantic mirrors
  // the new embedQuery gate instead of ANDing the store-local embeddings.db.
  it("canRunSemantic mirrors the DB-mode embedQuery gate (central-DB vectors)", () => {
    const hybrid = readFileSync(
      join(process.cwd(), "src/lib/hybridSearch.ts"),
      "utf-8",
    );
    expect(hybrid).toContain("canRunSemantic(): boolean {");
    expect(hybrid).toContain("return this.dbSearch.hasEmbeddings();");
    // hybridSearch() itself must use the same predicate for embedQuery
    expect(hybrid).toContain(
      "const embedQuery = this.dbSearch.hasEmbeddings()",
    );
  });
});
