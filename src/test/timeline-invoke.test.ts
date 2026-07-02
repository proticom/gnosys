// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runTimelineCommand } from "../lib/timelineCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-timeline-invoke-"));
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

describe("runTimelineCommand (in-process invoke)", () => {
  it("prints 'No memories found.' on an empty central DB", async () => {
    await runTimelineCommand({ period: "month", limitTitles: "5" });
    expect(logged()).toContain("No memories found.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("groups seeded memories by period (--json)", async () => {
    const db = GnosysDB.openLocal();
    const now = new Date().toISOString();
    db.insertMemory({
      id: "deci-401",
      title: "Timeline invoke fixture",
      category: "decisions",
      content: "Timeline content",
      summary: null,
      tags: '["test"]',
      relevance: "timeline invoke",
      author: "ai",
      authority: "imported",
      confidence: 0.8,
      reinforcement_count: 0,
      content_hash: "hash-deci-401",
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
    db.close();

    await runTimelineCommand({ period: "month", limitTitles: "5", json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(1);
    expect(parsed.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the human timeline header for seeded memories", async () => {
    await runTimelineCommand({ period: "month", limitTitles: "5" });
    expect(logged()).toContain("Knowledge Timeline (by month, 1 memories):");
  });
});
