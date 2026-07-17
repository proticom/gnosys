/**
 * v6.2.1 cli split — runtime wiring guard.
 *
 * Source-grep tests (readCliSource) and the doc generators concatenate
 * src/cli.ts + src/cli/*.ts by directory listing, so a module that exists
 * on disk but is never register*()-ed from cli.ts would still satisfy
 * them. This test closes that gap: every command name declared anywhere
 * in the cli sources must actually appear in the built CLI's runtime
 * --help output (i.e., be registered on the live program).
 */
import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import { readCliSource } from "./_helpers.js";

describe("cli command wiring (runtime vs source)", () => {
  it("every .command() declared in source is registered at runtime", () => {
    const src = readCliSource();
    const declared = new Set(
      [...src.matchAll(/\.command\("([a-z][a-z0-9:-]*)/g)].map((m) => m[1]),
    );
    expect(declared.size).toBeGreaterThanOrEqual(60);

    // Collect runtime command names: top-level from --help, then one level
    // of subcommands from `<cmd> --help`.
    const runtime = new Set<string>();
    const help = (path: string): string => {
      try {
        return execSync(`node dist/cli.js ${path} --help 2>&1`.trim(), { encoding: "utf8" });
      } catch (e) {
        return (e as { stdout?: string }).stdout ?? "";
      }
    };
    // BFS to depth 3 (e.g. setup remote push). Only descend when the help
    // output actually lists a Commands: section.
    const queue: string[] = [""];
    let depth = 0;
    while (queue.length && depth < 3) {
      const level = queue.splice(0);
      for (const parent of level) {
        const out = help(parent);
        if (!/^Commands:/m.test(out)) continue;
        const section = out.slice(out.search(/^Commands:/m));
        for (const m of section.matchAll(/^  ([a-z][a-z0-9-]*)/gm)) {
          runtime.add(m[1]);
          queue.push(`${parent} ${m[1]}`.trim());
        }
      }
      depth++;
    }

    const missing = [...declared].filter((c) => !runtime.has(c));
    expect(missing, `declared in source but not registered at runtime: ${missing.join(", ")}`).toEqual([]);
  });
});
