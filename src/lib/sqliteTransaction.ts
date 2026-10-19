import type { DatabaseSync } from "node:sqlite";

export type SyncTransactionResult<T> = T & (T extends PromiseLike<unknown> ? never : unknown);

const depths = new WeakMap<DatabaseSync, number>();

export function transaction<T>(db: DatabaseSync, fn: () => SyncTransactionResult<T>, mode: "deferred" | "immediate" = "deferred"): T {
  if (!db) throw new Error("Database not available");
  const depth = depths.get(db) ?? 0;
  const savepoint = `gnosys_tx_${depth}`;
  db.exec(depth === 0 ? `BEGIN ${mode.toUpperCase()}` : `SAVEPOINT ${savepoint}`);
  depths.set(db, depth + 1);
  try {
    const result = fn();
    if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
      // The callback has already started. Later writes cannot be rolled back here.
      void Promise.resolve(result).catch(error => {
        process.emitWarning(`Rejected transaction promise: ${error instanceof Error ? error.message : String(error)}`, "TransactionRejectionWarning");
      });
      throw new TypeError("Transaction function cannot return a promise");
    }
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
