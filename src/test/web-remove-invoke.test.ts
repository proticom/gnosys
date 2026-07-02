// v5.14.x overnight sprint — priority 3 wiring-test conversion (invoke tests)
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runWebRemoveCommand } from "../lib/webRemoveCommand.js";

let base: string;
let storeDir: string;
let knowledgeDir: string;
const origHome = process.env.GNOSYS_HOME;

const getWebStorePath = async () => storeDir;

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
const logged = () => logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "gnosys-web-remove-invoke-"));
  const home = join(base, ".gnosys");
  mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;

  storeDir = join(base, "webstore");
  knowledgeDir = join(base, "knowledge");
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });
  writeFileSync(
    join(storeDir, "gnosys.json"),
    JSON.stringify({ web: { source: "urls", outputDir: knowledgeDir } }),
  );
  writeFileSync(
    join(knowledgeDir, "doc.md"),
    "---\ntitle: Doc\ncategory: general\n---\n\nRemovable document body.",
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

describe("runWebRemoveCommand (in-process invoke)", () => {
  it("removes a knowledge file and rebuilds the index (--json)", async () => {
    await runWebRemoveCommand(getWebStorePath, "doc.md", { json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.ok).toBe(true);
    expect(parsed.removed).toBe("doc.md");
    expect(existsSync(join(knowledgeDir, "doc.md"))).toBe(false);
    expect(existsSync(join(knowledgeDir, "gnosys-index.json"))).toBe(true);
  });

  it("refuses to remove a path outside the knowledge directory", async () => {
    await expect(
      runWebRemoveCommand(getWebStorePath, "../escape.md", {}),
    ).rejects.toThrow("process.exit(1)");
    expect(errSpy.mock.calls.join("\n")).toContain(
      "Refusing to remove file outside knowledge directory",
    );
  });

  it("errors on a missing file", async () => {
    await expect(
      runWebRemoveCommand(getWebStorePath, "nope.md", {}),
    ).rejects.toThrow("process.exit(1)");
    expect(errSpy.mock.calls.join("\n")).toContain("File not found");
  });
});
