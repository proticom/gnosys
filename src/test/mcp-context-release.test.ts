import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { execFileSync } from "child_process";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";
import { defaultMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
import { makeMemory } from "./_helpers.js";

let base: string;
let project: string;
let master: string;
let client: Client;
let transport: StdioClientTransport;
let stderr: string;
let protocolErrors: string[];

function toolText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(result.content).map(item => item.text).join("\n");
}

function ownedDatabasePaths(): string[] {
  const pid = transport.pid;
  if (pid === null) throw new Error("MCP child is not running");
  const names = process.platform === "darwin"
    ? execFileSync("/usr/sbin/lsof", ["-a", "-p", String(pid), "-Fn"], { encoding: "utf-8" }).split("\n").filter(line => line.startsWith("n/")).map(line => line.slice(1))
    : fs.readdirSync(`/proc/${pid}/fd`).flatMap(fd => {
      try { return [fs.readlinkSync(`/proc/${pid}/fd/${fd}`)]; }
      catch { return []; }
    });
  return names.filter(name => name.endsWith(".db") || name.endsWith(".db-wal") || name.endsWith(".db-shm"))
    .map(name => fs.realpathSync(name))
    .filter(name => name.startsWith(fs.realpathSync(master) + path.sep) || name.startsWith(fs.realpathSync(project) + path.sep));
}

beforeEach(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-mcp-release-"));
  const home = path.join(base, "local");
  const boot = path.join(base, "boot");
  project = path.join(base, "project");
  master = path.join(base, "master");
  for (const root of [boot, project]) {
    fs.mkdirSync(path.join(root, ".gnosys", ".config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".gnosys", "gnosys.json"), JSON.stringify({ projectId: path.basename(root), projectName: path.basename(root), dream: { enabled: false } }));
  }
  vi.stubEnv("GNOSYS_HOME", home);
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(base, "config"));
  const localDb = new GnosysDB(home);
  localDb.insertMemory(makeMemory({ id: "local-release", title: "Local target" }));
  localDb.close();
  const masterDb = new GnosysDB(master);
  masterDb.insertMemory(makeMemory({ id: "remote-release", title: "Remote release target", content: "remote release body", scope: "global", created: "2026-01-01", modified: "2026-01-01" }));
  masterDb.close();
  const machine = defaultMachineConfig();
  machine.machineId = "release-machine";
  machine.remote = { enabled: true, path: master, role: "client" };
  writeMachineConfig(machine);
  const preload = path.join(base, "faults.mjs");
  fs.writeFileSync(preload, 'process.on("SIGHUP", () => { void Promise.reject(new Error("audit rejection")); });\nprocess.on("SIGUSR2", () => { setTimeout(() => { throw new Error("audit exception"); }, 0); });\n');
  stderr = "";
  protocolErrors = [];
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  transport = new StdioClientTransport({ command: process.execPath, args: ["--import", pathToFileURL(preload).href, path.resolve("dist/cli.js"), "serve"], cwd: boot,
    env: { ...env, HOME: base, GNOSYS_LOCAL_ONLY: "1", GNOSYS_MCP_TOOLSET: "full", GNOSYS_SKIP_UPGRADE_NUDGE: "1" }, stderr: "pipe" });
  transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
  client = new Client({ name: "release-audit", version: "test" });
  client.onerror = error => { protocolErrors.push(error.message); };
  await client.connect(transport);
});

afterEach(async () => {
  await client?.close();
  vi.unstubAllEnvs();
  fs.rmSync(base, { recursive: true, force: true });
});

describe("MCP central ToolContext release", () => {
  it("closes scoped database resources after an early missing-memory return", async () => {
    const result = await client.callTool({ name: "gnosys_history", arguments: { path: "missing", projectRoot: project } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe("Memory not found: missing");
    expect(ownedDatabasePaths()).toEqual([]);
  });

  it("returns a tool error envelope when a handler throws", async () => {
    const blocked = path.join(base, "file-not-directory");
    fs.writeFileSync(blocked, "occupied");
    const result = await client.callTool({ name: "gnosys_init", arguments: { directory: blocked } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe(`Error in gnosys_init: ENOTDIR: not a directory, mkdir '${blocked}/.gnosys'`);
    expect(protocolErrors).toEqual([]);
  });

  it("closes owned remote handles after default and project-scoped calls", async () => {
    for (const args of [{ path: "remote-release" }, { path: "remote-release", projectRoot: project }]) {
      const result = await client.callTool({ name: "gnosys_history", arguments: args });
      expect(toolText(result)).toBe("Memory found: **Remote release target** (remote-release)\nCreated: 2026-01-01\nModified: 2026-01-01\nNo audit history recorded.");
      expect(ownedDatabasePaths()).toEqual([]);
    }
  });

  it("repeated remote reads return content and release owned resources", async () => {
    for (let call = 0; call < 2; call++) {
      const result = await client.callTool({ name: "gnosys_read", arguments: { path: "remote-release", projectRoot: project } });
      expect(result.isError).not.toBe(true);
      expect(toolText(result)).toContain("title: 'Remote release target'");
      expect(toolText(result)).toContain("\n\nremote release body");
      expect(ownedDatabasePaths()).toEqual([]);
    }
  });

  it("keeps serving after escaped async errors and writes diagnostics only to stderr", async () => {
    const pid = transport.pid;
    if (pid === null) throw new Error("MCP child is not running");
    process.kill(pid, "SIGHUP");
    await expect.poll(() => stderr).toContain("Gnosys MCP: unhandled rejection — Error: audit rejection");
    process.kill(pid, "SIGUSR2");
    await expect.poll(() => stderr).toContain("Gnosys MCP: uncaught exception — Error: audit exception");
    expect((await client.listTools()).tools.map(tool => tool.name)).toContain("gnosys_read");
    expect(protocolErrors).toEqual([]);
  });
});
