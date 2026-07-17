import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys stores command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires stores to runStoresCommand via dynamic import", () => {
    expect(cli).toContain('.command("stores")');
    expect(cli).toContain(
      '.description("Show all active stores, their layers, paths, and permissions")',
    );
    expect(cli).toContain('const { runStoresCommand } = await import("./lib/storesCommand.js")');
    expect(cli).toContain("await runStoresCommand(getResolver)");
  });
});
