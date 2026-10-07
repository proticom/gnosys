import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";

const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.number().optional(), result: z.unknown().optional() });

describe("v5.9.2 regression: gnosys serve stdout must stay clean", () => {
  it("initializes with valid JSON-RPC against an older database", async () => {
    const home = mkdtempSync(join(tmpdir(), "gnosys-stdout-"));
    const centralDir = join(home, ".gnosys");
    const db = new GnosysDB(centralDir);
    db.setMeta("app_version", "0.0.1");
    expect(db.getMeta("app_version")).toBe("0.0.1");
    db.close();
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, GNOSYS_HOME: centralDir, GNOSYS_CONFIG_DIR: join(home, "config"), GNOSYS_LOCAL_ONLY: "1" };
    delete env.VITEST;
    delete env.NODE_ENV;
    delete env.CI;
    delete env.GNOSYS_SKIP_UPGRADE_NUDGE;
    const proc = spawn(process.execPath, [resolve("dist/cli.js"), "serve"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", chunk => { stderr += chunk.toString(); });
    try {
      const response = await new Promise<z.infer<typeof envelope>>((resolveResponse, reject) => {
        const timer = setTimeout(() => reject(new Error(`MCP initialization timed out: ${stderr}`)), 8000);
        let buffer = "";
        proc.once("error", error => { clearTimeout(timer); reject(error); });
        proc.once("exit", code => { clearTimeout(timer); reject(new Error(`serve exited ${code}: ${stderr}`)); });
        proc.stdout.on("data", chunk => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          try {
            const messages = lines.filter(Boolean).map(line => envelope.parse(JSON.parse(line)));
            const initialized = messages.find(message => message.id === 1);
            if (initialized) { clearTimeout(timer); resolveResponse(initialized); }
          } catch (error) {
            clearTimeout(timer);
            reject(error);
          }
        });
        proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
          protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "stdout-audit", version: "1.0.0" },
        } }) + "\n");
      });
      expect(response).toMatchObject({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "gnosys" } } });
    } finally {
      if (proc.exitCode === null && proc.signalCode === null) {
        const closed = once(proc, "close");
        proc.kill("SIGKILL");
        await closed;
      }
      rmSync(home, { recursive: true, force: true });
    }
  }, 10000);
});
