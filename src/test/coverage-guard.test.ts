import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/check-new-file-coverage.mjs");

describe("new-file coverage guard", () => {
  it("fails when the comparison base cannot be resolved", () => {
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, COVERAGE_BASE_REF: "refs/heads/test-audit-missing-ref-20260920" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("could not run `git diff` against refs/heads/test-audit-missing-ref-20260920");
    expect(result.stdout).toBe("");
  });

  it("passes when HEAD has no added application modules compared with itself", () => {
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, COVERAGE_BASE_REF: "HEAD" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("✓ No new src/lib or src/sandbox files in this diff.\n");
    expect(result.stderr).toBe("");
  });
});
