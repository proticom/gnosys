import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { verifyApplicationAcceptance, verifyDefectAcceptance } from "../../scripts/test-audit-ledger.mjs";

const ownerRoot = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-report-validation-"));
const checks = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const testFile = "src/test/repaired.test.ts";
const testName = "repair acceptance returns the configured value";
const appFile = "src/lib/value.js";
const suiteFile = "test-audit/evidence/current.json";
const app = (value, extra = "") => `export const value = ${value};\n${extra}`;
const test = (value, fails = false) => `import { it, expect } from "vitest";\nimport { value } from "../lib/value.js";\nit${fails ? ".fails" : ""}("${testName}", () => expect(value).toBe(${value}));\n`;
const inventory = (fails = false) => ({ files: [{ path: testFile, sha256: hash(fs.readFileSync(testFile)), tests: [
  { id: `${testFile}:3`, line: 3, name: testName, suites: [], declaration: fails ? "it.fails" : "it" },
] }] });
const run = (report) => {
  const processResult = spawnSync(process.execPath, [path.join(ownerRoot, "node_modules/vitest/vitest.mjs"), "run", testFile, "--reporter=json", `--outputFile=${report}`], { encoding: "utf8", timeout: 30_000 });
  if (processResult.error) throw processResult.error;
  const result = read(report);
  return { exitCode: processResult.status, tests: result.testResults.flatMap((suite) => suite.assertionResults.map((entry) => ({
    file: suite.name.slice(suite.name.lastIndexOf("/src/") + 1), name: entry.fullName, status: entry.status, failures: entry.failureMessages,
  }))) };
};
const mark = (name, fn) => { fn(); checks.push({ name, status: "passed" }); };
try {
  process.chdir(fixture);
  git("init", "-q");
  git("config", "user.name", "Audit fixture");
  git("config", "user.email", "audit-fixture@example.invalid");
  write(".gitignore", "node_modules\n");
  fs.symlinkSync(path.join(ownerRoot, "node_modules"), "node_modules");
  write("package.json", { type: "module" });
  write("vitest.config.mjs", 'export default {test:{include:["src/test/repaired.test.ts"]}};\n');
  write(appFile, app(1));
  write(testFile, test(1));
  git("add", ".");
  git("commit", "-qm", "fixture audit base");
  const base = git("rev-parse", "HEAD");
  git("tag", "ec19554");
  const initialRun = run(suiteFile);
  assert.equal(initialRun.exitCode, 0);
  const initialInventory = inventory();
  write("test-audit/inventory.json", initialInventory);
  write("test-audit/current-inventory.json", initialInventory);
  for (const group of ["wiring", "group1", "group2", "group3"]) {
    write(`test-audit/reviews/${group}.before.json`, { files: group === "wiring" ? [{ path: testFile, tests: [{ line: 3, classification: "STRONG", evidence: "Actual literal fixture assertion" }] }] : [] });
  }
  write("test-audit/reviews/fixture.after.json", { tests: [{ beforeId: `${testFile}:3`, beforeName: testName, beforeClassification: "STRONG", action: "kept", afterNames: [testName], afterClassification: "STRONG", mutationIds: [] }] });
  write("test-audit/reviews/external.after.json", { tests: [] });
  write("test-audit/defects.json", []);
  write("test-audit/features.json", { features: [] });
  write("test-audit/feature-coverage.json", []);
  write("test-audit/collection.json", { test_cases_outside_vitest: [] });
  write("test-audit/completion.json", { complete: true, checks: [], blockers: [] });
  write("test-audit/reconciliation.json", { complete: true, allCurrentClassificationsStrong: true, evidence: { runtime: suiteFile }, counts: { declarationClassifications: { STRONG: 1 } }, currentDeclarations: [{ id: `${testFile}:3`, file: testFile, declaration: "it", runtimeCases: [{ name: testName }] }] });
  write("test-audit.json", { baseCommit: base, baseline: { passed: 1, skipped: 0, durationSeconds: 1, setup: { durationSeconds: 1 } }, inventory: { collectedCases: 1 } });
  fs.mkdirSync("test-audit/mutations");
  const script = (name) => spawnSync(process.execPath, [path.join(ownerRoot, "scripts", name), suiteFile, "--strict"], { encoding: "utf8", timeout: 30_000 });
  mark("No acceptance manifest preserves completed legacy audit", () => {
    assert.equal(verifyDefectAcceptance({ records: [], runtimeRows: initialRun.tests, suiteFile }), null);
    const ledger = script("test-audit-ledger.mjs"); assert.equal(ledger.status, 0, ledger.stderr);
    const report = script("test-audit-report.mjs"); assert.equal(report.status, 0, report.stderr);
    assert.equal(read("test-audit.json").status, "complete");
    assert.equal(read("test-audit.json").classificationCounts.before.STRONG, 1);
  });

  write(appFile, app(2));
  write(testFile, test(2));
  git("add", appFile, testFile);
  git("commit", "-qm", "fixture approved repair");
  const fix = git("rev-parse", "HEAD");
  let manifest = { applicationFixRef: fix, applicationFixCommits: [fix] };
  mark("Listed repair patches reproduce exact accepted application tree", () => assert.deepEqual(verifyApplicationAcceptance(manifest).issues, []));
  write(appFile, app(2, "export const unrelated = true;\n"));
  git("add", appFile); git("commit", "-qm", "fixture additional same-file change");
  const extra = git("rev-parse", "HEAD");
  manifest = { applicationFixRef: extra, applicationFixCommits: [fix] };
  mark("Unlisted commit in an already approved file is rejected", () => assert.equal(verifyApplicationAcceptance(manifest).issues.some((issue) => issue.kind === "unlistedApplicationChanges"), true));
  manifest.applicationFixCommits.push(extra);
  mark("Two explicitly approved application commits are accepted", () => assert.deepEqual(verifyApplicationAcceptance(manifest).issues, []));
  const acceptedApp = fs.readFileSync(appFile);
  write(appFile, app(99));
  mark("Uncommitted bytes inside an approved file are rejected", () => assert.equal(verifyApplicationAcceptance(manifest).issues.some((issue) => issue.kind === "applicationBytesOrModeMismatch"), true));
  fs.writeFileSync(appFile, acceptedApp);
  fs.chmodSync(appFile, 0o755);
  mark("Uncommitted executable mode is rejected", () => assert.equal(verifyApplicationAcceptance(manifest).issues.some((issue) => issue.kind === "applicationBytesOrModeMismatch"), true));
  fs.chmodSync(appFile, 0o644);
  write("src/lib/unlisted.js", "export const unexpected = true;\n");
  mark("Untracked application file is rejected", () => assert.equal(verifyApplicationAcceptance(manifest).issues.some((issue) => issue.kind === "unexpectedApplicationFile"), true));
  fs.rmSync("src/lib/unlisted.js");

  const application = verifyApplicationAcceptance(manifest);
  const before = run("test-audit/evidence/fault-before.json");
  let mutated;
  try {
    write(appFile, app(1));
    mutated = run("test-audit/evidence/fault-mutated.json");
  } finally { fs.writeFileSync(appFile, acceptedApp); }
  const restored = run(suiteFile);
  assert.equal(before.exitCode, 0); assert.equal(mutated.exitCode, 1); assert.equal(restored.exitCode, 0);
  const fault = { id: "fixture-direct-fault", file: appFile, kind: "fault-injection", stage: "after", outcome: "killed", applicationRestored: true,
    applicationDigest: application.applicationDigest, before, mutated, restored, killedBy: [{ file: testFile, name: testName }] };
  manifest.ordinaryRun = { path: suiteFile, sha256: hash(fs.readFileSync(suiteFile)), applicationDigest: application.applicationDigest, testSourceHashes: { [testFile]: hash(fs.readFileSync(testFile)) } };
  write("test-audit/adversarial/acceptance.json", manifest);
  write("test-audit/current-inventory.json", inventory());
  const defect = { id: "FIXTURE-001", title: "Fixture return value", expected: 2, actual: 1, evidence: "Synthetic fixture, not a Gnosys defect", reproduction: "fixture runner", evidenceFiles: [],
    resolution: { kind: "fixed", cases: [{ file: testFile, name: testName }], fixCommits: [fix], ordinaryEvidence: suiteFile, faultMutationIds: [fault.id] } };
  write("test-audit/defects.json", [defect]);
  const verify = (records = [fault]) => verifyDefectAcceptance({ records, runtimeRows: restored.tests, suiteFile });
  mark("Fixed case accepts real ordinary and direct fault pass/fail/pass", () => assert.equal(Object.values(verify().issues).flat().length, 0));
  mark("CI fault cannot satisfy an application fixed-case direct fault", () => assert.equal(verify([{ ...fault, kind: "ci-fault-injection" }]).issues.missingFixedDefectFaults.length, 1));
  mark("Inverse repair probe cannot satisfy a fixed-case direct fault", () => assert.equal(verify([{ ...fault, kind: "defect-repair-probe" }]).issues.missingFixedDefectFaults.length, 1));
  mark("A different before-case pass cannot satisfy the repaired case", () => assert.equal(verify([{ ...fault, before: { ...before, tests: [{ ...before.tests[0], name: "other case" }] } }]).issues.missingFixedDefectFaults.length, 1));
  manifest.ordinaryRun.sha256 = "stale";
  write("test-audit/adversarial/acceptance.json", manifest);
  mark("Stale ordinary suite receipt is rejected", () => assert.equal(verify().issues.missingOrdinaryDefectEvidence.length, 1));
  manifest.ordinaryRun.sha256 = hash(fs.readFileSync(suiteFile));
  write("test-audit/adversarial/acceptance.json", manifest);
  write("test-audit/mutations/fixture.results.json", { applicationDigest: application.applicationDigest, results: [fault] });
  mark("Strict ledger and report accept fixed defect while preserving original count", () => {
    const ledger = script("test-audit-ledger.mjs"); assert.equal(ledger.status, 0, ledger.stderr);
    const report = script("test-audit-report.mjs"); assert.equal(report.status, 0, report.stderr);
    const summary = read("test-audit.json");
    assert.equal(summary.defectCounts.fixed, 1); assert.equal(summary.classificationCounts.before.STRONG, 1);
    assert.equal(summary.applicationCodeChanged, true); assert.equal(summary.originalAudit.applicationCodeChanged, false);
  });
  write("test-audit/mutations/fixture.results.json", { applicationDigest: application.applicationDigest, results: [{ ...fault, kind: "defect-repair-probe" }] });
  mark("Strict ledger exits nonzero for inverse-only fixed-case proof", () => assert.equal(script("test-audit-ledger.mjs").status, 1));
  const savedAction = read("test-audit/reviews/fixture.after.json");
  write("test-audit/defects.json", []);
  write("test-audit/reviews/fixture.after.json", { tests: [{ ...savedAction.tests[0], action: "rewritten", mutationIds: [fault.id] }] });
  mark("Ordinary partial-repair case outside open.cases cannot use inverse proof", () => {
    assert.equal(script("test-audit-ledger.mjs").status, 1);
    assert.deepEqual(read("test-audit/ledger.json").issues.missingCaseKills[0].missingKillNames, [testName]);
  });
  write("test-audit/mutations/fixture.results.json", { applicationDigest: application.applicationDigest, results: [{ ...fault, kind: "ci-fault-injection" }] });
  mark("CI guard fault satisfies ordinary proof and stays outside application score", () => {
    const result = script("test-audit-ledger.mjs");
    assert.equal(result.status, 0, result.stderr);
    const ledger = read("test-audit/ledger.json");
    assert.equal(ledger.issues.missingCaseKills.length, 0);
    assert.equal(ledger.runtimeRows[0].killedByProof, true);
    assert.equal(ledger.mutationScore.tested, 0);
  });
  write("test-audit/reviews/fixture.after.json", savedAction);
  write("test-audit/defects.json", [defect]);

  const saved = new Map([testFile, suiteFile, "test-audit/current-inventory.json", "test-audit/reconciliation.json", "test-audit/defects.json", "test-audit/adversarial/acceptance.json"].map((file) => [file, fs.readFileSync(file)]));
  try {
    write(testFile, 'import { it, expect } from "vitest";\nimport { value } from "../lib/value.js";\nfor (const label of ["lookalike", "hostile"]) it(`repair accepts ${label}`, () => expect(value).toBe(2));\n');
    const loopBefore = run("test-audit/evidence/loop-before.json");
    let loopMutated;
    try { write(appFile, app(1)); loopMutated = run("test-audit/evidence/loop-mutated.json"); }
    finally { fs.writeFileSync(appFile, acceptedApp); }
    const loopRestored = run(suiteFile);
    const loopCases = loopRestored.tests.map(({ file, name }) => ({ file, name }));
    const loopInventory = inventory();
    loopInventory.files[0].tests[0].name = "`repair accepts ${label}`";
    write("test-audit/current-inventory.json", loopInventory);
    const loopReconciliation = read("test-audit/reconciliation.json");
    loopReconciliation.currentDeclarations[0].runtimeCases = loopCases.map(({ name }) => ({ name }));
    write("test-audit/reconciliation.json", loopReconciliation);
    const loopManifest = { ...manifest, ordinaryRun: { ...manifest.ordinaryRun, sha256: hash(fs.readFileSync(suiteFile)), testSourceHashes: { [testFile]: hash(fs.readFileSync(testFile)) } } };
    write("test-audit/adversarial/acceptance.json", loopManifest);
    const loopFault = { ...fault, before: loopBefore, mutated: loopMutated, restored: loopRestored, killedBy: loopCases };
    write("test-audit/defects.json", [{ ...defect, resolution: { ...defect.resolution, cases: loopCases } }]);
    mark("Expanded loop names map to one current ordinary declaration", () => {
      const result = verifyDefectAcceptance({ records: [loopFault], runtimeRows: loopRestored.tests, suiteFile });
      assert.equal(result.cases.length, 2); assert.equal(Object.values(result.issues).flat().length, 0);
    });
    mark("Each expanded loop case needs its own failed fault observation", () => {
      const partialFault = { ...loopFault, mutated: { ...loopMutated, tests: loopMutated.tests.slice(0, 1) } };
      assert.equal(verifyDefectAcceptance({ records: [partialFault], runtimeRows: loopRestored.tests, suiteFile }).issues.missingFixedDefectFaults.length, 1);
    });
  } finally { for (const [file, bytes] of saved) fs.writeFileSync(file, bytes); }

  write(testFile, test(99));
  const ordinaryFailure = run("test-audit/evidence/open-ordinary.json");
  assert.equal(ordinaryFailure.exitCode, 1);
  write(testFile, test(99, true));
  const expectedFailure = run(suiteFile);
  assert.equal(expectedFailure.exitCode, 0);
  write("test-audit/current-inventory.json", inventory(true));
  const openReconciliation = read("test-audit/reconciliation.json");
  openReconciliation.currentDeclarations[0].declaration = "it.fails";
  write("test-audit/reconciliation.json", openReconciliation);
  defect.resolution = { kind: "open", cases: [{ file: testFile, name: testName }], ordinaryEvidence: "test-audit/evidence/open-ordinary.json" };
  write("test-audit/defects.json", [defect]);
  mark("New open xfail needs ordinary failure without inverse repair credit", () => {
    const result = verifyDefectAcceptance({ records: [], runtimeRows: expectedFailure.tests, suiteFile });
    assert.equal(Object.values(result.issues).flat().length, 0);
    assert.equal(result.cases[0].directFaultId, null); assert.equal(result.cases[0].ordinaryVerified, true);
  });
  write("test-audit/reviews/fixture.after.json", { tests: [{ beforeId: `${testFile}:3`, beforeName: testName, beforeClassification: "STRONG", action: "expected_failure", afterNames: [testName], afterClassification: "STRONG", mutationIds: [] }] });
  write("test-audit/mutations/fixture.results.json", { results: [] });
  mark("Strict ledger accepts new open case without a repair probe", () => assert.equal(script("test-audit-ledger.mjs").status, 0));
  defect.id = "D-G3-001";
  write("test-audit/defects.json", [defect]);
  mark("D-G3-001 cannot silently leave deferred status", () => assert.equal(verifyDefectAcceptance({ records: [], runtimeRows: expectedFailure.tests, suiteFile }).issues.invalidDefectResolutions.length, 1));
  defect.resolution.kind = "deferred"; defect.resolution.reason = "User deferred hash behavior changes";
  write("test-audit/defects.json", [defect]);
  mark("Explicit deferred reason and ordinary failure are accepted", () => assert.equal(Object.values(verifyDefectAcceptance({ records: [], runtimeRows: expectedFailure.tests, suiteFile }).issues).flat().length, 0));
  write("test-audit/features.json", { features: [{ id: "F01", name: "Fixture behavior", obligations: { success: ["Returns the requested value"] } }] });
  const featureRow = { featureId: "F01", obligationKind: "success", obligation: "Returns the requested value", status: "PROTECTED", tests: [{ file: testFile, name: testName }] };
  write("test-audit/feature-coverage.json", [featureRow]);
  assert.equal(script("test-audit-ledger.mjs").status, 0);
  mark("Report rejects successful feature protection from an xfail", () => assert.equal(script("test-audit-report.mjs").status, 1));
  featureRow.status = "KNOWN_DEFECT";
  write("test-audit/feature-coverage.json", [featureRow]);
  mark("Known-defect feature row has zero successful behavior cases", () => {
    const result = script("test-audit-report.mjs"); assert.equal(result.status, 0, result.stderr);
    assert.equal(read("test-audit.json").featureSummary[0].strongBehaviorCases, 0);
    assert.equal(read("test-audit.json").featureSummary[0].status, "UNPROTECTED");
  });
} finally {
  process.chdir(ownerRoot);
  write("test-audit/adversarial/report-validation.results.json", { schemaVersion: 1, fixture, checks, note: "Controlled synthetic repository checks; these are validator tests, not Gnosys defect proofs." });
}
process.stdout.write(`${checks.length} controlled acceptance checks passed\n`);
