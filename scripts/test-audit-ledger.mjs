import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const classes = ["STRONG", "WEAK", "HOLLOW", "COUPLED", "DEAD", "MISLABELED"];
const emptyCounts = () => Object.fromEntries(classes.map((name) => [name, 0]));
const inventory = read("test-audit/inventory.json");
const reviewFiles = ["wiring", "group1", "group2", "group3"].flatMap((group) => read(`test-audit/reviews/${group}.before.json`).files);
const reviews = new Map(reviewFiles.flatMap((file) => file.tests.map((test) => [`${file.path}:${test.line}`, test])));
const actionFiles = fs.readdirSync("test-audit/reviews").filter((file) => file.endsWith(".after.json")).sort();
const actions = [];
const additions = [];
for (const file of actionFiles) {
  const data = read(`test-audit/reviews/${file}`);
  actions.push(...(data.tests || data.actions || []).map((row) => ({ ...row, artifact: file })));
  additions.push(...(data.additionalTests || []).map((row) => ({ ...row, artifact: file })));
}
const actionById = new Map();
for (const action of actions) {
  if (actionById.has(action.beforeId)) throw new Error(`Duplicate action: ${action.beforeId}`);
  actionById.set(action.beforeId, action);
}

const experiments = new Map();
for (const file of fs.readdirSync("test-audit/mutations").filter((file) => file.endsWith(".results.json")).sort()) {
  const data = read(`test-audit/mutations/${file}`);
  for (const record of Array.isArray(data) ? data : data.results || []) {
    const kind = record.kind || "fault-injection";
    const artifact = record.artifact || file;
    const stage = record.phase || (/before|survival/.test(artifact) ? "before" : "after");
    const tests = (record.mutated?.tests || []).map(({ file, name, status }) => ({ file, name, status }));
    const identity = JSON.stringify([record.id, record.file, kind, stage, tests]);
    const key = createHash("sha256").update(identity).digest("hex").slice(0, 16);
    const existing = experiments.get(key);
    if (existing) {
      existing.evidence.push(file);
      continue;
    }
    experiments.set(key, { ...record, key, kind, stage, evidence: [file] });
  }
}
const records = [...experiments.values()];
const valid = (record) => record.applicationRestored && record.before?.exitCode === 0
  && record.before.tests.length > 0 && record.restored?.exitCode === 0
  && record.restored.tests.length > 0 && !record.outcome.startsWith("invalid");
const namesOf = (action) => action.afterNames || (action.name ? [action.name] : []);
const fileOf = (action) => action.file || action.beforeId?.replace(/:\d+$/, "");
const proofRows = [...actions, ...additions].map((action) => {
  const relevant = records.filter((record) => (action.mutationIds || []).includes(record.id) && valid(record));
  const killed = new Set(relevant.filter((record) => record.outcome === "killed").flatMap((record) => record.killedBy
    .filter((test) => !fileOf(action) || test.file === fileOf(action) || action.afterTests?.some((entry) => entry.file === test.file && entry.name === test.name))
    .map((test) => test.name)));
  const originalNames = action.beforeNames || (action.beforeName ? [action.beforeName] : []);
  const survival = originalNames.length > 0 && originalNames.every((name) => relevant.some((record) =>
    record.stage === "before" && record.mutated.tests.some((test) => test.file === fileOf(action) && test.status === "passed"
      && (test.name === name || test.name.endsWith(` ${name}`)))));
  return {
    beforeId: action.beforeId || null,
    artifact: action.artifact,
    action: action.action,
    beforeClassification: action.beforeClassification || null,
    survivingMutation: survival,
    structuralReason: action.structuralReason || null,
    mutationIds: action.mutationIds || [],
    missingKillNames: ["rewritten", "expected_failure", "added"].includes(action.action)
      ? namesOf(action).filter((name) => !killed.has(name)) : [],
  };
});
const sourceRows = inventory.files.flatMap((file) => file.tests.map((test) => {
  const review = reviews.get(test.id);
  if (!review || !classes.includes(review.classification)) throw new Error(`Missing review: ${test.id}`);
  const action = actionById.get(test.id);
  return {
    id: test.id, file: file.path, name: test.name,
    beforeClassification: action?.beforeClassification || review.classification,
    beforeEvidence: review.evidence,
    action: action?.action || "pending",
    afterClassification: action?.action === "deleted" ? null : action?.afterClassification || action?.classification || null,
    afterNames: action ? namesOf(action) : [],
    evidence: action?.evidence || review.evidence,
    mutationIds: action?.mutationIds || [],
    structuralReason: action?.structuralReason || null,
  };
}));
const counts = emptyCounts();
for (const row of sourceRows) counts[row.beforeClassification]++;
const afterOriginalCounts = emptyCounts();
for (const row of sourceRows) if (row.afterClassification) afterOriginalCounts[row.afterClassification]++;

const suiteFile = process.argv[2];
const runtimeRows = suiteFile ? read(suiteFile).testResults.flatMap((file) => file.assertionResults.map((test) => ({
  file: path.relative(process.cwd(), file.name), name: test.fullName, status: test.status,
}))) : [];
const caseActions = [...actions, ...additions];
for (const test of runtimeRows) {
  const matches = caseActions.filter((action) => action.action !== "deleted" && namesOf(action).includes(test.name)
    && (fileOf(action) === test.file || action.afterTests?.some((entry) => entry.file === test.file && entry.name === test.name)));
  test.actions = matches.map((action) => action.beforeId || `added:${action.artifact}`);
  const classifications = [...new Set(matches.map((action) => action.afterClassification || action.classification).filter(Boolean))];
  test.classification = classifications.length === 1 ? classifications[0] : matches.length ? "CONFLICT" : "UNMAPPED";
  test.mutationIds = [...new Set(matches.flatMap((action) => action.mutationIds || []))];
  test.killedByProof = records.some((record) => valid(record) && record.outcome === "killed"
    && test.mutationIds.includes(record.id) && record.killedBy.some((entry) => entry.name === test.name && entry.file === test.file));
}

const mutantGroups = new Map();
for (const record of records.filter((record) => record.kind === "fault-injection" && record.stage === "after" && valid(record))) {
  const key = `${record.file}:${record.id}`;
  const row = mutantGroups.get(key) || { id: record.id, file: record.file, outcome: "survived", experiments: [] };
  if (record.outcome === "killed") row.outcome = "killed";
  row.experiments.push(record.key);
  mutantGroups.set(key, row);
}
const mutants = [...mutantGroups.values()];
const killed = mutants.filter((row) => row.outcome === "killed").length;
const result = {
  schemaVersion: 1,
  sourceCounts: { before: counts, afterOriginalDeclarations: afterOriginalCounts,
    deleted: sourceRows.filter((row) => row.action === "deleted").length,
    pending: sourceRows.filter((row) => row.action === "pending").length },
  mutationScore: { method: "targeted-manual", unit: "distinct application file and mutation ID after test repair",
    tested: mutants.length, killed, survived: mutants.length - killed,
    percent: mutants.length ? Math.round(killed / mutants.length * 10000) / 100 : null,
    limitations: "Selected faults only; not an exhaustive or random mutation score. Before-test experiments and inverse defect repair probes are excluded. Repeated copies of experiment evidence are deduplicated." },
  issues: {
    missingCaseKills: proofRows.filter((row) => row.missingKillNames.length),
    missingSurvival: proofRows.filter((row) => ["WEAK", "HOLLOW"].includes(row.beforeClassification) && !row.survivingMutation && !row.structuralReason),
    unmappedRuntime: runtimeRows.filter((row) => row.classification === "UNMAPPED"),
    conflictingRuntime: runtimeRows.filter((row) => row.classification === "CONFLICT"),
  },
  sourceRows, additions, runtimeRows, proofs: proofRows, mutants, experiments: records,
};
write("test-audit/ledger.json", result);
process.stdout.write(`${sourceRows.length} original declarations; ${result.sourceCounts.pending} pending actions; ${runtimeRows.length} runtime cases\n`);
process.stdout.write(`${result.issues.missingCaseKills.length} missing kills; ${result.issues.missingSurvival.length} missing survival proofs; ${result.issues.unmappedRuntime.length} unmapped runtime cases\n`);
if (process.argv.includes("--strict") && (result.sourceCounts.pending || Object.values(result.issues).some((rows) => rows.length))) process.exitCode = 1;
