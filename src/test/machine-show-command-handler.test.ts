import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("gnosys machine show command wiring", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");

  it("wires machine show subcommand for local machine.json (machineId, roots, remote for network)", () => {
    expect(cli).toContain('.command("machine")');
    expect(cli).toContain("Manage this machine's local config (machine.json");
    // Sub "show" for the ungrouped machine show
    expect(cli).toContain("machine show");
    expect(cli).toContain("--json");
    // The handler is in machineCommand or similar; wiring via dynamic in the machine sub
    expect(cli).toContain("machine show");
  });
});
