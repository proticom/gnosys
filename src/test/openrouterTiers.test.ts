import { describe, it, expect } from "vitest";
import {
  buildOpenRouterTiers,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_STATIC_TIERS,
} from "../lib/openrouterTiers.js";

describe("buildOpenRouterTiers", () => {
  it("includes free models with :free suffix", () => {
    const tiers = buildOpenRouterTiers([
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        name: "Nemotron 3 Super (free)",
        pricing: { prompt: "0", completion: "0" },
        created: 1_700_000_000,
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        pricing: { prompt: "0", completion: "0" },
        created: 1_600_000_000,
      },
    ]);
    expect(tiers.some((t) => t.model === OPENROUTER_DEFAULT_MODEL)).toBe(true);
    expect(tiers.some((t) => t.input === 0 && t.output === 0)).toBe(true);
    expect(tiers.some((t) => t.recommended)).toBe(true);
  });

  it("falls back to static tiers for empty catalog", () => {
    expect(buildOpenRouterTiers([])).toEqual(OPENROUTER_STATIC_TIERS);
  });
});
