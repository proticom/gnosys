// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";
import { runStaleCommand } from "../lib/staleCommand.js";

let base: string;
let projectDir: string;
const origHome = process.env.GNOSYS_HOME;

const getResolver = () => GnosysResolver.resolveForProject(projectDir);

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "gnosys-stale-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
  projectDir = join(base, "project");
  const storePath = join(projectDir, ".gnosys");
  mkdirSync(storePath, { recursive: true });

  const store = new GnosysStore(storePath);
  await store.init();
  await store.writeMemory(
    "decisions",
    "old-memory.md",
    {
      id: "deci-801",
      title: "Ancient decision",
      category: "decisions",
      tags: {},
      relevance: "stale invoke old",
      author: "human",
      authority: "declared",
      confidence: 0.9,
      created: "2020-01-01",
      modified: "2020-01-01",
      status: "active",
      supersedes: null,
    },
    "# Ancient decision\n\nVery old.",
    { autoCommit: false },
  );
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

describe("runStaleCommand (in-process invoke)", () => {
  it("lists memories older than the threshold", async () => {
    await runStaleCommand(getResolver, { days: "30", limit: "20" });
    const out = logged();
    expect(out).toContain("memories not touched in 30+ days:");
    expect(out).toContain("Ancient decision");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("reports no stale memories with a huge threshold", async () => {
    await runStaleCommand(getResolver, { days: "36500", limit: "20" });
    expect(logged()).toContain("No memories older than 36500 days.");
  });
});
