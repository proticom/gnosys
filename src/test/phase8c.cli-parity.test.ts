/**
 * Phase 8c: CLI Parity
 * Test Plan Reference: "Phase 8 Tests — 8c"
 *
 *   TC-8c.1: All listed CLI commands work and match MCP behavior
 *   TC-8c.2: --json flag works
 *   TC-8c.3: CLI auto-detects projectId from local gnosys.json
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { GnosysDB } from "../lib/db.js";
import { CLI, cliInit, extractJson, makeMemory } from "./_helpers.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cli-parity-"));
  cliInit(tmpDir);
});

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

function run(command: string, opts: { json?: boolean } = {}): string {
  const cmd = opts.json
    ? `${CLI} ${command} --json`
    : `${CLI} ${command}`;
  return execSync(cmd, {
    cwd: tmpDir,
    encoding: "utf-8",
    env: {
      ...process.env,
      GNOSYS_HOME: path.join(tmpDir, ".test-central"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

describe("Phase 8c: CLI Parity", () => {
  // ─── TC-8c.1: CLI commands work ──────────────────────────────────────

  describe("TC-8c.1: Core CLI commands functional", () => {
    it("gnosys list returns empty list for new store", () => {
      expect(run("list").trim()).toBe("0 memories:");
      run('pref set parity-list "Listed value"');
      expect(run("list")).toContain("1 memories:");
      expect(run("list")).toContain("[user] [active] Parity List");
    });

    it("gnosys stats returns statistics", () => {
      expect(run("stats").trim()).toBe("No memories found.");
      run('pref set parity-stats "Counted value"');
      expect(run("stats")).toContain("Total memories: 1");
      expect(run("stats")).toContain("preferences: 1");
    });

    it("gnosys projects lists registered projects", () => {
      const output = run("projects");
      expect(output).toContain("1 registered project(s):");
      expect(output).toContain(path.basename(tmpDir));
      expect(output).toContain(`Directory: ${tmpDir}`);
      expect(output).toContain("Memories:  0");
    });

    it("gnosys pref get returns preferences (empty for new store)", () => {
      expect(run("pref get").trim()).toBe("No preferences set. Use 'gnosys pref set <key> <value>' to add some.");
    });

    it("gnosys pref set + get round-trips a value", () => {
      run('pref set test-key "test value"');
      const output = run("pref get test-key");
      expect(output).toContain("test value");

      // Cleanup
      run("pref delete test-key");
    });

    it("gnosys --help shows help text", () => {
      const output = execSync(`${CLI} --help`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect(output).toContain("Gnosys");
      expect(output).toContain("Commands:");
    });

    it("gnosys init --help shows init options", () => {
      const output = execSync(`${CLI} init --help`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect(output).toContain("directory");
    });
  });

  // ─── TC-8c.3: Auto-detect projectId ──────────────────────────────────

  describe("TC-8c.3: CLI auto-detects projectId from gnosys.json", () => {

    it("CLI scopes list to the current working directory and shared memories", () => {
      const centralDir = path.join(tmpDir, ".test-central");
      const otherDir = path.join(tmpDir, "other-project");
      fs.mkdirSync(otherDir);
      cliInit(otherDir, { centralDir });
      const current = JSON.parse(fs.readFileSync(path.join(tmpDir, ".gnosys/gnosys.json"), "utf8"));
      const other = JSON.parse(fs.readFileSync(path.join(otherDir, ".gnosys/gnosys.json"), "utf8"));
      const db = new GnosysDB(centralDir);
      try {
        db.insertMemory(makeMemory({ id: "current-record", project_id: current.projectId, scope: "project" }));
        db.insertMemory(makeMemory({ id: "other-record", project_id: other.projectId, scope: "project" }));
        db.insertMemory(makeMemory({ id: "shared-record", project_id: null, scope: "user" }));
      } finally {
        db.close();
      }
      const parsed = JSON.parse(extractJson(run("list", { json: true })));
      expect(parsed.count).toBe(2);
      expect(parsed.memories.map((memory: { id: string }) => memory.id).sort()).toEqual(["current-record", "shared-record"]);
    });

  });
});
