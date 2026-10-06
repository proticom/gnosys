import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";
import { makeMemory } from "./_helpers.js";

const OLD_ID = "deci-legacy-00";
const NEW_ID = "deci-correction";
const OLD_TITLE = "Amber cache legacy 00";
const NEW_TITLE = "Cache policy correction";
const ARCHIVED_TITLE = "Amber archived experiment";
const RETRIEVAL_TOOLS = [
  "gnosys_search",
  "gnosys_discover",
  "gnosys_hybrid_search",
  "gnosys_semantic_search",
];

let base: string;
let client: Client;
let childEnv: Record<string, string>;

function toolText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const text = z.array(z.object({ type: z.literal("text"), text: z.string() }))
    .parse(result.content).map((block) => block.text).join("\n");
  expect(result.isError, text).not.toBe(true);
  return text;
}

async function retrieve(name: string, args: Record<string, unknown> = {}): Promise<string> {
  return toolText(await client.callTool({
    name,
    arguments: { query: "amber", limit: 40, projectRoot: base, ...args },
  }));
}

function titles(text: string): string[] {
  return [...text.matchAll(/^\*\*([^\n]+?)\*\*(?: \(|[^\n]*\n {2}(?:ID|Path):)/gm)].map((match) => match[1]);
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "gnosys-superseded-mcp-"));
  const home = join(base, ".gnosys");
  mkdirSync(home);
  const db = new GnosysDB(home);
  for (let i = 0; i < 24; i++) {
    const suffix = String(i).padStart(2, "0");
    db.insertMemory(makeMemory({
      id: `deci-legacy-${suffix}`,
      title: `Amber cache legacy ${suffix}`,
      category: "decisions",
      content: "amber ".repeat(40),
      relevance: "amber ".repeat(40),
      status: "superseded",
      superseded_by: NEW_ID,
      created: "2024-01-02T12:00:00.000Z",
      modified: "2024-02-03T12:00:00.000Z",
      embedding: Buffer.from(new Float32Array([1, 0]).buffer),
    }));
  }
  db.insertMemory(makeMemory({
    id: NEW_ID,
    title: NEW_TITLE,
    category: "decisions",
    content: "Use bounded cache retention for amber requests.",
    relevance: "amber caching correction retention",
    supersedes: OLD_ID,
    created: "2026-10-05T12:00:00.000Z",
    modified: "2026-10-06T12:00:00.000Z",
    embedding: Buffer.from(new Float32Array([0.8, 0.2]).buffer),
  }));
  db.insertMemory(makeMemory({
    id: "deci-archived",
    title: ARCHIVED_TITLE,
    category: "decisions",
    content: "amber experiment",
    relevance: "amber experiment",
    status: "archived",
    modified: "2023-04-05T12:00:00.000Z",
    embedding: Buffer.from(new Float32Array([0.9, 0.1]).buffer),
  }));
  for (const id of ["deci-write-old", "deci-update-old", "deci-update-new"]) {
    db.insertMemory(makeMemory({ id, title: id, modified: "2022-01-02T12:00:00.000Z" }));
  }
  db.close();

  // Replace only the model boundary. SQLite, cosine ranking, RRF and MCP remain real.
  const bootstrap = join(base, "server.mjs");
  writeFileSync(bootstrap, [
    `import { GnosysEmbeddings } from ${JSON.stringify(pathToFileURL(resolve("dist/lib/embeddings.js")).href)};`,
    "GnosysEmbeddings.prototype.embed = async () => new Float32Array([1, 0]);",
    `const { startMcpServer } = await import(${JSON.stringify(pathToFileURL(resolve("dist/index.js")).href)});`,
    "await startMcpServer();",
  ].join("\n"));
  childEnv = {
    PATH: process.env.PATH ?? "",
    HOME: base,
    USERPROFILE: base,
    GNOSYS_HOME: home,
    GNOSYS_PERSONAL: home,
    GNOSYS_LOCAL_ONLY: "1",
    GNOSYS_MCP_TOOLSET: "full",
    GNOSYS_GLOBAL: home,
    NODE_ENV: "test",
  };
  client = new Client({ name: "superseded-regression", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bootstrap],
    cwd: base,
    env: childEnv,
    stderr: "pipe",
  });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close();
  if (base) rmSync(base, { recursive: true, force: true });
});

describe.each(RETRIEVAL_TOOLS)("%s superseded history", (name) => {
  it("ranks the correction before its predecessors and labels dates and status", async () => {
    const output = await retrieve(name);
    const resultTitles = titles(output);
    expect(resultTitles).toContain(OLD_TITLE);
    expect(resultTitles).toContain(NEW_TITLE);
    expect(resultTitles.indexOf(NEW_TITLE)).toBeLessThan(resultTitles.indexOf(OLD_TITLE));
    const oldBlock = output.slice(output.indexOf(`**${OLD_TITLE}**`)).split("\n\n")[0];
    expect(oldBlock).toContain("superseded by deci-correction");
    expect(oldBlock).toContain("2024-02-03");
    const currentBlock = output.slice(output.indexOf(`**${NEW_TITLE}**`)).split("\n\n")[0];
    expect(currentBlock).toContain("active");
    expect(currentBlock).toContain("2026-10-06");
    const archiveBlock = output.slice(output.indexOf(`**${ARCHIVED_TITLE}**`)).split("\n\n")[0];
    expect(resultTitles).toContain(ARCHIVED_TITLE);
    expect(archiveBlock).toContain("archived");
    expect(archiveBlock).toContain("2023-04-05");
  });

  it("keeps the correction in top one despite 24 stronger predecessors", async () => {
    expect(titles(await retrieve(name, { limit: 1 }))).toEqual([NEW_TITLE]);
  });

  it("currentOnly returns only the active correction", async () => {
    expect(titles(await retrieve(name, { currentOnly: true }))).toEqual([NEW_TITLE]);
  });
});

it("read exposes both directions of the supersession link", async () => {
  const old = toolText(await client.callTool({ name: "gnosys_read", arguments: { path: OLD_ID, projectRoot: base } }));
  const current = toolText(await client.callTool({ name: "gnosys_read", arguments: { path: NEW_ID, projectRoot: base } }));
  expect(old).toMatch(/superseded[ _]by[^\n]*deci-correction/i);
  expect(old).toContain("2024-02-03");
  expect(current).toMatch(/supersedes[^\n]*deci-legacy-00/i);
});

it("recall finds the correction beyond its old candidate window and excludes history", async () => {
  const output = await retrieve("gnosys_recall", { limit: 1 });
  expect(output).toContain("[[deci-correction]]");
  expect(output).toContain("Use bounded cache retention for amber requests.");
  expect(output).not.toContain("deci-legacy-");
  expect(output).not.toContain("deci-archived");
});

it("CLI keyword search accepts --current-only and returns the correction", () => {
  const output = execFileSync(process.execPath, [resolve("dist/cli.js"), "search", "amber", "--current-only"], {
    cwd: base,
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(output).toContain(NEW_TITLE);
  expect(output).not.toContain("Amber cache legacy");
  expect(output).not.toContain(ARCHIVED_TITLE);
});

it("add_structured links a valid predecessor without changing its date", async () => {
  const output = toolText(await client.callTool({
    name: "gnosys_add_structured",
    arguments: {
      title: "Structured supersession correction",
      category: "decisions",
      content: "The corrected policy.",
      tags: { domain: ["supersession"] },
      supersedes: "deci-write-old",
      store: "global",
      projectRoot: base,
    },
  }));
  const id = z.string().parse(output.match(/^ID: (\S+)/m)?.[1]);
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.getMemory(id)?.supersedes).toBe("deci-write-old");
    expect(db.getMemory("deci-write-old")).toMatchObject({
      status: "superseded",
      superseded_by: id,
      modified: "2022-01-02T12:00:00.000Z",
    });
  } finally {
    db.close();
  }
});

it("add_structured rejects an unknown predecessor before writing a memory", async () => {
  const result = await client.callTool({
    name: "gnosys_add_structured",
    arguments: {
      title: "Invalidsupersessionmustnotpersist",
      category: "decisions",
      content: "Invalid correction.",
      tags: {},
      supersedes: "deci-missing",
      store: "global",
      projectRoot: base,
    },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("deci-missing");
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.searchFts("Invalidsupersessionmustnotpersist", 40)).toEqual([]);
  } finally {
    db.close();
  }
});

it("updating superseded_by links the replacement back and preserves the old date", async () => {
  const output = toolText(await client.callTool({
    name: "gnosys_update",
    arguments: { path: "deci-update-old", superseded_by: "deci-update-new", projectRoot: base },
  }));
  expect(output).toContain("deci-update-old");
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.getMemory("deci-update-old")).toMatchObject({
      status: "superseded",
      superseded_by: "deci-update-new",
      modified: "2022-01-02T12:00:00.000Z",
    });
    expect(db.getMemory("deci-update-new")?.supersedes).toBe("deci-update-old");
  } finally {
    db.close();
  }
});

it.each(["supersedes", "superseded_by"])("update rejects an unknown %s target", async (field) => {
  const result = await client.callTool({
    name: "gnosys_update",
    arguments: { path: "deci-update-new", [field]: "deci-missing", projectRoot: base },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("deci-missing");
});
