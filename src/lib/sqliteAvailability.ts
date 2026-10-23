import type { DatabaseSync } from "node:sqlite";

export const SQLITE_REQUIREMENT = "node:sqlite unavailable; requires Node ^22.16.0 || >=24.0.0 (FTS5 required; Node 23.x unsupported)";

export function requireFts5(db: DatabaseSync): void {
  try {
    db.exec("CREATE VIRTUAL TABLE temp.gnosys_fts5_check USING fts5(content); DROP TABLE temp.gnosys_fts5_check");
  } catch (error) {
    if (error instanceof Error && /no such module: fts5/i.test(error.message)) {
      throw new Error("node:sqlite on this Node lacks FTS5; requires Node ^22.16.0 || >=24.0.0 (Node 23.x unsupported)", { cause: error });
    }
    throw error;
  }
}
