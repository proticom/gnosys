/**
 * Phase 9a: Sandbox Foundation
 * Test Plan Reference: "Phase 9a — Sandbox Foundation"
 *
 *   TC-9a.1: Sandbox server handles all request methods
 *   TC-9a.2: Sandbox server handles invalid/malformed requests
 *   TC-9a.3: Sandbox client connects and round-trips
 *   TC-9a.4: Helper library generator creates valid file
 *   TC-9a.5: Add + Recall round-trip through sandbox
 *   TC-9a.6: Reinforce boosts confidence
 *   TC-9a.7: Sandbox manager start/stop lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";
import ts from "typescript";
import { stopSandbox } from "../sandbox/manager.js";
import {
  handleRequest,
  getSandboxDir,
  getSocketPath,
  getPidPath,
  type SandboxRequest,
} from "../sandbox/server.js";
import { SandboxClient } from "../sandbox/client.js";
import { generateHelper } from "../sandbox/helper-template.js";
import {
  createTestEnv,
  cleanupTestEnv,
  type TestEnv,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("phase9a");
  vi.stubEnv("GNOSYS_HOME", env.tmpDir);
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(env.tmpDir, "config"));
  vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  vi.stubEnv("GNOSYS_DREAM_ENABLED", "false");
});

afterEach(async () => {
  await cleanupTestEnv(env);
  vi.unstubAllEnvs();
});

// ─── TC-9a.1: Server request handler ──────────────────────────────────────

describe("TC-9a.1: Sandbox server handles all request methods", () => {
  it("ping returns ok with pid", () => {
    const res = handleRequest(env.db, { id: "1", method: "ping", params: {} });
    expect(res.ok).toBe(true);
    expect(res.result).toHaveProperty("status", "ok");
    expect(res.result).toHaveProperty("pid");
  });

  it("add creates a memory and returns id + title", () => {
    const res = handleRequest(env.db, {
      id: "2",
      method: "add",
      params: {
        content: "We use TypeScript strict mode",
        title: "TypeScript convention",
        category: "decisions",
      },
    });
    expect(res.ok).toBe(true);
    const result = res.result as { id: string; title: string };
    expect(result.id).toMatch(/^mem-/);
    expect(result.title).toBe("TypeScript convention");
    expect(env.db.getMemory(result.id)).toMatchObject({
      title: "TypeScript convention", content: "We use TypeScript strict mode", category: "decisions",
    });
  });

  it("add with minimal params auto-generates title", () => {
    const res = handleRequest(env.db, {
      id: "3",
      method: "add",
      params: { content: "Short note about testing" },
    });
    expect(res.ok).toBe(true);
    const result = res.result as { id: string; title: string };
    expect(result.title).toBe("Short note about testing");
  });

  it("add without content returns error", () => {
    const res = handleRequest(env.db, {
      id: "4",
      method: "add",
      params: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("content is required");
  });

  it("recall returns results for matching query", () => {
    // Add some memories first
    handleRequest(env.db, {
      id: "5a",
      method: "add",
      params: { content: "We use PostgreSQL for production databases", category: "decisions" },
    });
    handleRequest(env.db, {
      id: "5b",
      method: "add",
      params: { content: "Redis is used for caching layer", category: "architecture" },
    });

    const res = handleRequest(env.db, {
      id: "5c",
      method: "recall",
      params: { query: "database" },
    });
    expect(res.ok).toBe(true);
    expect(res.result).toEqual([expect.objectContaining({
      title: "We use PostgreSQL for production databases",
      content: "We use PostgreSQL for production databases", category: "decisions",
    })]);
  });

  it("recall without query returns error", () => {
    const res = handleRequest(env.db, {
      id: "6",
      method: "recall",
      params: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("query is required");
  });

  it("get retrieves a specific memory", () => {
    const addRes = handleRequest(env.db, {
      id: "7a",
      method: "add",
      params: { content: "Test memory for get", title: "Get test" },
    });
    const memId = (addRes.result as { id: string }).id;

    const getRes = handleRequest(env.db, {
      id: "7b",
      method: "get",
      params: { id: memId },
    });
    expect(getRes.ok).toBe(true);
    expect(getRes.result).toHaveProperty("content", "Test memory for get");
  });

  it("get with invalid id returns error", () => {
    const res = handleRequest(env.db, {
      id: "8",
      method: "get",
      params: { id: "nonexistent-id" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("list returns memories", () => {
    handleRequest(env.db, {
      id: "9a",
      method: "add",
      params: { content: "Memory one", category: "decisions" },
    });
    handleRequest(env.db, {
      id: "9b",
      method: "add",
      params: { content: "Memory two", category: "architecture" },
    });

    const res = handleRequest(env.db, {
      id: "9c",
      method: "list",
      params: {},
    });
    expect(res.ok).toBe(true);
    expect(res.result).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Memory one", category: "decisions" }),
      expect.objectContaining({ title: "Memory two", category: "architecture" }),
    ]));
    expect(res.result).toHaveLength(2);
  });

  it("list filters by category", () => {
    handleRequest(env.db, {
      id: "10a",
      method: "add",
      params: { content: "Decision memory", category: "decisions" },
    });
    handleRequest(env.db, {
      id: "10b",
      method: "add",
      params: { content: "Architecture memory", category: "architecture" },
    });

    const res = handleRequest(env.db, {
      id: "10c",
      method: "list",
      params: { category: "decisions" },
    });
    expect(res.ok).toBe(true);
    expect(res.result).toEqual([expect.objectContaining({ title: "Decision memory", category: "decisions" })]);
  });

  it("stats returns database statistics", () => {
    handleRequest(env.db, {
      id: "11a",
      method: "add",
      params: { content: "Stats test memory" },
    });

    const res = handleRequest(env.db, {
      id: "11b",
      method: "stats",
      params: {},
    });
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({ active: 1, archived: 0, total: 1, categories: ["decisions"], projects: 0 });
  });
});

// ─── TC-9a.2: Invalid/malformed requests ────────────────────────────────

describe("TC-9a.2: Sandbox server handles invalid requests", () => {
  it("unknown method returns error", () => {
    const res = handleRequest(env.db, {
      id: "20",
      method: "nonexistent",
      params: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unknown method");
  });

  it("response id matches request id", () => {
    const res = handleRequest(env.db, {
      id: "unique-test-id-42",
      method: "ping",
      params: {},
    });
    expect(res.id).toBe("unique-test-id-42");
  });
});

// ─── TC-9a.3: Client connection round-trip ──────────────────────────────

describe("TC-9a.3: Sandbox client round-trip via socket", () => {
  let server: net.Server;
  let socketPath: string;

  beforeEach(async () => {
    // Start a test server on a unique socket
    socketPath = path.join(env.tmpDir, "test.sock");

    server = net.createServer((socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const req = JSON.parse(line) as SandboxRequest;
            const res = handleRequest(env.db, req);
            socket.write(JSON.stringify(res) + "\n");
          } catch (err) {
            socket.write(JSON.stringify({
              id: "error",
              ok: false,
              error: `Invalid: ${err instanceof Error ? err.message : String(err)}`,
            }) + "\n");
          }
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  });

  it("client can ping the server", async () => {
    const client = new SandboxClient(socketPath);
    const result = await client.ping();
    expect(result.status).toBe("ok");
    expect(typeof result.pid).toBe("number");
  });

  it("client can add and get a memory", async () => {
    const client = new SandboxClient(socketPath);
    const added = await client.add({
      content: "Client round-trip test memory",
      title: "Client test",
      category: "decisions",
    });
    expect(added.id).toMatch(/^mem-/);
    expect(added.title).toBe("Client test");

    const mem = await client.get(added.id);
    expect(mem).toHaveProperty("content", "Client round-trip test memory");
  });

  it("client can list memories", async () => {
    const client = new SandboxClient(socketPath);
    await client.add({ content: "List test one" });
    await client.add({ content: "List test two" });

    const list = await client.list();
    expect(list.map((memory) => memory.title).sort()).toEqual(["List test one", "List test two"]);
  });

  it("client can get stats", async () => {
    const client = new SandboxClient(socketPath);
    await client.add({ content: "Stats test" });

    const stats = await client.stats();
    expect(stats).toEqual({ active: 1, archived: 0, total: 1, categories: ["decisions"], projects: 0 });
  });

  it("client isRunning returns true for running server", async () => {
    const client = new SandboxClient(socketPath);
    expect(await client.isRunning()).toBe(true);
  });

  it("client isRunning returns false for bad socket", async () => {
    const client = new SandboxClient("/tmp/nonexistent-gnosys-test.sock");
    expect(await client.isRunning()).toBe(false);
  });
});

// ─── TC-9a.4: Helper library generator ──────────────────────────────────

describe("TC-9a.4: Generated helper through the real background server", () => {
  it("auto-starts the server and persists scoped add, recall, list, stats and reinforcement", async () => {
    const projectId = "123e4567-e89b-42d3-a456-426614174000";
    fs.mkdirSync(path.join(env.tmpDir, ".gnosys"));
    fs.writeFileSync(path.join(env.tmpDir, ".gnosys", "gnosys.json"), JSON.stringify({
      projectId, projectName: "Generated helper fixture", workingDirectory: env.tmpDir, schemaVersion: 1,
    }));
    const helperPath = await generateHelper(env.tmpDir);
    const modulePath = path.join(env.tmpDir, "helper.mjs");
    fs.writeFileSync(modulePath, ts.transpileModule(fs.readFileSync(helperPath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const binDir = path.join(env.tmpDir, "bin");
    fs.mkdirSync(binDir);
    const marker = path.join(env.tmpDir, "launcher.txt");
    const cliPath = path.resolve("dist/cli.js");
    fs.writeFileSync(path.join(binDir, "npx"), `#!${process.execPath}
require("fs").writeFileSync(${JSON.stringify(marker)}, "started locally");
require("child_process").execFileSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(cliPath)}, "sandbox", "start"], { stdio: "inherit" });
`, { mode: 0o755 });
    const scriptPath = path.join(env.tmpDir, "exercise.mjs");
    fs.writeFileSync(scriptPath, `import { gnosys } from "./helper.mjs";
const added = await gnosys.add("generated quartz body", { title: "Generated memory" });
const recalled = await gnosys.recall("quartz");
const listed = await gnosys.list();
const stats = await gnosys.stats();
const reinforced = await gnosys.reinforce(added.id);
console.log(JSON.stringify({
  addedTitle: added.title,
  recalled: recalled.map(({ title, content }) => ({ title, content })),
  titles: listed.map(memory => memory.title), stats,
  reinforcement: { count: reinforced.reinforcement_count, confidence: reinforced.confidence }
}));
`);
    try {
      const { stdout } = await promisify(execFile)(process.execPath, [scriptPath], {
        cwd: env.tmpDir,
        env: { ...process.env, PATH: binDir + path.delimiter + process.env.PATH },
        timeout: 20_000,
      });
      expect(fs.readFileSync(marker, "utf8")).toBe("started locally");
      expect(JSON.parse(stdout)).toEqual({
        addedTitle: "Generated memory",
        recalled: [{ title: "Generated memory", content: "generated quartz body" }],
        titles: ["Generated memory"],
        stats: { active: 1, archived: 0, total: 1, categories: ["decisions"], projects: 0 },
        reinforcement: { count: 1, confidence: 0.9500000000000001 },
      });
      expect(env.db.getAllMemories()).toEqual([expect.objectContaining({
        title: "Generated memory", content: "generated quartz body",
        project_id: "123e4567-e89b-42d3-a456-426614174000", scope: "project", reinforcement_count: 1,
      })]);
    } finally {
      await stopSandbox();
    }
    expect(fs.existsSync(getSocketPath())).toBe(false);
    expect(fs.existsSync(getPidPath())).toBe(false);
  }, 30_000);
});

// ─── TC-9a.5: Add + Recall round-trip ───────────────────────────────────

describe("TC-9a.5: Add + Recall round-trip through sandbox", () => {
  let server: net.Server;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = path.join(env.tmpDir, "roundtrip.sock");
    server = net.createServer((socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const req = JSON.parse(line) as SandboxRequest;
            const res = handleRequest(env.db, req);
            socket.write(JSON.stringify(res) + "\n");
          } catch { /* skip */ }
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  });

  it("added memory can be recalled by content query", async () => {
    const client = new SandboxClient(socketPath);

    await client.add({
      content: "We decided to use PostgreSQL for all new services",
      title: "Database choice",
      category: "decisions",
    });

    const results = await client.recall("PostgreSQL");
    expect(results.length).toBeGreaterThanOrEqual(1);
    // The recall should find our memory
    const found = results.find((r) => r.title === "Database choice");
    expect(found).toBeDefined();
  });

  it("multiple adds and recall with limit", async () => {
    const client = new SandboxClient(socketPath);

    // Add 5 memories
    for (let i = 0; i < 5; i++) {
      await client.add({
        content: `Memory number ${i} about testing patterns and approaches`,
        category: "decisions",
      });
    }

    const results = await client.recall("testing patterns", { limit: 3 });
    expect(results).toHaveLength(3);
    expect(results.map((memory) => memory.content).sort()).toEqual([
      "Memory number 0 about testing patterns and approaches",
      "Memory number 1 about testing patterns and approaches",
      "Memory number 2 about testing patterns and approaches",
    ]);
  });

  it("add with project_id scopes the memory", async () => {
    const client = new SandboxClient(socketPath);

    await client.add({
      content: "Project-scoped memory for recall test",
      project_id: "proj-123",
      scope: "project",
    });

    const list = await client.list({ project_id: "proj-123" });
    expect(list.length).toBe(1);
    expect(list[0].project_id).toBe("proj-123");
  });
});

// ─── TC-9a.6: Reinforce boosts confidence ───────────────────────────────

describe("TC-9a.6: Reinforce boosts confidence", () => {
  it("reinforce increments count and confidence", () => {
    // Add a memory
    const addRes = handleRequest(env.db, {
      id: "r1",
      method: "add",
      params: { content: "Important pattern to reinforce", confidence: 0.8 },
    });
    const memId = (addRes.result as { id: string }).id;

    // Reinforce it
    const res = handleRequest(env.db, {
      id: "r2",
      method: "reinforce",
      params: { id: memId },
    });
    expect(res.ok).toBe(true);
    const result = res.result as { id: string; reinforcement_count: number; confidence: number };
    expect(result.reinforcement_count).toBe(1);
    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it("reinforce by query finds and boosts the memory", () => {
    handleRequest(env.db, {
      id: "r3",
      method: "add",
      params: { content: "Unique findable reinforce target", confidence: 0.7 },
    });

    const res = handleRequest(env.db, {
      id: "r4",
      method: "reinforce",
      params: { query: "findable reinforce target" },
    });
    expect(res.ok).toBe(true);
    const result = res.result as { reinforcement_count: number; confidence: number };
    expect(result.reinforcement_count).toBe(1);
    expect(result.confidence).toBeCloseTo(0.75, 2);
  });

  it("reinforce caps confidence at 1.0", () => {
    const addRes = handleRequest(env.db, {
      id: "r5",
      method: "add",
      params: { content: "High confidence memory", confidence: 0.98 },
    });
    const memId = (addRes.result as { id: string }).id;

    // Reinforce twice
    handleRequest(env.db, { id: "r6", method: "reinforce", params: { id: memId } });
    const res = handleRequest(env.db, { id: "r7", method: "reinforce", params: { id: memId } });
    const result = res.result as { confidence: number };
    expect(result.confidence).toBe(1);
    expect(env.db.getMemory(memId)).toMatchObject({ confidence: 1, reinforcement_count: 2 });
  });
});

// ─── TC-9a.7: Sandbox paths and utilities ───────────────────────────────

describe("TC-9a.7: Sandbox path utilities", () => {
  it("getSandboxDir creates the selected home sandbox directory", () => {
    const directory = getSandboxDir();
    expect(directory).toBe(path.join(env.tmpDir, "sandbox"));
    expect(fs.statSync(directory).isDirectory()).toBe(true);
  });

  it("getSocketPath returns the socket in the selected home", () => {
    expect(getSocketPath()).toBe(process.platform === "win32"
      ? "\\\\.\\pipe\\gnosys-sandbox"
      : path.join(env.tmpDir, "sandbox", "gnosys.sock"));
  });

  it("getPidPath returns the pid file in the selected home", () => {
    expect(getPidPath()).toBe(path.join(env.tmpDir, "sandbox", "gnosys.pid"));
  });
});
