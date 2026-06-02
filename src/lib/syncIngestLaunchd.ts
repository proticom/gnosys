import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

const LABEL = "com.gnosys.sync-ingest";

function plistPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

function logPath(): string {
  return path.join(os.tmpdir(), "gnosys-sync-ingest.log");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build launchd plist XML (testable without writing to disk). */
export function buildSyncIngestLaunchAgentPlist(intervalMinutes: number): string {
  const nodePath = process.execPath;
  const cliPath = process.argv[1] || "gnosys";
  const intervalSec = Math.max(1, intervalMinutes) * 60;
  const pathEnv = `${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(cliPath)}</string>
    <string>setup</string>
    <string>remote</string>
    <string>doctor</string>
    <string>--ingest</string>
    <string>--quiet</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSec}</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath())}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath())}</string>
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
}

export function installSyncIngestLaunchAgent(intervalMinutes = 15): string | null {
  if (process.platform !== "darwin") return null;
  const file = plistPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildSyncIngestLaunchAgentPlist(intervalMinutes), "utf8");
  try {
    execSync(`launchctl load -w "${file}"`, { stdio: "ignore" });
  } catch (err) {
    throw new Error(
      `Failed to load launch agent: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return file;
}

export function uninstallSyncIngestLaunchAgent(): string | null {
  if (process.platform !== "darwin") return null;
  const file = plistPath();
  try {
    execSync(`launchctl unload "${file}"`, { stdio: "ignore" });
  } catch {
    // Already unloaded or missing.
  }
  try {
    fs.unlinkSync(file);
  } catch {
    // Missing is already uninstalled.
  }
  return file;
}

export function getSyncIngestLaunchAgentStatus(): { installed: boolean; path: string } {
  const file = plistPath();
  return { installed: fs.existsSync(file), path: file };
}
