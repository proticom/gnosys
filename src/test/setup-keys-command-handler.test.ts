import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("gnosys setup keys command wiring", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");

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
