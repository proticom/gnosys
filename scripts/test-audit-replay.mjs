import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const [revision, file, spec, output] = process.argv.slice(2);
if (!output || !file.startsWith("src/test/") || !file.endsWith(".test.ts")) {
  throw new Error("Usage: node scripts/test-audit-replay.mjs <revision> <test.ts> <spec.json> <results.json>");
}
const current = fs.readFileSync(file);
const original = execFileSync("git", ["show", `${revision}:${file}`]);
try {
  fs.writeFileSync(file, original);
  const result = spawnSync(process.execPath, ["scripts/test-audit-mutate.mjs", spec, output], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.writeFileSync(file, current);
}
