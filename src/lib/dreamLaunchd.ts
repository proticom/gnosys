import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const LABEL = "com.gnosys.dream";

export interface LaunchctlResult {
  ok: boolean;
  message: string;
}

/** Pure helper: argv for loading a LaunchAgent plist. Exported for tests. */
export function launchctlLoadArgs(plistFile: string): string[] {
  return ["load", "-w", plistFile];
}

/** Pure helper: argv for unloading a LaunchAgent plist. Exported for tests. */
export function launchctlUnloadArgs(plistFile: string): string[] {
  return ["unload", plistFile];
}

/**
 * Pure helper: interpret a launchctl load failure. "Already loaded" is a
 * success for our purposes (the agent is active). Exported for tests.
 */
export function interpretLaunchctlLoadError(stderr: string): LaunchctlResult {
  const text = stderr.trim();
  if (/already loaded|service already loaded|Load failed: 5/i.test(text)) {
    return { ok: true, message: "launchd agent already loaded" };
  }
  return {
    ok: false,
    message: `launchctl load failed${text ? `: ${text}` : ""} — the agent will load at next login`,
  };
}

/**
 * Best-effort `launchctl load` of the dream LaunchAgent so scheduled runs
 * start immediately instead of waiting for the next login. (v5.14.x sprint,
 * pre-approved.) Never throws.
 */
export function loadDreamLaunchAgent(plistFile: string): LaunchctlResult {
  if (process.platform !== "darwin") return { ok: false, message: "launchctl unavailable (not macOS)" };
  try {
    execFileSync("launchctl", launchctlLoadArgs(plistFile), {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    });
    return { ok: true, message: "launchd agent loaded — scheduled dream runs are active now" };
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err && err.stderr
        ? String(err.stderr)
        : err instanceof Error
          ? err.message
          : String(err);
    return interpretLaunchctlLoadError(stderr);
  }
}

/**
 * Best-effort `launchctl unload` before removing the plist, so disabling
 * Dream Mode deactivates the schedule immediately. Never throws.
 */
export function unloadDreamLaunchAgent(plistFile: string): LaunchctlResult {
  if (process.platform !== "darwin") return { ok: false, message: "launchctl unavailable (not macOS)" };
  try {
    execFileSync("launchctl", launchctlUnloadArgs(plistFile), {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    });
    return { ok: true, message: "launchd agent unloaded" };
  } catch {
    // Not loaded (or launchctl unavailable) — nothing to deactivate.
    return { ok: true, message: "launchd agent was not loaded" };
  }
}

function plistPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function installDreamLaunchAgent(): string | null {
  if (process.platform !== "darwin") return null;
  const file = plistPath();
  const nodePath = process.execPath;
  const cliPath = process.argv[1] || "gnosys";
  const logPath = path.join(os.tmpdir(), "gnosys-dream.log");
  const pathEnv = `${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(cliPath)}</string>
    <string>dream</string>
    <string>run</string>
    <string>--scheduled</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xmlEscape(os.homedir())}</string>
    <key>PATH</key>
    <string>${xmlEscape(pathEnv)}</string>
  </dict>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
  return file;
}

export function uninstallDreamLaunchAgent(): string | null {
  if (process.platform !== "darwin") return null;
  const file = plistPath();
  // Unload before unlinking — launchctl needs the plist on disk to resolve
  // the label, and this deactivates the schedule immediately. Best-effort.
  if (fs.existsSync(file)) unloadDreamLaunchAgent(file);
  try {
    fs.unlinkSync(file);
  } catch {
    // Missing is already uninstalled.
  }
  return file;
}
