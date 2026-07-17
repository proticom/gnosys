import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys sandbox parent command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("declares sandbox as a parent container with leaf subcommand handlers", () => {
    expect(cli).toContain('const sandboxCmd = program');
    expect(cli).toContain('.command("sandbox")');
    expect(cli).toContain(
      "Manage the Gnosys sandbox — a long-lived background process",
    );

    expect(cli).toContain('.command("start")');
    expect(cli).toContain(
      'const { runSandboxStartCommand } = await import("./lib/sandboxStartCommand.js")',
    );
    expect(cli).toContain("await runSandboxStartCommand(opts)");

    expect(cli).toContain('.command("stop")');
    expect(cli).toContain(
      'const { runSandboxStopCommand } = await import("./lib/sandboxStopCommand.js")',
    );
    expect(cli).toContain("await runSandboxStopCommand(opts)");

    expect(cli).toContain('.command("status")');
    expect(cli).toContain(
      'const { runSandboxStatusCommand } = await import("./lib/sandboxStatusCommand.js")',
    );
    expect(cli).toContain("await runSandboxStatusCommand(opts)");
  });

  it("has no parent action between sandbox declaration and first leaf command", () => {
    const sandboxStart = cli.indexOf('const sandboxCmd = program');
    const firstLeaf = cli.indexOf('sandboxCmd\n  .command("start")', sandboxStart);
    expect(sandboxStart).toBeGreaterThan(-1);
    expect(firstLeaf).toBeGreaterThan(sandboxStart);

    const parentBlock = cli.slice(sandboxStart, firstLeaf);
    expect(parentBlock).not.toContain(".action(");
  });
});
