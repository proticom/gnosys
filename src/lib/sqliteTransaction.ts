import type { DatabaseSync } from "node:sqlite";

const depths = new WeakMap<DatabaseSync, number>();

export function transaction<T>(db: DatabaseSync, fn: () => T, mode: "deferred" | "immediate" = "deferred"): T {
  const depth = depths.get(db) ?? 0;
  const savepoint = `gnosys_tx_${depth}`;
  db.exec(depth === 0 ? `BEGIN ${mode.toUpperCase()}` : `SAVEPOINT ${savepoint}`);
  depths.set(db, depth + 1);
  try {
    const result = fn();
    db.exec(depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    try {
      if (depth === 0) {
        db.exec("ROLLBACK");
      } else {
        db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`);
      }
    } catch {
      // SQLite can roll back the transaction itself, for example after SQLITE_FULL.
    }
    throw error;
  } finally {
    if (depth === 0) depths.delete(db);
    else depths.set(db, depth);
  }
}
