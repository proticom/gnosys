/**
 * Sync advisory lock on the master's **local** ~/.gnosys (never on network share).
 */

import fs from "fs";
import path from "path";

const LOCK_STALE_MS = 120_000;

interface LockInfo {
  pid: number;
  timestamp: number;
  operation: string;
}

function readLock(lockPath: string): LockInfo | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf-8");
    const o = JSON.parse(raw) as LockInfo;
    if (typeof o.pid === "number" && typeof o.timestamp === "number") return o;
  } catch {
    // no lock
  }
  return null;
}

function isStale(lock: LockInfo): boolean {
  if (Date.now() - lock.timestamp > LOCK_STALE_MS) return true;
  try {
    process.kill(lock.pid, 0);
    return false;
  } catch {
    return true;
  }
}

/** Synchronous ingest lock for master sweep (same directory as lock file). */
export function acquireWriteLockSync(lockPath: string, operation: string): () => void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const start = Date.now();
  while (true) {
    const existing = readLock(lockPath);
    if (existing && !isStale(existing)) {
      if (Date.now() - start > 30_000) {
        throw new Error(`ingest lock timeout (held by pid ${existing.pid})`);
      }
      // busy-wait briefly
      const waitUntil = Date.now() + 50;
      while (Date.now() < waitUntil) {
        /* spin */
      }
      continue;
    }
    if (existing) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // race
      }
    }
    try {
      fs.writeFileSync(
        lockPath,
        JSON.stringify({ pid: process.pid, timestamp: Date.now(), operation }),
      );
      return () => releaseWriteLockSync(lockPath);
    } catch {
      if (Date.now() - start > 30_000) throw new Error("failed to acquire ingest lock");
    }
  }
}

export function releaseWriteLockSync(lockPath: string): void {
  try {
    const existing = readLock(lockPath);
    if (existing?.pid === process.pid) fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
}
