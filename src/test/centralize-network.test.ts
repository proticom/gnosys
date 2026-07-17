import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys centralize for network MCP seeding", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/centralizeCommand.ts"),
    "utf-8",
  );

  it("wires centralize --to for seeding a central brain (e.g. Docker volume or host for http serve)", () => {
    expect(cli).toContain('.command("centralize")');
    expect(cli).toContain('.requiredOption("--to <dir>"');
    expect(cli).toContain("--from-local");
    expect(cli).toContain("--force");
    expect(cli).toContain(
      'const { runCentralizeCommand } = await import("./lib/centralizeCommand.js")',
    );
    expect(cli).toContain("await runCentralizeCommand(opts)");
    // Network use case: seed the /data volume for a central gnosys serve --transport http
    expect(handler).toContain("centralizeDb");
    expect(handler).toContain("GNOSYS_HOME");
  });
});
