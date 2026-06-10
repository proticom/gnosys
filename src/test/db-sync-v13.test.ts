import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";

describe("v13 sync DB schema", () => {
  let tmpDir: string;
  let db: GnosysDB;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-sync-db-"));
    db = new GnosysDB(tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates to schema version 5 with sync tables", () => {
    expect(db.getSchemaVersion()).toBe(5);
    db.recordStagingLedgerEntry({
      stagingKey: "machine-a/1700000000-01ULID.json",
      machineId: "machine-a",
      memoryUlid: "01ULID",
      firstSeenAt: "2026-06-01T00:00:00.000Z",
    });
    expect(db.countPendingStagingLedger()).toBe(1);
    db.markUlidProcessed("01ULID", 1);
    expect(db.isUlidProcessed("01ULID")).toBe(true);
    db.insertPendingAdd({
      id: "01PENDING",
      title: "t",
      category: "concepts",
      content: "body",
      created: "2026-06-01T00:00:00.000Z",
    });
    expect(db.listActivePendingAdds()).toHaveLength(1);
    db.clearPendingAdd("01PENDING");
    expect(db.listActivePendingAdds()).toHaveLength(0);
    db.publishSnapshotManifest({
      epoch: 1,
      seq: 2,
      snapshotPath: path.join(tmpDir, "snapshots", "snap-1-2.db"),
      publishedAt: "2026-06-01T00:05:00.000Z",
      checksum: "abc",
      sizeBytes: 1024,
    });
    const manifest = db.getSnapshotManifest();
    expect(manifest?.epoch).toBe(1);
    expect(manifest?.seq).toBe(2);
    db.touchSnapshotHeartbeat("2026-06-01T00:05:30.000Z");
    expect(db.getSnapshotManifest()?.heartbeat_at).toBe("2026-06-01T00:05:30.000Z");
  });
});
