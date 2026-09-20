import fs from "node:fs";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const actionData = read(process.argv[2]);
const recordData = read(process.argv[3]);
const actions = Array.isArray(actionData) ? actionData : actionData.tests || actionData.actions;
const records = Array.isArray(recordData) ? recordData : recordData.results;
const rows = actions.map((action) => {
  const ids = action.mutationIds || [];
  const relevant = records.filter((record) => ids.includes(record.id));
  const killedNames = new Set(relevant.filter((record) => record.outcome === "killed" && record.applicationRestored)
    .flatMap((record) => record.killedBy.map((test) => test.name)));
  const survival = (action.beforeNames || [action.beforeName]).every((name) => relevant.some((record) =>
    record.applicationRestored && record.mutated?.tests.some((test) =>
      test.status === "passed" && (test.name === name || test.name.endsWith(` ${name}`)))));
  return {
    beforeId: action.beforeId,
    action: action.action,
    beforeClassification: action.beforeClassification,
    survivingMutation: survival,
    structuralReason: action.structuralReason || null,
    missingKillNames: ["rewritten", "expected_failure"].includes(action.action)
      ? (action.afterNames || []).filter((name) => !killedNames.has(name)) : [],
    mutationIds: ids,
  };
});
const missingKills = rows.filter((row) => row.missingKillNames.length);
const missingSurvival = rows.filter((row) => ["WEAK", "HOLLOW"].includes(row.beforeClassification)
  && !row.survivingMutation && !row.structuralReason);
const report = { actions: rows.length, missingKills, missingSurvival, rows };
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${rows.length} actions; ${missingKills.length} missing case kills; ${missingSurvival.length} need surviving-mutation or structural evidence\n`);
for (const row of missingKills) process.stdout.write(`Missing kill ${row.beforeId}: ${row.missingKillNames.join(", ")}\n`);
for (const row of missingSurvival) process.stdout.write(`Missing survival or structural reason ${row.beforeId}\n`);
if (process.argv.includes("--strict") && (missingKills.length || missingSurvival.length)) process.exitCode = 1;
