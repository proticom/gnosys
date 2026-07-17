import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup providers command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup providers to runProvidersSetup", () => {
    expect(cli).toContain('.command("providers")');
    expect(cli).toContain("Manage LLM provider API keys (view, rotate, delete)");
    expect(cli).toContain('const { runProvidersSetup } = await import("./lib/setup/sections/providers.js")');
    expect(cli).toContain("await runProvidersSetup({ rl, directory: process.cwd() })");
  });
});
