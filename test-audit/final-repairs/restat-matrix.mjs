import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const rows = read("test-audit/feature-coverage.json");
const original = JSON.parse(execFileSync("git", ["show", "ec19554:test-audit/feature-coverage.json"], { encoding: "utf8" }));
const prior = JSON.parse(execFileSync("git", ["show", "bd9f3f4:test-audit/feature-coverage.json"], { encoding: "utf8" }));
const config = read("test-audit/final-repairs/reconcile-config.json");
const key = test => JSON.stringify([test.file, test.name]);
const cases = new Map(fs.readdirSync("test-audit/reviews").filter(file => file.endsWith(".after.json")).flatMap(file => {
  const data = read(`test-audit/reviews/${file}`);
  return [...(data.tests || data.actions || []), ...(data.additionalTests || [])];
}).filter(row => row.action !== "deleted").flatMap(row => (row.afterNames || [row.name]).map(name => {
  const test = { file: row.file || row.beforeId?.replace(/:\d+$/, ""), name, mutationIds: row.mutationIds || [] };
  return [key(test), test];
})));
const oldName = "VS Code adversarial public commands D-VSC-003: every extension command launches processes without a shell";
const newName = "VS Code adversarial public commands D-VSC-003: variable arguments use shell-free argv while the constant dashboard command runs";
for (const row of rows) row.tests = row.tests.map(test => {
  const renamed = { ...test, name: test.name === oldName ? newName : test.name };
  return cases.get(key(renamed)) || renamed;
});
function update(featureId, obligationKind, status, limitations) {
  const row = rows.find(row => row.featureId === featureId && row.obligationKind === obligationKind);
  if (!row) throw new Error(`Missing ${featureId}/${obligationKind}`);
  Object.assign(row, { status, limitations });
}
update("F19", "success", "PARTIAL", "Normal CLI and MCP imports now persist both literal records in the target central database and report Imported:2. Removing the database argument from each caller fails its ordinary persistence test; restoration passes. ADV-CTX-002 is fixed. Existing direct import-module and bootstrap persistence cases remain mapped. This does not establish every format, optional store or remote provider.");
update("F41", "boundary", "PARTIAL", "All eight hostile filename forms pass with selected-ID reinforcement and shell-free literal argv. Variable-shell, constant-ID and wrong-signal faults fail ordinary cases. The exact constant dashboard command is permitted and exits 0. Native VS Code and Windows remain unverified.");
update("F41", "permissions", "PARTIAL", "All four lookalike components reject with both separator styles. Deep exact .gnosys paths resolve the selected ID and reinforce only that record. The substring fault fails nine ordinary cases. Windows separators are exercised on POSIX, not native Windows.");
update("F29", "failure", "KNOWN_DEFECT", "Existing native SQLite retry, unavailable-module, corrupt-handle and FTS fallback cases remain mapped. ADV-FTS-001 still reproduces at e9d605f: a lost central FTS table is recreated empty on reopen, leaving stored content present but search empty. db.ts is unchanged from f4b9135; final archive and search-sidecar repairs do not repair this distinct case. Real network-share locking and power-loss durability remain unverified.");
update("F03", "boundary", "PARTIAL", "Reset removes all local overrides and reset-then-edit keeps only the new structuring override. Serialized unrelated JSON values including llm and dream remain identical. Old-reset and lost-Dream faults fail their ordinary cases; unchanged v584 deep-merge tests pass. Source whitespace is not the preservation contract. Global inherited overrides are reported by the application but are outside these four repair cases.");
update("F41", "success", "PARTIAL", "The dashboard command is derived from built CLI registration and exits 0. Reinforcement uses a fresh selected frontmatter ID with decoy records and the useful signal, updating only the selected memory. Fixed-ID and wrong-signal faults fail ordinary cases. Extension commands run through a VS Code API shim, not native VS Code.");
update("F41", "failure", "PARTIAL", "Missing, empty and body-only IDs warn and launch no subprocess. A forced launch without an ID fails all three cases. No-editor, outside-store and real missing-executable errors remain protected, including an error-notification fault. Native editor integration is not exercised.");
if (rows.length !== 164 || new Set(rows.map(row => row.featureId)).size !== 41) throw new Error("Feature inventory changed");
write("test-audit/feature-coverage.json", rows);
const compare = source => source.filter(row => row.status === "KNOWN_DEFECT").map(old => {
  const current = rows.find(row => row.featureId === old.featureId && row.obligationKind === old.obligationKind);
  return { featureId: old.featureId, obligationKind: old.obligationKind, before: old.status, after: current.status, reason: current.limitations, tests: current.tests };
});
write("test-audit/final-repairs/feature-restatus.json", { applicationRef: config.applicationFixRef,
  originalKnownDefectRows: compare(original), previousReviewKnownDefectRows: compare(prior),
  inventory: { groups: 41, obligations: 164 }, inverseRepairCredit: false });
