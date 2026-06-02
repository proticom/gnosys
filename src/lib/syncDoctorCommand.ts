import { GnosysDB } from "./db.js";
import { getConfiguredRemotePath } from "./remote.js";
import { readMachineConfig } from "./machineConfig.js";
import { getV13SyncStatus } from "./syncClient.js";
import { runMasterIngestSweep } from "./syncIngest.js";
import { quarantineStaleTmpFiles, stagingRoot } from "./syncStaging.js";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { readMasterMarker } from "./masterLease.js";
import { printStatus } from "./setup/ui/status.js";

export async function runSyncDoctorCommand(opts: { json?: boolean; ingest?: boolean }): Promise<void> {
  let db: GnosysDB | null = null;
  try {
    db = GnosysDB.openLocal();
    if (!db.isAvailable()) {
      console.error("Central DB not available.");
      process.exitCode = 1;
      return;
    }
    const masterPath = getConfiguredRemotePath(db);
    const mc = readMachineConfig();
    if (!masterPath || !mc?.remote.enabled) {
      console.log("Multi-machine sync is not configured.");
      return;
    }

    const status = getV13SyncStatus(db);
    const marker = readMasterMarker(masterPath);
    const report = {
      role: status.role,
      masterPath,
      masterReachable: status.masterReachable,
      waitingToSync: status.waitingToSync,
      failedToSync: status.failedToSync,
      pendingOfflineAdds: status.pendingOfflineAdds,
      masterEpoch: marker?.epoch ?? null,
      snapshotAge: status.snapshotAge,
    };

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("\nGnosys sync doctor (v13)\n");
      for (const line of status.lines) console.log(line);
      if (marker) {
        console.log(`\nMaster lease: epoch ${marker.epoch}, holder ${marker.holderMachineId}`);
      }
      if (status.failedToSync > 0) {
        printStatus("progress", "remediation", "inspect master-folder/.gnosys-staging/*/failed/");
      }
      if (!status.masterReachable) {
        printStatus("warn", "mount or VPN path to master folder, then re-run doctor");
      }
    }

    if (opts.ingest && mc.remote.role === "master") {
      const root = stagingRoot(masterPath);
      if (existsSync(root)) {
        for (const id of readdirSync(root)) {
          if (!id.startsWith(".")) quarantineStaleTmpFiles(masterPath, id);
        }
      }
      const result = runMasterIngestSweep(masterPath);
      if (!opts.json) {
        console.log(`\nIngest sweep: +${result.ingested} ingested, ${result.skipped} skipped, ${result.quarantined} quarantined`);
        for (const e of result.errors) printStatus("fail", e);
      }
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
