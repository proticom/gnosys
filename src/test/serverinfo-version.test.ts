import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.js");
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"),
).version as string;

describe("MCP server info version", () => {
  let tmpHome: string;

  beforeAll(() => {
    if (!fs.existsSync(DIST_INDEX)) {
      execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "pipe" });
    }
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-serverinfo-version-"));
  }, 60_000);

  afterAll(() => {
    if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("reports the package version and gnosys name during initialize", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [DIST_INDEX],
      env: {
        ...process.env,
        HOME: tmpHome,
        GNOSYS_HOME: path.join(tmpHome, "brain"),
        GNOSYS_CONFIG_DIR: path.join(tmpHome, "config"),
        GNOSYS_LOCAL_ONLY: "1",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "serverinfo-version-test", version: "0.0.0" });

    await client.connect(transport);
    expect(client.getServerVersion()?.version).toBe(PACKAGE_VERSION);
    expect(client.getServerVersion()?.name).toBe("gnosys");
    await client.close();
  }, 30_000);
});
