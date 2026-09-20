import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const rows = read("test-audit/feature-coverage.json");
const before = JSON.parse(execFileSync("git", ["show", "ec19554:test-audit/feature-coverage.json"], { encoding: "utf8" }));
const actions = fs.readdirSync("test-audit/reviews").filter(file => file.endsWith(".after.json")).flatMap(file => {
  const data = read(`test-audit/reviews/${file}`);
  return [...(data.tests || data.actions || []), ...(data.additionalTests || [])];
});
const cases = actions.filter(row => row.action !== "deleted").flatMap(row => (row.afterNames || [row.name]).map(name => ({
  file: row.file || row.beforeId?.replace(/:\d+$/, ""), name, mutationIds: row.mutationIds || [],
})));
const key = test => JSON.stringify([test.file, test.name]);
const oldName = "VS Code extension public commands D-VSC-003: passes shell syntax in a filename as literal text";
const newName = "VS Code extension public commands D-VSC-003: reads the selected memory ID without evaluating shell syntax in its filename";
for (const row of rows) row.tests = row.tests.map(test => {
  const renamed = { ...test, name: test.name === oldName ? newName : test.name };
  return cases.find(test => key(test) === key(renamed)) || renamed;
});
const matching = (file, name = /.*/) => cases.filter(test => file.test(test.file) && name.test(test.name));
function update(id, kind, status, limitations, extra = []) {
  const row = rows.find(row => row.featureId === id && row.obligationKind === kind);
  if (!row) throw new Error(`Unknown obligation ${id}/${kind}`);
  row.status = status;
  row.limitations = limitations;
  row.tests = [...new Map([...row.tests, ...extra].map(test => [key(test), test])).values()];
}
update("F03", "failure", "PARTIAL", "Actual CLI context/import and MCP twins reject absent providers with setup guidance. The custom-provider boundary supplements the original Ollama cases. Invalid-config shapes outside the existing mapped cases remain unverified.", matching(/context-adversarial/, /without a provider/));
update("F03", "boundary", "KNOWN_DEFECT", "DEF-G1-001 remains open. Reset retains multiple overrides and reset-then-one-override retains old tasks. The corrected summary expects all ollama and fails. Serialized bytes of every unrelated JSON value, including llm and dream, remain unchanged. Whole-file whitespace is not asserted. Original v584 deep-merge tests remain byte-identical and pass.", matching(/routing-reset-adversarial|setup-ui-summary/, /reset|marks an edited routing/));
update("F03", "permissions", "KNOWN_DEFECT", "Human config display identifies the key source without exposing the fake stored key. JSON display prints the stored custom-provider apiKey, reproduced as ADV-CTX-001. The expected failure does not prove redaction; other provider key fields are not individually exercised.", matching(/config-display-adversarial/));
update("F04", "success", "PARTIAL", "Existing mapped wizard cases verify persisted choices and IDE configuration. A real PTY completes core-memory setup after skipping provider and IDE integration with Setup Complete and exit0. Live provider credentials and launching every installed IDE remain outside these cases.", matching(/setup-adversarial/, /completes the interactive/));
update("F04", "failure", "PARTIAL", "Actual credential validation rejects invalid keys. Main setup Ctrl+C now exits130 at both the provider and later IDE prompt; models and ides still exit130. The cancellation fault is killed by both repaired ordinary cases. Other model validation/recovery combinations remain outside this subset.", matching(/setup-adversarial/, /G2-D001/));
const readSuccess = rows.find(row => row.featureId === "F08" && row.obligationKind === "success");
readSuccess.limitations = readSuccess.limitations.replace("Repeated upsert is separately defective G2-D002.", "Repeated upsert repair G2-D002 is verified by the F09 boundary cases.");
update("F08", "permissions", "PARTIAL", "Real MCP starts in project A with the same relative filename in A and B linked to distinct memory IDs. Explicit project B update changes only B's persisted content and leaves A unchanged; a cwd-fallback fault is killed. Other optional-store and ID-based permission rules are outside this case.", matching(/context-adversarial/, /explicit project B update/));
update("F09", "boundary", "PARTIAL", "Repeated writes now yield exactly one hit in searchFts, discoverFts, archive fallback and hybrid keyword mode. A raw SQLite database with duplicate FTS rows heals on open, retains both memories, remains user_version5, and makes no database write on the second open. Three direct FTS faults are killed. Existing punctuation/limit/update cases remain mapped; broader Unicode/ID/tie behavior is not fully established. The unchanged 50ms FTS assertion is a hosted-runner flake risk.", matching(/fts-adversarial/, /G2-D002/));
update("F18", "success", "PARTIAL", "CLI and MCP save literal extracted context through Ollama and custom-provider HTTP boundaries. The second fixture uses different journal text. Direct configured-provider and content faults are killed. Changed-knowledge augmentation is not independently verified.", matching(/context-adversarial/, /context commits|CLI context commits/));
update("F18", "boundary", "PARTIAL", "MCP dry-run writes nothing. Both startup-project tests skip repeated context. Identical text saves separately in A then B, and repeating in B skips B's existing memory. Scoped-dedup and cross-project false-skip faults are killed. CLI repetition and augmentation are outside these cases.", matching(/context-adversarial/, /same context is saved|repeated B context|startup-project context/));
update("F18", "permissions", "PARTIAL", "Explicit context calls persist separate A/B project IDs with project scope and observed authority. The cross-project scope fault is killed. Caller-selected declared/imported provenance and optional stores remain outside this tool path.", matching(/context-adversarial/, /same context is saved/));
update("F19", "success", "KNOWN_DEFECT", "Direct import-module and bootstrap tests persist their mapped data. Configured CLI and MCP provider/concurrency paths pass, but normal CLI and MCP entry points report Imported:2 while reopening the database finds zero memories. ADV-CTX-002 remains an expected failure for both surfaces. Provider repair does not establish durable import writes.", matching(/context-adversarial/, /normal .* bulk import persists/));
update("F19", "boundary", "PARTIAL", "Original CLI provider requests honor configured concurrency2 and explicit override1. Custom-provider CLI and MCP dry-run cases also exercise literal records and measured concurrency2 without writes. Direct concurrency/provider faults are killed. Existing skip/offset/limit cases remain mapped; exhaustive input formats and frontmatter combinations are not claimed.", matching(/context-adversarial/, /custom-provider .* bulk import uses/));
update("F26", "boundary", "PARTIAL", "Empty-project briefings return literal empty results. Stored roadmap and open-question titles containing HTML/script syntax render as escaped text in actual generated HTML; removing escaping fails both tests. Archived/dead registry entries and malformed status headings still need separate cases.", matching(/dashboard-html-adversarial/, /renders malicious/));
update("F26", "permissions", "KNOWN_DEFECT", "Memory titles are escaped, but a stored project name executes JavaScript through a generated click handler (D-DASH-001). The actual emitted handler is entity-decoded and evaluated in an isolated VM; a full browser is not claimed. Report project-scope controls remain outside this probe.", matching(/dashboard-html-adversarial/));
update("F29", "failure", "KNOWN_DEFECT", "Existing native SQLite retry, unavailable-module, corrupt-handle and FTS fallback cases remain mapped. New ADV-FTS-001 shows a lost FTS table is recreated empty on reopen: stored content survives but search returns no hit. Comparison with the predecessor reproduces the regression. Real network-share locking and power-loss durability remain unverified.", matching(/fts-adversarial/, /ADV-FTS-001/));
update("F29", "boundary", "PARTIAL", "Public reopen reads persisted content with fresh statements. Repeated upserts now produce one FTS result. Raw duplicate-index healing preserves user_version5 and all memories; the second open causes no native data_version change. Direct repeat-write, omitted-heal and repeated-heal faults are killed. Crash injection and binary-field transaction breadth remain outside these cases.", matching(/fts-adversarial/, /G2-D002/));
update("F35", "failure", "PROTECTED", "Real loopback HTTP cases observe the named 401,403,400,404,413,408 responses. The added malformed-JSON POST returns400 and leaves health200 with zero sessions; changing that response to500 fails the test. These claims cover the named local-server status contracts.", matching(/http-json-adversarial/));
update("F41", "success", "KNOWN_DEFECT", "The dashboard invokes a command derived from built CLI registration and exits0; a removed-command fault is killed. D-VSC-001 remains open: reinforcement passes a file path and omits the useful signal. A fresh unrelated UUID and decoy records expose hardcoded or wrong-ID behavior. Native VS Code is represented by a host boundary double while the actual local CLI runs.", matching(/vscode-adversarial/, /unique selected|D-VSC-004/));
update("F41", "failure", "KNOWN_DEFECT", "No-editor/outside-store notifications and a real missing-executable error are protected. The launch-error fixture now supplies a valid memory document, so it does not require launching for unreadable IDs. Missing, empty and body-only IDs still fail the required warning/no-subprocess contract under D-VSC-001. Native VS Code UI is not launched.", matching(/vscode-adversarial/, /warns without launching/));
update("F41", "boundary", "KNOWN_DEFECT", "All eight hostile filename forms are exercised. The reinforcement subprocess is shell-free and harmless marker commands do not run, but complete filename-to-selected-ID reinforcement still fails under D-VSC-001. Dashboard launch still uses a shell under the extension-wide D-VSC-003 requirement. The CLI expects a memory ID, so the literal selected file supplies that ID rather than being pinned as an obsolete positional filename. Native activation is unverified.", matching(/vscode-adversarial/, /D-VSC-003/));
update("F41", "permissions", "KNOWN_DEFECT", "All four lookalike components reject with both separator styles; reintroducing substring matching fails nine ordinary cases. Deep exact .gnosys paths reach reinforcement, but successful ID resolution remains blocked by D-VSC-001. The dashboard still uses terminal.sendText and a shell, so the user's all-command shell-free requirement remains open. Backslash paths are exercised on the POSIX host, not native Windows.", matching(/vscode-adversarial/, /D-VSC-002|every extension command/));
if (rows.length !== 164 || new Set(rows.map(row => row.featureId)).size !== 41) throw new Error("Feature inventory changed");
write("test-audit/feature-coverage.json", rows);
write("test-audit/adversarial/feature-restatus.json", { applicationRef: "f4b9135ae350fad937a66f03a9bc3ccfbd8c6906",
  originalKnownDefectRows: before.filter(row => row.status === "KNOWN_DEFECT").map(old => {
    const current = rows.find(row => row.featureId === old.featureId && row.obligationKind === old.obligationKind);
    return { featureId: old.featureId, obligationKind: old.obligationKind, before: old.status, after: current.status, reason: current.limitations, tests: current.tests };
  }),
  changedRows: rows.filter(row => JSON.stringify(row) !== JSON.stringify(before.find(old => old.featureId === row.featureId && old.obligationKind === row.obligationKind)))
    .map(row => ({ featureId: row.featureId, obligationKind: row.obligationKind, status: row.status })),
  inventory: { groups: 41, obligations: 164 }, inverseRepairCredit: false });
