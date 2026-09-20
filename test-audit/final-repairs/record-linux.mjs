import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const directory = process.argv[2];
assert.ok(directory, "Supply the downloaded diagnostic artifact directory");
const root = "test-audit/final-repairs";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const cases = report => report.testResults.flatMap(suite => suite.assertionResults.map(test => [
  suite.name.slice(suite.name.lastIndexOf("/src/") + 1), test.fullName, test.status,
])).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const local = cases(read(`${root}/full-suite.json`));
const reports = {};
for (const name of ["targeted-1", "targeted-2", "targeted-3", "full-suite", "coverage-suite"]) {
  const file = path.join(directory, "diagnostic-results", `${name}.json`);
  const report = read(file);
  const expected = name.startsWith("targeted") ? 24 : 1746;
  assert.equal(report.success, true);
  assert.equal(report.numTotalTests, expected);
  assert.equal(report.numPassedTests, expected);
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  if (expected === 1746) {
    assert.deepEqual(cases(report), local);
    assert.doesNotMatch(fs.readFileSync(file.replace(/\.json$/, ".log"), "utf8"), /^\[(?:process-exit(?:-event)?|child-exit)\]/m);
  }
  reports[name] = { sha256: hash(file), total: expected, passed: expected, failed: 0, skipped: 0 };
}
const runtime = fs.readFileSync(path.join(directory, "diagnostic-results/runtime.log"), "utf8");
assert.match(runtime, /^v24\.18\.1\nLinux .*x86_64/m);
const coverageFile = path.join(directory, "coverage/coverage-summary.json");
const coverage = read(coverageFile).total;
const config = fs.readFileSync("vitest.config.ts", "utf8");
const thresholds = Object.fromEntries([...config.matchAll(/^\s+(statements|branches|functions|lines): (\d+),$/gm)].map(([, name, value]) => [name, Number(value)]));
assert.deepEqual(thresholds, { statements: 50, branches: 40, functions: 55, lines: 50 });
for (const [name, minimum] of Object.entries(thresholds)) assert.ok(coverage[name].pct >= minimum, `${name} threshold failed`);
const diagnosticCommit = "e88629cff863a548867256cbd65128b8dc88b324";
const releaseCommit = "1fcc4f305a7a07531e3a8fac35a31a0eeb791ae4";
execFileSync("git", ["diff", "--exit-code", diagnosticCommit, releaseCommit, "--", "src", "extensions", "prompts", "vitest.config.ts"]);
fs.copyFileSync(coverageFile, `${root}/linux-coverage-summary.json`);
const result = {
  runUrl: "https://github.com/proticom/gnosys/actions/runs/35506107541",
  diagnosticCommit, releaseCommit, runtime: runtime.trim(), reports, coverage, thresholds,
  coverageSummarySha256: hash(coverageFile),
  fullAndCoverageCaseIdentitiesMatchLocal: true,
  fullAndCoverageExitPreloadAbsent: true,
  applicationTestsAndVitestConfigMatchRelease: true,
  limitation: "The diagnostic package version was 6.2.2; release metadata is 6.2.3. Application, test and Vitest configuration bytes match. Raw reports remain downloadable from the linked run; their hashes are recorded here. No broader Node-version or platform validation is inferred.",
};
fs.writeFileSync(`${root}/linux-verification.json`, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write("Verified three targeted runs, both 1746-case runs, unchanged coverage thresholds, runtime and source identity.\n");
