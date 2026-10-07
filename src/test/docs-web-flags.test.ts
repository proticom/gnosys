import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { spawnSync } from "node:child_process";

const root = path.resolve(__dirname, "..", "..");

const docFiles = [
  "docs/commands/web-build-index.md",
  "docs/commands/web-build.md",
  "docs/commands/web-status.md",
];

function documentedFlags(markdown: string): string[] {
  // Match long flags like --input, --no-stop-words, --embed-model.
  const options = markdown.split("\n").filter(line => line.startsWith("| `--")).join("\n");
  const matches = options.match(/--[a-z][a-z0-9-]*/g) ?? [];
  return [...new Set(matches)];
}

describe("web command docs only document shipped CLI flags", () => {
  for (const relPath of docFiles) {
    it(`${relPath} flags are accepted by the published subcommand`, () => {
      const markdown = readFileSync(path.join(root, relPath), "utf-8");
      const flags = documentedFlags(markdown);
      const command = path.basename(relPath, ".md").replace(/^web-/, "");
      const child = spawnSync(process.execPath, [path.join(root, "dist/cli.js"), "web", command, "--help"], {
        encoding: "utf8", timeout: 10000, env: { ...process.env, GNOSYS_SKIP_UPGRADE_NUDGE: "1" },
      });
      expect(child.status, child.stderr).toBe(0);
      expect(flags.length).toBeGreaterThan(0);
      for (const flag of flags) {
        expect(child.stdout, `documented flag ${flag} is absent from web ${command} help`).toMatch(new RegExp(`${flag}(?:[\\s=<,]|$)`));
      }
    });
  }
});
