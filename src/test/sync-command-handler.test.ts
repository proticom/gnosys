import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys sync command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/syncCommand.ts"),
    "utf-8",
  );

  it("wires sync to runSyncCommand via dynamic import", () => {
    expect(cli).toContain('.command("sync")');
    expect(cli).toContain("-d, --directory <dir>");
    expect(cli).toContain("-t, --target <target>");
    expect(cli).toContain("--global");
    expect(cli).toContain(
      'const { runSyncCommand } = await import("./lib/syncCommand.js")',
    );
    expect(cli).toContain("await runSyncCommand(opts)");
  });

  it("exports runSyncCommand with sync markers", () => {
    expect(handler).toContain("export async function runSyncCommand");
    expect(handler).toContain("opts.directory ? path.resolve(opts.directory) : process.cwd()");
    expect(handler).toContain('opts.global ? "global" : (opts.target || null)');
    expect(handler).toContain("GnosysDB.openCentral()");
    expect(handler).toContain("syncToTarget");
    expect(handler).toContain("readProjectIdentity(projectDir)");
    // Bare `gnosys sync` defaults to "all" present rule files (not the single
    // agentRulesTarget) so multi-IDE projects stay in sync.
    expect(handler).toContain('const resolvedTarget = target || "all"');
    expect(handler).not.toContain("identity.agentRulesTarget");
    expect(handler).toContain("No targets found.");
    expect(handler).toContain("GNOSYS:START");
    expect(handler).toContain("process.exitCode = 1");
    expect(handler).not.toContain("process.exit(1)");
    expect(handler).toContain("centralDb?.close()");
  });
});
