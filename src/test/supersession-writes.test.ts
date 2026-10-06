import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncUpdateToDb } from "../lib/dbWrite.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

let env: TestEnv;
const now = "2026-10-06T12:00:00.000Z";

beforeEach(async () => {
  env = await createTestEnv("supersession-writes");
  vi.useFakeTimers();
  vi.setSystemTime(now);
  for (const id of ["old", "correction", "other"]) {
    env.db.insertMemory(makeMemory({ id, title: id, created: "2025-01-02", modified: "2025-01-02" }));
  }
});

afterEach(async () => {
  vi.useRealTimers();
  await cleanupTestEnv(env);
});

describe("supersession writes", () => {
  it.each(["supersedes", "superseded_by"] as const)("links both ends through %s and makes both rows sync-visible", (field) => {
    const id = field === "supersedes" ? "correction" : "old";
    const target = field === "supersedes" ? "old" : "correction";
    syncUpdateToDb(env.db, id, { [field]: target });
    syncUpdateToDb(env.db, id, { [field]: target });
    expect(env.db.getMemory("old")).toMatchObject({
      status: "superseded", superseded_by: "correction", modified: now,
    });
    expect(env.db.getMemory("correction")).toMatchObject({
      status: "active", supersedes: "old", modified: now,
    });
    expect(env.db.getIdsModifiedSince("2026-10-06T11:59:59.000Z").map((row) => row.id).sort())
      .toEqual(["correction", "old"]);
  });

  it.each(["supersedes", "superseded_by"] as const)("rejects an invalid %s atomically", (field) => {
    expect(() => syncUpdateToDb(env.db, "correction", { title: "Changed", [field]: "missing" }))
      .toThrow("Memory not found: missing");
    expect(env.db.getMemory("correction")).toMatchObject({ title: "correction", supersedes: null, superseded_by: null });
  });

  it("keeps many predecessors when linking, relinking, and unlinking one", () => {
    env.db.insertMemory(makeMemory({ id: "next" }));
    syncUpdateToDb(env.db, "correction", { supersedes: "old" });
    syncUpdateToDb(env.db, "correction", { supersedes: "other" });
    expect(env.db.getMemory("correction")?.supersedes).toBe("old, other");
    const other = env.db.getMemory("other");
    syncUpdateToDb(env.db, "old", { superseded_by: "next" });
    expect(env.db.getMemory("other")).toEqual(other);
    expect(env.db.getMemory("correction")?.supersedes).toBe("other");
    expect(env.db.getMemory("next")?.supersedes).toBe("old");
    vi.setSystemTime("2026-10-06T12:00:01.000Z");
    syncUpdateToDb(env.db, "old", { superseded_by: "" });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: null, status: "active", modified: "2026-10-06T12:00:01.000Z" });
    expect(env.db.getMemory("next")).toMatchObject({ supersedes: null, modified: "2026-10-06T12:00:01.000Z" });
    expect(env.db.getMemory("other")).toEqual(other);
  });

  it("derives a stable comma-separated list from authoritative links", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "other, old, other" });
    expect(env.db.getMemory("correction")?.supersedes).toBe("old, other");
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: "correction", status: "superseded" });
    expect(env.db.getMemory("other")).toMatchObject({ superseded_by: "correction", status: "superseded" });
    expect(() => syncUpdateToDb(env.db, "correction", { supersedes: "" }))
      .toThrow("Clear superseded_by on each predecessor to unlink it.");
    expect(env.db.getMemory("correction")?.supersedes).toBe("old, other");
  });

  it("leaves every other predecessor unchanged in an asymmetric legacy fan-in", () => {
    env.db.updateMemory("old", { superseded_by: "correction", status: "superseded" });
    env.db.updateMemory("other", { superseded_by: "correction", status: "superseded" });
    env.db.updateMemory("correction", { supersedes: "other" });
    const other = env.db.getMemory("other");
    syncUpdateToDb(env.db, "old", { superseded_by: "" });
    expect(env.db.getMemory("other")).toEqual(other);
    expect(env.db.getMemory("other")).toMatchObject({ status: "superseded", superseded_by: "correction", modified: "2025-01-02" });
    expect(env.db.getMemory("correction")?.supersedes).toBe("other");
  });

  it("keeps explicit status through completed, superseded, and unlinked updates", () => {
    syncUpdateToDb(env.db, "old", { status: "completed" });
    syncUpdateToDb(env.db, "old", { superseded_by: "correction" });
    expect(env.db.getMemory("old")?.status).toBe("superseded");
    syncUpdateToDb(env.db, "old", { superseded_by: "", status: "completed" });
    expect(env.db.getMemory("old")).toMatchObject({ status: "completed", superseded_by: null });
    syncUpdateToDb(env.db, "old", { superseded_by: "correction", status: "completed" });
    expect(env.db.getMemory("old")).toMatchObject({ status: "completed", superseded_by: "correction" });
    syncUpdateToDb(env.db, "old", { superseded_by: "" });
    expect(env.db.getMemory("old")?.status).toBe("completed");
  });

  it("restores archived status only when clearing an automatically superseded archive row", () => {
    env.db.updateMemory("old", { tier: "archive", status: "archived" });
    syncUpdateToDb(env.db, "old", { superseded_by: "correction" });
    syncUpdateToDb(env.db, "old", { superseded_by: "" });
    expect(env.db.getMemory("old")).toMatchObject({ status: "archived", tier: "archive" });
  });

  it.each(["scope", "project"])("rejects cross-%s linking unless explicitly allowed", (boundary) => {
    env.db.updateMemory("old", { scope: "project", project_id: "writer" });
    env.db.updateMemory("correction", boundary === "scope"
      ? { scope: "global", project_id: null }
      : { scope: "project", project_id: "other-project" });
    expect(() => syncUpdateToDb(env.db, "old", { superseded_by: "correction" }))
      .toThrow("Pass allowCrossScope: true");
    expect(env.db.getMemory("old")).toMatchObject({ status: "active", superseded_by: null });
    syncUpdateToDb(env.db, "old", { superseded_by: "correction" }, undefined, { allowCrossScope: true });
    expect(env.db.getMemory("old")).toMatchObject({ status: "superseded", superseded_by: "correction" });
    expect(env.db.getMemory("correction")?.supersedes).toBe("old");
  });

  it("rejects self-links and cycles without changing the chain", () => {
    expect(() => syncUpdateToDb(env.db, "old", { supersedes: "old" })).toThrow("cycle");
    syncUpdateToDb(env.db, "correction", { supersedes: "old" });
    expect(() => syncUpdateToDb(env.db, "old", { supersedes: "correction" })).toThrow("cycle");
    expect(env.db.getMemory("old")).toMatchObject({ supersedes: null, superseded_by: "correction" });
  });

  it("rejects a missing source without leaving a dangling inverse link", () => {
    expect(() => syncUpdateToDb(env.db, "missing", { supersedes: "old" })).toThrow("Memory not found: missing");
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: null, status: "active" });
  });

  it("rolls back a cycle formed by setting both links at once", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "old" });
    expect(() => syncUpdateToDb(env.db, "other", { supersedes: "correction", superseded_by: "old" })).toThrow("cycle");
    expect(env.db.getMemory("old")).toMatchObject({ supersedes: null, superseded_by: "correction", status: "superseded" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: "old", superseded_by: null, status: "active" });
    expect(env.db.getMemory("other")).toMatchObject({ supersedes: null, superseded_by: null, status: "active" });
  });

  it("updates searchable content with a link", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "old" }, "Corrected content");
    expect(env.db.getMemory("correction")).toMatchObject({ content: "Corrected content", modified: now });
    expect(env.db.getMemory("old")?.modified).toBe(now);
  });
});
