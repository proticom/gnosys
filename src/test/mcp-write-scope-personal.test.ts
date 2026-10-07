/**
 * QA 2026-10-06 bug 1: gnosys_add_structured with store:"personal" failed with
 * `CHECK constraint failed: scope IN ('project','user','global')` because the
 * MCP store layer name leaked into the memories.scope column. The personal
 * store layer must persist as scope "user".
 *
 * Drives the real MCP server (dist/index.js) over stdio against an isolated
 * GNOSYS_HOME, then reads the row back from the central DB.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GnosysDB } from "../lib/db.js";

const MCP_ENTRY = path.resolve("dist/index.js");

function toolText(result: unknown): string {
  const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content;
  return blocks?.map((b) => b.text ?? "").join("\n") ?? "";
}

let base: string;
let centralDir: string;
let personalDir: string;
let projectDir: string;
let client: Client;

beforeEach(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-personal-scope-"));
  centralDir = path.join(base, "central");
  personalDir = path.join(base, "personal");
  projectDir = path.join(base, "project");
  const home = path.join(base, "home");
  for (const d of [centralDir, personalDir, projectDir, home]) fs.mkdirSync(d, { recursive: true });

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_ENTRY],
    cwd: centralDir,
    env: {
      ...process.env,
      GNOSYS_HOME: centralDir,
      GNOSYS_PERSONAL: personalDir,
      GNOSYS_LOCAL_ONLY: "1",
      GNOSYS_MCP_TOOLSET: "full",
      HOME: home,
      USERPROFILE: home,
    },
    stderr: "pipe",
  });
  client = new Client({ name: "personal-scope-test", version: "0.0.0" });
  await client.connect(transport);
});

afterEach(async () => {
  try {
    await client?.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(base, { recursive: true, force: true });
});

describe("gnosys_add_structured store:'personal'", () => {
  it("persists the memory with scope 'user' and no project id", async () => {
    const res = await client.callTool({
      name: "gnosys_add_structured",
      arguments: {
        title: "Personal scope regression note",
        category: "decisions",
        tags: { domain: ["qa"] },
        relevance: "personal scope regression",
        content: "Written through the personal store layer.",
        store: "personal",
        projectRoot: projectDir,
      },
    });
    expect(toolText(res)).not.toContain("CHECK constraint failed");
    expect(res.isError).not.toBe(true);

    const listed = await client.callTool({
      name: "gnosys_list",
      arguments: { store: "personal", projectRoot: projectDir },
    });
    expect(listed.isError).not.toBe(true);
    expect(toolText(listed)).toContain("[user] **Personal scope regression note**");

    const db = new GnosysDB(centralDir);
    try {
      const rows = db.getMemoriesByScope("user").filter(
        (m) => m.title === "Personal scope regression note",
      );
      expect(rows.map((m) => ({ scope: m.scope, project_id: m.project_id }))).toEqual([
        { scope: "user", project_id: null },
      ]);
    } finally {
      db.close();
    }
  }, 60_000);
});
