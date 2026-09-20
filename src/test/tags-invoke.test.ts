// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-tags-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  projectDir = join(base, "project");
  mkdirSync(join(projectDir, ".gnosys"), { recursive: true });
});
afterEach(() => {
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
  async function registryPath(): Promise<string> {
    const resolver = await getResolver();
    const target = resolver.getWriteTarget();
    if (!target) throw new Error("Missing test store");
    const config = join(target.store.getStorePath(), ".config");
    mkdirSync(config, { recursive: true });
    return join(config, "tags.json");
  }

  async function seedTags(): Promise<string> {
    const file = await registryPath();
    writeFileSync(file, JSON.stringify({ domain: ["zebra", "invoke-test", "alpha"] }));
    return file;
  }

  it("adds a new tag to a category", async () => {
    await runTagsAddCommand(getResolver, { category: "domain", tag: "invoke-test" });
    expect(logged()).toContain("Tag 'invoke-test' added to category 'domain'.");
    expect(errSpy).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(await registryPath(), "utf8")).domain).toContain("invoke-test");
  });

  it("reports a duplicate tag without re-adding it", async () => {
    const file = await seedTags();
    await runTagsAddCommand(getResolver, { category: "domain", tag: "invoke-test" });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ domain: ["zebra", "invoke-test", "alpha"] });
    expect(logged()).toContain("Tag 'invoke-test' already exists in 'domain'.");
  });

  it("lists the registry including the added tag", async () => {
    await seedTags();
    await runTagsCommand(getResolver);
    const out = logged();
    expect(out).toBe("\ndomain:\n  alpha, invoke-test, zebra");
  });
});
