import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires bare setup to runSetup and summary wizard paths", () => {
    expect(cli).toContain('.command("setup")');
    expect(cli).toContain('const { runSetup } = await import("./lib/setup.js")');
    expect(cli).toContain(
      'const { runSummaryWizard } = await import("./lib/setup/summary.js")',
    );
    expect(cli).toContain("await runSummaryWizard({ directory: projectDir })");
    expect(cli).toContain("await runSetup({");
  });
});
