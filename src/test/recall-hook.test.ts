/**
 * Tests for the v5.14.0 automatic-memory-injection hook path.
 *
 * Claude Code never auto-reads MCP resources, so "automatic injection"
 * only becomes real via hooks: gnosys init wires UserPromptSubmit and
 * SessionStart to `gnosys recall-hook`, whose plain stdout Claude Code
 * adds to the model context. Covers the stdin-JSON parsing, the healing
 * of the broken pre-5.14 hook command (`gnosys recall --query ...` —
 * options that never existed, silently failing since it shipped), and
 * the installer's settings.json merge behavior.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { hookQueryFromStdin } from "../lib/recallHookCommand.js";
import { configureClaudeCode } from "../lib/projectIdentity.js";

describe("hookQueryFromStdin", () => {
  it("extracts prompt_text from UserPromptSubmit events", () => {
    expect(
      hookQueryFromStdin(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt_text: "auth JWT tokens" }))
    ).toBe("auth JWT tokens");
  });

  it("accepts the legacy `prompt` field name", () => {
    expect(hookQueryFromStdin(JSON.stringify({ prompt: "database migration" }))).toBe("database migration");
  });

  it("SessionStart events (no prompt) become wildcard", () => {
    expect(hookQueryFromStdin(JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }))).toBe("*");
  });

  it("non-JSON and empty stdin become wildcard", () => {
    expect(hookQueryFromStdin("")).toBe("*");
    expect(hookQueryFromStdin("not json at all")).toBe("*");
    expect(hookQueryFromStdin(JSON.stringify({ prompt_text: "   " }))).toBe("*");
  });

  it("truncates very long prompts", () => {
    const long = "word ".repeat(500);
    expect(hookQueryFromStdin(JSON.stringify({ prompt_text: long })).length).toBeLessThanOrEqual(400);
  });
});

describe("configureClaudeCode hook installation (v5.14.0)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-hooks-"));
    fs.mkdirSync(path.join(tmp, ".claude"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function readSettings(): Record<string, any> {
    return JSON.parse(fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf-8"));
  }

  it("installs SessionStart AND UserPromptSubmit hooks running gnosys recall-hook", async () => {
    const result = await configureClaudeCode(tmp);
    expect(result.configured).toBe(true);

    const settings = readSettings();
    const session = JSON.stringify(settings.hooks.SessionStart);
    const prompt = JSON.stringify(settings.hooks.UserPromptSubmit);
    expect(session).toContain("gnosys recall-hook");
    expect(prompt).toContain("gnosys recall-hook");
    // UserPromptSubmit has no matcher (always fires)
    expect(settings.hooks.UserPromptSubmit[0].matcher).toBeUndefined();
  });

  it("heals the broken pre-5.14 hook command in place", async () => {
    // The shape gnosys init wrote before v5.14 — options that never existed.
    fs.writeFileSync(
      path.join(tmp, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: "startup|resume|compact",
              hooks: [
                {
                  type: "command",
                  command:
                    'gnosys recall --query "session start" --projectRoot "$CLAUDE_PROJECT_DIR" 2>/dev/null || true',
                  timeout: 10,
                },
              ],
            },
          ],
        },
      })
    );

    await configureClaudeCode(tmp);

    const settings = readSettings();
    const all = JSON.stringify(settings.hooks);
    expect(all).not.toContain("--query");
    expect(all).not.toContain("--projectRoot");
    expect(JSON.stringify(settings.hooks.SessionStart)).toContain("gnosys recall-hook");
    expect(JSON.stringify(settings.hooks.UserPromptSubmit)).toContain("gnosys recall-hook");
  });

  it("is idempotent and preserves foreign hooks", async () => {
    fs.writeFileSync(
      path.join(tmp, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [{ hooks: [{ type: "command", command: "my-other-tool --check" }] }],
        },
        permissions: { allow: ["Bash(ls:*)"] },
      })
    );

    await configureClaudeCode(tmp);
    const first = readSettings();
    await configureClaudeCode(tmp);
    const second = readSettings();

    expect(second).toEqual(first); // idempotent
    expect(JSON.stringify(second.hooks.UserPromptSubmit)).toContain("my-other-tool");
    expect(second.permissions.allow).toContain("Bash(ls:*)");
    // exactly one gnosys entry per event
    const gnosysPromptEntries = second.hooks.UserPromptSubmit.filter((e: any) =>
      JSON.stringify(e).includes("gnosys recall-hook")
    );
    expect(gnosysPromptEntries).toHaveLength(1);
  });
});
