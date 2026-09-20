/**
 * Tests for the setup wizard helpers and model tier data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createInterface, type Interface } from "readline/promises";
import { PassThrough } from "stream";
import {
  pickProvider,
  pickModel,
  getStructuringModel,
  writeApiKey,
  detectIDEs,
  parseCommaSeparatedTaskSelection,
} from "../lib/setup.js";
import {
  DEFAULT_CONFIG,
  GnosysConfigSchema,
  getProviderModel,
  resolveTaskModel,
} from "../lib/config.js";

async function choose(run: (rl: Interface) => Promise<string>, answer: string) {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output });
  const lines: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" ").replace(/\x1b\[[0-9;]*m/g, "").trim());
  });
  try {
    const pending = run(rl);
    input.write(answer + "\n");
    return { value: await pending, lines };
  } finally {
    rl.close();
    log.mockRestore();
  }
}

describe("Setup Wizard", () => {
  describe("provider and model selection", () => {
    it("returns the provider selected through each menu option", async () => {
      const selected: string[] = [];
      for (let choice = 1; choice <= 9; choice++) {
        selected.push((await choose((rl) => pickProvider(rl, {}, "Provider"), String(choice))).value);
      }
      expect(selected).toEqual([
        "anthropic", "openai", "ollama", "groq", "xai", "mistral", "lmstudio", "openrouter", "custom",
      ]);
    });

    it("returns cloud model selections and renders the recommended model with prices", async () => {
      const selected: string[] = [];
      for (const choice of ["1", "2", "3"]) {
        const result = await choose((rl) => pickModel(rl, "anthropic", {}, "Model"), choice);
        selected.push(result.value);
        expect(result.lines).toContain("2. Balanced (claude-sonnet-4-6)  $3.00–$15.00/M tokens  <- recommended");
      }
      expect(selected).toEqual(["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-6"]);
    });

    it("accepts a typed model for the custom provider", async () => {
      expect((await choose((rl) => pickModel(rl, "custom", {}, "Model"), "my-local-model")).value)
        .toBe("my-local-model");
    });

    it("selects local models and renders their literal menu labels", async () => {
      const ollama = await choose((rl) => pickModel(rl, "ollama", {}, "Model"), "1");
      const studio = await choose((rl) => pickModel(rl, "lmstudio", {}, "Model"), "1");
      expect(ollama.value).toBe("llama3.2");
      expect(studio.value).toBe("default");
      expect(ollama.lines).toContain("1. Llama 3.2 (default)  <- recommended");
      expect(studio.lines).toContain("1. Default  <- recommended");
    });
  });

  describe("getStructuringModel", () => {
    it("returns claude-haiku-4-5 for anthropic", () => {
      expect(getStructuringModel("anthropic", "claude-sonnet-4-6")).toBe(
        "claude-haiku-4-5"
      );
    });

    it("returns gpt-5.4-nano for openai", () => {
      expect(getStructuringModel("openai", "gpt-5.4-mini")).toBe(
        "gpt-5.4-nano"
      );
    });

    it("returns same model for groq (already cheap)", () => {
      expect(
        getStructuringModel("groq", "llama-3.3-70b-versatile")
      ).toBe("llama-3.3-70b-versatile");
    });

    it("returns same model for ollama", () => {
      expect(getStructuringModel("ollama", "llama3.2")).toBe("llama3.2");
    });

    it("returns same model for custom", () => {
      expect(getStructuringModel("custom", "my-model")).toBe("my-model");
    });
  });

  describe("writeApiKey", () => {
    let tmpDir: string;
    let origHome: string | undefined;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-setup-test-"));
      origHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(async () => {
      process.env.HOME = origHome;
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("creates directory and writes key", async () => {
      await writeApiKey("anthropic", "sk-ant-test-key");
      const envPath = path.join(tmpDir, ".config", "gnosys", ".env");
      const content = await fs.readFile(envPath, "utf-8");
      expect(content).toContain("GNOSYS_ANTHROPIC_KEY=sk-ant-test-key");
    });

    it("maps providers to correct env var names", async () => {
      await writeApiKey("openai", "sk-test");
      const envPath = path.join(tmpDir, ".config", "gnosys", ".env");
      const content = await fs.readFile(envPath, "utf-8");
      expect(content).toContain("GNOSYS_OPENAI_KEY=sk-test");
    });

    it("does not duplicate keys on second write", async () => {
      await writeApiKey("anthropic", "key1");
      await writeApiKey("anthropic", "key2");
      const envPath = path.join(tmpDir, ".config", "gnosys", ".env");
      const content = await fs.readFile(envPath, "utf-8");
      const matches = content.match(/GNOSYS_ANTHROPIC_KEY/g);
      expect(matches).toHaveLength(1);
      expect(content).toContain("GNOSYS_ANTHROPIC_KEY=key2");
    });

    it("preserves existing keys for other providers", async () => {
      await writeApiKey("anthropic", "ant-key");
      await writeApiKey("openai", "oai-key");
      const envPath = path.join(tmpDir, ".config", "gnosys", ".env");
      const content = await fs.readFile(envPath, "utf-8");
      expect(content).toContain("GNOSYS_ANTHROPIC_KEY=ant-key");
      expect(content).toContain("GNOSYS_OPENAI_KEY=oai-key");
    });

    it("uses GNOSYS_CUSTOM_KEY for custom provider", async () => {
      await writeApiKey("custom", "custom-key");
      const envPath = path.join(tmpDir, ".config", "gnosys", ".env");
      const content = await fs.readFile(envPath, "utf-8");
      expect(content).toContain("GNOSYS_CUSTOM_KEY=custom-key");
    });
  });

  describe("detectIDEs", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-ide-test-"));
      vi.spyOn(os, "homedir").mockReturnValue(tmpDir);
      vi.stubEnv("PATH", tmpDir);
      const stat = fs.stat;
      vi.spyOn(fs, "stat").mockImplementation((file) => {
        if (!String(file).startsWith(tmpDir + path.sep)) return Promise.reject(new Error("ENOENT"));
        return stat(file);
      });
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("detects the IDE marker directories in the selected home", async () => {
      for (const directory of [".claude", ".cursor", ".grok"]) {
        await fs.mkdir(path.join(tmpDir, directory));
      }
      expect(await detectIDEs(tmpDir)).toEqual(["claude", "cursor", "grok-build"]);
    });

    it("detects a newly installed IDE after an initially empty home", async () => {
      expect(await detectIDEs(tmpDir)).toEqual([]);
      await fs.mkdir(path.join(tmpDir, ".cursor"));
      expect(await detectIDEs(tmpDir)).toEqual(["cursor"]);
    });
  });

  describe("Config defaults match current models", () => {
    it("default Anthropic model is claude-sonnet-4-6", () => {
      expect(getProviderModel(DEFAULT_CONFIG, "anthropic")).toBe(
        "claude-sonnet-4-6"
      );
    });

    it("default OpenAI model is gpt-5.4-mini", () => {
      expect(getProviderModel(DEFAULT_CONFIG, "openai")).toBe("gpt-5.4-mini");
    });

    it("default xAI model is grok-4.20", () => {
      expect(getProviderModel(DEFAULT_CONFIG, "xai")).toBe("grok-4.20");
    });

    it("default Mistral model is mistral-small-4", () => {
      expect(getProviderModel(DEFAULT_CONFIG, "mistral")).toBe(
        "mistral-small-4"
      );
    });

    it("default Groq model is llama-3.3-70b-versatile", () => {
      expect(getProviderModel(DEFAULT_CONFIG, "groq")).toBe(
        "llama-3.3-70b-versatile"
      );
    });
  });

  describe("parseCommaSeparatedTaskSelection", () => {
    it("parses comma-separated 1-based indices", () => {
      expect(parseCommaSeparatedTaskSelection("1,3,5", 5)).toEqual([0, 2, 4]);
    });

    it("accepts all and none", () => {
      expect(parseCommaSeparatedTaskSelection("all", 5)).toBe("all");
      expect(parseCommaSeparatedTaskSelection("none", 5)).toBe("none");
    });

    it("rejects out-of-range values", () => {
      expect(parseCommaSeparatedTaskSelection("1,9", 5)).toBeNull();
    });
  });

  describe("resolveTaskModel structuring optimization", () => {
    it("anthropic structuring returns claude-haiku-4-5", () => {
      const config = GnosysConfigSchema.parse({
        llm: { defaultProvider: "anthropic" },
      });
      const result = resolveTaskModel(config, "structuring");
      expect(result.model).toBe("claude-haiku-4-5");
    });

    it("openai structuring returns gpt-5.4-nano", () => {
      const config = GnosysConfigSchema.parse({
        llm: { defaultProvider: "openai" },
      });
      const result = resolveTaskModel(config, "structuring");
      expect(result.model).toBe("gpt-5.4-nano");
    });

    it("groq structuring returns the default groq model (no override)", () => {
      const config = GnosysConfigSchema.parse({
        llm: { defaultProvider: "groq" },
      });
      const result = resolveTaskModel(config, "structuring");
      expect(result.model).toBe("llama-3.3-70b-versatile");
    });

    it("explicit task override takes precedence", () => {
      const config = GnosysConfigSchema.parse({
        llm: { defaultProvider: "anthropic" },
        taskModels: {
          structuring: { provider: "ollama", model: "llama3.2" },
        },
      });
      const result = resolveTaskModel(config, "structuring");
      expect(result.provider).toBe("ollama");
      expect(result.model).toBe("llama3.2");
    });
  });
});
