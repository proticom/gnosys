import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys backup command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/backupCommand.ts"),
    "utf-8",
  );

  it("wires backup to runBackupCommand via dynamic import", () => {
    expect(cli).toContain('.command("backup")');
    expect(cli).toContain("-o, --output <dir>");
    expect(cli).toContain("--to <dir>");
    expect(cli).toContain("--json");
    expect(cli).toContain(
      'const { runBackupCommand } = await import("./lib/backupCommand.js")',
    );
    expect(cli).toContain("await runBackupCommand(opts)");
  });

  it("exports runBackupCommand with backup markers", () => {
    expect(handler).toContain("export async function runBackupCommand");
    expect(handler).toContain("GnosysDB.openCentral()");
    expect(handler).toContain("Central DB not available (better-sqlite3 missing).");
    expect(handler).toContain("process.exitCode = 1");
    expect(handler).not.toContain("process.exit(1)");
    expect(handler).toContain("centralDb.backup(outputDir)");
    expect(handler).toContain("centralDb.getMemoryCount()");
    expect(handler).toContain("centralDb.getAllProjects().length");
    expect(handler).toContain("GnosysDB.getCentralDbDir()");
    expect(handler).toContain("sandbox.log.bak");
    expect(handler).toContain("copyFileSync");
    expect(handler).toContain("JSON.stringify({");
    expect(handler).toContain("Backup created:");
    expect(handler).toContain("Backup failed:");
    expect(handler).toContain("centralDb?.close()");
  });
});
