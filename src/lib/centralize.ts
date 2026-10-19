import { prepare } from "./sqliteStatement.js";
/**
 * Seed a central server's brain from a local one (v5.12 Phase E).
 *
 * When you move from local-stdio to the central-server topology, the new host
 * (a Docker volume, another machine) starts empty. `centralizeDb` makes a
 * CONSISTENT copy of this machine's `~/.gnosys/gnosys.db` into a target dir,
 * using SQLite VACUUM INTO so it's safe even while the source is in use
 * (WAL is handled — no torn copy).
 */

import fs from "fs";
import { randomUUID } from "node:crypto";
import path from "path";
import { DatabaseSync as Database } from "node:sqlite";
import { getCentralDbPath } from "./paths.js";

export interface CentralizeResult {
  source: string;
  target: string;
  bytes: number;
}

export async function centralizeDb(opts: {
  to: string;
  force?: boolean;
  /** Override the source DB file (defaults to this machine's central DB). */
  sourceDb?: string;
}): Promise<CentralizeResult> {
  const source = opts.sourceDb ?? getCentralDbPath();
  if (!fs.existsSync(source)) {
    throw new Error(`No local brain found at ${source}`);
  }
  const target = path.join(opts.to, "gnosys.db");
  if (fs.existsSync(target) && !opts.force) {
    throw new Error(`Target already exists: ${target} (use --force to overwrite)`);
  }
  fs.mkdirSync(opts.to, { recursive: true });

  // VACUUM INTO includes committed WAL data in a consistent snapshot.
  const db = new Database(source);
  db.exec("PRAGMA busy_timeout = 5000");
  const snapshot = path.join(opts.to, `gnosys-${randomUUID()}.db`);
  try {
    prepare(db, "VACUUM INTO ?").run(snapshot);
    fs.renameSync(snapshot, target);
  } finally {
    db.close();
    fs.rmSync(snapshot, { force: true });
  }

  return { source, target, bytes: fs.statSync(target).size };
}
