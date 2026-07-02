// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runPrefGetCommand, runPrefSetCommand } from "../lib/prefCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-pref-invoke-"));
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

describe("pref set/get (in-process invoke)", () => {
  it("sets a known preference key and echoes key/value", async () => {
    await runPrefSetCommand("commit-convention", "conventional-commits", {});
    const out = logged();
    expect(out).toContain("Preference set:");
    expect(out).toContain("commit-convention");
    expect(out).toContain("conventional-commits");
    expect(process.exitCode).toBeUndefined();
  });

  it("reads the stored preference back", async () => {
    await runPrefGetCommand("commit-convention", {});
    expect(logged()).toContain("conventional-commits");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("rejects a near-miss key with a suggestion and exitCode 1", async () => {
    await runPrefSetCommand("comit-convention", "whatever", {});
    expect(errSpy.mock.calls.join("\n")).toContain("did you mean");
    expect(process.exitCode).toBe(1);
  });
});
