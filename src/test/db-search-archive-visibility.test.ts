import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GnosysDbSearch } from "../lib/dbSearch.js";
import { cleanupTestEnv, createTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => { env = await createTestEnv("db-search-archive-visibility"); });
afterEach(async () => { await cleanupTestEnv(env); });

describe("hybrid archive fallback respects project visibility", () => {
  it("adds archived matches from the scoped project and shared tiers only", async () => {
    const vector = Buffer.from(new Float32Array([1, 0]).buffer);
    const archived = { content: "cobalt evidence", tier: "archive" as const, status: "archived" as const };
    env.db.insertMemory(makeMemory({ id: "p1-anchor", content: "unrelated active record", embedding: vector, scope: "project", project_id: "p1" }));
    env.db.insertMemory(makeMemory({ id: "p1-archived", ...archived, scope: "project", project_id: "p1" }));
    env.db.insertMemory(makeMemory({ id: "p2-archived", ...archived, scope: "project", project_id: "p2" }));
    env.db.insertMemory(makeMemory({ id: "user-archived", ...archived, scope: "user", project_id: null }));
    const search = new GnosysDbSearch(env.db);
    const embed = async () => new Float32Array([1, 0]);
    const archiveIds = async (visibility?: { projectId: string }) =>
      (await search.hybridSearch("cobalt", 20, "semantic", embed, false, visibility))
        .filter((hit) => hit.sources.includes("archive"))
        .map((hit) => hit.memoryId)
        .sort();

    expect(await archiveIds({ projectId: "p1" })).toEqual(["p1-archived", "user-archived"]);
    expect(await archiveIds()).toEqual(["p1-archived", "p2-archived", "user-archived"]);
  });
});
