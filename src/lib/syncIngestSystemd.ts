import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

const SERVICE_NAME = "gnosys-sync-ingest";

function systemdUserDir(): string {
  return path.join(os.homedir(), ".config", "systemd", "user");
}

function serviceFilePath(): string {
  return path.join(systemdUserDir(), `${SERVICE_NAME}.service`);
}

function timerFilePath(): string {
  return path.join(systemdUserDir(), `${SERVICE_NAME}.timer`);
}

function execLine(): string {
  const nodePath = process.execPath;
  const cliPath = process.argv[1] || "gnosys";
  return `${nodePath} ${cliPath} setup remote doctor --ingest --quiet`;
}

/** Build systemd service unit (testable without writing to disk). */
export function buildSyncIngestSystemdService(): string {
  return `[Unit]
Description=Gnosys sync ingest sweep

[Service]
Type=oneshot
ExecStart=${execLine()}
Environment=HOME=${os.homedir()}
`;
}

/** Build systemd timer unit (testable without writing to disk). */
export function buildSyncIngestSystemdTimer(intervalMinutes: number): string {
  const intervalSec = Math.max(1, intervalMinutes) * 60;
  return `[Unit]
Description=Gnosys sync ingest timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=${intervalSec}s

[Install]
WantedBy=timers.target
`;
}

export function installSyncIngestSystemdTimer(intervalMinutes = 15): string | null {
  if (process.platform !== "linux") return null;
  const dir = systemdUserDir();
  fs.mkdirSync(dir, { recursive: true });
  const servicePath = serviceFilePath();
  const timerPath = timerFilePath();
  fs.writeFileSync(servicePath, buildSyncIngestSystemdService(), "utf8");
  fs.writeFileSync(timerPath, buildSyncIngestSystemdTimer(intervalMinutes), "utf8");
  try {
    execSync("systemctl --user daemon-reload", { stdio: "ignore" });
    execSync(`systemctl --user enable --now ${SERVICE_NAME}.timer`, { stdio: "ignore" });
  } catch (err) {
    throw new Error(
      `Failed to enable systemd timer: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return timerPath;
}

export function uninstallSyncIngestSystemdTimer(): string | null {
  if (process.platform !== "linux") return null;
  const servicePath = serviceFilePath();
  const timerPath = timerFilePath();
  try {
    execSync(`systemctl --user disable --now ${SERVICE_NAME}.timer`, { stdio: "ignore" });
  } catch {
    // Timer may already be removed.
  }
  for (const file of [timerPath, servicePath]) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Missing is already uninstalled.
    }
  }
  try {
    execSync("systemctl --user daemon-reload", { stdio: "ignore" });
  } catch {
    // Best effort.
  }
  return timerPath;
}

export function getSyncIngestSystemdTimerStatus(): { installed: boolean; path: string } {
  const timerPath = timerFilePath();
  const servicePath = serviceFilePath();
  return {
    installed: fs.existsSync(timerPath) && fs.existsSync(servicePath),
    path: timerPath,
  };
}
