/**
 * Regression: `gnosys serve` must complete the MCP initialize handshake.
 *
 * `cli.ts` imports index.js but only `gnosys-mcp` (dist/index.js) used to
 * auto-call startMcpServer(); `gnosys serve` exited immediately → Codex/Cursor
 * saw "connection closed: initialize response".
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { GnosysDB } from "../lib/db.js";
import { makeMemory } from "./_helpers.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DIST_CLI = path.join(PROJECT_ROOT, "dist", "cli.js");

describe("gnosys serve MCP handshake", () => {
  let tmpHome: string;

  beforeAll(() => {
    if (!fs.existsSync(DIST_CLI)) {
      execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "pipe" });
    }
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-serve-handshake-"));
    const db = new GnosysDB(path.join(tmpHome, "brain"));
    db.insertMemory(makeMemory({ id: "handshake-memory", title: "Handshake persisted memory", content: "handshake literal body", scope: "global" }));
    db.close();
  }, 60_000);

  afterAll(() => {
    if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("connects via gnosys-mcp bin symlink (npm global layout)", async () => {
    const binLink = path.join(tmpHome, "gnosys-mcp");
    fs.symlinkSync(path.join(PROJECT_ROOT, "dist", "index.js"), binLink);
    fs.chmodSync(binLink, 0o755);

    const transport = new StdioClientTransport({
      command: binLink,
      args: [],
      env: {
        ...process.env,
        HOME: tmpHome,
        GNOSYS_HOME: path.join(tmpHome, "brain"),
        GNOSYS_CONFIG_DIR: path.join(tmpHome, "config"),
        GNOSYS_LOCAL_ONLY: "1",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "gnosys-mcp-bin-test", version: "0.0.0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["gnosys_discover", "gnosys_read", "gnosys_add_structured"]));
    const result = await client.callTool({ name: "gnosys_read", arguments: { path: "handshake-memory", projectRoot: tmpHome } });
    expect(JSON.stringify(result.content)).toContain("handshake literal body");
    await client.close();
  }, 30_000);

  it("connects and lists tools via node dist/cli.js serve", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [DIST_CLI, "serve"],
      env: {
        ...process.env,
        HOME: tmpHome,
        GNOSYS_HOME: path.join(tmpHome, "brain"),
        GNOSYS_CONFIG_DIR: path.join(tmpHome, "config"),
        GNOSYS_LOCAL_ONLY: "1",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "serve-handshake-test", version: "0.0.0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["gnosys_discover", "gnosys_read", "gnosys_add_structured"]));
    const result = await client.callTool({ name: "gnosys_read", arguments: { path: "handshake-memory", projectRoot: tmpHome } });
    expect(JSON.stringify(result.content)).toContain("handshake literal body");
    await client.close();
  }, 30_000);
});
