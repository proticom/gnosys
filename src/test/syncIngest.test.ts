import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("syncIngest", () => {
  let masterPath: string;
  const machineId = "01INGESTMACHINEINGESTMACH";

  beforeEach(() => {
    masterPath = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-ingest-"));
    const mc = ensureMachineConfig().config;
    writeMasterMarker(masterPath, mc.machineId);
    new GnosysDB(masterPath).close();
  });

  afterEach(() => {
    fs.rmSync(masterPath, { recursive: true, force: true });
  });

  it("ingests a staged memory and removes the JSON file", () => {
    const payload = buildStagedMemoryPayload({
      id: "01INGESTMEM01INGESTMEM01ING",
      title: "Staged",
      category: "concepts",
      content: "from client",
      machineId,
    });
    writeStagedMemoryFile(masterPath, machineId, payload);
    const result = runMasterIngestSweep(masterPath);
    expect(result.ingested).toBe(1);
    const db = new GnosysDB(masterPath);
    expect(db.getMemory(payload.id)?.title).toBe("Staged");
    db.close();
    const stagedDir = path.join(masterPath, ".gnosys-staging", machineId);
    expect(fs.readdirSync(stagedDir).filter((n) => n.endsWith(".json"))).toHaveLength(0);
  });
});
