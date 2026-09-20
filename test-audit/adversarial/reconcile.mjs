import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const key = test => JSON.stringify([test.file, test.name]);
const names = row => row.afterNames || [row.name];
const fileOf = row => row.file || row.beforeId?.replace(/:\d+$/, "");
const config = process.argv[2] ? read(process.argv[2]) : {};
const suitePath = config.suitePath || "test-audit/adversarial/repair-unit-full.json";
const ordinaryFailurePath = config.ordinaryFailurePath || "test-audit/adversarial/final-open-ordinary.json";
const applicationFixRef = config.applicationFixRef || "f4b9135ae350fad937a66f03a9bc3ccfbd8c6906";
const proofPrefix = config.proofPrefix || "adversarial.";
const suite = read(suitePath);
const runtime = suite.testResults.flatMap(file => file.assertionResults.map(test => ({ file: path.relative(process.cwd(), file.name), name: test.fullName })));
const draft = read(config.reconciliationPath || "test-audit/adversarial/current-reconciliation-draft.json");
const expectedFailures = new Set(draft.currentDeclarations.filter(test => /\bfails\b/.test(test.declaration))
  .flatMap(test => test.runtimeCases.map(runtime => key({ file: test.file, name: runtime.name }))));
const oldName = "VS Code extension public commands D-VSC-003: passes shell syntax in a filename as literal text";
const newName = "VS Code extension public commands D-VSC-003: reads the selected memory ID without evaluating shell syntax in its filename";
const proofFiles = fs.readdirSync("test-audit/mutations").filter(file => file.startsWith(proofPrefix) && file.endsWith(".results.json"));
const proofs = proofFiles.flatMap(file => read(`test-audit/mutations/${file}`).results);
const killsFor = test => [...new Set(proofs.filter(proof => proof.outcome === "killed" && proof.applicationRestored
  && proof.before.exitCode === 0 && proof.restored.exitCode === 0
  && proof.killedBy.some(killed => key(killed) === key(test))).map(proof => proof.id))];
const defectFor = (test, fallback) => {
  if (config.caseDefects?.[test.name]) return config.caseDefects[test.name];
  if (test.file.includes("vscode") && (test.name.includes("D-VSC-002: accepts")
    || test.name.includes("D-VSC-003:") && !test.name.includes("every extension command"))) return "D-VSC-001";
  if (test.file.endsWith("setup-ui-summary.test.ts") && test.name.includes("marks an edited routing")) return "DEF-G1-001";
  return test.name.match(/DEF-G1-001|D-G3-001|D-VSC-00[1-4]|D-CTX-00[12]|G2-D00[123]|ADV-CTX-00[12]|D-DASH-001|ADV-FTS-001/)?.[0] || fallback || null;
};
const mapped = new Set();
const defectCases = new Map();
const remember = (test, defectId) => {
  if (!defectId) return;
  if (!defectCases.has(defectId)) defectCases.set(defectId, new Map());
  defectCases.get(defectId).set(key(test), test);
};
for (const file of fs.readdirSync("test-audit/reviews").filter(file => file.endsWith(".after.json") && file !== "adversarial.after.json")) {
  const fullPath = `test-audit/reviews/${file}`;
  const data = read(fullPath);
  for (const row of [...(data.tests || data.actions || []), ...(data.additionalTests || [])]) {
    if (row.action === "deleted") continue;
    if (row.name === oldName) row.name = newName;
    if (row.afterNames) row.afterNames = row.afterNames.map(name => name === oldName ? newName : name);
    const tests = names(row).map(name => ({ file: fileOf(row), name }));
    for (const test of tests) mapped.add(key(test));
    const ids = [...new Set(tests.flatMap(killsFor))];
    const failing = tests.filter(test => expectedFailures.has(key(test)));
    for (const test of tests) remember(test, defectFor(test, row.defectId));
    if (failing.length) {
      if (failing.length !== tests.length) continue;
      row.action = "expected_failure";
      row.defectId = defectFor(failing[0], row.defectId);
      row.mutationIds = [];
      row.evidence = `Ordinary failure reproduced for ${row.defectId}; see ${ordinaryFailurePath}. This detects an open defect and does not prove successful behavior.`;
      delete row.proof;
      delete row.inverseRepairProbeId;
      delete row.countsTowardMutationScore;
    } else if (ids.length) {
      row.action = row.beforeId ? "rewritten" : "added";
      row.mutationIds = [...new Set([...(row.mutationIds || []).filter(id => !/repair|witness/.test(id)), ...ids])];
      row.evidence = `Ordinary case passes at ${applicationFixRef} and fails under direct fault(s) ${ids.join(", ")}; exact application restoration passes. See test-audit/mutations/${proofPrefix}*.results.json.`;
    }
  }
  write(fullPath, data);
}
const additions = runtime.filter(test => !mapped.has(key(test))).map(test => {
  const defectId = defectFor(test);
  remember(test, defectId);
  const expectedFailure = expectedFailures.has(key(test));
  const mutationIds = expectedFailure ? [] : killsFor(test);
  if (expectedFailure && !defectId || !expectedFailure && !mutationIds.length) throw new Error(`Missing new-case evidence: ${key(test)}`);
  return { ...test, classification: "STRONG", action: expectedFailure ? "expected_failure" : "added", defectId, mutationIds,
    evidence: expectedFailure
      ? `Ordinary failing assertion reproduces ${defectId}; ${ordinaryFailurePath} records the actual failure. No successful behavior or inverse-repair credit is claimed.`
      : `Measured pass/fail/pass against direct fault(s) ${mutationIds.join(", ")}. The actual failing assertions and restored runs are in test-audit/mutations/${proofPrefix}*.results.json.` };
});
write("test-audit/reviews/adversarial.after.json", { tests: [], additionalTests: additions });

const defects = read("test-audit/defects.json");
const newDefects = [...read("test-audit/adversarial/dashboard-defects.json"), ...read("test-audit/adversarial/fts-defects.json"),
  ...read("test-audit/adversarial/context-f4b9135-defects.json").newDefects];
for (const defect of newDefects) if (!defects.some(existing => existing.id === defect.id)) defects.push(defect);
const fixRefs = { "D-VSC-002": "13756f2", "D-VSC-004": "e2c08a3", "D-CTX-001": "636e032", "D-CTX-002": "a420e3b",
  "G2-D001": "6a69746", "G2-D002": "29a59b0", "G2-D003": "3021bf5", ...config.fixRefs };
const reasons = {
  "D-G3-001": "DEFERRED at the user's direction. The ordinary FNV regression still fails; no hash repair was incorporated.",
  "D-VSC-001": "OPEN. The selected ID and useful signal are still missing. Corrected QA fixtures supply real document text and no longer require launching for unreadable IDs. This also blocks positive nested-path and hostile-filename reinforcement cases.",
  "D-VSC-003": "OPEN, partially repaired. Reinforcement uses shell-free argv, but the dashboard still invokes a shell through terminal.sendText. The user's extension-wide requirement fails. The CLI accepts a memory ID, so filename cases now require reading that literal selected file and passing its real ID.",
  "DEF-G1-001": "OPEN. Reset retains task overrides. Four ordinary wizard regressions fail, including the corrected all-ollama summary. Unrelated serialized config values remain unchanged; v584 tests remain byte-identical.",
  ...config.reasons,
};
for (const defect of defects) {
  defect.historicalStatus ??= defect.status;
  defect.historicalReproduction ??= defect.reproduction;
  const fixed = !!fixRefs[defect.id];
  const cases = [...(defectCases.get(defect.id)?.values() || [])].filter(test => fixed ? !expectedFailures.has(key(test)) : expectedFailures.has(key(test)));
  if (!cases.length) throw new Error(`Defect has no current cases: ${defect.id}`);
  const kind = fixed ? "fixed" : defect.id === "D-G3-001" ? "deferred" : "open";
  defect.resolution = { kind, cases, ordinaryEvidence: fixed ? suitePath : ordinaryFailurePath,
    reason: reasons[defect.id] || (fixed ? "Ordinary passing cases and direct fault replays verify the accepted repair." : "New ordinary failure reproduced and retained as an expected failure. No application repair was incorporated.") };
  if (fixed) {
    defect.resolution.fixCommits = [execFileSync("git", ["rev-parse", fixRefs[defect.id]], { encoding: "utf8" }).trim()];
    defect.resolution.faultMutationIds = [...new Set(cases.flatMap(killsFor))];
  }
  defect.status = kind.toUpperCase();
  defect.reproduction = `node scripts/test-audit-reproduce-current.mjs ${defect.id}`;
  defect.evidence ||= defect.cause || `${defect.actual} ${defect.limitation || ""}`;
  for (const field of ["expected", "actual"]) if (typeof defect[field] !== "string") defect[field] = JSON.stringify(defect[field]);
  defect.evidenceFiles = (defect.evidenceFiles || []).filter(file => !file.endsWith(".log"));
}
write("test-audit/defects.json", defects);
write("test-audit/adversarial/acceptance.json", { schemaVersion: 1, applicationFixRef,
  applicationFixCommits: execFileSync("git", ["rev-list", "--reverse", `ec19554..${applicationFixRef}`, "--", "src", ":!src/test", "prompts", "extensions"], { encoding: "utf8" }).trim().split("\n"),
  ordinaryRun: { path: suitePath, sha256: hash(suitePath), applicationDigest: config.applicationDigest || "059ec3ee279146604895d9aba2dbc56f56480450e6c52fe27a2a32db0016b412",
    testSourceHashes: Object.fromEntries(read("test-audit/current-inventory.json").files.map(file => [file.path, hash(file.path)])) } });
process.stdout.write(`${additions.length} new runtime actions; ${defects.length} explicit defect resolutions; ${expectedFailures.size} current expected-failure cases.\n`);
