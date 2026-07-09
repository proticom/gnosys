import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Doc-drift guard for `gnosys web` command docs (v5.17.0 semantic search).
 *
 * Parses the flags documented in docs/commands/web-build-index.md,
 * web-build.md, and web-status.md and asserts each documented `--flag`
 * exists in src/cli.ts. One-directional on purpose: docs may omit flags,
 * but must never document a flag the CLI does not ship.
 */

const root = path.resolve(__dirname, "..", "..");
const cliSource = readFileSync(path.join(root, "src", "cli.ts"), "utf-8");

const docFiles = [
  "docs/commands/web-build-index.md",
  "docs/commands/web-build.md",
  "docs/commands/web-status.md",
];

function documentedFlags(markdown: string): string[] {
  // Match long flags like --input, --no-stop-words, --embed-model.
  const matches = markdown.match(/--[a-z][a-z0-9-]*/g) ?? [];
  return [...new Set(matches)];
}

describe("web command docs only document shipped CLI flags", () => {
  for (const relPath of docFiles) {
    it(`${relPath} flags all exist in src/cli.ts`, () => {
      const markdown = readFileSync(path.join(root, relPath), "utf-8");
      const flags = documentedFlags(markdown);
      expect(flags.length).toBeGreaterThan(0);
      for (const flag of flags) {
        // Commander negated flags (--no-foo) are declared literally in
        // cli.ts option strings, so a plain substring check suffices.
        expect(cliSource, `documented flag ${flag} in ${relPath} is missing from src/cli.ts`).toContain(flag);
      }
    });
  }
});
