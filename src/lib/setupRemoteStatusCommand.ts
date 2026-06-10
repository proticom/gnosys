import { GnosysDB } from "./db.js";
import type { RemoteSync } from "./remote.js";

export type SetupRemoteStatusCommandOptions = {
  json?: boolean;
};

export async function runSetupRemoteStatusCommand(
  opts: SetupRemoteStatusCommandOptions,
): Promise<void> {
  let centralDb: GnosysDB | null = null;
  try {
    centralDb = GnosysDB.openLocal();
    if (!centralDb.isAvailable()) {
      console.error("Central DB not available.");
      process.exitCode = 1;
      return;
    }

    const { getConfiguredRemotePath } = await import("./remote.js");
    const remotePath = getConfiguredRemotePath(centralDb);
    if (!remotePath) {
      if (opts.json) {
        console.log(
          JSON.stringify(
            { configured: false, message: "Remote not configured. Run 'gnosys setup remote'." },
            null,
            2,
          ),
        );
      } else {
        console.log("Remote sync: not configured.");
        console.log("Run 'gnosys setup remote' to set up multi-machine sync.");
      }
      return;
    }

    const mc = (await import("./machineConfig.js")).readMachineConfig();
    if (mc?.remote.role) {
      const { getV13SyncStatus } = await import("./syncClient.js");
      const v13 = getV13SyncStatus(centralDb);
      if (opts.json) {
        console.log(JSON.stringify(v13, null, 2));
      } else {
        console.log(`Multi-machine sync (${v13.role}) — ${v13.masterPath}`);
        for (const line of v13.lines) console.log(line);
        if (v13.snapshotAge) console.log(`Snapshot as of ${v13.snapshotAge}`);
      }
      return;
    }

    const { RemoteSync: RemoteSyncCtor, formatStatus } = await import("./remote.js");
    const { withHeartbeat } = await import("./heartbeat.js");
    let sync: RemoteSync | null = null;
    try {
      sync = new RemoteSyncCtor(centralDb, remotePath);
      const status = await withHeartbeat("Checking remote sync status", () => sync!.getStatus());

      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatStatus(status));
        if (status.conflicts.length > 0) {
          console.log("\nConflicts:");
          for (const c of status.conflicts) {
            console.log(`  ${c.memoryId}: ${c.title}`);
            console.log(`    local:  ${c.localModified}`);
            console.log(`    remote: ${c.remoteModified}`);
          }
          console.log(
            "\nResolve with: gnosys setup remote resolve <memory-id> --keep <local|remote>",
          );
        }
      }
    } finally {
      sync?.closeRemote();
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  } finally {
    centralDb?.close();
  }
}
