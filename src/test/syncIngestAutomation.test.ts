import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB } from "../lib/db.js";
import {
  buildStagedMemoryPayload,
  writeStagedMemoryFile,
} from "../lib/syncStaging.js";
import { writeMasterMarker } from "../lib/masterLease.js";
import { runMasterIngestSweep } from "../lib/syncIngest.js";
import { ensureMachineConfig } from "../lib/machineConfig.js";
import { buildSyncIngestLaunchAgentPlist } from "../lib/syncIngestLaunchd.js";
import {
  buildSyncIngestSystemdService,
  buildSyncIngestSystemdTimer,
} from "../lib/syncIngestSystemd.js";
import { maybeRunStartupIngestSweep } from "../lib/syncIngestStartup.js";

describe("syncIngest automation", () => {
  describe("runMasterIngestSweep output modes", () => {
    let masterPath: string;
    const machineId = "01INGESTMACHINEINGESTMACH";
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      masterPath = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-ingest-auto-"));
      const mc = ensureMachineConfig().config;
      writeMasterMarker(masterPath, mc.machineId);
      new GnosysDB(masterPath).close();
      logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      fs.rmSync(masterPath, { recursive: true, force: true });
    });

    it("quiet mode produces zero stdout", () => {
      runMasterIngestSweep(masterPath, { quiet: true });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("json mode writes a single JSON object to stdout", () => {
      runMasterIngestSweep(masterPath, { json: true });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(parsed).toMatchObject({
        ingested: expect.any(Number),
        skipped: expect.any(Number),
        quarantined: expect.any(Number),
        errors: expect.any(Array),
      });
    });

    it("json mode still succeeds with zero ingested", () => {
      const result = runMasterIngestSweep(masterPath, { json: true, quiet: true });
      expect(result.errors).toHaveLength(0);
      expect(result.ingested).toBe(0);
    });

    it("ingests staged memory in quiet mode without stdout", () => {
      const payload = buildStagedMemoryPayload({
        id: "01INGESTMEM01INGESTMEM01ING",
        title: "Staged",
        category: "concepts",
        content: "from client",
        machineId,
      });
      writeStagedMemoryFile(masterPath, machineId, payload);
      const result = runMasterIngestSweep(masterPath, { quiet: true });
      expect(result.ingested).toBe(1);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("maybeRunStartupIngestSweep", () => {
    it("skips when machine role is client", async () => {
      const machineConfig = await import("../lib/machineConfig.js");
      vi.spyOn(machineConfig, "readMachineConfig").mockReturnValue({
        machineId: "01CLIENTMACHINE01CLIENTMACH",
        hostname: "test-host",
        roots: {},
        schemaVersion: 1,
        remote: { enabled: true, role: "client", path: "/tmp/master" },
      });

      const dbMod = await import("../lib/db.js");
      const openSpy = vi.spyOn(dbMod.GnosysDB, "openLocal");
      const ingestMod = await import("../lib/syncIngest.js");
      const sweepSpy = vi.spyOn(ingestMod, "runMasterIngestSweep");

      await maybeRunStartupIngestSweep();

      expect(openSpy).not.toHaveBeenCalled();
      expect(sweepSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it("skips when remote sync is disabled", async () => {
      const machineConfig = await import("../lib/machineConfig.js");
      vi.spyOn(machineConfig, "readMachineConfig").mockReturnValue({
        machineId: "01MASTERMACHINE01MASTERMACH",
        hostname: "test-host",
        roots: {},
        schemaVersion: 1,
        remote: { enabled: false },
      });

      const dbMod = await import("../lib/db.js");
      const openSpy = vi.spyOn(dbMod.GnosysDB, "openLocal");
      await maybeRunStartupIngestSweep();
      expect(openSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe("launchd plist generation", () => {
    it("produces valid XML with required keys", () => {
      const xml = buildSyncIngestLaunchAgentPlist(15);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain("<key>Label</key>");
      expect(xml).toContain("<string>com.gnosys.sync-ingest</string>");
      expect(xml).toContain("<key>StartInterval</key>");
      expect(xml).toContain("<integer>900</integer>");
      expect(xml).toContain("<string>setup</string>");
      expect(xml).toContain("<string>--ingest</string>");
      expect(xml).toContain("<string>--quiet</string>");
      expect(xml).toContain("gnosys-sync-ingest.log");
    });
  });

  describe("systemd unit generation", () => {
    it("produces a valid oneshot service unit", () => {
      const service = buildSyncIngestSystemdService();
      expect(service).toContain("[Unit]");
      expect(service).toContain("[Service]");
      expect(service).toContain("Type=oneshot");
      expect(service).toContain("setup remote doctor --ingest --quiet");
    });

    it("produces a timer with configurable interval", () => {
      const timer = buildSyncIngestSystemdTimer(20);
      expect(timer).toContain("[Timer]");
      expect(timer).toContain("OnUnitActiveSec=1200s");
      expect(timer).toContain("WantedBy=timers.target");
    });
  });
});
