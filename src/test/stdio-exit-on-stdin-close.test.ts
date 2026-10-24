import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { GnosysDB } from "../lib/db.js";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.js");
const DIST_CLI = path.join(PROJECT_ROOT, "dist", "cli.js");
const envelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string().optional(),
  result: z.unknown().optional(),
});

interface RunningServer {
  child: ChildProcessWithoutNullStreams;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  home: string;
  stdout: string;
  stderr: string;
}

function isolatedEnv(home: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GNOSYS_"))),
    HOME: home,
    GNOSYS_HOME: path.join(home, "brain"),
    GNOSYS_CONFIG_DIR: path.join(home, "config"),
    GNOSYS_LOCAL_ONLY: "1",
    GNOSYS_TRANSPORT: "stdio",
    GNOSYS_PERSONAL: "",
    GNOSYS_GLOBAL: "",
    GNOSYS_STORES: "",
    GNOSYS_CACHE_DIR: "",
  };
}

async function within<T>(pending: Promise<T>, milliseconds: number, message: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message())), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("stdio MCP shutdown", () => {
  let running: RunningServer | undefined;

  beforeAll(() => {
    if (!existsSync(DIST_INDEX)) {
      const home = mkdtempSync(path.join(tmpdir(), "gnosys-stdio-build-"));
      try {
        execFileSync("npm", ["run", "build"], {
          cwd: PROJECT_ROOT, stdio: "pipe", env: isolatedEnv(home), timeout: 55_000, killSignal: "SIGKILL",
        });
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    }
  }, 60_000);

  afterEach(async () => {
    if (!running) return;
    try {
      if (running.child.exitCode === null && running.child.signalCode === null) {
        running.child.kill("SIGKILL");
      }
      await running.closed;
    } finally {
      rmSync(running.home, { recursive: true, force: true });
      running = undefined;
    }
  });

  function start(args: string[], options: { project?: boolean; fault?: "hang" | "throw"; heavyInit?: "pending" | "rejected" } = {}): RunningServer {
    const home = mkdtempSync(path.join(tmpdir(), "gnosys-stdio-exit-"));
    const env = isolatedEnv(home);
    try {
      if (options.project) {
        execFileSync(process.execPath, [DIST_CLI, "init"], {
          cwd: home, env, stdio: "pipe", timeout: 10_000, killSignal: "SIGKILL",
        });
        const preload = path.join(home, "offline-embeddings.mjs");
        const moduleUrl = pathToFileURL(path.join(PROJECT_ROOT, "dist/lib/embeddings.js")).href;
        // Keep the persistence regression independent of model downloads.
        writeFileSync(preload, `import { GnosysEmbeddings } from ${JSON.stringify(moduleUrl)};
GnosysEmbeddings.prototype.embed = async () => new Float32Array(384).fill(1);\n`);
        args = ["--import", preload, ...args];
      }
      if (options.fault) {
        const preload = path.join(home, "shutdown-fault.mjs");
        const sdk = pathToFileURL(path.join(PROJECT_ROOT, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js")).href;
        writeFileSync(preload, `import { McpServer } from ${JSON.stringify(sdk)};
McpServer.prototype.close = async () => {
  ${options.fault === "throw" ? 'throw new Error("injected shutdown failure");' : 'await new Promise(() => {});'}
};\n`);
        args = ["--import", preload, ...args];
        env.GNOSYS_SHUTDOWN_TIMEOUT_MS = "300";
      }
      if (options.heavyInit) {
        const preload = path.join(home, "heavy-init.mjs");
        const ingestUrl = pathToFileURL(path.join(PROJECT_ROOT, "dist/lib/ingest.js")).href;
        const source = options.heavyInit === "pending"
          ? 'console.error("injected heavy-init pending"); await new Promise(() => {});'
          : 'throw new Error("injected heavy-init rejection");';
        writeFileSync(preload, `import { registerHooks } from "node:module";
registerHooks({ load(url, context, nextLoad) {
  if (url === ${JSON.stringify(ingestUrl)}) {
    return { format: "module", shortCircuit: true, source: ${JSON.stringify(source)} };
  }
  return nextLoad(url, context);
} });\n`);
        args = ["--import", preload, ...args];
        env.GNOSYS_SHUTDOWN_TIMEOUT_MS = "2000";
      }
    } catch (error) {
      rmSync(home, { recursive: true, force: true });
      throw error;
    }
    const child = spawn(process.execPath, args, {
      cwd: home,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const instance: RunningServer = {
      child,
      closed: new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal }))),
      home,
      stdout: "",
      stderr: "",
    };
    running = instance;
    child.stdout.on("data", chunk => { instance.stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { instance.stderr += chunk.toString(); });
    child.on("error", error => { instance.stderr += error.message; });
    child.stdin.on("error", error => { instance.stderr += error.message; });
    return instance;
  }

  async function initialize(instance: RunningServer): Promise<void> {
    const answeredRoots = new Set<string | number>();
    let check: () => void = () => {};
    let exited: () => void = () => {};
    try {
      const response = new Promise<z.infer<typeof envelope>>((resolve, reject) => {
        check = () => {
          try {
            const lines = instance.stdout.split("\n").slice(0, -1).filter(Boolean);
            const messages = lines.map(line => envelope.parse(JSON.parse(line)));
            for (const message of messages) {
              if (message.method === "roots/list" && message.id !== undefined && !answeredRoots.has(message.id)) {
                answeredRoots.add(message.id);
                instance.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { roots: [] } })}\n`);
              }
            }
            const initialized = messages.find(message => message.id === 1);
            if (initialized) resolve(initialized);
          } catch (error) {
            reject(error);
          }
        };
        exited = () => reject(new Error(`Exited before initialize: ${instance.stderr}`));
        instance.child.stdout.on("data", check);
        instance.child.once("exit", exited);
        instance.child.stdin.write(`${JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "initialize", params: {
            protocolVersion: "2024-11-05", capabilities: {},
            clientInfo: { name: "stdio-exit-test", version: "1.0.0" },
          },
        })}\n`);
      });
      expect(await within(response, 10_000, () => `Initialize timed out: ${instance.stderr}`))
        .toMatchObject({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "gnosys" } } });
      instance.child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    } finally {
      instance.child.stdout.off("data", check);
      instance.child.off("exit", exited);
    }
  }

  async function expectCleanExit(instance: RunningServer, code = 0): Promise<void> {
    try {
      const result = await within(instance.closed, 5000, () => `Did not exit within 5s: ${instance.stderr}`);
      expect(result, instance.stderr).toEqual({ code, signal: null });
      for (const line of instance.stdout.trim().split("\n").filter(Boolean)) {
        expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
      }
    } catch (error) {
      instance.child.kill("SIGKILL");
      throw error;
    }
  }

  for (const { name, args } of [
    { name: "gnosys-mcp", args: [DIST_INDEX] },
    { name: "gnosys serve", args: [DIST_CLI, "serve"] },
    { name: "gnosys serve --with-maintenance", args: [DIST_CLI, "serve", "--with-maintenance"] },
  ]) {
    it(`${name} exits 0 on stdin EOF after initialize`, async () => {
      const instance = start(args);
      await initialize(instance);
      instance.child.stdin.end();
      await expectCleanExit(instance);
    });

    it(`${name} exits 0 on stdin EOF before any message`, async () => {
      const instance = start(args);
      instance.child.stdin.end();
      await expectCleanExit(instance);
      const messages = instance.stdout.trim().split("\n").filter(Boolean)
        .map(line => JSONRPCMessageSchema.parse(JSON.parse(line)));
      expect(messages.filter(message => "result" in message || "error" in message)).toEqual([]);
    });
  }

  for (const { signal, code } of [
    { signal: "SIGINT", code: 130 },
    { signal: "SIGTERM", code: 143 },
  ] satisfies { signal: NodeJS.Signals; code: number }[]) {
    it(`exits ${code} on ${signal}`, async () => {
      const instance = start([DIST_INDEX]);
      await initialize(instance);
      instance.child.kill(signal);
      await expectCleanExit(instance, code);
    });
  }

  it.each([1, 2, 3, 4, 5])("persists a request received with EOF, iteration %i", async () => {
    const instance = start([DIST_INDEX], { project: true });
    await initialize(instance);
    const marker = `request-before-eof-${randomUUID()}`;
    instance.child.stdin.end(`${JSON.stringify({
      jsonrpc: "2.0", id: 95, method: "tools/call", params: {
        name: "gnosys_add_structured", arguments: {
          title: marker, category: "decisions", tags: {}, content: marker, projectRoot: instance.home,
        },
      },
    })}\n`);
    await expectCleanExit(instance);
    const messages = instance.stdout.trim().split("\n").filter(Boolean)
      .map(line => JSONRPCMessageSchema.parse(JSON.parse(line)));
    expect(messages.find(message => "id" in message && message.id === 95)).toMatchObject({
      jsonrpc: "2.0", id: 95, result: { content: [{ type: "text", text: expect.stringContaining(marker) }] },
    });
    const db = new GnosysDB(path.join(instance.home, "brain"));
    try {
      expect(db.getAllMemories().map(memory => memory.title)).toContain(marker);
      if (instance.stderr.includes("Write-time embeddings: enabled")) {
        expect(db.getAllEmbeddings().length).toBe(1);
      }
    } finally {
      db.close();
    }
  });

  it("exits 1 and reports the backstop when cleanup hangs", async () => {
    const instance = start([DIST_INDEX], { fault: "hang" });
    await initialize(instance);
    const started = performance.now();
    instance.child.stdin.end();
    await expectCleanExit(instance, 1);
    expect(instance.stderr).toContain("Gnosys MCP: shutdown backstop fired");
    expect(performance.now() - started).toBeGreaterThanOrEqual(250);
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it("exits 1 when cleanup throws", async () => {
    const instance = start([DIST_INDEX], { fault: "throw" });
    await initialize(instance);
    instance.child.stdin.end();
    await expectCleanExit(instance, 1);
    expect(instance.stderr).toContain("injected shutdown failure");
  });

  for (const heavyInit of ["pending", "rejected"] satisfies ("pending" | "rejected")[]) {
    for (const signal of [null, "SIGTERM"] satisfies (null | NodeJS.Signals)[]) {
      it(`exits on ${signal ?? "EOF"} without waiting for ${heavyInit} heavy init`, async () => {
        const instance = start([DIST_INDEX], { project: true, heavyInit });
        await initialize(instance);
        const marker = heavyInit === "pending" ? "injected heavy-init pending" : "Gnosys MCP: heavy-init failed";
        const check = () => {
          if (instance.stderr.includes(marker)) ready();
        };
        let ready = () => {};
        try {
          await within(new Promise<void>(resolve => {
            ready = resolve;
            instance.child.stderr.on("data", check);
            check();
          }), 5000, () => `Heavy init did not reach ${heavyInit}: ${instance.stderr}`);
        } finally {
          instance.child.stderr.off("data", check);
        }
        const started = performance.now();
        if (signal) instance.child.kill(signal);
        else instance.child.stdin.end();
        await expectCleanExit(instance, signal ? 143 : 0);
        expect(performance.now() - started).toBeLessThan(1000);
        expect(instance.stderr).not.toContain("shutdown backstop fired");
      });
    }
  }
});
