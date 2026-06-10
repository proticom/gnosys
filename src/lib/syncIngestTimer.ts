import {
  getSyncIngestLaunchAgentStatus,
  installSyncIngestLaunchAgent,
  uninstallSyncIngestLaunchAgent,
} from "./syncIngestLaunchd.js";
import {
  getSyncIngestSystemdTimerStatus,
  installSyncIngestSystemdTimer,
  uninstallSyncIngestSystemdTimer,
} from "./syncIngestSystemd.js";

export interface SyncIngestTimerStatus {
  installed: boolean;
  path: string;
  platform: "darwin" | "linux" | "unsupported";
}

export function getSyncIngestTimerStatus(): SyncIngestTimerStatus {
  if (process.platform === "darwin") {
    const status = getSyncIngestLaunchAgentStatus();
    return { ...status, platform: "darwin" };
  }
  if (process.platform === "linux") {
    const status = getSyncIngestSystemdTimerStatus();
    return { ...status, platform: "linux" };
  }
  return { installed: false, path: "", platform: "unsupported" };
}

export function installSyncIngestTimer(intervalMinutes = 15): string | null {
  if (process.platform === "darwin") return installSyncIngestLaunchAgent(intervalMinutes);
  if (process.platform === "linux") return installSyncIngestSystemdTimer(intervalMinutes);
  return null;
}

export function uninstallSyncIngestTimer(): string | null {
  if (process.platform === "darwin") return uninstallSyncIngestLaunchAgent();
  if (process.platform === "linux") return uninstallSyncIngestSystemdTimer();
  return null;
}
