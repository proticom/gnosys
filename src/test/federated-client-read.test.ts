import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GnosysDB } from "../lib/db.js";
import { defaultMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
import { acceptClientSnapshot } from "../lib/syncSnapshot.js";
import { runDiscoverCommand } from "../lib/discoverCommand.js";
import { runSearchCommand } from "../lib/searchCommand.js";
import { runRecallCommand } from "../lib/recallCommand.js";
import { runHybridSearchCommand } from "../lib/hybridSearchCommand.js";
import { runFsearchCommand } from "../lib/fsearchCommand.js";
import { runAskCommand } from "../lib/askCommand.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";
import { makeMemory, makeFrontmatter } from "./_helpers.js";

let root: string;
let project: string;
let output: ReturnType<typeof vi.spyOn>;
const options = () => ({ limit: "10", json: true, federated: true, directory: project });
const resolver = () => GnosysResolver.resolveForProject(project);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-federated-read-"));
  project = path.join(root, "project");
  const home = path.join(root, "home");
  const master = path.join(root, "master");
  fs.mkdirSync(project);
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(root, "config"));
  vi.stubEnv("HOME", root);
  vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  const localDb = new GnosysDB(home);
  localDb.insertMemory(makeMemory({ id: "local-decoy", title: "quartz local decoy", content: "local decoy body", scope: "global" }));
  localDb.setMeta("remote_path", master);
  localDb.close();
  const masterDb = new GnosysDB(master);
  masterDb.insertMemory(makeMemory({ id: "snapshot-memory", title: "quartz snapshot decision", content: "quartz snapshot body: choose the blue ledger", relevance: "quartz", scope: "global" }));
  masterDb.close();
  const snapshots = path.join(master, "snapshots");
  fs.mkdirSync(snapshots);
  const bytes = fs.readFileSync(path.join(master, "gnosys.db"));
  fs.writeFileSync(path.join(snapshots, "snap-1-1.db"), bytes);
  const machine = defaultMachineConfig();
  machine.machineId = "snapshot-client";
  machine.remote = { enabled: true, path: master, role: "client" };
  writeMachineConfig(machine);
  const accepted = acceptClientSnapshot(master, {
    epoch: 1, seq: 1, snapshotFile: "snap-1-1.db", publishedAt: "2026-06-01T00:00:00.000Z",
    checksum: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length,
  });
  if (!accepted.ok) throw new Error(accepted.reason);
  fs.rmSync(master, { recursive: true });
  output = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

const commands = [
  { name: "discover", run: () => runDiscoverCommand("quartz", options()), key: "results" },
  { name: "search", run: () => runSearchCommand("quartz", options()), key: "results" },
  { name: "recall", run: () => runRecallCommand("quartz", options()), key: "memories" },
  { name: "hybrid-search", run: () => runHybridSearchCommand(resolver, "quartz", { ...options(), mode: "keyword" }), key: "results" },
  { name: "fsearch", run: () => runFsearchCommand("quartz", { ...options(), global: true }), key: "results" },
];

describe("federated paths use client read context", () => {
  it.each(commands)("$name reads the accepted snapshot while the master is offline", async ({ run, key }) => {
    await run();
    const parsed = JSON.parse(output.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n"));
    expect(parsed.count).toBe(1);
    expect(parsed[key].map((row: { id: string; title: string }) => ({ id: row.id, title: row.title }))).toEqual([
      { id: "snapshot-memory", title: "quartz snapshot decision" },
    ]);
  });

  it("ask sends accepted snapshot content to the configured provider while offline", async () => {
    const storePath = path.join(project, ".gnosys");
    const store = new GnosysStore(storePath);
    await store.init();
    await store.writeMemory("decisions", "local.md", makeFrontmatter({ id: "local-note", title: "quartz local note" }), "quartz local context");
    fs.writeFileSync(path.join(storePath, "gnosys.json"), JSON.stringify({ llm: { defaultProvider: "ollama", ollama: { model: "audit-model", baseUrl: "http://provider.invalid" } } }));
    const requests: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requests.push({ url, body: String(init.body) });
      return new Response(JSON.stringify({ message: { content: "Choose the blue ledger." } }), { status: 200 });
    });
    await runAskCommand(resolver, "quartz", { ...options(), mode: "keyword", stream: false });
    const request = requests.find((item) => item.url === "http://provider.invalid/api/chat");
    expect(request?.body).toContain("quartz snapshot body: choose the blue ledger");
    expect(JSON.parse(output.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n")).answer).toBe("Choose the blue ledger.");
  });

  it("gnosys_federated_search returns accepted snapshot content over MCP while offline", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("dist/index.js")],
      cwd: project,
      env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      stderr: "pipe",
    });
    const client = new Client({ name: "federated-read-audit", version: "1" });
    try {
      await client.connect(transport);
      const result = await client.callTool({ name: "gnosys_federated_search", arguments: { query: "quartz", projectRoot: project } });
      const content = JSON.stringify(result.content);
      expect(content).toContain("quartz snapshot decision");
      expect(content).toContain("choose the blue ledger");
      expect(content).not.toContain("local decoy");
    } finally {
      await client.close();
    }
  }, 30_000);
});
