/**
 * projectRoot visibility for the retrieval tools PR #50 did not cover:
 * gnosys_hybrid_search, gnosys_semantic_search and gnosys_ask ran keyword and
 * semantic search over the whole brain, so projectRoot=p1 surfaced p2's
 * project-scoped memories. A read scoped to a registered projectRoot sees that
 * project plus the shared user and global tiers. Calls without projectRoot keep
 * the whole-brain view.
 *
 * Also covers the "superseded by" label: a p1 memory superseded by a p2 memory
 * must not show p2's memory ID inside a p1-scoped read.
 *
 * Drives the real MCP server (dist/index.js) over stdio against an isolated
 * GNOSYS_HOME. Only the embedding model and the LLM are replaced; SQLite,
 * cosine ranking, RRF fusion and the tool handlers stay real.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const KEYWORD = "quokkabridge";
const SUPERSEDE_KEYWORD = "wombatledger";

const TITLES = {
  p1: "Quokkabridge note owned by project one",
  p2: "Quokkabridge note owned by project two",
  user: "Quokkabridge personal note",
  global: "Quokkabridge global note",
};
const OLD_TITLE = "Wombatledger policy in project one";
const REPLACEMENT_TITLE = "Wombatledger replacement in project two";

/**
 * Embedding table: the bare query and p2's memory share a vector, so p2 is the
 * strongest semantic match and a leak cannot hide under the limit.
 */
const EMBED_STUB = `(text) => {
  if (text === ${JSON.stringify(KEYWORD)} || text.includes(${JSON.stringify(TITLES.p2)})) return new Float32Array([1, 0, 0]);
  if (text.includes(${JSON.stringify(KEYWORD)})) return new Float32Array([0.6, 0.8, 0]);
  if (text.includes(${JSON.stringify(SUPERSEDE_KEYWORD)})) return new Float32Array([0, 0, 1]);
  return new Float32Array([0, 1, 0]);
}`;

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

/** The text block that renders one result, from its bold title to the next blank line. */
function block(text: string, title: string): string {
  const start = text.indexOf(`**${title}**`);
  expect(start, `${title} missing from:\n${text}`).toBeGreaterThanOrEqual(0);
  return text.slice(start).split("\n\n")[0];
}

let base: string;
let p1: string;
let p2: string;
let replacementId: string;
let client: Client;

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name, arguments: args });
  const text = toolText(res);
  expect(res.isError, `${name} failed: ${text}`).not.toBe(true);
  return text;
}

function addedId(text: string): string {
  const id = /^ID: (\S+)$/m.exec(text)?.[1];
  expect(id, text).toBeDefined();
  return id as string;
}

beforeAll(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-projectroot-hybrid-"));
  const central = path.join(base, "central");
  const home = path.join(base, "home");
  const personal = path.join(base, "personal");
  const global = path.join(base, "global");
  p1 = path.join(base, "p1");
  p2 = path.join(base, "p2");
  for (const d of [central, home, personal, global, p1, p2]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(central, "gnosys.json"), JSON.stringify({ llm: { defaultProvider: "ollama" } }));

  const dist = (file: string) => JSON.stringify(pathToFileURL(path.resolve("dist", file)).href);
  const bootstrap = path.join(base, "server.mjs");
  fs.writeFileSync(bootstrap, [
    `import { GnosysEmbeddings } from ${dist("lib/embeddings.js")};`,
    `import { createProvider } from ${dist("lib/llm.js")};`,
    `import { DEFAULT_CONFIG } from ${dist("lib/config.js")};`,
    `const vector = ${EMBED_STUB};`,
    "GnosysEmbeddings.prototype.embed = async (text) => vector(text);",
    "GnosysEmbeddings.prototype.embedBatch = async (texts) => texts.map(vector);",
    // The answer echoes the prompt, so the test sees exactly which memories reached the LLM.
    `Object.getPrototypeOf(createProvider("ollama", "stub", DEFAULT_CONFIG)).generate = async (_question, options) => options.system;`,
    `const { startMcpServer } = await import(${dist("index.js")});`,
    "await startMcpServer();",
  ].join("\n"));

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bootstrap],
    cwd: central,
    env: {
      PATH: process.env.PATH ?? "",
      GNOSYS_HOME: central,
      GNOSYS_PERSONAL: personal,
      GNOSYS_GLOBAL: global,
      GNOSYS_LOCAL_ONLY: "1",
      GNOSYS_MCP_TOOLSET: "full",
      HOME: home,
      USERPROFILE: home,
      NODE_ENV: "test",
    },
    stderr: "pipe",
  });
  client = new Client({ name: "projectroot-hybrid-visibility-test", version: "0.0.0" });
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
  // p2 is also the strongest BM25 match, so the keyword leg ranks it first too.
  await seed(TITLES.p2, {
    projectRoot: p2,
    content: `${KEYWORD} `.repeat(30),
    relevance: `${KEYWORD} `.repeat(10),
  });
  await seed(TITLES.user, { projectRoot: p1, store: "personal" });
  await seed(TITLES.global, { projectRoot: p1, store: "global" });

  const oldId = addedId(await call("gnosys_add_structured", {
    title: OLD_TITLE,
    category: "decisions",
    tags: { domain: ["qa"] },
    relevance: SUPERSEDE_KEYWORD,
    content: `${SUPERSEDE_KEYWORD} original policy.`,
    projectRoot: p1,
  }));
  replacementId = addedId(await call("gnosys_add_structured", {
    title: REPLACEMENT_TITLE,
    category: "decisions",
    tags: { domain: ["qa"] },
    relevance: SUPERSEDE_KEYWORD,
    content: `${SUPERSEDE_KEYWORD} replacement policy.`,
    supersedes: oldId,
    allowCrossScope: true,
    projectRoot: p2,
  }));

  expect(await call("gnosys_reindex", {})).toContain("central-DB memories embedded");
}, 120_000);

afterAll(async () => {
  try {
    await client?.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(base, { recursive: true, force: true });
});

const SEARCH_TOOLS = ["gnosys_hybrid_search", "gnosys_semantic_search"] as const;

describe("projectRoot-scoped hybrid, semantic and ask", () => {
  it("gnosys_hybrid_search fuses both legs over p1 + user + global, not p2", async () => {
    const text = await call("gnosys_hybrid_search", { query: KEYWORD, projectRoot: p1 });
    expect(text).toContain("embeddings indexed");
    expect(text).toContain("via: keyword+semantic");
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it("gnosys_semantic_search returns p1 + user + global, not p2", async () => {
    const text = await call("gnosys_semantic_search", { query: KEYWORD, projectRoot: p1 });
    expect(text).toContain("semantic results");
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it.each(["keyword", "semantic", "hybrid"])("gnosys_ask in %s mode retrieves p1 + user + global, not p2", async (mode) => {
    const text = await call("gnosys_ask", { question: KEYWORD, mode, projectRoot: p1 });
    expect(text).toContain(`Search mode: ${mode}`);
    expect(owners(text)).toEqual(["global", "p1", "user"]);
  });

  it.each(SEARCH_TOOLS)("%s with limit 1 fills the slot with a visible memory", async (name) => {
    const text = await call(name, { query: KEYWORD, limit: 1, projectRoot: p1 });
    expect(text).toContain("Found 1 ");
    expect(owners(text)).toHaveLength(1);
    expect(["global", "p1", "user"]).toContain(owners(text)[0]);
  });

  it.each(SEARCH_TOOLS)("%s without projectRoot keeps the whole-brain view", async (name) => {
    const text = await call(name, { query: KEYWORD });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });

  it("gnosys_ask without projectRoot keeps the whole-brain view", async () => {
    const text = await call("gnosys_ask", { question: KEYWORD });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });

  it.each([...SEARCH_TOOLS, "gnosys_ask"])("%s rejects an unregistered projectRoot", async (name) => {
    const unregistered = path.join(base, "not-initialized");
    fs.mkdirSync(unregistered, { recursive: true });
    const args = name === "gnosys_ask" ? { question: KEYWORD } : { query: KEYWORD };
    const result = await client.callTool({ name, arguments: { ...args, projectRoot: unregistered } });
    expect(result.isError).toBe(true);
    const text = toolText(result);
    expect(text).toContain(unregistered);
    expect(text).toContain("not an initialised Gnosys project");
    expect(text).toContain("gnosys_init");
  });

  it("gnosys_federated_search with projectRoot stays cross-project", async () => {
    const text = await call("gnosys_federated_search", { query: KEYWORD, projectRoot: p1 });
    expect(owners(text)).toEqual(["global", "p1", "p2", "user"]);
  });
});

describe("superseded-by label across projects", () => {
  const LABEL_TOOLS = ["gnosys_search", "gnosys_discover", ...SEARCH_TOOLS];

  it.each(LABEL_TOOLS)("%s with projectRoot=p1 keeps the superseded status but hides p2's ID", async (name) => {
    const text = await call(name, { query: SUPERSEDE_KEYWORD, projectRoot: p1 });
    const label = block(text, OLD_TITLE);
    expect(label).toContain("[superseded; ");
    expect(label).not.toContain("superseded by");
    expect(text).not.toContain(replacementId);
    expect(text).not.toContain(REPLACEMENT_TITLE);
  });

  it.each(LABEL_TOOLS)("%s without projectRoot names the replacement", async (name) => {
    const text = await call(name, { query: SUPERSEDE_KEYWORD });
    expect(block(text, OLD_TITLE)).toContain(`superseded by ${replacementId}`);
    expect(text).toContain(REPLACEMENT_TITLE);
  });

});
