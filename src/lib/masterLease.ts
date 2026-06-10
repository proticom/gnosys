/**
 * v13 master.json ownership marker — epoch-fenced lease on the master folder.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { atomicWriteFileSync } from "./atomicWrite.js";
import { ensureMachineConfig } from "./machineConfig.js";

export const MASTER_MARKER_FILE = "master.json";

export interface MasterMarker {
  epoch: number;
  holderMachineId: string;
  hostname: string;
  updatedAt: string;
}

export function masterMarkerPath(masterPath: string): string {
  return path.join(masterPath, MASTER_MARKER_FILE);
}

export function readMasterMarker(masterPath: string): MasterMarker | null {
  const p = masterMarkerPath(masterPath);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf-8");
    const o = JSON.parse(raw) as Partial<MasterMarker>;
    if (typeof o.epoch !== "number" || !o.holderMachineId) return null;
    return {
      epoch: o.epoch,
      holderMachineId: o.holderMachineId,
      hostname: String(o.hostname ?? ""),
      updatedAt: String(o.updatedAt ?? ""),
    };
  } catch {
    return null;
  }
}

/** Bump epoch when claiming; reuse epoch+1 on stale takeover. */
export function writeMasterMarker(
  masterPath: string,
  machineId: string,
  opts?: { previousEpoch?: number },
): MasterMarker {
  const nextEpoch = (opts?.previousEpoch ?? 0) + 1;
  const marker: MasterMarker = {
    epoch: nextEpoch,
    holderMachineId: machineId,
    hostname: ensureMachineConfig().config.hostname,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteFileSync(masterMarkerPath(masterPath), JSON.stringify(marker, null, 2) + "\n");
  return marker;
}

/** Heartbeat refresh — same epoch, new updatedAt (transient write failures must not demote). */
export function touchMasterMarkerHeartbeat(masterPath: string): MasterMarker | null {
  const existing = readMasterMarker(masterPath);
  if (!existing) return null;
  const refreshed: MasterMarker = { ...existing, updatedAt: new Date().toISOString() };
  atomicWriteFileSync(masterMarkerPath(masterPath), JSON.stringify(refreshed, null, 2) + "\n");
  return refreshed;
}

export function assertMasterLeaseHeld(masterPath: string, machineId: string): void {
  const marker = readMasterMarker(masterPath);
  if (!marker) {
    throw new Error("master.json missing — this folder is not an active master");
  }
  if (marker.holderMachineId !== machineId) {
    throw new Error(
      `master lease held by ${marker.holderMachineId} (epoch ${marker.epoch}), not this machine`,
    );
  }
}

export function validateLeaseEpochBeforeWrite(
  masterPath: string,
  expectedEpoch: number,
  machineId: string,
): void {
  assertMasterLeaseHeld(masterPath, machineId);
  const marker = readMasterMarker(masterPath);
  if (!marker || marker.epoch !== expectedEpoch) {
    throw new Error("master lease epoch changed — aborting write");
  }
}
