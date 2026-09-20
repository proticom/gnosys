import fs from "node:fs";

const inventory = JSON.parse(fs.readFileSync("test-audit/inventory.json", "utf8"));
const reviews = ["wiring", "group1", "group2", "group3"].flatMap((group) =>
  JSON.parse(fs.readFileSync(`test-audit/reviews/${group}.before.json`, "utf8")).files,
);
const actions = fs.readdirSync("test-audit/reviews")
  .filter((name) => name.endsWith(".after.json"))
  .flatMap((name) => JSON.parse(fs.readFileSync(`test-audit/reviews/${name}`, "utf8")).tests);
const actionById = new Map(actions.map((action) => [action.beforeId, action]));
const reviewByPath = new Map(reviews.map((file) => [file.path, file]));
const classes = ["STRONG", "WEAK", "HOLLOW", "COUPLED", "DEAD", "MISLABELED"];
const counts = Object.fromEntries(classes.map((name) => [name, 0]));
const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const rows = [];

for (const file of inventory.files) {
  const review = reviewByPath.get(file.path);
  if (!review || review.tests.length !== file.tests.length) throw new Error(`Incomplete review: ${file.path}`);
  for (const test of file.tests) {
    const finding = review.tests.find((entry) => entry.line === test.line);
    if (!finding || !classes.includes(finding.classification) || !finding.evidence) throw new Error(`Invalid review: ${test.id}`);
    counts[finding.classification]++;
    const action = actionById.get(test.id);
    rows.push(`| ${escape(test.id)} | ${escape(test.name)} | ${finding.classification} | ${escape(action?.afterClassification || action?.classification || "Pending")} | ${escape(finding.evidence)} | ${escape(action?.action || `Planned: ${finding.action}`)} |`);
  }
}

const mutations = fs.readdirSync("test-audit/mutations")
  .filter((name) => name.endsWith(".results.json"))
  .flatMap((name) => JSON.parse(fs.readFileSync(`test-audit/mutations/${name}`, "utf8")).results.map((result) => ({ ...result, evidence: name })));
const features = JSON.parse(fs.readFileSync("test-audit/features.json", "utf8"));
const featureList = Array.isArray(features) ? features : features.features;
const collection = JSON.parse(fs.readFileSync("test-audit/collection.json", "utf8"));
const defects = fs.existsSync("test-audit/defects.json") ? JSON.parse(fs.readFileSync("test-audit/defects.json", "utf8")) : [];
const externalRows = collection.test_cases_outside_vitest.map((test) =>
  `| ${escape(test.path)} | ${escape(test.name)} | ${test.classification} | ${actionById.get(test.id)?.afterClassification || "Pending"} | ${escape(test.reason)} | ${escape(actionById.get(test.id)?.action || test.action)} |`,
);
const mutationRows = mutations.map((mutation) =>
  `| ${mutation.id} | ${mutation.file} | ${mutation.outcome} | ${mutation.killedBy.length} | [${mutation.evidence}](test-audit/mutations/${mutation.evidence}) |`,
);
const text = `# Test audit

- [x] Isolate committed baseline on \`test-audit\`.
- [x] Run Vitest and Docker setup baselines.
- [x] Inventory features independently of tests.
- [x] Review all 296 TypeScript files, 1,748 declaration sites, and eight external shell/CI cases.
- [x] Replay and correct inline CI scenarios.
- [ ] Prove all proposed WEAK/HOLLOW ratings and critical features with mutations.
- [ ] Rewrite deficient tests and fill feature gaps in independently verified units.
- [ ] Prove every new or rewritten test against broken and restored code.
- [ ] Merge reviewed test changes, run final suites, and verify no application changes.
- [ ] Reconcile final counts, feature protection, and evidence.

The baseline passes, but source review found substantial gaps in behavior protection. Of 1,748 TypeScript test declarations, reviewers rated 1,076 STRONG, 294 WEAK, 45 HOLLOW, 285 COUPLED, one DEAD, and 47 MISLABELED. These are provisional audit ratings: WEAK and nonstructural HOLLOW ratings require surviving mutation evidence before the verdict is final. The rewritten web and CLI contracts have passing mutation proofs. Five Docker setup checks and both CI scenarios survived broken application behavior before correction and now reject it. New VS Code extension tests expose four confirmed defects and retain them as expected failures. The audit remains in progress.

## Counts before and after

| Classification | Before source review | After |
| --- | ---: | --- |
${classes.map((name) => `| ${name} | ${counts[name]} | Pending full verification |`).join("\n")}

The unit above is a source test declaration, including loop-generated test families. Vitest collected 1,802 runtime cases. Final runtime classification totals will be reconciled separately. The eight shell/CI cases are listed in the table below and excluded from TypeScript counts.

The committed baseline passed 296 files, 1,801 tests, one skipped, and zero failures in 109.83 seconds. The Docker setup suite passed six cases in 11.12 seconds. The original CI scenarios passed in 1.844 seconds and 0.478 seconds, despite the isolation assertions being incomplete. After web, CLI, external-scenario, and extension changes, 203 files pass with 1,742 tests passed (including four expected failures), one skipped, zero unexpected failures, in 80.235 seconds. Build, TypeScript, and Knip checks passed. Lint exited zero with 21 existing warnings; the rewritten web/CLI tests pass their targeted lint check. See [baseline JSON](test-audit/evidence/baseline.json), [setup log](test-audit/evidence/setup-baseline.log), and [latest full suite](test-audit/evidence/external-extension-full-suite.json).

## Defects found

${defects.length ? defects.map((defect) => `### ${defect.id}: ${defect.title}\n\n${defect.evidence}\n\nReproduce after building with \`${defect.reproduction}\`. Expected \`${defect.expected}\`; observed \`${defect.actual}\`.\n\n${defect.status}`).join("\n\n") : "No application defect has yet been confirmed."}

## Feature protection matrix

The independent inventory contains ${featureList.length} feature groups, 132 checked source references, and 164 success, failure, boundary, and permission obligations. See [feature inventory](test-audit/features.json). Protection mapping is pending the verified fixes. Passing source-string tests do not count as feature protection.

## Mutation results

| Mutation | Application target | Result | Cases killed | Evidence |
| --- | --- | --- | ---: | --- |
${mutationRows.join("\n")}

Before each experiment, selected tests pass. After each experiment, exact original application bytes are restored and selected tests pass again. The runner checks a digest of tracked application files. A build or harness failure does not count as a killed mutation. The initial source-path mutation moved \`setup remote\` to the root while preserving all leaf names; the original test survived. The original web tests also survived a skipped index write and wrong corrupt-file byte size.

## Per-file and per-test review

Every original TypeScript declaration and every external logical test appears below. Evidence describes the original test. Pending actions are proposals, not completed fixes. Exact line numbers refer to baseline revision \`203c4e7\`. Individual reviewer records and completed-action records live in [test-audit/reviews](test-audit/reviews).

| File and line | Test | Before | After | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
${externalRows.join("\n")}

## Repeated patterns

- Source-string checks verify spelling and import layout without invoking the advertised command. The command review found 184 coupled declarations in 96 files.
- Loose count, truthiness, and existence checks miss wrong records and incomplete artifacts. These ratings remain provisional until mutation experiments demonstrate survival.
- Tests that compute expectations through the same code, compare output with itself, or validate only their fixtures lack an independent behavior oracle.
- Conditional assertions and assertions inside possibly empty loops can accept no result at all.
- Some tests manually perform both sides of a write and call that synchronization. That does not exercise the synchronization path.
- The inline CI isolation scenarios print search results without asserting them. The network-share job uses an ordinary temporary directory without a network mount.

## Scope, assumptions, and blockers

The workspace root is not a Git repository. This audit targets \`gnosys-public\`, the main \`proticom/gnosys\` package, at committed revision \`203c4e7e488cea66bfd9a3ad687d9d1dda309d16\` (6.2.1). It uses an isolated \`test-audit\` worktree. The original checkout has substantial uncommitted application/test changes; those remain untouched and are outside this audit. Other repositories and existing worktrees are outside scope.

Node 22.17.1 runs the suite. Installed Vitest 4.1.9, TypeScript 5.9.3, tsx 4.22.4, better-sqlite3 11.10.0, and MCP SDK 1.29.0 match the committed lockfile. Each mutation worktree builds its own \`dist/\`.

The first sandboxed baseline was stopped after a direct loopback-listener probe returned \`EPERM\`. Re-running with local HTTP/socket access produced the passing baseline. Docker 29.4.3 runs setup tests without container networking or host mounts. The baseline encrypted-PDF test is skipped because its fixture is absent; a deterministic fixture and passing replacement are verified in the group1 checkpoint, pending integration. Remote services and cross-platform behavior will be recorded as blocked where unavailable.
`;
fs.writeFileSync("TEST_AUDIT.md", text);
process.stdout.write(`Reconciled ${reviews.length} files and ${rows.length} declarations; ${mutations.length} mutation experiments.\n`);
