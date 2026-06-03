import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  apiKeyLookupChain,
  apiKeyServiceName,
  buildApiKeyRequirementsFromConfig,
  listStoredKeySlots,
  maskKeySnippet,
  readFirstInChain,
} from "../lib/apiKeyVault.js";
import { GnosysConfigSchema } from "../lib/config.js";

describe("apiKeyVault", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  beforeEach(() => {
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    delete process.env.GNOSYS_XAI_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GNOSYS_LLM_API_KEY;
  });

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

  it("readFirstInChain falls through to legacy and generic env", () => {
    delete process.env.GNOSYS_GLOBAL_XAI_KEY;
    delete process.env.GNOSYS_XAI_KEY;
    process.env.XAI_API_KEY = "legacy-key";
    expect(readFirstInChain("xai")).toBe("legacy-key");
    delete process.env.XAI_API_KEY;
    process.env.GNOSYS_LLM_API_KEY = "generic-key";
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
});
