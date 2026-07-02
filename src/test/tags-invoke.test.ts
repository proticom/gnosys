// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysResolver } from "../lib/resolver.js";
import { runTagsCommand } from "../lib/tagsCommand.js";
import { runTagsAddCommand } from "../lib/tagsAddCommand.js";

let base: string;
let projectDir: string;
const origHome = process.env.GNOSYS_HOME;

const getResolver = () => GnosysResolver.resolveForProject(projectDir);

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-tags-invoke-"));
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

describe("runTagsCommand / runTagsAddCommand (in-process invoke)", () => {
  it("adds a new tag to a category", async () => {
    await runTagsAddCommand(getResolver, { category: "domain", tag: "invoke-test" });
    expect(logged()).toContain("Tag 'invoke-test' added to category 'domain'.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("reports a duplicate tag without re-adding it", async () => {
    await runTagsAddCommand(getResolver, { category: "domain", tag: "invoke-test" });
    expect(logged()).toContain("Tag 'invoke-test' already exists in 'domain'.");
  });

  it("lists the registry including the added tag", async () => {
    await runTagsCommand(getResolver);
    const out = logged();
    expect(out).toContain("domain:");
    expect(out).toContain("invoke-test");
  });
});
