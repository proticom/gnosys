import { supportsSqliteRuntime } from "../dist/lib/sqliteStartup.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// npm run build && node scripts/check-sqlite-startup.mjs /path/to/node ...
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const mcp = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const report = [];
for (const node of process.argv.slice(2).length ? process.argv.slice(2) : [process.execPath]) {
  const base = mkdtempSync(join(tmpdir(), "gnosys-startup-matrix-"));
  const home = join(base, "home");
  const project = join(base, "project");
  mkdirSync(home);
  mkdirSync(project);
  const env = { PATH: process.env.PATH ?? "", HOME: home, USERPROFILE: home,
    GNOSYS_HOME: join(home, "gnosys"), GNOSYS_CONFIG_DIR: join(home, "config"),
    GNOSYS_PERSONAL: join(home, "personal"), GNOSYS_GLOBAL: join(home, "global"),
    GNOSYS_STORES: "", GNOSYS_CACHE_DIR: join(home, "cache"), GNOSYS_LOCAL_ONLY: "1",
    GNOSYS_DREAM_ENABLED: "false", NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" };
  const version = spawnSync(node, ["-p", "process.versions.node"], { encoding: "utf8", env }).stdout.trim();
  const supported = supportsSqliteRuntime(version);
  const message = `gnosys requires Node ^22.16.0 || >=24.0.0 with FTS5; running Node ${version}: version out of range\n`;
  const commands = [
    ["init"],
    ["add-structured", "--title", "Matrix memory", "--category", "decisions", "--content", "persistent startup matrix"],
    ["search", "persistent"],
    ["projects"], ["backup", "--to", join(base, "backups")],
  ];
  try {
    for (const args of [...commands.map(args => [cli, ...args]), [mcp]]) {
      const result = spawnSync(node, args, { cwd: project, env, encoding: "utf8", input: "", timeout: supported && args[0] === mcp ? 2000 : 30_000 });
      const command = args[0] === mcp ? "MCP (stdin closed)" : args[1];
      report.push({ version, command, exit: result.status, signal: result.signal, stderr: result.stderr.trim(), stdout: result.stdout.trim(), home, gnosys: env.GNOSYS_HOME, project });
      if (supported && args[0] === mcp) {
        // Stop the server after readiness; a closed stdin can leave roots/list pending.
        assert.match(result.stderr, /handshake ready/);
      } else {
        assert.equal(result.status, supported ? 0 : 1, JSON.stringify(report.at(-1)));
      }
      if (!supported) {
        assert.equal(result.stderr, message);
        assert.equal(result.stdout, "");
      }
      if (supported && command === "search") assert.match(result.stdout, /Matrix memory/);
      assert.doesNotMatch(result.stderr, /ExperimentalWarning/);
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
}
console.log(JSON.stringify(report, null, 2));
