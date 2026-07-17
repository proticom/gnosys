import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup keys command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup keys to the table UI (provider table, keychain actions)", () => {
    expect(cli).toContain('.command("keys")');
    expect(cli).toContain("Manage provider API keys in a table view");
    // The action imports the new setupKeys implementation (table + keychain/copy/delete flows)
    expect(cli).toContain('const { runSetup } = await import("./lib/setup.js")');
    // Non-interactive / full flags are supported for scripting
    expect(cli).toContain("--non-interactive");
    expect(cli).toContain("--full");
  });
});
