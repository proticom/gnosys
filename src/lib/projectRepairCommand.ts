import { GnosysDB } from "./db.js";
import {
  ProjectRepairError,
  applyMerge,
  applyRelocate,
  mergeHasChanges,
  planMerge,
  planRelocate,
  type RelocateChange,
} from "./projectRelocate.js";

export type ProjectRepairOptions = { yes?: boolean; json?: boolean };

async function withCentralDb(json: boolean | undefined, fn: (db: GnosysDB) => Promise<void>): Promise<void> {
  let db: GnosysDB | null = null;
  try {
    db = GnosysDB.openCentral();
    if (!db.isAvailable()) throw new ProjectRepairError("central DB not available (better-sqlite3 missing).");
    await fn(db);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    else console.error(`Error: ${message}`);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

function describeChange(change: RelocateChange): string {
  switch (change.kind) {
    case "registry":
      return `projects.json: ${change.before.length} → ${change.after.length} entries`;
    case "location":
      return `central DB location on this machine: ${change.from ?? "(none)"} → ${change.to}`;
    case "identity_file":
      return `.gnosys/gnosys.json workingDirectory: ${change.from} → ${change.to}`;
  }
}

export async function runProjectRelocateCommand(oldPath: string, newPath: string, opts: ProjectRepairOptions): Promise<void> {
  await withCentralDb(opts.json, async (db) => {
    const plan = await planRelocate(db, oldPath, newPath);
    const applied = opts.yes ? await applyRelocate(db, plan) : null;
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, applied: Boolean(applied), backupPath: applied?.backupPath ?? null, ...plan }, null, 2));
      return;
    }
    console.log(`Project ${plan.projectId}: ${plan.oldPath} → ${plan.newPath}`);
    if (plan.changes.length === 0) {
      console.log("Already relocated. Nothing to change.");
      return;
    }
    for (const change of plan.changes) console.log(`  ${describeChange(change)}`);
    if (applied) {
      console.log(`Applied. Backup: ${applied.backupPath}`);
    } else {
      console.log("Dry run. Re-run with --yes to apply.");
    }
  });
}

export async function runProjectMergeCommand(fromId: string, intoId: string, opts: ProjectRepairOptions): Promise<void> {
  await withCentralDb(opts.json, async (db) => {
    const plan = await planMerge(db, fromId, intoId);
    const applied = opts.yes ? await applyMerge(db, plan) : null;
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, applied: Boolean(applied), backupPath: applied?.backupPath ?? null, ...plan }, null, 2));
      return;
    }
    console.log(`Merge project ${plan.fromId} into ${plan.intoId}`);
    if (!mergeHasChanges(plan)) {
      console.log("Nothing to merge.");
    } else {
      console.log(`  memories:          ${plan.memories}`);
      console.log(`  pending adds:      ${plan.pendingAdds}`);
      console.log(`  location rows:     ${plan.locations}`);
      console.log(`  drop project row:  ${plan.dropsProjectRow ? "yes" : "no"}`);
      console.log(applied ? `Applied. Backup: ${applied.backupPath}` : "Dry run. Re-run with --yes to apply.");
    }
    for (const folder of plan.foldersStillUsingFromId) {
      console.log(`Warning: ${folder}/.gnosys/gnosys.json still names ${plan.fromId}; "gnosys init" there would recreate it.`);
    }
  });
}
