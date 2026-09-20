import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--repairs-only")) throw new Error("Usage: node test-audit/adversarial/vscode-dashboard-reproduce.mjs [--repairs-only]");
const mode = args.includes("--repairs-only")
  ? { name: "repairs-only", stem: "vscode-repairs", expectedExit: 0, files: ["src/test/vscode-adversarial.test.ts", "src/test/vscode-extension.test.ts"] }
  : { name: "ordinary-all", stem: "vscode-dashboard", expectedExit: 1, files: ["src/test/vscode-adversarial.test.ts", "src/test/dashboard-html-adversarial.test.ts", "src/test/vscode-extension.test.ts"] };
const { files, expectedExit } = mode;
const artifact = path.resolve("test-audit/adversarial");
fs.mkdirSync(artifact, { recursive: true });
const originals = files.map(file => ({ file, body: fs.readFileSync(file, "utf8") }));
const observations = path.join(artifact, `${mode.stem}-observations.jsonl`);
fs.writeFileSync(observations, "");
let result;
try {
  for (const { file, body } of originals) fs.writeFileSync(file, body.replaceAll("it.fails(", "it("));
  result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files, "--reporter=json", `--outputFile=${artifact}/${mode.stem}-ordinary.json`], {
    env: { ...process.env, GNOSYS_ADVERSARIAL_OBSERVATIONS: observations, GNOSYS_DASHBOARD_ARTIFACT: path.join(artifact, "dashboard-injection-reproduction.html") },
    encoding: "utf8", timeout: 180000,
  });
  fs.writeFileSync(path.join(artifact, `${mode.stem}-ordinary.log`), result.stdout + result.stderr);
} finally {
  for (const { file, body } of originals) fs.writeFileSync(file, body);
}
execFileSync("git", ["diff", "--exit-code", "--", "extensions", "src/lib"], { stdio: "pipe" });
fs.writeFileSync(path.join(artifact, `${mode.stem}-reproduction.json`), JSON.stringify({
  mode: mode.name,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), expectedExit,
  exitCode: result.status, error: result.error?.message || null,
  purpose: "Ordinary defect reproduction; expected-failure annotations temporarily disabled without changing assertions or application code.",
  files: originals.map(({ file, body }) => ({ file, restored: fs.readFileSync(file, "utf8") === body, sha256: createHash("sha256").update(body).digest("hex") })),
  applicationUnchanged: true,
}, null, 2) + "\n");
const report = JSON.parse(fs.readFileSync(path.join(artifact, `${mode.stem}-ordinary.json`), "utf8"));
const cases = report.testResults.flatMap(file => file.assertionResults.map(test => ({ file: path.relative(process.cwd(), file.name), ...test })));
const byDefect = new Map();
for (const test of cases) {
  const defect = /D-(?:VSC-00[1-4]|DASH-001)/.exec(test.fullName)?.[0];
  if (!defect) continue;
  if (!byDefect.has(defect)) byDefect.set(defect, []);
  byDefect.get(defect).push(test);
}
for (const [defectId, tests] of byDefect) {
  const prefix = defectId.startsWith("D-DASH") ? "dashboard" : "vscode";
  fs.writeFileSync(path.join(artifact, `${prefix}-${defectId}.${mode.name}.json`), JSON.stringify({
    defectId, mode: mode.name, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), tests,
  }, null, 2) + "\n");
}
if (mode.name === "ordinary-all" && cases.some(test => test.status === "failed" && !/D-(?:VSC-00[1-4]|DASH-001)/.test(test.fullName))) {
  throw new Error("Ordinary reproduction has an undocumented test failure");
}
if (result.status !== expectedExit) throw new Error(`Expected ordinary reproduction exit ${expectedExit}, received ${result.status}`);
