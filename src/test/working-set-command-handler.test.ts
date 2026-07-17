import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys working-set command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/workingSetCommand.ts"),
    "utf-8",
  );

  it("wires working-set to runWorkingSetCommand via dynamic import", () => {
    expect(cli).toContain('.command("working-set")');
    expect(cli).toContain("-d, --directory <dir>");
    expect(cli).toContain("-w, --window <hours>");
    expect(cli).toContain("--json");
    expect(cli).toContain(
      'const { runWorkingSetCommand } = await import("./lib/workingSetCommand.js")',
    );
    expect(cli).toContain("await runWorkingSetCommand(opts)");
  });

  it("exports runWorkingSetCommand with working-set markers", () => {
    expect(handler).toContain("export async function runWorkingSetCommand");
    expect(handler).toContain("GnosysDB.openCentral()");
    expect(handler).toContain("isAvailable()");
    expect(handler).toContain("detectCurrentProject");
    expect(handler).toContain("getWorkingSet");
    expect(handler).toContain("formatWorkingSet");
    expect(handler).toContain("parseInt(opts.window, 10)");
    expect(handler).toContain("projectId: pid");
    expect(handler).toContain("windowHours");
    expect(handler).toContain("centralDb?.close()");
    expect(handler).toContain('await import("./federated.js")');
    expect(handler).not.toContain('await import("./lib/federated.js")');
  });
});
