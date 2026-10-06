import type { DbMemory, GnosysDB } from "./db.js";

type LinkUpdates = Pick<Partial<DbMemory>, "supersedes" | "superseded_by" | "status">;

export interface SupersessionOptions {
  allowCrossScope?: boolean;
}

/** Apply inside the writer's transaction so failed validation rolls back all links. */
export function applySupersession(
  db: GnosysDB,
  id: string,
  updates: LinkUpdates,
  options: SupersessionOptions = {},
): void {
  if (updates.supersedes === undefined && updates.superseded_by === undefined) return;
  const writer = db.getMemory(id);
  if (!writer) throw new Error(`Memory not found: ${id}`);
  const modified = new Date().toISOString();
  const successors = new Set<string>();
  const predecessors = new Set<string>();

  const target = (targetId: string): DbMemory => {
    const memory = db.getMemory(targetId);
    if (!memory) throw new Error(`Memory not found: ${targetId}`);
    if (!options.allowCrossScope && (
      memory.scope !== writer.scope ||
      (writer.scope === "project" && memory.project_id !== writer.project_id)
    )) {
      throw new Error(`Cannot supersede across scope or project: ${targetId}. Pass allowCrossScope: true to allow it.`);
    }
    return memory;
  };

  const link = (predecessor: DbMemory, successorId: string | null) => {
    predecessors.add(predecessor.id);
    if (predecessor.superseded_by) successors.add(predecessor.superseded_by);
    if (successorId) successors.add(successorId);
    const status = predecessor.id === id && updates.status !== undefined
      ? updates.status
      : successorId
        ? "superseded"
        : predecessor.status === "superseded"
          ? predecessor.tier === "archive" ? "archived" : "active"
          : predecessor.status;
    if (predecessor.superseded_by !== successorId || predecessor.status !== status) {
      db.updateMemory(predecessor.id, { superseded_by: successorId, status, modified });
    }
  };

  if (updates.supersedes !== undefined) {
    const ids = [...new Set((updates.supersedes ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
    if (ids.length === 0 && db.getPredecessorIds(id).length > 0) {
      throw new Error("Clear superseded_by on each predecessor to unlink it.");
    }
    for (const predecessorId of ids) link(target(predecessorId), id);
    successors.add(id);
  }
  if (updates.superseded_by !== undefined) {
    const successorId = updates.superseded_by || null;
    if (successorId) target(successorId);
    link(writer, successorId);
  }

  for (const predecessorId of predecessors) {
    const visited = new Set<string>();
    let next: string | null = predecessorId;
    while (next) {
      if (visited.has(next)) throw new Error("Supersession would create a cycle.");
      visited.add(next);
      next = db.getMemory(next)?.superseded_by ?? null;
    }
  }
  for (const successorId of successors) {
    const successor = db.getMemory(successorId);
    if (!successor) continue;
    const supersedes = db.getPredecessorIds(successorId).join(", ") || null;
    if (successor.supersedes !== supersedes) db.updateMemory(successorId, { supersedes, modified });
  }
}
