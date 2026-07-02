// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { GnosysResolver } from "../lib/resolver.js";
import { runReadCommand } from "../lib/readCommand.js";

let base: string;
const origHome = process.env.GNOSYS_HOME;
const origLocal = process.env.GNOSYS_LOCAL_ONLY;

const getResolver = () => GnosysResolver.resolveForProject(join(base, "empty-project"));

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-read-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  mkdirSync(join(base, "empty-project"), { recursive: true });
  process.env.GNOSYS_HOME = home;
  process.env.GNOSYS_LOCAL_ONLY = "1";
  const db = GnosysDB.openLocal();
  const now = new Date().toISOString();
  db.insertMemory({
    id: "deci-601",
    title: "Read invoke fixture",
    category: "decisions",
    content: "Body of the read invoke fixture memory.",
    summary: null,
    tags: '["test"]',
    relevance: "read invoke",
    author: "ai",
    authority: "imported",
    confidence: 0.8,
    reinforcement_count: 0,
    content_hash: "hash-deci-601",
    status: "active",
    tier: "active",
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: now,
    modified: now,
    embedding: null,
    source_path: null,
    source_file: null,
    source_page: null,
    source_timerange: null,
    project_id: null,
    scope: "user",
  });
  db.close();
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

describe("runReadCommand (in-process invoke)", () => {
  it("prints the memory with frontmatter header and body (human)", async () => {
    await runReadCommand(getResolver, "deci-601", {});
    const out = logged();
    expect(out).toContain("id: deci-601");
    expect(out).toContain("title: 'Read invoke fixture'");
    expect(out).toContain("Body of the read invoke fixture memory.");
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("emits structured JSON for the memory (--json)", async () => {
    await runReadCommand(getResolver, "deci-601", { json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.path).toBe("deci-601");
    expect(parsed.source).toBe("gnosys.db");
    expect(parsed.memory.id).toBe("deci-601");
    expect(parsed.content).toContain("Body of the read invoke fixture memory.");
  });
});
