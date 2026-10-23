import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.js");
const DIST_CLI = path.join(PROJECT_ROOT, "dist", "cli.js");
const envelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]).optional(),
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
    ...process.env,
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

  function start(args: string[]): RunningServer {
    const home = mkdtempSync(path.join(tmpdir(), "gnosys-stdio-exit-"));
    const child = spawn(process.execPath, args, {
      cwd: home,
      env: isolatedEnv(home),
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
    let check: () => void = () => {};
    let exited: () => void = () => {};
    try {
      const response = new Promise<z.infer<typeof envelope>>((resolve, reject) => {
        check = () => {
          try {
            const lines = instance.stdout.split("\n").slice(0, -1).filter(Boolean);
            const messages = lines.map(line => envelope.parse(JSON.parse(line)));
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

  async function expectCleanExit(instance: RunningServer): Promise<void> {
    try {
      const result = await within(instance.closed, 5000, () => `Did not exit within 5s: ${instance.stderr}`);
      expect(result, instance.stderr).toEqual({ code: 0, signal: null });
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

  for (const signal of ["SIGINT", "SIGTERM"] satisfies NodeJS.Signals[]) {
    it(`exits 0 on ${signal}`, async () => {
      const instance = start([DIST_INDEX]);
      await initialize(instance);
      instance.child.kill(signal);
      await expectCleanExit(instance);
    });
  }
});
