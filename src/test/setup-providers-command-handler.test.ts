import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("gnosys setup providers command wiring", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");

  it("wires setup providers to runProvidersSetup", () => {
    expect(cli).toContain('.command("providers")');
    expect(cli).toContain("Manage LLM provider API keys (view, rotate, delete)");
    expect(cli).toContain('const { runProvidersSetup } = await import("./lib/setup/sections/providers.js")');
    expect(cli).toContain("await runProvidersSetup({ rl, directory: process.cwd() })");
  });
});
