import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { GnosysDB } from "../lib/db.js";

function seedVersion(directory: string, value: string): void {
  const db = new GnosysDB(directory);
  try { db.setMeta("audit-seed", value); } finally { db.close(); }
}

function readVersion(directory: string): string | null {
  const db = new GnosysDB(directory);
  try { return db.getMeta("audit-seed"); } finally { db.close(); }
}

describe("gnosys centralize for network MCP seeding", () => {
  it("copies the local brain through --to and overwrites only with --force", () => {
    const base = mkdtempSync(join(tmpdir(), "gnosys-centralize-cli-"));
    const source = join(base, "source");
    const target = join(base, "target");
    const run = (...extra: string[]) => spawnSync(process.execPath, [resolve("dist/cli.js"), "centralize", "--from-local", "--to", target, ...extra], {
      env: { ...process.env, GNOSYS_HOME: source, GNOSYS_CONFIG_DIR: join(base, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_SKIP_UPGRADE_NUDGE: "1" },
      cwd: base, encoding: "utf8", timeout: 10000,
    });
    try {
      seedVersion(source, "first");
      const copied = run();
      expect(copied.status, copied.stderr).toBe(0);
      expect(readVersion(target)).toBe("first");
      seedVersion(source, "second");
      const refused = run();
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain("Target already exists");
      expect(readVersion(target)).toBe("first");
      const forced = run("--force");
      expect(forced.status, forced.stderr).toBe(0);
      expect(readVersion(target)).toBe("second");
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
