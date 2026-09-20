/**
 * CC.1 — coverage for GnosysIngestion.ingest() (LLM structuring path).
 * NEW file only; does not modify existing ingest*.test.ts files.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { GnosysStore } from "../lib/store.js";
import { GnosysTagRegistry } from "../lib/tags.js";
import { GnosysIngestion } from "../lib/ingest.js";
import { DEFAULT_CONFIG, GnosysConfigSchema, type GnosysConfig } from "../lib/config.js";
vi.mock("child_process", async (original) => ({
  ...await original<typeof import("child_process")>(),
  execSync: vi.fn(() => { throw new Error("No external keychain entries"); }),
}));

function reply(text: string): void {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 }));
}
let originalEnv: NodeJS.ProcessEnv;
function availableConfig(): GnosysConfig {
  return GnosysConfigSchema.parse({ llm: { defaultProvider: "openai", openai: { apiKey: "fixture-openai-key", model: "fixture-model" } }, llmRetryAttempts: 1 });
}

let tmpDir: string;
let store: GnosysStore;
let tagRegistry: GnosysTagRegistry;

function configWithProvider(name: GnosysConfig["llm"]["defaultProvider"]): GnosysConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.llm.defaultProvider = name;
  return cfg;
}

async function seedTags(dir: string) {
  const defaultTags = {
    domain: ["architecture", "auth", "testing"],
    type: ["decision", "concept"],
    concern: ["dx", "scalability"],
  };
  await fs.mkdir(path.join(dir, ".config"), { recursive: true });
  await fs.writeFile(
    path.join(dir, ".config", "tags.json"),
    JSON.stringify(defaultTags, null, 2),
    "utf-8",
  );
}

beforeEach(async () => {
  originalEnv = { ...process.env };
  for (const key of Object.keys(process.env)) if (/(API_KEY|_KEY)$/.test(key)) delete process.env[key];
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Unexpected provider request"); }));
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-cc1-"));
  process.env.GNOSYS_HOME = tmpDir;
  process.env.GNOSYS_CONFIG_DIR = path.join(tmpDir, "config");
  vi.spyOn(os, "homedir").mockReturnValue(tmpDir);
  store = new GnosysStore(tmpDir);
  await store.init();
  await seedTags(tmpDir);
  tagRegistry = new GnosysTagRegistry(tmpDir);
  await tagRegistry.load();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = originalEnv;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("GnosysIngestion.ingest (LLM path)", () => {
  describe("provider availability getters", () => {
    it("reports unavailable when getLLMProvider throws at construction", () => {
      const ingestion = new GnosysIngestion(store, tagRegistry, configWithProvider("anthropic"));
      expect(ingestion.isLLMAvailable).toBe(false);
      expect(ingestion.providerName).toBe("none");
    });

    it("reports available when a provider is resolved", () => {
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      expect(ingestion.isLLMAvailable).toBe(true);
      expect(ingestion.providerName).toBe("openai");
    });
  });

  describe("provider-missing error paths", () => {

    async function expectMissingProvider(
      // v6.0.0 anthropic default removed — defaultProvider is now optional in
      // the schema, so the union would include undefined; tests pass names.
      providerName: GnosysConfig["llm"]["defaultProvider"],
      snippet: string,
    ) {
      const cfg = configWithProvider(providerName);
      const ingestion = new GnosysIngestion(store, tagRegistry, cfg);
      await expect(ingestion.ingest("raw input")).rejects.toThrow(snippet);
    }

    it("anthropic — mentions ANTHROPIC_API_KEY", async () => {
      await expectMissingProvider("anthropic", "ANTHROPIC_API_KEY");
    });

    it("openai — mentions OPENAI_API_KEY", async () => {
      await expectMissingProvider("openai", "OPENAI_API_KEY");
    });

    it("groq — mentions GROQ_API_KEY", async () => {
      await expectMissingProvider("groq", "GROQ_API_KEY");
    });

    it("xai — mentions XAI_API_KEY", async () => {
      await expectMissingProvider("xai", "XAI_API_KEY");
    });

    it("mistral — mentions MISTRAL_API_KEY", async () => {
      await expectMissingProvider("mistral", "MISTRAL_API_KEY");
    });

    it("custom — mentions GNOSYS_CUSTOM_KEY", async () => {
      await expectMissingProvider("custom", "GNOSYS_CUSTOM_KEY");
    });

    it("ollama reports a failed local endpoint", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response("local server unavailable", { status: 503 }));
      const cfg = configWithProvider("ollama");
      cfg.llmRetryAttempts = 1;
      const ingestion = new GnosysIngestion(store, tagRegistry, cfg);
      await expect(ingestion.ingest("raw")).rejects.toThrow("503");
    });

    it("lmstudio reports a failed local endpoint", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response("local server unavailable", { status: 503 }));
      const cfg = configWithProvider("lmstudio");
      cfg.llmRetryAttempts = 1;
      const ingestion = new GnosysIngestion(store, tagRegistry, cfg);
      await expect(ingestion.ingest("raw")).rejects.toThrow("503");
    });

    it("rejects unknown providers at the config boundary", () => {
      expect(() => GnosysConfigSchema.parse({ llm: { defaultProvider: "not-a-real-provider" } })).toThrow("Invalid option");
    });
  });

  describe("JSON parsing variants", () => {
    it("parses bare JSON from the LLM response", async () => {
      reply(
        JSON.stringify({
          title: "Bare JSON",
          category: "decisions",
          tags: { domain: ["auth"] },
          relevance: "auth login",
          content: "Body text",
          confidence: 0.9,
          filename: "bare-json",
        }),
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("some raw note");
      expect(result.title).toBe("Bare JSON");
      expect(result.tags.domain).toEqual(["auth"]);
    });

    it("parses markdown-fenced JSON", async () => {
      reply(
        "```json\n" +
          JSON.stringify({
            title: "Fenced JSON",
            category: "concepts",
            tags: { type: ["concept"] },
            content: "Fenced body",
          }) +
          "\n```",
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result.title).toBe("Fenced JSON");
    });

    it("parses plain-fenced JSON without json language tag", async () => {
      reply(
        "```\n" +
          JSON.stringify({
            title: "Plain Fence",
            category: "concepts",
            tags: {},
            content: "Plain body",
          }) +
          "\n```",
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result.title).toBe("Plain Fence");
    });

    it("parses JSON embedded in prose", async () => {
      reply(
        "Here is the structured memory:\n```json\n" +
          JSON.stringify({
            title: "Mixed Prose",
            category: "decisions",
            tags: { domain: ["testing"] },
            content: "Mixed body",
          }) +
          "\n```\nDone.",
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result.title).toBe("Mixed Prose");
    });
  });

  describe("prototype-pollution sanitization", () => {
    it("strips __proto__, constructor, and prototype keys from LLM JSON", async () => {
      reply('{"__proto__":{"title":"Polluted title","content":"Polluted content"},"constructor":{"evil":true},"prototype":{"bad":true}}');
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result).toMatchObject({ title: "Untitled Memory", content: "raw", category: "uncategorized", tags: {}, confidence: 0.7 });
      expect(Object.hasOwn(result as object, "__proto__")).toBe(false);
      expect(Object.hasOwn(result as object, "constructor")).toBe(false);
      expect(Object.hasOwn(result as object, "prototype")).toBe(false);
    });
  });

  describe("tag validation and proposed new tags", () => {
    it("keeps registry tags and proposes unknown tags", async () => {
      reply(
        JSON.stringify({
          title: "Tag Mix",
          category: "decisions",
          tags: {
            domain: ["auth", "brand-new-domain-tag"],
            type: ["decision", "unknown-type-tag"],
          },
          content: "Tag body",
        }),
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result.tags.domain).toEqual(["auth"]);
      expect(result.tags.type).toEqual(["decision"]);
      expect(result.proposedNewTags).toEqual(
        expect.arrayContaining([
          { category: "domain", tag: "brand-new-domain-tag" },
          { category: "type", tag: "unknown-type-tag" },
        ]),
      );
    });

    it("includes explicit proposed_new_tags from the LLM response", async () => {
      reply(
        JSON.stringify({
          title: "Explicit Proposals",
          category: "concepts",
          tags: {},
          content: "Body",
          proposed_new_tags: [{ category: "concern", tag: "latency" }],
        }),
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("raw");
      expect(result.proposedNewTags).toEqual([{ category: "concern", tag: "latency" }]);
    });
  });

  describe("field defaults", () => {
    it("applies defaults when the LLM returns minimal JSON", async () => {
      reply(JSON.stringify({ title: "Minimal Title" }));
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const result = await ingestion.ingest("fallback raw content");
      expect(result.category).toBe("uncategorized");
      expect(result.tags).toEqual({});
      expect(result.relevance).toBe("");
      expect(result.content).toBe("fallback raw content");
      expect(result.confidence).toBe(0.7);
      expect(result.filename).toBe("minimal-title");
    });
  });

  describe("configOverride", () => {
    it("resolves a fresh provider from configOverride", async () => {
      reply(
        JSON.stringify({
          title: "Override Path",
          category: "concepts",
          tags: {},
          content: "Override body",
        }),
      );
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const override = availableConfig();
      override.taskModels = { structuring: { provider: "openai", model: "override-model" } };
      const result = await ingestion.ingest("raw", override);
      expect(result.title).toBe("Override Path");
      expect(fetch).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({ body: expect.stringContaining('"model":"override-model"') }));
    });

    it("throws provider-missing when configOverride has no available provider", async () => {
      const ingestion = new GnosysIngestion(store, tagRegistry, availableConfig());
      const override = configWithProvider("groq");
      await expect(ingestion.ingest("raw", override)).rejects.toThrow("GROQ_API_KEY");
    });
  });
});
