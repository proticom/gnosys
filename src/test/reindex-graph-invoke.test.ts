// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";
import { runReindexGraphCommand } from "../lib/reindexGraphCommand.js";

let base: string;
let projectDir: string;
const origHome = process.env.GNOSYS_HOME;

const getResolver = () => GnosysResolver.resolveForProject(projectDir);

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "gnosys-reindex-graph-invoke-"));
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
    "alpha.md",
    {
      id: "deci-911",
      title: "Alpha",
      category: "decisions",
      tags: {},
      relevance: "reindex graph invoke",
      author: "human",
      authority: "declared",
      confidence: 0.9,
      created: "2026-01-01",
      modified: "2026-01-01",
      status: "active",
      supersedes: null,
    },
    "Alpha links to [[beta]].",
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

describe("runReindexGraphCommand (in-process invoke)", () => {
  it("rebuilds the graph and prints stats for a project store", async () => {
    await runReindexGraphCommand(getResolver);
    const out = logged();
    expect(out.length).toBeGreaterThan(0);
    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("is idempotent — a second run also succeeds", async () => {
    await runReindexGraphCommand(getResolver);
    expect(logSpy).toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });
});
