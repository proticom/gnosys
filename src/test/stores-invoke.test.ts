// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysResolver } from "../lib/resolver.js";
import { runStoresCommand } from "../lib/storesCommand.js";

let base: string;
let projectDir: string;
const origHome = process.env.GNOSYS_HOME;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-stores-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  projectDir = join(base, "project");
  mkdirSync(join(projectDir, ".gnosys"), { recursive: true });
});
afterAll(() => {
  if (origHome === undefined) delete process.env.GNOSYS_HOME;
  else process.env.GNOSYS_HOME = origHome;
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

describe("runStoresCommand (in-process invoke)", () => {
  it("prints the resolver summary including the project store", async () => {
    await runStoresCommand(() => GnosysResolver.resolveForProject(projectDir));
    const out = logged();
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("project");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("still prints a summary when no project store exists", async () => {
    await runStoresCommand(() => GnosysResolver.resolveForProject(join(base, "nope")));
    expect(logSpy).toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });
});
