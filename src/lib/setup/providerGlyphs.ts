/**
 * Terminal brand marks for LLM providers (single-width glyphs + color).
 */

import type { LLMProviderName } from "../config.js";
import { c, color, RESET } from "./ui/tokens.js";

export interface ProviderMark {
  glyph: string;
  /** ANSI foreground for the glyph */
  ansi: string;
  shortName: string;
}

const MARKS: Record<string, ProviderMark> = {
  anthropic: { glyph: "◆", ansi: "\x1b[38;2;204;142;102m", shortName: "Anthropic" },
  openai: { glyph: "◎", ansi: "\x1b[38;2;116;168;255m", shortName: "OpenAI" },
  groq: { glyph: "⚡", ansi: "\x1b[38;2;255;200;87m", shortName: "Groq" },
  xai: { glyph: "✕", ansi: "\x1b[38;2;230;230;230m", shortName: "xAI" },
  mistral: { glyph: "◬", ansi: "\x1b[38;2;255;120;80m", shortName: "Mistral" },
  openrouter: { glyph: "⬡", ansi: "\x1b[38;2;140;200;255m", shortName: "OpenRouter" },
  ollama: { glyph: "○", ansi: c.ok, shortName: "Ollama" },
  lmstudio: { glyph: "▣", ansi: c.ok, shortName: "LM Studio" },
  custom: { glyph: "⚙", ansi: c.textMid, shortName: "Custom" },
  skip: { glyph: "·", ansi: c.textGhost, shortName: "skip" },
};

const FALLBACK: ProviderMark = { glyph: "•", ansi: c.textMid, shortName: "unknown" };

export function getProviderMark(provider: string): ProviderMark {
  return MARKS[provider] ?? FALLBACK;
}

/** Colored single-character (or short) logo for lists and tables. */
export function renderProviderMark(provider: string): string {
  const m = getProviderMark(provider);
  return `${m.ansi}${m.glyph}${RESET}`;
}

/** `◆ Anthropic` with brand-colored glyph. */
export function renderProviderLabel(provider: string): string {
  const m = getProviderMark(provider);
  return `${m.ansi}${m.glyph}${RESET} ${color(c.text, m.shortName)}`;
}

/** Cloud providers that use API keys in the providers screen. */
export const CLOUD_PROVIDERS_FOR_KEYS: LLMProviderName[] = [
  "anthropic",
  "openai",
  "groq",
  "xai",
  "mistral",
  "openrouter",
  "custom",
];

/** Local providers shown in the list (no key management). */
export const LOCAL_PROVIDERS: LLMProviderName[] = ["ollama", "lmstudio"];
