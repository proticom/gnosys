import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { collectDashboardData } from "../lib/dashboard.js";
import { GnosysResolver } from "../lib/resolver.js";

vi.mock("../lib/llm.js", () => ({
  isProviderAvailable: (_config: unknown, provider: string) => ({
    available: provider === "ollama" || provider === "lmstudio",
    error: "disabled in test",
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("dashboard local provider probes", () => {
  it("overlaps probes and preserves provider order when the later probe finishes first", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const ollama = String(input).endsWith("/api/tags");
      await new Promise((resolve) => setTimeout(resolve, ollama ? 40 : 10));
      if (ollama) throw new Error("server unavailable");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = collectDashboardData(new GnosysResolver(), DEFAULT_CONFIG, "test");
    const startedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    await vi.runAllTimersAsync();
    const data = await pending;

    expect(startedUrls).toEqual([
      `${DEFAULT_CONFIG.llm.ollama.baseUrl}/api/tags`,
      `${DEFAULT_CONFIG.llm.lmstudio.baseUrl}/v1/models`,
    ]);
    expect(data.soc.providerStatus).toEqual([
      { name: "anthropic", available: false, note: "disabled in test" },
      { name: "ollama", available: false, note: "server not running" },
      { name: "groq", available: false, note: "disabled in test" },
      { name: "openai", available: false, note: "disabled in test" },
      { name: "lmstudio", available: true, note: "ready" },
      { name: "xai", available: false, note: "disabled in test" },
      { name: "mistral", available: false, note: "disabled in test" },
      { name: "openrouter", available: false, note: "disabled in test" },
      { name: "custom", available: false, note: "disabled in test" },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes two unreachable probes in one 500ms timeout window", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })));
    const start = Date.now();

    const pending = collectDashboardData(new GnosysResolver(), DEFAULT_CONFIG, "test");
    await vi.runAllTimersAsync();
    const data = await pending;

    expect(Date.now() - start).toBe(500);
    expect(data.soc.providerStatus.filter((p) => p.name === "ollama" || p.name === "lmstudio")).toEqual([
      { name: "ollama", available: false, note: "server not running" },
      { name: "lmstudio", available: false, note: "server not running" },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
