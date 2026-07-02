// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runAuditCommand } from "../lib/auditCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-audit-invoke-"));
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

describe("runAuditCommand (in-process invoke)", () => {
  it("emits an empty JSON array when no audit entries exist", async () => {
    await runAuditCommand({ days: "30", json: true });
    const parsed = JSON.parse(logged());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(0);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("renders a human-readable timeline for the empty case without erroring", async () => {
    await runAuditCommand({ days: "7" });
    expect(logSpy).toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });
});
