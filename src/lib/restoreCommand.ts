import fs from "fs";
import path from "path";
import { GnosysDB } from "./db.js";
import { confirmMemoryDeletion } from "./memoryDeleteGuard.js";

export type RestoreCommandOptions = {
  from?: string;
  json?: boolean;
};

export async function runRestoreCommand(
  backupFile: string,
  opts: RestoreCommandOptions,
): Promise<void> {
  const resolved = path.resolve(opts.from || backupFile);
  let db: GnosysDB | null = null;
  try {
    const livePath = GnosysDB.getCentralDbPath();
    if (fs.existsSync(livePath) && fs.existsSync(resolved)) {
      await confirmMemoryDeletion({
        confirmText: path.basename(resolved),
        targets: [resolved],
        summary: `Restoring replaces ${livePath} with ${resolved}. Memories not in the backup are deleted (a safety backup is taken first).`,
      });
    }
    const restored: { preRestoreBackup?: string } = {};
    db = GnosysDB.restore(resolved, undefined, restored);
    const counts = db.getMemoryCount();
    const projectCount = db.getAllProjects().length;

    if (opts.json) {
      console.log(JSON.stringify({
        ok: true, source: resolved, preRestoreBackup: restored.preRestoreBackup ?? null,
        memories: counts.total, active: counts.active, archived: counts.archived, projects: projectCount,
      }));
    } else {
      if (restored.preRestoreBackup) console.log(`Safety backup of the replaced DB: ${restored.preRestoreBackup}`);
      console.log(`Database restored from ${resolved}`);
      console.log(`  Memories: ${counts.total} (${counts.active} active, ${counts.archived} archived)`);
      console.log(`  Projects: ${projectCount}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: unknown }).code;
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: message, ...(typeof code === "string" ? { code } : {}) }));
    } else {
      console.error(`Restore failed: ${message}`);
    }
    process.exitCode = 1;
    return;
  } finally {
    db?.close();
  }
}
