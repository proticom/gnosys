import { afterEach, describe, expect, it, vi } from "vitest";

const setupMocks = vi.hoisted(() => ({
  detectIDEs: vi.fn(async () => []),
  setupIDE: vi.fn(async (ide: string) => {
    if (ide === "claude") {
      return {
        success: false,
        message: "combined result",
        components: [
          {
            ide: "claude",
            label: "Claude Code",
            success: false,
            message: 'MCP registration failed: CLI binary "claude" was not found on PATH.',
          },
          {
            ide: "claude-desktop",
            label: "Claude Desktop",
            success: true,
            message: "MCP config updated",
          },
        ],
      };
    }
    return { success: true, message: "configured" };
  }),
}));

vi.mock("../lib/setup.js", () => setupMocks);

import { runIdesSetupAll } from "../lib/setup/sections/ides.js";

afterEach(() => {
  vi.restoreAllMocks();
  setupMocks.setupIDE.mockClear();
});

describe("IDE setup component result rendering", () => {
  it("renders failed Claude Code and successful Desktop on separate status lines", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const totals = await runIdesSetupAll(process.cwd());
    const lines = log.mock.calls.map(([line]) => String(line));
    const codeLine = lines.find((line) => line.includes("Claude Code"));
    const desktopLine = lines.find((line) => line.includes("Claude Desktop"));

    expect(codeLine).toContain("✗");
    expect(codeLine).toContain("failed");
    expect(desktopLine).toContain("✓");
    expect(lines.some((line) => line.includes("✓") && /failed|skipped/i.test(line))).toBe(false);
    expect(totals).toEqual({ configured: 6, errors: 1 });
  });
});
