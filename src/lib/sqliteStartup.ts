import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireFts5 } from "./sqliteAvailability.js";
import { installSqliteWarningFilter } from "./sqliteWarnings.js";

type SqliteLoader = () => Promise<Pick<typeof import("node:sqlite"), "DatabaseSync">>;
type RuntimeFailure = "version out of range" | "node:sqlite missing" | "FTS5 missing";

export function supportsSqliteRuntime(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major >= 24 || (major === 22 && minor >= 16);
}

export function sqliteStartupMessage(version: string, reason: RuntimeFailure): string {
  return `gnosys requires Node ^22.16.0 || >=24.0.0 with FTS5; running Node ${version}: ${reason}`;
}

export async function sqliteRuntimeFailure(version: string, load: SqliteLoader = () => import("node:sqlite")): Promise<RuntimeFailure | null> {
  if (!supportsSqliteRuntime(version)) return "version out of range";
  let sqlite: Awaited<ReturnType<SqliteLoader>>;
  try { sqlite = await load(); } catch { return "node:sqlite missing"; }
  const db = new sqlite.DatabaseSync(":memory:");
  try {
    requireFts5(db);
    return null;
  } catch {
    return "FTS5 missing";
  } finally { db.close(); }
}

let startup: Promise<void> | undefined;
export function ensureSqliteRuntime(): Promise<void> {
  if (startup) return startup;
  installSqliteWarningFilter();
  const version = process.versions.node;
  if (!supportsSqliteRuntime(version)) {
    console.error(sqliteStartupMessage(version, "version out of range"));
    process.exit(1);
  }
  startup = sqliteRuntimeFailure(version).then(reason => {
    if (reason) {
      console.error(sqliteStartupMessage(version, reason));
      process.exit(1);
    }
  });
  return startup;
}

function isExecutableEntry(): boolean {
  if (!process.argv[1]) return false;
  const extension = path.extname(fileURLToPath(import.meta.url));
  const entry = path.resolve(process.argv[1]);
  return ["cli", "index"].some(name => {
    const executable = fileURLToPath(new URL(`../${name}${extension}`, import.meta.url));
    if (entry === executable) return true;
    try { return realpathSync(entry) === realpathSync(executable); } catch { return false; }
  });
}

if (isExecutableEntry()) await ensureSqliteRuntime();
