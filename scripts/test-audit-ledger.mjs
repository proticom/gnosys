import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const applicationPaths = ["src", ":!src/test", "prompts", "extensions"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const caseKey = ({ file, name }) => JSON.stringify([file, name]);
const relativeFile = (file) => {
  if (!path.isAbsolute(file)) return file.replaceAll("\\", "/");
  const local = path.relative(process.cwd(), file).replaceAll("\\", "/");
  const marker = file.replaceAll("\\", "/").lastIndexOf("/src/");
  return local.startsWith("../") && marker >= 0 ? file.slice(marker + 1).replaceAll("\\", "/") : local;
};
const reportCases = (report) => report.testResults.flatMap((suite) => suite.assertionResults.map((test) => ({
  file: relativeFile(suite.name), name: test.fullName, status: test.status,
})));
const directFaultFor = (record, test, { allowCi = false } = {}) => (record.kind === "fault-injection" || allowCi && record.kind === "ci-fault-injection") && record.stage === "after"
  && record.outcome === "killed" && record.applicationRestored && record.before?.exitCode === 0 && record.restored?.exitCode === 0
  && Number.isInteger(record.mutated?.exitCode) && record.mutated.exitCode > 0 && !record.mutated.error
  && ["before", "restored"].every((phase) => record[phase].tests.some((entry) => caseKey(entry) === caseKey(test) && entry.status === "passed"))
  && record.mutated.tests.some((entry) => caseKey(entry) === caseKey(test) && entry.status === "failed"
    && !(entry.failures || []).some((message) => /Expect test to fail|expected.*to fail.*passed/i.test(message)))
  && record.killedBy?.some((entry) => caseKey(entry) === caseKey(test));

export function verifyApplicationAcceptance(manifest) {
  const result = { baseCommit: null, applicationFixRef: manifest.applicationFixRef, applicationFixCommits: manifest.applicationFixCommits, applicationDigest: null, issues: [] };
  const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-audit-acceptance-"));
  try {
    const commits = manifest.applicationFixCommits;
    if (!Array.isArray(commits) || commits.some((commit) => typeof commit !== "string" || !/^[a-f0-9]{40}$/.test(commit))
      || new Set(commits).size !== commits.length || !/^[a-f0-9]{40}$/.test(manifest.applicationFixRef || "")) {
      throw new Error("applicationFixRef and distinct applicationFixCommits must be full commit IDs");
    }
    result.baseCommit = git(["rev-parse", "ec19554^{commit}"]).trim();
    const ref = git(["rev-parse", `${manifest.applicationFixRef}^{commit}`]).trim();
    if (ref !== manifest.applicationFixRef) throw new Error("applicationFixRef must identify a commit directly");
    git(["merge-base", "--is-ancestor", result.baseCommit, ref]);
    const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, "index") };
    git(["read-tree", result.baseCommit], { env });
    for (const commit of commits) {
      git(["merge-base", "--is-ancestor", commit, ref]);
      const parents = git(["rev-list", "--parents", "-n", "1", commit]).trim().split(" ");
      if (parents.length !== 2) throw new Error(`Fix ${commit} must have one parent`);
      const patch = git(["diff", "--binary", "--full-index", parents[1], commit, "--", ...applicationPaths]);
      if (!patch) throw new Error(`Fix ${commit} has no application changes`);
      git(["apply", "--cached", "--binary", "--whitespace=nowarn", "-"], { env, input: patch });
    }
    const unexplained = git(["diff", "--cached", "--name-only", ref, "--", ...applicationPaths], { env }).trim();
    if (unexplained) result.issues.push({ kind: "unlistedApplicationChanges", paths: unexplained.split("\n") });
    const tree = git(["ls-tree", "-rz", ref, "--", "src", "prompts", "extensions"]).split("\0").filter(Boolean)
      .map((entry) => { const [mode, type, object, file] = entry.match(/^(\d+) (\S+) (\S+)\t([\s\S]+)$/).slice(1); return { mode, type, object, file }; })
      .filter((entry) => !entry.file.startsWith("src/test/"));
    const expected = new Set(tree.map((entry) => entry.file));
    const working = [...new Set([
      ...git(["ls-files", "-z", "--", ...applicationPaths]).split("\0"),
      ...git(["ls-files", "--others", "-z", "--", ...applicationPaths]).split("\0"),
    ].filter(Boolean))];
    for (const file of working) if (!expected.has(file)) result.issues.push({ kind: "unexpectedApplicationFile", file });
    const format = git(["rev-parse", "--show-object-format"]).trim();
    const digestParts = [];
    for (const entry of tree) {
      let stat;
      try { stat = fs.lstatSync(entry.file); } catch { result.issues.push({ kind: "missingApplicationFile", file: entry.file }); continue; }
      const mode = stat.isSymbolicLink() ? "120000" : stat.isFile() ? stat.mode & 0o111 ? "100755" : "100644" : "unsupported";
      const bytes = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(entry.file)) : stat.isFile() ? fs.readFileSync(entry.file) : Buffer.alloc(0);
      const object = createHash(format).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      if (mode !== entry.mode || object !== entry.object) result.issues.push({ kind: "applicationBytesOrModeMismatch", file: entry.file });
      if (!entry.file.endsWith(".test.ts")) digestParts.push(`${entry.file}\0${bytes.toString("base64")}`);
    }
    result.applicationDigest = sha256(digestParts.join("\0"));
  } catch (error) {
    result.issues.push({ kind: "invalidApplicationAcceptance", message: error.message });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  return result;
}

export function verifyDefectAcceptance({ records, runtimeRows, suiteFile }) {
  const manifestPath = "test-audit/adversarial/acceptance.json";
  if (!fs.existsSync(manifestPath)) return null;
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const defectsText = fs.readFileSync("test-audit/defects.json", "utf8");
  const defects = JSON.parse(defectsText);
  const current = JSON.parse(fs.readFileSync("test-audit/current-inventory.json", "utf8"));
  const reconciliation = fs.existsSync("test-audit/reconciliation.json") ? JSON.parse(fs.readFileSync("test-audit/reconciliation.json", "utf8")) : null;
  const reconciled = reconciliation?.complete && reconciliation.allCurrentClassificationsStrong && suiteFile
    && path.resolve(reconciliation.evidence.runtime) === path.resolve(suiteFile);
  const application = verifyApplicationAcceptance(manifest);
  const issues = { applicationAcceptance: application.issues, invalidDefectResolutions: [], missingFixedDefectFaults: [], missingOrdinaryDefectEvidence: [] };
  const cases = [];
  const seen = new Set();
  const receipt = manifest.ordinaryRun;
  let freshRun = false;
  try {
    freshRun = !!suiteFile && path.resolve(receipt.path) === path.resolve(suiteFile)
      && receipt.sha256 === sha256(fs.readFileSync(suiteFile))
      && receipt.applicationDigest === application.applicationDigest && application.issues.length === 0;
  } catch { /* Missing receipts produce explicit per-defect issues below. */ }
  for (const defect of defects) {
    const resolution = defect.resolution;
    if (!resolution || !["open", "fixed", "deferred"].includes(resolution.kind) || !Array.isArray(resolution.cases) || !resolution.cases.length
      || (resolution.kind === "deferred" && !resolution.reason?.trim()) || (defect.id === "D-G3-001" && resolution.kind !== "deferred")) {
      issues.invalidDefectResolutions.push({ defectId: defect.id, reason: "Explicit resolution, exact cases and deferred reason are required; D-G3-001 remains deferred" });
      continue;
    }
    if (resolution.kind === "fixed" && (!Array.isArray(resolution.fixCommits) || !resolution.fixCommits.length
      || resolution.fixCommits.some((commit) => !manifest.applicationFixCommits?.includes(commit)))) {
      issues.invalidDefectResolutions.push({ defectId: defect.id, reason: "Fixed defect must reference approved fix commits" });
    }
    let ordinaryCases = [];
    try { ordinaryCases = reportCases(JSON.parse(fs.readFileSync(resolution.ordinaryEvidence, "utf8"))); } catch { /* Report absence is recorded for each exact case. */ }
    for (const test of resolution.cases) {
      if (!test || typeof test.file !== "string" || typeof test.name !== "string" || seen.has(caseKey(test))) {
        issues.invalidDefectResolutions.push({ defectId: defect.id, reason: "Invalid or duplicate exact case", ...test });
        continue;
      }
      seen.add(caseKey(test));
      const file = current.files.find((entry) => entry.path === test.file);
      const declarations = reconciled ? reconciliation.currentDeclarations.filter((entry) => entry.file === test.file
        && entry.runtimeCases.some((runtime) => runtime.name === test.name)) : [];
      let sourceCurrent = false;
      try { sourceCurrent = file?.sha256 === sha256(fs.readFileSync(test.file)); } catch { /* A missing source cannot prove a case. */ }
      const declaration = declarations.length === 1 ? declarations[0] : null;
      const sourceDeclaration = file?.tests.find((entry) => entry.id === declaration?.id);
      sourceCurrent = sourceCurrent && sourceDeclaration?.declaration === declaration?.declaration;
      const expectedFailure = !!declaration && /\bfails\b/.test(declaration.declaration);
      const fixed = resolution.kind === "fixed";
      const ordinaryVerified = sourceCurrent && declaration && ordinaryCases.some((entry) => caseKey(entry) === caseKey(test) && entry.status === (fixed ? "passed" : "failed"))
        && runtimeRows.some((entry) => caseKey(entry) === caseKey(test) && entry.status === "passed")
        && (fixed ? !expectedFailure && freshRun && resolution.ordinaryEvidence === receipt.path && receipt.testSourceHashes?.[test.file] === file.sha256 : expectedFailure);
      const fault = fixed && records.find((record) => resolution.faultMutationIds?.includes(record.id)
        && record.applicationDigest === application.applicationDigest && directFaultFor(record, test));
      const row = { defectId: defect.id, ...test, kind: resolution.kind, expectedFailure, ordinaryVerified: !!ordinaryVerified, directFaultId: fault?.id || null, ordinaryEvidence: resolution.ordinaryEvidence };
      cases.push(row);
      if (!ordinaryVerified) issues.missingOrdinaryDefectEvidence.push(row);
      if (fixed && !fault) issues.missingFixedDefectFaults.push(row);
    }
  }
  return { manifestSha256: sha256(manifestText), defectsSha256: sha256(defectsText), application, cases, issues };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {

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
const acceptanceEnabled = fs.existsSync("test-audit/adversarial/acceptance.json");
for (const file of fs.readdirSync("test-audit/mutations").filter((file) => file.endsWith(".results.json")).sort()) {
  const data = read(`test-audit/mutations/${file}`);
  for (const record of Array.isArray(data) ? data : data.results || []) {
    const kind = record.kind === "regression-mutation" ? "fault-injection" : record.kind || "fault-injection";
    const artifact = record.artifact || record.evidencePath || file;
    const stage = record.stage || record.phase || (/before|survival/.test(artifact) ? "before" : "after");
    const tests = (record.mutated?.tests || []).map(({ file, name, status }) => ({ file, name, status }));
    const applicationDigest = record.applicationDigest || data.applicationDigest || null;
    const identity = JSON.stringify([record.id, record.file, kind, stage, tests, ...(acceptanceEnabled ? [applicationDigest] : [])]);
    const key = createHash("sha256").update(identity).digest("hex").slice(0, 16);
    const existing = experiments.get(key);
    if (existing) {
      existing.evidence.push(file);
      continue;
    }
    experiments.set(key, { ...record, key, kind, stage, applicationDigest, evidence: [file] });
  }
}
const records = [...experiments.values()];
const suiteFile = process.argv[2];
const runtimeRows = suiteFile ? reportCases(read(suiteFile)) : [];
const acceptance = verifyDefectAcceptance({ records, runtimeRows, suiteFile });
const acceptedCase = (test) => acceptance?.cases.find((entry) => caseKey(entry) === caseKey(test));
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
      ? namesOf(action).filter((name) => {
        const test = action.afterTests?.find((entry) => entry.name === name) || { file: fileOf(action), name };
        const defect = acceptedCase(test);
        return defect ? defect.kind === "fixed" ? !defect.directFaultId : !defect.ordinaryVerified
          : acceptance ? !relevant.some((record) => directFaultFor(record, test, { allowCi: true })) : !killed.has(name);
      }) : [],
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

const caseActions = [...actions, ...additions];
for (const test of runtimeRows) {
  const matches = caseActions.filter((action) => action.action !== "deleted" && namesOf(action).includes(test.name)
    && (fileOf(action) === test.file || action.afterTests?.some((entry) => entry.file === test.file && entry.name === test.name)));
  test.actions = matches.map((action) => action.beforeId || `added:${action.artifact}`);
  const classifications = [...new Set(matches.map((action) => action.afterClassification || action.classification).filter(Boolean))];
  test.classification = classifications.length === 1 ? classifications[0] : matches.length ? "CONFLICT" : "UNMAPPED";
  test.mutationIds = [...new Set(matches.flatMap((action) => action.mutationIds || []))];
  test.killedByProof = records.some((record) => valid(record) && record.outcome === "killed"
    && test.mutationIds.includes(record.id) && (acceptance ? directFaultFor(record, test, { allowCi: true })
      : record.killedBy.some((entry) => entry.name === test.name && entry.file === test.file)));
  const defect = acceptedCase(test);
  if (defect) {
    test.defectResolution = defect.kind;
    test.killedByProof = !!defect.directFaultId;
    test.ordinaryDefectEvidence = defect.ordinaryVerified;
  }
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
    ...(acceptance?.issues || {}),
  },
  ...(acceptance ? { acceptance } : {}),
  sourceRows, additions, runtimeRows, proofs: proofRows, mutants, experiments: records,
};
write("test-audit/ledger.json", result);
process.stdout.write(`${sourceRows.length} original declarations; ${result.sourceCounts.pending} pending actions; ${runtimeRows.length} runtime cases\n`);
process.stdout.write(`${result.issues.missingCaseKills.length} missing kills; ${result.issues.missingSurvival.length} missing survival proofs; ${result.issues.unmappedRuntime.length} unmapped runtime cases\n`);
if (process.argv.includes("--strict") && (result.sourceCounts.pending || Object.values(result.issues).some((rows) => rows.length))) process.exitCode = 1;
}
