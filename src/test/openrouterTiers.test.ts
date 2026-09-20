import { describe, it, expect } from "vitest";
import {
  buildOpenRouterTiers,
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
    expect(tiers).toEqual([
      { name: "Free · Nemotron 3 Super (free)", model: "nvidia/nemotron-3-super-120b-a12b:free", input: 0, output: 0, recommended: true },
      { name: "Free · llama-3.3-70b-instruct:free", model: "meta-llama/llama-3.3-70b-instruct:free", input: 0, output: 0, recommended: false },
    ]);
  });

  it("falls back to static tiers for empty catalog", () => {
    expect(buildOpenRouterTiers([])).toEqual([
      { name: "Free · Nemotron 3 Super", model: "nvidia/nemotron-3-super-120b-a12b:free", input: 0, output: 0, recommended: true },
      { name: "Free · Devstral Small", model: "mistralai/devstral-small-2505:free", input: 0, output: 0, recommended: false },
      { name: "Free · Llama 3.3 70B", model: "meta-llama/llama-3.3-70b-instruct:free", input: 0, output: 0, recommended: false },
    ]);
  });
});
