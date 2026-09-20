import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const suite = process.argv[2];
const baseline = process.argv.includes("--baseline");
const reportAt = process.argv.indexOf("--report");
const reportPath = reportAt >= 0 ? process.argv[reportAt + 1] : `test-audit/evidence/${suite.replace(":", "-")}.json`;
const root = process.cwd();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-audit-external-"));
const started = Date.now();
const cases = {
  "ci:multi-project": "Multi-project scenario test",
  "ci:network-share": baseline ? "Network share simulation (tmpfs)" : "Local storage round trip",
};
let result;
let tests;

if (suite === "e2e:setup") {
  result = spawnSync("bash", ["e2e-setup/run.sh"], { encoding: "utf8", timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
  tests = [...`${result.stdout}`.matchAll(/^(not ok|ok) - (.+)$/gm)].map((match) => ({
    file: "e2e-setup/tests/run-all.sh", name: match[2], status: match[1] === "ok" ? "passed" : "failed", failures: [],
  }));
} else {
  const name = cases[suite];
  if (!name) throw new Error(`Unknown external suite: ${suite}`);
  const workflow = baseline
    ? execFileSync("git", ["show", "203c4e7:.github/workflows/ci.yml"], { encoding: "utf8" })
    : fs.readFileSync(".github/workflows/ci.yml", "utf8");
  const step = workflow.indexOf(`      - name: ${name}\n`);
  if (step < 0) throw new Error(`Missing workflow step: ${name}`);
  const block = workflow.indexOf("        run: |\n", step);
  const lines = workflow.slice(block + "        run: |\n".length).split("\n");
  const scriptLines = [];
  for (const line of lines) {
    if (line.trim() && !line.startsWith("          ")) break;
    scriptLines.push(line.slice(10));
  }
  const scriptPath = path.join(directory, "scenario.sh");
  fs.writeFileSync(scriptPath, scriptLines.join("\n"));
  const childEnv = {
    PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    HOME: directory,
    USERPROFILE: directory,
    GNOSYS_HOME: path.join(directory, ".gnosys"),
    GNOSYS_CONFIG_DIR: path.join(directory, ".config/gnosys"),
    TMPDIR: directory,
    NODE_ENV: "test",
    CI: "true",
    TERM: "dumb",
  };
  result = spawnSync("bash", [scriptPath], { cwd: root, env: childEnv, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  tests = [{ file: ".github/workflows/ci.yml", name, status: result.status === 0 ? "passed" : "failed", failures: result.status === 0 ? [] : [`${result.stdout}${result.stderr}`.slice(-5000)] }];
}

const report = {
  schemaVersion: 1,
  framework: suite === "e2e:setup" ? "Docker Bash Expect" : "CI Bash",
  suite,
  baseline,
  durationMs: Date.now() - started,
  exitCode: result.status,
  error: result.error?.message || null,
  tests,
  stdout: `${result.stdout}`.replaceAll(directory, "<isolated-home>").replaceAll(root, "<repo>"),
  stderr: `${result.stderr}`.replaceAll(directory, "<isolated-home>").replaceAll(root, "<repo>"),
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.rmSync(directory, { recursive: true, force: true });
process.stdout.write(`${suite}: ${tests.filter((test) => test.status === "passed").length} passed; ${tests.filter((test) => test.status === "failed").length} failed; ${report.durationMs}ms\n`);
process.exitCode = result.status === 0 && tests.length > 0 ? 0 : 1;
