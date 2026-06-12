/**
 * v5.12.1 — `gnosys cleanup --rules`: uninstall counterpart of the rules
 * generator. removeRulesBlock existed since the rulesGen work but was never
 * wired into any command; removeRulesFromProject + the --rules option close
 * that loose end.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removeRulesBlock, removeRulesFromProject } from "../lib/rulesGen.js";

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
  const cli = readFileSync(path.join(process.cwd(), "src/cli.ts"), "utf-8");

  it("exposes --rules on the cleanup command and routes to removeRulesFromProject", () => {
    expect(cli).toContain('.option(\n    "--rules [dir]"');
    expect(cli).toContain('await import("./lib/rulesGen.js")');
    expect(cli).toContain("removeRulesFromProject(dir)");
  });
});
