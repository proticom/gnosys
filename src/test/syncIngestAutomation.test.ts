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
import { ensureMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
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

    it("json mode writes a single JSON object to stdout", () => {
      runMasterIngestSweep(masterPath, { json: true });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(parsed).toEqual({ ingested: 0, skipped: 0, quarantined: 0, errors: [] });
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
      const persisted = new GnosysDB(masterPath);
      try { expect(persisted.getMemory("01INGESTMEM01INGESTMEM01ING")).toMatchObject({ title: "Staged", content: "from client" }); }
      finally { persisted.close(); }
    });
  });

  describe("maybeRunStartupIngestSweep", () => {
    let base: string;
    let master: string;
    let stagedFile: string;
    beforeEach(() => {
      base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-startup-ingest-"));
      master = path.join(base, "master");
      fs.mkdirSync(master, { recursive: true });
      vi.stubEnv("GNOSYS_HOME", path.join(base, "local"));
      vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(base, "config"));
      const mc = ensureMachineConfig().config;
      writeMasterMarker(master, mc.machineId);
      const local = GnosysDB.openLocal();
      local.setMeta("remote_path", master);
      local.close();
      new GnosysDB(master).close();
      const file = writeStagedMemoryFile(master, mc.machineId, buildStagedMemoryPayload({ id: "startup-memory", title: "Pending startup", category: "concepts", content: "Preserve until master", machineId: mc.machineId }));
      stagedFile = path.join(master, ".gnosys-staging", mc.machineId, file);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      fs.rmSync(base, { recursive: true, force: true });
    });
    function readStartupMemory() {
      const db = new GnosysDB(master);
      try { return db.getMemory("startup-memory"); } finally { db.close(); }
    }
    it("skips when machine role is client", async () => {
      const mc = ensureMachineConfig().config;
      mc.remote = { enabled: true, role: "client", path: master };
      writeMachineConfig(mc);
      await maybeRunStartupIngestSweep();
      expect(readStartupMemory()).toBeNull();
      expect(fs.existsSync(stagedFile)).toBe(true);
      mc.remote = { enabled: true, role: "master", path: master };
      writeMachineConfig(mc);
      await maybeRunStartupIngestSweep();
      expect(readStartupMemory()).toMatchObject({ title: "Pending startup", content: "Preserve until master" });
      expect(fs.existsSync(stagedFile)).toBe(false);
    });

    it("skips when remote sync is disabled", async () => {
      const mc = ensureMachineConfig().config;
      mc.remote = { enabled: false, role: "master", path: master };
      writeMachineConfig(mc);
      await maybeRunStartupIngestSweep();
      expect(readStartupMemory()).toBeNull();
      expect(fs.existsSync(stagedFile)).toBe(true);
      mc.remote = { enabled: true, role: "master", path: master };
      writeMachineConfig(mc);
      await maybeRunStartupIngestSweep();
      expect(readStartupMemory()).toMatchObject({ title: "Pending startup", content: "Preserve until master" });
      expect(fs.existsSync(stagedFile)).toBe(false);
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
