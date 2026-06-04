import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import fsSync from "fs";
import os from "os";
import path from "path";
import {
  apiKeyLookupChain,
  apiKeyServiceName,
  buildApiKeyRequirementsFromConfig,
  detectKeyLocation,
  listStoredKeySlots,
  maskKeySnippet,
  readFirstInChain,
} from "../lib/apiKeyVault.js";
import { GnosysConfigSchema } from "../lib/config.js";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("apiKeyVault", () => {
  const envBackup = { ...process.env };
  const originalPlatform = process.platform;
  const mockedExecSync = vi.mocked(execSync);
  let tempHome: string | undefined;

  afterEach(() => {
    process.env = { ...envBackup };
    Object.defineProperty(process, "platform", { value: originalPlatform });
    mockedExecSync.mockReset();
    if (tempHome) {
      fsSync.rmSync(tempHome, { recursive: true, force: true });
      tempHome = undefined;
    }
  });

  beforeEach(() => {
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    delete process.env.GNOSYS_XAI_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GNOSYS_LLM_API_KEY;
    delete process.env.GNOSYS_GLOBAL_OPENROUTER_KEY;
    delete process.env.GNOSYS_OPENROUTER_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  function writeGnosysDotenv(content: string): void {
    tempHome = fsSync.mkdtempSync(path.join(os.tmpdir(), "gnosys-home-"));
    process.env.HOME = tempHome;
    const configDir = path.join(tempHome, ".config", "gnosys");
    fsSync.mkdirSync(configDir, { recursive: true });
    fsSync.writeFileSync(path.join(configDir, ".env"), content, "utf-8");
  }

  function enableMockKeychain(
    values: Record<string, string>,
  ): void {
    Object.defineProperty(process, "platform", { value: "darwin" });
    delete process.env.VITEST;
    mockedExecSync.mockImplementation((command) => {
      const serviceName = Object.keys(values).find((service) =>
        String(command).includes(`-s "${service}"`),
      );
      if (serviceName) return `${values[serviceName]}\n`;
      throw new Error("missing keychain item");
    });
  }

  it("names global and provider scoped keys", () => {
    expect(apiKeyServiceName("openrouter", "global")).toBe(
      "GNOSYS_GLOBAL_OPENROUTER_KEY",
    );
    expect(apiKeyServiceName("anthropic", "provider")).toBe(
      "GNOSYS_ANTHROPIC_KEY",
    );
  });

  it("lookup chain prefers global over provider", () => {
    process.env.GNOSYS_XAI_KEY = "provider-key";
    process.env.GNOSYS_GLOBAL_XAI_KEY = "global-key";
    expect(readFirstInChain("xai")).toBe("global-key");
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    expect(readFirstInChain("xai")).toBe("provider-key");
  });

  it("readFirstInChain falls through to legacy env", () => {
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    delete process.env.GNOSYS_XAI_KEY;
    process.env.XAI_API_KEY = "legacy-key";
    expect(readFirstInChain("xai")).toBe("legacy-key");
  });

  it("readFirstInChain falls through to GNOSYS_LLM_API_KEY for any provider", () => {
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    delete process.env.GNOSYS_XAI_KEY;
    delete process.env.XAI_API_KEY;
    process.env.GNOSYS_LLM_API_KEY = "generic-key";
    expect(readFirstInChain("xai")).toBe("generic-key");
    expect(readFirstInChain("custom")).toBe("generic-key");
  });

  it("buildApiKeyRequirements emits one global key per cloud provider", () => {
    const cfg = GnosysConfigSchema.parse({
      llm: { defaultProvider: "openrouter" },
      taskModels: {
        synthesis: { provider: "xai", model: "grok-4.3" },
      },
    });
    const reqs = buildApiKeyRequirementsFromConfig(cfg);
    expect(reqs).toEqual(
      expect.arrayContaining([
        { provider: "openrouter", scope: "global" },
        { provider: "xai", scope: "global" },
      ]),
    );
    expect(reqs).toHaveLength(2);
    expect(reqs.every((r) => r.scope === "global")).toBe(true);
  });

  it("lookup chain order is global then provider", () => {
    expect(apiKeyLookupChain("mistral")).toEqual([
      "GNOSYS_GLOBAL_MISTRAL_KEY",
      "GNOSYS_MISTRAL_KEY",
    ]);
  });

  it("maskKeySnippet shows first and last characters", () => {
    expect(maskKeySnippet("sk-ant-api03-abcdefghijklmnop")).toBe(
      "sk-a…mnop",
    );
  });

  it("listStoredKeySlots finds env global key", () => {
    process.env.GNOSYS_GLOBAL_OPENROUTER_KEY = "or-test-key-12345678";
    const cfg = GnosysConfigSchema.parse({
      llm: { defaultProvider: "openrouter" },
    });
    const slots = listStoredKeySlots(cfg, "openrouter");
    expect(slots.some((s) => s.service === "GNOSYS_GLOBAL_OPENROUTER_KEY")).toBe(
      true,
    );
    delete process.env.GNOSYS_GLOBAL_OPENROUTER_KEY;
  });

  it("detectKeyLocation returns the first env match with its variable name", () => {
    process.env.GNOSYS_OPENROUTER_KEY = "provider-key-1111";
    process.env.GNOSYS_GLOBAL_OPENROUTER_KEY = "global-key-2222";

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "env",
      envVarName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
      lastFour: "••••2222",
    });
  });

  it("detectKeyLocation falls back to the gnosys dotenv file", () => {
    writeGnosysDotenv("GNOSYS_GLOBAL_OPENROUTER_KEY=dotenv-key-3333\n");

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "dotenv",
      envVarName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
      lastFour: "••••3333",
    });
  });

  it("detectKeyLocation finds a global tier keychain key", () => {
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "keychain-key-4444",
    });

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "keychain",
      serviceName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
      lastFour: "••••4444",
    });
  });

  it("detectKeyLocation prefers global keychain over provider env", () => {
    process.env.GNOSYS_OPENROUTER_KEY = "provider-env-5555";
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "global-keychain-6666",
    });

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "keychain",
      serviceName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
      lastFour: "••••6666",
    });
  });

  it("detectKeyLocation falls through to the legacy env var tier", () => {
    process.env.OPENROUTER_API_KEY = "legacy-env-7777";

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "env",
      envVarName: "OPENROUTER_API_KEY",
      lastFour: "••••7777",
    });
  });

  it("detectKeyLocation falls through to the generic fallback env var", () => {
    process.env.GNOSYS_LLM_API_KEY = "generic-env-8888";

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "env",
      envVarName: "GNOSYS_LLM_API_KEY",
      lastFour: "••••8888",
    });
  });

  it("detectKeyLocation prefers env over dotenv in the same tier", () => {
    process.env.GNOSYS_GLOBAL_OPENROUTER_KEY = "global-env-9999";
    writeGnosysDotenv("GNOSYS_GLOBAL_OPENROUTER_KEY=global-dotenv-0000\n");

    expect(detectKeyLocation("openrouter")).toEqual({
      found: true,
      location: "env",
      envVarName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
      lastFour: "••••9999",
    });
  });

  it("detectKeyLocation does not require keys for local providers", () => {
    expect(detectKeyLocation("ollama")).toEqual({
      found: false,
      location: "none",
    });
    expect(detectKeyLocation("lmstudio")).toEqual({
      found: false,
      location: "none",
    });
  });
});
