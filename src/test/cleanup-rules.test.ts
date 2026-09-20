/**
 * v5.12.1 — `gnosys cleanup --rules`: uninstall counterpart of the rules
 * generator. removeRulesBlock existed since the rulesGen work but was never
 * wired into any command; removeRulesFromProject + the --rules option close
 * that loose end.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removeRulesBlock, removeRulesFromProject } from "../lib/rulesGen.js";
import { spawnSync } from "node:child_process";

const START = "<!-- GNOSYS:START -->";
const END = "<!-- GNOSYS:END -->";

describe("removeRulesFromProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cleanup-rules-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("strips the GNOSYS block from every known target and keeps user content", () => {
    const claudePath = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(
      claudePath,
      `# My project\n\n${START}\ngenerated stuff\n${END}\n\nUser notes below.\n`,
    );
    const cursorPath = path.join(tmpDir, ".cursor", "rules", "gnosys.mdc");
    fs.mkdirSync(path.dirname(cursorPath), { recursive: true });
    fs.writeFileSync(cursorPath, `${START}\ncursor rules\n${END}\n`);

    return removeRulesFromProject(tmpDir).then((cleaned) => {
      expect(cleaned.sort()).toEqual([".cursor/rules/gnosys.mdc", "CLAUDE.md"]);
      const claude = fs.readFileSync(claudePath, "utf-8");
      expect(claude).not.toContain(START);
      expect(claude).toContain("# My project");
      expect(claude).toContain("User notes below.");
      expect(fs.readFileSync(cursorPath, "utf-8")).not.toContain(START);
    });
  });

  it("returns empty when no rules files or no GNOSYS blocks exist", async () => {
    expect(await removeRulesFromProject(tmpDir)).toEqual([]);
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# No gnosys block here\n");
    expect(await removeRulesFromProject(tmpDir)).toEqual([]);
    // untouched file
    expect(fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8")).toBe("# No gnosys block here\n");
  });

  it("removeRulesBlock is safe on missing and malformed files", async () => {
    expect(await removeRulesBlock(path.join(tmpDir, "missing.md"))).toBe(false);
    const halfPath = path.join(tmpDir, "half.md");
    fs.writeFileSync(halfPath, `${START}\nno end marker\n`);
    expect(await removeRulesBlock(halfPath)).toBe(false);
  });
});

describe("gnosys cleanup --rules wiring", () => {
  it("exposes --rules on the cleanup command and routes to removeRulesFromProject", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cleanup-cli-"));
    try {
      const file = path.join(project, "CLAUDE.md");
      fs.writeFileSync(file, `# User notes\n\n${START}\ngenerated\n${END}\n`);
      const result = spawnSync(process.execPath, [path.resolve("dist/cli.js"), "cleanup", "--rules"], {
        cwd: project, env: { ...process.env, GNOSYS_HOME: path.join(project, "home") }, encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("Removed GNOSYS block: CLAUDE.md\n");
      expect(fs.readFileSync(file, "utf8").trim()).toBe("# User notes");
    } finally { fs.rmSync(project, { recursive: true, force: true }); }
  });
});
