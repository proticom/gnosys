import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { readMasterMarker, writeMasterMarker, touchMasterMarkerHeartbeat } from "../lib/masterLease.js";

describe("masterLease", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-lease-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("writes and reads epoch-fenced marker", () => {
    const m1 = writeMasterMarker(tmp, "machine-a");
    expect(m1.epoch).toBe(1);
    const m2 = writeMasterMarker(tmp, "machine-b", { previousEpoch: 1 });
    expect(m2.epoch).toBe(2);
    expect(readMasterMarker(tmp)?.holderMachineId).toBe("machine-b");
    const touched = touchMasterMarkerHeartbeat(tmp);
    expect(touched?.updatedAt).toBeTruthy();
  });
});
