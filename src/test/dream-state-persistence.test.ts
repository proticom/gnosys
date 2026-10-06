import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDreamState, writeDreamState, type DreamState } from "../lib/dreamRunLog.js";

let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "dream-state-persistence-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

const analyzedAt = "2026-10-06T02:00:00.000Z";

function entry(kind: "summary" | "critique" | "relationship", memoryIds: string[], lastAnalyzedAt = analyzedAt) {
  return { kind, memoryIds, lastAnalyzedAt };
}

describe("Dream state persistence", () => {
  it("prunes expired records and obsolete generations without confusing source and batch records", () => {
    const state: DreamState = {
      lastRunAt: analyzedAt,
      analyzedFingerprints: {
        expired: entry("critique", ["expired"], "2026-07-07T01:59:59.000Z"),
        boundary: entry("critique", ["boundary"], "2026-07-08T02:00:00.000Z"),
        "summary:old": entry("summary", ["a", "b"], "2026-10-05T02:00:00.000Z"),
        "summary:new": entry("summary", ["b", "a"]),
        "relationship-source:stable:corpus:old": entry("relationship", ["a"]),
        "relationship-source:stable:corpus:new": entry("relationship", ["a"]),
        "relationship:batch": entry("relationship", ["a"]),
      },
    };
    writeDreamState(state, directory);
    expect(Object.keys(readDreamState(directory).analyzedFingerprints).sort()).toEqual([
      "boundary", "relationship-source:stable:corpus:new", "relationship:batch", "summary:new",
    ]);
    writeDreamState(readDreamState(directory), directory);
    expect(Object.keys(readDreamState(directory).analyzedFingerprints).sort()).toEqual([
      "boundary", "relationship-source:stable:corpus:new", "relationship:batch", "summary:new",
    ]);
    expect(fs.readdirSync(directory)).toEqual(["dream-state.json"]);
  });

  it("retains the latest source retry cap and prunes old content hashes and expired attempts", () => {
    writeDreamState({
      lastRunAt: analyzedAt,
      analyzedFingerprints: {},
      relationshipRetries: {
        "relationship-source:old": { attempts: 2, lastAttemptAt: "2026-10-05T02:00:00.000Z", memoryIds: ["a"] },
        "relationship-source:new": { attempts: 3, lastAttemptAt: analyzedAt, memoryIds: ["a"] },
        "relationship-source:expired": { attempts: 3, lastAttemptAt: "2026-07-07T02:00:00.000Z", memoryIds: ["b"] },
      },
    }, directory);
    expect(readDreamState(directory).relationshipRetries).toEqual({
      "relationship-source:new": { attempts: 3, lastAttemptAt: "2026-10-06T02:00:00.000Z", memoryIds: ["a"] },
    });
  });

  it("keeps the prior state readable when rename fails and removes the temporary file", () => {
    writeDreamState({ lastRunAt: "2026-10-05T02:00:00.000Z", analyzedFingerprints: {} }, directory);
    vi.spyOn(fs, "renameSync").mockImplementation((temporaryFile) => {
      expect(readDreamState(directory).lastRunAt).toBe("2026-10-05T02:00:00.000Z");
      expect(JSON.parse(fs.readFileSync(temporaryFile, "utf8")).lastRunAt).toBe("2026-10-06T02:00:00.000Z");
      throw new Error("simulated interrupted rename");
    });
    expect(() => writeDreamState({ lastRunAt: analyzedAt, analyzedFingerprints: {} }, directory))
      .toThrow("simulated interrupted rename");
    expect(readDreamState(directory).lastRunAt).toBe("2026-10-05T02:00:00.000Z");
    expect(fs.readdirSync(directory)).toEqual(["dream-state.json"]);
  });
});
