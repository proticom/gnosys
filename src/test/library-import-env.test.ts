/**
 * Issue #72: importing the package root must not copy ~/.config/gnosys/.env
 * into the host process.env. The CLI and loadGnosysEnv() still do.
 *
 * The env file lives only under a temp HOME from os.tmpdir().
 */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

const SENTINEL = "GNOSYS_ISSUE72_SENTINEL";
const KEEP = "GNOSYS_ISSUE72_KEEP";
const OVERRIDE = "GNOSYS_ALLOW_MEMORY_DELETE";

function packageEntryHref(): string {
  const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    main: string;
    exports: { ".": { import: string } };
  };
  const fromMain = new URL(`../../${pkg.main}`, import.meta.url);
  const fromExports = new URL(`../../${pkg.exports["."].import}`, import.meta.url);
  if (fromMain.href !== fromExports.href) {
    throw new Error(`package main ${pkg.main} and exports ${pkg.exports["."].import} point at different files`);
  }
  return fromMain.href;
}

function writeTempHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-issue72-"));
  const dir = path.join(home, ".config", "gnosys");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".env"),
    `${SENTINEL}=from-file\n${KEEP}=from-file\n${OVERRIDE}=1\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return home;
}

function childEnv(home: string, reportPath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    GNOSYS_HOME: path.join(home, ".gnosys"),
    GNOSYS_ISSUE72_REPORT: reportPath,
    VITEST: "true",
    [KEEP]: "preset",
  };
  delete env.GNOSYS_GLOBAL;
  delete env.GNOSYS_PERSONAL;
  delete env[SENTINEL];
  delete env[OVERRIDE];
  return env;
}

function runNode(home: string, script: string): { status: number | null; stderr: string; report: string } {
  const reportPath = path.join(home, "report.json");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    cwd: home,
    env: childEnv(home, reportPath),
    timeout: 60_000,
  });
  const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";
  return { status: child.status, stderr: child.stderr ?? "", report };
}

describe("library import does not load the gnosys env file (#72)", () => {
  it("importing the built package entry does not change process.env", () => {
    const home = writeTempHome();
    try {
      const entry = packageEntryHref();
      const result = runNode(home, `
        import fs from "fs";
        delete process.env[${JSON.stringify(SENTINEL)}];
        const before = Object.keys(process.env).sort();
        await import(${JSON.stringify(entry)});
        const after = Object.keys(process.env).sort();
        const beforeSet = new Set(before);
        const afterSet = new Set(after);
        fs.writeFileSync(process.env.GNOSYS_ISSUE72_REPORT, JSON.stringify({
          sentinel: process.env[${JSON.stringify(SENTINEL)}] ?? null,
          added: after.filter((key) => !beforeSet.has(key)),
          removed: before.filter((key) => !afterSet.has(key)),
        }));
      `);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.report) as { sentinel: string | null; added: string[]; removed: string[] };
      expect(report.sentinel).toBeNull();
      expect(report.added).toEqual([]);
      expect(report.removed).toEqual([]);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 60_000);

  it("loadGnosysEnv loads unset keys, keeps existing values, and a second call does not fill skipped keys", () => {
    const home = writeTempHome();
    try {
      const loader = new URL("../../dist/lib/loadGnosysEnv.js", import.meta.url).href;
      const result = runNode(home, `
        import fs from "fs";
        const { loadGnosysEnv } = await import(${JSON.stringify(loader)});
        loadGnosysEnv({ skipKeys: [${JSON.stringify(OVERRIDE)}] });
        loadGnosysEnv();
        fs.writeFileSync(process.env.GNOSYS_ISSUE72_REPORT, JSON.stringify({
          sentinel: process.env[${JSON.stringify(SENTINEL)}] ?? null,
          keep: process.env[${JSON.stringify(KEEP)}] ?? null,
          override: process.env[${JSON.stringify(OVERRIDE)}] ?? null,
        }));
      `);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.report) as { sentinel: string | null; keep: string | null; override: string | null };
      expect(report.sentinel).toBe("from-file");
      expect(report.keep).toBe("preset");
      expect(report.override).toBeNull();
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 30_000);

  it("loadGnosysEnv without a skip list still applies the memory-delete key (MCP entry behaviour)", () => {
    const home = writeTempHome();
    try {
      const loader = new URL("../../dist/lib/loadGnosysEnv.js", import.meta.url).href;
      const result = runNode(home, `
        import fs from "fs";
        const { loadGnosysEnv } = await import(${JSON.stringify(loader)});
        loadGnosysEnv();
        fs.writeFileSync(process.env.GNOSYS_ISSUE72_REPORT, JSON.stringify({
          sentinel: process.env[${JSON.stringify(SENTINEL)}] ?? null,
          keep: process.env[${JSON.stringify(KEEP)}] ?? null,
          override: process.env[${JSON.stringify(OVERRIDE)}] ?? null,
        }));
      `);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.report) as { sentinel: string | null; keep: string | null; override: string | null };
      expect(report.sentinel).toBe("from-file");
      expect(report.keep).toBe("preset");
      expect(report.override).toBe("1");
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 30_000);

  it("the CLI entry loads the file and still skips the memory-delete override", () => {
    const home = writeTempHome();
    try {
      const cliUrl = new URL("../../dist/cli.js", import.meta.url);
      const result = runNode(home, `
        import fs from "fs";
        // node -e makes commander treat argv as { from: "eval" } (strip only argv[0]).
        process.argv = [process.execPath, "--version"];
        process.exit = (code = 0) => { process.exitCode = code ?? 0; };
        await import(${JSON.stringify(cliUrl.href)});
        fs.writeFileSync(process.env.GNOSYS_ISSUE72_REPORT, JSON.stringify({
          sentinel: process.env[${JSON.stringify(SENTINEL)}] ?? null,
          keep: process.env[${JSON.stringify(KEEP)}] ?? null,
          override: process.env[${JSON.stringify(OVERRIDE)}] ?? null,
        }));
        process.exitCode = 0;
      `);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.report) as { sentinel: string | null; keep: string | null; override: string | null };
      expect(report.sentinel).toBe("from-file");
      expect(report.keep).toBe("preset");
      expect(report.override).toBeNull();
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 60_000);
});
