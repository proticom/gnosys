/**
 * v5.12.x Phase 3C hardening — dream lock recovery behavior.
 *
 * Pre-fix: an unreadable/corrupt dream.lock (crash mid-write) blocked
 * dreaming forever until manual deletion, and a stale lock from a dead pid
 * was the only recoverable case. These tests pin the recovery matrix.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { acquireDreamLock } from "../lib/dreamRunLog.js";

describe("acquireDreamLock recovery", () => {
  let tmpHome: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dreamlock-"));
    prevHome = process.env.GNOSYS_HOME;
    process.env.GNOSYS_HOME = tmpHome;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.GNOSYS_HOME;
    else process.env.GNOSYS_HOME = prevHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function findLockFile(dir: string): string | null {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = findLockFile(p);
        if (nested) return nested;
      } else if (entry.name.endsWith(".lock") && entry.name.includes("dream")) {
        return p;
      }
    }
    return null;
  }

  it("acquires and releases cleanly", () => {
    const lock = acquireDreamLock();
    expect(lock.acquired).toBe(true);
    if (lock.acquired) lock.release();
    // Re-acquire after release works
    const again = acquireDreamLock();
    expect(again.acquired).toBe(true);
    if (again.acquired) again.release();
  });

  it("refuses while a live process holds the lock", () => {
    const lock = acquireDreamLock();
    expect(lock.acquired).toBe(true);
    const second = acquireDreamLock();
    expect(second.acquired).toBe(false);
    if (!second.acquired) expect(second.reason).toContain(String(process.pid));
    if (lock.acquired) lock.release();
  });

  it("treats a dead-pid lock as stale and recovers", () => {
    const lock = acquireDreamLock();
    expect(lock.acquired).toBe(true);
    const p = findLockFile(tmpHome)!;
    if (lock.acquired) lock.release();
    // Plant a lock from a (very likely) dead pid
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: 999999, startedAt: "2026-01-01T00:00:00.000Z" }));
    const recovered = acquireDreamLock();
    expect(recovered.acquired).toBe(true);
    if (recovered.acquired) recovered.release();
  });

  it("treats a corrupt/unreadable lock as stale instead of blocking forever", () => {
    const lock = acquireDreamLock();
    expect(lock.acquired).toBe(true);
    const p = findLockFile(tmpHome)!;
    if (lock.acquired) lock.release();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "{not json — crash mid-write");
    const recovered = acquireDreamLock();
    expect(recovered.acquired).toBe(true); // pre-fix: acquired === false forever
    if (recovered.acquired) recovered.release();
  });
});
