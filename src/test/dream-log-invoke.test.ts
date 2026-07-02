// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runDreamLogCommand } from "../lib/dreamLogCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-dreamlog-invoke-"));
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

describe("runDreamLogCommand (in-process invoke)", () => {
  it("prints 'No dream runs recorded.' when the log is empty", async () => {
    await runDreamLogCommand({ last: "20" });
    expect(logged()).toContain("No dream runs recorded.");
    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("emits structured JSON with count 0 for --json on an empty log", async () => {
    await runDreamLogCommand({ last: "20", json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(0);
    expect(parsed.runs).toEqual([]);
  });

  it("honours parentJson context (JSON even without --json)", async () => {
    await runDreamLogCommand({ last: "5" }, { parentJson: true });
    const parsed = JSON.parse(logged());
    expect(parsed.count).toBe(0);
  });
});
