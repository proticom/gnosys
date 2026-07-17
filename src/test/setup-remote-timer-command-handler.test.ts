import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup remote timer command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/syncIngestTimerCommand.ts"),
    "utf-8",
  );

  it("wires setup remote timer to runSyncIngestTimerCommand via dynamic import", () => {
    expect(cli).toContain('.command("timer")');
    expect(cli).toContain("--install");
    expect(cli).toContain("--uninstall");
    expect(cli).toContain("--status");
    expect(cli).toContain("--interval <minutes>");
    expect(cli).toContain(
      'const { runSyncIngestTimerCommand } = await import("./lib/syncIngestTimerCommand.js")',
    );
    expect(cli).toContain("await runSyncIngestTimerCommand(opts)");
  });

  it("exports runSyncIngestTimerCommand with install/uninstall/status paths", () => {
    expect(handler).toContain("export async function runSyncIngestTimerCommand");
    expect(handler).toContain("installSyncIngestTimer");
    expect(handler).toContain("uninstallSyncIngestTimer");
    expect(handler).toContain("getSyncIngestTimerStatus");
    expect(handler).toContain("Windows");
  });
});
