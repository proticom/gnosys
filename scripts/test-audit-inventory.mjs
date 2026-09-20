import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import ts from "typescript";

const paths = execFileSync("git", ["ls-files", "*.test.ts"], {
  encoding: "utf8",
}).trim().split("\n");

function rootName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return rootName(expression.expression);
  if (ts.isCallExpression(expression)) return rootName(expression.expression);
  return "";
}

function title(expression, source) {
  return ts.isStringLiteralLike(expression) ? expression.text : expression.getText(source);
}

const files = paths.map((path) => {
  const text = fs.readFileSync(path, "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const tests = [];
  const imports = [];
  const mocks = [];
  function visit(node, suites = []) {
    if (ts.isImportDeclaration(node)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && /^vi\.(?:mock|doMock)$/.test(node.expression.getText(source))) {
      mocks.push(node.arguments[0]?.getText(source));
    }
    if (ts.isCallExpression(node)) {
      const root = rootName(node.expression);
      const callback = node.arguments.find((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
      if (callback && ["describe", "suite", "it", "test"].includes(root)) {
        const name = title(node.arguments[0], source);
        if (["describe", "suite"].includes(root)) {
          ts.forEachChild(callback.body, (child) => visit(child, [...suites, name]));
          return;
        }
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const body = callback.body.getText(source);
        const assertions = [...body.matchAll(/\.(to[A-Z]\w*|assertions|hasAssertions)\s*\(/g)].map((match) => match[1]);
        tests.push({
          id: `${path}:${line}`,
          line,
          name,
          suites,
          declaration: node.expression.getText(source),
          assertions,
          signals: {
            noLocalExpect: !/\b(?:expect|assert)\s*[.(]/.test(body),
            weakMatchers: assertions.filter((name) => ["toBeDefined", "toBeTruthy", "toBeFalsy", "toBeGreaterThan"].includes(name)),
            snapshot: assertions.some((name) => name.includes("Snapshot")),
            conditional: /\b(?:if|catch)\s*\(/.test(body),
            sourceInspection: /(?:readFileSync|readCliSource|readFile)\(/.test(body),
          },
        });
        return;
      }
      if (["it", "test"].includes(root) && /\.(?:todo|skip)$/.test(node.expression.getText(source)) && node.arguments.length === 1) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        tests.push({ id: `${path}:${line}`, line, name: title(node.arguments[0], source), suites, declaration: node.expression.getText(source), assertions: [], signals: { noLocalExpect: true } });
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, suites));
  }
  visit(source);
  return { path, sha256: createHash("sha256").update(text).digest("hex"), imports, mocks, tests };
});

const output = process.argv[2] || "test-audit/inventory.json";
fs.mkdirSync(output.slice(0, output.lastIndexOf("/")), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
process.stdout.write(`${files.length} files; ${files.reduce((count, file) => count + file.tests.length, 0)} test declarations; ${output}\n`);
