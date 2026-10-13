/**
 * `gnosys project relocate` and `gnosys project merge` — repair the project
 * registry and central DB after a project tree moves on disk.
 *
 * Both commands plan first and apply only with `--yes`. Applying takes a
 * SQLite online backup of the central DB before any write. A plan with no
 * changes applies nothing and takes no backup, so both commands are safe to
 * rerun.
 */

import path from "path";
import type { GnosysDB } from "./db.js";
import { getGnosysHome } from "./paths.js";
import { readMachineConfig, type MachineConfig } from "./machineConfig.js";
import { effectiveProjectPath, recordLocation } from "./projectPaths.js";
import { readProjectIdentity, writeProjectIdentity } from "./projectIdentity.js";
import { readProjectIdAt, readRegistryEntries, writeRegistryEntries } from "./projectRegistry.js";

export type RelocateChange =
  | { kind: "registry"; before: string[]; after: string[] }
  | { kind: "location"; from: string | null; to: string }
  | { kind: "identity_file"; from: string; to: string };

export interface RelocatePlan {
  projectId: string;
  oldPath: string;
  newPath: string;
  /** Empty when the project is already relocated. */
  changes: RelocateChange[];
}

export interface ApplyResult {
  /** Path of the SQLite online backup, or null when nothing was written. */
  backupPath: string | null;
}

/** Thrown when a command must refuse; the message is user-facing. */
export class ProjectRepairError extends Error {}

function backupDir(): string {
  return path.join(getGnosysHome(), "backups");
}

/**
 * Which project an old path belonged to: its own gnosys.json when the folder
 * still exists, otherwise the central DB rows that point at it.
 */
async function projectIdForOldPath(
  db: GnosysDB,
  machine: MachineConfig | null,
  oldPath: string,
): Promise<string> {
  const fromFile = await readProjectIdAt(oldPath);
  if (fromFile) return fromFile;
  const ids = new Set(
    db.getAllProjects()
      .filter((p) => {
        const here = effectiveProjectPath(db, p, machine);
        return path.resolve(p.working_directory || "/") === oldPath || (here !== null && path.resolve(here) === oldPath);
      })
      .map((p) => p.id),
  );
  if (ids.size === 1) return [...ids][0];
  if (ids.size > 1) {
    throw new ProjectRepairError(`${oldPath} matches ${ids.size} projects in the central DB (${[...ids].join(", ")}); merge them first with "gnosys project merge".`);
  }
  throw new ProjectRepairError(`cannot tell which project ${oldPath} was: no .gnosys/gnosys.json there and no central DB row points at it.`);
}

export async function planRelocate(db: GnosysDB, oldPathArg: string, newPathArg: string): Promise<RelocatePlan> {
  const oldPath = path.resolve(oldPathArg);
  const newPath = path.resolve(newPathArg);
  if (oldPath === newPath) throw new ProjectRepairError("old and new paths are the same.");

  const newId = await readProjectIdAt(newPath);
  if (!newId) throw new ProjectRepairError(`${newPath} has no .gnosys/gnosys.json with a projectId.`);
  const machine = readMachineConfig();
  const oldId = await projectIdForOldPath(db, machine, oldPath);
  if (oldId !== newId) {
    throw new ProjectRepairError(`projectIds differ: ${oldPath} is ${oldId}, ${newPath} is ${newId}. To fold one project into the other use "gnosys project merge ${oldId} ${newId}".`);
  }
  const project = db.getProject(newId);
  if (!project) {
    throw new ProjectRepairError(`project ${newId} is not in the central DB; run "gnosys init --directory ${newPath}" first.`);
  }

  const changes: RelocateChange[] = [];

  const before = await readRegistryEntries();
  const after: string[] = [];
  for (const entry of before) {
    const resolved = path.resolve(entry);
    if (resolved === oldPath) {
      if (!after.some((p) => path.resolve(p) === newPath)) after.push(newPath);
    } else if (!after.some((p) => path.resolve(p) === resolved)) {
      after.push(entry);
    }
  }
  if (!after.some((p) => path.resolve(p) === newPath)) after.push(newPath);
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ kind: "registry", before, after });

  const here = effectiveProjectPath(db, project, machine);
  if (here === null || path.resolve(here) !== newPath || path.resolve(project.working_directory || "/") !== newPath) {
    changes.push({ kind: "location", from: here, to: newPath });
  }

  const identity = await readProjectIdentity(newPath);
  if (identity && path.resolve(identity.workingDirectory) !== newPath) {
    changes.push({ kind: "identity_file", from: identity.workingDirectory, to: newPath });
  }

  return { projectId: newId, oldPath, newPath, changes };
}

export async function applyRelocate(db: GnosysDB, plan: RelocatePlan): Promise<ApplyResult> {
  if (plan.changes.length === 0) return { backupPath: null };
  const backupPath = await db.backup(backupDir());
  const machine = readMachineConfig();
  for (const change of plan.changes) {
    switch (change.kind) {
      case "location":
        if (machine) {
          recordLocation(db, machine, plan.projectId, change.to);
        } else {
          db.updateProject(plan.projectId, { working_directory: change.to, modified: new Date().toISOString() });
        }
        break;
      case "registry":
        await writeRegistryEntries(change.after);
        break;
      case "identity_file": {
        const identity = await readProjectIdentity(plan.newPath);
        if (identity) await writeProjectIdentity(plan.newPath, { ...identity, workingDirectory: change.to });
        break;
      }
      default: {
        const never: never = change;
        throw new Error(`unknown change ${JSON.stringify(never)}`);
      }
    }
  }
  return { backupPath };
}

export interface MergePlan {
  fromId: string;
  intoId: string;
  memories: number;
  pendingAdds: number;
  locations: number;
  /** True when the source project row exists and will be dropped. */
  dropsProjectRow: boolean;
  /** Registered folders whose gnosys.json still names fromId. */
  foldersStillUsingFromId: string[];
}

export async function planMerge(db: GnosysDB, fromId: string, intoId: string): Promise<MergePlan> {
  if (fromId === intoId) throw new ProjectRepairError("source and target projectIds are the same.");
  if (!db.getProject(intoId)) throw new ProjectRepairError(`target project ${intoId} does not exist in the central DB.`);
  const refs = db.countProjectReferences(fromId);
  const folders: string[] = [];
  for (const entry of await readRegistryEntries()) {
    if ((await readProjectIdAt(entry)) === fromId) folders.push(entry);
  }
  return {
    fromId,
    intoId,
    ...refs,
    dropsProjectRow: db.getProject(fromId) !== null,
    foldersStillUsingFromId: folders,
  };
}

export function mergeHasChanges(plan: MergePlan): boolean {
  return plan.dropsProjectRow || plan.memories > 0 || plan.pendingAdds > 0 || plan.locations > 0;
}

export async function applyMerge(db: GnosysDB, plan: MergePlan): Promise<ApplyResult> {
  if (!mergeHasChanges(plan)) return { backupPath: null };
  const backupPath = await db.backup(backupDir());
  db.mergeProjectInto(plan.fromId, plan.intoId);
  return { backupPath };
}
