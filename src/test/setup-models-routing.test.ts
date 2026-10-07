/**
 * Tests for `gnosys setup models` task-routing redesign (§6).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInterface, type Interface as ReadlineInterface } from "readline/promises";
import { PassThrough } from "stream";
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
import { apiKeyServiceName } from "../lib/apiKeyVault.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

const { commandRun } = vi.hoisted(() => ({ commandRun: vi.fn<(command: string) => string>(() => "") }));
vi.mock("child_process", async (importOriginal) => ({
  ...await importOriginal<typeof import("child_process")>(),
  execSync: commandRun,
}));
const readlineInterfaces: ReadlineInterface[] = [];
function mockRl(answers: string[] = []): ReadlineInterface {
  const rl = createInterface({ input: new PassThrough(), output: new PassThrough() });
  vi.spyOn(rl, "question").mockImplementation(async () => answers.shift() ?? "");
  readlineInterfaces.push(rl);
  return rl;
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
  let isolatedHome: string;
  beforeEach(async () => {
    isolatedHome = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-routing-"));
    vi.stubEnv("HOME", isolatedHome);
    vi.stubEnv("GNOSYS_HOME", path.join(isolatedHome, ".gnosys"));
    commandRun.mockClear();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected network request")));
  });

  afterEach(async () => {
    for (const rl of readlineInterfaces.splice(0)) rl.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await fs.rm(isolatedHome, { recursive: true, force: true });
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
      vi.mocked(fetch).mockResolvedValue(new Response('{"error":{"message":"unauthorized"}}', { status: 401 }));

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
      expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
        method: "POST", headers: expect.objectContaining({ Authorization: "Bearer bad-key" }),
        body: '{"model":"nemotron","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}',
      }));
      expect(repromptKey).toHaveBeenCalledOnce();
      expect(commandRun.mock.calls.filter(([command]) => /add-generic-password|secret-tool store/.test(command))).toEqual([]);
    });

    it("returns proceed true when validation succeeds", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('{"choices":[{"message":{"content":"Hi"}}]}'));

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
      expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
        method: "POST", headers: expect.objectContaining({ Authorization: "Bearer good-key" }),
        body: '{"model":"nemotron","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}',
      }));
      expect(commandRun.mock.calls.filter(([command]) => /add-generic-password|secret-tool store/.test(command))).toEqual([]);
    });
  });

  describe("promptKeyDestinationAndPersist", () => {
    it("secure store choice writes the scoped key through the OS boundary", async () => {
      const rl = mockRl();
      await promptKeyDestinationAndPersist({
        rl,
        service: apiKeyServiceName("openrouter", "global"),
        provider: "openrouter",
        key: "secret",
        scope: "global",
        destinationChoice: 0,
      });
      const writes = commandRun.mock.calls.filter(([command]) => /add-generic-password|secret-tool store/.test(command));
      expect(writes).toEqual([[process.platform === "darwin"
        ? 'security add-generic-password -a "$USER" -s "GNOSYS_GLOBAL_OPENROUTER_KEY" -w "secret" -U'
        : 'printf "%s" "secret" | secret-tool store --label="Gnosys openrouter" service gnosys account GNOSYS_GLOBAL_OPENROUTER_KEY',
        expect.objectContaining({ stdio: "pipe" }),
      ]]);
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
        expect(commandRun.mock.calls.filter(([command]) => /add-generic-password|secret-tool store/.test(command))).toEqual([]);
      } finally {
        process.env.HOME = origHome;
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("don't store prints env var names and persists nothing", async () => {
      const rl = mockRl();
      const envPath = path.join(isolatedHome, ".config", "gnosys", ".env");
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, "EXISTING=preserved\n");
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
      expect(await fs.readFile(envPath, "utf-8")).toBe("EXISTING=preserved\n");
      expect(commandRun.mock.calls.filter(([command]) => /add-generic-password|secret-tool store/.test(command))).toEqual([]);
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
