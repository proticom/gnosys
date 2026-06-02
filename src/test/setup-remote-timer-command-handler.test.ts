import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("gnosys setup remote timer command wiring", () => {
  const cli = readFileSync(join(process.cwd(), "src/cli.ts"), "utf-8");
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
