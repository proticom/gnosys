import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "http";
import { execFileSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

let directory: string;
let env: NodeJS.ProcessEnv;
let provider: Server;
let client: Client | undefined;
let maximum: number;
let active: number;
let prompts: string[];
const cli = path.resolve("dist/cli.js");
const records = [{ title: "Quartz", content: "Keep quartz ledgers." }, { title: "Cobalt", content: "Retain cobalt receipts." }, { title: "Amber", content: "Archive amber notes." }];
const mapping = { title: "title", content: "content" };

beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-import-concurrency-"));
  env = { PATH: process.env.PATH, HOME: directory, GNOSYS_HOME: path.join(directory, "brain"), GNOSYS_CONFIG_DIR: path.join(directory, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_MCP_TOOLSET: "full", GNOSYS_SKIP_UPGRADE_NUDGE: "1", VITEST: "true", CI: "true" };
  maximum = 0;
  active = 0;
  prompts = [];
  provider = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    const parsed = z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) }).parse(JSON.parse(body));
    const prompt = parsed.messages.filter(message => message.role === "user").map(message => message.content).join("\n");
    prompts.push(prompt);
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 100));
    const title = /Title: (\w+)/.exec(prompt)?.[1] || "Unknown";
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: { content: JSON.stringify({ title, category: "decisions", tags: {}, relevance: title.toLowerCase(), content: `Structured ${title}.`, confidence: 0.9, filename: title.toLowerCase() }) } }));
    active--;
  });
  await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Provider did not bind");
  execFileSync(process.execPath, [cli, "init"], { cwd: directory, env, stdio: "pipe" });
  const file = path.join(directory, ".gnosys", "gnosys.json");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...config, importConcurrency: 2, llm: { defaultProvider: "ollama", ollama: { model: "import-audit", baseUrl: `http://127.0.0.1:${address.port}` } } }));
  fs.writeFileSync(path.join(directory, "records.json"), JSON.stringify(records));
});

afterEach(async () => {
  await client?.close();
  client = undefined;
  await new Promise<void>((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

function assertRequests(expectedMaximum: number): void {
  expect(maximum).toBe(expectedMaximum);
  expect(prompts.sort()).toEqual([
    "Structure this into an atomic memory:\n\nTitle: Amber\nCategory: imported\n\nArchive amber notes.",
    "Structure this into an atomic memory:\n\nTitle: Cobalt\nCategory: imported\n\nRetain cobalt receipts.",
    "Structure this into an atomic memory:\n\nTitle: Quartz\nCategory: imported\n\nKeep quartz ledgers.",
  ]);
}

function runCli(extra: string[] = []): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "import", path.join(directory, "records.json"), "--format", "json", "--mapping", JSON.stringify(mapping), "--mode", "llm", "--dry-run", ...extra], { cwd: directory, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", data => { stdout += String(data); });
    child.stderr.on("data", data => { stderr += String(data); });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

describe("bulk import concurrency through CLI and MCP", () => {
  it.fails("CLI uses configured concurrency for real provider requests", async () => {
    const result = await runCli();
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("  Imported: 3\n  Skipped:  0\n  Failed:   0\n  Total:    3");
    assertRequests(2);
  });

  it("MCP uses configured concurrency and honors the explicit override", async () => {
    let stderr = "";
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/index.js")], cwd: directory,
      env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)), stderr: "pipe" });
    transport.stderr?.on("data", data => { stderr += String(data); });
    client = new Client({ name: "import-audit", version: "1" });
    await client.connect(transport);
    await expect.poll(() => stderr, { timeout: 10000 }).toContain("Gnosys MCP: heavy modules ready");
    for (const concurrency of [undefined, 1]) {
      maximum = 0;
      prompts = [];
      const result = await client.callTool({ name: "gnosys_import", arguments: { format: "json", data: JSON.stringify(records), mapping, mode: "llm", dryRun: true, ...(concurrency === undefined ? {} : { concurrency }) } });
      expect(result.isError).not.toBe(true);
      expect(z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(result.content)[0].text).toContain("  Imported: 3\n  Skipped:  0\n  Failed:   0\n  Total:    3");
      assertRequests(concurrency === undefined ? 2 : 1);
    }
  });

  it.fails("CLI concurrency flag overrides configured concurrency", async () => {
    const result = await runCli(["--concurrency", "1"]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("  Imported: 3\n  Skipped:  0\n  Failed:   0\n  Total:    3");
    assertRequests(1);
  });
});
