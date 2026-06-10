import { printStatus } from "./setup/ui/status.js";
import {
  getSyncIngestTimerStatus,
  installSyncIngestTimer,
  uninstallSyncIngestTimer,
} from "./syncIngestTimer.js";

export async function runSyncIngestTimerCommand(opts: {
  install?: boolean;
  uninstall?: boolean;
  status?: boolean;
  interval?: string;
  json?: boolean;
}): Promise<void> {
  const intervalMinutes = Math.max(1, parseInt(opts.interval ?? "15", 10) || 15);
  const timerStatus = getSyncIngestTimerStatus();

  if (opts.json) {
    if (opts.install) {
      try {
        const path = installSyncIngestTimer(intervalMinutes);
        console.log(
          JSON.stringify({
            action: "install",
            installed: true,
            path,
            intervalMinutes,
            platform: timerStatus.platform,
          }),
        );
      } catch (err) {
        process.exitCode = 1;
        console.log(
          JSON.stringify({
            action: "install",
            installed: false,
            error: err instanceof Error ? err.message : String(err),
            platform: timerStatus.platform,
          }),
        );
      }
      return;
    }
    if (opts.uninstall) {
      try {
        const path = uninstallSyncIngestTimer();
        console.log(JSON.stringify({ action: "uninstall", installed: false, path }));
      } catch (err) {
        process.exitCode = 1;
        console.log(
          JSON.stringify({
            action: "uninstall",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }
    console.log(JSON.stringify({ ...getSyncIngestTimerStatus(), intervalMinutes }));
    return;
  }

  if (timerStatus.platform === "unsupported") {
    console.log("OS-level ingest timer is not supported on this platform.");
    console.log("Windows: use Task Scheduler manually or run `gnosys setup remote doctor --ingest`.");
    if (opts.install || opts.uninstall) process.exitCode = 1;
    return;
  }

  if (opts.install) {
    try {
      const installedPath = installSyncIngestTimer(intervalMinutes);
      printStatus("ok", `Ingest timer installed (${installedPath}, every ${intervalMinutes} min)`);
    } catch (err) {
      printStatus("fail", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
    return;
  }

  if (opts.uninstall) {
    try {
      const removedPath = uninstallSyncIngestTimer();
      printStatus("ok", `Ingest timer uninstalled (${removedPath})`);
    } catch (err) {
      printStatus("fail", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
    return;
  }

  const current = getSyncIngestTimerStatus();
  if (current.installed) {
    console.log(`Ingest timer: installed (${current.path})`);
  } else {
    console.log("Ingest timer: not installed");
    console.log("Install with: gnosys setup remote timer --install");
  }
}
