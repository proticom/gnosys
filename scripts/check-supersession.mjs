import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";

// Usage: npm run build && node scripts/check-supersession.mjs [copied-database]
const worktree = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = mkdtempSync(join(tmpdir(), "gnosys-supersession-check-"));
const home = join(base, "home");
const projectRoot = join(base, "project");
mkdirSync(home);
mkdirSync(projectRoot);
const report = { directory: base };

if (process.argv[2]) {
  const censusPath = join(base, "census.db");
  copyFileSync(resolve(process.argv[2]), censusPath);
  const db = new Database(censusPath, { readonly: true });
  const rows = db.prepare("SELECT id, supersedes, superseded_by, status FROM memories ORDER BY id").all();
  const byId = new Map(rows.map(row => [row.id, row]));
  const predecessors = new Map();
  for (const row of rows) {
    if (!row.superseded_by) continue;
    const ids = predecessors.get(row.superseded_by) ?? [];
    ids.push(row.id);
    predecessors.set(row.superseded_by, ids);
  }
  report.census = {
    rows: rows.length,
    fanIn: [...predecessors].filter(([, ids]) => ids.length > 1).map(([id, ids]) => ({
      id, predecessors: ids, supersedes: byId.get(id)?.supersedes ?? null,
    })),
    asymmetric: [...predecessors].filter(([id, ids]) => byId.get(id)?.supersedes !== ids.join(", ")).length,
    nullStatus: rows.filter(row => row.status === null).length,
  };
  db.close();
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(worktree, "dist/index.js")],
  cwd: projectRoot,
  env: {
    PATH: process.env.PATH ?? "",
    HOME: base,
    USERPROFILE: base,
    GNOSYS_HOME: home,
    GNOSYS_CONFIG_DIR: join(home, "config"),
    GNOSYS_PERSONAL: home,
    GNOSYS_GLOBAL: home,
    GNOSYS_CACHE_DIR: join(base, "cache"),
    GNOSYS_LOCAL_ONLY: "1",
    GNOSYS_MCP_TOOLSET: "full",
    NODE_ENV: "test",
  },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", chunk => { stderr += chunk.toString(); });
const client = new Client({ name: "supersession-fanin-check", version: "1" });
async function call(name, args) {
  const result = await client.callTool({ name, arguments: { projectRoot, ...args } });
  const text = result.content.filter(block => block.type === "text").map(block => block.text).join("\n");
  assert.equal(result.isError === true, false, text);
  return text;
}
try {
  await client.connect(transport);
  await call("gnosys_init", { directory: projectRoot, projectName: "supersession-check" });
  const ids = [];
  for (const title of ["Fanin first", "Fanin second", "Fanin replacement"]) {
    const text = await call("gnosys_add_structured", {
      title, category: "decisions", tags: { domain: ["security"], type: ["decision"] },
      relevance: "faninlink", content: `faninlink ${title}`,
    });
    const id = text.match(/ID:\s*([A-Za-z0-9_-]+)/)?.[1];
    assert.equal(typeof id, "string", text);
    ids.push(id);
  }
  const [a, b, replacement] = ids;
  await call("gnosys_update", { path: a, superseded_by: replacement });
  await call("gnosys_update", { path: b, superseded_by: replacement });
  report.reads = await Promise.all(ids.map(path => call("gnosys_read", { path })));
  const db = new Database(join(home, "gnosys.db"), { readonly: true });
  report.rows = ids.map(id => db.prepare(
    "SELECT id, status, supersedes, superseded_by, modified FROM memories WHERE id = ?",
  ).get(id));
  db.close();
  assert.deepEqual(report.rows.map(row => row.status), ["superseded", "superseded", "active"]);
  assert.deepEqual(report.rows.map(row => row.superseded_by), [replacement, replacement, null]);
  const predecessorList = [a, b].sort().join(", ");
  assert.equal(report.rows[2].supersedes, predecessorList);
  assert.equal(report.reads[2].split("\n").find(line => line.startsWith("supersedes:")), `supersedes: ${predecessorList}`);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await client.close();
  writeFileSync(join(base, "stderr.txt"), stderr);
  writeFileSync(join(base, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
