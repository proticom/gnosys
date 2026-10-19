import type { DatabaseSync, StatementSync, SQLInputValue } from "node:sqlite";

function normalizeBlobs(result: unknown): void {
  if (Array.isArray(result)) {
    for (const row of result) normalizeBlobs(row);
  } else if (result !== null && typeof result === "object") {
    for (const [key, value] of Object.entries(result)) {
      if (value instanceof Uint8Array && !Buffer.isBuffer(value)) {
        Object.assign(result, { [key]: Buffer.from(value.buffer, value.byteOffset, value.byteLength) });
      }
    }
  }
}

type BlobStatement = Omit<StatementSync, "get" | "all"> & {
  get(...params: SQLInputValue[]): unknown;
  get(named: Record<string, SQLInputValue>, ...params: SQLInputValue[]): unknown;
  all(...params: SQLInputValue[]): unknown[];
  all(named: Record<string, SQLInputValue>, ...params: SQLInputValue[]): unknown[];
};

export function prepare(db: DatabaseSync, sql: string): BlobStatement {
  if (!db.isOpen) throw new Error("The database connection is not open");
  const statement = db.prepare(sql);
  return new Proxy(statement, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args);
        if (property === "get" || property === "all") normalizeBlobs(result);
        return result;
      };
    },
  });
}
