import { describe, it, expect } from "vitest";
import { matchesLocalDiskAck } from "../lib/localDiskCheck.js";

describe("localDiskCheck", () => {
  it("matches LOCAL DISK ONLY phrase exactly", () => {
    expect(matchesLocalDiskAck("LOCAL DISK ONLY")).toBe(true);
    expect(matchesLocalDiskAck("  LOCAL DISK ONLY  ")).toBe(true);
    expect(matchesLocalDiskAck("wrong")).toBe(false);
  });
});
