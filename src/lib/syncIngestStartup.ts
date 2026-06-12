import { GnosysDB } from "./db.js";
import { readMachineConfig } from "./machineConfig.js";
import { getConfiguredRemotePath } from "./remote.js";
import { runMasterIngestSweepAndPublish } from "./syncIngest.js";

/**
 * Run one ingest sweep on MCP server startup (master role only).
 * Non-blocking — callers should fire-and-forget.
 */
export async function maybeRunStartupIngestSweep(): Promise<void> {
  const mc = readMachineConfig();
  if (!mc?.remote.enabled || mc.remote.role !== "master") return;

  const db = GnosysDB.openLocal();
  let masterPath: string | null = null;
  try {
    if (!db.isAvailable()) return;
    masterPath = getConfiguredRemotePath(db);
  } finally {
    db.close();
  }
  if (!masterPath) return;

  const result = await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
  if (result.errors.length > 0) {
    console.error(
      `[sync] Startup ingest sweep: ${result.ingested} ingested, ${result.errors.length} error(s)`,
    );
  }
}
