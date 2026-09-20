import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const ledger = read("test-audit/ledger.json");
const previous = read("test-audit.json");
const inventory = read("test-audit/inventory.json");
const current = read("test-audit/current-inventory.json");
const features = read("test-audit/features.json").features;
const collection = read("test-audit/collection.json");
const defects = read("test-audit/defects.json");
const coverage = fs.existsSync("test-audit/feature-coverage.json") ? read("test-audit/feature-coverage.json") : [];
const completion = fs.existsSync("test-audit/completion.json") ? read("test-audit/completion.json") : { complete: false, checks: [], blockers: [] };
const suitePath = process.argv[2] || "test-audit/evidence/integrated-checkpoints-full-suite.json";
const suite = read(suitePath);
const classes = ["STRONG", "WEAK", "HOLLOW", "COUPLED", "DEAD", "MISLABELED"];
const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (file) => `[${file}](${file})`;
const done = completion.complete && ledger.sourceCounts.pending === 0 && Object.values(ledger.issues).every((rows) => rows.length === 0);
if (completion.complete && !done) throw new Error("Completion requested with unresolved evidence");
const originalCount = ledger.sourceRows.length;
const currentCount = current.files.reduce((sum, file) => sum + file.tests.length, 0);
const beforeCounts = ledger.sourceCounts.before;
const deficient = originalCount - beforeCounts.STRONG;
const afterRuntimeCounts = Object.fromEntries(classes.map((name) => [name, ledger.runtimeRows.filter((row) => row.classification === name).length]));
const latestFullSuite = {
  files: suite.testResults.length, passed: suite.numPassedTests, failed: suite.numFailedTests,
  skipped: suite.numPendingTests, expectedFailureRegressions: defects.length,
  durationSeconds: Math.round((Math.max(...suite.testResults.map((file) => file.endTime)) - suite.startTime) / 10) / 100,
  evidence: suitePath,
};
const external = collection.test_cases_outside_vitest.map((test) => {
  const action = read("test-audit/reviews/external.after.json").tests.find((row) => row.beforeId === test.id);
  return { ...test, afterClassification: action?.afterClassification || null, action: action?.action || "pending", mutationIds: action?.mutationIds || [] };
});
const unresolved = ledger.sourceCounts.pending;
const verdict = `The baseline was green, but ${deficient} of ${originalCount} source test declarations failed the behavior standard in the reviewed classification ledger. Corrected tests expose ${defects.length} application defects, retained as expected failures because this audit changes no application code. The latest full suite passes ${latestFullSuite.passed} runtime cases with ${latestFullSuite.failed} unexpected failures and ${latestFullSuite.skipped} skipped tests. ${done ? "All test actions, mutation proofs, and feature mappings are reconciled below." : `The audit remains in progress: ${unresolved} original declarations still await final action records, and the feature mapping is not complete.`} See ${link("test-audit/ledger.json")} and ${link(suitePath)}.`;
const totals = { before: beforeCounts, after: done ? Object.fromEntries(classes.map((name) => [name, name === "STRONG" ? currentCount : 0])) : null };
write("test-audit.json", {
  schemaVersion: 1, status: done ? "complete" : "in_progress", mode: "audit-and-fix", baseCommit: previous.baseCommit,
  classificationUnit: "source_test_declarations", classificationCounts: totals,
  originalDeclarationOutcomes: ledger.sourceCounts,
  runtimeClassificationCounts: done ? { after: afterRuntimeCounts } : null,
  mutationScore: done ? ledger.mutationScore : null,
  provisionalMutationScore: done ? undefined : ledger.mutationScore,
  baseline: previous.baseline, inventory: previous.inventory, latestFullSuite,
  currentInventory: { files: current.files.length, testDeclarations: currentCount, runtimeCases: ledger.runtimeRows.length },
  progress: { reviewedFiles: inventory.files.length, testDeclarationsReviewed: originalCount,
    originalDeclarationsResolved: originalCount - unresolved, featureGroups: features.length,
    missingCaseKills: ledger.issues.missingCaseKills.length, missingSurvivalProofs: ledger.issues.missingSurvival.length,
    unmappedRuntimeCases: ledger.issues.unmappedRuntime.length },
  featureProtection: coverage, externalTests: external.map(({ id, name, classification, afterClassification, mutationIds }) => ({ id, name, beforeClassification: classification, afterClassification, mutationIds })),
  blocked: completion.blockers, applicationCodeChanged: false, defects,
});
const featureRows = features.flatMap((feature) => Object.entries(feature.obligations).flatMap(([kind, obligations]) => obligations.map((obligation) => {
  const matching = coverage.filter((row) => row.featureId === feature.id && row.obligationKind === kind && row.obligation === obligation);
  const tests = matching.flatMap((row) => row.tests || []);
  const status = matching.length ? matching.map((row) => row.status || "PARTIAL").join(", ") : "PENDING";
  return `| ${feature.id} ${escape(feature.name)} | ${kind} | ${escape(obligation)} | ${status} | ${tests.map((test) => `${escape(test.file)}: ${escape(test.name)}`).join("; ")} | ${matching.map((row) => escape(row.limitations)).join("; ")} |`;
})));
const mutationRows = ledger.experiments.map((record) => `| ${escape(record.id)} | ${escape(record.file)} | ${record.kind} | ${record.stage} | ${record.outcome} | ${record.killedBy?.length || 0} | ${record.evidence.map((file) => link(`test-audit/mutations/${file}`)).join(", ")} |`);
const testRows = ledger.sourceRows.map((row) => `| ${escape(row.id)} | ${escape(row.name)} | ${row.beforeClassification} | ${row.action === "deleted" ? "Deleted" : row.afterClassification || "Pending"} | ${escape(row.evidence)}${row.structuralReason ? ` ${escape(row.structuralReason)}` : ""} | ${row.action}; ${row.mutationIds.map(escape).join(", ")} |`);
const additionalRows = ledger.additions.map((row) => `| ${escape(row.file || "See runtime table")} | ${escape((row.afterNames || [row.name]).join("; "))} | Added | ${row.afterClassification || row.classification || "STRONG"} | ${escape(row.evidence || row.proof)} | ${row.action}; ${(row.mutationIds || []).map(escape).join(", ")} |`);
const runtimeRows = ledger.runtimeRows.map((row) => `| ${escape(row.file)} | ${escape(row.name)} | ${row.classification} | ${row.status} | ${row.killedByProof ? "Killed recorded fault or inverse defect probe" : "See source review"} |`);
const checklist = [
  [true, "Isolate the committed baseline on test-audit."],
  [true, "Run baseline Vitest, Docker, and CI scenarios."],
  [true, "Inventory features independently and review every original test file."],
  [unresolved === 0, "Complete all original test actions."],
  [ledger.issues.missingCaseKills.length === 0 && ledger.issues.missingSurvival.length === 0 && unresolved === 0, "Reconcile surviving faults and every changed/new test kill."],
  [done, "Complete the feature protection matrix and fill unprotected feature gaps."],
  [done, "Run final checks, confirm no application changes, and commit all audit work."],
];
fs.writeFileSync("TEST_AUDIT.md", `# Test audit\n\n${checklist.map(([complete, label]) => `- [${complete ? "x" : " "}] ${label}`).join("\n")}\n\n${verdict}

## Counts before and after

| Classification | Before source declarations | After source declarations |
| --- | ---: | ---: |
${classes.map((name) => `| ${name} | ${beforeCounts[name]} | ${done ? totals.after[name] : "Pending"} |`).join("\n")}

The baseline contains ${originalCount} source declarations in ${inventory.files.length} TypeScript files, expanded by Vitest into ${previous.inventory.collectedCases} runtime cases. The current inventory contains ${currentCount} source declarations in ${current.files.length} files. Deletions and many-to-one rewrites are counted separately in ${link("test-audit/ledger.json")}; deleted tests are not counted as DEAD tests. Eight shell/CI logical cases are reported separately below.

The baseline passed ${previous.baseline.passed} tests, with ${previous.baseline.skipped} skipped and zero failures, in ${previous.baseline.durationSeconds} seconds. Docker passed six cases in ${previous.baseline.setup.durationSeconds} seconds. The original inline CI scenarios passed despite incomplete search assertions. The latest full suite passed ${latestFullSuite.passed} tests, including ${defects.length} expected-failure regressions, with ${latestFullSuite.failed} unexpected failures and ${latestFullSuite.skipped} skipped, in ${latestFullSuite.durationSeconds} seconds. See ${link("test-audit/evidence/baseline.json")} and ${link(suitePath)}.

## Defects found

${defects.map((defect) => `### ${defect.id}: ${defect.title}\n\n${defect.evidence}\n\nExpected: ${defect.expected}\n\nObserved: ${defect.actual}\n\nReproduce after building with \`${defect.reproduction}\`. ${defect.status}\n\nEvidence: ${(defect.evidenceFiles || []).map(link).join(", ")}.`).join("\n\n")}

## Feature protection matrix

The inventory was derived from README, documentation, CLI/MCP registration, and exported modules before reading tests. Its ${features.length} feature groups have 164 success, failure, boundary, and permission obligations. A passing expected-failure regression detects a known defect; it does not establish correct application behavior. Help contracts protect registration and documentation only. See ${link("test-audit/features.json")} for source references.

| Feature | Path | Obligation | Protection | Strong tests | Limits |
| --- | --- | --- | --- | --- | --- |
${featureRows.join("\n")}

## Mutation results

${done ? `The selected post-repair fault set killed ${ledger.mutationScore.killed}/${ledger.mutationScore.tested} distinct mutations (${ledger.mutationScore.percent}%).` : "Mutation reconciliation remains in progress."} This is a targeted manual score, not a full-program or random mutation score. Original-test experiments and inverse repair probes for known defects are excluded. A mutation that causes only a build or harness failure does not count as killed. Repeated copies of evidence are deduplicated in ${link("test-audit/ledger.json")}.

The mutation runner restores exact original application bytes after each experiment, verifies the application digest, and reruns the selected tests. Every completed changed/new test has a named failing assertion in its proof record. The report distinguishes inverse repair probes: repairing a known bug temporarily must make its expected-failure test report an unexpected pass.

| Mutation | Target | Kind | Test stage | Result | Failing cases | Evidence |
| --- | --- | --- | --- | --- | ---: | --- |
${mutationRows.join("\n")}

## Per-file and per-test review

Every original declaration appears below, with baseline line numbers at revision 203c4e7. Expanded runtime cases follow. ${done ? "All actions are complete." : "Pending entries are unfinished work, not accepted test protection."}

| File and baseline line | Test | Before | After | Evidence | Action and mutation IDs |
| --- | --- | --- | --- | --- | --- |
${testRows.join("\n")}
${external.map((row) => `| ${escape(row.path)} | ${escape(row.name)} | ${row.classification} | ${row.afterClassification || "Pending"} | ${escape(row.reason)} | ${row.action}; ${row.mutationIds.join(", ")} |`).join("\n")}
${additionalRows.join("\n")}

### Current runtime cases

| File | Runtime name | Classification | Runner status | Proof |
| --- | --- | --- | --- | --- |
${runtimeRows.join("\n")}

## Repeated patterns

- Source-string checks accepted broken command placement and skipped writes. The replacement CLI contracts check literal command paths; handler behavior is covered separately.
- Type, existence, and broad count assertions accepted wrong records, truncated artifacts, and wrong metadata. Replacements assert literal results and persisted content.
- Fixture-only tests and tests that manually performed both writes did not exercise the advertised workflow. Duplicates were deleted with named replacement coverage.
- Application mocks bypassed the logic under test. Replacements use real application modules and confine doubles to external boundaries such as network, OS commands, terminal input, and the model runtime.
- Conditional assertions and empty loops accepted missing outputs. Replacements assert the expected result set before inspecting its contents.
- The CI search-isolation results were printed without assertions. The renamed local-storage scenario never mounted a network share; its test now claims only the local behavior it exercises.

## Scope, verification, and blockers

This audit targets the committed gnosys-public package at ${previous.baseCommit} (6.2.1), in an isolated test-audit worktree. The workspace root is not a repository. The original checkout has unrelated uncommitted changes and remains outside this audit. No push or PR is authorized.

Node22.17.1, Vitest4.1.9, TypeScript5.9.3, tsx4.22.4, better-sqlite3 11.10.0, and MCP SDK1.29.0 match the installed baseline dependencies. CI collects src/**/*.test.ts on Linux and macOS; runner exclusions cover dist and node_modules. Coverage exclusions are distinct from test collection and are not evidence of protection. Docker setup and the two CI scenarios run in separate jobs. The npm test, coverage, and watch commands now build before starting, so CLI subprocess tests begin with current compiled artifacts.

The sandbox initially rejected loopback listeners with EPERM. Authorized local HTTP/PTY runs pass. Docker setup tests run without networking or host mounts. Real provider credentials, operating-system integration, and physical network-share behavior are reported as unverified where boundary doubles or temporary local directories are used.

${completion.checks.map((check) => `- ${escape(check)}`).join("\n")}
${completion.blockers.length ? completion.blockers.map((blocker) => `- ${escape(typeof blocker === "string" ? blocker : blocker.description)}`).join("\n") : "Final platform/service blocker reconciliation remains pending."}
`);
process.stdout.write(`Report updated: ${originalCount - unresolved}/${originalCount} action records; ${latestFullSuite.passed} latest runtime passes.\n`);
