import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { GnosysDB } from "../lib/db.js";
import { makeMemory } from "./_helpers.js";

const extension = path.resolve("extensions/vscode/extension.js");
const cli = path.resolve("dist/cli.js");
const launchSchema = z.object({ method: z.string(), command: z.string(), args: z.array(z.string()), shell: z.boolean() });
const resultSchema = z.object({
  warnings: z.array(z.string()), information: z.array(z.string()), errors: z.array(z.string()),
  launches: z.array(launchSchema),
  terminals: z.array(z.object({ shown: z.boolean(), runs: z.array(z.object({ command: z.string(), status: z.number().nullable() })) })),
});

// This host doubles only VS Code and records real operating-system process launches.
const hostSource = String.raw`
const fs = require("node:fs");
const vm = require("node:vm");
const cp = require("node:child_process");
const path = require("node:path");
const [extensionPath, command, activeFile, documentFile] = process.argv.slice(2);
const result = { warnings: [], information: [], errors: [], launches: [], terminals: [] };
const commands = new Map();
const children = [];
const processBoundary = { ...cp };
for (const method of ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"]) {
  processBoundary[method] = (...values) => {
    const args = Array.isArray(values[1]) ? values[1] : [];
    const options = values.find((value, index) => index > 0 && value && typeof value === "object" && !Array.isArray(value)) || {};
    result.launches.push({ method, command: String(values[0]), args, shell: method === "exec" || method === "execSync" || !!options.shell });
    const child = cp[method](...values);
    if (child && typeof child.once === "function") children.push(new Promise(resolve => child.once("close", resolve)));
    return child;
  };
}
const vscode = {
  commands: { registerCommand(name, callback) { commands.set(name, callback); return { dispose() {} }; } },
  window: {
    activeTextEditor: activeFile ? { document: {
      uri: { fsPath: activeFile }, fileName: activeFile,
      getText() { return fs.readFileSync(documentFile || activeFile, "utf8"); },
    } } : undefined,
    showWarningMessage(message) { result.warnings.push(message); },
    showInformationMessage(message) { result.information.push(message); },
    showErrorMessage(message) { result.errors.push(message); },
    createTerminal(options) {
      const entry = { shown: false, runs: [] };
      result.terminals.push(entry);
      if (typeof options === "object" && options.shellPath) {
        const child = processBoundary.spawnSync(options.shellPath, options.shellArgs || [], {
          cwd: options.cwd, encoding: "utf8", timeout: 10000,
        });
        entry.runs.push({ command: options.shellPath, status: child.status });
      }
      return {
        show() { entry.shown = true; },
        sendText(command) {
          const child = processBoundary.spawnSync(command, { shell: true, encoding: "utf8", timeout: 10000 });
          entry.runs.push({ command, status: child.status });
        },
      };
    },
  },
};
const mod = { exports: {} };
const load = new vm.Script("(function(require,module,exports,__filename,__dirname){\n" + fs.readFileSync(extensionPath, "utf8") + "\n})", { filename: extensionPath }).runInThisContext();
load(name => name === "vscode" ? vscode : ["child_process", "node:child_process"].includes(name) ? processBoundary : require(name), mod, mod.exports, extensionPath, path.dirname(extensionPath));
mod.exports.activate({ subscriptions: [] });
Promise.resolve(commands.get(command)()).then(async () => {
  await Promise.all(children);
  process.stdout.write(JSON.stringify(result));
});
`;

let directory: string;
let env: NodeJS.ProcessEnv;
let memoryId: string;
let host: string;

beforeEach(() => {
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-vscode-adversarial-")));
  const bin = path.join(directory, "bin");
  fs.mkdirSync(bin);
  fs.copyFileSync(path.resolve("src/test/fixtures/vscode/npx.cjs"), path.join(bin, "npx"));
  fs.chmodSync(path.join(bin, "npx"), 0o755);
  fs.writeFileSync(path.join(bin, "gnosys"), `#!/usr/bin/env node\nconst fs=require("node:fs");\nfs.appendFileSync(process.env.GNOSYS_TEST_INVOCATIONS,JSON.stringify(["gnosys",...process.argv.slice(2)])+"\\n");\nconst child=require("node:child_process").spawnSync(process.execPath,[process.env.GNOSYS_TEST_CLI,...process.argv.slice(2)],{stdio:"inherit"});\nprocess.exit(child.status ?? 1);\n`);
  fs.chmodSync(path.join(bin, "gnosys"), 0o755);
  env = {
    PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`,
    HOME: directory, USERPROFILE: directory, GNOSYS_HOME: path.join(directory, "central"),
    GNOSYS_CONFIG_DIR: path.join(directory, "config"), CI: "true", VITEST: "true",
    GNOSYS_TEST_CLI: cli, GNOSYS_TEST_INVOCATIONS: path.join(directory, "invocations.jsonl"),
  };
  execFileSync(process.execPath, [cli, "init"], { cwd: directory, env, stdio: "pipe" });
  memoryId = `mem-${randomUUID()}`;
  host = path.join(directory, "host.cjs");
  fs.writeFileSync(host, hostSource);
  const db = new GnosysDB(path.join(directory, "central"));
  for (const id of [memoryId, "unrelated-filename", "vscode-memory"]) {
    db.insertMemory(makeMemory({ id, title: "Selected decision", content: "Keep the selected decision.", modified: "2000-01-01" }));
  }
  db.close();
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

function writeMemory(relative: string, content = `---\nid: ${memoryId}\ntitle: Selected decision\n---\nKeep the selected decision.\n`) {
  const file = path.join(directory, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function run(command: string, activeFile?: string, documentFile = activeFile) {
  const result = resultSchema.parse(JSON.parse(execFileSync(process.execPath, [host, extension, command, ...(activeFile ? [activeFile, documentFile || activeFile] : [])], {
    cwd: directory, env, encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
  })));
  if (process.env.GNOSYS_ADVERSARIAL_OBSERVATIONS) {
    fs.appendFileSync(process.env.GNOSYS_ADVERSARIAL_OBSERVATIONS, JSON.stringify({
      command, activeFile, memoryId, result, calls: calls(), markers: fs.readdirSync(directory).filter(name => name.startsWith("audit-")),
    }) + "\n");
  }
  return result;
}

function calls(): string[][] {
  const file = path.join(directory, "invocations.jsonl");
  return fs.existsSync(file) ? z.array(z.array(z.string())).parse(fs.readFileSync(file, "utf8").trim().split("\n").map(line => JSON.parse(line))) : [];
}

function expectSelectedMemoryReinforced(result: z.infer<typeof resultSchema>) {
  expect(result.warnings).toEqual([]);
  expect(result.errors).toEqual([]);
  expect(calls()).toEqual([["gnosys", "reinforce", memoryId, "--signal", "useful"]]);
  const db = new GnosysDB(path.join(directory, "central"));
  try {
    expect(db.getMemory(memoryId)?.modified).toBe(new Date().toISOString().slice(0, 10));
    expect(db.getMemory("unrelated-filename")?.modified).toBe("2000-01-01");
    expect(db.getMemory("vscode-memory")?.modified).toBe("2000-01-01");
  } finally { db.close(); }
}


describe("VS Code adversarial public commands", () => {
  it("D-VSC-001: resolves a unique selected frontmatter ID instead of a basename or fixture constant", () => {
    const file = writeMemory(".gnosys/decisions/unrelated-filename.md");
    expectSelectedMemoryReinforced(run("gnosys.reinforceMemory", file));
  });

  for (const [label, content] of [
    ["absent ID", "---\ntitle: Missing identity\n---\nNo ID here."],
    ["empty ID", "---\nid: \ntitle: Missing identity\n---\nNo readable ID."],
    ["body-only ID", "An ordinary document.\nid: vscode-memory\n"],
  ]) {
    it(`D-VSC-001: ${label} warns without launching a subprocess`, () => {
      const file = writeMemory(".gnosys/decisions/unrelated-filename.md", content);
      const result = run("gnosys.reinforceMemory", file);
      expect(result.launches).toEqual([]);
      expect(calls()).toEqual([]);
      expect(result.information).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/memory.*id|id.*memory/i);
    });
  }

  for (const separator of ["/", "\\"]) {
    for (const component of [".gnosys-other", ".gnosysx", "my.gnosys", "x.gnosys"]) {
      it(`D-VSC-002: rejects ${component} with ${separator === "/" ? "POSIX" : "Windows"} separators`, () => {
        const physical = writeMemory(`nested/project/${component}/decisions/memory.md`);
        const selected = separator === "/" ? physical : physical.replaceAll("/", "\\");
        const result = run("gnosys.reinforceMemory", selected, physical);
        expect(result.warnings).toEqual(["This file is not inside a .gnosys/ directory."]);
        expect(result.launches).toEqual([]);
        expect(calls()).toEqual([]);
        expect(result.errors).toEqual([]);
      });
    }
    it(`D-VSC-002: accepts deeply nested exact .gnosys with ${separator === "/" ? "POSIX" : "Windows"} separators`, () => {
      const physical = writeMemory("nested/parent/project/.gnosys/decisions/deep/unrelated-filename.md");
      const selected = separator === "/" ? physical : physical.replaceAll("/", "\\");
      expectSelectedMemoryReinforced(run("gnosys.reinforceMemory", selected, physical));
    });
  }

  const hostileFilenames = [
    ["backticks", "`touch audit-backtick`.md", "audit-backtick"],
    ["command substitution", "$(touch audit-substitution).md", "audit-substitution"],
    ["semicolon", '"; touch audit-semicolon; #.md', "audit-semicolon"],
    ["and operator", '"; : && touch audit-and #.md', "audit-and"],
    ["pipe", '" | touch audit-pipe #.md', "audit-pipe"],
    ["quotes", "'single' and \"double\".md", "audit-unused"],
    ["spaces", "a decision with spaces.md", "audit-unused"],
    ["newline", '"\ntouch audit-newline\n#.md', "audit-newline"],
  ];
  for (const [label, filename, marker] of hostileFilenames) {
    it(`D-VSC-003: ${label} in the selected path cannot execute shell text or change the selected ID`, () => {
      const file = writeMemory(`.gnosys/decisions/${filename}`);
      const result = run("gnosys.reinforceMemory", file);
      expect(fs.existsSync(path.join(directory, marker))).toBe(false);
      expect(result.launches.map(launch => launch.shell)).toEqual([false]);
      expectSelectedMemoryReinforced(result);
    });
  }

  it("D-VSC-003: variable arguments use shell-free argv while the constant dashboard command runs", () => {
    const filename = "$(touch audit-variable) \"quoted\" ; && | `touch audit-backtick-variable`\n spaced.md";
    const file = writeMemory(`.gnosys/decisions/${filename}`);
    const reinforce = run("gnosys.reinforceMemory", file);
    expect([...new Set(reinforce.launches.map(launch => launch.shell))]).toEqual([false]);
    expect(calls().map(args => args.slice(0, 2))).toEqual([["gnosys", "reinforce"]]);
    expect(calls()).toEqual(reinforce.launches.map(launch => launch.args));
    expect(fs.existsSync(path.join(directory, "audit-variable"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "audit-backtick-variable"))).toBe(false);

    const help = execFileSync(process.execPath, [cli, "--help"], { cwd: directory, env, encoding: "utf8" });
    const registered = help.split("\n").map(line => /^ {2}([a-z][a-z-]*)\b/.exec(line)?.[1]).filter(value => value !== undefined);
    const dashboard = run("gnosys.runDashboard", file);
    expect(dashboard.terminals.flatMap(terminal => terminal.runs.map(run => run.command))).toEqual(["npx gnosys status --system"]);
    expect(calls().slice(1)).toEqual([["gnosys", "status", "--system"]]);
    expect(registered).toContain(calls()[1][1]);
    expect(dashboard.terminals.flatMap(terminal => terminal.runs.map(run => run.status))).toEqual([0]);
  });

  it("D-VSC-004: dashboard invocation is registered by the installed CLI and exits successfully", () => {
    const help = execFileSync(process.execPath, [cli, "--help"], { cwd: directory, env, encoding: "utf8" });
    const registered = help.split("\n").map(line => /^ {2}([a-z][a-z-]*)\b/.exec(line)?.[1]).filter(value => value !== undefined);
    const result = run("gnosys.runDashboard");
    const invoked = calls();
    expect(invoked).toHaveLength(1);
    expect(registered).toContain(invoked[0][1]);
    const execution = result.terminals.flatMap(terminal => terminal.runs.map(run => run.status));
    expect(execution).toEqual([0]);
    expect(result.terminals.map(terminal => terminal.shown)).toEqual([true]);
  });
});
