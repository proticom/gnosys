/**
 * QA 2026-10-06 bug 2: gnosys_search, gnosys_discover and gnosys_recall with
 * projectRoot=p1 returned project-scoped memories that belong to p2.
 *
 * Intended semantics (projectRoot "routes the call to that project's store";
 * federated design ranks project > user > global): a read scoped to a
 * registered projectRoot sees that project's memories plus the shared user and
 * global tiers, never another project's. gnosys_federated_search stays the
 * explicit cross-project tool. Calls without projectRoot, or with a root that
 * was never gnosys_init'ed, keep the whole-brain view.
 *
 * Drives the real MCP server (dist/index.js) over stdio against an isolated
 * GNOSYS_HOME.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_ENTRY = path.resolve("dist/index.js");
const KEYWORD = "quokkabridge";

const TITLES = {
  p1: "Quokkabridge note owned by project one",
  p2: "Quokkabridge note owned by project two",
  user: "Quokkabridge personal note",
  global: "Quokkabridge global note",
};

function toolText(result: unknown): string {
  const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content;
  return blocks?.map((b) => b.text ?? "").join("\n") ?? "";
}

/** Which seeded memories a tool response mentions, by owner. */
function owners(text: string): string[] {
  return (Object.keys(TITLES) as Array<keyof typeof TITLES>)
    .filter((k) => text.includes(TITLES[k]))
    .sort();
}

let base: string;
let p1: string;
let p2: string;
let client: Client;

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name, arguments: args });
  const text = toolText(res);
  expect(res.isError, `${name} failed: ${text}`).not.toBe(true);
  return text;
}

beforeAll(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-projectroot-vis-"));
  const central = path.join(base, "central");
  const home = path.join(base, "home");
  const personal = path.join(base, "personal");
  const global = path.join(base, "global");
  p1 = path.join(base, "p1");
  p2 = path.join(base, "p2");
  for (const d of [central, home, personal, global, p1, p2]) fs.mkdirSync(d, { recursive: true });

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_ENTRY],
    cwd: central,
    env: {
      ...process.env,
      GNOSYS_HOME: central,
      GNOSYS_PERSONAL: personal,
      GNOSYS_GLOBAL: global,
      GNOSYS_LOCAL_ONLY: "1",
      HOME: home,
      USERPROFILE: home,
    },
    stderr: "pipe",
  });
  client = new Client({ name: "projectroot-visibility-test", version: "0.0.0" });
  await client.connect(transport);

  await call("gnosys_init", { directory: p1 });
  await call("gnosys_init", { directory: p2 });

  const seed = (title: string, extra: Record<string, unknown>) =>
    call("gnosys_add_structured", {
      title,
      category: "concepts",
      tags: { domain: ["qa"] },
      relevance: `${KEYWORD} visibility`,
      content: `${KEYWORD} seeded for projectRoot visibility.`,
      ...extra,
    });
  await seed(TITLES.p1, { projectRoot: p1 });
  // p2 is the strongest BM25 match, so a leak ranks it first rather than
  // letting recall's low-score cutoff hide it.
  await seed(TITLES.p2, {
    projectRoot: p2,
    content: `${KEYWORD} `.repeat(30),
    relevance: `${KEYWORD} `.repeat(10),
  });
  await seed(TITLES.user, { projectRoot: p1, store: "personal" });
  await seed(TITLES.global, { projectRoot: p1, store: "global" });
}, 120_000);

afterAll(async () => {
  try {
    await client?.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(base, { recursive: true, force: true });
});

describe("projectRoot-scoped reads", () => {
  it("gnosys_search returns p1 + user + global, not p2", async () => {
    const text = await call("gnosys_search", { query: KEYWORD, projectRoot: p1 });
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it("gnosys_discover returns p1 + user + global, not p2", async () => {
    const text = await call("gnosys_discover", { query: KEYWORD, projectRoot: p1 });
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it("gnosys_recall returns p1 + user + global, not p2", async () => {
    const text = await call("gnosys_recall", { query: KEYWORD, projectRoot: p1, aggressive: true });
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it("wildcard gnosys_recall applies the same filter", async () => {
    const text = await call("gnosys_recall", { query: "*", projectRoot: p2, aggressive: true });
    expect(owners(text)).toEqual(["global", "p2", "user"]);
  });

  it("gnosys_search without projectRoot keeps the whole-brain view", async () => {
    const text = await call("gnosys_search", { query: KEYWORD });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });

  it("an unregistered projectRoot keeps the whole-brain view", async () => {
    const unregistered = path.join(base, "not-initialized");
    fs.mkdirSync(unregistered, { recursive: true });
    const text = await call("gnosys_search", { query: KEYWORD, projectRoot: unregistered });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });

  it("gnosys_federated_search with projectRoot stays cross-project", async () => {
    const text = await call("gnosys_federated_search", { query: KEYWORD, projectRoot: p1 });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });
});
