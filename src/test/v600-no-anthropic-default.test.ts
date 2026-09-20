// v6.0.0 (deci-049): eliminate the last mechanism by which "anthropic"
// silently becomes the default LLM provider. The Zod schema no longer
// defaults llm.defaultProvider; LLM-requiring paths go through
// requireDefaultProvider(), which throws a clear "run gnosys setup" error.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  GnosysConfigSchema,
  loadConfig,
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

  it("loading an unconfigured store requires explicit provider setup", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-no-provider-"));
    vi.stubEnv("GNOSYS_HOME", home);
    try {
      const config = await loadConfig(home);
      expect(config.llm.defaultProvider).toBeUndefined();
      expect(() => requireDefaultProvider(config)).toThrow("No default LLM provider configured. Run 'gnosys setup' (or set llm.defaultProvider in gnosys.json).");
    } finally {
      vi.unstubAllEnvs();
      await fs.rm(home, { recursive: true, force: true });
    }
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
    expect(JSON.parse(template)).toMatchObject({
      llm: { ollama: { model: "llama3.2", baseUrl: "http://localhost:11434" } },
      importConcurrency: 5,
      archive: { maxActiveDays: 90, minConfidence: 0.3 },
      dream: { enabled: false, provider: "ollama", minMemories: 10 },
    });
    // Sanity: it still parses and stays undefined through the schema
    const parsed = GnosysConfigSchema.parse(JSON.parse(template));
    expect(parsed.llm.defaultProvider).toBeUndefined();
  });
});
