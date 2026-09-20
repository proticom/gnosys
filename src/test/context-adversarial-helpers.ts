import { createServer, type Server } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";

export const contextText = "Mandate saffron release journals for every production release.";
export const contextTitle = "Saffron release journals";
export const contextBody = "Record every production release in a saffron journal.";
const candidate = { summary: "Keep saffron release journals", type: "decision", search_terms: ["saffron", "release", "journals"] };
export const records = [
  { title: "Verdigris runbooks", content: "Keep verdigris recovery instructions." },
  { title: "Cerulean manifests", content: "Sign cerulean deployment manifests." },
];
export const mapping = { title: "title", content: "content" };
export const cliPath = path.resolve("dist/cli.js");
const identity = z.object({ projectId: z.string() }).passthrough();
const requestBody = z.object({ model: z.string(), messages: z.array(z.object({ role: z.string(), content: z.string() })) });
const resultBody = z.object({ isError: z.boolean().optional(), content: z.array(z.object({ type: z.literal("text"), text: z.string() })) });
export type Project = { root: string; id: string };
export type CommandResult = { code: number | null; stdout: string; stderr: string };
type ProviderRequest = { pathname: string; model: string; prompt: string };

export class ContextHarness {
  readonly directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-adversarial-context-")));
  readonly brain = path.join(this.directory, "brain");
  readonly env = { PATH: process.env.PATH || "", HOME: this.directory, GNOSYS_HOME: this.brain,
    GNOSYS_CONFIG_DIR: path.join(this.directory, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_MCP_TOOLSET: "full",
    GNOSYS_SKIP_UPGRADE_NUDGE: "1", VITEST: "true", CI: "true" };
  readonly requests: ProviderRequest[] = [];
  readonly projects: Project[] = [];
  maximum = 0;
  private active = 0;
  private provider: Server | undefined;
  private clients: Client[] = [];
  private baseUrl = "";

  async start(): Promise<void> {
    this.provider = createServer(async (request, response) => {
      try {
        let body = "";
        for await (const chunk of request) body += String(chunk);
        const parsed = requestBody.parse(JSON.parse(body));
        const prompt = parsed.messages.filter(message => message.role === "user").map(message => message.content).join("\n");
        this.requests.push({ pathname: request.url || "", model: parsed.model, prompt });
        this.maximum = Math.max(this.maximum, ++this.active);
        let text: string;
        if (prompt === `Extract atomic knowledge items from this context:\n\n${contextText}`) {
          text = JSON.stringify([candidate]);
        } else {
          const record = records.find(item => prompt.includes(`Title: ${item.title}\n`));
          const title = record?.title || contextTitle;
          if (!record && !prompt.includes(candidate.summary)) throw new Error(`Unexpected fixture prompt: ${prompt}`);
          text = JSON.stringify({ title, category: "decisions", tags: {}, relevance: record ? title.toLowerCase() : "saffron release journals",
            content: record ? `Structured ${record.content}` : contextBody, confidence: 0.9,
            filename: title.toLowerCase().replaceAll(" ", "-") });
        }
        await new Promise(resolve => setTimeout(resolve, 35));
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      } finally { this.active--; }
    });
    await new Promise<void>((resolve, reject) => {
      this.provider?.once("error", reject);
      this.provider?.listen(0, "127.0.0.1", resolve);
    });
    const address = this.provider.address();
    if (!address || typeof address === "string") throw new Error("Missing provider listener");
    this.baseUrl = `http://127.0.0.1:${address.port}/v1`;
    for (const name of ["project-a", "project-b"]) {
      const root = path.join(this.directory, name);
      fs.mkdirSync(root);
      execFileSync(process.execPath, [cliPath, "init"], { cwd: root, env: this.env, stdio: "pipe" });
      const config = identity.parse(JSON.parse(fs.readFileSync(path.join(root, ".gnosys", "gnosys.json"), "utf8")));
      this.projects.push({ root, id: config.projectId });
      this.configure(root, true);
    }
    fs.writeFileSync(path.join(this.directory, "records.json"), JSON.stringify(records));
  }

  configure(root: string, enabled: boolean): void {
    const file = path.join(root, ".gnosys", "gnosys.json");
    const config = identity.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    fs.writeFileSync(file, JSON.stringify({ ...config, importConcurrency: 2,
      llm: enabled ? { defaultProvider: "custom", custom: { model: "adversarial-custom", baseUrl: this.baseUrl } } : {} }));
  }

  async connect(root = this.projects[0].root): Promise<Client> {
    let stderr = "";
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/index.js")], cwd: root,
      env: this.env, stderr: "pipe" });
    transport.stderr?.on("data", data => { stderr += String(data); });
    const client = new Client({ name: "adversarial-context", version: "1" });
    this.clients.push(client);
    await client.connect(transport);
    const deadline = Date.now() + 10000;
    while (!stderr.includes("Gnosys MCP: heavy modules ready")) {
      if (Date.now() > deadline) throw new Error(`MCP heavy initialization timed out: ${stderr}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return client;
  }

  run(args: string[], root = this.projects[0].root): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath, ...args], { cwd: root, env: this.env });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", chunk => { stdout += String(chunk); });
      child.stderr.on("data", chunk => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("close", code => resolve({ code, stdout, stderr }));
    });
  }

  importArgs(dryRun = true): string[] {
    return ["import", path.join(this.directory, "records.json"), "--format", "json", "--mapping", JSON.stringify(mapping), "--mode", "llm", ...(dryRun ? ["--dry-run"] : [])];
  }

  memories() {
    const db = new GnosysDB(this.brain);
    try {
      return db.getAllMemories().map(({ id, title, content, project_id, scope, authority }) => ({ id, title, content, project_id, scope, authority }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } finally { db.close(); }
  }

  async close(): Promise<void> {
    for (const client of this.clients) await client.close();
    if (this.provider?.listening) await new Promise<void>((resolve, reject) => this.provider?.close(error => error ? reject(error) : resolve()));
    fs.rmSync(this.directory, { recursive: true, force: true });
  }
}

export async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = resultBody.parse(await client.callTool({ name, arguments: args }));
  return { isError: result.isError === true, text: result.content.map(item => item.text).join("\n") };
}
