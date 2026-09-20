import fs from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const ref = "f4b9135ae350fad937a66f03a9bc3ccfbd8c6906";
const prefix = "test-audit/adversarial/context-f4b9135";
if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== ref) throw new Error("Wrong application ref");
const files = ["src/test/context-adversarial.test.ts", "src/test/config-display-adversarial.test.ts"];
const originals = files.map(file => [file, fs.readFileSync(file)]);
const production = execFileSync("git", ["ls-files", "src", "prompts", "extensions"], { encoding: "utf8" }).trim().split("\n").filter(file => !file.startsWith("src/test/") && !file.endsWith(".test.ts"));
const digest = () => createHash("sha256").update(production.map(file => `${file}\0${fs.readFileSync(file).toString("base64")}`).join("\0")).digest("hex");
const before = digest();
for (const suffix of ["ordinary.json", "ordinary-summary.json", "ordinary-before-tests.json"]) if (fs.existsSync(`${prefix}-${suffix}`)) throw new Error(`Immutable result already exists: ${suffix}`);
fs.writeFileSync(`${prefix}-ordinary-before-tests.json`, JSON.stringify(originals.map(([file, bytes]) => ({ file, source: bytes.toString() })), null, 2) + "\n");
let run;
try {
 for (const [file, bytes] of originals) fs.writeFileSync(file, bytes.toString().replaceAll('it.fails("ADV-CTX-', 'it("ADV-CTX-'));
 run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files, "-t", "ADV-CTX-00[12]", "--reporter=json", `--outputFile=${prefix}-ordinary.json`], { encoding: "utf8", timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
} finally {
 for (const [file, bytes] of originals) fs.writeFileSync(file, bytes);
 if (digest() !== before) throw new Error("Application changed during ordinary reproduction");
}
const report = JSON.parse(fs.readFileSync(`${prefix}-ordinary.json`, "utf8"));
const tests = report.testResults.flatMap(file => file.assertionResults.filter(test => !["pending", "skipped"].includes(test.status)).map(test => ({ file: file.name, name: test.fullName, status: test.status, failures: test.failureMessages })));
fs.writeFileSync(`${prefix}-ordinary-summary.json`, JSON.stringify({ ref, applicationDigest: before, applicationRestored: true, testSourcesRestored: originals.every(([file, bytes]) => fs.readFileSync(file).equals(bytes)), exitCode: run.status, tests }, null, 2) + "\n");
process.stdout.write(JSON.stringify({ exitCode: run.status, tests }, null, 2) + "\n");
if (run.status !== 1 || report.numFailedTests !== 3 || tests.length !== 3 || tests.some(test => test.status !== "failed")) throw new Error("Expected three ordinary open-defect failures");
