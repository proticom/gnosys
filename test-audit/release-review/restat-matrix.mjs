import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const rows = read("test-audit/feature-coverage.json");
const original = JSON.parse(execFileSync("git", ["show", "ec19554:test-audit/feature-coverage.json"], { encoding: "utf8" }));
const prior = JSON.parse(execFileSync("git", ["show", "bd9f3f4:test-audit/feature-coverage.json"], { encoding: "utf8" }));
const config = read("test-audit/release-review/reconcile-config.json");
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
update("F41", "boundary", "KNOWN_DEFECT", "All eight hostile filename forms remain exercised. Variable reinforcement arguments use shell-free argv; transport preserves the supplied bytes and creates no execution marker. A direct variable-shell fault fails the ordinary transport test. The user's clarified ruling permits the exact constant dashboard command, which is registered by the built CLI and exits0. Complete selected-ID reinforcement still fails under D-VSC-001. The passing transport test does not pin a filename where the CLI requires a memory ID.");
update("F41", "permissions", "KNOWN_DEFECT", "All four lookalike components reject with both separator styles; the substring fault fails nine ordinary cases. Deep exact .gnosys paths reach reinforcement, but successful ID resolution remains blocked by D-VSC-001. D-VSC-003 is fixed under the clarified variable-argument ruling: constant dashboard shell text is permitted. Backslash paths are tested on a POSIX host, not native Windows.");
update("F29", "failure", "KNOWN_DEFECT", "Existing native SQLite retry, unavailable-module, corrupt-handle and FTS fallback cases remain mapped. ADV-FTS-001 still reproduces at e9d605f: a lost central FTS table is recreated empty on reopen, leaving stored content present but search empty. db.ts is unchanged from f4b9135; final archive and search-sidecar repairs do not repair this distinct case. Real network-share locking and power-loss durability remain unverified.");
if (rows.length !== 164 || new Set(rows.map(row => row.featureId)).size !== 41) throw new Error("Feature inventory changed");
write("test-audit/feature-coverage.json", rows);
const compare = source => source.filter(row => row.status === "KNOWN_DEFECT").map(old => {
  const current = rows.find(row => row.featureId === old.featureId && row.obligationKind === old.obligationKind);
  return { featureId: old.featureId, obligationKind: old.obligationKind, before: old.status, after: current.status, reason: current.limitations, tests: current.tests };
});
write("test-audit/release-review/feature-restatus.json", { applicationRef: config.applicationFixRef,
  originalKnownDefectRows: compare(original), previousReviewKnownDefectRows: compare(prior),
  inventory: { groups: 41, obligations: 164 }, inverseRepairCredit: false });
