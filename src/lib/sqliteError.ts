const PRIMARY_CODES: Readonly<Record<number, string>> = {
  1: "SQLITE_ERROR",
  5: "SQLITE_BUSY",
  6: "SQLITE_LOCKED",
  7: "SQLITE_NOMEM",
  8: "SQLITE_READONLY",
  9: "SQLITE_INTERRUPT",
  10: "SQLITE_IOERR",
  11: "SQLITE_CORRUPT",
  13: "SQLITE_FULL",
  14: "SQLITE_CANTOPEN",
  17: "SQLITE_SCHEMA",
  18: "SQLITE_TOOBIG",
  19: "SQLITE_CONSTRAINT",
  20: "SQLITE_MISMATCH",
  21: "SQLITE_MISUSE",
  23: "SQLITE_AUTH",
  25: "SQLITE_RANGE",
  26: "SQLITE_NOTADB",
};

export function sqliteErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  if ("errcode" in error && typeof error.errcode === "number") return PRIMARY_CODES[error.errcode & 0xff];
  if ("code" in error && typeof error.code === "string" && error.code.startsWith("SQLITE_")) return error.code;
  const message = "message" in error && typeof error.message === "string" ? error.message
    : "errstr" in error && typeof error.errstr === "string" ? error.errstr : "";
  if (/database is locked|database is busy/i.test(message)) return "SQLITE_BUSY";
  if (/database disk image is malformed/i.test(message)) return "SQLITE_CORRUPT";
  if (/file is not a database/i.test(message)) return "SQLITE_NOTADB";
  return undefined;
}
