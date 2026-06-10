import { describe, it, expect } from "vitest";
import { matchesLocalDiskAck, LOCAL_DISK_ACK_PHRASE } from "../lib/localDiskCheck.js";

describe("localDiskCheck", () => {
  it("matches LOCAL DISK ONLY phrase exactly", () => {
    expect(matchesLocalDiskAck(LOCAL_DISK_ACK_PHRASE)).toBe(true);
    expect(matchesLocalDiskAck(`  ${LOCAL_DISK_ACK_PHRASE}  `)).toBe(true);
    expect(matchesLocalDiskAck("wrong")).toBe(false);
  });
});
