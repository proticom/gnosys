import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const specPath = process.argv[2];
if (!specPath) throw new Error("Usage: node scripts/test-audit-mutate.mjs <spec.json> [result.json]");
const specs = JSON.parse(fs.readFileSync(specPath, "utf8"));
const output = process.argv[3] || specPath.replace(/\.json$/, ".results.json");
const root = process.cwd();
const lock = path.join(root, "test-audit/.mutation-lock");
const temporary = fs.mkdtempSync("/tmp/gnosys-audit-mutation-");
const productionPaths = execFileSync("git", ["ls-files", "src", "prompts", "extensions"], { encoding: "utf8" })
  .trim().split("\n").filter((file) => !file.startsWith("src/test/") && !file.endsWith(".test.ts"));
const digest = () => createHash("sha256").update(productionPaths.map((file) => `${file}\0${fs.readFileSync(file).toString("base64")}`).join("\0")).digest("hex");
const originalDigest = digest();
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", ...productionPaths], { stdio: "pipe" });
fs.mkdirSync(lock);
const results = [];

function build() {
  const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], { encoding: "utf8", timeout: 120_000 });
  if (result.status !== 0) throw new Error(`Build failed: ${result.stdout}${result.stderr}`);
}

function run(spec, phase) {
  const json = path.join(temporary, `${spec.id}-${phase}.json`);
  const args = ["node_modules/vitest/vitest.mjs", "run", ...spec.tests, "--reporter=json", `--outputFile=${json}`];
  if (spec.testName) args.push("-t", spec.testName);
  const started = Date.now();
  const child = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: spec.timeoutMs || 180_000, maxBuffer: 16 * 1024 * 1024 });
  const report = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, "utf8")) : null;
  const tests = report?.testResults.flatMap((file) => file.assertionResults.map((test) => ({
    file: path.relative(root, file.name),
    name: test.fullName,
    status: test.status,
    failures: test.failureMessages.map((message) => message.replaceAll(root, "<repo>").slice(0, 2000)),
  }))).filter((test) => !["pending", "skipped", "todo"].includes(test.status)) || [];
  return { exitCode: child.status, durationMs: Date.now() - started, error: child.error?.message || null, tests,
    diagnostic: !report ? `${child.stdout}${child.stderr}`.slice(-4000).replaceAll(root, "<repo>") : undefined };
}

try {
  for (const spec of specs) {
    if (!productionPaths.includes(spec.file)) throw new Error(`Mutation target is not application code: ${spec.file}`);
    const original = fs.readFileSync(spec.file, "utf8");
    if (original.split(spec.search).length !== 2) throw new Error(`Mutation ${spec.id} must match exactly once`);
    const result = { id: spec.id, file: spec.file, description: spec.description, before: run(spec, "before") };
    if (result.before.exitCode !== 0 || !result.before.tests.length) throw new Error(`Baseline failed or selected no tests for ${spec.id}`);
    try {
      fs.writeFileSync(spec.file, original.replace(spec.search, spec.replace));
      if (spec.build) build();
      result.mutated = run(spec, "mutated");
    } finally {
      fs.writeFileSync(spec.file, original);
      if (spec.build) build();
    }
    if (digest() !== originalDigest) throw new Error(`Application restoration failed after ${spec.id}`);
    result.restored = run(spec, "restored");
    const failures = result.mutated.tests.filter((test) => test.status === "failed");
    result.outcome = result.restored.exitCode !== 0 ? "invalid-restoration" : result.mutated.error ? "invalid-run" : failures.length ? "killed" : result.mutated.exitCode === 0 ? "survived" : "invalid-run";
    result.killedBy = failures.map(({ file, name }) => ({ file, name }));
    result.applicationRestored = true;
    results.push(result);
    fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, applicationDigest: originalDigest, results }, null, 2)}\n`);
    process.stdout.write(`${spec.id}: ${result.outcome}; ${failures.length} failing test(s)\n`);
    if (result.outcome.startsWith("invalid")) throw new Error(`Invalid mutation experiment ${spec.id}`);
  }
} finally {
  fs.rmdirSync(lock);
  if (digest() !== originalDigest) throw new Error("Application files differ after mutation run");
}
