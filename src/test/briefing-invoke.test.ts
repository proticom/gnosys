// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { runBriefingCommand } from "../lib/briefingCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-briefing-invoke-"));
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
});
afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  process.exitCode = undefined;
});

describe("runBriefingCommand (in-process invoke)", () => {
  it("prints 'No projects registered.' with --all on an empty DB", async () => {
    await runBriefingCommand(undefined, { all: true, json: false });
    expect(logged()).toContain("No projects registered.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("emits { count: 0 } JSON with --all --json on an empty DB", async () => {
    await runBriefingCommand(undefined, { all: true, json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(0);
    expect(parsed.briefings).toEqual([]);
  });

  it("includes a registered project's briefing in --all output", async () => {
    const db = GnosysDB.openLocal();
    const now = new Date().toISOString();
    db.insertProject({
      id: "11111111-1111-4111-8111-111111111111",
      name: "briefing-test-project",
      working_directory: join(base, "proj"),
      root_id: null,
      rel_path: null,
      user: "tester",
      agent_rules_target: null,
      obsidian_vault: null,
      created: now,
      modified: now,
    });
    db.close();

    await runBriefingCommand(undefined, { all: true, json: false });
    expect(logged()).toContain("briefing-test-project");
  });
});
