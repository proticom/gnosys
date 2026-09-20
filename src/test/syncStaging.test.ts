import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildStagedMemoryPayload,
  writeStagedMemoryFile,
  parseStagedFile,
  quarantineStaleTmpFiles,
  countFailedStagingFiles,
  quarantineStagingFile,
  listPendingStagingQueue,
} from "../lib/syncStaging.js";
import { GnosysDB } from "../lib/db.js";

describe("syncStaging v13", () => {
  let masterPath: string;
  const machineId = "01MACHINEMACHINEMACHINEMACH";

  beforeEach(() => {
    masterPath = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-staging-"));
  });

  afterEach(() => {
    fs.rmSync(masterPath, { recursive: true, force: true });
  });

  it("round-trips a staged record and rejects corrupted content", () => {
    const payload = buildStagedMemoryPayload({
      id: "01MEMORYULIDMEMORYULIDMEM",
      title: "Test",
      category: "concepts",
      content: "hello",
      machineId,
    });
    const fileName = writeStagedMemoryFile(masterPath, machineId, payload);
    const filePath = path.join(masterPath, ".gnosys-staging", machineId, fileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = parseStagedFile(filePath);
    expect(parsed).toMatchObject({ ok: true, payload: { schemaVersion: 1, id: "01MEMORYULIDMEMORYULIDMEM", title: "Test", category: "concepts", content: "hello" } });
    expect(fs.readdirSync(path.dirname(filePath))).toEqual([fileName]);
    fs.writeFileSync(filePath, JSON.stringify({ ...payload, content: "tampered" }));
    expect(parseStagedFile(filePath)).toEqual({ ok: false, filePath, reason: "checksum mismatch", quarantine: true });
  });

  it("quarantines checksum mismatch and unknown schemaVersion", () => {
    const dir = path.join(masterPath, ".gnosys-staging", machineId);
    fs.mkdirSync(dir, { recursive: true });
    const badChecksum = path.join(dir, "1-bad.json");
    fs.writeFileSync(
      badChecksum,
      JSON.stringify({
        schemaVersion: 1,
        id: "01BAD",
        title: "t",
        category: "concepts",
        content: "x",
        tags: [],
        project_id: null,
        scope: "project",
        machineId,
        writtenAt: new Date().toISOString(),
        checksum: "deadbeef",
      }),
    );
    expect(parseStagedFile(badChecksum).ok).toBe(false);

    const unknownSchema = path.join(dir, "2-unknown.json");
    fs.writeFileSync(
      unknownSchema,
      JSON.stringify({
        schemaVersion: 999,
        id: "01UNK",
        title: "t",
        category: "concepts",
        content: "x",
        tags: [],
        project_id: null,
        scope: "project",
        machineId,
        writtenAt: new Date().toISOString(),
        checksum: "x",
      }),
    );
    const unk = parseStagedFile(unknownSchema);
    expect(unk.ok).toBe(false);
    if (!unk.ok) expect(unk.reason).toBe("Update your master machine to a newer version of Gnosys.");

    const badTarget = quarantineStagingFile(badChecksum, masterPath, machineId);
    const unknownTarget = quarantineStagingFile(unknownSchema, masterPath, machineId);
    expect(countFailedStagingFiles(masterPath, machineId)).toBe(2);
    expect(fs.existsSync(badChecksum)).toBe(false);
    expect(fs.existsSync(unknownSchema)).toBe(false);
    expect(JSON.parse(fs.readFileSync(badTarget, "utf8")).id).toBe("01BAD");
    expect(JSON.parse(fs.readFileSync(unknownTarget, "utf8")).id).toBe("01UNK");
  });

  it("moves stale .tmp files into failed/", () => {
    const dir = path.join(masterPath, ".gnosys-staging", machineId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "stale.tmp"), '{"keep":"original"}');
    expect(quarantineStaleTmpFiles(masterPath, machineId)).toBe(1);
    expect(countFailedStagingFiles(masterPath, machineId)).toBe(1);
    expect(fs.existsSync(path.join(dir, "stale.tmp"))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "failed", "stale.tmp"), "utf8")).toBe('{"keep":"original"}');
  });

  it("orders queue by ledger firstSeenAt when master DB is available", () => {
    const db = new GnosysDB(masterPath);
    const lateFile = writeStagedMemoryFile(
      masterPath,
      machineId,
      buildStagedMemoryPayload({
        id: "01LATE",
        title: "late",
        category: "concepts",
        content: "b",
        machineId,
      }),
    );
    const earlyFile = writeStagedMemoryFile(
      masterPath,
      machineId,
      buildStagedMemoryPayload({
        id: "01EARLY",
        title: "early",
        category: "concepts",
        content: "a",
        machineId,
      }),
    );
    db.recordStagingLedgerEntry({
      stagingKey: `${machineId}/${lateFile}`,
      machineId,
      memoryUlid: "01LATE",
      firstSeenAt: "2026-06-02T10:00:00.000Z",
    });
    db.recordStagingLedgerEntry({
      stagingKey: `${machineId}/${earlyFile}`,
      machineId,
      memoryUlid: "01EARLY",
      firstSeenAt: "2026-06-02T09:00:00.000Z",
    });
    const queue = listPendingStagingQueue(masterPath, machineId, db);
    expect(queue[0]?.memoryUlid).toBe("01EARLY");
    db.close();
  });
});
