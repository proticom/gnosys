import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup preferences command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup preferences to runPreferencesReview with readline cleanup", () => {
    expect(cli).toContain('.command("preferences")');
    expect(cli).toContain('const readline = await import("readline/promises")');
    expect(cli).toContain('const { runPreferencesReview } = await import("./lib/setup/sections/preferences.js")');
    expect(cli).toContain("await runPreferencesReview(rl)");
    expect(cli).toContain("rl.close()");
  });
});
