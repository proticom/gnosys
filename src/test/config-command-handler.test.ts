import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys config command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handlers = readFileSync(
    join(process.cwd(), "src/lib/configCommand.ts"),
    "utf-8",
  );

  it("wires config subcommands to extracted handlers", () => {
    expect(cli).toContain('.command("config")');
    expect(cli).toContain(
      '.description("View and manage LLM provider configuration")',
    );
    expect(cli).toContain('.command("show")');
    expect(cli).toContain('.option("--json", "Dump the raw effective config as JSON")');
    expect(cli).toContain(
      'const { runConfigShowCommand } = await import("./lib/configCommand.js")',
    );
    expect(cli).toContain("await runConfigShowCommand(getResolver, opts)");
    expect(cli).toContain('.command("set <key> <value> [extra...]")');
    expect(cli).toContain(
      'const { runConfigSetCommand } = await import("./lib/configCommand.js")',
    );
    expect(cli).toContain(
      "await runConfigSetCommand(getResolver, key, value, extra)",
    );
    expect(cli).toContain('.command("init")');
    expect(cli).toContain('.option("--force", "Skip the deprecation warning and write the template")');
    expect(cli).toContain(
      'const { runConfigInitCommand } = await import("./lib/configCommand.js")',
    );
    expect(cli).toContain("await runConfigInitCommand(getResolver, opts)");
  });

  it("exports named config handler functions", () => {
    expect(handlers).toContain("export async function runConfigShowCommand");
    expect(handlers).toContain("export async function runConfigSetCommand");
    expect(handlers).toContain("export async function runConfigInitCommand");
  });
});
