import { createInterface, type Interface as ReadlineInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { detectKeyLocation } from "./apiKeyVault.js";
import { askInput, printInfo, printStatus } from "./setup.js";

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
        printInfo("Add new provider is coming in Task 3.");
        continue;
      }

      const selectedIndex = Number.parseInt(selection, 10);
      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 1 &&
        selectedIndex <= providers.length
      ) {
        printInfo(`${providers[selectedIndex - 1]!.provider} detail view is coming in Task 3.`);
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
