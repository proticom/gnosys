import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { GnosysStore } from "../lib/store.js";
import path from "node:path";
import { makeFrontmatter, makeMemory } from "./_helpers.js";
import { call, ContextHarness, contextBody, contextText, contextTitle, mapping, records } from "./context-adversarial-helpers.js";

let harness: ContextHarness;
beforeEach(async () => { harness = new ContextHarness(); await harness.start(); });
afterEach(async () => { await harness.close(); });

function expectSaved(projectId: string): void {
  expect(harness.memories().filter(memory => memory.project_id === projectId).map(({ title, content, project_id, scope, authority }) => ({ title, content, project_id, scope, authority })))
    .toEqual([{ title: contextTitle, content: `# ${contextTitle}\n\n${contextBody}`, project_id: projectId, scope: "project", authority: "observed" }]);
}
function expectImportRequests(): void {
  expect(harness.requests.map(({ pathname, model }) => ({ pathname, model }))).toEqual([
    { pathname: "/v1/chat/completions", model: "adversarial-custom" },
    { pathname: "/v1/chat/completions", model: "adversarial-custom" },
  ]);
  expect(harness.requests.map(request => request.prompt).sort()).toEqual([
    "Structure this into an atomic memory:\n\nTitle: Cerulean manifests\nCategory: imported\n\nSign cerulean deployment manifests.",
    "Structure this into an atomic memory:\n\nTitle: Verdigris runbooks\nCategory: imported\n\nKeep verdigris recovery instructions.",
  ]);
  expect(harness.maximum).toBe(2);
}

describe("adversarial context and provider routing", () => {
  it("D-CTX-001 custom-provider CLI context commits the new journal decision", async () => {
    const result = await harness.run(["commit-context", contextText]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("COMMITTED: 1 candidates, 1 added, 0 duplicates skipped.");
    expectSaved(harness.projects[0].id);
  });

  it("custom-provider MCP context commits the same journal decision", async () => {
    const client = await harness.connect();
    const result = await call(client, "gnosys_commit_context", { context: contextText });
    expect(result).toMatchObject({ isError: false });
    expect(result.text).toContain("Context committed — 1 candidates extracted, 1 added, 0 duplicates skipped:");
    expectSaved(harness.projects[0].id);
    expect(harness.requests.map(({ pathname, model }) => ({ pathname, model }))).toEqual([
      { pathname: "/v1/chat/completions", model: "adversarial-custom" },
      { pathname: "/v1/chat/completions", model: "adversarial-custom" },
    ]);
  });

  it("G2-D003 custom-provider CLI bulk import uses configured concurrency", async () => {
    const result = await harness.run(harness.importArgs());
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("  Imported: 2\n  Skipped:  0\n  Failed:   0\n  Total:    2");
    expectImportRequests();
  });

  it("custom-provider MCP bulk import uses configured concurrency", async () => {
    const client = await harness.connect();
    const result = await call(client, "gnosys_import", { format: "json", data: JSON.stringify(records), mapping, mode: "llm", dryRun: true });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("  Imported: 2\n  Skipped:  0\n  Failed:   0\n  Total:    2");
    expectImportRequests();
    expect(harness.memories()).toEqual([]);
  });

  it.fails("ADV-CTX-002 normal CLI bulk import persists the reported memories", async () => {
    const result = await harness.run(harness.importArgs(false));
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("  Imported: 2\n  Skipped:  0\n  Failed:   0\n  Total:    2");
    expectImportRequests();
    expect(harness.memories().map(({ title, content }) => ({ title, content })).sort((a, b) => a.title.localeCompare(b.title)), JSON.stringify({ result, memories: harness.memories() })).toEqual([
      { title: "Cerulean manifests", content: "# Cerulean manifests\n\nStructured Sign cerulean deployment manifests." },
      { title: "Verdigris runbooks", content: "# Verdigris runbooks\n\nStructured Keep verdigris recovery instructions." },
    ]);
  });

  it.fails("ADV-CTX-002 normal MCP bulk import persists the reported memories", async () => {
    const client = await harness.connect();
    const result = await call(client, "gnosys_import", { format: "json", data: JSON.stringify(records), mapping, mode: "llm" });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("  Imported: 2\n  Skipped:  0\n  Failed:   0\n  Total:    2");
    expect(harness.memories().map(({ title, content }) => ({ title, content })).sort((a, b) => a.title.localeCompare(b.title)), JSON.stringify({ result, memories: harness.memories() })).toEqual([
      { title: "Cerulean manifests", content: "# Cerulean manifests\n\nStructured Sign cerulean deployment manifests." },
      { title: "Verdigris runbooks", content: "# Verdigris runbooks\n\nStructured Keep verdigris recovery instructions." },
    ]);
  });

  it("D-CTX-001 context without a provider fails with setup guidance", async () => {
    harness.configure(harness.projects[0].root, false);
    const result = await harness.run(["commit-context", contextText]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("gnosys setup");
    expect(harness.memories()).toEqual([]);
  });

  it("CLI import without a provider fails with setup guidance", async () => {
    harness.configure(harness.projects[0].root, false);
    const result = await harness.run(harness.importArgs());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Run 'gnosys setup'");
    expect(harness.memories()).toEqual([]);
    expect(harness.requests).toEqual([]);
  });

  it("MCP context without a provider fails with setup guidance", async () => {
    harness.configure(harness.projects[0].root, false);
    const client = await harness.connect();
    const result = await call(client, "gnosys_commit_context", { context: contextText });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No default LLM provider configured. Run 'gnosys setup'");
    expect(harness.memories()).toEqual([]);
  });

  it("MCP import without a provider fails with setup guidance", async () => {
    harness.configure(harness.projects[0].root, false);
    const client = await harness.connect();
    const result = await call(client, "gnosys_import", { format: "json", data: JSON.stringify(records), mapping, mode: "llm" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Run 'gnosys setup'");
    expect(harness.memories()).toEqual([]);
  });
});

describe("adversarial project selection", () => {
  it("the same context is saved independently in projects A and B", async () => {
    const client = await harness.connect();
    for (const project of harness.projects) {
      const result = await call(client, "gnosys_commit_context", { context: contextText, projectRoot: project.root });
      expect(result.text).toContain("Context committed — 1 candidates extracted, 1 added, 0 duplicates skipped:");
      expectSaved(project.id);
    }
    expect(harness.memories()).toHaveLength(2);
  });

  it("D-CTX-002 repeated B context skips only B's already saved journal", async () => {
    const client = await harness.connect();
    for (const project of harness.projects) await call(client, "gnosys_commit_context", { context: contextText, projectRoot: project.root });
    const result = await call(client, "gnosys_commit_context", { context: contextText, projectRoot: harness.projects[1].root });
    expect(result.text).toContain("Context committed — 1 candidates extracted, 0 added, 1 duplicates skipped:");
    for (const project of harness.projects) expectSaved(project.id);
    expect(harness.memories()).toHaveLength(2);
  });

  it("startup-project context skips its already saved journal", async () => {
    const client = await harness.connect();
    await call(client, "gnosys_commit_context", { context: contextText });
    const result = await call(client, "gnosys_commit_context", { context: contextText });
    expect(result.text).toContain("Context committed — 1 candidates extracted, 0 added, 1 duplicates skipped:");
    expectSaved(harness.projects[0].id);
  });

  it("explicit project B update resolves the shared relative path inside B", async () => {
    const db = new GnosysDB(harness.brain);
    try {
      for (const [index, project] of harness.projects.entries()) {
        const id = `adversarial-route-${index}`;
        const title = `Route ${index}`;
        const content = `Original route ${index}`;
        const store = new GnosysStore(path.join(project.root, ".gnosys"));
        await store.writeMemory("decisions", "shared-route.md", makeFrontmatter({ id, title }), content, { autoCommit: false });
        db.insertMemory(makeMemory({ id, title, content, project_id: project.id, scope: "project" }));
      }
    } finally { db.close(); }
    const client = await harness.connect();
    const result = await call(client, "gnosys_update", { path: "decisions/shared-route.md", content: "Only B receives the amended route", projectRoot: harness.projects[1].root });
    expect(result.isError).toBe(false);
    expect(harness.memories().map(({ id, content, project_id }) => ({ id, content, project_id }))).toEqual([
      { id: "adversarial-route-0", content: "Original route 0", project_id: harness.projects[0].id },
      { id: "adversarial-route-1", content: "# Route 1\n\nOnly B receives the amended route", project_id: harness.projects[1].id },
    ]);
  });
});
