/**
 * Tests for `gnosys setup models` task-routing redesign (§6).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Interface as ReadlineInterface } from "readline/promises";
import {
  ASSIGNABLE_TASK_LIST,
  buildInlineKeyRequirements,
  buildTaskModelsPatchFromAccepted,
  promptKeyDestinationAndPersist,
  validateTaskCombo,
  writeServiceKeyToEnv,
  type AssignableTaskName,
} from "../lib/setup.js";
import {
  DEFAULT_CONFIG,
  GnosysConfigSchema,
  getProviderModel,
  resolveTaskModel,
  type GnosysConfig,
  type LLMProviderName,
} from "../lib/config.js";
import { apiKeyServiceName, storeApiKeySecret } from "../lib/apiKeyVault.js";
import * as modelValidation from "../lib/modelValidation.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

vi.mock("../lib/modelValidation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof modelValidation>();
  return {
    ...actual,
    validateModel: vi.fn(),
  };
});

vi.mock("../lib/apiKeyVault.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/apiKeyVault.js")>();
  return {
    ...actual,
    storeApiKeySecret: vi.fn(() => true),
    readStoredSecret: vi.fn(() => undefined),
  };
});

function mockRl(answers: string[] = []): ReadlineInterface {
  let i = 0;
  return {
    question: vi.fn().mockImplementation(async () => answers[i++] ?? ""),
    close: vi.fn(),
    on: vi.fn(),
  } as unknown as ReadlineInterface;
}

function sampleConfig(): GnosysConfig {
  return GnosysConfigSchema.parse({
    ...DEFAULT_CONFIG,
    llm: {
      ...DEFAULT_CONFIG.llm,
      defaultProvider: "anthropic",
      anthropic: { model: "claude-sonnet-4-6", apiKey: "x" },
      openrouter: {
        model: "old-openrouter-default",
        baseUrl: "https://openrouter.ai/api/v1",
      },
    },
    taskModels: {
      synthesis: { provider: "groq", model: "llama-3.3-70b-versatile" },
      vision: { provider: "anthropic", model: "claude-haiku-4-5" }, // v6.0.0 chat removed
    },
    dream: {
      enabled: true,
      provider: "ollama",
      model: "llama3.2",
    },
  });
}

describe("setup models task routing", () => {
  beforeEach(() => {
    vi.mocked(modelValidation.validateModel).mockReset();
    vi.mocked(storeApiKeySecret).mockClear();
  });

  describe("buildInlineKeyRequirements", () => {
    it("lists one global requirement per distinct cloud provider", () => {
      const selected: AssignableTaskName[] = ["vision", "dream"]; // v6.0.0 chat removed
      const reqs = buildInlineKeyRequirements(selected, () => "openrouter");
      expect(reqs).toEqual([{ provider: "openrouter", scope: "global" }]);
    });

    it("emits one requirement per distinct provider", () => {
      const reqs = buildInlineKeyRequirements(
        ["vision", "structuring"], // v6.0.0 chat removed
        (t) => (t === "vision" ? "openrouter" : "anthropic"),
      );
      expect(reqs).toHaveLength(2);
      expect(reqs).toEqual(
        expect.arrayContaining([
          { provider: "openrouter", scope: "global" },
          { provider: "anthropic", scope: "global" },
        ]),
      );
    });

    it("skips local providers in requirements", () => {
      const reqs = buildInlineKeyRequirements(["dream"], () => "ollama");
      expect(reqs).toHaveLength(0);
    });
  });

  describe("buildTaskModelsPatchFromAccepted", () => {
    it("regression: vision+dream only — patch touches only those tasks", () => { // v6.0.0 chat removed
      const cfg = sampleConfig();
      const currentByTask = Object.fromEntries(
        ASSIGNABLE_TASK_LIST.map((t) => [
          t,
          t === "dream"
            ? { provider: cfg.dream!.provider as LLMProviderName, model: cfg.dream!.model! }
            : resolveTaskModel(cfg, t as "structuring"),
        ]),
      ) as Record<
        AssignableTaskName,
        { provider: LLMProviderName; model: string }
      >;

      const selectedSet = new Set<AssignableTaskName>(["vision", "dream"]); // v6.0.0 chat removed
      const accepted = {
        vision: { provider: "openrouter" as LLMProviderName, model: "nemotron" },
        dream: { provider: "openrouter" as LLMProviderName, model: "nemotron" },
      };

      const patch = buildTaskModelsPatchFromAccepted(
        accepted,
        currentByTask,
        selectedSet,
      );

      expect(patch).toEqual({
        vision: { provider: "openrouter", model: "nemotron" }, // v6.0.0 chat removed
      });
      expect(patch).not.toHaveProperty("structuring");
      expect(patch).not.toHaveProperty("synthesis");
      expect(patch).not.toHaveProperty("transcription");

      const merged = GnosysConfigSchema.parse({
        ...cfg,
        taskModels: { ...cfg.taskModels, ...patch },
        dream: {
          ...cfg.dream,
          provider: "openrouter",
          model: "nemotron",
        },
      });
      expect(merged.llm.defaultProvider).toBe("anthropic");
      expect(getProviderModel(merged, "openrouter")).toBe("old-openrouter-default");
      expect(resolveTaskModel(merged, "synthesis").provider).toBe("groq");
      expect(resolveTaskModel(merged, "vision").provider).toBe("openrouter"); // v6.0.0 chat removed
    });
  });

  describe("validateTaskCombo", () => {
    it("does not persist keys on validation failure", async () => {
      vi.mocked(modelValidation.validateModel).mockResolvedValue({
        ok: false,
        error: "401 unauthorized",
        latencyMs: 10,
      });

      const rl = mockRl();
      const repromptKey = vi.fn().mockResolvedValue(null);
      const { proceed } = await validateTaskCombo({
        rl,
        provider: "openrouter",
        model: "nemotron",
        apiKey: "bad-key",
        isLocalProvider: false,
        saveAnywayDefault: false,
        repromptKey,
      });

      expect(proceed).toBe(false);
      expect(storeApiKeySecret).not.toHaveBeenCalled();
    });

    it("returns proceed true when validation succeeds", async () => {
      vi.mocked(modelValidation.validateModel).mockResolvedValue({
        ok: true,
        latencyMs: 42,
      });

      const rl = mockRl();
      const { proceed, apiKey } = await validateTaskCombo({
        rl,
        provider: "openrouter",
        model: "nemotron",
        apiKey: "good-key",
        isLocalProvider: false,
      });

      expect(proceed).toBe(true);
      expect(apiKey).toBe("good-key");
      expect(storeApiKeySecret).not.toHaveBeenCalled();
    });
  });

  describe("promptKeyDestinationAndPersist", () => {
    it("secure store (default choice) calls storeApiKeySecret", async () => {
      const rl = mockRl();
      await promptKeyDestinationAndPersist({
        rl,
        service: apiKeyServiceName("openrouter", "global"),
        provider: "openrouter",
        key: "secret",
        scope: "global",
        destinationChoice: 0,
      });
      expect(storeApiKeySecret).toHaveBeenCalledWith(
        "GNOSYS_GLOBAL_OPENROUTER_KEY",
        "secret",
        "openrouter",
      );
    });

    it("dotenv choice writes scoped service line", async () => {
      const rl = mockRl();
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-setup-test-"));
      const home = path.join(tmp, "home");
      const envDir = path.join(home, ".config", "gnosys");
      await fs.mkdir(envDir, { recursive: true });
      const envPath = path.join(envDir, ".env");
      const origHome = process.env.HOME;
      process.env.HOME = home;

      try {
        await promptKeyDestinationAndPersist({
          rl,
          service: "GNOSYS_GLOBAL_OPENROUTER_KEY",
          provider: "openrouter",
          key: "dotenv-secret",
          scope: "global",
          destinationChoice: 1,
        });
        const content = await fs.readFile(envPath, "utf-8");
        expect(content).toContain("GNOSYS_GLOBAL_OPENROUTER_KEY=dotenv-secret");
        expect(storeApiKeySecret).not.toHaveBeenCalled();
      } finally {
        process.env.HOME = origHome;
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("don't store prints env var names and persists nothing", async () => {
      const rl = mockRl();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const dest = await promptKeyDestinationAndPersist({
        rl,
        service: "GNOSYS_GLOBAL_OPENROUTER_KEY",
        provider: "openrouter",
        key: "k",
        scope: "global",
        destinationChoice: 2,
      });

      expect(dest).toBe("none");
      expect(storeApiKeySecret).not.toHaveBeenCalled();
      const joined = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(joined).toContain("GNOSYS_GLOBAL_OPENROUTER_KEY");
      logSpy.mockRestore();
    });
  });

  describe("writeServiceKeyToEnv", () => {
    let tmp = "";
    let origHome = "";

    beforeEach(async () => {
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-env-"));
      origHome = process.env.HOME ?? "";
      process.env.HOME = path.join(tmp, "home");
    });

    afterEach(async () => {
      process.env.HOME = origHome;
      await fs.rm(tmp, { recursive: true, force: true });
    });

    it("writes global-scoped env var lines", async () => {
      await writeServiceKeyToEnv("GNOSYS_GLOBAL_OPENROUTER_KEY", "global-key");
      const content = await fs.readFile(
        path.join(process.env.HOME!, ".config", "gnosys", ".env"),
        "utf-8",
      );
      expect(content).toContain("GNOSYS_GLOBAL_OPENROUTER_KEY=global-key");
    });
  });
});
