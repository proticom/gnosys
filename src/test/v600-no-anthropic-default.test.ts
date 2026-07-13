// v6.0.0 (deci-049): eliminate the last mechanism by which "anthropic"
// silently becomes the default LLM provider. The Zod schema no longer
// defaults llm.defaultProvider; LLM-requiring paths go through
// requireDefaultProvider(), which throws a clear "run gnosys setup" error.

import { describe, it, expect } from "vitest";
import {
  GnosysConfigSchema,
  DEFAULT_CONFIG,
  requireDefaultProvider,
  generateConfigTemplate,
  type GnosysConfig,
} from "../lib/config.js";

describe("v6.0.0 — no implicit anthropic default (deci-049)", () => {
  it("GnosysConfigSchema.parse({}) leaves defaultProvider undefined", () => {
    const cfg = GnosysConfigSchema.parse({});
    expect(cfg.llm.defaultProvider).toBeUndefined();
    expect(cfg.llm.defaultProvider).not.toBe("anthropic");
  });

  it("GnosysConfigSchema.parse({ llm: {} }) leaves defaultProvider undefined", () => {
    const cfg = GnosysConfigSchema.parse({ llm: {} });
    expect(cfg.llm.defaultProvider).toBeUndefined();
    expect(cfg.llm.defaultProvider).not.toBe("anthropic");
  });

  it("DEFAULT_CONFIG has no defaultProvider", () => {
    expect(DEFAULT_CONFIG.llm.defaultProvider).toBeUndefined();
  });

  it("an explicitly set defaultProvider survives parse", () => {
    const cfg = GnosysConfigSchema.parse({ llm: { defaultProvider: "groq" } });
    expect(cfg.llm.defaultProvider).toBe("groq");
  });

  describe("requireDefaultProvider", () => {
    it("throws the run-setup message when unset", () => {
      const cfg: GnosysConfig = GnosysConfigSchema.parse({});
      expect(() => requireDefaultProvider(cfg)).toThrow(
        "No default LLM provider configured. Run 'gnosys setup' (or set llm.defaultProvider in gnosys.json)."
      );
    });

    it("returns the value when set", () => {
      const cfg = GnosysConfigSchema.parse({ llm: { defaultProvider: "ollama" } });
      expect(requireDefaultProvider(cfg)).toBe("ollama");
    });
  });

  it("generateConfigTemplate() output contains no defaultProvider", () => {
    const template = generateConfigTemplate();
    expect(template).not.toContain("defaultProvider");
    // Sanity: it still parses and stays undefined through the schema
    const parsed = GnosysConfigSchema.parse(JSON.parse(template));
    expect(parsed.llm.defaultProvider).toBeUndefined();
  });
});
