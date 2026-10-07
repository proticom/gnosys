import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import contracts from "./fixtures/cli/help-contract.json";

describe("CLI help contract", () => {
  for (const contract of contracts) {
    it(`documents ${contract.path}`, () => {
      const output = execFileSync(process.execPath, [
        resolve("dist/cli.js"), ...contract.path.split(" "), "--help",
      ], { encoding: "utf8", timeout: 10_000 });
      expect(output.split("\n")[0]).toBe(contract.usage);
      const text = output.replace(/\s+/g, " ");
      expect(text).toContain(contract.description);
      for (const option of contract.options) expect(text).toContain(option);
    });
  }
});
