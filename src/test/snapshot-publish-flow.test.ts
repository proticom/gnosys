/**
 * v5.12.x — v13 snapshot flow completion.
 *
 * publishMasterSnapshot/acceptClientSnapshot/compareSnapshotVersion existed
 * since the 5.12.0 sync work but had no production caller: masters never
 * published, so clients always opened the live gnosys.db over the network —
 * the exact hazard MULTI_MACHINE_SYNC_DESIGN.md forbids. This file covers the
 * wiring: ingest sweep → publish → client accepts a verified local copy and
 * reads it (source "snapshot") while the master is reachable.
 *
 * Offline soft rule (signed off 2026-06-11): last-accepted snapshot stays
 * readable when the master is unreachable — pinned by syncClientRead.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";
import { defaultMachineConfig, ensureMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
import { writeMasterMarker } from "../lib/masterLease.js";
import { runMasterIngestSweepAndPublish } from "../lib/syncIngest.js";
import { closeClientReadContext, openClientReadContext } from "../lib/syncClient.js";
import { clientSnapshotStore, getClientAcceptedManifest, getMasterManifest } from "../lib/syncSnapshot.js";
import { buildStagedMemoryPayload, writeStagedMemoryFile } from "../lib/syncStaging.js";

describe("v13 snapshot publish flow", () => {
  let tmpHome: string;
  let masterPath: string;
  let localDir: string;
  const clientMachineId = "01SNAPCLIENTMACHINESNAPCL";
  let masterMachineId: string;
  let prevHome: string | undefined;
  let prevConfigDir: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-snapflow-"));
    masterPath = path.join(tmpHome, "master");
    localDir = path.join(tmpHome, "local");
    fs.mkdirSync(masterPath, { recursive: true });
    fs.mkdirSync(localDir, { recursive: true });
    prevHome = process.env.GNOSYS_HOME;
    prevConfigDir = process.env.GNOSYS_CONFIG_DIR;
    process.env.GNOSYS_HOME = tmpHome;
    process.env.GNOSYS_CONFIG_DIR = path.join(tmpHome, "config");
    fs.mkdirSync(process.env.GNOSYS_CONFIG_DIR, { recursive: true });

    // This machine holds the master lease.
    const mc = ensureMachineConfig().config;
    masterMachineId = mc.machineId;
    writeMasterMarker(masterPath, mc.machineId);
    new GnosysDB(masterPath).close();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.GNOSYS_HOME;
    else process.env.GNOSYS_HOME = prevHome;
    if (prevConfigDir === undefined) delete process.env.GNOSYS_CONFIG_DIR;
    else process.env.GNOSYS_CONFIG_DIR = prevConfigDir;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function stageMemory(id: string, title: string): void {
    const payload = buildStagedMemoryPayload({
      id,
      title,
      category: "concepts",
      content: "staged content",
      machineId: clientMachineId,
    });
    writeStagedMemoryFile(masterPath, clientMachineId, payload);
  }

  it("publishes a snapshot after an ingesting sweep", async () => {
    stageMemory("01SNAPMEM01SNAPMEM01SNAPME", "Snap one");
    const result = await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
    expect(result.ingested).toBe(1);
    expect(result.errors).toEqual([]);

    const manifest = getMasterManifest(masterPath);
    expect(manifest).not.toBeNull();
    expect(manifest!.seq).toBe(1);
    expect(manifest!.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(path.join(masterPath, "snapshots", manifest!.snapshotFile))).toBe(true);
  });

  it("publishes a bootstrap snapshot even when nothing was staged", async () => {
    const result = await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
    expect(result.ingested).toBe(0);
    expect(getMasterManifest(masterPath)).not.toBeNull();
  });

  it("does not bump seq for an empty sweep when a manifest already exists", async () => {
    await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
    const first = getMasterManifest(masterPath);
    await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
    const second = getMasterManifest(masterPath);
    expect(second!.seq).toBe(first!.seq);
  });

  it("client reads the published snapshot copy, not the live master DB", async () => {
    stageMemory("01SNAPMEM02SNAPMEM02SNAPME", "Snap two");
    await runMasterIngestSweepAndPublish(masterPath, { quiet: true });

    // Switch this process to the client role for the read.
    const mc = defaultMachineConfig();
    mc.machineId = clientMachineId;
    mc.remote = { enabled: true, path: masterPath, role: "client" };
    writeMachineConfig(mc);

    const localDb = new GnosysDB(localDir);
    localDb.setMeta("remote_path", masterPath);
    const ctx = openClientReadContext(localDb, masterPath, clientMachineId);
    try {
      expect(ctx.masterReachable).toBe(true);
      expect(ctx.source).toBe("snapshot"); // NOT "master" — no network-DB read
      expect(ctx.db.getMemory("01SNAPMEM02SNAPMEM02SNAPME")?.title).toBe("Snap two");
      // Verified local copy + accepted manifest recorded
      expect(fs.existsSync(path.join(clientSnapshotStore(masterPath), "gnosys.db"))).toBe(true);
      expect(getClientAcceptedManifest(masterPath)?.seq).toBe(1);
    } finally {
      closeClientReadContext(ctx);
      localDb.close();
    }
  });

  it("client refreshes its copy when the master publishes a newer snapshot", async () => {
    await runMasterIngestSweepAndPublish(masterPath, { quiet: true }); // seq 1

    const mc = defaultMachineConfig();
    mc.machineId = clientMachineId;
    mc.remote = { enabled: true, path: masterPath, role: "client" };
    writeMachineConfig(mc);
    const localDb = new GnosysDB(localDir);
    localDb.setMeta("remote_path", masterPath);
    const ctx1 = openClientReadContext(localDb, masterPath, clientMachineId);
    closeClientReadContext(ctx1);
    expect(getClientAcceptedManifest(masterPath)?.seq).toBe(1);

    // Master ingests more and publishes seq 2 — restore master identity briefly.
    stageMemory("01SNAPMEM03SNAPMEM03SNAPME", "Snap three");
    writeMachineConfig({
      ...defaultMachineConfig(),
      machineId: masterMachineId,
      remote: { enabled: true, path: masterPath, role: "master" },
    });
    await runMasterIngestSweepAndPublish(masterPath, { quiet: true });
    expect(getMasterManifest(masterPath)!.seq).toBe(2);

    // Client read again — copy refreshed to seq 2 with the new memory.
    writeMachineConfig(mc);
    const ctx2 = openClientReadContext(localDb, masterPath, clientMachineId);
    try {
      expect(ctx2.source).toBe("snapshot");
      expect(getClientAcceptedManifest(masterPath)?.seq).toBe(2);
      expect(ctx2.db.getMemory("01SNAPMEM03SNAPMEM03SNAPME")?.title).toBe("Snap three");
    } finally {
      closeClientReadContext(ctx2);
      localDb.close();
    }
  });
});
