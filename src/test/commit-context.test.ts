import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";

const resultSchema = z.object({ isError: z.boolean().optional(), content: z.array(z.object({ type: z.literal("text"), text: z.string() })) });
const requestSchema = z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) });
const candidates = [
  { summary: "Use quartz ledgers", type: "decision", search_terms: ["quartz", "ledgers"] },
  { summary: "Retain cobalt receipts", type: "requirement", search_terms: ["cobalt", "receipts"] },
];
const documents = [
  { title: "Quartz ledgers", category: "decisions", tags: {}, relevance: "quartz ledgers", content: "Store decisions in quartz ledgers.", confidence: 0.9, filename: "quartz-ledgers" },
  { title: "Cobalt receipts", category: "requirements", tags: {}, relevance: "cobalt receipts", content: "Keep cobalt receipts for seven years.", confidence: 0.8, filename: "cobalt-receipts" },
];
let directory: string;
let env: NodeJS.ProcessEnv;
let server: Server;
let client: Client;
let db: GnosysDB;
let malformed: boolean;
let requests: string[];
let projectId: string;
const cli = path.resolve("dist/cli.js");

beforeEach(async () => {
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-context-")));
  env = { PATH: process.env.PATH, HOME: directory, GNOSYS_HOME: path.join(directory, "brain"), GNOSYS_CONFIG_DIR: path.join(directory, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_MCP_TOOLSET: "full", VITEST: "true", CI: "true" };
  requests = [];
  malformed = false;
  server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const parsed = requestSchema.parse(JSON.parse(body));
      const prompt = parsed.messages.filter((message) => message.role === "user").map((message) => message.content).join("\n");
      requests.push(prompt);
      const text = prompt.startsWith("Extract atomic")
        ? malformed ? "not JSON" : JSON.stringify(candidates)
        : JSON.stringify(documents[prompt.includes("quartz") ? 0 : 1]);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: { content: text } }));
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing provider listener");
  execFileSync(process.execPath, [cli, "init"], { cwd: directory, env, stdio: "pipe" });
  const configFile = path.join(directory, ".gnosys/gnosys.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  projectId = config.projectId;
  fs.writeFileSync(configFile, JSON.stringify({ ...config, llm: { defaultProvider: "ollama", ollama: { model: "context-fixture", baseUrl: `http://127.0.0.1:${address.port}` } } }));
  db = new GnosysDB(path.join(directory, "brain"));
  const bootDirectory = path.join(directory, "server-project");
  fs.mkdirSync(bootDirectory);
  execFileSync(process.execPath, [cli, "init"], { cwd: bootDirectory, env, stdio: "pipe" });
  const bootFile = path.join(bootDirectory, ".gnosys/gnosys.json");
  const bootConfig = JSON.parse(fs.readFileSync(bootFile, "utf8"));
  fs.writeFileSync(bootFile, JSON.stringify({ ...bootConfig, llm: { defaultProvider: "ollama", ollama: { model: "context-fixture", baseUrl: `http://127.0.0.1:${address.port}` } } }));
  client = new Client({ name: "context-audit", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/index.js")], cwd: bootDirectory,
    env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)), stderr: "pipe" }));
});

afterEach(async () => {
  await client?.close();
  db?.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

async function commit(dryRun = false, scoped = true) {
  return resultSchema.parse(await client.callTool({ name: "gnosys_commit_context", arguments: { context: "Use quartz ledgers. Retain cobalt receipts.", dry_run: dryRun, ...(scoped ? { projectRoot: directory } : {}) } }));
}
function memories() {
  return db.getAllMemories().map(({ title, content, category, author, authority, scope, project_id }) => ({ title, content, category, author, authority, scope, project_id })).sort((a, b) => a.title.localeCompare(b.title));
}

describe("context sweep public contracts", () => {
  it("MCP saves both novel memories with observed provenance in the requested project", async () => {
    const result = await commit();
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain("Context committed — 2 candidates extracted, 2 added, 0 duplicates skipped:");
    expect(memories()).toEqual([
      { title: "Cobalt receipts", content: "# Cobalt receipts\n\nKeep cobalt receipts for seven years.", category: "requirements", author: "ai", authority: "observed", scope: "project", project_id: projectId },
      { title: "Quartz ledgers", content: "# Quartz ledgers\n\nStore decisions in quartz ledgers.", category: "decisions", author: "ai", authority: "observed", scope: "project", project_id: projectId },
    ]);
  });

  it("MCP dry run describes candidates without structuring or writing memories", async () => {
    const result = await commit(true);
    expect(result.content[0].text).toBe('DRY RUN — 2 candidates extracted, 2 would be added, 0 duplicates skipped:\n\n➕ WOULD ADD: "Use quartz ledgers" [decision]\n\n➕ WOULD ADD: "Retain cobalt receipts" [requirement]');
    expect(memories()).toEqual([]);
    expect(requests).toEqual(["Extract atomic knowledge items from this context:\n\nUse quartz ledgers. Retain cobalt receipts."]);
  });

  it("MCP rejects malformed extraction output without writing memories", async () => {
    malformed = true;
    expect(await commit()).toEqual({ isError: true, content: [{ type: "text", text: "Failed to extract candidates from context. LLM output was not valid JSON." }] });
    expect(memories()).toEqual([]);
  });

  it("D-CTX-002: MCP repeats scoped context without adding duplicate memories", async () => {
    await commit();
    const result = await commit();
    expect(result.content[0].text, JSON.stringify({ text: result.content[0].text, memories: memories() })).toContain("Context committed — 2 candidates extracted, 0 added, 2 duplicates skipped:");
    expect(memories().map((memory) => memory.title)).toEqual(["Cobalt receipts", "Quartz ledgers"]);
  });

  it("MCP skips repeated context in its startup project", async () => {
    await commit(false, false);
    const result = await commit(false, false);
    expect(result.content[0].text).toContain("Context committed — 2 candidates extracted, 0 added, 2 duplicates skipped:");
    expect(memories().map((memory) => memory.title)).toEqual(["Cobalt receipts", "Quartz ledgers"]);
  });

  it("MCP reports an individual storage failure and retains the successful candidate", async () => {
    const storage = new Database(db.getDbPath());
    storage.exec("CREATE TRIGGER deny_receipts BEFORE INSERT ON memories WHEN NEW.title = 'Cobalt receipts' BEGIN SELECT RAISE(ABORT, 'fixture storage rejected receipt'); END");
    storage.close();
    const result = await commit();
    expect(result.content[0].text).toContain('FAILED: "Retain cobalt receipts": fixture storage rejected receipt');
    expect(result.content[0].text).toContain("2 candidates extracted, 1 added, 0 duplicates skipped:");
    expect(memories().map((memory) => memory.title)).toEqual(["Quartz ledgers"]);
  });

  it("D-CTX-001: CLI honors the configured local provider and saves extracted context", async () => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "commit-context", "Use quartz ledgers. Retain cobalt receipts."], { cwd: directory, env });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("COMMITTED: 2 candidates, 2 added, 0 duplicates skipped.");
    expect(memories().map((memory) => memory.title)).toEqual(["Cobalt receipts", "Quartz ledgers"]);
  });
});
