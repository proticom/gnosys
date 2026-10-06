import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleRequest } from "../sandbox/server.js";
import { createTestEnv, cleanupTestEnv, makeMemory, type TestEnv } from "./_helpers.js";

describe("recall paths built on federated search stay current-only", () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv("recall-excludes-superseded");
    env.db.insertMemory(makeMemory({
      id: "old-filters", title: "Tenant isolation uses app-level filters",
      relevance: "tenant isolation filters tenant isolation", content: "tenant isolation ".repeat(20),
      status: "superseded", superseded_by: "rls-decision",
    }));
    env.db.insertMemory(makeMemory({
      id: "rls-decision", title: "Tenant isolation uses row-level security",
      relevance: "tenant isolation rls", content: "Use Postgres row-level security for tenant isolation.",
      supersedes: "old-filters",
    }));
  });
  afterEach(async () => { await cleanupTestEnv(env); });

  it("sandbox recall returns the replacement and never the superseded memory", () => {
    const response = handleRequest(env.db, { id: "r1", method: "recall", params: { query: "tenant isolation", limit: 10 } });
    expect(response.ok).toBe(true);
    const ids = (response.result as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toEqual(["rls-decision"]);
  });
});
