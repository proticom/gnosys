// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";
import { runLinksCommand } from "../lib/linksCommand.js";

let base: string;
let projectDir: string;
const origHome = process.env.GNOSYS_HOME;

const getResolver = () => GnosysResolver.resolveForProject(projectDir);

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

function fm(id: string, title: string) {
  return {
    id,
    title,
    category: "decisions",
    tags: {},
    relevance: `${id} links invoke`,
    author: "human" as const,
    authority: "declared" as const,
    confidence: 0.9,
    created: "2026-01-01",
    modified: "2026-01-01",
    status: "active" as const,
    supersedes: null,
  };
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "gnosys-links-invoke-"));
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
    "source.md",
    fm("deci-901", "Source memory"),
    "Links to [[target]] here.",
    { autoCommit: false },
  );
  await store.writeMemory(
    "decisions",
    "target.md",
    fm("deci-902", "Target memory"),
    "No outgoing links.",
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

describe("runLinksCommand (in-process invoke)", () => {
  it("shows outgoing wikilinks for the source memory (human)", async () => {
    await runLinksCommand(getResolver, "decisions/source.md", {});
    const out = logged();
    expect(out).toContain("Links for Source memory:");
    expect(out).toContain("[[target]]");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("emits structured JSON with outgoing/backlinks arrays (--json)", async () => {
    await runLinksCommand(getResolver, "decisions/source.md", { json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.title).toBe("Source memory");
    expect(parsed.outgoing.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.backlinks)).toBe(true);
  });

  it("exits with an error for a missing memory path", async () => {
    await expect(
      runLinksCommand(getResolver, "decisions/missing.md", {}),
    ).rejects.toThrow("process.exit(1)");
    expect(errSpy.mock.calls.join("\n")).toContain("Memory not found");
  });
});
