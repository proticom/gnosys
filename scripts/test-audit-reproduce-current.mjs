import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const [selection, output] = process.argv.slice(2);
const defects = JSON.parse(fs.readFileSync("test-audit/defects.json", "utf8"));
const selected = selection === "--all-open"
  ? defects.filter(defect => ["open", "deferred"].includes(defect.resolution?.kind))
  : defects.filter(defect => defect.id === selection);
if (!selected.length || selected.some(defect => !defect.resolution?.cases?.length)) {
  throw new Error("Usage: node scripts/test-audit-reproduce-current.mjs <defect-id|--all-open> [report.json]");
}
const cases = selected.flatMap(defect => defect.resolution.cases.map(test => ({
  ...test, expected: defect.resolution.kind === "fixed" ? "passed" : "failed",
})));
const files = [...new Set(cases.map(test => test.file))];
const originals = new Map(files.map(file => [file, fs.readFileSync(file)]));
const application = execFileSync("git", ["ls-files", "src", "prompts", "extensions"], { encoding: "utf8" })
  .trim().split("\n").filter(file => !file.startsWith("src/test/") && !file.endsWith(".test.ts"));
const digest = () => createHash("sha256").update(application.map(file => `${file}\0${fs.readFileSync(file).toString("base64")}`).join("\0")).digest("hex");
const before = digest();
const reportPath = output || path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-defect-reproduction-")), "ordinary.json");
if (fs.existsSync(reportPath)) throw new Error(`Choose a new report path: ${reportPath}`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const pattern = cases.map(test => test.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).map(name => `^${name}$`).join("|");
const lock = "test-audit/.mutation-lock";
fs.mkdirSync(lock);
let run;
try {
  for (const [file, bytes] of originals) fs.writeFileSync(file, bytes.toString().replaceAll("it.fails(", "it("));
  run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files, "-t", pattern, "--reporter=json", `--outputFile=${reportPath}`], {
    encoding: "utf8", timeout: 180_000, maxBuffer: 16 * 1024 * 1024,
  });
} finally {
  for (const [file, bytes] of originals) fs.writeFileSync(file, bytes);
  fs.rmdirSync(lock);
  if (digest() !== before) throw new Error("Application changed during ordinary reproduction");
}
if (run.error || !fs.existsSync(reportPath)) throw new Error(`${run.error || "Missing test report"}\n${run.stdout}${run.stderr}`);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const observed = report.testResults.flatMap(file => file.assertionResults.map(test => ({
  file: path.relative(process.cwd(), file.name), name: test.fullName, status: test.status,
}))).filter(test => !["pending", "skipped"].includes(test.status));
const key = test => JSON.stringify([test.file, test.name, test.expected ?? test.status]);
if (JSON.stringify(cases.map(key).sort()) !== JSON.stringify(observed.map(key).sort())) {
  throw new Error(`Ordinary results differ from the recorded resolutions. Inspect ${reportPath}`);
}
const expectedExit = cases.some(test => test.expected === "failed") ? 1 : 0;
if (run.status !== expectedExit) throw new Error(`Expected exit ${expectedExit}, received ${run.status}`);
process.stdout.write(`${JSON.stringify({ report: reportPath, cases: cases.length, applicationDigest: before, applicationRestored: true })}\n`);
