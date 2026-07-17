import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup routing command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup routing to runRoutingSetup with readline cleanup", () => {
    expect(cli).toContain('.command("routing")');
    expect(cli).toContain('const readline = await import("readline/promises")');
    expect(cli).toContain('const { runRoutingSetup } = await import("./lib/setup/sections/routing.js")');
    expect(cli).toContain("await runRoutingSetup({ rl, directory: process.cwd() })");
    expect(cli).toContain("rl.close()");
  });
});
