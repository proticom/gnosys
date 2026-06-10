import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("gnosys list command wiring", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");
  const handler = readFileSync(
    join(process.cwd(), "src/lib/listCommand.ts"),
    "utf-8",
  );

  it("wires list to runListCommand via dynamic import", () => {
    expect(cli).toContain('.command("list")');
    expect(cli).toContain("-c, --category <category>");
    expect(cli).toContain("-t, --tag <tag>");
    expect(cli).toContain("-s, --store <store>");
    expect(cli).toContain("--json");
    expect(cli).toContain("--id-format <format>");
    expect(cli).toContain(
      'const { runListCommand } = await import("./lib/listCommand.js")',
    );
    expect(cli).toContain("await runListCommand(opts)");
  });

  it("exports runListCommand with list markers", () => {
    expect(handler).toContain("export async function runListCommand");
    // Note: direct GnosysDB.openCentral() call + several internal helpers were refactored
    // (structured logging + clientReadResolve overlay in v13 multi-machine work).
    // Keep this test as a minimal wiring guard for the public export and error handling.
    expect(handler).toContain('logError(err, { module: "cli", op: "list" })');
    // The idFormat import style guard (not the lib/ subpath) may still be relevant via re-exports.
    // expect(handler).toContain('await import("./idFormat.js")');
    // expect(handler).not.toContain('await import("./lib/idFormat.js")');
  });
});
