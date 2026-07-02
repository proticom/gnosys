/**
 * Regression tests for the v5.13.1 `dream run --scheduled` flag loss.
 *
 * The bare `gnosys dream` parent command declares the same flags as the
 * `dream run` subcommand, and commander resolves parent-declared options
 * onto the PARENT — so `gnosys dream run --scheduled` (the exact command
 * line in the launchd agent) reached runDreamCommand with scheduled
 * undefined and ran a MANUAL dream, bypassing the night-window / idle /
 * dreamworthiness gates. Same loss applied to --force / --json /
 * --max-runtime after `run`. Fixed by merging parent opts in the run
 * action (the pattern `dream log` already used).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { Command } from "commander";

describe("dream run --scheduled flag handling (v5.13.1)", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");

  it("run action merges parent opts before calling runDreamCommand", () => {
    expect(cli).toContain(
      "const merged = { ...(this.parent?.opts() ?? {}), ...opts } as DreamRunOpts;",
    );
    expect(cli).toContain("await runDreamCommand(merged);");
  });

  it("commander repro: parent-declared flags land on the parent, merge recovers them", () => {
    // The exact structure cli.ts uses — parent with flags + action, then a
    // run subcommand with the same flags. Proves the bug and the fix shape.
    let rawOpts: Record<string, unknown> = { sentinel: true };
    let mergedOpts: Record<string, unknown> = {};

    const program = new Command();
    const dreamCmd = program.command("dream");
    dreamCmd.option("--scheduled").action(() => {});
    dreamCmd
      .command("run")
      .option("--scheduled")
      .action(function (this: Command, opts: Record<string, unknown>) {
        rawOpts = opts;
        mergedOpts = { ...(this.parent?.opts() ?? {}), ...opts };
      });

    program.parse(["node", "cli", "dream", "run", "--scheduled"]);

    // The bug: the subcommand's own opts do NOT contain the flag…
    expect(rawOpts.scheduled).toBeUndefined();
    // …the parent-merge recovers it.
    expect(mergedOpts.scheduled).toBe(true);
  });
});
