import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys update-status command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/updateStatusCommand.ts"),
    "utf-8",
  );

  it("wires update-status to runUpdateStatusCommand via dynamic import", () => {
    expect(cli).toContain('.command("update-status")');
    expect(cli).toContain("--directory");
    expect(cli).toContain("--project");
    expect(cli).toContain(
      'const { runUpdateStatusCommand } = await import("./lib/updateStatusCommand.js")',
    );
    expect(cli).toContain("await runUpdateStatusCommand(opts)");
  });

  it("exports runUpdateStatusCommand with update-status markers", () => {
    expect(handler).toContain("export async function runUpdateStatusCommand");
    expect(handler).toContain("GnosysDB.openCentral()");
    expect(handler).toContain("Central DB not available.");
    expect(handler).toContain("detectCurrentProject");
    expect(handler).toContain("generateStatusPrompt");
    expect(handler).toContain("No project specified and none detected.");
    expect(handler).toContain("Project not found:");
    expect(handler).toContain("process.exitCode = 1");
    expect(handler).not.toContain("process.exit(1)");
    expect(handler).toContain("centralDb?.close()");
  });
});
