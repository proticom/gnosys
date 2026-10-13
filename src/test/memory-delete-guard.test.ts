/**
 * Memory deletion always needs a human (2026-10-13): "an agent can run
 * everything as long as it doesn't delete memories".
 *
 * Every deletion path ends at GnosysDB.deleteMemory or GnosysDB.restore,
 * which call the guard in src/lib/memoryDeleteGuard.ts. These tests run the
 * real command paths (CLI with closed stdin, the MCP stdio server, the
 * sandbox socket server) against a temp GNOSYS_HOME / GNOSYS_CONFIG_DIR and
 * check the rows that survive. vitest.config.ts sets the human override for
 * the legacy suite, so every case here sets or strips it explicitly.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { exportProject } from "../lib/exportProject.js";
import { setPreference } from "../lib/preferences.js";
import { MemoryDeletionRefusedError } from "../lib/memoryDeleteGuard.js";
import { makeMemory, makeProject } from "./_helpers.js";

const CLI = path.resolve("dist/cli.js");
const OVERRIDE = "GNOSYS_ALLOW_MEMORY_DELETE";
const ALTERNATIVE =
  "Mark it superseded or archived instead (gnosys update <id> --status superseded|archived, or MCP gnosys_update).";

let root: string;
let home: string;
let config: string;

function baseEnv(override: boolean): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== OVERRIDE) env[k] = v;
  Object.assign(env, { GNOSYS_HOME: home, GNOSYS_CONFIG_DIR: config, HOME: path.join(root, "user") });
  if (override) env[OVERRIDE] = "1";
  return env;
}

function runCli(args: string[], opts: { override?: boolean; cwd?: string } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: opts.cwd ?? root,
    env: baseEnv(Boolean(opts.override)),
    input: "",
    encoding: "utf8",
    timeout: 60_000,
  });
}

function withDb<T>(fn: (db: GnosysDB) => T): T {
  const db = new GnosysDB(home);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function memoryIds(): string[] {
  return withDb((db) => db.getAllMemories().map((m) => m.id).sort());
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-delete-guard-"));
  home = path.join(root, "home");
  config = path.join(root, "config");
  for (const dir of [home, config, path.join(root, "user")]) fs.mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("GnosysDB.deleteMemory boundary", () => {
  it("refuses without a terminal or override and leaves the row", () => {
    vi.stubEnv(OVERRIDE, "");
    withDb((db) => db.insertMemory(makeMemory({ id: "boundary-1" })));
    let caught: unknown;
    withDb((db) => {
      try {
        db.deleteMemory("boundary-1");
      } catch (err) {
        caught = err;
      }
    });
    expect(caught).toBeInstanceOf(MemoryDeletionRefusedError);
    expect((caught as MemoryDeletionRefusedError).reason).toBe("no-terminal");
    expect(memoryIds()).toEqual(["boundary-1"]);
  });
});

describe("gnosys pref delete", () => {
  beforeEach(() => {
    withDb((db) => {
      setPreference(db, "keep-me", "stays");
      setPreference(db, "drop-me", "goes");
      db.insertMemory(makeMemory({ id: "plain-1" }));
    });
  });

  it("is refused without a terminal and the preference row stays", () => {
    const res = runCli(["pref", "delete", "drop-me"]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim()).toBe(
      `Error: Refused to delete "drop-me": memory deletion needs a human at an interactive terminal to type the key. ${ALTERNATIVE}`,
    );
    expect(memoryIds()).toEqual(["plain-1", "pref-drop-me", "pref-keep-me"]);
  });

  it("deletes exactly one row when a human sets the override", () => {
    const res = runCli(["pref", "delete", "drop-me"], { override: true });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Preference "drop-me" deleted.');
    expect(memoryIds()).toEqual(["plain-1", "pref-keep-me"]);
  });

  it("ignores the override when it comes from a .env file in the working directory", () => {
    fs.writeFileSync(path.join(root, ".env"), `${OVERRIDE}=1\n`);
    const res = runCli(["pref", "delete", "drop-me"]);
    expect(res.status).toBe(1);
    expect(memoryIds()).toEqual(["plain-1", "pref-drop-me", "pref-keep-me"]);
  });
});

describe("agent surfaces refuse even with the override set", () => {
  beforeEach(() => {
    withDb((db) => setPreference(db, "agent-target", "value"));
  });

  it("MCP gnosys_preference_delete returns an error naming supersede/archive", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("dist/index.js")],
      cwd: root,
      env: baseEnv(true),
      stderr: "pipe",
    });
    const client = new Client({ name: "delete-guard", version: "1" });
    try {
      await client.connect(transport);
      await client.callTool({ name: "gnosys_toolset", arguments: { set: "full" } });
      const result = await client.callTool({ name: "gnosys_preference_delete", arguments: { key: "agent-target" } });
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: `Refused to delete "pref-agent-target": agents can never delete memories. ${ALTERNATIVE}` },
      ]);
    } finally {
      await client.close();
    }
    expect(memoryIds()).toEqual(["pref-agent-target"]);
  }, 60_000);

  it("sandbox pref_delete returns ok:false and the row stays", async () => {
    const server: ChildProcess = spawn(process.execPath, [path.resolve("dist/sandbox/server.js")], {
      cwd: root,
      env: { ...baseEnv(true), GNOSYS_DREAM_ENABLED: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const socketPath = await new Promise<string>((resolve, reject) => {
        let buf = "";
        server.stdout?.on("data", (chunk: Buffer) => {
          buf += chunk.toString();
          const match = buf.match(/socket: (.+)\)/);
          if (match) resolve(match[1]);
        });
        server.on("exit", (code) => reject(new Error(`sandbox exited early (${code})`)));
      });
      const response = await new Promise<{ ok: boolean; error?: string }>((resolve, reject) => {
        const socket = net.createConnection(socketPath, () => {
          socket.write(JSON.stringify({ id: "d1", method: "pref_delete", params: { key: "agent-target" } }) + "\n");
        });
        let buf = "";
        socket.on("data", (chunk) => {
          buf += chunk.toString();
          if (buf.includes("\n")) {
            socket.end();
            resolve(JSON.parse(buf.split("\n")[0]));
          }
        });
        socket.on("error", reject);
      });
      expect(response).toEqual({
        id: "d1",
        ok: false,
        error: `Refused to delete "pref-agent-target": agents can never delete memories. ${ALTERNATIVE}`,
      });
    } finally {
      server.kill("SIGTERM");
    }
    expect(memoryIds()).toEqual(["pref-agent-target"]);
  }, 60_000);
});

describe("gnosys import project --strategy replace", () => {
  let bundle: string;

  beforeEach(() => {
    bundle = path.join(root, "bundle.json.gz");
    withDb((db) => {
      db.insertProject(makeProject({ id: "proj-replace", working_directory: path.join(root, "p") }));
      db.insertMemory(makeMemory({ id: "replace-1", project_id: "proj-replace", title: "Original title" }));
      exportProject(db, { projectId: "proj-replace", outputPath: bundle });
      db.insertMemory(makeMemory({ id: "replace-2", project_id: "proj-replace", title: "Added after export" }));
    });
  });

  it("is refused without a terminal and no memory is deleted", () => {
    const res = runCli(["import", "project", bundle, "--strategy", "replace", "--json"]);
    expect(res.status).toBe(1);
    expect(res.stderr.trim()).toBe(
      `Import failed: Refused to delete "proj-replace": memory deletion needs a human at an interactive terminal to type the key. ${ALTERNATIVE}`,
    );
    expect(memoryIds()).toEqual(["replace-1", "replace-2"]);
  });

  it("replaces the project's memories with the override", () => {
    const res = runCli(["import", "project", bundle, "--strategy", "replace", "--json"], { override: true });
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toMatchObject({ projectId: "proj-replace", memoriesReplaced: 2, memoriesInserted: 1 });
    expect(memoryIds()).toEqual(["replace-1"]);
  });
});

describe("gnosys restore", () => {
  let backup: string;

  beforeEach(async () => {
    const backupsDir = path.join(root, "backups");
    backup = await (async () => {
      const db = new GnosysDB(home);
      try {
        db.insertMemory(makeMemory({ id: "in-backup" }));
        return await db.backup(backupsDir);
      } finally {
        db.close();
      }
    })();
    withDb((db) => db.insertMemory(makeMemory({ id: "after-backup" })));
  });

  it("is refused without a terminal and the live DB keeps every memory", () => {
    const res = runCli(["restore", backup, "--json"]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout)).toEqual({
      ok: false,
      code: "MEMORY_DELETE_REFUSED",
      error: `Refused to delete "${path.basename(backup)}": memory deletion needs a human at an interactive terminal to type the key. ${ALTERNATIVE}`,
    });
    expect(memoryIds()).toEqual(["after-backup", "in-backup"]);
    expect(fs.readdirSync(home).filter((f) => f.startsWith("gnosys-pre-restore-"))).toEqual([]);
  });

  it("with the override, snapshots the live DB first and then restores", () => {
    const res = runCli(["restore", backup, "--json"], { override: true });
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out).toMatchObject({ ok: true, source: backup, memories: 1 });
    expect(path.dirname(out.preRestoreBackup)).toBe(home);
    expect(path.basename(out.preRestoreBackup)).toMatch(/^gnosys-pre-restore-.+\.db$/);
    expect(memoryIds()).toEqual(["in-backup"]);

    const snapshotDir = path.join(root, "snapshot");
    fs.mkdirSync(snapshotDir);
    fs.copyFileSync(out.preRestoreBackup, path.join(snapshotDir, "gnosys.db"));
    const snapshot = new GnosysDB(snapshotDir);
    try {
      expect(snapshot.getAllMemories().map((m) => m.id).sort()).toEqual(["after-backup", "in-backup"]);
    } finally {
      snapshot.close();
    }
  });
});

describe("gnosys maintain --auto-apply", () => {
  it("never deletes: the memory row count is unchanged", () => {
    const project = path.join(root, "project");
    fs.mkdirSync(project);
    expect(runCli(["init", "--directory", project]).status).toBe(0);
    const old = "2024-01-01";
    withDb((db) => {
      const projectId = db.getAllProjects()[0].id;
      for (const id of ["dup-a", "dup-b", "stale-c"]) {
        db.insertMemory(makeMemory({
          id,
          project_id: projectId,
          title: id === "stale-c" ? "Unrelated stale note" : "Use SQLite WAL mode for the central DB",
          content: id === "stale-c" ? "Old note." : "Use SQLite WAL mode for the central DB to allow concurrent readers.",
          created: old,
          modified: old,
          confidence: 0.4,
        }));
      }
    });
    const before = memoryIds();

    const res = runCli(["maintain", "--auto-apply"], { cwd: project });
    expect(res.status).toBe(0);
    expect(memoryIds()).toEqual(before);
    expect(before).toEqual(["dup-a", "dup-b", "stale-c"]);
  });
});
