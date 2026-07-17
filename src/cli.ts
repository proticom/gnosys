#!/usr/bin/env node
/**
 * Gnosys CLI — Thin wrapper around the core modules.
 * Uses the resolver for layered multi-store support.
 *
 * v6.2.1 cli split: per-domain command registrations live in src/cli/*.ts
 * (extracted verbatim); this file is the entry point — program setup,
 * global hooks, and the register* composers in the original order.
 */

import { Command } from "commander";
import path from "path";
import dotenv from "dotenv";
import { readFileSync } from "fs";
// v5.8.0 (#4): only the lightweight modules are imported at top-level.
// Anything that pulls @huggingface/transformers, mammoth/pdf-parse/turndown,
// large file-walking machinery, or otherwise costs >100ms to load gets
// `await import(...)` inside its own action handler. This keeps
// `gnosys --help` and other lightweight commands fast.
import { GnosysDB } from "./lib/db.js";
import { pkg } from "./cli/_shared.js";
// Lazy-loaded inside action handlers (each ~200ms-2.5s on cold cache):
//   - ./lib/embeddings.js       (@huggingface/transformers — 80MB)
//   - ./lib/hybridSearch.js     (depends on embeddings)
//   - ./lib/ask.js              (depends on hybridSearch)
//   - ./lib/import.js           (mammoth, pdf-parse, turndown)
//   - ./lib/bootstrap.js        (file walking — 2.5s)
//   - ./lib/ingest.js           (LLM machinery)
//   - ./lib/migrate.js          (only migrate-db needs it)
import { registerCore } from "./cli/core.js";
import { registerSetup } from "./cli/setup.js";
import { registerProject } from "./cli/project.js";
import { registerMemory } from "./cli/memory.js";
import { registerBrowse } from "./cli/browse.js";
import { registerData } from "./cli/data.js";
import { registerMaintenance } from "./cli/maintenance.js";
import { registerDream } from "./cli/dream.js";
import { registerExport } from "./cli/exportCmds.js";
import { registerRuntime } from "./cli/runtime.js";
import { registerRemote } from "./cli/remote.js";
import { registerAgent } from "./cli/agent.js";
import { registerSandbox } from "./cli/sandbox.js";
import { registerTrace } from "./cli/trace.js";
import { registerWeb } from "./cli/web.js";

// Load API keys from ~/.config/gnosys/.env (same as MCP server)
// IMPORTANT: We use dotenv.parse() instead of dotenv.config() because
// dotenv v17+ writes injection notices to stdout, which corrupts
// --json output and piped usage. parse() is a pure function with no side effects.
const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
try {
  const envFile = readFileSync(path.join(home, ".config", "gnosys", ".env"), "utf8");
  const parsed = dotenv.parse(envFile);
  for (const [key, val] of Object.entries(parsed)) {
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env file not found — that's fine, env vars may be set elsewhere
}
// Also try .env from current directory as fallback
try {
  const localEnv = readFileSync(".env", "utf8");
  const localParsed = dotenv.parse(localEnv);
  for (const [key, val] of Object.entries(localParsed)) {
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No local .env — fine
}

const program = new Command();

/**
 * Phase F: True if the CLI process is running inside a test harness.
 * Any code path that would otherwise OPEN the central DB (which
 * implicitly creates ~/.gnosys/gnosys.db) MUST short-circuit on this.
 */
function isTestEnv(): boolean {
  return (
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.CI === "true"
  );
}

// v5.9.3 Phase H: `maybePrintUpgradeNudge` (cli.ts:92-118 in v5.9.2) was
// the second of two upgrade-nag mechanisms — both fired on every CLI
// invocation and both opened the central DB. It is now deleted; the
// post-install block at the BOTTOM of this file is the single source of
// truth, runs on stderr only, and is downgrade-aware (`reverted`/
// `upgraded`).

/**
 * v5.6.0 back-compat shim: rewrite `gnosys export --to <dir>` →
 * `gnosys export vault --to <dir>` before commander parses argv. The v5.6.0
 * restructure made `export` a parent command with `vault` and `project`
 * subcommands; without this shim, the bare `--to` form prints usage instead
 * of running the vault export.
 *
 * Pattern: argv[2]==="export" AND argv[3] is not a known subcommand AND any
 * of the v5.5.x flags appear (`--to`, `--all`, `--overwrite`, etc.).
 */
function rewriteLegacyExport(): void {
  if (process.argv[2] !== "export") return;
  const next = process.argv[3];
  if (next === "vault" || next === "project" || next === "--help" || next === "-h") return;
  // Any v5.5.x-style flag → assume legacy vault invocation
  const looksLegacy = process.argv.slice(3).some((a) =>
    a === "--to" || a.startsWith("--to=") ||
    a === "--all" || a === "--overwrite" ||
    a === "--no-summaries" || a === "--no-reviews" || a === "--no-graph" ||
    a === "--json"
  );
  if (looksLegacy) {
    process.argv.splice(3, 0, "vault");
  }
}

rewriteLegacyExport();

program
  .name("gnosys")
  .description("Gnosys — Persistent memory for AI agents. Sandbox-first runtime, central SQLite brain, federated search, reflection API, process tracing, preferences, Dream Mode, Obsidian export. Also runs as a full MCP server.")
  .version(pkg.version)
  .addHelpText("after", `
Commands by group (alphabetical within group):
  Setup & status:    setup · status · doctor · check · upgrade
  Memory ops:        add · add-structured · update · read · reinforce · ingest
                     bootstrap · import · export
  Search:            discover · search · hybrid-search · semantic-search · ask · recall
                     fsearch · briefing · lens
  Project mgmt:      init · projects · list · stats · timeline · graph · tags · tags-add
                     stale · history · rollback · audit · links
  Maintenance:       maintain · reindex · reindex-graph · dearchive · dream · backup · restore · prune
  Multi-machine:     setup remote (configure | status | push | pull | sync | resolve)
  Agent runtime:     serve · sandbox · helper · pref · sync · update-status · working-set
  Legacy / advanced: dashboard · migrate · migrate-db · stores · config

Run 'gnosys <command> --help' for command-specific help.
`)
  .hook("preAction", async () => {
    // v5.8.5: warn only when the DB stamp is NEWER than the running binary
    // (i.e. another machine on the shared brain already upgraded). The old
    // check fired whenever the versions differed — including the common
    // "you just installed a newer gnosys but haven't run sync-projects yet"
    // case, which produced a misleading "Run: npm install -g gnosys"
    // banner on every command.
    //
    // v5.9.3 (Phase F): skip in tests so we don't auto-create the central DB.
    if (isTestEnv()) return;
    try {
      const centralDb = GnosysDB.openCentral();
      if (centralDb.isAvailable()) {
        const dbVersion = centralDb.getMeta("app_version");
        if (dbVersion && compareSemver(dbVersion, pkg.version) > 0) {
          const upgradedBy = centralDb.getMeta("upgraded_by") || "another machine";
          console.error(
            `\n⚠ Gnosys DB was upgraded to v${dbVersion} by ${upgradedBy}.` +
            `\n  You are running v${pkg.version}. Run: npm install -g gnosys && gnosys upgrade\n`
          );
        }
        centralDb.close();
      }
    } catch {
      // non-critical — don't block the command
    }
  });

/**
 * Compare two semver-like strings. Returns -1, 0, 1. Tolerant of suffixes —
 * compares the dotted-numeric prefix only.
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(/[-+]/)[0].split(".").map((p) => parseInt(p, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const ap = av[i] ?? 0;
    const bp = bv[i] ?? 0;
    if (ap !== bp) return ap > bp ? 1 : -1;
  }
  return 0;
}

// ─── Command registrations (order preserved — affects --help listing) ────
registerCore(program);
registerSetup(program);
registerProject(program);
registerMemory(program);
registerBrowse(program);
registerData(program);
registerMaintenance(program);
registerDream(program);
registerExport(program);
registerRuntime(program);
registerRemote(program);
registerAgent(program);
registerSandbox(program);
registerTrace(program);
registerWeb(program);

// ─── Post-install upgrade nudge ─────────────────────────────────────────
// v5.8.5: only nudges when the running binary is NEWER than the DB stamp
// (i.e. you just installed a fresh version locally and haven't run
// sync-projects to refresh the stamp yet). The previous version fired on
// any mismatch — including "another machine bumped the stamp ahead of
// you" which is a separate concern handled by the preAction warning.
// Also avoids re-nudging once per command for the same version-pair by
// honoring a per-session env-var sentinel.
//
// v5.9.3 Phase H consolidation lives BELOW this block; Phase F guards us
// from touching the DB at all in tests.
if (!isTestEnv()) {
  try {
    const centralDb = GnosysDB.openCentral();
    if (centralDb.isAvailable()) {
      const lastVersion = centralDb.getMeta("app_version");
      // GNOSYS_FORCE_VERSION lets the upgrade-nag tests pin a synthetic
      // "running" version independent of the real release number, so a .0
      // minor release can't break the patch/minor scenarios. Production
      // always falls through to pkg.version.
      const currentVersion = process.env.GNOSYS_FORCE_VERSION || pkg.version;
      const isUpgradeCmd = process.argv.slice(2).some(a => a === "upgrade");
      const isSetupSyncCmd = process.argv.slice(2).join(" ").includes("setup sync-projects");
      // CRITICAL: `serve` writes JSON-RPC to stdout for MCP transport. Any
      // console.log during boot corrupts the protocol and the host (Grok, Codex,
      // etc.) sees the server as [unavailable]. Suppress the nag in serve mode.
      const isServeCmd = process.argv.slice(2).some(a => a === "serve");
      // v5.14.0: recall-hook runs on every Claude Code prompt — keep its
      // stderr quiet too so hook error logs stay clean.
      const isHookCmd = process.argv.slice(2).some(a => a === "recall-hook");
      // v5.9.3 Phase H: fire on any mismatch (upgrade OR downgrade).
      const mismatch =
        lastVersion !== null && lastVersion !== undefined &&
        compareSemver(currentVersion, lastVersion) !== 0;
      if (mismatch && !isUpgradeCmd && !isSetupSyncCmd && !isServeCmd && !isHookCmd) {
        // v5.9.3 Phase H: emit on STDERR (was stdout). Safer invariant per
        // deci-045 — stdout is reserved for command output.
        const isMajorOrMinor = (() => {
          if (!lastVersion) return false;
          const oldParts = lastVersion.split(".").map(Number);
          const newParts = currentVersion.split(".").map(Number);
          return (oldParts[0] ?? 0) !== (newParts[0] ?? 0) || (oldParts[1] ?? 0) !== (newParts[1] ?? 0);
        })();
        const direction = compareSemver(currentVersion, lastVersion ?? "0.0.0") > 0 ? "upgraded" : "reverted";
        process.stderr.write("\n");
        process.stderr.write(` ⬢ gnosys ${direction} · v${lastVersion} → v${currentVersion}\n`);
        process.stderr.write("\n");
        if (direction === "upgraded") {
          process.stderr.write("   sync registered projects        gnosys upgrade\n");
          if (isMajorOrMinor) {
            process.stderr.write("   restart mcp                     cursor → MCP: restart all servers\n");
            process.stderr.write("                                   claude code → /mcp → restart gnosys\n");
            process.stderr.write("                                   codex → start new session\n");
          }
        } else {
          process.stderr.write("   if this was unintentional, run  gnosys upgrade\n");
        }
        process.stderr.write("\n");
      }
      centralDb.close();
    }
  } catch {
    // non-critical — don't block CLI startup
  }
}

// v5.12.x observability: all 100+ command actions are async — with bare
// program.parse() a thrown action error surfaced as a raw Node
// UnhandledPromiseRejection (full engine stack, no gnosys framing).
// parseAsync routes every action failure through one clean exit path.
program.parseAsync().catch(async (err: unknown) => {
  const { logError } = await import("./lib/log.js");
  logError(err, { module: "cli" });
  process.exitCode = 1;
});
