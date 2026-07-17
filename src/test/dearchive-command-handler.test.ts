import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys dearchive command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/dearchiveCommand.ts"),
    "utf-8",
  );

  it("wires dearchive to runDearchiveCommand via dynamic import", () => {
    expect(cli).toContain('.command("dearchive <query>")');
    expect(cli).toContain("--limit <n>");
    expect(cli).toContain(
      'const { runDearchiveCommand } = await import("./lib/dearchiveCommand.js")',
    );
    expect(cli).toContain("await runDearchiveCommand(getResolver, query, opts)");
  });

  it("exports runDearchiveCommand with dearchive markers", () => {
    expect(handler).toContain("export async function runDearchiveCommand");
    expect(handler).toContain("GnosysArchive");
    expect(handler).toContain("resolver.getStores()");
    expect(handler).toContain("No Gnosys stores found. Run gnosys init first.");
    expect(handler).toContain("resolver.getWriteTarget()");
    expect(handler).toContain("No writable store found.");
    expect(handler).toContain("new GnosysArchive(writeTarget.path)");
    expect(handler).toContain("archive.isAvailable()");
    expect(handler).toContain(
      "Archive not available. Install it with: npm install better-sqlite3",
    );
    // v5.12.1 marker update (approved): production parseInt gained explicit radix 10
    expect(handler).toContain("archive.searchArchive(query, parseInt(opts.limit, 10))");
    expect(handler).toContain("No archived memories found matching");
    expect(handler).toContain("archive.dearchiveBatch(ids, writeTarget.store)");
    expect(handler).toContain("finally");
    expect(handler).toContain("archive?.close()");
  });
});
