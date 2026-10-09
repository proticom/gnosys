import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GnosysDB } from "../lib/db.js";
import { GnosysResolver } from "../lib/resolver.js";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { collectDashboardData, formatDashboard, formatDashboardJSON } from "../lib/dashboard.js";
import { makeMemory } from "./_helpers.js";

// Keep the provider probe off the network (a local Ollama would otherwise be contacted).
vi.mock("../lib/llm.js", () => ({
  isProviderAvailable: () => ({ available: false, error: "disabled in test" }),
}));

const vector = () => Buffer.from(new Float32Array([1, 0, 0]).buffer);

describe("dashboard reports embedding coverage from the central DB", () => {
  let home: string;
  let db: GnosysDB;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "gnosys-dashboard-embeddings-"));
    vi.stubEnv("GNOSYS_HOME", home);
    vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
    db = new GnosysDB(home);
  });

  afterEach(() => {
    db.close();
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  const collect = () => collectDashboardData(new GnosysResolver(), DEFAULT_CONFIG, "test", db);

  it("counts M of N over all rows in memories.embedding", async () => {
    db.insertMemory(makeMemory({ id: "emb-1", embedding: vector() }));
    db.insertMemory(makeMemory({ id: "emb-2", embedding: vector() }));
    db.insertMemory(makeMemory({ id: "emb-3", embedding: vector(), tier: "archive" }));
    db.insertMemory(makeMemory({ id: "bare-1" }));
    db.insertMemory(makeMemory({ id: "bare-2" }));

    const data = await collect();

    expect(data.embeddings).toEqual({ embedded: 3, total: 5 });
    expect(JSON.parse(formatDashboardJSON(data)).embeddings).toEqual({ embedded: 3, total: 5 });
    const text = formatDashboard(data);
    expect(text).toContain("  3 of 5 memories embedded (60.0%)");
    expect(text).toContain("  ⚠ 2 missing. Run gnosys reindex to backfill.");
  });

  it("shows full coverage without a reindex hint", async () => {
    db.insertMemory(makeMemory({ id: "full-1", embedding: vector() }));
    db.insertMemory(makeMemory({ id: "full-2", embedding: vector() }));

    const data = await collect();

    expect(data.embeddings).toEqual({ embedded: 2, total: 2 });
    const text = formatDashboard(data);
    expect(text).toContain("  2 of 2 memories embedded (100.0%)");
    expect(text).not.toContain("missing. Run gnosys reindex");
  });
});
