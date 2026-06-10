/**
 * Interactive wizard for multi-machine sync (v13 design).
 *
 * Flows:
 *  - Fresh setup: explanation → master vs client → role-specific prompts
 *  - Reconfigure: change path, re-validate, or disconnect (when already configured)
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, renameSync, readFileSync } from "fs";
import * as path from "path";
import { createInterface, type Interface } from "readline/promises";
import { GnosysDB } from "./db.js";
import {
  RemoteSync,
  validateLocation,
  getConfiguredRemotePath,
  clearRemoteSyncConfig,
  type RemoteStatus,
} from "./remote.js";
import {
  ensureMachineConfig,
  writeMachineConfig,
  readMachineConfig,
  type MultiMachineRole,
} from "./machineConfig.js";
import { getGnosysHome } from "./paths.js";
import { atomicWriteFileSync } from "./atomicWrite.js";
import { readMasterMarker, writeMasterMarker } from "./masterLease.js";
import {
  checkMasterPathLocalDisk,
  matchesLocalDiskAck,
  LOCAL_DISK_ACK_PHRASE,
} from "./localDiskCheck.js";
import { stagingDirForMachine, clientPresencePath, machineStagingDir } from "./syncStaging.js";
import { safeQuestion } from "./setup/ui/safePrompt.js";
import { Spinner } from "./setup/ui/spinner.js";
import { printStatus } from "./setup/ui/status.js";
import { Footer } from "./setup/ui/footer.js";
import {
  renderRemoteIntro,
  renderValidationSummary,
  renderRemoteDiff,
  renderV13ExplanationScreen,
  renderMasterBackupWarning,
  renderBackupDeclineAckPrompt,
  BACKUP_RISK_PHRASE,
  TAILSCALE_GUIDE_URL,
} from "./setup/remoteRender.js";

const REMOTE_PATH_KEY = "remote_path";
const REMOTE_MODE_KEY = "remote_mode";
const PRE_MASTER_BACKUP_NAME = ".pre-master-backup";

export { BACKUP_RISK_PHRASE, TAILSCALE_GUIDE_URL };

const TAILSCALE_INLINE_FALLBACK = `Tailscale lets other machines reach this one as if it were on the same LAN.
Install Tailscale on each machine, sign in with the same account, then use the master folder path
that Tailscale exposes (often under /Volumes/ or a synced folder path).`;

export async function showTailscaleClientGuide(rl: Interface): Promise<void> {
  console.log("");
  console.log(
    "You will need a way for this machine to reach the master folder (usually Tailscale).",
  );
  console.log("A basic explanation is shown below. For a full walkthrough, visit:");
  console.log(`  ${TAILSCALE_GUIDE_URL}`);
  console.log(
    "(If that page is unavailable, this inline text is the primary source.)",
  );
  console.log("");
  const open = await askConfirm(rl, "Open the guide in your browser now?", false);
  if (open) {
    try {
      const { execSync } = await import("child_process");
      if (process.platform === "darwin") {
        execSync(`open "${TAILSCALE_GUIDE_URL}"`, { stdio: "ignore" });
      } else if (process.platform === "win32") {
        execSync(`start "" "${TAILSCALE_GUIDE_URL}"`, { stdio: "ignore", shell: "cmd.exe" });
      } else {
        execSync(`xdg-open "${TAILSCALE_GUIDE_URL}"`, { stdio: "ignore" });
      }
    } catch {
      console.log(TAILSCALE_INLINE_FALLBACK);
    }
  } else {
    console.log(TAILSCALE_INLINE_FALLBACK);
  }
  console.log("");
}

/** Returns true when the user typed the exact expected phrase (trimmed). */
export function matchesTypedPhrase(input: string, expected: string): boolean {
  return input.trim() === expected;
}

/**
 * Cloned-install detection: a presence file already exists for this machineId
 * (typical after VM clone / backup restore).
 */
export function detectClonedStagingPresence(masterPath: string, machineId: string): boolean {
  return existsSync(clientPresencePath(masterPath, machineId));
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function ask(rl: Interface, prompt: string): Promise<string> {
  return (await safeQuestion(rl, prompt)).trim();
}

async function askChoice(
  rl: Interface,
  prompt: string,
  choices: { key: string; label: string }[],
  defaultKey?: string,
): Promise<string> {
  const lines = [prompt];
  for (const c of choices) {
    const marker = c.key === defaultKey ? " (default)" : "";
    lines.push(`  ${c.key}) ${c.label}${marker}`);
  }
  console.log(lines.join("\n"));
  const valid = new Set(choices.map((c) => c.key));
  for (let attempts = 0; attempts < 5; attempts++) {
    const answer = (await ask(rl, "Choice: ")).toLowerCase();
    if (!answer && defaultKey) return defaultKey;
    if (valid.has(answer)) return answer;
    console.log(`Invalid choice. Pick one of: ${[...valid].join(", ")}`);
  }
  throw new Error("Too many invalid responses");
}

async function askConfirm(rl: Interface, prompt: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await ask(rl, prompt + hint)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

async function askTypedPhrase(rl: Interface, prompt: string, expected: string): Promise<boolean> {
  const typed = await ask(rl, prompt);
  return matchesTypedPhrase(typed, expected);
}

function showValidationSummary(validation: Awaited<ReturnType<typeof validateLocation>>): void {
  console.log(
    renderValidationSummary({
      pathExists: validation.checks.pathExists,
      writable: validation.checks.writable,
      sqliteCompatible: validation.checks.sqliteCompatible,
      latencyMs: validation.checks.latencyMs,
      existing: {
        found: validation.checks.existingDb.found,
        memoryCount: validation.checks.existingDb.memoryCount ?? null,
        lastModified: validation.checks.existingDb.lastModified ?? null,
      },
      warnings: validation.warnings,
      errors: validation.errors,
    }),
  );
}

function persistMultiMachineConfig(
  localDb: GnosysDB,
  masterPath: string,
  role: MultiMachineRole,
): void {
  localDb.setMeta(REMOTE_PATH_KEY, masterPath);
  localDb.setMeta(REMOTE_MODE_KEY, role);
  const mc = ensureMachineConfig().config;
  mc.remote = { enabled: true, path: masterPath, role };
  writeMachineConfig(mc);
}

function archiveLocalDbBeforeMaster(): void {
  const home = getGnosysHome();
  const dbPath = path.join(home, "gnosys.db");
  const backupPath = path.join(home, PRE_MASTER_BACKUP_NAME);
  if (existsSync(dbPath) && !existsSync(backupPath)) {
    renameSync(dbPath, backupPath);
  }
}

function writeClientPresenceFile(masterPath: string, machineId: string): void {
  const dir = machineStagingDir(masterPath, machineId);
  mkdirSync(dir, { recursive: true });
  const presencePath = clientPresencePath(masterPath, machineId);
  if (!existsSync(presencePath)) {
    atomicWriteFileSync(
      presencePath,
      JSON.stringify({ machineId, firstSeenAt: new Date().toISOString() }, null, 2) + "\n",
    );
  }
}

async function pickFolderPath(
  rl: Interface,
  prompt: string,
  defaultPath?: string,
): Promise<string | null> {
  const hint = defaultPath ? ` [${defaultPath}] ` : " ";
  const raw = await ask(rl, prompt + hint);
  const chosen = raw || defaultPath || "";
  if (!chosen) return null;
  return path.resolve(chosen);
}

// ─── Main wizard ────────────────────────────────────────────────────────

export async function runConfigureWizard(
  centralDb: GnosysDB,
  externalRl?: Interface,
): Promise<boolean> {
  const ownsRl = !externalRl;
  const rl = externalRl ?? createInterface({ input: process.stdin, output: process.stdout });
  try {
    const localCount = centralDb.getMemoryCount();
    const currentRemote = getConfiguredRemotePath(centralDb);

    if (currentRemote) {
      console.log("");
      console.log(renderRemoteIntro(localCount.active, localCount.archived, currentRemote));
      console.log("");
      const choice = await askChoice(rl, "What would you like to do?", [
        { key: "1", label: "Change master folder path" },
        { key: "2", label: "Re-validate current master folder" },
        { key: "3", label: "Disconnect multi-machine sync (single-machine only)" },
        { key: "4", label: "Cancel" },
      ], "4");

      if (choice === "4") return false;
      if (choice === "3") return await disconnectRemote(rl, centralDb);
      if (choice === "2") return await revalidateRemote(rl, centralDb, currentRemote);
      // choice 1: fall through to fresh v13 flow with explanation skipped? Use change-path only
      return await changeMasterPathFlow(rl, centralDb, currentRemote);
    }

    return await runFreshV13SetupFlow(rl, centralDb, localCount.active);
  } finally {
    if (ownsRl) rl.close();
  }
}

async function runFreshV13SetupFlow(
  rl: Interface,
  centralDb: GnosysDB,
  localActiveCount: number,
): Promise<boolean> {
  console.log(renderV13ExplanationScreen());
  console.log("");
  const proceed = await askConfirm(rl, "Would you like to set this up?", true);
  if (!proceed) {
    printStatus("progress", "staying single-machine", "multi-machine sync not configured");
    return false;
  }

  console.log("");
  const roleChoice = await askChoice(
    rl,
    "Is this machine going to be the master, or a client that joins an existing master?",
    [
      { key: "1", label: "This machine is the master (it will hold the main folder)" },
      { key: "2", label: "This machine is a client (it will connect to a master on another machine)" },
      { key: "3", label: "Cancel" },
    ],
    "3",
  );

  if (roleChoice === "3") return false;
  if (roleChoice === "1") {
    return await runMasterSetupFlow(rl, centralDb, localActiveCount);
  }
  return await runClientSetupFlow(rl, centralDb, localActiveCount);
}

async function runMasterSetupFlow(
  rl: Interface,
  centralDb: GnosysDB,
  localActiveCount: number,
): Promise<boolean> {
  console.log(renderMasterBackupWarning());
  const keepBackups = await askConfirm(
    rl,
    "Do you want to keep automatic backups enabled?",
    true,
  );
  if (!keepBackups) {
    console.log(renderBackupDeclineAckPrompt());
    if (!(await askTypedPhrase(rl, "Phrase: ", BACKUP_RISK_PHRASE))) {
      printStatus("warn", "backup acknowledgement required", "setup cancelled");
      return false;
    }
  }

  let moveExisting = false;
  if (localActiveCount > 0) {
    console.log("");
    console.log(`This machine already has a local brain with ${localActiveCount} memories.`);
    console.log("");
    const brainChoice = await askChoice(rl, "Do you want to:", [
      { key: "1", label: "Move the existing brain into the master folder (recommended)" },
      { key: "2", label: "Start a fresh master folder (existing local memories will be ignored)" },
    ], "1");
    moveExisting = brainChoice === "1";
  }

  console.log("");
  console.log(
    "The master database must live on this machine's local disk (not NAS, iCloud, Dropbox, or a network mount).",
  );
  console.log("");

  const defaultMaster = path.join(getGnosysHome(), "master-brain");
  const masterPath = await pickFolderPath(
    rl,
    "Master folder path on this machine's local disk:",
    defaultMaster,
  );
  if (!masterPath) {
    printStatus("warn", "no path provided", "setup cancelled");
    return false;
  }

  const diskCheck = checkMasterPathLocalDisk(masterPath);
  console.log(`\n${diskCheck.message}`);
  if (diskCheck.verdict === "network") {
    printStatus("fail", "master folder must be on local disk, not a network mount");
    return false;
  }
  if (diskCheck.verdict === "unknown") {
    console.log(`\nType this phrase exactly to continue:\n  ${LOCAL_DISK_ACK_PHRASE}\n`);
    if (!(await askTypedPhrase(rl, "Phrase: ", LOCAL_DISK_ACK_PHRASE))) {
      printStatus("warn", "local disk acknowledgement required", "setup cancelled");
      return false;
    }
  }

  console.log("");
  const validateSpinner = Spinner(`checking ${masterPath}…`);
  const validation = await validateLocation(masterPath);
  if (validation.ok) {
    const latency = validation.checks.latencyMs;
    validateSpinner.ok("folder ready", latency !== null ? `${latency} ms` : undefined);
  } else {
    validateSpinner.fail("validation failed");
  }
  showValidationSummary(validation);
  if (!validation.ok) {
    printStatus("fail", "master folder not configured");
    return false;
  }

  const { config: mc } = ensureMachineConfig();
  const existingMarker = readMasterMarker(masterPath);
  if (existingMarker?.holderMachineId && existingMarker.holderMachineId !== mc.machineId) {
    printStatus(
      "fail",
      "another machine already owns this master folder",
      `holder: ${existingMarker.holderMachineId}`,
    );
    const takeover = await askConfirm(
      rl,
      "Attempt stale-takeover (advanced — only if the previous master is gone)?",
      false,
    );
    if (!takeover) return false;
    writeMasterMarker(masterPath, mc.machineId, { previousEpoch: existingMarker.epoch });
  }

  const previousRemote = getConfiguredRemotePath(centralDb);
  persistMultiMachineConfig(centralDb, masterPath, "master");
  if (!existingMarker?.holderMachineId || existingMarker.holderMachineId === mc.machineId) {
    writeMasterMarker(masterPath, mc.machineId);
  }
  mkdirSync(path.join(masterPath, "backups"), { recursive: true });
  mkdirSync(path.join(masterPath, ".gnosys-staging"), { recursive: true });

  if (moveExisting) {
    const spin = Spinner(`moving local brain into ${masterPath}…`);
    const sync = new RemoteSync(centralDb, masterPath);
    try {
      const result = await sync.migrate();
      if (result.ok) {
        spin.ok("brain moved", `${result.copied} memories`);
      } else {
        spin.fail("migration had errors");
        for (const e of result.errors) printStatus("fail", e);
        return false;
      }
    } finally {
      sync.closeRemote();
    }
  }

  archiveLocalDbBeforeMaster();

  console.log("");
  console.log(renderRemoteDiff({ previousRemote, newRemote: masterPath, roleOrMode: "master" }));
  printStatus("ok", "saved", "machine.json + remote_path");
  console.log(Footer("run `gnosys remote status` to check sync state"));
  return true;
}

async function runClientSetupFlow(
  rl: Interface,
  centralDb: GnosysDB,
  localActiveCount: number,
): Promise<boolean> {
  await showTailscaleClientGuide(rl);

  const masterPath = await pickFolderPath(
    rl,
    "Enter the master folder path as it appears on this machine:",
  );
  if (!masterPath) {
    printStatus("warn", "no path provided", "setup cancelled");
    return false;
  }

  console.log("");
  const validateSpinner = Spinner(`checking ${masterPath}…`);
  const validation = await validateLocation(masterPath);
  if (validation.ok) {
    validateSpinner.ok("master folder reachable");
  } else {
    validateSpinner.fail("validation failed");
  }
  showValidationSummary(validation);
  if (!validation.ok) {
    printStatus("fail", "master folder not configured");
    return false;
  }

  const marker = readMasterMarker(masterPath);
  if (!marker?.holderMachineId) {
    printStatus(
      "warn",
      "no master.json found",
      "the folder may not be set up as a master yet — continue only if you trust this path",
    );
    const trust = await askConfirm(rl, "Continue anyway?", false);
    if (!trust) return false;
  }

  let { config: mc } = ensureMachineConfig();
  if (detectClonedStagingPresence(masterPath, mc.machineId)) {
    console.log("");
    printStatus(
      "warn",
      "presence file already exists for this machineId on the master",
      "common after VM clone or backup restore",
    );
    const remint = await askConfirm(rl, "Re-mint this machine's ID (recommended)?", true);
    if (remint) {
      mc = { ...mc, machineId: randomUUID() };
      writeMachineConfig(mc);
      printStatus("ok", "new machineId", mc.machineId);
    }
  }

  if (localActiveCount > 0) {
    console.log("");
    console.log(`This machine already has ${localActiveCount} memories locally.`);
    console.log("");
    console.log(
      "If you choose to keep them, they will be treated as NEW memories and sent to the master.",
    );
    console.log(
      "This may create duplicates if the same memories already exist on the master.",
    );
    console.log("");
    const dupChoice = await askChoice(rl, "Do you want to:", [
      {
        key: "1",
        label: "Keep the local memories and push them later (acknowledged risk of duplicates)",
      },
      { key: "2", label: "Start fresh (local memories will be ignored)" },
    ], "2");
    if (dupChoice === "1") {
      const ack = await askConfirm(
        rl,
        "Acknowledge duplicate risk and continue?",
        false,
      );
      if (!ack) return false;
    }
  }

  const previousRemote = getConfiguredRemotePath(centralDb);
  persistMultiMachineConfig(centralDb, masterPath, "client");
  writeClientPresenceFile(masterPath, mc.machineId);

  console.log("");
  console.log(renderRemoteDiff({ previousRemote, newRemote: masterPath, roleOrMode: "client" }));
  printStatus("ok", "saved", "machine.json + remote_path");
  console.log(Footer("client machines stage new memories; ingest runs on the master"));
  return true;
}

async function changeMasterPathFlow(
  rl: Interface,
  centralDb: GnosysDB,
  currentRemote: string,
): Promise<boolean> {
  const role =
    (readMachineConfig()?.remote.role as MultiMachineRole | undefined) ??
    (centralDb.getMeta(REMOTE_MODE_KEY) as MultiMachineRole | undefined) ??
    "client";

  const newPath = await pickFolderPath(
    rl,
    `New master folder path (current: ${currentRemote}):`,
  );
  if (!newPath || newPath === currentRemote) {
    printStatus("warn", "no change", "path unchanged");
    return false;
  }

  const validation = await validateLocation(newPath);
  showValidationSummary(validation);
  if (!validation.ok) return false;

  persistMultiMachineConfig(centralDb, newPath, role);
  if (role === "master") {
    const { config: mc } = ensureMachineConfig();
    const existing = readMasterMarker(newPath);
    if (existing?.holderMachineId && existing.holderMachineId !== mc.machineId) {
      printStatus("fail", "another machine owns the target master folder");
      return false;
    }
    writeMasterMarker(newPath, mc.machineId, { previousEpoch: existing?.epoch });
  }
  printStatus("ok", "master folder updated", newPath);
  return true;
}

// ─── Reconfigure helpers ────────────────────────────────────────────────

async function disconnectRemote(rl: Interface, localDb: GnosysDB): Promise<boolean> {
  const remotePath = getConfiguredRemotePath(localDb);
  if (!remotePath) {
    printStatus("warn", "multi-machine sync is not configured");
    return false;
  }

  const localCounts = localDb.getMemoryCount();
  let remoteCounts: { active: number; archived: number; total: number } | null = null;
  let syncStatus: RemoteStatus | null = null;

  const validation = await validateLocation(remotePath);
  const sync = new RemoteSync(localDb, remotePath);
  try {
    syncStatus = await sync.getStatus();
    const remoteDb = new GnosysDB(remotePath);
    if (remoteDb.isAvailable()) {
      remoteCounts = remoteDb.getMemoryCount();
      remoteDb.close();
    }
  } catch {
    // Remote unreadable — still show warning with validation hints below.
  } finally {
    sync.closeRemote();
  }

  const remoteReachable = Boolean(syncStatus?.reachable && validation.ok);
  const remoteActive = remoteCounts?.active ?? validation.checks.existingDb.memoryCount ?? null;

  console.log("");
  printStatus("warn", "disconnecting returns this machine to single-machine mode");
  console.log(`   local    ~/.gnosys/gnosys.db — ${localCounts.active} active memories`);
  if (remoteReachable && remoteActive !== null) {
    console.log(`   master   ${remotePath} — ${remoteActive} active memories`);
  } else {
    printStatus("warn", "master folder is not reachable", remotePath);
  }
  console.log("");
  console.log("  The master folder on disk is not deleted.");
  console.log("  After disconnect, this machine stops using multi-machine sync.");

  const confirm = await askConfirm(
    rl,
    "Disconnect now? (You can re-run setup later.)",
    false,
  );
  if (!confirm) {
    console.log("Cancelled.");
    return false;
  }

  clearRemoteSyncConfig(localDb);
  printStatus("ok", "disconnected", "multi-machine sync is off on this machine");
  return true;
}

async function revalidateRemote(
  _rl: Interface,
  _centralDb: GnosysDB,
  currentRemote: string,
): Promise<boolean> {
  console.log("");
  const spin = Spinner(`checking ${currentRemote}…`);
  const validation = await validateLocation(currentRemote);
  if (validation.ok) {
    spin.ok("master folder is reachable");
  } else {
    spin.fail("validation failed", "the master may be unreachable or the path is wrong");
  }
  showValidationSummary(validation);
  return validation.ok;
}

// ─── Non-interactive mode ───────────────────────────────────────────────

export async function configureFromPath(
  centralDb: GnosysDB,
  remotePath: string,
  opts: { migrate?: boolean; role?: MultiMachineRole } = {},
): Promise<boolean> {
  console.log(`\nValidating ${remotePath}...`);
  const validation = await validateLocation(remotePath);
  showValidationSummary(validation);

  if (!validation.ok) {
    console.log("\nValidation failed. Master folder not configured.");
    return false;
  }

  const role = opts.role ?? "client";
  persistMultiMachineConfig(centralDb, remotePath, role);
  console.log(`\n✓ Multi-machine sync configured: ${remotePath} (${role})`);

  if (role === "master") {
    const { config: mc } = ensureMachineConfig();
    writeMasterMarker(remotePath, mc.machineId);
  }

  if (opts.migrate && role === "master" && !validation.checks.existingDb.found) {
    console.log("\nMigrating local DB to master folder...");
    const sync = new RemoteSync(centralDb, remotePath);
    try {
      const result = await sync.migrate();
      if (result.ok) {
        console.log(`  ✓ Copied ${result.copied} memories to master folder.`);
        archiveLocalDbBeforeMaster();
      } else {
        console.log("  ✗ Migration had errors:");
        for (const e of result.errors) console.log(`    ${e}`);
        return false;
      }
    } finally {
      sync.closeRemote();
    }
  } else if (validation.checks.existingDb.found) {
    console.log("\nExisting DB found at master folder.");
  }

  return true;
}

export { stagingDirForMachine, clientPresencePath } from "./syncStaging.js";

export const __test = {
  matchesTypedPhrase,
  detectClonedStagingPresence,
  stagingDirForMachine,
  clientPresencePath,
};
