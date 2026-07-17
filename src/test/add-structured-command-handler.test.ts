import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys add-structured command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/addStructuredCommand.ts"),
    "utf-8",
  );

  it("wires add-structured to runAddStructuredCommand via dynamic import", () => {
    expect(cli).toContain('.command("add-structured")');
    expect(cli).toContain(
      '.description("Add a memory with structured input (no LLM needed)")',
    );
    expect(cli).toContain('.requiredOption("--title <title>"');
    expect(cli).toContain('.requiredOption("--category <category>"');
    expect(cli).toContain('.requiredOption("--content <content>"');
    expect(cli).toContain("--tags <json>");
    expect(cli).toContain('.option("--user"');
    expect(cli).toContain('.option("--global"');
    expect(cli).toContain(
      'const { runAddStructuredCommand } = await import("./lib/addStructuredCommand.js")',
    );
    expect(cli).toContain(
      "await runAddStructuredCommand(opts, resolveProjectId)",
    );
  });

  it("exports runAddStructuredCommand with tags JSON validation", () => {
    expect(handler).toContain("export async function runAddStructuredCommand");
    expect(handler).toContain("JSON.parse(opts.tags)");
    expect(handler).toContain("Invalid --tags JSON");
  });
});
