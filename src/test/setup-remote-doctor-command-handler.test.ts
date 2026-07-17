import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup remote doctor command usage", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const syncIngest = readFileSync(join(process.cwd(), "src/lib/syncIngestSystemd.ts"), "utf-8");

  it("documents `gnosys setup remote doctor --ingest` for Windows / manual timer users", () => {
    // The command string is referenced for cross-platform ingest setup (systemd/launchd/Windows Task Scheduler)
    expect(syncIngest).toContain("setup remote doctor --ingest --quiet");
    // Doctor command itself is wired
    expect(cli).toContain('.command("doctor")');
    expect(cli).toContain("const { runDoctorCommand } = await import(\"./lib/doctorCommand.js\")");
  });
});
