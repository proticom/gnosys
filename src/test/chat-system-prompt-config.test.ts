/**
 * v5.15: `chat.systemPromptPrefix` and `chat.toolsEnabled` were documented
 * config knobs that were never read. composeSystemPrompt(config, recalled)
 * now honors both.
 */

import { describe, it, expect } from "vitest";
import { composeSystemPrompt } from "../lib/chat/llmTurn.js";
import { buildToolsSystemPrompt } from "../lib/chat/tools.js";
import { GnosysConfigSchema, type GnosysConfig } from "../lib/config.js";

function makeConfig(chat?: Partial<GnosysConfig["chat"]>): GnosysConfig {
  return GnosysConfigSchema.parse(chat ? { chat } : {});
}

describe("v5.15 composeSystemPrompt config wiring", () => {
  it("prepends chat.systemPromptPrefix + blank line before the base prompt", () => {
    const prefix = "You are Gnosys-at-ACME. Prefer terse answers.";
    const prompt = composeSystemPrompt(makeConfig({ systemPromptPrefix: prefix }), []);
    expect(prompt.startsWith(`${prefix}\n\n`)).toBe(true);
    expect(prompt).toContain("Gnosys terminal chat");
  });

  it("whitespace-only prefix is ignored", () => {
    const withBlank = composeSystemPrompt(makeConfig({ systemPromptPrefix: "   " }), []);
    const defaults = composeSystemPrompt(makeConfig(), []);
    expect(withBlank).toBe(defaults);
  });

  it("toolsEnabled: false omits the tools addendum entirely", () => {
    const prompt = composeSystemPrompt(makeConfig({ toolsEnabled: false }), []);
    // Known marker from buildToolsSystemPrompt's fence syntax.
    expect(prompt).not.toContain("gnosys-tool");
    expect(prompt).not.toContain(buildToolsSystemPrompt().trim().slice(0, 40));
  });

  it("defaults keep the tools addendum, and empty prefix produces identical output to defaults", () => {
    const defaults = composeSystemPrompt(makeConfig(), []);
    const emptyPrefix = composeSystemPrompt(makeConfig({ systemPromptPrefix: "" }), []);
    expect(defaults).toContain("gnosys-tool");
    expect(defaults).toBe(emptyPrefix);
  });

  it("recalled memories are still appended after the configured prompt", () => {
    const prompt = composeSystemPrompt(makeConfig({ systemPromptPrefix: "PREFIX." }), [
      {
        id: "deci-001",
        title: "A decision",
        category: "decisions",
        content: "We decided things.",
        score: 0.9,
      } as never,
    ]);
    expect(prompt.startsWith("PREFIX.\n\n")).toBe(true);
    expect(prompt).toContain("deci-001");
  });
});
