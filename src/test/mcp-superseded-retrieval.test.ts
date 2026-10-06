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
  for (const id of ["deci-write-old", "deci-update-old", "deci-update-new", "fan-a", "fan-b", "fan-next", "completed-old", "completed-next"]) {
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
    expect(currentBlock).toContain("[2026-10-06]");
    expect(currentBlock).toContain("2026-10-06");
    const archiveBlock = output.slice(output.indexOf(`**${ARCHIVED_TITLE}**`)).split("\n\n")[0];
    expect(resultTitles).toContain(ARCHIVED_TITLE);
    expect(archiveBlock).toContain("archived");
    expect(archiveBlock).toContain("2023-04-05");
  });

  it("keeps the correction in top one despite 24 stronger predecessors", async () => {
    expect(titles(await retrieve(name, { limit: 1 }))).toEqual([NEW_TITLE]);
  });

  it("activeOnly returns only the active correction", async () => {
    expect(titles(await retrieve(name, { activeOnly: true }))).toEqual([NEW_TITLE]);
  });
});

it("read exposes both directions of the supersession link", async () => {
  const old = toolText(await client.callTool({ name: "gnosys_read", arguments: { path: OLD_ID, projectRoot: base } }));
  const current = toolText(await client.callTool({ name: "gnosys_read", arguments: { path: NEW_ID, projectRoot: base } }));
  expect(old).toMatch(/superseded[ _]by[^\n]*deci-correction/i);
  expect(old).toContain("2024-02-03");
  expect(current).toContain(`supersedes: ${Array.from({ length: 24 }, (_, i) => `deci-legacy-${String(i).padStart(2, "0")}`).join(", ")}`);
});

it("recall fills its candidate window without superseded rows and retains archived knowledge", async () => {
  const output = await retrieve("gnosys_recall", { limit: 2 });
  expect(output).toContain("[[deci-correction]]");
  expect(output).toContain("Use bounded cache retention for amber requests.");
  expect(output).not.toContain("deci-legacy-");
  expect(output).toContain("[[deci-archived]]");
});

it("CLI keyword search accepts --active-only and returns the correction", () => {
  const output = execFileSync(process.execPath, [resolve("dist/cli.js"), "search", "amber", "--active-only"], {
    cwd: base,
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(output).toContain(NEW_TITLE);
  expect(output).not.toContain("Amber cache legacy");
  expect(output).not.toContain(ARCHIVED_TITLE);
});

it("add_structured rejects a cross-scope predecessor without explicit opt-in", async () => {
  const result = await client.callTool({
    name: "gnosys_add_structured",
    arguments: { title: "Rejectedcrossscope", category: "decisions", tags: {}, content: "Must roll back", supersedes: "deci-write-old", store: "global", projectRoot: base },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("allowCrossScope");
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.searchFts("Rejectedcrossscope", 10)).toEqual([]);
    expect(db.getMemory("deci-write-old")?.status).toBe("active");
  } finally {
    db.close();
  }
});

it("add_structured links a valid predecessor and bumps its modified timestamp", async () => {
  const output = toolText(await client.callTool({
    name: "gnosys_add_structured",
    arguments: {
      title: "Structured supersession correction",
      category: "decisions",
      content: "The corrected policy.",
      tags: { domain: ["supersession"] },
      supersedes: "deci-write-old",
      allowCrossScope: true,
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
    });
    expect(Date.parse(db.getMemory("deci-write-old")?.modified ?? "")).toBeGreaterThan(Date.parse("2022-01-02T12:00:00.000Z"));
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

it("updating superseded_by links the replacement back and bumps its modified timestamp", async () => {
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
    });
    expect(Date.parse(db.getMemory("deci-update-old")?.modified ?? "")).toBeGreaterThan(Date.parse("2022-01-02T12:00:00.000Z"));
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


it("MCP fan-in keeps both predecessors superseded and reads the complete reverse list", async () => {
  for (const id of ["fan-a", "fan-b"]) {
    toolText(await client.callTool({ name: "gnosys_update", arguments: { path: id, superseded_by: "fan-next", projectRoot: base } }));
  }
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.getMemory("fan-a")).toMatchObject({ status: "superseded", superseded_by: "fan-next" });
    expect(db.getMemory("fan-b")).toMatchObject({ status: "superseded", superseded_by: "fan-next" });
    expect(db.getMemory("fan-next")?.supersedes).toBe("fan-a, fan-b");
  } finally {
    db.close();
  }
  const output = toolText(await client.callTool({ name: "gnosys_read", arguments: { path: "fan-next", projectRoot: base } }));
  expect(output).toContain("supersedes: fan-a, fan-b");
});

it("MCP preserves an explicit completed status when linking and unlinking", async () => {
  toolText(await client.callTool({ name: "gnosys_update", arguments: { path: "completed-old", status: "completed", superseded_by: "completed-next", projectRoot: base } }));
  const db = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(db.getMemory("completed-old")).toMatchObject({ status: "completed", superseded_by: "completed-next" });
    toolText(await client.callTool({ name: "gnosys_update", arguments: { path: "completed-old", superseded_by: "", status: "completed", projectRoot: base } }));
    expect(db.getMemory("completed-old")).toMatchObject({ status: "completed", superseded_by: null });
    expect(db.getMemory("completed-next")?.supersedes).toBe(null);
  } finally {
    db.close();
  }
});

it("MCP rejects a cross-scope update unless allowCrossScope is set", async () => {
  const db = new GnosysDB(join(base, ".gnosys"));
  const globalId = z.string().parse(db.getMemory("deci-write-old")?.superseded_by);
  db.close();
  const args = { path: "fan-b", superseded_by: globalId, projectRoot: base };
  const rejected = await client.callTool({ name: "gnosys_update", arguments: args });
  expect(rejected.isError).toBe(true);
  expect(JSON.stringify(rejected.content)).toContain("allowCrossScope");
  toolText(await client.callTool({ name: "gnosys_update", arguments: { ...args, allowCrossScope: true } }));
  const after = new GnosysDB(join(base, ".gnosys"));
  try {
    expect(after.getMemory("fan-b")).toMatchObject({ status: "superseded", superseded_by: globalId });
  } finally {
    after.close();
  }
});
