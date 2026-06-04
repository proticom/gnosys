import { createInterface, type Interface as ReadlineInterface } from "readline/promises";
import { stdin, stdout } from "process";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import {
  deleteStoredSecret,
  detectKeyLocation,
  providerNeedsApiKey,
  readStoredSecret,
  storeApiKeySecret,
} from "./apiKeyVault.js";
import {
  askInput,
  askPassword,
  askYesNo,
  printInfo,
  printStatus,
  writeApiKey,
} from "./setup.js";
import { validateModel } from "./modelValidation.js";

export interface KeysSetupOpts {
  rl?: ReadlineInterface;
}

export type KnownKeyProvider =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "xai"
  | "google"
  | "cohere"
  | "mistral"
  | "groq"
  | "ollama"
  | "lmstudio"
  | "custom";

export interface ProviderKeyStatus {
  provider: KnownKeyProvider;
  found: boolean;
  location: "keychain" | "env" | "dotenv" | "none";
  envVarName?: string;
  serviceName?: string;
  lastFour?: string;
}

const PROVIDERS: KnownKeyProvider[] = [
  "anthropic",
  "openrouter",
  "openai",
  "xai",
  "google",
  "cohere",
  "mistral",
  "groq",
  "ollama",
  "lmstudio",
  "custom",
];

const LOCAL_PROVIDERS = new Set<KnownKeyProvider>(["ollama", "lmstudio"]);
const TABLE_RULE = "═══════════════════════════════════════════════════════════════";
const TABLE_SEPARATOR = "──────────────────────────────────────────────────────────────";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

type KeyLocationKind = "keychain" | "env" | "dotenv";

interface StoredKeyLocation {
  location: KeyLocationKind;
  label: string;
  value: string;
  envVarName?: string;
  serviceName?: string;
  deletable: boolean;
}

const DEFAULT_MODELS: Record<KnownKeyProvider, string> = {
  anthropic: "claude-haiku-4-5",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
  openai: "gpt-5.4-mini",
  xai: "grok-4.20",
  google: "gemini-2.5-flash",
  cohere: "command-r-plus",
  mistral: "mistral-small-4",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3.2",
  lmstudio: "default",
  custom: "",
};

const VALIDATION_ENDPOINTS: Partial<Record<KnownKeyProvider, string>> = {
  anthropic: "/v1/messages",
  openrouter: "/api/v1/chat/completions",
  openai: "/v1/chat/completions",
  xai: "/v1/chat/completions",
  mistral: "/v1/chat/completions",
  groq: "/openai/v1/chat/completions",
  ollama: "/api/chat",
  lmstudio: "/v1/chat/completions",
};

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
}

function color(token: string, text: string): string {
  return supportsColor() ? `${token}${text}${RESET}` : text;
}

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function statusLabel(provider: ProviderKeyStatus): string {
  if (LOCAL_PROVIDERS.has(provider.provider)) {
    return "N/A (local)";
  }
  if (provider.found) {
    return color(GREEN, "✓ Present");
  }
  return color(RED, "✗ Missing");
}

function locationLabel(provider: ProviderKeyStatus): string {
  switch (provider.location) {
    case "keychain":
      return "Keychain";
    case "dotenv":
      return ".env";
    case "env":
      return provider.envVarName ? `Env Var (${provider.envVarName})` : "Env Var";
    case "none":
      return "—";
  }
}

function providerSlug(provider: string): string {
  return provider.toUpperCase();
}

function globalEnvVar(provider: string): string {
  return `GNOSYS_GLOBAL_${providerSlug(provider)}_KEY`;
}

function providerEnvVar(provider: string): string {
  return `GNOSYS_${providerSlug(provider)}_KEY`;
}

function legacyEnvVar(provider: string): string {
  return `${providerSlug(provider)}_API_KEY`;
}

function gnosysEnvPath(): string {
  return path.join(process.env.HOME ?? os.homedir(), ".config", "gnosys", ".env");
}

function keyLookupEntries(provider: string): Array<{ envVarName: string; serviceName?: string }> {
  const globalName = globalEnvVar(provider);
  const providerName = providerEnvVar(provider);
  return [
    { envVarName: globalName, serviceName: globalName },
    { envVarName: providerName, serviceName: providerName },
    { envVarName: legacyEnvVar(provider) },
    { envVarName: "GNOSYS_LLM_API_KEY" },
  ];
}

function readDotenvKeys(): Record<string, string> {
  try {
    return dotenv.parse(fsSync.readFileSync(gnosysEnvPath(), "utf-8"));
  } catch {
    return {};
  }
}

async function removeDotenvKeys(envVarNames: string[]): Promise<number> {
  const envPath = gnosysEnvPath();
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    return 0;
  }

  const names = new Set(envVarNames);
  let removed = 0;
  const lines = content.split("\n").filter((line) => {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (key && names.has(key)) {
      removed++;
      return false;
    }
    return true;
  });

  await fs.writeFile(envPath, lines.join("\n").replace(/\n*$/, "\n"), "utf-8");
  await fs.chmod(envPath, 0o600);
  return removed;
}

function keyPreview(key?: string): string {
  const trimmed = key?.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)} (last 2)`;
  return `${trimmed.slice(0, 8)}-••••••••••••••••••••••••••••••••••${trimmed.slice(-4)} (last 4)`;
}

function listKeyLocations(provider: KnownKeyProvider): StoredKeyLocation[] {
  if (!providerNeedsApiKey(provider)) return [];

  const dotenvKeys = readDotenvKeys();
  const locations: StoredKeyLocation[] = [];

  for (const { envVarName, serviceName } of keyLookupEntries(provider)) {
    const envValue = process.env[envVarName]?.trim();
    if (envValue) {
      locations.push({
        location: "env",
        label: `Env Var (${envVarName})`,
        value: envValue,
        envVarName,
        deletable: false,
      });
    }

    if (serviceName) {
      const secret = readStoredSecret(serviceName)?.trim();
      if (secret) {
        locations.push({
          location: "keychain",
          label: "Keychain",
          value: secret,
          serviceName,
          deletable: true,
        });
      }
    }

    const dotenvValue = dotenvKeys[envVarName]?.trim();
    if (dotenvValue) {
      locations.push({
        location: "dotenv",
        label: ".env",
        value: dotenvValue,
        envVarName,
        deletable: true,
      });
    }
  }

  return locations;
}

function currentKeyLocation(provider: KnownKeyProvider): StoredKeyLocation | undefined {
  const detected = detectKeyLocation(provider);
  if (!detected.found) return undefined;
  return listKeyLocations(provider).find((location) => {
    if (detected.location === "keychain") {
      return location.location === "keychain" && location.serviceName === detected.serviceName;
    }
    if (detected.location === "dotenv") {
      return location.location === "dotenv" && location.envVarName === detected.envVarName;
    }
    if (detected.location === "env") {
      return location.location === "env" && location.envVarName === detected.envVarName;
    }
    return false;
  });
}

function renderProviderDetail(provider: KnownKeyProvider): string {
  const detected = detectKeyLocation(provider);
  const current = currentKeyLocation(provider);
  const locations = listKeyLocations(provider);
  const extraLocations = locations.filter((location) => location !== current);

  const lines = [
    TABLE_RULE,
    `  ${provider.toUpperCase()}`,
    TABLE_RULE,
    "",
    "Current key:",
  ];

  if (LOCAL_PROVIDERS.has(provider)) {
    lines.push(
      "  Status:    N/A (local provider)",
      "  Stored in: —",
      "  Value:     —",
      "",
      "Actions:",
      "  [t]  Test local provider",
      "  [b]  Back to list",
      "",
    );
    return lines.join("\n");
  }

  lines.push(
    `  Status:    ${detected.found ? color(GREEN, "✓ Present") : color(RED, "✗ Missing")}`,
    `  Stored in: ${detected.found ? locationLabel({ provider, ...detected }) : "—"}`,
    `  Value:     ${keyPreview(current?.value)}`,
  );

  if (extraLocations.length > 0) {
    lines.push("", "Also found:");
    for (const location of extraLocations) {
      lines.push(`  - ${location.label}: ${keyPreview(location.value)}`);
    }
  }

  lines.push(
    "",
    "Actions:",
    "  [c]  Copy to Keychain (recommended)",
    "  [u]  Update key",
    "  [d]  Delete key",
    "  [t]  Test/validate key",
    "  [b]  Back to list",
    "",
  );

  return lines.join("\n");
}

async function validateProviderKey(provider: KnownKeyProvider, key: string): Promise<boolean> {
  const model = DEFAULT_MODELS[provider];
  if (!model) {
    printStatus("warn", `validation is not configured for ${provider}`);
    return false;
  }

  const result = await validateModel(provider, model, key);
  if (result.ok) {
    console.log();
    console.log("✓ Key is valid");
    console.log(`Provider:  ${provider}`);
    console.log(`Test API:  ${VALIDATION_ENDPOINTS[provider] ?? "/"} (HTTP 200)`);
    return true;
  }

  console.log();
  console.log("✗ Key validation failed");
  console.log(`Provider:  ${provider}`);
  console.log(`Error:     ${formatValidationError(result.error)}`);
  return false;
}

function formatValidationError(error?: string): string {
  if (!error) return "Unknown validation error";
  const match = error.match(/^HTTP\s+(\d+)(?::\s*)?(.*)$/i);
  if (!match) return error;

  const code = Number.parseInt(match[1]!, 10);
  const message = match[2]?.trim();
  const status = HTTP_STATUS_TEXT[code] ?? "HTTP Error";
  return message ? `${code} ${status} - ${message}` : `${code} ${status}`;
}

async function chooseKeyDestination(
  rl: ReadlineInterface,
  provider: KnownKeyProvider,
  key: string,
): Promise<void> {
  console.log();
  console.log("Where should I store this key?");
  console.log();
  console.log("  1. OS Keychain (macOS/Linux/Windows secure store) [recommended]");
  console.log("  2. Config file (~/.config/gnosys/.env)");
  console.log("  3. Don't store — I'll set it as an environment variable myself");
  console.log();

  const choice = (await askInput(rl, "Select", { default: "1" })).trim();
  if (choice === "2") {
    await writeApiKey(provider, key, { scope: "global" });
    printStatus("ok", "key saved", `~/.config/gnosys/.env · ${globalEnvVar(provider)}`);
    return;
  }

  if (choice === "3") {
    printInfo(`Set ${globalEnvVar(provider)} in your shell environment.`);
    printInfo("No key was stored by Gnosys.");
    return;
  }

  const service = globalEnvVar(provider);
  if (storeApiKeySecret(service, key, provider)) {
    printStatus("ok", "key saved to secure store", service);
  } else {
    printStatus("fail", "could not write to secure store");
  }
}

async function copyToKeychain(
  rl: ReadlineInterface,
  provider: KnownKeyProvider,
): Promise<void> {
  const current = currentKeyLocation(provider);
  if (!current) {
    printStatus("warn", `no key found for ${provider}`);
    return;
  }
  if (current.location === "keychain") {
    printStatus("ok", "key is already in Keychain");
    return;
  }

  if (!(await validateProviderKey(provider, current.value))) {
    printStatus("warn", "copy cancelled because validation failed");
    return;
  }

  console.log();
  console.log("Copy this key to Keychain (recommended)?");
  console.log();
  console.log("This will:");
  console.log("✓ Store the key securely in macOS Keychain (encrypted)");
  if (current.location === "dotenv") {
    console.log("✓ Remove the key from ~/.config/gnosys/.env");
  }
  console.log();
  console.log("✗ WARNING: Environment variables are checked before Keychain.");
  console.log(`          Manually unset ${globalEnvVar(provider)}, ${providerEnvVar(provider)},`);
  console.log(`          and ${legacyEnvVar(provider)} if they exist in your shell.`);
  console.log();

  if (!(await askYesNo(rl, "Continue?", false))) {
    printStatus("warn", "copy cancelled");
    return;
  }

  const service = globalEnvVar(provider);
  if (!storeApiKeySecret(service, current.value, provider)) {
    printStatus("fail", "could not write to secure store");
    return;
  }

  if (current.location === "dotenv" && current.envVarName) {
    await removeDotenvKeys([current.envVarName]);
  }

  printStatus("ok", "copied to Keychain", service);
  if (current.location === "env" && current.envVarName) {
    printStatus("warn", `manually unset ${current.envVarName}`, "environment variables cannot be deleted here");
  }
}

async function updateKey(
  rl: ReadlineInterface,
  provider: KnownKeyProvider,
): Promise<void> {
  const key = await askPassword(rl, `Enter your ${provider} API key`);
  if (!key) {
    printStatus("warn", "no key entered");
    return;
  }

  if (!(await validateProviderKey(provider, key))) {
    printStatus("warn", "key not stored because validation failed");
    return;
  }

  await chooseKeyDestination(rl, provider, key);
}

async function deleteKey(
  rl: ReadlineInterface,
  provider: KnownKeyProvider,
): Promise<"list" | "detail"> {
  const current = currentKeyLocation(provider);
  const locations = listKeyLocations(provider);
  if (!current) {
    printStatus("warn", `no key found for ${provider}`);
    return "detail";
  }

  console.log();
  console.log(`Delete the ${provider} key?`);
  console.log();
  console.log(`Current location: ${current.label}`);
  console.log();
  console.log("This will remove the key from storage.");
  console.log("You can always add it back later.");
  console.log();

  if (!(await askYesNo(rl, "Delete?", false))) {
    printStatus("warn", "delete cancelled");
    return "detail";
  }

  let targets = [current];
  if (locations.length > 1 && await askYesNo(rl, "Delete all stored copies that Gnosys can remove?", false)) {
    targets = locations;
  }

  let removed = 0;
  const dotenvNames: string[] = [];
  for (const target of targets) {
    if (target.location === "dotenv" && target.envVarName) {
      dotenvNames.push(target.envVarName);
      continue;
    }
    if (target.location === "keychain" && target.serviceName && deleteStoredSecret(target.serviceName)) {
      removed++;
      continue;
    }
    if (target.location === "env" && target.envVarName) {
      printStatus("warn", `manually unset ${target.envVarName}`, "environment variables cannot be deleted here");
    }
  }

  if (dotenvNames.length > 0) {
    removed += await removeDotenvKeys(dotenvNames);
  }

  if (removed > 0) {
    printStatus("ok", `deleted ${removed} stored key${removed === 1 ? "" : "s"}`);
  } else {
    printStatus("warn", "no deletable key was removed");
  }
  return "list";
}

async function testKey(provider: KnownKeyProvider): Promise<void> {
  const current = currentKeyLocation(provider);
  if (LOCAL_PROVIDERS.has(provider)) {
    await validateProviderKey(provider, "");
    return;
  }
  if (!current) {
    printStatus("warn", `no key found for ${provider}`);
    return;
  }
  await validateProviderKey(provider, current.value);
}

async function showProviderDetail(
  rl: ReadlineInterface,
  provider: KnownKeyProvider,
): Promise<void> {
  while (true) {
    console.log();
    console.log(renderProviderDetail(provider));

    const selection = (await askInput(rl, "Select")).trim().toLowerCase();
    if (selection === "b" || selection === "") return;

    if (LOCAL_PROVIDERS.has(provider)) {
      if (selection === "t") {
        await testKey(provider);
      } else {
        printStatus("warn", "local providers only support test or back");
      }
      continue;
    }

    if (selection === "c") {
      await copyToKeychain(rl, provider);
      continue;
    }
    if (selection === "u") {
      await updateKey(rl, provider);
      continue;
    }
    if (selection === "d") {
      if ((await deleteKey(rl, provider)) === "list") return;
      continue;
    }
    if (selection === "t") {
      await testKey(provider);
      continue;
    }

    printStatus("warn", "enter c, u, d, t, or b");
  }
}

async function addProvider(rl: ReadlineInterface): Promise<void> {
  const providers = await listProviders();
  const candidates = providers.filter((provider) => {
    if (LOCAL_PROVIDERS.has(provider.provider)) return false;
    if (provider.provider === "custom") return true;
    return !provider.found;
  });

  if (candidates.length === 0) {
    printStatus("ok", "all known cloud providers already have keys");
    return;
  }

  console.log();
  console.log("Providers without keys:");
  candidates.forEach((provider, index) => {
    console.log(`  ${index + 1}. ${provider.provider}`);
  });
  console.log("  custom. Type any custom provider name to use the custom provider slot");
  console.log();

  const answer = (await askInput(rl, "Select provider")).trim().toLowerCase();
  const selectedIndex = Number.parseInt(answer, 10);
  let provider = Number.isInteger(selectedIndex)
    ? candidates[selectedIndex - 1]?.provider
    : candidates.find((candidate) => candidate.provider === answer)?.provider;

  if (!provider && answer) {
    provider = "custom";
    if (answer !== "custom") {
      printInfo(`Using the custom provider slot for "${answer}".`);
    }
  }

  if (!provider) {
    printStatus("warn", "provider not selected");
    return;
  }

  await updateKey(rl, provider);
}

export async function listProviders(): Promise<ProviderKeyStatus[]> {
  return PROVIDERS.map((provider) => ({
    provider,
    ...detectKeyLocation(provider),
  }));
}

export function renderProviderTable(providers: ProviderKeyStatus[]): string {
  const actionRange = providers.length > 0 ? `1-${providers.length}` : "1-N";
  const rows = providers.map((provider, index) => {
    const num = String(index + 1).padStart(2, " ");
    return [
      ` ${num}`,
      pad(provider.provider, 11),
      pad(statusLabel(provider), 11),
      pad(locationLabel(provider), 20),
    ].join("  ");
  });

  return [
    TABLE_RULE,
    "  GNOSYS PROVIDER KEYS",
    TABLE_RULE,
    "",
    " #  Provider     Key Status   Stored In",
    TABLE_SEPARATOR,
    ...rows,
    "",
    "Actions:",
    `  [${actionRange}]    Select provider`,
    "  [a]      Add new provider",
    "  [q]      Quit",
    "",
  ].join("\n");
}

export async function runKeysSetup(opts?: KeysSetupOpts): Promise<void> {
  const ownReadline = !opts?.rl;
  const rl = opts?.rl ?? createInterface({ input: stdin, output: stdout });

  try {
    while (true) {
      const providers = await listProviders();
      console.log();
      console.log(renderProviderTable(providers));

      const selection = (await askInput(rl, "Select")).trim().toLowerCase();
      if (selection === "q") {
        printStatus("ok", "done");
        return;
      }

      if (selection === "a") {
        await addProvider(rl);
        continue;
      }

      const selectedIndex = Number.parseInt(selection, 10);
      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 1 &&
        selectedIndex <= providers.length
      ) {
        await showProviderDetail(rl, providers[selectedIndex - 1]!.provider);
        continue;
      }

      printStatus("warn", `enter 1-${providers.length}, a, or q`);
    }
  } finally {
    if (ownReadline) {
      rl.close();
    }
  }
}
