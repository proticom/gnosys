/**
 * Build setup-wizard model tiers from the OpenRouter catalog.
 * Includes :free models (excluded from other provider tier builders).
 */

export interface OpenRouterCatalogModel {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
  created?: number;
}

export interface OpenRouterModelTier {
  name: string;
  model: string;
  input: number;
  output: number;
  recommended: boolean;
}

const SKIP_ID = /guard|embed|tts|audio|vision|image|code-|router/i;

/** Default recommended free model on OpenRouter. */
export const OPENROUTER_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export const OPENROUTER_STATIC_TIERS: OpenRouterModelTier[] = [
  {
    name: "Free · Nemotron 3 Super",
    model: OPENROUTER_DEFAULT_MODEL,
    input: 0,
    output: 0,
    recommended: true,
  },
  {
    name: "Free · Devstral Small",
    model: "mistralai/devstral-small-2505:free",
    input: 0,
    output: 0,
    recommended: false,
  },
  {
    name: "Free · Llama 3.3 70B",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    input: 0,
    output: 0,
    recommended: false,
  },
];

function tierLabel(m: { id: string; name?: string; isFree: boolean }): string {
  const raw = m.name?.trim() || m.id.split("/").pop() || m.id;
  const short = raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  return m.isFree ? `Free · ${short}` : short;
}

/**
 * Turn OpenRouter /models JSON into wizard tiers: free models first, then
 * a few paid budget/balanced/premium picks.
 */
export function buildOpenRouterTiers(
  catalog: OpenRouterCatalogModel[],
): OpenRouterModelTier[] {
  const parsed = catalog
    .filter((m) => m.id.includes("/") && !SKIP_ID.test(m.id))
    .map((m) => {
      const input = parseFloat(m.pricing?.prompt ?? "0") * 1e6;
      const output = parseFloat(m.pricing?.completion ?? "0") * 1e6;
      const isFree = m.id.includes(":free") || (input === 0 && output === 0);
      return {
        id: m.id,
        name: m.name,
        input,
        output,
        isFree,
        created: m.created ?? 0,
      };
    });

  const free = parsed
    .filter((m) => m.isFree)
    .sort((a, b) => b.created - a.created);

  const paid = parsed
    .filter((m) => !m.isFree && m.input > 0)
    .filter((m) => !/preview|beta/i.test(m.id))
    .sort((a, b) => b.created - a.created);

  const tiers: OpenRouterModelTier[] = [];
  const seen = new Set<string>();

  const recommendedFree =
    free.find((m) => m.id === OPENROUTER_DEFAULT_MODEL) ??
    free.find((m) => m.id.includes("nemotron-3-super")) ??
    free[0];

  for (const m of free.slice(0, 8)) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    tiers.push({
      name: tierLabel(m),
      model: m.id,
      input: 0,
      output: 0,
      recommended: recommendedFree?.id === m.id,
    });
  }

  const BUDGET_MAX = 1.5;
  const BALANCED_MAX = 6;
  const budget = paid.find((m) => m.input <= BUDGET_MAX);
  const balanced = paid.find((m) => m.input > BUDGET_MAX && m.input <= BALANCED_MAX);
  const premium = paid.find((m) => m.input > BALANCED_MAX);

  for (const [m, label] of [
    [budget, "Paid · Budget"],
    [balanced, "Paid · Balanced"],
    [premium, "Paid · Premium"],
  ] as const) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    tiers.push({
      name: label,
      model: m.id,
      input: Math.round(m.input * 100) / 100,
      output: Math.round(m.output * 100) / 100,
      recommended: false,
    });
  }

  if (tiers.length === 0) {
    return [...OPENROUTER_STATIC_TIERS];
  }

  if (!tiers.some((t) => t.recommended)) {
    tiers[0].recommended = true;
  }

  // Ensure the canonical Nemotron free tier is always listed.
  if (!seen.has(OPENROUTER_DEFAULT_MODEL)) {
    const nemotron = OPENROUTER_STATIC_TIERS[0];
    tiers.unshift({ ...nemotron, recommended: !tiers.some((t) => t.recommended) });
  }

  return tiers;
}
