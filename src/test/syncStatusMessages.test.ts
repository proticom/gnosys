import { describe, it, expect } from "vitest";
import {
  MASTER_UNREACHABLE_MESSAGE,
  formatMemoriesWaitingToSync,
  formatFailedToSyncCount,
  formatOfflinePushStarting,
  renderClientSyncStatusLines,
} from "../lib/setup/remoteRender.js";

function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("v13 sync status messages", () => {
  it("uses design-doc master unreachable wording", () => {
    expect(MASTER_UNREACHABLE_MESSAGE).toBe(
      "Master unreachable; existing memories are unavailable until reconnect.",
    );
  });

  it("formats waiting and failed counts", () => {
    expect(formatMemoriesWaitingToSync(0)).toBe("0 memories waiting to sync");
    expect(formatMemoriesWaitingToSync(1)).toBe("1 memory waiting to sync");
    expect(formatMemoriesWaitingToSync(3)).toBe("3 memories waiting to sync");
    expect(formatFailedToSyncCount(2)).toBe("2 failed to sync");
  });

  it("formats offline push starting message", () => {
    expect(formatOfflinePushStarting(3)).toContain("Found 3 memories written while offline");
    expect(formatOfflinePushStarting(1)).toContain("1 memory");
  });

  it("renderClientSyncStatusLines shows unreachable + offline overlay", () => {
    const lines = renderClientSyncStatusLines({
      masterReachable: false,
      waitingToSync: 0,
      failedToSync: 0,
      pendingOfflineAdds: 2,
    }).map(strip);
    expect(lines.join("\n")).toContain(MASTER_UNREACHABLE_MESSAGE);
    expect(lines.join("\n")).toContain("2 new memories queued locally");
  });

  it("renderClientSyncStatusLines shows waiting and failed when online", () => {
    const lines = renderClientSyncStatusLines({
      masterReachable: true,
      waitingToSync: 4,
      failedToSync: 1,
    }).map(strip);
    const joined = lines.join("\n");
    expect(joined).toContain("4 memories waiting to sync");
    expect(joined).toContain("1 failed to sync");
    expect(joined).toContain("gnosys sync doctor");
  });
});
