import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";
import { applyPendingOverlay } from "../lib/clientReadOverlay.js";
import {
  closeClientReadContext,
  getIngestedUlids,
  listClientReceipts,
  openClientReadContext,
} from "../lib/syncClient.js";
import { defaultMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
import { acceptClientSnapshot } from "../lib/syncSnapshot.js";
import { stagingRoot } from "../lib/syncStaging.js";

describe("syncClientRead v13", () => {
  let tmpHome: string;
  let localDir: string;
  let localDb: GnosysDB;
  let masterPath: string;
  let masterDb: GnosysDB;
  const machineId = "01CLIENTMACHINECLIENTMACH";
  let prevConfigDir: string | undefined;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-sync-read-"));
    localDir = path.join(tmpHome, "local");
    masterPath = path.join(tmpHome, "master");
    fs.mkdirSync(localDir, { recursive: true });
    fs.mkdirSync(masterPath, { recursive: true });
    prevConfigDir = process.env.GNOSYS_CONFIG_DIR;
    prevHome = process.env.GNOSYS_HOME;
    process.env.GNOSYS_CONFIG_DIR = path.join(tmpHome, "config");
    process.env.GNOSYS_HOME = tmpHome;
    fs.mkdirSync(process.env.GNOSYS_CONFIG_DIR, { recursive: true });

    localDb = new GnosysDB(localDir);
    masterDb = new GnosysDB(masterPath);
    masterDb.insertMemory({
      id: "01MASTERMEMORYMASTERMEMO",
      title: "On master",
      category: "concepts",
      content: "master body",
      summary: null,
      tags: "[]",
      relevance: "",
      author: "user",
      authority: "user",
      confidence: 0.8,
      reinforcement_count: 0,
      content_hash: "h1",
      status: "active",
      tier: "active",
      supersedes: null,
      superseded_by: null,
      last_reinforced: null,
      created: "2026-06-01T00:00:00.000Z",
      modified: "2026-06-01T00:00:00.000Z",
      source_path: null,
      project_id: null,
      scope: "global",
    });
    const snapDir = path.join(masterPath, "snapshots");
    fs.mkdirSync(snapDir, { recursive: true });
    const snapFile = "snap-1-1.db";
    fs.copyFileSync(path.join(masterPath, "gnosys.db"), path.join(snapDir, snapFile));
    fs.writeFileSync(
      path.join(snapDir, "snapshot-manifest.json"),
      JSON.stringify({
        epoch: 1,
        seq: 1,
        snapshotFile: snapFile,
        publishedAt: new Date().toISOString(),
        checksum: "",
        sizeBytes: 1,
      }),
    );
  });

  afterEach(() => {
    localDb.close();
    masterDb.close();
    if (prevConfigDir === undefined) delete process.env.GNOSYS_CONFIG_DIR;
    else process.env.GNOSYS_CONFIG_DIR = prevConfigDir;
    if (prevHome === undefined) delete process.env.GNOSYS_HOME;
    else process.env.GNOSYS_HOME = prevHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeClientMachineConfig(role: "client" | "master"): void {
    const mc = defaultMachineConfig();
    mc.machineId = machineId;
    mc.remote = { enabled: true, path: masterPath, role };
    writeMachineConfig(mc);
    localDb.setMeta("remote_path", masterPath);
  }

  it("applyPendingOverlay merges pending and excludes ingested ULIDs", () => {
    const base = [
      {
        id: "01BASE",
        title: "Base",
        category: "concepts",
        content: "b",
        summary: null,
        tags: "[]",
        relevance: "",
        author: "user",
        authority: "user",
        confidence: 0.8,
        reinforcement_count: 0,
        content_hash: "",
        status: "active",
        tier: "active",
        supersedes: null,
        superseded_by: null,
        last_reinforced: null,
        created: "2026-06-01T00:00:00.000Z",
        modified: "2026-06-01T00:00:00.000Z",
        embedding: null,
        source_path: null,
        source_file: null,
        source_page: null,
        source_timerange: null,
        // v5.12.1 typecheck fix: DbMemory gained attachment fields in the 5.12.0
        // attachments merge; fixture literal updated to match (no assertion changes)
        attachment_data: null,
        attachment_mime: null,
        attachment_name: null,
        project_id: null,
        scope: "global",
      },
    ];
    const pending = [
      {
        id: "01PEND",
        title: "Pending",
        category: "concepts",
        content: "p",
        tags: "[]",
        project_id: null,
        scope: "global",
        created: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "01DONE",
        title: "Ingested",
        category: "concepts",
        content: "d",
        tags: "[]",
        project_id: null,
        scope: "global",
        created: "2026-06-01T00:00:00.000Z",
      },
    ];
    const merged = applyPendingOverlay(base, pending, new Set(["01DONE"]));
    expect(merged.overlayCount).toBe(1);
    expect(merged.memories.map((m) => m.id).sort()).toEqual(["01BASE", "01PEND"]);
  });

  it("listClientReceipts and getIngestedUlids tolerate missing dir and malformed files", () => {
    expect(listClientReceipts(masterPath, machineId)).toEqual([]);
    const dir = path.join(stagingRoot(masterPath), machineId, "receipts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "01ULID.json"),
      JSON.stringify({ ulid: "01ULID", outcome: "ingested", at: "2026-06-01T00:00:00.000Z" }),
    );
    fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
    expect(getIngestedUlids(masterPath, machineId)).toEqual(new Set(["01ULID"]));
  });

  it("openClientReadContext uses local db for master role", () => {
    writeClientMachineConfig("master");
    const ctx = openClientReadContext(localDb, masterPath, machineId);
    expect(ctx.source).toBe("master");
    expect(ctx.db).toBe(localDb);
    expect(ctx.ownsReadDb).toBe(false);
    expect(ctx.pendingOverlay).toEqual([]);
    closeClientReadContext(ctx);
  });

  it("openClientReadContext opens master db when client and reachable", () => {
    writeClientMachineConfig("client");
    const ctx = openClientReadContext(localDb, masterPath, machineId);
    expect(ctx.source).toBe("master");
    expect(ctx.masterReachable).toBe(true);
    expect(ctx.ownsReadDb).toBe(true);
    expect(ctx.db.getMemory("01MASTERMEMORYMASTERMEMO")?.title).toBe("On master");
    closeClientReadContext(ctx);
  });

  it("openClientReadContext falls back to accepted snapshot when offline", () => {
    writeClientMachineConfig("client");
    const manifest = {
      epoch: 1,
      seq: 1,
      snapshotFile: "snap-1-1.db",
      publishedAt: "2026-06-01T00:00:00.000Z",
      checksum: "",
      sizeBytes: 1,
    };
    const snapSrc = path.join(masterPath, "snapshots", manifest.snapshotFile);
    manifest.checksum = createHash("sha256").update(fs.readFileSync(snapSrc)).digest("hex");
    manifest.sizeBytes = fs.statSync(snapSrc).size;
    acceptClientSnapshot(masterPath, manifest);

    fs.rmSync(masterPath, { recursive: true, force: true });

    const ctx = openClientReadContext(localDb, masterPath, machineId);
    expect(ctx.source).toBe("snapshot");
    expect(ctx.masterReachable).toBe(false);
    expect(ctx.ownsReadDb).toBe(true);
    closeClientReadContext(ctx);
  });

  it("openClientReadContext returns pending-only when offline without snapshot", () => {
    writeClientMachineConfig("client");
    fs.rmSync(masterPath, { recursive: true, force: true });
    localDb.insertPendingAdd({
      id: "01PENDINGONLYPENDINGONL",
      title: "Local pending",
      category: "concepts",
      content: "only here",
      created: "2026-06-01T00:00:00.000Z",
    });
    const ctx = openClientReadContext(localDb, masterPath, machineId);
    expect(ctx.source).toBe("pending-only");
    expect(ctx.pendingOverlay).toHaveLength(1);
    expect(ctx.db).toBe(localDb);
    closeClientReadContext(ctx);
  });

  it("openClientReadContext filters pending overlay by ingest receipts", () => {
    writeClientMachineConfig("client");
    localDb.insertPendingAdd({
      id: "01FILTEREDBYRECEIPTFILT",
      title: "Should hide",
      category: "concepts",
      content: "x",
      created: "2026-06-01T00:00:00.000Z",
    });
    const dir = path.join(stagingRoot(masterPath), machineId, "receipts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "01FILTEREDBYRECEIPTFILT.json"),
      JSON.stringify({ ulid: "01FILTEREDBYRECEIPTFILT", outcome: "ingested", at: "2026-06-01T00:00:00.000Z" }),
    );
    const ctx = openClientReadContext(localDb, masterPath, machineId);
    expect(ctx.pendingOverlay.find((p) => p.id === "01FILTEREDBYRECEIPTFILT")).toBeUndefined();
    closeClientReadContext(ctx);
  });
});
