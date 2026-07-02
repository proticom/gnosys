// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runGraphCommand } from "../lib/graphCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

function seedMemory(db: GnosysDB, id: string, content: string) {
  const now = new Date().toISOString();
  db.insertMemory({
    id,
    title: `Memory ${id}`,
    category: "decisions",
    content,
    summary: null,
    tags: '["test"]',
    relevance: `${id} graph invoke`,
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: `hash-${id}`,
    status: "active",
    tier: "active",
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: now,
    modified: now,
    embedding: null,
    source_path: null,
    source_file: null,
    source_page: null,
    source_timerange: null,
    project_id: null,
    scope: "user",
  });
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-graph-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
});
afterAll(() => {
  if (origHome === undefined) delete process.env.GNOSYS_HOME;
  else process.env.GNOSYS_HOME = origHome;
  if (origLocal === undefined) delete process.env.GNOSYS_LOCAL_ONLY;
  else process.env.GNOSYS_LOCAL_ONLY = origLocal;
  rmSync(base, { recursive: true, force: true });
});
beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
});
afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
  process.exitCode = undefined;
});

describe("runGraphCommand (in-process invoke)", () => {
  it("prints 'No memories found.' on an empty central DB", async () => {
    await runGraphCommand({});
    expect(logged()).toContain("No memories found.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("reports wikilinks between seeded memories (--json)", async () => {
    const db = GnosysDB.openLocal();
    seedMemory(db, "deci-201", "This links to [[deci-202]] explicitly.");
    seedMemory(db, "deci-202", "Target memory, no outgoing links.");
    db.close();

    await runGraphCommand({ json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.totalLinks).toBeGreaterThanOrEqual(1);
  });
});
