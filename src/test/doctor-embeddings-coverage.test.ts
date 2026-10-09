import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GnosysDB } from "../lib/db.js";
import { GnosysResolver } from "../lib/resolver.js";
import { makeMemory } from "./_helpers.js";

// Keep doctor's LLM connectivity probe off the network (a local Ollama would
// otherwise be contacted).
vi.mock("../lib/llm.js", () => ({
  isProviderAvailable: () => ({ available: false, error: "disabled in test" }),
  getLLMProvider: () => { throw new Error("LLM must not be constructed in this test"); },
}));

const vector = () => Buffer.from(new Float32Array([1, 0, 0]).buffer);

async function runDoctor(): Promise<string[]> {
  const { runDoctorCommand } = await import("../lib/doctorCommand.js");
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    await runDoctorCommand(async () => new GnosysResolver(), {});
    return log.mock.calls.map((args) => args.join(" "));
  } finally {
    log.mockRestore();
  }
}

describe("gnosys doctor reports embedding coverage from the central DB", () => {
  let home: string;
  let db: GnosysDB;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "gnosys-doctor-embeddings-"));
    vi.stubEnv("GNOSYS_HOME", home);
    vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
    db = new GnosysDB(home);
  });

  afterEach(() => {
    db.close();
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  it("prints M of N from memories.embedding and points to reindex when coverage is partial", async () => {
    db.insertMemory(makeMemory({ id: "emb-1", embedding: vector() }));
    db.insertMemory(makeMemory({ id: "emb-2", embedding: vector(), tier: "archive" }));
    db.insertMemory(makeMemory({ id: "emb-3" }));

    const lines = await runDoctor();

    expect(lines).toContain("  Embeddings: 2 of 3 memories (66.6%)");
    expect(lines).toContain("  ⚠ 1 memory lacks an embedding. Run gnosys reindex to backfill.");
  });

  it("prints 100.0% and no reindex hint when every memory is embedded", async () => {
    db.insertMemory(makeMemory({ id: "full-1", embedding: vector() }));
    db.insertMemory(makeMemory({ id: "full-2", embedding: vector() }));

    const lines = await runDoctor();

    expect(lines).toContain("  Embeddings: 2 of 2 memories (100.0%)");
    expect(lines.filter((line) => line.includes("lack"))).toEqual([]);
  });
});
