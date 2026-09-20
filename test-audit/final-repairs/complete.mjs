import fs from "node:fs";
import assert from "node:assert/strict";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const suite = read("test-audit/final-repairs/full-suite.json");
assert.equal(suite.numPassedTests, 1746);
assert.equal(suite.numFailedTests, 0);
assert.equal(suite.numPendingTests, 0);
const defects = read("test-audit/defects.json");
const counts = Object.fromEntries(["fixed", "open", "deferred"].map(kind => [kind, defects.filter(d => d.resolution.kind === kind).length]));
assert.deepEqual(counts, { fixed: 11, open: 3, deferred: 1 });
const linux = read("test-audit/final-repairs/linux-verification.json");
assert.equal(linux.reports["full-suite"].passed, 1746);
assert.equal(linux.reports["coverage-suite"].passed, 1746);
const completion = {
  complete: true,
  checks: [
    "Application commits 5834a4b and 518785a repair selected-memory identity and routing reset. Eleven defects are fixed, three remain open, and D-G3-001 remains DEFERRED. Evidence: test-audit/final-repairs/REVIEW.md.",
    "The final full suite completes 1,746 cases with zero unexpected failures or skips, including four retained expected failures. Evidence: test-audit/final-repairs/full-suite.json.",
    "Twenty cases were promoted by changing ten it.fails markers only. All assertions and v584 bytes remain unchanged. The focused 43-case run passes. Evidence: test-audit/final-repairs/marker-integrity.json and unit.json.",
    "All 31 application faults are killed at the accepted application digest and every restored run passes. Historical CI fault proofs remain at their recorded revisions. Evidence: test-audit/final-repairs/mutation-summary.json.",
    "All original declarations, current declarations and runtime cases reconcile under strict checks. Acceptance uses actual application commits and current source hashes. Evidence: test-audit/ledger.json and test-audit/reconciliation.json.",
    "Every previously KNOWN_DEFECT feature row was restated against ordinary results and fault evidence. The inventory remains 41 groups and 164 obligations. Evidence: test-audit/final-repairs/feature-restatus.json.",
    "Typecheck, lint and Knip exit 0; lint retains 23 warnings. Evidence: test-audit/final-repairs/static-checks.json.",
    "The four remaining expected failures reproduce as ordinary failures. Repaired cases receive credit only for ordinary passes and direct fault kills. Evidence: test-audit/final-repairs/open-ordinary.json.",
    `Linux/Node24.18.1 full-suite and coverage each pass all 1,746 cases. Coverage is ${linux.coverage.statements.pct}% statements, ${linux.coverage.branches.pct}% branches, ${linux.coverage.functions.pct}% functions and ${linux.coverage.lines.pct}% lines; unchanged thresholds pass. Application/test/config bytes match release 6.2.3. Evidence: test-audit/final-repairs/linux-verification.json and ${linux.runUrl}.`
  ],
  blockers: [
    {kind:"known_application_defects",description:"ADV-CTX-001 JSON key disclosure, D-DASH-001 stored project-name handler injection and ADV-FTS-001 lost-index recovery remain OPEN. D-G3-001 remains DEFERRED."},
    {kind:"hosted_runner_flake_risks",description:"Unchanged phase7b read tests require 100-memory reads below 100 ms and FTS below 50 ms. Hosted contention remains a flake risk; thresholds were not loosened."},
    {kind:"platform_limits",description:"Native VS Code, native Windows, live provider credentials, native keychain/scheduler behavior and physical network shares are not established by this QA pass. The earlier default Docker runner hit fixture ENOSPC; its historical tmpfs replay is not a new final-source run."}
  ],
  verification: [
    {name:"full-suite",exitCode:0,passed:1746,failed:0,expectedFailures:4,evidence:"test-audit/final-repairs/full-suite.json"},
    ...["full-suite", "coverage-suite"].map(name => ({name:`linux-${name}`,exitCode:0,passed:1746,failed:0,expectedFailures:4,evidence:"test-audit/final-repairs/linux-verification.json",runUrl:linux.runUrl})),
    ...read("test-audit/final-repairs/static-checks.json").map(check=>({...check,evidence:"test-audit/final-repairs/static-checks.json"}))
  ]
};
fs.writeFileSync("test-audit/completion.json", `${JSON.stringify(completion, null, 2)}\n`);
