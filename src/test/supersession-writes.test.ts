import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncUpdateToDb } from "../lib/dbWrite.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("supersession-writes");
  for (const id of ["old", "correction", "other"]) {
    env.db.insertMemory(makeMemory({ id, title: id, modified: "2025-01-02" }));
  }
});

afterEach(async () => cleanupTestEnv(env));

describe("supersession writes", () => {
  it.each(["supersedes", "superseded_by"] as const)("links both ends through %s without changing historical dates", (field) => {
    const id = field === "supersedes" ? "correction" : "old";
    const target = field === "supersedes" ? "old" : "correction";
    syncUpdateToDb(env.db, id, { [field]: target });
    syncUpdateToDb(env.db, id, { [field]: target });
    expect(env.db.getMemory("old")).toMatchObject({
      status: "superseded", superseded_by: "correction", modified: "2025-01-02",
    });
    expect(env.db.getMemory("correction")).toMatchObject({
      status: "active", supersedes: "old", modified: "2025-01-02",
    });
  });

  it.each(["supersedes", "superseded_by"] as const)("rejects an invalid %s before changing other fields", (field) => {
    expect(() => syncUpdateToDb(env.db, "correction", { title: "Changed", [field]: "missing" }))
      .toThrow("Memory not found: missing");
    expect(env.db.getMemory("correction")).toMatchObject({ title: "correction", supersedes: null, superseded_by: null });
  });

  it("relinks and clears both ends", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "old" });
    syncUpdateToDb(env.db, "other", { supersedes: "old" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: null, status: "active" });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: "other", status: "superseded" });
    syncUpdateToDb(env.db, "other", { supersedes: "" });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: null, status: "active", modified: "2025-01-02" });
    expect(env.db.getMemory("other")).toMatchObject({ supersedes: null });
  });

  it("clears a replacement link from the predecessor", () => {
    syncUpdateToDb(env.db, "old", { superseded_by: "correction" });
    syncUpdateToDb(env.db, "old", { superseded_by: "" });
    expect(env.db.getMemory("old")).toMatchObject({ superseded_by: null, status: "active" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: null });
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

  it("validates the final links when reversing a chain", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "old" });
    syncUpdateToDb(env.db, "other", { supersedes: "correction" });
    syncUpdateToDb(env.db, "correction", { supersedes: "other", superseded_by: "old" });
    expect(env.db.getMemory("old")).toMatchObject({ supersedes: "correction", superseded_by: null, status: "active" });
    expect(env.db.getMemory("correction")).toMatchObject({ supersedes: "other", superseded_by: "old", status: "superseded" });
    expect(env.db.getMemory("other")).toMatchObject({ supersedes: null, superseded_by: "correction", status: "superseded" });
  });

  it("still updates the date when content changes with a supersession link", () => {
    syncUpdateToDb(env.db, "correction", { supersedes: "old" }, "Corrected content");
    expect(env.db.getMemory("correction")).toMatchObject({ content: "Corrected content", modified: new Date().toISOString().split("T")[0] });
    expect(env.db.getMemory("old")).toMatchObject({ modified: "2025-01-02" });
  });
});
