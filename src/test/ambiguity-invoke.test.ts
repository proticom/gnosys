// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runAmbiguityCommand } from "../lib/ambiguityCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-ambiguity-invoke-"));
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

describe("runAmbiguityCommand (in-process invoke)", () => {
  it("reports no ambiguity for a query with no cross-project hits (human)", async () => {
    await runAmbiguityCommand("zebra-unicorn-query", { json: false });
    expect(logged()).toContain('No ambiguity for "zebra-unicorn-query"');
    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("emits structured JSON with ambiguous: false", async () => {
    await runAmbiguityCommand("zebra-unicorn-query", { json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.query).toBe("zebra-unicorn-query");
    expect(parsed.ambiguous).toBe(false);
  });
});
