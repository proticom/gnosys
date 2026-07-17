/**
 * v5.15: `importConcurrency` was a documented config knob that neither
 * import call site read (both hardcoded `|| 5`). The CLI command handler
 * and the gnosys_import MCP handler now default from config, with an
 * explicit --concurrency flag / param winning.
 *
 * runImportCommand exits the process on argument errors and performs real
 * store IO, so this asserts the wiring markers in source instead of
 * invoking the handler.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

const ROOT = path.resolve(__dirname, "..");

describe("v5.15 importConcurrency wiring markers", () => {
  it("importCommand.ts defaults concurrency from config.importConcurrency (CLI flag wins)", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib", "importCommand.ts"), "utf8");
    expect(src).toContain("opts.concurrency || config.importConcurrency");
    expect(src).not.toContain("opts.concurrency || 5");
  });

  it("index.ts gnosys_import handler defaults from ctx.config.importConcurrency (explicit param wins)", () => {
    const src = fs.readFileSync(path.join(ROOT, "index.ts"), "utf8");
    expect(src).toContain("concurrency ?? ctx.config?.importConcurrency");
  });

  it("the --concurrency CLI flag still exists so it can win over config", () => {
    const src = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
    expect(src).toContain('--concurrency <n>');
  });
});
