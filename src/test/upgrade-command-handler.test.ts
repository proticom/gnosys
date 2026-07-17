import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys upgrade command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("registers upgrade options and helpers", () => {
    expect(cli).toContain('.command("upgrade")');
    expect(cli).toContain("--yes");
    expect(cli).toContain("--no-sync");
    expect(cli).toContain("detectPackageManager");
    expect(cli).toContain("upgradeCommand(pm)");
    expect(cli).toContain("const { execSync, spawn } = await import(\"child_process\");");
    // The install is spawned with stderr piped so we can filter the two
    // unfixable deprecation warnings; stdout still streams live.
    expect(cli).toContain("makeNpmStderrFilter");
    expect(cli).toContain('stdio: ["inherit", "inherit", "pipe"]');
    expect(cli).toContain("writeUpgradeMarker");
  });

  it("covers sync prompt and failure paths", () => {
    expect(cli).toContain("opts.sync === false || opts.yes");
    expect(cli).toContain(
      "readline.createInterface({ input: process.stdin, output: process.stdout })",
    );
    expect(cli).toContain("rl.close()");
    expect(cli).toContain('execSync("gnosys setup sync-projects", { stdio: "inherit" })');
    expect(cli).toContain("Sync-projects failed:");
    expect(cli).toContain("process.exit(1)");
  });
});
