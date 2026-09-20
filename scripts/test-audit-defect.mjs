import fs from "node:fs";
import { spawnSync } from "node:child_process";

const id = process.argv[2];
const defect = JSON.parse(fs.readFileSync("test-audit/defects.json", "utf8")).find((entry) => entry.id === id);
if (!defect) throw new Error("Provide a defect ID from test-audit/defects.json");
const original = fs.readFileSync(defect.test, "utf8");
const search = `it.fails("${id}`;
if (original.split(search).length !== 2) throw new Error(`Expected one regression for ${id}`);
const lock = "test-audit/.mutation-lock";
fs.mkdirSync(lock);
const reportPath = `test-audit/evidence/${id}.reproduced.json`;
try {
  fs.writeFileSync(defect.test, original.replace(search, `it("${id}`));
  const run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", defect.test, "-t", id, "--reporter=json", `--outputFile=${reportPath}`], {
    encoding: "utf8", timeout: 60_000,
  });
  if (run.error || !fs.existsSync(reportPath)) throw new Error(`${run.error || "No test report"}\n${run.stdout}${run.stderr}`);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const test = report.testResults.flatMap((file) => file.assertionResults).find((test) => test.fullName.includes(id));
  if (test?.status !== "failed" || run.status === 0) throw new Error(`${id} no longer reproduces`);
  process.stdout.write(`${test.fullName}\n${test.failureMessages.join("\n")}\n`);
} finally {
  fs.writeFileSync(defect.test, original);
  fs.rmdirSync(lock);
}
