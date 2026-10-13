/**
 * `gnosys upgrade` — install the latest gnosys globally, signal running MCP
 * servers to restart, then refresh registered projects (sync-projects).
 *
 *   --yes      accept the defaults: upgrade, then `setup sync-projects --yes`
 *              (which also removes dead/temp registry entries)
 *   --no-sync  upgrade only
 *   --json     one JSON document on stdout; human text goes to stderr
 *
 * Without a terminal the post-upgrade prompt cannot be answered, so the
 * command refuses before installing anything unless --yes or --no-sync says
 * what to do.
 */

import { execSync, spawn } from "child_process";
import { nonInteractiveMessage } from "./interactiveGuard.js";
import type { SyncProjectsResult } from "./setupSyncProjectsCommand.js";

export type UpgradeCommandOptions = {
  yes?: boolean;
  /** commander maps --no-sync to sync: false */
  sync?: boolean;
  json?: boolean;
};

type SyncPlan = { kind: "run" } | { kind: "skip" } | { kind: "ask" } | { kind: "refuse"; message: string };

export function planSync(opts: UpgradeCommandOptions, stdinIsTTY: boolean): SyncPlan {
  if (opts.sync === false) return { kind: "skip" };
  if (opts.yes) return { kind: "run" };
  const skip = "--yes (upgrade, then sync projects) or --no-sync (upgrade only)";
  if (opts.json) return { kind: "refuse", message: `gnosys upgrade --json cannot prompt. Pass ${skip}.` };
  if (!stdinIsTTY) return { kind: "refuse", message: nonInteractiveMessage("upgrade", skip) };
  return { kind: "ask" };
}

interface UpgradeResult {
  ok: boolean;
  previousVersion: string;
  installedVersion: string | null;
  packageManager: string;
  installCommand: string | null;
  markerWritten: boolean;
  dreamRepair: string | null;
  sync: { ran: false } | { ran: true; result: SyncProjectsResult | null };
  error?: string;
}

function runInstall(cmd: string, json: boolean): Promise<void> {
  return import("./installOutput.js").then(
    ({ makeNpmStderrFilter }) =>
      new Promise<void>((resolve, reject) => {
        // Filter the two unfixable, harmless deprecation warnings (see
        // installOutput.ts). In JSON mode the installer's stdout goes to
        // stderr so stdout carries only the result document.
        const child = spawn(cmd, {
          shell: true,
          stdio: json ? ["ignore", "pipe", "pipe"] : ["inherit", "inherit", "pipe"],
        });
        const filter = makeNpmStderrFilter((text) => process.stderr.write(text));
        child.stdout?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => filter.feed(chunk));
        child.on("error", reject);
        child.on("close", (code) => {
          filter.end();
          if (code === 0) resolve();
          else reject(new Error(`${cmd} exited with code ${code}`));
        });
      }),
  );
}

async function askYesDefault(question: string): Promise<boolean> {
  const { createInterface } = await import("readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer !== "n" && answer !== "no";
  } finally {
    rl.close();
  }
}

export async function runUpgradeCommand(currentVersion: string, opts: UpgradeCommandOptions): Promise<void> {
  const json = Boolean(opts.json);
  const say = (line = ""): void => {
    if (json) process.stderr.write(`${line}\n`);
    else console.log(line);
  };
  const result: UpgradeResult = {
    ok: true,
    previousVersion: currentVersion,
    installedVersion: null,
    packageManager: "npm",
    installCommand: null,
    markerWritten: false,
    dreamRepair: null,
    sync: { ran: false },
  };
  const fail = (message: string): void => {
    console.error(message);
    if (json) console.log(JSON.stringify({ ...result, ok: false, error: message }, null, 2));
    process.exitCode = 1;
  };

  const plan = planSync(opts, Boolean(process.stdin.isTTY));
  if (plan.kind === "refuse") {
    fail(plan.message);
    return;
  }

  say(`Gnosys CLI: currently v${currentVersion}`);
  const { detectPackageManager, upgradeCommand } = await import("./packageManager.js");
  const pm = detectPackageManager();
  const cmd = upgradeCommand(pm);
  result.packageManager = pm;
  result.installCommand = cmd;
  if (!cmd) {
    say("Running under npx — there's no global install to upgrade. Use `npx gnosys@latest` to run the latest.");
    if (json) console.log(JSON.stringify(result, null, 2));
    return;
  }

  say(`Running: ${cmd} ...`);
  try {
    await runInstall(cmd, json);
  } catch (err) {
    fail(`\nUpgrade failed: ${err instanceof Error ? err.message : err}\nTry running '${cmd}' manually.`);
    return;
  }

  const { EMBEDDING_INSTALL_HINT } = await import("./embeddingHealth.js");
  say(`Check optional embeddings with gnosys doctor. If unavailable, run: ${EMBEDDING_INSTALL_HINT}`);

  // Best-effort: this process is still the old binary, so ask npm what landed.
  try {
    const out = execSync("npm ls -g gnosys --depth=0 --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const parsed = JSON.parse(out) as { dependencies?: { gnosys?: { version?: string } } };
    result.installedVersion = parsed.dependencies?.gnosys?.version ?? null;
  } catch {
    // Best-effort lookup only.
  }
  if (result.installedVersion && result.installedVersion !== currentVersion) {
    say(`\n✓ Installed gnosys v${result.installedVersion} (was v${currentVersion})`);
  } else if (result.installedVersion === currentVersion) {
    say(`\n✓ Already on latest: v${currentVersion}`);
  }
  say("  (known-benign deprecation warnings from optional native deps were suppressed)");

  // Running MCP servers watch this marker, exit, and get respawned on the new binary.
  const { writeUpgradeMarker } = await import("./upgrade.js");
  try {
    writeUpgradeMarker(result.installedVersion ?? currentVersion);
    result.markerWritten = true;
    say(`\n✓ Upgrade marker written: ~/.gnosys/last-upgrade-at`);
    say(`  Any running MCP servers will detect this within 10s and restart cleanly.`);
    say(`  (Your MCP client — Claude Code, Cursor, VS Code — will auto-respawn.)`);
  } catch (err) {
    say(`\nCould not write upgrade marker: ${err instanceof Error ? err.message : err}`);
    say(`Running MCP servers will need to be restarted manually.`);
  }

  // v5.15: a Node upgrade moves the node path hardcoded in the dream
  // LaunchAgent plist, silently killing the scheduler. Repair it here.
  const { repairDreamLaunchAgentAfterUpgrade } = await import("./dreamLaunchd.js");
  result.dreamRepair = await repairDreamLaunchAgentAfterUpgrade();
  if (result.dreamRepair) say(`\n${result.dreamRepair}`);

  const runSync =
    plan.kind === "run" ||
    (plan.kind === "ask" && (await askYesDefault(`\nRun 'gnosys setup sync-projects' now to refresh registered projects? [Y/n] `)));
  if (!runSync) {
    say(`\nDone. Run 'gnosys setup sync-projects' when you're ready to refresh registered projects.`);
    if (json) console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Spawn the freshly installed binary from PATH: this process still holds
  // the old pkg.version, so an in-process sync would print the old banner.
  say("");
  const syncCmd = `gnosys setup sync-projects${opts.yes ? " --yes" : ""}${json ? " --json" : ""}`;
  try {
    if (json) {
      const out = execSync(syncCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
      result.sync = { ran: true, result: JSON.parse(out) as SyncProjectsResult };
    } else {
      execSync(syncCmd, { stdio: "inherit" });
      result.sync = { ran: true, result: null };
    }
  } catch (err) {
    fail(`\nSync-projects failed: ${err instanceof Error ? err.message : err}\nRun 'gnosys setup sync-projects' manually.`);
    return;
  }
  if (json) console.log(JSON.stringify(result, null, 2));
}
