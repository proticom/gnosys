/**
 * API key storage and resolution for Gnosys LLM providers.
 *
 * Keychain / env service names (also used as GNOSYS_*_KEY env vars):
 *   - Global:    GNOSYS_GLOBAL_<PROVIDER>_KEY    (one key for all tasks using that provider)
 *   - Provider:  GNOSYS_<PROVIDER>_KEY           (legacy default / fallback)
 */

import { execSync } from "child_process";
import dotenv from "dotenv";
import fsSync from "fs";
import os from "os";
import path from "path";
import type { Interface as ReadlineInterface } from "readline/promises";
import {
  type GnosysConfig,
  type LLMProviderName,
  resolveTaskModel,
  getProviderModel,
} from "./config.js";

export type ApiKeyScope = "global" | "provider";
export type RoutableTask =
  | "structuring"
  | "synthesis"
  | "vision"
  | "transcription";

export type LlmTaskName = RoutableTask | "dream";

export interface ApiKeyRequirement {
  provider: LLMProviderName;
  scope: ApiKeyScope;
}

const LEGACY_ENV: Partial<Record<LLMProviderName, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const CLOUD_TASKS: RoutableTask[] = [
  "structuring",
  "synthesis",
  "vision",
  "transcription",
];

export function providerNeedsApiKey(provider: string): boolean {
  return provider !== "ollama" && provider !== "lmstudio" && provider !== "skip";
}

function providerSlug(provider: LLMProviderName): string {
  return provider === "custom" ? "CUSTOM" : provider.toUpperCase();
}

/** Keychain service / env var name for a specific scope. */
export function apiKeyServiceName(
  provider: LLMProviderName,
  scope: ApiKeyScope,
): string {
  const slug = providerSlug(provider);
  if (scope === "global") {
    return `GNOSYS_GLOBAL_${slug}_KEY`;
  }
  return `GNOSYS_${slug}_KEY`;
}

/** Lookup order: global → provider default (legacy/generic via readFirstInChain). */
export function apiKeyLookupChain(provider: LLMProviderName): string[] {
  return [
    apiKeyServiceName(provider, "global"),
    apiKeyServiceName(provider, "provider"),
  ];
}

function configApiKey(config: GnosysConfig, provider: LLMProviderName): string | undefined {
  switch (provider) {
    case "anthropic":
      return config.llm.anthropic.apiKey;
    case "openai":
      return config.llm.openai.apiKey;
    case "groq":
      return config.llm.groq.apiKey;
    case "xai":
      return config.llm.xai.apiKey;
    case "mistral":
      return config.llm.mistral.apiKey;
    case "openrouter":
      return config.llm.openrouter.apiKey;
    case "custom":
      return config.llm.custom?.apiKey;
    default:
      return undefined;
  }
}

function readFromKeychain(service: string): string | undefined {
  if (process.env.VITEST) return undefined;
  if (process.platform === "darwin") {
    try {
      return execSync(
        `security find-generic-password -a "$USER" -s "${service}" -w 2>/dev/null`,
        { stdio: "pipe", encoding: "utf-8", timeout: 2000 },
      ).trim() || undefined;
    } catch {
      return undefined;
    }
  }
  if (process.platform === "linux") {
    try {
      return execSync(
        `secret-tool lookup service gnosys account ${service} 2>/dev/null`,
        { stdio: "pipe", encoding: "utf-8", timeout: 2000 },
      ).trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Read a secret directly from the secure store, ignoring env vars. */
export function readSecureStoreSecret(service: string): string | undefined {
  return readFromKeychain(service);
}

/** Read a secret from env or secure store by service name. */
export function readStoredSecret(service: string): string | undefined {
  if (process.env[service]) return process.env[service];
  return readSecureStoreSecret(service);
}

function keyLocationChain(provider: string): Array<{
  envVarName: string;
  serviceName?: string;
}> {
  const slug = provider.toUpperCase();
  const globalEnvVar = `GNOSYS_GLOBAL_${slug}_KEY`;
  const providerEnvVar = `GNOSYS_${slug}_KEY`;
  return [
    {
      envVarName: globalEnvVar,
      serviceName: globalEnvVar,
    },
    {
      envVarName: providerEnvVar,
      serviceName: providerEnvVar,
    },
    { envVarName: `${slug}_API_KEY` },
    { envVarName: "GNOSYS_LLM_API_KEY" },
  ];
}

function maskedLastFour(key: string): string {
  return `••••${key.trim().slice(-4)}`;
}

function readDotenvKeys(): Record<string, string> {
  try {
    const envPath = path.join(
      process.env.HOME ?? os.homedir(),
      ".config",
      "gnosys",
      ".env",
    );
    return dotenv.parse(fsSync.readFileSync(envPath, "utf-8"));
  } catch {
    return {};
  }
}

export function detectKeyLocation(provider: string): {
  found: boolean;
  location: "keychain" | "env" | "dotenv" | "none";
  serviceName?: string;
  envVarName?: string;
  lastFour?: string;
} {
  if (!providerNeedsApiKey(provider)) {
    return { found: false, location: "none" };
  }

  const chain = keyLocationChain(provider);
  const dotenvKeys = readDotenvKeys();

  for (const { envVarName, serviceName } of chain) {
    const envKey = process.env[envVarName]?.trim();
    if (envKey) {
      return {
        found: true,
        location: "env",
        envVarName,
        lastFour: maskedLastFour(envKey),
      };
    }

    if (serviceName) {
      const storedKey = readStoredSecret(serviceName)?.trim();
      if (storedKey) {
        return {
          found: true,
          location: "keychain",
          serviceName,
          lastFour: maskedLastFour(storedKey),
        };
      }
    }

    const dotenvKey = dotenvKeys[envVarName]?.trim();
    if (dotenvKey) {
      return {
        found: true,
        location: "dotenv",
        envVarName,
        lastFour: maskedLastFour(dotenvKey),
      };
    }
  }

  return { found: false, location: "none" };
}

/** First non-empty secret in the lookup chain. */
export function readFirstInChain(provider: LLMProviderName): string | undefined {
  for (const service of apiKeyLookupChain(provider)) {
    const v = readStoredSecret(service);
    if (v) return v;
  }
  const legacy = LEGACY_ENV[provider];
  if (legacy && process.env[legacy]) return process.env[legacy];
  if (process.env.GNOSYS_LLM_API_KEY) return process.env.GNOSYS_LLM_API_KEY;
  return undefined;
}

/** Mask for display: first 4 + ellipsis + last 4 characters. */
export function maskKeySnippet(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return trimmed.length <= 2 ? "••" : `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/**
 * Where a secret is stored (Keychain, env var name, gnosys.json, or .env file).
 */
export function detectSecretSource(
  service: string,
  legacyEnv?: string,
): string {
  if (process.platform === "darwin" && !process.env.VITEST) {
    try {
      const result = execSync(
        `security find-generic-password -a "$USER" -s "${service}" -w 2>/dev/null`,
        { stdio: "pipe", encoding: "utf-8", timeout: 2000 },
      ).trim();
      if (result) return "macOS Keychain";
    } catch {
      // not in keychain
    }
  }
  if (process.platform === "linux" && !process.env.VITEST) {
    try {
      const result = execSync(
        `secret-tool lookup service gnosys account ${service} 2>/dev/null`,
        { stdio: "pipe", encoding: "utf-8", timeout: 2000 },
      ).trim();
      if (result) return "GNOME Keyring";
    } catch {
      // not in keyring
    }
  }
  if (process.env[service]) return `$${service}`;
  if (legacyEnv && process.env[legacyEnv]) return `$${legacyEnv}`;
  try {
    const envPath = path.join(os.homedir(), ".config", "gnosys", ".env");
    const content = fsSync.readFileSync(envPath, "utf-8");
    if (content.includes(`${service}=`)) return "~/.config/gnosys/.env";
  } catch {
    // no .env
  }
  return "";
}

export interface StoredKeySlot {
  service: string;
  scope: ApiKeyScope;
  source: string;
  /** Present only when a value exists at this slot */
  preview?: string;
}

/**
 * List every key slot for a provider that currently holds a value.
 */
export function listStoredKeySlots(
  config: GnosysConfig,
  provider: LLMProviderName,
): StoredKeySlot[] {
  const slots: StoredKeySlot[] = [];
  const fromConfig = configApiKey(config, provider);
  if (fromConfig) {
    slots.push({
      service: "gnosys.json",
      scope: "provider",
      source: "gnosys.json (llm block)",
      preview: maskKeySnippet(fromConfig),
    });
  }

  const seen = new Set<string>();
  const push = (slot: Omit<StoredKeySlot, "preview">, raw: string) => {
    if (seen.has(slot.service)) return;
    seen.add(slot.service);
    const source = slot.source || detectSecretSource(slot.service, LEGACY_ENV[provider]) || "stored";
    slots.push({ ...slot, source, preview: maskKeySnippet(raw) });
  };

  const globalSvc = apiKeyServiceName(provider, "global");
  const globalVal = readStoredSecret(globalSvc);
  if (globalVal) {
    push(
      { service: globalSvc, scope: "global", source: detectSecretSource(globalSvc) },
      globalVal,
    );
  }

  const providerSvc = apiKeyServiceName(provider, "provider");
  const providerVal = readStoredSecret(providerSvc);
  if (providerVal) {
    push(
      { service: providerSvc, scope: "provider", source: detectSecretSource(providerSvc) },
      providerVal,
    );
  }

  const legacy = LEGACY_ENV[provider];
  if (legacy && process.env[legacy] && !seen.has(legacy)) {
    slots.push({
      service: legacy,
      scope: "provider",
      source: `$${legacy}`,
      preview: maskKeySnippet(process.env[legacy]!),
    });
  }
  if (process.env.GNOSYS_LLM_API_KEY && !seen.has("GNOSYS_LLM_API_KEY")) {
    slots.push({
      service: "GNOSYS_LLM_API_KEY",
      scope: "provider",
      source: "$GNOSYS_LLM_API_KEY",
      preview: maskKeySnippet(process.env.GNOSYS_LLM_API_KEY),
    });
  }

  return slots;
}

/** Delete a secret from Keychain / GNOME Keyring (not process env). */
export function deleteStoredSecret(service: string): boolean {
  if (service === "gnosys.json") return false;
  if (process.env.VITEST) return false;
  if (process.platform === "darwin") {
    try {
      execSync(
        `security delete-generic-password -a "$USER" -s "${service}" 2>/dev/null`,
        { stdio: "pipe" },
      );
      return true;
    } catch {
      return false;
    }
  }
  if (process.platform === "linux") {
    try {
      execSync(`secret-tool clear service gnosys account ${service}`, {
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Resolve API key for a provider. */
export function getApiKeyForProviderFromConfig(
  config: GnosysConfig,
  provider: LLMProviderName,
): string | undefined {
  const fromConfig = configApiKey(config, provider);
  if (fromConfig) return fromConfig;
  return readFirstInChain(provider);
}

export function writeApiKeyToKeychain(service: string, key: string): boolean {
  if (process.platform !== "darwin") return false;
  try {
    execSync(
      `security add-generic-password -a "$USER" -s "${service}" -w "${key.replace(/"/g, '\\"')}" -U`,
      { stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

export function writeApiKeyToSecretTool(
  service: string,
  key: string,
  label: string,
): boolean {
  if (process.platform === "darwin") return false;
  try {
    execSync("which secret-tool", { stdio: "pipe" });
    execSync(
      `printf "%s" "${key.replace(/"/g, '\\"')}" | secret-tool store --label="${label}" service gnosys account ${service}`,
      { stdio: "pipe", shell: "/bin/sh" },
    );
    return true;
  } catch {
    return false;
  }
}

export function storeApiKeySecret(service: string, key: string, provider: string): boolean {
  if (process.platform === "darwin") {
    return writeApiKeyToKeychain(service, key);
  }
  if (process.platform === "linux") {
    return writeApiKeyToSecretTool(service, key, `Gnosys ${provider}`);
  }
  return false;
}

function requirementLabel(req: ApiKeyRequirement): string {
  if (req.scope === "global") {
    return `all tasks → ${req.provider}`;
  }
  return req.provider;
}

function dedupeRequirements(reqs: ApiKeyRequirement[]): ApiKeyRequirement[] {
  const seen = new Set<string>();
  const out: ApiKeyRequirement[] = [];
  for (const r of reqs) {
    const id = apiKeyServiceName(r.provider, r.scope);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

/**
 * Build key requirements from effective routing — one global key per cloud provider in use.
 */
export function buildApiKeyRequirementsFromConfig(
  config: GnosysConfig,
): ApiKeyRequirement[] {
  const providers = new Set<LLMProviderName>();

  for (const task of CLOUD_TASKS) {
    const { provider } = resolveTaskModel(config, task);
    if (providerNeedsApiKey(provider)) {
      providers.add(provider);
    }
  }

  if (config.dream?.enabled) {
    const dreamProvider = (config.dream.provider ?? "ollama") as LLMProviderName;
    if (providerNeedsApiKey(dreamProvider)) {
      providers.add(dreamProvider);
    }
  }

  if (providers.size === 0) return [];

  return dedupeRequirements(
    [...providers].map((provider) => ({
      provider,
      scope: "global" as const,
    })),
  );
}

/**
 * Prompt for missing keys and store in Keychain / GNOME Keyring.
 */
export async function ensureApiKeys(
  rl: ReadlineInterface,
  requirements: ApiKeyRequirement[],
  askInput: (rl: ReadlineInterface, prompt: string) => Promise<string>,
  opts?: {
    maskKey?: (key: string) => string;
    warn?: string;
    check?: string;
    cross?: string;
    dim?: string;
    reset?: string;
  },
): Promise<number> {
  const reqs = dedupeRequirements(requirements).filter((r) =>
    providerNeedsApiKey(r.provider),
  );
  if (reqs.length === 0) return 0;

  const WARN = opts?.warn ?? "⚠";
  const CHECK = opts?.check ?? "✓";
  const CROSS = opts?.cross ?? "✗";
  const DIM = opts?.dim ?? "";
  const RESET = opts?.reset ?? "";
  const maskKey = opts?.maskKey ?? ((k: string) =>
    k.length <= 8 ? "***" : `${k.slice(0, 3)}***${k.slice(-2)}`);

  let saved = 0;
  console.log();
  console.log(`  ${WARN} API keys — stored in Keychain with scoped names${RESET}`);
  console.log(`  ${DIM}Global = one key for all tasks using that provider${RESET}`);
  console.log();

  for (const req of reqs) {
    const service = apiKeyServiceName(req.provider, req.scope);
    if (readStoredSecret(service)) {
      console.log(`  ${CHECK} ${requirementLabel(req)} ${DIM}(${service})${RESET}`);
      continue;
    }

    const label = requirementLabel(req);
    console.log(`  ${DIM}Keychain: ${service}${RESET}`);
    const key = await askInput(rl, `  API key for ${label}`);
    if (!key) {
      console.log(`  ${DIM}  skipped ${label}${RESET}`);
      continue;
    }

    if (storeApiKeySecret(service, key, req.provider)) {
      const store =
        process.platform === "darwin"
          ? "macOS Keychain"
          : "GNOME Keyring";
      console.log(`  ${CHECK} ${label} → ${store} (${maskKey(key)})`);
      saved++;
    } else {
      console.log(`  ${CROSS} Could not write ${service} to secure store`);
    }
  }

  return saved;
}

/** Effective routing map used for key collection. */
export function buildEffectiveRouting(
  config: GnosysConfig,
): Record<string, { provider: LLMProviderName; model: string }> {
  const out: Record<string, { provider: LLMProviderName; model: string }> = {};
  for (const task of CLOUD_TASKS) {
    out[task] = resolveTaskModel(config, task);
  }
  const dreamProvider = (config.dream?.provider ?? "ollama") as LLMProviderName;
  out.dream = {
    provider: dreamProvider,
    model:
      config.dream?.model ??
      getProviderModel(config, dreamProvider),
  };
  return out;
}
