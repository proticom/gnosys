import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys machine show command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires machine show subcommand for local machine.json (machineId, roots, remote for network)", () => {
    expect(cli).toContain('.command("machine")');
    expect(cli).toContain("Manage this machine's local config (machine.json");
    // Sub "show" for the ungrouped machine show
    expect(cli).toContain('.command("show")');
    expect(cli).toContain("Show this machine's machine.json");
    expect(cli).toContain("--json");
    // Dynamic imports for the handler logic (machineConfig + paths)
    expect(cli).toContain('await import("./lib/machineConfig.js")');
    expect(cli).toContain('await import("./lib/paths.js")');
    expect(cli).toContain("getMachineConfigPath");
  });
});
