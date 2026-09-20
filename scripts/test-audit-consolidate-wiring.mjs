import { createHash } from "node:crypto";
import fs from "node:fs";

const inventory = JSON.parse(fs.readFileSync("test-audit/inventory.json", "utf8"));
const reviews = JSON.parse(fs.readFileSync("test-audit/reviews/wiring.before.json", "utf8"));
const contracts = JSON.parse(fs.readFileSync("src/test/fixtures/cli/help-contract.json", "utf8"));
const mutations = JSON.parse(fs.readFileSync("test-audit/mutations/cli.after.results.json", "utf8"));
const proven = new Set(mutations.results.flatMap((mutation) => mutation.killedBy.map((test) => test.name)));
const actions = [];
let removed = 0;

for (const file of reviews.files.filter((file) => file.tests.every((test) => test.classification === "COUPLED"))) {
  const stem = file.path.split("/").at(-1).replace("-command-handler.test.ts", "");
  let route = stem;
  if (stem.startsWith("setup-remote-")) route = `setup remote ${stem.slice(13)}`;
  else {
    for (const parent of ["setup", "web", "sandbox", "dream", "helper", "machine", "import"]) {
      if (stem.startsWith(`${parent}-`)) route = `${parent} ${stem.slice(parent.length + 1)}`;
    }
  }
  const matches = contracts.filter((contract) => contract.path === route || contract.path.startsWith(`${route} `));
  if (!matches.length) throw new Error(`No behavior replacement for ${file.path} (${route})`);
  const afterNames = matches.map((contract) => `CLI help contract documents ${contract.path}`);
  if (afterNames.some((name) => !proven.has(name))) throw new Error(`Unproven replacement for ${file.path}`);
  if (fs.existsSync(file.path)) {
    const digest = createHash("sha256").update(fs.readFileSync(file.path)).digest("hex");
    if (digest !== inventory.files.find((entry) => entry.path === file.path).sha256) throw new Error(`Refusing to overwrite changed file ${file.path}`);
    fs.unlinkSync(file.path);
    removed++;
  }
  for (const test of file.tests) actions.push({
    beforeId: `${file.path}:${test.line}`,
    beforeName: test.name,
    beforeClassification: test.classification,
    action: "rewritten",
    afterNames,
    classification: "STRONG",
    afterClassification: "STRONG",
    evidence: "Consolidated source-string registration checks into literal command-path, usage, description, and option assertions against the built CLI. Handler effects are assessed separately in the feature matrix.",
    mutationIds: mutations.results.filter((mutation) => mutation.killedBy.some((test) => afterNames.includes(test.name))).map((mutation) => mutation.id),
  });
}

const original = reviews.files.find((file) => file.path.endsWith("cli-command-wiring.test.ts")).tests[0];
actions.push({
  beforeId: `src/test/cli-command-wiring.test.ts:${original.line}`,
  beforeName: original.name,
  beforeClassification: original.classification,
  action: "rewritten",
  afterNames: [...proven].sort(),
  classification: "STRONG",
  afterClassification: "STRONG",
  evidence: "Literal full paths preserve parent-child relationships. All 112 command and alias cases fail when their registration is omitted and pass after restoration.",
  mutationIds: mutations.results.map((mutation) => mutation.id),
});
fs.writeFileSync("test-audit/reviews/cli.after.json", `${JSON.stringify({ tests: actions }, null, 2)}\n`);
process.stdout.write(`${removed} duplicate source-check files removed; ${actions.length} original declarations mapped to verified contracts.\n`);
