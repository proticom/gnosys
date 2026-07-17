import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup dream command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup dream to runDreamSetup with the current directory", () => {
    expect(cli).toContain('.command("dream")');
    expect(cli).toContain('const { runDreamSetup } = await import("./lib/setup.js")');
    expect(cli).toContain("await runDreamSetup({ directory: process.cwd() })");
  });
});
