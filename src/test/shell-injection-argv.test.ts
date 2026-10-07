/**
 * Shell injection — argv-array form for path-interpolating commands.
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { migrateProject, writeProjectIdentity } from "../lib/projectIdentity.js";


describe("shell injection argv form", () => {
  let base: string;

  afterEach(() => {
    if (base) {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("migrateProject copies stores when paths contain spaces", async () => {
    base = join(tmpdir(), `gnosys shell inj ${Date.now()}`);
    const sourcePath = join(base, "src project");
    const targetPath = join(base, "tgt project");
    mkdirSync(sourcePath, { recursive: true });
    mkdirSync(targetPath, { recursive: true });
    mkdirSync(join(sourcePath, ".gnosys"), { recursive: true });

    await writeProjectIdentity(sourcePath, {
      projectId: "test-shell-inj",
      projectName: "src",
      workingDirectory: sourcePath,
      user: "tester",
      agentRulesTarget: null,
      obsidianVault: null,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    });

    const memoryDir = join(sourcePath, ".gnosys", "decisions");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "note.md"), "# spaced path copy\n", "utf-8");

    const result = await migrateProject({ sourcePath, targetPath });

    expect(result.memoryFileCount).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(targetPath, ".gnosys", "gnosys.json"))).toBe(true);
    expect(
      readFileSync(join(targetPath, ".gnosys", "decisions", "note.md"), "utf-8"),
    ).toContain("spaced path copy");
  });

  it("copies literal shell syntax without executing it", async () => {
    base = join(tmpdir(), `gnosys-shell-syntax-${Date.now()}`);
    const marker = join(base, "OWNED");
    const sourcePath = join(base, `source-$(touch ${marker})`);
    const targetPath = join(base, "target");
    mkdirSync(join(sourcePath, ".gnosys", "decisions"), { recursive: true });
    mkdirSync(targetPath, { recursive: true });
    await writeProjectIdentity(sourcePath, {
      projectId: "shell-literal", projectName: "literal", workingDirectory: sourcePath,
      user: "tester", agentRulesTarget: null, obsidianVault: null,
      createdAt: "2026-01-01", schemaVersion: 1,
    });
    writeFileSync(join(sourcePath, ".gnosys", "decisions", "note.md"), "# Literal shell path\n");
    let result: Awaited<ReturnType<typeof migrateProject>> | undefined;
    let failure: unknown;
    try { result = await migrateProject({ sourcePath, targetPath }); } catch (error) { failure = error; }
    expect(existsSync(marker)).toBe(false);
    expect(failure).toBeUndefined();
    expect(result?.memoryFileCount).toBe(1);
    expect(readFileSync(join(targetPath, ".gnosys", "decisions", "note.md"), "utf8")).toBe("# Literal shell path\n");
  });
});
