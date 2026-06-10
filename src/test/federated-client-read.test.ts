import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const handlers = [
  "discoverCommand.ts",
  "searchCommand.ts",
  "recallCommand.ts",
  "hybridSearchCommand.ts",
  "fsearchCommand.ts",
  "askCommand.ts",
] as const;

describe("federated paths use client read context", () => {
  for (const file of handlers) {
    it(`${file} resolves client read for federated queries`, () => {
      const source = readFileSync(join(process.cwd(), "src/lib", file), "utf-8");
      expect(source).toContain('await import("./clientReadResolve.js")');
      expect(source).toContain("resolveClientRead()");
      expect(source).toContain("resolved.release()");
      expect(source).not.toMatch(/federatedSearch\(centralDb/);
      expect(source).not.toMatch(/federatedDiscover\(centralDb/);
    });
  }

  it("gnosys_federated_search MCP tool uses resolveToolContext and cleanup", () => {
    const index = readFileSync(join(process.cwd(), "src/index.ts"), "utf-8");
    const start = index.indexOf('"gnosys_federated_search"');
    expect(start).toBeGreaterThan(-1);
    const block = index.slice(start, start + 2500);
    expect(block).toContain("resolveToolContext(projectRoot)");
    expect(block).toContain("federatedSearch(ctx.centralDb");
    expect(block).toContain("releaseClientReadFromContext(ctx)");
    expect(block).not.toContain("federatedSearch(centralDb");
  });
});
