/**
 * Setup: Providers — API keys and provider credentials.
 *
 * `gnosys setup providers` or summary menu row "providers".
 */

import type { Interface as ReadlineInterface } from "readline/promises";
import {
  loadConfig,
  updateConfig,
  type GnosysConfig,
  type LLMProviderName,
} from "../../config.js";
import {
  apiKeyServiceName,
  deleteStoredSecret,
  listStoredKeySlots,
  maskKeySnippet,
  storeApiKeySecret,
  type StoredKeySlot,
} from "../../apiKeyVault.js";
import { resolveActiveStorePath } from "../storePath.js";
import { safeQuestion } from "../ui/safePrompt.js";
import { Header } from "../ui/header.js";
import { Title } from "../ui/title.js";
import { Footer } from "../ui/footer.js";
import { Status, printStatus } from "../ui/status.js";
import { c, color, glyph } from "../ui/tokens.js";
import {
  CLOUD_PROVIDERS_FOR_KEYS,
  LOCAL_PROVIDERS,
  renderProviderLabel,
  renderProviderMark,
} from "../providerGlyphs.js";

export interface ProvidersSetupOptions {
  rl: ReadlineInterface;
  directory: string;
}

async function ask(rl: ReadlineInterface, prompt: string): Promise<string> {
  return (await safeQuestion(rl, prompt)).trim();
}

async function askYesNo(
  rl: ReadlineInterface,
  prompt: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await ask(rl, prompt + hint)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

async function askChoice(
  rl: ReadlineInterface,
  prompt: string,
  choices: string[],
  defaultIdx = 0,
): Promise<number> {
  console.log("");
  if (prompt) console.log(prompt);
  choices.forEach((ch, i) => {
    const marker = i === defaultIdx ? color(c.textDim, " (default)") : "";
    console.log(`  ${i + 1}. ${ch}${marker}`);
  });
  for (let attempts = 0; attempts < 5; attempts++) {
    const answer = await ask(rl, ` ${color(c.accent, glyph.prompt)} `);
    if (!answer) return defaultIdx;
    const n = parseInt(answer, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= choices.length) return n - 1;
    printStatus("warn", `pick a number 1–${choices.length}`);
  }
  return defaultIdx;
}

function slotScopeLabel(slot: StoredKeySlot): string {
  if (slot.scope === "global") return "global";
  return "provider";
}

async function clearConfigProviderApiKey(
  storePath: string,
  provider: LLMProviderName,
): Promise<void> {
  const cfg = await loadConfig(storePath);
  const patch: Partial<GnosysConfig["llm"]> = {};
  switch (provider) {
    case "anthropic":
      if (!cfg.llm.anthropic.apiKey) return;
      patch.anthropic = { ...cfg.llm.anthropic, apiKey: "" };
      break;
    case "openai":
      if (!cfg.llm.openai.apiKey) return;
      patch.openai = { ...cfg.llm.openai, apiKey: "" };
      break;
    case "groq":
      if (!cfg.llm.groq.apiKey) return;
      patch.groq = { ...cfg.llm.groq, apiKey: "" };
      break;
    case "xai":
      if (!cfg.llm.xai.apiKey) return;
      patch.xai = { ...cfg.llm.xai, apiKey: "" };
      break;
    case "mistral":
      if (!cfg.llm.mistral.apiKey) return;
      patch.mistral = { ...cfg.llm.mistral, apiKey: "" };
      break;
    case "openrouter":
      if (!cfg.llm.openrouter.apiKey) return;
      patch.openrouter = { ...cfg.llm.openrouter, apiKey: "" };
      break;
    case "custom":
      if (!cfg.llm.custom?.apiKey) return;
      patch.custom = { ...cfg.llm.custom, apiKey: "" };
      break;
    default:
      return;
  }
  await updateConfig(storePath, { llm: patch });
}

function renderProviderRow(
  index: number,
  provider: LLMProviderName,
  cfg: GnosysConfig,
  local = false,
): string {
  const mark = renderProviderMark(provider);
  const slots = listStoredKeySlots(cfg, provider);
  const hasKey = slots.length > 0;
  const status = local
    ? color(c.textDim, "local · no key")
    : hasKey
      ? color(c.ok, `${glyph.ok} key`)
      : color(c.textGhost, "no key");
  const preview = hasKey && !local ? `  ${color(c.textDim, slots[0]!.preview ?? "")}` : "";
  const num = color(c.textDim, String(index));
  const name = color(c.text, provider.padEnd(12));
  return ` ${num}  ${mark}  ${name}  ${status}${preview}`;
}

async function manageProviderKeys(
  rl: ReadlineInterface,
  storePath: string,
  cfg: GnosysConfig,
  provider: LLMProviderName,
): Promise<boolean> {
  let changed = false;
  while (true) {
    const slots = listStoredKeySlots(cfg, provider);
    console.log("");
    console.log(Header(["gnosys", "setup", "providers", provider]));
    console.log("");
    console.log(Title(renderProviderLabel(provider), "stored credentials for this provider"));
    console.log("");

    if (slots.length === 0) {
      console.log(`  ${color(c.textDim, "No keys found for this provider.")}`);
      console.log(
        `  ${color(c.textDim, `Add one with rotate — saved as GNOSYS_GLOBAL_${provider.toUpperCase()}_KEY`)}`,
      );
      console.log("");
    } else {
      for (const slot of slots) {
        const scope = color(c.textMid, slotScopeLabel(slot).padEnd(14));
        const src = color(c.textDim, slot.source.padEnd(22));
        const prev = slot.preview ? color(c.text, slot.preview) : "";
        console.log(`  ${scope} ${src} ${prev}`);
        console.log(`  ${color(c.textGhost, "      " + slot.service)}`);
      }
      console.log("");
    }

    const choice = await askChoice(rl, "Actions", [
      slots.length === 0 ? "Add API key (global)" : "Rotate global API key",
      "Delete one stored key…",
      "Back",
    ], 2);

    if (choice === 2) {
      return changed;
    }

    if (choice === 0) {
      const service = apiKeyServiceName(provider, "global");
      console.log("");
      console.log(`  ${color(c.textDim, `Keychain: ${service}`)}`);
      const key = await ask(rl, ` ${color(c.accent, glyph.prompt)} Enter ${provider} API key: `);
      if (!key) {
        printStatus("warn", "skipped");
        continue;
      }
      if (storeApiKeySecret(service, key, provider)) {
        const store =
          process.platform === "darwin" ? "macOS Keychain" : "GNOME Keyring";
        printStatus("ok", "key saved", `${store} · ${maskKeySnippet(key)}`);
        changed = true;
      } else {
        printStatus("fail", "could not write to secure store");
      }
      continue;
    }

    if (choice === 1) {
      if (slots.length === 0) {
        printStatus("warn", "nothing to delete");
        continue;
      }
      const labels = slots.map(
        (s, i) => `${i + 1}. ${slotScopeLabel(s)} · ${s.service}`,
      );
      const pick = await askChoice(rl, "Delete which key?", [...labels, "Cancel"], labels.length);
      if (pick >= slots.length) continue;
      const slot = slots[pick]!;
      if (slot.service === "gnosys.json") {
        if (await askYesNo(rl, "Clear API key from gnosys.json?", false)) {
          await clearConfigProviderApiKey(storePath, provider);
          printStatus("ok", "cleared gnosys.json apiKey");
          changed = true;
          cfg = await loadConfig(storePath);
        }
        continue;
      }
      if (slot.source.startsWith("$")) {
        printStatus(
          "warn",
          `unset ${slot.service} in your shell or ~/.config/gnosys/.env`,
          "env vars cannot be removed from here",
        );
        continue;
      }
      if (await askYesNo(rl, `Delete ${slot.service} from secure store?`, false)) {
        if (deleteStoredSecret(slot.service)) {
          printStatus("ok", "deleted", slot.service);
          changed = true;
        } else {
          printStatus("fail", "delete failed or entry not found");
        }
      }
      continue;
    }
  }
}

/**
 * Providers + API key management screen.
 */
export async function runProvidersSetup(opts: ProvidersSetupOptions): Promise<boolean> {
  const storePath = resolveActiveStorePath(opts.directory);
  let cfg = await loadConfig(storePath);
  let anyChange = false;

  const menuProviders: LLMProviderName[] = [
    ...CLOUD_PROVIDERS_FOR_KEYS,
    ...LOCAL_PROVIDERS,
  ];

  while (true) {
    console.log("");
    console.log(Header(["gnosys", "setup", "providers"]));
    console.log("");
    console.log(
      Title("Providers", "API keys live here · pick task routing separately for models per task"),
    );
    console.log("");

    for (let i = 0; i < menuProviders.length; i++) {
      const p = menuProviders[i]!;
      const local = LOCAL_PROVIDERS.includes(p);
      console.log(renderProviderRow(i + 1, p, cfg, local));
    }
    console.log("");
    console.log(
      `  ${color(c.textDim, "Keys: global = GNOSYS_GLOBAL_<PROVIDER>_KEY (shared across tasks)")}`,
    );
    console.log(Footer("number · manage    enter · back"));

    const answer = await ask(opts.rl, ` ${color(c.accent, glyph.prompt)} `);
    if (!answer) {
      return anyChange;
    }
    const n = parseInt(answer, 10);
    if (Number.isNaN(n) || n < 1 || n > menuProviders.length) {
      printStatus("warn", `enter 1–${menuProviders.length} or press Enter to go back`);
      continue;
    }

    const provider = menuProviders[n - 1]!;
    if (LOCAL_PROVIDERS.includes(provider)) {
      console.log("");
      printStatus("ok", `${provider} is local`, "no API key required");
      continue;
    }

    const changed = await manageProviderKeys(opts.rl, storePath, cfg, provider);
    if (changed) {
      anyChange = true;
      cfg = await loadConfig(storePath);
    }
  }
}

/** Summary line: how many providers have keys. */
export async function describeProvidersSummary(cfg: GnosysConfig): Promise<string> {
  const named: string[] = [];
  for (const p of CLOUD_PROVIDERS_FOR_KEYS) {
    if (listStoredKeySlots(cfg, p).length > 0) {
      named.push(p);
    }
  }
  if (named.length === 0) return "no keys stored";
  const preview = named.slice(0, 3).join(", ");
  const suffix = named.length > 3 ? ` +${named.length - 3}` : "";
  return `${named.length} with keys · ${preview}${suffix}`;
}
