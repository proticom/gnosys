import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const ref = "f4b9135ae350fad937a66f03a9bc3ccfbd8c6906";
const outputFlag = process.argv.indexOf("--output");
if (outputFlag !== -1 && !process.argv[outputFlag + 1]) throw new Error("--output requires a report path");
const reportPath = outputFlag === -1
 ? path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-context-replay-")), "ordinary.json")
 : path.resolve(process.argv[outputFlag + 1]);
const summaryPath = reportPath.replace(/\.json$/, "") + ".summary.json";
const sourceSnapshotPath = reportPath.replace(/\.json$/, "") + ".sources.json";
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const expectedNames = [
 "adversarial config display ADV-CTX-001 JSON config output preserves model metadata without exposing stored key bytes",
 "adversarial context and provider routing ADV-CTX-002 normal CLI bulk import persists the reported memories",
 "adversarial context and provider routing ADV-CTX-002 normal MCP bulk import persists the reported memories",
].sort();
const checkoutRef = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const files = ["src/test/context-adversarial.test.ts", "src/test/config-display-adversarial.test.ts"];
const originals = files.map(file => [file, fs.readFileSync(file)]);
const production = execFileSync("git", ["ls-files", "src", "prompts", "extensions"], { encoding: "utf8" }).trim().split("\n").filter(file => !file.startsWith("src/test/") && !file.endsWith(".test.ts"));
const digest = () => createHash("sha256").update(production.map(file => `${file}\0${fs.readFileSync(file).toString("base64")}`).join("\0")).digest("hex");
const before = digest();
if (before !== "059ec3ee279146604895d9aba2dbc56f56480450e6c52fe27a2a32db0016b412") throw new Error("Wrong application digest; expected approved f4b9135 content");
for (const output of [reportPath, summaryPath, sourceSnapshotPath]) if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing result: ${output}`);
fs.writeFileSync(sourceSnapshotPath, JSON.stringify(originals.map(([file, bytes]) => ({ file, source: bytes.toString() })), null, 2) + "\n");
let run;
try {
 for (const [file, bytes] of originals) fs.writeFileSync(file, bytes.toString().replaceAll('it.fails("ADV-CTX-', 'it("ADV-CTX-'));
 run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files, "-t", "ADV-CTX-00[12]", "--reporter=json", `--outputFile=${reportPath}`], { encoding: "utf8", timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
} finally {
 for (const [file, bytes] of originals) fs.writeFileSync(file, bytes);
 if (digest() !== before) throw new Error("Application changed during ordinary reproduction");
}
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const tests = report.testResults.flatMap(file => file.assertionResults.filter(test => !["pending", "skipped"].includes(test.status)).map(test => ({ file: file.name, name: test.fullName, status: test.status, failures: test.failureMessages })));
fs.writeFileSync(summaryPath, JSON.stringify({ ref, checkoutRef, applicationDigest: before, applicationRestored: true, testSourcesRestored: originals.every(([file, bytes]) => fs.readFileSync(file).equals(bytes)), exactExpectedNames: expectedNames, exitCode: run.status, tests }, null, 2) + "\n");
process.stdout.write(JSON.stringify({ reportPath, summaryPath, exitCode: run.status, tests }, null, 2) + "\n");
if (run.status !== 1 || report.numFailedTests !== 3 || JSON.stringify(tests.map(test => test.name).sort()) !== JSON.stringify(expectedNames) || tests.some(test => test.status !== "failed") || originals.some(([file, bytes]) => !fs.readFileSync(file).equals(bytes))) throw new Error("Expected three ordinary open-defect failures");
