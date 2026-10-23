import type { SQLInputValue } from "node:sqlite";

export function sqliteValue(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string" || value instanceof Uint8Array) return value;
  throw new TypeError("Unsupported SQLite binding value");
}
