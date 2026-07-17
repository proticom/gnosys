import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup remote status command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/setupRemoteStatusCommand.ts"),
    "utf-8",
  );

  it("wires setup remote status to runSetupRemoteStatusCommand via dynamic import", () => {
    expect(cli).toContain('.command("status")');
    expect(cli).toContain("--json");
    expect(cli).toContain(
      'const { runSetupRemoteStatusCommand } = await import("./lib/setupRemoteStatusCommand.js")',
    );
    expect(cli).toContain("await runSetupRemoteStatusCommand(opts)");
  });

  it("exports runSetupRemoteStatusCommand with remote status markers", () => {
    expect(handler).toContain("export async function runSetupRemoteStatusCommand");
    expect(handler).toContain("GnosysDB.openLocal()");
    expect(handler).toContain("Central DB not available.");
    expect(handler).toContain("RemoteSync");
    expect(handler).toContain("formatStatus");
    expect(handler).toContain("withHeartbeat");
    expect(handler).toContain("Remote not configured. Run 'gnosys setup remote'.");
    expect(handler).toContain(
      "Resolve with: gnosys setup remote resolve <memory-id> --keep <local|remote>",
    );
    expect(handler).toContain("process.exitCode = 1");
    expect(handler).not.toContain("process.exit(1)");
    expect(handler).toContain("sync?.closeRemote()");
    expect(handler).toContain("centralDb?.close()");
  });
});
