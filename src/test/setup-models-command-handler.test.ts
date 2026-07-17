import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys setup models command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires setup models to runModelsSetup with provider/model/validate options", () => {
    expect(cli).toContain('.command("models")');
    expect(cli).toContain('const { runModelsSetup } = await import("./lib/setup.js")');
    expect(cli).toContain("provider: opts.provider");
    expect(cli).toContain("model: opts.model");
    expect(cli).toContain("validate: opts.validate");
  });
});
