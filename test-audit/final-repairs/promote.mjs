import fs from "node:fs";
import assert from "node:assert/strict";

const files = [
  ["src/test/vscode-extension.test.ts", 2],
  ["src/test/vscode-adversarial.test.ts", 4],
  ["src/test/routing-reset-adversarial.test.ts", 2],
  ["src/test/setup-ui-summary.test.ts", 2],
];
for (const [file, count] of files) {
  const before = fs.readFileSync(file, "utf8");
  const matches = before.match(/\bit\.fails\(/g) ?? [];
  assert.ok(matches.length === 0 || matches.length === count, `${file}: unexpected failure markers`);
  fs.writeFileSync(file, before.replace(/\bit\.fails\(/g, "it("));
}
