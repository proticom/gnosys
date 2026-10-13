/**
 * Maintenance commands finish with no human at the keyboard (2026-10-13).
 *
 * Every case spawns the built CLI with stdin closed (not a TTY), a temp
 * GNOSYS_HOME / GNOSYS_CONFIG_DIR / HOME, and stub `npm` + `gnosys`
 * executables on PATH so `gnosys upgrade` never touches the real global
 * install. The `gnosys` stub runs this checkout's dist/cli.js, so the
 * chained `setup sync-projects` is the real command.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { makeMemory } from "./_helpers.js";

const CLI = path.resolve("dist/cli.js");
const PKG_VERSION = (JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as { version: string }).version;
// A registry entry that is not under a temp dir (so it is "dead", not
// "temp") and can never exist.
const DEAD_PROJECT = path.join(path.parse(process.cwd()).root, "gnosys-unattended-fixture", "gone-project");

interface Sandbox {
  root: string;
  home: string;
  config: string;
  user: string;
  bin: string;
  npmLog: string;
}

let sb: Sandbox;

function run(args: string[], extraEnv: Record<string, string> = {}) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== "GNOSYS_ALLOW_MEMORY_DELETE" && k !== "npm_config_user_agent") env[k] = v;
  }
  Object.assign(env, {
    GNOSYS_HOME: sb.home,
    GNOSYS_CONFIG_DIR: sb.config,
    HOME: sb.user,
    PATH: `${sb.bin}${path.delimiter}${process.env.PATH ?? ""}`,
    NPM_STUB_LOG: sb.npmLog,
    ...extraEnv,
  });
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: sb.root,
    env,
    input: "",
    encoding: "utf8",
    timeout: 60_000,
  });
}

function writeRegistry(entries: string[]): void {
  fs.writeFileSync(path.join(sb.config, "projects.json"), JSON.stringify(entries));
}

function readRegistry(): string[] {
  return JSON.parse(fs.readFileSync(path.join(sb.config, "projects.json"), "utf8")) as string[];
}

function npmCalls(): string[] {
  return fs.existsSync(sb.npmLog) ? fs.readFileSync(sb.npmLog, "utf8").trim().split("\n").filter(Boolean) : [];
}

beforeEach(() => {
  // realpath: macOS tmpdir is a /private symlink and the CLI reports real paths.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-unattended-")));
  sb = {
    root,
    home: path.join(root, "home"),
    config: path.join(root, "config"),
    user: path.join(root, "user"),
    bin: path.join(root, "bin"),
    npmLog: path.join(root, "npm.log"),
  };
  for (const dir of [sb.home, sb.config, sb.user, sb.bin]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(sb.bin, "npm"),
    [
      "#!/bin/sh",
      'echo "$*" >> "$NPM_STUB_LOG"',
      'if [ "$1" = "ls" ]; then echo \'{"dependencies":{"gnosys":{"version":"9.9.9"}}}\'; else echo "added 1 package"; fi',
    ].join("\n"),
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(sb.bin, "gnosys"),
    `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`,
    { mode: 0o755 },
  );
});

afterEach(() => {
  fs.rmSync(sb.root, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("gnosys upgrade without a terminal", () => {
  it("--yes --json upgrades, runs sync-projects --yes, and removes the dead registry entry", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["upgrade", "--yes", "--json"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out).toMatchObject({
      ok: true,
      previousVersion: PKG_VERSION,
      installedVersion: "9.9.9",
      packageManager: "npm",
      installCommand: "npm install -g gnosys@latest",
      markerWritten: true,
      dreamRepair: null,
    });
    expect(out.sync.ran).toBe(true);
    expect(out.sync.result).toMatchObject({
      ok: true,
      version: PKG_VERSION,
      total: 1,
      upgraded: [],
      skipped: [DEAD_PROJECT],
      failed: [],
      registryCleanup: { removed: 1, kept: 0, wrote: true },
    });
    expect(npmCalls()).toEqual(["install -g gnosys@latest", "ls -g gnosys --depth=0 --json"]);
    expect(readRegistry()).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(sb.user, ".gnosys", "last-upgrade-at"), "utf8")).version).toBe("9.9.9");
  });

  it("--no-sync --json upgrades only and leaves the registry alone", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["upgrade", "--no-sync", "--json"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.sync).toEqual({ ran: false });
    expect(npmCalls()).toEqual(["install -g gnosys@latest", "ls -g gnosys --depth=0 --json"]);
    expect(readRegistry()).toEqual([DEAD_PROJECT]);
  });

  it("with neither --yes nor --no-sync refuses before installing and names both flags", () => {
    const res = run(["upgrade"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("gnosys upgrade is interactive and requires a terminal (stdin is not a TTY).");
    expect(res.stderr).toContain("Pass --yes (upgrade, then sync projects) or --no-sync (upgrade only)");
    expect(npmCalls()).toEqual([]);
  });

  it("--json without --yes or --no-sync reports the refusal as JSON and installs nothing", () => {
    const res = run(["upgrade", "--json"]);
    expect(res.status).toBe(1);
    const out = JSON.parse(res.stdout);
    expect(out.ok).toBe(false);
    expect(out.error).toBe(
      "gnosys upgrade --json cannot prompt. Pass --yes (upgrade, then sync projects) or --no-sync (upgrade only).",
    );
    expect(npmCalls()).toEqual([]);
  });
});

describe("gnosys setup sync-projects without a terminal", () => {
  it("--json without --yes leaves stale registry entries in place", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["setup", "sync-projects", "--json", "--skip-dashboard"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out).toMatchObject({ ok: true, total: 1, skipped: [DEAD_PROJECT], registryCleanup: null, dashboard: null });
    expect(readRegistry()).toEqual([DEAD_PROJECT]);
  });

  it("--yes --json removes stale registry entries and writes the dashboard", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["setup", "sync-projects", "--yes", "--json"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.registryCleanup).toEqual({ removed: 1, kept: 0, wrote: true });
    expect(out.dashboard).toEqual({
      html: path.join(sb.user, "gnosys-dashboard.html"),
      md: path.join(sb.user, "gnosys-dashboard.md"),
    });
    expect(readRegistry()).toEqual([]);
  });

  it("--help prints the sync-projects usage, not top-level help", () => {
    const res = run(["setup", "sync-projects", "--help"]);
    expect(res.status).toBe(0);
    expect(res.stdout.split("\n")[0]).toBe("Usage: gnosys setup sync-projects [options]");
    expect(res.stdout).toContain("--yes");
    expect(res.stdout).toContain("--json");
  });
});

describe("gnosys cleanup without a terminal", () => {
  it("refuses to prompt and names --yes and --dry-run", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["cleanup"]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim()).toBe(
      "gnosys cleanup is interactive and requires a terminal (stdin is not a TTY). Pass --yes or --dry-run to run it without prompts.",
    );
    expect(readRegistry()).toEqual([DEAD_PROJECT]);
  });

  it("--dry-run --json prints only JSON and writes nothing", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["cleanup", "--dry-run", "--json"]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual({
      ok: true,
      dryRun: true,
      removed: 1,
      kept: 0,
      wrote: false,
      entries: { alive: [], dead: [DEAD_PROJECT], temp: [] },
    });
    expect(readRegistry()).toEqual([DEAD_PROJECT]);
  });

  it("--yes --json removes the stale entry", () => {
    writeRegistry([DEAD_PROJECT]);
    const res = run(["cleanup", "--yes", "--json"]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toMatchObject({ ok: true, dryRun: false, removed: 1, kept: 0, wrote: true });
    expect(readRegistry()).toEqual([]);
  });
});

describe("gnosys doctor without a terminal", () => {
  function seedLegacyStore(legacyIds: string[]): { project: string; legacyDb: string } {
    const project = path.join(sb.root, "project");
    const store = path.join(project, ".gnosys");
    fs.mkdirSync(store, { recursive: true });
    const legacyDb = path.join(store, "gnosys.db");
    const legacy = new GnosysDB(store);
    for (const id of legacyIds) legacy.insertMemory(makeMemory({ id }));
    legacy.close();
    return { project, legacyDb };
  }

  it("--json prints a parseable report", () => {
    const res = run(["doctor", "--json"]);
    expect(res.status).toBe(0);
    const report = JSON.parse(res.stdout);
    expect(Object.keys(report)).toEqual([
      "embeddingRuntime", "legacyStore", "centralDb", "stores", "archive", "recall", "soc", "llm", "maintenance",
    ]);
    expect(report.centralDb.path).toBe(path.join(sb.home, "gnosys.db"));
    expect(report.legacyStore).toBeNull();
    expect(report.recall).toEqual({ mode: "aggressive", maxMemories: 8, minRelevance: 0.4 });
  });

  it("--fix without --yes refuses to prompt and names --yes", () => {
    const res = run(["doctor", "--fix"]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim()).toBe(
      "gnosys doctor --fix is interactive and requires a terminal (stdin is not a TTY). Pass --yes to run it without prompts.",
    );
  });

  it("--fix --yes removes a legacy store whose rows are all in the central DB", () => {
    const central = new GnosysDB(sb.home);
    central.insertMemory(makeMemory({ id: "legacy-migrated-1" }));
    central.close();
    const { project, legacyDb } = seedLegacyStore(["legacy-migrated-1"]);
    const res = spawnInProject(project, ["doctor", "--fix", "--yes", "--json"]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout).legacyStore).toEqual({ path: legacyDb, action: "removed", reason: null });
    expect(fs.existsSync(legacyDb)).toBe(false);
  });

  it("--fix --yes keeps a legacy store with rows missing from the central DB", () => {
    const { project, legacyDb } = seedLegacyStore(["legacy-unmigrated-1"]);
    const res = spawnInProject(project, ["doctor", "--fix", "--yes", "--json"]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout).legacyStore).toEqual({
      path: legacyDb,
      action: "unsafe",
      reason: "1 of 1 local memories not found in central DB",
    });
    expect(fs.existsSync(legacyDb)).toBe(true);
  });

  function spawnInProject(cwd: string, args: string[]) {
    const prev = sb.root;
    sb.root = cwd;
    try {
      return run(args);
    } finally {
      sb.root = prev;
    }
  }
});

describe("interactive setup sections fail fast without a terminal", () => {
  const cases: Array<{ args: string[]; flow: string; skip: string | null }> = [
    { args: ["setup", "providers"], flow: "setup providers", skip: null },
    { args: ["setup", "routing"], flow: "setup routing", skip: null },
    { args: ["setup", "preferences"], flow: "setup preferences", skip: null },
    { args: ["setup", "ides"], flow: "setup ides", skip: "--all" },
    { args: ["setup", "remote"], flow: "setup remote", skip: "--path <dir>" },
    { args: ["migrate"], flow: "migrate", skip: "--yes" },
  ];
  for (const c of cases) {
    it(`gnosys ${c.args.join(" ")}`, () => {
      const res = run(c.args);
      expect(res.status).toBe(1);
      const tail = c.skip ? `Pass ${c.skip} to run it without prompts.` : "Re-run from an interactive shell.";
      expect(res.stderr.trim()).toBe(
        `gnosys ${c.flow} is interactive and requires a terminal (stdin is not a TTY). ${tail}`,
      );
    });
  }
});
