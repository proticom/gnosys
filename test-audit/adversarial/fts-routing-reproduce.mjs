import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cases = [
  { file: "src/test/fts-adversarial.test.ts", prefix: "fts" },
  { file: "src/test/routing-reset-adversarial.test.ts", prefix: "routing" },
  { file: "src/test/setup-ui-summary.test.ts", prefix: "routing-summary" },
];
for (const { file, prefix } of cases) {
  const original = fs.readFileSync(file, "utf8");
  const report = `test-audit/adversarial/${prefix}-ordinary.json`;
  const selectedNames = [...original.matchAll(/it\.fails\("([^"]+)"/g)].map(match => match[1]);
  if (!selectedNames.length) throw new Error(`Expected a known-defect case in ${file}`);
  try {
    fs.writeFileSync(file, original.replaceAll("it.fails(", "it("));
    const run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", file, "--reporter=json", `--outputFile=${report}`], {
      encoding: "utf8", timeout: 60_000,
    });
    if (run.error || !fs.existsSync(report)) throw new Error(`${run.error || "Missing report"}\n${run.stdout}${run.stderr}`);
    const data = JSON.parse(fs.readFileSync(report, "utf8"));
    const failed = data.testResults.flatMap(suite => suite.assertionResults).filter(test => test.status === "failed");
    if (run.status === 0 || failed.length !== selectedNames.length || selectedNames.some(name => !failed.some(test => test.fullName.endsWith(name)))) {
      throw new Error(`Ordinary reproduction mismatch in ${file}`);
    }
    fs.writeFileSync(`test-audit/adversarial/${prefix}-ordinary.log`, failed.map(test => `${test.fullName}\n${test.failureMessages.join("\n")}`).join("\n\n").replaceAll(process.cwd(), "<repo>"));
    process.stdout.write(`${path.basename(file)}: ${failed.length} ordinary failures\n`);
  } finally {
    fs.writeFileSync(file, original);
  }
}
