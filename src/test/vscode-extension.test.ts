import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";
import { makeMemory } from "./_helpers.js";

const host = path.resolve("src/test/fixtures/vscode/host.cjs");
const extension = path.resolve("extensions/vscode/extension.js");
const cli = path.resolve("dist/cli.js");
const resultSchema = z.object({
  warnings: z.array(z.string()), information: z.array(z.string()), errors: z.array(z.string()),
  terminals: z.array(z.object({ name: z.string(), shown: z.boolean(), runs: z.array(z.object({
    command: z.string(), status: z.number().nullable(), stdout: z.string(), stderr: z.string(),
  })) })),
});

describe("VS Code extension public commands", () => {
  let directory: string;
  let env: NodeJS.ProcessEnv;
  let memoryFile: string;

  beforeEach(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-vscode-")));
    const bin = path.join(directory, "bin");
    fs.mkdirSync(bin);
    fs.copyFileSync(path.resolve("src/test/fixtures/vscode/npx.cjs"), path.join(bin, "npx"));
    fs.chmodSync(path.join(bin, "npx"), 0o755);
    env = {
      PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`,
      HOME: directory, USERPROFILE: directory, GNOSYS_HOME: path.join(directory, "central"),
      GNOSYS_CONFIG_DIR: path.join(directory, "config"), CI: "true", VITEST: "true",
      GNOSYS_TEST_CLI: cli, GNOSYS_TEST_INVOCATIONS: path.join(directory, "invocations.jsonl"),
    };
    execFileSync(process.execPath, [cli, "init"], { cwd: directory, env, stdio: "pipe" });
    memoryFile = path.join(directory, ".gnosys/decisions/vscode-memory.md");
    fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
    fs.writeFileSync(memoryFile, "---\nid: vscode-memory\ntitle: Editor memory\n---\nKeep this decision.\n");
    const db = new GnosysDB(path.join(directory, "central"));
    db.insertMemory(makeMemory({ id: "vscode-memory", title: "Editor memory", content: "Keep this decision.", modified: "2000-01-01" }));
    db.close();
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  function run(command: string, activeFile?: string) {
    return resultSchema.parse(JSON.parse(execFileSync(process.execPath, [host, extension, command, ...(activeFile ? [activeFile] : [])], {
      cwd: directory, env, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"],
    })));
  }

  it("warns when no editor is open", () => {
    expect(run("gnosys.reinforceMemory")).toEqual({
      warnings: ["No active editor."], information: [], errors: [], terminals: [],
    });
  });

  it("warns when the active file is outside a memory directory", () => {
    expect(run("gnosys.reinforceMemory", path.join(directory, "notes.md"))).toEqual({
      warnings: ["This file is not inside a .gnosys/ directory."], information: [], errors: [], terminals: [],
    });
  });

  it("reports a process launch failure to the editor", () => {
    env.PATH = path.join(directory, "no-executables");
    const result = run("gnosys.reinforceMemory", memoryFile);
    expect(result.warnings).toEqual([]);
    expect(result.information).toEqual([]);
    expect(result.errors).toEqual(["Reinforce failed: spawnSync npx ENOENT"]);
  });

  it("D-VSC-001: reinforcing an open memory resets its persisted decay date", () => {
    const result = run("gnosys.reinforceMemory", memoryFile);
    const db = new GnosysDB(path.join(directory, "central"));
    try { expect(db.getMemory("vscode-memory")?.modified).toBe(new Date().toISOString().slice(0, 10)); }
    finally { db.close(); }
    expect(result.information).toEqual(["Reinforced: vscode-memory.md"]);
  });

  it("D-VSC-002: rejects a directory whose name only starts with .gnosys", () => {
    expect(run("gnosys.reinforceMemory", path.join(directory, ".gnosys-other/memory.md"))).toEqual({
      warnings: ["This file is not inside a .gnosys/ directory."], information: [], errors: [], terminals: [],
    });
  });

  it("D-VSC-003: reads the selected memory ID without evaluating shell syntax in its filename", () => {
    const selected = path.join(directory, ".gnosys/decisions/$(touch audit-injected).md");
    fs.copyFileSync(memoryFile, selected);
    run("gnosys.reinforceMemory", selected);
    const calls = fs.readFileSync(path.join(directory, "invocations.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(fs.existsSync(path.join(directory, "audit-injected"))).toBe(false);
    expect(calls).toEqual([["gnosys", "reinforce", "vscode-memory", "--signal", "useful"]]);
  });

  it("D-VSC-004: the dashboard action opens a command supported by the installed CLI", () => {
    const result = run("gnosys.runDashboard");
    expect(result.terminals.map(({ name, shown }) => ({ name, shown }))).toEqual([{ name: "Gnosys Dashboard", shown: true }]);
    expect(result.terminals.flatMap((terminal) => terminal.runs.map((entry) => entry.status))).toEqual([0]);
  });
});
